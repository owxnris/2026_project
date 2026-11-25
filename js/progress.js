// 실시간 진행 상황(progress/{uid}): 교사 진행 중 화면이 본다. 학생이 자기 문서만 덮어쓴다.
// Firestore 무료 요금제(Spark)는 하루 쓰기 2만 건이라 아낀다: 3초에 한 번만 쓰고, 내용이 그대로면 쓰지 않는다 (마지막 값은 꼭 쓴다).
import { doc, getDoc, setDoc, serverTimestamp } from './firebase/sdk.js';
import { syncClock } from './firebase/clock.js';
import { db, auth } from './firebase/app.js';
import { session } from './session.js';
import { state } from './state.js';

const WRITE_INTERVAL_MS = 3000;

let currentDungeon = null;
let inMine = false; // 학급 광산 안에 있는지 (js/mine.js — 광산 안 학생 수를 센다)
let timer = null;
let pending = false;
let synced = false; // 서버 시각을 한 번 맞췄는지
let lastKey = ''; // 마지막으로 쓴 내용 (같으면 다시 쓰지 않는다)

const ref = () => doc(db, 'classes', session.classId, 'activities', session.activityId, 'progress', auth.currentUser.uid);

function write() {
  timer = null;
  if (!pending || !session.online || !session.activityId) return;
  pending = false;
  const body = {
    nickname: session.nickname, currentDungeon, clearedCount: state.cleared.filter(Boolean).length, coins: state.coins, inMine,
  };
  const key = `${session.activityId}|${JSON.stringify(body)}`;
  if (key === lastKey) return;
  const sent = Date.now();
  setDoc(ref(), { ...body, updatedAt: serverTimestamp() }).then(() => {
    if (synced) return;
    // 방금 쓴 updatedAt이 서버 시각이다 → 기기 시계와의 차이를 한 번 잰다 (실패해도 게임은 계속)
    return getDoc(ref()).then((s) => {
      const t = s.data()?.updatedAt;
      if (t) { syncClock(t.toMillis(), sent, Date.now()); synced = true; }
    });
  }).then(() => { lastKey = key; }).catch(() => { pending = true; }); // 실패하면 다음 변화 때 다시 쓴다
}

// dungeon: 지금 있는 던전 번호 (월드맵이면 null). 생략하면 위치는 그대로
export function reportProgress(dungeon) {
  if (dungeon !== undefined) currentDungeon = dungeon;
  if (!session.online || !session.activityId) return;
  pending = true;
  if (!timer) timer = setTimeout(write, dungeon !== undefined ? 0 : WRITE_INTERVAL_MS);
}

// 학급 광산: 들어가고 나올 때, 그리고 광산 안에서는 신호(heartbeat)로 주기적으로 다시 쓴다 (오래 신호가 없으면 나간 것으로 센다)
export function setInMine(on) {
  inMine = on;
  heartbeat();
}
export function heartbeat() {
  lastKey = ''; // 내용이 같아도 updatedAt을 새로 쓴다
  if (timer) { clearTimeout(timer); timer = null; }
  if (!session.online || !session.activityId) return;
  pending = true;
  write();
}

// 다시 들어온 학생: 이 활동에서 이미 깬 던전 수 (처음이면 0)
export async function loadClearedCount() {
  const snap = await getDoc(ref());
  return snap.exists() ? snap.data().clearedCount : 0;
}
