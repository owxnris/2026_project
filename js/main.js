import { COLORS, LAYOUT, PHYS } from './config.js';
import StartScene from './scenes/StartScene.js';
import WorldMapScene from './scenes/WorldMapScene.js';
import QuizScene from './scenes/QuizScene.js';
import DungeonScene from './scenes/DungeonScene.js';
import ResultScene from './scenes/ResultScene.js';
import JoinScene from './scenes/JoinScene.js';
import WaitingScene from './scenes/WaitingScene.js';
import ShopScene from './scenes/ShopScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: LAYOUT.W,
  height: LAYOUT.H,
  backgroundColor: COLORS.bg,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true }, // 참여 화면 입력창(HTML input)
  physics: { default: 'arcade', arcade: { gravity: { y: PHYS.GRAVITY } } },
  scene: [StartScene, JoinScene, WaitingScene, WorldMapScene, QuizScene, ShopScene, DungeonScene, ResultScene],
});
