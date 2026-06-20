/**
 * HUD Command Panel — command card area for AoE4-inspired UX.
 *
 * HUD-LAYOUT-REBUILD-02: Rebuilt to visually reserve a 4×3 command
 * card grid. Current builder/harvester commands render inside the new
 * area temporarily. The final QWER/ASDF/ZXCV hotkey migration is
 * NOT implemented in this PR — that belongs to COMMAND-CARD-REBUILD-03.
 *
 * Key design decisions:
 *   - Grid is 4 columns × 3 rows (12 slots total)
 *   - Empty slots show as subtle grid cells, not fake buttons
 *   - Hotkey badges are visible but use current hotkeys (not QWER)
 *   - descriptorMap pattern is preserved for fresh click state
 *   - aria-disabled pattern is preserved for tooltip-on-disabled
 *
 * What is TEMPORARY (will change in COMMAND-CARD-REBUILD-03):
 *   - Hotkey labels show current bindings (B, 1, 2, etc.)
 *   - Slot positions don't follow QWER spatial layout yet
 *   - Commands fill left-to-right, not by grid slot category
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import {
  buildCommandPanelViewModel,
  type CommandDescriptor,
  type CommandPanelViewModel,
} from './commandPanelViewModel';
import { COMMAND_CARD_COLS, COMMAND_CARD_ROWS } from './hudLayout';

/** Callback type for command execution. */
export type CommandExecuteCallback = (commandId: string) => void;

export class HudCommandPanel {
  private container!: HTMLDivElement;
  private gridEl!: HTMLDivElement;
  private contextEl!: HTMLSpanElement;
  private tooltipEl!: HTMLDivElement;
  private emptyEl!: HTMLDivElement;

  /** Callback to execute a command by id. */
  private onCommand?: CommandExecuteCallback;

  /** Current view model for diff checking. */
  private currentVm: CommandPanelViewModel | null = null;

  /**
   * Map of current command descriptors by commandId.
   * Click handlers read from this map instead of closing over stale descriptors.
   */
  private descriptorMap: Map<string, CommandDescriptor> = new Map();

  create(parent: HTMLElement, onCommand?: CommandExecuteCallback): void {
    this.onCommand = onCommand;

    this.container = document.createElement('div');
    this.container.id = 'hud-command-panel';
    this.container.innerHTML = this.css() + this.html();
    parent.appendChild(this.container);

    this.gridEl = this.container.querySelector('#hcp-grid')!;
    this.contextEl = this.container.querySelector('#hcp-context')!;
    this.tooltipEl = this.container.querySelector('#hcp-tooltip')!;
    this.emptyEl = this.container.querySelector('#hcp-empty')!;
  }

  update(state: GameState, selection: UnitSelection): void {
    const vm = buildCommandPanelViewModel(state, selection);

    // Update context label
    this.contextEl.textContent = vm.contextLabel || 'Commands';

    // Update the descriptor map so click handlers use fresh state
    this.descriptorMap.clear();
    for (const cmd of vm.commands) {
      this.descriptorMap.set(cmd.id, cmd);
    }

    // Rebuild buttons if command list changed
    if (!this.vmEquals(this.currentVm, vm)) {
      this.rebuildGrid(vm);
      this.currentVm = vm;
    } else {
      // Even if list is the same, update enabled/disabled states
      this.updateStates(vm);
    }
  }

  destroy(): void {
    this.container?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  private rebuildGrid(vm: CommandPanelViewModel): void {
    // Clear existing content
    this.gridEl.innerHTML = '';

    if (vm.commands.length === 0) {
      this.emptyEl.style.display = 'flex';
      this.gridEl.style.display = 'none';
      return;
    }

    this.emptyEl.style.display = 'none';
    this.gridEl.style.display = 'grid';

    // Fill active command slots
    for (const cmd of vm.commands) {
      if (cmd.state === 'hidden') continue;
      this.gridEl.appendChild(this.createButton(cmd));
    }

    // Fill remaining slots as empty grid cells
    const activeCount = vm.commands.filter(c => c.state !== 'hidden').length;
    const totalSlots = COMMAND_CARD_COLS * COMMAND_CARD_ROWS;
    for (let i = activeCount; i < totalSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'hcp-slot-empty';
      this.gridEl.appendChild(slot);
    }
  }

  private updateStates(vm: CommandPanelViewModel): void {
    const buttons = this.gridEl.querySelectorAll<HTMLButtonElement>('.hcp-btn');
    const visibleCmds = vm.commands.filter(c => c.state !== 'hidden');
    let btnIdx = 0;

    for (const cmd of visibleCmds) {
      if (btnIdx >= buttons.length) break;
      const btn = buttons[btnIdx];
      this.applyCommandToButton(btn, cmd);
      btnIdx++;
    }
  }

  private createButton(cmd: CommandDescriptor): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'hcp-btn';
    btn.dataset.commandId = cmd.id;
    this.applyCommandToButton(btn, cmd);

    // Click handler reads current descriptor from map, not closure.
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const currentCmd = this.descriptorMap.get(btn.dataset.commandId ?? '');
      if (!currentCmd || currentCmd.state !== 'enabled') return;
      this.onCommand?.(currentCmd.id);
    });

    // Tooltip reads current descriptor from map on hover.
    btn.addEventListener('mouseenter', () => {
      const currentCmd = this.descriptorMap.get(btn.dataset.commandId ?? '');
      if (currentCmd) this.showTooltip(currentCmd);
    });
    btn.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    return btn;
  }

  private applyCommandToButton(btn: HTMLButtonElement, cmd: CommandDescriptor): void {
    const isDisabled = cmd.state === 'disabled';

    // Use aria-disabled + CSS instead of native disabled.
    btn.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
    btn.classList.toggle('hcp-btn--disabled', isDisabled);
    btn.removeAttribute('disabled');

    // Label + hotkey + cost
    btn.innerHTML = this.buttonInnerHTML(cmd);
    btn.title = cmd.tooltip;
  }

  private buttonInnerHTML(cmd: CommandDescriptor): string {
    let html = `<span class="hcp-btn-label">${this.escapeHtml(cmd.label)}</span>`;
    if (cmd.hotkey) {
      html += `<span class="hcp-btn-hotkey">${this.escapeHtml(cmd.hotkey)}</span>`;
    }
    if (cmd.cost) {
      html += `<span class="hcp-btn-cost">${this.escapeHtml(cmd.cost)}</span>`;
    }
    return html;
  }

  private showTooltip(cmd: CommandDescriptor): void {
    let text = cmd.tooltip;
    if (cmd.state === 'disabled' && cmd.disabledReason) {
      text = `${cmd.label} — ${cmd.disabledReason}`;
    }
    this.tooltipEl.textContent = text;
    this.tooltipEl.style.display = 'block';
  }

  private hideTooltip(): void {
    this.tooltipEl.style.display = 'none';
  }

  /** Shallow equality check to avoid unnecessary DOM rebuilds. */
  private vmEquals(a: CommandPanelViewModel | null, b: CommandPanelViewModel): boolean {
    if (!a) return false;
    if (a.contextKind !== b.contextKind) return false;
    if (a.commands.length !== b.commands.length) return false;
    for (let i = 0; i < a.commands.length; i++) {
      if (a.commands[i].id !== b.commands[i].id) return false;
    }
    return true;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── CSS + HTML ────────────────────────────────────────────────

  private css(): string {
    return `<style>
      #hud-command-panel {
        display: flex;
        flex-direction: column;
        padding: 6px 8px;
        height: 100%;
        min-width: 0;
        position: relative;
      }
      #hcp-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(212, 165, 116, 0.1);
      }
      #hcp-context {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: #d4a574;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      #hcp-grid {
        display: grid;
        grid-template-columns: repeat(${COMMAND_CARD_COLS}, 1fr);
        grid-template-rows: repeat(${COMMAND_CARD_ROWS}, 1fr);
        gap: 3px;
        flex: 1;
        align-content: stretch;
      }
      .hcp-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 3px 4px;
        background: rgba(212, 165, 116, 0.06);
        border: 1px solid rgba(212, 165, 116, 0.2);
        border-radius: 3px;
        color: #d8d8d8;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 10px;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s ease, border-color 0.15s ease;
        pointer-events: auto;
      }
      .hcp-btn:hover:not(.hcp-btn--disabled) {
        background: rgba(212, 165, 116, 0.15);
        border-color: rgba(212, 165, 116, 0.45);
      }
      .hcp-btn:active:not(.hcp-btn--disabled) {
        background: rgba(212, 165, 116, 0.25);
      }
      .hcp-btn:focus-visible {
        outline: 2px solid #d4a574;
        outline-offset: 1px;
      }
      .hcp-btn--disabled {
        opacity: 0.4;
        cursor: not-allowed;
        color: #606060;
      }
      .hcp-btn--disabled:hover {
        background: rgba(212, 165, 116, 0.04);
        border-color: rgba(212, 165, 116, 0.12);
      }
      .hcp-btn-label {
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        line-height: 1.2;
      }
      .hcp-btn-hotkey {
        font-size: 9px;
        color: #909090;
        line-height: 1.2;
        font-weight: 600;
        background: rgba(255,255,255,0.06);
        padding: 0 3px;
        border-radius: 2px;
      }
      .hcp-btn-cost {
        font-size: 8px;
        color: #808080;
        line-height: 1.2;
      }
      /* Empty grid slot — subtle cell, no interactive element */
      .hcp-slot-empty {
        background: rgba(212, 165, 116, 0.02);
        border: 1px solid rgba(212, 165, 116, 0.06);
        border-radius: 3px;
      }
      #hcp-tooltip {
        display: none;
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(16, 20, 28, 0.96);
        border: 1px solid rgba(212, 165, 116, 0.4);
        border-radius: 4px;
        padding: 5px 10px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        color: #e0e0e0;
        white-space: nowrap;
        z-index: 20;
        pointer-events: none;
        max-width: 260px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #hcp-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #404040;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        font-style: italic;
        letter-spacing: 0.3px;
      }
    </style>`;
  }

  private html(): string {
    return `
      <div id="hcp-header">
        <span id="hcp-context">Commands</span>
      </div>
      <div id="hcp-grid"></div>
      <div id="hcp-tooltip"></div>
      <div id="hcp-empty" style="display:none;">No commands available</div>
    `;
  }
}
