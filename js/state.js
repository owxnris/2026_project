// 한 판 동안 유지되는 진행 상태와 전체 제한 시간.
import { RULES } from './config.js';

export const state = {
  coins: 0,
  unlocked: 0, // 도전할 수 있는 가장 높은 던전 번호
  cleared: [],
  endTime: 0,
  timedOut: false,
};

export function resetGame() {
  state.coins = 0;
  state.unlocked = 0;
  state.cleared = [];
  state.endTime = Date.now() + RULES.TOTAL_TIME_SEC * 1000;
  state.timedOut = false;
}

export function remainingSeconds() {
  return Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
}

export function clearDungeon(index) {
  state.cleared[index] = true;
  state.unlocked = Math.max(state.unlocked, index + 1);
  state.coins = 0; // 던전이 끝나면 남은 코인은 사라진다
}

// 시간이 다 되면 어느 화면에서든 최종 결과 화면으로 보낸다.
export function checkTimeout(scene) {
  if (state.timedOut) return true;
  if (remainingSeconds() > 0) return false;
  state.timedOut = true;
  if (scene.scene.key !== 'Dungeon') scene.scene.stop('Dungeon');
  scene.scene.start('Result', { mode: 'timeout' });
  return true;
}
