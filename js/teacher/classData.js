// 학급 화면에서 쓰는 실시간 데이터: 참여 학생, 결과, 활동별 진행 상황 (Firestore 구독)
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from '../firebase/sdk.js';
import { db } from '../firebase/app.js';

const listOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));

export function watchStudents(classId, onChange, onError) {
  return onSnapshot(collection(db, 'classes', classId, 'students'), (snap) => {
    const list = listOf(snap);
    list.sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0)); // 먼저 들어온 학생이 위
    onChange(list);
  }, onError);
}

// 결과는 학생 기기가 판이 끝날 때 만든다. 교사는 학급의 결과를 모두 읽어 화면에서 계산한다
export function watchResults(classId, onChange, onError) {
  return onSnapshot(collection(db, 'classes', classId, 'results'), (snap) => onChange(listOf(snap)), onError);
}

// 학생별 모험 기록 { [studentUid]: { clearedCount, gold } } — 규칙을 아직 게시하지 않았으면 빈 값 (학생 목록은 그대로)
export function watchAdventures(classId, onChange) {
  return onSnapshot(collection(db, 'classes', classId, 'adventure'), (snap) => {
    onChange(Object.fromEntries(listOf(snap).map((a) => [a.id, a])));
  }, () => onChange({}));
}

// 학급 보물상자 classes/{학급}/chest/main (없으면 null)
export function watchChest(classId, onChange) {
  return onSnapshot(doc(db, 'classes', classId, 'chest', 'main'), (snap) => onChange(snap.exists() ? snap.data() : null), () => onChange(null));
}

// 교사: 목표·보상 정하기 (chest: { goal, reward, total, history } — js/chest.js newGoal)
export function saveChest(classId, chest) {
  return setDoc(doc(db, 'classes', classId, 'chest', 'main'), { ...chest, updatedAt: serverTimestamp() });
}

// 학급 광산 문서 (활동마다, 없으면 null)
export function watchMine(classId, activityId, onChange) {
  return onSnapshot(doc(db, 'classes', classId, 'activities', activityId, 'mine', 'main'), (snap) => onChange(snap.exists() ? snap.data() : null), () => onChange(null));
}

// 활동 하나의 진행 상황 { [studentUid]: { nickname, currentDungeon, clearedCount, coins } }
export function watchProgress(classId, activityId, onChange) {
  return onSnapshot(collection(db, 'classes', classId, 'activities', activityId, 'progress'), (snap) => {
    onChange(Object.fromEntries(listOf(snap).map((p) => [p.id, p])));
  }, () => onChange({}));
}
