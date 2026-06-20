/**
 * VisualHudCore — AoE4-inspired bottom RTS HUD composing all panel slots.
 *
 * HUD-LAYOUT-REBUILD-02: Rebuilt layout:
 *   [Top-left: Resource strip overlay — no camera safe-area]
 *   [Bottom: Minimap | Selection panel | Command card area]
 *   [Bottom: Status/toast lane]
 *
 * Architecture:
 *   - Resource strip: separate DOM element, position: fixed top-left,
 *     pointer-events: none — does not block map input or reduce viewport.
 *   - Bottom HUD: position: fixed bottom, full width — the only camera
 *     safe-area. Contains minimap, selection panel, command card area,
 *     and status lane.
 *   - Command card area: visually reserves space for future 4×3 grid.
 *     Current commands render inside this area temporarily.
 *   - Status lane: minimal status message area at the bottom of the HUD.
 *
 * VISUAL-MINIMAP-03: Minimap is a real canvas-based minimap with
 * entity markers and camera viewport rectangle.
 *
 * MINIMAP-INTERACTION-04: Wires camera center callback to HudMinimap
 * for click-to-camera and drag-to-pan. Passes selection to minimap
 * for selected entity highlighting.
 *
 * The main camera viewport is reduced by HUD_BAR_HEIGHT so game
 * content is never hidden behind the bottom HUD bar.
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import {
  HUD_BAR_HEIGHT,
  HUD_MINIMAP_WIDTH,
  HUD_MINIMAP_HEIGHT,
  HUD_PANEL_ROW_HEIGHT,
  HUD_STATUS_LANE_HEIGHT,
  COMMAND_CARD_MIN_WIDTH,
} from './hudLayout';
import { HudResourceStrip } from './HudResourceStrip';
import { HudSelectionPanel } from './HudSelectionPanel';
import { HudCommandPanel, type CommandExecuteCallback } from './HudCommandPanel';
import { HudMinimap, type MinimapCameraData, type MinimapOffset } from './HudMinimap';
import { HudStatusLane } from './HudStatusLane';

export class VisualHudCore {
  private root!: HTMLDivElement;
  private panelRow!: HTMLDivElement;

  /** Resource strip — top-left overlay, NOT inside the bottom bar. */
  private resourceStrip = new HudResourceStrip();
  private selectionPanel = new HudSelectionPanel();
  private commandPanel = new HudCommandPanel();
  private minimapSlot = new HudMinimap();
  private statusLane = new HudStatusLane();

  /** Current selection state — updated by GameInputController. */
  private currentSelection: UnitSelection = null;

  create(onCommand?: CommandExecuteCallback): void {
    // Resource strip: top-left overlay (NOT in bottom bar)
    this.resourceStrip.create();

    // Bottom HUD bar
    this.root = document.createElement('div');
    this.root.id = 'visual-hud-core';
    this.root.innerHTML = this.css();

    // Panel row: minimap | selection | command card area
    this.panelRow = document.createElement('div');
    this.panelRow.id = 'vhc-panel-row';

    // Status lane at bottom
    const statusRow = document.createElement('div');
    statusRow.id = 'vhc-status-row';

    this.minimapSlot.create(this.panelRow);
    this.selectionPanel.create(this.panelRow);
    this.commandPanel.create(this.panelRow, onCommand);
    this.statusLane.create(statusRow);

    this.root.appendChild(this.panelRow);
    this.root.appendChild(statusRow);
    document.body.appendChild(this.root);
  }

  update(
    state: GameState,
    cameraData: MinimapCameraData | null = null,
    offset: MinimapOffset = { x: 0, y: 0 },
  ): void {
    this.resourceStrip.update(state);
    this.selectionPanel.update(state, this.currentSelection);
    this.commandPanel.update(state, this.currentSelection);
    // MINIMAP-INTERACTION-04: Pass selection to minimap for selected entity highlighting
    this.minimapSlot.update(state, cameraData, offset, this.currentSelection);
  }

  /** Update the current selection (called by GameInputController). */
  setSelection(selection: UnitSelection): void {
    this.currentSelection = selection;
  }

  /**
   * Show a status message in the status lane.
   * Called from GameScene via the showStatus callback.
   */
  showStatus(message: string, success: boolean): void {
    this.statusLane.showStatus(message, success);
  }

  /** MINIMAP-INTERACTION-04: Set callback for camera centering (passed to HudMinimap). */
  setCameraCenterCallback(cb: (worldX: number, worldY: number) => void): void {
    this.minimapSlot.setCameraCenterCallback(cb);
  }

  /** MINIMAP-INTERACTION-04: Set the map offset for minimap coordinate transforms. */
  setMinimapOffset(offset: MinimapOffset): void {
    this.minimapSlot.setOffset(offset);
  }

  destroy(): void {
    this.resourceStrip.destroy();
    this.selectionPanel.destroy();
    this.commandPanel.destroy();
    this.minimapSlot.destroy();
    this.statusLane.destroy();
    this.root?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  private css(): string {
    return `<style>
      #visual-hud-core {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: ${HUD_BAR_HEIGHT}px;
        background: rgba(10, 14, 20, 0.96);
        border-top: 2px solid rgba(212, 165, 116, 0.35);
        z-index: 15;
        display: flex;
        flex-direction: column;
        pointer-events: none;
        user-select: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 -6px 32px rgba(0, 0, 0, 0.6);
      }
      #vhc-panel-row {
        display: flex;
        flex: 1;
        min-height: 0;
        height: ${HUD_PANEL_ROW_HEIGHT}px;
        pointer-events: none;
      }
      #vhc-panel-row > * {
        pointer-events: auto;
      }
      #vhc-status-row {
        flex-shrink: 0;
        height: ${HUD_STATUS_LANE_HEIGHT}px;
        pointer-events: none;
      }
      #vhc-status-row > * {
        pointer-events: auto;
      }

      /* ── Minimap frame ── */
      #hud-minimap-slot {
        width: ${HUD_MINIMAP_WIDTH}px;
        height: ${HUD_MINIMAP_HEIGHT}px;
        flex-shrink: 0;
        background: rgba(4, 6, 10, 0.92);
        border-right: 1px solid rgba(212, 165, 116, 0.2);
        pointer-events: auto;
        user-select: none;
        cursor: default;
      }

      /* ── Selection panel ── */
      #hud-selection-panel {
        flex: 1;
        min-width: 0;
        border-right: 1px solid rgba(212, 165, 116, 0.15);
      }

      /* ── Command card area ── */
      #hud-command-panel {
        min-width: ${COMMAND_CARD_MIN_WIDTH}px;
        flex-shrink: 0;
      }
    </style>`;
  }
}
