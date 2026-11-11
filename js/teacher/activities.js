// 학습 활동 저장·조회(Firestore)와 시작·종료(서버 함수).
import {
  doc, collection, writeBatch, serverTimestamp, onSnapshot,
} from '../firebase/sdk.js';
import { db } from '../firebase/app.js';
import { callServer } from '../firebase/server.js';
import { activityQuestion, answerKeyOf } from './activityRules.js';

const activitiesOf = (classId) => collection(db, 'classes', classId, 'activities');

// 활동 문서(정답 없는 문제 사본)와 정답표(answerKey/main)를 한 번에 저장한다. picked: 문제은행 문제(id·answer 포함)
export async function createActivity(classId, { title, totalTimeSec, picked }) {
  const ref = doc(activitiesOf(classId));
  const batch = writeBatch(db);
  batch.set(ref, {
    title,
    totalTimeSec,
    status: 'waiting',
    startAt: null,
    endAt: null,
    questions: picked.map(activityQuestion),
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'classes', classId, 'activities', ref.id, 'answerKey', 'main'), { answers: answerKeyOf(picked) });
  await batch.commit();
  return ref.id;
}

// 학급의 활동을 실시간으로 받는다 (최근에 만든 활동이 위)
export function watchActivities(classId, onChange, onError) {
  return onSnapshot(activitiesOf(classId), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    list.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    onChange(list);
  }, onError);
}

export function startActivity(classId, activityId) {
  return callServer('startActivity', { classId, activityId });
}

export function endActivity(classId, activityId) {
  return callServer('endActivity', { classId, activityId });
}
