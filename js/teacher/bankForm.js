// 문제 추가·수정 양식 (design.md 문제 추가·수정 양식).
// 학습 개념은 고른 과목에서 이미 쓴 개념 중에 고르거나, '새 개념 입력'으로 직접 적는다.
import {
  SUBJECTS, DIFFICULTIES, DIFFICULTY_HINT, conceptsOf, normalizeConcept, findSameConcept, validateQuestion,
} from './bankRules.js';

const $ = (id) => document.getElementById(id);
const NEW_CONCEPT = '__new__';
const FIELDS = ['subject', 'difficulty', 'learningConcept', 'question', 'choices', 'answer'];

let getQuestions = () => [];
let actions = null; // { add(fields), update(id, fields), onSaved(message), onToggle(open) }
let editingId = null; // null이면 새 문제

function choiceInputs() {
  return [...document.querySelectorAll('#q-form [data-choice]')];
}
function answerRadios() {
  return [...document.querySelectorAll('#q-form input[name="q-answer"]')];
}

function setOptions(select, placeholder, items) {
  select.replaceChildren(new Option(placeholder, ''), ...items.map(([value, label]) => new Option(label, value)));
}

// 과목에 맞게 학습 개념 목록을 다시 만든다. 고르던 개념이 새 목록에 있으면 그대로 둔다.
function fillConcepts(selected = $('q-concept').value) {
  const subject = $('q-subject').value;
  const select = $('q-concept');
  if (!subject) {
    setOptions(select, '과목을 먼저 고르세요', []);
    select.disabled = true;
  } else {
    const concepts = conceptsOf(getQuestions(), subject);
    setOptions(select, '학습 개념 선택', [...concepts.map((c) => [c, c]), [NEW_CONCEPT, '새 개념 입력']]);
    select.disabled = false;
    if ([...select.options].some((o) => o.value === selected)) select.value = selected;
  }
  toggleNewConcept();
}

function toggleNewConcept() {
  const isNew = $('q-concept').value === NEW_CONCEPT;
  $('q-new-concept-field').hidden = !isNew;
  if (!isNew) $('q-new-concept').value = '';
}

function clearErrors() {
  FIELDS.forEach((f) => { document.querySelector(`#q-form [data-error="${f}"]`).textContent = ''; });
  document.querySelectorAll('#q-form .invalid').forEach((el) => el.classList.remove('invalid'));
  $('q-save-error').textContent = '';
}

function showErrors(errors) {
  FIELDS.forEach((f) => {
    if (errors[f]) document.querySelector(`#q-form [data-error="${f}"]`).textContent = errors[f];
  });
  if (errors.subject) $('q-subject').classList.add('invalid');
  if (errors.difficulty) $('q-difficulty').classList.add('invalid');
  if (errors.learningConcept) {
    ($('q-concept').value === NEW_CONCEPT ? $('q-new-concept') : $('q-concept')).classList.add('invalid');
  }
  if (errors.question) $('q-question').classList.add('invalid');
  (errors.emptyChoices || []).forEach((i) => choiceInputs()[i].classList.add('invalid'));
}

// 양식 값 읽기 (앞뒤 공백 제거). 새로 적은 개념이 이미 있는 개념과 같으면 그 개념으로 맞춘다.
function readForm() {
  const subject = $('q-subject').value;
  const isNew = $('q-concept').value === NEW_CONCEPT;
  let learningConcept = isNew ? normalizeConcept($('q-new-concept').value) : $('q-concept').value;
  let mergedInto = null;
  if (isNew && learningConcept) {
    mergedInto = findSameConcept(getQuestions(), subject, learningConcept);
    if (mergedInto) learningConcept = mergedInto;
  }
  const checked = answerRadios().find((r) => r.checked);
  return {
    fields: {
      subject,
      difficulty: $('q-difficulty').value,
      learningConcept,
      question: $('q-question').value.trim(),
      choices: choiceInputs().map((input) => input.value.trim()),
      answer: checked ? Number(checked.value) : null,
    },
    mergedInto,
  };
}

async function onSubmit(event) {
  event.preventDefault();
  clearErrors();
  const { fields, mergedInto } = readForm();
  const errors = validateQuestion(fields);
  if (Object.keys(errors).length > 0) {
    showErrors(errors);
    return;
  }

  $('q-save-btn').disabled = true;
  try {
    if (editingId) await actions.update(editingId, fields);
    else await actions.add(fields);
    closeForm();
    actions.onSaved(mergedInto ? `이미 있는 개념 '${mergedInto}'(으)로 저장했어요` : '저장했어요');
  } catch (e) {
    $('q-save-error').textContent = `문제를 저장하지 못했어요 (${e.code || e.message})`;
  } finally {
    $('q-save-btn').disabled = false;
  }
}

// q가 있으면 수정, 없으면 새 문제
export function openForm(q = null) {
  editingId = q ? q.id : null;
  clearErrors();
  $('q-form-title').textContent = q ? '문제 수정' : '문제 추가';
  $('q-subject').value = q ? q.subject : '';
  $('q-difficulty').value = q ? q.difficulty : '';
  fillConcepts(q ? q.learningConcept : '');
  $('q-question').value = q ? q.question : '';
  choiceInputs().forEach((input, i) => { input.value = q ? q.choices[i] : ''; });
  answerRadios().forEach((r) => { r.checked = q ? Number(r.value) === q.answer : false; });
  $('q-form').hidden = false;
  actions.onToggle(true);
  $('q-subject').focus();
}

export function closeForm() {
  editingId = null;
  $('q-form').hidden = true;
  actions.onToggle(false);
}

export function isEditing(id) {
  return !$('q-form').hidden && editingId === id;
}

// 문제은행이 바뀌면(실시간) 열린 양식의 개념 목록도 맞춘다
export function refreshConcepts() {
  if (!$('q-form').hidden) fillConcepts();
}

export function setupBankForm(questionsGetter, formActions) {
  getQuestions = questionsGetter;
  actions = formActions;
  setOptions($('q-subject'), '과목 선택', SUBJECTS.map((s) => [s, s]));
  setOptions($('q-difficulty'), '난이도 선택', DIFFICULTIES.map((d) => [d, d]));
  $('q-hint').textContent = DIFFICULTY_HINT;
  $('q-subject').addEventListener('change', () => fillConcepts());
  $('q-concept').addEventListener('change', () => {
    toggleNewConcept();
    if ($('q-concept').value === NEW_CONCEPT) $('q-new-concept').focus();
  });
  $('q-cancel-btn').addEventListener('click', closeForm);
  $('q-form').addEventListener('submit', onSubmit);
}
