// design.md 규칙을 따르는 글자·버튼·상단 정보줄·하단 안내줄.
import { COLORS, CSS, FONT, SIZE, LAYOUT } from './config.js';
import { state, remainingSeconds } from './state.js';

const { W, H, HUD_H, GUIDE_H } = LAYOUT;

export function text(scene, x, y, str, size, color = CSS.player) {
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: SIZE[size],
    fontStyle: size === 'big' ? 'bold' : 'normal',
    color,
    align: 'center',
  });
}

// primary: 금색 채움 / 보조: 흰색 2px 테두리. onClick이 없으면 누를 수 없다.
export function createButton(scene, x, y, label, onClick, { primary = false, w = 240, h = 56 } = {}) {
  const g = scene.add.graphics();
  const t = text(scene, x, y, label, 'body', primary ? CSS.bg : CSS.player).setOrigin(0.5);
  const zone = scene.add.zone(x, y, w, h);

  function draw(border) {
    g.clear();
    if (primary) {
      g.fillStyle(COLORS.good, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    } else {
      g.lineStyle(border === undefined ? 2 : 4, border === undefined ? COLORS.player : border, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    }
  }
  draw();

  if (onClick) zone.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);

  return {
    setBorder: draw,
    disable: () => zone.disableInteractive(),
    setAlpha: (a) => { g.setAlpha(a); t.setAlpha(a); },
    destroy: () => { g.destroy(); t.destroy(); zone.destroy(); },
  };
}

// 위: 왼쪽 남은 시간 / 가운데 제목 / 오른쪽 코인
export function createHud(scene, title) {
  const parts = [];
  const add = (obj) => { parts.push(obj.setScrollFactor(0).setDepth(10)); return obj; };

  add(scene.add.rectangle(0, 0, W, HUD_H, COLORS.bg).setOrigin(0));
  add(text(scene, 16, 22, '시간', 'small'));
  const timeText = add(text(scene, 60, 4, '', 'big'));
  const titleText = add(text(scene, W / 2, HUD_H / 2, title, 'small').setOrigin(0.5));
  add(text(scene, W - 140, 22, '코인', 'small', CSS.good));
  const coinText = add(text(scene, W - 16, 4, '', 'big', CSS.good).setOrigin(1, 0));

  function update() {
    const sec = remainingSeconds();
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    timeText.setText(`${m}:${s}`).setColor(sec <= 10 ? CSS.bad : CSS.player);
    coinText.setText(String(state.coins));
  }
  update();

  return {
    update,
    setTitle: (str) => titleText.setText(str),
    flashCoins: (color) => {
      coinText.setColor(color);
      scene.time.delayedCall(300, () => coinText.setColor(CSS.good));
    },
  };
}

// 아래: 작은 안내 한 줄
export function createGuide(scene, str) {
  scene.add.rectangle(0, H - GUIDE_H, W, GUIDE_H, COLORS.bg).setOrigin(0).setScrollFactor(0).setDepth(10);
  const t = text(scene, W / 2, H - GUIDE_H / 2, str, 'small').setOrigin(0.5).setScrollFactor(0).setDepth(10);
  return {
    notice: (msg, color) => {
      t.setText(msg).setColor(color);
      scene.time.delayedCall(1000, () => t.setText(str).setColor(CSS.player));
    },
  };
}

// 입력창 (design.md: 배경색 채움 + 흰색 2px 테두리 + 모서리 8px, 높이 56px, 글자는 본문, 선택되면 금색 테두리)
// Phaser DOM 요소라서 한글 입력이 된다. invalid(true)면 빨간 테두리
export function createInput(scene, x, y, { placeholder = '', w = 400, inputMode = 'text' } = {}) {
  const el = document.createElement('input');
  el.type = 'text';
  el.placeholder = placeholder;
  el.autocomplete = 'off';
  el.inputMode = inputMode;
  let invalid = false;
  const border = () => (invalid ? CSS.bad : document.activeElement === el ? CSS.good : CSS.player);
  Object.assign(el.style, {
    width: `${w}px`,
    height: '56px',
    boxSizing: 'border-box',
    padding: '0 16px',
    background: CSS.bg,
    color: CSS.player,
    border: `2px solid ${CSS.player}`,
    borderRadius: '8px',
    outline: 'none',
    fontFamily: FONT,
    fontSize: SIZE.body,
  });
  const paint = () => { el.style.borderColor = border(); };
  el.addEventListener('focus', paint);
  el.addEventListener('blur', paint);
  scene.add.dom(x, y, el);
  return {
    el,
    value: () => el.value.trim(),
    setInvalid: (on) => { invalid = on; paint(); },
  };
}
