/**
 * HUD Status Lane — status/toast message area at the bottom of the HUD bar.
 *
 * HUD-LAYOUT-REBUILD-02: Provides a minimal status message area for
 * game feedback. This is NOT the full alert/toast system — that comes
 * in FEEDBACK-ALERTS-06. This module provides the UI surface where
 * status messages can appear.
 *
 * MVP behavior:
 *   - Shows a single status line (replaces the old PlaytestHud status)
 *   - Messages auto-dismiss after 4 seconds
 *   - Click on the lane dismisses the current message
 *   - Lane is at the bottom of the HUD bar, full width
 */

export class HudStatusLane {
  private container!: HTMLDivElement;
  private textEl!: HTMLSpanElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  create(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'hud-status-lane';
    this.container.innerHTML = this.css() + this.html();

    this.textEl = this.container.querySelector('#hsl-text')!;

    // Click dismisses current message
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clear();
    });
    // Prevent pointer leak
    this.container.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.container.addEventListener('pointerup', (e) => e.stopPropagation());

    parent.appendChild(this.container);
  }

  /**
   * Show a status message. Replaces any current message.
   * Auto-dismisses after 4 seconds.
   */
  showStatus(message: string, _success: boolean): void {
    this.textEl.textContent = message;
    this.container.classList.add('hsl-active');
    this.container.classList.remove('hsl-empty');

    // Auto-dismiss
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.clear(), 4000);
  }

  /** Clear the current status message. */
  clear(): void {
    this.textEl.textContent = '';
    this.container.classList.remove('hsl-active');
    this.container.classList.add('hsl-empty');
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.container?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  private css(): string {
    return `<style>
      #hud-status-lane {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        min-height: 28px;
        background: rgba(8, 12, 18, 0.95);
        border-top: 1px solid rgba(212, 165, 116, 0.15);
        pointer-events: auto;
        user-select: none;
        cursor: default;
        padding: 0 12px;
        transition: background 0.2s ease;
      }
      #hud-status-lane.hsl-empty {
        pointer-events: none;
      }
      #hud-status-lane.hsl-active {
        background: rgba(12, 16, 24, 0.98);
      }
      #hsl-text {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 11px;
        color: #b0b0b0;
        letter-spacing: 0.3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
    </style>`;
  }

  private html(): string {
    return `<span id="hsl-text"></span>`;
  }
}
