/**
 * RenderManager — VEHICLE-RENDER-UNIFY-04-VH Stage 4.
 *
 * Owns all render orchestration previously in GameScene:
 *   - renderer field ownership;
 *   - construction order (create());
 *   - per-frame sync order (syncCivilRenderState / syncBlockoutInputVisualState / syncBlockoutRenderState);
 *   - selected/hovered/targeted visual state sync;
 *   - destroy/shutdown order.
 *
 * GameScene retains:
 *   - scene lifecycle (init/create/update/shutdown);
 *   - gameState ownership;
 *   - gameplay system updates (civil loop, blockout movement, AI, combat);
 *   - input controllers;
 *   - camera controls;
 *   - UI panels (PlaytestHud, ArenaMenu, PauseMenu, DevtoolsPanel);
 *   - placement handlers;
 *   - save/load hooks.
 *
 * Design principle: RenderManager does NOT call gameplay logic.
 * It only syncs render state from GameState. GameScene calls
 * RenderManager phase methods after all gameplay updates are done.
 *
 * Lifecycle order is preserved exactly from the original GameScene.
 */

import Phaser from 'phaser';
import type { GameState } from '../../state/types';
import type { IsoPoint } from './isometric';
import type { MapStyle } from '../../state/gameSetup';
import type { ResourceStyle } from '../../state/gameSetup';

import { TerrainRenderer } from './TerrainRenderer';
import { IndustrialFrameRenderer } from './IndustrialFrameRenderer';
import { EntityRenderer } from './EntityRenderer';
import { BuildingStatusRenderer } from './BuildingStatusRenderer';
import { FeedbackRenderer } from './FeedbackRenderer';
import { UnitMotionFxRenderer } from './UnitMotionFxRenderer';
import { DebugOverlayRenderer } from './DebugOverlayRenderer';
import { BlockoutVehicleRenderer } from './BlockoutVehicleRenderer';
import { BlockoutWeaponVfxRenderer } from './BlockoutWeaponVfxRenderer';
import { BlockoutDamageRenderer } from './BlockoutDamageRenderer';
import { BlockoutObstacleRenderer } from './BlockoutObstacleRenderer';
import { BlockoutUpgradeRenderer } from './BlockoutUpgradeRenderer';
import { BlockoutSandboxHudRenderer } from './BlockoutSandboxHudRenderer';
import { CameraProjectionDebugRenderer } from './CameraProjectionDebugRenderer';
import { GeneratedModularVehicleRenderer } from './GeneratedModularVehicleRenderer';

import { AssetPreviewTool } from '../dev/AssetPreviewTool';
import { AssetPreviewPanel } from '../dev/AssetPreviewPanel';
import { ModularVehicleDevtoolsPanel } from '../dev/ModularVehicleDevtoolsPanel';

import type { ArenaModeContext } from '../../state/arenaModeContext';
import { debugRenderFlags } from '../../config/debugRenderFlags';

/**
 * Options passed to RenderManager.create().
 * These are the values GameScene computes during init/create that
 * RenderManager needs to construct the appropriate renderers.
 */
export interface RenderManagerCreateOptions {
  offset: IsoPoint;
  mapStyle: MapStyle;
  resourceStyle: ResourceStyle;
  devtoolsActive: boolean;
  arenaMode: boolean;
  arenaCtx: ArenaModeContext;
  /** Callbacks for devtools panel inter-renderer wiring. */
  onClearModularVehicleRender?: () => void;
  onActivateModularVehicleRender?: () => void;
  /** Callback for asset preview tool state change. */
  onAssetPreviewStateChange?: () => void;
  /** Callback for modular devtools panel state change. */
  onModularDevtoolsStateChange?: () => void;
  /** Callback for blockout vehicle selection changed. */
  onSelectionChanged?: (selectedId: string | null) => void;
  /** Callback for blockout vehicle reset scenario. */
  onResetScenario?: () => void;
  /** Callback for blockout sandbox toggle help. */
  onToggleSandboxHelp?: () => void;
  /** Callback for blockout camera calibration toggle. */
  onToggleCalibration?: () => void;
  /** Whether placement is active (suppresses blockout selection). */
  isPlacementActive: () => boolean;
  /** Whether arena mode is active. */
  isArenaMode: () => boolean;
  /** Get game state (for input controller wiring). */
  getGameState: () => GameState;
  /** Get reservation map (for input controller wiring). */
  getReservationMap?: () => { cleanStale: (now: number, maxAge: number) => void } | null;
}

/**
 * RenderManager — owns all renderer fields and their sync lifecycle.
 *
 * Stage 4: extracted from GameScene to reduce its orchestration burden.
 * GameScene creates RenderManager, calls create() with options, then
 * calls phase methods each frame after gameplay updates, and
 * destroy() on shutdown.
 */
export class RenderManager {
  // ─── Renderer fields (moved from GameScene) ──────────────────────

  terrainRenderer: TerrainRenderer | null = null;
  industrialFrameRenderer: IndustrialFrameRenderer | null = null;
  entityRenderer: EntityRenderer | null = null;
  buildingStatusRenderer: BuildingStatusRenderer | null = null;
  feedbackRenderer: FeedbackRenderer | null = null;
  motionFxRenderer: UnitMotionFxRenderer | null = null;
  debugOverlayRenderer: DebugOverlayRenderer | null = null;
  blockoutVehicleRenderer: BlockoutVehicleRenderer | null = null;
  blockoutWeaponVfxRenderer: BlockoutWeaponVfxRenderer | null = null;
  blockoutDamageRenderer: BlockoutDamageRenderer | null = null;
  blockoutObstacleRenderer: BlockoutObstacleRenderer | null = null;
  blockoutUpgradeRenderer: BlockoutUpgradeRenderer | null = null;
  blockoutSandboxHudRenderer: BlockoutSandboxHudRenderer | null = null;
  cameraProjectionDebugRenderer: CameraProjectionDebugRenderer | null = null;
  generatedModularVehicleRenderer: GeneratedModularVehicleRenderer | null = null;
  modularVehicleDevtoolsPanel: ModularVehicleDevtoolsPanel | null = null;
  assetPreviewTool: AssetPreviewTool | null = null;
  assetPreviewPanel: AssetPreviewPanel | null = null;

  private scene: Phaser.Scene;
  private created = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create all renderers in the exact same order as the original GameScene.create().
   * Only creates devtools/Arena renderers when devtoolsActive is true.
   */
  create(state: GameState, opts: RenderManagerCreateOptions): void {
    if (this.created) return;
    this.created = true;

    const { offset, mapStyle, resourceStyle, devtoolsActive, arenaMode } = opts;

    // 1. Terrain renderer
    this.terrainRenderer = new TerrainRenderer(
      this.scene,
      state.mapData.terrain,
      state.mapWidth,
      state.mapHeight,
      mapStyle,
    );

    // 2. Industrial frame renderer (conditional)
    if (mapStyle === 'industrial') {
      this.industrialFrameRenderer = new IndustrialFrameRenderer(
        this.scene,
        state.mapWidth,
        state.mapHeight,
      );
    }

    // 3. Entity renderer
    this.entityRenderer = new EntityRenderer(this.scene, offset, resourceStyle);
    this.entityRenderer.renderStaticEntities(state.entities);
    if (!opts.arenaCtx.arenaMode) {
      this.entityRenderer.renderDynamicInit(state.harvesters, state.resourceNodes);
    }

    // 4. Building status renderer
    this.buildingStatusRenderer = new BuildingStatusRenderer(this.scene, offset);

    // 5. Feedback renderer
    this.feedbackRenderer = new FeedbackRenderer(this.scene, offset);

    // 6. Motion FX renderer
    this.motionFxRenderer = new UnitMotionFxRenderer(this.scene, offset);

    // 7. Debug overlay renderer (devtools-gated)
    if (devtoolsActive) {
      this.debugOverlayRenderer = new DebugOverlayRenderer(this.scene, offset);
    }

    // 8. Asset preview tool/panel (devtools-gated)
    if (devtoolsActive) {
      // Stage 4: direct import — Vite tree-shakes dev-only code in production
      this.assetPreviewTool = new AssetPreviewTool(this.scene, offset);
      this.assetPreviewPanel = new AssetPreviewPanel();
      this.assetPreviewPanel.create({ getTool: () => this.assetPreviewTool });
      this.assetPreviewTool.setOnStateChange(() => this.assetPreviewPanel?.refresh());
    }

    // 9. Generated modular vehicle renderer + devtools panel (devtools-gated)
    if (devtoolsActive) {
      this.generatedModularVehicleRenderer = new GeneratedModularVehicleRenderer(this.scene);
      this.modularVehicleDevtoolsPanel = new ModularVehicleDevtoolsPanel();
      this.modularVehicleDevtoolsPanel.create({
        getRenderer: () => this.generatedModularVehicleRenderer,
        onLiveRenderToggle: (enabled: boolean) => {
          if (!enabled) {
            this.blockoutVehicleRenderer?.clearModularVehicleRender();
            opts.onClearModularVehicleRender?.();
          } else {
            opts.onActivateModularVehicleRender?.();
          }
        },
      });
      this.generatedModularVehicleRenderer.setOnStateChange(
        () => this.modularVehicleDevtoolsPanel?.refresh(),
      );
      this.modularVehicleDevtoolsPanel.show();
    }

    // 10. Blockout vehicle renderers (devtools-gated)
    if (devtoolsActive) {
      this.blockoutVehicleRenderer = new BlockoutVehicleRenderer(this.scene, offset, () => devtoolsActive);
      this.blockoutWeaponVfxRenderer = new BlockoutWeaponVfxRenderer(this.scene, offset);
      this.blockoutDamageRenderer = new BlockoutDamageRenderer(this.scene, offset);
      this.blockoutObstacleRenderer = new BlockoutObstacleRenderer(this.scene, offset);
      this.blockoutUpgradeRenderer = new BlockoutUpgradeRenderer(this.scene, offset);
    }

    // 11. Blockout sandbox HUD + camera projection debug (devtools-gated)
    if (devtoolsActive) {
      this.blockoutSandboxHudRenderer = new BlockoutSandboxHudRenderer(this.scene);
      this.blockoutSandboxHudRenderer.setArenaMode(arenaMode);
      this.cameraProjectionDebugRenderer = new CameraProjectionDebugRenderer(this.scene, offset);
      this.cameraProjectionDebugRenderer.render();
    }
  }

  // FIXUP-2: old syncFromState() replaced with 3 phase methods below.
  /**
   * FIXUP-1: Phase 1 — sync civil render state.
   *
   * Called from GameScene.update() after civil gameplay updates.
   * Owns sync calls for: entity, building, debug overlay, feedback,
   * motion FX, asset preview tool.
   *
   * Preserves exact sync order from original GameScene.update().
   */
  syncCivilRenderState(state: GameState, timeNow: number): void {
    this.entityRenderer?.syncFromState(state);
    this.buildingStatusRenderer?.syncFromState(state);
    this.debugOverlayRenderer?.syncFromState(state);
    this.feedbackRenderer?.syncFromState(state, timeNow);
    this.motionFxRenderer?.syncFromState(state, timeNow);
    this.assetPreviewTool?.update();
  }

  /**
   * FIXUP-1: Phase 2 — sync blockout input visual state.
   *
   * Called from GameScene.update() after blockoutVehicleInputController.update().
   * Owns hover/target visual state sync for blockout vehicle renderer.
   */
  syncBlockoutInputVisualState(
    state: GameState,
    hoveredVehicleId: string | null,
    selectedVehicleId: string | null,
    arenaMode: boolean,
  ): void {
    if (!this.blockoutVehicleRenderer) return;
    this.blockoutVehicleRenderer.setHoveredVehicleId(hoveredVehicleId);
    if (arenaMode) {
      const selected = selectedVehicleId ? state.blockoutVehicles?.find(v => v.id === selectedVehicleId) : null;
      this.blockoutVehicleRenderer.setTargetedVehicleId(selected?.targetVehicleId ?? null);
    } else {
      this.blockoutVehicleRenderer.setTargetedVehicleId(null);
    }
  }

  /**
   * FIXUP-1: Phase 3 — sync blockout render state.
   *
   * Called from GameScene.update() after all blockout gameplay updates
   * (movement, AI, combat, weapon resources).
   * Owns sync calls for: blockout vehicle, weapon VFX, damage, obstacle,
   * upgrade, sandbox HUD.
   *
   * Preserves exact sync order from original GameScene.update().
   */
  syncBlockoutRenderState(
    state: GameState,
    timeNow: number,
    selectedVehicleId: string | null,
    devtoolsActive: boolean,
    arenaMode: boolean,
  ): void {
    if (this.blockoutVehicleRenderer && state.blockoutVehicles) {
      this.blockoutVehicleRenderer.syncFromState(state.blockoutVehicles);
    }
    if (this.blockoutWeaponVfxRenderer && devtoolsActive) {
      this.blockoutWeaponVfxRenderer.syncFromState(timeNow);
    }
    if (this.blockoutDamageRenderer && devtoolsActive && state.blockoutVehicles) {
      this.blockoutDamageRenderer.syncFromState(timeNow, state.blockoutVehicles);
    }
    // ARENA-VISUAL-COMBAT-FIX-01 fixup-4: Gate obstacle geometry behind
    // explicit debugRenderFlags.obstacleGeometry (default false).
    // Default Arena should not show obstacle objects. The combat/blocking
    // system is preserved; only visual rendering is suppressed.
    if (this.blockoutObstacleRenderer && devtoolsActive && state.blockoutObstacles && debugRenderFlags.obstacleGeometry) {
      this.blockoutObstacleRenderer.syncFromState(state.blockoutObstacles);
    } else if (this.blockoutObstacleRenderer && state.blockoutObstacles) {
      // Even when geometry is hidden, clean up stale graphics from any
      // previous frame where the flag was true.
      this.blockoutObstacleRenderer.syncFromState([]);
    }
    if (this.blockoutUpgradeRenderer && devtoolsActive && state.blockoutVehicles) {
      this.blockoutUpgradeRenderer.syncFromState(state.blockoutVehicles, selectedVehicleId);
    }
    if (this.blockoutSandboxHudRenderer && devtoolsActive) {
      if (arenaMode) {
        const selected = selectedVehicleId ? state.blockoutVehicles?.find(v => v.id === selectedVehicleId) : null;
        const targetId = selected?.targetVehicleId ?? null;
        this.blockoutSandboxHudRenderer.syncFromStateArena(
          state.blockoutVehicles,
          selectedVehicleId,
          targetId,
          timeNow,
        );
      } else {
        this.blockoutSandboxHudRenderer.syncFromState(
          state.blockoutVehicles,
          selectedVehicleId,
          timeNow,
        );
      }
    }
  }

  /**
   * Set selected vehicle ID on blockout vehicle renderer.
   * Called from GameScene when selection changes (via input controller callback).
   */
  setSelectedVehicleId(selectedId: string | null): void {
    this.blockoutVehicleRenderer?.setSelectedVehicleId(selectedId);
  }

  /**
   * Get the entity renderer (needed by GameScene for input controller wiring).
   */
  getEntityRenderer(): EntityRenderer | null {
    return this.entityRenderer;
  }

  /**
   * Get the feedback renderer (needed by GameScene for input controller wiring).
   */
  getFeedbackRenderer(): FeedbackRenderer | null {
    return this.feedbackRenderer;
  }

  /**
   * Get the debug overlay renderer (needed by GameScene for devtools panel wiring).
   */
  getDebugOverlayRenderer(): DebugOverlayRenderer | null {
    return this.debugOverlayRenderer;
  }

  /**
   * Get the asset preview tool (needed by GameScene for input controller wiring).
   */
  getAssetPreviewTool(): AssetPreviewTool | null {
    return this.assetPreviewTool;
  }

  /**
   * Get the asset preview panel (needed by GameScene for input controller wiring).
   */
  getAssetPreviewPanel(): AssetPreviewPanel | null {
    return this.assetPreviewPanel;
  }

  /**
   * Get the blockout vehicle renderer (needed by GameScene for modular toggle).
   */
  getBlockoutVehicleRenderer(): BlockoutVehicleRenderer | null {
    return this.blockoutVehicleRenderer;
  }

  /**
   * Get the generated modular vehicle renderer (needed by GameScene for devtools).
   */
  getGeneratedModularVehicleRenderer(): GeneratedModularVehicleRenderer | null {
    return this.generatedModularVehicleRenderer;
  }

  /**
   * Get the modular vehicle devtools panel (needed by GameScene for devtools).
   */
  getModularVehicleDevtoolsPanel(): ModularVehicleDevtoolsPanel | null {
    return this.modularVehicleDevtoolsPanel;
  }

  /**
   * Get the blockout sandbox HUD renderer (needed by GameScene for help toggle).
   */
  getBlockoutSandboxHudRenderer(): BlockoutSandboxHudRenderer | null {
    return this.blockoutSandboxHudRenderer;
  }

  /**
   * Get the camera projection debug renderer (needed by GameScene for calibration toggle).
   */
  getCameraProjectionDebugRenderer(): CameraProjectionDebugRenderer | null {
    return this.cameraProjectionDebugRenderer;
  }

  /**
   * Get the terrain renderer bounds (needed by GameScene for camera setup).
   */
  getTerrainBounds(): Phaser.Geom.Rectangle | null {
    return this.terrainRenderer?.getBounds() ?? null;
  }

  /**
   * Get the industrial frame renderer extended bounds (needed by GameScene for camera setup).
   */
  getIndustrialExtendedBounds(): Phaser.Geom.Rectangle | null {
    return this.industrialFrameRenderer?.getExtendedBounds() ?? null;
  }


  /**
   * FIXUP-2: Toggle sandbox HUD help overlay.
   * Called from GameScene when help hotkey is pressed.
   */
  toggleSandboxHelp(): void {
    this.blockoutSandboxHudRenderer?.toggleHelp();
  }

  /**
   * FIXUP-2: Toggle camera projection debug overlay.
   * Called from GameScene when calibration hotkey is pressed.
   * Returns new visibility state.
   */
  toggleCameraProjectionDebug(): boolean {
    return this.cameraProjectionDebugRenderer?.toggle() ?? false;
  }

  /**
   * Destroy all renderers in the same relative order as the original GameScene.shutdown().
   */
  destroy(): void {
    this.motionFxRenderer?.destroy();
    this.motionFxRenderer = null;
    this.feedbackRenderer?.destroy();
    this.feedbackRenderer = null;
    this.debugOverlayRenderer?.destroy();
    this.debugOverlayRenderer = null;
    this.assetPreviewPanel?.destroy();
    this.assetPreviewPanel = null;
    this.assetPreviewTool?.destroy();
    this.assetPreviewTool = null;
    this.generatedModularVehicleRenderer?.destroy();
    this.generatedModularVehicleRenderer = null;
    this.modularVehicleDevtoolsPanel?.destroy();
    this.modularVehicleDevtoolsPanel = null;
    this.blockoutVehicleRenderer?.destroy();
    this.blockoutVehicleRenderer = null;
    this.blockoutWeaponVfxRenderer?.destroy();
    this.blockoutWeaponVfxRenderer = null;
    this.blockoutDamageRenderer?.destroy();
    this.blockoutDamageRenderer = null;
    this.blockoutObstacleRenderer?.destroy();
    this.blockoutObstacleRenderer = null;
    this.blockoutUpgradeRenderer?.destroy();
    this.blockoutUpgradeRenderer = null;
    this.blockoutSandboxHudRenderer?.destroy();
    this.blockoutSandboxHudRenderer = null;
    this.cameraProjectionDebugRenderer?.destroy();
    this.cameraProjectionDebugRenderer = null;
    this.buildingStatusRenderer?.destroy();
    this.buildingStatusRenderer = null;
    this.entityRenderer?.destroy();
    this.entityRenderer = null;
    this.terrainRenderer?.destroy();
    this.terrainRenderer = null;
    this.industrialFrameRenderer?.destroy();
    this.industrialFrameRenderer = null;
    this.created = false;
  }
}
