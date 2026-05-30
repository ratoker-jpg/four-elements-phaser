import Phaser from 'phaser';

/**
 * BootScene — minimal init, then hand off to the appropriate scene.
 *
 * Normal flow: BootScene → PreloadScene → MainMenuScene → ...
 * Visual02a flow: BootScene → Visual02aPreviewScene (dev-only preview)
 *
 * WebGL enforcement is handled by Phaser.WEBGL in gameConfig.
 * No runtime instanceof guard — we already had a production blank-screen
 * issue caused by that style of check.
 */

/** Check if the ?visual02a URL parameter is present. */
function isVisual02aPreview(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('visual02a');
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // VISUAL-02A: dev-only preview route — bypass normal game flow
    if (isVisual02aPreview()) {
      console.log('[BootScene] Visual02a preview mode detected. Starting Visual02aPreviewScene.');
      this.scene.start('Visual02aPreviewScene');
      return;
    }

    console.log('[BootScene] Boot complete. Starting PreloadScene.');
    this.scene.start('PreloadScene');
  }
}
