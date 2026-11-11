// 학급 화면 '결과' 탭 (design.md 결과 분석): 활동으로 거르기 → 학급 통계 → 학생별 결과(줄을 누르면 자세한 기록)
// → 문제별 정답률 → 개념별 오답(취약 개념). 값은 서버가 만든 결과(results)에서 계산한다.
import { onClassDataChange, getResults, getClassDataError } from './classHub.js';
import {
  OUTCOME_LABEL, percent, filterResults, questionIndex, studentSummary, questionStats, conceptStats,
  classSummary, studentDetail, WEAK_MIN_TOTAL, WEAK_RATE,
} from './analysis.js';
import { DUNGEONS } from '../dungeons.js';
import { message, renderTable } from './tableUtil.js';

const $ = (id) => document.getElementById(id);
let getActivities = () => [];
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
    c.subject, c.learningConcept, c.total, c.wrong, percent(c.wrongRate), `${c.wrongStudents}명`,
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

  if (results.length === 0) {
    ['r-students', 'r-questions', 'r-concepts'].forEach((id) => message($(id), '아직 저장된 결과가 없어요. 학생이 던전 한 판을 끝내면 여기에 보여요.'));
    $('r-detail').hidden = true;
    return;
  }
  const students = studentSummary(results);
  renderTable($('r-students'), ['닉네임', '맞힌 문제', '정답률', '클리어한 던전', '얻은 코인', '판 수'], students.map((st) => [
    st.nickname, `${st.quizCorrect} / ${st.quizTotal}`, percent(st.rate), `${st.clearedCount}개`, st.coinsEarned, st.runs,
  ]), { onRow: (i) => { selectedUid = students[i].studentUid; renderDetail(results, qi); $('r-detail').scrollIntoView?.({ block: 'nearest' }); } });
  renderDetail(results, qi);

  const qs = questionStats(results, qi);
  renderTable($('r-questions'), ['과목', '학습 개념', '문제', '푼 횟수', '정답률'], qs.map((q) => [
    q.subject, q.learningConcept, q.question, q.total, percent(q.rate),
  ]));
  concepts($('r-concepts'), conceptStats(results, qi));
}

// activities: 지금 학급의 활동 목록을 돌려주는 함수, onActivities: 활동 목록이 바뀔 때 부를 함수를 등록
export function setupResultsTab(activities, onActivities) {
  getActivities = activities;
  $('r-weak-rule').textContent = `취약: ${WEAK_MIN_TOTAL}번 이상 풀고 오답률 ${percent(WEAK_RATE)} 이상인 개념`;
  $('r-activity').addEventListener('change', () => { selectedUid = null; render(); });
  $('r-detail-close').addEventListener('click', () => { selectedUid = null; $('r-detail').hidden = true; });
  onClassDataChange(render);
  onActivities(render);
}

export function resetResultsTab() {
  selectedUid = null;
  $('r-activity').value = '';
}
