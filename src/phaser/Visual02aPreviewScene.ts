/**
 * Visual02aPreviewScene — dev-only layered platform frame preview.
 *
 * VISUAL-02A: Renders the approved VISUAL-01B layered map model:
 *   Layer 0 — background world image
 *   Layer 1 — tile-filled platform center (balanced 8 tiles)
 *   Layer 2 — arena frame overlay with transparent center
 *   Layer 3 — optional debug grid overlay (toggle with G key)
 *
 * This scene does NOT replace production terrain.
 * It does NOT modify gameplay, pathfinding, economy, or any production system.
 * It is activated only via the ?visual02a URL parameter.
 *
 * Access: http://localhost:3000/?visual02a
 */

import Phaser from 'phaser';

// ─── Tile metadata (mirrors the JSON metadata) ─────────────────────

interface TileMeta {
  id: number;
  file: string;
  tags: string[];
  recommendedWeight: number;
}

// ─── Preview configuration ─────────────────────────────────────────

/**
 * Grid size for the preview platform fill.
 * 8 columns × 4 rows = 32 tiles (matches VISUAL-01C N32 proof).
 */
const PREVIEW_GRID_COLS = 8;
const PREVIEW_GRID_ROWS = 4;

/**
 * Source tile dimensions (from metadata).
 * These are the pixel dimensions of the tile PNG files.
 */
const SOURCE_TILE_W = 384;
const SOURCE_TILE_H = 192;

/**
 * Runtime tile dimensions for the preview.
 * The frame center is ~1478×852 px. For an 8×4 isometric grid:
 *   span = cols + rows - 1 = 11
 *   tileW = 1478 / 11 ≈ 134
 *   tileH = 852 / 11 ≈ 77
 * Ratio: 134/77 ≈ 1.74 — close to 2:1 but the frame cutout is not exact.
 *
 * For a clean 2:1 ratio at the same span:
 *   tileW = 134, tileH = 67  (exactly 2:1)
 *   or tileW = 140, tileH = 70
 *
 * We use the measured frame cutout to compute the best-fit tile size,
 * then document the ratio.
 */
const FRAME_CENTER_X = 836;
const FRAME_CENTER_Y = 466;
const FRAME_INNER_W = 1478;
const FRAME_INNER_H = 852;

/** Asset keys for dev-visual preview assets */
const ASSET_KEY_BG = 'visual02a_bg';
const ASSET_KEY_FRAME = 'visual02a_frame';
const TILE_ASSET_KEY_PREFIX = 'visual02a_tile_';

/** Grid overlay color (green, semi-transparent) */
const GRID_COLOR = 0x00ff00;
const GRID_ALPHA = 0.4;

/** Depth layers */
const DEPTH_BG = 0;
const DEPTH_TILES = 10;
const DEPTH_GRID = 20;
const DEPTH_FRAME = 30;
const DEPTH_UI = 40;

// ─── Weighted random tile picker ───────────────────────────────────

class WeightedTilePicker {
  private tiles: number[];
  private cumulativeWeights: number[];
  private totalWeight: number;
  private rng: () => number;

  constructor(tileMetas: TileMeta[], seed: number) {
    // Seeded PRNG (simple mulberry32)
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

// ─── Scene ─────────────────────────────────────────────────────────

export class Visual02aPreviewScene extends Phaser.Scene {
  private gridVisible = false;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private infoText: Phaser.GameObjects.Text | null = null;

  /** Computed runtime tile dimensions from frame cutout */
  private runtimeTileW = 0;
  private runtimeTileH = 0;

  /** Computed platform origin (top-left corner of the tile grid) */
  private platformOriginX = 0;
  private platformOriginY = 0;

  /** Stored tile placements for grid overlay */
  private tilePlacements: { tx: number; ty: number; tileId: number }[] = [];

  constructor() {
    super({ key: 'Visual02aPreviewScene' });
  }

  preload(): void {
    // Load background world candidate
    this.load.image(ASSET_KEY_BG, 'dev-visual/visual-02a/background_world_candidate_01.png');

    // Load arena frame overlay
    this.load.image(ASSET_KEY_FRAME, 'dev-visual/visual-02a/arena_frame_alpha.png');

    // Load balanced 8 tiles
    const tileIds = [1, 2, 5, 6, 7, 8, 9, 10];
    for (const id of tileIds) {
      const key = `${TILE_ASSET_KEY_PREFIX}${id}`;
      const file = `dev-visual/visual-02a/tiles/platform_tile_${String(id).padStart(3, '0')}.png`;
      this.load.image(key, file);
    }

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[Visual02a] Failed to load: ${file.key} (${file.url})`);
    });
  }

  create(): void {
    const cam = this.cameras.main;
    const canvasW = cam.width;
    const canvasH = cam.height;

    // ─── Compute runtime tile dimensions ─────────────────────────

    // The frame is 1672×941 and centered in the canvas.
    // Scale background and frame to fit the canvas.
    const frameImg = this.textures.get(ASSET_KEY_FRAME);
    const frameW = frameImg.getSourceImage().width;   // 1672
    const frameH = frameImg.getSourceImage().height;   // 941

    // Scale to fit canvas while maintaining aspect ratio
    const scaleToFit = Math.min(canvasW / frameW, canvasH / frameH);
    const displayW = frameW * scaleToFit;
    const displayH = frameH * scaleToFit;
    const offsetX = (canvasW - displayW) / 2;
    const offsetY = (canvasH - displayH) / 2;

    // The frame center in display coordinates
    const displayCenterX = offsetX + FRAME_CENTER_X * scaleToFit;
    const displayCenterY = offsetY + FRAME_CENTER_Y * scaleToFit;
    const displayInnerW = FRAME_INNER_W * scaleToFit;
    const displayInnerH = FRAME_INNER_H * scaleToFit;

    // Compute runtime tile dimensions from the inner cutout
    // For isometric grid: span = cols + rows - 1
    const span = PREVIEW_GRID_COLS + PREVIEW_GRID_ROWS - 1;
    this.runtimeTileW = displayInnerW / span;
    this.runtimeTileH = displayInnerH / span;

    // The ratio won't be exactly 2:1 because the frame cutout is imperfect.
    // Document it in the console for review.
    const ratio = this.runtimeTileW / this.runtimeTileH;
    console.log(`[Visual02a] Runtime tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)}, ratio: ${ratio.toFixed(3)} (ideal: 2.0)`);
    console.log(`[Visual02a] Frame scale: ${scaleToFit.toFixed(4)}, display: ${displayW.toFixed(0)}×${displayH.toFixed(0)}`);

    // ─── Layer 0: Background world ───────────────────────────────

    const bgImg = this.textures.get(ASSET_KEY_BG);
    const bgW = bgImg.getSourceImage().width;
    const bgH = bgImg.getSourceImage().height;

    // Scale background to fill the canvas, centering it
    const bgScale = Math.max(canvasW / bgW, canvasH / bgH);
    const bg = this.add.image(canvasW / 2, canvasH / 2, ASSET_KEY_BG);
    bg.setScale(bgScale);
    bg.setDepth(DEPTH_BG);
    bg.setOrigin(0.5, 0.5);

    // ─── Layer 1: Tile-filled platform ───────────────────────────

    // Compute the top-left position of the isometric grid
    // For tile (0,0): screenX = (0-0)*halfW = 0, screenY = (0+0)*halfH = 0
    // The grid center is at tile ((cols-1)/2, (rows-1)/2)
    const halfTW = this.runtimeTileW / 2;
    const halfTH = this.runtimeTileH / 2;
    const centerCol = (PREVIEW_GRID_COLS - 1) / 2;
    const centerRow = (PREVIEW_GRID_ROWS - 1) / 2;
    const gridCenterX = (centerCol - centerRow) * halfTW;
    const gridCenterY = (centerCol + centerRow) * halfTH;

    this.platformOriginX = displayCenterX - gridCenterX;
    this.platformOriginY = displayCenterY - gridCenterY;

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

    // Stamp tiles onto a RenderTexture for performance
    // First, calculate the grid bounding box for the RenderTexture size
    const gridPositions: { col: number; row: number; screenX: number; screenY: number; tileId: number }[] = [];

    for (let row = 0; row < PREVIEW_GRID_ROWS; row++) {
      for (let col = 0; col < PREVIEW_GRID_COLS; col++) {
        const sx = (col - row) * halfTW + this.platformOriginX;
        const sy = (col + row) * halfTH + this.platformOriginY;
        const tileId = picker.pick();
        gridPositions.push({ col, row, screenX: sx, screenY: sy, tileId });
        this.tilePlacements.push({ tx: col, ty: row, tileId });
      }
    }

    // Find bounds for the tile layer
    let minSX = Infinity, minSY = Infinity, maxSX = -Infinity, maxSY = -Infinity;
    for (const pos of gridPositions) {
      minSX = Math.min(minSX, pos.screenX - this.runtimeTileW / 2);
      minSY = Math.min(minSY, pos.screenY - this.runtimeTileH / 2);
      maxSX = Math.max(maxSX, pos.screenX + this.runtimeTileW / 2);
      maxSY = Math.max(maxSY, pos.screenY + this.runtimeTileH / 2);
    }

    const rtPad = 8;
    const rtX = Math.floor(minSX - rtPad);
    const rtY = Math.floor(minSY - rtPad);
    const rtW = Math.ceil(maxSX - minSX + rtPad * 2);
    const rtH = Math.ceil(maxSY - minSY + rtPad * 2);

    const tileRT = this.add.renderTexture(rtX, rtY, rtW, rtH);
    tileRT.setOrigin(0, 0);
    tileRT.setDepth(DEPTH_TILES);

    // Stamp each tile onto the RenderTexture
    for (const pos of gridPositions) {
      const assetKey = `${TILE_ASSET_KEY_PREFIX}${pos.tileId}`;
      const stampX = pos.screenX - rtX;
      const stampY = pos.screenY - rtY;

      const stampConfig: Phaser.Types.Textures.StampConfig = {
        scaleX: tileScaleX,
        scaleY: tileScaleY,
        originX: 0.5,
        originY: 0.5,
      };

      tileRT.stamp(assetKey, undefined, stampX, stampY, stampConfig);
    }

    tileRT.render();

    // ─── Layer 2: Arena frame overlay ────────────────────────────

    const frame = this.add.image(offsetX + displayW / 2, offsetY + displayH / 2, ASSET_KEY_FRAME);
    frame.setScale(scaleToFit);
    frame.setDepth(DEPTH_FRAME);
    frame.setOrigin(0.5, 0.5);

    // ─── Layer 3: Debug grid overlay (initially hidden) ──────────

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
      // before reaching MainMenuScene. When ?visual02a bypasses BootScene's
      // normal flow, production textures are never loaded; starting
      // PreloadScene ensures they are available for New Game.
      // PreloadScene.complete → MainMenuScene automatically.
      console.log('[Visual02aPreviewScene] ESC pressed. Starting PreloadScene to load production assets before menu.');
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
      const sx = (placement.tx - placement.ty) * halfTW + this.platformOriginX;
      const sy = (placement.tx + placement.ty) * halfTH + this.platformOriginY;

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
      'VISUAL-02A — Layered Platform Preview',
      '',
      `Grid: ${PREVIEW_GRID_COLS}×${PREVIEW_GRID_ROWS} = ${PREVIEW_GRID_COLS * PREVIEW_GRID_ROWS} tiles`,
      `Runtime tile: ${this.runtimeTileW.toFixed(1)}×${this.runtimeTileH.toFixed(1)} px`,
      `Tile ratio: ${ratio.toFixed(3)} (ideal: 2.000)`,
      `Source tile: ${SOURCE_TILE_W}×${SOURCE_TILE_H} px (2:1 diamond)`,
      '',
      `Grid overlay: ${this.gridVisible ? 'ON' : 'OFF'}  [G] toggle`,
      '[ESC] exit → preload → menu',
      '',
      'Dev-only preview. No runtime integration.',
    ];

    this.infoText.setText(lines.join('\n'));
  }
}
