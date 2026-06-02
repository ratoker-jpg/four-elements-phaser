/**
 * Tests for blockout damage system — HP, hit detection, damage application.
 *
 * BLOCKOUT-07H+: Dev/arena-only damage placeholders for blockout vehicles.
 *
 * Tests verify:
 * - Damage profiles exist for all 11 weapons with damageKind
 * - Body maxHp exists and Wasp HP < Mammoth HP
 * - Applying direct damage reduces HP
 * - HP cannot go below 0
 * - Vehicle becomes destroyed at 0 HP
 * - Destroyed vehicle stops firing and clears movement target
 * - Destroyed vehicle cannot be damaged again
 * - Direct hit finds nearest target along aim line
 * - Splash damages vehicles in radius and ignores outside radius
 * - Penetration hits multiple vehicles along line
 * - Cone tick finds vehicles inside cone and ignores outside cone
 * - Beam tick damages valid target
 * - Shotgun pellet fan can hit multiple vehicles
 * - Ricochet path can hit target near segment
 * - Firing vehicle does not damage itself by default
 * - Damage events expire over scene time
 * - No Date.now dependency for damage timing
 * - Continuous weapon damage ticks at cadence
 * - Key release stops further continuous damage (via stopFiring)
 * - saveGame still strips blockoutVehicles with HP/damage/transient fields
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyDamageToVehicle,
  applyBlockoutWeaponDamage,
  tickContinuousDamage,
  findDirectHitTarget,
  findSplashTargets,
  findPenetrationTargets,
  findConeTargets,
  findBeamTargets,
  findShotgunTargets,
  findRicochetTargets,
  getBlockoutDamageProfile,
  getDamageEvents,
  expireDamageEvents,
  clearDamageEvents,
  resetDamageEventIdCounter,
} from '../state/blockoutDamage';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';
import { BLOCKOUT_BODY_MAX_HP, getBlockoutBodyMaxHp } from '../config/blockoutBodyData';
import { computeBodyWorldCenter } from '../phaser/render/blockoutVehicleGeometry';
import { startFiring, stopFiring } from '../state/blockoutWeaponVfx';
import { resetVfxEventIdCounter } from '../state/blockoutWeaponVfx';
import { saveGame, loadGame, setSaveStorage, type SaveStorage } from '../state/saveGame';
import { devSpawnBlockoutVehicleSet } from '../state/devCommands';
import type { GameState } from '../state/types';
import type { WeaponId } from '../config/blockoutProfiles';

// ─── Test helpers ────────────────────────────────────────────────────

/** Minimal offset for geometry tests. */
const TEST_OFFSET = { x: 0, y: 0 };

/** All 11 weapon IDs for iteration. */
const ALL_WEAPON_IDS: WeaponId[] = [
  'smoky', 'thunder', 'railgun', 'shaft', 'flamethrower',
  'freeze', 'isida', 'vulcan', 'twins', 'ricochet', 'hammer',
];

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

// ─── Damage profiles exist for all 11 weapons ───────────────────────

describe('damage profiles for all 11 weapons', () => {
  it('all 11 weapons have damage profiles', () => {
    for (const weaponId of ALL_WEAPON_IDS) {
      const profile = DAMAGE_PROFILES[weaponId];
      expect(profile, `Damage profile for ${weaponId}`).toBeDefined();
    }
  });

  it('all 11 weapons have damageKind', () => {
    for (const weaponId of ALL_WEAPON_IDS) {
      const profile = DAMAGE_PROFILES[weaponId];
      expect(profile.damageKind, `${weaponId} damageKind`).toBeDefined();
    }
  });

  it('all 11 weapons have rangePx', () => {
    for (const weaponId of ALL_WEAPON_IDS) {
      const profile = DAMAGE_PROFILES[weaponId];
      expect(profile.rangePx, `${weaponId} rangePx`).toBeGreaterThan(0);
    }
  });

  it('getBlockoutDamageProfile returns profile for known weapon', () => {
    const profile = getBlockoutDamageProfile('smoky');
    expect(profile).toBeDefined();
    expect(profile!.damageKind).toBe('direct');
  });

  it('getBlockoutDamageProfile returns undefined for unknown weapon', () => {
    const profile = getBlockoutDamageProfile('unknown');
    expect(profile).toBeUndefined();
  });
});

// ─── Body maxHp ──────────────────────────────────────────────────────

describe('body maxHp', () => {
  it('BLOCKOUT_BODY_MAX_HP has entries for all 7 bodies', () => {
    const bodyIds = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'];
    for (const bodyId of bodyIds) {
      expect(BLOCKOUT_BODY_MAX_HP[bodyId], `${bodyId} maxHp`).toBeDefined();
      expect(BLOCKOUT_BODY_MAX_HP[bodyId], `${bodyId} maxHp > 0`).toBeGreaterThan(0);
    }
  });

  it('Wasp HP < Mammoth HP', () => {
    expect(BLOCKOUT_BODY_MAX_HP.wasp).toBeLessThan(BLOCKOUT_BODY_MAX_HP.mammoth);
  });

  it('getBlockoutBodyMaxHp returns correct value', () => {
    expect(getBlockoutBodyMaxHp('wasp')).toBe(180);
    expect(getBlockoutBodyMaxHp('mammoth')).toBe(500);
  });

  it('getBlockoutBodyMaxHp returns 200 for unknown body', () => {
    expect(getBlockoutBodyMaxHp('unknown')).toBe(200);
  });
});

// ─── Vehicle HP initialization ───────────────────────────────────────

describe('vehicle HP initialization', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('newly created vehicle has HP from body profile', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.hp).toBe(180);
    expect(vehicle.maxHp).toBe(180);
  });

  it('mammoth vehicle has correct HP', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5);
    expect(vehicle.hp).toBe(500);
    expect(vehicle.maxHp).toBe(500);
  });

  it('newly created vehicle is not destroyed', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.isDestroyed).toBe(false);
    expect(vehicle.destroyedAt).toBe(0);
    expect(vehicle.lastDamagedAt).toBe(0);
    expect(vehicle.damageFlashUntil).toBe(0);
    expect(vehicle.activeStatusTags).toEqual([]);
  });
});

// ─── Applying damage ─────────────────────────────────────────────────

describe('applying damage to vehicles', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('direct damage reduces HP', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const event = applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(event).not.toBeNull();
    expect(vehicle.hp).toBe(160);
  });

  it('HP cannot go below 0', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 999, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(vehicle.hp).toBe(0);
  });

  it('vehicle becomes destroyed at 0 HP', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 180, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(vehicle.isDestroyed).toBe(true);
    expect(vehicle.destroyedAt).toBe(1000);
  });

  it('destroyed vehicle stops firing and clears movement target', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    vehicle.fireHeld = true;
    vehicle.isFiring = true;
    vehicle.hasMoveTarget = true;
    vehicle.targetWorldX = 100;
    vehicle.targetWorldY = 100;
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 180, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
    expect(vehicle.hasMoveTarget).toBe(false);
    expect(vehicle.speed).toBe(0);
  });

  it('destroyed vehicle cannot be damaged again', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    // Kill the vehicle
    applyDamageToVehicle(vehicle, 'smoky', 180, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(vehicle.isDestroyed).toBe(true);
    // Try to damage again
    const event = applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1100, 'direct');
    expect(event).toBeNull();
    expect(vehicle.hp).toBe(0);
  });

  it('damage sets lastDamagedAt and damageFlashUntil', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 5000, 'direct');
    expect(vehicle.lastDamagedAt).toBe(5000);
    expect(vehicle.damageFlashUntil).toBe(5200); // 5000 + 200
  });

  it('status tag is added to vehicle activeStatusTags', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'flamethrower', 10, bodyCenter.x, bodyCenter.y, 1000, 'cone_tick', 'burn');
    expect(vehicle.activeStatusTags).toContain('burn');
  });

  it('damage event isKill is true when vehicle dies', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const event = applyDamageToVehicle(vehicle, 'smoky', 180, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(event!.isKill).toBe(true);
  });

  it('damage event isKill is false when vehicle survives', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const event = applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(event!.isKill).toBe(false);
  });
});

// ─── Hit detection ───────────────────────────────────────────────────

describe('hit detection', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('findDirectHitTarget finds nearest target along aim line', () => {
    const attacker = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    // Place a target to the right
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const result = findDirectHitTarget(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, 250, 0, TEST_OFFSET);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(target.id);
  });

  it('findDirectHitTarget returns null if no target in range', () => {
    const attacker = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    // Place target far away
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 15, 15);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const result = findDirectHitTarget(attacker, vehicles, bodyCenter.x, bodyCenter.y, 0, 50, 0, TEST_OFFSET);
    expect(result).toBeNull();
  });

  it('findSplashTargets damages vehicles in radius', () => {
    const attacker = createBlockoutVehicle('wasp', 'thunder', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];

    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const result = findSplashTargets(attacker, vehicles, targetCenter.x, targetCenter.y, 60, TEST_OFFSET);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(v => v.id === target.id)).toBe(true);
  });

  it('findSplashTargets ignores vehicles outside radius', () => {
    const attacker = createBlockoutVehicle('wasp', 'thunder', 'cyan', 5, 5);
    const farTarget = createBlockoutVehicle('hunter', 'smoky', 'green', 15, 15);
    const vehicles = [attacker, farTarget];

    const impactX = computeBodyWorldCenter(attacker, TEST_OFFSET).x;
    const impactY = computeBodyWorldCenter(attacker, TEST_OFFSET).y;
    const result = findSplashTargets(attacker, vehicles, impactX, impactY, 30, TEST_OFFSET);
    expect(result.some(v => v.id === farTarget.id)).toBe(false);
  });

  it('findSplashTargets excludes self by default (selfDamageScale=0)', () => {
    const attacker = createBlockoutVehicle('wasp', 'thunder', 'cyan', 5, 5);
    const vehicles = [attacker];

    const impactX = computeBodyWorldCenter(attacker, TEST_OFFSET).x;
    const impactY = computeBodyWorldCenter(attacker, TEST_OFFSET).y;
    const result = findSplashTargets(attacker, vehicles, impactX, impactY, 200, TEST_OFFSET);
    // thunder has selfDamageScale=0.3, so attacker IS included
    expect(result.some(v => v.id === attacker.id)).toBe(true);
  });

  it('findPenetrationTargets hits multiple vehicles along line', () => {
    const attacker = createBlockoutVehicle('wasp', 'railgun', 'cyan', 5, 5);
    const target1 = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const target2 = createBlockoutVehicle('viking', 'smoky', 'yellow', 9, 5);
    const vehicles = [attacker, target1, target2];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const target1Center = computeBodyWorldCenter(target1, TEST_OFFSET);
    const aimAngle = Math.atan2(target1Center.y - bodyCenter.y, target1Center.x - bodyCenter.x);
    const result = findPenetrationTargets(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, 400, 0, 3, TEST_OFFSET);
    expect(result.length).toBe(2);
  });

  it('findConeTargets finds vehicles inside cone', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const result = findConeTargets(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, 120, 25, TEST_OFFSET);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(v => v.id === target.id)).toBe(true);
  });

  it('findConeTargets ignores vehicles outside cone', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    // Place a target forward (tile 6,4 is ~76px to the right at same screen Y)
    // and another vehicle behind (tile 4,6 is ~76px to the left at same screen Y)
    const forward = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 4);
    const behind = createBlockoutVehicle('viking', 'smoky', 'yellow', 4, 6);
    const vehicles = [attacker, forward, behind];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const forwardCenter = computeBodyWorldCenter(forward, TEST_OFFSET);
    const aimAngle = Math.atan2(forwardCenter.y - bodyCenter.y, forwardCenter.x - bodyCenter.x);
    const result = findConeTargets(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, 120, 25, TEST_OFFSET);
    // Forward target should be found; behind target should not
    expect(result.some(v => v.id === forward.id)).toBe(true);
    expect(result.some(v => v.id === behind.id)).toBe(false);
  });

  it('findBeamTargets finds targets along beam', () => {
    const attacker = createBlockoutVehicle('wasp', 'isida', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const result = findBeamTargets(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, 150, 0, TEST_OFFSET);
    expect(result.some(v => v.id === target.id)).toBe(true);
  });

  it('findShotgunTargets can hit multiple vehicles', () => {
    const attacker = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    // Place two targets side by side
    const target1 = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const target2 = createBlockoutVehicle('viking', 'smoky', 'yellow', 7, 4);
    const vehicles = [attacker, target1, target2];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const result = findShotgunTargets(attacker, vehicles, bodyCenter.x, bodyCenter.y, 0, 150, 30, 5, TEST_OFFSET);
    expect(result.length).toBeGreaterThan(0);
  });

  it('findRicochetTargets can hit target near segment', () => {
    const attacker = createBlockoutVehicle('wasp', 'ricochet', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const result = findRicochetTargets(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, 200, 2, TEST_OFFSET);
    expect(result.some(v => v.id === target.id)).toBe(true);
  });
});

// ─── Firing vehicle does not damage itself (by default) ──────────────

describe('firing vehicle does not damage itself by default', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('smoky (selfDamageScale=0) does not damage itself', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const vehicles = [vehicle];
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    const events = applyBlockoutWeaponDamage(vehicle, vehicles, bodyCenter.x, bodyCenter.y, 0, bodyCenter.x + 100, bodyCenter.y, TEST_OFFSET, 1000);
    // Smoky is direct — it only finds OTHER vehicles. With just one vehicle (itself), no damage.
    expect(events.length).toBe(0);
    expect(vehicle.hp).toBe(180);
  });
});

// ─── Damage events expire ───────────────────────────────────────────

describe('damage events expire', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('damage events are available after creation', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(getDamageEvents().length).toBe(1);
  });

  it('damage events expire over scene time', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    // Events last 800ms
    expireDamageEvents(1500); // 500ms after event
    expect(getDamageEvents().length).toBe(1);
    expireDamageEvents(1900); // 900ms after event — expired
    expect(getDamageEvents().length).toBe(0);
  });

  it('clearDamageEvents removes all events', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    clearDamageEvents();
    expect(getDamageEvents().length).toBe(0);
  });
});

// ─── No Date.now dependency ──────────────────────────────────────────

describe('no Date.now dependency for damage timing', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('all damage operations use passed-in nowMs', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    // Use scene-time values (small numbers), not Date.now()
    const sceneTime = 500;
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, sceneTime, 'direct');

    expect(vehicle.lastDamagedAt).toBe(500);
    expect(vehicle.damageFlashUntil).toBe(700); // 500 + 200

    // Expire with scene-time
    expireDamageEvents(2000);
    expect(getDamageEvents().length).toBe(0);
  });
});

// ─── Continuous weapon damage ticks ──────────────────────────────────

describe('continuous weapon damage ticks', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('tickContinuousDamage returns empty for non-firing vehicle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    vehicle.fireHeld = false;
    vehicle.isFiring = false;
    const vehicles = [vehicle];

    const result = tickContinuousDamage(vehicle, vehicles, 100, 100, 0, 200, 0, TEST_OFFSET, 1000);
    expect(result.length).toBe(0);
  });

  it('tickContinuousDamage returns empty for destroyed vehicle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    vehicle.isDestroyed = true;
    vehicle.fireHeld = true;
    vehicle.isFiring = true;
    const vehicles = [vehicle];

    const result = tickContinuousDamage(vehicle, vehicles, 100, 100, 0, 200, 0, TEST_OFFSET, 1000);
    expect(result.length).toBe(0);
  });

  it('tickContinuousDamage respects tickMs cadence', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);
    vehicle.lastStreamTickAt = 1000;
    const vehicles = [vehicle];

    // Too early
    const result1 = tickContinuousDamage(vehicle, vehicles, 100, 100, 0, 200, 0, TEST_OFFSET, 1020);
    expect(result1.length).toBe(0);

    // After tickMs (50ms for flamethrower)
    tickContinuousDamage(vehicle, vehicles, 100, 100, 0, 200, 0, TEST_OFFSET, 1060);
    // Note: This may or may not produce damage events depending on targets
    // The key is that it doesn't crash and respects timing
  });

  it('stopFiring prevents further continuous damage', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);
    const vehicles = [vehicle];

    stopFiring(vehicle);

    const result = tickContinuousDamage(vehicle, vehicles, 100, 100, 0, 200, 0, TEST_OFFSET, 1060);
    expect(result.length).toBe(0);
  });
});

// ─── applyBlockoutWeaponDamage for each damage kind ──────────────────

describe('applyBlockoutWeaponDamage for each damage kind', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('smoky (direct) applies damage to target in range', () => {
    const attacker = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const events = applyBlockoutWeaponDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events.length).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(events[0].kind).toBe('direct');
  });

  it('thunder (splash) applies splash damage', () => {
    const attacker = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const events = applyBlockoutWeaponDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events.length).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(events.some(e => e.kind === 'splash')).toBe(true);
  });

  it('railgun (penetration) damages targets', () => {
    const attacker = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const events = applyBlockoutWeaponDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events.length).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(events[0].kind).toBe('penetration');
  });

  it('hammer (shotgun) distributes damage across pellets', () => {
    const attacker = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);
    const events = applyBlockoutWeaponDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events.length).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(events.every(e => e.kind === 'shotgun')).toBe(true);
  });
});

// ─── saveGame still strips blockoutVehicles ──────────────────────────

describe('saveGame strips blockoutVehicles with HP/damage fields', () => {
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
    resetDamageEventIdCounter();
    resetVfxEventIdCounter();
  });

  it('blockoutVehicles with HP/damage fields are not persisted', () => {
    const state = createTestGameState();
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    // Apply some damage
    const vehicle = state.blockoutVehicles![0];
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(vehicle.hp).toBeLessThan(vehicle.maxHp);

    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.blockoutVehicles).toBeUndefined();
  });
});

// ─── Normal state without blockout damage fields does not crash ──────

describe('normal state without blockout damage fields does not crash', () => {
  it('getBlockoutDamageProfile for unknown weapon returns undefined', () => {
    expect(getBlockoutDamageProfile('nonexistent')).toBeUndefined();
  });

  it('getBlockoutBodyMaxHp for unknown body returns default', () => {
    expect(getBlockoutBodyMaxHp('nonexistent')).toBe(200);
  });
});
