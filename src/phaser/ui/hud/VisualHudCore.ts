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
import type { FactoryComposerState } from '../../../state/factoryComposer';
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
import { HudCommandPanel, type CommandExecuteCallback, type FeedbackCallback } from './HudCommandPanel';
import { HudMinimap, type MinimapCameraData, type MinimapOffset } from './HudMinimap';
import { HudStatusLane } from './HudStatusLane';
import { FeedbackStore, type FeedbackMessage } from '../../../state/feedbackStore';

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

  /** FEEDBACK-ALERTS-06: Feedback store for typed feedback messages. */
  private feedbackStore = new FeedbackStore();

  /** FIXUP-1: Track last shown feedback ID to avoid re-rendering same message. */
  private lastShownFeedbackId: number = -1;

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

    // FEEDBACK-ALERTS-06: Feedback callback for disabled command clicks
    // FIXUP-1: Pass through dedupeKey from command panel
    const feedbackCb: FeedbackCallback = (event) => {
      this.addFeedback({
        type: event.type as 'info' | 'success' | 'warning' | 'error',
        message: event.message,
        code: event.code,
        dedupeKey: event.dedupeKey,
        duration: event.duration,
      });
    };

    this.minimapSlot.create(this.panelRow);
    this.selectionPanel.create(this.panelRow);
    this.commandPanel.create(this.panelRow, onCommand, feedbackCb);
    this.statusLane.create(statusRow);

    this.root.appendChild(this.panelRow);
    this.root.appendChild(statusRow);
    document.body.appendChild(this.root);
  }

  update(
    state: GameState,
    cameraData: MinimapCameraData | null = null,
    offset: MinimapOffset = { x: 0, y: 0 },
    composer?: FactoryComposerState,
  ): void {
    this.resourceStrip.update(state);
    this.selectionPanel.update(state, this.currentSelection, composer);
    this.commandPanel.update(state, this.currentSelection, composer);
    // MINIMAP-INTERACTION-04: Pass selection to minimap for selected entity highlighting
    this.minimapSlot.update(state, cameraData, offset, this.currentSelection);

    // FEEDBACK-ALERTS-06: Expire old feedback messages and show current message
    // FIXUP-1: Only re-render when message id changes to avoid resetting timer
    this.feedbackStore.expireMessages();
    const currentMsg = this.feedbackStore.getCurrentMessage();
    if (currentMsg) {
      if (currentMsg.id !== this.lastShownFeedbackId) {
        this.lastShownFeedbackId = currentMsg.id;
        this.statusLane.showFeedback(currentMsg);
      }
    } else {
      // No current message — clear the lane if it was showing something
      if (this.lastShownFeedbackId !== -1) {
        this.lastShownFeedbackId = -1;
        this.statusLane.clear();
      }
    }
  }

  /** Update the current selection (called by GameInputController). */
  setSelection(selection: UnitSelection): void {
    this.currentSelection = selection;
  }

  /**
   * Show a status message in the status lane.
   * Called from GameScene via the showStatus callback.
   * FIXUP-1: Legacy callers go directly to status lane — do NOT push to FeedbackStore
   * to avoid double-adding. Typed feedback uses addFeedback() as the single source of truth.
   */
  showStatus(message: string, success: boolean): void {
    this.statusLane.showStatus(message, success);
  }

  /** FEEDBACK-ALERTS-06: Get the feedback store for external access. */
  getFeedbackStore(): FeedbackStore {
    return this.feedbackStore;
  }

  /** FEEDBACK-ALERTS-06: Add a feedback message to the store and show it.
   * FIXUP-1: If deduped (returns null), do not show anything.
   * Also updates lastShownFeedbackId so update() won't re-render.
   */
  addFeedback(params: {
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    code?: string;
    tileTarget?: { tx: number; ty: number };
    duration?: number;
    dedupeKey?: string;
  }): FeedbackMessage | null {
    const msg = this.feedbackStore.addFeedback(params);
    if (msg) {
      this.lastShownFeedbackId = msg.id;
      this.statusLane.showFeedback(msg);
      // If the message has a tile target, add a minimap ping
      if (msg.tileTarget) {
        this.minimapSlot.addPing({
          tx: msg.tileTarget.tx,
          ty: msg.tileTarget.ty,
          color: this.severityToPingColor(msg.type),
          birthTime: msg.timestamp,
          lifetime: msg.duration,
        });
      }
    }
    return msg;
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
    this.feedbackStore.clear();
    this.root?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  /** FEEDBACK-ALERTS-06: Map severity to minimap ping color. */
  private severityToPingColor(type: 'info' | 'success' | 'warning' | 'error'): string {
    switch (type) {
      case 'success': return '#4ade80';
      case 'warning': return '#fbbf24';
      case 'error': return '#f87171';
      case 'info': return '#60a5fa';
    }
  }

  private css(): string {
    return `<style>
      #visual-hud-core {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: ${HUD_BAR_HEIGHT}px;
        background: rgba(10, 14, 20, 0.96);
        border-top: 2px solid rgba(212, 165, 116, 0.3);
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
        border-right: 1px solid rgba(212, 165, 116, 0.15);
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
