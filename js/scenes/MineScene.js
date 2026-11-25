// 학급 광산 화면 (2026-11-25): 8개 방을 다 깬 학생이 들어와 반 친구들과 함께 학급 코인을 캔다 (js/mine.js).
// 광산 안 인원이 참여 인원의 절반 이상(최소 2명)일 때만 '캐기'가 된다. 목표(참여 인원 × 50)를 채우면
// 아직 다 못 깬 친구들이 남은 방마다 능력 구매 코인 +20을 받는다. 캔 양은 모아서 3초마다 한 번 쓴다 (무료 요금제 쓰기 수 아끼기)
import { CSS, COLORS, LAYOUT } from '../config.js';
import { state, checkTimeout } from '../state.js';
import { session } from '../session.js';
import {
  text, createButton, createHud, createGuide, createBackButton,
} from '../ui.js';
import { playMusic } from '../music.js';
import { play } from '../sound.js';
import { MAX_DIG_WRITE, HEARTBEAT_MS, SUPPORT_COINS } from '../mine.js';
import { watchMine, dig, markDone } from '../firebase/mine.js';
import { setInMine, heartbeat } from '../progress.js';
import {
  backdrop, fadeIn, panel, sprite, sparkle, coinPop, reducedMotion, UI, TD, SCALE,
} from '../art.js';

const { W } = LAYOUT;
const cx = W / 2;
const BAR_W = 460;
const TAP_MS = 200; // 너무 빠른 연타는 한 번으로

export default class MineScene extends Phaser.Scene {
  constructor() { super('Mine'); }

  create() {
    this.alive = true;
    this.pending = 0; // 아직 쓰지 않은 캔 양
    this.lastTap = 0;
    this.s = null;
    this.doneMarked = false;
    backdrop(this);
    fadeIn(this);
    playMusic('dungeon1');
    this.hud = createHud(this, '학급 광산', { back: true });
    this.guide = createGuide(this, `8개 방을 다 깬 친구들이 함께 캐요 · 완성하면 아직 못 깬 친구들이 방마다 코인 +${SUPPORT_COINS}`);
    createBackButton(this, () => this.scene.start('WorldMap'));
    panel(this, cx, 280, 680, 400, UI.wood, 0x8a6a8a).setAlpha(0.92);
    text(this, cx, 104, '학급 광산', 'body', CSS.good).setOrigin(0.5).setStroke('#3f2631', 4);
    this.rock = sprite(this, cx + 40, 190, 'td', 24, SCALE + 3);
    this.hero = sprite(this, cx - 70, 206, 'td', TD.hero, SCALE + 1);
    this.pick = sprite(this, cx - 30, 180, 'td', 117, SCALE + 1).setOrigin(0.3, 0.9).setAngle(-30);
    this.info = text(this, cx, 268, '', 'small').setOrigin(0.5);
    this.barBg = this.add.rectangle(cx - BAR_W / 2, 300, BAR_W, 18, 0x1b1f2a).setOrigin(0, 0.5).setStrokeStyle(2, COLORS.player, 0.6);
    this.bar = this.add.rectangle(cx - BAR_W / 2 + 2, 300, 0, 12, COLORS.good).setOrigin(0, 0.5);
    this.amount = text(this, cx, 326, '', 'small').setOrigin(0.5);
    this.status = text(this, cx, 362, '', 'small').setOrigin(0.5).setWordWrapWidth(600);
    this.digButton = createButton(this, cx, 420, '캐기!', () => this.tapDig(), { primary: true, w: 200, h: 56 });
    this.input.keyboard.on('keydown-SPACE', () => this.tapDig());

    if (!session.online || !session.activityId) {
      this.info.setText('광산은 온라인 수업에서 반 친구들과 함께 열려요');
      this.digButton.setAlpha(0.4);
      return;
    }
    setInMine(true);
    this.stop = watchMine((s) => this.draw(s));
    this.timers = [
      this.time.addEvent({ delay: 3000, loop: true, callback: () => this.flush() }),
      this.time.addEvent({ delay: HEARTBEAT_MS, loop: true, callback: () => heartbeat() }),
    ];
    this.events.once('shutdown', () => {
      this.alive = false;
      this.stop?.();
      this.flush();
      setInMine(false);
    });
  }

  draw(s) {
    if (!this.alive) return;
    this.s = s;
    const dug = Math.min(s.goal, s.dug + this.pending);
    const pct = Math.min(100, Math.floor((dug / s.goal) * 100));
    this.info.setText(`광산 안 친구 ${s.miners}명 / 필요 ${s.need}명 (참여 ${s.participants}명의 절반 이상)`);
    this.bar.width = (BAR_W - 4) * (pct / 100);
    this.amount.setText(`학급 코인 ${dug} / ${s.goal} (${pct}%)`);
    if (s.done) {
      this.status.setText(`학급 코인 완성! 아직 못 깬 친구들이 방마다 코인 +${SUPPORT_COINS}을 받고 있어요`).setColor(CSS.good);
      this.digButton.setAlpha(0.4);
    } else if (!s.canDig) {
      this.status.setText(`혼자서는 캘 수 없어요 · 친구가 ${s.missing}명 더 들어와야 캐져요`).setColor(CSS.bad);
      this.digButton.setAlpha(0.4);
    } else {
      this.status.setText('함께 캐는 중! 캐기 버튼이나 Space를 눌러요').setColor(CSS.player);
      this.digButton.setAlpha(1);
    }
    // 목표에 처음 닿으면 완성으로 기록 (한 명만 성공하면 된다)
    if (s.reachedGoal && !this.doneMarked) {
      this.doneMarked = true;
      markDone().catch(() => { this.doneMarked = false; });
      sparkle(this, this.rock.x, this.rock.y, 0xffd54f, 40);
      play('clear');
    }
  }

  tapDig() {
    const s = this.s;
    if (!s) return;
    if (s.done) { this.guide.notice('학급 코인이 이미 완성됐어요', CSS.good); return; }
    if (!s.canDig) { this.guide.notice(`친구가 ${s.missing}명 더 들어와야 캘 수 있어요`, CSS.bad); return; }
    const now = this.time.now;
    if (now - this.lastTap < TAP_MS) return;
    this.lastTap = now;
    this.pending += 1;
    play('coin');
    coinPop(this, this.rock.x, this.rock.y - 50, '+1', CSS.good);
    if (!reducedMotion()) {
      this.tweens.add({ targets: this.pick, angle: 40, duration: 80, yoyo: true });
      this.tweens.add({ targets: this.rock, x: this.rock.x + 3, duration: 40, yoyo: true });
    }
    this.draw(s);
  }

  // 모은 캔 양을 쓴다 (한 번에 최대 30). 실패하면 다음에 다시
  flush() {
    if (this.pending <= 0 || this.flushing) return;
    const n = Math.min(this.pending, MAX_DIG_WRITE);
    this.flushing = true;
    this.pending -= n;
    dig(n).catch(() => { this.pending += n; }).finally(() => { this.flushing = false; });
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
    this.hud.setTitle(`학급 광산 · 내가 캔 코인은 모두 학급 코인`);
    if (state.timedOut) this.flush();
  }
}
