/**
 * Generated turret sprite registry, path builders, and on-demand loader.
 *
 * FIXUP-5: Provides the full turret x faction x mod x direction(16)
 * matrix as addressable constants and path builders for generated
 * 512x512 / 16-dir turret assets.
 *
 * The generated turret sprites live under:
 *   public/assets/units/turrets/<weapon>/<mod>/<faction>/<weapon>_<mod>_turret_<faction>_dirNN_<DIR>.png
 *
 * Each PNG is 512x512 RGBA with a transparent background.
 *
 * This module mirrors the structure of generatedHullAssets.ts for turrets.
 * The legacy 8-dir/256px Smoky turret resolver remains in modularUnitAssets.ts
 * for backward compatibility but is no longer used by the real sprite path
 * in BlockoutVehicleRenderer.
 */

import type { Faction } from '../state/types';
import {
  GENERATED_HULL_DIRECTIONS_16,
  type GeneratedHullDir16Index,
} from './generatedHullAssets';

// ─── Turret IDs ──────────────────────────────────────────────────

/** All generated turret weapon IDs. Currently Smoky only. */
export const GENERATED_TURRET_IDS = ['smoky'] as const;

/** Type for a generated turret weapon ID. */
export type GeneratedTurretId = (typeof GENERATED_TURRET_IDS)[number];

// ─── Factions ────────────────────────────────────────────────────

/** All generated turret faction colour variants. */
export const GENERATED_TURRET_FACTIONS = [
  'cyan',
  'green',
  'yellow',
  'purple',
] as const;

/** Type for a generated turret faction. Matches the existing Faction type. */
export type GeneratedTurretFaction = (typeof GENERATED_TURRET_FACTIONS)[number];

// ─── Modification tiers ─────────────────────────────────────────

/** All generated turret modification tiers. */
export const GENERATED_TURRET_MODS = ['m0'] as const;

/** Type for a generated turret modification tier. Currently M0 only. */
export type GeneratedTurretMod = (typeof GENERATED_TURRET_MODS)[number];

// ─── 16-direction definitions ───────────────────────────────────
// Re-use the same 16-direction definitions as generated hull assets.

export type GeneratedTurretDir16Index = GeneratedHullDir16Index;

/** Re-export hull direction definitions for turret use. */
export const GENERATED_TURRET_DIRECTIONS_16 = GENERATED_HULL_DIRECTIONS_16;

// ─── Source dimensions ──────────────────────────────────────────

/** Source width of generated turret sprites in pixels. */
export const GENERATED_TURRET_SOURCE_WIDTH = 512;

/** Source height of generated turret sprites in pixels. */
export const GENERATED_TURRET_SOURCE_HEIGHT = 512;

/** Sprite origin X for generated turret sprites. 0.5 = horizontal center. */
export const GENERATED_TURRET_ORIGIN_X = 0.5;

/** Sprite origin Y for generated turret sprites. 0.5 = vertical center. */
export const GENERATED_TURRET_ORIGIN_Y = 0.5;

// ─── Render scale ───────────────────────────────────────────────

/**
 * Render scale for generated turret sprites.
 *
 * FIXUP-5: Generated turret sprites (512x512) must be scaled to match
 * the visual size of the turret on the hull. The hull scale is 0.12
 * for 512x512 sprites. Using the same scale for turrets maintains
 * consistent proportional sizing.
 *
 * TODO: Visual QA — may need tuning per turret weapon.
 */
export const GENERATED_TURRET_SCALE = 0.12;

// ─── Weapon-to-turret-id resolver ───────────────────────────────

/**
 * Map a runtime weaponId to a generated turret ID.
 * Returns null if the weapon has no generated turret assets.
 */
export function weaponIdToGeneratedTurretId(weaponId: string): GeneratedTurretId | null {
  if ((GENERATED_TURRET_IDS as readonly string[]).includes(weaponId)) {
    return weaponId as GeneratedTurretId;
  }
  return null;
}

// ─── Faction resolver ───────────────────────────────────────────

/**
 * Resolve the faction for generated turret lookup.
 * Falls back to 'cyan' if no faction is provided or faction is unsupported.
 */
export function resolveGeneratedTurretFaction(faction?: Faction): GeneratedTurretFaction {
  if (faction && (GENERATED_TURRET_FACTIONS as readonly string[]).includes(faction)) {
    return faction as GeneratedTurretFaction;
  }
  return 'cyan';
}

// ─── Mod resolver ───────────────────────────────────────────────

/**
 * Convert a blockout vehicle modificationLevel to the
 * generated turret mod string.
 *
 * Currently only M0 turret assets exist. Higher modification
 * levels fall back to M0.
 */
export function modificationLevelToTurretMod(_level: number): GeneratedTurretMod {
  // Currently only m0 assets are generated
  // TODO: Generate M1-M3 turret assets and map levels correctly
  return 'm0';
}

// ─── Texture key builder ────────────────────────────────────────

/**
 * Build a stable, collision-free Phaser texture key for a generated turret sprite.
 *
 * Format: `generated_turret_<weapon>_<faction>_<mod>_dirNN`
 *
 * Example: `generated_turret_smoky_cyan_m0_dir00`
 *
 * The `generated_turret_` prefix prevents collisions with legacy
 * `smoky_m0_turret_<faction>_dir<N>` keys from modularUnitAssets.ts.
 */
export function getGeneratedTurretTextureKey(
  weapon: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
  dir16: GeneratedTurretDir16Index,
): string {
  const dirPadded = String(dir16).padStart(2, '0');
  return `generated_turret_${weapon}_${faction}_${mod}_dir${dirPadded}`;
}

// ─── Asset path builder ─────────────────────────────────────────

/**
 * Build the Phaser asset path for a generated turret sprite.
 *
 * Format: `assets/units/turrets/<weapon>_<mod>/<faction>/<weapon>_<mod>_turret_<faction>_dirNN_<DIR>.png`
 *
 * Example: `assets/units/turrets/smoky_m0/cyan/smoky_m0_turret_cyan_dir00_E.png`
 *
 * This path is relative to the Phaser loader base path (typically `public/`).
 */
export function getGeneratedTurretAssetPath(
  weapon: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
  dir16: GeneratedTurretDir16Index,
): string {
  const dirPadded = String(dir16).padStart(2, '0');
  const dirSuffix = GENERATED_HULL_DIRECTIONS_16[dir16].suffix;
  return `assets/units/turrets/${weapon}_${mod}/${faction}/${weapon}_${mod}_turret_${faction}_dir${dirPadded}_${dirSuffix}.png`;
}

// ─── On-demand loader ───────────────────────────────────────────

/**
 * Load all 16 direction sprites for one turret+faction+mod set.
 *
 * This queues 16 `scene.load.image()` calls for the specified
 * weapon/faction/mod combination. The caller must ensure the Phaser
 * loader pipeline is active.
 *
 * Duplicate-key protection: if a texture key already exists in the
 * TextureManager, that direction is skipped to avoid Phaser warnings.
 *
 * Returns the list of texture keys that were actually queued for loading.
 */
export function preloadGeneratedTurretSet(
  scene: Phaser.Scene,
  weapon: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
): string[] {
  const loadedKeys: string[] = [];

  for (const dir16 of GENERATED_HULL_DIRECTIONS_16) {
    const key = getGeneratedTurretTextureKey(weapon, faction, mod, dir16.index as GeneratedTurretDir16Index);

    // Skip if already loaded (prevents duplicate key warnings)
    if (scene.textures.exists(key)) {
      continue;
    }

    const path = getGeneratedTurretAssetPath(weapon, faction, mod, dir16.index as GeneratedTurretDir16Index);
    scene.load.image(key, path);
    loadedKeys.push(key);
  }

  return loadedKeys;
}

/**
 * Check whether a full generated turret set (all 16 directions)
 * has been loaded for the given weapon/faction/mod combination.
 *
 * Uses a single probe key (direction 0 = E) for efficiency.
 */
export function isGeneratedTurretSetLoaded(
  scene: Phaser.Scene,
  weapon: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
): boolean {
  const probeKey = getGeneratedTurretTextureKey(weapon, faction, mod, 0);
  return scene.textures.exists(probeKey);
}

// ─── Main resolver ──────────────────────────────────────────────

/**
 * Resolve the best generated turret texture key for a blockout vehicle.
 *
 * Uses weaponId + faction + modificationLevel to determine the turret set,
 * then uses turretVisualDir16 to pick the correct 16-direction sprite.
 *
 * The turretVisualDir16 MUST be the VISIBLE texture direction (not the raw
 * logical direction) to match the displayed sprite. This is computed by
 * turretAngleToVisualDir16() in the turret sprite mounting adapter.
 *
 * Returns the texture key if the texture exists in the scene's
 * TextureManager, or null if no generated turret texture is available.
 *
 * This replaces resolveModularTurretSpriteKey() from modularUnitAssets.ts
 * for the real sprite rendering path in BlockoutVehicleRenderer.
 */
export function resolveGeneratedTurretKey(
  scene: Phaser.Scene,
  weaponId: string,
  faction: Faction,
  modificationLevel: number,
  turretVisualDir16: number,
): string | null {
  const turretId = weaponIdToGeneratedTurretId(weaponId);
  if (!turretId) return null;

  const turretFaction = resolveGeneratedTurretFaction(faction);
  const mod = modificationLevelToTurretMod(modificationLevel);

  // Clamp dir16 to valid range
  const clampedDir16 = Math.min(Math.max(Math.round(turretVisualDir16), 0), 15) as GeneratedTurretDir16Index;

  const key = getGeneratedTurretTextureKey(turretId, turretFaction, mod, clampedDir16);
  if (scene.textures.exists(key)) {
    return key;
  }
  return null;
}
