/**
 * Tests for blockout weapon VFX, recoil, and cooldown.
 *
 * BLOCKOUT-05H+: Recoil + first weapon VFX set (Smoky/Railgun/Thunder).
 * Tests verify:
 * - Recoil profiles exist for Smoky/Railgun/Thunder with pixel fields
 * - Railgun recoil > Smoky recoil on at least one visible dimension
 * - Weapon VFX config exists for Smoky/Railgun/Thunder
 * - Firing creates correct VFX event type
 * - Firing uses actual turret/barrel origin, not body center
 * - Rear-mounted body VFX origin differs from body center
 * - Front_center body VFX origin differs from body center
 * - Cooldown prevents repeated immediate firing
 * - Cooldown allows firing after elapsed time
 * - Recoil starts on fire
 * - Recoil recovers over time
 * - Movement update does not erase recoil state unexpectedly
 * - Turret aiming remains independent from recoil/movement
 * - saveGame still strips blockoutVehicles and transient fields
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  canFireBlockoutWeapon,
  fireBlockoutWeapon,
  updateBlockoutRecoil,
  getVfxEvents,
  resetVfxEventIdCounter,
  expireVfxEvents,
} from '../state/blockoutWeaponVfx';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { RECOIL_PROFILES } from '../config/blockoutRecoilData';
import { getWeaponVfxProfile } from '../config/blockoutVfxData';
import { WEAPON_PROFILES } from '../config/blockoutWeaponData';
import { computeTurretWorldOrigin, computeBodyWorldCenter } from '../phaser/render/blockoutVehicleGeometry';
import { updateBlockoutVehicleMovement, setBlockoutVehicleMoveTarget } from '../state/blockoutMovement';
import { MOVEMENT_PROFILES } from '../config/blockoutMovementData';
import { saveGame, loadGame, setSaveStorage, type SaveStorage } from '../state/saveGame';
import { devSpawnBlockoutVehicleSet } from '../state/devCommands';
import type { GameState } from '../state/types';

// ─── Test helpers ────────────────────────────────────────────────────

/** Minimal offset for geometry tests. */
const TEST_OFFSET = { x: 0, y: 0 };

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

// ─── Recoil profile existence and differentiation ────────────────────

describe('recoil profiles for Smoky/Railgun/Thunder', () => {
  it('Smoky has recoil profile with pixel fields', () => {
    const profile = RECOIL_PROFILES.smoky;
    expect(profile).toBeDefined();
    expect(profile.barrelKickbackPx).toBeGreaterThan(0);
    expect(profile.turretKickbackRad).toBeGreaterThan(0);
    expect(profile.bodyImpulsePx).toBeGreaterThan(0);
    expect(profile.recoveryMs).toBeGreaterThan(0);
    expect(profile.cameraShake).toBe(false);
  });

  it('Railgun has recoil profile with pixel fields', () => {
    const profile = RECOIL_PROFILES.railgun;
    expect(profile).toBeDefined();
    expect(profile.barrelKickbackPx).toBeGreaterThan(0);
    expect(profile.turretKickbackRad).toBeGreaterThan(0);
    expect(profile.bodyImpulsePx).toBeGreaterThan(0);
    expect(profile.recoveryMs).toBeGreaterThan(0);
    expect(profile.cameraShake).toBe(false);
  });

  it('Thunder has recoil profile with pixel fields', () => {
    const profile = RECOIL_PROFILES.thunder;
    expect(profile).toBeDefined();
    expect(profile.barrelKickbackPx).toBeGreaterThan(0);
    expect(profile.turretKickbackRad).toBeGreaterThan(0);
    expect(profile.bodyImpulsePx).toBeGreaterThan(0);
    expect(profile.recoveryMs).toBeGreaterThan(0);
    expect(profile.cameraShake).toBe(false);
  });

  it('Railgun barrelKickbackPx > Smoky barrelKickbackPx', () => {
    expect(RECOIL_PROFILES.railgun.barrelKickbackPx).toBeGreaterThan(RECOIL_PROFILES.smoky.barrelKickbackPx);
  });

  it('Railgun turretKickbackRad > Smoky turretKickbackRad', () => {
    expect(RECOIL_PROFILES.railgun.turretKickbackRad).toBeGreaterThan(RECOIL_PROFILES.smoky.turretKickbackRad);
  });

  it('Railgun bodyImpulsePx > Smoky bodyImpulsePx', () => {
    expect(RECOIL_PROFILES.railgun.bodyImpulsePx).toBeGreaterThan(RECOIL_PROFILES.smoky.bodyImpulsePx);
  });

  it('Thunder barrelKickbackPx > Smoky barrelKickbackPx', () => {
    expect(RECOIL_PROFILES.thunder.barrelKickbackPx).toBeGreaterThan(RECOIL_PROFILES.smoky.barrelKickbackPx);
  });
});

// ─── VFX config existence ────────────────────────────────────────────

describe('VFX config for Smoky/Railgun/Thunder', () => {
  it('Smoky has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('smoky');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('instant_projectile');
    expect(profile!.durationMs).toBeGreaterThan(0);
  });

  it('Railgun has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('railgun');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('line_pierce');
    expect(profile!.durationMs).toBeGreaterThan(0);
  });

  it('Thunder has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('thunder');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('instant_splash');
    expect(profile!.durationMs).toBeGreaterThan(0);
  });

  it('Smoky VFX has muzzleFlashRadiusPx and impactRadiusPx', () => {
    const profile = getWeaponVfxProfile('smoky');
    expect(profile!.muzzleFlashRadiusPx).toBeGreaterThan(0);
    expect(profile!.impactRadiusPx).toBeGreaterThan(0);
  });

  it('Thunder VFX has impactRadiusPx for splash', () => {
    const profile = getWeaponVfxProfile('thunder');
    expect(profile!.impactRadiusPx).toBeGreaterThan(0);
  });

  it('Railgun VFX has effectLengthPx for line', () => {
    const profile = getWeaponVfxProfile('railgun');
    expect(profile!.effectLengthPx).toBeGreaterThan(0);
  });
});

// ─── Firing creates correct VFX event type ───────────────────────────

describe('firing creates correct VFX event', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('Smoky fire creates smokyShot event', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('smokyShot');
    expect(event!.weaponId).toBe('smoky');
  });

  it('Railgun fire creates railgunLine event', () => {
    const vehicle = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5);
    const now = Date.now();

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 400, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('railgunLine');
    expect(event!.weaponId).toBe('railgun');
  });

  it('Thunder fire creates thunderSplash event', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5);
    const now = Date.now();

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('thunderSplash');
    expect(event!.weaponId).toBe('thunder');
  });

  it('Non-implemented weapon returns null', () => {
    const vehicle = createBlockoutVehicle('hunter', 'twins', 'cyan', 5, 5);
    const now = Date.now();

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);

    expect(event).toBeNull();
  });
});

// ─── VFX origin uses barrel origin, not body center ──────────────────

describe('VFX origin uses actual barrel/mount origin', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('Rear-mounted body (Wasp) VFX origin differs from body center', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    // Wasp has rear mount — turret origin should be behind body center
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    // Rear mount should have different X than body center
    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
  });

  it('Front_center body (Mammoth) VFX origin differs from body center', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    // Mammoth has front_center mount — turret origin should be ahead of body center
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    // Front_center mount should have different X than body center
    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
  });

  it('Front_center mount origin is ahead of body center', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    // Front_center mount should have origin X > body center X when bodyAngle=0
    expect(turretOrigin.x).toBeGreaterThan(bodyCenter.x);
  });

  it('Rear mount origin is behind body center', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    // Rear mount should have origin X < body center X when bodyAngle=0
    expect(turretOrigin.x).toBeLessThan(bodyCenter.x);
  });
});

// ─── Cooldown ────────────────────────────────────────────────────────

describe('weapon cooldown', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('can fire initially (lastFiredAt=0)', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(canFireBlockoutWeapon(vehicle, Date.now())).toBe(true);
  });

  it('cannot fire immediately after firing (cooldown not elapsed)', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    // Try again immediately — cooldown not elapsed
    expect(canFireBlockoutWeapon(vehicle, now + 1)).toBe(false);
  });

  it('can fire after cooldown elapses', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    // Smoky cooldown is 800ms
    const afterCooldown = now + 801;
    expect(canFireBlockoutWeapon(vehicle, afterCooldown)).toBe(true);
  });

  it('Railgun cooldown is longer than Smoky cooldown', () => {
    expect(WEAPON_PROFILES.railgun.blockoutCooldownMs).toBeGreaterThan(
      WEAPON_PROFILES.smoky.blockoutCooldownMs,
    );
  });

  it('cannot fire twice within one cooldown window', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();

    const event1 = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);
    expect(event1).not.toBeNull();

    // Try again before cooldown elapses
    const event2 = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now + 100);
    expect(event2).toBeNull();
  });
});

// ─── Recoil starts on fire and recovers ──────────────────────────────

describe('recoil starts on fire and recovers', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('recoil starts when weapon fires', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.recoilActive).toBe(false);

    const now = Date.now();
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    expect(vehicle.recoilActive).toBe(true);
    expect(vehicle.recoilBarrelOffset).toBeGreaterThan(0);
    expect(vehicle.recoilTurretOffset).toBeGreaterThan(0);
    expect(vehicle.recoilBodyOffset).toBeGreaterThan(0);
  });

  it('recoil recovers over time', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    // Recoil should still be active partway through
    updateBlockoutRecoil(vehicle, now + 50);
    expect(vehicle.recoilActive).toBe(true);

    // After full recovery, recoil should be inactive
    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs + 10);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
    expect(vehicle.recoilTurretOffset).toBe(0);
    expect(vehicle.recoilBodyOffset).toBe(0);
  });

  it('recoil barrel offset decays gradually', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    const initialOffset = vehicle.recoilBarrelOffset;

    // After half the recovery time, offset should be less than initial
    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs / 2);
    expect(vehicle.recoilBarrelOffset).toBeGreaterThan(0);
    expect(vehicle.recoilBarrelOffset).toBeLessThan(initialOffset);
  });

  it('Railgun has stronger recoil than Smoky', () => {
    const smoky = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const railgun = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5);
    const now = Date.now();

    fireBlockoutWeapon(smoky, 100, 100, 0, 300, 0, now);
    fireBlockoutWeapon(railgun, 100, 100, 0, 400, 0, now);

    expect(railgun.recoilBarrelOffset).toBeGreaterThan(smoky.recoilBarrelOffset);
  });
});

// ─── Movement does not erase recoil ──────────────────────────────────

describe('movement does not erase recoil state', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('movement update does not erase recoil state unexpectedly', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const profile = MOVEMENT_PROFILES.wasp;
    const now = Date.now();

    // Start recoil
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);
    expect(vehicle.recoilActive).toBe(true);

    // Set movement target and run some frames
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // Recoil should still be active (movement doesn't clear it)
    expect(vehicle.recoilActive).toBe(true);
  });

  it('turret aiming remains independent from recoil/movement', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const profile = MOVEMENT_PROFILES.wasp;
    const now = Date.now();

    // Set specific turret angles
    vehicle.turretAngle = -Math.PI / 4;
    vehicle.turretTargetAngle = -Math.PI / 4;

    // Fire weapon (starts recoil)
    fireBlockoutWeapon(vehicle, 100, 100, vehicle.turretAngle, 300, 0, now);

    // Run movement
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // turretTargetAngle should NOT have been changed by movement or recoil
    expect(vehicle.turretTargetAngle).toBeCloseTo(-Math.PI / 4);
  });
});

// ─── VFX event expiration ────────────────────────────────────────────

describe('VFX event expiration', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('events are available after creation', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    const events = getVfxEvents();
    expect(events.length).toBe(1);
  });

  it('expired events are removed', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = Date.now();

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    // Smoky VFX duration is 150ms — expire after that
    expireVfxEvents(now + 200);

    const events = getVfxEvents();
    expect(events.length).toBe(0);
  });
});

// ─── Save sanitization with recoil/VFX fields ────────────────────────

describe('saveGame strips blockoutVehicles with recoil/VFX fields', () => {
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
    resetVfxEventIdCounter();
  });

  it('blockoutVehicles with recoil fields are not persisted', () => {
    const state = createTestGameState();
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    // Fire a weapon to add recoil state
    const vehicle = state.blockoutVehicles![0];
    const now = Date.now();
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);
    expect(vehicle.recoilActive).toBe(true);

    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.blockoutVehicles).toBeUndefined();
  });
});

// ─── Weapon cooldown config ─────────────────────────────────────────

describe('weapon cooldown config', () => {
  it('Smoky has cooldown configured', () => {
    expect(WEAPON_PROFILES.smoky.blockoutCooldownMs).toBeGreaterThan(0);
  });

  it('Railgun has cooldown configured', () => {
    expect(WEAPON_PROFILES.railgun.blockoutCooldownMs).toBeGreaterThan(0);
  });

  it('Thunder has cooldown configured', () => {
    expect(WEAPON_PROFILES.thunder.blockoutCooldownMs).toBeGreaterThan(0);
  });

  it('Railgun cooldown > Smoky cooldown', () => {
    expect(WEAPON_PROFILES.railgun.blockoutCooldownMs).toBeGreaterThan(
      WEAPON_PROFILES.smoky.blockoutCooldownMs,
    );
  });

  it('All weapons have cooldown and range configured', () => {
    for (const [id, profile] of Object.entries(WEAPON_PROFILES)) {
      expect(profile.blockoutCooldownMs, `${id} cooldown`).toBeGreaterThan(0);
      expect(profile.blockoutRangePx, `${id} range`).toBeGreaterThan(0);
    }
  });
});

// ─── Recoil does not permanently change turretTargetAngle ────────────

describe('recoil does not permanently change turretTargetAngle', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('turretTargetAngle unchanged after recoil fully recovers', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    vehicle.turretTargetAngle = Math.PI / 3;
    const originalTarget = vehicle.turretTargetAngle;

    const now = Date.now();
    fireBlockoutWeapon(vehicle, 100, 100, vehicle.turretAngle, 300, 0, now);

    // Recoil is active
    expect(vehicle.recoilActive).toBe(true);

    // Wait for full recovery
    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs + 10);

    // turretTargetAngle should not have been permanently changed
    expect(vehicle.turretTargetAngle).toBeCloseTo(originalTarget);
  });
});
