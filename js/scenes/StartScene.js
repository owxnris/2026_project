import { LAYOUT, GUIDE_TEXT, CSS } from '../config.js';
import { resetGame } from '../state.js';
import { setQuestions } from '../questions.js';
import { session, leaveActivity } from '../session.js';
import { text, createButton, createGuide } from '../ui.js';
import {
  backdrop, fadeIn, sprite, tiles, ribbon, THEMES, TD, SCALE,
} from '../art.js';

const { W, H } = LAYOUT;

export default class StartScene extends Phaser.Scene {
  constructor() { super('Start'); }

  preload() {
    this.load.json('questions', 'questions.json');
  }

  create() {
    setQuestions(this.cache.json.get('questions'));
    const cx = W / 2;
    backdrop(this);
    fadeIn(this);

    // 제목: 리본 위 큰 글자 (외곽선으로 또렷하게)
    ribbon(this, cx, 150, 420);
    text(this, cx, 96, '던전 대시', 'big', CSS.good).setOrigin(0.5).setStroke('#3f2631', 8).setFontSize(64);
    text(this, cx, 150, 'DUNGEON DASH', 'small', CSS.player).setOrigin(0.5);
    text(this, cx, 205, '퀴즈로 코인을 모으고, 능력을 사서 던전을 돌파하세요', 'small').setOrigin(0.5);

    // 아래 무대: 풀 발판 위의 말랑이와 몬스터들
    tiles(this, 0, 412, W, 54, THEMES[0].top);
    tiles(this, 0, 460, W, 60, THEMES[0].fill);
    const hero = sprite(this, 250, 420, 'td', TD.hero).setOrigin(0.5, 1).setScale(SCALE + 1);
    this.tweens.add({ targets: hero, y: 380, duration: 420, yoyo: true, repeat: -1, ease: 'Quad.out', repeatDelay: 500 });
    [[640, TD.spider], [720, TD.snail], [800, TD.bat]].forEach(([x, f], i) => {
      const m = sprite(this, x, f === TD.bat ? 330 : 420, 'td', f).setOrigin(0.5, 1).setFlipX(true);
      this.tweens.add({ targets: m, scaleY: SCALE * 0.88, duration: 380 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    text(this, cx, 240, '던전 고르기 → 입장 퀴즈 3문제(정답마다 코인 10) → 능력 구매 → 깃발까지 달리기', 'small').setOrigin(0.5).setAlpha(0.7);
    // 주소 하나로 들어온다: 학생은 여기서 참여, 선생님은 교사 플랫폼(teacher.html, Google 로그인)으로
    createButton(this, cx, 300, session.online ? '학생으로 참여' : '시작', () => {
      leaveActivity();
      if (session.online) {
        this.scene.start('Join'); // 참여 코드·닉네임 → 대기 → 교사가 시작하면 월드맵
        return;
      }
      resetGame(); // Firebase 설정값이 없을 때의 예비 흐름: 바로 월드맵 (임시 300초)
      this.scene.start('WorldMap');
    }, { primary: true });
    if (session.online) {
      createButton(this, cx, 362, '선생님 로그인', () => { window.location.href = 'teacher.html'; }, { w: 220, h: 44 });
    }
    createGuide(this, GUIDE_TEXT);
  }
}
