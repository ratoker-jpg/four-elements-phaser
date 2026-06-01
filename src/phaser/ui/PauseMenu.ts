/**
 * PauseMenu — polished in-game ESC/pause menu overlay.
 *
 * ARCH-14B: Provides Continue / Restart / Main Menu options
 * and a hotkey help reference. Opened by Esc during gameplay.
 * Managed by GameScene.
 *
 * ARCH-15A: Added Save button and onSave callback.
 *
 * ARCH-15B: Save feedback now shows "Saved" with timestamp.
 * Clear status on open, no stale status after restart/main menu.
 *
 * UI-03: Polished to match UI-01/UI-02 industrial sci-fi visual
 * direction. Warm bronze/gold primary accent, teal secondary accent,
 * dark slate overlay. Resume uses primary accent, all other buttons
 * use secondary accent. Load and Settings are shown as disabled
 * placeholders (Save/Continue flow is UI-04). Pointer cursor on all
 * interactive elements. Focus-visible outlines for keyboard
 * accessibility. Clear hover, focus, active, and disabled states.
 */

import type { GameSetupConfig } from '../../state/gameSetup';
import { formatSaveTimestamp } from '../../state/saveGame';

/** Callbacks provided by GameScene for pause menu actions. */
export interface PauseMenuCallbacks {
  /** Resume the game (close menu). */
  onResume: () => void;
  /** Restart the current game with the same setup config. */
  onRestart: (config: GameSetupConfig) => void;
  /** Return to the main menu scene. */
  onMainMenu: () => void;
  /** ARCH-15A: Save the current game. */
  onSave: () => SaveResult;
}

/** Result of a save operation from the pause menu. */
export interface SaveResult {
  success: boolean;
  message: string;
}

/** UI-03: Shared CSS custom properties matching UI-01/UI-02 industrial menu theme. */
const MENU_THEME = {
  bg: '#111827',
  bgOverlay: 'rgba(17, 24, 39, 0.85)',
  titleColor: '#e0f2fe',
  subtitleColor: '#64748b',
  primaryAccent: '#d4a574',
  primaryAccentLight: '#e8c9a0',
  secondaryAccent: '#80cbc4',
  secondaryAccentLight: '#a7d8d2',
  disabledColor: '#374151',
  disabledText: '#4b5563',
  borderColor: 'rgba(212, 165, 116, 0.2)',
  hoverBorder: 'rgba(212, 165, 116, 0.5)',
  focusOutline: '#d4a574',
  dangerColor: '#ef9a9a',
  dangerBg: 'rgba(239, 154, 154, 0.08)',
  dangerBorder: 'rgba(239, 154, 154, 0.2)',
  panelBg: 'rgba(17, 24, 39, 0.97)',
  panelBorder: 'rgba(255, 255, 255, 0.08)',
  rowBg: 'rgba(255, 255, 255, 0.02)',
  rowBorder: 'rgba(255, 255, 255, 0.05)',
  footerColor: '#334155',
} as const;

export class PauseMenu {
  private container: HTMLDivElement | null = null;
  private callbacks: PauseMenuCallbacks | null = null;
  private config: GameSetupConfig | null = null;
  private _visible = false;
  private statusEl: HTMLDivElement | null = null;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether the pause menu is currently shown. */
  get visible(): boolean {
    return this._visible;
  }

  /**
   * Create the pause menu DOM overlay. Call once when GameScene starts.
   */
  create(callbacks: PauseMenuCallbacks, config: GameSetupConfig): void {
    this.destroy();
    this.callbacks = callbacks;
    this.config = config;

    const root = document.createElement('div');
    root.id = 'pause-menu';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: ${MENU_THEME.bgOverlay};
      z-index: 40;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
      transform: scale(var(--ui-scale, 1));
      transform-origin: center center;
    `;
    root.style.display = 'none';

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: ${MENU_THEME.panelBg};
      border: 1px solid ${MENU_THEME.panelBorder};
      border-radius: 8px;
      padding: 28px 32px;
      min-width: 300px;
      max-width: 380px;
    `;

    // ── Title area ──────────────────────────────────────────────
    const titleArea = document.createElement('div');
    titleArea.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Game Paused';
    title.style.cssText = `
      font-size: 24px;
      font-weight: 700;
      color: ${MENU_THEME.titleColor};
      letter-spacing: 2px;
      text-transform: uppercase;
    `;
    titleArea.appendChild(title);

    // Decorative line under title (matching UI-01/UI-02 style)
    const titleLine = document.createElement('div');
    titleLine.style.cssText = `
      width: 60px;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${MENU_THEME.primaryAccent}, transparent);
      margin: 12px 0 0;
    `;
    titleArea.appendChild(titleLine);

    panel.appendChild(titleArea);

    // ── Button container ────────────────────────────────────────
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    // Resume button — primary (warm bronze/gold)
    btnContainer.appendChild(this.createMenuButton('Resume', 'primary', () => {
      this.hide();
      this.callbacks?.onResume();
    }));

    // Save button — secondary (teal), functional
    btnContainer.appendChild(this.createMenuButton('Save', 'secondary', () => {
      const result = this.callbacks?.onSave();
      if (result) {
        if (result.success) {
          // ARCH-15B: Show timestamp with success message
          const now = new Date().toISOString();
          this.showStatus(`Saved — ${formatSaveTimestamp(now)}`, true);
        } else {
          this.showStatus('Save failed', false);
        }
      }
    }));

    // Load button — secondary, disabled placeholder (UI-04)
    btnContainer.appendChild(this.createMenuButton('Load', 'secondary', null, true));

    // Settings button — secondary, disabled placeholder
    btnContainer.appendChild(this.createMenuButton('Settings', 'secondary', null, true));

    // Restart button — secondary (teal)
    btnContainer.appendChild(this.createMenuButton('Restart', 'secondary', () => {
      this.clearStatus();
      this.hide();
      if (this.config) {
        this.callbacks?.onRestart(this.config);
      }
    }));

    // Main Menu button — danger style (returns to menu, losing unsaved progress)
    btnContainer.appendChild(this.createMenuButton('Main Menu', 'danger', () => {
      this.clearStatus();
      this.hide();
      this.callbacks?.onMainMenu();
    }));

    panel.appendChild(btnContainer);

    // ── Status feedback area ────────────────────────────────────
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = `
      min-height: 18px;
      margin-top: 8px;
      font-size: 12px;
      text-align: center;
      transition: opacity 0.3s;
      opacity: 0;
    `;
    panel.appendChild(this.statusEl);

    // ── Esc hint ────────────────────────────────────────────────
    const escHint = document.createElement('div');
    escHint.textContent = 'Esc to resume';
    escHint.style.cssText = `
      margin-top: 12px;
      font-size: 11px;
      color: ${MENU_THEME.subtitleColor};
      text-align: center;
      letter-spacing: 0.5px;
    `;
    panel.appendChild(escHint);

    // ── Divider before hotkey help ──────────────────────────────
    const helpDivider = document.createElement('div');
    helpDivider.style.cssText = `
      border-top: 1px solid ${MENU_THEME.panelBorder};
      margin: 16px 0 12px;
    `;
    panel.appendChild(helpDivider);

    // ── Hotkey help section ─────────────────────────────────────
    const helpTitle = document.createElement('div');
    helpTitle.textContent = 'Controls';
    helpTitle.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: ${MENU_THEME.subtitleColor};
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 10px;
    `;
    panel.appendChild(helpTitle);

    const hotkeys = [
      ['B / P / F', 'Build Separator / Power Plant / Factory'],
      ['N / G', 'Produce Builder / Harvester'],
      ['LMB', 'Select unit / Move command'],
      ['Wheel', 'Zoom in/out'],
      ['Drag', 'Pan camera'],
      ['R', 'Reset camera to HQ'],
      ['T', 'Toggle debug overlay'],
      ['Esc', 'Pause / Resume'],
    ];

    const helpList = document.createElement('div');
    helpList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 3px;
    `;

    for (const [key, desc] of hotkeys) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 11px;
        line-height: 1.4;
      `;

      const keyEl = document.createElement('span');
      keyEl.textContent = key;
      keyEl.style.cssText = `
        color: ${MENU_THEME.secondaryAccent};
        white-space: nowrap;
        font-weight: 600;
      `;

      const descEl = document.createElement('span');
      descEl.textContent = desc;
      descEl.style.cssText = `
        color: ${MENU_THEME.subtitleColor};
        text-align: right;
      `;

      row.appendChild(keyEl);
      row.appendChild(descEl);
      helpList.appendChild(row);
    }

    panel.appendChild(helpList);
    root.appendChild(panel);

    document.body.appendChild(root);
    this.container = root;
  }

  /** Show the pause menu. Clears stale status. */
  show(): void {
    this.clearStatus();
    if (this.container) {
      this.container.style.display = 'flex';
      this._visible = true;
    }
  }

  /** Hide the pause menu. */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this._visible = false;
    }
  }

  /** Toggle the pause menu visibility. */
  toggle(): void {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Show a brief status message (e.g. "Saved — HH:MM" / "Save failed"). */
  private showStatus(message: string, success: boolean): void {
    if (!this.statusEl) return;

    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }

    this.statusEl.textContent = message;
    this.statusEl.style.color = success ? MENU_THEME.secondaryAccent : MENU_THEME.dangerColor;
    this.statusEl.style.opacity = '1';

    this.statusTimer = setTimeout(() => {
      if (this.statusEl) {
        this.statusEl.style.opacity = '0';
      }
    }, 3000);
  }

  /** Clear the status message immediately. */
  private clearStatus(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.statusEl) {
      this.statusEl.textContent = '';
      this.statusEl.style.opacity = '0';
    }
  }

  /** Remove the pause menu DOM overlay. Call on GameScene shutdown. */
  destroy(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this._visible = false;
    this.callbacks = null;
    this.config = null;
    this.statusEl = null;
  }

  /**
   * UI-03: Create a styled menu button with hover/focus/active states.
   * Matches the UI-01/UI-02 industrial sci-fi theme.
   *
   * - 'primary' style: warm bronze/gold accent — for Resume (main action)
   * - 'secondary' style: teal accent — for Save, Load, Settings, Restart
   * - 'danger' style: soft red accent — for Main Menu (leaves game)
   *
   * Disabled buttons show a clear dimmed state with not-allowed cursor
   * and a small "Coming soon" label.
   */
  private createMenuButton(
    text: string,
    style: 'primary' | 'secondary' | 'danger',
    onClick: (() => void) | null,
    disabled = false,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.disabled = disabled;

    const accent = style === 'primary'
      ? MENU_THEME.primaryAccent
      : style === 'danger'
        ? MENU_THEME.dangerColor
        : MENU_THEME.secondaryAccent;

    const baseBg = disabled ? 'rgba(55, 65, 81, 0.3)' : `${accent}0d`;
    const baseBorder = disabled ? 'rgba(55, 65, 81, 0.4)' : `${accent}33`;
    const textColor = disabled ? MENU_THEME.disabledText : accent;

    btn.style.cssText = `
      width: 100%;
      padding: 12px 20px;
      background: ${baseBg};
      border: 1px solid ${baseBorder};
      border-radius: 4px;
      color: ${textColor};
      font-size: 14px;
      font-family: inherit;
      font-weight: ${style === 'primary' ? '600' : '400'};
      letter-spacing: 0.5px;
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      text-align: center;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
      outline: none;
    `;

    // Disabled placeholder: show label text + subtle "Coming soon" suffix
    if (disabled) {
      btn.textContent = `${text}`;
      const suffix = document.createElement('span');
      suffix.textContent = ' — coming soon';
      suffix.style.cssText = `
        font-size: 10px;
        color: ${MENU_THEME.disabledText};
        margin-left: 6px;
      `;
      btn.appendChild(suffix);
      return btn;
    }

    btn.textContent = text;

    if (onClick) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = `${accent}1a`;
        btn.style.borderColor = `${accent}55`;
        if (style === 'primary') {
          btn.style.boxShadow = `0 0 20px ${accent}15`;
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = baseBg;
        btn.style.borderColor = baseBorder;
        btn.style.boxShadow = 'none';
      });
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
        btn.style.outlineOffset = '2px';
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('mousedown', () => {
        btn.style.background = `${accent}26`;
      });
      btn.addEventListener('mouseup', () => {
        btn.style.background = `${accent}1a`;
      });
      btn.addEventListener('click', onClick);
    }

    return btn;
  }
}
