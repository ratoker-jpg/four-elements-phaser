/**
 * HUD Selection Panel — selected unit/building info for AoE4-inspired UX.
 *
 * SELECTION-CONTROL-GROUPS-05: Extended for multi-select:
 * - Shows count + typeBreakdown for multi-select
 * - Shows "N units selected" as status
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import type { FactoryComposerState } from '../../../state/factoryComposer';
import { buildFactoryComposerPreviewViewModel, type FactoryComposerPreviewViewModel } from './factoryComposerPreviewViewModel';
import { buildSelectionViewModel, type SelectionViewModel } from './selectionViewModel';

export class HudSelectionPanel {
  private container!: HTMLDivElement;
  private nameEl!: HTMLSpanElement;
  private kindEl!: HTMLSpanElement;
  private factionEl!: HTMLSpanElement;
  private hpBar!: HTMLDivElement;
  private hpFill!: HTMLDivElement;
  private hpText!: HTMLSpanElement;
  private statusEl!: HTMLSpanElement;
  private emptyEl!: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private countEl!: HTMLSpanElement;
  private breakdownEl!: HTMLSpanElement;
  private previewEl!: HTMLDivElement;
  private previewHullImg!: HTMLImageElement;
  private previewTurretImg!: HTMLImageElement;
  private previewLabelEl!: HTMLSpanElement;
  private previewFallbackEl!: HTMLDivElement;

  create(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'hud-selection-panel';
    this.container.innerHTML = this.css() + this.html();
    parent.appendChild(this.container);

    this.nameEl = this.container.querySelector('#hsp-name')!;
    this.kindEl = this.container.querySelector('#hsp-kind')!;
    this.factionEl = this.container.querySelector('#hsp-faction')!;
    this.hpBar = this.container.querySelector('#hsp-hp-bar')!;
    this.hpFill = this.container.querySelector('#hsp-hp-fill')!;
    this.hpText = this.container.querySelector('#hsp-hp-text')!;
    this.statusEl = this.container.querySelector('#hsp-status')!;
    this.emptyEl = this.container.querySelector('#hsp-empty')!;
    this.contentEl = this.container.querySelector('#hsp-content')!;
    this.countEl = this.container.querySelector('#hsp-count')!;
    this.breakdownEl = this.container.querySelector('#hsp-breakdown')!;
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

  destroy(): void {
    this.container?.remove();
  }

  private applyPreviewViewModel(vm: FactoryComposerPreviewViewModel): void {
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

  private applyViewModel(vm: SelectionViewModel): void {
    if (!vm.hasSelection) {
      this.emptyEl.style.display = 'flex';
      this.contentEl.style.display = 'none';
      return;
    }

    this.emptyEl.style.display = 'none';
    this.contentEl.style.display = 'flex';

    this.nameEl.textContent = vm.name;
    this.kindEl.textContent = vm.kind;
    this.factionEl.textContent = vm.faction;
    this.statusEl.textContent = vm.status;

    // SELECTION-CONTROL-GROUPS-05: Show count and breakdown for multi-select
    if (vm.count > 1) {
      this.countEl.textContent = `${vm.count}`;
      this.countEl.style.display = 'inline';
      this.breakdownEl.textContent = vm.typeBreakdown;
      this.breakdownEl.style.display = 'inline';
    } else {
      this.countEl.style.display = 'none';
      this.breakdownEl.style.display = 'none';
    }

    if (vm.hpCurrent !== null && vm.hpMax !== null && vm.hpMax > 0) {
      this.hpBar.style.display = 'flex';
      const pct = Math.max(0, Math.min(100, (vm.hpCurrent / vm.hpMax) * 100));
      this.hpFill.style.width = `${pct}%`;
      this.hpText.textContent = `${vm.hpCurrent}/${vm.hpMax}`;
      this.hpFill.style.background = pct > 60 ? '#4ade80' : pct > 30 ? '#facc15' : '#ef4444';
    } else {
      this.hpBar.style.display = 'none';
    }
  }

  private css(): string {
    return `<style>
      #hud-selection-panel {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 10px 16px;
        height: 100%;
        min-width: 0;
      }
      #hsp-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 4px;
      }
      #hsp-empty-icon {
        font-size: 18px;
        color: rgba(212, 165, 116, 0.2);
        line-height: 1;
      }
      #hsp-empty-text {
        color: #505050;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        font-style: italic;
        letter-spacing: 0.3px;
      }
      #hsp-content {
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
      #hsp-header {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      #hsp-name {
        font-size: 16px;
        font-weight: 700;
        color: #e8e8e8;
        letter-spacing: 0.3px;
      }
      #hsp-kind {
        font-size: 11px;
        color: #808080;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 500;
      }
      #hsp-faction {
        font-size: 11px;
        color: #d4a574;
        margin-left: auto;
        font-weight: 600;
        text-transform: capitalize;
      }
      #hsp-count {
        display: none;
        font-size: 12px;
        font-weight: 700;
        color: #60d0d0;
        background: rgba(0, 255, 255, 0.1);
        padding: 1px 6px;
        border-radius: 3px;
      }
      #hsp-breakdown {
        display: none;
        font-size: 11px;
        color: #a0a0a0;
        font-weight: 400;
      }
      #hsp-hp-bar {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #hsp-hp-track {
        flex: 1;
        height: 8px;
        background: rgba(255,255,255,0.08);
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
      }
      #hsp-hp-fill {
        height: 100%;
        width: 100%;
        background: #4ade80;
        border-radius: 3px;
        transition: width 0.2s ease;
      }
      #hsp-hp-text {
        font-size: 11px;
        color: #b0b0b0;
        font-variant-numeric: tabular-nums;
        min-width: 50px;
        text-align: right;
        font-weight: 500;
      }
      #hsp-status {
        font-size: 12px;
        color: #909090;
        font-weight: 400;
      }
    </style>`;
  }

  private html(): string {
    return `
      <div id="hsp-empty">
        <span id="hsp-empty-icon">&#9673;</span>
        <span id="hsp-empty-text">No selection</span>
      </div>
      <div id="hsp-content">
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
    `;
  }
}
