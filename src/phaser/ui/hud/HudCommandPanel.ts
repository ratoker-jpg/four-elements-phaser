/**
 * HUD Command Panel — AoE4-inspired 4×3 command card with grid hotkeys.
 *
 * COMMAND-CARD-REBUILD-03: Rebuilt as a stable 4×3 command card grid
 * with Q/W/E/R/A/S/D/F/Z/X/C/V hotkey badges. Each slot has a fixed
 * position matching the keyboard spatial layout for muscle memory.
 *
 * Key design decisions:
 *   - 12 fixed slots, each with a stable slot key and hotkey badge
 *   - Empty slots show as subtle grid cells (not fake buttons)
 *   - Hotkey badges are prominent and always visible
 *   - Commands are assigned to specific grid slots by context
 *   - descriptorMap pattern is preserved for fresh click state
 *   - aria-disabled pattern is preserved for tooltip-on-disabled
 *   - Tooltips show: name, hotkey, cost, disabled reason
 *
 * Slot layout (matching keyboard spatial layout):
 *   Row 1: Q  W  E  R
 *   Row 2: A  S  D  F
 *   Row 3: Z  X  C  V
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import {
  buildCommandCardViewModel,
} from './commandPanelViewModel';
import {
  GRID_COLS,
  GRID_ROWS,
  type SlotKey,
  type CommandCardViewModel,
  type CommandCardSlot,
} from './commandCardGrid';

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
  private currentVm: CommandCardViewModel | null = null;

  /**
   * Map of current command descriptors by commandId.
   * Click handlers read from this map instead of closing over stale descriptors.
   */
  private descriptorMap: Map<string, CommandCardSlot> = new Map();

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
    const vm = buildCommandCardViewModel(state, selection);

    // Update context label
    this.contextEl.textContent = vm.contextLabel || 'Commands';

    // Update the descriptor map so click handlers use fresh state
    this.descriptorMap.clear();
    for (const slot of vm.slots) {
      if (slot.state !== 'empty' && slot.commandId) {
        this.descriptorMap.set(slot.commandId, slot);
      }
    }

    // Rebuild grid if context changed; otherwise update states in place
    if (!this.vmEquals(this.currentVm, vm)) {
      this.rebuildGrid(vm);
      this.currentVm = vm;
    } else {
      this.updateStates(vm);
    }
  }

  destroy(): void {
    this.container?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  private rebuildGrid(vm: CommandCardViewModel): void {
    // Clear existing content
    this.gridEl.innerHTML = '';

    // Check if all slots are empty
    const hasAnyCommand = vm.slots.some((s: CommandCardSlot) => s.state !== 'empty');
    if (!hasAnyCommand) {
      this.emptyEl.style.display = 'flex';
      this.gridEl.style.display = 'none';
      return;
    }

    this.emptyEl.style.display = 'none';
    this.gridEl.style.display = 'grid';

    // Build all 12 slots in grid order
    for (const slot of vm.slots) {
      if (slot.state === 'empty') {
        this.gridEl.appendChild(this.createEmptySlot(slot.slotKey));
      } else {
        this.gridEl.appendChild(this.createCommandSlot(slot));
      }
    }
  }

  private updateStates(vm: CommandCardViewModel): void {
    const buttons = this.gridEl.querySelectorAll<HTMLButtonElement>('.hcp-btn');
    let btnIdx = 0;

    for (const slot of vm.slots) {
      if (slot.state === 'empty') continue;
      if (btnIdx >= buttons.length) break;
      const btn = buttons[btnIdx];
      this.applySlotToButton(btn, slot);
      btnIdx++;
    }
  }

  private createEmptySlot(slotKey: SlotKey): HTMLDivElement {
    const cell = document.createElement('div');
    cell.className = 'hcp-slot-empty';
    cell.dataset.slotKey = slotKey;
    return cell;
  }

  private createCommandSlot(slot: CommandCardSlot): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'hcp-btn';
    btn.dataset.commandId = slot.commandId;
    btn.dataset.slotKey = slot.slotKey;
    this.applySlotToButton(btn, slot);

    // Click handler reads current descriptor from map, not closure.
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const currentSlot = this.descriptorMap.get(btn.dataset.commandId ?? '');
      if (!currentSlot || currentSlot.state !== 'enabled') return;
      this.onCommand?.(currentSlot.commandId);
    });

    // Tooltip reads current descriptor from map on hover.
    btn.addEventListener('mouseenter', () => {
      const currentSlot = this.descriptorMap.get(btn.dataset.commandId ?? '');
      if (currentSlot) this.showTooltip(currentSlot);
    });
    btn.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    return btn;
  }

  private applySlotToButton(btn: HTMLButtonElement, slot: CommandCardSlot): void {
    const isDisabled = slot.state === 'disabled';

    // Use aria-disabled + CSS instead of native disabled.
    btn.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
    btn.classList.toggle('hcp-btn--disabled', isDisabled);
    btn.removeAttribute('disabled');

    // Label + hotkey badge + cost
    btn.innerHTML = this.slotInnerHTML(slot);
    btn.title = slot.tooltip;
  }

  private slotInnerHTML(slot: CommandCardSlot): string {
    let html = `<span class="hcp-btn-hotkey">${this.escapeHtml(slot.hotkey)}</span>`;
    html += `<span class="hcp-btn-label">${this.escapeHtml(slot.label)}</span>`;
    if (slot.cost) {
      html += `<span class="hcp-btn-cost">${this.escapeHtml(slot.cost)}</span>`;
    }
    return html;
  }

  private showTooltip(slot: CommandCardSlot): void {
    let text = slot.tooltip;
    if (slot.state === 'disabled' && slot.disabledReason) {
      text = `${slot.label} [${slot.hotkey}] — ${slot.disabledReason}`;
    }
    this.tooltipEl.textContent = text;
    this.tooltipEl.style.display = 'block';
  }

  private hideTooltip(): void {
    this.tooltipEl.style.display = 'none';
  }

  /** Shallow equality check to avoid unnecessary DOM rebuilds. */
  private vmEquals(a: CommandCardViewModel | null, b: CommandCardViewModel): boolean {
    if (!a) return false;
    if (a.contextKind !== b.contextKind) return false;
    // Check if any slot's command or state changed
    for (let i = 0; i < a.slots.length; i++) {
      if (a.slots[i].commandId !== b.slots[i].commandId) return false;
      if (a.slots[i].state !== b.slots[i].state) return false;
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
        padding: 4px 6px;
        height: 100%;
        min-width: 0;
        position: relative;
      }
      #hcp-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
        padding-bottom: 2px;
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
        grid-template-columns: repeat(${GRID_COLS}, 1fr);
        grid-template-rows: repeat(${GRID_ROWS}, 1fr);
        gap: 3px;
        flex: 1;
        align-content: stretch;
      }
      .hcp-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: 2px 3px;
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
        position: relative;
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
      .hcp-btn-hotkey {
        position: absolute;
        top: 1px;
        left: 3px;
        font-size: 8px;
        font-weight: 700;
        color: #d4a574;
        background: rgba(212, 165, 116, 0.12);
        padding: 0 3px;
        border-radius: 2px;
        line-height: 1.3;
        letter-spacing: 0.5px;
      }
      .hcp-btn--disabled .hcp-btn-hotkey {
        color: #806040;
        background: rgba(212, 165, 116, 0.06);
      }
      .hcp-btn-label {
        font-weight: 600;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        line-height: 1.2;
        margin-top: 8px;
      }
      .hcp-btn-cost {
        font-size: 7px;
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
        max-width: 300px;
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
      <div id="hcp-empty" style="display:none;">No selection</div>
    `;
  }
}
