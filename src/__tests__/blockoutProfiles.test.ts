/**
 * Tests for blockout profile data completeness and contract compliance.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 * Tests verify:
 * - All body IDs exist
 * - All weapon IDs exist
 * - Mount categories match accepted roadmap
 * - All vehicle profiles reference valid body/weapon IDs
 * - Body/weapon data completeness
 */

import { describe, it, expect } from 'vitest';
import { BODY_PROFILES, ALL_BODY_IDS, getBodyProfile } from '../config/blockoutBodyData';
import { WEAPON_PROFILES, ALL_WEAPON_IDS, getWeaponProfile } from '../config/blockoutWeaponData';
import { VEHICLE_PROFILES, ALL_VEHICLE_IDS, BLOCKOUT_SPAWN_VEHICLE_IDS } from '../config/blockoutVehicleData';
import { MOVEMENT_PROFILES } from '../config/blockoutMovementData';
import { RECOIL_PROFILES } from '../config/blockoutRecoilData';
import { VFX_PROFILES } from '../config/blockoutVfxData';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';
import { OBSTACLE_TYPE_CONFIGS } from '../config/blockoutObstacleData';
import { UPGRADE_PROFILES } from '../config/blockoutUpgradeData';
import type { MountCategory, BlockoutShape, WeaponBehavior } from '../config/blockoutProfiles';

// ─── Accepted reference data ────────────────────────────────────────

const ACCEPTED_BODY_IDS = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'] as const;

const ACCEPTED_WEAPON_IDS = [
  'smoky', 'thunder', 'railgun', 'shaft', 'flamethrower',
  'freeze', 'isida', 'vulcan', 'twins', 'ricochet', 'hammer',
] as const;

const ACCEPTED_MOUNT_CATEGORIES: Record<string, MountCategory> = {
  wasp: 'rear',
  hornet: 'center_rear',
  hunter: 'center',
  viking: 'center',
  dictator: 'rear',
  titan: 'front_center',
  mammoth: 'front_center',
};

const ACCEPTED_BLOCKOUT_SHAPES: BlockoutShape[] = [
  'small_fast', 'light_fast', 'medium', 'large_fast', 'heavy', 'super_heavy',
];

const ACCEPTED_WEAPON_BEHAVIORS: WeaponBehavior[] = [
  'instant_projectile', 'instant_splash', 'line_pierce', 'charge_sniper',
  'cone_stream', 'beam_support', 'rapid_fire_overheat', 'plasma_projectile',
  'ricochet_projectile', 'shotgun_cone',
];

// ─── Body profile tests ─────────────────────────────────────────────

describe('blockout body profiles', () => {
  it('should have all 7 accepted body IDs', () => {
    for (const id of ACCEPTED_BODY_IDS) {
      expect(BODY_PROFILES[id], `Missing body profile: ${id}`).toBeDefined();
    }
  });

  it('should have exactly 7 body profiles', () => {
    expect(ALL_BODY_IDS).toHaveLength(7);
  });

  it('should have correct mount categories matching roadmap', () => {
    for (const [bodyId, expectedCategory] of Object.entries(ACCEPTED_MOUNT_CATEGORIES)) {
      const profile = BODY_PROFILES[bodyId];
      expect(profile, `Missing body: ${bodyId}`).toBeDefined();
      expect(profile!.mountCategory, `Wrong mount category for ${bodyId}`).toBe(expectedCategory);
    }
  });

  it('should have valid blockout shapes', () => {
    for (const id of ALL_BODY_IDS) {
      const profile = BODY_PROFILES[id];
      expect(profile).toBeDefined();
      expect(ACCEPTED_BLOCKOUT_SHAPES, `Invalid blockout shape for ${id}: ${profile!.blockoutShape}`).toContain(profile!.blockoutShape);
    }
  });

  it('should have complete referenceM3 data for all bodies', () => {
    for (const id of ALL_BODY_IDS) {
      const profile = BODY_PROFILES[id];
      expect(profile).toBeDefined();
      const m3 = profile!.referenceM3;
      expect(m3.hp).toBeGreaterThan(0);
      expect(m3.maxSpeed).toBeGreaterThan(0);
      expect(m3.turnSpeedDeg).toBeGreaterThan(0);
      expect(m3.massKg).toBeGreaterThan(0);
      expect(m3.enginePower).toBeGreaterThan(0);
    }
  });

  it('should have mountOffsetNormalized for all bodies', () => {
    for (const id of ALL_BODY_IDS) {
      const profile = BODY_PROFILES[id];
      expect(profile).toBeDefined();
      expect(profile!.mountOffsetNormalized).toBeDefined();
      expect(profile!.mountOffsetNormalized.x).toBeGreaterThanOrEqual(0);
      expect(profile!.mountOffsetNormalized.x).toBeLessThanOrEqual(1);
    }
  });

  it('should return correct profile via getBodyProfile', () => {
    expect(getBodyProfile('wasp')?.displayName).toBe('Wasp');
    expect(getBodyProfile('nonexistent')).toBeUndefined();
  });

  it('should have size differentiation: Wasp < Mammoth', () => {
    const wasp = BODY_PROFILES['wasp'];
    const mammoth = BODY_PROFILES['mammoth'];
    expect(wasp).toBeDefined();
    expect(mammoth).toBeDefined();
    expect(wasp!.referenceM3.massKg).toBeLessThan(mammoth!.referenceM3.massKg);
    expect(wasp!.referenceM3.maxSpeed).toBeGreaterThan(mammoth!.referenceM3.maxSpeed);
  });
});

// ─── Weapon profile tests ───────────────────────────────────────────

describe('blockout weapon profiles', () => {
  it('should have all 11 accepted weapon IDs', () => {
    for (const id of ACCEPTED_WEAPON_IDS) {
      expect(WEAPON_PROFILES[id], `Missing weapon profile: ${id}`).toBeDefined();
    }
  });

  it('should have exactly 11 weapon profiles', () => {
    expect(ALL_WEAPON_IDS).toHaveLength(11);
  });

  it('should have valid weapon behaviors', () => {
    for (const id of ALL_WEAPON_IDS) {
      const profile = WEAPON_PROFILES[id];
      expect(profile).toBeDefined();
      expect(ACCEPTED_WEAPON_BEHAVIORS, `Invalid behavior for ${id}: ${profile!.behavior}`).toContain(profile!.behavior);
    }
  });

  it('should have barrel length for blockout rendering', () => {
    for (const id of ALL_WEAPON_IDS) {
      const profile = WEAPON_PROFILES[id];
      expect(profile).toBeDefined();
      expect(profile!.blockoutBarrelLength).toBeGreaterThan(0);
      expect(profile!.blockoutBarrelWidth).toBeGreaterThan(0);
    }
  });

  it('should have turret turn speed for blockout aiming (BLOCKOUT-03H)', () => {
    for (const id of ALL_WEAPON_IDS) {
      const profile = WEAPON_PROFILES[id];
      expect(profile).toBeDefined();
      expect(profile!.blockoutTurretTurnSpeedDeg, `Missing blockoutTurretTurnSpeedDeg for ${id}`).toBeGreaterThan(0);
    }
  });

  it('should have turret turn speed differentiation: Smoky > Railgun (BLOCKOUT-03H)', () => {
    const smoky = WEAPON_PROFILES['smoky'];
    const railgun = WEAPON_PROFILES['railgun'];
    expect(smoky).toBeDefined();
    expect(railgun).toBeDefined();
    expect(smoky!.blockoutTurretTurnSpeedDeg).toBeGreaterThan(railgun!.blockoutTurretTurnSpeedDeg);
  });

  it('should have barrel length differentiation: Railgun > Smoky', () => {
    const railgun = WEAPON_PROFILES['railgun'];
    const smoky = WEAPON_PROFILES['smoky'];
    expect(railgun).toBeDefined();
    expect(smoky).toBeDefined();
    expect(railgun!.blockoutBarrelLength).toBeGreaterThan(smoky!.blockoutBarrelLength);
  });

  it('should have damage model for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const profile = WEAPON_PROFILES[id];
      expect(profile).toBeDefined();
      expect(profile!.damageModel).toBeDefined();
    }
  });

  it('should return correct profile via getWeaponProfile', () => {
    expect(getWeaponProfile('smoky')?.displayName).toBe('Smoky');
    expect(getWeaponProfile('nonexistent')).toBeUndefined();
  });

  it('should match specific weapon behavior mapping', () => {
    expect(WEAPON_PROFILES['smoky']?.behavior).toBe('instant_projectile');
    expect(WEAPON_PROFILES['thunder']?.behavior).toBe('instant_splash');
    expect(WEAPON_PROFILES['railgun']?.behavior).toBe('line_pierce');
    expect(WEAPON_PROFILES['shaft']?.behavior).toBe('charge_sniper');
    expect(WEAPON_PROFILES['flamethrower']?.behavior).toBe('cone_stream');
    expect(WEAPON_PROFILES['freeze']?.behavior).toBe('cone_stream');
    expect(WEAPON_PROFILES['isida']?.behavior).toBe('beam_support');
    expect(WEAPON_PROFILES['vulcan']?.behavior).toBe('rapid_fire_overheat');
    expect(WEAPON_PROFILES['twins']?.behavior).toBe('plasma_projectile');
    expect(WEAPON_PROFILES['ricochet']?.behavior).toBe('ricochet_projectile');
    expect(WEAPON_PROFILES['hammer']?.behavior).toBe('shotgun_cone');
  });
});

// ─── Vehicle profile tests ──────────────────────────────────────────

describe('blockout vehicle profiles', () => {
  it('should have at least one vehicle profile', () => {
    expect(ALL_VEHICLE_IDS.length).toBeGreaterThan(0);
  });

  it('should reference valid body IDs', () => {
    for (const id of ALL_VEHICLE_IDS) {
      const profile = VEHICLE_PROFILES[id];
      expect(profile).toBeDefined();
      expect(BODY_PROFILES[profile!.bodyId], `Vehicle ${id} references unknown body: ${profile!.bodyId}`).toBeDefined();
    }
  });

  it('should reference valid weapon IDs', () => {
    for (const id of ALL_VEHICLE_IDS) {
      const profile = VEHICLE_PROFILES[id];
      expect(profile).toBeDefined();
      expect(WEAPON_PROFILES[profile!.weaponId], `Vehicle ${id} references unknown weapon: ${profile!.weaponId}`).toBeDefined();
    }
  });

  it('should have the minimum expected spawn set', () => {
    for (const vehicleId of BLOCKOUT_SPAWN_VEHICLE_IDS) {
      const profile = VEHICLE_PROFILES[vehicleId];
      expect(profile, `Missing spawn vehicle: ${vehicleId}`).toBeDefined();
      expect(profile!.blockoutEnabled, `Spawn vehicle ${vehicleId} not enabled`).toBe(true);
    }
  });

  it('should have Wasp+Smoky in spawn set', () => {
    const profile = VEHICLE_PROFILES['wasp-smoky'];
    expect(profile).toBeDefined();
    expect(profile!.bodyId).toBe('wasp');
    expect(profile!.weaponId).toBe('smoky');
  });

  it('should have Dictator+Railgun in spawn set', () => {
    const profile = VEHICLE_PROFILES['dictator-railgun'];
    expect(profile).toBeDefined();
    expect(profile!.bodyId).toBe('dictator');
    expect(profile!.weaponId).toBe('railgun');
  });

  it('should have Mammoth+Thunder in spawn set', () => {
    const profile = VEHICLE_PROFILES['mammoth-thunder'];
    expect(profile).toBeDefined();
    expect(profile!.bodyId).toBe('mammoth');
    expect(profile!.weaponId).toBe('thunder');
  });
});

// ─── Supporting profile tests ───────────────────────────────────────

describe('blockout supporting profiles', () => {
  it('should have movement profiles for all 7 bodies', () => {
    for (const bodyId of ACCEPTED_BODY_IDS) {
      expect(MOVEMENT_PROFILES[bodyId], `Missing movement profile: ${bodyId}`).toBeDefined();
    }
  });

  it('should have recoil profiles for all 11 weapons', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      expect(RECOIL_PROFILES[weaponId], `Missing recoil profile: ${weaponId}`).toBeDefined();
    }
  });

  it('should have VFX profiles for all weapon behaviors', () => {
    for (const behavior of ACCEPTED_WEAPON_BEHAVIORS) {
      expect(VFX_PROFILES[behavior], `Missing VFX profile: ${behavior}`).toBeDefined();
    }
  });

  it('should have damage profiles for all 11 weapons', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      expect(DAMAGE_PROFILES[weaponId], `Missing damage profile: ${weaponId}`).toBeDefined();
    }
  });

  it('should have obstacle type configs for blockout obstacle types', () => {
    const expectedTypes = ['blocker_wall', 'cover_crate', 'low_barrier', 'dummy_rock'];
    for (const type of expectedTypes) {
      expect(OBSTACLE_TYPE_CONFIGS[type as keyof typeof OBSTACLE_TYPE_CONFIGS], `Missing obstacle type config: ${type}`).toBeDefined();
    }
  });

  it('should have upgrade profiles in all categories', () => {
    const categories = new Set(Object.values(UPGRADE_PROFILES).map(u => u.category));
    expect(categories.has('body')).toBe(true);
    expect(categories.has('turret')).toBe(true);
    expect(categories.has('weapon')).toBe(true);
    expect(categories.has('utility')).toBe(true);
  });

  it('should have all recoil profiles with cameraShake=false', () => {
    for (const weaponId of ACCEPTED_WEAPON_IDS) {
      const profile = RECOIL_PROFILES[weaponId];
      expect(profile).toBeDefined();
      expect(profile!.cameraShake).toBe(false);
    }
  });
});
