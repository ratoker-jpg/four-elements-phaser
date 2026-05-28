/**
 * Dev arena — pure TypeScript state helpers for QA test arena.
 *
 * ARCH-12A: Provides a minimal fixed arena MapData and URL param
 * activation helper. Pure TS, no Phaser, no DOM.
 */

import type { MapData, TerrainType } from './types';

/** Arena map ID for getMapDataById. */
export const ARENA_MAP_ID = 'arena1';

/**
 * Check whether arena mode should be active based on URL params.
 * Checks for ?arena=1 (or ?arena=true). Requires ?devtools=1 too.
 */
export function isArenaEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('arena') === '1' || params.get('arena') === 'true';
}

// ─── Arena map preset ────────────────────────────────────────────

/** Create the arena MapData — a small open map with HQ, a few resources, and lots of open space. */
export function createArenaMapData(): MapData {
  const W = 20;
  const H = 20;

  // All sand terrain
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < H; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < W; x++) {
      row.push('sand');
    }
    terrain.push(row);
  }

  return {
    width: W,
    height: H,
    terrain,
    hq: { tx: 3, ty: 3, faction: 'cyan' },
    resources: [
      { tx: 8, ty: 3, type: 'medium', footprint: 1 },
      { tx: 8, ty: 5, type: 'medium', footprint: 1 },
      { tx: 3, ty: 8, type: 'small', footprint: 1 },
      { tx: 5, ty: 8, type: 'small', footprint: 1 },
      { tx: 12, ty: 12, type: 'infinite', footprint: 3 },
    ],
    obstacles: [],
    decor: [],
    buildings: [],
    builders: [
      {
        id: 'builder-0',
        tx: 2,
        ty: 2,
        busy: false,
        phase: 'idle',
        path: [],
        pathIndex: 0,
        ftx: 2.5,
        fty: 2.5,
        targetTx: 2,
        targetTy: 2,
        assignedSiteId: -1,
      },
    ],
    constructionSites: [],
  };
}

/**
 * Dev reset command — resets the arena state by returning a fresh arena MapData.
 * Pure function — GameScene will use this to create a new GameState.
 */
export function devResetArena(): MapData {
  return createArenaMapData();
}
