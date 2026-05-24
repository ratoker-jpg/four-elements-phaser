import Phaser from 'phaser';

/**
 * BootScene — minimal init, then immediately hand off to PreloadScene.
 * No assets loaded here.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    console.log('[BootScene] Boot complete.');
    this.scene.start('PreloadScene');
  }
}
