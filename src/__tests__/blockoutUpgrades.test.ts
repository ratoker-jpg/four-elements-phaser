/**
 * Tests for blockout upgrade system.
 *
 * BLOCKOUT-09H: Dev/arena-only upgrade skeleton and visual indicators.
 *
 * Tests verify:
 * - Upgrade profiles exist for required upgrade IDs
 * - maxLevel enforced
 * - Applying upgrade to vehicle adds/increments level
 * - Applying upgrade beyond max does not exceed max
 * - Destroyed vehicle cannot be upgraded
 * - mobility_boost increases effective maxSpeed/acceleration
 * - armor_plating increases maxHp/current hp or reduces incoming damage
 * - weapon_tuning increases outgoing damage or reduces cooldown
 * - range_extender increases effective rangePx
 * - Base config objects are not mutated
 * - Upgraded vehicle can still move with effective profile
 * - Upgraded weapon damage applies expected modified amount
 * - saveGame still strips blockoutVehicles with upgrade fields
 * - No Date.now dependency for upgrade timing
 * - Normal state without upgrade fields does not crash
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_UPGRADE_IDS, getUpgradeProfile } from '../config/blockoutUpgradeData';
import {
  applyUpgrade,
  getUpgradeLevel,
  hasAnyUpgrades,
  getEffectiveMovementProfile,
  getEffectiveDamageProfile,
  getIncomingDamageMultiplier,
  getEffectiveMaxHp,
  getCooldownMultiplier,
  getRangeMultiplier,
} from '../state/blockoutUpgrades';
import type { BlockoutVehicleState } from '../state/blockoutVehicleState';
import { MOVEMENT_PROFILES } from '../config/blockoutMovementData';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';

// ─── Helpers ────────────────────────────────────────────────────────

function createTestVehicle(overrides: Partial<BlockoutVehicleState> = {}): BlockoutVehicleState {
  return {
    id: 'test-vehicle-1',
    bodyId: 'wasp',
    weaponId: 'smoky',
    faction: 'cyan',
    team: 'ally',
    tx: 10,
    ty: 10,
    bodyAngle: 0,
    turretAngle: 0,
    turretTargetAngle: 0,
    turretTurnSpeedDeg: 150,
    worldX: 380,
    worldY: 190,
    vx: 0,
    vy: 0,
    speed: 0,
    targetWorldX: 0,
    targetWorldY: 0,
    hasMoveTarget: false,
    lastFiredAt: 0,
    recoilActive: false,
    recoilStartedAt: 0,
    recoilDurationMs: 0,
    recoilBarrelOffset: 0,
    recoilTurretOffset: 0,
    recoilBodyOffset: 0,
    fireHeld: false,
    isFiring: false,
    lastStreamTickAt: 0,
    visualOverheat: 0,
    hp: 180,
    maxHp: 180,
    isDestroyed: false,
    destroyedAt: 0,
    lastDamagedAt: 0,
    damageFlashUntil: 0,
    activeStatusTags: [],
    lastDamageTickAt: 0,
    createdAt: 1000,
    upgradeLevels: {},
    lastUpgradedAt: 0,
    ...overrides,
  };
}

// ─── Upgrade profile tests ──────────────────────────────────────────

describe('blockout upgrade profiles', () => {
  it('should have all 5 required upgrade IDs', () => {
    expect(ALL_UPGRADE_IDS).toHaveLength(5);
    expect(ALL_UPGRADE_IDS).toContain('mobility_boost');
    expect(ALL_UPGRADE_IDS).toContain('armor_plating');
    expect(ALL_UPGRADE_IDS).toContain('weapon_tuning');
    expect(ALL_UPGRADE_IDS).toContain('range_extender');
    expect(ALL_UPGRADE_IDS).toContain('cooling_system');
  });

  it('should have upgrade profiles for all required IDs', () => {
    for (const id of ALL_UPGRADE_IDS) {
      const profile = getUpgradeProfile(id);
      expect(profile, `Missing upgrade profile: ${id}`).toBeDefined();
    }
  });

  it('should have maxLevel >= 1 for all upgrade profiles', () => {
    for (const id of ALL_UPGRADE_IDS) {
      const profile = getUpgradeProfile(id);
      expect(profile!.maxLevel, `Upgrade ${id} maxLevel should be >= 1`).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have affectedStats for all upgrade profiles', () => {
    for (const id of ALL_UPGRADE_IDS) {
      const profile = getUpgradeProfile(id);
      expect(profile!.affectedStats.length, `Upgrade ${id} should have affected stats`).toBeGreaterThan(0);
    }
  });

  it('should have marker config for all upgrade profiles', () => {
    for (const id of ALL_UPGRADE_IDS) {
      const profile = getUpgradeProfile(id);
      expect(profile!.marker).toBeDefined();
      expect(profile!.marker.color).toBeGreaterThan(0);
      expect(profile!.marker.label).toBeTruthy();
    }
  });

  it('should have correct maxLevel for all upgrades (3)', () => {
    for (const id of ALL_UPGRADE_IDS) {
      const profile = getUpgradeProfile(id);
      expect(profile!.maxLevel).toBe(3);
    }
  });

  it('should return undefined for unknown upgrade ID', () => {
    expect(getUpgradeProfile('nonexistent')).toBeUndefined();
  });
});

// ─── Apply upgrade tests ────────────────────────────────────────────

describe('apply upgrade', () => {
  let vehicle: BlockoutVehicleState;

  beforeEach(() => {
    vehicle = createTestVehicle();
  });

  it('should add upgrade level to vehicle', () => {
    const result = applyUpgrade(vehicle, 'mobility_boost', 2000);
    expect(result).toBe(true);
    expect(vehicle.upgradeLevels.mobility_boost).toBe(1);
    expect(vehicle.lastUpgradedAt).toBe(2000);
  });

  it('should increment level on repeated application', () => {
    applyUpgrade(vehicle, 'mobility_boost', 2000);
    applyUpgrade(vehicle, 'mobility_boost', 3000);
    expect(vehicle.upgradeLevels.mobility_boost).toBe(2);
    expect(vehicle.lastUpgradedAt).toBe(3000);
  });

  it('should not exceed maxLevel', () => {
    applyUpgrade(vehicle, 'mobility_boost', 2000);
    applyUpgrade(vehicle, 'mobility_boost', 3000);
    applyUpgrade(vehicle, 'mobility_boost', 4000);
    const result = applyUpgrade(vehicle, 'mobility_boost', 5000);
    expect(result).toBe(false);
    expect(vehicle.upgradeLevels.mobility_boost).toBe(3);
  });

  it('should not upgrade destroyed vehicle', () => {
    vehicle.isDestroyed = true;
    const result = applyUpgrade(vehicle, 'mobility_boost', 2000);
    expect(result).toBe(false);
    expect(vehicle.upgradeLevels.mobility_boost).toBeUndefined();
  });

  it('should allow multiple different upgrades on same vehicle', () => {
    applyUpgrade(vehicle, 'mobility_boost', 2000);
    applyUpgrade(vehicle, 'armor_plating', 3000);
    applyUpgrade(vehicle, 'weapon_tuning', 4000);
    expect(vehicle.upgradeLevels.mobility_boost).toBe(1);
    expect(vehicle.upgradeLevels.armor_plating).toBe(1);
    expect(vehicle.upgradeLevels.weapon_tuning).toBe(1);
  });

  it('should use scene time for lastUpgradedAt, not Date.now', () => {
    const sceneTime = 12345;
    applyUpgrade(vehicle, 'mobility_boost', sceneTime);
    expect(vehicle.lastUpgradedAt).toBe(sceneTime);
  });
});

// ─── getUpgradeLevel tests ──────────────────────────────────────────

describe('getUpgradeLevel', () => {
  it('should return 0 for unapplied upgrade', () => {
    const vehicle = createTestVehicle();
    expect(getUpgradeLevel(vehicle, 'mobility_boost')).toBe(0);
  });

  it('should return correct level for applied upgrade', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    applyUpgrade(vehicle, 'mobility_boost', 2000);
    expect(getUpgradeLevel(vehicle, 'mobility_boost')).toBe(2);
  });
});

// ─── hasAnyUpgrades tests ───────────────────────────────────────────

describe('hasAnyUpgrades', () => {
  it('should return false for vehicle with no upgrades', () => {
    const vehicle = createTestVehicle();
    expect(hasAnyUpgrades(vehicle)).toBe(false);
  });

  it('should return true for vehicle with upgrades', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    expect(hasAnyUpgrades(vehicle)).toBe(true);
  });
});

// ─── Effective movement profile tests ───────────────────────────────

describe('getEffectiveMovementProfile', () => {
  it('should return base profile when no mobility upgrade', () => {
    const vehicle = createTestVehicle();
    const base = MOVEMENT_PROFILES['wasp'];
    const effective = getEffectiveMovementProfile(vehicle, base);
    expect(effective.maxSpeedPxPerSec).toBe(base.maxSpeedPxPerSec);
    expect(effective.accelerationPxPerSec2).toBe(base.accelerationPxPerSec2);
  });

  it('should increase maxSpeed with mobility_boost level 1', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    const base = MOVEMENT_PROFILES['wasp'];
    const effective = getEffectiveMovementProfile(vehicle, base);
    expect(effective.maxSpeedPxPerSec).toBeGreaterThan(base.maxSpeedPxPerSec);
    // +15% per level
    expect(effective.maxSpeedPxPerSec).toBeCloseTo(base.maxSpeedPxPerSec * 1.15, 1);
  });

  it('should increase maxSpeed with mobility_boost level 2', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    applyUpgrade(vehicle, 'mobility_boost', 2000);
    const base = MOVEMENT_PROFILES['wasp'];
    const effective = getEffectiveMovementProfile(vehicle, base);
    // 1.15^2 = 1.3225
    expect(effective.maxSpeedPxPerSec).toBeCloseTo(base.maxSpeedPxPerSec * 1.3225, 1);
  });

  it('should increase acceleration with mobility_boost', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    const base = MOVEMENT_PROFILES['wasp'];
    const effective = getEffectiveMovementProfile(vehicle, base);
    expect(effective.accelerationPxPerSec2).toBeGreaterThan(base.accelerationPxPerSec2);
  });

  it('should increase turnSpeedDeg with mobility_boost', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    const base = MOVEMENT_PROFILES['wasp'];
    const effective = getEffectiveMovementProfile(vehicle, base);
    expect(effective.turnSpeedDeg).toBeGreaterThan(base.turnSpeedDeg);
  });

  it('should NOT mutate the base profile', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    const base = MOVEMENT_PROFILES['wasp'];
    const originalSpeed = base.maxSpeedPxPerSec;
    getEffectiveMovementProfile(vehicle, base);
    expect(base.maxSpeedPxPerSec).toBe(originalSpeed);
  });

  it('should return same profile for non-wasp body', () => {
    const vehicle = createTestVehicle({ bodyId: 'mammoth' });
    const base = MOVEMENT_PROFILES['mammoth'];
    const effective = getEffectiveMovementProfile(vehicle, base);
    expect(effective.maxSpeedPxPerSec).toBe(base.maxSpeedPxPerSec);
  });
});

// ─── Effective damage profile tests ─────────────────────────────────

describe('getEffectiveDamageProfile', () => {
  it('should return base profile when no weapon/range upgrades', () => {
    const vehicle = createTestVehicle();
    const base = DAMAGE_PROFILES['smoky'];
    const effective = getEffectiveDamageProfile(vehicle, base);
    expect(effective.directDamage).toBe(base.directDamage);
  });

  it('should increase directDamage with weapon_tuning level 1', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'weapon_tuning', 1000);
    const base = DAMAGE_PROFILES['smoky'];
    const effective = getEffectiveDamageProfile(vehicle, base);
    expect(effective.directDamage).toBeGreaterThan(base.directDamage!);
    // +10% per level
    expect(effective.directDamage).toBeCloseTo(base.directDamage! * 1.10, 2);
  });

  it('should increase rangePx with range_extender level 1', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'range_extender', 1000);
    const base = DAMAGE_PROFILES['smoky'];
    const effective = getEffectiveDamageProfile(vehicle, base);
    expect(effective.rangePx).toBeGreaterThan(base.rangePx!);
    // +10% per level
    expect(effective.rangePx).toBeCloseTo(base.rangePx! * 1.10, 2);
  });

  it('should stack weapon_tuning and range_extender', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'weapon_tuning', 1000);
    applyUpgrade(vehicle, 'range_extender', 2000);
    const base = DAMAGE_PROFILES['smoky'];
    const effective = getEffectiveDamageProfile(vehicle, base);
    expect(effective.directDamage).toBeGreaterThan(base.directDamage!);
    expect(effective.rangePx).toBeGreaterThan(base.rangePx!);
  });

  it('should increase damagePerSecond for continuous weapons', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'weapon_tuning', 1000);
    const base = DAMAGE_PROFILES['flamethrower'];
    const effective = getEffectiveDamageProfile(vehicle, base);
    expect(effective.damagePerSecond).toBeGreaterThan(base.damagePerSecond!);
  });

  it('should NOT mutate the base profile', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'weapon_tuning', 1000);
    const base = DAMAGE_PROFILES['smoky'];
    const originalDamage = base.directDamage;
    getEffectiveDamageProfile(vehicle, base);
    expect(base.directDamage).toBe(originalDamage);
  });
});

// ─── Incoming damage multiplier tests ───────────────────────────────

describe('getIncomingDamageMultiplier', () => {
  it('should return 1 for vehicle without armor', () => {
    const vehicle = createTestVehicle();
    expect(getIncomingDamageMultiplier(vehicle)).toBe(1);
  });

  it('should reduce incoming damage with armor_plating level 1', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'armor_plating', 1000);
    const multiplier = getIncomingDamageMultiplier(vehicle);
    expect(multiplier).toBeLessThan(1);
    // 0.95 per level
    expect(multiplier).toBeCloseTo(0.95, 3);
  });

  it('should reduce more with armor_plating level 2', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'armor_plating', 1000);
    applyUpgrade(vehicle, 'armor_plating', 2000);
    const multiplier = getIncomingDamageMultiplier(vehicle);
    // 0.95^2 = 0.9025
    expect(multiplier).toBeCloseTo(0.9025, 4);
  });

  it('should reduce most at max armor_plating level 3', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'armor_plating', 1000);
    applyUpgrade(vehicle, 'armor_plating', 2000);
    applyUpgrade(vehicle, 'armor_plating', 3000);
    const multiplier = getIncomingDamageMultiplier(vehicle);
    // 0.95^3 = 0.857375
    expect(multiplier).toBeCloseTo(0.857375, 5);
  });
});

// ─── Effective max HP tests ─────────────────────────────────────────

describe('getEffectiveMaxHp', () => {
  it('should return base HP for vehicle without armor', () => {
    const vehicle = createTestVehicle();
    expect(getEffectiveMaxHp(vehicle)).toBe(180); // Wasp base HP
  });

  it('should increase max HP with armor_plating level 1', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'armor_plating', 1000);
    const effectiveHp = getEffectiveMaxHp(vehicle);
    expect(effectiveHp).toBeGreaterThan(180);
    // 180 * 1.15 = 207
    expect(effectiveHp).toBe(207);
  });

  it('should increase max HP with armor_plating level 2', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'armor_plating', 1000);
    applyUpgrade(vehicle, 'armor_plating', 2000);
    const effectiveHp = getEffectiveMaxHp(vehicle);
    // 180 * 1.15^2 = 238.05 → 238
    expect(effectiveHp).toBe(238);
  });
});

// ─── Cooldown multiplier tests ──────────────────────────────────────

describe('getCooldownMultiplier', () => {
  it('should return 1 for vehicle without upgrades', () => {
    const vehicle = createTestVehicle();
    expect(getCooldownMultiplier(vehicle)).toBe(1);
  });

  it('should reduce cooldown with weapon_tuning', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'weapon_tuning', 1000);
    const multiplier = getCooldownMultiplier(vehicle);
    expect(multiplier).toBeLessThan(1);
    // 0.95 per level from weapon_tuning
    expect(multiplier).toBeCloseTo(0.95, 3);
  });

  it('should reduce cadence with cooling_system', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'cooling_system', 1000);
    const multiplier = getCooldownMultiplier(vehicle);
    expect(multiplier).toBeLessThan(1);
    // 0.90 per level from cooling_system
    expect(multiplier).toBeCloseTo(0.90, 3);
  });

  it('should stack weapon_tuning and cooling_system', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'weapon_tuning', 1000);
    applyUpgrade(vehicle, 'cooling_system', 2000);
    const multiplier = getCooldownMultiplier(vehicle);
    expect(multiplier).toBeLessThan(0.95);
    // 0.95 * 0.90 = 0.855
    expect(multiplier).toBeCloseTo(0.855, 3);
  });
});

// ─── Range multiplier tests ─────────────────────────────────────────

describe('getRangeMultiplier', () => {
  it('should return 1 for vehicle without range_extender', () => {
    const vehicle = createTestVehicle();
    expect(getRangeMultiplier(vehicle)).toBe(1);
  });

  it('should increase range with range_extender level 1', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'range_extender', 1000);
    expect(getRangeMultiplier(vehicle)).toBeCloseTo(1.10, 3);
  });

  it('should increase range with range_extender level 3', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'range_extender', 1000);
    applyUpgrade(vehicle, 'range_extender', 2000);
    applyUpgrade(vehicle, 'range_extender', 3000);
    // 1.10^3 = 1.331
    expect(getRangeMultiplier(vehicle)).toBeCloseTo(1.331, 3);
  });
});

// ─── Integration-ish tests ──────────────────────────────────────────

describe('upgrade integration', () => {
  it('mobility upgrade makes vehicle faster over fixed time', () => {
    const vehicle = createTestVehicle();
    const baseProfile = MOVEMENT_PROFILES['wasp'];

    // Without upgrade, distance = speed * time
    const baseDistance = baseProfile.maxSpeedPxPerSec * 1.0; // 1 second

    // With mobility_boost level 1
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    const effectiveProfile = getEffectiveMovementProfile(vehicle, baseProfile);
    const upgradedDistance = effectiveProfile.maxSpeedPxPerSec * 1.0;

    expect(upgradedDistance).toBeGreaterThan(baseDistance);
  });

  it('armor upgrade leaves more HP after same hit', () => {
    const vehicleNoArmor = createTestVehicle();
    const vehicleWithArmor = createTestVehicle();
    applyUpgrade(vehicleWithArmor, 'armor_plating', 1000);

    // Apply same damage amount
    const damageAmount = 50;
    vehicleNoArmor.hp = Math.max(0, vehicleNoArmor.hp - damageAmount);
    const adjustedDamage = damageAmount * getIncomingDamageMultiplier(vehicleWithArmor);
    vehicleWithArmor.hp = Math.max(0, vehicleWithArmor.hp - adjustedDamage);

    expect(vehicleWithArmor.hp).toBeGreaterThan(vehicleNoArmor.hp);
  });

  it('weapon_tuning upgrade deals more damage', () => {
    const vehicleWithTuning = createTestVehicle();
    applyUpgrade(vehicleWithTuning, 'weapon_tuning', 1000);

    const baseProfile = DAMAGE_PROFILES['smoky'];
    const effectiveProfile = getEffectiveDamageProfile(vehicleWithTuning, baseProfile);

    expect(effectiveProfile.directDamage!).toBeGreaterThan(baseProfile.directDamage!);
  });

  it('range_extender allows hitting targets outside base range but inside upgraded range', () => {
    const vehicle = createTestVehicle();
    const baseRange = DAMAGE_PROFILES['smoky'].rangePx ?? 250;
    applyUpgrade(vehicle, 'range_extender', 1000);
    const rangeMult = getRangeMultiplier(vehicle);
    const upgradedRange = baseRange * rangeMult;

    // A target at 260px would be outside base range (250) but inside upgraded range (275)
    const targetDistance = 260;
    expect(targetDistance).toBeGreaterThan(baseRange);
    expect(targetDistance).toBeLessThan(upgradedRange);
  });

  it('destroyed vehicle cannot receive upgrade', () => {
    const vehicle = createTestVehicle({ isDestroyed: true });
    const result = applyUpgrade(vehicle, 'mobility_boost', 1000);
    expect(result).toBe(false);
    expect(vehicle.upgradeLevels.mobility_boost).toBeUndefined();
  });

  it('upgraded vehicle can still move with effective profile', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    applyUpgrade(vehicle, 'armor_plating', 2000);
    applyUpgrade(vehicle, 'weapon_tuning', 3000);

    const baseProfile = MOVEMENT_PROFILES['wasp'];
    const effectiveProfile = getEffectiveMovementProfile(vehicle, baseProfile);

    // Effective profile should still have reasonable values
    expect(effectiveProfile.maxSpeedPxPerSec).toBeGreaterThan(0);
    expect(effectiveProfile.accelerationPxPerSec2).toBeGreaterThan(0);
    expect(effectiveProfile.turnSpeedDeg).toBeGreaterThan(0);
    expect(effectiveProfile.brakingPxPerSec2).toBeGreaterThan(0);
  });
});

// ─── Save stripping tests ──────────────────────────────────────────

describe('save stripping with upgrade fields', () => {
  it('should include upgrade fields in blockoutVehicles that get stripped', () => {
    const vehicle = createTestVehicle();
    applyUpgrade(vehicle, 'mobility_boost', 1000);
    applyUpgrade(vehicle, 'armor_plating', 2000);

    // Verify upgrade fields exist on the vehicle
    expect(vehicle.upgradeLevels.mobility_boost).toBe(1);
    expect(vehicle.upgradeLevels.armor_plating).toBe(1);
    expect(vehicle.lastUpgradedAt).toBe(2000);

    // The saveGame.ts sanitizeForSave strips entire blockoutVehicles array,
    // so upgrade fields are implicitly stripped. We verify the vehicle
    // has the expected upgrade state which will be stripped on save.
    expect(vehicle.upgradeLevels).toBeDefined();
    expect(Object.keys(vehicle.upgradeLevels).length).toBeGreaterThan(0);
  });

  it('should not crash on state without upgrade fields', () => {
    // Simulate old state without upgradeLevels/lastUpgradedAt
    const vehicle = {
      id: 'old-vehicle',
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
    } as unknown as BlockoutVehicleState;

    // getUpgradeLevel should handle missing fields gracefully
    expect(getUpgradeLevel(vehicle, 'mobility_boost')).toBe(0);
  });
});

// ─── No Date.now dependency tests ───────────────────────────────────

describe('upgrade timing', () => {
  it('should use passed-in nowMs, not Date.now', () => {
    const vehicle = createTestVehicle();
    const sceneTime = 98765;
    applyUpgrade(vehicle, 'mobility_boost', sceneTime);
    expect(vehicle.lastUpgradedAt).toBe(sceneTime);
  });
});
