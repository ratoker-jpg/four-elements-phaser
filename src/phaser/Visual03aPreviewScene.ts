/**
 * Visual03aPreviewScene — dev-only runtime layered platform prototype.
 *
 * VISUAL-03A: Renders the approved VISUAL-01B layered map model with
 * proper geometry masking, using proven VISUAL-02B exact 2:1 geometry.
 *
 *   Layer 0 — background world image
 *   Layer 1 — platform tile layer (square NxN grid, clipped to diamond)
 *   Layer 2 — arena frame overlay with transparent center
 *   Layer 3 — optional debug grid overlay (toggle with G key)
 *   Layer 4 — info/debug text
 *
 * Key improvements over Visual02aPreviewScene:
 *   - Uses VISUAL-02B proven 2:1 diamond vertices for exact geometry
 *   - Square NxN grid so the tile grid diamond perfectly matches the cutout
 *   - GeometryMask clips tile layer to the arena diamond — no tile spill
 *   - No PNG pixel reading at runtime — geometry is explicit
 *
 * This scene does NOT replace production terrain.
 * It does NOT modify gameplay, pathfinding, economy, or any production system.
 * It is activated only via the ?visual03a URL parameter.
 *
 * Access: http://localhost:3000/?visual03a
 */

import Phaser from 'phaser';

// ─── Tile metadata ────────────────────────────────────────────────

interface TileMeta {
  id: number;
  file: string;
  tags: string[];
  recommendedWeight: number;
}

// ─── Geometry constants (VISUAL-02B proven 2:1 diamond) ──────────

/**
 * Target 2:1 inner cutout vertices from VISUAL-02B frame geometry proof.
 * These define the exact playable diamond boundary.
 *
 * Inner dimensions: 1604 × 802 px → ratio exactly 2.0
 * Canvas: 1672 × 941 px (frame asset size)
 */
const TARGET_V = {
  top:    { x: 836, y: 69  },
  right:  { x: 1638, y: 470 },
  bottom: { x: 836, y: 871 },
  left:   { x: 34,  y: 470 },
} as const;

const INNER_W = 1604;
const INNER_H = 802;

/** Center of the diamond */
const DIAMOND_CX = (TARGET_V.left.x + TARGET_V.right.x) / 2;   // 836
const DIAMOND_CY = (TARGET_V.top.y + TARGET_V.bottom.y) / 2;   // 470

/** Half-extents of the diamond */
const DIAMOND_HW = INNER_W / 2;  // 802
const DIAMOND_HH = INNER_H / 2;  // 401

// ─── Grid configuration ──────────────────────────────────────────

/**
 * Grid size for the preview platform fill.
 * Square NxN grid so the tile grid diamond perfectly matches the cutout.
 *
 * N=9 → 81 tiles total, ~40 visible inside the diamond.
 * th = INNER_H / N = 802 / 9 ≈ 89.11
 * tw = 2 × th ≈ 178.22
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

  /** Computed runtime tile dimensions from VISUAL-02B geometry */
  private runtimeTileW = 0;
  private runtimeTileH = 0;

  /** Computed platform origin (center of tile 0,0) */
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

    // ─── Compute frame scale and offset ─────────────────────────

    // Frame asset is 1672×941. Scale to fit canvas.
    const FRAME_ASSET_W = 1672;
    const FRAME_ASSET_H = 941;

    this.frameScale = Math.min(canvasW / FRAME_ASSET_W, canvasH / FRAME_ASSET_H);
    const displayW = FRAME_ASSET_W * this.frameScale;
    const displayH = FRAME_ASSET_H * this.frameScale;
    this.frameOffsetX = (canvasW - displayW) / 2;
    this.frameOffsetY = (canvasH - displayH) / 2;

    // ─── Compute runtime tile dimensions ────────────────────────

    // For a square NxN isometric grid:
    //   grid diamond height = N × th = INNER_H  →  th = INNER_H / N
    //   tw = 2 × th  (exact 2:1 ratio)
    // Grid diamond outline exactly matches target cutout diamond.
    this.runtimeTileH = (INNER_H / GRID_N) * this.frameScale;
    this.runtimeTileW = 2 * this.runtimeTileH;

    const ratio = this.runtimeTileW / this.runtimeTileH;
    console.log(`[Visual03a] Grid: ${GRID_N}×${GRID_N} square`);
    console.log(`[Visual03a] Runtime tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)}, ratio: ${ratio.toFixed(4)} (ideal: 2.0)`);
    console.log(`[Visual03a] Frame scale: ${this.frameScale.toFixed(4)}`);

    // ─── Compute platform origin ────────────────────────────────

    // For a square NxN grid, the origin (center of tile 0,0) is at:
    //   ox = DIAMOND_CX (scaled)
    //   oy = TARGET_V.top.y + th/2 (scaled)
    // This ensures the grid diamond top vertex lands exactly at
    // the target top vertex.
    const scaledCX = this.frameOffsetX + DIAMOND_CX * this.frameScale;
    const scaledCY = this.frameOffsetY + DIAMOND_CY * this.frameScale;

    this.platformOriginX = scaledCX;
    this.platformOriginY = this.frameOffsetY + TARGET_V.top.y * this.frameScale + this.runtimeTileH / 2;

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

    // Create diamond mask using Graphics
    this.maskGraphics = this.make.graphics({ x: 0, y: 0 });
    this.maskGraphics.fillStyle(MASK_COLOR, 1);

    // Draw diamond in display coordinates
    const dTopX = this.frameOffsetX + TARGET_V.top.x * this.frameScale;
    const dTopY = this.frameOffsetY + TARGET_V.top.y * this.frameScale;
    const dRightX = this.frameOffsetX + TARGET_V.right.x * this.frameScale;
    const dRightY = this.frameOffsetY + TARGET_V.right.y * this.frameScale;
    const dBottomX = this.frameOffsetX + TARGET_V.bottom.x * this.frameScale;
    const dBottomY = this.frameOffsetY + TARGET_V.bottom.y * this.frameScale;
    const dLeftX = this.frameOffsetX + TARGET_V.left.x * this.frameScale;
    const dLeftY = this.frameOffsetY + TARGET_V.left.y * this.frameScale;

    this.maskGraphics.beginPath();
    this.maskGraphics.moveTo(dTopX, dTopY);
    this.maskGraphics.lineTo(dRightX, dRightY);
    this.maskGraphics.lineTo(dBottomX, dBottomY);
    this.maskGraphics.lineTo(dLeftX, dLeftY);
    this.maskGraphics.closePath();
    this.maskGraphics.fillPath();

    // Create GeometryMask from the graphics
    const diamondMask = this.maskGraphics.createGeometryMask();

    // Create container for tiles — apply diamond mask
    this.tileContainer = this.add.container(0, 0);
    this.tileContainer.setDepth(DEPTH_TILES);
    this.tileContainer.setMask(diamondMask);

    // Tile scaling: source 384×192 → runtime tile size
    const tileScaleX = this.runtimeTileW / SOURCE_TILE_W;
    const tileScaleY = this.runtimeTileH / SOURCE_TILE_H;

    // Create weighted tile picker with seed for reproducibility
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

    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;

    // Check if a point is inside the diamond (with small margin for edge coverage)
    const scaledHW = DIAMOND_HW * this.frameScale;
    const scaledHH = DIAMOND_HH * this.frameScale;

    const isInDiamond = (px: number, py: number): boolean => {
      return (Math.abs(px - scaledCX) / scaledHW + Math.abs(py - scaledCY) / scaledHH) <= 1.15;
    };

    // Place tiles: only render those whose centers fall inside the diamond
    let tilesRendered = 0;

    for (let row = 0; row < GRID_N; row++) {
      for (let col = 0; col < GRID_N; col++) {
        const sx = (col - row) * halfTW + this.platformOriginX;
        const sy = (col + row) * halfTH + this.platformOriginY;

        // Only render tiles that overlap the diamond
        if (!isInDiamond(sx, sy)) continue;

        const tileId = picker.pick();
        this.tilePlacements.push({ col, row, tileId });

        const assetKey = `${TILE_ASSET_KEY_PREFIX}${tileId}`;
        const tileImg = this.add.image(sx, sy, assetKey);
        tileImg.setScale(tileScaleX, tileScaleY);
        tileImg.setOrigin(0.5, 0.5);

        this.tileContainer.add(tileImg);
        tilesRendered++;
      }
    }

    console.log(`[Visual03a] Tiles rendered inside diamond: ${tilesRendered} of ${GRID_N * GRID_N} total`);

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
      // Route through PreloadScene so normal runtime assets are loaded
      // before reaching MainMenuScene. When ?visual03a bypasses BootScene's
      // normal flow, production textures are never loaded; starting
      // PreloadScene ensures they are available for New Game.
      console.log('[Visual03aPreviewScene] ESC pressed. Starting PreloadScene to load production assets before menu.');
      this.scene.start('PreloadScene');
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
  }

  /** Update the info overlay text. */
  private updateInfoText(): void {
    if (!this.infoText) return;

    const ratio = this.runtimeTileW / this.runtimeTileH;
    const lines = [
      'VISUAL-03A — Runtime Layered Platform Prototype',
      '',
      `Grid: ${GRID_N}×${GRID_N} square  (${this.tilePlacements.length} tiles inside diamond)`,
      `Runtime tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)} px`,
      `Tile ratio: ${ratio.toFixed(4)} (exact 2:1)`,
      `Source tile: ${SOURCE_TILE_W}×${SOURCE_TILE_H} px (2:1 diamond)`,
      `Cutout: ${INNER_W}×${INNER_H} px (VISUAL-02B geometry)`,
      '',
      `Grid overlay: ${this.gridVisible ? 'ON' : 'OFF'}  [G] toggle`,
      '[ESC] exit → preload → menu',
      '',
      'Mask: GeometryMask (diamond clip)',
      'Dev-only prototype. No runtime integration.',
    ];

    this.infoText.setText(lines.join('\n'));
  }
}
