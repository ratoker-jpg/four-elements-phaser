/**
 * Visual04aPreviewScene — modular grid-aligned arena frame prototype.
 *
 * VISUAL-04A: Proves that an arena frame can be built from modular
 * grid-aligned pieces positioned in the same coordinate system as
 * platform tiles, eliminating the image-overlay alignment problem
 * that caused PR #134 (VISUAL-03B) to fail visual QA.
 *
 *   Layer 0 — background world image
 *   Layer 1 — platform tile layer (9×9 grid, clipped to inner diamond)
 *   Layer 2a — frame wall faces (dark, behind tops)
 *   Layer 2b — frame top surfaces + inner lip (medium dark, in front)
 *   Layer 3 — optional debug grid overlay (G toggle)
 *   Layer 4 — optional frame debug outlines (F toggle)
 *   Layer 5 — info/debug text
 *
 * Key design principle:
 *   Frame pieces are positioned from the SAME (col, row) grid coordinate
 *   system as platform tiles. No full-frame PNG overlay. No manual
 *   alignment offsets. Each frame piece is a Phaser Graphics shape drawn
 *   at a grid position, guaranteeing pixel-perfect alignment with tiles.
 *
 * Frame construction:
 *   - 1-tile-wide border of frame pieces around the platform diamond
 *   - Each frame piece = isometric diamond (top surface) + wall face
 *   - Corner blocks at the 4 cardinal vertices of the outer diamond
 *   - Inner lip line along the platform boundary
 *   - All placeholder art — not final
 *
 * Controls:
 *   G — toggle grid overlay
 *   F — toggle frame debug outlines
 *   ESC — exit to PreloadScene → menu
 *
 * This scene does NOT replace production terrain.
 * It does NOT modify gameplay, pathfinding, economy, or any production system.
 * It is activated only via the ?visual04a URL parameter.
 *
 * Access: http://localhost:3000/?visual04a
 */

import Phaser from 'phaser';

// ─── Tile metadata ────────────────────────────────────────────────

interface TileMeta {
  id: number;
  file: string;
  tags: string[];
  recommendedWeight: number;
}

// ─── Grid configuration ──────────────────────────────────────────

/** Platform grid size (inner playable area) */
const GRID_N = 9;

/** Frame border width in tiles (1 tile thick wall around platform) */
const FRAME_BORDER = 1;

/** Full arena grid size (platform + border on each side) */
const ARENA_N = GRID_N + 2 * FRAME_BORDER;  // 11

/** Source tile dimensions (from metadata / PNG files) */
const SOURCE_TILE_W = 384;
const SOURCE_TILE_H = 192;

/** Wall face height as a fraction of tile height */
const WALL_HEIGHT_RATIO = 0.6;

// ─── Asset keys ───────────────────────────────────────────────────

const ASSET_KEY_BG = 'visual04a_bg';
const TILE_ASSET_KEY_PREFIX = 'visual04a_tile_';

// ─── Depth layers ─────────────────────────────────────────────────

const DEPTH_BG = 0;
const DEPTH_FRAME_WALLS = 5;
const DEPTH_TILES = 10;
const DEPTH_FRAME_TOP = 15;
const DEPTH_GRID = 20;
const DEPTH_FRAME_DEBUG = 25;
const DEPTH_UI = 40;

// ─── Colors ───────────────────────────────────────────────────────

// Frame placeholder colors (not final art)
const FRAME_TOP_COLOR = 0x4a4a5a;
const FRAME_TOP_ALPHA = 1.0;
const FRAME_WALL_COLOR = 0x2a2a3a;
const FRAME_WALL_ALPHA = 1.0;
const FRAME_LIP_COLOR = 0x7a7a8a;
const FRAME_LIP_ALPHA = 0.8;
const FRAME_CORNER_TOP_COLOR = 0x5a5a6a;
const FRAME_CORNER_WALL_COLOR = 0x3a3a4a;

// Debug overlay colors
const GRID_COLOR = 0x00ff00;
const GRID_ALPHA = 0.4;
const MASK_COLOR = 0xffffff;
const DEBUG_FRAME_OUTLINE_COLOR = 0xff6600;
const DEBUG_INNER_DIAMOND_COLOR = 0xffff00;
const DEBUG_OUTER_DIAMOND_COLOR = 0x00ffff;
const DEBUG_CORNER_COLOR = 0xff00ff;

// ─── Weighted random tile picker ──────────────────────────────────

class WeightedTilePicker {
  private tiles: number[];
  private cumulativeWeights: number[];
  private totalWeight: number;
  private rng: () => number;

  constructor(tileMetas: TileMeta[], seed: number) {
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
      cumulative += meta.recommendedWeight;
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

// ─── Frame piece data ─────────────────────────────────────────────

interface FramePiece {
  col: number;
  row: number;
  sx: number;
  sy: number;
  isCorner: boolean;
}

// ─── Scene ────────────────────────────────────────────────────────

export class Visual04aPreviewScene extends Phaser.Scene {
  // Toggle state
  private gridVisible = false;
  private frameDebugVisible = false;

  // Graphics layers
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private frameDebugGraphics: Phaser.GameObjects.Graphics | null = null;
  private frameWallGraphics: Phaser.GameObjects.Graphics | null = null;
  private frameTopGraphics: Phaser.GameObjects.Graphics | null = null;
  private infoText: Phaser.GameObjects.Text | null = null;

  // Computed tile dimensions (always exact 2:1)
  private runtimeTileW = 0;
  private runtimeTileH = 0;
  private wallH = 0;

  // Platform origin (center of tile 0,0) in display coords
  private platformOriginX = 0;
  private platformOriginY = 0;

  // Arena diamond geometry (display coords)
  private arenaCX = 0;
  private arenaCY = 0;
  private innerHW = 0;
  private innerHH = 0;
  private outerHW = 0;
  private outerHH = 0;

  // Tile data
  private tilePlacements: { col: number; row: number; tileId: number }[] = [];
  private framePieces: FramePiece[] = [];

  // Mask
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;
  private tileContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'Visual04aPreviewScene' });
  }

  preload(): void {
    // Load background world candidate
    this.load.image(ASSET_KEY_BG, 'dev-visual/visual-02a/background_world_candidate_01.png');

    // Load balanced 8 tiles (same assets as Visual03a)
    const tileIds = [1, 2, 5, 6, 7, 8, 9, 10];
    for (const id of tileIds) {
      const key = `${TILE_ASSET_KEY_PREFIX}${id}`;
      const file = `dev-visual/visual-02a/tiles/platform_tile_${String(id).padStart(3, '0')}.png`;
      this.load.image(key, file);
    }

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[Visual04a] Failed to load: ${file.key} (${file.url})`);
    });
  }

  create(): void {
    const cam = this.cameras.main;
    const canvasW = cam.width;
    const canvasH = cam.height;

    // ─── Compute tile dimensions ──────────────────────────────────

    // Tile size to fit the full arena (11×11 diamond) in canvas
    // Arena diamond: height = ARENA_N * th, width = 2 * ARENA_N * th
    const margin = 0.82;
    this.runtimeTileH = Math.min(
      canvasH * margin / ARENA_N,
      canvasW * margin / (2 * ARENA_N)
    );
    this.runtimeTileW = 2 * this.runtimeTileH;
    this.wallH = this.runtimeTileH * WALL_HEIGHT_RATIO;

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // ─── Arena diamond geometry ───────────────────────────────────

    // Center of the arena (same as center of the canvas)
    this.arenaCX = canvasW / 2;
    this.arenaCY = canvasH / 2;

    // Inner diamond half-extents (platform area, 9×9 grid)
    this.innerHH = GRID_N * this.runtimeTileH / 2;
    this.innerHW = GRID_N * this.runtimeTileW / 2;  // = GRID_N * runtimeTileH

    // Outer diamond half-extents (full arena including frame, 11×11 grid)
    this.outerHH = ARENA_N * this.runtimeTileH / 2;
    this.outerHW = ARENA_N * this.runtimeTileW / 2;

    // Platform origin: center of tile (0,0)
    // Top vertex of inner diamond is at (arenaCX, arenaCY - innerHH)
    // Tile (0,0) center is at (arenaCX, arenaCY - innerHH + halfTH)
    this.platformOriginX = this.arenaCX;
    this.platformOriginY = this.arenaCY - this.innerHH + halfTH;

    const tileRatio = this.runtimeTileW / this.runtimeTileH;
    console.log(`[Visual04a] Arena: ${ARENA_N}×${ARENA_N} (platform ${GRID_N}+border ${FRAME_BORDER})`);
    console.log(`[Visual04a] Tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)}, ratio: ${tileRatio.toFixed(4)}`);
    console.log(`[Visual04a] Inner diamond: ${(2*this.innerHW).toFixed(1)}×${(2*this.innerHH).toFixed(1)}`);
    console.log(`[Visual04a] Outer diamond: ${(2*this.outerHW).toFixed(1)}×${(2*this.outerHH).toFixed(1)}`);

    // ─── Create tile picker ───────────────────────────────────────

    const tileMetas: TileMeta[] = [
      { id: 1, file: 'platform_tile_001.png', tags: ['base', 'dirt'], recommendedWeight: 24 },
      { id: 2, file: 'platform_tile_002.png', tags: ['crack'], recommendedWeight: 8 },
      { id: 5, file: 'platform_tile_005.png', tags: ['base', 'dirt'], recommendedWeight: 18 },
      { id: 6, file: 'platform_tile_006.png', tags: ['crack', 'mineral'], recommendedWeight: 6 },
      { id: 7, file: 'platform_tile_007.png', tags: ['grate'], recommendedWeight: 2 },
      { id: 8, file: 'platform_tile_008.png', tags: ['crack', 'mineral'], recommendedWeight: 5 },
      { id: 9, file: 'platform_tile_009.png', tags: ['base', 'dirt'], recommendedWeight: 16 },
      { id: 10, file: 'platform_tile_010.png', tags: ['base', 'crack'], recommendedWeight: 14 },
    ];
    const picker = new WeightedTilePicker(tileMetas, 42);

    // ─── Diamond hit-test helpers ─────────────────────────────────

    const isInInnerDiamond = (px: number, py: number): boolean => {
      return (Math.abs(px - this.arenaCX) / this.innerHW +
              Math.abs(py - this.arenaCY) / this.innerHH) <= 1.1;
    };

    const isInOuterDiamond = (px: number, py: number): boolean => {
      return (Math.abs(px - this.arenaCX) / this.outerHW +
              Math.abs(py - this.arenaCY) / this.outerHH) <= 1.05;
    };

    // ─── Classify grid cells ──────────────────────────────────────

    // Iterate over the full arena range (platform + border)
    this.tilePlacements = [];
    this.framePieces = [];

    for (let row = -FRAME_BORDER; row < GRID_N + FRAME_BORDER; row++) {
      for (let col = -FRAME_BORDER; col < GRID_N + FRAME_BORDER; col++) {
        const sx = (col - row) * halfTW + this.platformOriginX;
        const sy = (col + row) * halfTH + this.platformOriginY;

        if (isInInnerDiamond(sx, sy)) {
          // Platform tile
          const tileId = picker.pick();
          this.tilePlacements.push({ col, row, tileId });
        } else if (isInOuterDiamond(sx, sy)) {
          // Frame piece
          const isCorner = this.isCornerPiece(col, row, sx, sy);
          this.framePieces.push({ col, row, sx, sy, isCorner });
        }
        // else: outside arena, skip
      }
    }

    // Sort frame pieces by y-position for correct isometric draw order
    this.framePieces.sort((a, b) => a.sy - b.sy);

    console.log(`[Visual04a] Platform tiles: ${this.tilePlacements.length}`);
    console.log(`[Visual04a] Frame pieces: ${this.framePieces.length} (corners: ${this.framePieces.filter(f => f.isCorner).length})`);

    // ─── Layer 0: Background world ────────────────────────────────

    const bgImg = this.textures.get(ASSET_KEY_BG);
    const bgW = bgImg.getSourceImage().width;
    const bgH = bgImg.getSourceImage().height;

    const bgScale = Math.max(canvasW / bgW, canvasH / bgH);
    const bg = this.add.image(canvasW / 2, canvasH / 2, ASSET_KEY_BG);
    bg.setScale(bgScale);
    bg.setDepth(DEPTH_BG);
    bg.setOrigin(0.5, 0.5);

    // ─── Layer 2a: Frame wall faces (drawn before tiles) ──────────

    this.frameWallGraphics = this.add.graphics();
    this.frameWallGraphics.setDepth(DEPTH_FRAME_WALLS);
    this.drawFrameWalls();

    // ─── Layer 1: Platform tiles (masked to inner diamond) ────────

    // Create diamond mask for platform clipping
    this.maskGraphics = this.make.graphics({ x: 0, y: 0 }, false);
    this.maskGraphics.fillStyle(MASK_COLOR, 1);
    this.maskGraphics.beginPath();
    this.maskGraphics.moveTo(this.arenaCX, this.arenaCY - this.innerHH);
    this.maskGraphics.lineTo(this.arenaCX + this.innerHW, this.arenaCY);
    this.maskGraphics.lineTo(this.arenaCX, this.arenaCY + this.innerHH);
    this.maskGraphics.lineTo(this.arenaCX - this.innerHW, this.arenaCY);
    this.maskGraphics.closePath();
    this.maskGraphics.fillPath();

    const diamondMask = this.maskGraphics.createGeometryMask();

    // Create container for tiles
    this.tileContainer = this.add.container(0, 0);
    this.tileContainer.setDepth(DEPTH_TILES);
    this.tileContainer.setMask(diamondMask);

    // Tile scaling: source 384×192 → runtime tile size
    const tileScaleX = this.runtimeTileW / SOURCE_TILE_W;
    const tileScaleY = this.runtimeTileH / SOURCE_TILE_H;

    for (const placement of this.tilePlacements) {
      const sx = (placement.col - placement.row) * halfTW + this.platformOriginX;
      const sy = (placement.col + placement.row) * halfTH + this.platformOriginY;

      const assetKey = `${TILE_ASSET_KEY_PREFIX}${placement.tileId}`;
      const tileImg = this.add.image(sx, sy, assetKey);
      tileImg.setScale(tileScaleX, tileScaleY);
      tileImg.setOrigin(0.5, 0.5);

      this.tileContainer.add(tileImg);
    }

    // ─── Layer 2b: Frame top surfaces + inner lip ────────────────

    this.frameTopGraphics = this.add.graphics();
    this.frameTopGraphics.setDepth(DEPTH_FRAME_TOP);
    this.drawFrameTops();

    // ─── Layer 3: Debug grid overlay (initially hidden) ───────────

    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(DEPTH_GRID);
    this.gridGraphics.setVisible(this.gridVisible);
    this.drawGridOverlay();

    // ─── Layer 4: Frame debug outlines (initially hidden) ────────

    this.frameDebugGraphics = this.add.graphics();
    this.frameDebugGraphics.setDepth(DEPTH_FRAME_DEBUG);
    this.frameDebugGraphics.setVisible(this.frameDebugVisible);
    this.drawFrameDebug();

    // ─── Camera ───────────────────────────────────────────────────

    cam.setBackgroundColor('#1a1a2e');
    cam.setScroll(0, 0);

    // ─── Keyboard controls ────────────────────────────────────────

    this.input.keyboard?.on('keydown-G', () => {
      this.gridVisible = !this.gridVisible;
      this.gridGraphics?.setVisible(this.gridVisible);
      this.updateInfoText();
    });

    this.input.keyboard?.on('keydown-F', () => {
      this.frameDebugVisible = !this.frameDebugVisible;
      this.frameDebugGraphics?.setVisible(this.frameDebugVisible);
      this.updateInfoText();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      console.log('[Visual04aPreviewScene] ESC pressed. Starting PreloadScene to load production assets before menu.');
      this.scene.start('PreloadScene');
    });

    // ─── Info text ────────────────────────────────────────────────

    this.infoText = this.add.text(12, 12, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#aaaaaa',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 8, y: 4 },
    });
    this.infoText.setDepth(DEPTH_UI);
    this.infoText.setScrollFactor(0);
    this.updateInfoText();
  }

  // ─── Corner piece detection ──────────────────────────────────────

  /**
   * A frame piece is a "corner" if it's at one of the 4 cardinal
   * vertices of the outer diamond (top, right, bottom, left).
   * Corners get slightly different visual treatment.
   */
  private isCornerPiece(_col: number, _row: number, sx: number, sy: number): boolean {
    const dx = sx - this.arenaCX;
    const dy = sy - this.arenaCY;

    // Distance from each cardinal vertex of the outer diamond
    const distToTop = Math.hypot(dx, dy - (-this.outerHH));
    const distToRight = Math.hypot(dx - this.outerHW, dy);
    const distToBottom = Math.hypot(dx, dy - this.outerHH);
    const distToLeft = Math.hypot(dx - (-this.outerHW), dy);

    const minDist = Math.min(distToTop, distToRight, distToBottom, distToLeft);

    // Corner threshold: within 1.5 tile diagonals of a cardinal vertex
    const threshold = this.runtimeTileH * 1.5;
    return minDist < threshold;
  }

  // ─── Frame wall face rendering ───────────────────────────────────

  /**
   * Draw wall faces for all frame pieces.
   * Each wall face is a filled parallelogram below the bottom half
   * of the frame piece's isometric diamond, simulating a vertical face.
   */
  private drawFrameWalls(): void {
    if (!this.frameWallGraphics) return;
    const g = this.frameWallGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    for (const piece of this.framePieces) {
      const { sx, sy, isCorner } = piece;
      const wallColor = isCorner ? FRAME_CORNER_WALL_COLOR : FRAME_WALL_COLOR;

      // Wall face: the V-shape at the bottom of the diamond,
      // extended downward by wallH
      //
      //   Left vertex ──────── Right vertex
      //        \              /
      //         Bottom vertex
      //         |            |
      //   Left+wallH  Bottom+wallH  Right+wallH

      g.fillStyle(wallColor, FRAME_WALL_ALPHA);
      g.beginPath();
      g.moveTo(sx - halfTW, sy);                   // left vertex
      g.lineTo(sx, sy + halfTH);                    // bottom vertex
      g.lineTo(sx + halfTW, sy);                    // right vertex
      g.lineTo(sx + halfTW, sy + this.wallH);       // right + wall
      g.lineTo(sx, sy + halfTH + this.wallH);       // bottom + wall
      g.lineTo(sx - halfTW, sy + this.wallH);       // left + wall
      g.closePath();
      g.fillPath();
    }
  }

  // ─── Frame top surface rendering ─────────────────────────────────

  /**
   * Draw top surfaces for all frame pieces + inner lip line.
   * Each top surface is a filled isometric diamond (same shape as a tile).
   * The inner lip is a line along the inner diamond boundary.
   */
  private drawFrameTops(): void {
    if (!this.frameTopGraphics) return;
    const g = this.frameTopGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // Draw frame top surfaces (sorted by y for correct overlap)
    for (const piece of this.framePieces) {
      const { sx, sy, isCorner } = piece;
      const topColor = isCorner ? FRAME_CORNER_TOP_COLOR : FRAME_TOP_COLOR;

      // Filled isometric diamond (top surface)
      g.fillStyle(topColor, FRAME_TOP_ALPHA);
      g.beginPath();
      g.moveTo(sx, sy - halfTH);                   // top vertex
      g.lineTo(sx + halfTW, sy);                    // right vertex
      g.lineTo(sx, sy + halfTH);                    // bottom vertex
      g.lineTo(sx - halfTW, sy);                    // left vertex
      g.closePath();
      g.fillPath();

      // Subtle edge highlight on the top surface
      g.lineStyle(1, 0x6a6a7a, 0.3);
      g.beginPath();
      g.moveTo(sx, sy - halfTH);
      g.lineTo(sx + halfTW, sy);
      g.lineTo(sx, sy + halfTH);
      g.lineTo(sx - halfTW, sy);
      g.closePath();
      g.strokePath();
    }

    // Draw inner lip: a line along the inner diamond boundary
    // where frame meets platform
    g.lineStyle(2, FRAME_LIP_COLOR, FRAME_LIP_ALPHA);
    g.beginPath();
    g.moveTo(this.arenaCX, this.arenaCY - this.innerHH);         // top
    g.lineTo(this.arenaCX + this.innerHW, this.arenaCY);         // right
    g.lineTo(this.arenaCX, this.arenaCY + this.innerHH);         // bottom
    g.lineTo(this.arenaCX - this.innerHW, this.arenaCY);         // left
    g.closePath();
    g.strokePath();
  }

  // ─── Debug grid overlay ──────────────────────────────────────────

  /** Draw the debug grid overlay: tile outlines + inner diamond boundary. */
  private drawGridOverlay(): void {
    if (!this.gridGraphics) return;
    const g = this.gridGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // Platform tile outlines (green)
    g.lineStyle(1, GRID_COLOR, GRID_ALPHA);

    for (const placement of this.tilePlacements) {
      const sx = (placement.col - placement.row) * halfTW + this.platformOriginX;
      const sy = (placement.col + placement.row) * halfTH + this.platformOriginY;

      g.beginPath();
      g.moveTo(sx, sy - halfTH);
      g.lineTo(sx + halfTW, sy);
      g.lineTo(sx, sy + halfTH);
      g.lineTo(sx - halfTW, sy);
      g.closePath();
      g.strokePath();
    }

    // Inner diamond boundary (yellow)
    g.lineStyle(2, DEBUG_INNER_DIAMOND_COLOR, 0.7);
    g.beginPath();
    g.moveTo(this.arenaCX, this.arenaCY - this.innerHH);
    g.lineTo(this.arenaCX + this.innerHW, this.arenaCY);
    g.lineTo(this.arenaCX, this.arenaCY + this.innerHH);
    g.lineTo(this.arenaCX - this.innerHW, this.arenaCY);
    g.closePath();
    g.strokePath();
  }

  // ─── Frame debug outlines ────────────────────────────────────────

  /** Draw frame debug outlines: piece boundaries + outer diamond + corner highlights. */
  private drawFrameDebug(): void {
    if (!this.frameDebugGraphics) return;
    const g = this.frameDebugGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // Frame piece outlines (orange for regular, magenta for corners)
    for (const piece of this.framePieces) {
      const { sx, sy, isCorner } = piece;
      const color = isCorner ? DEBUG_CORNER_COLOR : DEBUG_FRAME_OUTLINE_COLOR;

      g.lineStyle(2, color, 0.8);
      g.beginPath();
      g.moveTo(sx, sy - halfTH);
      g.lineTo(sx + halfTW, sy);
      g.lineTo(sx, sy + halfTH);
      g.lineTo(sx - halfTW, sy);
      g.closePath();
      g.strokePath();

      // Draw cross at center to mark position
      g.lineStyle(1, color, 0.5);
      g.beginPath();
      g.moveTo(sx - 4, sy);
      g.lineTo(sx + 4, sy);
      g.moveTo(sx, sy - 4);
      g.lineTo(sx, sy + 4);
      g.strokePath();
    }

    // Inner diamond boundary (yellow)
    g.lineStyle(2, DEBUG_INNER_DIAMOND_COLOR, 0.7);
    g.beginPath();
    g.moveTo(this.arenaCX, this.arenaCY - this.innerHH);
    g.lineTo(this.arenaCX + this.innerHW, this.arenaCY);
    g.lineTo(this.arenaCX, this.arenaCY + this.innerHH);
    g.lineTo(this.arenaCX - this.innerHW, this.arenaCY);
    g.closePath();
    g.strokePath();

    // Outer diamond boundary (cyan)
    g.lineStyle(2, DEBUG_OUTER_DIAMOND_COLOR, 0.7);
    g.beginPath();
    g.moveTo(this.arenaCX, this.arenaCY - this.outerHH);
    g.lineTo(this.arenaCX + this.outerHW, this.arenaCY);
    g.lineTo(this.arenaCX, this.arenaCY + this.outerHH);
    g.lineTo(this.arenaCX - this.outerHW, this.arenaCY);
    g.closePath();
    g.strokePath();
  }

  // ─── Info text ───────────────────────────────────────────────────

  /** Update the info overlay text. */
  private updateInfoText(): void {
    if (!this.infoText) return;

    const tileRatio = this.runtimeTileW / this.runtimeTileH;
    const cornerCount = this.framePieces.filter(f => f.isCorner).length;

    const lines = [
      'VISUAL-04A — Modular Grid-Aligned Arena Frame',
      '',
      `Arena: ${ARENA_N}×${ARENA_N} (platform ${GRID_N} + border ${FRAME_BORDER})`,
      `Platform tiles: ${this.tilePlacements.length}`,
      `Frame pieces: ${this.framePieces.length} (${cornerCount} corners)`,
      '',
      `Tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)} px`,
      `Tile ratio: ${tileRatio.toFixed(4)} (exact 2:1)`,
      `Source tile: ${SOURCE_TILE_W}×${SOURCE_TILE_H} px`,
      '',
      `Inner diamond: ${(2*this.innerHW).toFixed(0)}×${(2*this.innerHH).toFixed(0)} px`,
      `Outer diamond: ${(2*this.outerHW).toFixed(0)}×${(2*this.outerHH).toFixed(0)} px`,
      `Wall height: ${this.wallH.toFixed(1)} px`,
      '',
      `Grid overlay:    ${this.gridVisible ? 'ON' : 'OFF'}  [G] toggle`,
      `Frame debug:     ${this.frameDebugVisible ? 'ON' : 'OFF'}  [F] toggle`,
      '[ESC] exit → preload → menu',
      '',
      'Frame: modular grid-aligned pieces (no PNG overlay)',
      'Mask: GeometryMask (inner diamond clip)',
      'Art: placeholder (not final)',
      'Dev-only prototype. No runtime integration.',
    ];

    this.infoText.setText(lines.join('\n'));
  }
}
