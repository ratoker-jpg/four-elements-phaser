import { createGameConfig } from './config/gameConfig';
import Phaser from 'phaser';

/**
 * Entry point — create the Phaser game instance with WebGL-only config.
 */
const config = createGameConfig();
const game = new Phaser.Game(config);

// Expose for debugging in dev
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
}

console.log(
  `[Four Elements] Phaser ${Phaser.VERSION} | Renderer: ${game.renderer?.type === Phaser.WEBGL ? 'WebGL' : 'UNKNOWN'}`,
);
