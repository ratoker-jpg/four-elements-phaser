/**
 * Blockout turret aim helpers.
 *
 * Pure state helpers for turret rest and rate-limited turret rotation.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import { degPerSecToRadPerMs, rotateTowardAngle } from './angleMath';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';

/** Set the turret's desired angle to the body-parallel rest pose. */
export function setTurretRestTarget(vehicle: BlockoutVehicleState): void {
  vehicle.turretTargetAngle = vehicle.bodyAngle;
}

/** Return the effective turret turn speed for the vehicle's current weapon and M-level. */
export function getEffectiveTurretTurnSpeedDeg(vehicle: BlockoutVehicleState): number {
  const weaponConfig = getWeaponConfig(vehicle.weaponId);
  return weaponConfig
    ? getWeaponMLevelValue(weaponConfig.turretTurnSpeed, vehicle.modificationLevel)
    : vehicle.turretTurnSpeedDeg;
}

/** Rotate the turret toward a desired angle using the existing rate limit. */
export function rotateTurretToward(
  vehicle: BlockoutVehicleState,
  desiredAngle: number,
  deltaMs: number,
): void {
  vehicle.turretTargetAngle = desiredAngle;
  const maxDelta = degPerSecToRadPerMs(getEffectiveTurretTurnSpeedDeg(vehicle)) * deltaMs;
  vehicle.turretAngle = rotateTowardAngle(vehicle.turretAngle, desiredAngle, maxDelta);
}
