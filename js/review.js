// 학생 맞춤 복습 (2026-11-18, 12-9): 이번 활동에서 푼 문제 기록으로 한마디·다시 볼 개념·틀린 문제를 만든다 (순수 함수, 규칙 기반).
// 기록은 학생 기기 안의 것만 쓴다(state.reviewLog) — 선생님 화면의 분석과 같은 기준을 아이 눈높이 말로 바꾼 것. 시험: tests/test/review.test.js
// log 항목: { id, subject, concept, question, choices, chosen(0~3|null=시간 초과), correctIndex, correct }
export const REVIEW_MIN = 3; // 이보다 적게 풀었으면 수준을 말하지 않는다 (지어내지 않기)

export function reviewSummary(log) {
  const total = log.length;
  const correct = log.filter((a) => a.correct).length;
  const rate = total ? correct / total : 0;
  let message;
  let tone = 'info';
  if (total < REVIEW_MIN) message = `문제를 ${REVIEW_MIN}개 이상 풀면 복습할 곳을 알려 줄게요`;
  else if (rate >= 0.8) { message = `정답률 ${Math.round(rate * 100)}% — 아주 잘했어요! 틀린 문제만 한 번 더 보면 완벽해요`; tone = 'good'; }
  else if (rate >= 0.5) message = `정답률 ${Math.round(rate * 100)}% — 잘하고 있어요. 아래 개념을 한 번 더 복습해요`;
  else { message = `정답률 ${Math.round(rate * 100)}% — 아래 개념을 차근차근 다시 공부해 봐요`; tone = 'bad'; }

  // 다시 볼 개념: 틀린 횟수가 많은 순 (과목 + 개념)
  const byConcept = new Map();
  log.forEach((a) => {
    const key = `${a.subject ?? ''}|${a.concept ?? ''}`;
    const c = byConcept.get(key) || { subject: a.subject, concept: a.concept, wrong: 0, total: 0 };
    c.total += 1;
    if (!a.correct) c.wrong += 1;
    byConcept.set(key, c);
  });
  const weakConcepts = [...byConcept.values()].filter((c) => c.wrong > 0 && c.concept)
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total).slice(0, 3);

  // 틀린 문제: 같은 문제는 한 번만 (마지막에 고른 답), 최근 것부터
  const seen = new Set();
  const wrongQuestions = [];
  [...log].reverse().forEach((a) => {
    if (a.correct || seen.has(a.id)) return;
    seen.add(a.id);
    wrongQuestions.push({
      question: a.question,
      answer: a.choices?.[a.correctIndex] ?? '',
      chosen: a.chosen === null || a.chosen === undefined ? '시간 초과' : (a.choices?.[a.chosen] ?? ''),
      concept: a.concept,
    });
  });
  return { total, correct, rate, message, tone, weakConcepts, wrongQuestions };
}
