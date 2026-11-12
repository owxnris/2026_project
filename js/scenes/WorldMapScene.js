// 월드맵: 던전 3개를 카드로 (던전 분위기 색 바탕 + 몬스터 + 상태). 잠긴 던전은 흐리게
import { CSS } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { text, createHud, createGuide } from '../ui.js';
import { reportProgress } from '../progress.js';
import {
  backdrop, fadeIn, panel, sprite, tiles, THEMES, UI, TD, PP, SCALE,
} from '../art.js';

export default class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap'); }

  create() {
    backdrop(this);
    fadeIn(this);
    this.hud = createHud(this, '월드맵');
    createGuide(this, '도전할 던전을 고르세요 · 앞 던전을 깨면 다음 던전이 열려요');
    reportProgress(null);
    this.cards = DUNGEONS.map((d, i) => this.card(d, i, 200 + i * 280, 280));
  }

  card(d, i, x, y) {
    let status;
    if (!d.level) status = '준비 중';
    else if (state.cleared[i]) status = '클리어';
    else if (i <= state.unlocked) status = '도전 가능';
    else status = '잠김';
    const playable = d.level && i <= state.unlocked;
    const th = THEMES[i];
    const w = 240;
    const h = 300;
    const parts = [];
    const add = (o) => { parts.push(o); return o; };

    add(panel(this, x, y, w, h, status === '도전 가능' ? UI.parchment : UI.stone, status === '도전 가능' ? 0xffd54f : 0xffffff));
    // 작은 무대: 던전 색 바탕 + 발판 + 몬스터
    add(this.add.rectangle(x, y - 40, w - 36, 150, th.bg));
    add(tiles(this, x - (w - 36) / 2, y + 5, w - 36, 30, th.top));
    add(sprite(this, x - 40, y + 10, 'td', TD.hero).setOrigin(0.5, 1));
    const m = add(sprite(this, x + 45, y + 10, 'td', th.ground[0]).setOrigin(0.5, 1).setFlipX(true));
    add(sprite(this, x + 60, y - 70, 'td', th.flyer));
    add(text(this, x, y + 65, d.name, 'body', status === '도전 가능' ? CSS.bg : CSS.player).setOrigin(0.5));
    add(text(this, x, y + 105, status, 'small', status === '도전 가능' ? CSS.bg : status === '클리어' ? CSS.good : CSS.player).setOrigin(0.5));
    if (status === '클리어') add(this.add.image(x + 85, y - 105, 'star').setScale(SCALE));
    if (status === '잠김') add(sprite(this, x, y - 40, 'pp', PP.lock));
    if (playable) {
      this.tweens.add({ targets: m, scaleY: SCALE * 0.88, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      add(this.add.zone(x, y, w, h)).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('Quiz', { mode: 'entry', dungeon: i }));
    } else {
      parts.forEach((p) => p.setAlpha(0.4));
    }
    return { status, parts };
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
  }
}
