// 학습 활동 규칙 (순수 함수): 저장 검사, 문제 복사(정답 분리), 화면에 보일 상태, 남은 시간 표시.

// 활동 문서에 복사하는 문제 필드 — 정답(answer)은 넣지 않는다 (학생이 활동 문서를 읽기 때문)
export const ACTIVITY_QUESTION_KEYS = ['id', 'subject', 'difficulty', 'learningConcept', 'question', 'choices'];

export const STATUS_LABEL = { waiting: '대기', running: '진행 중', ended: '종료' };

// 문제은행 문제(id 포함) → 활동 문서 문제
export function activityQuestion(q) {
  return Object.fromEntries(ACTIVITY_QUESTION_KEYS.map((k) => [k, q[k]]));
}

// 문제은행 문제들 → 정답표 { questionId: 정답 번호 }
export function answerKeyOf(questions) {
  return Object.fromEntries(questions.map((q) => [q.id, q.answer]));
}

// 어기면 { 칸 이름: 안내 } (모두 맞으면 빈 객체)
export function validateActivity({ title, minutes, pickedCount }) {
  const errors = {};
  if (!title.trim()) errors.title = '활동 제목을 입력해 주세요.';
  const m = Number(minutes);
  if (String(minutes).trim() === '' || !Number.isInteger(m) || m < 1) errors.minutes = '전체 시간을 1분 이상 정수로 입력해 주세요.';
  if (pickedCount === 0) errors.questions = '문제를 하나 이상 골라 주세요.';
  return errors;
}

// 화면에 보일 상태. 종료 시각이 지난 'running'은 끝난 활동으로 본다 (학생 게임도 같은 기준)
export function activityState(a, nowMs) {
  if (a.status === 'running' && a.endAt && a.endAt.toMillis() <= nowMs) return 'ended';
  return a.status;
}

export function remainingSec(a, nowMs) {
  if (!a.endAt) return a.totalTimeSec;
  return Math.max(0, Math.ceil((a.endAt.toMillis() - nowMs) / 1000));
}

export function formatClock(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// 이 학급에서 지금 진행 중인 다른 활동 (없으면 null)
export function otherRunning(activities, activityId, nowMs) {
  return activities.find((a) => a.id !== activityId && activityState(a, nowMs) === 'running') || null;
}
