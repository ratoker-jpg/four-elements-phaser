/**
 * FogRenderer — renders fog of war overlay on the main game scene.
 *
 * FOG-VISION-IMPLEMENTATION-08: Renders a per-tile fog overlay between
 * terrain and entities in the depth sort order.
 *
 * Rendering policy:
 * - Unexplored tiles: Fully opaque dark overlay (black)
 * - Explored tiles: Semi-transparent dark overlay (dimmed)
 * - Visible tiles: No overlay (normal rendering)
 * - Own units/builders/harvesters: Always visible regardless of fog
 * - Own buildings: Always visible (player knows their buildings)
 * - Resources: Visible in explored+visible tiles; dimmed in explored-but-not-visible
 *
 * Implementation:
 * - Uses Phaser Graphics to draw isometric diamond shapes per tile
 * - Respects camera projection contract (isometric ground plane)
 * - Draws fog between terrain and entities in depth sort
 * - Performance: only draws fog for tiles in the camera viewport
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import { tileToScreen, screenToTile } from './isometric';
import type { GameState } from '../../state/types';
import { getTileVisibility, type VisionState } from '../../state/visibility';

// ─── Fog colors ───────────────────────────────────────────────────

/** Color for unexplored tiles (fully opaque dark). */
const UNEXPLORED_COLOR = 0x080c14;

/** Alpha for unexplored tiles. */
const UNEXPLORED_ALPHA = 0.92;

/** Color for explored-but-not-visible tiles (dimmed). */
const EXPLORED_COLOR = 0x0a1020;

/** Alpha for explored tiles. */
const EXPLORED_ALPHA = 0.55;

/** Alpha for explored-but-not-visible resource sprites. */
export const EXPLORED_RESOURCE_ALPHA = 0.5;

// ─── Isometric tile half-dimensions ────────────────────────────────

/** Half-width of an isometric tile in screen space. */
const HALF_W = 76 / 2;

/** Half-height of an isometric tile in screen space. */
const HALF_H = 38 / 2;

// ─── Viewport tile bounds helper (pure, testable) ──────────────────

/** Result of viewport tile bounds computation. */
export interface ViewportTileBounds {
  minTx: number;
  minTy: number;
  maxTx: number;
  maxTy: number;
}

/**
 * Compute tile coordinate bounds from 4 camera worldView corners.
 * FIXUP-2: In isometric projection, the diamond-shaped viewport can extend
 * tile bounds in both tx and ty beyond what topLeft/bottomRight alone predict.
 * All 4 corners must be checked to avoid missing tiles at viewport edges.
 *
 * Pure function — no Phaser dependency beyond the coordinate types.
 * Exported for testing.
 */
export function computeViewportTileBounds(
  worldViewX: number,
  worldViewY: number,
  worldViewW: number,
  worldViewH: number,
  offsetX: number,
  offsetY: number,
  mapWidth: number,
  mapHeight: number,
  margin: number = 4,
): ViewportTileBounds {
  const corners = [
    screenToTile(worldViewX - offsetX, worldViewY - offsetY),                         // top-left
    screenToTile(worldViewX + worldViewW - offsetX, worldViewY - offsetY),             // top-right
    screenToTile(worldViewX - offsetX, worldViewY + worldViewH - offsetY),             // bottom-left
    screenToTile(worldViewX + worldViewW - offsetX, worldViewY + worldViewH - offsetY), // bottom-right
  ];

  let minTx = Infinity, minTy = Infinity, maxTx = -Infinity, maxTy = -Infinity;
  for (const c of corners) {
    if (c.x < minTx) minTx = c.x;
    if (c.y < minTy) minTy = c.y;
    if (c.x > maxTx) maxTx = c.x;
    if (c.y > maxTy) maxTy = c.y;
  }

  return {
    minTx: Math.max(0, Math.floor(minTx) - margin),
    minTy: Math.max(0, Math.floor(minTy) - margin),
    maxTx: Math.min(mapWidth - 1, Math.ceil(maxTx) + margin),
    maxTy: Math.min(mapHeight - 1, Math.ceil(maxTy) + margin),
  };
}

/**
 * FogRenderer — renders fog of war overlay using Phaser Graphics.
 *
 * Draws isometric diamond shapes for each tile based on visibility state.
 * Only renders tiles within the camera viewport for performance.
 */
export class FogRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;
  private graphics: Phaser.GameObjects.Graphics;

  /** Cached redraw key to avoid redundant redraws.
   *  Composed of {vision.revision, camera.scrollX, scrollY, zoom, viewportW, viewportH}.
   *  FIXUP-1: Replaces the old sampled computeVisionHash which could miss
   *  viewport changes and visibility shape changes with same sampled count. */
  private lastRedrawKey: string = '';

  /** Whether fog rendering is enabled (can be toggled for debug). */
  private _enabled: boolean = true;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
    this.graphics = scene.add.graphics();
    // Fog depth: between terrain (depth ~50) and entities (depth ~100+)
    // Use a depth value that sits between terrain and buildings/units
    this.graphics.setDepth(85);
  }

  /** Whether fog rendering is enabled. */
  get enabled(): boolean {
    return this._enabled;
  }

  /** Enable or disable fog rendering. */
  set enabled(value: boolean) {
    this._enabled = value;
    if (!value) {
      this.graphics.clear();
      this.lastRedrawKey = ''; // Reset so re-enable triggers redraw
    }
  }

  /**
   * Sync fog overlay from current game state.
   * Called each frame from RenderManager.syncCivilRenderState().
   */
  syncFromState(state: GameState): void {
    if (!this._enabled) {
      this.graphics.clear();
      return;
    }

    const vision = state.vision;
    if (!vision) {
      this.graphics.clear();
      return;
    }

    // FIXUP-1: Redraw when vision revision or camera viewport changes.
    // Uses vision.revision (monotonic counter) instead of sampled hash —
    // eliminates false negatives where shape changes produce same sampled count.
    // Camera key ensures viewport/zoom changes trigger redraw.
    const cam = this.scene.cameras.main;
    const redrawKey = `${vision.revision}|${cam.scrollX}|${cam.scrollY}|${cam.zoom}|${cam.worldView.width}|${cam.worldView.height}`;
    if (redrawKey === this.lastRedrawKey) return;
    this.lastRedrawKey = redrawKey;

    this.renderFog(state, vision);
  }

  /**
   * Render fog overlay for all tiles in the camera viewport.
   * FIXUP-2: Uses computeViewportTileBounds() from all 4 camera corners.
   */
  private renderFog(state: GameState, vision: VisionState): void {
    this.graphics.clear();

    const cam = this.scene.cameras.main;
    const wv = cam.worldView;
    const bounds = computeViewportTileBounds(
      wv.x, wv.y, wv.width, wv.height,
      this.offset.x, this.offset.y,
      state.mapWidth, state.mapHeight,
    );

    // Batch unexplored and explored tiles separately for fewer fillStyle calls
    // First pass: unexplored tiles
    this.graphics.fillStyle(UNEXPLORED_COLOR, UNEXPLORED_ALPHA);
    for (let ty = bounds.minTy; ty <= bounds.maxTy; ty++) {
      for (let tx = bounds.minTx; tx <= bounds.maxTx; tx++) {
        if (getTileVisibility(vision, tx, ty) === 'unexplored') {
          this.drawTileDiamond(tx, ty);
        }
      }
    }

    // Second pass: explored tiles
    this.graphics.fillStyle(EXPLORED_COLOR, EXPLORED_ALPHA);
    for (let ty = bounds.minTy; ty <= bounds.maxTy; ty++) {
      for (let tx = bounds.minTx; tx <= bounds.maxTx; tx++) {
        if (getTileVisibility(vision, tx, ty) === 'explored') {
          this.drawTileDiamond(tx, ty);
        }
      }
    }
  }

  /**
   * Draw an isometric diamond shape for a single tile.
   * The diamond matches the isometric tile grid projection.
   */
  private drawTileDiamond(tx: number, ty: number): void {
    const screenPos = tileToScreen(tx, ty);
    const cx = screenPos.x + this.offset.x;
    const cy = screenPos.y + this.offset.y;

    this.graphics.fillPoint(cx, cy - HALF_H);
    // fillPoint is too slow for many tiles — use fillTriangle on the diamond halves
    // Actually, Phaser Graphics doesn't have fillDiamond.
    // Use fillTriangle to draw two triangles forming a diamond.
    this.graphics.fillTriangle(
      cx, cy - HALF_H,         // top
      cx + HALF_W, cy,         // right
      cx, cy + HALF_H,         // bottom
    );
    this.graphics.fillTriangle(
      cx, cy - HALF_H,         // top
      cx - HALF_W, cy,         // left
      cx, cy + HALF_H,         // bottom
    );
  }

  /**
   * FIXUP-1: Removed computeVisionHash(). Replaced by revision+camera key
   * in syncFromState(). The old sampled hash could miss visibility shape
   * changes with same sampled count and did not account for camera changes.
   */

  /** Get the Phaser Graphics object (for debug overlays). */
  getGraphics(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  /** Set visibility of the fog overlay. */
  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
