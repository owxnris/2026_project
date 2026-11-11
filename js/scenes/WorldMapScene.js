import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { createButton, createHud, createGuide } from '../ui.js';
import { reportProgress } from '../progress.js';

export default class WorldMapScene extends Phaser.Scene {
  constructor() { super('WorldMap'); }

  create() {
    this.hud = createHud(this, '월드맵');
    createGuide(this, '도전할 던전을 고르세요 · 앞 던전을 깨면 다음 던전이 열려요');
    reportProgress(null);

    DUNGEONS.forEach((d, i) => {
      const x = 200 + i * 280;
      let status;
      if (!d.level) status = '준비 중';
      else if (state.cleared[i]) status = '클리어';
      else if (i <= state.unlocked) status = '도전 가능';
      else status = '잠김';

      const playable = d.level && i <= state.unlocked;
      const onClick = playable ? () => this.scene.start('Quiz', { mode: 'entry', dungeon: i }) : null;
      const btn = createButton(this, x, 280, `${d.name}\n${status}`, onClick, {
        primary: status === '도전 가능',
        w: 240,
        h: 120,
      });
      if (!playable) btn.setAlpha(0.4);
    });
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
  }
}
