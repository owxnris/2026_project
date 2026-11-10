// 교사 문제은행 저장소: teachers/{내 uid}/questions. 정답(answer)이 들어 있으므로 본인만 읽는다 (firestore.rules).
// 활동을 만들 때는 여기서 정답을 뺀 사본을 활동 문서에 복사한다 (5단계).
import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch,
} from '../firebase/sdk.js';
import { auth, db } from '../firebase/app.js';

function myQuestions() {
  return collection(db, 'teachers', auth.currentUser.uid, 'questions');
}

// 내 문제를 실시간으로 받는다 (최근에 고친 문제가 위). 돌려준 함수를 부르면 그만 받는다.
export function watchMyQuestions(onChange, onError) {
  return onSnapshot(myQuestions(), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    list.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
    onChange(list);
  }, onError);
}

// fields: { subject, difficulty, learningConcept, question, choices, answer }
export function addQuestion(fields) {
  return addDoc(myQuestions(), { ...fields, source: 'teacher', updatedAt: serverTimestamp() });
}

// source(처음 출처)는 바꾸지 않는다
export function updateQuestion(id, fields) {
  return updateDoc(doc(myQuestions(), id), { ...fields, updatedAt: serverTimestamp() });
}

export function deleteQuestion(id) {
  return deleteDoc(doc(myQuestions(), id));
}

// 기본 문제(questions.json, 기능 시험용 예시) 불러오기. 문제의 id('d01'…)를 문서 id로 쓰고,
// 이미 있는 문서는 건너뛴다 → 여러 번 불러도 중복되지 않고, 교사가 고친 기본 문제도 덮어쓰지 않는다.
// 돌려주는 값: { added, skipped }
export async function importDefaultQuestions(defaults) {
  const refs = defaults.map((q) => doc(myQuestions(), q.id));
  const exists = await Promise.all(refs.map(async (ref) => (await getDoc(ref)).exists()));

  const batch = writeBatch(db);
  let added = 0;
  defaults.forEach(({ id, ...fields }, i) => {
    if (exists[i]) return;
    batch.set(refs[i], { ...fields, source: 'default', updatedAt: serverTimestamp() });
    added += 1;
  });
  if (added > 0) await batch.commit();
  return { added, skipped: defaults.length - added };
}
