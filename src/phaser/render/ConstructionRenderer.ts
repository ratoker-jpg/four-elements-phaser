import Phaser from 'phaser';
import { tileToScreen, IsoPoint, footprintSouthVertex } from './isometric';
import { BUILDING_CONFIG } from '../../state/construction';
import { getCivilUnitKey } from '../../assets/civilUnitAssets';
import { DIR_ROW, IDLE_FRAME } from '../../assets/assetManifest';
import { BUILDER_RENDER_SCALE } from '../../config/unitRenderConfig';
import { directionFromDelta } from '../../state/updateGameState';
import { getBuildingPlacementMeta, type BuildingPlacementMeta } from '../../assets/buildingPlacementMeta';
import type { GameState, ConstructionSitePlacement, BuildingPlacement, BuilderPlacement, Faction } from '../../state/types';

/**
 * ConstructionRenderer — renders construction sites, completed buildings, and builders.
 *
 * ARCH-13E2: Minimal debug rendering for the Separator construction flow.
 * ARCH-13E3: Added builder rendering (small colored circle at fractional position).
 * ASSET-02: Builder renders using `builder_{faction}` spritesheet loaded by civilUnitAssets.ts.
 * BUILD-ANCHOR-03: Completed buildings render as PNG images using metadata-driven
 *   south-vertex placement. Green diamond fallback remains for missing metadata/texture.
 *
 * Construction sites are rendered as amber semi-transparent tile diamonds
 * with a progress bar above. Completed buildings render as PNG images when
 * metadata and texture exist; otherwise as green semi-transparent tile diamonds.
 * Builders are rendered from the `builder_{faction}` spritesheet loaded by
 * civilUnitAssets.ts.
 *
 * If the builder texture is missing, a clear error is logged. ASSET-01
 * guarantees all builder textures are preloaded — a missing texture
 * indicates a preload bug, not a missing asset.
 */

// ─── Visual constants ──────────────────────────────────────────────

/** Amber fill for construction site footprints. */
const SITE_FILL_COLOR = 0xFFAA00;
const SITE_FILL_ALPHA = 0.4;
/** Amber outline for construction site footprints. */
const SITE_LINE_COLOR = 0xFF8800;
const SITE_LINE_ALPHA = 0.8;
/** Green fill for completed building footprints (fallback only). */
const BUILDING_FILL_COLOR = 0x00AA55;
const BUILDING_FILL_ALPHA = 0.45;
/** Green outline for completed building footprints (fallback only). */
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
/** ARCH-13A: Brighter fill color for active construction (builder present). */
const CONSTRUCTION_ACTIVE_FILL_COLOR = 0x88FFAA;
const CONSTRUCTION_ACTIVE_FILL_ALPHA = 1.0;

/** Tile half-dimensions for isometric diamond drawing. */
const HW = 76 / 2; // TILE_W / 2
const HH = 38 / 2; // TILE_H / 2

// Builder scale is now configured in unitRenderConfig.ts (ARCH-05A: ×1.45).
// BUILDER_RENDER_SCALE replaces the old BUILDER_SCALE constant.

export class ConstructionRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Construction site Graphics objects keyed by site numeric ID. */
  private siteGraphics = new Map<number, Phaser.GameObjects.Graphics>();

  /** Completed building Graphics objects (diamond fallback) keyed by `${tx},${ty}`. */
  private buildingGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Completed building Image objects (PNG rendering) keyed by `${tx},${ty}`. */
  private buildingImages = new Map<string, Phaser.GameObjects.Image>();

  /** Builder Sprite objects keyed by builder index (spritesheet rendering). */
  private builderSprites = new Map<number, Phaser.GameObjects.Sprite>();

  /** Whether a missing-texture error has already been logged (avoid spam). */
  private builderTextureErrorLogged = false;

  /** Previous builder tile positions for direction calculation. */
  private builderPrevTile = new Map<number, { ftx: number; fty: number }>();

  /** Set of `${faction}_${buildingType}` keys for which a missing-meta/texture
   *  warning has already been logged. Prevents per-frame spam. */
  private missingBuildingMetaLogged = new Set<string>();

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Frame sync ────────────────────────────────────────────────

  /** Sync rendered construction sites, buildings, and builders from current GameState. */
  syncFromState(state: GameState): void {
    this.syncConstructionSites(state.mapData.constructionSites);
    this.syncBuildings(state.mapData.buildings, state.playerFaction);
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

  private syncBuildings(buildings: BuildingPlacement[], faction: Faction): void {
    const activeKeys = new Set<string>();

    for (const building of buildings) {
      const key = `${building.tx},${building.ty}`;
      activeKeys.add(key);

      // Try metadata-driven PNG rendering
      const meta = getBuildingPlacementMeta(faction, building.type);
      const textureExists = meta ? this.scene.textures.exists(meta.assetKey) : false;

      if (meta && textureExists) {
        // PNG rendering path — destroy any stale diamond placeholder
        const staleGraphics = this.buildingGraphics.get(key);
        if (staleGraphics) {
          staleGraphics.destroy();
          this.buildingGraphics.delete(key);
        }

        // Create building Image if not already present
        if (!this.buildingImages.has(key)) {
          this.createBuildingImage(building, meta);
        }
      } else {
        // Diamond fallback — destroy any stale Image
        const staleImage = this.buildingImages.get(key);
        if (staleImage) {
          staleImage.destroy();
          this.buildingImages.delete(key);
        }

        // Create diamond if not already present
        if (!this.buildingGraphics.has(key)) {
          const g = this.scene.add.graphics();
          this.drawBuildingDiamond(g, building);
          this.setDepthFromFootprint(g, building.tx, building.ty, building.type);
          this.buildingGraphics.set(key, g);
        }

        // Log missing metadata/texture once per key, not every frame
        const logKey = `${faction}_${building.type}`;
        if (!this.missingBuildingMetaLogged.has(logKey)) {
          if (!meta) {
            console.warn(
              `[ConstructionRenderer] No placement metadata for "${logKey}". ` +
              `Falling back to diamond placeholder. Run: npm run generate:building-meta`,
            );
          } else {
            console.error(
              `[ConstructionRenderer] Texture "${meta.assetKey}" not found for "${logKey}". ` +
              `Check PreloadScene and buildingAssets.ts.`,
            );
          }
          this.missingBuildingMetaLogged.add(logKey);
        }
      }
    }

    // Destroy graphics for removed buildings
    for (const [key, g] of this.buildingGraphics) {
      if (!activeKeys.has(key)) {
        g.destroy();
        this.buildingGraphics.delete(key);
      }
    }

    // Destroy images for removed buildings
    for (const [key, img] of this.buildingImages) {
      if (!activeKeys.has(key)) {
        img.destroy();
        this.buildingImages.delete(key);
      }
    }
  }

  /**
   * Create a Phaser Image for a completed building using metadata-driven placement.
   *
   * BUILD-ANCHOR-03: South-vertex placement formula.
   *
   * Steps:
   * 1. Compute the isometric footprint south vertex.
   * 2. Apply exception offsets if present.
   * 3. Set texture, origin, scale, position, depth.
   */
  private createBuildingImage(building: BuildingPlacement, meta: BuildingPlacementMeta): void {
    // Compute south vertex of the footprint diamond
    const sv = footprintSouthVertex(building.tx, building.ty, meta.footprintW, meta.footprintH);
    const worldX = sv.x + this.offset.x + (meta.exceptionOffsetX ?? 0);
    const worldY = sv.y + this.offset.y + (meta.exceptionOffsetY ?? 0);

    // Create image with metadata-driven placement
    const image = this.scene.add.image(worldX, worldY, meta.assetKey);
    image.setOrigin(meta.originX, meta.originY);
    image.setScale(meta.computedScale);

    // Depth from bottom-right footprint tile
    const depth = this.computeBuildingDepth(building.tx, building.ty, meta.footprintW, meta.footprintH);
    image.setDepth(depth);

    const key = `${building.tx},${building.ty}`;
    this.buildingImages.set(key, image);
  }

  private syncBuilders(builders: BuilderPlacement[], faction: Faction): void {
    const textureKey = getCivilUnitKey(faction, 'builder');
    const textureExists = this.scene.textures.exists(textureKey);

    if (!textureExists) {
      // ASSET-01 guarantees builder textures are loaded. Missing texture = bug.
      if (!this.builderTextureErrorLogged) {
        console.error(
          `[ConstructionRenderer] Builder texture "${textureKey}" not found! ` +
          `ASSET-01 guarantees this texture is preloaded. Check PreloadScene and civilUnitAssets.ts.`,
        );
        this.builderTextureErrorLogged = true;
      }
      // Skip rendering builders — do NOT silently fall back to circles.
      // Destroy any stale sprites from a previous frame.
      for (const [bi, sprite] of this.builderSprites) {
        if (bi < builders.length) {
          sprite.destroy();
          this.builderSprites.delete(bi);
        }
      }
      return;
    }

    // Texture exists — clear the error flag if it was set from a transient issue
    this.builderTextureErrorLogged = false;

    for (let bi = 0; bi < builders.length; bi++) {
      const builder = builders[bi];
      this.syncBuilderSprite(bi, builder, textureKey);
    }

    // Destroy sprites for removed builders
    for (const [bi, sprite] of this.builderSprites) {
      if (bi >= builders.length) {
        sprite.destroy();
        this.builderSprites.delete(bi);
      }
    }
  }

  /**
   * Sync builder using spritesheet rendering.
   * Creates the sprite on first call, then updates position and facing each frame.
   *
   * ARCH-05A: Builder now faces movement direction while moving.
   * Uses directionFromDelta() from updateGameState to compute facing
   * from tile-space movement delta, matching harvester facing logic.
   */
  private syncBuilderSprite(
    bi: number,
    builder: BuilderPlacement,
    textureKey: string,
  ): void {
    // Compute screen position from fractional tile
    const screenPos = tileToScreen(builder.ftx, builder.fty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    // Default south-facing frame
    const frameIndex = DIR_ROW.S * 8 + IDLE_FRAME;

    // Get or create sprite
    let sprite = this.builderSprites.get(bi);
    if (!sprite) {
      sprite = this.scene.add.sprite(worldX, worldY, textureKey, frameIndex);
      sprite.setScale(BUILDER_RENDER_SCALE);
      sprite.setOrigin(0.5, 0.75);
      this.builderSprites.set(bi, sprite);
      this.builderPrevTile.set(bi, { ftx: builder.ftx, fty: builder.fty });
    }

    // Update position each frame
    sprite.setPosition(worldX, worldY);
    sprite.setDepth(110 + worldY);

    // Update facing direction based on movement delta
    const prev = this.builderPrevTile.get(bi);
    if (prev) {
      const dtx = builder.ftx - prev.ftx;
      const dty = builder.fty - prev.fty;
      if (Math.abs(dtx) > 0.001 || Math.abs(dty) > 0.001) {
        const dirIndex = directionFromDelta(dtx, dty);
        const frame = dirIndex * 8 + IDLE_FRAME;
        sprite.setFrame(frame);
      }
    }
    this.builderPrevTile.set(bi, { ftx: builder.ftx, fty: builder.fty });
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
      // ARCH-13A: Active construction gets a brighter pulse color
      const isActive = !site.pending && site.builderIndex >= 0;
      const fillColor = isActive ? CONSTRUCTION_ACTIVE_FILL_COLOR : PROGRESS_FILL_COLOR;
      const fillAlpha = isActive ? CONSTRUCTION_ACTIVE_FILL_ALPHA : PROGRESS_FILL_ALPHA;
      g.fillStyle(fillColor, fillAlpha);
      g.fillRect(barLeft, barTop, fillWidth, PROGRESS_BAR_HEIGHT);
    }

    // Border
    g.lineStyle(1, 0x666666, 0.5);
    g.strokeRect(barLeft, barTop, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT);

    // ARCH-13A: Active construction glow — subtle outer border pulse
    if (!site.pending && site.builderIndex >= 0) {
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 400 * Math.PI * 2);
      g.lineStyle(1, CONSTRUCTION_ACTIVE_FILL_COLOR, pulse);
      g.strokeRect(barLeft - 1, barTop - 1, PROGRESS_BAR_WIDTH + 2, PROGRESS_BAR_HEIGHT + 2);
    }
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

  // ─── Depth helpers ──────────────────────────────────────────────

  /** Compute depth value for isometric z-ordering from the bottom-right footprint tile. */
  private computeBuildingDepth(tx: number, ty: number, fpW: number, fpH: number): number {
    const depthTx = tx + fpW - 1;
    const depthTy = ty + fpH - 1;
    const screenPos = tileToScreen(depthTx, depthTy);
    return 100 + screenPos.y + this.offset.y;
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
    g.setDepth(this.computeBuildingDepth(tx, ty, fpW, fpH));
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

    for (const img of this.buildingImages.values()) {
      img.destroy();
    }
    this.buildingImages.clear();

    for (const sprite of this.builderSprites.values()) {
      sprite.destroy();
    }
    this.builderSprites.clear();
    this.builderPrevTile.clear();
  }
}
