/**
 * Unit movement commands — pure TypeScript, no Phaser.
 *
 * ARCH-05X: Manual move command, resource approach, and harvester
 * manual override for the high-risk movement/control probe.
 *
 * All functions are pure — they mutate GameState directly but have
 * no side effects beyond that. This keeps commands testable.
 */

import type { GameState, HarvesterState, HarvesterBlockedReason } from './types';
import { buildOccupancyMap, isPassable, addUnitBlockers, addVehicleBlockers, isTileOccupiedByUnit } from './occupancy';
import { findPath } from './pathfinding';
import type { SelectableUnit, UnitSelection } from './unitSelection';
import { issueCombatUnitMove, stopCombatUnit } from './combatUnitMovement';

// ─── Constants ──────────────────────────────────────────────────────

/** Harvester movement speed for manual moves (tiles per second). */
const MANUAL_MOVE_SPEED = 2.5;

/** Builder movement speed for manual moves (tiles per second). */
// const BUILDER_MANUAL_SPEED = 3.0; // not currently used directly

/**
 * Distance threshold to consider "arrived" at a path waypoint.
 * ARCH-05Y: Reduced from 0.15 to 0.03 to match the harvester auto-move
 * threshold and eliminate visible waypoint snap. Sub-pixel at this value.
 */
const ARRIVAL_THRESHOLD = 0.03;

/** How long (ms) after manual arrival before harvester returns to auto-gather. */
const MANUAL_COOLDOWN_MS = 800;

// ─── Types ──────────────────────────────────────────────────────────

/** Result of a move command. */
export type MoveResult =
  | { ok: true }
  | { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' | 'target-impassable' | 'target-occupied' | 'no-path' | 'unit-busy' };

/** Result of a resource approach computation. */
export type ApproachResult =
  | { ok: true; approachTx: number; approachTy: number }
  | { ok: false; reason: 'no-adjacent-passable' | 'resource-depleted' | 'resource-not-found' };

// ─── Public API: Manual move command ────────────────────────────────

/**
 * Issue a manual move command to the selected unit.
 *
 * For harvesters:
 * - Interrupts current auto-gather loop.
 * - Moves along a BFS path to the target tile.
 * - Sets phase to 'manual-move' during movement.
 * - On arrival, after a short cooldown, returns to 'idle' which
 *   re-enters the auto-gather loop.
 * - Cargo is preserved — never lost silently.
 *
 * For builders:
 * - Only works if builder is idle and not busy.
 * - Uses BFS path to the target tile.
 * - On arrival, builder becomes idle again.
 *
 * Resources/buildings are treated as impassable tiles.
 */
export function issueManualMove(
  state: GameState,
  unit: SelectableUnit,
  targetTx: number,
  targetTy: number,
): MoveResult {
  const occupancy = buildOccupancyMap(state);

  // Target must be passable
  if (!isPassable(occupancy, targetTx, targetTy)) {
    return { ok: false, reason: 'target-impassable' };
  }

  if (unit.kind === 'harvester') {
    // Target must not be occupied by another unit
    if (isTileOccupiedByUnit(state, targetTx, targetTy, 'harvester', unit.id)) {
      return { ok: false, reason: 'target-occupied' };
    }
    // Add unit blockers so pathfinding avoids other units
    addUnitBlockers(state, occupancy, 'harvester', unit.id);
    // CORE-STEP-06H+ fixup: Also respect combat vehicles and reservations
    if (state.blockoutVehicles) {
      addVehicleBlockers(state.blockoutVehicles, occupancy);
    }
    // Note: reservation blockers not added for manual moves (player intentionality)
    return issueHarvesterManualMove(state, unit.id, targetTx, targetTy, occupancy);
  } else if (unit.kind === 'combat') {
    return issueCombatUnitMove(state, unit.id, targetTx, targetTy);
  } else if (unit.kind === 'builder') {
    // Target must not be occupied by another unit
    if (isTileOccupiedByUnit(state, targetTx, targetTy, 'builder', unit.id)) {
      return { ok: false, reason: 'target-occupied' };
    }
    // Add unit blockers so pathfinding avoids other units
    addUnitBlockers(state, occupancy, 'builder', unit.id);
    // CORE-STEP-06H+ fixup: Also respect combat vehicles
    if (state.blockoutVehicles) {
      addVehicleBlockers(state.blockoutVehicles, occupancy);
    }
    return issueBuilderManualMove(state, unit.id, targetTx, targetTy, occupancy);
  }

  return { ok: false, reason: 'no-unit-selected' };
}

// ─── Harvester manual move ─────────────────────────────────────────

function issueHarvesterManualMove(
  state: GameState,
  harvesterId: string,
  targetTx: number,
  targetTy: number,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): MoveResult {
  const h = state.harvesters.find(h => h.id === harvesterId);
  if (!h) return { ok: false, reason: 'no-unit-selected' };

  const startTx = Math.round(h.ftx);
  const startTy = Math.round(h.fty);

  const path = findPath(occupancy, startTx, startTy, targetTx, targetTy);
  if (!path) return { ok: false, reason: 'no-path' };

  // Override harvester into manual move mode
  h.phase = 'manual-move';
  h.targetResourceId = null; // clear auto target
  // Store path in typed fields on HarvesterState
  h.manualPath = path;
  h.manualPathIndex = 0;
  h.manualCooldownMs = 0;
  h.blockedReason = undefined;
  // Clear any stale approach/return paths from previous auto-gather
  h.approachPath = undefined;
  h.approachPathIndex = undefined;
  h.returnPath = undefined;
  h.returnPathIndex = undefined;

  return { ok: true };
}

// ─── Builder manual move ───────────────────────────────────────────

function issueBuilderManualMove(
  state: GameState,
  builderId: string,
  targetTx: number,
  targetTy: number,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): MoveResult {
  const builder = state.mapData.builders.find(b => b.id === builderId);
  if (!builder) return { ok: false, reason: 'no-unit-selected' };

  // Only idle non-busy builders can be manually moved
  if (builder.busy || builder.phase !== 'idle') {
    return { ok: false, reason: 'unit-busy' };
  }

  const startTx = Math.round(builder.ftx);
  const startTy = Math.round(builder.fty);

  const path = findPath(occupancy, startTx, startTy, targetTx, targetTy);
  if (!path) return { ok: false, reason: 'no-path' };

  builder.phase = 'moving-to-site'; // reuse movement phase
  builder.path = path;
  builder.pathIndex = 0;
  builder.targetTx = targetTx;
  builder.targetTy = targetTy;
  // Mark as manual move so we know to return to idle, not building
  builder.manualMove = true;

  return { ok: true };
}

// ─── Resource approach behavior ─────────────────────────────────────

/**
 * Find the best adjacent approach tile for a resource node.
 *
 * The harvester should NOT move onto the resource tile itself.
 * Instead, it should approach an adjacent passable tile and gather
 * from there.
 *
 * Algorithm:
 * 1. Get all tiles adjacent to the resource footprint.
 * 2. Filter to passable tiles only.
 * 3. Return the one closest to the harvester (by tile distance).
 * 4. If none are passable, return failure.
 */
export function findResourceApproachTile(
  state: GameState,
  harvesterFtx: number,
  harvesterFty: number,
  resourceTx: number,
  resourceTy: number,
  resourceFootprint: number,
): ApproachResult {
  const occupancy = buildOccupancyMap(state);

  // Get adjacent tile candidates around the resource footprint
  const candidates = getAdjacentTiles(resourceTx, resourceTy, resourceFootprint, resourceFootprint, occupancy);

  if (candidates.length === 0) {
    return { ok: false, reason: 'no-adjacent-passable' };
  }

  // Pick the closest candidate to the harvester
  let bestDist = Infinity;
  let bestTile = candidates[0];

  for (const c of candidates) {
    const dx = c.tx - harvesterFtx;
    const dy = c.ty - harvesterFty;
    const dist = dx * dx + dy * dy; // squared distance for comparison
    if (dist < bestDist) {
      bestDist = dist;
      bestTile = c;
    }
  }

  return { ok: true, approachTx: bestTile.tx, approachTy: bestTile.ty };
}

/**
 * Get all passable tiles adjacent to a rectangular footprint.
 *
 * Adjacent means sharing an edge with the footprint boundary
 * (4-connectivity). Only passable tiles are returned.
 */
function getAdjacentTiles(
  tx: number,
  ty: number,
  fpW: number,
  fpH: number,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): Array<{ tx: number; ty: number }> {
  const result: Array<{ tx: number; ty: number }> = [];

  // North edge
  for (let dx = 0; dx < fpW; dx++) {
    const nx = tx + dx;
    const ny = ty - 1;
    if (isPassable(occupancy, nx, ny)) {
      result.push({ tx: nx, ty: ny });
    }
  }

  // South edge
  for (let dx = 0; dx < fpW; dx++) {
    const nx = tx + dx;
    const ny = ty + fpH;
    if (isPassable(occupancy, nx, ny)) {
      result.push({ tx: nx, ty: ny });
    }
  }

  // West edge (excluding corners already checked)
  for (let dy = 0; dy < fpH; dy++) {
    const nx = tx - 1;
    const ny = ty + dy;
    if (isPassable(occupancy, nx, ny)) {
      result.push({ tx: nx, ty: ny });
    }
  }

  // East edge (excluding corners already checked)
  for (let dy = 0; dy < fpH; dy++) {
    const nx = tx + fpW;
    const ny = ty + dy;
    if (isPassable(occupancy, nx, ny)) {
      result.push({ tx: nx, ty: ny });
    }
  }

  return result;
}

// ─── Harvester manual move update (called from updateGameState) ────

/**
 * Update a harvester in 'manual-move' phase.
 *
 * Moves along the BFS path. On arrival, enters a short cooldown,
 * then returns to 'idle' to resume auto-gather. Cargo is preserved.
 *
 * Returns debug reason if blocked.
 */
export function updateHarvesterManualMove(
  _state: GameState,
  h: HarvesterState,
  dt: number,
): HarvesterBlockedReason | null {
  const manualPath = h.manualPath;
  const manualPathIndex = h.manualPathIndex ?? 0;

  // Cooldown phase — waiting before returning to auto-gather
  if ((h.manualCooldownMs ?? 0) > 0) {
    h.manualCooldownMs = (h.manualCooldownMs ?? 0) - dt;
    if ((h.manualCooldownMs ?? 0) <= 0) {
      // Return to idle — auto-gather will resume
      h.phase = 'idle';
      h.manualPath = undefined;
      h.manualPathIndex = undefined;
      h.manualCooldownMs = undefined;
      h.blockedReason = undefined;
    }
    return null;
  }

  if (!manualPath || manualPathIndex >= manualPath.length) {
    // Arrived — start cooldown
    h.manualCooldownMs = MANUAL_COOLDOWN_MS;
    return null;
  }

  // Move toward current waypoint
  const waypoint = manualPath[manualPathIndex];
  const arrived = moveTowardTile(h, waypoint.tx, waypoint.ty, MANUAL_MOVE_SPEED, dt);

  if (arrived) {
    h.ftx = waypoint.tx;
    h.fty = waypoint.ty;
    h.manualPathIndex = manualPathIndex + 1;

    if (h.manualPathIndex >= manualPath.length) {
      // Reached final waypoint — start cooldown
      h.manualCooldownMs = MANUAL_COOLDOWN_MS;
    }
  }

  return null;
}

// ─── Movement helper ───────────────────────────────────────────────

/**
 * Move a unit toward a target tile position.
 * Returns true if arrived (within ARRIVAL_THRESHOLD).
 */
function moveTowardTile(
  unit: { ftx: number; fty: number },
  targetTx: number,
  targetTy: number,
  speed: number,
  dtMs: number,
): boolean {
  const dx = targetTx - unit.ftx;
  const dy = targetTy - unit.fty;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= ARRIVAL_THRESHOLD) return true;

  const step = (speed * dtMs) / 1000;
  const moveDist = Math.min(step, dist);

  unit.ftx += (dx / dist) * moveDist;
  unit.fty += (dy / dist) * moveDist;

  const newDx = targetTx - unit.ftx;
  const newDy = targetTy - unit.fty;
  return Math.sqrt(newDx * newDx + newDy * newDy) <= ARRIVAL_THRESHOLD;
}

// ─── Stop command (CORE-STEP-05H+) ─────────────────────────────────

/** Result of a stop command. */
export type StopResult =
  | { ok: true }
  | { ok: false; reason: 'no-unit-selected' | 'unit-busy' };

/**
 * Stop the selected unit's current command.
 *
 * CORE-STEP-05H+: S key stops the selected unit:
 * - Harvester: clears manual move, clears auto-gather target, returns to idle
 * - Builder: clears manual move, returns to idle if not building
 *
 * Does NOT change unrelated units. Does NOT rewrite movement/pathfinding.
 * Only clears the current command intent/state.
 */
export function stopUnitCommand(
  state: GameState,
  unit: SelectableUnit,
): StopResult {
  if (unit.kind === 'harvester') {
    const h = state.harvesters.find(h => h.id === unit.id);
    if (!h) return { ok: false, reason: 'no-unit-selected' };

    // Clear manual move
    h.manualPath = undefined;
    h.manualPathIndex = undefined;
    h.manualCooldownMs = undefined;

    // If in manual-move, return to idle (auto-gather will resume)
    if (h.phase === 'manual-move') {
      h.phase = 'idle';
    }

    // Clear harvest target if gathering or moving to resource
    if (h.phase === 'gathering' || h.phase === 'moving-to-resource') {
      h.phase = 'idle';
      h.targetResourceId = null;
      h.approachPath = undefined;
      h.approachPathIndex = undefined;
    }

    // Clear return path if returning to HQ
    if (h.phase === 'returning-to-hq') {
      h.phase = 'idle';
      h.returnPath = undefined;
      h.returnPathIndex = undefined;
    }

    // Clear unloading
    if (h.phase === 'unloading') {
      h.phase = 'idle';
    }

    // Clear blocked reason
    h.blockedReason = undefined;

    return { ok: true };
  }

  if (unit.kind === 'combat') {
    return stopCombatUnit(state, unit.id);
  }

  if (unit.kind === 'builder') {
    const builder = state.mapData.builders.find(b => b.id === unit.id);
    if (!builder) return { ok: false, reason: 'no-unit-selected' };

    // Only stop if doing a manual move (not building assignment)
    if (builder.manualMove && builder.phase === 'moving-to-site') {
      builder.phase = 'idle';
      builder.path = [];
      builder.pathIndex = 0;
      builder.manualMove = false;
      return { ok: true };
    }

    // Builder is building or idle — can't stop
    return { ok: false, reason: 'unit-busy' };
  }

  return { ok: false, reason: 'no-unit-selected' };
}

// ─── Multi-unit commands (SELECTION-CONTROL-GROUPS-05) ──────────────

/**
 * Issue a move command to all selected units.
 *
 * Each unit is moved independently. Results are aggregated.
 */
export function issueMultiMoveCommand(
  state: GameState,
  selection: UnitSelection,
  tx: number,
  ty: number,
): { okCount: number; failCount: number } {
  if (!selection) return { okCount: 0, failCount: 0 };

  let okCount = 0;
  let failCount = 0;

  for (const unit of selection.units) {
    const result = issueManualMove(state, unit, tx, ty);
    if (result.ok) {
      okCount++;
    } else {
      failCount++;
    }
  }

  return { okCount, failCount };
}

/**
 * Stop all selected units.
 *
 * Each unit is stopped independently. Results are aggregated.
 */
export function stopUnitsCommand(
  state: GameState,
  selection: UnitSelection,
): { okCount: number; failCount: number } {
  if (!selection) return { okCount: 0, failCount: 0 };

  let okCount = 0;
  let failCount = 0;

  for (const unit of selection.units) {
    const result = stopUnitCommand(state, unit);
    if (result.ok) {
      okCount++;
    } else {
      failCount++;
    }
  }

  return { okCount, failCount };
}

// ─── Path existence check (for debug telemetry) ────────────────────

/**
 * Check whether a path exists from start to target.
 * Returns null if path exists, or a reason string if not.
 */
export function checkPathExists(
  state: GameState,
  startTx: number,
  startTy: number,
  targetTx: number,
  targetTy: number,
): string | null {
  const occupancy = buildOccupancyMap(state);

  if (!isPassable(occupancy, targetTx, targetTy)) {
    return 'target-impassable';
  }

  const path = findPath(occupancy, startTx, startTy, targetTx, targetTy);
  if (!path) {
    return 'no-path';
  }

  return null;
}
