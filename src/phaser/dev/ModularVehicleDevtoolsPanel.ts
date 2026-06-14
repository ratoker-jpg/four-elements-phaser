/**
 * ModularVehicleDevtoolsPanel — MODULAR-RUNTIME-01 QA/demo selector.
 *
 * Devtools-only DOM control surface for the GeneratedModularVehicleRenderer.
 * Exposes INDEPENDENT selectors for hullId, turretId, hullMod, turretMod
 * (faction is cyan-only in V1) plus hull/turret direction steppers.
 *
 * This is a QA/demo selector, NOT a manual calibration loop: there are no
 * pixel-offset controls. It follows the existing devtools panel style and
 * adds no query-string flags.
 */

import type { GeneratedModularVehicleRenderer } from '../render/GeneratedModularVehicleRenderer';
import {
  MODULAR_HULL_IDS,
  MODULAR_TURRET_IDS,
  MODULAR_MOD_IDS,
  type ModularHullId,
  type ModularTurretId,
  type ModularModId,
} from '../../modular/modularVehicleVisual';

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
    collapseLabel.textContent = '─';
    collapseLabel.style.cssText = 'font-size: 14px; color: #5aa07e;';
    this._collapseLabel = collapseLabel;

    header.appendChild(title);
    header.appendChild(collapseLabel);
    root.appendChild(header);

    const content = document.createElement('div');
    content.style.cssText = 'padding: 10px 12px;';

    this.openCloseBtn = this.makeButton('Open Preview', '#81c784', () => {
      this.callbacks?.getRenderer()?.toggle();
      this.refresh();
    });
    this.openCloseBtn.style.width = '100%';
    this.openCloseBtn.style.marginBottom = '8px';
    content.appendChild(this.openCloseBtn);

    // Hull id selector
    content.appendChild(this.makeRowLabel('Hull id (independent)'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('◀ hull', () => this.cycleHull(-1)),
        this.makeControlButton('hull ▶', () => this.cycleHull(1)),
      ]),
    );

    // Turret id selector
    content.appendChild(this.makeRowLabel('Turret id (independent)'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('◀ turret', () => this.cycleTurret(-1)),
        this.makeControlButton('turret ▶', () => this.cycleTurret(1)),
      ]),
    );

    // Hull mod / turret mod (independent)
    content.appendChild(this.makeRowLabel('Hull mod / Turret mod (independent)'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('hullMod+', () => this.cycleHullMod(1)),
        this.makeControlButton('turretMod+', () => this.cycleTurretMod(1)),
      ]),
    );

    // Directions
    content.appendChild(this.makeRowLabel('Hull dir / Turret dir (dir16)'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('◀ body', () => this.rendererCall((r) => r.cycleHullDir(-1))),
        this.makeControlButton('body ▶', () => this.rendererCall((r) => r.cycleHullDir(1))),
      ]),
    );
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('◀ turret', () => this.rendererCall((r) => r.cycleTurretDir(-1))),
        this.makeControlButton('turret ▶', () => this.rendererCall((r) => r.cycleTurretDir(1))),
      ]),
    );

    // Markers + reset
    content.appendChild(this.makeRowLabel('Diagnostics'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('markers', () => this.rendererCall((r) => r.toggleMarkers())),
        this.makeControlButton('Reset', () => this.rendererCall((r) => r.reset())),
      ]),
    );

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

    if (this.openCloseBtn) {
      this.openCloseBtn.textContent = s.active ? 'Close Preview' : 'Open Preview';
    }
    for (const btn of this.controlBtns) {
      btn.disabled = !s.active;
      btn.style.opacity = s.active ? '1' : '0.4';
      btn.style.cursor = s.active ? 'pointer' : 'default';
    }

    const avail =
      s.available === null ? '—' : s.available ? 'YES' : `NO (${s.fallbackReason ?? '?'})`;
    this.readoutEl.textContent = [
      `preview:  ${s.active ? 'OPEN' : 'closed'}`,
      `hull:     ${s.visual.hullId} / ${s.visual.hullMod}`,
      `turret:   ${s.visual.turretId} / ${s.visual.turretMod}`,
      `faction:  ${s.visual.faction}`,
      `dirs:     body ${s.hullDir16}  turret ${s.turretDir16}`,
      `loaded:   ${s.setLoaded}   queued: ${s.queuedCount ?? '—'}`,
      `available:${avail}`,
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

  // ─── DOM helpers (same pattern as legacy proof panel) ──────────────

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
    this._collapseLabel.textContent = this._collapsed ? '+' : '─';
  }

  private makeRowLabel(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'font-size: 10px; color: #6f9ad0; margin: 6px 0 3px;';
    return el;
  }

  private makeButtonRow(buttons: HTMLButtonElement[]): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 6px;';
    for (const b of buttons) {
      b.style.flex = '1';
      row.appendChild(b);
    }
    return row;
  }

  private makeControlButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = this.makeButton(text, '#80c0ff', onClick);
    this.controlBtns.push(btn);
    return btn;
  }

  private makeButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 5px 8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid ${color}55;
      border-radius: 4px;
      color: ${color};
      font-size: 11px;
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
