import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets/assetManifest';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EntityRenderer } from './render/EntityRenderer';
import { CameraControls } from './input/CameraControls';
import { tileToScreen, mapOriginOffset } from './render/isometric';
import { createInitialState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';
import { placeConstructionSite, updateConstructionSiteProgress, BUILDING_CONFIG } from '../state/construction';
import { findBuildSiteNearPlayerBuildings } from '../state/buildSiteSelection';
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

export class GameScene extends Phaser.Scene {
  private terrainRenderer: TerrainRenderer | null = null;
  private entityRenderer: EntityRenderer | null = null;
  private cameraControls: CameraControls | null = null;
  private gameState!: GameState;
  private hqWorldX: number = 0;
  private hqWorldY: number = 0;

  // HUD elements
  private hudCoords: HTMLElement | null = null;
  private hudMapName: HTMLElement | null = null;
  private hudEconomy: HTMLElement | null = null;
  private hudBuild: HTMLElement | null = null;
  private hudBuilder: HTMLElement | null = null;

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
    const offset = mapOriginOffset(this.gameState.mapWidth, this.gameState.mapHeight);

    // Draw isometric grid overlay
    this.drawGridLines(offset);

    // Render entities — static first, then dynamic
    this.entityRenderer = new EntityRenderer(this, offset);
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

    // ── Building dev tuner (9) ──────────────────────────────────────
    this.input.keyboard?.on('keydown-Digit9', () => {
      const result = this.entityRenderer?.toggleBuildingDevTuner();
      if (result !== null && result !== undefined) {
        console.log(`[GameScene] Building dev tuner: ${result ? 'ON' : 'OFF'}`);
      }
    });

    // Building tuner keyboard controls (arrow, bracket, O/P, C)
    // These must be checked before the existing modular tank arrow handler
    // to avoid double-processing.
    const buildingTunerHandler = (event: KeyboardEvent) => {
      if (!this.entityRenderer?.isBuildingDevTunerActive()) return;
      const consumed = this.entityRenderer.handleBuildingDevTunerKey(event);
      if (consumed) {
        event.stopPropagation(); // prevent modular tank arrow handler from also processing
      }
    };
    this.input.keyboard?.on('keydown', buildingTunerHandler as (event: KeyboardEvent) => void);

    // ── Debug build hotkey (B) — auto-place Separator construction site ──
    this.input.keyboard?.on('keydown-B', () => {
      // ARCH-13F1: B-press guard — do not create a site if no idle builder is available.
      const hasIdleBuilder = this.gameState.mapData.builders.some(b => b.phase === 'idle' && !b.busy);
      if (!hasIdleBuilder) {
        console.warn('[GameScene] B pressed but no idle builder available — site not created.');
        return;
      }

      // ARCH-13F1: Debug resource top-up with explicit [DEBUG] logging.
      if (this.gameState.rawMinerals < 150) {
        const prev = this.gameState.rawMinerals;
        this.gameState.rawMinerals = 150;
        console.log(`[DEBUG] Resource top-up: ${prev} -> 150 rawMinerals`);
      }

      // ARCH-13E4: Automatic build-site selection.
      // The system finds a valid 2x2 location near player buildings
      // with a 1-tile gap around existing footprints.
      const site = findBuildSiteNearPlayerBuildings(this.gameState, 'separator');
      if (!site.ok) {
        console.warn(`[GameScene] No valid build site found: ${site.reason}`);
        return;
      }

      const result = placeConstructionSite(this.gameState, 'separator', site.tx, site.ty);
      if (result.ok) {
        console.log(`[GameScene] Construction site placed: ${result.siteId} at (${site.tx},${site.ty})`);
      } else {
        console.warn(`[GameScene] Placement failed at (${site.tx},${site.ty}): ${result.reason}`);
      }
    });

    // HUD references
    this.hudCoords = document.getElementById('hud-coords');
    this.hudMapName = document.getElementById('hud-map-name');
    this.hudEconomy = document.getElementById('hud-economy');
    this.hudBuild = document.getElementById('hud-build');
    this.hudBuilder = document.getElementById('hud-builder');

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
      `Drag: pan | Wheel: zoom | R: reset camera | T: debug overlay | B: build separator | Q/E: body dir | Z/X: turret dir | 9: building tuner`,
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

    // ARCH-13F1: Build status line
    if (this.hudBuild) {
      const sites = this.gameState.mapData.constructionSites;
      if (sites.length === 0) {
        this.hudBuild.textContent = 'Build: none';
      } else {
        // Show the first active construction site
        const site = sites[0];
        const config = BUILDING_CONFIG[site.type];
        const label = config ? 'Separator' : site.type;
        const pct = Math.round(site.progress * 100);
        if (site.pending) {
          this.hudBuild.textContent = `Build: ${label} at (${site.tx},${site.ty}), waiting for builder`;
        } else {
          this.hudBuild.textContent = `Build: ${label} at (${site.tx},${site.ty}), ${pct}%`;
        }
      }

      // If no idle builder and B is pressed, show warning
      const hasIdleBuilder = this.gameState.mapData.builders.some(b => b.phase === 'idle' && !b.busy);
      if (!hasIdleBuilder && sites.length === 0) {
        // Only show "no valid site" when there are no active sites AND no idle builder
        // (the B-press guard prevents creation, so this hints at the reason)
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
    this.cameraControls?.destroy();
    this.entityRenderer?.destroy();
    this.terrainRenderer?.destroy();
  }
}
