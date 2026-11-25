// 말랑이 꾸미기 화면 (2026-11-25): 모은 골드로 몸 색·모자를 사서 입는다. 산 것은 모험 기록에 남는다.
// 왼쪽 미리보기(큰 말랑이), 오른쪽 '몸 색'·'모자' 줄. 누르면 사기(골드 차감)·입기. 던전 지도의 '꾸미기' 버튼으로 온다
import { CSS, LAYOUT } from '../config.js';
import { state, checkTimeout, saveAdventureNow } from '../state.js';
import {
  text, createHud, createGuide, createBackButton,
} from '../ui.js';
import { playMusic } from '../music.js';
import {
  COLORS as SKINS, HATS, actionFor, apply, balance,
} from '../cosmetics.js';
import {
  backdrop, fadeIn, panel, dressedHero, sparkle, UI,
} from '../art.js';

const { W } = LAYOUT;
const skinOf = (id) => SKINS.find((c) => c.id === id);

export default class WardrobeScene extends Phaser.Scene {
  constructor() { super('Wardrobe'); }

  create() {
    backdrop(this);
    fadeIn(this);
    playMusic('map');
    this.hud = createHud(this, '', { back: true });
    this.guide = createGuide(this, '골드는 퀴즈 정답과 골드 러시로 모아요 · 산 것은 다음 수업에도 그대로예요');
    createBackButton(this, () => this.scene.start('WorldMap'));
    panel(this, 190, 280, 280, 360, UI.wood, 0x8a6a8a).setAlpha(0.92);
    text(this, 190, 128, '내 말랑이', 'body', CSS.good).setOrigin(0.5);
    this.items = [];
    this.draw();
  }

  ctx() {
    return { ...state.style, gold: state.gold };
  }

  draw() {
    this.items.forEach((o) => o.destroy());
    this.items = [];
    const add = (o) => { this.items.push(o); return o; };
    const look = state.style.look;
    const big = dressedHero(this, 190, 390, look, skinOf(look.color), 9);
    add(big.body); if (big.hat) add(big.hat);
    add(text(this, 190, 430, `${skinOf(look.color).name} · 모자 ${HATS.find((h) => h.id === look.hat).name}`, 'small').setOrigin(0.5));
    this.row('몸 색', SKINS, 175, (id) => ({ color: id, hat: 'none' }), add);
    this.row('모자', HATS, 365, (id) => ({ color: 'mint', hat: id }), add);
  }

  // 물건 한 줄: 칸마다 미리보기·이름·가격(입는 중/있음/n 골드). 누르면 사기·입기
  row(label, list, y, preview, add) {
    add(text(this, 400, y - 72, label, 'small', CSS.good).setOrigin(0, 0.5));
    list.forEach((it, i) => {
      const x = 440 + i * 108;
      const act = actionFor(it.id, this.ctx());
      const p = add(panel(this, x, y, 92, 92, act === 'worn' ? UI.parchment : UI.stone, act === 'worn' ? 0xffd54f : 0xffffff));
      if (act === 'poor') p.setAlpha(0.55);
      const thumb = dressedHero(this, x, y + 34, preview(it.id), skinOf(preview(it.id).color), 4);
      add(thumb.body); if (thumb.hat) add(thumb.hat);
      if (act === 'poor') { thumb.body.setAlpha(0.5); thumb.hat?.setAlpha(0.5); }
      add(text(this, x, y + 62, it.name, 'small').setOrigin(0.5));
      const tag = { worn: '입는 중', equip: '있음 · 입기', buy: `${it.price} 골드`, poor: `${it.price} 골드` }[act];
      add(text(this, x, y + 82, tag, 'small', act === 'poor' ? CSS.bad : CSS.good).setOrigin(0.5));
      add(this.add.zone(x, y + 20, 100, 130).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pick(it)));
    });
  }

  pick(it) {
    const s = this.ctx();
    const act = actionFor(it.id, s);
    if (act === 'poor') {
      this.guide.notice(`골드가 ${it.price - balance(s.gold, s.spent)} 부족해요 · 퀴즈를 더 맞혀서 모아 봐요`, CSS.bad);
      return;
    }
    const next = apply(it.id, s);
    if (!next) return;
    state.style = { owned: next.owned, look: next.look, spent: next.spent };
    saveAdventureNow();
    if (act === 'buy') {
      this.guide.notice(`'${it.name}'을(를) 샀어요! (-${it.price} 골드)`, CSS.good);
      sparkle(this, 190, 330, 0xffd54f, 24);
    }
    this.draw();
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
    this.hud.setTitle(`말랑이 꾸미기 · 쓸 수 있는 골드 ${balance(state.gold, state.style.spent)}`);
  }
}
