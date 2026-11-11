// 학생 기기에서 도는 출제·채점·코인 계산(js/runLog.js) 시험 — Firestore 없이 순수 함수로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, issue, answer, closeOpen, RunError } from '../../js/runLog.js';
import { buildResult, statsError } from '../../js/grading.js';

const QS = [
  { id: 'a', subject: '수학', learningConcept: '곱셈', question: '1', choices: ['1', '2', '3', '4'] },
  { id: 'b', subject: '수학', learningConcept: '나눗셈', question: '2', choices: ['1', '2', '3', '4'] },
  { id: 'c', subject: '과학', learningConcept: '광합성', question: '3', choices: ['1', '2', '3', '4'] },
];
const KEY = { a: 0, b: 1, c: 2 };
const mk = (wrong = []) => newRun({ runId: 'U_r1', studentUid: 'U', dungeon: 1, wrong, nowMs: 0 });

test('출제: 문제에 정답이 없고, 입장 3문제 뒤에는 입장 퀴즈를 더 못 받는다', () => {
  const run = mk();
  let t = 0;
  for (let i = 0; i < 3; i++) {
    const it = issue(run, QS, 'entry', t);
    assert.ok(!('answer' in it.question));
    answer(run, it.attemptId, KEY[it.question.id], KEY[it.question.id], t + 1000);
    t += 2000;
  }
  assert.throws(() => issue(run, QS, 'entry', t), (e) => e instanceof RunError && e.reason === 'entry-done');
  assert.equal(issue(run, QS, 'revive', t).quizType, 'revive');
});

test('회복 퀴즈는 입장 퀴즈 3문제를 받은 뒤에만', () => {
  assert.throws(() => issue(mk(), QS, 'revive', 0), (e) => e.reason === 'entry-not-done');
});

test('다시 시도: 답하기 전에 같은 문제를 요청하면 같은 문제를 준다 (문제 바꾸기 불가)', () => {
  const run = mk();
  const first = issue(run, QS, 'entry', 0);
  const again = issue(run, QS, 'entry', 3000);
  assert.equal(again.question.id, first.question.id);
  assert.equal(again.attemptId, first.attemptId);
  assert.equal(run.entryIssued, 1, '입장 문제 수는 한 번만 센다');
  assert.ok(again.timeLimitSec < 15 && again.timeLimitSec > 10);
});

test('코인: 정답 한 번에 +10, 같은 문제를 두 번 내도 한 번만 (중복 지급 없음)', () => {
  const run = mk();
  const it = issue(run, QS, 'entry', 0);
  const right = KEY[it.question.id];
  const r1 = answer(run, it.attemptId, right, right, 1000);
  const r2 = answer(run, it.attemptId, right, right, 1500);
  assert.equal(r1.correct, true);
  assert.equal(r1.coinsEarned, 10);
  assert.equal(r2.duplicate, true);
  assert.equal(run.coinsEarned, 10);
});

test('시간 초과: 15+3초가 지난 뒤의 답은 오답, 답 없이 지난 문제는 다음 출제 때 시간 초과로 남는다', () => {
  const run = mk();
  const it = issue(run, QS, 'entry', 0);
  const right = KEY[it.question.id];
  assert.equal(answer(run, it.attemptId, right, right, 19000).correct, false);
  const run2 = mk();
  issue(run2, QS, 'entry', 0);
  issue(run2, QS, 'entry', 20000);
  assert.deepEqual([run2.attempts[0].correct, run2.attempts[0].chosen], [false, null]);
  assert.equal(run2.attempts.length, 2);
});

test('복습: 틀린 문제는 목록에 들어가고 다시 맞히면 빠진다', () => {
  const run = mk();
  const it = issue(run, QS, 'entry', 0);
  const right = KEY[it.question.id];
  answer(run, it.attemptId, (right + 1) % 4, right, 1000);
  assert.deepEqual(run.wrong, [it.question.id]);
  const first = it.question.id;
  const it2 = issue(run, QS, 'entry', 2000, () => 0.9);
  assert.notEqual(it2.question.id, first, '바로 앞 문제는 다시 안 냄');
});

test('결과: 문제 풀이 기록에서 만들고, 얻은 코인 = 맞힌 수 × 10, 안 푼 문제는 시간 초과', () => {
  const run = mk();
  let t = 0;
  for (let i = 0; i < 3; i++) {
    const it = issue(run, QS, 'entry', t);
    if (i < 2) answer(run, it.attemptId, KEY[it.question.id], KEY[it.question.id], t + 500);
    t += 1000;
  }
  closeOpen(run);
  const stats = { abilities: { dash: 1, shield: false, doubleJump: false }, coinsSpent: 10, dashesUsed: 1, hits: 0, falls: 0, clearSec: 30 };
  assert.equal(statsError('cleared', stats, run.coinsEarned), null);
  const r = buildResult({ run, attempts: run.attempts, student: { nickname: '하늘' }, activityId: 'A', outcome: 'cleared', stats });
  assert.equal(r.quizTotal, 3);
  assert.equal(r.quizCorrect, 2);
  assert.equal(r.coinsEarned, r.quizCorrect * 10, '규칙이 검사하는 관계와 같다');
  assert.equal(r.answers.length, r.quizTotal);
  assert.equal(r.answers[2].chosen, null);
});

test('쓴 코인이 번 코인보다 많으면 저장하지 않는다', () => {
  const stats = { abilities: { dash: 2, shield: false, doubleJump: false }, coinsSpent: 20, dashesUsed: 0, hits: 0, falls: 0, clearSec: 10 };
  assert.equal(statsError('cleared', stats, 10), 'coinsSpent>coinsEarned');
});
