import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../../config/worldConfig';
import { tileToScreen, mapOriginOffset, IsoPoint } from './isometric';
import type { TerrainType } from '../../state/types';
import type { MapStyle } from '../../state/gameSetup';
import { computeTerrainTint } from '../../state/terrainClustering';

/**
 * TERRAIN-02A: Asset key mapping for the 6-variant 256×128 sand tile family.
 *
 * Legacy types (sand, sand-dark, sand-light) map to the new 256×128 assets
 * for backward compatibility with saved maps. Detail variants add texture
 * variety for repetition reduction without using rotation.
 *
 * VISUAL-05A-PR2: 'industrial' type maps to a placeholder key — the actual
 * asset key is determined at render time by the WeightedTilePicker.
 */
const TERRAIN_KEY_MAP: Record<TerrainType, string> = {
  sand: 'terrain_sand_clean_256x128',
  'sand-dark': 'terrain_sand_dark_256x128',
  'sand-light': 'terrain_sand_light_256x128',
  'sand-ripple': 'terrain_sand_ripple_256x128',
  'sand-pebble': 'terrain_sand_pebble_256x128',
  'sand-cracked': 'terrain_sand_cracked_256x128',
  industrial: '',  // placeholder — actual key determined by WeightedTilePicker
};

/** TERRAIN-02A: Source asset dimensions for the 256×128 isometric tile family. */
const TERRAIN_SOURCE_W = 256;
const TERRAIN_SOURCE_H = 128;

/**
 * TERRAIN-FIX-01: Tile overlap factor to eliminate visible seams between
 * adjacent isometric tiles. At exactly 1.0 scale, anti-aliased tile edges
 * can leave sub-pixel gaps that create a faint diamond grid pattern.
 * A 1% overlap (1.01) is enough to close these seams without creating
 * visible overlap artifacts, because the isometric diamond edges are
 * transparent — overlapping transparent pixels blend naturally.
 */
const TERRAIN_OVERLAP_FACTOR = 1.01;

/** Pre-computed stamp config for terrain tiles (scale 256×128 source to fit iso cell, center origin). */
const TERRAIN_STAMP_CONFIG: Phaser.Types.Textures.StampConfig = {
  scaleX: (TILE_W / TERRAIN_SOURCE_W) * TERRAIN_OVERLAP_FACTOR,  // 76/256 * 1.01 ≈ 0.299841 — slight overlap to close seams
  scaleY: (TILE_H / TERRAIN_SOURCE_H) * TERRAIN_OVERLAP_FACTOR,  // 38/128 * 1.01 ≈ 0.299841
  originX: 0.5,
  originY: 0.5,
};

// ─── Industrial terrain constants (VISUAL-05A-PR2) ────────────────────

/** Source dimensions for the 384×192 industrial isometric tile family. */
const INDUSTRIAL_SOURCE_W = 384;
const INDUSTRIAL_SOURCE_H = 192;

/** Pre-computed stamp config for industrial tiles (scale 384×192 source to fit iso cell, center origin). */
const INDUSTRIAL_STAMP_CONFIG: Phaser.Types.Textures.StampConfig = {
  scaleX: (TILE_W / INDUSTRIAL_SOURCE_W) * TERRAIN_OVERLAP_FACTOR,
  scaleY: (TILE_H / INDUSTRIAL_SOURCE_H) * TERRAIN_OVERLAP_FACTOR,
  originX: 0.5,
  originY: 0.5,
};

/**
 * Industrial tile metadata for weighted deterministic selection.
 * VISUAL-05A-PR2: Same weights as Visual04aPreviewScene.
 */
const INDUSTRIAL_TILE_METAS = [
  { id: 1, weight: 24 },
  { id: 2, weight: 8 },
  { id: 5, weight: 18 },
  { id: 6, weight: 6 },
  { id: 7, weight: 2 },
  { id: 8, weight: 5 },
  { id: 9, weight: 16 },
  { id: 10, weight: 14 },
];

/** Map industrial tile ID to asset key in the generated manifest. */
function industrialTileIdToKey(id: number): string {
  return `industrial_tile_${String(id).padStart(3, '0')}`;
}

// ─── WeightedTilePicker (VISUAL-05A-PR2) ──────────────────────────────

/**
 * Deterministic weighted tile picker for industrial terrain.
 * Uses seeded PRNG (mulberry32) to produce the same tile distribution
 * for the same seed on every render. Same algorithm as
 * Visual04aPreviewScene's WeightedTilePicker.
 */
class WeightedTilePicker {
  private tiles: number[];
  private cumulativeWeights: number[];
  private totalWeight: number;
  private rng: () => number;

  constructor(tileMetas: { id: number; weight: number }[], seed: number) {
    // Seeded PRNG (mulberry32)
    let s = seed | 0;
    this.rng = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    this.tiles = tileMetas.map(t => t.id);
    this.cumulativeWeights = [];
    let cumulative = 0;
    for (const meta of tileMetas) {
      cumulative += meta.weight;
      this.cumulativeWeights.push(cumulative);
    }
    this.totalWeight = cumulative;
  }

  pick(): number {
    const r = this.rng() * this.totalWeight;
    for (let i = 0; i < this.cumulativeWeights.length; i++) {
      if (r < this.cumulativeWeights[i]) {
        return this.tiles[i];
      }
    }
    return this.tiles[this.tiles.length - 1];
  }
}

/**
 * TerrainRenderer — pure mapping layer that renders isometric terrain onto a RenderTexture.
 *
 * Receives terrain data from GameState (not hardcoded).
 * Creates a static RenderTexture that the camera scrolls over.
 *
 * The renderer does NOT modify terrain types. It is a pure mapping layer:
 * TerrainType → asset key → stamp with per-tile tint. This ensures
 * MapData terrain state matches rendered terrain (tint is visual-only).
 *
 * VISUAL-05A-PR2: Supports both sand and industrial mapStyles.
 * - Sand: uses TERRAIN_KEY_MAP with per-tile tint via computeTerrainTint()
 * - Industrial: uses WeightedTilePicker for deterministic tile selection,
 *   stamps with INDUSTRIAL_STAMP_CONFIG, no tint (visual variation from tiles)
 *
 * TERRAIN-02A: Uses the 6-variant 256×128 sand tile family.
 * The 256×128 source tiles are uniformly scaled to the 76×38
 * isometric cell size (scale factor 0.296875) with a 1% overlap
 * factor (TERRAIN_OVERLAP_FACTOR = 1.01) to close seams between
 * adjacent tiles.
 */
export class TerrainRenderer {
  private renderTexture: Phaser.GameObjects.RenderTexture;
  private offset: IsoPoint;
  private mapWidth: number;
  private mapHeight: number;
  private mapStyle: MapStyle;

  constructor(
    scene: Phaser.Scene,
    terrainMap: TerrainType[][],
    mapWidth: number,
    mapHeight: number,
    mapStyle: MapStyle = 'sand',
  ) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.mapStyle = mapStyle;
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

    // The renderer is a pure mapping layer — it stamps the terrain map
    // directly without modifying any terrain types. MapData terrain state
    // matches rendered terrain (tint is visual-only).
    this.stampTerrainTiles(terrainMap);
    this.renderTexture.render();
  }

  private stampTerrainTiles(terrainMap: TerrainType[][]): void {
    // VISUAL-05A-PR2: Industrial terrain uses WeightedTilePicker
    if (this.mapStyle === 'industrial') {
      this.stampIndustrialTerrain(terrainMap);
      return;
    }

    // Sand terrain: existing TERRAIN-02A behavior (unchanged)
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

        // TERRAIN-FIX-01: Per-tile deterministic tint for visual variation.
        // Uses a fast hash of tile coordinates to produce subtle color
        // shifts (within ±2% of neutral) that break up visual repetition
        // of identical textures. Tint is visual-only — it does NOT change
        // the TerrainType in MapData. Amplitude reduced from ±8% because
        // the old range created visible per-cell color differences.
        const tint = computeTerrainTint(tx, ty, terrainType);

        const stampConfig: Phaser.Types.Textures.StampConfig = {
          ...TERRAIN_STAMP_CONFIG,
          tint,
        };

        this.renderTexture.stamp(assetKey, undefined, worldX, worldY, stampConfig);
      }
    }
  }

  /**
   * Stamp industrial terrain tiles using deterministic WeightedTilePicker.
   * VISUAL-05A-PR2: All tiles are TerrainType 'industrial' — visual
   * variation comes from the weighted picker, not terrain type patches.
   * Industrial tiles do NOT use computeTerrainTint() — the tile art
   * provides its own visual variation.
   */
  private stampIndustrialTerrain(terrainMap: TerrainType[][]): void {
    const picker = new WeightedTilePicker(INDUSTRIAL_TILE_METAS, 42);

    for (let ty = 0; ty < terrainMap.length; ty++) {
      for (let tx = 0; tx < terrainMap[ty].length; tx++) {
        const tileId = picker.pick();
        const assetKey = industrialTileIdToKey(tileId);

        const screenPos = tileToScreen(tx, ty);
        const worldX = screenPos.x + this.offset.x;
        const worldY = screenPos.y + this.offset.y;

        // Industrial tiles use their own stamp config (384×192 source)
        // No tint — the tile art provides visual variation
        this.renderTexture.stamp(assetKey, undefined, worldX, worldY, INDUSTRIAL_STAMP_CONFIG);
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
