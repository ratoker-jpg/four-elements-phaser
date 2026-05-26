import Phaser from 'phaser';
import {
  ASSET_KEYS,
  ASSET_PATHS,
} from '../assets/assetManifest';
import { loadGeneratedBuildingAndHqAssets, loadGeneratedCivilUnitAssets, loadGeneratedModularUnitAssets } from '../assets/runtimeGeneratedAssets';

/**
 * PreloadScene — load all runtime-approved assets, then start GameScene.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // --- Terrain images (3 legacy tiles) ---
    this.load.image(ASSET_KEYS.TERRAIN_SAND, ASSET_PATHS[ASSET_KEYS.TERRAIN_SAND]);
    this.load.image(
      ASSET_KEYS.TERRAIN_SAND_DARK,
      ASSET_PATHS[ASSET_KEYS.TERRAIN_SAND_DARK],
    );
    this.load.image(
      ASSET_KEYS.TERRAIN_SAND_LIGHT,
      ASSET_PATHS[ASSET_KEYS.TERRAIN_SAND_LIGHT],
    );

    // --- Buildings + HQ (loaded from generated manifest) ---
    loadGeneratedBuildingAndHqAssets(this);

    // --- Civil unit spritesheets (loaded from generated manifest) ---
    loadGeneratedCivilUnitAssets(this);

    // --- Resources ---
    this.load.image(
      ASSET_KEYS.MINERAL_SMALL,
      ASSET_PATHS[ASSET_KEYS.MINERAL_SMALL],
    );
    this.load.image(
      ASSET_KEYS.MINERAL_MEDIUM,
      ASSET_PATHS[ASSET_KEYS.MINERAL_MEDIUM],
    );
    this.load.image(
      ASSET_KEYS.MINERAL_LARGE,
      ASSET_PATHS[ASSET_KEYS.MINERAL_LARGE],
    );

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
