/**
 * VisualHudCore — bottom RTS HUD bar composing all panel slots.
 *
 * VISUAL-HUD-CORE-01: The bottom bar layout:
 *   [Minimap slot] [Selection panel] [Command panel]
 *   [Resource strip — full width]
 *
 * VISUAL-COMMAND-PANEL-02: Command panel is now a real, context-sensitive
 * panel that shows build/produce/stop actions based on the current selection.
 *
 * Architecture: DOM-only (no Phaser UI objects). The minimap slot is a
 * placeholder for a future Phaser second-camera viewport.
 *
 * The HUD bar is positioned at the bottom of the screen. The main camera
 * viewport is reduced by HUD_BAR_HEIGHT so game content is never hidden.
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { HUD_BAR_HEIGHT } from './hudLayout';
import { HudResourceStrip } from './HudResourceStrip';
import { HudSelectionPanel } from './HudSelectionPanel';
import { HudCommandPanel, type CommandExecuteCallback } from './HudCommandPanel';
import { HudMinimapPlaceholder } from './HudMinimapPlaceholder';

export class VisualHudCore {
  private root!: HTMLDivElement;
  private panelRow!: HTMLDivElement;

  private resourceStrip = new HudResourceStrip();
  private selectionPanel = new HudSelectionPanel();
  private commandPanel = new HudCommandPanel();
  private minimapSlot = new HudMinimapPlaceholder();

  /** Current selection state — updated by GameInputController. */
  private currentSelection: UnitSelection = null;

  create(onCommand?: CommandExecuteCallback): void {
    this.root = document.createElement('div');
    this.root.id = 'visual-hud-core';
    this.root.innerHTML = this.css();

    // Panel row: minimap | selection | command
    this.panelRow = document.createElement('div');
    this.panelRow.id = 'vhc-panel-row';

    // Resource strip (full width, below panels)
    const stripRow = document.createElement('div');
    stripRow.id = 'vhc-strip-row';

    this.minimapSlot.create(this.panelRow);
    this.selectionPanel.create(this.panelRow);
    this.commandPanel.create(this.panelRow, onCommand);
    this.resourceStrip.create(stripRow);

    this.root.appendChild(this.panelRow);
    this.root.appendChild(stripRow);
    document.body.appendChild(this.root);
  }

  update(state: GameState): void {
    this.resourceStrip.update(state);
    this.selectionPanel.update(state, this.currentSelection);
    this.commandPanel.update(state, this.currentSelection);
    this.minimapSlot.update();
  }

  /** Update the current selection (called by GameInputController). */
  setSelection(selection: UnitSelection): void {
    this.currentSelection = selection;
  }

  destroy(): void {
    this.resourceStrip.destroy();
    this.selectionPanel.destroy();
    this.commandPanel.destroy();
    this.minimapSlot.destroy();
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
        background: rgba(13, 17, 23, 0.95);
        border-top: 2px solid rgba(212, 165, 116, 0.3);
        z-index: 15;
        display: flex;
        flex-direction: column;
        pointer-events: none;
        user-select: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
        transform: scale(var(--ui-scale, 1));
        transform-origin: bottom center;
      }
      #vhc-panel-row {
        display: flex;
        flex: 1;
        min-height: 0;
        pointer-events: none;
      }
      #vhc-panel-row > * {
        pointer-events: auto;
      }
      #vhc-strip-row {
        flex-shrink: 0;
        pointer-events: none;
      }
      #vhc-strip-row > * {
        pointer-events: auto;
      }
      /* Selection panel takes remaining space */
      #hud-selection-panel {
        flex: 1;
        min-width: 0;
        border-right: 1px solid rgba(212, 165, 116, 0.2);
      }
      /* Command panel takes remaining space */
      #hud-command-panel {
        flex: 1;
        min-width: 0;
      }
    </style>`;
  }
}
