import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets/assetManifest';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EntityRenderer } from './render/EntityRenderer';
import { BuildingStatusRenderer } from './render/BuildingStatusRenderer';
import { CameraControls } from './input/CameraControls';
import { GameInputController } from './input/GameInputController';
import { PlaytestHud } from './ui/PlaytestHud';

import { tileToScreen, mapOriginOffset, type IsoPoint } from './render/isometric';
import { createInitialState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';
import { updateConstructionSiteProgress, BUILDING_CONFIG } from '../state/construction';
import { assignIdleBuilders, updateBuilders } from '../state/builder';
import type { GameState, HarvesterPhase, BuildingType, ProducibleUnitType } from '../state/types';
import { ELEMENT_UNITS_PER_ELEMENT } from '../state/types';
import { isHarvesterBlocked, getHarvesterStatus, getUnitCount, getUnitCap } from '../state/statusHelpers';
import { validateMap } from '../state/mapValidation';
import { PauseMenu } from './ui/PauseMenu';
import type { GameSetupConfig } from '../state/gameSetup';
import { DEFAULT_SETUP, getMapDataFromConfig, getMapDisplayName } from '../state/gameSetup';
import { saveGame } from '../state/saveGame';
import { loadUiSettings, applyUiScale } from '../state/uiSettings';
import { DevtoolsPanel } from './ui/DevtoolsPanel';
import { isDevtoolsEnabled, type DevCommandResult } from '../state/devCommands';
import { DebugOverlayRenderer } from './render/DebugOverlayRenderer';
import { FeedbackRenderer } from './render/FeedbackRenderer';
import { UnitMotionFxRenderer } from './render/UnitMotionFxRenderer';
import { isArenaEnabled, ARENA_MAP_ID, createArenaMapData } from '../state/devArena';

/**
 * GameScene — orchestration-only scene.
 *
 * PR3: Drives the harvester civil loop via updateGameState().
 * GameScene calls state update + renderer sync + HUD update only.
 * No game logic lives here.
 *
 * ARCH-18A-LITE: Input handling and command dispatch extracted to
 * GameInputController. GameScene creates subsystems, wires the
 * controller, and runs the game loop. No keyboard/pointer handlers
 * or selection state remain in this file.
 */

/**
 * ARCH-15A: Scene data for loading a saved game.
 * When MainMenuScene loads a save, it passes this to GameScene.init().
 *
 * Fix 1: Includes saveSlotId so GameScene can update the same slot
 * on subsequent saves instead of creating duplicates.
 */
export interface LoadSceneData {
  loadedGameState: GameState;
  mapId?: string;
  /** Slot ID of the loaded save, used to update the same slot on re-save. */
  saveSlotId?: string;
}

/** Phase labels for HUD display. */
const PHASE_LABEL: Record<HarvesterPhase, string> = {
  idle: 'Idle',
  'moving-to-resource': 'Moving',
  gathering: 'Gathering',
  'returning-to-hq': 'Returning',
  unloading: 'Unloading',
  'manual-move': 'Manual',
};

export class GameScene extends Phaser.Scene {
  private terrainRenderer: TerrainRenderer | null = null;
  private entityRenderer: EntityRenderer | null = null;
  private buildingStatusRenderer: BuildingStatusRenderer | null = null;
  private cameraControls: CameraControls | null = null;
  private inputController: GameInputController | null = null;
  private playtestHud: PlaytestHud | null = null;
  private pauseMenu: PauseMenu | null = null;
  private gameState!: GameState;
  private hqWorldX: number = 0;
  private hqWorldY: number = 0;

  // ARCH-14B: Setup config stored for restart functionality
  private setupConfig: GameSetupConfig = DEFAULT_SETUP;

  // ARCH-15A: Loaded game state from save (null for new games)
  private loadedGameState: GameState | null = null;

  // Fix 1: Track current save slot so subsequent saves update the same slot
  private currentSaveSlotId: string | null = null;

  // ARCH-14B: Pause state — when true, update loop is skipped
  private paused = false;

  // ARCH-11A: Devtools panel (only created when devtools is enabled)
  private devtoolsPanel: DevtoolsPanel | null = null;
  private devtoolsActive = false;

  // ARCH-11B: Debug overlay renderer (only when devtools is enabled)
  private debugOverlayRenderer: DebugOverlayRenderer | null = null;
  // ARCH-12A: Arena mode flag
  private arenaMode = false;

  // ARCH-13A: Feedback renderer — command indicators and resource flow
  private feedbackRenderer: FeedbackRenderer | null = null;

  // ARCH-13C-LITE: Motion dust renderer — render-only movement dust particles
  private motionFxRenderer: UnitMotionFxRenderer | null = null;

  /** Offset for tile-to-screen conversion. */
  private _offset: { x: number; y: number } = { x: 0, y: 0 };

  // HUD elements (legacy top bar)
  private hudCoords: HTMLElement | null = null;
  private hudMapName: HTMLElement | null = null;
  private hudEconomy: HTMLElement | null = null;
  private hudBuild: HTMLElement | null = null;
  private hudBuilder: HTMLElement | null = null;

  /** Track last raw count to log once per unload. */
  private lastLoggedRaw: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  /**
   * Receive scene data from MainMenu/NewGameSetup or from a loaded save.
   * Called by Phaser before create().
   *
   * ARCH-15A: Accepts either a GameSetupConfig (new game) or a
   * LoadSceneData (loaded save). If loadedGameState is present,
   * the saved state is used directly instead of createInitialState.
   */
  init(data: GameSetupConfig | LoadSceneData): void {
    if ('loadedGameState' in data && data.loadedGameState) {
      this.setupConfig = { ...DEFAULT_SETUP, faction: data.loadedGameState.playerFaction, mapId: data.mapId ?? 'customMap1' };
      this.loadedGameState = data.loadedGameState;
      // Fix 1: Preserve loaded slot ID for re-save
      this.currentSaveSlotId = data.saveSlotId ?? null;
    } else {
      this.setupConfig = { ...DEFAULT_SETUP, ...data as GameSetupConfig };
      this.loadedGameState = null;
      // Fix 1: New game starts with no save slot
      this.currentSaveSlotId = null;
    }
  }

  create(): void {
    // ARCH-14C: Apply saved UI scale on game start
    applyUiScale(loadUiSettings().uiScale);

    // ARCH-11B+12A fixup: Compute devtools/arena flags BEFORE any rendering.
    // Arena mode is gated on devtools being active: ?devtools=1&arena=1.
    this.devtoolsActive = isDevtoolsEnabled();
    this.arenaMode = this.devtoolsActive && isArenaEnabled();

    // Determine the game state source — loaded save takes priority,
    // then arena (dev-only), then normal setup config.
    if (this.loadedGameState) {
      this.gameState = this.loadedGameState;
      this.loadedGameState = null;
      console.log('[GameScene] Loaded saved game state.');
    } else if (this.arenaMode) {
      // Arena mode: create arena state (devtools-gated)
      const arenaMapData = createArenaMapData();
      this.gameState = createInitialState(arenaMapData, this.setupConfig.faction, 'QA Arena', { includeModularCombat: true });
      console.log('[GameScene] Arena mode active. Map: QA Arena (20x20)');
    } else {
      const mapData = getMapDataFromConfig(this.setupConfig);
      const mapNameOverride = getMapDisplayName(this.setupConfig);
      this.gameState = createInitialState(mapData, this.setupConfig.faction, mapNameOverride, { includeModularCombat: this.devtoolsActive });
    }

    // Verify all required assets are loaded
    this.verifyAssets();

    // Render terrain from GameState.mapData.terrain
    this.terrainRenderer = new TerrainRenderer(
      this,
      this.gameState.mapData.terrain,
      this.gameState.mapWidth,
      this.gameState.mapHeight,
    );

    // Get offset for entity placement
    const offset = mapOriginOffset(this.gameState.mapWidth, this.gameState.mapHeight);
    this._offset = offset;

    // Draw isometric grid overlay
    this.drawGridLines(offset);

    // Render entities — static first, then dynamic
    this.entityRenderer = new EntityRenderer(this, offset);
    this.entityRenderer.renderStaticEntities(this.gameState.entities);
    this.entityRenderer.renderDynamicInit(
      this.gameState.harvesters,
      this.gameState.resourceNodes,
    );

    // ARCH-07A: Building status renderer (separator progress, factory queue, construction labels)
    this.buildingStatusRenderer = new BuildingStatusRenderer(this, offset);

    // ARCH-13A: Feedback renderer for command indicators and resource flow
    this.feedbackRenderer = new FeedbackRenderer(this, offset);

    // ARCH-13C-LITE: Motion dust renderer — render-only movement dust
    this.motionFxRenderer = new UnitMotionFxRenderer(this, offset);

    // Setup camera
    this.cameraControls = new CameraControls(this);
    const bounds = this.terrainRenderer.getBounds();
    this.cameraControls.setBounds(bounds);

    // Center camera on HQ from state (HQ has 3x3 footprint, center on +1,+1)
    const hq = this.gameState.mapData.hq;
    const hqCenterTx = hq.tx + 1;
    const hqCenterTy = hq.ty + 1;
    const hqScreen = tileToScreen(hqCenterTx, hqCenterTy);
    this.hqWorldX = hqScreen.x + offset.x;
    this.hqWorldY = hqScreen.y + offset.y;
    this.cameraControls.centerOn(this.hqWorldX, this.hqWorldY);
    this.cameraControls.bindResetKey('R', this.hqWorldX, this.hqWorldY);

    // HUD references (legacy top bar)
    this.hudCoords = document.getElementById('hud-coords');
    this.hudMapName = document.getElementById('hud-map-name');
    this.hudEconomy = document.getElementById('hud-economy');
    this.hudBuild = document.getElementById('hud-build');
    this.hudBuilder = document.getElementById('hud-builder');

    // Set initial HUD content
    if (this.hudMapName) {
      this.hudMapName.textContent = `Map: ${this.gameState.mapName}`;
    }

    // ARCH-14A: Create PlaytestHud with build/production callbacks
    // (wired after input controller is created, see below)
    this.playtestHud = new PlaytestHud();

    // ARCH-14B: Create pause menu with callbacks
    // ARCH-15A: Added onSave callback
    this.pauseMenu = new PauseMenu();
    this.pauseMenu.create(
      {
        onResume: () => {
          this.paused = false;
        },
        onRestart: (config: GameSetupConfig) => {
          // Restart GameScene with the same config
          this.paused = false;
          this.scene.restart(config);
        },
        onMainMenu: () => {
          // Stop GameScene, return to main menu
          this.paused = false;
          this.scene.start('MainMenuScene');
        },
        onSave: () => {
          const result = saveGame(this.gameState, this.setupConfig.mapId, this.currentSaveSlotId ?? undefined);
          // Fix 1: Store the slot ID from the first save so subsequent saves update it
          if (result.success && result.slotId) {
            this.currentSaveSlotId = result.slotId;
          }
          return { success: result.success, message: result.message };
        },
      },
      this.setupConfig,
    );

    // ARCH-11B: Create debug overlay renderer if devtools is active
    if (this.devtoolsActive) {
      this.debugOverlayRenderer = new DebugOverlayRenderer(this, this._offset as IsoPoint);
    }

    // ARCH-11A: Create devtools panel if activated
    // (devtoolsActive/arenaMode already computed at top of create())
    if (this.devtoolsActive) {
      this.devtoolsPanel = new DevtoolsPanel();
      this.devtoolsPanel.create({
        onCommand: (command: (state: GameState) => DevCommandResult) => {
          const result = command(this.gameState);
          this.devtoolsPanel?.showCommandResult(result);
        },
        onToggleOverlay: (overlay: 'passability' | 'footprint' | 'resource') => {
          if (!this.debugOverlayRenderer) return false;
          if (overlay === 'passability') return this.debugOverlayRenderer.togglePassability();
          if (overlay === 'footprint') return this.debugOverlayRenderer.toggleFootprint();
          if (overlay === 'resource') return this.debugOverlayRenderer.toggleResource();
          return false;
        },
        onResetArena: () => {
          if (this.arenaMode) {
            this.scene.restart({ faction: this.setupConfig.faction, mapId: ARENA_MAP_ID });
          }
        },
        getScene: () => this as Phaser.Scene,
      }, this.arenaMode);
      console.log('[GameScene] Devtools panel enabled.');
    }

    // ── ARCH-18A-LITE: Create input controller ─────────────────────
    // All keyboard/pointer input wiring, selection state, and command
    // methods are now handled by GameInputController.
    this.inputController = new GameInputController({
      scene: this,
      offset: this._offset as IsoPoint,
      getGameState: () => this.gameState,
      entityRenderer: this.entityRenderer,
      feedbackRenderer: this.feedbackRenderer,
      showStatus: (message: string, success: boolean) => this.playtestHud?.showStatus(message, success),
      pauseMenu: this.pauseMenu,
      debugOverlayRenderer: this.debugOverlayRenderer,
      devtoolsPanel: this.devtoolsPanel,
      setPaused: (paused: boolean) => { this.paused = paused; },
    });

    // Wire PlaytestHud callbacks to delegate to the input controller
    // FIX-04: Also wire cancel callback via closure that calls inputController
    const cancelHandler = (factoryIndex: number, queueIndex: number) => {
      return this.inputController!.requestCancelQueueItem(factoryIndex, queueIndex);
    };
    this.playtestHud.create(
      (buildingType: BuildingType) => this.inputController!.requestBuild(buildingType),
      (unitType: ProducibleUnitType) => this.inputController!.requestQueueUnit(unitType),
      cancelHandler,
    );

    // Register DOM cleanup on scene shutdown so Phaser handles lifecycle
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // Set world background color
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Log state summary
    const s = this.gameState;

    // ARCH-08/09/10: Run map validation and log diagnostics
    const validation = validateMap(s);
    if (!validation.valid) {
      console.warn('[GameScene] Map validation issues:');
      for (const check of validation.checks) {
        if (!check.passed) {
          console.warn(`  [WARN] ${check.id}: ${check.message}`);
        }
      }
    } else {
      console.log('[GameScene] Map validation passed.');
    }
    console.log(
      `[GameScene] Reachable resources near base: ${validation.reachableResourceCount}/${validation.totalResourceCount}`,
    );

    console.log(
      `[GameScene] State-driven scene ready. Map: ${s.mapName} | ` +
      `Size: ${s.mapWidth}x${s.mapHeight} | ` +
      `Harvesters: ${s.harvesters.length} | ` +
      `Resources: ${s.resourceNodes.length} | ` +
      `Drag: pan | Wheel: zoom | R: reset camera | T: debug overlay | B/P/F: build | N: queue builder | G: queue harvester | Q/E: body dir | Z/X: turret dir`,
    );
  }

  update(_time: number, delta: number): void {
    // ARCH-14B: Skip game loop when paused
    if (this.paused) return;

    // 1. Advance game state (harvester civil loop)
    updateGameState(this.gameState, delta);

    // 2. Auto-assign idle builders to pending construction sites
    assignIdleBuilders(this.gameState);

    // 3. Advance builder movement (must come before construction progress)
    updateBuilders(this.gameState, delta);

    // 4. Advance construction site progress (only for sites with active builder)
    const siteIds = this.gameState.mapData.constructionSites.map(s => `site-${s.id}`);
    for (const siteId of siteIds) {
      const result = updateConstructionSiteProgress(this.gameState, siteId, delta);
      if (result.completed) {
        console.log(`[GameScene] Construction completed: ${result.buildingId}`);
      }
    }

    // 5. Sync render layer
    this.entityRenderer?.syncFromState(this.gameState);

    // 5b. Sync building status indicators (ARCH-07A)
    this.buildingStatusRenderer?.syncFromState(this.gameState);

    // 6. Update HUD (legacy top bar)
    this.updateHUD();

    // 7. Update PlaytestHud panel
    this.playtestHud?.update(this.gameState);

    // 8. Update input controller (selection highlight)
    this.inputController?.update();

    // 9. ARCH-11A: Update devtools diagnostics
    this.devtoolsPanel?.update(this.gameState);

    // 9b. ARCH-11B: Sync debug overlays
    this.debugOverlayRenderer?.syncFromState(this.gameState);

    // 9c. ARCH-13A: Sync feedback renderer (command indicators, resource flow)
    this.feedbackRenderer?.syncFromState(this.gameState, this.time.now);

    // 9d. ARCH-13C-LITE: Sync motion dust renderer (movement particles)
    this.motionFxRenderer?.syncFromState(this.gameState, this.time.now);

    // 10. Debug log on unload completion
    if (this.gameState.economy.raw > this.lastLoggedRaw) {
      console.log(
        `[GameScene] Unloaded! Raw: ${this.gameState.economy.raw}`,
      );
      this.lastLoggedRaw = this.gameState.economy.raw;
    }
  }

  // ─── HUD (legacy top bar) ────────────────────────────────────────

  private updateHUD(): void {
    // Camera info
    if (this.cameraControls && this.hudCoords) {
      const info = this.cameraControls.getCameraInfo();
      this.hudCoords.textContent =
        `Zoom: ${info.zoom.toFixed(2)} | (${Math.round(info.scrollX)}, ${Math.round(info.scrollY)})`;
    }

    // Economy info
    if (this.hudEconomy) {
      const s = this.gameState;
      const activeResources = s.resourceNodes.filter((r) => !r.depleted).length;
      const totalResources = s.resourceNodes.length;

      // Harvester status summary
      const phaseCounts: Record<string, number> = {};
      for (const h of s.harvesters) {
        const status = getHarvesterStatus(h);
        if (isHarvesterBlocked(status)) {
          const label = 'Blocked';
          phaseCounts[label] = (phaseCounts[label] || 0) + 1;
        } else {
          const label = PHASE_LABEL[h.phase];
          phaseCounts[label] = (phaseCounts[label] || 0) + 1;
        }
      }
      const phaseStr = Object.entries(phaseCounts)
        .map(([label, count]) => `${count} ${label}`)
        .join(', ');

      const factionElementRaw = s.economy.elements[s.playerFaction];
      const factionElementDisplayed = (factionElementRaw / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
      const elementCapDisplayed = (s.economy.elementCap / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
      const factionLabel = s.playerFaction.charAt(0).toUpperCase() + s.playerFaction.slice(1);

      // ARCH-01F: Compact factory production readout
      let factoryStr = '';
      if (s.production.factories.length > 0) {
        const parts: string[] = [];
        for (const factory of s.production.factories) {
          if (factory.queue.length === 0) {
            parts.push('idle');
          } else {
            const first = factory.queue[0];
            const typeLabel = first.unitType === 'builder' ? 'B' : 'H';
            const pct = Math.round(first.progress * 100);
            const status = first.completed ? 'done' : `${pct}%`;
            parts.push(`${factory.queue.length}q ${typeLabel}${status}`);
          }
        }
        factoryStr = ` | Factory: ${parts.join(', ')}`;
      }

      this.hudEconomy.textContent =
        `Raw: ${s.economy.raw}/${s.economy.rawCap} | Matter: ${s.economy.matter}/${s.economy.matterCap} | ${factionLabel}: ${factionElementDisplayed}/${elementCapDisplayed} | Power: ${s.economy.powerConsumed}/${s.economy.powerGenerated} | Units: ${getUnitCount(s)}/${getUnitCap(s)} | Resources: ${activeResources}/${totalResources} | ` +
        `Sites: ${s.mapData.constructionSites.length} | ` +
        `Harvesters: ${s.harvesters.length} (${phaseStr})${factoryStr}`;
    }

    // ARCH-13F1: Build status line
    if (this.hudBuild) {
      const sites = this.gameState.mapData.constructionSites;
      if (sites.length === 0) {
        this.hudBuild.textContent = 'Build: none';
      } else {
        // Show the first active construction site
        const site = sites[0];
        const config = BUILDING_CONFIG[site.type];
        const label = config ? site.type.charAt(0).toUpperCase() + site.type.slice(1).replace('-', ' ') : site.type;
        const pct = Math.round(site.progress * 100);
        if (site.pending) {
          this.hudBuild.textContent = `Build: ${label} at (${site.tx},${site.ty}), waiting for builder`;
        } else {
          this.hudBuild.textContent = `Build: ${label} at (${site.tx},${site.ty}), ${pct}%`;
        }
      }
    }

    // ARCH-13F1: Builder status line
    if (this.hudBuilder) {
      const builders = this.gameState.mapData.builders;
      if (builders.length === 0) {
        this.hudBuilder.textContent = 'Builder: none';
      } else if (builders.length === 1) {
        const b = builders[0];
        const phaseLabel = b.phase === 'idle' ? 'idle'
          : b.phase === 'moving-to-site' ? 'moving'
          : 'building';
        this.hudBuilder.textContent = `Builder: ${phaseLabel}`;
      } else {
        // Multiple builders: compact summary
        const counts: Record<string, number> = { idle: 0, moving: 0, building: 0 };
        for (const b of builders) {
          const label = b.phase === 'moving-to-site' ? 'moving' : b.phase;
          counts[label] = (counts[label] || 0) + 1;
        }
        const parts: string[] = [];
        if (counts.idle > 0) parts.push(`${counts.idle} idle`);
        if (counts.moving > 0) parts.push(`${counts.moving} moving`);
        if (counts.building > 0) parts.push(`${counts.building} building`);
        this.hudBuilder.textContent = `Builders: ${parts.join(', ')}`;
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private verifyAssets(): void {
    const requiredKeys = Object.values(ASSET_KEYS);
    for (const key of requiredKeys) {
      if (!this.textures.exists(key)) {
        console.error(`[GameScene] Missing texture: ${key}`);
      }
    }
    console.log('[GameScene] All asset textures verified.');
  }

  private drawGridLines(offset: { x: number; y: number }): void {
    const graphics = this.add.graphics();
    graphics.setDefaultStyles({
      lineStyle: { width: 0.5, color: 0x4a4a6a, alpha: 0.2 },
    });

    const hw = 76 / 2; // TILE_W / 2
    const hh = 38 / 2; // TILE_H / 2

    for (let ty = 0; ty < this.gameState.mapHeight; ty++) {
      for (let tx = 0; tx < this.gameState.mapWidth; tx++) {
        const screenPos = tileToScreen(tx, ty);
        const cx = screenPos.x + offset.x;
        const cy = screenPos.y + offset.y;

        graphics.beginPath();
        graphics.moveTo(cx, cy - hh);
        graphics.lineTo(cx + hw, cy);
        graphics.lineTo(cx, cy + hh);
        graphics.lineTo(cx - hw, cy);
        graphics.closePath();
        graphics.strokePath();
      }
    }

    graphics.setDepth(50);
  }

  shutdown(): void {
    this.inputController?.destroy();
    this.inputController = null;
    this.motionFxRenderer?.destroy();
    this.motionFxRenderer = null;
    this.feedbackRenderer?.destroy();
    this.feedbackRenderer = null;
    this.debugOverlayRenderer?.destroy();
    this.debugOverlayRenderer = null;
    this.devtoolsPanel?.destroy();
    this.devtoolsPanel = null;
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.playtestHud?.destroy();
    this.playtestHud = null;
    this.buildingStatusRenderer?.destroy();
    this.buildingStatusRenderer = null;
    this.cameraControls?.destroy();
    this.entityRenderer?.destroy();
    this.terrainRenderer?.destroy();
    this.paused = false;
  }
}
