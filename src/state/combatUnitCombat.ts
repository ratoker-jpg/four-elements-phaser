/**
 * Canonical Normal Game combat lifecycle for factory-produced tanks.
 *
 * Pure TypeScript. Uses production body/weapon configs directly and keeps
 * GameState.combatUnits as the only source of truth.
 */

import type { GameState, ModularCombatUnit, ModLevel } from './types';
import { normalizeCombatUnitRuntime } from './combatUnits';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';
import { applyArmorReduction, getEffectiveTurretTurnSpeed } from './bodyCombatStats';
import {
  addUnitBlockers,
  addVehicleBlockers,
  buildOccupancyMap,
} from './occupancy';
import { findPathToAdjacent } from './pathfinding';
import {
  directionFromScreenAngle,
  rotateAngleTowards,
  screenAngleFromDelta,
  shortestAngleDelta,
} from './unitDirection';

export const PRODUCTION_COMBAT_WRECK_LIFETIME_MS = 1800;
export const PRODUCTION_COMBAT_EXPLOSION_MS = 450;
export const PRODUCTION_COMBAT_MUZZLE_FLASH_MS = 160;
export const PRODUCTION_COMBAT_DAMAGE_FLASH_MS = 180;
export const PRODUCTION_COMBAT_REPATH_MS = 400;
export const PRODUCTION_COMBAT_AIM_TOLERANCE_DEG = 12;

const MOD_INDEX: Record<ModLevel, 0 | 1 | 2 | 3> = {
  m0: 0,
  m1: 1,
  m2: 2,
  m3: 3,
};

export type CombatAttackResult =
  | { ok: true }
  | { ok: false; reason: 'attacker-not-found' | 'target-not-found' | 'attacker-destroyed' | 'target-destroyed' | 'friendly-target' };

export interface CombatDamageResult {
  rawDamage: number;
  finalDamage: number;
  killed: boolean;
}

export function issueCombatUnitAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
): CombatAttackResult {
  const attacker = state.combatUnits.find(unit => unit.id === attackerId);
  if (!attacker) return { ok: false, reason: 'attacker-not-found' };
  const target = state.combatUnits.find(unit => unit.id === targetId);
  if (!target) return { ok: false, reason: 'target-not-found' };

  const attackerRuntime = normalizeCombatUnitRuntime(attacker);
  const targetRuntime = normalizeCombatUnitRuntime(target);
  if (attackerRuntime.isDestroyed) return { ok: false, reason: 'attacker-destroyed' };
  if (targetRuntime.isDestroyed) return { ok: false, reason: 'target-destroyed' };
  if (attacker.faction === target.faction) return { ok: false, reason: 'friendly-target' };

  attackerRuntime.order = { kind: 'attack', targetId };
  attackerRuntime.targetId = targetId;
  attackerRuntime.path = [];
  attackerRuntime.pathIndex = 0;
  attackerRuntime.isWindingUp = false;
  attackerRuntime.windUpRemainingMs = 0;
  attackerRuntime.windUpTargetId = null;
  attackerRuntime.repathCooldownMs = 0;
  return { ok: true };
}

export function updateAllCombatUnitCombat(state: GameState, deltaMs: number): void {
  const dt = Math.min(Math.max(deltaMs, 0), 200);
  state.combatClockMs = Math.max(0, state.combatClockMs ?? 0) + dt;
  const clock = state.combatClockMs;
  const units = state.combatUnits ?? [];

  for (const unit of units) {
    const runtime = normalizeCombatUnitRuntime(unit);
    runtime.weaponCooldownMs = Math.max(0, runtime.weaponCooldownMs - dt);
    runtime.repathCooldownMs = Math.max(0, runtime.repathCooldownMs - dt);

    if (runtime.isWindingUp) {
      runtime.windUpRemainingMs = Math.max(0, runtime.windUpRemainingMs - dt);
    }

    if (runtime.isDestroyed) continue;

    if (runtime.order.kind === 'idle') {
      const autoTarget = findNearestEnemyInRange(state, unit);
      if (autoTarget) issueCombatUnitAttack(state, unit.id, autoTarget.id);
    }

    if (runtime.order.kind === 'attack') {
      updateAttackOrder(state, unit, dt, clock);
    }
  }

  clearInvalidTargetReferences(state);
  removeExpiredCombatWrecks(state, clock);
}

export function applyCombatUnitDamage(
  state: GameState,
  attacker: ModularCombatUnit,
  target: ModularCombatUnit,
  rawDamage: number,
): CombatDamageResult {
  const targetRuntime = normalizeCombatUnitRuntime(target);
  if (targetRuntime.isDestroyed || attacker.faction === target.faction) {
    return { rawDamage, finalDamage: 0, killed: false };
  }

  const hullLevel = modIndex(target.hullMod ?? target.mod ?? 'm0');
  const armor = applyArmorReduction(target.bodyId, hullLevel, rawDamage);
  const finalDamage = Math.min(targetRuntime.hp, armor.finalDamage);
  targetRuntime.hp = Math.max(0, targetRuntime.hp - armor.finalDamage);
  targetRuntime.lastDamageAmount = finalDamage;
  targetRuntime.damageFlashUntilMs = (state.combatClockMs ?? 0) + PRODUCTION_COMBAT_DAMAGE_FLASH_MS;

  const killed = targetRuntime.hp <= 0;
  if (killed) {
    targetRuntime.isDestroyed = true;
    targetRuntime.destroyedAt = state.combatClockMs ?? 0;
    targetRuntime.order = { kind: 'idle' };
    targetRuntime.targetId = null;
    targetRuntime.path = [];
    targetRuntime.pathIndex = 0;
    targetRuntime.isWindingUp = false;
    targetRuntime.windUpRemainingMs = 0;
    targetRuntime.windUpTargetId = null;
  }

  return { rawDamage, finalDamage, killed };
}

function updateAttackOrder(
  state: GameState,
  attacker: ModularCombatUnit,
  dt: number,
  clock: number,
): void {
  const runtime = normalizeCombatUnitRuntime(attacker);
  const targetId = runtime.order.kind === 'attack' ? runtime.order.targetId : runtime.targetId;
  const target = targetId ? state.combatUnits.find(unit => unit.id === targetId) : undefined;
  if (!target || target.faction === attacker.faction || normalizeCombatUnitRuntime(target).isDestroyed) {
    clearAttackOrder(runtime);
    return;
  }

  runtime.targetId = target.id;
  const targetRuntime = normalizeCombatUnitRuntime(target);
  const dx = targetRuntime.ftx - runtime.ftx;
  const dy = targetRuntime.fty - runtime.fty;
  const distance = Math.hypot(dx, dy);
  const weapon = getWeaponConfig(attacker.weaponId);
  if (!weapon) {
    clearAttackOrder(runtime);
    return;
  }

  const turretLevel = modIndex(attacker.turretMod ?? attacker.mod ?? 'm0');
  const desiredAngle = screenAngleFromDelta(dx, dy);
  const turnSpeed = getEffectiveTurretTurnSpeed(attacker.weaponId, turretLevel);
  runtime.turretAngleDeg = rotateAngleTowards(runtime.turretAngleDeg, desiredAngle, turnSpeed * dt / 1000);
  attacker.turretDir = directionFromScreenAngle(runtime.turretAngleDeg);
  const aimed = Math.abs(shortestAngleDelta(runtime.turretAngleDeg, desiredAngle)) <= PRODUCTION_COMBAT_AIM_TOLERANCE_DEG;

  if (distance > weapon.maxRange) {
    cancelWindUp(runtime);
    if (runtime.repathCooldownMs <= 0 || runtime.path.length === 0) {
      refreshAttackPath(state, attacker, target);
    }
    return;
  }

  runtime.path = [];
  runtime.pathIndex = 0;
  if (!aimed || runtime.weaponCooldownMs > 0) return;

  const windUpMs = weapon.windUp ? getWeaponMLevelValue(weapon.windUp, turretLevel) : 0;
  if (windUpMs > 0) {
    if (!runtime.isWindingUp || runtime.windUpTargetId !== target.id) {
      runtime.isWindingUp = true;
      runtime.windUpRemainingMs = windUpMs;
      runtime.windUpTargetId = target.id;
      return;
    }
    if (runtime.windUpRemainingMs > 0) return;
  }

  fireAtTarget(state, attacker, target, clock);
}

function fireAtTarget(
  state: GameState,
  attacker: ModularCombatUnit,
  target: ModularCombatUnit,
  clock: number,
): void {
  const runtime = normalizeCombatUnitRuntime(attacker);
  const weapon = getWeaponConfig(attacker.weaponId);
  if (!weapon) return;
  const level = modIndex(attacker.turretMod ?? attacker.mod ?? 'm0');
  const directDamage = weapon.damage.directDamage
    ? getWeaponMLevelValue(weapon.damage.directDamage, level)
    : 0;
  if (directDamage <= 0) return;

  applyCombatUnitDamage(state, attacker, target, directDamage);
  runtime.weaponCooldownMs = getWeaponMLevelValue(weapon.cooldown, level);
  runtime.muzzleFlashUntilMs = clock + PRODUCTION_COMBAT_MUZZLE_FLASH_MS;
  runtime.lastFiredAtMs = clock;
  cancelWindUp(runtime);
}

function refreshAttackPath(
  state: GameState,
  attacker: ModularCombatUnit,
  target: ModularCombatUnit,
): void {
  const runtime = normalizeCombatUnitRuntime(attacker);
  const targetRuntime = normalizeCombatUnitRuntime(target);
  const occupancy = buildOccupancyMap(state);
  addUnitBlockers(state, occupancy, 'combat', attacker.id);
  if (state.blockoutVehicles) addVehicleBlockers(state.blockoutVehicles, occupancy);
  const path = findPathToAdjacent(
    occupancy,
    Math.round(runtime.ftx),
    Math.round(runtime.fty),
    Math.round(targetRuntime.ftx),
    Math.round(targetRuntime.fty),
    1,
    1,
  );
  runtime.path = path ?? [];
  runtime.pathIndex = 0;
  runtime.repathCooldownMs = PRODUCTION_COMBAT_REPATH_MS;
}

function findNearestEnemyInRange(state: GameState, attacker: ModularCombatUnit): ModularCombatUnit | null {
  const runtime = normalizeCombatUnitRuntime(attacker);
  const weapon = getWeaponConfig(attacker.weaponId);
  if (!weapon) return null;

  let nearest: ModularCombatUnit | null = null;
  let nearestDistance = Infinity;
  for (const candidate of state.combatUnits ?? []) {
    if (candidate.id === attacker.id || candidate.faction === attacker.faction) continue;
    const targetRuntime = normalizeCombatUnitRuntime(candidate);
    if (targetRuntime.isDestroyed) continue;
    const distance = Math.hypot(targetRuntime.ftx - runtime.ftx, targetRuntime.fty - runtime.fty);
    if (distance <= weapon.maxRange && distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function clearInvalidTargetReferences(state: GameState): void {
  const validTargets = new Set(
    (state.combatUnits ?? [])
      .filter(unit => !normalizeCombatUnitRuntime(unit).isDestroyed)
      .map(unit => unit.id),
  );
  for (const unit of state.combatUnits ?? []) {
    const runtime = normalizeCombatUnitRuntime(unit);
    if (runtime.targetId && !validTargets.has(runtime.targetId)) clearAttackOrder(runtime);
  }
}

function removeExpiredCombatWrecks(state: GameState, clock: number): void {
  const survivors = (state.combatUnits ?? []).filter(unit => {
    const runtime = normalizeCombatUnitRuntime(unit);
    if (!runtime.isDestroyed || runtime.destroyedAt === null) return true;
    return clock - runtime.destroyedAt < PRODUCTION_COMBAT_WRECK_LIFETIME_MS;
  });
  if (survivors.length !== state.combatUnits.length) state.combatUnits.splice(0, state.combatUnits.length, ...survivors);
}

function clearAttackOrder(runtime: ReturnType<typeof normalizeCombatUnitRuntime>): void {
  runtime.order = { kind: 'idle' };
  runtime.targetId = null;
  runtime.path = [];
  runtime.pathIndex = 0;
  cancelWindUp(runtime);
}

function cancelWindUp(runtime: ReturnType<typeof normalizeCombatUnitRuntime>): void {
  runtime.isWindingUp = false;
  runtime.windUpRemainingMs = 0;
  runtime.windUpTargetId = null;
}

function modIndex(level: ModLevel): 0 | 1 | 2 | 3 {
  return MOD_INDEX[level] ?? 0;
}
