// 터치 조작 (태블릿·휴대폰): 던전 화면에 왼쪽 ◀ ▶, 오른쪽 점프·대시 버튼을 띄운다.
// 터치 화면 기기에서만 보이고, PC에서도 주소에 ?touch=1을 붙이면 켜 볼 수 있다. 키보드 조작은 그대로 함께 된다.
import { LAYOUT } from './config.js';
import { panel, UI, FONT_PIXEL } from './art.js';

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
}

// 돌려줌: { left, right(누르고 있는 중), takeJump(), takeDash() — 한 번 누를 때마다 한 번만 참 }
export function createTouchControls(scene) {
  const { W, H, GUIDE_H } = LAYOUT;
  scene.input.addPointer(2); // 이동하면서 점프: 손가락 여러 개
  const state = { left: false, right: false, jump: false, dash: false };
  const y = H - GUIDE_H - 52;

  function button(x, label, w, onDown, onUp) {
    const bg = panel(scene, x, y, w, 76, UI.stone, 0xb8c4e8).setAlpha(0.45).setScrollFactor(0).setDepth(30);
    const t = scene.add.text(x, y, label, { fontFamily: FONT_PIXEL, fontSize: '28px', color: '#F5F5F5' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(31).setAlpha(0.9);
    const zone = scene.add.zone(x, y, w + 10, 90).setScrollFactor(0).setDepth(32).setInteractive();
    const press = () => { bg.setAlpha(0.85); onDown(); };
    const release = () => { bg.setAlpha(0.45); if (onUp) onUp(); };
    zone.on('pointerdown', press);
    zone.on('pointerup', release);
    zone.on('pointerout', release);
    return { bg, t, zone };
  }
  const buttons = {
    left: button(70, '◀', 100, () => { state.left = true; }, () => { state.left = false; }),
    right: button(190, '▶', 100, () => { state.right = true; }, () => { state.right = false; }),
    jump: button(W - 80, '점프', 120, () => { state.jump = true; }),
    dash: button(W - 220, '대시', 110, () => { state.dash = true; }),
  };

  return {
    buttons,
    get left() { return state.left; },
    get right() { return state.right; },
    takeJump() { const v = state.jump; state.jump = false; return v; },
    takeDash() { const v = state.dash; state.dash = false; return v; },
    release() { Object.assign(state, { left: false, right: false, jump: false, dash: false }); },
  };
}
