import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  publicQuestion, isActivityRunning, pickQuestion, isLate, isValidChoice, grade, issueBlocker,
  abilityCost, statsError, buildResult,
} from '../grading.js';

const ts = (ms) => ({ toMillis: () => ms });

test('publicQuestion은 정답을 빼고 정해진 키만 보낸다', () => {
  const q = { id: 'd01', subject: '수학', difficulty: '하', learningConcept: '곱셈', question: '12×8', choices: ['1', '2', '3', '4'], answer: 2 };
  const p = publicQuestion(q);
  assert.deepEqual(Object.keys(p).sort(), ['choices', 'id', 'question', 'subject']);
  assert.ok(!('answer' in p));
});

test('isActivityRunning: running이고 종료 시각 전일 때만', () => {
  assert.equal(isActivityRunning({ status: 'running', endAt: ts(2000) }, 1000), true);
  assert.equal(isActivityRunning({ status: 'running', endAt: ts(1000) }, 1000), false);
  assert.equal(isActivityRunning({ status: 'waiting', endAt: null }, 0), false);
  assert.equal(isActivityRunning({ status: 'ended', endAt: ts(9999) }, 0), false);
});

test('pickQuestion: 바로 앞 문제는 다시 고르지 않는다 (문제가 하나면 그 문제)', () => {
  const qs = [{ id: 'a' }, { id: 'b' }];
  for (let i = 0; i < 20; i++) assert.equal(pickQuestion(qs, 'a').id, 'b');
  assert.equal(pickQuestion([{ id: 'a' }], 'a').id, 'a');
});

test('isLate: 15초 + 여유 3초', () => {
  assert.equal(isLate(0, 18000), false);
  assert.equal(isLate(0, 18001), true);
});

test('isValidChoice / grade', () => {
  [null, 0, 3].forEach((c) => assert.equal(isValidChoice(c), true));
  [4, -1, 1.5, '1', undefined].forEach((c) => assert.equal(isValidChoice(c), false));
  assert.deepEqual(grade(2, 2, false), { chosen: 2, correct: true });
  assert.deepEqual(grade(1, 2, false), { chosen: 1, correct: false });
  assert.deepEqual(grade(null, 2, false), { chosen: null, correct: false });
  assert.deepEqual(grade(2, 2, true), { chosen: null, correct: false }, '늦게 낸 정답은 시간 초과');
});

test('issueBlocker: 입장 3문제까지, 회복은 입장 뒤에만', () => {
  assert.equal(issueBlocker({ status: 'playing', entryIssued: 0 }, 'entry'), null);
  assert.equal(issueBlocker({ status: 'playing', entryIssued: 3 }, 'entry'), 'entry-done');
  assert.equal(issueBlocker({ status: 'playing', entryIssued: 2 }, 'revive'), 'entry-not-done');
  assert.equal(issueBlocker({ status: 'playing', entryIssued: 3 }, 'revive'), null);
  assert.equal(issueBlocker({ status: 'finished', entryIssued: 0 }, 'entry'), 'run-finished');
  assert.equal(issueBlocker({ status: 'playing', entryIssued: 0 }, 'bonus'), 'bad-quiz-type');
});

const okStats = (o = {}) => ({
  abilities: { dash: 1, shield: true, doubleJump: false }, coinsSpent: 25, dashesUsed: 1, hits: 2, falls: 0, clearSec: 40, ...o,
});

test('abilityCost / statsError: 능력 가격 합 = 쓴 코인 ≤ 얻은 코인', () => {
  assert.equal(abilityCost({ dash: 2, shield: true, doubleJump: true }), 55);
  assert.equal(statsError('cleared', okStats(), 30), null);
  assert.equal(statsError('cleared', okStats(), 20), 'coinsSpent>coinsEarned');
  assert.equal(statsError('cleared', okStats({ coinsSpent: 10 }), 30), 'coinsSpent');
  assert.equal(statsError('cleared', okStats({ dashesUsed: 2 }), 30), 'dashesUsed');
  assert.equal(statsError('cleared', okStats({ hits: -1 }), 30), 'hits/falls');
  assert.equal(statsError('cleared', okStats({ clearSec: null }), 30), 'clearSec');
  assert.equal(statsError('failed', okStats({ clearSec: null }), 30), null);
  assert.equal(statsError('failed', okStats(), 30), 'clearSec');
  assert.equal(statsError('abandoned', okStats(), 30), 'outcome', '게임은 abandoned를 보낼 수 없다');
});

test('buildResult: 퀴즈 기록은 서버 attempts에서, wrongConcepts는 중복 없이', () => {
  const run = { studentUid: 'S1', dungeon: 1, coinsEarned: 20 };
  const attempts = [
    { questionId: 'q1', learningConcept: '곱셈', chosen: 1, correct: true, quizType: 'entry' },
    { questionId: 'q2', learningConcept: '광합성', chosen: null, correct: false, quizType: 'entry' },
    { questionId: 'q3', learningConcept: '광합성', chosen: 0, correct: false, quizType: 'revive' },
  ];
  const r = buildResult({ run, attempts, student: { nickname: '하늘' }, activityId: 'A1', outcome: 'cleared', stats: okStats() });
  assert.equal(r.quizCorrect, 1);
  assert.equal(r.quizTotal, 3);
  assert.deepEqual(r.wrongConcepts, ['광합성']);
  assert.equal(r.cleared, true);
  assert.equal(r.outcome, 'cleared');
  assert.equal(r.coinsEarned, 20);
  const ab = buildResult({ run, attempts, student: { nickname: '하늘' }, activityId: 'A1', outcome: 'abandoned' });
  assert.equal(ab.cleared, false);
  assert.equal(ab.hits, null);
  assert.equal(ab.quizTotal, 3, '중도 종료도 문제 풀이 기록은 남긴다');
});

import { updateWrong } from '../grading.js';
test('복습: 틀린 문제를 절반 확률로 먼저, 맞히면 목록에서 빠진다', () => {
  const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(pickQuestion(qs, null, () => 0.1, ['c']).id, 'c', 'rand < 0.5 → 틀린 문제');
  assert.notEqual(pickQuestion(qs, 'c', () => 0.1, ['c']).id, 'c', '바로 앞 문제는 다시 안 냄');
  assert.equal(pickQuestion(qs, null, () => 0.9, ['c']).id, 'c', 'rand ≥ 0.5 → 전체에서 (0.9 → 마지막)');
  assert.deepEqual(updateWrong(['a'], 'b', false), ['a', 'b']);
  assert.deepEqual(updateWrong(['a', 'b'], 'a', true), ['b']);
  assert.deepEqual(updateWrong(['a'], 'a', false), ['a']);
});
