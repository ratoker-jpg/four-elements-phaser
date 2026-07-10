from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding='utf-8')
    if old not in text:
        if new in text:
            return
        raise SystemExit(f'anchor not found in {path}: {old[:140]!r}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


(ROOT / 'src/phaser/ui/hud/factoryComposerPreviewViewModel.ts').write_text(r'''import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { getPrimarySelection } from '../../../state/unitSelection';
import {
  DEFAULT_FACTORY_COMPOSER_STATE,
  getFactoryComposerQuote,
  type FactoryComposerState,
} from '../../../state/factoryComposer';
import {
  getGeneratedHullAssetPath,
  resolveGeneratedHullFaction,
  type GeneratedHullDir16Index,
} from '../../../assets/generatedHullAssets';
import {
  getGeneratedTurretAssetPath,
  weaponIdToTurretId,
  type GeneratedTurretDir16Index,
} from '../../../assets/generatedTurretAssets';

/** Fixed three-quarter preview direction: SE. */
export const FACTORY_PREVIEW_DIR16 = 2 as GeneratedHullDir16Index & GeneratedTurretDir16Index;

export interface FactoryComposerPreviewViewModel {
  visible: boolean;
  hullSrc: string;
  turretSrc: string;
  label: string;
  alt: string;
}

export const EMPTY_FACTORY_COMPOSER_PREVIEW: Readonly<FactoryComposerPreviewViewModel> = {
  visible: false,
  hullSrc: '',
  turretSrc: '',
  label: '',
  alt: '',
};

/**
 * Resolve exactly two independent PNG layers for the selected T1 composition.
 * No combined hull×turret asset path is generated or cached.
 */
export function buildFactoryComposerPreviewViewModel(
  state: GameState,
  selection: UnitSelection,
  composer: FactoryComposerState = DEFAULT_FACTORY_COMPOSER_STATE,
): FactoryComposerPreviewViewModel {
  const primary = getPrimarySelection(selection);
  if (!primary || primary.kind !== 'building' || primary.buildingType !== 'units-factory') {
    return { ...EMPTY_FACTORY_COMPOSER_PREVIEW };
  }

  const quote = getFactoryComposerQuote(composer);
  const turretId = weaponIdToTurretId(quote.weaponId);
  if (!turretId) return { ...EMPTY_FACTORY_COMPOSER_PREVIEW };

  const faction = resolveGeneratedHullFaction(state.playerFaction);
  return {
    visible: true,
    hullSrc: getGeneratedHullAssetPath(quote.bodyId, faction, quote.hullMod, FACTORY_PREVIEW_DIR16),
    turretSrc: getGeneratedTurretAssetPath(turretId, faction, quote.turretMod, FACTORY_PREVIEW_DIR16),
    label: quote.displayNameRu,
    alt: `Предпросмотр: ${quote.displayNameRu}`,
  };
}
''', encoding='utf-8')

replace_once(
    'src/phaser/ui/hud/VisualHudCore.ts',
    'this.selectionPanel.update(state, this.currentSelection);',
    'this.selectionPanel.update(state, this.currentSelection, composer);',
)

panel_path = ROOT / 'src/phaser/ui/hud/HudSelectionPanel.ts'
text = panel_path.read_text(encoding='utf-8')
text = text.replace(
    "import type { UnitSelection } from '../../../state/unitSelection';",
    "import type { UnitSelection } from '../../../state/unitSelection';\nimport type { FactoryComposerState } from '../../../state/factoryComposer';\nimport { buildFactoryComposerPreviewViewModel, type FactoryComposerPreviewViewModel } from './factoryComposerPreviewViewModel';",
    1,
)
text = text.replace(
    """  private breakdownEl!: HTMLSpanElement;
""",
    """  private breakdownEl!: HTMLSpanElement;
  private previewEl!: HTMLDivElement;
  private previewHullImg!: HTMLImageElement;
  private previewTurretImg!: HTMLImageElement;
  private previewLabelEl!: HTMLSpanElement;
  private previewFallbackEl!: HTMLDivElement;
""",
    1,
)
text = text.replace(
    """    this.breakdownEl = this.container.querySelector('#hsp-breakdown')!;
  }

  update(state: GameState, selection: UnitSelection): void {
    const vm = buildSelectionViewModel(state, selection);
    this.applyViewModel(vm);
  }
""",
    """    this.breakdownEl = this.container.querySelector('#hsp-breakdown')!;
    this.previewEl = this.container.querySelector('#hsp-factory-preview')!;
    this.previewHullImg = this.container.querySelector('#hsp-preview-hull')!;
    this.previewTurretImg = this.container.querySelector('#hsp-preview-turret')!;
    this.previewLabelEl = this.container.querySelector('#hsp-preview-label')!;
    this.previewFallbackEl = this.container.querySelector('#hsp-preview-fallback')!;

    const onLayerLoad = (event: Event) => {
      (event.currentTarget as HTMLImageElement).dataset.loadState = 'loaded';
      this.refreshPreviewLoadState();
    };
    const onLayerError = (event: Event) => {
      (event.currentTarget as HTMLImageElement).dataset.loadState = 'failed';
      this.refreshPreviewLoadState();
    };
    this.previewHullImg.addEventListener('load', onLayerLoad);
    this.previewHullImg.addEventListener('error', onLayerError);
    this.previewTurretImg.addEventListener('load', onLayerLoad);
    this.previewTurretImg.addEventListener('error', onLayerError);
  }

  update(state: GameState, selection: UnitSelection, composer?: FactoryComposerState): void {
    const vm = buildSelectionViewModel(state, selection);
    this.applyViewModel(vm);
    this.applyPreviewViewModel(buildFactoryComposerPreviewViewModel(state, selection, composer));
  }
""",
    1,
)
insert_anchor = """  private applyViewModel(vm: SelectionViewModel): void {
"""
preview_methods = r'''  private applyPreviewViewModel(vm: FactoryComposerPreviewViewModel): void {
    if (!vm.visible) {
      this.previewEl.style.display = 'none';
      this.previewHullImg.removeAttribute('src');
      this.previewTurretImg.removeAttribute('src');
      return;
    }

    this.previewEl.style.display = 'flex';
    this.previewLabelEl.textContent = vm.label;
    this.previewHullImg.alt = vm.alt;
    this.previewTurretImg.alt = '';

    if (this.previewHullImg.getAttribute('src') !== vm.hullSrc) {
      this.previewHullImg.dataset.loadState = 'loading';
      this.previewHullImg.src = vm.hullSrc;
    }
    if (this.previewTurretImg.getAttribute('src') !== vm.turretSrc) {
      this.previewTurretImg.dataset.loadState = 'loading';
      this.previewTurretImg.src = vm.turretSrc;
    }
    this.refreshPreviewLoadState();
  }

  private refreshPreviewLoadState(): void {
    const failed = this.previewHullImg.dataset.loadState === 'failed'
      || this.previewTurretImg.dataset.loadState === 'failed';
    this.previewFallbackEl.style.display = failed ? 'flex' : 'none';
    this.previewHullImg.style.visibility = failed ? 'hidden' : 'visible';
    this.previewTurretImg.style.visibility = failed ? 'hidden' : 'visible';
  }

'''
if insert_anchor not in text:
    raise SystemExit('selection panel method anchor not found')
text = text.replace(insert_anchor, preview_methods + insert_anchor, 1)
text = text.replace(
    """      #hsp-content {
        display: none;
        flex-direction: column;
        gap: 8px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
""",
    """      #hsp-content {
        display: none;
        flex-direction: row;
        align-items: center;
        gap: 14px;
        min-width: 0;
        height: 100%;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      #hsp-info {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-direction: column;
        gap: 8px;
      }
      #hsp-factory-preview {
        display: none;
        flex: 0 0 136px;
        width: 136px;
        height: 150px;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
      }
      #hsp-preview-stage {
        position: relative;
        width: 132px;
        height: 124px;
        overflow: hidden;
        border: 1px solid rgba(96, 208, 208, 0.22);
        border-radius: 8px;
        background:
          radial-gradient(circle at 50% 62%, rgba(96, 208, 208, 0.14), transparent 52%),
          linear-gradient(180deg, rgba(20, 31, 40, 0.8), rgba(5, 8, 12, 0.92));
      }
      .hsp-preview-layer {
        position: absolute;
        inset: -4px;
        width: 140px;
        height: 140px;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
      }
      #hsp-preview-hull { z-index: 1; }
      #hsp-preview-turret { z-index: 2; }
      #hsp-preview-fallback {
        display: none;
        position: absolute;
        inset: 0;
        align-items: center;
        justify-content: center;
        color: #70808a;
        font-size: 11px;
        text-align: center;
        padding: 12px;
      }
      #hsp-preview-label {
        max-width: 132px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #9ed9d9;
        font-size: 11px;
        font-weight: 600;
      }
""",
    1,
)
old_html = """      <div id="hsp-content">
        <div id="hsp-header">
          <span id="hsp-name">—</span>
          <span id="hsp-kind">—</span>
          <span id="hsp-count">—</span>
          <span id="hsp-faction">—</span>
        </div>
        <div>
          <span id="hsp-breakdown">—</span>
        </div>
        <div id="hsp-hp-bar">
          <div id="hsp-hp-track"><div id="hsp-hp-fill"></div></div>
          <span id="hsp-hp-text">—</span>
        </div>
        <div id="hsp-status">—</div>
      </div>
"""
new_html = """      <div id="hsp-content">
        <div id="hsp-factory-preview" aria-live="polite">
          <div id="hsp-preview-stage">
            <img id="hsp-preview-hull" class="hsp-preview-layer" draggable="false" alt="" />
            <img id="hsp-preview-turret" class="hsp-preview-layer" draggable="false" alt="" />
            <div id="hsp-preview-fallback">Предпросмотр недоступен</div>
          </div>
          <span id="hsp-preview-label">—</span>
        </div>
        <div id="hsp-info">
          <div id="hsp-header">
            <span id="hsp-name">—</span>
            <span id="hsp-kind">—</span>
            <span id="hsp-count">—</span>
            <span id="hsp-faction">—</span>
          </div>
          <div>
            <span id="hsp-breakdown">—</span>
          </div>
          <div id="hsp-hp-bar">
            <div id="hsp-hp-track"><div id="hsp-hp-fill"></div></div>
            <span id="hsp-hp-text">—</span>
          </div>
          <div id="hsp-status">—</div>
        </div>
      </div>
"""
if old_html not in text:
    raise SystemExit('selection panel html block not found')
text = text.replace(old_html, new_html, 1)
panel_path.write_text(text, encoding='utf-8')

(ROOT / 'src/__tests__/factoryComposerPreview.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
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

  it('uses the player faction asset variant', () => {
    const state = makeState();
    state.playerFaction = 'purple';
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
''', encoding='utf-8')

(ROOT / 'src/__tests__/factoryComposerPreviewDom.test.ts').write_text(r'''/** @vitest-environment jsdom */
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
''', encoding='utf-8')
