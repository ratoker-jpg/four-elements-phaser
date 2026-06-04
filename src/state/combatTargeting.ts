/**
 * Combat targeting — attack command processing, auto-chase, target management.
 *
 * CORE-STEP-07H+: Implements the combat targeting system:
 * - RMB on enemy sets target-lock (already in input controller)
 * - Auto-chase: if target is out of range, pathfind toward it
 * - Stop at stopDistance when in range
 * - Turret tracks assigned target (not mouse)
 * - Target-lock clears when target dies/invalid
 * - S key clears target-lock and stops chase
 *
 * This module coordinates between the input controller (which sets
 * targetVehicleId) and the movement system (which handles pathing).
 * It is called each frame from the game update loop.
 *
 * Architecture: state layer — no Phaser imports.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { GameState } from './types';
import type { TileReservationMap } from './tileReservation';
import {
  checkRangeBand,
  isAtStopDistance,
  getChaseTargetTile,
  type RangeBandResult,
} from './combatRange';
import { isTurretAimed } from './combatHitModel';
import { buildOccupancyMap, addUnitBlockers, addVehicleBlockers } from './occupancy';
import { findPath, findPathToAdjacent } from './pathfinding';
import { issueGridMoveCommand, issueGridStopCommand } from './movementStateMachine';
import { angleFromTo } from './angleMath';

// ─── Combat state per vehicle ────────────────────────────────────

/** Combat intent for a vehicle — what the vehicle is trying to do. */
export type CombatIntent =
  | 'none'            // no active combat
  | 'approaching'     // moving toward target to get in range
  | 'in_range'        // within range, aiming / firing
  | 'point_blank';    // target is very close

/** Result of a combat targeting update for one vehicle. */
export interface CombatUpdateResult {
  /** Vehicle ID. */
  vehicleId: string;
  /** Current combat intent. */
  intent: CombatIntent;
  /** Current range band. */
  rangeBand: RangeBandResult;
  /** Whether the vehicle should stop moving. */
  shouldStop: boolean;
  /** Whether the vehicle should fire. */
  shouldFire: boolean;
  /** Whether turret is aimed at target. */
  isAimed: boolean;
  /** Debug info. */
  debugInfo: string;
}

/** Options for updateAllCombatTargeting. */
export interface CombatTargetingOptions {
  /** Current scene time in milliseconds. */
  nowMs?: number;
  /**
   * Blocker 2: Callback to auto-fire weapon when shouldFire && isAimed.
   * Called for each vehicle that should fire with a valid target.
   */
  fireWeapon?: (vehicle: BlockoutVehicleState, target: BlockoutVehicleState, nowMs: number) => void;
}

// ─── Target validation ──────────────────────────────────────────────

/**
 * Validate and clean up target-lock for a vehicle.
 *
 * - If target is destroyed, clear target-lock
 * - If target ID is invalid (not found), clear target-lock
 *
 * @returns true if target-lock is still valid, false if cleared
 */
export function validateTargetLock(
  vehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
): boolean {
  if (!vehicle.targetVehicleId) return false;

  const target = vehicles.find(v => v.id === vehicle.targetVehicleId);
  if (!target || target.isDestroyed) {
    vehicle.targetVehicleId = null;
    return false;
  }

  return true;
}

// ─── Combat targeting update ─────────────────────────────────────────

/**
 * Update combat targeting for a single vehicle with an active target-lock.
 *
 * This is the core combat update that decides:
 * 1. Is the target still valid?
 * 2. What range band are we in?
 * 3. Should we approach, stop, or fire?
 * 4. Is the turret aimed enough to fire?
 *
 * This function does NOT directly mutate movement state — it returns
 * a result that the caller uses to drive movement and firing decisions.
 *
 * @param vehicle - Vehicle with target-lock (may be mutated to clear target)
 * @param vehicles - All vehicles (for target lookup)
 * @param attackerScreenX - Attacker's screen-space X for aim angle computation
 * @param attackerScreenY - Attacker's screen-space Y for aim angle computation
 * @param targetScreenX - Target's screen-space X for aim angle computation
 * @param targetScreenY - Target's screen-space Y for aim angle computation
 * @returns Combat update result
 */
export function updateCombatTargeting(
  vehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  attackerScreenX: number,
  attackerScreenY: number,
  targetScreenX: number,
  targetScreenY: number,
): CombatUpdateResult {
  const defaultResult: CombatUpdateResult = {
    vehicleId: vehicle.id,
    intent: 'none',
    rangeBand: 'out_of_range',
    shouldStop: false,
    shouldFire: false,
    isAimed: false,
    debugInfo: 'no-target',
  };

  // Step 1: Validate target
  if (!validateTargetLock(vehicle, vehicles)) {
    return defaultResult;
  }

  const target = vehicles.find(v => v.id === vehicle.targetVehicleId);
  if (!target) {
    vehicle.targetVehicleId = null;
    return defaultResult;
  }

  // Step 2: Check range band
  const rangeInfo = checkRangeBand(vehicle, target);

  // Step 3: Compute turret aim toward target
  // Use passed screen-space coordinates (avoids Phaser import in state layer)
  const targetAngle = angleFromTo(attackerScreenX, attackerScreenY, targetScreenX, targetScreenY);

  // Update turret target angle (turret should track target, not mouse)
  vehicle.turretTargetAngle = targetAngle;

  // Check if turret is aimed enough
  const aimed = isTurretAimed(vehicle, targetAngle);

  // Step 4: Determine combat intent and actions
  let intent: CombatIntent;
  let shouldStop = false;
  let shouldFire = false;

  switch (rangeInfo.band) {
    case 'point_blank':
      intent = 'point_blank';
      shouldStop = true;
      shouldFire = aimed; // Fire when aimed (point-blank assist helps)
      break;

    case 'in_range':
    case 'at_stop':
      intent = 'in_range';
      shouldStop = isAtStopDistance(vehicle, target);
      shouldFire = aimed;
      break;

    case 'out_of_range':
      intent = 'approaching';
      shouldStop = false;
      shouldFire = false;
      break;
  }

  return {
    vehicleId: vehicle.id,
    intent,
    rangeBand: rangeInfo.band,
    shouldStop,
    shouldFire,
    isAimed: aimed,
    debugInfo: `intent=${intent} range=${rangeInfo.band} dist=${rangeInfo.distanceTiles.toFixed(1)} aimed=${aimed}`,
  };
}

// ─── Chase movement ──────────────────────────────────────────────────

/**
 * Issue a chase movement command toward the target.
 *
 * Only issues a new path if the vehicle doesn't already have an
 * active chase path or if the target has moved significantly.
 *
 * Uses the STEP 06 grid movement system.
 */
export function issueChaseCommand(
  vehicle: BlockoutVehicleState,
  target: BlockoutVehicleState,
  gameState: GameState,
  _reservationMap: TileReservationMap,
): void {
  if (!vehicle.useGridMovement) {
    // Fallback: arcade mode — set direct target
    vehicle.targetWorldX = target.worldX;
    vehicle.targetWorldY = target.worldY;
    vehicle.hasMoveTarget = true;
    return;
  }

  const chaseTile = getChaseTargetTile(vehicle, target);

  // Don't reissue path if already chasing the same area
  const gridState = vehicle.gridMovement;
  const isAlreadyChasing = gridState.phase === 'target_chase' ||
    (gridState.phase !== 'idle' && gridState.phase !== 'stopping' &&
     gridState.phase !== 'blocked' &&
     Math.abs(gridState.targetTx - chaseTile.tx) <= 1 &&
     Math.abs(gridState.targetTy - chaseTile.ty) <= 1);

  if (isAlreadyChasing) return;

  // Build occupancy with vehicle blockers
  const occupancy = buildOccupancyMap(gameState);
  if (gameState.blockoutVehicles) {
    addVehicleBlockers(gameState.blockoutVehicles, occupancy, vehicle.id);
  }
  addUnitBlockers(gameState, occupancy);

  const fromTx = gridState.currentTileTx;
  const fromTy = gridState.currentTileTy;

  // Try direct path, then adjacent
  let path = findPath(occupancy, fromTx, fromTy, chaseTile.tx, chaseTile.ty);
  if (!path) {
    path = findPathToAdjacent(occupancy, fromTx, fromTy, chaseTile.tx, chaseTile.ty, 1, 1);
  }

  if (path && path.length > 0) {
    gridState.phase = 'target_chase';
    issueGridMoveCommand(gridState, path, chaseTile.tx, chaseTile.ty);
    vehicle.hasMoveTarget = true;
  }
  // If no path found, vehicle stays put — combat targeting will keep trying
}

/**
 * Stop chase movement for a vehicle.
 */
export function stopChase(
  vehicle: BlockoutVehicleState,
  reservationMap: TileReservationMap,
): void {
  if (vehicle.useGridMovement) {
    issueGridStopCommand(vehicle.gridMovement, reservationMap, vehicle.id);
  }
  vehicle.hasMoveTarget = false;
}

/**
 * Clear target-lock and stop chase for a vehicle.
 * Called when S key is pressed or when target is lost.
 */
export function clearTargetLock(
  vehicle: BlockoutVehicleState,
  reservationMap: TileReservationMap,
): void {
  vehicle.targetVehicleId = null;
  stopChase(vehicle, reservationMap);
}

// ─── Batch combat update ───────────────────────────────────────────

/**
 * Update combat targeting for all vehicles with active target-locks.
 *
 * This is the main entry point for the combat system update loop.
 * It processes all vehicles (both player allies and AI enemies)
 * that have an active targetVehicleId.
 *
 * @param vehicles - All blockout vehicles
 * @param gameState - Game state for pathfinding
 * @param reservationMap - Tile reservation map
 * @param offset - Map offset for screen-space coordinate computation
 * @returns Map of vehicle ID to combat update result
 */
export function updateAllCombatTargeting(
  vehicles: BlockoutVehicleState[],
  gameState: GameState,
  reservationMap: TileReservationMap,
  offset: { x: number; y: number },
  options?: CombatTargetingOptions,
): Map<string, CombatUpdateResult> {
  const results = new Map<string, CombatUpdateResult>();

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;
    if (!vehicle.targetVehicleId) continue;

    const target = vehicles.find(v => v.id === vehicle.targetVehicleId);
    if (!target) {
      // FIXUP-2 Blocker 3: Target ID is missing/invalid — clear target and stop chase
      vehicle.targetVehicleId = null;
      stopChase(vehicle, reservationMap);
      continue;
    }

    // Compute screen-space coordinates for aim angle calculation
    const attackerScreenX = vehicle.worldX + offset.x;
    const attackerScreenY = vehicle.worldY + offset.y;
    const targetScreenX = target.worldX + offset.x;
    const targetScreenY = target.worldY + offset.y;

    const result = updateCombatTargeting(vehicle, vehicles, attackerScreenX, attackerScreenY, targetScreenX, targetScreenY);
    results.set(vehicle.id, result);

    // Drive movement based on combat result
    if (result.intent === 'approaching') {
      // Chase target
      issueChaseCommand(vehicle, target, gameState, reservationMap);
    } else if (result.shouldStop) {
      // Stop at range
      stopChase(vehicle, reservationMap);
    }

    // Blocker 2: Auto-fire when shouldFire and turret aimed
    if (result.shouldFire && result.isAimed && options?.fireWeapon && options.nowMs !== undefined) {
      const fireTarget = vehicles.find(v => v.id === vehicle.targetVehicleId);
      if (fireTarget) {
        options.fireWeapon(vehicle, fireTarget, options.nowMs);
      }
    }

    // Blocker 3: If target became invalid, stop any active chase
    if (result.intent === 'none' && vehicle.targetVehicleId === null) {
      // Target was just cleared by validateTargetLock — stop chase
      stopChase(vehicle, reservationMap);
    }
  }

  return results;
}
