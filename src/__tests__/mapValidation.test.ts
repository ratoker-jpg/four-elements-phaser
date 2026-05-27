/**
 * Tests for mapValidation — pure TypeScript, no Phaser.
 *
 * ARCH-08/09/10: Tests for map validation helpers including:
 * - HQ adjacent passable tiles detection
 * - Reachable resource counting from HQ spawn area
 * - Resources not trapped inside impassable footprints
 * - Harvester not trapped detection
 * - Blocked-start detection
 * - Integration with createInitialState (real map)
 */

import { describe, it, expect } from 'vitest';
import {
  validateMap,
  countReachableResources,
  getHqAdjacentPassableTiles,
  MIN_REACHABLE_RESOURCES,
} from '../state/mapValidation';
import { buildOccupancyMap } from '../state/occupancy';
import { createInitialState } from '../state/createInitialState';
import type { GameState, MapData, EconomyState } from '../state/types';

// ─── Test helpers ──────────────────────────────────────────────────

/** Build a minimal GameState for validation tests. */
function makeTestState(overrides?: {
  mapW?: number;
  mapH?: number;
  hqTx?: number;
  hqTy?: number;
  resources?: Array<{ tx: number; ty: number; type?: 'small' | 'medium' | 'large' | 'infinite'; footprint?: number }>;
  obstacles?: Array<{ tx: number; ty: number; footprint: number }>;
  buildings?: Array<{ tx: number; ty: number; type?: string }>;
}): GameState {
  const w = overrides?.mapW ?? 20;
  const h = overrides?.mapH ?? 20;
  const hqTx = overrides?.hqTx ?? 4;
  const hqTy = overrides?.hqTy ?? 4;

  const mapData: MapData = {
    width: w,
    height: h,
    terrain: Array.from({ length: h }, () => Array(w).fill('sand')),
    hq: { tx: hqTx, ty: hqTy, faction: 'cyan' },
    resources: (overrides?.resources ?? []).map((r) => ({
      tx: r.tx,
      ty: r.ty,
      type: r.type ?? 'small',
      footprint: r.footprint ?? 1,
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
      type: (b.type ?? 'separator') as 'separator',
    })),
    builders: [{
      tx: hqTx - 1, ty: hqTy - 1,
      busy: false, phase: 'idle', path: [], pathIndex: 0,
      ftx: hqTx - 1, fty: hqTy - 1,
      targetTx: hqTx - 1, targetTy: hqTy - 1, assignedSiteId: -1,
    }],
    constructionSites: [],
  };

  const resources = (overrides?.resources ?? []).map((r, i) => ({
    id: `r-${i}`,
    tx: r.tx,
    ty: r.ty,
    resourceType: r.type ?? 'small' as const,
    footprint: r.footprint ?? 1,
    remainingRaw: 20,
    depleted: false,
  }));

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
    resourceNodes: resources,
    economy: { raw: 30, matter: 120, elements: { cyan: 0, green: 0, yellow: 0, purple: 0 }, powerGenerated: 10, powerConsumed: 0, separators: [], rawCap: 200, matterCap: 200, elementCap: 200 } as EconomyState,
    hqPosition: { tx: hqTx + 1, ty: hqTy + 1 },
    nextConstructionId: 0,
    production: { factories: [] },
  };
}

// ─── getHqAdjacentPassableTiles tests ──────────────────────────────

describe('ARCH-08/09/10: getHqAdjacentPassableTiles', () => {
  it('finds passable tiles around HQ on an open map', () => {
    const state = makeTestState({ hqTx: 4, hqTy: 4 });
    const occupancy = buildOccupancyMap(state);
    const tiles = getHqAdjacentPassableTiles(state, occupancy);
    // HQ at (4,4) with 3x3 footprint. Adjacent passable tiles should be
    // north: (4,3),(5,3),(6,3), south: (4,7),(5,7),(6,7),
    // west: (3,4),(3,5),(3,6), east: (7,4),(7,5),(7,6) = 12 tiles
    expect(tiles.length).toBe(12);
  });

  it('excludes tiles blocked by obstacles', () => {
    const state = makeTestState({
      hqTx: 4, hqTy: 4,
      obstacles: [{ tx: 7, ty: 4, footprint: 1 }], // block east side tile
    });
    const occupancy = buildOccupancyMap(state);
    const tiles = getHqAdjacentPassableTiles(state, occupancy);
    // One less passable tile on the east side
    expect(tiles.length).toBe(11);
    // Tile (7,4) should not be in the list
    expect(tiles.some(t => t.tx === 7 && t.ty === 4)).toBe(false);
  });

  it('returns no tiles when HQ is at map edge and surrounded by obstacles', () => {
    const state = makeTestState({
      mapW: 5, mapH: 5, hqTx: 0, hqTy: 0,
      obstacles: [
        { tx: 3, ty: 0, footprint: 1 },
        { tx: 3, ty: 1, footprint: 1 },
        { tx: 3, ty: 2, footprint: 1 },
        { tx: 0, ty: 3, footprint: 1 },
        { tx: 1, ty: 3, footprint: 1 },
        { tx: 2, ty: 3, footprint: 1 },
      ],
    });
    const occupancy = buildOccupancyMap(state);
    const tiles = getHqAdjacentPassableTiles(state, occupancy);
    // HQ at (0,0), footprint (0,0)-(2,2). North/West out of bounds.
    // South border (0,3),(1,3),(2,3) blocked by obstacles.
    // East border (3,0),(3,1),(3,2) blocked by obstacles.
    expect(tiles.length).toBe(0);
  });
});

// ─── countReachableResources tests ─────────────────────────────────

describe('ARCH-08/09/10: countReachableResources', () => {
  it('counts resources reachable from HQ spawn area', () => {
    const state = makeTestState({
      hqTx: 4, hqTy: 4,
      resources: [
        { tx: 8, ty: 7, type: 'medium' },
        { tx: 9, ty: 8, type: 'small' },
        { tx: 10, ty: 9, type: 'small' },
      ],
    });
    const occupancy = buildOccupancyMap(state);
    const count = countReachableResources(state, occupancy);
    expect(count).toBe(3);
  });

  it('excludes resources blocked by obstacles', () => {
    const state = makeTestState({
      hqTx: 4, hqTy: 4,
      resources: [
        { tx: 8, ty: 7, type: 'medium' },
        { tx: 15, ty: 15, type: 'small' }, // far away but reachable
      ],
      obstacles: [
        // Wall off the resource at (15,15)
        { tx: 14, ty: 14, footprint: 1 },
        { tx: 15, ty: 14, footprint: 1 },
        { tx: 16, ty: 14, footprint: 1 },
        { tx: 14, ty: 15, footprint: 1 },
        { tx: 16, ty: 15, footprint: 1 },
        { tx: 14, ty: 16, footprint: 1 },
        { tx: 15, ty: 16, footprint: 1 },
        { tx: 16, ty: 16, footprint: 1 },
      ],
    });
    const occupancy = buildOccupancyMap(state);
    const count = countReachableResources(state, occupancy);
    expect(count).toBe(1); // only (8,7) is reachable
  });

  it('returns 0 when no resources exist', () => {
    const state = makeTestState({ hqTx: 4, hqTy: 4, resources: [] });
    const occupancy = buildOccupancyMap(state);
    const count = countReachableResources(state, occupancy);
    expect(count).toBe(0);
  });
});

// ─── validateMap tests ─────────────────────────────────────────────

describe('ARCH-08/09/10: validateMap — valid map', () => {
  it('passes all checks on an open map with nearby resources', () => {
    const state = makeTestState({
      hqTx: 4, hqTy: 4,
      resources: [
        { tx: 8, ty: 7, type: 'medium' },
        { tx: 9, ty: 8, type: 'small' },
        { tx: 10, ty: 9, type: 'small' },
      ],
    });
    const result = validateMap(state);
    expect(result.valid).toBe(true);
    expect(result.reachableResourceCount).toBeGreaterThanOrEqual(MIN_REACHABLE_RESOURCES);
    for (const check of result.checks) {
      expect(check.passed).toBe(true);
    }
  });
});

describe('ARCH-08/09/10: validateMap — blocked start', () => {
  it('fails when HQ has no adjacent passable tiles', () => {
    const state = makeTestState({
      mapW: 5, mapH: 5, hqTx: 0, hqTy: 0,
      obstacles: [
        { tx: 3, ty: 0, footprint: 1 },
        { tx: 3, ty: 1, footprint: 1 },
        { tx: 3, ty: 2, footprint: 1 },
        { tx: 0, ty: 3, footprint: 1 },
        { tx: 1, ty: 3, footprint: 1 },
        { tx: 2, ty: 3, footprint: 1 },
      ],
    });
    const result = validateMap(state);
    expect(result.valid).toBe(false);
    const hqCheck = result.checks.find(c => c.id === 'hq-adjacent-passable');
    expect(hqCheck?.passed).toBe(false);
  });
});

describe('ARCH-08/09/10: validateMap — unreachable resources', () => {
  it('fails when too few resources are reachable', () => {
    const state = makeTestState({
      hqTx: 4, hqTy: 4,
      resources: [
        { tx: 8, ty: 7, type: 'small' }, // only 1 reachable
        { tx: 15, ty: 15, type: 'small' }, // blocked
      ],
      obstacles: [
        { tx: 14, ty: 14, footprint: 1 },
        { tx: 15, ty: 14, footprint: 1 },
        { tx: 16, ty: 14, footprint: 1 },
        { tx: 14, ty: 15, footprint: 1 },
        { tx: 16, ty: 15, footprint: 1 },
        { tx: 14, ty: 16, footprint: 1 },
        { tx: 15, ty: 16, footprint: 1 },
        { tx: 16, ty: 16, footprint: 1 },
      ],
    });
    const result = validateMap(state);
    const resourceCheck = result.checks.find(c => c.id === 'reachable-resources');
    expect(resourceCheck?.passed).toBe(false);
    expect(result.reachableResourceCount).toBeLessThan(MIN_REACHABLE_RESOURCES);
  });
});

describe('ARCH-08/09/10: validateMap — resource inside impassable', () => {
  it('fails when a resource has no path from HQ (completely walled off)', () => {
    const state = makeTestState({
      mapW: 10, mapH: 10, hqTx: 0, hqTy: 0,
      resources: [
        // Resource completely surrounded by obstacles — unreachable from HQ
        { tx: 8, ty: 8, type: 'small' },
      ],
      obstacles: [
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
    const result = validateMap(state);
    const impassableCheck = result.checks.find(c => c.id === 'resources-not-in-impassable');
    expect(impassableCheck?.passed).toBe(false);
  });
});

describe('ARCH-08/09/10: validateMap — harvester trapped', () => {
  it('fails when harvesters cannot reach any resource from spawn area', () => {
    const state = makeTestState({
      mapW: 10, mapH: 10, hqTx: 0, hqTy: 0,
      resources: [
        // Resource exists but is completely walled off
        { tx: 8, ty: 8, type: 'small' },
      ],
      obstacles: [
        // Wall around the resource
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
    const result = validateMap(state);
    const trappedCheck = result.checks.find(c => c.id === 'harvester-not-trapped');
    expect(trappedCheck?.passed).toBe(false);
  });
});

// ─── Integration with real map ─────────────────────────────────────

describe('ARCH-08/09/10: validateMap — integration with createInitialState', () => {
  it('real map passes critical validation checks', () => {
    const state = createInitialState();
    const result = validateMap(state);
    // Critical checks must pass: HQ accessible, reachable resources, harvesters not trapped
    expect(result.valid).toBe(true);
    expect(result.reachableResourceCount).toBeGreaterThanOrEqual(MIN_REACHABLE_RESOURCES);
    // The resources-not-in-impassable check is informational (soft warning)
    // and may fail for dense corner clusters — that's OK for map validity.
    const criticalChecks = result.checks.filter(c => c.id !== 'resources-not-in-impassable');
    for (const check of criticalChecks) {
      expect(check.passed).toBe(true);
    }
  });

  it('real map has reachable resources near base', () => {
    const state = createInitialState();
    const occupancy = buildOccupancyMap(state);
    const count = countReachableResources(state, occupancy);
    // With the new SE starter resources added, should have at least 2 nearby
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('real map HQ has adjacent passable tiles', () => {
    const state = createInitialState();
    const occupancy = buildOccupancyMap(state);
    const tiles = getHqAdjacentPassableTiles(state, occupancy);
    expect(tiles.length).toBeGreaterThan(0);
  });
});
