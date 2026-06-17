/**
 * RenderManager — VEHICLE-RENDER-UNIFY-04-VH Stage 4.
 *
 * Owns all render orchestration previously in GameScene:
 *   - renderer field ownership;
 *   - construction order (create());
 *   - per-frame sync order (syncFromState());
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
 * RenderManager.syncFromState() after all gameplay updates are done.
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
 * calls syncFromState() each frame after gameplay updates, and
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

  /**
   * Sync all renderers from game state.
   * Called once per frame from GameScene.update() AFTER all gameplay
   * updates (civil loop, blockout movement, AI, combat) are done.
   *
   * Preserves exact sync order from original GameScene.update().
   */
  syncFromState(state: GameState, timeNow: number, delta: number, opts: {
    devtoolsActive: boolean;
    arenaMode: boolean;
    blockoutVehicleInputController?: {
      update: (delta: number) => void;
      hoveredVehicleId: string | null;
      selectedVehicleId: string | null;
    };
  }): void {
    // 1. Entity renderer
    this.entityRenderer?.syncFromState(state);

    // 2. Building status renderer
    this.buildingStatusRenderer?.syncFromState(state);

    // 3. Devtools panel update (handled by GameScene — it owns DevtoolsPanel)

    // 4. Debug overlay renderer
    this.debugOverlayRenderer?.syncFromState(state);

    // 5. Feedback renderer
    this.feedbackRenderer?.syncFromState(state, timeNow);

    // 6. Motion FX renderer
    this.motionFxRenderer?.syncFromState(state, timeNow);

    // 7. Asset preview tool update
    this.assetPreviewTool?.update();

    // 8. Blockout vehicle input controller update + hover/target sync
    if (opts.blockoutVehicleInputController && opts.devtoolsActive) {
      opts.blockoutVehicleInputController.update(delta);
      if (this.blockoutVehicleRenderer) {
        this.blockoutVehicleRenderer.setHoveredVehicleId(opts.blockoutVehicleInputController.hoveredVehicleId);
        if (opts.arenaMode) {
          const selectedId = opts.blockoutVehicleInputController.selectedVehicleId;
          const vehicles = state.blockoutVehicles;
          const selected = selectedId ? vehicles?.find(v => v.id === selectedId) : null;
          this.blockoutVehicleRenderer.setTargetedVehicleId(selected?.targetVehicleId ?? null);
        } else {
          this.blockoutVehicleRenderer.setTargetedVehicleId(null);
        }
      }
    }

    // 9. Blockout vehicle renderer sync
    if (this.blockoutVehicleRenderer && state.blockoutVehicles) {
      this.blockoutVehicleRenderer.syncFromState(state.blockoutVehicles);
    }

    // 10. Blockout weapon VFX sync
    if (this.blockoutWeaponVfxRenderer && opts.devtoolsActive) {
      this.blockoutWeaponVfxRenderer.syncFromState(timeNow);
    }

    // 11. Blockout damage renderer sync
    if (this.blockoutDamageRenderer && opts.devtoolsActive && state.blockoutVehicles) {
      this.blockoutDamageRenderer.syncFromState(timeNow, state.blockoutVehicles);
    }

    // 12. Blockout obstacle renderer sync
    if (this.blockoutObstacleRenderer && opts.devtoolsActive && state.blockoutObstacles) {
      this.blockoutObstacleRenderer.syncFromState(state.blockoutObstacles);
    }

    // 13. Blockout upgrade renderer sync
    if (this.blockoutUpgradeRenderer && opts.devtoolsActive && state.blockoutVehicles) {
      this.blockoutUpgradeRenderer.syncFromState(state.blockoutVehicles, opts.blockoutVehicleInputController?.selectedVehicleId ?? null);
    }

    // 14. Blockout sandbox HUD sync
    if (this.blockoutSandboxHudRenderer && opts.devtoolsActive) {
      if (opts.arenaMode) {
        const selectedId = opts.blockoutVehicleInputController?.selectedVehicleId ?? null;
        const selected = selectedId ? state.blockoutVehicles?.find(v => v.id === selectedId) : null;
        const targetId = selected?.targetVehicleId ?? null;
        this.blockoutSandboxHudRenderer.syncFromStateArena(
          state.blockoutVehicles,
          selectedId,
          targetId,
          timeNow,
        );
      } else {
        this.blockoutSandboxHudRenderer.syncFromState(
          state.blockoutVehicles,
          opts.blockoutVehicleInputController?.selectedVehicleId ?? null,
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
   * Destroy all renderers in the exact same reverse order as the original GameScene.shutdown().
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
