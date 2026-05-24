import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../config/worldConfig';
import { ASSET_KEYS } from '../assets/assetManifest';
import { TerrainRenderer } from './render/TerrainRenderer';
import { EntityRenderer } from './render/EntityRenderer';
import { CameraControls } from './input/CameraControls';
import { tileToScreen, mapOriginOffset } from './render/isometric';
import { createInitialState } from '../state/createInitialState';
import type { GameState, Entity } from '../state/types';

/**
 * GameScene — orchestration-only scene.
 *
 * PR2: All scene data comes from GameState (created from saved map).
 * The render layer reads GameState but never mutates it.
 *
 * Rendered from state:
 * - Terrain from GameState.terrain
 * - Entities from GameState.entities
 * - Camera centered on HQ from state
 * - R key resets to HQ from state
 *
 * Intentionally static (no game loop mutations yet):
 * - No economy tick
 * - No harvester movement
 * - No construction
 * - No combat
 */
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
  private hudInfo: HTMLElement | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Initialize game state from saved map
    this.gameState = createInitialState();

    // Verify all required assets are loaded
    this.verifyAssets();

    // Render terrain from GameState
    this.terrainRenderer = new TerrainRenderer(
      this,
      this.gameState.terrain,
      this.gameState.mapWidth,
      this.gameState.mapHeight,
    );

    // Get offset for entity placement
    const offset = mapOriginOffset(this.gameState.mapWidth, this.gameState.mapHeight);

    // Draw isometric grid overlay
    this.drawGridLines(offset);

    // Render entities from GameState
    this.entityRenderer = new EntityRenderer(this, offset);
    this.entityRenderer.renderEntities(this.gameState.entities);

    // Setup camera
    this.cameraControls = new CameraControls(this);
    const bounds = this.terrainRenderer.getBounds();
    this.cameraControls.setBounds(bounds);

    // Find HQ entity from state and center camera on it
    const hq = this.findPlayerHQ();
    if (hq) {
      const hqScreen = tileToScreen(hq.tx, hq.ty);
      this.hqWorldX = hqScreen.x + offset.x;
      this.hqWorldY = hqScreen.y + offset.y;
      this.cameraControls.centerOn(this.hqWorldX, this.hqWorldY);
      this.cameraControls.bindResetKey('R', this.hqWorldX, this.hqWorldY);
    } else {
      // Fallback: center on map center
      const center = tileToScreen(
        Math.floor(this.gameState.mapWidth / 2),
        Math.floor(this.gameState.mapHeight / 2),
      );
      this.hqWorldX = center.x + offset.x;
      this.hqWorldY = center.y + offset.y;
      this.cameraControls.centerOn(this.hqWorldX, this.hqWorldY);
      this.cameraControls.bindResetKey('R', this.hqWorldX, this.hqWorldY);
      console.warn('[GameScene] No HQ found in state — camera centered on map center.');
    }

    // HUD references
    this.hudCoords = document.getElementById('hud-coords');
    this.hudMapName = document.getElementById('hud-map-name');
    this.hudInfo = document.getElementById('hud-info');

    // Set initial HUD content
    if (this.hudMapName) {
      this.hudMapName.textContent = `Map: ${this.gameState.mapName}`;
    }

    // Set world background color
    this.cameras.main.setBackgroundColor('#1a1a2e');

    console.log(
      `[GameScene] State-driven scene ready. Map: ${this.gameState.mapName} | ` +
      `Entities: ${this.gameState.entities.length} | ` +
      `Drag: pan | Wheel: zoom | R: reset camera`,
    );
  }

  update(): void {
    // Update HUD with camera info
    if (this.cameraControls && this.hudCoords) {
      const info = this.cameraControls.getCameraInfo();
      this.hudCoords.textContent =
        `Zoom: ${info.zoom.toFixed(2)} | (${Math.round(info.scrollX)}, ${Math.round(info.scrollY)})`;
    }

    // Update entity/resource counts
    if (this.hudInfo) {
      const counts = EntityRenderer.countByKind(this.gameState.entities);
      const unitCount = counts.builder + counts.harvester;
      this.hudInfo.textContent = `Resources: ${counts.resource} | Units: ${unitCount}`;
    }
  }

  /** Find the player's HQ entity from GameState. */
  private findPlayerHQ(): Entity | undefined {
    return this.gameState.entities.find(
      (e) => e.kind === 'hq' && e.faction === this.gameState.playerFaction,
    );
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
      lineStyle: { width: 0.5, color: 0x4a4a6a, alpha: 0.4 },
    });

    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

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
