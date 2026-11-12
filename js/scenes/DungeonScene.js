import { COLORS, CSS, LAYOUT, RULES, PHYS } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout, clearDungeon } from '../state.js';
import { text, createHud, createGuide } from '../ui.js';
import { playStats } from '../quiz.js';
import { play } from '../sound.js';
import { reportProgress } from '../progress.js';
import {
  SCALE, TD, PP, THEMES, sprite, tiles, tinted, dot, coinPop, sparkle, reducedMotion, fadeIn,
} from '../art.js';

// 안내 줄: 조작과 가진 능력 (예: ←→ 이동 · Space 점프 · Shift 대시(남은 2회) · 보호막 · 이단 점프)
function guideText() {
  const p = state.play;
  const parts = ['←→ 이동', 'Space 점프'];
  if (p.abilities.dash > 0) parts.push(`Shift 대시(남은 ${p.dashLeft}회)`);
  if (p.shieldLeft) parts.push('보호막');
  if (p.abilities.doubleJump) parts.push('이단 점프(공중에서 Space)');
  return parts.join(' · ');
}

const { W, H } = LAYOUT;
const FOOT = 6; // 16px 그림 아래쪽 빈 두 줄(×3) — 발이 발판에 닿게 그림을 그만큼 내린다

export default class DungeonScene extends Phaser.Scene {
  constructor() { super('Dungeon'); }

  init(data) {
    this.index = data.dungeon;
    this.dungeon = DUNGEONS[this.index];
    this.level = this.dungeon.level;
    this.facing = 1;
    this.dashing = false;
    this.invuln = false;
    this.stunUntil = 0;
    this.clearing = false;
    this.airJumped = false;
    this.checkpoint = 0; // 지나간 문 수 (0 = 출발지)
    this.theme = THEMES[this.index] || THEMES[0];
    this.wasGround = true;
    this.landAt = -1000;
    this.nextBlink = 0;
  }

  create() {
    const L = this.level;
    this.physics.world.setBounds(0, 0, L.width, H);
    this.physics.world.setBoundsCollision(true, true, false, false); // 아래로는 떨어질 수 있게
    this.cameras.main.setBounds(0, 0, L.width, H);
    this.cameras.main.setBackgroundColor(this.theme.bg);
    fadeIn(this);

    this.buildBackdrop(L);
    this.buildCourse(L);
    state.play.dungeonStartMs = Date.now();

    // 충돌 상자(보이지 않음)와 그림(말랑이)을 따로 둔다 — 그림은 updateArt에서 상자를 따라간다
    this.player = this.add.rectangle(L.start.x, L.start.y, 32, 48, COLORS.player).setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.hero = sprite(this, L.start.x, L.start.y + 24 + FOOT, 'td', TD.hero).setOrigin(0.5, 1).setDepth(5);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.obstacles, this.onHit, null, this);
    this.physics.add.overlap(this.player, this.flagPole, this.onClear, null, this);

    this.hud = createHud(this, '');
    this.guide = createGuide(this, guideText());
    reportProgress(this.index);

    this.keys = this.input.keyboard.createCursorKeys();
    this.shift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // 회복 퀴즈에서 돌아왔을 때 눌린 채로 남은 키를 풀어 준다.
    this.events.off('resume', this.onResume, this);
    this.events.on('resume', this.onResume, this);
  }

  // 뒤 배경: 테마색 벽(천천히 따라 움직임) + 벽 장식 + 떠다니는 입자
  buildBackdrop(L) {
    this.backWall = tiles(this, 0, 0, W, H, ['td', TD.wall, this.theme.wall]).setScrollFactor(0).setAlpha(0.2).setDepth(-2);
    const decos = [TD.banner, TD.window, TD.gargoyle, TD.window];
    for (let x = 300, k = 0; x < L.width; x += 420, k += 1) {
      sprite(this, x, 150 + (k % 2) * 40, 'td', decos[k % decos.length]).setScrollFactor(0.6).setAlpha(0.45).setDepth(-1);
    }
    const t = this.theme;
    const cfg = {
      firefly: {
        x: { min: 0, max: W }, y: { min: 90, max: H - 80 }, speedX: { min: -15, max: 15 }, speedY: { min: -15, max: 15 },
        lifespan: 2600, frequency: 220, alpha: { start: 1, end: 0 }, scale: 2,
      },
      ember: {
        x: { min: 0, max: W }, y: H - 40, speedY: { min: -90, max: -40 }, speedX: { min: -10, max: 10 },
        lifespan: 3000, frequency: 160, alpha: { start: 1, end: 0 }, scale: { start: 1.5, end: 0.5 },
      },
      snow: {
        x: { min: 0, max: W }, y: 60, speedY: { min: 30, max: 60 }, speedX: { min: -15, max: 10 },
        lifespan: 7000, frequency: 140, alpha: 0.8, scale: { min: 1, max: 2 },
      },
    }[t.mode];
    if (reducedMotion()) cfg.frequency *= 3;
    this.add.particles(0, 0, dot(this, t.particle), { ...cfg, maxAliveParticles: 40 }).setScrollFactor(0).setDepth(-1);
  }

  buildCourse(L) {
    this.platforms = this.physics.add.staticGroup();
    L.platforms.forEach(([x, y, w, h]) => {
      const r = this.add.rectangle(x, y, w, h, COLORS.player, 0.4).setOrigin(0).setVisible(false);
      this.physics.add.existing(r, true);
      this.platforms.add(r);
      // 그림: 윗면 돌판 + (바닥이면) 화면 아래까지 벽돌
      const th = this.theme.top[0] === 'pp' ? 54 : 48;
      if (y + h >= H - 80) tiles(this, x, y + th - 6, w, H - y, this.theme.fill).setDepth(1);
      tiles(this, x, y, w, th, this.theme.top).setDepth(2);
    });

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.monsters = [];
    let g = 0;
    L.obstacles.forEach((o) => {
      const r = this.add.rectangle(o.x, o.y, o.w, o.h, COLORS.obstacle).setOrigin(0).setVisible(false);
      this.obstacles.add(r);
      r.body.moves = false; // 위치는 tween이 정한다
      if (o.dx || o.dy) {
        this.tweens.add({
          targets: r,
          x: o.x + (o.dx || 0),
          y: o.y + (o.dy || 0),
          duration: o.duration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
      }
      // 그림: 움직이는 장애물은 나는 몬스터, 서 있는 장애물은 땅 몬스터 (던전마다 다름)
      const flyer = !!(o.dx || o.dy);
      const frame = flyer ? this.theme.flyer : this.theme.ground[g++ % this.theme.ground.length];
      const m = sprite(this, o.x + o.w / 2, o.y + o.h + FOOT, 'td', frame).setOrigin(0.5, 1).setDepth(4);
      this.tweens.add({
        targets: m,
        scaleY: SCALE * (flyer ? 0.85 : 0.9),
        scaleX: SCALE * (flyer ? 1.1 : 1.06),
        duration: flyer ? 180 : 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      this.monsters.push({ r, m });
    });

    // 문(체크포인트): 벽돌 위 나무 문. 지나가면 열린 문으로 바뀐다
    this.doorSprites = L.doors.map((d, i) => {
      this.add.image(d.x, d.y - 46, tinted(this, 'td', TD.wallTop, this.theme.wall)).setScale(SCALE).setOrigin(0.5, 1).setDepth(3);
      const door = sprite(this, d.x, d.y + 2, 'td', TD.door).setOrigin(0.5, 1).setDepth(3);
      text(this, d.x, d.y - 116, `문 ${i + 1}`, 'small').setOrigin(0.5).setDepth(3);
      return door;
    });

    // 깃발: 충돌 상자(보이지 않음) + 깃대 그림 + 펄럭이는 깃발 + 보물상자
    this.flagPole = this.add.rectangle(L.flag.x, L.flag.y, 6, 120, COLORS.good).setOrigin(0.5, 1).setVisible(false);
    this.physics.add.existing(this.flagPole, true);
    [0, 1].forEach((k) => sprite(this, L.flag.x, L.flag.y - k * 54 + 4, 'pp', PP.pole).setOrigin(0.5, 1).setDepth(3));
    this.flag = this.add.sprite(L.flag.x + 6, L.flag.y - 104, 'pp', PP.flag).setScale(SCALE).setOrigin(0.5, 1).setDepth(3).play('flag_wave');
    sprite(this, L.flag.x + 70, L.flag.y + 4, 'td', TD.chest).setOrigin(0.5, 1).setDepth(3);
  }

  // 그림을 충돌 상자에 맞춰 움직이고, 말랑이의 몸짓(숨쉬기·통통 걷기·점프 늘어남·착지 눌림·깜빡임)을 만든다
  updateArt(time) {
    const p = this.player;
    const b = p.body;
    const onGround = b.blocked.down || b.touching.down;
    let sx = 1;
    let sy = 1;
    let oy = 0;
    if (this.dashing) {
      sx = 1.25; sy = 0.82;
    } else if (!onGround) {
      if (b.velocity.y < 0) { sx = 0.86; sy = 1.14; } else { sx = 0.94; sy = 1.06; }
    } else if (Math.abs(b.velocity.x) > 10) {
      const ph = time / 85;
      oy = -Math.abs(Math.sin(ph)) * 7;
      sy = 1 + Math.cos(ph * 2) * 0.06;
      sx = 1 - Math.cos(ph * 2) * 0.05;
    } else {
      sy = 1 + Math.sin(time / 320) * 0.05;
      sx = 1 - Math.sin(time / 320) * 0.035;
    }
    if (onGround && !this.wasGround) this.landAt = time;
    this.wasGround = onGround;
    if (time - this.landAt < 110) { sx *= 1.2; sy *= 0.8; }

    this.hero.setPosition(p.x, p.y + 24 + FOOT + oy).setScale(SCALE * sx, SCALE * sy).setFlipX(this.facing < 0).setAlpha(p.alpha);
    if (time > this.nextBlink) {
      this.hero.setTexture('hero_blink');
      this.time.delayedCall(130, () => this.hero.setTexture('td', TD.hero));
      this.nextBlink = time + 2200 + Math.random() * 2500;
    }
    this.monsters.forEach(({ r, m }) => {
      m.setPosition(r.x + r.width / 2, r.y + r.height + FOOT);
      m.setFlipX(p.x < m.x);
    });
    this.backWall.tilePositionX = this.cameras.main.scrollX * 0.25;
  }

  onResume() {
    this.input.keyboard.resetKeys();
  }

  update(time) {
    this.updateArt(time);
    if (checkTimeout(this) || this.clearing) return;

    const passed = this.level.doors.filter((d) => this.player.x > d.x).length;
    if (passed > this.checkpoint) {
      for (let k = this.checkpoint; k < passed; k += 1) {
        const door = this.doorSprites[k];
        door.setFrame(TD.doorOpen);
        sparkle(this, door.x, door.y - 30, 0xffd54f, 10);
      }
      this.checkpoint = passed;
      this.guide.notice(`문 ${passed} 통과! 떨어지면 여기서 다시 시작해요`, CSS.good);
    }
    this.hud.setTitle(`${this.dungeon.name} · 문 ${passed}/${this.level.doors.length}`);
    this.hud.update();

    if (this.player.y > H + 40) {
      this.respawn();
      return;
    }
    if (this.dashing || time < this.stunUntil) return;

    const body = this.player.body;
    if (this.keys.left.isDown) {
      body.setVelocityX(-PHYS.MOVE_SPEED);
      this.facing = -1;
    } else if (this.keys.right.isDown) {
      body.setVelocityX(PHYS.MOVE_SPEED);
      this.facing = 1;
    } else {
      body.setVelocityX(0);
    }

    const onGround = body.blocked.down || body.touching.down;
    if (onGround) this.airJumped = false;
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      if (onGround) body.setVelocityY(-PHYS.JUMP_SPEED);
      else if (state.play.abilities.doubleJump && !this.airJumped) {
        this.airJumped = true; // 이단 점프: 공중에서 한 번 더
        body.setVelocityY(-PHYS.JUMP_SPEED);
        sparkle(this, this.player.x, this.player.y + 24, 0x9ffff0, 8);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.shift)) this.tryDash();
  }

  // 대시: 산 횟수만큼 쓸 수 있고, 쓸 때 코인은 줄지 않는다
  tryDash() {
    const p = state.play;
    if (p.dashLeft <= 0) {
      this.guide.notice(p.abilities.dash > 0 ? '대시를 다 썼어요' : '대시를 사지 않았어요 — 입장 퀴즈 뒤 능력 구매에서 살 수 있어요', CSS.bad);
      return;
    }
    p.dashLeft -= 1;
    p.dashesUsed += 1;
    this.guide.setBase(guideText());
    this.dashing = true;
    const body = this.player.body;
    body.setAllowGravity(false);
    body.setVelocity(this.facing * PHYS.DASH_SPEED, 0);
    this.time.delayedCall(PHYS.DASH_MS, () => this.endDash());
    // 잔상: 대시하는 동안 반투명 그림자를 남긴다
    this.time.addEvent({
      delay: 45,
      repeat: Math.floor(PHYS.DASH_MS / 45) - 1,
      callback: () => {
        const ghost = this.add.image(this.hero.x, this.hero.y, this.hero.texture.key, this.hero.frame.name)
          .setOrigin(0.5, 1).setScale(this.hero.scaleX, this.hero.scaleY).setFlipX(this.hero.flipX)
          .setTint(0x9ffff0).setAlpha(0.5).setDepth(4);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      },
    });
  }

  endDash() {
    this.dashing = false;
    this.player.body.setAllowGravity(true);
  }

  // 구멍에 빠지면 마지막으로 지나간 문(없으면 출발지)으로 돌아간다. 코인은 줄지 않는다.
  respawn() {
    if (this.dashing) this.endDash();
    state.play.falls += 1;
    const d = this.level.doors[this.checkpoint - 1];
    const at = d ? { x: d.x, y: d.y - 50 } : this.level.start;
    this.player.body.reset(at.x, at.y);
  }

  onHit(player, obstacle) {
    if (this.invuln || this.clearing) return;
    if (this.dashing) this.endDash();

    state.play.hits += 1;
    const shielded = state.play.shieldLeft;
    if (shielded) {
      sparkle(this, player.x, player.y, 0x9fd8ff, 14);
      play('coin');
      // 보호막: 충돌 1번은 코인이 줄지 않는다
      state.play.shieldLeft = false;
      this.guide.setBase(guideText());
      this.guide.notice('보호막이 충돌을 막았어요', CSS.good);
    } else {
      const lost = Math.min(state.coins, RULES.HIT_COIN_LOSS);
      state.coins = Math.max(0, state.coins - RULES.HIT_COIN_LOSS);
      this.hud.flashCoins(CSS.bad);
      if (lost > 0) coinPop(this, player.x, player.y - 40, `-${lost}`, CSS.bad);
      if (!reducedMotion()) this.cameras.main.shake(120, 0.004);
      play('hit');
      reportProgress();
    }
    this.hud.update();

    const dir = Math.sign(player.x - (obstacle.x + obstacle.width / 2)) || -this.facing;
    player.body.setVelocity(dir * 200, -250);
    this.stunUntil = this.time.now + PHYS.HIT_STUN_MS;

    this.invuln = true;
    const blink = this.tweens.add({ targets: player, alpha: 0.3, duration: 100, yoyo: true, repeat: -1 });
    this.time.delayedCall(PHYS.HIT_INVULN_MS, () => {
      this.invuln = false;
      blink.stop();
      player.setAlpha(1);
    });

    if (!shielded && state.coins === 0) {
      this.scene.pause();
      this.scene.launch('Quiz', { mode: 'revive' });
      this.scene.bringToTop('Quiz'); // 던전 위에 그려지도록
    }
  }

  onClear() {
    if (this.clearing) return;
    this.clearing = true;
    const stats = playStats(true); // 깃발에 닿은 순간의 기록 (클리어 시간 포함)
    clearDungeon(this.index);
    reportProgress(null);
    // 깃발 반짝임과 말랑이 점프를 잠깐 보여 준 뒤 결과 화면으로
    this.player.body.setVelocity(0, -300);
    sparkle(this, this.flag.x, this.flag.y - 40, 0xffd54f, 30);
    play('clear');
    this.time.delayedCall(reducedMotion() ? 0 : 650, () => this.scene.start('Result', { mode: 'clear', dungeon: this.index, stats }));
  }
}
