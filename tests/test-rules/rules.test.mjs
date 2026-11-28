// firestore.rules를 실제 규칙 엔진(Firestore 에뮬레이터)에서 시험한다. 실행: Java + firebase-tools 필요 → npm run test:rules
// Cloud Functions 없이 학생 기기가 채점하고 결과를 직접 쓰는 구조라서, 결과·활동 시작·종료 규칙이 핵심이다.
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch, serverTimestamp, Timestamp, increment,
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
    // 골드 러시 활동과 진행 상황 (순위 읽기 시험용)
    await setDoc(doc(db, 'classes/C1/activities/GR'), { title: 'g', totalTimeSec: 60, status: 'running', mode: 'goldrush', questions: [{ id: 'q' }] });
    await setDoc(doc(db, 'classes/C1/activities/GR/progress/ST2'), { nickname: '바다', currentDungeon: null, clearedCount: 0, coins: 50 });
    await setDoc(doc(db, 'classes/C1/activities/A1/progress/ST2'), { nickname: '바다', currentDungeon: 0, clearedCount: 1, coins: 10 });
    // 학급 광산 시험용: M1은 8개 방을 다 깼고 M2는 3개
    await setDoc(doc(db, 'classes/C1/students/M1'), { nickname: '산', joinCode: '123456' });
    await setDoc(doc(db, 'classes/C1/students/M2'), { nickname: '강', joinCode: '123456' });
    await setDoc(doc(db, 'classes/C1/adventure/M1'), { nickname: '산', clearedCount: 8, gold: 0 });
    await setDoc(doc(db, 'classes/C1/adventure/M2'), { nickname: '강', clearedCount: 3, gold: 0 });
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

test('모험 기록(adventure): 본인만 쓰고 줄일 수 없다, 소유 교사는 읽는다', async () => {
  const st = student('ST');
  const adv = (o = {}) => ({ nickname: '하늘', clearedCount: 2, gold: 50, updatedAt: serverTimestamp(), ...o });
  await assertSucceeds(setDoc(doc(st, 'classes/C1/adventure/ST'), adv()));
  await assertSucceeds(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ clearedCount: 3, gold: 80 })), '늘리기는 된다');
  await assertFails(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ clearedCount: 1, gold: 80 })), '깬 방 수를 줄일 수 없다');
  await assertFails(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ clearedCount: 3, gold: 10 })), '골드를 줄일 수 없다');
  await assertFails(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ clearedCount: 9 })), '방은 8개까지');
  await assertFails(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ extra: 1 })), '정해지지 않은 필드');
  await assertFails(setDoc(doc(student('ST2'), 'classes/C1/adventure/ST'), adv({ clearedCount: 8 })), '남의 기록은 못 쓴다');
  await assertFails(getDoc(doc(student('ST2'), 'classes/C1/adventure/ST')), '남의 기록은 못 읽는다');
  await assertSucceeds(getDoc(doc(teacher('A'), 'classes/C1/adventure/ST')), '소유 교사는 읽는다');
  // 말랑이 꾸미기: 쓴 골드 ≤ 모은 골드, 쓴 골드는 줄일 수 없다
  await assertSucceeds(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ clearedCount: 3, gold: 80, spent: 60, owned: ['mint', 'none', 'pink'], look: { color: 'pink', hat: 'none' } })));
  await assertFails(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ clearedCount: 3, gold: 80, spent: 90, owned: [], look: {} })), '모은 골드보다 많이 쓸 수 없다');
  await assertFails(setDoc(doc(st, 'classes/C1/adventure/ST'), adv({ clearedCount: 3, gold: 80, spent: 0, owned: [], look: {} })), '쓴 골드를 줄일 수 없다 (공짜로 되돌리기 금지)');
  await assertFails(getDoc(doc(teacher('B'), 'classes/C1/adventure/ST')), '다른 교사는 못 읽는다');
});

test('학급 보물상자(chest): 교사가 목표를 정하고, 학생은 자기 쓴 골드만큼만 합계를 늘린다', async () => {
  const a = teacher('A');
  const chest = { goal: 300, reward: '자유 시간 5분', total: 0, history: [], updatedAt: serverTimestamp() };
  await assertFails(setDoc(doc(teacher('B'), 'classes/C1/chest/main'), chest), '다른 교사는 못 만든다');
  await assertFails(setDoc(doc(student('ST2'), 'classes/C1/chest/main'), chest), '학생은 못 만든다');
  await assertFails(setDoc(doc(a, 'classes/C1/chest/main'), { ...chest, goal: 0 }), '목표는 1 이상');
  await assertFails(setDoc(doc(a, 'classes/C1/chest/main'), { ...chest, reward: 'x'.repeat(41) }), '보상 40자까지');
  await assertFails(setDoc(doc(a, 'classes/C1/chest/other'), chest), '상자는 main 하나');
  await assertSucceeds(setDoc(doc(a, 'classes/C1/chest/main'), chest));
  const st = student('ST2');
  await assertSucceeds(getDoc(doc(st, 'classes/C1/chest/main')), '같은 학급 학생은 읽는다');
  await assertFails(getDoc(doc(student('OUT'), 'classes/C1/chest/main')), '학급 밖 학생은 못 읽는다');
  const adv = (o) => ({ nickname: '바다', clearedCount: 1, gold: 200, spent: 0, owned: [], look: {}, donated: 0, updatedAt: serverTimestamp(), ...o });
  const give = (db, amount, o) => {
    const b = writeBatch(db);
    b.set(doc(db, 'classes/C1/adventure/ST2'), adv(o));
    b.update(doc(db, 'classes/C1/chest/main'), { total: increment(amount), updatedAt: serverTimestamp() });
    return b.commit();
  };
  await assertSucceeds(give(st, 50, { spent: 50, donated: 50 }), '첫 기부: 넣은 골드 50 = 합계 +50');
  await assertFails(give(st, 100, { spent: 60, donated: 60 }), '합계 증가(100) ≠ 넣은 골드 증가(10)');
  await assertFails(give(st, 250, { spent: 300, donated: 300 }), '모은 골드(200)보다 많이 쓸 수 없다');
  await assertFails(updateDoc(doc(st, 'classes/C1/chest/main'), { total: increment(30) }), '모험 기록 없이 합계만 늘릴 수 없다');
  await assertFails(give(st, 0, { spent: 50, donated: 50 }), '0은 넣을 수 없다');
  await assertFails(updateDoc(doc(st, 'classes/C1/chest/main'), { goal: 1 }), '학생은 목표를 못 바꾼다');
  await assertSucceeds(give(st, 100, { spent: 150, donated: 150 }), '두 번째 기부');
  const after1 = (await getDoc(doc(a, 'classes/C1/chest/main'))).data();
  if (after1.total !== 150) throw new Error(`total ${after1.total}`);
  await assertFails(give(student('OUT'), 10, { spent: 10, donated: 10 }), '학급 밖 학생');
  await assertSucceeds(setDoc(doc(a, 'classes/C1/chest/main'), { goal: 500, reward: '영화', total: 0, history: [{ goal: 300, reward: '자유 시간 5분', total: 150, opened: false }], updatedAt: serverTimestamp() }), '교사가 다음 목표');
});

test('학급 광산(mine): 8개 방을 다 깬 학생만 캔 양을 늘리고, 완성되면 지원 코인 20을 결과에 쓸 수 있다', async () => {
  const m1 = student('M1');
  const m2 = student('M2');
  const ref = (db) => doc(db, 'classes/C1/activities/A1/mine/main');
  // 진행 상황에 inMine (광산 안 인원)
  await assertSucceeds(setDoc(doc(m1, 'classes/C1/activities/A1/progress/M1'), { nickname: '산', currentDungeon: null, clearedCount: 8, coins: 0, inMine: true, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(m1, 'classes/C1/activities/A1/progress/M1'), { nickname: '산', currentDungeon: null, clearedCount: 8, coins: 0, inMine: 'yes', updatedAt: serverTimestamp() }), 'inMine은 참/거짓');
  // 지원 코인은 광산이 완성되기 전에는 못 쓴다
  await assertFails(setDoc(doc(student('ST'), 'classes/C1/results/ST_sup0'), result({ supportCoins: 20, coinsSpent: 35 })), '광산이 없으면 지원 코인 불가');
  await assertFails(setDoc(ref(m2), { dug: 5, done: false, updatedAt: serverTimestamp() }), '다 깨지 못한 학생은 못 캔다');
  await assertFails(setDoc(ref(m1), { dug: 31, done: false, updatedAt: serverTimestamp() }), '한 번에 30까지');
  await assertFails(setDoc(ref(m1), { dug: 5, done: true, updatedAt: serverTimestamp() }), '처음부터 완성 불가');
  await assertSucceeds(setDoc(ref(m1), { dug: 5, done: false, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref(m1), { dug: increment(30), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(m1), { dug: increment(31) }), '한 번에 30까지');
  await assertFails(updateDoc(ref(m1), { dug: 1 }), '줄일 수 없다');
  await assertFails(updateDoc(ref(m1), { dug: increment(1), extra: 1 }), '정해지지 않은 필드');
  await assertFails(updateDoc(ref(m2), { dug: increment(1) }), '다 깨지 못한 학생은 못 캔다');
  await assertSucceeds(getDoc(ref(student('ST'))), '같은 학급 학생은 읽는다');
  await assertSucceeds(getDoc(ref(teacher('A'))), '소유 교사는 읽는다');
  await assertFails(getDoc(ref(student('OUT'))), '학급 밖 학생은 못 읽는다');
  await assertSucceeds(updateDoc(ref(m1), { done: true, updatedAt: serverTimestamp() }), '완성');
  await assertFails(updateDoc(ref(m1), { done: false }), '완성은 되돌릴 수 없다');
  // 결과: 지원 코인 20이면 쓴 코인 ≤ 얻은 코인 + 20
  const st = student('ST');
  await assertSucceeds(setDoc(doc(st, 'classes/C1/results/ST_sup1'), result({ supportCoins: 20, coinsSpent: 35 })), '20 + 20 ≥ 35');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_sup2'), result({ supportCoins: 10, coinsSpent: 25 })), '지원 코인은 0 또는 20');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_sup3'), result({ supportCoins: 20, coinsSpent: 45 })), '20 + 20 < 45');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_sup4'), result({ coinsSpent: 25 })), '지원 없이 얻은 코인보다 많이 쓸 수 없다');
});

test('골드 러시: 활동 종류(mode), 같은 학급 학생의 순위 읽기, goldrush 결과', async () => {
  const a = teacher('A');
  await assertSucceeds(setDoc(doc(a, 'classes/C1/activities/G1'), newAct({ mode: 'goldrush' })));
  await assertFails(setDoc(doc(a, 'classes/C1/activities/G2'), newAct({ mode: 'pvp' })), '정해진 종류만');
  await assertSucceeds(setDoc(doc(a, 'classes/C1/activities/G3'), newAct({ mode: 'adventure' })));
  const st = student('ST');
  await assertSucceeds(getDocs(collection(st, 'classes/C1/activities/GR/progress')), '골드 러시면 같은 학급 학생이 순위를 읽는다');
  await assertSucceeds(getDoc(doc(st, 'classes/C1/activities/A1/progress/ST2')), '보통 활동도 같은 학급이면 읽는다 (학급 광산 인원 — 2026-11-25)');
  await assertFails(getDocs(collection(student('OUT'), 'classes/C1/activities/GR/progress')), '학급 밖 학생은 못 읽는다');
  await assertFails(setDoc(doc(st, 'classes/C1/activities/GR/progress/ST2'), { nickname: '바다', currentDungeon: null, clearedCount: 0, coins: 0, updatedAt: serverTimestamp() }), '남의 골드는 못 바꾼다');
  await assertSucceeds(setDoc(doc(st, 'classes/C1/results/ST_rush1'), abandoned({ outcome: 'goldrush' })), 'goldrush 결과(플레이 기록 null)');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_rush2'), abandoned({ outcome: 'goldrush', hits: 1 })), 'goldrush인데 던전 플레이 기록이 있음');
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_rush3'), abandoned({ outcome: 'goldrush', coinsEarned: 999 })), '골드 = 맞힌 수 × 10');
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
  await assertFails(setDoc(doc(st, 'classes/C1/results/ST_runA'), result({ dungeon: 8 })), '방 번호 범위 (0~7)');
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
  // 대기 중 고치기 (2026-11-28): 제목·시간·문제·종류와 정답표를 함께
  const ed = writeBatch(a);
  ed.update(ref, { title: '고친 제목', totalTimeSec: 300, questions: [{ id: 'q' }, { id: 'q2' }], mode: 'goldrush' });
  ed.set(doc(a, 'classes/C1/activities/A2/answerKey/main'), { answers: { q: 0, q2: 1 } });
  await assertSucceeds(ed.commit(), '대기 중 활동 고치기');
  await assertFails(updateDoc(ref, { mode: 'pvp' }), '정해진 종류만');
  await assertFails(updateDoc(ref, { questions: [] }), '문제는 하나 이상');
  await assertFails(updateDoc(doc(teacher('B'), 'classes/C1/activities/A2'), { title: '남의 활동' }), '다른 교사는 못 고침');
  await assertFails(updateDoc(doc(student('ST'), 'classes/C1/activities/A2'), { title: '학생' }), '학생은 못 고침');
  await assertSucceeds(updateDoc(ref, { status: 'running', startAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { title: '진행 중 고치기' }), '시작한 활동은 못 고침');
  await assertFails(setDoc(doc(a, 'classes/C1/activities/A2/answerKey/main'), { answers: { q: 3 } }), '시작한 활동의 정답표는 못 바꿈');

  const { startAt } = (await getDoc(ref)).data();
  await assertFails(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 10, startAt.nanoseconds) }), '전체 시간(300초)보다 짧은 종료 시각 거부');
  await assertFails(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 9999, startAt.nanoseconds) }), '너무 긴 종료 시각 거부');
  await assertSucceeds(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 300, startAt.nanoseconds) }));
  await assertFails(updateDoc(ref, { endAt: new Timestamp(startAt.seconds + 600, startAt.nanoseconds) }), '종료 시각만 늘릴 수는 없다');
  // 시간 늘리기 (2026-11-28): 종료 시각과 전체 시간을 같은 만큼
  await assertSucceeds(updateDoc(ref, { totalTimeSec: 600, endAt: new Timestamp(startAt.seconds + 600, startAt.nanoseconds) }), '+5분');
  await assertFails(updateDoc(ref, { totalTimeSec: 900, endAt: new Timestamp(startAt.seconds + 1200, startAt.nanoseconds) }), '늘린 시간과 종료 시각이 다름');
  await assertFails(updateDoc(ref, { totalTimeSec: 2500, endAt: new Timestamp(startAt.seconds + 2500, startAt.nanoseconds) }), '한 번에 30분까지');
  await assertFails(updateDoc(ref, { totalTimeSec: 300, endAt: new Timestamp(startAt.seconds + 300, startAt.nanoseconds) }), '줄일 수 없다');
  await assertFails(updateDoc(doc(teacher('B'), 'classes/C1/activities/A2'), { totalTimeSec: 900, endAt: new Timestamp(startAt.seconds + 900, startAt.nanoseconds) }), '다른 교사는 못 늘림');
  await assertFails(updateDoc(ref, { totalTimeSec: 1 }), '진행 중 전체 시간 변경 불가');
  await assertFails(updateDoc(ref, { questions: [{ id: 'z' }] }), '진행 중 문제 변경 불가');
  await assertSucceeds(updateDoc(ref, { status: 'ended' }));
  await assertFails(updateDoc(ref, { status: 'running' }), '끝난 활동은 다시 시작 불가');
  await assertFails(updateDoc(ref, { status: 'waiting' }), '대기로 되돌릴 수 없음');
  await assertFails(getDoc(doc(teacher('B'), 'classes/C1/activities/A1/answerKey/main')), '다른 교사는 정답표 못 읽음');
});
