/**
 * TURRET-HULL-CONTRACT-PR-F2: Pure adapter for turret sprite mounting data.
 *
 * This module computes the pixel offset needed to position a turret sprite
 * on a hull using directional pivot profiles and socket/pivot attachment math.
 *
 * It is pure TypeScript — no Phaser imports, no runtime state. The renderer
 * consumes the result to position the turret sprite image.
 *
 * Direction split (fixup #3):
 * - Turret pivot direction (turretVisualDir16) comes from turretAngle
 *   via the turret's own visual direction remap (facingOffset).
 * - Hull socket direction (hullVisualDir16) comes from bodyAngle
 *   and must match the generated hull texture frame actually displayed.
 * - These are separate because the turret can rotate independently from the hull.
 *
 * Fixup #4 — two corrections:
 * 1. Turret pivot dir = visible Smoky texture dir, not raw logical turret dir.
 *    The pivot must be looked up at the dir16 that corresponds to the VISIBLE
 *    texture, not the raw logical direction. For Smoky with facingOffset=2 in
 *    dir8 space, the visual dir8 is (logicalDir8 + 2) % 8, and the visual
 *    dir16 for pivot lookup is visualDir8 * 2.
 * 2. Attachment math uses actual sprite origins:
 *    - Hull origin = (GENERATED_HULL_ORIGIN_X, GENERATED_HULL_ORIGIN_Y) = (0.5, 0.75)
 *    - Turret origin = (0.5, 0.5)
 *    Invariant: hullSpriteOriginWorld + (socketNorm - hullOrigin) * hullDisplaySize
 *               == turretSpriteOriginWorld + (pivotNorm - turretOrigin) * turretDisplaySize
 *
 * Convention:
 * - Phaser sprite origin: hull uses setOrigin(0.5, 0.75), turret uses setOrigin(0.5, 0.5)
 * - Pivot values are consumed through attachment/offset math
 * - Pivot values must NOT automatically become Phaser sprite origin
 *
 * Source: PR #262 directional Smoky profile data + turretAttachmentMath.ts
 */

import {
  bodyAngleToDir8,
  mapRuntimeDir8ToGeneratedDir16,
  applyHullVisualDir16Remap,
  bodyIdToGeneratedHullId,
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
} from '../assets/generatedHullAssets';
import { resolveTurretPivotForDirByBasis } from './directionalTurretProfiles';
import type { DirectionalPoint2D } from './directionalTurretProfiles';
import { getGeneratedTurretAssetBasis } from '../assets/generatedTurretAssets';
import type { SocketProfile } from './hullTurretVisualProfiles';
import { resolveTurretVisualDir, resolveTurretVisualProfile } from './hullTurretVisualProfiles';
import { resolveHullSocketProfile, resolveSocketNormForDir } from './turretAttachmentMath';
import {
  computeTurretSpriteCenterOffsetForSocket,
  type PixelOffset,
} from './turretAttachmentMath';

// ── Types ────────────────────────────────────────────────────────────

/** Source sizes for hull and turret sprites in pixels. */
export interface SpriteSourceSizes {
  /** Hull sprite source width (e.g. 512 for generated hulls). */
  hullSourceWidthPx: number;
  /** Hull sprite source height (e.g. 512 for generated hulls). */
  hullSourceHeightPx: number;
  /** Turret sprite source width (e.g. 512 for generated Smoky turret sprites). */
  turretSourceWidthPx: number;
  /** Turret sprite source height (e.g. 512 for generated Smoky turret sprites). */
  turretSourceHeightPx: number;
}

/** Scale factors for hull and turret sprites. */
export interface SpriteScaleFactors {
  /** Hull sprite scale factor (e.g. 0.12 for generated hulls). */
  hullScale: number;
  /** Turret sprite scale factor (e.g. 0.12 for generated Smoky turret at 512px). */
  turretScale: number;
}

/** Sprite origin configuration for attachment math. */
export interface SpriteOrigins {
  /** Hull sprite origin X (normalized 0..1). Default: GENERATED_HULL_ORIGIN_X = 0.5. */
  hullOriginX: number;
  /** Hull sprite origin Y (normalized 0..1). Default: GENERATED_HULL_ORIGIN_Y = 0.75. */
  hullOriginY: number;
  /** Turret sprite origin X (normalized 0..1). Always 0.5 for centered turrets. */
  turretOriginX: number;
  /** Turret sprite origin Y (normalized 0..1). Always 0.5 for centered turrets. */
  turretOriginY: number;
}

/** Default sprite origins for generated hull + modular turret. */
export const DEFAULT_SPRITE_ORIGINS: SpriteOrigins = {
  hullOriginX: GENERATED_HULL_ORIGIN_X,   // 0.5
  hullOriginY: GENERATED_HULL_ORIGIN_Y,   // 0.75
  turretOriginX: 0.5,
  turretOriginY: 0.5,
};

/** Complete mounting data resolved for a turret sprite. */
export interface TurretSpriteMountingData {
  /** Texture key for the turret sprite, or null if no real sprite available. */
  textureKey: string | null;

  /** Pixel offset from hull sprite position to turret sprite position.
   *  null if mounting cannot be computed (missing socket or pivot).
   *  Apply this as: turretSprite.setPosition(hullSprite.x + offset.x, hullSprite.y + offset.y)
   *
   *  Fixup #4: The offset accounts for actual sprite origins (hull origin 0.5/0.75,
   *  turret origin 0.5/0.5). The invariant is:
   *    hullSpriteOriginWorld + (socketNorm - hullOrigin) * hullDisplaySize
   *    == turretSpriteOriginWorld + (pivotNorm - turretOrigin) * turretDisplaySize
   */
  offsetFromHullCenter: PixelOffset | null;

  /** The directional pivot position used for mounting (null if fallback/unsupported). */
  directionalPivot: DirectionalPoint2D | null;

  /** The hull socket profile used (null if no profile). */
  socketProfile: SocketProfile | null;

  /** The turret visual dir16 index used for directional pivot lookup.
   *  Fixup #4: This is the VISIBLE texture direction, not the raw logical direction.
   *  Derived from turretAngle via: logicalDir8 → visualDir8 (with turret facingOffset) → visualDir16.
   */
  turretVisualDir16: number;

  /** The hull visual dir16 index used for socket lookup (from bodyAngle, matches displayed hull frame). */
  hullVisualDir16: number;

  /** Whether a real turret sprite should be rendered (vs procedural fallback). */
  useRealTurretSprite: boolean;
}

// ── Direction conversion ─────────────────────────────────────────────

/**
 * Convert a turret angle (radians, screen-space) to a logical dir16 index.
 *
 * Pipeline:
 * 1. Quantize turretAngle to logical dir8 via bodyAngleToDir8
 * 2. Double dir8 to get logical dir16 (even indices only: 0,2,4,...,14)
 *
 * This is the RAW LOGICAL direction — does NOT apply the turret's visual
 * direction remap (facingOffset). For pivot lookup, use
 * turretAngleToVisualDir16() instead.
 *
 * Deterministic: same input always produces the same output.
 */
export function turretAngleToDir16(turretAngle: number): number {
  const dir8 = bodyAngleToDir8(turretAngle);
  return mapRuntimeDir8ToGeneratedDir16(dir8);
}

/**
 * Convert a turret angle (radians, screen-space) to the visual dir16 index
 * that matches the displayed turret texture direction.
 *
 * Fixup #4: The pivot must be looked up at the dir16 that corresponds
 * to the VISIBLE texture, not the raw logical direction.
 *
 * Fixup #5: The pipeline now handles both 8-dir (legacy) and 16-dir
 * (generated) turret profiles correctly:
 *
 * For 8-dir profiles (legacy, e.g. old Smoky):
 *   Pipeline: logicalDir8 → visualDir8 (remap in dir8) → visualDir16 (* 2)
 *   Example: logicalDir8=0 → visualDir8=(0+2)%8=2 → visualDir16=2*2=4
 *
 * For 16-dir profiles (generated, e.g. new Smoky):
 *   Pipeline: logicalDir8 → logicalDir16 (* 2) → visualDir16 (remap in dir16)
 *   Example: logicalDir8=0 → logicalDir16=0 → visualDir16=(0+4)%16=4
 *
 * Both pipelines produce the same visualDir16 for Smoky, confirming the
 * facingOffset conversion from 8-dir (2) to 16-dir (4) is correct.
 *
 * This visual dir16 must be used for pivot lookup because the directional
 * profile data was generated from the same camera/rendering pipeline as
 * the textures, and the dirIndex in the profile corresponds to the
 * texture index, not the logical compass direction.
 *
 * Returns the logical dir16 if the weapon has no visual profile (graceful fallback).
 *
 * Deterministic: same input always produces the same output.
 */
export function turretAngleToVisualDir16(turretAngle: number, weaponId: string): number {
  const logicalDir8 = bodyAngleToDir8(turretAngle);
  const profile = resolveTurretVisualProfile(weaponId);

  if (profile && profile.direction.dirCount === 16) {
    // Generated 16-dir turret: remap in dir16 space
    // logicalDir8 → logicalDir16 (even indices) → visualDir16 (remap with facingOffset)
    const logicalDir16 = logicalDir8 * 2;
    const visualDir16 = (logicalDir16 + profile.direction.facingOffset) % 16;
    return ((visualDir16 % 16) + 16) % 16;
  }

  // Legacy 8-dir turret: remap in dir8 space, then convert to dir16
  const visualDir8 = resolveTurretVisualDir(weaponId, logicalDir8);
  if (visualDir8 !== null) {
    return ((visualDir8 * 2) % 16 + 16) % 16;
  }
  // Fallback: no visual profile, use logical dir16
  return mapRuntimeDir8ToGeneratedDir16(logicalDir8);
}

/**
 * Convert a body angle (radians, screen-space) to a hull visual dir16 index
 * for use with resolveSocketNormForDir.
 *
 * Pipeline mirrors the generated hull sprite resolution:
 * 1. Quantize bodyAngle to logical dir8 via bodyAngleToDir8
 * 2. Double dir8 to get logical dir16
 * 3. Apply hull-specific visual direction remap (e.g. Wasp facingOffset=4)
 *
 * The result is the visual dir16 of the hull texture frame actually displayed.
 * This must be used for socket lookups because the perDir socket data
 * is keyed by visual frame index.
 *
 * Deterministic: same input always produces the same output.
 */
export function bodyAngleToHullVisualDir16(bodyAngle: number, bodyId: string): number {
  const dir8 = bodyAngleToDir8(bodyAngle);
  const logicalDir16 = mapRuntimeDir8ToGeneratedDir16(dir8);
  const hullId = bodyIdToGeneratedHullId(bodyId);
  if (hullId) {
    return applyHullVisualDir16Remap(hullId, logicalDir16);
  }
  return logicalDir16;
}

// ── Main resolver ────────────────────────────────────────────────────

/**
 * Resolve all mounting data needed to position a turret sprite on a hull.
 *
 * This is the main pure adapter function that the renderer calls.
 * It combines:
 * 1. Turret sprite key resolution (via resolveModularTurretSpriteKey concept)
 * 2. Directional pivot resolution (via resolveTurretPivotForDir) — using
 *    the turret's VISIBLE texture dir (fixup #4)
 * 3. Socket resolution (via resolveSocketNormForDir) — from bodyAngle
 * 4. Socket/pivot attachment math (via computeTurretSpriteCenterOffsetForSocket)
 *    — using actual sprite origins (fixup #4)
 *
 * Direction split (fixup #3 + fixup #4):
 * - turretVisualDir16 is derived from turretAngle via the turret's own visual
 *   direction remap (facingOffset), matching the displayed texture. Used for pivot lookup.
 * - hullVisualDir16 is derived from bodyAngle (matching the displayed hull
 *   texture frame) and used for socket lookup.
 * - The turret can rotate independently from the hull, so these MUST be separate.
 *
 * Fixup #4 — attachment math uses actual sprite origins:
 * - Hull sprite: setOrigin(GENERATED_HULL_ORIGIN_X, GENERATED_HULL_ORIGIN_Y) = (0.5, 0.75)
 * - Turret sprite: setOrigin(0.5, 0.5)
 * - The offset is relative to the hull sprite's position (its origin point):
 *     turretSprite.setPosition(hullSprite.x + offset.x, hullSprite.y + offset.y)
 *
 * The textureKey is provided by the caller (from resolveModularTurretSpriteKey)
 * because that function requires a Phaser Scene for texture existence check.
 * This adapter is pure and does not depend on Phaser.
 *
 * If textureKey is null, the result signals procedural fallback.
 * If any required contract piece is missing (directional pivot, socket profile,
 * or computed offset), useRealTurretSprite is false — no real sprite is
 * rendered, and the procedural turret fallback is used instead.
 * This ensures a real turret sprite is only shown when the full attachment
 * contract data exists.
 *
 * IMPORTANT: turretSprite.setOrigin(0.5, 0.5) must remain — do NOT
 * set origin to the pivot position.
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveTurretSpriteMountingData(params: {
  /** Turret texture key from resolveModularTurretSpriteKey, or null for fallback. */
  textureKey: string | null;
  /** Weapon identifier (e.g. 'smoky'). */
  weaponId: string;
  /** Hull body identifier (e.g. 'wasp'). */
  bodyId: string;
  /** Upgrade modification level (0-3). */
  modificationLevel: number;
  /** Turret angle in radians (screen-space). Used for turret pivot direction. */
  turretAngle: number;
  /** Body/hull angle in radians (screen-space). Used for hull socket direction.
   *  Must match the hull sprite's visual direction (bodyAngle). */
  bodyAngle: number;
  /** Sprite source sizes. */
  sourceSizes: SpriteSourceSizes;
  /** Sprite scale factors. */
  scaleFactors: SpriteScaleFactors;
  /** Sprite origins for attachment math. Default: DEFAULT_SPRITE_ORIGINS. */
  origins?: SpriteOrigins;
}): TurretSpriteMountingData {
  const {
    textureKey,
    weaponId,
    bodyId,
    modificationLevel,
    turretAngle,
    bodyAngle,
    sourceSizes,
    scaleFactors,
  } = params;

  const origins = params.origins ?? DEFAULT_SPRITE_ORIGINS;

  // If no texture key, signal procedural fallback
  if (textureKey === null) {
    return {
      textureKey: null,
      offsetFromHullCenter: null,
      directionalPivot: null,
      socketProfile: null,
      turretVisualDir16: 0,
      hullVisualDir16: 0,
      useRealTurretSprite: false,
    };
  }

  // ── Direction split (fixup #3 + fixup #4) ───────────────────────
  // Fixup #4: Turret pivot direction uses the VISIBLE texture dir,
  // not the raw logical direction. This matches the displayed Smoky
  // texture frame so the pivot corresponds to the actual sprite.
  const turretVisualDir16 = turretAngleToVisualDir16(turretAngle, weaponId);
  const hullVisualDir16 = bodyAngleToHullVisualDir16(bodyAngle, bodyId);

  // Resolve directional pivot for this weapon/level/direction using the
  // VISIBLE texture dir (fixup #4), BOUND to the asset basis of the texture
  // family the renderer actually loads (PR #263 fix). The pivot profile and
  // the texture must come from the same asset family, otherwise the pivot
  // coordinates do not match the visible sprite and the turret detaches.
  // getGeneratedTurretAssetBasis returns the basis of the shipped generated
  // turret PNGs; resolveTurretPivotForDirByBasis only returns a pivot whose
  // profile.assetBasis equals it (else null → procedural fallback).
  const assetBasis = getGeneratedTurretAssetBasis(weaponId);
  const directionalPivot = assetBasis
    ? resolveTurretPivotForDirByBasis(weaponId, modificationLevel, turretVisualDir16, assetBasis)
    : null;

  // Resolve hull socket (direction-independent base, for contract check)
  const socketProfile = resolveHullSocketProfile(bodyId, 'turret_main');

  // Resolve direction-specific socket position (from hull visual dir).
  // The socket position varies per hull direction because the orthographic
  // projection shifts the mount point's apparent position in each sprite frame.
  // Uses hullVisualDir16 (from bodyAngle), NOT turretVisualDir16.
  const socketNorm = resolveSocketNormForDir(bodyId, 'turret_main', hullVisualDir16);

  // If no directional pivot available, pivot is null — contract incomplete
  const pivotNorm = directionalPivot
    ? { x: directionalPivot.x, y: directionalPivot.y }
    : null;

  const hullDisplayWidthPx = sourceSizes.hullSourceWidthPx * scaleFactors.hullScale;
  const hullDisplayHeightPx = sourceSizes.hullSourceHeightPx * scaleFactors.hullScale;
  const turretDisplayWidthPx = sourceSizes.turretSourceWidthPx * scaleFactors.turretScale;
  const turretDisplayHeightPx = sourceSizes.turretSourceHeightPx * scaleFactors.turretScale;

  // Fixup #4: Pass actual sprite origins to attachment math.
  // Hull origin = (0.5, 0.75), turret origin = (0.5, 0.5).
  // The invariant is:
  //   hullSpriteOriginWorld + (socketNorm - hullOrigin) * hullDisplaySize
  //   == turretSpriteOriginWorld + (pivotNorm - turretOrigin) * turretDisplaySize
  const offsetResult = computeTurretSpriteCenterOffsetForSocket({
    socketNorm,
    hullDisplayWidthPx,
    hullDisplayHeightPx,
    pivotNorm,
    turretDisplayWidthPx,
    turretDisplayHeightPx,
    hullOriginX: origins.hullOriginX,
    hullOriginY: origins.hullOriginY,
    turretOriginX: origins.turretOriginX,
    turretOriginY: origins.turretOriginY,
  });

  // Real turret sprite requires the FULL attachment contract:
  // texture + directional pivot + socket profile + computed offset.
  // If any piece is missing, the turret would be incorrectly positioned
  // (e.g. centered on hull without proper offset), so we fall back to
  // the procedural turret rendering instead.
  const offsetFromHullCenter = offsetResult.offset;
  const useRealTurretSprite =
    directionalPivot !== null &&
    socketProfile !== null &&
    socketNorm !== null &&
    offsetFromHullCenter !== null;

  return {
    textureKey: useRealTurretSprite ? textureKey : null,
    offsetFromHullCenter: useRealTurretSprite ? offsetFromHullCenter : null,
    directionalPivot: useRealTurretSprite ? directionalPivot : null,
    socketProfile: useRealTurretSprite ? socketProfile : null,
    turretVisualDir16,
    hullVisualDir16,
    useRealTurretSprite,
  };
}
