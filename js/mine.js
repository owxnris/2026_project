// 학급 광산 (2026-11-25, 사용자 요청): 8개 방을 다 깬 학생이 먼저 광산에 들어가 학급 코인을 함께 캔다.
// - 목표는 자동: 이번 활동에 들어온 학생 수 × 50 (교사가 누를 것 없음)
// - 혼자서는 못 캔다: 광산 안에 참여 인원의 절반 이상(최소 2명)이 있어야 캐진다
// - 목표를 채우면 아직 다 못 깬 친구들이 남은 방마다 능력 구매 코인 +20을 받는다 (지원)
// 순수 함수 — 시험: tests/test/mine.test.js
export const MINE_PER_STUDENT = 50;
export const SUPPORT_COINS = 20; // 규칙과 같다 (results.supportCoins)
export const MAX_DIG_WRITE = 30; // 한 번에 쓰는 캔 양 최대 (규칙과 같다)
export const PRESENCE_MS = 25000; // 이 시간 안에 신호를 보낸 학생만 광산 안에 있는 것으로 센다
export const HEARTBEAT_MS = 10000; // 광산 안 학생이 신호를 보내는 간격
export const ROOM_COUNT = 8;

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t === 'number' ? t : 0));

// progress: 이번 활동의 진행 상황 문서들 [{ inMine, updatedAt }], mine: { dug, done } | null, now: 서버 시각(ms)
export function mineState(progress, mine, now) {
  const participants = progress.length;
  const miners = progress.filter((p) => p.inMine && now - ms(p.updatedAt) <= PRESENCE_MS).length;
  const need = Math.max(2, Math.ceil(participants / 2));
  const goal = Math.max(1, participants) * MINE_PER_STUDENT;
  const dug = mine?.dug ?? 0;
  const done = !!mine?.done || dug >= goal;
  return {
    participants,
    miners,
    need,
    goal,
    dug: Math.min(dug, goal),
    done,
    reachedGoal: dug >= goal, // 처음 목표에 닿았는지 (done을 기록할 때)
    canDig: !done && miners >= need,
    missing: Math.max(0, need - miners),
    percent: Math.min(100, Math.floor((dug / goal) * 100)),
  };
}

// 지원 코인: 광산이 완성됐고 아직 8개 방을 다 깨지 못한 학생만
export function supportCoins(mineDone, clearedCount) {
  return mineDone && clearedCount < ROOM_COUNT ? SUPPORT_COINS : 0;
}
