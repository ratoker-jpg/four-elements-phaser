import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets/assetManifest';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EntityRenderer } from './render/EntityRenderer';
import { CameraControls } from './input/CameraControls';
import { tileToScreen, worldToTile, mapOriginOffset, type IsoPoint } from './render/isometric';
import { createInitialState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';
import {
  BUILDING_CONFIG,
  canPlaceBuilding,
  placeConstructionSite,
  updateConstructionSiteProgress,
} from '../state/construction';
import { assignIdleBuilders, updateBuilders } from '../state/builder';
import type { GameState, HarvesterPhase } from '../state/types';
import {
  MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR,
  MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR,
  tunerState,
  type ModularTankDirection,
} from '../config/worldConfig';

/**
 * GameScene — orchestration-only scene.
 *
 * PR3: Drives the harvester civil loop via updateGameState().
 * GameScene calls state update + renderer sync + HUD update only.
 * No game logic lives here.
 *
 * PR7: Q/E cycles bodyDir, Z/X cycles turretDir.
 * Arrow tuning targets current bodyDir entry in the offset tables.
 */

/** Phase labels for HUD display. */
const PHASE_LABEL: Record<HarvesterPhase, string> = {
  idle: 'Idle',
  'moving-to-resource': 'Moving',
  gathering: 'Gathering',
  'returning-to-hq': 'Returning',
  unloading: 'Unloading',
};

const PREVIEW_VALID_FILL = 0x44aa44;
const PREVIEW_VALID_LINE = 0xffcc55;
const PREVIEW_INVALID_FILL = 0xcc4444;
const PREVIEW_INVALID_LINE = 0xff6666;
const PREVIEW_FILL_ALPHA = 0.28;
const PREVIEW_LINE_ALPHA = 0.95;
const PREVIEW_HW = 76 / 2;
const PREVIEW_HH = 38 / 2;
const PREVIEW_DEPTH = 80;

interface PlacementModeState {
  active: boolean;
  hoverTx: number;
  hoverTy: number;
}

export class GameScene extends Phaser.Scene {
  private terrainRenderer: TerrainRenderer | null = null;
  private entityRenderer: EntityRenderer | null = null;
  private cameraControls: CameraControls | null = null;
  private gameState!: GameState;
  private mapOffset!: IsoPoint;
  private hqWorldX: number = 0;
  private hqWorldY: number = 0;
  private placementPreview: Phaser.GameObjects.Graphics | null = null;
  private placementMode: PlacementModeState = {
    active: false,
    hoverTx: 0,
    hoverTy: 0,
  };

  // HUD elements
  private hudCoords: HTMLElement | null = null;
  private hudMapName: HTMLElement | null = null;
  private hudEconomy: HTMLElement | null = null;

  /** Track last unload count to log once per unload. */
  private lastLoggedMinerals: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Initialize game state from saved map
    this.gameState = createInitialState();

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
    this.mapOffset = mapOriginOffset(this.gameState.mapWidth, this.gameState.mapHeight);

    // Draw isometric grid overlay
    this.drawGridLines(this.mapOffset);

    // Render entities — static first, then dynamic
    this.entityRenderer = new EntityRenderer(this, this.mapOffset);
    this.entityRenderer.renderStaticEntities(this.gameState.entities);
    this.entityRenderer.renderDynamicInit(
      this.gameState.harvesters,
      this.gameState.resourceNodes,
    );

    // Setup camera
    this.cameraControls = new CameraControls(this);
    const bounds = this.terrainRenderer.getBounds();
    this.cameraControls.setBounds(bounds);

    // Center camera on HQ from state (HQ has 3x3 footprint, center on +1,+1)
    const hq = this.gameState.mapData.hq;
    const hqCenterTx = hq.tx + 1;
    const hqCenterTy = hq.ty + 1;
    const hqScreen = tileToScreen(hqCenterTx, hqCenterTy);
    this.hqWorldX = hqScreen.x + this.mapOffset.x;
    this.hqWorldY = hqScreen.y + this.mapOffset.y;
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

    // ── Debug build hotkey (B) — place Separator construction site ──
    this.placementPreview = this.add.graphics();
    this.placementPreview.setDepth(PREVIEW_DEPTH);
    this.placementPreview.setVisible(false);

    this.input.keyboard?.on('keydown-B', () => {
      if (this.placementMode.active) {
        this.cancelPlacementMode('toggled-off');
        return;
      }

      this.enterPlacementMode();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.placementMode.active) return;
      this.cancelPlacementMode('escape');
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.placementMode.active) return;
      this.updatePlacementHover(pointer);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.placementMode.active) return;
      if (pointer.rightButtonDown()) return;
      if (pointer.button !== 0) return;
      this.tryPlaceAtPointer(pointer);
    });

    // HUD references
    this.hudCoords = document.getElementById('hud-coords');
    this.hudMapName = document.getElementById('hud-map-name');
    this.hudEconomy = document.getElementById('hud-economy');

    // Set initial HUD content
    if (this.hudMapName) {
      this.hudMapName.textContent = `Map: ${this.gameState.mapName}`;
    }

    // Set world background color
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Log state summary
    const s = this.gameState;
    console.log(
      `[GameScene] State-driven scene ready. Map: ${s.mapName} | ` +
      `Size: ${s.mapWidth}x${s.mapHeight} | ` +
      `Harvesters: ${s.harvesters.length} | ` +
      `Resources: ${s.resourceNodes.length} | ` +
      `Drag: pan | Wheel: zoom | R: reset camera | T: debug overlay | B: toggle separator placement | Esc: cancel placement | Q/E: body dir | Z/X: turret dir`,
    );
  }

  update(_time: number, delta: number): void {
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

    // 6. Update HUD
    this.updateHUD();

    // 7. Debug log on unload completion
    if (this.gameState.rawMinerals > this.lastLoggedMinerals) {
      console.log(
        `[GameScene] Unloaded! Raw minerals: ${this.gameState.rawMinerals}`,
      );
      this.lastLoggedMinerals = this.gameState.rawMinerals;
    }

    if (this.placementMode.active) {
      this.redrawPlacementPreview();
    }
  }

  // ─── HUD ────────────────────────────────────────────────────────

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

      this.hudEconomy.textContent =
        `Raw: ${s.rawMinerals} | Resources: ${activeResources}/${totalResources} | ` +
        `Sites: ${s.mapData.constructionSites.length} | ` +
        `Harvesters: ${s.harvesters.length} (${phaseStr})`;
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

  private enterPlacementMode(): void {
    this.ensureDebugPlacementResources();

    const config = BUILDING_CONFIG.separator;
    if (!config) return;

    const hq = this.gameState.mapData.hq;
    this.placementMode = {
      active: true,
      hoverTx: Math.min(hq.tx + 4, this.gameState.mapWidth - config.footprintW),
      hoverTy: Math.max(0, hq.ty - 1),
    };

    this.updatePlacementHover(this.input.activePointer);
    console.log('[GameScene] Separator placement mode enabled (temporary debug resource grant may apply for QA).');
  }

  private cancelPlacementMode(reason: 'toggled-off' | 'escape' | 'placed'): void {
    this.placementMode.active = false;
    this.placementPreview?.clear();
    this.placementPreview?.setVisible(false);
    console.log(`[GameScene] Separator placement mode exited: ${reason}`);
  }

  private ensureDebugPlacementResources(): void {
    const config = BUILDING_CONFIG.separator;
    if (!config) return;

    if (this.gameState.rawMinerals < config.costRaw) {
      this.gameState.rawMinerals = config.costRaw;
      console.log('[GameScene] Debug grant applied: raw minerals topped up to Separator cost.');
    }
  }

  private updatePlacementHover(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tilePoint = worldToTile(worldPoint.x, worldPoint.y, this.mapOffset);
    this.placementMode.hoverTx = Math.floor(tilePoint.x);
    this.placementMode.hoverTy = Math.floor(tilePoint.y);
    this.redrawPlacementPreview();
  }

  private tryPlaceAtPointer(pointer: Phaser.Input.Pointer): void {
    this.ensureDebugPlacementResources();
    this.updatePlacementHover(pointer);

    const { hoverTx, hoverTy } = this.placementMode;
    const validation = canPlaceBuilding(this.gameState, 'separator', hoverTx, hoverTy);
    if (!validation.valid) {
      console.warn(`[GameScene] Placement failed at (${hoverTx},${hoverTy}): ${validation.reason}`);
      return;
    }

    const result = placeConstructionSite(this.gameState, 'separator', hoverTx, hoverTy);
    if (!result.ok) {
      console.warn(`[GameScene] Placement failed at (${hoverTx},${hoverTy}): ${result.reason}`);
      return;
    }

    console.log(`[GameScene] Construction site placed: ${result.siteId} at (${hoverTx},${hoverTy})`);
    this.cancelPlacementMode('placed');
  }

  private redrawPlacementPreview(): void {
    if (!this.placementPreview) return;

    if (!this.placementMode.active) {
      this.placementPreview.clear();
      this.placementPreview.setVisible(false);
      return;
    }

    const config = BUILDING_CONFIG.separator;
    if (!config) return;

    const { hoverTx, hoverTy } = this.placementMode;
    const validation = canPlaceBuilding(this.gameState, 'separator', hoverTx, hoverTy);
    const fillColor = validation.valid ? PREVIEW_VALID_FILL : PREVIEW_INVALID_FILL;
    const lineColor = validation.valid ? PREVIEW_VALID_LINE : PREVIEW_INVALID_LINE;

    this.placementPreview.clear();
    this.placementPreview.setVisible(true);

    for (let dy = 0; dy < config.footprintH; dy++) {
      for (let dx = 0; dx < config.footprintW; dx++) {
        const screenPos = tileToScreen(hoverTx + dx, hoverTy + dy);
        const cx = screenPos.x + this.mapOffset.x;
        const cy = screenPos.y + this.mapOffset.y;

        this.placementPreview.fillStyle(fillColor, PREVIEW_FILL_ALPHA);
        this.placementPreview.beginPath();
        this.placementPreview.moveTo(cx, cy - PREVIEW_HH);
        this.placementPreview.lineTo(cx + PREVIEW_HW, cy);
        this.placementPreview.lineTo(cx, cy + PREVIEW_HH);
        this.placementPreview.lineTo(cx - PREVIEW_HW, cy);
        this.placementPreview.closePath();
        this.placementPreview.fillPath();

        this.placementPreview.lineStyle(1.5, lineColor, PREVIEW_LINE_ALPHA);
        this.placementPreview.beginPath();
        this.placementPreview.moveTo(cx, cy - PREVIEW_HH);
        this.placementPreview.lineTo(cx + PREVIEW_HW, cy);
        this.placementPreview.lineTo(cx, cy + PREVIEW_HH);
        this.placementPreview.lineTo(cx - PREVIEW_HW, cy);
        this.placementPreview.closePath();
        this.placementPreview.strokePath();
      }
    }
  }

  private drawGridLines(offset: { x: number; y: number }): void {
    const graphics = this.add.graphics();
    graphics.setDefaultStyles({
      lineStyle: { width: 0.5, color: 0x4a4a6a, alpha: 0.4 },
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
    this.placementPreview?.destroy();
    this.cameraControls?.destroy();
    this.entityRenderer?.destroy();
    this.terrainRenderer?.destroy();
  }
}
