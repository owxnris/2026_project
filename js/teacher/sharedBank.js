// 교사 간 공유 문제은행 (Firestore sharedQuestions). 개인 문제은행(teachers/{uid}/questions)과 따로 둔다.
// - 공유: 내 문제를 복사해 sharedQuestions에 올리고, 내 문제에 sharedId를 남긴다
// - 가져오기: 공유 문제를 내 문제은행에 복사한다 (원본과 따로 고칠 수 있음, 출처 origin 기록)
// - 공유 문제는 올린 교사만 고치고(다시 올리기) 지울 수 있다 (firestore.rules)
// - 개인 정보는 올리지 않는다: 작성자는 교사가 정한 '공유 이름'만 쓰고, 이메일·실명·학생 정보는 넣지 않는다
import {
  collection, doc, getDoc, addDoc, updateDoc, onSnapshot, writeBatch, serverTimestamp,
} from '../firebase/sdk.js';
import { auth, db } from '../firebase/app.js';
import { findSameConcept } from './bankRules.js';

export const SHARE_NAME_MAX = 20;
const QUESTION_KEYS = ['subject', 'difficulty', 'learningConcept', 'question', 'choices', 'answer'];
const shared = () => collection(db, 'sharedQuestions');
const myQuestions = () => collection(db, 'teachers', auth.currentUser.uid, 'questions');
const pick = (q) => Object.fromEntries(QUESTION_KEYS.map((k) => [k, q[k]]));

export class ShareError extends Error {}

export function normalizeShareName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

export async function getShareName() {
  const snap = await getDoc(doc(db, 'teachers', auth.currentUser.uid));
  return snap.exists() ? snap.data().shareName ?? '' : '';
}

export async function setShareName(name) {
  const n = normalizeShareName(name);
  if (!n || n.length > SHARE_NAME_MAX) throw new ShareError(`공유 이름은 1~${SHARE_NAME_MAX}자로 정해 주세요.`);
  if (/@/.test(n)) throw new ShareError('공유 이름에 이메일 주소는 쓸 수 없어요.');
  await updateDoc(doc(db, 'teachers', auth.currentUser.uid), { shareName: n });
  return n;
}

export function watchShared(onChange, onError) {
  return onSnapshot(shared(), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    list.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
    onChange(list);
  }, onError);
}

// 내 문제 q(id 포함)를 공유한다. 직접 만든 문제만 (기본 문제·가져온 문제는 출처가 따로 있어 막는다)
export async function shareQuestion(q) {
  if (q.source !== 'teacher') throw new ShareError('직접 만든 문제만 공유할 수 있어요.');
  if (q.sharedId) throw new ShareError('이미 공유한 문제예요.');
  const authorName = await getShareName();
  if (!authorName) throw new ShareError('공유 문제은행 화면에서 공유할 때 보일 이름을 먼저 정해 주세요.');
  const ref = doc(shared());
  const batch = writeBatch(db);
  batch.set(ref, {
    ...pick(q), ownerUid: auth.currentUser.uid, authorName, sharedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.update(doc(myQuestions(), q.id), { sharedId: ref.id });
  await batch.commit();
  return ref.id;
}

// 공유한 문제를 내 문제의 지금 내용으로 다시 올린다 (공유 문제 고치기)
export async function updateSharedFrom(q) {
  const authorName = await getShareName();
  await updateDoc(doc(shared(), q.sharedId), { ...pick(q), authorName, updatedAt: serverTimestamp() });
}

// 공유 취소: 공유 문제를 지우고, 내 문제에 남은 표시를 없앤다 (내 문제는 그대로)
export async function unshare(item, myList) {
  const batch = writeBatch(db);
  batch.delete(doc(shared(), item.id));
  const mine = myList.find((q) => q.sharedId === item.id);
  if (mine) batch.update(doc(myQuestions(), mine.id), { sharedId: null });
  await batch.commit();
}

// 가져오기: 내 문제은행에 복사. 같은 과목에 띄어쓰기·대소문자만 다른 개념이 있으면 그 개념으로 합친다
export async function importShared(item, myList) {
  if (item.ownerUid === auth.currentUser.uid) throw new ShareError('내가 공유한 문제예요.');
  if (myList.some((q) => q.origin?.sharedId === item.id)) throw new ShareError('이미 가져온 문제예요.');
  const concept = findSameConcept(myList, item.subject, item.learningConcept) ?? item.learningConcept;
  const ref = await addDoc(myQuestions(), {
    ...pick(item),
    learningConcept: concept,
    source: 'shared',
    origin: { sharedId: item.id, authorName: item.authorName },
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, mergedConcept: concept !== item.learningConcept ? concept : null };
}
