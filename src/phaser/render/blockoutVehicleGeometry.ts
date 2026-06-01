/**
 * Shared pure geometry helpers for blockout vehicles.
 *
 * Computes body pixel sizes, mount offsets, and turret world origins.
 * Used by both BlockoutVehicleRenderer and BlockoutVehicleInputController
 * to ensure they agree on where the turret sits.
 *
 * BLOCKOUT-03H fixup: Turret aiming must use actual turret mount/barrel
 * origin, not body/tile center. This module is the single source of truth.
 * BLOCKOUT-04H+: Updated to use vehicle.worldX/worldY for continuous
 * position instead of tileToScreen(tx,ty).
 */

import type { BlockoutShape, MountCategory } from '../../config/blockoutProfiles';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { getBodyProfile } from '../../config/blockoutBodyData';
import type { IsoPoint } from './isometric';

// ─── Body pixel size by blockoutShape ──────────────────────────────

/** Size mapping from blockoutShape to body rectangle dimensions in pixels.
 *  These are approximate and tunable. Larger = heavier body.
 *  Single source of truth — do not duplicate in other files. */
export const SHAPE_SIZE_MAP: Record<BlockoutShape, { w: number; h: number }> = {
  small_fast: { w: 16, h: 10 },
  light_fast: { w: 18, h: 12 },
  medium: { w: 22, h: 14 },
  large_fast: { w: 24, h: 14 },
  heavy: { w: 28, h: 18 },
  super_heavy: { w: 32, h: 22 },
};

/** Default body size when body profile is unknown. */
const DEFAULT_BODY_SIZE = SHAPE_SIZE_MAP.medium;

// ─── Mount pixel offset ────────────────────────────────────────────

/**
 * Fraction of bodyWidth to offset per mount category.
 * Positive = toward front, negative = toward rear.
 */
const MOUNT_FRACTION_MAP: Record<MountCategory, number> = {
  rear: -0.3,
  center_rear: -0.15,
  center: 0,
  front_center: 0.2,
  front: 0.3,
};

/**
 * Compute the pixel offset of the turret mount point relative to
 * the body center, in body-local coordinates (before body rotation).
 *
 * @param mountCategory - Where the turret sits on the body
 * @param bodyWidth - Body rectangle width in pixels (from SHAPE_SIZE_MAP)
 * @param _bodyHeight - Body rectangle height in pixels (unused, reserved)
 * @returns Offset { dx, dy } in body-local pixel coordinates
 */
export function computeMountPixelOffset(
  mountCategory: MountCategory,
  bodyWidth: number,
  _bodyHeight: number,
): { dx: number; dy: number } {
  const fraction = MOUNT_FRACTION_MAP[mountCategory] ?? 0;
  const offset = fraction * bodyWidth;
  return { dx: offset, dy: 0 };
}

// ─── Turret world origin ──────────────────────────────────────────

/**
 * Compute the world-space position of a blockout vehicle's turret mount.
 *
 * The turret mount is offset from the body center by the mount pixel offset,
 * rotated by the body angle. This is the point from which aim angles should
 * be computed and from which the aim line should be drawn.
 *
 * BLOCKOUT-04H+: Uses vehicle.worldX/worldY for continuous position.
 *
 * @param vehicle - Blockout vehicle state
 * @param offset - Map offset (from GameScene)
 * @returns World-space position of the turret mount origin
 */
export function computeTurretWorldOrigin(
  vehicle: BlockoutVehicleState,
  offset: IsoPoint,
): { x: number; y: number } {
  const bodyProfile = getBodyProfile(vehicle.bodyId);
  const bodySize = bodyProfile ? SHAPE_SIZE_MAP[bodyProfile.blockoutShape] : DEFAULT_BODY_SIZE;

  // BLOCKOUT-04H+: Use continuous screen-space position + offset
  const bodyCenterX = vehicle.worldX + offset.x;
  const bodyCenterY = vehicle.worldY + offset.y;

  const mountCategory = bodyProfile?.mountCategory ?? 'center';
  const mountOffset = computeMountPixelOffset(mountCategory, bodySize.w, bodySize.h);

  // Rotate mount offset by body angle to get world-space offset
  const cosA = Math.cos(vehicle.bodyAngle);
  const sinA = Math.sin(vehicle.bodyAngle);
  const worldOffsetX = mountOffset.dx * cosA - mountOffset.dy * sinA;
  const worldOffsetY = mountOffset.dx * sinA + mountOffset.dy * cosA;

  return {
    x: bodyCenterX + worldOffsetX,
    y: bodyCenterY + worldOffsetY,
  };
}

// ─── Body world center (convenience) ──────────────────────────────

/**
 * Compute the world-space center of a blockout vehicle's body.
 * This is the screen-space position + map offset.
 *
 * BLOCKOUT-04H+: Uses vehicle.worldX/worldY for continuous position.
 *
 * @param vehicle - Blockout vehicle state
 * @param offset - Map offset (from GameScene)
 * @returns World-space position of the body center
 */
export function computeBodyWorldCenter(
  vehicle: BlockoutVehicleState,
  offset: IsoPoint,
): { x: number; y: number } {
  return {
    x: vehicle.worldX + offset.x,
    y: vehicle.worldY + offset.y,
  };
}

// ─── Body size lookup (convenience) ────────────────────────────────

/**
 * Get the body pixel size for a blockout vehicle from its bodyId.
 * Returns the default medium size if body profile is not found.
 *
 * @param bodyId - Body profile ID
 * @returns Body pixel dimensions { w, h }
 */
export function getBodyPixelSize(bodyId: string): { w: number; h: number } {
  const bodyProfile = getBodyProfile(bodyId);
  return bodyProfile ? SHAPE_SIZE_MAP[bodyProfile.blockoutShape] : DEFAULT_BODY_SIZE;
}
