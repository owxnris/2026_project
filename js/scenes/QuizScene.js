// mode 'entry': 던전 입장 전 3문제 → 던전 시작
// mode 'revive': 코인이 0개가 됐을 때 던전 위에 뜸 → 맞힐 때까지 계속 출제
// 문제와 채점은 quiz.js가 맡는다 (온라인이면 서버 채점: 학생 기기는 답을 낸 뒤에야 정답 보기를 안다)
import { COLORS, CSS, LAYOUT, RULES } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { session } from '../session.js';
import { beginRun, nextQuestion, submitAnswer } from '../quiz.js';
import { errorReason } from '../firebase/server.js';
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
    this.answered = true; // 문제가 화면에 나오기 전에는 시간 막대를 멈춘다
  }

  create() {
    this.alive = true;
    this.events.once('shutdown', () => { this.alive = false; });
    this.add.rectangle(0, 0, W, H, COLORS.bg).setOrigin(0);
    const title = this.mode === 'entry' ? `${DUNGEONS[this.dungeon].name} 입장 퀴즈` : '코인 회복 퀴즈';
    if (this.mode === 'entry') state.coins = 0;
    this.hud = createHud(this, title);
    this.bar = this.add.rectangle((W - BAR_W) / 2, H - GUIDE_H / 2, BAR_W, 8, COLORS.player).setOrigin(0, 0.5);
    if (this.mode === 'entry') this.request(() => beginRun(this.dungeon), () => this.showQuestion());
    else this.showQuestion();
  }

  clearItems() {
    this.items.forEach((it) => it.destroy());
    this.items = [];
  }

  // 서버 요청 하나: 기다리는 동안 안내, 실패하면 빨간 안내와 '다시 시도'
  async request(job, then) {
    let res;
    try {
      res = await job();
    } catch (e) {
      if (!this.alive) return;
      if (errorReason(e) === 'activity-not-running') {
        session.ended = true; // 활동이 끝났다 → checkTimeout이 최종 결과 화면으로 보낸다
        return;
      }
      this.showError(`서버와 연결하지 못했어요 (${errorReason(e)})`, () => this.request(job, then));
      return;
    }
    if (this.alive) then(res);
  }

  showError(msg, retry) {
    this.errorItems?.forEach((it) => it.destroy());
    const t = text(this, W / 2, 470, msg, 'small', CSS.bad).setOrigin(0.5);
    const b = createButton(this, W / 2 + 330, 470, '다시 시도', () => {
      this.errorItems.forEach((it) => it.destroy());
      this.errorItems = [];
      retry();
    }, { w: 160, h: 40 });
    this.errorItems = [t, b];
  }

  showQuestion() {
    this.clearItems();
    const loading = text(this, W / 2, 180, '문제를 받는 중…', 'small').setOrigin(0.5);
    this.items.push(loading);
    this.request(() => nextQuestion(this.mode), (item) => this.renderQuestion(item));
  }

  renderQuestion(item) {
    this.clearItems();
    this.item = item;
    const q = item.question;
    this.answered = false;
    this.startTime = this.time.now;
    this.limitSec = item.timeLimitSec;

    const head = this.mode === 'entry'
      ? `문제 ${this.count + 1}/${RULES.ENTRY_QUIZ_COUNT} · ${q.subject}`
      : `정답을 맞혀야 다시 움직일 수 있어요 · ${q.subject}`;
    this.items.push(text(this, W / 2, 90, head, 'small').setOrigin(0.5));
    this.items.push(text(this, W / 2, 180, q.question, 'body')
      .setOrigin(0.5).setWordWrapWidth(860));

    this.options = q.choices.map((c, i) => {
      const [x, y] = OPTION_POS[i];
      return createButton(this, x, y, c, () => this.answer(i), { w: 400, h: 64 });
    });
    this.items.push(...this.options);
  }

  answer(i) {
    if (this.answered) return;
    this.answered = true;
    this.options.forEach((o) => o.disable());
    const chosen = i >= 0 ? i : null; // 시간 초과는 null (오답)
    this.request(() => submitAnswer(this.item, chosen), ({ correct, correctIndex }) => {
      this.options[correctIndex].setBorder(COLORS.good);
      if (chosen !== null && !correct) this.options[chosen].setBorder(COLORS.bad);
      if (correct) state.coins += RULES.COIN_PER_CORRECT;
      this.hud.update();
      this.time.delayedCall(1000, () => this.next(correct));
    });
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

    const left = this.limitSec - (time - this.startTime) / 1000;
    this.bar.setScale(Math.max(0, left) / RULES.QUIZ_TIME_SEC, 1);
    this.bar.setFillStyle(left <= 5 ? COLORS.bad : COLORS.player);
    if (left <= 0) this.answer(-1); // 시간 초과는 오답 처리
  }
}
