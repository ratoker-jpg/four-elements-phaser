/**
 * Visual04aPreviewScene — modular grid-aligned arena frame prototype.
 *
 * VISUAL-05A-PR1: Parameterize map size preview (96/128/192).
 * Extends the ?visual04a dev preview to support production-planned map
 * sizes with camera pan/zoom, proving the visual model scales before
 * production integration.
 *
 * VISUAL-04F: Integrate single PNG wall face block.
 * Replaces procedural side wall faces with a PNG wall face asset
 * (frame_wall_face_block_left.png). The left-facing PNG is placed
 * normally; the right-facing side mirrors the same PNG and applies
 * no darkening tint (white/original brightness) to simulate directional lighting. Procedural walls remain as
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
 * VISUAL-05A-PR1 additions:
 *   - URL param `map` controls playable size: ?visual04a&map=96
 *   - Aliases: small=96, medium=128, large=192
 *   - Default (no map param) = 9 (unchanged legacy behavior)
 *   - Camera pan (Arrow keys), zoom (mouse wheel), reset (R/Home) for maps > 9
 *   - RenderTexture for platform tiles (perf-safe for large maps)
 *   - Chunked RenderTexture when single RT exceeds MAX_RT_SIZE
 *   - Frame-focused fallback for extremely large maps
 *   - Adaptive grid: full grid for small maps, major gridlines for large
 *   - Extended info overlay with zoom, FPS, render mode, camera controls
 *
 * All variation is deterministic — hash-based, no Math.random.
 *
 *   Layer 0 — background world image (optional, with procedural fallback)
 *   Layer 1 — platform tile layer (clipped to inner diamond for small maps)
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
 *   R / Home — reset camera (maps > 9)
 *   Arrow keys — pan camera (maps > 9)
 *   Mouse wheel — zoom (maps > 9)
 *   ESC — exit to PreloadScene → menu
 *
 * This scene does NOT replace production terrain.
 * It does NOT modify gameplay, pathfinding, economy, or any production system.
 * It is activated only via the ?visual04a URL parameter.
 *
 * Access:
 *   http://localhost:3000/?visual04a           — default 9×9
 *   http://localhost:3000/?visual04a&map=96    — 96×96 playable
 *   http://localhost:3000/?visual04a&map=128   — 128×128 playable
 *   http://localhost:3000/?visual04a&map=192   — 192×192 playable
 *   http://localhost:3000/?visual04a&map=small — alias for 96
 *   http://localhost:3000/?visual04a&map=medium — alias for 128
 *   http://localhost:3000/?visual04a&map=large — alias for 192
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

/** Frame border width in tiles (1 tile thick wall around platform) */
const FRAME_BORDER = 1;

/** Source tile dimensions (from metadata / PNG files) */
const SOURCE_TILE_W = 384;
const SOURCE_TILE_H = 192;

/** Wall face height as a fraction of tile height */
const WALL_HEIGHT_RATIO = 0.6;

/** Corner wall height multiplier (corners are more substantial) */
const CORNER_WALL_MULT = 1.35;

// ─── Camera / render constants (VISUAL-05A-PR1) ─────────────────

/** Minimum zoom level for large maps */
const MIN_ZOOM = 0.15;

/** Maximum zoom level for large maps */
const MAX_ZOOM = 1.5;

/** Maximum RenderTexture dimension before chunking (px) */
const MAX_RT_SIZE = 8192;

/** Base camera pan speed (px/frame at zoom=1) */
const BASE_PAN_SPEED = 8;

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
 * Tint color applied to the left-side (shadow) wall face.
 * Applied via setTint (multiplicative), so this darkens the left face
 * to simulate directional lighting from the upper-right.
 * ~47% brightness, blue-gray tint for industrial concrete/metal shadow.
 */
const WALL_FACE_LEFT_TINT = 0x777788;

/**
 * Tint color applied to the right-side (lit) wall face.
 * 0xffffff = no darkening. Phaser setTint is multiplicative, so white
 * preserves the original PNG pixel colors exactly — this is the lit side,
 * not an extra glow.
 */
const WALL_FACE_RIGHT_TINT = 0xffffff;

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

// ─── Render mode types ────────────────────────────────────────────

type RenderMode = 'full-individual' | 'render-texture' | 'chunked-rt' | 'frame-focused';

// ─── URL parameter parsing ────────────────────────────────────────

/**
 * Parse the `map` URL parameter to determine playable size.
 * Returns 9 (default) if no param is specified.
 * Supports: 9, 96, 128, 192, small, medium, large
 */
function parseMapSizeParam(): number {
  if (typeof window === 'undefined') return 9;
  const params = new URLSearchParams(window.location.search);
  const mapParam = params.get('map');
  if (!mapParam) return 9;

  const lower = mapParam.toLowerCase();
  switch (lower) {
    case 'small': return 96;
    case 'medium': return 128;
    case 'large': return 192;
    default: {
      const n = parseInt(mapParam, 10);
      return Number.isFinite(n) && n > 0 ? n : 9;
    }
  }
}

// ─── Scene ────────────────────────────────────────────────────────

export class Visual04aPreviewScene extends Phaser.Scene {
  // ─── Parameterized map sizing (VISUAL-05A-PR1) ───────────────
  private playableSize = 9;
  private frameBorder = FRAME_BORDER;
  private outerSize = 9 + 2 * FRAME_BORDER;

  // ─── Render mode ──────────────────────────────────────────────
  private renderMode: RenderMode = 'full-individual';
  private _estimatedObjectCount = 0;

  // ─── Camera state (VISUAL-05A-PR1) ───────────────────────────
  private currentZoom = 1;
  private defaultZoom = 1;
  private panKeys: Record<string, boolean> = {
    up: false, down: false, left: false, right: false,
  };
  private fpsFrameCount = 0;

  // ─── Toggle state ─────────────────────────────────────────────
  private gridVisible = false;
  private frameDebugVisible = false;
  private gridIsFullDetail = false;  // for large maps, track if G was toggled to full

  // ─── Graphics layers ──────────────────────────────────────────
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private frameDebugGraphics: Phaser.GameObjects.Graphics | null = null;
  private frameWallGraphics: Phaser.GameObjects.Graphics | null = null;
  private frameTopGraphics: Phaser.GameObjects.Graphics | null = null;
  private infoText: Phaser.GameObjects.Text | null = null;

  // ─── Computed tile dimensions (always exact 2:1) ─────────────
  private runtimeTileW = 0;
  private runtimeTileH = 0;
  private wallH = 0;

  // ─── Platform origin (center of tile 0,0) in display coords ──
  private platformOriginX = 0;
  private platformOriginY = 0;

  // ─── Arena diamond geometry (display coords) ──────────────────
  private arenaCX = 0;
  private arenaCY = 0;
  private innerHW = 0;
  private innerHH = 0;
  private outerHW = 0;
  private outerHH = 0;

  // ─── Tile data ────────────────────────────────────────────────
  private tilePlacements: { col: number; row: number; tileId: number }[] = [];
  private framePieces: FramePiece[] = [];

  // ─── Background availability ──────────────────────────────────
  private bgAvailable = false;

  // ─── PNG frame top block (VISUAL-04D) ─────────────────────────
  private pngFrameTopAvailable = false;
  private pngFrameTopVisible = true;  // default ON if asset loads
  private pngFrameTopImages: Phaser.GameObjects.Image[] = [];

  // ─── PNG wall face block (VISUAL-04F) ─────────────────────────
  private pngWallFaceAvailable = false;
  private pngWallFaceVisible = true;  // default ON if asset loads
  private pngWallFaceImages: Phaser.GameObjects.Image[] = [];

  // ─── Mask ──────────────────────────────────────────────────────
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;
  private tileContainer: Phaser.GameObjects.Container | null = null;

  // ─── RenderTexture references (VISUAL-05A-PR1) ────────────────
  private renderTextures: Phaser.GameObjects.RenderTexture[] = [];

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

    // ─── Parse URL parameter for map size (VISUAL-05A-PR1) ─────
    this.playableSize = parseMapSizeParam();
    this.frameBorder = FRAME_BORDER;
    this.outerSize = this.playableSize + 2 * this.frameBorder;

    const isLargeMap = this.playableSize > 9;

    // ─── Compute tile dimensions ──────────────────────────────────

    // For the default 9×9, fit the arena in the canvas (unchanged behavior).
    // For large maps, use a fixed tile size that gives good visual detail.
    if (!isLargeMap) {
      const margin = 0.82;
      this.runtimeTileH = Math.min(
        canvasH * margin / this.outerSize,
        canvasW * margin / (2 * this.outerSize)
      );
    } else {
      // For large maps, use a fixed small tile height for detail.
      // Tile height of ~8px gives 96*8=768px arena height, manageable.
      // But we need the tile to be at least renderable.
      this.runtimeTileH = Math.max(4, Math.min(16, canvasH / (this.outerSize * 1.2)));
    }
    this.runtimeTileW = 2 * this.runtimeTileH;
    this.wallH = this.runtimeTileH * WALL_HEIGHT_RATIO;

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // ─── Arena diamond geometry ───────────────────────────────────

    // Center of the arena
    this.arenaCX = canvasW / 2;
    this.arenaCY = canvasH / 2;

    // Inner diamond half-extents (platform area)
    this.innerHH = this.playableSize * this.runtimeTileH / 2;
    this.innerHW = this.playableSize * this.runtimeTileW / 2;

    // Outer diamond half-extents (full arena including frame)
    this.outerHH = this.outerSize * this.runtimeTileH / 2;
    this.outerHW = this.outerSize * this.runtimeTileW / 2;

    // Platform origin: center of tile (0,0)
    this.platformOriginX = this.arenaCX;
    this.platformOriginY = this.arenaCY - this.innerHH + halfTH;

    const tileRatio = this.runtimeTileW / this.runtimeTileH;
    console.log(`[Visual04a] Arena: ${this.outerSize}×${this.outerSize} (platform ${this.playableSize}+border ${this.frameBorder})`);
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

    // ─── Grid-range classification ─────────────────────────────────
    //
    // Use explicit grid coordinate ranges instead of fuzzy screen-space
    // diamond hit-tests. The old `isInInnerDiamond(sx, sy) <= 1.1` and
    // `isInOuterDiamond(sx, sy) <= 1.05` had tolerance slop that swallowed
    // the 1-tile frame border on large maps (96/128/192), producing 0 frame
    // pieces. Grid-range checks are exact and scale-correct.

    const isPlayableCell = (col: number, row: number): boolean => {
      return col >= 0 && col < this.playableSize &&
             row >= 0 && row < this.playableSize;
    };

    const isOuterArenaCell = (col: number, row: number): boolean => {
      return col >= -this.frameBorder && col < this.playableSize + this.frameBorder &&
             row >= -this.frameBorder && row < this.playableSize + this.frameBorder;
    };

    // ─── Classify grid cells ──────────────────────────────────────

    this.tilePlacements = [];
    this.framePieces = [];

    for (let row = -this.frameBorder; row < this.playableSize + this.frameBorder; row++) {
      for (let col = -this.frameBorder; col < this.playableSize + this.frameBorder; col++) {
        const sx = (col - row) * halfTW + this.platformOriginX;
        const sy = (col + row) * halfTH + this.platformOriginY;

        if (isPlayableCell(col, row)) {
          const tileId = picker.pick();
          this.tilePlacements.push({ col, row, tileId });
        } else if (isOuterArenaCell(col, row)) {
          const isCorner = this.isCornerPiece(col, row, sx, sy);
          this.framePieces.push({ col, row, sx, sy, isCorner });
        }
      }
    }

    // Sort frame pieces by y-position for correct isometric draw order
    this.framePieces.sort((a, b) => a.sy - b.sy);

    console.log(`[Visual04a] Platform tiles: ${this.tilePlacements.length}`);
    console.log(`[Visual04a] Frame pieces: ${this.framePieces.length} (corners: ${this.framePieces.filter(f => f.isCorner).length})`);

    // ─── Determine render mode (VISUAL-05A-PR1) ──────────────────
    this.determineRenderMode();
    console.log(`[Visual04a] Render mode: ${this.renderMode}`);

    // ─── Layer 0: Background (optional image or procedural fallback) ─

    if (this.bgAvailable) {
      try {
        const bgImg = this.textures.get(ASSET_KEY_BG);
        const src = bgImg.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
        if (src && src.width && src.height) {
          // For large maps, extend background to cover the full world
          const bgScale = isLargeMap
            ? Math.max(
                (this.outerHW * 2 + this.runtimeTileW * 6) / src.width,
                (this.outerHH * 2 + this.wallH * CORNER_WALL_MULT * 2 + this.runtimeTileH * 6) / src.height
              )
            : Math.max(canvasW / src.width, canvasH / src.height);
          const bg = this.add.image(this.arenaCX, this.arenaCY, ASSET_KEY_BG);
          bg.setScale(bgScale);
          bg.setDepth(DEPTH_BG);
          bg.setOrigin(0.5, 0.5);
          bg.setScrollFactor(1);
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

    // ─── Layer 1: Platform tiles ──────────────────────────────────
    this.renderPlatformTiles();

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

    if (isLargeMap) {
      // Calculate initial zoom to show a reasonable portion of the map
      // Fit the full arena in the canvas
      const zoomToFitH = canvasH / (this.outerHH * 2 + this.wallH * CORNER_WALL_MULT * 2);
      const zoomToFitW = canvasW / (this.outerHW * 2);
      this.defaultZoom = Math.min(zoomToFitH, zoomToFitW) * 0.85;
      this.defaultZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.defaultZoom));
      this.currentZoom = this.defaultZoom;
      cam.setZoom(this.currentZoom);
      cam.centerOn(this.arenaCX, this.arenaCY);

      // Mouse wheel zoom
      this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _dx: number, dy: number, _dz: number) => {
        const zoomDelta = dy > 0 ? 0.9 : 1.1;
        this.currentZoom = Phaser.Math.Clamp(this.currentZoom * zoomDelta, MIN_ZOOM, MAX_ZOOM);
        cam.setZoom(this.currentZoom);
        this.updateInfoText();
      });

      // Pan key tracking via keydown/keyup for smooth continuous panning
      const setPanKey = (_keyCode: string, direction: string, pressed: boolean) => {
        if (direction) this.panKeys[direction] = pressed;
      };

      // NOTE: Only Arrow keys used for panning (not WASD).
      // W and P are already toggle keys (wall/top PNG mode) and must not
      // conflict with camera movement. Arrow keys are unambiguous.
      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
        switch (event.code) {
          case 'ArrowUp':    setPanKey(event.code, 'up', true); break;
          case 'ArrowDown':  setPanKey(event.code, 'down', true); break;
          case 'ArrowLeft':  setPanKey(event.code, 'left', true); break;
          case 'ArrowRight': setPanKey(event.code, 'right', true); break;
        }
      });

      this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
        switch (event.code) {
          case 'ArrowUp':    setPanKey(event.code, 'up', false); break;
          case 'ArrowDown':  setPanKey(event.code, 'down', false); break;
          case 'ArrowLeft':  setPanKey(event.code, 'left', false); break;
          case 'ArrowRight': setPanKey(event.code, 'right', false); break;
        }
      });

      // R / Home = reset camera
      this.input.keyboard?.on('keydown-R', () => {
        this.resetCamera();
      });
      this.input.keyboard?.on('keydown-HOME', () => {
        this.resetCamera();
      });
    } else {
      cam.setScroll(0, 0);
      this.defaultZoom = 1;
      this.currentZoom = 1;
    }

    // ─── Keyboard controls (shared) ────────────────────────────────

    this.input.keyboard?.on('keydown-G', () => {
      if (this.playableSize > 20) {
        // Toggle between adaptive grid and (attempted) full grid
        this.gridIsFullDetail = !this.gridIsFullDetail;
        if (this.gridIsFullDetail) {
          console.warn('[Visual04a] Full grid for large map may be slow');
        }
      }
      this.gridVisible = !this.gridVisible;
      this.gridGraphics?.setVisible(this.gridVisible);
      this.drawGridOverlay();
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
      fontSize: this.playableSize > 20 ? '11px' : '13px',
      color: '#aaaaaa',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 8, y: 4 },
    });
    this.infoText.setDepth(DEPTH_UI);
    this.infoText.setScrollFactor(0);
    this.updateInfoText();
  }

  // ─── Update loop (VISUAL-05A-PR1) ────────────────────────────────

  update(): void {
    // Continuous camera panning for large maps
    if (this.playableSize > 9) {
      const cam = this.cameras.main;
      // Pan speed scales inversely with zoom (faster when zoomed out)
      const panSpeed = BASE_PAN_SPEED / this.currentZoom;

      if (this.panKeys.up)    cam.scrollY -= panSpeed;
      if (this.panKeys.down)  cam.scrollY += panSpeed;
      if (this.panKeys.left)  cam.scrollX -= panSpeed;
      if (this.panKeys.right) cam.scrollX += panSpeed;
    }

    // Throttled FPS update in info text
    this.fpsFrameCount++;
    if (this.fpsFrameCount % 30 === 0) {
      this.updateInfoText();
    }
  }

  // ─── Reset camera to arena center (VISUAL-05A-PR1) ──────────────

  private resetCamera(): void {
    const cam = this.cameras.main;
    this.currentZoom = this.defaultZoom;
    cam.setZoom(this.currentZoom);
    cam.centerOn(this.arenaCX, this.arenaCY);
    this.updateInfoText();
  }

  // ─── Render mode determination (VISUAL-05A-PR1) ─────────────────

  private determineRenderMode(): void {
    // Calculate arena size in pixels
    const arenaW = this.outerSize * this.runtimeTileW;
    const arenaH = this.outerSize * this.runtimeTileH;

    // Estimate total objects
    this._estimatedObjectCount = this.tilePlacements.length + this.framePieces.length;

    // For small maps (≤9), use individual images (original behavior)
    if (this.playableSize <= 9) {
      this.renderMode = 'full-individual';
      return;
    }

    // For medium maps, use RenderTexture if the arena fits in a single RT
    if (arenaW <= MAX_RT_SIZE && arenaH <= MAX_RT_SIZE) {
      this.renderMode = 'render-texture';
      return;
    }

    // For larger maps, try chunked RenderTexture
    // Each chunk must be <= MAX_RT_SIZE
    const chunkTileSize = Math.floor(MAX_RT_SIZE / this.runtimeTileW);
    if (chunkTileSize >= 4) {
      // At least 4 tiles per chunk dimension
      this.renderMode = 'chunked-rt';
      return;
    }

    // Fallback: frame-focused mode (only render frame pieces, fill interior with solid)
    this.renderMode = 'frame-focused';
  }

  // ─── Platform tile rendering (VISUAL-05A-PR1) ────────────────────

  private renderPlatformTiles(): void {
    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    switch (this.renderMode) {
      case 'full-individual':
        this.renderTilesIndividual(halfTW, halfTH);
        break;
      case 'render-texture':
        this.renderTilesSingleRT(halfTW, halfTH);
        break;
      case 'chunked-rt':
        this.renderTilesChunkedRT(halfTW, halfTH);
        break;
      case 'frame-focused':
        this.renderTilesFrameFocused(halfTW, halfTH);
        break;
    }
  }

  /** Original rendering: individual Image objects in a masked Container. */
  private renderTilesIndividual(halfTW: number, halfTH: number): void {
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
  }

  /** RenderTexture: stamp all tiles onto a single RT. */
  private renderTilesSingleRT(halfTW: number, halfTH: number): void {
    // Calculate bounding box of all platform tiles
    const bounds = this.calculateTileBounds(halfTW, halfTH);
    if (!bounds) return;

    const rtWidth = Math.ceil(bounds.maxX - bounds.minX) + this.runtimeTileW;
    const rtHeight = Math.ceil(bounds.maxY - bounds.minY) + this.runtimeTileH;

    if (rtWidth > MAX_RT_SIZE || rtHeight > MAX_RT_SIZE) {
      // Fall back to chunked
      console.warn('[Visual04a] Single RT too large, falling back to chunked');
      this.renderMode = 'chunked-rt';
      this.renderTilesChunkedRT(halfTW, halfTH);
      return;
    }

    const rt = this.add.renderTexture(
      bounds.minX - this.runtimeTileW / 2,
      bounds.minY - this.runtimeTileH / 2,
      rtWidth,
      rtHeight
    );
    rt.setDepth(DEPTH_TILES);
    this.renderTextures.push(rt);

    const tileScaleX = this.runtimeTileW / SOURCE_TILE_W;
    const tileScaleY = this.runtimeTileH / SOURCE_TILE_H;
    const rtOriginX = bounds.minX - this.runtimeTileW / 2;
    const rtOriginY = bounds.minY - this.runtimeTileH / 2;

    // Stamp tiles onto the RenderTexture
    this.stampTilesOntoRT(rt, rtOriginX, rtOriginY, tileScaleX, tileScaleY, halfTW, halfTH);

    // Apply diamond mask for small maps (playableSize <= 20)
    if (this.playableSize <= 20) {
      this.applyDiamondMaskToRT();
    }

    console.log(`[Visual04a] Single RT: ${rtWidth}×${rtHeight} px`);
  }

  /** Chunked RenderTexture: split tiles into multiple RTs. */
  private renderTilesChunkedRT(halfTW: number, halfTH: number): void {
    const chunkTileSize = Math.max(4, Math.floor(MAX_RT_SIZE / this.runtimeTileW));
    const chunkPixelW = chunkTileSize * this.runtimeTileW + this.runtimeTileW;
    const chunkPixelH = chunkTileSize * this.runtimeTileH + this.runtimeTileH;

    // Group tile placements by chunk
    const chunks = new Map<string, { col: number; row: number; tileId: number }[]>();

    for (const placement of this.tilePlacements) {
      const chunkCol = Math.floor((placement.col + this.frameBorder) / chunkTileSize);
      const chunkRow = Math.floor((placement.row + this.frameBorder) / chunkTileSize);
      const key = `${chunkCol},${chunkRow}`;
      if (!chunks.has(key)) {
        chunks.set(key, []);
      }
      chunks.get(key)!.push(placement);
    }

    const tileScaleX = this.runtimeTileW / SOURCE_TILE_W;
    const tileScaleY = this.runtimeTileH / SOURCE_TILE_H;

    console.log(`[Visual04a] Chunked RT: ${chunks.size} chunks, chunk tile size: ${chunkTileSize}`);

    for (const [key, placements] of chunks) {
      const [chunkCol, chunkRow] = key.split(',').map(Number);

      // Calculate chunk origin in world coordinates
      const chunkOriginCol = chunkCol * chunkTileSize - this.frameBorder;
      const chunkOriginRow = chunkRow * chunkTileSize - this.frameBorder;
      const chunkWorldX = (chunkOriginCol - chunkOriginRow) * halfTW + this.platformOriginX;
      const chunkWorldY = (chunkOriginCol + chunkOriginRow) * halfTH + this.platformOriginY;

      const rtX = chunkWorldX - this.runtimeTileW / 2;
      const rtY = chunkWorldY - this.runtimeTileH / 2;

      // Clamp RT size to MAX_RT_SIZE
      const rtW = Math.min(chunkPixelW, MAX_RT_SIZE);
      const rtH = Math.min(chunkPixelH, MAX_RT_SIZE);

      const rt = this.add.renderTexture(rtX, rtY, rtW, rtH);
      rt.setDepth(DEPTH_TILES);
      this.renderTextures.push(rt);

      // Stamp tiles in this chunk
      for (const placement of placements) {
        const sx = (placement.col - placement.row) * halfTW + this.platformOriginX;
        const sy = (placement.col + placement.row) * halfTH + this.platformOriginY;

        const assetKey = `${TILE_ASSET_KEY_PREFIX}${placement.tileId}`;
        const tmpImg = this.make.image({ x: 0, y: 0, add: false });
        tmpImg.setTexture(assetKey);
        tmpImg.setPosition(sx - rtX, sy - rtY);
        tmpImg.setScale(tileScaleX, tileScaleY);
        tmpImg.setOrigin(0.5, 0.5);
        rt.draw(tmpImg);
        tmpImg.destroy();
      }
    }
  }

  /** Frame-focused: solid fill for playable area + individual frame pieces. */
  private renderTilesFrameFocused(halfTW: number, halfTH: number): void {
    // Draw a solid colored rectangle approximating the playable diamond
    const fillGraphics = this.add.graphics();
    fillGraphics.setDepth(DEPTH_TILES);

    // Fill the inner diamond with a solid color
    fillGraphics.fillStyle(0x2a2a1a, 0.8);
    fillGraphics.beginPath();
    fillGraphics.moveTo(this.arenaCX, this.arenaCY - this.innerHH);
    fillGraphics.lineTo(this.arenaCX + this.innerHW, this.arenaCY);
    fillGraphics.lineTo(this.arenaCX, this.arenaCY + this.innerHH);
    fillGraphics.lineTo(this.arenaCX - this.innerHW, this.arenaCY);
    fillGraphics.closePath();
    fillGraphics.fillPath();

    // Stamp a few representative tiles as texture samples in the center
    const tileScaleX = this.runtimeTileW / SOURCE_TILE_W;
    const tileScaleY = this.runtimeTileH / SOURCE_TILE_H;

    // Sample a sparse grid of tiles (every Nth tile)
    const sampleStep = Math.max(1, Math.floor(this.playableSize / 20));
    const picker = new WeightedTilePicker([
      { id: 1, file: 'platform_tile_001.png', tags: ['base'], recommendedWeight: 1 },
    ], 42);

    for (let row = 0; row < this.playableSize; row += sampleStep) {
      for (let col = 0; col < this.playableSize; col += sampleStep) {
        const sx = (col - row) * halfTW + this.platformOriginX;
        const sy = (col + row) * halfTH + this.platformOriginY;

        // All cells in [0, playableSize) are playable — no diamond check needed
        const tileId = picker.pick();
        const assetKey = `${TILE_ASSET_KEY_PREFIX}${tileId}`;
        const tileImg = this.add.image(sx, sy, assetKey);
        tileImg.setScale(tileScaleX * sampleStep, tileScaleY * sampleStep);
        tileImg.setOrigin(0.5, 0.5);
        tileImg.setDepth(DEPTH_TILES);
        tileImg.setAlpha(0.3);  // very subtle
      }
    }

    console.log(`[Visual04a] Frame-focused mode: ${this.tilePlacements.length} tiles replaced with solid fill`);
  }

  /** Calculate world-space bounding box of all platform tiles. */
  private calculateTileBounds(halfTW: number, halfTH: number): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (this.tilePlacements.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const placement of this.tilePlacements) {
      const sx = (placement.col - placement.row) * halfTW + this.platformOriginX;
      const sy = (placement.col + placement.row) * halfTH + this.platformOriginY;
      minX = Math.min(minX, sx - halfTW);
      minY = Math.min(minY, sy - halfTH);
      maxX = Math.max(maxX, sx + halfTW);
      maxY = Math.max(maxY, sy + halfTH);
    }
    return { minX, minY, maxX, maxY };
  }

  /** Stamp tiles onto a RenderTexture. */
  private stampTilesOntoRT(
    rt: Phaser.GameObjects.RenderTexture,
    rtOriginX: number, rtOriginY: number,
    tileScaleX: number, tileScaleY: number,
    halfTW: number, halfTH: number
  ): void {
    for (const placement of this.tilePlacements) {
      const sx = (placement.col - placement.row) * halfTW + this.platformOriginX;
      const sy = (placement.col + placement.row) * halfTH + this.platformOriginY;

      const assetKey = `${TILE_ASSET_KEY_PREFIX}${placement.tileId}`;
      const tmpImg = this.make.image({ x: 0, y: 0, add: false });
      tmpImg.setTexture(assetKey);
      tmpImg.setPosition(sx - rtOriginX, sy - rtOriginY);
      tmpImg.setScale(tileScaleX, tileScaleY);
      tmpImg.setOrigin(0.5, 0.5);
      rt.draw(tmpImg);
      tmpImg.destroy();
    }
  }

  /** Apply diamond mask to the RenderTexture (for small maps where clipping matters). */
  private applyDiamondMaskToRT(): void {
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

    if (this.renderTextures.length === 1) {
      this.renderTextures[0].setMask(diamondMask);
    }
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

    // Dark solid fill covering the full world area
    const fillExtent = Math.max(canvasW, canvasH, this.outerHW * 3, this.outerHH * 3);
    bg.fillStyle(0x12121e, 1);
    bg.fillRect(-fillExtent, -fillExtent, fillExtent * 3, fillExtent * 3);

    // Subtle ground rectangle under the arena area
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

    bg.setScrollFactor(1);
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
      const edges = getEdgeInfo(sx, sy, this.arenaCX, this.arenaCY);

      // Left wall face PNG
      if (edges[2].isOuter) {
        const img = this.add.image(sx - halfTW, sy, ASSET_KEY_WALL_FACE_LEFT);
        img.setScale(scale);
        img.setOrigin(WALL_FACE_ANCHOR_X, WALL_FACE_ANCHOR_Y);
        img.setDepth(DEPTH_FRAME_WALLS);
        img.setVisible(this.pngWallFaceVisible);
        img.setTint(WALL_FACE_LEFT_TINT);
        this.pngWallFaceImages.push(img);
        leftCount++;
      }

      // Right wall face PNG (mirrored, no tint — lit side)
      if (edges[1].isOuter) {
        const img = this.add.image(sx + halfTW, sy, ASSET_KEY_WALL_FACE_LEFT);
        img.setScale(-scale, scale);
        img.setOrigin(WALL_FACE_ANCHOR_X, WALL_FACE_ANCHOR_Y);
        img.setDepth(DEPTH_FRAME_WALLS);
        img.setVisible(this.pngWallFaceVisible);
        img.setTint(WALL_FACE_RIGHT_TINT);
        this.pngWallFaceImages.push(img);
        rightCount++;
      }
    }

    console.log(`[Visual04a] PNG wall face: ${this.pngWallFaceImages.length} images created (left=${leftCount}, right=${rightCount}, scale=${scale.toFixed(4)})`);

    // Apply initial mode
    this.applyWallFaceMode();
  }

  /**
   * Apply the current wall face mode (PNG or procedural).
   */
  private applyWallFaceMode(): void {
    const usePng = this.pngWallFaceAvailable && this.pngWallFaceVisible;

    for (const img of this.pngWallFaceImages) {
      img.setVisible(usePng);
    }

    if (this.frameWallGraphics) {
      this.frameWallGraphics.setVisible(!usePng);
    }
  }

  // ─── Frame wall face rendering (VISUAL-04B polished) ────────────

  /**
   * Draw wall faces for all frame pieces with industrial detail.
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

      // Left wall face (darker, as if lit from upper-right)
      const leftWallColor = isCorner ? FRAME_CORNER_WALL : FRAME_WALL_BASE;
      g.fillStyle(leftWallColor, 1);
      g.beginPath();
      g.moveTo(sx - halfTW, sy);
      g.lineTo(sx, sy + halfTH);
      g.lineTo(sx, sy + halfTH + effWallH);
      g.lineTo(sx - halfTW, sy + effWallH);
      g.closePath();
      g.fillPath();

      // Right wall face (slightly lighter)
      const rightWallColor = isCorner ? FRAME_CORNER_WALL_LIGHT : FRAME_WALL_LIGHT;
      g.fillStyle(rightWallColor, 1);
      g.beginPath();
      g.moveTo(sx + halfTW, sy);
      g.lineTo(sx, sy + halfTH);
      g.lineTo(sx, sy + halfTH + effWallH);
      g.lineTo(sx + halfTW, sy + effWallH);
      g.closePath();
      g.fillPath();

      // Panel rib lines on left face
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

      // Panel rib lines on right face
      for (const frac of [0.33, 0.67]) {
        const ribX = sx + halfTW - halfTW * frac;
        const ribTopY = sy + halfTH * frac;
        const ribBotY = sy + effWallH + halfTH * frac;
        g.beginPath();
        g.moveTo(ribX, ribTopY);
        g.lineTo(ribX, ribBotY);
        g.strokePath();
      }

      // Top edge shadow (darkest line where wall meets top)
      g.lineStyle(2, FRAME_WALL_TOP_SHADOW, 0.9);
      g.beginPath();
      g.moveTo(sx - halfTW, sy);
      g.lineTo(sx, sy + halfTH);
      g.lineTo(sx + halfTW, sy);
      g.strokePath();

      // Corner outline accent
      if (isCorner) {
        g.lineStyle(1, CORNER_OUTLINE_COLOR, 0.6);
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

    // Apply initial mode
    this.applyFrameTopMode();
  }

  /**
   * Apply the current frame top mode (PNG or procedural).
   */
  private applyFrameTopMode(): void {
    const usePng = this.pngFrameTopAvailable && this.pngFrameTopVisible;

    // Toggle PNG images
    for (const img of this.pngFrameTopImages) {
      img.setVisible(usePng);
    }

    // Redraw procedural tops
    this.drawFrameTops();
  }

  // ─── Frame top surface rendering (VISUAL-04B polished) ──────────

  /**
   * Draw top surfaces for all frame pieces + inner lip, with layered
   * industrial detail. When PNG mode is active (VISUAL-04D), only the
   * inner lip is drawn — the PNG images replace procedural top surfaces.
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
      const bevelInset = Math.max(2, Math.round(this.runtimeTileH * 0.07));
      const bevelInsetX = bevelInset * 2;
      const bevelInsetY = bevelInset;

      const boltR = Math.max(1.5, this.runtimeTileH * 0.028);

      for (const piece of this.framePieces) {
        const { sx, sy, isCorner, col, row } = piece;
        const h = hashColRow(col, row);

        const edges = getEdgeInfo(sx, sy, this.arenaCX, this.arenaCY);

        // 1. Base fill with dirt variation
        const baseColor = isCorner ? FRAME_CORNER_TOP : FRAME_TOP_BASE;
        const dirtShift = (h - 0.5) * 2;
        const adjustedBase = this.varyColor(baseColor, dirtShift * 0.5);
        g.fillStyle(adjustedBase, 1);
        this.fillDiamond(g, sx, sy, halfTW, halfTH);

        // 2. Outer bevel
        for (let i = 0; i < 4; i++) {
          if (edges[i].isOuter) {
            g.lineStyle(2, FRAME_OUTER_BEVEL, 0.85);
            this.strokeDiamondEdge(g, sx, sy, halfTW, halfTH, i);
          }
        }

        // 3. Raised center surface
        const raisedColor = isCorner ? FRAME_CORNER_TOP_RAISED : FRAME_TOP_RAISED;
        g.fillStyle(raisedColor, 0.65);
        this.fillDiamond(g, sx, sy, halfTW - bevelInsetX, halfTH - bevelInsetY);

        // 4. Inner bevel
        for (let i = 0; i < 4; i++) {
          if (edges[i].isInner) {
            g.lineStyle(2, FRAME_INNER_BEVEL, 0.7);
            this.strokeDiamondEdge(g, sx, sy, halfTW, halfTH, i);
          }
        }

        // 5. Panel division lines
        g.lineStyle(1, FRAME_TOP_DARK, 0.25);
        g.beginPath();
        g.moveTo(sx, sy - halfTH * 0.55);
        g.lineTo(sx, sy + halfTH * 0.55);
        g.strokePath();
        g.beginPath();
        g.moveTo(sx - halfTW * 0.55, sy);
        g.lineTo(sx + halfTW * 0.55, sy);
        g.strokePath();

        // 6. Bolt details
        const boltInsetX = halfTW * 0.32;
        const boltInsetY = halfTH * 0.32;
        const boltPositions = [
          { x: sx + boltInsetX, y: sy - boltInsetY },
          { x: sx + boltInsetX, y: sy + boltInsetY },
          { x: sx - boltInsetX, y: sy + boltInsetY },
          { x: sx - boltInsetX, y: sy - boltInsetY },
        ];

        const bolt1 = Math.floor(h * 4) % 4;
        const bolt2 = Math.floor(h * 7 + 0.5) % 4;

        for (const boltIdx of [bolt1, bolt2]) {
          const bp = boltPositions[boltIdx];
          g.fillStyle(BOLT_SHADOW, 0.5);
          g.fillCircle(bp.x + 0.7, bp.y + 0.7, boltR + 0.3);
          g.fillStyle(BOLT_HEAD, 0.9);
          g.fillCircle(bp.x, bp.y, boltR);
          g.fillStyle(FRAME_INNER_BEVEL, 0.3);
          g.fillCircle(bp.x - boltR * 0.3, bp.y - boltR * 0.3, boltR * 0.35);
        }

        // 7. Deterministic dirt spots
        const dirtCount = Math.floor(h * 3);
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

        // 8. Hazard stripes (corner pieces only)
        if (isCorner) {
          this.drawHazardStripes(g, sx, sy, halfTW, halfTH);
        }
      }
    }

    // 9. Inner lip (always drawn)
    g.lineStyle(2, FRAME_LIP_COLOR, FRAME_LIP_ALPHA);
    g.beginPath();
    g.moveTo(this.arenaCX, this.arenaCY - this.innerHH);
    g.lineTo(this.arenaCX + this.innerHW, this.arenaCY);
    g.lineTo(this.arenaCX, this.arenaCY + this.innerHH);
    g.lineTo(this.arenaCX - this.innerHW, this.arenaCY);
    g.closePath();
    g.strokePath();
  }

  // ─── Debug grid overlay ──────────────────────────────────────────

  /** Draw the debug grid overlay: tile outlines + inner/outer diamond boundaries. */
  private drawGridOverlay(): void {
    if (!this.gridGraphics) return;
    const g = this.gridGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    if (this.playableSize <= 20 || this.gridIsFullDetail) {
      // Full per-tile grid (original behavior, or user explicitly toggled)
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
    } else {
      // Adaptive grid: major gridlines every N cells + diamond boundaries
      const majorStep = Math.ceil(this.playableSize / 20);
      g.lineStyle(1, GRID_COLOR, GRID_ALPHA * 0.7);

      for (let row = 0; row < this.playableSize; row += majorStep) {
        for (let col = 0; col < this.playableSize; col += majorStep) {
          const sx = (col - row) * halfTW + this.platformOriginX;
          const sy = (col + row) * halfTH + this.platformOriginY;

          // All cells in [0, playableSize) are playable — no diamond check needed
          g.beginPath();
          g.moveTo(sx, sy - halfTH);
          g.lineTo(sx + halfTW, sy);
          g.lineTo(sx, sy + halfTH);
          g.lineTo(sx - halfTW, sy);
          g.closePath();
          g.strokePath();
        }
      }
    }

    // Inner diamond boundary (yellow) — always drawn
    g.lineStyle(2, DEBUG_INNER_DIAMOND_COLOR, 0.7);
    g.beginPath();
    g.moveTo(this.arenaCX, this.arenaCY - this.innerHH);
    g.lineTo(this.arenaCX + this.innerHW, this.arenaCY);
    g.lineTo(this.arenaCX, this.arenaCY + this.innerHH);
    g.lineTo(this.arenaCX - this.innerHW, this.arenaCY);
    g.closePath();
    g.strokePath();

    // Outer diamond boundary (cyan) — for large maps
    if (this.playableSize > 9) {
      g.lineStyle(2, DEBUG_OUTER_DIAMOND_COLOR, 0.5);
      g.beginPath();
      g.moveTo(this.arenaCX, this.arenaCY - this.outerHH);
      g.lineTo(this.arenaCX + this.outerHW, this.arenaCY);
      g.lineTo(this.arenaCX, this.arenaCY + this.outerHH);
      g.lineTo(this.arenaCX - this.outerHW, this.arenaCY);
      g.closePath();
      g.strokePath();
    }
  }

  // ─── Frame debug outlines ────────────────────────────────────────

  /** Draw frame debug outlines: piece boundaries + outer diamond + corner highlights. */
  private drawFrameDebug(): void {
    if (!this.frameDebugGraphics) return;
    const g = this.frameDebugGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // Frame piece outlines
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
    const fps = this.game.loop.actualFps;

    const frameTopMode = this.pngFrameTopAvailable && this.pngFrameTopVisible
      ? 'PNG'
      : 'procedural';

    const wallFaceMode = this.pngWallFaceAvailable && this.pngWallFaceVisible
      ? 'PNG'
      : 'procedural';

    const isLargeMap = this.playableSize > 9;
    const totalObjects = this._estimatedObjectCount +
      this.pngFrameTopImages.length + this.pngWallFaceImages.length + this.renderTextures.length;

    const lines = [
      `VISUAL-05A-PR1 — Parameterized Map Size Preview`,
      '',
      `Playable: ${this.playableSize}×${this.playableSize}  Outer: ${this.outerSize}×${this.outerSize}  Border: ${this.frameBorder}`,
      `Platform tiles: ${this.tilePlacements.length}`,
      `Frame pieces: ${this.framePieces.length} (${cornerCount} corners)`,
      `Total objects: ~${totalObjects}`,
      '',
      `Tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)} px`,
      `Tile ratio: ${tileRatio.toFixed(4)} (exact 2:1)`,
      `Source tile: ${SOURCE_TILE_W}×${SOURCE_TILE_H} px`,
      '',
      `Inner diamond: ${(2*this.innerHW).toFixed(0)}×${(2*this.innerHH).toFixed(0)} px`,
      `Outer diamond: ${(2*this.outerHW).toFixed(0)}×${(2*this.outerHH).toFixed(0)} px`,
      `Wall height: ${this.wallH.toFixed(1)} px`,
      '',
      `RENDER MODE: ${this.renderMode}`,
      `Zoom: ${this.currentZoom.toFixed(3)} (default: ${this.defaultZoom.toFixed(3)})`,
      `FPS: ${fps.toFixed(1)}`,
      '',
      `Grid overlay:    ${this.gridVisible ? (this.playableSize > 20 && this.gridIsFullDetail ? 'FULL' : 'ON') : 'OFF'}  [G] toggle`,
      `Frame debug:     ${this.frameDebugVisible ? 'ON' : 'OFF'}  [F] toggle`,
      `Frame top:       ${frameTopMode}  [P] toggle`,
      `Wall:            ${wallFaceMode}  [W] toggle`,
      `Wall side tint:  enabled`,
    ];

    if (isLargeMap) {
      lines.push(
        '',
        'Camera controls:',
        '  Arrows — pan camera',
        '  Mouse wheel — zoom',
        '  R / Home — reset camera',
      );
    }

    lines.push(
      '',
      `Background:      ${this.bgAvailable ? 'image' : 'fallback (procedural)'}`,
      '[ESC] exit → preload → menu',
      '',
      'Dev-only prototype. No runtime integration.',
    );

    this.infoText.setText(lines.join('\n'));
  }
}
