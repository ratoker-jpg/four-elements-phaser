/**
 * Camera Projection Contract — precise mathematical definition of the
 * fixed isometric/axonometric game view.
 *
 * CAMERA-00: Projection calibration contract.
 *
 * The game camera is fixed. The player can pan and zoom, but cannot rotate.
 * This module defines the projection basis vectors and helper functions
 * so that all rendering, selection, shadows, footprints, and ground VFX
 * use the same mathematically consistent projection.
 *
 * Projection formula:
 *   screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ
 *
 * Ground plane: z = 0
 *   screen = origin + worldX * basisX + worldY * basisY
 *
 * This is a pure TypeScript module — no Phaser dependency.
 */

import { TILE_W, TILE_H } from './worldConfig';

// ─── Basis vectors (derived from tile dimensions) ──────────────────

/**
 * One world/tile step along the X axis projected to screen coordinates.
 *
 * For the 2:1 isometric projection with TILE_W=76, TILE_H=38:
 *   Moving one tile in +X direction moves screen right and down.
 */
export const basisX: { x: number; y: number } = {
  x: TILE_W / 2,   // 38
  y: TILE_H / 2,   // 19
};

/**
 * One world/tile step along the Y axis projected to screen coordinates.
 *
 * For the 2:1 isometric projection:
 *   Moving one tile in +Y direction moves screen left and down.
 */
export const basisY: { x: number; y: number } = {
  x: -TILE_W / 2,  // -38
  y: TILE_H / 2,   // 19
};

/**
 * One vertical height unit projected to screen coordinates.
 *
 * Height goes upward on screen. The exact scale is a calibration value
 * that determines how "tall" objects appear. This value produces a
 * visually appropriate vertical exaggeration for the 2:1 isometric view.
 *
 * basisZ = { x: 0, y: -60 } means 1 unit of height moves 60 pixels
 * straight up on screen. This is calibrated so that objects have visible
 * depth without excessive vertical stretching.
 */
export const basisZ: { x: number; y: number } = {
  x: 0,
  y: -60,
};

// ─── Camera model flags ────────────────────────────────────────────

/** Camera model — describes what the camera can and cannot do. */
export const CAMERA_MODEL = {
  /** Camera angle is fixed — no rotation. */
  fixedCamera: true as const,
  /** Player can pan the view. */
  canPan: true as const,
  /** Player can zoom the view. */
  canZoom: true as const,
  /** Player cannot rotate the camera. */
  canRotate: false as const,
  /** This is NOT a top-down (orthographic from above) view. */
  isTopDown: false as const,
  /** This is NOT a side-view. */
  isSideView: false as const,
} as const;

// ─── Object anchor rule ────────────────────────────────────────────

/**
 * Object anchor rule: ground contact point / bottom-center.
 *
 * All game objects (buildings, units, obstacles) are anchored at their
 * ground contact point — the point where the object meets the terrain
 * in the isometric view. This is the bottom-center of the object's
 * footprint on the ground plane.
 *
 * For isometric rendering:
 * - The anchor point is where the object's base meets the ground diamond.
 * - Buildings use the south vertex of their footprint diamond.
 * - Units use their world position projected onto the ground plane.
 * - Height (basisZ) offsets are applied upward from the anchor.
 */
export const OBJECT_ANCHOR_RULE = 'ground-contact-bottom-center' as const;

// ─── Projection helpers ────────────────────────────────────────────

/**
 * Project a ground-plane point (z=0) to screen coordinates.
 *
 * @param worldX - World/tile X coordinate
 * @param worldY - World/tile Y coordinate
 * @param origin - Optional origin offset { x, y } (defaults to 0,0)
 * @returns Screen-space point { x, y }
 */
export function projectGroundPoint(
  worldX: number,
  worldY: number,
  origin?: { x: number; y: number },
): { x: number; y: number } {
  const ox = origin?.x ?? 0;
  const oy = origin?.y ?? 0;
  return {
    x: ox + worldX * basisX.x + worldY * basisY.x,
    y: oy + worldX * basisX.y + worldY * basisY.y,
  };
}

/**
 * Project a 3D world point to screen coordinates.
 *
 * @param worldX - World/tile X coordinate
 * @param worldY - World/tile Y coordinate
 * @param worldZ - Vertical height (0 = ground plane)
 * @param origin - Optional origin offset { x, y } (defaults to 0,0)
 * @returns Screen-space point { x, y }
 */
export function projectWorldPoint(
  worldX: number,
  worldY: number,
  worldZ: number,
  origin?: { x: number; y: number },
): { x: number; y: number } {
  const ox = origin?.x ?? 0;
  const oy = origin?.y ?? 0;
  return {
    x: ox + worldX * basisX.x + worldY * basisY.x + worldZ * basisZ.x,
    y: oy + worldX * basisX.y + worldY * basisY.y + worldZ * basisZ.y,
  };
}

/**
 * Project a ground-plane circle to a polyline (approximated polygon).
 *
 * A circle on the ground plane becomes a projected ellipse when viewed
 * through the isometric projection. This function generates the polyline
 * vertices of that ellipse.
 *
 * This is the correct way to draw selection rings, range indicators,
 * shadows, footprints, and ground VFX. A naive screen-space circle
 * is wrong because the ground plane is tilted in the isometric view.
 *
 * @param centerX - World X of circle center
 * @param centerY - World Y of circle center
 * @param radius - Circle radius in world/tile units
 * @param segments - Number of polyline segments (default 32)
 * @param origin - Optional origin offset { x, y } (defaults to 0,0)
 * @returns Array of screen-space points forming the projected circle
 */
export function projectGroundCircleToPolyline(
  centerX: number,
  centerY: number,
  radius: number,
  segments: number = 32,
  origin?: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const twoPi = 2 * Math.PI;

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * twoPi;
    const wx = centerX + Math.cos(angle) * radius;
    const wy = centerY + Math.sin(angle) * radius;
    points.push(projectGroundPoint(wx, wy, origin));
  }

  return points;
}

/**
 * Project a ground-plane rectangle/footprint to a parallelogram.
 *
 * Used for building footprints, obstacle bounds, and any rectangular
 * ground-plane marker.
 *
 * @param tx - Tile X of the footprint origin
 * @param ty - Tile Y of the footprint origin
 * @param fpW - Footprint width in tiles
 * @param fpH - Footprint height in tiles
 * @param origin - Optional origin offset { x, y } (defaults to 0,0)
 * @returns Array of 4 screen-space points forming the projected diamond/parallelogram
 */
export function projectGroundRect(
  tx: number,
  ty: number,
  fpW: number,
  fpH: number,
  origin?: { x: number; y: number },
): Array<{ x: number; y: number }> {
  return [
    projectGroundPoint(tx, ty, origin),                // top corner
    projectGroundPoint(tx + fpW, ty, origin),          // right corner
    projectGroundPoint(tx + fpW, ty + fpH, origin),    // bottom corner
    projectGroundPoint(tx, ty + fpH, origin),          // left corner
  ];
}

/**
 * Get the axis-aligned bounding box of a projected ground circle.
 *
 * Useful for culling or layout calculations where the exact polyline
 * isn't needed, just the screen-space extent.
 *
 * @param centerX - World X of circle center
 * @param centerY - World Y of circle center
 * @param radius - Circle radius in world/tile units
 * @param origin - Optional origin offset { x, y } (defaults to 0,0)
 * @returns Bounding box { minX, minY, maxX, maxY } in screen space
 */
export function getGroundEllipseBounds(
  centerX: number,
  centerY: number,
  radius: number,
  origin?: { x: number; y: number },
): { minX: number; minY: number; maxX: number; maxY: number } {
  // A ground-plane circle projected through the isometric basis becomes an
  // ellipse.  Parametrically:
  //   x(t) = cx + r * (basisX.x * cos(t) + basisY.x * sin(t))
  //   y(t) = cy + r * (basisX.y * cos(t) + basisY.y * sin(t))
  //
  // The axis-aligned bounding box half-widths are the maximum absolute
  // values of each parametric coordinate, which for an ellipse of the form
  //   a*cos(t) + b*sin(t)  is  sqrt(a² + b²)  =  hypot(a, b).
  const c = projectGroundPoint(centerX, centerY, origin);
  const halfWidth = radius * Math.hypot(basisX.x, basisY.x);
  const halfHeight = radius * Math.hypot(basisX.y, basisY.y);

  return {
    minX: c.x - halfWidth,
    minY: c.y - halfHeight,
    maxX: c.x + halfWidth,
    maxY: c.y + halfHeight,
  };
}

// ─── Re-export tile constants for convenience ──────────────────────

/** Tile width in pixels — source of truth from worldConfig. */
export const PROJ_TILE_W = TILE_W;

/** Tile height in pixels — source of truth from worldConfig. */
export const PROJ_TILE_H = TILE_H;

// ─── Inverse projection ────────────────────────────────────────────

/**
 * Inverse of projectGroundPoint: convert screen-space position
 * back to world/tile coordinates on the ground plane (z=0).
 *
 * Given: screen = origin + worldX * basisX + worldY * basisY
 * Solve for worldX, worldY using the 2×2 inverse of the basis matrix.
 *
 * @param screenX - Screen-space X
 * @param screenY - Screen-space Y
 * @param origin - Optional origin offset { x, y } (defaults to 0,0)
 * @returns World/tile coordinates { x, y }
 */
export function unprojectScreenToGround(
  screenX: number,
  screenY: number,
  origin?: { x: number; y: number },
): { x: number; y: number } {
  const ox = origin?.x ?? 0;
  const oy = origin?.y ?? 0;
  const dx = screenX - ox;
  const dy = screenY - oy;
  // det = basisX.x * basisY.y - basisX.y * basisY.x
  //     = (TILE_W/2)*(TILE_H/2) - (TILE_H/2)*(-TILE_W/2)
  //     = TILE_W * TILE_H / 2
  const det = basisX.x * basisY.y - basisX.y * basisY.x;
  return {
    x: (dx * basisY.y - dy * basisY.x) / det,
    y: (dy * basisX.x - dx * basisX.y) / det,
  };
}
