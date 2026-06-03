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
 * ARCH-13E3: Construction progress now requires an assigned builder in 'building'
 * phase. Sites with pending=true (no builder actively building) do not advance.
 * On completion, the assigned builder is released back to idle.
 *
 * Intentionally NOT integrated yet:
 * - No placement preview
 * - No final build UI
 * - No mouse/keyboard input for placement
 * - No economy redesign beyond matter-based construction deduction
 */

import type { GameState, BuildingType } from './types';
import { RAW_STORAGE_RAW_BONUS, MATTER_STORAGE_MATTER_BONUS, ELEMENT_STORAGE_ELEMENT_BONUS } from './types';
import { buildOccupancyMap, isBuildable } from './occupancy';
import { isVisualReadyBuilding } from '../config/buildingRuntimeMapping';

// ─── Building Configuration ─────────────────────────────────────────

/** Configuration for a single building type. */
export interface BuildingConfig {
  type: BuildingType;
  footprintW: number;
  footprintH: number;
  /** Construction cost in matter (processed resource). */
  costMatter: number;
  buildTimeMs: number;
}

/**
 * Building configurations keyed by type.
 *
 * CORE-STEP-04H+: All core economy buildings now have complete configs.
 * Costs are in matter (processed resource / "energy" in the production model).
 *
 * Building-type to production-config mapping:
 *   'raw-storage'     → production 'raw_storage'
 *   'matter-storage'  → production 'energy_storage' (displayed as Хранилище энергии)
 *   'element-storage' → production 'elements_storage' (displayed as Хранилище элементов)
 *   'energy-plant'    → production 'energy_reactor' (visual-ready, no mechanic yet)
 */
export const BUILDING_CONFIG: Partial<Record<BuildingType, BuildingConfig>> = {
  separator: {
    type: 'separator',
    footprintW: 2,
    footprintH: 2,
    costMatter: 60,
    buildTimeMs: 20000,
  },
  'raw-storage': {
    type: 'raw-storage',
    footprintW: 2,
    footprintH: 2,
    costMatter: 40,
    buildTimeMs: 15000,
  },
  'matter-storage': {
    type: 'matter-storage',
    footprintW: 2,
    footprintH: 2,
    costMatter: 40,
    buildTimeMs: 15000,
  },
  'element-storage': {
    type: 'element-storage',
    footprintW: 2,
    footprintH: 2,
    costMatter: 50,
    buildTimeMs: 18000,
  },
  'power-plant': {
    type: 'power-plant',
    footprintW: 2,
    footprintH: 2,
    costMatter: 100,
    buildTimeMs: 25000,
  },
  'energy-plant': {
    type: 'energy-plant',
    footprintW: 2,
    footprintH: 2,
    costMatter: 80,
    buildTimeMs: 20000,
  },
  'units-factory': {
    type: 'units-factory',
    footprintW: 2,
    footprintH: 2,
    costMatter: 120,
    buildTimeMs: 40000,
  },
};

// ─── Placement Result ───────────────────────────────────────────────

/** Rejection reasons for building placement. */
export type PlacementRejectionReason = 'out-of-bounds' | 'occupied' | 'insufficient-resources' | 'unknown-building-type' | 'not-buildable';

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
 * 4. Player must have sufficient matter.
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

  // 1b. Visual-ready buildings are not buildable through the live build flow.
  //     Source-of-truth: production config readiness + isBuildable fields.
  if (isVisualReadyBuilding(buildingType)) {
    return { valid: false, reason: 'not-buildable' };
  }

  // 2. Out of bounds — check that the entire footprint fits within the map
  if (tx < 0 || ty < 0 || tx + config.footprintW > state.mapWidth || ty + config.footprintH > state.mapHeight) {
    return { valid: false, reason: 'out-of-bounds' };
  }

  // 3. Occupied — check buildability via occupancy map
  const map = buildOccupancyMap(state);
  if (!isBuildable(map, tx, ty, config.footprintW, config.footprintH)) {
    return { valid: false, reason: 'occupied' };
  }

  // 4. Insufficient matter
  if (state.economy.matter < config.costMatter) {
    return { valid: false, reason: 'insufficient-resources' };
  }

  return { valid: true };
}

/**
 * Place a construction site at the given position.
 *
 * Validates placement with canPlaceBuilding first.
 * On success: deducts matter and creates a construction site in state.
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

  // Deduct matter
  state.economy.matter -= config.costMatter;

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
 * ARCH-13E3: Progress only advances when the site has an active builder
 * in 'building' phase (site.pending === false). If no builder is assigned
 * or the builder hasn't arrived yet (site.pending === true), progress
 * does not advance.
 *
 * Clamps deltaMs to 200ms maximum (consistent with updateGameState convention).
 * When construction completes:
 * - Creates a building in state.mapData.buildings
 * - Removes the construction site from state.mapData.constructionSites
 * - Releases the assigned builder back to idle
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

  // ARCH-13E3: Do not advance progress if builder hasn't started building yet.
  // site.pending === true means no builder is actively building at this site.
  if (site.pending) {
    return { completed: false };
  }

  // ARCH-13E3: Verify builder is in 'building' phase.
  // If the assigned builder is no longer building (shouldn't happen, but safety check),
  // don't advance progress.
  if (site.builderIndex >= 0 && site.builderIndex < state.mapData.builders.length) {
    const builder = state.mapData.builders[site.builderIndex];
    if (builder.phase !== 'building') {
      return { completed: false };
    }
  }

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

  // ARCH-01C: Register completed separator into economy separator runtime state.
  if (site.type === 'separator') {
    state.economy.separators.push({
      tx: site.tx,
      ty: site.ty,
      progress: 0,
      active: false,
    });
  }

  // ARCH-01D / CORE-STEP-04H+: Apply storage cap bonuses for completed storage buildings.
  if (site.type === 'raw-storage') {
    state.economy.rawCap += RAW_STORAGE_RAW_BONUS;
  } else if (site.type === 'matter-storage') {
    state.economy.matterCap += MATTER_STORAGE_MATTER_BONUS;
  } else if (site.type === 'element-storage') {
    state.economy.elementCap += ELEMENT_STORAGE_ELEMENT_BONUS;
  }
  // energy-plant: visual-ready, no gameplay mechanic yet

  // ARCH-01F: Register completed units-factory into production runtime state.
  if (site.type === 'units-factory') {
    state.production.factories.push({
      tx: site.tx,
      ty: site.ty,
      queue: [],
      active: false,
    });
  }

  // Release the assigned builder back to idle
  if (site.builderIndex >= 0) {
    // Import releaseBuilder dynamically to avoid circular dependency at module level.
    // We inline the release logic here to keep construction.ts self-contained.
    const bi = site.builderIndex;
    if (bi < state.mapData.builders.length) {
      const builder = state.mapData.builders[bi];
      builder.busy = false;
      builder.phase = 'idle';
      builder.assignedSiteId = -1;
      builder.path = [];
      builder.pathIndex = 0;
      builder.targetTx = Math.round(builder.ftx);
      builder.targetTy = Math.round(builder.fty);
    }
  }

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
