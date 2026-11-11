// 학급 화면 '활동' 탭 (design.md): 활동 표(제목·문제 수·전체 시간·상태) + 활동 만들기 양식(문제 고르기 표).
// 저장·구독 함수는 setupActivityTab에서 넘겨받는다 (store: { create, watch }).
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
    row.insertCell().textContent = a.title;
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
    message($('act-list'), `활동 목록을 불러오지 못했어요 (${e.code || e.message})`, 'error');
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
  picked.clear();
  $('act-title').value = '';
  $('act-minutes').value = '10';
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

function closeForm() {
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
    await store.create(target.id, {
      title,
      totalTimeSec: Number(minutes) * 60,
      picked: bank.filter((q) => picked.has(q.id)),
    });
    if (current === target) {
      closeForm();
      showNotice('저장했어요');
    }
  } catch (e) {
    $('act-save-error').textContent = `활동을 만들지 못했어요 (${e.code || e.message})`;
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
  $('act-add-btn').addEventListener('click', openForm);
  $('act-cancel-btn').addEventListener('click', closeForm);
  $('act-form').addEventListener('submit', onSave);
  // 종료 시각이 지난 활동을 '종료'로 바꿔 보이도록 1초마다 상태만 확인한다 (바뀐 게 있을 때만 다시 그림)
  setInterval(() => {
    const states = activities.map((a) => activityState(a, serverNow())).join();
    if (states !== shownStates) renderList();
  }, 1000);
}
