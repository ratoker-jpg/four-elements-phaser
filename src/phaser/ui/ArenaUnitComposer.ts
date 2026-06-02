/**
 * ArenaUnitComposer — DOM UI component for selecting body/weapon/team
 * and initiating unit placement in Arena mode.
 *
 * ARENA-02H+: The primary flow is:
 *   user chooses body → user chooses weapon → user chooses team →
 *   clicks Place Unit → clicks Arena ground
 *
 * The code does NOT auto-combine body+weapon as the main creation flow.
 * Body/weapon/team lists are sourced from config files (not hardcoded).
 *
 * This is a DOM UI component — no Phaser rendering logic.
 */

import { BODY_PROFILES, ALL_BODY_IDS } from '../../config/blockoutBodyData';
import { WEAPON_PROFILES, ALL_WEAPON_IDS } from '../../config/blockoutWeaponData';
import type { BodyId, WeaponId } from '../../config/blockoutProfiles';
import type { ArenaTeam } from '../../state/blockoutVehicleState';
import type { ArenaPlacementState } from '../../state/arenaPlacement';

// ─── Types ──────────────────────────────────────────────────────────

/** Callbacks provided by ArenaMenu for UnitComposer actions. */
export interface ArenaUnitComposerCallbacks {
  /** Called when the user clicks Place Unit. */
  onPlaceUnit: () => void;
  /** Called when the user clicks Cancel Placement. */
  onCancelPlacement: () => void;
}

// ─── ArenaUnitComposer class ────────────────────────────────────────

export class ArenaUnitComposer {
  private container: HTMLDivElement | null = null;
  private callbacks: ArenaUnitComposerCallbacks | null = null;

  // Selector state
  private selectedBody: BodyId | null = null;
  private selectedWeapon: WeaponId | null = null;
  private selectedTeam: ArenaTeam = 'ally';

  // DOM references for state feedback
  private bodyButtons: Map<string, HTMLButtonElement> = new Map();
  private weaponButtons: Map<string, HTMLButtonElement> = new Map();
  private allyBtn: HTMLButtonElement | null = null;
  private enemyBtn: HTMLButtonElement | null = null;
  private placeBtn: HTMLButtonElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private statusEl: HTMLDivElement | null = null;

  /** Get current selections. */
  getSelections(): { body: BodyId | null; weapon: WeaponId | null; team: ArenaTeam } {
    return { body: this.selectedBody, weapon: this.selectedWeapon, team: this.selectedTeam };
  }

  /**
   * Create the UnitComposer DOM and attach to the given parent element.
   */
  create(parent: HTMLDivElement, callbacks: ArenaUnitComposerCallbacks): void {
    this.destroy();
    this.callbacks = callbacks;

    const root = document.createElement('div');
    root.style.cssText = 'margin-top: 6px;';

    // ── Body selector ──────────────────────────────────────────
    const bodyTitle = document.createElement('div');
    bodyTitle.textContent = 'Body';
    bodyTitle.style.cssText = 'font-weight: 600; font-size: 10px; margin-bottom: 2px; color: #ffab40;';
    root.appendChild(bodyTitle);

    const bodyGrid = document.createElement('div');
    bodyGrid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px; margin-bottom: 6px;';
    for (const bodyIdStr of ALL_BODY_IDS) {
      const bodyId = bodyIdStr as BodyId;
      const profile = BODY_PROFILES[bodyId];
      if (!profile) continue;
      const btn = document.createElement('button');
      btn.textContent = profile.displayName;
      btn.title = profile.roleLabel;
      btn.style.cssText = `
        padding: 2px 5px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 160, 60, 0.2);
        border-radius: 2px;
        color: #cc8833;
        font-size: 9px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.1s, border-color 0.1s;
      `;
      btn.addEventListener('mouseenter', () => {
        if (this.selectedBody !== bodyId) btn.style.background = 'rgba(255, 160, 60, 0.08)';
      });
      btn.addEventListener('mouseleave', () => {
        if (this.selectedBody !== bodyId) btn.style.background = 'rgba(255, 255, 255, 0.04)';
      });
      btn.addEventListener('click', () => this.selectBody(bodyId));
      this.bodyButtons.set(bodyId, btn);
      bodyGrid.appendChild(btn);
    }
    root.appendChild(bodyGrid);

    // ── Weapon selector ────────────────────────────────────────
    const weaponTitle = document.createElement('div');
    weaponTitle.textContent = 'Weapon';
    weaponTitle.style.cssText = 'font-weight: 600; font-size: 10px; margin-bottom: 2px; color: #ffab40;';
    root.appendChild(weaponTitle);

    const weaponGrid = document.createElement('div');
    weaponGrid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px; margin-bottom: 6px;';
    for (const weaponIdStr of ALL_WEAPON_IDS) {
      const weaponId = weaponIdStr as WeaponId;
      const profile = WEAPON_PROFILES[weaponId];
      if (!profile) continue;
      const btn = document.createElement('button');
      btn.textContent = profile.displayName;
      btn.style.cssText = `
        padding: 2px 5px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 160, 60, 0.2);
        border-radius: 2px;
        color: #cc8833;
        font-size: 9px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.1s, border-color 0.1s;
      `;
      btn.addEventListener('mouseenter', () => {
        if (this.selectedWeapon !== weaponId) btn.style.background = 'rgba(255, 160, 60, 0.08)';
      });
      btn.addEventListener('mouseleave', () => {
        if (this.selectedWeapon !== weaponId) btn.style.background = 'rgba(255, 255, 255, 0.04)';
      });
      btn.addEventListener('click', () => this.selectWeapon(weaponId));
      this.weaponButtons.set(weaponId, btn);
      weaponGrid.appendChild(btn);
    }
    root.appendChild(weaponGrid);

    // ── Team selector ──────────────────────────────────────────
    const teamTitle = document.createElement('div');
    teamTitle.textContent = 'Team';
    teamTitle.style.cssText = 'font-weight: 600; font-size: 10px; margin-bottom: 2px; color: #ffab40;';
    root.appendChild(teamTitle);

    const teamRow = document.createElement('div');
    teamRow.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';

    const allyBtn = document.createElement('button');
    allyBtn.textContent = 'Ally';
    allyBtn.style.cssText = `
      flex: 1;
      padding: 3px 6px;
      background: rgba(100, 200, 255, 0.12);
      border: 1px solid rgba(100, 200, 255, 0.4);
      border-radius: 3px;
      color: #64c8ff;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      font-weight: 600;
    `;
    allyBtn.addEventListener('click', () => this.selectTeam('ally'));
    this.allyBtn = allyBtn;
    teamRow.appendChild(allyBtn);

    const enemyBtn = document.createElement('button');
    enemyBtn.textContent = 'Enemy';
    enemyBtn.style.cssText = `
      flex: 1;
      padding: 3px 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 80, 80, 0.2);
      border-radius: 3px;
      color: #ff5050;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
    `;
    enemyBtn.addEventListener('click', () => this.selectTeam('enemy'));
    this.enemyBtn = enemyBtn;
    teamRow.appendChild(enemyBtn);

    root.appendChild(teamRow);

    // ── Action buttons ─────────────────────────────────────────
    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';

    const placeBtn = document.createElement('button');
    placeBtn.textContent = 'Place Unit';
    placeBtn.style.cssText = `
      flex: 1;
      padding: 4px 6px;
      background: rgba(100, 200, 255, 0.08);
      border: 1px solid rgba(100, 200, 255, 0.3);
      border-radius: 3px;
      color: #64c8ff;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      opacity: 0.4;
      transition: opacity 0.15s;
    `;
    placeBtn.addEventListener('click', () => {
      if (this.canPlace()) {
        this.callbacks?.onPlaceUnit();
      }
    });
    this.placeBtn = placeBtn;
    actionRow.appendChild(placeBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 4px 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 160, 60, 0.2);
      border-radius: 3px;
      color: #cc8833;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      display: none;
    `;
    cancelBtn.addEventListener('click', () => {
      this.callbacks?.onCancelPlacement();
    });
    this.cancelBtn = cancelBtn;
    actionRow.appendChild(cancelBtn);

    root.appendChild(actionRow);

    // ── Status ─────────────────────────────────────────────────
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `
      min-height: 12px;
      font-size: 9px;
      text-align: center;
      color: #a08060;
    `;
    this.statusEl = statusEl;
    root.appendChild(statusEl);

    parent.appendChild(root);
    this.container = root;

    // Initialize team selection highlight
    this.updateTeamHighlight();
  }

  /**
   * Update composer to reflect placement state changes.
   * Called when ArenaMenu updates from GameScene.
   */
  syncFromPlacementState(placementState: ArenaPlacementState): void {
    if (placementState.mode === 'placing') {
      // Show cancel button, hide place button, show placing status
      if (this.placeBtn) {
        this.placeBtn.style.display = 'none';
      }
      if (this.cancelBtn) {
        this.cancelBtn.style.display = 'block';
      }
      if (this.statusEl) {
        const bodyName = BODY_PROFILES[placementState.selectedBody ?? '']?.displayName ?? '?';
        const weaponName = WEAPON_PROFILES[placementState.selectedWeapon ?? '']?.displayName ?? '?';
        const teamLabel = placementState.selectedTeam === 'ally' ? 'Ally' : 'Enemy';
        this.statusEl.textContent = `Placing: ${bodyName} + ${weaponName} (${teamLabel}) — click ground | Esc/RMB cancel`;
        this.statusEl.style.color = '#64c8ff';
      }
    } else {
      // Show place button, hide cancel button
      if (this.placeBtn) {
        this.placeBtn.style.display = 'block';
        this.placeBtn.style.opacity = this.canPlace() ? '1' : '0.4';
      }
      if (this.cancelBtn) {
        this.cancelBtn.style.display = 'none';
      }
      if (this.statusEl) {
        this.statusEl.textContent = '';
        this.statusEl.style.color = '#a08060';
      }
    }
  }

  /** Show a validation feedback message. */
  showFeedback(message: string, success: boolean): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.style.color = success ? '#81c784' : '#ef9a9a';
    setTimeout(() => {
      if (this.statusEl && this.statusEl.textContent === message) {
        this.statusEl.textContent = '';
        this.statusEl.style.color = '#a08060';
      }
    }, 2500);
  }

  /** Remove the UnitComposer DOM. */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.callbacks = null;
    this.bodyButtons.clear();
    this.weaponButtons.clear();
    this.allyBtn = null;
    this.enemyBtn = null;
    this.placeBtn = null;
    this.cancelBtn = null;
    this.statusEl = null;
    this.selectedBody = null;
    this.selectedWeapon = null;
    this.selectedTeam = 'ally';
  }

  // ─── Internal ────────────────────────────────────────────────

  private canPlace(): boolean {
    return this.selectedBody !== null && this.selectedWeapon !== null;
  }

  private selectBody(bodyId: BodyId): void {
    // Deselect previous
    if (this.selectedBody) {
      const prevBtn = this.bodyButtons.get(this.selectedBody);
      if (prevBtn) {
        prevBtn.style.background = 'rgba(255, 255, 255, 0.04)';
        prevBtn.style.borderColor = 'rgba(255, 160, 60, 0.2)';
        prevBtn.style.fontWeight = 'normal';
      }
    }
    // Select new
    this.selectedBody = bodyId;
    const btn = this.bodyButtons.get(bodyId);
    if (btn) {
      btn.style.background = 'rgba(100, 200, 255, 0.15)';
      btn.style.borderColor = 'rgba(100, 200, 255, 0.5)';
      btn.style.fontWeight = '600';
    }
    this.updatePlaceButton();
  }

  private selectWeapon(weaponId: WeaponId): void {
    // Deselect previous
    if (this.selectedWeapon) {
      const prevBtn = this.weaponButtons.get(this.selectedWeapon);
      if (prevBtn) {
        prevBtn.style.background = 'rgba(255, 255, 255, 0.04)';
        prevBtn.style.borderColor = 'rgba(255, 160, 60, 0.2)';
        prevBtn.style.fontWeight = 'normal';
      }
    }
    // Select new
    this.selectedWeapon = weaponId;
    const btn = this.weaponButtons.get(weaponId);
    if (btn) {
      btn.style.background = 'rgba(100, 200, 255, 0.15)';
      btn.style.borderColor = 'rgba(100, 200, 255, 0.5)';
      btn.style.fontWeight = '600';
    }
    this.updatePlaceButton();
  }

  private selectTeam(team: ArenaTeam): void {
    this.selectedTeam = team;
    this.updateTeamHighlight();
  }

  private updateTeamHighlight(): void {
    if (this.allyBtn) {
      if (this.selectedTeam === 'ally') {
        this.allyBtn.style.background = 'rgba(100, 200, 255, 0.15)';
        this.allyBtn.style.borderColor = 'rgba(100, 200, 255, 0.5)';
        this.allyBtn.style.fontWeight = '600';
      } else {
        this.allyBtn.style.background = 'rgba(255, 255, 255, 0.04)';
        this.allyBtn.style.borderColor = 'rgba(100, 200, 255, 0.2)';
        this.allyBtn.style.fontWeight = 'normal';
      }
    }
    if (this.enemyBtn) {
      if (this.selectedTeam === 'enemy') {
        this.enemyBtn.style.background = 'rgba(255, 80, 80, 0.15)';
        this.enemyBtn.style.borderColor = 'rgba(255, 80, 80, 0.5)';
        this.enemyBtn.style.fontWeight = '600';
      } else {
        this.enemyBtn.style.background = 'rgba(255, 255, 255, 0.04)';
        this.enemyBtn.style.borderColor = 'rgba(255, 80, 80, 0.2)';
        this.enemyBtn.style.fontWeight = 'normal';
      }
    }
  }

  private updatePlaceButton(): void {
    if (this.placeBtn) {
      this.placeBtn.style.opacity = this.canPlace() ? '1' : '0.4';
    }
  }
}
