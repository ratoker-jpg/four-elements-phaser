/**
 * Minimap View Model — pure TypeScript transform and marker logic.
 *
 * SELECTION-CONTROL-GROUPS-05: Changed selectedEntityId (single) to
 * selectedEntityIds (array) to support multi-select highlighting.
 * ALL markers whose entityId is in selectedEntityIds get highlighted.
 */

import type { GameState, BuildingType } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { getSelectedIds } from '../../../state/unitSelection';
import { HUD_MINIMAP_WIDTH, HUD_MINIMAP_HEIGHT } from './hudLayout';
import { screenToTile } from '../../render/isometric';

// ─── Types ──────────────────────────────────────────────────────────

export interface MinimapMarker {
  tx: number;
  ty: number;
  color: string;
  size: number;
  shape: 'circle' | 'rect';
  label?: string;
  entityId?: string;
  /** Set when this marker's entity is selected. */
  selectedEntityId?: string;
}

export interface MinimapViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** FEEDBACK-ALERTS-06: Minimap ping for feedback events with tile targets. */
export interface MinimapPing {
  tx: number;
  ty: number;
  color: string;
  birthTime: number; // timestamp (Date.now())
  lifetime: number;  // ms, default 2000
}

export interface MinimapViewModel {
  mapWidth: number;
  mapHeight: number;
  markers: MinimapMarker[];
  viewport: MinimapViewportRect | null;
  /** SELECTION-CONTROL-GROUPS-05: All selected entity IDs. */
  selectedEntityIds: string[];
  /** FEEDBACK-ALERTS-06: Active minimap pings. */
  pings: MinimapPing[];
}

// ─── Color constants ────────────────────────────────────────────────

const COLORS = {
  hq: '#4ade80',
  building: '#60a5fa',
  construction: '#facc15',
  builder: '#a78bfa',
  harvester: '#34d399',
  resource: '#f97316',
  resourceDepleted: '#404040',
  viewportStroke: '#d4a574',
  viewportFill: 'rgba(212, 165, 116, 0.08)',
} as const;

// ─── Transform helpers ──────────────────────────────────────────────

const MINIMAP_PADDING = 4;

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

function buildingColor(type: BuildingType): string {
  switch (type) {
    case 'units-factory': return '#818cf8';
    case 'power-plant': return '#fbbf24';
    case 'separator': return '#f97316';
    default: return COLORS.building;
  }
}

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
 * SELECTION-CONTROL-GROUPS-05: Uses selectedEntityIds array.
 * ALL markers whose entityId is in the array get highlighted.
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

  const selectedEntityIds: string[] = selection ? getSelectedIds(selection) : [];

  if (selectedEntityIds.length > 0) {
    const idSet = new Set(selectedEntityIds);
    for (const marker of markers) {
      if (marker.entityId && idSet.has(marker.entityId)) {
        marker.selectedEntityId = marker.entityId;
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
    selectedEntityIds,
    pings: [],  // FEEDBACK-ALERTS-06: Pings are injected by the caller
  };
}
