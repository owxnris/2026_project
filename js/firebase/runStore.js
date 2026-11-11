// 학생 기기의 판 저장·읽기 (Firestore). 채점은 runLog.js, 흐름은 quiz.js.
import { doc, getDoc, setDoc, serverTimestamp } from './sdk.js';
import { db, auth } from './app.js';

// 활동의 문제(정답 없음)와 정답표(같은 학급 학생만 읽을 수 있다)
export async function loadActivityData(classId, activityId) {
  const actRef = doc(db, 'classes', classId, 'activities', activityId);
  const [act, key] = await Promise.all([getDoc(actRef), getDoc(doc(actRef, 'answerKey', 'main'))]);
  if (!act.exists() || !key.exists()) throw Object.assign(new Error('activity-not-found'), { reason: 'activity-not-running' });
  return { classId, activityId, questions: act.data().questions, answers: key.data().answers };
}

const learnerRef = (classId, activityId) => doc(db, 'classes', classId, 'activities', activityId, 'learners', auth.currentUser.uid);

// 이 활동에서 내가 틀리고 아직 다시 맞히지 못한 문제 id (복습 출제용)
export async function loadWrong(classId, activityId) {
  const snap = await getDoc(learnerRef(classId, activityId));
  return snap.exists() ? snap.data().wrong : [];
}

export function saveWrong(classId, activityId, wrong) {
  return setDoc(learnerRef(classId, activityId), { wrong });
}

// 결과 문서: 문서 번호 = 판 번호. 규칙상 만들기만 되고 고칠 수 없어서, 다시 저장하려 하면 거부된다 → 이미 저장된 것으로 본다
export async function saveResult(classId, runId, result) {
  const ref = doc(db, 'classes', classId, 'results', runId);
  try {
    await setDoc(ref, { ...result, createdAt: serverTimestamp() });
    return { already: false };
  } catch (e) {
    try {
      if ((await getDoc(ref)).exists()) return { already: true }; // 앞서 보낸 저장이 실제로는 성공했던 경우
    } catch { /* 읽기도 실패하면 원래 오류를 낸다 */ }
    throw e;
  }
}
