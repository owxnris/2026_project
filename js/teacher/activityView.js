// 진행 중 화면 (design.md): 참여 코드·남은 시간(큰 숫자), 시작 또는 종료 버튼(지금 누를 수 있는 하나만 주 버튼).
// 아래에 학생별 진행 상황·순위 표 (progress + 서버 결과)
import { showView } from './nav.js';
import {
  activityState, remainingSec, formatClock, otherRunning, STATUS_LABEL,
} from './activityRules.js';
import { serverNow, errorReason } from '../firebase/clock.js';
import { confirmDelete } from './confirmDialog.js';
import { onClassDataChange, getStudents, getResults } from './classHub.js';
import { ranking, filterResults } from './analysis.js';
import { message, renderTable } from './tableUtil.js';
import { DUNGEONS } from '../dungeons.js';

const $ = (id) => document.getElementById(id);

let store = null; // { start, end, getActivities, watchProgress }
let cls = null; // 학급 { id, name, joinCode }
let activityId = null;
let busy = false;
let progress = {};
let stopProgress = null;

// 학생별 진행 상황·순위 (design.md: 교실 화면에 띄우므로 본문 글자). 순위 기준(기본값): 깬 던전 수 → 맞힌 문제 수
function renderRanking() {
  if ($('activity-view').hidden || !cls) return;
  const box = $('av-ranking');
  const students = getStudents();
  if (students.length === 0) {
    message(box, '아직 참여한 학생이 없어요. 학생에게 참여 코드를 알려 주세요.');
    return;
  }
  const rows = ranking(filterResults(getResults(), activityId), students, progress);
  const where = (r) => {
    if (!progress[r.studentUid]) return '들어오기 전';
    return r.currentDungeon === null ? '월드맵' : (DUNGEONS[r.currentDungeon]?.name ?? '-');
  };
  renderTable(box, ['순위', '닉네임', '지금 위치', '깬 던전', '맞힌 문제'], rows.map((r) => [
    r.rank, r.nickname, where(r), `${r.clearedCount}개`, `${r.quizCorrect} / ${r.quizTotal}`,
  ]), { className: 'rank-table' });
}

const START_ERROR = {
  'already-running': (d) => `진행 중인 활동 '${d.title}'이(가) 있어요. 그 활동을 종료한 뒤 시작할 수 있어요.`,
  'not-waiting': () => '이미 시작했거나 끝난 활동이에요.',
};
const RULES_HINT = ' — Firestore 규칙이 최신으로 게시되었는지 확인해 주세요 (verification.md)';

function activity() {
  return store.getActivities().find((a) => a.id === activityId);
}

// 활동 목록 구독(activityTab)에서 받은 최신 값으로 1초마다 다시 그린다
function render() {
  const a = activity();
  if (!a) return;
  const state = activityState(a, serverNow());
  $('av-title').textContent = a.title;
  $('av-status').textContent = STATUS_LABEL[state];
  $('av-status').className = `small-text status-${state}`;
  $('av-code').textContent = cls.joinCode;
  const sec = state === 'ended' ? 0 : remainingSec(a, serverNow());
  $('av-time').textContent = formatClock(sec);
  $('av-time').classList.toggle('error', state === 'running' && sec <= 10);
  $('av-info').textContent = `문제 ${a.questions.length}개 · 전체 시간 ${a.totalTimeSec / 60}분`;
  $('av-start-btn').hidden = state !== 'waiting';
  $('av-end-btn').hidden = state !== 'running';
  $('av-start-btn').disabled = busy;
  $('av-end-btn').disabled = busy;
}

function failText(prefix, e) {
  const reason = errorReason(e);
  const known = START_ERROR[reason];
  if (known) return known(e.details || {});
  const hint = ['permission-denied', 'failed-precondition'].includes(reason) ? RULES_HINT : '';
  return `${prefix} (${reason})${hint}`;
}

async function onStart() {
  $('av-error').textContent = '';
  // 화면에서 먼저 확인 (startActivity도 한 번 더 확인한다)
  const other = otherRunning(store.getActivities(), activityId, serverNow());
  if (other) {
    $('av-error').textContent = START_ERROR['already-running'](other);
    return;
  }
  busy = true;
  render();
  try {
    await store.start(cls.id, activityId);
  } catch (e) {
    $('av-error').textContent = failText('활동을 시작하지 못했어요', e);
  } finally {
    busy = false;
    render();
  }
}

async function onEnd() {
  $('av-error').textContent = '';
  const ok = await confirmDelete('활동을 종료할까요? 학생들의 게임이 끝나고 최종 결과 화면으로 넘어가요.', '종료');
  if (!ok) return;
  busy = true;
  render();
  try {
    await store.end(cls.id, activityId);
  } catch (e) {
    $('av-error').textContent = failText('활동을 종료하지 못했어요', e);
  } finally {
    busy = false;
    render();
  }
}

export function openActivityView(c, id) {
  cls = c;
  activityId = id;
  progress = {};
  $('av-error').textContent = '';
  if (stopProgress) stopProgress();
  stopProgress = store.watchProgress(c.id, id, (p) => { progress = p; renderRanking(); });
  render();
  showView('activity');
  renderRanking();
}

export function closeActivityView() {
  if (stopProgress) stopProgress();
  stopProgress = null;
}

export function setupActivityView(s, backToClass) {
  store = s;
  $('av-start-btn').addEventListener('click', onStart);
  $('av-end-btn').addEventListener('click', onEnd);
  $('av-back-btn').addEventListener('click', () => { closeActivityView(); backToClass(); });
  onClassDataChange(renderRanking);
  setInterval(() => { if (!$('activity-view').hidden) render(); }, 1000);
}
