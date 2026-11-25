// 학급 보물상자 화면 (2026-11-25): 반 친구들과 골드를 모아 선생님이 정한 보상을 연다.
// 가운데 보물상자 그림·진행 막대(합계/목표)·보상, 아래 '10·50·100 골드 넣기'. 합계는 실시간 (여러 학생이 함께 채운다)
import { CSS, COLORS, LAYOUT } from '../config.js';
import { state, checkTimeout } from '../state.js';
import { session } from '../session.js';
import {
  text, createButton, createHud, createGuide, createBackButton,
} from '../ui.js';
import { playMusic } from '../music.js';
import { play } from '../sound.js';
import { balance } from '../cosmetics.js';
import { chestState, canDonate, DONATE_STEPS } from '../chest.js';
import { watchChest, donate } from '../firebase/chest.js';
import { errorReason } from '../firebase/clock.js';
import {
  backdrop, fadeIn, panel, sprite, sparkle, coinPop, UI, TD, SCALE,
} from '../art.js';

const { W } = LAYOUT;
const cx = W / 2;
const BAR_W = 460;

export default class ChestScene extends Phaser.Scene {
  constructor() { super('Chest'); }

  create() {
    this.alive = true;
    this.busy = false;
    this.events.once('shutdown', () => { this.alive = false; this.stop?.(); });
    backdrop(this);
    fadeIn(this);
    playMusic('map');
    this.hud = createHud(this, '', { back: true });
    this.guide = createGuide(this, '반 친구들과 골드를 모아 상자를 열어요 · 넣은 골드는 돌려받을 수 없어요');
    createBackButton(this, () => this.scene.start('WorldMap'));
    panel(this, cx, 270, 620, 380, UI.wood, 0x8a6a8a).setAlpha(0.92);
    text(this, cx, 108, '학급 보물상자', 'body', CSS.good).setOrigin(0.5);
    this.chestImg = sprite(this, cx, 200, 'td', TD.chest, SCALE + 2);
    this.items = [];
    this.lastOpened = null;
    this.stop = watchChest((chest) => this.draw(chest));
  }

  draw(chest) {
    if (!this.alive) return;
    this.chest = chest;
    this.items.forEach((o) => o.destroy());
    this.items = [];
    const add = (o) => { this.items.push(o); return o; };
    const s = chestState(chest);
    if (!s.ready) {
      add(text(this, cx, 290, '선생님이 아직 보물상자를 준비하지 않았어요', 'small').setOrigin(0.5));
      return;
    }
    add(text(this, cx, 262, `보상: ${s.reward}`, 'small', CSS.good).setOrigin(0.5).setWordWrapWidth(560));
    // 진행 막대
    add(this.add.rectangle(cx - BAR_W / 2, 298, BAR_W, 18, 0x1b1f2a).setOrigin(0, 0.5).setStrokeStyle(2, COLORS.player, 0.6));
    add(this.add.rectangle(cx - BAR_W / 2 + 2, 298, Math.max(0, (BAR_W - 4) * (s.percent / 100)), 12, COLORS.good).setOrigin(0, 0.5));
    add(text(this, cx, 324, `${s.total} / ${s.goal} 골드 (${s.percent}%)${s.opened ? '' : ` · ${s.left} 남음`}`, 'small').setOrigin(0.5));
    if (s.opened) {
      add(text(this, cx, 360, '상자가 열렸어요! 선생님께 보상을 받아요', 'body', CSS.good).setOrigin(0.5));
      if (this.lastOpened === false) { sparkle(this, cx, 200, 0xffd54f, 40); play('clear'); }
    } else {
      const bal = balance(state.gold, state.style.spent);
      DONATE_STEPS.forEach((amt, i) => {
        const ok = canDonate(bal, amt, s);
        const b = createButton(this, cx - 160 + i * 160, 372, `${amt} 골드 넣기`, () => this.give(amt), { w: 150, h: 48 });
        if (!ok) b.setAlpha(0.4);
        add({ destroy: () => b.destroy() });
      });
    }
    add(text(this, cx, 418, `내가 넣은 골드 ${state.donated ?? 0}`, 'small').setOrigin(0.5).setAlpha(0.8));
    this.lastOpened = s.opened;
  }

  async give(amount) {
    const s = chestState(this.chest);
    const bal = balance(state.gold, state.style.spent);
    if (this.busy) return;
    if (!canDonate(bal, amount, s)) {
      this.guide.notice(s.opened ? '이미 열린 상자예요' : `쓸 수 있는 골드가 ${bal}이라 ${amount}을(를) 넣을 수 없어요`, CSS.bad);
      return;
    }
    this.busy = true;
    try {
      await donate(amount);
      if (!this.alive) return;
      coinPop(this, cx, 180, `+${amount}`, CSS.good);
      play('coin');
      this.guide.notice(`보물상자에 ${amount} 골드를 넣었어요!`, CSS.good);
      // 남은 골드에 맞게 버튼을 다시 그린다 (온라인은 실시간 값이 곧 다시 오고, 예비 흐름은 이 기기 값으로)
      this.draw(!session.online && this.chest ? { ...this.chest, total: (this.chest.total ?? 0) + amount } : this.chest);
    } catch (e) {
      if (this.alive) this.guide.notice(`넣지 못했어요 (${errorReason(e)})`, CSS.bad);
    } finally {
      this.busy = false;
    }
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
    this.hud.setTitle(`학급 보물상자 · 쓸 수 있는 골드 ${balance(state.gold, state.style.spent)}`);
  }
}
