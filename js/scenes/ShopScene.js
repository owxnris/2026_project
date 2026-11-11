// 능력 구매 화면 (design.md): 입장 퀴즈 뒤, 던전 입장 전. 능력 3개를 세로 목록으로, 아래에 던전 입장(주 버튼)
// 코인이 부족한 능력은 투명도 40%, 누르면 빨간 안내. 보호막·이단 점프는 한 번만 살 수 있다
import { COLORS, CSS, LAYOUT, ABILITIES } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout } from '../state.js';
import { reportProgress } from '../progress.js';
import { text, createButton, createHud, createGuide } from '../ui.js';

const { W } = LAYOUT;
const ROW_Y = [150, 250, 350];

export default class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  init(data) {
    this.dungeon = data.dungeon;
  }

  create() {
    this.hud = createHud(this, `${DUNGEONS[this.dungeon].name} · 능력 구매`);
    this.guide = createGuide(this, '코인으로 능력을 사세요 · 안 사도 클리어할 수 있어요');
    this.rows = ABILITIES.map((a, i) => this.makeRow(a, ROW_Y[i]));
    ROW_Y.slice(1).forEach((y) => this.add.rectangle(80, y - 50, W - 160, 1, COLORS.player, 0.2).setOrigin(0, 0.5));
    createButton(this, W / 2, 440, '던전 입장', () => this.scene.start('Dungeon', { dungeon: this.dungeon }), { primary: true });
    this.refresh();
  }

  makeRow(a, y) {
    const icon = this.add.rectangle(110, y, 36, 36, COLORS.player, 0).setStrokeStyle(2, COLORS.player);
    const name = text(this, 150, y - 22, a.name, 'body').setOrigin(0, 0.5);
    const effect = text(this, 150, y + 14, a.effect, 'small').setOrigin(0, 0.5);
    const price = text(this, 690, y, `${a.price}코인`, 'small', CSS.good).setOrigin(1, 0.5);
    const button = createButton(this, 800, y, '사기', () => this.buy(a), { w: 160, h: 48 });
    return { a, parts: [icon, name, effect, price], name, button };
  }

  owned(a) {
    return a.repeat ? false : state.play.abilities[a.key];
  }

  buy(a) {
    if (this.owned(a)) {
      this.guide.notice(`${a.name}은(는) 이미 샀어요`, CSS.player);
      return;
    }
    if (state.coins < a.price) {
      this.guide.notice(`코인이 부족해서 ${a.name}을(를) 살 수 없어요`, CSS.bad);
      return;
    }
    state.coins -= a.price; // 구매로 0개가 되어도 퀴즈는 뜨지 않는다
    const ab = state.play.abilities;
    if (a.repeat) {
      ab[a.key] += 1;
      state.play.dashLeft += 1;
    } else {
      ab[a.key] = true;
      if (a.key === 'shield') state.play.shieldLeft = true;
    }
    this.hud.flashCoins(CSS.good);
    reportProgress();
    this.refresh();
  }

  refresh() {
    this.rows.forEach(({ a, parts, name, button }) => {
      const dim = !this.owned(a) && state.coins < a.price;
      parts.forEach((p) => p.setAlpha(dim ? 0.4 : 1));
      button.setAlpha(dim || this.owned(a) ? 0.4 : 1);
      if (a.repeat) name.setText(`${a.name} (산 횟수 ${state.play.abilities[a.key]})`);
      else if (this.owned(a)) name.setText(`${a.name} (샀어요)`);
    });
    this.hud.update();
  }

  update() {
    if (checkTimeout(this)) return;
    this.hud.update();
  }
}
