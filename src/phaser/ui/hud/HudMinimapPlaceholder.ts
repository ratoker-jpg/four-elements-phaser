/**
 * HUD Minimap Placeholder — visual slot for the future minimap.
 *
 * VISUAL-HUD-CORE-01: Only the container/slot is implemented.
 * No second camera, entity dots, viewport rectangle, or click-to-camera.
 */

export class HudMinimapPlaceholder {
  private container!: HTMLDivElement;

  create(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'hud-minimap-slot';
    this.container.innerHTML = this.css() + this.html();
    parent.appendChild(this.container);
  }

  update(): void {
    // Placeholder: no dynamic updates yet
  }

  destroy(): void {
    this.container?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  private css(): string {
    return `<style>
      #hud-minimap-slot {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 200px;
        height: 150px;
        flex-shrink: 0;
        background: rgba(5, 8, 12, 0.9);
        border-right: 1px solid rgba(212, 165, 116, 0.2);
        pointer-events: none;
        user-select: none;
      }
      #hud-minimap-slot .hmm-label {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        color: #404040;
        text-align: center;
      }
      #hud-minimap-slot .hmm-sub {
        font-size: 9px;
        color: #303030;
        margin-top: 4px;
      }
    </style>`;
  }

  private html(): string {
    return `
      <div>
        <div class="hmm-label">Minimap</div>
        <div class="hmm-sub">Placeholder slot</div>
      </div>
    `;
  }
}
