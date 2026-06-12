/**
 * TURRET-HULL-CONTRACT-PR-C: Tests for the pure direction remap module.
 *
 * These tests verify:
 * 1. remapVisualDir + WASP_HULL_DIRECTION_REMAP_PROFILE reproduces every
 *    row of WASP_HULL_VISUAL_DIR16_REMAP
 * 2. applyHullVisualDir16Remap('wasp', dir16) equals the profile helper
 *    result for all 16 dirs
 * 3. applyHullVisualDir16Remap('hornet', dir16) remains identity
 * 4. No Phaser/runtime state is needed for the direction helper
 * 5. remapVisualDir is deterministic and handles edge cases
 * 6. WASP_HULL_DIRECTION_REMAP_PROFILE constants match expected values
 */

import { describe, it, expect } from 'vitest';
import {
  remapVisualDir,
  WASP_HULL_DIRECTION_REMAP_PROFILE,
  type DirectionRemapProfile,
} from '../config/visualDirectionRemap';
import {
  WASP_HULL_VISUAL_DIR16_REMAP,
  applyHullVisualDir16Remap,
} from '../assets/generatedHullAssets';
import type { GeneratedHullDir16Index } from '../assets/generatedHullAssets';

// ── Profile helper parity with existing table ───────────────────────

describe('remapVisualDir + WASP_HULL_DIRECTION_REMAP_PROFILE — parity with WASP_HULL_VISUAL_DIR16_REMAP', () => {
  it('reproduces every row of WASP_HULL_VISUAL_DIR16_REMAP', () => {
    for (let logical = 0; logical < 16; logical++) {
      const expected = WASP_HULL_VISUAL_DIR16_REMAP[logical];
      const actual = remapVisualDir(logical, WASP_HULL_DIRECTION_REMAP_PROFILE);
      expect(actual).toBe(expected);
    }
  });
});

// ── applyHullVisualDir16Remap parity with profile helper ────────────

describe('applyHullVisualDir16Remap — Wasp output matches profile helper', () => {
  it('returns the same value as remapVisualDir + WASP_HULL_DIRECTION_REMAP_PROFILE for all 16 dirs', () => {
    for (let dir16 = 0; dir16 < 16; dir16++) {
      const fromProfile = remapVisualDir(dir16, WASP_HULL_DIRECTION_REMAP_PROFILE);
      const fromFunction = applyHullVisualDir16Remap('wasp', dir16 as GeneratedHullDir16Index);
      expect(fromFunction).toBe(fromProfile);
    }
  });
});

// ── Non-Wasp hull identity ──────────────────────────────────────────

describe('applyHullVisualDir16Remap — non-Wasp hulls remain identity', () => {
  it('Hornet returns input dir16 unchanged for all 16 dirs', () => {
    for (let dir16 = 0; dir16 < 16; dir16++) {
      expect(applyHullVisualDir16Remap('hornet', dir16 as GeneratedHullDir16Index)).toBe(dir16);
    }
  });

  it('Titan returns input dir16 unchanged', () => {
    expect(applyHullVisualDir16Remap('titan', 0)).toBe(0);
    expect(applyHullVisualDir16Remap('titan', 8)).toBe(8);
  });

  it('Dictator returns input dir16 unchanged', () => {
    expect(applyHullVisualDir16Remap('dictator', 4)).toBe(4);
    expect(applyHullVisualDir16Remap('dictator', 12)).toBe(12);
  });
});

// ── No Phaser/runtime state needed ──────────────────────────────────

describe('remapVisualDir — no Phaser or runtime state required', () => {
  it('works with no imports from Phaser', () => {
    // remapVisualDir is a pure function; calling it does not require
    // any Phaser scene, texture manager, or DOM state.
    const result = remapVisualDir(0, WASP_HULL_DIRECTION_REMAP_PROFILE);
    expect(result).toBe(4);
  });

  it('WASP_HULL_DIRECTION_REMAP_PROFILE is plain static data', () => {
    expect(WASP_HULL_DIRECTION_REMAP_PROFILE.dirCount).toBe(16);
    expect(WASP_HULL_DIRECTION_REMAP_PROFILE.facingOffset).toBe(4);
    // Profile is frozen at import — just verify it is a plain object
    expect(typeof WASP_HULL_DIRECTION_REMAP_PROFILE).toBe('object');
  });
});

// ── remapVisualDir determinism and edge cases ───────────────────────

describe('remapVisualDir — determinism', () => {
  it('returns the same result for the same inputs', () => {
    for (let dir = 0; dir < 16; dir++) {
      const a = remapVisualDir(dir, WASP_HULL_DIRECTION_REMAP_PROFILE);
      const b = remapVisualDir(dir, WASP_HULL_DIRECTION_REMAP_PROFILE);
      expect(a).toBe(b);
    }
  });

  it('handles negative facingOffset correctly', () => {
    const profile: DirectionRemapProfile = { dirCount: 8, facingOffset: -2 };
    expect(remapVisualDir(0, profile)).toBe(6);
    expect(remapVisualDir(2, profile)).toBe(0);
  });

  it('handles zero facingOffset (identity)', () => {
    const identity: DirectionRemapProfile = { dirCount: 16, facingOffset: 0 };
    for (let dir = 0; dir < 16; dir++) {
      expect(remapVisualDir(dir, identity)).toBe(dir);
    }
  });

  it('handles facingOffset equal to dirCount (no-op)', () => {
    const profile: DirectionRemapProfile = { dirCount: 8, facingOffset: 8 };
    for (let dir = 0; dir < 8; dir++) {
      expect(remapVisualDir(dir, profile)).toBe(dir);
    }
  });
});

// ── WASP_HULL_DIRECTION_REMAP_PROFILE constants ─────────────────────

describe('WASP_HULL_DIRECTION_REMAP_PROFILE — constants', () => {
  it('has dirCount 16', () => {
    expect(WASP_HULL_DIRECTION_REMAP_PROFILE.dirCount).toBe(16);
  });

  it('has facingOffset 4', () => {
    expect(WASP_HULL_DIRECTION_REMAP_PROFILE.facingOffset).toBe(4);
  });
});
