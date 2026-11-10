// 문제은행 화면 (design.md 문제은행): 거르기 줄(과목·난이도·학습 개념·검색), 문제 표, 수정·삭제.
// Firestore 저장 함수는 main.js에서 넘겨받는다 (store: { add, update, remove, importDefaults }).
import {
  SUBJECTS, DIFFICULTIES, conceptFilterOptions, filterQuestions,
} from './bankRules.js';
import {
  setupBankForm, openForm, closeForm, isEditing, refreshConcepts,
} from './bankForm.js';
import { confirmDelete } from './confirmDialog.js';

const $ = (id) => document.getElementById(id);
const COLUMNS = ['과목', '난이도', '학습 개념', '문제', '정답', ''];

let questions = [];
let loaded = false;
let store = null;
let noticeTimer = null;

function message(text, className) {
  const p = document.createElement('p');
  p.className = `small-text ${className}`;
  p.textContent = text;
  $('q-list').replaceChildren(p);
}

function showNotice(text) {
  clearTimeout(noticeTimer);
  $('bank-notice').textContent = text;
  noticeTimer = setTimeout(() => { $('bank-notice').textContent = ''; }, 2000);
}

function currentFilter() {
  return {
    subject: $('f-subject').value,
    difficulty: $('f-difficulty').value,
    concept: $('f-concept').value,
    keyword: $('f-keyword').value,
  };
}

// 과목에 맞게 학습 개념 거르기 목록을 다시 만든다. 고르던 개념이 사라지면 '전체'로
function fillConceptFilter() {
  const select = $('f-concept');
  const selected = select.value;
  const options = conceptFilterOptions(questions, $('f-subject').value);
  select.replaceChildren(new Option('전체', ''), ...options.map((o) => new Option(o.label, o.value)));
  select.value = options.some((o) => o.value === selected) ? selected : '';
}

function textButton(label, onClick, danger = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = danger ? 'link-btn danger' : 'link-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function onDelete(q) {
  const ok = await confirmDelete(`'${q.question}' 문제를 삭제할까요? 이미 만든 활동에는 남아 있어요.`);
  if (!ok) return;
  try {
    await store.remove(q.id);
    if (isEditing(q.id)) closeForm();
    showNotice('삭제했어요');
  } catch (e) {
    $('bank-error').textContent = `문제를 삭제하지 못했어요 (${e.code || e.message})`;
  }
}

function render() {
  if (!loaded) return;
  if (questions.length === 0) {
    message('아직 문제가 없어요. 문제 추가를 눌러 첫 문제를 만들어 보세요.', 'muted');
    return;
  }
  const shown = filterQuestions(questions, currentFilter());
  if (shown.length === 0) {
    message('조건에 맞는 문제가 없어요. 거르기나 검색어를 바꿔 보세요.', 'muted');
    return;
  }

  const table = document.createElement('table');
  table.className = 'table';
  const head = table.createTHead().insertRow();
  COLUMNS.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  });
  const body = table.createTBody();
  shown.forEach((q) => {
    const row = body.insertRow();
    row.dataset.questionId = q.id;
    [q.subject, q.difficulty, q.learningConcept, q.question, q.choices[q.answer]].forEach((value) => {
      row.insertCell().textContent = value ?? '';
    });
    const actionsCell = row.insertCell();
    actionsCell.className = 'row-actions';
    actionsCell.append(textButton('수정', () => openForm(q)), textButton('삭제', () => onDelete(q), true));
  });
  $('q-list').replaceChildren(table);
}

// 기본 문제 불러오기: questions.json(기능 시험용 예시)을 내 문제은행에 넣는다. 이미 있는 문제는 건너뛴다.
async function onImportDefaults() {
  $('bank-error').textContent = '';
  $('q-import-btn').disabled = true;
  try {
    const res = await fetch('questions.json');
    if (!res.ok) throw new Error(`questions.json ${res.status}`);
    const { added, skipped } = await store.importDefaults(await res.json());
    showNotice(added > 0
      ? `기본 문제 ${added}개를 불러왔어요${skipped > 0 ? ` (이미 있는 ${skipped}개는 건너뜀)` : ''}`
      : '기본 문제가 이미 모두 있어요');
  } catch (e) {
    $('bank-error').textContent = `기본 문제를 불러오지 못했어요 (${e.code || e.message})`;
  } finally {
    $('q-import-btn').disabled = false;
  }
}

// 실시간 구독에서 받은 내 문제 목록
export function setQuestions(list) {
  questions = list;
  loaded = true;
  fillConceptFilter();
  refreshConcepts();
  render();
}

export function showBankLoading() {
  loaded = false;
  questions = [];
  $('bank-error').textContent = '';
  message('불러오는 중…', 'muted');
}

export function showBankError(error) {
  message(`문제은행을 불러오지 못했어요 (${error.code || error.message})`, 'error');
}

// 로그아웃할 때: 양식을 닫고 목록을 비운다
export function resetBank() {
  closeForm();
  questions = [];
  loaded = false;
  $('q-list').replaceChildren();
}

export function setupBank(bankStore) {
  store = bankStore;
  $('f-subject').replaceChildren(new Option('전체', ''), ...SUBJECTS.map((s) => new Option(s, s)));
  $('f-difficulty').replaceChildren(new Option('전체', ''), ...DIFFICULTIES.map((d) => new Option(d, d)));
  fillConceptFilter();
  $('f-subject').addEventListener('change', () => { fillConceptFilter(); render(); });
  $('f-difficulty').addEventListener('change', render);
  $('f-concept').addEventListener('change', render);
  $('f-keyword').addEventListener('input', render);

  setupBankForm(() => questions, {
    add: (fields) => store.add(fields),
    update: (id, fields) => store.update(id, fields),
    onSaved: showNotice,
    onToggle: (open) => { $('q-add-btn').hidden = open; },
  });
  $('q-import-btn').addEventListener('click', onImportDefaults);
  $('q-add-btn').addEventListener('click', () => {
    $('bank-error').textContent = '';
    openForm();
  });
}
