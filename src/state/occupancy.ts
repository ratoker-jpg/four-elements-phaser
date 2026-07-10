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
import { getOccupiedTiles } from './bodyFootprint';

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

  // ── Resources — ARCH-05X: impassable for movement while non-depleted
  //   Harvesters must approach adjacent tiles, not drive onto the resource center.
  //   RESOURCE-01: Depleted resources are no longer impassable or unbuildable.
  //   Build a position-keyed lookup of depleted resource nodes so we can check
  //   depletion state when marking resource footprints.
  const depletedResources = new Set<number>();
  for (const rn of state.resourceNodes) {
    if (rn.depleted) {
      depletedResources.add(key(rn.tx, rn.ty, width));
    }
  }

  for (const r of state.mapData.resources) {
    const isDepleted = depletedResources.has(key(r.tx, r.ty, width));

    if (isDepleted) {
      // RESOURCE-01: Depleted resources keep the 'resource' informational flag
      // but no longer block movement or construction.
      markFootprint(flags, width, r.tx, r.ty, r.footprint, r.footprint, 'resource');
    } else {
      markFootprint(flags, width, r.tx, r.ty, r.footprint, r.footprint,
        'impassable', 'unbuildable', 'resource');
    }
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

  // ── Soft-occupied: canonical production combat units ──────────
  for (const unit of state.combatUnits ?? []) {
    if (unit.runtime?.isDestroyed) continue;
    const tx = Math.round(unit.runtime?.ftx ?? unit.tx);
    const ty = Math.round(unit.runtime?.fty ?? unit.ty);
    for (const tile of getOccupiedTiles(tx, ty, unit.bodyId)) {
      getOrMake(flags, key(tile.tx, tile.ty, width)).add('soft-occupied');
    }
  }

  // ── Soft-occupied: blockout vehicles (CORE-STEP-06H+) ────────────
  if (state.blockoutVehicles) {
    for (const v of state.blockoutVehicles) {
      if (v.isDestroyed) continue;
      const k = key(v.tx, v.ty, width);
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

// ─── Unit-blocker helpers (ARCH-05X hardening) ─────────────────────

/**
 * Add civil unit positions as "impassable" blockers to an existing occupancy map.
 *
 * This mutates the occupancy map in place. Used by movement commands so
 * that units don't path through each other. The excluded unit's own tile
 * is NOT blocked (so the pathfinder can start from its current position).
 *
 * @param state  Game state (to read builder/harvester positions)
 * @param map    Occupancy map to mutate
 * @param excludeType  Unit type to exclude ('builder' | 'harvester')
 * @param excludeId    Unit identifier to exclude (builder id or harvester id)
 */
export function addUnitBlockers(
  state: GameState,
  map: OccupancyMap,
  excludeType?: 'builder' | 'harvester' | 'combat',
  excludeId?: number | string,
): void {
  // Add builders as impassable (except excluded)
  for (const b of state.mapData.builders) {
    if (excludeType === 'builder' && excludeId === b.id) continue;
    const k = key(Math.round(b.ftx), Math.round(b.fty), map.width);
    getOrMake(map.flags, k).add('impassable');
  }

  // Add harvesters as impassable (except excluded)
  for (const h of state.harvesters) {
    if (excludeType === 'harvester' && excludeId === h.id) continue;
    const k = key(Math.round(h.ftx), Math.round(h.fty), map.width);
    getOrMake(map.flags, k).add('impassable');
  }

  for (const unit of state.combatUnits ?? []) {
    if (unit.runtime?.isDestroyed) continue;
    if (excludeType === 'combat' && excludeId === unit.id) continue;
    const tx = Math.round(unit.runtime?.ftx ?? unit.tx);
    const ty = Math.round(unit.runtime?.fty ?? unit.ty);
    for (const tile of getOccupiedTiles(tx, ty, unit.bodyId)) {
      getOrMake(map.flags, key(tile.tx, tile.ty, map.width)).add('impassable');
    }
  }
}

/**
 * Whether a tile is currently occupied by another civil unit.
 *
 * Checks builders and harvesters (rounded tile positions).
 * The excluded unit is not counted.
 *
 * @param state  Game state
 * @param tx     Target tile X
 * @param ty     Target tile Y
 * @param excludeType  Unit type to exclude
 * @param excludeId    Unit identifier to exclude (builder id or harvester id)
 */
export function isTileOccupiedByUnit(
  state: GameState,
  tx: number,
  ty: number,
  excludeType?: 'builder' | 'harvester' | 'combat',
  excludeId?: number | string,
): boolean {
  for (const b of state.mapData.builders) {
    if (excludeType === 'builder' && excludeId === b.id) continue;
    if (Math.round(b.ftx) === tx && Math.round(b.fty) === ty) return true;
  }

  for (const h of state.harvesters) {
    if (excludeType === 'harvester' && excludeId === h.id) continue;
    if (Math.round(h.ftx) === tx && Math.round(h.fty) === ty) return true;
  }

  for (const unit of state.combatUnits ?? []) {
    if (unit.runtime?.isDestroyed) continue;
    if (excludeType === 'combat' && excludeId === unit.id) continue;
    const ux = Math.round(unit.runtime?.ftx ?? unit.tx);
    const uy = Math.round(unit.runtime?.fty ?? unit.ty);
    if (getOccupiedTiles(ux, uy, unit.bodyId).some(tile => tile.tx === tx && tile.ty === ty)) return true;
  }

  return false;
}

// ─── Blockout vehicle blockers (CORE-STEP-06H+) ─────────────────────

/**
 * Add blockout vehicle positions as "impassable" blockers to an existing occupancy map.
 * CORE-STEP-06H+: Combat vehicles occupy tiles and block pathfinding.
 * CORE-STEP-06H+ fixup: Heavy bodies block adjacent tiles based on collisionRadiusTiles.
 *
 * @param vehicles - Array of vehicles with tile positions, body IDs, and destroyed state
 * @param map - Occupancy map to mutate
 * @param excludeVehicleId - Optional vehicle ID to exclude (so it can path from its own tile)
 */
export function addVehicleBlockers(
  vehicles: Array<{ id: string; tx: number; ty: number; bodyId?: string; isDestroyed: boolean }>,
  map: OccupancyMap,
  excludeVehicleId?: string,
): void {
  for (const v of vehicles) {
    if (v.isDestroyed) continue;
    if (excludeVehicleId && v.id === excludeVehicleId) continue;
    // CORE-STEP-06H+ fixup: Use getOccupiedTiles for footprint-class-aware blocking
    const bodyId = (v as any).bodyId as string | undefined;
    const blockedTiles = bodyId
      ? getOccupiedTiles(v.tx, v.ty, bodyId)
      : [{ tx: v.tx, ty: v.ty }]; // fallback for vehicles without bodyId
    for (const { tx, ty } of blockedTiles) {
      const k = key(tx, ty, map.width);
      getOrMake(map.flags, k).add('impassable');
    }
  }
}

/**
 * CORE-STEP-06H+ fixup: Add reserved tiles as "impassable" blockers to an existing occupancy map.
 *
 * Civil units (harvesters, builders) must respect tiles reserved by other units.
 * This prevents two units from trying to enter the same tile simultaneously.
 *
 * @param reservationMap - Tile reservation map to check
 * @param map - Occupancy map to mutate
 * @param excludeUnitId - Optional unit ID whose reservations should NOT block
 */
export function addReservationBlockers(
  reservationMap: import('./tileReservation').TileReservationMap,
  map: OccupancyMap,
  excludeUnitId?: string,
): void {
  for (const r of reservationMap.getAllReservations()) {
    if (excludeUnitId && r.holder.unitId === excludeUnitId) continue;
    const k = key(r.tx, r.ty, map.width);
    getOrMake(map.flags, k).add('impassable');
  }
}
