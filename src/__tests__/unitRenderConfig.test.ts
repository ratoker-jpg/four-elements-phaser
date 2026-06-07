import { describe, it, expect } from 'vitest';
import {
  HARVESTER_SCALE_MULT,
  BUILDER_SCALE_MULT,
  MODULAR_SCALE_MULT,
  HARVESTER_RENDER_SCALE,
  BUILDER_RENDER_SCALE,
  MODULAR_RENDER_SCALE,
  MODULAR_SCALE_RATIO,
  MODULAR_ANCHOR_CORRECTION,
} from '../config/unitRenderConfig';

/**
 * ARCH-05A: Unit render-scale configuration tests.
 *
 * Validates that scale multipliers and final render scales match
 * the intended visual normalisation:
 *   harvester:  ×1.30  (30% larger)
 *   builder:    ×1.45  (45% larger)
 *   modular:    ×0.75  (25% smaller)
 */

describe('unit render-scale multipliers', () => {
  it('harvester multiplier is 1.30', () => {
    expect(HARVESTER_SCALE_MULT).toBeCloseTo(1.30, 2);
  });

  it('builder multiplier is 1.45', () => {
    expect(BUILDER_SCALE_MULT).toBeCloseTo(1.45, 2);
  });

  it('modular multiplier is 0.75', () => {
    expect(MODULAR_SCALE_MULT).toBeCloseTo(0.75, 2);
  });
});

describe('unit render-scale final values', () => {
  // Pre-ARCH-05A baselines:
  //   harvester: 41/256 ≈ 0.160156
  //   builder:   40/256 ≈ 0.15625
  //   modular:   0.32

  it('harvester render scale = baseline × 1.30', () => {
    const baseline = 41 / 256;
    const expected = baseline * 1.30;
    expect(HARVESTER_RENDER_SCALE).toBeCloseTo(expected, 4);
  });

  it('harvester render scale is larger than baseline', () => {
    const baseline = 41 / 256;
    expect(HARVESTER_RENDER_SCALE).toBeGreaterThan(baseline);
  });

  it('builder render scale = baseline × 1.45', () => {
    const baseline = 40 / 256;
    const expected = baseline * 1.45;
    expect(BUILDER_RENDER_SCALE).toBeCloseTo(expected, 4);
  });

  it('builder render scale is larger than baseline', () => {
    const baseline = 40 / 256;
    expect(BUILDER_RENDER_SCALE).toBeGreaterThan(baseline);
  });

  it('modular render scale = baseline × 0.75', () => {
    const baseline = 0.32;
    const expected = baseline * 0.75;
    expect(MODULAR_RENDER_SCALE).toBeCloseTo(expected, 4);
  });

  it('modular render scale is smaller than baseline', () => {
    const baseline = 0.32;
    expect(MODULAR_RENDER_SCALE).toBeLessThan(baseline);
  });

  it('modular render scale is exactly 0.24', () => {
    expect(MODULAR_RENDER_SCALE).toBeCloseTo(0.24, 2);
  });
});

describe('scale ordering after normalisation', () => {
  it('builder is visually larger than harvester (same frame size)', () => {
    // Both use 256px spritesheets, so the scale factor directly
    // determines on-screen size. Builder got a bigger multiplier (1.45 vs 1.30).
    expect(BUILDER_RENDER_SCALE).toBeGreaterThan(HARVESTER_RENDER_SCALE);
  });

  it('modular scale was reduced from baseline', () => {
    // The modular tank uses different source images (not 256px spritesheets),
    // so its scale factor is not directly comparable to civil unit scales.
    // Verify it was reduced by the intended factor instead.
    expect(MODULAR_RENDER_SCALE).toBeLessThan(0.32);
    expect(MODULAR_RENDER_SCALE / 0.32).toBeCloseTo(0.75, 2);
  });
});

describe('modular scale-aware offset transform', () => {
  it('MODULAR_SCALE_RATIO = current scale / base scale', () => {
    const baseScale = 0.32;
    expect(MODULAR_SCALE_RATIO).toBeCloseTo(MODULAR_RENDER_SCALE / baseScale, 4);
  });

  it('MODULAR_SCALE_RATIO equals the modular multiplier (0.75)', () => {
    // When the base scale is 0.32 and the multiplier is 0.75,
    // the ratio is the same as the multiplier.
    expect(MODULAR_SCALE_RATIO).toBeCloseTo(0.75, 2);
  });

  it('MODULAR_SCALE_RATIO is between 0 and 1 (scale was reduced)', () => {
    expect(MODULAR_SCALE_RATIO).toBeGreaterThan(0);
    expect(MODULAR_SCALE_RATIO).toBeLessThan(1);
  });

  it('MODULAR_ANCHOR_CORRECTION has x and y number properties', () => {
    expect(typeof MODULAR_ANCHOR_CORRECTION.x).toBe('number');
    expect(typeof MODULAR_ANCHOR_CORRECTION.y).toBe('number');
    expect(isFinite(MODULAR_ANCHOR_CORRECTION.x)).toBe(true);
    expect(isFinite(MODULAR_ANCHOR_CORRECTION.y)).toBe(true);
  });

  it('MODULAR_ANCHOR_CORRECTION preserves base-scale visual centre', () => {
    // Derivation: 256×256 sprites, hull origin (0.5, 0.75), hull offset {2, 16}
    // At base scale (0.32), visual centre is at anchor + {2, -4.48}
    // At new scale with ratio only, visual centre is at anchor + {1.5, -3.36}
    // Correction shifts position so visual centre matches base scale.
    //
    // Hull position with transform = anchor + offset × ratio + correction
    // Visual centre Y = hullPos.y - 0.25 × 256 × 0.24
    //
    // We verify the transform produces the same visual centre as base scale.
    const baseScale = 0.32;
    const newScale = MODULAR_RENDER_SCALE;
    const hullOffset = { x: 2, y: 16 };
    const spriteH = 256;

    // Visual centre at base scale
    const baseVisCentreY = hullOffset.y - 0.25 * spriteH * baseScale;

    // Visual centre at new scale with transform
    const transformedY = hullOffset.y * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.y;
    const newVisCentreY = transformedY - 0.25 * spriteH * newScale;

    expect(newVisCentreY).toBeCloseTo(baseVisCentreY, 2);
  });

  it('scale transform preserves hull-turret relative offset proportionally', () => {
    // The turret mount offset relative to the hull offset should scale
    // by the same ratio, keeping the turret visually on the hull.
    const hullOffset = { x: 2, y: 16 };
    const turretMount = { x: -6, y: -18 }; // dir 2 example

    // Base-scale relative offset
    const baseRelX = turretMount.x - hullOffset.x;
    const baseRelY = turretMount.y - hullOffset.y;

    // Transformed relative offset (anchor correction cancels out)
    const transHull = {
      x: hullOffset.x * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.x,
      y: hullOffset.y * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.y,
    };
    const transTurret = {
      x: turretMount.x * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.x,
      y: turretMount.y * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.y,
    };
    const transRelX = transTurret.x - transHull.x;
    const transRelY = transTurret.y - transHull.y;

    // Relative offset should scale by MODULAR_SCALE_RATIO
    expect(transRelX).toBeCloseTo(baseRelX * MODULAR_SCALE_RATIO, 4);
    expect(transRelY).toBeCloseTo(baseRelY * MODULAR_SCALE_RATIO, 4);
  });
});
