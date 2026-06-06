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
  type GeneratedHullDir16Index,
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
