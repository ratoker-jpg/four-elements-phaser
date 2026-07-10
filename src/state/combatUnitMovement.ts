/**
 * Canonical Normal Game movement lifecycle for factory-produced combat units.
 *
 * This module operates directly on GameState.combatUnits. It does not create
 * BlockoutVehicleState or a parallel Arena runtime.
 */

import type { CombatUnitRuntimeState, GameState, ModularCombatUnit } from './types';
import { normalizeCombatUnitRuntime } from './combatUnits';
import {
  addUnitBlockers,
  addVehicleBlockers,
  buildOccupancyMap,
  isPassable,
  isTileOccupiedByUnit,
} from './occupancy';
import { findPath } from './pathfinding';
import { directionFromDelta } from './unitDirection';

const ARRIVAL_THRESHOLD = 0.03;

export type CombatStopResult =
  | { ok: true }
  | { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' };

export type CombatMoveResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'no-unit-selected'
        | 'unit-destroyed'
        | 'target-impassable'
        | 'target-occupied'
        | 'no-path';
    };

export function issueCombatUnitMove(
  state: GameState,
  unitId: string,
  targetTx: number,
  targetTy: number,
): CombatMoveResult {
  const unit = state.combatUnits.find(candidate => candidate.id === unitId);
  if (!unit) return { ok: false, reason: 'no-unit-selected' };

  const runtime = normalizeCombatUnitRuntime(unit);
  if (runtime.isDestroyed) return { ok: false, reason: 'unit-destroyed' };

  const occupancy = buildOccupancyMap(state);
  if (!isPassable(occupancy, targetTx, targetTy)) {
    return { ok: false, reason: 'target-impassable' };
  }
  if (isTileOccupiedByUnit(state, targetTx, targetTy, 'combat', unit.id)) {
    return { ok: false, reason: 'target-occupied' };
  }

  addUnitBlockers(state, occupancy, 'combat', unit.id);
  if (state.blockoutVehicles) addVehicleBlockers(state.blockoutVehicles, occupancy);

  const startTx = Math.round(runtime.ftx);
  const startTy = Math.round(runtime.fty);
  const path = findPath(occupancy, startTx, startTy, targetTx, targetTy);
  if (!path) return { ok: false, reason: 'no-path' };

  runtime.targetId = null;
  runtime.isWindingUp = false;
  runtime.windUpRemainingMs = 0;
  runtime.windUpTargetId = null;
  runtime.weaponCooldownMs = Math.max(0, runtime.weaponCooldownMs);
  runtime.path = path;
  runtime.pathIndex = 0;
  runtime.order = path.length === 0
    ? { kind: 'idle' }
    : { kind: 'move', targetTx, targetTy };

  if (path.length === 0) {
    runtime.ftx = targetTx;
    runtime.fty = targetTy;
    unit.tx = targetTx;
    unit.ty = targetTy;
  }

  return { ok: true };
}

export function stopCombatUnit(state: GameState, unitId: string): CombatStopResult {
  const unit = state.combatUnits.find(candidate => candidate.id === unitId);
  if (!unit) return { ok: false, reason: 'no-unit-selected' };

  const runtime = normalizeCombatUnitRuntime(unit);
  if (runtime.isDestroyed) return { ok: false, reason: 'unit-destroyed' };

  runtime.order = { kind: 'idle' };
  runtime.path = [];
  runtime.pathIndex = 0;
  runtime.targetId = null;
  runtime.isWindingUp = false;
  runtime.windUpRemainingMs = 0;
  runtime.windUpTargetId = null;
  return { ok: true };
}

export function updateCombatUnitMovement(unit: ModularCombatUnit, deltaMs: number): void {
  const runtime = normalizeCombatUnitRuntime(unit);
  if (runtime.isDestroyed || runtime.order.kind === 'idle') return;
  if (runtime.order.kind === 'attack' && runtime.path.length === 0) return;

  if (runtime.pathIndex >= runtime.path.length) {
    finishMove(unit, runtime);
    return;
  }

  const waypoint = runtime.path[runtime.pathIndex];
  const dx = waypoint.tx - runtime.ftx;
  const dy = waypoint.ty - runtime.fty;
  const distance = Math.hypot(dx, dy);

  if (distance > 0.001) {
    unit.dir = directionFromDelta(dx, dy);
    unit.turretDir ??= unit.dir;
  }

  if (distance <= ARRIVAL_THRESHOLD) {
    runtime.ftx = waypoint.tx;
    runtime.fty = waypoint.ty;
    runtime.pathIndex += 1;
  } else {
    const step = Math.min((runtime.speedTilesPerSecond * Math.min(deltaMs, 200)) / 1000, distance);
    runtime.ftx += (dx / distance) * step;
    runtime.fty += (dy / distance) * step;

    if (Math.hypot(waypoint.tx - runtime.ftx, waypoint.ty - runtime.fty) <= ARRIVAL_THRESHOLD) {
      runtime.ftx = waypoint.tx;
      runtime.fty = waypoint.ty;
      runtime.pathIndex += 1;
    }
  }

  unit.tx = Math.round(runtime.ftx);
  unit.ty = Math.round(runtime.fty);
  if (runtime.pathIndex >= runtime.path.length) finishMove(unit, runtime);
}

export function updateAllCombatUnitMovement(state: GameState, deltaMs: number): void {
  for (const unit of state.combatUnits) updateCombatUnitMovement(unit, deltaMs);
}

function finishMove(unit: ModularCombatUnit, runtime: CombatUnitRuntimeState): void {
  const moveOrder = runtime.order.kind === 'move' ? runtime.order : null;
  if (moveOrder) {
    runtime.ftx = moveOrder.targetTx;
    runtime.fty = moveOrder.targetTy;
    unit.tx = moveOrder.targetTx;
    unit.ty = moveOrder.targetTy;
  }
  runtime.path = [];
  runtime.pathIndex = 0;
  if (moveOrder) runtime.order = { kind: 'idle' };
}
