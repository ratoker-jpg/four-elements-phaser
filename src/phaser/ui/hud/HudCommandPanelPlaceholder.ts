/**
 * HUD Command Panel Placeholder — visual slot for future command buttons.
 *
 * VISUAL-HUD-CORE-01: Only the visual slot is implemented.
 * No command execution, hotkeys, build queue, or production logic.
 */

export class HudCommandPanelPlaceholder {
  private container!: HTMLDivElement;

  create(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'hud-command-panel';
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
      #hud-command-panel {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 8px 12px;
        height: 100%;
        min-width: 0;
      }
      #hud-command-panel .hcp-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        width: 100%;
      }
      #hud-command-panel .hcp-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(212, 165, 116, 0.15);
        border-radius: 3px;
        color: #505050;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        user-select: none;
        pointer-events: none;
      }
      #hud-command-panel .hcp-label {
        margin-top: 6px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 10px;
        color: #404040;
        font-style: italic;
      }
    </style>`;
  }

  private html(): string {
    return `
      <div class="hcp-grid">
        <div class="hcp-btn">—</div>
        <div class="hcp-btn">—</div>
        <div class="hcp-btn">—</div>
        <div class="hcp-btn">—</div>
        <div class="hcp-btn">—</div>
        <div class="hcp-btn">—</div>
      </div>
      <div class="hcp-label">Command panel (placeholder)</div>
    `;
  }
}
