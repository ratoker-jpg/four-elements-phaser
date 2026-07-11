import { describe, expect, it } from 'vitest';
import type { MapData } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import {
  devAddMatter,
  devSpawnBuilder,
  devSpawnHarvester,
} from '../state/devCommands';
import { resolveEntityFaction } from '../state/teamOwnership';
import { buildSelectionViewModel } from '../phaser/ui/hud/selectionViewModel';
import { buildFactoryComposerPreviewViewModel } from '../phaser/ui/hud/factoryComposerPreviewViewModel';
import { getBuildingSelectionId, selectOne } from '../state/unitSelection';

function makeState() {
  const map: MapData = {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 16, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], constructionSites: [],
    builders: [{
      id: 'green-builder', ownerTeamId: 'team-green', tx: 8, ty: 8, ftx: 8, fty: 8,
      busy: false, phase: 'idle', path: [], pathIndex: 0, targetTx: 8, targetTy: 8,
      assignedSiteId: -1,
    }],
    buildings: [{ tx: 10, ty: 10, type: 'units-factory', ownerTeamId: 'team-green' }],
  };
  const state = createInitialState(map, 'cyan');
  state.production.factories.push({
    tx: 10, ty: 10, ownerTeamId: 'team-green', queue: [], active: false,
  });
  return state;
}

describe('SKIRMISH-P4C owner-aware presentation', () => {
  it('resolves explicit team ownership before legacy faction fallback', () => {
    const state = makeState();
    expect(resolveEntityFaction(state, { ownerTeamId: 'team-green', faction: 'cyan' })).toBe('green');
    expect(resolveEntityFaction(state, { faction: 'purple' })).toBe('purple');
    expect(resolveEntityFaction(state, {})).toBe('cyan');
  });

  it('shows the selected Builder and factory with their owner faction', () => {
    const state = makeState();
    const builderVm = buildSelectionViewModel(state, selectOne({ kind: 'builder', id: 'green-builder' }));
    expect(builderVm.faction).toBe('green');

    const factorySelection = selectOne({
      kind: 'building',
      id: getBuildingSelectionId('units-factory', 10, 10),
      buildingType: 'units-factory',
      tx: 10,
      ty: 10,
    });
    const factoryVm = buildSelectionViewModel(state, factorySelection);
    expect(factoryVm.faction).toBe('green');
    const preview = buildFactoryComposerPreviewViewModel(state, factorySelection);
    expect(preview.hullSrc).toContain('/green/m0/');
    expect(preview.turretSrc).toContain('/green/m0/');
  });

  it('mutates only the human economy through dev resource commands', () => {
    const state = makeState();
    const human = state.match!.teams['team-cyan'];
    const green = state.match!.teams['team-green'];
    human.economy.matter = 10;
    green.economy.matter = 200;
    expect(devAddMatter(state).success).toBe(true);
    expect(human.economy.matter).toBe(60);
    expect(green.economy.matter).toBe(200);
  });

  it('assigns canonical human ownership to dev-spawned civil units and render entities', () => {
    const state = makeState();
    expect(devSpawnBuilder(state).success).toBe(true);
    expect(devSpawnHarvester(state).success).toBe(true);
    const builder = state.mapData.builders.find(unit => unit.id.startsWith('dev-builder-'))!;
    const harvester = state.harvesters.find(unit => unit.id.startsWith('dev-harvester-'))!;
    expect(builder.ownerTeamId).toBe('team-cyan');
    expect(harvester.ownerTeamId).toBe('team-cyan');
    expect(harvester.faction).toBe('cyan');
    expect(state.entities.find(entity => entity.id === builder.id)?.ownerTeamId).toBe('team-cyan');
    expect(state.entities.find(entity => entity.id === harvester.id)?.ownerTeamId).toBe('team-cyan');
  });
});
