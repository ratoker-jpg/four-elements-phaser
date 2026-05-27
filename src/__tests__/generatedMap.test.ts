/**
 * Tests for generatedMap — pure TypeScript, no Phaser.
 *
 * ARCH-16B: Tests for seed normalization, deterministic generation,
 * size dimensions, map structure, and resource placement.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeSeed,
  createRandomSeed,
  mapSizeToDimensions,
  generatedMapName,
  generatedMapId,
  createGeneratedMapData,
  MAP_SIZE_DIMENSIONS,
  GENERATED_MAP_ID_PREFIX,
  type MapSizeOption,
} from '../state/generatedMap';

describe('ARCH-16B: generatedMap helpers', () => {
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
      // Same input => same output
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
      // Very unlikely to get 10 identical seeds
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

      // Same terrain
      expect(map1.terrain).toEqual(map2.terrain);
      // Same resources
      expect(map1.resources).toEqual(map2.resources);
      // Same HQ
      expect(map1.hq).toEqual(map2.hq);
      // Same dimensions
      expect(map1.width).toBe(map2.width);
      expect(map1.height).toBe(map2.height);
    });

    it('different seed produces different resource placement', () => {
      const map1 = createGeneratedMapData('seed-A', 'standard');
      const map2 = createGeneratedMapData('seed-B', 'standard');

      // Resources should differ (extremely unlikely to be identical)
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

    it('has no obstacles (MVP)', () => {
      const map = createGeneratedMapData('obstacle-test', 'standard');
      expect(map.obstacles).toEqual([]);
    });

    it('has no decor (MVP)', () => {
      const map = createGeneratedMapData('decor-test', 'standard');
      expect(map.decor).toEqual([]);
    });

    it('has no buildings (MVP)', () => {
      const map = createGeneratedMapData('building-test', 'standard');
      expect(map.buildings).toEqual([]);
    });

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

    it('HQ area is free of resources', () => {
      const map = createGeneratedMapData('hq-clear-test', 'standard');
      // HQ is at (4,4) with 3×3 footprint. Check no resource overlaps.
      for (const r of map.resources) {
        for (let dy = 0; dy < r.footprint; dy++) {
          for (let dx = 0; dx < r.footprint; dx++) {
            const rtx = r.tx + dx;
            const rty = r.ty + dy;
            // Should not overlap with HQ footprint (4-6, 4-6)
            const overlapsHQ = rtx >= 4 && rtx <= 6 && rty >= 4 && rty <= 6;
            expect(overlapsHQ).toBe(false);
          }
        }
      }
    });

    it('resources are within map bounds', () => {
      const map = createGeneratedMapData('bounds-test', 'small');
      for (const r of map.resources) {
        expect(r.tx).toBeGreaterThanOrEqual(0);
        expect(r.ty).toBeGreaterThanOrEqual(0);
        expect(r.tx + r.footprint).toBeLessThanOrEqual(map.width);
        expect(r.ty + r.footprint).toBeLessThanOrEqual(map.height);
      }
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
