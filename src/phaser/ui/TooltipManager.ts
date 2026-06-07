/**
 * TooltipManager — lightweight DOM tooltip system for UI elements.
 *
 * CORE-STEP-01C: Provides a single shared tooltip that attaches to
 * DOM elements on demand. Tooltip text comes from localization.ts keys.
 *
 * Rules:
 * - One shared tooltip DOM element, reused for all targets.
 * - attach/detach pattern for clean lifecycle.
 * - destroy() on scene shutdown to prevent memory leaks.
 * - Tooltip does not block gameplay input (pointer-events: none).
 * - Tooltip text is localized through localization.ts.
 */

const TOOLTIP_STYLE = `
  position: fixed;
  z-index: 100;
  background: rgba(17, 24, 39, 0.95);
  border: 1px solid rgba(212, 165, 116, 0.25);
  border-radius: 4px;
  padding: 6px 10px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 11px;
  line-height: 1.4;
  color: #c0c0c0;
  max-width: 240px;
  pointer-events: none;
  user-select: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  white-space: pre-line;
  opacity: 0;
  transition: opacity 0.15s;
`;

type ListenerPair = [() => void, () => void];

export class TooltipManager {
  private tooltipEl: HTMLDivElement | null = null;
  private attachments: Map<HTMLElement, ListenerPair> = new Map();
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  /** Initialize the shared tooltip DOM element. Call once. */
  init(): void {
    if (this.tooltipEl) return;
    const el = document.createElement('div');
    el.className = 'ui-tooltip';
    el.style.cssText = TOOLTIP_STYLE;
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
    this.tooltipEl = el;
  }

  /**
   * Attach a tooltip to a DOM element.
   * On hover, the tooltip shows the provided text near the element.
   * Text should come from t('tooltip_key') for localization.
   */
  attach(element: HTMLElement, text: string): void {
    this.init();

    // Remove previous attachment for this element if any
    this.detach(element);

    const showHandler = () => this.show(text, element);
    const hideHandler = () => this.hide();

    element.addEventListener('mouseenter', showHandler);
    element.addEventListener('mouseleave', hideHandler);
    element.addEventListener('focus', showHandler);
    element.addEventListener('blur', hideHandler);

    this.attachments.set(element, [showHandler, hideHandler]);
  }

  /**
   * Detach tooltip listeners from a DOM element.
   */
  detach(element: HTMLElement): void {
    const pair = this.attachments.get(element);
    if (!pair) return;
    element.removeEventListener('mouseenter', pair[0]);
    element.removeEventListener('mouseleave', pair[1]);
    element.removeEventListener('focus', pair[0]);
    element.removeEventListener('blur', pair[1]);
    this.attachments.delete(element);
  }

  /**
   * Destroy the tooltip manager. Removes all listeners and the DOM element.
   * Call on scene shutdown.
   */
  destroy(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    for (const [element, pair] of this.attachments) {
      element.removeEventListener('mouseenter', pair[0]);
      element.removeEventListener('mouseleave', pair[1]);
      element.removeEventListener('focus', pair[0]);
      element.removeEventListener('blur', pair[1]);
    }
    this.attachments.clear();
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;
  }

  private show(text: string, anchor: HTMLElement): void {
    if (!this.tooltipEl) return;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.tooltipEl.textContent = text;
    this.tooltipEl.style.opacity = '1';

    // Position below the element, slightly right
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left + 4;

    // Clamp to viewport
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    if (top + tooltipRect.height > window.innerHeight - 8) {
      top = rect.top - tooltipRect.height - 6;
    }
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }
    if (left < 8) left = 8;

    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
  }

  private hide(): void {
    if (!this.tooltipEl) return;
    // Small delay to avoid flicker when moving between adjacent elements
    this.hideTimer = setTimeout(() => {
      if (this.tooltipEl) {
        this.tooltipEl.style.opacity = '0';
      }
    }, 80);
  }
}
