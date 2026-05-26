import { describe, it, expect } from 'vitest';
import {
  HARVESTER_SCALE_MULT,
  BUILDER_SCALE_MULT,
  MODULAR_SCALE_MULT,
  HARVESTER_RENDER_SCALE,
  BUILDER_RENDER_SCALE,
  MODULAR_RENDER_SCALE,
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
