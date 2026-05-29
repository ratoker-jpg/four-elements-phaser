/**
 * Tests for AssetPreviewTool pure helpers.
 *
 * DEV-ASSET-PREVIEW-01: Tests focus on pure TypeScript functions that
 * don't require Phaser mocks. Integration with Phaser (textures, sprites)
 * is validated via typecheck/build/qa:smoke.
 *
 * Fixup: Added resolveClickAction tests for click-routing logic
 * (pending → place, selected → move, inactive → no-op).
 *
 * DEV-ASSET-PREVIEW-03: Added tests for HEX parsing/normalization,
 * custom chroma-key color, tolerance config creation, and reprocessing
 * with non-default target colors.
 */

import { describe, it, expect } from 'vitest';
import {
  applyChromaKey,
  validateFootprint,
  previewPlacementWorldPos,
  previewPlacementDepth,
  computeContainScale,
  DEFAULT_CHROMA_KEY_CONFIG,
  DEFAULT_CHROMA_KEY_HEX,
  DEFAULT_CHROMA_KEY_TOLERANCE,
  resolveClickAction,
  parseHexColor,
  normalizeHexColor,
  createChromaKeyConfigFromHex,
  type ChromaKeyConfig,
} from '../phaser/dev/AssetPreviewTool';

// ─── applyChromaKey ──────────────────────────────────────────────────

describe('applyChromaKey', () => {
  function makeImageData(r: number, g: number, b: number, a: number): ImageData {
    const data = new Uint8ClampedArray([r, g, b, a]);
    return { data, width: 1, height: 1, colorSpace: 'srgb' };
  }

  it('removes pure magenta pixels within tolerance', () => {
    const img = makeImageData(255, 0, 255, 255);
    const result = applyChromaKey(img, DEFAULT_CHROMA_KEY_CONFIG);
    expect(result.data[3]).toBe(0); // alpha should be 0
  });

  it('removes near-magenta pixels within tolerance', () => {
    const img = makeImageData(240, 15, 250, 255);
    const config: ChromaKeyConfig = { targetR: 255, targetG: 0, targetB: 255, tolerance: 32 };
    const result = applyChromaKey(img, config);
    expect(result.data[3]).toBe(0);
  });

  it('does not remove non-magenta pixels', () => {
    const img = makeImageData(128, 128, 128, 255);
    const result = applyChromaKey(img, DEFAULT_CHROMA_KEY_CONFIG);
    expect(result.data[3]).toBe(255); // alpha unchanged
  });

  it('does not remove pixels outside tolerance', () => {
    const img = makeImageData(200, 50, 200, 255);
    const config: ChromaKeyConfig = { targetR: 255, targetG: 0, targetB: 255, tolerance: 10 };
    const result = applyChromaKey(img, config);
    expect(result.data[3]).toBe(255); // alpha unchanged — too far from magenta
  });

  it('handles already-transparent pixels', () => {
    const img = makeImageData(255, 0, 255, 0);
    const result = applyChromaKey(img, DEFAULT_CHROMA_KEY_CONFIG);
    expect(result.data[3]).toBe(0); // remains 0
  });

  it('processes multi-pixel image data', () => {
    const data = new Uint8ClampedArray([
      255, 0, 255, 255,  // magenta → remove
      128, 128, 128, 255, // gray → keep
      255, 10, 245, 255,  // near-magenta → remove
    ]);
    const img: ImageData = { data, width: 3, height: 1, colorSpace: 'srgb' };
    const result = applyChromaKey(img, DEFAULT_CHROMA_KEY_CONFIG);
    expect(result.data[3]).toBe(0);   // magenta removed
    expect(result.data[7]).toBe(255); // gray kept
    expect(result.data[11]).toBe(0);  // near-magenta removed
  });

  // DEV-ASSET-PREVIEW-03: custom target color tests

  it('removes #FC02FA pixels when configured as target', () => {
    const img = makeImageData(252, 2, 250, 255);
    const config: ChromaKeyConfig = { targetR: 252, targetG: 2, targetB: 250, tolerance: 32 };
    const result = applyChromaKey(img, config);
    expect(result.data[3]).toBe(0);
  });

  it('removes near-#FC02FA pixels within tolerance', () => {
    // Pixel is (250, 5, 248) — within 32 of (252, 2, 250)
    const img = makeImageData(250, 5, 248, 255);
    const config: ChromaKeyConfig = { targetR: 252, targetG: 2, targetB: 250, tolerance: 32 };
    const result = applyChromaKey(img, config);
    expect(result.data[3]).toBe(0);
  });

  it('preserves non-target colors when using custom chroma-key', () => {
    // Gray pixel should not be removed when targeting #FC02FA
    const img = makeImageData(128, 128, 128, 255);
    const config: ChromaKeyConfig = { targetR: 252, targetG: 2, targetB: 250, tolerance: 32 };
    const result = applyChromaKey(img, config);
    expect(result.data[3]).toBe(255); // alpha unchanged
  });

  it('preserves pure magenta when targeting a different color', () => {
    // #FF00FF should NOT be removed when targeting #FC02FA with tight tolerance
    // Use tolerance=1: |255-252|=3 > 1, so #FF00FF is preserved
    const config: ChromaKeyConfig = { targetR: 252, targetG: 2, targetB: 250, tolerance: 1 };
    const img = makeImageData(255, 0, 255, 255);
    const result = applyChromaKey(img, config);
    expect(result.data[3]).toBe(255); // not removed — too far from target
  });

  it('handles zero tolerance — exact match only', () => {
    const img1 = makeImageData(252, 2, 250, 255);
    const config: ChromaKeyConfig = { targetR: 252, targetG: 2, targetB: 250, tolerance: 0 };
    const result1 = applyChromaKey(img1, config);
    expect(result1.data[3]).toBe(0); // exact match → removed

    const img2 = makeImageData(253, 2, 250, 255);
    const result2 = applyChromaKey(img2, config);
    expect(result2.data[3]).toBe(255); // off by 1 → not removed
  });

  it('handles multi-pixel with custom target', () => {
    const data = new Uint8ClampedArray([
      252, 2, 250, 255,   // exact #FC02FA → remove
      128, 128, 128, 255, // gray → keep
      240, 10, 240, 255,  // near #FC02FA within tolerance 32 → remove
      0, 0, 0, 255,       // black → keep
    ]);
    const img: ImageData = { data, width: 4, height: 1, colorSpace: 'srgb' };
    const config: ChromaKeyConfig = { targetR: 252, targetG: 2, targetB: 250, tolerance: 32 };
    const result = applyChromaKey(img, config);
    expect(result.data[3]).toBe(0);    // #FC02FA removed
    expect(result.data[7]).toBe(255);  // gray kept
    expect(result.data[11]).toBe(0);   // near-#FC02FA removed
    expect(result.data[15]).toBe(255); // black kept
  });
});

// ─── validateFootprint ────────────────────────────────────────────────

describe('validateFootprint', () => {
  it('accepts valid footprint 1', () => {
    expect(validateFootprint(1)).toBe(1);
  });

  it('accepts valid footprint 2', () => {
    expect(validateFootprint(2)).toBe(2);
  });

  it('accepts valid footprint 3', () => {
    expect(validateFootprint(3)).toBe(3);
  });

  it('defaults invalid footprint 0 to 1', () => {
    expect(validateFootprint(0)).toBe(1);
  });

  it('defaults invalid footprint 4 to 1', () => {
    expect(validateFootprint(4)).toBe(1);
  });

  it('defaults negative footprint to 1', () => {
    expect(validateFootprint(-1)).toBe(1);
  });

  it('defaults fractional footprint to 1', () => {
    expect(validateFootprint(1.5)).toBe(1);
  });
});

// ─── previewPlacementWorldPos ─────────────────────────────────────────

describe('previewPlacementWorldPos', () => {
  const offset = { x: 100, y: 200 };

  it('computes world position for 1x1 footprint', () => {
    const pos = previewPlacementWorldPos(0, 0, 1, offset);
    expect(pos.x).toBeDefined();
    expect(pos.y).toBeDefined();
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('computes different positions for different tiles', () => {
    const pos1 = previewPlacementWorldPos(0, 0, 1, offset);
    const pos2 = previewPlacementWorldPos(1, 0, 1, offset);
    expect(pos1.x).not.toBe(pos2.x);
  });

  it('computes different positions for different footprints', () => {
    const pos1 = previewPlacementWorldPos(0, 0, 1, offset);
    const pos2 = previewPlacementWorldPos(0, 0, 2, offset);
    expect(pos1.y).not.toBe(pos2.y); // larger footprint has lower south vertex
  });
});

// ─── previewPlacementDepth ────────────────────────────────────────────

describe('previewPlacementDepth', () => {
  it('returns depth >= 100 for any placement', () => {
    const depth = previewPlacementDepth(0, 0, 1);
    expect(depth).toBeGreaterThanOrEqual(100);
  });

  it('deeper placement has higher depth value', () => {
    const depth1 = previewPlacementDepth(0, 0, 1);
    const depth2 = previewPlacementDepth(0, 5, 1);
    expect(depth2).toBeGreaterThan(depth1);
  });
});

// ─── computeContainScale ──────────────────────────────────────────────

describe('computeContainScale', () => {
  it('scales down large image to fit profile', () => {
    const scale = computeContainScale(512, 512, 1, 1);
    expect(scale).toBeLessThan(1); // 76/512 < 1
  });

  it('scales up small image to fill profile', () => {
    const scale = computeContainScale(16, 16, 1, 1);
    expect(scale).toBeGreaterThan(1);
  });

  it('user scale multiplies the contain scale', () => {
    const scale1 = computeContainScale(100, 100, 1, 1);
    const scale2 = computeContainScale(100, 100, 1, 2);
    expect(scale2).toBeCloseTo(scale1 * 2, 5);
  });

  it('larger footprint allows larger scale', () => {
    const scale1 = computeContainScale(100, 100, 1, 1);
    const scale2 = computeContainScale(100, 100, 2, 1);
    expect(scale2).toBeGreaterThan(scale1);
  });

  it('preserves aspect ratio (narrow image)', () => {
    const scale = computeContainScale(10, 100, 1, 1);
    expect(scale).toBeCloseTo(0.76, 2);
  });

  it('preserves aspect ratio (wide image)', () => {
    const scale = computeContainScale(200, 20, 1, 1);
    expect(scale).toBeCloseTo(0.38, 2);
  });
});

// ─── DEFAULT_CHROMA_KEY_CONFIG ────────────────────────────────────────

describe('DEFAULT_CHROMA_KEY_CONFIG', () => {
  it('targets pure magenta', () => {
    expect(DEFAULT_CHROMA_KEY_CONFIG.targetR).toBe(255);
    expect(DEFAULT_CHROMA_KEY_CONFIG.targetG).toBe(0);
    expect(DEFAULT_CHROMA_KEY_CONFIG.targetB).toBe(255);
  });

  it('has reasonable tolerance', () => {
    expect(DEFAULT_CHROMA_KEY_CONFIG.tolerance).toBeGreaterThan(0);
    expect(DEFAULT_CHROMA_KEY_CONFIG.tolerance).toBeLessThanOrEqual(128);
  });
});

// ─── DEFAULT_CHROMA_KEY_HEX / DEFAULT_CHROMA_KEY_TOLERANCE ───────────

describe('DEFAULT_CHROMA_KEY_HEX and TOLERANCE', () => {
  it('DEFAULT_CHROMA_KEY_HEX is uppercase #FF00FF', () => {
    expect(DEFAULT_CHROMA_KEY_HEX).toBe('#FF00FF');
  });

  it('DEFAULT_CHROMA_KEY_TOLERANCE is 32', () => {
    expect(DEFAULT_CHROMA_KEY_TOLERANCE).toBe(32);
  });
});

// ─── parseHexColor (DEV-ASSET-PREVIEW-03) ────────────────────────────

describe('parseHexColor', () => {
  it('parses #FF00FF to {r:255, g:0, b:255}', () => {
    const result = parseHexColor('#FF00FF');
    expect(result).toEqual({ r: 255, g: 0, b: 255 });
  });

  it('parses FF00FF (no hash) to {r:255, g:0, b:255}', () => {
    const result = parseHexColor('FF00FF');
    expect(result).toEqual({ r: 255, g: 0, b: 255 });
  });

  it('parses #fc02fa (lowercase) correctly', () => {
    const result = parseHexColor('#fc02fa');
    expect(result).toEqual({ r: 252, g: 2, b: 250 });
  });

  it('parses #FC02FA (uppercase) correctly', () => {
    const result = parseHexColor('#FC02FA');
    expect(result).toEqual({ r: 252, g: 2, b: 250 });
  });

  it('parses shorthand #F0F to {r:255, g:0, b:255}', () => {
    const result = parseHexColor('#F0F');
    expect(result).toEqual({ r: 255, g: 0, b: 255 });
  });

  it('parses shorthand F0F (no hash) correctly', () => {
    const result = parseHexColor('F0F');
    expect(result).toEqual({ r: 255, g: 0, b: 255 });
  });

  it('parses #000000 to {r:0, g:0, b:0}', () => {
    const result = parseHexColor('#000000');
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses #FFFFFF to {r:255, g:255, b:255}', () => {
    const result = parseHexColor('#FFFFFF');
    expect(result).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('trims whitespace before parsing', () => {
    const result = parseHexColor('  #FF00FF  ');
    expect(result).toEqual({ r: 255, g: 0, b: 255 });
  });

  it('returns null for invalid hex characters', () => {
    expect(parseHexColor('#GGGGGG')).toBeNull();
  });

  it('returns null for wrong length (5 chars)', () => {
    expect(parseHexColor('#FFFFF')).toBeNull();
  });

  it('returns null for wrong length (7 chars after #)', () => {
    expect(parseHexColor('#FFFFFFF')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseHexColor('')).toBeNull();
  });

  it('returns null for just a hash', () => {
    expect(parseHexColor('#')).toBeNull();
  });
});

// ─── normalizeHexColor (DEV-ASSET-PREVIEW-03) ────────────────────────

describe('normalizeHexColor', () => {
  it('normalizes #ff00ff to #FF00FF', () => {
    expect(normalizeHexColor('#ff00ff')).toBe('#FF00FF');
  });

  it('normalizes fc02fa to #FC02FA', () => {
    expect(normalizeHexColor('fc02fa')).toBe('#FC02FA');
  });

  it('normalizes #FC02FA (already normalized)', () => {
    expect(normalizeHexColor('#FC02FA')).toBe('#FC02FA');
  });

  it('normalizes shorthand #f0f to #FF00FF', () => {
    expect(normalizeHexColor('#f0f')).toBe('#FF00FF');
  });

  it('normalizes shorthand FC0 to #FFCC00', () => {
    expect(normalizeHexColor('FC0')).toBe('#FFCC00');
  });

  it('normalizes #000000 to #000000', () => {
    expect(normalizeHexColor('#000000')).toBe('#000000');
  });

  it('returns null for invalid input', () => {
    expect(normalizeHexColor('not-a-color')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeHexColor('')).toBeNull();
  });

  it('returns null for partial hex', () => {
    expect(normalizeHexColor('#FF')).toBeNull();
  });
});

// ─── createChromaKeyConfigFromHex (DEV-ASSET-PREVIEW-03) ─────────────

describe('createChromaKeyConfigFromHex', () => {
  it('creates config from #FF00FF with tolerance 32', () => {
    const config = createChromaKeyConfigFromHex('#FF00FF', 32);
    expect(config).toEqual({ targetR: 255, targetG: 0, targetB: 255, tolerance: 32 });
  });

  it('creates config from fc02fa (no hash) with tolerance 48', () => {
    const config = createChromaKeyConfigFromHex('fc02fa', 48);
    expect(config).toEqual({ targetR: 252, targetG: 2, targetB: 250, tolerance: 48 });
  });

  it('creates config from shorthand #F0F', () => {
    const config = createChromaKeyConfigFromHex('#F0F', 16);
    expect(config).toEqual({ targetR: 255, targetG: 0, targetB: 255, tolerance: 16 });
  });

  it('clamps tolerance to 0 minimum', () => {
    const config = createChromaKeyConfigFromHex('#FF00FF', -10);
    expect(config).not.toBeNull();
    expect(config!.tolerance).toBe(0);
  });

  it('clamps tolerance to 255 maximum', () => {
    const config = createChromaKeyConfigFromHex('#FF00FF', 300);
    expect(config).not.toBeNull();
    expect(config!.tolerance).toBe(255);
  });

  it('rounds fractional tolerance', () => {
    const config = createChromaKeyConfigFromHex('#FF00FF', 32.7);
    expect(config).not.toBeNull();
    expect(config!.tolerance).toBe(33);
  });

  it('returns null for invalid HEX', () => {
    expect(createChromaKeyConfigFromHex('invalid', 32)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(createChromaKeyConfigFromHex('', 32)).toBeNull();
  });

  it('round-trips: config from HEX can be used with applyChromaKey', () => {
    const config = createChromaKeyConfigFromHex('#FC02FA', 32);
    expect(config).not.toBeNull();

    const data = new Uint8ClampedArray([252, 2, 250, 255]);
    const img: ImageData = { data, width: 1, height: 1, colorSpace: 'srgb' };
    const result = applyChromaKey(img, config!);
    expect(result.data[3]).toBe(0); // #FC02FA removed
  });
});

// ─── resolveClickAction ────────────────────────────────────────────────

describe('resolveClickAction', () => {
  it('returns none when tool is inactive', () => {
    const action = resolveClickAction({
      active: false,
      pendingAssetId: 'asset-1',
      selectedPlacementId: null,
      tx: 5,
      ty: 5,
      currentScale: 1,
      currentFootprint: 1,
    });
    expect(action.kind).toBe('none');
  });

  it('returns place when active with pending asset', () => {
    const action = resolveClickAction({
      active: true,
      pendingAssetId: 'asset-1',
      selectedPlacementId: null,
      tx: 3,
      ty: 4,
      currentScale: 1.5,
      currentFootprint: 2,
    });
    expect(action.kind).toBe('place');
    if (action.kind === 'place') {
      expect(action.assetId).toBe('asset-1');
      expect(action.tx).toBe(3);
      expect(action.ty).toBe(4);
      expect(action.scale).toBe(1.5);
      expect(action.footprint).toBe(2);
    }
  });

  it('returns move when active with selected placement and no pending asset', () => {
    const action = resolveClickAction({
      active: true,
      pendingAssetId: null,
      selectedPlacementId: 'place-1',
      tx: 7,
      ty: 8,
      currentScale: 1,
      currentFootprint: 1,
    });
    expect(action.kind).toBe('move');
    if (action.kind === 'move') {
      expect(action.placementId).toBe('place-1');
      expect(action.tx).toBe(7);
      expect(action.ty).toBe(8);
    }
  });

  it('prioritizes place over move when both pending asset and selected placement exist', () => {
    const action = resolveClickAction({
      active: true,
      pendingAssetId: 'asset-1',
      selectedPlacementId: 'place-1',
      tx: 5,
      ty: 5,
      currentScale: 1,
      currentFootprint: 1,
    });
    expect(action.kind).toBe('place');
  });

  it('returns none when active but no pending asset and no selected placement', () => {
    const action = resolveClickAction({
      active: true,
      pendingAssetId: null,
      selectedPlacementId: null,
      tx: 5,
      ty: 5,
      currentScale: 1,
      currentFootprint: 1,
    });
    expect(action.kind).toBe('none');
  });

  it('returns none for negative tile coordinates', () => {
    const action = resolveClickAction({
      active: true,
      pendingAssetId: 'asset-1',
      selectedPlacementId: null,
      tx: -1,
      ty: 5,
      currentScale: 1,
      currentFootprint: 1,
    });
    expect(action.kind).toBe('none');
  });

  it('uses current scale and footprint for place action', () => {
    const action = resolveClickAction({
      active: true,
      pendingAssetId: 'asset-1',
      selectedPlacementId: null,
      tx: 2,
      ty: 3,
      currentScale: 2.0,
      currentFootprint: 3,
    });
    expect(action.kind).toBe('place');
    if (action.kind === 'place') {
      expect(action.scale).toBe(2.0);
      expect(action.footprint).toBe(3);
    }
  });
});
