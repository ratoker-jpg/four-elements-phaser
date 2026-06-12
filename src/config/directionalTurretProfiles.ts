/**
 * TURRET-HULL-CONTRACT-PR-F1: Directional turret pivot/muzzle profile data.
 *
 * Read-only data layer that stores per-direction sprite-space marker points
 * for turret weapons. The pivot and muzzle positions are direction-dependent
 * because different turret PNGs show the turret at different angles, causing
 * the base ring and muzzle tip to appear at different normalized positions
 * in each sprite frame.
 *
 * This module is pure TypeScript — no Phaser imports, no runtime state.
 * It does NOT wire into any renderer. It does NOT change runtime visuals.
 *
 * Source: projected_socket_profile_candidates.json (projection recovery run)
 * Confidence: high for Smoky turret data (v12 pipeline is deterministic).
 *
 * Why a single pivot {px, py} is insufficient:
 * - Each turret direction PNG shows the barrel at a different screen angle.
 * - The base-ring pivot appears at different normalized positions per frame.
 * - The muzzle tip moves even more dramatically per direction.
 * - A single (px=0.5, py=0.5) center origin produces rotating residual
 *   error (audit RC-6): the barrel appears to orbit the wrong center.
 *
 * What this PR does NOT do:
 * - Does NOT update Wasp hull socket values (low confidence).
 * - Does NOT wire into BlockoutVehicleRenderer or ModularTankRenderer.
 * - Does NOT change gameplay bodyAngle/turretAngle.
 * - Does NOT change PR #254 target-lock/rest behavior.
 * - Does NOT tune values by eye.
 */

import type { WeaponId } from './blockoutProfiles';

// ── Direction index constants ──────────────────────────────────────

/** Number of directions in a full 16-direction sprite set. */
export const DIR16_COUNT = 16 as const;

/** Valid direction index range for dir16 sprite sets: 0..15. */
export type Dir16Index = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/** Direction suffix labels for dir16 sprite sets (compass labels). */
export const DIR16_SUFFIXES: readonly string[] = [
  'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE',
] as const;

// ── Direction-dependent point types ────────────────────────────────

/**
 * A 2D point in normalized sprite-space coordinates (0..1).
 *
 * Coordinate system:
 * - x: 0 = left edge of sprite, 1 = right edge.
 * - y: 0 = top edge of sprite, 1 = bottom edge.
 *
 * These are projected from 3D marker positions through the recovered
 * v12 Blender export pipeline, not eye-picked.
 */
export interface DirectionalPoint2D {
  /** Normalized X position in sprite space (0..1). */
  x: number;
  /** Normalized Y position in sprite space (0..1). */
  y: number;
}

/**
 * Per-direction pivot profile for a turret weapon at a specific upgrade tier.
 *
 * The pivot is the base-ring position where the turret rotates around.
 * It varies per direction because the orthographic projection shifts the
 * apparent position of the rotation center in each sprite frame.
 */
export interface DirectionalPivotProfile {
  /** Direction index (0..15 for dir16 sprite sets). */
  dirIndex: number;
  /** Compass suffix label (e.g. 'E', 'ESE'). */
  dirSuffix: string;
  /** Pivot position in normalized sprite-space. */
  position: DirectionalPoint2D;
}

/**
 * Per-direction muzzle profile for a single muzzle object.
 *
 * The muzzle is the barrel tip where projectiles/fire VFX originate.
 * It varies per direction even more dramatically than the pivot.
 */
export interface DirectionalMuzzleProfile {
  /** Object name in the 3DS source file (e.g. 'muzzle01'). */
  objectName: string;
  /** Direction index (0..15 for dir16 sprite sets). */
  dirIndex: number;
  /** Compass suffix label (e.g. 'E', 'ESE'). */
  dirSuffix: string;
  /** Muzzle position in normalized sprite-space. */
  position: DirectionalPoint2D;
}

/**
 * Complete per-direction marker profile for a turret at a specific
 * upgrade tier group (e.g. Smoky M0/M1 from Smoky_01.3ds).
 *
 * This is the top-level data container: for each of the 16 directions,
 * it stores the pivot point and all muzzle points in normalized
 * sprite-space coordinates.
 */
export interface DirectionalTurretMarkerProfile {
  /** Weapon identifier. */
  weaponId: WeaponId;
  /** Source 3DS file that was projected. */
  sourceFile: string;
  /** Upgrade levels this profile applies to. */
  upgradeLevels: number[];
  /** Projection confidence level. */
  confidence: 'high' | 'low';
  /** Human-readable reason for the confidence level. */
  confidenceReason: string;
  /**
   * Asset-basis identifier this profile's coordinates were measured against.
   *
   * This MUST match the basis of the turret texture family the renderer
   * actually loads (see getGeneratedTurretAssetBasis in generatedTurretAssets.ts).
   * Pivot/muzzle coordinates are only valid for the exact PNG family they were
   * derived from: a v12-projection profile is invalid for placeholder-upscaled
   * PNGs and vice versa. The mounting adapter binds pivot lookup to the texture
   * resolver's basis to prevent that mismatch (PR #263 root cause).
   */
  assetBasis: string;
  /** Source PNG width these coordinates are normalized against (e.g. 512). */
  sourceWidthPx: number;
  /** Source PNG height these coordinates are normalized against (e.g. 512). */
  sourceHeightPx: number;
  /** Number of sprite directions this profile covers (e.g. 16). */
  dirCount: number;
  /** Per-direction pivot data (16 entries for dir16). */
  pivots: DirectionalPivotProfile[];
  /** Per-direction muzzle data (16 entries for dir16, each with one or more muzzles). */
  muzzles: DirectionalMuzzleProfile[][];
}

// ── Asset-basis identifiers ────────────────────────────────────────

/**
 * Basis id for true v12 projection-recovered Smoky turret coordinates.
 * Valid ONLY for real v12 512×512 / 16-dir renders (not currently shipped).
 */
export const SMOKY_V12_PROJECTION_BASIS = 'smoky-v12-projection-512-dir16' as const;

/**
 * Basis id for the placeholder Smoky turret PNGs currently shipped
 * (upscaled/interpolated from legacy 8-dir / 256px art in fixup #5).
 * Must equal GENERATED_TURRET_ASSET_BASIS in generatedTurretAssets.ts.
 */
export const SMOKY_PLACEHOLDER_BASIS = 'smoky-placeholder-upscaled-512-dir16' as const;

// ── Direction normalization helper ─────────────────────────────────

/**
 * Normalize a direction index to a valid dir16 range (0..15).
 *
 * Handles:
 * - Negative values: wraps via modulo arithmetic.
 * - Values > 15: wraps via modulo arithmetic.
 * - Non-integer values: truncates to integer first.
 * - NaN/Infinity: returns 0 as safe fallback.
 *
 * Deterministic: same input always produces the same output.
 */
export function normalizeDir16(dir: number): Dir16Index {
  if (!Number.isFinite(dir)) return 0;
  const truncated = Math.trunc(dir);
  return ((truncated % DIR16_COUNT) + DIR16_COUNT) % DIR16_COUNT as Dir16Index;
}

// ── Smoky M0/M1 profile data ──────────────────────────────────────

/**
 * Smoky M0/M1 (Smoky_01.3ds) directional marker profile.
 *
 * Source: projected_socket_profile_candidates.json
 * Pipeline: recovered v12 turret centering, fixed ortho scale,
 *   per-direction camera centering, final filename direction remap.
 * Confidence: HIGH — the v12 pipeline imports 3DS deterministically,
 *   hides helpers, centers by render mesh, and computes fixed ortho scale.
 *
 * Notes:
 * - renderBBoxBasisCorrection was applied (X-basis mismatch between
 *   render mesh raw vertices and 3DS mesh matrix; matrix-origin X used
 *   for render-bbox X centering, delta X=330.422546).
 * - fixedOrthoScale = 532.954539
 * - pivotObjectName = 'fmnt'
 */
export const SMOKY_M01_DIRECTIONAL_PROFILE: DirectionalTurretMarkerProfile = {
  weaponId: 'smoky',
  sourceFile: 'Smoky_01.3ds',
  upgradeLevels: [0, 1],
  confidence: 'high',
  confidenceReason: 'Uses recovered v12 turret centering, fixed ortho fit, and final filename direction remap.',
  assetBasis: SMOKY_V12_PROJECTION_BASIS,
  sourceWidthPx: 512,
  sourceHeightPx: 512,
  dirCount: DIR16_COUNT,
  pivots: [
    { dirIndex: 0,  dirSuffix: 'E',    position: { x: 0.206668, y: 0.464846 } },
    { dirIndex: 1,  dirSuffix: 'ESE',  position: { x: 0.188539, y: 0.419468 } },
    { dirIndex: 2,  dirSuffix: 'SE',   position: { x: 0.217828, y: 0.374927 } },
    { dirIndex: 3,  dirSuffix: 'SSE',  position: { x: 0.290074, y: 0.338004 } },
    { dirIndex: 4,  dirSuffix: 'S',    position: { x: 0.39428,  y: 0.314321 } },
    { dirIndex: 5,  dirSuffix: 'SSW',  position: { x: 0.514581, y: 0.307483 } },
    { dirIndex: 6,  dirSuffix: 'SW',   position: { x: 0.632662, y: 0.318531 } },
    { dirIndex: 7,  dirSuffix: 'WSW',  position: { x: 0.730546, y: 0.345783 } },
    { dirIndex: 8,  dirSuffix: 'W',    position: { x: 0.793332, y: 0.38509 } },
    { dirIndex: 9,  dirSuffix: 'WNW',  position: { x: 0.811461, y: 0.430468 } },
    { dirIndex: 10, dirSuffix: 'NW',   position: { x: 0.782172, y: 0.475009 } },
    { dirIndex: 11, dirSuffix: 'NNW',  position: { x: 0.709926, y: 0.511931 } },
    { dirIndex: 12, dirSuffix: 'N',    position: { x: 0.60572,  y: 0.535615 } },
    { dirIndex: 13, dirSuffix: 'NNE',  position: { x: 0.485419, y: 0.542453 } },
    { dirIndex: 14, dirSuffix: 'NE',   position: { x: 0.367338, y: 0.531405 } },
    { dirIndex: 15, dirSuffix: 'ENE',  position: { x: 0.269454, y: 0.504153 } },
  ],
  muzzles: [
    // dir 0 (E)
    [{ objectName: 'muzzle01', dirIndex: 0, dirSuffix: 'E', position: { x: 0.87379, y: 0.484178 } }],
    // dir 1 (ESE)
    [{ objectName: 'muzzle01', dirIndex: 1, dirSuffix: 'ESE', position: { x: 0.845356, y: 0.538136 } }],
    // dir 2 (SE)
    [{ objectName: 'muzzle01', dirIndex: 2, dirSuffix: 'SE', position: { x: 0.764346, y: 0.583882 } }],
    // dir 3 (SSE)
    [{ objectName: 'muzzle01', dirIndex: 3, dirSuffix: 'SSE', position: { x: 0.643091, y: 0.614453 } }],
    // dir 4 (S)
    [{ objectName: 'muzzle01', dirIndex: 4, dirSuffix: 'S', position: { x: 0.500051, y: 0.625193 } }],
    // dir 5 (SSW)
    [{ objectName: 'muzzle01', dirIndex: 5, dirSuffix: 'SSW', position: { x: 0.357004, y: 0.614468 } }],
    // dir 6 (SW)
    [{ objectName: 'muzzle01', dirIndex: 6, dirSuffix: 'SW', position: { x: 0.235727, y: 0.58391 } }],
    // dir 7 (WSW)
    [{ objectName: 'muzzle01', dirIndex: 7, dirSuffix: 'WSW', position: { x: 0.154683, y: 0.538172 } }],
    // dir 8 (W)
    [{ objectName: 'muzzle01', dirIndex: 8, dirSuffix: 'W', position: { x: 0.12621, y: 0.484216 } }],
    // dir 9 (WNW)
    [{ objectName: 'muzzle01', dirIndex: 9, dirSuffix: 'WNW', position: { x: 0.154644, y: 0.430258 } }],
    // dir 10 (NW)
    [{ objectName: 'muzzle01', dirIndex: 10, dirSuffix: 'NW', position: { x: 0.235654, y: 0.384512 } }],
    // dir 11 (NNW)
    [{ objectName: 'muzzle01', dirIndex: 11, dirSuffix: 'NNW', position: { x: 0.356909, y: 0.353941 } }],
    // dir 12 (N)
    [{ objectName: 'muzzle01', dirIndex: 12, dirSuffix: 'N', position: { x: 0.499949, y: 0.343201 } }],
    // dir 13 (NNE)
    [{ objectName: 'muzzle01', dirIndex: 13, dirSuffix: 'NNE', position: { x: 0.642996, y: 0.353926 } }],
    // dir 14 (NE)
    [{ objectName: 'muzzle01', dirIndex: 14, dirSuffix: 'NE', position: { x: 0.764273, y: 0.384484 } }],
    // dir 15 (ENE)
    [{ objectName: 'muzzle01', dirIndex: 15, dirSuffix: 'ENE', position: { x: 0.845317, y: 0.430222 } }],
  ],
};

// ── Smoky M2/M3 profile data ──────────────────────────────────────

/**
 * Smoky M2/M3 (Smoky_23.3ds) directional marker profile.
 *
 * Source: projected_socket_profile_candidates.json
 * Pipeline: same as M0/M1 (v12 turret centering, fixed ortho scale, etc.)
 * Confidence: HIGH.
 *
 * Notes:
 * - renderBBoxBasisCorrection was NOT applied for M2/M3 (turret bbox
 *   center is consistent with extracted mesh basis).
 * - fixedOrthoScale = 532.954539 (same as M0/M1).
 * - pivotObjectName = 'fmnt'.
 * - The M2/M3 turret model is larger / has extra geometry (Box03),
 *   shifting the pivot and muzzle positions vertically compared to M0/M1.
 */
export const SMOKY_M23_DIRECTIONAL_PROFILE: DirectionalTurretMarkerProfile = {
  weaponId: 'smoky',
  sourceFile: 'Smoky_23.3ds',
  upgradeLevels: [2, 3],
  confidence: 'high',
  confidenceReason: 'Uses recovered v12 turret centering, fixed ortho fit, and final filename direction remap.',
  assetBasis: SMOKY_V12_PROJECTION_BASIS,
  sourceWidthPx: 512,
  sourceHeightPx: 512,
  dirCount: DIR16_COUNT,
  pivots: [
    { dirIndex: 0,  dirSuffix: 'E',    position: { x: 0.206668, y: 0.481365 } },
    { dirIndex: 1,  dirSuffix: 'ESE',  position: { x: 0.18852,  y: 0.435986 } },
    { dirIndex: 2,  dirSuffix: 'SE',   position: { x: 0.217791, y: 0.391441 } },
    { dirIndex: 3,  dirSuffix: 'SSE',  position: { x: 0.290027, y: 0.354512 } },
    { dirIndex: 4,  dirSuffix: 'S',    position: { x: 0.394229, y: 0.330821 } },
    { dirIndex: 5,  dirSuffix: 'SSW',  position: { x: 0.514533, y: 0.323975 } },
    { dirIndex: 6,  dirSuffix: 'SW',   position: { x: 0.632625, y: 0.335017 } },
    { dirIndex: 7,  dirSuffix: 'WSW',  position: { x: 0.730527, y: 0.362264 } },
    { dirIndex: 8,  dirSuffix: 'W',    position: { x: 0.793332, y: 0.40157 } },
    { dirIndex: 9,  dirSuffix: 'WNW',  position: { x: 0.81148,  y: 0.44695 } },
    { dirIndex: 10, dirSuffix: 'NW',   position: { x: 0.782209, y: 0.491495 } },
    { dirIndex: 11, dirSuffix: 'NNW',  position: { x: 0.709973, y: 0.528424 } },
    { dirIndex: 12, dirSuffix: 'N',    position: { x: 0.605771, y: 0.552114 } },
    { dirIndex: 13, dirSuffix: 'NNE',  position: { x: 0.485467, y: 0.55896 } },
    { dirIndex: 14, dirSuffix: 'NE',   position: { x: 0.367375, y: 0.547919 } },
    { dirIndex: 15, dirSuffix: 'ENE',  position: { x: 0.269473, y: 0.520671 } },
  ],
  muzzles: [
    // dir 0 (E)
    [{ objectName: 'muzzle01', dirIndex: 0, dirSuffix: 'E', position: { x: 0.87379, y: 0.500697 } }],
    // dir 1 (ESE)
    [{ objectName: 'muzzle01', dirIndex: 1, dirSuffix: 'ESE', position: { x: 0.845337, y: 0.554654 } }],
    // dir 2 (SE)
    [{ objectName: 'muzzle01', dirIndex: 2, dirSuffix: 'SE', position: { x: 0.764309, y: 0.600396 } }],
    // dir 3 (SSE)
    [{ objectName: 'muzzle01', dirIndex: 3, dirSuffix: 'SSE', position: { x: 0.643043, y: 0.63096 } }],
    // dir 4 (S)
    [{ objectName: 'muzzle01', dirIndex: 4, dirSuffix: 'S', position: { x: 0.5, y: 0.641693 } }],
    // dir 5 (SSW)
    [{ objectName: 'muzzle01', dirIndex: 5, dirSuffix: 'SSW', position: { x: 0.356957, y: 0.63096 } }],
    // dir 6 (SW)
    [{ objectName: 'muzzle01', dirIndex: 6, dirSuffix: 'SW', position: { x: 0.235691, y: 0.600396 } }],
    // dir 7 (WSW)
    [{ objectName: 'muzzle01', dirIndex: 7, dirSuffix: 'WSW', position: { x: 0.154663, y: 0.554654 } }],
    // dir 8 (W)
    [{ objectName: 'muzzle01', dirIndex: 8, dirSuffix: 'W', position: { x: 0.12621, y: 0.500697 } }],
    // dir 9 (WNW)
    [{ objectName: 'muzzle01', dirIndex: 9, dirSuffix: 'WNW', position: { x: 0.154663, y: 0.44674 } }],
    // dir 10 (NW)
    [{ objectName: 'muzzle01', dirIndex: 10, dirSuffix: 'NW', position: { x: 0.235691, y: 0.400998 } }],
    // dir 11 (NNW)
    [{ objectName: 'muzzle01', dirIndex: 11, dirSuffix: 'NNW', position: { x: 0.356957, y: 0.370434 } }],
    // dir 12 (N)
    [{ objectName: 'muzzle01', dirIndex: 12, dirSuffix: 'N', position: { x: 0.5, y: 0.359701 } }],
    // dir 13 (NNE)
    [{ objectName: 'muzzle01', dirIndex: 13, dirSuffix: 'NNE', position: { x: 0.643043, y: 0.370434 } }],
    // dir 14 (NE)
    [{ objectName: 'muzzle01', dirIndex: 14, dirSuffix: 'NE', position: { x: 0.764309, y: 0.400998 } }],
    // dir 15 (ENE)
    [{ objectName: 'muzzle01', dirIndex: 15, dirSuffix: 'ENE', position: { x: 0.845337, y: 0.44674 } }],
  ],
};

// ── Smoky placeholder (image-measured) profile data ────────────────

/**
 * Measured rotation-center pivot for the shipped placeholder Smoky PNGs.
 *
 * MEASUREMENT METHOD (not eye-picked, not v12-projected):
 * Overlapped the alpha masks of all 16 direction frames
 * (public/assets/units/turrets/smoky_m0/<faction>/...). The region covered
 * in ≥14 of 16 frames is the turret base ring (the barrel sweeps away per
 * direction; the base stays). Its centroid is the visible rotation center.
 * Result was identical across all four factions:
 *   base-overlap centroid = (255.5, 232.8) px on the 512×512 canvas
 *                         = (0.4991, 0.4548) normalized.
 * Independent cross-check (algebraic circle-fit of the per-direction barrel
 * tips) gave the same x = 0.499.
 *
 * Unlike the v12 projection profile, the placeholder PNGs rotate the barrel
 * around a FIXED image-space center, so this pivot is direction-INDEPENDENT:
 * every direction uses the same {x, y}. Using the v12 wobbling-ellipse pivot
 * with these PNGs misplaces the turret by ~18px, flipping sides as the turret
 * turns — the detached-turret symptom reported in PR #263 manual QA.
 */
const SMOKY_PLACEHOLDER_PIVOT: DirectionalPoint2D = { x: 0.4991, y: 0.4548 };

/** Build a constant-pivot, no-muzzle dir16 placeholder profile. */
function buildSmokyPlaceholderProfile(
  sourceFile: string,
  upgradeLevels: number[],
): DirectionalTurretMarkerProfile {
  return {
    weaponId: 'smoky',
    sourceFile,
    upgradeLevels,
    confidence: 'high',
    confidenceReason:
      'Placeholder-image-measured: rotation center from alpha-overlap of the shipped 512×512/16-dir placeholder PNGs (direction-independent). NOT a v12 projection.',
    assetBasis: SMOKY_PLACEHOLDER_BASIS,
    sourceWidthPx: 512,
    sourceHeightPx: 512,
    dirCount: DIR16_COUNT,
    pivots: DIR16_SUFFIXES.map((dirSuffix, dirIndex) => ({
      dirIndex,
      dirSuffix,
      position: { ...SMOKY_PLACEHOLDER_PIVOT },
    })),
    // Muzzle tips are NOT reliably recoverable from the placeholder upscales
    // and are not consumed by the runtime attachment path, so they are left
    // unmeasured (empty) rather than fabricated. Wire real muzzle data when
    // true v12 renders replace these placeholders.
    muzzles: DIR16_SUFFIXES.map(() => []),
  };
}

/**
 * Smoky M0/M1 placeholder profile — matches the shipped placeholder PNGs.
 * This is the profile the runtime mounting adapter binds to (via asset basis).
 */
export const SMOKY_M01_PLACEHOLDER_PROFILE: DirectionalTurretMarkerProfile =
  buildSmokyPlaceholderProfile('Smoky_01.3ds (placeholder upscale)', [0, 1]);

/**
 * Smoky M2/M3 placeholder profile — matches the shipped placeholder PNGs.
 * Only M0 PNGs exist today (M1-M3 fall back to M0 art), so the same measured
 * rotation center applies until per-tier renders are produced.
 */
export const SMOKY_M23_PLACEHOLDER_PROFILE: DirectionalTurretMarkerProfile =
  buildSmokyPlaceholderProfile('Smoky_23.3ds (placeholder upscale)', [2, 3]);

// ── Profile registry ───────────────────────────────────────────────

/**
 * Default directional turret marker profiles (v12 projection basis).
 *
 * Indexed by weaponId for fast lookup. Multiple profiles per weapon
 * are distinguished by upgrade level. These are kept as the reference
 * v12 data; the legacy basis-agnostic resolvers below resolve from this
 * set for backward compatibility.
 */
const DIRECTIONAL_PROFILES: ReadonlyArray<DirectionalTurretMarkerProfile> = [
  SMOKY_M01_DIRECTIONAL_PROFILE,
  SMOKY_M23_DIRECTIONAL_PROFILE,
] as const;

/**
 * All directional turret marker profiles across every asset basis.
 * Used by the basis-aware resolvers so the renderer can bind pivot lookup
 * to the exact texture family it loads.
 */
const ALL_DIRECTIONAL_PROFILES: ReadonlyArray<DirectionalTurretMarkerProfile> = [
  ...DIRECTIONAL_PROFILES,
  SMOKY_M01_PLACEHOLDER_PROFILE,
  SMOKY_M23_PLACEHOLDER_PROFILE,
] as const;

// ── Resolver helpers ───────────────────────────────────────────────

/**
 * Resolve the directional turret marker profile for a weapon and upgrade level.
 *
 * Returns the profile if the weapon has directional data and the upgrade
 * level is covered, or null for unsupported weapons/levels (graceful fallback).
 *
 * The returned profile contains all 16 directions of pivot and muzzle data.
 * To get a specific direction's data, use resolveTurretPivotForDir or
 * resolveTurretMuzzlesForDir.
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveDirectionalProfile(
  weaponId: string,
  upgradeLevel: number,
): DirectionalTurretMarkerProfile | null {
  const profile = DIRECTIONAL_PROFILES.find(
    p => p.weaponId === weaponId && p.upgradeLevels.includes(upgradeLevel),
  );
  return profile ?? null;
}

/**
 * Resolve the turret pivot position for a specific weapon, upgrade level,
 * and direction index.
 *
 * Takes a weaponId, upgradeLevel (0-3), and a dir16 index (0-15).
 * The dir16 index is normalized via normalizeDir16 before lookup.
 *
 * Returns the DirectionalPoint2D for the pivot if the profile exists,
 * or null for unsupported weapons/levels (graceful fallback — the
 * renderer can fall back to the legacy single-pivot from PivotProfile).
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveTurretPivotForDir(
  weaponId: string,
  upgradeLevel: number,
  dir: number,
): DirectionalPoint2D | null {
  const profile = resolveDirectionalProfile(weaponId, upgradeLevel);
  if (!profile) return null;
  const normalized = normalizeDir16(dir);
  const pivot = profile.pivots.find(p => p.dirIndex === normalized);
  return pivot?.position ?? null;
}

/**
 * Resolve the turret muzzle positions for a specific weapon, upgrade level,
 * and direction index.
 *
 * Takes a weaponId, upgradeLevel (0-3), and a dir16 index (0-15).
 * The dir16 index is normalized via normalizeDir16 before lookup.
 *
 * Returns an array of DirectionalMuzzleProfile for the direction
 * (most turrets have a single muzzle01, but some like Twins have two),
 * or null for unsupported weapons/levels (graceful fallback).
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveTurretMuzzlesForDir(
  weaponId: string,
  upgradeLevel: number,
  dir: number,
): DirectionalMuzzleProfile[] | null {
  const profile = resolveDirectionalProfile(weaponId, upgradeLevel);
  if (!profile) return null;
  const normalized = normalizeDir16(dir);
  const muzzles = profile.muzzles[normalized];
  return muzzles ?? null;
}

// ── Basis-aware resolvers (asset-family bound) ─────────────────────

/**
 * Resolve the directional profile for a weapon/level whose `assetBasis`
 * matches the given basis id.
 *
 * This is the binding that prevents the PR #263 detached-turret bug: the
 * renderer must look up pivot data from the SAME asset family it draws the
 * texture from. Passing the texture resolver's basis here guarantees the
 * returned pivot coordinates are valid for the visible sprite geometry.
 *
 * Returns null when no profile matches the weapon, level, AND basis —
 * which the adapter treats as "no real-sprite contract" → procedural fallback.
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveDirectionalProfileForBasis(
  weaponId: string,
  upgradeLevel: number,
  assetBasis: string,
): DirectionalTurretMarkerProfile | null {
  const profile = ALL_DIRECTIONAL_PROFILES.find(
    p =>
      p.weaponId === weaponId &&
      p.upgradeLevels.includes(upgradeLevel) &&
      p.assetBasis === assetBasis,
  );
  return profile ?? null;
}

/**
 * Resolve the turret pivot for a weapon/level/direction, bound to the asset
 * basis of the texture family actually being rendered.
 *
 * Mirrors resolveTurretPivotForDir but only returns pivot data measured
 * against the matching asset basis. Returns null (→ procedural fallback) when
 * no basis-matched profile exists for the weapon/level.
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveTurretPivotForDirByBasis(
  weaponId: string,
  upgradeLevel: number,
  dir: number,
  assetBasis: string,
): DirectionalPoint2D | null {
  const profile = resolveDirectionalProfileForBasis(weaponId, upgradeLevel, assetBasis);
  if (!profile) return null;
  const normalized = normalizeDir16(dir);
  const pivot = profile.pivots.find(p => p.dirIndex === normalized);
  return pivot?.position ?? null;
}
