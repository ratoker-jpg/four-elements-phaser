import { describe, it, expect } from 'vitest';
import { startUnitProduction, cancelFactoryQueueItem } from '../state/production';
import { updateGameState } from '../state/updateGameState';
import { updateConstructionSiteProgress, placeConstructionSite } from '../state/construction';
import { createInitialState } from '../state/createInitialState';
import type { GameState, MapData, EconomyState } from '../state/types';
import {
  QUEUE_LIMIT,
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  BUILDER_PRODUCTION_DURATION_MS,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_DURATION_MS,
  WASP_CHASSIS_MATTER_COST,
  WASP_CHASSIS_ELEMENT_COST,
  WASP_CHASSIS_PRODUCTION_DURATION_MS,
  SMOKY_WEAPON_MATTER_COST,
  SMOKY_WEAPON_ELEMENT_COST,
  SMOKY_WEAPON_PRODUCTION_DURATION_MS,
  WASP_SMOKY_TOTAL_MATTER_COST,
  WASP_SMOKY_TOTAL_ELEMENT_COST,
  WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS,
  HQ_BASE_POWER,
  SEPARATOR_ACTIVE_POWER_CONSUMPTION,
  UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION,
  DEFAULT_UNIT_CAP,
} from '../state/types';
import { BUILDING_CONFIG } from '../state/construction';
import { createInitialVisionState } from '../state/visibility';
// ─── Test helpers ──────────────────────────────────────────────────

/**
 * Build a minimal GameState with a units-factory already in production.factories.
 */
function makeStateWithFactory(overrides?: {
  matter?: number;
  elementUnits?: number;
  raw?: number;
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
    builders: [],
    constructionSites: [],
  };

  const economy: EconomyState = {
    raw: overrides?.raw ?? 100,
    matter: overrides?.matter ?? 200,
    elements: { cyan: overrides?.elementUnits ?? 50, green: 0, yellow: 0, purple: 0 },
    powerGenerated: HQ_BASE_POWER,
    powerConsumed: 0,
    separators: [],
    rawCap: 200,
    matterCap: 200,
    elementCap: 200,
  };

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
    economy,
    hqPosition: { tx: 1, ty: 1 },
    nextConstructionId: 0,
    production: {
      factories: [{
        tx: 10,
        ty: 10,
        queue: [],
        active: false,
      }],
    },
    vision: createInitialVisionState(48, 48),
  };
}

// ─── Production constants ──────────────────────────────────────────

describe('ARCH-01F: production constants', () => {
  it('QUEUE_LIMIT is 2', () => {
    expect(QUEUE_LIMIT).toBe(2);
  });

  it('builder cost is 40 matter + 10 elementUnits + 15000ms', () => {
    expect(BUILDER_PRODUCTION_MATTER_COST).toBe(40);
    expect(BUILDER_PRODUCTION_ELEMENT_COST).toBe(10);
    expect(BUILDER_PRODUCTION_DURATION_MS).toBe(15000);
  });

  it('harvester cost is 50 matter + 10 elementUnits + 20000ms', () => {
    expect(HARVESTER_PRODUCTION_MATTER_COST).toBe(50);
    expect(HARVESTER_PRODUCTION_ELEMENT_COST).toBe(10);
    expect(HARVESTER_PRODUCTION_DURATION_MS).toBe(20000);
  });
});

// ─── Reserved modular combat constants ─────────────────────────────

describe('ARCH-01F: reserved modular combat constants', () => {
  it('wasp chassis = 20 matter + 5 elementUnits + 7000ms', () => {
    expect(WASP_CHASSIS_MATTER_COST).toBe(20);
    expect(WASP_CHASSIS_ELEMENT_COST).toBe(5);
    expect(WASP_CHASSIS_PRODUCTION_DURATION_MS).toBe(7000);
  });

  it('smoky weapon = 25 matter + 5 elementUnits + 18000ms', () => {
    expect(SMOKY_WEAPON_MATTER_COST).toBe(25);
    expect(SMOKY_WEAPON_ELEMENT_COST).toBe(5);
    expect(SMOKY_WEAPON_PRODUCTION_DURATION_MS).toBe(18000);
  });

  it('total wasp+smoky = 45 matter + 10 elementUnits + 25000ms', () => {
    expect(WASP_SMOKY_TOTAL_MATTER_COST).toBe(45);
    expect(WASP_SMOKY_TOTAL_ELEMENT_COST).toBe(10);
    expect(WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS).toBe(25000);
  });
});

// ─── Initial production state ──────────────────────────────────────

describe('ARCH-01F: initial production state', () => {
  it('initial production state has no factories by default', () => {
    const state = createInitialState();
    expect(state.production.factories).toEqual([]);
  });

  it('existing units-factory building initializes a factory runtime state', () => {
    const mapData: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand')),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [{ tx: 20, ty: 20, type: 'units-factory' }],
      builders: [{ id: 'builder-0', tx: 5, ty: 5, busy: false, phase: 'idle', path: [], pathIndex: 0, ftx: 5, fty: 5, targetTx: 5, targetTy: 5, assignedSiteId: -1 }],
      constructionSites: [],
    };

    const state = createInitialState(mapData);
    expect(state.production.factories.length).toBe(1);
    expect(state.production.factories[0].tx).toBe(20);
    expect(state.production.factories[0].ty).toBe(20);
    expect(state.production.factories[0].queue).toEqual([]);
    expect(state.production.factories[0].active).toBe(false);
  });
});

// ─── Units-factory building config ─────────────────────────────────

describe('ARCH-01F: units-factory config', () => {
  it('units-factory config is costMatter 120 / buildTimeMs 40000 / footprint 2x2', () => {
    const config = BUILDING_CONFIG['units-factory'];
    expect(config).toBeDefined();
    expect(config!.costMatter).toBe(120);
    expect(config!.buildTimeMs).toBe(40000);
    expect(config!.footprintW).toBe(2);
    expect(config!.footprintH).toBe(2);
  });
});

// ─── Construction completion registers factory ─────────────────────

describe('ARCH-01F: construction completion registers units-factory', () => {
  it('newly completed units-factory is registered into production.factories', () => {
    const state = makeStateWithFactory({ matter: 500 });
    // Remove the pre-existing factory for clean testing
    state.production.factories = [];
    // Add a builder
    state.mapData.builders.push({
      id: 'builder-spawned',
      tx: 9, ty: 10,
      busy: false, phase: 'idle',
      path: [], pathIndex: 0,
      ftx: 9, fty: 10,
      targetTx: 9, targetTy: 10,
      assignedSiteId: -1,
    });

    const factoriesBefore = state.production.factories.length;

    // Place a construction site
    const result = placeConstructionSite(state, 'units-factory', 14, 14);
    expect(result.ok).toBe(true);

    // Should NOT be registered yet
    expect(state.production.factories.length).toBe(factoriesBefore);

    // Set up builder for construction
    const builder = state.mapData.builders[0];
    builder.busy = true;
    builder.phase = 'building';
    builder.assignedSiteId = 0;
    const site = state.mapData.constructionSites[0];
    site.builderIndex = 0;
    site.pending = false;

    // Complete construction
    for (let i = 0; i < 200; i++) {
      updateConstructionSiteProgress(state, 'site-0', 200);
    }

    expect(state.production.factories.length).toBe(factoriesBefore + 1);
    const newFactory = state.production.factories[state.production.factories.length - 1];
    expect(newFactory.tx).toBe(14);
    expect(newFactory.ty).toBe(14);
    expect(newFactory.queue).toEqual([]);
    expect(newFactory.active).toBe(false);
  });
});

// ─── startUnitProduction validation ────────────────────────────────

describe('ARCH-01F: startUnitProduction validation', () => {
  it('startUnitProduction fails if factory missing', () => {
    const state = makeStateWithFactory({ matter: 200 });
    state.production.factories = [];

    const result = startUnitProduction(state, 99, 99, 'builder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('factory-not-found');
    }
  });

  it('startUnitProduction fails if queue full', () => {
    const state = makeStateWithFactory({ matter: 200 });
    const factory = state.production.factories[0];

    // Fill the queue to limit
    factory.queue.push(
      { unitType: 'builder', elapsedMs: 0, durationMs: BUILDER_PRODUCTION_DURATION_MS, progress: 0, completed: false },
      { unitType: 'harvester', elapsedMs: 0, durationMs: HARVESTER_PRODUCTION_DURATION_MS, progress: 0, completed: false },
    );

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('queue-full');
    }
  });

  it('startUnitProduction fails if matter insufficient', () => {
    const state = makeStateWithFactory({ matter: 10, elementUnits: 50 });

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient-matter');
    }
  });

  it('startUnitProduction fails if active faction element is insufficient', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 3 });

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient-element');
    }
  });
});

// ─── startUnitProduction success ───────────────────────────────────

describe('ARCH-01F: startUnitProduction success', () => {
  it('startUnitProduction deducts matter and element, then queues builder', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    const matterBefore = state.economy.matter;
    const elementBefore = state.economy.elements.cyan;

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(true);

    expect(state.economy.matter).toBe(matterBefore - BUILDER_PRODUCTION_MATTER_COST);
    expect(state.economy.elements.cyan).toBe(elementBefore - BUILDER_PRODUCTION_ELEMENT_COST);

    const factory = state.production.factories[0];
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].unitType).toBe('builder');
    expect(factory.queue[0].durationMs).toBe(BUILDER_PRODUCTION_DURATION_MS);
    expect(factory.queue[0].progress).toBe(0);
    expect(factory.queue[0].completed).toBe(false);
  });

  it('startUnitProduction deducts matter and element, then queues harvester', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    const matterBefore = state.economy.matter;
    const elementBefore = state.economy.elements.cyan;

    const result = startUnitProduction(state, 10, 10, 'harvester');
    expect(result.ok).toBe(true);

    expect(state.economy.matter).toBe(matterBefore - HARVESTER_PRODUCTION_MATTER_COST);
    expect(state.economy.elements.cyan).toBe(elementBefore - HARVESTER_PRODUCTION_ELEMENT_COST);

    const factory = state.production.factories[0];
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].unitType).toBe('harvester');
    expect(factory.queue[0].durationMs).toBe(HARVESTER_PRODUCTION_DURATION_MS);
    expect(factory.queue[0].progress).toBe(0);
    expect(factory.queue[0].completed).toBe(false);
  });

  it('startUnitProduction does not mutate on failure', () => {
    const state = makeStateWithFactory({ matter: 5, elementUnits: 2 });
    const matterBefore = state.economy.matter;
    const elementBefore = state.economy.elements.cyan;

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);

    expect(state.economy.matter).toBe(matterBefore);
    expect(state.economy.elements.cyan).toBe(elementBefore);
    expect(state.production.factories[0].queue.length).toBe(0);
  });
});

// ─── Production tick: only first queue item progresses ──────────────

describe('ARCH-01F: only first queue item progresses', () => {
  it('only the first non-completed item progresses', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 100 });

    // Queue two items
    startUnitProduction(state, 10, 10, 'builder');
    startUnitProduction(state, 10, 10, 'harvester');

    const factory = state.production.factories[0];

    // Advance production via updateGameState
    updateGameState(state, 2000);

    // First item should have progressed
    expect(factory.queue[0].progress).toBeGreaterThan(0);
    // Second item should NOT have progressed
    expect(factory.queue[1].progress).toBe(0);
    expect(factory.queue[1].elapsedMs).toBe(0);
  });
});

// ─── Factory power behavior ────────────────────────────────────────

describe('ARCH-01F: factory power behavior', () => {
  it('factory consumes 4 power only while producing', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'builder');

    updateGameState(state, 200);

    const factory = state.production.factories[0];
    expect(factory.active).toBe(true);
  });

  it('factory does not consume power when queue empty', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });

    updateGameState(state, 200);

    const factory = state.production.factories[0];
    expect(factory.active).toBe(false);
  });

  it('factory does not consume power when completed item is waiting to spawn', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'builder');

    const factory = state.production.factories[0];
    // Manually set the item to completed and block spawn
    factory.queue[0].completed = true;
    factory.queue[0].progress = 1;
    factory.queue[0].elapsedMs = factory.queue[0].durationMs;

    // Block spawn by making map too small for factory position
    state.mapWidth = 1;
    state.mapHeight = 1;

    updateGameState(state, 200);

    // Factory should not be active (only completed items, no unfinished items)
    expect(factory.active).toBe(false);
  });

  it('production pauses when power is unavailable and progress is preserved', () => {
    // Set up: HQ power = 10, two active separators = 10 consumed, no power for factory
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50, raw: 100 });
    startUnitProduction(state, 10, 10, 'builder');

    // Add two separators that will consume all 10 power
    state.economy.separators.push(
      { tx: 5, ty: 5, progress: 0, active: false },
      { tx: 7, ty: 7, progress: 0, active: false },
    );
    // The separators come before the factory in building order
    state.mapData.buildings = [
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 7, ty: 7, type: 'separator' },
      { tx: 10, ty: 10, type: 'units-factory' },
    ];

    updateGameState(state, 200);

    // Both separators should be active, consuming 10 power
    expect(state.economy.separators[0].active).toBe(true);
    expect(state.economy.separators[1].active).toBe(true);
    // Factory should be paused (no power left)
    const factory = state.production.factories[0];
    expect(factory.active).toBe(false);

    // Progress should be preserved at 0 (never started)
    expect(factory.queue[0].progress).toBe(0);
  });

  it('production resumes when power becomes available', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50, raw: 100 });
    startUnitProduction(state, 10, 10, 'builder');

    // Two separators consume all power
    state.economy.separators.push(
      { tx: 5, ty: 5, progress: 0, active: false },
      { tx: 7, ty: 7, progress: 0, active: false },
    );
    state.mapData.buildings = [
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 7, ty: 7, type: 'separator' },
      { tx: 10, ty: 10, type: 'units-factory' },
    ];

    // Run with full power consumption from separators
    updateGameState(state, 200);
    const factory = state.production.factories[0];
    expect(factory.active).toBe(false);

    // Now add a power-plant: total power = 10 + 15 = 25
    state.mapData.buildings.push({ tx: 12, ty: 12, type: 'power-plant' });
    updateGameState(state, 200);

    // Factory should now have power
    expect(factory.active).toBe(true);
    expect(factory.queue[0].progress).toBeGreaterThan(0);
  });
});

// ─── Build-order priority ──────────────────────────────────────────

describe('ARCH-01F: build-order priority', () => {
  it('two older separators can block a later factory under HQ power 10', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50, raw: 100 });
    startUnitProduction(state, 10, 10, 'builder');

    // Set up buildings in order: separator, separator, units-factory
    state.economy.separators.push(
      { tx: 5, ty: 5, progress: 0, active: false },
      { tx: 7, ty: 7, progress: 0, active: false },
    );
    state.mapData.buildings = [
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 7, ty: 7, type: 'separator' },
      { tx: 10, ty: 10, type: 'units-factory' },
    ];

    updateGameState(state, 200);

    // Both separators get power (5+5=10), factory does not
    expect(state.economy.separators[0].active).toBe(true);
    expect(state.economy.separators[1].active).toBe(true);
    expect(state.production.factories[0].active).toBe(false);
    expect(state.economy.powerConsumed).toBe(2 * SEPARATOR_ACTIVE_POWER_CONSUMPTION);
  });

  it('factory before separators in build order gets power first', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50, raw: 100 });
    startUnitProduction(state, 10, 10, 'builder');

    // Set up buildings in order: units-factory, separator, separator
    // Factory comes first, gets power first
    state.economy.separators.push(
      { tx: 5, ty: 5, progress: 0, active: false },
      { tx: 7, ty: 7, progress: 0, active: false },
    );
    state.mapData.buildings = [
      { tx: 10, ty: 10, type: 'units-factory' },
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 7, ty: 7, type: 'separator' },
    ];

    updateGameState(state, 200);

    // Factory gets 4 power, first separator gets 5 power = 9 used
    // Second separator: 10 - 4 - 5 = 1 < 5 → blocked
    expect(state.production.factories[0].active).toBe(true);
    expect(state.economy.separators[0].active).toBe(true);
    expect(state.economy.separators[1].active).toBe(false);
    expect(state.economy.powerConsumed).toBe(UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION + SEPARATOR_ACTIVE_POWER_CONSUMPTION);
  });
});

// ─── Production completion and spawning ─────────────────────────────

describe('ARCH-01F: production completion and spawning', () => {
  it('completed builder item spawns a builder near factory and leaves queue', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'builder');

    const factory = state.production.factories[0];
    const buildersBefore = state.mapData.builders.length;

    // Advance enough to complete builder production (15000ms)
    for (let i = 0; i < 75; i++) {
      updateGameState(state, 200);
    }

    // Item should be completed and spawned
    expect(factory.queue.length).toBe(0);
    // A builder should have been spawned
    expect(state.mapData.builders.length).toBe(buildersBefore + 1);

    // Check the spawned builder is near the factory
    const newBuilder = state.mapData.builders[state.mapData.builders.length - 1];
    const dx = Math.abs(newBuilder.tx - 10);
    const dy = Math.abs(newBuilder.ty - 10);
    expect(dx).toBeLessThanOrEqual(3);
    expect(dy).toBeLessThanOrEqual(3);
  });

  it('completed harvester item spawns a harvester near factory and leaves queue', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'harvester');

    const factory = state.production.factories[0];
    const harvestersBefore = state.harvesters.length;

    // Advance enough to complete harvester production (20000ms)
    for (let i = 0; i < 100; i++) {
      updateGameState(state, 200);
    }

    // Item should be completed and spawned
    expect(factory.queue.length).toBe(0);
    // A harvester should have been spawned
    expect(state.harvesters.length).toBe(harvestersBefore + 1);

    // Check the spawned harvester is near the factory
    const newHarvester = state.harvesters[state.harvesters.length - 1];
    const dx = Math.abs(Math.round(newHarvester.ftx) - 10);
    const dy = Math.abs(Math.round(newHarvester.fty) - 10);
    expect(dx).toBeLessThanOrEqual(3);
    expect(dy).toBeLessThanOrEqual(3);
  });

  it('builder production completes with one updateGameState(state, BUILDER_PRODUCTION_DURATION_MS)', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'builder');

    const factory = state.production.factories[0];
    const buildersBefore = state.mapData.builders.length;

    // Single call with full builder duration
    updateGameState(state, BUILDER_PRODUCTION_DURATION_MS);

    // Item should be completed and spawned
    expect(factory.queue.length).toBe(0);
    expect(state.mapData.builders.length).toBe(buildersBefore + 1);
  });

  it('harvester production completes with one updateGameState(state, HARVESTER_PRODUCTION_DURATION_MS)', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'harvester');

    const factory = state.production.factories[0];
    const harvestersBefore = state.harvesters.length;

    // Single call with full harvester duration
    updateGameState(state, HARVESTER_PRODUCTION_DURATION_MS);

    // Item should be completed and spawned
    expect(factory.queue.length).toBe(0);
    expect(state.harvesters.length).toBe(harvestersBefore + 1);
  });

  it('if spawn area is blocked, completed item stays queued and retries', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'builder');

    const factory = state.production.factories[0];

    // Make the map tiny so there's no room to spawn
    state.mapWidth = 1;
    state.mapHeight = 1;

    // Advance enough to complete production
    for (let i = 0; i < 75; i++) {
      updateGameState(state, 200);
    }

    // Item should be completed but still in queue (can't spawn)
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].completed).toBe(true);

    // Now expand the map and retry
    state.mapWidth = 30;
    state.mapHeight = 30;
    updateGameState(state, 200);

    // Now it should be able to spawn
    expect(factory.queue.length).toBe(0);
    expect(state.mapData.builders.length).toBe(1);
  });
});

// ─── Power consumption via updateGameState ─────────────────────────

describe('ARCH-01F: power consumption via updateGameState', () => {
  it('active factory power is included in powerConsumed', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });
    startUnitProduction(state, 10, 10, 'builder');

    updateGameState(state, 200);

    expect(state.economy.powerConsumed).toBe(UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION);
    expect(state.production.factories[0].active).toBe(true);
  });

  it('empty factory does not add to powerConsumed', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50 });

    updateGameState(state, 200);

    expect(state.economy.powerConsumed).toBe(0);
    expect(state.production.factories[0].active).toBe(false);
  });

  it('factory and separator power consumption combine correctly', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 50, raw: 100 });
    startUnitProduction(state, 10, 10, 'builder');

    // Add one separator before the factory in build order
    state.economy.separators.push({ tx: 5, ty: 5, progress: 0, active: false });
    state.mapData.buildings = [
      { tx: 5, ty: 5, type: 'separator' },
      { tx: 10, ty: 10, type: 'units-factory' },
    ];

    updateGameState(state, 200);

    // Both should be active: 5 + 4 = 9 <= 10
    expect(state.economy.separators[0].active).toBe(true);
    expect(state.production.factories[0].active).toBe(true);
    expect(state.economy.powerConsumed).toBe(SEPARATOR_ACTIVE_POWER_CONSUMPTION + UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION);
  });
});

// ─── Queue limit enforcement ───────────────────────────────────────

describe('ARCH-01F: queue limit', () => {
  it('cannot exceed QUEUE_LIMIT items in queue', () => {
    const state = makeStateWithFactory({ matter: 200, elementUnits: 100 });

    // First two should succeed
    const result1 = startUnitProduction(state, 10, 10, 'builder');
    const result2 = startUnitProduction(state, 10, 10, 'harvester');
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    // Third should fail
    const result3 = startUnitProduction(state, 10, 10, 'builder');
    expect(result3.ok).toBe(false);
    if (!result3.ok) {
      expect(result3.reason).toBe('queue-full');
    }
  });
});

// ─── Unit cap enforcement (FIX-03) ─────────────────────────────────

describe('FIX-03: unit cap enforcement', () => {
  it('DEFAULT_UNIT_CAP is 10', () => {
    expect(DEFAULT_UNIT_CAP).toBe(10);
  });

  it('startUnitProduction fails with unit-cap-reached when unit count equals cap', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Fill up to cap with builders and harvesters
    for (let i = 0; i < DEFAULT_UNIT_CAP; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unit-cap-reached');
    }
  });

  it('startUnitProduction fails with unit-cap-reached when unit count exceeds cap', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Add 11 builders (1 more than cap)
    for (let i = 0; i < DEFAULT_UNIT_CAP + 1; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    const result = startUnitProduction(state, 10, 10, 'harvester');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unit-cap-reached');
    }
  });

  it('startUnitProduction succeeds when unit count is below cap', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Add 9 units (1 below cap of 10)
    for (let i = 0; i < 9; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(true);
  });

  it('startUnitProduction counts both builders and harvesters toward cap', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Add 5 builders and 5 harvesters = 10 = cap
    for (let i = 0; i < 5; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }
    for (let i = 0; i < 5; i++) {
      state.harvesters.push({
        id: `h-cap-${i}`,
        ftx: 15 + i, fty: 5,
        faction: 'cyan',
        phase: 'idle',
        targetResourceId: null,
        cargoRaw: 0,
        cargoCapacity: 20,
        gatherTimer: 0,
        unloadTimer: 0,
        speedTilesPerSecond: 2.5,
      });
    }

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unit-cap-reached');
    }
  });

  it('unit-cap-rejected production does not deduct resources', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Fill cap
    for (let i = 0; i < DEFAULT_UNIT_CAP; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    const matterBefore = state.economy.matter;
    const elementBefore = state.economy.elements.cyan;

    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);

    // Resources should not be deducted
    expect(state.economy.matter).toBe(matterBefore);
    expect(state.economy.elements.cyan).toBe(elementBefore);
    expect(state.production.factories[0].queue.length).toBe(0);
  });

  it('unit cap check comes after element check but before cost deduction', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 3 });

    // Fill cap
    for (let i = 0; i < DEFAULT_UNIT_CAP; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    // Both insufficient-element and unit-cap-reached apply,
    // but insufficient-element is checked first
    const result = startUnitProduction(state, 10, 10, 'builder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient-element');
    }
  });
});

// ─── Spawn-time cap recheck (FIX-03 review fixup) ──────────────────

describe('FIX-03: spawn-time cap recheck', () => {
  it('at 9/10 units with two completed queue items, update spawns only one', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Fill 9 active units (1 below cap)
    for (let i = 0; i < 9; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    // Queue two items and mark them as completed (simulating production done)
    const factory = state.production.factories[0];
    factory.queue.push(
      { unitType: 'builder', elapsedMs: BUILDER_PRODUCTION_DURATION_MS, durationMs: BUILDER_PRODUCTION_DURATION_MS, progress: 1, completed: true },
      { unitType: 'harvester', elapsedMs: HARVESTER_PRODUCTION_DURATION_MS, durationMs: HARVESTER_PRODUCTION_DURATION_MS, progress: 1, completed: true },
    );

    // Run one update tick
    updateGameState(state, 200);

    // Only one should have spawned (9 + 1 = 10 = cap), second stays in queue
    expect(state.mapData.builders.length + state.harvesters.length).toBe(DEFAULT_UNIT_CAP);
    // Second completed item should still be in queue
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].completed).toBe(true);
    expect(factory.queue[0].unitType).toBe('harvester');
  });

  it('at 10/10 units with one completed queue item, update does not spawn and item remains', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Fill to cap with 10 active units
    for (let i = 0; i < DEFAULT_UNIT_CAP; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    // Queue one completed item (simulating production done before cap check)
    const factory = state.production.factories[0];
    factory.queue.push(
      { unitType: 'builder', elapsedMs: BUILDER_PRODUCTION_DURATION_MS, durationMs: BUILDER_PRODUCTION_DURATION_MS, progress: 1, completed: true },
    );

    // Run one update tick
    updateGameState(state, 200);

    // Should NOT have spawned — still at cap
    expect(state.mapData.builders.length).toBe(DEFAULT_UNIT_CAP);
    // Completed item stays in queue
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].completed).toBe(true);
  });

  it('completed item spawns later when cap room becomes available', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Fill to cap with 10 active units
    for (let i = 0; i < DEFAULT_UNIT_CAP; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    // Queue one completed item
    const factory = state.production.factories[0];
    factory.queue.push(
      { unitType: 'builder', elapsedMs: BUILDER_PRODUCTION_DURATION_MS, durationMs: BUILDER_PRODUCTION_DURATION_MS, progress: 1, completed: true },
    );

    // Update: spawn blocked by cap
    updateGameState(state, 200);
    expect(factory.queue.length).toBe(1);
    expect(state.mapData.builders.length).toBe(DEFAULT_UNIT_CAP);

    // Remove a unit to make room
    state.mapData.builders.pop();

    // Update again: spawn should now succeed
    updateGameState(state, 200);
    expect(factory.queue.length).toBe(0);
    expect(state.mapData.builders.length).toBe(DEFAULT_UNIT_CAP);
  });
});

// ─── Factory queue cancel (FIX-04) ──────────────────────────────────

describe('FIX-04: cancelFactoryQueueItem', () => {
  it('cancel removes the first queue item', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });
    startUnitProduction(state, 10, 10, 'builder');
    startUnitProduction(state, 10, 10, 'harvester');

    const result = cancelFactoryQueueItem(state, 10, 10, 0);
    expect(result.ok).toBe(true);

    const factory = state.production.factories[0];
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].unitType).toBe('harvester');
  });

  it('cancel removes the second queue item', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });
    startUnitProduction(state, 10, 10, 'builder');
    startUnitProduction(state, 10, 10, 'harvester');

    const result = cancelFactoryQueueItem(state, 10, 10, 1);
    expect(result.ok).toBe(true);

    const factory = state.production.factories[0];
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].unitType).toBe('builder');
  });

  it('cancel fails with factory-not-found for missing factory', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });
    startUnitProduction(state, 10, 10, 'builder');

    const result = cancelFactoryQueueItem(state, 99, 99, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('factory-not-found');
    }

    // Queue unchanged
    expect(state.production.factories[0].queue.length).toBe(1);
  });

  it('cancel fails with invalid-queue-index for negative index', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });
    startUnitProduction(state, 10, 10, 'builder');

    const result = cancelFactoryQueueItem(state, 10, 10, -1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-queue-index');
    }
  });

  it('cancel fails with invalid-queue-index for index >= queue.length', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });
    startUnitProduction(state, 10, 10, 'builder');

    const result = cancelFactoryQueueItem(state, 10, 10, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-queue-index');
    }
  });

  it('cancel does not refund resources', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });
    const matterBefore = state.economy.matter;
    const elementBefore = state.economy.elements.cyan;

    startUnitProduction(state, 10, 10, 'builder');

    // Matter/element were deducted at enqueue
    expect(state.economy.matter).toBe(matterBefore - BUILDER_PRODUCTION_MATTER_COST);
    expect(state.economy.elements.cyan).toBe(elementBefore - BUILDER_PRODUCTION_ELEMENT_COST);

    cancelFactoryQueueItem(state, 10, 10, 0);

    // No refund — matter/element stay the same as after enqueue
    expect(state.economy.matter).toBe(matterBefore - BUILDER_PRODUCTION_MATTER_COST);
    expect(state.economy.elements.cyan).toBe(elementBefore - BUILDER_PRODUCTION_ELEMENT_COST);
  });

  it('cancel works for completed blocked items', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });

    // Fill cap
    for (let i = 0; i < DEFAULT_UNIT_CAP; i++) {
      state.mapData.builders.push({
        id: `builder-cap-${i}`,
        tx: 5 + i, ty: 5,
        busy: false, phase: 'idle',
        path: [], pathIndex: 0,
        ftx: 5 + i, fty: 5,
        targetTx: 5 + i, targetTy: 5,
        assignedSiteId: -1,
      });
    }

    // Add completed item blocked by cap
    const factory = state.production.factories[0];
    factory.queue.push(
      { unitType: 'builder', elapsedMs: BUILDER_PRODUCTION_DURATION_MS, durationMs: BUILDER_PRODUCTION_DURATION_MS, progress: 1, completed: true },
    );

    const result = cancelFactoryQueueItem(state, 10, 10, 0);
    expect(result.ok).toBe(true);
    expect(factory.queue.length).toBe(0);
  });

  it('cancel in-progress item allows next item to progress', () => {
    const state = makeStateWithFactory({ matter: 500, elementUnits: 200 });
    startUnitProduction(state, 10, 10, 'builder');
    startUnitProduction(state, 10, 10, 'harvester');

    const factory = state.production.factories[0];

    // Cancel the first (in-progress) item
    const result = cancelFactoryQueueItem(state, 10, 10, 0);
    expect(result.ok).toBe(true);

    // Second item should now be at index 0
    expect(factory.queue.length).toBe(1);
    expect(factory.queue[0].unitType).toBe('harvester');

    // Run update — harvester should start progressing
    updateGameState(state, 200);
    expect(factory.queue[0].progress).toBeGreaterThan(0);
  });
});
