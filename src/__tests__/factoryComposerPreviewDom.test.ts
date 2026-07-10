/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HudSelectionPanel } from '../phaser/ui/hud/HudSelectionPanel';
import { createInitialState } from '../state/createInitialState';
import { getBuildingSelectionId, selectOne } from '../state/unitSelection';
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

describe('SKIRMISH-P3C selection-panel preview DOM', () => {
  let panel: HudSelectionPanel;
  let parent: HTMLDivElement;

  beforeEach(() => {
    panel = new HudSelectionPanel();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    panel.create(parent);
  });

  afterEach(() => {
    panel.destroy();
    parent.remove();
  });

  it('renders separate hull and turret layers and updates only their sources', () => {
    const state = makeState();
    panel.update(state, factorySelection(), { bodyId: 'wasp', weaponId: 'smoky' });

    const preview = parent.querySelector('#hsp-factory-preview') as HTMLDivElement;
    const hull = parent.querySelector('#hsp-preview-hull') as HTMLImageElement;
    const turret = parent.querySelector('#hsp-preview-turret') as HTMLImageElement;
    expect(preview.style.display).toBe('flex');
    expect(hull.getAttribute('src')).toContain('/wasp/cyan/m0/wasp_cyan_m0_hull_dir02_SE.png');
    expect(turret.getAttribute('src')).toContain('/smoky/cyan/m0/smoky_cyan_m0_dir02_SE.png');

    panel.update(state, factorySelection(), { bodyId: 'hunter', weaponId: 'railgun' });
    expect(hull.getAttribute('src')).toContain('/hunter/cyan/m0/hunter_cyan_m0_hull_dir02_SE.png');
    expect(turret.getAttribute('src')).toContain('/railgun/cyan/m0/railgun_cyan_m0_dir02_SE.png');
    expect(parent.querySelectorAll('.hsp-preview-layer')).toHaveLength(2);
  });

  it('hides the preview when the factory is deselected', () => {
    const state = makeState();
    panel.update(state, factorySelection(), { bodyId: 'wasp', weaponId: 'smoky' });
    panel.update(state, null);
    const preview = parent.querySelector('#hsp-factory-preview') as HTMLDivElement;
    expect(preview.style.display).toBe('none');
  });

  it('shows a bounded fallback when either PNG fails', () => {
    panel.update(makeState(), factorySelection(), { bodyId: 'wasp', weaponId: 'smoky' });
    const hull = parent.querySelector('#hsp-preview-hull') as HTMLImageElement;
    const fallback = parent.querySelector('#hsp-preview-fallback') as HTMLDivElement;
    hull.dispatchEvent(new Event('error'));
    expect(fallback.style.display).toBe('flex');
    expect(hull.style.visibility).toBe('hidden');
  });
});
