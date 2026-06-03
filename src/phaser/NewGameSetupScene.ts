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
 *
 * UI-02: Polished to match UI-01 main menu industrial sci-fi visual
 * direction. Warm bronze/gold primary accent, teal secondary accent,
 * dark slate background. Pointer cursor on all interactive elements.
 * Focus-visible outlines for keyboard accessibility. Clear selected,
 * hover, focus, and active states on all option selectors.
 *
 * CORE-STEP-01A: All player-facing strings use localization (../config/localization).
 * Internal ids remain English (cyan, green, standard, debug, etc.).
 */

import Phaser from 'phaser';
import {
  FACTION_LIST,
  FACTION_CSS_COLORS,
  MAP_LIST,
  MAP_SIZE_OPTIONS,
  MAP_STYLE_OPTIONS,
  DEFAULT_SETUP,
  GAME_MODE_LIST,
  buildGameLaunchUrl,
  saveSetupToSession,
  resolveResourceStyleForMapStyle,
} from '../state/gameSetup';
import type { GameSetupConfig, MapMode, GameMode, MapStyle } from '../state/gameSetup';
import type { Faction } from '../state/types';
import type { MapSizeOption } from '../state/generatedMap';
import { createRandomSeed, generatedMapId, mapSizeToDimensions } from '../state/generatedMap';
import { loadGeneratedModularUnitAssets, isModularUnitsLoaded } from '../assets/runtimeGeneratedAssets';
import {
  t,
  FACTION_DISPLAY,
  FACTION_COLOR_SUBTITLE,
  FACTION_BONUS,
  MAP_SIZE_DISPLAY,
  GAME_MODE_DISPLAY,
  GAME_MODE_DESCRIPTION,
  MAP_STYLE_DISPLAY,
  buildMapSummary,
} from '../config/localization';

/** UI-02: Shared CSS custom properties matching UI-01 industrial menu theme. */
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
  /** Unselected option base color */
  unselectedBg: 'rgba(255, 255, 255, 0.03)',
  unselectedBorder: 'rgba(255, 255, 255, 0.08)',
  unselectedText: '#6b7280',
} as const;

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
    this.cameras.main.setBackgroundColor(MENU_THEME.bg);
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
      margin-bottom: 32px;
    `;

    const title = document.createElement('div');
    title.textContent = t('setup_title');
    title.style.cssText = `
      font-size: 36px;
      font-weight: 700;
      color: ${MENU_THEME.titleColor};
      letter-spacing: 3px;
      text-transform: uppercase;
    `;
    titleArea.appendChild(title);

    // Decorative line under title (matching UI-01 main menu)
    const titleLine = document.createElement('div');
    titleLine.style.cssText = `
      width: 80px;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${MENU_THEME.primaryAccent}, transparent);
      margin: 12px 0 8px;
    `;
    titleArea.appendChild(titleLine);

    const subtitle = document.createElement('div');
    subtitle.textContent = t('setup_subtitle');
    subtitle.style.cssText = `
      font-size: 11px;
      color: ${MENU_THEME.subtitleColor};
      letter-spacing: 1.5px;
      text-transform: uppercase;
    `;
    titleArea.appendChild(subtitle);

    root.appendChild(titleArea);

    // ── Setup container ─────────────────────────────────────────
    const setupBox = document.createElement('div');
    setupBox.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 18px;
      width: 460px;
    `;

    // ── Faction selection ────────────────────────────────────────
    const factionSection = document.createElement('div');
    const factionLabel = this.createSectionLabel(t('setup_faction'));
    factionSection.appendChild(factionLabel);

    const factionGrid = document.createElement('div');
    factionGrid.style.cssText = `
      display: flex;
      gap: 6px;
    `;

    for (const faction of FACTION_LIST) {
      const btn = document.createElement('button');
      btn.dataset.faction = faction;

      // CORE-STEP-01A: Show Russian name + color subtitle + bonus
      const displayName = FACTION_DISPLAY[faction];
      const colorSubtitle = FACTION_COLOR_SUBTITLE[faction];
      const bonus = FACTION_BONUS[faction];

      btn.innerHTML = `
        <div style="font-weight:700;font-size:14px;line-height:1.2;">${displayName}</div>
        <div style="font-size:10px;opacity:0.6;margin-top:2px;">${colorSubtitle}</div>
        <div style="font-size:10px;opacity:0.5;margin-top:1px;">${bonus}</div>
      `;

      btn.style.cssText = this.factionButtonStyle(faction, faction === this.selectedFaction);

      btn.addEventListener('mouseenter', () => {
        if (faction !== this.selectedFaction) {
          btn.style.borderColor = `${FACTION_CSS_COLORS[faction]}44`;
          btn.style.background = `${FACTION_CSS_COLORS[faction]}0d`;
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.cssText = this.factionButtonStyle(faction, faction === this.selectedFaction);
      });
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
        btn.style.outlineOffset = '2px';
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
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
    const gameModeLabel = this.createSectionLabel(t('setup_gameMode'));
    gameModeSection.appendChild(gameModeLabel);

    const gameModeGrid = document.createElement('div');
    gameModeGrid.style.cssText = `
      display: flex;
      gap: 6px;
    `;

    // Colors per mode matching UI-01 industrial theme
    const gameModeColors: Record<GameMode, string> = {
      standard: MENU_THEME.secondaryAccent,
      debug: '#ffa726',
      arena: '#ef5350',
    };

    for (const mode of GAME_MODE_LIST) {
      const btn = document.createElement('button');
      btn.textContent = GAME_MODE_DISPLAY[mode];
      btn.dataset.gameMode = mode;
      const color = gameModeColors[mode];
      btn.style.cssText = this.optionButtonStyle(color, mode === this.selectedGameMode);

      btn.addEventListener('mouseenter', () => {
        if (mode !== this.selectedGameMode) {
          btn.style.borderColor = `${color}44`;
          btn.style.background = `${color}0d`;
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.cssText = this.optionButtonStyle(color, mode === this.selectedGameMode);
      });
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
        btn.style.outlineOffset = '2px';
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('click', () => {
        this.selectedGameMode = mode;

        // CORE-STEP-01A: Standard mode forces generated/industrial
        if (mode === 'standard') {
          this.selectedMapMode = 'generated';
          this.selectedMapStyle = 'industrial';
        }

        const buttons = gameModeGrid.querySelectorAll('button');
        buttons.forEach(b => {
          const m = (b as HTMLButtonElement).dataset.gameMode as GameMode;
          b.style.cssText = this.optionButtonStyle(gameModeColors[m], m === this.selectedGameMode);
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
      color: ${MENU_THEME.subtitleColor};
      min-height: 14px;
      font-style: italic;
      margin-top: -10px;
    `;
    setupBox.appendChild(this.gameModeNote);

    // ── Map mode selection ────────────────────────────────────────
    this.mapSection = document.createElement('div');
    const mapLabel = this.createSectionLabel(t('setup_map'));
    this.mapSection.appendChild(mapLabel);

    const mapGrid = document.createElement('div');
    mapGrid.style.cssText = `
      display: flex;
      gap: 6px;
    `;

    for (const map of MAP_LIST) {
      const btn = document.createElement('button');
      btn.textContent = map.name;
      btn.dataset.mapId = map.id;
      btn.dataset.mapMode = map.mode;
      const isSelected = map.id === this.selectedMapId && map.mode === this.selectedMapMode;
      btn.style.cssText = this.optionButtonStyle(MENU_THEME.secondaryAccent, isSelected);

      btn.addEventListener('mouseenter', () => {
        const currentlySelected = map.id === this.selectedMapId && map.mode === this.selectedMapMode;
        if (!currentlySelected) {
          btn.style.borderColor = `${MENU_THEME.secondaryAccent}44`;
          btn.style.background = `${MENU_THEME.secondaryAccent}0d`;
        }
      });
      btn.addEventListener('mouseleave', () => {
        const currentlySelected = map.id === this.selectedMapId && map.mode === this.selectedMapMode;
        btn.style.cssText = this.optionButtonStyle(MENU_THEME.secondaryAccent, currentlySelected);
      });
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
        btn.style.outlineOffset = '2px';
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('click', () => {
        this.selectedMapMode = map.mode as MapMode;
        this.selectedMapId = map.id;
        const buttons = mapGrid.querySelectorAll('button');
        buttons.forEach(b => {
          const bMapId = (b as HTMLButtonElement).dataset.mapId!;
          const bMode = (b as HTMLButtonElement).dataset.mapMode as MapMode;
          b.style.cssText = this.optionButtonStyle(MENU_THEME.secondaryAccent, bMapId === this.selectedMapId && bMode === this.selectedMapMode);
        });
        this.updateConditionalSections();
        this.updateMapSummary();
      });

      mapGrid.appendChild(btn);
    }
    this.mapSection.appendChild(mapGrid);
    setupBox.appendChild(this.mapSection);

    // ── Map Style selection (VISUAL-05A-PR2) ──────────────────────
    this.mapStyleSection = document.createElement('div');
    const mapStyleLabel = this.createSectionLabel(t('setup_mapStyle'));
    this.mapStyleSection.appendChild(mapStyleLabel);

    const mapStyleGrid = document.createElement('div');
    mapStyleGrid.style.cssText = `
      display: flex;
      gap: 6px;
    `;

    const mapStyleColors: Record<MapStyle, string> = {
      industrial: MENU_THEME.secondaryAccent,
      sand: '#a1887f',
    };

    for (const style of MAP_STYLE_OPTIONS) {
      const btn = document.createElement('button');
      btn.textContent = MAP_STYLE_DISPLAY[style];
      btn.dataset.mapStyle = style;
      const color = mapStyleColors[style];
      btn.style.cssText = this.optionButtonStyle(color, style === this.selectedMapStyle);

      btn.addEventListener('mouseenter', () => {
        if (style !== this.selectedMapStyle) {
          btn.style.borderColor = `${color}44`;
          btn.style.background = `${color}0d`;
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.cssText = this.optionButtonStyle(color, style === this.selectedMapStyle);
      });
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
        btn.style.outlineOffset = '2px';
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('click', () => {
        this.selectedMapStyle = style;
        const buttons = mapStyleGrid.querySelectorAll('button');
        buttons.forEach(b => {
          const s = (b as HTMLButtonElement).dataset.mapStyle as MapStyle;
          b.style.cssText = this.optionButtonStyle(mapStyleColors[s], s === this.selectedMapStyle);
        });
        this.updateMapSummary();
      });

      mapStyleGrid.appendChild(btn);
    }
    this.mapStyleSection.appendChild(mapStyleGrid);
    setupBox.appendChild(this.mapStyleSection);

    // ── Size selection (only for generated maps) ──────────────────
    this.sizeSection = document.createElement('div');
    const sizeLabel = this.createSectionLabel(t('setup_mapSize'));
    this.sizeSection.appendChild(sizeLabel);

    this.sizeContainer = document.createElement('div');
    this.sizeContainer.style.cssText = `
      display: flex;
      gap: 6px;
    `;

    for (const size of MAP_SIZE_OPTIONS) {
      const btn = document.createElement('button');
      btn.textContent = MAP_SIZE_DISPLAY[size];
      btn.dataset.mapSize = size;
      btn.style.cssText = this.optionButtonStyle(MENU_THEME.primaryAccent, size === this.selectedMapSize, '13px');

      btn.addEventListener('mouseenter', () => {
        if (size !== this.selectedMapSize) {
          btn.style.borderColor = `${MENU_THEME.primaryAccent}44`;
          btn.style.background = `${MENU_THEME.primaryAccent}0d`;
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.cssText = this.optionButtonStyle(MENU_THEME.primaryAccent, size === this.selectedMapSize, '13px');
      });
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
        btn.style.outlineOffset = '2px';
      });
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none';
      });
      btn.addEventListener('click', () => {
        this.selectedMapSize = size;
        const buttons = this.sizeContainer!.querySelectorAll('button');
        buttons.forEach(b => {
          const s = (b as HTMLButtonElement).dataset.mapSize as MapSizeOption;
          b.style.cssText = this.optionButtonStyle(MENU_THEME.primaryAccent, s === this.selectedMapSize, '13px');
        });
        this.updateMapSummary();
      });

      this.sizeContainer.appendChild(btn);
    }
    this.sizeSection.appendChild(this.sizeContainer);
    setupBox.appendChild(this.sizeSection);

    // ── Seed input (only for generated maps) ─────────────────────
    this.seedSection = document.createElement('div');
    const seedLabel = this.createSectionLabel(t('setup_seed'));
    this.seedSection.appendChild(seedLabel);

    this.seedContainer = document.createElement('div');
    this.seedContainer.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    this.seedInput = document.createElement('input');
    this.seedInput.type = 'text';
    this.seedInput.value = DEFAULT_SETUP.seed;
    this.seedInput.placeholder = t('setup_seedPlaceholder');
    this.seedInput.style.cssText = `
      flex: 1;
      padding: 9px 12px;
      background: ${MENU_THEME.rowBg};
      border: 1px solid ${MENU_THEME.rowBorder};
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 13px;
      font-family: monospace;
      outline: none;
      transition: border-color 0.15s;
    `;
    this.seedInput.addEventListener('input', () => {
      this.updateMapSummary();
    });
    this.seedInput.addEventListener('focus', () => {
      this.seedInput!.style.borderColor = `${MENU_THEME.secondaryAccent}55`;
    });
    this.seedInput.addEventListener('blur', () => {
      this.seedInput!.style.borderColor = MENU_THEME.rowBorder;
    });
    this.seedContainer.appendChild(this.seedInput);

    // Random seed button — secondary accent style
    const randomSeedBtn = document.createElement('button');
    randomSeedBtn.textContent = t('setup_random');
    const randomSeedAccent = MENU_THEME.secondaryAccent;
    const randomSeedBaseBg = `${randomSeedAccent}0d`;
    const randomSeedBaseBorder = `${randomSeedAccent}33`;
    randomSeedBtn.style.cssText = `
      padding: 9px 14px;
      background: ${randomSeedBaseBg};
      border: 1px solid ${randomSeedBaseBorder};
      border-radius: 4px;
      color: ${randomSeedAccent};
      font-size: 12px;
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s;
      outline: none;
    `;
    randomSeedBtn.addEventListener('mouseenter', () => {
      randomSeedBtn.style.background = `${randomSeedAccent}1a`;
      randomSeedBtn.style.borderColor = `${randomSeedAccent}55`;
    });
    randomSeedBtn.addEventListener('mouseleave', () => {
      randomSeedBtn.style.background = randomSeedBaseBg;
      randomSeedBtn.style.borderColor = randomSeedBaseBorder;
    });
    randomSeedBtn.addEventListener('focus', () => {
      randomSeedBtn.style.outline = `2px solid ${MENU_THEME.focusOutline}`;
      randomSeedBtn.style.outlineOffset = '2px';
    });
    randomSeedBtn.addEventListener('blur', () => {
      randomSeedBtn.style.outline = 'none';
    });
    randomSeedBtn.addEventListener('mousedown', () => {
      randomSeedBtn.style.background = `${randomSeedAccent}26`;
    });
    randomSeedBtn.addEventListener('mouseup', () => {
      randomSeedBtn.style.background = `${randomSeedAccent}1a`;
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
      color: ${MENU_THEME.subtitleColor};
      min-height: 14px;
      margin-top: -8px;
    `;
    setupBox.appendChild(this.mapSummary);

    // ── Buttons row ──────────────────────────────────────────────
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = `
      display: flex;
      gap: 10px;
      margin-top: 4px;
    `;

    // Back button — secondary (teal) style
    const backBtn = this.createMenuButton(t('setup_back'), 'secondary', () => {
      this.scene.start('MainMenuScene');
    });
    buttonRow.appendChild(backBtn);

    // Start Game button — primary (warm bronze/gold) style
    const startBtn = this.createMenuButton(t('setup_start'), 'primary', () => {
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

  // ── Shared UI helpers (matching UI-01 MainMenuScene pattern) ────

  /** Create a styled section label matching UI-01 industrial theme. */
  private createSectionLabel(text: string): HTMLDivElement {
    const label = document.createElement('div');
    label.textContent = text;
    label.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: ${MENU_THEME.subtitleColor};
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    `;
    return label;
  }

  /**
   * UI-02: Create a styled action button with hover/focus/active states.
   * Matches the UI-01 MainMenuScene.createMenuButton pattern.
   *
   * - 'primary' style: warm bronze/gold accent — for the main action (Start)
   * - 'secondary' style: teal accent — for secondary actions (Back)
   */
  private createMenuButton(
    text: string,
    style: 'primary' | 'secondary',
    onClick: () => void,
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
      flex: 1;
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

    if (!disabled) {
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
   * UI-02: Generic option selector button style.
   * Used for game mode, map, map style, and map size selectors.
   * Provides consistent selected/unselected/hover/focus states.
   *
   * @param accentColor - The accent color for the selected state
   * @param selected - Whether this option is currently selected
   * @param fontSize - Font size override (default 13px)
   */
  private optionButtonStyle(accentColor: string, selected: boolean, fontSize = '13px'): string {
    return `
      flex: 1;
      padding: 9px 10px;
      background: ${selected ? `${accentColor}1a` : MENU_THEME.unselectedBg};
      border: 1px solid ${selected ? `${accentColor}55` : MENU_THEME.unselectedBorder};
      border-radius: 4px;
      color: ${selected ? accentColor : MENU_THEME.unselectedText};
      font-size: ${fontSize};
      font-family: inherit;
      font-weight: ${selected ? '600' : '400'};
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
      outline: none;
    `;
  }

  /**
   * Faction button style — uses per-faction colors.
   * CORE-STEP-01A: Updated for 3-line card layout (name + subtitle + bonus).
   */
  private factionButtonStyle(faction: Faction, selected: boolean): string {
    const color = FACTION_CSS_COLORS[faction];
    return `
      flex: 1;
      padding: 10px 8px;
      background: ${selected ? `${color}1a` : MENU_THEME.unselectedBg};
      border: 1px solid ${selected ? `${color}55` : MENU_THEME.unselectedBorder};
      border-radius: 4px;
      color: ${selected ? color : MENU_THEME.unselectedText};
      font-size: 13px;
      font-family: inherit;
      font-weight: ${selected ? '600' : '400'};
      cursor: pointer;
      text-align: center;
      transition: background 0.15s, border-color 0.15s;
      outline: none;
      line-height: 1.3;
    `;
  }

  /**
   * Show/hide map, mapStyle, size, and seed sections based on game mode.
   * MENU-01 + CORE-STEP-01A:
   *   - Standard: hide map, mapStyle, seed (always generated/industrial)
   *   - Debug: show all sections
   *   - Arena: hide map, mapStyle, size, seed
   */
  private updateConditionalSections(): void {
    const isStandard = this.selectedGameMode === 'standard';
    const isArena = this.selectedGameMode === 'arena';

    // Standard: hide map/mapStyle/seed (always generated/industrial)
    if (this.mapSection) this.mapSection.style.display = isStandard || isArena ? 'none' : '';
    if (this.mapStyleSection) this.mapStyleSection.style.display = isStandard || isArena ? 'none' : '';
    if (this.sizeSection) this.sizeSection.style.display = isArena ? 'none' : '';
    if (this.seedSection) this.seedSection.style.display = isStandard || isArena ? 'none' : '';

    // Update game mode note
    this.updateGameModeNote();
  }

  /** Update the text-only map summary. CORE-STEP-01A: uses buildMapSummary helper. */
  private updateMapSummary(): void {
    if (!this.mapSummary) return;

    const seed = this.seedInput?.value.trim() || DEFAULT_SETUP.seed;

    if (this.selectedGameMode === 'arena') {
      this.mapSummary.textContent = buildMapSummary('arena', 'fixed', this.selectedMapStyle, 20, 20, seed);
      return;
    }

    if (this.selectedMapMode === 'generated') {
      const dims = mapSizeToDimensions(this.selectedMapSize);
      this.mapSummary.textContent = buildMapSummary(
        this.selectedGameMode,
        'generated',
        this.selectedMapStyle,
        dims.width,
        dims.height,
        seed,
      );
    } else {
      this.mapSummary.textContent = buildMapSummary(
        this.selectedGameMode,
        'fixed',
        this.selectedMapStyle,
        48,
        48,
        seed,
      );
    }
  }

  /** Update game mode note text. MENU-01 + CORE-STEP-01A: uses GAME_MODE_DESCRIPTION. */
  private updateGameModeNote(): void {
    if (!this.gameModeNote) return;

    this.gameModeNote.textContent = GAME_MODE_DESCRIPTION[this.selectedGameMode] ?? '';
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
   * MENU-02: Simple DOM overlay styled with UI-02 industrial theme.
   * CORE-STEP-01A: Uses localized strings.
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
      background: rgba(17, 24, 39, 0.85);
      z-index: 40;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
    `;

    const content = document.createElement('div');
    content.style.cssText = 'text-align: center;';

    const text = document.createElement('div');
    text.textContent = t('loading_combatAssets');
    text.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: ${MENU_THEME.secondaryAccent};
      margin-bottom: 10px;
    `;
    content.appendChild(text);

    const hint = document.createElement('div');
    hint.textContent = t('loading_debugArena');
    hint.style.cssText = `
      font-size: 12px;
      color: ${MENU_THEME.subtitleColor};
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
