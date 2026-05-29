import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../../config/worldConfig';
import { tileToScreen, mapOriginOffset, IsoPoint } from './isometric';
import type { TerrainType } from '../../state/types';
import { applyTerrainSmoothing, computeTerrainTint } from '../../state/terrainClustering';

/**
 * TERRAIN-02A: Asset key mapping for the 6-variant 256×128 sand tile family.
 *
 * Legacy types (sand, sand-dark, sand-light) map to the new 256×128 assets
 * for backward compatibility with saved maps. Detail variants add texture
 * variety for repetition reduction without using rotation.
 */
const TERRAIN_KEY_MAP: Record<TerrainType, string> = {
  sand: 'terrain_sand_clean_256x128',
  'sand-dark': 'terrain_sand_dark_256x128',
  'sand-light': 'terrain_sand_light_256x128',
  'sand-ripple': 'terrain_sand_ripple_256x128',
  'sand-pebble': 'terrain_sand_pebble_256x128',
  'sand-cracked': 'terrain_sand_cracked_256x128',
};

/** TERRAIN-02A: Source asset dimensions for the 256×128 isometric tile family. */
const TERRAIN_SOURCE_W = 256;
const TERRAIN_SOURCE_H = 128;

/** Pre-computed stamp config for terrain tiles (scale 256×128 source to fit iso cell, center origin). */
const TERRAIN_STAMP_CONFIG: Phaser.Types.Textures.StampConfig = {
  scaleX: TILE_W / TERRAIN_SOURCE_W,  // 76/256 = 0.296875 — uniform scale for 256×128 source
  scaleY: TILE_H / TERRAIN_SOURCE_H,  // 38/128 = 0.296875
  originX: 0.5,
  originY: 0.5,
};

/**
 * TerrainRenderer — renders the full isometric terrain onto a RenderTexture.
 *
 * Receives terrain data from GameState (not hardcoded).
 * Creates a static RenderTexture that the camera scrolls over.
 *
 * TERRAIN-01: Applies visual smoothing to merge isolated single-tile
 * terrain variants into larger clusters, and adds deterministic
 * per-tile tint variation to reduce visual repetition without
 * requiring new asset files. The smoothing is visual-only — the
 * original terrain data in MapData is not modified.
 *
 * TERRAIN-02A: Uses the 6-variant 256×128 sand tile family.
 * Terrain variant selection (which tile gets which detail variant)
 * is the responsibility of map generation (generatedMap.ts), NOT
 * the renderer. The renderer only maps TerrainType → asset key
 * and stamps it with per-tile tint for visual variety. This ensures
 * MapData terrain state matches rendered terrain.
 * The 256×128 source tiles are uniformly scaled to the 76×38
 * isometric cell size (scale factor 0.296875).
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

    // TERRAIN-01: Apply visual smoothing to create larger clusters
    // from scattered single-tile variants. This is a visual-only
    // operation — the original MapData terrain is not modified.
    const smoothedTerrain = applyTerrainSmoothing(terrainMap, 2);

    // TERRAIN-02A: Variant selection is done in map generation (generatedMap.ts),
    // not here. The renderer only maps TerrainType → asset key + tint.
    this.stampTerrainTiles(smoothedTerrain);
    this.renderTexture.render();
  }

  private stampTerrainTiles(terrainMap: TerrainType[][]): void {
    for (let ty = 0; ty < terrainMap.length; ty++) {
      for (let tx = 0; tx < terrainMap[ty].length; tx++) {
        const terrainType = terrainMap[ty][tx];

        // TERRAIN-02A: The renderer is a pure mapping layer — TerrainType → asset key.
        // Variant selection happens in map generation (generatedMap.ts), not here.
        // This ensures MapData terrain state matches what is rendered.
        const assetKey = TERRAIN_KEY_MAP[terrainType];
        const screenPos = tileToScreen(tx, ty);
        const worldX = screenPos.x + this.offset.x;
        const worldY = screenPos.y + this.offset.y;

        // TERRAIN-02A: Per-tile deterministic tint for visual variation.
        // Uses a fast hash of tile coordinates to produce subtle color
        // shifts (within ±8% of neutral) that break up visual repetition
        // of identical textures. Tint is visual-only — it does NOT change
        // the TerrainType in MapData.
        const tint = computeTerrainTint(tx, ty, terrainType);

        const stampConfig: Phaser.Types.Textures.StampConfig = {
          ...TERRAIN_STAMP_CONFIG,
          tint,
        };

        this.renderTexture.stamp(assetKey, undefined, worldX, worldY, stampConfig);
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
