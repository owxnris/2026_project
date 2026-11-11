// 퀴즈 문제 공급과 채점.
// - 온라인(Firebase 설정값 있음): 서버 함수가 문제를 고르고 채점한다. 학생 기기는 정답을 받지 않는다
// - 예비 흐름(설정값 없음): questions.json으로 기기에서 채점한다 (spec.md: 이 예외를 둘지 [미정])
import { RULES, ABILITIES } from './config.js';
import { session } from './session.js';
import { state, resetPlay } from './state.js';
import { nextQuestion as nextLocal } from './questions.js';
import { callServer } from './firebase/server.js';

let runId = null; // 서버의 지금 판 번호 (끝나면 null)

const ids = () => ({ classId: session.classId, activityId: session.activityId });

// 던전 한 판 시작 (입장 퀴즈 직전)
export async function beginRun(dungeon) {
  resetPlay();
  runId = null;
  if (!session.online) return;
  ({ runId } = await callServer('startRun', { ...ids(), dungeon }));
}

// 문제 하나: { attemptId, question: { id, subject, question, choices }, timeLimitSec }
export async function nextQuestion(quizType) {
  if (!session.online) {
    const q = nextLocal();
    return { attemptId: null, question: q, timeLimitSec: RULES.QUIZ_TIME_SEC, local: q };
  }
  return callServer('issueQuestion', { ...ids(), runId, quizType });
}

// 답 내기 (chosen: 0~3, 시간 초과는 null): { correct, correctIndex }
// 서버는 같은 문제의 답을 한 번만 채점하므로, 실패해서 다시 보내도 코인이 두 번 오르지 않는다
export async function submitAnswer(item, chosen) {
  if (!session.online) {
    return { correct: chosen === item.local.answer, correctIndex: item.local.answer };
  }
  const res = await callServer('submitAnswer', { ...ids(), runId, attemptId: item.attemptId, chosen });
  return { correct: res.correct, correctIndex: res.correctIndex };
}

export function hasOpenRun() {
  return session.online && runId !== null;
}

// 산 능력의 가격 합
export function abilityCost(ab) {
  return ABILITIES.reduce((sum, a) => sum + (a.repeat ? ab[a.key] : (ab[a.key] ? 1 : 0)) * a.price, 0);
}

// 지금 판의 플레이 기록 (서버가 능력 가격 합 = 쓴 코인 ≤ 얻은 코인을 검사한다)
export function playStats(cleared) {
  const { hits, falls, dashesUsed, dungeonStartMs, abilities } = state.play;
  return {
    abilities: { ...abilities },
    coinsSpent: abilityCost(abilities),
    dashesUsed,
    hits,
    falls,
    clearSec: cleared ? Math.round((Date.now() - dungeonStartMs) / 1000) : null,
  };
}

// 판 끝 → 서버가 결과 문서를 만든다. 같은 판을 다시 보내도 결과는 하나 (실패하면 다시 부르면 된다)
// 돌려줌: { already } — already가 참이면 이미 끝난 판(예: 다른 창에서 새 판을 시작해 중도 종료로 저장됨)
// 저장 중에 또 부르면(예: 클리어 저장 중 시간 종료) 처음 요청을 기다린다 → 클리어가 실패로 바뀌지 않는다
let finishing = null;

export function finishRun(outcome, stats) {
  if (!hasOpenRun()) return Promise.resolve({ already: false });
  if (!finishing) {
    finishing = callServer('finishRun', { ...ids(), runId, outcome, stats })
      .then((res) => { runId = null; return res; })
      .finally(() => { finishing = null; });
  }
  return finishing;
}
