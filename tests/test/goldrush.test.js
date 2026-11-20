// 골드 러시: 현황 계산(js/goldrushBoard.js)과 문제 받기 규칙
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardOf } from '../../js/goldrushBoard.js';
import { issueBlocker } from '../../js/grading.js';
import { newRun, issue } from '../../js/runLog.js';

test('현황: 골드 많은 순, 같은 골드는 같은 순위, 내 순위·참가자 수·총 골드', () => {
  const b = boardOf([
    { uid: 'a', nickname: '하늘', coins: 30 }, { uid: 'b', nickname: '바다', coins: 50 },
    { uid: 'c', nickname: '별', coins: 30 }, { uid: 'd', nickname: '구름' },
  ], 'c');
  assert.equal(b.participants, 4);
  assert.equal(b.totalGold, 110);
  assert.deepEqual(b.top.map((p) => [p.nickname, p.rank]), [['바다', 1], ['별', 2], ['하늘', 2], ['구름', 4]]);
  assert.equal(b.rank, 2);
  assert.equal(b.me, 'c');
});

test('현황: 참가자가 없으면 0명·순위 없음 (가짜 참가자를 만들지 않는다)', () => {
  const b = boardOf([], 'x');
  assert.deepEqual([b.participants, b.totalGold, b.top.length, b.rank], [0, 0, 0, null]);
});

test('골드 러시 문제(rush)는 개수 제한 없이 받는다', () => {
  assert.equal(issueBlocker({ status: 'playing', entryIssued: 0 }, 'rush'), null);
  const run = newRun({ runId: 'U_g', studentUid: 'U', dungeon: 0, nowMs: 0 });
  const qs = [{ id: 'a', subject: '수학', learningConcept: 'x', question: '1', choices: ['1', '2', '3', '4'] }, { id: 'b', subject: '수학', learningConcept: 'y', question: '2', choices: ['1', '2', '3', '4'] }];
  for (let i = 0; i < 10; i += 1) {
    const it = issue(run, qs, 'rush', i * 20000); // 앞 문제는 시간 초과로 넘어간다
    assert.ok(it.question);
  }
  assert.equal(run.attempts.length, 10);
  assert.equal(run.entryIssued, 0, '입장 문제 수에는 세지 않는다');
});
