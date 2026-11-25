import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mineState, supportCoins, PRESENCE_MS } from '../../js/mine.js';

const now = 1_000_000;
const p = (inMine, ago = 0) => ({ inMine, updatedAt: now - ago });

test('목표는 참여 인원 × 50, 절반 이상(최소 2명)이 광산에 있어야 캔다', () => {
  const twenty = [...Array(9)].map(() => p(true)).concat([...Array(11)].map(() => p(false)));
  const s = mineState(twenty, { dug: 100 }, now);
  assert.equal(s.participants, 20);
  assert.equal(s.goal, 1000);
  assert.equal(s.need, 10);
  assert.equal(s.miners, 9);
  assert.equal(s.canDig, false);
  assert.equal(s.missing, 1);
  assert.equal(s.percent, 10);
  const ten = mineState([...twenty.slice(0, 9), p(true), ...twenty.slice(10)], { dug: 100 }, now);
  assert.equal(ten.canDig, true);
  // 혼자서는 안 된다: 참여 1명이어도 2명 필요
  assert.equal(mineState([p(true)], null, now).canDig, false);
  assert.equal(mineState([p(true), p(true)], null, now).canDig, true);
});

test('오래 신호가 없는 학생은 광산 인원에서 빠진다, 목표를 채우면 끝', () => {
  const s = mineState([p(true), p(true, PRESENCE_MS + 1), p(false)], null, now);
  assert.equal(s.miners, 1);
  const done = mineState([p(true), p(true)], { dug: 100 }, now);
  assert.equal(done.done, true);
  assert.equal(done.reachedGoal, true);
  assert.equal(done.canDig, false);
  // 완성 뒤 인원이 늘어 목표가 커져도 완성 그대로
  assert.equal(mineState([p(true), p(true), p(false), p(false)], { dug: 100, done: true }, now).done, true);
});

test('지원 코인: 완성됐고 아직 다 못 깬 학생만 20', () => {
  assert.equal(supportCoins(true, 3), 20);
  assert.equal(supportCoins(true, 8), 0);
  assert.equal(supportCoins(false, 3), 0);
});
