// 던전 지도: 방 8개를 길로 잇는다. 클리어(금색·별) / 도전 가능(금색 테두리, 통통) / 잠김(흐림·자물쇠)
// 방을 누르면 아래 안내 칸에 이름·설명·안내자 퀘스트가 나오고 '입장하기'로 들어간다.
// 처음 열면 지금 도전할 방(이어서 모험하기)이 골라져 있다. 모험을 처음 시작하면 프롤로그를 한 번 보여 준다
import { CSS, COLORS, LAYOUT } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout, clearedRoomCount } from '../state.js';
import {
  text, createButton, createHud, createGuide, createBackButton,
} from '../ui.js';
import { reportProgress } from '../progress.js';
import { playMusic } from '../music.js';
import { balance } from '../cosmetics.js';
import { ROOMS, PROLOGUE, GUIDE_NAME } from '../story.js';
import { prologueSeen, markPrologueSeen } from '../firebase/adventure.js';
import {
  backdrop, fadeIn, panel, sprite, THEMES, UI, TD, PP, SCALE,
} from '../art.js';

const { W } = LAYOUT;
// 방 위치: 왼쪽 아래에서 오른쪽 위로 굽이치는 길 (고정)
const POS = [[90, 330], [205, 235], [320, 320], [435, 225], [550, 310], [665, 215], [780, 300], [880, 190]];

export default class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap'); }

  create() {
    backdrop(this);
    fadeIn(this);
    playMusic('map');
    this.hud = createHud(this, '', { back: true });
    this.guide = createGuide(this, '방을 눌러 고르고 \'입장하기\' · 방을 깨면 다음 방이 열려요');
    createBackButton(this, () => this.scene.start('Start'), {
      warn: (m) => this.guide.notice(m, CSS.bad), message: '한 번 더 누르면 처음 화면으로 가요 · 같은 닉네임으로 다시 들어오면 이어서 해요',
    });
    reportProgress(null);
    createButton(this, 870, 96, '꾸미기', () => this.scene.start('Wardrobe'), { w: 140, h: 44 });
    this.drawPath();
    this.cards = DUNGEONS.map((d, i) => this.room(d, i));
    this.infoItems = [];
    // 이어서 모험하기: 지금 도전할 방(깬 방 다음)을 골라 둔다
    this.select(Math.min(clearedRoomCount(), DUNGEONS.length - 1));
    if (clearedRoomCount() === 0 && !prologueSeen()) this.showPrologue();
  }

  status(i) {
    if (state.cleared[i]) return '클리어';
    if (i <= state.unlocked) return '도전 가능';
    return '잠김';
  }

  drawPath() {
    const g = this.add.graphics();
    for (let i = 0; i < POS.length - 1; i += 1) {
      const open = i + 1 <= state.unlocked;
      g.lineStyle(8, open ? COLORS.good : 0x5a6488, open ? 0.85 : 0.6);
      g.lineBetween(POS[i][0], POS[i][1], POS[i + 1][0], POS[i + 1][1]);
    }
  }

  // 방 하나: 테마 몬스터 그림이 든 돌·금색 패널 + 번호
  room(d, i) {
    const [x, y] = POS[i];
    const st = this.status(i);
    const th = THEMES[d.theme ?? 0];
    const parts = [];
    const add = (o) => { parts.push(o); return o; };
    const frame = st === '클리어' ? UI.parchment : UI.stone;
    const tint = st === '잠김' ? 0x8090a8 : (st === '클리어' ? COLORS.good : 0xffffff);
    const base = add(panel(this, x, y, 84, 84, frame, tint));
    add(this.add.rectangle(x, y, 60, 60, th.bg));
    const m = add(sprite(this, x, y + 4, 'td', i % 2 ? th.flyer : th.ground[i % th.ground.length]));
    add(text(this, x - 30, y - 32, String(i + 1), 'small', st === '클리어' ? CSS.bg : CSS.player).setOrigin(0.5).setStroke('#1B1F2A', st === '클리어' ? 0 : 4));
    if (st === '클리어') add(this.add.image(x + 32, y - 32, 'star').setScale(2));
    if (st === '잠김') {
      parts.forEach((p) => p.setAlpha(0.45));
      add(sprite(this, x, y + 4, 'pp', PP.lock, 2.4));
    }
    if (st === '도전 가능') {
      // 지금 도전할 방은 통통 뛰며 눈에 띄게
      this.tweens.add({ targets: base, scale: SCALE * 1.08, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: m, y: y - 2, duration: 300, yoyo: true, repeat: -1 });
    }
    add(text(this, x, y + 54, d.name, 'small', st === '잠김' ? CSS.player : CSS.good).setOrigin(0.5).setAlpha(st === '잠김' ? 0.5 : 1).setFontSize(14));
    this.add.zone(x, y, 96, 110).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.select(i));
    return { status: st, parts };
  }

  // 아래 안내 칸: 고른 방의 이름·설명·퀘스트(안내자)·입장 버튼
  select(i) {
    this.selected = i;
    this.infoItems.forEach((o) => o.destroy());
    const d = DUNGEONS[i];
    const st = this.status(i);
    const y = 438;
    const items = [
      panel(this, W / 2, y, W - 60, 92, UI.wood, 0x8a6a8a).setAlpha(0.95),
      sprite(this, 70, y + 4, 'td', TD.wizard),
      text(this, 108, y - 30, `${i + 1}. ${d.name} — ${ROOMS[i]?.desc ?? ''}`, 'small', CSS.good).setOrigin(0, 0.5),
      text(this, 108, y + 2, `${GUIDE_NAME}: ${ROOMS[i]?.quest ?? ''}`, 'small').setOrigin(0, 0.5).setWordWrapWidth(560).setFontSize(14),
    ];
    if (st === '잠김') {
      items.push(text(this, 760, y, '앞 방을 깨면 열려요', 'small').setOrigin(0.5).setAlpha(0.7));
    } else {
      const label = st === '클리어' ? '다시 도전' : '입장하기';
      const b = createButton(this, 790, y + 2, label, () => this.scene.start('Quiz', { mode: 'entry', dungeon: i }), { primary: st === '도전 가능', w: 150, h: 48 });
      items.push({ destroy: () => b.destroy() });
    }
    this.infoItems = items;
  }

  // 프롤로그: 안내자가 짧게 모험을 소개한다 (처음 한 번)
  showPrologue() {
    const items = [];
    const close = () => { items.forEach((o) => o.destroy()); markPrologueSeen(); };
    items.push(this.add.rectangle(W / 2, LAYOUT.H / 2, W, LAYOUT.H, 0x0b1020, 0.75).setInteractive().setDepth(10.5));
    items.push(panel(this, W / 2, 260, 640, 280, UI.wood, 0x8a6a8a).setDepth(11));
    items.push(sprite(this, W / 2, 170, 'td', TD.wizard, SCALE + 1).setDepth(11.5));
    PROLOGUE.forEach((line, k) => items.push(text(this, W / 2, 230 + k * 36, line, 'small').setOrigin(0.5).setDepth(11.5).setWordWrapWidth(580)));
    const b = createButton(this, W / 2, 360, '모험 시작!', close, { primary: true, w: 200, h: 52, fixed: true }); // 덮개 위에 그려지도록
    items.push({ destroy: () => b.destroy() });
    this.prologue = { close };
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
    this.hud.setTitle(`던전 지도 · 깬 방 ${clearedRoomCount()}/${DUNGEONS.length} · 골드 ${balance(state.gold, state.style.spent)}`); // 쓸 수 있는 골드
  }
}
