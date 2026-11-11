// 서버 함수 흐름 시험: 가짜 Firestore 위에서 실제 handlers.js를 돌린다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore, ts } from './fakeFirestore.js';
import { createHandlers } from '../handlers.js';

const TEACHER = { uid: 'T1', provider: 'google.com' };
const OTHER_TEACHER = { uid: 'T2', provider: 'google.com' };
const STUDENT = { uid: 'S1', provider: 'anonymous' };
const OUTSIDER = { uid: 'S9', provider: 'anonymous' };
const QUESTIONS = [
  { id: 'q1', subject: '수학', difficulty: '하', learningConcept: '곱셈', question: '2×3', choices: ['5', '6', '7', '8'] },
  { id: 'q2', subject: '과학', difficulty: '중', learningConcept: '광합성', question: '광합성 장소', choices: ['뿌리', '잎', '줄기', '꽃'] },
  { id: 'q3', subject: '국어', difficulty: '상', learningConcept: '맞춤법', question: '맞춤법', choices: ['a', 'b', 'c', 'd'] },
];
const KEY = { q1: 1, q2: 1, q3: 3 };
const A = 'classes/C1/activities';

function setup() {
  const db = createFakeFirestore();
  const clock = { ms: 1_000_000 };
  const h = createHandlers({ db, ts, now: () => clock.ms });
  const put = (p, d) => db.docs.set(p, d);
  put('classes/C1', { ownerUid: 'T1', name: '1반', joinCode: '123456' });
  put('classes/C1/students/S1', { nickname: '하늘', joinCode: '123456' });
  ['A1', 'A2'].forEach((id) => {
    put(`${A}/${id}`, { title: id, totalTimeSec: 600, status: 'waiting', startAt: null, endAt: null, questions: QUESTIONS });
    put(`${A}/${id}/answerKey/main`, { answers: KEY });
  });
  return { db, clock, h };
}

const code = (c) => (e) => e.code === c;
const reason = (r) => (e) => e.details?.reason === r;
const ids = { classId: 'C1', activityId: 'A1' };

test('활동 시작: 소유 교사만, 서버 시각으로 startAt·endAt', async () => {
  const { db, clock, h } = setup();
  await assert.rejects(h.startActivity(STUDENT, ids), code('permission-denied'));
  await assert.rejects(h.startActivity(OTHER_TEACHER, ids), code('permission-denied'));
  await assert.rejects(h.startActivity(null, ids), code('unauthenticated'));
  await h.startActivity(TEACHER, ids);
  const a = db.docs.get(`${A}/A1`);
  assert.equal(a.status, 'running');
  assert.equal(a.startAt.toMillis(), clock.ms);
  assert.equal(a.endAt.toMillis(), clock.ms + 600_000);
  await assert.rejects(h.startActivity(TEACHER, ids), reason('not-waiting'));
});

test('학급당 진행 중 활동 1개: 다른 활동 시작은 막히고, 종료 뒤에는 된다', async () => {
  const { db, clock, h } = setup();
  await h.startActivity(TEACHER, ids);
  await assert.rejects(h.startActivity(TEACHER, { classId: 'C1', activityId: 'A2' }), (e) => e.details?.reason === 'already-running' && e.details.title === 'A1');
  await h.endActivity(TEACHER, ids);
  assert.equal(db.docs.get(`${A}/A1`).status, 'ended');
  clock.ms += 1000;
  await h.startActivity(TEACHER, { classId: 'C1', activityId: 'A2' });
  assert.equal(db.docs.get(`${A}/A2`).status, 'running');
});

test('동시에 두 활동을 시작해도 하나만 진행 중이 된다', async () => {
  const { db, h } = setup();
  const r = await Promise.allSettled([
    h.startActivity(TEACHER, ids),
    h.startActivity(TEACHER, { classId: 'C1', activityId: 'A2' }),
  ]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  const running = ['A1', 'A2'].filter((id) => db.docs.get(`${A}/${id}`).status === 'running');
  assert.equal(running.length, 1);
});

test('종료 시각이 지난 활동은 끝난 것으로 보고, 새 활동 시작 때 ended로 정리한다', async () => {
  const { db, clock, h } = setup();
  await h.startActivity(TEACHER, ids);
  clock.ms += 600_001;
  await h.startActivity(TEACHER, { classId: 'C1', activityId: 'A2' });
  assert.equal(db.docs.get(`${A}/A1`).status, 'ended');
});

test('학생 판 시작: 학급 학생만, 진행 중인 활동에서만', async () => {
  const { h } = setup();
  const run = { ...ids, dungeon: 0 };
  await assert.rejects(h.startRun(STUDENT, run), reason('activity-not-running'));
  await h.startActivity(TEACHER, ids);
  await assert.rejects(h.startRun(OUTSIDER, run), code('permission-denied'));
  await assert.rejects(h.startRun(STUDENT, { ...ids, dungeon: 5 }), code('invalid-argument'));
  await assert.rejects(h.startRun(STUDENT, { ...ids, dungeon: 0, classId: '../x' }), code('invalid-argument'));
  const { runId } = await h.startRun(STUDENT, run);
  assert.ok(runId);
});

async function playing() {
  const s = setup();
  await s.h.startActivity(TEACHER, ids);
  const { runId } = await s.h.startRun(STUDENT, { ...ids, dungeon: 0 });
  return { ...s, runId, r: { ...ids, runId } };
}

test('문제 받기: 정답이 없는 문제만 받는다, 다른 학생의 판은 거부', async () => {
  const { h, r } = await playing();
  const res = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  assert.deepEqual(Object.keys(res.question).sort(), ['choices', 'id', 'question', 'subject']);
  assert.ok(!JSON.stringify(res).includes('"answer"'));
  assert.equal(res.timeLimitSec, 15);
  await assert.rejects(h.issueQuestion(OUTSIDER, { ...r, quizType: 'entry' }), code('permission-denied'));
});

test('답하기 전에 다시 받으면 같은 문제(남은 시간만), 문제를 바꿔 고를 수 없다', async () => {
  const { h, clock, r } = await playing();
  const first = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  clock.ms += 5000;
  const again = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  assert.equal(again.attemptId, first.attemptId);
  assert.equal(again.question.id, first.question.id);
  assert.equal(again.timeLimitSec, 10);
});

test('채점·코인: 정답 +10, 같은 답을 여러 번 보내도 한 번만 지급', async () => {
  const { db, h, r, runId } = await playing();
  const { attemptId, question } = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  const key = KEY[question.id];
  const sends = await Promise.all([1, 2, 3].map(() => h.submitAnswer(STUDENT, { ...r, attemptId, chosen: key })));
  assert.ok(sends.every((x) => x.correct && x.correctIndex === key && x.coinsEarned === 10));
  assert.equal(sends.filter((x) => !x.duplicate).length, 1);
  const again = await h.submitAnswer(STUDENT, { ...r, attemptId, chosen: (key + 1) % 4 });
  assert.equal(again.correct, true, '처음 낸 답이 그대로 남는다');
  assert.equal(db.docs.get(`${A}/A1/runs/${runId}`).coinsEarned, 10);
});

test('오답·시간 초과: 코인 없음, 15+3초 뒤에 낸 정답은 시간 초과', async () => {
  const { h, clock, r } = await playing();
  let q = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  let res = await h.submitAnswer(STUDENT, { ...r, attemptId: q.attemptId, chosen: (KEY[q.question.id] + 1) % 4 });
  assert.equal(res.correct, false);
  assert.equal(res.coinsEarned, 0);
  q = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  clock.ms += 18_001;
  res = await h.submitAnswer(STUDENT, { ...r, attemptId: q.attemptId, chosen: KEY[q.question.id] });
  assert.equal(res.correct, false);
  assert.equal(res.chosen, null);
  await assert.rejects(h.submitAnswer(STUDENT, { ...r, attemptId: q.attemptId, chosen: 7 }), code('invalid-argument'));
  await assert.rejects(h.submitAnswer(OUTSIDER, { ...r, attemptId: q.attemptId, chosen: 1 }), code('permission-denied'));
});

test('입장 퀴즈는 3문제까지, 회복 퀴즈는 입장 뒤에만', async () => {
  const { h, r } = await playing();
  await assert.rejects(h.issueQuestion(STUDENT, { ...r, quizType: 'revive' }), reason('entry-not-done'));
  for (let i = 0; i < 3; i++) {
    const q = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
    await h.submitAnswer(STUDENT, { ...r, attemptId: q.attemptId, chosen: 0 });
  }
  await assert.rejects(h.issueQuestion(STUDENT, { ...r, quizType: 'entry' }), reason('entry-done'));
  const rv = await h.issueQuestion(STUDENT, { ...r, quizType: 'revive' });
  assert.equal(rv.quizType, 'revive');
});

test('답하지 않고 시간이 지난 문제는 다음 문제를 받을 때 시간 초과로 기록', async () => {
  const { db, h, clock, r, runId } = await playing();
  const q1 = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  clock.ms += 19_000;
  const q2 = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  assert.notEqual(q2.attemptId, q1.attemptId);
  const a1 = db.docs.get(`${A}/A1/runs/${runId}/attempts/${q1.attemptId}`);
  assert.equal(a1.correct, false);
  assert.equal(a1.chosen, null);
});

const stats = (o = {}) => ({ abilities: { dash: 1, shield: false, doubleJump: false }, coinsSpent: 10, dashesUsed: 1, hits: 1, falls: 2, clearSec: 33, ...o });

async function answerAll(h, r, n, right) {
  for (let i = 0; i < n; i++) {
    const q = await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
    await h.submitAnswer(STUDENT, { ...r, attemptId: q.attemptId, chosen: right ? KEY[q.question.id] : (KEY[q.question.id] + 1) % 4 });
  }
}

test('판 끝: 결과는 서버 기록으로 results/{runId}에 한 번만', async () => {
  const { db, h, r, runId } = await playing();
  await answerAll(h, r, 3, true);
  const res = await Promise.all([1, 2].map(() => h.finishRun(STUDENT, { ...r, outcome: 'cleared', stats: stats() })));
  assert.equal(res.filter((x) => !x.already).length, 1);
  const doc = db.docs.get(`classes/C1/results/${runId}`);
  assert.equal(doc.outcome, 'cleared');
  assert.equal(doc.cleared, true);
  assert.equal(doc.quizCorrect, 3);
  assert.equal(doc.quizTotal, 3);
  assert.equal(doc.coinsEarned, 30);
  assert.equal(doc.nickname, '하늘');
  assert.equal(doc.studentUid, 'S1');
  assert.equal(doc.activityId, 'A1');
  assert.equal(doc.clearSec, 33);
  assert.deepEqual(doc.wrongConcepts, []);
  assert.equal([...db.docs.keys()].filter((p) => p.startsWith('classes/C1/results/')).length, 1);
  assert.deepEqual(Object.keys(doc).sort(), [
    'abilities', 'activityId', 'answers', 'clearSec', 'cleared', 'coinsEarned', 'coinsSpent', 'createdAt', 'dashesUsed',
    'dungeon', 'falls', 'hits', 'nickname', 'outcome', 'quizCorrect', 'quizTotal', 'studentUid', 'wrongConcepts',
  ]);
  await assert.rejects(h.issueQuestion(STUDENT, { ...r, quizType: 'revive' }), reason('run-finished'));
});

test('판 끝: 얻은 코인보다 많이 쓴 기록, 남의 판은 거부', async () => {
  const { h, r } = await playing();
  await answerAll(h, r, 3, false);
  await assert.rejects(h.finishRun(STUDENT, { ...r, outcome: 'cleared', stats: stats() }), code('invalid-argument'));
  await assert.rejects(h.finishRun(OUTSIDER, { ...r, outcome: 'cleared', stats: stats() }), code('permission-denied'));
  await assert.rejects(h.finishRun(STUDENT, { ...r, outcome: 'abandoned', stats: stats() }), code('invalid-argument'));
});

test('실패(시간 종료): 답하지 않은 문제는 시간 초과로, 결과 outcome failed', async () => {
  const { db, h, r, runId } = await playing();
  await answerAll(h, r, 1, false);
  await h.issueQuestion(STUDENT, { ...r, quizType: 'entry' });
  const none = { abilities: { dash: 0, shield: false, doubleJump: false }, coinsSpent: 0, dashesUsed: 0, hits: 0, falls: 0, clearSec: null };
  await h.finishRun(STUDENT, { ...r, outcome: 'failed', stats: none });
  const doc = db.docs.get(`classes/C1/results/${runId}`);
  assert.equal(doc.outcome, 'failed');
  assert.equal(doc.cleared, false);
  assert.equal(doc.quizTotal, 2);
  assert.deepEqual(doc.answers.map((a) => a.chosen === null), [false, true]);
  assert.deepEqual(doc.wrongConcepts.length > 0, true);
});

test('중도 종료: 새 판을 시작하면 이전 판이 abandoned로 남는다 (문제 풀이 기록 보존)', async () => {
  const { db, h, r, runId } = await playing();
  await answerAll(h, r, 2, true);
  const next = await h.startRun(STUDENT, { ...ids, dungeon: 1 });
  assert.notEqual(next.runId, runId);
  const doc = db.docs.get(`classes/C1/results/${runId}`);
  assert.equal(doc.outcome, 'abandoned');
  assert.equal(doc.quizTotal, 2);
  assert.equal(doc.coinsEarned, 20);
  assert.equal(doc.hits, null);
  await assert.rejects(h.submitAnswer(STUDENT, { ...r, attemptId: 'nope', chosen: 1 }), code('not-found'));
});

test('교사가 활동을 끝내면 진행 중인 판이 abandoned로 닫히고, 새 판·새 문제는 막힌다', async () => {
  const { db, h, r, runId } = await playing();
  await answerAll(h, r, 1, true);
  const { closedRuns } = await h.endActivity(TEACHER, ids);
  assert.equal(closedRuns, 1);
  assert.equal(db.docs.get(`classes/C1/results/${runId}`).outcome, 'abandoned');
  await assert.rejects(h.startRun(STUDENT, { ...ids, dungeon: 0 }), reason('activity-not-running'));
  const again = await h.finishRun(STUDENT, { ...r, outcome: 'failed', stats: stats({ clearSec: null }) });
  assert.equal(again.already, true, '이미 닫힌 판은 다시 저장하지 않는다');
});

test('활동 시간이 끝난 뒤에는 새 문제를 낼 수 없다', async () => {
  const { h, clock, r } = await playing();
  clock.ms += 600_001;
  await assert.rejects(h.issueQuestion(STUDENT, { ...r, quizType: 'entry' }), reason('activity-not-running'));
});

test('10-4 학생 3명 동시 진행: 판·코인·결과가 섞이지 않는다', async () => {
  const { db, h } = setup();
  ['S2', 'S3'].forEach((u, i) => db.docs.set(`classes/C1/students/${u}`, { nickname: `학생${i + 2}`, joinCode: '123456' }));
  await h.startActivity(TEACHER, ids);
  const play = async (uid, right) => {
    const who = { uid, provider: 'anonymous' };
    const { runId } = await h.startRun(who, { ...ids, dungeon: 0 });
    const r = { ...ids, runId };
    for (let i = 0; i < 3; i++) {
      const q = await h.issueQuestion(who, { ...r, quizType: 'entry' });
      await h.submitAnswer(who, { ...r, attemptId: q.attemptId, chosen: i < right ? KEY[q.question.id] : (KEY[q.question.id] + 1) % 4 });
    }
    const none = { abilities: { dash: 0, shield: false, doubleJump: false }, coinsSpent: 0, dashesUsed: 0, hits: 0, falls: 0, clearSec: 10 };
    await h.finishRun(who, { ...r, outcome: 'cleared', stats: none });
    return runId;
  };
  const runs = await Promise.all([play('S1', 3), play('S2', 1), play('S3', 0)]);
  const res = runs.map((id) => db.docs.get(`classes/C1/results/${id}`));
  assert.deepEqual(res.map((x) => [x.studentUid, x.quizCorrect, x.coinsEarned, x.quizTotal]), [['S1', 3, 30, 3], ['S2', 1, 10, 3], ['S3', 0, 0, 3]]);
  assert.equal(new Set(runs).size, 3);
});
