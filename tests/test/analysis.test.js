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

// ── 맞춤 피드백·학급 분석 ──
import {
  levelOf, levelDistribution, activityTrend, recommendQuestions, studentFeedback, participation, supplementSummary, rateText,
} from '../../js/teacher/analysis.js';

const acts2 = [
  { id: 'A1', title: '1차', status: 'ended', startAt: ts(10), questions: activities[0].questions },
  { id: 'A2', title: '2차', status: 'ended', startAt: ts(20), questions: activities[1].questions },
  { id: 'A3', title: '대기', status: 'waiting', questions: [] },
];
const bank = [
  { id: 'q2', subject: '과학', learningConcept: '광합성', question: '광합성 장소' },
  { id: 'q9', subject: '과학', learningConcept: '광합성', question: '새 광합성 문제' },
  { id: 'q8', subject: '과학', learningConcept: '광합성', question: '맞힌 적 있는 문제' },
  { id: 'q1', subject: '수학', learningConcept: '곱셈', question: '2×3' },
];

test('데이터 부족: 기준보다 적으면 값을 만들지 않는다', () => {
  assert.equal(levelOf(4, 4), null, '5문제 미만은 수준 없음');
  assert.equal(levelOf(4, 5), '상');
  assert.equal(levelOf(3, 5), '중');
  assert.equal(levelOf(2, 5), '하');
  assert.equal(rateText(1, 2), '데이터 부족 (2번)');
  assert.equal(rateText(2, 3), '67%');
  const fb = studentFeedback(results, 'S2', qi, bank, acts2); // S2: 3문제
  assert.equal(fb.enough, false);
  assert.equal(fb.recommend.length, 0);
  assert.match(fb.lines[0].text, /데이터가 부족해요/);
  assert.deepEqual(supplementSummary(results.slice(0, 2), qi).enough, false, '6문제는 학급 요약 부족');
});

test('학생 피드백: 수준·취약 개념·추천 문제(틀린 문제 먼저)', () => {
  const extra = [...results, { studentUid: 'S2', nickname: '바다', activityId: 'A1', dungeon: 0, outcome: 'failed', quizCorrect: 0, quizTotal: 3, coinsEarned: 0, createdAt: ts(5),
    answers: [ans('q2', '광합성', false), ans('q2', '광합성', false, null), ans('q1', '곱셈', false, null)] }];
  const fb = studentFeedback(extra, 'S2', qi, bank, acts2); // S2: 6문제, 맞힌 1
  assert.equal(fb.enough, true);
  assert.equal(fb.level, '하');
  assert.deepEqual(fb.weak.map((c) => c.learningConcept), ['광합성'], '수학·곱셈은 2번뿐이라 판단 안 함');
  assert.equal(fb.recommend[0].id, 'q2', '틀린 문제가 먼저');
  assert.ok(fb.lines.some((l) => l.kind === 'time'), '시간 초과 2/6 → 30% 이상 안내');
  assert.ok(fb.lines.some((l) => l.kind === 'lack' && /활동별 변화/.test(l.text)), 'A2는 1문제라 변화 부족');
});

test('활동별 변화: 활동마다 3문제 이상일 때만, 10%p 기준', () => {
  const rs = [
    { studentUid: 'S1', activityId: 'A1', quizCorrect: 1, quizTotal: 4, answers: [] },
    { studentUid: 'S1', activityId: 'A2', quizCorrect: 3, quizTotal: 4, answers: [] },
  ];
  const t = activityTrend(rs, 'S1', acts2);
  assert.deepEqual(t.rows.map((r) => r.title), ['1차', '2차']);
  assert.equal(t.change, '올랐어요');
  assert.equal(activityTrend([{ ...rs[0] }, { ...rs[1], quizTotal: 2, quizCorrect: 2 }], 'S1', acts2).change, null);
});

test('추천 문제: 취약 개념만, 틀린 → 안 푼 → 맞힌 순', () => {
  const answered = new Map([['q2', 'wrong'], ['q8', 'right']]);
  const r = recommendQuestions([{ subject: '과학', learningConcept: '광합성' }], bank, answered);
  assert.deepEqual(r.map((q) => q.id), ['q2', 'q9', 'q8']);
  assert.deepEqual(recommendQuestions([], bank), []);
});

test('참여율·완료율, 수준 분포, 학급 보충 요약', () => {
  const p = participation(results, 4, acts2);
  assert.deepEqual(p.map((x) => [x.title, x.joined, x.done, x.joinRate, x.doneRate]), [['1차', 2, 1, 0.5, 0.5], ['2차', 1, 0, 0.25, 0]]);
  assert.equal(participation(results, 0, acts2)[0].joinRate, null);
  assert.deepEqual(levelDistribution(studentSummary(results)), { 상: 1, 중: 0, 하: 0, 부족: 1 });
  const big = [...results, ...results];
  const s = supplementSummary(big, qi);
  assert.equal(s.enough, true);
  assert.ok(s.lines[0].startsWith('보충할 개념: 과학 · 광합성'));
});
