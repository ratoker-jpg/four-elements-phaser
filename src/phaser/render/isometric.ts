/**
 * Isometric coordinate helpers.
 *
 * Convention matches the donor game:
 *   TILE_W = 76, TILE_H = 38
 *   screen.x = (tx - ty) * TILE_W / 2
 *   screen.y = (tx + ty) * TILE_H / 2
 */

import { TILE_W, TILE_H } from '../../config/worldConfig';

export interface IsoPoint {
  x: number;
  y: number;
}

/** Convert tile coordinates to screen (pixel) coordinates. */
export function tileToScreen(tx: number, ty: number): IsoPoint {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2),
  };
}

/** Convert screen coordinates back to tile coordinates (fractional). */
export function screenToTile(sx: number, sy: number): IsoPoint {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const tx = (sx / halfW + sy / halfH) / 2;
  const ty = (sy / halfH - sx / halfW) / 2;
  return { x: tx, y: ty };
}

/**
 * Compute the screen position of the south vertex of a rectangular footprint's
 * isometric diamond.
 *
 * The south vertex is the bottommost point of the isometric diamond formed by
 * a W×H tile footprint starting at (tx, ty). Buildings anchor to this point
 * for south-vertex placement (BUILD-ANCHOR-03).
 *
 * For a 2×2 footprint at (0,0):
 *   - Bottom-right tile center: tileToScreen(1, 1) = (0, 38)
 *   - South vertex: (0, 38 + 19) = (0, 57)
 *
 * This is the visual ground-contact point where the building meets the terrain.
 */
export function footprintSouthVertex(tx: number, ty: number, fpW: number, fpH: number): IsoPoint {
  const brScreen = tileToScreen(tx + fpW - 1, ty + fpH - 1);
  return { x: brScreen.x, y: brScreen.y + TILE_H / 2 };
}

/** Offset so that tile (0,0) is at a positive position in the render buffer. */
export function mapOriginOffset(_mapW: number, mapH: number): IsoPoint {
  // Tile (0, mapH-1) is the leftmost point; tile (mapW-1, 0) is the rightmost.
  // Tile (0,0) is the topmost point.
  // We offset so tile (0, mapH-1) maps to x > 0.
  const leftmost = tileToScreen(0, mapH - 1);
  const padding = 64;
  return {
    x: -leftmost.x + padding,
    y: padding,
  };
}
