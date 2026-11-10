// 문제은행 규칙 (spec.md '문제은행 규칙'): 과목·난이도 목록, 학습 개념 중복 방지, 저장 검사, 거르기·검색.
// 화면이나 Firebase에 기대지 않는 함수만 둔다. 활동 만들기(5단계)와 학습 분석(8단계)도 같은 목록을 쓴다.

export const SUBJECTS = [
  '수학', '과학', '국어', '사회', '영어', '상식', '도덕', '역사', '음악', '미술', '체육', '실과', '정보',
];
export const DIFFICULTIES = ['하', '중', '상'];
export const DIFFICULTY_HINT = '하: 외운 것 하나로 바로 답함 · 중: 개념 하나를 적용함 · 상: 여러 지식을 함께 따짐 (걸치면 높은 쪽)';

// 앞뒤 공백을 지우고 여러 칸 띄어쓰기를 한 칸으로
export function normalizeConcept(text) {
  return text.trim().replace(/\s+/g, ' ');
}

// 띄어쓰기·영문 대소문자를 무시한 비교용 값
function conceptKey(text) {
  return text.replace(/\s+/g, '').toLowerCase();
}

// 내 문제은행에서 그 과목에 쓰인 학습 개념 (가나다순, 중복 없이)
export function conceptsOf(questions, subject) {
  const set = new Set(questions.filter((q) => q.subject === subject).map((q) => q.learningConcept));
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

// 같은 과목에 띄어쓰기·대소문자만 다른 개념이 이미 있으면 그 개념, 없으면 null
export function findSameConcept(questions, subject, concept) {
  const key = conceptKey(concept);
  return conceptsOf(questions, subject).find((c) => conceptKey(c) === key) ?? null;
}

// 저장 검사. q는 앞뒤 공백을 지운 값. 잘못된 칸마다 안내 글을 담아 돌려준다 (빈 객체면 통과).
// 보기끼리 글이 같은 것은 막지 않는다.
export function validateQuestion(q) {
  const errors = {};
  if (!SUBJECTS.includes(q.subject)) errors.subject = '과목을 골라 주세요.';
  if (!DIFFICULTIES.includes(q.difficulty)) errors.difficulty = '난이도를 골라 주세요.';
  if (!q.learningConcept) errors.learningConcept = '학습 개념을 고르거나 새로 입력해 주세요.';
  if (!q.question) errors.question = '문제를 입력해 주세요.';
  const emptyChoices = q.choices.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (q.choices.length !== 4 || emptyChoices.length > 0) {
    errors.choices = '보기 4개를 모두 입력해 주세요.';
    errors.emptyChoices = emptyChoices;
  }
  if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3)) errors.answer = '정답 보기를 하나 골라 주세요.';
  return errors;
}

// 학습 개념 거르기 값: 과목이 다르면 같은 이름이라도 다른 개념이다
export function conceptFilterValue(subject, concept) {
  return `${subject}\n${concept}`;
}

// 과목 → 그 과목의 개념, 과목이 '전체'('')면 모든 과목의 개념. [{ value, label }]
export function conceptFilterOptions(questions, subject) {
  const subjects = subject ? [subject] : SUBJECTS;
  return subjects.flatMap((s) => conceptsOf(questions, s).map((c) => ({
    value: conceptFilterValue(s, c),
    label: subject ? c : `${s} · ${c}`,
  })));
}

// filter: { subject, difficulty, concept, keyword } — 빈 값은 '전체'. 모두 맞는 문제만 남긴다.
export function filterQuestions(questions, filter) {
  const keyword = filter.keyword.trim().toLowerCase();
  return questions.filter((q) => (!filter.subject || q.subject === filter.subject)
    && (!filter.difficulty || q.difficulty === filter.difficulty)
    && (!filter.concept || conceptFilterValue(q.subject, q.learningConcept) === filter.concept)
    && (!keyword || q.question.toLowerCase().includes(keyword)));
}
