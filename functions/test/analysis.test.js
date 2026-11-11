// 교사 화면 결과 분석(js/teacher/analysis.js) 시험 — 손으로 센 값과 비교한다 (순수 함수라 여기서 함께 돌린다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  questionIndex, studentSummary, ranking, questionStats, conceptStats, classSummary, studentDetail, filterResults,
} from '../../js/teacher/analysis.js';

const activities = [
  { id: 'A1', questions: [
    { id: 'q1', subject: '수학', learningConcept: '곱셈', question: '2×3', choices: ['5', '6', '7', '8'] },
    { id: 'q2', subject: '과학', learningConcept: '광합성', question: '광합성 장소', choices: ['뿌리', '잎', '줄기', '꽃'] },
  ] },
  { id: 'A2', questions: [{ id: 'q3', subject: '국어', learningConcept: '곱셈', question: '같은 개념 이름 다른 과목', choices: ['a', 'b', 'c', 'd'] }] },
];
const ans = (questionId, learningConcept, correct, chosen = correct ? 1 : 0) => ({ questionId, learningConcept, correct, chosen, quizType: 'entry' });
const ts = (ms) => ({ toMillis: () => ms });
const results = [
  { studentUid: 'S1', nickname: '하늘', activityId: 'A1', dungeon: 0, outcome: 'cleared', quizCorrect: 2, quizTotal: 3, coinsEarned: 20, createdAt: ts(2),
    answers: [ans('q1', '곱셈', true), ans('q2', '광합성', true), ans('q2', '광합성', false, null)] },
  { studentUid: 'S1', nickname: '하늘', activityId: 'A1', dungeon: 0, outcome: 'cleared', quizCorrect: 3, quizTotal: 3, coinsEarned: 30, createdAt: ts(1),
    answers: [ans('q1', '곱셈', true), ans('q1', '곱셈', true), ans('q2', '광합성', true)] },
  { studentUid: 'S2', nickname: '바다', activityId: 'A1', dungeon: 0, outcome: 'failed', quizCorrect: 0, quizTotal: 2, coinsEarned: 0, createdAt: ts(3),
    answers: [ans('q2', '광합성', false), ans('q1', '곱셈', false)] },
  { studentUid: 'S2', nickname: '바다', activityId: 'A2', dungeon: 1, outcome: 'abandoned', quizCorrect: 1, quizTotal: 1, coinsEarned: 10, createdAt: ts(4),
    answers: [ans('q3', '곱셈', true)] },
];
const qi = questionIndex(activities);

test('학생별 합계: 같은 던전을 두 번 깨도 하나', () => {
  const [s2, s1] = studentSummary(results); // 닉네임 순: 바다, 하늘
  assert.equal(s1.nickname, '하늘');
  assert.deepEqual([s1.quizCorrect, s1.quizTotal, s1.clearedCount, s1.coinsEarned, s1.runs], [5, 6, 1, 50, 2]);
  assert.deepEqual([s2.quizCorrect, s2.quizTotal, s2.clearedCount, s2.runs], [1, 3, 0, 2]);
});

test('순위: 깬 던전 → 맞힌 문제, 결과 없는 학생은 0, 같으면 같은 순위', () => {
  const r = ranking(filterResults(results, 'A1'), [{ id: 'S1', nickname: '하늘' }, { id: 'S2', nickname: '바다' }, { id: 'S3', nickname: '구름' }, { id: 'S4', nickname: '가람' }], { S2: { currentDungeon: 0 } });
  assert.deepEqual(r.map((x) => [x.nickname, x.rank]), [['하늘', 1], ['가람', 2], ['구름', 2], ['바다', 2]]);
  assert.equal(r.find((x) => x.nickname === '바다').currentDungeon, 0);
});

test('문제별 정답률: 낮은 순', () => {
  const q = questionStats(results, qi);
  const byId = Object.fromEntries(q.map((x) => [x.questionId, x]));
  assert.deepEqual([byId.q1.correct, byId.q1.total], [3, 4]);
  assert.deepEqual([byId.q2.correct, byId.q2.total], [2, 4]);
  assert.equal(q[0].questionId, 'q2');
  assert.equal(byId.q3.subject, '국어');
});

test('개념별: 과목 + 개념 단위, 틀린 학생 수, 취약 기준', () => {
  const c = conceptStats(results, qi);
  const find = (s, k) => c.find((x) => x.subject === s && x.learningConcept === k);
  const photo = find('과학', '광합성');
  assert.deepEqual([photo.total, photo.wrong, photo.wrongStudents, photo.weak], [4, 2, 2, true]);
  const mul = find('수학', '곱셈');
  assert.deepEqual([mul.total, mul.wrong, mul.weak], [4, 1, false]);
  assert.equal(find('국어', '곱셈').total, 1, '과목이 다르면 다른 개념');
});

test('학급 통계', () => {
  assert.deepEqual(classSummary(results), { students: 2, runs: 4, quizTotal: 9, quizCorrect: 6, rate: 6 / 9, clearsByDungeon: [1, 0, 0] });
  assert.equal(classSummary(filterResults(results, 'A2')).runs, 1);
});

test('학생 한 명: 판은 오래된 순, 틀린 문제와 고른 답', () => {
  const d = studentDetail(results, 'S2', qi);
  assert.deepEqual(d.runs.map((r) => r.outcome), ['failed', 'abandoned']);
  assert.deepEqual(d.wrongQuestions.map((w) => [w.question, w.lastChosen]), [['광합성 장소', '뿌리'], ['2×3', '5']]);
  const d1 = studentDetail(results, 'S1', qi);
  assert.equal(d1.wrongQuestions[0].lastChosen, '시간 초과');
  assert.equal(d1.runs[0].createdAt.toMillis(), 1);
});
