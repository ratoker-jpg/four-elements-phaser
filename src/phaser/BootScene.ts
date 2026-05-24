import Phaser from 'phaser';

/**
 * BootScene — minimal init, verify WebGL, then hand off to PreloadScene.
 * No assets loaded here.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Verify we are running on WebGL — no Canvas fallback allowed
    const renderer = this.game.renderer;
    if (!renderer || !(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
      console.error(
        '[BootScene] STOP: WebGL renderer not active. Phaser.AUTO or Canvas fallback detected.',
      );
      return;
    }
    console.log('[BootScene] WebGL renderer confirmed. Boot complete.');
    this.scene.start('PreloadScene');
  }
}
