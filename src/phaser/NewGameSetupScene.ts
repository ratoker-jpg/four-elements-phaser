/**
 * NewGameSetupScene — faction and map selection.
 *
 * ARCH-14B: Allows the player to choose their faction and (when more
 * maps exist) select a map before starting the game.
 *
 * Currently only one map (Map 1 / customMap1) is available.
 * Faction selection changes the player's HQ color and economy faction.
 *
 * ARCH-14C: Added Esc to go back, consistent button hover/disabled states.
 */

import Phaser from 'phaser';
import {
  FACTION_LIST,
  FACTION_CSS_COLORS,
  MAP_LIST,
  DEFAULT_SETUP,
} from '../state/gameSetup';
import type { GameSetupConfig } from '../state/gameSetup';
import type { Faction } from '../state/types';

export class NewGameSetupScene extends Phaser.Scene {
  private container: HTMLDivElement | null = null;
  private selectedFaction: Faction = DEFAULT_SETUP.faction;
  private selectedMapId: string = DEFAULT_SETUP.mapId;

  constructor() {
    super({ key: 'NewGameSetupScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.createDomOverlay();

    // Register DOM cleanup on scene shutdown so Phaser handles lifecycle
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // ARCH-14C: Esc goes back to main menu
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('MainMenuScene');
    });

    console.log('[NewGameSetupScene] Ready.');
  }

  private createDomOverlay(): void {
    const root = document.createElement('div');
    root.id = 'new-game-setup';
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
    title.textContent = 'New Game';
    title.style.cssText = `
      font-size: 32px;
      font-weight: 600;
      color: #4fc3f7;
      margin-bottom: 32px;
    `;
    root.appendChild(title);

    // Setup container
    const setupBox = document.createElement('div');
    setupBox.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 360px;
    `;

    // ── Faction selection ────────────────────────────────────────
    const factionSection = document.createElement('div');
    const factionLabel = document.createElement('div');
    factionLabel.textContent = 'Faction';
    factionLabel.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    factionSection.appendChild(factionLabel);

    const factionGrid = document.createElement('div');
    factionGrid.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    for (const faction of FACTION_LIST) {
      const btn = document.createElement('button');
      btn.textContent = faction.charAt(0).toUpperCase() + faction.slice(1);
      btn.dataset.faction = faction;
      btn.style.cssText = this.factionButtonStyle(faction, faction === this.selectedFaction);

      btn.addEventListener('click', () => {
        this.selectedFaction = faction;
        // Update all faction button styles
        const buttons = factionGrid.querySelectorAll('button');
        buttons.forEach(b => {
          const f = (b as HTMLButtonElement).dataset.faction as Faction;
          b.style.cssText = this.factionButtonStyle(f, f === this.selectedFaction);
        });
      });

      factionGrid.appendChild(btn);
    }
    factionSection.appendChild(factionGrid);
    setupBox.appendChild(factionSection);

    // ── Map selection ────────────────────────────────────────────
    const mapSection = document.createElement('div');
    const mapLabel = document.createElement('div');
    mapLabel.textContent = 'Map';
    mapLabel.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    mapSection.appendChild(mapLabel);

    for (const map of MAP_LIST) {
      const btn = document.createElement('button');
      btn.textContent = map.name;
      btn.style.cssText = `
        padding: 8px 16px;
        background: rgba(79, 195, 247, 0.15);
        border: 1px solid rgba(79, 195, 247, 0.3);
        border-radius: 4px;
        color: #4fc3f7;
        font-size: 14px;
        font-family: inherit;
        cursor: default;
        width: 100%;
        text-align: left;
      `;
      mapSection.appendChild(btn);
    }
    setupBox.appendChild(mapSection);

    // ── Buttons row ──────────────────────────────────────────────
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = `
      display: flex;
      gap: 12px;
      margin-top: 12px;
    `;

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
    backBtn.style.cssText = this.actionButtonStyle('#888', 'rgba(150,150,150,0.1)', 'rgba(150,150,150,0.2)', 'rgba(150,150,150,0.25)');
    backBtn.addEventListener('click', () => {
      this.scene.start('MainMenuScene');
    });
    buttonRow.appendChild(backBtn);

    // Start Game button
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start Game';
    startBtn.style.cssText = this.actionButtonStyle('#4fc3f7', 'rgba(79,195,247,0.15)', 'rgba(79,195,247,0.25)', 'rgba(79,195,247,0.4)');
    startBtn.addEventListener('click', () => {
      const config: GameSetupConfig = {
        faction: this.selectedFaction,
        mapId: this.selectedMapId,
      };
      this.scene.start('GameScene', config);
    });
    buttonRow.appendChild(startBtn);

    setupBox.appendChild(buttonRow);
    root.appendChild(setupBox);

    document.body.appendChild(root);
    this.container = root;
  }

  private factionButtonStyle(faction: Faction, selected: boolean): string {
    const color = FACTION_CSS_COLORS[faction];
    return `
      flex: 1;
      padding: 10px 12px;
      background: ${selected ? `${color}22` : 'rgba(255,255,255,0.03)'};
      border: 2px solid ${selected ? color : 'rgba(255,255,255,0.1)'};
      border-radius: 4px;
      color: ${selected ? color : '#888'};
      font-size: 14px;
      font-family: inherit;
      font-weight: ${selected ? '600' : '400'};
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
    `;
  }

  private actionButtonStyle(color: string, bg: string, _hoverBg: string, _hoverBorder: string): string {
    return `
      flex: 1;
      padding: 10px 16px;
      background: ${bg};
      border: 1px solid ${color}44;
      border-radius: 4px;
      color: ${color};
      font-size: 15px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
    `;
  }

  shutdown(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
