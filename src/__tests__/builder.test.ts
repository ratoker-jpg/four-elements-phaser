import { describe, it, expect } from 'vitest';
import {
  assignIdleBuilders,
  updateBuilders,
  releaseBuilder,
} from '../state/builder';
import {
  placeConstructionSite,
  updateConstructionSiteProgress,
} from '../state/construction';
import { updateGameState } from '../state/updateGameState';
import type { GameState, MapData, EconomyState, BuilderPlacement } from '../state/types';
import { createInitialVisionState } from '../state/visibility';
// ─── Test helpers ──────────────────────────────────────────────────

/** Build a minimal GameState for builder tests. */
function makeTestState(overrides?: {
  mapW?: number;
  mapH?: number;
  hqTx?: number;
  hqTy?: number;
  matter?: number;
  builders?: Array<{ tx: number; ty: number; ftx?: number; fty?: number }>;
  resources?: Array<{ tx: number; ty: number; footprint: number }>;
}): GameState {
  const w = overrides?.mapW ?? 20;
  const h = overrides?.mapH ?? 20;
  const hqTx = overrides?.hqTx ?? 0;
  const hqTy = overrides?.hqTy ?? 0;

  const builders: BuilderPlacement[] = (overrides?.builders ?? []).map((b, i) => ({
    id: `builder-${i}`,
    tx: b.tx,
    ty: b.ty,
    busy: false,
    phase: 'idle' as const,
    path: [],
    pathIndex: 0,
    ftx: b.ftx ?? b.tx,
    fty: b.fty ?? b.ty,
    targetTx: b.tx,
    targetTy: b.ty,
    assignedSiteId: -1,
  }));

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
    obstacles: [],
    decor: [],
    buildings: [],
    builders,
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
    economy: { raw: 0, matter: overrides?.matter ?? 500, elements: { cyan: 0, green: 0, yellow: 0, purple: 0 }, powerGenerated: 0, powerConsumed: 0, separators: [], rawCap: 200, matterCap: 200, elementCap: 200 } as EconomyState,
    hqPosition: { tx: hqTx + 1, ty: hqTy + 1 },
    nextConstructionId: 0,
    production: { factories: [] },
    vision: createInitialVisionState(48, 48),
  };
}

// ─── Builder initialization ────────────────────────────────────────

describe('builder initialization', () => {
  it('builder initializes from map data', () => {
    const state = makeTestState({ builders: [{ tx: 5, ty: 5 }] });
    expect(state.mapData.builders.length).toBe(1);
    const b = state.mapData.builders[0];
    expect(b.tx).toBe(5);
    expect(b.ty).toBe(5);
    expect(b.ftx).toBe(5);
    expect(b.fty).toBe(5);
    expect(b.phase).toBe('idle');
    expect(b.busy).toBe(false);
    expect(b.assignedSiteId).toBe(-1);
  });

  it('multiple builders initialize from map data', () => {
    const state = makeTestState({
      builders: [
        { tx: 3, ty: 3 },
        { tx: 7, ty: 7 },
      ],
    });
    expect(state.mapData.builders.length).toBe(2);
    expect(state.mapData.builders[0].tx).toBe(3);
    expect(state.mapData.builders[1].tx).toBe(7);
  });
});

// ─── Site does not progress without builder ────────────────────────

describe('site does not progress without builder', () => {
  it('construction site with no builder does not progress', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
    });
    // No builders in state
    placeConstructionSite(state, 'separator', 10, 10);

    // Try to advance progress
    const result = updateConstructionSiteProgress(state, 'site-0', 200);
    expect(result).toEqual({ completed: false });

    // Progress should remain at 0 because site is still pending
    const site = state.mapData.constructionSites[0];
    expect(site.progress).toBe(0);
    expect(site.pending).toBe(true);
  });

  it('site with pending=true does not advance even with deltaMs', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
    });
    placeConstructionSite(state, 'separator', 10, 10);

    // Multiple ticks — should not advance
    for (let i = 0; i < 25; i++) {
      updateConstructionSiteProgress(state, 'site-0', 200);
    }
    expect(state.mapData.constructionSites[0].progress).toBe(0);
  });
});

// ─── Idle builder gets assigned to site ────────────────────────────

describe('idle builder gets assigned to site', () => {
  it('assignIdleBuilders assigns an idle builder to a pending site', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 8, ty: 10 }], // Near site at (10,10)
    });
    placeConstructionSite(state, 'separator', 10, 10);

    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    expect(builder.busy).toBe(true);
    expect(builder.phase).toBe('moving-to-site');
    expect(builder.assignedSiteId).toBe(0);

    const site = state.mapData.constructionSites[0];
    expect(site.builderIndex).toBe(0);
  });

  it('builder receives path to adjacent site tile', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 8, ty: 10 }],
    });
    placeConstructionSite(state, 'separator', 10, 10);

    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    // Builder should have a non-empty path (unless already adjacent)
    expect(builder.path.length).toBeGreaterThan(0);

    // Path should lead to a tile adjacent to the 2x2 site at (10,10)-(11,11)
    const lastStep = builder.path[builder.path.length - 1];
    // Adjacent tiles to 2x2 at (10,10): north row y=9 x=10,11; south row y=12 x=10,11; west col x=9 y=10,11; east col x=12 y=10,11
    const adjacentTiles = [
      [10, 9], [11, 9],  // north
      [10, 12], [11, 12], // south
      [9, 10], [9, 11],   // west
      [12, 10], [12, 11], // east
    ];
    const isAdjacent = adjacentTiles.some(([x, y]) => lastStep.tx === x && lastStep.ty === y);
    expect(isAdjacent).toBe(true);
  });

  it('already adjacent builder immediately transitions to building', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 9, ty: 10 }], // Adjacent to site at (10,10)
    });
    placeConstructionSite(state, 'separator', 10, 10);

    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    expect(builder.phase).toBe('building');

    const site = state.mapData.constructionSites[0];
    expect(site.pending).toBe(false);
  });

  it('no idle builder means site stays pending', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      // No builders
    });
    placeConstructionSite(state, 'separator', 10, 10);

    assignIdleBuilders(state);

    const site = state.mapData.constructionSites[0];
    expect(site.builderIndex).toBe(-1);
    expect(site.pending).toBe(true);
  });

  it('busy builder is not assigned to a new site', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 1000,
      builders: [{ tx: 8, ty: 10 }],
    });

    // Place first site and assign builder
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    // Place second site
    placeConstructionSite(state, 'separator', 14, 14);
    assignIdleBuilders(state);

    // Second site should have no builder
    const site2 = state.mapData.constructionSites.find(s => s.tx === 14);
    expect(site2).toBeDefined();
    expect(site2!.builderIndex).toBe(-1);
  });
});

// ─── Builder movement ──────────────────────────────────────────────

describe('builder movement', () => {
  it('builder moves toward site over time', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 8, ty: 10, ftx: 8, fty: 10 }],
    });
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    expect(builder.phase).toBe('moving-to-site');
    const startFtx = builder.ftx;

    // Advance by 100ms — builder should move
    updateBuilders(state, 100);

    // Builder should have moved toward target
    expect(builder.ftx).toBeGreaterThan(startFtx);
  });

  it('builder does not snap early from ~0.2 tiles away', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 9, ty: 10 }], // Adjacent to site at (10,10)
    });
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    // Builder should be immediately building since it's adjacent
    expect(builder.phase).toBe('building');

    // Now place builder 0.2 tiles away from a waypoint and verify it does NOT snap
    // Set up a fresh scenario: builder far from site, moving toward it
    const state2 = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 8, ty: 10, ftx: 8, fty: 10 }],
    });
    placeConstructionSite(state2, 'separator', 10, 10);
    assignIdleBuilders(state2);

    const builder2 = state2.mapData.builders[0];
    // Move builder most of the way toward its first waypoint, leaving ~0.2 gap
    // First waypoint is typically (9, 10) since path goes tile-by-tile
    const waypoint = builder2.path[0];
    if (waypoint) {
      // Place builder 0.2 tiles before the waypoint
      const dx = waypoint.tx - builder2.ftx;
      const dy = waypoint.ty - builder2.fty;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offset = 0.2;
      builder2.ftx = waypoint.tx - (dx / dist) * offset;
      builder2.fty = waypoint.ty - (dy / dist) * offset;

      const ftxBeforeSnap = builder2.ftx;
      const ftyBeforeSnap = builder2.fty;

      // Advance by a small dt — builder should move smoothly, NOT snap
      updateBuilders(state2, 10);

      // Builder should NOT have snapped to the waypoint integer position
      // It should have moved only a small increment
      const movedFtx = Math.abs(builder2.ftx - ftxBeforeSnap);
      const movedFty = Math.abs(builder2.fty - ftyBeforeSnap);

      // At speed 3 tiles/sec, 10ms = 0.03 tiles movement
      // The move should be small (< 0.1 tiles), NOT a 0.2-tile snap
      expect(movedFtx).toBeLessThan(0.1);
      expect(movedFty).toBeLessThan(0.1);
    }
  });

  it('builder reaches site and transitions to building', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 8, ty: 10, ftx: 8, fty: 10 }],
    });
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    expect(builder.phase).toBe('moving-to-site');

    // Advance enough for builder to reach the site (3 tiles at speed 3 = ~1 sec)
    for (let i = 0; i < 50; i++) {
      updateBuilders(state, 100);
    }

    expect(builder.phase).toBe('building');

    const site = state.mapData.constructionSites[0];
    expect(site.pending).toBe(false);
  });
});

// ─── Site progresses only after builder reaches building phase ─────

describe('site progresses only after builder in building phase', () => {
  it('site with building-phase builder advances progress', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 9, ty: 10 }], // Already adjacent
    });
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    // Builder should be in building phase immediately
    const builder = state.mapData.builders[0];
    expect(builder.phase).toBe('building');

    // Now progress should advance
    const result = updateConstructionSiteProgress(state, 'site-0', 200);
    expect(result).toEqual({ completed: false });

    const site = state.mapData.constructionSites[0];
    expect(site.elapsed).toBe(200);
    expect(site.progress).toBeCloseTo(200 / 20000, 4);
  });

  it('site with moving-to-site builder does not advance progress', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 5, ty: 5 }], // Far from site
    });
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    // Builder might be moving-to-site or building depending on path
    if (builder.phase === 'moving-to-site') {
      // Site is still pending
      const site = state.mapData.constructionSites[0];
      expect(site.pending).toBe(true);

      // Progress should NOT advance
      const result = updateConstructionSiteProgress(state, 'site-0', 200);
      expect(result).toEqual({ completed: false });
      expect(site.progress).toBe(0);
    }
  });
});

// ─── Completion returns builder to idle ────────────────────────────

describe('completion returns builder to idle', () => {
  it('builder becomes idle when construction completes', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 9, ty: 10 }], // Already adjacent
    });
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    // Verify builder is building
    const builder = state.mapData.builders[0];
    expect(builder.phase).toBe('building');

    // Complete construction (100 ticks of 200ms = 20000ms)
    let lastResult: { completed: boolean; buildingId?: string } = { completed: false };
    for (let i = 0; i < 100; i++) {
      lastResult = updateConstructionSiteProgress(state, 'site-0', 200);
    }

    expect(lastResult.completed).toBe(true);

    // Builder should be idle now
    expect(builder.busy).toBe(false);
    expect(builder.phase).toBe('idle');
    expect(builder.assignedSiteId).toBe(-1);
  });

  it('released builder can be assigned to a new site', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 2000,
      builders: [{ tx: 9, ty: 10 }], // Adjacent to first site
    });

    // Place and complete first site
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    const builder = state.mapData.builders[0];
    expect(builder.phase).toBe('building');

    // Complete first construction
    for (let i = 0; i < 100; i++) {
      updateConstructionSiteProgress(state, 'site-0', 200);
    }

    expect(builder.phase).toBe('idle');

    // Place second site
    placeConstructionSite(state, 'separator', 14, 14);
    assignIdleBuilders(state);

    // Builder should be assigned to second site
    expect(builder.busy).toBe(true);
    expect(builder.assignedSiteId).toBe(1);
  });
});

// ─── releaseBuilder ────────────────────────────────────────────────

describe('releaseBuilder', () => {
  it('resets builder to idle state', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 9, ty: 10 }],
    });

    // Manually set builder to busy state
    const builder = state.mapData.builders[0];
    builder.busy = true;
    builder.phase = 'building';
    builder.assignedSiteId = 5;
    builder.path = [{ tx: 10, ty: 10 }];
    builder.pathIndex = 1;

    releaseBuilder(state, 0);

    expect(builder.busy).toBe(false);
    expect(builder.phase).toBe('idle');
    expect(builder.assignedSiteId).toBe(-1);
    expect(builder.path).toEqual([]);
    expect(builder.pathIndex).toBe(0);
  });

  it('ignores invalid builder index', () => {
    const state = makeTestState({
      builders: [{ tx: 5, ty: 5 }],
    });
    // Should not throw
    releaseBuilder(state, -1);
    releaseBuilder(state, 99);
  });
});

// ─── Harvester loop still works ────────────────────────────────────

describe('harvester loop unaffected', () => {
  it('harvesters continue working alongside builder state machine', () => {
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 0, hqTy: 0,
      matter: 500,
      builders: [{ tx: 9, ty: 10 }],
      resources: [{ tx: 15, ty: 15, footprint: 1 }],
    });

    // Add a harvester manually (simplified)
    state.harvesters.push({
      id: 'h-0',
      ftx: 1,
      fty: 1,
      faction: 'cyan',
      phase: 'idle',
      targetResourceId: null,
      cargoRaw: 0,
      cargoCapacity: 20,
      gatherTimer: 0,
      unloadTimer: 0,
      speedTilesPerSecond: 2.5,
    });

    // Add the resource node
    state.resourceNodes.push({
      id: 'r-0',
      tx: 15,
      ty: 15,
      resourceType: 'small',
      footprint: 1,
      remainingRaw: 20,
      depleted: false,
    });

    // Place construction site
    placeConstructionSite(state, 'separator', 10, 10);
    assignIdleBuilders(state);

    // Advance both systems (harvesters need updateGameState, builders need updateBuilders)
    updateGameState(state, 100);
    updateBuilders(state, 100);

    // Harvester should have moved (from idle to moving-to-resource)
    expect(state.harvesters[0].phase).toBe('moving-to-resource');

    // Builder should be moving or building
    const builder = state.mapData.builders[0];
    expect(['moving-to-site', 'building']).toContain(builder.phase);
  });
});
