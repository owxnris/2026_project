// 학급 보물상자(js/chest.js) 시험
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chestState, canDonate, newGoal } from '../../js/chest.js';

test('상자 상태: 진행률·남은 골드·열림', () => {
  assert.deepEqual(chestState(null), { ready: false });
  const s = chestState({ goal: 500, reward: '자유 시간', total: 120 });
  assert.deepEqual([s.ready, s.percent, s.left, s.opened], [true, 24, 380, false]);
  assert.equal(chestState({ goal: 500, total: 600 }).percent, 100);
  assert.equal(chestState({ goal: 500, total: 500 }).opened, true);
});

test('넣기: 쓸 수 있는 골드 안에서, 한 번 500까지, 열린 상자에는 못 넣는다', () => {
  const s = chestState({ goal: 500, total: 0 });
  assert.equal(canDonate(100, 50, s), true);
  assert.equal(canDonate(30, 50, s), false);
  assert.equal(canDonate(1000, 600, s), false);
  assert.equal(canDonate(100, 0, s), false);
  assert.equal(canDonate(100, 10, chestState({ goal: 10, total: 10 })), false);
  assert.equal(canDonate(100, 10, chestState(null)), false);
});

test('새 목표: 지난 목표는 기록으로, 새로 0부터, 잘못된 값 안내', () => {
  const { chest } = newGoal({ goal: 500, reward: '자유 시간', total: 520, history: [] }, '1000', ' 보드게임 시간 ', '11월 25일');
  assert.deepEqual([chest.goal, chest.reward, chest.total], [1000, '보드게임 시간', 0]);
  assert.deepEqual(chest.history, [{ goal: 500, reward: '자유 시간', total: 520, opened: true, endedAt: '11월 25일' }]);
  assert.ok(newGoal(null, '0', '보상').error);
  assert.ok(newGoal(null, '100', '').error);
  assert.ok(newGoal(null, '100', 'x'.repeat(41)).error);
  assert.deepEqual(newGoal(null, '100', '첫 보상').chest.history, []);
});
