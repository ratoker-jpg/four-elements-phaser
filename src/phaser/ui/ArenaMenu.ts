/**
 * ArenaMenu — DOM UI overlay for Arena Sandbox mode.
 *
 * ARENA-01H+: Primary Arena UX (replaces PlaytestHud for Arena mode).
 * DevTools panel is still available via F10/backtick for technical
 * debugging, but ArenaMenu is the main interface.
 *
 * ARENA-02H+: Extended with ArenaUnitComposer for manual unit creation
 * and click placement. Body/weapon/team selectors replace the
 * placeholder "Add Unit" button.
 *
 * Lifecycle:
 * - Created by GameScene in create() when arenaMode is active.
 * - Updated each frame via update().
 * - Destroyed in GameScene shutdown().
 */

import type { GameState } from '../../state/types';
import type { ArenaPlacementState } from '../../state/arenaPlacement';
import { ArenaUnitComposer } from './ArenaUnitComposer';

// ─── Types ──────────────────────────────────────────────────────────

/** Callbacks provided by GameScene for ArenaMenu actions. */
export interface ArenaMenuCallbacks {
  /** Reset arena to initial state (scene restart). */
  onResetArena: () => void;
  /** Clear all blockout vehicles from the arena. */
  onClearUnits: () => void;
  /** Toggle the help overlay. */
  onToggleHelp: () => void;
  /** ARENA-02H+: Enter placement mode with current body/weapon/team selection. */
  onPlaceUnit: () => void;
  /** ARENA-02H+: Cancel placement mode. */
  onCancelPlacement: () => void;
  /** ARENA-02H+: Get the current placement state. */
  getPlacementState: () => ArenaPlacementState;
}

// ─── ArenaMenu class ────────────────────────────────────────────────

export class ArenaMenu {
  private container: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: ArenaMenuCallbacks | null = null;
  private _visible = true;
  private _collapsed = false;
  private content: HTMLDivElement | null = null;
  private _collapseLabel: HTMLSpanElement | null = null;
  private vehicleCountEl: HTMLDivElement | null = null;

  // ARENA-02H+: Unit composer sub-component
  private unitComposer: ArenaUnitComposer | null = null;

  /** Whether the ArenaMenu is currently shown. */
  get visible(): boolean {
    return this._visible;
  }

  /**
   * Create the ArenaMenu DOM overlay. Call once when GameScene starts in Arena mode.
   */
  create(callbacks: ArenaMenuCallbacks): void {
    this.destroy();
    this.callbacks = callbacks;

    const root = document.createElement('div');
    root.id = 'arena-menu';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      top: 48px;
      right: 8px;
      width: 220px;
      background: rgba(20, 15, 10, 0.92);
      border: 1px solid rgba(255, 160, 60, 0.3);
      border-radius: 6px;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #ffcc80;
      z-index: 26;
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
      border-bottom: 1px solid rgba(255, 160, 60, 0.15);
      background: rgba(255, 160, 60, 0.08);
    `;
    header.addEventListener('click', () => this.toggleCollapse());

    const title = document.createElement('span');
    title.textContent = 'Arena';
    title.style.cssText = 'font-weight: 700; font-size: 13px; color: #ffab40;';

    const collapseLabel = document.createElement('span');
    collapseLabel.textContent = '\u2500';
    collapseLabel.style.cssText = 'font-size: 14px; color: #a07030;';
    this._collapseLabel = collapseLabel;

    header.appendChild(title);
    header.appendChild(collapseLabel);
    root.appendChild(header);

    // ── Content container (collapsible) ────────────────────────
    const content = document.createElement('div');
    content.style.cssText = 'padding: 8px 10px;';

    // ── Unit Composer section (ARENA-02H+) ──────────────────────
    const unitTitle = document.createElement('div');
    unitTitle.textContent = 'Units';
    unitTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #ffab40;';
    content.appendChild(unitTitle);

    // Create the unit composer and attach it to our content div
    this.unitComposer = new ArenaUnitComposer();
    this.unitComposer.create(content, {
      onPlaceUnit: () => {
        this.callbacks?.onPlaceUnit();
      },
      onCancelPlacement: () => {
        this.callbacks?.onCancelPlacement();
      },
    });

    // ── Actions section ──────────────────────────────────────
    const actionsTitle = document.createElement('div');
    actionsTitle.textContent = 'Actions';
    actionsTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; margin-top: 6px; color: #ffab40;';
    content.appendChild(actionsTitle);

    const actionRow1 = document.createElement('div');
    actionRow1.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';
    actionRow1.appendChild(this.createArenaButton('Reset Arena', '#ffab40', () => {
      this.callbacks?.onResetArena();
      this.showStatus('Arena reset', true);
    }));
    actionRow1.appendChild(this.createArenaButton('Clear Units', '#ffab40', () => {
      this.callbacks?.onClearUnits();
      this.showStatus('Units cleared', true);
    }));
    content.appendChild(actionRow1);

    const actionRow2 = document.createElement('div');
    actionRow2.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';
    actionRow2.appendChild(this.createArenaButton('Help [H]', '#ce93d8', () => {
      this.callbacks?.onToggleHelp();
    }));
    content.appendChild(actionRow2);

    // ── Vehicle count ────────────────────────────────────────
    this.vehicleCountEl = document.createElement('div');
    this.vehicleCountEl.style.cssText = `
      font-size: 10px;
      line-height: 1.5;
      color: #a08060;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 6px;
    `;
    this.vehicleCountEl.textContent = 'Vehicles: 0';
    content.appendChild(this.vehicleCountEl);

    // ── Status feedback ──────────────────────────────────────
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
   * Update ArenaMenu from the current game state.
   * Called each frame from GameScene.update().
   */
  update(state: GameState): void {
    if (!this.vehicleCountEl || this._collapsed) return;

    const vehicleCount = state.blockoutVehicles?.length ?? 0;
    const aliveCount = state.blockoutVehicles?.filter(v => !v.isDestroyed).length ?? 0;
    const allyCount = state.blockoutVehicles?.filter(v => v.team === 'ally' && !v.isDestroyed).length ?? 0;
    const enemyCount = state.blockoutVehicles?.filter(v => v.team === 'enemy' && !v.isDestroyed).length ?? 0;
    this.vehicleCountEl.textContent = `Vehicles: ${vehicleCount} (alive: ${aliveCount}, ally: ${allyCount}, enemy: ${enemyCount})`;

    // ARENA-02H+: Sync unit composer with placement state
    if (this.unitComposer) {
      const placementState = this.callbacks?.getPlacementState();
      if (placementState) {
        this.unitComposer.syncFromPlacementState(placementState);
      }
    }
  }

  /**
   * ARENA-02H+: Get the unit composer for reading selections.
   */
  getUnitComposer(): ArenaUnitComposer | null {
    return this.unitComposer;
  }

  /**
   * ARENA-02H+: Show placement feedback from GameScene.
   */
  showPlacementFeedback(message: string, success: boolean): void {
    this.unitComposer?.showFeedback(message, success);
  }

  /** Show the ArenaMenu. */
  show(): void {
    if (this.container) {
      this.container.style.display = 'block';
      this._visible = true;
    }
  }

  /** Hide the ArenaMenu. */
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

  /** Show a brief status message. */
  showStatus(message: string, success: boolean): void {
    if (!this.statusEl) return;

    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }

    this.statusEl.textContent = message;
    this.statusEl.style.color = success ? '#81c784' : '#ef9a9a';
    this.statusEl.style.opacity = '1';

    this.statusTimer = setTimeout(() => {
      if (this.statusEl) {
        this.statusEl.style.opacity = '0';
      }
    }, 2000);
  }

  /** Remove the ArenaMenu DOM overlay. Call on GameScene shutdown. */
  destroy(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.unitComposer?.destroy();
    this.unitComposer = null;
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.content = null;
    this.statusEl = null;
    this.vehicleCountEl = null;
    this.callbacks = null;
    this._visible = true;
    this._collapsed = false;
    this._collapseLabel = null;
  }

  // ─── Internal helpers ──────────────────────────────────────────

  private createArenaButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      padding: 4px 6px;
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
