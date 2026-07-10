import { describe, expect, it } from 'vitest';
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
    } as any;
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
