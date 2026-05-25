import { describe, it, expect } from 'vitest';
import {
  BUILDING_CONFIG,
  canPlaceBuilding,
  placeConstructionSite,
  updateConstructionSiteProgress,
} from '../state/construction';
import type { GameState, MapData } from '../state/types';

// ─── Test helpers ──────────────────────────────────────────────────

/** Build a minimal GameState for construction tests. */
function makeTestState(overrides?: {
  mapW?: number;
  mapH?: number;
  hqTx?: number;
  hqTy?: number;
  rawMinerals?: number;
  resources?: Array<{ tx: number; ty: number; footprint: number }>;
  obstacles?: Array<{ tx: number; ty: number; footprint: number }>;
  buildings?: Array<{ tx: number; ty: number; type?: string }>;
  constructionSites?: Array<{ tx: number; ty: number; type?: string }>;
  builders?: Array<{ tx: number; ty: number }>;
}): GameState {
  const w = overrides?.mapW ?? 20;
  const h = overrides?.mapH ?? 20;
  const hqTx = overrides?.hqTx ?? 0;
  const hqTy = overrides?.hqTy ?? 0;

  const mapData: MapData = {
    width: w,
    height: h,
    terrain: Array.from({ length: h }, () => Array(w).fill('sand')),
    hq: { tx: hqTx, ty: hqTy, faction: 'cyan' },
    resources: (overrides?.resources ?? []).map(r => ({
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
      type: (b.type ?? 'separator') as 'separator',
    })),
    builders: (overrides?.builders ?? []).map((b) => ({
      tx: b.tx,
      ty: b.ty,
      busy: false,
      phase: 'idle' as const,
      path: [],
      pathIndex: 0,
      ftx: b.tx,
      fty: b.ty,
      targetTx: b.tx,
      targetTy: b.ty,
      assignedSiteId: -1,
    })),
    constructionSites: (overrides?.constructionSites ?? []).map((c, i) => ({
      tx: c.tx,
      ty: c.ty,
      type: (c.type ?? 'separator') as 'separator',
      elapsed: 0,
      duration: 5000,
      progress: 0,
      builderIndex: -1,
      id: i,
      pending: true,
    })),
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
    rawMinerals: overrides?.rawMinerals ?? 500,
    hqPosition: { tx: hqTx + 1, ty: hqTy + 1 },
    nextConstructionId: 0,
  };
}

/**
 * Place a construction site AND set up a builder in 'building' phase
 * for tests that need construction progress to advance.
 *
 * ARCH-13E3: Progress only advances when site.pending === false and
 * the assigned builder is in 'building' phase.
 */
function makeBuildingState(overrides?: {
  mapW?: number;
  mapH?: number;
  hqTx?: number;
  hqTy?: number;
  rawMinerals?: number;
  siteTx?: number;
  siteTy?: number;
}): GameState {
  const siteTx = overrides?.siteTx ?? 10;
  const siteTy = overrides?.siteTy ?? 10;

  const state = makeTestState({
    mapW: overrides?.mapW ?? 20,
    mapH: overrides?.mapH ?? 20,
    hqTx: overrides?.hqTx ?? 0,
    hqTy: overrides?.hqTy ?? 0,
    rawMinerals: overrides?.rawMinerals ?? 500,
    builders: [{ tx: siteTx - 1, ty: siteTy }], // Adjacent to site
  });

  // Place construction site
  placeConstructionSite(state, 'separator', siteTx, siteTy);

  // Manually set builder to building phase (simulating assignment + arrival)
  const builder = state.mapData.builders[0];
  builder.busy = true;
  builder.phase = 'building';
  builder.assignedSiteId = 0;

  // Set site to non-pending with builder assigned
  const site = state.mapData.constructionSites[0];
  site.builderIndex = 0;
  site.pending = false;

  return state;
}

// ─── BUILDING_CONFIG ───────────────────────────────────────────────

describe('BUILDING_CONFIG', () => {
  it('has separator config with correct values', () => {
    const config = BUILDING_CONFIG['separator'];
    expect(config).toBeDefined();
    expect(config!.footprintW).toBe(2);
    expect(config!.footprintH).toBe(2);
    expect(config!.costRaw).toBe(100);
    expect(config!.buildTimeMs).toBe(5000);
  });
});

// ─── canPlaceBuilding ──────────────────────────────────────────────

describe('canPlaceBuilding', () => {
  it('accepts empty valid 2x2 area', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0 });
    // (10,10) is far from HQ at (0,0), empty area
    const result = canPlaceBuilding(state, 'separator', 10, 10);
    expect(result).toEqual({ valid: true });
  });

  it('rejects out-of-bounds placement', () => {
    const state = makeTestState({ mapW: 10, mapH: 10, hqTx: 0, hqTy: 0 });
    // 2x2 footprint at (9,9) would overflow: needs tiles (9,9)(9,10)(10,9)(10,10)
    const result = canPlaceBuilding(state, 'separator', 9, 9);
    expect(result).toEqual({ valid: false, reason: 'out-of-bounds' });
  });

  it('rejects negative coordinates', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });
    const result = canPlaceBuilding(state, 'separator', -1, -1);
    expect(result).toEqual({ valid: false, reason: 'out-of-bounds' });
  });

  it('rejects HQ footprint overlap', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });
    // HQ is at (5,5) with 3x3 footprint → tiles (5,5)-(7,7) are unbuildable
    // Separator 2x2 at (6,6) overlaps HQ
    const result = canPlaceBuilding(state, 'separator', 6, 6);
    expect(result).toEqual({ valid: false, reason: 'occupied' });
  });

  it('rejects resource footprint overlap', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      resources: [{ tx: 10, ty: 10, footprint: 1 }],
    });
    // Resource at (10,10) → separator 2x2 at (9,9) overlaps (10,10)
    const result = canPlaceBuilding(state, 'separator', 9, 9);
    expect(result).toEqual({ valid: false, reason: 'occupied' });
  });

  it('rejects obstacle footprint overlap', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      obstacles: [{ tx: 11, ty: 11, footprint: 1 }],
    });
    // Obstacle at (11,11) → separator 2x2 at (10,10) overlaps (11,11)
    const result = canPlaceBuilding(state, 'separator', 10, 10);
    expect(result).toEqual({ valid: false, reason: 'occupied' });
  });

  it('rejects existing building overlap', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      buildings: [{ tx: 10, ty: 10 }],
    });
    // Existing separator at (10,10) occupies (10,10)-(11,11)
    // New separator at (10,10) overlaps
    const result = canPlaceBuilding(state, 'separator', 10, 10);
    expect(result).toEqual({ valid: false, reason: 'occupied' });
  });

  it('rejects existing construction site overlap', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      constructionSites: [{ tx: 10, ty: 10 }],
    });
    // Construction site for separator at (10,10) occupies (10,10)-(11,11)
    const result = canPlaceBuilding(state, 'separator', 10, 10);
    expect(result).toEqual({ valid: false, reason: 'occupied' });
  });

  it('rejects insufficient rawMinerals', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 50 });
    // Separator costs 100, player has 50
    const result = canPlaceBuilding(state, 'separator', 10, 10);
    expect(result).toEqual({ valid: false, reason: 'insufficient-resources' });
  });

  it('rejects unknown building type', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0 });
    // 'raw-storage' is in BuildingType but not configured in BUILDING_CONFIG
    const result = canPlaceBuilding(state, 'raw-storage', 10, 10);
    expect(result).toEqual({ valid: false, reason: 'unknown-building-type' });
  });

  it('accepts placement with exactly enough rawMinerals', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 100 });
    const result = canPlaceBuilding(state, 'separator', 10, 10);
    expect(result).toEqual({ valid: true });
  });
});

// ─── placeConstructionSite ─────────────────────────────────────────

describe('placeConstructionSite', () => {
  it('deducts rawMinerals on success', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 500 });
    const before = state.rawMinerals;
    const result = placeConstructionSite(state, 'separator', 10, 10);
    expect(result.ok).toBe(true);
    expect(state.rawMinerals).toBe(before - BUILDING_CONFIG['separator']!.costRaw);
  });

  it('creates a construction site in state.mapData.constructionSites', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0 });
    const result = placeConstructionSite(state, 'separator', 10, 10);
    expect(result.ok).toBe(true);

    expect(state.mapData.constructionSites.length).toBe(1);
    const site = state.mapData.constructionSites[0];
    expect(site.tx).toBe(10);
    expect(site.ty).toBe(10);
    expect(site.type).toBe('separator');
    expect(site.elapsed).toBe(0);
    expect(site.duration).toBe(5000);
    expect(site.progress).toBe(0);
    expect(site.pending).toBe(true);
    expect(site.id).toBe(0);
  });

  it('failed placement does not mutate rawMinerals', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 50 });
    const before = state.rawMinerals;
    const result = placeConstructionSite(state, 'separator', 10, 10);
    expect(result.ok).toBe(false);
    expect(state.rawMinerals).toBe(before);
  });

  it('failed placement does not add construction site', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 50 });
    const result = placeConstructionSite(state, 'separator', 10, 10);
    expect(result.ok).toBe(false);
    expect(state.mapData.constructionSites.length).toBe(0);
  });

  it('returns failure reason matching canPlaceBuilding', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 50 });
    const result = placeConstructionSite(state, 'separator', 10, 10);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient-resources');
    }
  });

  it('returns siteId on success', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0 });
    const result = placeConstructionSite(state, 'separator', 10, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.siteId).toBe('site-0');
    }
  });
});

// ─── updateConstructionSiteProgress ────────────────────────────────

describe('updateConstructionSiteProgress', () => {
  it('increments progress over time with builder in building phase', () => {
    const state = makeBuildingState();

    // Advance 200ms (max per tick due to clamping)
    const result = updateConstructionSiteProgress(state, 'site-0', 200);
    expect(result).toEqual({ completed: false });

    const site = state.mapData.constructionSites[0];
    expect(site.elapsed).toBe(200);
    expect(site.progress).toBeCloseTo(200 / 5000, 4);
  });

  it('clamps deltaMs to 200ms', () => {
    const state = makeBuildingState();

    // Even with huge delta, should only advance 200ms
    const result = updateConstructionSiteProgress(state, 'site-0', 10000);
    expect(result).toEqual({ completed: false });

    const site = state.mapData.constructionSites[0];
    expect(site.elapsed).toBe(200);
  });

  it('completes construction when elapsed reaches duration', () => {
    const state = makeBuildingState();

    // Advance in 200ms steps (clamped max) for 25 steps = 5000ms total
    let lastResult: { completed: boolean; buildingId?: string } = { completed: false };
    for (let i = 0; i < 25; i++) {
      lastResult = updateConstructionSiteProgress(state, 'site-0', 200);
    }

    expect(lastResult.completed).toBe(true);
    if (lastResult.completed) {
      expect(lastResult.buildingId).toBe('building-10-10');
    }
  });

  it('removes construction site and creates building on completion', () => {
    const state = makeBuildingState();

    expect(state.mapData.constructionSites.length).toBe(1);
    expect(state.mapData.buildings.length).toBe(0);

    // Complete construction
    for (let i = 0; i < 25; i++) {
      updateConstructionSiteProgress(state, 'site-0', 200);
    }

    // Construction site should be removed
    expect(state.mapData.constructionSites.length).toBe(0);

    // Building should exist at the site's position
    expect(state.mapData.buildings.length).toBe(1);
    expect(state.mapData.buildings[0].tx).toBe(10);
    expect(state.mapData.buildings[0].ty).toBe(10);
    expect(state.mapData.buildings[0].type).toBe('separator');
  });

  it('returns completed:false for non-existent site ID', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0 });
    const result = updateConstructionSiteProgress(state, 'site-999', 200);
    expect(result).toEqual({ completed: false });
  });

  it('returns completed:false for invalid site ID format', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0 });
    const result = updateConstructionSiteProgress(state, 'invalid', 200);
    expect(result).toEqual({ completed: false });
  });

  it('completed building blocks further placement at same location', () => {
    const state = makeBuildingState({ rawMinerals: 1000 });

    // Complete construction
    for (let i = 0; i < 25; i++) {
      updateConstructionSiteProgress(state, 'site-0', 200);
    }

    // Now try to place another separator at the same location
    const result = canPlaceBuilding(state, 'separator', 10, 10);
    expect(result).toEqual({ valid: false, reason: 'occupied' });
  });

  it('does not advance progress when site is pending (no builder)', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0 });
    placeConstructionSite(state, 'separator', 10, 10);

    // No builder assigned — site is pending
    const result = updateConstructionSiteProgress(state, 'site-0', 200);
    expect(result).toEqual({ completed: false });

    const site = state.mapData.constructionSites[0];
    expect(site.elapsed).toBe(0);
    expect(site.progress).toBe(0);
  });

  it('does not advance progress when builder is moving-to-site', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      builders: [{ tx: 5, ty: 5 }],
    });
    placeConstructionSite(state, 'separator', 10, 10);

    // Manually set builder to moving-to-site phase but site still pending
    const builder = state.mapData.builders[0];
    builder.busy = true;
    builder.phase = 'moving-to-site';
    builder.assignedSiteId = 0;

    const site = state.mapData.constructionSites[0];
    site.builderIndex = 0;
    site.pending = true; // Still pending because builder hasn't arrived

    // Progress should not advance
    const result = updateConstructionSiteProgress(state, 'site-0', 200);
    expect(result).toEqual({ completed: false });
    expect(site.elapsed).toBe(0);
  });

  it('releases builder on completion', () => {
    const state = makeBuildingState();

    // Complete construction
    for (let i = 0; i < 25; i++) {
      updateConstructionSiteProgress(state, 'site-0', 200);
    }

    // Builder should be released back to idle
    const builder = state.mapData.builders[0];
    expect(builder.busy).toBe(false);
    expect(builder.phase).toBe('idle');
    expect(builder.assignedSiteId).toBe(-1);
  });
});

// ─── Deterministic IDs ─────────────────────────────────────────────

describe('deterministic IDs', () => {
  it('construction site IDs increment sequentially', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 1000 });

    const r1 = placeConstructionSite(state, 'separator', 10, 10);
    const r2 = placeConstructionSite(state, 'separator', 14, 14);
    const r3 = placeConstructionSite(state, 'separator', 8, 16);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);

    if (r1.ok && r2.ok && r3.ok) {
      expect(r1.siteId).toBe('site-0');
      expect(r2.siteId).toBe('site-1');
      expect(r3.siteId).toBe('site-2');
    }

    // Verify the construction sites have matching numeric IDs
    expect(state.mapData.constructionSites[0].id).toBe(0);
    expect(state.mapData.constructionSites[1].id).toBe(1);
    expect(state.mapData.constructionSites[2].id).toBe(2);
  });

  it('nextConstructionId counter persists across placements', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 0, hqTy: 0, rawMinerals: 1000 });

    placeConstructionSite(state, 'separator', 10, 10);
    expect(state.nextConstructionId).toBe(1);

    placeConstructionSite(state, 'separator', 14, 14);
    expect(state.nextConstructionId).toBe(2);
  });
});
