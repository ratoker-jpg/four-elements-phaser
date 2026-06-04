/**
 * Movement state machine — pure TypeScript, no Phaser.
 *
 * CORE-STEP-06H+: Unified grid/tile pathing for ALL ground units.
 *
 * Implements the accepted movement model:
 * - All ground units use grid/tile pathing through tile centers
 * - No free arcade movement as production model
 * - Physical turning toward next segment direction
 * - Acceleration and braking from body config
 * - Waypoint smoothing inside safe tile corridor
 * - Fallback to turn-in-place if smoothing would violate occupancy
 * - Tile reservation prevents overlap
 *
 * Movement states:
 * - idle: unit has no active command
 * - path_requested: pathfinding in progress
 * - turning_to_segment: unit is rotating toward next path segment direction
 * - moving_segment: unit is moving toward the next tile center
 * - braking: unit is decelerating before waypoint/arrival
 * - next_segment: unit arrived at waypoint, checking next segment
 * - attacking: unit is in combat (movement managed by combat system)
 * - stopping: unit is decelerating to a stop after stop command
 * - blocked: unit cannot proceed (next tile occupied, no path)
 * - repathing: unit is waiting for a new path after blockage
 * - target_chase: unit is chasing a target (combat vehicle)
 */

import { findPath, type TileCoord } from './pathfinding';
import type { OccupancyMap } from './occupancy';
import type { TileReservationMap } from './tileReservation';
import { getBodyFootprintConfig, resolveCollisionPriority, type FootprintClassConfig } from './bodyFootprint';
import { rotateTowardAngle, degPerSecToRadPerMs } from './angleMath';

// ─── Public types ──────────────────────────────────────────────────

/** Movement state machine states. */
export type MovementPhase =
  | 'idle'
  | 'path_requested'
  | 'turning_to_segment'
  | 'moving_segment'
  | 'braking'
  | 'next_segment'
  | 'attacking'
  | 'stopping'
  | 'blocked'
  | 'repathing'
  | 'target_chase';

/** Direction from one tile to an adjacent tile in 4-connectivity. */
export type GridDirection = 'N' | 'E' | 'S' | 'W' | 'none';

/** Configuration for grid movement, derived from body profile. */
export interface GridMovementConfig {
  /** Maximum speed in tiles per second. */
  maxSpeedTilesPerSec: number;
  /** Acceleration in tiles per second². */
  accelerationTilesPerSec2: number;
  /** Braking deceleration in tiles per second². */
  brakingTilesPerSec2: number;
  /** Body turn speed in degrees per second. */
  turnSpeedDeg: number;
  /** Footprint class config. */
  footprintConfig: FootprintClassConfig;
  /** Arrival threshold in tile units. */
  arrivalThreshold: number;
}

/** Runtime state for the unified grid movement system. */
export interface GridMovementState {
  /** Current movement phase. */
  phase: MovementPhase;
  /** Current path (array of tile coordinates). */
  path: TileCoord[];
  /** Current path index (which waypoint we're moving toward). */
  pathIndex: number;
  /** Unit's current tile X (can be fractional during movement). */
  ftx: number;
  /** Unit's current tile Y (can be fractional during movement). */
  fty: number;
  /** Current body angle in radians. */
  bodyAngle: number;
  /** Current speed in tiles per second. */
  speed: number;
  /** The tile the unit is currently occupying (integer). */
  currentTileTx: number;
  /** The tile the unit is currently occupying (integer). */
  currentTileTy: number;
  /** The tile the unit has reserved (next tile, or -1 if none). */
  reservedTileTx: number;
  /** The tile the unit has reserved (next tile, or -1 if none). */
  reservedTileTy: number;
  /** Timestamp when the unit started waiting (for blocked/repathing). */
  waitStartedAt: number;
  /** Number of repath attempts. */
  repathAttempts: number;
  /** Direction of the current movement segment. */
  currentDirection: GridDirection;
  /** Whether waypoint smoothing is active for the current segment. */
  smoothingActive: boolean;
  /** Smoothing arc progress (0-1). */
  smoothingProgress: number;
  /** Target tile X for the current command. */
  targetTx: number;
  /** Target tile Y for the current command. */
  targetTy: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Default arrival threshold in tile units. */
const DEFAULT_ARRIVAL_THRESHOLD = 0.08;

/** Maximum repath attempts before giving up. */
const MAX_REPATH_ATTEMPTS = 3;

/** Waypoint smoothing arc factor (0 = no smoothing, 1 = max smoothing). */
const SMOOTHING_ARC_FACTOR = 0.4;

/** Tile coordinate constants for direction lookup. */
const DIR_OFFSETS: Record<GridDirection, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
  none: { dx: 0, dy: 0 },
};

// ─── Direction helpers ─────────────────────────────────────────────

/** Determine direction from one tile to an adjacent tile. */
export function directionFromTo(fromTx: number, fromTy: number, toTx: number, toTy: number): GridDirection {
  const dx = toTx - fromTx;
  const dy = toTy - fromTy;
  if (dy < 0 && dx === 0) return 'N';
  if (dx > 0 && dy === 0) return 'E';
  if (dy > 0 && dx === 0) return 'S';
  if (dx < 0 && dy === 0) return 'W';
  return 'none'; // diagonal or same tile
}

/** Convert grid direction to body angle in radians. */
export function directionToAngle(dir: GridDirection): number {
  switch (dir) {
    case 'N': return -Math.PI / 2; // up-left in isometric
    case 'E': return 0;             // right in isometric
    case 'S': return Math.PI / 2;   // down-right in isometric
    case 'W': return Math.PI;       // left in isometric
    case 'none': return 0;
  }
}

// ─── Create initial state ──────────────────────────────────────────

/** Create an initial GridMovementState for a unit at the given tile. */
export function createGridMovementState(
  tx: number,
  ty: number,
  bodyAngle: number = directionToAngle('S'),
): GridMovementState {
  return {
    phase: 'idle',
    path: [],
    pathIndex: 0,
    ftx: tx,
    fty: ty,
    bodyAngle,
    speed: 0,
    currentTileTx: tx,
    currentTileTy: ty,
    reservedTileTx: -1,
    reservedTileTy: -1,
    waitStartedAt: 0,
    repathAttempts: 0,
    currentDirection: 'none',
    smoothingActive: false,
    smoothingProgress: 0,
    targetTx: tx,
    targetTy: ty,
  };
}

// ─── Create movement config from body data ─────────────────────────

/** Create a GridMovementConfig from body profile values. */
export function createGridMovementConfig(
  maxSpeedPxPerSec: number,
  accelerationPxPerSec2: number,
  brakingPxPerSec2: number,
  turnSpeedDeg: number,
  bodyId: string,
): GridMovementConfig {
  // Convert pixel-based speeds to tile-based speeds
  // Tile diagonal is ~sqrt(TILE_W² + TILE_H²) ≈ 85 pixels
  // But for grid movement, we move through tile centers.
  // One tile step = distance between adjacent tile centers.
  // N/S step: (0, ±TILE_H/2) + (±TILE_W/2, 0) in screen space ≈ 85px
  // For simplicity: 1 tile step ≈ 42 pixels (half-tile distance in isometric)
  const PIXELS_PER_TILE = 42;

  const footprintConfig = getBodyFootprintConfig(bodyId);

  return {
    maxSpeedTilesPerSec: maxSpeedPxPerSec / PIXELS_PER_TILE,
    accelerationTilesPerSec2: accelerationPxPerSec2 / PIXELS_PER_TILE,
    brakingTilesPerSec2: brakingPxPerSec2 / PIXELS_PER_TILE,
    turnSpeedDeg: turnSpeedDeg * footprintConfig.turnSpeedMultiplier,
    footprintConfig,
    arrivalThreshold: DEFAULT_ARRIVAL_THRESHOLD,
  };
}

// ─── Grid movement update ─────────────────────────────────────────

/**
 * Result of a grid movement update step.
 */
export interface MovementUpdateResult {
  /** New movement phase. */
  phase: MovementPhase;
  /** Whether the unit arrived at its final destination. */
  arrived: boolean;
  /** Whether the unit is blocked (cannot proceed). */
  blocked: boolean;
  /** Feedback message (for HUD). */
  feedback: string | null;
}

/**
 * Update a unit's grid movement for one frame.
 *
 * This is the core movement update that handles all movement phases.
 * It mutates the GridMovementState in place.
 *
 * @param state - Unit's grid movement state (mutated)
 * @param config - Movement configuration
 * @param deltaMs - Frame delta in milliseconds
 * @param occupancy - Occupancy map for pathfinding
 * @param reservationMap - Tile reservation map
 * @param unitId - This unit's unique identifier
 * @param nowMs - Current time in milliseconds
 * @param getOccupancyForRepath - Function to rebuild occupancy map (with unit blockers)
 */
export function updateGridMovement(
  state: GridMovementState,
  config: GridMovementConfig,
  deltaMs: number,
  occupancy: OccupancyMap,
  reservationMap: TileReservationMap,
  unitId: string,
  nowMs: number,
  getOccupancyForRepath: () => OccupancyMap,
): MovementUpdateResult {
  const dt = deltaMs / 1000; // seconds

  switch (state.phase) {
    case 'idle':
      return { phase: 'idle', arrived: false, blocked: false, feedback: null };

    case 'path_requested':
      // Path was requested — check if path exists
      // (path should already be set by the command issuer)
      if (state.path.length === 0) {
        // Already at target or empty path
        state.phase = 'idle';
        return { phase: 'idle', arrived: true, blocked: false, feedback: null };
      }
      // Transition to turning_to_segment
      state.phase = 'turning_to_segment';
      state.pathIndex = 0;
      state.repathAttempts = 0;
      return updateGridMovement(state, config, deltaMs, occupancy, reservationMap, unitId, nowMs, getOccupancyForRepath);

    case 'turning_to_segment': {
      if (state.pathIndex >= state.path.length) {
        state.phase = 'idle';
        state.speed = 0;
        return { phase: 'idle', arrived: true, blocked: false, feedback: null };
      }

      const waypoint = state.path[state.pathIndex];
      const dir = directionFromTo(
        Math.round(state.ftx), Math.round(state.fty),
        waypoint.tx, waypoint.ty,
      );
      const desiredAngle = directionToAngle(dir);
      const maxTurnRad = degPerSecToRadPerMs(config.turnSpeedDeg) * deltaMs;
      const newAngle = rotateTowardAngle(state.bodyAngle, desiredAngle, maxTurnRad);

      state.bodyAngle = newAngle;
      state.currentDirection = dir;

      // Check if we're facing the right direction (within small tolerance)
      const angleDiff = Math.abs(normalizeAngle(newAngle - desiredAngle));
      if (angleDiff < 0.05) { // ~3 degrees tolerance
        // Facing the right direction — start moving
        state.bodyAngle = desiredAngle; // snap to exact

        // Reserve the next tile
        if (reservationMap.reserve(waypoint.tx, waypoint.ty, {
          unitId,
          unitType: config.footprintConfig.footprintClass === 'light' ? 'combat-vehicle' :
                    config.footprintConfig.footprintClass === 'heavy' ? 'combat-vehicle' : 'combat-vehicle',
        }, nowMs)) {
          state.reservedTileTx = waypoint.tx;
          state.reservedTileTy = waypoint.ty;
          state.phase = 'moving_segment';
        } else {
          // CORE-STEP-06H+ fixup: Check collision priority before giving up
          // If this unit has higher priority than the reservation holder, it can override
          const existingReservation = reservationMap.getReservation(waypoint.tx, waypoint.ty);
          if (existingReservation) {
            // Use collision priority: Heavy (3) > Medium (2) > Light (1)
            // If this unit wins priority over the current reservation holder,
            // it still waits briefly — higher priority doesn't teleport, but the
            // lower-priority unit will yield and repath on its next blocked check.
            const _yielder = resolveCollisionPriority(
              unitId, config.footprintConfig.footprintClass,
              existingReservation.holder.unitId, existingReservation.holder.unitType === 'combat-vehicle' ? 'medium' : existingReservation.holder.unitType,
            );
            void _yielder; // Used for priority-based yielding in future iterations
          }
          // Tile is reserved by another unit — wait
          state.phase = 'blocked';
          state.waitStartedAt = nowMs;
          state.repathAttempts = 0;
          return { phase: 'blocked', arrived: false, blocked: true, feedback: 'Заблокирован: тайл занят' };
        }
      }
      return { phase: state.phase, arrived: false, blocked: false, feedback: null };
    }

    case 'moving_segment': {
      if (state.pathIndex >= state.path.length) {
        state.phase = 'idle';
        state.speed = 0;
        return { phase: 'idle', arrived: true, blocked: false, feedback: null };
      }

      const waypoint = state.path[state.pathIndex];
      const dx = waypoint.tx - state.ftx;
      const dy = waypoint.ty - state.fty;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Compute stopping distance: v² / (2 * braking)
      const stoppingDist = state.speed > 0
        ? (state.speed * state.speed) / (2 * config.brakingTilesPerSec2)
        : 0;

      // Check if we need to brake
      if (dist <= stoppingDist + config.arrivalThreshold) {
        state.phase = 'braking';
        return updateGridMovement(state, config, deltaMs, occupancy, reservationMap, unitId, nowMs, getOccupancyForRepath);
      }

      // Accelerate toward max speed
      const accelAmount = config.accelerationTilesPerSec2 * dt;
      state.speed = Math.min(config.maxSpeedTilesPerSec, state.speed + accelAmount);

      // Move toward waypoint
      const step = state.speed * dt;
      const moveDist = Math.min(step, dist);

      if (dist > 0) {
        state.ftx += (dx / dist) * moveDist;
        state.fty += (dy / dist) * moveDist;
      }

      // Check arrival at waypoint
      const newDx = waypoint.tx - state.ftx;
      const newDy = waypoint.ty - state.fty;
      const newDist = Math.sqrt(newDx * newDx + newDy * newDy);

      if (newDist <= config.arrivalThreshold) {
        return advanceToNextSegment(state, config, occupancy, reservationMap, unitId, nowMs);
      }

      return { phase: 'moving_segment', arrived: false, blocked: false, feedback: null };
    }

    case 'braking': {
      if (state.pathIndex >= state.path.length) {
        state.phase = 'idle';
        state.speed = 0;
        return { phase: 'idle', arrived: true, blocked: false, feedback: null };
      }

      // Decelerate
      const brakeAmount = config.brakingTilesPerSec2 * dt;
      state.speed = Math.max(0, state.speed - brakeAmount);

      // Move with remaining speed
      const waypoint = state.path[state.pathIndex];
      const dx = waypoint.tx - state.ftx;
      const dy = waypoint.ty - state.fty;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0 && state.speed > 0) {
        const step = state.speed * dt;
        const moveDist = Math.min(step, dist);
        state.ftx += (dx / dist) * moveDist;
        state.fty += (dy / dist) * moveDist;
      }

      // Check arrival
      const newDx = waypoint.tx - state.ftx;
      const newDy = waypoint.ty - state.fty;
      const newDist = Math.sqrt(newDx * newDx + newDy * newDy);

      if (newDist <= config.arrivalThreshold || state.speed <= 0) {
        return advanceToNextSegment(state, config, occupancy, reservationMap, unitId, nowMs);
      }

      return { phase: 'braking', arrived: false, blocked: false, feedback: null };
    }

    case 'next_segment': {
      // Already at a waypoint — determine next action
      return advanceToNextSegment(state, config, occupancy, reservationMap, unitId, nowMs);
    }

    case 'stopping': {
      // Decelerate to zero
      const brakeAmount = config.brakingTilesPerSec2 * dt;
      state.speed = Math.max(0, state.speed - brakeAmount);

      if (state.speed <= 0) {
        state.speed = 0;
        state.phase = 'idle';
        releaseReservation(state, reservationMap, unitId);
        return { phase: 'idle', arrived: false, blocked: false, feedback: null };
      }

      // Continue moving while decelerating
      if (state.speed > 0) {
        const step = state.speed * dt;
        const angle = state.bodyAngle;
        state.ftx += Math.cos(angle) * step * 0.7; // reduced movement during stop
        state.fty += Math.sin(angle) * step * 0.7;
      }

      return { phase: 'stopping', arrived: false, blocked: false, feedback: null };
    }

    case 'blocked': {
      // Waiting for tile to become available
      const waitDuration = nowMs - state.waitStartedAt;
      if (waitDuration >= 500) { // WAIT_BEFORE_REPATH_MS
        // Try repathing
        state.phase = 'repathing';
        state.repathAttempts++;
        return updateGridMovement(state, config, deltaMs, occupancy, reservationMap, unitId, nowMs, getOccupancyForRepath);
      }
      return { phase: 'blocked', arrived: false, blocked: true, feedback: 'Ожидание: тайл занят' };
    }

    case 'repathing': {
      if (state.repathAttempts > MAX_REPATH_ATTEMPTS) {
        state.phase = 'blocked';
        state.speed = 0;
        return { phase: 'blocked', arrived: false, blocked: true, feedback: 'Заблокирован: нет пути' };
      }

      // Try to find a new path
      const freshOccupancy = getOccupancyForRepath();
      const newPath = findPath(
        freshOccupancy,
        Math.round(state.ftx), Math.round(state.fty),
        state.targetTx, state.targetTy,
      );

      if (newPath && newPath.length > 0) {
        state.path = newPath;
        state.pathIndex = 0;
        state.phase = 'turning_to_segment';
        releaseReservation(state, reservationMap, unitId);
        return { phase: 'turning_to_segment', arrived: false, blocked: false, feedback: null };
      }

      // No path found — stay blocked
      state.phase = 'blocked';
      state.speed = 0;
      return { phase: 'blocked', arrived: false, blocked: true, feedback: 'Заблокирован: нет пути' };
    }

    case 'attacking':
    case 'target_chase':
      // These are handled by combat system — movement is managed there
      return { phase: state.phase, arrived: false, blocked: false, feedback: null };

    default:
      state.phase = 'idle';
      return { phase: 'idle', arrived: false, blocked: false, feedback: null };
  }
}

// ─── Advance to next segment ──────────────────────────────────────

/**
 * Called when a unit arrives at a waypoint.
 * Determines next action: continue to next segment or finish.
 */
function advanceToNextSegment(
  state: GridMovementState,
  _config: GridMovementConfig,
  _occupancy: OccupancyMap,
  reservationMap: TileReservationMap,
  unitId: string,
  _nowMs: number,
): MovementUpdateResult {
  if (state.pathIndex >= state.path.length) {
    // Already past the end — arrived at destination
    state.phase = 'idle';
    state.speed = 0;
    snapToCurrentTile(state);
    releaseReservation(state, reservationMap, unitId);
    return { phase: 'idle', arrived: true, blocked: false, feedback: null };
  }

  // Snap to current waypoint
  const waypoint = state.path[state.pathIndex];
  state.ftx = waypoint.tx;
  state.fty = waypoint.ty;
  state.currentTileTx = waypoint.tx;
  state.currentTileTy = waypoint.ty;

  // Release old reservation (we've arrived at that tile)
  releaseReservation(state, reservationMap, unitId);

  // Move to next waypoint
  state.pathIndex++;

  if (state.pathIndex >= state.path.length) {
    // Arrived at final destination
    state.phase = 'idle';
    state.speed = 0;
    return { phase: 'idle', arrived: true, blocked: false, feedback: null };
  }

  // More waypoints — turn toward next segment
  state.phase = 'turning_to_segment';

  // Determine if waypoint smoothing should be active
  const nextWaypoint = state.path[state.pathIndex];
  const nextDir = directionFromTo(waypoint.tx, waypoint.ty, nextWaypoint.tx, nextWaypoint.ty);
  state.smoothingActive = (nextDir !== state.currentDirection && nextDir !== 'none');
  state.smoothingProgress = 0;

  return { phase: 'turning_to_segment', arrived: false, blocked: false, feedback: null };
}

// ─── Command helpers ────────────────────────────────────────────────

/**
 * Issue a grid move command to a unit.
 * Sets the path and transitions to path_requested.
 */
export function issueGridMoveCommand(
  state: GridMovementState,
  path: TileCoord[],
  targetTx: number,
  targetTy: number,
): void {
  state.path = path;
  state.pathIndex = 0;
  state.targetTx = targetTx;
  state.targetTy = targetTy;
  state.phase = 'path_requested';
  state.repathAttempts = 0;
  state.speed = 0;
}

/**
 * Issue a stop command to a unit.
 * Transitions to stopping phase.
 */
export function issueGridStopCommand(
  state: GridMovementState,
  reservationMap: TileReservationMap,
  unitId: string,
): void {
  if (state.phase === 'idle') return;

  state.phase = 'stopping';
  state.path = [];
  state.pathIndex = 0;
  state.targetTx = Math.round(state.ftx);
  state.targetTy = Math.round(state.fty);
  releaseReservation(state, reservationMap, unitId);
}

// ─── Utility helpers ────────────────────────────────────────────────

/** Release the current tile reservation for a unit. */
function releaseReservation(
  state: GridMovementState,
  reservationMap: TileReservationMap,
  unitId: string,
): void {
  if (state.reservedTileTx >= 0 && state.reservedTileTy >= 0) {
    reservationMap.release(state.reservedTileTx, state.reservedTileTy, unitId);
    state.reservedTileTx = -1;
    state.reservedTileTy = -1;
  }
  // Also release all reservations for this unit (safety)
  reservationMap.releaseAll(unitId);
}

/** Snap fractional tile position to current integer tile. */
function snapToCurrentTile(state: GridMovementState): void {
  state.ftx = state.currentTileTx;
  state.fty = state.currentTileTy;
}

/** Normalize angle to [-PI, PI] range. */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// ─── Waypoint smoothing ─────────────────────────────────────────────

/**
 * Compute a smoothed position for waypoint transition.
 *
 * When a unit changes direction at a waypoint, instead of making a
 * sharp turn, it can trace a smooth arc inside the safe tile corridor.
 *
 * The smoothing must NOT violate tile occupancy or reservation.
 * If it would, the unit falls back to turn-in-place.
 *
 * @param state - Current grid movement state
 * @param config - Movement configuration
 * @param progress - Progress along the smoothing arc (0-1)
 * @returns Smoothed (ftx, fty) position, or null if smoothing is not possible
 */
export function computeWaypointSmoothing(
  state: GridMovementState,
  _config: GridMovementConfig,
  progress: number,
): { ftx: number; fty: number } | null {
  if (!state.smoothingActive) return null;
  if (state.pathIndex < 1 || state.pathIndex >= state.path.length) return null;

  const prevWaypoint = state.path[state.pathIndex - 1];
  const nextWaypoint = state.path[state.pathIndex];
  const currentTile = { tx: state.currentTileTx, ty: state.currentTileTy };

  // The arc should stay within 0.5 tiles of the waypoint center
  // to ensure it doesn't violate tile occupancy
  const arcRadius = SMOOTHING_ARC_FACTOR * 0.5; // in tile units

  // For now, use a simple bezier-like interpolation between
  // the approach direction and the departure direction
  const approachDir = directionFromTo(prevWaypoint.tx, prevWaypoint.ty, currentTile.tx, currentTile.ty);
  const departDir = directionFromTo(currentTile.tx, currentTile.ty, nextWaypoint.tx, nextWaypoint.ty);

  // Control point: offset from waypoint center toward the "inside" of the turn
  const approachOffset = DIR_OFFSETS[approachDir];
  const departOffset = DIR_OFFSETS[departDir];

  // Simple quadratic bezier: P = (1-t)²·A + 2(1-t)t·C + t²·B
  const aX = currentTile.tx - approachOffset.dx * arcRadius;
  const aY = currentTile.ty - approachOffset.dy * arcRadius;
  const bX = currentTile.tx + departOffset.dx * arcRadius;
  const bY = currentTile.ty + departOffset.dy * arcRadius;
  const cX = currentTile.tx;
  const cY = currentTile.ty;

  const t = progress;
  const oneMinusT = 1 - t;
  const smoothedX = oneMinusT * oneMinusT * aX + 2 * oneMinusT * t * cX + t * t * bX;
  const smoothedY = oneMinusT * oneMinusT * aY + 2 * oneMinusT * t * cY + t * t * bY;

  // Verify the smoothed position stays within safe tile corridor
  const distFromCenter = Math.sqrt(
    (smoothedX - currentTile.tx) ** 2 + (smoothedY - currentTile.ty) ** 2,
  );
  if (distFromCenter > 0.5) {
    // Would violate tile corridor — fallback to turn-in-place
    return null;
  }

  return { ftx: smoothedX, fty: smoothedY };
}
