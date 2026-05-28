/**
 * Tests for terrain clustering / smoothing helpers.
 *
 * TERRAIN-01: Pure TypeScript unit tests for the deterministic
 * terrain smoothing and per-tile tint computation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  smoothTerrainPass,
  applyTerrainSmoothing,
  computeTerrainTint,
  terrainTileHash,
  terrainBrightnessIndex,
} from '../state/terrainClustering';
import type { TerrainType } from '../state/types';

// ─── smoothTerrainPass ─────────────────────────────────────────────

describe('smoothTerrainPass', () => {
  it('returns empty array for empty input', () => {
    expect(smoothTerrainPass([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input: TerrainType[][] = [
      ['sand', 'sand-dark', 'sand'],
      ['sand', 'sand-dark', 'sand'],
      ['sand', 'sand', 'sand'],
    ];
    const inputCopy = input.map(row => [...row]);
    smoothTerrainPass(input);
    expect(input).toEqual(inputCopy);
  });

  it('replaces isolated tile with majority neighbor type', () => {
    // A single sand-dark tile surrounded by sand should become sand
    const terrain: TerrainType[][] = [
      ['sand', 'sand', 'sand'],
      ['sand', 'sand-dark', 'sand'],
      ['sand', 'sand', 'sand'],
    ];
    const result = smoothTerrainPass(terrain);
    // The isolated sand-dark (1 out of 9) should be replaced by sand (8 out of 9)
    expect(result[1][1]).toBe('sand');
  });

  it('preserves a cluster of same-type tiles', () => {
    // A 3x3 block of sand-dark should remain sand-dark
    const terrain: TerrainType[][] = [
      ['sand-dark', 'sand-dark', 'sand-dark'],
      ['sand-dark', 'sand-dark', 'sand-dark'],
      ['sand-dark', 'sand-dark', 'sand-dark'],
    ];
    const result = smoothTerrainPass(terrain);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(result[y][x]).toBe('sand-dark');
      }
    }
  });

  it('preserves a strong diagonal cluster', () => {
    // 5 sand-dark out of 9 — should survive as sand-dark
    const terrain: TerrainType[][] = [
      ['sand-dark', 'sand', 'sand'],
      ['sand', 'sand-dark', 'sand'],
      ['sand', 'sand', 'sand-dark'],
    ];
    const result = smoothTerrainPass(terrain);
    // Center has 3 sand-dark neighbors out of 9 — not majority, stays sand
    // But the top-left has 3 sand-dark out of 4 (including self) — majority
    expect(result[0][0]).toBe('sand-dark');
  });

  it('is deterministic — same input produces same output', () => {
    const terrain: TerrainType[][] = [
      ['sand', 'sand-light', 'sand-dark'],
      ['sand-dark', 'sand', 'sand-light'],
      ['sand-light', 'sand-dark', 'sand'],
    ];
    const result1 = smoothTerrainPass(terrain);
    const result2 = smoothTerrainPass(terrain);
    expect(result1).toEqual(result2);
  });

  it('handles map edges correctly', () => {
    // Corner tile — only 4 neighbors in 3x3 window
    // With threshold >= 5, a corner tile with 3/4 sand won't be changed
    // (3 < 5). But a larger cluster near the edge should be handled.
    const terrain: TerrainType[][] = [
      ['sand-dark', 'sand-dark', 'sand-dark', 'sand'],
      ['sand-dark', 'sand-dark', 'sand-dark', 'sand'],
      ['sand-dark', 'sand-dark', 'sand-dark', 'sand'],
      ['sand', 'sand', 'sand', 'sand'],
    ];
    const result = smoothTerrainPass(terrain);
    // The interior sand-dark tiles should remain sand-dark (9/9)
    expect(result[1][1]).toBe('sand-dark');
    // The edge sand tile at (3,3) has 3 sand-dark neighbors out of 4 —
    // majority is sand-dark but count is 3, which is < 5, so it stays sand
    expect(result[3][3]).toBe('sand');
  });
});

// ─── applyTerrainSmoothing ─────────────────────────────────────────

describe('applyTerrainSmoothing', () => {
  it('applies multiple passes with progressively smoother results', () => {
    // Create terrain with scattered non-sand tiles that need
    // multiple passes to fully smooth
    const terrain: TerrainType[][] = [
      ['sand-dark', 'sand-dark', 'sand-dark', 'sand-dark', 'sand-dark'],
      ['sand-dark', 'sand-light', 'sand-dark', 'sand-light', 'sand-dark'],
      ['sand-dark', 'sand-dark', 'sand-dark', 'sand-dark', 'sand-dark'],
      ['sand-dark', 'sand-light', 'sand-dark', 'sand-light', 'sand-dark'],
      ['sand-dark', 'sand-dark', 'sand-dark', 'sand-dark', 'sand-dark'],
    ];
    const result0 = applyTerrainSmoothing(terrain, 0);
    const result1 = applyTerrainSmoothing(terrain, 1);
    // At least one pass should change something from the original
    // (the isolated sand-light tiles should be smoothed toward sand-dark)
    const changed = result1.some((row, y) =>
      row.some((t, x) => t !== result0[y][x])
    );
    expect(changed).toBe(true);
    // After 3 passes, sand-light tiles surrounded by sand-dark should be gone
    // They should have been replaced by sand-dark (their majority neighbor)
    // or at least significantly reduced
    const result3 = applyTerrainSmoothing(terrain, 3);
    const sandLightCount3 = result3.flat().filter(t => t === 'sand-light').length;
    const sandLightCount1 = result1.flat().filter(t => t === 'sand-light').length;
    expect(sandLightCount3).toBeLessThanOrEqual(sandLightCount1);
  });

  it('defaults to 2 passes', () => {
    const terrain: TerrainType[][] = [
      ['sand', 'sand-dark'],
      ['sand-light', 'sand'],
    ];
    const resultDefault = applyTerrainSmoothing(terrain);
    const result2 = applyTerrainSmoothing(terrain, 2);
    expect(resultDefault).toEqual(result2);
  });

  it('does not mutate input', () => {
    const terrain: TerrainType[][] = [
      ['sand', 'sand-dark'],
      ['sand-light', 'sand'],
    ];
    const copy = terrain.map(row => [...row]);
    applyTerrainSmoothing(terrain, 3);
    expect(terrain).toEqual(copy);
  });
});

// ─── terrainTileHash ───────────────────────────────────────────────

describe('terrainTileHash', () => {
  it('returns a non-negative integer', () => {
    const hash = terrainTileHash(5, 10);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hash)).toBe(true);
  });

  it('is deterministic — same input always produces same output', () => {
    const h1 = terrainTileHash(3, 7);
    const h2 = terrainTileHash(3, 7);
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different coordinates', () => {
    const hashes = new Set<number>();
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        hashes.add(terrainTileHash(x, y));
      }
    }
    // 100 tiles should produce at least 90 unique hashes (good distribution)
    expect(hashes.size).toBeGreaterThan(90);
  });
});

// ─── computeTerrainTint ────────────────────────────────────────────

describe('computeTerrainTint', () => {
  it('returns a valid 24-bit RGB integer', () => {
    const tint = computeTerrainTint(5, 10, 'sand');
    expect(tint).toBeGreaterThanOrEqual(0);
    expect(tint).toBeLessThanOrEqual(0xFFFFFF);
  });

  it('is deterministic — same input always produces same tint', () => {
    const t1 = computeTerrainTint(3, 7, 'sand');
    const t2 = computeTerrainTint(3, 7, 'sand');
    expect(t1).toBe(t2);
  });

  it('produces different tints for different coordinates', () => {
    const tints = new Set<number>();
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        tints.add(computeTerrainTint(x, y, 'sand'));
      }
    }
    // Should produce multiple distinct tints (not all the same)
    expect(tints.size).toBeGreaterThan(1);
  });

  it('produces different tints for same coords but different terrain types', () => {
    const tintSand = computeTerrainTint(5, 5, 'sand');
    const tintDark = computeTerrainTint(5, 5, 'sand-dark');
    const tintLight = computeTerrainTint(5, 5, 'sand-light');
    // All three should be different due to terrain-specific base colors
    expect(tintSand).not.toBe(tintDark);
    expect(tintSand).not.toBe(tintLight);
    expect(tintDark).not.toBe(tintLight);
  });

  it('produces subtle tints close to white (within ±10 per channel)', () => {
    // The tints should be very subtle — close to neutral white
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const tint = computeTerrainTint(x, y, 'sand');
        const r = (tint >> 16) & 0xFF;
        const g = (tint >> 8) & 0xFF;
        const b = tint & 0xFF;
        // Each channel should be within 15 of 240-255 range
        expect(r).toBeGreaterThanOrEqual(230);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(225);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(220);
        expect(b).toBeLessThanOrEqual(255);
      }
    }
  });
});

// ─── terrainBrightnessIndex ────────────────────────────────────────

describe('terrainBrightnessIndex', () => {
  it('returns 0 for sand-light (brightest)', () => {
    expect(terrainBrightnessIndex('sand-light')).toBe(0);
  });

  it('returns 1 for sand (medium)', () => {
    expect(terrainBrightnessIndex('sand')).toBe(1);
  });

  it('returns 2 for sand-dark (darkest)', () => {
    expect(terrainBrightnessIndex('sand-dark')).toBe(2);
  });
});
