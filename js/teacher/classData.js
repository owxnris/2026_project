// 학급 화면에서 쓰는 실시간 데이터: 참여 학생, 결과, 활동별 진행 상황 (Firestore 구독)
import { collection, onSnapshot } from '../firebase/sdk.js';
import { db } from '../firebase/app.js';

const listOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));

export function watchStudents(classId, onChange, onError) {
  return onSnapshot(collection(db, 'classes', classId, 'students'), (snap) => {
    const list = listOf(snap);
    list.sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0)); // 먼저 들어온 학생이 위
    onChange(list);
  }, onError);
}

// 결과는 서버 함수만 만든다. 교사는 학급의 결과를 모두 읽어 화면에서 계산한다
export function watchResults(classId, onChange, onError) {
  return onSnapshot(collection(db, 'classes', classId, 'results'), (snap) => onChange(listOf(snap)), onError);
}

// 활동 하나의 진행 상황 { [studentUid]: { nickname, currentDungeon, clearedCount, coins } }
export function watchProgress(classId, activityId, onChange) {
  return onSnapshot(collection(db, 'classes', classId, 'activities', activityId, 'progress'), (snap) => {
    onChange(Object.fromEntries(listOf(snap).map((p) => [p.id, p])));
  }, () => onChange({}));
}
