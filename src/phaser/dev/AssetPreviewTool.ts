/**
 * AssetPreviewTool — dev-only asset upload and map placement preview.
 *
 * DEV-ASSET-PREVIEW-01: Allows uploading local image files and previewing
 * them on the live game map before committing them as production assets.
 * Works only in devtools/debug/arena mode. Inaccessible in standard mode.
 *
 * DEV-ASSET-PREVIEW-03: Extended chroma-key with custom HEX color, tolerance
 * slider, and reprocess controls. Original source data is preserved for
 * non-destructive reprocessing. Existing placements refresh automatically.
 *
 * Lifecycle:
 * - Created by GameScene when devtools is enabled.
 * - Toggled by hotkey `0` (opens/closes the preview panel).
 * - destroy() called in GameScene shutdown().
 *
 * This module handles the Phaser-side: temporary textures, preview sprites,
 * footprint overlays, and map placement. The DOM panel is in AssetPreviewPanel.
 */

import { tileToScreen, screenToTile, type IsoPoint } from '../render/isometric';
import { TILE_W, TILE_H } from '../../config/worldConfig';

// ─── Types ──────────────────────────────────────────────────────────

/** Supported footprint sizes for preview assets. */
export type PreviewFootprint = 1 | 2 | 3;

/** A single uploaded preview asset entry. */
export interface PreviewAssetEntry {
  /** Unique ID for this entry. */
  id: string;
  /** Original file name. */
  fileName: string;
  /** Phaser texture key generated from the uploaded image. */
  textureKey: string;
  /** Natural image dimensions. */
  naturalWidth: number;
  naturalHeight: number;
  /**
   * DEV-ASSET-PREVIEW-03: Original source data URL for non-destructive reprocessing.
   * Stored so the asset can be re-chroma-keyed with different color/tolerance
   * without re-uploading. null only if created programmatically without a file.
   */
  sourceDataUrl: string | null;
  /**
   * DEV-ASSET-PREVIEW-03: Chroma-key config used for the current texture.
   * null means no chroma-key was applied.
   */
  chromaKeyConfig: ChromaKeyConfig | null;
}

/** A placed preview asset on the map. */
export interface PreviewPlacement {
  /** Unique ID for this placement. */
  id: string;
  /** The uploaded asset entry this placement uses. */
  assetId: string;
  /** Tile X position (top-left of footprint). */
  tx: number;
  /** Tile Y position (top-left of footprint). */
  ty: number;
  /** Visual scale multiplier. */
  scale: number;
  /** Footprint size in tiles. */
  footprint: PreviewFootprint;
  /** Whether chroma-key is active for this placement. */
  chromaKey: boolean;
  /**
   * DEV-ASSET-PREVIEW-03: Chroma-key config snapshot at placement time.
   * Kept for compatibility; the actual chroma-key processing is on the asset.
   */
  chromaKeyConfig: ChromaKeyConfig | null;
}

/** Configuration for chroma-key processing. */
export interface ChromaKeyConfig {
  /** Target color to remove (default: #FF00FF pure magenta). */
  targetR: number;
  targetG: number;
  targetB: number;
  /** Tolerance per channel (0-255). */
  tolerance: number;
}

/** Default chroma-key config: pure magenta with moderate tolerance. */
export const DEFAULT_CHROMA_KEY_CONFIG: ChromaKeyConfig = {
  targetR: 255,
  targetG: 0,
  targetB: 255,
  tolerance: 32,
};

/** Default HEX string for chroma-key target color. */
export const DEFAULT_CHROMA_KEY_HEX = '#FF00FF';

/** Default tolerance value. */
export const DEFAULT_CHROMA_KEY_TOLERANCE = 32;

// ─── HEX parsing / normalization helpers (DEV-ASSET-PREVIEW-03) ──────

/**
 * Parse a HEX color string into {r, g, b} or null if invalid.
 * Accepts: #RRGGBB, RRGGBB, #rgb, rgb (shorthand expanded).
 * Case-insensitive.
 */
export function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  if (!input || typeof input !== 'string') return null;
  let hex = input.trim();
  // Strip leading #
  if (hex.startsWith('#')) hex = hex.slice(1);
  // Shorthand #rgb → #rrggbb
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return null;
  // Validate hex digits
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Normalize a HEX color string to uppercase #RRGGBB format.
 * Returns null if the input is not a valid HEX color.
 */
export function normalizeHexColor(input: string): string | null {
  const parsed = parseHexColor(input);
  if (!parsed) return null;
  const toHex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
}

/**
 * Create a ChromaKeyConfig from a HEX string and tolerance.
 * Returns null if the HEX string is invalid.
 */
export function createChromaKeyConfigFromHex(hex: string, tolerance: number): ChromaKeyConfig | null {
  const parsed = parseHexColor(hex);
  if (!parsed) return null;
  const clampedTolerance = Math.max(0, Math.min(255, Math.round(tolerance)));
  return {
    targetR: parsed.r,
    targetG: parsed.g,
    targetB: parsed.b,
    tolerance: clampedTolerance,
  };
}

// ─── Pure helpers (testable without Phaser) ─────────────────────────

/**
 * Apply chroma-key removal on ImageData.
 * Makes pixels matching the target color (within tolerance) fully transparent.
 * This is a pure function — no Phaser dependency.
 */
export function applyChromaKey(
  imageData: ImageData,
  config: ChromaKeyConfig = DEFAULT_CHROMA_KEY_CONFIG,
): ImageData {
  const { targetR, targetG, targetB, tolerance } = config;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - targetR);
    const dg = Math.abs(data[i + 1] - targetG);
    const db = Math.abs(data[i + 2] - targetB);
    if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
      data[i + 3] = 0; // set alpha to 0
    }
  }
  return imageData;
}

/**
 * Validate a footprint value. Returns the value if valid, else 1.
 */
export function validateFootprint(value: number): PreviewFootprint {
  if (value === 1 || value === 2 || value === 3) return value;
  return 1;
}

/**
 * Determine what action a map click should produce in the asset preview tool.
 * This is a pure function — no Phaser dependency — encoding the click-routing logic:
 *
 * - If the tool is inactive → no action.
 * - If active with a pending asset ID → place a new preview.
 * - If active with a selected placement (and no pending asset) → move the selected placement.
 * - If active with neither → no action.
 */
export type ClickAction =
  | { kind: 'none' }
  | { kind: 'place'; assetId: string; tx: number; ty: number; scale: number; footprint: PreviewFootprint }
  | { kind: 'move'; placementId: string; tx: number; ty: number };

export function resolveClickAction(params: {
  active: boolean;
  pendingAssetId: string | null;
  selectedPlacementId: string | null;
  tx: number;
  ty: number;
  currentScale: number;
  currentFootprint: PreviewFootprint;
}): ClickAction {
  if (!params.active) return { kind: 'none' };
  if (params.tx < 0 || params.ty < 0) return { kind: 'none' };

  if (params.pendingAssetId) {
    return {
      kind: 'place',
      assetId: params.pendingAssetId,
      tx: params.tx,
      ty: params.ty,
      scale: params.currentScale,
      footprint: params.currentFootprint,
    };
  }

  if (params.selectedPlacementId) {
    return {
      kind: 'move',
      placementId: params.selectedPlacementId,
      tx: params.tx,
      ty: params.ty,
    };
  }

  return { kind: 'none' };
}

/**
 * Compute the world position for a preview placement's anchor point.
 * Uses south-vertex anchoring like production buildings.
 */
export function previewPlacementWorldPos(
  tx: number,
  ty: number,
  footprint: PreviewFootprint,
  offset: IsoPoint,
): { x: number; y: number } {
  // South vertex of the footprint diamond (same as building placement)
  const brScreen = tileToScreen(tx + footprint - 1, ty + footprint - 1);
  return {
    x: brScreen.x + offset.x,
    y: brScreen.y + offset.y + TILE_H / 2,
  };
}

/**
 * Compute the depth value for a preview placement.
 * Uses the same formula as production entities: 100 + worldY at center.
 */
export function previewPlacementDepth(
  tx: number,
  ty: number,
  footprint: PreviewFootprint,
): number {
  // Center of the footprint
  const centerTx = tx + (footprint - 1) / 2;
  const centerTy = ty + (footprint - 1) / 2;
  const screenPos = tileToScreen(centerTx, centerTy);
  return 100 + screenPos.y;
}

/**
 * Compute the scale factor to fit an image within a profile bounding box
 * at the given footprint size, preserving aspect ratio (contain-fit).
 */
export function computeContainScale(
  naturalWidth: number,
  naturalHeight: number,
  footprint: PreviewFootprint,
  userScale: number,
): number {
  // Profile bounding box: footprint tiles wide, footprint tiles tall
  // at the isometric scale. For buildings, this is roughly footprint * TILE_W
  // by footprint * TILE_H, but we use a square profile for simplicity
  // since the image should fit within the isometric footprint area.
  const profileSize = footprint * TILE_W;
  const scaleX = profileSize / naturalWidth;
  const scaleY = profileSize / naturalHeight;
  const containScale = Math.min(scaleX, scaleY);
  return containScale * userScale;
}

// ─── AssetPreviewTool class ─────────────────────────────────────────

/**
 * Phaser-side manager for dev asset preview.
 * Handles texture creation, sprite management, footprint overlays,
 * and click-to-place interaction.
 */
export class AssetPreviewTool {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Uploaded asset entries. */
  private assets: PreviewAssetEntry[] = [];

  /** Placed preview objects on the map. */
  private placements: PreviewPlacement[] = [];

  /** Phaser GameObjects for each placement (keyed by placement ID). */
  private placementObjects: Map<string, {
    sprite: Phaser.GameObjects.Image;
    overlay: Phaser.GameObjects.Graphics;
  }> = new Map();

  /** Currently selected placement ID. */
  private selectedPlacementId: string | null = null;

  /** Selection highlight graphics. */
  private selectionHighlight: Phaser.GameObjects.Graphics;

  /** Auto-increment counter for IDs. */
  private nextAssetId = 0;
  private nextPlacementId = 0;

  /** Whether the tool is active (panel open). */
  private _active = false;

  /** The asset ID that will be placed on next click-to-place. */
  private pendingPlaceAssetId: string | null = null;

  /** Callback to notify the panel of state changes. */
  private onStateChange: (() => void) | null = null;

  /** Whether a sprite pointer-down event was used to select a placement this frame. */
  private _spriteClickConsumed = false;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;

    this.selectionHighlight = scene.add.graphics();
    this.selectionHighlight.setDepth(200);
    this.selectionHighlight.setVisible(false);
  }

  /** Whether the tool is currently active (panel open). */
  get active(): boolean {
    return this._active;
  }

  /** Toggle the tool active state. */
  toggle(): void {
    this._active = !this._active;
    if (!this._active) {
      this.pendingPlaceAssetId = null;
      this.selectedPlacementId = null;
      this._spriteClickConsumed = false;
    }
    this.selectionHighlight.setVisible(this._active);
    if (!this._active) {
      this.selectionHighlight.clear();
    }
    this.onStateChange?.();
  }

  /** Set the state change callback. */
  setOnStateChange(cb: (() => void) | null): void {
    this.onStateChange = cb;
  }

  /** Get all uploaded assets. */
  getAssets(): readonly PreviewAssetEntry[] {
    return this.assets;
  }

  /** Get all placements. */
  getPlacements(): readonly PreviewPlacement[] {
    return this.placements;
  }

  /** Get the currently selected placement. */
  getSelectedPlacement(): PreviewPlacement | null {
    if (!this.selectedPlacementId) return null;
    return this.placements.find(p => p.id === this.selectedPlacementId) ?? null;
  }

  /** Get the pending place asset ID. */
  getPendingPlaceAssetId(): string | null {
    return this.pendingPlaceAssetId;
  }

  /** Whether a sprite click consumed the current pointer event. */
  get spriteClickConsumed(): boolean {
    return this._spriteClickConsumed;
  }

  /** Reset the sprite-click-consumed flag (call once per frame after checking). */
  resetSpriteClickConsumed(): void {
    this._spriteClickConsumed = false;
  }

  /** Set the pending place asset ID (the asset that will be placed on next map click). */
  setPendingPlaceAssetId(assetId: string | null): void {
    this.pendingPlaceAssetId = assetId;
    this.onStateChange?.();
  }

  /**
   * Upload a file and create a temporary Phaser texture.
   * Uses direct TextureManager canvas creation instead of Phaser Loader
   * for reliable runtime data-URL handling.
   *
   * DEV-ASSET-PREVIEW-03: Accepts optional ChromaKeyConfig (replaces boolean).
   * Stores sourceDataUrl on the entry for non-destructive reprocessing.
   * Returns the new PreviewAssetEntry, or null on failure.
   */
  async uploadFile(file: File, chromaKeyConfig: ChromaKeyConfig | null = null): Promise<PreviewAssetEntry | null> {
    const fileName = file.name || '(unknown)';
    const fileType = file.type || '(unknown)';

    try {
      // Validate MIME type
      if (!file.type.startsWith('image/')) {
        console.error(`[AssetPreviewTool] Upload failed: unsupported file type "${fileType}" for "${fileName}"`);
        return null;
      }

      // Read the file as a data URL
      const dataUrl = await readFileAsDataURL(file);

      // Load into HTMLImageElement to get dimensions and pixel data
      const img = await loadImageFromDataURL(dataUrl);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error(`[AssetPreviewTool] Upload failed: image decode produced zero dimensions for "${fileName}" (${fileType})`);
        return null;
      }
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      // Create offscreen canvas with the image content
      const canvas = document.createElement('canvas');
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error(`[AssetPreviewTool] Upload failed: could not create 2D canvas context for "${fileName}"`);
        return null;
      }
      ctx.drawImage(img, 0, 0);

      // Apply chroma-key if config provided
      if (chromaKeyConfig) {
        const imageData = ctx.getImageData(0, 0, naturalWidth, naturalHeight);
        applyChromaKey(imageData, chromaKeyConfig);
        ctx.putImageData(imageData, 0, 0);
      }

      // Generate unique texture key
      const assetId = `dev-preview-asset-${this.nextAssetId++}`;
      const textureKey = `__dev_preview_${assetId}`;

      // Remove existing texture if key collides
      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.remove(textureKey);
      }

      // Create the Phaser texture directly from the canvas via TextureManager
      const texture = this.scene.textures.addCanvas(textureKey, canvas);
      if (!texture) {
        console.error(`[AssetPreviewTool] Upload failed: TextureManager.addCanvas returned null for "${fileName}"`);
        return null;
      }

      const entry: PreviewAssetEntry = {
        id: assetId,
        fileName,
        textureKey,
        naturalWidth,
        naturalHeight,
        sourceDataUrl: dataUrl,
        chromaKeyConfig,
      };

      this.assets.push(entry);
      this.onStateChange?.();
      return entry;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AssetPreviewTool] Upload failed: "${fileName}" (${fileType}) — ${message}`);
      return null;
    }
  }

  /**
   * DEV-ASSET-PREVIEW-03: Reprocess a single asset with a new chroma-key config.
   *
   * Re-reads the original source data (sourceDataUrl) and applies the new
   * config, then replaces the Phaser texture. Existing placement sprites
   * are refreshed safely. Returns true on success, false on failure.
   *
   * If config is null, reprocesses without chroma-key (removes it).
   */
  async reprocessAsset(assetId: string, config: ChromaKeyConfig | null): Promise<boolean> {
    const asset = this.assets.find(a => a.id === assetId);
    if (!asset) {
      console.warn('[AssetPreviewTool] reprocessAsset: asset not found:', assetId);
      return false;
    }
    if (!asset.sourceDataUrl) {
      console.warn('[AssetPreviewTool] reprocessAsset: no source data URL for asset:', assetId);
      return false;
    }

    try {
      const img = await loadImageFromDataURL(asset.sourceDataUrl);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error(`[AssetPreviewTool] reprocessAsset: image decode failed for "${asset.fileName}"`);
        return false;
      }

      const canvas = document.createElement('canvas');
      canvas.width = asset.naturalWidth;
      canvas.height = asset.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error(`[AssetPreviewTool] reprocessAsset: canvas context failed for "${asset.fileName}"`);
        return false;
      }
      ctx.drawImage(img, 0, 0);

      if (config) {
        const imageData = ctx.getImageData(0, 0, asset.naturalWidth, asset.naturalHeight);
        applyChromaKey(imageData, config);
        ctx.putImageData(imageData, 0, 0);
      }

      // Replace the Phaser texture safely
      const textureKey = asset.textureKey;
      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.remove(textureKey);
      }
      const texture = this.scene.textures.addCanvas(textureKey, canvas);
      if (!texture) {
        console.error(`[AssetPreviewTool] reprocessAsset: addCanvas failed for "${asset.fileName}"`);
        return false;
      }

      // Update the asset's config
      asset.chromaKeyConfig = config;

      // Refresh all placements using this asset
      this.refreshPlacementsForAsset(assetId);

      this.onStateChange?.();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AssetPreviewTool] reprocessAsset failed for "${asset.fileName}": ${message}`);
      return false;
    }
  }

  /**
   * DEV-ASSET-PREVIEW-03: Reprocess all uploaded assets with the given config.
   * Returns the number of successfully reprocessed assets.
   */
  async reprocessAllAssets(config: ChromaKeyConfig | null): Promise<number> {
    let count = 0;
    for (const asset of this.assets) {
      if (asset.sourceDataUrl) {
        const ok = await this.reprocessAsset(asset.id, config);
        if (ok) count++;
      }
    }
    return count;
  }

  /**
   * DEV-ASSET-PREVIEW-03: Get the asset entry for a given asset ID.
   */
  getAssetById(assetId: string): PreviewAssetEntry | null {
    return this.assets.find(a => a.id === assetId) ?? null;
  }

  /**
   * DEV-ASSET-PREVIEW-03: Get the asset entry for a given placement ID.
   */
  getAssetForPlacement(placementId: string): PreviewAssetEntry | null {
    const placement = this.placements.find(p => p.id === placementId);
    if (!placement) return null;
    return this.assets.find(a => a.id === placement.assetId) ?? null;
  }

  /**
   * Place a preview asset on the map at the given tile position.
   *
   * DEV-ASSET-PREVIEW-03: chromaKey parameter is now boolean for backward
   * compat; the actual chroma-key config is inherited from the asset entry.
   */
  placeAsset(
    assetId: string,
    tx: number,
    ty: number,
    scale: number = 1,
    footprint: PreviewFootprint = 1,
    chromaKey: boolean = false,
  ): PreviewPlacement | null {
    const asset = this.assets.find(a => a.id === assetId);
    if (!asset) {
      console.warn('[AssetPreviewTool] Asset not found:', assetId);
      return null;
    }

    // DEV-ASSET-PREVIEW-03: Use the asset's chromaKeyConfig if chromaKey is enabled
    const chromaKeyConfig = chromaKey ? (asset.chromaKeyConfig ?? DEFAULT_CHROMA_KEY_CONFIG) : null;

    const placement: PreviewPlacement = {
      id: `dev-preview-place-${this.nextPlacementId++}`,
      assetId,
      tx,
      ty,
      scale,
      footprint,
      chromaKey,
      chromaKeyConfig,
    };

    this.placements.push(placement);
    this.createPlacementObjects(placement, asset);
    this.selectPlacement(placement.id);
    this.onStateChange?.();
    return placement;
  }

  /**
   * Move a placement to a new tile position.
   */
  movePlacement(placementId: string, tx: number, ty: number): void {
    const placement = this.placements.find(p => p.id === placementId);
    if (!placement) return;

    placement.tx = tx;
    placement.ty = ty;
    this.updatePlacementObjects(placement);
    this.onStateChange?.();
  }

  /**
   * Update the scale of a placement.
   */
  setPlacementScale(placementId: string, scale: number): void {
    const placement = this.placements.find(p => p.id === placementId);
    if (!placement) return;

    placement.scale = scale;
    this.updatePlacementObjects(placement);
    this.onStateChange?.();
  }

  /**
   * Update the footprint of a placement.
   */
  setPlacementFootprint(placementId: string, footprint: PreviewFootprint): void {
    const placement = this.placements.find(p => p.id === placementId);
    if (!placement) return;

    placement.footprint = footprint;
    this.updatePlacementObjects(placement);
    this.onStateChange?.();
  }

  /**
   * Toggle chroma-key for a placement. Re-uploads the texture with chroma-key applied.
   *
   * DEV-ASSET-PREVIEW-03: Now reprocesses the asset using the provided or
   * default config instead of just toggling a flag.
   */
  async setPlacementChromaKey(placementId: string, chromaKey: boolean, config?: ChromaKeyConfig | null): Promise<void> {
    const placement = this.placements.find(p => p.id === placementId);
    if (!placement) return;

    placement.chromaKey = chromaKey;

    const asset = this.assets.find(a => a.id === placement.assetId);
    if (asset && asset.sourceDataUrl) {
      // Reprocess the asset with the new config
      const reprocessConfig = chromaKey ? (config ?? asset.chromaKeyConfig ?? DEFAULT_CHROMA_KEY_CONFIG) : null;
      await this.reprocessAsset(asset.id, reprocessConfig);
      placement.chromaKeyConfig = asset.chromaKeyConfig;
    } else {
      placement.chromaKeyConfig = chromaKey ? (config ?? DEFAULT_CHROMA_KEY_CONFIG) : null;
    }

    this.updatePlacementObjects(placement);
    this.onStateChange?.();
  }

  /**
   * Select a placement by ID.
   */
  selectPlacement(placementId: string | null): void {
    this.selectedPlacementId = placementId;
    this.updateSelectionHighlight();
    this.onStateChange?.();
  }

  /**
   * Delete a placement by ID.
   */
  deletePlacement(placementId: string): void {
    const idx = this.placements.findIndex(p => p.id === placementId);
    if (idx === -1) return;

    this.placements.splice(idx, 1);
    this.removePlacementObjects(placementId);

    if (this.selectedPlacementId === placementId) {
      this.selectedPlacementId = null;
      this.updateSelectionHighlight();
    }

    this.onStateChange?.();
  }

  /**
   * Clear all placements (but keep uploaded assets).
   */
  clearPlacements(): void {
    for (const placement of this.placements) {
      this.removePlacementObjects(placement.id);
    }
    this.placements = [];
    this.selectedPlacementId = null;
    this.updateSelectionHighlight();
    this.onStateChange?.();
  }

  /**
   * Handle a map click for placement or move.
   *
   * If a pending asset is set and the tool is active → place the asset
   * at the clicked tile (using current scale/footprint).
   * Else if the tool is active and a placement is selected → move the
   * selected placement to the clicked tile.
   * Returns true if the click was consumed by this tool.
   */
  handleMapClick(worldX: number, worldY: number, currentScale?: number, currentFootprint?: PreviewFootprint): boolean {
    if (!this._active) return false;

    const tilePos = screenToTile(worldX - this.offset.x, worldY - this.offset.y);
    const tx = Math.floor(tilePos.x);
    const ty = Math.floor(tilePos.y);

    if (tx < 0 || ty < 0) return false;

    // Priority 1: pending asset → place new
    if (this.pendingPlaceAssetId) {
      this.placeAsset(
        this.pendingPlaceAssetId,
        tx,
        ty,
        currentScale ?? 1,
        currentFootprint ?? 1,
      );
      return true;
    }

    // Priority 2: selected placement → move it
    if (this.selectedPlacementId) {
      this.movePlacement(this.selectedPlacementId, tx, ty);
      return true;
    }

    return false;
  }

  /**
   * Update the selection highlight each frame.
   */
  update(): void {
    this.updateSelectionHighlight();
  }

  /**
   * Destroy all resources. Call on scene shutdown.
   */
  destroy(): void {
    this.clearPlacements();

    // Remove all temporary textures
    for (const asset of this.assets) {
      if (this.scene.textures.exists(asset.textureKey)) {
        this.scene.textures.remove(asset.textureKey);
      }
    }
    this.assets = [];

    this.selectionHighlight.destroy();
    this.onStateChange = null;
  }

  // ─── Internal: placement object management ────────────────────────

  private createPlacementObjects(placement: PreviewPlacement, asset: PreviewAssetEntry): void {
    const worldPos = previewPlacementWorldPos(placement.tx, placement.ty, placement.footprint, this.offset);
    const depth = previewPlacementDepth(placement.tx, placement.ty, placement.footprint);
    const containScale = computeContainScale(asset.naturalWidth, asset.naturalHeight, placement.footprint, placement.scale);

    // Create the preview sprite
    const sprite = this.scene.add.image(worldPos.x, worldPos.y, asset.textureKey);
    sprite.setOrigin(0.5, 1.0); // bottom-center origin (south-vertex anchoring)
    sprite.setScale(containScale);
    sprite.setDepth(depth);
    sprite.setAlpha(0.92); // slightly transparent to distinguish from production assets
    sprite.setTint(0xffffff); // no tint by default

    // DEV-ASSET-PREVIEW-01 fixup: Make preview sprites interactive in dev mode
    // so clicking a placed preview selects that placement.
    sprite.setInteractive({ useHandCursor: false });
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this._active) return;
      if (!pointer.leftButtonDown()) return;
      // Select this placement and consume the click so normal unit
      // selection/move does not also fire.
      this.selectPlacement(placement.id);
      // Clear pending asset so subsequent clicks move instead of re-place
      this.pendingPlaceAssetId = null;
      this._spriteClickConsumed = true;
    });

    // Create the footprint overlay
    const overlay = this.scene.add.graphics();
    overlay.setDepth(depth + 0.5);
    this.drawFootprintOverlay(overlay, placement);

    this.placementObjects.set(placement.id, { sprite, overlay });
  }

  private updatePlacementObjects(placement: PreviewPlacement): void {
    const objects = this.placementObjects.get(placement.id);
    if (!objects) return;

    const asset = this.assets.find(a => a.id === placement.assetId);
    if (!asset) return;

    const worldPos = previewPlacementWorldPos(placement.tx, placement.ty, placement.footprint, this.offset);
    const depth = previewPlacementDepth(placement.tx, placement.ty, placement.footprint);
    const containScale = computeContainScale(asset.naturalWidth, asset.naturalHeight, placement.footprint, placement.scale);

    objects.sprite.setPosition(worldPos.x, worldPos.y);
    objects.sprite.setScale(containScale);
    objects.sprite.setDepth(depth);

    objects.overlay.clear();
    objects.overlay.setDepth(depth + 0.5);
    this.drawFootprintOverlay(objects.overlay, placement);
  }

  private removePlacementObjects(placementId: string): void {
    const objects = this.placementObjects.get(placementId);
    if (!objects) return;

    objects.sprite.destroy();
    objects.overlay.destroy();
    this.placementObjects.delete(placementId);
  }

  /**
   * DEV-ASSET-PREVIEW-03: Refresh all placement GameObjects for a given asset.
   *
   * When the texture is replaced (reprocess), Phaser may not automatically
   * refresh existing sprites that reference the same texture key. This method
   * safely destroys and recreates the sprite/overlay for each placement using
   * the asset, preserving position, scale, footprint, and selection state.
   */
  private refreshPlacementsForAsset(assetId: string): void {
    const affectedPlacements = this.placements.filter(p => p.assetId === assetId);
    for (const placement of affectedPlacements) {
      const objects = this.placementObjects.get(placement.id);
      if (objects) {
        // Destroy old sprite/overlay
        objects.sprite.destroy();
        objects.overlay.destroy();
        this.placementObjects.delete(placement.id);
      }

      // Recreate with fresh texture reference
      const asset = this.assets.find(a => a.id === assetId);
      if (asset) {
        this.createPlacementObjects(placement, asset);
      }
    }
  }

  private drawFootprintOverlay(graphics: Phaser.GameObjects.Graphics, placement: PreviewPlacement): void {
    const { tx, ty, footprint } = placement;

    // Draw isometric footprint outline (magenta diamond for each tile)
    graphics.lineStyle(1, 0xff00ff, 0.6);

    for (let fy = 0; fy < footprint; fy++) {
      for (let fx = 0; fx < footprint; fx++) {
        const screenPos = tileToScreen(tx + fx, ty + fy);
        const cx = screenPos.x + this.offset.x;
        const cy = screenPos.y + this.offset.y;
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;

        graphics.beginPath();
        graphics.moveTo(cx, cy - hh);
        graphics.lineTo(cx + hw, cy);
        graphics.lineTo(cx, cy + hh);
        graphics.lineTo(cx - hw, cy);
        graphics.closePath();
        graphics.strokePath();
      }
    }

    // If selected, fill with semi-transparent magenta
    if (placement.id === this.selectedPlacementId) {
      graphics.fillStyle(0xff00ff, 0.1);
      for (let fy = 0; fy < footprint; fy++) {
        for (let fx = 0; fx < footprint; fx++) {
          const screenPos = tileToScreen(tx + fx, ty + fy);
          const cx = screenPos.x + this.offset.x;
          const cy = screenPos.y + this.offset.y;
          const hw = TILE_W / 2;
          const hh = TILE_H / 2;

          graphics.beginPath();
          graphics.moveTo(cx, cy - hh);
          graphics.lineTo(cx + hw, cy);
          graphics.lineTo(cx, cy + hh);
          graphics.lineTo(cx - hw, cy);
          graphics.closePath();
          graphics.fillPath();
        }
      }
    }
  }

  private updateSelectionHighlight(): void {
    this.selectionHighlight.clear();
    if (!this._active || !this.selectedPlacementId) return;

    const placement = this.placements.find(p => p.id === this.selectedPlacementId);
    if (!placement) return;

    // Draw a pulsing selection ring at the placement anchor
    const worldPos = previewPlacementWorldPos(placement.tx, placement.ty, placement.footprint, this.offset);
    const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 1000) / 1000 * Math.PI * 2);
    const alpha = 0.4 + 0.4 * pulse;

    this.selectionHighlight.lineStyle(2, 0xff00ff, alpha);
    this.selectionHighlight.strokeCircle(worldPos.x, worldPos.y - 10, 16);
  }
}

// ─── File/image utility functions ───────────────────────────────────

/** Read a File as a data URL string. */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`FileReader failed for "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

/** Load an Image element from a data URL. */
function loadImageFromDataURL(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed — unsupported format or corrupted data'));
    img.src = dataUrl;
  });
}
