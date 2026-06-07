/**
 * Map validation helpers — pure TypeScript, no Phaser.
 *
 * ARCH-08/09/10: Read-only validation helpers that check whether a
 * generated/loaded map is playable. These helpers use the existing
 * OccupancyMap and BFS pathfinding infrastructure to derive
 * reachability and safety information without mutating state.
 *
 * Validation checks:
 * 1. HQ/start area is not blocked (adjacent passable tiles exist).
 * 2. At least N starting resources are reachable from HQ spawn area.
 * 3. Starting resources are not placed inside impassable/building footprints.
 * 4. Resources do not fully trap the initial harvester spawn area.
 *
 * These are designed to be called at map load time and surfaced through
 * diagnostics/debug overlays. They do NOT modify the map or game state.
 */

import type { GameState } from './types';
import { buildOccupancyMap, isPassable, isInBounds } from './occupancy';
import { findPathToAdjacent } from './pathfinding';
import { ACCEPTED_RESOURCE_CLASS_IDS } from '../config/coreMechanicsTypes';
import { isGeneratedRuntimeState } from './generatedMap';

// ─── Constants ──────────────────────────────────────────────────────

/** Minimum number of reachable resources required for a valid start. */
export const MIN_REACHABLE_RESOURCES = 2;

/** Maximum BFS distance (in tiles) to consider a resource "near base". */
export const NEAR_BASE_DISTANCE = 20;

// ─── Validation result types ────────────────────────────────────────

/** Result of validating a map for playability. */
export interface MapValidationResult {
  /** Whether the map passes all validation checks. */
  valid: boolean;
  /** Individual check results with details. */
  checks: ValidationCheck[];
  /** Summary of reachable resources near base. */
  reachableResourceCount: number;
  /** Total non-depleted resources on the map. */
  totalResourceCount: number;
}

/** A single validation check result. */
export interface ValidationCheck {
  /** Which check was performed. */
  id: ValidationCheckId;
  /** Whether the check passed. */
  passed: boolean;
  /** Human-readable description of the result. */
  message: string;
}

/** Identifiers for individual validation checks. */
export type ValidationCheckId =
  | 'hq-adjacent-passable'
  | 'reachable-resources'
  | 'resources-not-in-impassable'
  | 'harvester-not-trapped'
  | 'generated-resource-class-valid';

// ─── Public API ────────────────────────────────────────────────────

/**
 * Validate a map for playability.
 *
 * Runs all validation checks against the current game state and returns
 * a structured result with details. This is a read-only operation — it
 * does not modify state.
 */
export function validateMap(state: GameState): MapValidationResult {
  const checks: ValidationCheck[] = [];
  const occupancy = buildOccupancyMap(state);

  // Check 1: HQ adjacent passable tiles
  checks.push(checkHqAdjacentPassable(state, occupancy));

  // Check 2: Reachable resources from HQ
  const resourceCheck = checkReachableResources(state, occupancy);
  checks.push(resourceCheck);

  // Check 3: Resources not inside impassable footprints
  checks.push(checkResourcesNotInImpassable(state, occupancy));

  // Check 4: Harvester spawn area not trapped
  checks.push(checkHarvesterNotTrapped(state, occupancy));

  // Check 5: CORE-STEP-03C — Generated resource resourceClass validity
  // Only applies to generated maps (detected via mapName prefix).
  // Old/custom/saved maps without resourceClass should NOT fail this check.
  if (isGeneratedRuntimeState(state)) {
    checks.push(checkGeneratedResourceClassValid(state));
  }

  const allPassed = checks.every(c => c.passed || c.id === 'resources-not-in-impassable');

  // Count reachable and total resources
  const reachableCount = countReachableResources(state, occupancy);
  const totalCount = state.resourceNodes.filter(r => !r.depleted).length;

  return {
    valid: allPassed,
    checks,
    reachableResourceCount: reachableCount,
    totalResourceCount: totalCount,
  };
}

/**
 * Count how many non-depleted resource nodes are reachable from the HQ
 * spawn area (adjacent to HQ footprint) within BFS distance limit.
 *
 * A resource is considered reachable if a path exists from an HQ-adjacent
 * passable tile to a tile adjacent to the resource footprint.
 */
export function countReachableResources(state: GameState, occupancy: ReturnType<typeof buildOccupancyMap>): number {
  const spawnTiles = getHqAdjacentPassableTiles(state, occupancy);
  if (spawnTiles.length === 0) return 0;

  let reachable = 0;
  for (const resource of state.resourceNodes) {
    if (resource.depleted) continue;
    // A resource is reachable if ANY HQ-adjacent passable tile can reach it.
    // We don't just use spawnTiles[0] because the first tile in enumeration
    // order may not be representative of actual harvester exit routes.
    let found = false;
    for (const spawnTile of spawnTiles) {
      const path = findPathToAdjacent(
        occupancy,
        spawnTile.tx, spawnTile.ty,
        resource.tx, resource.ty,
        resource.footprint, resource.footprint,
      );
      if (path !== null && path.length <= NEAR_BASE_DISTANCE) {
        found = true;
        break;
      }
    }
    if (found) {
      reachable++;
    }
  }
  return reachable;
}

/**
 * Get all passable tiles adjacent to the HQ footprint.
 *
 * HQ has a 3×3 footprint starting at (hq.tx, hq.ty).
 * Adjacent tiles share an edge with this footprint in 4-connectivity.
 */
export function getHqAdjacentPassableTiles(
  state: GameState,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): Array<{ tx: number; ty: number }> {
  const hq = state.mapData.hq;
  const tiles: Array<{ tx: number; ty: number }> = [];

  // North border: y = hq.ty - 1, x from hq.tx to hq.tx + 2
  for (let dx = 0; dx < 3; dx++) {
    const tx = hq.tx + dx;
    const ty = hq.ty - 1;
    if (isInBounds(occupancy, tx, ty) && isPassable(occupancy, tx, ty)) {
      tiles.push({ tx, ty });
    }
  }

  // South border: y = hq.ty + 3, x from hq.tx to hq.tx + 2
  for (let dx = 0; dx < 3; dx++) {
    const tx = hq.tx + dx;
    const ty = hq.ty + 3;
    if (isInBounds(occupancy, tx, ty) && isPassable(occupancy, tx, ty)) {
      tiles.push({ tx, ty });
    }
  }

  // West border: x = hq.tx - 1, y from hq.ty to hq.ty + 2
  for (let dy = 0; dy < 3; dy++) {
    const tx = hq.tx - 1;
    const ty = hq.ty + dy;
    if (isInBounds(occupancy, tx, ty) && isPassable(occupancy, tx, ty)) {
      tiles.push({ tx, ty });
    }
  }

  // East border: x = hq.tx + 3, y from hq.ty to hq.ty + 2
  for (let dy = 0; dy < 3; dy++) {
    const tx = hq.tx + 3;
    const ty = hq.ty + dy;
    if (isInBounds(occupancy, tx, ty) && isPassable(occupancy, tx, ty)) {
      tiles.push({ tx, ty });
    }
  }

  return tiles;
}

// ─── Individual checks ─────────────────────────────────────────────

function checkHqAdjacentPassable(
  state: GameState,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): ValidationCheck {
  const tiles = getHqAdjacentPassableTiles(state, occupancy);

  if (tiles.length > 0) {
    return {
      id: 'hq-adjacent-passable',
      passed: true,
      message: `HQ has ${tiles.length} adjacent passable tile(s)`,
    };
  }

  return {
    id: 'hq-adjacent-passable',
    passed: false,
    message: 'HQ has no adjacent passable tiles — start area is blocked',
  };
}

function checkReachableResources(
  state: GameState,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): ValidationCheck {
  const reachable = countReachableResources(state, occupancy);

  if (reachable >= MIN_REACHABLE_RESOURCES) {
    return {
      id: 'reachable-resources',
      passed: true,
      message: `${reachable} resource(s) reachable near base (need ${MIN_REACHABLE_RESOURCES})`,
    };
  }

  return {
    id: 'reachable-resources',
    passed: false,
    message: `Only ${reachable} resource(s) reachable near base (need ${MIN_REACHABLE_RESOURCES}) — economy may stall`,
  };
}

function checkResourcesNotInImpassable(
  state: GameState,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): ValidationCheck {
  // Check each resource placement — we verify that there's a BFS path
  // from an HQ-adjacent passable tile to a tile adjacent to the resource.
  // Dense resource clusters where resources neighbor each other are
  // fine as long as the cluster itself is reachable from HQ.
  const spawnTiles = getHqAdjacentPassableTiles(state, occupancy);
  if (spawnTiles.length === 0) {
    return {
      id: 'resources-not-in-impassable',
      passed: false,
      message: 'No HQ spawn tiles available — cannot check resource reachability',
    };
  }

  let unreachableCount = 0;
  const details: string[] = [];

  for (const resource of state.mapData.resources) {
    // A resource is considered "in impassable" (unreachable) if there's
    // no BFS path from ANY HQ-adjacent passable tile to a tile adjacent to it.
    let reachableFromAny = false;
    for (const spawnTile of spawnTiles) {
      const path = findPathToAdjacent(
        occupancy,
        spawnTile.tx, spawnTile.ty,
        resource.tx, resource.ty,
        resource.footprint, resource.footprint,
      );
      if (path !== null) {
        reachableFromAny = true;
        break;
      }
    }
    if (!reachableFromAny) {
      unreachableCount++;
      if (details.length < 5) { // Limit detail messages
        details.push(`resource at (${resource.tx},${resource.ty}) has no path from HQ`);
      }
    }
  }

  if (unreachableCount === 0) {
    return {
      id: 'resources-not-in-impassable',
      passed: true,
      message: 'All resources are reachable from HQ spawn area',
    };
  }

  const detailStr = details.length < unreachableCount
    ? `${details.join('; ')} (+${unreachableCount - details.length} more)`
    : details.join('; ');
  return {
    id: 'resources-not-in-impassable',
    passed: false,
    message: `${unreachableCount} resource(s) unreachable: ${detailStr}`,
  };
}

function checkHarvesterNotTrapped(
  state: GameState,
  occupancy: ReturnType<typeof buildOccupancyMap>,
): ValidationCheck {
  // Check if the harvester spawn area (tiles near HQ where extra
  // harvesters are placed) has a path to at least one resource.
  // This catches maps where resources surround the HQ and trap units.
  const spawnTiles = getHqAdjacentPassableTiles(state, occupancy);
  if (spawnTiles.length === 0) {
    return {
      id: 'harvester-not-trapped',
      passed: false,
      message: 'No spawn tiles available near HQ',
    };
  }

  // Check if there's a path from any spawn tile to any resource
  for (const spawnTile of spawnTiles) {
    for (const resource of state.resourceNodes) {
      if (resource.depleted) continue;
      const path = findPathToAdjacent(
        occupancy,
        spawnTile.tx, spawnTile.ty,
        resource.tx, resource.ty,
        resource.footprint, resource.footprint,
      );
      if (path !== null) {
        return {
          id: 'harvester-not-trapped',
          passed: true,
          message: 'Harvesters can reach at least one resource from spawn area',
        };
      }
    }
  }

  return {
    id: 'harvester-not-trapped',
    passed: false,
    message: 'Harvesters cannot reach any resource from spawn area — trapped',
  };
}

// ─── CORE-STEP-03C: Generated resourceClass validation ─────────────────

/**
 * Check that all resource nodes on a generated map have valid resourceClass.
 *
 * This check only runs for generated maps (detected via mapName).
 * Old/custom/saved maps without resourceClass are explicitly exempt.
 *
 * Validation rules:
 * - Every resource node must have a resourceClass (missing = issue)
 * - Every resourceClass must be one of the 6 accepted IDs (invalid = issue)
 * - Exactly one resource should have resourceClass === 'infinite'
 */
function checkGeneratedResourceClassValid(state: GameState): ValidationCheck {
  const acceptedSet = new Set<string>(ACCEPTED_RESOURCE_CLASS_IDS);
  let missingCount = 0;
  let invalidCount = 0;
  let infiniteCount = 0;
  const invalidExamples: string[] = [];

  for (const node of state.resourceNodes) {
    if (!node.resourceClass) {
      missingCount++;
    } else if (!acceptedSet.has(node.resourceClass)) {
      invalidCount++;
      if (invalidExamples.length < 3) {
        invalidExamples.push(`'${node.resourceClass}' at (${node.tx},${node.ty})`);
      }
    }
    if (node.resourceClass === 'infinite') {
      infiniteCount++;
    }
  }

  const issues: string[] = [];
  if (missingCount > 0) {
    issues.push(`${missingCount} resource(s) missing resourceClass`);
  }
  if (invalidCount > 0) {
    const examples = invalidExamples.join('; ');
    issues.push(`${invalidCount} resource(s) invalid resourceClass: ${examples}`);
  }
  if (infiniteCount !== 1) {
    issues.push(`expected 1 infinite, found ${infiniteCount}`);
  }

  if (issues.length === 0) {
    return {
      id: 'generated-resource-class-valid',
      passed: true,
      message: `All ${state.resourceNodes.length} generated resources have valid resourceClass`,
    };
  }

  return {
    id: 'generated-resource-class-valid',
    passed: false,
    message: `Generated resourceClass issues: ${issues.join('; ')}`,
  };
}
