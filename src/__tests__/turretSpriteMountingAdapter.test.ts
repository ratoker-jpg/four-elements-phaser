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
 * 11. Old center socket {0.5,0.5} produces different (wrong) offset vs perDir
 * 12. Socket direction follows hull/body direction (fixup #3 direction split)
 * 13. Pivot direction follows turret direction (fixup #3 direction split)
 *
 * All tests are pure — no Phaser runtime required.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTurretSpriteMountingData,
  turretAngleToDir16,
  bodyAngleToHullVisualDir16,
  type SpriteSourceSizes,
  type SpriteScaleFactors,
} from '../config/turretSpriteMountingAdapter';
import { bodyAngleToDir8, mapRuntimeDir8ToGeneratedDir16 } from '../assets/generatedHullAssets';
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

// ── Test 1: Adapter uses directional Smoky pivot ─────────────────────

describe('resolveTurretSpriteMountingData — uses directional Smoky pivot', () => {
  it('Smoky M0 dir00_E: offset is computed from directional pivot (px=0.206668, py=0.464846)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0, // East → turretDir16=0
      bodyAngle: 0,   // East → hullVisualDir16=4 (Wasp facingOffset=4)
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
      bodyAngle: 0,
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
      bodyAngle: 0,
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // Directional pivot is NOT the legacy placeholder (0.5, 0.5)
    expect(result.directionalPivot!.x).not.toBeCloseTo(0.5, 2);
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
    });

    // Both socket and pivot are off-center, offset should be non-zero
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

  it('Wasp hullVisualDir16 differs from turretAngleToDir16 for same angle', () => {
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
    });

    expect(a).toEqual(b);
  });
});

// ── Test: resolveSocketNormForDir — perDir socket resolution ───────

describe('resolveSocketNormForDir — per-direction Wasp socket', () => {
  it('Wasp dir0 (E) socket uses perDir override, not base {0.5, 0.5}', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 0);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.401352, 5);
    expect(norm!.y).toBeCloseTo(0.496649, 5);
    expect(norm!.x).not.toBeCloseTo(0.5, 2);
  });

  it('Wasp dir8 (W) socket uses perDir override { nx: 0.598648, ny: 0.422228 }', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 8);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.598648, 5);
    expect(norm!.y).toBeCloseTo(0.422228, 5);
  });

  it('Wasp dir6 (SW) socket is at center nx=0.5', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 6);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.5, 5);
    expect(norm!.y).toBeCloseTo(0.406815, 5);
  });

  it('Wasp dir14 (NE) socket is at center nx=0.5', () => {
    const norm = resolveSocketNormForDir('wasp', 'turret_main', 14);
    expect(norm).not.toBeNull();
    expect(norm!.x).toBeCloseTo(0.5, 5);
    expect(norm!.y).toBeCloseTo(0.512063, 5);
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

describe('resolveTurretSpriteMountingData — hullSocketWorld == turretPivotWorld invariant', () => {
  it('Wasp+Smoky M0 body=E turret=E: offset places turret pivot on hull socket', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,   // turretDir16=0
      bodyAngle: 0,      // hullVisualDir16=4
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(result.directionalPivot).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullCenterToSocket = computeNormalizedPointOffsetPx(socketNorm, hullDisplayW, hullDisplayH);

    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretCenterToPivot = computeNormalizedPointOffsetPx(pivotNorm, turretDisplayW, turretDisplayH);

    const expectedOffset = {
      x: hullCenterToSocket.x - turretCenterToPivot.x,
      y: hullCenterToSocket.y - turretCenterToPivot.y,
    };

    expect(result.offsetFromHullCenter!.x).toBeCloseTo(expectedOffset.x, 10);
    expect(result.offsetFromHullCenter!.y).toBeCloseTo(expectedOffset.y, 10);
  });

  it('Wasp+Smoky M0 body=S turret=S: offset places turret pivot on hull socket', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2, // turretDir16=4
      bodyAngle: Math.PI / 2,   // hullVisualDir16=8
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(result.directionalPivot).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullCenterToSocket = computeNormalizedPointOffsetPx(socketNorm, hullDisplayW, hullDisplayH);
    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretCenterToPivot = computeNormalizedPointOffsetPx(pivotNorm, turretDisplayW, turretDisplayH);

    const expectedOffset = {
      x: hullCenterToSocket.x - turretCenterToPivot.x,
      y: hullCenterToSocket.y - turretCenterToPivot.y,
    };

    expect(result.offsetFromHullCenter!.x).toBeCloseTo(expectedOffset.x, 10);
    expect(result.offsetFromHullCenter!.y).toBeCloseTo(expectedOffset.y, 10);
  });

  it('Wasp+Smoky M0 body=W turret=W: offset places turret pivot on hull socket', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir6',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI,  // turretDir16=8
      bodyAngle: Math.PI,    // hullVisualDir16=12
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(result.directionalPivot).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullCenterToSocket = computeNormalizedPointOffsetPx(socketNorm, hullDisplayW, hullDisplayH);
    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretCenterToPivot = computeNormalizedPointOffsetPx(pivotNorm, turretDisplayW, turretDisplayH);

    const expectedOffset = {
      x: hullCenterToSocket.x - turretCenterToPivot.x,
      y: hullCenterToSocket.y - turretCenterToPivot.y,
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
    });

    expect(result.offsetFromHullCenter).not.toBeNull();

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const oldSocketNorm = { x: 0.5, y: 0.5 };
    const oldHullCenterToSocket = computeNormalizedPointOffsetPx(oldSocketNorm, hullDisplayW, hullDisplayH);
    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretCenterToPivot = computeNormalizedPointOffsetPx(pivotNorm, turretDisplayW, turretDisplayH);

    const oldOffset = {
      x: oldHullCenterToSocket.x - turretCenterToPivot.x,
      y: oldHullCenterToSocket.y - turretCenterToPivot.y,
    };

    const differs =
      Math.abs(oldOffset.x - result.offsetFromHullCenter!.x) > 0.001 ||
      Math.abs(oldOffset.y - result.offsetFromHullCenter!.y) > 0.001;
    expect(differs).toBe(true);
  });
});

// ── Fixup #3: Direction split tests ──────────────────────────────────

describe('resolveTurretSpriteMountingData — fixup #3: hull socket dir follows hull, turret pivot dir follows turret', () => {
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
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.turretDir16).toBe(0);   // E logical dir16
    expect(result.hullVisualDir16).toBe(4); // Wasp visual dir16 for E
  });

  // Test 2: When bodyAngle !== turretAngle, socket uses hull/body direction, not turret direction
  it('when bodyAngle !== turretAngle, socket uses hull direction (not turret direction)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2,  // S → turretDir16=4
      bodyAngle: 0,               // E → hullVisualDir16=4 (Wasp)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.turretDir16).toBe(4);
    expect(result.hullVisualDir16).toBe(4);

    // The socket is looked up at hullVisualDir16=4, which is the socket for the
    // displayed hull frame when the hull faces East
    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    // dir4 socket: { nx: 0.401352, ny: 0.422228 }
    expect(socketNorm.x).toBeCloseTo(0.401352, 5);
    expect(socketNorm.y).toBeCloseTo(0.422228, 5);
  });

  // Test 3: When hull direction changes but turret direction stays the same:
  //   socket changes, pivot stays the same
  it('hull direction changes, turret same → socket changes, pivot stays same', () => {
    const resultA = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,          // turretDir16=0 (E)
      bodyAngle: 0,             // hullVisualDir16=4 (Wasp E)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    const resultB = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,                  // turretDir16=0 (E) — SAME
      bodyAngle: Math.PI / 2,          // hullVisualDir16=8 (Wasp S) — DIFFERENT
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // Pivot stays the same (same turretDir16=0)
    expect(resultA.turretDir16).toBe(resultB.turretDir16);
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
  //   pivot changes, socket stays the same
  it('turret direction changes, hull same → pivot changes, socket stays same', () => {
    const resultA = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,          // turretDir16=0 (E)
      bodyAngle: 0,             // hullVisualDir16=4 (Wasp E)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    const resultB = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2, // turretDir16=4 (S) — DIFFERENT
      bodyAngle: 0,              // hullVisualDir16=4 (Wasp E) — SAME
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // Socket stays the same (same hullVisualDir16)
    expect(resultA.hullVisualDir16).toBe(resultB.hullVisualDir16);
    const socketA = resolveSocketNormForDir('wasp', 'turret_main', resultA.hullVisualDir16)!;
    const socketB = resolveSocketNormForDir('wasp', 'turret_main', resultB.hullVisualDir16)!;
    expect(socketA.x).toBeCloseTo(socketB.x, 10);
    expect(socketA.y).toBeCloseTo(socketB.y, 10);

    // Pivot changes (different turretDir16)
    expect(resultA.turretDir16).not.toBe(resultB.turretDir16);
    expect(resultA.directionalPivot).not.toBeNull();
    expect(resultB.directionalPivot).not.toBeNull();
    const pivotDiffers =
      Math.abs(resultA.directionalPivot!.x - resultB.directionalPivot!.x) > 0.001 ||
      Math.abs(resultA.directionalPivot!.y - resultB.directionalPivot!.y) > 0.001;
    expect(pivotDiffers).toBe(true);
  });

  // Test 5: hullSocketWorld === turretPivotWorld invariant holds after applying offset
  //         even when bodyAngle !== turretAngle
  it('hullSocketWorld === turretPivotWorld invariant holds when bodyAngle !== turretAngle', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir4',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI / 2, // turretDir16=4
      bodyAngle: 0,              // hullVisualDir16=4 (Wasp E)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.useRealTurretSprite).toBe(true);

    const hullDisplayW = 512 * 0.12;
    const hullDisplayH = 512 * 0.12;
    const turretDisplayW = 256 * 0.24;
    const turretDisplayH = 256 * 0.24;

    const socketNorm = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    const hullCenterToSocket = computeNormalizedPointOffsetPx(socketNorm, hullDisplayW, hullDisplayH);

    const pivotNorm = { x: result.directionalPivot!.x, y: result.directionalPivot!.y };
    const turretCenterToPivot = computeNormalizedPointOffsetPx(pivotNorm, turretDisplayW, turretDisplayH);

    const expectedOffset = {
      x: hullCenterToSocket.x - turretCenterToPivot.x,
      y: hullCenterToSocket.y - turretCenterToPivot.y,
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
    });

    expect(result.useRealTurretSprite).toBe(true);
    expect(result.offsetFromHullCenter).not.toBeNull();
    expect(typeof result.offsetFromHullCenter!.x).toBe('number');
    expect(typeof result.offsetFromHullCenter!.y).toBe('number');
    expect(result.directionalPivot!.x).toBeGreaterThan(0);
    expect(result.directionalPivot!.x).toBeLessThan(1);
  });

  // Extra: Verify turretDir16 and hullVisualDir16 are independently set
  it('turretDir16 and hullVisualDir16 are independently computed from their respective angles', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir6',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: Math.PI,      // W → turretDir16=8
      bodyAngle: -Math.PI / 2,   // N → hullVisualDir16=0 (Wasp)
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    expect(result.turretDir16).toBe(8);
    expect(result.hullVisualDir16).toBe(0);
    expect(result.turretDir16).not.toBe(result.hullVisualDir16);
  });

  // Extra: Verify that using turretAngle for socket lookup (the OLD bug)
  // would produce a different (wrong) socket position
  it('using turret dir for socket lookup would produce WRONG socket (regression guard)', () => {
    // Use angles where turretDir16 !== hullVisualDir16 to expose the old bug:
    // hull faces S (bodyAngle=PI/2 → hullVisualDir16=8)
    // turret faces E (turretAngle=0 → turretDir16=0)
    const result = resolveTurretSpriteMountingData({
      textureKey: 'smoky_m0_turret_cyan_dir2',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,             // turretDir16=0
      bodyAngle: Math.PI / 2,     // hullVisualDir16=8
      sourceSizes: WASP_SMOKY_SIZES,
      scaleFactors: WASP_SMOKY_SCALES,
    });

    // Correct socket: hullVisualDir16=8 → Wasp socket for dir8
    const correctSocket = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
    // Wrong socket (old bug): turretDir16=0 → Wasp socket for dir0
    const wrongSocket = resolveSocketNormForDir('wasp', 'turret_main', result.turretDir16)!;

    // dir16=8 socket vs dir16=0 socket — these are very different
    const socketsDiffer =
      Math.abs(correctSocket.x - wrongSocket.x) > 0.01 ||
      Math.abs(correctSocket.y - wrongSocket.y) > 0.01;
    expect(socketsDiffer).toBe(true);
  });
});
