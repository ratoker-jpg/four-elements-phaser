/**
 * Building Placement Metadata — data model for systemic building PNG placement.
 *
 * BUILD-ANCHOR-01: Model-only. No rendering changes.
 *
 * Source of truth: docs/BUILDING_PLACEMENT_STRATEGY.md
 *
 * Design principles:
 * ─────────────────
 * 1. Metadata is generated OFFLINE by tools/generate_building_meta.py
 *    (BUILD-ANCHOR-02). The runtime must NEVER scan PNG pixels — alpha
 *    bounds and ground-line ratios are pre-computed and committed as
 *    TypeScript data in generatedBuildingMeta.ts.
 *
 * 2. Buildings anchor to the FOOTPRINT SOUTH VERTEX, not to the geometric
 *    center of the multi-tile footprint. This matches the visual rest point
 *    where the building meets the isometric terrain.
 *
 * 3. The dev tuner (if present) is DIAGNOSTIC ONLY — it must not become the
 *    production placement model, must not require manual tuning for every PNG,
 *    and must not persist values into gameplay saves.
 *
 * 4. Exception offsets (exceptionOffsetX/Y) are for rare visual overrides
 *    only — they are NOT the default mechanism. The production model should
 *    place buildings correctly using alpha bounds + ground-line ratio alone.
 *
 * 5. Buildings and units use DIFFERENT anchoring models. Buildings are
 *    static and anchor to multi-tile footprints; units are mobile and anchor
 *    to fractional tile positions. Do not mix these systems.
 */

import type { BuildingType, Faction } from '../state/types';
import { GENERATED_BUILDING_META } from './generatedBuildingMeta';

// ─── Supporting Types ───────────────────────────────────────────────

/**
 * Bounding box of non-transparent pixels within a building PNG.
 *
 * Generated offline by the alpha-bounds generator (BUILD-ANCHOR-02).
 * Coordinates are in source-image pixel space (0,0 = top-left of PNG).
 *
 * - `left` / `top`: first row/column with non-zero alpha
 * - `right` / `bottom`: last row/column with non-zero alpha (exclusive bound)
 *
 * Example: a 200×300 PNG with 10px transparent padding on all sides would have
 *   { left: 10, top: 10, right: 190, bottom: 290 }
 */
export interface AlphaBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * How a building image anchors to its gameplay footprint.
 *
 * - `'south-vertex'`: The image is positioned relative to the south/bottom
 *   vertex of the isometric footprint diamond. This is the standard model
 *   for most buildings — the visual ground contact point.
 *
 * - `'center'`: The image is positioned relative to the geometric center
 *   of the footprint. Only for special-case buildings that visually center
 *   rather than rest on the south edge.
 *
 * The default and recommended mode is `'south-vertex'`.
 * See docs/BUILDING_PLACEMENT_STRATEGY.md § "Key rule: buildings anchor
 * to the footprint south vertex".
 */
export type BuildingAnchorMode = 'south-vertex' | 'center';

/**
 * Rough visual category of a building for grouping and validation.
 *
 * - `'structure'`: Standard building with a visible base on the terrain.
 * - `'tower'`: Tall, narrow building — may need different depth sorting.
 * - `'flat'`: Low, wide building — e.g. storage pads, landing zones.
 *
 * This categorization is for metadata bookkeeping and does NOT affect
 * rendering directly. The renderer uses the numeric fields in
 * BuildingPlacementMeta for all placement decisions.
 */
export type BuildingPlacementCategory = 'structure' | 'tower' | 'flat';

// ─── Main Interface ─────────────────────────────────────────────────

/**
 * Metadata describing how a building PNG maps onto its gameplay footprint.
 *
 * One entry per (faction, buildingType) pair, because each faction's PNG
 * may have different source dimensions, alpha bounds, or ground-line ratios.
 *
 * Field ownership:
 * ─────────────────
 * - `buildingType`, `faction`, `assetKey`: identity — known at design time.
 * - `footprintW`, `footprintH`: from BUILDING_CONFIG in state/construction.ts.
 * - `sourceWidth`, `sourceHeight`: from the PNG file dimensions.
 * - `alphaBounds`, `visibleWidth`, `visibleHeight`: generated offline by
 *   the alpha-bounds generator script (BUILD-ANCHOR-02).
 * - `groundLineRatio`: generated offline from alpha bounds bottom.
 *   Ratio (0–1) of where the building's visual base sits relative to
 *   the source image height. Computed as alphaBounds.bottom / sourceHeight.
 *   For isometric buildings, the ground contact (south vertex of the
 *   building's diamond base) is at the bottom of the alpha content,
 *   so groundLineRatio ≈ 1.0.
 * - `originX`, `originY`: derived from groundLineRatio and alpha bounds.
 *   These are the Phaser setOrigin() values that position the sprite
 *   so its visual ground line aligns with the footprint anchor point.
 * - `targetDisplayWidth`: the desired rendered width in screen pixels.
 *   Typically based on footprint size in isometric space.
 * - `computedScale`: scale factor = targetDisplayWidth / sourceWidth.
 *   Pre-computed so the renderer does no division at runtime.
 * - `exceptionOffsetX/Y`: rare visual overrides. NOT the default
 *   placement mechanism. Use only when the metadata-driven formula
 *   cannot produce correct alignment (e.g. art asset irregularities).
 *
 * Runtime renderer formula (from BUILDING_PLACEMENT_STRATEGY.md):
 * ─────────────────────────────────────────────────────────────────────
 *   1. Read BUILDING_CONFIG footprint.
 *   2. Read BuildingPlacementMeta for the building type and faction.
 *   3. Compute the isometric footprint south vertex.
 *   4. Create or update Phaser Image for the building asset.
 *   5. Apply scale from metadata (computedScale).
 *   6. Apply origin from metadata ground-line ratio.
 *   7. Set image position to south vertex plus exception offset.
 *   8. Set depth from bottom/right footprint tile.
 */
export interface BuildingPlacementMeta {
  /** Building type — matches BuildingType in state/types.ts. */
  buildingType: BuildingType;

  /** Faction this entry applies to. Same building type may have different
   *  PNG dimensions across factions. */
  faction: Faction;

  /** Phaser texture key — must match the key registered by buildingAssets.ts.
   *  Example: 'building_cyan_separator' */
  assetKey: string;

  /** Source PNG width in pixels. */
  sourceWidth: number;

  /** Source PNG height in pixels. */
  sourceHeight: number;

  /** Bounding box of non-transparent pixels. Generated offline. */
  alphaBounds: AlphaBounds;

  /** Width of the visible (non-transparent) region in pixels.
   *  = alphaBounds.right - alphaBounds.left */
  visibleWidth: number;

  /** Height of the visible (non-transparent) region in pixels.
   *  = alphaBounds.bottom - alphaBounds.top */
  visibleHeight: number;

  /** Footprint width in tiles. Must match BUILDING_CONFIG.footprintW. */
  footprintW: number;

  /** Footprint height in tiles. Must match BUILDING_CONFIG.footprintH. */
  footprintH: number;

  /** How the building anchors to its footprint. Default: 'south-vertex'. */
  anchorMode: BuildingAnchorMode;

  /** Visual category for bookkeeping. Does not affect rendering directly. */
  category: BuildingPlacementCategory;

  /**
   * Ratio (0–1) indicating where the building's visual base sits
   * relative to the source image height.
   *
   * Computed as alphaBounds.bottom / sourceHeight.
   *
   * For isometric building sprites, the visual ground contact point
   * (south vertex of the building's diamond base) is at the bottom
   * of the alpha content, so groundLineRatio ≈ 1.0.
   *
   * BUILD-ANCHOR-03 fixup: previously used a widest-row heuristic
   * that picked the building's midsection (~0.59–0.69), causing a
   * large visible shift. Now uses alpha-bottom for correct placement.
   */
  groundLineRatio: number;

  /** Phaser setOrigin() X value. Derived from alpha bounds. */
  originX: number;

  /** Phaser setOrigin() Y value. Derived from ground-line ratio. */
  originY: number;

  /** Desired rendered width in screen pixels. */
  targetDisplayWidth: number;

  /** Pre-computed scale factor = targetDisplayWidth / sourceWidth. */
  computedScale: number;

  /**
   * Rare visual X offset in screen pixels. NOT the default placement
   * mechanism — only for exceptions the metadata formula cannot handle.
   * Undefined or 0 means no offset.
   */
  exceptionOffsetX?: number;

  /**
   * Rare visual Y offset in screen pixels. NOT the default placement
   * mechanism — only for exceptions the metadata formula cannot handle.
   * Undefined or 0 means no offset.
   */
  exceptionOffsetY?: number;
}

// ─── Registry ───────────────────────────────────────────────────────

/**
 * Registry key format: `${faction}_${buildingType}`
 * Matches the asset key convention without the 'building_' prefix.
 *
 * Example: 'cyan_separator', 'green_raw-storage', 'purple_units-factory'
 */
type MetaRegistryKey = `${Faction}_${BuildingType}`;

/**
 * Building placement metadata registry.
 *
 * Initially empty — entries will be populated by BUILD-ANCHOR-02
 * (offline alpha-bounds generator) and committed as TypeScript data.
 *
 * At runtime, the renderer looks up metadata via getBuildingPlacementMeta().
 * If no entry exists, the renderer should continue using its current
 * fallback behavior (e.g. green diamond placeholder).
 */
const BUILDING_PLACEMENT_META: Partial<Record<MetaRegistryKey, BuildingPlacementMeta>> = {};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Build the registry key from faction and building type.
 *
 * @internal — exported for testing only.
 */
export function buildMetaRegistryKey(faction: Faction, buildingType: BuildingType): MetaRegistryKey {
  return `${faction}_${buildingType}`;
}

/**
 * Look up building placement metadata for a specific faction and building type.
 *
 * Returns `undefined` if no metadata entry exists — the caller should
 * fall back to its current rendering behavior (e.g. placeholder).
 *
 * This function does NOT scan PNGs, compute alpha bounds, or perform
 * any I/O. It is a pure lookup from the committed registry.
 */
export function getBuildingPlacementMeta(
  faction: Faction,
  buildingType: BuildingType,
): BuildingPlacementMeta | undefined {
  const key = buildMetaRegistryKey(faction, buildingType);
  return BUILDING_PLACEMENT_META[key];
}

/**
 * Check whether placement metadata exists for a specific faction and
 * building type.
 *
 * Useful for the renderer to decide between metadata-driven placement
 * and fallback rendering without performing a lookup and checking
 * for undefined.
 */
export function hasBuildingPlacementMeta(
  faction: Faction,
  buildingType: BuildingType,
): boolean {
  const key = buildMetaRegistryKey(faction, buildingType);
  return key in BUILDING_PLACEMENT_META;
}

/**
 * Register a building placement metadata entry.
 *
 * Intended for use by the offline generator script output and for tests.
 * Not intended for runtime hot-patching — metadata should be committed
 * as static TypeScript data.
 *
 * If an entry already exists for the same (faction, buildingType) pair,
 * this function overwrites it silently (last-write-wins).
 */
export function registerBuildingPlacementMeta(meta: BuildingPlacementMeta): void {
  const key = buildMetaRegistryKey(meta.faction, meta.buildingType);
  BUILDING_PLACEMENT_META[key] = meta;
}

// ─── Derived-field computation helpers ────────────────────────────────

/**
 * Compute visible width from alpha bounds.
 *
 * visibleWidth = alphaBounds.right - alphaBounds.left
 * (right is exclusive, like array slice end)
 */
export function computeVisibleWidth(alphaBounds: AlphaBounds): number {
  return alphaBounds.right - alphaBounds.left;
}

/**
 * Compute visible height from alpha bounds.
 *
 * visibleHeight = alphaBounds.bottom - alphaBounds.top
 * (bottom is exclusive, like array slice end)
 */
export function computeVisibleHeight(alphaBounds: AlphaBounds): number {
  return alphaBounds.bottom - alphaBounds.top;
}

/**
 * Compute Phaser setOrigin() X value from alpha bounds and source width.
 *
 * The origin X positions the sprite so its visible horizontal center
 * aligns with the placement point.
 *
 * originX = (alphaBounds.left + alphaBounds.right) / 2 / sourceWidth
 */
export function computeOriginX(alphaBounds: AlphaBounds, sourceWidth: number): number {
  const visibleCenterX = (alphaBounds.left + alphaBounds.right) / 2;
  return visibleCenterX / sourceWidth;
}

/**
 * Compute Phaser setOrigin() Y value from ground-line ratio.
 *
 * originY = groundLineRatio = alphaBounds.bottom / sourceHeight
 *
 * This places the sprite anchor at the visual base of the building,
 * aligning the building's ground contact point with the footprint
 * south vertex.
 *
 * BUILD-ANCHOR-03 fixup: groundLineRatio is now computed from the
 * alpha bounds bottom rather than the widest-row heuristic.
 */
export function computeOriginY(groundLineRatio: number): number {
  return groundLineRatio;
}

/**
 * Compute the target display width for a building based on its isometric
 * footprint size.
 *
 * Uses a footprint-size lookup tuned for isometric 2:1 building sprites.
 * The display width is the maximum horizontal span of the rendered building
 * image on screen, chosen so each footprint category looks proportional
 * without manual per-building tuning.
 *
 * Footprint-size mapping:
 *   1x1 =>  65px   (single tile, small structure)
 *   2x2 => 128px   (standard building)
 *   3x3 => 200px   (large facility)
 *
 * For non-square footprints (e.g. 2x3), the larger dimension determines
 * the mapping tier. For footprints larger than 3x3, a linear extrapolation
 * from the 3x3 anchor point is used as a systemic fallback.
 *
 * BUILD-ANCHOR-03 scale fixup: replaced (fpW+fpH)*38 formula with explicit
 * footprint-size mapping.
 */
export function computeTargetDisplayWidth(footprintW: number, footprintH: number): number {
  const maxDim = Math.max(footprintW, footprintH);

  const FOOTPRINT_DISPLAY_WIDTHS: Record<number, number> = {
    1: 65,
    2: 128,
    3: 200,
  };

  if (maxDim in FOOTPRINT_DISPLAY_WIDTHS) {
    return FOOTPRINT_DISPLAY_WIDTHS[maxDim];
  }

  // Systemic fallback: extrapolate linearly from 3x3 anchor.
  // Slope from 2x2→3x3: (200 - 128) / (3 - 2) = 72 px per tile
  const baseWidth = FOOTPRINT_DISPLAY_WIDTHS[3];
  const extraTiles = maxDim - 3;
  return baseWidth + extraTiles * 72;
}

/**
 * Compute the scale factor to render a building at the target display width.
 *
 * computedScale = targetDisplayWidth / sourceWidth
 *
 * Pre-computed so the renderer does no division at runtime.
 */
export function computeScale(targetDisplayWidth: number, sourceWidth: number): number {
  return targetDisplayWidth / sourceWidth;
}

/**
 * Detect building visual category from visible content aspect ratio.
 *
 * - 'tower': height/width > 1.5 (tall, narrow)
 * - 'flat': height/width < 0.7 (wide, short)
 * - 'structure': default (balanced proportions)
 */
export function detectCategory(visibleWidth: number, visibleHeight: number): BuildingPlacementCategory {
  if (visibleWidth === 0) return 'structure';
  const ratio = visibleHeight / visibleWidth;
  if (ratio > 1.5) return 'tower';
  if (ratio < 0.7) return 'flat';
  return 'structure';
}

// ─── Registry initialization from generated data ─────────────────────

// Populate the registry with all generated metadata entries at module load.
// The generated data is committed TypeScript — no runtime I/O or PNG scanning.
for (const meta of GENERATED_BUILDING_META) {
  registerBuildingPlacementMeta(meta);
}
