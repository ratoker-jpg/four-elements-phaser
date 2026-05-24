import Phaser from 'phaser';

/**
 * BootScene — minimal init, then hand off to PreloadScene.
 * No assets loaded here.
 *
 * WebGL enforcement is handled by Phaser.WEBGL in gameConfig.
 * No runtime instanceof guard — we already had a production blank-screen
 * issue caused by that style of check.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    console.log('[BootScene] Boot complete. Starting PreloadScene.');
    this.scene.start('PreloadScene');
  }
}
