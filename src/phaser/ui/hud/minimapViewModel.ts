/**
 * Minimap View Model — pure TypeScript transform and marker logic.
 *
 * VISUAL-MINIMAP-03: Derives minimap markers and viewport rectangle
 * from game state and camera, without any Phaser or DOM dependency.
 *
 * MINIMAP-INTERACTION-04: Adds minimapToTile inverse transform,
 * selectedEntityId on markers, and selection-aware marker building.
 *
 * Architecture:
 *   tile coords ↔ minimap coords (scaled 2D grid, no isometric)
 *   camera worldView → minimap viewport rectangle
 *   entities → colored markers
 *
 * The minimap is a top-down 2D grid view. Tile (0,0) is top-left.
 * This avoids isometric distortion on the minimap and is consistent
 * with how players expect a minimap to look in an RTS.
 */

import type { GameState, BuildingType } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { HUD_MINIMAP_WIDTH, HUD_MINIMAP_HEIGHT } from './hudLayout';
import { screenToTile } from '../../render/isometric';

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
  /** MINIMAP-INTERACTION-04: Entity ID for selection matching. */
  entityId?: string;
  /** MINIMAP-INTERACTION-04: Set when this marker's entity is selected. */
  selectedEntityId?: string;
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
  /** MINIMAP-INTERACTION-04: Currently selected entity ID. */
  selectedEntityId: string | null;
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

/** Internal padding constant used by both tileToMinimap and minimapToTile. */
const MINIMAP_PADDING = 4;

/**
 * Transform a tile coordinate to minimap pixel coordinate.
 *
 * The minimap is a top-down 2D view where (0,0) maps to the top-left
 * corner and (mapW-1, mapH-1) maps to the bottom-right. Padding of 4px
 * on each side ensures markers at the edges are not clipped.
 */
export function tileToMinimap(
  tx: number,
  ty: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } {
  const drawW = HUD_MINIMAP_WIDTH - MINIMAP_PADDING * 2;
  const drawH = HUD_MINIMAP_HEIGHT - MINIMAP_PADDING * 2;

  if (mapWidth <= 0 || mapHeight <= 0) {
    return { x: MINIMAP_PADDING, y: MINIMAP_PADDING };
  }

  return {
    x: MINIMAP_PADDING + (tx / mapWidth) * drawW,
    y: MINIMAP_PADDING + (ty / mapHeight) * drawH,
  };
}

/**
 * MINIMAP-INTERACTION-04: Transform minimap pixel coordinates to tile coordinates.
 *
 * This is the inverse of tileToMinimap. It converts a click/drag position
 * on the minimap canvas back to tile coordinates.
 *
 * @param mx - Minimap pixel X
 * @param my - Minimap pixel Y
 * @param mapWidth - Map width in tiles
 * @param mapHeight - Map height in tiles
 * @returns Tile coordinates { tx, ty } (may be outside map bounds)
 */
export function minimapToTile(
  mx: number,
  my: number,
  mapWidth: number,
  mapHeight: number,
): { tx: number; ty: number } {
  const drawW = HUD_MINIMAP_WIDTH - MINIMAP_PADDING * 2;
  const drawH = HUD_MINIMAP_HEIGHT - MINIMAP_PADDING * 2;

  if (mapWidth <= 0 || mapHeight <= 0 || drawW <= 0 || drawH <= 0) {
    return { tx: 0, ty: 0 };
  }

  return {
    tx: ((mx - MINIMAP_PADDING) / drawW) * mapWidth,
    ty: ((my - MINIMAP_PADDING) / drawH) * mapHeight,
  };
}

/**
 * MINIMAP-INTERACTION-04: Transform minimap pixel coordinates to tile coordinates,
 * clamped to [0, mapWidth] and [0, mapHeight].
 */
export function minimapToTileClamped(
  mx: number,
  my: number,
  mapWidth: number,
  mapHeight: number,
): { tx: number; ty: number } {
  const raw = minimapToTile(mx, my, mapWidth, mapHeight);
  return {
    tx: Math.max(0, Math.min(mapWidth, raw.tx)),
    ty: Math.max(0, Math.min(mapHeight, raw.ty)),
  };
}

/**
 * Transform a camera world-view rectangle to minimap viewport rectangle.
 *
 * VISUAL-MINIMAP-03-FIXUP-1: Converts ALL FOUR corners of the camera
 * worldView from screen-space to tile-space, then computes the axis-
 * aligned bounding box in tile coordinates. This is necessary because
 * the isometric projection means an axis-aligned screen rectangle does
 * NOT map to a tile-space rectangle — only two diagonal corners would
 * miss the full extent.
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

  const corners: Array<{ sx: number; sy: number }> = [
    { sx: worldView.x - offset.x,                        sy: worldView.y - offset.y },
    { sx: worldView.x + worldView.width - offset.x,      sy: worldView.y - offset.y },
    { sx: worldView.x - offset.x,                        sy: worldView.y + worldView.height - offset.y },
    { sx: worldView.x + worldView.width - offset.x,      sy: worldView.y + worldView.height - offset.y },
  ];

  let minTx = Infinity, maxTx = -Infinity;
  let minTy = Infinity, maxTy = -Infinity;
  for (const { sx, sy } of corners) {
    const tile = screenToTile(sx, sy);
    minTx = Math.min(minTx, tile.x);
    maxTx = Math.max(maxTx, tile.x);
    minTy = Math.min(minTy, tile.y);
    maxTy = Math.max(maxTy, tile.y);
  }

  minTx = Math.max(0, minTx);
  minTy = Math.max(0, minTy);
  maxTx = Math.min(mapWidth, maxTx);
  maxTy = Math.min(mapHeight, maxTy);

  const topLeft = tileToMinimap(minTx, minTy, mapWidth, mapHeight);
  const bottomRight = tileToMinimap(maxTx, maxTy, mapWidth, mapHeight);

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
 * MINIMAP-INTERACTION-04: Each builder/harvester marker includes an
 * `entityId` field so selection can be matched to markers.
 */
export function buildMinimapMarkers(state: GameState): MinimapMarker[] {
  const markers: MinimapMarker[] = [];

  const hq = state.mapData.hq;
  if (hq) {
    markers.push({
      tx: hq.tx + 1, ty: hq.ty + 1,
      color: COLORS.hq,
      size: 5,
      shape: 'rect',
      label: 'HQ',
    });
  }

  for (const b of state.mapData.buildings) {
    markers.push({
      tx: b.tx + 1, ty: b.ty + 1,
      color: buildingColor(b.type),
      size: 4,
      shape: 'rect',
    });
  }

  for (const cs of state.mapData.constructionSites) {
    markers.push({
      tx: cs.tx + 1, ty: cs.ty + 1,
      color: COLORS.construction,
      size: 3,
      shape: 'rect',
    });
  }

  for (const b of state.mapData.builders) {
    markers.push({
      tx: b.ftx, ty: b.fty,
      color: COLORS.builder,
      size: 3,
      shape: 'circle',
      entityId: b.id,
    });
  }

  for (const h of state.harvesters) {
    markers.push({
      tx: h.ftx, ty: h.fty,
      color: COLORS.harvester,
      size: 3,
      shape: 'circle',
      entityId: h.id,
    });
  }

  if (state.resourceNodes) {
    for (const r of state.resourceNodes) {
      if (r.depleted) continue;
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
 * MINIMAP-INTERACTION-04: Accepts optional `selection` parameter.
 * When a builder or harvester is selected, sets the matching marker's
 * `selectedEntityId` and increases its size for highlighting.
 */
export function buildMinimapViewModel(
  state: GameState,
  cameraWorldView: { x: number; y: number; width: number; height: number } | null,
  cameraZoom: number,
  offset: { x: number; y: number },
  selection?: UnitSelection,
): MinimapViewModel {
  const markers = buildMinimapMarkers(state);
  let viewport: MinimapViewportRect | null = null;

  let selectedEntityId: string | null = null;
  if (selection) {
    selectedEntityId = selection.id;
    for (const marker of markers) {
      if (marker.entityId === selection.id) {
        marker.selectedEntityId = selection.id;
        marker.size += 2;
      }
    }
  }

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
    selectedEntityId,
  };
}
