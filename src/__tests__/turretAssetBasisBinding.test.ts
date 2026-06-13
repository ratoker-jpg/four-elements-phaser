/**
 * PR #263 root-cause regression tests: turret pivot profile must be bound to
 * the SAME asset family (basis) as the texture the renderer actually loads.
 *
 * Background:
 * The Smoky turret detached from the Wasp hull because the runtime mixed
 *   - placeholder PNGs (legacy 8-dir art upscaled to 512×512 / 16-dir,
 *     whose visible turret rotates around a FIXED image center ≈ {0.499,0.455})
 * with
 *   - v12 *projection* pivot data (a per-direction wobbling ellipse measured
 *     for a different, never-shipped render family).
 * The v12 pivot is off by ~18px and flips sides as the turret turns, so the
 * turret floated beside the hull.
 *
 * These tests catch that class of bug:
 *  1. Asset-basis binding   — profile basis == texture resolver basis
 *  2. Texture size          — adapter/profile dims == real PNG dims (512×512)
 *  3. Direction identity     — texture dirN label == pivot dirN label
 *  4. Anchor invariant       — pivot lands on socket using runtime origins
 *  5. Regression guard       — adapter never uses a different-family pivot
 *  6. Fallback               — missing basis-matched profile ⇒ procedural
 *
 * All pure TS + fs; no Phaser runtime required.
 */

import { describe, it, expect } from 'vitest';
import {
  GENERATED_TURRET_ASSET_BASIS,
  getGeneratedTurretAssetBasis,
  getGeneratedTurretAssetPath,
  GENERATED_TURRET_SOURCE_WIDTH,
  GENERATED_TURRET_SOURCE_HEIGHT,
  GENERATED_TURRET_SCALE,
  type GeneratedTurretDir16Index,
} from '../assets/generatedTurretAssets';
import {
  SMOKY_PLACEHOLDER_BASIS,
  SMOKY_V12_PROJECTION_BASIS,
  SMOKY_M01_PLACEHOLDER_PROFILE,
  SMOKY_M01_DIRECTIONAL_PROFILE,
  resolveDirectionalProfileForBasis,
  resolveTurretPivotForDirByBasis,
  resolveTurretPivotForDir,
  DIR16_SUFFIXES,
} from '../config/directionalTurretProfiles';
import {
  resolveTurretSpriteMountingData,
  turretAngleToVisualDir16,
  type SpriteSourceSizes,
  type SpriteScaleFactors,
  type SpriteOrigins,
} from '../config/turretSpriteMountingAdapter';
import {
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
  GENERATED_HULL_SCALE,
  GENERATED_HULL_DIRECTIONS_16,
} from '../assets/generatedHullAssets';
import { resolveSocketNormForDir } from '../config/turretAttachmentMath';

// Runtime values actually used by BlockoutVehicleRenderer for Wasp+Smoky.
const RUNTIME_SIZES: SpriteSourceSizes = {
  hullSourceWidthPx: 512,
  hullSourceHeightPx: 512,
  turretSourceWidthPx: GENERATED_TURRET_SOURCE_WIDTH,
  turretSourceHeightPx: GENERATED_TURRET_SOURCE_HEIGHT,
};
const RUNTIME_SCALES: SpriteScaleFactors = {
  hullScale: GENERATED_HULL_SCALE,
  turretScale: GENERATED_TURRET_SCALE,
};
const RUNTIME_ORIGINS: SpriteOrigins = {
  hullOriginX: GENERATED_HULL_ORIGIN_X,
  hullOriginY: GENERATED_HULL_ORIGIN_Y,
  turretOriginX: 0.5,
  turretOriginY: 0.5,
};

// ── 1. Asset-basis binding ──────────────────────────────────────────

describe('PR#263 / asset-basis binding', () => {
  it('texture resolver basis == placeholder pivot profile basis', () => {
    expect(getGeneratedTurretAssetBasis('smoky')).toBe(GENERATED_TURRET_ASSET_BASIS);
    expect(SMOKY_PLACEHOLDER_BASIS).toBe(GENERATED_TURRET_ASSET_BASIS);
    expect(SMOKY_M01_PLACEHOLDER_PROFILE.assetBasis).toBe(GENERATED_TURRET_ASSET_BASIS);
  });

  it('a profile exists for the texture family the renderer loads', () => {
    const basis = getGeneratedTurretAssetBasis('smoky')!;
    const profile = resolveDirectionalProfileForBasis('smoky', 0, basis);
    expect(profile).not.toBeNull();
    expect(profile!.assetBasis).toBe(basis);
  });

  it('the placeholder basis differs from the v12 projection basis', () => {
    expect(SMOKY_PLACEHOLDER_BASIS).not.toBe(SMOKY_V12_PROJECTION_BASIS);
  });

  it('non-generated weapon has no turret asset basis', () => {
    expect(getGeneratedTurretAssetBasis('thunder')).toBeNull();
    expect(getGeneratedTurretAssetBasis('')).toBeNull();
  });
});

// ── 2. Texture size ─────────────────────────────────────────────────

describe('PR#263 / texture size matches adapter + profile assumptions', () => {
  it('adapter source size constants are 512×512', () => {
    expect(GENERATED_TURRET_SOURCE_WIDTH).toBe(512);
    expect(GENERATED_TURRET_SOURCE_HEIGHT).toBe(512);
  });

  it('placeholder profile declares the same 512×512 basis dimensions', () => {
    expect(SMOKY_M01_PLACEHOLDER_PROFILE.sourceWidthPx).toBe(GENERATED_TURRET_SOURCE_WIDTH);
    expect(SMOKY_M01_PLACEHOLDER_PROFILE.sourceHeightPx).toBe(GENERATED_TURRET_SOURCE_HEIGHT);
    expect(SMOKY_M01_PLACEHOLDER_PROFILE.dirCount).toBe(16);
  });

  // The real shipped PNG bytes (512×512) and the measured rotation-center-vs-
  // alpha-bbox guard are verified by tools/check_turret_asset_basis.mjs
  // (npm run qa:turret-assets) which decodes the actual pixels — kept out of
  // vitest because the tsconfig restricts ambient types to vite/client.
});

// ── 3. Direction identity ───────────────────────────────────────────

describe('PR#263 / texture dirN and pivot dirN are the same visible frame', () => {
  it('placeholder pivot dir labels match the generated texture dir labels', () => {
    for (let dir = 0; dir < 16; dir++) {
      const pivot = SMOKY_M01_PLACEHOLDER_PROFILE.pivots[dir];
      expect(pivot.dirIndex).toBe(dir);
      // texture filename suffix for this dir (from hull dir table the turret reuses)
      expect(pivot.dirSuffix).toBe(GENERATED_HULL_DIRECTIONS_16[dir].suffix);
      // and the profile's own suffix table agrees
      expect(pivot.dirSuffix).toBe(DIR16_SUFFIXES[dir]);
    }
  });

  it('the texture path for dirN carries the same compass suffix as pivot dirN', () => {
    for (let dir = 0; dir < 16; dir++) {
      const rel = getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', dir as GeneratedTurretDir16Index);
      expect(rel).toContain(`dir${String(dir).padStart(2, '0')}_${DIR16_SUFFIXES[dir]}.`);
    }
  });
});

// ── 4. Anchor invariant using actual runtime origins ────────────────

describe('PR#263 / anchor invariant: pivot lands on socket (runtime origins)', () => {
  const hullDisplayW = RUNTIME_SIZES.hullSourceWidthPx * RUNTIME_SCALES.hullScale;
  const hullDisplayH = RUNTIME_SIZES.hullSourceHeightPx * RUNTIME_SCALES.hullScale;
  const turretDisplayW = RUNTIME_SIZES.turretSourceWidthPx * RUNTIME_SCALES.turretScale;
  const turretDisplayH = RUNTIME_SIZES.turretSourceHeightPx * RUNTIME_SCALES.turretScale;

  // A synthetic hull-origin world position; the invariant is translation-free.
  const HULL_ORIGIN_WORLD = { x: 1000, y: 700 };

  for (const { turretAngle, bodyAngle, name } of [
    { turretAngle: 0, bodyAngle: 0, name: 'body=E turret=E' },
    { turretAngle: Math.PI / 2, bodyAngle: Math.PI / 2, name: 'body=S turret=S' },
    { turretAngle: Math.PI, bodyAngle: Math.PI, name: 'body=W turret=W' },
    { turretAngle: 0, bodyAngle: Math.PI / 2, name: 'body=S turret=E (independent)' },
    { turretAngle: -Math.PI / 2, bodyAngle: Math.PI, name: 'body=W turret=N (independent)' },
  ]) {
    it(`pivotWorld == socketWorld for ${name}`, () => {
      const result = resolveTurretSpriteMountingData({
        textureKey: 'generated_turret_smoky_cyan_m0_dir04',
        weaponId: 'smoky',
        bodyId: 'wasp',
        modificationLevel: 0,
        turretAngle,
        bodyAngle,
        sourceSizes: RUNTIME_SIZES,
        scaleFactors: RUNTIME_SCALES,
        origins: RUNTIME_ORIGINS,
      });

      expect(result.useRealTurretSprite).toBe(true);
      const pivot = result.directionalPivot!;
      const offset = result.offsetFromHullCenter!;

      // Hull socket in world space (hull sprite uses origin 0.5/0.75).
      const socket = resolveSocketNormForDir('wasp', 'turret_main', result.hullVisualDir16)!;
      const socketWorld = {
        x: HULL_ORIGIN_WORLD.x + (socket.x - RUNTIME_ORIGINS.hullOriginX) * hullDisplayW,
        y: HULL_ORIGIN_WORLD.y + (socket.y - RUNTIME_ORIGINS.hullOriginY) * hullDisplayH,
      };

      // Turret sprite is placed at hullOrigin + offset, origin 0.5/0.5.
      const turretCenterWorld = {
        x: HULL_ORIGIN_WORLD.x + offset.x,
        y: HULL_ORIGIN_WORLD.y + offset.y,
      };
      const pivotWorld = {
        x: turretCenterWorld.x + (pivot.x - RUNTIME_ORIGINS.turretOriginX) * turretDisplayW,
        y: turretCenterWorld.y + (pivot.y - RUNTIME_ORIGINS.turretOriginY) * turretDisplayH,
      };

      expect(pivotWorld.x).toBeCloseTo(socketWorld.x, 9);
      expect(pivotWorld.y).toBeCloseTo(socketWorld.y, 9);
    });
  }

  it('pivot stays attached through a full turret sweep (body fixed)', () => {
    // For a fixed hull, the turret pivot world point must NOT move as the
    // barrel rotates — that is what "attached" means.
    const pivotWorlds: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 16; i++) {
      const turretAngle = (i / 16) * Math.PI * 2 - Math.PI;
      const result = resolveTurretSpriteMountingData({
        textureKey: 'generated_turret_smoky_cyan_m0_dir04',
        weaponId: 'smoky',
        bodyId: 'wasp',
        modificationLevel: 0,
        turretAngle,
        bodyAngle: 0,
        sourceSizes: RUNTIME_SIZES,
        scaleFactors: RUNTIME_SCALES,
        origins: RUNTIME_ORIGINS,
      });
      const pivot = result.directionalPivot!;
      const offset = result.offsetFromHullCenter!;
      pivotWorlds.push({
        x: HULL_ORIGIN_WORLD.x + offset.x + (pivot.x - 0.5) * turretDisplayW,
        y: HULL_ORIGIN_WORLD.y + offset.y + (pivot.y - 0.5) * turretDisplayH,
      });
    }
    for (const pw of pivotWorlds) {
      expect(pw.x).toBeCloseTo(pivotWorlds[0].x, 9);
      expect(pw.y).toBeCloseTo(pivotWorlds[0].y, 9);
    }
  });
});

// ── 5. Regression guard ─────────────────────────────────────────────

describe('PR#263 / renderer must not use a different-family pivot profile', () => {
  it('adapter pivot is the placeholder-measured value, NOT the v12 projection value', () => {
    // turretAngle=0 → visual dir16=4 (S). v12 dir4 pivot is far from placeholder.
    const result = resolveTurretSpriteMountingData({
      textureKey: 'generated_turret_smoky_cyan_m0_dir04',
      weaponId: 'smoky',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: RUNTIME_SIZES,
      scaleFactors: RUNTIME_SCALES,
      origins: RUNTIME_ORIGINS,
    });
    const visualDir16 = turretAngleToVisualDir16(0, 'smoky');
    expect(visualDir16).toBe(4);

    const placeholder = resolveTurretPivotForDirByBasis('smoky', 0, visualDir16, SMOKY_PLACEHOLDER_BASIS)!;
    const v12 = resolveTurretPivotForDir('smoky', 0, visualDir16)!; // legacy resolver → v12

    // Sanity: the two families genuinely disagree for this direction.
    expect(Math.abs(v12.x - placeholder.x)).toBeGreaterThan(0.05);

    // The adapter must have used the placeholder (texture-matched) family.
    expect(result.directionalPivot!.x).toBeCloseTo(placeholder.x, 6);
    expect(result.directionalPivot!.y).toBeCloseTo(placeholder.y, 6);
    expect(result.directionalPivot!.x).not.toBeCloseTo(v12.x, 2);
  });

  it('the v12 pivot wobbles across directions while the placeholder pivot is fixed', () => {
    const placeholderXs = new Set<number>();
    const v12Xs = new Set<number>();
    for (let dir = 0; dir < 16; dir++) {
      placeholderXs.add(Number(resolveTurretPivotForDirByBasis('smoky', 0, dir, SMOKY_PLACEHOLDER_BASIS)!.x.toFixed(4)));
      v12Xs.add(Number(resolveTurretPivotForDir('smoky', 0, dir)!.x.toFixed(4)));
    }
    // Placeholder family: a single fixed rotation center (direction-independent).
    expect(placeholderXs.size).toBe(1);
    // v12 family: a per-direction ellipse (many distinct x values).
    expect(v12Xs.size).toBeGreaterThan(8);
  });

  it('basis selects the family: same dir resolves different pivots per basis', () => {
    const ph = resolveTurretPivotForDirByBasis('smoky', 0, 4, SMOKY_PLACEHOLDER_BASIS)!;
    const v12 = resolveTurretPivotForDirByBasis('smoky', 0, 4, SMOKY_V12_PROJECTION_BASIS)!;
    expect(ph).not.toEqual(v12);
    expect(v12).toEqual(SMOKY_M01_DIRECTIONAL_PROFILE.pivots[4].position);
  });
});

// ── 6. Placeholder pivot regression guard ───────────────────────────

describe('PR#263 / placeholder pivot matches documented measured centroid', () => {
  it('Smoky M0/M1 placeholder pivot y matches alpha-overlap centroid (0.4548, not 0.5145)', () => {
    // The documented measurement is the alpha-overlap centroid of the base ring
    // across all 16 placeholder PNGs: (255.5, 232.8) px = (0.4991, 0.4548).
    // A previous typo stored y=0.5145 instead of 0.4548, causing a constant
    // ~30px downward offset of the turret on the hull.
    const profile = SMOKY_M01_PLACEHOLDER_PROFILE;
    for (const pivot of profile.pivots) {
      expect(pivot.position.x).toBeCloseTo(0.4990, 3);
      expect(pivot.position.y).toBeCloseTo(0.4548, 3);
    }
  });

  it('Smoky M2/M3 placeholder pivot y also matches the measured centroid', () => {
    const profile = resolveDirectionalProfileForBasis('smoky', 2, SMOKY_PLACEHOLDER_BASIS);
    expect(profile).not.toBeNull();
    for (const pivot of profile!.pivots) {
      expect(pivot.position.x).toBeCloseTo(0.4990, 3);
      expect(pivot.position.y).toBeCloseTo(0.4548, 3);
    }
  });

  it('placeholder pivot y is NOT 0.5145 (the typo value)', () => {
    const pivot = resolveTurretPivotForDirByBasis('smoky', 0, 0, SMOKY_PLACEHOLDER_BASIS)!;
    expect(pivot.y).not.toBeCloseTo(0.5145, 3);
  });
});

// ── 7. Fallback ─────────────────────────────────────────────────────

describe('PR#263 / fallback when matching asset/profile data is missing', () => {
  it('resolveTurretPivotForDirByBasis returns null for an unknown basis', () => {
    expect(resolveTurretPivotForDirByBasis('smoky', 0, 0, 'no-such-basis')).toBeNull();
  });

  it('resolveDirectionalProfileForBasis returns null for unknown weapon/level/basis', () => {
    expect(resolveDirectionalProfileForBasis('thunder', 0, SMOKY_PLACEHOLDER_BASIS)).toBeNull();
    expect(resolveDirectionalProfileForBasis('smoky', 9, SMOKY_PLACEHOLDER_BASIS)).toBeNull();
  });

  it('non-Smoky weapon ⇒ no basis ⇒ procedural fallback (no real sprite)', () => {
    const result = resolveTurretSpriteMountingData({
      textureKey: 'some_key',
      weaponId: 'thunder',
      bodyId: 'wasp',
      modificationLevel: 0,
      turretAngle: 0,
      bodyAngle: 0,
      sourceSizes: RUNTIME_SIZES,
      scaleFactors: RUNTIME_SCALES,
      origins: RUNTIME_ORIGINS,
    });
    expect(result.useRealTurretSprite).toBe(false);
    expect(result.directionalPivot).toBeNull();
  });
});
