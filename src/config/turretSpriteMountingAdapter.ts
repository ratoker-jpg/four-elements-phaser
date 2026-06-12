/**
 * TURRET-HULL-CONTRACT-PR-F2: Pure adapter for turret sprite mounting data.
 *
 * This module computes the pixel offset needed to position a turret sprite
 * on a hull using directional pivot profiles and socket/pivot attachment math.
 *
 * It is pure TypeScript — no Phaser imports, no runtime state. The renderer
 * consumes the result to position the turret sprite image.
 *
 * Convention:
 * - Phaser sprite origin remains centered: setOrigin(0.5, 0.5)
 * - Pivot values are consumed through attachment/offset math
 * - Pivot values must NOT automatically become Phaser sprite origin
 *
 * Source: PR #262 directional Smoky profile data + turretAttachmentMath.ts
 */

import { bodyAngleToDir8, mapRuntimeDir8ToGeneratedDir16 } from '../assets/generatedHullAssets';
import { resolveTurretPivotForDir } from './directionalTurretProfiles';
import type { DirectionalPoint2D } from './directionalTurretProfiles';
import type { SocketProfile } from './hullTurretVisualProfiles';
import { resolveHullSocketProfile } from './turretAttachmentMath';
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

  /** The dir16 index used for directional pivot lookup. */
  dir16: number;

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

// ── Main resolver ────────────────────────────────────────────────────

/**
 * Resolve all mounting data needed to position a turret sprite on a hull.
 *
 * This is the main pure adapter function that the renderer calls.
 * It combines:
 * 1. Turret sprite key resolution (via resolveModularTurretSpriteKey concept)
 * 2. Directional pivot resolution (via resolveTurretPivotForDir)
 * 3. Socket/pivot attachment math (via computeTurretSpriteCenterOffsetForSocket)
 *
 * The textureKey is provided by the caller (from resolveModularTurretSpriteKey)
 * because that function requires a Phaser Scene for texture existence check.
 * This adapter is pure and does not depend on Phaser.
 *
 * If textureKey is null, the result signals procedural fallback.
 * If directional pivot is not available for the weapon/level, offset falls
 * back to legacy center-center (0,0) offset.
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
  /** Turret angle in radians (screen-space). */
  turretAngle: number;
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
      dir16: 0,
      useRealTurretSprite: false,
    };
  }

  // Resolve dir16 for directional pivot lookup
  const dir16 = turretAngleToDir16(turretAngle);

  // Resolve directional pivot for this weapon/level/direction
  const directionalPivot = resolveTurretPivotForDir(weaponId, modificationLevel, dir16);

  // Resolve hull socket
  const socketProfile = resolveHullSocketProfile(bodyId, 'turret_main');

  // Compute mounting offset via attachment math
  const socketNorm = socketProfile
    ? { x: socketProfile.normalized.nx, y: socketProfile.normalized.ny }
    : null;

  // If no directional pivot available, try using legacy center (0.5, 0.5)
  // This handles the case where the weapon has a texture but no directional profile
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

  return {
    textureKey,
    offsetFromHullCenter: offsetResult.offset,
    directionalPivot,
    socketProfile,
    dir16,
    useRealTurretSprite: true,
  };
}
