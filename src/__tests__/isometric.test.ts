import { describe, it, expect } from 'vitest';
import { tileToScreen, screenToTile, worldToTile, mapOriginOffset } from '../phaser/render/isometric';

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

describe('worldToTile', () => {
  it('round-trips tile coords after applying map origin offset', () => {
    const offset = mapOriginOffset(48, 48);
    const screen = tileToScreen(12, 9);
    const tile = worldToTile(screen.x + offset.x, screen.y + offset.y, offset);
    expect(tile.x).toBeCloseTo(12);
    expect(tile.y).toBeCloseTo(9);
  });
});
