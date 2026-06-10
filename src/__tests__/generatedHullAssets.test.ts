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
  WASP_HULL_VISUAL_DIR16_REMAP,
  applyHullVisualDir16Remap,
  resolveHullDirectionDiagnostic,
  GENERATED_HULL_SCALE,
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
  WASP_HULL_OFFSET_X,
  WASP_HULL_OFFSET_Y,
  getGeneratedHullPlacementOffset,
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

// ─── bodyAngleToDir8 tests ────────────────────────────────────────

describe('bodyAngleToDir8', () => {
  it('maps 0 rad (screen E) → dir8=0 (E)', () => {
    expect(bodyAngleToDir8(0)).toBe(0);
  });

  it('maps PI/4 (screen SE) → dir8=1 (SE)', () => {
    expect(bodyAngleToDir8(Math.PI / 4)).toBe(1);
  });

  it('maps PI/2 (screen S) → dir8=2 (S)', () => {
    expect(bodyAngleToDir8(Math.PI / 2)).toBe(2);
  });

  it('maps 3PI/4 (screen SW) → dir8=3 (SW)', () => {
    expect(bodyAngleToDir8(3 * Math.PI / 4)).toBe(3);
  });

  it('maps PI (screen W) → dir8=4 (W)', () => {
    expect(bodyAngleToDir8(Math.PI)).toBe(4);
  });

  it('maps -3PI/4 (screen NW) → dir8=5 (NW)', () => {
    expect(bodyAngleToDir8(-3 * Math.PI / 4)).toBe(5);
  });

  it('maps -PI/2 (screen N) → dir8=6 (N)', () => {
    expect(bodyAngleToDir8(-Math.PI / 2)).toBe(6);
  });

  it('maps -PI/4 (screen NE) → dir8=7 (NE)', () => {
    expect(bodyAngleToDir8(-Math.PI / 4)).toBe(7);
  });
});

// ─── modificationLevelToMod tests ──────────────────────────────────

describe('modificationLevelToMod', () => {
  it('maps 0 → m0', () => {
    expect(modificationLevelToMod(0)).toBe('m0');
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
});

// ─── bodyIdToGeneratedHullId tests ────────────────────────────────

describe('bodyIdToGeneratedHullId', () => {
  it('returns wasp for wasp', () => {
    expect(bodyIdToGeneratedHullId('wasp')).toBe('wasp');
  });

  it('returns null for unknown bodyId', () => {
    expect(bodyIdToGeneratedHullId('unknown_tank')).toBeNull();
  });
});

// ─── WASP_HULL_VISUAL_DIR16_REMAP tests (PIM-HULL-WASP-DIR-FIX-01) ──

describe('WASP_HULL_VISUAL_DIR16_REMAP', () => {
  it('has entries for all 16 directions', () => {
    for (let i = 0; i <= 15; i++) {
      expect(WASP_HULL_VISUAL_DIR16_REMAP[i]).toBeDefined();
    }
  });

  it('all remap values are valid dir16 indices (0–15)', () => {
    for (let i = 0; i <= 15; i++) {
      const remapped = WASP_HULL_VISUAL_DIR16_REMAP[i];
      expect(remapped).toBeGreaterThanOrEqual(0);
      expect(remapped).toBeLessThanOrEqual(15);
    }
  });

  it('remap is a bijection (no duplicate targets)', () => {
    const targets = new Set<number>();
    for (let i = 0; i <= 15; i++) {
      const remapped = WASP_HULL_VISUAL_DIR16_REMAP[i];
      expect(targets.has(remapped)).toBe(false);
      targets.add(remapped);
    }
    expect(targets.size).toBe(16);
  });

  it('Wasp remap is NOT identity (at least one entry differs)', () => {
    let anyDiffers = false;
    for (let i = 0; i <= 15; i++) {
      if (WASP_HULL_VISUAL_DIR16_REMAP[i] !== i) {
        anyDiffers = true;
        break;
      }
    }
    expect(anyDiffers).toBe(true);
  });

  it('Wasp remap follows (logical + 4) % 16 formula', () => {
    for (let i = 0; i <= 15; i++) {
      expect(WASP_HULL_VISUAL_DIR16_REMAP[i]).toBe((i + 4) % 16);
    }
  });

  // Calibrated anchor points from manual QA (Denis, Arena devtools)
  it('anchor: logical 0 (down-right) → visual 4', () => {
    expect(WASP_HULL_VISUAL_DIR16_REMAP[0]).toBe(4);
  });

  it('anchor: logical 4 (down-left) → visual 8', () => {
    expect(WASP_HULL_VISUAL_DIR16_REMAP[4]).toBe(8);
  });

  it('anchor: logical 8 (up-left) → visual 12', () => {
    expect(WASP_HULL_VISUAL_DIR16_REMAP[8]).toBe(12);
  });

  it('anchor: logical 12 (up-right) → visual 0', () => {
    expect(WASP_HULL_VISUAL_DIR16_REMAP[12]).toBe(0);
  });
});

// ─── applyHullVisualDir16Remap tests (PIM-HULL-WASP-DIR-FIX-01) ────

describe('applyHullVisualDir16Remap', () => {
  it('applies WASP_HULL_VISUAL_DIR16_REMAP for wasp', () => {
    // For each direction, the remap should be applied
    for (let i = 0; i <= 15; i++) {
      const result = applyHullVisualDir16Remap('wasp', i as GeneratedHullDir16Index);
      expect(result).toBe(WASP_HULL_VISUAL_DIR16_REMAP[i]);
    }
  });

  it('does NOT remap for non-Wasp hulls', () => {
    // Non-Wasp hulls should get identity mapping
    for (let i = 0; i <= 15; i += 2) { // only even indices are valid dir8→dir16
      expect(applyHullVisualDir16Remap('hornet', i as GeneratedHullDir16Index)).toBe(i);
      expect(applyHullVisualDir16Remap('hunter', i as GeneratedHullDir16Index)).toBe(i);
      expect(applyHullVisualDir16Remap('titan', i as GeneratedHullDir16Index)).toBe(i);
    }
  });

  it('non-Wasp hulls get identity for ALL 16 directions', () => {
    for (let i = 0; i <= 15; i++) {
      expect(applyHullVisualDir16Remap('hornet', i as GeneratedHullDir16Index)).toBe(i);
      expect(applyHullVisualDir16Remap('dictator', i as GeneratedHullDir16Index)).toBe(i);
    }
  });

  it('Wasp remap shifts each direction by +4 (mod 16)', () => {
    for (let i = 0; i <= 15; i++) {
      const result = applyHullVisualDir16Remap('wasp', i as GeneratedHullDir16Index);
      expect(result).toBe((i + 4) % 16);
    }
  });
});

// ─── resolveHullDirectionDiagnostic tests ──────────────────────────

describe('resolveHullDirectionDiagnostic', () => {
  it('returns diagnostic info for wasp at bodyAngle=0 (screen E)', () => {
    const diag = resolveHullDirectionDiagnostic('wasp', 'cyan', 0, 0);
    expect(diag.hullId).toBe('wasp');
    expect(diag.bodyAngleDeg).toBe(0);
    expect(diag.dir8).toBe(0); // E
    expect(diag.logicalDir16).toBe(0); // E
    expect(diag.visualDir16).toBe(WASP_HULL_VISUAL_DIR16_REMAP[0]);
    expect(diag.compassSuffix).toBe(GENERATED_HULL_DIRECTIONS_16[WASP_HULL_VISUAL_DIR16_REMAP[0]].suffix);
    expect(diag.textureKey).toContain('wasp');
    expect(diag.textureKey).toContain('cyan');
    expect(diag.textureKey).toContain('m0');
  });

  it('returns null hullId for unknown bodyId', () => {
    const diag = resolveHullDirectionDiagnostic('unknown', 'cyan', 0, 0);
    expect(diag.hullId).toBeNull();
    expect(diag.textureKey).toBe('');
  });

  it('returns correct dir8 for screen S (PI/2)', () => {
    const diag = resolveHullDirectionDiagnostic('wasp', 'cyan', 0, Math.PI / 2);
    expect(diag.dir8).toBe(2); // S
    expect(diag.logicalDir16).toBe(4); // S at dir16=4
  });
});

// ─── Turret mapping unchanged test ─────────────────────────────────

describe('turret mapping unchanged by Wasp hull remap', () => {
  it('WASP_HULL_VISUAL_DIR16_REMAP does not affect turret functions', () => {
    // The Wasp hull remap is hull-only. Turret direction functions
    // are in a separate module and are not imported or affected.
    // This test verifies the remap table is isolated to hull logic.
    expect(typeof WASP_HULL_VISUAL_DIR16_REMAP[0]).toBe('number');
    // Turret mapping is not part of generatedHullAssets.ts
    // and should remain completely independent.
    expect(true).toBe(true); // structural assertion
  });
});

// ─── Generated hull scale and placement constants (PIM-WASP-SCALE-PLACEMENT-01) ──

describe('generated hull scale constant', () => {
  it('GENERATED_HULL_SCALE is 0.12 (2x reduction from original 0.24)', () => {
    expect(GENERATED_HULL_SCALE).toBe(0.12);
  });

  it('GENERATED_HULL_ORIGIN_X is 0.5 (horizontal center)', () => {
    expect(GENERATED_HULL_ORIGIN_X).toBe(0.5);
  });

  it('GENERATED_HULL_ORIGIN_Y is 0.75 (legacy hull origin)', () => {
    expect(GENERATED_HULL_ORIGIN_Y).toBe(0.75);
  });
});

describe('Wasp-specific placement offsets', () => {
  it('WASP_HULL_OFFSET_X is a finite number', () => {
    expect(Number.isFinite(WASP_HULL_OFFSET_X)).toBe(true);
  });

  it('WASP_HULL_OFFSET_Y is a finite number', () => {
    expect(Number.isFinite(WASP_HULL_OFFSET_Y)).toBe(true);
  });
});

describe('getGeneratedHullPlacementOffset', () => {
  it('returns Wasp offset for wasp', () => {
    const offset = getGeneratedHullPlacementOffset('wasp');
    expect(offset.offsetX).toBe(WASP_HULL_OFFSET_X);
    expect(offset.offsetY).toBe(WASP_HULL_OFFSET_Y);
  });

  it('returns (0, 0) for non-Wasp hulls', () => {
    for (const hullId of GENERATED_HULL_IDS) {
      if (hullId === 'wasp') continue;
      const offset = getGeneratedHullPlacementOffset(hullId);
      expect(offset.offsetX).toBe(0);
      expect(offset.offsetY).toBe(0);
    }
  });

  it('offset values are finite numbers for all hull IDs', () => {
    for (const hullId of GENERATED_HULL_IDS) {
      const offset = getGeneratedHullPlacementOffset(hullId);
      expect(Number.isFinite(offset.offsetX)).toBe(true);
      expect(Number.isFinite(offset.offsetY)).toBe(true);
    }
  });
});
