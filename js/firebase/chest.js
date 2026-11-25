// 학급 보물상자 (학생 쪽): classes/{학급}/chest/main 을 실시간으로 보고, 골드를 넣는다.
// 넣을 때는 모험 기록(쓴 골드·넣은 골드)과 상자 합계를 한 번에(batch) 쓴다 → 규칙이 '상자에 더한 골드 = 내가 쓴 골드 증가'를 확인한다.
// 합계는 increment(더하기)로 써서 여러 학생이 동시에 넣어도 맞다. Firebase가 없는 예비 흐름은 이 브라우저에만
import {
  doc, onSnapshot, writeBatch, serverTimestamp, increment,
} from './sdk.js';
import { db, auth } from './app.js';
import { session } from '../session.js';
import { state, clearedRoomCount } from '../state.js';
import { setAdventureBase } from './adventure.js';

const LOCAL_KEY = 'dd.chest';
const chestRef = () => doc(db, 'classes', session.classId, 'chest', 'main');

// cb(상자 문서 | null)
export function watchChest(cb) {
  if (!session.online) {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { /* 없음 */ }
    cb(local);
    return () => {};
  }
  return onSnapshot(chestRef(), (snap) => cb(snap.exists() ? snap.data() : null), () => cb(null));
}

// 골드 넣기: 쓴 골드·넣은 골드를 늘리고 상자 합계에 더한다. 실패하면 오류를 낸다 (상태는 바꾸지 않는다)
export async function donate(amount) {
  const next = {
    clearedCount: clearedRoomCount(),
    gold: state.gold,
    spent: state.style.spent + amount,
    owned: [...state.style.owned],
    look: { ...state.style.look },
    donated: (state.donated ?? 0) + amount,
  };
  if (!session.online) {
    const chest = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    if (chest) { chest.total = (chest.total ?? 0) + amount; localStorage.setItem(LOCAL_KEY, JSON.stringify(chest)); }
    localStorage.setItem('dd.adventure', JSON.stringify(next));
  } else {
    const b = writeBatch(db);
    b.set(doc(db, 'classes', session.classId, 'adventure', auth.currentUser.uid), { nickname: session.nickname, ...next, updatedAt: serverTimestamp() });
    b.update(chestRef(), { total: increment(amount), updatedAt: serverTimestamp() });
    await b.commit();
  }
  state.style = { ...state.style, spent: next.spent };
  state.donated = next.donated;
  setAdventureBase(next);
}
