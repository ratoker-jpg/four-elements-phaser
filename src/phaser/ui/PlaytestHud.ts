/**
 * PlaytestHud — lightweight DOM overlay for playtesting the civil loop.
 *
 * ARCH-14A: MVP playtest HUD with economy readout, build buttons,
 * production buttons, and status feedback. No framework, no dependencies.
 *
 * Lifecycle:
 * - Created by GameScene in create().
 * - Updated each frame via update(state).
 * - Destroyed in GameScene shutdown().
 */

import type { GameState, BuildingType, ProducibleUnitType } from '../../state/types';
import { ELEMENT_UNITS_PER_ELEMENT } from '../../state/types';
import { BUILDING_CONFIG } from '../../state/construction';

// ─── Types ──────────────────────────────────────────────────────────

/** Callback type for build requests. */
export type BuildRequestCallback = (buildingType: BuildingType) => BuildRequestResult;

/** Callback type for production requests. */
export type ProductionRequestCallback = (unitType: ProducibleUnitType) => ProductionRequestResult;

/** Result of a build request, used for status feedback. */
export interface BuildRequestResult {
  success: boolean;
  message: string;
}

/** Result of a production request, used for status feedback. */
export interface ProductionRequestResult {
  success: boolean;
  message: string;
}

// ─── Constants ──────────────────────────────────────────────────────

/** How long status messages are displayed before fading (ms). */
const STATUS_DISPLAY_MS = 3000;

/** Build button definitions. */
const BUILD_BUTTONS: Array<{ buildingType: BuildingType; label: string; hotkey: string }> = [
  { buildingType: 'separator', label: 'Separator', hotkey: 'B' },
  { buildingType: 'power-plant', label: 'Power Plant', hotkey: 'P' },
  { buildingType: 'units-factory', label: 'Units Factory', hotkey: 'F' },
];

/** Production button definitions. */
const PRODUCTION_BUTTONS: Array<{ unitType: ProducibleUnitType; label: string; hotkey: string }> = [
  { unitType: 'builder', label: 'Builder', hotkey: 'N' },
  { unitType: 'harvester', label: 'Harvester', hotkey: 'G' },
];

// ─── PlaytestHud class ──────────────────────────────────────────────

export class PlaytestHud {
  private container: HTMLDivElement | null = null;
  private economyEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private buildButtons: Map<BuildingType, HTMLButtonElement> = new Map();
  private productionButtons: Map<ProducibleUnitType, HTMLButtonElement> = new Map();

  // Callbacks — set by GameScene
  private onBuildRequest: BuildRequestCallback | null = null;
  private onProductionRequest: ProductionRequestCallback | null = null;

  /**
   * Create the HUD DOM overlay and attach it to the document body.
   * Call exactly once when GameScene starts.
   */
  create(buildCb: BuildRequestCallback, prodCb: ProductionRequestCallback): void {
    // Prevent duplicate panels
    this.destroy();

    this.onBuildRequest = buildCb;
    this.onProductionRequest = prodCb;

    const root = document.createElement('div');
    root.id = 'playtest-hud';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      top: 48px;
      right: 8px;
      width: 220px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 10px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      color: #e0e0e0;
      z-index: 20;
      pointer-events: auto;
      user-select: none;
    `;

    // ── Economy section ──────────────────────────────────────────
    const econTitle = document.createElement('div');
    econTitle.textContent = 'Economy';
    econTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #4fc3f7;';
    root.appendChild(econTitle);

    this.economyEl = document.createElement('div');
    this.economyEl.style.cssText = 'line-height: 1.6; margin-bottom: 10px; color: #c0c0c0;';
    root.appendChild(this.economyEl);

    // ── Build section ────────────────────────────────────────────
    const buildTitle = document.createElement('div');
    buildTitle.textContent = 'Build';
    buildTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #81c784;';
    root.appendChild(buildTitle);

    for (const def of BUILD_BUTTONS) {
      const btn = document.createElement('button');
      const config = BUILDING_CONFIG[def.buildingType];
      const costStr = config ? ` (${config.costMatter}m)` : '';
      btn.textContent = `${def.hotkey} = ${def.label}${costStr}`;
      btn.style.cssText = `
        display: block;
        width: 100%;
        margin: 2px 0;
        padding: 4px 8px;
        background: rgba(129, 199, 132, 0.15);
        border: 1px solid rgba(129, 199, 132, 0.3);
        border-radius: 3px;
        color: #a5d6a7;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
      `;
      btn.addEventListener('click', () => this.handleBuildClick(def.buildingType));
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(129, 199, 132, 0.3)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(129, 199, 132, 0.15)';
      });
      root.appendChild(btn);
      this.buildButtons.set(def.buildingType, btn);
    }

    // ── Production section ───────────────────────────────────────
    const prodTitle = document.createElement('div');
    prodTitle.textContent = 'Produce';
    prodTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin: 8px 0 4px; color: #ffb74d;';
    root.appendChild(prodTitle);

    for (const def of PRODUCTION_BUTTONS) {
      const btn = document.createElement('button');
      btn.textContent = `${def.hotkey} = ${def.label}`;
      btn.style.cssText = `
        display: block;
        width: 100%;
        margin: 2px 0;
        padding: 4px 8px;
        background: rgba(255, 183, 77, 0.15);
        border: 1px solid rgba(255, 183, 77, 0.3);
        border-radius: 3px;
        color: #ffcc80;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
      `;
      btn.addEventListener('click', () => this.handleProductionClick(def.unitType));
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255, 183, 77, 0.3)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255, 183, 77, 0.15)';
      });
      root.appendChild(btn);
      this.productionButtons.set(def.unitType, btn);
    }

    // ── Status section ───────────────────────────────────────────
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = `
      margin-top: 8px;
      padding: 4px 6px;
      min-height: 16px;
      font-size: 11px;
      color: #fff;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 3px;
      transition: opacity 0.3s;
    `;
    root.appendChild(this.statusEl);

    document.body.appendChild(root);
    this.container = root;
  }

  /**
   * Update HUD readouts from the current game state.
   * Called each frame from GameScene.update().
   */
  update(state: GameState): void {
    if (!this.economyEl) return;

    const s = state;
    const factionElRaw = s.economy.elements[s.playerFaction];
    const factionElDisplayed = (factionElRaw / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
    const elCapDisplayed = (s.economy.elementCap / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
    const factionLabel = s.playerFaction.charAt(0).toUpperCase() + s.playerFaction.slice(1);

    this.economyEl.innerHTML =
      `<div>Raw: <b>${s.economy.raw}</b>/${s.economy.rawCap}</div>` +
      `<div>Matter: <b>${s.economy.matter}</b>/${s.economy.matterCap}</div>` +
      `<div>${factionLabel}: <b>${factionElDisplayed}</b>/${elCapDisplayed}</div>` +
      `<div>Power: <b>${s.economy.powerConsumed}</b>/${s.economy.powerGenerated}</div>`;

    // Update button disable states based on affordability
    for (const [buildingType, btn] of this.buildButtons) {
      const config = BUILDING_CONFIG[buildingType];
      const canAfford = config ? s.economy.matter >= config.costMatter : false;
      const hasIdleBuilder = s.mapData.builders.some(b => b.phase === 'idle' && !b.busy);
      const disabled = !canAfford || !hasIdleBuilder;
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.4' : '1';
      btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }

    for (const [_unitType, btn] of this.productionButtons) {
      const hasFactory = s.production.factories.length > 0;
      const hasQueueRoom = s.production.factories.some(f => f.queue.length < 2);
      const disabled = !hasFactory || !hasQueueRoom;
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.4' : '1';
      btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }
  }

  /**
   * Show a status message that fades after STATUS_DISPLAY_MS.
   */
  showStatus(message: string, success: boolean): void {
    if (!this.statusEl) return;

    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }

    this.statusEl.textContent = message;
    this.statusEl.style.opacity = '1';
    this.statusEl.style.color = success ? '#a5d6a7' : '#ef9a9a';

    this.statusTimer = setTimeout(() => {
      if (this.statusEl) {
        this.statusEl.style.opacity = '0.3';
      }
    }, STATUS_DISPLAY_MS);
  }

  /**
   * Remove the HUD DOM overlay and clean up.
   */
  destroy(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.economyEl = null;
    this.statusEl = null;
    this.buildButtons.clear();
    this.productionButtons.clear();
  }

  // ─── Internal handlers ────────────────────────────────────────────

  private handleBuildClick(buildingType: BuildingType): void {
    if (!this.onBuildRequest) return;
    const result = this.onBuildRequest(buildingType);
    this.showStatus(result.message, result.success);
  }

  private handleProductionClick(unitType: ProducibleUnitType): void {
    if (!this.onProductionRequest) return;
    const result = this.onProductionRequest(unitType);
    this.showStatus(result.message, result.success);
  }
}
