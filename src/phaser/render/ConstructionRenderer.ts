import Phaser from 'phaser';
import { tileToScreen, IsoPoint } from './isometric';
import { BUILDING_CONFIG } from '../../state/construction';
import { getCivilUnitKey } from '../../assets/civilUnitAssets';
import { DIR_ROW, IDLE_FRAME } from '../../assets/assetManifest';
import type { GameState, ConstructionSitePlacement, BuildingPlacement, BuilderPlacement, Faction } from '../../state/types';

/**
 * ConstructionRenderer — renders construction sites, completed buildings, and builders.
 *
 * ARCH-13E2: Minimal debug rendering for the Separator construction flow.
 * ARCH-13E3: Added builder rendering (small colored circle at fractional position).
 * ASSET-02: Builder now renders using spritesheet instead of circle.
 *
 * Construction sites are rendered as amber semi-transparent tile diamonds
 * with a progress bar above. Completed buildings are rendered as green
 * semi-transparent tile diamonds. Builders are rendered from the
 * `builder_{faction}` spritesheet loaded by civilUnitAssets.ts.
 *
 * If the builder texture is missing (e.g. unsupported faction), the builder
 * falls back to a colored circle matching the old debug rendering.
 */

// ─── Visual constants ──────────────────────────────────────────────

/** Amber fill for construction site footprints. */
const SITE_FILL_COLOR = 0xFFAA00;
const SITE_FILL_ALPHA = 0.4;
/** Amber outline for construction site footprints. */
const SITE_LINE_COLOR = 0xFF8800;
const SITE_LINE_ALPHA = 0.8;
/** Green fill for completed building footprints. */
const BUILDING_FILL_COLOR = 0x00AA55;
const BUILDING_FILL_ALPHA = 0.45;
/** Green outline for completed building footprints. */
const BUILDING_LINE_COLOR = 0x008844;
const BUILDING_LINE_ALPHA = 0.8;

/** Progress bar dimensions and colors. */
const PROGRESS_BAR_WIDTH = 60;
const PROGRESS_BAR_HEIGHT = 6;
const PROGRESS_BAR_Y_OFFSET = -30;
const PROGRESS_BG_COLOR = 0x333333;
const PROGRESS_BG_ALPHA = 0.7;
const PROGRESS_FILL_COLOR = 0x44FF44;
const PROGRESS_FILL_ALPHA = 0.9;

/** Tile half-dimensions for isometric diamond drawing. */
const HW = 76 / 2; // TILE_W / 2
const HH = 38 / 2; // TILE_H / 2

/** Builder spritesheet display scale — conservative, ~16% of 256px frame. */
const BUILDER_SCALE = 40 / 256;

/** Builder fallback circle rendering constants (used if texture is missing). */
const BUILDER_FALLBACK_RADIUS = 8;
const BUILDER_FALLBACK_COLOR_IDLE = 0x4488FF;
const BUILDER_FALLBACK_COLOR_MOVING = 0xFFCC00;
const BUILDER_FALLBACK_COLOR_BUILDING = 0x44FF44;
const BUILDER_FALLBACK_ALPHA = 0.9;
const BUILDER_FALLBACK_OUTLINE_COLOR = 0xFFFFFF;
const BUILDER_FALLBACK_OUTLINE_ALPHA = 0.6;

export class ConstructionRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Construction site Graphics objects keyed by site numeric ID. */
  private siteGraphics = new Map<number, Phaser.GameObjects.Graphics>();

  /** Completed building Graphics objects keyed by `${tx},${ty}`. */
  private buildingGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Builder Sprite objects keyed by builder index (spritesheet rendering). */
  private builderSprites = new Map<number, Phaser.GameObjects.Sprite>();

  /** Builder Graphics objects keyed by builder index (fallback circle rendering). */
  private builderFallbackGraphics = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Frame sync ────────────────────────────────────────────────

  /** Sync rendered construction sites, buildings, and builders from current GameState. */
  syncFromState(state: GameState): void {
    this.syncConstructionSites(state.mapData.constructionSites);
    this.syncBuildings(state.mapData.buildings);
    this.syncBuilders(state.mapData.builders, state.playerFaction);
  }

  private syncConstructionSites(sites: ConstructionSitePlacement[]): void {
    const activeIds = new Set<number>();

    for (const site of sites) {
      activeIds.add(site.id);

      if (!this.siteGraphics.has(site.id)) {
        const g = this.scene.add.graphics();
        this.siteGraphics.set(site.id, g);
      }

      // Redraw entire graphics (diamond + progress bar)
      const g = this.siteGraphics.get(site.id)!;
      g.clear();
      this.drawSiteDiamond(g, site);
      this.drawProgressBar(g, site);
      this.setDepthFromFootprint(g, site.tx, site.ty, site.type);
    }

    // Destroy graphics for completed/removed sites
    for (const [id, g] of this.siteGraphics) {
      if (!activeIds.has(id)) {
        g.destroy();
        this.siteGraphics.delete(id);
      }
    }
  }

  private syncBuildings(buildings: BuildingPlacement[]): void {
    const activeKeys = new Set<string>();

    for (const building of buildings) {
      const key = `${building.tx},${building.ty}`;
      activeKeys.add(key);

      if (!this.buildingGraphics.has(key)) {
        const g = this.scene.add.graphics();
        this.drawBuildingDiamond(g, building);
        this.setDepthFromFootprint(g, building.tx, building.ty, building.type);
        this.buildingGraphics.set(key, g);
      }
    }

    // Destroy graphics for removed buildings (unlikely but safe)
    for (const [key, g] of this.buildingGraphics) {
      if (!activeKeys.has(key)) {
        g.destroy();
        this.buildingGraphics.delete(key);
      }
    }
  }

  private syncBuilders(builders: BuilderPlacement[], faction: Faction): void {
    const textureKey = getCivilUnitKey(faction, 'builder');
    const textureExists = this.scene.textures.exists(textureKey);

    for (let bi = 0; bi < builders.length; bi++) {
      const builder = builders[bi];

      if (textureExists) {
        // Spritesheet rendering path
        this.syncBuilderSprite(bi, builder, textureKey, faction);
        // Clean up any fallback graphics if they exist from a previous frame
        const fallback = this.builderFallbackGraphics.get(bi);
        if (fallback) {
          fallback.destroy();
          this.builderFallbackGraphics.delete(bi);
        }
      } else {
        // Fallback circle rendering path
        this.syncBuilderFallback(bi, builder);
        // Clean up any sprite if it exists from a previous frame
        const sprite = this.builderSprites.get(bi);
        if (sprite) {
          sprite.destroy();
          this.builderSprites.delete(bi);
        }
      }
    }

    // Destroy objects for removed builders
    for (const [bi, sprite] of this.builderSprites) {
      if (bi >= builders.length) {
        sprite.destroy();
        this.builderSprites.delete(bi);
      }
    }
    for (const [bi, g] of this.builderFallbackGraphics) {
      if (bi >= builders.length) {
        g.destroy();
        this.builderFallbackGraphics.delete(bi);
      }
    }
  }

  /**
   * Sync builder using spritesheet rendering.
   * Creates the sprite on first call, then updates position each frame.
   *
   * Uses fixed DIR_ROW.S (south-facing) for all phases.
   * Direction tracking can be added in a future PR.
   */
  private syncBuilderSprite(
    bi: number,
    builder: BuilderPlacement,
    textureKey: string,
    _faction: Faction,
  ): void {
    // Compute screen position from fractional tile
    const screenPos = tileToScreen(builder.ftx, builder.fty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    // Fixed south-facing frame: DIR_ROW.S * 8 + IDLE_FRAME
    const frameIndex = DIR_ROW.S * 8 + IDLE_FRAME;

    // Get or create sprite
    let sprite = this.builderSprites.get(bi);
    if (!sprite) {
      sprite = this.scene.add.sprite(worldX, worldY, textureKey, frameIndex);
      sprite.setScale(BUILDER_SCALE);
      sprite.setOrigin(0.5, 0.75);
      this.builderSprites.set(bi, sprite);
    }

    // Update position each frame
    sprite.setPosition(worldX, worldY);
    sprite.setDepth(110 + worldY);
  }

  /**
   * Sync builder using fallback circle rendering.
   * Used when the builder spritesheet texture is not available.
   */
  private syncBuilderFallback(bi: number, builder: BuilderPlacement): void {
    if (!this.builderFallbackGraphics.has(bi)) {
      const g = this.scene.add.graphics();
      this.builderFallbackGraphics.set(bi, g);
    }

    const g = this.builderFallbackGraphics.get(bi)!;
    g.clear();
    this.drawBuilderFallbackCircle(g, builder);
  }

  // ─── Drawing helpers ───────────────────────────────────────────

  /** Draw amber isometric diamonds for each tile in the construction site footprint. */
  private drawSiteDiamond(g: Phaser.GameObjects.Graphics, site: ConstructionSitePlacement): void {
    const config = BUILDING_CONFIG[site.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;

    for (let dy = 0; dy < fpH; dy++) {
      for (let dx = 0; dx < fpW; dx++) {
        const screenPos = tileToScreen(site.tx + dx, site.ty + dy);
        const cx = screenPos.x + this.offset.x;
        const cy = screenPos.y + this.offset.y;

        // Filled diamond
        g.fillStyle(SITE_FILL_COLOR, SITE_FILL_ALPHA);
        g.beginPath();
        g.moveTo(cx, cy - HH);
        g.lineTo(cx + HW, cy);
        g.lineTo(cx, cy + HH);
        g.lineTo(cx - HW, cy);
        g.closePath();
        g.fillPath();

        // Diamond outline
        g.lineStyle(1, SITE_LINE_COLOR, SITE_LINE_ALPHA);
        g.beginPath();
        g.moveTo(cx, cy - HH);
        g.lineTo(cx + HW, cy);
        g.lineTo(cx, cy + HH);
        g.lineTo(cx - HW, cy);
        g.closePath();
        g.strokePath();
      }
    }
  }

  /** Draw progress bar above the center of the construction site footprint. */
  private drawProgressBar(g: Phaser.GameObjects.Graphics, site: ConstructionSitePlacement): void {
    const config = BUILDING_CONFIG[site.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;

    // Center of the footprint
    const centerScreen = tileToScreen(site.tx + fpW / 2, site.ty + fpH / 2);
    const cx = centerScreen.x + this.offset.x;
    const cy = centerScreen.y + this.offset.y + PROGRESS_BAR_Y_OFFSET;

    const barLeft = cx - PROGRESS_BAR_WIDTH / 2;
    const barTop = cy - PROGRESS_BAR_HEIGHT / 2;

    // Background bar
    g.fillStyle(PROGRESS_BG_COLOR, PROGRESS_BG_ALPHA);
    g.fillRect(barLeft, barTop, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT);

    // Fill bar (proportional to progress)
    const fillWidth = PROGRESS_BAR_WIDTH * site.progress;
    if (fillWidth > 0) {
      g.fillStyle(PROGRESS_FILL_COLOR, PROGRESS_FILL_ALPHA);
      g.fillRect(barLeft, barTop, fillWidth, PROGRESS_BAR_HEIGHT);
    }

    // Border
    g.lineStyle(1, 0x666666, 0.5);
    g.strokeRect(barLeft, barTop, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT);
  }

  /** Draw green isometric diamonds for each tile in the completed building footprint. */
  private drawBuildingDiamond(g: Phaser.GameObjects.Graphics, building: BuildingPlacement): void {
    const config = BUILDING_CONFIG[building.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;

    for (let dy = 0; dy < fpH; dy++) {
      for (let dx = 0; dx < fpW; dx++) {
        const screenPos = tileToScreen(building.tx + dx, building.ty + dy);
        const cx = screenPos.x + this.offset.x;
        const cy = screenPos.y + this.offset.y;

        // Filled diamond
        g.fillStyle(BUILDING_FILL_COLOR, BUILDING_FILL_ALPHA);
        g.beginPath();
        g.moveTo(cx, cy - HH);
        g.lineTo(cx + HW, cy);
        g.lineTo(cx, cy + HH);
        g.lineTo(cx - HW, cy);
        g.closePath();
        g.fillPath();

        // Diamond outline
        g.lineStyle(1, BUILDING_LINE_COLOR, BUILDING_LINE_ALPHA);
        g.beginPath();
        g.moveTo(cx, cy - HH);
        g.lineTo(cx + HW, cy);
        g.lineTo(cx, cy + HH);
        g.lineTo(cx - HW, cy);
        g.closePath();
        g.strokePath();
      }
    }
  }

  /** Set depth for isometric z-ordering based on the bottom of the footprint. */
  private setDepthFromFootprint(
    g: Phaser.GameObjects.Graphics,
    tx: number,
    ty: number,
    buildingType: string,
  ): void {
    const config = BUILDING_CONFIG[buildingType as keyof typeof BUILDING_CONFIG];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;

    // Use the bottom-center tile for depth sorting
    const depthTx = tx + fpW - 1;
    const depthTy = ty + fpH - 1;
    const screenPos = tileToScreen(depthTx, depthTy);
    const worldY = screenPos.y + this.offset.y;
    g.setDepth(100 + worldY);
  }

  /** Draw a small colored circle for a builder at their fractional tile position (fallback). */
  private drawBuilderFallbackCircle(g: Phaser.GameObjects.Graphics, builder: BuilderPlacement): void {
    // Use fractional position for smooth movement
    const screenPos = tileToScreen(builder.ftx, builder.fty);
    const cx = screenPos.x + this.offset.x;
    const cy = screenPos.y + this.offset.y;

    // Pick color based on phase
    let fillColor: number;
    switch (builder.phase) {
      case 'idle':
        fillColor = BUILDER_FALLBACK_COLOR_IDLE;
        break;
      case 'moving-to-site':
        fillColor = BUILDER_FALLBACK_COLOR_MOVING;
        break;
      case 'building':
        fillColor = BUILDER_FALLBACK_COLOR_BUILDING;
        break;
    }

    // Filled circle
    g.fillStyle(fillColor, BUILDER_FALLBACK_ALPHA);
    g.fillCircle(cx, cy - 4, BUILDER_FALLBACK_RADIUS);

    // Outline
    g.lineStyle(1.5, BUILDER_FALLBACK_OUTLINE_COLOR, BUILDER_FALLBACK_OUTLINE_ALPHA);
    g.strokeCircle(cx, cy - 4, BUILDER_FALLBACK_RADIUS);

    // Depth based on position
    g.setDepth(110 + cy);
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    for (const g of this.siteGraphics.values()) {
      g.destroy();
    }
    this.siteGraphics.clear();

    for (const g of this.buildingGraphics.values()) {
      g.destroy();
    }
    this.buildingGraphics.clear();

    for (const sprite of this.builderSprites.values()) {
      sprite.destroy();
    }
    this.builderSprites.clear();

    for (const g of this.builderFallbackGraphics.values()) {
      g.destroy();
    }
    this.builderFallbackGraphics.clear();
  }
}
