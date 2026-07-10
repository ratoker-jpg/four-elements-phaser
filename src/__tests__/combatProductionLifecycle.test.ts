import { beforeEach, describe, expect, it } from 'vitest';
import { startUnitProduction } from '../state/production';
import { updateGameState } from '../state/updateGameState';
import {
  getSaveSlotMetas,
  loadGame,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';
import { stripModularCombatFromState } from '../state/createInitialState';
import { combatUnitToRenderableEntity } from '../state/combatUnits';
import { createInitialVisionState } from '../state/visibility';
import type { EconomyState, GameState, MapData } from '../state/types';
import {
  DEFAULT_UNIT_CAP,
  HQ_BASE_POWER,
  WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS,
} from '../state/types';

function createMemoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
      return true;
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createLifecycleState(): GameState {
  const width = 30;
  const height = 30;
  const mapData: MapData = {
    width,
    height,
    terrain: Array.from({ length: height }, () => Array(width).fill('sand')),
    hq: { tx: 1, ty: 1, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [{ tx: 10, ty: 10, type: 'units-factory' }],
    builders: [],
    constructionSites: [],
  };
  const economy: EconomyState = {
    raw: 0,
    matter: 500,
    elements: { cyan: 200, green: 0, yellow: 0, purple: 0 },
    powerGenerated: HQ_BASE_POWER,
    powerConsumed: 0,
    separators: [],
    rawCap: 200,
    matterCap: 500,
    elementCap: 200,
  };

  return {
    mapId: 'combat-lifecycle-map',
    mapName: 'Combat lifecycle test',
    mapWidth: width,
    mapHeight: height,
    mapData,
    entities: [],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [],
    resourceNodes: [],
    economy,
    hqPosition: { tx: 2, ty: 2 },
    nextConstructionId: 0,
    nextCombatUnitId: 0,
    production: {
      factories: [{ tx: 10, ty: 10, queue: [], active: false }],
    },
    combatUnits: [],
    vision: createInitialVisionState(width, height),
  };
}

beforeEach(() => {
  setSaveStorage(createMemoryStorage());
});

describe('combat production lifecycle integration', () => {
  it('produces two canonical units, survives save/load and counts cap once', () => {
    const state = createLifecycleState();

    const first = startUnitProduction(state, 10, 10, {
      kind: 'combat',
      bodyId: 'wasp',
      weaponId: 'smoky',
      hullMod: 'm0',
      turretMod: 'm1',
    });
    const second = startUnitProduction(state, 10, 10, {
      kind: 'combat',
      bodyId: 'hunter',
      weaponId: 'railgun',
      hullMod: 'm2',
      turretMod: 'm3',
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    updateGameState(state, WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS);
    expect(state.combatUnits).toHaveLength(1);
    expect(state.production.factories[0].queue).toHaveLength(1);

    updateGameState(state, WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS);
    expect(state.combatUnits).toHaveLength(2);
    expect(state.production.factories[0].queue).toHaveLength(0);

    expect(state.combatUnits.map(unit => unit.id)).toEqual([
      'combat-unit-0',
      'combat-unit-1',
    ]);
    expect(state.nextCombatUnitId).toBe(2);
    expect(state.entities.some(entity => entity.kind === 'modular-combat')).toBe(false);

    expect(state.combatUnits[0]).toMatchObject({
      bodyId: 'wasp',
      weaponId: 'smoky',
      hullMod: 'm0',
      turretMod: 'm1',
    });
    expect(state.combatUnits[1]).toMatchObject({
      bodyId: 'hunter',
      weaponId: 'railgun',
      hullMod: 'm2',
      turretMod: 'm3',
    });

    const renderInputs = state.combatUnits.map(combatUnitToRenderableEntity);
    expect(renderInputs).toHaveLength(2);
    expect(new Set(renderInputs.map(entity => entity.id)).size).toBe(2);

    const saved = saveGame(state, state.mapId);
    expect(saved.success).toBe(true);
    expect(getSaveSlotMetas()[0].summary.combatUnitsCount).toBe(2);

    const loadedResult = loadGame(saved.slotId!);
    expect(loadedResult.success).toBe(true);
    const loaded = loadedResult.gameState!;

    expect(loaded.combatUnits).toEqual(state.combatUnits);
    expect(loaded.nextCombatUnitId).toBe(2);
    expect(loaded.entities.some(entity => entity.kind === 'modular-combat')).toBe(false);

    const standardModeState = stripModularCombatFromState(loaded, {
      includeModularCombat: false,
    });
    expect(standardModeState.combatUnits).toHaveLength(2);
    expect(standardModeState.combatUnits.map(unit => unit.id)).toEqual([
      'combat-unit-0',
      'combat-unit-1',
    ]);

    for (let index = 0; index < DEFAULT_UNIT_CAP - 2; index++) {
      standardModeState.mapData.builders.push({
        id: `cap-builder-${index}`,
        tx: 1 + index,
        ty: 20,
        busy: false,
        phase: 'idle',
        path: [],
        pathIndex: 0,
        ftx: 1 + index,
        fty: 20,
        targetTx: 1 + index,
        targetTy: 20,
        assignedSiteId: -1,
      });
    }

    const matterBefore = standardModeState.economy.matter;
    const elementBefore = standardModeState.economy.elements.cyan;
    const blocked = startUnitProduction(standardModeState, 10, 10, 'builder');
    expect(blocked).toEqual({ ok: false, reason: 'unit-cap-reached' });
    expect(standardModeState.economy.matter).toBe(matterBefore);
    expect(standardModeState.economy.elements.cyan).toBe(elementBefore);
  });
});
