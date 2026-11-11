// 퀴즈 문제 공급과 채점.
// - 온라인(Firebase 설정값 있음): 서버 함수가 문제를 고르고 채점한다. 학생 기기는 정답을 받지 않는다
// - 예비 흐름(설정값 없음): questions.json으로 기기에서 채점한다 (spec.md: 이 예외를 둘지 [미정])
import { RULES } from './config.js';
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

// 지금 판의 플레이 기록 (서버가 능력 가격과 코인을 검사한다).
// 능력 구매(7-6) 전까지는 대시를 쓸 때마다 대시 1회를 산 것으로 센다 (대시 10코인 = 능력 가격)
export function playStats(cleared) {
  const { hits, falls, dashesUsed, dungeonStartMs } = state.play;
  return {
    abilities: { dash: dashesUsed, shield: false, doubleJump: false },
    coinsSpent: dashesUsed * RULES.DASH_COST,
    dashesUsed,
    hits,
    falls,
    clearSec: cleared ? Math.round((Date.now() - dungeonStartMs) / 1000) : null,
  };
}

// 판 끝 → 서버가 결과 문서를 만든다. 같은 판을 다시 보내도 결과는 하나 (실패하면 다시 부르면 된다)
// 저장 중에 또 부르면(예: 클리어 저장 중 시간 종료) 처음 요청을 기다린다 → 클리어가 실패로 바뀌지 않는다
let finishing = null;

export function finishRun(outcome, stats) {
  if (!hasOpenRun()) return Promise.resolve();
  if (!finishing) {
    finishing = callServer('finishRun', { ...ids(), runId, outcome, stats })
      .then(() => { runId = null; })
      .finally(() => { finishing = null; });
  }
  return finishing;
}
