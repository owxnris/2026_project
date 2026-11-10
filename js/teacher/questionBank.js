// 교사 문제은행 저장소: teachers/{내 uid}/questions. 정답(answer)이 들어 있으므로 본인만 읽는다 (firestore.rules).
// 활동을 만들 때는 여기서 정답을 뺀 사본을 활동 문서에 복사한다 (5단계).
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
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
