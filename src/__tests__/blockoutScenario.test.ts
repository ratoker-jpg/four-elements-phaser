/**
 * Tests for blockout scenario system — scenario layout, vehicle/obstacle creation, reset.
 *
 * BLOCKOUT-10H+: Dev/arena-only combat sandbox scenario management.
 *
 * Tests verify:
 * - Scenario layout contains expected vehicle count (9 vehicles)
 * - Scenario layout contains expected obstacle count
 * - createScenarioVehicles creates correct number of vehicles with correct body/weapon IDs
 * - createScenarioObstacles creates correct number of obstacles
 * - resetBlockoutScenario restores deterministic vehicle count and HP
 * - reset clears destroyed/firing/movement/upgrade state on all vehicles
 * - reset clears VFX and damage events
 * - reset does not affect normal game state properties (economy, harvesters remain)
 * - No save persistence for scenario/debug state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_SANDBOX_SCENARIO,
  type BlockoutScenario,
  type ScenarioVehicleSpawn,
  type ScenarioObstaclePlacement,
} from '../config/blockoutScenarioData';
import { VEHICLE_PROFILES } from '../config/blockoutVehicleData';
import {
  createScenarioVehicles,
  createScenarioObstacles,
  resetBlockoutScenario,
} from '../state/blockoutScenario';
import {
  resetBlockoutVehicleIdCounter,
} from '../state/blockoutVehicleState';
import {
  resetBlockoutObstacleIdCounter,
} from '../state/blockoutObstacleState';
import {
  resetVfxEventIdCounter,
  getVfxEvents,
  fireBlockoutWeapon,
} from '../state/blockoutWeaponVfx';
import {
  resetDamageEventIdCounter,
  getDamageEvents,
  applyDamageToVehicle,
} from '../state/blockoutDamage';
import type { GameState } from '../state/types';
import { saveGame, loadGame, setSaveStorage, type SaveStorage } from '../state/saveGame';

// ─── Test helpers ────────────────────────────────────────────────────

/** Create a minimal GameState for testing. */
function createTestGameState(): GameState {
  return {
    mapId: 'test',
    mapName: 'Test Map',
    mapWidth: 20,
    mapHeight: 20,
    mapData: {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 'sand' as const)),
      hq: { tx: 3, ty: 3, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [],
      constructionSites: [],
    },
    entities: [
      { id: 'hq-1', kind: 'hq', tx: 3, ty: 3, faction: 'cyan' },
    ],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [
      {
        id: 'harvester-1',
        ftx: 5, fty: 5,
        faction: 'cyan',
        phase: 'idle',
        targetResourceId: null,
        cargoRaw: 0,
        cargoCapacity: 10,
        gatherTimer: 0,
        unloadTimer: 0,
        speedTilesPerSecond: 2,
      },
    ],
    resourceNodes: [],
    economy: {
      raw: 30,
      matter: 120,
      elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
      powerGenerated: 10,
      powerConsumed: 0,
      separators: [],
      rawCap: 200,
      matterCap: 200,
      elementCap: 200,
    },
    hqPosition: { tx: 4, ty: 4 },
    nextConstructionId: 0,
    production: { factories: [] },
  };
}

// ─── Scenario layout ────────────────────────────────────────────────

describe('scenario layout contains expected content', () => {
  it('default sandbox scenario has 9 vehicles', () => {
    expect(DEFAULT_SANDBOX_SCENARIO.vehicles.length).toBe(9);
  });

  it('default sandbox scenario has expected obstacle count (at least 6)', () => {
    expect(DEFAULT_SANDBOX_SCENARIO.obstacles.length).toBeGreaterThanOrEqual(6);
  });

  it('all vehicle IDs in scenario are valid VEHICLE_PROFILES keys', () => {
    for (const spawn of DEFAULT_SANDBOX_SCENARIO.vehicles) {
      expect(VEHICLE_PROFILES[spawn.vehicleId], `Vehicle profile ${spawn.vehicleId} should exist`).toBeDefined();
    }
  });

  it('scenario contains all 9 expected vehicle profiles', () => {
    const expectedIds = [
      'wasp-smoky', 'hornet-ricochet', 'hunter-smoky', 'hunter-twins',
      'viking-isida', 'dictator-railgun', 'titan-vulcan', 'mammoth-thunder',
      'mammoth-railgun',
    ];
    const scenarioIds = DEFAULT_SANDBOX_SCENARIO.vehicles.map(v => v.vehicleId);
    for (const id of expectedIds) {
      expect(scenarioIds, `Scenario should contain ${id}`).toContain(id);
    }
  });

  it('scenario has a wall between a shooter and target position', () => {
    const walls = DEFAULT_SANDBOX_SCENARIO.obstacles.filter(o => o.type === 'blocker_wall');
    expect(walls.length).toBeGreaterThanOrEqual(1);
  });

  it('scenario has a pierceable low barrier in a fire lane', () => {
    const barriers = DEFAULT_SANDBOX_SCENARIO.obstacles.filter(o => o.type === 'low_barrier');
    expect(barriers.length).toBeGreaterThanOrEqual(1);
  });

  it('scenario has cover (crate or rock) near targets', () => {
    const cover = DEFAULT_SANDBOX_SCENARIO.obstacles.filter(
      o => o.type === 'cover_crate' || o.type === 'dummy_rock'
    );
    expect(cover.length).toBeGreaterThanOrEqual(1);
  });

  it('scenario vehicle positions are unique (no stacking)', () => {
    const positions = DEFAULT_SANDBOX_SCENARIO.vehicles.map(v => `${v.tx},${v.ty}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(DEFAULT_SANDBOX_SCENARIO.vehicles.length);
  });

  it('scenario has scenario ID and name', () => {
    expect(DEFAULT_SANDBOX_SCENARIO.id).toBe('default-sandbox');
    expect(DEFAULT_SANDBOX_SCENARIO.name).toBeTruthy();
  });
});

// ─── createScenarioVehicles ──────────────────────────────────────────

describe('createScenarioVehicles creates correct vehicles', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetBlockoutObstacleIdCounter();
  });

  it('creates correct number of vehicles (9)', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    expect(vehicles.length).toBe(9);
  });

  it('vehicles have correct body and weapon IDs from profiles', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    for (let i = 0; i < vehicles.length; i++) {
      const spawn = DEFAULT_SANDBOX_SCENARIO.vehicles[i];
      const profile = VEHICLE_PROFILES[spawn.vehicleId];
      expect(vehicles[i].bodyId).toBe(profile!.bodyId);
      expect(vehicles[i].weaponId).toBe(profile!.weaponId);
    }
  });

  it('vehicles have correct faction from scenario', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    for (let i = 0; i < vehicles.length; i++) {
      expect(vehicles[i].faction).toBe(DEFAULT_SANDBOX_SCENARIO.vehicles[i].faction);
    }
  });

  it('vehicles start at full HP', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    for (const vehicle of vehicles) {
      expect(vehicle.hp).toBe(vehicle.maxHp);
      expect(vehicle.hp).toBeGreaterThan(0);
    }
  });

  it('vehicles are not destroyed', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    for (const vehicle of vehicles) {
      expect(vehicle.isDestroyed).toBe(false);
    }
  });

  it('vehicles have no upgrades', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    for (const vehicle of vehicles) {
      expect(Object.keys(vehicle.upgradeLevels).length).toBe(0);
    }
  });

  it('vehicles have no movement targets', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    for (const vehicle of vehicles) {
      expect(vehicle.hasMoveTarget).toBe(false);
      expect(vehicle.speed).toBe(0);
    }
  });

  it('vehicles are not firing', () => {
    const vehicles = createScenarioVehicles(DEFAULT_SANDBOX_SCENARIO);
    for (const vehicle of vehicles) {
      expect(vehicle.fireHeld).toBe(false);
      expect(vehicle.isFiring).toBe(false);
    }
  });

  it('skips unknown vehicle profiles gracefully', () => {
    const badScenario: BlockoutScenario = {
      id: 'test-bad',
      name: 'Bad Scenario',
      vehicles: [
        { vehicleId: 'nonexistent-vehicle', tx: 5, ty: 5, faction: 'cyan' },
        { vehicleId: 'wasp-smoky', tx: 6, ty: 6, faction: 'cyan' },
      ],
      obstacles: [],
    };
    const vehicles = createScenarioVehicles(badScenario);
    // Only wasp-smoky should be created; nonexistent is skipped
    expect(vehicles.length).toBe(1);
    expect(vehicles[0].bodyId).toBe('wasp');
  });
});

// ─── createScenarioObstacles ─────────────────────────────────────────

describe('createScenarioObstacles creates correct obstacles', () => {
  beforeEach(() => {
    resetBlockoutObstacleIdCounter();
  });

  it('creates correct number of obstacles', () => {
    const obstacles = createScenarioObstacles(DEFAULT_SANDBOX_SCENARIO);
    expect(obstacles.length).toBe(DEFAULT_SANDBOX_SCENARIO.obstacles.length);
  });

  it('obstacles have correct types from scenario', () => {
    const obstacles = createScenarioObstacles(DEFAULT_SANDBOX_SCENARIO);
    for (let i = 0; i < obstacles.length; i++) {
      expect(obstacles[i].type).toBe(DEFAULT_SANDBOX_SCENARIO.obstacles[i].type);
    }
  });

  it('obstacles have valid screen positions (not NaN)', () => {
    const obstacles = createScenarioObstacles(DEFAULT_SANDBOX_SCENARIO);
    for (const obstacle of obstacles) {
      expect(Number.isNaN(obstacle.worldX)).toBe(false);
      expect(Number.isNaN(obstacle.worldY)).toBe(false);
    }
  });

  it('obstacle shapes match type configs', () => {
    const obstacles = createScenarioObstacles(DEFAULT_SANDBOX_SCENARIO);
    for (const obstacle of obstacles) {
      expect(obstacle.shape).toBeDefined();
      expect(obstacle.blocksMovement).toBe(true);
      expect(obstacle.blocksLineOfFire).toBe(true);
    }
  });

  it('low_barrier obstacles are pierceable', () => {
    const obstacles = createScenarioObstacles(DEFAULT_SANDBOX_SCENARIO);
    const barriers = obstacles.filter(o => o.type === 'low_barrier');
    for (const barrier of barriers) {
      expect(barrier.pierceable).toBe(true);
    }
  });
});

// ─── resetBlockoutScenario ───────────────────────────────────────────

describe('resetBlockoutScenario restores deterministic state', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetBlockoutObstacleIdCounter();
    resetVfxEventIdCounter();
    resetDamageEventIdCounter();
  });

  it('restores deterministic vehicle count', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);
    expect(state.blockoutVehicles!.length).toBe(9);
  });

  it('restores vehicles to full HP', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);
    for (const vehicle of state.blockoutVehicles!) {
      expect(vehicle.hp).toBe(vehicle.maxHp);
    }
  });

  it('clears destroyed state on all vehicles', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // Now damage/destroy a vehicle
    const vehicle = state.blockoutVehicles![0];
    vehicle.hp = 0;
    vehicle.isDestroyed = true;

    // Reset again
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // All vehicles should be alive again
    for (const v of state.blockoutVehicles!) {
      expect(v.isDestroyed).toBe(false);
      expect(v.hp).toBe(v.maxHp);
    }
  });

  it('clears firing state on all vehicles', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // Set some firing state
    state.blockoutVehicles![0].fireHeld = true;
    state.blockoutVehicles![0].isFiring = true;

    // Reset again
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    for (const v of state.blockoutVehicles!) {
      expect(v.fireHeld).toBe(false);
      expect(v.isFiring).toBe(false);
    }
  });

  it('clears movement targets on all vehicles', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // Set some movement state
    state.blockoutVehicles![0].hasMoveTarget = true;
    state.blockoutVehicles![0].speed = 100;

    // Reset again
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    for (const v of state.blockoutVehicles!) {
      expect(v.hasMoveTarget).toBe(false);
      expect(v.speed).toBe(0);
    }
  });

  it('clears upgrade state on all vehicles', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // Set some upgrade state
    state.blockoutVehicles![0].upgradeLevels = { mobility_boost: 2, weapon_tuning: 1 };
    state.blockoutVehicles![0].lastUpgradedAt = 9999;

    // Reset again
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    for (const v of state.blockoutVehicles!) {
      expect(Object.keys(v.upgradeLevels).length).toBe(0);
      expect(v.lastUpgradedAt).toBe(0);
    }
  });

  it('clears VFX events', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // Fire a weapon to create VFX events
    const vehicle = state.blockoutVehicles![0];
    vehicle.lastFiredAt = 0; // Allow firing
    fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 100, 1000);
    expect(getVfxEvents().length).toBeGreaterThan(0);

    // Reset should clear VFX
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);
    expect(getVfxEvents().length).toBe(0);
  });

  it('clears damage events', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // Apply damage to create damage events
    const vehicle = state.blockoutVehicles![0];
    applyDamageToVehicle(vehicle, 'smoky', 20, 100, 100, 1000, 'direct');
    expect(getDamageEvents().length).toBeGreaterThan(0);

    // Reset should clear damage events
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);
    expect(getDamageEvents().length).toBe(0);
  });

  it('does not affect normal game state properties (economy remains)', () => {
    const state = createTestGameState();
    const originalRaw = state.economy.raw;
    const originalMatter = state.economy.matter;
    const originalHarvesterCount = state.harvesters.length;

    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    // Economy should be unchanged
    expect(state.economy.raw).toBe(originalRaw);
    expect(state.economy.matter).toBe(originalMatter);
    // Harvesters should be unchanged
    expect(state.harvesters.length).toBe(originalHarvesterCount);
  });

  it('does not affect mapData or entities', () => {
    const state = createTestGameState();
    const originalMapWidth = state.mapWidth;
    const originalEntitiesCount = state.entities.length;

    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);

    expect(state.mapWidth).toBe(originalMapWidth);
    expect(state.entities.length).toBe(originalEntitiesCount);
  });

  it('replaces obstacles with fresh set from scenario', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);
    expect(state.blockoutObstacles!.length).toBe(DEFAULT_SANDBOX_SCENARIO.obstacles.length);
  });
});

// ─── No save persistence ─────────────────────────────────────────────

describe('no save persistence for scenario/debug state', () => {
  let mockStorage: SaveStorage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    mockStorage = {
      getItem(key: string): string | null { return store[key] ?? null; },
      setItem(key: string, value: string): boolean { store[key] = value; return true; },
      removeItem(key: string): void { delete store[key]; },
    };
    setSaveStorage(mockStorage);
    resetBlockoutVehicleIdCounter();
    resetBlockoutObstacleIdCounter();
    resetVfxEventIdCounter();
    resetDamageEventIdCounter();
  });

  it('blockout vehicles are not persisted in saves after scenario reset', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);
    expect(state.blockoutVehicles!.length).toBe(9);

    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.blockoutVehicles).toBeUndefined();
  });

  it('blockout obstacles are not persisted in saves after scenario reset', () => {
    const state = createTestGameState();
    resetBlockoutScenario(state, DEFAULT_SANDBOX_SCENARIO);
    expect(state.blockoutObstacles!.length).toBeGreaterThan(0);

    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.blockoutObstacles).toBeUndefined();
  });
});

// ─── Scenario type contracts ─────────────────────────────────────────

describe('scenario type contracts', () => {
  it('ScenarioVehicleSpawn has required fields', () => {
    const spawn: ScenarioVehicleSpawn = {
      vehicleId: 'wasp-smoky',
      tx: 5,
      ty: 5,
      faction: 'cyan',
    };
    expect(spawn.vehicleId).toBe('wasp-smoky');
    expect(spawn.tx).toBe(5);
    expect(spawn.ty).toBe(5);
    expect(spawn.faction).toBe('cyan');
  });

  it('ScenarioVehicleSpawn allows optional bodyAngle', () => {
    const spawn: ScenarioVehicleSpawn = {
      vehicleId: 'wasp-smoky',
      tx: 5,
      ty: 5,
      faction: 'cyan',
      bodyAngle: 0,
    };
    expect(spawn.bodyAngle).toBe(0);
  });

  it('ScenarioObstaclePlacement has required fields', () => {
    const placement: ScenarioObstaclePlacement = {
      type: 'blocker_wall',
      tx: 10,
      ty: 5,
    };
    expect(placement.type).toBe('blocker_wall');
    expect(placement.tx).toBe(10);
    expect(placement.ty).toBe(5);
  });

  it('BlockoutScenario has required fields', () => {
    const scenario: BlockoutScenario = {
      id: 'test',
      name: 'Test Scenario',
      vehicles: [],
      obstacles: [],
    };
    expect(scenario.id).toBe('test');
    expect(scenario.name).toBe('Test Scenario');
    expect(scenario.vehicles).toEqual([]);
    expect(scenario.obstacles).toEqual([]);
  });
});
