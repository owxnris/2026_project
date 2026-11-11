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
