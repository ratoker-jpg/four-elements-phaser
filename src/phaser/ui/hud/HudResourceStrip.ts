/**
 * HUD Resource Strip — top-left resource overlay for AoE4-inspired UX.
 *
 * HUD-LAYOUT-REBUILD-02: Moved from the bottom HUD bar to the top-left
 * corner of the screen. This is a read-only DOM overlay over the game
 * viewport — it does NOT create a top camera safe-area and does NOT
 * block map input (pointer-events: none on the container).
 *
 * Contract:
 *   - No top camera safe-area. Bottom HUD owns the only safe-area.
 *   - Container uses pointer-events: none so map clicks pass through.
 *   - Only intentionally interactive children (future) would have
 *     pointer-events: auto.
 *   - Resource data is read-only in MVP.
 */

import type { GameState } from '../../../state/types';
import { getUnitCount, getUnitCap } from '../../../state/statusHelpers';
import {
  RESOURCE_STRIP_HEIGHT,
  RESOURCE_STRIP_MAX_WIDTH,
} from './hudLayout';

export class HudResourceStrip {
  private container!: HTMLDivElement;
  private rawEl!: HTMLSpanElement;
  private matterEl!: HTMLSpanElement;
  private elementsEl!: HTMLSpanElement;
  private powerEl!: HTMLSpanElement;
  private unitsEl!: HTMLSpanElement;

  create(): void {
    this.container = document.createElement('div');
    this.container.id = 'hud-resource-strip';
    this.container.innerHTML = this.css() + this.html();
    document.body.appendChild(this.container);

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
        position: fixed;
        top: 0;
        left: 0;
        display: flex;
        align-items: center;
        gap: 2px;
        height: ${RESOURCE_STRIP_HEIGHT}px;
        max-width: ${RESOURCE_STRIP_MAX_WIDTH}px;
        padding: 0 14px;
        background: linear-gradient(180deg, rgba(8, 12, 18, 0.92) 0%, rgba(8, 12, 18, 0.75) 100%);
        border-bottom: 1px solid rgba(212, 165, 116, 0.2);
        border-right: 1px solid rgba(212, 165, 116, 0.1);
        border-radius: 0 0 6px 0;
        pointer-events: none;
        user-select: none;
        z-index: 14;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        color: #a0a0a0;
        box-shadow: 2px 2px 12px rgba(0, 0, 0, 0.4);
      }
      #hud-resource-strip .hrs-item {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0 8px;
      }
      #hud-resource-strip .hrs-item + .hrs-item {
        border-left: 1px solid rgba(212, 165, 116, 0.12);
      }
      #hud-resource-strip .hrs-icon {
        font-size: 11px;
        line-height: 1;
      }
      #hud-resource-strip .hrs-icon-raw { color: #a08060; }
      #hud-resource-strip .hrs-icon-matter { color: #60a0c0; }
      #hud-resource-strip .hrs-icon-elements { color: #c0a040; }
      #hud-resource-strip .hrs-icon-power { color: #e0c040; }
      #hud-resource-strip .hrs-icon-units { color: #80c080; }
      #hud-resource-strip .hrs-label {
        color: #d4a574;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      #hud-resource-strip .hrs-value {
        color: #e8e8e8;
        font-variant-numeric: tabular-nums;
        font-weight: 500;
      }
    </style>`;
  }

  private html(): string {
    return `
      <div class="hrs-item">
        <span class="hrs-icon hrs-icon-raw">&#9670;</span>
        <span class="hrs-label">Raw</span>
        <span class="hrs-value" id="hrs-raw">0/0</span>
      </div>
      <div class="hrs-item">
        <span class="hrs-icon hrs-icon-matter">&#9670;</span>
        <span class="hrs-label">Matter</span>
        <span class="hrs-value" id="hrs-matter">0/0</span>
      </div>
      <div class="hrs-item">
        <span class="hrs-icon hrs-icon-elements">&#9670;</span>
        <span class="hrs-label">Elem</span>
        <span class="hrs-value" id="hrs-elements">0/0</span>
      </div>
      <div class="hrs-item">
        <span class="hrs-icon hrs-icon-power">&#9670;</span>
        <span class="hrs-label">Power</span>
        <span class="hrs-value" id="hrs-power">0/0</span>
      </div>
      <div class="hrs-item">
        <span class="hrs-icon hrs-icon-units">&#9670;</span>
        <span class="hrs-label">Units</span>
        <span class="hrs-value" id="hrs-units">0/0</span>
      </div>
    `;
  }
}
