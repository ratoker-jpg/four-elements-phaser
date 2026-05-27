import Phaser from 'phaser';
import { loadGeneratedBuildingAndHqAssets, loadGeneratedCivilUnitAssets, loadGeneratedModularUnitAssets, loadGeneratedTerrainAndResourceAssets } from '../assets/runtimeGeneratedAssets';

/**
 * PreloadScene — load all runtime-approved assets, then start GameScene.
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

    // --- Modular combat images (loaded from generated manifest) ---
    loadGeneratedModularUnitAssets(this);

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
