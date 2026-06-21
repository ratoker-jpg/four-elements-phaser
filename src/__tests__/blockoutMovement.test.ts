/**
 * Tests for blockout vehicle movement.
 *
 * BLOCKOUT-04H+: Semi-physics movement for blockout vehicles.
 * Tests verify:
 * - Movement target assignment
 * - Acceleration increases speed over time
 * - Braking/stopping near target
 * - Movement clears target on arrival
 * - Wasp max speed > Mammoth max speed
 * - Wasp acceleration > Mammoth acceleration
 * - bodyAngle rotates gradually toward movement direction
 * - bodyAngle does not snap instantly if turn speed limited
 * - turretAngle remains controlled by aim logic, not overwritten by movement
 * - saveGame still strips blockoutVehicles with movement fields
 * - Speed starts at zero on creation
 * - Velocity components are consistent with body angle and speed
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialVisionState } from '../state/visibility';
import {
  updateBlockoutVehicleMovement,
  setBlockoutVehicleMoveTarget,
  clearBlockoutVehicleMoveTarget,
} from '../state/blockoutMovement';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { MOVEMENT_PROFILES } from '../config/blockoutMovementData';
import { saveGame, loadGame, setSaveStorage, type SaveStorage } from '../state/saveGame';
import { devSpawnBlockoutVehicleSet } from '../state/devCommands';
import type { GameState } from '../state/types';
import { getEffectiveMovementProfile } from '../state/blockoutUpgrades';
import { applyUpgrade } from '../state/blockoutUpgrades';

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

// ─── Movement profile feel differentiation ───────────────────────────

describe('movement profile feel differentiation', () => {
  it('Wasp max speed (px) > Mammoth max speed (px)', () => {
    expect(MOVEMENT_PROFILES.wasp.maxSpeedPxPerSec).toBeGreaterThan(MOVEMENT_PROFILES.mammoth.maxSpeedPxPerSec);
  });

  it('Wasp acceleration > Mammoth acceleration', () => {
    expect(MOVEMENT_PROFILES.wasp.accelerationPxPerSec2).toBeGreaterThan(MOVEMENT_PROFILES.mammoth.accelerationPxPerSec2);
  });

  it('Wasp braking > Mammoth braking', () => {
    expect(MOVEMENT_PROFILES.wasp.brakingPxPerSec2).toBeGreaterThan(MOVEMENT_PROFILES.mammoth.brakingPxPerSec2);
  });

  it('Wasp turn speed > Mammoth turn speed', () => {
    expect(MOVEMENT_PROFILES.wasp.turnSpeedDeg).toBeGreaterThan(MOVEMENT_PROFILES.mammoth.turnSpeedDeg);
  });

  it('All profiles have positive pixel-speed fields', () => {
    for (const [bodyId, profile] of Object.entries(MOVEMENT_PROFILES)) {
      expect(profile.maxSpeedPxPerSec, `${bodyId} maxSpeedPxPerSec`).toBeGreaterThan(0);
      expect(profile.accelerationPxPerSec2, `${bodyId} accelerationPxPerSec2`).toBeGreaterThan(0);
      expect(profile.brakingPxPerSec2, `${bodyId} brakingPxPerSec2`).toBeGreaterThan(0);
      expect(profile.arrivalRadiusPx, `${bodyId} arrivalRadiusPx`).toBeGreaterThan(0);
    }
  });

  it('Speed ordering: Wasp > Hornet > Hunter > Viking > Dictator > Titan > Mammoth', () => {
    const wasp = MOVEMENT_PROFILES.wasp.maxSpeedPxPerSec;
    const hornet = MOVEMENT_PROFILES.hornet.maxSpeedPxPerSec;
    const hunter = MOVEMENT_PROFILES.hunter.maxSpeedPxPerSec;
    const viking = MOVEMENT_PROFILES.viking.maxSpeedPxPerSec;
    const dictator = MOVEMENT_PROFILES.dictator.maxSpeedPxPerSec;
    const titan = MOVEMENT_PROFILES.titan.maxSpeedPxPerSec;
    const mammoth = MOVEMENT_PROFILES.mammoth.maxSpeedPxPerSec;

    expect(wasp).toBeGreaterThan(hornet);
    expect(hornet).toBeGreaterThan(hunter);
    expect(hunter).toBeGreaterThan(viking);
    expect(viking).toBeGreaterThan(dictator);
    expect(dictator).toBeGreaterThan(titan);
    expect(titan).toBeGreaterThan(mammoth);
  });
});

// ─── Movement target assignment ──────────────────────────────────────

describe('movement target assignment', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('setBlockoutVehicleMoveTarget sets target and hasMoveTarget', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.hasMoveTarget).toBe(false);

    setBlockoutVehicleMoveTarget(vehicle, 100, 200);
    expect(vehicle.hasMoveTarget).toBe(true);
    expect(vehicle.targetWorldX).toBe(100);
    expect(vehicle.targetWorldY).toBe(200);
  });

  it('clearBlockoutVehicleMoveTarget clears target', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    setBlockoutVehicleMoveTarget(vehicle, 100, 200);
    clearBlockoutVehicleMoveTarget(vehicle);
    expect(vehicle.hasMoveTarget).toBe(false);
  });

  it('speed starts at zero on creation', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.speed).toBe(0);
    expect(vehicle.vx).toBe(0);
    expect(vehicle.vy).toBe(0);
  });
});

// ─── Acceleration increases speed over time ───────────────────────────

describe('acceleration increases speed over time', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('vehicle accelerates toward target', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    // Set target far ahead along body angle
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 500, vehicle.worldY);

    // Simulate several frames
    for (let i = 0; i < 30; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // Speed should have increased from zero
    expect(vehicle.speed).toBeGreaterThan(0);
  });

  it('vehicle does not exceed max speed', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 2000, vehicle.worldY);

    // Simulate many frames
    for (let i = 0; i < 200; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    expect(vehicle.speed).toBeLessThanOrEqual(profile.maxSpeedPxPerSec + 1); // +1 for floating point
  });

  it('Wasp reaches higher speed than Mammoth in same time', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 10, 10, 0);
    const waspProfile = MOVEMENT_PROFILES.wasp;
    const mammothProfile = MOVEMENT_PROFILES.mammoth;

    setBlockoutVehicleMoveTarget(wasp, wasp.worldX + 2000, wasp.worldY);
    setBlockoutVehicleMoveTarget(mammoth, mammoth.worldX + 2000, mammoth.worldY);

    // Simulate 30 frames
    for (let i = 0; i < 30; i++) {
      updateBlockoutVehicleMovement(wasp, waspProfile, 16);
      updateBlockoutVehicleMovement(mammoth, mammothProfile, 16);
    }

    expect(wasp.speed).toBeGreaterThan(mammoth.speed);
  });
});

// ─── Braking and arrival ──────────────────────────────────────────────

describe('braking and arrival', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('vehicle stops near target (clears target on arrival)', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    // Set target close enough to reach
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 60, vehicle.worldY);

    // Simulate many frames
    for (let i = 0; i < 500; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // Should have arrived (target cleared)
    expect(vehicle.hasMoveTarget).toBe(false);
    expect(vehicle.speed).toBe(0);
  });

  it('vehicle position is near target after arrival', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    const targetX = vehicle.worldX + 60;
    setBlockoutVehicleMoveTarget(vehicle, targetX, vehicle.worldY);

    for (let i = 0; i < 500; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    expect(Math.abs(vehicle.worldX - targetX)).toBeLessThan(profile.arrivalRadiusPx + 1);
  });

  it('vehicle decelerates when no target', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    // Give it some initial speed
    vehicle.speed = 100;
    vehicle.vx = Math.cos(vehicle.bodyAngle) * vehicle.speed;
    vehicle.vy = Math.sin(vehicle.bodyAngle) * vehicle.speed;

    // No target — should decelerate
    for (let i = 0; i < 50; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    expect(vehicle.speed).toBe(0);
  });
});

// ─── Body angle rotation ──────────────────────────────────────────────

describe('body angle rotation', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('bodyAngle rotates gradually toward movement direction', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    // Set target at 90 degrees from current body angle (which is 0)
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX, vehicle.worldY + 500);

    const initialAngle = vehicle.bodyAngle;

    // Simulate one frame
    updateBlockoutVehicleMovement(vehicle, profile, 16);

    // Body angle should have moved toward target but NOT snapped
    expect(vehicle.bodyAngle).not.toBeCloseTo(initialAngle);
    // Should be closer to PI/2 than it was
    expect(Math.abs(vehicle.bodyAngle - Math.PI / 2)).toBeLessThan(Math.abs(initialAngle - Math.PI / 2));
  });

  it('bodyAngle does not snap instantly if turn speed limited', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    // Set target 180 degrees away
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX - 500, vehicle.worldY);

    // Simulate one frame
    updateBlockoutVehicleMovement(vehicle, profile, 16);

    // Should NOT have snapped to PI
    expect(Math.abs(vehicle.bodyAngle - Math.PI)).toBeGreaterThan(0.1);
  });

  it('bodyAngle eventually reaches target direction', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    // Set target at 90 degrees
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX, vehicle.worldY + 500);

    // Simulate many frames
    for (let i = 0; i < 200; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // Body angle should be close to PI/2
    expect(vehicle.bodyAngle).toBeCloseTo(Math.PI / 2, 1);
  });
});

// ─── Turret independence from movement ────────────────────────────────

describe('turret independent from movement', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('movement update does not change turretAngle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    // Set turret to a specific angle different from body
    vehicle.turretAngle = -Math.PI / 4; // -45 degrees
    vehicle.turretTargetAngle = -Math.PI / 4;

    // Set movement target
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);

    // Simulate frames
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // turretAngle should NOT have been changed by movement update
    expect(vehicle.turretAngle).toBeCloseTo(-Math.PI / 4);
  });

  it('movement update does not change turretTargetAngle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    vehicle.turretTargetAngle = -Math.PI / 6;
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);

    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    expect(vehicle.turretTargetAngle).toBeCloseTo(-Math.PI / 6);
  });
});

// ─── Save sanitization with movement fields ───────────────────────────

describe('saveGame strips blockoutVehicles with movement fields', () => {
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

  it('blockoutVehicles with movement fields are not persisted', () => {
    const state = createTestGameState();
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    // Add movement state
    const vehicle = state.blockoutVehicles![0];
    setBlockoutVehicleMoveTarget(vehicle, 100, 200);
    vehicle.speed = 50;

    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.blockoutVehicles).toBeUndefined();
  });
});

// ─── Velocity consistency ─────────────────────────────────────────────

describe('velocity consistency with body angle and speed', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('vx and vy are consistent with bodyAngle and speed', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const profile = MOVEMENT_PROFILES.wasp;

    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 500, vehicle.worldY);

    // Simulate several frames
    for (let i = 0; i < 30; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // Check velocity consistency
    const expectedVx = Math.cos(vehicle.bodyAngle) * vehicle.speed;
    const expectedVy = Math.sin(vehicle.bodyAngle) * vehicle.speed;
    expect(vehicle.vx).toBeCloseTo(expectedVx, 5);
    expect(vehicle.vy).toBeCloseTo(expectedVy, 5);
  });
});

// ─── BLOCKOUT-09H fixup: No double application of mobility upgrade ──

describe('BLOCKOUT-09H fixup: mobility upgrade not applied twice', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('mobility_boost level 1 increases max speed by exactly 15%, not squared', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const baseProfile = MOVEMENT_PROFILES.wasp;

    // Apply mobility_boost level 1
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    const effectiveProfile = getEffectiveMovementProfile(vehicle, baseProfile);

    // Expected: base * 1.15 (single application)
    // Bug would give: base * 1.15^2 = base * 1.3225 (double application)
    const expectedSingleApp = baseProfile.maxSpeedPxPerSec * 1.15;
    const expectedDoubleApp = baseProfile.maxSpeedPxPerSec * 1.3225;

    expect(effectiveProfile.maxSpeedPxPerSec).toBeCloseTo(expectedSingleApp, 2);
    // Verify it's NOT the doubled value
    expect(effectiveProfile.maxSpeedPxPerSec).toBeLessThan(expectedDoubleApp - 1);
  });

  it('movement distance over fixed time matches single upgrade application', () => {
    const vehicleBase = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const vehicleUpgraded = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    applyUpgrade(vehicleUpgraded, 'mobility_boost', 1000);

    const baseProfile = MOVEMENT_PROFILES.wasp;
    const effectiveProfile = getEffectiveMovementProfile(vehicleUpgraded, baseProfile);

    // Move both vehicles for the same time
    setBlockoutVehicleMoveTarget(vehicleBase, vehicleBase.worldX + 2000, vehicleBase.worldY);
    setBlockoutVehicleMoveTarget(vehicleUpgraded, vehicleUpgraded.worldX + 2000, vehicleUpgraded.worldY);

    for (let i = 0; i < 200; i++) {
      updateBlockoutVehicleMovement(vehicleBase, baseProfile, 16);
      updateBlockoutVehicleMovement(vehicleUpgraded, effectiveProfile, 16);
    }

    // Upgraded vehicle should be further ahead, but not impossibly far
    expect(vehicleUpgraded.worldX).toBeGreaterThan(vehicleBase.worldX);
    // The speed ratio should be ~1.15, not ~1.3225
    if (vehicleBase.speed > 0 && vehicleUpgraded.speed > 0) {
      const ratio = vehicleUpgraded.speed / vehicleBase.speed;
      expect(ratio).toBeCloseTo(1.15, 1);
    }
  });

  it('base MOVEMENT_PROFILES is not mutated by effective profile computation', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    applyUpgrade(vehicle, 'mobility_boost', 1000);

    const baseProfile = MOVEMENT_PROFILES.wasp;
    const originalSpeed = baseProfile.maxSpeedPxPerSec;
    const originalAccel = baseProfile.accelerationPxPerSec2;

    getEffectiveMovementProfile(vehicle, baseProfile);
    // Also run movement to ensure no mutation through the update path
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 500, vehicle.worldY);
    const effectiveProfile = getEffectiveMovementProfile(vehicle, baseProfile);
    updateBlockoutVehicleMovement(vehicle, effectiveProfile, 16);

    expect(baseProfile.maxSpeedPxPerSec).toBe(originalSpeed);
    expect(baseProfile.accelerationPxPerSec2).toBe(originalAccel);
  });
});
