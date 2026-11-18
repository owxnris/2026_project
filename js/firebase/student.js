// 학생 쪽 Firebase 기능. 학생은 계정 없이 익명 인증을 쓴다.
import {
  signInAnonymously, signOut, doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot,
} from './sdk.js';
import { auth, db } from './app.js';

// 이미 익명으로 로그인돼 있으면 그 사용자를 그대로 쓴다.
export async function signInStudent() {
  if (auth.currentUser) return auth.currentUser;
  const { user } = await signInAnonymously(auth);
  return user;
}

export class JoinError extends Error {}

// 참여: 익명 로그인 → 참여 코드로 학급 찾기 → 학생 문서(이미 있으면 그대로 사용) → 학급 이름
// 돌려줌: { classId, className, nickname }
// - 같은 닉네임으로 다시 들어오면 같은 학생이다 (새로고침해도 깬 던전이 이어진다)
// - 같은 브라우저에서 다른 닉네임으로 들어오면 다른 학생으로 본다 (공용 교실 컴퓨터) → 익명 사용자를 새로 만든다
export async function joinClass(code, nickname) {
  let user = await signInStudent();
  const codeSnap = await getDoc(doc(db, 'joinCodes', code));
  if (!codeSnap.exists()) throw new JoinError('참여 코드를 찾을 수 없어요. 선생님께 코드를 다시 확인해 주세요.');
  const { classId } = codeSnap.data();

  let ref = doc(db, 'classes', classId, 'students', user.uid);
  let snap = await getDoc(ref);
  if (snap.exists() && snap.data().nickname !== nickname) {
    await signOut(auth);
    ({ user } = await signInAnonymously(auth));
    ref = doc(db, 'classes', classId, 'students', user.uid);
    snap = await getDoc(ref);
  }
  if (!snap.exists()) {
    await setDoc(ref, { nickname, joinCode: code, joinedAt: serverTimestamp() });
    snap = await getDoc(ref);
  }
  const classSnap = await getDoc(doc(db, 'classes', classId));
  return { classId, className: classSnap.data().name, nickname: snap.data().nickname };
}

// 학급의 진행 중('running') 활동을 실시간으로 받는다. 학생이 읽는 활동 문서에는 정답이 없다
export function watchRunningActivities(classId, onChange, onError) {
  const q = query(collection(db, 'classes', classId, 'activities'), where('status', '==', 'running'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })));
  }, onError);
}

// 활동 하나의 상태를 지켜본다 (교사 종료 신호)
export function watchActivity(classId, activityId, onChange) {
  return onSnapshot(doc(db, 'classes', classId, 'activities', activityId), (snap) => {
    onChange(snap.exists() ? snap.data() : null);
  }, () => {});
}
