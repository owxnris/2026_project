// 말랑이 꾸미기(js/cosmetics.js) 시험
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionFor, apply, balance, normalize } from '../../js/cosmetics.js';

const base = (o = {}) => ({ owned: ['mint', 'none'], look: { color: 'mint', hat: 'none' }, gold: 100, spent: 0, ...o });

test('쓸 수 있는 골드 = 모은 골드 − 쓴 골드', () => {
  assert.equal(balance(100, 40), 60);
  assert.equal(balance(10, 40), 0);
});

test('사기: 골드가 충분하면 사서 바로 입고, 쓴 골드가 늘어난다', () => {
  const s = apply('pink', base());
  assert.deepEqual([s.look.color, s.spent, s.owned.includes('pink')], ['pink', 60, true]);
  assert.equal(actionFor('wizard', s), 'poor', '남은 40골드로는 모자(120)를 못 산다');
  assert.equal(apply('wizard', s), null);
  assert.equal(actionFor('leaf', s), 'buy');
});

test('이미 산 것은 골드 없이 다시 입고, 입고 있는 것은 그대로', () => {
  const s = apply('mint', apply('pink', base()));
  assert.deepEqual([s.look.color, s.spent], ['mint', 60]);
  assert.equal(actionFor('mint', s), 'worn');
  assert.equal(apply('mint', s), null);
  assert.equal(apply('pink', s).spent, 60, '다시 입어도 골드는 그대로');
});

test('저장된 값 정리: 없는 물건·사지 않은 것을 입은 상태는 기본으로', () => {
  assert.deepEqual(normalize({ owned: ['pink', 'ghost'], look: { color: 'gold', hat: 'none' }, spent: 60 }),
    { owned: ['mint', 'none', 'pink'], look: { color: 'mint', hat: 'none' }, spent: 60 });
  assert.deepEqual(normalize(undefined), { owned: ['mint', 'none'], look: { color: 'mint', hat: 'none' }, spent: 0 });
});
