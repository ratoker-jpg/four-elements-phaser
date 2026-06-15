/**
 * ModularVehicleDevtoolsPanel — MODULAR-ALL-FACTIONS-01C QA/calibration selector.
 *
 * Devtools-only DOM control surface for the GeneratedModularVehicleRenderer.
 * Exposes INDEPENDENT selectors for hullId, turretId, faction, hullMod,
 * turretMod plus hull/turret direction steppers, tile overlay toggle,
 * and preview calibration controls (modelScale, hullScale, turretScale,
 * hull/turret offsets, step size).
 *
 * Changing faction changes both hull and turret asset faction.
 * Changing hullId/turretId/hullMod/turretMod changes only that dimension.
 *
 * Calibration values are devtools-only and never persisted or applied to
 * production metadata/config.
 */

import type { GeneratedModularVehicleRenderer } from '../render/GeneratedModularVehicleRenderer';
import {
  MODULAR_HULL_IDS,
  MODULAR_TURRET_IDS,
  MODULAR_MOD_IDS,
  MODULAR_FACTION_IDS,
  type ModularHullId,
  type ModularTurretId,
  type ModularModId,
  type ModularFactionId,
} from '../../modular/modularVehicleVisual';
import {
  DEFAULT_MODULAR_PREVIEW_CALIBRATION,
  cyclePixelStep,
  cycleScaleStep,
  type ModularPreviewCalibration,
} from '../../modular/modularPreviewCalibration';
import {
  toggleModularVehicleRender,
  ENABLE_MODULAR_VEHICLE_RENDER,
} from '../render/ModularVehicleLiveAdapter';

export interface ModularVehicleDevtoolsPanelCallbacks {
  getRenderer: () => GeneratedModularVehicleRenderer | null;
}

export class ModularVehicleDevtoolsPanel {
  private container: HTMLDivElement | null = null;
  private content: HTMLDivElement | null = null;
  private readoutEl: HTMLDivElement | null = null;
  private openCloseBtn: HTMLButtonElement | null = null;
  private controlBtns: HTMLButtonElement[] = [];
  private callbacks: ModularVehicleDevtoolsPanelCallbacks | null = null;
  private _visible = false;
  private _collapseLabel: HTMLSpanElement | null = null;
  private _collapsed = false;
  private _liveRenderBtn: HTMLButtonElement | null = null;

  // Calibration state (devtools-only, not persisted)
  private calibration: ModularPreviewCalibration = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };

  get visible(): boolean {
    return this._visible;
  }

  create(callbacks: ModularVehicleDevtoolsPanelCallbacks): void {
    this.destroy();
    this.callbacks = callbacks;

    const root = document.createElement('div');
    root.id = 'modular-vehicle-devtools-panel';
    root.style.cssText = `
      position: fixed;
      top: 8px;
      right: 268px;
      width: 248px;
      max-height: 95vh;
      background: rgba(12, 16, 30, 0.95);
      border: 1px solid rgba(61, 255, 139, 0.32);
      border-radius: 8px;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #d4e4ff;
      z-index: 30;
      pointer-events: auto;
      user-select: none;
      display: none;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(61, 255, 139, 0.15);
      background: rgba(61, 255, 139, 0.07);
      border-radius: 8px 8px 0 0;
    `;
    header.addEventListener('click', () => this.toggleCollapse());

    const title = document.createElement('span');
    title.textContent = 'Modular Vehicle';
    title.style.cssText = 'font-weight: 700; font-size: 12px; color: #7be8a8;';

    const collapseLabel = document.createElement('span');
    collapseLabel.textContent = '\u2500';
    collapseLabel.style.cssText = 'font-size: 14px; color: #5aa07e;';
    this._collapseLabel = collapseLabel;

    header.appendChild(title);
    header.appendChild(collapseLabel);
    root.appendChild(header);

    // Scrollable content area
    const content = document.createElement('div');
    content.style.cssText = 'padding: 10px 12px; max-height: 85vh; overflow-y: auto;';

    this.openCloseBtn = this.makeButton('Open Preview', '#81c784', () => {
      this.callbacks?.getRenderer()?.toggle();
      this.refresh();
    });
    this.openCloseBtn.style.width = '100%';
    this.openCloseBtn.style.marginBottom = '8px';
    content.appendChild(this.openCloseBtn);

    // Selection section
    content.appendChild(this.makeSectionLabel('Selection'));

    content.appendChild(this.makeRowLabel('Faction (hull + turret)'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('\u25C0 faction', () => this.cycleFaction(-1)),
        this.makeControlButton('faction \u25B6', () => this.cycleFaction(1)),
      ]),
    );

    content.appendChild(this.makeRowLabel('Hull id'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('\u25C0 hull', () => this.cycleHull(-1)),
        this.makeControlButton('hull \u25B6', () => this.cycleHull(1)),
      ]),
    );

    content.appendChild(this.makeRowLabel('Turret id'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('\u25C0 turret', () => this.cycleTurret(-1)),
        this.makeControlButton('turret \u25B6', () => this.cycleTurret(1)),
      ]),
    );

    // Mods section
    content.appendChild(this.makeSectionLabel('Mods'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('hullMod+', () => this.cycleHullMod(1)),
        this.makeControlButton('turretMod+', () => this.cycleTurretMod(1)),
      ]),
    );

    // Direction section
    content.appendChild(this.makeSectionLabel('Direction'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('\u25C0 body', () => this.rendererCall((r) => r.cycleHullDir(-1))),
        this.makeControlButton('body \u25B6', () => this.rendererCall((r) => r.cycleHullDir(1))),
      ]),
    );
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('\u25C0 turret', () => this.rendererCall((r) => r.cycleTurretDir(-1))),
        this.makeControlButton('turret \u25B6', () => this.rendererCall((r) => r.cycleTurretDir(1))),
      ]),
    );

    // Overlay section
    content.appendChild(this.makeSectionLabel('Overlay'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('markers', () => this.rendererCall((r) => r.toggleMarkers())),
        this.makeControlButton('tile', () => this.toggleTile()),
      ]),
    );

    // Scale section
    content.appendChild(this.makeSectionLabel('Scale'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('model-', () => this.adjustScale('modelScale', -1)),
        this.makeControlButton('model+', () => this.adjustScale('modelScale', 1)),
      ]),
    );
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('hull-', () => this.adjustScale('hullScale', -1)),
        this.makeControlButton('hull+', () => this.adjustScale('hullScale', 1)),
      ]),
    );
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('turret-', () => this.adjustScale('turretScale', -1)),
        this.makeControlButton('turret+', () => this.adjustScale('turretScale', 1)),
      ]),
    );

    // Position section
    content.appendChild(this.makeSectionLabel('Position'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('hullX-', () => this.adjustOffset('hullOffsetX', -1)),
        this.makeControlButton('hullX+', () => this.adjustOffset('hullOffsetX', 1)),
      ]),
    );
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('hullY-', () => this.adjustOffset('hullOffsetY', -1)),
        this.makeControlButton('hullY+', () => this.adjustOffset('hullOffsetY', 1)),
      ]),
    );
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('turretX-', () => this.adjustOffset('turretOffsetX', -1)),
        this.makeControlButton('turretX+', () => this.adjustOffset('turretOffsetX', 1)),
      ]),
    );
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('turretY-', () => this.adjustOffset('turretOffsetY', -1)),
        this.makeControlButton('turretY+', () => this.adjustOffset('turretOffsetY', 1)),
      ]),
    );

    // Steps section
    content.appendChild(this.makeSectionLabel('Steps'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('px step', () => this.cyclePxStep()),
        this.makeControlButton('scale step', () => this.cycleScaleStepAction()),
      ]),
    );

    // Reset section
    content.appendChild(this.makeSectionLabel('Reset'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('reset cal', () => this.resetCalibration(), '#ff9966'),
        this.makeControlButton('reset sel', () => this.rendererCall((r) => r.reset()), '#81c784'),
      ]),
    );

    // MODULAR-RUNTIME-03A: Live render toggle
    content.appendChild(this.makeSectionLabel('Live Render (03A)'));
    this._liveRenderBtn = this.makeControlButton(
      `Live: ${ENABLE_MODULAR_VEHICLE_RENDER ? 'ON' : 'OFF'}`,
      () => {
        toggleModularVehicleRender();
        this.refresh();
      },
      ENABLE_MODULAR_VEHICLE_RENDER ? '#44ff88' : '#ff8844',
    );
    content.appendChild(
      this.makeButtonRow([this._liveRenderBtn]),
    );

    // Readout
    this.readoutEl = document.createElement('div');
    this.readoutEl.style.cssText = `
      margin-top: 10px;
      padding: 6px 8px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 4px;
      font-family: monospace;
      font-size: 10px;
      line-height: 1.5;
      color: #a8c4e8;
      white-space: pre-line;
    `;
    content.appendChild(this.readoutEl);

    root.appendChild(content);
    document.body.appendChild(root);
    this.container = root;
    this.content = content;
  }

  show(): void {
    if (this.container) {
      this.container.style.display = 'block';
      this._visible = true;
    }
    this.refresh();
  }

  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this._visible = false;
    }
  }

  refresh(): void {
    const renderer = this.callbacks?.getRenderer();
    if (!renderer || !this.readoutEl) return;
    const s = renderer.getState();

    // Sync calibration state from renderer.
    this.calibration = { ...s.calibration };

    if (this.openCloseBtn) {
      this.openCloseBtn.textContent = s.active ? 'Close Preview' : 'Open Preview';
    }
    // MODULAR-RUNTIME-03A: Sync Live Render button to actual flag state
    if (this._liveRenderBtn) {
      this._liveRenderBtn.textContent = `Live: ${ENABLE_MODULAR_VEHICLE_RENDER ? 'ON' : 'OFF'}`;
      this._liveRenderBtn.style.color = ENABLE_MODULAR_VEHICLE_RENDER ? '#44ff88' : '#ff8844';
      this._liveRenderBtn.style.borderColor = ENABLE_MODULAR_VEHICLE_RENDER ? '#44ff8855' : '#ff884455';
    }
    for (const btn of this.controlBtns) {
      btn.disabled = !s.active;
      btn.style.opacity = s.active ? '1' : '0.4';
      btn.style.cursor = s.active ? 'pointer' : 'default';
    }

    const cal = s.calibration;
    const avail =
      s.available === null ? '\u2014' : s.available ? 'YES' : `NO (${s.fallbackReason ?? '?'})`;
    this.readoutEl.textContent = [
      `preview:  ${s.active ? 'OPEN' : 'closed'}`,
      `hull:     ${s.visual.hullId} / ${s.visual.hullMod}`,
      `turret:   ${s.visual.turretId} / ${s.visual.turretMod}`,
      `faction:  ${s.visual.faction}`,
      `dirs:     body ${s.hullDir16}  turret ${s.turretDir16}`,
      `loaded:   ${s.setLoaded}   queued: ${s.queuedCount ?? '\u2014'}`,
      `available:${avail}`,
      '',
      `tile: ${cal.showTile ? 'ON' : 'OFF'}  markers: ${s.markersVisible ? 'ON' : 'OFF'}`,
      `model: ${cal.modelScale.toFixed(2)}  hull: ${cal.hullScale.toFixed(2)}  turret: ${cal.turretScale.toFixed(2)}`,
      `hullOff: ${cal.hullOffsetX},${cal.hullOffsetY}`,
      `turretOff: ${cal.turretOffsetX},${cal.turretOffsetY}`,
      `pxStep: ${cal.pixelStep}  scaleStep: ${cal.scaleStep}`,
    ].join('\n');
  }

  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.content = null;
    this.readoutEl = null;
    this.openCloseBtn = null;
    this.controlBtns = [];
    this._collapseLabel = null;
    this._collapsed = false;
    this._liveRenderBtn = null;
    this.callbacks = null;
    this._visible = false;
  }

  // ─── Selection logic ──────────────────────────────────────────────

  private cycleHull(delta: number): void {
    this.rendererCall((r) => {
      const cur = r.getState().visual.hullId;
      const next = cycleInList(MODULAR_HULL_IDS, cur, delta) as ModularHullId;
      r.patchVisual({ hullId: next });
    });
  }

  private cycleTurret(delta: number): void {
    this.rendererCall((r) => {
      const cur = r.getState().visual.turretId;
      const next = cycleInList(MODULAR_TURRET_IDS, cur, delta) as ModularTurretId;
      r.patchVisual({ turretId: next });
    });
  }

  private cycleFaction(delta: number): void {
    this.rendererCall((r) => {
      const cur = r.getState().visual.faction;
      const next = cycleInList(MODULAR_FACTION_IDS, cur, delta) as ModularFactionId;
      r.patchVisual({ faction: next });
    });
  }

  private cycleHullMod(delta: number): void {
    this.rendererCall((r) => {
      const cur = r.getState().visual.hullMod;
      const next = cycleInList(MODULAR_MOD_IDS, cur, delta) as ModularModId;
      r.patchVisual({ hullMod: next });
    });
  }

  private cycleTurretMod(delta: number): void {
    this.rendererCall((r) => {
      const cur = r.getState().visual.turretMod;
      const next = cycleInList(MODULAR_MOD_IDS, cur, delta) as ModularModId;
      r.patchVisual({ turretMod: next });
    });
  }

  // ─── Calibration logic ────────────────────────────────────────────

  private pushCalibration(): void {
    this.rendererCall((r) => r.setCalibration(this.calibration));
  }

  private toggleTile(): void {
    this.calibration.showTile = !this.calibration.showTile;
    this.pushCalibration();
  }

  private adjustScale(key: 'modelScale' | 'hullScale' | 'turretScale', dir: 1 | -1): void {
    this.calibration[key] = Math.max(0.1, +(this.calibration[key] + dir * this.calibration.scaleStep).toFixed(4));
    this.pushCalibration();
  }

  private adjustOffset(key: 'hullOffsetX' | 'hullOffsetY' | 'turretOffsetX' | 'turretOffsetY', dir: 1 | -1): void {
    this.calibration[key] = this.calibration[key] + dir * this.calibration.pixelStep;
    this.pushCalibration();
  }

  private cyclePxStep(): void {
    this.calibration.pixelStep = cyclePixelStep(this.calibration.pixelStep);
    this.pushCalibration();
  }

  private cycleScaleStepAction(): void {
    this.calibration.scaleStep = cycleScaleStep(this.calibration.scaleStep);
    this.pushCalibration();
  }

  private resetCalibration(): void {
    this.calibration = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };
    this.rendererCall((r) => r.resetCalibration());
  }

  // ─── DOM helpers ──────────────────────────────────────────────────

  private rendererCall(fn: (r: GeneratedModularVehicleRenderer) => void): void {
    const renderer = this.callbacks?.getRenderer();
    if (!renderer) return;
    fn(renderer);
    this.refresh();
  }

  private toggleCollapse(): void {
    if (!this.content || !this._collapseLabel) return;
    this._collapsed = !this._collapsed;
    this.content.style.display = this._collapsed ? 'none' : 'block';
    this._collapseLabel.textContent = this._collapsed ? '+' : '\u2500';
  }

  private makeSectionLabel(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = `\u2500\u2500 ${text} \u2500\u2500`;
    el.style.cssText = 'font-size: 10px; color: #5aa07e; margin: 8px 0 3px; font-weight: 600; border-bottom: 1px solid rgba(61,255,139,0.1); padding-bottom: 2px;';
    return el;
  }

  private makeRowLabel(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'font-size: 10px; color: #6f9ad0; margin: 4px 0 2px;';
    return el;
  }

  private makeButtonRow(buttons: HTMLButtonElement[]): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 4px;';
    for (const b of buttons) {
      b.style.flex = '1';
      row.appendChild(b);
    }
    return row;
  }

  private makeControlButton(text: string, onClick: () => void, color?: string): HTMLButtonElement {
    const btn = this.makeButton(text, color ?? '#80c0ff', onClick);
    this.controlBtns.push(btn);
    return btn;
  }

  private makeButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 4px 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid ${color}55;
      border-radius: 4px;
      color: ${color};
      font-size: 10px;
      cursor: pointer;
      transition: background 0.15s;
    `;
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) btn.style.background = `${color}22`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.04)';
    });
    btn.addEventListener('click', () => {
      if (!btn.disabled) onClick();
    });
    return btn;
  }
}

/** Cycle a value within a readonly list by delta (wraps). */
function cycleInList<T extends string>(
  list: readonly T[],
  current: T,
  delta: number,
): T {
  const idx = list.indexOf(current);
  const base = idx < 0 ? 0 : idx;
  const next = (((base + delta) % list.length) + list.length) % list.length;
  return list[next];
}
