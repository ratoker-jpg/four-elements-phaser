/**
 * Builder state machine — pure TypeScript, no Phaser.
 *
 * ARCH-13E3: Builder movement to construction site.
 *
 * Manages the builder lifecycle:
 *   idle → moving-to-site → building → idle
 *
 * - Idle builders are auto-assigned to pending construction sites.
 * - Moving builders follow a BFS path to a tile adjacent to the site footprint.
 * - Building builders stay adjacent while construction progresses.
 * - On site completion, builder returns to idle.
 *
 * Dependencies:
 * - occupancy.ts (buildOccupancyMap)
 * - pathfinding.ts (findPathToAdjacent)
 * - construction.ts (BUILDING_CONFIG)
 */

import type { GameState, BuilderPlacement, ConstructionSitePlacement } from './types';
import { buildOccupancyMap, addUnitBlockers, addVehicleBlockers } from './occupancy';
import { findPathToAdjacent } from './pathfinding';
import { BUILDING_CONFIG } from './construction';

// ─── Constants ──────────────────────────────────────────────────────

/** Builder movement speed in tiles per second. */
const BUILDER_SPEED = 3.0;

/**
 * Distance threshold (in tiles) to consider "arrived" at a path waypoint.
 * Reduced from 0.25 to 0.03 to eliminate visible snap-on-arrival jitter
 * when rendering builder sprites. The snap is still correct but only
 * triggers when the builder is visually indistinguishable from the target.
 */
const ARRIVAL_THRESHOLD = 0.03;

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Auto-assign idle builders to pending construction sites.
 *
 * For each pending site with no assigned builder (builderIndex === -1),
 * find the first idle builder and assign it. Computes a path from the
 * builder's current position to a tile adjacent to the site footprint.
 *
 * If no path is found, the site remains pending and a console.warn is issued.
 */
export function assignIdleBuilders(state: GameState): void {
  for (let si = 0; si < state.mapData.constructionSites.length; si++) {
    const site = state.mapData.constructionSites[si];

    // Only assign to sites that need a builder
    if (site.builderIndex !== -1) continue;

    // Find an idle builder
    const builderIndex = state.mapData.builders.findIndex(b => b.phase === 'idle' && !b.busy);
    if (builderIndex === -1) continue;

    const builder = state.mapData.builders[builderIndex];

    // Get the footprint for this building type
    const config = BUILDING_CONFIG[site.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;

    // Compute path from builder's current integer tile to adjacent of site footprint
    const startTx = Math.round(builder.ftx);
    const startTy = Math.round(builder.fty);
    const occupancyMap = buildOccupancyMap(state);
    // CORE-STEP-06H+ fixup: Respect other units and vehicles during builder pathfinding
    addUnitBlockers(state, occupancyMap, 'builder', builder.id);
    if (state.blockoutVehicles) {
      addVehicleBlockers(state.blockoutVehicles, occupancyMap);
    }
    const path = findPathToAdjacent(occupancyMap, startTx, startTy, site.tx, site.ty, fpW, fpH);

    if (!path) {
      console.warn(
        `[Builder] No path from (${startTx},${startTy}) to site at (${site.tx},${site.ty}) ` +
        `with footprint ${fpW}x${fpH}. Site remains pending.`,
      );
      continue;
    }

    // Assign builder to site
    builder.busy = true;
    builder.phase = 'moving-to-site';
    builder.assignedSiteId = site.id;
    builder.path = path;
    builder.pathIndex = 0;
    builder.targetTx = path.length > 0 ? path[path.length - 1].tx : startTx;
    builder.targetTy = path.length > 0 ? path[path.length - 1].ty : startTy;

    // Update site to track builder assignment
    site.builderIndex = builderIndex;

    // If path is empty (already adjacent), immediately transition to building
    if (path.length === 0) {
      builder.phase = 'building';
      builder.tx = startTx;
      builder.ty = startTy;
      site.pending = false;
    }

    console.log(
      `[Builder] Builder ${builderIndex} assigned to site ${site.id} at (${site.tx},${site.ty}), ` +
      `path length: ${path.length}`,
    );
  }
}

/**
 * Advance all builders by deltaMs milliseconds.
 *
 * Updates builder positions and phase transitions.
 * Must be called before updateConstructionSiteProgress so that
 * the building phase is established before progress checks.
 */
export function updateBuilders(state: GameState, deltaMs: number): void {
  const dt = Math.min(deltaMs, 200);

  for (let bi = 0; bi < state.mapData.builders.length; bi++) {
    const builder = state.mapData.builders[bi];
    updateBuilder(state, builder, bi, dt);
  }
}

/**
 * Release a builder back to idle state after construction completes.
 *
 * Called when a construction site finishes building.
 */
export function releaseBuilder(state: GameState, builderIndex: number): void {
  if (builderIndex < 0 || builderIndex >= state.mapData.builders.length) return;

  const builder = state.mapData.builders[builderIndex];
  builder.busy = false;
  builder.phase = 'idle';
  builder.assignedSiteId = -1;
  builder.path = [];
  builder.pathIndex = 0;
  builder.targetTx = Math.round(builder.ftx);
  builder.targetTy = Math.round(builder.fty);

  console.log(
    `[Builder] Builder ${builderIndex} released to idle at (${builder.ftx.toFixed(1)},${builder.fty.toFixed(1)})`,
  );
}

// ─── Internal helpers ───────────────────────────────────────────────

/**
 * Update a single builder's state machine.
 */
function updateBuilder(
  state: GameState,
  builder: BuilderPlacement,
  builderIndex: number,
  dt: number,
): void {
  switch (builder.phase) {
    case 'idle':
      // Nothing to do — assignment handled by assignIdleBuilders()
      break;

    case 'moving-to-site':
      handleMovingToSite(state, builder, builderIndex, dt);
      break;

    case 'building':
      // Builder stays in place while construction progresses.
      // Transition back to idle is handled when construction completes
      // (called from the construction completion logic).
      break;
  }
}

/**
 * Handle builder movement toward a construction site OR manual move target.
 *
 * ARCH-05X: If the builder has `manualMove` flag set, it returns to idle
 * on arrival instead of transitioning to 'building'.
 *
 * Moves along the path tile by tile. When the builder arrives at the
 * final path tile, transitions to 'building' phase (construction site)
 * or 'idle' (manual move).
 */
function handleMovingToSite(
  state: GameState,
  builder: BuilderPlacement,
  builderIndex: number,
  dt: number,
): void {
  // Manual move — check if arrived
  const isManual = builder.manualMove === true;

  if (isManual) {
    // Verify the target still makes sense
    if (builder.path.length === 0 || builder.pathIndex >= builder.path.length) {
      // Arrived at manual move target
      builder.phase = 'idle';
      builder.manualMove = undefined;
      builder.path = [];
      builder.pathIndex = 0;
      return;
    }
  } else {
    // Construction move — verify the assigned site still exists
    const site = findSiteById(state, builder.assignedSiteId);
    if (!site) {
      releaseBuilder(state, builderIndex);
      return;
    }
  }

  // If no path to follow, we may already be adjacent (construction) or at target (manual)
  if (builder.path.length === 0 || builder.pathIndex >= builder.path.length) {
    if (isManual) {
      builder.phase = 'idle';
      builder.manualMove = undefined;
    } else {
      const site = findSiteById(state, builder.assignedSiteId);
      if (site) {
        builder.phase = 'building';
        site.pending = false;
      } else {
        releaseBuilder(state, builderIndex);
      }
    }
    return;
  }

  // Move toward current path waypoint
  const waypoint = builder.path[builder.pathIndex];
  const arrived = moveBuilderToward(builder, waypoint.tx, waypoint.ty, dt);

  if (arrived) {
    // Snap to waypoint
    builder.ftx = waypoint.tx;
    builder.fty = waypoint.ty;
    builder.tx = waypoint.tx;
    builder.ty = waypoint.ty;
    builder.pathIndex++;

    // Check if we've reached the end of the path
    if (builder.pathIndex >= builder.path.length) {
      if (isManual) {
        builder.phase = 'idle';
        builder.manualMove = undefined;
      } else {
        const site = findSiteById(state, builder.assignedSiteId);
        if (site) {
          builder.phase = 'building';
          site.pending = false;
          console.log(
            `[Builder] Builder ${builderIndex} arrived at site ${site.id}, now building`,
          );
        } else {
          releaseBuilder(state, builderIndex);
        }
      }
    }
  }
}

/**
 * Move builder toward a target tile position.
 * Returns true if the builder has arrived (within ARRIVAL_THRESHOLD).
 */
function moveBuilderToward(
  builder: BuilderPlacement,
  targetTx: number,
  targetTy: number,
  dtMs: number,
): boolean {
  const dx = targetTx - builder.ftx;
  const dy = targetTy - builder.fty;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= ARRIVAL_THRESHOLD) return true;

  // How far to move this frame (in tiles)
  const step = (BUILDER_SPEED * dtMs) / 1000;
  const moveDist = Math.min(step, dist);

  builder.ftx += (dx / dist) * moveDist;
  builder.fty += (dy / dist) * moveDist;

  // Check arrival after move
  const newDx = targetTx - builder.ftx;
  const newDy = targetTy - builder.fty;
  return Math.sqrt(newDx * newDx + newDy * newDy) <= ARRIVAL_THRESHOLD;
}

/**
 * Find a construction site by its numeric ID.
 */
function findSiteById(state: GameState, siteId: number): ConstructionSitePlacement | null {
  return state.mapData.constructionSites.find(s => s.id === siteId) ?? null;
}
