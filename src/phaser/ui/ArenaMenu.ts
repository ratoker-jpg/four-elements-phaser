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
 * ARENA-04H+: Extended with ArenaRoster for unit list, roster actions
 * (select, delete, clear allies/enemies/all, reset), help overlay,
 * and status messages.
 *
 * Lifecycle:
 * - Created by GameScene in create() when arenaMode is active.
 * - Updated each frame via update().
 * - Destroyed in GameScene shutdown().
 */

import type { GameState } from '../../state/types';
import type { ArenaPlacementState } from '../../state/arenaPlacement';
import { ArenaUnitComposer } from './ArenaUnitComposer';
import {
  deriveRosterRows,
  deleteVehicle,
  clearAllVehicles,
  clearAllyVehicles,
  clearEnemyVehicles,
  deriveArenaStatus,
  decideRosterClick,
  ARENA_HELP_LINES,
  type ArenaRosterRow,
} from '../../state/arenaRoster';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { t } from '../../config/localization';
import { BODY_PROFILES } from '../../config/blockoutBodyData';
import { WEAPON_PROFILES } from '../../config/blockoutWeaponData';

// ─── Industrial Arena Theme ─────────────────────────────────────────

const ARENA_THEME = {
  bg: 'rgba(17, 24, 39, 0.92)',
  border: 'rgba(212, 165, 116, 0.15)',
  titleColor: '#d4a574',        // bronze primary accent
  bodyColor: '#c0c0c0',
  sectionTitleColor: '#d4a574',  // bronze
  mutedColor: '#64748b',
  dimColor: '#4b5563',
  primaryAccent: '#d4a574',      // warm bronze/gold
  secondaryAccent: '#80cbc4',    // teal
  dangerColor: '#ef9a9a',
  dangerBg: 'rgba(239, 154, 154, 0.08)',
  dangerBorder: 'rgba(239, 154, 154, 0.2)',
  headerBg: 'rgba(212, 165, 116, 0.08)',
  headerBorder: 'rgba(212, 165, 116, 0.15)',
  allyColor: '#64c8ff',          // Keep faction ally color
  enemyColor: '#ff5050',         // Keep faction enemy color
  rowBg: 'rgba(255, 255, 255, 0.02)',
  rowBorder: 'rgba(255, 255, 255, 0.05)',
  dividerColor: 'rgba(212, 165, 116, 0.12)',
  focusOutline: '#d4a574',
} as const;

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
  /** ARENA-04H+: Get current selected vehicle ID from input controller. */
  getSelectedVehicleId: () => string | null;
  /** ARENA-04H+: Get current target vehicle ID from the selected ally. */
  getTargetVehicleId: () => string | null;
  /** ARENA-04H+: Select a vehicle by ID (from roster click). */
  onSelectVehicle: (vehicleId: string) => void;
  /** ARENA-04H+: Assign a target by vehicle ID (from roster enemy click). */
  onAssignTarget: (targetVehicleId: string) => void;
  /** ARENA-04H+: Deselect current vehicle. */
  onDeselectVehicle: () => void;
  /** ARENA-04H+: Clear target on selected vehicle. */
  onClearTarget: () => void;
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

  // ARENA-04H+: Roster section
  private rosterRowsContainer: HTMLDivElement | null = null;
  private helpOverlay: HTMLDivElement | null = null;
  private arenaStatusEl: HTMLDivElement | null = null;
  private _helpVisible = false;

  /** Cached roster rows from last update (for click handling). */
  private _lastRosterRows: ArenaRosterRow[] = [];

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
      background: ${ARENA_THEME.bg};
      border: 1px solid ${ARENA_THEME.border};
      border-radius: 6px;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: ${ARENA_THEME.bodyColor};
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
      border-bottom: 1px solid ${ARENA_THEME.headerBorder};
      background: ${ARENA_THEME.headerBg};
    `;
    header.addEventListener('click', () => this.toggleCollapse());

    const title = document.createElement('span');
    title.textContent = t('arena_title');
    title.style.cssText = `font-weight: 700; font-size: 13px; color: ${ARENA_THEME.titleColor};`;

    const collapseLabel = document.createElement('span');
    collapseLabel.textContent = '\u2500';
    collapseLabel.style.cssText = `font-size: 14px; color: ${ARENA_THEME.mutedColor};`;
    this._collapseLabel = collapseLabel;

    header.appendChild(title);
    header.appendChild(collapseLabel);
    root.appendChild(header);

    // ── Content container (collapsible) ────────────────────────
    const content = document.createElement('div');
    content.style.cssText = 'padding: 8px 10px;';

    // ── Unit Composer section (ARENA-02H+) ──────────────────────
    const unitTitle = document.createElement('div');
    unitTitle.textContent = t('arena_units');
    unitTitle.style.cssText = `font-weight: 600; font-size: 11px; margin-bottom: 4px; color: ${ARENA_THEME.sectionTitleColor};`;
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

    // ── ARENA-04H+: Roster section ─────────────────────────────
    const rosterTitle = document.createElement('div');
    rosterTitle.textContent = t('arena_roster');
    rosterTitle.style.cssText = `font-weight: 600; font-size: 11px; margin-bottom: 4px; margin-top: 6px; color: ${ARENA_THEME.sectionTitleColor};`;
    content.appendChild(rosterTitle);

    this.rosterRowsContainer = document.createElement('div');
    this.rosterRowsContainer.style.cssText = `
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 6px;
    `;
    content.appendChild(this.rosterRowsContainer);

    // ── ARENA-04H+: Roster actions ─────────────────────────────
    const actionsTitle = document.createElement('div');
    actionsTitle.textContent = t('arena_actions');
    actionsTitle.style.cssText = `font-weight: 600; font-size: 11px; margin-bottom: 4px; margin-top: 6px; color: ${ARENA_THEME.sectionTitleColor};`;
    content.appendChild(actionsTitle);

    const actionRow1 = document.createElement('div');
    actionRow1.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';
    actionRow1.appendChild(this.createArenaButton(t('arena_reset'), ARENA_THEME.primaryAccent, () => {
      this.callbacks?.onResetArena();
      this.showStatus(t('arena_arenaReset'), true);
    }));
    actionRow1.appendChild(this.createArenaButton(t('arena_deleteSel'), ARENA_THEME.dangerColor, () => {
      this.deleteSelectedUnit();
    }));
    content.appendChild(actionRow1);

    const actionRow2 = document.createElement('div');
    actionRow2.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';
    actionRow2.appendChild(this.createArenaButton(t('arena_clearAll'), ARENA_THEME.primaryAccent, () => {
      this.clearAllFromMenu();
    }));
    actionRow2.appendChild(this.createArenaButton(t('arena_clearAllies'), ARENA_THEME.allyColor, () => {
      this.clearAlliesFromMenu();
    }));
    content.appendChild(actionRow2);

    const actionRow3 = document.createElement('div');
    actionRow3.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';
    actionRow3.appendChild(this.createArenaButton(t('arena_clearEnemies'), ARENA_THEME.enemyColor, () => {
      this.clearEnemiesFromMenu();
    }));
    actionRow3.appendChild(this.createArenaButton(t('arena_help'), ARENA_THEME.secondaryAccent, () => {
      this.toggleHelp();
    }));
    content.appendChild(actionRow3);

    // ── Vehicle count ────────────────────────────────────────
    this.vehicleCountEl = document.createElement('div');
    this.vehicleCountEl.style.cssText = `
      font-size: 10px;
      line-height: 1.5;
      color: ${ARENA_THEME.mutedColor};
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 6px;
    `;
    this.vehicleCountEl.textContent = `${t('arena_vehicles')}: 0`;
    content.appendChild(this.vehicleCountEl);

    // ── ARENA-04H+: Arena status ──────────────────────────────
    this.arenaStatusEl = document.createElement('div');
    this.arenaStatusEl.style.cssText = `
      font-size: 10px;
      line-height: 1.4;
      color: ${ARENA_THEME.mutedColor};
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 6px;
      min-height: 14px;
    `;
    this.arenaStatusEl.textContent = t('arena_empty');
    content.appendChild(this.arenaStatusEl);

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

    // ── ARENA-04H+: Help overlay (initially hidden) ──────────
    this.createHelpOverlay();
  }

  /**
   * Update ArenaMenu from the current game state.
   * Called each frame from GameScene.update().
   */
  update(state: GameState): void {
    // ARENA-04H+: Store state for action handlers (delete, clear, etc.)
    this._gameState = state;

    if (!this.vehicleCountEl || this._collapsed) return;

    const vehicles = state.blockoutVehicles ?? [];
    const vehicleCount = vehicles.length;
    const aliveCount = vehicles.filter(v => !v.isDestroyed).length;
    const allyCount = vehicles.filter(v => v.team === 'ally' && !v.isDestroyed).length;
    const enemyCount = vehicles.filter(v => v.team === 'enemy' && !v.isDestroyed).length;
    this.vehicleCountEl.textContent = `${t('arena_vehicles')}: ${vehicleCount} (${t('arena_alive')}: ${aliveCount}, ${t('arena_ally')}: ${allyCount}, ${t('arena_enemy')}: ${enemyCount})`;

    // ARENA-02H+: Sync unit composer with placement state
    if (this.unitComposer) {
      const placementState = this.callbacks?.getPlacementState();
      if (placementState) {
        this.unitComposer.syncFromPlacementState(placementState);
      }
    }

    // ARENA-04H+: Update roster
    const selectedId = this.callbacks?.getSelectedVehicleId() ?? null;
    const targetId = this.callbacks?.getTargetVehicleId() ?? null;
    const rows = deriveRosterRows(vehicles, selectedId, targetId);
    this._lastRosterRows = rows;
    this.updateRosterDOM(rows);

    // ARENA-04H+: Update arena status
    const placementState = this.callbacks?.getPlacementState();
    const placementMode = placementState?.mode ?? 'idle';
    if (this.arenaStatusEl) {
      this.arenaStatusEl.textContent = deriveArenaStatus(vehicles, selectedId, targetId, placementMode);
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
    this.statusEl.style.color = success ? ARENA_THEME.secondaryAccent : ARENA_THEME.dangerColor;
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
    if (this.helpOverlay && this.helpOverlay.parentNode) {
      this.helpOverlay.parentNode.removeChild(this.helpOverlay);
    }
    this.helpOverlay = null;
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.content = null;
    this.statusEl = null;
    this.vehicleCountEl = null;
    this.rosterRowsContainer = null;
    this.arenaStatusEl = null;
    this.callbacks = null;
    this._visible = true;
    this._collapsed = false;
    this._collapseLabel = null;
    this._lastRosterRows = [];
    this._helpVisible = false;
  }

  // ─── ARENA-04H+: Roster DOM ──────────────────────────────────

  private updateRosterDOM(rows: ArenaRosterRow[]): void {
    if (!this.rosterRowsContainer) return;

    // Rebuild roster rows (simple approach — safe for blockout UI count)
    this.rosterRowsContainer.innerHTML = '';

    if (rows.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.textContent = t('arena_noUnits');
      emptyEl.style.cssText = `font-size: 9px; color: ${ARENA_THEME.dimColor}; padding: 4px 0; text-align: center;`;
      this.rosterRowsContainer.appendChild(emptyEl);
      return;
    }

    for (const row of rows) {
      const rowEl = document.createElement('div');
      rowEl.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 4px;
        margin-bottom: 1px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 9px;
        line-height: 1.3;
        ${row.isSelected ? 'background: rgba(100, 200, 255, 0.12); border: 1px solid rgba(100, 200, 255, 0.3);' : ''}
        ${row.isTargeted && !row.isSelected ? 'background: rgba(255, 80, 80, 0.08); border: 1px solid rgba(255, 80, 80, 0.2);' : ''}
        ${!row.isSelected && !row.isTargeted ? 'border: 1px solid transparent;' : ''}
        ${row.isDestroyed ? 'opacity: 0.5;' : ''}
      `;

      // Team indicator
      const teamDot = document.createElement('span');
      teamDot.style.cssText = `
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
        background: ${row.team === 'ally' ? ARENA_THEME.allyColor : ARENA_THEME.enemyColor};
      `;
      rowEl.appendChild(teamDot);

      // Body + Weapon
      const nameEl = document.createElement('span');
      const bodyLabel = BODY_PROFILES[row.bodyId]?.displayName ?? row.bodyId;
      const weaponLabel = WEAPON_PROFILES[row.weaponId]?.displayName ?? row.weaponId;
      nameEl.textContent = `${bodyLabel}+${weaponLabel}`;
      nameEl.style.cssText = `flex: 1; color: ${row.team === 'ally' ? '#90caf9' : '#ef9a9a'};`;
      rowEl.appendChild(nameEl);

      // HP
      const hpEl = document.createElement('span');
      if (row.isDestroyed) {
        hpEl.textContent = 'X';
        hpEl.style.cssText = `color: ${ARENA_THEME.dangerColor}; font-weight: 600;`;
      } else {
        hpEl.textContent = `${Math.round(row.hp)}`;
        const hpPct = row.hp / row.maxHp;
        hpEl.style.cssText = `color: ${hpPct > 0.6 ? ARENA_THEME.secondaryAccent : hpPct > 0.3 ? ARENA_THEME.primaryAccent : ARENA_THEME.dangerColor};`;
      }
      rowEl.appendChild(hpEl);

      // Selected marker
      if (row.isSelected) {
        const selMarker = document.createElement('span');
        selMarker.textContent = '\u25B6'; // ▶
        selMarker.style.cssText = `color: ${ARENA_THEME.allyColor}; font-size: 8px;`;
        rowEl.appendChild(selMarker);
      }

      // Targeted marker
      if (row.isTargeted && !row.isSelected) {
        const tgtMarker = document.createElement('span');
        tgtMarker.textContent = '\u2316'; // ⌖
        tgtMarker.style.cssText = `color: ${ARENA_THEME.enemyColor}; font-size: 9px;`;
        rowEl.appendChild(tgtMarker);
      }

      // Delete button per row
      const delBtn = document.createElement('span');
      delBtn.textContent = '\u00D7'; // ×
      delBtn.style.cssText = `
        color: ${ARENA_THEME.mutedColor};
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
        padding: 0 2px;
        opacity: 0.6;
      `;
      delBtn.addEventListener('mouseenter', () => { delBtn.style.opacity = '1'; delBtn.style.color = ARENA_THEME.dangerColor; });
      delBtn.addEventListener('mouseleave', () => { delBtn.style.opacity = '0.6'; delBtn.style.color = ARENA_THEME.mutedColor; });
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteRowUnit(row.id);
      });
      rowEl.appendChild(delBtn);

      // Click handler for roster row selection
      rowEl.addEventListener('click', () => {
        this.handleRosterRowClick(row);
      });

      this.rosterRowsContainer.appendChild(rowEl);
    }
  }

  /**
   * Handle roster row click — select ally or target enemy.
   * ARENA-04H+: Delegates to pure decideRosterClick for the decision.
   */
  private handleRosterRowClick(row: ArenaRosterRow): void {
    if (!this.callbacks) return;

    const selectedId = this.callbacks.getSelectedVehicleId();
    const vehicles = this.getVehicles();
    const action = decideRosterClick(row, selectedId, vehicles);

    switch (action.type) {
      case 'select':
        this.callbacks.onSelectVehicle(action.vehicleId);
        break;
      case 'assignTarget':
        this.callbacks.onAssignTarget(action.targetVehicleId);
        break;
      case 'noop':
        break;
    }
  }

  /** Get current vehicles from cached game state. */
  private getVehicles(): BlockoutVehicleState[] | undefined {
    return this._gameState?.blockoutVehicles;
  }

  /** Delete a unit from a roster row's × button. */
  private deleteRowUnit(vehicleId: string): void {
    if (!this.callbacks) return;
    // Find the vehicle in roster rows to get team info
    const row = this._lastRosterRows.find(r => r.id === vehicleId);
    if (!row) return;

    // If deleting the currently selected vehicle, deselect first
    const selectedId = this.callbacks.getSelectedVehicleId();
    if (vehicleId === selectedId) {
      this.callbacks.onDeselectVehicle();
    }

    // Perform the delete — state mutation happens in arenaRoster helper,
    // but we need to call it with the actual state. Instead, we delegate
    // to GameScene through a new callback.
    // For now, we'll use the same approach as onClearUnits — GameScene handles it.
    this.deleteUnitById(vehicleId);
  }

  /** Delete the currently selected unit. */
  private deleteSelectedUnit(): void {
    if (!this.callbacks) return;
    const selectedId = this.callbacks.getSelectedVehicleId();
    if (!selectedId) {
      this.showStatus(t('arena_noUnitSelected'), false);
      return;
    }
    this.callbacks.onDeselectVehicle();
    this.deleteUnitById(selectedId);
  }

  /** Delete a unit by ID — mutates state via arenaRoster helper. */
  private deleteUnitById(vehicleId: string): void {
    if (this._gameState) {
      const vehicles = this._gameState.blockoutVehicles;
      if (vehicles) {
        const selectedId = this.callbacks?.getSelectedVehicleId() ?? null;
        const result = deleteVehicle(vehicles, vehicleId, selectedId);
        this.showStatus(result.message, result.removedCount > 0);
        if (result.selectedCleared) {
          this.callbacks?.onDeselectVehicle();
        }
      }
    }
  }

  /** Store game state from last update for action handlers. */
  private _gameState: GameState | null = null;

  /** Clear all units from menu button. */
  private clearAllFromMenu(): void {
    if (!this._gameState?.blockoutVehicles) return;
    const selectedId = this.callbacks?.getSelectedVehicleId() ?? null;
    const result = clearAllVehicles(this._gameState.blockoutVehicles, selectedId);
    if (result.selectedCleared) {
      this.callbacks?.onDeselectVehicle();
    }
    this.showStatus(result.message, true);
  }

  /** Clear ally units from menu button. */
  private clearAlliesFromMenu(): void {
    if (!this._gameState?.blockoutVehicles) return;
    const selectedId = this.callbacks?.getSelectedVehicleId() ?? null;
    const result = clearAllyVehicles(this._gameState.blockoutVehicles, selectedId);
    if (result.selectedCleared) {
      this.callbacks?.onDeselectVehicle();
    }
    this.showStatus(result.message, true);
  }

  /** Clear enemy units from menu button. */
  private clearEnemiesFromMenu(): void {
    if (!this._gameState?.blockoutVehicles) return;
    const selectedId = this.callbacks?.getSelectedVehicleId() ?? null;
    const result = clearEnemyVehicles(this._gameState.blockoutVehicles, selectedId);
    if (result.targetCleared) {
      this.callbacks?.onClearTarget();
    }
    this.showStatus(result.message, true);
  }

  // ─── ARENA-04H+: Help overlay ───────────────────────────────

  private createHelpOverlay(): void {
    if (this.helpOverlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'arena-help-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${ARENA_THEME.bg};
      border: 1px solid ${ARENA_THEME.border};
      border-radius: 8px;
      padding: 16px 20px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      color: ${ARENA_THEME.bodyColor};
      z-index: 30;
      pointer-events: auto;
      max-width: 380px;
      max-height: 80vh;
      overflow-y: auto;
      display: none;
      line-height: 1.6;
    `;

    // Build help content
    for (const line of ARENA_HELP_LINES) {
      const lineEl = document.createElement('div');
      if (line.startsWith('───')) {
        lineEl.textContent = line;
        lineEl.style.cssText = `font-weight: 600; color: ${ARENA_THEME.sectionTitleColor}; margin-top: 8px; margin-bottom: 4px;`;
      } else if (line === '') {
        lineEl.innerHTML = '&nbsp;';
        lineEl.style.cssText = 'height: 4px;';
      } else {
        lineEl.textContent = line;
        lineEl.style.cssText = 'padding-left: 8px;';
      }
      overlay.appendChild(lineEl);
    }

    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.textContent = t('arena_helpClose');
    closeBtn.style.cssText = `
      text-align: center;
      margin-top: 12px;
      padding: 6px;
      background: ${ARENA_THEME.headerBg};
      border: 1px solid ${ARENA_THEME.headerBorder};
      border-radius: 4px;
      cursor: pointer;
      color: ${ARENA_THEME.primaryAccent};
      font-weight: 600;
    `;
    closeBtn.addEventListener('click', () => this.toggleHelp());
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);
    this.helpOverlay = overlay;
  }

  /** Toggle help overlay. */
  toggleHelp(): void {
    this._helpVisible = !this._helpVisible;
    if (this.helpOverlay) {
      this.helpOverlay.style.display = this._helpVisible ? 'block' : 'none';
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────

  private createArenaButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      padding: 4px 6px;
      background: ${ARENA_THEME.rowBg};
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
      btn.style.background = ARENA_THEME.rowBg;
    });
    btn.addEventListener('click', onClick);
    return btn;
  }
}
