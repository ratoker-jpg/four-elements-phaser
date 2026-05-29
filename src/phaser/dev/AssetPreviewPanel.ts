/**
 * AssetPreviewPanel — DOM overlay for the dev asset preview tool.
 *
 * DEV-ASSET-PREVIEW-01: Provides UI for uploading files, selecting assets,
 * adjusting scale/footprint, and managing preview placements.
 * Only created when devtools is enabled.
 *
 * DEV-ASSET-PREVIEW-03: Extended chroma-key controls — custom HEX color,
 * tolerance slider, color picker, and reprocess buttons (Apply to selected,
 * Apply to all, Reset).
 *
 * Lifecycle:
 * - Created by GameScene when devtools is enabled.
 * - Toggle visibility via hotkey `0` or panel button.
 * - destroy() called in GameScene shutdown().
 */

import type { AssetPreviewTool, PreviewFootprint, ChromaKeyConfig } from './AssetPreviewTool';
import {
  normalizeHexColor,
  createChromaKeyConfigFromHex,
  DEFAULT_CHROMA_KEY_HEX,
  DEFAULT_CHROMA_KEY_TOLERANCE,
} from './AssetPreviewTool';

// ─── Types ──────────────────────────────────────────────────────────

/** Callbacks provided by GameScene for panel actions. */
export interface AssetPreviewPanelCallbacks {
  /** Get the AssetPreviewTool instance. */
  getTool: () => AssetPreviewTool | null;
}

// ─── AssetPreviewPanel class ────────────────────────────────────────

export class AssetPreviewPanel {
  private container: HTMLDivElement | null = null;
  private content: HTMLDivElement | null = null;
  private assetListEl: HTMLDivElement | null = null;
  private placementListEl: HTMLDivElement | null = null;
  private scaleSlider: HTMLInputElement | null = null;
  private scaleValueEl: HTMLSpanElement | null = null;
  private footprintBtns: Map<number, HTMLButtonElement> = new Map();
  private statusEl: HTMLDivElement | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private _visible = false;
  private callbacks: AssetPreviewPanelCallbacks | null = null;

  /** Current scale value for new placements. */
  private currentScale = 1;

  /** Current footprint value for new placements. */
  private currentFootprint: PreviewFootprint = 1;

  // ── Chroma-key controls (DEV-ASSET-PREVIEW-03) ───────────────────
  private chromaKeyCheckbox: HTMLInputElement | null = null;
  private chromaKeyHexInput: HTMLInputElement | null = null;
  private chromaKeyColorPicker: HTMLInputElement | null = null;
  private chromaKeyToleranceSlider: HTMLInputElement | null = null;
  private chromaKeyToleranceValue: HTMLSpanElement | null = null;

  /** Current chroma-key toggle state. */
  private currentChromaKey = false;

  /** Current chroma-key HEX color (normalized uppercase #RRGGBB). */
  private currentChromaKeyHex = DEFAULT_CHROMA_KEY_HEX;

  /** Current chroma-key tolerance. */
  private currentChromaKeyTolerance = DEFAULT_CHROMA_KEY_TOLERANCE;

  /** Whether the panel is currently visible. */
  get visible(): boolean {
    return this._visible;
  }

  /** Get the current scale value for new placements. */
  getCurrentScale(): number {
    return this.currentScale;
  }

  /** Get the current footprint value for new placements. */
  getCurrentFootprint(): PreviewFootprint {
    return this.currentFootprint;
  }

  /**
   * DEV-ASSET-PREVIEW-03: Build a ChromaKeyConfig from current panel
   * state if chroma-key is enabled. Returns null if disabled or HEX invalid.
   */
  getCurrentChromaKeyConfig(): ChromaKeyConfig | null {
    if (!this.currentChromaKey) return null;
    return createChromaKeyConfigFromHex(this.currentChromaKeyHex, this.currentChromaKeyTolerance);
  }

  /**
   * Create the panel DOM. Call once.
   */
  create(callbacks: AssetPreviewPanelCallbacks): void {
    this.destroy();
    this.callbacks = callbacks;

    const root = document.createElement('div');
    root.id = 'asset-preview-panel';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 380px;
      max-height: calc(100vh - 80px);
      background: rgba(20, 10, 30, 0.95);
      border: 1px solid rgba(255, 0, 255, 0.3);
      border-radius: 8px;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #e0b0ff;
      z-index: 30;
      pointer-events: auto;
      user-select: none;
      overflow-y: auto;
      display: none;
    `;

    // ── Header ───────────────────────────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(255, 0, 255, 0.15);
      background: rgba(255, 0, 255, 0.08);
      border-radius: 8px 8px 0 0;
    `;
    header.addEventListener('click', () => this.toggleCollapse());

    const title = document.createElement('span');
    title.textContent = 'Asset Preview [0]';
    title.style.cssText = 'font-weight: 700; font-size: 12px; color: #ff80ff;';

    const collapseLabel = document.createElement('span');
    collapseLabel.textContent = '\u2500';
    collapseLabel.style.cssText = 'font-size: 14px; color: #a060c0;';
    this._collapseLabel = collapseLabel;

    header.appendChild(title);
    header.appendChild(collapseLabel);
    root.appendChild(header);

    // ── Content ──────────────────────────────────────────────────
    const content = document.createElement('div');
    content.style.cssText = 'padding: 10px 12px;';

    // ── Upload section ───────────────────────────────────────────
    const uploadTitle = document.createElement('div');
    uploadTitle.textContent = 'Upload';
    uploadTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #ff80ff;';
    content.appendChild(uploadTitle);

    const uploadRow = document.createElement('div');
    uploadRow.style.cssText = 'display: flex; gap: 6px; align-items: center; margin-bottom: 6px;';

    // File upload button (styled label over hidden input)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp';
    fileInput.multiple = true;
    fileInput.style.cssText = 'display: none;';
    fileInput.addEventListener('change', () => this.handleFileUpload(fileInput));

    const uploadBtn = document.createElement('label');
    uploadBtn.textContent = 'Upload Files';
    uploadBtn.style.cssText = `
      padding: 4px 10px;
      background: rgba(255, 0, 255, 0.15);
      border: 1px solid rgba(255, 0, 255, 0.4);
      border-radius: 4px;
      color: #ff80ff;
      font-size: 10px;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s;
    `;
    uploadBtn.addEventListener('mouseenter', () => {
      uploadBtn.style.background = 'rgba(255, 0, 255, 0.3)';
    });
    uploadBtn.addEventListener('mouseleave', () => {
      uploadBtn.style.background = 'rgba(255, 0, 255, 0.15)';
    });
    uploadBtn.appendChild(fileInput);
    uploadRow.appendChild(uploadBtn);
    content.appendChild(uploadRow);

    // ── Chroma-key control group (DEV-ASSET-PREVIEW-03) ──────────
    const ckTitle = document.createElement('div');
    ckTitle.textContent = 'Chroma-Key';
    ckTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #ff80ff;';
    content.appendChild(ckTitle);

    const ckBox = document.createElement('div');
    ckBox.style.cssText = `
      background: rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      padding: 6px 8px;
      margin-bottom: 8px;
    `;

    // Row 1: Enable checkbox
    const ckRow1 = document.createElement('div');
    ckRow1.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 4px;';

    const chromaLabel = document.createElement('label');
    chromaLabel.style.cssText = 'display: flex; align-items: center; gap: 3px; font-size: 10px; color: #c090e0; cursor: pointer;';
    this.chromaKeyCheckbox = document.createElement('input');
    this.chromaKeyCheckbox.type = 'checkbox';
    this.chromaKeyCheckbox.checked = false;
    this.chromaKeyCheckbox.style.cssText = 'cursor: pointer;';
    this.chromaKeyCheckbox.addEventListener('change', () => {
      this.currentChromaKey = this.chromaKeyCheckbox!.checked;
      this.updateChromaKeyControlsState();
    });
    chromaLabel.appendChild(this.chromaKeyCheckbox);
    chromaLabel.appendChild(document.createTextNode('Enabled'));
    ckRow1.appendChild(chromaLabel);
    ckBox.appendChild(ckRow1);

    // Row 2: HEX input + color picker
    const ckRow2 = document.createElement('div');
    ckRow2.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 4px;';

    const hexLabel = document.createElement('span');
    hexLabel.textContent = 'Color:';
    hexLabel.style.cssText = 'font-size: 10px; color: #c0a0d0; min-width: 36px;';
    ckRow2.appendChild(hexLabel);

    this.chromaKeyHexInput = document.createElement('input');
    this.chromaKeyHexInput.type = 'text';
    this.chromaKeyHexInput.value = DEFAULT_CHROMA_KEY_HEX;
    this.chromaKeyHexInput.maxLength = 7;
    this.chromaKeyHexInput.style.cssText = `
      width: 72px;
      padding: 2px 4px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 0, 255, 0.3);
      border-radius: 3px;
      color: #ff80ff;
      font-size: 10px;
      font-family: monospace;
    `;
    this.chromaKeyHexInput.addEventListener('input', () => {
      this.onHexInputChanged();
    });
    this.chromaKeyHexInput.addEventListener('change', () => {
      this.onHexInputFinalized();
    });
    ckRow2.appendChild(this.chromaKeyHexInput);

    this.chromaKeyColorPicker = document.createElement('input');
    this.chromaKeyColorPicker.type = 'color';
    this.chromaKeyColorPicker.value = '#ff00ff';
    this.chromaKeyColorPicker.style.cssText = `
      width: 24px;
      height: 20px;
      padding: 0;
      border: 1px solid rgba(255, 0, 255, 0.3);
      border-radius: 3px;
      cursor: pointer;
      background: transparent;
    `;
    this.chromaKeyColorPicker.addEventListener('input', () => {
      this.onColorPickerChanged();
    });
    ckRow2.appendChild(this.chromaKeyColorPicker);
    ckBox.appendChild(ckRow2);

    // Row 3: Tolerance slider
    const ckRow3 = document.createElement('div');
    ckRow3.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 4px;';

    const tolLabel = document.createElement('span');
    tolLabel.textContent = 'Tol:';
    tolLabel.style.cssText = 'font-size: 10px; color: #c0a0d0; min-width: 36px;';
    ckRow3.appendChild(tolLabel);

    this.chromaKeyToleranceSlider = document.createElement('input');
    this.chromaKeyToleranceSlider.type = 'range';
    this.chromaKeyToleranceSlider.min = '0';
    this.chromaKeyToleranceSlider.max = '96';
    this.chromaKeyToleranceSlider.step = '1';
    this.chromaKeyToleranceSlider.value = String(DEFAULT_CHROMA_KEY_TOLERANCE);
    this.chromaKeyToleranceSlider.style.cssText = 'flex: 1; cursor: pointer;';
    this.chromaKeyToleranceSlider.addEventListener('input', () => {
      this.currentChromaKeyTolerance = parseInt(this.chromaKeyToleranceSlider!.value, 10);
      if (this.chromaKeyToleranceValue) {
        this.chromaKeyToleranceValue.textContent = String(this.currentChromaKeyTolerance);
      }
    });
    ckRow3.appendChild(this.chromaKeyToleranceSlider);

    this.chromaKeyToleranceValue = document.createElement('span');
    this.chromaKeyToleranceValue.textContent = String(DEFAULT_CHROMA_KEY_TOLERANCE);
    this.chromaKeyToleranceValue.style.cssText = 'font-size: 10px; color: #80c0ff; min-width: 22px;';
    ckRow3.appendChild(this.chromaKeyToleranceValue);
    ckBox.appendChild(ckRow3);

    // Row 4: Action buttons
    const ckRow4 = document.createElement('div');
    ckRow4.style.cssText = 'display: flex; gap: 4px; margin-top: 2px;';

    const applySelectedBtn = document.createElement('button');
    applySelectedBtn.textContent = 'Apply to selected';
    applySelectedBtn.style.cssText = `
      flex: 1;
      padding: 3px 4px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(128, 192, 255, 0.3);
      border-radius: 3px;
      color: #80c0ff;
      font-size: 9px;
      cursor: pointer;
      transition: background 0.15s;
    `;
    applySelectedBtn.addEventListener('mouseenter', () => {
      applySelectedBtn.style.background = 'rgba(128, 192, 255, 0.15)';
    });
    applySelectedBtn.addEventListener('mouseleave', () => {
      applySelectedBtn.style.background = 'rgba(255, 255, 255, 0.04)';
    });
    applySelectedBtn.addEventListener('click', () => this.applyChromaKeyToSelected());
    ckRow4.appendChild(applySelectedBtn);

    const applyAllBtn = document.createElement('button');
    applyAllBtn.textContent = 'Apply to all';
    applyAllBtn.style.cssText = `
      flex: 1;
      padding: 3px 4px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(129, 199, 132, 0.3);
      border-radius: 3px;
      color: #81c784;
      font-size: 9px;
      cursor: pointer;
      transition: background 0.15s;
    `;
    applyAllBtn.addEventListener('mouseenter', () => {
      applyAllBtn.style.background = 'rgba(129, 199, 132, 0.15)';
    });
    applyAllBtn.addEventListener('mouseleave', () => {
      applyAllBtn.style.background = 'rgba(255, 255, 255, 0.04)';
    });
    applyAllBtn.addEventListener('click', () => this.applyChromaKeyToAll());
    ckRow4.appendChild(applyAllBtn);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset #FF00FF';
    resetBtn.style.cssText = `
      flex: 1;
      padding: 3px 4px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(239, 154, 154, 0.3);
      border-radius: 3px;
      color: #ef9a9a;
      font-size: 9px;
      cursor: pointer;
      transition: background 0.15s;
    `;
    resetBtn.addEventListener('mouseenter', () => {
      resetBtn.style.background = 'rgba(239, 154, 154, 0.15)';
    });
    resetBtn.addEventListener('mouseleave', () => {
      resetBtn.style.background = 'rgba(255, 255, 255, 0.04)';
    });
    resetBtn.addEventListener('click', () => this.resetChromaKey());
    ckRow4.appendChild(resetBtn);

    ckBox.appendChild(ckRow4);
    content.appendChild(ckBox);

    // ── Asset list ───────────────────────────────────────────────
    const assetTitle = document.createElement('div');
    assetTitle.textContent = 'Uploaded Assets';
    assetTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #b080e0;';
    content.appendChild(assetTitle);

    this.assetListEl = document.createElement('div');
    this.assetListEl.style.cssText = `
      max-height: 100px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      padding: 4px 6px;
      margin-bottom: 8px;
      font-size: 10px;
      line-height: 1.6;
      color: #c0a0d0;
    `;
    this.assetListEl.innerHTML = '<div style="color:#666;">No assets uploaded</div>';
    content.appendChild(this.assetListEl);

    // ── Controls section ─────────────────────────────────────────
    const ctrlTitle = document.createElement('div');
    ctrlTitle.textContent = 'Placement Controls';
    ctrlTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #80c0ff;';
    content.appendChild(ctrlTitle);

    // Scale slider
    const scaleRow = document.createElement('div');
    scaleRow.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 6px;';
    scaleRow.appendChild(this.makeLabel('Scale:'));
    this.scaleSlider = document.createElement('input');
    this.scaleSlider.type = 'range';
    this.scaleSlider.min = '0.1';
    this.scaleSlider.max = '3.0';
    this.scaleSlider.step = '0.1';
    this.scaleSlider.value = '1';
    this.scaleSlider.style.cssText = 'flex: 1; cursor: pointer;';
    this.scaleSlider.addEventListener('input', () => {
      this.currentScale = parseFloat(this.scaleSlider!.value);
      if (this.scaleValueEl) {
        this.scaleValueEl.textContent = `${this.currentScale.toFixed(1)}x`;
      }
      this.applyScaleToSelected();
    });
    scaleRow.appendChild(this.scaleSlider);
    this.scaleValueEl = document.createElement('span');
    this.scaleValueEl.textContent = '1.0x';
    this.scaleValueEl.style.cssText = 'font-size: 10px; color: #80c0ff; min-width: 30px;';
    scaleRow.appendChild(this.scaleValueEl);
    content.appendChild(scaleRow);

    // Footprint selector
    const fpRow = document.createElement('div');
    fpRow.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 6px;';
    fpRow.appendChild(this.makeLabel('Footprint:'));
    for (const fp of [1, 2, 3] as PreviewFootprint[]) {
      const btn = document.createElement('button');
      btn.textContent = `${fp}x${fp}`;
      btn.style.cssText = `
        padding: 3px 8px;
        background: ${fp === this.currentFootprint ? 'rgba(128, 192, 255, 0.3)' : 'rgba(255, 255, 255, 0.04)'};
        border: 1px solid rgba(128, 192, 255, 0.3);
        border-radius: 3px;
        color: #80c0ff;
        font-size: 10px;
        cursor: pointer;
        transition: background 0.15s;
      `;
      btn.addEventListener('click', () => {
        this.currentFootprint = fp;
        this.updateFootprintButtons();
        this.applyFootprintToSelected();
      });
      fpRow.appendChild(btn);
      this.footprintBtns.set(fp, btn);
    }
    content.appendChild(fpRow);

    // ── Placement list ───────────────────────────────────────────
    const placeTitle = document.createElement('div');
    placeTitle.textContent = 'Placed Previews';
    placeTitle.style.cssText = 'font-weight: 600; font-size: 11px; margin-bottom: 4px; color: #81c784;';
    content.appendChild(placeTitle);

    this.placementListEl = document.createElement('div');
    this.placementListEl.style.cssText = `
      max-height: 120px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      padding: 4px 6px;
      margin-bottom: 8px;
      font-size: 10px;
      line-height: 1.6;
      color: #a0d0a0;
    `;
    this.placementListEl.innerHTML = '<div style="color:#666;">No placements yet</div>';
    content.appendChild(this.placementListEl);

    // ── Action buttons ───────────────────────────────────────────
    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 6px;';

    const deleteBtn = this.makeButton('Delete Selected', '#ef9a9a', () => this.deleteSelected());
    const clearBtn = this.makeButton('Clear All', '#ef9a9a', () => this.clearAll());
    actionRow.appendChild(deleteBtn);
    actionRow.appendChild(clearBtn);
    content.appendChild(actionRow);

    // ── Status feedback ──────────────────────────────────────────
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = `
      min-height: 14px;
      font-size: 10px;
      text-align: center;
      transition: opacity 0.3s;
      opacity: 0;
    `;
    content.appendChild(this.statusEl);

    // ── Hint ─────────────────────────────────────────────────────
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size: 9px; color: #666; margin-top: 4px; text-align: center;';
    hint.textContent = 'Click asset \u2192 click map to place. Click placed preview to select \u2192 click map to move.';
    content.appendChild(hint);

    root.appendChild(content);
    document.body.appendChild(root);
    this.container = root;
    this.content = content;

    // Set initial disabled state for chroma-key controls
    this.updateChromaKeyControlsState();
  }

  /** Show the panel. */
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

  /** Toggle panel visibility. */
  toggle(): void {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Refresh the panel content from the tool state. */
  refresh(): void {
    this.updateAssetList();
    this.updatePlacementList();
  }

  /** Remove the panel DOM. Call on shutdown. */
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
    this.assetListEl = null;
    this.placementListEl = null;
    this.scaleSlider = null;
    this.scaleValueEl = null;
    this.chromaKeyCheckbox = null;
    this.chromaKeyHexInput = null;
    this.chromaKeyColorPicker = null;
    this.chromaKeyToleranceSlider = null;
    this.chromaKeyToleranceValue = null;
    this.statusEl = null;
    this.footprintBtns.clear();
    this.callbacks = null;
    this._visible = false;
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private _collapseLabel: HTMLSpanElement | null = null;
  private _collapsed = false;

  private toggleCollapse(): void {
    if (!this.content || !this._collapseLabel) return;
    this._collapsed = !this._collapsed;
    this.content.style.display = this._collapsed ? 'none' : 'block';
    this._collapseLabel.textContent = this._collapsed ? '+' : '\u2500';
  }

  // ── Chroma-key control helpers (DEV-ASSET-PREVIEW-03) ───────────

  /** Enable/disable chroma-key sub-controls based on checkbox state. */
  private updateChromaKeyControlsState(): void {
    const enabled = this.currentChromaKey;
    if (this.chromaKeyHexInput) this.chromaKeyHexInput.disabled = !enabled;
    if (this.chromaKeyColorPicker) this.chromaKeyColorPicker.disabled = !enabled;
    if (this.chromaKeyToleranceSlider) this.chromaKeyToleranceSlider.disabled = !enabled;
    // Visual feedback for disabled state
    const opacity = enabled ? '1' : '0.4';
    if (this.chromaKeyHexInput) this.chromaKeyHexInput.style.opacity = opacity;
    if (this.chromaKeyColorPicker) this.chromaKeyColorPicker.style.opacity = opacity;
    if (this.chromaKeyToleranceSlider) this.chromaKeyToleranceSlider.style.opacity = opacity;
  }

  /** Handle HEX text input changes (live sync to color picker). */
  private onHexInputChanged(): void {
    if (!this.chromaKeyHexInput) return;
    const raw = this.chromaKeyHexInput.value;
    const normalized = normalizeHexColor(raw);
    if (normalized) {
      this.currentChromaKeyHex = normalized;
      // Sync color picker (requires lowercase #rrggbb for input[type=color])
      if (this.chromaKeyColorPicker) {
        this.chromaKeyColorPicker.value = normalized.toLowerCase();
      }
    }
  }

  /** Handle HEX text input finalization (blur/enter) — normalize display. */
  private onHexInputFinalized(): void {
    if (!this.chromaKeyHexInput) return;
    const raw = this.chromaKeyHexInput.value;
    const normalized = normalizeHexColor(raw);
    if (normalized) {
      this.currentChromaKeyHex = normalized;
      this.chromaKeyHexInput.value = normalized;
    } else {
      // Invalid HEX — revert to current valid value
      this.chromaKeyHexInput.value = this.currentChromaKeyHex;
      this.showStatus('Invalid HEX color — reverted', false);
    }
  }

  /** Handle color picker changes (sync to HEX input). */
  private onColorPickerChanged(): void {
    if (!this.chromaKeyColorPicker) return;
    const raw = this.chromaKeyColorPicker.value; // #rrggbb lowercase
    const normalized = normalizeHexColor(raw);
    if (normalized) {
      this.currentChromaKeyHex = normalized;
      if (this.chromaKeyHexInput) {
        this.chromaKeyHexInput.value = normalized;
      }
    }
  }

  /** Apply current chroma-key config to the selected placement's asset. */
  private async applyChromaKeyToSelected(): Promise<void> {
    if (!this.currentChromaKey) {
      this.showStatus('Chroma-key is disabled — enable it first', false);
      return;
    }

    const config = this.getCurrentChromaKeyConfig();
    if (!config) {
      this.showStatus('Invalid HEX color — fix before applying', false);
      return;
    }

    const tool = this.callbacks?.getTool();
    if (!tool) return;

    const selected = tool.getSelectedPlacement();
    if (!selected) {
      this.showStatus('No placement selected — select one first', false);
      return;
    }

    // Find the asset for this placement
    const asset = tool.getAssetForPlacement(selected.id);
    if (!asset) {
      this.showStatus('Asset not found for selected placement', false);
      return;
    }

    const ok = await tool.reprocessAsset(asset.id, config);
    if (ok) {
      // Update the placement's chromaKeyConfig too
      selected.chromaKey = true;
      this.showStatus(`Applied ${this.currentChromaKeyHex} tol=${this.currentChromaKeyTolerance} to selected`, true);
    } else {
      this.showStatus('Reprocess failed — check console', false);
    }
    this.refresh();
  }

  /** Apply current chroma-key config to all uploaded assets. */
  private async applyChromaKeyToAll(): Promise<void> {
    if (!this.currentChromaKey) {
      this.showStatus('Chroma-key is disabled — enable it first', false);
      return;
    }

    const config = this.getCurrentChromaKeyConfig();
    if (!config) {
      this.showStatus('Invalid HEX color — fix before applying', false);
      return;
    }

    const tool = this.callbacks?.getTool();
    if (!tool) return;

    const assets = tool.getAssets();
    if (assets.length === 0) {
      this.showStatus('No assets to reprocess', false);
      return;
    }

    const count = await tool.reprocessAllAssets(config);
    this.showStatus(`Applied ${this.currentChromaKeyHex} tol=${this.currentChromaKeyTolerance} to ${count}/${assets.length} asset(s)`, count > 0);
    this.refresh();
  }

  /** Reset chroma-key color and tolerance to defaults. */
  private resetChromaKey(): void {
    this.currentChromaKeyHex = DEFAULT_CHROMA_KEY_HEX;
    this.currentChromaKeyTolerance = DEFAULT_CHROMA_KEY_TOLERANCE;
    if (this.chromaKeyHexInput) this.chromaKeyHexInput.value = DEFAULT_CHROMA_KEY_HEX;
    if (this.chromaKeyColorPicker) this.chromaKeyColorPicker.value = '#ff00ff';
    if (this.chromaKeyToleranceSlider) this.chromaKeyToleranceSlider.value = String(DEFAULT_CHROMA_KEY_TOLERANCE);
    if (this.chromaKeyToleranceValue) this.chromaKeyToleranceValue.textContent = String(DEFAULT_CHROMA_KEY_TOLERANCE);
    this.showStatus(`Reset to ${DEFAULT_CHROMA_KEY_HEX} tol=${DEFAULT_CHROMA_KEY_TOLERANCE}`, true);
  }

  // ── Upload handler ─────────────────────────────────────────────

  private async handleFileUpload(fileInput: HTMLInputElement): Promise<void> {
    const tool = this.callbacks?.getTool();
    if (!tool || !fileInput.files || fileInput.files.length === 0) return;

    // DEV-ASSET-PREVIEW-03: Build ChromaKeyConfig from current panel state
    const chromaKeyConfig = this.getCurrentChromaKeyConfig();

    const files = Array.from(fileInput.files);
    let uploaded = 0;
    let lastFailedName: string | null = null;
    for (const file of files) {
      const entry = await tool.uploadFile(file, chromaKeyConfig);
      if (entry) {
        uploaded++;
      } else {
        lastFailedName = file.name || '(unknown)';
      }
    }

    if (uploaded === files.length) {
      this.showStatus(`Uploaded ${uploaded}/${files.length} file(s)`, true);
    } else if (uploaded > 0) {
      this.showStatus(`Uploaded ${uploaded}/${files.length} file(s) \u2014 "${lastFailedName}" failed, check console`, false);
    } else {
      this.showStatus(`Upload failed: "${lastFailedName}" \u2014 check console`, false);
    }
    this.refresh();

    // Reset the file input so the same file can be re-uploaded
    fileInput.value = '';
  }

  // ── List update methods ────────────────────────────────────────

  private updateAssetList(): void {
    if (!this.assetListEl) return;
    const tool = this.callbacks?.getTool();
    if (!tool) return;

    const assets = tool.getAssets();
    if (assets.length === 0) {
      this.assetListEl.innerHTML = '<div style="color:#666;">No assets uploaded</div>';
      return;
    }

    const parts: string[] = [];
    for (const asset of assets) {
      const isPending = tool.getPendingPlaceAssetId() === asset.id;
      const bgColor = isPending ? 'rgba(128, 192, 255, 0.2)' : 'transparent';
      const border = isPending ? '1px solid rgba(128, 192, 255, 0.5)' : '1px solid transparent';
      // DEV-ASSET-PREVIEW-03: Show chroma-key status in asset list
      const ckStatus = asset.chromaKeyConfig
        ? `<span style="color:#ff80ff;">CK</span>`
        : '';
      parts.push(
        `<div data-asset-id="${asset.id}" style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;background:${bgColor};border:${border};border-radius:2px;cursor:pointer;margin:1px 0;">` +
        `<span>${asset.fileName} (${asset.naturalWidth}x${asset.naturalHeight}) ${ckStatus}</span>` +
        `<span style="color:#666;">click to place</span>` +
        `</div>`
      );
    }
    this.assetListEl.innerHTML = parts.join('');

    // Add click listeners to asset items
    const items = this.assetListEl.querySelectorAll('[data-asset-id]');
    items.forEach(item => {
      const assetId = (item as HTMLElement).dataset.assetId!;
      item.addEventListener('click', () => {
        const t = this.callbacks?.getTool();
        if (t) {
          t.setPendingPlaceAssetId(assetId);
          this.refresh();
          this.showStatus(`Selected "${assetId}" \u2014 click map to place`, true);
        }
      });
    });
  }

  private updatePlacementList(): void {
    if (!this.placementListEl) return;
    const tool = this.callbacks?.getTool();
    if (!tool) return;

    const placements = tool.getPlacements();
    const selectedId = tool.getSelectedPlacement()?.id;

    if (placements.length === 0) {
      this.placementListEl.innerHTML = '<div style="color:#666;">No placements yet</div>';
      return;
    }

    const assets = tool.getAssets();
    const parts: string[] = [];
    for (const p of placements) {
      const asset = assets.find(a => a.id === p.assetId);
      const name = asset?.fileName ?? p.assetId;
      const isSelected = p.id === selectedId;
      const bgColor = isSelected ? 'rgba(129, 199, 132, 0.2)' : 'transparent';
      const border = isSelected ? '1px solid rgba(129, 199, 132, 0.5)' : '1px solid transparent';
      const ckBadge = p.chromaKey ? ' CK' : '';
      parts.push(
        `<div data-placement-id="${p.id}" style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;background:${bgColor};border:${border};border-radius:2px;cursor:pointer;margin:1px 0;">` +
        `<span>${name} @ (${p.tx},${p.ty}) ${p.footprint}x${p.footprint} ${p.scale.toFixed(1)}x${ckBadge}</span>` +
        `</div>`
      );
    }
    this.placementListEl.innerHTML = parts.join('');

    // Add click listeners to placement items
    const items = this.placementListEl.querySelectorAll('[data-placement-id]');
    items.forEach(item => {
      const placementId = (item as HTMLElement).dataset.placementId!;
      item.addEventListener('click', () => {
        const t = this.callbacks?.getTool();
        if (t) {
          t.selectPlacement(placementId);
          this.refresh();
        }
      });
    });
  }

  // ── Placement control methods ──────────────────────────────────

  private applyScaleToSelected(): void {
    const tool = this.callbacks?.getTool();
    if (!tool) return;
    const selected = tool.getSelectedPlacement();
    if (selected) {
      tool.setPlacementScale(selected.id, this.currentScale);
    }
  }

  private applyFootprintToSelected(): void {
    const tool = this.callbacks?.getTool();
    if (!tool) return;
    const selected = tool.getSelectedPlacement();
    if (selected) {
      tool.setPlacementFootprint(selected.id, this.currentFootprint);
    }
    this.refresh();
  }

  private deleteSelected(): void {
    const tool = this.callbacks?.getTool();
    if (!tool) return;
    const selected = tool.getSelectedPlacement();
    if (selected) {
      tool.deletePlacement(selected.id);
      this.showStatus('Deleted selected preview', true);
      this.refresh();
    } else {
      this.showStatus('No preview selected', false);
    }
  }

  private clearAll(): void {
    const tool = this.callbacks?.getTool();
    if (!tool) return;
    tool.clearPlacements();
    this.showStatus('Cleared all previews', true);
    this.refresh();
  }

  private showStatus(message: string, success: boolean): void {
    if (!this.statusEl) return;
    if (this.statusTimer) clearTimeout(this.statusTimer);

    this.statusEl.textContent = message;
    this.statusEl.style.color = success ? '#81c784' : '#ef9a9a';
    this.statusEl.style.opacity = '1';

    this.statusTimer = setTimeout(() => {
      if (this.statusEl) {
        this.statusEl.style.opacity = '0';
      }
    }, 2500);
  }

  private updateFootprintButtons(): void {
    for (const [fp, btn] of this.footprintBtns) {
      btn.style.background = fp === this.currentFootprint
        ? 'rgba(128, 192, 255, 0.3)'
        : 'rgba(255, 255, 255, 0.04)';
    }
  }

  private makeLabel(text: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.textContent = text;
    el.style.cssText = 'font-size: 10px; color: #c0a0d0; min-width: 60px;';
    return el;
  }

  private makeButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid ${color}33;
      border-radius: 3px;
      color: ${color};
      font-size: 10px;
      cursor: pointer;
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
