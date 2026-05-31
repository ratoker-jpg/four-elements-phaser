/**
 * IndustrialFrameRenderer — production frame/background layer for industrial maps.
 *
 * VISUAL-05A-PR3: Renders the visual frame border and background/world layer
 * around the playable industrial map. This renderer is ONLY instantiated when
 * mapStyle === 'industrial'.
 *
 * Layer model (depth order, TerrainRenderer is depth 0):
 *   Depth -20 — background world image (below terrain, lowest layer)
 *   Depth 0   — terrain (TerrainRenderer CanvasTexture)
 *   Depth 10  — wall face images (visual side faces around the frame, above terrain)
 *   Depth 90  — frame top block images (above terrain, behind entities at depth 100+)
 *
 * The frame border is visual-only — it does NOT add cells to MapData, does NOT
 * change mapWidth/mapHeight, does NOT affect pathfinding/occupancy, does NOT
 * change buildability, resources, or save format.
 *
 * Placement model uses the same grid-aligned logic proven in ?visual04a:
 *   - Playable cells are col 0..W-1 and row 0..H-1
 *   - Frame border is one tile outside: col from -1..W, row from -1..H
 *   - Frame cells are the outer ring only (outer arena minus playable area)
 *
 * Assets (from production manifest):
 *   - frame_top_block.png (384×348 canvas, 368×184 diamond)
 *   - frame_wall_face_block_left.png (384×288 canvas)
 *   - background_world (background_world_candidate_01.png)
 */

import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../../config/worldConfig';
import { tileToScreen, mapOriginOffset, type IsoPoint } from './isometric';

// ─── Asset keys (production manifest) ────────────────────────────────

const ASSET_KEY_FRAME_TOP_BLOCK = 'frame_top_block';
const ASSET_KEY_WALL_FACE_LEFT = 'frame_wall_face_block_left';
const ASSET_KEY_BACKGROUND_WORLD = 'background_world';

// ─── Frame top block PNG constants (same geometry as Visual04a) ──────

/** Source canvas height of the frame top block PNG */
const FRAME_TOP_BLOCK_SRC_H = 348;

/** Diamond width within the frame top block PNG (8px margin on each side of 384px canvas) */
const FRAME_TOP_BLOCK_DIAMOND_W = 368;

/** Diamond center Y within the frame top block PNG canvas */
const FRAME_TOP_BLOCK_DIAMOND_CY = 120;

/** Origin Y so the diamond center aligns with the frame cell center */
const FRAME_TOP_BLOCK_ORIGIN_Y = FRAME_TOP_BLOCK_DIAMOND_CY / FRAME_TOP_BLOCK_SRC_H;

// ─── Wall face PNG constants (same geometry as Visual04a) ────────────

/** Wall face PNG canvas dimensions */
const WALL_FACE_SRC_W = 384;
const WALL_FACE_SRC_H = 288;

/** Top-left of visible wall polygon — anchor for edge placement */
const WALL_FACE_ANCHOR_X = 96 / WALL_FACE_SRC_W;   // 0.25
const WALL_FACE_ANCHOR_Y = 40 / WALL_FACE_SRC_H;    // ≈ 0.1389

/** Scale adjustment for wall PNG alignment (1.0 = default) */
const WALL_FACE_SCALE_ADJUST = 1.0;

/** Left/shadow wall tint — ~47% brightness, blue-gray for directional lighting */
const WALL_FACE_LEFT_TINT = 0x777788;

/** Right/lit wall tint — white preserves original PNG pixel colors */
const WALL_FACE_RIGHT_TINT = 0xffffff;

// ─── Depth layers ────────────────────────────────────────────────────

/** Background world image depth — below terrain (depth 0) so terrain renders on top */
const DEPTH_BG = -20;

/** Wall face images depth — visual side faces around the frame border, above terrain */
const DEPTH_FRAME_WALLS = 10;

/** Frame top block images depth — above terrain (depth 0), behind entities (depth 100+) */
const DEPTH_FRAME_TOP = 90;

// ─── Frame border ────────────────────────────────────────────────────

/** Frame border width in tiles (1 tile thick wall around platform) */
const FRAME_BORDER = 1;

/** Wall face height as a fraction of tile height */
const WALL_HEIGHT_RATIO = 0.6;

/** Corner wall height multiplier (corners are more substantial) */
const CORNER_WALL_MULT = 1.35;

/** Camera margin beyond frame for comfortable scrolling (in tiles) */
const CAMERA_MARGIN_TILES = 3;

// ─── Edge direction info ─────────────────────────────────────────────

/** Which edges of an isometric diamond face inward vs outward. */
interface EdgeInfo {
  isInner: boolean;
  isOuter: boolean;
}

/**
 * Determine inner/outer direction for each of the 4 diamond edges.
 * Same algorithm as Visual04aPreviewScene.getEdgeInfo().
 *
 * Edge indices:
 *   0 = top→right,  1 = right→bottom,
 *   2 = bottom→left, 3 = left→top
 */
function getEdgeInfo(sx: number, sy: number, arenaCX: number, arenaCY: number): EdgeInfo[] {
  const dx = sx - arenaCX;
  const dy = sy - arenaCY;
  return [
    { isInner: (dx - dy) < 0, isOuter: (dx - dy) > 0 },   // Edge 0
    { isInner: (dx + dy) < 0, isOuter: (dx + dy) > 0 },   // Edge 1
    { isInner: (-dx + dy) < 0, isOuter: (-dx + dy) > 0 },  // Edge 2
    { isInner: (-dx - dy) < 0, isOuter: (-dx - dy) > 0 },  // Edge 3
  ];
}

// ─── Frame piece data ────────────────────────────────────────────────

interface FramePiece {
  col: number;
  row: number;
  sx: number;
  sy: number;
  isCorner: boolean;
}

// ─── Renderer ────────────────────────────────────────────────────────

/**
 * IndustrialFrameRenderer — production frame/background layer.
 *
 * Creates background world image, frame top blocks, and wall face blocks
 * for industrial maps. Visual-only — no gameplay effects.
 */
export class IndustrialFrameRenderer {
  private offset: IsoPoint;
  private mapWidth: number;
  private mapHeight: number;
  private framePieces: FramePiece[] = [];
  private arenaCX = 0;
  private arenaCY = 0;

  private bgImage: Phaser.GameObjects.Image | null = null;
  private frameTopImages: Phaser.GameObjects.Image[] = [];
  private wallFaceImages: Phaser.GameObjects.Image[] = [];

  constructor(
    scene: Phaser.Scene,
    mapWidth: number,
    mapHeight: number,
  ) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.offset = mapOriginOffset(mapWidth, mapHeight);

    // Compute arena center (center of the playable diamond in world coords)
    // The center tile is at (mapWidth/2, mapHeight/2)
    const centerScreen = tileToScreen(mapWidth / 2, mapHeight / 2);
    this.arenaCX = centerScreen.x + this.offset.x;
    this.arenaCY = centerScreen.y + this.offset.y;

    // ─── Classify grid cells ────────────────────────────────────
    // Playable cells: col 0..W-1, row 0..H-1
    // Frame cells: outer ring in col -1..W, row -1..H minus playable

    const isPlayableCell = (col: number, row: number): boolean => {
      return col >= 0 && col < mapWidth && row >= 0 && row < mapHeight;
    };

    const isOuterArenaCell = (col: number, row: number): boolean => {
      return col >= -FRAME_BORDER && col < mapWidth + FRAME_BORDER &&
             row >= -FRAME_BORDER && row < mapHeight + FRAME_BORDER;
    };

    for (let row = -FRAME_BORDER; row < mapHeight + FRAME_BORDER; row++) {
      for (let col = -FRAME_BORDER; col < mapWidth + FRAME_BORDER; col++) {
        if (!isPlayableCell(col, row) && isOuterArenaCell(col, row)) {
          const screenPos = tileToScreen(col, row);
          const sx = screenPos.x + this.offset.x;
          const sy = screenPos.y + this.offset.y;
          const isCorner = this.isCornerPiece(sx, sy);
          this.framePieces.push({ col, row, sx, sy, isCorner });
        }
      }
    }

    // Sort by y for correct isometric draw order
    this.framePieces.sort((a, b) => a.sy - b.sy);

    console.log(`[IndustrialFrameRenderer] Frame pieces: ${this.framePieces.length} (corners: ${this.framePieces.filter(f => f.isCorner).length})`);

    // ─── Layer -20: Background world image (below terrain) ───────────
    this.createBackground(scene);

    // ─── Layer 10: Wall face images (above terrain, visual side faces) ──
    this.createWallFaces(scene);

    // ─── Layer 90: Frame top block images (above terrain, behind entities) ──
    this.createFrameTops(scene);
  }

  /** Check if a frame piece is at a corner of the outer diamond. */
  private isCornerPiece(sx: number, sy: number): boolean {
    const dx = sx - this.arenaCX;
    const dy = sy - this.arenaCY;

    const outerHW = (this.mapWidth + 2 * FRAME_BORDER) * TILE_W / 2;
    const outerHH = (this.mapHeight + 2 * FRAME_BORDER) * TILE_H / 2;

    const distToTop = Math.hypot(dx, dy - (-outerHH));
    const distToRight = Math.hypot(dx - outerHW, dy);
    const distToBottom = Math.hypot(dx, dy - outerHH);
    const distToLeft = Math.hypot(dx - (-outerHW), dy);

    const minDist = Math.min(distToTop, distToRight, distToBottom, distToLeft);
    const threshold = TILE_H * 1.5;
    return minDist < threshold;
  }

  /** Create the background world image. Falls back to dark fill if asset fails. */
  private createBackground(scene: Phaser.Scene): void {
    if (!scene.textures.exists(ASSET_KEY_BACKGROUND_WORLD)) {
      console.warn('[IndustrialFrameRenderer] Background world image not available, skipping.');
      return;
    }

    try {
      const tex = scene.textures.get(ASSET_KEY_BACKGROUND_WORLD);
      const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
      if (!src || !src.width || !src.height) {
        console.warn('[IndustrialFrameRenderer] Background world texture invalid, skipping.');
        return;
      }

      // Scale to cover the arena area plus scroll margin
      const outerHW = (this.mapWidth + 2 * FRAME_BORDER) * TILE_W / 2;
      const outerHH = (this.mapHeight + 2 * FRAME_BORDER) * TILE_H / 2;
      const wallH = TILE_H * WALL_HEIGHT_RATIO * CORNER_WALL_MULT;
      const margin = TILE_W * CAMERA_MARGIN_TILES;

      const bgScale = Math.max(
        (outerHW * 2 + margin * 2) / src.width,
        (outerHH * 2 + wallH * 2 + margin * 2) / src.height,
      );

      this.bgImage = scene.add.image(this.arenaCX, this.arenaCY, ASSET_KEY_BACKGROUND_WORLD);
      this.bgImage.setScale(bgScale);
      this.bgImage.setDepth(DEPTH_BG);
      this.bgImage.setOrigin(0.5, 0.5);
      this.bgImage.setScrollFactor(1);

      console.log(`[IndustrialFrameRenderer] Background world image created (scale=${bgScale.toFixed(4)})`);
    } catch {
      console.warn('[IndustrialFrameRenderer] Background world image error, skipping.');
    }
  }

  /** Create wall face PNG images for outer-facing edges. */
  private createWallFaces(scene: Phaser.Scene): void {
    if (!scene.textures.exists(ASSET_KEY_WALL_FACE_LEFT)) {
      console.warn('[IndustrialFrameRenderer] Wall face PNG not available, skipping walls.');
      return;
    }

    try {
      const tex = scene.textures.get(ASSET_KEY_WALL_FACE_LEFT);
      const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
      if (!src || !src.width || !src.height) {
        console.warn('[IndustrialFrameRenderer] Wall face PNG texture invalid, skipping walls.');
        return;
      }
    } catch {
      console.warn('[IndustrialFrameRenderer] Wall face PNG texture error, skipping walls.');
      return;
    }

    const halfTW = TILE_W / 2;
    const scale = (TILE_W / WALL_FACE_SRC_W) * WALL_FACE_SCALE_ADJUST;

    let leftCount = 0;
    let rightCount = 0;

    for (const piece of this.framePieces) {
      const { sx, sy } = piece;
      const edges = getEdgeInfo(sx, sy, this.arenaCX, this.arenaCY);

      // Left wall face PNG (shadow side)
      if (edges[2].isOuter) {
        const img = scene.add.image(sx - halfTW, sy, ASSET_KEY_WALL_FACE_LEFT);
        img.setScale(scale);
        img.setOrigin(WALL_FACE_ANCHOR_X, WALL_FACE_ANCHOR_Y);
        img.setDepth(DEPTH_FRAME_WALLS);
        img.setTint(WALL_FACE_LEFT_TINT);
        this.wallFaceImages.push(img);
        leftCount++;
      }

      // Right wall face PNG (mirrored, lit side)
      if (edges[1].isOuter) {
        const img = scene.add.image(sx + halfTW, sy, ASSET_KEY_WALL_FACE_LEFT);
        img.setScale(-scale, scale);
        img.setOrigin(WALL_FACE_ANCHOR_X, WALL_FACE_ANCHOR_Y);
        img.setDepth(DEPTH_FRAME_WALLS);
        img.setTint(WALL_FACE_RIGHT_TINT);
        this.wallFaceImages.push(img);
        rightCount++;
      }
    }

    console.log(`[IndustrialFrameRenderer] Wall face images: ${this.wallFaceImages.length} (left=${leftCount}, right=${rightCount}, scale=${scale.toFixed(4)})`);
  }

  /** Create frame top block PNG images for each frame piece. */
  private createFrameTops(scene: Phaser.Scene): void {
    if (!scene.textures.exists(ASSET_KEY_FRAME_TOP_BLOCK)) {
      console.warn('[IndustrialFrameRenderer] Frame top block PNG not available, skipping tops.');
      return;
    }

    try {
      const tex = scene.textures.get(ASSET_KEY_FRAME_TOP_BLOCK);
      const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
      if (!src || !src.width || !src.height) {
        console.warn('[IndustrialFrameRenderer] Frame top block PNG texture invalid, skipping tops.');
        return;
      }
    } catch {
      console.warn('[IndustrialFrameRenderer] Frame top block PNG texture error, skipping tops.');
      return;
    }

    const scale = TILE_W / FRAME_TOP_BLOCK_DIAMOND_W;

    for (const piece of this.framePieces) {
      const img = scene.add.image(piece.sx, piece.sy, ASSET_KEY_FRAME_TOP_BLOCK);
      img.setScale(scale);
      img.setOrigin(0.5, FRAME_TOP_BLOCK_ORIGIN_Y);
      img.setDepth(DEPTH_FRAME_TOP);
      this.frameTopImages.push(img);
    }

    console.log(`[IndustrialFrameRenderer] Frame top block images: ${this.frameTopImages.length} (scale=${scale.toFixed(4)})`);
  }

  /**
   * Get extended camera bounds that include the frame border and margin.
   * Callers should use this instead of terrainRenderer.getBounds() when
   * the industrial frame is present.
   */
  getExtendedBounds(): Phaser.Geom.Rectangle {
    const margin = TILE_W * CAMERA_MARGIN_TILES;

    // The frame extends 1 tile beyond the playable area on all sides.
    // Compute screen positions of the outermost frame cells.
    const topLeft = tileToScreen(-FRAME_BORDER, -FRAME_BORDER);
    const topRight = tileToScreen(this.mapWidth + FRAME_BORDER - 1, -FRAME_BORDER);
    const bottomLeft = tileToScreen(-FRAME_BORDER, this.mapHeight + FRAME_BORDER - 1);
    const bottomRight = tileToScreen(this.mapWidth + FRAME_BORDER - 1, this.mapHeight + FRAME_BORDER - 1);

    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + this.offset.x;
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + this.offset.y;
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + this.offset.x;
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + this.offset.y;

    // Account for wall height below the bottom edge
    const wallH = TILE_H * WALL_HEIGHT_RATIO * CORNER_WALL_MULT;

    return new Phaser.Geom.Rectangle(
      minX - TILE_W - margin,
      minY - TILE_H - margin,
      maxX - minX + TILE_W * 2 + margin * 2,
      maxY - minY + TILE_H * 2 + wallH + margin * 2,
    );
  }

  /** Get the offset for coordinate conversion (same as TerrainRenderer). */
  getOffset(): IsoPoint {
    return this.offset;
  }

  destroy(): void {
    this.bgImage?.destroy();
    this.bgImage = null;
    for (const img of this.frameTopImages) {
      img.destroy();
    }
    this.frameTopImages = [];
    for (const img of this.wallFaceImages) {
      img.destroy();
    }
    this.wallFaceImages = [];
  }
}
