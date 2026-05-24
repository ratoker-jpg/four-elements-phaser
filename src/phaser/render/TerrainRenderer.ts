import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../../config/worldConfig';
import { ASSET_KEYS } from '../../assets/assetManifest';
import { tileToScreen, mapOriginOffset, IsoPoint } from './isometric';
import type { TerrainType } from '../../state/types';

/**
 * Asset key mapping for each terrain type.
 * Only the 3 legacy tiles used by the donor game's active render path.
 */
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
 * TerrainRenderer — renders the full isometric terrain onto a RenderTexture.
 *
 * Receives terrain data from GameState (not hardcoded).
 * Creates a static RenderTexture that the camera scrolls over.
 */
export class TerrainRenderer {
  private renderTexture: Phaser.GameObjects.RenderTexture;
  private offset: IsoPoint;
  private mapWidth: number;
  private mapHeight: number;

  constructor(
    scene: Phaser.Scene,
    terrainMap: TerrainType[][],
    mapWidth: number,
    mapHeight: number,
  ) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.offset = mapOriginOffset(mapWidth, mapHeight);

    const topLeft = tileToScreen(0, 0);
    const topRight = tileToScreen(mapWidth - 1, 0);
    const bottomLeft = tileToScreen(0, mapHeight - 1);
    const bottomRight = tileToScreen(mapWidth - 1, mapHeight - 1);

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
    const topRight = tileToScreen(this.mapWidth - 1, 0);
    const bottomLeft = tileToScreen(0, this.mapHeight - 1);
    const bottomRight = tileToScreen(this.mapWidth - 1, this.mapHeight - 1);

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

  getMapWidth(): number {
    return this.mapWidth;
  }

  getMapHeight(): number {
    return this.mapHeight;
  }

  destroy(): void {
    this.renderTexture.destroy();
  }
}
