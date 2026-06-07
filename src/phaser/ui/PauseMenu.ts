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
 *
 * UI-04: Load button is now functional — opens a save slot list
 * allowing in-game load of any existing save. Load uses existing
 * loadGame flow from saveGame module. Save slot list styled
 * consistently with MainMenuScene's save list. Settings remains
 * a disabled placeholder.
 */

import type { GameSetupConfig } from '../../state/gameSetup';
import type { Faction } from '../../state/types';
import { FACTION_CSS_COLORS } from '../../state/gameSetup';
import { t, FACTION_DISPLAY } from '../../config/localization';
import {
  hasSaves,
  getSaveSlotMetas,
  loadGame,
  deleteSave,
  clearAllSaves,
  formatSaveSlotSummary,
  formatSaveTimestamp,
  type SaveSlotMeta,
} from '../../state/saveGame';

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
  /** UI-04: Load a saved game. Called when player selects a save slot from in-game load list. */
  onLoad: (gameState: import('../../state/types').GameState, mapId: string, saveSlotId: string) => void;
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
  /** UI-04: In-game load overlay container. */
  private loadListContainer: HTMLDivElement | null = null;
  /** UI-04-fixup: Reference to Load button so we can refresh its enabled/disabled state. */
  private loadButton: HTMLButtonElement | null = null;

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
    title.textContent = t('pause_title');
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
    btnContainer.appendChild(this.createMenuButton(t('pause_resume'), 'primary', () => {
      this.hide();
      this.callbacks?.onResume();
    }));

    // Save button — secondary (teal), functional
    btnContainer.appendChild(this.createMenuButton(t('pause_save'), 'secondary', () => {
      const result = this.callbacks?.onSave();
      if (result) {
        if (result.success) {
          // ARCH-15B: Show timestamp with success message
          const now = new Date().toISOString();
          this.showStatus(`${t('pause_saved')} — ${formatSaveTimestamp(now)}`, true);
          // UI-04-fixup: After successful save, refresh Load button state
          this.refreshLoadButtonState();
        } else {
          this.showStatus(t('pause_saveFailed'), false);
        }
      }
    }));

    // UI-04: Load button — secondary (teal), opens save slot list
    // Enabled only when saves exist; disabled with clear label when no saves
    const savesExist = hasSaves();
    const loadBtn = this.createMenuButton(t('pause_load'), 'secondary', savesExist ? () => {
      this.showLoadList();
    } : null, !savesExist);
    this.loadButton = loadBtn;
    btnContainer.appendChild(loadBtn);
    // Ensure initial state matches current hasSaves()
    this.refreshLoadButtonState();

    // Settings button — secondary, disabled placeholder
    btnContainer.appendChild(this.createMenuButton(t('pause_settings'), 'secondary', null, true));

    // Restart button — secondary (teal)
    btnContainer.appendChild(this.createMenuButton(t('pause_restart'), 'secondary', () => {
      this.clearStatus();
      this.hide();
      if (this.config) {
        this.callbacks?.onRestart(this.config);
      }
    }));

    // Main Menu button — danger style (returns to menu, losing unsaved progress)
    btnContainer.appendChild(this.createMenuButton(t('pause_mainMenu'), 'danger', () => {
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
    escHint.textContent = t('pause_escHint');
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
    helpTitle.textContent = t('pause_controls');
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
      ['B / P / F', t('pause_hotkeyBuild')],
      ['N / G', t('pause_hotkeyProduce')],
      ['LMB', t('pause_hotkeySelect')],
      ['Wheel', t('pause_hotkeyZoom')],
      ['Drag', t('pause_hotkeyPan')],
      ['R', t('pause_hotkeyResetCam')],
      ['T', t('pause_hotkeyDebug')],
      ['Esc', t('pause_hotkeyEsc')],
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

  /** Show the pause menu. Clears stale status. UI-04: Also refreshes Load button state. */
  show(): void {
    this.clearStatus();
    this.hideLoadList();
    this.refreshLoadButtonState();
    if (this.container) {
      this.container.style.display = 'flex';
      this._visible = true;
    }
  }

  /** Hide the pause menu. UI-04: Also hides load list if open. */
  hide(): void {
    this.hideLoadList();
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
    this.hideLoadList();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this._visible = false;
    this.callbacks = null;
    this.config = null;
    this.statusEl = null;
    this.loadButton = null;
  }

  // ── UI-04: In-game Load save slot list ──────────────────────────

  /**
   * UI-04: Show the load save slot list overlay.
   * Lists all saves with metadata, allows the player to pick one to load,
   * or delete a slot. Styled consistently with MainMenuScene's save list
   * and the industrial sci-fi theme.
   */
  private showLoadList(): void {
    this.hideLoadList();

    const metas = getSaveSlotMetas();

    const overlay = document.createElement('div');
    overlay.id = 'load-list-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.6);
      z-index: 45;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
      transform: scale(var(--ui-scale, 1));
      transform-origin: center center;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: ${MENU_THEME.panelBg};
      border: 1px solid ${MENU_THEME.panelBorder};
      border-radius: 8px;
      padding: 28px 32px;
      min-width: 380px;
      max-width: 460px;
      max-height: 70vh;
      overflow-y: auto;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = t('pause_loadGame');
    title.style.cssText = `
      font-size: 20px;
      font-weight: 600;
      color: ${MENU_THEME.secondaryAccent};
      margin-bottom: 20px;
      text-align: center;
      letter-spacing: 1px;
    `;
    panel.appendChild(title);

    if (metas.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = t('pause_noSaves');
      emptyMsg.style.cssText = `
        text-align: center;
        color: ${MENU_THEME.subtitleColor};
        font-size: 13px;
        padding: 24px 0;
      `;
      panel.appendChild(emptyMsg);
    } else {
      // Warning about unsaved progress
      const warning = document.createElement('div');
      warning.textContent = t('pause_loadWarning');
      warning.style.cssText = `
        text-align: center;
        color: ${MENU_THEME.dangerColor};
        font-size: 11px;
        margin-bottom: 16px;
        opacity: 0.8;
      `;
      panel.appendChild(warning);

      for (const meta of metas) {
        const row = this.createLoadRow(meta);
        panel.appendChild(row);
      }
    }

    // Button row: Clear All + Back
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
      display: flex;
      gap: 10px;
      margin-top: 16px;
    `;

    if (metas.length > 0) {
      const clearAllBtn = document.createElement('button');
      clearAllBtn.textContent = t('pause_clearAll');
      clearAllBtn.style.cssText = `
        flex: 1;
        padding: 10px 12px;
        background: ${MENU_THEME.dangerBg};
        border: 1px solid ${MENU_THEME.dangerBorder};
        border-radius: 4px;
        color: ${MENU_THEME.dangerColor};
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        text-align: center;
        letter-spacing: 0.5px;
        transition: background 0.15s;
        outline: none;
      `;
      clearAllBtn.addEventListener('focus', () => {
        clearAllBtn.style.outline = `2px solid ${MENU_THEME.dangerColor}`;
        clearAllBtn.style.outlineOffset = '2px';
      });
      clearAllBtn.addEventListener('blur', () => {
        clearAllBtn.style.outline = 'none';
      });
      clearAllBtn.addEventListener('mouseenter', () => {
        clearAllBtn.style.background = 'rgba(239, 154, 154, 0.16)';
      });
      clearAllBtn.addEventListener('mouseleave', () => {
        clearAllBtn.style.background = MENU_THEME.dangerBg;
      });
      clearAllBtn.addEventListener('click', () => {
        if (confirm(t('menu_clearAllConfirm'))) {
          clearAllSaves();
          // UI-04-fixup: Refresh Load button after clearing all saves
          this.refreshLoadButtonState();
          this.hideLoadList();
          this.showLoadList();
        }
      });
      btnRow.appendChild(clearAllBtn);
    }

    const backBtn = document.createElement('button');
    backBtn.textContent = t('pause_back');
    backBtn.style.cssText = `
      flex: 1;
      padding: 10px 12px;
      background: ${MENU_THEME.rowBg};
      border: 1px solid ${MENU_THEME.rowBorder};
      border-radius: 4px;
      color: ${MENU_THEME.subtitleColor};
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      letter-spacing: 0.5px;
      transition: background 0.15s;
      outline: none;
    `;
    backBtn.addEventListener('focus', () => {
      backBtn.style.outline = `2px solid ${MENU_THEME.secondaryAccent}`;
      backBtn.style.outlineOffset = '2px';
    });
    backBtn.addEventListener('blur', () => {
      backBtn.style.outline = 'none';
    });
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(255,255,255,0.06)';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = MENU_THEME.rowBg;
    });
    backBtn.addEventListener('click', () => {
      this.hideLoadList();
    });
    btnRow.appendChild(backBtn);

    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this.loadListContainer = overlay;
  }

  /** UI-04: Create a single save slot row for the in-game load list. */
  private createLoadRow(meta: SaveSlotMeta): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 6px;
      background: ${MENU_THEME.rowBg};
      border: 1px solid ${MENU_THEME.rowBorder};
      border-radius: 4px;
      transition: background 0.15s, border-color 0.15s;
    `;

    const factionColor = FACTION_CSS_COLORS[meta.faction as Faction] ?? MENU_THEME.secondaryAccent;

    // Left: info (clickable to load)
    const info = document.createElement('div');
    info.style.cssText = 'flex: 1; cursor: pointer;';

    const nameLine = document.createElement('div');
    nameLine.style.cssText = `font-size: 13px; font-weight: 600; color: ${factionColor};`;
    nameLine.textContent = `${FACTION_DISPLAY[meta.faction as Faction] ?? meta.faction} — ${meta.mapName}`;
    info.appendChild(nameLine);

    const detailLine = document.createElement('div');
    detailLine.style.cssText = 'font-size: 10px; color: #6b7280; margin-top: 2px;';
    detailLine.textContent = formatSaveSlotSummary(meta.summary);
    info.appendChild(detailLine);

    const timeLine = document.createElement('div');
    timeLine.style.cssText = 'font-size: 10px; color: #4b5563; margin-top: 1px;';
    timeLine.textContent = formatSaveTimestamp(meta.updatedAt);
    info.appendChild(timeLine);

    // Click to load
    info.addEventListener('click', () => {
      const result = loadGame(meta.id);
      if (result.success && result.gameState) {
        this.hideLoadList();
        this.hide();
        this.callbacks?.onLoad(result.gameState, meta.mapId, meta.id);
      } else {
        this.showStatus(`Load failed: ${result.message}`, false);
      }
    });

    info.addEventListener('mouseenter', () => {
      row.style.background = 'rgba(128, 203, 196, 0.06)';
      row.style.borderColor = 'rgba(128, 203, 196, 0.15)';
    });
    info.addEventListener('mouseleave', () => {
      row.style.background = MENU_THEME.rowBg;
      row.style.borderColor = MENU_THEME.rowBorder;
    });

    row.appendChild(info);

    // Right: delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = t('pause_delete');
    deleteBtn.style.cssText = `
      padding: 4px 8px;
      background: ${MENU_THEME.dangerBg};
      border: 1px solid ${MENU_THEME.dangerBorder};
      border-radius: 3px;
      color: ${MENU_THEME.dangerColor};
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      margin-left: 8px;
      flex-shrink: 0;
      transition: background 0.15s;
      outline: none;
    `;
    deleteBtn.addEventListener('focus', () => {
      deleteBtn.style.outline = `2px solid ${MENU_THEME.dangerColor}`;
      deleteBtn.style.outlineOffset = '1px';
    });
    deleteBtn.addEventListener('blur', () => {
      deleteBtn.style.outline = 'none';
    });
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.background = 'rgba(239, 154, 154, 0.16)';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.background = MENU_THEME.dangerBg;
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`${t('menu_deleteConfirm')} (${FACTION_DISPLAY[meta.faction as Faction] ?? meta.faction} — ${meta.mapName})?`)) {
        deleteSave(meta.id);
        // UI-04-fixup: Refresh Load button after deleting a save
        this.refreshLoadButtonState();
        this.hideLoadList();
        this.showLoadList();
      }
    });
    row.appendChild(deleteBtn);

    return row;
  }

  /** UI-04: Hide and remove the load save slot list overlay. */
  private hideLoadList(): void {
    if (this.loadListContainer && this.loadListContainer.parentNode) {
      this.loadListContainer.parentNode.removeChild(this.loadListContainer);
    }
    this.loadListContainer = null;
    // UI-04-fixup: Refresh Load button state after closing the load list
    this.refreshLoadButtonState();
  }

  /**
   * UI-04-fixup: Refresh the Load button's enabled/disabled state based on current hasSaves().
   * Called after save, delete, clear-all, show, and hideLoadList to keep the
   * button state in sync with the actual save data without recreating the button.
   */
  private refreshLoadButtonState(): void {
    const btn = this.loadButton;
    if (!btn) return;

    const savesExist = hasSaves();

    if (savesExist) {
      btn.disabled = false;
      // Clear any disabled-state suffix and set normal text
      btn.textContent = t('pause_load');
      btn.style.cursor = 'pointer';
      btn.style.background = `${MENU_THEME.secondaryAccent}0d`;
      btn.style.borderColor = `${MENU_THEME.secondaryAccent}33`;
      btn.style.color = MENU_THEME.secondaryAccent;
      // Re-attach the click handler if it wasn't already there — we do this
      // by swapping to a clone to drop old listeners, then adding the fresh one.
      const newBtn = btn.cloneNode(true) as HTMLButtonElement;
      newBtn.addEventListener('click', () => {
        this.showLoadList();
      });
      // Re-attach hover/focus/active states for enabled button
      const accent = MENU_THEME.secondaryAccent;
      const baseBg = `${accent}0d`;
      const baseBorder = `${accent}33`;
      newBtn.addEventListener('mouseenter', () => {
        newBtn.style.background = `${accent}1a`;
        newBtn.style.borderColor = `${accent}55`;
      });
      newBtn.addEventListener('mouseleave', () => {
        newBtn.style.background = baseBg;
        newBtn.style.borderColor = baseBorder;
        newBtn.style.boxShadow = 'none';
      });
      newBtn.addEventListener('focus', () => {
        newBtn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
        newBtn.style.outlineOffset = '2px';
      });
      newBtn.addEventListener('blur', () => {
        newBtn.style.outline = 'none';
      });
      newBtn.addEventListener('mousedown', () => {
        newBtn.style.background = `${accent}26`;
      });
      newBtn.addEventListener('mouseup', () => {
        newBtn.style.background = `${accent}1a`;
      });
      btn.parentNode?.replaceChild(newBtn, btn);
      this.loadButton = newBtn;
    } else {
      btn.disabled = true;
      btn.textContent = t('pause_load');
      const suffix = document.createElement('span');
      suffix.textContent = ` — ${t('pause_noSavesSuffix')}`;
      suffix.style.cssText = `
        font-size: 10px;
        color: ${MENU_THEME.disabledText};
        margin-left: 6px;
      `;
      btn.appendChild(suffix);
      btn.style.cursor = 'not-allowed';
      btn.style.background = 'rgba(55, 65, 81, 0.3)';
      btn.style.borderColor = 'rgba(55, 65, 81, 0.4)';
      btn.style.color = MENU_THEME.disabledText;
      // Remove any existing click listeners by cloning without events
      const newBtn = btn.cloneNode(true) as HTMLButtonElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      this.loadButton = newBtn;
    }
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

    // Disabled placeholder: show label text + subtle context suffix
    if (disabled) {
      btn.textContent = `${text}`;
      const suffix = document.createElement('span');
      // UI-04: Load with no saves shows "No saves" instead of generic "coming soon"
      const suffixText = text === t('pause_load') ? ` — ${t('pause_noSavesSuffix')}` : ` — ${t('pause_comingSoon')}`;
      suffix.textContent = suffixText;
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
