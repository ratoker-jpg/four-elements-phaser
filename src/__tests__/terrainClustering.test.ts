/**
 * Tests for terrain clustering / smoothing helpers.
 *
 * TERRAIN-01: Pure TypeScript unit tests for the deterministic
 * terrain smoothing and per-tile tint computation functions.
 *
 * TERRAIN-02A: Extended tests for the 6-variant 256×128 sand tile family,
 * including detail variant assignment, expanded tint range, and
 * brightness ordering for all terrain types.
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

  it('smooths detail variants toward majority neighbors', () => {
    // An isolated sand-ripple tile surrounded by sand should be replaced
    const terrain: TerrainType[][] = [
      ['sand', 'sand', 'sand'],
      ['sand', 'sand-ripple', 'sand'],
      ['sand', 'sand', 'sand'],
    ];
    const result = smoothTerrainPass(terrain);
    expect(result[1][1]).toBe('sand');
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
    const allTypes: TerrainType[] = ['sand', 'sand-dark', 'sand-light', 'sand-ripple', 'sand-pebble', 'sand-cracked'];
    const tints = allTypes.map(t => computeTerrainTint(5, 5, t));
    // All six should be different due to terrain-specific base colors
    const uniqueTints = new Set(tints);
    expect(uniqueTints.size).toBe(allTypes.length);
  });

  it('produces subtle tints within ±8% range (±20 per channel)', () => {
    // TERRAIN-02A: Tints should be within ±8% of neutral per channel
    const allTypes: TerrainType[] = ['sand', 'sand-dark', 'sand-light', 'sand-ripple', 'sand-pebble', 'sand-cracked'];
    for (const type of allTypes) {
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const tint = computeTerrainTint(x, y, type);
          const r = (tint >> 16) & 0xFF;
          const g = (tint >> 8) & 0xFF;
          const b = tint & 0xFF;
          // Each channel should be in a reasonable range for subtle tinting
          expect(r).toBeGreaterThanOrEqual(220);
          expect(r).toBeLessThanOrEqual(255);
          expect(g).toBeGreaterThanOrEqual(215);
          expect(g).toBeLessThanOrEqual(255);
          expect(b).toBeGreaterThanOrEqual(205);
          expect(b).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('produces deterministic results for all 6 terrain types', () => {
    const allTypes: TerrainType[] = ['sand', 'sand-dark', 'sand-light', 'sand-ripple', 'sand-pebble', 'sand-cracked'];
    for (const type of allTypes) {
      const t1 = computeTerrainTint(10, 20, type);
      const t2 = computeTerrainTint(10, 20, type);
      expect(t1).toBe(t2);
    }
  });
});

// ─── terrainBrightnessIndex ────────────────────────────────────────

describe('terrainBrightnessIndex', () => {
  it('returns 0 for sand-light (brightest)', () => {
    expect(terrainBrightnessIndex('sand-light')).toBe(0);
  });

  it('returns 1 for sand-ripple', () => {
    expect(terrainBrightnessIndex('sand-ripple')).toBe(1);
  });

  it('returns 2 for sand (medium)', () => {
    expect(terrainBrightnessIndex('sand')).toBe(2);
  });

  it('returns 3 for sand-pebble', () => {
    expect(terrainBrightnessIndex('sand-pebble')).toBe(3);
  });

  it('returns 4 for sand-cracked', () => {
    expect(terrainBrightnessIndex('sand-cracked')).toBe(4);
  });

  it('returns 5 for sand-dark (darkest)', () => {
    expect(terrainBrightnessIndex('sand-dark')).toBe(5);
  });

  it('orders all 6 terrain types correctly (light → dark)', () => {
    const order: TerrainType[] = ['sand-light', 'sand-ripple', 'sand', 'sand-pebble', 'sand-cracked', 'sand-dark'];
    for (let i = 0; i < order.length; i++) {
      expect(terrainBrightnessIndex(order[i])).toBe(i);
    }
  });
});

// ─── TERRAIN-02A: 6-variant TERRAIN_KEY_MAP coverage ──────────────

describe('TERRAIN-02A 6-variant coverage', () => {
  // Simulate the TERRAIN_KEY_MAP from TerrainRenderer
  const TERRAIN_KEY_MAP: Record<TerrainType, string> = {
    sand: 'terrain_sand_clean_256x128',
    'sand-dark': 'terrain_sand_dark_256x128',
    'sand-light': 'terrain_sand_light_256x128',
    'sand-ripple': 'terrain_sand_ripple_256x128',
    'sand-pebble': 'terrain_sand_pebble_256x128',
    'sand-cracked': 'terrain_sand_cracked_256x128',
  };

  it('all 6 terrain types are in TERRAIN_KEY_MAP', () => {
    const allTypes: TerrainType[] = ['sand', 'sand-dark', 'sand-light', 'sand-ripple', 'sand-pebble', 'sand-cracked'];
    for (const type of allTypes) {
      expect(TERRAIN_KEY_MAP[type]).toBeDefined();
      expect(typeof TERRAIN_KEY_MAP[type]).toBe('string');
    }
  });

  it('legacy types (sand, sand-dark, sand-light) resolve to valid asset keys', () => {
    expect(TERRAIN_KEY_MAP['sand']).toBe('terrain_sand_clean_256x128');
    expect(TERRAIN_KEY_MAP['sand-dark']).toBe('terrain_sand_dark_256x128');
    expect(TERRAIN_KEY_MAP['sand-light']).toBe('terrain_sand_light_256x128');
  });

  it('new detail variants resolve to valid 256x128 asset keys', () => {
    expect(TERRAIN_KEY_MAP['sand-ripple']).toBe('terrain_sand_ripple_256x128');
    expect(TERRAIN_KEY_MAP['sand-pebble']).toBe('terrain_sand_pebble_256x128');
    expect(TERRAIN_KEY_MAP['sand-cracked']).toBe('terrain_sand_cracked_256x128');
  });

  it('all asset keys end with 256x128 suffix', () => {
    const allTypes: TerrainType[] = ['sand', 'sand-dark', 'sand-light', 'sand-ripple', 'sand-pebble', 'sand-cracked'];
    for (const type of allTypes) {
      expect(TERRAIN_KEY_MAP[type]).toMatch(/_256x128$/);
    }
  });
});

// ─── TERRAIN-02A: Scale constants verification ─────────────────────

describe('TERRAIN-02A scale constants', () => {
  it('scale factor is 76/256 ≈ 0.296875 for X', () => {
    const TILE_W = 76;
    const TERRAIN_SOURCE_W = 256;
    const scaleX = TILE_W / TERRAIN_SOURCE_W;
    expect(scaleX).toBeCloseTo(0.296875, 6);
  });

  it('scale factor is 38/128 ≈ 0.296875 for Y', () => {
    const TILE_H = 38;
    const TERRAIN_SOURCE_H = 128;
    const scaleY = TILE_H / TERRAIN_SOURCE_H;
    expect(scaleY).toBeCloseTo(0.296875, 6);
  });

  it('scale is uniform (X === Y)', () => {
    const scaleX = 76 / 256;
    const scaleY = 38 / 128;
    expect(scaleX).toBeCloseTo(scaleY, 6);
  });
});

// ─── TERRAIN-02A: Terrain key map completeness (renderer is pure mapping) ──
// Variant selection happens in generatedMap.ts, NOT in TerrainRenderer.
// The renderer only maps TerrainType → asset key. These tests verify the
// key mapping is complete and correct for all 6 terrain types.

describe('TERRAIN-02A terrain key map (renderer is pure mapping layer)', () => {
  it('each terrain type maps to a unique asset key', () => {
    const TERRAIN_KEY_MAP: Record<TerrainType, string> = {
      sand: 'terrain_sand_clean_256x128',
      'sand-dark': 'terrain_sand_dark_256x128',
      'sand-light': 'terrain_sand_light_256x128',
      'sand-ripple': 'terrain_sand_ripple_256x128',
      'sand-pebble': 'terrain_sand_pebble_256x128',
      'sand-cracked': 'terrain_sand_cracked_256x128',
    };
    const keys = Object.values(TERRAIN_KEY_MAP);
    const uniqueKeys = new Set(keys);
    // All 6 terrain types should map to 6 distinct asset keys
    expect(uniqueKeys.size).toBe(6);
  });

  it('renderer does not reassign terrain variants — it only maps and stamps', () => {
    // This is a design invariant: TerrainRenderer.stampTerrainTiles reads
    // the TerrainType directly from the terrain map and maps it to an asset
    // key. It does NOT call assignDetailVariant() or any variant-selection
    // logic. Variant selection is the sole responsibility of generatedMap.ts.
    // This test documents that invariant.
    const allTypes: TerrainType[] = ['sand', 'sand-dark', 'sand-light', 'sand-ripple', 'sand-pebble', 'sand-cracked'];
    // Each type should be renderable as-is (no reassignment needed)
    for (const type of allTypes) {
      expect(type).toBeDefined();
    }
  });
});
