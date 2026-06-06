/**
 * Tests for generated turret asset module.
 *
 * RUNTIME-TURRET-01: Path builders, key uniqueness, direction mapping,
 * weapon ID mapping, and resolver logic.
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
  type GeneratedTurretDir16Index,
} from '../assets/generatedTurretAssets';

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
    expect(GENERATED_TURRET_IDS.length * GENERATED_TURRET_FACTIONS.length * GENERATED_TURRET_MODS.length * GENERATED_TURRET_DIRECTIONS_16.length).toBe(2560);
  });

  it('includes firebird but not flamethrower in turret IDs', () => {
    expect(GENERATED_TURRET_IDS).toContain('firebird');
    expect(GENERATED_TURRET_IDS as readonly string[]).not.toContain('flamethrower');
  });
});

// ─── Texture key builder tests ───────────────────────────────────

describe('getGeneratedTurretTextureKey', () => {
  it('builds correct key for smoky/cyan/m0 dir00', () => {
    const key = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    expect(key).toBe('generated_turret_smoky_cyan_m0_dir00');
  });

  it('builds correct key for hammer/purple/m3 dir15', () => {
    const key = getGeneratedTurretTextureKey('hammer', 'purple', 'm3', 15);
    expect(key).toBe('generated_turret_hammer_purple_m3_dir15');
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
            const key = getGeneratedTurretTextureKey(
              turret,
              faction,
              mod,
              dir.index as GeneratedTurretDir16Index,
            );
            keys.add(key);
          }
        }
      }
    }

    // 10 turrets × 4 factions × 4 mods × 16 directions = 2560
    expect(keys.size).toBe(10 * 4 * 4 * 16);
    expect(keys.size).toBe(2560);
  });

  it('produces different keys for different directions of same turret/faction/mod', () => {
    const keys = new Set<string>();
    for (const dir of GENERATED_TURRET_DIRECTIONS_16) {
      keys.add(getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir.index as GeneratedTurretDir16Index));
    }
    expect(keys.size).toBe(16);
  });
});

// ─── Path builder tests ──────────────────────────────────────────

describe('getGeneratedTurretAssetPath', () => {
  it('builds correct path for smoky/cyan/m0 dir00', () => {
    const path = getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', 0);
    expect(path).toBe(
      'assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_turret_dir00_E.png',
    );
  });

  it('builds correct path for firebird/green/m3 dir14', () => {
    const path = getGeneratedTurretAssetPath('firebird', 'green', 'm3', 14);
    expect(path).toBe(
      'assets/units/turrets/firebird/green/m3/firebird_green_m3_turret_dir14_NE.png',
    );
  });

  it('pads single-digit direction indices with leading zero', () => {
    const path = getGeneratedTurretAssetPath('thunder', 'green', 'm1', 4);
    expect(path).toContain('dir04_S');
  });

  it('does not pad double-digit direction indices', () => {
    const path = getGeneratedTurretAssetPath('railgun', 'yellow', 'm2', 12);
    expect(path).toContain('dir12_N');
  });

  it('includes turret, faction, and mod in path segments', () => {
    const path = getGeneratedTurretAssetPath('vulcan', 'yellow', 'm2', 8);
    expect(path).toContain('vulcan/yellow/m2');
    expect(path).toContain('vulcan_yellow_m2_turret');
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
            const path = getGeneratedTurretAssetPath(
              turret,
              faction,
              mod,
              dir.index as GeneratedTurretDir16Index,
            );
            paths.add(path);
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
    const acceptedIds = ['smoky', 'thunder', 'railgun', 'flamethrower', 'freeze', 'isida', 'vulcan', 'twins', 'ricochet', 'hammer'];
    for (const id of acceptedIds) {
      const result = weaponIdToTurretId(id);
      expect(result).not.toBeNull();
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

  it('returns 6 (SW) for angle 3*PI/4', () => {
    expect(turretAngleToDir16(3 * Math.PI / 4)).toBe(6);
  });

  it('returns 10 (NW) for angle 5*PI/4', () => {
    expect(turretAngleToDir16(5 * Math.PI / 4)).toBe(10);
  });

  it('returns 14 (NE) for angle 7*PI/4', () => {
    expect(turretAngleToDir16(7 * Math.PI / 4)).toBe(14);
  });

  it('handles odd indices (half directions)', () => {
    // ESE = PI/8 → dir01
    expect(turretAngleToDir16(Math.PI / 8)).toBe(1);
    // SSE = 3*PI/8 → dir03
    expect(turretAngleToDir16(3 * Math.PI / 8)).toBe(3);
  });

  it('normalizes negative angles correctly', () => {
    // -PI/2 should normalize to 3*PI/2, which is dir12 (N)
    expect(turretAngleToDir16(-Math.PI / 2)).toBe(12);
    // -PI/4 should normalize to 7*PI/4, which is dir14 (NE)
    expect(turretAngleToDir16(-Math.PI / 4)).toBe(14);
    // -PI should normalize to PI, which is dir08 (W)
    expect(turretAngleToDir16(-Math.PI)).toBe(8);
  });

  it('handles angles beyond 2*PI by wrapping', () => {
    expect(turretAngleToDir16(2 * Math.PI)).toBe(0); // Same as 0
    expect(turretAngleToDir16(2 * Math.PI + Math.PI / 4)).toBe(2); // Same as PI/4
    expect(turretAngleToDir16(4 * Math.PI)).toBe(0);
  });

  it('handles angles below -2*PI by wrapping', () => {
    expect(turretAngleToDir16(-2 * Math.PI)).toBe(0); // Same as 0
    expect(turretAngleToDir16(-2 * Math.PI - Math.PI / 2)).toBe(12); // Same as -PI/2 → N
  });

  it('handles boundary near 2*PI correctly', () => {
    // Just under 2*PI normalizes to just under 2*PI.
    // 2*PI - PI/16 is in the ENE sector (sector 15), since
    // the center of ENE is 15*PI/8 and E is at 0/2*PI.
    // Sector boundaries: each sector is PI/8 wide.
    // Sector 15 (ENE): 15*PI/8 - PI/16 .. 15*PI/8 + PI/16
    //   = 29*PI/16 .. 31*PI/16
    // 2*PI - PI/16 = 31*PI/16, which is the edge of ENE.
    // With Math.round, 2*PI - PI/16 rounds to sector 16 (= 0 mod 16 = E).
    // So this is actually E, not ENE, at the boundary.
    expect(turretAngleToDir16(2 * Math.PI - Math.PI / 16)).toBe(0); // rounds to E

    // A bit further from E: 2*PI - PI/8 is clearly ENE
    expect(turretAngleToDir16(2 * Math.PI - Math.PI / 8)).toBe(15); // ENE
  });

  it('always returns 0–15 for any angle', () => {
    for (let a = -8 * Math.PI; a <= 8 * Math.PI; a += 0.3) {
      const dir = turretAngleToDir16(a);
      expect(dir).toBeGreaterThanOrEqual(0);
      expect(dir).toBeLessThanOrEqual(15);
    }
  });
});

// ─── Texture key prefix tests ────────────────────────────────────

describe('texture key prefix', () => {
  it('all generated turret keys start with generated_turret_', () => {
    for (const turret of GENERATED_TURRET_IDS) {
      for (const faction of GENERATED_TURRET_FACTIONS) {
        for (const mod of GENERATED_TURRET_MODS) {
          for (const dir of GENERATED_TURRET_DIRECTIONS_16) {
            const key = getGeneratedTurretTextureKey(turret, faction, mod, dir.index as GeneratedTurretDir16Index);
            expect(key.startsWith('generated_turret_')).toBe(true);
          }
        }
      }
    }
  });

  it('no generated turret key starts with generated_hull_', () => {
    const key = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    expect(key.startsWith('generated_hull_')).toBe(false);
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
      textures: {
        exists: vi.fn().mockReturnValue(false),
      },
    } as unknown as Phaser.Scene;

    const result = resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 0, 0);
    expect(result).toBeNull();
  });

  it('returns null for unsupported weaponId (shaft)', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockReturnValue(true),
      },
    } as unknown as Phaser.Scene;

    const result = resolveGeneratedTurretKey(mockScene, 'shaft', 'cyan', 0, 0);
    expect(result).toBeNull();
  });

  it('returns null for unknown weaponId', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockReturnValue(true),
      },
    } as unknown as Phaser.Scene;

    const result = resolveGeneratedTurretKey(mockScene, 'unknown_weapon', 'cyan', 0, 0);
    expect(result).toBeNull();
  });

  it('returns expected key when texture exists', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) => {
          return key === 'generated_turret_smoky_cyan_m0_dir00';
        }),
      },
    } as unknown as Phaser.Scene;

    const result = resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 0, 0);
    expect(result).toBe('generated_turret_smoky_cyan_m0_dir00');
  });

  it('maps flamethrower to firebird turret key', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) => {
          return key === 'generated_turret_firebird_cyan_m0_dir00';
        }),
      },
    } as unknown as Phaser.Scene;

    const result = resolveGeneratedTurretKey(mockScene, 'flamethrower', 'cyan', 0, 0);
    expect(result).toBe('generated_turret_firebird_cyan_m0_dir00');
  });

  it('maps modificationLevel to correct mod', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) => {
          return key === 'generated_turret_smoky_cyan_m3_dir00';
        }),
      },
    } as unknown as Phaser.Scene;

    const result = resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 3, 0);
    expect(result).toBe('generated_turret_smoky_cyan_m3_dir00');
  });

  it('maps turretAngle to correct direction', () => {
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) => {
          return key === 'generated_turret_smoky_cyan_m0_dir04';
        }),
      },
    } as unknown as Phaser.Scene;

    const result = resolveGeneratedTurretKey(mockScene, 'smoky', 'cyan', 0, Math.PI / 2);
    expect(result).toBe('generated_turret_smoky_cyan_m0_dir04');
  });
});

// ─── Preload set tests ───────────────────────────────────────────

describe('preloadGeneratedTurretSet', () => {
  it('requests exactly 16 PNG for one set', () => {
    const loadImageCalls: Array<{ key: string; path: string }> = [];
    const mockScene = {
      textures: {
        exists: vi.fn().mockReturnValue(false),
      },
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
      textures: {
        exists: vi.fn().mockReturnValue(false),
      },
      load: {
        image: vi.fn().mockImplementation((key: string, path: string) => {
          loadImageCalls.push({ key, path });
        }),
      },
    } as unknown as Phaser.Scene;

    preloadGeneratedTurretSet(mockScene, 'smoky', 'cyan', 'm0');

    // All keys should be for smoky/cyan/m0 only
    for (const call of loadImageCalls) {
      expect(call.key).toContain('smoky_cyan_m0');
      expect(call.path).toContain('smoky/cyan/m0');
    }
  });

  it('skips already-loaded textures', () => {
    const loadImageCalls: Array<{ key: string; path: string }> = [];
    // Pretend dir00 is already loaded
    const mockScene = {
      textures: {
        exists: vi.fn().mockImplementation((key: string) => {
          return key === 'generated_turret_smoky_cyan_m0_dir00';
        }),
      },
      load: {
        image: vi.fn().mockImplementation((key: string, path: string) => {
          loadImageCalls.push({ key, path });
        }),
      },
    } as unknown as Phaser.Scene;

    const keys = preloadGeneratedTurretSet(mockScene, 'smoky', 'cyan', 'm0');

    // 16 total minus 1 already loaded = 15
    expect(keys.length).toBe(15);
    expect(loadImageCalls.length).toBe(15);
    // The dir00 key should not appear in the loaded keys
    expect(keys).not.toContain('generated_turret_smoky_cyan_m0_dir00');
  });
});
