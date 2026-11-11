// mode 'clear': 던전 클리어 → 월드맵 / mode 'timeout': 전체 시간 종료 / mode 'ended': 교사가 활동 종료 → 최종 결과
// 결과 화면 (design.md): 제목 → 별 3개 → 획득 내역 → 구분선 → 합계 → 보상 → 주 버튼
// 별 기준(기본값, spec.md): 클리어 / 입장 퀴즈 3문제 모두 정답 / 충돌 0번
// 온라인이면 끝난 판의 결과를 Firestore에 저장한다 (클리어 cleared / 시간 종료·교사 종료 failed). 실패하면 '다시 시도'
import { reasonText } from '../firebase/errors.js';
import { COLORS, CSS, LAYOUT, RULES } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { leaveActivity } from '../session.js';
import { hasOpenRun, finishRun, playStats } from '../quiz.js';
import { errorReason } from '../firebase/clock.js';
import { text, createButton, createHud } from '../ui.js';

const { W } = LAYOUT;
const cx = W / 2;
const LEFT = 300;
const RIGHT = 660;

export function starsOf(play) {
  return [true, play.entryCorrect === RULES.ENTRY_QUIZ_COUNT, play.hits === 0];
}

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
    const open = hasOpenRun();
    if (this.mode === 'clear') this.drawClear();
    else this.drawFinal();
    if (open) {
      const outcome = this.mode === 'clear' ? 'cleared' : 'failed';
      this.save(outcome, this.mode === 'clear' ? this.stats : playStats(false));
    }
  }

  line(y, label, value) {
    text(this, LEFT, y, label, 'small').setOrigin(0, 0.5);
    text(this, RIGHT, y, String(value), 'small').setOrigin(1, 0.5);
  }

  drawClear() {
    const p = state.play;
    text(this, cx, 82, `${DUNGEONS[this.dungeon].name} 클리어!`, 'body', CSS.good).setOrigin(0.5);
    starsOf(p).forEach((got, i) => {
      this.add.star(cx - 50 + i * 50, 125, 5, 9, 20, got ? COLORS.good : COLORS.player, got ? 1 : 0.4);
    });
    text(this, cx, 155, '별: 클리어 · 입장 퀴즈 모두 정답 · 충돌 0번', 'small').setOrigin(0.5).setAlpha(0.6);
    this.line(185, '맞힌 문제', `${p.quizCorrect} / ${p.quizTotal}`);
    this.line(210, '능력에 쓴 코인', this.stats.coinsSpent);
    this.line(235, '충돌 · 추락', `${p.hits}번 · ${p.falls}번`);
    this.line(260, '클리어 시간', `${this.stats.clearSec}초`);
    this.add.rectangle(LEFT, 280, RIGHT - LEFT, 1, COLORS.player, 0.2).setOrigin(0, 0.5);
    text(this, LEFT, 306, '얻은 코인', 'body').setOrigin(0, 0.5);
    text(this, RIGHT, 306, String(p.quizCorrect * RULES.COIN_PER_CORRECT), 'big', CSS.good).setOrigin(1, 0.5);
    const next = DUNGEONS[this.dungeon + 1];
    const reward = next?.level ? `다음 던전 '${next.name}'이(가) 열렸어요` : '준비된 던전을 모두 클리어했어요';
    this.add.rectangle(cx, 352, RIGHT - LEFT, 36, COLORS.player, 0.1);
    text(this, cx, 352, `${reward} · 남은 코인은 사라졌어요`, 'small').setOrigin(0.5);
    createButton(this, cx, 410, '월드맵으로', () => this.scene.start('WorldMap'), { primary: true });
  }

  // 최종 결과 (시간 종료·교사 종료): 이번 활동 전체
  drawFinal() {
    const count = state.cleared.filter(Boolean).length;
    const head = this.mode === 'ended' ? '선생님이 활동을 끝냈어요' : '시간 종료!';
    text(this, cx, 110, head, 'body', CSS.bad).setOrigin(0.5);
    text(this, cx, 150, '이번 활동 최종 결과', 'small').setOrigin(0.5).setAlpha(0.6);
    this.line(195, '클리어한 던전', `${count}개`);
    this.line(225, '맞힌 문제', `${state.totalCorrect} / ${state.totalQuiz}`);
    const rate = state.totalQuiz ? Math.round((state.totalCorrect / state.totalQuiz) * 100) : 0;
    this.add.rectangle(LEFT, 250, RIGHT - LEFT, 1, COLORS.player, 0.2).setOrigin(0, 0.5);
    text(this, LEFT, 280, '정답률', 'body').setOrigin(0, 0.5);
    text(this, RIGHT, 280, `${rate}%`, 'big', CSS.good).setOrigin(1, 0.5);
    createButton(this, cx, 350, '처음으로', () => {
      leaveActivity();
      this.scene.start('Start');
    }, { primary: true });
  }

  async save(outcome, stats) {
    this.saveItems?.forEach((it) => it.destroy());
    const status = text(this, cx, 465, '결과를 저장하는 중…', 'small').setOrigin(0.5);
    this.saveItems = [status];
    try {
      const res = await finishRun(outcome, stats);
      if (!this.alive) return;
      status.setText(res?.already && outcome === 'cleared'
        ? '이 판은 이미 끝난 판으로 저장돼 있어요 (다른 창에서 새로 시작함)'
        : '결과를 저장했어요');
    } catch (e) {
      if (!this.alive) return;
      status.setText(`결과를 저장하지 못했어요 (${reasonText(e)})`).setColor(CSS.bad);
      this.saveItems.push(createButton(this, cx + 330, 465, '다시 시도', () => this.save(outcome, stats), { w: 160, h: 40 }));
    }
  }

  update() {
    if (this.mode === 'clear' && checkTimeout(this)) return;
    this.hud.update();
  }
}
