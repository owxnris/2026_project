// 던전 한 판의 진행 기록 (순수 함수, 브라우저 메모리). Cloud Functions 없이 학생 기기에서 출제·채점·코인 계산을 한다.
// Firestore와 상관없이 node --test로 시험한다. 저장은 quiz.js가 맡는다.
import {
  RULES, pickQuestion, isLate, isValidChoice, grade, issueBlocker, updateWrong, publicQuestion,
} from './grading.js';

export class RunError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

// 새 판. wrong: 이 활동에서 그 학생이 틀리고 아직 다시 맞히지 못한 문제 id (복습 출제용)
export function newRun({ runId, studentUid, dungeon, wrong = [], nowMs }) {
  return {
    runId, studentUid, dungeon, status: 'playing', entryIssued: 0, coinsEarned: 0, lastQuestionId: null,
    attempts: [], wrong: [...wrong], startedAtMs: nowMs,
  };
}

const openOf = (run) => run.attempts.find((a) => !a.answered) || null;

// 문제 하나 받기. 답하지 않은 직전 문제가 아직 시간 안이면 같은 문제를 다시 준다 (다시 시도해도 문제를 바꿀 수 없다)
// 돌려줌: { attemptId(번호), quizType, question(정답 없음), timeLimitSec }
export function issue(run, questions, quizType, nowMs, rand = Math.random) {
  if (run.status !== 'playing') throw new RunError('run-finished');
  const open = openOf(run);
  if (open && !isLate(open.issuedAtMs, nowMs)) {
    const q = questions.find((x) => x.id === open.questionId);
    const left = Math.max(0, RULES.QUIZ_TIME_SEC - (nowMs - open.issuedAtMs) / 1000);
    return { attemptId: open.id, quizType: open.quizType, question: publicQuestion(q), timeLimitSec: left };
  }
  const blocker = issueBlocker(run, quizType);
  if (blocker) throw new RunError(blocker);
  if (open) Object.assign(open, { answered: true, chosen: null, correct: false }); // 시간이 지난 직전 문제는 시간 초과
  const q = pickQuestion(questions, run.lastQuestionId, rand, run.wrong);
  const attempt = {
    id: run.attempts.length, questionId: q.id, learningConcept: q.learningConcept, quizType,
    issuedAtMs: nowMs, answered: false, chosen: null, correct: null,
  };
  run.attempts.push(attempt);
  run.lastQuestionId = q.id;
  if (quizType === 'entry') run.entryIssued += 1;
  return { attemptId: attempt.id, quizType, question: publicQuestion(q), timeLimitSec: RULES.QUIZ_TIME_SEC };
}

// 답 내기: 채점하고 코인을 올린다. 같은 문제를 다시 내면 처음 결과만 돌려준다 (코인 중복 없음)
export function answer(run, attemptId, chosen, correctIndex, nowMs) {
  const a = run.attempts[attemptId];
  if (!a) throw new RunError('no-attempt');
  if (!isValidChoice(chosen ?? null)) throw new RunError('bad-choice');
  if (a.answered) {
    return { correct: a.correct, chosen: a.chosen, correctIndex, coinsEarned: run.coinsEarned, duplicate: true };
  }
  const g = grade(chosen ?? null, correctIndex, isLate(a.issuedAtMs, nowMs));
  Object.assign(a, { answered: true, chosen: g.chosen, correct: g.correct });
  if (g.correct) run.coinsEarned += RULES.COIN_PER_CORRECT;
  run.wrong = updateWrong(run.wrong, a.questionId, g.correct);
  return { correct: g.correct, chosen: g.chosen, correctIndex, coinsEarned: run.coinsEarned, duplicate: false };
}

// 판 끝내기 직전: 답하지 않은 문제는 시간 초과로 남긴다
export function closeOpen(run) {
  run.attempts.filter((a) => !a.answered).forEach((a) => Object.assign(a, { answered: true, chosen: null, correct: false }));
}
