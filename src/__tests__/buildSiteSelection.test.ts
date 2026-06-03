import { describe, it, expect } from 'vitest';
import {
  findBuildSiteNearPlayerBuildings,
} from '../state/buildSiteSelection';
import { canPlaceBuilding, BUILDING_CONFIG } from '../state/construction';
import type { GameState, MapData, EconomyState } from '../state/types';

// ─── Test helpers ──────────────────────────────────────────────────

/** Build a minimal GameState for build-site selection tests. */
function makeTestState(overrides?: {
  mapW?: number;
  mapH?: number;
  hqTx?: number;
  hqTy?: number;
  matter?: number;
  resources?: Array<{ tx: number; ty: number; footprint: number }>;
  obstacles?: Array<{ tx: number; ty: number; footprint: number }>;
  buildings?: Array<{ tx: number; ty: number; type?: string }>;
  constructionSites?: Array<{ tx: number; ty: number; type?: string; footprint?: number }>;
}): GameState {
  const w = overrides?.mapW ?? 20;
  const h = overrides?.mapH ?? 20;
  const hqTx = overrides?.hqTx ?? 0;
  const hqTy = overrides?.hqTy ?? 0;

  const mapData: MapData = {
    width: w,
    height: h,
    terrain: Array.from({ length: h }, () => Array(w).fill('sand')),
    hq: { tx: hqTx, ty: hqTy, faction: 'cyan' },
    resources: (overrides?.resources ?? []).map(r => ({
      tx: r.tx,
      ty: r.ty,
      type: 'small' as const,
      footprint: r.footprint,
    })),
    obstacles: (overrides?.obstacles ?? []).map(o => ({
      tx: o.tx,
      ty: o.ty,
      type: 'mountain-small' as const,
      footprint: o.footprint,
    })),
    decor: [],
    buildings: (overrides?.buildings ?? []).map(b => ({
      tx: b.tx,
      ty: b.ty,
      type: (b.type ?? 'separator') as 'separator',
    })),
    builders: [],
    constructionSites: (overrides?.constructionSites ?? []).map((c, i) => ({
      tx: c.tx,
      ty: c.ty,
      type: (c.type ?? 'separator') as 'separator',
      elapsed: 0,
      duration: 20000,
      progress: 0,
      builderIndex: -1,
      id: i,
      pending: true,
    })),
  };

  return {
    mapId: 'test',
    mapName: 'Test',
    mapWidth: w,
    mapHeight: h,
    mapData,
    entities: [],
    playerFaction: 'cyan',
    extraHarvesters: [],
    extraModularCombat: [],
    harvesters: [],
    resourceNodes: [],
    economy: { raw: 0, matter: overrides?.matter ?? 500, elements: { cyan: 0, green: 0, yellow: 0, purple: 0 }, powerGenerated: 0, powerConsumed: 0, separators: [], rawCap: 200, matterCap: 200, elementCap: 200 } as EconomyState,
    hqPosition: { tx: hqTx + 1, ty: hqTy + 1 },
    nextConstructionId: 0,
    production: { factories: [] },
  };
}

// ─── findBuildSiteNearPlayerBuildings ───────────────────────────────

describe('findBuildSiteNearPlayerBuildings', () => {
  it('finds a valid Separator site near HQ', () => {
    // HQ at (5,5), 3x3 footprint → occupies (5,5)-(7,7)
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Must be a valid position on the map
      expect(result.tx).toBeGreaterThanOrEqual(0);
      expect(result.ty).toBeGreaterThanOrEqual(0);
      expect(result.tx + 2).toBeLessThanOrEqual(20);
      expect(result.ty + 2).toBeLessThanOrEqual(20);
    }
  });

  it('selected site passes canPlaceBuilding', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator');

    expect(result.ok).toBe(true);
    if (result.ok) {
      const validation = canPlaceBuilding(state, 'separator', result.tx, result.ty);
      expect(validation.valid).toBe(true);
    }
  });

  it('selected site keeps 1-tile gap from HQ footprint', () => {
    // HQ at (5,5), 3x3 footprint → occupies (5,5)-(7,7)
    // With 1-tile gap, no building footprint should overlap (4,4)-(8,8)
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator', { gapTiles: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The selected site's 2x2 footprint must NOT overlap with the
      // HQ footprint expanded by 1 tile in all directions.
      // HQ expanded: (4,4) to (8,8) — i.e., 5x5 starting at (4,4)
      // Site footprint: (tx,ty) to (tx+1,ty+1)
      // No overlap means: site must end before expanded area starts,
      // or start after expanded area ends on at least one axis.
      const hqExpTx = 5 - 1; // 4
      const hqExpTy = 5 - 1; // 4
      const hqExpW = 3 + 2;  // 5
      const hqExpH = 3 + 2;  // 5
      const hqExpEndX = hqExpTx + hqExpW; // 9
      const hqExpEndY = hqExpTy + hqExpH; // 9

      const siteEndX = result.tx + 2;
      const siteEndY = result.ty + 2;

      const overlapsX = result.tx < hqExpEndX && siteEndX > hqExpTx;
      const overlapsY = result.ty < hqExpEndY && siteEndY > hqExpTy;

      expect(overlapsX && overlapsY).toBe(false);
    }
  });

  it('skips resources', () => {
    // Place a resource directly in the most likely build area near HQ
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 5, hqTy: 5,
      resources: [{ tx: 9, ty: 5, footprint: 1 }],
    });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The selected site's 2x2 footprint must not include (9,5)
      const coversResource =
        result.tx <= 9 && result.tx + 2 > 9 &&
        result.ty <= 5 && result.ty + 2 > 5;
      expect(coversResource).toBe(false);
    }
  });

  it('skips building footprints', () => {
    // Place an existing building that would block the nearest candidate
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 5, hqTy: 5,
      buildings: [{ tx: 9, ty: 5 }],
    });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Site must not overlap existing building at (9,5) 2x2 → (9,5)-(10,6)
      const validation = canPlaceBuilding(state, 'separator', result.tx, result.ty);
      expect(validation.valid).toBe(true);

      // Also check gap: site must not overlap building footprint expanded by gap
      const fp = BUILDING_CONFIG['separator']!;
      // Existing building footprint: (9,5) to (10,6)
      // With gap=1, expanded: (8,4) to (11,7)
      const expTx = 9 - 1;
      const expTy = 5 - 1;
      const expEndX = 9 + fp.footprintW + 1; // 12
      const expEndY = 5 + fp.footprintH + 1; // 8
      const siteEndX = result.tx + fp.footprintW;
      const siteEndY = result.ty + fp.footprintH;

      const overlapsX = result.tx < expEndX && siteEndX > expTx;
      const overlapsY = result.ty < expEndY && siteEndY > expTy;
      expect(overlapsX && overlapsY).toBe(false);
    }
  });

  it('skips construction site footprints', () => {
    // Place an active construction site near the expected build area
    const state = makeTestState({
      mapW: 20, mapH: 20, hqTx: 5, hqTy: 5,
      constructionSites: [{ tx: 9, ty: 5 }],
    });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Site must not overlap construction site and must maintain gap
      // Construction site at (9,5) with 2x2 footprint
      // With gap=1, expanded: (8,4) to (11,7)
      const expTx = 9 - 1;
      const expTy = 5 - 1;
      const expEndX = 9 + 2 + 1; // 12
      const expEndY = 5 + 2 + 1; // 8
      const siteEndX = result.tx + 2;
      const siteEndY = result.ty + 2;

      const overlapsX = result.tx < expEndX && siteEndX > expTx;
      const overlapsY = result.ty < expEndY && siteEndY > expTy;
      expect(overlapsX && overlapsY).toBe(false);
    }
  });

  it('returns deterministic result', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });

    const results = Array.from({ length: 5 }, () =>
      findBuildSiteNearPlayerBuildings(state, 'separator')
    );

    // All calls must return the same position
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('returns no-valid-site when surrounded/blocked', () => {
    // Small map where HQ fills almost everything — no room for 2x2 with gap
    // Map is 5x5, HQ at (0,0) with 3x3 footprint → occupies (0,0)-(2,2)
    // With gap=1, expanded: (-1,-1)-(3,3) → tiles (0,0)-(3,3) blocked
    // Remaining area: (3,3)-(4,4) = 2x2, but need 2x2 building
    // Actually (3,3) with 2x2 would be (3,3)-(4,4) — that's in bounds.
    // But gap from HQ: expanded HQ is (-1,-1) to (3,3), site at (3,3)-(4,4)
    // overlaps (3,3) with expanded. So blocked.
    //
    // Make an even more constrained map: 4x4, HQ at (0,0) 3x3
    // Only free tile is (3,3) which can't fit 2x2
    const state = makeTestState({ mapW: 4, mapH: 4, hqTx: 0, hqTy: 0, matter: 500 });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator', { gapTiles: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no-valid-site');
    }
  });

  it('returns unknown-building-type for unconfigured building', () => {
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });
    const result = findBuildSiteNearPlayerBuildings(state, 'command-relay');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown-building-type');
    }
  });

  it('respects maxRadius option', () => {
    // Large map with HQ at center; very small maxRadius should find nothing
    // if the immediate vicinity is blocked
    const state = makeTestState({
      mapW: 40, mapH: 40, hqTx: 20, hqTy: 20,
      resources: [
        // Block all tiles near HQ with resources
        { tx: 24, ty: 20, footprint: 1 },
        { tx: 20, ty: 24, footprint: 1 },
        { tx: 24, ty: 24, footprint: 1 },
      ],
    });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator', { maxRadius: 2 });

    // With maxRadius=2, very few candidates near HQ center (21,21) —
    // and those are all within the HQ gap zone or blocked.
    // This should fail since radius 2 from HQ center is very small.
    expect(result.ok).toBe(false);
  });

  it('gapTiles=0 allows adjacent placement', () => {
    // With gapTiles=0, a building can be placed right next to HQ
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5 });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator', { gapTiles: 0 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The site just needs to pass canPlaceBuilding (no overlap with HQ footprint)
      const validation = canPlaceBuilding(state, 'separator', result.tx, result.ty);
      expect(validation.valid).toBe(true);

      // With gap=0, the site could be immediately adjacent to HQ
      // e.g., at (8,5) which is right next to HQ's (5,5)-(7,7)
    }
  });

  it('prefers sites closer to anchors', () => {
    // On a clear map, the nearest valid site should be closer to HQ
    // than any farther site
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 10, hqTy: 10 });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator', { gapTiles: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // HQ center is at (11,11). The nearest valid 2x2 site with gap=1
      // from a 3x3 HQ at (10,10)-(12,12) would be right outside the gap zone.
      // HQ expanded by 1: (9,9)-(13,13).
      // Nearest 2x2 outside: could be (9,7), (14,9), etc.
      // Distance from candidate center to (11,11):
      const cx = result.tx + 1;
      const cy = result.ty + 1;
      const dist = Math.abs(cx - 11) + Math.abs(cy - 11);

      // Should be reasonably close — certainly less than 10 tiles
      expect(dist).toBeLessThan(10);
    }
  });

  it('finds site near existing building when no closer to HQ', () => {
    // Place a building far from HQ; the system should find a site near it too
    const state = makeTestState({
      mapW: 30, mapH: 30, hqTx: 0, hqTy: 0,
      buildings: [{ tx: 20, ty: 20 }],
    });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator', { gapTiles: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Site should be near either HQ or the building at (20,20)
      const hqDist = Math.abs(result.tx + 1 - 1) + Math.abs(result.ty + 1 - 1);
      const bldDist = Math.abs(result.tx + 1 - 21) + Math.abs(result.ty + 1 - 21);
      // Should be closer to one of the anchors than the maxRadius
      expect(Math.min(hqDist, bldDist)).toBeLessThanOrEqual(30);
    }
  });

  it('returns no-valid-site when matter insufficient', () => {
    // The search should still find a site position (canPlaceBuilding checks resources),
    // but with 0 matter, canPlaceBuilding returns insufficient-resources
    const state = makeTestState({ mapW: 20, mapH: 20, hqTx: 5, hqTy: 5, matter: 0 });
    const result = findBuildSiteNearPlayerBuildings(state, 'separator');

    // Since canPlaceBuilding rejects all sites due to insufficient resources,
    // no valid site should be found
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no-valid-site');
    }
  });
});
