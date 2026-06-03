/**
 * Blockout vehicle movement update — pure TypeScript, no Phaser dependencies.
 *
 * BLOCKOUT-04H+: Semi-physics movement for blockout vehicles.
 * Vehicles accelerate, brake, and turn gradually.
 * Movement profile determines per-body feel.
 *
 * CORE-STEP-06H+: Grid-based movement integration.
 * When vehicle.useGridMovement is true, the grid movement state machine
 * handles pathing, and this module syncs worldX/worldY from grid state.
 * When false, the old arcade movement is used for backward compatibility.
 *
 * All positions are in screen-space pixels (worldX/worldY).
 * Offset is NOT included — caller adds offset for rendering/input.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { MovementProfile } from '../config/blockoutProfiles';
import type { BlockoutObstacleState } from './blockoutObstacleState';
import { rotateTowardAngle, degPerSecToRadPerMs } from './angleMath';
import { resolveVehicleObstacleCollisions } from './blockoutObstacles';
import { getBodyPixelSize } from '../phaser/render/blockoutVehicleGeometry';
import { tileToScreen, screenToTile } from '../phaser/render/isometric';
import {
  updateGridMovement,
  createGridMovementConfig,
  issueGridMoveCommand,
  issueGridStopCommand,
} from './movementStateMachine';
import type { OccupancyMap } from './occupancy';
import { buildOccupancyMap, addUnitBlockers, addVehicleBlockers } from './occupancy';
import type { TileReservationMap } from './tileReservation';
import { findPath } from './pathfinding';

// ─── Tile coordinate constants ────────────────────────────────────

/** Tile width in pixels (from worldConfig). */
const TILE_W = 76;
/** Tile height in pixels (from worldConfig). */
const TILE_H = 38;

// ─── Movement update ──────────────────────────────────────────────

/**
 * Update a blockout vehicle's movement for one frame.
 *
 * CORE-STEP-06H+: When vehicle.useGridMovement is true, uses the grid
 * movement state machine. When false, falls back to arcade movement.
 *
 * @param vehicle - Vehicle state (mutated in place)
 * @param profile - Movement profile for this vehicle's body
 * @param deltaMs - Frame delta in milliseconds
 * @param obstacles - List of obstacles to check (arcade mode only)
 * @param occupancy - Occupancy map for pathfinding (grid mode)
 * @param reservationMap - Tile reservation map (grid mode)
 * @param getOccupancyForRepath - Function to rebuild occupancy for repathing (grid mode)
 */
export function updateBlockoutVehicleMovement(
  vehicle: BlockoutVehicleState,
  profile: MovementProfile,
  deltaMs: number,
  obstacles: BlockoutObstacleState[] = [],
  occupancy?: OccupancyMap,
  reservationMap?: TileReservationMap,
  getOccupancyForRepath?: () => OccupancyMap,
): void {
  // BLOCKOUT-07H+: Destroyed vehicles don't move
  if (vehicle.isDestroyed) return;

  // CORE-STEP-06H+: Grid movement path
  if (vehicle.useGridMovement && occupancy && reservationMap) {
    updateGridMovementPath(vehicle, profile, deltaMs, occupancy, reservationMap, getOccupancyForRepath);
    return;
  }

  // ── Arcade movement fallback (useGridMovement=false) ────────────
  updateArcadeMovement(vehicle, profile, deltaMs, obstacles);
}

// ─── Grid movement update ────────────────────────────────────────

/**
 * CORE-STEP-06H+: Update grid movement for a blockout vehicle.
 *
 * 1. Build GridMovementConfig from MovementProfile
 * 2. Call updateGridMovement()
 * 3. Sync worldX/worldY from ftx/fty via tileToScreen
 * 4. Sync tx/ty from currentTileTx/currentTileTy
 */
function updateGridMovementPath(
  vehicle: BlockoutVehicleState,
  profile: MovementProfile,
  deltaMs: number,
  occupancy: OccupancyMap,
  reservationMap: TileReservationMap,
  getOccupancyForRepath?: () => OccupancyMap,
): void {
  const config = createGridMovementConfig(
    profile.maxSpeedPxPerSec,
    profile.accelerationPxPerSec2,
    profile.brakingPxPerSec2,
    profile.turnSpeedDeg,
    vehicle.bodyId,
  );

  const repathFn = getOccupancyForRepath ?? (() => occupancy);

  updateGridMovement(
    vehicle.gridMovement,
    config,
    deltaMs,
    occupancy,
    reservationMap,
    vehicle.id,
    Date.now(),
    repathFn,
  );

  // Sync worldX/worldY from grid movement fractional tile position
  const screen = tileToScreen(vehicle.gridMovement.ftx, vehicle.gridMovement.fty);
  vehicle.worldX = screen.x;
  vehicle.worldY = screen.y;

  // Sync tx/ty from current tile
  vehicle.tx = vehicle.gridMovement.currentTileTx;
  vehicle.ty = vehicle.gridMovement.currentTileTy;

  // Sync bodyAngle from grid movement
  vehicle.bodyAngle = vehicle.gridMovement.bodyAngle;

  // Sync speed (approximate, for debug display / backward compat)
  vehicle.speed = vehicle.gridMovement.speed * 42; // tiles/sec → approximate px/sec
  vehicle.vx = Math.cos(vehicle.bodyAngle) * vehicle.speed;
  vehicle.vy = Math.sin(vehicle.bodyAngle) * vehicle.speed;

  // Sync hasMoveTarget from grid movement phase
  vehicle.hasMoveTarget = vehicle.gridMovement.phase !== 'idle' &&
    vehicle.gridMovement.phase !== 'stopping' &&
    vehicle.gridMovement.phase !== 'blocked';
}

// ─── Arcade movement (legacy fallback) ───────────────────────────

/**
 * Legacy arcade movement for blockout vehicles (useGridMovement=false).
 * BLOCKOUT-04H+: Original semi-physics movement.
 */
function updateArcadeMovement(
  vehicle: BlockoutVehicleState,
  profile: MovementProfile,
  deltaMs: number,
  obstacles: BlockoutObstacleState[],
): void {
  // BLOCKOUT-09H fixup: Caller (GameScene) passes the effective profile
  // (with upgrade modifiers already applied). Do NOT re-apply here.
  const effectiveProfile = profile;

  const dt = deltaMs / 1000; // seconds

  if (!vehicle.hasMoveTarget) {
    // No target — decelerate to zero
    if (vehicle.speed > 0) {
      const brakeAmount = effectiveProfile.brakingPxPerSec2 * dt;
      vehicle.speed = Math.max(0, vehicle.speed - brakeAmount);
    }
    // Update velocity from body angle and speed
    vehicle.vx = Math.cos(vehicle.bodyAngle) * vehicle.speed;
    vehicle.vy = Math.sin(vehicle.bodyAngle) * vehicle.speed;
    // Update position
    vehicle.worldX += vehicle.vx * dt;
    vehicle.worldY += vehicle.vy * dt;
    // BLOCKOUT-08H: Resolve obstacle collisions
    resolveObstacleCollisions(vehicle, obstacles);
    // Update tile position
    updateTileFromScreen(vehicle);
    return;
  }

  // Compute vector to target (in screen space)
  const dx = vehicle.targetWorldX - vehicle.worldX;
  const dy = vehicle.targetWorldY - vehicle.worldY;
  const distToTarget = Math.sqrt(dx * dx + dy * dy);

  // Compute desired body angle (toward target)
  const desiredAngle = Math.atan2(dy, dx);

  // Rotate body toward desired angle (rate-limited by turnSpeedDeg)
  const maxTurnRad = degPerSecToRadPerMs(effectiveProfile.turnSpeedDeg) * deltaMs;
  vehicle.bodyAngle = rotateTowardAngle(vehicle.bodyAngle, desiredAngle, maxTurnRad);

  // Check arrival
  if (distToTarget <= effectiveProfile.arrivalRadiusPx) {
    // Arrived at target
    vehicle.hasMoveTarget = false;
    vehicle.speed = 0;
    vehicle.vx = 0;
    vehicle.vy = 0;
    // Snap to target to avoid residual drift
    vehicle.worldX = vehicle.targetWorldX;
    vehicle.worldY = vehicle.targetWorldY;
    updateTileFromScreen(vehicle);
    return;
  }

  // Compute stopping distance: v² / (2 * braking)
  const stoppingDist = vehicle.speed > 0
    ? (vehicle.speed * vehicle.speed) / (2 * effectiveProfile.brakingPxPerSec2)
    : 0;

  if (distToTarget <= stoppingDist + effectiveProfile.arrivalRadiusPx) {
    // Need to brake — slow down
    const brakeAmount = effectiveProfile.brakingPxPerSec2 * dt;
    vehicle.speed = Math.max(0, vehicle.speed - brakeAmount);
  } else {
    // Accelerate toward max speed
    const accelAmount = effectiveProfile.accelerationPxPerSec2 * dt;
    vehicle.speed = Math.min(effectiveProfile.maxSpeedPxPerSec, vehicle.speed + accelAmount);
  }

  // Update velocity from body angle and speed
  vehicle.vx = Math.cos(vehicle.bodyAngle) * vehicle.speed;
  vehicle.vy = Math.sin(vehicle.bodyAngle) * vehicle.speed;

  // Update position
  vehicle.worldX += vehicle.vx * dt;
  vehicle.worldY += vehicle.vy * dt;

  // BLOCKOUT-08H: Resolve obstacle collisions
  resolveObstacleCollisions(vehicle, obstacles);

  // Update tile position
  updateTileFromScreen(vehicle);
}

// ─── Tile position update ─────────────────────────────────────────

/**
 * Update tx/ty from screen-space worldX/worldY.
 *
 * Uses the inverse of tileToScreen:
 *   screen.x = (tx - ty) * TILE_W / 2
 *   screen.y = (tx + ty) * TILE_H / 2
 *
 * Inverse:
 *   tx = (screen.x / halfW + screen.y / halfH) / 2
 *   ty = (screen.y / halfH - screen.x / halfW) / 2
 */
function updateTileFromScreen(vehicle: BlockoutVehicleState): void {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const newTx = (vehicle.worldX / halfW + vehicle.worldY / halfH) / 2;
  const newTy = (vehicle.worldY / halfH - vehicle.worldX / halfW) / 2;
  vehicle.tx = Math.round(newTx);
  vehicle.ty = Math.round(newTy);
}

// ─── Movement target helpers ──────────────────────────────────────

/**
 * Set a movement target for a blockout vehicle.
 *
 * CORE-STEP-06H+: When useGridMovement is true, converts screen
 * coordinates to tile coordinates, finds a path via BFS, and issues
 * a grid move command. When false, uses the old arcade target.
 *
 * @param vehicle - Vehicle state
 * @param screenX - Target X in screen-space pixels (world coords minus offset)
 * @param screenY - Target Y in screen-space pixels (world coords minus offset)
 * @param state - Game state (for building occupancy map with vehicle blockers)
 * @param reservationMap - Tile reservation map (grid mode)
 */
export function setBlockoutVehicleMoveTarget(
  vehicle: BlockoutVehicleState,
  screenX: number,
  screenY: number,
  state?: import('./types').GameState,
  reservationMap?: TileReservationMap,
): void {
  if (vehicle.useGridMovement && state && reservationMap) {
    // CORE-STEP-06H+: Grid pathing
    const tileTarget = screenToTile(screenX, screenY);
    const targetTx = Math.round(tileTarget.x);
    const targetTy = Math.round(tileTarget.y);

    // Build occupancy map with vehicle blockers (excluding this vehicle)
    const occupancy = buildOccupancyMap(state);
    if (state.blockoutVehicles) {
      addVehicleBlockers(state.blockoutVehicles, occupancy, vehicle.id);
    }
    addUnitBlockers(state, occupancy);

    // Find path from current tile to target
    const fromTx = vehicle.gridMovement.currentTileTx;
    const fromTy = vehicle.gridMovement.currentTileTy;
    const path = findPath(occupancy, fromTx, fromTy, targetTx, targetTy);

    if (path) {
      issueGridMoveCommand(vehicle.gridMovement, path, targetTx, targetTy);
      vehicle.hasMoveTarget = true;
    } else {
      // No path found — vehicle stays put
      vehicle.hasMoveTarget = false;
    }
    return;
  }

  // Arcade mode fallback
  vehicle.targetWorldX = screenX;
  vehicle.targetWorldY = screenY;
  vehicle.hasMoveTarget = true;
}

/**
 * Clear the movement target for a blockout vehicle.
 *
 * CORE-STEP-06H+: When useGridMovement is true, issues a grid stop command.
 */
export function clearBlockoutVehicleMoveTarget(
  vehicle: BlockoutVehicleState,
  reservationMap?: TileReservationMap,
): void {
  if (vehicle.useGridMovement && reservationMap) {
    // CORE-STEP-06H+: Grid stop
    issueGridStopCommand(vehicle.gridMovement, reservationMap, vehicle.id);
  }
  vehicle.hasMoveTarget = false;
}

// ─── Obstacle collision helper ──────────────────────────────────────

/**
 * Resolve obstacle collisions for a blockout vehicle.
 * BLOCKOUT-08H: Clamps vehicle position outside obstacles and adjusts velocity.
 *
 * @param vehicle - Vehicle state (mutated in place)
 * @param obstacles - List of obstacles to check
 */
function resolveObstacleCollisions(
  vehicle: BlockoutVehicleState,
  obstacles: BlockoutObstacleState[],
): void {
  if (obstacles.length === 0) return;

  const bodySize = getBodyPixelSize(vehicle.bodyId);
  const vehicleRadius = Math.max(bodySize.w, bodySize.h) / 2 + 4; // 4px padding

  const result = resolveVehicleObstacleCollisions(
    vehicle.worldX, vehicle.worldY,
    vehicleRadius,
    vehicle.vx, vehicle.vy,
    obstacles,
  );

  vehicle.worldX = result.worldX;
  vehicle.worldY = result.worldY;
  vehicle.vx = result.vx;
  vehicle.vy = result.vy;

  // Recalculate speed from updated velocity
  vehicle.speed = Math.sqrt(result.vx * result.vx + result.vy * result.vy);

  // If collision happened and vehicle is nearly stopped, clear move target
  if (result.collided && vehicle.speed < 2) {
    vehicle.speed = 0;
    vehicle.vx = 0;
    vehicle.vy = 0;
  }
}
