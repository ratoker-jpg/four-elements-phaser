import { describe, it, expect } from 'vitest';
import {
  buildOccupancyMap,
  isInBounds,
  getFlags,
  isPassable,
  isBuildable,
} from '../state/occupancy';
import { createInitialState } from '../state/createInitialState';
import type { GameState, MapData, EconomyState } from '../state/types';
import { createInitialVisionState } from '../state/visibility';
// ─── Test helpers ──────────────────────────────────────────────────

/** Build a minimal GameState with configurable features for targeted tests. */
function makeTestState(overrides?: {
  mapW?: number;
  mapH?: number;
  hqTx?: number;
  hqTy?: number;
  resources?: Array<{ tx: number; ty: number; footprint: number; depleted?: boolean }>;
  obstacles?: Array<{ tx: number; ty: number; footprint: number }>;
  buildings?: Array<{ tx: number; ty: number }>;
  harvesters?: Array<{ ftx: number; fty: number }>;
  builders?: Array<{ ftx: number; fty: number }>;
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
    resources: (overrides?.resources ?? []).map((r) => ({
      tx: r.tx,
      ty: r.ty,
      type: 'small' as const,
      footprint: r.footprint,
    })),
    obstacles: (overrides?.obstacles ?? []).map(o => ({
      tx: o.tx,
      ty: o.ty,
      type: 'mountain-small' as const,
      footprint: o.footprint,
    })),
    decor: [],
    buildings: (overrides?.buildings ?? []).map(b => ({
      tx: b.tx,
      ty: b.ty,
      type: 'separator' as const,
    })),
    builders: (overrides?.builders ?? []).map((b, i) => ({
      id: `builder-${i}`,
      tx: Math.round(b.ftx),
      ty: Math.round(b.fty),
      busy: false,
      phase: 'idle' as const,
      path: [],
      pathIndex: 0,
      ftx: b.ftx,
      fty: b.fty,
      targetTx: Math.round(b.ftx),
      targetTy: Math.round(b.fty),
      assignedSiteId: -1,
    })),
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
    combatUnits: [],
    harvesters: (overrides?.harvesters ?? []).map((h, i) => ({
      id: `h-${i}`,
      ftx: h.ftx,
      fty: h.fty,
      faction: 'cyan' as const,
      phase: 'idle' as const,
      targetResourceId: null,
      cargoRaw: 0,
      cargoCapacity: 20,
      gatherTimer: 0,
      unloadTimer: 0,
      speedTilesPerSecond: 2.5,
    })),
    resourceNodes: (overrides?.resources ?? []).map((r, i) => ({
      id: `r-${i}`,
      tx: r.tx,
      ty: r.ty,
      resourceType: 'small' as const,
      footprint: r.footprint,
      remainingRaw: r.depleted ? 0 : 20,
      depleted: r.depleted ?? false,
    })),
    economy: { raw: 0, matter: 500, elements: { cyan: 0, green: 0, yellow: 0, purple: 0 }, powerGenerated: 0, powerConsumed: 0, separators: [], rawCap: 200, matterCap: 200, elementCap: 200 } as EconomyState,
    hqPosition: { tx: hqTx + 1, ty: hqTy + 1 },
    nextConstructionId: 0,
    production: { factories: [] },
    vision: createInitialVisionState(48, 48),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('buildOccupancyMap', () => {
  it('returns a map with correct dimensions', () => {
    const state = makeTestState({ mapW: 12, mapH: 8 });
    const map = buildOccupancyMap(state);
    expect(map.width).toBe(12);
    expect(map.height).toBe(8);
  });
});

describe('isInBounds', () => {
  const state = makeTestState({ mapW: 10, mapH: 10 });
  const map = buildOccupancyMap(state);

  it('accepts tiles inside the map', () => {
    expect(isInBounds(map, 0, 0)).toBe(true);
    expect(isInBounds(map, 9, 9)).toBe(true);
    expect(isInBounds(map, 5, 5)).toBe(true);
  });

  it('rejects tiles outside the map', () => {
    expect(isInBounds(map, -1, 0)).toBe(false);
    expect(isInBounds(map, 0, -1)).toBe(false);
    expect(isInBounds(map, 10, 0)).toBe(false);
    expect(isInBounds(map, 0, 10)).toBe(false);
    expect(isInBounds(map, -1, -1)).toBe(false);
  });
});

describe('isPassable — empty map tiles', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('tiles outside the HQ footprint are passable', () => {
    // Tile (5,5) is far from HQ at (0,0)
    expect(isPassable(map, 5, 5)).toBe(true);
    expect(isPassable(map, 9, 9)).toBe(true);
  });

  it('out-of-bounds tiles are not passable', () => {
    expect(isPassable(map, -1, 0)).toBe(false);
    expect(isPassable(map, 10, 0)).toBe(false);
    expect(isPassable(map, 0, 10)).toBe(false);
  });
});

describe('HQ footprint', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 2, hqTy: 2 });
  const map = buildOccupancyMap(state);

  it('HQ tiles are impassable', () => {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isPassable(map, 2 + dx, 2 + dy)).toBe(false);
      }
    }
  });

  it('HQ tiles are unbuildable', () => {
    expect(isBuildable(map, 2, 2, 1, 1)).toBe(false);
    expect(isBuildable(map, 3, 3, 1, 1)).toBe(false);
  });

  it('tile just outside HQ is passable', () => {
    expect(isPassable(map, 1, 2)).toBe(true);
    expect(isPassable(map, 5, 2)).toBe(true);
  });
});

describe('Resource footprint', () => {
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    resources: [{ tx: 5, ty: 5, footprint: 1 }],
  });
  const map = buildOccupancyMap(state);

  it('resource tile has "resource" and "unbuildable" flags', () => {
    const flags = getFlags(map, 5, 5);
    expect(flags.has('resource')).toBe(true);
    expect(flags.has('unbuildable')).toBe(true);
  });

  it('resource tile is impassable for movement (ARCH-05X: harvesters approach from adjacent)', () => {
    expect(isPassable(map, 5, 5)).toBe(false);
  });

  it('resource tile is not buildable', () => {
    expect(isBuildable(map, 5, 5, 1, 1)).toBe(false);
  });
});

describe('Obstacle footprint', () => {
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    obstacles: [{ tx: 7, ty: 7, footprint: 2 }],
  });
  const map = buildOccupancyMap(state);

  it('obstacle tiles are impassable', () => {
    expect(isPassable(map, 7, 7)).toBe(false);
    expect(isPassable(map, 7, 8)).toBe(false);
    expect(isPassable(map, 8, 7)).toBe(false);
    expect(isPassable(map, 8, 8)).toBe(false);
  });

  it('obstacle tiles are unbuildable', () => {
    expect(isBuildable(map, 7, 7, 1, 1)).toBe(false);
  });
});

describe('Building footprint', () => {
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    buildings: [{ tx: 6, ty: 6 }],
  });
  const map = buildOccupancyMap(state);

  it('separator 2x2 footprint tiles are impassable', () => {
    // separator has 2x2 footprint per BUILDING_CONFIG
    expect(isPassable(map, 6, 6)).toBe(false);
    expect(isPassable(map, 6, 7)).toBe(false);
    expect(isPassable(map, 7, 6)).toBe(false);
    expect(isPassable(map, 7, 7)).toBe(false);
  });

  it('separator 2x2 footprint tiles are unbuildable', () => {
    expect(isBuildable(map, 6, 6, 1, 1)).toBe(false);
    expect(isBuildable(map, 7, 7, 1, 1)).toBe(false);
  });

  it('tile just outside separator footprint is passable', () => {
    expect(isPassable(map, 5, 6)).toBe(true);
    expect(isPassable(map, 8, 7)).toBe(true);
  });
});

describe('isBuildable', () => {
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    resources: [{ tx: 5, ty: 5, footprint: 1 }],
  });
  const map = buildOccupancyMap(state);

  it('rejects a footprint overlapping an unbuildable tile', () => {
    // 2×2 at (4,4) overlaps resource at (5,5)
    expect(isBuildable(map, 4, 4, 2, 2)).toBe(false);
  });

  it('accepts a fully empty footprint', () => {
    // 2×2 at (7,7) — far from HQ and resources
    expect(isBuildable(map, 7, 7, 2, 2)).toBe(true);
  });

  it('rejects a footprint going out of bounds', () => {
    expect(isBuildable(map, 9, 9, 2, 2)).toBe(false);
  });

  it('accepts a 1×1 on a clean tile', () => {
    expect(isBuildable(map, 8, 8, 1, 1)).toBe(true);
  });
});

describe('Soft-occupied', () => {
  const state = makeTestState({
    mapW: 10,
    mapH: 10,
    hqTx: 0,
    hqTy: 0,
    harvesters: [{ ftx: 5, fty: 5 }],
  });
  const map = buildOccupancyMap(state);

  it('harvester tile has "soft-occupied" flag', () => {
    const flags = getFlags(map, 5, 5);
    expect(flags.has('soft-occupied')).toBe(true);
  });

  it('soft-occupied tile is still passable', () => {
    expect(isPassable(map, 5, 5)).toBe(true);
  });

  it('soft-occupied tile is still buildable', () => {
    expect(isBuildable(map, 5, 5, 1, 1)).toBe(true);
  });
});

describe('getFlags', () => {
  const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
  const map = buildOccupancyMap(state);

  it('returns empty set for a clean tile', () => {
    const flags = getFlags(map, 9, 9);
    expect(flags.size).toBe(0);
  });

  it('returns empty set for out-of-bounds', () => {
    const flags = getFlags(map, -1, -1);
    expect(flags.size).toBe(0);
  });
});

describe('integration — createInitialState', () => {
  it('HQ makes a 3×3 area impassable', () => {
    const state = createInitialState();
    const map = buildOccupancyMap(state);

    // VISUAL-05A-PR4: HQ is now at (4, 41) for customMap1 (48×48)
    const hqTx = state.mapData.hq.tx;
    const hqTy = state.mapData.hq.ty;

    // HQ footprint: (hqTx, hqTy) to (hqTx+2, hqTy+2)
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isPassable(map, hqTx + dx, hqTy + dy)).toBe(false);
      }
    }

    // Just outside HQ should be passable
    expect(isPassable(map, hqTx + 3, hqTy)).toBe(true);
    expect(isPassable(map, hqTx, hqTy + 3)).toBe(true);
  });

  it('infinite resource at (23,22) with footprint 3 is unbuildable', () => {
    const state = createInitialState();
    const map = buildOccupancyMap(state);

    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isBuildable(map, 23 + dx, 22 + dy, 1, 1)).toBe(false);
      }
    }
  });
});

describe('Builder soft-occupied (ARCH-13F1)', () => {
  it('builder at integer ftx/fty marks that tile as soft-occupied', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      builders: [{ ftx: 7, fty: 7 }],
    });
    const map = buildOccupancyMap(state);
    const flags = getFlags(map, 7, 7);
    expect(flags.has('soft-occupied')).toBe(true);
  });

  it('builder at fractional ftx/fty uses Math.round for tile position', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      builders: [{ ftx: 5.6, fty: 5.4 }],
    });
    const map = buildOccupancyMap(state);
    // Math.round(5.6) = 6, Math.round(5.4) = 5
    const flagsAt6x5 = getFlags(map, 6, 5);
    expect(flagsAt6x5.has('soft-occupied')).toBe(true);

    // The non-rounded tile should NOT be soft-occupied
    const flagsAt5x5 = getFlags(map, 5, 5);
    expect(flagsAt5x5.has('soft-occupied')).toBe(false);
  });

  it('soft-occupied builder tile is still passable and buildable', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      builders: [{ ftx: 8, fty: 8 }],
    });
    const map = buildOccupancyMap(state);
    expect(isPassable(map, 8, 8)).toBe(true);
    expect(isBuildable(map, 8, 8, 1, 1)).toBe(true);
  });
});

// ─── RESOURCE-01: Depleted resource occupancy ───────────────────────

describe('RESOURCE-01: depleted resource occupancy', () => {
  it('depleted resource tile is passable for movement', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      resources: [{ tx: 5, ty: 5, footprint: 1, depleted: true }],
    });
    const map = buildOccupancyMap(state);

    // Depleted resource tile should be passable — no ghost occupancy
    expect(isPassable(map, 5, 5)).toBe(true);
  });

  it('depleted resource tile is buildable', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      resources: [{ tx: 5, ty: 5, footprint: 1, depleted: true }],
    });
    const map = buildOccupancyMap(state);

    // Depleted resource tile should be buildable
    expect(isBuildable(map, 5, 5, 1, 1)).toBe(true);
  });

  it('depleted resource tile still has "resource" informational flag', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      resources: [{ tx: 5, ty: 5, footprint: 1, depleted: true }],
    });
    const map = buildOccupancyMap(state);

    // Depleted resource still carries 'resource' flag (informational)
    const flags = getFlags(map, 5, 5);
    expect(flags.has('resource')).toBe(true);
    // But NOT impassable or unbuildable
    expect(flags.has('impassable')).toBe(false);
    expect(flags.has('unbuildable')).toBe(false);
  });

  it('non-depleted resource tile remains impassable and unbuildable', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      resources: [{ tx: 5, ty: 5, footprint: 1, depleted: false }],
    });
    const map = buildOccupancyMap(state);

    // Non-depleted resource should still be impassable and unbuildable
    expect(isPassable(map, 5, 5)).toBe(false);
    expect(isBuildable(map, 5, 5, 1, 1)).toBe(false);
    const flags = getFlags(map, 5, 5);
    expect(flags.has('resource')).toBe(true);
    expect(flags.has('impassable')).toBe(true);
    expect(flags.has('unbuildable')).toBe(true);
  });

  it('depleted multi-tile resource (footprint 3) is fully passable', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      resources: [{ tx: 5, ty: 5, footprint: 3, depleted: true }],
    });
    const map = buildOccupancyMap(state);

    // All tiles of the depleted 3x3 resource footprint should be passable
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isPassable(map, 5 + dx, 5 + dy)).toBe(true);
        expect(isBuildable(map, 5 + dx, 5 + dy, 1, 1)).toBe(true);
      }
    }

    // All tiles should still carry the 'resource' flag
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(getFlags(map, 5 + dx, 5 + dy).has('resource')).toBe(true);
      }
    }
  });

  it('mixed: some resources depleted, some not', () => {
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      resources: [
        { tx: 5, ty: 5, footprint: 1, depleted: true },
        { tx: 7, ty: 7, footprint: 1, depleted: false },
      ],
    });
    const map = buildOccupancyMap(state);

    // Depleted resource at (5,5) is passable
    expect(isPassable(map, 5, 5)).toBe(true);
    expect(isBuildable(map, 5, 5, 1, 1)).toBe(true);

    // Non-depleted resource at (7,7) is still impassable
    expect(isPassable(map, 7, 7)).toBe(false);
    expect(isBuildable(map, 7, 7, 1, 1)).toBe(false);
  });

  it('depleting a resource at runtime frees the tile for pathfinding', () => {
    // Start with a non-depleted resource
    const state = makeTestState({
      mapW: 10,
      mapH: 10,
      hqTx: 0,
      hqTy: 0,
      resources: [{ tx: 5, ty: 5, footprint: 1, depleted: false }],
    });

    // Initially impassable
    const mapBefore = buildOccupancyMap(state);
    expect(isPassable(mapBefore, 5, 5)).toBe(false);

    // Deplete the resource at runtime
    state.resourceNodes[0].depleted = true;
    state.resourceNodes[0].remainingRaw = 0;

    // After depletion, tile becomes passable
    const mapAfter = buildOccupancyMap(state);
    expect(isPassable(mapAfter, 5, 5)).toBe(true);
  });
});
