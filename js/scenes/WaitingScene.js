// 대기 화면 (design.md): 학급 이름(본문), '선생님이 시작하면 게임이 열려요'(작은 안내). 정보 표시줄 없음
// 학급의 진행 중 활동을 지켜보다가 시작되면(또는 이미 진행 중이면) 그 활동의 종료 시각으로 월드맵을 연다
import { reasonText } from '../firebase/errors.js';
import { CSS, LAYOUT } from '../config.js';
import { watchRunningActivities } from '../firebase/student.js';
import { serverNow } from '../firebase/clock.js';
import { session, enterActivity } from '../session.js';
import { state, resetGame, restoreCleared } from '../state.js';
import { loadClearedCount } from '../progress.js';
import { loadAdventure, setAdventureBase } from '../firebase/adventure.js';
import { DUNGEONS } from '../dungeons.js';
import { text, createBackButton, createSoundToggle } from '../ui.js';
import {
  backdrop, fadeIn, panel, sprite, dressedHero, UI, TD, SCALE,
} from '../art.js';
import { COLORS as SKINS } from '../cosmetics.js';
import { playMusic } from '../music.js';

const cx = LAYOUT.W / 2;

export default class WaitingScene extends Phaser.Scene {
  constructor() { super('Waiting'); }

  create() {
    this.entering = false;
    backdrop(this);
    fadeIn(this);
    playMusic('menu');
    panel(this, cx, 240, 560, 220, UI.wood, 0x8a6a8a).setAlpha(0.9);
    createBackButton(this, () => this.scene.start('Start'));
    createSoundToggle(this, LAYOUT.W - 40, 30); // 소리 켜기·끄기
    // 기다리는 동안 말랑이가 통통 뛴다
    const hero = sprite(this, cx, 470, 'td', TD.hero).setOrigin(0.5, 1).setScale(SCALE + 1);
    this.tweens.add({ targets: hero, y: 440, duration: 380, yoyo: true, repeat: -1, ease: 'Quad.out', repeatDelay: 700 });
    this.heroImage = hero;
    text(this, cx, 200, session.className, 'body').setOrigin(0.5);
    text(this, cx, 245, `${session.nickname} · 선생님이 시작하면 게임이 열려요`, 'small').setOrigin(0.5);
    this.error = text(this, cx, 300, '', 'small', CSS.bad).setOrigin(0.5);
    // 이어서 모험하기: 지난 수업까지 깬 방과 골드 (선생님이 시작하면 그 다음 방부터 이어서 열린다)
    this.adventure = loadAdventure();
    this.adventure.then((adv) => {
      if (!this.scene.isActive()) return;
      // 꾸민 말랑이 (몸 색·모자)
      const d = dressedHero(this, cx, 470, adv.look, SKINS.find((c) => c.id === adv.look.color), SCALE + 1);
      this.heroImage.destroy();
      this.tweens.add({ targets: d.body, y: 440, duration: 380, yoyo: true, repeat: -1, ease: 'Quad.out', repeatDelay: 700, onUpdate: d.sync });
      const msg = adv.clearedCount > 0
        ? `이어서 모험하기 · 깬 방 ${adv.clearedCount}/${DUNGEONS.length} · 골드 ${adv.gold} — 다음은 '${DUNGEONS[Math.min(adv.clearedCount, DUNGEONS.length - 1)].name}'`
        : '새 모험 시작 · 첫 번째 방 \'잊혀진 숲\'부터 열려요';
      text(this, cx, 280, msg, 'small', CSS.good).setOrigin(0.5);
    });

    this.stop = watchRunningActivities(session.classId, (list) => {
      this.error.setText('');
      // 종료 시각이 지난 활동은 끝난 것으로 본다
      const a = list.find((x) => x.endAt && x.endAt.toMillis() > serverNow());
      if (!a) return;
      if (this.entering) return;
      this.entering = true;
      enterActivity(a.id);
      session.mode = a.mode === 'goldrush' ? 'goldrush' : 'adventure';
      resetGame(a.endAt.toMillis());
      // 모험 기록(지난 수업까지 깬 방)과 이 활동에서 깬 던전 중 큰 쪽까지 열어 이어 간다
      Promise.all([loadClearedCount().catch(() => 0), this.adventure]).then(([n, adv]) => {
        setAdventureBase(adv);
        restoreCleared(Math.max(n, adv.clearedCount));
        state.gold = adv.gold;
        state.style = { owned: adv.owned, look: adv.look, spent: adv.spent };
        state.donated = adv.donated;
        if (this.scene.isActive()) this.scene.start(session.mode === 'goldrush' ? 'GoldRush' : 'WorldMap');
      });
    }, (e) => {
      this.error.setText(`활동 정보를 받지 못했어요 (${reasonText(e)})`);
    });
    this.events.once('shutdown', () => this.stop());
  }
}
