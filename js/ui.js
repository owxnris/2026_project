// design.md 규칙을 따르는 글자·버튼·상단 정보줄·하단 안내줄. 그림은 픽셀 아트 패널(art.js)
import { COLORS, CSS, SIZE, LAYOUT } from './config.js';
import { state, remainingSeconds } from './state.js';
import { soundOn, setSound } from './sound.js';
import { refreshMusic } from './music.js';
import { FONT_PIXEL as FONT, FONT_SMALL, panel, UI, PP } from './art.js';

const { W, H, HUD_H, GUIDE_H } = LAYOUT;

export function text(scene, x, y, str, size, color = CSS.player) {
  return scene.add.text(x, y, str, {
    fontFamily: size === 'small' ? FONT_SMALL : FONT,
    fontSize: SIZE[size],
    fontStyle: size === 'big' ? 'bold' : 'normal',
    color,
    align: 'center',
  });
}

// primary: 금색 픽셀 버튼 / 보조: 돌 버튼. onClick이 없으면 누를 수 없다.
// setBorder(색): 퀴즈 보기 결과 — 금색이면 금색 버튼(정답), 빨강이면 빨간 버튼(오답)
// fixed: 화면에 붙어 있게(던전처럼 카메라가 움직여도 제자리) 맨 위에 그린다
export function createButton(scene, x, y, label, onClick, { primary = false, w = 240, h = 56, fixed = false } = {}) {
  let bg = null;
  let alpha = 1;
  const t = text(scene, x, y, label, 'body', primary ? CSS.bg : CSS.player).setOrigin(0.5).setDepth(1);
  t.setWordWrapWidth(w - 24);
  const zone = scene.add.zone(x, y, w, h);
  const pin = (o) => (fixed ? o.setScrollFactor(0).setDepth(o === t ? 13 : 12) : o);
  pin(t);
  pin(zone);

  function draw(border) {
    if (bg) bg.destroy();
    const gold = border === COLORS.good || (border === undefined && primary);
    const red = border === COLORS.bad;
    bg = pin(panel(scene, x, y, w, h, gold ? UI.parchment : red ? UI.red : UI.stone, gold ? COLORS.good : 0xffffff).setAlpha(alpha));
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

// 이전 화면으로 (왼쪽 위). warn이 있으면 한 번 누르면 안내만 하고, 2.5초 안에 한 번 더 눌러야 이동한다
// (게임 중에 실수로 눌러 판을 잃지 않게). warn: (안내 글) => 화면에 보여 주는 함수
export function createBackButton(scene, onBack, { warn, message } = {}) {
  let armed = false;
  return createButton(scene, 70, 30, '← 뒤로', () => {
    if (warn && !armed) {
      armed = true;
      warn(message);
      scene.time.delayedCall(2500, () => { armed = false; });
      return;
    }
    onBack();
  }, { w: 128, h: 44, fixed: true });
}

// 위: 왼쪽 남은 시간 / 가운데 제목 / 오른쪽 코인. back: 왼쪽 위에 뒤로 버튼이 있으면 시간을 오른쪽으로 민다
export function createHud(scene, title, { back = false } = {}) {
  const left = back ? 146 : 16;
  const parts = [];
  const add = (obj) => { parts.push(obj.setScrollFactor(0).setDepth(10)); return obj; };

  add(panel(scene, W / 2, HUD_H / 2, W + 12, HUD_H + 6, UI.stone, 0x8898c8).setAlpha(0.95));
  add(text(scene, left, 22, '시간', 'small'));
  const timeText = add(text(scene, left + 44, 4, '', 'big'));
  const titleText = add(text(scene, W / 2, HUD_H / 2, title, 'small').setOrigin(0.5));
  createSoundToggle(scene, W - 214, HUD_H / 2).forEach((o) => parts.push(o));
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

// 소리 켜기·끄기 작은 버튼 (♪, 꺼지면 빨간 빗금) — 게임 중 어느 화면에서나 (2026-11-25 사용자 요청)
// 효과음·음악 모두 같은 설정(sound.js, 이 기기에 기억)
export function createSoundToggle(scene, x, y) {
  const bg = panel(scene, x, y, 48, 42, UI.stone, 0xb8c4e8).setScrollFactor(0).setDepth(10);
  const icon = text(scene, x, y, '♪', 'body').setOrigin(0.5).setScrollFactor(0).setDepth(11);
  const slash = scene.add.line(0, 0, x - 14, y + 12, x + 14, y - 12, COLORS.bad).setOrigin(0).setLineWidth(3).setScrollFactor(0).setDepth(12);
  const paint = () => { slash.setVisible(!soundOn()); icon.setAlpha(soundOn() ? 1 : 0.5); };
  paint();
  const zone = scene.add.zone(x, y, 56, 50).setScrollFactor(0).setDepth(13).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', (pointer, lx, ly, ev) => {
    ev?.stopPropagation?.();
    setSound(!soundOn());
    refreshMusic();
    paint();
  });
  return [bg, icon, slash, zone];
}

// 아래: 작은 안내 한 줄
export function createGuide(scene, str) {
  let base = str;
  panel(scene, W / 2, H - GUIDE_H / 2, W + 12, GUIDE_H + 6, UI.stone, 0x8898c8).setAlpha(0.95).setScrollFactor(0).setDepth(10);
  const t = text(scene, W / 2, H - GUIDE_H / 2, str, 'small').setOrigin(0.5).setScrollFactor(0).setDepth(10);
  let timer = null;
  return {
    text: t,
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
