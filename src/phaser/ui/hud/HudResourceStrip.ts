/**
 * HUD Resource Strip — always-visible economy readout at the bottom of the HUD bar.
 *
 * VISUAL-HUD-CORE-01: Reads from GameState.economy without mutating it.
 * This is a read-only display layer.
 */

import type { GameState } from '../../../state/types';
import { getUnitCount, getUnitCap } from '../../../state/statusHelpers';

export class HudResourceStrip {
  private container!: HTMLDivElement;
  private rawEl!: HTMLSpanElement;
  private matterEl!: HTMLSpanElement;
  private elementsEl!: HTMLSpanElement;
  private powerEl!: HTMLSpanElement;
  private unitsEl!: HTMLSpanElement;

  create(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'hud-resource-strip';
    this.container.innerHTML = this.css() + this.html();
    parent.appendChild(this.container);

    this.rawEl = this.container.querySelector('#hrs-raw')!;
    this.matterEl = this.container.querySelector('#hrs-matter')!;
    this.elementsEl = this.container.querySelector('#hrs-elements')!;
    this.powerEl = this.container.querySelector('#hrs-power')!;
    this.unitsEl = this.container.querySelector('#hrs-units')!;
  }

  update(state: GameState): void {
    const eco = state.economy;
    const faction = state.playerFaction;

    this.rawEl.textContent = `${Math.floor(eco.raw)}/${eco.rawCap}`;
    this.matterEl.textContent = `${Math.floor(eco.matter)}/${eco.matterCap}`;
    this.elementsEl.textContent = `${Math.floor(eco.elements[faction] ?? 0)}/${eco.elementCap}`;
    this.powerEl.textContent = `${eco.powerConsumed}/${eco.powerGenerated}`;
    this.unitsEl.textContent = `${getUnitCount(state)}/${getUnitCap(state)}`;
  }

  destroy(): void {
    this.container?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  private css(): string {
    return `<style>
      #hud-resource-strip {
        display: flex;
        align-items: center;
        justify-content: space-around;
        height: 30px;
        background: rgba(10, 14, 20, 0.95);
        border-top: 1px solid rgba(212, 165, 116, 0.2);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        color: #a0a0a0;
        padding: 0 8px;
        user-select: none;
      }
      #hud-resource-strip .hrs-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      #hud-resource-strip .hrs-label {
        color: #d4a574;
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      #hud-resource-strip .hrs-value {
        color: #e0e0e0;
        font-variant-numeric: tabular-nums;
      }
    </style>`;
  }

  private html(): string {
    return `
      <div class="hrs-item"><span class="hrs-label">Raw</span><span class="hrs-value" id="hrs-raw">0/0</span></div>
      <div class="hrs-item"><span class="hrs-label">Matter</span><span class="hrs-value" id="hrs-matter">0/0</span></div>
      <div class="hrs-item"><span class="hrs-label">Elements</span><span class="hrs-value" id="hrs-elements">0/0</span></div>
      <div class="hrs-item"><span class="hrs-label">Power</span><span class="hrs-value" id="hrs-power">0/0</span></div>
      <div class="hrs-item"><span class="hrs-label">Units</span><span class="hrs-value" id="hrs-units">0/0</span></div>
    `;
  }
}
