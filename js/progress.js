// 실시간 진행 상황(progress/{uid}): 교사 진행 중 화면이 본다. 학생이 자기 문서만 덮어쓴다.
// 코인이 자주 바뀌므로 1초에 한 번만 쓴다 (마지막 값은 꼭 쓴다).
import { doc, getDoc, setDoc, serverTimestamp } from './firebase/sdk.js';
import { db, auth } from './firebase/app.js';
import { session } from './session.js';
import { state } from './state.js';

let currentDungeon = null;
let timer = null;
let pending = false;

const ref = () => doc(db, 'classes', session.classId, 'activities', session.activityId, 'progress', auth.currentUser.uid);

function write() {
  timer = null;
  if (!pending || !session.online || !session.activityId) return;
  pending = false;
  setDoc(ref(), {
    nickname: session.nickname,
    currentDungeon,
    clearedCount: state.cleared.filter(Boolean).length,
    coins: state.coins,
    updatedAt: serverTimestamp(),
  }).catch(() => { pending = true; }); // 실패하면 다음 변화 때 다시 쓴다
}

// dungeon: 지금 있는 던전 번호 (월드맵이면 null). 생략하면 위치는 그대로
export function reportProgress(dungeon) {
  if (dungeon !== undefined) currentDungeon = dungeon;
  if (!session.online || !session.activityId) return;
  pending = true;
  if (!timer) timer = setTimeout(write, dungeon !== undefined ? 0 : 1000);
}

// 다시 들어온 학생: 이 활동에서 이미 깬 던전 수 (처음이면 0)
export async function loadClearedCount() {
  const snap = await getDoc(ref());
  return snap.exists() ? snap.data().clearedCount : 0;
}
