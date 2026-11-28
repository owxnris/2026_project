// 학급 화면 '활동' 탭 (design.md): 활동 표(제목·문제 수·전체 시간·상태) + 활동 만들기 양식(문제 고르기 표).
// 저장·구독 함수는 setupActivityTab에서 넘겨받는다 (store: { create, watch }).
import { reasonText } from '../firebase/errors.js';
import {
  SUBJECTS, DIFFICULTIES, conceptFilterOptions, filterQuestions,
} from './bankRules.js';
import { validateActivity, activityState, STATUS_LABEL } from './activityRules.js';
import { serverNow } from '../firebase/clock.js';

const $ = (id) => document.getElementById(id);

let store = null;
let onOpenActivity = null;
let current = null; // 지금 연 학급 { id, name, joinCode }
let activities = [];
let stopWatch = null;
let bank = []; // 내 문제은행 (main.js가 넘겨준다)
const picked = new Set(); // 고른 문제 id
let editing = null; // 고치는 중인 대기 활동 id (null이면 새로 만들기)
let noticeTimer = null;
let shownStates = '';

function message(box, text, className) {
  const p = document.createElement('p');
  p.className = `small-text ${className}`;
  p.textContent = text;
  box.replaceChildren(p);
}

function showNotice(text) {
  clearTimeout(noticeTimer);
  $('act-notice').textContent = text;
  noticeTimer = setTimeout(() => { $('act-notice').textContent = ''; }, 2000);
}

function table(headers) {
  const t = document.createElement('table');
  t.className = 'table';
  const head = t.createTHead().insertRow();
  headers.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  });
  return t;
}

// ── 활동 표 ──
function renderList() {
  const box = $('act-list');
  if (activities.length === 0) {
    message(box, '아직 활동이 없어요. 활동 만들기를 눌러 문제와 전체 시간을 정해 보세요.', 'muted');
    return;
  }
  const t = table(['제목', '문제 수', '전체 시간', '상태']);
  const body = t.createTBody();
  const now = serverNow();
  shownStates = activities.map((a) => activityState(a, now)).join();
  activities.forEach((a) => {
    const row = body.insertRow();
    row.className = 'clickable';
    row.tabIndex = 0;
    row.dataset.activityId = a.id;
    const open = () => onOpenActivity(current, a.id);
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    row.insertCell().textContent = a.mode === 'goldrush' ? `[골드 러시] ${a.title}` : a.title;
    row.insertCell().textContent = `${a.questions.length}개`;
    row.insertCell().textContent = `${a.totalTimeSec / 60}분`;
    const state = activityState(a, now);
    const cell = row.insertCell();
    cell.textContent = STATUS_LABEL[state];
    cell.className = `status-${state}`;
  });
  box.replaceChildren(t);
}

export function getActivities() {
  return activities;
}

// 활동 목록이 바뀔 때 알려 준다 (결과 탭의 활동 거르기, 진행 중 화면)
const changeListeners = new Set();
export function onActivitiesChange(fn) {
  changeListeners.add(fn);
}

// 학급 화면을 열 때마다 부른다: 그 학급의 활동만 구독한다
export function showActivities(c) {
  stopActivities();
  current = c;
  activities = [];
  closeForm();
  $('act-error').textContent = '';
  message($('act-list'), '불러오는 중…', 'muted');
  stopWatch = store.watch(c.id, (list) => {
    activities = list;
    renderList();
    changeListeners.forEach((fn) => fn());
  }, (e) => {
    message($('act-list'), `활동 목록을 불러오지 못했어요 (${reasonText(e)})`, 'error');
  });
}

export function stopActivities() {
  if (stopWatch) stopWatch();
  stopWatch = null;
}

// ── 활동 만들기 양식 ──
export function setActivityBank(list) {
  bank = list;
  const ids = new Set(list.map((q) => q.id));
  [...picked].forEach((id) => { if (!ids.has(id)) picked.delete(id); }); // 문제은행에서 지운 문제는 고른 목록에서도 뺀다
  if (!$('act-form').hidden) { fillConceptFilter(); renderPicker(); }
}

function filter() {
  return { subject: $('a-subject').value, difficulty: $('a-difficulty').value, concept: $('a-concept').value, keyword: '' };
}

function fillConceptFilter() {
  const select = $('a-concept');
  const selected = select.value;
  const options = conceptFilterOptions(bank, $('a-subject').value);
  select.replaceChildren(new Option('전체', ''), ...options.map((o) => new Option(o.label, o.value)));
  select.value = options.some((o) => o.value === selected) ? selected : '';
}

function renderPicker() {
  $('act-picked').textContent = `고른 문제 ${picked.size}개`;
  const box = $('act-q-list');
  if (bank.length === 0) {
    message(box, '문제은행에 문제가 없어요. 문제은행 메뉴에서 문제를 먼저 만들어 주세요.', 'muted');
    return;
  }
  const list = filterQuestions(bank, filter());
  if (list.length === 0) {
    message(box, '조건에 맞는 문제가 없어요', 'muted');
    return;
  }
  const t = table(['고르기', '과목', '난이도', '학습 개념', '문제']);
  const body = t.createTBody();
  list.forEach((q) => {
    const row = body.insertRow();
    const box2 = document.createElement('input');
    box2.type = 'checkbox';
    box2.checked = picked.has(q.id);
    box2.dataset.questionId = q.id;
    box2.setAttribute('aria-label', `'${q.question}' 고르기`);
    box2.addEventListener('change', () => {
      if (box2.checked) picked.add(q.id); else picked.delete(q.id);
      $('act-picked').textContent = `고른 문제 ${picked.size}개`;
    });
    row.insertCell().appendChild(box2);
    row.insertCell().textContent = q.subject;
    row.insertCell().textContent = q.difficulty;
    row.insertCell().textContent = q.learningConcept;
    row.insertCell().textContent = q.question;
  });
  box.replaceChildren(t);
}

function clearErrors() {
  document.querySelectorAll('[data-act-error]').forEach((el) => { el.textContent = ''; });
  ['act-title', 'act-minutes'].forEach((id) => $(id).classList.remove('invalid'));
  $('act-save-error').textContent = '';
}

function openForm() {
  editing = null;
  $('act-form-title').textContent = '활동 만들기';
  $('act-save-btn').textContent = '저장';
  picked.clear();
  $('act-title').value = '';
  $('act-minutes').value = '10';
  $('act-mode').value = 'adventure';
  $('a-subject').value = '';
  $('a-difficulty').value = '';
  clearErrors();
  fillConceptFilter();
  renderPicker();
  $('act-form').hidden = false;
  $('act-add-btn').hidden = true; // 양식이 열려 있는 동안 주 버튼은 '만들기' 하나
  $('act-title').focus();
}

// 결과 탭의 추천에서: 활동 만들기 양식을 그 문제를 고른 채로 연다 (문제은행에 있는 문제만)
export function openFormWith(questionIds, title) {
  openForm();
  const ids = new Set(bank.map((q) => q.id));
  questionIds.filter((id) => ids.has(id)).forEach((id) => picked.add(id));
  $('act-title').value = title;
  renderPicker();
}

// 진행 중 화면의 '수정'에서: 대기 중 활동을 양식에 채워 연다. 문제은행에 없는 문제(지워진 문제)는 고를 수 없어 빠진다
export function openEditForm(a) {
  openForm();
  editing = a.id;
  $('act-form-title').textContent = '활동 고치기';
  $('act-save-btn').textContent = '고친 내용 저장';
  $('act-title').value = a.title;
  $('act-minutes').value = String(Math.round(a.totalTimeSec / 60));
  $('act-mode').value = a.mode === 'goldrush' ? 'goldrush' : 'adventure';
  const ids = new Set(bank.map((q) => q.id));
  const keep = (a.questions ?? []).map((q) => q.id).filter((id) => ids.has(id));
  keep.forEach((id) => picked.add(id));
  const gone = (a.questions ?? []).length - keep.length;
  $('act-save-error').textContent = gone ? `문제은행에서 지운 문제 ${gone}개는 빠졌어요. 저장하면 빠진 채로 바뀌어요.` : '';
  renderPicker();
}

function closeForm() {
  editing = null;
  $('act-form').hidden = true;
  $('act-add-btn').hidden = false;
}

async function onSave(event) {
  event.preventDefault();
  clearErrors();
  const title = $('act-title').value.trim();
  const minutes = $('act-minutes').value;
  const errors = validateActivity({ title, minutes, pickedCount: picked.size });
  if (errors.title) $('act-title').classList.add('invalid');
  if (errors.minutes) $('act-minutes').classList.add('invalid');
  Object.entries(errors).forEach(([k, msg]) => { document.querySelector(`[data-act-error="${k}"]`).textContent = msg; });
  if (Object.keys(errors).length) return;

  const target = current;
  $('act-save-btn').disabled = true;
  try {
    const data = {
      title,
      totalTimeSec: Number(minutes) * 60,
      picked: bank.filter((q) => picked.has(q.id)),
      mode: $('act-mode').value,
    };
    const wasEditing = editing;
    if (wasEditing) await store.update(target.id, wasEditing, data);
    else await store.create(target.id, data);
    if (current === target) {
      closeForm();
      showNotice(wasEditing ? '고친 내용을 저장했어요' : '저장했어요');
    }
  } catch (e) {
    const what = editing ? '활동을 고치지 못했어요' : '활동을 만들지 못했어요';
    $('act-save-error').textContent = e?.reason === 'not-waiting' ? '이미 시작한 활동은 고칠 수 없어요' : `${what} (${reasonText(e)})`;
  } finally {
    $('act-save-btn').disabled = false;
  }
}

// openActivity(c, activityId): 활동 줄을 눌렀을 때 (진행 중 화면 열기)
export function setupActivityTab(s, openActivity) {
  store = s;
  onOpenActivity = openActivity;
  $('a-subject').replaceChildren(new Option('전체', ''), ...SUBJECTS.map((x) => new Option(x, x)));
  $('a-difficulty').replaceChildren(new Option('전체', ''), ...DIFFICULTIES.map((x) => new Option(x, x)));
  $('a-subject').addEventListener('change', () => { fillConceptFilter(); renderPicker(); });
  $('a-difficulty').addEventListener('change', renderPicker);
  $('a-concept').addEventListener('change', renderPicker);
  // 한꺼번에 고르기: 지금 거르기(과목·난이도·개념)에 보이는 문제 기준. '하/중/상 모두'는 보이는 문제 중 그 난이도만 더한다
  document.querySelectorAll('[data-bulk]').forEach((btn) => btn.addEventListener('click', () => {
    const list = filterQuestions(bank, filter());
    const kind = btn.dataset.bulk;
    if (kind === 'none') picked.clear();
    else list.filter((q) => kind === 'all' || q.difficulty === kind).forEach((q) => picked.add(q.id));
    renderPicker();
  }));
  $('act-add-btn').addEventListener('click', openForm);
  $('act-cancel-btn').addEventListener('click', closeForm);
  $('act-form').addEventListener('submit', onSave);
  // 종료 시각이 지난 활동을 '종료'로 바꿔 보이도록 1초마다 상태만 확인한다 (바뀐 게 있을 때만 다시 그림)
  setInterval(() => {
    const states = activities.map((a) => activityState(a, serverNow())).join();
    if (states !== shownStates) renderList();
  }, 1000);
}
