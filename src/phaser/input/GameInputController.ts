import Phaser from 'phaser';
import { screenToTile, tileToScreen, type IsoPoint } from '../render/isometric';
import type { GameState, BuildingType, ProducibleUnitType } from '../../state/types';
import { placeConstructionSite } from '../../state/construction';
import { findBuildSiteNearPlayerBuildings } from '../../state/buildSiteSelection';
import { startUnitProduction, cancelFactoryQueueItem } from '../../state/production';
import type { UnitSelection } from '../../state/unitSelection';
import { selectBuilder, selectHarvester, clearSelection, isUnitSelected } from '../../state/unitSelection';
import { issueManualMove } from '../../state/unitCommands';
import {
  MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR,
  MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR,
  tunerState,
  type ModularTankDirection,
} from '../../config/worldConfig';
import type { BuildRequestResult, ProductionRequestResult, CancelRequestResult } from '../ui/PlaytestHud';
import { commandRegistry, registerMvpCommands } from '../../state/commandRegistry';
import type { EntityRenderer } from '../render/EntityRenderer';
import type { FeedbackRenderer } from '../render/FeedbackRenderer';
import type { PauseMenu } from '../ui/PauseMenu';
import type { DebugOverlayRenderer } from '../render/DebugOverlayRenderer';
import type { DevtoolsPanel } from '../ui/DevtoolsPanel';

/**
 * GameInputController — extracts input handling and command dispatch from GameScene.
 *
 * ARCH-18A-LITE: Reduces GameScene coupling by moving all keyboard/pointer
 * input wiring, unit selection state, click detection, selection highlight,
 * and command methods (requestBuild, requestQueueUnit) into this controller.
 *
 * GameScene creates all subsystems and passes them as dependencies.
 * The controller does not create or import subsystem instances — it only
 * receives references and callbacks.
 *
 * Lifecycle:
 * - Created by GameScene in create() after all subsystems are initialized.
 * - update() called each frame from GameScene.update() for selection highlight.
 * - destroy() called in GameScene shutdown().
 */

// ─── Dependencies interface ────────────────────────────────────────

/** Dependencies provided by GameScene. Narrow callbacks preferred over broad system references. */
export interface GameInputDeps {
  scene: Phaser.Scene;
  offset: IsoPoint;
  /** Lazy access to current game state (avoids stale reference). */
  getGameState: () => GameState;
  /** EntityRenderer — used for modular tank debug overlay methods. */
  entityRenderer: EntityRenderer;
  /** FeedbackRenderer — used for command ok/fail indicators. */
  feedbackRenderer: FeedbackRenderer;
  /** Show status message on PlaytestHud. Narrow callback to avoid importing PlaytestHud. */
  showStatus: (message: string, success: boolean) => void;
  /** PauseMenu — used by ESC handler. */
  pauseMenu: PauseMenu;
  /** DebugOverlayRenderer — nullable, only present when devtools is active. */
  debugOverlayRenderer: DebugOverlayRenderer | null;
  /** DevtoolsPanel — nullable, only present when devtools is active. */
  devtoolsPanel: DevtoolsPanel | null;
  /** Callback to change paused state in GameScene. */
  setPaused: (paused: boolean) => void;
}

// ─── Selection highlight constants ─────────────────────────────────

/** Radius for the pulsing selection highlight circle. */
const HIGHLIGHT_RADIUS = 16;

/** Click detection threshold — pixels moved beyond this is a drag, not a click. */
const CLICK_DRAG_THRESHOLD = 4;

/** Selection radius in tile units for click-to-select. */
const SELECT_RADIUS = 0.8;

// ─── Arrow key tuning constants ────────────────────────────────────

const ARROW_STEP = 1;
const ARROW_SHIFT_STEP = 5;

// ─── GameInputController class ─────────────────────────────────────

export class GameInputController {
  private scene: Phaser.Scene;
  private offset: IsoPoint;
  private getGameState: () => GameState;
  private entityRenderer: EntityRenderer;
  private feedbackRenderer: FeedbackRenderer;
  private showStatusCb: (message: string, success: boolean) => void;
  private pauseMenu: PauseMenu;
  private devtoolsPanel: DevtoolsPanel | null;
  private setPausedCb: (paused: boolean) => void;

  // ARCH-05X: Unit selection state
  private selectedUnit: UnitSelection = null;

  /** Selection highlight graphics. */
  private selectionHighlight: Phaser.GameObjects.Graphics;

  /** Click detection state (distinguish click from drag). */
  private _clickStartX: number = 0;
  private _clickStartY: number = 0;
  private _clickButton: 'left' | 'none' = 'none';

  /** Bound handler references for proper cleanup. */
  private boundPointerdown: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerup: (pointer: Phaser.Input.Pointer) => void;
  private boundArrowHandler: (event: KeyboardEvent) => void;

  /** DOM contextmenu handler reference for proper cleanup. */
  private contextmenuHandler: ((e: Event) => void) | null = null;

  constructor(deps: GameInputDeps) {
    this.scene = deps.scene;
    this.offset = deps.offset;
    this.getGameState = deps.getGameState;
    this.entityRenderer = deps.entityRenderer;
    this.feedbackRenderer = deps.feedbackRenderer;
    this.showStatusCb = deps.showStatus;
    this.pauseMenu = deps.pauseMenu;
    this.devtoolsPanel = deps.devtoolsPanel;
    this.setPausedCb = deps.setPaused;

    // Create selection highlight graphics
    this.selectionHighlight = this.scene.add.graphics();
    this.selectionHighlight.setDepth(150);

    // Prevent browser context menu on the game canvas only
    this.contextmenuHandler = (e: Event) => e.preventDefault();
    this.scene.game.canvas.addEventListener('contextmenu', this.contextmenuHandler);

    // Bind handlers for proper cleanup on destroy
    this.boundPointerdown = this.onPointerdown.bind(this);
    this.boundPointerup = this.onPointerup.bind(this);
    this.boundArrowHandler = this.onArrowKey.bind(this);

    // HOTKEYS-01: Initialize command registry and wire MVP command callbacks
    registerMvpCommands();
    this.wireCommandCallbacks();

    // Wire all input
    this.setupPointerInput();
    this.setupKeyboardInput();
  }

  /**
   * Update selection highlight each frame.
   * Called from GameScene.update().
   */
  update(): void {
    this.updateSelectionHighlight();
  }

  // ─── Command registry wiring (HOTKEYS-01) ────────────────────────

  /**
   * Wire execute callbacks for MVP commands in the registry.
   *
   * Called once during construction, after registerMvpCommands().
   * The registry stores definitions (pure data); this method connects
   * them to actual gameplay actions.
   */
  private wireCommandCallbacks(): void {
    const buildSeparator = commandRegistry.get('build-separator');
    if (buildSeparator) {
      buildSeparator.execute = () => {
        const result = this.requestBuild('separator');
        this.showStatusCb(result.message, result.success);
      };
    }

    const buildFactory = commandRegistry.get('build-units-factory');
    if (buildFactory) {
      buildFactory.execute = () => {
        const result = this.requestBuild('units-factory');
        this.showStatusCb(result.message, result.success);
      };
    }

    const buildPowerPlant = commandRegistry.get('build-power-plant');
    if (buildPowerPlant) {
      buildPowerPlant.execute = () => {
        const result = this.requestBuild('power-plant');
        this.showStatusCb(result.message, result.success);
      };
    }

    const produceBuilder = commandRegistry.get('produce-builder');
    if (produceBuilder) {
      produceBuilder.execute = () => {
        const result = this.requestQueueUnit('builder');
        this.showStatusCb(result.message, result.success);
      };
    }

    const produceHarvester = commandRegistry.get('produce-harvester');
    if (produceHarvester) {
      produceHarvester.execute = () => {
        const result = this.requestQueueUnit('harvester');
        this.showStatusCb(result.message, result.success);
      };
    }
  }

  // ─── Command methods (shared by hotkeys and HUD buttons) ────────

  /**
   * Request a building construction site.
   *
   * Checks for idle builder, finds a valid build site, and places
   * the construction site. Returns a result for status feedback.
   *
   * Called by both hotkeys (B, F, P) and PlaytestHud build buttons.
   */
  requestBuild(buildingType: BuildingType): BuildRequestResult {
    const gameState = this.getGameState();

    // ARCH-13F1: Guard — do not create a site if no idle builder is available.
    const hasIdleBuilder = gameState.mapData.builders.some(b => b.phase === 'idle' && !b.busy);
    if (!hasIdleBuilder) {
      return { success: false, message: 'no idle builder' };
    }

    // ARCH-13E4: Automatic build-site selection.
    const site = findBuildSiteNearPlayerBuildings(gameState, buildingType);
    if (!site.ok) {
      return { success: false, message: `no valid build site` };
    }

    const result = placeConstructionSite(gameState, buildingType, site.tx, site.ty);
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
  requestQueueUnit(unitType: ProducibleUnitType): ProductionRequestResult {
    const gameState = this.getGameState();

    const factory = gameState.production.factories[0];
    if (!factory) {
      return { success: false, message: 'no completed units-factory' };
    }

    const result = startUnitProduction(gameState, factory.tx, factory.ty, unitType);
    if (result.ok) {
      console.log(`[GameScene] ${unitType} queued at factory (${factory.tx},${factory.ty})`);
      return { success: true, message: `${unitType} queued` };
    } else {
      console.info(`[GameScene] ${unitType} queue failed: ${result.reason}`);
      return { success: false, message: result.reason };
    }
  }

  /**
   * Request cancellation of a queue item at the specified factory.
   *
   * FIX-04: Called by PlaytestHud cancel buttons via window.__fe_cancel.
   * No resource refund on cancel.
   */
  requestCancelQueueItem(factoryIndex: number, queueIndex: number): CancelRequestResult {
    const gameState = this.getGameState();

    const factory = gameState.production.factories[factoryIndex];
    if (!factory) {
      return { success: false, message: 'factory not found' };
    }

    const result = cancelFactoryQueueItem(gameState, factory.tx, factory.ty, queueIndex);
    if (result.ok) {
      console.log(`[GameScene] Queue item ${queueIndex} cancelled at factory ${factoryIndex}`);
      return { success: true, message: 'cancelled' };
    } else {
      console.info(`[GameScene] Cancel failed: ${result.reason}`);
      return { success: false, message: result.reason };
    }
  }

  // ─── Pointer input ─────────────────────────────────────────────

  private setupPointerInput(): void {
    // LMB pointerdown: record click start position
    this.scene.input.on('pointerdown', this.boundPointerdown);

    // LMB pointerup: if click (not drag), select unit or issue move
    this.scene.input.on('pointerup', this.boundPointerup);
  }

  private onPointerdown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown()) return;

    this._clickStartX = pointer.x;
    this._clickStartY = pointer.y;
    this._clickButton = 'left';
  }

  private onPointerup(pointer: Phaser.Input.Pointer): void {
    if (this._clickButton !== 'left') return;
    this._clickButton = 'none';

    const dx = pointer.x - this._clickStartX;
    const dy = pointer.y - this._clickStartY;
    const moved = Math.sqrt(dx * dx + dy * dy);
    if (moved > CLICK_DRAG_THRESHOLD) return; // was a drag, not a click

    this.handleLeftClick(pointer);
  }

  // ─── Keyboard input ────────────────────────────────────────────

  private setupKeyboardInput(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;

    // ── Debug overlay toggle (T) + tuner controls ────────────
    kb.on('keydown-T', () => {
      const visible = this.entityRenderer.toggleModularTankDebug();
      if (visible !== undefined) {
        console.log(`[GameScene] Modular tank debug overlay: ${visible ? 'ON' : 'OFF'}`);
      }
    });

    // H — select hull layer for tuning (only when overlay is ON)
    kb.on('keydown-H', () => {
      if (!this.entityRenderer.isDebugOverlayVisible()) return;
      tunerState.selectedLayer = 'hull';
      this.entityRenderer.updateModularTankVisuals();
      console.log('[Tuner] Selected layer: hull');
    });

    // J — select turret layer for tuning (only when overlay is ON)
    kb.on('keydown-J', () => {
      if (!this.entityRenderer.isDebugOverlayVisible()) return;
      tunerState.selectedLayer = 'turret';
      this.entityRenderer.updateModularTankVisuals();
      console.log('[Tuner] Selected layer: turret');
    });

    // C — print mutable runtime offset tables to console (only when overlay is ON)
    kb.on('keydown-C', () => {
      if (!this.entityRenderer.isDebugOverlayVisible()) return;
      this.entityRenderer.printOffsetTables();
    });

    // Arrow keys — adjust selected offset for current bodyDir entry (only when overlay is ON)
    kb.on('keydown', this.boundArrowHandler as (event: KeyboardEvent) => void);

    // Q — previous body direction (only when overlay is ON)
    kb.on('keydown-Q', () => {
      if (!this.entityRenderer.isDebugOverlayVisible()) return;
      const next = ((tunerState.bodyDir - 1) + 8) % 8 as ModularTankDirection;
      this.entityRenderer.setModularTankBodyDir(next);
      console.log(`[Tuner] bodyDir: ${next}`);
    });

    // E — next body direction (only when overlay is ON)
    kb.on('keydown-E', () => {
      if (!this.entityRenderer.isDebugOverlayVisible()) return;
      const next = ((tunerState.bodyDir + 1) % 8) as ModularTankDirection;
      this.entityRenderer.setModularTankBodyDir(next);
      console.log(`[Tuner] bodyDir: ${next}`);
    });

    // Z — previous turret direction (only when overlay is ON)
    kb.on('keydown-Z', () => {
      if (!this.entityRenderer.isDebugOverlayVisible()) return;
      const next = ((tunerState.turretDir - 1) + 8) % 8 as ModularTankDirection;
      this.entityRenderer.setModularTankTurretDir(next);
      console.log(`[Tuner] turretDir: ${next}`);
    });

    // X — next turret direction (only when overlay is ON)
    kb.on('keydown-X', () => {
      if (!this.entityRenderer.isDebugOverlayVisible()) return;
      const next = ((tunerState.turretDir + 1) % 8) as ModularTankDirection;
      this.entityRenderer.setModularTankTurretDir(next);
      console.log(`[Tuner] turretDir: ${next}`);
    });

    // ── Build & Production hotkeys (HOTKEYS-01: dispatched via command registry) ──
    // Register keyboard listeners for each build/produce command.
    // The registry is the source-of-truth for key bindings.
    const buildCommands = commandRegistry.findByCategory('build');
    for (const cmd of buildCommands) {
      kb.on(`keydown-${cmd.key}`, () => {
        commandRegistry.execute(cmd.id);
      });
    }

    const produceCommands = commandRegistry.findByCategory('produce');
    for (const cmd of produceCommands) {
      kb.on(`keydown-${cmd.key}`, () => {
        commandRegistry.execute(cmd.id);
      });
    }

    // ── Devtools toggle (F10 / backtick) ─────────────────────
    kb.on('keydown-F10', () => {
      if (this.devtoolsPanel) {
        this.devtoolsPanel.toggle();
      }
    });
    kb.on('keydown-BACKTICK', () => {
      if (this.devtoolsPanel) {
        this.devtoolsPanel.toggle();
      }
    });

    // ── ESC: toggle pause menu ───────────────────────────────
    kb.on('keydown-ESC', () => {
      if (this.pauseMenu.visible) {
        // Menu is open → close it (resume)
        this.pauseMenu.hide();
        this.setPausedCb(false);
      } else {
        // Menu is closed → open it (pause)
        this.selectedUnit = clearSelection();
        this.pauseMenu.show();
        this.setPausedCb(true);
      }
    });
  }

  private onArrowKey(event: KeyboardEvent): void {
    if (!this.entityRenderer.isDebugOverlayVisible()) return;
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

    this.entityRenderer.updateModularTankVisuals();
  }

  // ─── Selection + move input (LMB only) ──────────────────────────

  /**
   * Handle left-click:
   * - If a unit is under cursor → select it
   * - If no unit under cursor AND a unit is selected → issue move command
   * - If no unit under cursor AND nothing selected → do nothing
   */
  private handleLeftClick(pointer: Phaser.Input.Pointer): void {
    const gameState = this.getGameState();
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tilePos = screenToTile(worldPoint.x - this.offset.x, worldPoint.y - this.offset.y);
    const clickTx = tilePos.x;
    const clickTy = tilePos.y;

    // Check if there's a unit under the cursor
    let bestDist = SELECT_RADIUS;
    let bestSelection: UnitSelection = null;

    for (const b of gameState.mapData.builders) {
      const dx = b.ftx - clickTx;
      const dy = b.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestSelection = selectBuilder(b.id);
      }
    }

    for (const h of gameState.harvesters) {
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
        ? `Builder ${bestSelection.id}`
        : `Harvester ${(bestSelection as { kind: 'harvester'; id: string }).id}`;
      this.showStatusCb(`Selected: ${label}`, true);
      return;
    }

    // No unit under cursor — if a unit is selected, issue move command
    if (isUnitSelected(this.selectedUnit)) {
      const targetTx = Math.round(clickTx);
      const targetTy = Math.round(clickTy);

      const result = issueManualMove(gameState, this.selectedUnit, targetTx, targetTy);
      if (result.ok) {
        const label = this.selectedUnit!.kind === 'builder' ? 'Builder' : 'Harvester';
        this.showStatusCb(`${label} → (${targetTx},${targetTy})`, true);
        // ARCH-13A: Green command indicator on accepted move
        this.feedbackRenderer.addCommandOk(targetTx, targetTy, this.scene.time.now);
      } else {
        this.showStatusCb(`Move failed: ${result.reason}`, false);
        // ARCH-13A: Red command indicator on failed move
        this.feedbackRenderer.addCommandFail(targetTx, targetTy, this.scene.time.now);
      }
    }
  }

  // ─── Selection highlight ───────────────────────────────────────

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

    const gameState = this.getGameState();
    let ringX: number;
    let ringY: number; // tile ground position from state

    if (this.selectedUnit!.kind === 'builder') {
      const sel = this.selectedUnit as { kind: 'builder'; id: string };
      const builder = gameState.mapData.builders.find(b => b.id === sel.id);
      if (!builder) return;
      const screenPos = tileToScreen(builder.ftx, builder.fty);
      ringX = screenPos.x + this.offset.x;
      ringY = screenPos.y + this.offset.y;
    } else if (this.selectedUnit!.kind === 'harvester') {
      const sel = this.selectedUnit as { kind: 'harvester'; id: string };
      const harvester = gameState.harvesters.find(h => h.id === sel.id);
      if (!harvester) return;
      const screenPos = tileToScreen(harvester.ftx, harvester.fty);
      ringX = screenPos.x + this.offset.x;
      ringY = screenPos.y + this.offset.y;
    } else {
      return;
    }

    // Draw a pulsing cyan circle at the tile ground position.
    const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 1000) / 1000 * Math.PI * 2);
    const alpha = 0.4 + 0.4 * pulse;

    this.selectionHighlight.lineStyle(2, 0x00ffff, alpha);
    this.selectionHighlight.strokeCircle(ringX, ringY, HIGHLIGHT_RADIUS);
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  destroy(): void {
    // Remove pointer handlers
    this.scene.input.off('pointerdown', this.boundPointerdown);
    this.scene.input.off('pointerup', this.boundPointerup);

    // Remove DOM contextmenu handler
    if (this.contextmenuHandler) {
      this.scene.game.canvas.removeEventListener('contextmenu', this.contextmenuHandler);
      this.contextmenuHandler = null;
    }

    // Destroy selection highlight graphics
    this.selectionHighlight.destroy();

    // Note: Keyboard handlers are cleaned up by Phaser scene shutdown.
    // The scene's KeyboardPlugin is destroyed automatically, removing all
    // registered key listeners.
  }
}
