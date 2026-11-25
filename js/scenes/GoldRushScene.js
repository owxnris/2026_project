// 골드 러시 이벤트 화면 (2026-11-18): 선생님이 연 시간제 이벤트. 시간 안에 퀴즈를 풀어 골드를 모은다.
// 남은 시간(카운트다운), 참가자 수·총 골드·상위 5명(실시간, 실제 참가자만), '참여하기' → 골드 러시 퀴즈
// 끝나면(시간 종료·선생님 종료) 결과 화면에서 이벤트 요약을 보여 준다
import { CSS, LAYOUT } from '../config.js';
import { state, checkTimeout, remainingSeconds } from '../state.js';
import { text, createButton, createHud, createGuide } from '../ui.js';
import { reportProgress } from '../progress.js';
import { playMusic } from '../music.js';
import { liveBoard } from '../firebase/goldrush.js';
import { hasOpenRun } from '../quiz.js';
import {
  backdrop, fadeIn, panel, ribbon, sprite, UI, PP, SCALE,
} from '../art.js';

const { W } = LAYOUT;
const cx = W / 2;

export default class GoldRushScene extends Phaser.Scene {
  constructor() { super('GoldRush'); }

  create() {
    this.alive = true;
    this.events.once('shutdown', () => { this.alive = false; this.stopBoard?.(); });
    backdrop(this, { bg: 0x2a2010, wall: 0xc89a40 }); // 골드 러시는 금빛 벽으로 보통 수업과 구분
    fadeIn(this);
    playMusic('dungeon1');
    this.hud = createHud(this, '골드 러시 이벤트');
    createGuide(this, '정답 하나에 골드 10 · 시간 안에 많이 풀수록 좋아요 · 모은 골드는 모험 기록에도 쌓여요');
    reportProgress(null);

    ribbon(this, cx, 98, 420);
    text(this, cx, 96, '골드 러시!', 'body', CSS.player).setOrigin(0.5).setStroke('#3f2631', 6);
    [cx - 250, cx + 250].forEach((x) => this.add.sprite(x, 98, 'pp', PP.coin).setScale(SCALE + 1).play('coin_spin'));
    this.timeText = text(this, cx, 150, '', 'small').setOrigin(0.5);

    panel(this, cx, 300, 560, 220, UI.wood, 0x8a6a8a).setAlpha(0.92);
    this.summary = text(this, cx, 212, '현황을 불러오는 중…', 'small', CSS.good).setOrigin(0.5);
    this.rows = [];
    const label = hasOpenRun() ? '이어서 풀기' : '참여하기';
    createButton(this, cx, 448, label, () => this.scene.start('Quiz', { mode: 'rush' }), { primary: true, w: 240, h: 52 });
    this.stopBoard = liveBoard((b) => this.drawBoard(b));
  }

  // 실시간 현황: 참가자 수·총 골드·상위 5명 (실제 진행 상황 문서에서만)
  drawBoard(b) {
    if (!this.alive) return;
    this.rows.forEach((o) => o.destroy());
    this.rows = [];
    if (b.error) { this.summary.setText('현황을 불러오지 못했어요 (참여는 할 수 있어요)').setColor(CSS.bad); return; }
    this.summary.setText(`참가 ${b.participants}명 · 총 골드 ${b.totalGold}${b.rank ? ` · 내 순위 ${b.rank}위` : ''}`).setColor(CSS.good);
    if (b.top.length === 0) {
      this.rows.push(text(this, cx, 300, '아직 참가한 친구가 없어요. 첫 번째로 골드를 모아 보세요!', 'small').setOrigin(0.5).setAlpha(0.8));
      return;
    }
    b.top.forEach((p, i) => {
      const y = 246 + i * 30;
      const mine = p.uid === b.me;
      this.rows.push(text(this, cx - 200, y, `${p.rank}위`, 'small', i === 0 ? CSS.good : CSS.player).setOrigin(0, 0.5));
      this.rows.push(text(this, cx - 120, y, p.nickname, 'small', mine ? CSS.good : CSS.player).setOrigin(0, 0.5));
      this.rows.push(text(this, cx + 200, y, `${p.gold} 골드`, 'small', CSS.good).setOrigin(1, 0.5));
    });
    if (b.top[0]) this.rows.push(sprite(this, cx - 240, 246, 'pp', PP.coin, 2));
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
    const sec = remainingSeconds();
    this.timeText.setText(`남은 시간 ${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초 · 지금까지 내 골드 ${state.coins}`);
  }
}
