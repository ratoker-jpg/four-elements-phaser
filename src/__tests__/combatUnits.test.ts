import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/createInitialState';
import {
  allocateCombatUnitId,
  combatUnitToRenderableEntity,
  normalizeCombatUnitState,
  normalizeProductionRequest,
} from '../state/combatUnits';
import type { ModularCombatUnit } from '../state/types';

describe('Phase 2 canonical combat unit state', () => {
  it('migrates legacy combined mod and initializes deterministic counter', () => {
    const state = createInitialState();
    delete state.nextCombatUnitId;
    state.combatUnits = [{
      id: 'combat-unit-4',
      tx: 7,
      ty: 8,
      bodyId: 'wasp',
      weaponId: 'smoky',
      mod: 'm2',
      faction: 'cyan',
    }];

    normalizeCombatUnitState(state);

    expect(state.combatUnits[0].hullMod).toBe('m2');
    expect(state.combatUnits[0].turretMod).toBe('m2');
    expect(state.combatUnits[0].mod).toBeUndefined();
    expect(state.combatUnits[0].dir).toBe(2);
    expect(state.combatUnits[0].turretDir).toBe(2);
    expect(state.nextCombatUnitId).toBe(5);
  });

  it('repairs duplicate IDs without changing the first unit', () => {
    const state = createInitialState();
    state.combatUnits = [
      {
        id: 'combat-unit-0', tx: 1, ty: 1,
        bodyId: 'wasp', weaponId: 'smoky',
        hullMod: 'm0', turretMod: 'm0', faction: 'cyan',
      },
      {
        id: 'combat-unit-0', tx: 2, ty: 2,
        bodyId: 'hunter', weaponId: 'railgun',
        hullMod: 'm1', turretMod: 'm2', faction: 'green',
      },
    ];

    normalizeCombatUnitState(state);

    expect(state.combatUnits[0].id).toBe('combat-unit-0');
    expect(state.combatUnits[1].id).not.toBe('combat-unit-0');
    expect(new Set(state.combatUnits.map(unit => unit.id)).size).toBe(2);
  });

  it('allocates stable monotonic IDs without Date.now', () => {
    const state = createInitialState();
    state.combatUnits = [{
      id: 'combat-unit-2', tx: 1, ty: 1,
      bodyId: 'wasp', weaponId: 'smoky',
      hullMod: 'm0', turretMod: 'm0', faction: 'cyan',
    }];
    delete state.nextCombatUnitId;

    expect(allocateCombatUnitId(state)).toBe('combat-unit-3');
    expect(allocateCombatUnitId(state)).toBe('combat-unit-4');
  });

  it('normalizes legacy preset and structured combat requests', () => {
    const legacy = normalizeProductionRequest('wasp-smoky');
    expect(legacy.request).toEqual({
      kind: 'combat',
      bodyId: 'wasp',
      weaponId: 'smoky',
      hullMod: 'm0',
      turretMod: 'm0',
    });

    const structured = normalizeProductionRequest({
      kind: 'combat',
      bodyId: 'hunter',
      weaponId: 'railgun',
      hullMod: 'm1',
      turretMod: 'm3',
    });
    expect(structured.unitType).toBe('wasp-smoky');
    expect(structured.request).toMatchObject({
      bodyId: 'hunter',
      weaponId: 'railgun',
      hullMod: 'm1',
      turretMod: 'm3',
    });
  });

  it('derives render input from canonical state without an entities copy', () => {
    const unit: ModularCombatUnit = {
      id: 'combat-unit-9',
      tx: 4,
      ty: 6,
      bodyId: 'dictator',
      weaponId: 'thunder',
      hullMod: 'm2',
      turretMod: 'm1',
      faction: 'purple',
      dir: 5,
      turretDir: 7,
    };

    expect(combatUnitToRenderableEntity(unit)).toEqual({
      id: 'combat-unit-9',
      kind: 'modular-combat',
      tx: 4,
      ty: 6,
      faction: 'purple',
      dir: 5,
      turretDir: 7,
    });
  });
});
