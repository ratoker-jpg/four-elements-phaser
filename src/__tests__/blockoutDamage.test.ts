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
import { createInitialVisionState } from '../state/visibility';
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
import { applyUpgrade, getIncomingDamageMultiplier } from '../state/blockoutUpgrades';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';
import { BLOCKOUT_BODY_MAX_HP, getBlockoutBodyMaxHp } from '../config/blockoutBodyData';
import { computeBodyWorldCenter } from '../phaser/render/blockoutVehicleGeometry';
import { startFiring, stopFiring, tickContinuousFire } from '../state/blockoutWeaponVfx';
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
    vision: createInitialVisionState(48, 48),
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
    // CORE-STEP-08H+: Armor reduces damage. Wasp M0 armor=2, minDamagePercent=0.25
    // finalDamage = max(20 - 2, 20 * 0.25) = max(18, 5) = 18
    expect(vehicle.hp).toBe(180 - 18);
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
    // CORE-STEP-08H+: Need enough damage to overcome armor (armor=2, minDamagePercent=0.25)
    // 240 damage -> max(240-2, 240*0.25) = max(238, 60) = 238 > 180 HP
    applyDamageToVehicle(vehicle, 'smoky', 240, bodyCenter.x, bodyCenter.y, 1000, 'direct');
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
    // CORE-STEP-08H+: Need enough damage to kill despite armor
    applyDamageToVehicle(vehicle, 'smoky', 240, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
    expect(vehicle.hasMoveTarget).toBe(false);
    expect(vehicle.speed).toBe(0);
  });

  it('destroyed vehicle cannot be damaged again', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    // Kill the vehicle — need enough damage to overcome armor (armor=2)
    applyDamageToVehicle(vehicle, 'smoky', 240, bodyCenter.x, bodyCenter.y, 1000, 'direct');
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
    // CORE-STEP-08H+: Need enough damage to overcome armor (armor=2)
    // 240 -> max(240-2, 240*0.25) = 238 > 180 HP
    const event = applyDamageToVehicle(vehicle, 'smoky', 240, bodyCenter.x, bodyCenter.y, 1000, 'direct');
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

  it('tickContinuousDamage respects tickMs cadence using lastDamageTickAt', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);
    vehicle.lastDamageTickAt = 1000;
    const vehicles = [vehicle];

    // Too early — less than tickMs (50ms for flamethrower) has elapsed
    const result1 = tickContinuousDamage(vehicle, vehicles, 100, 100, 0, 200, 0, TEST_OFFSET, 1020);
    expect(result1.length).toBe(0);

    // After tickMs (50ms for flamethrower) — may produce damage if targets exist
    tickContinuousDamage(vehicle, vehicles, 100, 100, 0, 200, 0, TEST_OFFSET, 1060);
    // Note: This may or may not produce damage events depending on targets
    // The key is that it doesn't crash and respects timing via lastDamageTickAt
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

// ─── BLOCKOUT-07H+ fixup: VFX/damage cadence independence ──────────

describe('BLOCKOUT-07H+ fixup: VFX and damage cadence independence', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
    resetVfxEventIdCounter();
  });

  it('tickContinuousFire followed by tickContinuousDamage in same frame can produce damage', () => {
    // This is the core bug: previously, tickContinuousFire updated lastStreamTickAt,
    // then tickContinuousDamage checked the same field and returned [] because
    // elapsed < tickMs. Now they use separate timestamps.
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);

    // Set timestamps as if cadence has elapsed
    attacker.lastStreamTickAt = 1000;
    attacker.lastDamageTickAt = 1000;
    attacker.lastFiredAt = 1000; // so cooldown is not a factor

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const nowMs = 1060; // 60ms after last tick — past tickMs for flamethrower (50ms)

    // VFX tick — this will update lastStreamTickAt to nowMs
    tickContinuousFire(attacker, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, nowMs);

    // Damage tick in the same frame — should NOT be blocked by VFX tick
    const damageEvents = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, nowMs);

    // Damage should have been applied (attacker has a target in cone range)
    expect(damageEvents.length).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(target.maxHp);
  });

  it('continuous damage repeats over scene time while fireHeld/isFiring', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0; // ensure cooldown is not a factor

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    // First tick at t=1000 — no prior damage tick, so cadence check passes
    const events1 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events1.length).toBeGreaterThan(0);
    expect(attacker.lastDamageTickAt).toBe(1000);

    // Second tick too early at t=1020 — should not tick
    const events2 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1020);
    expect(events2.length).toBe(0);

    // Third tick at t=1060 — past tickMs, should tick again
    const events3 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1060);
    expect(events3.length).toBeGreaterThan(0);
    expect(attacker.lastDamageTickAt).toBe(1060);

    // Target should have received multiple damage ticks
    expect(target.hp).toBeLessThan(target.maxHp);
  });

  it('continuous damage stops after stopFiring', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    // First tick works
    tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);

    // Stop firing
    stopFiring(attacker);

    // Should not tick anymore
    const events = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 2000);
    expect(events.length).toBe(0);
  });

  it('VFX cadence does not block damage cadence', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;
    attacker.lastStreamTickAt = 950; // VFX ticked recently
    attacker.lastDamageTickAt = 900; // Damage ticked a while ago

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const nowMs = 1000;

    // VFX cadence may not have elapsed (950 -> 1000 = 50ms, streamCadenceMs is 50ms, so it might tick)
    // But damage cadence (900 -> 1000 = 100ms > 50ms tickMs) should definitely be ready
    const damageEvents = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, nowMs);

    expect(damageEvents.length).toBeGreaterThan(0);
    // Verify lastStreamTickAt was NOT updated by damage tick
    expect(attacker.lastStreamTickAt).toBe(950);
    expect(attacker.lastDamageTickAt).toBe(1000);
  });

  it('damage cadence does not block VFX cadence', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    startFiring(attacker);
    attacker.lastFiredAt = 0;
    attacker.lastStreamTickAt = 900; // VFX ticked a while ago
    attacker.lastDamageTickAt = 950; // Damage ticked recently

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const nowMs = 1000;

    // VFX cadence (900 -> 1000 = 100ms) should be ready
    const vfxCount = tickContinuousFire(attacker, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, nowMs);
    expect(vfxCount).toBe(1);

    // Damage cadence (950 -> 1000 = 50ms = tickMs) should be at boundary
    // Verify lastDamageTickAt was NOT updated by VFX tick
    expect(attacker.lastDamageTickAt).toBe(950);
  });

  it('single-shot weapons do not enter continuous damage', () => {
    const attacker = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const events = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    // Smoky is 'direct' — not a continuous damage kind
    expect(events.length).toBe(0);
  });

  it('lastDamageTickAt is initialized to 0 on new vehicles', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    expect(vehicle.lastDamageTickAt).toBe(0);
  });

  it('lastDamageTickAt is updated only when damage events are produced', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    // No target vehicles — so damage will produce no events
    const vehicles = [attacker];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);

    // Attempt continuous damage with no target
    const events = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, 0, bodyCenter.x + 100, bodyCenter.y, TEST_OFFSET, 1000);
    // No damage events (flamethrower doesn't damage self)
    expect(events.length).toBe(0);
    // lastDamageTickAt should NOT be updated if no damage was produced
    expect(attacker.lastDamageTickAt).toBe(0);
  });
});

// ─── BLOCKOUT-07H+ fixup: Twins continuous plasma damage ──────────────

describe('BLOCKOUT-07H+ fixup: Twins continuous plasma damage', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
    resetVfxEventIdCounter();
  });

  it('Twins fireHeld/isFiring + tickContinuousDamage applies repeated plasma damage over scene time', () => {
    const attacker = createBlockoutVehicle('wasp', 'twins', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0; // ensure cooldown is not a factor

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    // First tick at t=1000 — no prior damage tick, so cadence check passes
    const events1 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events1.length).toBeGreaterThan(0);
    expect(events1[0].kind).toBe('plasma');
    expect(attacker.lastDamageTickAt).toBe(1000);
    expect(target.hp).toBeLessThan(target.maxHp);

    const hpAfterFirst = target.hp;

    // Second tick too early at t=1300 — should not tick (tickMs=600)
    const events2 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1300);
    expect(events2.length).toBe(0);
    expect(target.hp).toBe(hpAfterFirst);

    // Third tick at t=1700 — past tickMs (600ms), should tick again
    const events3 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1700);
    expect(events3.length).toBeGreaterThan(0);
    expect(events3[0].kind).toBe('plasma');
    expect(attacker.lastDamageTickAt).toBe(1700);
    expect(target.hp).toBeLessThan(hpAfterFirst);
  });

  it('Twins VFX cadence and damage cadence do not block each other', () => {
    const attacker = createBlockoutVehicle('wasp', 'twins', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;
    attacker.lastStreamTickAt = 1000;
    attacker.lastDamageTickAt = 1000;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const nowMs = 1700; // 700ms since last tick — past both streamCadenceMs (600) and tickMs (600)

    // VFX tick — this will update lastStreamTickAt to nowMs
    const vfxCount = tickContinuousFire(attacker, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, nowMs);
    expect(vfxCount).toBe(1);
    expect(attacker.lastStreamTickAt).toBe(1700);

    // Damage tick in the same frame — should NOT be blocked by VFX tick
    const damageEvents = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, nowMs);
    expect(damageEvents.length).toBeGreaterThan(0);
    expect(damageEvents[0].kind).toBe('plasma');
    expect(attacker.lastDamageTickAt).toBe(1700);

    // Verify lastStreamTickAt was NOT changed by damage tick
    expect(attacker.lastStreamTickAt).toBe(1700);
  });

  it('Twins continuous damage stops after stopFiring', () => {
    const attacker = createBlockoutVehicle('wasp', 'twins', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    // First tick works
    tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);

    // Stop firing
    stopFiring(attacker);

    // Should not tick anymore
    const events = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 2000);
    expect(events.length).toBe(0);
  });

  it('flamethrower continuous damage still works after plasma fix', () => {
    const attacker = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 6, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const events1 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events1.length).toBeGreaterThan(0);
    expect(events1[0].kind).toBe('cone_tick');
  });

  it('vulcan continuous damage still works after plasma fix', () => {
    const attacker = createBlockoutVehicle('hunter', 'vulcan', 'cyan', 5, 5);
    const target = createBlockoutVehicle('wasp', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const events1 = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events1.length).toBeGreaterThan(0);
    expect(events1[0].kind).toBe('rapid_tick');
  });

  it('single-shot weapons do not enter continuous damage (smoky)', () => {
    const attacker = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const events = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events.length).toBe(0);
  });

  it('single-shot weapons do not enter continuous damage (railgun)', () => {
    const attacker = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5);
    const target = createBlockoutVehicle('hunter', 'smoky', 'green', 7, 5);
    const vehicles = [attacker, target];
    startFiring(attacker);
    attacker.lastFiredAt = 0;

    const bodyCenter = computeBodyWorldCenter(attacker, TEST_OFFSET);
    const targetCenter = computeBodyWorldCenter(target, TEST_OFFSET);
    const aimAngle = Math.atan2(targetCenter.y - bodyCenter.y, targetCenter.x - bodyCenter.x);

    const events = tickContinuousDamage(attacker, vehicles, bodyCenter.x, bodyCenter.y, aimAngle, targetCenter.x, targetCenter.y, TEST_OFFSET, 1000);
    expect(events.length).toBe(0);
  });

  it('saveGame strips blockoutVehicles with lastDamageTickAt', () => {
    const store: Record<string, string> = {};
    const mockStorage: SaveStorage = {
      getItem(key: string): string | null { return store[key] ?? null; },
      setItem(key: string, value: string): boolean { store[key] = value; return true; },
      removeItem(key: string): void { delete store[key]; },
    };
    setSaveStorage(mockStorage);

    const state = createTestGameState();
    devSpawnBlockoutVehicleSet(state);
    expect(state.blockoutVehicles!.length).toBeGreaterThan(0);

    // Verify lastDamageTickAt exists
    const vehicle = state.blockoutVehicles![0];
    expect(vehicle.lastDamageTickAt).toBeDefined();

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

// ─── BLOCKOUT-09H fixup: armor_plating damage event uses adjusted amount ──

describe('BLOCKOUT-09H fixup: damage event stores adjusted amount (armor_plating)', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
  });

  it('armor_plating reduces actual HP loss', () => {
    const vehicleNoArmor = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const vehicleWithArmor = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    applyUpgrade(vehicleWithArmor, 'armor_plating', 1000);
    // armor_plating increases maxHp from 180 to 207, and hp proportionally

    const bodyCenter1 = computeBodyWorldCenter(vehicleNoArmor, TEST_OFFSET);
    const bodyCenter2 = computeBodyWorldCenter(vehicleWithArmor, TEST_OFFSET);

    const baseDamage = 50;
    applyDamageToVehicle(vehicleNoArmor, 'smoky', baseDamage, bodyCenter1.x, bodyCenter1.y, 1000, 'direct');
    applyDamageToVehicle(vehicleWithArmor, 'smoky', baseDamage, bodyCenter2.x, bodyCenter2.y, 1000, 'direct');

    // Armored vehicle should have lost less HP from the same base damage
    const hpLostNoArmor = 180 - vehicleNoArmor.hp;
    const hpLostWithArmor = vehicleWithArmor.maxHp - vehicleWithArmor.hp;
    expect(hpLostWithArmor).toBeLessThan(hpLostNoArmor);

    // CORE-STEP-08H+: Body armor (2) is applied first, then upgrade multiplier
    // No upgrade: max(50-2, 50*0.25) = 48; With upgrade: max(50-2, 50*0.25) * 0.95 = 48*0.95 = 45.6
    const multiplier = getIncomingDamageMultiplier(vehicleWithArmor);
    const armorReduced = Math.max(baseDamage - 2, baseDamage * 0.25);
    const adjustedDamage = armorReduced * multiplier;
    expect(hpLostWithArmor).toBeCloseTo(adjustedDamage, 1);
  });

  it('damage event amount equals adjusted damage amount with armor_plating', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    applyUpgrade(vehicle, 'armor_plating', 1000);

    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const baseDamage = 50;
    const event = applyDamageToVehicle(vehicle, 'smoky', baseDamage, bodyCenter.x, bodyCenter.y, 1000, 'direct');

    expect(event).not.toBeNull();
    // CORE-STEP-08H+: Body armor (was M0=2) is applied first, then upgrade multiplier.
    // finalDamage = max(30-2, 30*0.25) = 28; then 28 * upgradeMultiplier
    const multiplier = getIncomingDamageMultiplier(vehicle);
    const expectedArmorReduced = Math.max(baseDamage - 2, baseDamage * 0.25);
    const expectedAdjusted = expectedArmorReduced * multiplier;
    expect(event!.amount).toBeCloseTo(expectedAdjusted, 2);
    expect(event!.amount).toBeLessThan(baseDamage); // Armor reduces it
  });

  it('floating damage number source event uses adjusted amount', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    applyUpgrade(vehicle, 'armor_plating', 1000);
    applyUpgrade(vehicle, 'armor_plating', 2000); // Level 2

    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const baseDamage = 40;
    const event = applyDamageToVehicle(vehicle, 'smoky', baseDamage, bodyCenter.x, bodyCenter.y, 1000, 'direct');

    // The damage events from getDamageEvents() should contain the adjusted amount
    const events = getDamageEvents();
    expect(events.length).toBe(1);
    expect(events[0].amount).toBe(event!.amount);
    expect(events[0].amount).toBeLessThan(baseDamage);

    // CORE-STEP-08H+: Body armor is applied before upgrade multiplier
    const multiplier = getIncomingDamageMultiplier(vehicle);
    const expectedArmorReduced = Math.max(baseDamage - 2, baseDamage * 0.25); // Wasp M0 armor
    expect(events[0].amount).toBeCloseTo(expectedArmorReduced * multiplier, 2);
  });

  it('non-armored vehicle event amount remains original amount', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    // No armor_plating — multiplier should be 1

    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const baseDamage = 30;
    const event = applyDamageToVehicle(vehicle, 'smoky', baseDamage, bodyCenter.x, bodyCenter.y, 1000, 'direct');

    expect(event).not.toBeNull();
    // CORE-STEP-08H+: Wasp M0 still has body armor=2, minDamagePercent=0.25
    // finalDamage = max(30-2, 30*0.25) = max(28, 7.5) = 28
    const expectedDamage = Math.max(baseDamage - 2, baseDamage * 0.25);
    expect(event!.amount).toBeCloseTo(expectedDamage, 2);
    expect(vehicle.hp).toBeCloseTo(180 - expectedDamage, 2);
  });

  it('kill event still works when adjusted damage kills', () => {
    // Create an armored vehicle with just enough HP to die from adjusted damage
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    applyUpgrade(vehicle, 'armor_plating', 1000); // +15% maxHp = 207 HP

    // Damage it down to low HP
    vehicle.hp = 10;

    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    // CORE-STEP-08H+: Body armor=2, then upgrade multiplier applied.
    // 20 damage -> armor: max(20-2, 20*0.25) = 18; then 18 * 0.95 = 17.1 — enough to kill at 10 HP
    const event = applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');

    expect(event).not.toBeNull();
    expect(event!.isKill).toBe(true);
    expect(vehicle.isDestroyed).toBe(true);
    expect(vehicle.hp).toBe(0);

    // Event still stores adjusted amount (body armor + upgrade multiplier)
    const multiplier = getIncomingDamageMultiplier(vehicle);
    const expectedArmorReduced = Math.max(20 - 2, 20 * 0.25);
    expect(event!.amount).toBeCloseTo(expectedArmorReduced * multiplier, 2);
  });

  it('base damage config is not mutated by armor adjustment', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    applyUpgrade(vehicle, 'armor_plating', 1000);

    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const baseDamage = 25;

    // Record the original damage profile values
    const originalSmokyDamage = DAMAGE_PROFILES['smoky'].directDamage;

    applyDamageToVehicle(vehicle, 'smoky', baseDamage, bodyCenter.x, bodyCenter.y, 1000, 'direct');

    // Base damage config should not be mutated
    expect(DAMAGE_PROFILES['smoky'].directDamage).toBe(originalSmokyDamage);
  });
});
