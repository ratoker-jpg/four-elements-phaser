/**
 * Tests for motion FX helper — pure TypeScript, no Phaser.
 *
 * ARCH-13C-LITE: Movement delta classification, dust profile selection,
 * and lifetime/fade math.
 */

import { describe, it, expect } from 'vitest';
import {
  isMoving,
  computeMovementSpeed,
  getDustProfile,
  computeDustAlpha,
  computeDustRadius,
  speedAlphaMultiplier,
  type MotionUnitType,
} from '../state/motionFx';

// ─── Movement detection ───────────────────────────────────────────

describe('isMoving', () => {
  it('returns false when positions are identical', () => {
    expect(isMoving(5, 5, 5, 5)).toBe(false);
  });

  it('returns false when delta is below default epsilon', () => {
    // Default epsilon is 0.002
    expect(isMoving(5, 5, 5.001, 5)).toBe(false);
    expect(isMoving(5, 5, 5, 5.001)).toBe(false);
  });

  it('returns true when delta exceeds default epsilon', () => {
    expect(isMoving(5, 5, 5.01, 5)).toBe(true);
    expect(isMoving(5, 5, 5, 5.01)).toBe(true);
  });

  it('respects custom epsilon', () => {
    expect(isMoving(5, 5, 5.005, 5, 0.01)).toBe(false);
    expect(isMoving(5, 5, 5.05, 5, 0.01)).toBe(true);
  });

  it('detects negative movement', () => {
    expect(isMoving(5, 5, 4.99, 5)).toBe(true);
    expect(isMoving(5, 5, 5, 4.99)).toBe(true);
  });

  it('detects diagonal movement', () => {
    expect(isMoving(5, 5, 5.01, 5.01)).toBe(true);
  });
});

// ─── Movement speed computation ───────────────────────────────────

describe('computeMovementSpeed', () => {
  it('returns 0 when deltaMs is 0', () => {
    expect(computeMovementSpeed(0, 0, 1, 1, 0)).toBe(0);
  });

  it('returns 0 when deltaMs is negative', () => {
    expect(computeMovementSpeed(0, 0, 1, 1, -100)).toBe(0);
  });

  it('computes correct speed for 1-tile movement in 1 second', () => {
    const speed = computeMovementSpeed(0, 0, 1, 0, 1000);
    expect(speed).toBeCloseTo(1.0, 2);
  });

  it('computes correct speed for diagonal movement', () => {
    // Move from (0,0) to (1,1) in 1 second → distance = sqrt(2) ≈ 1.414
    const speed = computeMovementSpeed(0, 0, 1, 1, 1000);
    expect(speed).toBeCloseTo(Math.sqrt(2), 2);
  });

  it('computes correct speed for half-second delta', () => {
    // Move 1 tile in 500ms → speed = 2 tiles/sec
    const speed = computeMovementSpeed(0, 0, 1, 0, 500);
    expect(speed).toBeCloseTo(2.0, 2);
  });

  it('returns 0 when there is no movement', () => {
    const speed = computeMovementSpeed(5, 5, 5, 5, 1000);
    expect(speed).toBe(0);
  });
});

// ─── Dust profile selection ───────────────────────────────────────

describe('getDustProfile', () => {
  const unitTypes: MotionUnitType[] = ['builder', 'harvester', 'tank'];

  it('returns a profile for each unit type', () => {
    for (const type of unitTypes) {
      const profile = getDustProfile(type);
      expect(profile).toBeDefined();
      expect(profile.radiusMin).toBeGreaterThan(0);
      expect(profile.radiusMax).toBeGreaterThanOrEqual(profile.radiusMin);
      expect(profile.lifetimeMs).toBeGreaterThan(0);
      expect(profile.alphaMax).toBeGreaterThan(0);
      expect(profile.alphaMax).toBeLessThanOrEqual(1);
      expect(profile.countPerEmit).toBeGreaterThanOrEqual(1);
      expect(profile.emitIntervalMs).toBeGreaterThan(0);
    }
  });

  it('harvester profile has larger/heavier dust than builder', () => {
    const builder = getDustProfile('builder');
    const harvester = getDustProfile('harvester');

    expect(harvester.radiusMin).toBeGreaterThanOrEqual(builder.radiusMin);
    expect(harvester.alphaMax).toBeGreaterThan(builder.alphaMax);
    expect(harvester.countPerEmit).toBeGreaterThanOrEqual(builder.countPerEmit);
  });

  it('tank profile has larger/heavier dust than harvester', () => {
    const harvester = getDustProfile('harvester');
    const tank = getDustProfile('tank');

    expect(tank.radiusMin).toBeGreaterThanOrEqual(harvester.radiusMin);
    expect(tank.alphaMax).toBeGreaterThanOrEqual(harvester.alphaMax);
  });

  it('all profiles use sandy/brown color tones', () => {
    for (const type of unitTypes) {
      const profile = getDustProfile(type);
      // Colors are in 0xRRGGBB format, all should be non-zero
      expect(profile.color).toBeGreaterThan(0);
    }
  });
});

// ─── Fade math ────────────────────────────────────────────────────

describe('computeDustAlpha', () => {
  it('returns alphaMax at age 0', () => {
    expect(computeDustAlpha(0, 400, 0.35)).toBeCloseTo(0.35, 4);
  });

  it('returns 0 when age equals lifetime', () => {
    expect(computeDustAlpha(400, 400, 0.35)).toBe(0);
  });

  it('returns 0 when age exceeds lifetime', () => {
    expect(computeDustAlpha(500, 400, 0.35)).toBe(0);
  });

  it('fades linearly — at half lifetime, alpha is half', () => {
    expect(computeDustAlpha(200, 400, 0.4)).toBeCloseTo(0.2, 4);
  });

  it('fades linearly — at quarter lifetime, alpha is 75%', () => {
    expect(computeDustAlpha(100, 400, 0.4)).toBeCloseTo(0.3, 4);
  });
});

describe('computeDustRadius', () => {
  it('returns base radius at age 0', () => {
    expect(computeDustRadius(3, 0, 400)).toBeCloseTo(3, 4);
  });

  it('expands by up to 30% at end of lifetime', () => {
    const expanded = computeDustRadius(3, 400, 400);
    expect(expanded).toBeCloseTo(3 * 1.3, 4);
  });

  it('expands by 15% at half lifetime', () => {
    const half = computeDustRadius(3, 200, 400);
    expect(half).toBeCloseTo(3 * 1.15, 4);
  });

  it('caps at 130% even if age exceeds lifetime', () => {
    const capped = computeDustRadius(3, 800, 400);
    expect(capped).toBeCloseTo(3 * 1.3, 4);
  });
});

// ─── Speed-based alpha multiplier ─────────────────────────────────

describe('speedAlphaMultiplier', () => {
  it('returns 1.0 for zero speed', () => {
    expect(speedAlphaMultiplier(0)).toBe(1.0);
  });

  it('returns 1.2 at reference speed (2.5 tiles/sec)', () => {
    expect(speedAlphaMultiplier(2.5)).toBeCloseTo(1.2, 4);
  });

  it('returns higher multiplier for faster speed', () => {
    const fast = speedAlphaMultiplier(5.0);
    const slow = speedAlphaMultiplier(1.0);
    expect(fast).toBeGreaterThan(slow);
  });

  it('caps at 1.4 maximum', () => {
    expect(speedAlphaMultiplier(100)).toBe(1.4);
  });

  it('uses custom reference speed when provided', () => {
    // At custom reference speed 3.0, multiplier should be 1.2
    expect(speedAlphaMultiplier(3.0, 3.0)).toBeCloseTo(1.2, 4);
  });
});
