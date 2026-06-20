/**
 * Minimap View Model — pure TypeScript transform and marker logic.
 *
 * VISUAL-MINIMAP-03: Derives minimap markers and viewport rectangle
 * from game state and camera, without any Phaser or DOM dependency.
 *
 * Architecture:
 *   tile coords → minimap coords (scaled 2D grid, no isometric)
 *   camera worldView → minimap viewport rectangle
 *   entities → colored markers
 *
 * The minimap is a top-down 2D grid view. Tile (0,0) is top-left.
 * This avoids isometric distortion on the minimap and is consistent
 * with how players expect a minimap to look in an RTS.
 */

import type { GameState, BuildingType } from '../../../state/types';
import { HUD_MINIMAP_WIDTH, HUD_MINIMAP_HEIGHT } from './hudLayout';

// ─── Types ──────────────────────────────────────────────────────────

/** A single marker on the minimap. */
export interface MinimapMarker {
  /** Tile X position. */
  tx: number;
  /** Tile Y position. */
  ty: number;
  /** Marker color (CSS color string). */
  color: string;
  /** Marker size in minimap pixels (diameter for circle, side for rect). */
  size: number;
  /** Marker shape. */
  shape: 'circle' | 'rect';
  /** Optional label for debugging. */
  label?: string;
}

/** Camera viewport rectangle on the minimap. */
export interface MinimapViewportRect {
  /** Minimap X of viewport top-left. */
  x: number;
  /** Minimap Y of viewport top-left. */
  y: number;
  /** Viewport width in minimap pixels. */
  width: number;
  /** Viewport height in minimap pixels. */
  height: number;
}

/** The full minimap view model. */
export interface MinimapViewModel {
  /** Map width in tiles. */
  mapWidth: number;
  /** Map height in tiles. */
  mapHeight: number;
  /** Entity markers. */
  markers: MinimapMarker[];
  /** Camera viewport rectangle (null if camera not available). */
  viewport: MinimapViewportRect | null;
}

// ─── Color constants ────────────────────────────────────────────────

/** Marker colors by entity type. */
const COLORS = {
  /** Player HQ. */
  hq: '#4ade80',
  /** Player buildings (generic). */
  building: '#60a5fa',
  /** Player construction sites. */
  construction: '#facc15',
  /** Builder unit. */
  builder: '#a78bfa',
  /** Harvester unit. */
  harvester: '#34d399',
  /** Resource node. */
  resource: '#f97316',
  /** Resource node (depleted). */
  resourceDepleted: '#404040',
  /** Camera viewport rectangle. */
  viewportStroke: '#d4a574',
  viewportFill: 'rgba(212, 165, 116, 0.08)',
} as const;

// ─── Transform helpers ──────────────────────────────────────────────

/**
 * Transform a tile coordinate to minimap pixel coordinate.
 *
 * The minimap is a top-down 2D view where (0,0) maps to the top-left
 * corner and (mapW-1, mapH-1) maps to the bottom-right. Padding of 4px
 * on each side ensures markers at the edges are not clipped.
 *
 * @param tx - Tile X (can be fractional)
 * @param ty - Tile Y (can be fractional)
 * @param mapWidth - Map width in tiles
 * @param mapHeight - Map height in tiles
 * @returns Minimap pixel coordinates { x, y }
 */
export function tileToMinimap(
  tx: number,
  ty: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } {
  const padding = 4;
  const drawW = HUD_MINIMAP_WIDTH - padding * 2;
  const drawH = HUD_MINIMAP_HEIGHT - padding * 2;

  if (mapWidth <= 0 || mapHeight <= 0) {
    return { x: padding, y: padding };
  }

  return {
    x: padding + (tx / mapWidth) * drawW,
    y: padding + (ty / mapHeight) * drawH,
  };
}

/**
 * Transform a camera world-view rectangle to minimap viewport rectangle.
 *
 * The camera world-view is in screen pixel coordinates. We convert it
 * to tile coordinates first, then to minimap coordinates.
 *
 * @param worldView - Camera world view { x, y, width, height }
 * @param offset - Map origin offset { x, y }
 * @param mapWidth - Map width in tiles
 * @param mapHeight - Map height in tiles
 * @param zoom - Camera zoom level
 * @returns Minimap viewport rectangle, or null if invalid
 */
export function cameraWorldViewToMinimapViewport(
  worldView: { x: number; y: number; width: number; height: number },
  offset: { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
  _zoom: number,
): MinimapViewportRect | null {
  if (!worldView || worldView.width <= 0 || worldView.height <= 0) {
    return null;
  }

  // We need screenToTile to convert camera corners back to tile coords.
  // Import the function to avoid circular deps — use the same formula.
  const halfW = 38; // TILE_W / 2
  const halfH = 19; // TILE_H / 2

  // Camera corners in screen space (subtract offset to get raw screen)
  const sx1 = worldView.x - offset.x;
  const sy1 = worldView.y - offset.y;
  const sx2 = worldView.x + worldView.width - offset.x;
  const sy2 = worldView.y + worldView.height - offset.y;

  // Convert to tile coordinates
  const tx1 = Math.max(0, (sx1 / halfW + sy1 / halfH) / 2);
  const ty1 = Math.max(0, (sy1 / halfH - sx1 / halfW) / 2);
  const tx2 = Math.min(mapWidth, (sx2 / halfW + sy2 / halfH) / 2);
  const ty2 = Math.min(mapHeight, (sy2 / halfH - sx2 / halfW) / 2);

  // Convert tile corners to minimap coordinates
  const topLeft = tileToMinimap(tx1, ty1, mapWidth, mapHeight);
  const bottomRight = tileToMinimap(tx2, ty2, mapWidth, mapHeight);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(2, bottomRight.x - topLeft.x),
    height: Math.max(2, bottomRight.y - topLeft.y),
  };
}

// ─── Marker builders ────────────────────────────────────────────────

/** Building type color mapping. */
function buildingColor(type: BuildingType): string {
  switch (type) {
    case 'units-factory': return '#818cf8';
    case 'power-plant': return '#fbbf24';
    case 'separator': return '#f97316';
    default: return COLORS.building;
  }
}

/**
 * Build minimap markers from game state.
 *
 * This is a pure function — no side effects, no Phaser/DOM dependency.
 */
export function buildMinimapMarkers(state: GameState): MinimapMarker[] {
  const markers: MinimapMarker[] = [];

  // HQ marker
  const hq = state.mapData.hq;
  if (hq) {
    markers.push({
      tx: hq.tx + 1, ty: hq.ty + 1, // center of 3×3
      color: COLORS.hq,
      size: 5,
      shape: 'rect',
      label: 'HQ',
    });
  }

  // Buildings
  for (const b of state.mapData.buildings) {
    markers.push({
      tx: b.tx + 1, ty: b.ty + 1, // center of 2×2
      color: buildingColor(b.type),
      size: 4,
      shape: 'rect',
    });
  }

  // Construction sites
  for (const cs of state.mapData.constructionSites) {
    markers.push({
      tx: cs.tx + 1, ty: cs.ty + 1,
      color: COLORS.construction,
      size: 3,
      shape: 'rect',
    });
  }

  // Builders
  for (const b of state.mapData.builders) {
    markers.push({
      tx: b.ftx, ty: b.fty,
      color: COLORS.builder,
      size: 3,
      shape: 'circle',
    });
  }

  // Harvesters
  for (const h of state.harvesters) {
    markers.push({
      tx: h.ftx, ty: h.fty,
      color: COLORS.harvester,
      size: 3,
      shape: 'circle',
    });
  }

  // Resources (if resourceNodes are available)
  if (state.resourceNodes) {
    for (const r of state.resourceNodes) {
      if (r.depleted) continue; // skip depleted
      markers.push({
        tx: r.tx, ty: r.ty,
        color: COLORS.resource,
        size: 2,
        shape: 'circle',
      });
    }
  }

  return markers;
}

/**
 * Build the complete minimap view model.
 *
 * Pure function — no side effects.
 */
export function buildMinimapViewModel(
  state: GameState,
  cameraWorldView: { x: number; y: number; width: number; height: number } | null,
  cameraZoom: number,
  offset: { x: number; y: number },
): MinimapViewModel {
  const markers = buildMinimapMarkers(state);
  let viewport: MinimapViewportRect | null = null;

  if (cameraWorldView) {
    viewport = cameraWorldViewToMinimapViewport(
      cameraWorldView,
      offset,
      state.mapWidth,
      state.mapHeight,
      cameraZoom,
    );
  }

  return {
    mapWidth: state.mapWidth,
    mapHeight: state.mapHeight,
    markers,
    viewport,
  };
}
