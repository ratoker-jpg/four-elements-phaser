import Phaser from 'phaser';
import { screenToTile, tileToScreen, type IsoPoint } from '../render/isometric';
import type { GameState, BuildingType, ProducibleUnitType } from '../../state/types';
import { placeConstructionSite } from '../../state/construction';
import { findBuildSiteNearPlayerBuildings } from '../../state/buildSiteSelection';
import { isVisualReadyBuilding } from '../../config/buildingRuntimeMapping';
import { startUnitProduction, cancelFactoryQueueItem } from '../../state/production';
import type { UnitSelection, SelectableUnit } from '../../state/unitSelection';
import {
  clearSelection, isUnitSelected,
  selectMany, getSelectionTypeBreakdown,
  hasHarvesterInSelection, getSelectionCenterTile,
} from '../../state/unitSelection';
import { issueManualMove, stopUnitCommand, issueMultiMoveCommand, stopUnitsCommand } from '../../state/unitCommands';
import type { BuildRequestResult, ProductionRequestResult, CancelRequestResult } from '../ui/PlaytestHud';
import { commandRegistry, registerMvpCommands } from '../../state/commandRegistry';
import { isScreenPointInHud } from '../ui/hud/hudLayout';
import { buildCommandCardViewModel } from '../ui/hud/commandPanelViewModel';
import { ALL_SLOT_KEYS, type SlotKey } from '../ui/hud/commandCardGrid';
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
import { ControlGroupManager } from '../../state/controlGroups';

/**
 * GameInputController — extracts input handling and command dispatch from GameScene.
 *
 * SELECTION-CONTROL-GROUPS-05: Full multi-select support:
 * - Drag-box selection (LMB drag)
 * - Double-click same-type selection
 * - Control groups (Ctrl+1-9 assign, 1-9 recall, double-tap center)
 * - Shift+click add/toggle in selection
 * - Multi-unit move/stop commands
 *
 * CORE-STEP-05H+: Unified RTS Controls and Command Routing.
 * - LMB = select / inspect only (NEVER move/attack/harvest)
 * - RMB = command (move/harvest/attack based on target + selection)
 * - S = stop selected unit(s) / clear command
 * - Esc = context priority: cancel mode → deselect → close overlay → pause
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
  /** ARENA-02H+ fixup: Whether arena placement mode is active. */
  isPlacementActive?: () => boolean;
  /** CORE-STEP-05H+: Whether Arena mode is active. Affects cursor feedback. */
  isArenaMode?: () => boolean;
  /** CameraControls reference for wiring debug overlay predicate and control group centering. */
  cameraControls?: { isDebugOverlayActive: () => boolean; centerOn: (worldX: number, worldY: number) => void };
  /** VISUAL-HUD-CORE-01-FIXUP-2: Whether the bottom RTS HUD bar is active. */
  isBottomHudActive?: () => boolean;
}

// ─── Selection highlight constants ─────────────────────────────────

/** Radius for the pulsing selection highlight circle. */
const HIGHLIGHT_RADIUS = 16;

/** Click detection threshold — pixels moved beyond this is a drag, not a click. */
const CLICK_DRAG_THRESHOLD = 4;

/** Selection radius in tile units for click-to-select. */
const SELECT_RADIUS = 0.8;

/** Drag-select threshold — must move at least this many pixels to start box select. */
const DRAG_SELECT_THRESHOLD = 5;

/** Double-click time window in milliseconds. */
const DOUBLE_CLICK_MS = 350;

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
  private isBottomHudActive: () => boolean;

  // SELECTION-CONTROL-GROUPS-05: Multi-selection state
  private selection: UnitSelection = null;

  /** Control group manager. */
  private controlGroupManager: ControlGroupManager;

  /** Camera controls for centering on control group double-tap. */
  private cameraControls: { isDebugOverlayActive: () => boolean; centerOn: (worldX: number, worldY: number) => void } | null;

  /** Selection highlight graphics. */
  private selectionHighlight: Phaser.GameObjects.Graphics;

  /** Drag-select graphics. */
  private selectionRect: Phaser.GameObjects.Graphics;

  /** Click detection state (distinguish click from drag). */
  private _clickStartX: number = 0;
  private _clickStartY: number = 0;
  private _clickButton: 'left' | 'right' | 'none' = 'none';

  /** RMB click detection state. */
  private _rmbClickStartX: number = 0;
  private _rmbClickStartY: number = 0;

  // ─── Drag-select state ──────────────────────────────────────────
  private _isDragSelecting: boolean = false;
  private _dragStartX: number = 0;
  private _dragStartY: number = 0;
  private _dragEndX: number = 0;
  private _dragEndY: number = 0;
  private _potentialDrag: boolean = false;

  // ─── Double-click state ─────────────────────────────────────────
  private _lastClickTime: number = 0;
  private _lastClickTarget: { kind: 'builder' | 'harvester'; id: string } | null = null;

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
    this.isBottomHudActive = deps.isBottomHudActive ?? (() => true);
    this.cameraControls = deps.cameraControls ?? null;

    // SELECTION-CONTROL-GROUPS-05: Create control group manager
    this.controlGroupManager = new ControlGroupManager();

    // Create selection highlight graphics
    this.selectionHighlight = this.scene.add.graphics();
    this.selectionHighlight.setDepth(150);

    // Create drag-select rectangle graphics
    // FIXUP-1: setScrollFactor(0) so rect renders in screen space
    this.selectionRect = this.scene.add.graphics();
    this.selectionRect.setDepth(160);
    this.selectionRect.setScrollFactor(0);

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

  private wireCommandCallbacks(): void {
    const wireBuild = (commandId: string, buildingType: BuildingType) => {
      const cmd = commandRegistry.get(commandId);
      if (cmd) {
        cmd.execute = () => {
          const result = this.requestBuild(buildingType);
          this.showStatusCb(result.message, result.success);
        };
      }
    };

    wireBuild('build-separator', 'separator');
    wireBuild('build-raw-storage', 'raw-storage');
    wireBuild('build-matter-storage', 'matter-storage');
    wireBuild('build-element-storage', 'element-storage');
    wireBuild('build-power-plant', 'power-plant');
    wireBuild('build-units-factory', 'units-factory');

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

    const unitStop = commandRegistry.get('unit-stop');
    if (unitStop) {
      unitStop.execute = () => {
        this.handleStopKey();
      };
    }

    // SELECTION-CONTROL-GROUPS-05: Only B and P legacy aliases remain
    const legacyAliases: [string, () => void][] = [
      ['build-separator-legacy',      () => { const r = this.requestBuild('separator'); this.showStatusCb(r.message, r.success); }],
      ['build-power-plant-legacy',   () => { const r = this.requestBuild('power-plant'); this.showStatusCb(r.message, r.success); }],
    ];
    for (const [aliasId, execute] of legacyAliases) {
      const cmd = commandRegistry.get(aliasId);
      if (cmd) {
        cmd.execute = execute;
      }
    }
  }

  // ─── Command methods (shared by hotkeys and HUD buttons) ────────

  requestBuild(buildingType: BuildingType): BuildRequestResult {
    const gameState = this.getGameState();

    if (isVisualReadyBuilding(buildingType)) {
      return { success: false, message: `${buildingType} is not buildable yet` };
    }

    const hasIdleBuilder = gameState.mapData.builders.some(b => b.phase === 'idle' && !b.busy);
    if (!hasIdleBuilder) {
      return { success: false, message: 'no idle builder' };
    }

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
    this.scene.input.on('pointerdown', this.boundPointerdown);
    this.scene.input.on('pointerup', this.boundPointerup);
    this.scene.input.on('pointermove', this.boundPointermove);
  }

  /**
   * VISUAL-HUD-CORE-01: Expose current selection for the HUD selection panel.
   */
  getSelection(): UnitSelection {
    return this.selection;
  }

  showStatus(message: string, success: boolean): void {
    this.showStatusCb(message, success);
  }

  /**
   * Get the control group manager (for external access if needed).
   */
  getControlGroupManager(): ControlGroupManager {
    return this.controlGroupManager;
  }

  private isPointerInHud(pointer: Phaser.Input.Pointer): boolean {
    if (!this.isBottomHudActive()) return false;
    const canvasHeight = this.scene.game.canvas.height;
    return isScreenPointInHud(pointer.y, canvasHeight);
  }

  private onPointerdown(pointer: Phaser.Input.Pointer): void {
    if (this.isPointerInHud(pointer)) return;

    if (pointer.leftButtonDown()) {
      this._clickStartX = pointer.x;
      this._clickStartY = pointer.y;
      this._clickButton = 'left';
      // Start potential drag-select
      this._dragStartX = pointer.x;
      this._dragStartY = pointer.y;
      this._potentialDrag = true;
      this._isDragSelecting = false;
    } else if (pointer.rightButtonDown()) {
      this._rmbClickStartX = pointer.x;
      this._rmbClickStartY = pointer.y;
      this._clickButton = 'right';
      // Cancel any drag-select in progress
      this._potentialDrag = false;
      this._isDragSelecting = false;
      this.selectionRect.clear();
    }
  }

  private onPointerup(pointer: Phaser.Input.Pointer): void {
    if (this.isPointerInHud(pointer)) {
      this.cancelPendingClick();
      return;
    }

    const button = this._clickButton;
    this._clickButton = 'none';

    if (button === 'left') {
      // If drag-selecting, finalize the box selection
      if (this._isDragSelecting) {
        this.finalizeDragSelect();
        this._isDragSelecting = false;
        this._potentialDrag = false;
        this.selectionRect.clear();
        return;
      }

      this._potentialDrag = false;
      this.selectionRect.clear();

      const dx = pointer.x - this._clickStartX;
      const dy = pointer.y - this._clickStartY;
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (moved > CLICK_DRAG_THRESHOLD) return; // was a drag, not a click

      this.handleLeftClick(pointer);
    } else if (button === 'right') {
      const dx = pointer.x - this._rmbClickStartX;
      const dy = pointer.y - this._rmbClickStartY;
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (moved > CLICK_DRAG_THRESHOLD) return;

      this.handleRightClick(pointer);
    }
  }

  private onPointermove(pointer: Phaser.Input.Pointer): void {
    this._lastPointerX = pointer.x;
    this._lastPointerY = pointer.y;

    // Handle drag-select drawing
    if (this._potentialDrag && this._clickButton === 'left') {
      const dx = pointer.x - this._dragStartX;
      const dy = pointer.y - this._dragStartY;
      const moved = Math.sqrt(dx * dx + dy * dy);

      if (moved >= DRAG_SELECT_THRESHOLD) {
        this._isDragSelecting = true;
        this._dragEndX = pointer.x;
        this._dragEndY = pointer.y;
        this.drawSelectionRect();
      }
    }
  }

  private cancelPendingClick(): void {
    this._clickButton = 'none';
    this._potentialDrag = false;
    this._isDragSelecting = false;
    this.selectionRect.clear();
  }

  /** Last pointer position for cursor feedback. */
  private _lastPointerX: number = 0;
  private _lastPointerY: number = 0;

  // ─── Drag-select ────────────────────────────────────────────────

  /** Draw the semi-transparent drag-select rectangle. */
  private drawSelectionRect(): void {
    this.selectionRect.clear();

    const x = Math.min(this._dragStartX, this._dragEndX);
    const y = Math.min(this._dragStartY, this._dragEndY);
    const w = Math.abs(this._dragEndX - this._dragStartX);
    const h = Math.abs(this._dragEndY - this._dragStartY);

    // Fill
    this.selectionRect.fillStyle(0x00ffff, 0.15);
    this.selectionRect.fillRect(x, y, w, h);

    // Stroke
    this.selectionRect.lineStyle(1, 0x00ffff, 0.8);
    this.selectionRect.strokeRect(x, y, w, h);
  }

  /**
   * FIXUP-1: Convert a world-space position to screen-space.
   *
   * World coords = tileToScreen(ftx, fty) + offset (the Phaser render position).
   * Screen coords = position on the game canvas, accounting for camera scroll & zoom.
   */
  private worldToScreen(worldX: number, worldY: number): { sx: number; sy: number } {
    const cam = this.scene.cameras.main;
    const sx = (worldX - cam.worldView.x) * cam.zoom;
    const sy = (worldY - cam.worldView.y) * cam.zoom;
    return { sx, sy };
  }

  /** Finalize drag-select: find all own units within the screen-space rectangle.
   *
   * FIXUP-1: Drag rect is in screen space (pointer coords). Unit positions
   * are now projected to screen space via worldToScreen() so the comparison
   * is coordinate-space consistent regardless of camera scroll/zoom.
   */
  private finalizeDragSelect(): void {
    const gameState = this.getGameState();
    const canvasHeight = this.scene.game.canvas.height;

    // Drag rect in screen space (pointer coords)
    const left = Math.min(this._dragStartX, this._dragEndX);
    const top = Math.min(this._dragStartY, this._dragEndY);
    const right = Math.max(this._dragStartX, this._dragEndX);
    const bottom = Math.max(this._dragStartY, this._dragEndY);

    const selectedUnits: SelectableUnit[] = [];
    const shiftHeld = this.scene.input.keyboard?.addKey('SHIFT')?.isDown ?? false;

    // Check builders — convert world positions to screen space
    for (const b of gameState.mapData.builders) {
      const worldPos = tileToScreen(b.ftx, b.fty);
      const worldX = worldPos.x + this.offset.x;
      const worldY = worldPos.y + this.offset.y;
      const { sx, sy } = this.worldToScreen(worldX, worldY);

      // Compare screen-space unit position against screen-space drag rect
      if (sx >= left && sx <= right && sy >= top && sy <= bottom && !isScreenPointInHud(sy, canvasHeight)) {
        selectedUnits.push({ kind: 'builder', id: b.id });
      }
    }

    // Check harvesters — convert world positions to screen space
    for (const h of gameState.harvesters) {
      const worldPos = tileToScreen(h.ftx, h.fty);
      const worldX = worldPos.x + this.offset.x;
      const worldY = worldPos.y + this.offset.y;
      const { sx, sy } = this.worldToScreen(worldX, worldY);

      if (sx >= left && sx <= right && sy >= top && sy <= bottom && !isScreenPointInHud(sy, canvasHeight)) {
        selectedUnits.push({ kind: 'harvester', id: h.id });
      }
    }

    if (selectedUnits.length === 0) {
      // If Shift not held, deselect; if Shift held, keep current selection
      if (!shiftHeld) {
        this.selection = clearSelection();
      }
      return;
    }

    if (shiftHeld && this.selection) {
      // Add to existing selection
      const combined = [...this.selection.units, ...selectedUnits];
      // Deduplicate
      const seen = new Set<string>();
      const unique: SelectableUnit[] = [];
      for (const u of combined) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          unique.push(u);
        }
      }
      this.selection = selectMany(unique, this.selection.primaryId);
    } else {
      this.selection = selectMany(selectedUnits);
    }

    this.showSelectionStatus();
  }

  // ─── Double-click same type ─────────────────────────────────────

  /** Check for double-click on same unit type and select all of that type in viewport. */
  private handleDoubleClickSameType(target: ClickTarget): boolean {
    if (target.kind !== 'own-harvester' && target.kind !== 'own-builder') return false;
    if (!target.unitKind) return false;

    const now = Date.now();
    const isDoubleClick = this._lastClickTarget
      && this._lastClickTarget.kind === target.unitKind
      && (now - this._lastClickTime) < DOUBLE_CLICK_MS;

    // Update double-click tracking
    this._lastClickTime = now;
    this._lastClickTarget = { kind: target.unitKind, id: target.id! };

    if (!isDoubleClick) return false;

    // Select all units of the same type in viewport
    const gameState = this.getGameState();
    const cam = this.scene.cameras.main;
    const canvasHeight = this.scene.game.canvas.height;

    const selectedUnits: SelectableUnit[] = [];

    // FIXUP-1: Use world-space for worldView.contains (correct) and
    // screen-space for isScreenPointInHud (was using world Y — now fixed).
    if (target.unitKind === 'builder') {
      for (const b of gameState.mapData.builders) {
        const worldPos = tileToScreen(b.ftx, b.fty);
        const worldX = worldPos.x + this.offset.x;
        const worldY = worldPos.y + this.offset.y;
        if (cam.worldView.contains(worldX, worldY)) {
          const { sy } = this.worldToScreen(worldX, worldY);
          if (!isScreenPointInHud(sy, canvasHeight)) {
            selectedUnits.push({ kind: 'builder', id: b.id });
          }
        }
      }
    } else if (target.unitKind === 'harvester') {
      for (const h of gameState.harvesters) {
        const worldPos = tileToScreen(h.ftx, h.fty);
        const worldX = worldPos.x + this.offset.x;
        const worldY = worldPos.y + this.offset.y;
        if (cam.worldView.contains(worldX, worldY)) {
          const { sy } = this.worldToScreen(worldX, worldY);
          if (!isScreenPointInHud(sy, canvasHeight)) {
            selectedUnits.push({ kind: 'harvester', id: h.id });
          }
        }
      }
    }

    if (selectedUnits.length > 0) {
      this.selection = selectMany(selectedUnits);
      this.showSelectionStatus();
      return true;
    }

    return false;
  }

  // ─── Click target detection ─────────────────────────────────────

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
        return { kind: 'own-harvester', id: h.id, unitKind: 'harvester', tx: Math.round(clickTx), ty: Math.round(clickTy) };
      }
    }

    // Check own builders
    for (const b of gameState.mapData.builders) {
      const dx = b.ftx - clickTx;
      const dy = b.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SELECT_RADIUS) {
        return { kind: 'own-builder', id: b.id, unitKind: 'builder', tx: Math.round(clickTx), ty: Math.round(clickTy) };
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

  private handleLeftClick(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // DEV-ASSET-PREVIEW-01 fixup
    if (this.assetPreviewTool?.spriteClickConsumed) {
      this.assetPreviewPanel?.refresh();
      this.assetPreviewTool.resetSpriteClickConsumed();
      return;
    }

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

    const target = this.detectClickTarget(pointer);
    const shiftHeld = this.scene.input.keyboard?.addKey('SHIFT')?.isDown ?? false;

    // Check for double-click on same unit type
    if (!shiftHeld && (target.kind === 'own-harvester' || target.kind === 'own-builder')) {
      if (this.handleDoubleClickSameType(target)) {
        return;
      }
    }

    const routeResult = routeLmbClick(target, this.selection, shiftHeld);

    switch (routeResult.action) {
      case 'select':
        this.selection = routeResult.selection;
        this.showSelectionStatus();
        break;
      case 'add-to-selection':
        this.selection = routeResult.selection;
        this.showSelectionStatus();
        break;
      case 'toggle-in-selection':
        this.selection = routeResult.selection;
        this.showSelectionStatus();
        break;
      case 'deselect':
        this.selection = clearSelection();
        break;
      case 'no-op':
        break;
    }
  }

  // ─── RMB click handler ──────────────────────────────────────────

  private handleRightClick(pointer: Phaser.Input.Pointer): void {
    const target = this.detectClickTarget(pointer);
    const routeResult = routeRmbClick(target, this.selection);

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
        this.showStatusCb('Атака: нет боевого юнита', false);
        break;
      }
      case 'context-build': {
        this.executeMoveCommand(routeResult.tx, routeResult.ty);
        break;
      }
      case 'no-op': {
        break;
      }
    }
  }

  // ─── Command execution ──────────────────────────────────────────

  private executeMoveCommand(tx: number, ty: number): void {
    if (!isUnitSelected(this.selection)) return;

    const gameState = this.getGameState();

    if (this.selection.kind === 'single') {
      // Single unit: use legacy single-unit move
      const result = issueManualMove(gameState, this.selection.units[0], tx, ty);
      if (result.ok) {
        const label = this.selection.units[0].kind === 'builder' ? 'Строитель' : 'Сборщик';
        this.showStatusCb(`${label} → (${tx},${ty})`, true);
        this.feedbackRenderer.addCommandOk(tx, ty, this.scene.time.now);
      } else {
        this.showStatusCb(`Ошибка: ${result.reason}`, false);
        this.feedbackRenderer.addCommandFail(tx, ty, this.scene.time.now);
      }
    } else {
      // Multi unit: use multi-move
      const result = issueMultiMoveCommand(gameState, this.selection, tx, ty);
      if (result.okCount > 0) {
        this.showStatusCb(`${result.okCount} юнит(ов) → (${tx},${ty})`, true);
        this.feedbackRenderer.addCommandOk(tx, ty, this.scene.time.now);
      } else {
        this.showStatusCb('Ошибка: нельзя двигать', false);
        this.feedbackRenderer.addCommandFail(tx, ty, this.scene.time.now);
      }
    }
  }

  private executeHarvestCommand(tx: number, ty: number): void {
    if (!hasHarvesterInSelection(this.selection)) return;

    const gameState = this.getGameState();

    // Move all selected harvesters toward the resource
    const harvesters = this.selection!.units.filter(u => u.kind === 'harvester');
    let okCount = 0;
    for (const h of harvesters) {
      const result = issueManualMove(gameState, h, tx, ty);
      if (result.ok) okCount++;
    }

    if (okCount > 0) {
      this.showStatusCb(`${okCount} сборщик(ов) → добыча (${tx},${ty})`, true);
      this.feedbackRenderer.addCommandOk(tx, ty, this.scene.time.now);
    } else {
      this.showStatusCb('Ошибка: нельзя двигать', false);
      this.feedbackRenderer.addCommandFail(tx, ty, this.scene.time.now);
    }
  }

  /** Show status for current selection. */
  private showSelectionStatus(): void {
    if (!this.selection) return;

    const count = this.selection.units.length;
    if (count === 1) {
      const primary = this.selection.units[0];
      const label = primary.kind === 'builder'
        ? `Builder ${primary.id}`
        : `Harvester ${primary.id}`;
      this.showStatusCb(`Выбран: ${label}`, true);
    } else {
      const breakdown = getSelectionTypeBreakdown(this.selection);
      const parts: string[] = [];
      const bc = breakdown.get('builder') ?? 0;
      const hc = breakdown.get('harvester') ?? 0;
      if (bc > 0) parts.push(`${bc} Builder${bc > 1 ? 's' : ''}`);
      if (hc > 0) parts.push(`${hc} Harvester${hc > 1 ? 's' : ''}`);
      this.showStatusCb(`Выбрано: ${parts.join(', ')}`, true);
    }
  }

  // ─── Cursor feedback ─────────────────────────────────────────────

  private updateCursorFeedback(): void {
    const worldPoint = this.scene.cameras.main.getWorldPoint(this._lastPointerX, this._lastPointerY);
    const gameState = this.getGameState();
    const tilePos = screenToTile(worldPoint.x - this.offset.x, worldPoint.y - this.offset.y);
    const clickTx = tilePos.x;
    const clickTy = tilePos.y;

    let hoverTarget: ClickTarget | null = null;

    for (const h of gameState.harvesters) {
      const dx = h.ftx - clickTx;
      const dy = h.fty - clickTy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SELECT_RADIUS) {
        hoverTarget = { kind: 'own-harvester', id: h.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };
        break;
      }
    }

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

    if (!hoverTarget) {
      hoverTarget = { kind: 'ground', tx: Math.round(clickTx), ty: Math.round(clickTy) };
    }

    const newState = determineCursorFeedback(hoverTarget, this.selection, this.isArenaMode());
    if (newState !== this._cursorState) {
      this._cursorState = newState;
      this.applyCursorStyle(newState);
    }
  }

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

  getCursorFeedbackState(): CursorFeedbackState {
    return this._cursorState;
  }

  // ─── Keyboard input ────────────────────────────────────────────

  private setupKeyboardInput(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;

    // Grid hotkeys: Q/W/E/R/A/S/D/F/Z/X/C/V
    for (const slotKey of ALL_SLOT_KEYS) {
      kb.on(`keydown-${slotKey}`, () => {
        this.dispatchCommandCardHotkey(slotKey);
      });
    }

    // SELECTION-CONTROL-GROUPS-05: Legacy alias hotkeys — only B and P remain
    const legacyKeys = ['B', 'P'];
    for (const key of legacyKeys) {
      kb.on(`keydown-${key}`, () => {
        this.dispatchLegacyAlias(key);
      });
    }

    // SELECTION-CONTROL-GROUPS-05: Number keys 1-9 for control groups
    const numberKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    for (let i = 0; i < numberKeys.length; i++) {
      const keyStr = numberKeys[i];
      const groupNum = i + 1;
      kb.on(`keydown-${keyStr}`, () => {
        this.handleControlGroupKey(groupNum);
      });
    }

    // Devtools toggle (F10 / backtick)
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

    // DEV-ASSET-PREVIEW-01: Asset preview toggle (0)
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

    // ESC with priority chain
    kb.on('keydown-ESC', () => {
      this.handleEscKey();
    });
  }

  // ─── Control group handling (SELECTION-CONTROL-GROUPS-05) ────────

  private handleControlGroupKey(numberKey: number): void {
    const gameState = this.getGameState();
    const ctrlHeld = this.scene.input.keyboard?.addKey('CTRL')?.isDown ?? false;

    if (ctrlHeld) {
      // Ctrl+Number: assign current selection to group
      this.controlGroupManager.assignGroup(numberKey, this.selection);
      if (this.selection) {
        const count = this.selection.units.length;
        this.showStatusCb(`Группа ${numberKey}: ${count} юнит(ов)`, true);
      }
    } else {
      // Number: recall group
      const shouldCenter = this.controlGroupManager.shouldCenterOnGroup(numberKey);
      const groupSelection = this.controlGroupManager.recallGroup(numberKey, gameState);

      if (groupSelection) {
        this.selection = groupSelection;
        this.showSelectionStatus();

        // Double-tap: center camera on group
        // FIXUP-1: getSelectionCenterTile returns tile-space {tx, ty};
        // convert to world coords here (camera/input layer) via tileToScreen + offset.
        if (shouldCenter) {
          const tileCenter = getSelectionCenterTile(groupSelection, gameState);
          if (tileCenter && this.cameraControls) {
            const worldPos = tileToScreen(tileCenter.tx, tileCenter.ty);
            this.cameraControls.centerOn(worldPos.x + this.offset.x, worldPos.y + this.offset.y);
          }
        }
      }
    }
  }

  // ─── S key handler ──────────────────────────────────────────────

  private handleStopKey(): void {
    const routeResult = routeSKey(this.selection);
    const gameState = this.getGameState();

    switch (routeResult.action) {
      case 'stop': {
        if (this.selection && this.selection.kind === 'single') {
          // Single unit stop
          const result = stopUnitCommand(gameState, this.selection.units[0]);
          if (result.ok) {
            const label = this.selection.units[0].kind === 'harvester' ? 'Сборщик' : 'Строитель';
            this.showStatusCb(`${label}: стоп`, true);
          }
        } else if (this.selection) {
          // Multi unit stop
          const result = stopUnitsCommand(gameState, this.selection);
          if (result.okCount > 0) {
            this.showStatusCb(`${result.okCount} юнит(ов): стоп`, true);
          }
        }
        break;
      }
      case 'clear-target-lock': {
        break;
      }
      case 'no-op':
        break;
    }
  }

  // ─── Contextual command-card hotkey dispatcher ──────────────────

  private dispatchCommandCardHotkey(slotKey: SlotKey): void {
    const gameState = this.getGameState();
    const vm = buildCommandCardViewModel(gameState, this.selection);

    const matchingSlot = vm.slots.find(
      s => s.slotKey === slotKey && s.state === 'enabled',
    );

    if (matchingSlot && matchingSlot.commandId) {
      commandRegistry.execute(matchingSlot.commandId);
      return;
    }

    const disabledSlot = vm.slots.find(
      s => s.slotKey === slotKey && s.state === 'disabled',
    );
    if (disabledSlot && disabledSlot.disabledReason) {
      this.showStatusCb(`${disabledSlot.label}: ${disabledSlot.disabledReason}`, false);
      return;
    }
  }

  private dispatchLegacyAlias(key: string): void {
    const gameState = this.getGameState();
    const vm = buildCommandCardViewModel(gameState, this.selection);

    const legacyToPrimary: Record<string, string> = {
      'B': 'build-separator',
      'P': 'build-power-plant',
    };

    const primaryId = legacyToPrimary[key];
    if (!primaryId) return;

    const matchingSlot = vm.slots.find(
      s => s.commandId === primaryId && s.state === 'enabled',
    );

    if (matchingSlot) {
      commandRegistry.execute(primaryId);
    } else {
      const disabledSlot = vm.slots.find(
        s => s.commandId === primaryId && s.state === 'disabled',
      );
      if (disabledSlot && disabledSlot.disabledReason) {
        this.showStatusCb(`${disabledSlot.label}: ${disabledSlot.disabledReason}`, false);
      }
    }
  }

  // ─── ESC key handler with priority chain ─────────────────────────

  private handleEscKey(): void {
    const hasSelection = isUnitSelected(this.selection);
    const isOverlayOpen = this.devtoolsPanel?.visible ?? false;

    const routeResult = routeEscKey(
      this.isPlacementActive(),
      hasSelection,
      isOverlayOpen,
    );

    switch (routeResult.action) {
      case 'cancel-active-mode':
        break;

      case 'deselect':
        this.selection = clearSelection();
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

  // ─── Selection highlight ───────────────────────────────────────

  /**
   * SELECTION-CONTROL-GROUPS-05: Draw selection highlights around ALL selected units.
   */
  private updateSelectionHighlight(): void {
    this.selectionHighlight.clear();

    if (!isUnitSelected(this.selection)) return;

    const gameState = this.getGameState();
    const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 1000) / 1000 * Math.PI * 2);
    const alpha = 0.4 + 0.4 * pulse;

    this.selectionHighlight.lineStyle(2, 0x00ffff, alpha);

    for (const unit of this.selection.units) {
      let ringX: number;
      let ringY: number;

      if (unit.kind === 'builder') {
        const builder = gameState.mapData.builders.find(b => b.id === unit.id);
        if (!builder) continue;
        const screenPos = tileToScreen(builder.ftx, builder.fty);
        ringX = screenPos.x + this.offset.x;
        ringY = screenPos.y + this.offset.y;
      } else if (unit.kind === 'harvester') {
        const harvester = gameState.harvesters.find(h => h.id === unit.id);
        if (!harvester) continue;
        const screenPos = tileToScreen(harvester.ftx, harvester.fty);
        ringX = screenPos.x + this.offset.x;
        ringY = screenPos.y + this.offset.y;
      } else {
        continue;
      }

      this.selectionHighlight.strokeCircle(ringX, ringY, HIGHLIGHT_RADIUS);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  destroy(): void {
    this.scene.input.off('pointerdown', this.boundPointerdown);
    this.scene.input.off('pointerup', this.boundPointerup);
    this.scene.input.off('pointermove', this.boundPointermove);

    if (this.contextmenuHandler) {
      this.scene.game.canvas.removeEventListener('contextmenu', this.contextmenuHandler);
      this.contextmenuHandler = null;
    }

    this.scene.game.canvas.style.cursor = 'default';

    this.selectionHighlight.destroy();
    this.selectionRect.destroy();
  }
}
