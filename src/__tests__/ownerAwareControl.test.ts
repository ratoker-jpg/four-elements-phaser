import { describe, expect, it } from 'vitest';
import type { MapData, ModularCombatUnit } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import { normalizeCombatUnitState } from '../state/combatUnits';
import { issuePlayerCombatUnitAttack } from '../state/combatUnitCombat';
import { ControlGroupManager } from '../state/controlGroups';
import { issueManualMove, stopUnitCommand } from '../state/unitCommands';
import { pruneMissingEntities, selectMany } from '../state/unitSelection';
import {
  getSelectableUnitControl,
  isHumanOwned,
  isSelectableUnitHumanOwned,
} from '../state/teamOwnership';

function makeMap(): MapData {
  return {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 16, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], buildings: [], builders: [], constructionSites: [],
  };
}

function makeCombat(id: string, faction: 'cyan' | 'green', ownerTeamId: 'team-cyan' | 'team-green', tx: number): ModularCombatUnit {
  return {
    id, ownerTeamId, tx, ty: 8, bodyId: 'wasp', weaponId: 'smoky',
    hullMod: 'm0', turretMod: 'm0', faction, dir: 2, turretDir: 2,
  };
}

function makeState() {
  const state = createInitialState(makeMap(), 'cyan');
  state.mapData.builders = [
    {
      id: 'human-builder', ownerTeamId: 'team-cyan', tx: 4, ty: 4, ftx: 4, fty: 4,
      busy: false, phase: 'idle', path: [], pathIndex: 0, targetTx: 4, targetTy: 4,
      assignedSiteId: -1,
    },
    {
      id: 'foreign-builder', ownerTeamId: 'team-green', tx: 6, ty: 4, ftx: 6, fty: 4,
      busy: false, phase: 'idle', path: [], pathIndex: 0, targetTx: 6, targetTy: 4,
      assignedSiteId: -1,
    },
  ];
  state.harvesters = [
    {
      id: 'human-harvester', ownerTeamId: 'team-cyan', faction: 'cyan', ftx: 4, fty: 6,
      phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
      gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2.5,
    },
    {
      id: 'foreign-harvester', ownerTeamId: 'team-green', faction: 'green', ftx: 6, fty: 6,
      phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
      gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2.5,
    },
  ];
  state.mapData.buildings = [
    { tx: 3, ty: 10, type: 'units-factory', ownerTeamId: 'team-cyan' },
    { tx: 10, ty: 10, type: 'units-factory', ownerTeamId: 'team-green' },
  ];
  state.production.factories = [
    { tx: 3, ty: 10, ownerTeamId: 'team-cyan', queue: [], active: false },
    { tx: 10, ty: 10, ownerTeamId: 'team-green', queue: [], active: false },
  ];
  state.combatUnits = [
    makeCombat('human-tank', 'cyan', 'team-cyan', 4),
    makeCombat('foreign-tank', 'green', 'team-green', 12),
  ];
  normalizeCombatUnitState(state);
  return state;
}

describe('SKIRMISH-P4B owner-aware player control', () => {
  it('resolves legacy unowned entities as human but respects explicit foreign ownership', () => {
    const state = makeState();
    expect(isHumanOwned(state, {})).toBe(true);
    expect(isHumanOwned(state, { faction: 'cyan' })).toBe(true);
    expect(isHumanOwned(state, { ownerTeamId: 'team-green' })).toBe(false);
  });

  it('distinguishes human, foreign and missing selection references', () => {
    const state = makeState();
    expect(getSelectableUnitControl(state, { kind: 'builder', id: 'human-builder' })).toBe('human');
    expect(getSelectableUnitControl(state, { kind: 'builder', id: 'foreign-builder' })).toBe('foreign');
    expect(getSelectableUnitControl(state, { kind: 'builder', id: 'missing' })).toBe('missing');
    expect(isSelectableUnitHumanOwned(state, { kind: 'combat', id: 'foreign-tank' })).toBe(false);
  });

  it('prunes every foreign entity kind from a stale mixed selection', () => {
    const state = makeState();
    const selection = selectMany([
      { kind: 'builder', id: 'human-builder' },
      { kind: 'builder', id: 'foreign-builder' },
      { kind: 'harvester', id: 'foreign-harvester' },
      { kind: 'combat', id: 'foreign-tank' },
      { kind: 'building', id: 'foreign-factory', buildingType: 'units-factory', tx: 10, ty: 10 },
    ]);
    const pruned = pruneMissingEntities(selection, state);
    expect(pruned?.units).toEqual([{ kind: 'builder', id: 'human-builder' }]);
  });

  it('prunes foreign units when a control group is recalled', () => {
    const state = makeState();
    const groups = new ControlGroupManager();
    groups.assignGroup(1, selectMany([
      { kind: 'builder', id: 'human-builder' },
      { kind: 'builder', id: 'foreign-builder' },
    ]));
    expect(groups.recallGroup(1, state)?.units).toEqual([{ kind: 'builder', id: 'human-builder' }]);
  });

  it('rejects move and stop commands for a foreign civil unit without mutation', () => {
    const state = makeState();
    const foreign = state.mapData.builders.find(unit => unit.id === 'foreign-builder')!;
    expect(issueManualMove(state, { kind: 'builder', id: foreign.id }, 8, 4)).toEqual({ ok: false, reason: 'not-owner' });
    expect(foreign.phase).toBe('idle');
    expect(foreign.path).toEqual([]);
    expect(stopUnitCommand(state, { kind: 'builder', id: foreign.id })).toEqual({ ok: false, reason: 'not-owner' });
  });

  it('rejects a foreign player attacker but keeps the generic combat runtime available', () => {
    const state = makeState();
    expect(issuePlayerCombatUnitAttack(state, 'foreign-tank', 'human-tank')).toEqual({ ok: false, reason: 'not-owner' });
    expect(issuePlayerCombatUnitAttack(state, 'human-tank', 'foreign-tank')).toEqual({ ok: true });
    expect(state.combatUnits.find(unit => unit.id === 'human-tank')!.runtime!.targetId).toBe('foreign-tank');
  });
});
