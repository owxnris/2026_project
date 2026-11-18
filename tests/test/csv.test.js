// 결과 CSV(js/teacher/csv.js) 시험
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, studentsCsv, runsCsv } from '../../js/teacher/csv.js';

const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const ans = (correct) => ({ questionId: 'q', learningConcept: '곱셈', chosen: correct ? 1 : 0, correct, quizType: 'entry' });
const R = (o) => ({
  studentUid: 'S1', nickname: '하늘', activityId: 'A1', dungeon: 0, outcome: 'cleared', cleared: true,
  quizCorrect: 2, quizTotal: 3, answers: [ans(true), ans(true), ans(false)], wrongConcepts: ['곱셈'],
  coinsEarned: 20, coinsSpent: 15, hits: 1, falls: 0, clearSec: 42, createdAt: ts(2000), ...o,
});

test('toCsv: BOM, 따옴표·쉼표 감싸기, 수식처럼 시작하는 글 막기', () => {
  const s = toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=SUM(A1)', 5]]);
  assert.ok(s.startsWith('﻿a,b\r\n'));
  assert.ok(s.includes('"x,y","say ""hi"""'));
  assert.ok(s.includes("'=SUM(A1),5"));
});

test('학생별 요약: 학생마다 한 줄, 정답률·학습 수준', () => {
  const rows = studentsCsv([R(), R({ createdAt: ts(3000), quizCorrect: 3, quizTotal: 3, answers: [ans(true), ans(true), ans(true)], coinsEarned: 30 }),
    R({ studentUid: 'S2', nickname: '바다', quizCorrect: 0, quizTotal: 1, answers: [ans(false)], coinsEarned: 0, outcome: 'failed', cleared: false })])
    .replace('﻿', '').trim().split('\r\n');
  assert.equal(rows.length, 3);
  const h = rows.find((r) => r.startsWith('하늘'));
  assert.ok(h.startsWith('하늘,5,6,83%,상'), h);
  assert.ok(rows.find((r) => r.startsWith('바다')).includes('데이터 부족'));
});

test('판별 기록: 저장 순서, 활동 제목·던전 이름·결과 글자, 지운 활동 표시', () => {
  const rows = runsCsv([R({ createdAt: ts(5000), activityId: 'GONE' }), R({ outcome: 'abandoned', cleared: false, clearSec: null })],
    [{ id: 'A1', title: '1차 퀴즈' }], ['잊혀진 숲', '용암 광산', '얼어붙은 성']).replace('﻿', '').trim().split('\r\n');
  assert.equal(rows.length, 3);
  assert.ok(rows[1].startsWith('하늘,1차 퀴즈,잊혀진 숲,중도 종료,2,3,67%'), rows[1]);
  assert.ok(rows[2].includes('(지운 활동)'));
});
