/**
 * Canonical Normal Game combat lifecycle for factory-produced tanks.
 *
 * Pure TypeScript. GameState.combatUnits remains the only combat-unit source
 * of truth. Headquarters are resolved through the canonical map contract.
 */

import type {
  Faction,
  GameState,
  HqPlacement,
  ModularCombatUnit,
  ModLevel,
  TeamId,
} from './types';
import { normalizeCombatUnitRuntime } from './combatUnits';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';
import { applyArmorReduction, getEffectiveTurretTurnSpeed } from './bodyCombatStats';
import {
  addUnitBlockers,
  addVehicleBlockers,
  buildOccupancyMap,
} from './occupancy';
import { findPathToAdjacent } from './pathfinding';
import { isHumanOwned, resolveEntityTeamId } from './teamOwnership';
import { ensureMatchState, teamIdForFaction } from './matchState';
import {
  getHeadquartersById,
  applyHeadquartersDamage,
  normalizeHeadquartersCombatState,
} from './headquartersCombat';
import { HQ_FOOTPRINT } from './mapHeadquarters';
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
  | {
      ok: false;
      reason:
        | 'attacker-not-found'
        | 'target-not-found'
        | 'attacker-destroyed'
        | 'attacker-eliminated'
        | 'target-destroyed'
        | 'friendly-target';
    };

export type PlayerCombatAttackResult = CombatAttackResult
  | { ok: false; reason: 'not-owner' };

export interface CombatDamageResult {
  rawDamage: number;
  finalDamage: number;
  killed: boolean;
}

export type ResolvedCombatTarget =
  | {
      kind: 'combat-unit';
      id: string;
      ownerTeamId: TeamId;
      faction: Faction;
      tx: number;
      ty: number;
      width: 1;
      height: 1;
      centerX: number;
      centerY: number;
      unit: ModularCombatUnit;
    }
  | {
      kind: 'headquarters';
      id: string;
      ownerTeamId: TeamId;
      faction: Faction;
      tx: number;
      ty: number;
      width: typeof HQ_FOOTPRINT;
      height: typeof HQ_FOOTPRINT;
      centerX: number;
      centerY: number;
      headquarters: HqPlacement;
    };

/** Resolve a live combat unit or 3x3 Headquarters through one target contract. */
export function resolveCombatTarget(
  state: GameState,
  targetId: string,
): ResolvedCombatTarget | null {
  const unit = state.combatUnits.find(candidate => candidate.id === targetId);
  if (unit) {
    const runtime = normalizeCombatUnitRuntime(unit);
    if (runtime.isDestroyed) return null;
    return {
      kind: 'combat-unit',
      id: unit.id,
      ownerTeamId: resolveEntityTeamId(state, unit),
      faction: unit.faction,
      tx: Math.round(runtime.ftx),
      ty: Math.round(runtime.fty),
      width: 1,
      height: 1,
      centerX: runtime.ftx,
      centerY: runtime.fty,
      unit,
    };
  }

  const headquarters = getHeadquartersById(state, targetId);
  if (!headquarters || headquarters.isDestroyed || (headquarters.hp ?? 0) <= 0) return null;
  const ownerTeamId = headquarters.ownerTeamId ?? teamIdForFaction(headquarters.faction);
  return {
    kind: 'headquarters',
    id: headquarters.id ?? `hq-${ownerTeamId}`,
    ownerTeamId,
    faction: headquarters.faction,
    tx: headquarters.tx,
    ty: headquarters.ty,
    width: HQ_FOOTPRINT,
    height: HQ_FOOTPRINT,
    centerX: headquarters.tx + (HQ_FOOTPRINT - 1) / 2,
    centerY: headquarters.ty + (HQ_FOOTPRINT - 1) / 2,
    headquarters,
  };
}

/** Distance from a unit center to the closest occupied target tile center. */
export function distanceToCombatTarget(
  attackerX: number,
  attackerY: number,
  target: ResolvedCombatTarget,
): number {
  const minX = target.tx;
  const maxX = target.tx + target.width - 1;
  const minY = target.ty;
  const maxY = target.ty + target.height - 1;
  const nearestX = Math.max(minX, Math.min(maxX, attackerX));
  const nearestY = Math.max(minY, Math.min(maxY, attackerY));
  return Math.hypot(nearestX - attackerX, nearestY - attackerY);
}

/** Player-facing attack command. AI/runtime code continues to use issueCombatUnitAttack. */
export function issuePlayerCombatUnitAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
): PlayerCombatAttackResult {
  const attacker = state.combatUnits.find(unit => unit.id === attackerId);
  if (!attacker) return { ok: false, reason: 'attacker-not-found' };
  if (!isHumanOwned(state, attacker)) return { ok: false, reason: 'not-owner' };
  const target = resolveCombatTarget(state, targetId);
  if (target && target.ownerTeamId === ensureMatchState(state).humanTeamId) {
    return { ok: false, reason: 'friendly-target' };
  }
  return issueCombatUnitAttack(state, attackerId, targetId);
}

export function issueCombatUnitAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
): CombatAttackResult {
  const attacker = state.combatUnits.find(unit => unit.id === attackerId);
  if (!attacker) return { ok: false, reason: 'attacker-not-found' };
  const attackerRuntime = normalizeCombatUnitRuntime(attacker);
  if (attackerRuntime.isDestroyed) return { ok: false, reason: 'attacker-destroyed' };

  const attackerTeamId = resolveEntityTeamId(state, attacker);
  if (ensureMatchState(state).teams[attackerTeamId].eliminated) {
    return { ok: false, reason: 'attacker-eliminated' };
  }

  const target = resolveCombatTarget(state, targetId);
  if (!target) {
    const destroyedHq = normalizeHeadquartersCombatState(state)
      .some(hq => hq.id === targetId && hq.isDestroyed);
    return { ok: false, reason: destroyedHq ? 'target-destroyed' : 'target-not-found' };
  }
  if (target.ownerTeamId === attackerTeamId) return { ok: false, reason: 'friendly-target' };

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
  const match = ensureMatchState(state);

  for (const unit of units) {
    const runtime = normalizeCombatUnitRuntime(unit);
    runtime.weaponCooldownMs = Math.max(0, runtime.weaponCooldownMs - dt);
    runtime.repathCooldownMs = Math.max(0, runtime.repathCooldownMs - dt);
    if (runtime.isWindingUp) {
      runtime.windUpRemainingMs = Math.max(0, runtime.windUpRemainingMs - dt);
    }
    if (runtime.isDestroyed) continue;

    const ownerTeamId = resolveEntityTeamId(state, unit);
    if (match.teams[ownerTeamId].eliminated) {
      clearAttackOrder(runtime);
      continue;
    }

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
  if (
    targetRuntime.isDestroyed
    || resolveEntityTeamId(state, attacker) === resolveEntityTeamId(state, target)
  ) {
    return { rawDamage, finalDamage: 0, killed: false };
  }

  const hullLevel = modIndex(target.hullMod ?? target.mod ?? 'm0');
  const armor = applyArmorReduction(target.bodyId, hullLevel, rawDamage);
  const finalDamage = Math.min(targetRuntime.hp, armor.finalDamage);
  targetRuntime.hp = Math.max(0, targetRuntime.hp - armor.finalDamage);
  targetRuntime.lastDamageAmount = finalDamage;
  targetRuntime.damageFlashUntilMs = (state.combatClockMs ?? 0) + PRODUCTION_COMBAT_DAMAGE_FLASH_MS;

  const killed = targetRuntime.hp <= 0;
  if (killed) destroyCombatUnitRuntime(targetRuntime, state.combatClockMs ?? 0);
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
  const target = targetId ? resolveCombatTarget(state, targetId) : null;
  const attackerTeamId = resolveEntityTeamId(state, attacker);
  if (!target || target.ownerTeamId === attackerTeamId) {
    clearAttackOrder(runtime);
    return;
  }

  runtime.targetId = target.id;
  const dx = target.centerX - runtime.ftx;
  const dy = target.centerY - runtime.fty;
  const distance = distanceToCombatTarget(runtime.ftx, runtime.fty, target);
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
  const aimed = Math.abs(shortestAngleDelta(runtime.turretAngleDeg, desiredAngle))
    <= PRODUCTION_COMBAT_AIM_TOLERANCE_DEG;

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
  target: ResolvedCombatTarget,
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

  if (target.kind === 'combat-unit') {
    applyCombatUnitDamage(state, attacker, target.unit, directDamage);
  } else {
    applyHeadquartersDamage(
      state,
      resolveEntityTeamId(state, attacker),
      target.id,
      directDamage,
    );
  }
  runtime.weaponCooldownMs = getWeaponMLevelValue(weapon.cooldown, level);
  runtime.muzzleFlashUntilMs = clock + PRODUCTION_COMBAT_MUZZLE_FLASH_MS;
  runtime.lastFiredAtMs = clock;
  cancelWindUp(runtime);
}

function refreshAttackPath(
  state: GameState,
  attacker: ModularCombatUnit,
  target: ResolvedCombatTarget,
): void {
  const runtime = normalizeCombatUnitRuntime(attacker);
  const occupancy = buildOccupancyMap(state);
  addUnitBlockers(state, occupancy, 'combat', attacker.id);
  if (state.blockoutVehicles) addVehicleBlockers(state.blockoutVehicles, occupancy);
  const path = findPathToAdjacent(
    occupancy,
    Math.round(runtime.ftx),
    Math.round(runtime.fty),
    target.tx,
    target.ty,
    target.width,
    target.height,
  );
  runtime.path = path ?? [];
  runtime.pathIndex = 0;
  runtime.repathCooldownMs = PRODUCTION_COMBAT_REPATH_MS;
}

function findNearestEnemyInRange(
  state: GameState,
  attacker: ModularCombatUnit,
): ResolvedCombatTarget | null {
  const runtime = normalizeCombatUnitRuntime(attacker);
  const weapon = getWeaponConfig(attacker.weaponId);
  if (!weapon) return null;
  const attackerTeamId = resolveEntityTeamId(state, attacker);

  const targets: ResolvedCombatTarget[] = [];
  for (const candidate of state.combatUnits ?? []) {
    if (candidate.id === attacker.id) continue;
    const target = resolveCombatTarget(state, candidate.id);
    if (target && target.ownerTeamId !== attackerTeamId) targets.push(target);
  }
  for (const headquarters of normalizeHeadquartersCombatState(state)) {
    if (!headquarters.id) continue;
    const target = resolveCombatTarget(state, headquarters.id);
    if (target && target.ownerTeamId !== attackerTeamId) targets.push(target);
  }

  targets.sort((a, b) => {
    const da = distanceToCombatTarget(runtime.ftx, runtime.fty, a);
    const db = distanceToCombatTarget(runtime.ftx, runtime.fty, b);
    return da - db
      || (a.kind === b.kind ? 0 : a.kind === 'combat-unit' ? -1 : 1)
      || a.id.localeCompare(b.id);
  });
  return targets.find(target =>
    distanceToCombatTarget(runtime.ftx, runtime.fty, target) <= weapon.maxRange,
  ) ?? null;
}

function clearInvalidTargetReferences(state: GameState): void {
  for (const unit of state.combatUnits ?? []) {
    const runtime = normalizeCombatUnitRuntime(unit);
    if (runtime.targetId && !resolveCombatTarget(state, runtime.targetId)) clearAttackOrder(runtime);
  }
}

function removeExpiredCombatWrecks(state: GameState, clock: number): void {
  const units = state.combatUnits ?? [];
  const survivors = units.filter(unit => {
    const runtime = normalizeCombatUnitRuntime(unit);
    if (!runtime.isDestroyed || runtime.destroyedAt === null) return true;
    return clock - runtime.destroyedAt < PRODUCTION_COMBAT_WRECK_LIFETIME_MS;
  });
  if (survivors.length !== units.length) units.splice(0, units.length, ...survivors);
}

function destroyCombatUnitRuntime(
  runtime: ReturnType<typeof normalizeCombatUnitRuntime>,
  clock: number,
): void {
  runtime.hp = 0;
  runtime.isDestroyed = true;
  runtime.destroyedAt = clock;
  runtime.order = { kind: 'idle' };
  runtime.targetId = null;
  runtime.path = [];
  runtime.pathIndex = 0;
  runtime.isWindingUp = false;
  runtime.windUpRemainingMs = 0;
  runtime.windUpTargetId = null;
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
