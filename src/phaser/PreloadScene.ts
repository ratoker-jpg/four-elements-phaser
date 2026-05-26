import Phaser from 'phaser';
import { loadGeneratedBuildingAndHqAssets, loadGeneratedCivilUnitAssets, loadGeneratedModularUnitAssets, loadGeneratedTerrainAndResourceAssets } from '../assets/runtimeGeneratedAssets';

/**
 * PreloadScene — load all runtime-approved assets, then start GameScene.
 */
export class PreloadScene extends Phaser.Scene {
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

    // Loading progress
    this.load.on('progress', (value: number) => {
      console.log(`[PreloadScene] Loading: ${Math.round(value * 100)}%`);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[PreloadScene] Failed to load: ${file.key} (${file.url})`);
    });
  }

  create(): void {
    console.log('[PreloadScene] All assets loaded.');
    this.scene.start('GameScene');
  }
}
