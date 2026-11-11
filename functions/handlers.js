// 서버 함수의 실제 동작. Firestore(관리자 권한)와 시각 함수를 받아서 만든다 → 시험에서는 가짜 Firestore를 넣는다.
// 관리자 권한은 보안 규칙을 거치지 않으므로, 누가 부를 수 있는지는 여기서 모두 확인한다.
import {
  RULES, isActivityRunning, pickQuestion, isLate, isValidChoice, grade, issueBlocker,
  statsError, buildResult, publicQuestion,
} from './grading.js';

export class CallError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code; // Firebase HttpsError 코드
    this.details = details;
  }
}

const isId = (s) => typeof s === 'string' && s.length > 0 && s.length <= 128 && !s.includes('/');

function needIds(data, keys) {
  keys.forEach((k) => { if (!isId(data[k])) throw new CallError('invalid-argument', `${k} 값이 올바르지 않아요`); });
}

function needSignedIn(auth) {
  if (!auth) throw new CallError('unauthenticated', '로그인이 필요해요');
}

export function createHandlers({ db, ts, now }) {
  const classPath = (c) => `classes/${c}`;
  const actPath = (c, a) => `classes/${c}/activities/${a}`;
  const runPath = (c, a, r) => `${actPath(c, a)}/runs/${r}`;

  // 교사(Google 로그인)이고 그 학급의 주인인지
  async function needOwner(auth, classId) {
    needSignedIn(auth);
    if (auth.provider !== 'google.com') throw new CallError('permission-denied', '교사만 할 수 있어요');
    const snap = await db.doc(classPath(classId)).get();
    if (!snap.exists || snap.data().ownerUid !== auth.uid) throw new CallError('permission-denied', '내 학급이 아니에요');
  }

  // 판 하나를 끝내고 결과 문서(results/{runId})를 만든다. 이미 끝난 판이면 아무것도 하지 않는다 → 중복 저장 없음
  async function finalizeRun(classId, activityId, runId, outcome, stats) {
    const runRef = db.doc(runPath(classId, activityId, runId));
    return db.runTransaction(async (tx) => {
      const runSnap = await tx.get(runRef);
      const run = runSnap.data();
      if (run.status === 'finished') return { resultId: runId, already: true };
      if (outcome !== 'abandoned') {
        const err = statsError(outcome, stats, run.coinsEarned);
        if (err) throw new CallError('invalid-argument', `플레이 기록이 올바르지 않아요 (${err})`);
      }
      const attemptSnap = await tx.get(db.collection(`${runPath(classId, activityId, runId)}/attempts`));
      const studentSnap = await tx.get(db.doc(`${classPath(classId)}/students/${run.studentUid}`));

      const t = ts(now());
      const attempts = attemptSnap.docs
        .map((d) => ({ ref: d.ref, ...d.data() }))
        .sort((a, b) => a.issuedAt.toMillis() - b.issuedAt.toMillis());
      attempts.filter((a) => a.answeredAt === null).forEach((a) => {
        // 답하지 않은 채 끝난 문제는 시간 초과로 남긴다
        Object.assign(a, { chosen: null, correct: false, answeredAt: t });
        tx.update(a.ref, { chosen: null, correct: false, answeredAt: t });
      });

      const student = studentSnap.exists ? studentSnap.data() : { nickname: '' };
      const result = buildResult({ run, attempts, student, activityId, outcome, stats });
      tx.set(db.doc(`${classPath(classId)}/results/${runId}`), { ...result, createdAt: t });
      tx.update(runRef, { status: 'finished', outcome, finishedAt: t, openAttemptId: null, openIssuedAt: null });
      return { resultId: runId, already: false };
    });
  }

  // 끝나지 않은 판을 모두 '중도 종료(abandoned)'로 닫는다. studentUid를 주면 그 학생 것만
  async function closeOpenRuns(classId, activityId, studentUid) {
    let q = db.collection(`${actPath(classId, activityId)}/runs`).where('status', '==', 'playing');
    if (studentUid) q = q.where('studentUid', '==', studentUid);
    const snap = await q.get();
    for (const d of snap.docs) await finalizeRun(classId, activityId, d.id, 'abandoned');
    return snap.docs.length;
  }

  return {
    // 교사: 활동 시작. 학급에 진행 중인 다른 활동이 있으면 막는다 (한 트랜잭션 안에서 확인 → 동시에 두 번 눌러도 하나만)
    async startActivity(auth, data) {
      needIds(data, ['classId', 'activityId']);
      const { classId, activityId } = data;
      await needOwner(auth, classId);
      const nowMs = now();
      const expired = await db.runTransaction(async (tx) => {
        const actRef = db.doc(actPath(classId, activityId));
        const actSnap = await tx.get(actRef);
        if (!actSnap.exists) throw new CallError('not-found', '활동이 없어요');
        const act = actSnap.data();
        if (act.status !== 'waiting') throw new CallError('failed-precondition', '대기 중인 활동만 시작할 수 있어요', { reason: 'not-waiting' });
        const running = await tx.get(db.collection(`${classPath(classId)}/activities`).where('status', '==', 'running'));
        const others = running.docs.filter((d) => d.id !== activityId);
        const live = others.find((d) => isActivityRunning(d.data(), nowMs));
        if (live) {
          throw new CallError('failed-precondition', '진행 중인 활동이 있어요', { reason: 'already-running', title: live.data().title });
        }
        // 종료 시각이 지났는데 status가 'running'으로 남은 활동은 여기서 'ended'로 정리한다
        others.forEach((d) => tx.update(d.ref, { status: 'ended' }));
        tx.update(actRef, { status: 'running', startAt: ts(nowMs), endAt: ts(nowMs + act.totalTimeSec * 1000) });
        return others.map((d) => d.id);
      });
      for (const id of expired) await closeOpenRuns(classId, id);
      return { serverNow: nowMs };
    },

    // 교사: 활동 종료. 아직 끝나지 않은 학생들의 판은 중도 종료로 결과에 남긴다
    async endActivity(auth, data) {
      needIds(data, ['classId', 'activityId']);
      const { classId, activityId } = data;
      await needOwner(auth, classId);
      await db.runTransaction(async (tx) => {
        const actRef = db.doc(actPath(classId, activityId));
        const actSnap = await tx.get(actRef);
        if (!actSnap.exists) throw new CallError('not-found', '활동이 없어요');
        const { status } = actSnap.data();
        if (status === 'waiting') throw new CallError('failed-precondition', '시작하지 않은 활동이에요', { reason: 'not-running' });
        if (status === 'running') tx.update(actRef, { status: 'ended' });
      });
      const closedRuns = await closeOpenRuns(classId, activityId);
      return { serverNow: now(), closedRuns };
    },

    // 학생: 던전 한 판 시작 (입장 퀴즈 직전). 끝내지 않은 이전 판은 중도 종료로 닫는다
    async startRun(auth, data) {
      needSignedIn(auth);
      needIds(data, ['classId', 'activityId']);
      const { classId, activityId, dungeon } = data;
      if (!Number.isInteger(dungeon) || dungeon < 0 || dungeon >= RULES.DUNGEON_COUNT) {
        throw new CallError('invalid-argument', 'dungeon 값이 올바르지 않아요');
      }
      const studentSnap = await db.doc(`${classPath(classId)}/students/${auth.uid}`).get();
      if (!studentSnap.exists) throw new CallError('permission-denied', '이 학급에 참여하지 않았어요');
      const actSnap = await db.doc(actPath(classId, activityId)).get();
      if (!actSnap.exists || !isActivityRunning(actSnap.data(), now())) {
        throw new CallError('failed-precondition', '진행 중인 활동이 아니에요', { reason: 'activity-not-running' });
      }
      await closeOpenRuns(classId, activityId, auth.uid);
      const runRef = db.collection(`${actPath(classId, activityId)}/runs`).doc();
      const t = now();
      await runRef.set({
        studentUid: auth.uid,
        dungeon,
        status: 'playing',
        entryIssued: 0,
        coinsEarned: 0,
        openAttemptId: null,
        openIssuedAt: null,
        lastQuestionId: null,
        startedAt: ts(t),
        finishedAt: null,
      });
      return { runId: runRef.id, serverNow: t };
    },

    // 학생: 문제 하나 받기. 서버가 문제를 고르고, 정답 없이 보낸다
    async issueQuestion(auth, data) {
      needSignedIn(auth);
      needIds(data, ['classId', 'activityId', 'runId']);
      const { classId, activityId, runId, quizType } = data;
      const runRef = db.doc(runPath(classId, activityId, runId));
      const actRef = db.doc(actPath(classId, activityId));
      const nowMs = now();
      return db.runTransaction(async (tx) => {
        const runSnap = await tx.get(runRef);
        if (!runSnap.exists || runSnap.data().studentUid !== auth.uid) throw new CallError('permission-denied', '내 판이 아니에요');
        const run = runSnap.data();
        const actSnap = await tx.get(actRef);
        const act = actSnap.data();
        if (run.status !== 'playing') throw new CallError('failed-precondition', '이미 끝난 판이에요', { reason: 'run-finished' });

        const open = run.openAttemptId ? { id: run.openAttemptId, issuedAtMs: run.openIssuedAt.toMillis() } : null;
        // 직전 문제에 아직 답하지 않았고 시간이 남았으면 같은 문제를 다시 보낸다 (네트워크 재시도에 안전, 문제 고르기 불가)
        if (open && !isLate(open.issuedAtMs, nowMs)) {
          const aSnap = await tx.get(db.doc(`${runPath(classId, activityId, runId)}/attempts/${open.id}`));
          const a = aSnap.data();
          const q = act.questions.find((x) => x.id === a.questionId);
          const leftSec = Math.max(0, RULES.QUIZ_TIME_SEC - (nowMs - open.issuedAtMs) / 1000);
          return { attemptId: open.id, quizType: a.quizType, question: publicQuestion(q), timeLimitSec: leftSec, serverNow: nowMs };
        }
        if (!isActivityRunning(act, nowMs)) {
          throw new CallError('failed-precondition', '진행 중인 활동이 아니에요', { reason: 'activity-not-running' });
        }
        const blocker = issueBlocker(run, quizType);
        if (blocker) throw new CallError('failed-precondition', '지금은 문제를 받을 수 없어요', { reason: blocker });

        const t = ts(nowMs);
        if (open) {
          // 답하지 않고 시간이 지난 직전 문제는 시간 초과(오답)로 기록한다
          tx.update(db.doc(`${runPath(classId, activityId, runId)}/attempts/${open.id}`), { chosen: null, correct: false, answeredAt: t });
        }
        const q = pickQuestion(act.questions, run.lastQuestionId);
        const attemptRef = db.collection(`${runPath(classId, activityId, runId)}/attempts`).doc();
        tx.set(attemptRef, {
          questionId: q.id,
          learningConcept: q.learningConcept,
          quizType,
          issuedAt: t,
          answeredAt: null,
          chosen: null,
          correct: null,
        });
        tx.update(runRef, {
          openAttemptId: attemptRef.id,
          openIssuedAt: t,
          lastQuestionId: q.id,
          entryIssued: run.entryIssued + (quizType === 'entry' ? 1 : 0),
        });
        return { attemptId: attemptRef.id, quizType, question: publicQuestion(q), timeLimitSec: RULES.QUIZ_TIME_SEC, serverNow: nowMs };
      });
    },

    // 학생: 답 내기. 서버가 정답표로 채점하고 코인을 정한다. 같은 문제를 다시 내면 처음 결과만 돌려준다 (코인 중복 없음)
    async submitAnswer(auth, data) {
      needSignedIn(auth);
      needIds(data, ['classId', 'activityId', 'runId', 'attemptId']);
      const { classId, activityId, runId, attemptId } = data;
      const chosen = data.chosen ?? null;
      if (!isValidChoice(chosen)) throw new CallError('invalid-argument', 'chosen 값이 올바르지 않아요');
      const runRef = db.doc(runPath(classId, activityId, runId));
      const attemptRef = db.doc(`${runPath(classId, activityId, runId)}/attempts/${attemptId}`);
      const keyRef = db.doc(`${actPath(classId, activityId)}/answerKey/main`);
      const nowMs = now();
      return db.runTransaction(async (tx) => {
        const runSnap = await tx.get(runRef);
        if (!runSnap.exists || runSnap.data().studentUid !== auth.uid) throw new CallError('permission-denied', '내 판이 아니에요');
        const run = runSnap.data();
        const aSnap = await tx.get(attemptRef);
        if (!aSnap.exists) throw new CallError('not-found', '받은 문제가 아니에요');
        const a = aSnap.data();
        const keySnap = await tx.get(keyRef);
        const correctIndex = keySnap.data().answers[a.questionId];

        if (a.answeredAt !== null) {
          return { correct: a.correct, chosen: a.chosen, correctIndex, coinsEarned: run.coinsEarned, duplicate: true, serverNow: nowMs };
        }
        const late = isLate(a.issuedAt.toMillis(), nowMs);
        const g = grade(chosen, correctIndex, late);
        const coinsEarned = run.coinsEarned + (g.correct ? RULES.COIN_PER_CORRECT : 0);
        tx.update(attemptRef, { chosen: g.chosen, correct: g.correct, answeredAt: ts(nowMs) });
        const runUpdate = { coinsEarned };
        if (run.openAttemptId === attemptId) Object.assign(runUpdate, { openAttemptId: null, openIssuedAt: null });
        tx.update(runRef, runUpdate);
        return { correct: g.correct, chosen: g.chosen, correctIndex, coinsEarned, duplicate: false, serverNow: nowMs };
      });
    },

    // 학생: 한 판 끝 (cleared: 깃발 도달 / failed: 전체 시간 종료·교사 종료). 결과 문서는 서버만 쓴다
    async finishRun(auth, data) {
      needSignedIn(auth);
      needIds(data, ['classId', 'activityId', 'runId']);
      const { classId, activityId, runId, outcome, stats } = data;
      if (outcome !== 'cleared' && outcome !== 'failed') throw new CallError('invalid-argument', 'outcome 값이 올바르지 않아요');
      const runSnap = await db.doc(runPath(classId, activityId, runId)).get();
      if (!runSnap.exists || runSnap.data().studentUid !== auth.uid) throw new CallError('permission-denied', '내 판이 아니에요');
      const r = await finalizeRun(classId, activityId, runId, outcome, stats);
      return { ...r, serverNow: now() };
    },
  };
}
