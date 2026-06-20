import Phaser from 'phaser';
import { screenToTile, tileToScreen, type IsoPoint } from '../render/isometric';
import type { GameState, BuildingType, ProducibleUnitType } from '../../state/types';
import { placeConstructionSite } from '../../state/construction';
import { findBuildSiteNearPlayerBuildings } from '../../state/buildSiteSelection';
import { isVisualReadyBuilding } from '../../config/buildingRuntimeMapping';
import { startUnitProduction, cancelFactoryQueueItem } from '../../state/production';
import type { UnitSelection } from '../../state/unitSelection';
import { clearSelection, isUnitSelected, isHarvesterSelected } from '../../state/unitSelection';
import { issueManualMove, stopUnitCommand } from '../../state/unitCommands';
// Stage 3 retirement: ModularTankDirection import removed from worldConfig.
// It was only used by the legacy tuner hotkeys (Q/E/Z/X), which are gone.
import type { BuildRequestResult, ProductionRequestResult, CancelRequestResult } from '../ui/PlaytestHud';
import { commandRegistry, registerMvpCommands } from '../../state/commandRegistry';
import { isScreenPointInHud } from '../ui/hud/hudLayout';
import type { EntityRenderer } from '../render/EntityRenderer';
import type { FeedbackRenderer } from '../render/FeedbackRenderer';
import type { PauseMenu } from '../ui/PauseMenu';
import type { DebugOverlayRenderer } from '../render/DebugOverlayRenderer';
import type { DevtoolsPanel } from '../ui/DevtoolsPanel';
import type { AssetPreviewTool } from '../dev/AssetPreviewTool';
import type { AssetPreviewPanel } from '../dev/AssetPreviewPanel';
import {
  routeLmbClick,
  routeRmbClick,
  routeSKey,
  routeEscKey,
  determineCursorFeedback,
  type ClickTarget,
  type CursorFeedbackState,
} from '../../state/commandRouter';

/**
 * GameInputController — extracts input handling and command dispatch from GameScene.
 *
 * ARCH-18A-LITE: Reduces GameScene coupling by moving all keyboard/pointer
 * input wiring, unit selection state, click detection, selection highlight,
 * and command methods (requestBuild, requestQueueUnit) into this controller.
 *
 * CORE-STEP-05H+: Unified RTS Controls and Command Routing.
 * - LMB = select / inspect only (NEVER move/attack/harvest)
 * - RMB = command (move/harvest/attack based on target + selection)
 * - S = stop selected unit / clear command
 * - Esc = context priority: cancel mode → deselect → close overlay → pause
 * - Cursor feedback for command targets
 *
 * GameScene creates all subsystems and passes them as dependencies.
 * The controller does not create or import subsystem instances — it only
 * receives references and callbacks.
 *
 * Lifecycle:
 * - Created by GameScene in create() after all subsystems are initialized.
 * - update() called each frame from GameScene.update() for selection highlight
 *   and cursor feedback.
 * - destroy() called in GameScene shutdown.
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
  /** AssetPreviewTool — nullable, only present when devtools is active. DEV-ASSET-PREVIEW-01. */
  assetPreviewTool: AssetPreviewTool | null;
  /** AssetPreviewPanel — nullable, only present when devtools is active. DEV-ASSET-PREVIEW-01. */
  assetPreviewPanel: AssetPreviewPanel | null;
  /** Callback to change paused state in GameScene. */
  setPaused: (paused: boolean) => void;
  /** ARENA-02H+ fixup: Whether arena placement mode is active. When true,
   *  ESC does not toggle the pause menu (ESC is owned by placement cancel). */
  isPlacementActive?: () => boolean;
  /** CORE-STEP-05H+: Whether Arena mode is active. Affects cursor feedback. */
  isArenaMode?: () => boolean;
  /** CORE-STEP-05H+: CameraControls reference for wiring arrow key debug overlay predicate. */
  cameraControls?: { isDebugOverlayActive: () => boolean };
}

// ─── Selection highlight constants ─────────────────────────────────

/** Radius for the pulsing selection highlight circle. */
const HIGHLIGHT_RADIUS = 16;

/** Click detection threshold — pixels moved beyond this is a drag, not a click. */
const CLICK_DRAG_THRESHOLD = 4;

/** Selection radius in tile units for click-to-select. */
const SELECT_RADIUS = 0.8;

// ─── Stage 3 retirement ───────────────────────────────────────────
// ARROW_STEP / ARROW_SHIFT_STEP constants removed: they were used only
// by the legacy offset-table tuner hotkeys, which are no longer wired.

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
  private assetPreviewTool: AssetPreviewTool | null;
  private assetPreviewPanel: AssetPreviewPanel | null;
  private setPausedCb: (paused: boolean) => void;
  private isPlacementActive: () => boolean;
  private isArenaMode: () => boolean;

  // ARCH-05X: Unit selection state
  private selectedUnit: UnitSelection = null;

  /** Selection highlight graphics. */
  private selectionHighlight: Phaser.GameObjects.Graphics;

  /** Click detection state (distinguish click from drag). */
  private _clickStartX: number = 0;
  private _clickStartY: number = 0;
  private _clickButton: 'left' | 'right' | 'none' = 'none';

  /** RMB click detection state. */
  private _rmbClickStartX: number = 0;
  private _rmbClickStartY: number = 0;

  /** CORE-STEP-05H+: Current cursor feedback state. */
  private _cursorState: CursorFeedbackState = 'default';

  /** Bound handler references for proper cleanup. */
  private boundPointerdown: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerup: (pointer: Phaser.Input.Pointer) => void;
  private boundPointermove: (pointer: Phaser.Input.Pointer) => void;

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
    this.assetPreviewTool = deps.assetPreviewTool;
    this.assetPreviewPanel = deps.assetPreviewPanel;
    this.setPausedCb = deps.setPaused;
    this.isPlacementActive = deps.isPlacementActive ?? (() => false);
    this.isArenaMode = deps.isArenaMode ?? (() => false);

    // Create selection highlight graphics
    this.selectionHighlight = this.scene.add.graphics();
    this.selectionHighlight.setDepth(150);

    // Prevent browser context menu on the game canvas only
    this.contextmenuHandler = (e: Event) => e.preventDefault();
    this.scene.game.canvas.addEventListener('contextmenu', this.contextmenuHandler);

    // Bind handlers for proper cleanup on destroy
    this.boundPointerdown = this.onPointerdown.bind(this);
    this.boundPointerup = this.onPointerup.bind(this);
    this.boundPointermove = this.onPointermove.bind(this);

    // HOTKEYS-01: Initialize command registry and wire MVP command callbacks
    registerMvpCommands();
    this.wireCommandCallbacks();

    // Wire all input
    this.setupPointerInput();
    this.setupKeyboardInput();

    // CORE-STEP-05H+: Wire CameraControls debug overlay predicate so
    // arrow keys pan camera only when debug overlay is NOT active.
    if (deps.cameraControls) {
      deps.cameraControls.isDebugOverlayActive = () => this.entityRenderer.isDebugOverlayVisible();
    }
  }

  /**
   * Update selection highlight and cursor feedback each frame.
   * Called from GameScene.update().
   */
  update(): void {
    this.updateSelectionHighlight();
    this.updateCursorFeedback();
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

    const buildRawStorage = commandRegistry.get('build-raw-storage');
    if (buildRawStorage) {
      buildRawStorage.execute = () => {
        const result = this.requestBuild('raw-storage');
        this.showStatusCb(result.message, result.success);
      };
    }

    const buildMatterStorage = commandRegistry.get('build-matter-storage');
    if (buildMatterStorage) {
      buildMatterStorage.execute = () => {
        const result = this.requestBuild('matter-storage');
        this.showStatusCb(result.message, result.success);
      };
    }

    const buildElementStorage = commandRegistry.get('build-element-storage');
    if (buildElementStorage) {
      buildElementStorage.execute = () => {
        const result = this.requestBuild('element-storage');
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

    // NOTE: build-energy-plant is intentionally NOT wired because
    // energy-plant is visual-ready only — no gameplay mechanic yet.
    // Players must not accidentally build a non-functional building.

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

    // Guard: visual-ready buildings are not buildable in live gameplay.
    if (isVisualReadyBuilding(buildingType)) {
      return { success: false, message: `${buildingType} is not buildable yet` };
    }

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
    // pointerdown: record click start position for both LMB and RMB
    this.scene.input.on('pointerdown', this.boundPointerdown);

    // pointerup: process click (LMB = select, RMB = command)
    this.scene.input.on('pointerup', this.boundPointerup);

    // pointermove: update cursor feedback
    this.scene.input.on('pointermove', this.boundPointermove);
  }

  /**
   * VISUAL-HUD-CORE-01: Expose current selection for the HUD selection panel.
   */
  getSelection(): UnitSelection {
    return this.selectedUnit;
  }

  /**
   * VISUAL-HUD-CORE-01: Check whether a pointer event's screen position
   * falls inside the bottom HUD bar. Used to prevent map command routing
   * when the player clicks on HUD panels.
   */
  private isPointerInHud(pointer: Phaser.Input.Pointer): boolean {
    const canvasHeight = this.scene.game.canvas.height;
    return isScreenPointInHud(pointer.y, canvasHeight);
  }

  private onPointerdown(pointer: Phaser.Input.Pointer): void {
    // VISUAL-HUD-CORE-01: Ignore pointer events that start inside the HUD bar.
    // The HUD DOM panels consume their own clicks, but this guard prevents
    // Phaser from also processing the event as a map click/drag.
    if (this.isPointerInHud(pointer)) return;

    if (pointer.leftButtonDown()) {
      this._clickStartX = pointer.x;
      this._clickStartY = pointer.y;
      this._clickButton = 'left';
    } else if (pointer.rightButtonDown()) {
      this._rmbClickStartX = pointer.x;
      this._rmbClickStartY = pointer.y;
      this._clickButton = 'right';
    }
  }

  private onPointerup(pointer: Phaser.Input.Pointer): void {
    // VISUAL-HUD-CORE-01-FIXUP-1: Also ignore pointer-up in HUD area,
    // but clear any pending click state so it does not leak into the
    // next pointer-down/up cycle.
    if (this.isPointerInHud(pointer)) {
      this.cancelPendingClick();
      return;
    }

    const button = this._clickButton;
    this._clickButton = 'none';

    if (button === 'left') {
      const dx = pointer.x - this._clickStartX;
      const dy = pointer.y - this._clickStartY;
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (moved > CLICK_DRAG_THRESHOLD) return; // was a drag, not a click

      this.handleLeftClick(pointer);
    } else if (button === 'right') {
      const dx = pointer.x - this._rmbClickStartX;
      const dy = pointer.y - this._rmbClickStartY;
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (moved > CLICK_DRAG_THRESHOLD) return; // was a drag, not a click

      this.handleRightClick(pointer);
    }
  }

  private onPointermove(pointer: Phaser.Input.Pointer): void {
    // Update cursor feedback based on hover target
    this._lastPointerX = pointer.x;
    this._lastPointerY = pointer.y;
  }

  /**
   * VISUAL-HUD-CORE-01-FIXUP-1: Clear any pending click/drag state.
   * Called when a pointer-up occurs inside the HUD area so that a
   * stale _clickButton does not leak into the next pointer-down/up cycle.
   */
  private cancelPendingClick(): void {
    this._clickButton = 'none';
  }

  /** Last pointer position for cursor feedback. */
  private _lastPointerX: number = 0;
  private _lastPointerY: number = 0;

  // ─── Click target detection ─────────────────────────────────────

  /**
   * Determine what's under the cursor at the given pointer position.
   *
   * This is the unified target detection used by both LMB and RMB routing.
   */
  private detectClickTarget(pointer: Phaser.Input.Pointer): ClickTarget {
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gameState = this.getGameState();
    const tilePos = screenToTile(worldPoint.x - this.offset.x, worldPoint.y - this.offset.y);
    const clickTx = tilePos.x;
    const clickTy = tilePos.y;

    // Check own harvesters
    for (const h of gameState.harvesters) {
      const dx = h.ftx - clickTx;
      const dy = h.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SELECT_RADIUS) {
        return { kind: 'own-harvester', id: h.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };
      }
    }

    // Check own builders
    for (const b of gameState.mapData.builders) {
      const dx = b.ftx - clickTx;
      const dy = b.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SELECT_RADIUS) {
        return { kind: 'own-builder', id: b.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };
      }
    }

    // Check resources (for harvest commands)
    for (const r of gameState.resourceNodes) {
      if (r.depleted) continue;
      const dx = r.tx - clickTx;
      const dy = r.ty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SELECT_RADIUS + r.footprint * 0.5) {
        return { kind: 'resource', id: r.id, tx: r.tx, ty: r.ty };
      }
    }

    // Default: ground
    return { kind: 'ground', tx: Math.round(clickTx), ty: Math.round(clickTy) };
  }

  // ─── LMB click handler ──────────────────────────────────────────

  /**
   * CORE-STEP-05H+: Handle LMB click — select/inspect ONLY.
   *
   * LMB must NEVER: move units, attack, harvest, pan camera, fire weapons.
   */
  private handleLeftClick(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // DEV-ASSET-PREVIEW-01 fixup: If the preview tool already consumed the
    // click via a sprite pointerdown handler (click-to-select), skip all
    // normal input processing so unit selection/move does not also fire.
    if (this.assetPreviewTool?.spriteClickConsumed) {
      this.assetPreviewPanel?.refresh();
      this.assetPreviewTool.resetSpriteClickConsumed();
      return;
    }

    // DEV-ASSET-PREVIEW-01 fixup: If asset preview tool is active and either
    // a pending asset is set or a placement is selected, consume the click
    // for place-or-move instead of normal input.
    if (this.assetPreviewTool?.active) {
      const currentScale = this.assetPreviewPanel?.getCurrentScale() ?? 1;
      const currentFootprint = this.assetPreviewPanel?.getCurrentFootprint() ?? 1;
      const consumed = this.assetPreviewTool.handleMapClick(
        worldPoint.x,
        worldPoint.y,
        currentScale,
        currentFootprint,
      );
      if (consumed) {
        this.assetPreviewPanel?.refresh();
        return;
      }
    }

    // CORE-STEP-05H+: Use command router for LMB
    const target = this.detectClickTarget(pointer);
    const routeResult = routeLmbClick(target, this.selectedUnit);

    switch (routeResult.action) {
      case 'select':
        this.selectedUnit = routeResult.selection;
        if (routeResult.selection) {
          const selLabel = routeResult.selection.kind === 'builder'
            ? `Builder ${routeResult.selection.id}`
            : `Harvester ${routeResult.selection.id}`;
          this.showStatusCb(`Выбран: ${selLabel}`, true);
        }
        break;
      case 'deselect':
        this.selectedUnit = clearSelection();
        break;
      case 'no-op':
        // LMB on enemy/resource/empty ground with no selection → no-op
        break;
    }
  }

  // ─── RMB click handler ──────────────────────────────────────────

  /**
   * CORE-STEP-05H+: Handle RMB click — issue commands.
   *
   * RMB with selected unit:
   * - Ground → move
   * - Resource + harvester → harvest
   * - Resource + non-harvester → move
   * - No selected unit → no-op
   *
   * RMB must NOT: pan camera, select units, inspect as primary action.
   */
  private handleRightClick(pointer: Phaser.Input.Pointer): void {
    const target = this.detectClickTarget(pointer);
    const routeResult = routeRmbClick(target, this.selectedUnit);

    switch (routeResult.action) {
      case 'move': {
        this.executeMoveCommand(routeResult.tx, routeResult.ty);
        break;
      }
      case 'harvest': {
        this.executeHarvestCommand(routeResult.tx, routeResult.ty);
        break;
      }
      case 'attack': {
        // Attack/target-lock is handled by BlockoutVehicleInputController in Arena mode.
        // For civil units, there is no attack command yet.
        this.showStatusCb('Атака: нет боевого юнита', false);
        break;
      }
      case 'context-build': {
        // Future: builder context action near building site
        this.executeMoveCommand(routeResult.tx, routeResult.ty);
        break;
      }
      case 'no-op': {
        // No selected unit or own entity → no-op
        break;
      }
    }
  }

  // ─── Command execution ──────────────────────────────────────────

  private executeMoveCommand(tx: number, ty: number): void {
    if (!isUnitSelected(this.selectedUnit)) return;

    const gameState = this.getGameState();
    const result = issueManualMove(gameState, this.selectedUnit, tx, ty);
    if (result.ok) {
      const label = this.selectedUnit!.kind === 'builder' ? 'Строитель' : 'Сборщик';
      this.showStatusCb(`${label} → (${tx},${ty})`, true);
      // Command confirmation: green indicator at target
      this.feedbackRenderer.addCommandOk(tx, ty, this.scene.time.now);
    } else {
      this.showStatusCb(`Ошибка: ${result.reason}`, false);
      this.feedbackRenderer.addCommandFail(tx, ty, this.scene.time.now);
    }
  }

  private executeHarvestCommand(tx: number, ty: number): void {
    if (!isHarvesterSelected(this.selectedUnit)) return;

    const gameState = this.getGameState();
    // Issue move to the resource position — harvester auto-gather will take over
    const result = issueManualMove(gameState, this.selectedUnit, tx, ty);
    if (result.ok) {
      this.showStatusCb(`Сборщик → добыча (${tx},${ty})`, true);
      this.feedbackRenderer.addCommandOk(tx, ty, this.scene.time.now);
    } else {
      this.showStatusCb(`Ошибка: ${result.reason}`, false);
      this.feedbackRenderer.addCommandFail(tx, ty, this.scene.time.now);
    }
  }

  // ─── Cursor feedback ─────────────────────────────────────────────

  private updateCursorFeedback(): void {
    const worldPoint = this.scene.cameras.main.getWorldPoint(this._lastPointerX, this._lastPointerY);
    const gameState = this.getGameState();
    const tilePos = screenToTile(worldPoint.x - this.offset.x, worldPoint.y - this.offset.y);
    const clickTx = tilePos.x;
    const clickTy = tilePos.y;

    // Detect hover target (simplified — same logic as detectClickTarget but for hover)
    let hoverTarget: ClickTarget | null = null;

    // Check own harvesters
    for (const h of gameState.harvesters) {
      const dx = h.ftx - clickTx;
      const dy = h.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SELECT_RADIUS) {
        hoverTarget = { kind: 'own-harvester', id: h.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };
        break;
      }
    }

    // Check own builders
    if (!hoverTarget) {
      for (const b of gameState.mapData.builders) {
        const dx = b.ftx - clickTx;
        const dy = b.fty - clickTy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SELECT_RADIUS) {
          hoverTarget = { kind: 'own-builder', id: b.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };
          break;
        }
      }
    }

    // Check resources
    if (!hoverTarget) {
      for (const r of gameState.resourceNodes) {
        if (r.depleted) continue;
        const dx = r.tx - clickTx;
        const dy = r.ty - clickTy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SELECT_RADIUS + r.footprint * 0.5) {
          hoverTarget = { kind: 'resource', id: r.id, tx: r.tx, ty: r.ty };
          break;
        }
      }
    }

    // Default: ground
    if (!hoverTarget) {
      hoverTarget = { kind: 'ground', tx: Math.round(clickTx), ty: Math.round(clickTy) };
    }

    const newState = determineCursorFeedback(hoverTarget, this.selectedUnit, this.isArenaMode());
    if (newState !== this._cursorState) {
      this._cursorState = newState;
      this.applyCursorStyle(newState);
    }
  }

  /** Apply CSS cursor style based on feedback state. */
  private applyCursorStyle(state: CursorFeedbackState): void {
    const canvas = this.scene.game.canvas;
    switch (state) {
      case 'default':
        canvas.style.cursor = 'default';
        break;
      case 'select':
        canvas.style.cursor = 'pointer';
        break;
      case 'move':
        canvas.style.cursor = 'crosshair';
        break;
      case 'harvest':
        canvas.style.cursor = 'crosshair';
        break;
      case 'attack':
        canvas.style.cursor = 'crosshair';
        break;
      case 'blocked':
        canvas.style.cursor = 'not-allowed';
        break;
    }
  }

  /** Get current cursor feedback state (for testing). */
  getCursorFeedbackState(): CursorFeedbackState {
    return this._cursorState;
  }

  // ─── Keyboard input ────────────────────────────────────────────

  private setupKeyboardInput(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;

    // ── Stage 3 retirement: modular tank tuner hotkeys removed ──
    //
    // The following hotkeys were removed in VEHICLE-RENDER-UNIFY-03-VH
    // because they controlled the legacy per-dir offset tables, which
    // are no longer in worldConfig.ts:
    //   - T  (toggle modular tank debug overlay)
    //   - H  (select hull layer for tuning)
    //   - J  (select turret layer for tuning)
    //   - C  (print offset tables to console)
    //   - Q/E (cycle body direction)
    //   - Z/X (cycle turret direction)
    //   - Arrow keys (adjust selected offset)
    //
    // The modular tank direction is now controlled entirely by the
    // adapter's composeModularVehicle() math, driven by entity.dir /
    // entity.turretDir from game state. No manual tuner is needed.
    //
    // If a future stage needs devtools direction cycling, it should be
    // implemented as an explicit devtools panel control, not as global
    // keyboard hotkeys that mutate shared tuner state.

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

    // ── CORE-STEP-05H+: S key — stop selected unit ────────────
    kb.on('keydown-S', () => {
      this.handleStopKey();
    });

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

    // ── DEV-ASSET-PREVIEW-01: Asset preview toggle (0) ──────
    kb.on('keydown-ZERO', () => {
      if (this.assetPreviewTool && this.assetPreviewPanel) {
        this.assetPreviewTool.toggle();
        if (this.assetPreviewTool.active) {
          this.assetPreviewPanel.show();
        } else {
          this.assetPreviewPanel.hide();
        }
        console.log(`[GameScene] Asset preview: ${this.assetPreviewTool.active ? 'ON' : 'OFF'}`);
      }
    });

    // ── CORE-STEP-05H+: ESC with priority chain ──────────────
    // Priority: 1. cancel active mode, 2. deselect, 3. close overlay, 4. pause
    kb.on('keydown-ESC', () => {
      this.handleEscKey();
    });
  }

  // ─── S key handler ──────────────────────────────────────────────

  private handleStopKey(): void {
    const routeResult = routeSKey(this.selectedUnit);
    const gameState = this.getGameState();

    switch (routeResult.action) {
      case 'stop': {
        const result = stopUnitCommand(gameState, this.selectedUnit!);
        if (result.ok) {
          const label = routeResult.unitKind === 'harvester' ? 'Сборщик' : 'Строитель';
          this.showStatusCb(`${label}: стоп`, true);
        }
        break;
      }
      case 'clear-target-lock': {
        // Blockout vehicle target-lock clear is handled by BlockoutVehicleInputController
        break;
      }
      case 'no-op':
        break;
    }
  }

  // ─── ESC key handler with priority chain ─────────────────────────

  private handleEscKey(): void {
    const hasSelection = isUnitSelected(this.selectedUnit);
    const isOverlayOpen = this.devtoolsPanel?.visible ?? false;

    const routeResult = routeEscKey(
      this.isPlacementActive(),
      hasSelection,
      isOverlayOpen,
    );

    switch (routeResult.action) {
      case 'cancel-active-mode':
        // Active placement mode — ESC is owned by Arena placement cancel
        // This is handled by GameScene's handlePlacementKeydown
        // When isPlacementActive() returns true, the placement handler
        // consumes ESC before this controller's handler fires.
        // (The placement handler is registered directly on keyboard in GameScene)
        // This route is a safety fallback — it shouldn't normally be reached.
        break;

      case 'deselect':
        this.selectedUnit = clearSelection();
        this.showStatusCb('Снято выделение', true);
        break;

      case 'close-overlay':
        if (this.devtoolsPanel?.visible) {
          this.devtoolsPanel.hide();
        }
        break;

      case 'toggle-pause':
        if (this.pauseMenu.visible) {
          this.pauseMenu.hide();
          this.setPausedCb(false);
        } else {
          this.pauseMenu.show();
          this.setPausedCb(true);
        }
        break;
    }
  }

  // ─── Stage 3 retirement ───────────────────────────────────────────
  // onArrowKey() removed: it was only used by the legacy offset-table
  // tuner, which is no longer wired. Arrow keys now do nothing in the
  // modular tank context.

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
    this.scene.input.off('pointermove', this.boundPointermove);

    // Remove DOM contextmenu handler
    if (this.contextmenuHandler) {
      this.scene.game.canvas.removeEventListener('contextmenu', this.contextmenuHandler);
      this.contextmenuHandler = null;
    }

    // Reset cursor
    this.scene.game.canvas.style.cursor = 'default';

    // Destroy graphics
    this.selectionHighlight.destroy();

    // Note: Keyboard handlers are cleaned up by Phaser scene shutdown.
    // The scene's KeyboardPlugin is destroyed automatically, removing all
    // registered key listeners.
  }
}
