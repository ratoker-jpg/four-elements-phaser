/**
 * PlaytestHud — lightweight DOM overlay for playtesting the civil loop.
 *
 * ARCH-14A: MVP playtest HUD with economy readout, build buttons,
 * production buttons, and status feedback. No framework, no dependencies.
 *
 * ARCH-07A: Extended with separator status, factory queue/progress,
 * button disable reasons, and resource change feedback.
 *
 * HUD-01: Polished to match UI-01/UI-02/UI-03/UI-04 industrial sci-fi
 * visual direction. Dark slate panel, bronze/gold primary accent,
 * teal secondary accent, red/danger for blocked/error states.
 * Clear section separation, better spacing, readable typography,
 * proper hover/focus/active/disabled button states.
 *
 * Lifecycle:
 * - Created by GameScene in create().
 * - Updated each frame via update(state).
 * - Destroyed in GameScene shutdown().
 */

import type { GameState, BuildingType, ProducibleUnitType } from '../../state/types';
import { ELEMENT_UNITS_PER_ELEMENT } from '../../state/types';
import { BUILDING_CONFIG } from '../../state/construction';
import { getMvpCommandHotkey } from '../../state/commandRegistry';
import { t, FACTION_DISPLAY } from '../../config/localization';
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

/** Build button definitions. HOTKEYS-01: hotkeys sourced from command registry. */
const BUILD_BUTTONS: Array<{ buildingType: BuildingType; label: string; commandId: string }> = [
  { buildingType: 'separator', label: t('hud_separator'), commandId: 'build-separator' },
  { buildingType: 'power-plant', label: t('hud_powerPlant'), commandId: 'build-power-plant' },
  { buildingType: 'units-factory', label: t('hud_unitsFactory'), commandId: 'build-units-factory' },
];

/** Production button definitions. HOTKEYS-01: hotkeys sourced from command registry. */
const PRODUCTION_BUTTONS: Array<{ unitType: ProducibleUnitType; label: string; commandId: string }> = [
  { unitType: 'builder', label: t('hud_builder'), commandId: 'produce-builder' },
  { unitType: 'harvester', label: t('hud_harvesterUnit'), commandId: 'produce-harvester' },
];

/**
 * Get the hotkey string for a command from the registry.
 *
 * HOTKEYS-01 fixup: Uses getMvpCommandHotkey() to ensure MVP command
 * definitions exist before lookup. This makes the HUD robust to
 * initialization order — even if PlaytestHud creates buttons before
 * GameInputController registers MVP commands, hotkey labels will resolve.
 *
 * Returns empty string if command not found or has no key.
 */
function getHotkeyString(commandId: string): string {
  return getMvpCommandHotkey(commandId);
}

// ─── HUD Theme (HUD-01: Industrial sci-fi, matches UI-01/02/03/04) ──────

const HUD_THEME = {
  bg: 'rgba(17, 24, 39, 0.92)',
  border: 'rgba(212, 165, 116, 0.15)',
  titleColor: '#e0f2fe',
  sectionTitleColor: '#d4a574',
  bodyColor: '#c0c0c0',
  mutedColor: '#64748b',
  dimColor: '#4b5563',
  primaryAccent: '#d4a574',
  primaryAccentLight: '#e8c9a0',
  secondaryAccent: '#80cbc4',
  secondaryAccentLight: '#a7d8d2',
  dangerColor: '#ef9a9a',
  dangerBg: 'rgba(239, 154, 154, 0.08)',
  dangerBorder: 'rgba(239, 154, 154, 0.2)',
  successColor: '#80cbc4',
  dividerColor: 'rgba(212, 165, 116, 0.12)',
  panelRadius: '6px',
  buttonRadius: '4px',
  focusOutline: '#d4a574',
  rowBg: 'rgba(255, 255, 255, 0.02)',
  rowBorder: 'rgba(255, 255, 255, 0.05)',
} as const;

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
      width: 236px;
      background: ${HUD_THEME.bg};
      border: 1px solid ${HUD_THEME.border};
      border-radius: ${HUD_THEME.panelRadius};
      padding: 12px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      color: ${HUD_THEME.bodyColor};
      z-index: 20;
      pointer-events: auto;
      user-select: none;
      max-height: calc(100vh - 60px);
      overflow-y: auto;
      transform: scale(var(--ui-scale, 1));
      transform-origin: top right;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    `;

    // ── Economy section ──────────────────────────────────────────
    root.appendChild(this.createSectionTitle(t('hud_economy')));

    this.economyEl = document.createElement('div');
    this.economyEl.id = 'hud-economy'; // HUD-01: preserved for qa:smoke DOM assertion
    this.economyEl.style.cssText = `
      line-height: 1.7;
      margin-bottom: 4px;
      color: ${HUD_THEME.bodyColor};
      font-size: 11px;
    `;
    root.appendChild(this.economyEl);

    root.appendChild(this.createDivider());

    // ── Harvester section (FIX-02) ──────────────────────────────────
    root.appendChild(this.createSectionTitle(t('hud_harvesters')));

    this.harvesterEl = document.createElement('div');
    this.harvesterEl.style.cssText = `
      line-height: 1.6;
      margin-bottom: 4px;
      color: ${HUD_THEME.bodyColor};
      font-size: 11px;
    `;
    root.appendChild(this.harvesterEl);

    root.appendChild(this.createDivider());

    // ── Separator section ────────────────────────────────────────
    root.appendChild(this.createSectionTitle(t('hud_separators')));

    this.separatorEl = document.createElement('div');
    this.separatorEl.style.cssText = `
      line-height: 1.6;
      margin-bottom: 4px;
      color: ${HUD_THEME.bodyColor};
      font-size: 11px;
    `;
    root.appendChild(this.separatorEl);

    root.appendChild(this.createDivider());

    // ── Factory section ──────────────────────────────────────────
    root.appendChild(this.createSectionTitle(t('hud_factory')));

    this.factoryEl = document.createElement('div');
    this.factoryEl.style.cssText = `
      line-height: 1.6;
      margin-bottom: 4px;
      color: ${HUD_THEME.bodyColor};
      font-size: 11px;
    `;
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

    root.appendChild(this.createDivider());

    // ── Build section ────────────────────────────────────────────
    root.appendChild(this.createSectionTitle(t('hud_build')));

    for (const def of BUILD_BUTTONS) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        margin: 3px 0;
        gap: 6px;
      `;

      const btn = document.createElement('button');
      const config = BUILDING_CONFIG[def.buildingType];
      const costStr = config ? ` (${config.costMatter}m)` : '';
      const hotkey = getHotkeyString(def.commandId);
      btn.textContent = hotkey ? `${hotkey} = ${def.label}${costStr}` : `${def.label}${costStr}`;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 10px;
        background: rgba(212, 165, 116, 0.08);
        border: 1px solid rgba(212, 165, 116, 0.2);
        border-radius: ${HUD_THEME.buttonRadius};
        color: ${HUD_THEME.primaryAccent};
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        letter-spacing: 0.3px;
        transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        outline: none;
      `;
      btn.addEventListener('mouseenter', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(212, 165, 116, 0.16)';
          btn.style.borderColor = 'rgba(212, 165, 116, 0.4)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(212, 165, 116, 0.08)';
          btn.style.borderColor = 'rgba(212, 165, 116, 0.2)';
          btn.style.boxShadow = 'none';
        }
      });
      btn.addEventListener('focus', () => {
        if (!btn.disabled) {
          btn.style.outline = `2px solid ${HUD_THEME.focusOutline}`;
          btn.style.outlineOffset = '1px';
        }
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('mousedown', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(212, 165, 116, 0.22)';
        }
      });
      btn.addEventListener('mouseup', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(212, 165, 116, 0.16)';
        }
      });
      btn.addEventListener('click', () => this.handleBuildClick(def.buildingType));
      row.appendChild(btn);

      // Reason label (shown when disabled)
      const reasonSpan = document.createElement('span');
      reasonSpan.style.cssText = `
        font-size: 9px;
        color: ${HUD_THEME.dangerColor};
        white-space: nowrap;
        display: none;
      `;
      row.appendChild(reasonSpan);

      root.appendChild(row);
      this.buildButtons.set(def.buildingType, btn);
      this.buildReasonEls.set(def.buildingType, reasonSpan);
    }

    root.appendChild(this.createDivider());

    // ── Production section ───────────────────────────────────────
    root.appendChild(this.createSectionTitle(t('hud_produce')));

    for (const def of PRODUCTION_BUTTONS) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        margin: 3px 0;
        gap: 6px;
      `;

      const btn = document.createElement('button');
      const hotkey = getHotkeyString(def.commandId);
      btn.textContent = hotkey ? `${hotkey} = ${def.label}` : `${def.label}`;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 10px;
        background: rgba(128, 203, 196, 0.08);
        border: 1px solid rgba(128, 203, 196, 0.2);
        border-radius: ${HUD_THEME.buttonRadius};
        color: ${HUD_THEME.secondaryAccent};
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        letter-spacing: 0.3px;
        transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        outline: none;
      `;
      btn.addEventListener('mouseenter', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(128, 203, 196, 0.16)';
          btn.style.borderColor = 'rgba(128, 203, 196, 0.4)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(128, 203, 196, 0.08)';
          btn.style.borderColor = 'rgba(128, 203, 196, 0.2)';
          btn.style.boxShadow = 'none';
        }
      });
      btn.addEventListener('focus', () => {
        if (!btn.disabled) {
          btn.style.outline = `2px solid ${HUD_THEME.focusOutline}`;
          btn.style.outlineOffset = '1px';
        }
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('mousedown', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(128, 203, 196, 0.22)';
        }
      });
      btn.addEventListener('mouseup', () => {
        if (!btn.disabled) {
          btn.style.background = 'rgba(128, 203, 196, 0.16)';
        }
      });
      btn.addEventListener('click', () => this.handleProductionClick(def.unitType));
      row.appendChild(btn);

      // Reason label (shown when disabled)
      const reasonSpan = document.createElement('span');
      reasonSpan.style.cssText = `
        font-size: 9px;
        color: ${HUD_THEME.dangerColor};
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
      margin-top: 10px;
      padding: 6px 8px;
      min-height: 18px;
      font-size: 11px;
      color: ${HUD_THEME.bodyColor};
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid ${HUD_THEME.rowBorder};
      border-radius: ${HUD_THEME.buttonRadius};
      transition: opacity 0.3s;
    `;
    root.appendChild(this.statusEl);

    // ── Diagnostics section (ARCH-08/09/10) ─────────────────────
    this.diagnosticsEl = document.createElement('div');
    this.diagnosticsEl.style.cssText = `
      margin-top: 6px;
      padding: 4px 6px;
      font-size: 9px;
      color: ${HUD_THEME.dimColor};
      background: rgba(0, 0, 0, 0.15);
      border-radius: ${HUD_THEME.buttonRadius};
      line-height: 1.5;
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
    const factionLabel = FACTION_DISPLAY[s.playerFaction] ?? s.playerFaction;

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
      `<div>${t('hud_raw')}: <b>${s.economy.raw}</b>/${s.economy.rawCap} ${rawDeltaStr}</div>` +
      `<div>${t('hud_matter')}: <b>${s.economy.matter}</b>/${s.economy.matterCap} ${matterDeltaStr}</div>` +
      `<div>${factionLabel}: <b>${factionElDisplayed}</b>/${elCapDisplayed} ${elDeltaStr}</div>` +
      `<div>${t('hud_power')}: <b>${s.economy.powerConsumed}</b>/${s.economy.powerGenerated}</div>` +
      `<div>${t('hud_units')}: <b>${getUnitCount(s)}</b>/${getUnitCap(s)}</div>`;

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
      if (disabled) {
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.style.background = 'rgba(55, 65, 81, 0.2)';
        btn.style.borderColor = 'rgba(55, 65, 81, 0.3)';
        btn.style.color = HUD_THEME.dimColor;
      } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = 'rgba(212, 165, 116, 0.08)';
        btn.style.borderColor = 'rgba(212, 165, 116, 0.2)';
        btn.style.color = HUD_THEME.primaryAccent;
      }

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
      if (disabled) {
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.style.background = 'rgba(55, 65, 81, 0.2)';
        btn.style.borderColor = 'rgba(55, 65, 81, 0.3)';
        btn.style.color = HUD_THEME.dimColor;
      } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = 'rgba(128, 203, 196, 0.08)';
        btn.style.borderColor = 'rgba(128, 203, 196, 0.2)';
        btn.style.color = HUD_THEME.secondaryAccent;
      }

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
    this.statusEl.style.color = success ? HUD_THEME.successColor : HUD_THEME.dangerColor;

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

  // ─── HUD-01: Visual helper elements ───────────────────────────────

  /** Create a section title element matching the industrial sci-fi theme. */
  private createSectionTitle(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      font-weight: 600;
      font-size: 11px;
      margin-bottom: 5px;
      color: ${HUD_THEME.sectionTitleColor};
      letter-spacing: 1px;
      text-transform: uppercase;
    `;
    return el;
  }

  /** Create a subtle horizontal divider between sections. */
  private createDivider(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
      border-top: 1px solid ${HUD_THEME.dividerColor};
      margin: 8px 0;
    `;
    return el;
  }

  // ─── Harvester section (FIX-02) ──────────────────────────────────────

  private updateHarvesterSection(state: GameState): void {
    if (!this.harvesterEl) return;

    if (state.harvesters.length === 0) {
      this.harvesterEl.innerHTML = `<div style="color:${HUD_THEME.dimColor};">${t('hud_noneSpawned')}</div>`;
      return;
    }

    const parts: string[] = [];
    for (let i = 0; i < state.harvesters.length; i++) {
      const h = state.harvesters[i];
      const status = getHarvesterStatus(h);
      const label = harvesterStatusLabel(status);
      const blocked = isHarvesterBlocked(status);
      const color = blocked ? HUD_THEME.dangerColor : this.harvesterPhaseColor(status);
      const cargoStr = h.cargoRaw > 0 ? ` [${h.cargoRaw}/${h.cargoCapacity}]` : '';
      parts.push(
        `<div><span style="color:${color}; font-weight:600;">${t('hud_harvesterAbbr')}${i + 1}:</span> ${label}${cargoStr}</div>`,
      );
    }
    this.harvesterEl.innerHTML = parts.join('');
  }

  private harvesterPhaseColor(status: string): string {
    switch (status) {
      case 'gathering': return HUD_THEME.successColor;
      case 'moving-to-resource':
      case 'returning-to-hq': return HUD_THEME.secondaryAccent;
      case 'unloading': return HUD_THEME.primaryAccent;
      case 'idle': return HUD_THEME.mutedColor;
      default: return HUD_THEME.bodyColor;
    }
  }

  // ─── Separator section ────────────────────────────────────────────

  private updateSeparatorSection(state: GameState): void {
    if (!this.separatorEl) return;

    if (state.economy.separators.length === 0) {
      this.separatorEl.innerHTML = `<div style="color:${HUD_THEME.dimColor};">${t('hud_noneBuilt')}</div>`;
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
        `<div><span style="color:${color}; font-weight:600;">${t('hud_separatorAbbr')} ${i + 1}:</span> ${label}${progressStr}</div>`,
      );
    }
    this.separatorEl.innerHTML = parts.join('');
  }

  private separatorStatusColor(status: string): string {
    switch (status) {
      case 'processing': return HUD_THEME.secondaryAccent;
      case 'idle': return HUD_THEME.mutedColor;
      default: return HUD_THEME.dangerColor; // blocked
    }
  }

  // ─── Factory section ──────────────────────────────────────────────

  private updateFactorySection(state: GameState): void {
    if (!this.factoryEl) return;

    if (state.production.factories.length === 0) {
      this.factoryEl.innerHTML = `<div style="color:${HUD_THEME.dimColor};">${t('hud_noneBuilt')}</div>`;
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
        queueStr = `<span style="color:${HUD_THEME.dimColor};">${t('hud_queueEmpty')}</span>`;
      } else {
        const slots: string[] = [];
        for (let qi = 0; qi < factory.queue.length; qi++) {
          const item = factory.queue[qi];
          const typeChar = item.unitType === 'builder' ? t('hud_builderAbbr') : t('hud_harvesterQAbbr');
          const pct = item.completed ? t('hud_done') : `${Math.round(item.progress * 100)}%`;
          // Cancel button for each queue item — uses data attributes for delegated handler
          // HUD-01: Styled consistently with the industrial sci-fi theme
          const cancelBtn = `<button data-fe-cancel data-factory-index="${i}" data-queue-index="${qi}" style="background:${HUD_THEME.dangerBg};border:1px solid ${HUD_THEME.dangerBorder};border-radius:2px;color:${HUD_THEME.dangerColor};font-size:8px;padding:1px 4px;cursor:pointer;margin-left:3px;outline:none;font-family:inherit;transition:background 0.15s;">X</button>`;
          slots.push(`${typeChar}${pct}${cancelBtn}`);
        }
        queueStr = `${t('hud_queue')}: ${slots.join(' ')}`;
      }

      // Spawn blockage reason (FIX-04)
      const spawnBlock = getFactorySpawnBlockReason(state, factory);
      let blockageStr = '';
      if (spawnBlock) {
        blockageStr = `<div style="margin-left:8px; font-size:10px; color:${HUD_THEME.dangerColor};">${t('hud_blocked')}: ${spawnBlockLabel(spawnBlock)}</div>`;
      }

      parts.push(
        `<div><span style="color:${color}; font-weight:600;">${t('hud_factoryAbbr')} ${i + 1}:</span> ${label}</div>` +
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
        return HUD_THEME.primaryAccent;
      case 'idle': return HUD_THEME.mutedColor;
      default: return HUD_THEME.dangerColor; // blocked
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
    const color = delta > 0 ? HUD_THEME.successColor : HUD_THEME.dangerColor;
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
      `<div>${t('hud_reachable')}: <span style="color:${v.reachableResourceCount >= 2 ? HUD_THEME.successColor : HUD_THEME.dangerColor};">${v.reachableResourceCount}</span>/${v.totalResourceCount}</div>`,
    );

    // Show warnings for failed checks
    // Critical checks (red warning): hq-adjacent-passable, reachable-resources, harvester-not-trapped
    // Soft informational check (muted): resources-not-in-impassable
    for (const check of v.checks) {
      if (!check.passed) {
        if (check.id === 'resources-not-in-impassable') {
          // Soft informational — show as muted, not a blocking warning
          parts.push(
            `<div style="color:${HUD_THEME.dimColor};">${t('hud_info')} ${check.message}</div>`,
          );
        } else {
          // Critical — show as red warning
          parts.push(
            `<div style="color:${HUD_THEME.dangerColor};">${t('hud_warning')} ${check.message}</div>`,
          );
        }
      }
    }

    // ARCH-14B: Quick hint about pause menu for controls reference
    parts.push(
      `<div style="margin-top:4px; color:${HUD_THEME.dimColor};">${t('hud_escPause')}</div>`,
    );

    this.diagnosticsEl.innerHTML = parts.join('');
  }
}
