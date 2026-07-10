/**
 * Shared 8-direction facing helper for tile-space movement.
 *
 * Pure TypeScript. Direction indices match the modular spritesheet contract:
 * E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7.
 */
export function directionFromDelta(dtx: number, dty: number): number {
  const screenDx = dtx - dty;
  const screenDy = dtx + dty;
  if (Math.abs(screenDx) < 0.001 && Math.abs(screenDy) < 0.001) return 2;

  const sector = Math.round(Math.atan2(screenDy, screenDx) / (Math.PI / 4));
  const directionBySector: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    '-4': 4,
    '-3': 5,
    '-2': 6,
    '-1': 7,
  };
  return directionBySector[sector] ?? 2;
}
