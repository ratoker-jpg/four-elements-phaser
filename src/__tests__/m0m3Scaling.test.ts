/**
 * Tests for shared M0-M3 scaling helpers.
 *
 * CORE-STEP-02C: Validates getMLevelValue, clampModificationLevel,
 * isValidModificationLevel, isNonDecreasingMLevelData,
 * isNonIncreasingMLevelData, hasFourMLevels, isMLevelData.
 */

import { describe, it, expect } from 'vitest';
import {
  getMLevelValue,
  clampModificationLevel,
  isValidModificationLevel,
  isNonDecreasingMLevelData,
  isNonIncreasingMLevelData,
  hasFourMLevels,
  isMLevelData,
} from '../config/m0m3Scaling';

// ─── getMLevelValue ──────────────────────────────────────────────────

describe('getMLevelValue', () => {
  const data = [10, 20, 30, 40] as const;

  it('returns M0 value for level 0', () => {
    expect(getMLevelValue(data, 0)).toBe(10);
  });

  it('returns M1 value for level 1', () => {
    expect(getMLevelValue(data, 1)).toBe(20);
  });

  it('returns M2 value for level 2', () => {
    expect(getMLevelValue(data, 2)).toBe(30);
  });

  it('returns M3 value for level 3', () => {
    expect(getMLevelValue(data, 3)).toBe(40);
  });

  it('clamps negative level to M0', () => {
    expect(getMLevelValue(data, -1)).toBe(10);
  });

  it('clamps negative level -10 to M0', () => {
    expect(getMLevelValue(data, -10)).toBe(10);
  });

  it('clamps level above 3 to M3', () => {
    expect(getMLevelValue(data, 4)).toBe(40);
  });

  it('clamps level 100 to M3', () => {
    expect(getMLevelValue(data, 100)).toBe(40);
  });

  it('clamps fractional level (1.7 → M1)', () => {
    expect(getMLevelValue(data, 1.7)).toBe(20);
  });

  it('clamps fractional level (2.9 → M2)', () => {
    expect(getMLevelValue(data, 2.9)).toBe(30);
  });

  it('works with string data', () => {
    const strData = ['a', 'b', 'c', 'd'] as const;
    expect(getMLevelValue(strData, 0)).toBe('a');
    expect(getMLevelValue(strData, 3)).toBe('d');
  });
});

// ─── clampModificationLevel ──────────────────────────────────────────

describe('clampModificationLevel', () => {
  it('returns 0 for level 0', () => {
    expect(clampModificationLevel(0)).toBe(0);
  });

  it('returns 3 for level 3', () => {
    expect(clampModificationLevel(3)).toBe(3);
  });

  it('clamps negative to 0', () => {
    expect(clampModificationLevel(-5)).toBe(0);
  });

  it('clamps above 3 to 3', () => {
    expect(clampModificationLevel(10)).toBe(3);
  });

  it('floors fractional values', () => {
    expect(clampModificationLevel(1.5)).toBe(1);
  });

  it('floors 0.9 to 0', () => {
    expect(clampModificationLevel(0.9)).toBe(0);
  });
});

// ─── isValidModificationLevel ────────────────────────────────────────

describe('isValidModificationLevel', () => {
  it('returns true for 0', () => {
    expect(isValidModificationLevel(0)).toBe(true);
  });

  it('returns true for 3', () => {
    expect(isValidModificationLevel(3)).toBe(true);
  });

  it('returns false for 4', () => {
    expect(isValidModificationLevel(4)).toBe(false);
  });

  it('returns false for -1', () => {
    expect(isValidModificationLevel(-1)).toBe(false);
  });

  it('returns false for 1.5 (not integer)', () => {
    expect(isValidModificationLevel(1.5)).toBe(false);
  });

  it('returns false for NaN', () => {
    expect(isValidModificationLevel(NaN)).toBe(false);
  });
});

// ─── isNonDecreasingMLevelData ───────────────────────────────────────

describe('isNonDecreasingMLevelData', () => {
  it('returns true for strictly increasing data', () => {
    expect(isNonDecreasingMLevelData([1, 2, 3, 4])).toBe(true);
  });

  it('returns true for flat (all equal) data', () => {
    expect(isNonDecreasingMLevelData([5, 5, 5, 5])).toBe(true);
  });

  it('returns true for non-decreasing with equal adjacent', () => {
    expect(isNonDecreasingMLevelData([1, 2, 2, 3])).toBe(true);
  });

  it('returns false for decreasing data', () => {
    expect(isNonDecreasingMLevelData([4, 3, 2, 1])).toBe(false);
  });

  it('returns false if any step decreases', () => {
    expect(isNonDecreasingMLevelData([1, 3, 2, 4])).toBe(false);
  });

  it('returns true for single-step decrease at end', () => {
    expect(isNonDecreasingMLevelData([1, 2, 3, 2])).toBe(false);
  });
});

// ─── isNonIncreasingMLevelData ───────────────────────────────────────

describe('isNonIncreasingMLevelData', () => {
  it('returns true for strictly decreasing data', () => {
    expect(isNonIncreasingMLevelData([4, 3, 2, 1])).toBe(true);
  });

  it('returns true for flat (all equal) data', () => {
    expect(isNonIncreasingMLevelData([5, 5, 5, 5])).toBe(true);
  });

  it('returns true for non-increasing with equal adjacent', () => {
    expect(isNonIncreasingMLevelData([3, 2, 2, 1])).toBe(true);
  });

  it('returns false for increasing data', () => {
    expect(isNonIncreasingMLevelData([1, 2, 3, 4])).toBe(false);
  });

  it('returns false if any step increases', () => {
    expect(isNonIncreasingMLevelData([4, 2, 3, 1])).toBe(false);
  });

  it('returns true for cooldown-style data (improves = shorter)', () => {
    expect(isNonIncreasingMLevelData([900, 850, 820, 800])).toBe(true);
  });
});

// ─── hasFourMLevels ──────────────────────────────────────────────────

describe('hasFourMLevels', () => {
  it('returns true for array of length 4', () => {
    expect(hasFourMLevels([1, 2, 3, 4])).toBe(true);
  });

  it('returns false for array of length 3', () => {
    expect(hasFourMLevels([1, 2, 3])).toBe(false);
  });

  it('returns false for array of length 5', () => {
    expect(hasFourMLevels([1, 2, 3, 4, 5])).toBe(false);
  });

  it('returns false for non-array', () => {
    expect(hasFourMLevels('hello')).toBe(false);
    expect(hasFourMLevels(42)).toBe(false);
    expect(hasFourMLevels(null)).toBe(false);
  });

  it('returns true for string array of length 4', () => {
    expect(hasFourMLevels(['a', 'b', 'c', 'd'])).toBe(true);
  });
});

// ─── isMLevelData ────────────────────────────────────────────────────

describe('isMLevelData', () => {
  it('returns true for valid numeric array of length 4', () => {
    expect(isMLevelData([1, 2, 3, 4])).toBe(true);
  });

  it('returns true for array with floats', () => {
    expect(isMLevelData([1.5, 2.5, 3.5, 4.5])).toBe(true);
  });

  it('returns false for array with NaN', () => {
    expect(isMLevelData([1, 2, NaN, 4])).toBe(false);
  });

  it('returns false for array with strings', () => {
    expect(isMLevelData([1, 2, '3', 4] as unknown)).toBe(false);
  });

  it('returns false for wrong length', () => {
    expect(isMLevelData([1, 2, 3])).toBe(false);
  });

  it('returns false for non-array', () => {
    expect(isMLevelData(null)).toBe(false);
    expect(isMLevelData(undefined)).toBe(false);
    expect(isMLevelData({})).toBe(false);
  });
});
