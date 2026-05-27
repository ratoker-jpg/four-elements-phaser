/**
 * PauseMenu — lightweight DOM overlay for the pause/Esc menu.
 *
 * ARCH-14B: Provides Continue / Restart / Main Menu options
 * and a hotkey help reference. Opened by Esc during gameplay.
 * Managed by GameScene.
 *
 * ARCH-15A: Added Save button and onSave callback.
 *
 * ARCH-15B: Save feedback now shows "Saved" with timestamp.
 * Clear status on open, no stale status after restart/main menu.
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
      background: rgba(0, 0, 0, 0.6);
      z-index: 40;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
      transform: scale(var(--ui-scale, 1));
      transform-origin: center center;
    `;
    root.style.display = 'none';

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 24px 32px;
      min-width: 280px;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Paused';
    title.style.cssText = `
      font-size: 24px;
      font-weight: 600;
      color: #4fc3f7;
      margin-bottom: 20px;
      text-align: center;
    `;
    panel.appendChild(title);

    // Button container
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
    `;

    // Continue button
    btnContainer.appendChild(this.createMenuButton('Continue', '#81c784', () => {
      this.hide();
      this.callbacks?.onResume();
    }));

    // Save button
    btnContainer.appendChild(this.createMenuButton('Save', '#4fc3f7', () => {
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

    // Restart button
    btnContainer.appendChild(this.createMenuButton('Restart', '#ffcc44', () => {
      this.clearStatus();
      this.hide();
      if (this.config) {
        this.callbacks?.onRestart(this.config);
      }
    }));

    // Main Menu button
    btnContainer.appendChild(this.createMenuButton('Main Menu', '#ef9a9a', () => {
      this.clearStatus();
      this.hide();
      this.callbacks?.onMainMenu();
    }));

    panel.appendChild(btnContainer);

    // Status feedback area (shows "Saved — HH:MM" or "Save failed")
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = `
      min-height: 18px;
      margin-bottom: 8px;
      font-size: 12px;
      text-align: center;
      transition: opacity 0.3s;
      opacity: 0;
    `;
    panel.appendChild(this.statusEl);

    // ── Hotkey help section ──────────────────────────────────────
    const helpDivider = document.createElement('div');
    helpDivider.style.cssText = `
      border-top: 1px solid rgba(255,255,255,0.08);
      margin: 4px 0 12px;
    `;
    panel.appendChild(helpDivider);

    const helpTitle = document.createElement('div');
    helpTitle.textContent = 'Controls';
    helpTitle.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #777;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
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
        color: #4fc3f7;
        white-space: nowrap;
        font-weight: 600;
      `;

      const descEl = document.createElement('span');
      descEl.textContent = desc;
      descEl.style.cssText = `
        color: #999;
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
    this.statusEl.style.color = success ? '#81c784' : '#ef9a9a';
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

  private createMenuButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      width: 100%;
      padding: 10px 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid ${color}33;
      border-radius: 4px;
      color: ${color};
      font-size: 15px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = `${color}15`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.03)';
    });
    btn.addEventListener('click', onClick);

    return btn;
  }
}
