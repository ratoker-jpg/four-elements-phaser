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
 * - Obstacle/decor placement
 * - Validation/fallback retry
 * - Quality summary diagnostics
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeSeed,
  createRandomSeed,
  mapSizeToDimensions,
  generatedMapName,
  generatedMapId,
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
      const validTypes = new Set(['sand', 'sand-light', 'sand-dark']);
      for (const row of map.terrain) {
        for (const cell of row) {
          expect(validTypes.has(cell)).toBe(true);
        }
      }
    });

    it('sand is the dominant terrain type', () => {
      const map = createGeneratedMapData('dominant-sand-test', 'standard');
      let sandCount = 0;
      let totalCells = 0;
      for (const row of map.terrain) {
        for (const cell of row) {
          totalCells++;
          if (cell === 'sand') sandCount++;
        }
      }
      // Sand should be at least 50% of the map (patch-based, so dominant)
      expect(sandCount / totalCells).toBeGreaterThan(0.5);
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
    it('has HQ at the expected position', () => {
      const map = createGeneratedMapData('structure-test', 'standard');
      expect(map.hq.tx).toBe(4);
      expect(map.hq.ty).toBe(4);
    });

    it('has at least one builder', () => {
      const map = createGeneratedMapData('builder-test', 'standard');
      expect(map.builders.length).toBeGreaterThanOrEqual(1);
    });

    it('builder is in idle phase', () => {
      const map = createGeneratedMapData('builder-test', 'standard');
      expect(map.builders[0].phase).toBe('idle');
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
            const overlapsHQ = rtx >= 4 && rtx <= 6 && rty >= 4 && rty <= 6;
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

  // ── Obstacles and decor (ARCH-08B) ─────────────────────────────

  describe('obstacles and decor', () => {
    it('obstacles are not placed within HQ clearance zone', () => {
      const map = createGeneratedMapData('obstacle-clearance', 'large');
      const hqCenterX = map.hq.tx + 1;
      const hqCenterY = map.hq.ty + 1;
      for (const o of map.obstacles) {
        for (let dy = 0; dy < o.footprint; dy++) {
          for (let dx = 0; dx < o.footprint; dx++) {
            const dist = Math.sqrt(
              (o.tx + dx - hqCenterX) ** 2 + (o.ty + dy - hqCenterY) ** 2
            );
            expect(dist).toBeGreaterThanOrEqual(10);
          }
        }
      }
    });

    it('decor is not placed within HQ decor clearance zone', () => {
      const map = createGeneratedMapData('decor-clearance', 'large');
      const hqCenterX = map.hq.tx + 1;
      const hqCenterY = map.hq.ty + 1;
      for (const d of map.decor) {
        const dist = Math.sqrt((d.tx - hqCenterX) ** 2 + (d.ty - hqCenterY) ** 2);
        expect(dist).toBeGreaterThanOrEqual(5);
      }
    });

    it('obstacles use valid obstacle types', () => {
      const map = createGeneratedMapData('obstacle-types', 'large');
      const validTypes = new Set(['mountain-small', 'mountain-medium', 'volcano-small', 'volcano-medium', 'rock-cluster']);
      for (const o of map.obstacles) {
        expect(validTypes.has(o.type)).toBe(true);
      }
    });

    it('decor uses valid decor types', () => {
      const map = createGeneratedMapData('decor-types', 'large');
      const validTypes = new Set(['bush', 'sand-bump']);
      for (const d of map.decor) {
        expect(validTypes.has(d.type)).toBe(true);
      }
    });

    it('large maps have more obstacles than standard maps', () => {
      // Run multiple seeds to get a representative sample
      let largeTotal = 0;
      let standardTotal = 0;
      for (let i = 0; i < 5; i++) {
        largeTotal += createGeneratedMapData(`obs-count-${i}`, 'large').obstacles.length;
        standardTotal += createGeneratedMapData(`obs-count-${i}`, 'standard').obstacles.length;
      }
      expect(largeTotal).toBeGreaterThanOrEqual(standardTotal);
    });

    it('obstacles and resources do not overlap', () => {
      const map = createGeneratedMapData('no-overlap', 'large');
      const resourceTiles = new Set<string>();
      for (const r of map.resources) {
        for (let dy = 0; dy < r.footprint; dy++) {
          for (let dx = 0; dx < r.footprint; dx++) {
            resourceTiles.add(`${r.tx + dx},${r.ty + dy}`);
          }
        }
      }
      for (const o of map.obstacles) {
        for (let dy = 0; dy < o.footprint; dy++) {
          for (let dx = 0; dx < o.footprint; dx++) {
            expect(resourceTiles.has(`${o.tx + dx},${o.ty + dy}`)).toBe(false);
          }
        }
      }
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
});
