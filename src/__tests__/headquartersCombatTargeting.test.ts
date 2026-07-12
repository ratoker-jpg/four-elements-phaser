import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import {
  distanceToCombatTarget,
  issueCombatUnitAttack,
  issuePlayerCombatUnitAttack,
  resolveCombatTarget,
  updateAllCombatUnitCombat,
} from '../state/combatUnitCombat';
import { getHeadquartersById } from '../state/headquartersCombat';
import { createCombatUnitRuntime, normalizeCombatUnitRuntime } from '../state/combatUnits';
import type { ModularCombatUnit } from '../state/types';
import type { Faction, GameState, TeamId } from '../state/types';

function addCombatUnit(
  state: GameState,
  id: string,
  ownerTeamId: TeamId,
  tx: number,
  ty: number,
  faction: Faction,
) {
  const unit: ModularCombatUnit = {
    id, ownerTeamId, faction,
    bodyId: 'wasp', weaponId: 'smoky',
    hullMod: 'm0', turretMod: 'm0',
    tx, ty, dir: 2, turretDir: 2,
  };
  unit.runtime = createCombatUnitRuntime(unit);
  state.combatUnits.push(unit);
  return unit;
}

function state(): GameState {
  return createInitialState(
    createGeneratedMapData('p8b-headquarters-targeting', 'standard', 'cyan'),
    'cyan',
  );
}

describe('SKIRMISH-P8B Headquarters combat targeting', () => {
  it('resolves a canonical 3x3 Headquarters target and footprint distance', () => {
    const current = state();
    const target = resolveCombatTarget(current, 'hq-team-green');
    expect(target).toEqual(expect.objectContaining({
      kind: 'headquarters',
      id: 'hq-team-green',
      ownerTeamId: 'team-green',
      width: 3,
      height: 3,
    }));
    if (!target) return;
    expect(distanceToCombatTarget(target.tx - 1, target.ty + 1, target)).toBe(1);
    expect(distanceToCombatTarget(target.centerX, target.centerY, target)).toBe(0);
  });

  it('accepts enemy Headquarters orders and rejects friendly Headquarters', () => {
    const current = state();
    const hq = getHeadquartersById(current, 'hq-team-green')!;
    const attacker = addCombatUnit(
      current,
      'cyan-attacker',
      'team-cyan',
      hq.tx - 2,
      hq.ty + 1,
      'cyan',
    );
    expect(issueCombatUnitAttack(current, attacker.id, 'hq-team-green')).toEqual({ ok: true });
    expect(normalizeCombatUnitRuntime(attacker).order).toEqual({
      kind: 'attack',
      targetId: 'hq-team-green',
    });
    expect(issueCombatUnitAttack(current, attacker.id, 'hq-team-cyan'))
      .toEqual({ ok: false, reason: 'friendly-target' });
    expect(issuePlayerCombatUnitAttack(current, attacker.id, 'hq-team-cyan'))
      .toEqual({ ok: false, reason: 'friendly-target' });
  });

  it('paths to the edge of the 3x3 footprint rather than its occupied center', () => {
    const current = state();
    const hq = getHeadquartersById(current, 'hq-team-green')!;
    const attacker = addCombatUnit(
      current,
      'path-attacker',
      'team-cyan',
      hq.tx + 11,
      hq.ty + 1,
      'cyan',
    );
    issueCombatUnitAttack(current, attacker.id, hq.id!);
    updateAllCombatUnitCombat(current, 16);
    const runtime = normalizeCombatUnitRuntime(attacker);
    expect(runtime.path.length).toBeGreaterThan(0);
    const destination = runtime.path[runtime.path.length - 1];
    const adjacent = destination.tx === hq.tx - 1
      || destination.tx === hq.tx + 3
      || destination.ty === hq.ty - 1
      || destination.ty === hq.ty + 3;
    expect(adjacent).toBe(true);
    expect(
      destination.tx >= hq.tx && destination.tx < hq.tx + 3
      && destination.ty >= hq.ty && destination.ty < hq.ty + 3,
    ).toBe(false);
  });

  it('fires through the production runtime until the Headquarters is destroyed', () => {
    const current = state();
    const hq = getHeadquartersById(current, 'hq-team-green')!;
    hq.hp = 35;
    const attacker = addCombatUnit(
      current,
      'kill-attacker',
      'team-cyan',
      hq.tx - 1,
      hq.ty + 1,
      'cyan',
    );
    const runtime = normalizeCombatUnitRuntime(attacker);
    runtime.turretAngleDeg = 0;
    issueCombatUnitAttack(current, attacker.id, hq.id!);

    for (let index = 0; index < 400 && !hq.isDestroyed; index++) {
      updateAllCombatUnitCombat(current, 50);
    }

    expect(hq.isDestroyed).toBe(true);
    expect(hq.hp).toBe(0);
    expect(current.match!.teams['team-green'].eliminated).toBe(true);
    expect(runtime.order).toEqual({ kind: 'idle' });
    expect(runtime.targetId).toBeNull();
  });

  it('destroys and bounds cleanup for all units owned by an eliminated team', () => {
    const current = state();
    const hq = getHeadquartersById(current, 'hq-team-green')!;
    hq.hp = 1;
    const attacker = addCombatUnit(
      current,
      'cyan-finisher',
      'team-cyan',
      hq.tx - 1,
      hq.ty + 1,
      'cyan',
    );
    const greenTank = addCombatUnit(current, 'green-tank', 'team-green', 20, 20, 'green');
    const greenBuilder = current.mapData.builders.find(unit => unit.ownerTeamId === 'team-green')!;
    const greenHarvester = current.harvesters.find(unit => unit.ownerTeamId === 'team-green')!;
    issueCombatUnitAttack(current, attacker.id, hq.id!);

    for (let index = 0; index < 100 && !hq.isDestroyed; index++) {
      updateAllCombatUnitCombat(current, 50);
    }

    expect(normalizeCombatUnitRuntime(greenTank).isDestroyed).toBe(true);
    expect(greenBuilder.isDestroyed).toBe(true);
    expect(greenHarvester.isDestroyed).toBe(true);
    expect(current.entities.some(entity => entity.id === greenBuilder.id)).toBe(false);
    expect(current.entities.some(entity => entity.id === greenHarvester.id)).toBe(false);
  });

  it('rejects orders from an eliminated attacker team', () => {
    const current = state();
    const attacker = addCombatUnit(current, 'green-attacker', 'team-green', 20, 20, 'green');
    current.match!.teams['team-green'].eliminated = true;
    expect(issueCombatUnitAttack(current, attacker.id, 'hq-team-cyan'))
      .toEqual({ ok: false, reason: 'attacker-eliminated' });
  });
});
