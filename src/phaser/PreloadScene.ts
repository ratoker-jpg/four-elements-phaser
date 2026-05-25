import Phaser from 'phaser';
import {
  ASSET_KEYS,
  ASSET_PATHS,
  SPRITESHEET_8X8_256,
} from '../assets/assetManifest';
import { loadModularUnitAssets } from '../assets/modularUnitAssets';
import { loadCivilUnitAssets } from '../assets/civilUnitAssets';
import { loadBuildingAssets } from '../assets/buildingAssets';

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

    // --- Buildings ---
    this.load.image(ASSET_KEYS.HQ_CYAN, ASSET_PATHS[ASSET_KEYS.HQ_CYAN]);

    // --- Units (spritesheet) ---
    this.load.spritesheet(
      ASSET_KEYS.HARVESTER_CYAN,
      ASSET_PATHS[ASSET_KEYS.HARVESTER_CYAN],
      {
        frameWidth: SPRITESHEET_8X8_256.frameWidth,
        frameHeight: SPRITESHEET_8X8_256.frameHeight,
      },
    );

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

    // --- Modular combat images (separate 256x256 direction PNGs) ---
    loadModularUnitAssets(this);

    // --- Civil unit spritesheets (builder + harvester per faction) ---
    loadCivilUnitAssets(this);

    // --- Building PNGs (all buildings + non-cyan HQ per faction) ---
    loadBuildingAssets(this);

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
