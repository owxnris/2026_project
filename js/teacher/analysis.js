// 결과 분석 (순수 함수): 학급 결과(results)를 교사 화면에서 모아 계산한다 (따로 저장하지 않는다 — spec.md 학습 분석)
// 과목은 결과에 없으므로 결과의 activityId로 그 활동의 문제 사본에서 찾는다.

export const OUTCOME_LABEL = { cleared: '클리어', failed: '실패', abandoned: '중도 종료' };

// 취약 개념 기준 (기본값, spec.md): 푼 횟수 3번 이상이고 오답률 50% 이상
export const WEAK_MIN_TOTAL = 3;
export const WEAK_RATE = 0.5;

const rate = (part, total) => (total ? part / total : 0);
export const percent = (r) => `${Math.round(r * 100)}%`;
const byNickname = (a, b) => a.nickname.localeCompare(b.nickname, 'ko');

export function filterResults(results, activityId) {
  return activityId ? results.filter((r) => r.activityId === activityId) : results;
}

// `${activityId}\n${questionId}` → 문제 사본 { subject, learningConcept, question, choices }
export function questionIndex(activities) {
  const map = new Map();
  activities.forEach((a) => a.questions.forEach((q) => map.set(`${a.id}\n${q.id}`, q)));
  return map;
}

// 결과의 문제 기록 하나하나 (과목·문제 글을 붙여서)
function answerRows(results, qIndex) {
  return results.flatMap((r) => r.answers.map((a) => {
    const q = qIndex.get(`${r.activityId}\n${a.questionId}`);
    return { ...a, studentUid: r.studentUid, subject: q?.subject ?? '(알 수 없음)', text: q?.question ?? '(지워진 활동의 문제)', choices: q?.choices };
  }));
}

// 한 활동 안에서 학생마다 깬 던전 수 (같은 던전을 여러 번 깨도 하나)
function clearedSets(results) {
  const map = new Map();
  results.filter((r) => r.outcome === 'cleared' || (r.outcome === undefined && r.cleared))
    .forEach((r) => {
      if (!map.has(r.studentUid)) map.set(r.studentUid, new Set());
      map.get(r.studentUid).add(`${r.activityId}\n${r.dungeon}`);
    });
  return map;
}

// 학생별: 맞힌 수·푼 수·정답률·깬 던전 수·얻은 코인·판 수
export function studentSummary(results) {
  const cleared = clearedSets(results);
  const map = new Map();
  results.forEach((r) => {
    const s = map.get(r.studentUid) || {
      studentUid: r.studentUid, nickname: r.nickname, quizCorrect: 0, quizTotal: 0, coinsEarned: 0, runs: 0,
    };
    s.nickname = r.nickname || s.nickname;
    s.quizCorrect += r.quizCorrect;
    s.quizTotal += r.quizTotal;
    s.coinsEarned += r.coinsEarned;
    s.runs += 1;
    map.set(r.studentUid, s);
  });
  return [...map.values()]
    .map((s) => ({ ...s, rate: rate(s.quizCorrect, s.quizTotal), clearedCount: cleared.get(s.studentUid)?.size ?? 0 }))
    .sort(byNickname);
}

// 진행 중 화면 순위 (기본값, spec.md): 깬 던전 수 → 맞힌 문제 수. 둘 다 같으면 같은 순위
// students: [{ id, nickname }] — 아직 결과가 없는 학생도 0으로 넣는다. progress: { [uid]: { currentDungeon } }
export function ranking(results, students, progress = {}) {
  const sum = new Map(studentSummary(results).map((s) => [s.studentUid, s]));
  const rows = students.map((st) => {
    const s = sum.get(st.id);
    return {
      studentUid: st.id,
      nickname: st.nickname,
      clearedCount: s?.clearedCount ?? 0,
      quizCorrect: s?.quizCorrect ?? 0,
      quizTotal: s?.quizTotal ?? 0,
      currentDungeon: progress[st.id]?.currentDungeon ?? null,
      joined: !!progress[st.id] || !!s,
    };
  });
  rows.sort((a, b) => b.clearedCount - a.clearedCount || b.quizCorrect - a.quizCorrect || byNickname(a, b));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.clearedCount === r.clearedCount && prev.quizCorrect === r.quizCorrect ? prev.rank : i + 1;
  });
  return rows;
}

// 문제별 정답률 (문제은행 id 기준으로 합침). 정답률 낮은 순
export function questionStats(results, qIndex) {
  const map = new Map();
  answerRows(results, qIndex).forEach((a) => {
    const s = map.get(a.questionId) || { questionId: a.questionId, subject: a.subject, learningConcept: a.learningConcept, question: a.text, total: 0, correct: 0 };
    s.total += 1;
    if (a.correct) s.correct += 1;
    map.set(a.questionId, s);
  });
  return [...map.values()].map((s) => ({ ...s, rate: rate(s.correct, s.total) }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total);
}

// 개념별 ('과목 + 학습 개념' 단위): 푼 횟수·틀린 횟수·오답률·틀린 학생 수·취약 여부. 오답률 높은 순
export function conceptStats(results, qIndex) {
  const map = new Map();
  answerRows(results, qIndex).forEach((a) => {
    const key = `${a.subject}\n${a.learningConcept}`;
    const s = map.get(key) || { subject: a.subject, learningConcept: a.learningConcept, total: 0, wrong: 0, wrongUids: new Set() };
    s.total += 1;
    if (!a.correct) { s.wrong += 1; s.wrongUids.add(a.studentUid); }
    map.set(key, s);
  });
  return [...map.values()].map(({ wrongUids, ...s }) => {
    const wrongRate = rate(s.wrong, s.total);
    return { ...s, wrongRate, wrongStudents: wrongUids.size, weak: s.total >= WEAK_MIN_TOTAL && wrongRate >= WEAK_RATE };
  }).sort((a, b) => b.wrongRate - a.wrongRate || b.total - a.total);
}

// 학급 통계 (기본값, spec.md): 참여 학생 수, 판 수, 푼 문제 수, 평균 정답률, 던전별 클리어한 학생 수
export function classSummary(results, dungeonCount = 3) {
  const students = new Set(results.map((r) => r.studentUid));
  const quizTotal = results.reduce((n, r) => n + r.quizTotal, 0);
  const quizCorrect = results.reduce((n, r) => n + r.quizCorrect, 0);
  const clearsByDungeon = Array.from({ length: dungeonCount }, (_, d) => new Set(
    results.filter((r) => r.dungeon === d && r.outcome === 'cleared').map((r) => r.studentUid),
  ).size);
  return { students: students.size, runs: results.length, quizTotal, quizCorrect, rate: rate(quizCorrect, quizTotal), clearsByDungeon };
}

// 학생 한 명: 판 기록(오래된 순), 개념별, 틀린 문제(같은 문제는 묶어서 틀린 횟수)
export function studentDetail(results, studentUid, qIndex) {
  const mine = results.filter((r) => r.studentUid === studentUid);
  const runs = [...mine].sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  const wrong = new Map();
  answerRows(mine, qIndex).filter((a) => !a.correct).forEach((a) => {
    const w = wrong.get(a.questionId) || { questionId: a.questionId, subject: a.subject, learningConcept: a.learningConcept, question: a.text, count: 0, lastChosen: null };
    w.count += 1;
    w.lastChosen = a.chosen === null ? '시간 초과' : (a.choices?.[a.chosen] ?? `${a.chosen + 1}번`);
    wrong.set(a.questionId, w);
  });
  return { runs, concepts: conceptStats(mine, qIndex), wrongQuestions: [...wrong.values()].sort((a, b) => b.count - a.count) };
}

// ── 맞춤 피드백·학급 분석 (규칙 기반, spec.md '학습 분석') ──
// 데이터가 기준보다 적으면 값을 만들지 않고 '데이터 부족'으로 표시한다.
export const MIN_STUDENT_ANSWERS = 5; // 학생 학습 수준·피드백: 푼 문제 5개 이상
export const MIN_ITEM_ANSWERS = WEAK_MIN_TOTAL; // 문제별·개념별 정답률: 3번 이상
export const MIN_ACTIVITY_ANSWERS = 3; // 활동별 변화: 활동마다 3문제 이상
export const MIN_CLASS_ANSWERS = 10; // 학급 보충 학습 요약: 학급 전체 10문제 이상
export const LEVEL_TEXT = { 상: '잘 이해하고 있음', 중: '보통', 하: '보충 학습 필요' };
const TIMEOUT_SHARE = 0.3; // 시간 초과가 푼 문제의 30% 이상이면 안내
const STRONG_RATE = 0.2; // 오답률 20% 이하인 개념은 '잘하는 개념'
const TREND_STEP = 0.1; // 활동 사이 정답률이 10%p 이상 바뀌면 오름·내림

export function rateText(part, total, min = MIN_ITEM_ANSWERS) {
  return total < min ? `데이터 부족 (${total}번)` : percent(rate(part, total));
}

// 학습 수준 (기본값): 푼 문제 5개 이상일 때 정답률 80% 이상 상 / 50% 이상 중 / 그 아래 하. 부족하면 null
export function levelOf(correct, total) {
  if (total < MIN_STUDENT_ANSWERS) return null;
  const r = correct / total;
  if (r >= 0.8) return '상';
  return r >= 0.5 ? '중' : '하';
}

export function levelDistribution(summary) {
  const dist = { 상: 0, 중: 0, 하: 0, 부족: 0 };
  summary.forEach((s) => { dist[levelOf(s.quizCorrect, s.quizTotal) ?? '부족'] += 1; });
  return dist;
}

// 활동 순서: 시작한 시각(없으면 만든 시각) 순
function activityOrder(activities) {
  const t = (a) => a.startAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
  return [...activities].sort((a, b) => t(a) - t(b));
}

// 학생 한 명의 활동별 정답률 변화. 활동마다 3문제 미만이면 rate null(데이터 부족)
export function activityTrend(results, studentUid, activities) {
  const mine = results.filter((r) => r.studentUid === studentUid);
  const rows = activityOrder(activities).map((a) => {
    const rs = mine.filter((r) => r.activityId === a.id);
    const total = rs.reduce((n, r) => n + r.quizTotal, 0);
    const correct = rs.reduce((n, r) => n + r.quizCorrect, 0);
    return { activityId: a.id, title: a.title, correct, total, rate: total >= MIN_ACTIVITY_ANSWERS ? correct / total : null };
  }).filter((x) => x.total > 0);
  const known = rows.filter((x) => x.rate !== null);
  let change = null;
  if (known.length >= 2) {
    const d = known[known.length - 1].rate - known[known.length - 2].rate;
    change = d >= TREND_STEP ? '올랐어요' : d <= -TREND_STEP ? '내려갔어요' : '비슷해요';
  }
  return { rows, change };
}

// 취약 개념과 같은 '과목 + 학습 개념'의 내 문제은행 문제 (틀린 문제 → 안 푼 문제 → 맞힌 문제 순, 최대 limit개)
export function recommendQuestions(weakConcepts, bank, answered = new Map(), limit = 5) {
  const keys = new Set(weakConcepts.map((c) => `${c.subject}\n${c.learningConcept}`));
  const order = (q) => {
    const a = answered.get(q.id);
    if (a === 'wrong') return 0;
    return a === undefined ? 1 : 2;
  };
  return bank.filter((q) => keys.has(`${q.subject}\n${q.learningConcept}`))
    .sort((a, b) => order(a) - order(b))
    .slice(0, limit);
}

// 학생 맞춤 피드백: 실제 결과에서 규칙으로 만든 문장과 근거 값. 데이터가 부족하면 enough false
export function studentFeedback(results, studentUid, qIndex, bank, activities) {
  const mine = results.filter((r) => r.studentUid === studentUid);
  const rows = answerRows(mine, qIndex);
  const total = rows.length;
  const correct = rows.filter((a) => a.correct).length;
  const trend = activityTrend(results, studentUid, activities);
  const lines = [];
  if (total < MIN_STUDENT_ANSWERS) {
    lines.push({ kind: 'lack', text: `푼 문제가 ${total}개라 학습 수준과 피드백을 판단하기에 데이터가 부족해요 (${MIN_STUDENT_ANSWERS}개 이상 필요)` });
    return { enough: false, level: null, lines, weak: [], recommend: [], trend };
  }
  const level = levelOf(correct, total);
  lines.push({ kind: 'level', text: `정답률 ${percent(correct / total)} (맞힌 ${correct} / 푼 ${total}) — 학습 수준 ${level}: ${LEVEL_TEXT[level]}` });

  const concepts = conceptStats(mine, qIndex);
  const weak = concepts.filter((c) => c.weak);
  const judged = concepts.filter((c) => c.total >= MIN_ITEM_ANSWERS);
  weak.forEach((c) => lines.push({
    kind: 'weak',
    text: `취약 개념 ${c.subject} · ${c.learningConcept}: ${c.total}번 중 ${c.wrong}번 틀렸어요 (오답률 ${percent(c.wrongRate)}). 개념을 다시 설명하고 비슷한 문제로 복습하게 해 주세요`,
  }));
  if (weak.length === 0) {
    lines.push(judged.length
      ? { kind: 'ok', text: `취약 개념 없음 — ${MIN_ITEM_ANSWERS}번 이상 푼 개념의 오답률이 모두 ${percent(WEAK_RATE)} 미만이에요` }
      : { kind: 'lack', text: `같은 개념을 ${MIN_ITEM_ANSWERS}번 이상 푼 기록이 없어 취약 개념은 판단할 수 없어요 (데이터 부족)` });
  }
  const strong = judged.filter((c) => c.wrongRate <= STRONG_RATE);
  if (strong.length) lines.push({ kind: 'good', text: `잘하는 개념: ${strong.map((c) => `${c.subject} · ${c.learningConcept}`).join(', ')}` });
  const timeouts = rows.filter((a) => a.chosen === null).length;
  if (timeouts / total >= TIMEOUT_SHARE) {
    lines.push({ kind: 'time', text: `시간 초과가 ${timeouts}번이에요 (푼 문제의 ${percent(timeouts / total)}). 15초 안에 문제를 읽고 답하기 어려웠을 수 있어요` });
  }
  if (trend.change) {
    const known = trend.rows.filter((x) => x.rate !== null);
    const [p, q] = known.slice(-2);
    lines.push({ kind: 'trend', text: `활동별 변화: '${p.title}' ${percent(p.rate)} → '${q.title}' ${percent(q.rate)} — ${trend.change}` });
  } else {
    lines.push({ kind: 'lack', text: `활동별 변화는 두 활동 이상에서 각각 ${MIN_ACTIVITY_ANSWERS}문제 이상 풀어야 볼 수 있어요 (데이터 부족)` });
  }
  const answered = new Map();
  rows.forEach((a) => { if (!a.correct) answered.set(a.questionId, 'wrong'); else if (!answered.has(a.questionId)) answered.set(a.questionId, 'right'); });
  return { enough: true, level, lines, weak, recommend: recommendQuestions(weak, bank, answered), trend };
}

// 활동별 참여율·완료율. 참여 = 그 활동에 결과가 하나 이상 있는 학생, 완료 = 그 활동에서 던전을 하나 이상 클리어한 학생
// 학급 학생 수는 지금 참여해 있는 학생 기준이다 (활동 뒤에 들어온 학생도 포함)
export function participation(results, studentCount, activities) {
  return activityOrder(activities).filter((a) => a.status !== 'waiting').map((a) => {
    const rs = results.filter((r) => r.activityId === a.id);
    const joined = new Set(rs.map((r) => r.studentUid)).size;
    const done = new Set(rs.filter((r) => r.outcome === 'cleared').map((r) => r.studentUid)).size;
    return {
      activityId: a.id,
      title: a.title,
      joined,
      done,
      studentCount,
      joinRate: studentCount ? joined / studentCount : null,
      doneRate: joined ? done / joined : null,
    };
  });
}

// 다음 수업 보충 학습 요약 (학급). 학급 전체 푼 문제가 10개 미만이면 데이터 부족
export function supplementSummary(results, qIndex) {
  const total = results.reduce((n, r) => n + r.quizTotal, 0);
  if (total < MIN_CLASS_ANSWERS) {
    return { enough: false, lines: [`학급 전체에서 푼 문제가 ${total}개라 보충 학습을 판단하기에 데이터가 부족해요 (${MIN_CLASS_ANSWERS}개 이상 필요)`], weak: [] };
  }
  const weak = conceptStats(results, qIndex).filter((c) => c.weak).slice(0, 3);
  const hard = questionStats(results, qIndex).filter((q) => q.total >= MIN_ITEM_ANSWERS && q.rate < 0.5).slice(0, 3);
  const support = studentSummary(results).filter((s) => levelOf(s.quizCorrect, s.quizTotal) === '하');
  const lines = [];
  if (weak.length) {
    weak.forEach((c) => lines.push(`보충할 개념: ${c.subject} · ${c.learningConcept} — 오답률 ${percent(c.wrongRate)}, 틀린 학생 ${c.wrongStudents}명 (${c.total}번 풂)`));
  } else {
    lines.push(`취약 개념 없음 — ${MIN_ITEM_ANSWERS}번 이상 푼 개념 중 오답률 ${percent(WEAK_RATE)} 이상인 개념이 없어요`);
  }
  hard.forEach((q) => lines.push(`다시 다룰 문제: '${q.question}' — 정답률 ${percent(q.rate)} (${q.total}번 풂)`));
  if (support.length) lines.push(`보충 학습이 필요한 학생 (학습 수준 하): ${support.map((s) => s.nickname).join(', ')}`);
  return { enough: true, lines, weak };
}
