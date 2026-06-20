/**
 * HUD Selection Panel — shows selected unit/building info.
 *
 * VISUAL-HUD-CORE-01: Read-only display of selection data.
 * Does not modify game state or selection logic.
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
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
  }

  update(state: GameState, selection: UnitSelection): void {
    const vm = buildSelectionViewModel(state, selection);
    this.applyViewModel(vm);
  }

  destroy(): void {
    this.container?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

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

    if (vm.hpCurrent !== null && vm.hpMax !== null && vm.hpMax > 0) {
      this.hpBar.style.display = 'flex';
      const pct = Math.max(0, Math.min(100, (vm.hpCurrent / vm.hpMax) * 100));
      this.hpFill.style.width = `${pct}%`;
      this.hpText.textContent = `${vm.hpCurrent}/${vm.hpMax}`;
      // Color: green > 60%, yellow > 30%, red <= 30%
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
        padding: 8px 12px;
        height: 100%;
        min-width: 0;
      }
      #hsp-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #606060;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 13px;
        font-style: italic;
      }
      #hsp-content {
        display: none;
        flex-direction: column;
        gap: 6px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      #hsp-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #hsp-name {
        font-size: 14px;
        font-weight: 700;
        color: #e0e0e0;
      }
      #hsp-kind {
        font-size: 11px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      #hsp-faction {
        font-size: 11px;
        color: #d4a574;
        margin-left: auto;
      }
      #hsp-hp-bar {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #hsp-hp-track {
        flex: 1;
        height: 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 3px;
        overflow: hidden;
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
        color: #a0a0a0;
        font-variant-numeric: tabular-nums;
        min-width: 50px;
        text-align: right;
      }
      #hsp-status {
        font-size: 12px;
        color: #909090;
      }
    </style>`;
  }

  private html(): string {
    return `
      <div id="hsp-empty">No unit selected</div>
      <div id="hsp-content">
        <div id="hsp-header">
          <span id="hsp-name">—</span>
          <span id="hsp-kind">—</span>
          <span id="hsp-faction">—</span>
        </div>
        <div id="hsp-hp-bar">
          <div id="hsp-hp-track"><div id="hsp-hp-fill"></div></div>
          <span id="hsp-hp-text">—</span>
        </div>
        <div id="hsp-status">—</div>
      </div>
    `;
  }
}
