/**
 * Civil unit assets — builder and harvester spritesheets per faction.
 *
 * ASSET-01: Register civil unit spritesheets without changing gameplay
 * or rendering. Builders still render as circles; harvesters still use
 * the existing harvester_cyan key from assetManifest.ts.
 *
 * Asset key convention:
 *   builder_{faction}   — e.g. builder_cyan, builder_green
 *   harvester_{faction} — e.g. harvester_green, harvester_yellow
 *
 * Note: harvester_cyan is already registered in assetManifest.ts as
 * HARVESTER_CYAN. This module loads only the non-cyan harvester sheets
 * to avoid a duplicate-key conflict.
 */

import Phaser from 'phaser';
import type { Faction } from '../state/types';
import { SPRITESHEET_8X8_256 } from './assetManifest';

// ─── Constants ──────────────────────────────────────────────────────

export const CIVIL_FACTIONS = ['cyan', 'green', 'yellow', 'purple'] as const;

export const CIVIL_UNIT_TYPES = ['builder', 'harvester'] as const;

export type CivilUnitType = (typeof CIVIL_UNIT_TYPES)[number];

// ─── Key / Path helpers ─────────────────────────────────────────────

/**
 * Return the Phaser texture key for a civil unit spritesheet.
 *
 * Examples: 'builder_cyan', 'harvester_green'
 */
export function getCivilUnitKey(faction: Faction, unitType: CivilUnitType): string {
  return `${unitType}_${faction}`;
}

/**
 * Return the loader path (relative to /public) for a civil unit spritesheet.
 *
 * Examples:
 *   getCivilUnitPath('cyan', 'builder') => 'assets/factions/cyan/units/builder_8x8_256.png'
 *   getCivilUnitPath('green', 'harvester') => 'assets/factions/green/units/harvester_8x8_256.png'
 */
export function getCivilUnitPath(faction: Faction, unitType: CivilUnitType): string {
  return `assets/factions/${faction}/units/${unitType}_8x8_256.png`;
}

// ─── Loader ─────────────────────────────────────────────────────────

/**
 * Load all civil unit spritesheets into the Phaser loader queue.
 *
 * - Builder sheets: all 4 factions.
 * - Harvester sheets: only green, yellow, purple (cyan is already loaded
 *   by assetManifest.ts as HARVESTER_CYAN to avoid duplicate-key conflict).
 */
export function loadCivilUnitAssets(scene: Phaser.Scene): void {
  // Builder sheets — all factions
  for (const faction of CIVIL_FACTIONS) {
    scene.load.spritesheet(
      getCivilUnitKey(faction, 'builder'),
      getCivilUnitPath(faction, 'builder'),
      {
        frameWidth: SPRITESHEET_8X8_256.frameWidth,
        frameHeight: SPRITESHEET_8X8_256.frameHeight,
      },
    );
  }

  // Harvester sheets — skip cyan (already in assetManifest.ts)
  for (const faction of CIVIL_FACTIONS) {
    if (faction === 'cyan') continue;
    scene.load.spritesheet(
      getCivilUnitKey(faction, 'harvester'),
      getCivilUnitPath(faction, 'harvester'),
      {
        frameWidth: SPRITESHEET_8X8_256.frameWidth,
        frameHeight: SPRITESHEET_8X8_256.frameHeight,
      },
    );
  }
}
