// 학급 화면 '결과' 탭 (design.md 결과 분석): 활동으로 거르기 → 학급 통계 → 학생별 결과(줄을 누르면 자세한 기록)
// → 문제별 정답률 → 개념별 오답(취약 개념). 값은 서버가 만든 결과(results)에서 계산한다.
import { onClassDataChange, getResults, getClassDataError, getStudents } from './classHub.js';
import {
  OUTCOME_LABEL, percent, filterResults, questionIndex, studentSummary, questionStats, conceptStats,
  classSummary, studentDetail, WEAK_MIN_TOTAL, WEAK_RATE, rateText, levelOf, levelDistribution, LEVEL_TEXT,
  studentFeedback, activityTrend, participation, supplementSummary, recommendQuestions, MIN_STUDENT_ANSWERS,
} from './analysis.js';
import { DUNGEONS } from '../dungeons.js';
import { message, renderTable } from './tableUtil.js';

const $ = (id) => document.getElementById(id);
let getActivities = () => [];
let getBank = () => []; // 내 문제은행 (추천 문제)
let makeActivity = () => {}; // (questionIds, title) → 활동 만들기 양식을 그 문제를 고른 채로 연다
let recommendIds = [];
let supplementIds = [];

function list(box, lines) {
  box.replaceChildren(...lines.map((l) => {
    const li = document.createElement('li');
    li.textContent = l.text ?? l;
    li.className = `small-text fb-${l.kind ?? 'info'}`;
    return li;
  }));
}
let selectedUid = null;

const abilityText = (ab) => {
  if (!ab) return '-';
  const parts = [];
  if (ab.dash) parts.push(`대시 ${ab.dash}`);
  if (ab.shield) parts.push('보호막');
  if (ab.doubleJump) parts.push('이단 점프');
  return parts.join(' · ') || '없음';
};
const orDash = (v, unit = '') => (v === null || v === undefined ? '-' : `${v}${unit}`);

function fillActivitySelect() {
  const select = $('r-activity');
  const selected = select.value;
  const acts = getActivities();
  select.replaceChildren(new Option('전체 활동', ''), ...acts.map((a) => new Option(a.title, a.id)));
  select.value = acts.some((a) => a.id === selected) ? selected : '';
}

function concepts(box, list) {
  if (list.length === 0) { message(box, '아직 푼 문제가 없어요.'); return; }
  renderTable(box, ['과목', '학습 개념', '푼 횟수', '틀린 횟수', '오답률', '틀린 학생', ''], list.map((c) => [
    c.subject, c.learningConcept, c.total, c.wrong, rateText(c.wrong, c.total), `${c.wrongStudents}명`,
    c.weak ? { text: '취약', className: 'weak' } : '',
  ]));
}

function renderDetail(results, qi) {
  const box = $('r-detail');
  const mine = results.filter((r) => r.studentUid === selectedUid);
  if (!selectedUid || mine.length === 0) { box.hidden = true; return; }
  box.hidden = false;
  const d = studentDetail(results, selectedUid, qi);
  const titles = Object.fromEntries(getActivities().map((a) => [a.id, a.title]));
  $('r-detail-name').textContent = `${mine[0].nickname} 자세한 기록`;
  renderTable($('r-runs'), ['활동', '던전', '결과', '맞힌 문제', '코인 얻음 · 씀', '능력', '충돌 · 추락', '클리어 시간'], d.runs.map((r) => [
    titles[r.activityId] ?? '(지워진 활동)',
    DUNGEONS[r.dungeon]?.name ?? r.dungeon,
    { text: OUTCOME_LABEL[r.outcome] ?? (r.cleared ? '클리어' : '실패'), className: `outcome-${r.outcome}` },
    `${r.quizCorrect} / ${r.quizTotal}`,
    `${r.coinsEarned} · ${orDash(r.coinsSpent)}`,
    abilityText(r.abilities),
    r.hits === null ? '-' : `${r.hits} · ${r.falls}`,
    orDash(r.clearSec, '초'),
  ]));
  concepts($('r-student-concepts'), d.concepts);

  // 맞춤 피드백 (규칙 기반, 이 학생의 실제 결과만). 피드백·활동별 변화는 활동 거르기와 상관없이 모든 활동 기준
  const fb = studentFeedback(getResults(), selectedUid, qi, getBank(), getActivities());
  list($('r-feedback'), fb.lines);
  const trend = activityTrend(getResults(), selectedUid, getActivities());
  if (trend.rows.length === 0) message($('r-trend'), '아직 기록이 없어요.');
  else {
    renderTable($('r-trend'), ['활동', '맞힌 문제', '정답률'], trend.rows.map((t) => [
      t.title, `${t.correct} / ${t.total}`, rateText(t.correct, t.total, 3),
    ]));
  }
  recommendIds = fb.recommend.map((q) => q.id);
  $('r-recommend-btn').hidden = recommendIds.length === 0;
  if (!fb.enough) message($('r-recommend'), '데이터가 부족해 추천할 수 없어요.');
  else if (fb.weak.length === 0) message($('r-recommend'), '취약 개념이 없어 추천할 문제가 없어요.');
  else if (recommendIds.length === 0) message($('r-recommend'), '내 문제은행에 취약 개념과 같은 개념의 문제가 없어요. 문제은행이나 공유 문제은행에서 문제를 더해 주세요.');
  else {
    renderTable($('r-recommend'), ['과목', '학습 개념', '문제'], fb.recommend.map((q) => [q.subject, q.learningConcept, q.question]));
  }
  if (d.wrongQuestions.length === 0) message($('r-wrong'), '틀린 문제가 없어요.');
  else {
    renderTable($('r-wrong'), ['과목', '학습 개념', '문제', '틀린 횟수', '마지막에 고른 답'], d.wrongQuestions.map((w) => [
      w.subject, w.learningConcept, w.question, w.count, w.lastChosen,
    ]));
  }
}

function render() {
  fillActivitySelect();
  const err = getClassDataError();
  if (err) { message($('r-students'), `결과를 불러오지 못했어요 (${err.code || err.message})`, 'error'); return; }
  const results = filterResults(getResults(), $('r-activity').value);
  const qi = questionIndex(getActivities());

  const s = classSummary(results);
  const clears = DUNGEONS.filter((dg) => dg.level).map((dg, i) => `${dg.name} ${s.clearsByDungeon[i]}명`).join(' · ');
  $('r-summary').textContent = results.length === 0 ? '' : `참여 학생 ${s.students}명 · 판 ${s.runs}개 · 푼 문제 ${s.quizTotal}개 · 평균 정답률 ${percent(s.rate)} · 클리어한 학생: ${clears}`;

  // 활동별 참여율·완료율 (활동 거르기와 상관없이 시작한 활동 모두)
  const part = participation(getResults(), getStudents().length, getActivities());
  if (part.length === 0) message($('r-participation'), '아직 시작한 활동이 없어요.');
  else {
    renderTable($('r-participation'), ['활동', '참여 학생', '참여율', '완료(클리어) 학생', '완료율'], part.map((p) => [
      p.title, `${p.joined} / ${p.studentCount}명`, p.joinRate === null ? '데이터 부족' : percent(p.joinRate),
      `${p.done}명`, p.doneRate === null ? '데이터 부족' : percent(p.doneRate),
    ]));
  }

  // 다음 수업 보충 학습 요약
  const sup = supplementSummary(results, qi);
  list($('r-supplement'), sup.lines.map((text) => ({ text, kind: sup.enough ? 'info' : 'lack' })));
  supplementIds = recommendQuestions(sup.weak, getBank(), new Map(), 10).map((q) => q.id);
  $('r-supplement-btn').hidden = supplementIds.length === 0;

  if (results.length === 0) {
    ['r-students', 'r-questions', 'r-concepts'].forEach((id) => message($(id), '아직 저장된 결과가 없어요. 학생이 던전 한 판을 끝내면 여기에 보여요.'));
    $('r-levels').textContent = '';
    $('r-detail').hidden = true;
    return;
  }
  const students = studentSummary(results);
  const dist = levelDistribution(students);
  $('r-levels').textContent = `학습 수준: 상 ${dist.상}명 · 중 ${dist.중}명 · 하 ${dist.하}명 · 데이터 부족 ${dist.부족}명 (푼 문제 ${MIN_STUDENT_ANSWERS}개 이상일 때 정답률 80%↑ 상, 50%↑ 중)`;
  renderTable($('r-students'), ['닉네임', '맞힌 문제', '정답률', '학습 수준', '클리어한 던전', '얻은 코인', '판 수'], students.map((st) => {
    const lv = levelOf(st.quizCorrect, st.quizTotal);
    return [
      st.nickname, `${st.quizCorrect} / ${st.quizTotal}`, rateText(st.quizCorrect, st.quizTotal, MIN_STUDENT_ANSWERS),
      lv ? { text: `${lv} (${LEVEL_TEXT[lv]})`, className: lv === '하' ? 'weak' : '' } : '데이터 부족',
      `${st.clearedCount}개`, st.coinsEarned, st.runs,
    ];
  }), { onRow: (i) => { selectedUid = students[i].studentUid; renderDetail(results, qi); $('r-detail').scrollIntoView?.({ block: 'nearest' }); } });
  renderDetail(results, qi);

  const qs = questionStats(results, qi);
  renderTable($('r-questions'), ['과목', '학습 개념', '문제', '푼 횟수', '정답률'], qs.map((q) => [
    q.subject, q.learningConcept, q.question, q.total, rateText(q.correct, q.total),
  ]));
  concepts($('r-concepts'), conceptStats(results, qi));
}

// activities: 지금 학급의 활동 목록을 돌려주는 함수, onActivities: 활동 목록이 바뀔 때 부를 함수를 등록
// bank: 내 문제은행을 돌려주는 함수, make(questionIds, title): 활동 만들기 양식을 그 문제를 고른 채로 연다
export function setupResultsTab(activities, onActivities, bank, make) {
  getActivities = activities;
  getBank = bank;
  makeActivity = make;
  $('r-recommend-btn').addEventListener('click', () => {
    const name = $('r-detail-name').textContent.replace(' 자세한 기록', '');
    makeActivity(recommendIds, `${name} 보충 활동`);
  });
  $('r-supplement-btn').addEventListener('click', () => makeActivity(supplementIds, '보충 학습 활동'));
  $('r-weak-rule').textContent = `취약: ${WEAK_MIN_TOTAL}번 이상 풀고 오답률 ${percent(WEAK_RATE)} 이상인 개념`;
  $('r-activity').addEventListener('change', () => { selectedUid = null; render(); });
  $('r-detail-close').addEventListener('click', () => { selectedUid = null; $('r-detail').hidden = true; });
  onClassDataChange(render);
  onActivities(render);
}

// 내 문제은행이 바뀌면 추천을 다시 계산한다
export function refreshResults() {
  render();
}

export function resetResultsTab() {
  selectedUid = null;
  $('r-activity').value = '';
}
