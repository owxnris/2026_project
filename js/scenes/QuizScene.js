// mode 'entry': 던전 입장 전 3문제 → 던전 시작
// mode 'revive': 코인이 0개가 됐을 때 던전 위에 뜸 → 맞힐 때까지 계속 출제
// 문제와 채점은 quiz.js가 맡는다 (화면은 답을 낸 뒤에야 정답 보기를 보여 준다)
import { reasonText } from '../firebase/errors.js';
import { play } from '../sound.js';
import { COLORS, CSS, LAYOUT, RULES } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout, recordQuiz } from '../state.js';
import { reportProgress } from '../progress.js';
import { session } from '../session.js';
import { beginRun, nextQuestion, submitAnswer, hasOpenRun } from '../quiz.js';
import { liveBoard } from '../firebase/goldrush.js';
import { errorReason } from '../firebase/clock.js';
import {
  text, createButton, createHud, createBackButton,
} from '../ui.js';
import {
  backdrop, fadeIn, panel, coinPop, sparkle, UI,
} from '../art.js';
import { playMusic } from '../music.js';

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
    backdrop(this);
    fadeIn(this);
    if (this.mode === 'entry') playMusic('map'); // 회복 퀴즈는 던전 음악을 그대로
    if (this.mode === 'rush') playMusic('dungeon1');
    panel(this, W / 2, 150, 900, 150, UI.wood, 0x8a6a8a).setAlpha(0.92);
    const title = this.mode === 'entry' ? `${DUNGEONS[this.dungeon].name} 입장 퀴즈` : this.mode === 'rush' ? '골드 러시! 정답마다 골드 10' : '코인 회복 퀴즈';
    if (this.mode === 'entry') state.coins = 0;
    // 입장 퀴즈에서만 뒤로 갈 수 있다 (회복 퀴즈는 맞혀야 던전으로 돌아간다)
    this.hud = createHud(this, title, { back: this.mode === 'entry' });
    if (this.mode === 'entry') {
      const warnText = text(this, W / 2, H - GUIDE_H / 2, '', 'small', CSS.bad).setOrigin(0.5).setDepth(11);
      createBackButton(this, () => this.scene.start('WorldMap'), {
        warn: (m) => { warnText.setText(m); this.time.delayedCall(2500, () => warnText.setText('')); },
        message: '한 번 더 누르면 월드맵으로 가요 · 이번 판은 그만둬요',
      });
    }
    this.bar = this.add.rectangle((W - BAR_W) / 2, H - GUIDE_H / 2, BAR_W, 8, COLORS.player).setOrigin(0, 0.5);
    if (this.mode === 'rush') this.setupRush();
    if (this.mode === 'entry') this.request(() => beginRun(this.dungeon), () => this.showQuestion());
    // 골드 러시: 한 이벤트에 판 하나 (현황 화면에 다녀와도 이어서)
    else if (this.mode === 'rush' && !hasOpenRun()) this.request(() => beginRun(0), () => this.showQuestion());
    else this.showQuestion();
  }

  clearItems() {
    this.items.forEach((it) => it.destroy());
    this.items = [];
  }

  // Firestore 요청 하나: 기다리는 동안 안내, 실패하면 빨간 안내와 '다시 시도'
  async request(job, then) {
    let res;
    try {
      res = await job();
    } catch (e) {
      if (!this.alive) return;
      const reason = errorReason(e);
      if (reason === 'activity-not-running') {
        session.ended = true; // 활동이 끝났다 → checkTimeout이 최종 결과 화면으로 보낸다
        return;
      }
      if (reason === 'run-finished') {
        // 이 판은 이미 끝났다 (예: 다른 창에서 새 판을 시작함)
        this.showRunClosed();
        return;
      }
      this.showError(`연결하지 못했어요 (${reasonText(e)})`, () => this.request(job, then));
      return;
    }
    if (this.alive) then(res);
  }

  showError(msg, retry) {
    this.errorItems?.forEach((it) => it.destroy());
    const t = text(this, W / 2, 470, msg, 'small', CSS.bad).setOrigin(0.5);
    // 다시 시도해도 같은 문제의 답은 한 번만 채점하므로 코인이 두 번 오르지 않는다
    this.retry = () => {
      this.errorItems.forEach((it) => it.destroy());
      this.errorItems = [];
      retry();
    };
    const b = createButton(this, W / 2 + 330, 470, '다시 시도', this.retry, { w: 160, h: 40 });
    this.errorItems = [t, b];
  }

  showRunClosed() {
    this.clearItems();
    this.answered = true;
    this.items.push(text(this, W / 2, 200, '이 판은 이미 끝났어요 (다른 창에서 새로 시작했을 수 있어요)', 'body', CSS.bad).setOrigin(0.5));
    this.items.push(createButton(this, W / 2, 300, '월드맵으로', () => {
      this.scene.stop('Dungeon');
      this.scene.start('WorldMap');
    }, { primary: true }));
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
      : this.mode === 'rush' ? `골드 러시 ${this.count + 1}번째 문제 · ${q.subject}`
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
      if (correct) {
        state.coins += RULES.COIN_PER_CORRECT;
        const [ox, oy] = OPTION_POS[correctIndex];
        coinPop(this, ox, oy - 40, `+${RULES.COIN_PER_CORRECT}`, CSS.good);
        sparkle(this, ox, oy, 0xffd54f, 18);
      }
      recordQuiz(correct, this.mode);
      const q = this.item.question; // 학생 맞춤 복습 기록 (최종 결과 화면)
      state.reviewLog.push({
        id: q.id, subject: q.subject, concept: this.item.concept, question: q.question, choices: q.choices, chosen, correctIndex, correct,
      });
      play(correct ? 'correct' : 'wrong');
      if (correct) reportProgress();
      this.items.push(text(this, W / 2, 470, correct ? `정답! ${this.mode === 'rush' ? '골드' : '코인'} +${RULES.COIN_PER_CORRECT}` : (chosen === null ? '시간 초과 — 금색 테두리가 정답이에요' : '오답 — 금색 테두리가 정답이에요'), 'small', correct ? CSS.good : CSS.bad).setOrigin(0.5));
      this.hud.update();
      this.time.delayedCall(1000, () => this.next(correct));
    });
  }

  next(correct) {
    if (state.timedOut) return;
    if (this.mode === 'rush') {
      this.count += 1;
      this.showQuestion();
    } else if (this.mode === 'entry') {
      this.count += 1;
      if (this.count < RULES.ENTRY_QUIZ_COUNT) this.showQuestion();
      else this.scene.start('Shop', { dungeon: this.dungeon });
    } else if (correct) {
      this.scene.stop();
      this.scene.resume('Dungeon');
    } else {
      this.showQuestion();
    }
  }

  // 골드 러시: 왼쪽 위 '현황'(이벤트 화면) 버튼과 오른쪽 위 실시간 내 순위·참가자 수 (Firestore 실제 데이터)
  setupRush() {
    createBackButton(this, () => this.scene.start('GoldRush'));
    this.rushInfo = text(this, W - 20, 78, '', 'small', CSS.good).setOrigin(1, 0.5).setDepth(11);
    this.stopBoard = liveBoard((b) => {
      if (!this.alive) return;
      const me = b.rank ? `내 순위 ${b.rank}위 · ` : '';
      this.rushInfo.setText(`${me}참가 ${b.participants}명 · 총 골드 ${b.totalGold}`);
    });
    this.events.once('shutdown', () => this.stopBoard?.());
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
