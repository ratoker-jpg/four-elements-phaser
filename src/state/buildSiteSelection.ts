/**
 * Automatic build-site selection — pure TypeScript, no Phaser.
 *
 * ARCH-13E4: Replaces fixed debug placement with automatic site selection.
 *
 * The player chooses a building type; the system finds a valid build
 * location near existing player structures automatically. The chosen
 * site must satisfy canPlaceBuilding() and maintain a configurable
 * gap around other building/construction footprints.
 *
 * Search strategy:
 * 1. Collect anchor points from HQ, completed buildings, and active
 *    construction sites.
 * 2. For every possible (tx, ty) on the map, compute Manhattan distance
 *    from the candidate building center to the nearest anchor.
 * 3. Sort candidates by (distance, tx, ty) — nearest-first, deterministic.
 * 4. Return the first candidate that passes both canPlaceBuilding() and
 *    the gap rule.
 *
 * Intentionally NOT implemented:
 * - No mouse/keyboard tile selection
 * - No placement preview
 * - No build panel UI
 * - No multiple building types (only 'separator' configured)
 */

import type { GameState, BuildingType, TeamId } from './types';
import { ensureMatchState } from './matchState';
import { canPlaceBuilding, BUILDING_CONFIG } from './construction';

// ─── Public types ──────────────────────────────────────────────────

/** Options controlling the build-site search. */
export interface BuildSiteSearchOptions {
  /** Number of empty tiles required between building footprints. Default: 1. */
  gapTiles: number;
  /** Maximum Manhattan distance from the nearest anchor. Default: 30. */
  maxRadius: number;
}

/** Result of a build-site search. */
export type BuildSiteResult =
  | { ok: true; tx: number; ty: number }
  | { ok: false; reason: 'no-valid-site' | 'unknown-building-type' };

// ─── Internal helpers ──────────────────────────────────────────────

/** Describes a rectangular footprint on the map. */
interface Footprint {
  tx: number;
  ty: number;
  fpW: number;
  fpH: number;
}

/** Default search options. */
const DEFAULT_OPTIONS: BuildSiteSearchOptions = {
  gapTiles: 1,
  maxRadius: 30,
};

/**
 * Collect all building/construction footprints that the gap rule must respect.
 *
 * Includes: HQ, completed buildings, and active construction sites.
 * Does NOT include resources or obstacles — those are handled by
 * canPlaceBuilding() via the occupancy map.
 */
function collectFootprints(state: GameState): Footprint[] {
  const footprints: Footprint[] = [];

  // HQ — 3x3 footprint
  footprints.push({
    tx: state.mapData.hq.tx,
    ty: state.mapData.hq.ty,
    fpW: 3,
    fpH: 3,
  });

  // Completed buildings
  for (const b of state.mapData.buildings) {
    const config = BUILDING_CONFIG[b.type];
    footprints.push({
      tx: b.tx,
      ty: b.ty,
      fpW: config?.footprintW ?? 1,
      fpH: config?.footprintH ?? 1,
    });
  }

  // Active construction sites
  for (const c of state.mapData.constructionSites) {
    const config = BUILDING_CONFIG[c.type];
    footprints.push({
      tx: c.tx,
      ty: c.ty,
      fpW: config?.footprintW ?? 1,
      fpH: config?.footprintH ?? 1,
    });
  }

  return footprints;
}

/**
 * Collect anchor points for proximity search.
 *
 * Anchors are the centers of: HQ, completed buildings, active construction sites.
 * The search prioritises sites nearest to these anchors.
 */
function collectAnchors(
  state: GameState,
  ownerTeamId: TeamId,
): Array<{ tx: number; ty: number }> {
  const anchors: Array<{ tx: number; ty: number }> = [];

  // HQ center — only the requesting team's HQ is an anchor.
  if ((state.mapData.hq.ownerTeamId ?? ownerTeamId) === ownerTeamId) {
    anchors.push({
      tx: state.mapData.hq.tx + 1,
      ty: state.mapData.hq.ty + 1,
    });
  }

  // Completed building centers
  for (const b of state.mapData.buildings) {
    if ((b.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;
    const config = BUILDING_CONFIG[b.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;
    anchors.push({
      tx: b.tx + Math.floor(fpW / 2),
      ty: b.ty + Math.floor(fpH / 2),
    });
  }

  // Construction site centers
  for (const c of state.mapData.constructionSites) {
    if ((c.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;
    const config = BUILDING_CONFIG[c.type];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;
    anchors.push({
      tx: c.tx + Math.floor(fpW / 2),
      ty: c.ty + Math.floor(fpH / 2),
    });
  }

  return anchors;
}

/**
 * Check whether two axis-aligned rectangles overlap.
 *
 * Rectangles are defined by top-left (x, y) and size (w, h).
 * Overlap requires sharing at least one tile — touching edges
 * (e.g. x + w === other.x) is NOT overlap.
 */
function rectanglesOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Check whether a candidate building position satisfies the gap rule.
 *
 * The candidate footprint must not overlap with any existing footprint
 * expanded by gapTiles in all four directions. This ensures at least
 * gapTiles empty tiles between the candidate and every existing
 * building/construction site.
 *
 * The gap rule only applies to building/construction footprints, NOT
 * to resources or obstacles (those are handled by canPlaceBuilding).
 */
function passesGapRule(
  tx: number,
  ty: number,
  fpW: number,
  fpH: number,
  footprints: Footprint[],
  gapTiles: number,
): boolean {
  for (const fp of footprints) {
    // Expand the candidate footprint by gapTiles in all directions
    const expTx = tx - gapTiles;
    const expTy = ty - gapTiles;
    const expW = fpW + 2 * gapTiles;
    const expH = fpH + 2 * gapTiles;

    // If the expanded candidate overlaps an existing footprint, gap is violated
    if (rectanglesOverlap(expTx, expTy, expW, expH, fp.tx, fp.ty, fp.fpW, fp.fpH)) {
      return false;
    }
  }
  return true;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Find a valid build site near existing player buildings.
 *
 * Searches for the nearest valid location to place a building of the
 * given type. The search is deterministic: candidates are sorted by
 * (Manhattan distance to nearest anchor, tx, ty).
 *
 * A valid site must:
 * 1. Pass canPlaceBuilding() (bounds, occupancy, resources).
 * 2. Maintain gapTiles empty tiles between the candidate footprint and
 *    all existing building/construction footprints (including HQ).
 *
 * Returns { ok: true, tx, ty } if a site is found.
 * Returns { ok: false, reason } if no valid site exists or the building
 * type is unknown.
 */
export function findBuildSiteNearPlayerBuildings(
  state: GameState,
  buildingType: BuildingType,
  options?: Partial<BuildSiteSearchOptions>,
  ownerTeamId?: TeamId,
): BuildSiteResult {
  // 1. Validate building type
  const config = BUILDING_CONFIG[buildingType];
  if (!config) return { ok: false, reason: 'unknown-building-type' };

  const gapTiles = options?.gapTiles ?? DEFAULT_OPTIONS.gapTiles;
  const maxRadius = options?.maxRadius ?? DEFAULT_OPTIONS.maxRadius;
  const match = ensureMatchState(state);
  const resolvedOwnerTeamId = ownerTeamId ?? match.humanTeamId;

  // 2. Collect anchors and footprints
  const anchors = collectAnchors(state, resolvedOwnerTeamId);
  if (anchors.length === 0) return { ok: false, reason: 'no-valid-site' };
  const footprints = collectFootprints(state);

  // 3. Compute candidate center offset
  const cx = (config.footprintW - 1) / 2;
  const cy = (config.footprintH - 1) / 2;

  // 4. Generate candidates sorted by distance to nearest anchor
  const candidates: Array<{ tx: number; ty: number; dist: number }> = [];

  for (let ty = 0; ty <= state.mapHeight - config.footprintH; ty++) {
    for (let tx = 0; tx <= state.mapWidth - config.footprintW; tx++) {
      // Compute Manhattan distance from candidate center to nearest anchor
      let minDist = Infinity;
      for (const a of anchors) {
        const dx = (tx + cx) - a.tx;
        const dy = (ty + cy) - a.ty;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < minDist) minDist = dist;
      }

      if (minDist <= maxRadius) {
        candidates.push({ tx, ty, dist: minDist });
      }
    }
  }

  // Sort by (distance, tx, ty) — nearest-first, deterministic tie-break
  candidates.sort((a, b) => a.dist - b.dist || a.tx - b.tx || a.ty - b.ty);

  // 5. Check each candidate
  for (const candidate of candidates) {
    // Must pass canPlaceBuilding (bounds, occupancy, resources, cost)
    const placement = canPlaceBuilding(
      state, buildingType, candidate.tx, candidate.ty, resolvedOwnerTeamId,
    );
    if (!placement.valid) continue;

    // Must pass gap rule around existing building/construction footprints
    if (!passesGapRule(candidate.tx, candidate.ty, config.footprintW, config.footprintH, footprints, gapTiles)) {
      continue;
    }

    return { ok: true, tx: candidate.tx, ty: candidate.ty };
  }

  return { ok: false, reason: 'no-valid-site' };
}
