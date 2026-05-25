import { describe, it, expect } from 'vitest';
import {
  buildOccupancyMap,
  isPassable,
} from '../state/occupancy';
import { findPath, findPathToAdjacent, type TileCoord } from '../state/pathfinding';
import type { GameState, MapData, EconomyState } from '../state/types';

// ─── Test helpers ──────────────────────────────────────────────────

/** Build a minimal GameState for pathfinding tests. */
function makeTestState(overrides?: {
  mapW?: number;
  mapH?: number;
  hqTx?: number;
  hqTy?: number;
  obstacles?: Array<{ tx: number; ty: number; footprint: number }>;
}): GameState {
  const w = overrides?.mapW ?? 10;
  const h = overrides?.mapH ?? 10;
  const hqTx = overrides?.hqTx ?? 0;
  const hqTy = overrides?.hqTy ?? 0;

  const mapData: MapData = {
    width: w,
    height: h,
    terrain: Array.from({ length: h }, () => Array(w).fill('sand')),
    hq: { tx: hqTx, ty: hqTy, faction: 'cyan' },
    resources: [],
    obstacles: (overrides?.obstacles ?? []).map(o => ({
      tx: o.tx,
      ty: o.ty,
      type: 'mountain-small' as const,
      footprint: o.footprint,
    })),
    decor: [],
    buildings: [],
    builders: [],
    constructionSites: [],
  };

  return {
    mapId: 'test',
    mapName: 'Test',
    mapWidth: w,
    mapHeight: h,
    mapData,
    entities: [],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [],
    resourceNodes: [],
    economy: { raw: 0, matter: 0, elements: { cyan: 0, green: 0, yellow: 0, purple: 0 }, powerGenerated: 0, powerConsumed: 0 } as EconomyState,
    hqPosition: { tx: hqTx + 1, ty: hqTy + 1 },
    nextConstructionId: 0,
  };
}

/** Helper to extract just the tx/ty pairs from a path for easier comparison. */
function pathCoords(path: TileCoord[] | null): Array<{ tx: number; ty: number }> {
  if (!path) throw new Error('Expected path, got null');
  return path.map(p => ({ tx: p.tx, ty: p.ty }));
}

// ─── findPath tests ────────────────────────────────────────────────

describe('findPath — straight path on empty map', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('finds a straight horizontal path', () => {
    const path = findPath(map, 5, 5, 8, 5);
    expect(pathCoords(path)).toEqual([
      { tx: 6, ty: 5 },
      { tx: 7, ty: 5 },
      { tx: 8, ty: 5 },
    ]);
  });

  it('finds a straight vertical path', () => {
    const path = findPath(map, 5, 5, 5, 8);
    expect(pathCoords(path)).toEqual([
      { tx: 5, ty: 6 },
      { tx: 5, ty: 7 },
      { tx: 5, ty: 8 },
    ]);
  });

  it('returns empty array when start equals destination', () => {
    const path = findPath(map, 5, 5, 5, 5);
    expect(path).toEqual([]);
  });
});

describe('findPath — path around obstacle', () => {
  // Place a 1×3 vertical wall at (5,4), (5,5), (5,6) blocking horizontal passage
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    obstacles: [
      { tx: 5, ty: 4, footprint: 1 },
      { tx: 5, ty: 5, footprint: 1 },
      { tx: 5, ty: 6, footprint: 1 },
    ],
  });
  const map = buildOccupancyMap(state);

  it('finds a path that goes around the wall', () => {
    const path = findPath(map, 3, 5, 7, 5);
    expect(path).not.toBeNull();
    // Path should reach destination
    const last = path![path!.length - 1];
    expect(last.tx).toBe(7);
    expect(last.ty).toBe(5);
    // Path should not go through obstacle tiles
    for (const step of path!) {
      expect(isPassable(map, step.tx, step.ty)).toBe(true);
    }
  });

  it('path is longer than a straight line would be', () => {
    const path = findPath(map, 3, 5, 7, 5);
    expect(path!.length).toBeGreaterThan(4); // straight would be 4
  });
});

describe('findPath — unreachable target', () => {
  // Create a map where the target is completely walled off
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    obstacles: [
      // Wall around (8,8)
      { tx: 7, ty: 7, footprint: 1 },
      { tx: 8, ty: 7, footprint: 1 },
      { tx: 9, ty: 7, footprint: 1 },
      { tx: 7, ty: 8, footprint: 1 },
      { tx: 9, ty: 8, footprint: 1 },
      { tx: 7, ty: 9, footprint: 1 },
      { tx: 8, ty: 9, footprint: 1 },
      { tx: 9, ty: 9, footprint: 1 },
    ],
  });
  const map = buildOccupancyMap(state);

  it('returns null when target is completely surrounded', () => {
    const path = findPath(map, 5, 5, 8, 8);
    expect(path).toBeNull();
  });
});

describe('findPath — occupied destination', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('returns null if destination is impassable (inside HQ)', () => {
    // HQ at (0,0) with 3×3 footprint
    const path = findPath(map, 5, 5, 1, 1);
    expect(path).toBeNull();
  });
});

describe('findPath — deterministic result', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('same input always produces the same path', () => {
    const path1 = findPath(map, 3, 3, 7, 7);
    const path2 = findPath(map, 3, 3, 7, 7);
    expect(pathCoords(path1)).toEqual(pathCoords(path2));
  });
});

describe('findPath — no diagonal movement', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('each step changes only one coordinate by exactly 1', () => {
    const path = findPath(map, 2, 2, 8, 8);
    expect(path).not.toBeNull();
    let prevTx = 2;
    let prevTy = 2;
    for (const step of path!) {
      const dx = Math.abs(step.tx - prevTx);
      const dy = Math.abs(step.ty - prevTy);
      // Exactly one axis moves by 1, the other stays the same
      expect(dx + dy).toBe(1);
      prevTx = step.tx;
      prevTy = step.ty;
    }
  });
});

// ─── findPathToAdjacent tests ──────────────────────────────────────

describe('findPathToAdjacent — stops next to target', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('paths to a tile adjacent to target, not onto it', () => {
    // Target at (7,7) is a passable tile, but findPathToAdjacent
    // should stop at an adjacent tile
    const path = findPathToAdjacent(map, 5, 5, 7, 7);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];
    // Last tile should be adjacent to (7,7) but NOT (7,7) itself
    const dist = Math.abs(last.tx - 7) + Math.abs(last.ty - 7);
    expect(dist).toBe(1);
    expect(last.tx === 7 && last.ty === 7).toBe(false);
  });

  it('returns empty array if start is already adjacent', () => {
    const path = findPathToAdjacent(map, 6, 7, 7, 7);
    expect(path).toEqual([]);
  });
});

describe('findPathToAdjacent — impassable target', () => {
  // Place an obstacle at (7,7)
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    obstacles: [{ tx: 7, ty: 7, footprint: 1 }],
  });
  const map = buildOccupancyMap(state);

  it('paths to adjacent tile even when target itself is impassable', () => {
    const path = findPathToAdjacent(map, 5, 5, 7, 7);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];
    const dist = Math.abs(last.tx - 7) + Math.abs(last.ty - 7);
    expect(dist).toBe(1);
    expect(isPassable(map, last.tx, last.ty)).toBe(true);
  });
});

describe('findPathToAdjacent — 2×2 footprint', () => {
  // Place a 2×2 obstacle at (6,6)
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    obstacles: [{ tx: 6, ty: 6, footprint: 2 }],
  });
  const map = buildOccupancyMap(state);

  it('paths to a tile adjacent to the 2×2 footprint border', () => {
    const path = findPathToAdjacent(map, 3, 3, 6, 6, 2, 2);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];

    // Last tile should be adjacent to the 2×2 footprint (6,6)-(7,7)
    // Adjacent tiles: north (6,5),(7,5); south (6,8),(7,8);
    // west (5,6),(5,7); east (8,6),(8,7)
    const adjacentTiles = [
      [6, 5], [7, 5],
      [6, 8], [7, 8],
      [5, 6], [5, 7],
      [8, 6], [8, 7],
    ];
    const isAdjacent = adjacentTiles.some(([x, y]) => last.tx === x && last.ty === y);
    expect(isAdjacent).toBe(true);

    // Should NOT be inside the footprint
    const insideFootprint = last.tx >= 6 && last.tx < 8 && last.ty >= 6 && last.ty < 8;
    expect(insideFootprint).toBe(false);
  });

  it('returns empty array if start is already adjacent to footprint', () => {
    const path = findPathToAdjacent(map, 5, 6, 6, 6, 2, 2);
    expect(path).toEqual([]);
  });
});

describe('findPathToAdjacent — unreachable', () => {
  // Completely wall off a target
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    obstacles: [
      { tx: 6, ty: 6, footprint: 1 },
      { tx: 6, ty: 7, footprint: 1 },
      { tx: 6, ty: 8, footprint: 1 },
      { tx: 7, ty: 6, footprint: 1 },
      { tx: 7, ty: 8, footprint: 1 },
      { tx: 8, ty: 6, footprint: 1 },
      { tx: 8, ty: 7, footprint: 1 },
      { tx: 8, ty: 8, footprint: 1 },
    ],
  });
  const map = buildOccupancyMap(state);

  it('returns null when no adjacent passable tile is reachable', () => {
    // Target at (7,7) is impassable (obstacle), all surrounding tiles are obstacles too
    const path = findPathToAdjacent(map, 3, 3, 7, 7);
    expect(path).toBeNull();
  });
});

describe('findPathToAdjacent — deterministic', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('same input always produces the same result', () => {
    const path1 = findPathToAdjacent(map, 3, 3, 7, 7);
    const path2 = findPathToAdjacent(map, 3, 3, 7, 7);
    expect(pathCoords(path1)).toEqual(pathCoords(path2));
  });
});
