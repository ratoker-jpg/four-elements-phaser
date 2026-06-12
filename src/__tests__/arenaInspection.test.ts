import { describe, expect, it, beforeEach } from 'vitest';
import { ALL_BODY_IDS, getBlockoutBodyMaxHp } from '../config/blockoutBodyData';
import { ALL_WEAPON_IDS, WEAPON_PROFILES } from '../config/blockoutWeaponData';
import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import {
  cycleArenaInspectionBody,
  cycleArenaInspectionWeapon,
  resetArenaInspectionPose,
} from '../state/arenaInspection';

describe('arenaInspection', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('cycles body ids with wraparound and resets body-dependent state', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const expected = ALL_BODY_IDS[ALL_BODY_IDS.length - 1] as BodyId;
    vehicle.targetVehicleId = 'enemy-id';
    vehicle.fireHeld = true;
    vehicle.isFiring = true;
    vehicle.hp = 1;
    vehicle.damageFlashUntil = 100;
    vehicle.turretTargetAngle = 0;

    const bodyId = cycleArenaInspectionBody(vehicle, -1);

    expect(bodyId).toBe(expected);
    expect(vehicle.bodyId).toBe(expected);
    expect(vehicle.maxHp).toBe(getBlockoutBodyMaxHp(expected));
    expect(vehicle.hp).toBe(vehicle.maxHp);
    expect(vehicle.targetVehicleId).toBeNull();
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
    expect(vehicle.damageFlashUntil).toBe(0);
    expect(vehicle.turretTargetAngle).toBe(vehicle.bodyAngle);
  });

  it('cycles weapon ids with wraparound and recreates weapon runtime state', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const expected = ALL_WEAPON_IDS[1] as WeaponId;
    vehicle.targetVehicleId = 'enemy-id';
    vehicle.fireHeld = true;
    vehicle.isFiring = true;
    vehicle.recoilActive = true;
    vehicle.weaponRuntime.isAutoFiring = true;

    const weaponId = cycleArenaInspectionWeapon(vehicle, 1);

    expect(weaponId).toBe(expected);
    expect(vehicle.weaponId).toBe(expected);
    expect(vehicle.weaponRuntime.weaponId).toBe(expected);
    expect(vehicle.turretTurnSpeedDeg).toBe(WEAPON_PROFILES[expected]?.blockoutTurretTurnSpeedDeg);
    expect(vehicle.targetVehicleId).toBeNull();
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
    expect(vehicle.weaponRuntime.isAutoFiring).toBe(false);
    expect(vehicle.recoilActive).toBe(false);
    expect(vehicle.turretTargetAngle).toBe(vehicle.bodyAngle);
  });

  it('resets pose while keeping body, weapon, team, and position', () => {
    const vehicle = createBlockoutVehicle('hunter', 'railgun', 'cyan', 5, 5, 0, 120, 'ally');
    const originalWorldX = vehicle.worldX;
    const originalWorldY = vehicle.worldY;
    vehicle.targetVehicleId = 'enemy-id';
    vehicle.hasMoveTarget = true;
    vehicle.vx = 10;
    vehicle.vy = 20;
    vehicle.speed = 30;
    vehicle.turretAngle = 0;
    vehicle.turretTargetAngle = 0;

    resetArenaInspectionPose(vehicle);

    expect(vehicle.bodyId).toBe('hunter');
    expect(vehicle.weaponId).toBe('railgun');
    expect(vehicle.team).toBe('ally');
    expect(vehicle.worldX).toBe(originalWorldX);
    expect(vehicle.worldY).toBe(originalWorldY);
    expect(vehicle.targetVehicleId).toBeNull();
    expect(vehicle.hasMoveTarget).toBe(false);
    expect(vehicle.vx).toBe(0);
    expect(vehicle.vy).toBe(0);
    expect(vehicle.speed).toBe(0);
    expect(vehicle.bodyAngle).toBe(Math.PI / 2);
    expect(vehicle.gridMovement.bodyAngle).toBe(vehicle.bodyAngle);
    expect(vehicle.turretAngle).toBe(vehicle.bodyAngle);
    expect(vehicle.turretTargetAngle).toBe(vehicle.bodyAngle);
  });
});
