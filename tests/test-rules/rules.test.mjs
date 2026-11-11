// firestore.rules를 실제 규칙 엔진(Firestore 에뮬레이터)에서 시험한다. 실행: Java + firebase-tools 필요 → npm run test:rules
// Cloud Functions 없이 학생 기기가 채점하고 결과를 직접 쓰는 구조라서, 결과·활동 시작·종료 규칙이 핵심이다.
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';

let env;
const teacher = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const student = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const shared = (o = {}) => ({
  subject: '과학', difficulty: '하', learningConcept: '광합성', question: '광합성 장소', choices: ['뿌리', '잎', '줄기', '꽃'], answer: 1,
  ownerUid: 'A', authorName: '과학 선생님', sharedAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o,
});
const ANS = { questionId: 'q', learningConcept: '곱셈', chosen: 1, correct: true, quizType: 'entry' };
const ABIL = { dash: 1, shield: false, doubleJump: false };
// 학생 기기가 만드는 결과 문서 (js/grading.js buildResult + createdAt). o로 일부를 바꿔 어긋난 값을 시험한다
const result = (o = {}) => ({
  studentUid: 'ST', nickname: '하늘', activityId: 'A1', dungeon: 0, outcome: 'cleared', cleared: true,
  quizCorrect: 2, quizTotal: 3, answers: [ANS, ANS, { ...ANS, correct: false, chosen: null }], wrongConcepts: ['곱셈'],
  coinsEarned: 20, coinsSpent: 10, abilities: ABIL, dashesUsed: 1, hits: 0, falls: 0, clearSec: 42, createdAt: serverTimestamp(), ...o,
});
const abandoned = (o = {}) => result({
  outcome: 'abandoned', cleared: false, coinsSpent: null, abilities: null, dashesUsed: null, hits: null, falls: null, clearSec: null, ...o,
});
const newAct = (o = {}) => ({ title: 'x', totalTimeSec: 300, status: 'waiting', startAt: null, endAt: null, questions: [{ id: 'q' }], createdAt: serverTimestamp(), ...o });

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
    await setDoc(doc(db, 'classes/C1/students/ST2'), { nickname: '바다', joinCode: '123456' });
    await setDoc(doc(db, 'classes/C1/activities/A1'), {
      title: 't', totalTimeSec: 60, status: 'running', startAt: Timestamp.fromMillis(1000), endAt: Timestamp.fromMillis(61000), questions: [{ id: 'q' }],
    });
    await setDoc(doc(db, 'classes/C1/activities/A1/answerKey/main'), { answers: { q: 1 } });
    await setDoc(doc(db, 'classes/C1/results/ST_old'), { studentUid: 'ST', quizCorrect: 1 });
    await setDoc(doc(db, 'classes/C1/results/ST2_old'), { studentUid: 'ST2', quizCorrect: 1 });
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

test('학생 권한: 활동·정답표·자기 progress는 되고, 활동 고치기·남의 데이터·학급 밖은 막힌다', async () => {
  const st = student('ST');
  await assertSucceeds(getDoc(doc(st, 'classes/C1/activities/A1')));
  await assertSucceeds(getDocs(query(collection(st, 'classes/C1/activities'), where('status', '==', 'running'))));
  await assertSucceeds(getDoc(doc(st, 'classes/C1/activities/A1/answerKey/main')), '같은 학급 학생은 정답표를 읽는다 (기기 채점)');
  await assertFails(setDoc(doc(st, 'classes/C1/activities/A1/answerKey/main'), { answers: { q: 0 } }), '정답표는 학생이 못 고친다');
  await assertSucceeds(setDoc(doc(st, 'classes/C1/activities/A1/progress/ST'), { nickname: '하늘', currentDungeon: null, clearedCount: 0, coins: 0, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(st, 'classes/C1/activities/A1/progress/ST')));
  await assertFails(setDoc(doc(st, 'classes/C1/activities/A1/progress/OTHER'), { nickname: 'x', currentDungeon: null, clearedCount: 9, coins: 0, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(st, 'classes/C1/activities/A1'), { status: 'ended' }));
  await assertFails(deleteDoc(doc(st, 'classes/C1/activities/A1')));
  const out = student('OUT');
  await assertFails(getDoc(doc(out, 'classes/C1/activities/A1')), '학급 밖 학생');
  await assertFails(getDoc(doc(out, 'classes/C1/activities/A1/answerKey/main')), '학급 밖 학생은 정답표도 못 읽는다');
  await assertFails(setDoc(doc(out, 'classes/C1/results/OUT_r1'), result({ studentUid: 'OUT' })), '학급 밖 학생은 결과를 못 쓴다');
});

test('복습 기록(learners): 본인만 읽고 쓴다, 형식 검사', async () => {
  const st = student('ST');
  await assertSucceeds(setDoc(doc(st, 'classes/C1/activities/A1/learners/ST'), { wrong: ['q'] }));
  await assertSucceeds(getDoc(doc(st, 'classes/C1/activities/A1/learners/ST')));
  await assertFails(getDoc(doc(student('ST2'), 'classes/C1/activities/A1/learners/ST')), '다른 학생은 못 읽음');
  await assertFails(setDoc(doc(student('ST2'), 'classes/C1/activities/A1/learners/ST'), { wrong: [] }), '다른 학생이 못 씀');
  await assertFails(setDoc(doc(st, 'classes/C1/activities/A1/learners/ST'), { wrong: ['q'], extra: 1 }));
  await assertFails(setDoc(doc(st, 'classes/C1/activities/A1/learners/ST'), { wrong: 'q' }));
  await assertFails(getDoc(doc(teacher('A'), 'classes/C1/activities/A1/learners/ST')), '교사도 학생 복습 목록은 안 읽는다');
});

test('결과 쓰기: 내 번호로 한 번만, 값이 규칙을 지킬 때만', async () => {
  const st = student('ST');
  await assertSucceeds(setDoc(doc(st, 'classes/C1/results/ST_run1'), result()));
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run1'), result({ quizCorrect: 3, coinsEarned: 30 })), '같은 판 번호로 다시 저장(덮어쓰기)은 거부 → 중복 저장·코인 중복 없음');
  await assertSucceeds(getDoc(doc(st, 'classes/C1/results/ST_run1')), '내 결과는 읽는다 (재시도 확인용)');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST2_run9'), result()), '남의 번호로 못 만든다');
  await assertFails(setDoc(doc(st, 'classes/C1/results/fake'), result()), 'uid로 시작하지 않는 번호 거부');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run2'), result({ studentUid: 'ST2' })), '남 이름으로 못 만든다');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run3'), result({ nickname: '다른이름' })), '닉네임은 내 학생 문서와 같아야');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run4'), result({ coinsEarned: 999 })), '얻은 코인 = 맞힌 수 × 10');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run5'), result({ coinsSpent: 30 })), '쓴 코인 ≤ 얻은 코인');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run6'), result({ quizCorrect: 5, coinsEarned: 50 })), '맞힌 수 ≤ 푼 수');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run7'), result({ answers: [ANS] })), '풀이 기록 수 = 푼 수');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run8'), result({ cleared: false })), 'cleared는 outcome과 일치');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_run9'), result({ activityId: 'NOPE' })), '없는 활동');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_runA'), result({ dungeon: 3 })), '던전 번호 범위');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_runB'), result({ outcome: 'won' })), 'outcome 값');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_runC'), result({ email: 'a@b.c' })), '정해지지 않은 필드');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_runD'), result({ createdAt: Timestamp.fromMillis(1) })), '저장 시각은 서버 시각');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_runE'), result({ outcome: 'failed', cleared: false })), 'failed인데 clearSec 있음');
  await assertSucceeds(setDoc(doc(st, 'classes/C1/results/ST_runF'), result({ outcome: 'failed', cleared: false, clearSec: null })));
  await assertSucceeds(setDoc(doc(st, 'classes/C1/results/ST_runG'), abandoned()), '중도 종료: 플레이 기록은 모두 null');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_runH'), abandoned({ hits: 0 })), '중도 종료인데 플레이 기록이 있음');
});

test('결과: 학생은 수정·삭제·남의 결과 읽기 불가, 소유 교사만 모두 읽고 지울 수 있고 만들 수 없다', async () => {
  const st = student('ST');
  await assertFails(updateDoc(doc(st, 'classes/C1/results/ST_old'), { quizCorrect: 99 }));
  await assertFails(deleteDoc(doc(st, 'classes/C1/results/ST_old')));
  await assertFails(getDoc(doc(st, 'classes/C1/results/ST2_old')), '남의 결과');
  await assertFails(getDocs(collection(st, 'classes/C1/results')), '목록 조회로 남의 결과 못 봄');
  await assertSucceeds(getDocs(query(collection(st, 'classes/C1/results'), where('studentUid', '==', 'ST'))), '내 결과만 묻는 조회는 된다');
  const a = teacher('A');
  await assertSucceeds(getDocs(collection(a, 'classes/C1/results')));
  await assertFails(getDocs(collection(teacher('B'), 'classes/C1/results')), '다른 교사는 결과를 못 읽음');
  await assertFails(setDoc(doc(a, 'classes/C1/results/A_fake'), result()), '교사도 결과를 만들 수 없음');
  await assertSucceeds(deleteDoc(doc(a, 'classes/C1/results/ST_old')));
});

test('학생 참여: 코드가 맞을 때 자기 문서만, 다시 쓰기 불가, 닉네임 1~10자', async () => {
  const nw = student('NEW');
  await assertSucceeds(setDoc(doc(nw, 'classes/C1/students/NEW'), { nickname: '바다', joinCode: '123456', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(nw, 'classes/C1/students/NEW'), { nickname: '바꿈', joinCode: '123456', joinedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(student('X'), 'classes/C1/students/X'), { nickname: 'x', joinCode: '999999', joinedAt: serverTimestamp() }));
  await assertFails(getDocs(collection(nw, 'joinCodes')));
  await assertFails(setDoc(doc(student('LONG'), 'classes/C1/students/LONG'), { nickname: '열한글자닉네임입니다요', joinCode: '123456', joinedAt: serverTimestamp() }), '닉네임 11자 거부');
});

test('교사: 활동 생성(대기만) → 시작(서버 시각) → 종료 시각 정하기 → 종료, 그 밖의 변경은 거부', async () => {
  const a = teacher('A');
  const b = writeBatch(a);
  b.set(doc(a, 'classes/C1/activities/A2'), newAct());
  b.set(doc(a, 'classes/C1/activities/A2/answerKey/main'), { answers: { q: 0 } });
  await assertSucceeds(b.commit());
  await assertFails(setDoc(doc(a, 'classes/C1/activities/A3'), newAct({ status: 'running' })), '처음부터 진행 중으로 못 만듦');
  await assertFails(setDoc(doc(teacher('B'), 'classes/C1/activities/A4'), newAct()), '다른 교사 학급에는 못 만듦');

  const ref = doc(a, 'classes/C1/activities/A2');
  await assertFails(updateDoc(ref, { status: 'running', startAt: Timestamp.fromMillis(5) }), '시작 시각은 서버 시각이어야');
  await assertFails(updateDoc(ref, { status: 'running', startAt: serverTimestamp(), title: '바꿈' }), '시작하면서 제목을 못 바꿈');
  await assertFails(updateDoc(doc(teacher('B'), 'classes/C1/activities/A2'), { status: 'running', startAt: serverTimestamp() }), '다른 교사는 시작 불가');
  await assertFails(updateDoc(doc(student('ST'), 'classes/C1/activities/A2'), { status: 'running', startAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: 'ended' }), '대기에서 바로 종료 불가');
  await assertSucceeds(updateDoc(ref, { status: 'running', startAt: serverTimestamp() }));

  const { startAt } = (await getDoc(ref)).data();
  await assertFails(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 10, startAt.nanoseconds) }), '전체 시간(300초)보다 짧은 종료 시각 거부');
  await assertFails(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 9999, startAt.nanoseconds) }), '너무 긴 종료 시각 거부');
  await assertSucceeds(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 300, startAt.nanoseconds) }));
  await assertFails(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 600, startAt.nanoseconds) }), '종료 시각을 다시 늘릴 수 없다');
  await assertFails(updateDoc(ref, { totalTimeSec: 1 }), '진행 중 전체 시간 변경 불가');
  await assertFails(updateDoc(ref, { questions: [{ id: 'z' }] }), '진행 중 문제 변경 불가');
  await assertSucceeds(updateDoc(ref, { status: 'ended' }));
  await assertFails(updateDoc(ref, { status: 'running' }), '끝난 활동은 다시 시작 불가');
  await assertFails(updateDoc(ref, { status: 'waiting' }), '대기로 되돌릴 수 없음');
  await assertFails(getDoc(doc(teacher('B'), 'classes/C1/activities/A1/answerKey/main')), '다른 교사는 정답표 못 읽음');
});
