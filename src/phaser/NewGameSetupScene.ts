/**
 * NewGameSetupScene — faction, map mode, size, and seed selection.
 *
 * ARCH-14B: Allows the player to choose their faction and (when more
 * maps exist) select a map before starting the game.
 *
 * ARCH-16A: Expanded with map mode (fixed/generated), map size
 * (small/standard/large), and seed input with random seed button.
 *
 * ARCH-14C: Esc goes back, consistent button hover/disabled states.
 */

import Phaser from 'phaser';
import {
  FACTION_LIST,
  FACTION_CSS_COLORS,
  MAP_LIST,
  MAP_SIZE_OPTIONS,
  MAP_STYLE_OPTIONS,
  MAP_STYLE_LABELS,
  DEFAULT_SETUP,
  GAME_MODE_LIST,
  GAME_MODE_LABELS,
  buildGameLaunchUrl,
  saveSetupToSession,
  resolveResourceStyleForMapStyle,
} from '../state/gameSetup';
import type { GameSetupConfig, MapMode, GameMode, MapStyle, ResourceStyle } from '../state/gameSetup';
import type { Faction } from '../state/types';
import type { MapSizeOption } from '../state/generatedMap';
import { createRandomSeed, generatedMapId, mapSizeToDimensions } from '../state/generatedMap';
import { loadGeneratedModularUnitAssets, isModularUnitsLoaded } from '../assets/runtimeGeneratedAssets';

export class NewGameSetupScene extends Phaser.Scene {
  private container: HTMLDivElement | null = null;
  private selectedFaction: Faction = DEFAULT_SETUP.faction;
  private selectedMapMode: MapMode = DEFAULT_SETUP.mapMode;
  private selectedMapId: string = DEFAULT_SETUP.mapId;
  private selectedMapSize: MapSizeOption = DEFAULT_SETUP.mapSize;
  private selectedMapStyle: MapStyle = DEFAULT_SETUP.mapStyle;
  private selectedGameMode: GameMode = DEFAULT_SETUP.gameMode;
  private seedInput: HTMLInputElement | null = null;
  private sizeContainer: HTMLDivElement | null = null;
  private seedContainer: HTMLDivElement | null = null;
  private mapSummary: HTMLDivElement | null = null;
  private gameModeNote: HTMLDivElement | null = null;
  private mapSection: HTMLDivElement | null = null;
  private sizeSection: HTMLDivElement | null = null;
  private mapStyleSection: HTMLDivElement | null = null;
  private seedSection: HTMLDivElement | null = null;
  /** MENU-02: Overlay shown during modularUnits late-loading. */
  private lateLoadingOverlay: HTMLDivElement | null = null;
  /** MENU-02: Prevents double-click during late-loading. */
  private isLateLoading = false;

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
      gap: 20px;
      width: 400px;
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

    // ── Game Mode selection (MENU-01) ────────────────────────────
    const gameModeSection = document.createElement('div');
    const gameModeLabel = document.createElement('div');
    gameModeLabel.textContent = 'Game Mode';
    gameModeLabel.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    gameModeSection.appendChild(gameModeLabel);

    const gameModeGrid = document.createElement('div');
    gameModeGrid.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    for (const mode of GAME_MODE_LIST) {
      const btn = document.createElement('button');
      btn.textContent = GAME_MODE_LABELS[mode];
      btn.dataset.gameMode = mode;
      btn.style.cssText = this.gameModeButtonStyle(mode, mode === this.selectedGameMode);

      btn.addEventListener('click', () => {
        this.selectedGameMode = mode;
        const buttons = gameModeGrid.querySelectorAll('button');
        buttons.forEach(b => {
          const m = (b as HTMLButtonElement).dataset.gameMode as GameMode;
          b.style.cssText = this.gameModeButtonStyle(m, m === this.selectedGameMode);
        });
        this.updateConditionalSections();
        this.updateMapSummary();
      });

      gameModeGrid.appendChild(btn);
    }
    gameModeSection.appendChild(gameModeGrid);
    setupBox.appendChild(gameModeSection);

    // ── Game mode note (MENU-01) ─────────────────────────────────
    this.gameModeNote = document.createElement('div');
    this.gameModeNote.style.cssText = `
      font-size: 11px;
      color: #888;
      min-height: 16px;
      font-style: italic;
    `;
    setupBox.appendChild(this.gameModeNote);

    // ── Map mode selection ────────────────────────────────────────
    this.mapSection = document.createElement('div');
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
    this.mapSection.appendChild(mapLabel);

    const mapGrid = document.createElement('div');
    mapGrid.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    for (const map of MAP_LIST) {
      const btn = document.createElement('button');
      btn.textContent = map.name;
      btn.dataset.mapId = map.id;
      btn.dataset.mapMode = map.mode;
      const isSelected = map.id === this.selectedMapId && map.mode === this.selectedMapMode;
      btn.style.cssText = this.mapButtonStyle(isSelected);

      btn.addEventListener('click', () => {
        this.selectedMapMode = map.mode as MapMode;
        this.selectedMapId = map.id;
        // Update all map button styles
        const buttons = mapGrid.querySelectorAll('button');
        buttons.forEach(b => {
          const bMapId = (b as HTMLButtonElement).dataset.mapId!;
          const bMode = (b as HTMLButtonElement).dataset.mapMode as MapMode;
          b.style.cssText = this.mapButtonStyle(bMapId === this.selectedMapId && bMode === this.selectedMapMode);
        });
        this.updateConditionalSections();
        this.updateMapSummary();
      });

      mapGrid.appendChild(btn);
    }
    this.mapSection.appendChild(mapGrid);
    setupBox.appendChild(this.mapSection);

    // ── Size selection (only for generated maps) ──────────────────
    this.sizeSection = document.createElement('div');
    const sizeLabel = document.createElement('div');
    sizeLabel.textContent = 'Map Size';
    sizeLabel.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    this.sizeSection.appendChild(sizeLabel);

    this.sizeContainer = document.createElement('div');
    this.sizeContainer.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    for (const size of MAP_SIZE_OPTIONS) {
      const btn = document.createElement('button');
      btn.textContent = size.charAt(0).toUpperCase() + size.slice(1);
      btn.dataset.mapSize = size;
      btn.style.cssText = this.sizeButtonStyle(size === this.selectedMapSize);

      btn.addEventListener('click', () => {
        this.selectedMapSize = size;
        const buttons = this.sizeContainer!.querySelectorAll('button');
        buttons.forEach(b => {
          const s = (b as HTMLButtonElement).dataset.mapSize as MapSizeOption;
          b.style.cssText = this.sizeButtonStyle(s === this.selectedMapSize);
        });
        this.updateMapSummary();
      });

      this.sizeContainer.appendChild(btn);
    }
    this.sizeSection.appendChild(this.sizeContainer);
    setupBox.appendChild(this.sizeSection);

    // ── Map Style selection (VISUAL-05A-PR2) ──────────────────────
    this.mapStyleSection = document.createElement('div');
    const mapStyleLabel = document.createElement('div');
    mapStyleLabel.textContent = 'Map Style';
    mapStyleLabel.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    this.mapStyleSection.appendChild(mapStyleLabel);

    const mapStyleGrid = document.createElement('div');
    mapStyleGrid.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    for (const style of MAP_STYLE_OPTIONS) {
      const btn = document.createElement('button');
      btn.textContent = MAP_STYLE_LABELS[style];
      btn.dataset.mapStyle = style;
      btn.style.cssText = this.mapStyleButtonStyle(style, style === this.selectedMapStyle);

      btn.addEventListener('click', () => {
        this.selectedMapStyle = style;
        const buttons = mapStyleGrid.querySelectorAll('button');
        buttons.forEach(b => {
          const s = (b as HTMLButtonElement).dataset.mapStyle as MapStyle;
          b.style.cssText = this.mapStyleButtonStyle(s, s === this.selectedMapStyle);
        });
        this.updateMapSummary();
      });

      mapStyleGrid.appendChild(btn);
    }
    this.mapStyleSection.appendChild(mapStyleGrid);
    setupBox.appendChild(this.mapStyleSection);

    // ── Seed input (only for generated maps) ─────────────────────
    this.seedSection = document.createElement('div');
    const seedLabel = document.createElement('div');
    seedLabel.textContent = 'Seed';
    seedLabel.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    this.seedSection.appendChild(seedLabel);

    this.seedContainer = document.createElement('div');
    this.seedContainer.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    this.seedInput = document.createElement('input');
    this.seedInput.type = 'text';
    this.seedInput.value = DEFAULT_SETUP.seed;
    this.seedInput.placeholder = 'Enter seed...';
    this.seedInput.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 14px;
      font-family: monospace;
      outline: none;
    `;
    this.seedInput.addEventListener('input', () => {
      this.updateMapSummary();
    });
    this.seedInput.addEventListener('focus', () => {
      this.seedInput!.style.borderColor = 'rgba(79, 195, 247, 0.5)';
    });
    this.seedInput.addEventListener('blur', () => {
      this.seedInput!.style.borderColor = 'rgba(255,255,255,0.15)';
    });
    this.seedContainer.appendChild(this.seedInput);

    // Random seed button
    const randomSeedBtn = document.createElement('button');
    randomSeedBtn.textContent = 'Random';
    randomSeedBtn.style.cssText = `
      padding: 8px 12px;
      background: rgba(79, 195, 247, 0.1);
      border: 1px solid rgba(79, 195, 247, 0.3);
      border-radius: 4px;
      color: #4fc3f7;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    `;
    randomSeedBtn.addEventListener('mouseenter', () => {
      randomSeedBtn.style.background = 'rgba(79, 195, 247, 0.2)';
    });
    randomSeedBtn.addEventListener('mouseleave', () => {
      randomSeedBtn.style.background = 'rgba(79, 195, 247, 0.1)';
    });
    randomSeedBtn.addEventListener('click', () => {
      if (this.seedInput) {
        this.seedInput.value = createRandomSeed();
        this.updateMapSummary();
      }
    });
    this.seedContainer.appendChild(randomSeedBtn);

    this.seedSection.appendChild(this.seedContainer);
    setupBox.appendChild(this.seedSection);

    // ── Map summary (text-only) ──────────────────────────────────
    this.mapSummary = document.createElement('div');
    this.mapSummary.style.cssText = `
      font-size: 11px;
      color: #666;
      min-height: 16px;
    `;
    setupBox.appendChild(this.mapSummary);

    // ── Buttons row ──────────────────────────────────────────────
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = `
      display: flex;
      gap: 12px;
      margin-top: 8px;
    `;

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
    backBtn.style.cssText = this.actionButtonStyle('#888', 'rgba(150,150,150,0.1)');
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(150,150,150,0.2)';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'rgba(150,150,150,0.1)';
    });
    backBtn.addEventListener('click', () => {
      this.scene.start('MainMenuScene');
    });
    buttonRow.appendChild(backBtn);

    // Start Game button
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start Game';
    startBtn.style.cssText = this.actionButtonStyle('#4fc3f7', 'rgba(79,195,247,0.15)');
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.background = 'rgba(79,195,247,0.25)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.background = 'rgba(79,195,247,0.15)';
    });
    startBtn.addEventListener('click', () => {
      this.startGameWithMode();
    });
    buttonRow.appendChild(startBtn);

    setupBox.appendChild(buttonRow);
    root.appendChild(setupBox);

    document.body.appendChild(root);
    this.container = root;

    // Initialize visibility and summary
    this.updateConditionalSections();
    this.updateMapSummary();
  }

  /** Show/hide size, seed, and map sections based on map mode and game mode. MENU-01. */
  private updateConditionalSections(): void {
    const isGenerated = this.selectedMapMode === 'generated';
    const isArena = this.selectedGameMode === 'arena';

    // Hide map, size, and seed sections when Arena mode is selected
    if (this.mapSection) {
      this.mapSection.style.display = isArena ? 'none' : '';
    }
    if (this.sizeSection) {
      this.sizeSection.style.display = (isGenerated && !isArena) ? '' : 'none';
    }
    if (this.seedSection) {
      this.seedSection.style.display = (isGenerated && !isArena) ? '' : 'none';
    }

    // Update game mode note
    this.updateGameModeNote();
  }

  /** Update the text-only map summary. */
  private updateMapSummary(): void {
    if (!this.mapSummary) return;

    // Arena mode overrides map display
    if (this.selectedGameMode === 'arena') {
      this.mapSummary.textContent = '20x20 tiles — combat sandbox';
      return;
    }

    if (this.selectedMapMode === 'generated') {
      const dims = mapSizeToDimensions(this.selectedMapSize);
      const seed = this.seedInput?.value.trim() || DEFAULT_SETUP.seed;
      const styleLabel = this.selectedMapStyle === 'industrial' ? ' [Industrial]' : '';
      this.mapSummary.textContent = `${dims.width}x${dims.height} tiles — seed: ${seed}${styleLabel}`;
    } else {
      const styleLabel = this.selectedMapStyle === 'industrial' ? ' [Industrial]' : '';
      this.mapSummary.textContent = `48x48 tiles — predefined map${styleLabel}`;
    }
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

  private mapButtonStyle(selected: boolean): string {
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

  private sizeButtonStyle(selected: boolean): string {
    return `
      flex: 1;
      padding: 8px 10px;
      background: ${selected ? 'rgba(129, 199, 132, 0.2)' : 'rgba(255,255,255,0.03)'};
      border: 2px solid ${selected ? '#81c784' : 'rgba(255,255,255,0.1)'};
      border-radius: 4px;
      color: ${selected ? '#81c784' : '#888'};
      font-size: 13px;
      font-family: inherit;
      font-weight: ${selected ? '600' : '400'};
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
    `;
  }

  /** Map style button style. VISUAL-05A-PR2: teal accent for industrial. */
  private mapStyleButtonStyle(style: MapStyle, selected: boolean): string {
    const color = style === 'industrial' ? '#80cbc4' : '#a1887f';
    return `
      flex: 1;
      padding: 8px 10px;
      background: ${selected ? `${color}22` : 'rgba(255,255,255,0.03)'};
      border: 2px solid ${selected ? color : 'rgba(255,255,255,0.1)'};
      border-radius: 4px;
      color: ${selected ? color : '#888'};
      font-size: 13px;
      font-family: inherit;
      font-weight: ${selected ? '600' : '400'};
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
    `;
  }

  private actionButtonStyle(color: string, bg: string): string {
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

  /** Game mode button style. MENU-01: orange accent for debug, red for arena. */
  private gameModeButtonStyle(mode: GameMode, selected: boolean): string {
    // Color per mode: standard = blue, debug = orange, arena = red-orange
    const colors: Record<GameMode, string> = {
      standard: '#4fc3f7',
      debug: '#ffa726',
      arena: '#ef5350',
    };
    const color = colors[mode];
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

  /** Update game mode note text. MENU-01. */
  private updateGameModeNote(): void {
    if (!this.gameModeNote) return;

    switch (this.selectedGameMode) {
      case 'debug':
        this.gameModeNote.textContent = 'Developer tools and combat test assets enabled.';
        break;
      case 'arena':
        this.gameModeNote.textContent = 'Combat Sandbox — small test arena with combat units.';
        break;
      case 'standard':
      default:
        this.gameModeNote.textContent = '';
        break;
    }
  }

  /**
   * Start game with the selected game mode.
   * MENU-02: Mode-aware late-loading model.
   *
   * - Standard: start GameScene directly via scene.start()
   * - Debug/Arena: check if modularUnits are loaded;
   *   if yes, start GameScene directly without page reload;
   *   if no, late-load modularUnits first, then start GameScene.
   *
   * Falls back to controlled URL launch if late-loading fails
   * (e.g. Phaser loader error), preserving the MENU-01 safety net.
   */
  private startGameWithMode(): void {
    // Prevent double-click during late-loading
    if (this.isLateLoading) return;

    const seed = this.seedInput?.value.trim() || DEFAULT_SETUP.seed;
    const config: GameSetupConfig = {
      faction: this.selectedFaction,
      mapId: this.selectedGameMode === 'arena'
        ? 'arena1'
        : this.selectedMapMode === 'generated'
          ? generatedMapId(seed, this.selectedMapSize)
          : this.selectedMapId,
      mapMode: this.selectedGameMode === 'arena' ? 'fixed' : this.selectedMapMode,
      mapSize: this.selectedMapSize,
      seed,
      gameMode: this.selectedGameMode,
      mapStyle: this.selectedMapStyle,
      resourceStyle: resolveResourceStyleForMapStyle(this.selectedMapStyle),
    };

    if (this.selectedGameMode === 'standard') {
      // Standard mode: start GameScene directly, no page reload needed
      this.scene.start('GameScene', config);
      return;
    }

    // Debug / Arena mode: try seamless late-loading first
    if (isModularUnitsLoaded(this)) {
      // modularUnits already loaded (e.g. from PreloadScene via URL params
      // or a previous Debug/Arena session) — start GameScene directly
      console.log(`[NewGameSetupScene] modularUnits already loaded — starting ${this.selectedGameMode} mode directly.`);
      this.scene.start('GameScene', config);
      return;
    }

    // Late-load modularUnits before starting GameScene
    this.isLateLoading = true;
    this.showLateLoadingOverlay();

    console.log(`[NewGameSetupScene] Late-loading modularUnits for ${this.selectedGameMode} mode...`);
    loadGeneratedModularUnitAssets(this);

    // Guard: if loaderror triggers fallback, prevent the complete handler
    // from starting GameScene with incomplete textures (loaderror/complete race).
    let didFallback = false;

    const onComplete = () => {
      if (didFallback) return;
      console.log('[NewGameSetupScene] modularUnits late-loading complete.');
      this.hideLateLoadingOverlay();
      this.isLateLoading = false;
      this.scene.start('GameScene', config);
    };

    const onLoadError = (file: Phaser.Loader.File) => {
      if (didFallback) return;
      didFallback = true;
      console.error(`[NewGameSetupScene] Late-loading failed for: ${file.key} (${file.url})`);
      // Remove the complete handler so it cannot fire after fallback
      this.load.off('complete', onComplete);
      this.hideLateLoadingOverlay();
      this.isLateLoading = false;
      // Fallback: controlled URL launch (MENU-01 safety net)
      console.warn('[NewGameSetupScene] Falling back to controlled URL launch due to late-loading error.');
      saveSetupToSession(config);
      const url = buildGameLaunchUrl(this.selectedGameMode);
      window.location.href = url;
    };

    this.load.once('complete', onComplete);
    this.load.once('loaderror', onLoadError);

    this.load.start();
  }

  /**
   * Show a minimal loading overlay while late-loading modularUnits.
   * MENU-02: Simple DOM overlay consistent with the PreloadScene style.
   */
  private showLateLoadingOverlay(): void {
    this.hideLateLoadingOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'late-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(26, 26, 46, 0.85);
      z-index: 40;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
    `;

    const content = document.createElement('div');
    content.style.cssText = 'text-align: center;';

    const text = document.createElement('div');
    text.textContent = 'Loading combat assets...';
    text.style.cssText = `
      font-size: 18px;
      font-weight: 600;
      color: #4fc3f7;
      margin-bottom: 12px;
    `;
    content.appendChild(text);

    const hint = document.createElement('div');
    hint.textContent = 'Preparing debug/arena mode';
    hint.style.cssText = `
      font-size: 12px;
      color: #666;
    `;
    content.appendChild(hint);

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    this.lateLoadingOverlay = overlay;
  }

  /** Hide the late-loading overlay. */
  private hideLateLoadingOverlay(): void {
    if (this.lateLoadingOverlay && this.lateLoadingOverlay.parentNode) {
      this.lateLoadingOverlay.parentNode.removeChild(this.lateLoadingOverlay);
    }
    this.lateLoadingOverlay = null;
  }

  shutdown(): void {
    this.hideLateLoadingOverlay();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.seedInput = null;
    this.sizeContainer = null;
    this.seedContainer = null;
    this.mapSummary = null;
    this.gameModeNote = null;
    this.mapSection = null;
    this.sizeSection = null;
    this.mapStyleSection = null;
    this.seedSection = null;
    this.isLateLoading = false;
  }
}
