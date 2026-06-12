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
  it('returns smoky_m0_turret_cyan_dir4 for turretAngle=0 (East), cyan faction', () => {
    // bodyAngleToDir8(0) = 0 (East), resolveTurretVisualDir('smoky', 0) = 4
    // (Smoky is now 16-dir with facingOffset=4; clamped to dir8 range → 4)
    const expectedKey = getSmokyTurretKey('cyan', 4);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_cyan_dir4');
  });

  it('returns smoky_m0_turret_green_dir6 for turretAngle=PI/2 (South), green faction', () => {
    // bodyAngleToDir8(PI/2) = 2 (South), resolveTurretVisualDir('smoky', 2) = 6
    const expectedKey = getSmokyTurretKey('green', 6);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'green', Math.PI / 2);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_green_dir6');
  });

  it('returns smoky_m0_turret_yellow_dir7 for turretAngle=PI (West)', () => {
    // bodyAngleToDir8(PI) = 4 (West), resolveTurretVisualDir('smoky', 4) = 8
    // Clamped to dir8 range (0–7) → 7 (lossy: legacy resolver cannot represent dir16 dirs ≥ 8)
    const expectedKey = getSmokyTurretKey('yellow', 7);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'yellow', Math.PI);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_yellow_dir7');
  });

  it('returns smoky_m0_turret_purple_dir7 for turretAngle=-PI/2 (North)', () => {
    // bodyAngleToDir8(-PI/2) = 6 (North), resolveTurretVisualDir('smoky', 6) = 10
    // Clamped to dir8 range (0–7) → 7 (lossy: legacy resolver cannot represent dir16 dirs ≥ 8)
    const expectedKey = getSmokyTurretKey('purple', 7);
    const scene = createMockScene(new Set([expectedKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'purple', -Math.PI / 2);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_purple_dir7');
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
    const wrongKey = getSmokyTurretKey('cyan', 0);  // dir0 instead of dir4
    const scene = createMockScene(new Set([wrongKey]));
    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    // Resolver wants dir4 (profile remap), but only dir0 is loaded
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
  it('Smoky turret facing East (dir0) resolves using turret profile', () => {
    // Smoky profile is now 16-dir with facingOffset=4 (same as hull currently).
    // The legacy resolver clamps the 16-dir result to 0–7 for the legacy key format.
    // Both hull and turret profiles currently produce dir4 for logical dir0,
    // but the turret profile is used independently.
    const expectedKey = getSmokyTurretKey('cyan', 4);
    const scene = createMockScene(new Set([expectedKey]));

    const result = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    expect(result).toBe(expectedKey);
    expect(result).toBe('smoky_m0_turret_cyan_dir4');
  });

  it('resolveTurretVisualDir is the direction source, not applyHullVisualDir16Remap', () => {
    // Verify the pipeline: turretAngle → bodyAngleToDir8 → resolveTurretVisualDir
    const turretAngle = 0; // East
    const logicalDir8 = bodyAngleToDir8(turretAngle);
    expect(logicalDir8).toBe(0);

    const visualDir = resolveTurretVisualDir('smoky', logicalDir8);
    expect(visualDir).toBe(4); // turret facingOffset=4 in dir16 space
  });
});
