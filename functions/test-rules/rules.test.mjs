// firestore.rules를 실제 규칙 엔진(Firestore 에뮬레이터)에서 시험한다. 실행: Java + firebase-tools 필요 → npm run test:rules
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';

let env;
const teacher = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const student = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const shared = (o = {}) => ({
  subject: '과학', difficulty: '하', learningConcept: '광합성', question: '광합성 장소', choices: ['뿌리', '잎', '줄기', '꽃'], answer: 1,
  ownerUid: 'A', authorName: '과학 선생님', sharedAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dungeondash',
    firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'sharedQuestions/S1'), shared());
    await setDoc(doc(db, 'teachers/B/questions/imp'), { ...shared(), source: 'shared', origin: { sharedId: 'S1', authorName: '과학 선생님' } });
    await setDoc(doc(db, 'classes/C1'), { ownerUid: 'A', name: '1반', joinCode: '123456' });
    await setDoc(doc(db, 'joinCodes/123456'), { classId: 'C1', ownerUid: 'A' });
    await setDoc(doc(db, 'classes/C1/students/ST'), { nickname: '하늘', joinCode: '123456' });
    await setDoc(doc(db, 'classes/C1/activities/A1'), { title: 't', totalTimeSec: 60, status: 'running', questions: [{ id: 'q' }] });
    await setDoc(doc(db, 'classes/C1/activities/A1/answerKey/main'), { answers: { q: 1 } });
    await setDoc(doc(db, 'classes/C1/activities/A1/runs/R1'), { studentUid: 'ST' });
    await setDoc(doc(db, 'classes/C1/results/R1'), { studentUid: 'ST', quizCorrect: 1 });
  });
});
after(async () => { await env.cleanup(); });

test('V2 교사 A/B: 모두 읽고, B는 A의 공유 문제를 고치거나 남의 uid로 올릴 수 없다', async () => {
  await assertSucceeds(getDocs(collection(teacher('B'), 'sharedQuestions')));
  await assertFails(updateDoc(doc(teacher('B'), 'sharedQuestions/S1'), { question: 'B가 고침' }));
  await assertFails(setDoc(doc(teacher('B'), 'sharedQuestions/X1'), shared({ ownerUid: 'A' })));
  await assertSucceeds(setDoc(doc(teacher('B'), 'sharedQuestions/B1'), shared({ ownerUid: 'B', authorName: '수학 선생님' })));
  await assertSucceeds(updateDoc(doc(teacher('A'), 'sharedQuestions/S1'), { question: 'A가 고침', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(teacher('A'), 'sharedQuestions/S1'), { ownerUid: 'B' }));
});

test('V3 복사본은 가져온 교사만, 원본과 따로 고친다', async () => {
  await assertSucceeds(updateDoc(doc(teacher('B'), 'teachers/B/questions/imp'), { question: 'B 복사본 수정' }));
  await assertFails(getDoc(doc(teacher('A'), 'teachers/B/questions/imp')));
  await assertFails(updateDoc(doc(teacher('A'), 'teachers/B/questions/imp'), { question: 'A가 남의 복사본을' }));
});

test('V4 소유자가 아닌 교사는 공유 문제를 지울 수 없다', async () => {
  await assertFails(deleteDoc(doc(teacher('B'), 'sharedQuestions/S1')));
  await assertSucceeds(deleteDoc(doc(teacher('B'), 'sharedQuestions/B1')));
});

test('V5 학생·로그인 안 한 사용자는 공유 문제은행을 읽거나 쓸 수 없다', async () => {
  await assertFails(getDoc(doc(student('ST'), 'sharedQuestions/S1')));
  await assertFails(getDocs(collection(student('ST'), 'sharedQuestions')));
  await assertFails(setDoc(doc(student('ST'), 'sharedQuestions/X2'), shared({ ownerUid: 'ST' })));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'sharedQuestions/S1')));
});

test('V6 공유 문서: 이메일 공유 이름·정해지지 않은 필드(email 등) 거부', async () => {
  await assertFails(setDoc(doc(teacher('A'), 'sharedQuestions/X3'), shared({ authorName: 'a@b.com' })));
  await assertFails(setDoc(doc(teacher('A'), 'sharedQuestions/X4'), shared({ email: 'a@b.com' })));
  await assertFails(setDoc(doc(teacher('A'), 'sharedQuestions/X5'), shared({ authorName: '' })));
  await assertFails(setDoc(doc(teacher('A'), 'sharedQuestions/X6'), shared({ answer: 5 })));
  await assertSucceeds(setDoc(doc(teacher('A'), 'sharedQuestions/X7'), shared()));
});

test('학생 권한: 정답표·판 기록·결과 쓰기·다른 학생 결과 차단, 자기 progress만', async () => {
  const st = student('ST');
  await assertSucceeds(getDoc(doc(st, 'classes/C1/activities/A1')));
  await assertSucceeds(getDocs(query(collection(st, 'classes/C1/activities'), where('status', '==', 'running'))));
  await assertFails(getDoc(doc(st, 'classes/C1/activities/A1/answerKey/main')));
  await assertFails(getDoc(doc(st, 'classes/C1/activities/A1/runs/R1')));
  await assertFails(getDoc(doc(st, 'classes/C1/results/R1')));
  await assertFails(setDoc(doc(st, 'classes/C1/results/fake'), { studentUid: 'ST' }));
  await assertSucceeds(setDoc(doc(st, 'classes/C1/activities/A1/progress/ST'), { nickname: '하늘', currentDungeon: null, clearedCount: 0, coins: 0, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(st, 'classes/C1/activities/A1/progress/ST')));
  await assertFails(setDoc(doc(st, 'classes/C1/activities/A1/progress/OTHER'), { nickname: 'x', currentDungeon: null, clearedCount: 9, coins: 0, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(st, 'classes/C1/activities/A1'), { status: 'ended' }));
  await assertFails(getDoc(doc(student('OUT'), 'classes/C1/activities/A1')), '학급 밖 학생');
});

test('학생 참여: 코드가 맞을 때 자기 문서만, 다시 쓰기 불가', async () => {
  const nw = student('NEW');
  await assertSucceeds(setDoc(doc(nw, 'classes/C1/students/NEW'), { nickname: '바다', joinCode: '123456', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(nw, 'classes/C1/students/NEW'), { nickname: '바꿈', joinCode: '123456', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(student('X'), 'classes/C1/students/X'), { nickname: 'x', joinCode: '999999', joinedAt: serverTimestamp() }));
  await assertFails(getDocs(collection(nw, 'joinCodes')));
});

test('교사: 활동은 대기 상태로만 만들고, 시작·종료(status 변경)는 서버만. 결과는 소유 교사만 읽기', async () => {
  const a = teacher('A');
  const b = writeBatch(a);
  b.set(doc(a, 'classes/C1/activities/A2'), { title: 'x', totalTimeSec: 300, status: 'waiting', startAt: null, endAt: null, questions: [{ id: 'q' }], createdAt: serverTimestamp() });
  b.set(doc(a, 'classes/C1/activities/A2/answerKey/main'), { answers: { q: 0 } });
  await assertSucceeds(b.commit());
  await assertFails(setDoc(doc(a, 'classes/C1/activities/A3'), { title: 'x', totalTimeSec: 300, status: 'running', startAt: null, endAt: null, questions: [{ id: 'q' }], createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(a, 'classes/C1/activities/A2'), { status: 'running' }));
  await assertSucceeds(getDocs(collection(a, 'classes/C1/results')));
  await assertFails(getDocs(collection(teacher('B'), 'classes/C1/results')), '다른 교사는 결과를 못 읽음');
  await assertFails(getDoc(doc(teacher('B'), 'classes/C1/activities/A1/answerKey/main')));
  await assertFails(setDoc(doc(a, 'classes/C1/results/fake'), { studentUid: 'ST' }), '교사도 결과를 만들 수 없음');
});
