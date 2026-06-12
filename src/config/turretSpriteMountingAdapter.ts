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
 * - Turret pivot direction (turretDir16) comes from turretAngle.
 * - Hull socket direction (hullVisualDir16) comes from bodyAngle
 *   and must match the generated hull texture frame actually displayed.
 * - These are separate because the turret can rotate independently from the hull.
 *
 * Convention:
 * - Phaser sprite origin remains centered: setOrigin(0.5, 0.5)
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
} from '../assets/generatedHullAssets';
import { resolveTurretPivotForDir } from './directionalTurretProfiles';
import type { DirectionalPoint2D } from './directionalTurretProfiles';
import type { SocketProfile } from './hullTurretVisualProfiles';
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
  /** Turret sprite source width (e.g. 256 for Smoky turret sprites). */
  turretSourceWidthPx: number;
  /** Turret sprite source height (e.g. 256 for Smoky turret sprites). */
  turretSourceHeightPx: number;
}

/** Scale factors for hull and turret sprites. */
export interface SpriteScaleFactors {
  /** Hull sprite scale factor (e.g. 0.12 for generated hulls). */
  hullScale: number;
  /** Turret sprite scale factor (e.g. 0.24 for Smoky turret). */
  turretScale: number;
}

/** Complete mounting data resolved for a turret sprite. */
export interface TurretSpriteMountingData {
  /** Texture key for the turret sprite, or null if no real sprite available. */
  textureKey: string | null;

  /** Pixel offset from hull sprite center to turret sprite center.
   *  null if mounting cannot be computed (missing socket or pivot).
   *  Apply this as: turretSprite.setPosition(hullSprite.x + offset.x, hullSprite.y + offset.y)
   */
  offsetFromHullCenter: PixelOffset | null;

  /** The directional pivot position used for mounting (null if fallback/unsupported). */
  directionalPivot: DirectionalPoint2D | null;

  /** The hull socket profile used (null if no profile). */
  socketProfile: SocketProfile | null;

  /** The turret dir16 index used for directional pivot lookup (from turretAngle). */
  turretDir16: number;

  /** The hull visual dir16 index used for socket lookup (from bodyAngle, matches displayed hull frame). */
  hullVisualDir16: number;

  /** Whether a real turret sprite should be rendered (vs procedural fallback). */
  useRealTurretSprite: boolean;
}

// ── Direction conversion ─────────────────────────────────────────────

/**
 * Convert a turret angle (radians, screen-space) to a dir16 index
 * for use with resolveTurretPivotForDir.
 *
 * Pipeline:
 * 1. Quantize turretAngle to logical dir8 via bodyAngleToDir8
 * 2. Double dir8 to get logical dir16 (even indices only: 0,2,4,...,14)
 *
 * This matches the same direction system used for hull dir16 sprites.
 * The dir16 index is used for directional pivot/muzzle lookups from
 * the projection-recovered profile data.
 *
 * Deterministic: same input always produces the same output.
 */
export function turretAngleToDir16(turretAngle: number): number {
  const dir8 = bodyAngleToDir8(turretAngle);
  return mapRuntimeDir8ToGeneratedDir16(dir8);
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
 * 2. Directional pivot resolution (via resolveTurretPivotForDir) — from turretAngle
 * 3. Socket resolution (via resolveSocketNormForDir) — from bodyAngle
 * 4. Socket/pivot attachment math (via computeTurretSpriteCenterOffsetForSocket)
 *
 * Direction split (fixup #3):
 * - turretDir16 is derived from turretAngle and used for pivot lookup.
 * - hullVisualDir16 is derived from bodyAngle (matching the displayed hull
 *   texture frame) and used for socket lookup.
 * - The turret can rotate independently from the hull, so these MUST be separate.
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
 * The offset is relative to the hull sprite's visual center (the position
 * where the hull sprite is drawn). The turret sprite should be positioned at:
 *   turretSprite.x = hullSprite.x + offsetFromHullCenter.x
 *   turretSprite.y = hullSprite.y + offsetFromHullCenter.y
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

  // If no texture key, signal procedural fallback
  if (textureKey === null) {
    return {
      textureKey: null,
      offsetFromHullCenter: null,
      directionalPivot: null,
      socketProfile: null,
      turretDir16: 0,
      hullVisualDir16: 0,
      useRealTurretSprite: false,
    };
  }

  // ── Direction split (fixup #3) ──────────────────────────────────
  // Turret pivot direction comes from turretAngle.
  // Hull socket direction comes from bodyAngle, matching the displayed
  // hull texture frame (including hull-specific visual remap).
  const turretDir16 = turretAngleToDir16(turretAngle);
  const hullVisualDir16 = bodyAngleToHullVisualDir16(bodyAngle, bodyId);

  // Resolve directional pivot for this weapon/level/direction (from turret dir)
  const directionalPivot = resolveTurretPivotForDir(weaponId, modificationLevel, turretDir16);

  // Resolve hull socket (direction-independent base, for contract check)
  const socketProfile = resolveHullSocketProfile(bodyId, 'turret_main');

  // Resolve direction-specific socket position (from hull visual dir).
  // The socket position varies per hull direction because the orthographic
  // projection shifts the mount point's apparent position in each sprite frame.
  // Uses hullVisualDir16 (from bodyAngle), NOT turretDir16.
  const socketNorm = resolveSocketNormForDir(bodyId, 'turret_main', hullVisualDir16);

  // If no directional pivot available, pivot is null — contract incomplete
  const pivotNorm = directionalPivot
    ? { x: directionalPivot.x, y: directionalPivot.y }
    : null;

  const hullDisplayWidthPx = sourceSizes.hullSourceWidthPx * scaleFactors.hullScale;
  const hullDisplayHeightPx = sourceSizes.hullSourceHeightPx * scaleFactors.hullScale;
  const turretDisplayWidthPx = sourceSizes.turretSourceWidthPx * scaleFactors.turretScale;
  const turretDisplayHeightPx = sourceSizes.turretSourceHeightPx * scaleFactors.turretScale;

  const offsetResult = computeTurretSpriteCenterOffsetForSocket({
    socketNorm,
    hullDisplayWidthPx,
    hullDisplayHeightPx,
    pivotNorm,
    turretDisplayWidthPx,
    turretDisplayHeightPx,
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
    turretDir16,
    hullVisualDir16,
    useRealTurretSprite,
  };
}
