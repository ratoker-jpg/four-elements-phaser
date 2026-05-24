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
