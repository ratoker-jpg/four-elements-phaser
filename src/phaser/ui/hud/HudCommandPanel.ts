/**
 * HUD Command Panel — context-sensitive command buttons for the bottom HUD.
 *
 * VISUAL-COMMAND-PANEL-02: Replaces the placeholder with real command
 * buttons that reflect the current selection context:
 *
 *   - No selection: empty/neutral panel
 *   - Builder: build actions (6 gameplay-ready buildings)
 *   - Harvester: stop command only
 *
 * VISUAL-COMMAND-PANEL-02-FIXUP-1 fixes:
 *   - Stale command descriptors: click handler reads from descriptor map
 *     instead of closing over initial descriptor.
 *   - Disabled tooltip: uses aria-disabled + CSS instead of native disabled
 *     so hover/mouse events still fire on disabled buttons.
 *
 * Each button shows: label, hotkey, cost, enabled/disabled state.
 * Tooltips show the disabled reason when a command is unavailable.
 * Clicking an enabled button invokes the existing command handler.
 * Clicking inside the panel does NOT leak to map click/select/move.
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import {
  buildCommandPanelViewModel,
  type CommandDescriptor,
  type CommandPanelViewModel,
} from './commandPanelViewModel';

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
   * FIXUP-1: Map of current command descriptors by commandId.
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

    // FIXUP-1: Update the descriptor map so click handlers use fresh state
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
    // Clear existing buttons
    this.gridEl.innerHTML = '';

    if (vm.commands.length === 0) {
      this.emptyEl.style.display = 'flex';
      this.gridEl.style.display = 'none';
      return;
    }

    this.emptyEl.style.display = 'none';
    this.gridEl.style.display = 'grid';

    for (const cmd of vm.commands) {
      if (cmd.state === 'hidden') continue;
      this.gridEl.appendChild(this.createButton(cmd));
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

    // FIXUP-1: Click handler reads current descriptor from map, not closure.
    // This ensures that if a command transitions from disabled → enabled,
    // the click handler will execute based on the latest state.
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const currentCmd = this.descriptorMap.get(btn.dataset.commandId ?? '');
      if (!currentCmd || currentCmd.state !== 'enabled') return;
      this.onCommand?.(currentCmd.id);
    });

    // FIXUP-1: Tooltip reads current descriptor from map on hover,
    // not stale closure. This works because we use aria-disabled
    // instead of native disabled — hover events fire on all buttons.
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

    // FIXUP-1: Use aria-disabled + CSS instead of native disabled.
    // Native disabled prevents hover/mouseenter events in some browsers,
    // which breaks tooltip display for disabled commands.
    btn.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
    btn.classList.toggle('hcp-btn--disabled', isDisabled);

    // Remove native disabled — we control clickability via aria-disabled
    // and our click handler checks descriptor state.
    btn.removeAttribute('disabled');

    // Label + hotkey
    btn.innerHTML = this.buttonInnerHTML(cmd);
    btn.title = cmd.tooltip;
  }

  private buttonInnerHTML(cmd: CommandDescriptor): string {
    let html = `<span class="hcp-btn-label">${this.escapeHtml(cmd.label)}</span>`;
    if (cmd.hotkey) {
      html += `<span class="hcp-btn-hotkey">[${this.escapeHtml(cmd.hotkey)}]</span>`;
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
        gap: 6px;
        margin-bottom: 4px;
      }
      #hcp-context {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #d4a574;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      #hcp-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 3px;
        flex: 1;
        align-content: start;
      }
      .hcp-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        min-height: 32px;
        padding: 2px 4px;
        background: rgba(212, 165, 116, 0.08);
        border: 1px solid rgba(212, 165, 116, 0.25);
        border-radius: 3px;
        color: #e0e0e0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 10px;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s ease, border-color 0.15s ease;
        pointer-events: auto;
      }
      .hcp-btn:hover:not(.hcp-btn--disabled) {
        background: rgba(212, 165, 116, 0.18);
        border-color: rgba(212, 165, 116, 0.5);
      }
      .hcp-btn:active:not(.hcp-btn--disabled) {
        background: rgba(212, 165, 116, 0.28);
      }
      .hcp-btn:focus-visible {
        outline: 2px solid #d4a574;
        outline-offset: 1px;
      }
      /* FIXUP-1: aria-disabled styling replaces native :disabled.
         This ensures hover events still fire for tooltip display. */
      .hcp-btn--disabled {
        opacity: 0.45;
        cursor: not-allowed;
        color: #707070;
      }
      .hcp-btn--disabled:hover {
        background: rgba(212, 165, 116, 0.05);
        border-color: rgba(212, 165, 116, 0.15);
      }
      .hcp-btn-label {
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        line-height: 1.2;
      }
      .hcp-btn-hotkey {
        font-size: 8px;
        color: #888;
        line-height: 1.2;
      }
      .hcp-btn-cost {
        font-size: 8px;
        color: #a0a0a0;
        line-height: 1.2;
      }
      #hcp-tooltip {
        display: none;
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(20, 24, 32, 0.95);
        border: 1px solid rgba(212, 165, 116, 0.4);
        border-radius: 4px;
        padding: 4px 8px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        color: #e0e0e0;
        white-space: nowrap;
        z-index: 20;
        pointer-events: none;
        max-width: 250px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #hcp-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #505050;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        font-style: italic;
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
