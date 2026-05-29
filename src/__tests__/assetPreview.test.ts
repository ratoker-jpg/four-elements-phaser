/**
 * Tests for AssetPreviewTool pure helpers.
 *
 * DEV-ASSET-PREVIEW-01: Tests focus on pure TypeScript functions that
 * don't require Phaser mocks. Integration with Phaser (textures, sprites)
 * is validated via typecheck/build/qa:smoke.
 *
 * Fixup: Added resolveClickAction tests for click-routing logic
 * (pending → place, selected → move, inactive → no-op).
 */

import { describe, it, expect } from 'vitest';
import {
  applyChromaKey,
  validateFootprint,
  previewPlacementWorldPos,
  previewPlacementDepth,
  computeContainScale,
  DEFAULT_CHROMA_KEY_CONFIG,
  resolveClickAction,
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
    // South vertex of 1x1 at (0,0): tileToScreen(0, 0) + offset + TILE_H/2
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
    // Scale limited by height (100px vs 76px profile)
    // 76/100 = 0.76
    expect(scale).toBeCloseTo(0.76, 2);
  });

  it('preserves aspect ratio (wide image)', () => {
    const scale = computeContainScale(200, 20, 1, 1);
    // Scale limited by width (76/200 = 0.38)
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
