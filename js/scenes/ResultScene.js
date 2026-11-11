// mode 'clear': 던전 클리어 → 월드맵 / mode 'timeout': 전체 시간 종료 / mode 'ended': 교사가 활동 종료 → 처음으로
// 온라인이면 끝난 판의 결과를 서버에 저장한다 (클리어 cleared / 시간 종료·교사 종료 failed). 실패하면 '다시 시도'
import { CSS, LAYOUT } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { leaveActivity } from '../session.js';
import { hasOpenRun, finishRun, playStats } from '../quiz.js';
import { errorReason } from '../firebase/server.js';
import { text, createButton, createHud } from '../ui.js';

const cx = LAYOUT.W / 2;

export default class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) {
    this.mode = data.mode;
    this.dungeon = data.dungeon;
    this.stats = data.stats;
  }

  create() {
    this.alive = true;
    this.events.once('shutdown', () => { this.alive = false; });
    this.hud = createHud(this, '결과');

    if (this.mode === 'clear') {
      text(this, cx, 200, `${DUNGEONS[this.dungeon].name} 클리어!`, 'body', CSS.good).setOrigin(0.5);
      text(this, cx, 240, '남은 코인은 사라졌어요', 'small').setOrigin(0.5);
      createButton(this, cx, 330, '월드맵으로', () => this.scene.start('WorldMap'), { primary: true });
    } else {
      const count = state.cleared.filter(Boolean).length;
      const head = this.mode === 'ended' ? '선생님이 활동을 끝냈어요' : '시간 종료!';
      text(this, cx, 200, head, 'body', CSS.bad).setOrigin(0.5);
      text(this, cx, 240, `클리어한 던전: ${count}개`, 'small').setOrigin(0.5);
      createButton(this, cx, 330, '처음으로', () => {
        leaveActivity();
        this.scene.start('Start');
      }, { primary: true });
    }

    if (hasOpenRun()) {
      const outcome = this.mode === 'clear' ? 'cleared' : 'failed';
      this.save(outcome, this.mode === 'clear' ? this.stats : playStats(false));
    }
  }

  async save(outcome, stats) {
    this.saveItems?.forEach((it) => it.destroy());
    const status = text(this, cx, 410, '결과를 저장하는 중…', 'small').setOrigin(0.5);
    this.saveItems = [status];
    try {
      await finishRun(outcome, stats);
      if (this.alive) status.setText('결과를 저장했어요');
    } catch (e) {
      if (!this.alive) return;
      status.setText(`결과를 저장하지 못했어요 (${errorReason(e)})`).setColor(CSS.bad);
      this.saveItems.push(createButton(this, cx, 460, '다시 시도', () => this.save(outcome, stats), { w: 160, h: 40 }));
    }
  }

  update() {
    if (this.mode === 'clear' && checkTimeout(this)) return;
    this.hud.update();
  }
}
