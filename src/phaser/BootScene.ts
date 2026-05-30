import Phaser from 'phaser';

/**
 * BootScene — minimal init, then hand off to the appropriate scene.
 *
 * Normal flow: BootScene → PreloadScene → MainMenuScene → ...
 * Visual02a flow: BootScene → Visual02aPreviewScene (dev-only preview)
 * Visual03a flow: BootScene → Visual03aPreviewScene (dev-only runtime prototype)
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

/** Check if the ?visual03a URL parameter is present. */
function isVisual03aPreview(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('visual03a');
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

    // VISUAL-03A: dev-only runtime prototype — bypass normal game flow
    if (isVisual03aPreview()) {
      console.log('[BootScene] Visual03a prototype mode detected. Starting Visual03aPreviewScene.');
      this.scene.start('Visual03aPreviewScene');
      return;
    }

    console.log('[BootScene] Boot complete. Starting PreloadScene.');
    this.scene.start('PreloadScene');
  }
}
