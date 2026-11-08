import { LAYOUT, GUIDE_TEXT } from '../config.js';
import { resetGame } from '../state.js';
import { setQuestions } from '../questions.js';
import { text, createButton, createGuide } from '../ui.js';

export default class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  preload() {
    this.load.json('questions', 'questions.json');
  }

  create() {
    setQuestions(this.cache.json.get('questions'));
    const cx = LAYOUT.W / 2;
    text(this, cx, 200, '퀴즈 던전 (가제)', 'body').setOrigin(0.5);
    text(this, cx, 240, '퀴즈로 코인을 모으고, 대시로 장애물 코스를 돌파하세요', 'small').setOrigin(0.5);
    createButton(this, cx, 330, '시작', () => {
      resetGame();
      this.scene.start('WorldMap');
    }, { primary: true });
    createGuide(this, GUIDE_TEXT);
  }
}
