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

// ─── Body angle → direction helpers ─────────────────────────────

/**
 * Quantize a continuous body angle (radians, screen-space) to the
 * nearest 8-direction index used by the runtime direction system.
 *
 * Screen-space convention (matching directionFromDelta):
 *   E=0 (~0rad), SE=1 (~PI/4), S=2 (~PI/2), SW=3 (~3PI/4),
 *   W=4 (~±PI), NW=5 (~-3PI/4), N=6 (~-PI/2), NE=7 (~-PI/4)
 *
 * Default (angle=0): returns 0 (E).
 */
export function bodyAngleToDir8(bodyAngle: number): number {
  // Normalize to -PI..PI
  let a = bodyAngle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;

  // Quantize to 8 sectors (PI/4 each)
  const sector = Math.round(a / (Math.PI / 4));
  const map: Record<number, number> = {
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
    '-4': 4, '-3': 5, '-2': 6, '-1': 7,
  };
  return map[sector] ?? 2; // default S if out of range
}

/**
 * Convert a blockout vehicle modificationLevel (0–3) to the
 * generated hull mod string ('m0'–'m3').
 *
 * Clamps out-of-range values to the nearest valid mod.
 */
export function modificationLevelToMod(level: number): GeneratedHullMod {
  const clamped = Math.min(Math.max(Math.round(level), 0), 3);
  return GENERATED_HULL_MODS[clamped];
}

/**
 * Check whether a BodyId string is a valid GeneratedHullId.
 *
 * This bridges the blockout vehicle bodyId (e.g. 'wasp', 'hornet')
 * to the generated hull asset system. Returns the typed hull ID
 * if valid, or null if the bodyId has no generated hull assets.
 */
export function bodyIdToGeneratedHullId(bodyId: string): GeneratedHullId | null {
  if ((GENERATED_HULL_IDS as readonly string[]).includes(bodyId)) {
    return bodyId as GeneratedHullId;
  }
  return null;
}

// ─── Wasp-only visual direction calibration ────────────────────────
// PIM-HULL-WASP-DIR-01: Wasp-only calibration MVP.
// Do not generalize without visual validation.
//
// The generated Wasp hull PNGs were rendered by the Three.js web exporter
// (tools/tankviewer-web-exporter/) with a ROTATION_OFFSET_DEG that may not
// perfectly match the Wasp 3DS model's default facing direction. This table
// compensates by remapping the "logical" dir16 (what the code thinks the
// direction should be) to the "visual" dir16 (which PNG actually shows the
// hull facing that screen direction).
//
// Key = logical dir16 (what bodyAngleToDir8 → mapRuntimeDir8ToGeneratedDir16 produces)
// Value = visual dir16 (which Wasp PNG to actually display)
//
// IMPORTANT: This is a Wasp-only empirical calibration.
// Other hulls may need different remap tables once visually validated.
// Turrets are NOT affected by this remap.

/**
 * Wasp-only calibration MVP. Do not generalize without visual validation.
 *
 * Maps logical dir16 → visual dir16 for Wasp generated hull sprites.
 * Logical dir16 is what the direction pipeline produces from bodyAngle.
 * Visual dir16 is which PNG actually shows the Wasp facing the correct
 * screen direction to match the yellow heading/movement arrow.
 *
 * Current calibration: identity (no remap) — needs manual QA to determine
 * the actual offset. The debug overlay (BlockoutVehicleRenderer) will show
 * both raw and remapped dir16 so the correct mapping can be determined.
 */
export const WASP_HULL_VISUAL_DIR16_REMAP: Record<number, number> = {
  0: 0,   // E  → E  (identity — calibrate with manual QA)
  1: 1,   // ESE → ESE
  2: 2,   // SE  → SE
  3: 3,   // SSE → SSE
  4: 4,   // S   → S
  5: 5,   // SSW → SSW
  6: 6,   // SW  → SW
  7: 7,   // WSW → WSW
  8: 8,   // W   → W
  9: 9,   // WNW → WNW
  10: 10, // NW  → NW
  11: 11, // NNW → NNW
  12: 12, // N   → N
  13: 13, // NNE → NNE
  14: 14, // NE  → NE
  15: 15, // ENE → ENE
};

/**
 * Apply hull-specific visual dir16 remap.
 *
 * For Wasp: applies WASP_HULL_VISUAL_DIR16_REMAP.
 * For other hulls: returns the input dir16 unchanged.
 *
 * Wasp-only calibration MVP. Do not generalize without visual validation.
 */
export function applyHullVisualDir16Remap(
  hullId: GeneratedHullId,
  dir16: GeneratedHullDir16Index,
): GeneratedHullDir16Index {
  if (hullId === 'wasp') {
    const remapped = WASP_HULL_VISUAL_DIR16_REMAP[dir16];
    if (remapped !== undefined && remapped >= 0 && remapped <= 15) {
      return remapped as GeneratedHullDir16Index;
    }
  }
  return dir16;
}

/**
 * Resolve the best generated hull texture key for a blockout vehicle.
 *
 * Uses bodyId + faction + modificationLevel to determine the hull set,
 * then uses bodyAngle to pick the correct 16-direction sprite.
 * For Wasp, applies WASP_HULL_VISUAL_DIR16_REMAP to compensate for
 * the PNG rendering rotation offset.
 *
 * Returns the texture key if the texture exists in the scene's
 * TextureManager, or null if no generated hull texture is available
 * (either the bodyId is not supported, or the texture set hasn't
 * been loaded).
 */
export function resolveGeneratedHullKey(
  scene: Phaser.Scene,
  bodyId: string,
  faction: Faction,
  modificationLevel: number,
  bodyAngle: number,
): string | null {
  const hullId = bodyIdToGeneratedHullId(bodyId);
  if (!hullId) return null;

  const hullFaction = resolveGeneratedHullFaction(faction);
  const mod = modificationLevelToMod(modificationLevel);
  const dir8 = bodyAngleToDir8(bodyAngle);
  const logicalDir16 = mapRuntimeDir8ToGeneratedDir16(dir8);
  const visualDir16 = applyHullVisualDir16Remap(hullId, logicalDir16);

  const key = getGeneratedHullTextureKey(hullId, hullFaction, mod, visualDir16);
  if (scene.textures.exists(key)) {
    return key;
  }
  return null;
}

/**
 * Get the diagnostic info for a hull direction resolution.
 * Used by the dev-only direction debug overlay.
 *
 * Returns all intermediate values for debugging:
 * - bodyAngle in degrees
 * - raw dir8 from bodyAngle
 * - logical dir16 (before remap)
 * - visual dir16 (after remap, Wasp-only)
 * - PNG compass suffix
 * - final texture key
 */
export function resolveHullDirectionDiagnostic(
  bodyId: string,
  faction: Faction,
  modificationLevel: number,
  bodyAngle: number,
): {
  bodyAngleDeg: number;
  dir8: number;
  logicalDir16: number;
  visualDir16: number;
  compassSuffix: string;
  textureKey: string;
  hullId: string | null;
} {
  const hullId = bodyIdToGeneratedHullId(bodyId);
  const dir8 = bodyAngleToDir8(bodyAngle);
  const logicalDir16 = mapRuntimeDir8ToGeneratedDir16(dir8);
  const visualDir16 = hullId
    ? applyHullVisualDir16Remap(hullId, logicalDir16)
    : logicalDir16;
  const hullFaction = resolveGeneratedHullFaction(faction);
  const mod = modificationLevelToMod(modificationLevel);
  const compassSuffix = GENERATED_HULL_DIRECTIONS_16[visualDir16]?.suffix ?? '?';
  const textureKey = hullId
    ? getGeneratedHullTextureKey(hullId, hullFaction, mod, visualDir16)
    : '';

  return {
    bodyAngleDeg: Math.round((bodyAngle * 180 / Math.PI) * 100) / 100,
    dir8,
    logicalDir16,
    visualDir16,
    compassSuffix,
    textureKey,
    hullId,
  };
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
 * Whether the direction debug overlay is enabled.
 * Only shown in dev/arena mode. Defaults to false.
 * Toggle via BlockoutVehicleRenderer.toggleDirectionDebug().
 */
export let directionDebugEnabled = false;

/** Toggle the direction debug overlay. Returns new state. */
export function toggleDirectionDebug(): boolean {
  directionDebugEnabled = !directionDebugEnabled;
  return directionDebugEnabled;
}

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
