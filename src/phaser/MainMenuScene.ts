/**
 * MainMenuScene — lightweight main menu.
 *
 * ARCH-14B: Provides New Game / Continue / Settings entry points.
 * Uses DOM overlay (consistent with PlaytestHud pattern).
 * No images, no art assets — simple and readable only.
 *
 * If ?skipMenu or ?autostart is in the URL, auto-advances to
 * GameScene with default settings (for QA smoke test).
 */

import Phaser from 'phaser';
import { DEFAULT_SETUP, shouldSkipMenu } from '../state/gameSetup';
import type { GameSetupConfig } from '../state/gameSetup';

export class MainMenuScene extends Phaser.Scene {
  private container: HTMLDivElement | null = null;

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

    // Continue button (disabled placeholder)
    const continueBtn = this.createButton('Continue', '#666', null, true);
    btnContainer.appendChild(continueBtn);

    // Settings button (disabled placeholder)
    const settingsBtn = this.createButton('Settings', '#666', null, true);
    btnContainer.appendChild(settingsBtn);

    root.appendChild(btnContainer);

    // Version hint
    const version = document.createElement('div');
    version.textContent = 'v0.1 — ARCH-14B';
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
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
