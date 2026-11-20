// 학생 모험 기록: 깬 방 수·누적 골드를 수업(활동)이 바뀌어도 이어 간다.
// - 온라인: Firestore classes/{학급}/adventure/{학생 uid} (학생 본인만 쓰고, 소유 교사가 읽는다 — firestore.rules)
// - Firebase 설정값이 없는 예비 흐름: 이 브라우저(localStorage)
// 학생 계정이 익명이라 같은 브라우저 + 같은 닉네임일 때 이어진다 (다른 기기로 옮기면 새 기록)
import { doc, getDoc, setDoc, serverTimestamp } from './sdk.js';
import { db, auth } from './app.js';
import { session } from '../session.js';

const LOCAL_KEY = 'dd.adventure';
const ref = () => doc(db, 'classes', session.classId, 'adventure', auth.currentUser.uid);
const EMPTY = { clearedCount: 0, gold: 0 };

export async function loadAdventure() {
  try {
    if (!session.online) return { ...EMPTY, ...JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') };
    const snap = await getDoc(ref());
    return snap.exists() ? { ...EMPTY, ...snap.data() } : { ...EMPTY };
  } catch {
    return { ...EMPTY }; // 읽지 못하면 처음부터 (게임은 막지 않는다)
  }
}

// 깬 방 수와 골드는 줄어들지 않는다 (규칙도 같은 조건)
let last = { ...EMPTY };
export function saveAdventure({ clearedCount, gold }) {
  const next = { clearedCount: Math.max(clearedCount, last.clearedCount), gold: Math.max(gold, last.gold) };
  if (next.clearedCount === last.clearedCount && next.gold === last.gold) return Promise.resolve();
  last = next;
  if (!session.online) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* 이번 탭만 */ }
    return Promise.resolve();
  }
  return setDoc(ref(), { nickname: session.nickname, ...next, updatedAt: serverTimestamp() }).catch(() => {
    last = { ...EMPTY }; // 다음에 다시 쓰도록
  });
}

// 불러온 값을 기준점으로 삼는다 (다른 학생으로 바뀌었을 때 이전 값이 남지 않게)
export function setAdventureBase(adv) {
  last = { clearedCount: adv.clearedCount, gold: adv.gold };
}

// 프롤로그를 본 적 있는지 (이 브라우저·학생마다)
export function prologueSeen() {
  try { return localStorage.getItem(`dd.prologue.${auth.currentUser?.uid ?? 'local'}`) === '1'; } catch { return true; }
}
export function markPrologueSeen() {
  try { localStorage.setItem(`dd.prologue.${auth.currentUser?.uid ?? 'local'}`, '1'); } catch { /* 무시 */ }
}
