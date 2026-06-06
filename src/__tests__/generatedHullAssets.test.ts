/**
 * Tests for generated hull asset module.
 *
 * HULL-ASSET-01: Path builders, key uniqueness, and direction mapping.
 */

import { describe, it, expect } from 'vitest';
import {
  GENERATED_HULL_IDS,
  GENERATED_HULL_FACTIONS,
  GENERATED_HULL_MODS,
  GENERATED_HULL_DIRECTIONS_16,
  getGeneratedHullTextureKey,
  getGeneratedHullAssetPath,
  mapRuntimeDir8ToGeneratedDir16,
  DEFAULT_GENERATED_HULL,
  DEFAULT_GENERATED_HULL_MOD,
  resolveGeneratedHullFaction,
  bodyAngleToDir8,
  modificationLevelToMod,
  bodyIdToGeneratedHullId,
  type GeneratedHullDir16Index,
  getGeneratedHullVisualProfile,
  GENERATED_HULL_VISUAL_PROFILES,
  DEFAULT_GENERATED_HULL_VISUAL_PROFILE,
  GENERATED_HULL_SCALE,
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
} from '../assets/generatedHullAssets';

// ─── Path builder tests ──────────────────────────────────────────

describe('getGeneratedHullAssetPath', () => {
  it('builds correct path for wasp/cyan/m0 dir00', () => {
    const path = getGeneratedHullAssetPath('wasp', 'cyan', 'm0', 0);
    expect(path).toBe(
      'assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_hull_dir00_E.png',
    );
  });

  it('builds correct path for dictator/purple/m3 dir15', () => {
    const path = getGeneratedHullAssetPath('dictator', 'purple', 'm3', 15);
    expect(path).toBe(
      'assets/units/hulls/dictator/purple/m3/dictator_purple_m3_hull_dir15_ENE.png',
    );
  });

  it('pads single-digit direction indices with leading zero', () => {
    const path = getGeneratedHullAssetPath('hornet', 'green', 'm1', 4);
    expect(path).toContain('dir04_S');
  });

  it('does not pad double-digit direction indices', () => {
    const path = getGeneratedHullAssetPath('viking', 'yellow', 'm2', 12);
    expect(path).toContain('dir12_N');
  });

  it('includes hull, faction, and mod in path segments', () => {
    const path = getGeneratedHullAssetPath('titan', 'yellow', 'm2', 8);
    expect(path).toContain('titan/yellow/m2');
    expect(path).toContain('titan_yellow_m2_hull');
  });
});

// ─── Texture key builder tests ───────────────────────────────────

describe('getGeneratedHullTextureKey', () => {
  it('builds correct key for wasp/cyan/m0 dir00', () => {
    const key = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(key).toBe('generated_hull_wasp_cyan_m0_dir00');
  });

  it('builds correct key for dictator/purple/m3 dir15', () => {
    const key = getGeneratedHullTextureKey('dictator', 'purple', 'm3', 15);
    expect(key).toBe('generated_hull_dictator_purple_m3_dir15');
  });

  it('uses generated_hull_ prefix to avoid collision with legacy keys', () => {
    const key = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(key.startsWith('generated_hull_')).toBe(true);
    // Legacy key format is: wasp_m0_hull_cyan_dir0
    expect(key).not.toBe('wasp_m0_hull_cyan_dir0');
  });
});

describe('getGeneratedHullTextureKey uniqueness', () => {
  it('produces unique keys for all 1792 virtual combinations', () => {
    const keys = new Set<string>();

    for (const hull of GENERATED_HULL_IDS) {
      for (const faction of GENERATED_HULL_FACTIONS) {
        for (const mod of GENERATED_HULL_MODS) {
          for (const dir of GENERATED_HULL_DIRECTIONS_16) {
            const key = getGeneratedHullTextureKey(
              hull,
              faction,
              mod,
              dir.index as GeneratedHullDir16Index,
            );
            keys.add(key);
          }
        }
      }
    }

    // 7 hulls × 4 factions × 4 mods × 16 directions = 1792
    expect(keys.size).toBe(7 * 4 * 4 * 16);
    expect(keys.size).toBe(1792);
  });

  it('produces different keys for different directions of same hull/faction/mod', () => {
    const keys = new Set<string>();
    for (const dir of GENERATED_HULL_DIRECTIONS_16) {
      keys.add(getGeneratedHullTextureKey('wasp', 'cyan', 'm0', dir.index as GeneratedHullDir16Index));
    }
    expect(keys.size).toBe(16);
  });
});

// ─── Direction mapping tests ────────────────────────────────────

describe('mapRuntimeDir8ToGeneratedDir16', () => {
  it('maps 8-dir to even 16-dir indices', () => {
    const expected: number[] = [0, 2, 4, 6, 8, 10, 12, 14];
    const actual = Array.from({ length: 8 }, (_, i) => mapRuntimeDir8ToGeneratedDir16(i));
    expect(actual).toEqual(expected);
  });

  it('maps 0 (E) → 0 (E)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(0)).toBe(0);
  });

  it('maps 1 (SE) → 2 (SE)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(1)).toBe(2);
  });

  it('maps 2 (S) → 4 (S)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(2)).toBe(4);
  });

  it('maps 3 (SW) → 6 (SW)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(3)).toBe(6);
  });

  it('maps 4 (W) → 8 (W)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(4)).toBe(8);
  });

  it('maps 5 (NW) → 10 (NW)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(5)).toBe(10);
  });

  it('maps 6 (N) → 12 (N)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(6)).toBe(12);
  });

  it('maps 7 (NE) → 14 (NE)', () => {
    expect(mapRuntimeDir8ToGeneratedDir16(7)).toBe(14);
  });

  it('never produces odd indices for valid 8-dir input', () => {
    for (let i = 0; i < 8; i++) {
      expect(mapRuntimeDir8ToGeneratedDir16(i) % 2).toBe(0);
    }
  });
});

// ─── Default config tests ────────────────────────────────────────

describe('default hull config', () => {
  it('defaults hull to wasp', () => {
    expect(DEFAULT_GENERATED_HULL).toBe('wasp');
  });

  it('defaults mod to m0', () => {
    expect(DEFAULT_GENERATED_HULL_MOD).toBe('m0');
  });
});

// ─── Faction resolution tests ────────────────────────────────────

describe('resolveGeneratedHullFaction', () => {
  it('returns a valid faction for each known Faction value', () => {
    expect(resolveGeneratedHullFaction('cyan')).toBe('cyan');
    expect(resolveGeneratedHullFaction('green')).toBe('green');
    expect(resolveGeneratedHullFaction('yellow')).toBe('yellow');
    expect(resolveGeneratedHullFaction('purple')).toBe('purple');
  });

  it('falls back to cyan for undefined', () => {
    expect(resolveGeneratedHullFaction(undefined)).toBe('cyan');
  });
});

// ─── Constants consistency tests ─────────────────────────────────

describe('generated hull constants', () => {
  it('has exactly 7 hull IDs', () => {
    expect(GENERATED_HULL_IDS.length).toBe(7);
  });

  it('has exactly 4 factions', () => {
    expect(GENERATED_HULL_FACTIONS.length).toBe(4);
  });

  it('has exactly 4 mods', () => {
    expect(GENERATED_HULL_MODS.length).toBe(4);
  });

  it('has exactly 16 directions', () => {
    expect(GENERATED_HULL_DIRECTIONS_16.length).toBe(16);
  });

  it('direction indices are sequential 0–15', () => {
    const indices = GENERATED_HULL_DIRECTIONS_16.map((d: { index: number }) => d.index);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('total matrix size is 1792', () => {
    expect(GENERATED_HULL_IDS.length * GENERATED_HULL_FACTIONS.length * GENERATED_HULL_MODS.length * GENERATED_HULL_DIRECTIONS_16.length).toBe(1792);
  });
});

// ─── Body angle to dir8 tests ────────────────────────────────────

describe('bodyAngleToDir8', () => {
  it('returns 0 (E) for angle 0', () => {
    expect(bodyAngleToDir8(0)).toBe(0);
  });

  it('returns 1 (SE) for angle PI/4', () => {
    expect(bodyAngleToDir8(Math.PI / 4)).toBe(1);
  });

  it('returns 2 (S) for angle PI/2', () => {
    expect(bodyAngleToDir8(Math.PI / 2)).toBe(2);
  });

  it('returns 3 (SW) for angle 3*PI/4', () => {
    expect(bodyAngleToDir8(3 * Math.PI / 4)).toBe(3);
  });

  it('returns 4 (W) for angle PI', () => {
    expect(bodyAngleToDir8(Math.PI)).toBe(4);
  });

  it('returns 5 (NW) for angle -3*PI/4', () => {
    expect(bodyAngleToDir8(-3 * Math.PI / 4)).toBe(5);
  });

  it('returns 6 (N) for angle -PI/2', () => {
    expect(bodyAngleToDir8(-Math.PI / 2)).toBe(6);
  });

  it('returns 7 (NE) for angle -PI/4', () => {
    expect(bodyAngleToDir8(-Math.PI / 4)).toBe(7);
  });

  it('returns 4 (W) for angle -PI (same as PI)', () => {
    expect(bodyAngleToDir8(-Math.PI)).toBe(4);
  });

  it('handles angles beyond 2*PI by wrapping', () => {
    expect(bodyAngleToDir8(2 * Math.PI)).toBe(0); // Same as 0
    expect(bodyAngleToDir8(2 * Math.PI + Math.PI / 4)).toBe(1); // Same as PI/4
  });

  it('handles angles below -2*PI by wrapping', () => {
    expect(bodyAngleToDir8(-2 * Math.PI)).toBe(0); // Same as 0
  });

  it('always returns 0-7 for any angle', () => {
    for (let a = -4 * Math.PI; a <= 4 * Math.PI; a += 0.3) {
      const dir = bodyAngleToDir8(a);
      expect(dir).toBeGreaterThanOrEqual(0);
      expect(dir).toBeLessThanOrEqual(7);
    }
  });
});

// ─── Modification level to mod tests ─────────────────────────────

describe('modificationLevelToMod', () => {
  it('maps 0 → m0', () => {
    expect(modificationLevelToMod(0)).toBe('m0');
  });

  it('maps 1 → m1', () => {
    expect(modificationLevelToMod(1)).toBe('m1');
  });

  it('maps 2 → m2', () => {
    expect(modificationLevelToMod(2)).toBe('m2');
  });

  it('maps 3 → m3', () => {
    expect(modificationLevelToMod(3)).toBe('m3');
  });

  it('clamps negative to m0', () => {
    expect(modificationLevelToMod(-1)).toBe('m0');
  });

  it('clamps >3 to m3', () => {
    expect(modificationLevelToMod(5)).toBe('m3');
  });

  it('rounds fractional values', () => {
    expect(modificationLevelToMod(0.7)).toBe('m1');
    expect(modificationLevelToMod(2.4)).toBe('m2');
  });
});

// ─── BodyId to GeneratedHullId tests ─────────────────────────────

describe('bodyIdToGeneratedHullId', () => {
  it('returns valid hull ID for all 7 hulls', () => {
    expect(bodyIdToGeneratedHullId('wasp')).toBe('wasp');
    expect(bodyIdToGeneratedHullId('hornet')).toBe('hornet');
    expect(bodyIdToGeneratedHullId('hunter')).toBe('hunter');
    expect(bodyIdToGeneratedHullId('viking')).toBe('viking');
    expect(bodyIdToGeneratedHullId('titan')).toBe('titan');
    expect(bodyIdToGeneratedHullId('mammoth')).toBe('mammoth');
    expect(bodyIdToGeneratedHullId('dictator')).toBe('dictator');
  });

  it('returns null for unknown bodyId', () => {
    expect(bodyIdToGeneratedHullId('unknown')).toBeNull();
    expect(bodyIdToGeneratedHullId('')).toBeNull();
  });
});

// ─── Visual profile tests (HULL-VISUAL-FIXUP-02) ──────────────────

describe('getGeneratedHullVisualProfile', () => {
  it('returns a profile for all 7 known hulls', () => {
    for (const hull of GENERATED_HULL_IDS) {
      const profile = getGeneratedHullVisualProfile(hull);
      expect(profile).toBeDefined();
      expect(profile.scale).toBeGreaterThan(0);
      expect(profile.originX).toBeGreaterThan(0);
      expect(profile.originY).toBeGreaterThan(0);
    }
  });

  it('returns the default profile for unknown hull ID via fallback', () => {
    // The function signature takes GeneratedHullId, but test the fallback
    // behavior by checking the DEFAULT_GENERATED_HULL_VISUAL_PROFILE directly
    expect(DEFAULT_GENERATED_HULL_VISUAL_PROFILE.scale).toBe(GENERATED_HULL_SCALE);
    expect(DEFAULT_GENERATED_HULL_VISUAL_PROFILE.originX).toBe(GENERATED_HULL_ORIGIN_X);
    expect(DEFAULT_GENERATED_HULL_VISUAL_PROFILE.originY).toBe(GENERATED_HULL_ORIGIN_Y);
    expect(DEFAULT_GENERATED_HULL_VISUAL_PROFILE.offsetX).toBe(0);
    expect(DEFAULT_GENERATED_HULL_VISUAL_PROFILE.offsetY).toBe(0);
    expect(DEFAULT_GENERATED_HULL_VISUAL_PROFILE.uiOffsetY).toBe(0);
  });
});

describe('GENERATED_HULL_VISUAL_PROFILES', () => {
  it('has an entry for every GeneratedHullId', () => {
    for (const hull of GENERATED_HULL_IDS) {
      expect(GENERATED_HULL_VISUAL_PROFILES[hull]).toBeDefined();
    }
  });

  it('has exactly 7 profile entries', () => {
    expect(Object.keys(GENERATED_HULL_VISUAL_PROFILES).length).toBe(7);
  });

  it('all profiles have sane scale values (>0.05 and <1)', () => {
    for (const hull of GENERATED_HULL_IDS) {
      const profile = GENERATED_HULL_VISUAL_PROFILES[hull];
      expect(profile.scale).toBeGreaterThan(0.05);
      expect(profile.scale).toBeLessThan(1);
    }
  });

  it('all profiles have sane originX values (0..1)', () => {
    for (const hull of GENERATED_HULL_IDS) {
      const profile = GENERATED_HULL_VISUAL_PROFILES[hull];
      expect(profile.originX).toBeGreaterThan(0);
      expect(profile.originX).toBeLessThanOrEqual(1);
    }
  });

  it('all profiles have sane originY values (0..1)', () => {
    for (const hull of GENERATED_HULL_IDS) {
      const profile = GENERATED_HULL_VISUAL_PROFILES[hull];
      expect(profile.originY).toBeGreaterThan(0);
      expect(profile.originY).toBeLessThanOrEqual(1);
    }
  });

  it('all offset and uiOffset values are finite', () => {
    for (const hull of GENERATED_HULL_IDS) {
      const profile = GENERATED_HULL_VISUAL_PROFILES[hull];
      expect(Number.isFinite(profile.offsetX)).toBe(true);
      expect(Number.isFinite(profile.offsetY)).toBe(true);
      expect(Number.isFinite(profile.uiOffsetY)).toBe(true);
    }
  });

  it('larger hulls have larger scale than smaller hulls', () => {
    // Wasp (small_fast) should have smaller scale than Mammoth (super_heavy)
    const waspScale = GENERATED_HULL_VISUAL_PROFILES.wasp.scale;
    const mammothScale = GENERATED_HULL_VISUAL_PROFILES.mammoth.scale;
    expect(mammothScale).toBeGreaterThan(waspScale);
  });

  it('larger hulls have larger uiOffsetY than smaller hulls', () => {
    const waspUi = GENERATED_HULL_VISUAL_PROFILES.wasp.uiOffsetY;
    const mammothUi = GENERATED_HULL_VISUAL_PROFILES.mammoth.uiOffsetY;
    expect(mammothUi).toBeGreaterThan(waspUi);
  });
});
