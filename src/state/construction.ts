/**
 * Construction core — pure TypeScript, no Phaser.
 *
 * ARCH-13E1: Construction Core for the Separator building type.
 *
 * Provides:
 * - Building configuration (BUILDING_CONFIG)
 * - Placement validation (canPlaceBuilding)
 * - Construction site creation (placeConstructionSite)
 * - Construction progress tracking (updateConstructionSiteProgress)
 *
 * Intentionally NOT integrated yet:
 * - No renderer / visual construction site
 * - No placement preview
 * - No mouse/keyboard input
 * - No builder movement / pathfinding integration
 * - No economy redesign beyond rawMinerals deduction
 */

import type { GameState, BuildingType } from './types';
import { buildOccupancyMap, isBuildable } from './occupancy';

// ─── Building Configuration ─────────────────────────────────────────

/** Configuration for a single building type. */
export interface BuildingConfig {
  type: BuildingType;
  footprintW: number;
  footprintH: number;
  costRaw: number;
  buildTimeMs: number;
}

/**
 * Building configurations keyed by type.
 *
 * Only 'separator' is fully configured for ARCH-13E1.
 * Other types are absent — canPlaceBuilding rejects them with
 * 'unknown-building-type'. As future PRs add building types,
 * their configs are added here.
 */
export const BUILDING_CONFIG: Partial<Record<BuildingType, BuildingConfig>> = {
  separator: {
    type: 'separator',
    footprintW: 2,
    footprintH: 2,
    costRaw: 100,
    buildTimeMs: 5000,
  },
};

// ─── Placement Result ───────────────────────────────────────────────

/** Rejection reasons for building placement. */
export type PlacementRejectionReason = 'out-of-bounds' | 'occupied' | 'insufficient-resources' | 'unknown-building-type';

/** Result of a placement validation check. */
export type PlacementResult =
  | { valid: true }
  | { valid: false; reason: PlacementRejectionReason };

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Validate whether a building can be placed at the given position.
 *
 * Checks (in order):
 * 1. Building type must have a config entry in BUILDING_CONFIG.
 * 2. The full footprint must be within map bounds.
 * 3. The full footprint must be buildable (no unbuildable tiles).
 * 4. Player must have sufficient rawMinerals.
 *
 * Does NOT mutate state.
 */
export function canPlaceBuilding(
  state: GameState,
  buildingType: BuildingType,
  tx: number,
  ty: number,
): PlacementResult {
  // 1. Unknown building type
  const config = BUILDING_CONFIG[buildingType];
  if (!config) return { valid: false, reason: 'unknown-building-type' };

  // 2. Out of bounds — check that the entire footprint fits within the map
  if (tx < 0 || ty < 0 || tx + config.footprintW > state.mapWidth || ty + config.footprintH > state.mapHeight) {
    return { valid: false, reason: 'out-of-bounds' };
  }

  // 3. Occupied — check buildability via occupancy map
  const map = buildOccupancyMap(state);
  if (!isBuildable(map, tx, ty, config.footprintW, config.footprintH)) {
    return { valid: false, reason: 'occupied' };
  }

  // 4. Insufficient resources
  if (state.rawMinerals < config.costRaw) {
    return { valid: false, reason: 'insufficient-resources' };
  }

  return { valid: true };
}

/**
 * Place a construction site at the given position.
 *
 * Validates placement with canPlaceBuilding first.
 * On success: deducts rawMinerals and creates a construction site in state.
 * On failure: does NOT mutate state.
 *
 * Uses deterministic IDs: site-${nextConstructionId}, incrementing counter.
 */
export function placeConstructionSite(
  state: GameState,
  buildingType: BuildingType,
  tx: number,
  ty: number,
): { ok: true; siteId: string } | { ok: false; reason: PlacementRejectionReason } {
  // Validate first — no mutation on failure
  const validation = canPlaceBuilding(state, buildingType, tx, ty);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason };
  }

  const config = BUILDING_CONFIG[buildingType]!; // guaranteed non-null after validation

  // Deduct resources
  state.rawMinerals -= config.costRaw;

  // Create construction site with deterministic ID
  const siteId = `site-${state.nextConstructionId}`;
  state.mapData.constructionSites.push({
    tx,
    ty,
    type: buildingType,
    elapsed: 0,
    duration: config.buildTimeMs,
    progress: 0,
    builderIndex: -1,
    id: state.nextConstructionId,
    pending: true,
  });
  state.nextConstructionId++;

  return { ok: true, siteId };
}

/**
 * Advance construction site progress by deltaMs milliseconds.
 *
 * Clamps deltaMs to 200ms maximum (consistent with updateGameState convention).
 * When construction completes:
 * - Creates a building in state.mapData.buildings
 * - Removes the construction site from state.mapData.constructionSites
 *
 * Returns { completed: false } if still in progress or site not found.
 * Returns { completed: true; buildingId } when construction finishes.
 */
export function updateConstructionSiteProgress(
  state: GameState,
  siteId: string,
  deltaMs: number,
): { completed: false } | { completed: true; buildingId: string } {
  // Parse site ID
  const numericId = parseSiteId(siteId);
  if (numericId === null) return { completed: false };

  // Find the construction site
  const siteIndex = state.mapData.constructionSites.findIndex(s => s.id === numericId);
  if (siteIndex === -1) return { completed: false };

  const site = state.mapData.constructionSites[siteIndex];

  // Clamp delta (consistent with updateGameState)
  const dt = Math.min(deltaMs, 200);

  // Advance progress
  site.elapsed += dt;
  site.progress = Math.min(site.elapsed / site.duration, 1);

  // Check completion
  if (site.elapsed < site.duration) {
    return { completed: false };
  }

  // Complete: create building at the construction site's position
  const buildingId = `building-${site.tx}-${site.ty}`;
  state.mapData.buildings.push({
    tx: site.tx,
    ty: site.ty,
    type: site.type,
  });

  // Remove the construction site
  state.mapData.constructionSites.splice(siteIndex, 1);

  return { completed: true, buildingId };
}

// ─── Internal helpers ───────────────────────────────────────────────

/** Parse a site ID string like 'site-0' back to a numeric ID. Returns null if invalid. */
function parseSiteId(siteId: string): number | null {
  if (!siteId.startsWith('site-')) return null;
  const num = parseInt(siteId.slice(5), 10);
  if (isNaN(num)) return null;
  return num;
}
