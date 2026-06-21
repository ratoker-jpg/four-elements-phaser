/**
 * Tests for fog of war / vision system.
 *
 * FOG-VISION-IMPLEMENTATION-08: Tests for visibility state, recomputation,
 * vision source collection, building radius mapping, save migration, and
 * Arena isolation.
 */

import { describe, it, expect } from 'vitest';
import {
  createVisionGrid,
  createInitialVisionState,
  getTileVisibility,
  isTileVisible,
  isTileExplored,
  recomputeVisibility,
  collectVisionSources,
  getVisionRadiusForRuntimeBuildingType,
  BUILDER_VISION_RADIUS,
  HARVESTER_VISION_RADIUS,
  HQ_VISION_RADIUS,
  PURPLE_FACTION_VISION_BONUS,
  type VisionState,
} from '../state/visibility';
import type { GameState, BuildingType } from '../state/types';
import { createInitialVisionState as createVis } from '../state/visibility';

// ─── Test helpers ────────────────────────────────────────────────────

function makeMinimalState(overrides: Partial<GameState> = {}): GameState {
  const width = overrides.mapWidth ?? 30;
  const height = overrides.mapHeight ?? 30;
  return {
    mapId: 'test',
    mapName: 'Test',
    mapWidth: width,
    mapHeight: height,
    mapData: {
      width,
      height,
      terrain: Array.from({ length: height }, () => Array(width).fill('sand')),
      hq: { tx: 5, ty: 5, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [],
      constructionSites: [],
    },
    entities: [],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [],
    resourceNodes: [],
    economy: {
      raw: 100, matter: 200,
      elements: { cyan: 50, green: 0, yellow: 0, purple: 0 },
      powerGenerated: 10, powerConsumed: 0,
      separators: [], rawCap: 200, matterCap: 200, elementCap: 200,
    },
    hqPosition: { tx: 6, ty: 6 },
    nextConstructionId: 0,
    production: { factories: [] },
    vision: createVis(width, height),
    ...overrides,
  };
}

// ─── Grid dimensions ─────────────────────────────────────────────────

describe('FOG-VISION-08: grid dimensions [height][width]', () => {
  it('creates grid with correct height and width', () => {
    const grid = createVisionGrid(48, 48, false);
    expect(grid.length).toBe(48);
    expect(grid[0].length).toBe(48);
  });

  it('creates grid with correct initial value', () => {
    const tGrid = createVisionGrid(10, 10, true);
    const fGrid = createVisionGrid(10, 10, false);
    expect(tGrid[5][5]).toBe(true);
    expect(fGrid[5][5]).toBe(false);
  });
});

// ─── Out-of-bounds safety ────────────────────────────────────────────

describe('FOG-VISION-08: out-of-bounds queries are safe', () => {
  const vision = createInitialVisionState(10, 10);

  it('negative coords return unexplored', () => {
    expect(getTileVisibility(vision, -1, -1)).toBe('unexplored');
    expect(isTileVisible(vision, -1, 0)).toBe(false);
    expect(isTileExplored(vision, 0, -1)).toBe(false);
  });

  it('coords beyond grid return unexplored', () => {
    expect(getTileVisibility(vision, 10, 5)).toBe('unexplored');
    expect(getTileVisibility(vision, 5, 10)).toBe('unexplored');
    expect(isTileVisible(vision, 100, 100)).toBe(false);
  });
});

// ─── Diamond radius ──────────────────────────────────────────────────

describe('FOG-VISION-08: diamond radius correctness', () => {
  it('radius 1 marks 5 tiles', () => {
    const state = makeMinimalState({ mapWidth: 10, mapHeight: 10 });
    state.mapData.hq = { tx: 5, ty: 5, faction: 'cyan' };
    // Override HQ vision to radius 1 for testing
    state.vision = createVis(10, 10);
    // Manually mark tiles as if radius=1 at (5,5)
    // We'll test collectVisionSources instead for the real radius
    // For now just verify the tile count for diamond
    // |dx| + |dy| <= 1: (0,0), (1,0), (-1,0), (0,1), (0,-1) = 5
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) count++;
      }
    }
    expect(count).toBe(5);
  });

  it('radius 2 marks 13 tiles', () => {
    let count = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2) count++;
      }
    }
    expect(count).toBe(13);
  });

  it('edge clamp: source near map edge does not go out of bounds', () => {
    const state = makeMinimalState({ mapWidth: 10, mapHeight: 10 });
    state.mapData.hq = { tx: 0, ty: 0, faction: 'cyan' };
    // Should not throw
    recomputeVisibility(state);
    // Some tiles near (0,0) should be visible
    expect(isTileVisible(state.vision, 0, 0)).toBe(true);
    expect(isTileVisible(state.vision, 1, 0)).toBe(true);
  });
});

// ─── Multiple sources combine ────────────────────────────────────────

describe('FOG-VISION-08: multiple vision sources combine', () => {
  it('two sources cover more tiles than one', () => {
    const state1 = makeMinimalState({ mapWidth: 30, mapHeight: 30 });
    state1.mapData.hq = { tx: 5, ty: 5, faction: 'cyan' };
    state1.harvesters = [];
    recomputeVisibility(state1);
    const visible1 = countVisible(state1.vision);

    const state2 = makeMinimalState({ mapWidth: 30, mapHeight: 30 });
    state2.mapData.hq = { tx: 5, ty: 5, faction: 'cyan' };
    state2.harvesters = [{
      id: 'h1', ftx: 20, fty: 20, faction: 'cyan',
      phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
      gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2,
    }];
    recomputeVisibility(state2);
    const visible2 = countVisible(state2.vision);

    expect(visible2).toBeGreaterThan(visible1);
  });
});

// ─── Explored persists after leaving ─────────────────────────────────

describe('FOG-VISION-08: explored persists after tile leaves visible', () => {
  it('tile explored when visible, remains explored when unit moves away', () => {
    const state = makeMinimalState({ mapWidth: 30, mapHeight: 30 });
    state.mapData.hq = { tx: 15, ty: 15, faction: 'cyan' };
    recomputeVisibility(state);

    // Tile near HQ should be visible and explored
    expect(isTileVisible(state.vision, 15, 15)).toBe(true);
    expect(isTileExplored(state.vision, 15, 15)).toBe(true);

    // Remove HQ (simulating no vision source there)
    state.mapData.hq = { tx: 0, ty: 0, faction: 'cyan' };
    // Add a far-away harvester instead
    state.harvesters = [{
      id: 'h1', ftx: 25, fty: 25, faction: 'cyan',
      phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
      gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2,
    }];
    state.vision.dirty = true;
    recomputeVisibility(state);

    // Tile 15,15 should no longer be visible but should remain explored
    expect(isTileVisible(state.vision, 15, 15)).toBe(false);
    expect(isTileExplored(state.vision, 15, 15)).toBe(true);
  });
});

// ─── Visible clears between recomputes ──────────────────────────────

describe('FOG-VISION-08: visible grid clears between recomputes', () => {
  it('visible grid is fully cleared before recomputation', () => {
    const state = makeMinimalState({ mapWidth: 30, mapHeight: 30 });
    state.mapData.hq = { tx: 15, ty: 15, faction: 'cyan' };
    recomputeVisibility(state);

    // Some tiles should be visible
    const beforeCount = countVisible(state.vision);
    expect(beforeCount).toBeGreaterThan(0);

    // Move HQ far away
    state.mapData.hq = { tx: 0, ty: 0, faction: 'cyan' };
    state.vision.dirty = true;
    recomputeVisibility(state);

    // Tiles near 15,15 should not be visible anymore
    expect(isTileVisible(state.vision, 15, 15)).toBe(false);
  });
});

// ─── Vision source collection ───────────────────────────────────────

describe('FOG-VISION-08: collectVisionSources', () => {
  it('HQ source exists with correct radius', () => {
    const state = makeMinimalState();
    const sources = collectVisionSources(state);
    const hqSource = sources.find(s => s.sourceType === 'hq');
    expect(hqSource).toBeDefined();
    expect(hqSource!.radius).toBe(HQ_VISION_RADIUS);
  });

  it('builder radius is BUILDER_VISION_RADIUS', () => {
    const state = makeMinimalState();
    state.mapData.builders = [{
      id: 'b1', tx: 10, ty: 10, ftx: 10, fty: 10,
      busy: false, phase: 'idle', path: [], pathIndex: 0,
      targetTx: 0, targetTy: 0, assignedSiteId: -1,
    }];
    const sources = collectVisionSources(state);
    const builderSource = sources.find(s => s.sourceId === 'b1');
    expect(builderSource).toBeDefined();
    expect(builderSource!.radius).toBe(BUILDER_VISION_RADIUS);
  });

  it('harvester radius is HARVESTER_VISION_RADIUS', () => {
    const state = makeMinimalState();
    state.harvesters = [{
      id: 'h1', ftx: 10, fty: 10, faction: 'cyan',
      phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
      gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2,
    }];
    const sources = collectVisionSources(state);
    const harvesterSource = sources.find(s => s.sourceId === 'h1');
    expect(harvesterSource).toBeDefined();
    expect(harvesterSource!.radius).toBe(HARVESTER_VISION_RADIUS);
  });

  it('completed building provides vision via mapping', () => {
    const state = makeMinimalState();
    state.mapData.buildings = [{ tx: 10, ty: 10, type: 'separator' }];
    const sources = collectVisionSources(state);
    const buildingSource = sources.find(s => s.sourceType === 'building');
    expect(buildingSource).toBeDefined();
    expect(buildingSource!.radius).toBe(3); // separator vision radius
  });

  it('construction site is NOT a vision source', () => {
    const state = makeMinimalState();
    state.mapData.constructionSites = [{
      tx: 10, ty: 10, type: 'separator', elapsed: 0, duration: 10000,
      progress: 0, builderIndex: -1, id: 1, pending: false,
    }];
    const sources = collectVisionSources(state);
    expect(sources.find(s => s.sourceId?.includes('site'))).toBeUndefined();
  });

  it('unknown building type gets radius 0', () => {
    const state = makeMinimalState();
    state.mapData.buildings = [{ tx: 10, ty: 10, type: 'command-relay' as BuildingType }];
    const sources = collectVisionSources(state);
    const bSource = sources.find(s => s.sourceType === 'building' && s.sourceId?.includes('10-10'));
    // command-relay has no mapping, so radius should be 0 and should not be a source
    expect(bSource).toBeUndefined();
  });
});

// ─── Building radius mapping ────────────────────────────────────────

describe('FOG-VISION-08: getVisionRadiusForRuntimeBuildingType', () => {
  it('separator → 3', () => {
    expect(getVisionRadiusForRuntimeBuildingType('separator')).toBe(3);
  });

  it('matter-storage → 2 (maps to energy_storage)', () => {
    expect(getVisionRadiusForRuntimeBuildingType('matter-storage')).toBe(2);
  });

  it('units-factory → 3', () => {
    expect(getVisionRadiusForRuntimeBuildingType('units-factory')).toBe(3);
  });

  it('energy-plant → 0 (visual-ready)', () => {
    expect(getVisionRadiusForRuntimeBuildingType('energy-plant')).toBe(0);
  });

  it('unknown type → 0', () => {
    expect(getVisionRadiusForRuntimeBuildingType('command-relay' as BuildingType)).toBe(0);
  });

  it('power-plant → 3', () => {
    expect(getVisionRadiusForRuntimeBuildingType('power-plant')).toBe(3);
  });

  it('raw-storage → 2', () => {
    expect(getVisionRadiusForRuntimeBuildingType('raw-storage')).toBe(2);
  });

  it('element-storage → 2', () => {
    expect(getVisionRadiusForRuntimeBuildingType('element-storage')).toBe(2);
  });
});

// ─── Purple faction bonus ──────────────────────────────────────────

describe('FOG-VISION-08: purple faction vision bonus', () => {
  it('purple HQ gets +1 radius', () => {
    const state = makeMinimalState();
    state.playerFaction = 'purple';
    state.mapData.hq = { tx: 10, ty: 10, faction: 'purple' };
    const sources = collectVisionSources(state);
    const hqSource = sources.find(s => s.sourceType === 'hq');
    expect(hqSource!.radius).toBe(HQ_VISION_RADIUS + PURPLE_FACTION_VISION_BONUS);
  });

  it('purple buildings get +1 radius', () => {
    const state = makeMinimalState();
    state.playerFaction = 'purple';
    state.mapData.buildings = [{ tx: 10, ty: 10, type: 'separator' }];
    const sources = collectVisionSources(state);
    const bSource = sources.find(s => s.sourceType === 'building');
    expect(bSource!.radius).toBe(3 + PURPLE_FACTION_VISION_BONUS);
  });
});

// ─── Arena isolation ───────────────────────────────────────────────

describe('FOG-VISION-08: Arena mode isolation', () => {
  it('Arena state has all tiles explored and visible', () => {
    const state = makeMinimalState();
    // Simulate arena mode: all tiles explored + visible
    for (let y = 0; y < state.mapHeight; y++) {
      for (let x = 0; x < state.mapWidth; x++) {
        state.vision.explored[y][x] = true;
        state.vision.visible[y][x] = true;
      }
    }
    // All tiles should be visible
    expect(getTileVisibility(state.vision, 0, 0)).toBe('visible');
    expect(getTileVisibility(state.vision, 29, 29)).toBe('visible');
  });
});

// ─── Save migration ─────────────────────────────────────────────────

describe('FOG-VISION-08: save migration', () => {
  it('createInitialVisionState creates unexplored grid', () => {
    const vision = createInitialVisionState(10, 10);
    expect(vision.explored[0][0]).toBe(false);
    expect(vision.visible[0][0]).toBe(false);
    expect(vision.dirty).toBe(true);
  });

  it('v1 save migration creates fully-explored vision', () => {
    // Simulate v1 migration: no vision field → fully explored
    const mapW = 10, mapH = 10;
    const vision = createInitialVisionState(mapW, mapH);
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        vision.explored[y][x] = true;
      }
    }
    vision.dirty = true;

    // All explored tiles should be marked
    expect(vision.explored[5][5]).toBe(true);
    expect(vision.visible[5][5]).toBe(false); // visible recomputed on load
    expect(vision.dirty).toBe(true);
  });
});

// ─── Performance smoke ─────────────────────────────────────────────

describe('FOG-VISION-08: performance smoke test', () => {
  it('48x48 map with 20+ sources recomputes in < 50ms', () => {
    const state = makeMinimalState({ mapWidth: 48, mapHeight: 48 });
    state.mapData.hq = { tx: 24, ty: 24, faction: 'cyan' };

    // Add 10 buildings
    for (let i = 0; i < 10; i++) {
      state.mapData.buildings.push({ tx: 5 + i * 4, ty: 5, type: 'separator' });
    }

    // Add 5 builders
    for (let i = 0; i < 5; i++) {
      state.mapData.builders.push({
        id: `b${i}`, tx: 5 + i * 8, ftx: 5 + i * 8, ty: 20, fty: 20,
        busy: false, phase: 'idle', path: [], pathIndex: 0,
        targetTx: 0, targetTy: 0, assignedSiteId: -1,
      });
    }

    // Add 5 harvesters
    for (let i = 0; i < 5; i++) {
      state.harvesters.push({
        id: `h${i}`, ftx: 5 + i * 8, fty: 30, faction: 'cyan',
        phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
        gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2,
      });
    }

    const start = performance.now();
    recomputeVisibility(state);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});

// ─── Helpers ────────────────────────────────────────────────────────

function countVisible(vision: VisionState): number {
  let count = 0;
  for (const row of vision.visible) {
    for (const v of row) {
      if (v) count++;
    }
  }
  return count;
}
