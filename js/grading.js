// 채점·출제 규칙 (순수 함수). Firestore·Phaser와 상관없이 node --test로 시험한다. 학생 기기(브라우저)에서 실행된다.
// 수치는 spec.md와 js/config.js(RULES), firestore.rules의 결과 검사와 같아야 한다.
export const RULES = {
  ENTRY_QUIZ_COUNT: 3,
  QUIZ_TIME_SEC: 15,
  ANSWER_GRACE_SEC: 3, // 네트워크 지연 여유. 문제를 낸 뒤 15+3초가 지나면 시간 초과(오답)
  COIN_PER_CORRECT: 10,
  DUNGEON_COUNT: 3,
  REVIEW_RATE: 0.5, // 틀린 문제 다시 내기: 그 학생이 이 활동에서 틀리고 아직 다시 맞히지 못한 문제를 절반 확률로 먼저
};

export const ABILITY_PRICE = { dash: 10, shield: 15, doubleJump: 20 };

// 화면에 보여 주는 문제: 이 키만 쓴다 (정답 answer는 넣지 않는다)
export const PUBLIC_QUESTION_KEYS = ['id', 'subject', 'question', 'choices'];

export function publicQuestion(q) {
  return Object.fromEntries(PUBLIC_QUESTION_KEYS.map((k) => [k, q[k]]));
}

// 진행 중 = status 'running'이고 종료 시각 전. 종료 시각이 지나면 status와 상관없이 끝난 활동으로 본다.
export function isActivityRunning(activity, nowMs) {
  return activity?.status === 'running' && !!activity.endAt && activity.endAt.toMillis() > nowMs;
}

// 바로 앞 문제와 다른 문제를 무작위로 고른다 (문제가 하나뿐이면 그 문제).
// wrongIds: 그 학생이 틀리고 아직 다시 맞히지 못한 문제 — 절반 확률로 이 중에서 먼저 고른다 (복습)
export function pickQuestion(questions, lastId, rand = Math.random, wrongIds = []) {
  const review = questions.filter((q) => wrongIds.includes(q.id) && q.id !== lastId);
  if (review.length && rand() < RULES.REVIEW_RATE) return review[Math.floor(rand() * review.length)];
  const pool = questions.length > 1 ? questions.filter((q) => q.id !== lastId) : questions;
  return pool[Math.floor(rand() * pool.length)];
}

// 틀린 문제 목록 갱신: 틀리면 넣고, 맞히면 뺀다
export function updateWrong(wrongIds, questionId, correct) {
  const rest = wrongIds.filter((id) => id !== questionId);
  return correct ? rest : [...rest, questionId];
}

export function isLate(issuedAtMs, nowMs) {
  return nowMs - issuedAtMs > (RULES.QUIZ_TIME_SEC + RULES.ANSWER_GRACE_SEC) * 1000;
}

export function isValidChoice(chosen) {
  return chosen === null || (Number.isInteger(chosen) && chosen >= 0 && chosen <= 3);
}

// 채점: 늦게 낸 답은 고른 답과 상관없이 시간 초과(chosen null, 오답)
export function grade(chosen, correctIndex, late) {
  const finalChosen = late ? null : chosen;
  return { chosen: finalChosen, correct: finalChosen !== null && finalChosen === correctIndex };
}

// 새 문제를 낼 수 있는지. 안 되면 이유 코드를 돌려준다.
// (답하지 않은 직전 문제가 아직 시간 안이면 새 문제 대신 그 문제를 다시 보낸다 — runLog.js)
// run: { status, entryIssued }
export function issueBlocker(run, quizType) {
  if (run.status !== 'playing') return 'run-finished';
  if (quizType !== 'entry' && quizType !== 'revive') return 'bad-quiz-type';
  if (quizType === 'entry' && run.entryIssued >= RULES.ENTRY_QUIZ_COUNT) return 'entry-done';
  if (quizType === 'revive' && run.entryIssued < RULES.ENTRY_QUIZ_COUNT) return 'entry-not-done';
  return null;
}

export function abilityCost(ab) {
  return ab.dash * ABILITY_PRICE.dash + (ab.shield ? ABILITY_PRICE.shield : 0)
    + (ab.doubleJump ? ABILITY_PRICE.doubleJump : 0);
}

const isCount = (n) => Number.isInteger(n) && n >= 0;

// 플레이 기록 검사. 코인은 획득 코인을 넘게 쓸 수 없다.
// 맞으면 null, 틀리면 이유 문자열
export function statsError(outcome, s, coinsEarned) {
  if (outcome !== 'cleared' && outcome !== 'failed') return 'outcome';
  if (!s || typeof s !== 'object') return 'stats';
  const ab = s.abilities;
  if (!ab || !isCount(ab.dash) || typeof ab.shield !== 'boolean' || typeof ab.doubleJump !== 'boolean') return 'abilities';
  if (!isCount(s.coinsSpent) || s.coinsSpent !== abilityCost(ab)) return 'coinsSpent';
  if (s.coinsSpent > coinsEarned) return 'coinsSpent>coinsEarned';
  if (!isCount(s.dashesUsed) || s.dashesUsed > ab.dash) return 'dashesUsed';
  if (!isCount(s.hits) || !isCount(s.falls)) return 'hits/falls';
  if (outcome === 'cleared' && !(typeof s.clearSec === 'number' && s.clearSec >= 0)) return 'clearSec';
  if (outcome === 'failed' && s.clearSec !== null) return 'clearSec';
  return null;
}

// 한 판의 결과 문서 (spec.md results). 퀴즈 기록·코인은 그 판의 문제 풀이 기록(attempts·run)에서 만든다.
// outcome 'abandoned'는 플레이 기록을 남기지 못한 판이라 플레이 기록이 null이다.
export function buildResult({ run, attempts, student, activityId, outcome, stats }) {
  const answers = attempts.map((a) => ({
    questionId: a.questionId,
    learningConcept: a.learningConcept,
    chosen: a.chosen,
    correct: a.correct,
    quizType: a.quizType,
  }));
  const wrongConcepts = [...new Set(answers.filter((a) => !a.correct).map((a) => a.learningConcept))];
  const s = outcome === 'abandoned'
    ? { abilities: null, coinsSpent: null, dashesUsed: null, hits: null, falls: null, clearSec: null }
    : stats;
  return {
    studentUid: run.studentUid,
    nickname: student.nickname,
    activityId,
    dungeon: run.dungeon,
    outcome,
    cleared: outcome === 'cleared',
    quizCorrect: answers.filter((a) => a.correct).length,
    quizTotal: answers.length,
    answers,
    wrongConcepts,
    coinsEarned: run.coinsEarned,
    coinsSpent: s.coinsSpent,
    abilities: s.abilities,
    dashesUsed: s.dashesUsed,
    hits: s.hits,
    falls: s.falls,
    clearSec: s.clearSec,
  };
}
