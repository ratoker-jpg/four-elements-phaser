/**
 * Generated hull sprite registry, path builders, and on-demand loader.
 *
 * HULL-ASSET-01: Provides the full hull x faction x mod x direction(16)
 * matrix as addressable constants and path builders, but does NOT
 * preload all 1792 PNGs at startup. Instead, the loader functions
 * load one hull+faction+mod set at a time (16 PNGs).
 *
 * The generated hull sprites live under:
 *   public/assets/units/hulls/<hull>/<faction>/<mod>/<hull>_<faction>_<mod>_hull_dirNN_<DIR>.png
 *
 * Each PNG is 512x512 RGBA with a transparent background.
 */

import type { Faction } from '../state/types';

// ─── Hull IDs ────────────────────────────────────────────────────

/** All generated hull chassis IDs (7 hulls). */
export const GENERATED_HULL_IDS = [
  'wasp',
  'hornet',
  'hunter',
  'viking',
  'titan',
  'mammoth',
  'dictator',
] as const;

/** Type for a generated hull chassis ID. */
export type GeneratedHullId = (typeof GENERATED_HULL_IDS)[number];

// ─── Factions ────────────────────────────────────────────────────

/** All generated hull faction colour variants. */
export const GENERATED_HULL_FACTIONS = [
  'cyan',
  'green',
  'yellow',
  'purple',
] as const;

/** Type for a generated hull faction. Matches the existing Faction type. */
export type GeneratedHullFaction = (typeof GENERATED_HULL_FACTIONS)[number];

// ─── Modification tiers ─────────────────────────────────────────

/** All generated hull modification tiers. */
export const GENERATED_HULL_MODS = ['m0', 'm1', 'm2', 'm3'] as const;

/** Type for a generated hull modification tier. */
export type GeneratedHullMod = (typeof GENERATED_HULL_MODS)[number];

// ─── 16-direction definitions ───────────────────────────────────

/** A 16-direction entry with index and compass suffix. */
export interface GeneratedHullDirection16 {
  /** Direction index 0–15. */
  index: number;
  /** Compass suffix used in the filename (e.g. 'E', 'ESE', 'SE', …). */
  suffix: string;
}

/** All 16 compass directions for generated hull sprites. */
export const GENERATED_HULL_DIRECTIONS_16: GeneratedHullDirection16[] = [
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
export type GeneratedHullDir16Index = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

// ─── 8-dir → 16-dir mapping ────────────────────────────────────

/**
 * Map an 8-direction runtime direction (0–7) to the nearest 16-direction index.
 *
 * Runtime 8-dir:  0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
 * Generated 16-dir: 0=E, 2=SE, 4=S, 6=SW, 8=W, 10=NW, 12=N, 14=NE
 *
 * The mapping simply doubles the 8-dir index to get the 16-dir index,
 * because the 16-dir compass includes half-directions (ESE, SSE, …)
 * at odd indices.
 */
export function mapRuntimeDir8ToGeneratedDir16(dir8: number): GeneratedHullDir16Index {
  // dir8 is 0..7; mapped dir16 is 0,2,4,6,8,10,12,14
  const dir16 = dir8 * 2;
  // Clamp to valid range just in case
  return Math.min(Math.max(dir16, 0), 15) as GeneratedHullDir16Index;
}

// ─── Texture key builder ────────────────────────────────────────

/**
 * Build a stable, collision-free Phaser texture key for a generated hull sprite.
 *
 * Format: `generated_hull_<hull>_<faction>_<mod>_dirNN`
 *
 * Example: `generated_hull_wasp_cyan_m0_dir00`
 *
 * The `generated_hull_` prefix prevents collisions with legacy
 * `wasp_m0_hull_<faction>_dir<N>` keys from modularUnitAssets.ts.
 */
export function getGeneratedHullTextureKey(
  hull: GeneratedHullId,
  faction: GeneratedHullFaction,
  mod: GeneratedHullMod,
  dir16: GeneratedHullDir16Index,
): string {
  const dirPadded = String(dir16).padStart(2, '0');
  return `generated_hull_${hull}_${faction}_${mod}_dir${dirPadded}`;
}

// ─── Asset path builder ─────────────────────────────────────────

/**
 * Build the Phaser asset path for a generated hull sprite.
 *
 * Format: `assets/units/hulls/<hull>/<faction>/<mod>/<hull>_<faction>_<mod>_hull_dirNN_<DIR>.png`
 *
 * Example: `assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_hull_dir00_E.png`
 *
 * This path is relative to the Phaser loader base path (typically `public/`).
 */
export function getGeneratedHullAssetPath(
  hull: GeneratedHullId,
  faction: GeneratedHullFaction,
  mod: GeneratedHullMod,
  dir16: GeneratedHullDir16Index,
): string {
  const dirPadded = String(dir16).padStart(2, '0');
  const dirSuffix = GENERATED_HULL_DIRECTIONS_16[dir16].suffix;
  return `assets/units/hulls/${hull}/${faction}/${mod}/${hull}_${faction}_${mod}_hull_dir${dirPadded}_${dirSuffix}.png`;
}

// ─── On-demand loader ───────────────────────────────────────────

/**
 * Load all 16 direction sprites for one hull+faction+mod set.
 *
 * This queues 16 `scene.load.image()` calls for the specified
 * hull/faction/mod combination. The caller must ensure the Phaser
 * loader pipeline is active (e.g. called inside `preload()` or
 * with `scene.load.start()` afterwards for late-loading).
 *
 * Duplicate-key protection: if a texture key already exists in the
 * TextureManager, that direction is skipped to avoid Phaser warnings.
 *
 * Returns the list of texture keys that were actually queued for loading.
 */
export function preloadGeneratedHullSet(
  scene: Phaser.Scene,
  hull: GeneratedHullId,
  faction: GeneratedHullFaction,
  mod: GeneratedHullMod,
): string[] {
  const loadedKeys: string[] = [];

  for (const dir16 of GENERATED_HULL_DIRECTIONS_16) {
    const key = getGeneratedHullTextureKey(hull, faction, mod, dir16.index as GeneratedHullDir16Index);

    // Skip if already loaded (prevents duplicate key warnings)
    if (scene.textures.exists(key)) {
      continue;
    }

    const path = getGeneratedHullAssetPath(hull, faction, mod, dir16.index as GeneratedHullDir16Index);
    scene.load.image(key, path);
    loadedKeys.push(key);
  }

  return loadedKeys;
}

/**
 * Check whether a full generated hull set (all 16 directions)
 * has been loaded for the given hull/faction/mod combination.
 *
 * Uses a single probe key (direction 0 = E) for efficiency.
 * If the probe key exists, we assume the full set was loaded.
 */
export function isGeneratedHullSetLoaded(
  scene: Phaser.Scene,
  hull: GeneratedHullId,
  faction: GeneratedHullFaction,
  mod: GeneratedHullMod,
): boolean {
  const probeKey = getGeneratedHullTextureKey(hull, faction, mod, 0);
  return scene.textures.exists(probeKey);
}

// ─── Default hull config ────────────────────────────────────────

/** Default generated hull ID for initial runtime. Pilot-tuned, needs visual QA. */
export const DEFAULT_GENERATED_HULL: GeneratedHullId = 'wasp';

/** Default generated hull mod for initial runtime. Pilot-tuned, needs visual QA. */
export const DEFAULT_GENERATED_HULL_MOD: GeneratedHullMod = 'm0';

/**
 * Resolve the faction for generated hull lookup.
 * Falls back to 'cyan' if no faction is provided.
 */
export function resolveGeneratedHullFaction(faction?: Faction): GeneratedHullFaction {
  if (faction && (GENERATED_HULL_FACTIONS as readonly string[]).includes(faction)) {
    return faction as GeneratedHullFaction;
  }
  return 'cyan';
}

// ─── Pilot-tuned render constants ───────────────────────────────
// These values are initial pilot estimates for the generated hull
// sprites (512x512) and will need visual QA tuning per hull.

/**
 * Render scale for generated hull sprites.
 * Pilot value: 512px sprites at the same tile footprint as the
 * legacy 256px sprites, so roughly half the scale factor.
 *
 * TODO: Visual QA — tune per hull if sizes differ significantly.
 * Generated hulls may appear at a different visual weight than
 * the legacy chassis sprites.
 */
export const GENERATED_HULL_SCALE = 0.24;

/**
 * Sprite origin X for generated hull sprites.
 * 0.5 = horizontal center.
 * TODO: Visual QA — may need per-hull tuning.
 */
export const GENERATED_HULL_ORIGIN_X = 0.5;

/**
 * Sprite origin Y for generated hull sprites.
 * 0.75 = 75% down from top, matching legacy hull origin.
 * TODO: Visual QA — may need per-hull tuning.
 */
export const GENERATED_HULL_ORIGIN_Y = 0.75;
