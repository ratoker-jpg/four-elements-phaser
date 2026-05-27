import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets/assetManifest';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EntityRenderer } from './render/EntityRenderer';
import { BuildingStatusRenderer } from './render/BuildingStatusRenderer';
import { CameraControls } from './input/CameraControls';
import { PlaytestHud } from './ui/PlaytestHud';
import type { BuildRequestResult, ProductionRequestResult } from './ui/PlaytestHud';
import { tileToScreen, screenToTile, mapOriginOffset } from './render/isometric';
import { createInitialState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';
import { placeConstructionSite, updateConstructionSiteProgress, BUILDING_CONFIG } from '../state/construction';
import { findBuildSiteNearPlayerBuildings } from '../state/buildSiteSelection';
import { assignIdleBuilders, updateBuilders } from '../state/builder';
import { startUnitProduction } from '../state/production';
import type { GameState, HarvesterPhase, BuildingType, ProducibleUnitType } from '../state/types';
import { ELEMENT_UNITS_PER_ELEMENT } from '../state/types';
import {
  MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR,
  MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR,
  tunerState,
  type ModularTankDirection,
} from '../config/worldConfig';
import type { UnitSelection } from '../state/unitSelection';
import { selectBuilder, selectHarvester, clearSelection, isUnitSelected } from '../state/unitSelection';
import { issueManualMove } from '../state/unitCommands';
import { validateMap } from '../state/mapValidation';
import { PauseMenu } from './ui/PauseMenu';
import type { GameSetupConfig } from '../state/gameSetup';
import { DEFAULT_SETUP, getMapDataById } from '../state/gameSetup';

/**
 * GameScene — orchestration-only scene.
 *
 * PR3: Drives the harvester civil loop via updateGameState().
 * GameScene calls state update + renderer sync + HUD update only.
 * No game logic lives here.
 *
 * PR7: Q/E cycles bodyDir, Z/X cycles turretDir.
 * Arrow tuning targets current bodyDir entry in the offset tables.
 *
 * ARCH-14A: PlaytestHud provides clickable build/production buttons
 * that call the same command paths as the debug hotkeys.
 */

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
  private playtestHud: PlaytestHud | null = null;
  private pauseMenu: PauseMenu | null = null;
  private gameState!: GameState;
  private hqWorldX: number = 0;
  private hqWorldY: number = 0;

  // ARCH-14B: Setup config stored for restart functionality
  private setupConfig: GameSetupConfig = DEFAULT_SETUP;

  // ARCH-14B: Pause state — when true, update loop is skipped
  private paused = false;

  // ARCH-05X: Unit selection state
  private selectedUnit: UnitSelection = null;

  /** Selection highlight graphics. */
  private selectionHighlight!: Phaser.GameObjects.Graphics;

  /** Click detection state (distinguish click from drag). */
  private _clickStartX: number = 0;
  private _clickStartY: number = 0;
  private _clickButton: 'left' | 'none' = 'none';

  /** Offset for tile-to-screen conversion (stored for click handlers). */
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
   * Receive scene data from MainMenu/NewGameSetup.
   * Called by Phaser before create().
   */
  init(data: GameSetupConfig): void {
    this.setupConfig = { ...DEFAULT_SETUP, ...data };
  }

  create(): void {
    // Initialize game state from setup config (faction + map)
    const mapData = getMapDataById(this.setupConfig.mapId);
    this.gameState = createInitialState(mapData, this.setupConfig.faction);

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

    // ── Debug overlay toggle (T) + tuner controls ────────────
    this.input.keyboard?.on('keydown-T', () => {
      const visible = this.entityRenderer?.toggleModularTankDebug();
      if (visible !== undefined) {
        console.log(`[GameScene] Modular tank debug overlay: ${visible ? 'ON' : 'OFF'}`);
      }
    });

    // H — select hull layer for tuning (only when overlay is ON)
    this.input.keyboard?.on('keydown-H', () => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      tunerState.selectedLayer = 'hull';
      this.entityRenderer?.updateModularTankVisuals();
      console.log('[Tuner] Selected layer: hull');
    });

    // J — select turret layer for tuning (only when overlay is ON)
    this.input.keyboard?.on('keydown-J', () => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      tunerState.selectedLayer = 'turret';
      this.entityRenderer?.updateModularTankVisuals();
      console.log('[Tuner] Selected layer: turret');
    });

    // C — print mutable runtime offset tables to console (only when overlay is ON)
    this.input.keyboard?.on('keydown-C', () => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      this.entityRenderer?.printOffsetTables();
    });

    // Arrow keys — adjust selected offset for current bodyDir entry (only when overlay is ON)
    const ARROW_STEP = 1;
    const ARROW_SHIFT_STEP = 5;
    const arrowHandler = (event: KeyboardEvent) => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      event.preventDefault();

      const step = event.shiftKey ? ARROW_SHIFT_STEP : ARROW_STEP;
      // Arrow tuning targets the current bodyDir entry in the offset tables
      const bodyDir = tunerState.bodyDir;
      const offset = tunerState.selectedLayer === 'hull'
        ? MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR[bodyDir]
        : MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR[bodyDir];

      switch (event.code) {
        case 'ArrowLeft':  offset.x -= step; break;
        case 'ArrowRight': offset.x += step; break;
        case 'ArrowUp':    offset.y -= step; break;
        case 'ArrowDown':  offset.y += step; break;
        default: return; // not an arrow key, ignore
      }

      this.entityRenderer?.updateModularTankVisuals();
    };

    this.input.keyboard?.on('keydown', arrowHandler as (event: KeyboardEvent) => void);

    // Q — previous body direction (only when overlay is ON)
    this.input.keyboard?.on('keydown-Q', () => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      const next = ((tunerState.bodyDir - 1) + 8) % 8 as ModularTankDirection;
      this.entityRenderer!.setModularTankBodyDir(next);
      console.log(`[Tuner] bodyDir: ${next}`);
    });

    // E — next body direction (only when overlay is ON)
    this.input.keyboard?.on('keydown-E', () => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      const next = ((tunerState.bodyDir + 1) % 8) as ModularTankDirection;
      this.entityRenderer!.setModularTankBodyDir(next);
      console.log(`[Tuner] bodyDir: ${next}`);
    });

    // Z — previous turret direction (only when overlay is ON)
    this.input.keyboard?.on('keydown-Z', () => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      const next = ((tunerState.turretDir - 1) + 8) % 8 as ModularTankDirection;
      this.entityRenderer!.setModularTankTurretDir(next);
      console.log(`[Tuner] turretDir: ${next}`);
    });

    // X — next turret direction (only when overlay is ON)
    this.input.keyboard?.on('keydown-X', () => {
      if (!this.entityRenderer?.isDebugOverlayVisible()) return;
      const next = ((tunerState.turretDir + 1) % 8) as ModularTankDirection;
      this.entityRenderer!.setModularTankTurretDir(next);
      console.log(`[Tuner] turretDir: ${next}`);
    });

    // ── Build hotkeys — now delegate to extracted command methods ──
    this.input.keyboard?.on('keydown-B', () => {
      const result = this.requestBuild('separator');
      this.playtestHud?.showStatus(result.message, result.success);
    });

    this.input.keyboard?.on('keydown-F', () => {
      const result = this.requestBuild('units-factory');
      this.playtestHud?.showStatus(result.message, result.success);
    });

    this.input.keyboard?.on('keydown-P', () => {
      const result = this.requestBuild('power-plant');
      this.playtestHud?.showStatus(result.message, result.success);
    });

    // ── Production hotkeys — now delegate to extracted command methods ──
    this.input.keyboard?.on('keydown-N', () => {
      const result = this.requestQueueUnit('builder');
      this.playtestHud?.showStatus(result.message, result.success);
    });

    this.input.keyboard?.on('keydown-G', () => {
      const result = this.requestQueueUnit('harvester');
      this.playtestHud?.showStatus(result.message, result.success);
    });

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
    this.playtestHud = new PlaytestHud();
    this.playtestHud.create(
      (buildingType: BuildingType) => this.requestBuild(buildingType),
      (unitType: ProducibleUnitType) => this.requestQueueUnit(unitType),
    );

    // ARCH-14B: Create pause menu with callbacks
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
      },
      this.setupConfig,
    );

    // Set world background color
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // ── ARCH-05X: Unit selection + move input (LMB) ────────────────

    // Selection highlight graphics (drawn each frame under selected unit)
    this.selectionHighlight = this.add.graphics();
    this.selectionHighlight.setDepth(150);

    // Prevent browser context menu on the game canvas only
    this.game.canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());

    // LMB pointerdown: record click start position
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;

      this._clickStartX = pointer.x;
      this._clickStartY = pointer.y;
      this._clickButton = 'left';
    });

    // LMB pointerup: if click (not drag), select unit or issue move
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this._clickButton !== 'left') return;
      this._clickButton = 'none';

      const dx = pointer.x - (this._clickStartX ?? 0);
      const dy = pointer.y - (this._clickStartY ?? 0);
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (moved > 4) return; // was a drag, not a click

      this.handleLeftClick(pointer);
    });

    // ESC: toggle pause menu (ARCH-14B)
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.pauseMenu?.visible) {
        // Menu is open → close it (resume)
        this.pauseMenu.hide();
        this.paused = false;
      } else {
        // Menu is closed → open it (pause)
        this.selectedUnit = clearSelection();
        this.pauseMenu?.show();
        this.paused = true;
      }
    });

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

    // 8. Update selection highlight
    this.updateSelectionHighlight();

    // 9. Debug log on unload completion
    if (this.gameState.economy.raw > this.lastLoggedRaw) {
      console.log(
        `[GameScene] Unloaded! Raw: ${this.gameState.economy.raw}`,
      );
      this.lastLoggedRaw = this.gameState.economy.raw;
    }
  }

  // ─── ARCH-05X: Selection + move input (LMB only) ──────────────────

  /**
   * Handle left-click:
   * - If a unit is under cursor → select it
   * - If no unit under cursor AND a unit is selected → issue move command
   * - If no unit under cursor AND nothing selected → do nothing
   */
  private handleLeftClick(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tilePos = screenToTile(worldPoint.x - this._offset.x, worldPoint.y - this._offset.y);
    const clickTx = tilePos.x;
    const clickTy = tilePos.y;

    // Selection radius in tile units
    const SELECT_RADIUS = 0.8;

    // Check if there's a unit under the cursor
    let bestDist = SELECT_RADIUS;
    let bestSelection: UnitSelection = null;

    for (let i = 0; i < this.gameState.mapData.builders.length; i++) {
      const b = this.gameState.mapData.builders[i];
      const dx = b.ftx - clickTx;
      const dy = b.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestSelection = selectBuilder(i);
      }
    }

    for (const h of this.gameState.harvesters) {
      const dx = h.ftx - clickTx;
      const dy = h.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestSelection = selectHarvester(h.id);
      }
    }

    if (bestSelection) {
      // Unit under cursor → select it
      this.selectedUnit = bestSelection;
      const label = bestSelection.kind === 'builder'
        ? `Builder #${bestSelection.index}`
        : `Harvester ${(bestSelection as { kind: 'harvester'; id: string }).id}`;
      this.playtestHud?.showStatus(`Selected: ${label}`, true);
      return;
    }

    // No unit under cursor — if a unit is selected, issue move command
    if (isUnitSelected(this.selectedUnit)) {
      const targetTx = Math.round(clickTx);
      const targetTy = Math.round(clickTy);

      const result = issueManualMove(this.gameState, this.selectedUnit, targetTx, targetTy);
      if (result.ok) {
        const label = this.selectedUnit!.kind === 'builder' ? 'Builder' : 'Harvester';
        this.playtestHud?.showStatus(`${label} → (${targetTx},${targetTy})`, true);
      } else {
        this.playtestHud?.showStatus(`Move failed: ${result.reason}`, false);
      }
    }
  }

  /**
   * Draw selection highlight around the selected unit.
   *
   * ARCH-05Y: Ring position is derived from the unit's state tile
   * coordinates (ftx/fty) via tileToScreen, which is the same transform
   * used to place the sprite. This anchors the ring to the tile ground
   * (isometric diamond center) rather than to the sprite's art-dependent
   * origin or PNG frame layout.
   */
  private updateSelectionHighlight(): void {
    this.selectionHighlight.clear();

    if (!isUnitSelected(this.selectedUnit)) return;

    let ringX: number;
    let ringY: number; // tile ground position from state

    if (this.selectedUnit!.kind === 'builder') {
      const idx = this.selectedUnit!.index;
      const builder = this.gameState.mapData.builders[idx];
      if (!builder) return;
      const screenPos = tileToScreen(builder.ftx, builder.fty);
      ringX = screenPos.x + this._offset.x;
      ringY = screenPos.y + this._offset.y;
    } else if (this.selectedUnit!.kind === 'harvester') {
      const sel = this.selectedUnit as { kind: 'harvester'; id: string };
      const harvester = this.gameState.harvesters.find(h => h.id === sel.id);
      if (!harvester) return;
      const screenPos = tileToScreen(harvester.ftx, harvester.fty);
      ringX = screenPos.x + this._offset.x;
      ringY = screenPos.y + this._offset.y;
    } else {
      return;
    }

    // Draw a pulsing cyan circle at the tile ground position.
    // Ring radius matches half the tile height (~19px) for readability.
    const HIGHLIGHT_RADIUS = 16;

    const pulse = 0.5 + 0.5 * Math.sin((this.time.now % 1000) / 1000 * Math.PI * 2);
    const alpha = 0.4 + 0.4 * pulse;

    this.selectionHighlight.lineStyle(2, 0x00ffff, alpha);
    this.selectionHighlight.strokeCircle(ringX, ringY, HIGHLIGHT_RADIUS);
  }

  // ─── Command methods (shared by hotkeys and HUD buttons) ────────

  /**
   * Request a building construction site.
   *
   * Checks for idle builder, finds a valid build site, and places
   * the construction site. Returns a result for status feedback.
   *
   * Called by both hotkeys (B, F) and PlaytestHud build buttons.
   */
  private requestBuild(buildingType: BuildingType): BuildRequestResult {
    // ARCH-13F1: Guard — do not create a site if no idle builder is available.
    const hasIdleBuilder = this.gameState.mapData.builders.some(b => b.phase === 'idle' && !b.busy);
    if (!hasIdleBuilder) {
      return { success: false, message: 'no idle builder' };
    }

    // ARCH-13E4: Automatic build-site selection.
    const site = findBuildSiteNearPlayerBuildings(this.gameState, buildingType);
    if (!site.ok) {
      return { success: false, message: `no valid build site` };
    }

    const result = placeConstructionSite(this.gameState, buildingType, site.tx, site.ty);
    if (result.ok) {
      console.log(`[GameScene] Construction site placed: ${result.siteId} at (${site.tx},${site.ty})`);
      return { success: true, message: `${buildingType} site placed` };
    } else {
      console.warn(`[GameScene] Placement failed at (${site.tx},${site.ty}): ${result.reason}`);
      return { success: false, message: `placement failed: ${result.reason}` };
    }
  }

  /**
   * Request production of a unit at the oldest completed factory.
   *
   * Called by both hotkeys (N, G) and PlaytestHud production buttons.
   */
  private requestQueueUnit(unitType: ProducibleUnitType): ProductionRequestResult {
    const factory = this.gameState.production.factories[0];
    if (!factory) {
      return { success: false, message: 'no completed units-factory' };
    }

    const result = startUnitProduction(this.gameState, factory.tx, factory.ty, unitType);
    if (result.ok) {
      console.log(`[GameScene] ${unitType} queued at factory (${factory.tx},${factory.ty})`);
      return { success: true, message: `${unitType} queued` };
    } else {
      this.logDevHotkeyInfo(`[GameScene] ${unitType} queue failed: ${result.reason}`);
      return { success: false, message: result.reason };
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
        const label = PHASE_LABEL[h.phase];
        phaseCounts[label] = (phaseCounts[label] || 0) + 1;
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
        `Raw: ${s.economy.raw}/${s.economy.rawCap} | Matter: ${s.economy.matter}/${s.economy.matterCap} | ${factionLabel}: ${factionElementDisplayed}/${elementCapDisplayed} | Power: ${s.economy.powerConsumed}/${s.economy.powerGenerated} | Resources: ${activeResources}/${totalResources} | ` +
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

  /** Log expected dev-hotkey state at info level to reduce console noise. */
  private logDevHotkeyInfo(message: string): void {
    console.info(message);
  }

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
