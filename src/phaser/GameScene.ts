import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets/assetManifest';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EntityRenderer } from './render/EntityRenderer';
import { CameraControls } from './input/CameraControls';
import { tileToScreen, mapOriginOffset } from './render/isometric';
import { createInitialState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';
import type { GameState, HarvesterPhase } from '../state/types';

/**
 * GameScene — orchestration-only scene.
 *
 * PR3: Drives the harvester civil loop via updateGameState().
 * GameScene calls state update + renderer sync + HUD update only.
 * No game logic lives here.
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
    this.input.keyboard?.on('keydown-T', () => {
      const visible = this.entityRenderer?.toggleModularTankDebug();
      if (visible !== undefined) {
        console.log(`[GameScene] Modular tank debug overlay: ${visible ? 'ON' : 'OFF'}`);
      }
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
      `Drag: pan | Wheel: zoom | R: reset camera`,
    );
  }

  update(_time: number, delta: number): void {
    // 1. Advance game state
    updateGameState(this.gameState, delta);

    // 2. Sync render layer
    this.entityRenderer?.syncFromState(this.gameState);

    // 3. Update HUD
    this.updateHUD();

    // 4. Debug log on unload completion
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
