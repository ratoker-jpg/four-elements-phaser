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
 * PROJECTION-01 fixup: Added projected geometry helpers that follow the
 * camera projection contract (tile-space rotation + projection) instead
 * of screen-pixel rotation. The projected helpers are the single source
 * of truth for both visual and logical turret/barrel positions.
 */

import type { BlockoutShape, MountCategory } from '../../config/blockoutProfiles';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { getBodyProfile } from '../../config/blockoutBodyData';
import { getWeaponProfile } from '../../config/blockoutWeaponData';
import { unprojectScreenToGround, projectGroundPoint, projectWorldPoint, PROJ_TILE_W } from '../../config/cameraProjectionContract';
import { getHullRingScale } from '../../config/hullVisualProfiles';
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

// ─── Selection ring footprint anchor (ARENA-VISUAL-COMBAT-FIX-01 fixup-5) ──

/**
 * Margin multiplier applied to the body footprint half-extent to size the
 * selection ring. >1 so the ring sits just OUTSIDE the visible hull footprint
 * (a snug ring "under" the body) rather than a large detached ellipse.
 *
 * Tuned so a medium hull (w22/h14) gets a ring radius of roughly
 *   (22/2 / 76) * 2.4 ≈ 0.35 tiles
 * which reads as a footprint ring rather than the old fixed 0.65-tile ellipse
 * that was ~2x the hull and looked detached in Denis QA.
 */
export const SELECTION_RING_FOOTPRINT_MARGIN = 2.4;

/**
 * Compute the selection-ring radius (in tile units) for a hull, scaled by the
 * hull body footprint so light hulls get a smaller ring and heavy hulls a
 * larger one. Unknown hulls fall back to the default medium body size.
 *
 * IMPORTANT — three distinct anchors (do not conflate):
 *   - GAMEPLAY CENTER: vehicle.worldX/worldY (+ map offset) = `cx,cy`. This is
 *     the ground-contact / tile center used for selection hit-testing,
 *     movement, pathfinding, range and damage. It NEVER moves for visuals.
 *   - VISUAL HULL ANCHOR: where the hull sprite is placed. Under the modular
 *     `world_origin_projects_to_frame_center` policy the hull origin (0.5,0.5)
 *     is placed at the gameplay center, so the hull's ground contact lands
 *     exactly on `cx,cy`.
 *   - SELECTION RING VISUAL ANCHOR: the ground-plane point the ring is drawn
 *     around. It is the SAME `cx,cy` (so the ring sits under the hull
 *     footprint), but its RADIUS is derived here from the hull footprint
 *     instead of a single fixed constant.
 *
 * This is a visual helper only; it does not affect any gameplay center,
 * hitbox, movement, range or damage computation.
 *
 * @param bodyId - Body profile ID (modular hull id maps 1:1 to a body profile)
 * @returns Selection ring radius in tile units
 */
export function getHullSelectionRingRadiusTiles(bodyId: string): number {
  const size = getBodyPixelSize(bodyId);
  // Half-extent in pixels → tile units (matches the body geometry convention
  // where body half-extent in tiles = bodySize / PROJ_TILE_W).
  const halfExtentPx = Math.max(size.w, size.h) / 2;
  // ARENA-VISUAL-COMBAT-FIX-01 fixup-6: apply the per-hull ringScale from the
  // HULL_VISUAL_PROFILE so the selection ring is explicitly hull-profile
  // dependent (the footprint already encodes weight; ringScale is the
  // documented per-hull fine-tune hook). Defaults to 1.0 for every current
  // Arena hull, so the footprint formula is preserved.
  const ringScale = getHullRingScale(bodyId);
  return (halfExtentPx / PROJ_TILE_W) * SELECTION_RING_FOOTPRINT_MARGIN * ringScale;
}

// ─── Shared turret constants (PROJECTION-01 fixup) ──────────────────

/** Turret rectangle width in pixels — source of truth for all consumers.
 *  PIM-WASP-SCALE-PLACEMENT-01: Reduced from 10 to 5 (2x smaller) to match
 *  the reduced hull scale. This affects ALL blockout/procedural turrets
 *  globally in the Arena rendering path, since all Arena vehicles use
 *  the same procedural turret geometry from blockoutVehicleGeometry. */
export const BLOCKOUT_TURRET_SIZE_W = 5;

/** Turret rectangle height in pixels — source of truth for all consumers.
 *  PIM-WASP-SCALE-PLACEMENT-01: Reduced from 6 to 3 (2x smaller) to match
 *  the reduced hull scale. This affects ALL blockout/procedural turrets
 *  globally in the Arena rendering path. */
export const BLOCKOUT_TURRET_SIZE_H = 3;

// ─── Shared Z-level constants (PROJECTION-01 fixup #2) ────────────────

/** Vehicle body height in world Z units for pseudo-isometric rendering.
 *  Source of truth — do not duplicate in other files. */
export const BLOCKOUT_VEHICLE_BODY_Z = 0.25;

/** Turret height offset in world Z units above body top.
 *  Source of truth — do not duplicate in other files. */
export const BLOCKOUT_TURRET_Z_OFFSET = 0.05;

/** Turret box height in world Z units.
 *  Source of truth — do not duplicate in other files. */
export const BLOCKOUT_TURRET_BOX_HEIGHT = 0.08;

/** Barrel center Z: the Z level at which the barrel line is drawn.
 *  This is the body top + turret offset + half the turret box height.
 *  Both visual rendering and logical fire/damage use this Z. */
export const BLOCKOUT_BARREL_Z = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + BLOCKOUT_TURRET_BOX_HEIGHT * 0.5;

// ─── Internal: mount tile offset (PROJECTION-01 fixup) ──────────────

/**
 * Compute the mount offset in tile space, rotated by body angle.
 *
 * This is the single source of truth for mount position relative to
 * the body tile center. It converts the pixel-space mount offset to
 * tile units using PROJ_TILE_W, then rotates in tile space (not
 * screen-pixel space). This is the correct approach per the camera
 * projection contract, because rotations in the isometric projection
 * must happen in tile space to match the projected geometry.
 *
 * Both the renderer and input controller add this offset to the body
 * tile center to get the absolute mount tile position.
 */
/**
 * Compute body screen position including recoil body impulse.
 *
 * PROJECTION-01 fixup #3: Body recoil impulse shifts the visual/logical
 * body position, affecting turret mount, barrel tip, and all derived
 * positions. All projected geometry helpers use this to ensure visual
 * and logical positions agree when the body recoils.
 *
 * The impulse is applied in screen-pixel space (backward along body
 * angle) BEFORE unprojecting to tile space, exactly matching the
 * renderer's cx/cy computation.
 */
function computeBodyScreenWithImpulse(
  vehicle: BlockoutVehicleState,
  offset: IsoPoint,
): { x: number; y: number } {
  const recoilBodyOffset = vehicle.recoilBodyOffset ?? 0;
  const bodyAngle = vehicle.bodyAngle;
  const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
  const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;
  return {
    x: vehicle.worldX + offset.x + bodyImpulseX,
    y: vehicle.worldY + offset.y + bodyImpulseY,
  };
}

function computeMountTileOffset(vehicle: BlockoutVehicleState): { dx: number; dy: number } {
  const bodyProfile = getBodyProfile(vehicle.bodyId);
  const bodySize = bodyProfile ? SHAPE_SIZE_MAP[bodyProfile.blockoutShape] : DEFAULT_BODY_SIZE;
  const mountCategory = bodyProfile?.mountCategory ?? 'center';
  const mountOffset = computeMountPixelOffset(mountCategory, bodySize.w, bodySize.h);

  // Convert pixel offset to tile units using projection source of truth
  const mountTileX = mountOffset.dx / PROJ_TILE_W;
  const mountTileY = mountOffset.dy / PROJ_TILE_W;

  // Rotate by body angle in tile space (not screen-pixel space)
  const cosA = Math.cos(vehicle.bodyAngle);
  const sinA = Math.sin(vehicle.bodyAngle);
  return {
    dx: mountTileX * cosA - mountTileY * sinA,
    dy: mountTileX * sinA + mountTileY * cosA,
  };
}

// ─── Projected turret mount screen position (PROJECTION-01 fixup) ───

/**
 * Compute the screen-space position of the turret mount on the ground
 * plane (z=0), using the camera projection contract.
 *
 * This is the correct mount position for aim angle computation in the
 * input controller and for ground-plane visual markers. It follows the
 * projection contract: pixel offsets are converted to tile units via
 * PROJ_TILE_W, rotated in tile space, and projected to screen space.
 *
 * This replaces the old computeTurretWorldOrigin for all projected
 * geometry consumers. The old function rotates in screen-pixel space,
 * which diverges from the renderer's tile-space rotation.
 *
 * @param vehicle - Blockout vehicle state
 * @param offset - Map offset (from GameScene)
 * @returns Screen-space position of the turret mount at z=0
 */
export function computeProjectedTurretMountScreen(
  vehicle: BlockoutVehicleState,
  offset: IsoPoint,
): { x: number; y: number } {
  // PROJECTION-01 fixup #3: Include body recoil impulse so visual
  // turret mount equals logical turret mount during recoil
  const bodyScreen = computeBodyScreenWithImpulse(vehicle, offset);
  const tilePos = unprojectScreenToGround(bodyScreen.x, bodyScreen.y, offset);
  const mountOff = computeMountTileOffset(vehicle);
  return projectGroundPoint(tilePos.x + mountOff.dx, tilePos.y + mountOff.dy, offset);
}

// ─── Projected barrel tip screen position (PROJECTION-01 fixup) ─────

/**
 * Compute the screen-space position of the barrel tip on the ground
 * plane (z=0), using the camera projection contract.
 *
 * This is the correct barrel tip position for fire/damage origin
 * computation in the input controller and GameScene. It follows the
 * projection contract: the barrel extends along the turret angle in
 * tile space from the mount position, then projects to screen.
 *
 * Includes recoil barrel offset (shorter barrel during recoil) and
 * turret kickback angle (turret angle offset during recoil). When
 * recoil offsets are 0 (at the instant of firing), the barrel tip
 * is at the pre-recoil position.
 *
 * @param vehicle - Blockout vehicle state
 * @param offset - Map offset (from GameScene)
 * @returns Screen-space position of the barrel tip at z=0
 */
export function computeProjectedBarrelTipScreen(
  vehicle: BlockoutVehicleState,
  offset: IsoPoint,
): { x: number; y: number } {
  const weaponProfile = getWeaponProfile(vehicle.weaponId);
  const barrelLength = weaponProfile ? weaponProfile.blockoutBarrelLength : 12;

  // PROJECTION-01 fixup #3: Include body recoil impulse
  const bodyScreen = computeBodyScreenWithImpulse(vehicle, offset);
  const tilePos = unprojectScreenToGround(bodyScreen.x, bodyScreen.y, offset);
  const mountOff = computeMountTileOffset(vehicle);
  const mountTileX = tilePos.x + mountOff.dx;
  const mountTileY = tilePos.y + mountOff.dy;

  // Turret half-width + barrel length in tile units
  const turretHalfW = (BLOCKOUT_TURRET_SIZE_W / 2) / PROJ_TILE_W;
  const barrelTileLength = barrelLength / PROJ_TILE_W;

  // Recoil offsets
  const recoilBarrelOffset = vehicle.recoilBarrelOffset ?? 0;
  const effectiveBarrelLength = Math.max(0, barrelTileLength - recoilBarrelOffset / PROJ_TILE_W);
  const recoilTurretOffset = vehicle.recoilTurretOffset ?? 0;
  const effectiveTurretAngle = vehicle.turretAngle - recoilTurretOffset;

  // Barrel tip in tile space
  const turretCosA = Math.cos(effectiveTurretAngle);
  const turretSinA = Math.sin(effectiveTurretAngle);
  const barrelTipTileX = mountTileX + (turretHalfW + effectiveBarrelLength) * turretCosA;
  const barrelTipTileY = mountTileY + (turretHalfW + effectiveBarrelLength) * turretSinA;

  return projectGroundPoint(barrelTipTileX, barrelTipTileY, offset);
}

// ─── Projected barrel tip screen position with Z (PROJECTION-01 fixup #2) ──

/**
 * Compute the screen-space position of the barrel tip at the correct
 * visual Z level, using the camera projection contract.
 *
 * This is the single source of truth for both:
 * - Visual rendering: where the barrel end is drawn on screen
 * - Logical fire/damage: where projectiles/damage originate
 *
 * The Z level accounts for the turret sitting on top of the body,
 * so the barrel tip appears at the correct height above ground.
 * This eliminates the divergence between the visual barrel end
 * (drawn at turret Z) and the logical fire origin (previously at
 * ground Z=0).
 *
 * @param vehicle - Blockout vehicle state
 * @param offset - Map offset (from GameScene)
 * @returns Screen-space position of the barrel tip at BLOCKOUT_BARREL_Z
 */
export function computeProjectedBarrelTipScreenAtZ(
  vehicle: BlockoutVehicleState,
  offset: IsoPoint,
): { x: number; y: number } {
  const weaponProfile = getWeaponProfile(vehicle.weaponId);
  const barrelLength = weaponProfile ? weaponProfile.blockoutBarrelLength : 12;

  // PROJECTION-01 fixup #3: Include body recoil impulse
  const bodyScreen = computeBodyScreenWithImpulse(vehicle, offset);
  const tilePos = unprojectScreenToGround(bodyScreen.x, bodyScreen.y, offset);
  const mountOff = computeMountTileOffset(vehicle);
  const mountTileX = tilePos.x + mountOff.dx;
  const mountTileY = tilePos.y + mountOff.dy;

  // Turret half-width + barrel length in tile units
  const turretHalfW = (BLOCKOUT_TURRET_SIZE_W / 2) / PROJ_TILE_W;
  const barrelTileLength = barrelLength / PROJ_TILE_W;

  // Recoil offsets
  const recoilBarrelOffset = vehicle.recoilBarrelOffset ?? 0;
  const effectiveBarrelLength = Math.max(0, barrelTileLength - recoilBarrelOffset / PROJ_TILE_W);
  const recoilTurretOffset = vehicle.recoilTurretOffset ?? 0;
  const effectiveTurretAngle = vehicle.turretAngle - recoilTurretOffset;

  // Barrel tip in tile space
  const turretCosA = Math.cos(effectiveTurretAngle);
  const turretSinA = Math.sin(effectiveTurretAngle);
  const barrelTipTileX = mountTileX + (turretHalfW + effectiveBarrelLength) * turretCosA;
  const barrelTipTileY = mountTileY + (turretHalfW + effectiveBarrelLength) * turretSinA;

  // Project at barrel Z level (not ground plane)
  return projectWorldPoint(barrelTipTileX, barrelTipTileY, BLOCKOUT_BARREL_Z, offset);
}

// ─── Comprehensive projected geometry (PROJECTION-01 fixup) ─────────

/**
 * Comprehensive projected geometry for a blockout vehicle.
 *
 * Used by BlockoutVehicleRenderer for all visual computation. The
 * mountTileOffset is relative to the body tile center — the renderer
 * adds this to its body tile center (which may include visual recoil
 * impulse) to get the absolute mount tile position.
 */
export interface ProjectedBlockoutVehicleGeometry {
  /** Mount offset in tile space, rotated by body angle. */
  mountTileOffset: { dx: number; dy: number };
  /** Body tile center (unprojected from vehicle.worldX/worldY + offset, without body recoil impulse). */
  bodyTileCenter: { x: number; y: number };
  /** Body half-width in tile units. */
  halfW: number;
  /** Body half-height in tile units. */
  halfH: number;
  /** Turret half-width in tile units. */
  turretHalfW: number;
  /** Turret half-height in tile units. */
  turretHalfH: number;
  /** Barrel length in tile units (before recoil). */
  barrelTileLength: number;
  /** Effective barrel length in tile units (after recoil). */
  effectiveBarrelLength: number;
  /** Effective turret angle in radians (after recoil kickback). */
  effectiveTurretAngle: number;
  /** Barrel Z level for rendering and fire/damage origin. PROJECTION-01 fixup #2. */
  barrelZ: number;
  /** Barrel tip screen position at barrelZ with body recoil impulse applied.
   *  Single source of truth for visual rendering and logical fire/damage.
   *  PROJECTION-01 fixup #3. */
  barrelTipScreen: { x: number; y: number };
  /** Barrel start screen position at barrelZ with body recoil impulse applied.
   *  PROJECTION-01 fixup #3. */
  barrelStartScreen: { x: number; y: number };
}

/**
 * Compute comprehensive projected geometry for a blockout vehicle.
 *
 * Returns tile-space geometry data that the renderer uses for drawing
 * pseudo-isometric body, turret, and barrel. The mountTileOffset is
 * the same offset used by computeProjectedTurretMountScreen and
 * computeProjectedBarrelTipScreen, ensuring visual and logical
 * positions always agree on the mount location.
 *
 * @param vehicle - Blockout vehicle state
 * @param offset - Map offset (from GameScene)
 * @returns Projected geometry data for rendering
 */
export function computeProjectedBlockoutVehicleGeometry(
  vehicle: BlockoutVehicleState,
  offset: IsoPoint,
): ProjectedBlockoutVehicleGeometry {
  const bodyProfile = getBodyProfile(vehicle.bodyId);
  const bodySize = bodyProfile ? SHAPE_SIZE_MAP[bodyProfile.blockoutShape] : DEFAULT_BODY_SIZE;
  const weaponProfile = getWeaponProfile(vehicle.weaponId);
  const barrelLength = weaponProfile ? weaponProfile.blockoutBarrelLength : 12;

  const mountTileOffset = computeMountTileOffset(vehicle);

  // Body tile center WITHOUT impulse (kept for backward compatibility)
  const bodyScreenX = vehicle.worldX + offset.x;
  const bodyScreenY = vehicle.worldY + offset.y;
  const bodyTileCenter = unprojectScreenToGround(bodyScreenX, bodyScreenY, offset);

  const halfW = bodySize.w / PROJ_TILE_W;
  const halfH = bodySize.h / PROJ_TILE_W;
  const turretHalfW = (BLOCKOUT_TURRET_SIZE_W / 2) / PROJ_TILE_W;
  const turretHalfH = (BLOCKOUT_TURRET_SIZE_H / 2) / PROJ_TILE_W;
  const barrelTileLength = barrelLength / PROJ_TILE_W;

  const recoilBarrelOffset = vehicle.recoilBarrelOffset ?? 0;
  const effectiveBarrelLength = Math.max(0, barrelTileLength - recoilBarrelOffset / PROJ_TILE_W);
  const recoilTurretOffset = vehicle.recoilTurretOffset ?? 0;
  const effectiveTurretAngle = vehicle.turretAngle - recoilTurretOffset;

  // PROJECTION-01 fixup #3: Body recoil impulse shifts barrel screen position.
  // Compute barrel tip/start using impulse-shifted body center so visual
  // rendering and logical fire/damage use the exact same screen point.
  const bodyScreenWithImpulse = computeBodyScreenWithImpulse(vehicle, offset);
  const tilePosWithImpulse = unprojectScreenToGround(bodyScreenWithImpulse.x, bodyScreenWithImpulse.y, offset);
  const mountTileCenterWithImpulse = {
    x: tilePosWithImpulse.x + mountTileOffset.dx,
    y: tilePosWithImpulse.y + mountTileOffset.dy,
  };

  const turretCosA = Math.cos(effectiveTurretAngle);
  const turretSinA = Math.sin(effectiveTurretAngle);
  const barrelTipTileX = mountTileCenterWithImpulse.x + (turretHalfW + effectiveBarrelLength) * turretCosA;
  const barrelTipTileY = mountTileCenterWithImpulse.y + (turretHalfW + effectiveBarrelLength) * turretSinA;
  const barrelStartTileX = mountTileCenterWithImpulse.x + turretHalfW * turretCosA;
  const barrelStartTileY = mountTileCenterWithImpulse.y + turretHalfW * turretSinA;

  const barrelTipScreen = projectWorldPoint(barrelTipTileX, barrelTipTileY, BLOCKOUT_BARREL_Z, offset);
  const barrelStartScreen = projectWorldPoint(barrelStartTileX, barrelStartTileY, BLOCKOUT_BARREL_Z, offset);

  return {
    mountTileOffset,
    bodyTileCenter,
    halfW,
    halfH,
    turretHalfW,
    turretHalfH,
    barrelTileLength,
    effectiveBarrelLength,
    effectiveTurretAngle,
    barrelZ: BLOCKOUT_BARREL_Z,
    barrelTipScreen,
    barrelStartScreen,
  };
}
