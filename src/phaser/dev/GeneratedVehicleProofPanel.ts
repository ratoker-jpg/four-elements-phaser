/**
 * @legacy Wasp/Smoky pilot-era proof harness panel.
 * Do not import into MODULAR-RUNTIME-* code paths.
 * The clean modular runtime must use src/modular/* + generated modular manifests.
 *
 * GeneratedVehicleProofPanel — DOM control surface for the MODULAR-PROOF-01
 * generated vehicle attachment proof harness.
 *
 * MODULAR-PROOF-01 fixup: the harness previously used B/N/G/M keyboard
 * controls, which conflicted with existing gameplay/debug hotkeys. Those
 * keyboard controls were removed. This panel replaces them with visible,
 * mouse-driven UI buttons, following the AssetPreviewPanel devtools style.
 *
 * Only created when devtools is enabled. The panel is a small docked widget
 * (top-right) so it can open/close the harness without any hotkey; `9`
 * remains only an optional open/close shortcut.
 *
 * Controls:
 *   - Open / Close harness
 *   - Body dir prev / next
 *   - Turret dir prev / next
 *   - Toggle zHeight diagnostic
 *   - Toggle markers / labels
 *   - Reset
 * Plus a live readout of the current body/turret direction, visual dir16,
 * zHeight diagnostic state, markers state, and availability/reason.
 */

import type { GeneratedVehicleProofHarness } from './GeneratedVehicleProofHarness';

export interface GeneratedVehicleProofPanelCallbacks {
  /** Get the harness instance. */
  getHarness: () => GeneratedVehicleProofHarness | null;
}

export class GeneratedVehicleProofPanel {
  private container: HTMLDivElement | null = null;
  private content: HTMLDivElement | null = null;
  private readoutEl: HTMLDivElement | null = null;
  private openCloseBtn: HTMLButtonElement | null = null;
  private controlBtns: HTMLButtonElement[] = [];
  private callbacks: GeneratedVehicleProofPanelCallbacks | null = null;
  private _visible = false;

  private _collapseLabel: HTMLSpanElement | null = null;
  private _collapsed = false;

  get visible(): boolean {
    return this._visible;
  }

  /** Create the panel DOM. Call once. */
  create(callbacks: GeneratedVehicleProofPanelCallbacks): void {
    this.destroy();
    this.callbacks = callbacks;

    const root = document.createElement('div');
    root.id = 'generated-vehicle-proof-panel';
    root.style.cssText = `
      position: fixed;
      top: 8px;
      right: 8px;
      width: 248px;
      background: rgba(12, 16, 30, 0.95);
      border: 1px solid rgba(74, 158, 255, 0.35);
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

    // ── Header (collapsible) ──
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(74, 158, 255, 0.15);
      background: rgba(74, 158, 255, 0.08);
      border-radius: 8px 8px 0 0;
    `;
    header.addEventListener('click', () => this.toggleCollapse());

    const title = document.createElement('span');
    title.textContent = 'Proof Harness [9]';
    title.style.cssText = 'font-weight: 700; font-size: 12px; color: #8ab4ff;';

    const collapseLabel = document.createElement('span');
    collapseLabel.textContent = '─';
    collapseLabel.style.cssText = 'font-size: 14px; color: #5a7ec0;';
    this._collapseLabel = collapseLabel;

    header.appendChild(title);
    header.appendChild(collapseLabel);
    root.appendChild(header);

    // ── Content ──
    const content = document.createElement('div');
    content.style.cssText = 'padding: 10px 12px;';

    // Open / Close
    this.openCloseBtn = this.makeButton('Open Harness', '#81c784', () => {
      this.callbacks?.getHarness()?.toggle();
      this.refresh();
    });
    this.openCloseBtn.style.width = '100%';
    this.openCloseBtn.style.marginBottom = '8px';
    content.appendChild(this.openCloseBtn);

    // Body direction row
    content.appendChild(this.makeRowLabel('Hull body dir (dir8)'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('◀ prev', () => this.harnessCall(h => h.cycleBodyDir(-1))),
        this.makeControlButton('next ▶', () => this.harnessCall(h => h.cycleBodyDir(1))),
      ]),
    );

    // Turret direction row
    content.appendChild(this.makeRowLabel('Turret dir (dir16)'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('◀ prev', () => this.harnessCall(h => h.cycleTurretDir(-1))),
        this.makeControlButton('next ▶', () => this.harnessCall(h => h.cycleTurretDir(1))),
      ]),
    );

    // Toggles row
    content.appendChild(this.makeRowLabel('Diagnostics'));
    content.appendChild(
      this.makeButtonRow([
        this.makeControlButton('zHeight diag', () => this.harnessCall(h => h.toggleZHeightDiagnostic())),
        this.makeControlButton('markers', () => this.harnessCall(h => h.toggleMarkers())),
      ]),
    );

    // Reset
    const resetBtn = this.makeControlButton('Reset', () => this.harnessCall(h => h.reset()));
    resetBtn.style.width = '100%';
    resetBtn.style.marginTop = '6px';
    content.appendChild(resetBtn);

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

  /** Show the panel (docked launcher; visible whenever devtools is active). */
  show(): void {
    if (this.container) {
      this.container.style.display = 'block';
      this._visible = true;
    }
    this.refresh();
  }

  /** Hide the panel. */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this._visible = false;
    }
  }

  /** Refresh the readout + control enabled state from the harness. */
  refresh(): void {
    const harness = this.callbacks?.getHarness();
    if (!harness || !this.readoutEl) return;
    const s = harness.getState();

    if (this.openCloseBtn) {
      this.openCloseBtn.textContent = s.active ? 'Close Harness' : 'Open Harness';
    }

    // Enable controls only while the harness is open
    for (const btn of this.controlBtns) {
      btn.disabled = !s.active;
      btn.style.opacity = s.active ? '1' : '0.4';
      btn.style.cursor = s.active ? 'pointer' : 'default';
    }

    const availability =
      s.available === null ? '—' : s.available ? 'YES' : `NO (${s.reason ?? '?'})`;
    this.readoutEl.textContent = [
      `harness:   ${s.active ? 'OPEN' : 'closed'}`,
      `body dir8:  ${s.bodyDir8}   (hull visual ${s.hullVisualDir16 ?? '—'})`,
      `turret d16: ${s.turretDir16}   (turret visual ${s.turretVisualDir16 ?? '—'})`,
      `zHeight:    ${s.zHeightDiagnostic ? 'DIAGNOSTIC ON' : 'ignored (default)'}`,
      `markers:    ${s.markersVisible ? 'on' : 'off'}`,
      `available:  ${availability}`,
    ].join('\n');
  }

  /** Remove the panel DOM. Call on shutdown. */
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

  // ─── Internal helpers ─────────────────────────────────────────────

  private harnessCall(fn: (h: GeneratedVehicleProofHarness) => void): void {
    const harness = this.callbacks?.getHarness();
    if (!harness) return;
    fn(harness);
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

  /** A control button that is disabled when the harness is closed. */
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
