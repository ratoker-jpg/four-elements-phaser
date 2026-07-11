import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/createInitialState';
import { getBuildingSelectionId, selectOne } from '../state/unitSelection';
import { buildFactoryComposerPreviewViewModel, FACTORY_PREVIEW_DIR16 } from '../phaser/ui/hud/factoryComposerPreviewViewModel';
import type { FactoryComposerState } from '../state/factoryComposer';
import type { MapData } from '../state/types';

function makeState() {
  const map: MapData = {
    width: 16,
    height: 16,
    terrain: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 12, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], builders: [], constructionSites: [],
    buildings: [{ tx: 6, ty: 6, type: 'units-factory' }],
  };
  return createInitialState(map, 'cyan');
}

function factorySelection() {
  return selectOne({
    kind: 'building' as const,
    id: getBuildingSelectionId('units-factory', 6, 6),
    buildingType: 'units-factory' as const,
    tx: 6,
    ty: 6,
  });
}

const COMBINATIONS: FactoryComposerState[] = [
  { bodyId: 'wasp', weaponId: 'smoky' },
  { bodyId: 'hunter', weaponId: 'smoky' },
  { bodyId: 'wasp', weaponId: 'railgun' },
  { bodyId: 'hunter', weaponId: 'railgun' },
];

describe('SKIRMISH-P3C factory composer preview view model', () => {
  it('uses a fixed SE direction and exactly two independent PNG paths', () => {
    expect(FACTORY_PREVIEW_DIR16).toBe(2);
    for (const composer of COMBINATIONS) {
      const vm = buildFactoryComposerPreviewViewModel(makeState(), factorySelection(), composer);
      expect(vm.visible).toBe(true);
      expect(vm.hullSrc).toBe(`assets/units/hulls/${composer.bodyId}/cyan/m0/${composer.bodyId}_cyan_m0_hull_dir02_SE.png`);
      expect(vm.turretSrc).toBe(`assets/units/turrets/${composer.weaponId}/cyan/m0/${composer.weaponId}_cyan_m0_dir02_SE.png`);
      expect(vm.hullSrc).not.toBe(vm.turretSrc);
      expect(`${vm.hullSrc}${vm.turretSrc}`).not.toContain(`${composer.bodyId}-${composer.weaponId}`);
    }
  });

  it('uses the selected factory owner faction asset variant', () => {
    const state = makeState();
    state.mapData.buildings[0].ownerTeamId = 'team-purple';
    state.production.factories[0].ownerTeamId = 'team-purple';
    const vm = buildFactoryComposerPreviewViewModel(state, factorySelection(), { bodyId: 'hunter', weaponId: 'railgun' });
    expect(vm.hullSrc).toContain('/purple/m0/hunter_purple_m0_');
    expect(vm.turretSrc).toContain('/purple/m0/railgun_purple_m0_');
  });

  it('is hidden outside a selected units-factory', () => {
    expect(buildFactoryComposerPreviewViewModel(makeState(), null).visible).toBe(false);
    const builder = selectOne({ kind: 'builder', id: 'builder-0' });
    expect(buildFactoryComposerPreviewViewModel(makeState(), builder).visible).toBe(false);
  });
});
