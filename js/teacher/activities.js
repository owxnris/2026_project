// 학습 활동 저장·조회·시작·종료 (Firestore만 쓴다. Cloud Functions 없음).
import {
  doc, collection, writeBatch, serverTimestamp, onSnapshot, getDoc, getDocs, updateDoc, query, where, Timestamp,
} from '../firebase/sdk.js';
import { db } from '../firebase/app.js';
import { syncClock, serverNow } from '../firebase/clock.js';
import { isActivityRunning } from '../grading.js';
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

// 화면이 이유별 안내를 보여 줄 수 있게 reason·details를 붙인 오류
export class ActivityError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.reason = reason;
    this.details = details;
  }
}

// 활동 시작. 학급에 진행 중인 다른 활동이 있으면 막는다 (교사 한 명이 누르는 버튼이라 확인 → 쓰기 사이의 겹침은 무시한다)
// 시작·종료 시각은 기기 시계가 아니라 Firestore 서버 시각이다: ① status·startAt(서버 시각)을 쓰고 ② 읽어 온 startAt + 전체 시간으로 endAt을 쓴다.
// ①과 ② 사이에서 멈췄으면(endAt 없음) 다시 눌러 ②만 이어서 한다. 학생은 endAt이 생겨야 진행 중으로 본다.
export async function startActivity(classId, activityId) {
  const ref = doc(activitiesOf(classId), activityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new ActivityError('not-found');
  const act = snap.data();
  const sent = Date.now();
  if (act.status === 'waiting') {
    const running = await getDocs(query(activitiesOf(classId), where('status', '==', 'running')));
    const others = running.docs.filter((d) => d.id !== activityId);
    const live = others.find((d) => isActivityRunning(d.data(), serverNow()));
    if (live) throw new ActivityError('already-running', { title: live.data().title });
    // 종료 시각이 지났는데 status가 'running'으로 남은 활동은 여기서 'ended'로 정리한다
    await Promise.all(others.map((d) => updateDoc(d.ref, { status: 'ended' })));
    await updateDoc(ref, { status: 'running', startAt: serverTimestamp() });
  } else if (!(act.status === 'running' && !act.endAt)) {
    throw new ActivityError('not-waiting');
  }
  const { startAt } = (await getDoc(ref)).data();
  syncClock(startAt.toMillis(), sent, Date.now());
  await updateDoc(ref, { endAt: new Timestamp(startAt.seconds + act.totalTimeSec, startAt.nanoseconds) });
}

// 활동 종료: 학생 기기가 종료를 보고 결과를 저장한다 (끝내지 못한 판은 기기가 닫혀 있으면 기록이 남지 않는다 — spec.md 보안·운영 한계)
export async function endActivity(classId, activityId) {
  const ref = doc(activitiesOf(classId), activityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new ActivityError('not-found');
  const { status } = snap.data();
  if (status === 'waiting') throw new ActivityError('not-running');
  if (status === 'running') await updateDoc(ref, { status: 'ended' });
}
