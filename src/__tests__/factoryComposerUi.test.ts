import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/createInitialState';
import {
  DEFAULT_FACTORY_COMPOSER_STATE,
  createFactoryComposerRequest,
  getFactoryComposerQuote,
  reduceFactoryComposer,
} from '../state/factoryComposer';
import { routeLmbClick, routeRmbClick, routeSKey } from '../state/commandRouter';
import { buildCommandCardViewModel } from '../phaser/ui/hud/commandPanelViewModel';
import { buildSelectionViewModel } from '../phaser/ui/hud/selectionViewModel';
import { getBuildingSelectionId, selectOne } from '../state/unitSelection';
import type { MapData } from '../state/types';

function makeState() {
  const map: MapData = {
    width: 24,
    height: 24,
    terrain: Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 18, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], builders: [], constructionSites: [],
    buildings: [{ tx: 8, ty: 8, type: 'units-factory' }],
  };
  const state = createInitialState(map, 'cyan');
  state.harvesters = [];
  state.extraHarvesters = [];
  state.combatUnits = [];
  state.economy.matter = 500;
  state.economy.elements.cyan = 200;
  return state;
}

function factorySelection() {
  return selectOne({
    kind: 'building' as const,
    id: getBuildingSelectionId('units-factory', 8, 8),
    buildingType: 'units-factory' as const,
    tx: 8,
    ty: 8,
  });
}

describe('SKIRMISH-P3B factory composer state', () => {
  it('selects hull and turret independently and creates a structured M0 request', () => {
    let composer = { ...DEFAULT_FACTORY_COMPOSER_STATE };
    composer = reduceFactoryComposer(composer, 'factory-body-hunter');
    composer = reduceFactoryComposer(composer, 'factory-weapon-railgun');
    expect(composer).toEqual({ bodyId: 'hunter', weaponId: 'railgun' });
    expect(createFactoryComposerRequest(composer)).toEqual({
      kind: 'combat', bodyId: 'hunter', weaponId: 'railgun', hullMod: 'm0', turretMod: 'm0',
    });
    expect(getFactoryComposerQuote(composer)).toMatchObject({ matterCost: 80, elementCost: 15, durationMs: 32_000 });
  });
});

describe('SKIRMISH-P3B building selection', () => {
  it('routes a completed factory click to a building selection', () => {
    const result = routeLmbClick({
      kind: 'own-building', id: getBuildingSelectionId('units-factory', 8, 8),
      buildingType: 'units-factory', tx: 8, ty: 8,
    }, null);
    expect(result.action).toBe('select');
    if (result.action === 'select') expect(result.selection?.units[0]).toMatchObject({ kind: 'building', buildingType: 'units-factory', tx: 8, ty: 8 });
  });

  it('does not route move or stop commands for a building-only selection', () => {
    const selection = factorySelection();
    expect(routeRmbClick({ kind: 'ground', tx: 12, ty: 12 }, selection)).toEqual({ action: 'no-op', reason: 'building-selected' });
    expect(routeSKey(selection)).toEqual({ action: 'no-op' });
  });
});

describe('SKIRMISH-P3B active command card', () => {
  it('shows the selected combination, exact quote and contextual factory actions', () => {
    const state = makeState();
    const composer = { bodyId: 'hunter' as const, weaponId: 'railgun' as const };
    const vm = buildCommandCardViewModel(state, factorySelection(), composer);
    expect(vm.contextKind).toBe('building');
    expect(vm.contextLabel).toContain('Хантер + Рельса');
    expect(vm.contextLabel).toContain('очередь 0/2');
    const slots = Object.fromEntries(vm.slots.map(slot => [slot.slotKey, slot]));
    expect(slots.Q.label).toBe('○ Васп');
    expect(slots.W.label).toBe('● Хантер');
    expect(slots.A.label).toBe('○ Смоки');
    expect(slots.S.label).toBe('● Рельса');
    expect(slots.Z).toMatchObject({ commandId: 'factory-queue-combat', state: 'enabled', cost: '80 M · 15 E · 32 с' });
    expect(slots.X.commandId).toBe('produce-builder');
    expect(slots.C.commandId).toBe('produce-harvester');
    expect(slots.V).toMatchObject({ commandId: 'factory-cancel-first', state: 'disabled' });
  });

  it('shows selected factory queue progress and enables cancellation', () => {
    const state = makeState();
    state.production.factories[0].queue.push({
      unitType: 'wasp-smoky',
      request: createFactoryComposerRequest({ bodyId: 'wasp', weaponId: 'smoky' }),
      elapsedMs: 12_500, durationMs: 25_000, progress: 0.5, completed: false,
    });
    const vm = buildCommandCardViewModel(state, factorySelection(), DEFAULT_FACTORY_COMPOSER_STATE);
    expect(vm.contextLabel).toContain('сейчас: Васп + Смоки 50%');
    expect(vm.slots.find(slot => slot.slotKey === 'V')).toMatchObject({ state: 'enabled', cost: 'Васп + Смоки' });
  });

  it('renders factory details in the selection panel', () => {
    const state = makeState();
    expect(buildSelectionViewModel(state, factorySelection())).toMatchObject({
      hasSelection: true, kind: 'building', status: 'Очередь: 0/2',
    });
  });
});
