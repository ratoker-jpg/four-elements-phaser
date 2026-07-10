/**
 * Shared 8-direction facing helper for tile-space movement.
 *
 * Pure TypeScript. Direction indices match the modular spritesheet contract:
 * E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7.
 */
export function screenAngleFromDelta(dtx: number, dty: number): number {
  const screenDx = dtx - dty;
  const screenDy = dtx + dty;
  return normalizeAngleDeg(Math.atan2(screenDy, screenDx) * 180 / Math.PI);
}

export function directionFromScreenAngle(angleDeg: number): number {
  return ((Math.round(normalizeAngleDeg(angleDeg) / 45) % 8) + 8) % 8;
}

export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = normalizeAngleDeg(toDeg) - normalizeAngleDeg(fromDeg);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export function rotateAngleTowards(fromDeg: number, toDeg: number, maxStepDeg: number): number {
  const delta = shortestAngleDelta(fromDeg, toDeg);
  if (Math.abs(delta) <= maxStepDeg) return normalizeAngleDeg(toDeg);
  return normalizeAngleDeg(fromDeg + Math.sign(delta) * Math.max(0, maxStepDeg));
}

export function normalizeAngleDeg(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

export function directionFromDelta(dtx: number, dty: number): number {
  const screenDx = dtx - dty;
  const screenDy = dtx + dty;
  if (Math.abs(screenDx) < 0.001 && Math.abs(screenDy) < 0.001) return 2;
  return directionFromScreenAngle(screenAngleFromDelta(dtx, dty));
}
