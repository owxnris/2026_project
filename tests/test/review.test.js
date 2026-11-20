// 학생 맞춤 복습(js/review.js) 시험
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewSummary } from '../../js/review.js';

const A = (id, concept, correct, chosen = correct ? 1 : 0) => ({
  id, subject: '수학', concept, question: `${id}?`, choices: ['가', '나', '다', '라'], chosen, correctIndex: 1, correct,
});

test('3문제 미만이면 수준을 말하지 않는다 (지어내지 않기)', () => {
  const r = reviewSummary([A('q1', '곱셈', false)]);
  assert.ok(r.message.startsWith('문제를 3개 이상 풀면'));
  assert.equal(r.weakConcepts.length, 1, '틀린 개념은 그래도 보여 준다');
});

test('정답률에 따라 한마디, 다시 볼 개념은 틀린 횟수 순, 틀린 문제는 한 번씩·최근 순', () => {
  const log = [A('q1', '곱셈', false), A('q2', '나눗셈', true), A('q1', '곱셈', false, null), A('q3', '분수', false), A('q4', '나눗셈', true)];
  const r = reviewSummary(log);
  assert.equal(r.total, 5);
  assert.equal(r.correct, 2);
  assert.ok(r.message.includes('40%') && r.tone === 'bad');
  assert.deepEqual(r.weakConcepts.map((c) => [c.concept, c.wrong]), [['곱셈', 2], ['분수', 1]]);
  assert.deepEqual(r.wrongQuestions.map((w) => [w.question, w.answer, w.chosen]), [['q3?', '나', '가'], ['q1?', '나', '시간 초과']]);
});

test('잘하면 칭찬, 틀린 것이 없으면 다시 볼 개념도 없다', () => {
  const r = reviewSummary([A('a', 'x', true), A('b', 'y', true), A('c', 'z', true)]);
  assert.equal(r.tone, 'good');
  assert.equal(r.weakConcepts.length, 0);
  assert.equal(r.wrongQuestions.length, 0);
});
