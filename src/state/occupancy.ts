/**
 * Occupancy / Passability model — pure TypeScript, no Phaser.
 *
 * Derives a tile-level flag map from GameState. The OccupancyMap is
 * recomputed on demand (not stored in GameState) so it always reflects
 * the current state snapshot.
 *
 * ARCH-13C: Phase C of Foundation Stabilization.
 *
 * Tile flags:
 * - "impassable" — blocks movement (HQ, obstacles, buildings, construction)
 * - "unbuildable" — blocks construction placement (HQ, resources, obstacles, buildings)
 * - "resource" — informational: a resource node occupies this tile
 * - "soft-occupied" — a unit stands here; does NOT block pathfinding
 *
 * Key convention: flat numeric key = tx + ty * width  (avoids string allocation).
 */

import type { GameState } from './types';
import { BUILDING_CONFIG } from './construction';

// ─── Public types ──────────────────────────────────────────────────

/** Per-tile classification flags. */
export type TileFlag = 'impassable' | 'unbuildable' | 'resource' | 'soft-occupied';

/** Derived occupancy map — flat flag storage, no Phaser dependency. */
export interface OccupancyMap {
  width: number;
  height: number;
  flags: Map<number, Set<TileFlag>>;
}

// ─── Internal helpers ──────────────────────────────────────────────

/** Shared frozen empty set returned for tiles with no flags. */
const EMPTY_FLAGS: ReadonlySet<TileFlag> = new Set<TileFlag>();

/** Compute flat numeric key for a tile position. */
function key(tx: number, ty: number, width: number): number {
  return tx + ty * width;
}

/** Get or create the flag set for a numeric key. */
function getOrMake(flags: Map<number, Set<TileFlag>>, k: number): Set<TileFlag> {
  let s = flags.get(k);
  if (!s) {
    s = new Set();
    flags.set(k, s);
  }
  return s;
}

/** Mark all tiles in a rectangular footprint with the given flags. */
function markFootprint(
  flags: Map<number, Set<TileFlag>>,
  width: number,
  baseTx: number,
  baseTy: number,
  fpW: number,
  fpH: number,
  ...addFlags: TileFlag[]
): void {
  for (let dy = 0; dy < fpH; dy++) {
    for (let dx = 0; dx < fpW; dx++) {
      const k = key(baseTx + dx, baseTy + dy, width);
      const s = getOrMake(flags, k);
      for (const f of addFlags) s.add(f);
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Build an OccupancyMap from the current GameState.
 *
 * This is a pure derivation — the map is not stored in GameState and
 * should be recomputed whenever a fresh snapshot is needed.
 */
export function buildOccupancyMap(state: GameState): OccupancyMap {
  const width = state.mapWidth;
  const height = state.mapHeight;
  const flags = new Map<number, Set<TileFlag>>();

  // ── HQ — 3×3 footprint ────────────────────────────────────────
  markFootprint(flags, width, state.mapData.hq.tx, state.mapData.hq.ty, 3, 3,
    'impassable', 'unbuildable');

  // ── Resources — ARCH-05X: now impassable for movement
  //   Harvesters must approach adjacent tiles, not drive onto the resource center.
  for (const r of state.mapData.resources) {
    markFootprint(flags, width, r.tx, r.ty, r.footprint, r.footprint,
      'impassable', 'unbuildable', 'resource');
  }

  // ── Obstacles ──────────────────────────────────────────────────
  for (const o of state.mapData.obstacles) {
    markFootprint(flags, width, o.tx, o.ty, o.footprint, o.footprint,
      'impassable', 'unbuildable');
  }

  // ── Buildings — footprint from BUILDING_CONFIG, fallback 1×1 ─
  for (const b of state.mapData.buildings) {
    const config = BUILDING_CONFIG[b.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;
    markFootprint(flags, width, b.tx, b.ty, fpW, fpH,
      'impassable', 'unbuildable');
  }

  // ── Construction sites — footprint from BUILDING_CONFIG, fallback 1×1 ─
  for (const c of state.mapData.constructionSites) {
    const config = BUILDING_CONFIG[c.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;
    markFootprint(flags, width, c.tx, c.ty, fpW, fpH,
      'impassable', 'unbuildable');
  }

  // ── Soft-occupied: builders (rounded tile position) ──────────────
  for (const b of state.mapData.builders) {
    const k = key(Math.round(b.ftx), Math.round(b.fty), width);
    getOrMake(flags, k).add('soft-occupied');
  }

  // ── Soft-occupied: harvesters (rounded tile position) ──────────
  for (const h of state.harvesters) {
    const k = key(Math.round(h.ftx), Math.round(h.fty), width);
    getOrMake(flags, k).add('soft-occupied');
  }

  // ── Soft-occupied: modular combat units ────────────────────────
  for (const e of state.entities) {
    if (e.kind === 'modular-combat') {
      const k = key(e.tx, e.ty, width);
      getOrMake(flags, k).add('soft-occupied');
    }
  }

  return { width, height, flags };
}

/** Whether a tile position is within the map bounds. */
export function isInBounds(map: OccupancyMap, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;
}

/** Get the flag set for a tile (read-only view). Returns empty set for missing tiles. */
export function getFlags(map: OccupancyMap, tx: number, ty: number): ReadonlySet<TileFlag> {
  if (!isInBounds(map, tx, ty)) return EMPTY_FLAGS;
  return map.flags.get(key(tx, ty, map.width)) ?? EMPTY_FLAGS;
}

/**
 * Whether a tile is passable for movement.
 *
 * A tile is passable if it is in bounds and has no "impassable" flag.
 * "soft-occupied" does NOT block movement.
 */
export function isPassable(map: OccupancyMap, tx: number, ty: number): boolean {
  if (!isInBounds(map, tx, ty)) return false;
  const f = map.flags.get(key(tx, ty, map.width));
  return !f?.has('impassable');
}

/**
 * Whether a w×h area starting at (tx,ty) is suitable for building placement.
 *
 * All tiles in the area must be in bounds and have no "unbuildable" flag.
 */
export function isBuildable(map: OccupancyMap, tx: number, ty: number, w: number, h: number): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const cx = tx + dx;
      const cy = ty + dy;
      if (!isInBounds(map, cx, cy)) return false;
      const f = map.flags.get(key(cx, cy, map.width));
      if (f?.has('unbuildable')) return false;
    }
  }
  return true;
}
