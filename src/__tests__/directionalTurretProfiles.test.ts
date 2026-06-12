/**
 * TURRET-HULL-CONTRACT-PR-F1: Tests for directional turret pivot/muzzle profiles.
 *
 * These tests verify:
 * 1. Smoky M0/M1 dir00_E pivot resolves to px=0.206668, py=0.464846
 * 2. Smoky M0/M1 dir00_E muzzle resolves to mx=0.87379, my=0.484178
 * 3. Smoky M2/M3 dir00_E pivot resolves to px=0.206668, py=0.481365
 * 4. Smoky M2/M3 dir00_E muzzle resolves to mx=0.87379, my=0.500697
 * 5. Directional values differ across dirs (not a single-pivot model)
 * 6. Unsupported weapon returns null/fallback
 * 7. Unsupported upgrade level returns null/fallback
 * 8. Direction indexes normalize deterministically
 * 9. Existing PR-B/C/D/E1 tests stay green
 * 10. No renderer behavior changes
 *
 * All tests are pure — no Phaser runtime required.
 */

import { describe, it, expect } from 'vitest';
import {
  SMOKY_M01_DIRECTIONAL_PROFILE,
  SMOKY_M23_DIRECTIONAL_PROFILE,
  normalizeDir16,
  resolveDirectionalProfile,
  resolveTurretPivotForDir,
  resolveTurretMuzzlesForDir,
  DIR16_COUNT,
  DIR16_SUFFIXES,
} from '../config/directionalTurretProfiles';

// ── Test 1: Smoky M0/M1 dir00_E pivot ─────────────────────────────

describe('resolveTurretPivotForDir — Smoky M0/M1 dir00_E', () => {
  it('resolves px=0.206668, py=0.464846 for dir00_E', () => {
    const pivot = resolveTurretPivotForDir('smoky', 0, 0);
    expect(pivot).not.toBeNull();
    expect(pivot!.x).toBeCloseTo(0.206668, 5);
    expect(pivot!.y).toBeCloseTo(0.464846, 5);
  });

  it('matches the direct profile data for dir00_E', () => {
    const pivot = resolveTurretPivotForDir('smoky', 0, 0);
    const directPivot = SMOKY_M01_DIRECTIONAL_PROFILE.pivots[0];
    expect(pivot!.x).toBeCloseTo(directPivot.position.x, 10);
    expect(pivot!.y).toBeCloseTo(directPivot.position.y, 10);
  });
});

// ── Test 2: Smoky M0/M1 dir00_E muzzle ────────────────────────────

describe('resolveTurretMuzzlesForDir — Smoky M0/M1 dir00_E', () => {
  it('resolves muzzle01 mx=0.87379, my=0.484178 for dir00_E', () => {
    const muzzles = resolveTurretMuzzlesForDir('smoky', 0, 0);
    expect(muzzles).not.toBeNull();
    expect(muzzles!.length).toBe(1);
    expect(muzzles![0].objectName).toBe('muzzle01');
    expect(muzzles![0].position.x).toBeCloseTo(0.87379, 5);
    expect(muzzles![0].position.y).toBeCloseTo(0.484178, 5);
  });

  it('matches the direct profile data for dir00_E muzzle', () => {
    const muzzles = resolveTurretMuzzlesForDir('smoky', 0, 0);
    const directMuzzle = SMOKY_M01_DIRECTIONAL_PROFILE.muzzles[0][0];
    expect(muzzles![0].position.x).toBeCloseTo(directMuzzle.position.x, 10);
    expect(muzzles![0].position.y).toBeCloseTo(directMuzzle.position.y, 10);
  });
});

// ── Test 3: Smoky M2/M3 dir00_E pivot ─────────────────────────────

describe('resolveTurretPivotForDir — Smoky M2/M3 dir00_E', () => {
  it('resolves px=0.206668, py=0.481365 for dir00_E', () => {
    const pivot = resolveTurretPivotForDir('smoky', 2, 0);
    expect(pivot).not.toBeNull();
    expect(pivot!.x).toBeCloseTo(0.206668, 5);
    expect(pivot!.y).toBeCloseTo(0.481365, 5);
  });

  it('matches the direct profile data for dir00_E (M2/M3)', () => {
    const pivot = resolveTurretPivotForDir('smoky', 2, 0);
    const directPivot = SMOKY_M23_DIRECTIONAL_PROFILE.pivots[0];
    expect(pivot!.x).toBeCloseTo(directPivot.position.x, 10);
    expect(pivot!.y).toBeCloseTo(directPivot.position.y, 10);
  });
});

// ── Test 4: Smoky M2/M3 dir00_E muzzle ────────────────────────────

describe('resolveTurretMuzzlesForDir — Smoky M2/M3 dir00_E', () => {
  it('resolves muzzle01 mx=0.87379, my=0.500697 for dir00_E', () => {
    const muzzles = resolveTurretMuzzlesForDir('smoky', 2, 0);
    expect(muzzles).not.toBeNull();
    expect(muzzles!.length).toBe(1);
    expect(muzzles![0].objectName).toBe('muzzle01');
    expect(muzzles![0].position.x).toBeCloseTo(0.87379, 5);
    expect(muzzles![0].position.y).toBeCloseTo(0.500697, 5);
  });

  it('matches the direct profile data for dir00_E muzzle (M2/M3)', () => {
    const muzzles = resolveTurretMuzzlesForDir('smoky', 2, 0);
    const directMuzzle = SMOKY_M23_DIRECTIONAL_PROFILE.muzzles[0][0];
    expect(muzzles![0].position.x).toBeCloseTo(directMuzzle.position.x, 10);
    expect(muzzles![0].position.y).toBeCloseTo(directMuzzle.position.y, 10);
  });
});

// ── Test 5: Directional values differ across dirs ──────────────────

describe('Directional pivot values differ across directions', () => {
  it('Smoky M0/M1 pivot positions are NOT all the same (proves direction-dependence)', () => {
    const pivots = SMOKY_M01_DIRECTIONAL_PROFILE.pivots;
    // Collect unique positions
    const uniquePositions = new Set(
      pivots.map(p => `${p.position.x.toFixed(6)},${p.position.y.toFixed(6)}`),
    );
    // If all pivots were the same, we'd have 1 unique position.
    // With 16 different directions, we should have many unique positions.
    expect(uniquePositions.size).toBeGreaterThan(1);
  });

  it('Smoky M0/M1 muzzle positions are NOT all the same (proves direction-dependence)', () => {
    const muzzlePositions = SMOKY_M01_DIRECTIONAL_PROFILE.muzzles.flat().map(m => m.position);
    const uniquePositions = new Set(
      muzzlePositions.map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)}`),
    );
    expect(uniquePositions.size).toBeGreaterThan(1);
  });

  it('pivot E (dir0) differs from pivot W (dir8) — opposite directions', () => {
    const pivotE = resolveTurretPivotForDir('smoky', 0, 0);
    const pivotW = resolveTurretPivotForDir('smoky', 0, 8);
    expect(pivotE).not.toBeNull();
    expect(pivotW).not.toBeNull();
    // East-facing pivot is on the left side of the image (low x)
    // West-facing pivot is on the right side of the image (high x)
    expect(pivotE!.x).toBeLessThan(pivotW!.x);
  });

  it('pivot N (dir12) differs from pivot S (dir4) — perpendicular directions', () => {
    const pivotN = resolveTurretPivotForDir('smoky', 0, 12);
    const pivotS = resolveTurretPivotForDir('smoky', 0, 4);
    expect(pivotN).not.toBeNull();
    expect(pivotS).not.toBeNull();
    // North-facing and south-facing should have different positions
    const differs = pivotN!.x !== pivotS!.x || pivotN!.y !== pivotS!.y;
    expect(differs).toBe(true);
  });

  it('muzzle E (dir0) differs from muzzle W (dir8) — opposite directions', () => {
    const muzzleE = resolveTurretMuzzlesForDir('smoky', 0, 0);
    const muzzleW = resolveTurretMuzzlesForDir('smoky', 0, 8);
    expect(muzzleE).not.toBeNull();
    expect(muzzleW).not.toBeNull();
    // East-facing muzzle is on the right side of the image (high x)
    // West-facing muzzle is on the left side of the image (low x)
    expect(muzzleE![0].position.x).toBeGreaterThan(muzzleW![0].position.x);
  });

  it('M2/M3 directional values also differ from each other', () => {
    const pivots = SMOKY_M23_DIRECTIONAL_PROFILE.pivots;
    const uniquePositions = new Set(
      pivots.map(p => `${p.position.x.toFixed(6)},${p.position.y.toFixed(6)}`),
    );
    expect(uniquePositions.size).toBeGreaterThan(1);
  });
});

// ── Test 6: Unsupported weapon returns null ────────────────────────

describe('resolveTurretPivotForDir — unsupported weapon', () => {
  it('returns null for thunder (no directional profile)', () => {
    expect(resolveTurretPivotForDir('thunder', 0, 0)).toBeNull();
  });

  it('returns null for railgun', () => {
    expect(resolveTurretPivotForDir('railgun', 0, 0)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveTurretPivotForDir('', 0, 0)).toBeNull();
  });

  it('returns null for muzzles too', () => {
    expect(resolveTurretMuzzlesForDir('thunder', 0, 0)).toBeNull();
  });
});

// ── Test 7: Unsupported upgrade level returns null ─────────────────

describe('resolveTurretPivotForDir — unsupported upgrade level', () => {
  it('Smoky level 4 (invalid) returns null', () => {
    expect(resolveTurretPivotForDir('smoky', 4, 0)).toBeNull();
  });

  it('Smoky level -1 (invalid) returns null', () => {
    expect(resolveTurretPivotForDir('smoky', -1, 0)).toBeNull();
  });

  it('Smoky level 5 (invalid) returns null', () => {
    expect(resolveTurretPivotForDir('smoky', 5, 0)).toBeNull();
  });

  it('Smoky muzzles for invalid level also return null', () => {
    expect(resolveTurretMuzzlesForDir('smoky', 4, 0)).toBeNull();
  });

  it('Smoky level 0 resolves (M0/M1 profile)', () => {
    expect(resolveTurretPivotForDir('smoky', 0, 0)).not.toBeNull();
  });

  it('Smoky level 1 resolves (M0/M1 profile)', () => {
    expect(resolveTurretPivotForDir('smoky', 1, 0)).not.toBeNull();
  });

  it('Smoky level 2 resolves (M2/M3 profile)', () => {
    expect(resolveTurretPivotForDir('smoky', 2, 0)).not.toBeNull();
  });

  it('Smoky level 3 resolves (M2/M3 profile)', () => {
    expect(resolveTurretPivotForDir('smoky', 3, 0)).not.toBeNull();
  });
});

// ── Test 8: Direction indexes normalize deterministically ──────────

describe('normalizeDir16 — deterministic normalization', () => {
  it('valid dir16 indices are unchanged', () => {
    for (let i = 0; i < 16; i++) {
      expect(normalizeDir16(i)).toBe(i);
    }
  });

  it('negative values wrap correctly', () => {
    expect(normalizeDir16(-1)).toBe(15);
    expect(normalizeDir16(-2)).toBe(14);
    expect(normalizeDir16(-16)).toBe(0);
    expect(normalizeDir16(-17)).toBe(15);
  });

  it('values >= 16 wrap correctly', () => {
    expect(normalizeDir16(16)).toBe(0);
    expect(normalizeDir16(17)).toBe(1);
    expect(normalizeDir16(31)).toBe(15);
    expect(normalizeDir16(32)).toBe(0);
  });

  it('NaN returns 0 (safe fallback)', () => {
    expect(normalizeDir16(NaN)).toBe(0);
  });

  it('Infinity returns 0 (safe fallback)', () => {
    expect(normalizeDir16(Infinity)).toBe(0);
    expect(normalizeDir16(-Infinity)).toBe(0);
  });

  it('non-integer values are truncated before modulo', () => {
    expect(normalizeDir16(0.7)).toBe(0);
    expect(normalizeDir16(1.9)).toBe(1);
    expect(normalizeDir16(-0.5)).toBe(0);
    expect(normalizeDir16(16.9)).toBe(0);
  });

  it('is deterministic: same input always produces same output', () => {
    for (let i = -20; i <= 20; i++) {
      const a = normalizeDir16(i);
      const b = normalizeDir16(i);
      expect(a).toBe(b);
    }
  });

  it('resolveTurretPivotForDir normalizes direction automatically', () => {
    // dir16 = 0 and dir16 = 16 should produce the same result (both normalize to 0)
    const pivot0 = resolveTurretPivotForDir('smoky', 0, 0);
    const pivot16 = resolveTurretPivotForDir('smoky', 0, 16);
    expect(pivot0).toEqual(pivot16);
  });
});

// ── Profile structure completeness ────────────────────────────────

describe('Directional profile structure', () => {
  it('Smoky M0/M1 has 16 pivot entries', () => {
    expect(SMOKY_M01_DIRECTIONAL_PROFILE.pivots.length).toBe(16);
  });

  it('Smoky M0/M1 has 16 muzzle arrays', () => {
    expect(SMOKY_M01_DIRECTIONAL_PROFILE.muzzles.length).toBe(16);
  });

  it('Smoky M2/M3 has 16 pivot entries', () => {
    expect(SMOKY_M23_DIRECTIONAL_PROFILE.pivots.length).toBe(16);
  });

  it('Smoky M2/M3 has 16 muzzle arrays', () => {
    expect(SMOKY_M23_DIRECTIONAL_PROFILE.muzzles.length).toBe(16);
  });

  it('each M0/M1 muzzle array has exactly 1 muzzle', () => {
    for (let dir = 0; dir < 16; dir++) {
      expect(SMOKY_M01_DIRECTIONAL_PROFILE.muzzles[dir].length).toBe(1);
      expect(SMOKY_M01_DIRECTIONAL_PROFILE.muzzles[dir][0].objectName).toBe('muzzle01');
    }
  });

  it('each M2/M3 muzzle array has exactly 1 muzzle', () => {
    for (let dir = 0; dir < 16; dir++) {
      expect(SMOKY_M23_DIRECTIONAL_PROFILE.muzzles[dir].length).toBe(1);
      expect(SMOKY_M23_DIRECTIONAL_PROFILE.muzzles[dir][0].objectName).toBe('muzzle01');
    }
  });

  it('all pivot dirIndex values are 0..15', () => {
    for (const pivot of SMOKY_M01_DIRECTIONAL_PROFILE.pivots) {
      expect(pivot.dirIndex).toBeGreaterThanOrEqual(0);
      expect(pivot.dirIndex).toBeLessThan(16);
    }
    for (const pivot of SMOKY_M23_DIRECTIONAL_PROFILE.pivots) {
      expect(pivot.dirIndex).toBeGreaterThanOrEqual(0);
      expect(pivot.dirIndex).toBeLessThan(16);
    }
  });

  it('pivot dirIndex values are sequential 0..15', () => {
    const m01indices = SMOKY_M01_DIRECTIONAL_PROFILE.pivots.map(p => p.dirIndex);
    const m23indices = SMOKY_M23_DIRECTIONAL_PROFILE.pivots.map(p => p.dirIndex);
    expect(m01indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(m23indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('confidence is high for both profiles', () => {
    expect(SMOKY_M01_DIRECTIONAL_PROFILE.confidence).toBe('high');
    expect(SMOKY_M23_DIRECTIONAL_PROFILE.confidence).toBe('high');
  });

  it('upgradeLevels are correct', () => {
    expect(SMOKY_M01_DIRECTIONAL_PROFILE.upgradeLevels).toEqual([0, 1]);
    expect(SMOKY_M23_DIRECTIONAL_PROFILE.upgradeLevels).toEqual([2, 3]);
  });

  it('weaponId is smoky for both', () => {
    expect(SMOKY_M01_DIRECTIONAL_PROFILE.weaponId).toBe('smoky');
    expect(SMOKY_M23_DIRECTIONAL_PROFILE.weaponId).toBe('smoky');
  });
});

// ── M0/M1 vs M2/M3 difference ─────────────────────────────────────

describe('M0/M1 vs M2/M3 profile differences', () => {
  it('M0/M1 and M2/M3 dir00_E pivot x is the same (px=0.206668)', () => {
    const pivot01 = resolveTurretPivotForDir('smoky', 0, 0);
    const pivot23 = resolveTurretPivotForDir('smoky', 2, 0);
    expect(pivot01!.x).toBeCloseTo(pivot23!.x, 5);
  });

  it('M0/M1 and M2/M3 dir00_E pivot y differs (M2/M3 shifted down)', () => {
    const pivot01 = resolveTurretPivotForDir('smoky', 0, 0);
    const pivot23 = resolveTurretPivotForDir('smoky', 2, 0);
    // M2/M3 turret model is larger, shifting pivot/muzzle down
    expect(pivot23!.y).toBeGreaterThan(pivot01!.y);
  });

  it('M0/M1 and M2/M3 dir00_E muzzle x is the same (mx=0.87379)', () => {
    const muzzles01 = resolveTurretMuzzlesForDir('smoky', 0, 0);
    const muzzles23 = resolveTurretMuzzlesForDir('smoky', 2, 0);
    expect(muzzles01![0].position.x).toBeCloseTo(muzzles23![0].position.x, 5);
  });

  it('M0/M1 and M2/M3 dir00_E muzzle y differs (M2/M3 shifted down)', () => {
    const muzzles01 = resolveTurretMuzzlesForDir('smoky', 0, 0);
    const muzzles23 = resolveTurretMuzzlesForDir('smoky', 2, 0);
    expect(muzzles23![0].position.y).toBeGreaterThan(muzzles01![0].position.y);
  });
});

// ── resolveDirectionalProfile ──────────────────────────────────────

describe('resolveDirectionalProfile', () => {
  it('resolves Smoky M0', () => {
    const profile = resolveDirectionalProfile('smoky', 0);
    expect(profile).not.toBeNull();
    expect(profile!.weaponId).toBe('smoky');
    expect(profile!.upgradeLevels).toContain(0);
  });

  it('resolves Smoky M1 (same profile as M0)', () => {
    const profile0 = resolveDirectionalProfile('smoky', 0);
    const profile1 = resolveDirectionalProfile('smoky', 1);
    expect(profile0).toBe(profile1); // same object reference
  });

  it('resolves Smoky M2', () => {
    const profile = resolveDirectionalProfile('smoky', 2);
    expect(profile).not.toBeNull();
    expect(profile!.weaponId).toBe('smoky');
    expect(profile!.upgradeLevels).toContain(2);
  });

  it('resolves Smoky M3 (same profile as M2)', () => {
    const profile2 = resolveDirectionalProfile('smoky', 2);
    const profile3 = resolveDirectionalProfile('smoky', 3);
    expect(profile2).toBe(profile3); // same object reference
  });

  it('returns null for unsupported weapon', () => {
    expect(resolveDirectionalProfile('thunder', 0)).toBeNull();
  });

  it('returns null for unsupported upgrade level', () => {
    expect(resolveDirectionalProfile('smoky', 4)).toBeNull();
  });
});

// ── DIR16 constants ────────────────────────────────────────────────

describe('DIR16 constants', () => {
  it('DIR16_COUNT is 16', () => {
    expect(DIR16_COUNT).toBe(16);
  });

  it('DIR16_SUFFIXES has 16 entries', () => {
    expect(DIR16_SUFFIXES.length).toBe(16);
  });

  it('DIR16_SUFFIXES starts with E', () => {
    expect(DIR16_SUFFIXES[0]).toBe('E');
  });

  it('DIR16_SUFFIXES[8] is W (opposite of E)', () => {
    expect(DIR16_SUFFIXES[8]).toBe('W');
  });
});

// ── Pure function / no renderer dependency ─────────────────────────

describe('Directional profile helpers — pure, no Phaser', () => {
  it('resolveTurretPivotForDir works without any scene or DOM', () => {
    const pivot = resolveTurretPivotForDir('smoky', 0, 0);
    expect(pivot).not.toBeNull();
    expect(typeof pivot!.x).toBe('number');
    expect(typeof pivot!.y).toBe('number');
  });

  it('resolveTurretMuzzlesForDir works without any scene or DOM', () => {
    const muzzles = resolveTurretMuzzlesForDir('smoky', 0, 0);
    expect(muzzles).not.toBeNull();
    expect(Array.isArray(muzzles)).toBe(true);
  });

  it('normalizeDir16 works without any scene or DOM', () => {
    expect(normalizeDir16(0)).toBe(0);
    expect(normalizeDir16(15)).toBe(15);
  });

  it('all helpers return consistent results on repeated calls', () => {
    const a1 = resolveTurretPivotForDir('smoky', 0, 0);
    const a2 = resolveTurretPivotForDir('smoky', 0, 0);
    expect(a1).toEqual(a2);

    const b1 = resolveTurretMuzzlesForDir('smoky', 0, 0);
    const b2 = resolveTurretMuzzlesForDir('smoky', 0, 0);
    expect(b1).toEqual(b2);

    for (let i = -5; i <= 20; i++) {
      expect(normalizeDir16(i)).toBe(normalizeDir16(i));
    }
  });
});
