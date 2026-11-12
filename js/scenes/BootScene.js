// 처음 한 번: 그림 시트·픽셀 글꼴을 불러오고 애니메이션을 만든 뒤 시작 화면으로
import { LAYOUT } from '../config.js';
import { preloadArt, createArt } from '../art.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { W, H } = LAYOUT;
    const bar = this.add.rectangle(W / 2 - 150, H / 2, 0, 8, 0xffd54f).setOrigin(0, 0.5);
    this.load.on('progress', (p) => bar.setSize(300 * p, 8));
    preloadArt(this);
  }

  async create() {
    createArt(this);
    // 픽셀 글꼴(Galmuri11, CDN)을 기다린다. 학교망에서 막히면 1.5초 뒤 기본 글꼴로 시작한다
    try {
      await Promise.race([document.fonts.load('24px "Galmuri11"'), new Promise((r) => setTimeout(r, 1500))]);
    } catch { /* 기본 글꼴 */ }
    this.scene.start('Start');
  }
}
