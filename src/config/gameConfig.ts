import Phaser from 'phaser';
import { BootScene } from '../phaser/BootScene';
import { PreloadScene } from '../phaser/PreloadScene';
import { GameScene } from '../phaser/GameScene';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,

    width: 1024,
    height: 768,

    parent: 'game-container',

    // Scale: fit the container, center the canvas
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    // WebGL-only: no Canvas fallback, no AUTO
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      transparent: false,
    },

    scene: [BootScene, PreloadScene, GameScene],

    // Disable physics — PR1 is static scene only
    physics: undefined,

    // Banner in console
    banner: {
      text: '#4fc3f7',
      background: ['#1a1a2e'],
    },
  };
}
