import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../../config/worldConfig';
import { tileToScreen, mapOriginOffset, IsoPoint } from './isometric';
import type { TerrainType } from '../../state/types';
import { applyTerrainSmoothing, computeTerrainTint, terrainTileHash } from '../../state/terrainClustering';

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
 * TERRAIN-02A: Deterministic detail variant assignment for the base 'sand' type.
 *
 * After smoothing, tiles with base type 'sand' may be assigned one of the
 * detail variants (ripple, pebble, cracked) based on a deterministic hash
 * of their coordinates. This breaks up visual repetition without requiring
 * rotation or random placement.
 *
 * Weight distribution:
 * - clean (sand):    60% — dominant base
 * - light:           12% — subtle brightness variation
 * - dark:            10% — subtle darkness variation
 * - ripple:          10% — ripple texture accent
 * - pebble:           4% — pebble texture accent
 * - cracked:          4% — cracked texture accent
 *
 * Only tiles with baseType 'sand' are considered for variant assignment;
 * sand-light and sand-dark patches retain their type.
 *
 * @param tx - Tile X coordinate
 * @param ty - Tile Y coordinate
 * @param baseType - The terrain type after smoothing (before variant assignment)
 * @param hash - Pre-computed terrain tile hash for this position
 * @returns The final TerrainType to use for rendering
 */
function assignDetailVariant(_tx: number, _ty: number, baseType: TerrainType, hash: number): TerrainType {
  // Only assign detail variants to base 'sand' tiles
  if (baseType !== 'sand') return baseType;

  // Use the lower 10 bits of the hash for a 0–1023 range
  const roll = (hash & 0x3FF); // 0–1023

  // Weight thresholds (out of 1024):
  // clean:  0–614   (60.0%)
  // light:  615–737 (12.0%)
  // dark:   738–839 (10.0%)
  // ripple: 840–941 (10.0%)
  // pebble: 942–982 ( 4.0%)
  // cracked:983–1023( 4.0%)
  if (roll < 615) return 'sand';
  if (roll < 738) return 'sand-light';
  if (roll < 840) return 'sand-dark';
  if (roll < 942) return 'sand-ripple';
  if (roll < 983) return 'sand-pebble';
  return 'sand-cracked';
}

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
 * TERRAIN-02A: Uses the 6-variant 256×128 sand tile family with
 * deterministic detail variant assignment for repetition reduction.
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

    this.stampTerrainTiles(smoothedTerrain);
    this.renderTexture.render();
  }

  private stampTerrainTiles(terrainMap: TerrainType[][]): void {
    for (let ty = 0; ty < terrainMap.length; ty++) {
      for (let tx = 0; tx < terrainMap[ty].length; tx++) {
        const baseType = terrainMap[ty][tx];

        // TERRAIN-02A: Deterministic detail variant selection for base 'sand' type.
        // After smoothing, 'sand' tiles may be assigned a detail variant
        // (ripple/pebble/cracked/light/dark) based on a deterministic hash,
        // breaking up visual repetition without rotation.
        const hash = terrainTileHash(tx, ty);
        const terrainType = assignDetailVariant(tx, ty, baseType, hash);

        const assetKey = TERRAIN_KEY_MAP[terrainType];
        const screenPos = tileToScreen(tx, ty);
        const worldX = screenPos.x + this.offset.x;
        const worldY = screenPos.y + this.offset.y;

        // TERRAIN-02A: Per-tile deterministic tint for visual variation.
        // Uses a fast hash of tile coordinates to produce subtle color
        // shifts (within ±8% of neutral) that break up visual repetition
        // of identical textures without requiring new asset files.
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
