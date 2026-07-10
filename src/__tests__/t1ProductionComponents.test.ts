import { describe, expect, it } from 'vitest';
import {
  T1_ASSEMBLY_OFFSET_MS,
  T1_BODY_COMPONENTS,
  T1_LEGAL_COMBINATIONS,
  T1_WEAPON_COMPONENTS,
  getT1CombatProductionQuote,
} from '../config/t1ProductionComponents';
import { createInitialState } from '../state/createInitialState';
import { getProductionQuote, startUnitProduction } from '../state/production';
import type { MapData, UnitProductionRequest } from '../state/types';
import { updateGameState } from '../state/updateGameState';

const EXPECTED = [
  { bodyId: 'wasp', weaponId: 'smoky', matterCost: 45, elementCost: 10, durationMs: 25_000 },
  { bodyId: 'hunter', weaponId: 'smoky', matterCost: 60, elementCost: 12, durationMs: 25_000 },
  { bodyId: 'wasp', weaponId: 'railgun', matterCost: 65, elementCost: 13, durationMs: 32_000 },
  { bodyId: 'hunter', weaponId: 'railgun', matterCost: 80, elementCost: 15, durationMs: 32_000 },
] as const;

function makeState() {
  const mapData: MapData = {
    width: 30,
    height: 30,
    terrain: Array.from({ length: 30 }, () => Array.from({ length: 30 }, () => 'sand' as const)),
    hq: { tx: 2, ty: 24, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [{ tx: 10, ty: 10, type: 'units-factory' }],
    builders: [],
    constructionSites: [],
  };
  const state = createInitialState(mapData, 'cyan');
  state.harvesters = [];
  state.extraHarvesters = [];
  state.combatUnits = [];
  state.economy.matter = 500;
  state.economy.matterCap = 1_000;
  state.economy.elements.cyan = 200;
  state.economy.elementCap = 1_000;
  return state;
}

function request(bodyId: string, weaponId: string): Extract<UnitProductionRequest, { kind: 'combat' }> {
  return {
    kind: 'combat',
    bodyId: bodyId as never,
    weaponId: weaponId as never,
    hullMod: 'm0',
    turretMod: 'm0',
  };
}

describe('SKIRMISH-P3A T1 production catalog', () => {
  it('keeps the accepted component values in one catalog', () => {
    expect(T1_ASSEMBLY_OFFSET_MS).toBe(7_000);
    expect(T1_BODY_COMPONENTS.wasp).toMatchObject({ matterCost: 20, elementCost: 5, productionDurationMs: 7_000 });
    expect(T1_BODY_COMPONENTS.hunter).toMatchObject({ matterCost: 35, elementCost: 7, productionDurationMs: 12_000 });
    expect(T1_WEAPON_COMPONENTS.smoky).toMatchObject({ matterCost: 25, elementCost: 5, productionDurationMs: 18_000 });
    expect(T1_WEAPON_COMPONENTS.railgun).toMatchObject({ matterCost: 45, elementCost: 8, productionDurationMs: 25_000 });
    expect(T1_LEGAL_COMBINATIONS).toHaveLength(4);
  });

  for (const expected of EXPECTED) {
    it(`quotes ${expected.bodyId} + ${expected.weaponId} additively`, () => {
      expect(getT1CombatProductionQuote(request(expected.bodyId, expected.weaponId))).toMatchObject(expected);
    });
  }

  it('keeps legacy wasp-smoky equivalent to the canonical T1 quote', () => {
    const legacy = getProductionQuote('wasp-smoky');
    expect(legacy).toMatchObject({ matterCost: 45, elementCost: 10, durationMs: 25_000 });
    expect(legacy?.request).toEqual(request('wasp', 'smoky'));
  });

  it('rejects non-T1 component selections', () => {
    expect(getT1CombatProductionQuote(request('dictator', 'smoky'))).toBeNull();
    expect(getT1CombatProductionQuote(request('wasp', 'thunder'))).toBeNull();
  });
});

describe('SKIRMISH-P3A structured production integration', () => {
  for (const expected of EXPECTED) {
    it(`queues and spawns ${expected.bodyId} + ${expected.weaponId}`, () => {
      const state = makeState();
      const input = request(expected.bodyId, expected.weaponId);
      const matterBefore = state.economy.matter;
      const elementsBefore = state.economy.elements.cyan;

      expect(startUnitProduction(state, 10, 10, input)).toEqual({ ok: true });
      const item = state.production.factories[0].queue[0];
      expect(item.unitType).toBe('wasp-smoky');
      expect(item.request).toEqual(input);
      expect(item.durationMs).toBe(expected.durationMs);
      expect(state.economy.matter).toBe(matterBefore - expected.matterCost);
      expect(state.economy.elements.cyan).toBe(elementsBefore - expected.elementCost);

      item.elapsedMs = item.durationMs;
      item.progress = 1;
      item.completed = true;
      updateGameState(state, 1);

      expect(state.production.factories[0].queue).toHaveLength(0);
      expect(state.combatUnits).toHaveLength(1);
      expect(state.combatUnits[0]).toMatchObject({
        bodyId: expected.bodyId,
        weaponId: expected.weaponId,
        hullMod: 'm0',
        turretMod: 'm0',
      });
    });
  }

  it('rejects unsupported structured requests without mutating economy or queue', () => {
    const state = makeState();
    const matterBefore = state.economy.matter;
    const elementsBefore = state.economy.elements.cyan;
    const invalid = request('dictator', 'smoky');

    expect(startUnitProduction(state, 10, 10, invalid)).toEqual({
      ok: false,
      reason: 'unsupported-unit-type',
    });
    expect(state.economy.matter).toBe(matterBefore);
    expect(state.economy.elements.cyan).toBe(elementsBefore);
    expect(state.production.factories[0].queue).toHaveLength(0);
  });
});
