import Phaser from 'phaser';
import { MAP_W, MAP_H, TILE_W, TILE_H } from '../config/worldConfig';
import { ASSET_KEYS } from '../assets/assetManifest';
import { TerrainRenderer, generateTerrainMap } from './render/TerrainRenderer';
import { EntityRenderer, getPR1EntityPlacements } from './render/EntityRenderer';
import { CameraControls } from './input/CameraControls';
import { tileToScreen, mapOriginOffset } from './render/isometric';

/**
 * GameScene — orchestration-only scene.
 *
 * PR1 scope:
 * - Render 48×48 isometric sand terrain using real PNG assets
 * - Place HQ, minerals, and one harvester
 * - Camera pan (drag) and zoom (scroll)
 * - HTML HUD placeholder
 *
 * NOT in scope: economy, harvesting, construction, combat, save/load, editor.
 */
export class GameScene extends Phaser.Scene {
  private terrainRenderer: TerrainRenderer | null = null;
  private entityRenderer: EntityRenderer | null = null;
  private cameraControls: CameraControls | null = null;
  private hudCoords: HTMLElement | null = null;
  private hqWorldX: number = 0;
  private hqWorldY: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Verify all required assets are loaded
    this.verifyAssets();

    // Generate terrain map
    const terrainMap = generateTerrainMap();

    // Render terrain to a static RenderTexture
    this.terrainRenderer = new TerrainRenderer(this, terrainMap);

    // Get offset for entity placement
    const offset = mapOriginOffset(MAP_W, MAP_H);

    // Draw isometric grid overlay
    this.drawGridLines(terrainMap, offset);

    // Place entities
    this.entityRenderer = new EntityRenderer(this, offset);
    const placements = getPR1EntityPlacements();
    this.entityRenderer.placeEntities(placements);

    // Setup camera
    this.cameraControls = new CameraControls(this);
    const bounds = this.terrainRenderer.getBounds();
    this.cameraControls.setBounds(bounds);

    // Center camera on HQ position and store for reset hotkey
    const hqScreen = tileToScreen(24, 24);
    this.hqWorldX = hqScreen.x + offset.x;
    this.hqWorldY = hqScreen.y + offset.y;
    this.cameraControls.centerOn(this.hqWorldX, this.hqWorldY);

    // Wire R key to reset camera back to HQ
    this.cameraControls.bindResetKey('R', this.hqWorldX, this.hqWorldY);

    // HUD reference
    this.hudCoords = document.getElementById('hud-coords');

    // Set world background color
    this.cameras.main.setBackgroundColor('#1a1a2e');

    console.log('[GameScene] Static scene ready. Drag: pan | Wheel: zoom | R: reset camera');
  }

  update(): void {
    // Update HUD with camera info
    if (this.cameraControls && this.hudCoords) {
      const info = this.cameraControls.getCameraInfo();
      this.hudCoords.textContent =
        `Zoom: ${info.zoom.toFixed(2)} | Scroll: (${Math.round(info.scrollX)}, ${Math.round(info.scrollY)})`;
    }
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

  private drawGridLines(
    terrainMap: string[][],
    offset: { x: number; y: number },
  ): void {
    const graphics = this.add.graphics();
    graphics.setDefaultStyles({
      lineStyle: { width: 0.5, color: 0x4a4a6a, alpha: 0.4 },
    });

    // Draw diamond outlines for each tile
    for (let ty = 0; ty < terrainMap.length; ty++) {
      for (let tx = 0; tx < terrainMap[ty].length; tx++) {
        const screenPos = tileToScreen(tx, ty);
        const cx = screenPos.x + offset.x;
        const cy = screenPos.y + offset.y;
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;

        graphics.beginPath();
        graphics.moveTo(cx, cy - hh);     // top
        graphics.lineTo(cx + hw, cy);      // right
        graphics.lineTo(cx, cy + hh);      // bottom
        graphics.lineTo(cx - hw, cy);      // left
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
