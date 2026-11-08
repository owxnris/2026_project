// mode 'entry': 던전 입장 전 3문제 → 던전 시작
// mode 'revive': 코인이 0개가 됐을 때 던전 위에 뜸 → 맞힐 때까지 계속 출제
import { COLORS, LAYOUT, RULES } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { nextQuestion } from '../questions.js';
import { text, createButton, createHud } from '../ui.js';

const { W, H, GUIDE_H } = LAYOUT;
const BAR_W = 800;
const OPTION_POS = [[270, 320], [690, 320], [270, 400], [690, 400]];

export default class QuizScene extends Phaser.Scene {
  constructor() { super('Quiz'); }

  init(data) {
    this.mode = data.mode;
    this.dungeon = data.dungeon;
    this.count = 0;
    this.items = [];
  }

  create() {
    this.add.rectangle(0, 0, W, H, COLORS.bg).setOrigin(0);
    const title = this.mode === 'entry' ? `${DUNGEONS[this.dungeon].name} 입장 퀴즈` : '코인 회복 퀴즈';
    if (this.mode === 'entry') state.coins = 0;
    this.hud = createHud(this, title);
    this.bar = this.add.rectangle((W - BAR_W) / 2, H - GUIDE_H / 2, BAR_W, 8, COLORS.player).setOrigin(0, 0.5);
    this.showQuestion();
  }

  showQuestion() {
    this.items.forEach((it) => it.destroy());
    this.items = [];
    this.q = nextQuestion();
    this.answered = false;
    this.startTime = this.time.now;

    const head = this.mode === 'entry'
      ? `문제 ${this.count + 1}/${RULES.ENTRY_QUIZ_COUNT} · ${this.q.subject}`
      : `정답을 맞혀야 다시 움직일 수 있어요 · ${this.q.subject}`;
    this.items.push(text(this, W / 2, 90, head, 'small').setOrigin(0.5));
    this.items.push(text(this, W / 2, 180, this.q.question, 'body')
      .setOrigin(0.5).setWordWrapWidth(860));

    this.options = this.q.choices.map((c, i) => {
      const [x, y] = OPTION_POS[i];
      return createButton(this, x, y, c, () => this.answer(i), { w: 400, h: 64 });
    });
    this.items.push(...this.options);
  }

  answer(i) {
    if (this.answered) return;
    this.answered = true;
    this.options.forEach((o) => o.disable());

    const correct = i === this.q.answer;
    this.options[this.q.answer].setBorder(COLORS.good);
    if (i >= 0 && !correct) this.options[i].setBorder(COLORS.bad);
    if (correct) state.coins += RULES.COIN_PER_CORRECT;
    this.hud.update();

    this.time.delayedCall(1000, () => this.next(correct));
  }

  next(correct) {
    if (state.timedOut) return;
    if (this.mode === 'entry') {
      this.count += 1;
      if (this.count < RULES.ENTRY_QUIZ_COUNT) this.showQuestion();
      else this.scene.start('Dungeon', { dungeon: this.dungeon });
    } else if (correct) {
      this.scene.stop();
      this.scene.resume('Dungeon');
    } else {
      this.showQuestion();
    }
  }

  update(time) {
    if (checkTimeout(this)) return;
    this.hud.update();
    if (this.answered) return;

    const left = RULES.QUIZ_TIME_SEC - (time - this.startTime) / 1000;
    this.bar.setScale(Math.max(0, left) / RULES.QUIZ_TIME_SEC, 1);
    this.bar.setFillStyle(left <= 5 ? COLORS.bad : COLORS.player);
    if (left <= 0) this.answer(-1); // 시간 초과는 오답 처리
  }
}
