/**
 * TURRET-HULL-CONTRACT-PR-C: Pure direction remap module.
 *
 * Extracted from hullTurretVisualProfiles.ts to avoid circular imports:
 * generatedHullAssets.ts cannot import hullTurretVisualProfiles.ts (which
 * already imports constants FROM generatedHullAssets.ts), but it CAN import
 * this pure module which has zero dependency on generatedHullAssets.
 *
 * This module contains only:
 * - The DirCount type
 * - The DirectionRemapProfile interface
 * - The remapVisualDir() pure helper
 * - The WASP_HULL_DIRECTION_REMAP_PROFILE constant
 *
 * No Phaser imports. No generatedHullAssets imports. No side effects.
 */

// ── Direction remap types ────────────────────────────────────────────

/** Number of authored directions in a sprite family. */
export type DirCount = 8 | 16;

/**
 * Declares how an authored PNG family faces relative to the logical
 * screen-space direction system.
 *
 * Formula: `visualDir = (logicalDir + facingOffset) mod dirCount`
 *
 * Wasp hull today == `{ dirCount: 16, facingOffset: 4 }`.
 * Smoky turret today == `{ dirCount: 8, facingOffset: 2 }`.
 * A family authored "correctly" (no rotation offset) == `{ dirCount: N, facingOffset: 0 }`.
 *
 * This replaces the per-hull `WASP_HULL_VISUAL_DIR16_REMAP` table with a
 * single integer per PNG family, and makes the turret's remap independent
 * from the hull's (closing audit root cause RC-1/RC-3).
 */
export interface DirectionRemapProfile {
  /** Number of authored sprite directions (8 or 16). */
  dirCount: DirCount;
  /** Signed rotation offset, applied mod dirCount. */
  facingOffset: number;
}

// ── Pure helper ─────────────────────────────────────────────────────

/**
 * Apply the declared visual direction remap.
 *
 * Formula: `visualDir = (logicalDir + facingOffset) mod dirCount`
 *
 * Deterministic, pure, no side effects. Replaces the per-hull
 * WASP_HULL_VISUAL_DIR16_REMAP table with a single arithmetic operation
 * per PNG family.
 *
 * The double-modulo handles negative facingOffset values correctly.
 */
export function remapVisualDir(
  logicalDir: number,
  profile: DirectionRemapProfile,
): number {
  return ((logicalDir + profile.facingOffset) % profile.dirCount + profile.dirCount) % profile.dirCount;
}

// ── Profile instances ───────────────────────────────────────────────

/**
 * Wasp hull direction remap profile.
 *
 * Equivalent to WASP_HULL_VISUAL_DIR16_REMAP (which maps each logical
 * dir16 to (logical + 4) mod 16).
 *
 * Extracted here so generatedHullAssets.ts can use it without creating
 * a circular import through hullTurretVisualProfiles.ts.
 */
export const WASP_HULL_DIRECTION_REMAP_PROFILE: DirectionRemapProfile = {
  dirCount: 16,
  facingOffset: 4,
};
