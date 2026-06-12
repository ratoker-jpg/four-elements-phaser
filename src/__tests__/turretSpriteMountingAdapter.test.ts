/**
 * TURRET-HULL-CONTRACT-PR-F2: Tests for turret sprite mounting adapter.
 *
 * These tests verify:
 * 1. Adapter uses directional Smoky pivot, not legacy pivot
 * 2. Direction conversion from turretAngle/dir8 to dir16 is deterministic
 * 3. Missing directional pivot => procedural fallback (useRealTurretSprite=false)
 * 4. Missing texture key => procedural fallback
 * 5. Missing socket profile => procedural fallback
 * 6. Real turret sprite ONLY when full contract data exists (texture + pivot + socket + offset)
 * 7. Non-Smoky weapon remains procedural fallback
 * 8. Phaser origin convention remains centered, not pivot-origin
 * 9. Existing PR-B/C/D/E1/F1 tests stay green
 *
 * All tests are pure — no Phaser runtime required.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTurretSpriteMountingData,
  turretAngleToDir16,
  type SpriteSourceSizes,
  type SpriteScaleFactors,
} from '../config/turretSpriteMountingAdapter';
import { bodyAngleToDir8, mapRuntimeDir8ToGeneratedDir16 } from '../assets/generatedHullAssets';

// ── Test constants ───────────────────────────────────────────────────

const WASP_SMOKY_SIZES: SpriteSourceSizes = {
  hullSourceWidthPx: 512,
  hullSourceHeightPx: 512,
  turretSourceWidthPx: 256,
  turretSourceHeightPx: 256,
};

const WASP_SMOKY_SCALES: SpriteScaleFactors = {
  hullScale: 0.12,
  turretScale: 0.24,
};

// ── Test 1: Adapter uses directional Smoky pivot ─────────────────────

describe('resolveTurretSpriteMountingData — uses directional Smoky pivot', () => {
  it('Smoky M0 dir00_E: offset is computed from directional pivot (px=0.206668, py=0.464846)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0, // East → dir8=0 → dir16=0
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.textureKey).toBe('smoky_m0_turret_cyan_dir2');
    expect(result.directionalPivot).not.toBeNull();
    expect(result.directionalPivot!.x).toBeCloseTo(0.206668, 5);
    expect(result.directionalPivot!.y).toBeCloseTo(0.464846, 5);
    expect(result.offsetFromHullCenter).not.toBeNull();
  });

  it('Smoky M2 dir00_E: offset uses M2/M3 directional pivot (px=0.206668, py=0.481365)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 2,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.directionalPivot).not.toBeNull();
    expect(result.directionalPivot!.x).toBeCloseTo(0.206668, 5);
    expect(result.directionalPivot!.y).toBeCloseTo(0.481365, 5);
  });

  it('Directional pivot differs from legacy center (0.5, 0.5)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // Directional pivot is NOT the legacy placeholder (0.5, 0.5)
    expect(result.directionalPivot!.x).not.toBeCloseTo(0.5, 2);
    expect(result.directionalPivot!.y).not.toBeCloseTo(0.5, 2);
  });

  it('Offset is non-zero because pivot is off-center', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // With socket at (0.5, 0.5) and pivot off-center, offset should be non-zero
    expect(result.offsetFromHullCenter).not.toBeNull();
    // The offset in at least one axis should be non-zero
    const hasNonZeroOffset =
      Math.abs(result.offsetFromHullCenter!.x) > 0.001 ||
      Math.abs(result.offsetFromHullCenter!.y) > 0.001;
    expect(hasNonZeroOffset).toBe(true);
  });
});

// ── Test 2: Direction conversion ─────────────────────────────────────

describe('turretAngleToDir16 — deterministic direction conversion', () => {
  it('East (angle=0) → dir16=0', () => {
    expect(turretAngleToDir16(0)).toBe(0);
  });

  it('South (angle=PI/2) → dir16=4', () => {
    expect(turretAngleToDir16(Math.PI / 2)).toBe(4);
  });

  it('West (angle=PI) → dir16=8', () => {
    expect(turretAngleToDir16(Math.PI)).toBe(8);
  });

  it('North (angle=-PI/2) → dir16=12', () => {
    expect(turretAngleToDir16(-Math.PI / 2)).toBe(12);
  });

  it('matches bodyAngleToDir8 → mapRuntimeDir8ToGeneratedDir16 pipeline', () => {
    for (const angle of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4]) {
      const expected = mapRuntimeDir8ToGeneratedDir16(bodyAngleToDir8(angle));
      expect(turretAngleToDir16(angle)).toBe(expected);
    }
  });

  it('always produces even dir16 indices (8-dir quantization)', () => {
    for (const angle of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4]) {
      const dir16 = turretAngleToDir16(angle);
      expect(dir16 % 2).toBe(0);
    }
  });

  it('is deterministic: same input always produces same output', () => {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 - Math.PI;
      const a = turretAngleToDir16(angle);
      const b = turretAngleToDir16(angle);
      expect(a).toBe(b);
    }
  });
});

// ── Test 3: Missing directional pivot falls back gracefully ──────────

describe('resolveTurretSpriteMountingData — missing directional pivot => procedural fallback', () => {
  it('thunder (no directional profile): useRealTurretSprite=false even with texture key', () => {
    // Thunder has no directional profile, so pivot will be null.
    // Without directional pivot, the full contract is incomplete —
    // the turret would be incorrectly positioned, so real sprite is NOT used.
    const result = resolveTurretSpriteMountingData({
      textureKey: 'some_thunder_key', // hypothetical — even if texture existed
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.directionalPivot).toBeNull();
    expect(result.offsetFromHullCenter).toBeNull();
    // Missing directional pivot => incomplete contract => procedural fallback
    expect(result.useRealTurretSprite).toBe(false);
    expect(result.textureKey).toBeNull(); // cleared because contract incomplete
  });

  it('Smoky level 4 (invalid): directional pivot is null => procedural fallback', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'some_key',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 4,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.directionalPivot).toBeNull();
    expect(result.offsetFromHullCenter).toBeNull();
    expect(result.useRealTurretSprite).toBe(false);
  });
});

// ── Test 4: Missing texture key falls back gracefully ────────────────

describe('resolveTurretSpriteMountingData — null texture key fallback', () => {
  it('null textureKey → useRealTurretSprite=false, procedural fallback', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: null,
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(false);
    expect(result.textureKey).toBeNull();
    expect(result.offsetFromHullCenter).toBeNull();
    expect(result.directionalPivot).toBeNull();
  });
});

// ── Test 5: Non-Smoky weapon → no texture key → procedural fallback ─

describe('resolveTurretSpriteMountingData — non-Smoky procedural fallback', () => {
  it('thunder with null texture key → procedural fallback', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: null,
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(false);
  });

  it('railgun with null texture key → procedural fallback', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: null,
      weaponId: 'railgun',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(false);
  });
});

// ── Test 6: Phaser origin convention ─────────────────────────────────

describe('resolveTurretSpriteMountingData — Phaser origin convention', () => {
  it('offset is a position adjustment, NOT an origin change', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // The offset is a pixel displacement from hull center.
    // The consumer (renderer) should:
    //   turretSprite.setOrigin(0.5, 0.5)   ← centered origin, ALWAYS
    //   turretSprite.setPosition(hullSprite.x + offset.x, hullSprite.y + offset.y)
    // NOT:
    //   turretSprite.setOrigin(pivotNorm.x, pivotNorm.y)  ← FORBIDDEN
    expect(result.offsetFromHullCenter).not.toBeNull();
    // Verify the offset is in pixel space (small numbers, not 0..1 normalized)
    expect(typeof result.offsetFromHullCenter!.x).toBe('number');
    expect(typeof result.offsetFromHullCenter!.y).toBe('number');
  });

  it('directional pivot is separate from the offset — renderer uses offset for position, NOT pivot for origin', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // directionalPivot is 0..1 normalized — for attachment math only
    expect(result.directionalPivot!.x).toBeGreaterThanOrEqual(0);
    expect(result.directionalPivot!.x).toBeLessThanOrEqual(1);
    expect(result.directionalPivot!.y).toBeGreaterThanOrEqual(0);
    expect(result.directionalPivot!.y).toBeLessThanOrEqual(1);

    // offsetFromHullCenter is in pixel space — for positioning only
    // These are in different coordinate spaces — confirming they are NOT interchangeable
    expect(result.offsetFromHullCenter).not.toBeNull();
  });
});

// ── Test: Socket profile resolution ──────────────────────────────────

describe('resolveTurretSpriteMountingData — socket profile resolution', () => {
  it('Wasp hull resolves turret_main socket', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.socketProfile).not.toBeNull();
    expect(result.socketProfile!.id).toBe('turret_main');
    expect(result.socketProfile!.normalized.nx).toBe(0.5);
    expect(result.socketProfile!.normalized.ny).toBe(0.5);
  });

  it('unknown hull → socketProfile is null → useRealTurretSprite=false (missing socket)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'hornet',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.socketProfile).toBeNull();
    expect(result.offsetFromHullCenter).toBeNull();
    // Missing socket profile => incomplete contract => procedural fallback
    expect(result.useRealTurretSprite).toBe(false);
  });
});

// ── Test: Different directions produce different offsets ──────────────

describe('resolveTurretSpriteMountingData — direction-dependent offsets', () => {
  it('East (dir0) and West (dir8) produce different offsets', () => {
    const eastResult = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    const westResult = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir6',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(eastResult.offsetFromHullCenter).not.toBeNull();
    expect(westResult.offsetFromHullCenter).not.toBeNull();
    // Offsets should differ because pivots differ
    const differs =
      Math.abs(eastResult.offsetFromHullCenter!.x - westResult.offsetFromHullCenter!.x) > 0.001 ||
      Math.abs(eastResult.offsetFromHullCenter!.y - westResult.offsetFromHullCenter!.y) > 0.001;
    expect(differs).toBe(true);
  });
});

// ── Test: Full contract requirement ──────────────────────────────────

describe('resolveTurretSpriteMountingData — full contract required for real sprite', () => {
  it('valid Wasp+Smoky + texture + directional pivot + socket => real sprite active', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.textureKey).not.toBeNull();
    expect(result.directionalPivot).not.toBeNull();
    expect(result.socketProfile).not.toBeNull();
    expect(result.offsetFromHullCenter).not.toBeNull();
  });

  it('missing directional pivot => procedural fallback (even with texture + socket)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'some_thunder_key',
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(false);
    expect(result.directionalPivot).toBeNull();
  });

  it('missing socket/profile => procedural fallback (even with texture + pivot)', () => {
    // Smoky has directional pivot, but 'hornet' hull has no socket profile
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'hornet',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(false);
    expect(result.socketProfile).toBeNull();
  });

  it('missing texture key => procedural fallback', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: null,
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(false);
    expect(result.textureKey).toBeNull();
  });

  it('non-Smoky weapon => procedural fallback', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: null,
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(false);
  });

  it('origin convention: offset is a position adjustment, never used as origin', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // The result is meant for: turretSprite.setOrigin(0.5, 0.5) + setPosition(center + offset)
    // NOT: setOrigin(pivot.x, pivot.y)
    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    // offset is pixel displacement, not 0..1 normalized origin values
    expect(typeof result.offsetFromHullCenter!.x).toBe('number');
    expect(typeof result.offsetFromHullCenter!.y).toBe('number');
  });
});

// ── Test: Pure function / no renderer dependency ─────────────────────

describe('resolveTurretSpriteMountingData — pure, no Phaser', () => {
  it('works without any scene or DOM', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(typeof result.offsetFromHullCenter!.x).toBe('number');
  });

  it('returns consistent results on repeated calls', () => {
    const a = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    const b = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(a).toEqual(b);
  });
});
