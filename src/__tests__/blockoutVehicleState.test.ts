/**
 * Tests for blockout vehicle state and dev spawn commands.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 * Tests verify:
 * - BlockoutVehicleState creation
 * - Dev spawn creates expected blockout vehicle state
 * - Dev spawn validates body/weapon IDs
 * - Strip function removes blockout vehicles
 * - Blockout vehicles are not persisted in saves
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { devSpawnBlockoutVehicle, devSpawnBlockoutVehicleSet, devClearBlockoutVehicles } from '../state/devCommands';
import { stripModularCombatFromState } from '../state/createInitialState';
import { saveGame, loadGame, setSaveStorage, type SaveStorage } from '../state/saveGame';
import type { GameState } from '../state/types';

import { createInitialVisionState } from '../state/visibility';
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
    combatUnits: [],
    harvesters: [],
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
    vision: createInitialVisionState(48, 48),
  };
}

// ─── BlockoutVehicleState tests ─────────────────────────────────────

describe('BlockoutVehicleState', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('should create a blockout vehicle with required fields', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.id).toBe('blockout-vehicle-1');
    expect(vehicle.bodyId).toBe('wasp');
    expect(vehicle.weaponId).toBe('smoky');
    expect(vehicle.faction).toBe('cyan');
    expect(vehicle.tx).toBe(5);
    expect(vehicle.ty).toBe(5);
    expect(vehicle.bodyAngle).toBeGreaterThan(0);
    expect(vehicle.turretAngle).toBe(vehicle.bodyAngle);
    expect(vehicle.turretTargetAngle).toBe(vehicle.bodyAngle);
    expect(vehicle.turretTurnSpeedDeg).toBeGreaterThan(0);
    expect(vehicle.createdAt).toBeGreaterThan(0);
  });

  it('should create vehicles with custom body angle', () => {
    const vehicle = createBlockoutVehicle('hunter', 'twins', 'green', 8, 8, 0);
    expect(vehicle.bodyAngle).toBe(0);
    expect(vehicle.turretAngle).toBe(0);
  });

  it('should auto-increment IDs', () => {
    const v1 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 1, 1);
    const v2 = createBlockoutVehicle('hunter', 'smoky', 'cyan', 2, 2);
    expect(v1.id).toBe('blockout-vehicle-1');
    expect(v2.id).toBe('blockout-vehicle-2');
  });

  it('should reset ID counter', () => {
    createBlockoutVehicle('wasp', 'smoky', 'cyan', 1, 1);
    resetBlockoutVehicleIdCounter();
    const v = createBlockoutVehicle('wasp', 'smoky', 'cyan', 1, 1);
    expect(v.id).toBe('blockout-vehicle-1');
  });

  // ARENA-02H+: team field defaults to 'ally'
  it('should default team to ally', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.team).toBe('ally');
  });

  // ARENA-02H+: team field can be set to 'enemy'
  it('should accept team parameter', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'green', 5, 5, Math.PI / 2, 120, 'enemy');
    expect(vehicle.team).toBe('enemy');
  });
});

// ─── Dev spawn command tests ────────────────────────────────────────

describe('devSpawnBlockoutVehicle', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
    resetBlockoutVehicleIdCounter();
  });

  it('should spawn a blockout vehicle on a valid tile', () => {
    const result = devSpawnBlockoutVehicle(state, 'wasp', 'smoky');
    expect(result.success).toBe(true);
    expect(state.blockoutVehicles).toBeDefined();
    expect(state.blockoutVehicles!.length).toBe(1);
    expect(state.blockoutVehicles![0].bodyId).toBe('wasp');
    expect(state.blockoutVehicles![0].weaponId).toBe('smoky');
  });

  it('should reject unknown body ID', () => {
    const result = devSpawnBlockoutVehicle(state, 'unknown_body' as any, 'smoky');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown body ID');
  });

  it('should reject unknown weapon ID', () => {
    const result = devSpawnBlockoutVehicle(state, 'wasp', 'unknown_weapon' as any);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown weapon ID');
  });

  it('should spawn multiple vehicles', () => {
    devSpawnBlockoutVehicle(state, 'wasp', 'smoky');
    devSpawnBlockoutVehicle(state, 'hunter', 'twins');
    devSpawnBlockoutVehicle(state, 'mammoth', 'thunder');
    expect(state.blockoutVehicles!.length).toBe(3);
  });
});

describe('devSpawnBlockoutVehicleSet', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
    resetBlockoutVehicleIdCounter();
  });

  it('should spawn the minimum expected vehicle set', () => {
    const result = devSpawnBlockoutVehicleSet(state);
    expect(result.success).toBe(true);
    expect(state.blockoutVehicles).toBeDefined();
    expect(state.blockoutVehicles!.length).toBeGreaterThanOrEqual(4);
  });

  it('should spawn Wasp+Smoky in the set', () => {
    devSpawnBlockoutVehicleSet(state);
    const hasWaspSmoky = state.blockoutVehicles!.some(
      v => v.bodyId === 'wasp' && v.weaponId === 'smoky',
    );
    expect(hasWaspSmoky).toBe(true);
  });

  it('should spawn Mammoth+Thunder in the set', () => {
    devSpawnBlockoutVehicleSet(state);
    const hasMammothThunder = state.blockoutVehicles!.some(
      v => v.bodyId === 'mammoth' && v.weaponId === 'thunder',
    );
    expect(hasMammothThunder).toBe(true);
  });

  it('should spawn default vehicles on unique tx/ty positions (no stacking)', () => {
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles).toBeDefined();
    const positions = state.blockoutVehicles!.map(v => `${v.tx},${v.ty}`);
    const uniquePositions = new Set(positions);
    // Every vehicle must be on a distinct tile
    expect(uniquePositions.size).toBe(positions.length);
  });
});

describe('devClearBlockoutVehicles', () => {
  it('should clear all blockout vehicles', () => {
    const state = createTestGameState();
    resetBlockoutVehicleIdCounter();
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    const result = devClearBlockoutVehicles(state);
    expect(result.success).toBe(true);
    expect(state.blockoutVehicles).toEqual([]);
  });
});

// ─── Strip/save isolation tests ─────────────────────────────────────

describe('stripModularCombatFromState with blockout vehicles', () => {
  it('should strip blockout vehicles when includeModularCombat is false', () => {
    const state = createTestGameState();
    resetBlockoutVehicleIdCounter();
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    const stripped = stripModularCombatFromState(state, { includeModularCombat: false });
    expect(stripped.blockoutVehicles).toEqual([]);
  });

  it('should preserve blockout vehicles when includeModularCombat is true', () => {
    const state = createTestGameState();
    resetBlockoutVehicleIdCounter();
    devSpawnBlockoutVehicleSet(state);
    const count = state.blockoutVehicles!.length;
    expect(count).toBeGreaterThan(0);

    const stripped = stripModularCombatFromState(state, { includeModularCombat: true });
    expect(stripped.blockoutVehicles!.length).toBe(count);
  });

  it('should handle state without blockoutVehicles field (old saves)', () => {
    const state = createTestGameState();
    // Old saves don't have blockoutVehicles
    expect(state.blockoutVehicles).toBeUndefined();

    const stripped = stripModularCombatFromState(state, { includeModularCombat: false });
    // Should not crash
    expect(stripped.blockoutVehicles).toBeUndefined();
  });
});

// ─── Save sanitization tests ────────────────────────────────────────

describe('saveGame does not persist blockoutVehicles', () => {
  let mockStorage: SaveStorage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    mockStorage = {
      getItem(key: string): string | null {
        return store[key] ?? null;
      },
      setItem(key: string, value: string): boolean {
        store[key] = value;
        return true;
      },
      removeItem(key: string): void {
        delete store[key];
      },
    };
    setSaveStorage(mockStorage);
    resetBlockoutVehicleIdCounter();
  });

  it('saveGame should not write blockoutVehicles into saved gameState', () => {
    const state = createTestGameState();
    // Spawn blockout vehicles so they exist in state
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    // Save the game
    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    // Load the saved game
    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState).toBeDefined();

    // blockoutVehicles must NOT be in the loaded save
    const loadedState = loadResult.gameState!;
    expect(loadedState.blockoutVehicles).toBeUndefined();
  });

  it('saveGame should strip blockoutVehicles even when updating existing slot', () => {
    const state = createTestGameState();

    // First save without blockout vehicles
    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    // Add blockout vehicles and save again to same slot
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    const updateResult = saveGame(state, 'test-map', saveResult.slotId);
    expect(updateResult.success).toBe(true);

    // Load and verify blockout vehicles are NOT in the save
    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.blockoutVehicles).toBeUndefined();
  });
});
