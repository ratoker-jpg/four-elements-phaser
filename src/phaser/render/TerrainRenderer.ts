import Phaser from 'phaser';
import { MAP_W, MAP_H, TILE_W, TILE_H } from '../../config/gameConfig';
import { ASSET_KEYS } from '../../assets/assetManifest';
import { tileToScreen, mapOriginOffset, IsoPoint } from './isometric';

/**
 * Terrain types used in PR1.
 * Only 'sand', 'sand-dark', 'sand-light' — the three legacy types
 * that the donor game's active render path uses.
 */
export type TerrainType = 'sand' | 'sand-dark' | 'sand-light';

const TERRAIN_KEY_MAP: Record<TerrainType, string> = {
  sand: ASSET_KEYS.TERRAIN_SAND,
  'sand-dark': ASSET_KEYS.TERRAIN_SAND_DARK,
  'sand-light': ASSET_KEYS.TERRAIN_SAND_LIGHT,
};

/**
 * Generate a simple PR1 terrain map.
 * Mostly sand with some dark and light patches for visual variety.
 */
export function generateTerrainMap(): TerrainType[][] {
  const map: TerrainType[][] = [];
  for (let ty = 0; ty < MAP_H; ty++) {
    const row: TerrainType[] = [];
    for (let tx = 0; tx < MAP_W; tx++) {
      // Deterministic pattern: some dark/light patches
      const hash = ((tx * 7 + ty * 13) >>> 0) % 100;
      if (hash < 10) {
        row.push('sand-dark');
      } else if (hash < 18) {
        row.push('sand-light');
      } else {
        row.push('sand');
      }
    }
    map.push(row);
  }
  return map;
}

/**
 * TerrainRenderer — renders the full isometric terrain onto a RenderTexture.
 *
 * Strategy (matches donor game's active render path):
 * 1. For each cell, stamp the appropriate sand_tile PNG scaled to TILE_W×TILE_H.
 * 2. Draw isometric grid lines on top.
 *
 * The result is a single RenderTexture that can be scrolled by the camera.
 */
export class TerrainRenderer {
  private renderTexture: Phaser.GameObjects.RenderTexture;
  private offset: IsoPoint;

  /** Total pixel dimensions of the rendered map. */
  private mapPixelW: number;
  private mapPixelH: number;

  constructor(scene: Phaser.Scene, terrainMap: TerrainType[][]) {
    this.offset = mapOriginOffset(MAP_W, MAP_H);

    // Calculate total render area
    // Rightmost tile is (MAP_W-1, 0), leftmost is (0, MAP_H-1)
    // Bottom tile is (MAP_W-1, MAP_H-1)
    const topRight = tileToScreen(MAP_W - 1, 0);
    const bottomLeft = tileToScreen(0, MAP_H - 1);
    const bottomCenter = tileToScreen(MAP_W - 1, MAP_H - 1);

    this.mapPixelW = topRight.x - bottomLeft.x + TILE_W + 128;
    this.mapPixelH = bottomCenter.y + TILE_H + 128;

    // Create the RenderTexture
    this.renderTexture = scene.add.renderTexture(
      this.offset.x,
      this.offset.y,
      Math.ceil(this.mapPixelW),
      Math.ceil(this.mapPixelH),
    );
    this.renderTexture.setOrigin(0, 0);
    this.renderTexture.setDepth(0);

    // Render all terrain tiles
    this.renderTerrainTiles(scene, terrainMap);

    // Render grid lines
    this.renderGridLines(terrainMap);

    // The RenderTexture is now a static image — camera scrolls over it.
  }

  private renderTerrainTiles(
    scene: Phaser.Scene,
    terrainMap: TerrainType[][],
  ): void {
    // Create a temporary Image as a stamp, reuse it for each tile
    const stamp = scene.add.image(0, 0, ASSET_KEYS.TERRAIN_SAND);
    stamp.setVisible(false);
    stamp.setOrigin(0.5, 0.5);

    for (let ty = 0; ty < terrainMap.length; ty++) {
      for (let tx = 0; tx < terrainMap[ty].length; tx++) {
        const terrainType = terrainMap[ty][tx];
        const assetKey = TERRAIN_KEY_MAP[terrainType];
        const screenPos = tileToScreen(tx, ty);

        // Position relative to the RenderTexture's local coords
        // (account for the offset baked into the RT position)
        const localX = screenPos.x;
        const localY = screenPos.y;

        // Switch the stamp's texture
        stamp.setTexture(assetKey);

        // Scale the large tile image to fit the isometric cell
        // Original images are ~1180×741; we need them at 76×38
        const scaleX = 76 / stamp.width;
        const scaleY = 38 / stamp.height;
        stamp.setScale(scaleX, scaleY);

        // Draw onto the RenderTexture
        this.renderTexture.draw(stamp, localX, localY);
      }
    }

    // Clean up the stamp
    stamp.destroy();
  }

  private renderGridLines(_terrainMap: TerrainType[][]): void {
    // Grid lines are drawn by GameScene as a Graphics overlay.
    // This method is a placeholder for future RT-based grid rendering.
  }

  /** Get the world-space bounds of the terrain for camera limits. */
  getBounds(): Phaser.Geom.Rectangle {
    const leftTop = tileToScreen(0, 0);
    const rightTop = tileToScreen(MAP_W - 1, 0);
    const leftBottom = tileToScreen(0, MAP_H - 1);
    const bottomCenter = tileToScreen(MAP_W - 1, MAP_H - 1);

    return new Phaser.Geom.Rectangle(
      leftBottom.x + this.offset.x - TILE_W,
      leftTop.y + this.offset.y - TILE_H,
      rightTop.x - leftBottom.x + TILE_W * 2,
      bottomCenter.y - leftTop.y + TILE_H * 2,
    );
  }

  getOffset(): IsoPoint {
    return this.offset;
  }

  destroy(): void {
    this.renderTexture.destroy();
  }
}
