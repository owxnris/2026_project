// 퀴즈 문제 공급·채점·결과 저장.
// - 온라인(Firebase 설정값 있음): Cloud Functions 없이 학생 기기에서 출제·채점하고, 판이 끝나면 결과 문서를 Firestore에 한 번 만든다.
//   정답표(answerKey)는 같은 학급 학생이 읽을 수 있다 → 기기를 조작하면 점수·코인을 속일 수 있는 한계가 있다 (spec.md 보안 한계).
//   Firestore 규칙은 결과 문서의 형식·범위(얻은 코인 = 맞힌 수 × 10, 쓴 코인 ≤ 얻은 코인 등)와 '내 결과만, 한 번만'을 지킨다.
// - 예비 흐름(설정값 없음): questions.json으로 기기에서 채점한다
import { RULES, ABILITIES } from './config.js';
import { session } from './session.js';
import { state, resetPlay } from './state.js';
import { nextQuestion as nextLocal } from './questions.js';
import { statsError, buildResult } from './grading.js';
import { newRun, issue, answer, closeOpen, RunError } from './runLog.js';
import { loadActivityData, loadWrong, saveWrong, saveResult } from './firebase/runStore.js';
import { serverNow } from './firebase/clock.js';
import { auth } from './firebase/app.js';

let run = null; // 지금 판 (끝나면 null)
let data = null; // { classId, activityId, questions, answers } — 활동이 바뀌면 다시 읽는다

async function activityData() {
  if (!data || data.activityId !== session.activityId) {
    data = await loadActivityData(session.classId, session.activityId);
  }
  return data;
}

// 결과 문서를 만들어 저장한다. 판 번호가 문서 번호라서 같은 판은 한 번만 저장된다 (이미 있으면 저장된 것으로 본다)
async function saveOutcome(r, outcome, stats) {
  if (outcome !== 'abandoned') {
    const err = statsError(outcome, stats, r.coinsEarned);
    if (err) throw new Error(`플레이 기록이 올바르지 않아요 (${err})`);
  }
  if (r.attempts.length === 0) return { already: false, empty: true }; // 문제를 하나도 받지 않은 판은 남길 기록이 없다
  closeOpen(r);
  const result = buildResult({
    run: r, attempts: r.attempts, student: { nickname: session.nickname }, activityId: session.activityId, outcome, stats,
  });
  return saveResult(session.classId, r.runId, result);
}

// 끝나지 않은 이전 판이 있으면 중도 종료(abandoned)로 저장한다 (문제 풀이 기록은 남기고 플레이 기록은 비운다)
async function abandonOpenRun() {
  if (!run) return;
  const old = run;
  run = null;
  try { await saveOutcome(old, 'abandoned'); } catch { /* 저장하지 못해도 새 판은 시작한다 */ }
}

// 던전 한 판 시작 (입장 퀴즈 직전)
export async function beginRun(dungeon) {
  resetPlay();
  if (!session.online) return;
  await abandonOpenRun();
  const d = await activityData();
  const wrong = await loadWrong(d.classId, d.activityId);
  // 판 번호 = 내 uid + 시각 + 무작위 → 결과 문서 번호가 되고 내 것만 만들 수 있다 (firestore.rules)
  const runId = `${auth.currentUser.uid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  run = newRun({ runId, studentUid: auth.currentUser.uid, dungeon, wrong, nowMs: serverNow() });
}

// 문제 하나: { attemptId, question: { id, subject, question, choices }, timeLimitSec }
export async function nextQuestion(quizType) {
  if (!session.online) {
    const q = nextLocal();
    return { attemptId: null, question: q, timeLimitSec: RULES.QUIZ_TIME_SEC, local: q };
  }
  if (!run) throw new RunError('run-finished');
  const d = await activityData();
  return issue(run, d.questions, quizType, serverNow());
}

// 답 내기 (chosen: 0~3, 시간 초과는 null): { correct, correctIndex }
// 같은 문제의 답은 한 번만 채점하므로 다시 불러도 코인이 두 번 오르지 않는다
export async function submitAnswer(item, chosen) {
  if (!session.online) {
    return { correct: chosen === item.local.answer, correctIndex: item.local.answer };
  }
  const d = await activityData();
  const res = answer(run, item.attemptId, chosen, d.answers[item.question.id], serverNow());
  if (!res.duplicate) saveWrong(d.classId, d.activityId, run.wrong).catch(() => {}); // 복습 목록은 실패해도 게임을 막지 않는다
  return { correct: res.correct, correctIndex: res.correctIndex };
}

export function hasOpenRun() {
  return session.online && run !== null;
}

// 산 능력의 가격 합
export function abilityCost(ab) {
  return ABILITIES.reduce((sum, a) => sum + (a.repeat ? ab[a.key] : (ab[a.key] ? 1 : 0)) * a.price, 0);
}

// 지금 판의 플레이 기록 (능력 가격 합 = 쓴 코인 ≤ 얻은 코인)
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

// 판 끝 → 결과 저장. 실패하면 판은 남아 있어 다시 부르면 된다
// 저장 중에 또 부르면(예: 클리어 저장 중 시간 종료) 처음 요청을 기다린다 → 클리어가 실패로 바뀌지 않는다
let finishing = null;

export function finishRun(outcome, stats) {
  if (!hasOpenRun()) return Promise.resolve({ already: false });
  if (!finishing) {
    const r = run;
    finishing = saveOutcome(r, outcome, stats)
      .then((res) => { if (run === r) run = null; return res; })
      .finally(() => { finishing = null; });
  }
  return finishing;
}
