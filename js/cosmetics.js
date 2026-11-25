// 말랑이 꾸미기 (2026-11-25): 모험에서 모은 골드로 몸 색·모자를 사서 꾸민다. 산 것은 모험 기록에 남아 다음 수업에도 그대로.
// 골드: 모은 골드(gold, 줄지 않음) − 쓴 골드(spent, 줄지 않음) = 쓸 수 있는 골드. 순수 함수 — 시험: tests/test/cosmetics.test.js
export const COLORS = [
  { id: 'mint', name: '민트', price: 0, palette: null }, // 기본 (원래 그림 색)
  { id: 'pink', name: '분홍', price: 60, palette: ['#ffc2e0', '#ff8fc7', '#c75a92'] },
  { id: 'sky', name: '하늘', price: 60, palette: ['#c4e8ff', '#7cc4ff', '#3d7fc4'] },
  { id: 'purple', name: '보라', price: 100, palette: ['#e0c4ff', '#a87cf0', '#6a46b0'] },
  { id: 'gold', name: '황금', price: 200, palette: ['#fff2a8', '#ffd54f', '#c09020'] },
];
export const HATS = [
  { id: 'none', name: '없음', price: 0 },
  { id: 'leaf', name: '새싹', price: 40 },
  { id: 'bow', name: '리본', price: 80 },
  { id: 'wizard', name: '마법사 모자', price: 120 },
  { id: 'crown', name: '왕관', price: 250 },
];
export const DEFAULT_OWNED = ['mint', 'none'];
export const DEFAULT_LOOK = { color: 'mint', hat: 'none' };

const itemOf = (id) => COLORS.find((c) => c.id === id) || HATS.find((h) => h.id === id) || null;
const kindOf = (id) => (COLORS.some((c) => c.id === id) ? 'color' : 'hat');

export function balance(gold, spent) {
  return Math.max(0, gold - spent);
}

// 누르면 할 일: 'equip'(이미 있음) | 'buy'(살 수 있음) | 'poor'(골드 부족) | 'worn'(지금 쓰는 중)
export function actionFor(id, { owned, look, gold, spent }) {
  if (look[kindOf(id)] === id) return 'worn';
  if (owned.includes(id)) return 'equip';
  return balance(gold, spent) >= itemOf(id).price ? 'buy' : 'poor';
}

// 사기·입기 → 새 상태 (바뀐 게 없으면 null)
export function apply(id, s) {
  const act = actionFor(id, s);
  if (act === 'worn' || act === 'poor') return null;
  const look = { ...s.look, [kindOf(id)]: id };
  if (act === 'equip') return { ...s, look };
  return { ...s, look, owned: [...s.owned, id], spent: s.spent + itemOf(id).price };
}

// 저장된 값이 이상해도(지운 물건 등) 안전한 꾸미기 상태로
export function normalize(saved = {}) {
  const owned = [...new Set([...DEFAULT_OWNED, ...(Array.isArray(saved.owned) ? saved.owned : [])])].filter((id) => itemOf(id));
  const look = { ...DEFAULT_LOOK, ...(saved.look || {}) };
  if (!owned.includes(look.color)) look.color = 'mint';
  if (!owned.includes(look.hat)) look.hat = 'none';
  return { owned, look, spent: Number.isInteger(saved.spent) && saved.spent > 0 ? saved.spent : 0 };
}
