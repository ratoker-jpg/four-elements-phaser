/**
 * Fog of War / Vision System — pure TypeScript state and algorithms.
 *
 * FOG-VISION-IMPLEMENTATION-08: Three-state tile visibility model
 * (unexplored / explored / visible) with player-only vision for MVP.
 *
 * Design rules:
 * - All helpers are pure functions with no side effects
 * - Grid indexing is [y][x] (same as MapData.terrain)
 * - Out-of-bounds queries are safe (return unexplored / false)
 * - Explored grid persists across frames and in saves
 * - Visible grid is fully recomputed each update cycle
 * - Diamond radius using Manhattan distance (|dx| + |dy| <= radius)
 */

import type { BuildingType, GameState } from './types';
import { BUILDING_TYPE_TO_PRODUCTION_ID } from '../config/buildingRuntimeMapping';
import { BUILDING_CONFIGS } from '../config/buildingData';
import type { AcceptedBuildingId } from '../config/coreMechanicsTypes';

// ─── Types ────────────────────────────────────────────────────────

/** Per-tile visibility state for a single player/faction. */
export type TileVisibility = 'unexplored' | 'explored' | 'visible';

/** Vision system state — stored on GameState. */
export interface VisionState {
  /** Explored grid: true if tile has ever been seen. Persists across frames and in saves. [y][x] */
  explored: boolean[][];
  /** Visible grid: true if tile is currently in vision. Recomputed each update. NOT saved. [y][x] */
  visible: boolean[][];
  /** Dirty flag: set when vision sources change (unit moved, building completed). */
  dirty: boolean;
  /** Monotonic revision counter, incremented each time recomputeVisibility() writes new data.
   *  Used by FogRenderer to detect vision content changes without sampled hashing. */
  revision: number;
}

/** A single vision source at a tile position. */
export interface VisionSource {
  tx: number;
  ty: number;
  radius: number;
  /** Optional source id/type for debug/tests. */
  sourceId?: string;
  sourceType?: 'hq' | 'building' | 'builder' | 'harvester';
}

// ─── Vision radius config ─────────────────────────────────────────

/** Vision radius for builder units. */
export const BUILDER_VISION_RADIUS = 4;

/** Vision radius for harvester units. */
export const HARVESTER_VISION_RADIUS = 5;

/** HQ vision radius (matches BuildingConfig.visionRadius: 8). */
export const HQ_VISION_RADIUS = 8;

/** Purple faction flat vision radius bonus (MVP). */
export const PURPLE_FACTION_VISION_BONUS = 1;

// ─── Grid helpers ─────────────────────────────────────────────────

/** Create a 2D boolean grid initialized to a constant value. [y][x] */
export function createVisionGrid(width: number, height: number, value: boolean): boolean[][] {
  return Array.from({ length: height }, () => Array(width).fill(value));
}

/** Create initial VisionState with all tiles unexplored and not visible. */
export function createInitialVisionState(width: number, height: number): VisionState {
  return {
    explored: createVisionGrid(width, height, false),
    visible: createVisionGrid(width, height, false),
    dirty: true,
    revision: 0,
  };
}

/** Get the TileVisibility of a tile. Out-of-bounds returns 'unexplored'. */
export function getTileVisibility(vision: VisionState, tx: number, ty: number): TileVisibility {
  if (tx < 0 || ty < 0 || ty >= vision.visible.length || tx >= vision.visible[0].length) {
    return 'unexplored';
  }
  if (vision.visible[ty][tx]) return 'visible';
  if (vision.explored[ty][tx]) return 'explored';
  return 'unexplored';
}

/** Check if a tile is currently visible. Out-of-bounds returns false. */
export function isTileVisible(vision: VisionState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || ty >= vision.visible.length || tx >= vision.visible[0].length) {
    return false;
  }
  return vision.visible[ty][tx];
}

/** Check if a tile has been explored. Out-of-bounds returns false. */
export function isTileExplored(vision: VisionState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || ty >= vision.explored.length || tx >= vision.explored[0].length) {
    return false;
  }
  return vision.explored[ty][tx];
}

// ─── Building radius lookup ───────────────────────────────────────

/**
 * Get the vision radius for a runtime BuildingType.
 * Uses the canonical BUILDING_TYPE_TO_PRODUCTION_ID mapping to look up
 * the radius from the production config.
 *
 * Returns 0 if the building type has no mapping or no visionRadius.
 * Special case: matter-storage → energy_storage (legacy naming).
 */
export function getVisionRadiusForRuntimeBuildingType(buildingType: BuildingType): number {
  const prodId = BUILDING_TYPE_TO_PRODUCTION_ID[buildingType];
  if (prodId) {
    const config = BUILDING_CONFIGS[prodId as AcceptedBuildingId];
    if (config?.visionRadius !== undefined) {
      return config.visionRadius;
    }
  }
  return 0; // Unknown or visual-only buildings get no vision
}

// ─── Vision source collection ─────────────────────────────────────

/**
 * Collect all vision sources from the current game state.
 * Sources are computed (not stored) from buildings and units.
 *
 * Vision source rules:
 * - HQ provides vision radius (8 by default)
 * - Completed buildings provide vision per their config radius
 * - Construction sites are NOT vision sources
 * - Builders provide BUILDER_VISION_RADIUS (4)
 * - Harvesters provide HARVESTER_VISION_RADIUS (5)
 * - Purple faction buildings get flat +1 radius (PURPLE_FACTION_VISION_BONUS)
 */
export function collectVisionSources(state: GameState): VisionSource[] {
  const sources: VisionSource[] = [];

  // HQ is always a vision source
  const hq = state.mapData.hq;
  if (hq) {
    const hqRadius = HQ_VISION_RADIUS;
    const bonus = hq.faction === 'purple' ? PURPLE_FACTION_VISION_BONUS : 0;
    sources.push({
      tx: hq.tx + 1, // HQ center (3×3 footprint, center is +1,+1)
      ty: hq.ty + 1,
      radius: hqRadius + bonus,
      sourceId: 'hq',
      sourceType: 'hq',
    });
  }

  // Completed buildings
  const playerFaction = state.playerFaction;
  for (const building of state.mapData.buildings) {
    const radius = getVisionRadiusForRuntimeBuildingType(building.type);
    if (radius > 0) {
      const bonus = playerFaction === 'purple' ? PURPLE_FACTION_VISION_BONUS : 0;
      sources.push({
        tx: building.tx + 1, // Building center (2×2 footprint, center is +1,+1)
        ty: building.ty + 1,
        radius: radius + bonus,
        sourceId: `building-${building.tx}-${building.ty}`,
        sourceType: 'building',
      });
    }
  }

  // Construction sites are NOT vision sources

  // Builders
  for (const builder of state.mapData.builders) {
    sources.push({
      tx: Math.round(builder.ftx),
      ty: Math.round(builder.fty),
      radius: BUILDER_VISION_RADIUS,
      sourceId: builder.id,
      sourceType: 'builder',
    });
  }

  // Harvesters
  for (const harvester of state.harvesters) {
    sources.push({
      tx: Math.round(harvester.ftx),
      ty: Math.round(harvester.fty),
      radius: HARVESTER_VISION_RADIUS,
      sourceId: harvester.id,
      sourceType: 'harvester',
    });
  }

  return sources;
}

// ─── Save/load normalization ─────────────────────────────────────

/**
 * Normalize vision state for a loaded game.
 *
 * FIXUP-1: Ensures both explored and visible grids have correct dimensions
 * after deserialization. The save format strips the visible grid
 * (sanitizeForSave sets visible=[]), so we must recreate it on load.
 * Also handles malformed or dimension-mismatched grids from corrupted saves.
 *
 * Policies:
 * - No vision field at all: v1 migration — fully-explored, visible all false, dirty true.
 * - Vision exists but visible missing/empty/wrong dimensions: recreate visible grid (all false).
 * - Explored missing/wrong dimensions: recreate explored grid (all false = fresh game fog).
 * - revision defaults to 0 if missing (pre-FIXUP-1 saves).
 * - dirty is set to true to trigger recomputeVisibility on first update.
 *
 * Returns the normalized VisionState. Does not mutate the input.
 */
export function normalizeVisionForLoadedState(
  mapWidth: number,
  mapHeight: number,
  vision?: VisionState | null,
): VisionState {
  if (!vision) {
    // v1 migration: no vision field → fully-explored (no sudden fog in ongoing games)
    const v = createInitialVisionState(mapWidth, mapHeight);
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        v.explored[y][x] = true;
      }
    }
    v.dirty = true;
    return v;
  }

  // Ensure explored grid has correct dimensions
  const exploredValid =
    Array.isArray(vision.explored) &&
    vision.explored.length === mapHeight &&
    vision.explored.every(row => Array.isArray(row) && row.length === mapWidth);

  const explored = exploredValid
    ? vision.explored
    : createVisionGrid(mapWidth, mapHeight, false);

  // Ensure visible grid has correct dimensions
  // sanitizeForSave strips visible to [], so we must recreate
  const visibleValid =
    Array.isArray(vision.visible) &&
    vision.visible.length === mapHeight &&
    vision.visible.every(row => Array.isArray(row) && row.length === mapWidth);

  const visible = visibleValid
    ? vision.visible
    : createVisionGrid(mapWidth, mapHeight, false);

  return {
    explored,
    visible,
    dirty: true, // Always force recompute after load
    revision: typeof vision.revision === 'number' ? vision.revision : 0,
  };
}

// ─── Recompute algorithm ──────────────────────────────────────────

/**
 * Recompute the visibility grid from all vision sources.
 *
 * MVP: Full recompute. Clears visible grid, then for each source,
 * marks all tiles within diamond radius as visible and explored.
 *
 * Diamond radius: |dx| + |dy| <= radius
 *
 * Performance: C = S * (2r^2 + 2r + 1) + T where S = sources, r = avg radius, T = total tiles.
 * For 48×48 with 10 sources and avg radius 4: ~2700 operations — trivially fast.
 */
export function recomputeVisibility(state: GameState): void {
  const vision = state.vision;
  if (!vision) return;

  const width = state.mapWidth;
  const height = state.mapHeight;

  // Clear visible grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      vision.visible[y][x] = false;
    }
  }

  // Collect vision sources and mark tiles
  const sources = collectVisionSources(state);

  for (const source of sources) {
    const r = source.radius;
    if (r <= 0) continue; // radius 0 contributes no vision

    // Diamond: iterate dy from -r to +r, dx from -(r - |dy|) to +(r - |dy|)
    for (let dy = -r; dy <= r; dy++) {
      const maxDx = r - Math.abs(dy);
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        const tx = source.tx + dx;
        const ty = source.ty + dy;

        // Bounds check
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;

        vision.visible[ty][tx] = true;
        vision.explored[ty][tx] = true;
      }
    }
  }

  vision.dirty = false;
  vision.revision++;
}
