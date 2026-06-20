import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets/assetManifest';
import { RenderManager } from './render/RenderManager';
import { CameraControls } from './input/CameraControls';
import { GameInputController } from './input/GameInputController';
import { PlaytestHud } from './ui/PlaytestHud';
import { VisualHudCore } from './ui/hud/VisualHudCore';
import { HUD_BAR_HEIGHT, shouldUseBottomHudSafeArea } from './ui/hud/hudLayout';
import { commandRegistry } from '../state/commandRegistry';
import { stopUnitCommand } from '../state/unitCommands';

import { tileToScreen, mapOriginOffset, type IsoPoint } from './render/isometric';
import { createInitialState, stripModularCombatFromState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';
import { updateConstructionSiteProgress } from '../state/construction';
import { assignIdleBuilders, updateBuilders } from '../state/builder';
import type { GameState, BuildingType, ProducibleUnitType, TerrainType } from '../state/types';
import { validateMap } from '../state/mapValidation';
import { PauseMenu } from './ui/PauseMenu';
import type { GameSetupConfig } from '../state/gameSetup';
import { DEFAULT_SETUP, getMapDataFromConfig, getMapDisplayName, resolveResourceStyleForMapStyle } from '../state/gameSetup';
import type { MapStyle, ResourceStyle } from '../state/gameSetup';
import { saveGame } from '../state/saveGame';
import { loadUiSettings, applyUiScale } from '../state/uiSettings';
import { DevtoolsPanel } from './ui/DevtoolsPanel';
import { isDevtoolsEnabled, type DevCommandResult } from '../state/devCommands';
import { isArenaEnabled, ARENA_MAP_ID, createArenaMapData, arenaSpawnVehicle } from '../state/devArena';
import { createArenaModeContext, type ArenaModeContext } from '../state/arenaModeContext';
import { ArenaMenu } from './ui/ArenaMenu';
import {
  createArenaPlacementState,
  enterPlacementMode,
  cancelPlacementMode,
  convertClickToPlacementTile,
  getPlacementHoverTile,
  type ArenaPlacementState,
} from '../state/arenaPlacement';
import { projectGroundPoint } from '../config/cameraProjectionContract';
import { BlockoutVehicleInputController } from './input/BlockoutVehicleInputController';
import { DEFAULT_SANDBOX_SCENARIO, ARENA_SANDBOX_SCENARIO } from '../config/blockoutScenarioData';
import { setDebugRenderFlag } from '../config/debugRenderFlags';
import { resetBlockoutScenario } from '../state/blockoutScenario';
import { updateBlockoutVehicleMovement } from '../state/blockoutMovement';
import { TileReservationMap, RESERVATION_MAX_AGE_MS } from '../state/tileReservation';
import { buildOccupancyMap, addUnitBlockers, addVehicleBlockers } from '../state/occupancy';
import { updateBlockoutRecoil, expireVfxEvents, tickContinuousFire, stopFiring } from '../state/blockoutWeaponVfx';
import { updateAllWeaponResources, tryFireWithDamage, clearTargetAndWeaponState } from '../state/weaponFireCoordinator';
import { tickContinuousDamage, expireDamageEvents } from '../state/blockoutDamage';
import { MOVEMENT_PROFILES } from '../config/blockoutMovementData';
import { getEffectiveMovementProfile } from '../state/blockoutUpgrades';
import { computeProjectedBarrelTipScreenAtZ, computeBodyWorldCenter, computeProjectedTurretMountScreen } from './render/blockoutVehicleGeometry';
import type { BlockoutVehicleState } from '../state/blockoutVehicleState';
import { updateBlockoutAi } from '../state/blockoutAi';
import { updateAllCombatTargeting } from '../state/combatTargeting';
import { angleFromTo } from '../state/angleMath';
import { rotateTurretToward } from '../state/blockoutTurretAim';
import { cycleArenaInspectionBody, cycleArenaInspectionWeapon, resetArenaInspectionPose } from '../state/arenaInspection';


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

/**
 * Infer mapStyle from terrain data in a loaded save.
 * VISUAL-05A-PR2 fix: When a saved game is loaded, the setupConfig
 * is built from DEFAULT_SETUP which has mapStyle='sand'. If the saved
 * terrain contains any 'industrial' tiles, we must render as industrial
 * or the terrain will be invisible (TERRAIN_KEY_MAP.industrial is '').
 */
function inferMapStyleFromTerrain(terrain: TerrainType[][]): MapStyle {
  return terrain.some(row => row.some(t => t === 'industrial')) ? 'industrial' : 'sand';
}

export class GameScene extends Phaser.Scene {
  // Stage 4: RenderManager owns all renderer fields.
  // GameScene accesses them via getters for backward compatibility.
  private renderManager: RenderManager | null = null;

  // Render field getters (delegate to RenderManager)
  private get terrainRenderer() { return this.renderManager?.terrainRenderer ?? null; }
  private get industrialFrameRenderer() { return this.renderManager?.industrialFrameRenderer ?? null; }
  private get entityRenderer() { return this.renderManager?.entityRenderer ?? null; }
  // Stage 4: getters below provide access to renderers still needed by
  // GameScene for input controller wiring, camera bounds, and devtools panel
  // callbacks. All other renderer access is delegated to RenderManager phase
  // methods (syncCivilRenderState / syncBlockoutInputVisualState / syncBlockoutRenderState)
  // and bridge methods (setSelectedVehicleId / toggleSandboxHelp / toggleCameraProjectionDebug).
  private get feedbackRenderer() { return this.renderManager?.feedbackRenderer ?? null; }
  private get debugOverlayRenderer() { return this.renderManager?.debugOverlayRenderer ?? null; }
  private get assetPreviewTool() { return this.renderManager?.assetPreviewTool ?? null; }
  private get assetPreviewPanel() { return this.renderManager?.assetPreviewPanel ?? null; }

  private cameraControls: CameraControls | null = null;
  private inputController: GameInputController | null = null;
  private playtestHud: PlaytestHud | null = null;
  private visualHudCore: VisualHudCore | null = null;
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

  // ARCH-12A: Arena mode flag
  private arenaMode = false;

  /** Offset for tile-to-screen conversion. */
  private _offset: { x: number; y: number } = { x: 0, y: 0 };

  /** Track last raw count to log once per unload. */
  private lastLoggedRaw: number = 0;

  // BLOCKOUT-03H: Blockout vehicle input controller (selection/aim, only when devtools is active)
  private blockoutVehicleInputController: BlockoutVehicleInputController | null = null;

  // ARENA-01H+: ArenaMenu — primary Arena UX (replaces PlaytestHud for Arena)
  private arenaMenu: ArenaMenu | null = null;

  // ARENA-01H+: ArenaModeContext — controls which subsystems are active
  private arenaCtx: ArenaModeContext = createArenaModeContext(false);

  // ARENA-02H+: Placement state for Arena unit creation
  private arenaPlacementState: ArenaPlacementState = createArenaPlacementState();

  // ARENA-02H+: Placement marker graphics (projected ground plane diamond)
  private placementMarker: Phaser.GameObjects.Graphics | null = null;

  // CORE-STEP-06H+: Tile reservation map for grid movement
  private reservationMap: TileReservationMap | null = null;

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
      // VISUAL-05A-PR2 fix: Infer mapStyle from loaded terrain so industrial
      // saves render correctly instead of falling back to sand (DEFAULT_SETUP).
      const inferredStyle = inferMapStyleFromTerrain(data.loadedGameState.mapData.terrain);
      this.setupConfig = {
        ...DEFAULT_SETUP,
        faction: data.loadedGameState.playerFaction,
        mapId: data.mapId ?? 'customMap1',
        mapStyle: inferredStyle,
        resourceStyle: resolveResourceStyleForMapStyle(inferredStyle),
      };
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
    // MENU-02: Mode detection now supports both URL params and GameSetupConfig.gameMode.
    // URL params take priority (for QA shortcuts), but if no URL params are set,
    // the config-based mode from menu selection is used.
    const urlDevtools = isDevtoolsEnabled();
    const urlArena = urlDevtools && isArenaEnabled();
    const configDebug = this.setupConfig.gameMode === 'debug';
    const configArena = this.setupConfig.gameMode === 'arena';

    this.devtoolsActive = urlDevtools || configDebug || configArena;
    this.arenaMode = urlArena || configArena;

    // ARENA-01H+: Create ArenaModeContext — controls which subsystems are active
    this.arenaCtx = createArenaModeContext(this.arenaMode);

    // Determine the game state source — loaded save takes priority,
    // then arena (dev-only), then normal setup config.
    if (this.loadedGameState) {
      // PHASER4-LOAD-02: Strip modular-combat entities from old saves in standard mode.
      // Older saves may contain modular-combat entities whose textures are not loaded
      // when devtools is disabled. Devtools/arena mode preserves them (textures loaded).
      this.gameState = stripModularCombatFromState(this.loadedGameState, {
        includeModularCombat: this.devtoolsActive,
      });
      this.loadedGameState = null;
      const stripped = this.gameState.entities.filter(e => e.kind === 'modular-combat').length === 0
        && (this.gameState.extraModularCombat?.length ?? 0) === 0;
      if (!stripped) {
        console.log('[GameScene] Loaded saved game state (modular-combat preserved: devtools mode).');
      } else {
        console.log('[GameScene] Loaded saved game state.');
      }
    } else if (this.arenaMode) {
      // ARENA-01H+: Arena mode — clean standalone, no HQ/harvesters/resources/economy
      const arenaMapData = createArenaMapData();
      this.gameState = createInitialState(arenaMapData, this.setupConfig.faction, 'QA Arena', { includeModularCombat: true, arenaMode: true });
      console.log('[GameScene] Arena mode active. Map: QA Arena (20x20) — clean standalone');
    } else {
      const mapData = getMapDataFromConfig(this.setupConfig);
      const mapNameOverride = getMapDisplayName(this.setupConfig);
      this.gameState = createInitialState(mapData, this.setupConfig.faction, mapNameOverride, { includeModularCombat: this.devtoolsActive });
    }

    // CORE-STEP-06H+: Initialize tile reservation map for grid movement
    this.reservationMap = new TileReservationMap(this.gameState.mapWidth);

    // ARCH-11A: Log faction for smoke test verification
    console.log(`[GameScene] Faction: ${this.gameState.playerFaction}`);

    // Verify all required assets are loaded
    this.verifyAssets();

    // Stage 4: RenderManager owns all renderer construction.
    const mapStyle: MapStyle = this.setupConfig.mapStyle ?? 'sand';
    const resourceStyle: ResourceStyle = this.setupConfig.resourceStyle ?? 'legacy';
    const offset = mapOriginOffset(this.gameState.mapWidth, this.gameState.mapHeight);
    this._offset = offset;

    this.renderManager = new RenderManager(this);
    this.renderManager.create(this.gameState, {
      offset: offset as IsoPoint,
      mapStyle,
      resourceStyle,
      devtoolsActive: this.devtoolsActive,
      arenaMode: this.arenaMode,
      arenaCtx: this.arenaCtx,
      onClearModularVehicleRender: () => this.entityRenderer?.clearModularVehicleRender(),
      onActivateModularVehicleRender: () => this.entityRenderer?.activateModularVehicleRender(),
      isPlacementActive: () => this.arenaPlacementState.mode === 'placing',
      isArenaMode: () => this.arenaMode,
      getGameState: () => this.gameState,
    });

    // ARCH-11A: Log harvester animation readiness for smoke test verification
    console.log('[GameScene] Harvester animation ready.');

    // Setup camera
    // VISUAL-05A-PR3: Use extended bounds when industrial frame is present
    this.cameraControls = new CameraControls(this);
    const bounds = this.industrialFrameRenderer
      ? this.industrialFrameRenderer.getExtendedBounds()
      : (this.terrainRenderer?.getBounds() ?? new Phaser.Geom.Rectangle(0, 0, 800, 600));
    this.cameraControls.setBounds(bounds);

    // ARENA-01H+: Center camera on map center for Arena, HQ for Normal Game
    if (this.arenaCtx.arenaMode) {
      const centerTx = Math.floor(this.gameState.mapWidth / 2);
      const centerTy = Math.floor(this.gameState.mapHeight / 2);
      const centerScreen = tileToScreen(centerTx, centerTy);
      this.hqWorldX = centerScreen.x + offset.x;
      this.hqWorldY = centerScreen.y + offset.y;
    } else {
      const hq = this.gameState.mapData.hq;
      const hqCenterTx = hq.tx + 1;
      const hqCenterTy = hq.ty + 1;
      const hqScreen = tileToScreen(hqCenterTx, hqCenterTy);
      this.hqWorldX = hqScreen.x + offset.x;
      this.hqWorldY = hqScreen.y + offset.y;
    }
    // VISUAL-HUD-CORE-01-FIXUP-1: Apply camera safe-area BEFORE centerOn
    // so the viewport is already reduced when centering computes the offset.
    // Only apply in Normal Game mode (showPlaytestHud); Arena keeps full viewport.
    if (shouldUseBottomHudSafeArea(this.arenaCtx)) {
      const cam = this.cameras.main;
      cam.setViewport(cam.x, cam.y, cam.width, cam.height - HUD_BAR_HEIGHT);
    }

    this.cameraControls.centerOn(this.hqWorldX, this.hqWorldY);
    this.cameraControls.bindResetKey('R', this.hqWorldX, this.hqWorldY);

    // ARENA-01H+: Arena mode uses ArenaMenu instead of PlaytestHud
    if (this.arenaCtx.showPlaytestHud) {
      this.playtestHud = new PlaytestHud();
    }

    // VISUAL-HUD-CORE-01: Create bottom RTS HUD (Normal Game only)
    if (this.arenaCtx.showPlaytestHud) {
      // VISUAL-COMMAND-PANEL-02: Wire command execution through the
      // command registry so HUD button clicks use the same execution
      // path as hotkeys — requestBuild / requestQueueUnit / stopUnit.
      const onCommand = (commandId: string) => {
        // Use the registry's execute which respects enabled predicates
        // and calls the wired callbacks.
        const executed = commandRegistry.execute(commandId);
        if (!executed) {
          // Command not found or not enabled — try unit-stop as special case
          if (commandId === 'unit-stop') {
            const sel = this.inputController?.getSelection() ?? null;
            if (sel) {
              const result = stopUnitCommand(this.gameState, sel);
              this.inputController?.showStatus(result.ok ? 'Stopped' : result.reason, result.ok);
            }
          }
        }
      };
      this.visualHudCore = new VisualHudCore();
      this.visualHudCore.create(onCommand);
      // Hide the old PlaytestHud economy section since the new HUD
      // resource strip and command panel now provide the same functionality.
      // Build/produce/factory controls are now in the bottom HUD command panel.
      this.playtestHud?.hideEconomySection();
    }

    // ARENA-01H+: Create ArenaMenu if in Arena mode
    if (this.arenaCtx.showArenaMenu) {
      this.arenaMenu = new ArenaMenu();
      this.arenaMenu.create({
        onResetArena: () => {
          this.scene.restart({ faction: this.setupConfig.faction, mapId: ARENA_MAP_ID, gameMode: 'arena' });
        },
        onClearUnits: () => {
          // ARENA-01H+: Clear all blockout vehicles
          if (this.gameState.blockoutVehicles) {
            this.gameState.blockoutVehicles.length = 0;
            this.gameState.blockoutObstacles = [];
          }
        },
        onToggleHelp: () => {
          // ARENA-04H+: Toggle both ArenaMenu help overlay and HUD renderer help
          this.arenaMenu?.toggleHelp();
          this.renderManager?.toggleSandboxHelp();
        },
        // ARENA-02H+: Placement mode callbacks
        onPlaceUnit: () => {
          const composer = this.arenaMenu?.getUnitComposer();
          if (!composer) return;
          const selections = composer.getSelections();
          if (!selections.body || !selections.weapon) return;
          // Sync selections to placement state
          this.arenaPlacementState.selectedBody = selections.body;
          this.arenaPlacementState.selectedWeapon = selections.weapon;
          this.arenaPlacementState.selectedTeam = selections.team;
          this.arenaPlacementState.selectedAiMode = selections.aiMode; // ARENA-05H+
          const entered = enterPlacementMode(this.arenaPlacementState);
          if (!entered) {
            this.arenaMenu?.showPlacementFeedback('Select body and weapon first', false);
          }
        },
        onCancelPlacement: () => {
          cancelPlacementMode(this.arenaPlacementState);
          this.hidePlacementMarker();
        },
        getPlacementState: () => this.arenaPlacementState,
        // ARENA-04H+: Roster callbacks — select, target, deselect, clear target
        getSelectedVehicleId: () => this.blockoutVehicleInputController?.selectedVehicleId ?? null,
        getTargetVehicleId: () => {
          const selectedId = this.blockoutVehicleInputController?.selectedVehicleId;
          if (!selectedId) return null;
          const selected = this.gameState.blockoutVehicles?.find(v => v.id === selectedId);
          return selected?.targetVehicleId ?? null;
        },
        onSelectVehicle: (vehicleId: string) => {
          // ARENA-04H+: Select a vehicle from roster click.
          // In Arena mode: only allies can be selected as controllable.
          const vehicles = this.gameState.blockoutVehicles;
          if (!vehicles) return;
          const vehicle = vehicles.find(v => v.id === vehicleId);
          if (!vehicle) return;
          if (vehicle.team === 'enemy') return; // Enemies are not controllable
          // Use the input controller's proper selection method
          this.blockoutVehicleInputController?.setSelectedVehicleId(vehicleId);
        },
        onAssignTarget: (targetVehicleId: string) => {
          // ARENA-04H+: Assign a target from roster enemy click.
          const selectedId = this.blockoutVehicleInputController?.selectedVehicleId;
          if (!selectedId) return;
          const vehicles = this.gameState.blockoutVehicles;
          if (!vehicles) return;
          const selected = vehicles.find(v => v.id === selectedId);
          if (!selected || selected.team !== 'ally') return;
          // Validate target exists and is enemy
          const target = vehicles.find(v => v.id === targetVehicleId);
          if (!target || target.team !== 'enemy') return;
          selected.targetVehicleId = targetVehicleId;
        },
        onDeselectVehicle: () => {
          // ARENA-04H+: Deselect current vehicle and clear its target.
          this.blockoutVehicleInputController?.setSelectedVehicleId(null);
        },
        onClearTarget: () => {
          // ARENA-04H+: Clear target on selected vehicle.
          // CORE-STEP-08H+ FIXUP Blocker 3: Uses clearTargetAndWeaponState
          // to properly cancel wind-up (Railgun) and drum bursts (Hammer).
          const selectedId = this.blockoutVehicleInputController?.selectedVehicleId;
          if (!selectedId) return;
          const vehicles = this.gameState.blockoutVehicles;
          if (vehicles) {
            const selected = vehicles.find(v => v.id === selectedId);
            if (selected) {
              clearTargetAndWeaponState(selected);
            }
          }
        },
        onInspectPrevBody: () => this.inspectCycleBody(-1),
        onInspectNextBody: () => this.inspectCycleBody(1),
        onInspectPrevWeapon: () => this.inspectCycleWeapon(-1),
        onInspectNextWeapon: () => this.inspectCycleWeapon(1),
        onInspectResetPose: () => this.inspectResetPose(),
      });
      console.log('[GameScene] ArenaMenu created (primary Arena UX).');
    }

    // ARCH-14B: Create pause menu with callbacks
    // ARENA-01H+: Pause menu is available in Arena mode too (ESC menu)
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
        onLoad: (gameState: GameState, mapId: string, saveSlotId: string) => {
          // UI-04: Load a saved game from in-game ESC menu
          // Uses scene restart with LoadSceneData, same as MainMenuScene loading
          this.paused = false;
          this.scene.restart({
            loadedGameState: gameState,
            mapId,
            saveSlotId,
          } as LoadSceneData);
        },
      },
      this.setupConfig,
    );

    // Stage 4: Debug overlay, asset preview, modular vehicle, blockout renderers
    // are now created by RenderManager.create() above.
    // DevtoolsPanel is still created here (UI panel, not a renderer).

    // ARCH-11A: Create devtools panel if activated
    // ARENA-01H+: In Arena mode, DevTools starts HIDDEN — ArenaMenu is primary UX.
    // DevTools remains available via F10/backtick for technical debugging.
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
            this.scene.restart({ faction: this.setupConfig.faction, mapId: ARENA_MAP_ID, gameMode: 'arena' });
          }
        },
        getScene: () => this as Phaser.Scene,
      }, this.arenaMode);
      if (this.arenaMode) {
        this.devtoolsPanel.hide();
      }
      console.log('[GameScene] Devtools panel enabled.', this.arenaMode ? '(hidden — ArenaMenu is primary UX)' : '');
    }

    // BLOCKOUT-02H: Spawn initial scenario if devtools is active
    if (this.devtoolsActive) {
      const scenario = this.arenaMode ? ARENA_SANDBOX_SCENARIO : DEFAULT_SANDBOX_SCENARIO;
      resetBlockoutScenario(this.gameState, scenario);
      // ARENA-VISUAL-COMBAT-FIX-01 fixup-4: Enable obstacle geometry only
      // when the scenario has obstacles (DEFAULT_SANDBOX_SCENARIO).
      // Arena sandbox has no obstacles — keep flag false.
      setDebugRenderFlag('obstacleGeometry', scenario.obstacles.length > 0);
      console.log('[GameScene] Blockout vehicle renderer enabled. Spawned', this.arenaMode ? 'arena' : 'sandbox', 'scenario.');
    }

    // ARENA-02H+: Create placement marker graphics (projected ground plane diamond)
    if (this.arenaMode) {
      this.placementMarker = this.add.graphics();
      this.placementMarker.setDepth(60); // Above terrain but below vehicles
      this.placementMarker.setVisible(false);

      // ARENA-02H+: Register placement click handler
      this.input.on('pointerdown', this.handlePlacementPointerdown, this);
      this.input.on('pointermove', this.handlePlacementPointermove, this);
      this.input.keyboard?.on('keydown', this.handlePlacementKeydown, this);
    }

    // BLOCKOUT-03H: Create blockout vehicle input controller for selection/aiming
    // BLOCKOUT-10H+: Wire R/T/H hotkeys and sandbox HUD
    if (this.devtoolsActive) {
      this.blockoutVehicleInputController = new BlockoutVehicleInputController({
        scene: this,
        offset: this._offset as IsoPoint,
        getGameState: () => this.gameState,
        isDevtoolsActive: () => this.devtoolsActive,
        onSelectionChanged: (selectedId: string | null) => {
          this.renderManager?.setSelectedVehicleId(selectedId);
        },
        onResetScenario: () => {
          // ARENA-01H+: Arena uses obstacle-free scenario on reset
          const scenario = this.arenaMode ? ARENA_SANDBOX_SCENARIO : DEFAULT_SANDBOX_SCENARIO;
          resetBlockoutScenario(this.gameState, scenario);
          // ARENA-VISUAL-COMBAT-FIX-01 fixup-4: Sync obstacle geometry flag
          setDebugRenderFlag('obstacleGeometry', scenario.obstacles.length > 0);
          // CORE-STEP-06H+: Reinitialize reservation map on scenario reset
          this.reservationMap = new TileReservationMap(this.gameState.mapWidth);
          console.log('[GameScene] Scenario reset to', this.arenaMode ? 'arena' : 'defaults', '.');
        },
        onToggleHelp: () => {
          this.renderManager?.toggleSandboxHelp();
        },
        onToggleCalibration: () => {
          const visible = this.renderManager?.toggleCameraProjectionDebug() ?? false;
          console.log(`[GameScene] Camera projection calibration overlay: ${visible ? 'ON' : 'OFF'}`);
        },
        // ARENA-02H+ fixup: Guard placement mode — suppress selection/movement when placing
        isPlacementActive: () => this.arenaPlacementState.mode === 'placing',
        // ARENA-03H+: Arena mode flag — enforces ally/enemy control and target-lock
        isArenaMode: () => this.arenaMode,
        // CORE-STEP-06H+: Provides tile reservation map for grid movement commands
        getReservationMap: () => this.reservationMap,
      });
      console.log('[GameScene] Blockout vehicle input controller enabled.');
    }

    // ── ARCH-18A-LITE: Create input controller ─────────────────────
    // All keyboard/pointer input wiring, selection state, and command
    // methods are now handled by GameInputController.
    this.inputController = new GameInputController({
      scene: this,
      offset: this._offset as IsoPoint,
      getGameState: () => this.gameState,
      entityRenderer: this.entityRenderer!,
      feedbackRenderer: this.feedbackRenderer!,
      showStatus: (message: string, success: boolean) => this.playtestHud?.showStatus(message, success),
      pauseMenu: this.pauseMenu,
      debugOverlayRenderer: this.debugOverlayRenderer,
      devtoolsPanel: this.devtoolsPanel,
      assetPreviewTool: this.assetPreviewTool,
      assetPreviewPanel: this.assetPreviewPanel,
      setPaused: (paused: boolean) => { this.paused = paused; },
      // ARENA-02H+ fixup: Guard placement mode — suppress ESC pause toggle when placing
      isPlacementActive: () => this.arenaPlacementState.mode === 'placing',
      // CORE-STEP-05H+: Arena mode flag and CameraControls reference
      isArenaMode: () => this.arenaMode,
      cameraControls: this.cameraControls,
      // VISUAL-HUD-CORE-01-FIXUP-2: Bottom HUD active gate — same source of
      // truth as camera safe-area. When false, isPointerInHud() returns false
      // and the full canvas remains interactive (Arena mode).
      isBottomHudActive: () => shouldUseBottomHudSafeArea(this.arenaCtx),
    });

    // Wire PlaytestHud callbacks to delegate to the input controller
    // ARENA-01H+: Only wire PlaytestHud in Normal Game (Arena uses ArenaMenu)
    if (this.playtestHud) {
      const cancelHandler = (factoryIndex: number, queueIndex: number) => {
        return this.inputController!.requestCancelQueueItem(factoryIndex, queueIndex);
      };
      this.playtestHud.create(
        (buildingType: BuildingType) => this.inputController!.requestBuild(buildingType),
        (unitType: ProducibleUnitType) => this.inputController!.requestQueueUnit(unitType),
        cancelHandler,
      );
    }

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

    // ARENA-01H+: Skip civil game loop in Arena mode (no harvesters, economy, construction)
    if (this.arenaCtx.runCivilLoop) {
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
    }

    // 5. Sync render layer (Stage 4 FIXUP-1: delegated to RenderManager)
    this.renderManager?.syncCivilRenderState(this.gameState, this.time.now);

    // 6. Update PlaytestHud panel (ARENA-01H+: only in Normal Game)
    if (this.playtestHud) {
      this.playtestHud.update(this.gameState);
    }

    // VISUAL-HUD-CORE-01: Update bottom RTS HUD
    if (this.visualHudCore) {
      // Sync selection from input controller
      const sel = this.inputController?.getSelection() ?? null;
      this.visualHudCore.setSelection(sel);
      this.visualHudCore.update(this.gameState);
    }

    // ARENA-01H+: Update ArenaMenu (primary Arena UX)
    if (this.arenaMenu) {
      this.arenaMenu.update(this.gameState);
    }

    // 7. Update input controller (selection highlight)
    this.inputController?.update();

    // 8. ARCH-11A: Update devtools diagnostics
    this.devtoolsPanel?.update(this.gameState);

    // 8b-8e: Stage 4 FIXUP-1: debug/feedback/motion/assetPreview sync
    // now handled by syncCivilRenderState() above.

    // 8f. BLOCKOUT-02H: Update blockout vehicle input controller
    // Stage 4 FIXUP-1: hover/target visual sync delegated to RenderManager
    if (this.blockoutVehicleInputController && this.devtoolsActive) {
      this.blockoutVehicleInputController.update(delta);
      this.renderManager?.syncBlockoutInputVisualState(
        this.gameState,
        this.blockoutVehicleInputController.hoveredVehicleId,
        this.blockoutVehicleInputController.selectedVehicleId,
        this.arenaMode,
      );
    }
    // BLOCKOUT-04H+: Update blockout vehicle movement
    // BLOCKOUT-09H: Use effective movement profile (with upgrade modifiers)
    // CORE-STEP-06H+: Build occupancy map and pass grid movement params
    if (this.gameState.blockoutVehicles && this.devtoolsActive) {
      // Build occupancy map once per frame for all vehicles
      const occupancy = buildOccupancyMap(this.gameState);
      if (this.gameState.blockoutVehicles) {
        // Add all vehicle blockers initially; each vehicle excludes itself via getOccupancyForRepath
        addVehicleBlockers(this.gameState.blockoutVehicles, occupancy);
      }
      addUnitBlockers(this.gameState, occupancy);

      // getOccupancyForRepath: rebuilds fresh occupancy excluding the repathing vehicle
      const getOccupancyForRepath = (excludeVehicleId: string) => {
        const fresh = buildOccupancyMap(this.gameState);
        if (this.gameState.blockoutVehicles) {
          addVehicleBlockers(this.gameState.blockoutVehicles, fresh, excludeVehicleId);
        }
        addUnitBlockers(this.gameState, fresh);
        return fresh;
      };

      for (const vehicle of this.gameState.blockoutVehicles) {
        const baseProfile = MOVEMENT_PROFILES[vehicle.bodyId];
        if (baseProfile) {
          const effectiveProfile = getEffectiveMovementProfile(vehicle, baseProfile);
          updateBlockoutVehicleMovement(
            vehicle, effectiveProfile, delta, this.gameState.blockoutObstacles,
            occupancy, this.reservationMap ?? undefined,
            () => getOccupancyForRepath(vehicle.id),
            this.time.now,
          );
        }
      }
    }
    // BLOCKOUT-05H+: Update blockout vehicle recoil
    if (this.gameState.blockoutVehicles && this.devtoolsActive) {
      const nowMs = this.time.now;
      for (const vehicle of this.gameState.blockoutVehicles) {
        updateBlockoutRecoil(vehicle, nowMs);
      }
      // Expire old VFX events
      expireVfxEvents(nowMs);
    }
    // ARENA-05H+: Update enemy AI (Arena mode only)
    if (this.arenaMode && this.gameState.blockoutVehicles) {
      const nowMs = this.time.now;
      updateBlockoutAi(this.gameState.blockoutVehicles, {
        nowMs,
        offsetX: this._offset.x,
        offsetY: this._offset.y,
        // CORE-STEP-06H+: Pass gameState and reservationMap for grid pathing
        gameState: this.gameState,
        reservationMap: this.reservationMap ?? undefined,
        // CORE-STEP-08H+ FIXUP Blocker 3: fireWeapon callback now uses weapon fire coordinator
        // This ensures wind-up (Railgun), drum burst (Hammer), and resource gates
        // are properly handled for AI weapons too.
        fireWeapon: (enemy, target, fireNowMs) => {
          // ARENA-VISUAL-COMBAT-FIX-01 Fix 6: Use modular barrel tip when
          // modular rendering is active, otherwise fall back to blockout geometry.
          const barrelTip = this.computeBarrelTip(enemy);
          const barrelTipX = barrelTip.x;
          const barrelTipY = barrelTip.y;
          // Target center as aim point
          const targetCenter = computeBodyWorldCenter(target, this._offset as IsoPoint);
          const aimTargetX = targetCenter.x;
          const aimTargetY = targetCenter.y;

          tryFireWithDamage(
            enemy,
            this.gameState.blockoutVehicles!,
            barrelTipX, barrelTipY,
            enemy.turretAngle,
            aimTargetX, aimTargetY,
            this._offset as IsoPoint, fireNowMs,
            this.gameState.blockoutObstacles ?? [],
          );
        },
      });
    }
    // CORE-STEP-07H+: Update combat targeting for all vehicles with active target-locks
    // This drives auto-chase, stop-at-range, and turret aim tracking for player allies
    if (this.gameState.blockoutVehicles && this.arenaMode && this.reservationMap) {
      updateAllCombatTargeting(
        this.gameState.blockoutVehicles,
        this.gameState,
        this.reservationMap,
        this._offset as { x: number; y: number },
        {
          nowMs: this.time.now,
          // CORE-STEP-08H+ FIXUP Blocker 3: Target-lock auto-fire uses weapon fire coordinator
          // This ensures wind-up (Railgun), drum burst (Hammer), and resource gates
          // are properly handled for player target-lock weapons too.
          fireWeapon: (vehicle, target, fireNowMs) => {
            const barrelTip = this.computeBarrelTip(vehicle);
            const targetCenter = computeBodyWorldCenter(target, this._offset as IsoPoint);

            tryFireWithDamage(
              vehicle,
              this.gameState.blockoutVehicles!,
              barrelTip.x, barrelTip.y,
              vehicle.turretAngle,
              targetCenter.x, targetCenter.y,
              this._offset as IsoPoint, fireNowMs,
              this.gameState.blockoutObstacles ?? [],
            );
          },
        },
      );
    }
    // C1: Arena turrets always rotate toward either a valid target or body-parallel rest.
    this.updateArenaTurretAiming(delta);
    // CORE-STEP-08H+ FIXUP-2: Update weapon resources AFTER combat targeting and AI.
    // Canisters drain/regen, overheat cools, magazines regen, drums reload.
    // Must run after updateAllCombatTargeting so isAutoFiring is set for canister drain.
    if (this.gameState.blockoutVehicles) {
      const nowMs = this.time.now;
      updateAllWeaponResources(this.gameState.blockoutVehicles, nowMs, delta);
    }
    // CORE-STEP-06H+: Clean up stale tile reservations periodically
    if (this.reservationMap) {
      this.reservationMap.cleanStale(this.time.now, RESERVATION_MAX_AGE_MS);
    }
    // BLOCKOUT-06H+: Tick continuous fire for stream weapons
    // BLOCKOUT-07H+: Also tick continuous damage
    // ARENA-03H+: Use target-lock aim for Arena vehicles with target
    if (this.gameState.blockoutVehicles && this.devtoolsActive) {
      const nowMs = this.time.now;
      for (const vehicle of this.gameState.blockoutVehicles) {
        if (vehicle.fireHeld && vehicle.isFiring && !vehicle.isDestroyed) {
          // ARENA-VISUAL-COMBAT-FIX-01 Fix 6: Use modular barrel tip when
          // modular rendering is active, otherwise fall back to blockout geometry.
          const barrelTip = this.computeBarrelTip(vehicle);
          const barrelTipX = barrelTip.x;
          const barrelTipY = barrelTip.y;

          // ARENA-03H+: In Arena mode, continuous fire uses target-lock direction
          // ARENA-03H+ fixup: null return means no valid target — stop fire and skip tick
          const aimTarget = this.getContinuousFireAimTarget(vehicle);
          if (!aimTarget) {
            // Arena mode: no valid target — stop continuous fire, do not fall back to turret angle
            stopFiring(vehicle);
            continue;
          }
          const aimTargetX = aimTarget.x;
          const aimTargetY = aimTarget.y;

          tickContinuousFire(vehicle, barrelTipX, barrelTipY, vehicle.turretAngle,
            aimTargetX, aimTargetY, nowMs);
          // BLOCKOUT-07H+: Apply continuous damage
          // BLOCKOUT-08H: Pass obstacles for line-of-fire blocking
          tickContinuousDamage(vehicle, this.gameState.blockoutVehicles,
            barrelTipX, barrelTipY, vehicle.turretAngle,
            aimTargetX, aimTargetY,
            this._offset as IsoPoint, nowMs,
            this.gameState.blockoutObstacles);
        }
      }
      // BLOCKOUT-07H+: Expire damage events
      expireDamageEvents(nowMs);
    }
    // Stage 4 FIXUP-1: blockout render sync delegated to RenderManager
    this.renderManager?.syncBlockoutRenderState(
      this.gameState,
      this.time.now,
      this.blockoutVehicleInputController?.selectedVehicleId ?? null,
      this.devtoolsActive,
      this.arenaMode,
    );

    // 10. Debug log on unload completion (ARENA-01H+: only in Normal Game)
    if (this.arenaCtx.runCivilLoop && this.gameState.economy.raw > this.lastLoggedRaw) {
      console.log(
        `[GameScene] Unloaded! Raw: ${this.gameState.economy.raw}`,
      );
      this.lastLoggedRaw = this.gameState.economy.raw;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────

  /**
   * ARENA-VISUAL-COMBAT-FIX-01 Fix 6: Compute barrel tip screen position.
   *
   * When the vehicle is using modular rendering (modular sprites are active),
   * uses the modular adapter's barrel tip computation which accounts for:
   *   - The turret sprite's actual screen position (including visual center offset)
   *   - Weapon-specific estimated barrel length from modular turret PNGs
   *
   * When modular rendering is not active, falls back to the blockout
   * procedural geometry barrel tip computation.
   *
   * @param vehicle - The vehicle to compute the barrel tip for
   * @returns Screen-space barrel tip position
   */
  private computeBarrelTip(vehicle: BlockoutVehicleState): { x: number; y: number } {
    // Try modular barrel tip first (when modular rendering is active)
    const blockoutRenderer = this.renderManager?.getBlockoutVehicleRenderer();
    if (blockoutRenderer?.isVehicleUsingModularRender(vehicle.id)) {
      const modularTip = blockoutRenderer.getModularBarrelTip(vehicle.id, vehicle.turretAngle);
      if (modularTip) return modularTip;
    }
    // Fallback: blockout procedural geometry barrel tip
    return computeProjectedBarrelTipScreenAtZ(vehicle, this._offset as IsoPoint);
  }

  // ─── ARENA-02H+: Placement mode handlers ─────────────────────────

  /**
   * Handle pointer down in placement mode.
   * LMB: attempt placement. RMB: cancel placement mode.
   */
  private handlePlacementPointerdown(pointer: Phaser.Input.Pointer): void {
    if (!this.arenaMode) return;
    if (this.arenaPlacementState.mode !== 'placing') return;

    // RMB cancels placement
    if (pointer.rightButtonDown()) {
      cancelPlacementMode(this.arenaPlacementState);
      this.hidePlacementMarker();
      return;
    }

    // LMB: attempt placement at click position
    if (pointer.leftButtonDown()) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      const result = convertClickToPlacementTile(
        worldPoint.x, worldPoint.y,
        this._offset,
        this.gameState.mapWidth,
        this.gameState.mapHeight,
        this.gameState.blockoutVehicles ?? [],
      );

      if (!result.valid) {
        this.arenaMenu?.showPlacementFeedback(result.reason ?? 'Invalid placement', false);
        return;
      }

      // Spawn the vehicle
      // ARENA-05H+ fixup: Pass selected AI mode for enemy units
      const spawnResult = arenaSpawnVehicle(
        this.gameState,
        this.arenaPlacementState.selectedBody!,
        this.arenaPlacementState.selectedWeapon!,
        this.arenaPlacementState.selectedTeam,
        result.tx,
        result.ty,
        this.arenaPlacementState.selectedTeam === 'enemy' ? this.arenaPlacementState.selectedAiMode : undefined,
      );

      if (spawnResult.success) {
        this.arenaMenu?.showPlacementFeedback(spawnResult.message, true);
        // Stay in placement mode for rapid placement — user can Esc/RMB to cancel
      } else {
        this.arenaMenu?.showPlacementFeedback(spawnResult.message, false);
      }
    }
  }

  /**
   * Handle pointer move in placement mode — update placement marker position.
   * ARENA-02H+: Marker is projected onto the ground plane using camera projection contract.
   */
  private handlePlacementPointermove(pointer: Phaser.Input.Pointer): void {
    if (!this.arenaMode) return;
    if (this.arenaPlacementState.mode !== 'placing') return;
    if (!this.placementMarker) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    const hoverTile = getPlacementHoverTile(
      worldPoint.x, worldPoint.y,
      this._offset,
      this.gameState.mapWidth,
      this.gameState.mapHeight,
      this.gameState.blockoutVehicles ?? [],
    );

    if (!hoverTile) {
      this.placementMarker.setVisible(false);
      return;
    }

    // Draw projected ground plane diamond at hover tile
    this.drawPlacementMarker(hoverTile.tx, hoverTile.ty, hoverTile.valid);
  }

  /**
   * Handle keydown in placement mode — Esc cancels placement.
   */
  private handlePlacementKeydown(event: KeyboardEvent): void {
    if (!this.arenaMode) return;
    if (this.arenaPlacementState.mode !== 'placing') return;

    if (event.code === 'Escape') {
      cancelPlacementMode(this.arenaPlacementState);
      this.hidePlacementMarker();
    }
  }

  /**
   * Draw a placement marker on the ground plane at the given tile position.
   * ARENA-02H+: Uses projectGroundPoint from camera projection contract
   * to project a diamond shape onto the ground plane. NOT a screen-space circle.
   */
  private drawPlacementMarker(tx: number, ty: number, valid: boolean): void {
    if (!this.placementMarker) return;

    this.placementMarker.clear();
    this.placementMarker.setVisible(true);

    // EXPERIMENT-OPUS-B1B2-01 / B1: Diamond centered on (tx, ty) tile center,
    // aligned with the same baseline used by spawn/terrain/selection.
    const topCorner = projectGroundPoint(tx - 0.5, ty - 0.5, this._offset);
    const rightCorner = projectGroundPoint(tx + 0.5, ty - 0.5, this._offset);
    const bottomCorner = projectGroundPoint(tx + 0.5, ty + 0.5, this._offset);
    const leftCorner = projectGroundPoint(tx - 0.5, ty + 0.5, this._offset);

    // Draw the projected diamond outline
    const color = valid ? 0x64c8ff : 0xff5050; // cyan for valid, red for invalid
    const alpha = 0.6;

    this.placementMarker.lineStyle(2, color, alpha);
    this.placementMarker.beginPath();
    this.placementMarker.moveTo(topCorner.x, topCorner.y);
    this.placementMarker.lineTo(rightCorner.x, rightCorner.y);
    this.placementMarker.lineTo(bottomCorner.x, bottomCorner.y);
    this.placementMarker.lineTo(leftCorner.x, leftCorner.y);
    this.placementMarker.closePath();
    this.placementMarker.strokePath();

    // Fill with semi-transparent color
    this.placementMarker.fillStyle(color, 0.12);
    this.placementMarker.fillPath();

    // EXPERIMENT-OPUS-B1B2-01 / B1: Crosshair at tile center (tx, ty)
    const center = projectGroundPoint(tx, ty, this._offset);
    this.placementMarker.lineStyle(1, color, alpha * 0.7);
    this.placementMarker.beginPath();
    this.placementMarker.moveTo(center.x - 6, center.y);
    this.placementMarker.lineTo(center.x + 6, center.y);
    this.placementMarker.moveTo(center.x, center.y - 4);
    this.placementMarker.lineTo(center.x, center.y + 4);
    this.placementMarker.strokePath();
  }

  /**
   * Get the continuous fire aim target for a vehicle.
   *
   * ARENA-03H+ fixup: In Arena mode, returns null when there is no valid target.
   * This prevents continuous fire from falling back to turret-angle direction
   * or mouse position when the target is missing/destroyed.
   *
   * In non-Arena devtools mode, always returns mouse/fallback position (never null).
   *
   * @returns Aim target coordinates, or null if Arena mode has no valid target
   */
  private getContinuousFireAimTarget(vehicle: BlockoutVehicleState): { x: number; y: number } | null {
    // For non-Arena devtools mode, fall back to mouse position (never null)
    if (!this.arenaMode) {
      return {
        x: this.blockoutVehicleInputController?.mouseWorldX ?? vehicle.worldX + this._offset.x,
        y: this.blockoutVehicleInputController?.mouseWorldY ?? vehicle.worldY + this._offset.y,
      };
    }

    // Arena mode: use target-lock
    if (vehicle.targetVehicleId) {
      const vehicles = this.gameState.blockoutVehicles;
      const target = vehicles?.find(v => v.id === vehicle.targetVehicleId);
      if (target && !target.isDestroyed) {
        const targetCenter = computeBodyWorldCenter(target, this._offset as IsoPoint);
        return { x: targetCenter.x, y: targetCenter.y };
      }
      // Target gone/destroyed — clear it and return null (stop fire)
      vehicle.targetVehicleId = null;
      return null;
    }

    // Arena mode with no target: do not fire, do not fall back to turret angle or mouse
    return null;
  }

  /** Update Arena turret aim/rest for allies and enemies using one shared pass. */
  private updateArenaTurretAiming(delta: number): void {
    if (!this.arenaMode) return;
    const vehicles = this.gameState.blockoutVehicles;
    if (!vehicles) return;

    for (const vehicle of vehicles) {
      if (vehicle.isDestroyed) continue;

      let desiredAngle = vehicle.bodyAngle;

      if (vehicle.targetVehicleId) {
        const target = vehicles.find(v => v.id === vehicle.targetVehicleId);
        if (target && !target.isDestroyed) {
          const turretMount = computeProjectedTurretMountScreen(vehicle, this._offset as IsoPoint);
          const targetCenter = computeBodyWorldCenter(target, this._offset as IsoPoint);
          desiredAngle = angleFromTo(turretMount.x, turretMount.y, targetCenter.x, targetCenter.y);
        } else {
          clearTargetAndWeaponState(vehicle);
          desiredAngle = vehicle.bodyAngle;
        }
      }

      rotateTurretToward(vehicle, desiredAngle, delta);
    }
  }

  private getSelectedArenaAlly(): BlockoutVehicleState | null {
    const selectedId = this.blockoutVehicleInputController?.selectedVehicleId;
    if (!selectedId) return null;
    const selected = this.gameState.blockoutVehicles?.find(v => v.id === selectedId);
    if (!selected || selected.team !== 'ally') return null;
    return selected;
  }

  private inspectCycleBody(direction: -1 | 1): { success: boolean; message: string } {
    const selected = this.getSelectedArenaAlly();
    if (!selected) return { success: false, message: 'Select an ally first' };
    const bodyId = cycleArenaInspectionBody(selected, direction);
    return { success: true, message: `Body: ${bodyId}` };
  }

  private inspectCycleWeapon(direction: -1 | 1): { success: boolean; message: string } {
    const selected = this.getSelectedArenaAlly();
    if (!selected) return { success: false, message: 'Select an ally first' };
    const weaponId = cycleArenaInspectionWeapon(selected, direction);
    return { success: true, message: `Weapon: ${weaponId}` };
  }

  private inspectResetPose(): { success: boolean; message: string } {
    const selected = this.getSelectedArenaAlly();
    if (!selected) return { success: false, message: 'Select an ally first' };
    resetArenaInspectionPose(selected, this.reservationMap ?? undefined);
    return { success: true, message: 'Pose reset' };
  }

  /**
   * Hide the placement marker.
   */
  private hidePlacementMarker(): void {
    if (this.placementMarker) {
      this.placementMarker.clear();
      this.placementMarker.setVisible(false);
    }
  }

  private verifyAssets(): void {
    // TERRAIN-02A: Use generated manifest keys for verification instead of
    // the legacy ASSET_KEYS (which includes deprecated terrain keys no longer
    // loaded at runtime). The generated manifest has the authoritative key set.
    const requiredKeys = Object.values(ASSET_KEYS).filter(
      // Filter out legacy terrain keys that are no longer loaded
      key => !['terrain_sand', 'terrain_sand_dark', 'terrain_sand_light'].includes(key)
    );
    for (const key of requiredKeys) {
      if (!this.textures.exists(key)) {
        console.error(`[GameScene] Missing texture: ${key}`);
      }
    }
    console.log('[GameScene] All asset textures verified.');
  }

  // TERRAIN-01: drawGridLines removed — grid overlay reinforced the
  // chessboard pattern. The method is preserved below commented out
  // for debugging purposes if needed in the future.
  //
  // private drawGridLines(offset: { x: number; y: number }): void {
  //   const graphics = this.add.graphics();
  //   graphics.setDefaultStyles({
  //     lineStyle: { width: 0.5, color: 0x4a4a6a, alpha: 0.2 },
  //   });
  //   const hw = 76 / 2;
  //   const hh = 38 / 2;
  //   for (let ty = 0; ty < this.gameState.mapHeight; ty++) {
  //     for (let tx = 0; tx < this.gameState.mapWidth; tx++) {
  //       const screenPos = tileToScreen(tx, ty);
  //       const cx = screenPos.x + offset.x;
  //       const cy = screenPos.y + offset.y;
  //       graphics.beginPath();
  //       graphics.moveTo(cx, cy - hh);
  //       graphics.lineTo(cx + hw, cy);
  //       graphics.lineTo(cx, cy + hh);
  //       graphics.lineTo(cx - hw, cy);
  //       graphics.closePath();
  //       graphics.strokePath();
  //     }
  //   }
  //   graphics.setDepth(50);
  // }

  shutdown(): void {
    // ARENA-02H+: Clean up placement mode event listeners
    if (this.arenaMode) {
      this.input.off('pointerdown', this.handlePlacementPointerdown, this);
      this.input.off('pointermove', this.handlePlacementPointermove, this);
      this.input.keyboard?.off('keydown', this.handlePlacementKeydown, this);
    }
    this.placementMarker?.destroy();
    this.placementMarker = null;

    this.inputController?.destroy();
    this.inputController = null;

    // Stage 4: RenderManager owns all renderer destruction.
    this.renderManager?.destroy();
    this.renderManager = null;

    this.devtoolsPanel?.destroy();
    this.devtoolsPanel = null;
    this.blockoutVehicleInputController?.destroy();
    this.blockoutVehicleInputController = null;
    this.arenaMenu?.destroy();
    this.arenaMenu = null;
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.playtestHud?.destroy();
    this.playtestHud = null;
    this.visualHudCore?.destroy();
    this.visualHudCore = null;
    this.cameraControls?.destroy();
    this.paused = false;
  }
}
