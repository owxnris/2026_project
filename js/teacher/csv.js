// 결과 CSV 내려받기 (교사 결과 탭). 엑셀에서 한글이 깨지지 않게 UTF-8 BOM을 붙인다.
// 표 만들기는 순수 함수라 node --test로 시험한다 (tests/test/csv.test.js)
import { studentSummary, levelOf } from './analysis.js';

const OUTCOME = { cleared: '클리어', failed: '실패', abandoned: '중도 종료' };

// 칸에 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다. 엑셀이 수식으로 읽지 않게 =,+,-,@로 시작하는 글은 앞에 '를 붙인다
function cell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, rows) {
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '');

// 학생별 요약: 한 학생 한 줄
export function studentsCsv(results) {
  const rows = studentSummary(results).map((st) => [
    st.nickname, st.quizCorrect, st.quizTotal, pct(st.quizCorrect, st.quizTotal),
    levelOf(st.quizCorrect, st.quizTotal) ?? '데이터 부족', st.clearedCount, st.coinsEarned, st.runs,
  ]);
  return toCsv(['닉네임', '맞힌 문제', '푼 문제', '정답률', '학습 수준', '클리어한 던전', '얻은 코인', '판 수'], rows);
}

// 판별 기록: 던전 한 판 한 줄 (저장된 순서)
export function runsCsv(results, activities, dungeonNames) {
  const titleOf = new Map(activities.map((a) => [a.id, a.title]));
  const sorted = [...results].sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  const rows = sorted.map((r) => [
    r.nickname, titleOf.get(r.activityId) ?? '(지운 활동)', dungeonNames[r.dungeon] ?? r.dungeon, OUTCOME[r.outcome] ?? r.outcome,
    r.quizCorrect, r.quizTotal, pct(r.quizCorrect, r.quizTotal), r.coinsEarned, r.coinsSpent, r.hits, r.falls, r.clearSec,
    (r.wrongConcepts || []).join(' / '),
    r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString('ko-KR') : '',
  ]);
  return toCsv(['닉네임', '활동', '던전', '결과', '맞힌 문제', '푼 문제', '정답률', '얻은 코인', '쓴 코인', '충돌', '추락', '클리어 시간(초)', '틀린 개념', '저장 시각'], rows);
}

// 브라우저에서 파일로 내려받기
export function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
