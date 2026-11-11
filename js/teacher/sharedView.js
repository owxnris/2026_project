// 공유 문제은행 화면: 공유 이름, 거르기(과목·난이도·학습 개념·검색·내가 공유한 문제), 공유 문제 표,
// 미리보기(보기·정답), 가져오기(내 문제은행으로 복사), 내가 공유한 문제는 공유 취소.
// Firestore 함수는 setupSharedView에서 넘겨받는다 (store: { watch, getName, setName, importItem, unshare, myQuestions })
import { reasonText } from '../firebase/errors.js';
import {
  SUBJECTS, DIFFICULTIES, conceptFilterOptions, filterQuestions,
} from './bankRules.js';
import { confirmDelete } from './confirmDialog.js';
import { ShareError } from './sharedBank.js';

const $ = (id) => document.getElementById(id);
let store = null;
let items = [];
let loaded = false;
let preview = null; // 미리보기를 연 공유 문제 id
let stop = null;
let myUid = null;
let noticeTimer = null;

function showNotice(text) {
  clearTimeout(noticeTimer);
  $('shared-notice').textContent = text;
  noticeTimer = setTimeout(() => { $('shared-notice').textContent = ''; }, 2000);
}

function message(text, cls = 'muted') {
  const p = document.createElement('p');
  p.className = `small-text ${cls}`;
  p.textContent = text;
  $('shared-list').replaceChildren(p);
}

function fillConcepts() {
  const sel = $('s-concept');
  const v = sel.value;
  const opts = conceptFilterOptions(items, $('s-subject').value);
  sel.replaceChildren(new Option('전체', ''), ...opts.map((o) => new Option(o.label, o.value)));
  sel.value = opts.some((o) => o.value === v) ? v : '';
}

function textButton(label, onClick, cls = 'link-btn') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function errorText(e) {
  return e instanceof ShareError ? e.message : `처리하지 못했어요 (${reasonText(e)})`;
}

async function onImport(item) {
  $('shared-error').textContent = '';
  try {
    const { mergedConcept } = await store.importItem(item, store.myQuestions());
    showNotice(mergedConcept
      ? `내 문제은행으로 가져왔어요 (이미 있는 개념 '${mergedConcept}'(으)로)`
      : '내 문제은행으로 가져왔어요 — 활동 만들기에서 바로 고를 수 있어요');
    render();
  } catch (e) {
    $('shared-error').textContent = errorText(e);
  }
}

async function onUnshare(item) {
  const ok = await confirmDelete(`'${item.question}' 공유를 취소할까요? 다른 선생님이 이미 가져간 문제는 그대로 남아요.`, '공유 취소');
  if (!ok) return;
  try {
    await store.unshare(item, store.myQuestions());
    showNotice('공유를 취소했어요');
  } catch (e) {
    $('shared-error').textContent = errorText(e);
  }
}

function previewRow(body, item, cols) {
  const row = body.insertRow();
  row.className = 'preview-row';
  const cell = row.insertCell();
  cell.colSpan = cols;
  const q = document.createElement('p');
  q.className = 'body-text';
  q.textContent = item.question;
  const list = document.createElement('ol');
  list.className = 'preview-choices';
  item.choices.forEach((c, i) => {
    const li = document.createElement('li');
    li.textContent = i === item.answer ? `${c} (정답)` : c;
    if (i === item.answer) li.className = 'answer';
    list.appendChild(li);
  });
  const meta = document.createElement('p');
  meta.className = 'small-text muted';
  meta.textContent = `${item.subject} · 난이도 ${item.difficulty} · ${item.learningConcept} · 출처: ${item.authorName}`;
  cell.append(q, list, meta);
}

function render() {
  if (!loaded) return;
  const mineOnly = $('s-mine').value === 'mine';
  const list = filterQuestions(items, {
    subject: $('s-subject').value, difficulty: $('s-difficulty').value, concept: $('s-concept').value, keyword: $('s-keyword').value,
  }).filter((it) => !mineOnly || it.ownerUid === myUid);
  if (items.length === 0) { message('아직 공유된 문제가 없어요. 문제은행에서 내 문제의 \'공유\'를 눌러 올려 보세요.'); return; }
  if (list.length === 0) { message('조건에 맞는 공유 문제가 없어요. 거르기나 검색어를 바꿔 보세요.'); return; }
  const imported = new Set(store.myQuestions().map((q) => q.origin?.sharedId).filter(Boolean));
  const headers = ['과목', '난이도', '학습 개념', '문제', '출처', ''];
  const t = document.createElement('table');
  t.className = 'table';
  const head = t.createTHead().insertRow();
  headers.forEach((h) => { const th = document.createElement('th'); th.textContent = h; head.appendChild(th); });
  const body = t.createTBody();
  list.forEach((it) => {
    const row = body.insertRow();
    row.dataset.sharedId = it.id;
    const mine = it.ownerUid === myUid;
    [it.subject, it.difficulty, it.learningConcept, it.question, mine ? `${it.authorName} (나)` : it.authorName]
      .forEach((v) => { row.insertCell().textContent = v; });
    const actions = row.insertCell();
    actions.className = 'row-actions';
    actions.append(textButton(preview === it.id ? '닫기' : '미리보기', () => { preview = preview === it.id ? null : it.id; render(); }));
    if (mine) actions.append(textButton('공유 취소', () => onUnshare(it), 'link-btn danger'));
    else if (imported.has(it.id)) actions.append(textButton('가져옴', () => {}, 'link-btn muted'));
    else actions.append(textButton('가져오기', () => onImport(it)));
    if (preview === it.id) previewRow(body, it, headers.length);
  });
  $('shared-list').replaceChildren(t);
}

async function onSaveName(event) {
  event.preventDefault();
  $('share-name-error').textContent = '';
  $('share-name').classList.remove('invalid');
  try {
    $('share-name').value = await store.setName($('share-name').value);
    showNotice('저장했어요');
  } catch (e) {
    $('share-name').classList.add('invalid');
    $('share-name-error').textContent = errorText(e);
  }
}

// 로그인하면 시작, 로그아웃 전에 멈춘다
export function startShared(uid) {
  stopShared();
  myUid = uid;
  loaded = false;
  message('불러오는 중…');
  store.getName().then((n) => { $('share-name').value = n; }).catch(() => {});
  stop = store.watch((list) => {
    items = list;
    loaded = true;
    fillConcepts();
    render();
  }, (e) => message(`공유 문제은행을 불러오지 못했어요 (${reasonText(e)})`, 'error'));
}

export function stopShared() {
  if (stop) stop();
  stop = null;
}

// 내 문제은행이 바뀌면 '가져옴' 표시를 다시 그린다
export function refreshShared() {
  render();
}

export function setupSharedView(s) {
  store = s;
  $('s-subject').replaceChildren(new Option('전체', ''), ...SUBJECTS.map((x) => new Option(x, x)));
  $('s-difficulty').replaceChildren(new Option('전체', ''), ...DIFFICULTIES.map((x) => new Option(x, x)));
  $('s-subject').addEventListener('change', () => { fillConcepts(); render(); });
  ['s-difficulty', 's-concept', 's-mine'].forEach((id) => $(id).addEventListener('change', render));
  $('s-keyword').addEventListener('input', render);
  $('share-name-form').addEventListener('submit', onSaveName);
}
