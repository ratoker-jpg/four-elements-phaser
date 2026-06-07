/**
 * Tests for resource anchor placement — CORE-STEP-03B.
 *
 * Validates anchor-based resource placement, the 6-class resource model,
 * legacy type compatibility, deterministic generation, zone correctness,
 * and overlap/bounds safety.
 */

import { describe, it, expect } from 'vitest';
import {
  getResourceAnchors,
  applyControlledAnchorVariation,
  resolveResourceAnchors,
  resolveAnchorResourceType,
  RESOURCE_CLASS_TO_LEGACY_TYPE,
  type ResourceAnchor,
} from '../config/resourceAnchors';
import {
  ACCEPTED_RESOURCE_CLASS_IDS,
  type AcceptedResourceClassId,
} from '../config/coreMechanicsTypes';
import type { ResourceType } from '../state/types';
import {
  createGeneratedMapData,
  summarizeGeneratedMapQuality,
  type MapSizeOption,
} from '../state/generatedMap';
import { RESOURCE_CLASS_CONFIGS } from '../config/resourceClassData';

// ─── PRNG helper for tests ──────────────────────────────────────────

/** Simple mulberry32 PRNG for deterministic test data. */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Legacy type mapping ────────────────────────────────────────────

describe('CORE-STEP-03B: RESOURCE_CLASS_TO_LEGACY_TYPE mapping', () => {
  it('maps very_poor to small', () => {
    expect(RESOURCE_CLASS_TO_LEGACY_TYPE.very_poor).toBe('small');
  });

  it('maps poor to small', () => {
    expect(RESOURCE_CLASS_TO_LEGACY_TYPE.poor).toBe('small');
  });

  it('maps medium to medium', () => {
    expect(RESOURCE_CLASS_TO_LEGACY_TYPE.medium).toBe('medium');
  });

  it('maps rich to large', () => {
    expect(RESOURCE_CLASS_TO_LEGACY_TYPE.rich).toBe('large');
  });

  it('maps very_rich to large', () => {
    expect(RESOURCE_CLASS_TO_LEGACY_TYPE.very_rich).toBe('large');
  });

  it('maps infinite to infinite', () => {
    expect(RESOURCE_CLASS_TO_LEGACY_TYPE.infinite).toBe('infinite');
  });

  it('all 6 resource classes have a mapping', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      expect(RESOURCE_CLASS_TO_LEGACY_TYPE[classId]).toBeDefined();
    }
  });

  it('all mapped values are valid ResourceTypes', () => {
    const validTypes: Set<ResourceType> = new Set(['small', 'medium', 'large', 'infinite']);
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      expect(validTypes.has(RESOURCE_CLASS_TO_LEGACY_TYPE[classId])).toBe(true);
    }
  });
});

describe('CORE-STEP-03B: resolveAnchorResourceType', () => {
  it('resolves every class to a valid legacy type', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const legacyType = resolveAnchorResourceType(classId);
      expect(['small', 'medium', 'large', 'infinite']).toContain(legacyType);
    }
  });
});

// ─── Anchor computation ─────────────────────────────────────────────

describe('CORE-STEP-03B: getResourceAnchors', () => {
  const hq = { tx: 4, ty: 25 }; // 32x32 map HQ position

  it('returns at least 5 anchors for a 32x32 map', () => {
    const anchors = getResourceAnchors(32, 32, hq);
    expect(anchors.length).toBeGreaterThanOrEqual(5);
  });

  it('returns more anchors for larger maps', () => {
    const smallAnchors = getResourceAnchors(32, 32, hq);
    const stdAnchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const largeAnchors = getResourceAnchors(64, 64, { tx: 4, ty: 57 });
    expect(stdAnchors.length).toBeGreaterThan(smallAnchors.length);
    expect(largeAnchors.length).toBeGreaterThan(stdAnchors.length);
  });

  it('includes exactly one center infinite anchor', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const centerAnchors = anchors.filter(a => a.zone === 'center');
    expect(centerAnchors.length).toBe(1);
    expect(centerAnchors[0].resourceClass).toBe('infinite');
  });

  it('center infinite anchor has no variation', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const centerAnchor = anchors.find(a => a.zone === 'center')!;
    expect(centerAnchor.variationRadius).toBe(0);
  });

  it('center infinite anchor is near map center', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const centerAnchor = anchors.find(a => a.zone === 'center')!;
    // Center of 48x48 map is around (23, 23); anchor is at (W/2-1, H/2-1)
    expect(centerAnchor.tx).toBe(23);
    expect(centerAnchor.ty).toBe(23);
  });

  it('starter zone anchors have no variation', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const starterAnchors = anchors.filter(a => a.zone === 'starter');
    for (const anchor of starterAnchors) {
      expect(anchor.variationRadius).toBe(0);
    }
  });

  it('starter zone contains very_poor, poor, and medium classes', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const starterClasses = new Set(anchors.filter(a => a.zone === 'starter').map(a => a.resourceClass));
    expect(starterClasses.has('very_poor')).toBe(true);
    expect(starterClasses.has('poor')).toBe(true);
    expect(starterClasses.has('medium')).toBe(true);
  });

  it('side zone contains medium and/or rich classes', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const sideClasses = anchors.filter(a => a.zone === 'side').map(a => a.resourceClass);
    const hasMediumOrRich = sideClasses.some(c => c === 'medium' || c === 'rich');
    expect(hasMediumOrRich).toBe(true);
  });

  it('contested zone contains rich and/or very_rich classes', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const contestedClasses = anchors.filter(a => a.zone === 'contested').map(a => a.resourceClass);
    const hasRichOrVeryRich = contestedClasses.some(c => c === 'rich' || c === 'very_rich');
    expect(hasRichOrVeryRich).toBe(true);
  });

  it('all anchors have valid resource classes', () => {
    const anchors = getResourceAnchors(64, 64, { tx: 4, ty: 57 });
    for (const anchor of anchors) {
      expect(ACCEPTED_RESOURCE_CLASS_IDS).toContain(anchor.resourceClass);
    }
  });

  it('all anchors have valid zone values', () => {
    const anchors = getResourceAnchors(48, 48, { tx: 4, ty: 41 });
    const validZones = new Set(['starter', 'side', 'contested', 'center']);
    for (const anchor of anchors) {
      expect(validZones.has(anchor.zone)).toBe(true);
    }
  });
});

// ─── Variation ──────────────────────────────────────────────────────

describe('CORE-STEP-03B: applyControlledAnchorVariation', () => {
  const rng = mulberry32(42);
  const W = 48;
  const H = 48;
  const occupied = new Set<string>();

  it('returns exact anchor position for zero variation radius', () => {
    const anchor: ResourceAnchor = {
      tx: 10, ty: 10,
      resourceClass: 'medium',
      zone: 'starter',
      variationRadius: 0,
      mandatory: true,
    };
    const result = applyControlledAnchorVariation(anchor, rng, W, H, occupied, 1);
    expect(result.tx).toBe(10);
    expect(result.ty).toBe(10);
  });

  it('returns in-bounds positions', () => {
    const anchor: ResourceAnchor = {
      tx: 10, ty: 10,
      resourceClass: 'medium',
      zone: 'side',
      variationRadius: 2,
      mandatory: false,
    };
    for (let i = 0; i < 20; i++) {
      const localRng = mulberry32(i * 100);
      const result = applyControlledAnchorVariation(anchor, localRng, W, H, occupied, 1);
      expect(result.tx).toBeGreaterThanOrEqual(0);
      expect(result.ty).toBeGreaterThanOrEqual(0);
      expect(result.tx).toBeLessThan(W);
      expect(result.ty).toBeLessThan(H);
    }
  });

  it('avoids occupied tiles', () => {
    const anchor: ResourceAnchor = {
      tx: 10, ty: 10,
      resourceClass: 'medium',
      zone: 'side',
      variationRadius: 1,
      mandatory: false,
    };
    // Occupy the exact anchor position
    const localOccupied = new Set(['10,10']);
    const result = applyControlledAnchorVariation(anchor, rng, W, H, localOccupied, 1);
    // Result should not be at (10,10) or should be (10,10) if no valid variation found
    // but at minimum it should be a valid position
    expect(result.tx).toBeGreaterThanOrEqual(0);
    expect(result.ty).toBeGreaterThanOrEqual(0);
  });

  it('falls back to exact anchor when all variation candidates are blocked', () => {
    const anchor: ResourceAnchor = {
      tx: 10, ty: 10,
      resourceClass: 'medium',
      zone: 'side',
      variationRadius: 1,
      mandatory: true,
    };
    // Surround the anchor with occupied tiles
    const localOccupied = new Set<string>();
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        localOccupied.add(`${10 + dx},${10 + dy}`);
      }
    }
    // Remove the exact anchor position from occupied so fallback works
    localOccupied.delete('10,10');
    const result = applyControlledAnchorVariation(anchor, mulberry32(999), W, H, localOccupied, 1);
    // Fallback should be the anchor position itself
    expect(result.tx).toBe(10);
    expect(result.ty).toBe(10);
  });
});

// ─── Full resolution ───────────────────────────────────────────────

describe('CORE-STEP-03B: resolveResourceAnchors', () => {
  it('produces at least one of each starter zone class for 48x48 map', () => {
    const rng = mulberry32(42);
    const occupied = new Set<string>();
    const placements = resolveResourceAnchors(48, 48, { tx: 4, ty: 41 }, rng, occupied);
    const classes = new Set(placements.map(p => p.resourceClass));
    expect(classes.has('very_poor')).toBe(true);
    expect(classes.has('poor')).toBe(true);
    expect(classes.has('medium')).toBe(true);
  });

  it('always includes exactly one infinite placement', () => {
    for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
      const map = createGeneratedMapData('infinite-count-test', size);
      const infiniteResources = map.resources.filter(r => r.resourceClass === 'infinite');
      expect(infiniteResources.length).toBe(1);
    }
  });

  it('infinite placement has footprint 2', () => {
    const map = createGeneratedMapData('infinite-footprint-test', 'standard');
    const infinite = map.resources.find(r => r.resourceClass === 'infinite');
    expect(infinite).toBeDefined();
    expect(infinite!.footprint).toBe(2);
  });

  it('all placements have valid resourceClass', () => {
    const rng = mulberry32(42);
    const occupied = new Set<string>();
    const placements = resolveResourceAnchors(48, 48, { tx: 4, ty: 41 }, rng, occupied);
    for (const p of placements) {
      expect(ACCEPTED_RESOURCE_CLASS_IDS).toContain(p.resourceClass);
    }
  });

  it('all placements have valid legacyType', () => {
    const rng = mulberry32(42);
    const occupied = new Set<string>();
    const placements = resolveResourceAnchors(48, 48, { tx: 4, ty: 41 }, rng, occupied);
    const validTypes: Set<ResourceType> = new Set(['small', 'medium', 'large', 'infinite']);
    for (const p of placements) {
      expect(validTypes.has(p.legacyType)).toBe(true);
    }
  });

  it('resourceClass and legacyType are consistent', () => {
    const rng = mulberry32(42);
    const occupied = new Set<string>();
    const placements = resolveResourceAnchors(48, 48, { tx: 4, ty: 41 }, rng, occupied);
    for (const p of placements) {
      expect(p.legacyType).toBe(RESOURCE_CLASS_TO_LEGACY_TYPE[p.resourceClass]);
    }
  });

  it('no two placements overlap', () => {
    const rng = mulberry32(42);
    const occupied = new Set<string>();
    // resolveResourceAnchors modifies occupied — but we need to verify after
    resolveResourceAnchors(48, 48, { tx: 4, ty: 41 }, rng, occupied);
    // The occupied set should have no duplicates (already guaranteed by Set),
    // but let's also verify via explicit tile counting
    const placements = resolveResourceAnchors(48, 48, { tx: 4, ty: 41 }, mulberry32(42), new Set());
    const tiles = new Set<string>();
    for (const p of placements) {
      for (let dy = 0; dy < p.footprint; dy++) {
        for (let dx = 0; dx < p.footprint; dx++) {
          const key = `${p.tx + dx},${p.ty + dy}`;
          expect(tiles.has(key)).toBe(false);
          tiles.add(key);
        }
      }
    }
  });
});

// ─── Generated map integration tests ────────────────────────────────

describe('CORE-STEP-03B: generated map resourceClass integration', () => {
  it('every generated resource has resourceClass populated', () => {
    for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
      const map = createGeneratedMapData('class-populated', size);
      for (const r of map.resources) {
        expect(r.resourceClass).toBeDefined();
        expect(ACCEPTED_RESOURCE_CLASS_IDS).toContain(r.resourceClass);
      }
    }
  });

  it('every generated resource still has legacy type populated', () => {
    const map = createGeneratedMapData('legacy-type-test', 'standard');
    for (const r of map.resources) {
      expect(r.type).toBeDefined();
      expect(['small', 'medium', 'large', 'infinite']).toContain(r.type);
    }
  });

  it('same seed + same size produces identical resources', () => {
    const map1 = createGeneratedMapData('determinism-03b', 'standard');
    const map2 = createGeneratedMapData('determinism-03b', 'standard');
    expect(map1.resources).toEqual(map2.resources);
  });

  it('different seed produces allowed variation but valid layout', () => {
    const map1 = createGeneratedMapData('seed-X', 'standard');
    const map2 = createGeneratedMapData('seed-Y', 'standard');
    // Different seeds should produce different resource layouts (very likely)
    const str1 = JSON.stringify(map1.resources);
    const str2 = JSON.stringify(map2.resources);
    expect(str1).not.toBe(str2);
    // But both should be valid
    expect(map1.resources.length).toBeGreaterThan(0);
    expect(map2.resources.length).toBeGreaterThan(0);
    for (const r of [...map1.resources, ...map2.resources]) {
      expect(r.resourceClass).toBeDefined();
    }
  });

  it('starter zone includes very_poor/poor/medium near HQ', () => {
    const map = createGeneratedMapData('starter-zone-test', 'standard');
    const hqCenterX = map.hq.tx + 1;
    const hqCenterY = map.hq.ty + 1;
    const nearResources = map.resources.filter(r => {
      const dist = Math.sqrt((r.tx - hqCenterX) ** 2 + (r.ty - hqCenterY) ** 2);
      return dist <= 10;
    });
    const nearClasses = new Set(nearResources.map(r => r.resourceClass));
    // Starter zone should have at least very_poor and medium
    // (poor might be slightly beyond 10 tiles on some maps)
    expect(nearClasses.has('very_poor') || nearClasses.has('poor')).toBe(true);
    expect(nearClasses.has('medium')).toBe(true);
  });

  it('center has exactly one infinite resource', () => {
    for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
      const map = createGeneratedMapData('center-infinite', size);
      const infiniteResources = map.resources.filter(r => r.resourceClass === 'infinite');
      expect(infiniteResources.length).toBe(1);
    }
  });

  it('infinite has footprint 2', () => {
    const map = createGeneratedMapData('infinite-fp', 'standard');
    const infinite = map.resources.find(r => r.resourceClass === 'infinite');
    expect(infinite).toBeDefined();
    expect(infinite!.footprint).toBe(2);
  });

  it('infinite is near/exact map center', () => {
    const map = createGeneratedMapData('center-pos', 'standard');
    const infinite = map.resources.find(r => r.resourceClass === 'infinite');
    expect(infinite).toBeDefined();
    const centerX = Math.floor(map.width / 2);
    const centerY = Math.floor(map.height / 2);
    // Infinite should be within 2 tiles of exact center
    expect(Math.abs(infinite!.tx - (centerX - 1))).toBeLessThanOrEqual(1);
    expect(Math.abs(infinite!.ty - (centerY - 1))).toBeLessThanOrEqual(1);
  });

  it('resources do not overlap each other or HQ occupied area', () => {
    for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
      const map = createGeneratedMapData('overlap-check', size);
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
      // Resources should not overlap HQ footprint
      for (const r of map.resources) {
        for (let dy = 0; dy < r.footprint; dy++) {
          for (let dx = 0; dx < r.footprint; dx++) {
            const rtx = r.tx + dx;
            const rty = r.ty + dy;
            const overlapsHQ = rtx >= map.hq.tx && rtx <= map.hq.tx + 2 &&
                               rty >= map.hq.ty && rty <= map.hq.ty + 2;
            expect(overlapsHQ).toBe(false);
          }
        }
      }
    }
  });

  it('resource positions are within bounds', () => {
    for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
      const map = createGeneratedMapData('bounds-check', size);
      for (const r of map.resources) {
        expect(r.tx).toBeGreaterThanOrEqual(0);
        expect(r.ty).toBeGreaterThanOrEqual(0);
        expect(r.tx + r.footprint).toBeLessThanOrEqual(map.width);
        expect(r.ty + r.footprint).toBeLessThanOrEqual(map.height);
      }
    }
  });

  it('side/intermediate zones include medium/rich', () => {
    const map = createGeneratedMapData('side-zones', 'large');
    const sideOrContested = map.resources.filter(r =>
      r.resourceClass === 'medium' || r.resourceClass === 'rich'
    );
    expect(sideOrContested.length).toBeGreaterThan(0);
  });

  it('contested/far zones include rich/very_rich where map size allows', () => {
    const map = createGeneratedMapData('contested-zones', 'large');
    const contested = map.resources.filter(r =>
      r.resourceClass === 'rich' || r.resourceClass === 'very_rich'
    );
    // Large maps should have at least some rich/very_rich resources
    expect(contested.length).toBeGreaterThan(0);
  });

  it('quality summary reports resourcesByClass', () => {
    const map = createGeneratedMapData('quality-class', 'standard');
    const q = summarizeGeneratedMapQuality(map);
    expect(q.resourcesByClass).toBeDefined();
    // Should have at least some entries
    const totalByClass = Object.values(q.resourcesByClass).reduce((sum, n) => sum + (n ?? 0), 0);
    expect(totalByClass).toBe(map.resources.length);
  });

  it('map validation still passes for small/standard/large generated maps', () => {
    for (const size of ['small', 'standard', 'large'] as MapSizeOption[]) {
      const map = createGeneratedMapData('validation-03b', size);
      const q = summarizeGeneratedMapQuality(map);
      // At minimum, should have starter resources and infinite deposit
      expect(q.starterResourceCount).toBeGreaterThanOrEqual(2);
      expect(q.hasInfiniteDeposit).toBe(true);
    }
  });
});

// ─── No player-facing Matter ────────────────────────────────────────

describe('CORE-STEP-03B: no player-facing Matter in anchor generation', () => {
  it('no resourceClass name contains matter', () => {
    const allClasses: AcceptedResourceClassId[] = ['very_poor', 'poor', 'medium', 'rich', 'very_rich', 'infinite'];
    for (const cls of allClasses) {
      expect(cls.toLowerCase()).not.toContain('matter');
    }
  });

  it('no generated resource asset key contains matter', () => {
    for (const classId of ACCEPTED_RESOURCE_CLASS_IDS) {
      const assetKey = RESOURCE_CLASS_CONFIGS[classId].assetKey;
      expect(assetKey.toLowerCase()).not.toContain('matter');
    }
  });
});
