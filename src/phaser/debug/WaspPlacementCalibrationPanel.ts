/**
 * @legacy Wasp/Smoky pilot-era placement helper.
 * Do not import into MODULAR-RUNTIME-* code paths.
 * The clean modular runtime must use src/modular/* + generated modular manifests.
 *
 * WaspPlacementCalibrationPanel — on-screen button panel for Wasp hull
 * placement calibration.
 *
 * PIM-HULL-WASP-ANCHOR-MAP-01 fixup v3: Visible on-screen buttons for
 * placement calibration. Keyboard-only calibration is not enough for
 * GitHub Pages preview — buttons must be large enough for mouse/touch.
 *
 * Each button calls the same placement functions as the keyboard controls
 * in BlockoutVehicleInputController. Button clicks do not leak into
 * gameplay (the input controller guards pointer events when WASP
 * placement calibration is active).
 *
 * Button layout (bottom-right of screen):
 *   Row 1: [UP]  [DOWN]  [LEFT]  [RIGHT]           (1px step)
 *   Row 2: [UP x5] [DOWN x5] [LEFT x5] [RIGHT x5]  (5px step)
 *   Row 3: [RESET]  [PRINT VALUES]
 *
 * The panel is only shown when placement calibration is active.
 * Keep the improved ModularTankDebugOverlay-style markers.
 */

import Phaser from 'phaser';
import {
  adjustUp,
  adjustDown,
  adjustLeft,
  adjustRight,
  resetPlacementOffset,
  printPlacementValues,
  getDebugOffsetX,
  getDebugOffsetY,
} from './WaspHullPlacementCalibrator';

// ─── Button layout constants ─────────────────────────────────────

/** Button width for direction buttons (1px). */
const BTN_W = 68;

/** Button width for x5 direction buttons. */
const BTN_W5 = 78;

/** Button width for action buttons (RESET, PRINT VALUES). */
const BTN_ACTION_W = 110;

/** Button height. */
const BTN_H = 42;

/** Horizontal gap between buttons. */
const BTN_GAP_X = 6;

/** Vertical gap between button rows. */
const BTN_GAP_Y = 6;

/** Panel padding. */
const PANEL_PAD = 10;

/** Panel distance from right edge of screen. */
const PANEL_MARGIN_RIGHT = 16;

/** Panel distance from bottom edge of screen. */
const PANEL_MARGIN_BOTTOM = 16;

/** Panel depth (on top of other UI). */
const PANEL_DEPTH = 10000;

/** Button background color (dark). */
const BTN_COLOR = 0x1a1a2e;

/** Button background color on hover. */
const BTN_COLOR_HOVER = 0x2a2a4e;

/** Button border color. */
const BTN_BORDER_COLOR = 0x4a9eff;

/** Button border color on hover. */
const BTN_BORDER_HOVER_COLOR = 0x7cb8ff;

/** Button text color. */
const BTN_TEXT_COLOR = '#d4e4ff';

/** Button text color on hover. */
const BTN_TEXT_HOVER_COLOR = '#ffffff';

/** Title text color. */
const TITLE_TEXT_COLOR = '#7cb8ff';

/** Panel background color. */
const PANEL_BG_COLOR = 0x0d0d1a;

/** Panel border color. */
const PANEL_BORDER_COLOR = 0x3a5a8a;

// ─── Button definition ───────────────────────────────────────────

interface ButtonDef {
  label: string;
  width: number;
  action: () => void;
}

// ─── Panel class ─────────────────────────────────────────────────

export class WaspPlacementCalibrationPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private _visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Whether the panel is currently visible. */
  isVisible(): boolean {
    return this._visible;
  }

  /** Create and show the panel. No-op if already visible. */
  show(): void {
    if (this._visible) return;
    this._visible = true;
    this.createPanel();
  }

  /** Hide and destroy the panel. No-op if already hidden. */
  hide(): void {
    if (!this._visible) return;
    this._visible = false;
    this.destroyPanel();
  }

  /** Destroy the panel completely (for renderer cleanup). */
  destroy(): void {
    this.destroyPanel();
    this._visible = false;
  }

  // ─── Panel creation ──────────────────────────────────────────────

  private createPanel(): void {
    const cam = this.scene.cameras.main;
    const screenWidth = cam.width;
    const screenHeight = cam.height;

    // ── Define buttons ──
    const row1: ButtonDef[] = [
      { label: 'UP', width: BTN_W, action: () => { adjustUp(false); this.logOffset('UP'); } },
      { label: 'DOWN', width: BTN_W, action: () => { adjustDown(false); this.logOffset('DOWN'); } },
      { label: 'LEFT', width: BTN_W, action: () => { adjustLeft(false); this.logOffset('LEFT'); } },
      { label: 'RIGHT', width: BTN_W, action: () => { adjustRight(false); this.logOffset('RIGHT'); } },
    ];
    const row2: ButtonDef[] = [
      { label: 'UP x5', width: BTN_W5, action: () => { adjustUp(true); this.logOffset('UP x5'); } },
      { label: 'DOWN x5', width: BTN_W5, action: () => { adjustDown(true); this.logOffset('DOWN x5'); } },
      { label: 'LEFT x5', width: BTN_W5, action: () => { adjustLeft(true); this.logOffset('LEFT x5'); } },
      { label: 'RIGHT x5', width: BTN_W5, action: () => { adjustRight(true); this.logOffset('RIGHT x5'); } },
    ];
    const row3: ButtonDef[] = [
      { label: 'RESET', width: BTN_ACTION_W, action: () => { resetPlacementOffset(); console.log('[WaspPlacement] Offset reset to (0, 0)'); } },
      { label: 'PRINT VALUES', width: BTN_ACTION_W, action: () => { printPlacementValues(); } },
    ];

    const rows = [row1, row2, row3];

    // ── Compute panel dimensions ──
    const maxRowWidth = (defs: ButtonDef[]) =>
      defs.reduce((sum, d) => sum + d.width, 0) + (defs.length - 1) * BTN_GAP_X;

    const widestRow = Math.max(...rows.map(maxRowWidth));
    const panelInnerW = widestRow;
    const titleHeight = 22;
    const totalRowHeight = rows.length * BTN_H + (rows.length - 1) * BTN_GAP_Y;
    const panelW = panelInnerW + PANEL_PAD * 2;
    const panelH = titleHeight + totalRowHeight + PANEL_PAD * 2;

    // ── Position (bottom-right of screen) ──
    const panelX = screenWidth - panelW - PANEL_MARGIN_RIGHT;
    const panelY = screenHeight - panelH - PANEL_MARGIN_BOTTOM;

    // ── Container ──
    this.container = this.scene.add.container(panelX, panelY);
    this.container.setDepth(PANEL_DEPTH);
    this.container.setScrollFactor(0); // fixed on screen — does not move with camera

    // ── Panel background ──
    const bgRect = this.scene.add.graphics();
    bgRect.fillStyle(PANEL_BG_COLOR, 0.92);
    bgRect.fillRoundedRect(0, 0, panelW, panelH, 8);
    bgRect.lineStyle(2, PANEL_BORDER_COLOR, 0.8);
    bgRect.strokeRoundedRect(0, 0, panelW, panelH, 8);
    this.container.add(bgRect);

    // ── Title ──
    const title = this.scene.add.text(PANEL_PAD, PANEL_PAD, 'PLACEMENT CALIBRATION', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: TITLE_TEXT_COLOR,
    });
    this.container.add(title);

    // ── Create buttons ──
    const contentStartY = PANEL_PAD + titleHeight;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const rowDefs = rows[rowIdx];
      const rowTotalW = maxRowWidth(rowDefs);
      let x = PANEL_PAD + (panelInnerW - rowTotalW) / 2; // center row
      const y = contentStartY + rowIdx * (BTN_H + BTN_GAP_Y);

      for (const def of rowDefs) {
        this.createButton(x, y, def);
        x += def.width + BTN_GAP_X;
      }
    }
  }

  /** Create a single button and add it to the container. */
  private createButton(x: number, y: number, def: ButtonDef): void {
    if (!this.container) return;

    // Background rectangle
    const bg = this.scene.add.rectangle(x, y, def.width, BTN_H, BTN_COLOR, 0.95);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, BTN_BORDER_COLOR, 0.8);
    this.container.add(bg);

    // Label
    const text = this.scene.add.text(x + def.width / 2, y + BTN_H / 2, def.label, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: BTN_TEXT_COLOR,
      align: 'center',
    });
    text.setOrigin(0.5, 0.5);
    this.container.add(text);

    // Interactive with hand cursor
    bg.setInteractive({ useHandCursor: true });

    // Click handler — consume the DOM event to prevent gameplay leaks
    bg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      // Stop the Phaser event from propagating to scene-level input handlers
      if (event) {
        event.stopPropagation();
      }
      def.action();
    });

    // Hover effects
    bg.on('pointerover', () => {
      bg.setFillStyle(BTN_COLOR_HOVER, 0.95);
      bg.setStrokeStyle(2, BTN_BORDER_HOVER_COLOR, 1.0);
      text.setColor(BTN_TEXT_HOVER_COLOR);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(BTN_COLOR, 0.95);
      bg.setStrokeStyle(2, BTN_BORDER_COLOR, 0.8);
      text.setColor(BTN_TEXT_COLOR);
    });
  }

  /** Log offset after a button adjustment. */
  private logOffset(direction: string): void {
    console.log(`[WaspPlacement] ${direction} → offset = (${getDebugOffsetX()}, ${getDebugOffsetY()})`);
  }

  /** Destroy all panel game objects. */
  private destroyPanel(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
  }
}
