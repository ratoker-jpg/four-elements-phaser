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
  /** Per-direction pivot data (16 entries for dir16). */
  pivots: DirectionalPivotProfile[];
  /** Per-direction muzzle data (16 entries for dir16, each with one or more muzzles). */
  muzzles: DirectionalMuzzleProfile[][];
}

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

// ── TURRET_MUZZLE_PROFILE (ARENA-VISUAL-COMBAT-FIX-01 fixup-6) ───────

/**
 * Per-turret muzzle offset profile, in screen pixels relative to the turret
 * PIVOT, expressed in a turret-local frame (forward = the screen direction
 * the turret currently faces; lateral = 90° clockwise from forward).
 *
 * WHY THIS EXISTS (and is not "guessing"):
 *   - Only Smoky has real exported per-direction muzzle metadata
 *     (SMOKY_*_DIRECTIONAL_PROFILE, projected from 3DS). Every other turret
 *     the Arena shows has NO exported muzzle marker yet.
 *   - fixup-1..5 computed the muzzle as `pivot + cos/sin(turretAngle)*len`.
 *     That is wrong twice over: (a) `turretAngle` is grid-space while the
 *     turret rests (root cause D), so the muzzle pointed the wrong way at
 *     rest; (b) it ignored that real barrels sit slightly off the pivot
 *     centre-line (lateral) and above the ground plane (vertical).
 *   - This table replaces that with an explicit, documented per-turret
 *     forward/lateral/vertical offset, applied along the SCREEN direction of
 *     the resolved `turretDir16` (via dir16ToScreenAngle), so the muzzle is
 *     correct at rest AND while aiming.
 *
 * TEMPORARY: these are approximate, hand-set per visible turret. They are a
 * stand-in until real per-direction muzzle markers are exported for every
 * turret (like Smoky's). When that data exists, resolveTurretMuzzlesForDir()
 * takes priority and this profile is only the fallback.
 *
 * Coordinate convention (screen pixels, turret-local):
 *   - muzzleForwardPx : distance pivot→muzzle along the barrel (always > 0).
 *   - muzzleLateralPx : sideways offset, +right of the forward direction.
 *   - muzzleVerticalPx: screen-Y correction (− = up) for barrel height above
 *                       the ground/pivot plane. Small; kept conservative.
 */
export interface TurretMuzzleProfile {
  muzzleForwardPx: number;
  muzzleLateralPx: number;
  muzzleVerticalPx: number;
  note: string;
}

/** Safe fallback muzzle profile for turrets without an explicit entry. */
export const DEFAULT_TURRET_MUZZLE_PROFILE: TurretMuzzleProfile = {
  muzzleForwardPx: 24,
  muzzleLateralPx: 0,
  muzzleVerticalPx: 0,
  note: 'default fallback — centred forward barrel, no lateral/vertical',
};

/**
 * Approximate muzzle profiles for the currently visible Arena turrets.
 * Keyed by modular turret id (see WEAPON_TO_TURRET_MAP). Forward lengths
 * mirror the previously-used MODULAR_BARREL_LENGTH_PX so we do not regress
 * barrel reach; lateral/vertical stay 0 unless a turret visibly needs it.
 */
export const TURRET_MUZZLE_PROFILE: Record<string, TurretMuzzleProfile> = {
  smoky:    { muzzleForwardPx: 28, muzzleLateralPx: 0, muzzleVerticalPx: -2, note: 'fallback only — Smoky has real per-dir data' },
  thunder:  { muzzleForwardPx: 32, muzzleLateralPx: 0, muzzleVerticalPx: -2, note: 'approx; single long barrel' },
  railgun:  { muzzleForwardPx: 42, muzzleLateralPx: 0, muzzleVerticalPx: -2, note: 'approx; longest barrel' },
  firebird: { muzzleForwardPx: 18, muzzleLateralPx: 0, muzzleVerticalPx: -1, note: 'approx; short flame nozzle' },
  freeze:   { muzzleForwardPx: 18, muzzleLateralPx: 0, muzzleVerticalPx: -1, note: 'approx; short nozzle' },
  isida:    { muzzleForwardPx: 22, muzzleLateralPx: 0, muzzleVerticalPx: -1, note: 'approx; emitter' },
  vulcan_b: { muzzleForwardPx: 22, muzzleLateralPx: 0, muzzleVerticalPx: -2, note: 'approx; rotary barrel cluster' },
  twins:    { muzzleForwardPx: 18, muzzleLateralPx: 3, muzzleVerticalPx: -1, note: 'approx; twin barrels, slight right offset' },
  ricochet: { muzzleForwardPx: 28, muzzleLateralPx: 0, muzzleVerticalPx: -2, note: 'approx' },
  hammer:   { muzzleForwardPx: 22, muzzleLateralPx: 0, muzzleVerticalPx: -2, note: 'approx; drum barrel' },
};

/**
 * Resolve the muzzle profile for a turret id, with a safe fallback for
 * turrets without an explicit entry. Never throws.
 */
export function getTurretMuzzleProfile(turretId: string): TurretMuzzleProfile {
  return TURRET_MUZZLE_PROFILE[turretId] ?? DEFAULT_TURRET_MUZZLE_PROFILE;
}

// ── Per-dir16 muzzle screen offsets (ARENA-VISUAL-COMBAT-FIX-01 fixup-7) ──

/**
 * A screen-space (dx, dy) offset from the composition pivot point to the
 * muzzle tip, for one turret direction.
 *
 * This replaces the broken `forwardPx + dir16ToScreenAngle` approach, which
 * assumed the barrel direction in screen space matches the theoretical
 * isometric angle. It does NOT: the isometric projection makes barrels in
 * cardinal PNG directions (E, S, W, N) appear at different screen angles
 * than `dir16ToScreenAngle` predicts, and the forward distance varies
 * significantly per direction.
 *
 * Source: automated measurement of forward-most non-transparent pixel in each
 * cyan-m0 turret PNG, converted from source pixels to screen pixels via
 * displayScale (0.16). The "forward-most" pixel is direction-dependent:
 *   - dir00 (E): rightmost pixel
 *   - dir04 (S): bottommost pixel
 *   - dir08 (W): leftmost pixel
 *   - dir12 (N): topmost pixel
 *   - diagonals: pixel that maximises the forward component
 *
 * These are approximate — they measure the bounding edge, not the exact
 * barrel tip geometry — but they are dramatically more accurate than the
 * flat forwardPx approach, which systematically misplaced the muzzle by
 * 5-15 screen pixels for diagonal directions.
 *
 * TEMPORARY until real per-direction muzzle markers are exported from 3DS
 * for every turret (like Smoky's SMOKY_M01_DIRECTIONAL_PROFILE). When that
 * data exists, resolveTurretMuzzlesForDir() (Priority 1) takes over and
 * this table is only the Priority-2 fallback.
 */
export interface MuzzleDir16Override {
  /** Screen-pixel offset from composition pivot to muzzle tip. */
  dx: number;
  dy: number;
}

/**
 * Per-turret, per-dir16 muzzle screen offsets measured from actual PNG assets.
 *
 * Keyed by turretId → dir16 index → {dx, dy} in screen pixels from pivot.
 * When a turret has an entry here, `computeModularMuzzlePoint` uses these
 * direct offsets instead of the flat forward/lateral/vertical decomposition,
 * eliminating the systematic isometric projection error.
 *
 * Smoky is NOT listed here because it has real 3DS-projected per-direction
 * muzzle data (SMOKY_M01_DIRECTIONAL_PROFILE / SMOKY_M23_DIRECTIONAL_PROFILE)
 * which is consumed via resolveTurretMuzzlesForDir() at Priority 1.
 */
export const TURRET_MUZZLE_DIR16_OVERRIDE: Record<string, Record<number, MuzzleDir16Override>> = {
  thunder: {
     0: { dx: 23, dy: -13 },  1: { dx: 29, dy:  -6 },  2: { dx: 31, dy:  -1 },
     3: { dx:  1, dy:   4 },  4: { dx: 21, dy:   7 },  5: { dx:-10, dy:   0 },
     6: { dx: -9, dy:   2 },  7: { dx:-13, dy:   5 },  8: { dx:-23, dy:   3 },
     9: { dx:-29, dy:  -2 }, 10: { dx:-31, dy:  -6 }, 11: { dx:-29, dy: -11 },
    12: { dx:-22, dy: -15 }, 13: { dx: 11, dy:  -3 }, 14: { dx:  1, dy: -18 },
    15: { dx: 13, dy: -16 },
  },
  railgun: {
     0: { dx: 28, dy: -15 },  1: { dx: 36, dy:  -9 },  2: { dx: 39, dy:  -3 },
     3: { dx:  3, dy:   4 },  4: { dx: 27, dy:   8 },  5: { dx:-10, dy:  -1 },
     6: { dx: -1, dy:  12 },  7: { dx:-16, dy:   9 },  8: { dx:-29, dy:   5 },
     9: { dx:-37, dy:   0 }, 10: { dx:-39, dy:  -5 }, 11: { dx:-36, dy: -11 },
    12: { dx:-27, dy: -16 }, 13: { dx:  8, dy:  -7 }, 14: { dx:  1, dy: -20 },
    15: { dx: 16, dy: -18 },
  },
  firebird: {
     0: { dx: 23, dy: -12 },  1: { dx: 29, dy:  -7 },  2: { dx: 31, dy:  -2 },
     3: { dx:  6, dy:   4 },  4: { dx: 20, dy:   6 },  5: { dx:-11, dy:  -3 },
     6: { dx: -8, dy:   4 },  7: { dx:-13, dy:   6 },  8: { dx:-23, dy:   3 },
     9: { dx:-29, dy:  -1 }, 10: { dx:-31, dy:  -5 }, 11: { dx:-28, dy:  -9 },
    12: { dx:-21, dy: -13 }, 13: { dx:  6, dy:  -7 }, 14: { dx:  1, dy: -16 },
    15: { dx: 13, dy: -15 },
  },
  freeze: {
     0: { dx: 24, dy: -12 },  1: { dx: 29, dy:  -6 },  2: { dx: 30, dy:  -1 },
     3: { dx: 26, dy:   3 },  4: { dx: 19, dy:   6 },  5: { dx: -7, dy:   1 },
     6: { dx: -3, dy:   9 },  7: { dx:-15, dy:   6 },  8: { dx:-24, dy:   3 },
     9: { dx:-30, dy:  -1 }, 10: { dx:-31, dy:  -6 }, 11: { dx:-28, dy: -10 },
    12: { dx:-21, dy: -14 }, 13: { dx:  9, dy:  -5 }, 14: { dx:  3, dy: -17 },
    15: { dx: 15, dy: -15 },
  },
  isida: {
     0: { dx: 16, dy:  -6 },  1: { dx: 19, dy:  -4 },  2: { dx: 20, dy:  -1 },
     3: { dx:  4, dy:   4 },  4: { dx:  1, dy:   4 },  5: { dx: -9, dy:   0 },
     6: { dx: -7, dy:   2 },  7: { dx:-11, dy:   3 },  8: { dx:-16, dy:   2 },
     9: { dx:-18, dy:  -2 }, 10: { dx:-18, dy:  -5 }, 11: { dx:  2, dy:  -9 },
    12: { dx:-11, dy:  -9 }, 13: { dx:  6, dy:  -8 }, 14: { dx:  4, dy: -10 },
    15: { dx: 11, dy:  -8 },
  },
  vulcan_b: {
     0: { dx: 15, dy: -12 },  1: { dx: 18, dy:  -7 },  2: { dx: 19, dy:  -4 },
     3: { dx:  3, dy:   4 },  4: { dx: -1, dy:   4 },  5: { dx: -8, dy:   0 },
     6: { dx: -8, dy:   3 },  7: { dx:-10, dy:  -1 },  8: { dx:-15, dy:  -4 },
     9: { dx:-18, dy:  -6 }, 10: { dx:-19, dy:  -9 }, 11: { dx:-18, dy: -12 },
    12: { dx:-14, dy: -14 }, 13: { dx: 11, dy:  -7 }, 14: { dx:  2, dy: -15 },
    15: { dx: 10, dy:  -4 },
  },
  twins: {
     0: { dx: 23, dy:  -8 },  1: { dx: 25, dy:  -3 },  2: { dx: 24, dy:   1 },
     3: { dx: 19, dy:   4 },  4: { dx: 12, dy:   7 },  5: { dx:-13, dy:  -2 },
     6: { dx: -7, dy:   7 },  7: { dx:-17, dy:   4 },  8: { dx:-23, dy:   1 },
     9: { dx:-25, dy:  -3 }, 10: { dx:-24, dy:  -7 }, 11: { dx:-20, dy: -10 },
    12: { dx:-13, dy: -13 }, 13: { dx: 11, dy:  -5 }, 14: { dx:  7, dy: -14 },
    15: { dx: 17, dy: -10 },
  },
  ricochet: {
     0: { dx: 19, dy: -10 },  1: { dx: 24, dy:  -5 },  2: { dx: 25, dy:  -2 },
     3: { dx: -3, dy:   4 },  4: { dx: 14, dy:   5 },  5: { dx:-10, dy:   1 },
     6: { dx:-10, dy:   1 },  7: { dx:-11, dy:   4 },  8: { dx:-19, dy:   2 },
     9: { dx:-24, dy:  -1 }, 10: { dx:-25, dy:  -5 }, 11: { dx:  0, dy:  -9 },
    12: { dx:-14, dy: -12 }, 13: { dx:  9, dy:  -4 }, 14: { dx:  1, dy: -13 },
    15: { dx: 11, dy: -13 },
  },
  hammer: {
     0: { dx: 18, dy: -10 },  1: { dx: 18, dy:  -1 },  2: { dx: 23, dy:  -2 },
     3: { dx:  4, dy:   5 },  4: { dx: 13, dy:   7 },  5: { dx:-11, dy:  -1 },
     6: { dx: -9, dy:   3 },  7: { dx:-11, dy:   4 },  8: { dx:-18, dy:   1 },
     9: { dx:-22, dy:  -3 }, 10: { dx:-23, dy:  -7 }, 11: { dx:-21, dy: -10 },
    12: { dx:-16, dy: -13 }, 13: { dx:  4, dy:  -9 }, 14: { dx:  1, dy: -15 },
    15: { dx: 11, dy: -12 },
  },
};

/**
 * Resolve the per-dir16 muzzle screen offset for a turret and direction.
 *
 * Returns {dx, dy} in screen pixels from the composition pivot if the
 * turret has measured per-direction data, or null if no override exists
 * (caller falls back to computeModularMuzzlePoint with flat forwardPx).
 *
 * Pure, no side effects, no Phaser imports.
 */
export function getMuzzleDir16Override(
  turretId: string,
  dir16: number,
): MuzzleDir16Override | null {
  const dirMap = TURRET_MUZZLE_DIR16_OVERRIDE[turretId];
  if (!dirMap) return null;
  const normalized = normalizeDir16(dir16);
  return dirMap[normalized] ?? null;
}

// ── Profile registry ───────────────────────────────────────────────

/**
 * All available directional turret marker profiles.
 *
 * Indexed by weaponId for fast lookup. Multiple profiles per weapon
 * are distinguished by upgrade level.
 */
const DIRECTIONAL_PROFILES: ReadonlyArray<DirectionalTurretMarkerProfile> = [
  SMOKY_M01_DIRECTIONAL_PROFILE,
  SMOKY_M23_DIRECTIONAL_PROFILE,
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
