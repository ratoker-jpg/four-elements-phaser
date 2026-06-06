/**
 * Generated turret sprite registry, path builders, and on-demand loader.
 *
 * RUNTIME-TURRET-01: Provides the full turret x faction x mod x direction(16)
 * matrix as addressable constants and path builders, but does NOT
 * preload all 2560 PNGs at startup. Instead, the loader functions
 * load one turret+faction+mod set at a time (16 PNGs).
 *
 * The generated turret sprites live under:
 *   public/assets/units/turrets/<turret>/<faction>/<mod>/<turret>_<faction>_<mod>_turret_dirNN_<DIR>.png
 *
 * Each PNG is 512x512 RGBA with a transparent background.
 *
 * Important naming mapping:
 *   Runtime weapon ID 'flamethrower' maps to generated turret folder 'firebird'.
 *   The asset folders use the original 3DS model names; the runtime uses
 *   the game-facing weapon IDs. The WEAPON_ID_TO_TURRET_ID map bridges
 *   this gap.
 */

import type { Faction } from '../state/types';
import {
  modificationLevelToMod,
  resolveGeneratedHullFaction,
} from './generatedHullAssets';

// ─── Turret IDs ──────────────────────────────────────────────────

/** All generated turret IDs (10 turrets). Matches asset folder names. */
export const GENERATED_TURRET_IDS = [
  'smoky',
  'thunder',
  'railgun',
  'firebird',
  'freeze',
  'isida',
  'vulcan',
  'twins',
  'ricochet',
  'hammer',
] as const;

/** Type for a generated turret asset ID. */
export type GeneratedTurretId = (typeof GENERATED_TURRET_IDS)[number];

// ─── Factions ────────────────────────────────────────────────────

/** All generated turret faction colour variants. Same as hull factions. */
export const GENERATED_TURRET_FACTIONS = [
  'cyan',
  'green',
  'yellow',
  'purple',
] as const;

/** Type for a generated turret faction. Matches the existing Faction type. */
export type GeneratedTurretFaction = (typeof GENERATED_TURRET_FACTIONS)[number];

// ─── Modification tiers ─────────────────────────────────────────

/** All generated turret modification tiers. Same as hull mods. */
export const GENERATED_TURRET_MODS = ['m0', 'm1', 'm2', 'm3'] as const;

/** Type for a generated turret modification tier. */
export type GeneratedTurretMod = (typeof GENERATED_TURRET_MODS)[number];

// ─── 16-direction definitions ───────────────────────────────────

/** A 16-direction entry with index and compass suffix. */
export interface GeneratedTurretDirection16 {
  /** Direction index 0–15. */
  index: number;
  /** Compass suffix used in the filename (e.g. 'E', 'ESE', 'SE', …). */
  suffix: string;
}

/** All 16 compass directions for generated turret sprites. Same as hull directions. */
export const GENERATED_TURRET_DIRECTIONS_16: GeneratedTurretDirection16[] = [
  { index: 0, suffix: 'E' },
  { index: 1, suffix: 'ESE' },
  { index: 2, suffix: 'SE' },
  { index: 3, suffix: 'SSE' },
  { index: 4, suffix: 'S' },
  { index: 5, suffix: 'SSW' },
  { index: 6, suffix: 'SW' },
  { index: 7, suffix: 'WSW' },
  { index: 8, suffix: 'W' },
  { index: 9, suffix: 'WNW' },
  { index: 10, suffix: 'NW' },
  { index: 11, suffix: 'NNW' },
  { index: 12, suffix: 'N' },
  { index: 13, suffix: 'NNE' },
  { index: 14, suffix: 'NE' },
  { index: 15, suffix: 'ENE' },
] as const;

/** Type for a 16-direction index (0–15). */
export type GeneratedTurretDir16Index = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

// ─── Weapon ID → Turret ID mapping ──────────────────────────────

/**
 * Mapping from runtime WeaponId to generated turret asset folder name.
 *
 * Most weapon IDs match their turret folder names directly.
 * The critical exception is 'flamethrower' → 'firebird' because
 * the 3DS source models use Firebird naming while the runtime game
 * code uses Flamethrower.
 *
 * Shaft is not included — it has no generated turret assets.
 */
const WEAPON_ID_TO_TURRET_ID: Record<string, GeneratedTurretId> = {
  smoky: 'smoky',
  thunder: 'thunder',
  railgun: 'railgun',
  flamethrower: 'firebird',
  freeze: 'freeze',
  isida: 'isida',
  vulcan: 'vulcan',
  twins: 'twins',
  ricochet: 'ricochet',
  hammer: 'hammer',
};

/**
 * Map a runtime weapon ID to the corresponding generated turret asset ID.
 *
 * Returns the GeneratedTurretId if a mapping exists, or null if the
 * weapon has no generated turret assets (e.g. 'shaft' or unknown IDs).
 */
export function weaponIdToTurretId(weaponId: string): GeneratedTurretId | null {
  const mapped = WEAPON_ID_TO_TURRET_ID[weaponId];
  if (mapped !== undefined) {
    return mapped;
  }
  return null;
}

// ─── Turret angle → 16-dir mapping ──────────────────────────────

/**
 * Quantize a continuous turret angle (radians, screen-space) to the
 * nearest 16-direction index.
 *
 * Screen-space convention (matching the generated sprite directions):
 *   dir00 E    = 0 rad
 *   dir01 ESE  = PI/8
 *   dir02 SE   = PI/4
 *   dir03 SSE  = 3*PI/8
 *   dir04 S    = PI/2
 *   dir05 SSW  = 5*PI/8
 *   dir06 SW   = 3*PI/4
 *   dir07 WSW  = 7*PI/8
 *   dir08 W    = PI
 *   dir09 WNW  = -7*PI/8  (or 9*PI/8)
 *   dir10 NW   = -3*PI/4  (or 5*PI/4)
 *   dir11 NNW  = -5*PI/8  (or 11*PI/8)
 *   dir12 N    = -PI/2    (or 3*PI/2)
 *   dir13 NNE  = -3*PI/8  (or 13*PI/8)
 *   dir14 NE   = -PI/4    (or 7*PI/4)
 *   dir15 ENE  = -PI/8    (or 15*PI/8)
 *
 * Unlike body direction (8-dir → even 16-dir indices only), turret
 * direction uses all 16 indices because turrets can face any of
 * the 16 compass directions independently of the hull body.
 *
 * Default (angle=0): returns 0 (E).
 */
export function turretAngleToDir16(angleRad: number): GeneratedTurretDir16Index {
  // Normalize to 0..2*PI
  let a = angleRad % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;

  // Each sector is 2*PI/16 = PI/8 wide
  const sector = Math.round(a / (Math.PI / 8));
  // Wrap sector 16 → 0 (both represent East)
  const dir16 = sector % 16;

  return Math.min(Math.max(dir16, 0), 15) as GeneratedTurretDir16Index;
}

// ─── Texture key builder ────────────────────────────────────────

/**
 * Build a stable, collision-free Phaser texture key for a generated turret sprite.
 *
 * Format: `generated_turret_<turret>_<faction>_<mod>_dirNN`
 *
 * Example: `generated_turret_smoky_cyan_m0_dir00`
 *
 * The `generated_turret_` prefix prevents collisions with:
 * - `generated_hull_` keys from generatedHullAssets.ts
 * - legacy `smoky_m0_turret_<faction>_dir<N>` keys from modularUnitAssets.ts
 */
export function getGeneratedTurretTextureKey(
  turret: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
  dir16: GeneratedTurretDir16Index,
): string {
  const dirPadded = String(dir16).padStart(2, '0');
  return `generated_turret_${turret}_${faction}_${mod}_dir${dirPadded}`;
}

// ─── Asset path builder ─────────────────────────────────────────

/**
 * Build the Phaser asset path for a generated turret sprite.
 *
 * Format: `assets/units/turrets/<turret>/<faction>/<mod>/<turret>_<faction>_<mod>_turret_dirNN_<DIR>.png`
 *
 * Example: `assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_turret_dir00_E.png`
 *
 * This path is relative to the Phaser loader base path (typically `public/`).
 */
export function getGeneratedTurretAssetPath(
  turret: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
  dir16: GeneratedTurretDir16Index,
): string {
  const dirPadded = String(dir16).padStart(2, '0');
  const dirSuffix = GENERATED_TURRET_DIRECTIONS_16[dir16].suffix;
  return `assets/units/turrets/${turret}/${faction}/${mod}/${turret}_${faction}_${mod}_turret_dir${dirPadded}_${dirSuffix}.png`;
}

// ─── On-demand loader ───────────────────────────────────────────

/**
 * Load all 16 direction sprites for one turret+faction+mod set.
 *
 * This queues 16 `scene.load.image()` calls for the specified
 * turret/faction/mod combination. The caller must ensure the Phaser
 * loader pipeline is active (e.g. called inside `preload()` or
 * with `scene.load.start()` afterwards for late-loading).
 *
 * Duplicate-key protection: if a texture key already exists in the
 * TextureManager, that direction is skipped to avoid Phaser warnings.
 *
 * Returns the list of texture keys that were actually queued for loading.
 */
export function preloadGeneratedTurretSet(
  scene: Phaser.Scene,
  turret: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
): string[] {
  const loadedKeys: string[] = [];

  for (const dir16 of GENERATED_TURRET_DIRECTIONS_16) {
    const key = getGeneratedTurretTextureKey(turret, faction, mod, dir16.index as GeneratedTurretDir16Index);

    // Skip if already loaded (prevents duplicate key warnings)
    if (scene.textures.exists(key)) {
      continue;
    }

    const path = getGeneratedTurretAssetPath(turret, faction, mod, dir16.index as GeneratedTurretDir16Index);
    scene.load.image(key, path);
    loadedKeys.push(key);
  }

  return loadedKeys;
}

/**
 * Check whether a full generated turret set (all 16 directions)
 * has been loaded for the given turret/faction/mod combination.
 *
 * Checks all 16 direction keys. Returns true only if every key exists.
 */
export function isGeneratedTurretSetLoaded(
  scene: Phaser.Scene,
  turret: GeneratedTurretId,
  faction: GeneratedTurretFaction,
  mod: GeneratedTurretMod,
): boolean {
  for (const dir16 of GENERATED_TURRET_DIRECTIONS_16) {
    const key = getGeneratedTurretTextureKey(turret, faction, mod, dir16.index as GeneratedTurretDir16Index);
    if (!scene.textures.exists(key)) {
      return false;
    }
  }
  return true;
}

// ─── Default turret config ──────────────────────────────────────

/** Default generated turret ID for initial runtime. Pilot-tuned, needs visual QA. */
export const DEFAULT_GENERATED_TURRET: GeneratedTurretId = 'smoky';

/** Default generated turret mod for initial runtime. Pilot-tuned, needs visual QA. */
export const DEFAULT_GENERATED_TURRET_MOD: GeneratedTurretMod = 'm0';

/**
 * Resolve the faction for generated turret lookup.
 * Delegates to the same logic used by generated hulls.
 * Falls back to 'cyan' if no faction is provided.
 */
export function resolveGeneratedTurretFaction(faction?: Faction): GeneratedTurretFaction {
  // Reuse hull faction resolution — same faction set
  return resolveGeneratedHullFaction(faction) as unknown as GeneratedTurretFaction;
}

// ─── Turret key resolver ────────────────────────────────────────

/**
 * Resolve the best generated turret texture key for a blockout vehicle.
 *
 * Uses weaponId + faction + modificationLevel to determine the turret set,
 * then uses turretAngle to pick the correct 16-direction sprite.
 *
 * Returns the texture key if the texture exists in the scene's
 * TextureManager, or null if no generated turret texture is available
 * (either the weaponId is not supported — e.g. 'shaft' — or the
 * texture set hasn't been loaded).
 *
 * This function does NOT load assets — it only checks if the
 * requested texture already exists.
 */
export function resolveGeneratedTurretKey(
  scene: Phaser.Scene,
  weaponId: string,
  faction: Faction,
  modificationLevel: number,
  turretAngle: number,
): string | null {
  const turretId = weaponIdToTurretId(weaponId);
  if (!turretId) return null;

  const turretFaction = resolveGeneratedTurretFaction(faction);
  const mod = modificationLevelToMod(modificationLevel);
  const dir16 = turretAngleToDir16(turretAngle);

  const key = getGeneratedTurretTextureKey(turretId, turretFaction, mod, dir16);
  if (scene.textures.exists(key)) {
    return key;
  }
  return null;
}

// ─── Pilot-tuned render constants ───────────────────────────────
// These values are initial pilot estimates for the generated turret
// sprites (512x512) and will need visual QA tuning per turret.

/**
 * Render scale for generated turret sprites.
 * Pilot value: matches the hull scale for initial consistency.
 *
 * TODO: Visual QA — tune per turret if sizes differ significantly.
 * Generated turrets may appear at a different visual weight than
 * the hull sprites.
 */
export const GENERATED_TURRET_SCALE = 0.24;

/**
 * Sprite origin X for generated turret sprites.
 * 0.5 = horizontal center.
 * TODO: Visual QA — may need per-turret tuning.
 */
export const GENERATED_TURRET_ORIGIN_X = 0.5;

/**
 * Sprite origin Y for generated turret sprites.
 * 0.5 = vertical center, matching typical turret origin.
 * TODO: Visual QA — may need per-turret tuning.
 */
export const GENERATED_TURRET_ORIGIN_Y = 0.5;
