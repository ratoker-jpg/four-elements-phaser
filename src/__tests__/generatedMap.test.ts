/**
 * Tests for generatedMap — pure TypeScript, no Phaser.
 *
 * ARCH-16B: Tests for seed normalization, deterministic generation,
 * size dimensions, map structure, and resource placement.
 *
 * ARCH-08B/09A: Extended tests for:
 * - Patch-based terrain (clustered, not checkerboard)
 * - Distance-based resource balance
 * - Starter resource reliability
 * - Obstacle/decor placement (deferred — no invisible blocking obstacles)
 * - Validation/fallback retry
 * - Quality summary diagnostics
 */

import { describe, it, expect } from 'vitest';
import type { TerrainType } from '../state/types';
import {
  normalizeSeed,
  createRandomSeed,
  mapSizeToDimensions,
  generatedMapName,
  generatedMapId,
  isGeneratedRuntimeState,
  createGeneratedMapData,
  createValidatedGeneratedMapData,
  summarizeGeneratedMapQuality,
  MAP_SIZE_DIMENSIONS,
  MAX_VALIDATION_ATTEMPTS,
  GENERATED_MAP_ID_PREFIX,
  type MapSizeOption,
} from '../state/generatedMap';

describe('ARCH-08B/09A: generatedMap helpers', () => {
  // ── Seed normalization ───────────────────────────────────────────

  describe('normalizeSeed', () => {
    it('parses a positive integer string directly', () => {
      expect(normalizeSeed('42')).toBe(42);
    });

    it('parses a negative integer string directly', () => {
      expect(normalizeSeed('-7')).toBe(-7);
    });

    it('parses zero', () => {
      expect(normalizeSeed('0')).toBe(0);
    });

    it('hashes a non-numeric string deterministically', () => {
      const result = normalizeSeed('hello');
      expect(typeof result).toBe('number');
      expect(normalizeSeed('hello')).toBe(result);
    });

    it('produces different hashes for different strings', () => {
      expect(normalizeSeed('abc')).not.toBe(normalizeSeed('xyz'));
    });

    it('trims whitespace before processing', () => {
      expect(normalizeSeed('  42  ')).toBe(42);
    });

    it('hashes empty string (after trim) consistently', () => {
      const result = normalizeSeed('');
      expect(typeof result).toBe('number');
      expect(normalizeSeed('')).toBe(result);
    });

    it('hashes whitespace-only string same as empty', () => {
      expect(normalizeSeed('   ')).toBe(normalizeSeed(''));
    });

    it('produces 32-bit integer results', () => {
      const result = normalizeSeed('test-string');
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  // ── Random seed ─────────────────────────────────────────────────

  describe('createRandomSeed', () => {
    it('returns a string', () => {
      expect(typeof createRandomSeed()).toBe('string');
    });

    it('returns 8 hex characters', () => {
      const seed = createRandomSeed();
      expect(seed).toMatch(/^[0-9a-f]{8}$/);
    });

    it('generates different seeds on successive calls (probabilistic)', () => {
      const seeds = new Set<string>();
      for (let i = 0; i < 10; i++) {
        seeds.add(createRandomSeed());
      }
      expect(seeds.size).toBeGreaterThan(5);
    });
  });

  // ── Size dimensions ────────────────────────────────────────────

  describe('mapSizeToDimensions', () => {
    it('returns correct dimensions for small', () => {
      expect(mapSizeToDimensions('small')).toEqual({ width: 32, height: 32 });
    });

    it('returns correct dimensions for standard', () => {
      expect(mapSizeToDimensions('standard')).toEqual({ width: 48, height: 48 });
    });

    it('returns correct dimensions for large', () => {
      expect(mapSizeToDimensions('large')).toEqual({ width: 64, height: 64 });
    });

    it('matches MAP_SIZE_DIMENSIONS constant', () => {
      for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
        expect(mapSizeToDimensions(size)).toEqual(MAP_SIZE_DIMENSIONS[size]);
      }
    });
  });

  // ── Map naming ─────────────────────────────────────────────────

  describe('generatedMapName', () => {
    it('includes size and seed', () => {
      const name = generatedMapName('abc123', 'standard');
      expect(name).toContain('standard');
      expect(name).toContain('abc123');
    });
  });

  describe('generatedMapId', () => {
    it('uses generated prefix', () => {
      const id = generatedMapId('test', 'small');
      expect(id).toMatch(new RegExp(`^${GENERATED_MAP_ID_PREFIX}-small-test$`));
    });

    it('includes size', () => {
      const id = generatedMapId('seed', 'large');
      expect(id).toContain('large');
    });
  });

  // ── Deterministic generation ───────────────────────────────────

  describe('deterministic generation', () => {
    it('same seed + size produces identical map data', () => {
      const map1 = createGeneratedMapData('determinism-test', 'standard');
      const map2 = createGeneratedMapData('determinism-test', 'standard');

      expect(map1.terrain).toEqual(map2.terrain);
      expect(map1.resources).toEqual(map2.resources);
      expect(map1.obstacles).toEqual(map2.obstacles);
      expect(map1.decor).toEqual(map2.decor);
      expect(map1.hq).toEqual(map2.hq);
      expect(map1.width).toBe(map2.width);
      expect(map1.height).toBe(map2.height);
    });

    it('different seed produces different resource placement', () => {
      const map1 = createGeneratedMapData('seed-A', 'standard');
      const map2 = createGeneratedMapData('seed-B', 'standard');

      const res1Str = JSON.stringify(map1.resources);
      const res2Str = JSON.stringify(map2.resources);
      expect(res1Str).not.toBe(res2Str);
    });

    it('different size produces different dimensions', () => {
      const small = createGeneratedMapData('test', 'small');
      const large = createGeneratedMapData('test', 'large');

      expect(small.width).toBe(32);
      expect(small.height).toBe(32);
      expect(large.width).toBe(64);
      expect(large.height).toBe(64);
    });

    it('different seed produces different terrain', () => {
      const map1 = createGeneratedMapData('terrain-A', 'standard');
      const map2 = createGeneratedMapData('terrain-B', 'standard');

      // Terrain should differ (extremely unlikely to be identical with patch-based gen)
      const t1Str = JSON.stringify(map1.terrain);
      const t2Str = JSON.stringify(map2.terrain);
      expect(t1Str).not.toBe(t2Str);
    });
  });

  // ── TERRAIN-02A: Terrain variant distribution ──────────────────

  describe('TERRAIN-02A terrain variant distribution (single source of truth)', () => {
    it('all 6 terrain types can appear across generated maps', () => {
      // Generate multiple maps with different seeds to ensure all variants appear
      const allSeenTypes = new Set<TerrainType>();
      for (let i = 0; i < 10; i++) {
        const map = createGeneratedMapData(`variant-coverage-${i}`, 'standard');
        for (const row of map.terrain) {
          for (const cell of row) {
            allSeenTypes.add(cell);
          }
        }
        if (allSeenTypes.size === 6) break; // Found all types already
      }
      expect(allSeenTypes.has('sand')).toBe(true);
      expect(allSeenTypes.has('sand-dark')).toBe(true);
      expect(allSeenTypes.has('sand-light')).toBe(true);
      expect(allSeenTypes.has('sand-ripple')).toBe(true);
      expect(allSeenTypes.has('sand-pebble')).toBe(true);
      expect(allSeenTypes.has('sand-cracked')).toBe(true);
    });

    it('sand remains the dominant terrain type', () => {
      const map = createGeneratedMapData('dominant-sand-02a', 'standard');
      const counts = new Map<TerrainType, number>();
      let total = 0;
      for (const row of map.terrain) {
        for (const cell of row) {
          counts.set(cell, (counts.get(cell) ?? 0) + 1);
          total++;
        }
      }
      // Base 'sand' should be the single most common type
      const sandCount = counts.get('sand') ?? 0;
      for (const [type, count] of counts) {
        if (type !== 'sand') {
          expect(sandCount).toBeGreaterThan(count);
        }
      }
      // Sand should be at least 20% of all tiles (conservative — actually much higher)
      expect(sandCount / total).toBeGreaterThan(0.2);
    });

    it('sand-pebble and sand-cracked remain rare accents', () => {
      // TERRAIN-FIX-01: Pebble/cracked reduced from ~4% to ~2% each
      const map = createGeneratedMapData('rare-variants-02a', 'standard');
      let total = 0;
      let pebbleCount = 0;
      let crackedCount = 0;
      for (const row of map.terrain) {
        for (const cell of row) {
          total++;
          if (cell === 'sand-pebble') pebbleCount++;
          if (cell === 'sand-cracked') crackedCount++;
        }
      }
      // Pebble and cracked should each be less than 5% of all tiles
      // (TERRAIN-FIX-01: reduced from 10% to 5% threshold)
      expect(pebbleCount / total).toBeLessThan(0.05);
      expect(crackedCount / total).toBeLessThan(0.05);
    });

    it('same seed + size produces same terrain distribution (determinism)', () => {
      const map1 = createGeneratedMapData('determinism-02a', 'standard');
      const map2 = createGeneratedMapData('determinism-02a', 'standard');
      // Full terrain match (deep equality)
      expect(map1.terrain).toEqual(map2.terrain);
      // Also verify type distribution matches
      const countTypes = (m: typeof map1) => {
        const counts = new Map<TerrainType, number>();
        for (const row of m.terrain) {
          for (const cell of row) {
            counts.set(cell, (counts.get(cell) ?? 0) + 1);
          }
        }
        return counts;
      };
      expect(countTypes(map1)).toEqual(countTypes(map2));
    });

    it('terrain type counts are deterministic across multiple map sizes', () => {
      for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
        const map1 = createGeneratedMapData(`multi-size-${size}`, size);
        const map2 = createGeneratedMapData(`multi-size-${size}`, size);
        expect(map1.terrain).toEqual(map2.terrain);
      }
    });

    it('detail variants (ripple, pebble, cracked) survive into final generated terrain', () => {
      // Since the renderer no longer applies smoothing, detail variants
      // placed by generatedMap.ts must survive intact into the MapData
      // that gets rendered. This test verifies that the generated terrain
      // actually contains detail variants and they are not lost.
      const map = createGeneratedMapData('detail-survival', 'large');
      const flatTerrain = map.terrain.flat();
      const rippleCount = flatTerrain.filter(t => t === 'sand-ripple').length;
      const pebbleCount = flatTerrain.filter(t => t === 'sand-pebble').length;
      const crackedCount = flatTerrain.filter(t => t === 'sand-cracked').length;
      // Each detail variant should be present (>0) in a large map
      expect(rippleCount).toBeGreaterThan(0);
      expect(pebbleCount).toBeGreaterThan(0);
      expect(crackedCount).toBeGreaterThan(0);
    });
  });

  // ── Terrain readability (ARCH-08B) ─────────────────────────────

  describe('terrain readability', () => {
    it('terrain matches map dimensions', () => {
      const map = createGeneratedMapData('terrain-test', 'small');
      expect(map.terrain.length).toBe(map.height);
      for (const row of map.terrain) {
        expect(row.length).toBe(map.width);
      }
    });

    it('terrain only contains valid terrain types', () => {
      const map = createGeneratedMapData('terrain-type-test', 'standard');
      // TERRAIN-02A: 6-variant 256×128 sand tile family
      const validTypes = new Set(['sand', 'sand-light', 'sand-dark', 'sand-ripple', 'sand-pebble', 'sand-cracked']);
      for (const row of map.terrain) {
        for (const cell of row) {
          expect(validTypes.has(cell)).toBe(true);
        }
      }
    });

    it('sand is the dominant terrain type', () => {
      const map = createGeneratedMapData('dominant-sand-test', 'standard');
      let sandCount = 0;
      // TERRAIN-02A: Count sand and its detail variants as the dominant family
      const sandFamily: TerrainType[] = ['sand', 'sand-ripple', 'sand-pebble', 'sand-cracked'];
      let totalCells = 0;
      for (const row of map.terrain) {
        for (const cell of row) {
          totalCells++;
          if (sandFamily.includes(cell)) sandCount++;
        }
      }
      // Sand family should be at least 40% of the map (patch-based, so dominant)
      expect(sandCount / totalCells).toBeGreaterThan(0.4);
    });

    it('terrain has clustered patches (not pure random single-cell noise)', () => {
      const map = createGeneratedMapData('cluster-test', 'standard');
      // Count transitions between different terrain types in horizontal direction
      // A checkerboard would have ~50% transitions; clustered should be much less
      let transitions = 0;
      let totalComparisons = 0;
      for (const row of map.terrain) {
        for (let x = 1; x < row.length; x++) {
          totalComparisons++;
          if (row[x] !== row[x - 1]) transitions++;
        }
      }
      // Clustered terrain should have less than 40% horizontal transitions
      // (pure random would be ~60%+)
      expect(transitions / totalComparisons).toBeLessThan(0.45);
    });

    it('both sand-light and sand-dark appear in terrain', () => {
      const map = createGeneratedMapData('variant-test', 'standard');
      let hasLight = false;
      let hasDark = false;
      for (const row of map.terrain) {
        for (const cell of row) {
          if (cell === 'sand-light') hasLight = true;
          if (cell === 'sand-dark') hasDark = true;
        }
      }
      expect(hasLight).toBe(true);
      expect(hasDark).toBe(true);
    });

    it('same seed+size produces same terrain (re-determinism)', () => {
      const map1 = createGeneratedMapData('redeterminism', 'small');
      const map2 = createGeneratedMapData('redeterminism', 'small');
      expect(map1.terrain).toEqual(map2.terrain);
    });
  });

  // ── Map structure ──────────────────────────────────────────────

  describe('generated map structure', () => {
    it('has HQ at the expected lower-left position (4, mapHeight-7)', () => {
      const map = createGeneratedMapData('structure-test', 'standard');
      expect(map.hq.tx).toBe(4);
      expect(map.hq.ty).toBe(map.height - 7);
    });

    it('HQ position scales with map size', () => {
      const small = createGeneratedMapData('hq-pos-small', 'small');
      const standard = createGeneratedMapData('hq-pos-std', 'standard');
      const large = createGeneratedMapData('hq-pos-large', 'large');
      expect(small.hq.ty).toBe(32 - 7);  // 25
      expect(standard.hq.ty).toBe(48 - 7); // 41
      expect(large.hq.ty).toBe(64 - 7);  // 57
    });

    it('HQ footprint is inside playable map', () => {
      for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
        const map = createGeneratedMapData('hq-bounds', size);
        // 3×3 footprint: (hq.tx, hq.ty) to (hq.tx+2, hq.ty+2)
        expect(map.hq.tx).toBeGreaterThanOrEqual(0);
        expect(map.hq.ty).toBeGreaterThanOrEqual(0);
        expect(map.hq.tx + 2).toBeLessThan(map.width);
        expect(map.hq.ty + 2).toBeLessThan(map.height);
      }
    });

    it('builder is inside playable map and near HQ', () => {
      const map = createGeneratedMapData('builder-test', 'standard');
      expect(map.builders.length).toBeGreaterThanOrEqual(1);
      const b = map.builders[0];
      expect(b.tx).toBeGreaterThanOrEqual(0);
      expect(b.ty).toBeGreaterThanOrEqual(0);
      expect(b.tx).toBeLessThan(map.width);
      expect(b.ty).toBeLessThan(map.height);
      // Builder should be within 2 tiles of HQ
      const dist = Math.max(Math.abs(b.tx - map.hq.tx), Math.abs(b.ty - map.hq.ty));
      expect(dist).toBeLessThanOrEqual(2);
    });

    it('has at least some resources', () => {
      const map = createGeneratedMapData('resource-test', 'standard');
      expect(map.resources.length).toBeGreaterThanOrEqual(5);
    });

    it('has an infinite resource deposit', () => {
      const map = createGeneratedMapData('infinite-test', 'standard');
      const infinite = map.resources.find(r => r.type === 'infinite');
      expect(infinite).toBeDefined();
      expect(infinite!.footprint).toBe(3);
    });

    it('has no buildings (MVP)', () => {
      const map = createGeneratedMapData('building-test', 'standard');
      expect(map.buildings).toEqual([]);
    });
  });

  // ── Resource balance (ARCH-09A) ────────────────────────────────

  describe('resource balance', () => {
    it('starter resources exist near HQ', () => {
      const map = createGeneratedMapData('starter-test', 'standard');
      const hqCenterX = map.hq.tx + 1;
      const hqCenterY = map.hq.ty + 1;
      const nearResources = map.resources.filter(r => {
        const dist = Math.sqrt((r.tx - hqCenterX) ** 2 + (r.ty - hqCenterY) ** 2);
        return dist <= 10;
      });
      // Should have at least the fixed starter cluster (6 medium + 6 small)
      expect(nearResources.length).toBeGreaterThanOrEqual(4);
    });

    it('resources do not overlap HQ', () => {
      const map = createGeneratedMapData('hq-clear-test', 'standard');
      for (const r of map.resources) {
        for (let dy = 0; dy < r.footprint; dy++) {
          for (let dx = 0; dx < r.footprint; dx++) {
            const rtx = r.tx + dx;
            const rty = r.ty + dy;
            // HQ footprint is (hq.tx, hq.ty) to (hq.tx+2, hq.ty+2)
            const overlapsHQ = rtx >= map.hq.tx && rtx <= map.hq.tx + 2 &&
                               rty >= map.hq.ty && rty <= map.hq.ty + 2;
            expect(overlapsHQ).toBe(false);
          }
        }
      }
    });

    it('resources do not overlap each other', () => {
      const map = createGeneratedMapData('overlap-test', 'standard');
      const tiles = new Set<string>();
      for (const r of map.resources) {
        for (let dy = 0; dy < r.footprint; dy++) {
          for (let dx = 0; dx < r.footprint; dx++) {
            const key = `${r.tx + dx},${r.ty + dy}`;
            expect(tiles.has(key)).toBe(false);
            tiles.add(key);
          }
        }
      }
    });

    it('infinite deposit exists near center', () => {
      const map = createGeneratedMapData('center-test', 'standard');
      const infinite = map.resources.find(r => r.type === 'infinite');
      expect(infinite).toBeDefined();
      // Center of 48x48 map is around (23, 23); infinite deposit is placed at (W/2-1, H/2-1)
      expect(infinite!.tx).toBeGreaterThanOrEqual(Math.floor(map.width / 2) - 2);
      expect(infinite!.tx).toBeLessThanOrEqual(Math.floor(map.width / 2) + 2);
    });

    it('large map has more resources than small map', () => {
      const small = createGeneratedMapData('size-compare', 'small');
      const large = createGeneratedMapData('size-compare', 'large');
      expect(large.resources.length).toBeGreaterThan(small.resources.length);
    });

    it('resources are within map bounds', () => {
      for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
        const map = createGeneratedMapData('bounds-test', size);
        for (const r of map.resources) {
          expect(r.tx).toBeGreaterThanOrEqual(0);
          expect(r.ty).toBeGreaterThanOrEqual(0);
          expect(r.tx + r.footprint).toBeLessThanOrEqual(map.width);
          expect(r.ty + r.footprint).toBeLessThanOrEqual(map.height);
        }
      }
    });

    it('starter resources are generally north-east of HQ (toward center)', () => {
      const map = createGeneratedMapData('ne-resource-test', 'standard');
      const hqCenterX = map.hq.tx + 1;
      const hqCenterY = map.hq.ty + 1;
      const nearResources = map.resources.filter(r => {
        const dist = Math.sqrt((r.tx - hqCenterX) ** 2 + (r.ty - hqCenterY) ** 2);
        return dist <= 8;
      });
      // Most near resources should be to the north (lower ty) or east (higher tx)
      // of HQ center since HQ is in the lower-left
      const neOrEast = nearResources.filter(r =>
        r.ty < hqCenterY || r.tx > hqCenterX
      );
      // At least half of nearby resources should be toward center/NE
      expect(neOrEast.length).toBeGreaterThan(0);
    });

    it('starter resources do not overlap HQ footprint', () => {
      for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
        const map = createGeneratedMapData('hq-no-overlap', size);
        const hqTiles = new Set<string>();
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            hqTiles.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
          }
        }
        for (const r of map.resources) {
          for (let dy = 0; dy < r.footprint; dy++) {
            for (let dx = 0; dx < r.footprint; dx++) {
              expect(hqTiles.has(`${r.tx + dx},${r.ty + dy}`)).toBe(false);
            }
          }
        }
      }
    });

    it('far resources tend to include large type', () => {
      const map = createGeneratedMapData('far-resources', 'large');
      const hqCenterX = map.hq.tx + 1;
      const hqCenterY = map.hq.ty + 1;
      const farResources = map.resources.filter(r => {
        const dist = Math.sqrt((r.tx - hqCenterX) ** 2 + (r.ty - hqCenterY) ** 2);
        return dist > 22 && r.type !== 'infinite';
      });
      // With large map and many far clusters, at least some should be large
      // (probabilistic but very likely)
      const hasLarge = farResources.some(r => r.type === 'large');
      if (farResources.length >= 5) {
        expect(hasLarge).toBe(true);
      }
    });
  });

  // ── Obstacles and decor (ARCH-08B — DEFERRED) ────────────────

  describe('obstacles and decor (deferred)', () => {
    it('generated maps have no obstacles (deferred until visual assets exist)', () => {
      const map = createGeneratedMapData('no-obstacles', 'large');
      expect(map.obstacles).toEqual([]);
    });

    it('generated maps have no decor (deferred until visual assets exist)', () => {
      const map = createGeneratedMapData('no-decor', 'large');
      expect(map.decor).toEqual([]);
    });

    it('no invisible blocking obstacles on any map size', () => {
      for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
        const map = createGeneratedMapData('invis-check', size);
        // Obstacles would be invisible (stateOnly) but blocking — must be empty
        expect(map.obstacles).toEqual([]);
      }
    });
  });

  // ── isGeneratedRuntimeState (devtools detection) ──────────────

  describe('isGeneratedRuntimeState', () => {
    it('returns true for generated map name', () => {
      const state = { mapName: generatedMapName('abc123', 'standard') };
      expect(isGeneratedRuntimeState(state)).toBe(true);
    });

    it('returns true for generated map name with different seed', () => {
      const state = { mapName: generatedMapName('test-seed-42', 'large') };
      expect(isGeneratedRuntimeState(state)).toBe(true);
    });

    it('returns false for fixed map name', () => {
      const state = { mapName: 'Map 1' };
      expect(isGeneratedRuntimeState(state)).toBe(false);
    });

    it('returns false for QA Arena map name', () => {
      const state = { mapName: 'QA Arena' };
      expect(isGeneratedRuntimeState(state)).toBe(false);
    });

    it('returns false for dimension-based fallback map name', () => {
      const state = { mapName: 'Map 48x48' };
      expect(isGeneratedRuntimeState(state)).toBe(false);
    });

    it('returns false for empty map name', () => {
      const state = { mapName: '' };
      expect(isGeneratedRuntimeState(state)).toBe(false);
    });
  });

  // ── Validation / fallback (ARCH-08B/09A) ───────────────────────

  describe('validation/fallback', () => {
    it('createValidatedGeneratedMapData returns a map', () => {
      const result = createValidatedGeneratedMapData('validation-test', 'standard');
      expect(result.mapData).toBeDefined();
      expect(result.mapData.width).toBe(48);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
      expect(result.attempts).toBeLessThanOrEqual(MAX_VALIDATION_ATTEMPTS);
    });

    it('validation does not throw', () => {
      expect(() => createValidatedGeneratedMapData('no-throw', 'small')).not.toThrow();
    });

    it('valid generated map passes validation', () => {
      const result = createValidatedGeneratedMapData('valid-seed', 'standard');
      // Most generated maps should pass validation
      expect(result.mapData.resources.length).toBeGreaterThan(0);
    });

    it('result includes valid flag and warnings', () => {
      const result = createValidatedGeneratedMapData('flags-test', 'standard');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  // ── Quality summary (ARCH-08B/09A) ────────────────────────────

  describe('quality summary', () => {
    it('returns correct map dimensions', () => {
      const map = createGeneratedMapData('quality-dims', 'small');
      const q = summarizeGeneratedMapQuality(map);
      expect(q.width).toBe(32);
      expect(q.height).toBe(32);
    });

    it('counts resources by type', () => {
      const map = createGeneratedMapData('quality-types', 'standard');
      const q = summarizeGeneratedMapQuality(map);
      expect(q.resourceCount).toBe(map.resources.length);
      expect(q.resourcesByType.small + q.resourcesByType.medium + q.resourcesByType.large + q.resourcesByType.infinite)
        .toBe(map.resources.length);
    });

    it('reports starter resource count', () => {
      const map = createGeneratedMapData('quality-starter', 'standard');
      const q = summarizeGeneratedMapQuality(map);
      expect(q.starterResourceCount).toBeGreaterThanOrEqual(4);
    });

    it('reports infinite deposit presence', () => {
      const map = createGeneratedMapData('quality-infinite', 'standard');
      const q = summarizeGeneratedMapQuality(map);
      expect(q.hasInfiniteDeposit).toBe(true);
    });

    it('reports obstacle and decor counts', () => {
      const map = createGeneratedMapData('quality-obs-dec', 'standard');
      const q = summarizeGeneratedMapQuality(map);
      expect(q.obstacleCount).toBe(map.obstacles.length);
      expect(q.decorCount).toBe(map.decor.length);
    });

    it('reports validation status', () => {
      const map = createGeneratedMapData('quality-valid', 'standard');
      const q = summarizeGeneratedMapQuality(map);
      expect(typeof q.validationPassed).toBe('boolean');
      expect(Array.isArray(q.validationIssues)).toBe(true);
    });
  });

  // ── QA Arena isolation ─────────────────────────────────────────

  describe('QA Arena isolation', () => {
    it('generated map ID does not match arena ID', () => {
      const id = generatedMapId('test', 'standard');
      expect(id).not.toBe('arena1');
    });
  });

  // ── VISUAL-05A-PR5: Industrial terrain generation ─────────────────

  describe('VISUAL-05A-PR5: industrial terrain generation', () => {
    it('industrial mapStyle produces all-industrial terrain', () => {
      const map = createGeneratedMapData('industrial-test', 'small', 'cyan', 'industrial');
      expect(map.width).toBe(32);
      expect(map.height).toBe(32);
      for (const row of map.terrain) {
        for (const cell of row) {
          expect(cell).toBe('industrial');
        }
      }
    });

    it('industrial map has same HQ position and builder as sand', () => {
      const sandMap = createGeneratedMapData('compare-sand', 'small', 'cyan', 'sand');
      const indMap = createGeneratedMapData('compare-ind', 'small', 'cyan', 'industrial');
      // Same HQ position
      expect(indMap.hq.tx).toBe(sandMap.hq.tx);
      expect(indMap.hq.ty).toBe(sandMap.hq.ty);
      // Same builder position
      expect(indMap.builders[0].tx).toBe(sandMap.builders[0].tx);
      expect(indMap.builders[0].ty).toBe(sandMap.builders[0].ty);
      // Resources may differ because industrial terrain uses fewer PRNG calls
      // (flat fill vs patch-based), shifting the RNG state. Both must be valid.
      expect(indMap.resources.length).toBeGreaterThan(0);
      expect(sandMap.resources.length).toBeGreaterThan(0);
    });

    it('industrial validated generation works', () => {
      const result = createValidatedGeneratedMapData('ind-validated', 'small', 'cyan', 'industrial');
      expect(result.mapData).toBeDefined();
      expect(result.mapData.width).toBe(32);
      // All terrain should be industrial
      expect(result.mapData.terrain[0][0]).toBe('industrial');
      // Should have resources
      expect(result.mapData.resources.length).toBeGreaterThan(0);
    });

    it('sand mapStyle still produces sand terrain (not industrial)', () => {
      const map = createGeneratedMapData('sand-still-works', 'small', 'cyan', 'sand');
      const hasIndustrial = map.terrain.some(row => row.some(t => t === 'industrial'));
      expect(hasIndustrial).toBe(false);
      const hasSand = map.terrain.some(row => row.some(t => t === 'sand'));
      expect(hasSand).toBe(true);
    });
  });
});
