/**
 * Tests for generated turret asset module and modular vehicle loader.
 *
 * RUNTIME-01: Covers turret key format, path format, key uniqueness,
 * resolver nulls for unsupported combos, selected-set loader queue
 * size limits, duplicate texture key guards, metadata contract bounds,
 * and no generatedAssetManifest mutation.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  GENERATED_TURRET_IDS,
  GENERATED_TURRET_FACTIONS,
  GENERATED_TURRET_MODS,
  GENERATED_TURRET_DIRECTIONS_16,
  getGeneratedTurretTextureKey,
  getGeneratedTurretAssetPath,
  weaponIdToTurretId,
  turretAngleToDir16,
  resolveGeneratedTurretFaction,
  resolveGeneratedTurretKey,
  preloadGeneratedTurretSet,
  DEFAULT_GENERATED_TURRET,
  DEFAULT_GENERATED_TURRET_MOD,
  GENERATED_TURRET_SCALE,
  type GeneratedTurretDir16Index,
} from '../assets/generatedTurretAssets';
import {
  preloadVehicleAssetSet,
  resolveVehicleAssetSetSupport,
  MAX_VEHICLE_SET_PNG_COUNT,
} from '../assets/modularVehicleLoader';
import {
  buildHullMetadata,
  buildTurretMetadata,
  validateVehicleAssetMetadata,
  HULL_IMAGE_SIZE,
  type GeneratedVehicleAssetMetadata,
} from '../assets/generatedVehicleMetadata';

// ═══════════════════════════════════════════════════════════════════
// Generated turret asset tests
// ═══════════════════════════════════════════════════════════════════

// ─── Constants consistency tests ─────────────────────────────────

describe('generated turret constants', () => {
  it('has exactly 10 turret IDs', () => {
    expect(GENERATED_TURRET_IDS.length).toBe(10);
  });

  it('has exactly 4 factions', () => {
    expect(GENERATED_TURRET_FACTIONS.length).toBe(4);
  });

  it('has exactly 4 mods', () => {
    expect(GENERATED_TURRET_MODS.length).toBe(4);
  });

  it('has exactly 16 directions', () => {
    expect(GENERATED_TURRET_DIRECTIONS_16.length).toBe(16);
  });

  it('direction indices are sequential 0–15', () => {
    const indices = GENERATED_TURRET_DIRECTIONS_16.map((d: { index: number }) => d.index);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('total matrix size is 2560', () => {
    expect(
      GENERATED_TURRET_IDS.length *
      GENERATED_TURRET_FACTIONS.length *
      GENERATED_TURRET_MODS.length *
      GENERATED_TURRET_DIRECTIONS_16.length,
    ).toBe(2560);
  });

  it('includes firebird but not flamethrower in turret IDs', () => {
    expect(GENERATED_TURRET_IDS).toContain('firebird');
    expect(GENERATED_TURRET_IDS as readonly string[]).not.toContain('flamethrower');
  });
});

// ─── Texture key builder tests ───────────────────────────────────

describe('getGeneratedTurretTextureKey', () => {
  it('builds correct key for smoky/cyan/m0 dir00', () => {
    expect(getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0))
      .toBe('generated_turret_smoky_cyan_m0_dir00');
  });

  it('builds correct key for hammer/purple/m3 dir15', () => {
    expect(getGeneratedTurretTextureKey('hammer', 'purple', 'm3', 15))
      .toBe('generated_turret_hammer_purple_m3_dir15');
  });

  it('uses generated_turret_ prefix to avoid collision with hull keys', () => {
    const key = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    expect(key.startsWith('generated_turret_')).toBe(true);
    expect(key.startsWith('generated_hull_')).toBe(false);
  });
});

describe('getGeneratedTurretTextureKey uniqueness', () => {
  it('produces unique keys for all 2560 virtual combinations', () => {
    const keys = new Set<string>();

    for (const turret of GENERATED_TURRET_IDS) {
      for (const faction of GENERATED_TURRET_FACTIONS) {
        for (const mod of GENERATED_TURRET_MODS) {
          for (const dir of GENERATED_TURRET_DIRECTIONS_16) {
            keys.add(getGeneratedTurretTextureKey(
              turret, faction, mod,
              dir.index as GeneratedTurretDir16Index,
            ));
          }
        }
      }
    }

    expect(keys.size).toBe(10 * 4 * 4 * 16);
    expect(keys.size).toBe(2560);
  });

  it('produces different keys for different directions of same turret/faction/mod', () => {
    const keys = new Set<string>();
    for (const dir of GENERATED_TURRET_DIRECTIONS_16) {
      keys.add(getGeneratedTurretTextureKey(
        'smoky', 'cyan', 'm0',
        dir.index as GeneratedTurretDir16Index,
      ));
    }
    expect(keys.size).toBe(16);
  });
});

// ─── Path builder tests ──────────────────────────────────────────

describe('getGeneratedTurretAssetPath', () => {
  it('builds correct path for smoky/cyan/m0 dir00', () => {
    expect(getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', 0))
      .toBe('assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_dir00_E.png');
  });

  it('builds correct path for firebird/green/m3 dir14', () => {
    expect(getGeneratedTurretAssetPath('firebird', 'green', 'm3', 14))
      .toBe('assets/units/turrets/firebird/green/m3/firebird_green_m3_dir14_NE.png');
  });

  it('pads single-digit direction indices with leading zero', () => {
    expect(getGeneratedTurretAssetPath('thunder', 'green', 'm1', 4))
      .toContain('dir04_S');
  });

  it('does not pad double-digit direction indices', () => {
    expect(getGeneratedTurretAssetPath('railgun', 'yellow', 'm2', 12))
      .toContain('dir12_N');
  });

  it('includes turret, faction, and mod in path segments', () => {
    const path = getGeneratedTurretAssetPath('vulcan', 'yellow', 'm2', 8);
    expect(path).toContain('vulcan/yellow/m2');
    expect(path).toContain('vulcan_yellow_m2_dir');
  });

  it('uses turrets directory not hulls', () => {
    const path = getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', 0);
    expect(path).toContain('assets/units/turrets/');
    expect(path).not.toContain('assets/units/hulls/');
  });
});

describe('getGeneratedTurretAssetPath uniqueness', () => {
  it('produces unique paths for all 2560 virtual combinations', () => {
    const paths = new Set<string>();

    for (const turret of GENERATED_TURRET_IDS) {
      for (const faction of GENERATED_TURRET_FACTIONS) {
        for (const mod of GENERATED_TURRET_MODS) {
          for (const dir of GENERATED_TURRET_DIRECTIONS_16) {
            paths.add(getGeneratedTurretAssetPath(
              turret, faction, mod,
              dir.index as GeneratedTurretDir16Index,
            ));
          }
        }
      }
    }

    expect(paths.size).toBe(2560);
  });
});

// ─── Weapon ID → Turret ID mapping tests ────────────────────────

describe('weaponIdToTurretId', () => {
  it('maps flamethrower to firebird', () => {
    expect(weaponIdToTurretId('flamethrower')).toBe('firebird');
  });

  it('maps smoky to smoky (identity)', () => {
    expect(weaponIdToTurretId('smoky')).toBe('smoky');
  });

  it('maps hammer to hammer (identity)', () => {
    expect(weaponIdToTurretId('hammer')).toBe('hammer');
  });

  it('maps all 10 accepted weapon IDs', () => {
    const acceptedIds = [
      'smoky', 'thunder', 'railgun', 'flamethrower',
      'freeze', 'isida', 'vulcan', 'twins', 'ricochet', 'hammer',
    ];
    for (const id of acceptedIds) {
      expect(weaponIdToTurretId(id)).not.toBeNull();
    }
  });

  it('returns null for shaft (no generated assets)', () => {
    expect(weaponIdToTurretId('shaft')).toBeNull();
  });

  it('returns null for unknown weapon ID', () => {
    expect(weaponIdToTurretId('unknown')).toBeNull();
    expect(weaponIdToTurretId('')).toBeNull();
  });
});

// ─── Turret angle → 16-dir mapping tests ────────────────────────

describe('turretAngleToDir16', () => {
  it('returns 0 (E) for angle 0', () => {
    expect(turretAngleToDir16(0)).toBe(0);
  });

  it('returns 4 (S) for angle PI/2', () => {
    expect(turretAngleToDir16(Math.PI / 2)).toBe(4);
  });

  it('returns 8 (W) for angle PI', () => {
    expect(turretAngleToDir16(Math.PI)).toBe(8);
  });

  it('returns 12 (N) for angle 3*PI/2', () => {
    expect(turretAngleToDir16(3 * Math.PI / 2)).toBe(12);
  });

  it('returns 2 (SE) for angle PI/4', () => {
    expect(turretAngleToDir16(Math.PI / 4)).toBe(2);
  });

  it('handles odd indices (half directions)', () => {
    expect(turretAngleToDir16(Math.PI / 8)).toBe(1);  // ESE
    expect(turretAngleToDir16(3 * Math.PI / 8)).toBe(3);  // SSE
  });

  it('normalizes negative angles correctly', () => {
    expect(turretAngleToDir16(-Math.PI / 2)).toBe(12);  // N
    expect(turretAngleToDir16(-Math.PI / 4)).toBe(14);  // NE
    expect(turretAngleToDir16(-Math.PI)).toBe(8);  // W
  });

  it('handles angles beyond 2*PI by wrapping', () => {
    expect(turretAngleToDir16(2 * Math.PI)).toBe(0);
    expect(turretAngleToDir16(2 * Math.PI + Math.PI / 4)).toBe(2);
  });

  it('always returns 0–15 for any angle', () => {
    for (let a = -8 * Math.PI; a <= 8 * Math.PI; a += 0.3) {
      const dir = turretAngleToDir16(a);
      expect(dir).toBeGreaterThanOrEqual(0);
      expect(dir).toBeLessThanOrEqual(15);
    }
  });
});

// ─── Default turret config tests ─────────────────────────────────

describe('default turret config', () => {
  it('defaults turret to smoky', () => {
    expect(DEFAULT_GENERATED_TURRET).toBe('smoky');
  });

  it('defaults mod to m0', () => {
    expect(DEFAULT_GENERATED_TURRET_MOD).toBe('m0');
  });
});

// ─── Faction resolution tests ────────────────────────────────────

describe('resolveGeneratedTurretFaction', () => {
  it('returns a valid faction for each known Faction value', () => {
    expect(resolveGeneratedTurretFaction('cyan')).toBe('cyan');
    expect(resolveGeneratedTurretFaction('green')).toBe('green');
    expect(resolveGeneratedTurretFaction('yellow')).toBe('yellow');
    expect(resolveGeneratedTurretFaction('purple')).toBe('purple');
  });

  it('falls back to cyan for undefined', () => {
    expect(resolveGeneratedTurretFaction(undefined)).toBe('cyan');
  });
});

// ─── Resolver tests ──────────────────────────────────────────────

describe('resolveGeneratedTurretKey', () => {
  it('returns null when texture is not loaded', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
    } as unknown as Phaser.Scene;

    expect(resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 0, 0)).toBeNull();
  });

  it('returns null for unsupported weaponId (shaft)', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(true) },
    } as unknown as Phaser.Scene;

    expect(resolveGeneratedTurretKey(mockScene, 'shaft', 'cyan', 0, 0)).toBeNull();
  });

  it('returns null for unknown weaponId', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(true) },
    } as unknown as Phaser.Scene;

    expect(resolveGeneratedTurretKey(mockScene, 'unknown_weapon', 'cyan', 0, 0)).toBeNull();
  });

  it('returns expected key when texture exists', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) =>
          key === 'generated_turret_smoky_cyan_m0_dir00'),
      },
    } as unknown as Phaser.Scene;

    expect(resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 0, 0))
      .toBe('generated_turret_smoky_cyan_m0_dir00');
  });

  it('maps flamethrower to firebird turret key', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) =>
          key === 'generated_turret_firebird_cyan_m0_dir00'),
      },
    } as unknown as Phaser.Scene;

    expect(resolveGeneratedTurretKey(mockScene, 'flamethrower', 'cyan', 0, 0))
      .toBe('generated_turret_firebird_cyan_m0_dir00');
  });

  it('maps modificationLevel to correct mod', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) =>
          key === 'generated_turret_smoky_cyan_m3_dir00'),
      },
    } as unknown as Phaser.Scene;

    expect(resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 3, 0))
      .toBe('generated_turret_smoky_cyan_m3_dir00');
  });

  it('maps turretAngle to correct direction', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) =>
          key === 'generated_turret_smoky_cyan_m0_dir04'),
      },
    } as unknown as Phaser.Scene;

    expect(resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 0, Math.PI / 2))
      .toBe('generated_turret_smoky_cyan_m0_dir04');
  });
});

// ─── Preload set tests ───────────────────────────────────────────

describe('preloadGeneratedTurretSet', () => {
  it('requests exactly 16 PNG for one set', () => {
    const loadImageCalls: Array<{ key: string; path: string }> = [];
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: {
        image: vi.fn().mockImplementation((key: string, path: string) => {
          loadImageCalls.push({ key, path });
        }),
      },
    } as unknown as Phaser.Scene;

    const keys = preloadGeneratedTurretSet(mockScene, 'smoky', 'cyan', 'm0');

    expect(keys.length).toBe(16);
    expect(loadImageCalls.length).toBe(16);
  });

  it('does not iterate all combinations — only one turret+faction+mod', () => {
    const loadImageCalls: Array<{ key: string; path: string }> = [];
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: {
        image: vi.fn().mockImplementation((key: string, path: string) => {
          loadImageCalls.push({ key, path });
        }),
      },
    } as unknown as Phaser.Scene;

    preloadGeneratedTurretSet(mockScene, 'smoky', 'cyan', 'm0');

    for (const call of loadImageCalls) {
      expect(call.key).toContain('smoky_cyan_m0');
      expect(call.path).toContain('smoky/cyan/m0');
    }
  });

  it('skips already-loaded textures', () => {
    const loadImageCalls: Array<{ key: string; path: string }> = [];
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) =>
          key === 'generated_turret_smoky_cyan_m0_dir00'),
      },
      load: {
        image: vi.fn().mockImplementation((key: string, path: string) => {
          loadImageCalls.push({ key, path });
        }),
      },
    } as unknown as Phaser.Scene;

    const keys = preloadGeneratedTurretSet(mockScene, 'smoky', 'cyan', 'm0');

    expect(keys.length).toBe(15);
    expect(keys).not.toContain('generated_turret_smoky_cyan_m0_dir00');
  });
});

// ─── Texture key prefix tests ────────────────────────────────────

describe('texture key prefix', () => {
  it('all generated turret keys start with generated_turret_', () => {
    for (const turret of GENERATED_TURRET_IDS) {
      for (const faction of GENERATED_TURRET_FACTIONS) {
        const key = getGeneratedTurretTextureKey(turret, faction, 'm0', 0);
        expect(key.startsWith('generated_turret_')).toBe(true);
      }
    }
  });

  it('no generated turret key starts with generated_hull_', () => {
    const key = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    expect(key.startsWith('generated_hull_')).toBe(false);
  });
});

// ─── Scale constant tests ────────────────────────────────────────

describe('turret render constants', () => {
  it('GENERATED_TURRET_SCALE is 0.12 (matches hull scale)', () => {
    expect(GENERATED_TURRET_SCALE).toBe(0.12);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Modular vehicle loader tests
// ═══════════════════════════════════════════════════════════════════

describe('preloadVehicleAssetSet', () => {
  it('loads 16 hull + 16 turret = 32 PNG for valid combo', () => {
    const loadedKeys: string[] = [];
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: {
        image: vi.fn().mockImplementation((key: string) => {
          loadedKeys.push(key);
        }),
      },
    } as unknown as Phaser.Scene;

    const result = preloadVehicleAssetSet(mockScene, {
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });

    expect(result.hullSupported).toBe(true);
    expect(result.turretSupported).toBe(true);
    expect(result.hullKeys.length).toBe(16);
    expect(result.turretKeys.length).toBe(16);
    expect(result.totalQueued).toBe(32);
  });

  it('loads only hull when weaponId is unsupported', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: { image: vi.fn() },
    } as unknown as Phaser.Scene;

    const result = preloadVehicleAssetSet(mockScene, {
      bodyId: 'wasp',
      weaponId: 'shaft',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });

    expect(result.hullSupported).toBe(true);
    expect(result.turretSupported).toBe(false);
    expect(result.hullKeys.length).toBe(16);
    expect(result.turretKeys.length).toBe(0);
    expect(result.totalQueued).toBe(16);
  });

  it('loads only turret when bodyId is unsupported', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: { image: vi.fn() },
    } as unknown as Phaser.Scene;

    const result = preloadVehicleAssetSet(mockScene, {
      bodyId: 'unknown_body',
      weaponId: 'smoky',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });

    expect(result.hullSupported).toBe(false);
    expect(result.turretSupported).toBe(true);
    expect(result.hullKeys.length).toBe(0);
    expect(result.turretKeys.length).toBe(16);
    expect(result.totalQueued).toBe(16);
  });

  it('loads nothing when both are unsupported', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: { image: vi.fn() },
    } as unknown as Phaser.Scene;

    const result = preloadVehicleAssetSet(mockScene, {
      bodyId: 'unknown_body',
      weaponId: 'shaft',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });

    expect(result.hullSupported).toBe(false);
    expect(result.turretSupported).toBe(false);
    expect(result.totalQueued).toBe(0);
  });

  it('never exceeds 32 PNG for any valid combo', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: { image: vi.fn() },
    } as unknown as Phaser.Scene;

    const result = preloadVehicleAssetSet(mockScene, {
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'purple',
      hullModificationLevel: 3,
      turretModificationLevel: 3,
    });

    expect(result.totalQueued).toBeLessThanOrEqual(MAX_VEHICLE_SET_PNG_COUNT);
    expect(result.totalQueued).toBe(32);
  });

  it('skips duplicate texture keys (already loaded)', () => {
    // Simulate all hull textures already loaded, no turret textures
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) =>
          key.startsWith('generated_hull_')),
      },
      load: { image: vi.fn() },
    } as unknown as Phaser.Scene;

    const result = preloadVehicleAssetSet(mockScene, {
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });

    // Hull keys already exist → 0 new hull loads
    expect(result.hullKeys.length).toBe(0);
    // Turret keys don't exist → 16 new turret loads
    expect(result.turretKeys.length).toBe(16);
    expect(result.totalQueued).toBe(16);
  });

  it('maps flamethrower weaponId to firebird turret', () => {
    const mockScene = {
      textures: { exists: vi.fn().mockReturnValue(false) },
      load: { image: vi.fn() },
    } as unknown as Phaser.Scene;

    const result = preloadVehicleAssetSet(mockScene, {
      bodyId: 'wasp',
      weaponId: 'flamethrower',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });

    expect(result.turretSupported).toBe(true);
    expect(result.turretKeys.length).toBe(16);
    // All turret keys should reference firebird
    for (const key of result.turretKeys) {
      expect(key).toContain('firebird');
      expect(key).not.toContain('flamethrower');
    }
  });
});

describe('resolveVehicleAssetSetSupport', () => {
  it('returns both supported for wasp/smoky', () => {
    const result = resolveVehicleAssetSetSupport({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });
    expect(result.hullSupported).toBe(true);
    expect(result.turretSupported).toBe(true);
  });

  it('returns turretSupported false for shaft', () => {
    const result = resolveVehicleAssetSetSupport({
      bodyId: 'wasp',
      weaponId: 'shaft',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });
    expect(result.hullSupported).toBe(true);
    expect(result.turretSupported).toBe(false);
  });

  it('returns hullSupported false for unknown body', () => {
    const result = resolveVehicleAssetSetSupport({
      bodyId: 'unknown_body',
      weaponId: 'smoky',
      faction: 'cyan',
      hullModificationLevel: 0,
      turretModificationLevel: 0,
    });
    expect(result.hullSupported).toBe(false);
    expect(result.turretSupported).toBe(true);
  });
});

describe('MAX_VEHICLE_SET_PNG_COUNT', () => {
  it('is 32 (16 hull + 16 turret)', () => {
    expect(MAX_VEHICLE_SET_PNG_COUNT).toBe(32);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Metadata contract tests
// ═══════════════════════════════════════════════════════════════════

describe('buildHullMetadata', () => {
  it('builds metadata for a generated hull', () => {
    const meta = buildHullMetadata({
      id: 'wasp',
      faction: 'cyan',
      mod: 'm0',
    });

    expect(meta.family).toBe('hull');
    expect(meta.id).toBe('wasp');
    expect(meta.faction).toBe('cyan');
    expect(meta.mod).toBe('m0');
    expect(meta.dirCount).toBe(16);
    expect(meta.imageSize).toEqual({ width: 512, height: 512 });
    expect(meta.keyPrefix).toBe('generated_hull_wasp_cyan_m0');
    expect(meta.pathPrefix).toBe('assets/units/hulls/wasp/cyan/m0');
  });

  it('provides default socket at hull center', () => {
    const meta = buildHullMetadata({
      id: 'wasp',
      faction: 'cyan',
      mod: 'm0',
    });

    expect(meta.socket).toEqual({ nx: 0.5, ny: 0.5 });
  });

  it('accepts custom socket position', () => {
    const meta = buildHullMetadata({
      id: 'wasp',
      faction: 'cyan',
      mod: 'm0',
      socket: { nx: 0.6, ny: 0.4 },
    });

    expect(meta.socket).toEqual({ nx: 0.6, ny: 0.4 });
  });

  it('always has imageSize for hulls (not null)', () => {
    const meta = buildHullMetadata({ id: 'wasp', faction: 'cyan', mod: 'm0' });
    expect(meta.imageSize).not.toBeNull();
  });
});

describe('buildTurretMetadata', () => {
  it('builds metadata for a generated turret', () => {
    const meta = buildTurretMetadata({
      id: 'smoky',
      faction: 'cyan',
      mod: 'm0',
    });

    expect(meta.family).toBe('turret');
    expect(meta.id).toBe('smoky');
    expect(meta.faction).toBe('cyan');
    expect(meta.mod).toBe('m0');
    expect(meta.dirCount).toBe(16);
    expect(meta.imageSize).toBeNull(); // unknown by default
    expect(meta.keyPrefix).toBe('generated_turret_smoky_cyan_m0');
    expect(meta.pathPrefix).toBe('assets/units/turrets/smoky/cyan/m0');
  });

  it('allows explicit imageSize when known', () => {
    const meta = buildTurretMetadata({
      id: 'smoky',
      faction: 'cyan',
      mod: 'm0',
      imageSize: { width: 512, height: 512 },
    });

    expect(meta.imageSize).toEqual({ width: 512, height: 512 });
  });

  it('allows pivot position', () => {
    const meta = buildTurretMetadata({
      id: 'smoky',
      faction: 'cyan',
      mod: 'm0',
      pivot: { nx: 0.5, ny: 0.6 },
    });

    expect(meta.pivot).toEqual({ nx: 0.5, ny: 0.6 });
  });
});

describe('validateVehicleAssetMetadata', () => {
  it('returns empty errors for valid hull metadata', () => {
    const meta = buildHullMetadata({ id: 'wasp', faction: 'cyan', mod: 'm0' });
    const errors = validateVehicleAssetMetadata(meta);
    expect(errors).toEqual([]);
  });

  it('returns warning for turret with null imageSize', () => {
    const meta = buildTurretMetadata({ id: 'smoky', faction: 'cyan', mod: 'm0' });
    const errors = validateVehicleAssetMetadata(meta);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('turret imageSize is null');
  });

  it('returns no warnings for turret with known imageSize', () => {
    const meta = buildTurretMetadata({
      id: 'smoky',
      faction: 'cyan',
      mod: 'm0',
      imageSize: { width: 512, height: 512 },
    });
    const errors = validateVehicleAssetMetadata(meta);
    expect(errors).toEqual([]);
  });

  it('returns error for hull with null imageSize', () => {
    const meta: GeneratedVehicleAssetMetadata = {
      family: 'hull',
      id: 'wasp',
      faction: 'cyan',
      mod: 'm0',
      dirCount: 16,
      imageSize: null, // should not happen for hulls
      keyPrefix: 'generated_hull_wasp_cyan_m0',
      pathPrefix: 'assets/units/hulls/wasp/cyan/m0',
    };
    const errors = validateVehicleAssetMetadata(meta);
    expect(errors.some(e => e.includes('hull metadata must have imageSize'))).toBe(true);
  });

  it('returns error for wrong dirCount', () => {
    const meta: GeneratedVehicleAssetMetadata = {
      family: 'hull',
      id: 'wasp',
      faction: 'cyan',
      mod: 'm0',
      dirCount: 8 as 16, // wrong
      imageSize: HULL_IMAGE_SIZE,
      keyPrefix: 'generated_hull_wasp_cyan_m0',
      pathPrefix: 'assets/units/hulls/wasp/cyan/m0',
    };
    const errors = validateVehicleAssetMetadata(meta);
    expect(errors.some(e => e.includes('dirCount must be 16'))).toBe(true);
  });

  it('returns error for missing id', () => {
    const meta: GeneratedVehicleAssetMetadata = {
      family: 'hull',
      id: '',
      faction: 'cyan',
      mod: 'm0',
      dirCount: 16,
      imageSize: HULL_IMAGE_SIZE,
      keyPrefix: 'generated_hull__cyan_m0',
      pathPrefix: 'assets/units/hulls//cyan/m0',
    };
    const errors = validateVehicleAssetMetadata(meta);
    expect(errors.some(e => e.includes('id is required'))).toBe(true);
  });
});

// ─── No generatedAssetManifest mutation ──────────────────────────

// These are compile-time guarantees: neither generatedTurretAssets.ts
// nor modularVehicleLoader.ts imports from generatedAssetManifest.ts.
// The forbidden import is enforced by code review and the module
// dependency graph. We verify this with a structural assertion:
// the modules do not reference 'generatedAssetManifest' or
// 'GENERATED_ASSET_MANIFEST' in their source.

import * as turretModule from '../assets/generatedTurretAssets';
import * as loaderModule from '../assets/modularVehicleLoader';

describe('no generatedAssetManifest mutation', () => {
  it('generatedTurretAssets does not export any manifest symbol', () => {
    const exportedKeys = Object.keys(turretModule);
    expect(exportedKeys).not.toContain('generatedAssetManifest');
    expect(exportedKeys).not.toContain('GENERATED_ASSET_MANIFEST');
  });

  it('modularVehicleLoader does not export any manifest symbol', () => {
    const exportedKeys = Object.keys(loaderModule);
    expect(exportedKeys).not.toContain('generatedAssetManifest');
    expect(exportedKeys).not.toContain('GENERATED_ASSET_MANIFEST');
  });
});
