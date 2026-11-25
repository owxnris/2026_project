// mode 'clear': 던전 클리어 → 월드맵 / mode 'timeout': 전체 시간 종료 / mode 'ended': 교사가 활동 종료 → 최종 결과
// 결과 화면 (design.md): 제목 → 별 3개 → 획득 내역 → 구분선 → 합계 → 보상 → 주 버튼
// 별 기준(기본값, spec.md): 클리어 / 푼 입장 퀴즈 모두 정답 / 충돌 0번
// 온라인이면 끝난 판의 결과를 Firestore에 저장한다 (클리어 cleared / 시간 종료·교사 종료 failed). 실패하면 '다시 시도'
import { reasonText } from '../firebase/errors.js';
import { COLORS, CSS, LAYOUT, RULES } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { ROOMS, GUIDE_NAME, nextObjective } from '../story.js';
import { state, checkTimeout, saveAdventureNow } from '../state.js';
import { session, leaveActivity } from '../session.js';
import { liveBoard } from '../firebase/goldrush.js';
import { reviewSummary } from '../review.js';
import { hasOpenRun, finishRun, playStats } from '../quiz.js';
import { errorReason } from '../firebase/clock.js';
import { text, createButton, createHud } from '../ui.js';
import {
  backdrop, fadeIn, panel, ribbon, sparkle, reducedMotion, UI, SCALE,
} from '../art.js';
import { playMusic } from '../music.js';
import { play } from '../sound.js';
import { chestState } from '../chest.js';
import { watchChest, investLeftover } from '../firebase/chest.js';

const { W } = LAYOUT;
const cx = W / 2;
const LEFT = 300;
const RIGHT = 660;

export function starsOf(play) {
  return [true, play.entryTotal > 0 && play.entryCorrect === play.entryTotal, play.hits === 0];
}

export default class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) {
    this.mode = data.mode;
    this.dungeon = data.dungeon;
    this.stats = data.stats;
    this.leftover = data.leftover ?? 0; // 클리어할 때 남은 코인 (보상 골드로 이미 더해짐)
  }

  create() {
    this.alive = true;
    this.events.once('shutdown', () => { this.alive = false; });
    backdrop(this);
    fadeIn(this);
    playMusic('map');
    saveAdventureNow(); // 이 판에서 모은 골드를 모험 기록에
    panel(this, cx, 290, 480, 380, UI.wood, 0x8a6a8a).setAlpha(0.92);
    this.hud = createHud(this, '결과');
    const open = hasOpenRun();
    const rush = session.mode === 'goldrush' && this.mode !== 'clear';
    if (this.mode === 'clear') this.drawClear();
    else if (rush) this.drawRush();
    else this.drawFinal();
    if (open) {
      if (rush) this.save('goldrush', null); // 골드 러시: 푼 문제 기록만 (던전 플레이 기록 없음)
      else {
        const outcome = this.mode === 'clear' ? 'cleared' : 'failed';
        this.save(outcome, this.mode === 'clear' ? this.stats : playStats(false));
      }
    }
  }

  line(y, label, value) {
    text(this, LEFT, y, label, 'small').setOrigin(0, 0.5);
    text(this, RIGHT, y, String(value), 'small').setOrigin(1, 0.5);
  }

  drawClear() {
    const p = state.play;
    ribbon(this, cx, 82, 400);
    text(this, cx, 80, `${DUNGEONS[this.dungeon].name} 클리어!`, 'body', CSS.player).setOrigin(0.5).setStroke('#3f2631', 6);
    // 별: 얻은 별은 금색으로 하나씩 튀어나온다
    starsOf(p).forEach((got, i) => {
      const s = this.add.image(cx - 60 + i * 60, 125, got ? 'star' : 'star_off').setScale(got ? SCALE : 2.4);
      if (got && !reducedMotion()) {
        s.setScale(0);
        this.tweens.add({
          targets: s, scale: SCALE, delay: 200 + i * 250, duration: 300, ease: 'Back.out',
          onStart: () => sparkle(this, s.x, s.y, 0xffd54f, 10),
        });
      }
    });
    text(this, cx, 155, '별: 클리어 · 입장 퀴즈 모두 정답 · 충돌 0번', 'small').setOrigin(0.5).setAlpha(0.6);
    this.line(180, '맞힌 문제', `${p.quizCorrect} / ${p.quizTotal}`);
    this.line(202, '능력에 쓴 코인', this.stats.coinsSpent);
    this.line(224, '충돌 · 추락', `${p.hits}번 · ${p.falls}번`);
    this.line(246, '클리어 시간', `${this.stats.clearSec}초`);
    this.add.rectangle(LEFT, 264, RIGHT - LEFT, 1, COLORS.player, 0.2).setOrigin(0, 0.5);
    text(this, LEFT, 290, '얻은 코인', 'body').setOrigin(0, 0.5);
    text(this, RIGHT, 290, String(p.quizCorrect * RULES.COIN_PER_CORRECT), 'big', CSS.good).setOrigin(1, 0.5);
    // 이야기: 깬 방 한마디 + 다음 목표 (안내자 루미) — 두 줄로 넘어가도 겹치지 않게 차례로 쌓는다
    const WRAP = 430;
    const box = this.add.rectangle(cx, 322, WRAP + 30, 10, COLORS.player, 0.1).setOrigin(0.5, 0);
    const t1 = text(this, cx, 328, `${GUIDE_NAME}: ${ROOMS[this.dungeon]?.clear ?? ''}`, 'small', CSS.good).setOrigin(0.5, 0).setWordWrapWidth(WRAP);
    const t2 = text(this, cx, t1.y + t1.height + 2, nextObjective(this.dungeon, DUNGEONS.map((d) => d.name)), 'small').setOrigin(0.5, 0).setWordWrapWidth(WRAP);
    const bottom = t2.y + t2.height + 6;
    box.height = bottom - 322;
    box.setSize(WRAP + 30, bottom - 322);
    // 클리어 보상: 남은 코인만큼 골드 + (선생님이 보물상자를 준비했으면) 남은 코인을 보물상자에 넣기
    let by = Math.max(410, bottom + 34);
    if (this.leftover > 0) {
      this.rewardText = text(this, cx, bottom + 14, `클리어 보상: 남은 코인 ${this.leftover} → 골드 +${this.leftover}`, 'small', CSS.good).setOrigin(0.5);
      by = bottom + 50;
    }
    this.buttonY = by;
    this.drawClearButtons(false);
    if (this.leftover > 0) {
      this.stopChest = watchChest((c) => {
        if (!this.alive || this.invested) return;
        const s = chestState(c);
        this.drawClearButtons(s.ready && !s.opened);
      });
      this.events.once('shutdown', () => this.stopChest?.());
    }
  }

  // 아래 버튼: [보물상자에 넣기] [월드맵으로] — 넣을 수 없으면 월드맵만 가운데
  drawClearButtons(canInvest) {
    (this.clearButtons ?? []).forEach((b) => b.destroy());
    const toMap = () => this.scene.start('WorldMap');
    if (!canInvest) {
      this.clearButtons = [createButton(this, cx, this.buttonY, '월드맵으로', toMap, { primary: true, h: 48 })];
      return;
    }
    this.clearButtons = [
      createButton(this, cx - 112, this.buttonY, '보물상자에 넣기', () => this.invest(), { w: 210, h: 48 }),
      createButton(this, cx + 112, this.buttonY, '월드맵으로', toMap, { primary: true, w: 200, h: 48 }),
    ];
  }

  // 남은 코인을 학급 보물상자에 (넣지 않고 월드맵으로 가면 코인은 사라진다)
  async invest() {
    if (this.investing || this.invested) return;
    this.investing = true;
    try {
      await investLeftover(this.leftover);
      if (!this.alive) return;
      this.invested = true;
      this.stopChest?.();
      play('coin');
      sparkle(this, cx, this.buttonY, 0xffd54f, 20);
      this.rewardText?.setText(`클리어 보상 골드 +${this.leftover} · 보물상자에 코인 ${this.leftover}을 넣었어요!`);
      this.drawClearButtons(false);
    } catch (e) {
      if (this.alive) this.rewardText?.setText(`보물상자에 넣지 못했어요 (${errorReason(e)})`).setColor(CSS.bad);
    } finally {
      this.investing = false;
    }
  }

  // 골드 러시 결과: 내 골드·순위, 참가자 수·총 골드, 상위 5명 (실시간 현황의 마지막 값)
  drawRush() {
    const head = this.mode === 'ended' ? '선생님이 골드 러시를 끝냈어요' : '골드 러시 끝!';
    text(this, cx, 110, head, 'body', CSS.good).setOrigin(0.5);
    this.line(160, '내가 모은 골드', `${state.coins} 골드`);
    this.line(186, '맞힌 문제', `${state.totalCorrect} / ${state.totalQuiz}`);
    const sum = text(this, cx, 220, '', 'small', CSS.good).setOrigin(0.5);
    let rows = [];
    const stop = liveBoard((b) => {
      if (!this.alive) return;
      rows.forEach((o) => o.destroy());
      sum.setText(`참가 ${b.participants}명 · 총 골드 ${b.totalGold}${b.rank ? ` · 내 순위 ${b.rank}위` : ''}`);
      rows = b.top.map((p, i) => text(this, cx, 250 + i * 24, `${p.rank}위  ${p.nickname}  ${p.gold} 골드`, 'small', p.uid === b.me ? CSS.good : CSS.player).setOrigin(0.5));
    });
    this.events.once('shutdown', stop);
    this.endButtons(410);
  }

  // 아래 버튼: 틀린 문제 다시 보기(있을 때) + 처음으로
  endButtons(y) {
    const r = reviewSummary(state.reviewLog);
    const toStart = () => { leaveActivity(); this.scene.start('Start'); };
    if (r.wrongQuestions.length) {
      createButton(this, cx - 125, y, `틀린 문제 (${r.wrongQuestions.length})`, () => this.showReview(r), { w: 230, h: 52 });
      createButton(this, cx + 125, y, '처음으로', toStart, { primary: true, w: 200, h: 52 });
    } else {
      createButton(this, cx, y, '처음으로', toStart, { primary: true });
    }
  }

  // 틀린 문제 다시 보기: 문제·정답·내가 고른 답 (최근 것부터 5개)
  showReview(r) {
    const items = [];
    const close = () => items.forEach((o) => o.destroy());
    items.push(this.add.rectangle(cx, LAYOUT.H / 2, W, LAYOUT.H, 0x0b1020, 0.8).setInteractive().setDepth(10.5));
    items.push(panel(this, cx, 280, 760, 420, UI.wood, 0x8a6a8a).setDepth(11));
    items.push(text(this, cx, 96, '틀린 문제 다시 보기', 'body', CSS.good).setOrigin(0.5).setDepth(11.5));
    r.wrongQuestions.slice(0, 5).forEach((w, i) => {
      const y = 140 + i * 56;
      items.push(text(this, 150, y, `${i + 1}. ${w.question}`, 'small').setOrigin(0, 0.5).setDepth(11.5).setWordWrapWidth(660));
      items.push(text(this, 170, y + 22, `정답: ${w.answer}  ·  내가 고른 답: ${w.chosen}${w.concept ? `  ·  개념: ${w.concept}` : ''}`, 'small', CSS.good).setOrigin(0, 0.5).setDepth(11.5));
    });
    if (r.wrongQuestions.length > 5) items.push(text(this, cx, 420, `외 ${r.wrongQuestions.length - 5}문제는 선생님과 함께 복습해요`, 'small').setOrigin(0.5).setDepth(11.5).setAlpha(0.7));
    const b = createButton(this, cx, 455, '닫기', close, { primary: true, w: 160, h: 48, fixed: true });
    items.push({ destroy: () => b.destroy() });
  }

  // 최종 결과 (시간 종료·교사 종료): 이번 활동 전체
  drawFinal() {
    const count = state.cleared.filter(Boolean).length;
    const head = this.mode === 'ended' ? '선생님이 활동을 끝냈어요' : '시간 종료!';
    text(this, cx, 116, head, 'body', CSS.bad).setOrigin(0.5).setStroke('#1B1F2A', 4);
    text(this, cx, 150, '이번 활동 최종 결과', 'small').setOrigin(0.5).setAlpha(0.6);
    this.line(195, '모험 지도', `깬 방 ${count}/${DUNGEONS.length} · 골드 ${state.gold}`);
    this.line(225, '맞힌 문제', `${state.totalCorrect} / ${state.totalQuiz}`);
    const rate = state.totalQuiz ? Math.round((state.totalCorrect / state.totalQuiz) * 100) : 0;
    this.add.rectangle(LEFT, 250, RIGHT - LEFT, 1, COLORS.player, 0.2).setOrigin(0, 0.5);
    text(this, LEFT, 275, '정답률', 'body').setOrigin(0, 0.5);
    text(this, RIGHT, 275, `${rate}%`, 'big', CSS.good).setOrigin(1, 0.5);
    // 학생 맞춤 복습: 한마디 + 다시 볼 개념 (이번 활동에서 푼 문제로, 규칙 기반)
    const r = reviewSummary(state.reviewLog);
    const color = r.tone === 'good' ? CSS.good : r.tone === 'bad' ? CSS.bad : CSS.player;
    text(this, cx, 318, r.message, 'small', color).setOrigin(0.5).setWordWrapWidth(440);
    if (r.weakConcepts.length) {
      text(this, cx, 346, `다시 볼 개념: ${r.weakConcepts.map((c) => `${c.concept}(${c.wrong}번 틀림)`).join(' · ')}`, 'small').setOrigin(0.5).setWordWrapWidth(440);
    }
    this.endButtons(400);
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
