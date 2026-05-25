import { describe, it, expect } from 'vitest';
import { tileToScreen, screenToTile, mapOriginOffset, footprintSouthVertex } from '../phaser/render/isometric';

describe('tileToScreen', () => {
  it('maps origin tile (0,0) to screen origin', () => {
    const p = tileToScreen(0, 0);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('maps tile (1,0) to positive-x, positive-y', () => {
    const p = tileToScreen(1, 0);
    // x = (1-0) * 38 = 38, y = (1+0) * 19 = 19
    expect(p.x).toBe(38);
    expect(p.y).toBe(19);
  });

  it('maps tile (0,1) to negative-x, positive-y', () => {
    const p = tileToScreen(0, 1);
    // x = (0-1) * 38 = -38, y = (0+1) * 19 = 19
    expect(p.x).toBe(-38);
    expect(p.y).toBe(19);
  });

  it('maps tile (1,1) to x=0, y=38', () => {
    const p = tileToScreen(1, 1);
    // x = (1-1) * 38 = 0, y = (1+1) * 19 = 38
    expect(p.x).toBe(0);
    expect(p.y).toBe(38);
  });
});

describe('screenToTile', () => {
  it('round-trips integer tile coords: origin', () => {
    const screen = tileToScreen(0, 0);
    const tile = screenToTile(screen.x, screen.y);
    expect(tile.x).toBeCloseTo(0);
    expect(tile.y).toBeCloseTo(0);
  });

  it('round-trips integer tile coords: (5,3)', () => {
    const screen = tileToScreen(5, 3);
    const tile = screenToTile(screen.x, screen.y);
    expect(tile.x).toBeCloseTo(5);
    expect(tile.y).toBeCloseTo(3);
  });

  it('round-trips integer tile coords: (0,10)', () => {
    const screen = tileToScreen(0, 10);
    const tile = screenToTile(screen.x, screen.y);
    expect(tile.x).toBeCloseTo(0);
    expect(tile.y).toBeCloseTo(10);
  });

  it('round-trips integer tile coords: (23,47)', () => {
    const screen = tileToScreen(23, 47);
    const tile = screenToTile(screen.x, screen.y);
    expect(tile.x).toBeCloseTo(23);
    expect(tile.y).toBeCloseTo(47);
  });
});

describe('mapOriginOffset', () => {
  it('produces positive offsets for a 48x48 map', () => {
    const offset = mapOriginOffset(48, 48);
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeGreaterThan(0);
  });
});

// ─── footprintSouthVertex ────────────────────────────────────────────

describe('footprintSouthVertex', () => {
  it('computes south vertex for 1x1 footprint at origin', () => {
    // 1x1 at (0,0): bottom-right tile = (0,0), center = (0,0)
    // South vertex = (0, 0 + 19) = (0, 19)
    const sv = footprintSouthVertex(0, 0, 1, 1);
    expect(sv.x).toBe(0);
    expect(sv.y).toBe(19);
  });

  it('computes south vertex for 2x2 footprint at origin', () => {
    // 2x2 at (0,0): bottom-right tile = (1,1), center = (0, 38)
    // South vertex = (0, 38 + 19) = (0, 57)
    const sv = footprintSouthVertex(0, 0, 2, 2);
    expect(sv.x).toBe(0);
    expect(sv.y).toBe(57);
  });

  it('computes south vertex for 2x2 footprint offset', () => {
    // 2x2 at (5,3): bottom-right tile = (6,4)
    // tileToScreen(6, 4) = ((6-4)*38, (6+4)*19) = (76, 190)
    // South vertex = (76, 190 + 19) = (76, 209)
    const sv = footprintSouthVertex(5, 3, 2, 2);
    expect(sv.x).toBe(76);
    expect(sv.y).toBe(209);
  });

  it('computes south vertex for 3x2 non-square footprint', () => {
    // 3x2 at (0,0): bottom-right tile = (2,1)
    // tileToScreen(2, 1) = ((2-1)*38, (2+1)*19) = (38, 57)
    // South vertex = (38, 57 + 19) = (38, 76)
    const sv = footprintSouthVertex(0, 0, 3, 2);
    expect(sv.x).toBe(38);
    expect(sv.y).toBe(76);
  });

  it('computes south vertex for 1x3 tall footprint', () => {
    // 1x3 at (0,0): bottom-right tile = (0,2)
    // tileToScreen(0, 2) = ((0-2)*38, (0+2)*19) = (-76, 38)
    // South vertex = (-76, 38 + 19) = (-76, 57)
    const sv = footprintSouthVertex(0, 0, 1, 3);
    expect(sv.x).toBe(-76);
    expect(sv.y).toBe(57);
  });

  it('south vertex Y is always HH below bottom-right tile center', () => {
    // For any footprint, southVertex.y = tileToScreen(tx+fpW-1, ty+fpH-1).y + 19
    for (const [tx, ty, fpW, fpH] of [[0, 0, 1, 1], [3, 7, 2, 2], [10, 5, 4, 3]] as const) {
      const sv = footprintSouthVertex(tx, ty, fpW, fpH);
      const brCenter = tileToScreen(tx + fpW - 1, ty + fpH - 1);
      expect(sv.x).toBe(brCenter.x);
      expect(sv.y).toBe(brCenter.y + 19);
    }
  });
});
