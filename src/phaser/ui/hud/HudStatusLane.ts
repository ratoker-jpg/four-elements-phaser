/**
 * HUD Status Lane — status/toast message area at the bottom of the HUD bar.
 *
 * HUD-LAYOUT-REBUILD-02: Provides a minimal status message area for
 * game feedback.
 *
 * FEEDBACK-ALERTS-06: Upgraded to support typed feedback with severity-
 * based color coding. The new showFeedback() method accepts a
 * FeedbackMessage and colors the text based on severity type.
 * The legacy showStatus() remains backward compatible.
 *
 * MVP behavior:
 *   - Shows a single status line (replaces the old PlaytestHud status)
 *   - Messages auto-dismiss after their duration (default 4 seconds)
 *   - Click on the lane dismisses the current message
 *   - Lane is at the bottom of the HUD bar, full width
 *   - Color-coded by severity: success=green, warning=amber, error=red, info=gray
 */

import type { FeedbackMessage, FeedbackSeverity } from '../../../state/feedbackStore';

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
   * Show a typed feedback message. Replaces any current message.
   * Auto-dismisses after the message's duration.
   * FEEDBACK-ALERTS-06: Color-coded by severity type.
   */
  showFeedback(msg: FeedbackMessage): void {
    this.textEl.textContent = msg.message;
    this.container.classList.add('hsl-active');
    this.container.classList.remove('hsl-empty');

    // Remove any previous severity class
    this.textEl.classList.remove('hsl-success', 'hsl-warning', 'hsl-error', 'hsl-info');

    // Apply severity-based color class
    this.textEl.classList.add(this.severityClass(msg.type));

    // Auto-dismiss after the message's duration
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.clear(), msg.duration);
  }

  /**
   * Show a status message. Replaces any current message.
   * Auto-dismisses after 4 seconds.
   * Backward compatible with existing callers.
   */
  showStatus(message: string, _success: boolean): void {
    this.textEl.textContent = message;
    this.container.classList.add('hsl-active');
    this.container.classList.remove('hsl-empty');

    // Remove any previous severity class, apply info (default gray)
    this.textEl.classList.remove('hsl-success', 'hsl-warning', 'hsl-error', 'hsl-info');
    this.textEl.classList.add('hsl-info');

    // Auto-dismiss
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.clear(), 4000);
  }

  /** Clear the current status message. */
  clear(): void {
    this.textEl.textContent = '';
    this.container.classList.remove('hsl-active');
    this.container.classList.add('hsl-empty');
    this.textEl.classList.remove('hsl-success', 'hsl-warning', 'hsl-error', 'hsl-info');
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

  private severityClass(type: FeedbackSeverity): string {
    return `hsl-${type}`;
  }

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
        transition: color 0.2s ease;
      }
      /* FEEDBACK-ALERTS-06: Severity-based color classes */
      #hsl-text.hsl-info {
        color: #b0b0b0;
      }
      #hsl-text.hsl-success {
        color: #4ade80;
      }
      #hsl-text.hsl-warning {
        color: #fbbf24;
      }
      #hsl-text.hsl-error {
        color: #f87171;
      }
    </style>`;
  }

  private html(): string {
    return `<span id="hsl-text"></span>`;
  }
}
