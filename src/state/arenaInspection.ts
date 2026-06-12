/**
 * Arena inspection helpers for dev-only body/weapon cycling.
 */

import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import { ALL_BODY_IDS, getBlockoutBodyMaxHp } from '../config/blockoutBodyData';
import { ALL_WEAPON_IDS, WEAPON_PROFILES } from '../config/blockoutWeaponData';
import type { BlockoutVehicleState } from './blockoutVehicleState';
import { clearBlockoutVehicleMoveTarget } from './blockoutMovement';
import type { TileReservationMap } from './tileReservation';
import { createWeaponRuntimeState } from './weaponRuntime';
import { clearTargetAndWeaponState } from './weaponFireCoordinator';
import { setTurretRestTarget } from './blockoutTurretAim';

export type ArenaInspectionDirection = -1 | 1;

function cycleId<T extends string>(ids: readonly T[], current: T, direction: ArenaInspectionDirection): T {
  const currentIndex = ids.indexOf(current);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + direction + ids.length) % ids.length;
  return ids[nextIndex];
}

function resetDamageState(vehicle: BlockoutVehicleState, maxHp: number): void {
  vehicle.hp = maxHp;
  vehicle.maxHp = maxHp;
  vehicle.isDestroyed = false;
  vehicle.destroyedAt = 0;
  vehicle.lastDamagedAt = 0;
  vehicle.damageFlashUntil = 0;
  vehicle.activeStatusTags = [];
}

function resetWeaponTransientState(vehicle: BlockoutVehicleState): void {
  vehicle.lastFiredAt = 0;
  vehicle.recoilActive = false;
  vehicle.recoilStartedAt = 0;
  vehicle.recoilDurationMs = 0;
  vehicle.recoilBarrelOffset = 0;
  vehicle.recoilTurretOffset = 0;
  vehicle.recoilBodyOffset = 0;
  vehicle.lastStreamTickAt = 0;
  vehicle.lastDamageTickAt = 0;
  vehicle.visualOverheat = 0;
}

/** Cycle the selected vehicle's body and reset body-dependent transient state. */
export function cycleArenaInspectionBody(
  vehicle: BlockoutVehicleState,
  direction: ArenaInspectionDirection,
): BodyId {
  const nextBody = cycleId(ALL_BODY_IDS as BodyId[], vehicle.bodyId, direction);
  vehicle.bodyId = nextBody;
  resetDamageState(vehicle, getBlockoutBodyMaxHp(nextBody));
  clearTargetAndWeaponState(vehicle);
  setTurretRestTarget(vehicle);
  return nextBody;
}

/** Cycle the selected vehicle's weapon and recreate weapon runtime state. */
export function cycleArenaInspectionWeapon(
  vehicle: BlockoutVehicleState,
  direction: ArenaInspectionDirection,
): WeaponId {
  const nextWeapon = cycleId(ALL_WEAPON_IDS as WeaponId[], vehicle.weaponId, direction);
  vehicle.weaponId = nextWeapon;
  vehicle.turretTurnSpeedDeg = WEAPON_PROFILES[nextWeapon]?.blockoutTurretTurnSpeedDeg ?? vehicle.turretTurnSpeedDeg;
  vehicle.weaponRuntime = createWeaponRuntimeState(nextWeapon, vehicle.modificationLevel);
  resetWeaponTransientState(vehicle);
  clearTargetAndWeaponState(vehicle);
  setTurretRestTarget(vehicle);
  return nextWeapon;
}

/** Reset selected vehicle pose/direction without changing position, team, body, or weapon. */
export function resetArenaInspectionPose(
  vehicle: BlockoutVehicleState,
  reservationMap?: TileReservationMap,
): void {
  clearBlockoutVehicleMoveTarget(vehicle, reservationMap);
  clearTargetAndWeaponState(vehicle);
  vehicle.vx = 0;
  vehicle.vy = 0;
  vehicle.speed = 0;
  vehicle.bodyAngle = Math.PI / 2;
  vehicle.gridMovement.bodyAngle = vehicle.bodyAngle;
  vehicle.turretAngle = vehicle.bodyAngle;
  setTurretRestTarget(vehicle);
}
