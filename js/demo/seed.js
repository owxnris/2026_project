// 체험 모드 처음 데이터: 체험 선생님의 문제은행·학급(참여 코드 111111)·가상 학생 4명·지난 활동 결과·오늘 활동(대기)·공유 문제.
// 결과는 실제 게임이 만드는 것과 같은 모양(grading.js buildResult)이라 결과 탭 분석이 그대로 동작한다.
import { activityQuestion, answerKeyOf } from '../teacher/activityRules.js';
import { buildResult } from '../grading.js';

export const DEMO_CODE = '111111';
const T = 'demo-teacher';
const C = 'demo-class';

// 체험 선생님이 직접 만든 문제 (공유하기 버튼을 바로 써 볼 수 있게)
const OWN = [
  { id: 'my1', subject: '정보', difficulty: '하', learningConcept: '알고리즘', question: '순서대로 하는 일의 차례를 무엇이라 하나요?', choices: ['알고리즘', '데이터', '변수', '반복'], answer: 0 },
  { id: 'my2', subject: '수학', difficulty: '중', learningConcept: '분수', question: '1/2 + 1/4 은?', choices: ['2/6', '3/4', '1/8', '2/4'], answer: 1 },
];
// 다른 선생님이 공유 문제은행에 올려 둔 문제 (가져오기를 써 볼 수 있게)
const SHARED = [
  { subject: '과학', difficulty: '하', learningConcept: '광합성', question: '광합성이 주로 일어나는 곳은?', choices: ['뿌리', '잎', '줄기', '꽃'], answer: 1 },
  { subject: '사회', difficulty: '중', learningConcept: '삼권 분립', question: '법을 만드는 권한을 가진 곳은?', choices: ['정부', '법원', '국회', '헌법재판소'], answer: 2 },
];
// 가상 학생: 이름과 맞히는 경향(문제 번호마다 정답이면 1) — 학습 수준이 상·중·하·데이터 부족으로 고루 보이게
const STUDENTS = [
  { uid: 'demo-s1', nickname: '하늘', pattern: [1, 1, 1, 1, 1, 0, 1, 1] },
  { uid: 'demo-s2', nickname: '바다', pattern: [1, 0, 0, 1, 0, 0, 1, 0] },
  { uid: 'demo-s3', nickname: '별', pattern: [1, 1, 0, 1, 1, 0, 1, 0] },
  { uid: 'demo-s4', nickname: '구름', pattern: [1, 0, 1] },
];

export async function seed({ docs, Timestamp }) {
  let defaults = [];
  try { defaults = await (await fetch('questions.json')).json(); } catch { /* 기본 문제 없이 */ }
  const now = Date.now();
  const ts = (ms) => Timestamp.fromMillis(ms);
  const put = (path, data) => docs.set(path, data);

  put(`teachers/${T}`, { name: '체험', email: 'demo@dungeon-dash.example', shareName: '체험 선생님', createdAt: ts(now) });
  const bank = [...defaults.map((q) => ({ ...q, source: 'default' })), ...OWN.map((q) => ({ ...q, source: 'teacher' }))];
  bank.forEach(({ id, ...q }) => put(`teachers/${T}/questions/${id}`, { ...q, updatedAt: ts(now) }));
  SHARED.forEach((q, i) => put(`sharedQuestions/demo-shared-${i + 1}`, {
    ...q, ownerUid: 'demo-other', authorName: '과학 선생님', sharedAt: ts(now - 86400000), updatedAt: ts(now - 86400000),
  }));

  put(`classes/${C}`, { ownerUid: T, name: '체험 학급 (5학년 1반)', joinCode: DEMO_CODE, createdAt: ts(now - 7 * 86400000) });
  put(`joinCodes/${DEMO_CODE}`, { classId: C, ownerUid: T });
  STUDENTS.forEach((s, i) => put(`classes/${C}/students/${s.uid}`, { nickname: s.nickname, joinCode: DEMO_CODE, joinedAt: ts(now - 7 * 86400000 + i * 60000) }));

  // 지난 활동(종료)과 가상 학생 결과
  const pastQs = bank.slice(0, 8);
  const pastStart = now - 2 * 86400000;
  put(`classes/${C}/activities/demo-past`, {
    title: '지난 수업: 복습 퀴즈', totalTimeSec: 600, status: 'ended', startAt: ts(pastStart), endAt: ts(pastStart + 600000),
    questions: pastQs.map(activityQuestion), createdAt: ts(pastStart - 600000),
  });
  put(`classes/${C}/activities/demo-past/answerKey/main`, { answers: answerKeyOf(pastQs) });
  STUDENTS.forEach((s) => {
    const clearedRooms = new Set();
    let gold = 0;
    // 판 하나에 문제 3~4개씩
    for (let start = 0, run = 0; start < s.pattern.length; start += 4, run += 1) {
      const attempts = s.pattern.slice(start, start + 4).map((ok, k) => {
        const q = pastQs[(start + k) % pastQs.length];
        return { questionId: q.id, learningConcept: q.learningConcept, chosen: ok ? q.answer : (q.answer + 1) % 4, correct: !!ok, quizType: 'entry' };
      });
      const correct = attempts.filter((a) => a.correct).length;
      const cleared = correct >= 3;
      const spent = correct >= 2 ? 15 : 0;
      const result = buildResult({
        run: { studentUid: s.uid, dungeon: run % 3, coinsEarned: correct * 10 },
        attempts,
        student: { nickname: s.nickname },
        activityId: 'demo-past',
        outcome: cleared ? 'cleared' : 'failed',
        stats: {
          abilities: { dash: 0, shield: spent > 0, doubleJump: false }, coinsSpent: spent, dashesUsed: 0,
          hits: cleared ? 1 : 3, falls: cleared ? 0 : 1, clearSec: cleared ? 60 + run * 20 : null,
        },
      });
      put(`classes/${C}/results/${s.uid}_past${run}`, { ...result, createdAt: ts(pastStart + 60000 * (run + 1)) });
      gold += correct * 10;
      if (cleared) clearedRooms.add(run % 3);
    }
    // 모험 기록: 위 결과와 맞게 (앞에서부터 이어서 깬 방 수, 골드 = 정답 × 10) — 학생 탭이 결과 탭과 같은 이야기를 하도록
    let clearedCount = 0;
    while (clearedRooms.has(clearedCount)) clearedCount += 1;
    put(`classes/${C}/adventure/${s.uid}`, {
      nickname: s.nickname, clearedCount, gold, spent: 0, owned: ['mint', 'none'], look: { color: 'mint', hat: 'none' }, donated: 0, updatedAt: ts(pastStart + 600000),
    });
  });

  // 오늘 활동(대기): 교사 탭에서 '시작'을 누르면 학생 탭이 월드맵으로 넘어간다
  const todayQs = bank.slice(0, 10);
  put(`classes/${C}/activities/demo-now`, {
    title: '체험 활동: 오늘의 퀴즈', totalTimeSec: 600, status: 'waiting', startAt: null, endAt: null,
    questions: todayQs.map(activityQuestion), createdAt: ts(now),
  });
  put(`classes/${C}/activities/demo-now/answerKey/main`, { answers: answerKeyOf(todayQs) });

  // 골드 러시 이벤트(대기): 시작하면 학생 탭이 이벤트 화면으로 — 시간 안에 퀴즈로 골드 모으기
  put(`classes/${C}/activities/demo-rush`, {
    title: '골드 러시: 5분 퀴즈 대결', totalTimeSec: 300, status: 'waiting', startAt: null, endAt: null,
    questions: todayQs.map(activityQuestion), createdAt: ts(now - 1000), mode: 'goldrush',
  });
  put(`classes/${C}/activities/demo-rush/answerKey/main`, { answers: answerKeyOf(todayQs) });

  // 학급 보물상자: 교사가 정한 첫 목표 (학생들이 골드를 넣어 채운다)
  put(`classes/${C}/chest/main`, { goal: 500, reward: '다 함께 자유 시간 5분', total: 0, history: [], updatedAt: ts(now - 1000) });
}
