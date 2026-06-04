/**
 * Track animation state — spritesheet-ready movement animation API.
 *
 * CORE-STEP-08H+ FIXUP Blocker 5: Provides a blockout/procedural API hook
 * for track/movement animation. This is NOT final art — it's a state tracker
 * that the renderer can query to determine animation state.
 *
 * Rules:
 * - Moving = tracks active (animation playing)
 * - Turning in place = tracks active/opposite (animation playing)
 * - Idle = tracks inactive (no animation)
 * - No idle bobbing/shaking/dust
 *
 * This module is spritesheet-ready: when final art is added, the same
 * animation state queries will drive sprite frame selection.
 *
 * Architecture: state layer — no Phaser imports.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';

// ─── Animation state ──────────────────────────────────────────────

/** Track animation state for a single vehicle. */
export interface TrackAnimationState {
  /** Whether the vehicle is currently moving (tracks should animate). */
  isMoving: boolean;
  /** Whether the vehicle is turning in place (tracks animate opposite). */
  isTurningInPlace: boolean;
  /** Turn direction: -1 = left, 0 = none, 1 = right. */
  turnDirection: number;
  /** Animation speed multiplier (based on vehicle speed). 0 when idle, >0 when moving. */
  animSpeed: number;
}

/**
 * Get the current track animation state for a vehicle.
 *
 * This is the blockout/procedural API hook. The renderer queries this
 * each frame to determine how to render the tracks.
 *
 * @param vehicle - Vehicle to query
 * @returns Track animation state
 */
export function getTrackAnimationState(vehicle: BlockoutVehicleState): TrackAnimationState {
  const isMoving = vehicle.speed > 0.5 && vehicle.hasMoveTarget;
  const isTurningInPlace = !isMoving && Math.abs(vehicle.turretTargetAngle - vehicle.turretAngle) > 0.05;
  const turnDirection = isTurningInPlace
    ? Math.sign(vehicle.turretTargetAngle - vehicle.turretAngle)
    : 0;
  const animSpeed = isMoving ? Math.min(vehicle.speed / 100, 2.0) : 0;

  return {
    isMoving,
    isTurningInPlace,
    turnDirection,
    animSpeed,
  };
}
