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
 */

import Phaser from 'phaser';
import { DEFAULT_SETUP, shouldSkipMenu } from '../state/gameSetup';
import type { GameSetupConfig } from '../state/gameSetup';
import { hasSaves, getSaveSlotMetas, loadGame, type SaveSlotMeta } from '../state/saveGame';
import type { Faction } from '../state/types';
import { FACTION_CSS_COLORS } from '../state/gameSetup';

export class MainMenuScene extends Phaser.Scene {
  private container: HTMLDivElement | null = null;
  private saveListContainer: HTMLDivElement | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // QA/E2E auto-start: skip menu entirely
    if (shouldSkipMenu()) {
      this.startGame(DEFAULT_SETUP);
      return;
    }

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

    // ARCH-15A: Continue button — enabled only if saves exist
    const savesExist = hasSaves();
    const continueBtn = this.createButton('Continue', '#81c784', savesExist ? () => {
      this.showSaveList();
    } : null, !savesExist);
    btnContainer.appendChild(continueBtn);

    // Settings button (disabled placeholder)
    const settingsBtn = this.createButton('Settings', '#666', null, true);
    btnContainer.appendChild(settingsBtn);

    root.appendChild(btnContainer);

    // Version hint
    const version = document.createElement('div');
    version.textContent = 'v0.1 — ARCH-15A';
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
   * ARCH-15A: Show save list overlay.
   * Lists all saves with metadata, allows the player to pick one to load.
   */
  private showSaveList(): void {
    // Remove existing save list if any
    this.hideSaveList();

    const metas = getSaveSlotMetas();
    if (metas.length === 0) return;

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
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 24px 28px;
      min-width: 340px;
      max-width: 420px;
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

    // Save slots
    for (const meta of metas) {
      const row = this.createSaveRow(meta);
      panel.appendChild(row);
    }

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
    backBtn.style.cssText = `
      width: 100%;
      margin-top: 12px;
      padding: 10px 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px;
      color: #999;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
    `;
    backBtn.addEventListener('click', () => {
      this.hideSaveList();
    });
    panel.appendChild(backBtn);

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
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    `;

    const factionColor = FACTION_CSS_COLORS[meta.faction as Faction] ?? '#4fc3f7';

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';

    const nameLine = document.createElement('div');
    nameLine.style.cssText = `font-size: 13px; font-weight: 600; color: ${factionColor};`;
    nameLine.textContent = `${meta.faction.charAt(0).toUpperCase() + meta.faction.slice(1)} — ${meta.mapName}`;
    info.appendChild(nameLine);

    const detailLine = document.createElement('div');
    detailLine.style.cssText = 'font-size: 10px; color: #888; margin-top: 2px;';
    const date = new Date(meta.updatedAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    detailLine.textContent = `Raw: ${meta.summary.raw} | Matter: ${meta.summary.matter} | ${dateStr}`;
    info.appendChild(detailLine);

    row.appendChild(info);

    // Click to load
    row.addEventListener('click', () => {
      const result = loadGame(meta.id);
      if (result.success && result.gameState) {
        this.hideSaveList();
        // Start GameScene with loaded state
        // Fix 1: Pass saveSlotId so GameScene can update the same slot on re-save
        this.scene.start('GameScene', {
          loadedGameState: result.gameState,
          mapId: meta.mapId,
          saveSlotId: meta.id,
        });
      } else {
        console.warn(`[MainMenuScene] Load failed: ${result.message}`);
      }
    });

    row.addEventListener('mouseenter', () => {
      row.style.background = 'rgba(79, 195, 247, 0.08)';
      row.style.borderColor = 'rgba(79, 195, 247, 0.2)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.borderColor = 'rgba(255,255,255,0.08)';
    });

    return row;
  }

  /** Hide and remove the save list overlay. */
  private hideSaveList(): void {
    if (this.saveListContainer && this.saveListContainer.parentNode) {
      this.saveListContainer.parentNode.removeChild(this.saveListContainer);
    }
    this.saveListContainer = null;
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
    btn.style.cssText = `
      width: 100%;
      padding: 12px 20px;
      background: ${disabled ? 'rgba(100,100,100,0.1)' : `rgba(79, 195, 247, 0.1)`};
      border: 1px solid ${disabled ? 'rgba(100,100,100,0.2)' : `rgba(79, 195, 247, 0.3)`};
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
        btn.style.background = 'rgba(79, 195, 247, 0.1)';
        btn.style.borderColor = 'rgba(79, 195, 247, 0.3)';
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
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
