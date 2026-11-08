// mode 'clear': 던전 클리어 → 월드맵 / mode 'timeout': 전체 시간 종료 → 처음으로
import { CSS, LAYOUT } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { text, createButton, createHud } from '../ui.js';

export default class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) {
    this.mode = data.mode;
    this.dungeon = data.dungeon;
  }

  create() {
    const cx = LAYOUT.W / 2;
    this.hud = createHud(this, '결과');

    if (this.mode === 'clear') {
      text(this, cx, 200, `${DUNGEONS[this.dungeon].name} 클리어!`, 'body', CSS.good).setOrigin(0.5);
      text(this, cx, 240, '남은 코인은 사라졌어요', 'small').setOrigin(0.5);
      createButton(this, cx, 330, '월드맵으로', () => this.scene.start('WorldMap'), { primary: true });
    } else {
      const count = state.cleared.filter(Boolean).length;
      text(this, cx, 200, '시간 종료!', 'body', CSS.bad).setOrigin(0.5);
      text(this, cx, 240, `클리어한 던전: ${count}개`, 'small').setOrigin(0.5);
      createButton(this, cx, 330, '처음으로', () => this.scene.start('Start'), { primary: true });
    }
  }

  update() {
    if (this.mode === 'clear' && checkTimeout(this)) return;
    this.hud.update();
  }
}
