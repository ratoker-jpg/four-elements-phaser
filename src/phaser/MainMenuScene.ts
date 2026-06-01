/**
 * MainMenuScene — polished main menu navigation shell.
 *
 * UI-01: Clean industrial sci-fi visual direction with warm bronze/gold
 * primary accent and teal secondary accent. DOM overlay consistent with
 * the project's UI pattern. Pointer cursor on all interactive elements.
 * Focus-visible outlines for keyboard accessibility.
 *
 * ARCH-14B: Provides New Game / Continue / Settings entry points.
 * ARCH-15A: Continue button is enabled when saves exist.
 * ARCH-14C+15B: Save list with delete per slot, Settings with UI Scale.
 *
 * If ?skipMenu or ?autostart is in the URL, auto-advances to
 * GameScene with default settings (for QA smoke test).
 */

import Phaser from 'phaser';
import { DEFAULT_SETUP, shouldSkipMenu, FACTION_CSS_COLORS, loadSetupFromSession, clearSetupSession } from '../state/gameSetup';
import type { GameSetupConfig } from '../state/gameSetup';
import {
  hasSaves,
  getSaveSlotMetas,
  loadGame,
  deleteSave,
  clearAllSaves,
  formatSaveSlotSummary,
  formatSaveTimestamp,
  type SaveSlotMeta,
} from '../state/saveGame';
import type { Faction } from '../state/types';
import {
  loadUiSettings,
  saveUiSettings,
  applyUiScale,
  UI_SCALE_OPTIONS,
} from '../state/uiSettings';

/** UI-01: Shared CSS custom properties for the industrial menu theme. */
const MENU_THEME = {
  bg: '#111827',
  bgOverlay: 'rgba(17, 24, 39, 0.97)',
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

export class MainMenuScene extends Phaser.Scene {
  private container: HTMLDivElement | null = null;
  private saveListContainer: HTMLDivElement | null = null;
  private settingsContainer: HTMLDivElement | null = null;
  private continueBtn: HTMLButtonElement | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // QA/E2E auto-start: skip menu entirely
    if (shouldSkipMenu()) {
      // MENU-01: Check for session config from controlled URL launch
      // When Debug/Arena is selected, NewGameSetupScene saves config to
      // sessionStorage before reloading the page. Restore it here.
      const sessionConfig = loadSetupFromSession();
      if (sessionConfig) {
        clearSetupSession();
        this.startGame(sessionConfig);
      } else {
        this.startGame(DEFAULT_SETUP);
      }
      return;
    }

    // Apply saved UI scale on startup
    const settings = loadUiSettings();
    applyUiScale(settings.uiScale);

    this.cameras.main.setBackgroundColor(MENU_THEME.bg);
    this.createDomOverlay();

    // Register DOM cleanup on scene shutdown so Phaser handles lifecycle
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    console.log('[MainMenuScene] Ready.');
  }

  private createDomOverlay(): void {
    const root = document.createElement('div');
    root.id = 'main-menu';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: ${MENU_THEME.bgOverlay};
      z-index: 30;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
      transform: scale(var(--ui-scale, 1));
      transform-origin: center center;
    `;

    // ── Title area ──────────────────────────────────────────────
    const titleArea = document.createElement('div');
    titleArea.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 56px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Four Elements';
    title.style.cssText = `
      font-size: 52px;
      font-weight: 700;
      color: ${MENU_THEME.titleColor};
      letter-spacing: 4px;
      text-transform: uppercase;
      text-shadow: 0 0 40px rgba(212, 165, 116, 0.15);
    `;
    titleArea.appendChild(title);

    // Decorative line under title
    const titleLine = document.createElement('div');
    titleLine.style.cssText = `
      width: 120px;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${MENU_THEME.primaryAccent}, transparent);
      margin: 16px 0 12px;
    `;
    titleArea.appendChild(titleLine);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Industrial RTS Prototype';
    subtitle.style.cssText = `
      font-size: 13px;
      color: ${MENU_THEME.subtitleColor};
      letter-spacing: 2px;
      text-transform: uppercase;
    `;
    titleArea.appendChild(subtitle);

    root.appendChild(titleArea);

    // ── Button container ────────────────────────────────────────
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 280px;
    `;

    // New Game button — primary (warm bronze/gold)
    const newGameBtn = this.createMenuButton('New Game', 'primary', () => {
      this.scene.start('NewGameSetupScene');
    });
    btnContainer.appendChild(newGameBtn);

    // Continue button — secondary (teal), enabled only if saves exist
    const savesExist = hasSaves();
    this.continueBtn = this.createMenuButton('Continue', 'secondary', savesExist ? () => {
      this.showSaveList();
    } : null, !savesExist);
    btnContainer.appendChild(this.continueBtn);

    // Settings button — secondary (teal)
    const settingsBtn = this.createMenuButton('Settings', 'secondary', () => {
      this.showSettings();
    });
    btnContainer.appendChild(settingsBtn);

    root.appendChild(btnContainer);

    // ── Version footer ──────────────────────────────────────────
    const footer = document.createElement('div');
    footer.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 24px;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    const versionDot = document.createElement('div');
    versionDot.style.cssText = `
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: ${MENU_THEME.primaryAccent};
      opacity: 0.4;
    `;
    footer.appendChild(versionDot);

    const version = document.createElement('div');
    version.textContent = 'v0.1';
    version.style.cssText = `
      font-size: 10px;
      color: ${MENU_THEME.footerColor};
      letter-spacing: 1px;
    `;
    footer.appendChild(version);

    root.appendChild(footer);

    document.body.appendChild(root);
    this.container = root;
  }

  /**
   * UI-01: Create a styled menu button with hover/focus/active states.
   *
   * - 'primary' style: warm bronze/gold accent — for the main action (New Game)
   * - 'secondary' style: teal accent — for secondary actions (Continue, Settings)
   *
   * All interactive buttons get pointer cursor. Disabled buttons show
   * a clear dimmed state with not-allowed cursor.
   */
  private createMenuButton(
    text: string,
    style: 'primary' | 'secondary',
    onClick: (() => void) | null,
    disabled = false,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.disabled = disabled;

    const accent = style === 'primary' ? MENU_THEME.primaryAccent : MENU_THEME.secondaryAccent;

    const baseBg = disabled ? 'rgba(55, 65, 81, 0.3)' : `${accent}0d`;
    const baseBorder = disabled ? 'rgba(55, 65, 81, 0.4)' : `${accent}33`;
    const textColor = disabled ? MENU_THEME.disabledText : accent;

    btn.style.cssText = `
      width: 100%;
      padding: 14px 24px;
      background: ${baseBg};
      border: 1px solid ${baseBorder};
      border-radius: 4px;
      color: ${textColor};
      font-size: 15px;
      font-family: inherit;
      font-weight: ${style === 'primary' ? '600' : '400'};
      letter-spacing: 1px;
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      text-align: center;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
      outline: none;
    `;

    if (!disabled && onClick) {
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

  /**
   * ARCH-15B: Show save list overlay with delete controls.
   * Lists all saves with metadata, allows the player to pick one to load,
   * delete a slot (with confirmation), or clear all saves.
   *
   * UI-01: Styled with industrial panel theme.
   */
  private showSaveList(): void {
    this.hideSaveList();
    this.hideSettings();

    const metas = getSaveSlotMetas();

    const overlay = document.createElement('div');
    overlay.id = 'save-list-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.7);
      z-index: 35;
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
    title.textContent = 'Load Game';
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
      emptyMsg.textContent = 'No saves yet';
      emptyMsg.style.cssText = `
        text-align: center;
        color: ${MENU_THEME.subtitleColor};
        font-size: 13px;
        padding: 24px 0;
      `;
      panel.appendChild(emptyMsg);
    } else {
      for (const meta of metas) {
        const row = this.createSaveRow(meta);
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
      clearAllBtn.textContent = 'Clear All';
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
        if (confirm('Delete all save data? This cannot be undone.')) {
          clearAllSaves();
          this.hideSaveList();
          this.showSaveList();
          this.updateContinueButton();
        }
      });
      btnRow.appendChild(clearAllBtn);
    }

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
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
      this.hideSaveList();
    });
    btnRow.appendChild(backBtn);

    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this.saveListContainer = overlay;
  }

  /** Create a single save slot row for the save list. */
  private createSaveRow(meta: SaveSlotMeta): HTMLDivElement {
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
    nameLine.textContent = `${meta.faction.charAt(0).toUpperCase() + meta.faction.slice(1)} — ${meta.mapName}`;
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
        this.hideSaveList();
        this.scene.start('GameScene', {
          loadedGameState: result.gameState,
          mapId: meta.mapId,
          saveSlotId: meta.id,
        });
      } else {
        console.warn(`[MainMenuScene] Load failed: ${result.message}`);
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
    deleteBtn.textContent = 'Delete';
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
      if (confirm(`Delete this save (${meta.faction} — ${meta.mapName})?`)) {
        deleteSave(meta.id);
        this.hideSaveList();
        this.showSaveList();
        this.updateContinueButton();
      }
    });
    row.appendChild(deleteBtn);

    return row;
  }

  /** Update the Continue button's enabled/disabled state. */
  private updateContinueButton(): void {
    if (!this.continueBtn) return;
    const savesExist = hasSaves();
    this.continueBtn.disabled = !savesExist;
    const accent = MENU_THEME.secondaryAccent;
    this.continueBtn.style.background = savesExist ? `${accent}0d` : 'rgba(55, 65, 81, 0.3)';
    this.continueBtn.style.borderColor = savesExist ? `${accent}33` : 'rgba(55, 65, 81, 0.4)';
    this.continueBtn.style.color = savesExist ? accent : MENU_THEME.disabledText;
    this.continueBtn.style.cursor = savesExist ? 'pointer' : 'not-allowed';
  }

  /**
   * ARCH-14C: Show settings overlay with UI Scale option.
   * UI-01: Styled with industrial panel theme.
   */
  private showSettings(): void {
    this.hideSettings();
    this.hideSaveList();

    const currentSettings = loadUiSettings();

    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.7);
      z-index: 35;
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
      min-width: 340px;
      max-width: 420px;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Settings';
    title.style.cssText = `
      font-size: 20px;
      font-weight: 600;
      color: ${MENU_THEME.secondaryAccent};
      margin-bottom: 24px;
      text-align: center;
      letter-spacing: 1px;
    `;
    panel.appendChild(title);

    // UI Scale section
    const scaleLabel = document.createElement('div');
    scaleLabel.textContent = 'UI Scale';
    scaleLabel.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: ${MENU_THEME.subtitleColor};
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 10px;
    `;
    panel.appendChild(scaleLabel);

    const scaleRow = document.createElement('div');
    scaleRow.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    for (const scaleOption of UI_SCALE_OPTIONS) {
      const btn = document.createElement('button');
      btn.textContent = `${scaleOption}%`;
      const isSelected = scaleOption === currentSettings.uiScale;
      btn.style.cssText = this.scaleButtonStyle(isSelected);

      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${MENU_THEME.secondaryAccent}`;
        btn.style.outlineOffset = '2px';
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('click', () => {
        applyUiScale(scaleOption);
        saveUiSettings({ uiScale: scaleOption });

        const buttons = scaleRow.querySelectorAll('button');
        buttons.forEach(b => {
          b.style.cssText = this.scaleButtonStyle(false);
        });
        btn.style.cssText = this.scaleButtonStyle(true);
      });

      scaleRow.appendChild(btn);
    }
    panel.appendChild(scaleRow);

    // Limitation note
    const note = document.createElement('div');
    note.textContent = 'Applies to DOM overlays. Game canvas zoom is unchanged.';
    note.style.cssText = `
      font-size: 10px;
      color: #4b5563;
      margin-top: 8px;
    `;
    panel.appendChild(note);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
    backBtn.style.cssText = `
      width: 100%;
      margin-top: 24px;
      padding: 12px 16px;
      background: ${MENU_THEME.rowBg};
      border: 1px solid ${MENU_THEME.rowBorder};
      border-radius: 4px;
      color: ${MENU_THEME.subtitleColor};
      font-size: 13px;
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
      this.hideSettings();
    });
    panel.appendChild(backBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this.settingsContainer = overlay;
  }

  private scaleButtonStyle(selected: boolean): string {
    return `
      flex: 1;
      padding: 10px 12px;
      background: ${selected ? `${MENU_THEME.secondaryAccent}1a` : MENU_THEME.rowBg};
      border: 1px solid ${selected ? `${MENU_THEME.secondaryAccent}55` : MENU_THEME.rowBorder};
      border-radius: 4px;
      color: ${selected ? MENU_THEME.secondaryAccent : '#6b7280'};
      font-size: 13px;
      font-family: inherit;
      font-weight: ${selected ? '600' : '400'};
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
      outline: none;
    `;
  }

  /** Hide and remove the save list overlay. */
  private hideSaveList(): void {
    if (this.saveListContainer && this.saveListContainer.parentNode) {
      this.saveListContainer.parentNode.removeChild(this.saveListContainer);
    }
    this.saveListContainer = null;
  }

  /** Hide and remove the settings overlay. */
  private hideSettings(): void {
    if (this.settingsContainer && this.settingsContainer.parentNode) {
      this.settingsContainer.parentNode.removeChild(this.settingsContainer);
    }
    this.settingsContainer = null;
  }

  private startGame(config: GameSetupConfig): void {
    this.scene.start('GameScene', config);
  }

  shutdown(): void {
    this.hideSaveList();
    this.hideSettings();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.continueBtn = null;
  }
}
