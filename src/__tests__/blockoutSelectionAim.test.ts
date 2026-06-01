/**
 * Tests for angle math helpers and blockout vehicle selection/aiming.
 *
 * BLOCKOUT-03H: Selection/control + turret aiming.
 * Tests verify:
 * - Angle normalization
 * - Shortest angle delta
 * - Rate-limited turret rotation
 * - Hit-test for blockout vehicle selection
 * - Turret angle advances toward target but does not snap instantly
 * - Selection/control helpers do not affect saves
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeAngle,
  shortestAngleDelta,
  rotateTowardAngle,
  angleFromTo,
  degPerSecToRadPerMs,
  TWO_PI,
} from '../state/angleMath';
import { findBlockoutVehicleNearPoint } from '../phaser/input/BlockoutVehicleInputController';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter, DEFAULT_TURRET_TURN_SPEED_DEG } from '../state/blockoutVehicleState';
import { devSpawnBlockoutVehicleSet } from '../state/devCommands';
import { saveGame, loadGame, setSaveStorage, type SaveStorage } from '../state/saveGame';
import type { GameState } from '../state/types';
import { tileToScreen } from '../phaser/render/isometric';

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
  };
}

// ─── Angle normalization tests ─────────────────────────────────────

describe('normalizeAngle', () => {
  it('should leave angles in [-PI, PI] unchanged', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI / 4)).toBeCloseTo(Math.PI / 4);
    expect(normalizeAngle(-Math.PI / 4)).toBeCloseTo(-Math.PI / 4);
  });

  it('should normalize angles greater than PI', () => {
    const result = normalizeAngle(Math.PI * 1.5);
    expect(result).toBeCloseTo(-Math.PI / 2);
  });

  it('should normalize angles less than -PI', () => {
    const result = normalizeAngle(-Math.PI * 1.5);
    expect(result).toBeCloseTo(Math.PI / 2);
  });

  it('should normalize full rotations to 0', () => {
    expect(normalizeAngle(TWO_PI)).toBeCloseTo(0);
    expect(normalizeAngle(-TWO_PI)).toBeCloseTo(0);
    expect(normalizeAngle(4 * Math.PI)).toBeCloseTo(0);
  });

  it('should normalize PI to PI (not -PI)', () => {
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI);
  });

  it('should normalize -PI to -PI', () => {
    // -PI and PI are equivalent, but we normalize to [-PI, PI]
    const result = normalizeAngle(-Math.PI);
    expect(Math.abs(result)).toBeCloseTo(Math.PI);
  });
});

// ─── Shortest angle delta tests ────────────────────────────────────

describe('shortestAngleDelta', () => {
  it('should return 0 for same angle', () => {
    expect(shortestAngleDelta(0, 0)).toBeCloseTo(0);
    expect(shortestAngleDelta(1.5, 1.5)).toBeCloseTo(0);
  });

  it('should return positive delta for counter-clockwise rotation', () => {
    const delta = shortestAngleDelta(0, Math.PI / 4);
    expect(delta).toBeCloseTo(Math.PI / 4);
  });

  it('should return negative delta for clockwise rotation', () => {
    const delta = shortestAngleDelta(0, -Math.PI / 4);
    expect(delta).toBeCloseTo(-Math.PI / 4);
  });

  it('should choose shortest path across PI boundary', () => {
    // From 170deg to -170deg: shortest is 20deg, not 340deg
    const a1 = (170 * Math.PI) / 180;
    const a2 = (-170 * Math.PI) / 180;
    const delta = shortestAngleDelta(a1, a2);
    // Should be approximately -20deg = -PI/9 in the CW direction
    expect(Math.abs(delta)).toBeCloseTo((20 * Math.PI) / 180, 1);
  });

  it('should handle large angle differences', () => {
    // 0 to 3*PI/2 should give -PI/2 (shorter clockwise) not 3*PI/2
    const delta = shortestAngleDelta(0, (3 * Math.PI) / 2);
    expect(delta).toBeCloseTo(-Math.PI / 2);
  });
});

// ─── rotateTowardAngle tests ───────────────────────────────────────

describe('rotateTowardAngle', () => {
  it('should snap to target when delta is within maxDelta', () => {
    const result = rotateTowardAngle(0, 0.1, 0.5);
    expect(result).toBeCloseTo(0.1);
  });

  it('should move toward target by maxDelta when delta is larger', () => {
    const result = rotateTowardAngle(0, Math.PI / 2, Math.PI / 4);
    expect(result).toBeCloseTo(Math.PI / 4);
  });

  it('should move in the negative direction when target is negative', () => {
    const result = rotateTowardAngle(0, -Math.PI / 2, Math.PI / 4);
    expect(result).toBeCloseTo(-Math.PI / 4);
  });

  it('should not snap instantly when turn speed is limited', () => {
    // Start at 0, target at PI/2, maxDelta = PI/8
    const result = rotateTowardAngle(0, Math.PI / 2, Math.PI / 8);
    // Should only move PI/8, not snap to PI/2
    expect(result).toBeCloseTo(Math.PI / 8);
    expect(Math.abs(result - Math.PI / 2)).toBeGreaterThan(0.01);
  });

  it('should reach target after multiple steps', () => {
    let current = 0;
    const target = Math.PI / 4;
    const maxDelta = 0.1;
    const steps = Math.ceil(Math.abs(target - current) / maxDelta) + 2;

    for (let i = 0; i < steps; i++) {
      current = rotateTowardAngle(current, target, maxDelta);
    }

    expect(current).toBeCloseTo(target);
  });

  it('should choose shortest path', () => {
    // From 10deg to 350deg (-10deg): shortest is -20deg (CW), not +340deg (CCW)
    const a1 = (10 * Math.PI) / 180;
    const a2 = (-10 * Math.PI) / 180;
    const result = rotateTowardAngle(a1, a2, 0.05);
    // Result should be slightly less than a1 (moving CW toward a2)
    expect(result).toBeLessThan(a1);
    expect(result).toBeGreaterThan(a1 - 0.1); // Small step
  });

  it('should throw if maxDelta is negative', () => {
    expect(() => rotateTowardAngle(0, 1, -0.1)).toThrow('maxDelta must be non-negative');
  });

  it('should handle zero maxDelta', () => {
    const result = rotateTowardAngle(0, Math.PI / 2, 0);
    expect(result).toBeCloseTo(0);
  });
});

// ─── angleFromTo tests ─────────────────────────────────────────────

describe('angleFromTo', () => {
  it('should return 0 for target directly to the right', () => {
    expect(angleFromTo(0, 0, 10, 0)).toBeCloseTo(0);
  });

  it('should return PI/2 for target directly below', () => {
    expect(angleFromTo(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
  });

  it('should return -PI/2 for target directly above', () => {
    expect(angleFromTo(0, 0, 0, -10)).toBeCloseTo(-Math.PI / 2);
  });

  it('should return PI for target directly to the left', () => {
    expect(angleFromTo(0, 0, -10, 0)).toBeCloseTo(Math.PI);
  });
});

// ─── degPerSecToRadPerMs tests ─────────────────────────────────────

describe('degPerSecToRadPerMs', () => {
  it('should convert 0 deg/s to 0 rad/ms', () => {
    expect(degPerSecToRadPerMs(0)).toBeCloseTo(0);
  });

  it('should convert 360 deg/s correctly', () => {
    // 360 deg/s = 2*PI rad/s = 2*PI/1000 rad/ms
    const expected = (2 * Math.PI) / 1000;
    expect(degPerSecToRadPerMs(360)).toBeCloseTo(expected);
  });

  it('should produce positive result for positive input', () => {
    expect(degPerSecToRadPerMs(90)).toBeGreaterThan(0);
  });
});

// ─── BlockoutVehicleState turret targeting tests ────────────────────

describe('BlockoutVehicleState turret targeting', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('should have turretTargetAngle equal to bodyAngle at creation', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.turretTargetAngle).toBe(vehicle.bodyAngle);
  });

  it('should have turretAngle equal to bodyAngle at creation', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.turretAngle).toBe(vehicle.bodyAngle);
  });

  it('should have turretTurnSpeedDeg from creation parameter', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 2, 90);
    expect(vehicle.turretTurnSpeedDeg).toBe(90);
  });

  it('should use default turret turn speed when not specified', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.turretTurnSpeedDeg).toBe(DEFAULT_TURRET_TURN_SPEED_DEG);
  });

  it('turret angle advances toward target but does not snap instantly when turn speed is limited', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0, 90);
    vehicle.turretTargetAngle = Math.PI / 2; // Target: 90deg

    // Simulate one frame: delta=16ms
    const maxDelta = degPerSecToRadPerMs(vehicle.turretTurnSpeedDeg) * 16;
    vehicle.turretAngle = rotateTowardAngle(vehicle.turretAngle, vehicle.turretTargetAngle, maxDelta);

    // Turret should have moved but NOT reached target yet
    expect(vehicle.turretAngle).toBeGreaterThan(0);
    expect(vehicle.turretAngle).toBeLessThan(vehicle.turretTargetAngle);
  });

  it('turret reaches target after enough frames', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0, 360);
    vehicle.turretTargetAngle = Math.PI / 4;

    // Simulate many frames
    for (let i = 0; i < 200; i++) {
      const maxDelta = degPerSecToRadPerMs(vehicle.turretTurnSpeedDeg) * 16;
      vehicle.turretAngle = rotateTowardAngle(vehicle.turretAngle, vehicle.turretTargetAngle, maxDelta);
    }

    expect(vehicle.turretAngle).toBeCloseTo(vehicle.turretTargetAngle, 2);
  });
});

// ─── Hit-test for blockout vehicle selection ────────────────────────

describe('findBlockoutVehicleNearPoint', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('should find the nearest vehicle near the click point', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const offset = { x: 100, y: 100 };

    // Compute vehicle world position
    const screenPos = tileToScreen(5, 5);
    const worldX = screenPos.x + offset.x;
    const worldY = screenPos.y + offset.y;

    const result = findBlockoutVehicleNearPoint(worldX, worldY, [vehicle], offset);
    expect(result).toBe(vehicle.id);
  });

  it('should return null when click is far from any vehicle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const offset = { x: 100, y: 100 };

    // Click far away (0,0 in world)
    const result = findBlockoutVehicleNearPoint(0, 0, [vehicle], offset);
    expect(result).toBeNull();
  });

  it('should select the nearest vehicle when multiple are near', () => {
    const v1 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const v2 = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 8, 8);
    const offset = { x: 100, y: 100 };

    // Click near v1
    const screenPos1 = tileToScreen(5, 5);
    const worldX = screenPos1.x + offset.x;
    const worldY = screenPos1.y + offset.y;

    const result = findBlockoutVehicleNearPoint(worldX, worldY, [v1, v2], offset);
    expect(result).toBe(v1.id);
  });

  it('should return null for empty vehicle list', () => {
    const offset = { x: 100, y: 100 };
    const result = findBlockoutVehicleNearPoint(100, 100, [], offset);
    expect(result).toBeNull();
  });
});

// ─── Save does not persist blockout control state ───────────────────

describe('saveGame does not persist blockout transient control state', () => {
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

  it('blockoutVehicles with turretTargetAngle are not persisted in saves', () => {
    const state = createTestGameState();
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    // Modify turret state to prove it's stripped
    state.blockoutVehicles![0].turretTargetAngle = 2.5;
    state.blockoutVehicles![0].turretAngle = 1.8;

    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);

    // blockoutVehicles must NOT be in the loaded save at all
    expect(loadResult.gameState!.blockoutVehicles).toBeUndefined();
  });
});
