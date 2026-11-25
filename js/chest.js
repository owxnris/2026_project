// 학급 보물상자 (2026-11-25, 골드를 계속 쓰는 곳 — 사용자 선택 C): 학생들이 모은 골드를 함께 넣어
// 선생님이 정한 목표를 채우면 선생님이 정한 학급 보상이 열린다. 목표를 채우면 선생님이 다음 목표를 정한다 (계속 이어짐).
// 순수 함수 — 시험: tests/test/chest.test.js
export const DONATE_STEPS = [10, 50, 100]; // 한 번에 넣는 골드
export const MAX_DONATE = 500; // 한 번에 넣을 수 있는 최대 (규칙과 같다)
export const REWARD_MAX = 40; // 보상 글자 수 (규칙과 같다)

// chest: { goal, reward, total } | null
export function chestState(chest) {
  if (!chest || !chest.goal) return { ready: false };
  const total = chest.total ?? 0;
  return {
    ready: true,
    goal: chest.goal,
    total,
    reward: chest.reward ?? '',
    opened: total >= chest.goal,
    percent: Math.min(100, Math.floor((total / chest.goal) * 100)),
    left: Math.max(0, chest.goal - total),
  };
}

// 넣을 수 있는지: 쓸 수 있는 골드가 있고, 한 번 최대 이하, 상자가 아직 안 열렸을 때
export function canDonate(balance, amount, state) {
  if (!state.ready || state.opened) return false;
  return Number.isInteger(amount) && amount > 0 && amount <= MAX_DONATE && balance >= amount;
}

// 교사: 목표 정하기 (지난 목표는 기록으로 남기고 새로 0부터). 잘못된 값이면 { error }
export function newGoal(prev, goal, reward, nowLabel) {
  const g = Number(goal);
  const r = String(reward ?? '').trim();
  if (!Number.isInteger(g) || g <= 0 || g > 1000000) return { error: '목표 골드를 1 이상 숫자로 정해 주세요' };
  if (!r) return { error: '보상을 적어 주세요 (예: 다 함께 자유 시간 10분)' };
  if (r.length > REWARD_MAX) return { error: `보상은 ${REWARD_MAX}자까지 쓸 수 있어요` };
  const history = [...(prev?.history ?? [])];
  if (prev?.goal) history.push({ goal: prev.goal, reward: prev.reward, total: prev.total ?? 0, opened: (prev.total ?? 0) >= prev.goal, endedAt: nowLabel });
  return { chest: { goal: g, reward: r, total: 0, history: history.slice(-50) } };
}
