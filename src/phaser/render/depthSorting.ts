/**
 * Isometric depth sorting — pure TypeScript, no Phaser.
 *
 * CORE-STEP-06H+: Correct isometric depth sorting for all renderable
 * objects (units + buildings).
 *
 * Rules:
 * - Sort by ground-plane Y (projected bottom point) ascending
 * - Break ties by X ascending
 * - Buildings use footprint/front-bottom edge, not sprite center
 * - Large buildings must sort correctly
 * - Units behind buildings render behind them
 * - Units in front of buildings render above them
 *
 * Collision, depth sorting, and occlusion remain separate systems.
 *
 * CAMERA_PROJECTION_CONTRACT compliance:
 * - Ground-space depth is computed from projected ground-plane positions
 * - No screen-space circles for ground-plane concepts
 * - No top-down assumptions
 */

import { tileToScreen } from './isometric';

// ─── Public types ──────────────────────────────────────────────────

/** A renderable object that can participate in depth sorting. */
export interface DepthSortable {
  /** Unique identifier for this renderable. */
  id: string;
  /** Type of renderable for depth calculation. */
  type: 'unit' | 'building' | 'construction-site' | 'resource';
  /** Tile X position (anchor point). */
  tx: number;
  /** Tile Y position (anchor point). */
  ty: number;
  /** Footprint width in tiles (for buildings). Default 1. */
  footprintW?: number;
  /** Footprint height in tiles (for buildings). Default 1. */
  footprintH?: number;
  /** Map origin offset X for screen coordinate computation. */
  offsetX: number;
  /** Map origin offset Y for screen coordinate computation. */
  offsetY: number;
}

/** Computed depth key for sorting. */
export interface DepthKey {
  /** Primary sort key: ground-plane Y of the front-bottom edge. */
  depthY: number;
  /** Secondary sort key: ground-plane X for tie-breaking. */
  depthX: number;
  /** The original renderable. */
  sortable: DepthSortable;
}

// ─── Depth key computation ─────────────────────────────────────────

/**
 * Compute the depth key for a renderable object.
 *
 * For units: depth is based on their tile position ground contact point.
 * For buildings: depth is based on the front-bottom edge of their footprint.
 *   The front-bottom edge is the SOUTH edge of the footprint in isometric,
 *   which is the row with the highest (tx + ty) value.
 *
 * For large buildings (footprintW > 1 or footprintH > 1), the depth
 * is computed from the front-bottom edge, not the sprite center.
 */
export function computeDepthKey(sortable: DepthSortable): DepthKey {
  const fpW = sortable.footprintW ?? 1;
  const fpH = sortable.footprintH ?? 1;

  // For buildings with footprints > 1x1, the front-bottom edge
  // is the south-most row of the footprint.
  // In isometric, "south" = higher (tx + ty) values.
  // The front-bottom tile is at (tx + fpW - 1, ty + fpH - 1).
  const frontTileTx = sortable.tx + fpW - 1;
  const frontTileTy = sortable.ty + fpH - 1;

  // Compute screen position of the front-bottom tile center
  const screenPos = tileToScreen(frontTileTx, frontTileTy);
  const depthY = screenPos.y + sortable.offsetY;
  const depthX = screenPos.x + sortable.offsetX;

  return { depthY, depthX, sortable };
}

/**
 * Sort an array of depth sortables by their computed depth keys.
 *
 * Primary sort: ascending depthY (front-bottom edge Y in screen space).
 * Secondary sort: ascending depthX (for tie-breaking).
 *
 * Objects with lower depthY are drawn first (behind).
 * Objects with higher depthY are drawn later (in front).
 */
export function sortByDepth(sortables: DepthSortable[]): DepthKey[] {
  const keys = sortables.map(computeDepthKey);
  keys.sort((a, b) => {
    if (a.depthY !== b.depthY) return a.depthY - b.depthY;
    return a.depthX - b.depthX;
  });
  return keys;
}

/**
 * Get the sort order (depth index) for each renderable by ID.
 * Returns a Map from renderable ID to its sort order (0 = drawn first/behind).
 */
export function getDepthOrderMap(sortables: DepthSortable[]): Map<string, number> {
  const keys = sortByDepth(sortables);
  const orderMap = new Map<string, number>();
  for (let i = 0; i < keys.length; i++) {
    orderMap.set(keys[i].sortable.id, i);
  }
  return orderMap;
}

/**
 * Check if object A should be rendered behind object B.
 * Returns true if A is behind B (A has lower depthY, or same depthY but lower depthX).
 */
export function isBehind(a: DepthSortable, b: DepthSortable): boolean {
  const keyA = computeDepthKey(a);
  const keyB = computeDepthKey(b);
  if (keyA.depthY !== keyB.depthY) return keyA.depthY < keyB.depthY;
  return keyA.depthX < keyB.depthX;
}

/**
 * Compute a single numeric depth value for a renderable, suitable for Phaser's setDepth().
 *
 * Uses the projected ground-plane Y of the front-bottom edge, with X as a
 * tiebreaker scaled to sub-pixel resolution. This produces a total order
 * consistent with sortByDepth.
 *
 * @param sortable - The renderable to compute depth for
 * @param baseDepth - Base depth value to add (default 100, matches existing conventions)
 * @returns A numeric depth value for setDepth()
 */
export function computeDepthValue(sortable: DepthSortable, baseDepth: number = 100): number {
  const key = computeDepthKey(sortable);
  // X tiebreaker: scale to 0.01 sub-pixel so it doesn't overwhelm Y but still breaks ties
  return baseDepth + key.depthY + key.depthX * 0.01;
}
