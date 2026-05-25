/**
 * BFS pathfinding — pure TypeScript, no Phaser.
 *
 * ARCH-13D: Phase D of Foundation Stabilization.
 *
 * - 4-connectivity (N, E, S, W — deterministic clockwise order)
 * - BFS (not A*) for shortest-path guarantees
 * - Returns path excluding the start tile
 * - findPath returns null if destination is not passable
 * - findPathToAdjacent finds a passable tile adjacent to a target
 *   footprint, not onto the occupied target tile itself
 */

import type { OccupancyMap } from './occupancy';
import { isPassable, isInBounds } from './occupancy';

// ─── Public types ──────────────────────────────────────────────────

/** Tile coordinate used in path results. */
export interface TileCoord {
  tx: number;
  ty: number;
}

// ─── Internal constants ────────────────────────────────────────────

/** 4-connectivity: N → E → S → W (deterministic clockwise order). */
const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },  // N
  { dx: 1, dy: 0 },   // E
  { dx: 0, dy: 1 },   // S
  { dx: -1, dy: 0 },  // W
];

// ─── Internal helpers ──────────────────────────────────────────────

/** Flat numeric key for a tile position. */
function tileKey(tx: number, ty: number, width: number): number {
  return tx + ty * width;
}

/** Decode tx from a flat key. */
function keyTx(k: number, width: number): number {
  return k % width;
}

/** Decode ty from a flat key. */
function keyTy(k: number, width: number): number {
  return Math.floor(k / width);
}

/**
 * Whether (tx,ty) is outside the footprint but shares an edge with it
 * in 4-connectivity (the tile is adjacent to the footprint boundary).
 */
function isAdjacentToFootprint(
  tx: number,
  ty: number,
  targetTx: number,
  targetTy: number,
  fpW: number,
  fpH: number,
): boolean {
  // Inside the footprint → not adjacent
  if (tx >= targetTx && tx < targetTx + fpW && ty >= targetTy && ty < targetTy + fpH) {
    return false;
  }
  // North border
  if (ty === targetTy - 1 && tx >= targetTx && tx < targetTx + fpW) return true;
  // South border
  if (ty === targetTy + fpH && tx >= targetTx && tx < targetTx + fpW) return true;
  // West border
  if (tx === targetTx - 1 && ty >= targetTy && ty < targetTy + fpH) return true;
  // East border
  if (tx === targetTx + fpW && ty >= targetTy && ty < targetTy + fpH) return true;

  return false;
}

/**
 * Reconstruct path from the visited parent map.
 * Walks from destination key back to start key, then reverses.
 * The start tile is NOT included in the result.
 */
function reconstructPath(
  visited: Map<number, number | null>,
  destKey: number,
  startKey: number,
  width: number,
): TileCoord[] {
  const path: TileCoord[] = [];
  let k: number | null = destKey;
  while (k !== null && k !== startKey) {
    path.push({ tx: keyTx(k, width), ty: keyTy(k, width) });
    k = visited.get(k)!;
  }
  path.reverse();
  return path;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Find the shortest path from (fromTx, fromTy) to (toTx, toTy) using BFS.
 *
 * - Returns an array of TileCoord (excluding the start tile) or null if unreachable.
 * - Returns null if the destination is not passable.
 * - Returns [] if start equals destination (already there).
 * - Deterministic: neighbor order is N → E → S → W.
 */
export function findPath(
  map: OccupancyMap,
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number,
): TileCoord[] | null {
  // Destination must be passable
  if (!isPassable(map, toTx, toTy)) return null;
  // Start must be in bounds
  if (!isInBounds(map, fromTx, fromTy)) return null;
  // Already at destination
  if (fromTx === toTx && fromTy === toTy) return [];

  const width = map.width;
  const startKey = tileKey(fromTx, fromTy, width);
  const destKey = tileKey(toTx, toTy, width);

  // parent map: child key → parent key (null for start)
  const visited = new Map<number, number | null>();
  visited.set(startKey, null);

  // BFS queue (flat keys)
  const queue: number[] = [startKey];

  while (queue.length > 0) {
    const ck = queue.shift()!;
    const cx = keyTx(ck, width);
    const cy = keyTy(ck, width);

    for (const { dx, dy } of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isInBounds(map, nx, ny)) continue;

      const nk = tileKey(nx, ny, width);
      if (visited.has(nk)) continue;
      if (!isPassable(map, nx, ny)) continue;

      visited.set(nk, ck);

      if (nk === destKey) {
        return reconstructPath(visited, nk, startKey, width);
      }

      queue.push(nk);
    }
  }

  return null; // unreachable
}

/**
 * Find the shortest path from (fromTx, fromTy) to a passable tile
 * adjacent to the target footprint, using BFS.
 *
 * - Paths to a passable tile NEXT TO the target, not onto it.
 * - footprintW/footprintH default to 1×1.
 * - Returns [] if start is already adjacent to the target.
 * - Returns null if no adjacent passable tile exists or is reachable.
 * - Deterministic: neighbor order is N → E → S → W.
 */
export function findPathToAdjacent(
  map: OccupancyMap,
  fromTx: number,
  fromTy: number,
  targetTx: number,
  targetTy: number,
  footprintW: number = 1,
  footprintH: number = 1,
): TileCoord[] | null {
  // Start must be in bounds
  if (!isInBounds(map, fromTx, fromTy)) return null;

  // If start is already adjacent, empty path
  if (isAdjacentToFootprint(fromTx, fromTy, targetTx, targetTy, footprintW, footprintH)) {
    return [];
  }

  const width = map.width;
  const startKey = tileKey(fromTx, fromTy, width);

  const visited = new Map<number, number | null>();
  visited.set(startKey, null);

  const queue: number[] = [startKey];

  while (queue.length > 0) {
    const ck = queue.shift()!;
    const cx = keyTx(ck, width);
    const cy = keyTy(ck, width);

    for (const { dx, dy } of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isInBounds(map, nx, ny)) continue;

      const nk = tileKey(nx, ny, width);
      if (visited.has(nk)) continue;
      if (!isPassable(map, nx, ny)) continue;

      visited.set(nk, ck);

      if (isAdjacentToFootprint(nx, ny, targetTx, targetTy, footprintW, footprintH)) {
        return reconstructPath(visited, nk, startKey, width);
      }

      queue.push(nk);
    }
  }

  return null; // no reachable adjacent tile
}
