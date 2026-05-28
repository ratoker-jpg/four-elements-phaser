import { describe, it, expect } from 'vitest';
import {
  getSeparatorStatus,
  getFactoryStatus,
  getBuildBlockReason,
  getProductionBlockReason,
  getHarvesterStatus,
  isHarvesterBlocked,
  separatorStatusLabel,
  factoryStatusLabel,
  buildBlockLabel,
  productionBlockLabel,
  harvesterStatusLabel,
  type SeparatorStatus,
  type FactoryStatus,
  type BuildBlockReason,
  type ProductionBlockReason,
  type HarvesterStatus,
} from '../state/statusHelpers';
import type { GameState, MapData, EconomyState, HarvesterState } from '../state/types';
import {
  HQ_BASE_POWER,
} from '../state/types';

// ─── Test helpers ──────────────────────────────────────────────────

function makeStateWithSeparator(overrides?: {
  raw?: number;
  matter?: number;
  elementUnits?: number;
  rawCap?: number;
  matterCap?: number;
  elementCap?: number;
  separatorActive?: boolean;
  separatorProgress?: number;
}): GameState {
  const mapData: MapData = {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array(20).fill('sand')),
    hq: { tx: 0, ty: 0, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [{ tx: 10, ty: 10, type: 'separator' }],
    builders: [{ tx: 5, ty: 5, busy: false, phase: 'idle', path: [], pathIndex: 0, ftx: 5, fty: 5, targetTx: 5, targetTy: 5, assignedSiteId: -1 }],
    constructionSites: [],
  };

  const economy: EconomyState = {
    raw: overrides?.raw ?? 100,
    matter: overrides?.matter ?? 120,
    elements: { cyan: overrides?.elementUnits ?? 50, green: 0, yellow: 0, purple: 0 },
    powerGenerated: HQ_BASE_POWER,
    powerConsumed: 0,
    separators: [{
      tx: 10,
      ty: 10,
      progress: overrides?.separatorProgress ?? 0.5,
      active: overrides?.separatorActive ?? false,
    }],
    rawCap: overrides?.rawCap ?? 200,
    matterCap: overrides?.matterCap ?? 200,
    elementCap: overrides?.elementCap ?? 200,
  };

  return {
    mapId: 'test',
    mapName: 'Test',
    mapWidth: 20,
    mapHeight: 20,
    mapData,
    entities: [],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [],
    resourceNodes: [],
    economy,
    hqPosition: { tx: 1, ty: 1 },
    nextConstructionId: 0,
    production: { factories: [] },
  };
}

function makeStateWithFactory(overrides?: {
  matter?: number;
  elementUnits?: number;
  factoryActive?: boolean;
  queueUnitType?: 'builder' | 'harvester';
}): GameState {
  const mapData: MapData = {
    width: 30,
    height: 30,
    terrain: Array.from({ length: 30 }, () => Array(30).fill('sand')),
    hq: { tx: 0, ty: 0, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [{ tx: 10, ty: 10, type: 'units-factory' }],
    builders: [{ tx: 5, ty: 5, busy: false, phase: 'idle', path: [], pathIndex: 0, ftx: 5, fty: 5, targetTx: 5, targetTy: 5, assignedSiteId: -1 }],
    constructionSites: [],
  };

  const queue = overrides?.queueUnitType
    ? [{ unitType: overrides.queueUnitType, elapsedMs: 1000, durationMs: 15000, progress: 0.07, completed: false }]
    : [];

  return {
    mapId: 'test',
    mapName: 'Test',
    mapWidth: 30,
    mapHeight: 30,
    mapData,
    entities: [],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [],
    resourceNodes: [],
    economy: {
      raw: 100,
      matter: overrides?.matter ?? 200,
      elements: { cyan: overrides?.elementUnits ?? 50, green: 0, yellow: 0, purple: 0 },
      powerGenerated: HQ_BASE_POWER,
      powerConsumed: 0,
      separators: [],
      rawCap: 200,
      matterCap: 200,
      elementCap: 200,
    },
    hqPosition: { tx: 1, ty: 1 },
    nextConstructionId: 0,
    production: {
      factories: [{
        tx: 10,
        ty: 10,
        queue,
        active: overrides?.factoryActive ?? false,
      }],
    },
  };
}

// ─── Separator status ──────────────────────────────────────────────

describe('ARCH-07A: getSeparatorStatus', () => {
  it('returns "processing" when separator is active', () => {
    const state = makeStateWithSeparator({ separatorActive: true });
    const sep = state.economy.separators[0];
    expect(getSeparatorStatus(state, sep)).toBe('processing');
  });

  it('returns "blocked-no-raw" when raw < SEP_RAW_COST', () => {
    const state = makeStateWithSeparator({ raw: 5 });
    const sep = state.economy.separators[0];
    expect(getSeparatorStatus(state, sep)).toBe('blocked-no-raw');
  });

  it('returns "blocked-matter-cap" when matter cap would be exceeded', () => {
    // matter + SEP_MATTER_YIELD > matterCap
    const state = makeStateWithSeparator({ raw: 100, matter: 195, matterCap: 200 });
    const sep = state.economy.separators[0];
    // 195 + 10 = 205 > 200
    expect(getSeparatorStatus(state, sep)).toBe('blocked-matter-cap');
  });

  it('returns "blocked-element-cap" when element cap would be exceeded', () => {
    const state = makeStateWithSeparator({ raw: 100, elementUnits: 199, elementCap: 200 });
    const sep = state.economy.separators[0];
    // 199 + 2 = 201 > 200
    expect(getSeparatorStatus(state, sep)).toBe('blocked-element-cap');
  });

  it('returns "blocked-power" when power is unavailable', () => {
    // Create a state where two other separators already consume all power
    const state = makeStateWithSeparator({ raw: 200, separatorActive: false });
    // Add two more separators before this one in build order (active = true)
    // These consume all HQ power (2 * 5 = 10)
    state.economy.separators.unshift(
      { tx: 5, ty: 5, progress: 0.3, active: true },
      { tx: 7, ty: 7, progress: 0.5, active: true },
    );
    state.mapData.buildings = [
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 7, ty: 7, type: 'separator' },
      { tx: 10, ty: 10, type: 'separator' },
    ];
    // Our separator at (10,10) is now at index 2, active: false
    const sep = state.economy.separators[2];
    // 2 active separators * 5 = 10 = all HQ power, no room for third
    expect(getSeparatorStatus(state, sep)).toBe('blocked-power');
  });

  it('returns "idle" when resources and power are available but separator is not active', () => {
    const state = makeStateWithSeparator({ raw: 100 });
    const sep = state.economy.separators[0];
    // Has resources, has power, but not active (might be transitioning)
    expect(getSeparatorStatus(state, sep)).toBe('idle');
  });

  it('checks conditions in order: raw → matter cap → element cap → power', () => {
    // Both raw and matter cap blocked — raw is reported first
    const state = makeStateWithSeparator({ raw: 5, matter: 195, matterCap: 200 });
    const sep = state.economy.separators[0];
    expect(getSeparatorStatus(state, sep)).toBe('blocked-no-raw');
  });
});

// ─── Factory status ────────────────────────────────────────────────

describe('ARCH-07A: getFactoryStatus', () => {
  it('returns "producing-builder" when factory is active with builder in queue', () => {
    const state = makeStateWithFactory({ factoryActive: true, queueUnitType: 'builder' });
    const factory = state.production.factories[0];
    expect(getFactoryStatus(state, factory)).toBe('producing-builder');
  });

  it('returns "producing-harvester" when factory is active with harvester in queue', () => {
    const state = makeStateWithFactory({ factoryActive: true, queueUnitType: 'harvester' });
    const factory = state.production.factories[0];
    expect(getFactoryStatus(state, factory)).toBe('producing-harvester');
  });

  it('returns "blocked-queue-full" when queue is at limit with all items completed', () => {
    const state = makeStateWithFactory();
    const factory = state.production.factories[0];
    // Both items completed — no unfinished item, so blocked-power does not apply;
    // the queue is simply full with items waiting to spawn.
    factory.queue = [
      { unitType: 'builder', elapsedMs: 15000, durationMs: 15000, progress: 1, completed: true },
      { unitType: 'harvester', elapsedMs: 20000, durationMs: 20000, progress: 1, completed: true },
    ];
    expect(getFactoryStatus(state, factory)).toBe('blocked-queue-full');
  });

  it('returns "blocked-no-matter" when nextUnitType cannot be afforded (matter)', () => {
    const state = makeStateWithFactory({ matter: 10 });
    const factory = state.production.factories[0];
    expect(getFactoryStatus(state, factory, 'builder')).toBe('blocked-no-matter');
  });

  it('returns "blocked-no-element" when nextUnitType cannot be afforded (element)', () => {
    const state = makeStateWithFactory({ elementUnits: 3 });
    const factory = state.production.factories[0];
    expect(getFactoryStatus(state, factory, 'builder')).toBe('blocked-no-element');
  });

  it('returns "blocked-power" when factory has item but is not active (power blocked)', () => {
    // Set up power-blocked factory: two active separators consume all power
    const state = makeStateWithFactory({ queueUnitType: 'builder', factoryActive: false });
    state.economy.separators.push(
      { tx: 5, ty: 5, progress: 0, active: true },
      { tx: 7, ty: 7, progress: 0, active: true },
    );
    state.mapData.buildings = [
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 7, ty: 7, type: 'separator' },
      { tx: 10, ty: 10, type: 'units-factory' },
    ];
    const factory = state.production.factories[0];
    expect(getFactoryStatus(state, factory)).toBe('blocked-power');
  });

  it('returns "blocked-power" when queue is full with unfinished item and factory is inactive (power blocked)', () => {
    // Queue full (2 items), first item unfinished, factory not active → blocked-power
    // This should report blocked-power (root cause) not blocked-queue-full (secondary symptom)
    const state = makeStateWithFactory({ factoryActive: false });
    // Add power-consuming separators to starve the factory
    state.economy.separators.push(
      { tx: 5, ty: 5, progress: 0, active: true },
      { tx: 7, ty: 7, progress: 0, active: true },
    );
    state.mapData.buildings = [
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 7, ty: 7, type: 'separator' },
      { tx: 10, ty: 10, type: 'units-factory' },
    ];
    const factory = state.production.factories[0];
    factory.queue = [
      { unitType: 'builder', elapsedMs: 5000, durationMs: 15000, progress: 0.33, completed: false },
      { unitType: 'harvester', elapsedMs: 0, durationMs: 20000, progress: 0, completed: false },
    ];
    expect(getFactoryStatus(state, factory)).toBe('blocked-power');
  });

  it('returns "idle" when factory has empty queue and no next unit type', () => {
    const state = makeStateWithFactory();
    const factory = state.production.factories[0];
    expect(getFactoryStatus(state, factory)).toBe('idle');
  });
});

// ─── Build block reason ────────────────────────────────────────────

describe('ARCH-07A: getBuildBlockReason', () => {
  it('returns null when builder is idle and matter is sufficient', () => {
    const state = makeStateWithSeparator({ matter: 200 });
    expect(getBuildBlockReason(state, 'separator')).toBeNull();
  });

  it('returns "no-idle-builder" when no idle builder exists', () => {
    const state = makeStateWithSeparator({ matter: 200 });
    // Make builder busy
    state.mapData.builders[0].busy = true;
    state.mapData.builders[0].phase = 'building';
    expect(getBuildBlockReason(state, 'separator')).toBe('no-idle-builder');
  });

  it('returns "insufficient-matter" when matter is too low', () => {
    const state = makeStateWithSeparator({ matter: 10 });
    expect(getBuildBlockReason(state, 'separator')).toBe('insufficient-matter');
  });

  it('prioritizes no-idle-builder over insufficient-matter', () => {
    const state = makeStateWithSeparator({ matter: 10 });
    state.mapData.builders[0].busy = true;
    state.mapData.builders[0].phase = 'building';
    expect(getBuildBlockReason(state, 'separator')).toBe('no-idle-builder');
  });
});

// ─── Production block reason ───────────────────────────────────────

describe('ARCH-07A: getProductionBlockReason', () => {
  it('returns null when factory exists with room and resources', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    expect(getProductionBlockReason(state, 'builder')).toBeNull();
  });

  it('returns "no-factory" when no factory exists', () => {
    const state = makeStateWithFactory();
    state.production.factories = [];
    expect(getProductionBlockReason(state, 'builder')).toBe('no-factory');
  });

  it('returns "queue-full" when all factory queues are full', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 100 });
    const factory = state.production.factories[0];
    factory.queue = [
      { unitType: 'builder', elapsedMs: 5000, durationMs: 15000, progress: 0.33, completed: false },
      { unitType: 'harvester', elapsedMs: 0, durationMs: 20000, progress: 0, completed: false },
    ];
    expect(getProductionBlockReason(state, 'builder')).toBe('queue-full');
  });

  it('returns "insufficient-matter" when matter is too low for builder', () => {
    const state = makeStateWithFactory({ matter: 10 });
    expect(getProductionBlockReason(state, 'builder')).toBe('insufficient-matter');
  });

  it('returns "insufficient-matter" when matter is too low for harvester', () => {
    const state = makeStateWithFactory({ matter: 30 });
    expect(getProductionBlockReason(state, 'harvester')).toBe('insufficient-matter');
  });

  it('returns "insufficient-element" when element is too low', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 3 });
    expect(getProductionBlockReason(state, 'builder')).toBe('insufficient-element');
  });

  it('checks reasons in order: factory → queue → matter → element', () => {
    // No factory AND no matter — factory reason comes first
    const state = makeStateWithFactory({ matter: 5 });
    state.production.factories = [];
    expect(getProductionBlockReason(state, 'builder')).toBe('no-factory');
  });
});

// ─── Label formatting ──────────────────────────────────────────────

describe('ARCH-07A: label formatting', () => {
  it('separatorStatusLabel covers all statuses', () => {
    const statuses: SeparatorStatus[] = [
      'idle', 'processing', 'blocked-no-raw', 'blocked-matter-cap',
      'blocked-element-cap', 'blocked-power',
    ];
    for (const s of statuses) {
      expect(separatorStatusLabel(s).length).toBeGreaterThan(0);
    }
  });

  it('factoryStatusLabel covers all statuses', () => {
    const statuses: FactoryStatus[] = [
      'idle', 'producing-builder', 'producing-harvester',
      'blocked-no-matter', 'blocked-no-element', 'blocked-queue-full', 'blocked-power',
    ];
    for (const s of statuses) {
      expect(factoryStatusLabel(s).length).toBeGreaterThan(0);
    }
  });

  it('buildBlockLabel covers all reasons', () => {
    const reasons: BuildBlockReason[] = ['no-idle-builder', 'insufficient-matter'];
    for (const r of reasons) {
      expect(buildBlockLabel(r).length).toBeGreaterThan(0);
    }
  });

  it('productionBlockLabel covers all reasons', () => {
    const reasons: ProductionBlockReason[] = [
      'no-factory', 'queue-full', 'insufficient-matter', 'insufficient-element',
    ];
    for (const r of reasons) {
      expect(productionBlockLabel(r).length).toBeGreaterThan(0);
    }
  });

  it('harvesterStatusLabel covers all statuses', () => {
    const statuses: HarvesterStatus[] = [
      'idle', 'moving-to-resource', 'gathering', 'returning-to-hq',
      'unloading', 'manual-move',
      'blocked-no-resources', 'blocked-no-approach-path',
      'blocked-no-path-to-hq', 'blocked-raw-storage-full',
    ];
    for (const s of statuses) {
      expect(harvesterStatusLabel(s).length).toBeGreaterThan(0);
    }
  });
});

// ─── Harvester status (FIX-02) ──────────────────────────────────────

describe('FIX-02: getHarvesterStatus', () => {
  function makeHarvester(overrides?: Partial<HarvesterState>): HarvesterState {
    return {
      id: 'test-h1',
      ftx: 5,
      fty: 5,
      faction: 'cyan',
      phase: 'idle',
      targetResourceId: null,
      cargoRaw: 0,
      cargoCapacity: 20,
      gatherTimer: 0,
      unloadTimer: 0,
      speedTilesPerSecond: 2.5,
      ...overrides,
    };
  }

  it('returns phase when not blocked', () => {
    expect(getHarvesterStatus(makeHarvester({ phase: 'idle' }))).toBe('idle');
    expect(getHarvesterStatus(makeHarvester({ phase: 'moving-to-resource' }))).toBe('moving-to-resource');
    expect(getHarvesterStatus(makeHarvester({ phase: 'gathering' }))).toBe('gathering');
    expect(getHarvesterStatus(makeHarvester({ phase: 'returning-to-hq' }))).toBe('returning-to-hq');
    expect(getHarvesterStatus(makeHarvester({ phase: 'unloading' }))).toBe('unloading');
    expect(getHarvesterStatus(makeHarvester({ phase: 'manual-move' }))).toBe('manual-move');
  });

  it('returns blocked-no-resources when blockedReason is "no-resources"', () => {
    const h = makeHarvester({ phase: 'idle', blockedReason: 'no-resources' });
    expect(getHarvesterStatus(h)).toBe('blocked-no-resources');
  });

  it('returns blocked-no-approach-path when blockedReason is "no-approach-path"', () => {
    const h = makeHarvester({ phase: 'idle', blockedReason: 'no-approach-path' });
    expect(getHarvesterStatus(h)).toBe('blocked-no-approach-path');
  });

  it('returns blocked-no-path-to-hq when blockedReason is "no-path-to-hq"', () => {
    const h = makeHarvester({ phase: 'returning-to-hq', blockedReason: 'no-path-to-hq' });
    expect(getHarvesterStatus(h)).toBe('blocked-no-path-to-hq');
  });

  it('returns blocked-raw-storage-full when blockedReason is "raw-storage-full"', () => {
    const h = makeHarvester({ phase: 'unloading', blockedReason: 'raw-storage-full' });
    expect(getHarvesterStatus(h)).toBe('blocked-raw-storage-full');
  });

  it('blockedReason takes precedence over phase', () => {
    // Even if phase is 'returning-to-hq', the blocked reason is shown
    const h = makeHarvester({ phase: 'returning-to-hq', blockedReason: 'no-resources' });
    expect(getHarvesterStatus(h)).toBe('blocked-no-resources');
  });
});

describe('FIX-02: isHarvesterBlocked', () => {
  it('returns true for blocked statuses', () => {
    expect(isHarvesterBlocked('blocked-no-resources')).toBe(true);
    expect(isHarvesterBlocked('blocked-no-approach-path')).toBe(true);
    expect(isHarvesterBlocked('blocked-no-path-to-hq')).toBe(true);
    expect(isHarvesterBlocked('blocked-raw-storage-full')).toBe(true);
  });

  it('returns false for non-blocked statuses', () => {
    expect(isHarvesterBlocked('idle')).toBe(false);
    expect(isHarvesterBlocked('moving-to-resource')).toBe(false);
    expect(isHarvesterBlocked('gathering')).toBe(false);
    expect(isHarvesterBlocked('returning-to-hq')).toBe(false);
    expect(isHarvesterBlocked('unloading')).toBe(false);
    expect(isHarvesterBlocked('manual-move')).toBe(false);
  });
});
