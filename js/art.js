// 픽셀 아트 그래픽 (design.md '그래픽 방향'). 그림 출처와 라이선스: assets/CREDITS.md (Kenney, CC0)
// - 시트 세 장을 한 번 불러오고(BootScene), 모든 그림은 3배로 키워 픽셀 크기를 맞춘다 (16px 타일 → 48px)
// - 게임 로직은 그대로 두고, 화면에 보이는 그림만 이 파일의 함수로 만든다
import { LAYOUT } from './config.js';

export const SCALE = 3;
export const FONT_PIXEL = '"Galmuri11", "Malgun Gothic", sans-serif';

const SHEETS = [
  { key: 'td', url: 'assets/kenney/tiny-dungeon.png', size: 16 }, // Tiny Dungeon: 던전 타일·캐릭터·몬스터·물약
  { key: 'pp', url: 'assets/kenney/pixel-platformer.png', size: 18 }, // Pixel Platformer: 코인·깃발·하트
  { key: 'ui', url: 'assets/kenney/ui-pixel.png', size: 16 }, // UI Pack - Pixel Adventure: 패널·버튼·리본
];

// 시트 안의 그림 번호 (왼쪽 위부터 0, 가로로 센다)
export const TD = {
  hero: 108, // 플레이어: 말랑한 청록 유령 '말랑이'
  wizard: 84, // 안내자 마법사 루미 (이야기)
  wall: 57, wallTop: 40, window: 28, banner: 29, gargoyle: 19,
  slab: 37, slabL: 36, slabR: 39,
  door: 45, doorOpen: 33,
  chest: 89,
  potionGreen: 114, potionBlue: 116, shield: 102,
  bat: 120, ghost: 121, spider: 122, snail: 123, rat: 124, cyclops: 109, crab: 110,
};
export const PP = { coin: 151, coin2: 152, flag: 111, flag2: 112, pole: 131, heart: 44, lock: 28, key: 27 };
export const UI = { wood: 11, parchment: 10, stone: 13, stoneLight: 12, red: 70, blue: 73, green: 74, white: 69, ribbonL: 83, ribbonM: 84, ribbonR: 85 };

// 던전별 분위기: 남색 바탕 + 벽 색 + 떠다니는 입자 + 몬스터
// top·fill: 발판 윗면·속 그림 [시트, 번호, 입힐 색]
export const THEMES = [
  { // 잊혀진 숲: 풀 덮인 흙 발판, 이끼 낀 벽, 반딧불
    bg: 0x14243a, wall: 0x4f8a7c, particle: 0xd8ff8a, mode: 'firefly', ground: [TD.spider, TD.snail], flyer: TD.bat,
    top: ['pp', 2, 0xffffff], fill: ['pp', 122, 0xb0a090],
  },
  { // 용암 광산: 붉은 흙 발판, 갈색 벽, 불씨
    bg: 0x21182b, wall: 0x9a6a58, particle: 0xffa040, mode: 'ember', ground: [TD.crab, TD.cyclops], flyer: TD.bat,
    top: ['pp', 42, 0xffd0b0], fill: ['pp', 122, 0x9a7060],
  },
  { // 얼어붙은 성: 얼음 돌판, 푸른 벽, 눈
    bg: 0x162642, wall: 0x7aa2d8, particle: 0xeaf6ff, mode: 'snow', ground: [TD.rat, TD.spider], flyer: TD.ghost,
    top: ['td', TD.slab, 0xd8ecff], fill: ['td', TD.wall, 0x8aaee0],
  },
];
export const MENU_THEME = { bg: 0x141c30, wall: 0x5a6ea0 };

export function preloadArt(scene) {
  SHEETS.forEach((s) => scene.load.spritesheet(s.key, s.url, { frameWidth: s.size, frameHeight: s.size }));
}

// 별 (결과 화면) — Kenney 시트에 별이 없어서 같은 외곽선 색으로 그린 16px 픽셀 그림
const STAR = [
  '.......AA.......',
  '......ABBA......',
  '......ABBA......',
  '.....ABBBBA.....',
  'AAAAAABBBBAAAAAA',
  'ABBBBBBBBBBBBBBA',
  '.ABBBBBBBBBBBBA.',
  '..ABBBBBBBBBBA..',
  '...ABBBBBBBBA...',
  '...ABBBBBBBBA...',
  '..ABBBBAABBBBA..',
  '..ABBBA..ABBBA..',
  '.ABBA......ABBA.',
  '.AAA........AAA.',
  '................',
  '................',
];

function pixelTexture(scene, key, rows, colors) {
  const t = scene.textures.createCanvas(key, rows[0].length, rows.length);
  const ctx = t.getContext();
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!colors[ch]) return;
    ctx.fillStyle = colors[ch];
    ctx.fillRect(x, y, 1, 1);
  }));
  t.refresh();
}

// 시트를 불러온 뒤 한 번: 주인공 눈 깜빡임 그림, 별, 입자, 애니메이션
export function createArt(scene) {
  // 주인공 눈 감은 그림: 원본 108번에서 눈 윗줄(7번째 줄)의 눈 픽셀을 몸 색으로 칠한다
  const src = scene.textures.get('td').getSourceImage();
  const blink = scene.textures.createCanvas('hero_blink', 16, 16);
  const ctx = blink.getContext();
  const fx = (TD.hero % 12) * 16;
  const fy = Math.floor(TD.hero / 12) * 16;
  ctx.drawImage(src, fx, fy, 16, 16, 0, 0, 16, 16);
  ctx.fillStyle = '#43e1b3';
  ctx.fillRect(6, 7, 1, 1);
  ctx.fillRect(9, 7, 1, 1);
  blink.refresh();

  pixelTexture(scene, 'star', STAR, { A: '#3f2631', B: '#ffd54f' });
  pixelTexture(scene, 'star_off', STAR, { A: '#3f2631', B: '#4a5068' });
  pixelTexture(scene, 'px', ['##', '##'], { '#': '#ffffff' }); // 입자 하나

  scene.anims.create({ key: 'coin_spin', frames: scene.anims.generateFrameNumbers('pp', { frames: [PP.coin, PP.coin2] }), frameRate: 4, repeat: -1 });
  scene.anims.create({ key: 'flag_wave', frames: scene.anims.generateFrameNumbers('pp', { frames: [PP.flag, PP.flag2] }), frameRate: 4, repeat: -1 });
}

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const SIZE_OF = { td: 16, pp: 18, ui: 16 };

// 색을 입힌 그림 한 장을 미리 만들어 둔다 (WebGL·Canvas 어느 쪽이든 같은 색이 나오게 — Canvas 렌더러는 tint를 무시한다)
export function tinted(scene, sheet, frame, tint = 0xffffff) {
  const key = sheet + '_' + frame + '_' + tint.toString(16);
  if (scene.textures.exists(key)) return key;
  const n = SIZE_OF[sheet];
  const fr = scene.textures.getFrame(sheet, frame);
  const t = scene.textures.createCanvas(key, n, n);
  const ctx = t.getContext();
  ctx.drawImage(fr.source.image, fr.cutX, fr.cutY, n, n, 0, 0, n, n);
  if (tint !== 0xffffff) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hex(tint);
    ctx.fillRect(0, 0, n, n);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(fr.source.image, fr.cutX, fr.cutY, n, n, 0, 0, n, n);
  }
  t.refresh();
  return key;
}

// 같은 그림을 이어 붙인 띠 (발판·벽). 색은 미리 입힌다
export function tiles(scene, x, y, w, h, [sheet, frame, tint]) {
  return scene.add.tileSprite(x, y, w, h, tinted(scene, sheet, frame, tint)).setOrigin(0).setTileScale(SCALE);
}

// 색 입힌 입자 그림 (2x2)
export function dot(scene, color) {
  const key = 'px_' + color.toString(16);
  if (!scene.textures.exists(key)) pixelTexture(scene, key, ['##', '##'], { '#': hex(color) });
  return key;
}

// ── 말랑이 꾸미기 (js/cosmetics.js) ──
// 몸 색: 원래 그림(108번)의 밝은·몸·그림자 세 색을 고른 팔레트로 바꾼 그림을 만든다 (눈 감은 그림도 함께)
const HERO_COLORS = [[0x69, 0xff, 0xd4], [0x43, 0xe1, 0xb3], [0x25, 0x95, 0x6a]];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function heroKeys(scene, colorId = 'mint', palette = null) {
  if (!palette) return { base: ['td', TD.hero], blink: ['hero_blink'] };
  const key = `hero_${colorId}`;
  if (!scene.textures.exists(key)) {
    const src = scene.textures.get('td').getSourceImage();
    const to = palette.map(hexRgb);
    [[key, false], [`${key}_blink`, true]].forEach(([k, blink]) => {
      const t = scene.textures.createCanvas(k, 16, 16);
      const ctx = t.getContext();
      ctx.drawImage(src, (TD.hero % 12) * 16, Math.floor(TD.hero / 12) * 16, 16, 16, 0, 0, 16, 16);
      if (blink) { ctx.fillStyle = '#43e1b3'; ctx.fillRect(6, 7, 1, 1); ctx.fillRect(9, 7, 1, 1); }
      const img = ctx.getImageData(0, 0, 16, 16);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = HERO_COLORS.findIndex(([r, g, b]) => img.data[i] === r && img.data[i + 1] === g && img.data[i + 2] === b);
        if (n >= 0) [img.data[i], img.data[i + 1], img.data[i + 2]] = to[n];
      }
      ctx.putImageData(img, 0, 0);
      t.refresh();
    });
  }
  return { base: [key], blink: [`${key}_blink`] };
}

// 모자: 말랑이 그림(16px)과 같은 칸에 겹쳐 그리는 16px 픽셀 그림 (이 프로젝트에서 직접 그림)
const HAT_ART = {
  leaf: { rows: ['........AAA.....', '.......ABBBA....', '.......AAAA.....', '.......AC.......'], colors: { A: '#3f2631', B: '#7bd34f', C: '#8a5a3a' } },
  bow: { rows: ['................', '.........AA.AA..', '.........ABABA..', '.........AA.AA..'], colors: { A: '#3f2631', B: '#ff7eb6' } },
  wizard: { rows: ['........A.......', '.......ABA......', '......ABBBA.....', '.....ABBCBBA....', '....AAAAAAAAA...'], colors: { A: '#3f2631', B: '#7a4fd0', C: '#ffd54f' } },
  crown: { rows: ['.....A.AA.A.....', '.....ABAABA.....', '.....ABBBBA.....', '.....AAAAAA.....'], colors: { A: '#3f2631', B: '#ffd54f' } },
};
export function hatKey(scene, hatId) {
  const art = HAT_ART[hatId];
  if (!art) return null;
  const key = `hat_${hatId}`;
  if (!scene.textures.exists(key)) {
    const rows = [...art.rows];
    while (rows.length < 16) rows.push('................');
    pixelTexture(scene, key, rows, art.colors);
  }
  return key;
}

// 꾸민 말랑이 하나: 몸 그림 + 모자 그림(같은 위치·크기로 따라감). look: { color, hat }, colorDef: cosmetics COLORS 항목
export function dressedHero(scene, x, y, look, colorDef, scale = SCALE) {
  const keys = heroKeys(scene, look.color, colorDef?.palette);
  const body = scene.add.image(x, y, ...keys.base).setScale(scale).setOrigin(0.5, 1);
  const hk = hatKey(scene, look.hat);
  const hat = hk ? scene.add.image(x, y, hk).setScale(scale).setOrigin(0.5, 1) : null;
  const sync = () => {
    if (!hat) return;
    hat.setPosition(body.x, body.y).setScale(body.scaleX, body.scaleY).setFlipX(body.flipX).setAlpha(body.alpha).setDepth(body.depth + 0.1);
  };
  sync();
  return { body, hat, keys, sync };
}

// 그림 하나 (3배)
export function sprite(scene, x, y, sheet, frame, scale = SCALE) {
  return scene.add.image(x, y, sheet, frame).setScale(scale);
}

// 9칸 나눔 패널: UI 타일(16px)의 모서리 5px는 그대로, 가운데는 늘려서 원본 픽셀 크기로 한 장을 만든 뒤 3배로 키운다
// (Phaser NineSlice는 WebGL에서만 그려져서, 학교 기기의 Canvas 렌더러에서도 보이도록 직접 만든다)
export function panel(scene, x, y, w, h, frame = UI.wood, tint = 0xffffff) {
  const pw = Math.max(11, Math.round(w / SCALE));
  const ph = Math.max(11, Math.round(h / SCALE));
  const key = 'panel_' + frame + '_' + pw + 'x' + ph + '_' + tint.toString(16);
  if (!scene.textures.exists(key)) {
    const src = scene.textures.get(tinted(scene, 'ui', frame, tint)).getSourceImage();
    const t = scene.textures.createCanvas(key, pw, ph);
    const ctx = t.getContext();
    ctx.imageSmoothingEnabled = false;
    const c = 5; // 모서리
    const m = 16 - 2 * c; // 가운데
    const cols = [[0, c, 0, c], [c, m, c, pw - 2 * c], [16 - c, c, pw - c, c]];
    const rows = [[0, c, 0, c], [c, m, c, ph - 2 * c], [16 - c, c, ph - c, c]];
    rows.forEach(([sy, sh, dy, dh]) => cols.forEach(([sx, sw, dx, dw]) => ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh)));
    t.refresh();
  }
  return scene.add.image(x, y, key).setScale(SCALE);
}

// 빨간 리본 띠: 왼쪽·가운데(늘림)·오른쪽 조각
export function ribbon(scene, x, y, w) {
  const mid = scene.add.tileSprite(x, y, w - 96, 48, tinted(scene, 'ui', UI.ribbonM)).setTileScale(SCALE);
  const l = sprite(scene, x - w / 2 + 24, y, 'ui', UI.ribbonL);
  const r = sprite(scene, x + w / 2 - 24, y, 'ui', UI.ribbonR);
  return [mid, l, r];
}

// 메뉴·퀴즈 화면 배경: 남색 던전 벽 + 장식 (움직이지 않는다)
export function backdrop(scene, theme = MENU_THEME) {
  const { W, H } = LAYOUT;
  scene.cameras.main.setBackgroundColor(theme.bg);
  const wall = tiles(scene, 0, 0, W, H, ['td', TD.wall, theme.wall]).setAlpha(0.16);
  const deco = [[120, TD.banner], [W - 120, TD.banner]].map(([x, f]) => sprite(scene, x, 110, 'td', f).setAlpha(0.5));
  return [wall, ...deco];
}

// 화면 바뀔 때 살짝 밝아지며 나타나기 ('움직임 줄이기' 설정이면 하지 않는다)
export function fadeIn(scene) {
  if (reducedMotion()) return;
  scene.cameras.main.fadeIn(180, 20, 28, 48);
}

export function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// 코인이 위로 떠오르며 사라지는 연출 (정답 +10, 획득)
export function coinPop(scene, x, y, label, color) {
  const c = scene.add.sprite(x, y, 'pp', PP.coin).setScale(SCALE).play('coin_spin').setDepth(20);
  const t = scene.add.text(x + 22, y, label, { fontFamily: FONT_PIXEL, fontSize: '24px', color }).setOrigin(0, 0.5).setDepth(20);
  scene.tweens.add({ targets: [c, t], y: y - 50, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => { c.destroy(); t.destroy(); } });
}

// 반짝이 입자 한 번 터뜨리기 (클리어·정답)
export function sparkle(scene, x, y, color = 0xffd54f, count = 16) {
  if (reducedMotion()) return;
  const e = scene.add.particles(x, y, dot(scene, color), {
    speed: { min: 80, max: 220 }, angle: { min: 0, max: 360 }, scale: { start: 3, end: 0 },
    lifespan: 600, gravityY: 300, emitting: false,
  }).setDepth(20);
  e.explode(count);
  scene.time.delayedCall(800, () => e.destroy());
}
