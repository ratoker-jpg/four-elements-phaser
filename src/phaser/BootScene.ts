import Phaser from 'phaser';

/**
 * BootScene — minimal init, then immediately hand off to PreloadScene.
 * No assets loaded here. No Canvas fallback.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Verify we are running on WebGL
    const renderer = this.game.renderer;
    if (!renderer || !(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
      console.error(
        'STOP: WebGL renderer not active. Phaser.AUTO or Canvas fallback detected.',
      );
      return;
    }
    console.log('[BootScene] WebGL renderer confirmed.');

    this.scene.start('PreloadScene');
  }
}
