import { COLORS, LAYOUT, PHYS } from './config.js';
import StartScene from './scenes/StartScene.js';
import WorldMapScene from './scenes/WorldMapScene.js';
import QuizScene from './scenes/QuizScene.js';
import DungeonScene from './scenes/DungeonScene.js';
import ResultScene from './scenes/ResultScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: LAYOUT.W,
  height: LAYOUT.H,
  backgroundColor: COLORS.bg,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: PHYS.GRAVITY } } },
  scene: [StartScene, WorldMapScene, QuizScene, DungeonScene, ResultScene],
});
