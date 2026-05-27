/**
 * MainMenuScene — lightweight main menu.
 *
 * ARCH-14B: Provides New Game / Continue / Settings entry points.
 * Uses DOM overlay (consistent with PlaytestHud pattern).
 * No images, no art assets — simple and readable only.
 *
 * If ?skipMenu or ?autostart is in the URL, auto-advances to
 * GameScene with default settings (for QA smoke test).
 *
 * ARCH-15A: Continue button is enabled when saves exist.
 * Clicking Continue shows a save list overlay where the player
 * can select a save to load.
 *
 * ARCH-14C+15B: Save list now shows empty state, delete per slot
 * with confirmation, clear all saves, and richer slot summaries.
 * Settings screen now has UI Scale (100/125/150%).
 */

import Phaser from 'phaser';
import { DEFAULT_SETUP, shouldSkipMenu, FACTION_CSS_COLORS } from '../state/gameSetup';
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
      this.startGame(DEFAULT_SETUP);
      return;
    }

    // Apply saved UI scale on startup
    const settings = loadUiSettings();
    applyUiScale(settings.uiScale);

    this.cameras.main.setBackgroundColor('#1a1a2e');
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
      background: rgba(26, 26, 46, 0.95);
      z-index: 30;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
      transform: scale(var(--ui-scale, 1));
      transform-origin: center center;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Four Elements';
    title.style.cssText = `
      font-size: 48px;
      font-weight: 700;
      color: #4fc3f7;
      margin-bottom: 40px;
      letter-spacing: 2px;
    `;
    root.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = 'Phaser Prototype';
    subtitle.style.cssText = `
      font-size: 14px;
      color: #666;
      margin-bottom: 48px;
    `;
    root.appendChild(subtitle);

    // Button container
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 260px;
    `;

    // New Game button
    const newGameBtn = this.createButton('New Game', '#4fc3f7', () => {
      this.scene.start('NewGameSetupScene');
    });
    btnContainer.appendChild(newGameBtn);

    // Continue button — enabled only if saves exist
    const savesExist = hasSaves();
    this.continueBtn = this.createButton('Continue', '#81c784', savesExist ? () => {
      this.showSaveList();
    } : null, !savesExist);
    btnContainer.appendChild(this.continueBtn);

    // Settings button — now functional
    const settingsBtn = this.createButton('Settings', '#4fc3f7', () => {
      this.showSettings();
    });
    btnContainer.appendChild(settingsBtn);

    root.appendChild(btnContainer);

    // Version hint
    const version = document.createElement('div');
    version.textContent = 'v0.1 — ARCH-14C-15B';
    version.style.cssText = `
      position: absolute;
      bottom: 16px;
      font-size: 10px;
      color: #444;
    `;
    root.appendChild(version);

    document.body.appendChild(root);
    this.container = root;
  }

  /**
   * ARCH-15B: Show save list overlay with delete controls.
   * Lists all saves with metadata, allows the player to pick one to load,
   * delete a slot (with confirmation), or clear all saves.
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
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 24px 28px;
      min-width: 380px;
      max-width: 460px;
      max-height: 70vh;
      overflow-y: auto;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Load Game';
    title.style.cssText = `
      font-size: 22px;
      font-weight: 600;
      color: #4fc3f7;
      margin-bottom: 16px;
      text-align: center;
    `;
    panel.appendChild(title);

    if (metas.length === 0) {
      // ARCH-15B: Empty state
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'No saves yet';
      emptyMsg.style.cssText = `
        text-align: center;
        color: #666;
        font-size: 14px;
        padding: 20px 0;
      `;
      panel.appendChild(emptyMsg);
    } else {
      // Save slots
      for (const meta of metas) {
        const row = this.createSaveRow(meta);
        panel.appendChild(row);
      }
    }

    // Button row: Clear All + Back
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 12px;
    `;

    // Clear All button (only if saves exist)
    if (metas.length > 0) {
      const clearAllBtn = document.createElement('button');
      clearAllBtn.textContent = 'Clear All';
      clearAllBtn.style.cssText = `
        flex: 1;
        padding: 10px 12px;
        background: rgba(239, 154, 154, 0.1);
        border: 1px solid rgba(239, 154, 154, 0.25);
        border-radius: 4px;
        color: #ef9a9a;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
        text-align: center;
        transition: background 0.15s;
      `;
      clearAllBtn.addEventListener('mouseenter', () => {
        clearAllBtn.style.background = 'rgba(239, 154, 154, 0.2)';
      });
      clearAllBtn.addEventListener('mouseleave', () => {
        clearAllBtn.style.background = 'rgba(239, 154, 154, 0.1)';
      });
      clearAllBtn.addEventListener('click', () => {
        if (confirm('Delete all save data? This cannot be undone.')) {
          clearAllSaves();
          // Refresh the save list
          this.hideSaveList();
          this.showSaveList();
          this.updateContinueButton();
        }
      });
      btnRow.appendChild(clearAllBtn);
    }

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
    backBtn.style.cssText = `
      flex: 1;
      padding: 10px 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px;
      color: #999;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s;
    `;
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(255,255,255,0.08)';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'rgba(255,255,255,0.03)';
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
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px;
      transition: background 0.15s, border-color 0.15s;
    `;

    const factionColor = FACTION_CSS_COLORS[meta.faction as Faction] ?? '#4fc3f7';

    // Left: info (clickable to load)
    const info = document.createElement('div');
    info.style.cssText = 'flex: 1; cursor: pointer;';

    const nameLine = document.createElement('div');
    nameLine.style.cssText = `font-size: 13px; font-weight: 600; color: ${factionColor};`;
    nameLine.textContent = `${meta.faction.charAt(0).toUpperCase() + meta.faction.slice(1)} — ${meta.mapName}`;
    info.appendChild(nameLine);

    const detailLine = document.createElement('div');
    detailLine.style.cssText = 'font-size: 10px; color: #888; margin-top: 2px;';
    detailLine.textContent = formatSaveSlotSummary(meta.summary);
    info.appendChild(detailLine);

    const timeLine = document.createElement('div');
    timeLine.style.cssText = 'font-size: 10px; color: #666; margin-top: 1px;';
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
      row.style.background = 'rgba(79, 195, 247, 0.08)';
      row.style.borderColor = 'rgba(79, 195, 247, 0.2)';
    });
    info.addEventListener('mouseleave', () => {
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.borderColor = 'rgba(255,255,255,0.08)';
    });

    row.appendChild(info);

    // Right: delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = `
      padding: 4px 8px;
      background: rgba(239, 154, 154, 0.08);
      border: 1px solid rgba(239, 154, 154, 0.2);
      border-radius: 3px;
      color: #ef9a9a;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      margin-left: 8px;
      flex-shrink: 0;
      transition: background 0.15s;
    `;
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.background = 'rgba(239, 154, 154, 0.2)';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.background = 'rgba(239, 154, 154, 0.08)';
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete this save (${meta.faction} — ${meta.mapName})?`)) {
        deleteSave(meta.id);
        // Refresh the save list
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
    this.continueBtn.style.background = savesExist ? 'rgba(129, 199, 132, 0.1)' : 'rgba(100,100,100,0.1)';
    this.continueBtn.style.borderColor = savesExist ? 'rgba(129, 199, 132, 0.3)' : 'rgba(100,100,100,0.2)';
    this.continueBtn.style.color = savesExist ? '#81c784' : '#555';
    this.continueBtn.style.cursor = savesExist ? 'pointer' : 'not-allowed';
  }

  /**
   * ARCH-14C: Show settings overlay with UI Scale option.
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
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 24px 28px;
      min-width: 340px;
      max-width: 420px;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Settings';
    title.style.cssText = `
      font-size: 22px;
      font-weight: 600;
      color: #4fc3f7;
      margin-bottom: 20px;
      text-align: center;
    `;
    panel.appendChild(title);

    // UI Scale section
    const scaleLabel = document.createElement('div');
    scaleLabel.textContent = 'UI Scale';
    scaleLabel.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
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

      btn.addEventListener('click', () => {
        // Update UI scale immediately
        applyUiScale(scaleOption);
        saveUiSettings({ uiScale: scaleOption });

        // Update all scale button styles
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
      color: #555;
      margin-top: 6px;
    `;
    panel.appendChild(note);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
    backBtn.style.cssText = `
      width: 100%;
      margin-top: 20px;
      padding: 10px 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px;
      color: #999;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s;
    `;
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(255,255,255,0.08)';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'rgba(255,255,255,0.03)';
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
      background: ${selected ? 'rgba(79, 195, 247, 0.2)' : 'rgba(255,255,255,0.03)'};
      border: 2px solid ${selected ? '#4fc3f7' : 'rgba(255,255,255,0.1)'};
      border-radius: 4px;
      color: ${selected ? '#4fc3f7' : '#888'};
      font-size: 14px;
      font-family: inherit;
      font-weight: ${selected ? '600' : '400'};
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
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

  private createButton(
    text: string,
    color: string,
    onClick: (() => void) | null,
    disabled = false,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.disabled = disabled;
    const baseBg = disabled ? 'rgba(100,100,100,0.1)' : 'rgba(79, 195, 247, 0.1)';
    const baseBorder = disabled ? 'rgba(100,100,100,0.2)' : 'rgba(79, 195, 247, 0.3)';
    btn.style.cssText = `
      width: 100%;
      padding: 12px 20px;
      background: ${baseBg};
      border: 1px solid ${baseBorder};
      border-radius: 4px;
      color: ${disabled ? '#555' : color};
      font-size: 16px;
      font-family: inherit;
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
    `;

    if (!disabled && onClick) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(79, 195, 247, 0.2)';
        btn.style.borderColor = 'rgba(79, 195, 247, 0.5)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = baseBg;
        btn.style.borderColor = baseBorder;
      });
      btn.addEventListener('click', onClick);
    }

    return btn;
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
