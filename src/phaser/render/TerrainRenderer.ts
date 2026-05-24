import Phaser from 'phaser';
import { MAP_W, MAP_H, TILE_W, TILE_H } from '../../config/worldConfig';
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

/** Pre-computed stamp config for terrain tiles (scale to fit iso cell, center origin). */
const TERRAIN_STAMP_CONFIG: Phaser.Types.Textures.StampConfig = {
  scaleX: TILE_W / 1180,
  scaleY: TILE_H / 741,
  originX: 0.5,
  originY: 0.5,
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
 */
export class TerrainRenderer {
  private renderTexture: Phaser.GameObjects.RenderTexture;
  private offset: IsoPoint;

  constructor(scene: Phaser.Scene, terrainMap: TerrainType[][]) {
    this.offset = mapOriginOffset(MAP_W, MAP_H);

    const topLeft = tileToScreen(0, 0);
    const topRight = tileToScreen(MAP_W - 1, 0);
    const bottomLeft = tileToScreen(0, MAP_H - 1);
    const bottomRight = tileToScreen(MAP_W - 1, MAP_H - 1);

    const padding = 64;
    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + this.offset.x - padding;
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + this.offset.y - padding;
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + this.offset.x + TILE_W + padding;
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + this.offset.y + TILE_H + padding;

    const rtWidth = Math.ceil(maxX - minX);
    const rtHeight = Math.ceil(maxY - minY);

    this.renderTexture = scene.add.renderTexture(0, 0, rtWidth, rtHeight);
    this.renderTexture.setOrigin(0, 0);
    this.renderTexture.setDepth(0);

    this.stampTerrainTiles(terrainMap);
    this.renderTexture.render();
  }

  private stampTerrainTiles(terrainMap: TerrainType[][]): void {
    for (let ty = 0; ty < terrainMap.length; ty++) {
      for (let tx = 0; tx < terrainMap[ty].length; tx++) {
        const terrainType = terrainMap[ty][tx];
        const assetKey = TERRAIN_KEY_MAP[terrainType];
        const screenPos = tileToScreen(tx, ty);
        const worldX = screenPos.x + this.offset.x;
        const worldY = screenPos.y + this.offset.y;

        this.renderTexture.stamp(assetKey, undefined, worldX, worldY, TERRAIN_STAMP_CONFIG);
      }
    }
  }

  /** Get the world-space bounds of the terrain for camera limits. */
  getBounds(): Phaser.Geom.Rectangle {
    const topLeft = tileToScreen(0, 0);
    const topRight = tileToScreen(MAP_W - 1, 0);
    const bottomLeft = tileToScreen(0, MAP_H - 1);
    const bottomRight = tileToScreen(MAP_W - 1, MAP_H - 1);

    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + this.offset.x;
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + this.offset.y;
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + this.offset.x;
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + this.offset.y;

    return new Phaser.Geom.Rectangle(
      minX - TILE_W,
      minY - TILE_H,
      maxX - minX + TILE_W * 2,
      maxY - minY + TILE_H * 2,
    );
  }

  getOffset(): IsoPoint {
    return this.offset;
  }

  destroy(): void {
    this.renderTexture.destroy();
  }
}
