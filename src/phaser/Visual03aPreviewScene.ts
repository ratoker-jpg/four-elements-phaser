/**
 * Visual03aPreviewScene — dev-only runtime layered platform prototype.
 *
 * VISUAL-03A: Renders the approved VISUAL-01B layered map model with
 * proper geometry masking, using proven VISUAL-02B exact 2:1 geometry.
 * VISUAL-03B fixup: Separate deck geometry for variant 03 frame alignment.
 *
 *   Layer 0 — background world image
 *   Layer 1 — platform tile layer (square NxN grid, clipped to deck diamond)
 *   Layer 2 — arena frame overlay with transparent center
 *   Layer 3 — optional debug grid overlay (toggle with G key)
 *   Layer 4 — info/debug text
 *
 * Key improvements over Visual02aPreviewScene:
 *   - Separate DECK geometry independent from frame cutout (TARGET_V)
 *   - Deck offset/scale calibration for variant 03 frame alignment
 *   - Live calibration controls: Arrow keys, [ ], R
 *   - URL params for reproducible tuning: ?visual03a&deckX=0&deckY=-40&deckScale=0.92
 *   - GeometryMask clips tile layer to the deck diamond — no tile spill
 *   - No PNG pixel reading at runtime — geometry is explicit
 *
 * This scene does NOT replace production terrain.
 * It does NOT modify gameplay, pathfinding, economy, or any production system.
 * It is activated only via the ?visual03a URL parameter.
 *
 * Access: http://localhost:3000/?visual03a
 * With calibration: http://localhost:3000/?visual03a&deckX=0&deckY=-40&deckScale=0.92
 */

import Phaser from 'phaser';

// ─── Tile metadata ────────────────────────────────────────────────

interface TileMeta {
  id: number;
  file: string;
  tags: string[];
  recommendedWeight: number;
}

// ─── Frame geometry constants (VISUAL-02B proven 2:1 diamond) ─────

/**
 * Target 2:1 inner cutout vertices from VISUAL-02B frame geometry proof.
 * These define the frame's transparent cutout boundary.
 *
 * Inner dimensions: 1604 × 802 px → ratio exactly 2.0
 * Canvas: 1672 × 941 px (frame asset size)
 *
 * NOTE: Variant 03 frame has thick walls that obscure parts of this
 * diamond. The actual visible deck surface is smaller — see DECK_V below.
 */
const TARGET_V = {
  top:    { x: 836, y: 69  },
  right:  { x: 1638, y: 470 },
  bottom: { x: 836, y: 871 },
  left:   { x: 34,  y: 470 },
} as const;

/** Frame cutout top vertex Y (used in info text for comparison) */
const FRAME_CUTOUT_TOP_Y = TARGET_V.top.y;

const INNER_W = 1604;
const INNER_H = 802;

/* Frame cutout diamond center: (836, 470), half-extents: (802, 401).
 * Kept as comment for reference; tile layer uses DECK_V geometry instead. */

// ─── Deck geometry constants (variant 03 frame inner visible surface) ──

/**
 * Deck diamond vertices — the visible platform surface inside variant 03
 * frame. The frame has thick walls that push the visible deck area inward
 * compared to the full TARGET_V cutout.
 *
 * Measured from variant 03 arena_frame_alpha.png by scanning inner edge
 * of opaque wall pixels:
 *   Top:    (836, 145)   — wall is 76px thicker than VISUAL-02B top
 *   Right:  (1482, 470)  — wall is 156px thicker on right
 *   Bottom: (836, 813)   — wall is 58px thicker at bottom
 *   Left:   (192, 470)   — wall is 158px thicker on left
 *
 * Deck dimensions: 1290 × 668 px → ratio ≈ 1.93
 * Deck center: (836, 479)
 */
const DECK_V = {
  top:    { x: 836, y: 145 },
  right:  { x: 1482, y: 470 },
  bottom: { x: 836, y: 813 },
  left:   { x: 192,  y: 470 },
} as const;

const DECK_INNER_W = DECK_V.right.x - DECK_V.left.x;  // 1290
const DECK_INNER_H = DECK_V.bottom.y - DECK_V.top.y;  // 668

/** Center of the deck diamond */
const DECK_CX = (DECK_V.left.x + DECK_V.right.x) / 2;   // 836
const DECK_CY = (DECK_V.top.y + DECK_V.bottom.y) / 2;   // 479

/** Half-extents of the deck diamond */
const DECK_HW = DECK_INNER_W / 2;  // 645
const DECK_HH = DECK_INNER_H / 2;  // 334

// ─── Default deck calibration values ──────────────────────────────

/**
 * Default deck calibration for variant 03 frame.
 * These offsets shift the tile deck relative to the DECK_V geometry.
 *
 * deckY: negative moves tiles upward (toward top platform surface).
 *        The variant 03 frame has a thick top wall; tiles need to sit
 *        visually on the top surface, not inside the wall area.
 * deckScale: reduces the tile grid to fit within the smaller visible
 *            deck area. <1.0 shrinks tiles to avoid spilling under walls.
 */
const DEFAULT_DECK_OFFSET_X = 0;
const DEFAULT_DECK_OFFSET_Y = -30;
const DEFAULT_DECK_SCALE = 0.92;

/** Step sizes for live calibration controls */
const DECK_STEP_POS = 2;     // pixels per arrow key press (in asset space)
const DECK_STEP_SCALE = 0.01; // scale change per [ ] press

// ─── Grid configuration ──────────────────────────────────────────

/**
 * Grid size for the preview platform fill.
 * Square NxN grid so the tile grid diamond perfectly matches the cutout.
 *
 * N=9 → 81 tiles total, ~40 visible inside the diamond.
 * th = DECK_INNER_H / N = 668 / 9 ≈ 74.22  (before deckScale)
 * tw = 2 × th ≈ 148.44
 */
const GRID_N = 9;

/** Source tile dimensions (from metadata / PNG files) */
const SOURCE_TILE_W = 384;
const SOURCE_TILE_H = 192;

// ─── Asset keys ───────────────────────────────────────────────────

const ASSET_KEY_BG = 'visual03a_bg';
const ASSET_KEY_FRAME = 'visual03a_frame';
const TILE_ASSET_KEY_PREFIX = 'visual03a_tile_';

// ─── Depth layers ─────────────────────────────────────────────────

const DEPTH_BG = 0;
const DEPTH_TILES = 10;
const DEPTH_GRID = 20;
const DEPTH_FRAME = 30;
const DEPTH_UI = 40;

// ─── Colors ───────────────────────────────────────────────────────

const GRID_COLOR = 0x00ff00;
const GRID_ALPHA = 0.4;
const MASK_COLOR = 0xffffff;

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

// ─── Scene ────────────────────────────────────────────────────────

export class Visual03aPreviewScene extends Phaser.Scene {
  private gridVisible = false;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private infoText: Phaser.GameObjects.Text | null = null;

  /** Computed runtime tile dimensions from deck geometry */
  private runtimeTileW = 0;
  private runtimeTileH = 0;

  /** Computed platform origin (center of tile 0,0) in display coords */
  private platformOriginX = 0;
  private platformOriginY = 0;

  /** Scale factor for fitting frame assets to canvas */
  private frameScale = 1;

  /** Frame offset for centering in canvas */
  private frameOffsetX = 0;
  private frameOffsetY = 0;

  /** Stored tile placements for grid overlay */
  private tilePlacements: { col: number; row: number; tileId: number }[] = [];

  /** Mask graphics for diamond clipping */
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;

  /** Tile container (masked) */
  private tileContainer: Phaser.GameObjects.Container | null = null;

  // ─── Deck calibration state ─────────────────────────────────────

  /** Deck X offset in asset pixels (negative = left) */
  private deckOffsetX = DEFAULT_DECK_OFFSET_X;

  /** Deck Y offset in asset pixels (negative = up) */
  private deckOffsetY = DEFAULT_DECK_OFFSET_Y;

  /** Deck scale multiplier (1.0 = full DECK_V size, <1.0 = shrink) */
  private deckScale = DEFAULT_DECK_SCALE;

  /** Tile images for rebuild during calibration */
  private tileImages: Phaser.GameObjects.Image[] = [];

  /** Tile scaling factors */
  private tileScaleX = 0;
  private tileScaleY = 0;

  /** Weighted tile picker (constant seed) */
  private picker: WeightedTilePicker | null = null;

  constructor() {
    super({ key: 'Visual03aPreviewScene' });
  }

  preload(): void {
    // Load background world candidate
    this.load.image(ASSET_KEY_BG, 'dev-visual/visual-02a/background_world_candidate_01.png');

    // Load arena frame overlay (has transparent center)
    this.load.image(ASSET_KEY_FRAME, 'dev-visual/visual-02a/arena_frame_alpha.png');

    // Load balanced 8 tiles
    const tileIds = [1, 2, 5, 6, 7, 8, 9, 10];
    for (const id of tileIds) {
      const key = `${TILE_ASSET_KEY_PREFIX}${id}`;
      const file = `dev-visual/visual-02a/tiles/platform_tile_${String(id).padStart(3, '0')}.png`;
      this.load.image(key, file);
    }

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[Visual03a] Failed to load: ${file.key} (${file.url})`);
    });
  }

  create(): void {
    const cam = this.cameras.main;
    const canvasW = cam.width;
    const canvasH = cam.height;

    // ─── Parse URL params for deck calibration ──────────────────

    const urlParams = new URLSearchParams(window.location.search);
    const paramDeckX = urlParams.get('deckX');
    const paramDeckY = urlParams.get('deckY');
    const paramDeckScale = urlParams.get('deckScale');

    if (paramDeckX !== null) this.deckOffsetX = parseFloat(paramDeckX) || 0;
    if (paramDeckY !== null) this.deckOffsetY = parseFloat(paramDeckY) || 0;
    if (paramDeckScale !== null) {
      const s = parseFloat(paramDeckScale);
      if (s > 0.1 && s < 3.0) this.deckScale = s;
    }

    console.log(`[Visual03a] Deck calibration from URL: offsetX=${this.deckOffsetX}, offsetY=${this.deckOffsetY}, scale=${this.deckScale}`);

    // ─── Compute frame scale and offset ─────────────────────────

    // Frame asset is 1672×941. Scale to fit canvas.
    const FRAME_ASSET_W = 1672;
    const FRAME_ASSET_H = 941;

    this.frameScale = Math.min(canvasW / FRAME_ASSET_W, canvasH / FRAME_ASSET_H);
    const displayW = FRAME_ASSET_W * this.frameScale;
    const displayH = FRAME_ASSET_H * this.frameScale;
    this.frameOffsetX = (canvasW - displayW) / 2;
    this.frameOffsetY = (canvasH - displayH) / 2;

    // ─── Create weighted tile picker ────────────────────────────

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
    this.picker = new WeightedTilePicker(tileMetas, 42);

    // ─── Layer 0: Background world ──────────────────────────────

    const bgImg = this.textures.get(ASSET_KEY_BG);
    const bgW = bgImg.getSourceImage().width;
    const bgH = bgImg.getSourceImage().height;

    const bgScale = Math.max(canvasW / bgW, canvasH / bgH);
    const bg = this.add.image(canvasW / 2, canvasH / 2, ASSET_KEY_BG);
    bg.setScale(bgScale);
    bg.setDepth(DEPTH_BG);
    bg.setOrigin(0.5, 0.5);

    // ─── Layer 1: Tile-filled platform (masked) ─────────────────

    // Create container for tiles — mask will be applied after build
    this.tileContainer = this.add.container(0, 0);
    this.tileContainer.setDepth(DEPTH_TILES);

    // Build tile layer with current deck calibration
    this.rebuildDeck();

    // ─── Layer 2: Arena frame overlay ───────────────────────────

    const frame = this.add.image(
      this.frameOffsetX + displayW / 2,
      this.frameOffsetY + displayH / 2,
      ASSET_KEY_FRAME
    );
    frame.setScale(this.frameScale);
    frame.setDepth(DEPTH_FRAME);
    frame.setOrigin(0.5, 0.5);

    // ─── Layer 3: Debug grid overlay (initially hidden) ─────────

    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(DEPTH_GRID);
    this.gridGraphics.setVisible(this.gridVisible);
    this.drawGridOverlay();

    // ─── Camera ──────────────────────────────────────────────────

    cam.setBackgroundColor('#1a1a2e');
    cam.setScroll(0, 0);

    // ─── Keyboard controls ───────────────────────────────────────

    this.input.keyboard?.on('keydown-G', () => {
      this.gridVisible = !this.gridVisible;
      this.gridGraphics?.setVisible(this.gridVisible);
      this.updateInfoText();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      console.log('[Visual03aPreviewScene] ESC pressed. Starting PreloadScene to load production assets before menu.');
      this.scene.start('PreloadScene');
    });

    // ─── Deck calibration controls ─────────────────────────────

    this.input.keyboard?.on('keydown-UP', () => {
      this.deckOffsetY -= DECK_STEP_POS;
      this.rebuildDeck();
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.deckOffsetY += DECK_STEP_POS;
      this.rebuildDeck();
    });

    this.input.keyboard?.on('keydown-LEFT', () => {
      this.deckOffsetX -= DECK_STEP_POS;
      this.rebuildDeck();
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.deckOffsetX += DECK_STEP_POS;
      this.rebuildDeck();
    });

    this.input.keyboard?.on('keydown-OPEN_BRACKET', () => {
      this.deckScale = Math.max(0.1, this.deckScale - DECK_STEP_SCALE);
      this.rebuildDeck();
    });

    this.input.keyboard?.on('keydown-CLOSE_BRACKET', () => {
      this.deckScale = Math.min(3.0, this.deckScale + DECK_STEP_SCALE);
      this.rebuildDeck();
    });

    this.input.keyboard?.on('keydown-R', () => {
      this.deckOffsetX = DEFAULT_DECK_OFFSET_X;
      this.deckOffsetY = DEFAULT_DECK_OFFSET_Y;
      this.deckScale = DEFAULT_DECK_SCALE;
      this.rebuildDeck();
      console.log('[Visual03a] Deck calibration reset to defaults');
    });

    // ─── Info text ───────────────────────────────────────────────

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

  // ─── Deck geometry helpers ───────────────────────────────────────

  /**
   * Get the effective deck diamond vertices in asset-space,
   * applying deckOffsetX/Y shifts and deckScale from center.
   */
  private getEffectiveDeckVertices(): {
    top: { x: number; y: number };
    right: { x: number; y: number };
    bottom: { x: number; y: number };
    left: { x: number; y: number };
  } {
    const cx = DECK_CX + this.deckOffsetX;
    const cy = DECK_CY + this.deckOffsetY;

    // Scale deck half-extents from center
    const hw = DECK_HW * this.deckScale;
    const hh = DECK_HH * this.deckScale;

    return {
      top:    { x: cx, y: cy - hh },
      right:  { x: cx + hw, y: cy },
      bottom: { x: cx, y: cy + hh },
      left:   { x: cx - hw, y: cy },
    };
  }

  /** Convert asset-space point to display-space point */
  private assetToDisplay(ax: number, ay: number): { x: number; y: number } {
    return {
      x: this.frameOffsetX + ax * this.frameScale,
      y: this.frameOffsetY + ay * this.frameScale,
    };
  }

  // ─── Rebuild deck (tiles + mask + grid) ──────────────────────────

  /**
   * Rebuild the entire tile layer with current deck calibration.
   * Called on initial create() and whenever calibration changes.
   */
  private rebuildDeck(): void {
    const deck = this.getEffectiveDeckVertices();

    // Compute runtime tile dimensions from effective deck height
    const effectiveDeckH = deck.bottom.y - deck.top.y;  // asset space
    this.runtimeTileH = (effectiveDeckH / GRID_N) * this.frameScale;
    this.runtimeTileW = 2 * this.runtimeTileH;

    // Tile scaling: source 384×192 → runtime tile size
    this.tileScaleX = this.runtimeTileW / SOURCE_TILE_W;
    this.tileScaleY = this.runtimeTileH / SOURCE_TILE_H;

    // Compute platform origin (center of tile 0,0) in display coords
    const deckTopDisplay = this.assetToDisplay(deck.top.x, deck.top.y);
    const deckCxDisplay = this.assetToDisplay(deck.top.x, (deck.top.y + deck.bottom.y) / 2);

    this.platformOriginX = deckCxDisplay.x;
    this.platformOriginY = deckTopDisplay.y + this.runtimeTileH / 2;

    const ratio = this.runtimeTileW / this.runtimeTileH;
    console.log(`[Visual03a] Deck rebuild: offset=(${this.deckOffsetX},${this.deckOffsetY}) scale=${this.deckScale.toFixed(3)}`);
    console.log(`[Visual03a] Effective deck: ${deck.right.x - deck.left.x}×${effectiveDeckH.toFixed(1)} (asset px)`);
    console.log(`[Visual03a] Runtime tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)}, ratio: ${ratio.toFixed(4)}`);

    // ─── Rebuild mask ───────────────────────────────────────────

    // Destroy old mask graphics
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
      this.maskGraphics = null;
    }

    this.maskGraphics = this.make.graphics({ x: 0, y: 0 }, false);
    this.maskGraphics.fillStyle(MASK_COLOR, 1);

    // Draw effective deck diamond in display coordinates
    const dTop = this.assetToDisplay(deck.top.x, deck.top.y);
    const dRight = this.assetToDisplay(deck.right.x, deck.right.y);
    const dBottom = this.assetToDisplay(deck.bottom.x, deck.bottom.y);
    const dLeft = this.assetToDisplay(deck.left.x, deck.left.y);

    this.maskGraphics.beginPath();
    this.maskGraphics.moveTo(dTop.x, dTop.y);
    this.maskGraphics.lineTo(dRight.x, dRight.y);
    this.maskGraphics.lineTo(dBottom.x, dBottom.y);
    this.maskGraphics.lineTo(dLeft.x, dLeft.y);
    this.maskGraphics.closePath();
    this.maskGraphics.fillPath();

    // Apply new GeometryMask to tile container
    const diamondMask = this.maskGraphics.createGeometryMask();
    this.tileContainer?.setMask(diamondMask);

    // ─── Rebuild tiles ──────────────────────────────────────────

    // Remove old tile images from container
    for (const img of this.tileImages) {
      this.tileContainer?.remove(img, true);
    }
    this.tileImages = [];
    this.tilePlacements = [];

    if (!this.picker) return;

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // Deck center in display coords for hit-testing
    const deckCx = dTop.x;  // top.x == center.x for symmetric diamond
    const deckCy = (dTop.y + dBottom.y) / 2;
    const scaledHW = (deck.right.x - deck.left.x) / 2 * this.frameScale;
    const scaledHH = (dBottom.y - dTop.y) / 2;

    const isInDeck = (px: number, py: number): boolean => {
      return (Math.abs(px - deckCx) / scaledHW + Math.abs(py - deckCy) / scaledHH) <= 1.15;
    };

    let tilesRendered = 0;

    for (let row = 0; row < GRID_N; row++) {
      for (let col = 0; col < GRID_N; col++) {
        const sx = (col - row) * halfTW + this.platformOriginX;
        const sy = (col + row) * halfTH + this.platformOriginY;

        if (!isInDeck(sx, sy)) continue;

        const tileId = this.picker.pick();
        this.tilePlacements.push({ col, row, tileId });

        const assetKey = `${TILE_ASSET_KEY_PREFIX}${tileId}`;
        const tileImg = this.add.image(sx, sy, assetKey);
        tileImg.setScale(this.tileScaleX, this.tileScaleY);
        tileImg.setOrigin(0.5, 0.5);

        this.tileContainer?.add(tileImg);
        this.tileImages.push(tileImg);
        tilesRendered++;
      }
    }

    console.log(`[Visual03a] Tiles rendered inside deck: ${tilesRendered} of ${GRID_N * GRID_N} total`);

    // ─── Update grid overlay ────────────────────────────────────

    this.drawGridOverlay();

    // ─── Update debug text ──────────────────────────────────────

    this.updateInfoText();
  }

  /** Draw the debug grid overlay using Graphics. */
  private drawGridOverlay(): void {
    if (!this.gridGraphics) return;

    const g = this.gridGraphics;
    g.clear();

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    g.lineStyle(1, GRID_COLOR, GRID_ALPHA);

    for (const placement of this.tilePlacements) {
      const sx = (placement.col - placement.row) * halfTW + this.platformOriginX;
      const sy = (placement.col + placement.row) * halfTH + this.platformOriginY;

      // Draw isometric diamond
      g.beginPath();
      g.moveTo(sx, sy - halfTH);                    // top vertex
      g.lineTo(sx + halfTW, sy);                     // right vertex
      g.lineTo(sx, sy + halfTH);                     // bottom vertex
      g.lineTo(sx - halfTW, sy);                     // left vertex
      g.closePath();
      g.strokePath();
    }

    // Also draw the effective deck diamond outline for visual reference
    const deck = this.getEffectiveDeckVertices();
    const dTop = this.assetToDisplay(deck.top.x, deck.top.y);
    const dRight = this.assetToDisplay(deck.right.x, deck.right.y);
    const dBottom = this.assetToDisplay(deck.bottom.x, deck.bottom.y);
    const dLeft = this.assetToDisplay(deck.left.x, deck.left.y);

    g.lineStyle(2, 0xffff00, 0.6);  // yellow, thicker
    g.beginPath();
    g.moveTo(dTop.x, dTop.y);
    g.lineTo(dRight.x, dRight.y);
    g.lineTo(dBottom.x, dBottom.y);
    g.lineTo(dLeft.x, dLeft.y);
    g.closePath();
    g.strokePath();
  }

  /** Update the info overlay text. */
  private updateInfoText(): void {
    if (!this.infoText) return;

    const ratio = this.runtimeTileW / this.runtimeTileH;
    const deck = this.getEffectiveDeckVertices();
    const effectiveW = deck.right.x - deck.left.x;
    const effectiveH = deck.bottom.y - deck.top.y;

    const lines = [
      'VISUAL-03A — Runtime Layered Platform Prototype (variant 03)',
      '',
      `Grid: ${GRID_N}×${GRID_N} square  (${this.tilePlacements.length} tiles inside deck)`,
      `Runtime tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)} px`,
      `Tile ratio: ${ratio.toFixed(4)} (exact 2:1)`,
      `Source tile: ${SOURCE_TILE_W}×${SOURCE_TILE_H} px (2:1 diamond)`,
      '',
      `Frame cutout: ${INNER_W}×${INNER_H} px (top y=${FRAME_CUTOUT_TOP_Y})`,
      `Deck surface: ${effectiveW.toFixed(0)}×${effectiveH.toFixed(0)} px (variant 03)`,
      '',
      `Deck offsetX: ${this.deckOffsetX}  [← →] ±${DECK_STEP_POS}`,
      `Deck offsetY: ${this.deckOffsetY}  [↑ ↓] ±${DECK_STEP_POS}`,
      `Deck scale:   ${this.deckScale.toFixed(3)}  [ [ ] ] ±${DECK_STEP_SCALE}`,
      `[R] reset to defaults`,
      '',
      `Grid overlay: ${this.gridVisible ? 'ON' : 'OFF'}  [G] toggle`,
      '[ESC] exit → preload → menu',
      '',
      'URL: ?visual03a&deckX=0&deckY=-30&deckScale=0.92',
      'Mask: GeometryMask (deck diamond clip)',
      'Dev-only prototype. No runtime integration.',
    ];

    this.infoText.setText(lines.join('\n'));
  }
}
