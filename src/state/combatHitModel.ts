/**
 * Combat hit model — projected hit footprint, aim forgiveness, point-blank assist.
 *
 * CORE-STEP-07H+: Implements the accepted hit detection model:
 * - Targets have projected hit footprints (ground-plane geometry)
 * - Hit detection uses projected footprint, not screen-distance
 * - Aim forgiveness per weapon category prevents frustrating near-misses
 * - Point-blank assist ensures close-range reliability
 * - Cone hit detection uses footprint + cone angle
 * - Splash uses ground-plane projected radius
 * - 2.5D tolerance prevents height-related misses
 *
 * All functions are pure — no Phaser, no DOM, no mutation.
 * Uses CAMERA_PROJECTION_CONTRACT helpers for projected geometry.
 *
 * Architecture: state layer — no Phaser imports.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import { getWeaponConfig } from '../config/weaponData';
import type { WeaponRangeClass } from '../config/coreMechanicsTypes';
import { getBodyFootprintConfig } from './bodyFootprint';
import { groundDistanceTiles, isPointBlank } from './combatRange';

// ─── Aim forgiveness config ──────────────────────────────────────

/** Aim forgiveness tolerance per weapon range class, in tile units. */
const AIM_FORGIVENESS_TILES: Record<WeaponRangeClass, number> = {
  short: 0.8,   // Short-range weapons get more forgiveness
  medium: 0.5,  // Medium-range gets moderate forgiveness
  long: 0.3,    // Long-range weapons get less forgiveness
};

/** Extra forgiveness for cone/shotgun weapons, in tile units. */
const CONE_FORGIVENESS_BONUS_TILES = 0.5;

/**
 * Aim forgiveness per weapon category.
 * Derived from weapon fireType + rangeClass.
 */
export interface AimForgivenessConfig {
  /** How far off the aim line can a hit still count, in tile units. */
  toleranceTiles: number;
  /** Whether point-blank assist applies for this weapon. */
  hasPointBlankAssist: boolean;
  /** Cone half-angle in degrees (0 for non-cone weapons). */
  coneHalfAngleDeg: number;
  /** Splash radius in tile units (0 for non-splash weapons). */
  splashRadiusTiles: number;
}

/**
 * Get aim forgiveness config for a weapon.
 *
 * Uses weapon config when available. Falls back to defaults based on
 * damage profile kind.
 */
export function getAimForgiveness(weaponId: string): AimForgivenessConfig {
  const config = getWeaponConfig(weaponId);

  if (config) {
    const rangeClass = config.rangeClass;
    let toleranceTiles = AIM_FORGIVENESS_TILES[rangeClass];

    // Cone/shotgun weapons get extra forgiveness
    const isConeWeapon = config.fireType === 'canister_stream' || config.fireType === 'drum';
    if (isConeWeapon) {
      toleranceTiles += CONE_FORGIVENESS_BONUS_TILES;
    }

    // Point-blank assist applies to short-range and cone weapons
    const hasPointBlankAssist = rangeClass === 'short' || isConeWeapon;

    // Cone angle from config (drum = shotgun cone)
    let coneHalfAngleDeg = 0;
    if (config.fireType === 'canister_stream') {
      coneHalfAngleDeg = 15; // Flamethrower/Freeze cone
    } else if (config.fireType === 'drum') {
      coneHalfAngleDeg = (config.drum ? 15 : 0); // Hammer shotgun cone
    }

    // Splash radius from config
    const splashRadiusTiles = config.damage.splashRadius;

    return {
      toleranceTiles,
      hasPointBlankAssist,
      coneHalfAngleDeg,
      splashRadiusTiles,
    };
  }

  // Fallback: blockout weapons
  return {
    toleranceTiles: 0.5,
    hasPointBlankAssist: true,
    coneHalfAngleDeg: 0,
    splashRadiusTiles: 0,
  };
}

// ─── Projected hit footprint ──────────────────────────────────────

/** A projected ground-plane footprint for hit detection. */
export interface ProjectedFootprint {
  /** Footprint center on the ground plane (tile units). */
  centerTileX: number;
  centerTileY: number;
  /** Footprint half-width in tile units. */
  halfWidthTiles: number;
  /** Footprint half-height in tile units. */
  halfHeightTiles: number;
  /** Effective hit radius in tile units (for circle-based hit checks). */
  hitRadiusTiles: number;
}

/**
 * Compute the projected hit footprint for a vehicle.
 *
 * Uses the body's footprint class to determine the hit area.
 * The footprint is centered on the vehicle's tile position and extends
 * based on the body's collision profile.
 *
 * This is a ground-plane measurement — no screen-space distances.
 */
export function computeHitFootprint(vehicle: BlockoutVehicleState): ProjectedFootprint {
  const footprintConfig = getBodyFootprintConfig(vehicle.bodyId);
  const collisionRadius = footprintConfig.collisionRadiusTiles;

  // Use grid movement fractional tile position for accuracy
  const tileX = vehicle.gridMovement.ftx;
  const tileY = vehicle.gridMovement.fty;

  return {
    centerTileX: tileX,
    centerTileY: tileY,
    halfWidthTiles: collisionRadius,
    halfHeightTiles: collisionRadius,
    hitRadiusTiles: collisionRadius,
  };
}

// ─── 2.5D height tolerance ────────────────────────────────────────

/**
 * Height tolerance for 2.5D hit detection.
 *
 * Different bodies have different visual heights (Dictator is tall,
 * Wasp is short), but hit detection should not miss because of this.
 * We add a practical tolerance that accounts for the isometric projection.
 *
 * The tolerance is in tile units and represents an effective "hit zone"
 * expansion that prevents height-related misses.
 */
const HEIGHT_TOLERANCE_TILES = 0.4;

/**
 * Get the effective hit radius including height tolerance.
 *
 * Combines the body's collision radius with a 2.5D height tolerance
 * so that Dictator's visual height doesn't cause misses on Wasp
 * and vice versa.
 */
export function getEffectiveHitRadius(vehicle: BlockoutVehicleState): number {
  const footprint = computeHitFootprint(vehicle);
  return footprint.hitRadiusTiles + HEIGHT_TOLERANCE_TILES;
}

// ─── Direct/rail hit detection ────────────────────────────────────

/**
 * Result of a hit detection check.
 */
export interface HitCheckResult {
  /** Whether the shot hits the target. */
  isHit: boolean;
  /** Reason for hit or miss. */
  reason: 'direct_hit' | 'point_blank_hit' | 'forgiveness_hit' | 'miss_too_far' | 'miss_off_angle' | 'miss_out_of_range' | 'no_target';
  /** Distance from aim line to target footprint edge in tile units. */
  missDistanceTiles: number;
  /** Forgiveness tolerance that was applied in tile units. */
  toleranceTiles: number;
}

/**
 * Check if a direct/rail/beam shot hits a target using projected footprint.
 *
 * This replaces the old screen-distance hit detection. The check uses:
 * 1. Ground-plane distance between attacker and target
 * 2. Target's projected hit footprint (collision radius)
 * 3. Aim forgiveness tolerance per weapon category
 * 4. Point-blank assist for close range
 * 5. 2.5D height tolerance
 *
 * @param attacker - The firing vehicle
 * @param target - The potential target vehicle
 * @param aimAngle - Turret aim angle in radians
 * @param weaponId - Weapon ID for forgiveness lookup
 * @returns Hit check result
 */
export function checkDirectHit(
  attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
  aimAngle: number,
  weaponId: string,
): HitCheckResult {
  // Step 1: Point-blank check
  if (isPointBlank(attacker, target)) {
    const forgiveness = getAimForgiveness(weaponId);
    if (forgiveness.hasPointBlankAssist) {
      return {
        isHit: true,
        reason: 'point_blank_hit',
        missDistanceTiles: 0,
        toleranceTiles: forgiveness.toleranceTiles,
      };
    }
  }

  // Step 2: Compute ground-plane geometry
  const attackerTileX = attacker.gridMovement.ftx;
  const attackerTileY = attacker.gridMovement.fty;
  const targetFootprint = computeHitFootprint(target);
  const effectiveHitRadius = getEffectiveHitRadius(target);

  // Step 3: Compute distance from attacker to target in tile units
  const distToTarget = groundDistanceTiles(attacker, target);

  // Step 4: Range check — weapon must be within maxRange
  const rangeInfo = getWeaponRangeInfo(weaponId);
  if (distToTarget > rangeInfo.maxRange + 0.5) {
    return {
      isHit: false,
      reason: 'miss_out_of_range',
      missDistanceTiles: distToTarget - rangeInfo.maxRange,
      toleranceTiles: 0,
    };
  }

  // Step 5: Compute angular deviation from aim line
  // Convert aim angle to ground-plane direction
  const dx = targetFootprint.centerTileX - attackerTileX;
  const dy = targetFootprint.centerTileY - attackerTileY;
  const angleToTarget = Math.atan2(dy, dx);

  // Angular difference between aim and target direction
  let angleDiff = aimAngle - angleToTarget;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  // Perpendicular distance from target center to aim line
  const perpDistance = Math.abs(Math.sin(angleDiff)) * distToTarget;

  // Step 6: Apply aim forgiveness
  const forgiveness = getAimForgiveness(weaponId);
  const totalTolerance = effectiveHitRadius + forgiveness.toleranceTiles;

  if (perpDistance <= totalTolerance) {
    // Check if it's a direct hit or forgiveness hit
    if (perpDistance <= effectiveHitRadius) {
      return {
        isHit: true,
        reason: 'direct_hit',
        missDistanceTiles: 0,
        toleranceTiles: forgiveness.toleranceTiles,
      };
    } else {
      return {
        isHit: true,
        reason: 'forgiveness_hit',
        missDistanceTiles: perpDistance - effectiveHitRadius,
        toleranceTiles: forgiveness.toleranceTiles,
      };
    }
  }

  return {
    isHit: false,
    reason: perpDistance > totalTolerance + 0.5 ? 'miss_too_far' : 'miss_off_angle',
    missDistanceTiles: perpDistance - totalTolerance,
    toleranceTiles: forgiveness.toleranceTiles,
  };
}

// ─── Cone hit detection ───────────────────────────────────────────

/**
 * Check if a target's footprint is inside a cone from the attacker.
 *
 * Uses ground-plane geometry:
 * - Cone originates from attacker position
 * - Cone extends along turret aim direction
 * - Target footprint overlap with cone = hit
 *
 * @param attacker - The firing vehicle
 * @param target - The potential target
 * @param aimAngle - Turret aim angle in radians
 * @param coneHalfAngleDeg - Cone half-angle in degrees
 * @param rangeTiles - Maximum cone range in tile units
 * @returns Whether the target's footprint overlaps the cone
 */
export function checkConeHit(
  attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
  aimAngle: number,
  coneHalfAngleDeg: number,
  rangeTiles: number,
): boolean {
  const attackerTileX = attacker.gridMovement.ftx;
  const attackerTileY = attacker.gridMovement.fty;
  const targetFootprint = computeHitFootprint(target);
  const effectiveHitRadius = getEffectiveHitRadius(target);

  // Distance to target center
  const dx = targetFootprint.centerTileX - attackerTileX;
  const dy = targetFootprint.centerTileY - attackerTileY;
  const distToTarget = Math.sqrt(dx * dx + dy * dy);

  // Must be within range (plus footprint radius for edge cases)
  if (distToTarget > rangeTiles + effectiveHitRadius) {
    return false;
  }

  // Angle from attacker to target center
  const angleToTarget = Math.atan2(dy, dx);

  // Angular difference
  let angleDiff = aimAngle - angleToTarget;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  // Effective cone angle includes target's footprint as angular size
  const angularSizeOfFootprint = Math.atan2(effectiveHitRadius, distToTarget);
  const effectiveConeHalfAngle = (coneHalfAngleDeg * Math.PI / 180) + angularSizeOfFootprint;

  return Math.abs(angleDiff) <= effectiveConeHalfAngle;
}

// ─── Splash hit detection ────────────────────────────────────────

/**
 * Check if a target is hit by splash damage at a ground-plane impact point.
 *
 * Uses projected ground-plane radius, NOT screen-space circle.
 *
 * @param impactTileX - Impact point tile X
 * @param impactTileY - Impact point tile Y
 * @param target - Potential target
 * @param splashRadiusTiles - Splash radius in tile units
 * @returns Whether the target is within splash radius
 */
export function checkSplashHit(
  impactTileX: number,
  impactTileY: number,
  target: BlockoutVehicleState,
  splashRadiusTiles: number,
): boolean {
  const targetFootprint = computeHitFootprint(target);
  const effectiveHitRadius = getEffectiveHitRadius(target);

  const dx = targetFootprint.centerTileX - impactTileX;
  const dy = targetFootprint.centerTileY - impactTileY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist <= splashRadiusTiles + effectiveHitRadius;
}

/**
 * Find all vehicles hit by splash at a ground-plane impact point.
 *
 * @param firingVehicleId - ID of the firing vehicle (for self-damage check)
 * @param vehicles - All vehicles to check
 * @param impactTileX - Impact point tile X
 * @param impactTileY - Impact point tile Y
 * @param splashRadiusTiles - Splash radius in tile units
 * @param selfDamageScale - Self-damage scale (0 = no self-damage)
 * @returns Array of hit vehicles
 */
export function findSplashTargets(
  firingVehicleId: string,
  vehicles: BlockoutVehicleState[],
  impactTileX: number,
  impactTileY: number,
  splashRadiusTiles: number,
  selfDamageScale: number = 0,
  firingVehicleTeam?: string, // ARENA-VISUAL-COMBAT-FIX-01: team for friendly fire exclusion
): BlockoutVehicleState[] {
  const result: BlockoutVehicleState[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;

    // Skip self if self-damage is disabled
    if (vehicle.id === firingVehicleId && selfDamageScale === 0) continue;

    // ARENA-VISUAL-COMBAT-FIX-01: same-team allies never take splash damage
    if (firingVehicleTeam && vehicle.id !== firingVehicleId && vehicle.team === firingVehicleTeam) continue;

    if (checkSplashHit(impactTileX, impactTileY, vehicle, splashRadiusTiles)) {
      result.push(vehicle);
    }
  }

  return result;
}

// ─── Turret aim check ────────────────────────────────────────────

/** Maximum angle deviation (radians) for turret to be considered "aimed". */
const AIM_TOLERANCE_RAD = 0.15; // ~8.6 degrees

/**
 * Check if the turret is aimed close enough to fire.
 *
 * The turret must be within AIM_TOLERANCE_RAD of the target direction
 * before the weapon can fire. This prevents snap-shooting and ensures
 * the turret rotation animation is visible.
 *
 * @param vehicle - Vehicle with turret
 * @param targetAngle - Angle toward target in radians
 * @returns Whether turret is aimed enough to fire
 */
export function isTurretAimed(
  vehicle: BlockoutVehicleState,
  targetAngle: number,
): boolean {
  let angleDiff = vehicle.turretAngle - targetAngle;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  return Math.abs(angleDiff) <= AIM_TOLERANCE_RAD;
}

/**
 * Get the aim tolerance in radians.
 * Useful for tests.
 */
export function getAimToleranceRad(): number {
  return AIM_TOLERANCE_RAD;
}

// ─── Import for range info ────────────────────────────────────────

import { getWeaponRangeInfo } from './combatRange';
import { TILE_W, TILE_H } from '../config/worldConfig';

// ─── Screen-space ↔ ground-plane angle conversion ──────────────────

/**
 * Convert a screen-space angle to a ground-plane (tile-space) angle.
 *
 * In isometric projection, the same "aim direction" looks different on screen
 * vs the ground plane. The turret angle (turretAngle) is stored as a
 * screen-space angle because it's computed from projected coordinates
 * (angleFromTo with screen X/Y). But the hit model uses tile-space
 * geometry (atan2 of tile deltas), so comparing them directly is wrong.
 *
 * Derivation: A ground direction (dx,dy) in tile space projects to screen as:
 *   screen_dx = dx * basisX.x + dy * basisY.x = (TILE_W/2)*dx - (TILE_W/2)*dy
 *   screen_dy = dx * basisX.y + dy * basisY.y = (TILE_H/2)*dx + (TILE_H/2)*dy
 *
 * Inverting: given screen direction (sx, sy):
 *   dx - dy = 2*sx/TILE_W
 *   dx + dy = 2*sy/TILE_H
 *   dx = (sx/TILE_W + sy/TILE_H)
 *   dy = (sy/TILE_H - sx/TILE_W)
 *
 * Ground angle = atan2(dy, dx)
 *
 * @param screenAngle - Angle in radians from screen-space coordinates
 * @returns Angle in radians in ground-plane/tile-space
 */
export function screenAngleToGroundAngle(screenAngle: number): number {
  const sx = Math.cos(screenAngle);
  const sy = Math.sin(screenAngle);
  // Invert the isometric projection for directions
  const dx = sx / TILE_W + sy / TILE_H;
  const dy = sy / TILE_H - sx / TILE_W;
  return Math.atan2(dy, dx);
}

/**
 * Convert a ground-plane (tile-space) angle to a screen-space angle.
 *
 * Inverse of screenAngleToGroundAngle. Used when we need to convert
 * a tile-space aim direction back to screen-space (e.g., for rendering).
 *
 * Derivation: A ground direction (dx,dy) projects to screen as:
 *   sx = (TILE_W/2)*dx - (TILE_W/2)*dy = (TILE_W/2)*(dx - dy)
 *   sy = (TILE_H/2)*dx + (TILE_H/2)*dy = (TILE_H/2)*(dx + dy)
 *
 * @param groundAngle - Angle in radians from ground-plane/tile-space
 * @returns Angle in radians in screen-space
 */
export function groundAngleToScreenAngle(groundAngle: number): number {
  const dx = Math.cos(groundAngle);
  const dy = Math.sin(groundAngle);
  const sx = (TILE_W / 2) * (dx - dy);
  const sy = (TILE_H / 2) * (dx + dy);
  return Math.atan2(sy, sx);
}
