/**
 * Combat range system — pure TypeScript, no Phaser.
 *
 * CORE-STEP-07H+: Range band logic, tile-to-screen distance conversion,
 * and stopDistance behavior for the combat model.
 *
 * Uses production weapon config (weaponData.ts) for minRange, idealRange,
 * maxRange, stopDistance in tile units. Converts to screen-space distances
 * using the isometric projection basis for range checks.
 *
 * Architecture: state layer — no Phaser imports.
 */

import { getWeaponConfig } from '../config/weaponData';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';
import type { BlockoutVehicleState } from './blockoutVehicleState';

// ─── Constants ─────────────────────────────────────────────────────

/**
 * Approximate screen-space distance per tile.
 *
 * One tile step in isometric produces roughly 42px of screen distance
 * (basisX/basisY magnitude). This is used to convert tile-unit ranges
 * from weapon config to approximate screen-space distances for range checks.
 *
 * For more precise checks, use ground-plane distance functions.
 */
const APPROX_PX_PER_TILE = 42;

/** Range tolerance in tiles — units within this of maxRange are considered "in range". */
export const RANGE_TOLERANCE_TILES = 0.5;

/** Point-blank range in tiles — targets closer than this get auto-hit. */
export const POINT_BLANK_RANGE_TILES = 1.0;

// ─── Range band types ────────────────────────────────────────────────

/** Result of a range check between attacker and target. */
export type RangeBandResult =
  | 'point_blank'   // target inside minRange — point-blank assist
  | 'in_range'      // target between minRange and maxRange — can fire
  | 'at_stop'       // target at stopDistance — ideal to stop and fire
  | 'out_of_range'; // target beyond maxRange — must approach

/** Detailed range information for a combat unit. */
export interface RangeInfo {
  /** Current range band result. */
  band: RangeBandResult;
  /** Distance to target in tile units (ground-plane). */
  distanceTiles: number;
  /** Minimum range of weapon in tile units. */
  minRange: number;
  /** Ideal range of weapon in tile units. */
  idealRange: number;
  /** Maximum range of weapon in tile units. */
  maxRange: number;
  /** Stop distance of weapon in tile units. */
  stopDistance: number;
}

// ─── Ground-plane distance ────────────────────────────────────────

/**
 * Compute ground-plane distance between two vehicles in tile units.
 *
 * Uses the vehicles' tile positions (tx/ty) for the distance calculation,
 * which is the correct approach for an isometric game where range should
 * be measured on the ground plane, not in screen space.
 *
 * @param a - First vehicle
 * @param b - Second vehicle
 * @returns Distance in tile units
 */
export function groundDistanceTiles(
  a: BlockoutVehicleState,
  b: BlockoutVehicleState,
): number {
  // Use grid movement fractional tile positions for more accuracy
  const ax = a.gridMovement.ftx;
  const ay = a.gridMovement.fty;
  const bx = b.gridMovement.ftx;
  const by = b.gridMovement.fty;
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute ground-plane distance between two points in tile units.
 */
export function groundDistanceTilesBetween(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute approximate screen-space distance between two vehicles.
 * Uses worldX/worldY (screen-space coordinates without offset).
 *
 * Note: Screen-space distance is NOT the same as ground-plane distance
 * due to the isometric projection. Use groundDistanceTiles for range checks
 * and screen-space distance only for legacy compatibility.
 */
export function screenDistancePx(
  a: BlockoutVehicleState,
  b: BlockoutVehicleState,
): number {
  const dx = a.worldX - b.worldX;
  const dy = a.worldY - b.worldY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Weapon range lookup ──────────────────────────────────────────

/**
 * Get the production weapon config's max range in tile units.
 * Falls back to blockout damage profile's rangePx if production config not found.
 */
export function getWeaponMaxRangeTiles(weaponId: string): number {
  const config = getWeaponConfig(weaponId);
  if (config) {
    return config.maxRange;
  }
  // Fallback: blockout damage profile uses screen-space pixels
  // Convert to approximate tile units
  const blockoutRange = DAMAGE_PROFILES[weaponId]?.rangePx ?? 200;
  return blockoutRange / APPROX_PX_PER_TILE;
}

/**
 * Get full range info for a weapon.
 * Uses production config when available, falls back to blockout data.
 */
export function getWeaponRangeInfo(weaponId: string): {
  minRange: number;
  idealRange: number;
  maxRange: number;
  stopDistance: number;
} {
  const config = getWeaponConfig(weaponId);
  if (config) {
    return {
      minRange: config.minRange,
      idealRange: config.idealRange,
      maxRange: config.maxRange,
      stopDistance: config.stopDistance,
    };
  }
  // Fallback for blockout weapons not in production config
  const maxRange = getWeaponMaxRangeTiles(weaponId);
  return {
    minRange: 0,
    idealRange: maxRange * 0.6,
    maxRange,
    stopDistance: maxRange * 0.5,
  };
}

// ─── Range band check ──────────────────────────────────────────────

/**
 * Determine the range band between an attacker and its target.
 *
 * Uses ground-plane tile distance and the weapon's production config ranges.
 * This is the primary range check for the combat model.
 *
 * @param attacker - The attacking vehicle
 * @param target - The target vehicle
 * @returns Range info including band result
 */
export function checkRangeBand(
  attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
): RangeInfo {
  const rangeInfo = getWeaponRangeInfo(attacker.weaponId);
  const dist = groundDistanceTiles(attacker, target);

  let band: RangeBandResult;
  if (dist <= POINT_BLANK_RANGE_TILES) {
    band = 'point_blank';
  } else if (dist < rangeInfo.minRange) {
    // Inside minRange — point-blank assist applies
    band = 'point_blank';
  } else if (dist <= rangeInfo.maxRange + RANGE_TOLERANCE_TILES) {
    if (dist >= rangeInfo.stopDistance - RANGE_TOLERANCE_TILES &&
        dist <= rangeInfo.stopDistance + RANGE_TOLERANCE_TILES) {
      band = 'at_stop';
    } else {
      band = 'in_range';
    }
  } else {
    band = 'out_of_range';
  }

  return {
    band,
    distanceTiles: dist,
    minRange: rangeInfo.minRange,
    idealRange: rangeInfo.idealRange,
    maxRange: rangeInfo.maxRange,
    stopDistance: rangeInfo.stopDistance,
  };
}

/**
 * Check if the attacker should stop approaching (at or within stopDistance).
 */
export function isAtStopDistance(
  attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
): boolean {
  const rangeInfo = getWeaponRangeInfo(attacker.weaponId);
  const dist = groundDistanceTiles(attacker, target);
  return dist <= rangeInfo.stopDistance + RANGE_TOLERANCE_TILES;
}

/**
 * Check if the target is within firing range (minRange to maxRange).
 */
export function isInRange(
  attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
): boolean {
  const rangeInfo = getWeaponRangeInfo(attacker.weaponId);
  const dist = groundDistanceTiles(attacker, target);
  return dist <= rangeInfo.maxRange + RANGE_TOLERANCE_TILES;
}

/**
 * Check if the target is within point-blank range.
 */
export function isPointBlank(
  attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
): boolean {
  const rangeInfo = getWeaponRangeInfo(attacker.weaponId);
  const dist = groundDistanceTiles(attacker, target);
  return dist <= Math.max(POINT_BLANK_RANGE_TILES, rangeInfo.minRange);
}

/**
 * Check if the target is out of range and the attacker must approach.
 */
export function isOutOfRange(
  attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
): boolean {
  const rangeInfo = getWeaponRangeInfo(attacker.weaponId);
  const dist = groundDistanceTiles(attacker, target);
  return dist > rangeInfo.maxRange + RANGE_TOLERANCE_TILES;
}

// ─── Tile conversion for pathfinding ──────────────────────────────

/**
 * Get the tile position that a vehicle should path toward when chasing a target.
 *
 * This is NOT the target's exact tile — it's the tile at stopDistance
 * from the target along the approach direction.
 *
 * For simplicity, we path toward the target's current tile and rely on
 * the range check to stop movement when within stopDistance.
 * The combat targeting update loop handles the stop decision.
 */
export function getChaseTargetTile(
  _attacker: BlockoutVehicleState,
  target: BlockoutVehicleState,
): { tx: number; ty: number } {
  // Path toward the target's current tile position.
  // The combat update will stop movement when stopDistance is reached.
  return {
    tx: target.gridMovement.ftx > 0 ? Math.round(target.gridMovement.ftx) : target.tx,
    ty: target.gridMovement.fty > 0 ? Math.round(target.gridMovement.fty) : target.ty,
  };
}

/**
 * Get weapon stopDistance in tile units for a weapon.
 */
export function getStopDistanceTiles(weaponId: string): number {
  return getWeaponRangeInfo(weaponId).stopDistance;
}
