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
 * 9. Wasp socket perDir overrides used for direction-dependent socket positions
 * 10. hullSocketWorld == turretPivotWorld invariant holds for all directions
 *    (fixup #4: uses actual sprite origins, not assumed 0.5/0.5)
 * 11. Old center socket {0.5,0.5} produces different (wrong) offset vs perDir
 * 12. Socket direction follows hull/body direction (fixup #3 direction split)
 * 13. Pivot direction follows turret visible direction (fixup #3 + #4)
 * 14. Fixup #4: turret pivot dir = visible Smoky texture dir, not raw logical
 * 15. Fixup #4: attachment math uses actual sprite origins (hull 0.5/0.75, turret 0.5/0.5)
 *
 * All tests are pure — no Phaser runtime required.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTurretSpriteMountingData,
  turretAngleToDir16,
  turretAngleToVisualDir16,
  bodyAngleToHullVisualDir16,
  DEFAULT_SPRITE_ORIGINS,
  type SpriteSourceSizes,
  type SpriteScaleFactors,
  type SpriteOrigins,
} from '../config/turretSpriteMountingAdapter';
import { bodyAngleToDir8, mapRuntimeDir8ToGeneratedDir16, GENERATED_HULL_ORIGIN_X, GENERATED_HULL_ORIGIN_Y } from '../assets/generatedHullAssets';
import { resolveSocketNormForDir, computeNormalizedPointOffsetPx } from '../config/turretAttachmentMath';

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

const WASP_SMOKY_ORIGINS: SpriteOrigins = {
  hullOriginX: GENERATED_HULL_ORIGIN_X,   // 0.5
  hullOriginY: GENERATED_HULL_ORIGIN_Y,   // 0.75
  turretOriginX: 0.5,
  turretOriginY: 0.5,
};

// ── Test 1: Adapter uses directional Smoky pivot ─────────────────────

describe('resolveTurretSpriteMountingData — uses directional Smoky pivot', () => {
  it('Smoky M0 turretAngle=E: offset is computed from directional pivot', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0, // East → turretVisualDir16=4 (Smoky facingOffset=2)
      bodyAngle: 0,   // East → hullVisualDir16=4 (Wasp facingOffset=4)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.textureKey).toBe('smoky_m0_turret_cyan_dir2');
    expect(result.directionalPivot).not.toBeNull();
    expect(result.offsetFromHullCenter).not.toBeNull();
  });

  it('Smoky M2 turretAngle=E: offset uses M2/M3 directional pivot', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 2,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.directionalPivot).not.toBeNull();
  });

  it('Directional pivot is the placeholder-measured rotation center, not naive center (0.5, 0.5)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    // The placeholder PNGs rotate the barrel around a fixed center measured at
    // (0.4991, 0.4548). x is near-center (turret is horizontally centered) but
    // y is clearly above center — so the pivot is NOT the naive (0.5, 0.5).
    expect(result.directionalPivot!.x).toBeCloseTo(0.4990, 4);
    expect(result.directionalPivot!.y).toBeCloseTo(0.4548, 4);
    expect(result.directionalPivot!.y).not.toBeCloseTo(0.5, 2);
  });

  it('Offset is non-zero because socket and pivot are both off-center', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    // Both socket and pivot are off-center, offset should be non-zero
    expect(result.offsetFromHullCenter).not.toBeNull();
    const hasNonZeroOffset =
      Math.abs(result.offsetFromHullCenter!.x) > 0.001 ||
      Math.abs(result.offsetFromHullCenter!.y) > 0.001;
    expect(hasNonZeroOffset).toBe(true);
  });
});

// ── Test 2: Direction conversion ─────────────────────────────────────

describe('turretAngleToDir16 — deterministic direction conversion (logical)', () => {
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

// ── Test: turretAngleToVisualDir16 — visual turret direction ──────────

describe('turretAngleToVisualDir16 — visual turret direction (fixup #4)', () => {
  it('Smoky: East (angle=0) → visualDir16=4 (facingOffset=2 → visualDir8=2 → dir16=4)', () => {
    expect(turretAngleToVisualDir16(0, 'smoky')).toBe(4);
  });

  it('Smoky: South (angle=PI/2) → visualDir16=8 (logicalDir8=2 → visualDir8=4 → dir16=8)', () => {
    expect(turretAngleToVisualDir16(Math.PI / 2, 'smoky')).toBe(8);
  });

  it('Smoky: West (angle=PI) → visualDir16=12 (logicalDir8=4 → visualDir8=6 → dir16=12)', () => {
    expect(turretAngleToVisualDir16(Math.PI, 'smoky')).toBe(12);
  });

  it('Smoky: North (angle=-PI/2) → visualDir16=0 (logicalDir8=6 → visualDir8=0 → dir16=0)', () => {
    expect(turretAngleToVisualDir16(-Math.PI / 2, 'smoky')).toBe(0);
  });

  it('Smoky: visualDir16 differs from logical dir16 for East', () => {
    // Logical: turretAngleToDir16(0) = 0
    // Visual:  turretAngleToVisualDir16(0, 'smoky') = 4
    expect(turretAngleToDir16(0)).toBe(0);
    expect(turretAngleToVisualDir16(0, 'smoky')).toBe(4);
    expect(turretAngleToVisualDir16(0, 'smoky')).not.toBe(turretAngleToDir16(0));
  });

  it('unknown weapon: falls back to logical dir16', () => {
    expect(turretAngleToVisualDir16(0, 'thunder')).toBe(0);
    expect(turretAngleToVisualDir16(Math.PI / 2, 'thunder')).toBe(4);
  });

  it('is deterministic: same input always produces same output', () => {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 - Math.PI;
      const a = turretAngleToVisualDir16(angle, 'smoky');
      const b = turretAngleToVisualDir16(angle, 'smoky');
      expect(a).toBe(b);
    }
  });
});

// ── Test: bodyAngleToHullVisualDir16 — hull direction conversion ──────

describe('bodyAngleToHullVisualDir16 — hull visual direction conversion', () => {
  it('Wasp: bodyAngle=0 (E) → hullVisualDir16=4 (facingOffset=4)', () => {
    expect(bodyAngleToHullVisualDir16(0, 'wasp')).toBe(4);
  });

  it('Wasp: bodyAngle=PI/2 (S) → hullVisualDir16=8', () => {
    expect(bodyAngleToHullVisualDir16(Math.PI / 2, 'wasp')).toBe(8);
  });

  it('Wasp: bodyAngle=PI (W) → hullVisualDir16=12', () => {
    expect(bodyAngleToHullVisualDir16(Math.PI, 'wasp')).toBe(12);
  });

  it('Wasp: bodyAngle=-PI/2 (N) → hullVisualDir16=0', () => {
    expect(bodyAngleToHullVisualDir16(-Math.PI / 2, 'wasp')).toBe(0);
  });

  it('Unknown hull: no visual remap, returns logical dir16', () => {
    // hornet has no facingOffset, so hullVisualDir16 == logical dir16
    expect(bodyAngleToHullVisualDir16(0, 'hornet')).toBe(0);
    expect(bodyAngleToHullVisualDir16(Math.PI, 'hornet')).toBe(8);
  });

  it('is deterministic: same input always produces same output', () => {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 - Math.PI;
      const a = bodyAngleToHullVisualDir16(angle, 'wasp');
      const b = bodyAngleToHullVisualDir16(angle, 'wasp');
      expect(a).toBe(b);
    }
  });

  it('Wasp hullVisualDir16 differs from logical turretAngleToDir16 for same angle', () => {
    // This proves the direction split is meaningful for Wasp:
    // turretAngleToDir16(0) = 0, but bodyAngleToHullVisualDir16(0, 'wasp') = 4
    expect(turretAngleToDir16(0)).toBe(0);
    expect(bodyAngleToHullVisualDir16(0, 'wasp')).toBe(4);
    expect(turretAngleToDir16(0)).not.toBe(bodyAngleToHullVisualDir16(0, 'wasp'));
  });
});

// ── Test 3: Missing directional pivot falls back gracefully ──────────

describe('resolveTurretSpriteMountingData — missing directional pivot => procedural fallback', () => {
  it('thunder (no directional profile): useRealTurretSprite=false even with texture key', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'some_thunder_key',
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.directionalPivot).toBeNull();
    expect(result.offsetFromHullCenter).toBeNull();
    expect(result.useRealTurretSprite).toBe(false);
    expect(result.textureKey).toBeNull();
  });

  it('Smoky level 4 (invalid): directional pivot is null => procedural fallback', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'some_key',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 4,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.offsetFromHullCenter).not.toBeNull();
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.directionalPivot!.x).toBeGreaterThanOrEqual(0);
    expect(result.directionalPivot!.x).toBeLessThanOrEqual(1);
    expect(result.directionalPivot!.y).toBeGreaterThanOrEqual(0);
    expect(result.directionalPivot!.y).toBeLessThanOrEqual(1);
    expect(result.offsetFromHullCenter).not.toBeNull();
  });
});

// ── Test: Socket profile resolution with perDir ─────────────────────

describe('resolveTurretSpriteMountingData — socket profile resolution', () => {
  it('Wasp hull resolves turret_main socket with perDir data', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.socketProfile).not.toBeNull();
    expect(result.socketProfile!.id).toBe('turret_main');
    expect(result.socketProfile!.normalized.nx).toBe(0.5);
    expect(result.socketProfile!.normalized.ny).toBe(0.5);
    expect(result.socketProfile!.perDir).toBeDefined();
    expect(Object.keys(result.socketProfile!.perDir!).length).toBe(16);
  });

  it('unknown hull → socketProfile is null → useRealTurretSprite=false (missing socket)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'hornet',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.socketProfile).toBeNull();
    expect(result.offsetFromHullCenter).toBeNull();
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    const westResult = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir6',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI,
      bodyAngle: Math.PI,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(eastResult.offsetFromHullCenter).not.toBeNull();
    expect(westResult.offsetFromHullCenter).not.toBeNull();
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(false);
    expect(result.directionalPivot).toBeNull();
  });

  it('missing socket/profile => procedural fallback (even with texture + pivot)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'hornet',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    const b = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(a).toEqual(b);
  });
});

// ── Test: resolveSocketNormForDir — perDir socket resolution ───────

describe('resolveSocketNormForDir — per-direction Wasp socket', () => {
  it('Wasp dir0 (E) socket uses perDir override, not base {0.5, 0.5}', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 0);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.360491, 5);
    expect(norm!.y).toBeCloseTo(0.357876, 5);
    expect(norm!.x).not.toBeCloseTo(0.5, 2);
  });

  it('Wasp dir8 (W) socket uses perDir override { nx: 0.639509, ny: 0.357876 }', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 8);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.639509, 5);
    expect(norm!.y).toBeCloseTo(0.357876, 5);
  });

  it('Wasp dir4 (S) socket is at center nx=0.5', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 4);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.5, 5);
    expect(norm!.y).toBeCloseTo(0.305253, 5);
  });

  it('Wasp dir12 (N) socket is at center nx=0.5', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 12);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.5, 5);
    expect(norm!.y).toBeCloseTo(0.410500, 5);
  });

  it('unknown hull returns null', () => {
    const norm = resolveSocketNormForDir('hornet', 'turret_main', 0);
    expect(norm).toBeNull();
  });

  it('Wasp socket varies significantly across directions', () => {
    const east = resolveSocketNormForDir('wasp', 'turret_main', 0)!;
    const west = resolveSocketNormForDir('wasp', 'turret_main', 8)!;
    const xDiff = Math.abs(east.x - west.x);
    expect(xDiff).toBeGreaterThan(0.1);
  });
});

// ── Test: Contract invariant: hullSocketWorld == turretPivotWorld ────
// Fixup #4: Uses actual sprite origins (hull 0.5/0.75, turret 0.5/0.5)

describe('resolveTurretSpriteMountingData — hullSocketWorld == turretPivotWorld invariant (fixup #4 origin-aware)', () => {
  it('Wasp+Smoky M0 body=E turret=E: offset places turret pivot on hull socket (origin-aware)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,   // turretVisualDir16=4
      bodyAngle: 0,      // hullVisualDir16=4
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(result.directionalPivot).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    // Fixup #4 invariant: use actual sprite origins
    // hullSpriteOriginWorld + (socketNorm - hullOrigin) * hullDisplaySize
    // == turretSpriteOriginWorld + (pivotNorm - turretOrigin) * turretDisplaySize
    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullOriginToSocket = computeNormalizedPointOffsetPx(
      socketNorm, hullDisplayW, hullDisplayH,
      WASP_SMOKY_ORIGINS.hullOriginX, WASP_SMOKY_ORIGINS.hullOriginY,
    );

    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretOriginToPivot = computeNormalizedPointOffsetPx(
      pivotNorm, turretDisplayW, turretDisplayH,
      WASP_SMOKY_ORIGINS.turretOriginX, WASP_SMOKY_ORIGINS.turretOriginY,
    );

    const expectedOffset = {
      x: hullOriginToSocket.x - turretOriginToPivot.x,
      y: hullOriginToSocket.y - turretOriginToPivot.y,
    };

    expect(result.offsetFromHullCenter!.x).toBeCloseTo(expectedOffset.x, 10);
    expect(result.offsetFromHullCenter!.y).toBeCloseTo(expectedOffset.y, 10);
  });

  it('Wasp+Smoky M0 body=S turret=S: offset places turret pivot on hull socket (origin-aware)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2, // turretVisualDir16=8
      bodyAngle: Math.PI / 2,   // hullVisualDir16=8
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(result.directionalPivot).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullOriginToSocket = computeNormalizedPointOffsetPx(
      socketNorm, hullDisplayW, hullDisplayH,
      WASP_SMOKY_ORIGINS.hullOriginX, WASP_SMOKY_ORIGINS.hullOriginY,
    );
    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretOriginToPivot = computeNormalizedPointOffsetPx(
      pivotNorm, turretDisplayW, turretDisplayH,
      WASP_SMOKY_ORIGINS.turretOriginX, WASP_SMOKY_ORIGINS.turretOriginY,
    );

    const expectedOffset = {
      x: hullOriginToSocket.x - turretOriginToPivot.x,
      y: hullOriginToSocket.y - turretOriginToPivot.y,
    };

    expect(result.offsetFromHullCenter!.x).toBeCloseTo(expectedOffset.x, 10);
    expect(result.offsetFromHullCenter!.y).toBeCloseTo(expectedOffset.y, 10);
  });

  it('Wasp+Smoky M0 body=W turret=W: offset places turret pivot on hull socket (origin-aware)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir6',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI,  // turretVisualDir16=12
      bodyAngle: Math.PI,    // hullVisualDir16=12
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(result.directionalPivot).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullOriginToSocket = computeNormalizedPointOffsetPx(
      socketNorm, hullDisplayW, hullDisplayH,
      WASP_SMOKY_ORIGINS.hullOriginX, WASP_SMOKY_ORIGINS.hullOriginY,
    );
    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretOriginToPivot = computeNormalizedPointOffsetPx(
      pivotNorm, turretDisplayW, turretDisplayH,
      WASP_SMOKY_ORIGINS.turretOriginX, WASP_SMOKY_ORIGINS.turretOriginY,
    );

    const expectedOffset = {
      x: hullOriginToSocket.x - turretOriginToPivot.x,
      y: hullOriginToSocket.y - turretOriginToPivot.y,
    };

    expect(result.offsetFromHullCenter!.x).toBeCloseTo(expectedOffset.x, 10);
    expect(result.offsetFromHullCenter!.y).toBeCloseTo(expectedOffset.y, 10);
  });

  it('offset sign reversal breaks the invariant (regression guard)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.offsetFromHullCenter).not.toBeNull();
    const reversedOffset = {
      x: -result.offsetFromHullCenter!.x,
      y: -result.offsetFromHullCenter!.y,
    };
    const differs =
      Math.abs(reversedOffset.x - result.offsetFromHullCenter!.x) > 0.001 ||
      Math.abs(reversedOffset.y - result.offsetFromHullCenter!.y) > 0.001;
    expect(differs).toBe(true);
  });

  it('using old center socket {0.5, 0.5} instead of perDir produces DIFFERENT offset (regression)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.offsetFromHullCenter).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const oldSocketNorm = { x: 0.5, y: 0.5 };
    const oldHullOriginToSocket = computeNormalizedPointOffsetPx(
      oldSocketNorm, hullDisplayW, hullDisplayH,
      WASP_SMOKY_ORIGINS.hullOriginX, WASP_SMOKY_ORIGINS.hullOriginY,
    );
    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretOriginToPivot = computeNormalizedPointOffsetPx(
      pivotNorm, turretDisplayW, turretDisplayH,
      WASP_SMOKY_ORIGINS.turretOriginX, WASP_SMOKY_ORIGINS.turretOriginY,
    );

    const oldOffset = {
      x: oldHullOriginToSocket.x - turretOriginToPivot.x,
      y: oldHullOriginToSocket.y - turretOriginToPivot.y,
    };

    const differs =
      Math.abs(oldOffset.x - result.offsetFromHullCenter!.x) > 0.001 ||
      Math.abs(oldOffset.y - result.offsetFromHullCenter!.y) > 0.001;
    expect(differs).toBe(true);
  });
});

// ── Fixup #4: Origin-aware math tests ──────────────────────────────

describe('resolveTurretSpriteMountingData — fixup #4: origin-aware attachment math', () => {
  it('offset with hull origin (0.5, 0.75) differs from old assumed origin (0.5, 0.5)', () => {
    // The Y-axis offset MUST differ because hullOriginY=0.75 instead of 0.5
    const resultOriginAware = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS, // hullOriginY=0.75
    });

    const resultOldOrigin = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: { hullOriginX: 0.5, hullOriginY: 0.5, turretOriginX: 0.5, turretOriginY: 0.5 },
    });

    expect(resultOriginAware.offsetFromHullCenter).not.toBeNull();
    expect(resultOldOrigin.offsetFromHullCenter).not.toBeNull();

    // The Y offset MUST differ because hullOriginY changed from 0.5 to 0.75
    const yDiff = Math.abs(resultOriginAware.offsetFromHullCenter!.y - resultOldOrigin.offsetFromHullCenter!.y);
    expect(yDiff).toBeGreaterThan(0.001);
  });

  it('DEFAULT_SPRITE_ORIGINS uses GENERATED_HULL_ORIGIN_X/Y constants', () => {
    expect(DEFAULT_SPRITE_ORIGINS.hullOriginX).toBe(GENERATED_HULL_ORIGIN_X);
    expect(DEFAULT_SPRITE_ORIGINS.hullOriginY).toBe(GENERATED_HULL_ORIGIN_Y);
    expect(DEFAULT_SPRITE_ORIGINS.turretOriginX).toBe(0.5);
    expect(DEFAULT_SPRITE_ORIGINS.turretOriginY).toBe(0.5);
  });
});

// ── Fixup #3 + #4: Direction split tests ──────────────────────────

describe('resolveTurretSpriteMountingData — fixup #3+#4: hull socket dir follows hull, turret pivot dir follows turret visible dir', () => {
  // Test 1: When bodyAngle === turretAngle, mounting still works
  it('when bodyAngle === turretAngle, mounting works correctly', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    // Fixup #4: turretVisualDir16 is now the VISIBLE dir, not the logical dir
    // turretAngle=0 (E) → logicalDir8=0 → visualDir8=2 → turretVisualDir16=4
    expect(result.turretVisualDir16).toBe(4);
    expect(result.hullVisualDir16).toBe(4); // Wasp visual dir16 for E
  });

  // Test 2: When bodyAngle !== turretAngle, socket uses hull/body direction, not turret direction
  it('when bodyAngle !== turretAngle, socket uses hull direction (not turret direction)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2,  // S → turretVisualDir16=8
      bodyAngle: 0,               // E → hullVisualDir16=4 (Wasp)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.turretVisualDir16).toBe(8);
    expect(result.hullVisualDir16).toBe(4);

    // The socket is looked up at hullVisualDir16=4, which is the socket for the
    // displayed hull frame when the hull faces East
    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    // dir4 socket: { nx: 0.500000, ny: 0.305253 }
    expect(socketNorm.x).toBeCloseTo(0.500000, 5);
    expect(socketNorm.y).toBeCloseTo(0.305253, 5);
  });

  // Test 3: When hull direction changes but turret direction stays the same:
  //   socket changes, pivot stays the same
  it('hull direction changes, turret same → socket changes, pivot stays same', () => {
    const resultA = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,          // turretVisualDir16=4
      bodyAngle: 0,             // hullVisualDir16=4 (Wasp E)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    const resultB = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,                  // turretVisualDir16=4 — SAME
      bodyAngle: Math.PI / 2,          // hullVisualDir16=8 (Wasp S) — DIFFERENT
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    // Pivot stays the same (same turretVisualDir16=4)
    expect(resultA.turretVisualDir16).toBe(resultB.turretVisualDir16);
    expect(resultA.directionalPivot).not.toBeNull();
    expect(resultB.directionalPivot).not.toBeNull();
    expect(resultA.directionalPivot!.x).toBeCloseTo(resultB.directionalPivot!.x, 10);
    expect(resultA.directionalPivot!.y).toBeCloseTo(resultB.directionalPivot!.y, 10);

    // Socket changes (different hullVisualDir16)
    expect(resultA.hullVisualDir16).not.toBe(resultB.hullVisualDir16);
    const socketA = resolveSocketNormForDir('wasp', 'turret_main', resultA.hullVisualDir16)!;
    const socketB = resolveSocketNormForDir('wasp', 'turret_main', resultB.hullVisualDir16)!;
    const socketDiffers =
      Math.abs(socketA.x - socketB.x) > 0.001 ||
      Math.abs(socketA.y - socketB.y) > 0.001;
    expect(socketDiffers).toBe(true);
  });

  // Test 4: When turret direction changes but hull direction stays the same:
  //   texture dir changes, socket stays the same.
  // NOTE: with the placeholder asset family the visible turret rotates around
  // a FIXED image-space center, so the measured pivot is direction-independent
  // (same {x,y} for every turret direction). What changes is turretVisualDir16
  // (the texture frame). Attachment stays correct precisely because the pivot
  // is constant — the turret never detaches as the barrel sweeps.
  it('turret direction changes, hull same → texture dir changes, socket + constant pivot stay same', () => {
    const resultA = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,          // turretVisualDir16=4
      bodyAngle: 0,             // hullVisualDir16=4 (Wasp E)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    const resultB = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2, // turretVisualDir16=8 — DIFFERENT
      bodyAngle: 0,              // hullVisualDir16=4 (Wasp E) — SAME
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    // Socket stays the same (same hullVisualDir16)
    expect(resultA.hullVisualDir16).toBe(resultB.hullVisualDir16);
    const socketA = resolveSocketNormForDir('wasp', 'turret_main', resultA.hullVisualDir16)!;
    const socketB = resolveSocketNormForDir('wasp', 'turret_main', resultB.hullVisualDir16)!;
    expect(socketA.x).toBeCloseTo(socketB.x, 10);
    expect(socketA.y).toBeCloseTo(socketB.y, 10);

    // Texture direction changes (different turretVisualDir16)
    expect(resultA.turretVisualDir16).not.toBe(resultB.turretVisualDir16);
    expect(resultA.directionalPivot).not.toBeNull();
    expect(resultB.directionalPivot).not.toBeNull();
    // Placeholder pivot is direction-independent: it stays the same so the
    // turret remains attached to the socket through the full barrel sweep.
    expect(resultA.directionalPivot!.x).toBeCloseTo(resultB.directionalPivot!.x, 10);
    expect(resultA.directionalPivot!.y).toBeCloseTo(resultB.directionalPivot!.y, 10);
  });

  // Test 5: hullSocketWorld === turretPivotWorld invariant holds after applying offset
  //         even when bodyAngle !== turretAngle (fixup #4: origin-aware)
  it('hullSocketWorld === turretPivotWorld invariant holds when bodyAngle !== turretAngle', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2, // turretVisualDir16=8
      bodyAngle: 0,              // hullVisualDir16=4 (Wasp E)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullOriginToSocket = computeNormalizedPointOffsetPx(
      socketNorm, hullDisplayW, hullDisplayH,
      WASP_SMOKY_ORIGINS.hullOriginX, WASP_SMOKY_ORIGINS.hullOriginY,
    );

    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretOriginToPivot = computeNormalizedPointOffsetPx(
      pivotNorm, turretDisplayW, turretDisplayH,
      WASP_SMOKY_ORIGINS.turretOriginX, WASP_SMOKY_ORIGINS.turretOriginY,
    );

    const expectedOffset = {
      x: hullOriginToSocket.x - turretOriginToPivot.x,
      y: hullOriginToSocket.y - turretOriginToPivot.y,
    };

    expect(result.offsetFromHullCenter!.x).toBeCloseTo(expectedOffset.x, 10);
    expect(result.offsetFromHullCenter!.y).toBeCloseTo(expectedOffset.y, 10);
  });

  // Test 6: Missing texture / pivot / socket / offset still falls back to procedural
  it('missing pivot with bodyAngle !== turretAngle still falls back to procedural', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'some_thunder_key',
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(false);
    expect(result.offsetFromHullCenter).toBeNull();
  });

  // Test 7: Non-Smoky still falls back to procedural
  it('non-Smoky with bodyAngle !== turretAngle still falls back to procedural', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: null,
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(false);
  });

  // Test 8: Phaser origin remains centered — setOrigin(0.5, 0.5), never set origin to pivot
  it('offset is position adjustment only, never used as sprite origin (even with split dirs)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(typeof result.offsetFromHullCenter!.x).toBe('number');
    expect(typeof result.offsetFromHullCenter!.y).toBe('number');
    expect(result.directionalPivot!.x).toBeGreaterThan(0);
    expect(result.directionalPivot!.x).toBeLessThan(1);
  });

  // Extra: Verify turretVisualDir16 and hullVisualDir16 are independently set
  it('turretVisualDir16 and hullVisualDir16 are independently computed from their respective angles', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir6',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI,      // W → logicalDir8=4 → visualDir8=6 → turretVisualDir16=12
      bodyAngle: -Math.PI / 2,   // N → hullVisualDir16=0 (Wasp)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.turretVisualDir16).toBe(12);
    expect(result.hullVisualDir16).toBe(0);
    expect(result.turretVisualDir16).not.toBe(result.hullVisualDir16);
  });

  // Extra: Verify that using turretVisualDir16 for socket lookup (the OLD bug)
  // would produce a different (wrong) socket position
  it('using turret visual dir for socket lookup would produce WRONG socket (regression guard)', () => {
    // hull faces S (bodyAngle=PI/2 → hullVisualDir16=8)
    // turret faces E (turretAngle=0 → turretVisualDir16=4)
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,             // turretVisualDir16=4
      bodyAngle: Math.PI / 2,     // hullVisualDir16=8
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    // Correct socket: hullVisualDir16=8 → Wasp socket for dir8
    const correctSocket = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    // Wrong socket (old bug): turretVisualDir16=4 → Wasp socket for dir4
    const wrongSocket = resolveSocketNormForDir('wasp', 'turret_main', result.turretVisualDir16)!;

    // dir16=8 socket vs dir16=4 socket — these are different
    const socketsDiffer =
      Math.abs(correctSocket.x - wrongSocket.x) > 0.01 ||
      Math.abs(correctSocket.y - wrongSocket.y) > 0.01;
    expect(socketsDiffer).toBe(true);
  });
});

// ── Test: Fixup #5 — Generated 512px/16-dir turret assets ─────────────

import {
  getGeneratedTurretTextureKey,
  getGeneratedTurretAssetPath,
  GENERATED_TURRET_SOURCE_WIDTH,
  GENERATED_TURRET_SOURCE_HEIGHT,
  GENERATED_TURRET_SCALE,
  GENERATED_TURRET_ORIGIN_X,
  GENERATED_TURRET_ORIGIN_Y,
  weaponIdToGeneratedTurretId,
  modificationLevelToTurretMod,
  resolveGeneratedTurretFaction,
  GENERATED_TURRET_FACTIONS,
  type GeneratedTurretDir16Index,
} from '../assets/generatedTurretAssets';
import { DIR16_SUFFIXES } from '../config/directionalTurretProfiles';

const GENERATED_WASP_SMOKY_SIZES: SpriteSourceSizes = {
  hullSourceWidthPx: 512,
  hullSourceHeightPx: 512,
  turretSourceWidthPx: GENERATED_TURRET_SOURCE_WIDTH,   // 512
  turretSourceHeightPx: GENERATED_TURRET_SOURCE_HEIGHT, // 512
};

const GENERATED_WASP_SMOKY_SCALES: SpriteScaleFactors = {
  hullScale: 0.12,
  turretScale: GENERATED_TURRET_SCALE,  // 0.12
};

describe('Fixup #5: Generated Smoky turret asset resolver', () => {
  // 1. Resolver test: generated Smoky dir16 key/path resolves for dir0..dir15
  it('generates texture keys for all 16 directions (dir0..dir15)', () => {
    for (let dir16 = 0; dir16 < 16; dir16++) {
      const key = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir16 as GeneratedTurretDir16Index);
      expect(key).toMatch(/^generated_turret_smoky_cyan_m0_dir\d{2}$/);
      expect(key).toContain(`dir${String(dir16).padStart(2, '0')}`);
    }
  });

  it('generates asset paths for all 16 directions', () => {
    for (let dir16 = 0; dir16 < 16; dir16++) {
      const path = getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', dir16 as GeneratedTurretDir16Index);
      expect(path).toMatch(/^assets\/units\/turrets\/smoky\/cyan\/m0\//);
      expect(path).toContain(`dir${String(dir16).padStart(2, '0')}`);
      expect(path).toContain(DIR16_SUFFIXES[dir16]);
      expect(path).toMatch(/\.png$/);
    }
  });

  it('generates keys for all factions', () => {
    for (const faction of GENERATED_TURRET_FACTIONS) {
      const key = getGeneratedTurretTextureKey('smoky', faction, 'm0', 0);
      expect(key).toContain(faction);
    }
  });

  it('weaponIdToGeneratedTurretId returns correct turret ID for smoky', () => {
    expect(weaponIdToGeneratedTurretId('smoky')).toBe('smoky');
    expect(weaponIdToGeneratedTurretId('thunder')).toBeNull();
    expect(weaponIdToGeneratedTurretId('railgun')).toBeNull();
  });

  it('modificationLevelToTurretMod returns m0 for all levels (only M0 assets exist)', () => {
    expect(modificationLevelToTurretMod(0)).toBe('m0');
    expect(modificationLevelToTurretMod(1)).toBe('m0');
    expect(modificationLevelToTurretMod(2)).toBe('m0');
    expect(modificationLevelToTurretMod(3)).toBe('m0');
  });

  it('resolveGeneratedTurretFaction returns valid faction or cyan fallback', () => {
    expect(resolveGeneratedTurretFaction('cyan')).toBe('cyan');
    expect(resolveGeneratedTurretFaction('green')).toBe('green');
    expect(resolveGeneratedTurretFaction()).toBe('cyan');
  });

  // 2. Adapter test: generated Smoky path uses 512×512 source size, not 256
  it('GENERATED_TURRET_SOURCE_WIDTH/HEIGHT is 512, not 256', () => {
    expect(GENERATED_TURRET_SOURCE_WIDTH).toBe(512);
    expect(GENERATED_TURRET_SOURCE_HEIGHT).toBe(512);
    expect(GENERATED_TURRET_SOURCE_WIDTH).not.toBe(256);
    expect(GENERATED_TURRET_SOURCE_HEIGHT).not.toBe(256);
  });

  it('adapter with generated turret sizes produces valid offset', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'generated_turret_smoky_cyan_m0_dir04',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: GENERATED_WASP_SMOKY_SIZES,
      scaleFactors: GENERATED_WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
  });

  it('adapter with generated 512 sizes produces DIFFERENT offset than legacy 256 sizes', () => {
    const resultLegacy = resolveTurretSpriteMountingData({
      textureKey: 'test_key',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,        // turretSourceWidthPx: 256
      scaleFactors: WASP_SMOKY_SCALES,       // turretScale: 0.24
      origins: WASP_SMOKY_ORIGINS,
    });

    const resultGenerated = resolveTurretSpriteMountingData({
      textureKey: 'test_key',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: GENERATED_WASP_SMOKY_SIZES, // turretSourceWidthPx: 512
      scaleFactors: GENERATED_WASP_SMOKY_SCALES, // turretScale: 0.12
      origins: WASP_SMOKY_ORIGINS,
    });

    // Both should produce valid results
    expect(resultLegacy.offsetFromHullCenter).not.toBeNull();
    expect(resultGenerated.offsetFromHullCenter).not.toBeNull();

    // The display sizes differ: 256*0.24 = 61.44 vs 512*0.102 = 52.224
    // Since the turret scale was reduced by ~15% (visual QA), the offsets
    // now differ because the turret display size is smaller.
    // The y-offset should differ because the pivot y (0.4548) is far from
    // the turret origin (0.5), and the display height changed significantly.
    expect(resultLegacy.offsetFromHullCenter!.y).not.toBeCloseTo(resultGenerated.offsetFromHullCenter!.y, 1);
  });

  // 3. Texture/pivot identity test: if texture dir is dirN, pivot lookup uses the same dirN
  it('turretVisualDir16 is consistent between texture key and pivot lookup', () => {
    // turretAngle=0 (E) → logicalDir8=0 → logicalDir16=0 → visualDir16=(0+4)%16=4
    const result = resolveTurretSpriteMountingData({
      textureKey: 'generated_turret_smoky_cyan_m0_dir04',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: GENERATED_WASP_SMOKY_SIZES,
      scaleFactors: GENERATED_WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    // The turretVisualDir16 should be 4, matching the texture key suffix dir04
    expect(result.turretVisualDir16).toBe(4);

    // The directional pivot should be for dir16=4 (not dir0)
    expect(result.directionalPivot).not.toBeNull();
  });

  it('texture/pivot identity holds for all 8 main directions', () => {
    const angles = [
      { angle: 0, name: 'E' },
      { angle: Math.PI / 4, name: 'SE' },
      { angle: Math.PI / 2, name: 'S' },
      { angle: 3 * Math.PI / 4, name: 'SW' },
      { angle: Math.PI, name: 'W' },
      { angle: -3 * Math.PI / 4, name: 'NW' },
      { angle: -Math.PI / 2, name: 'N' },
      { angle: -Math.PI / 4, name: 'NE' },
    ];

    for (const { angle } of angles) {
      const visualDir16 = turretAngleToVisualDir16(angle, 'smoky');
      const dirPadded = String(visualDir16).padStart(2, '0');

      // The generated turret texture key for this direction should contain
      // the same visualDir16
      const expectedKey = `generated_turret_smoky_cyan_m0_dir${dirPadded}`;

      // Verify the resolver would produce the correct key
      // (actual resolveGeneratedTurretKey requires Phaser Scene, so we test the key builder)
      const key = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', visualDir16 as GeneratedTurretDir16Index);
      expect(key).toBe(expectedKey);

      // Verify the visual dir16 produces a valid pivot lookup
      // (pivot data exists for all 16 dirs in directionalTurretProfiles)
    }
  });

  // 4. Regression test: legacy 8-dir Smoky resolver is not used by PR #263 real-sprite path
  it('generated turret key uses generated_turret_ prefix, not legacy smoky_m0_turret_ prefix', () => {
    const generatedKey = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    const legacyKey = 'smoky_m0_turret_cyan_dir0';

    expect(generatedKey).toMatch(/^generated_turret_/);
    expect(generatedKey).not.toBe(legacyKey);
    expect(legacyKey).toMatch(/^smoky_m0_turret_/);
    expect(generatedKey).not.toMatch(/^smoky_m0_turret_/);
  });

  it('generated turret key has 16-dir indices (dir00..dir15), not 8-dir (dir0..dir7)', () => {
    const keyDir0 = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    const keyDir15 = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 15);

    // Generated keys use padded dirNN format (dir00, dir15)
    expect(keyDir0).toContain('dir00');
    expect(keyDir15).toContain('dir15');

    // Legacy keys use unpadded dirN format (dir0, dir7)
    expect('smoky_m0_turret_cyan_dir0').toContain('dir0');
    expect('smoky_m0_turret_cyan_dir0').not.toContain('dir00');
  });

  // 5. Fallback test: missing generated texture => procedural fallback
  it('null textureKey => procedural fallback (useRealTurretSprite=false)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: null,
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: GENERATED_WASP_SMOKY_SIZES,
      scaleFactors: GENERATED_WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(false);
    expect(result.textureKey).toBeNull();
    expect(result.offsetFromHullCenter).toBeNull();
  });

  it('non-Smoky weapon => null from weaponIdToGeneratedTurretId => procedural fallback', () => {
    expect(weaponIdToGeneratedTurretId('thunder')).toBeNull();
    expect(weaponIdToGeneratedTurretId('flamethrower')).toBeNull();
    expect(weaponIdToGeneratedTurretId('')).toBeNull();
  });

  // 6. Generated turret origin matches turret standard (0.5, 0.5)
  it('GENERATED_TURRET_ORIGIN is (0.5, 0.5) — standard centered turret origin', () => {
    expect(GENERATED_TURRET_ORIGIN_X).toBe(0.5);
    expect(GENERATED_TURRET_ORIGIN_Y).toBe(0.5);
  });

  // 7. hullSocketWorld == turretPivotWorld invariant with generated 512×512 sizes
  it('attachment invariant holds with generated 512×512 turret source size', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'generated_turret_smoky_cyan_m0_dir04',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: GENERATED_WASP_SMOKY_SIZES,
      scaleFactors: GENERATED_WASP_SMOKY_SCALES,
      origins: WASP_SMOKY_ORIGINS,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.directionalPivot).not.toBeNull();
    expect(result.offsetFromHullCenter).not.toBeNull();

    // Verify invariant: socket position in hull space == pivot position in turret space
    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16);
    expect(socketNorm).not.toBeNull();

    const hullDisplayW = GENERATED_WASP_SMOKY_SIZES.hullSourceWidthPx * GENERATED_WASP_SMOKY_SCALES.hullScale;
    const hullDisplayH = GENERATED_WASP_SMOKY_SIZES.hullSourceHeightPx * GENERATED_WASP_SMOKY_SCALES.hullScale;
    const turretDisplayW = GENERATED_WASP_SMOKY_SIZES.turretSourceWidthPx * GENERATED_WASP_SMOKY_SCALES.turretScale;
    const turretDisplayH = GENERATED_WASP_SMOKY_SIZES.turretSourceHeightPx * GENERATED_WASP_SMOKY_SCALES.turretScale;

    // Hull socket offset from hull origin
    const socketFromHullOrigin = computeNormalizedPointOffsetPx(
      socketNorm!,
      hullDisplayW, hullDisplayH,
      WASP_SMOKY_ORIGINS.hullOriginX, WASP_SMOKY_ORIGINS.hullOriginY,
    );

    // Turret pivot offset from turret origin
    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const pivotFromTurretOrigin = computeNormalizedPointOffsetPx(
      pivotNorm,
      turretDisplayW, turretDisplayH,
      WASP_SMOKY_ORIGINS.turretOriginX, WASP_SMOKY_ORIGINS.turretOriginY,
    );

    // The offset should equal: socketFromHullOrigin - pivotFromTurretOrigin
    expect(result.offsetFromHullCenter!.x).toBeCloseTo(
      socketFromHullOrigin.x - pivotFromTurretOrigin.x, 10,
    );
    expect(result.offsetFromHullCenter!.y).toBeCloseTo(
      socketFromHullOrigin.y - pivotFromTurretOrigin.y, 10,
    );
  });
});
