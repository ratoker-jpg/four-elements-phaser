/**
 * Visual04aPreviewScene — modular grid-aligned arena frame prototype.
 *
 * VISUAL-04F: Integrate single PNG wall face block.
 * Replaces procedural side wall faces with a PNG wall face asset
 * (frame_wall_face_block_left.png). The left-facing PNG is placed
 * normally; the right-facing side mirrors the same PNG and applies
 * a lighter tint to simulate directional lighting. Procedural walls remain as
 * fallback. W key toggles PNG/procedural wall mode.
 *
 * VISUAL-04D: Integrate single PNG frame top block asset.
 * Replaces procedural top surfaces with a universal PNG frame top block
 * while keeping procedural wall faces from VISUAL-04B underneath.
 *
 * VISUAL-04B: Procedural polish pass on the modular frame placeholder.
 * Improves visual quality of the Phaser Graphics placeholder art while
 * keeping the exact same grid-aligned geometry from VISUAL-04A.
 *
 * VISUAL-04F additions:
 *   - Load frame_wall_face_block_left.png (384×288 canvas) for wall faces
 *   - PNG wall face replaces procedural walls when available and toggled ON
 *   - Left side: normal PNG wall image
 *   - Right side: horizontally mirrored PNG wall image with lighter tint
 *   - W key toggles between PNG and procedural wall faces
 *   - Fallback to procedural walls if PNG wall fails to load
 *   - Wall side tint: darker tint on left side (shadow), lighter on right (lit)
 *
 * VISUAL-04D additions:
 *   - Load frame_top_block.png (384×348 canvas, 368×184 diamond) for frame top surfaces
 *   - PNG overlay replaces procedural tops when available and toggled ON
 *   - P key toggles between PNG and procedural frame tops
 *   - Fallback to procedural tops if PNG fails to load
 *   - Inner lip always drawn regardless of PNG/procedural mode
 *
 * All variation is deterministic — hash-based, no Math.random.
 *
 * Geometry intentionally UNCHANGED from VISUAL-04A:
 *   - GRID_N = 9, FRAME_BORDER = 1, ARENA_N = 11
 *   - Coordinate math (tile positioning, mask, diamond geometry)
 *   - Asset loading, BootScene route, gameConfig
 *
 *   Layer 0 — background world image (optional, with procedural fallback)
 *   Layer 1 — platform tile layer (9×9 grid, clipped to inner diamond)
 *   Layer 2a — frame wall faces (dark, behind tops)
 *             (PNG wall images OR procedural, toggled with W)
 *   Layer 2b — frame top surfaces + inner lip (in front)
 *             (PNG overlay OR procedural, toggled with P)
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
 *   P — toggle PNG/procedural frame top
 *   W — toggle PNG/procedural wall faces
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

/** Corner wall height multiplier (corners are more substantial) */
const CORNER_WALL_MULT = 1.35;

// ─── Asset keys ───────────────────────────────────────────────────

const ASSET_KEY_BG = 'visual04a_bg';
const ASSET_KEY_FRAME_TOP_BLOCK = 'visual04a_frame_top_block';
const ASSET_KEY_WALL_FACE_LEFT = 'visual04a_wall_face_left';
const TILE_ASSET_KEY_PREFIX = 'visual04a_tile_';

// ─── Frame top block PNG constants (VISUAL-04D) ───────────────────

/** Source height of the frame top block PNG canvas (used for origin Y calc) */
const FRAME_TOP_BLOCK_SRC_H = 348;

/**
 * Normalized isometric diamond geometry within the frame top block PNG.
 * Measured from the actual asset — the diamond is centered horizontally
 * but the center Y is NOT at half the tile height due to the wall/skirt
 * pixels below the diamond in the 348px canvas.
 *
 *   Diamond width  = 368 px (8px margin on each side of 384px canvas)
 *   Diamond height = 184 px (2:1 ratio: 368/2 = 184)
 *   Diamond center Y = 120 px from top of canvas
 */
const FRAME_TOP_BLOCK_DIAMOND_W = 368;
// DIAMOND_H = 184 is implicit (368/2, strict 2:1) — kept as documentation above
const FRAME_TOP_BLOCK_DIAMOND_CY = 120;

/**
 * Origin Y for the frame top block PNG so the diamond center aligns with
 * the frame cell center (sx, sy).
 *
 * Origin Y = diamond_center_y / canvas_height = 120 / 348 ≈ 0.3448
 *
 * This is a dev-only anchor correction — named and documented.
 * Origin X = 0.5 (horizontal center, standard for isometric diamonds).
 */
const FRAME_TOP_BLOCK_ORIGIN_Y = FRAME_TOP_BLOCK_DIAMOND_CY / FRAME_TOP_BLOCK_SRC_H;

// ─── Wall face PNG constants (VISUAL-04F) ──────────────────────────

/**
 * Wall face PNG canvas: 384×288 px.
 * Visible wall-face polygon within the canvas:
 *   top-left:     [96, 40]
 *   top-right:    [288, 136]
 *   bottom-right: [288, 248]
 *   bottom-left:  [96, 152]
 *
 * Top edge vector = [192, 96] (top-left → top-right)
 * The top edge should align with one runtime frame-cell side edge.
 *
 * Anchor: use top-left polygon point for edge placement.
 *   originX = 96 / 384 = 0.25
 *   originY = 40 / 288 ≈ 0.1389
 *
 * Uniform scale maps the source top-edge vector [192, 96] to the
 * runtime side edge. Initial scale = runtimeTileW / 384 (canvas width).
 * If adjustment is needed, use small named dev-only constants.
 */
const WALL_FACE_SRC_W = 384;
const WALL_FACE_SRC_H = 288;

/** Top-left of visible wall polygon — used as anchor for edge placement. */
const WALL_FACE_ANCHOR_X = 96 / WALL_FACE_SRC_W;   // 0.25
const WALL_FACE_ANCHOR_Y = 40 / WALL_FACE_SRC_H;    // ≈ 0.1389

/**
 * Dev-only scale adjustment for wall PNG alignment.
 * Set to 1.0 for default; adjust if the wall PNG needs fine-tuning
 * relative to the frame-cell side edge.
 */
const WALL_FACE_SCALE_ADJUST = 1.0;

/**
 * Tint color applied to the left-side wall face to create depth/volume
 * illusion. Applied via setTint (multiplicative), so this darkens
 * the left face as if lit from the upper-right.
 * ~53% brightness, blue-gray tint for industrial concrete/metal look.
 */
const WALL_FACE_LEFT_TINT = 0x888899;

/**
 * Tint color applied to the right-side (mirrored) wall face.
 * Slightly lighter than the left face to simulate directional lighting
 * from the upper-right. ~75% brightness preserves most original color
 * with a subtle warm-gray tone.
 */
const WALL_FACE_RIGHT_TINT = 0xbcbcc8;

// ─── Depth layers ─────────────────────────────────────────────────

const DEPTH_BG = 0;
const DEPTH_FRAME_WALLS = 5;
const DEPTH_TILES = 10;
const DEPTH_FRAME_TOP = 15;
const DEPTH_GRID = 20;
const DEPTH_FRAME_DEBUG = 25;
const DEPTH_UI = 40;

// ─── Industrial concrete/metal palette (VISUAL-04B) ──────────────

// Top surface colors
const FRAME_TOP_BASE = 0x383846;       // Dark blue-gray metal base
const FRAME_TOP_RAISED = 0x424252;     // Slightly lighter raised center
const FRAME_TOP_DARK = 0x2c2c3a;       // Shadow/edge dark

// Wall face colors
const FRAME_WALL_BASE = 0x181822;      // Very dark blue-gray
const FRAME_WALL_LIGHT = 0x1e1e2a;     // Slightly lighter wall (right face)
const FRAME_WALL_RIB = 0x101018;       // Dark rib line between panels
const FRAME_WALL_TOP_SHADOW = 0x0e0e16; // Darkest shadow at wall top edge

// Bevel colors
const FRAME_INNER_BEVEL = 0x585868;    // Light highlight on platform-facing edges
const FRAME_OUTER_BEVEL = 0x1c1c28;    // Dark shadow on outward-facing edges

// Lip
const FRAME_LIP_COLOR = 0x686878;
const FRAME_LIP_ALPHA = 0.9;

// Corner-specific colors
const FRAME_CORNER_TOP = 0x2e2e3c;     // Darker corner top
const FRAME_CORNER_TOP_RAISED = 0x383848;
const FRAME_CORNER_WALL = 0x0e0e18;    // Very dark corner wall
const FRAME_CORNER_WALL_LIGHT = 0x141422;

// Hazard stripe colors (corners only)
const HAZARD_YELLOW = 0xbbaa00;
const HAZARD_DARK = 0x181822;

// Bolt detail colors
const BOLT_HEAD = 0x585868;
const BOLT_SHADOW = 0x2c2c3a;

// Dirt/noise overlay
const DIRT_COLOR = 0x141414;
const DIRT_ALPHA_BASE = 0.05;
const DIRT_ALPHA_VARIATION = 0.10;

// Corner outline accent
const CORNER_OUTLINE_COLOR = 0x222236;

// Debug overlay colors (unchanged)
const GRID_COLOR = 0x00ff00;
const GRID_ALPHA = 0.4;
const MASK_COLOR = 0xffffff;
const DEBUG_FRAME_OUTLINE_COLOR = 0xff6600;
const DEBUG_INNER_DIAMOND_COLOR = 0xffff00;
const DEBUG_OUTER_DIAMOND_COLOR = 0x00ffff;
const DEBUG_CORNER_COLOR = 0xff00ff;

// ─── Deterministic hash ──────────────────────────────────────────

/** Deterministic hash from (col, row) → [0, 1] for per-piece variation. */
function hashColRow(col: number, row: number): number {
  let h = (col * 374761393 + row * 668265263 + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// ─── Edge direction info ─────────────────────────────────────────

/** Which edges of an isometric diamond face inward vs outward. */
interface EdgeInfo {
  /** Edge faces toward the arena center (platform) */
  isInner: boolean;
  /** Edge faces away from the arena center */
  isOuter: boolean;
}

/**
 * Determine inner/outer direction for each of the 4 diamond edges.
 *
 * Edge indices:
 *   0 = top→right,  1 = right→bottom,
 *   2 = bottom→left, 3 = left→top
 *
 * Uses dot product of edge outward normal with piece→center vector.
 * Negative dot → edge faces center (inner); positive → faces away (outer).
 */
function getEdgeInfo(sx: number, sy: number, arenaCX: number, arenaCY: number): EdgeInfo[] {
  const dx = sx - arenaCX;
  const dy = sy - arenaCY;
  return [
    { isInner: (dx - dy) < 0, isOuter: (dx - dy) > 0 },   // Edge 0: top→right
    { isInner: (dx + dy) < 0, isOuter: (dx + dy) > 0 },   // Edge 1: right→bottom
    { isInner: (-dx + dy) < 0, isOuter: (-dx + dy) > 0 },  // Edge 2: bottom→left
    { isInner: (-dx - dy) < 0, isOuter: (-dx - dy) > 0 },  // Edge 3: left→top
  ];
}

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

  // Background availability
  private bgAvailable = false;

  // PNG frame top block (VISUAL-04D)
  private pngFrameTopAvailable = false;
  private pngFrameTopVisible = true;  // default ON if asset loads
  private pngFrameTopImages: Phaser.GameObjects.Image[] = [];

  // PNG wall face block (VISUAL-04F)
  private pngWallFaceAvailable = false;
  private pngWallFaceVisible = true;  // default ON if asset loads
  private pngWallFaceImages: Phaser.GameObjects.Image[] = [];

  // Mask
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;
  private tileContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'Visual04aPreviewScene' });
  }

  preload(): void {
    // Load background world candidate (optional — may fail on preview deploys)
    this.load.image(ASSET_KEY_BG, 'dev-visual/visual-02a/background_world_candidate_01.png');

    // Load frame top block PNG (optional — fallback to procedural if fails)
    this.load.image(ASSET_KEY_FRAME_TOP_BLOCK, 'dev-visual/visual-04/frame/frame_top_block.png');

    // Load wall face PNG (optional — fallback to procedural if fails)  [VISUAL-04F]
    this.load.image(ASSET_KEY_WALL_FACE_LEFT, 'dev-visual/visual-04/frame/frame_wall_face_block_left.png');

    // Track background, frame top block, and wall face load failures
    this.bgAvailable = true;  // assume success until loaderror
    this.pngFrameTopAvailable = true;  // assume success until loaderror
    this.pngWallFaceAvailable = true;  // assume success until loaderror
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[Visual04a] Failed to load: ${file.key} (${file.url})`);
      if (file.key === ASSET_KEY_BG) {
        this.bgAvailable = false;
        console.warn('[Visual04a] Background image unavailable, using fallback background.');
      }
      if (file.key === ASSET_KEY_FRAME_TOP_BLOCK) {
        this.pngFrameTopAvailable = false;
        console.warn('[Visual04a] Frame top block PNG unavailable, using procedural fallback.');
      }
      if (file.key === ASSET_KEY_WALL_FACE_LEFT) {
        this.pngWallFaceAvailable = false;
        console.warn('[Visual04a] Wall face PNG unavailable, using procedural wall fallback.');
      }
    });

    // Load balanced 8 tiles (same assets as Visual03a)
    const tileIds = [1, 2, 5, 6, 7, 8, 9, 10];
    for (const id of tileIds) {
      const key = `${TILE_ASSET_KEY_PREFIX}${id}`;
      const file = `dev-visual/visual-02a/tiles/platform_tile_${String(id).padStart(3, '0')}.png`;
      this.load.image(key, file);
    }
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

    // ─── Layer 0: Background (optional image or procedural fallback) ─

    if (this.bgAvailable) {
      try {
        const bgImg = this.textures.get(ASSET_KEY_BG);
        const src = bgImg.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
        if (src && src.width && src.height) {
          const bgScale = Math.max(canvasW / src.width, canvasH / src.height);
          const bg = this.add.image(canvasW / 2, canvasH / 2, ASSET_KEY_BG);
          bg.setScale(bgScale);
          bg.setDepth(DEPTH_BG);
          bg.setOrigin(0.5, 0.5);
        } else {
          this.bgAvailable = false;
          this.drawFallbackBackground(canvasW, canvasH);
        }
      } catch {
        this.bgAvailable = false;
        console.warn('[Visual04a] Background image unavailable, using fallback background.');
        this.drawFallbackBackground(canvasW, canvasH);
      }
    } else {
      this.drawFallbackBackground(canvasW, canvasH);
    }

    // ─── Layer 2a: Frame wall faces (drawn before tiles) ──────────

    this.frameWallGraphics = this.add.graphics();
    this.frameWallGraphics.setDepth(DEPTH_FRAME_WALLS);
    this.drawFrameWalls();

    // ─── Layer 2a-PNG: PNG wall face images (VISUAL-04F) ──────────

    this.createPngWallFaces();

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

    // ─── Layer 2c: PNG frame top block overlay (VISUAL-04D) ────────

    this.createPngFrameTops();

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

    this.input.keyboard?.on('keydown-P', () => {
      if (!this.pngFrameTopAvailable) return;  // no PNG to toggle
      this.pngFrameTopVisible = !this.pngFrameTopVisible;
      this.applyFrameTopMode();
      this.updateInfoText();
    });

    this.input.keyboard?.on('keydown-W', () => {
      if (!this.pngWallFaceAvailable) return;  // no PNG wall to toggle
      this.pngWallFaceVisible = !this.pngWallFaceVisible;
      this.applyWallFaceMode();
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

  // ─── Fallback background ──────────────────────────────────────────

  /**
   * Draw a procedural fallback background when the background image
   * is unavailable (e.g. ERR_HTTP2_PROTOCOL_ERROR on preview deploys).
   * Uses a dark fill + subtle ground rectangle under the arena area.
   */
  private drawFallbackBackground(canvasW: number, canvasH: number): void {
    const bg = this.add.graphics();
    bg.setDepth(DEPTH_BG);

    // Dark solid fill
    bg.fillStyle(0x12121e, 1);
    bg.fillRect(0, 0, canvasW, canvasH);

    // Subtle ground rectangle under the arena area
    // Slightly lighter than the camera clear color to provide visual ground
    const groundPad = this.runtimeTileH * 2;
    const groundX = this.arenaCX - this.outerHW - groundPad;
    const groundY = this.arenaCY - this.outerHH - groundPad;
    const groundW = (this.outerHW + groundPad) * 2;
    const groundH = (this.outerHH + groundPad + this.wallH * CORNER_WALL_MULT) * 2;

    bg.fillStyle(0x1a1a2a, 0.6);
    bg.fillRect(groundX, groundY, groundW, groundH);

    // Very subtle border around ground area
    bg.lineStyle(1, 0x2a2a3a, 0.3);
    bg.strokeRect(groundX, groundY, groundW, groundH);
  }

  // ─── Corner piece detection ──────────────────────────────────────

  /**
   * A frame piece is a "corner" if it's at one of the 4 cardinal
   * vertices of the outer diamond (top, right, bottom, left).
   * Corners get different visual treatment.
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

  // ─── Drawing helpers ─────────────────────────────────────────────

  /** Fill an isometric diamond at (sx, sy) with half-widths halfTW, halfTH. */
  private fillDiamond(g: Phaser.GameObjects.Graphics, sx: number, sy: number, halfTW: number, halfTH: number): void {
    g.beginPath();
    g.moveTo(sx, sy - halfTH);
    g.lineTo(sx + halfTW, sy);
    g.lineTo(sx, sy + halfTH);
    g.lineTo(sx - halfTW, sy);
    g.closePath();
    g.fillPath();
  }

  /** Stroke one edge of an isometric diamond (edge 0-3). */
  private strokeDiamondEdge(g: Phaser.GameObjects.Graphics, sx: number, sy: number, halfTW: number, halfTH: number, edgeIndex: number): void {
    const vx = [sx, sx + halfTW, sx, sx - halfTW];
    const vy = [sy - halfTH, sy, sy + halfTH, sy];
    const from = edgeIndex;
    const to = (edgeIndex + 1) % 4;
    g.beginPath();
    g.moveTo(vx[from], vy[from]);
    g.lineTo(vx[to], vy[to]);
    g.strokePath();
  }

  /** Vary a base color by a signed amount (-1..+1), clamping each channel. */
  private varyColor(baseColor: number, amount: number): number {
    const r = ((baseColor >> 16) & 0xFF) + Math.round(amount * 12);
    const gr = ((baseColor >> 8) & 0xFF) + Math.round(amount * 12);
    const b = (baseColor & 0xFF) + Math.round(amount * 12);
    return (Math.max(0, Math.min(255, r)) << 16) |
           (Math.max(0, Math.min(255, gr)) << 8) |
           Math.max(0, Math.min(255, b));
  }

  /** Draw hazard stripes on a corner piece top surface. */
  private drawHazardStripes(
    g: Phaser.GameObjects.Graphics, sx: number, sy: number,
    halfTW: number, halfTH: number
  ): void {
    // Direction from arena center to piece center
    const dx = sx - this.arenaCX;
    const dy = sy - this.arenaCY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    // Perpendicular direction (for stripe orientation)
    const px = -ny;
    const py = nx;

    // Stripes positioned toward the outer edge of the piece
    const stripeBaseX = sx + nx * halfTH * 0.35;
    const stripeBaseY = sy + ny * halfTH * 0.35;

    const stripeLen = halfTW * 0.30;
    const stripeSpacing = halfTH * 0.13;
    const stripeThick = Math.max(2, Math.round(halfTH * 0.05));

    // Draw 3 alternating yellow/dark stripes
    for (let i = -1; i <= 1; i++) {
      const cx = stripeBaseX + nx * i * stripeSpacing;
      const cy = stripeBaseY + ny * i * stripeSpacing;
      const color = ((i + 1) % 2 === 0) ? HAZARD_YELLOW : HAZARD_DARK;

      g.lineStyle(stripeThick, color, 0.65);
      g.beginPath();
      g.moveTo(cx - px * stripeLen, cy - py * stripeLen);
      g.lineTo(cx + px * stripeLen, cy + py * stripeLen);
      g.strokePath();
    }
  }

  // ─── PNG wall face block (VISUAL-04F) ───────────────────────────

  /**
   * Create PNG wall face images for each frame piece.
   * If the PNG failed to load, this is a no-op and procedural walls remain.
   *
   * The wall face PNG (384×288 canvas) contains a visible wall polygon:
   *   top-left: [96, 40], top-right: [288, 136],
   *   bottom-right: [288, 248], bottom-left: [96, 152]
   *
   * Placement strategy:
   *   - For each frame piece, determine which wall faces are visible (outer)
   *     using getEdgeInfo(). Only outer-facing wall sides get a PNG image;
   *     inner-facing sides are hidden by the platform/tiles above.
   *   - Left wall face: created only if the bottom→left edge (Edge 2) is outer.
   *     Placed with anchor at the top-left polygon point, aligned to the
   *     left→bottom side edge of the diamond.
   *   - Right wall face: created only if the right→bottom edge (Edge 1) is outer.
   *     Mirrored via setScale(-scale, scale) with the SAME origin as the left
   *     wall. Phaser's negative X scale flips the image around the origin,
   *     so the anchor (top-left polygon point) maps to the right vertex and
   *     the wall extends down-left. A lighter tint is applied (lit side).
   *
   * This filtering prevents "black vertical fins" on the top/far edges of
   * the arena where wall faces would face inward (toward the platform) and
   * should not be visible.
   *
   * Scale = runtimeTileW / 384 (canvas width), adjusted by WALL_FACE_SCALE_ADJUST.
   */
  private createPngWallFaces(): void {
    if (!this.pngWallFaceAvailable) return;

    // Verify the texture actually loaded and is usable
    try {
      const tex = this.textures.get(ASSET_KEY_WALL_FACE_LEFT);
      const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
      if (!src || !src.width || !src.height) {
        this.pngWallFaceAvailable = false;
        console.warn('[Visual04a] Wall face PNG texture invalid, using procedural wall fallback.');
        return;
      }
    } catch {
      this.pngWallFaceAvailable = false;
      console.warn('[Visual04a] Wall face PNG texture error, using procedural wall fallback.');
      return;
    }

    const halfTW = this.runtimeTileW / 2;

    // Uniform scale: map canvas width to runtime tile width
    const scale = (this.runtimeTileW / WALL_FACE_SRC_W) * WALL_FACE_SCALE_ADJUST;

    let leftCount = 0;
    let rightCount = 0;

    for (const piece of this.framePieces) {
      const { sx, sy } = piece;

      // Determine which diamond edges face outward (visible walls)
      // Edge indices: 0=top→right, 1=right→bottom, 2=bottom→left, 3=left→top
      const edges = getEdgeInfo(sx, sy, this.arenaCX, this.arenaCY);

      // ─── Left wall face PNG ─────────────────────────────────────
      // The left wall face hangs from the left→bottom edge (= Edge 2 reversed).
      // Only draw if Edge 2 (bottom→left) faces outward.
      if (edges[2].isOuter) {
        // Anchor (top-left polygon point) maps to the left vertex of the diamond.
        const img = this.add.image(sx - halfTW, sy, ASSET_KEY_WALL_FACE_LEFT);
        img.setScale(scale);
        img.setOrigin(WALL_FACE_ANCHOR_X, WALL_FACE_ANCHOR_Y);
        img.setDepth(DEPTH_FRAME_WALLS);
        img.setVisible(this.pngWallFaceVisible);
        // Apply darker multiplicative tint for depth (left face in shadow).
        img.setTint(WALL_FACE_LEFT_TINT);
        this.pngWallFaceImages.push(img);
        leftCount++;
      }

      // ─── Right wall face PNG (mirrored + lighter tint) ────────────
      // The right wall face hangs from the right→bottom edge (= Edge 1).
      // Only draw if Edge 1 (right→bottom) faces outward.
      // Use setScale(-scale, scale) with the SAME origin as the left wall.
      // Phaser's negative X scale flips the image around the origin point,
      // so the anchor (top-left polygon point at origin) stays at position
      // (right vertex) and the wall content mirrors to extend down-left.
      if (edges[1].isOuter) {
        const img = this.add.image(sx + halfTW, sy, ASSET_KEY_WALL_FACE_LEFT);
        img.setScale(-scale, scale);  // flip horizontally via negative X scale
        // Same origin as left wall — negative scale handles the mirror correctly.
        img.setOrigin(WALL_FACE_ANCHOR_X, WALL_FACE_ANCHOR_Y);
        img.setDepth(DEPTH_FRAME_WALLS);
        img.setVisible(this.pngWallFaceVisible);
        // Apply lighter multiplicative tint (right face is lit side).
        img.setTint(WALL_FACE_RIGHT_TINT);
        this.pngWallFaceImages.push(img);
        rightCount++;
      }
    }

    console.log(`[Visual04a] PNG wall face: ${this.pngWallFaceImages.length} images created (left=${leftCount}, right=${rightCount}, scale=${scale.toFixed(4)})`);

    // Apply initial mode (may hide procedural walls if PNG walls are active)
    this.applyWallFaceMode();
  }

  /**
   * Apply the current wall face mode (PNG or procedural).
   * When PNG walls are ON and available: hide procedural wall graphics, show PNG images.
   * When PNG walls are OFF or unavailable: show procedural wall graphics, hide PNG images.
   */
  private applyWallFaceMode(): void {
    const usePng = this.pngWallFaceAvailable && this.pngWallFaceVisible;

    // Toggle PNG wall images
    for (const img of this.pngWallFaceImages) {
      img.setVisible(usePng);
    }

    // Toggle procedural wall graphics
    if (this.frameWallGraphics) {
      this.frameWallGraphics.setVisible(!usePng);
    }
  }

  // ─── Frame wall face rendering (VISUAL-04B polished) ────────────

  /**
   * Draw wall faces for all frame pieces with industrial detail:
   *   - Left and right face halves with directional shading
   *   - Panel rib lines dividing each face into sections
   *   - Darker top shadow where wall meets top surface
   *   - Corners get taller walls for more substantial look
   *
   * When PNG wall mode is active (VISUAL-04F), these procedural walls
   * are hidden — PNG images replace them. They remain drawn in case the
   * user toggles back to procedural mode with W.
   */
  private drawFrameWalls(): void {
    if (!this.frameWallGraphics) return;
    const g = this.frameWallGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    for (const piece of this.framePieces) {
      const { sx, sy, isCorner } = piece;
      const effWallH = isCorner ? this.wallH * CORNER_WALL_MULT : this.wallH;

      // ─── Left wall face (darker, as if lit from upper-right) ───
      const leftWallColor = isCorner ? FRAME_CORNER_WALL : FRAME_WALL_BASE;
      g.fillStyle(leftWallColor, 1);
      g.beginPath();
      g.moveTo(sx - halfTW, sy);                   // left vertex of diamond
      g.lineTo(sx, sy + halfTH);                    // bottom vertex
      g.lineTo(sx, sy + halfTH + effWallH);         // bottom + wall
      g.lineTo(sx - halfTW, sy + effWallH);         // left + wall
      g.closePath();
      g.fillPath();

      // ─── Right wall face (slightly lighter) ───────────────────
      const rightWallColor = isCorner ? FRAME_CORNER_WALL_LIGHT : FRAME_WALL_LIGHT;
      g.fillStyle(rightWallColor, 1);
      g.beginPath();
      g.moveTo(sx + halfTW, sy);                   // right vertex of diamond
      g.lineTo(sx, sy + halfTH);                    // bottom vertex
      g.lineTo(sx, sy + halfTH + effWallH);         // bottom + wall
      g.lineTo(sx + halfTW, sy + effWallH);         // right + wall
      g.closePath();
      g.fillPath();

      // ─── Panel rib lines on left face ─────────────────────────
      // Two vertical ribs dividing left face into 3 panels
      g.lineStyle(1, FRAME_WALL_RIB, 0.8);
      for (const frac of [0.33, 0.67]) {
        const ribX = sx - halfTW + halfTW * frac;
        const ribTopY = sy + halfTH * frac;
        const ribBotY = sy + effWallH + halfTH * frac;
        g.beginPath();
        g.moveTo(ribX, ribTopY);
        g.lineTo(ribX, ribBotY);
        g.strokePath();
      }

      // ─── Panel rib lines on right face ────────────────────────
      for (const frac of [0.33, 0.67]) {
        const ribX = sx + halfTW - halfTW * frac;
        const ribTopY = sy + halfTH * frac;
        const ribBotY = sy + effWallH + halfTH * frac;
        g.beginPath();
        g.moveTo(ribX, ribTopY);
        g.lineTo(ribX, ribBotY);
        g.strokePath();
      }

      // ─── Top edge shadow (darkest line where wall meets top) ──
      g.lineStyle(2, FRAME_WALL_TOP_SHADOW, 0.9);
      g.beginPath();
      g.moveTo(sx - halfTW, sy);                   // left vertex
      g.lineTo(sx, sy + halfTH);                    // bottom vertex
      g.lineTo(sx + halfTW, sy);                    // right vertex
      g.strokePath();

      // ─── Corner outline accent ────────────────────────────────
      if (isCorner) {
        g.lineStyle(1, CORNER_OUTLINE_COLOR, 0.6);
        // Outline the entire wall shape
        g.beginPath();
        g.moveTo(sx - halfTW, sy);
        g.lineTo(sx + halfTW, sy);
        g.lineTo(sx + halfTW, sy + effWallH);
        g.lineTo(sx, sy + halfTH + effWallH);
        g.lineTo(sx - halfTW, sy + effWallH);
        g.closePath();
        g.strokePath();
      }
    }
  }

  // ─── PNG frame top block (VISUAL-04D) ──────────────────────────

  /**
   * Create PNG frame top block images for each frame piece.
   * If the PNG failed to load, this is a no-op and procedural tops remain.
   *
   * The PNG (384×348 canvas) contains a normalized isometric diamond
   * (368×184) centered at y=120. Scaling uses the diamond width (368)
   * to match the runtime tile width, and origin Y = 120/348 aligns
   * the diamond center to the frame cell grid position (sx, sy).
   */
  private createPngFrameTops(): void {
    if (!this.pngFrameTopAvailable) return;

    // Verify the texture actually loaded and is usable
    try {
      const tex = this.textures.get(ASSET_KEY_FRAME_TOP_BLOCK);
      const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
      if (!src || !src.width || !src.height) {
        this.pngFrameTopAvailable = false;
        console.warn('[Visual04a] Frame top block PNG texture invalid, using procedural fallback.');
        return;
      }
    } catch {
      this.pngFrameTopAvailable = false;
      console.warn('[Visual04a] Frame top block PNG texture error, using procedural fallback.');
      return;
    }

    // Uniform scale: PNG diamond width (368) maps to runtime tile width
    const scale = this.runtimeTileW / FRAME_TOP_BLOCK_DIAMOND_W;

    for (const piece of this.framePieces) {
      const img = this.add.image(piece.sx, piece.sy, ASSET_KEY_FRAME_TOP_BLOCK);
      img.setScale(scale);
      img.setOrigin(0.5, FRAME_TOP_BLOCK_ORIGIN_Y);
      img.setDepth(DEPTH_FRAME_TOP);
      img.setVisible(this.pngFrameTopVisible);
      this.pngFrameTopImages.push(img);
    }

    console.log(`[Visual04a] PNG frame top block: ${this.pngFrameTopImages.length} images created (scale=${scale.toFixed(4)})`);

    // Apply initial mode (may hide procedural tops if PNG is active)
    this.applyFrameTopMode();
  }

  /**
   * Apply the current frame top mode (PNG or procedural).
   * When PNG is ON and available: hide procedural tops, show PNG images.
   * When PNG is OFF or unavailable: show procedural tops, hide PNG images.
   * The inner lip is always drawn (by drawFrameTops).
   */
  private applyFrameTopMode(): void {
    const usePng = this.pngFrameTopAvailable && this.pngFrameTopVisible;

    // Toggle PNG images
    for (const img of this.pngFrameTopImages) {
      img.setVisible(usePng);
    }

    // Redraw procedural tops: if PNG is active, only draw the inner lip
    // (skip procedural top surfaces since PNG covers them)
    this.drawFrameTops();
  }

  // ─── Frame top surface rendering (VISUAL-04B polished) ──────────

  /**
   * Draw top surfaces for all frame pieces + inner lip, with layered
   * industrial detail. When PNG mode is active (VISUAL-04D), only the
   * inner lip is drawn — the PNG images replace procedural top surfaces.
   *
   * Procedural detail (when PNG is OFF or unavailable):
   *   1. Base fill with deterministic dirt variation
   *   2. Outer bevel (dark border on outward-facing edges)
   *   3. Raised center surface (inset diamond, lighter — preserves 2:1)
   *   4. Inner bevel (bright highlight on platform-facing edges)
   *   5. Panel division lines
   *   6. Bolt details (deterministic placement from hash)
   *   7. Dirt spots (deterministic from hash)
   *   8. Hazard stripes (corner pieces only)
   *   9. Inner lip along platform boundary (always drawn)
   */
  private drawFrameTops(): void {
    if (!this.frameTopGraphics) return;
    const g = this.frameTopGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // When PNG mode is active, skip procedural top surfaces — only draw the lip
    const usePng = this.pngFrameTopAvailable && this.pngFrameTopVisible;

    if (!usePng) {
      // Bevel inset: must preserve 2:1 ratio of the inset diamond
      // Inset by (2*bevelInset, bevelInset) in (x, y) to maintain 2:1
      const bevelInset = Math.max(2, Math.round(this.runtimeTileH * 0.07));
      const bevelInsetX = bevelInset * 2;
      const bevelInsetY = bevelInset;

      // Bolt radius scales with tile size
      const boltR = Math.max(1.5, this.runtimeTileH * 0.028);

      // Draw frame top surfaces (sorted by y for correct overlap)
      for (const piece of this.framePieces) {
        const { sx, sy, isCorner, col, row } = piece;
        const h = hashColRow(col, row);

        // Determine inner/outer edges for this piece
        const edges = getEdgeInfo(sx, sy, this.arenaCX, this.arenaCY);

        // ─── 1. Base fill (full diamond) with dirt variation ────────
        const baseColor = isCorner ? FRAME_CORNER_TOP : FRAME_TOP_BASE;
        // Apply subtle per-piece color variation from hash (-1..+1 range)
        const dirtShift = (h - 0.5) * 2;  // -1..+1
        const adjustedBase = this.varyColor(baseColor, dirtShift * 0.5);
        g.fillStyle(adjustedBase, 1);
        this.fillDiamond(g, sx, sy, halfTW, halfTH);

        // ─── 2. Outer bevel (dark line on outward-facing edges) ────
        for (let i = 0; i < 4; i++) {
          if (edges[i].isOuter) {
            g.lineStyle(2, FRAME_OUTER_BEVEL, 0.85);
            this.strokeDiamondEdge(g, sx, sy, halfTW, halfTH, i);
          }
        }

        // ─── 3. Raised center surface (inset diamond, lighter) ─────
        // Inset preserves exact 2:1 ratio: width = 2*(halfTW - 2*bi), height = 2*(halfTH - bi)
        const raisedColor = isCorner ? FRAME_CORNER_TOP_RAISED : FRAME_TOP_RAISED;
        g.fillStyle(raisedColor, 0.65);
        this.fillDiamond(g, sx, sy, halfTW - bevelInsetX, halfTH - bevelInsetY);

        // ─── 4. Inner bevel (bright highlight on platform edges) ───
        for (let i = 0; i < 4; i++) {
          if (edges[i].isInner) {
            g.lineStyle(2, FRAME_INNER_BEVEL, 0.7);
            this.strokeDiamondEdge(g, sx, sy, halfTW, halfTH, i);
          }
        }

        // ─── 5. Panel division lines on top surface ────────────────
        // Two thin lines crossing at center, dividing diamond into quadrants
        g.lineStyle(1, FRAME_TOP_DARK, 0.25);
        // Vertical axis: top vertex → bottom vertex
        g.beginPath();
        g.moveTo(sx, sy - halfTH * 0.55);
        g.lineTo(sx, sy + halfTH * 0.55);
        g.strokePath();
        // Horizontal axis: left vertex → right vertex
        g.beginPath();
        g.moveTo(sx - halfTW * 0.55, sy);
        g.lineTo(sx + halfTW * 0.55, sy);
        g.strokePath();

        // ─── 6. Bolt details (deterministic from hash) ─────────────
        // Four possible bolt positions in the diamond quadrants
        const boltInsetX = halfTW * 0.32;
        const boltInsetY = halfTH * 0.32;
        const boltPositions = [
          { x: sx + boltInsetX, y: sy - boltInsetY },  // top-right quadrant
          { x: sx + boltInsetX, y: sy + boltInsetY },  // bottom-right quadrant
          { x: sx - boltInsetX, y: sy + boltInsetY },  // bottom-left quadrant
          { x: sx - boltInsetX, y: sy - boltInsetY },  // top-left quadrant
        ];

        // Pick 2 bolt positions from hash (deterministic, no Math.random)
        const bolt1 = Math.floor(h * 4) % 4;
        const bolt2 = Math.floor(h * 7 + 0.5) % 4;

        for (const boltIdx of [bolt1, bolt2]) {
          const bp = boltPositions[boltIdx];
          // Shadow (offset slightly)
          g.fillStyle(BOLT_SHADOW, 0.5);
          g.fillCircle(bp.x + 0.7, bp.y + 0.7, boltR + 0.3);
          // Head
          g.fillStyle(BOLT_HEAD, 0.9);
          g.fillCircle(bp.x, bp.y, boltR);
          // Highlight dot
          g.fillStyle(FRAME_INNER_BEVEL, 0.3);
          g.fillCircle(bp.x - boltR * 0.3, bp.y - boltR * 0.3, boltR * 0.35);
        }

        // ─── 7. Deterministic dirt spots ───────────────────────────
        // 0-2 small stain circles based on hash
        const dirtCount = Math.floor(h * 3);  // 0, 1, or 2 spots
        const dirtAlpha = DIRT_ALPHA_BASE + h * DIRT_ALPHA_VARIATION;

        for (let d = 0; d < dirtCount; d++) {
          const dh = hashColRow(col + d * 17, row + d * 31);
          const dh2 = hashColRow(col + d * 53, row + d * 71);
          const dirtX = sx + (dh - 0.5) * halfTW * 0.6;
          const dirtY = sy + (dh2 - 0.5) * halfTH * 0.6;
          const dirtR = halfTH * 0.06 + dh * halfTH * 0.05;
          g.fillStyle(DIRT_COLOR, dirtAlpha);
          g.fillCircle(dirtX, dirtY, dirtR);
        }

        // ─── 8. Hazard stripes (corner pieces only) ────────────────
        if (isCorner) {
          this.drawHazardStripes(g, sx, sy, halfTW, halfTH);
        }
      }
    }

    // ─── 9. Inner lip: highlight line along the platform boundary ──
    // Always drawn regardless of PNG/procedural mode
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

    const frameTopMode = this.pngFrameTopAvailable && this.pngFrameTopVisible
      ? 'PNG'
      : 'procedural fallback';

    const wallFaceMode = this.pngWallFaceAvailable && this.pngWallFaceVisible
      ? 'PNG'
      : 'procedural fallback';

    const lines = [
      'VISUAL-04F — Single PNG Wall Face Block',
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
      `Frame top:       ${frameTopMode}  [P] toggle`,
      `Wall:            ${wallFaceMode}  [W] toggle`,
      `Wall side tint:  enabled`,
      '[ESC] exit → preload → menu',
      '',
      `Background:      ${this.bgAvailable ? 'image' : 'fallback (procedural)'}`,
      `Frame top:       ${frameTopMode}`,
      `Wall:            ${wallFaceMode}`,
      'Mask: GeometryMask (inner diamond clip)',
      'Variation: deterministic hash (no Math.random)',
      'Dev-only prototype. No runtime integration.',
    ];

    this.infoText.setText(lines.join('\n'));
  }
}
