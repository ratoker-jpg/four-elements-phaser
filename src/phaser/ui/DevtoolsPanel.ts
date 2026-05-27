/**
 * DevtoolsPanel — lightweight DOM overlay for QA / dev sandbox.
 *
 * ARCH-11A: Collapsible side panel with resource controls, spawn controls,
 * diagnostics readout, and overlay toggles. Only shown when devtools
 * is activated (?devtools=1 or F10 toggle).
 *
 * ARCH-11B: Overlay toggles for passability, building footprints,
 * and resource markers.
 *
 * ARCH-12A: Arena section with reset button (only when arena=1).
 *
 * Lifecycle:
 * - Created by GameScene in create() when devtools is enabled.
 * - Updated each frame via update(state).
 * - Destroyed in GameScene shutdown().
 * - Toggle visibility via F10 or backtick.
 */

import type { GameState } from '../../state/types';
import { ELEMENT_UNITS_PER_ELEMENT } from '../../state/types';
import {
  devAddRaw,
  devAddMatter,
  devAddFactionElement,
  devMaxResources,
  devZeroResources,
  devSpawnBuilder,
  devSpawnHarvester,
  devGetDiagnostics,
  type DevCommandResult,
} from '../../state/devCommands';

// ─── Types ──────────────────────────────────────────────────────────

/** Callbacks provided by GameScene for devtools actions. */
export interface DevtoolsCallbacks {
  /** Run a dev command that mutates game state. */
  onCommand: (command: (state: GameState) => DevCommandResult) => void;
  /** Toggle a debug overlay. Returns new visibility state. */
  onToggleOverlay: (overlay: 'passability' | 'footprint' | 'resource') => boolean;
  /** Reset arena state. */
  onResetArena?: () => void;
}

// ─── DevtoolsPanel class ────────────────────────────────────────────

export class DevtoolsPanel {
  private container: HTMLDivElement | null = null;
  private content: HTMLDivElement | null = null;
  private diagnosticsEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: DevtoolsCallbacks | null = null;
  private _visible = true;
  private _collapsed = false;

  /** Whether the devtools panel is currently shown. */
  get visible(): boolean {
    return this._visible;
  }

  /**
   * Create the devtools panel DOM overlay. Call once when GameScene starts.
   */
  create(callbacks: DevtoolsCallbacks, isArena?: boolean): void {
    this.destroy();
    this.callbacks = callbacks;

    const root = document.createElement('div');
    root.id = 'devtools-panel';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      top: 48px;
      left: 8px;
      width: 220px;
      background: rgba(20, 10, 30, 0.92);
      border: 1px solid rgba(180, 100, 255, 0.25);
      border-radius: 6px;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #d0b0ff;
      z-index: 25;
      pointer-events: auto;
      user-select: none;
      max-height: calc(100vh - 60px);
      overflow-y: auto;
    `;

    // ── Header with collapse toggle ────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      cursor: pointer;
      border-bottom: 1px solid rgba(180, 100, 255, 0.15);
      background: rgba(180, 100, 255, 0.08);
    `;
    header.addEventListener('click', () => this.toggleCollapse());

    const title = document.createElement('span');
    title.textContent = 'Devtools';
    title.style.cssText = 'font-weight: 700; font-size: 12px; color: #c090ff;';

    const collapseLabel = document.createElement('span');
    collapseLabel.textContent = '\u2500'; // horizontal bar (collapsed indicator)
    collapseLabel.style.cssText = 'font-size: 14px; color: #8060a0;';
    this._collapseLabel = collapseLabel;

    header.appendChild(title);
    header.appendChild(collapseLabel);
    root.appendChild(header);

    // ── Content container (collapsible) ────────────────────────
    const content = document.createElement('div');
    content.style.cssText = 'padding: 8px 10px;';

    // ── Resources section ──────────────────────────────────────
    const resTitle = document.createElement('div');
    resTitle.textContent = 'Resources';
    resTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #81c784;';
    content.appendChild(resTitle);

    const resBtnRow1 = document.createElement('div');
    resBtnRow1.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';
    resBtnRow1.appendChild(this.createDevButton('+Raw', '#81c784', () => this.execCommand(devAddRaw)));
    resBtnRow1.appendChild(this.createDevButton('+Matter', '#81c784', () => this.execCommand(devAddMatter)));
    content.appendChild(resBtnRow1);

    const resBtnRow2 = document.createElement('div');
    resBtnRow2.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';
    resBtnRow2.appendChild(this.createDevButton('+Element', '#81c784', () => this.execCommand(devAddFactionElement)));
    content.appendChild(resBtnRow2);

    const resBtnRow3 = document.createElement('div');
    resBtnRow3.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';
    resBtnRow3.appendChild(this.createDevButton('Max [DEV]', '#ffcc44', () => this.execCommand(devMaxResources)));
    resBtnRow3.appendChild(this.createDevButton('Zero', '#ef9a9a', () => this.execCommand(devZeroResources)));
    content.appendChild(resBtnRow3);

    // ── Spawn section ──────────────────────────────────────────
    const spawnTitle = document.createElement('div');
    spawnTitle.textContent = 'Spawn';
    spawnTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #4fc3f7;';
    content.appendChild(spawnTitle);

    const spawnRow = document.createElement('div');
    spawnRow.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';
    spawnRow.appendChild(this.createDevButton('Builder', '#4fc3f7', () => this.execCommand(devSpawnBuilder)));
    spawnRow.appendChild(this.createDevButton('Harvester', '#4fc3f7', () => this.execCommand(devSpawnHarvester)));
    content.appendChild(spawnRow);

    // ── Diagnostics section ────────────────────────────────────
    const diagTitle = document.createElement('div');
    diagTitle.textContent = 'Diagnostics';
    diagTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #b0b0b0;';
    content.appendChild(diagTitle);

    this.diagnosticsEl = document.createElement('div');
    this.diagnosticsEl.style.cssText = `
      font-size: 10px;
      line-height: 1.5;
      color: #999;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 6px;
    `;
    content.appendChild(this.diagnosticsEl);

    // ── Overlays section ──────────────────────────────────────
    const overlayTitle = document.createElement('div');
    overlayTitle.textContent = 'Overlays';
    overlayTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #ce93d8;';
    content.appendChild(overlayTitle);

    const overlayRow = document.createElement('div');
    overlayRow.style.cssText = 'display: flex; gap: 4px; margin-bottom: 2px; flex-wrap: wrap;';
    this._passabilityBtn = this.createToggleButton('Pass', '#ce93d8', () => this.toggleOverlay('passability'));
    this._footprintBtn = this.createToggleButton('Foot', '#ce93d8', () => this.toggleOverlay('footprint'));
    this._resourceBtn = this.createToggleButton('Res', '#ce93d8', () => this.toggleOverlay('resource'));
    overlayRow.appendChild(this._passabilityBtn);
    overlayRow.appendChild(this._footprintBtn);
    overlayRow.appendChild(this._resourceBtn);
    content.appendChild(overlayRow);

    // ── Arena section (only when arena mode is active) ────────
    this._isArena = isArena ?? false;
    if (this._isArena) {
      const arenaTitle = document.createElement('div');
      arenaTitle.textContent = 'Arena';
      arenaTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; margin-top: 4px; color: #ffab40;';
      content.appendChild(arenaTitle);

      const arenaRow = document.createElement('div');
      arenaRow.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';
      arenaRow.appendChild(this.createDevButton('Reset Arena', '#ffab40', () => {
        if (this.callbacks?.onResetArena) {
          this.callbacks.onResetArena();
        }
      }));
      content.appendChild(arenaRow);
    }

    // ── Status feedback ────────────────────────────────────────
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = `
      min-height: 14px;
      font-size: 10px;
      text-align: center;
      transition: opacity 0.3s;
      opacity: 0;
    `;
    content.appendChild(this.statusEl);

    root.appendChild(content);

    document.body.appendChild(root);
    this.container = root;
    this.content = content;
  }

  /**
   * Update diagnostics readout from the current game state.
   * Called each frame from GameScene.update().
   */
  update(state: GameState): void {
    if (!this.diagnosticsEl || this._collapsed) return;

    const d = devGetDiagnostics(state);
    const factionLabel = d.faction.charAt(0).toUpperCase() + d.faction.slice(1);
    const elDisplayed = (state.economy.elements[d.faction] / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
    const elCapDisplayed = (state.economy.elementCap / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);

    this.diagnosticsEl.innerHTML =
      `<div>Faction: <b>${factionLabel}</b></div>` +
      `<div>Map: ${d.mapName}</div>` +
      `<div>Raw: <b>${d.raw}</b>/${d.rawCap} | Matter: <b>${d.matter}</b>/${d.matterCap}</div>` +
      `<div>${factionLabel}: <b>${elDisplayed}</b>/${elCapDisplayed} | Power: ${d.powerConsumed}/${d.powerGenerated}</div>` +
      `<div>Resources: ${d.resourceNodeCount} | Harvesters: ${d.activeHarvesterCount} active</div>` +
      `<div>Builders: ${d.builderCount} | Sites: ${d.constructionSiteCount} | Seps: ${d.separatorCount}</div>` +
      `<div>Factory: ${d.factoryQueueSummary}</div>`;
  }

  /** Show the devtools panel. */
  show(): void {
    if (this.container) {
      this.container.style.display = 'block';
      this._visible = true;
    }
  }

  /** Hide the devtools panel. */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this._visible = false;
    }
  }

  /** Toggle panel visibility. */
  toggle(): void {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Toggle content collapse. */
  private toggleCollapse(): void {
    if (!this.content || !this._collapseLabel) return;
    this._collapsed = !this._collapsed;
    this.content.style.display = this._collapsed ? 'none' : 'block';
    this._collapseLabel.textContent = this._collapsed ? '+' : '\u2500';
  }

  /** Execute a dev command and show status feedback. */
  private execCommand(command: (state: GameState) => DevCommandResult): void {
    if (!this.callbacks) return;
    this.callbacks.onCommand(command);
  }

  /**
   * Show a brief status message from a dev command result.
   * Called by GameScene after executing a command.
   */
  showCommandResult(result: DevCommandResult): void {
    if (!this.statusEl) return;

    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }

    this.statusEl.textContent = result.message;
    this.statusEl.style.color = result.success ? '#81c784' : '#ef9a9a';
    this.statusEl.style.opacity = '1';

    this.statusTimer = setTimeout(() => {
      if (this.statusEl) {
        this.statusEl.style.opacity = '0';
      }
    }, 2000);
  }

  /** Remove the devtools panel DOM overlay. Call on GameScene shutdown. */
  destroy(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.content = null;
    this.diagnosticsEl = null;
    this.statusEl = null;
    this.callbacks = null;
    this._visible = true;
    this._collapsed = false;
    this._passabilityBtn = null;
    this._footprintBtn = null;
    this._resourceBtn = null;
    this._isArena = false;
  }

  // ─── Internal helpers ──────────────────────────────────────────

  /** Collapse label element reference. */
  private _collapseLabel: HTMLSpanElement | null = null;

  /** Overlay toggle button references. */
  private _passabilityBtn: HTMLButtonElement | null = null;
  private _footprintBtn: HTMLButtonElement | null = null;
  private _resourceBtn: HTMLButtonElement | null = null;

  /** Whether arena mode is active. */
  private _isArena = false;

  /** Toggle an overlay and update button visual state. */
  private toggleOverlay(overlay: 'passability' | 'footprint' | 'resource'): void {
    if (!this.callbacks) return;
    const visible = this.callbacks.onToggleOverlay(overlay);
    const btn = overlay === 'passability' ? this._passabilityBtn
      : overlay === 'footprint' ? this._footprintBtn
      : this._resourceBtn;
    if (btn) {
      btn.style.background = visible ? 'rgba(206, 147, 216, 0.3)' : 'rgba(255, 255, 255, 0.04)';
    }
  }

  /** Create a toggle-style button (flex: 1, same base style as dev buttons). */
  private createToggleButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = this.createDevButton(text, color, onClick);
    btn.style.flex = '1';
    return btn;
  }

  private createDevButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      padding: 3px 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid ${color}33;
      border-radius: 3px;
      color: ${color};
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = `${color}15`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.04)';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }
}
