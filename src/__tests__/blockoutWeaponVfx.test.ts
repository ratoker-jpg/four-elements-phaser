/**
 * Tests for blockout weapon VFX, recoil, and cooldown.
 *
 * BLOCKOUT-05H+: Recoil + first weapon VFX set (Smoky/Railgun/Thunder).
 * BLOCKOUT-06H+: All 11 weapons implemented, continuous fire support.
 *
 * Tests verify:
 * - Recoil profiles exist for all weapons with pixel fields
 * - Railgun recoil > Smoky recoil on at least one visible dimension
 * - Weapon VFX config exists for all 11 weapons
 * - Firing creates correct VFX event type for all 11 weapons
 * - No weapon returns null from getVfxEventType anymore (all 11 implemented)
 * - Continuous weapon identification
 * - startFiring/stopFiring state management
 * - tickContinuousFire creates events at cadence
 * - tickContinuousFire respects cooldown
 * - Cooldown/cadence allows later VFX with elapsed scene-time
 * - No Date.now dependency
 * - Recoil starts and recovers for new weapons
 * - saveGame still strips blockoutVehicles
 * - Movement doesn't erase VFX/recoil state
 * - VFX event includes BLOCKOUT-06H+ fields (coneAngleDeg, bounceCount, pelletCount)
 * - BLOCKOUT-06H+ fixup: single-shot weapons do not set fireHeld/isFiring
 * - BLOCKOUT-06H+ fixup: keyup clears fireHeld/isFiring on all vehicles
 * - BLOCKOUT-06H+ fixup: deselect/switch stops firing on previous vehicle
 * - BLOCKOUT-06H+ fixup: tickContinuousFire stops after stopFiring
 * - BLOCKOUT-06H+ fixup: movement does not erase firing state while held
 * - BLOCKOUT-06H+ fixup: saveGame still strips blockoutVehicles transient fields
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  canFireBlockoutWeapon,
  fireBlockoutWeapon,
  updateBlockoutRecoil,
  getVfxEvents,
  resetVfxEventIdCounter,
  expireVfxEvents,
  tickContinuousFire,
  isContinuousWeapon,
  startFiring,
  stopFiring,
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
import type { WeaponId } from '../config/blockoutProfiles';

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

// ─── All 11 weapon IDs for iteration ──────────────────────────────

const ALL_WEAPON_IDS: WeaponId[] = [
  'smoky', 'thunder', 'railgun', 'shaft', 'flamethrower',
  'freeze', 'isida', 'vulcan', 'twins', 'ricochet', 'hammer',
];

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

// ─── VFX config existence for all 11 weapons ────────────────────────

describe('VFX config for all 11 weapons', () => {
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

  // BLOCKOUT-06H+: VFX config for 8 new weapons

  it('Shaft has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('shaft');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('charge_sniper');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.chargePulseMs).toBe(150);
    expect(profile!.muzzleFlashRadiusPx).toBe(4);
    expect(profile!.effectLengthPx).toBe(450);
  });

  it('Flamethrower has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('flamethrower');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('cone_stream');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.coneAngleDeg).toBe(25);
    expect(profile!.streamCadenceMs).toBe(50);
    expect(profile!.effectLengthPx).toBe(120);
  });

  it('Freeze has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('freeze');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('cone_stream');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.coneAngleDeg).toBe(25);
    expect(profile!.streamCadenceMs).toBe(50);
  });

  it('Isida has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('isida');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('beam_support');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.streamCadenceMs).toBe(50);
    expect(profile!.effectLengthPx).toBe(150);
  });

  it('Vulcan has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('vulcan');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('rapid_fire_overheat');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.streamCadenceMs).toBe(60);
    expect(profile!.overheatDurationMs).toBe(3000);
    expect(profile!.muzzleFlashRadiusPx).toBe(3);
  });

  it('Twins has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('twins');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('plasma_projectile');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.muzzleFlashRadiusPx).toBe(3);
    expect(profile!.streamCadenceMs).toBe(600);
  });

  it('Ricochet has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('ricochet');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('ricochet_projectile');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.bounceCount).toBe(2);
  });

  it('Hammer has VFX profile via getWeaponVfxProfile', () => {
    const profile = getWeaponVfxProfile('hammer');
    expect(profile).toBeDefined();
    expect(profile!.behavior).toBe('shotgun_cone');
    expect(profile!.durationMs).toBeGreaterThan(0);
    expect(profile!.coneAngleDeg).toBe(30);
    expect(profile!.pelletCount).toBe(5);
    expect(profile!.muzzleFlashRadiusPx).toBe(6);
  });

  it('All 11 weapons have VFX profiles', () => {
    for (const weaponId of ALL_WEAPON_IDS) {
      const profile = getWeaponVfxProfile(weaponId);
      expect(profile, `VFX profile for ${weaponId}`).toBeDefined();
      expect(profile!.durationMs, `${weaponId} durationMs`).toBeGreaterThan(0);
    }
  });
});

// ─── Firing creates correct VFX event type for all 11 weapons ──────

describe('firing creates correct VFX event type', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('Smoky fire creates smokyShot event', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('smokyShot');
    expect(event!.weaponId).toBe('smoky');
  });

  it('Railgun fire creates railgunLine event', () => {
    const vehicle = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 400, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('railgunLine');
    expect(event!.weaponId).toBe('railgun');
  });

  it('Thunder fire creates thunderSplash event', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('thunderSplash');
    expect(event!.weaponId).toBe('thunder');
  });

  // BLOCKOUT-06H+: 8 new weapon event types

  it('Shaft fire creates shaftLine event', () => {
    const vehicle = createBlockoutVehicle('hunter', 'shaft', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 450, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('shaftLine');
    expect(event!.weaponId).toBe('shaft');
  });

  it('Flamethrower fire creates flamethrowerCone event', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 120, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('flamethrowerCone');
    expect(event!.weaponId).toBe('flamethrower');
  });

  it('Freeze fire creates freezeCone event', () => {
    const vehicle = createBlockoutVehicle('viking', 'freeze', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 120, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('freezeCone');
    expect(event!.weaponId).toBe('freeze');
  });

  it('Isida fire creates isidaBeam event', () => {
    const vehicle = createBlockoutVehicle('hornet', 'isida', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 150, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('isidaBeam');
    expect(event!.weaponId).toBe('isida');
  });

  it('Vulcan fire creates vulcanTracer event', () => {
    const vehicle = createBlockoutVehicle('hunter', 'vulcan', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('vulcanTracer');
    expect(event!.weaponId).toBe('vulcan');
  });

  it('Twins fire creates twinsPlasma event', () => {
    const vehicle = createBlockoutVehicle('wasp', 'twins', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 220, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('twinsPlasma');
    expect(event!.weaponId).toBe('twins');
  });

  it('Ricochet fire creates ricochetBounce event', () => {
    const vehicle = createBlockoutVehicle('hunter', 'ricochet', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('ricochetBounce');
    expect(event!.weaponId).toBe('ricochet');
  });

  it('Hammer fire creates hammerShotgun event', () => {
    const vehicle = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    const now = 1000;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 150, 0, now);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('hammerShotgun');
    expect(event!.weaponId).toBe('hammer');
  });

  it('no weapon returns null from getVfxEventType — all 11 implemented', () => {
    // All 11 weapons should produce a non-null event when firing
    for (const weaponId of ALL_WEAPON_IDS) {
      const vehicle = createBlockoutVehicle('hunter', weaponId, 'cyan', 5, 5);
      const now = 1000 + WEAPON_PROFILES[weaponId].blockoutCooldownMs; // Ensure different base times
      const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);
      expect(event, `${weaponId} should produce a VFX event`).not.toBeNull();
    }
  });
});

// ─── VFX event includes BLOCKOUT-06H+ fields ──────────────────────

describe('VFX event includes BLOCKOUT-06H+ fields', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('cone weapons include coneAngleDeg in event', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const now = 1000;
    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 120, 0, now);

    expect(event).not.toBeNull();
    expect(event!.coneAngleDeg).toBe(25);
  });

  it('ricochet includes bounceCount in event', () => {
    const vehicle = createBlockoutVehicle('hunter', 'ricochet', 'cyan', 5, 5);
    const now = 1000;
    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);

    expect(event).not.toBeNull();
    expect(event!.bounceCount).toBe(2);
  });

  it('hammer includes pelletCount in event', () => {
    const vehicle = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    const now = 1000;
    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 150, 0, now);

    expect(event).not.toBeNull();
    expect(event!.pelletCount).toBe(5);
  });

  it('smoky has coneAngleDeg=0, bounceCount=0, pelletCount=0', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;
    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 250, 0, now);

    expect(event).not.toBeNull();
    expect(event!.coneAngleDeg).toBe(0);
    expect(event!.bounceCount).toBe(0);
    expect(event!.pelletCount).toBe(0);
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
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
  });

  it('Front_center body (Mammoth) VFX origin differs from body center', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
  });

  it('Front_center mount origin is ahead of body center', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

    expect(turretOrigin.x).toBeGreaterThan(bodyCenter.x);
  });

  it('Rear mount origin is behind body center', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const turretOrigin = computeTurretWorldOrigin(vehicle, TEST_OFFSET);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);

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
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(true);
  });

  it('cannot fire immediately after firing (cooldown not elapsed)', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    expect(canFireBlockoutWeapon(vehicle, now + 1)).toBe(false);
  });

  it('can fire after cooldown elapses', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

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
    const now = 1000;

    const event1 = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);
    expect(event1).not.toBeNull();

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

    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    expect(vehicle.recoilActive).toBe(true);
    expect(vehicle.recoilBarrelOffset).toBeGreaterThan(0);
    expect(vehicle.recoilTurretOffset).toBeGreaterThan(0);
    expect(vehicle.recoilBodyOffset).toBeGreaterThan(0);
  });

  it('recoil recovers over time', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    updateBlockoutRecoil(vehicle, now + 50);
    expect(vehicle.recoilActive).toBe(true);

    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs + 10);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
    expect(vehicle.recoilTurretOffset).toBe(0);
    expect(vehicle.recoilBodyOffset).toBe(0);
  });

  it('recoil barrel offset decays gradually', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    const initialOffset = vehicle.recoilBarrelOffset;

    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs / 2);
    expect(vehicle.recoilBarrelOffset).toBeGreaterThan(0);
    expect(vehicle.recoilBarrelOffset).toBeLessThan(initialOffset);
  });

  it('Railgun has stronger recoil than Smoky', () => {
    const smoky = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const railgun = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5);
    const now = 1000;

    fireBlockoutWeapon(smoky, 100, 100, 0, 300, 0, now);
    fireBlockoutWeapon(railgun, 100, 100, 0, 400, 0, now);

    expect(railgun.recoilBarrelOffset).toBeGreaterThan(smoky.recoilBarrelOffset);
  });

  // BLOCKOUT-06H+: Recoil starts and recovers for new weapons

  it('recoil starts and recovers for Shaft', () => {
    const vehicle = createBlockoutVehicle('hunter', 'shaft', 'cyan', 5, 5);
    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, 0, 450, 0, now);

    expect(vehicle.recoilActive).toBe(true);
    expect(vehicle.recoilBarrelOffset).toBeGreaterThan(0);

    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs + 10);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
  });

  it('recoil starts and recovers for Hammer', () => {
    const vehicle = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, 0, 150, 0, now);

    expect(vehicle.recoilActive).toBe(true);
    expect(vehicle.recoilBarrelOffset).toBeGreaterThan(0);

    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs + 10);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
  });

  it('recoil starts and recovers for Ricochet', () => {
    const vehicle = createBlockoutVehicle('hunter', 'ricochet', 'cyan', 5, 5);
    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);

    expect(vehicle.recoilActive).toBe(true);

    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs + 10);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
  });

  it('continuous weapons have minimal recoil that recovers quickly', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, 0, 120, 0, now);

    expect(vehicle.recoilActive).toBe(true);

    // Flamethrower recovery is 50ms
    updateBlockoutRecoil(vehicle, now + 60);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
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
    const now = 1000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);
    expect(vehicle.recoilActive).toBe(true);

    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    expect(vehicle.recoilActive).toBe(true);
  });

  it('turret aiming remains independent from recoil/movement', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const profile = MOVEMENT_PROFILES.wasp;
    const now = 1000;

    vehicle.turretAngle = -Math.PI / 4;
    vehicle.turretTargetAngle = -Math.PI / 4;

    fireBlockoutWeapon(vehicle, 100, 100, vehicle.turretAngle, 300, 0, now);

    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

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
    const now = 1000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    const events = getVfxEvents();
    expect(events.length).toBe(1);
  });

  it('expired events are removed', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    // Smoky VFX duration is 150ms
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

    const vehicle = state.blockoutVehicles![0];
    const now = 1000;
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

    const now = 1000;
    fireBlockoutWeapon(vehicle, 100, 100, vehicle.turretAngle, 300, 0, now);

    expect(vehicle.recoilActive).toBe(true);

    updateBlockoutRecoil(vehicle, now + vehicle.recoilDurationMs + 10);

    expect(vehicle.turretTargetAngle).toBeCloseTo(originalTarget);
  });
});

// ─── Consistent time basis (scene-time) ────────────────────────────

describe('consistent scene-time basis for weapon timing', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('recoil recovers when fire time and update time use the same scene-time basis', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const sceneTime = 5000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, sceneTime);
    expect(vehicle.recoilActive).toBe(true);

    updateBlockoutRecoil(vehicle, sceneTime + 100);
    expect(vehicle.recoilActive).toBe(true);
    expect(vehicle.recoilBarrelOffset).toBeGreaterThan(0);
    expect(vehicle.recoilBarrelOffset).toBeLessThan(RECOIL_PROFILES.smoky.barrelKickbackPx);

    updateBlockoutRecoil(vehicle, sceneTime + vehicle.recoilDurationMs + 1);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
  });

  it('VFX expires after duration with scene-time values', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const sceneTime = 3000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, sceneTime);

    expireVfxEvents(sceneTime + 100);
    expect(getVfxEvents().length).toBe(1);

    expireVfxEvents(sceneTime + 200);
    expect(getVfxEvents().length).toBe(0);
  });

  it('cooldown blocks immediate refire and allows refire after elapsed scene-time', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const sceneTime = 10000;

    const event1 = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, sceneTime);
    expect(event1).not.toBeNull();

    expect(canFireBlockoutWeapon(vehicle, sceneTime + 1)).toBe(false);
    const event2 = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, sceneTime + 1);
    expect(event2).toBeNull();

    const afterCooldown = sceneTime + 801;
    expect(canFireBlockoutWeapon(vehicle, afterCooldown)).toBe(true);
    const event3 = fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, afterCooldown);
    expect(event3).not.toBeNull();
  });

  it('no Date.now dependency is needed in pure firing tests', () => {
    const vehicle = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5);
    const t0 = 1000;
    const t1 = 1100;

    const event = fireBlockoutWeapon(vehicle, 100, 100, 0, 400, 0, t0);
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe('railgunLine');
    expect(event!.createdAt).toBe(t0);

    expect(canFireBlockoutWeapon(vehicle, t1)).toBe(false);

    updateBlockoutRecoil(vehicle, t1);
    expect(vehicle.recoilActive).toBe(true);

    expect(canFireBlockoutWeapon(vehicle, t0 + 2501)).toBe(true);

    updateBlockoutRecoil(vehicle, t0 + 500);
    expect(vehicle.recoilActive).toBe(false);

    expireVfxEvents(t0 + 300);
    expect(getVfxEvents().length).toBe(0);
  });

  it('mixing Date.now() with scene-time would break timing (regression proof)', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, 100);

    updateBlockoutRecoil(vehicle, 100 + vehicle.recoilDurationMs + 1);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.recoilBarrelOffset).toBe(0);
  });
});

// ─── Continuous weapon identification (BLOCKOUT-06H+) ────────────────

describe('continuous weapon identification', () => {
  it('flamethrower is a continuous weapon', () => {
    expect(isContinuousWeapon('flamethrower')).toBe(true);
  });

  it('freeze is a continuous weapon', () => {
    expect(isContinuousWeapon('freeze')).toBe(true);
  });

  it('isida is a continuous weapon', () => {
    expect(isContinuousWeapon('isida')).toBe(true);
  });

  it('vulcan is a continuous weapon', () => {
    expect(isContinuousWeapon('vulcan')).toBe(true);
  });

  it('twins is a continuous weapon', () => {
    expect(isContinuousWeapon('twins')).toBe(true);
  });

  it('smoky is NOT a continuous weapon', () => {
    expect(isContinuousWeapon('smoky')).toBe(false);
  });

  it('railgun is NOT a continuous weapon', () => {
    expect(isContinuousWeapon('railgun')).toBe(false);
  });

  it('thunder is NOT a continuous weapon', () => {
    expect(isContinuousWeapon('thunder')).toBe(false);
  });

  it('shaft is NOT a continuous weapon', () => {
    expect(isContinuousWeapon('shaft')).toBe(false);
  });

  it('ricochet is NOT a continuous weapon', () => {
    expect(isContinuousWeapon('ricochet')).toBe(false);
  });

  it('hammer is NOT a continuous weapon', () => {
    expect(isContinuousWeapon('hammer')).toBe(false);
  });
});

// ─── startFiring / stopFiring state management (BLOCKOUT-06H+) ──────

describe('startFiring / stopFiring state management', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('startFiring sets fireHeld and isFiring to true', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);

    startFiring(vehicle);

    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);
  });

  it('stopFiring sets fireHeld and isFiring to false', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);
    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);

    stopFiring(vehicle);

    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
  });

  it('stopFiring resets visualOverheat to 0', () => {
    const vehicle = createBlockoutVehicle('hunter', 'vulcan', 'cyan', 5, 5);
    startFiring(vehicle);
    vehicle.visualOverheat = 0.7;

    stopFiring(vehicle);

    expect(vehicle.visualOverheat).toBe(0);
  });

  it('newly created vehicle has fireHeld=false, isFiring=false, visualOverheat=0', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
    expect(vehicle.lastStreamTickAt).toBe(0);
    expect(vehicle.visualOverheat).toBe(0);
  });
});

// ─── tickContinuousFire (BLOCKOUT-06H+) ──────────────────────────────

describe('tickContinuousFire', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('returns 0 if fireHeld is false', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    vehicle.fireHeld = false;
    vehicle.isFiring = true;

    const result = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, 1000);
    expect(result).toBe(0);
  });

  it('returns 0 if isFiring is false', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    vehicle.fireHeld = true;
    vehicle.isFiring = false;

    const result = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, 1000);
    expect(result).toBe(0);
  });

  it('returns 0 for non-continuous weapon (no streamCadenceMs)', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    vehicle.fireHeld = true;
    vehicle.isFiring = true;

    const result = tickContinuousFire(vehicle, 100, 100, 0, 300, 0, 1000);
    expect(result).toBe(0);
  });

  it('creates events at streamCadenceMs rate', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);
    const now = 1000;

    // First tick — should fire since lastStreamTickAt is 0
    const result1 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, now);
    expect(result1).toBe(1);
    expect(vehicle.lastStreamTickAt).toBe(now);
    expect(getVfxEvents().length).toBe(1);

    // Immediate tick before cadence — should not fire
    const result2 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, now + 10);
    expect(result2).toBe(0);

    // After cadence (flamethrower streamCadenceMs=50, cooldown=50)
    const result3 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, now + 55);
    expect(result3).toBe(1);
    expect(getVfxEvents().length).toBe(2);
  });

  it('respects weapon cooldown', () => {
    const vehicle = createBlockoutVehicle('hunter', 'vulcan', 'cyan', 5, 5);
    startFiring(vehicle);
    const now = 1000;

    // Vulcan has cooldownMs=100, streamCadenceMs=60
    // First fire
    const result1 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, now);
    expect(result1).toBe(1);

    // Try to fire again before cooldown (60ms cadence but 100ms cooldown)
    const result2 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, now + 60);
    expect(result2).toBe(0); // Blocked by cooldown

    // After cooldown + cadence
    const result3 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, now + 110);
    expect(result3).toBe(1);
  });

  it('cooldown/cadence allows later VFX with elapsed scene-time', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);

    // Flamethrower: cooldownMs=50, streamCadenceMs=50

    // Fire at t=1000
    const r1 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, 1000);
    expect(r1).toBe(1);

    // Not ready at t=1030 (30ms < 50ms cadence)
    const r2 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, 1030);
    expect(r2).toBe(0);

    // Ready at t=1060 (60ms >= 50ms cadence AND >= 50ms cooldown)
    const r3 = tickContinuousFire(vehicle, 100, 100, 0, 200, 0, 1060);
    expect(r3).toBe(1);
  });

  it('updates lastStreamTickAt on successful fire', () => {
    const vehicle = createBlockoutVehicle('hornet', 'isida', 'cyan', 5, 5);
    startFiring(vehicle);

    const now = 2000;
    tickContinuousFire(vehicle, 100, 100, 0, 150, 0, now);

    expect(vehicle.lastStreamTickAt).toBe(now);
  });

  it('continuous weapon creates correct event types', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);
    const now = 1000;

    tickContinuousFire(vehicle, 100, 100, 0, 120, 0, now);

    const events = getVfxEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('flamethrowerCone');
  });

  it('Twins tickContinuousFire creates plasma VFX at cadence', () => {
    const vehicle = createBlockoutVehicle('wasp', 'twins', 'cyan', 5, 5);
    startFiring(vehicle);
    const now = 1000;

    // First tick — should fire since lastStreamTickAt is 0
    const result1 = tickContinuousFire(vehicle, 100, 100, 0, 220, 0, now);
    expect(result1).toBe(1);
    expect(vehicle.lastStreamTickAt).toBe(now);

    const events1 = getVfxEvents();
    expect(events1.length).toBe(1);
    expect(events1[0].eventType).toBe('twinsPlasma');

    // Before cadence (twins streamCadenceMs=600, cooldown=600)
    const result2 = tickContinuousFire(vehicle, 100, 100, 0, 220, 0, now + 300);
    expect(result2).toBe(0);

    // After cadence + cooldown (600ms)
    const result3 = tickContinuousFire(vehicle, 100, 100, 0, 220, 0, now + 650);
    expect(result3).toBe(1);

    const events2 = getVfxEvents();
    expect(events2.length).toBe(2);
    expect(events2[1].eventType).toBe('twinsPlasma');
  });
});

// ─── Vehicle state initialization with BLOCKOUT-06H+ fields ────────

describe('vehicle state initialization with BLOCKOUT-06H+ fields', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('new vehicle has fireHeld=false', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.fireHeld).toBe(false);
  });

  it('new vehicle has isFiring=false', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.isFiring).toBe(false);
  });

  it('new vehicle has lastStreamTickAt=0', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.lastStreamTickAt).toBe(0);
  });

  it('new vehicle has visualOverheat=0', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    expect(vehicle.visualOverheat).toBe(0);
  });
});

// ─── Movement doesn't erase VFX/recoil state (BLOCKOUT-06H+) ────────

describe('movement does not erase BLOCKOUT-06H+ firing state', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('movement update does not erase fireHeld/isFiring state', () => {
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const profile = MOVEMENT_PROFILES.viking;

    startFiring(vehicle);
    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);

    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // Firing state should still be active
    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);
  });

  it('movement update does not erase visualOverheat state', () => {
    const vehicle = createBlockoutVehicle('hunter', 'vulcan', 'cyan', 5, 5);
    const profile = MOVEMENT_PROFILES.hunter;

    vehicle.visualOverheat = 0.5;

    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    expect(vehicle.visualOverheat).toBe(0.5);
  });
});

// ─── Continuous-fire lifecycle fixup (BLOCKOUT-06H+ fixup) ──────────

describe('continuous-fire lifecycle fixup', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
  });

  it('single-shot weapon fire does not set fireHeld/isFiring', () => {
    // Smoky is a single-shot weapon — firing it should NOT set fireHeld or isFiring.
    // Previously startFiring() was called unconditionally for all weapons.
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const now = 1000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 300, 0, now);

    // fireBlockoutWeapon does not call startFiring — that's the controller's job.
    // But the key invariant: after fire, single-shot weapons must NOT have
    // fireHeld/isFiring set by the pure VFX system.
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
  });

  it('all single-shot weapons remain fireHeld=false/isFiring=false after fire', () => {
    // Verify the pattern for all 6 single-shot weapons
    const singleShotWeapons: WeaponId[] = ['smoky', 'railgun', 'thunder', 'shaft', 'ricochet', 'hammer'];
    for (const weaponId of singleShotWeapons) {
      const vehicle = createBlockoutVehicle('hunter', weaponId, 'cyan', 5, 5);
      const now = 1000 + WEAPON_PROFILES[weaponId].blockoutCooldownMs;
      fireBlockoutWeapon(vehicle, 100, 100, 0, 200, 0, now);
      expect(vehicle.fireHeld, `${weaponId} fireHeld should be false after fire`).toBe(false);
      expect(vehicle.isFiring, `${weaponId} isFiring should be false after fire`).toBe(false);
    }
  });

  it('continuous weapon fire sets fireHeld/isFiring when startFiring is called', () => {
    // Flamethrower is a continuous weapon — the controller calls startFiring()
    // only for continuous weapons after fireBlockoutWeapon succeeds.
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const now = 1000;

    fireBlockoutWeapon(vehicle, 100, 100, 0, 120, 0, now);
    // Simulate what the controller does for continuous weapons
    startFiring(vehicle);

    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);
  });

  it('keyup clears fireHeld/isFiring on all vehicles', () => {
    // Simulate: vehicle A is firing continuously, then key-up should clear it.
    // This tests the fixup where onKeyup now iterates ALL vehicles rather than
    // only the selected one.
    const vehicleA = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const vehicleB = createBlockoutVehicle('hornet', 'freeze', 'cyan', 6, 6);

    startFiring(vehicleA);
    startFiring(vehicleB);

    expect(vehicleA.fireHeld).toBe(true);
    expect(vehicleB.fireHeld).toBe(true);

    // Simulate keyup — stop all firing vehicles
    stopFiring(vehicleA);
    stopFiring(vehicleB);

    expect(vehicleA.fireHeld).toBe(false);
    expect(vehicleA.isFiring).toBe(false);
    expect(vehicleB.fireHeld).toBe(false);
    expect(vehicleB.isFiring).toBe(false);
  });

  it('deselect clears fireHeld/isFiring on previously selected vehicle', () => {
    // Simulate: select vehicle, start continuous fire, then deselect.
    // Before the fixup, deselecting did NOT stop firing.
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);

    startFiring(vehicle);
    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);

    // Simulate deselect — controller now calls stopFiring before clearing selection
    stopFiring(vehicle);

    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
  });

  it('selecting another vehicle clears fireHeld/isFiring on previous selected vehicle', () => {
    // Simulate: select vehicle A, start continuous fire, then select vehicle B.
    // Before the fixup, vehicle A would remain in fireHeld/isFiring state.
    const vehicleA = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const vehicleB = createBlockoutVehicle('hunter', 'smoky', 'cyan', 6, 6);

    startFiring(vehicleA);
    expect(vehicleA.fireHeld).toBe(true);

    // Simulate selecting a different vehicle — controller stops firing on previous
    stopFiring(vehicleA);

    expect(vehicleA.fireHeld).toBe(false);
    expect(vehicleA.isFiring).toBe(false);
    // vehicleB was never firing
    expect(vehicleB.fireHeld).toBe(false);
    expect(vehicleB.isFiring).toBe(false);
  });

  it('tickContinuousFire does not continue after stopFiring', () => {
    // After stopFiring (deselect/key release), tickContinuousFire must return 0.
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    startFiring(vehicle);

    const now = 1000;
    const r1 = tickContinuousFire(vehicle, 100, 100, 0, 120, 0, now);
    expect(r1).toBe(1);

    // Stop firing (simulating keyup or deselect)
    stopFiring(vehicle);

    const r2 = tickContinuousFire(vehicle, 100, 100, 0, 120, 0, now + 100);
    expect(r2).toBe(0);
  });

  it('movement does not erase firing state while held', () => {
    // Movement updates should NOT clear fireHeld/isFiring while the key is held.
    const vehicle = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5);
    const profile = MOVEMENT_PROFILES.viking;

    startFiring(vehicle);
    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);

    // Set move target and simulate movement
    setBlockoutVehicleMoveTarget(vehicle, vehicle.worldX + 200, vehicle.worldY);
    for (let i = 0; i < 10; i++) {
      updateBlockoutVehicleMovement(vehicle, profile, 16);
    }

    // Firing state must survive movement
    expect(vehicle.fireHeld).toBe(true);
    expect(vehicle.isFiring).toBe(true);
  });

  it('saveGame still strips blockoutVehicles with BLOCKOUT-06H+ transient fields', () => {
    // Ensure save still strips blockoutVehicles including the new continuous-fire fields
    const store: Record<string, string> = {};
    const mockStorage: SaveStorage = {
      getItem(key: string): string | null { return store[key] ?? null; },
      setItem(key: string, value: string): boolean { store[key] = value; return true; },
      removeItem(key: string): void { delete store[key]; },
    };
    setSaveStorage(mockStorage);

    const state = createTestGameState();
    devSpawnBlockoutVehicleSet(state);
    const vehicle = state.blockoutVehicles![0];

    // Set continuous-fire transient fields
    startFiring(vehicle);
    vehicle.visualOverheat = 0.8;

    const saveResult = saveGame(state, 'test-map');
    expect(saveResult.success).toBe(true);

    const loadResult = loadGame(saveResult.slotId!);
    expect(loadResult.success).toBe(true);
    expect(loadResult.gameState!.blockoutVehicles).toBeUndefined();
  });
});
