/**
 * Blockout AI — enemy behavior modes for Arena sandbox.
 *
 * ARENA-05H+: Provides simple AI behavior for enemy units so
 * Denis can test early combat situations, not just static targets.
 *
 * CORE-STEP-06H+: AI now uses grid pathing when the enemy vehicle
 * has useGridMovement=true. This ensures AI units follow the same
 * tile-based pathing rules as player-controlled vehicles.
 *
 * CORE-STEP-07H+: AI now uses the production combat model:
 * - stationary_shooter uses target-lock + stopDistance + projected hit detection
 * - chaser uses range bands (minRange/maxRange/stopDistance) from weapon config
 * - hold_position respects stopDistance/range from weapon config
 * - All AI modes use ground-plane distance (tile units), not screen-space pixels
 *
 * Pure TypeScript, no Phaser, no DOM.
 * AI update is gated to Arena mode — Normal Game is unchanged.
 *
 * Modes:
 * - passive: enemy stands still, does not fire
 * - stationary_shooter: enemy stands still, targets nearest ally, fires
 * - chaser: enemy moves toward nearest ally, stops at stopDistance, fires
 * - hold_position: enemy engages only within hold radius from spawn point
 *
 * Tick rate: AI decisions update at ~200ms intervals for performance.
 * Turret aiming updates every frame (via existing turret rotation system).
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import { startFiring, stopFiring, canFireBlockoutWeapon, isContinuousWeapon } from './blockoutWeaponVfx';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';
import { getEffectiveDamageProfile } from './blockoutUpgrades';
import { angleFromTo } from './angleMath';
import { issueGridMoveCommand, issueGridStopCommand } from './movementStateMachine';
import { screenToTile } from '../phaser/render/isometric';
import { buildOccupancyMap, addUnitBlockers, addVehicleBlockers } from './occupancy';
import { findPath, findPathToAdjacent } from './pathfinding';
import type { GameState } from './types';
import type { TileReservationMap } from './tileReservation';
import {
  groundDistanceTiles,
  getWeaponRangeInfo,
} from './combatRange';
import { isTurretAimed } from './combatHitModel';

// ─── Constants ──────────────────────────────────────────────────────

/** AI tick interval in milliseconds. Decisions are not made every frame. */
export const AI_TICK_INTERVAL_MS = 200;

/** Distance threshold for "in weapon range" (screen-space pixels). */
export const AI_RANGE_TOLERANCE_PX = 20;

/** CORE-STEP-07H+: Range tolerance in tile units for AI range checks. */
export const AI_RANGE_TOLERANCE_TILES = 0.5;

// ─── AI update options ──────────────────────────────────────────────

/** Options for updateBlockoutAi. */
export interface BlockoutAiOptions {
  /** Current scene time in milliseconds. */
  nowMs: number;
  /** Map origin offset for world-to-screen conversions. */
  offsetX: number;
  offsetY: number;
  /**
   * ARENA-05H+ fixup: Callback to fire a single-shot weapon with real VFX/damage.
   * Called when an AI-controlled enemy decides to fire a non-continuous weapon.
   * The callback should use fireBlockoutWeapon() + applyBlockoutWeaponDamage()
   * with the same geometry source of truth as the player fire path.
   * If not provided, single-shot AI weapons will only set fireHeld/isFiring
   * (which produces no VFX or damage).
   */
  fireWeapon?: (enemy: BlockoutVehicleState, target: BlockoutVehicleState, nowMs: number) => void;
  /** CORE-STEP-06H+: Game state for building occupancy maps (grid pathing). */
  gameState?: GameState;
  /** CORE-STEP-06H+: Tile reservation map (grid pathing). */
  reservationMap?: TileReservationMap;
}

// ─── Module-local tick timer ────────────────────────────────────────

let _lastAiTickMs = 0;

/** Reset AI tick timer (for tests). */
export function resetAiTickTimer(): void {
  _lastAiTickMs = 0;
}

// ─── Distance helper ────────────────────────────────────────────────

/** Compute screen-space distance between two vehicles (with offset). */
function vehicleDistance(
  a: BlockoutVehicleState,
  b: BlockoutVehicleState,
  offsetX: number,
  offsetY: number,
): number {
  const ax = a.worldX + offsetX;
  const ay = a.worldY + offsetY;
  const bx = b.worldX + offsetX;
  const by = b.worldY + offsetY;
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compute screen-space distance from vehicle to a point. */
function distanceTo(
  v: BlockoutVehicleState,
  px: number,
  py: number,
  offsetX: number,
  offsetY: number,
): number {
  const vx = v.worldX + offsetX;
  const vy = v.worldY + offsetY;
  const dx = vx - px;
  const dy = vy - py;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Grid pathing helper ──────────────────────────────────────────

/**
 * CORE-STEP-06H+: Issue a grid move command from an enemy toward a target position.
 * Converts screen-space coordinates to tile coordinates, builds an occupancy
 * map with vehicle blockers, finds a path via BFS, and issues the command.
 */
function issueGridMoveToward(
  enemy: BlockoutVehicleState,
  targetWorldX: number,
  targetWorldY: number,
  options: BlockoutAiOptions,
): void {
  if (!enemy.useGridMovement || !options.gameState || !options.reservationMap) {
    // Fallback: set arcade target (targetWorldX/Y are screen-space, no offset)
    enemy.targetWorldX = targetWorldX;
    enemy.targetWorldY = targetWorldY;
    enemy.hasMoveTarget = true;
    return;
  }

  // Convert target from world-space (no offset) to tile coordinates
  // targetWorldX/Y are screen-space (offset already subtracted)
  const tileTarget = screenToTile(targetWorldX, targetWorldY);
  const targetTx = Math.round(tileTarget.x);
  const targetTy = Math.round(tileTarget.y);

  // Build occupancy with vehicle blockers
  const occupancy = buildOccupancyMap(options.gameState);
  if (options.gameState.blockoutVehicles) {
    addVehicleBlockers(options.gameState.blockoutVehicles, occupancy, enemy.id);
  }
  addUnitBlockers(options.gameState, occupancy);

  const fromTx = enemy.gridMovement.currentTileTx;
  const fromTy = enemy.gridMovement.currentTileTy;

  // CORE-STEP-06H+ fixup: If the target tile is impassable (e.g. occupied by ally),
  // path to an adjacent tile instead. This prevents chasers from getting stuck
  // when targeting occupied allies.
  let path = findPath(occupancy, fromTx, fromTy, targetTx, targetTy);

  if (!path) {
    // Target tile is occupied — try pathing to adjacent tile
    path = findPathToAdjacent(occupancy, fromTx, fromTy, targetTx, targetTy, 1, 1);
  }

  if (path && path.length > 0) {
    issueGridMoveCommand(enemy.gridMovement, path, targetTx, targetTy);
    enemy.hasMoveTarget = true;
  } else {
    // No path — fall back to direct target (screen-space, no offset)
    enemy.targetWorldX = targetWorldX;
    enemy.targetWorldY = targetWorldY;
    enemy.hasMoveTarget = true;
  }
}

// ─── Find nearest ally ──────────────────────────────────────────────

/**
 * Find the nearest alive ally vehicle.
 * Returns null if no valid ally exists.
 */
export function findNearestAlly(
  vehicles: BlockoutVehicleState[],
  enemy: BlockoutVehicleState,
  offsetX: number,
  offsetY: number,
  maxRangePx: number = Infinity,
): BlockoutVehicleState | null {
  let nearest: BlockoutVehicleState | null = null;
  let nearestDist = Infinity;

  for (const v of vehicles) {
    if (v.team !== 'ally' || v.isDestroyed) continue;
    const dist = vehicleDistance(enemy, v, offsetX, offsetY);
    if (dist < nearestDist && dist <= maxRangePx) {
      nearestDist = dist;
      nearest = v;
    }
  }

  return nearest;
}

// ─── Weapon range ───────────────────────────────────────────────────

/**
 * Find the nearest alive ally vehicle using ground-plane (tile) distance.
 * FIXUP-2 P2: stationary_shooter should select targets by tile distance
 * because screen-space distance can skip valid tile-range targets.
 *
 * @param vehicles - All vehicles
 * @param enemy - The enemy searching for allies
 * @param maxRangeTiles - Maximum range in tile units (default: Infinity)
 * @returns Nearest alive ally within tile range, or null
 */
export function findNearestAllyByTileDistance(
  vehicles: BlockoutVehicleState[],
  enemy: BlockoutVehicleState,
  maxRangeTiles: number = Infinity,
): BlockoutVehicleState | null {
  let nearest: BlockoutVehicleState | null = null;
  let nearestDist = Infinity;

  for (const v of vehicles) {
    if (v.team !== 'ally' || v.isDestroyed) continue;
    const dist = groundDistanceTiles(enemy, v);
    if (dist < nearestDist && dist <= maxRangeTiles) {
      nearestDist = dist;
      nearest = v;
    }
  }

  return nearest;
}

/** Get the effective weapon range for a vehicle (screen-space pixels). */
export function getWeaponRangePx(vehicle: BlockoutVehicleState): number {
  const baseProfile = DAMAGE_PROFILES[vehicle.weaponId];
  if (!baseProfile) return 0;
  const effectiveProfile = getEffectiveDamageProfile(vehicle, baseProfile);
  return effectiveProfile.rangePx ?? 0;
}

/**
 * CORE-STEP-07H+: Get weapon max range in tile units using production config.
 * Falls back to blockout profile converted to tile units.
 */
function getWeaponMaxRangeTiles(vehicle: BlockoutVehicleState): number {
  return getWeaponRangeInfo(vehicle.weaponId).maxRange;
}



// ─── Turret aim toward target ───────────────────────────────────────

/**
 * Update enemy turret target angle to aim at a target vehicle.
 * Uses the same angle calculation as ally target-lock.
 * Returns true if turret was updated.
 */
export function aimTurretAtTarget(
  enemy: BlockoutVehicleState,
  target: BlockoutVehicleState,
  offsetX: number,
  offsetY: number,
): boolean {
  const fromX = enemy.worldX + offsetX;
  const fromY = enemy.worldY + offsetY;
  const toX = target.worldX + offsetX;
  const toY = target.worldY + offsetY;
  enemy.turretTargetAngle = angleFromTo(fromX, fromY, toX, toY);
  return true;
}

// ─── AI mode handlers ───────────────────────────────────────────────

/**
 * Handle passive mode: enemy does nothing.
 * Ensures enemy is not firing and has no target.
 * CORE-STEP-06H+: Issues grid stop if useGridMovement is active.
 */
function handlePassive(enemy: BlockoutVehicleState, options: BlockoutAiOptions): void {
  // Clear any target the enemy might have
  if (enemy.targetVehicleId !== null) {
    enemy.targetVehicleId = null;
  }
  // Ensure not firing
  if (enemy.fireHeld || enemy.isFiring) {
    stopFiring(enemy);
  }
  // CORE-STEP-06H+: Stop grid movement for passive enemies
  if (enemy.useGridMovement && options.reservationMap) {
    issueGridStopCommand(enemy.gridMovement, options.reservationMap, enemy.id);
  }
  enemy.hasMoveTarget = false;
}

/**
 * ARENA-05H+ fixup: Attempt to fire weapon for an AI enemy.
 *
 * For continuous weapons: sets fireHeld/isFiring so the existing
 * continuous fire loop in GameScene ticks VFX/damage.
 * For single-shot weapons: calls the fireWeapon callback (provided
 * by GameScene) which uses fireBlockoutWeapon() + applyBlockoutWeaponDamage()
 * with the same geometry source of truth as the player fire path.
 */
function tryAiFire(
  enemy: BlockoutVehicleState,
  target: BlockoutVehicleState,
  nowMs: number,
  options: BlockoutAiOptions,
): void {
  if (!canFireBlockoutWeapon(enemy, nowMs)) return;

  if (isContinuousWeapon(enemy.weaponId)) {
    // Continuous weapons: startFiring() sets fireHeld/isFiring so the
    // existing continuous fire loop in GameScene handles VFX/damage ticks.
    if (!enemy.fireHeld) {
      startFiring(enemy);
    }
  } else {
    // Single-shot weapons: call the fireWeapon callback for real VFX/damage.
    // If no callback is provided, fall back to startFiring (VFX-only, no damage).
    if (options.fireWeapon) {
      options.fireWeapon(enemy, target, nowMs);
    } else if (!enemy.fireHeld) {
      startFiring(enemy);
    }
  }
}

/**
 * Handle stationary_shooter mode: enemy stands still, targets nearest ally, fires.
 * CORE-STEP-06H+: Issues grid stop if useGridMovement is active.
 */
function handleStationaryShooter(
  enemy: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  offsetX: number,
  offsetY: number,
  nowMs: number,
  options: BlockoutAiOptions,
): void {
  // CORE-STEP-07H+: Use production weapon config range in tile units
  const maxRangeTiles = getWeaponMaxRangeTiles(enemy);

  // FIXUP-2 P2: Use tile-space distance for target selection.
  // Screen-space findNearestAlly can choose a screen-nearer target that is
  // actually out of tile range, skipping a valid tile-range target.
  const nearestAlly = findNearestAllyByTileDistance(vehicles, enemy, maxRangeTiles + AI_RANGE_TOLERANCE_TILES);

  if (!nearestAlly) {
    // No ally in range — stop targeting/firing
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    // CORE-STEP-06H+: Stationary shooters should not move
    if (enemy.useGridMovement && options.reservationMap) {
      issueGridStopCommand(enemy.gridMovement, options.reservationMap, enemy.id);
    }
    enemy.hasMoveTarget = false;
    return;
  }

  // Set target and aim turret
  enemy.targetVehicleId = nearestAlly.id;
  aimTurretAtTarget(enemy, nearestAlly, offsetX, offsetY);

  // CORE-STEP-06H+: Stationary shooters should not move
  if (enemy.useGridMovement && options.reservationMap) {
    issueGridStopCommand(enemy.gridMovement, options.reservationMap, enemy.id);
  }
  enemy.hasMoveTarget = false;

  // CORE-STEP-07H+: Only fire if turret is aimed enough
  const aimed = isTurretAimed(enemy, enemy.turretTargetAngle);
  if (aimed) {
    tryAiFire(enemy, nearestAlly, nowMs, options);
  }
}

/**
 * Handle chaser mode: enemy moves toward nearest ally, fires when in range.
 * CORE-STEP-06H+: Uses grid pathing when useGridMovement is active.
 */
function handleChaser(
  enemy: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  offsetX: number,
  offsetY: number,
  nowMs: number,
  options: BlockoutAiOptions,
): void {
  // CORE-STEP-07H+: Use production weapon config for range bands
  const rangeInfo = getWeaponRangeInfo(enemy.weaponId);
  const stopDistTiles = rangeInfo.stopDistance;
  const maxRangeTiles = rangeInfo.maxRange;
  const nearestAlly = findNearestAlly(vehicles, enemy, offsetX, offsetY);

  if (!nearestAlly) {
    // No ally at all — stop targeting, firing, and movement
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    // CORE-STEP-06H+: Stop grid movement
    if (enemy.useGridMovement && options.reservationMap) {
      issueGridStopCommand(enemy.gridMovement, options.reservationMap, enemy.id);
    }
    enemy.hasMoveTarget = false;
    return;
  }

  // CORE-STEP-07H+: Use ground-plane tile distance for range check
  const distTiles = groundDistanceTiles(enemy, nearestAlly);

  // Set target and aim turret
  enemy.targetVehicleId = nearestAlly.id;
  aimTurretAtTarget(enemy, nearestAlly, offsetX, offsetY);

  // CORE-STEP-07H+: Use range bands from weapon config
  if (distTiles > stopDistTiles + AI_RANGE_TOLERANCE_TILES) {
    // Out of stop distance — approach using grid pathing toward ally
    // ally worldX/Y are screen-space (no offset), matching targetWorldX/Y convention
    issueGridMoveToward(enemy, nearestAlly.worldX, nearestAlly.worldY, options);
    // CORE-STEP-07H+: Can still fire if within maxRange while approaching
    if (distTiles <= maxRangeTiles + AI_RANGE_TOLERANCE_TILES) {
      // In weapon range but not at stop distance — fire while approaching
      const aimed = isTurretAimed(enemy, enemy.turretTargetAngle);
      if (aimed) {
        tryAiFire(enemy, nearestAlly, nowMs, options);
      }
    }
  } else {
    // At stop distance — stop moving and fire
    // CORE-STEP-06H+: Stop grid movement
    if (enemy.useGridMovement && options.reservationMap) {
      issueGridStopCommand(enemy.gridMovement, options.reservationMap, enemy.id);
    }
    enemy.hasMoveTarget = false;
    // CORE-STEP-07H+: Only fire if turret is aimed enough
    const aimed = isTurretAimed(enemy, enemy.turretTargetAngle);
    if (aimed) {
      tryAiFire(enemy, nearestAlly, nowMs, options);
    }
  }
}

/**
 * Handle hold_position mode: enemy engages only within hold radius.
 * If ally is within hold radius, act like stationary_shooter.
 * If enemy has chased outside hold radius, return to hold position.
 * CORE-STEP-06H+: Uses grid pathing when useGridMovement is active.
 */
function handleHoldPosition(
  enemy: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  offsetX: number,
  offsetY: number,
  nowMs: number,
  options: BlockoutAiOptions,
): void {
  const holdRadius = enemy.aiHoldRadius;

  // Find nearest ally within hold radius
  const nearestAlly = findNearestAlly(vehicles, enemy, offsetX, offsetY, holdRadius);

  // Check if enemy has strayed too far from hold position
  const distFromHold = distanceTo(enemy, enemy.aiHoldX, enemy.aiHoldY, offsetX, offsetY);

  if (distFromHold > holdRadius) {
    // Too far from hold position — return to hold position
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    // CORE-STEP-06H+: Use grid pathing back to hold position
    // aiHoldX/Y are screen-space (no offset)
    issueGridMoveToward(enemy, enemy.aiHoldX, enemy.aiHoldY, options);
    return;
  }

  if (!nearestAlly) {
    // No ally in range — stop targeting/firing
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    // CORE-STEP-06H+: Stop grid movement
    if (enemy.useGridMovement && options.reservationMap) {
      issueGridStopCommand(enemy.gridMovement, options.reservationMap, enemy.id);
    }
    enemy.hasMoveTarget = false;
    return;
  }

  // Ally is within hold radius — aim and fire like stationary_shooter
  enemy.targetVehicleId = nearestAlly.id;
  aimTurretAtTarget(enemy, nearestAlly, offsetX, offsetY);

  // Don't move — hold position just shoots from where it stands
  // CORE-STEP-06H+: Stop grid movement
  if (enemy.useGridMovement && options.reservationMap) {
    issueGridStopCommand(enemy.gridMovement, options.reservationMap, enemy.id);
  }
  enemy.hasMoveTarget = false;

  // CORE-STEP-07H+: Only fire if turret is aimed enough
  // Also validate range using ground-plane distance
  const distTiles = groundDistanceTiles(enemy, nearestAlly);
  const maxRangeTiles = getWeaponMaxRangeTiles(enemy);
  if (distTiles <= maxRangeTiles + AI_RANGE_TOLERANCE_TILES) {
    const aimed = isTurretAimed(enemy, enemy.turretTargetAngle);
    if (aimed) {
      tryAiFire(enemy, nearestAlly, nowMs, options);
    }
  }
}

// ─── Main AI update ─────────────────────────────────────────────────

/**
 * Update AI for all enemy vehicles. ARENA-05H+.
 * CORE-STEP-06H+: Now accepts gameState and reservationMap for grid pathing.
 *
 * Only processes enemies with aiMode !== 'passive'.
 * Allies are skipped entirely (they are player-controlled).
 * AI tick decisions are throttled to AI_TICK_INTERVAL_MS for performance.
 * Turret aiming (via targetVehicleId) is updated every tick.
 *
 * @param vehicles - All blockout vehicles (mutated: enemy state updated)
 * @param options - AI update options (time, offsets, gameState, reservationMap)
 */
export function updateBlockoutAi(
  vehicles: BlockoutVehicleState[],
  options: BlockoutAiOptions,
): void {
  const { nowMs, offsetX, offsetY } = options;

  // Throttle AI tick
  const shouldTick = (nowMs - _lastAiTickMs) >= AI_TICK_INTERVAL_MS;
  if (shouldTick) {
    _lastAiTickMs = nowMs;
  }

  for (const vehicle of vehicles) {
    // Skip allies — they are player-controlled
    if (vehicle.team !== 'enemy') continue;
    // Skip destroyed enemies
    if (vehicle.isDestroyed) continue;

    // Always validate target existence (every frame, cheap check)
    if (vehicle.targetVehicleId) {
      const target = vehicles.find(v => v.id === vehicle.targetVehicleId);
      if (!target || target.isDestroyed) {
        vehicle.targetVehicleId = null;
        if (vehicle.fireHeld || vehicle.isFiring) {
          stopFiring(vehicle);
        }
      }
    }

    // Only run AI decision logic on tick interval
    if (!shouldTick) continue;

    switch (vehicle.aiMode) {
      case 'passive':
        handlePassive(vehicle, options);
        break;
      case 'stationary_shooter':
        handleStationaryShooter(vehicle, vehicles, offsetX, offsetY, nowMs, options);
        break;
      case 'chaser':
        handleChaser(vehicle, vehicles, offsetX, offsetY, nowMs, options);
        break;
      case 'hold_position':
        handleHoldPosition(vehicle, vehicles, offsetX, offsetY, nowMs, options);
        break;
    }
  }
}
