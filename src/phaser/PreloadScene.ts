import Phaser from 'phaser';
import { loadGeneratedBuildingAndHqAssets, loadGeneratedCivilUnitAssets, loadGeneratedModularUnitAssets, loadGeneratedTerrainAndResourceAssets } from '../assets/runtimeGeneratedAssets';
import { isDevtoolsEnabled } from '../state/devCommands';

/**
 * PreloadScene — load all runtime-approved assets, then start GameScene.
 *
 * PHASER4-LOAD-02: modularUnits (64 combat images) are only loaded when
 * devtools/arena mode is active. Standard game startup skips them.
 */
export class PreloadScene extends Phaser.Scene {
  private lastLoggedProgressMilestone = -1;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // --- Terrain + Resources (loaded from generated manifest) ---
    loadGeneratedTerrainAndResourceAssets(this);

    // --- Buildings + HQ (loaded from generated manifest) ---
    loadGeneratedBuildingAndHqAssets(this);

    // --- Civil unit spritesheets (loaded from generated manifest) ---
    loadGeneratedCivilUnitAssets(this);

    // --- Modular combat images (PHASER4-LOAD-02: devtools/arena only) ---
    if (isDevtoolsEnabled()) {
      loadGeneratedModularUnitAssets(this);
      console.log('[PreloadScene] modularUnits loading enabled (devtools/arena mode).');
    } else {
      console.log('[PreloadScene] modularUnits loading skipped (standard mode).');
    }

    // Loading progress — log only at 0%, 25%, 50%, 75%, 100% milestones
    this.load.on('progress', (value: number) => {
      const percent = Math.round(value * 100);
      const milestone = Math.floor(percent / 25) * 25;
      if (milestone > this.lastLoggedProgressMilestone) {
        console.log(`[PreloadScene] Loading: ${milestone}%`);
        this.lastLoggedProgressMilestone = milestone;
      }
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[PreloadScene] Failed to load: ${file.key} (${file.url})`);
    });
  }

  create(): void {
    console.log('[PreloadScene] All assets loaded.');
    this.scene.start('MainMenuScene');
  }
}
