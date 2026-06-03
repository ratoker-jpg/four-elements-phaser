/**
 * Tests for pure armor formula helper.
 *
 * CORE-STEP-02C: Validates the accepted armor formula:
 *   finalDamage = max(rawDamage - armor, rawDamage * minDamagePercent)
 *
 * Tests cover:
 * - Formula correctness with various inputs
 * - Vulcan-style small hits against Mammoth (floor damage)
 * - Railgun-style large hit against heavy armor (still useful)
 * - Armor cannot reduce damage below floor
 * - Armor 0 returns raw damage
 * - Invalid inputs are clamped consistently
 */

import { describe, it, expect } from 'vitest';
import { calculateArmorReducedDamage } from '../config/armorFormula';

// ─── Basic formula correctness ───────────────────────────────────────

describe('armor formula: basic correctness', () => {
  it('formula matches max(rawDamage - armor, rawDamage * minDamagePercent)', () => {
    // Case 1: flat reduction is higher than floor
    const result1 = calculateArmorReducedDamage({
      rawDamage: 100, armor: 10, minDamagePercent: 0.2,
    });
    expect(result1.finalDamage).toBe(90); // max(90, 20) = 90
    expect(result1.hitFloor).toBe(false);

    // Case 2: floor is higher than flat reduction
    const result2 = calculateArmorReducedDamage({
      rawDamage: 100, armor: 90, minDamagePercent: 0.2,
    });
    expect(result2.finalDamage).toBe(20); // max(10, 20) = 20
    expect(result2.hitFloor).toBe(true);
  });

  it('returns rawDamage when armor is 0', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 50, armor: 0, minDamagePercent: 0.2,
    });
    expect(result.finalDamage).toBe(50);
    expect(result.hitFloor).toBe(false);
    expect(result.reduction).toBe(0);
  });

  it('returns floor when armor exceeds raw damage', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 30, armor: 50, minDamagePercent: 0.15,
    });
    expect(result.finalDamage).toBe(30 * 0.15); // 4.5
    expect(result.hitFloor).toBe(true);
  });

  it('reduction equals rawDamage - finalDamage', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 100, armor: 30, minDamagePercent: 0.2,
    });
    expect(result.reduction).toBe(100 - result.finalDamage);
  });
});

// ─── No zero damage ──────────────────────────────────────────────────

describe('armor formula: no zero damage', () => {
  it('result is never negative', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 1, armor: 100, minDamagePercent: 0.01,
    });
    expect(result.finalDamage).toBeGreaterThanOrEqual(0);
  });

  it('result is never below floor (with minDamagePercent > 0)', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 50, armor: 200, minDamagePercent: 0.1,
    });
    expect(result.finalDamage).toBeGreaterThanOrEqual(50 * 0.1);
  });

  it('result can be 0 when minDamagePercent is 0 and armor >= rawDamage', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 10, armor: 20, minDamagePercent: 0,
    });
    expect(result.finalDamage).toBe(0);
  });

  it('result equals rawDamage when minDamagePercent is 1', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 50, armor: 30, minDamagePercent: 1,
    });
    expect(result.finalDamage).toBe(50);
    expect(result.hitFloor).toBe(true);
  });
});

// ─── Vulcan vs Mammoth — small frequent hits ─────────────────────────

describe('armor formula: Vulcan-style small hits against Mammoth', () => {
  // Mammoth M3: armor=32, minDamagePercent=0.12
  // Vulcan M3: directDamage=5 per shot
  it('Vulcan M3 vs Mammoth M3 still deals floor damage', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 5, armor: 32, minDamagePercent: 0.12,
    });
    // 5 - 32 = -27, floor = 5 * 0.12 = 0.6
    expect(result.finalDamage).toBe(0.6);
    expect(result.hitFloor).toBe(true);
  });

  it('Vulcan M0 vs Mammoth M3 deals even less', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 4, armor: 32, minDamagePercent: 0.12,
    });
    // 4 - 32 = -28, floor = 4 * 0.12 = 0.48
    expect(result.finalDamage).toBe(0.48);
    expect(result.hitFloor).toBe(true);
  });

  it('Vulcan M3 vs Wasp M0 (light) deals more damage', () => {
    // Wasp M0: armor=2, minDamagePercent=0.25
    const result = calculateArmorReducedDamage({
      rawDamage: 5, armor: 2, minDamagePercent: 0.25,
    });
    // 5 - 2 = 3, floor = 5 * 0.25 = 1.25
    expect(result.finalDamage).toBe(3);
    expect(result.hitFloor).toBe(false);
  });
});

// ─── Railgun vs heavy armor — big hits remain useful ─────────────────

describe('armor formula: Railgun vs heavy armor', () => {
  // Railgun M3: directDamage=40
  it('Railgun M3 vs Titan M3 (armor=25, floor=0.15) still deals significant damage', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 40, armor: 25, minDamagePercent: 0.15,
    });
    // 40 - 25 = 15, floor = 40 * 0.15 = 6
    expect(result.finalDamage).toBe(15);
    expect(result.hitFloor).toBe(false);
  });

  it('Railgun M3 vs Mammoth M3 (armor=32, floor=0.12) deals meaningful damage', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 40, armor: 32, minDamagePercent: 0.12,
    });
    // 40 - 32 = 8, floor = 40 * 0.12 = 4.8
    expect(result.finalDamage).toBe(8);
    expect(result.hitFloor).toBe(false);
  });

  it('Railgun M0 vs Mammoth M3 (armor=32) still useful', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 32, armor: 32, minDamagePercent: 0.12,
    });
    // 32 - 32 = 0, floor = 32 * 0.12 = 3.84
    expect(result.finalDamage).toBe(3.84);
    expect(result.hitFloor).toBe(true);
  });
});

// ─── Armor cannot reduce below floor ─────────────────────────────────

describe('armor formula: floor enforcement', () => {
  it('even massive armor cannot reduce below floor', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 100, armor: 10000, minDamagePercent: 0.05,
    });
    expect(result.finalDamage).toBe(100 * 0.05); // 5
    expect(result.hitFloor).toBe(true);
  });

  it('floor scales with rawDamage', () => {
    const result1 = calculateArmorReducedDamage({
      rawDamage: 10, armor: 100, minDamagePercent: 0.2,
    });
    const result2 = calculateArmorReducedDamage({
      rawDamage: 100, armor: 100, minDamagePercent: 0.2,
    });
    // Both hit floor, but larger rawDamage = larger floor
    expect(result1.finalDamage).toBe(2);
    expect(result2.finalDamage).toBe(20);
  });
});

// ─── Invalid input handling (clamping) ───────────────────────────────

describe('armor formula: invalid input clamping', () => {
  it('negative rawDamage is clamped to 0', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: -10, armor: 5, minDamagePercent: 0.2,
    });
    expect(result.finalDamage).toBe(0);
  });

  it('negative armor is clamped to 0', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 50, armor: -10, minDamagePercent: 0.2,
    });
    expect(result.finalDamage).toBe(50);
  });

  it('negative minDamagePercent is clamped to 0', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 50, armor: 60, minDamagePercent: -0.1,
    });
    // With minDamagePercent clamped to 0: max(-10, 0) = 0
    expect(result.finalDamage).toBe(0);
  });

  it('minDamagePercent > 1 is clamped to 1', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 50, armor: 10, minDamagePercent: 2,
    });
    // With minDamagePercent clamped to 1: floor = 50 * 1 = 50
    expect(result.finalDamage).toBe(50);
  });

  it('zero rawDamage with high armor returns 0', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 0, armor: 100, minDamagePercent: 0.2,
    });
    expect(result.finalDamage).toBe(0);
  });

  it('all-zero inputs return 0', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 0, armor: 0, minDamagePercent: 0,
    });
    expect(result.finalDamage).toBe(0);
  });
});

// ─── Reduction tracking ──────────────────────────────────────────────

describe('armor formula: reduction tracking', () => {
  it('reduction is 0 when armor is 0', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 100, armor: 0, minDamagePercent: 0.2,
    });
    expect(result.reduction).toBe(0);
  });

  it('reduction equals armor when not hitting floor', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 100, armor: 20, minDamagePercent: 0.2,
    });
    expect(result.reduction).toBe(20);
  });

  it('reduction is less than armor when hitting floor', () => {
    const result = calculateArmorReducedDamage({
      rawDamage: 30, armor: 50, minDamagePercent: 0.2,
    });
    // finalDamage = 30 * 0.2 = 6, reduction = 30 - 6 = 24 (< 50 armor)
    expect(result.reduction).toBe(24);
    expect(result.hitFloor).toBe(true);
  });
});
