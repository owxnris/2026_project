// 한 판 동안 유지되는 진행 상태와 전체 제한 시간.
// 남은 시간은 활동의 종료 시각(서버 시각) 기준이다. serverNow()는 서버 함수 응답으로 맞춘 시각 (Firebase가 없으면 기기 시각)
import { RULES } from './config.js';
import { serverNow } from './firebase/server.js';
import { session } from './session.js';

export const state = {
  coins: 0,
  unlocked: 0, // 도전할 수 있는 가장 높은 던전 번호
  cleared: [],
  endTime: 0,
  timedOut: false,
  // 던전 한 판의 플레이 기록 (결과 저장용)
  play: { hits: 0, falls: 0, dashesUsed: 0, dungeonStartMs: 0 },
};

// endTimeMs: 활동 종료 시각(서버 시각). 없으면 예전처럼 지금부터 임시 300초
export function resetGame(endTimeMs = serverNow() + RULES.TOTAL_TIME_SEC * 1000) {
  state.coins = 0;
  state.unlocked = 0;
  state.cleared = [];
  state.endTime = endTimeMs;
  state.timedOut = false;
}

export function resetPlay() {
  state.play = { hits: 0, falls: 0, dashesUsed: 0, dungeonStartMs: 0 };
}

export function remainingSeconds() {
  return Math.max(0, Math.ceil((state.endTime - serverNow()) / 1000));
}

export function clearDungeon(index) {
  state.cleared[index] = true;
  state.unlocked = Math.max(state.unlocked, index + 1);
  state.coins = 0; // 던전이 끝나면 남은 코인은 사라진다
}

// 시간이 다 되거나 교사가 활동을 종료하면 어느 화면에서든 최종 결과 화면으로 보낸다.
export function checkTimeout(scene) {
  if (state.timedOut) return true;
  if (remainingSeconds() > 0 && !session.ended) return false;
  state.timedOut = true;
  if (scene.scene.key !== 'Dungeon') scene.scene.stop('Dungeon');
  if (scene.scene.key !== 'Quiz') scene.scene.stop('Quiz');
  scene.scene.start('Result', { mode: session.ended ? 'ended' : 'timeout' });
  return true;
}
