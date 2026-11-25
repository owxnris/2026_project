// 따라오는 유령 (2026-11-25, 사용자 선택 — 뒤쪽 방을 더 어렵게): 말랑이가 wakeX를 지나면 화면 왼쪽 밖에서 나타나
// 벽을 지나 말랑이 쪽으로 천천히 날아온다. 말랑이(이동 220)보다 느려서 멈추지 않고 달리면 따돌릴 수 있다.
// 닿으면 보통 장애물과 같다(DungeonScene.onHit: 코인 감소·보호막). 닿거나 구멍에 빠져 다시 시작하면 유령은 뒤로 물러난다.
// 방 데이터: level.chasers = [{ wakeX, speed }] (js/dungeons.js)
import { SCALE, TD, tinted, reducedMotion } from './art.js';

const SIZE = 36; // 충돌 상자
const BACK_OFF = 360; // 닿은 뒤 말랑이 뒤로 물러나는 거리

export function createChasers(scene, list = [], obstacles, onWake) {
  const ghosts = list.map((c) => {
    const r = scene.add.rectangle(-200, -200, SIZE, SIZE, 0xffffff).setOrigin(0).setVisible(false);
    obstacles.add(r);
    r.body.moves = false; // 위치는 아래 update가 정한다
    r.body.enable = false; // 깨어나기 전에는 부딪히지 않는다
    // 보라색 큰 유령 (성의 보통 유령 장애물과 구별)
    const m = scene.add.image(-200, -200, tinted(scene, 'td', TD.ghost, 0xb07cff)).setScale(SCALE + 1).setAlpha(0).setDepth(6);
    return { ...c, r, m, awake: false, restUntil: 0 };
  });

  // 말랑이 뒤쪽(왼쪽 화면 밖)에 둔다
  function placeBehind(g, player) {
    g.r.setPosition(Math.max(-SIZE, player.x - BACK_OFF), Math.max(90, player.y - 120));
    g.m.setAlpha(0);
    scene.tweens.add({ targets: g.m, alpha: 0.85, duration: 400 });
  }

  return {
    get list() { return ghosts; },
    update(delta, player, time) {
      ghosts.forEach((g) => {
        if (!g.awake) {
          if (player.x < g.wakeX) return;
          g.awake = true;
          g.r.body.enable = true;
          g.r.setPosition(scene.cameras.main.scrollX - 60, 120);
          scene.tweens.add({ targets: g.m, alpha: 0.85, duration: 400 });
          onWake?.();
        }
        if (time >= g.restUntil) {
          const tx = player.x - SIZE / 2;
          const ty = player.y - SIZE / 2;
          const dx = tx - g.r.x;
          const dy = ty - g.r.y;
          const dist = Math.hypot(dx, dy) || 1;
          const step = Math.min(dist, (g.speed * delta) / 1000);
          g.r.setPosition(g.r.x + (dx / dist) * step, g.r.y + (dy / dist) * step);
        }
        g.r.body.updateFromGameObject();
        const bob = reducedMotion() ? 0 : Math.sin(time / 260) * 4;
        g.m.setPosition(g.r.x + SIZE / 2, g.r.y + SIZE / 2 + bob).setFlipX(player.x < g.r.x);
      });
    },
    // 닿은 유령은 뒤로 물러나 잠깐 쉰다
    pushBack(obstacle, player, time) {
      const g = ghosts.find((x) => x.r === obstacle);
      if (!g) return false;
      placeBehind(g, player);
      g.restUntil = time + 800;
      return true;
    },
    // 구멍에 빠져 다시 시작할 때: 깨어 있는 유령은 모두 뒤로
    resetAll(player, time) {
      ghosts.filter((g) => g.awake).forEach((g) => { placeBehind(g, player); g.restUntil = time + 800; });
    },
  };
}
