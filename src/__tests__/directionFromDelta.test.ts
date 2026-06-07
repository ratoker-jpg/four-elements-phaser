import { describe, it, expect } from 'vitest';
import { directionFromDelta } from '../state/updateGameState';

/**
 * directionFromDelta maps TILE-SPACE deltas to 8-direction sprite indices.
 *
 * Output indices: E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7
 *
 * The function converts tile-space (dtx, dty) to screen-space direction
 * via: sdx = dtx - dty, sdy = dtx + dty, then atan2(sdy, sdx).
 *
 * Because isometric projection maps tile-space differently than screen-space:
 *   Tile (1,0) → moves SE on screen → direction index 1
 *   Tile (1,1) → moves S on screen  → direction index 2
 *   Tile (0,1) → moves SW on screen → direction index 3
 *   Tile (-1,1)→ moves W on screen  → direction index 4
 *   Tile (-1,0)→ moves NW on screen → direction index 5
 *   Tile (-1,-1)→moves N on screen  → direction index 6
 *   Tile (0,-1)→ moves NE on screen → direction index 7
 *   Tile (1,-1)→ moves E on screen  → direction index 0
 */
describe('directionFromDelta', () => {
  it('tile (1,0) → screen SE → index 1', () => {
    expect(directionFromDelta(1, 0)).toBe(1);
  });

  it('tile (1,1) → screen S → index 2', () => {
    expect(directionFromDelta(1, 1)).toBe(2);
  });

  it('tile (0,1) → screen SW → index 3', () => {
    expect(directionFromDelta(0, 1)).toBe(3);
  });

  it('tile (-1,1) → screen W → index 4', () => {
    expect(directionFromDelta(-1, 1)).toBe(4);
  });

  it('tile (-1,0) → screen NW → index 5', () => {
    expect(directionFromDelta(-1, 0)).toBe(5);
  });

  it('tile (-1,-1) → screen N → index 6', () => {
    expect(directionFromDelta(-1, -1)).toBe(6);
  });

  it('tile (0,-1) → screen NE → index 7', () => {
    expect(directionFromDelta(0, -1)).toBe(7);
  });

  it('tile (1,-1) → screen E → index 0', () => {
    expect(directionFromDelta(1, -1)).toBe(0);
  });

  it('zero delta defaults to S=2', () => {
    expect(directionFromDelta(0, 0)).toBe(2);
  });

  it('near-zero delta defaults to S=2', () => {
    expect(directionFromDelta(0.0001, 0.0001)).toBe(2);
  });

  it('large magnitudes map correctly', () => {
    expect(directionFromDelta(100, -100)).toBe(0); // screen E
    expect(directionFromDelta(100, 0)).toBe(1);    // screen SE
    expect(directionFromDelta(100, 100)).toBe(2);  // screen S
    expect(directionFromDelta(0, 100)).toBe(3);    // screen SW
    expect(directionFromDelta(-100, 100)).toBe(4); // screen W
    expect(directionFromDelta(-100, 0)).toBe(5);   // screen NW
    expect(directionFromDelta(-100, -100)).toBe(6);// screen N
    expect(directionFromDelta(0, -100)).toBe(7);   // screen NE
  });
});
