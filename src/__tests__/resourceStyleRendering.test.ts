/**
 * VISUAL-06E: Tests for resourceStyle-aware resource rendering.
 *
 * Tests the pure data functions exported from EntityRenderer:
 * - RESOURCE_ASSET_MAPS: correct key mapping per resourceStyle
 * - RESOURCE_SCALE_MAPS: correct scale values per resourceStyle
 * - getResourceAssetKey: style-aware key lookup with fallback
 * - getResourceScale: style-aware scale with legacy fallback
 *
 * These are pure TypeScript tests — no Phaser rendering required.
 * The actual Phaser rendering is validated by typecheck + qa:smoke.
 */

import { describe, it, expect } from 'vitest';
import {
  RESOURCE_ASSET_MAPS,
  RESOURCE_SCALE_MAPS,
  getResourceAssetKey,
  getResourceScale,
} from '../phaser/render/EntityRenderer';
import type { ResourceType } from '../state/types';
import type { ResourceStyle } from '../state/gameSetup';

// ─── Mock texture manager for getResourceAssetKey tests ────────────

/**
 * Minimal mock of Phaser.Textures.TextureManager.
 * Only the `exists(key)` method is needed for getResourceAssetKey.
 */
function createMockTextureManager(existingKeys: Set<string>) {
  return {
    exists: (key: string) => existingKeys.has(key),
  } as unknown as Phaser.Textures.TextureManager;
}

// ─── RESOURCE_ASSET_MAPS ──────────────────────────────────────────

describe('VISUAL-06E: RESOURCE_ASSET_MAPS', () => {
  it('has legacy and industrial keys', () => {
    expect(Object.keys(RESOURCE_ASSET_MAPS)).toEqual(['legacy', 'industrial']);
  });

  it('legacy maps to sand mineral keys', () => {
    expect(RESOURCE_ASSET_MAPS.legacy.small).toBe('mineral_small');
    expect(RESOURCE_ASSET_MAPS.legacy.medium).toBe('mineral_medium');
    expect(RESOURCE_ASSET_MAPS.legacy.large).toBe('mineral_large');
    expect(RESOURCE_ASSET_MAPS.legacy.infinite).toBe('mineral_large'); // no infinite-specific asset
  });

  it('industrial maps to approved VISUAL-06 crystal keys', () => {
    expect(RESOURCE_ASSET_MAPS.industrial.small).toBe('resource_industrial_poor_01');
    expect(RESOURCE_ASSET_MAPS.industrial.medium).toBe('resource_industrial_medium_01');
    expect(RESOURCE_ASSET_MAPS.industrial.large).toBe('resource_industrial_rich_01');
    expect(RESOURCE_ASSET_MAPS.industrial.infinite).toBe('resource_industrial_infinite_center_2x2_01');
  });

  it('covers all four ResourceType values for both styles', () => {
    const resourceTypes: ResourceType[] = ['small', 'medium', 'large', 'infinite'];
    const styles: ResourceStyle[] = ['legacy', 'industrial'];
    for (const style of styles) {
      for (const rt of resourceTypes) {
        expect(RESOURCE_ASSET_MAPS[style][rt]).toBeDefined();
        expect(typeof RESOURCE_ASSET_MAPS[style][rt]).toBe('string');
      }
    }
  });

  it('very_poor and very_rich are NOT in the production mapping', () => {
    // These assets exist in the manifest but are reserved for future mapgen/richness PR.
    // The production ResourceType only has small/medium/large/infinite.
    expect(RESOURCE_ASSET_MAPS.industrial).not.toHaveProperty('very_poor');
    expect(RESOURCE_ASSET_MAPS.industrial).not.toHaveProperty('very_rich');
  });
});

// ─── RESOURCE_SCALE_MAPS ──────────────────────────────────────────

describe('VISUAL-06E: RESOURCE_SCALE_MAPS', () => {
  it('has legacy and industrial keys', () => {
    expect(Object.keys(RESOURCE_SCALE_MAPS)).toEqual(['legacy', 'industrial']);
  });

  it('legacy scales match original values', () => {
    expect(RESOURCE_SCALE_MAPS.legacy.small).toBe(0.3);
    expect(RESOURCE_SCALE_MAPS.legacy.medium).toBe(0.4);
    expect(RESOURCE_SCALE_MAPS.legacy.large).toBe(0.5);
    expect(RESOURCE_SCALE_MAPS.legacy.infinite).toBe(0.65);
  });

  it('industrial scales are positive numbers', () => {
    const resourceTypes: ResourceType[] = ['small', 'medium', 'large', 'infinite'];
    for (const rt of resourceTypes) {
      expect(RESOURCE_SCALE_MAPS.industrial[rt]).toBeGreaterThan(0);
      expect(RESOURCE_SCALE_MAPS.industrial[rt]).toBeLessThan(1);
    }
  });

  it('industrial scales are smaller than legacy (larger source images)', () => {
    // Industrial PNGs are variable-cropped (155-247px wide), while legacy
    // mineral canvases are fixed 384px. So industrial scales should be smaller.
    expect(RESOURCE_SCALE_MAPS.industrial.small).toBeLessThan(RESOURCE_SCALE_MAPS.legacy.small);
    expect(RESOURCE_SCALE_MAPS.industrial.medium).toBeLessThan(RESOURCE_SCALE_MAPS.legacy.medium);
    expect(RESOURCE_SCALE_MAPS.industrial.large).toBeLessThan(RESOURCE_SCALE_MAPS.legacy.large);
    expect(RESOURCE_SCALE_MAPS.industrial.infinite).toBeLessThan(RESOURCE_SCALE_MAPS.legacy.infinite);
  });

  it('industrial infinite scale is larger than industrial finite scales', () => {
    // The infinite 2×2 asset should render larger than 1×1 nodes
    expect(RESOURCE_SCALE_MAPS.industrial.infinite).toBeGreaterThan(RESOURCE_SCALE_MAPS.industrial.small);
    expect(RESOURCE_SCALE_MAPS.industrial.infinite).toBeGreaterThan(RESOURCE_SCALE_MAPS.industrial.medium);
  });
});

// ─── getResourceAssetKey ──────────────────────────────────────────

describe('VISUAL-06E: getResourceAssetKey', () => {
  it('returns legacy key when resourceStyle is legacy and texture exists', () => {
    const tm = createMockTextureManager(new Set(['mineral_small', 'mineral_medium', 'mineral_large']));
    expect(getResourceAssetKey('small', 'legacy', tm)).toBe('mineral_small');
    expect(getResourceAssetKey('medium', 'legacy', tm)).toBe('mineral_medium');
    expect(getResourceAssetKey('large', 'legacy', tm)).toBe('mineral_large');
    expect(getResourceAssetKey('infinite', 'legacy', tm)).toBe('mineral_large');
  });

  it('returns industrial key when resourceStyle is industrial and texture exists', () => {
    const tm = createMockTextureManager(new Set([
      'resource_industrial_poor_01',
      'resource_industrial_medium_01',
      'resource_industrial_rich_01',
      'resource_industrial_infinite_center_2x2_01',
    ]));
    expect(getResourceAssetKey('small', 'industrial', tm)).toBe('resource_industrial_poor_01');
    expect(getResourceAssetKey('medium', 'industrial', tm)).toBe('resource_industrial_medium_01');
    expect(getResourceAssetKey('large', 'industrial', tm)).toBe('resource_industrial_rich_01');
    expect(getResourceAssetKey('infinite', 'industrial', tm)).toBe('resource_industrial_infinite_center_2x2_01');
  });

  it('falls back to legacy key when industrial texture is missing', () => {
    const tm = createMockTextureManager(new Set([
      'mineral_small', 'mineral_medium', 'mineral_large',
      // industrial textures NOT loaded
    ]));
    expect(getResourceAssetKey('small', 'industrial', tm)).toBe('mineral_small');
    expect(getResourceAssetKey('medium', 'industrial', tm)).toBe('mineral_medium');
    expect(getResourceAssetKey('large', 'industrial', tm)).toBe('mineral_large');
    expect(getResourceAssetKey('infinite', 'industrial', tm)).toBe('mineral_large');
  });

  it('returns preferred key as last resort when neither texture exists', () => {
    const tm = createMockTextureManager(new Set<string>()); // no textures
    // Falls through to last resort — returns the preferred key
    expect(getResourceAssetKey('medium', 'industrial', tm)).toBe('resource_industrial_medium_01');
    expect(getResourceAssetKey('medium', 'legacy', tm)).toBe('mineral_medium');
  });
});

// ─── getResourceScale ─────────────────────────────────────────────

describe('VISUAL-06E: getResourceScale', () => {
  it('returns industrial scale for industrial key', () => {
    const scale = getResourceScale('medium', 'industrial', 'resource_industrial_medium_01');
    expect(scale).toBe(RESOURCE_SCALE_MAPS.industrial.medium);
  });

  it('returns legacy scale for legacy key (even when resourceStyle is industrial)', () => {
    // When falling back to legacy texture, use legacy scale
    const scale = getResourceScale('medium', 'industrial', 'mineral_medium');
    expect(scale).toBe(RESOURCE_SCALE_MAPS.legacy.medium);
  });

  it('returns legacy scale for legacy key and legacy style', () => {
    const scale = getResourceScale('large', 'legacy', 'mineral_large');
    expect(scale).toBe(RESOURCE_SCALE_MAPS.legacy.large);
  });

  it('returns industrial infinite scale for industrial infinite key', () => {
    const scale = getResourceScale('infinite', 'industrial', 'resource_industrial_infinite_center_2x2_01');
    expect(scale).toBe(RESOURCE_SCALE_MAPS.industrial.infinite);
  });
});

// ─── resourceStyle default ────────────────────────────────────────

describe('VISUAL-06E: resourceStyle default in gameSetup', () => {
  it('DEFAULT_SETUP.resourceStyle is industrial (matches default industrial mapStyle)', async () => {
    const { DEFAULT_SETUP } = await import('../state/gameSetup');
    expect(DEFAULT_SETUP.resourceStyle).toBe('industrial');
  });
});
