/**
 * PlaytestHud — lightweight DOM overlay for playtesting the civil loop.
 *
 * ARCH-14A: MVP playtest HUD with economy readout, build buttons,
 * production buttons, and status feedback. No framework, no dependencies.
 *
 * ARCH-07A: Extended with separator status, factory queue/progress,
 * button disable reasons, and resource change feedback.
 *
 * Lifecycle:
 * - Created by GameScene in create().
 * - Updated each frame via update(state).
 * - Destroyed in GameScene shutdown().
 */

import type { GameState, BuildingType, ProducibleUnitType } from '../../state/types';
import { ELEMENT_UNITS_PER_ELEMENT } from '../../state/types';
import { BUILDING_CONFIG } from '../../state/construction';
import {
  getSeparatorStatus,
  getFactoryStatus,
  getBuildBlockReason,
  getProductionBlockReason,
  getHarvesterStatus,
  isHarvesterBlocked,
  getUnitCount,
  getUnitCap,
  getFactorySpawnBlockReason,
  separatorStatusLabel,
  factoryStatusLabel,
  buildBlockLabel,
  productionBlockLabel,
  harvesterStatusLabel,
  spawnBlockLabel,
} from '../../state/statusHelpers';
import { validateMap, type MapValidationResult } from '../../state/mapValidation';

// ─── Types ──────────────────────────────────────────────────────────

/** Callback type for build requests. */
export type BuildRequestCallback = (buildingType: BuildingType) => BuildRequestResult;

/** Callback type for production requests. */
export type ProductionRequestCallback = (unitType: ProducibleUnitType) => ProductionRequestResult;

/** Callback type for cancel requests (FIX-04). */
export type CancelRequestCallback = (factoryIndex: number, queueIndex: number) => CancelRequestResult;

/** Result of a cancel request (FIX-04). */
export interface CancelRequestResult {
  success: boolean;
  message: string;
}

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

/** How long resource delta indicators are shown (ms). */
const DELTA_DISPLAY_MS = 2000;

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
  private harvesterEl: HTMLDivElement | null = null;
  private separatorEl: HTMLDivElement | null = null;
  private factoryEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private diagnosticsEl: HTMLDivElement | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private buildButtons: Map<BuildingType, HTMLButtonElement> = new Map();
  private buildReasonEls: Map<BuildingType, HTMLSpanElement> = new Map();
  private productionButtons: Map<ProducibleUnitType, HTMLButtonElement> = new Map();
  private prodReasonEls: Map<ProducibleUnitType, HTMLSpanElement> = new Map();

  // Callbacks — set by GameScene
  private onBuildRequest: BuildRequestCallback | null = null;
  private onProductionRequest: ProductionRequestCallback | null = null;
  private onCancelRequest: CancelRequestCallback | null = null;

  // Resource delta tracking
  private prevRaw = 0;
  private prevMatter = 0;
  private prevElementUnits = 0;
  private rawDelta = 0;
  private matterDelta = 0;
  private deltaTimer: ReturnType<typeof setTimeout> | null = null;
  private deltaActive = false;
  /** Guard to suppress huge initial deltas on the first HUD update. */
  private resourceDeltaInitialized = false;

  /** Cached map validation result (computed once, not every frame). */
  private cachedValidation: MapValidationResult | null = null;

  /**
   * Create the HUD DOM overlay and attach it to the document body.
   * Call exactly once when GameScene starts.
   */
  create(buildCb: BuildRequestCallback, prodCb: ProductionRequestCallback, cancelCb?: CancelRequestCallback): void {
    // Prevent duplicate panels
    this.destroy();

    this.onBuildRequest = buildCb;
    this.onProductionRequest = prodCb;
    this.onCancelRequest = cancelCb ?? null;

    const root = document.createElement('div');
    root.id = 'playtest-hud';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      top: 48px;
      right: 8px;
      width: 228px;
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
      max-height: calc(100vh - 60px);
      overflow-y: auto;
      transform: scale(var(--ui-scale, 1));
      transform-origin: top right;
    `;

    // ── Economy section ──────────────────────────────────────────
    const econTitle = document.createElement('div');
    econTitle.textContent = 'Economy';
    econTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #4fc3f7;';
    root.appendChild(econTitle);

    this.economyEl = document.createElement('div');
    this.economyEl.style.cssText = 'line-height: 1.6; margin-bottom: 8px; color: #c0c0c0;';
    root.appendChild(this.economyEl);

    // ── Harvester section (FIX-02) ──────────────────────────────────
    const harvTitle = document.createElement('div');
    harvTitle.textContent = 'Harvesters';
    harvTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #4fc3f7;';
    root.appendChild(harvTitle);

    this.harvesterEl = document.createElement('div');
    this.harvesterEl.style.cssText = 'line-height: 1.5; margin-bottom: 8px; color: #b0b0b0; font-size: 11px;';
    root.appendChild(this.harvesterEl);

    // ── Separator section ────────────────────────────────────────
    const sepTitle = document.createElement('div');
    sepTitle.textContent = 'Separators';
    sepTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #66bbff;';
    root.appendChild(sepTitle);

    this.separatorEl = document.createElement('div');
    this.separatorEl.style.cssText = 'line-height: 1.5; margin-bottom: 8px; color: #b0b0b0; font-size: 11px;';
    root.appendChild(this.separatorEl);

    // ── Factory section ──────────────────────────────────────────
    const factTitle = document.createElement('div');
    factTitle.textContent = 'Factory';
    factTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #ffcc44;';
    root.appendChild(factTitle);

    this.factoryEl = document.createElement('div');
    this.factoryEl.style.cssText = 'line-height: 1.5; margin-bottom: 8px; color: #b0b0b0; font-size: 11px;';
    // FIX-04 fixup: Delegated click handler for cancel buttons
    this.factoryEl.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.dataset.feCancel !== undefined) {
        const fi = Number(target.dataset.factoryIndex);
        const qi = Number(target.dataset.queueIndex);
        if (!isNaN(fi) && !isNaN(qi) && this.onCancelRequest) {
          const result = this.onCancelRequest(fi, qi);
          this.showStatus(result.message, result.success);
        }
      }
    });
    root.appendChild(this.factoryEl);

    // ── Build section ────────────────────────────────────────────
    const buildTitle = document.createElement('div');
    buildTitle.textContent = 'Build';
    buildTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #81c784;';
    root.appendChild(buildTitle);

    for (const def of BUILD_BUTTONS) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; margin: 2px 0;';

      const btn = document.createElement('button');
      const config = BUILDING_CONFIG[def.buildingType];
      const costStr = config ? ` (${config.costMatter}m)` : '';
      btn.textContent = `${def.hotkey} = ${def.label}${costStr}`;
      btn.style.cssText = `
        flex: 1;
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
      row.appendChild(btn);

      // Reason label (shown when disabled)
      const reasonSpan = document.createElement('span');
      reasonSpan.style.cssText = `
        font-size: 9px;
        color: #ef9a9a;
        margin-left: 4px;
        white-space: nowrap;
        display: none;
      `;
      row.appendChild(reasonSpan);

      root.appendChild(row);
      this.buildButtons.set(def.buildingType, btn);
      this.buildReasonEls.set(def.buildingType, reasonSpan);
    }

    // ── Production section ───────────────────────────────────────
    const prodTitle = document.createElement('div');
    prodTitle.textContent = 'Produce';
    prodTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin: 8px 0 4px; color: #ffb74d;';
    root.appendChild(prodTitle);

    for (const def of PRODUCTION_BUTTONS) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; margin: 2px 0;';

      const btn = document.createElement('button');
      btn.textContent = `${def.hotkey} = ${def.label}`;
      btn.style.cssText = `
        flex: 1;
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
      row.appendChild(btn);

      // Reason label (shown when disabled)
      const reasonSpan = document.createElement('span');
      reasonSpan.style.cssText = `
        font-size: 9px;
        color: #ef9a9a;
        margin-left: 4px;
        white-space: nowrap;
        display: none;
      `;
      row.appendChild(reasonSpan);

      root.appendChild(row);
      this.productionButtons.set(def.unitType, btn);
      this.prodReasonEls.set(def.unitType, reasonSpan);
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

    // ── Diagnostics section (ARCH-08/09/10) ─────────────────────
    this.diagnosticsEl = document.createElement('div');
    this.diagnosticsEl.style.cssText = `
      margin-top: 6px;
      padding: 4px 6px;
      font-size: 9px;
      color: #888;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
      line-height: 1.4;
    `;
    root.appendChild(this.diagnosticsEl);

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

    // ── Resource delta tracking ──────────────────────────────────
    this.trackResourceDeltas(s);

    const rawDeltaStr = this.formatDelta(this.rawDelta, s.economy.raw !== this.prevRaw);
    const matterDeltaStr = this.formatDelta(this.matterDelta, s.economy.matter !== this.prevMatter);
    const elDeltaRaw = factionElRaw - this.prevElementUnits;
    const elDeltaStr = this.formatDelta(
      elDeltaRaw / ELEMENT_UNITS_PER_ELEMENT,
      factionElRaw !== this.prevElementUnits,
    );

    this.economyEl.innerHTML =
      `<div>Raw: <b>${s.economy.raw}</b>/${s.economy.rawCap} ${rawDeltaStr}</div>` +
      `<div>Matter: <b>${s.economy.matter}</b>/${s.economy.matterCap} ${matterDeltaStr}</div>` +
      `<div>${factionLabel}: <b>${factionElDisplayed}</b>/${elCapDisplayed} ${elDeltaStr}</div>` +
      `<div>Power: <b>${s.economy.powerConsumed}</b>/${s.economy.powerGenerated}</div>` +
      `<div>Units: <b>${getUnitCount(s)}</b>/${getUnitCap(s)}</div>`;

    // ── Harvester status section (FIX-02) ───────────────────────────
    this.updateHarvesterSection(s);

    // ── Separator status section ─────────────────────────────────
    this.updateSeparatorSection(s);

    // ── Factory queue section ────────────────────────────────────
    this.updateFactorySection(s);

    // ── Build button disable states + reasons ────────────────────
    for (const [buildingType, btn] of this.buildButtons) {
      const reason = getBuildBlockReason(s, buildingType);
      const disabled = reason !== null;
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.4' : '1';
      btn.style.cursor = disabled ? 'not-allowed' : 'pointer';

      const reasonEl = this.buildReasonEls.get(buildingType);
      if (reasonEl) {
        if (disabled && reason) {
          reasonEl.textContent = buildBlockLabel(reason);
          reasonEl.style.display = 'inline';
        } else {
          reasonEl.style.display = 'none';
        }
      }
    }

    // ── Production button disable states + reasons ───────────────
    for (const [unitType, btn] of this.productionButtons) {
      const reason = getProductionBlockReason(s, unitType);
      const disabled = reason !== null;
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.4' : '1';
      btn.style.cursor = disabled ? 'not-allowed' : 'pointer';

      const reasonEl = this.prodReasonEls.get(unitType);
      if (reasonEl) {
        if (disabled && reason) {
          reasonEl.textContent = productionBlockLabel(reason);
          reasonEl.style.display = 'inline';
        } else {
          reasonEl.style.display = 'none';
        }
      }
    }

    // ── Diagnostics (ARCH-08/09/10) ──────────────────────────────
    this.updateDiagnostics(s);

    // ── Store current values for next frame delta ────────────────
    this.prevRaw = s.economy.raw;
    this.prevMatter = s.economy.matter;
    this.prevElementUnits = factionElRaw;
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
    if (this.deltaTimer) {
      clearTimeout(this.deltaTimer);
      this.deltaTimer = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.economyEl = null;
    this.harvesterEl = null;
    this.separatorEl = null;
    this.factoryEl = null;
    this.statusEl = null;
    this.diagnosticsEl = null;
    this.buildButtons.clear();
    this.buildReasonEls.clear();
    this.productionButtons.clear();
    this.prodReasonEls.clear();
    this.resourceDeltaInitialized = false;
    this.cachedValidation = null;
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

  // ─── Harvester section (FIX-02) ──────────────────────────────────────

  private updateHarvesterSection(state: GameState): void {
    if (!this.harvesterEl) return;

    if (state.harvesters.length === 0) {
      this.harvesterEl.innerHTML = '<div style="color:#666;">None spawned</div>';
      return;
    }

    const parts: string[] = [];
    for (let i = 0; i < state.harvesters.length; i++) {
      const h = state.harvesters[i];
      const status = getHarvesterStatus(h);
      const label = harvesterStatusLabel(status);
      const blocked = isHarvesterBlocked(status);
      const color = blocked ? '#ef9a9a' : this.harvesterPhaseColor(status);
      const cargoStr = h.cargoRaw > 0 ? ` [${h.cargoRaw}/${h.cargoCapacity}]` : '';
      parts.push(
        `<div><span style="color:${color};">H${i + 1}:</span> ${label}${cargoStr}</div>`,
      );
    }
    this.harvesterEl.innerHTML = parts.join('');
  }

  private harvesterPhaseColor(status: string): string {
    switch (status) {
      case 'gathering': return '#81c784';
      case 'moving-to-resource':
      case 'returning-to-hq': return '#66bbff';
      case 'unloading': return '#ffcc44';
      case 'idle': return '#999';
      default: return '#b0b0b0';
    }
  }

  // ─── Separator section ────────────────────────────────────────────

  private updateSeparatorSection(state: GameState): void {
    if (!this.separatorEl) return;

    if (state.economy.separators.length === 0) {
      this.separatorEl.innerHTML = '<div style="color:#666;">None built</div>';
      return;
    }

    const parts: string[] = [];
    for (let i = 0; i < state.economy.separators.length; i++) {
      const sep = state.economy.separators[i];
      const status = getSeparatorStatus(state, sep);
      const label = separatorStatusLabel(status);
      const color = this.separatorStatusColor(status);
      const progressStr = status === 'processing'
        ? ` ${Math.round(sep.progress * 100)}%`
        : '';
      parts.push(
        `<div><span style="color:${color};">Sep ${i + 1}:</span> ${label}${progressStr}</div>`,
      );
    }
    this.separatorEl.innerHTML = parts.join('');
  }

  private separatorStatusColor(status: string): string {
    switch (status) {
      case 'processing': return '#66bbff';
      case 'idle': return '#999';
      default: return '#ff8866'; // blocked
    }
  }

  // ─── Factory section ──────────────────────────────────────────────

  private updateFactorySection(state: GameState): void {
    if (!this.factoryEl) return;

    if (state.production.factories.length === 0) {
      this.factoryEl.innerHTML = '<div style="color:#666;">None built</div>';
      return;
    }

    const parts: string[] = [];
    for (let i = 0; i < state.production.factories.length; i++) {
      const factory = state.production.factories[i];
      const status = getFactoryStatus(state, factory);
      const label = factoryStatusLabel(status);
      const color = this.factoryStatusColor(status);

      // Queue display with spawn blockage feedback + cancel buttons (FIX-04)
      let queueStr = '';
      if (factory.queue.length === 0) {
        queueStr = '<span style="color:#666;">Queue: empty</span>';
      } else {
        const slots: string[] = [];
        for (let qi = 0; qi < factory.queue.length; qi++) {
          const item = factory.queue[qi];
          const typeChar = item.unitType === 'builder' ? 'B' : 'H';
          const pct = item.completed ? 'done' : `${Math.round(item.progress * 100)}%`;
          // Cancel button for each queue item — uses data attributes for delegated handler
          const cancelBtn = `<button data-fe-cancel data-factory-index="${i}" data-queue-index="${qi}" style="background:rgba(239,154,154,0.2);border:1px solid rgba(239,154,154,0.4);border-radius:2px;color:#ef9a9a;font-size:8px;padding:0 3px;cursor:pointer;margin-left:2px;">X</button>`;
          slots.push(`${typeChar}${pct}${cancelBtn}`);
        }
        queueStr = `Queue: ${slots.join(' ')}`;
      }

      // Spawn blockage reason (FIX-04)
      const spawnBlock = getFactorySpawnBlockReason(state, factory);
      let blockageStr = '';
      if (spawnBlock) {
        blockageStr = `<div style="margin-left:8px; font-size:10px; color:#ef9a9a;">Blocked: ${spawnBlockLabel(spawnBlock)}</div>`;
      }

      parts.push(
        `<div><span style="color:${color};">Factory ${i + 1}:</span> ${label}</div>` +
        `<div style="margin-left:8px; font-size:10px;">${queueStr}</div>` +
        blockageStr,
      );
    }
    this.factoryEl.innerHTML = parts.join('');
  }

  private factoryStatusColor(status: string): string {
    switch (status) {
      case 'producing-builder':
      case 'producing-harvester':
        return '#ffcc44';
      case 'idle': return '#999';
      default: return '#ff8866'; // blocked
    }
  }

  // ─── Resource delta tracking ──────────────────────────────────────

  private trackResourceDeltas(state: GameState): void {
    const factionElRaw = state.economy.elements[state.playerFaction];

    // On the very first update, initialize prev values from current state
    // so that no huge spurious deltas appear from the 0→actual jump.
    if (!this.resourceDeltaInitialized) {
      this.prevRaw = state.economy.raw;
      this.prevMatter = state.economy.matter;
      this.prevElementUnits = factionElRaw;
      this.resourceDeltaInitialized = true;
      return;
    }

    const rawDelta = state.economy.raw - this.prevRaw;
    const matterDelta = state.economy.matter - this.prevMatter;
    const elDelta = factionElRaw - this.prevElementUnits;

    // Only update if something changed
    if (rawDelta !== 0 || matterDelta !== 0 || elDelta !== 0) {
      this.rawDelta = rawDelta;
      this.matterDelta = matterDelta;
      this.deltaActive = true;

      // Reset the delta fade timer
      if (this.deltaTimer) clearTimeout(this.deltaTimer);
      this.deltaTimer = setTimeout(() => {
        this.deltaActive = false;
        this.rawDelta = 0;
        this.matterDelta = 0;
      }, DELTA_DISPLAY_MS);
    }
  }

  /** Format a resource delta as a colored string like "+5" or "-3". */
  private formatDelta(delta: number, changed: boolean): string {
    if (!this.deltaActive || !changed || delta === 0) return '';
    const sign = delta > 0 ? '+' : '';
    const color = delta > 0 ? '#81c784' : '#ef9a9a';
    return `<span style="color:${color}; font-size:10px;"> ${sign}${Number.isInteger(delta) ? delta : delta.toFixed(1)}</span>`;
  }

  // ─── Diagnostics section (ARCH-08/09/10) ──────────────────────────────

  private updateDiagnostics(state: GameState): void {
    if (!this.diagnosticsEl) return;

    // Run validation once and cache the result
    if (!this.cachedValidation) {
      this.cachedValidation = validateMap(state);
    }
    const v = this.cachedValidation;

    const parts: string[] = [];

    // Reachable resources count
    parts.push(
      `<div>Reachable: <span style="color:${v.reachableResourceCount >= 2 ? '#81c784' : '#ef9a9a'};">${v.reachableResourceCount}</span>/${v.totalResourceCount}</div>`,
    );

    // Show warnings for failed checks
    // Critical checks (red warning): hq-adjacent-passable, reachable-resources, harvester-not-trapped
    // Soft informational check (muted): resources-not-in-impassable
    for (const check of v.checks) {
      if (!check.passed) {
        if (check.id === 'resources-not-in-impassable') {
          // Soft informational — show as muted, not a blocking warning
          parts.push(
            `<div style="color:#777;">ℹ ${check.message}</div>`,
          );
        } else {
          // Critical — show as red warning
          parts.push(
            `<div style="color:#ef9a9a;">⚠ ${check.message}</div>`,
          );
        }
      }
    }

    // ARCH-14B: Quick hint about pause menu for controls reference
    parts.push(
      `<div style="margin-top:4px; color:#555;">Esc = Pause & Controls</div>`,
    );

    this.diagnosticsEl.innerHTML = parts.join('');
  }
}
