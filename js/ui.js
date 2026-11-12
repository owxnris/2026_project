// design.md 규칙을 따르는 글자·버튼·상단 정보줄·하단 안내줄. 그림은 픽셀 아트 패널(art.js)
import { COLORS, CSS, SIZE, LAYOUT } from './config.js';
import { state, remainingSeconds } from './state.js';
import { FONT_PIXEL as FONT, panel, UI, PP } from './art.js';

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

// primary: 금색 픽셀 버튼 / 보조: 돌 버튼. onClick이 없으면 누를 수 없다.
// setBorder(색): 퀴즈 보기 결과 — 금색이면 금색 버튼(정답), 빨강이면 빨간 버튼(오답)
export function createButton(scene, x, y, label, onClick, { primary = false, w = 240, h = 56 } = {}) {
  let bg = null;
  let alpha = 1;
  const t = text(scene, x, y, label, 'body', primary ? CSS.bg : CSS.player).setOrigin(0.5).setDepth(1);
  t.setWordWrapWidth(w - 24);
  const zone = scene.add.zone(x, y, w, h);

  function draw(border) {
    if (bg) bg.destroy();
    const gold = border === COLORS.good || (border === undefined && primary);
    const red = border === COLORS.bad;
    bg = panel(scene, x, y, w, h, gold ? UI.parchment : red ? UI.red : UI.stone, gold ? COLORS.good : 0xffffff).setAlpha(alpha);
    t.setColor(gold ? CSS.bg : CSS.player);
  }
  draw();

  if (onClick) {
    zone.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { t.y = y + 2; scene.time.delayedCall(80, () => { t.y = y; }); onClick(); })
      .on('pointerover', () => bg.setAlpha(alpha * 0.85))
      .on('pointerout', () => bg.setAlpha(alpha));
  }

  return {
    setBorder: draw,
    disable: () => zone.disableInteractive(),
    setAlpha: (a) => { alpha = a; bg.setAlpha(a); t.setAlpha(a); },
    destroy: () => { bg.destroy(); t.destroy(); zone.destroy(); },
  };
}

// 위: 왼쪽 남은 시간 / 가운데 제목 / 오른쪽 코인
export function createHud(scene, title) {
  const parts = [];
  const add = (obj) => { parts.push(obj.setScrollFactor(0).setDepth(10)); return obj; };

  add(panel(scene, W / 2, HUD_H / 2, W + 12, HUD_H + 6, UI.stone, 0x8898c8).setAlpha(0.95));
  add(text(scene, 16, 22, '시간', 'small'));
  const timeText = add(text(scene, 60, 4, '', 'big'));
  const titleText = add(text(scene, W / 2, HUD_H / 2, title, 'small').setOrigin(0.5));
  add(scene.add.sprite(W - 150, HUD_H / 2, 'pp', PP.coin).setScale(3).play('coin_spin'));
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
  let base = str;
  panel(scene, W / 2, H - GUIDE_H / 2, W + 12, GUIDE_H + 6, UI.stone, 0x8898c8).setAlpha(0.95).setScrollFactor(0).setDepth(10);
  const t = text(scene, W / 2, H - GUIDE_H / 2, str, 'small').setOrigin(0.5).setScrollFactor(0).setDepth(10);
  let timer = null;
  return {
    notice: (msg, color) => {
      t.setText(msg).setColor(color);
      if (timer) timer.remove();
      timer = scene.time.delayedCall(1500, () => { timer = null; t.setText(base).setColor(CSS.player); });
    },
    // 기본 안내를 바꾼다 (예: 남은 대시 횟수)
    setBase: (next) => {
      base = next;
      if (!timer) t.setText(base);
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
