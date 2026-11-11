import { COLORS, CSS, LAYOUT, RULES, PHYS } from '../config.js';
import { DUNGEONS } from '../dungeons.js';
import { state, checkTimeout, clearDungeon } from '../state.js';
import { text, createHud, createGuide } from '../ui.js';
import { playStats } from '../quiz.js';
import { reportProgress } from '../progress.js';

// 안내 줄: 조작과 가진 능력 (예: ←→ 이동 · Space 점프 · Shift 대시(남은 2회) · 보호막 · 이단 점프)
function guideText() {
  const p = state.play;
  const parts = ['←→ 이동', 'Space 점프'];
  if (p.abilities.dash > 0) parts.push(`Shift 대시(남은 ${p.dashLeft}회)`);
  if (p.shieldLeft) parts.push('보호막');
  if (p.abilities.doubleJump) parts.push('이단 점프(공중에서 Space)');
  return parts.join(' · ');
}

const { H } = LAYOUT;

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
  }

  create() {
    const L = this.level;
    this.physics.world.setBounds(0, 0, L.width, H);
    this.physics.world.setBoundsCollision(true, true, false, false); // 아래로는 떨어질 수 있게
    this.cameras.main.setBounds(0, 0, L.width, H);

    this.buildCourse(L);
    state.play.dungeonStartMs = Date.now();

    this.player = this.add.rectangle(L.start.x, L.start.y, 32, 48, COLORS.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
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

  buildCourse(L) {
    this.platforms = this.physics.add.staticGroup();
    L.platforms.forEach(([x, y, w, h]) => {
      const r = this.add.rectangle(x, y, w, h, COLORS.player, 0.4).setOrigin(0);
      this.physics.add.existing(r, true);
      this.platforms.add(r);
    });

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    L.obstacles.forEach((o) => {
      const r = this.add.rectangle(o.x, o.y, o.w, o.h, COLORS.obstacle).setOrigin(0);
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
    });

    L.doors.forEach((d, i) => {
      this.add.rectangle(d.x, d.y, 50, 90).setOrigin(0.5, 1).setStrokeStyle(2, COLORS.player);
      text(this, d.x, d.y - 104, `문 ${i + 1}`, 'small').setOrigin(0.5);
    });

    this.flagPole = this.add.rectangle(L.flag.x, L.flag.y, 6, 120, COLORS.good).setOrigin(0.5, 1);
    this.physics.add.existing(this.flagPole, true);
    this.add.rectangle(L.flag.x + 3, L.flag.y - 120, 40, 26, COLORS.good).setOrigin(0);
  }

  onResume() {
    this.input.keyboard.resetKeys();
  }

  update(time) {
    if (checkTimeout(this) || this.clearing) return;

    const passed = this.level.doors.filter((d) => this.player.x > d.x).length;
    if (passed > this.checkpoint) {
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
      // 보호막: 충돌 1번은 코인이 줄지 않는다
      state.play.shieldLeft = false;
      this.guide.setBase(guideText());
      this.guide.notice('보호막이 충돌을 막았어요', CSS.good);
    } else {
      state.coins = Math.max(0, state.coins - RULES.HIT_COIN_LOSS);
      this.hud.flashCoins(CSS.bad);
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
    this.scene.start('Result', { mode: 'clear', dungeon: this.index, stats });
  }
}
