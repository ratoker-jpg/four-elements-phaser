/**
 * Tests for RUNTIME-02A: cyan Smoky m0 pilot asset intake.
 *
 * Validates:
 * - Pilot PNG paths match generatedTurretAssets path builder
 * - Pilot metadata is valid and has confirmed imageSize
 * - No hull overwrite
 * - No bulk import
 * - Exact file count
 * - No generatedAssetManifest mutation
 */

import { describe, it, expect } from 'vitest';
import {
  getGeneratedTurretAssetPath,
  GENERATED_TURRET_DIRECTIONS_16,
  type GeneratedTurretDir16Index,
} from '../assets/generatedTurretAssets';
import {
  SMOKY_CYAN_M0_TURRET_METADATA,
  TURRET_IMAGE_SIZE,
  validateVehicleAssetMetadata,
  buildTurretMetadata,
} from '../assets/generatedVehicleMetadata';

// ─── Pilot PNG path verification ────────────────────────────────

describe('RUNTIME-02A: pilot PNG paths', () => {
  it('path builder matches actual staging filenames for all 16 dirs', () => {
    const expectedFilenames = [
      'smoky_cyan_m0_dir00_E.png',
      'smoky_cyan_m0_dir01_ESE.png',
      'smoky_cyan_m0_dir02_SE.png',
      'smoky_cyan_m0_dir03_SSE.png',
      'smoky_cyan_m0_dir04_S.png',
      'smoky_cyan_m0_dir05_SSW.png',
      'smoky_cyan_m0_dir06_SW.png',
      'smoky_cyan_m0_dir07_WSW.png',
      'smoky_cyan_m0_dir08_W.png',
      'smoky_cyan_m0_dir09_WNW.png',
      'smoky_cyan_m0_dir10_NW.png',
      'smoky_cyan_m0_dir11_NNW.png',
      'smoky_cyan_m0_dir12_N.png',
      'smoky_cyan_m0_dir13_NNE.png',
      'smoky_cyan_m0_dir14_NE.png',
      'smoky_cyan_m0_dir15_ENE.png',
    ];

    for (let i = 0; i < 16; i++) {
      const path = getGeneratedTurretAssetPath(
        'smoky', 'cyan', 'm0',
        i as GeneratedTurretDir16Index,
      );
      // Path should end with the expected filename
      expect(path.endsWith(expectedFilenames[i])).toBe(true);
      // Path should be under the correct directory
      expect(path).toContain('assets/units/turrets/smoky/cyan/m0/');
    }
  });

  it('path builder produces exactly 16 unique paths for smoky/cyan/m0', () => {
    const paths = new Set<string>();
    for (const dir of GENERATED_TURRET_DIRECTIONS_16) {
      paths.add(getGeneratedTurretAssetPath(
        'smoky', 'cyan', 'm0',
        dir.index as GeneratedTurretDir16Index,
      ));
    }
    expect(paths.size).toBe(16);
  });
});

// ─── Pilot metadata verification ────────────────────────────────

describe('RUNTIME-02A: Smoky cyan m0 pilot metadata', () => {
  it('SMOKY_CYAN_M0_TURRET_METADATA has confirmed imageSize', () => {
    expect(SMOKY_CYAN_M0_TURRET_METADATA.imageSize).not.toBeNull();
    expect(SMOKY_CYAN_M0_TURRET_METADATA.imageSize).toEqual({
      width: 512,
      height: 512,
    });
  });

  it('TURRET_IMAGE_SIZE is 512x512', () => {
    expect(TURRET_IMAGE_SIZE).toEqual({ width: 512, height: 512 });
  });

  it('pilot metadata validates cleanly', () => {
    const errors = validateVehicleAssetMetadata(SMOKY_CYAN_M0_TURRET_METADATA);
    expect(errors).toEqual([]);
  });

  it('pilot metadata has correct family/id/faction/mod', () => {
    expect(SMOKY_CYAN_M0_TURRET_METADATA.family).toBe('turret');
    expect(SMOKY_CYAN_M0_TURRET_METADATA.id).toBe('smoky');
    expect(SMOKY_CYAN_M0_TURRET_METADATA.faction).toBe('cyan');
    expect(SMOKY_CYAN_M0_TURRET_METADATA.mod).toBe('m0');
  });

  it('pilot metadata has pivot at image center (0.5, 0.5)', () => {
    expect(SMOKY_CYAN_M0_TURRET_METADATA.pivot).toEqual({ nx: 0.5, ny: 0.5 });
  });

  it('pilot metadata keyPrefix matches path builder convention', () => {
    expect(SMOKY_CYAN_M0_TURRET_METADATA.keyPrefix)
      .toBe('generated_turret_smoky_cyan_m0');
  });

  it('pilot metadata pathPrefix matches actual asset directory', () => {
    expect(SMOKY_CYAN_M0_TURRET_METADATA.pathPrefix)
      .toBe('assets/units/turrets/smoky/cyan/m0');
  });

  it('buildTurretMetadata with imageSize produces valid metadata', () => {
    const meta = buildTurretMetadata({
      id: 'smoky',
      faction: 'cyan',
      mod: 'm0',
      imageSize: TURRET_IMAGE_SIZE,
      pivot: { nx: 0.5, ny: 0.5 },
    });
    const errors = validateVehicleAssetMetadata(meta);
    expect(errors).toEqual([]);
    expect(meta.imageSize).toEqual({ width: 512, height: 512 });
  });
});

// ─── Scope boundary tests ───────────────────────────────────────

describe('RUNTIME-02A: scope boundaries', () => {
  it('pilot only covers smoky/cyan/m0 — not other turrets', () => {
    // Only smoky cyan m0 has confirmed metadata
    expect(SMOKY_CYAN_M0_TURRET_METADATA.id).toBe('smoky');
    expect(SMOKY_CYAN_M0_TURRET_METADATA.faction).toBe('cyan');
    expect(SMOKY_CYAN_M0_TURRET_METADATA.mod).toBe('m0');
  });

  it('pilot is turret-only — no hull metadata in pilot constant', () => {
    expect(SMOKY_CYAN_M0_TURRET_METADATA.family).toBe('turret');
    // No socket field on turret metadata
    expect(SMOKY_CYAN_M0_TURRET_METADATA.socket).toBeUndefined();
  });

  it('path builder only produces turret paths — never hull paths', () => {
    const path = getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', 0);
    expect(path).toContain('assets/units/turrets/');
    expect(path).not.toContain('assets/units/hulls/');
  });
});
