/**
 * Building assets — HQ and building PNGs per faction.
 *
 * ASSET-01: Register building image assets without changing gameplay
 * or rendering. Buildings still render as placeholder diamonds;
 * HQs still use the existing hq_cyan key from assetManifest.ts.
 *
 * Asset key convention:
 *   hq_{faction}                — e.g. hq_green, hq_yellow
 *   building_{faction}_{suffix} — e.g. building_cyan_separator, building_cyan_raw_storage
 *
 * Note: hq_cyan is already registered in assetManifest.ts as
 * HQ_CYAN. This module loads only the non-cyan HQ PNGs to avoid
 * a duplicate-key conflict.
 */

import Phaser from 'phaser';
import type { Faction } from '../state/types';

// ─── Constants ──────────────────────────────────────────────────────

export const BUILDING_ASSET_FACTIONS = ['cyan', 'green', 'yellow', 'purple'] as const;

/**
 * Building types for asset loading.
 * The hyphenated form matches BuildingType in state/types.ts.
 */
export const BUILDING_ASSET_TYPES = [
  'separator',
  'raw-storage',
  'matter-storage',
  'power-plant',
  'command-relay',
  'units-factory',
] as const;

export type BuildingAssetType = (typeof BUILDING_ASSET_TYPES)[number];

/**
 * Map hyphenated BuildingAssetType to underscore-suffix for texture keys.
 * Keys use underscores to match filename convention (no hyphens).
 */
const BUILDING_KEY_SUFFIXES: Record<BuildingAssetType, string> = {
  'separator': 'separator',
  'raw-storage': 'raw_storage',
  'matter-storage': 'matter_storage',
  'power-plant': 'power_plant',
  'command-relay': 'command_relay',
  'units-factory': 'units_factory',
};

/**
 * Map hyphenated building type to the actual PNG filename on disk.
 * Most filenames use underscores; the type system uses hyphens.
 */
const BUILDING_FILE_NAMES: Record<BuildingAssetType, string> = {
  'separator': 'separator.png',
  'raw-storage': 'raw_storage.png',
  'matter-storage': 'matter_storage.png',
  'power-plant': 'power_plant.png',
  'command-relay': 'command_relay.png',
  'units-factory': 'units_factory.png',
};

// ─── Key / Path helpers ─────────────────────────────────────────────

/**
 * Return the Phaser texture key for a building asset.
 * Keys use underscore suffixes matching filename convention.
 *
 * Examples: 'building_cyan_separator', 'building_cyan_raw_storage',
 *           'building_green_power_plant', 'building_purple_units_factory'
 */
export function getBuildingAssetKey(faction: Faction, buildingType: BuildingAssetType): string {
  return `building_${faction}_${BUILDING_KEY_SUFFIXES[buildingType]}`;
}

/**
 * Return the Phaser texture key for an HQ asset.
 *
 * Examples: 'hq_green', 'hq_yellow'
 */
export function getHqAssetKey(faction: Faction): string {
  return `hq_${faction}`;
}

/**
 * Return the loader path (relative to /public) for a building PNG.
 *
 * Example: getBuildingAssetPath('cyan', 'raw-storage')
 *   => 'assets/factions/cyan/buildings/raw_storage.png'
 */
export function getBuildingAssetPath(faction: Faction, buildingType: BuildingAssetType): string {
  return `assets/factions/${faction}/buildings/${BUILDING_FILE_NAMES[buildingType]}`;
}

/**
 * Return the loader path (relative to /public) for an HQ PNG.
 *
 * Example: getHqAssetPath('green') => 'assets/factions/green/buildings/hq_t1.png'
 */
export function getHqAssetPath(faction: Faction): string {
  return `assets/factions/${faction}/buildings/hq_t1.png`;
}

// ─── Loader ─────────────────────────────────────────────────────────

/**
 * Load all building and HQ image assets into the Phaser loader queue.
 *
 * - Building PNGs: all 6 types × 4 factions = 24 images.
 * - HQ PNGs: only green, yellow, purple (cyan is already loaded by
 *   assetManifest.ts as HQ_CYAN to avoid duplicate-key conflict).
 */
export function loadBuildingAssets(scene: Phaser.Scene): void {
  // Building PNGs — all factions, all types
  for (const faction of BUILDING_ASSET_FACTIONS) {
    for (const buildingType of BUILDING_ASSET_TYPES) {
      scene.load.image(
        getBuildingAssetKey(faction, buildingType),
        getBuildingAssetPath(faction, buildingType),
      );
    }
  }

  // HQ PNGs — skip cyan (already in assetManifest.ts)
  for (const faction of BUILDING_ASSET_FACTIONS) {
    if (faction === 'cyan') continue;
    scene.load.image(getHqAssetKey(faction), getHqAssetPath(faction));
  }
}
