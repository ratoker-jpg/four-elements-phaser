/**
 * TURRET-HULL-CONTRACT-PR-D: Tests for the modular turret sprite key resolver.
 *
 * These tests verify:
 * 1. resolveModularTurretSpriteKey returns expected key when texture exists
 * 2. resolveModularTurretSpriteKey returns null when texture is missing
 * 3. Unsupported weapons return null
 * 4. The resolver uses turret profile direction, not hull remap
 * 5. MODULAR_TURRET_SPRITE_WEAPONS set is correct
 */

import { describe, it, expect } from 'vitest';
import {
  resolveModularTurretSpriteKey,
  MODULAR_TURRET_SPRITE_WEAPONS,
  getSmokyTurretKey,
} from '../assets/modularUnitAssets';
import { resolveTurretVisualDir } from '../config/hullTurretVisualProfiles';
import { bodyAngleToDir8 } from '../assets/generatedHullAssets';

// ── Mock Phaser Scene ───────────────────────────────────────────────

/**
 * Create a mock Phaser Scene with a controllable texture registry.
 * Only the keys in `existingKeys` will report as existing.
 */
function createMockScene(existingKeys: Set<string>) {
  return {
    textures: {
      exists: (key: string) => existingKeys.has(key),
    },
  } as unknown as Phaser.Scene;
}

// ── MODULAR_TURRET_SPRITE_WEAPONS ───────────────────────────────────

describe('MODULAR_TURRET_SPRITE_WEAPONS', () => {
  it('contains smoky', () => {
    expect(MODULAR_TURRET_SPRITE_WEAPONS.has('smoky')).toBe(true);
  });

  it('does not contain thunder', () => {
    expect(MODULAR_TURRET_SPRITE_WEAPONS.has('thunder')).toBe(false);
  });

  it('does not contain railgun', () => {
    expect(MODULAR_TURRET_SPRITE_WEAPONS.has('railgun')).toBe(false);
  });
});

// ── resolveModularTurretSpriteKey — returns expected key ─────────────

describe('resolveModularTurretSpriteKey — returns key when texture exists', () => {
  it('returns smoky_m0_turret_cyan_dir2 for turretAngle=0 (East), cyan faction', () => {
    // bodyAngleToDir8(0) = 0 (East), resolveTurretVisualDir('smoky', 0) = 2
    const expectedKey = getSmokyTurretKey('cyan', 2);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_cyan_dir2');
  });

  it('returns smoky_m0_turret_green_dir4 for turretAngle=PI/2 (South), green faction', () => {
    // bodyAngleToDir8(PI/2) = 2 (South), resolveTurretVisualDir('smoky', 2) = 4
    const expectedKey = getSmokyTurretKey('green', 4);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'green', Math.PI / 2);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_green_dir4');
  });

  it('returns smoky_m0_turret_yellow_dir6 for turretAngle=PI (West)', () => {
    // bodyAngleToDir8(PI) = 4 (West), resolveTurretVisualDir('smoky', 4) = 6
    const expectedKey = getSmokyTurretKey('yellow', 6);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'yellow', Math.PI);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_yellow_dir6');
  });

  it('returns smoky_m0_turret_purple_dir0 for turretAngle=-PI/2 (North)', () => {
    // bodyAngleToDir8(-PI/2) = 6 (North), resolveTurretVisualDir('smoky', 6) = 0
    const expectedKey = getSmokyTurretKey('purple', 0);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'purple', -Math.PI / 2);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_purple_dir0');
  });
});

// ── resolveModularTurretSpriteKey — returns null when texture missing ─

describe('resolveModularTurretSpriteKey — returns null when texture missing', () => {
  it('returns null when the resolved texture key is not loaded', () => {
    // Empty texture registry — nothing exists
    const scene = createMockScene(new Set());
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    expect(result).toBeNull();
  });

  it('returns null when a different texture exists but not the resolved one', () => {
    const wrongKey = getSmokyTurretKey('cyan', 0);  // dir0 instead of dir2
    const scene = createMockScene(new Set([wrongKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    // Resolver wants dir2 (profile remap), but only dir0 is loaded
    expect(result).toBeNull();
  });
});

// ── resolveModularTurretSpriteKey — unsupported weapons ──────────────

describe('resolveModularTurretSpriteKey — unsupported weapons', () => {
  it('returns null for thunder', () => {
    const scene = createMockScene(new Set());
    const result = resolveModularTurretSpriteKey(scene, 'thunder', 'cyan', 0);
    expect(result).toBeNull();
  });

  it('returns null for railgun', () => {
    const scene = createMockScene(new Set());
    const result = resolveModularTurretSpriteKey(scene, 'railgun', 'cyan', 0);
    expect(result).toBeNull();
  });

  it('returns null for empty weaponId', () => {
    const scene = createMockScene(new Set());
    const result = resolveModularTurretSpriteKey(scene, '', 'cyan', 0);
    expect(result).toBeNull();
  });
});

// ── resolveModularTurretSpriteKey — uses turret profile, not hull ────

describe('resolveModularTurretSpriteKey — turret profile, not hull remap', () => {
  it('Smoky turret facing East (dir0) resolves to dir2, not dir4 (hull remap)', () => {
    // Hull remap for dir0 would be dir4 in dir16 space.
    // Turret profile remap for dir0 should be dir2 in dir8 space.
    // The key should contain dir2, confirming the turret profile is used.
    const expectedKey = getSmokyTurretKey('cyan', 2);
    const hullRemappedKey = getSmokyTurretKey('cyan', 4);
    const scene = createMockScene(new Set([expectedKey, hullRemappedKey]));

    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    expect(result).toBe(expectedKey);
    expect(result).not.toBe(hullRemappedKey);
  });

  it('resolveTurretVisualDir is the direction source, not applyHullVisualDir16Remap', () => {
    // Verify the pipeline: turretAngle → bodyAngleToDir8 → resolveTurretVisualDir
    const turretAngle = 0; // East
    const logicalDir8 = bodyAngleToDir8(turretAngle);
    expect(logicalDir8).toBe(0);

    const visualDir8 = resolveTurretVisualDir('smoky', logicalDir8);
    expect(visualDir8).toBe(2); // turret facingOffset=2, not hull's +4
  });
});
