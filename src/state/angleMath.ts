/**
 * Angle math helpers for blockout vehicle turret aiming.
 *
 * Pure TypeScript, no Phaser dependencies. All angles in radians.
 *
 * BLOCKOUT-03H: Selection/control + turret aiming.
 * These helpers are used by the turret rotation system and
 * can be unit-tested independently.
 */

/** Two * PI constant for readability. */
export const TWO_PI = Math.PI * 2;

/**
 * Normalize an angle to the range [-PI, PI].
 *
 * This ensures angle differences are computed correctly
 * regardless of how many full rotations have accumulated.
 */
export function normalizeAngle(angle: number): number {
  // Use modulo to bring into [0, 2PI) then shift to [-PI, PI)
  let normalized = angle % TWO_PI;
  if (normalized > Math.PI) {
    normalized -= TWO_PI;
  } else if (normalized < -Math.PI) {
    normalized += TWO_PI;
  }
  return normalized;
}

/**
 * Compute the shortest angular delta from `from` to `to`.
 *
 * Returns a value in [-PI, PI] representing the minimum
 * rotation needed to go from `from` to `to`.
 *
 * Positive = counter-clockwise, Negative = clockwise
 * (standard math convention).
 */
export function shortestAngleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Rotate `currentAngle` toward `targetAngle` by at most `maxDelta` radians.
 *
 * If the remaining delta is smaller than `maxDelta`, snaps to target.
 * Otherwise, moves by `maxDelta` in the shortest direction.
 *
 * @param currentAngle - Current angle in radians (any range, will be normalized internally)
 * @param targetAngle - Desired angle in radians
 * @param maxDelta - Maximum rotation per step in radians (must be >= 0)
 * @returns The new angle after rotation (not normalized — call normalizeAngle if needed)
 */
export function rotateTowardAngle(currentAngle: number, targetAngle: number, maxDelta: number): number {
  if (maxDelta < 0) {
    throw new Error('maxDelta must be non-negative');
  }

  const delta = shortestAngleDelta(currentAngle, targetAngle);
  const absDelta = Math.abs(delta);

  if (absDelta <= maxDelta) {
    // Close enough — snap to target
    return targetAngle;
  }

  // Move by maxDelta in the shortest direction
  const step = maxDelta * Math.sign(delta);
  return currentAngle + step;
}

/**
 * Compute the angle (in radians) from one world-space point to another.
 *
 * Uses standard math convention: 0 = right, PI/2 = down (screen coordinates),
 * because Phaser's Y axis points downward.
 *
 * @param fromX - Source X in world/screen coordinates
 * @param fromY - Source Y in world/screen coordinates
 * @param toX - Target X in world/screen coordinates
 * @param toY - Target Y in world/screen coordinates
 * @returns Angle in radians
 */
export function angleFromTo(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.atan2(toY - fromY, toX - fromX);
}

/**
 * Convert degrees per second to radians per millisecond.
 *
 * Useful for converting turret turn speed from config (deg/s)
 * to the per-frame delta used in the update loop (rad/ms).
 */
export function degPerSecToRadPerMs(degPerSec: number): number {
  return (degPerSec * Math.PI) / (180 * 1000);
}
