// 학급 광산 (학생 쪽): 이번 활동의 진행 상황(광산 안 인원·참여 인원)과 광산 문서(캔 양)를 실시간으로 보고, 캔 양을 더한다.
// classes/{학급}/activities/{활동}/mine/main { dug, done } — 캔 양은 increment로 더해 여러 학생이 동시에 캐도 맞다.
// Firebase가 없는 예비 흐름에는 광산이 없다 (반 친구들과 함께 해야 하므로)
import {
  doc, collection, onSnapshot, getDoc, setDoc, updateDoc, increment, serverTimestamp,
} from './sdk.js';
import { db } from './app.js';
import { session } from '../session.js';
import { serverNow } from './clock.js';
import { mineState } from '../mine.js';

const mineRef = () => doc(db, 'classes', session.classId, 'activities', session.activityId, 'mine', 'main');

// cb(mineState 결과). 신호가 끊긴 학생을 빼려고 5초마다도 다시 계산한다. 돌려준 함수를 부르면 그만 받는다
export function watchMine(cb) {
  let progress = [];
  let mine = null;
  const emit = () => cb(mineState(progress, mine, serverNow()));
  const stops = [
    onSnapshot(collection(db, 'classes', session.classId, 'activities', session.activityId, 'progress'), (snap) => {
      progress = snap.docs.map((d) => d.data());
      emit();
    }, () => {}),
    onSnapshot(mineRef(), (snap) => { mine = snap.exists() ? snap.data() : null; emit(); }, () => {}),
  ];
  const t = setInterval(emit, 5000);
  return () => { stops.forEach((s) => s()); clearInterval(t); };
}

// 캔 양 더하기 (n: 1~30). 광산 문서가 아직 없으면 만든다
export async function dig(n) {
  try {
    await updateDoc(mineRef(), { dug: increment(n), updatedAt: serverTimestamp() });
  } catch (e) {
    if (e?.code !== 'not-found') throw e;
    await setDoc(mineRef(), { dug: n, done: false, updatedAt: serverTimestamp() });
  }
}

// 목표에 닿으면 완성으로 기록한다 (그 뒤 인원이 늘어 목표가 커져도 완성 그대로)
export function markDone() {
  return updateDoc(mineRef(), { done: true, updatedAt: serverTimestamp() });
}

// 지원 코인을 줄지: 광산이 완성됐는지 한 번 읽는다 (예비 흐름·읽기 실패는 false)
export async function mineDone() {
  if (!session.online || !session.activityId) return false;
  try {
    const snap = await getDoc(mineRef());
    return snap.exists() && snap.data().done === true;
  } catch {
    return false;
  }
}
