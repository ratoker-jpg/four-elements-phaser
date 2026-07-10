from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f'Marker not found in {path}: {old[:180]!r}')
    write(path, text.replace(old, new, 1))


COMBAT_MODULE = r'''/**
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
'''

TEST_MODULE = r'''import { describe, expect, it } from 'vitest';
import type { MapData, ModularCombatUnit } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import { normalizeCombatUnitRuntime, normalizeCombatUnitState } from '../state/combatUnits';
import {
  issueCombatUnitAttack,
  PRODUCTION_COMBAT_WRECK_LIFETIME_MS,
  updateAllCombatUnitCombat,
} from '../state/combatUnitCombat';
import { updateAllCombatUnitMovement } from '../state/combatUnitMovement';
import { routeRmbClick } from '../state/commandRouter';
import { selectOne } from '../state/unitSelection';
import { screenAngleFromDelta } from '../state/unitDirection';

function makeMap(): MapData {
  return {
    width: 24,
    height: 24,
    terrain: Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 20, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], buildings: [], builders: [], constructionSites: [],
  };
}

function makeState() {
  const state = createInitialState(makeMap(), 'cyan');
  state.harvesters = [];
  state.extraHarvesters = [];
  state.combatUnits = [];
  state.combatClockMs = 0;
  return state;
}

function makeUnit(
  id: string,
  faction: ModularCombatUnit['faction'],
  tx: number,
  ty: number,
  weaponId: ModularCombatUnit['weaponId'] = 'smoky',
): ModularCombatUnit {
  return {
    id, tx, ty, faction,
    bodyId: 'wasp', weaponId,
    hullMod: 'm0', turretMod: 'm0',
    dir: 2, turretDir: 2,
  };
}

function aimAt(attacker: ModularCombatUnit, target: ModularCombatUnit): void {
  const a = normalizeCombatUnitRuntime(attacker);
  const t = normalizeCombatUnitRuntime(target);
  a.turretAngleDeg = screenAngleFromDelta(t.ftx - a.ftx, t.fty - a.fty);
}

describe('canonical Normal Game combat damage', () => {
  it('routes RMB enemy commands from a production combat selection to attack', () => {
    const selection = selectOne({ kind: 'combat', id: 'ally' });
    expect(routeRmbClick({ kind: 'enemy-unit', id: 'enemy', tx: 8, ty: 8 }, selection)).toEqual({
      action: 'attack', tx: 8, ty: 8, targetId: 'enemy',
    });
  });

  it('rejects friendly targets', () => {
    const state = makeState();
    state.combatUnits = [makeUnit('a', 'cyan', 4, 4), makeUnit('b', 'cyan', 6, 4)];
    normalizeCombatUnitState(state);
    expect(issueCombatUnitAttack(state, 'a', 'b')).toEqual({ ok: false, reason: 'friendly-target' });
  });

  it('fires Smoky using production damage, armor and cooldown', () => {
    const state = makeState();
    const attacker = makeUnit('a', 'cyan', 4, 4);
    const target = makeUnit('b', 'purple', 8, 4);
    state.combatUnits = [attacker, target];
    normalizeCombatUnitState(state);
    aimAt(attacker, target);
    const hpBefore = target.runtime!.hp;

    expect(issueCombatUnitAttack(state, attacker.id, target.id)).toEqual({ ok: true });
    updateAllCombatUnitCombat(state, 100);

    expect(target.runtime!.hp).toBeLessThan(hpBefore);
    expect(target.runtime!.damageFlashUntilMs).toBeGreaterThan(state.combatClockMs!);
    expect(attacker.runtime!.weaponCooldownMs).toBe(900);
    expect(attacker.runtime!.muzzleFlashUntilMs).toBeGreaterThan(state.combatClockMs!);

    const hpAfterShot = target.runtime!.hp;
    updateAllCombatUnitCombat(state, 100);
    expect(target.runtime!.hp).toBe(hpAfterShot);
  });

  it('honors Railgun wind-up before applying damage', () => {
    const state = makeState();
    const attacker = makeUnit('rail', 'cyan', 4, 4, 'railgun');
    const target = makeUnit('target', 'yellow', 10, 4);
    state.combatUnits = [attacker, target];
    normalizeCombatUnitState(state);
    aimAt(attacker, target);
    const hpBefore = target.runtime!.hp;
    issueCombatUnitAttack(state, attacker.id, target.id);

    updateAllCombatUnitCombat(state, 1);
    expect(attacker.runtime!.isWindingUp).toBe(true);
    for (let i = 0; i < 3; i++) updateAllCombatUnitCombat(state, 200);
    expect(target.runtime!.hp).toBe(hpBefore);
    updateAllCombatUnitCombat(state, 199);
    expect(target.runtime!.hp).toBe(hpBefore);
    updateAllCombatUnitCombat(state, 1);
    expect(target.runtime!.hp).toBeLessThan(hpBefore);
  });

  it('builds a chase path for an explicit target outside weapon range', () => {
    const state = makeState();
    const attacker = makeUnit('a', 'cyan', 2, 2);
    const target = makeUnit('b', 'green', 18, 18);
    state.combatUnits = [attacker, target];
    normalizeCombatUnitState(state);
    issueCombatUnitAttack(state, attacker.id, target.id);

    updateAllCombatUnitCombat(state, 100);
    expect(attacker.runtime!.order).toEqual({ kind: 'attack', targetId: target.id });
    expect(attacker.runtime!.path.length).toBeGreaterThan(0);
    const before = { x: attacker.runtime!.ftx, y: attacker.runtime!.fty };
    updateAllCombatUnitMovement(state, 200);
    expect({ x: attacker.runtime!.ftx, y: attacker.runtime!.fty }).not.toEqual(before);
  });

  it('auto-acquires the nearest enemy already inside range', () => {
    const state = makeState();
    const attacker = makeUnit('a', 'cyan', 5, 5);
    const near = makeUnit('near', 'green', 8, 5);
    const far = makeUnit('far', 'yellow', 10, 5);
    state.combatUnits = [attacker, far, near];
    normalizeCombatUnitState(state);
    aimAt(attacker, near);

    updateAllCombatUnitCombat(state, 100);
    expect(attacker.runtime!.targetId).toBe(near.id);
    expect(attacker.runtime!.order).toEqual({ kind: 'attack', targetId: near.id });
  });

  it('destroys, disables and removes a production tank after the wreck window', () => {
    const state = makeState();
    const attacker = makeUnit('a', 'cyan', 4, 4);
    const target = makeUnit('b', 'purple', 8, 4);
    state.combatUnits = [attacker, target];
    normalizeCombatUnitState(state);
    aimAt(attacker, target);
    target.runtime!.hp = 1;
    issueCombatUnitAttack(state, attacker.id, target.id);

    updateAllCombatUnitCombat(state, 100);
    expect(target.runtime!.isDestroyed).toBe(true);
    expect(target.runtime!.order).toEqual({ kind: 'idle' });
    expect(attacker.runtime!.targetId).toBeNull();
    expect(state.combatUnits.some(unit => unit.id === target.id)).toBe(true);

    for (let elapsed = 0; elapsed < PRODUCTION_COMBAT_WRECK_LIFETIME_MS; elapsed += 200) {
      updateAllCombatUnitCombat(state, 200);
    }
    expect(state.combatUnits.some(unit => unit.id === target.id)).toBe(false);
  });

  it('migrates old runtime objects with safe combat defaults', () => {
    const state = makeState();
    const unit = makeUnit('legacy', 'cyan', 3, 3);
    unit.runtime = {
      ftx: 3, fty: 3, hp: 100, maxHp: 130, speedTilesPerSecond: 3,
      order: { kind: 'idle' }, path: [], pathIndex: 0, targetId: null,
      weaponCooldownMs: 0, isDestroyed: false, destroyedAt: null,
    };
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);
    expect(unit.runtime).toMatchObject({
      turretAngleDeg: 90,
      isWindingUp: false,
      windUpRemainingMs: 0,
      windUpTargetId: null,
      repathCooldownMs: 0,
      muzzleFlashUntilMs: 0,
      damageFlashUntilMs: 0,
      lastFiredAtMs: null,
      lastDamageAmount: 0,
    });
  });
});
'''

write('src/state/combatUnitCombat.ts', COMBAT_MODULE)
write('src/__tests__/combatUnitCombat.test.ts', TEST_MODULE)

# Types: attack order, combat runtime visual/timing fields, deterministic combat clock.
replace_once(
    'src/state/types.ts',
    "export type CombatUnitOrder =\n  | { kind: 'idle' }\n  | { kind: 'move'; targetTx: number; targetTy: number };",
    "export type CombatUnitOrder =\n"
    "  | { kind: 'idle' }\n"
    "  | { kind: 'move'; targetTx: number; targetTy: number }\n"
    "  | { kind: 'attack'; targetId: string };",
)
replace_once(
    'src/state/types.ts',
    "  weaponCooldownMs: number;\n  isDestroyed: boolean;",
    "  weaponCooldownMs: number;\n"
    "  turretAngleDeg: number;\n"
    "  isWindingUp: boolean;\n"
    "  windUpRemainingMs: number;\n"
    "  windUpTargetId: string | null;\n"
    "  repathCooldownMs: number;\n"
    "  muzzleFlashUntilMs: number;\n"
    "  damageFlashUntilMs: number;\n"
    "  lastFiredAtMs: number | null;\n"
    "  lastDamageAmount: number;\n"
    "  isDestroyed: boolean;",
)
replace_once(
    'src/state/types.ts',
    "  /** All combat units produced by factories. Phase 2: wasp-smoky and future presets. */\n  combatUnits: ModularCombatUnit[];",
    "  /** Deterministic production-combat timeline used for cooldowns, flashes and wreck cleanup. */\n"
    "  combatClockMs?: number;\n"
    "  /** All combat units produced by factories. Phase 2: wasp-smoky and future presets. */\n"
    "  combatUnits: ModularCombatUnit[];",
)

# Shared angle helpers.
replace_once(
    'src/state/unitDirection.ts',
    "export function directionFromDelta(dtx: number, dty: number): number {",
    "export function screenAngleFromDelta(dtx: number, dty: number): number {\n"
    "  const screenDx = dtx - dty;\n"
    "  const screenDy = dtx + dty;\n"
    "  return normalizeAngleDeg(Math.atan2(screenDy, screenDx) * 180 / Math.PI);\n"
    "}\n\n"
    "export function directionFromScreenAngle(angleDeg: number): number {\n"
    "  return ((Math.round(normalizeAngleDeg(angleDeg) / 45) % 8) + 8) % 8;\n"
    "}\n\n"
    "export function shortestAngleDelta(fromDeg: number, toDeg: number): number {\n"
    "  let delta = normalizeAngleDeg(toDeg) - normalizeAngleDeg(fromDeg);\n"
    "  if (delta > 180) delta -= 360;\n"
    "  if (delta < -180) delta += 360;\n"
    "  return delta;\n"
    "}\n\n"
    "export function rotateAngleTowards(fromDeg: number, toDeg: number, maxStepDeg: number): number {\n"
    "  const delta = shortestAngleDelta(fromDeg, toDeg);\n"
    "  if (Math.abs(delta) <= maxStepDeg) return normalizeAngleDeg(toDeg);\n"
    "  return normalizeAngleDeg(fromDeg + Math.sign(delta) * Math.max(0, maxStepDeg));\n"
    "}\n\n"
    "export function normalizeAngleDeg(angleDeg: number): number {\n"
    "  return ((angleDeg % 360) + 360) % 360;\n"
    "}\n\n"
    "export function directionFromDelta(dtx: number, dty: number): number {",
)
replace_once(
    'src/state/unitDirection.ts',
    "  const screenDx = dtx - dty;\n  const screenDy = dtx + dty;\n  if (Math.abs(screenDx) < 0.001 && Math.abs(screenDy) < 0.001) return 2;\n\n  const sector = Math.round(Math.atan2(screenDy, screenDx) / (Math.PI / 4));",
    "  const screenDx = dtx - dty;\n"
    "  const screenDy = dtx + dty;\n"
    "  if (Math.abs(screenDx) < 0.001 && Math.abs(screenDy) < 0.001) return 2;\n\n"
    "  const sector = Math.round(screenAngleFromDelta(dtx, dty) / 45);",
)

# Runtime migration/defaults.
replace_once(
    'src/state/combatUnits.ts',
    "    weaponCooldownMs: 0,\n    isDestroyed: false,",
    "    weaponCooldownMs: 0,\n"
    "    turretAngleDeg: (unit.turretDir ?? unit.dir ?? 2) * 45,\n"
    "    isWindingUp: false,\n"
    "    windUpRemainingMs: 0,\n"
    "    windUpTargetId: null,\n"
    "    repathCooldownMs: 0,\n"
    "    muzzleFlashUntilMs: 0,\n"
    "    damageFlashUntilMs: 0,\n"
    "    lastFiredAtMs: null,\n"
    "    lastDamageAmount: 0,\n"
    "    isDestroyed: false,",
)
replace_once(
    'src/state/combatUnits.ts',
    "  const order = raw?.order?.kind === 'move'\n    && Number.isFinite(raw.order.targetTx)\n    && Number.isFinite(raw.order.targetTy)\n    ? { kind: 'move' as const, targetTx: raw.order.targetTx, targetTy: raw.order.targetTy }\n    : { kind: 'idle' as const };",
    "  const order = raw?.order?.kind === 'move'\n"
    "    && Number.isFinite(raw.order.targetTx)\n"
    "    && Number.isFinite(raw.order.targetTy)\n"
    "    ? { kind: 'move' as const, targetTx: raw.order.targetTx, targetTy: raw.order.targetTy }\n"
    "    : raw?.order?.kind === 'attack' && typeof raw.order.targetId === 'string'\n"
    "      ? { kind: 'attack' as const, targetId: raw.order.targetId }\n"
    "      : { kind: 'idle' as const };",
)
replace_once(
    'src/state/combatUnits.ts',
    "    weaponCooldownMs: Number.isFinite(raw?.weaponCooldownMs) ? Math.max(0, raw!.weaponCooldownMs) : 0,\n    isDestroyed: raw?.isDestroyed === true,",
    "    weaponCooldownMs: Number.isFinite(raw?.weaponCooldownMs) ? Math.max(0, raw!.weaponCooldownMs) : 0,\n"
    "    turretAngleDeg: Number.isFinite(raw?.turretAngleDeg) ? raw!.turretAngleDeg : defaults.turretAngleDeg,\n"
    "    isWindingUp: raw?.isWindingUp === true,\n"
    "    windUpRemainingMs: Number.isFinite(raw?.windUpRemainingMs) ? Math.max(0, raw!.windUpRemainingMs) : 0,\n"
    "    windUpTargetId: typeof raw?.windUpTargetId === 'string' ? raw.windUpTargetId : null,\n"
    "    repathCooldownMs: Number.isFinite(raw?.repathCooldownMs) ? Math.max(0, raw!.repathCooldownMs) : 0,\n"
    "    muzzleFlashUntilMs: Number.isFinite(raw?.muzzleFlashUntilMs) ? Math.max(0, raw!.muzzleFlashUntilMs) : 0,\n"
    "    damageFlashUntilMs: Number.isFinite(raw?.damageFlashUntilMs) ? Math.max(0, raw!.damageFlashUntilMs) : 0,\n"
    "    lastFiredAtMs: Number.isFinite(raw?.lastFiredAtMs) ? raw!.lastFiredAtMs : null,\n"
    "    lastDamageAmount: Number.isFinite(raw?.lastDamageAmount) ? Math.max(0, raw!.lastDamageAmount) : 0,\n"
    "    isDestroyed: raw?.isDestroyed === true,",
)
replace_once(
    'src/state/combatUnits.ts',
    "  if (runtime.isDestroyed) runtime.order = { kind: 'idle' };",
    "  if (runtime.isDestroyed) {\n"
    "    runtime.order = { kind: 'idle' };\n"
    "    runtime.targetId = null;\n"
    "    runtime.path = [];\n"
    "    runtime.pathIndex = 0;\n"
    "    runtime.isWindingUp = false;\n"
    "  }",
)

# Movement supports attack chase paths and stop cancels wind-up.
replace_once(
    'src/state/combatUnitMovement.ts',
    "  runtime.targetId = null;\n  runtime.weaponCooldownMs = Math.max(0, runtime.weaponCooldownMs);",
    "  runtime.targetId = null;\n"
    "  runtime.isWindingUp = false;\n"
    "  runtime.windUpRemainingMs = 0;\n"
    "  runtime.windUpTargetId = null;\n"
    "  runtime.weaponCooldownMs = Math.max(0, runtime.weaponCooldownMs);",
)
replace_once(
    'src/state/combatUnitMovement.ts',
    "  runtime.targetId = null;\n  return { ok: true };",
    "  runtime.targetId = null;\n"
    "  runtime.isWindingUp = false;\n"
    "  runtime.windUpRemainingMs = 0;\n"
    "  runtime.windUpTargetId = null;\n"
    "  return { ok: true };",
)
replace_once(
    'src/state/combatUnitMovement.ts',
    "  if (runtime.isDestroyed || runtime.order.kind !== 'move') return;",
    "  if (runtime.isDestroyed || runtime.order.kind === 'idle') return;\n"
    "  if (runtime.order.kind === 'attack' && runtime.path.length === 0) return;",
)
replace_once(
    'src/state/combatUnitMovement.ts',
    "  runtime.path = [];\n  runtime.pathIndex = 0;\n  runtime.order = { kind: 'idle' };",
    "  runtime.path = [];\n"
    "  runtime.pathIndex = 0;\n"
    "  if (moveOrder) runtime.order = { kind: 'idle' };",
)

# Deterministic combat clock + update order.
replace_once(
    'src/state/createInitialState.ts',
    "    nextCombatUnitId: 0,\n    production:",
    "    nextCombatUnitId: 0,\n"
    "    combatClockMs: 0,\n"
    "    production:",
)
replace_once(
    'src/state/updateGameState.ts',
    "import { updateAllCombatUnitMovement } from './combatUnitMovement';",
    "import { updateAllCombatUnitMovement } from './combatUnitMovement';\n"
    "import { updateAllCombatUnitCombat } from './combatUnitCombat';",
)
replace_once(
    'src/state/updateGameState.ts',
    "  updateAllCombatUnitMovement(state, moveDt);",
    "  updateAllCombatUnitCombat(state, moveDt);\n"
    "  updateAllCombatUnitMovement(state, moveDt);",
)

# Normal command routing recognizes production combat selection.
replace_once(
    'src/state/commandRouter.ts',
    "      const hasBlockout = currentSelection.units.some(u => u.kind === 'harvester' && u.id.startsWith('blockout-'));\n      if (hasBlockout) {",
    "      const hasCombat = currentSelection.units.some(u => u.kind === 'combat' || u.id.startsWith('blockout-'));\n"
    "      if (hasCombat) {",
)
replace_once(
    'src/state/commandRouter.ts',
    "      const hasBlockout = currentSelection.units.some(u => u.id.startsWith('blockout-'));\n      if (isArenaMode || hasBlockout) {",
    "      const hasCombat = currentSelection.units.some(u => u.kind === 'combat' || u.id.startsWith('blockout-'));\n"
    "      if (isArenaMode || hasCombat) {",
)

# Input detects enemies and executes attack orders.
replace_once(
    'src/phaser/input/GameInputController.ts',
    "import { issueManualMove, stopUnitCommand, issueMultiMoveCommand, stopUnitsCommand } from '../../state/unitCommands';",
    "import { issueManualMove, stopUnitCommand, issueMultiMoveCommand, stopUnitsCommand } from '../../state/unitCommands';\n"
    "import { issueCombatUnitAttack } from '../../state/combatUnitCombat';",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "    // Check resources (for harvest commands)\n",
    "    // Check enemy production combat units.\n"
    "    for (const unit of gameState.combatUnits) {\n"
    "      if (unit.faction === gameState.playerFaction || unit.runtime?.isDestroyed) continue;\n"
    "      const dx = (unit.runtime?.ftx ?? unit.tx) - clickTx;\n"
    "      const dy = (unit.runtime?.fty ?? unit.ty) - clickTy;\n"
    "      if (Math.hypot(dx, dy) < SELECT_RADIUS) {\n"
    "        return { kind: 'enemy-unit', id: unit.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };\n"
    "      }\n"
    "    }\n\n"
    "    // Check resources (for harvest commands)\n",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "      case 'attack': {\n        this.showStatusCb('Атака: нет боевого юнита', false);\n        break;\n      }",
    "      case 'attack': {\n"
    "        this.executeAttackCommand(routeResult.targetId, routeResult.tx, routeResult.ty);\n"
    "        break;\n"
    "      }",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "  private executeHarvestCommand(tx: number, ty: number): void {",
    "  private executeAttackCommand(targetId: string, tx: number, ty: number): void {\n"
    "    if (!this.selection) return;\n"
    "    const state = this.getGameState();\n"
    "    let okCount = 0;\n"
    "    for (const selected of this.selection.units) {\n"
    "      if (selected.kind !== 'combat') continue;\n"
    "      if (issueCombatUnitAttack(state, selected.id, targetId).ok) okCount++;\n"
    "    }\n"
    "    if (okCount > 0) {\n"
    "      this.showStatusCb(`${okCount} танк(ов) → атака`, true);\n"
    "      this.feedbackRenderer.addCommandOk(tx, ty, this.scene.time.now);\n"
    "    } else {\n"
    "      this.showStatusCb('Ошибка: нет боевого юнита или цель недоступна', false);\n"
    "      this.feedbackRenderer.addCommandFail(tx, ty, this.scene.time.now);\n"
    "    }\n"
    "  }\n\n"
    "  private executeHarvestCommand(tx: number, ty: number): void {",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "    if (!hoverTarget) {\n      for (const r of gameState.resourceNodes) {",
    "    if (!hoverTarget) {\n"
    "      for (const unit of gameState.combatUnits) {\n"
    "        if (unit.faction === gameState.playerFaction || unit.runtime?.isDestroyed) continue;\n"
    "        const dx = (unit.runtime?.ftx ?? unit.tx) - clickTx;\n"
    "        const dy = (unit.runtime?.fty ?? unit.ty) - clickTy;\n"
    "        if (Math.hypot(dx, dy) < SELECT_RADIUS) {\n"
    "          hoverTarget = { kind: 'enemy-unit', id: unit.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };\n"
    "          break;\n"
    "        }\n"
    "      }\n"
    "    }\n\n"
    "    if (!hoverTarget) {\n"
    "      for (const r of gameState.resourceNodes) {",
)

# Combat renderer: health, flashes, bounded wreck and live model cleanup.
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "import type { ModularCombatUnit } from '../../state/types';",
    "import type { ModularCombatUnit } from '../../state/types';\n"
    "import {\n"
    "  PRODUCTION_COMBAT_EXPLOSION_MS,\n"
    "  PRODUCTION_COMBAT_WRECK_LIFETIME_MS,\n"
    "} from '../../state/combatUnitCombat';",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "  placeholder: Phaser.GameObjects.Graphics;\n}",
    "  placeholder: Phaser.GameObjects.Graphics;\n"
    "  overlay: Phaser.GameObjects.Graphics;\n"
    "}",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "  sync(units: ModularCombatUnit[]): void {",
    "  sync(units: ModularCombatUnit[], combatClockMs: number = 0): void {",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "      // Complete an earlier lazy-load attempt first. A dedicated adapter per",
    "      this.drawCombatOverlay(entry.overlay, unit, anchor.x, anchor.y, depth, combatClockMs);\n\n"
    "      if (unit.runtime?.isDestroyed) {\n"
    "        entry.adapter.removeVehicle(unit.id);\n"
    "        entry.placeholder.setVisible(false);\n"
    "        continue;\n"
    "      }\n\n"
    "      // Complete an earlier lazy-load attempt first. A dedicated adapter per",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "      entry.placeholder.destroy();\n      this.entries.delete(id);",
    "      entry.placeholder.destroy();\n"
    "      entry.overlay.destroy();\n"
    "      this.entries.delete(id);",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "      placeholder: this.scene.add.graphics(),\n    };",
    "      placeholder: this.scene.add.graphics(),\n"
    "      overlay: this.scene.add.graphics(),\n"
    "    };",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "  private drawPlaceholder(\n",
    "  private drawCombatOverlay(\n"
    "    graphics: Phaser.GameObjects.Graphics,\n"
    "    unit: ModularCombatUnit,\n"
    "    x: number,\n"
    "    y: number,\n"
    "    depth: number,\n"
    "    clock: number,\n"
    "  ): void {\n"
    "    graphics.clear();\n"
    "    graphics.setDepth(depth + 20);\n"
    "    const runtime = unit.runtime;\n"
    "    if (!runtime) return;\n"
    "\n"
    "    if (runtime.isDestroyed) {\n"
    "      const age = runtime.destroyedAt === null ? 0 : Math.max(0, clock - runtime.destroyedAt);\n"
    "      const fade = Math.max(0, 1 - age / PRODUCTION_COMBAT_WRECK_LIFETIME_MS);\n"
    "      graphics.fillStyle(0x171717, 0.58 * fade);\n"
    "      graphics.fillEllipse(x, y - 3, 42, 20);\n"
    "      if (age < PRODUCTION_COMBAT_EXPLOSION_MS) {\n"
    "        const t = age / PRODUCTION_COMBAT_EXPLOSION_MS;\n"
    "        const alpha = 1 - t;\n"
    "        graphics.fillStyle(0xffb020, 0.75 * alpha);\n"
    "        graphics.fillCircle(x, y - 14, 7 + t * 16);\n"
    "        graphics.lineStyle(2, 0xff6200, alpha);\n"
    "        graphics.strokeCircle(x, y - 14, 12 + t * 23);\n"
    "      }\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    const hpRatio = Math.max(0, Math.min(1, runtime.hp / runtime.maxHp));\n"
    "    if (hpRatio < 0.999) {\n"
    "      graphics.fillStyle(0x101010, 0.82);\n"
    "      graphics.fillRect(x - 22, y - 38, 44, 6);\n"
    "      graphics.fillStyle(hpRatio > 0.5 ? 0x63d66f : hpRatio > 0.25 ? 0xffc247 : 0xff5656, 0.95);\n"
    "      graphics.fillRect(x - 21, y - 37, 42 * hpRatio, 4);\n"
    "    }\n"
    "    if (clock < runtime.damageFlashUntilMs) {\n"
    "      graphics.lineStyle(3, 0xff4242, 0.9);\n"
    "      graphics.strokeCircle(x, y - 8, 25);\n"
    "    }\n"
    "    if (clock < runtime.muzzleFlashUntilMs) {\n"
    "      const angle = runtime.turretAngleDeg * Math.PI / 180;\n"
    "      const mx = x + Math.cos(angle) * 34;\n"
    "      const my = y - 10 + Math.sin(angle) * 34;\n"
    "      graphics.lineStyle(4, unit.weaponId === 'railgun' ? 0x8cf8ff : 0xffd36a, 0.95);\n"
    "      graphics.beginPath();\n"
    "      graphics.moveTo(x + Math.cos(angle) * 16, y - 10 + Math.sin(angle) * 16);\n"
    "      graphics.lineTo(mx, my);\n"
    "      graphics.strokePath();\n"
    "      graphics.fillStyle(0xffffff, 0.9);\n"
    "      graphics.fillCircle(mx, my, 4);\n"
    "    }\n"
    "  }\n\n"
    "  private drawPlaceholder(\n",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "      entry.placeholder.destroy();\n    }",
    "      entry.placeholder.destroy();\n"
    "      entry.overlay.destroy();\n"
    "    }",
)
replace_once(
    'src/phaser/render/EntityRenderer.ts',
    "    this.combatUnitRenderer.sync(state.combatUnits);",
    "    this.combatUnitRenderer.sync(state.combatUnits, state.combatClockMs ?? 0);",
)

print('SKIRMISH-P2B patch applied')
