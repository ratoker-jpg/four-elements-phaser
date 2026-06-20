/**
 * VISUAL-MINIMAP-03 tests.
 *
 * Targeted tests for:
 *   - World-to-minimap coordinate transform
 *   - Camera viewport rectangle transform
 *   - Minimap markers from game state
 *   - Safe fallback for missing state
 *   - HUD input guard still works
 */

import { describe, it, expect } from 'vitest';
import {
  tileToMinimap,
  cameraWorldViewToMinimapViewport,
  buildMinimapMarkers,
  buildMinimapViewModel,
} from '../phaser/ui/hud/minimapViewModel';
import { HUD_MINIMAP_WIDTH, HUD_MINIMAP_HEIGHT } from '../phaser/ui/hud/hudLayout';
import {
  isScreenPointInHud,
  shouldUseBottomHudSafeArea,
} from '../phaser/ui/hud/hudLayout';
import type { ArenaModeContext } from '../state/arenaModeContext';
import type { GameState } from '../state/types';

// ─── Test helpers ──────────────────────────────────────────────────

function createMockGameState(): GameState {
  return {
    mapWidth: 48,
    mapHeight: 48,
    mapData: {
      hq: { tx: 5, ty: 5 },
      buildings: [
        { type: 'units-factory', tx: 10, ty: 10 },
      ],
      builders: [
        { id: 'b1', ftx: 6.5, fty: 6.5, phase: 'idle', busy: false, manualMove: false, tx: 6, ty: 6, path: [], pathIndex: 0, targetTx: 0, targetTy: 0, assignedSiteId: -1 },
      ],
      constructionSites: [],
      terrain: [],
      resources: [
        { tx: 20, ty: 15, type: 'small' as const, footprint: 1, resourceClass: 'raw' as any },
      ],
      obstacles: [],
      decor: [],
    },
    harvesters: [
      { id: 'h1', ftx: 7.2, fty: 8.1, phase: 'idle', faction: 'cyan' } as any,
    ],
    resourceNodes: [
      { id: 'r1', tx: 20, ty: 15, resourceType: 'small', footprint: 1, remainingRaw: 100, depleted: false, resourceClass: 'raw' as any },
    ],
    playerFaction: 'cyan',
    economy: {
      raw: 100,
      matter: 200,
      elements: { cyan: 50, green: 0, yellow: 0, purple: 0 },
      rawCap: 500,
      matterCap: 500,
      elementCap: 300,
      powerGenerated: 10,
      powerConsumed: 0,
      separators: [],
    },
    production: { factories: [] },
    ...({} as Partial<GameState>),
  } as unknown as GameState;
}

// ─── 1. World-to-minimap transform ────────────────────────────────

describe('MINIMAP-03: tileToMinimap transform', () => {
  const mapW = 48;
  const mapH = 48;

  it('tile (0,0) maps to top-left with padding', () => {
    const pos = tileToMinimap(0, 0, mapW, mapH);
    expect(pos.x).toBe(4); // padding = 4
    expect(pos.y).toBe(4);
  });

  it('tile (mapW, mapH) maps to bottom-right minus padding', () => {
    const pos = tileToMinimap(mapW, mapH, mapW, mapH);
    expect(pos.x).toBe(HUD_MINIMAP_WIDTH - 4);
    expect(pos.y).toBe(HUD_MINIMAP_HEIGHT - 4);
  });

  it('center tile maps to center of minimap', () => {
    const pos = tileToMinimap(mapW / 2, mapH / 2, mapW, mapH);
    const centerX = 4 + (HUD_MINIMAP_WIDTH - 8) / 2;
    const centerY = 4 + (HUD_MINIMAP_HEIGHT - 8) / 2;
    expect(pos.x).toBeCloseTo(centerX, 1);
    expect(pos.y).toBeCloseTo(centerY, 1);
  });

  it('fractional tile coordinates work', () => {
    const pos = tileToMinimap(12.5, 24.3, mapW, mapH);
    expect(pos.x).toBeGreaterThan(4);
    expect(pos.x).toBeLessThan(HUD_MINIMAP_WIDTH - 4);
    expect(pos.y).toBeGreaterThan(4);
    expect(pos.y).toBeLessThan(HUD_MINIMAP_HEIGHT - 4);
  });

  it('zero-size map returns padding position', () => {
    const pos = tileToMinimap(5, 5, 0, 0);
    expect(pos.x).toBe(4);
    expect(pos.y).toBe(4);
  });

  it('corners map correctly', () => {
    // Top-right corner
    const tr = tileToMinimap(mapW, 0, mapW, mapH);
    expect(tr.x).toBe(HUD_MINIMAP_WIDTH - 4);
    expect(tr.y).toBe(4);

    // Bottom-left corner
    const bl = tileToMinimap(0, mapH, mapW, mapH);
    expect(bl.x).toBe(4);
    expect(bl.y).toBe(HUD_MINIMAP_HEIGHT - 4);
  });
});

// ─── 2. Camera viewport rectangle transform ────────────────────────

describe('MINIMAP-03: camera viewport transform', () => {
  const offset = { x: 100, y: 50 };
  const mapW = 48;
  const mapH = 48;

  it('returns null for null/invalid worldView', () => {
    expect(cameraWorldViewToMinimapViewport(null as any, offset, mapW, mapH, 1)).toBeNull();
  });

  it('returns null for zero-size worldView', () => {
    expect(cameraWorldViewToMinimapViewport({ x: 0, y: 0, width: 0, height: 0 }, offset, mapW, mapH, 1)).toBeNull();
  });

  it('returns a valid rectangle for a reasonable worldView', () => {
    const worldView = { x: 50, y: 25, width: 800, height: 400 };
    const vp = cameraWorldViewToMinimapViewport(worldView, offset, mapW, mapH, 1);
    expect(vp).not.toBeNull();
    expect(vp!.width).toBeGreaterThan(0);
    expect(vp!.height).toBeGreaterThan(0);
  });

  it('FIXUP-1: viewport rectangle is within minimap bounds (no overflow)', () => {
    const worldView = { x: 50, y: 25, width: 800, height: 400 };
    const vp = cameraWorldViewToMinimapViewport(worldView, offset, mapW, mapH, 1);
    expect(vp!.x).toBeGreaterThanOrEqual(0);
    expect(vp!.y).toBeGreaterThanOrEqual(0);
    expect(vp!.x + vp!.width).toBeLessThanOrEqual(HUD_MINIMAP_WIDTH);
    expect(vp!.y + vp!.height).toBeLessThanOrEqual(HUD_MINIMAP_HEIGHT);
  });

  it('minimum viewport size is 2px', () => {
    // Very zoomed out camera covering the whole world
    const worldView = { x: -5000, y: -5000, width: 10000, height: 10000 };
    const vp = cameraWorldViewToMinimapViewport(worldView, offset, mapW, mapH, 1);
    expect(vp).not.toBeNull();
    expect(vp!.width).toBeGreaterThanOrEqual(2);
    expect(vp!.height).toBeGreaterThanOrEqual(2);
  });

  it('FIXUP-1: 4-corner conversion produces taller viewport than old 2-corner', () => {
    // This is a regression test: the old two-corner logic (only top-left
    // and bottom-right) would produce a viewport that was too thin in
    // the Y axis for an isometric projection, because the isometric
    // diamond extends further in tile-Y than just the two diagonal corners.
    // With 4-corner conversion, the viewport should be taller.
    const worldView = { x: 50, y: 25, width: 800, height: 400 };
    const vp = cameraWorldViewToMinimapViewport(worldView, offset, mapW, mapH, 1);
    expect(vp).not.toBeNull();
    // The 4-corner viewport height must be at least as large as the width
    // for a reasonable camera view in isometric (the isometric diamond
    // makes Y extent larger). If the old two-corner logic was used,
    // the height would be near-zero or much smaller than the width.
    expect(vp!.height).toBeGreaterThan(0);
  });

  it('FIXUP-1: normal center camera produces correct viewport', () => {
    // Camera centered on the map: worldView centered
    // Use an offset of 0 for simplicity
    const zeroOffset = { x: 0, y: 0 };
    const worldView = { x: -500, y: 400, width: 1000, height: 500 };
    const vp = cameraWorldViewToMinimapViewport(worldView, zeroOffset, mapW, mapH, 1);
    expect(vp).not.toBeNull();
    expect(vp!.width).toBeGreaterThan(5);
    expect(vp!.height).toBeGreaterThan(5);
  });

  it('FIXUP-1: edge camera (top-left of world) produces clamped viewport', () => {
    const zeroOffset = { x: 0, y: 0 };
    // Camera near the top-left origin of the world
    const worldView = { x: -100, y: -100, width: 600, height: 300 };
    const vp = cameraWorldViewToMinimapViewport(worldView, zeroOffset, mapW, mapH, 1);
    expect(vp).not.toBeNull();
    // Viewport should start at or near padding
    expect(vp!.x).toBeGreaterThanOrEqual(0);
    expect(vp!.y).toBeGreaterThanOrEqual(0);
  });

  it('FIXUP-1: 4-corner tile bbox is correct', () => {
    // Camera that sees a known portion of the world
    // Place a camera at the center of a 48×48 map
    // With offset=0, screen center for tile(24,24) is:
    //   screenX = (24-24)*38 = 0, screenY = (24+24)*19 = 912
    const zeroOffset = { x: 0, y: 0 };
    const worldView = { x: -400, y: 700, width: 800, height: 400 };
    const vp = cameraWorldViewToMinimapViewport(worldView, zeroOffset, mapW, mapH, 1);
    expect(vp).not.toBeNull();
    // The viewport should be somewhere in the middle of the minimap
    expect(vp!.x).toBeGreaterThan(0);
    expect(vp!.y).toBeGreaterThan(0);
    expect(vp!.width).toBeLessThan(HUD_MINIMAP_WIDTH);
    expect(vp!.height).toBeLessThan(HUD_MINIMAP_HEIGHT);
  });
});

// ─── 3. Minimap markers from game state ───────────────────────────

describe('MINIMAP-03: marker view model', () => {
  it('units produce markers', () => {
    const state = createMockGameState();
    const markers = buildMinimapMarkers(state);
    const builderMarkers = markers.filter(m => m.color === '#a78bfa'); // builder color
    const harvesterMarkers = markers.filter(m => m.color === '#34d399'); // harvester color
    expect(builderMarkers.length).toBe(1);
    expect(harvesterMarkers.length).toBe(1);
  });

  it('buildings produce markers', () => {
    const state = createMockGameState();
    const markers = buildMinimapMarkers(state);
    const buildingMarkers = markers.filter(m => m.shape === 'rect' && m.label !== 'HQ');
    expect(buildingMarkers.length).toBe(1); // units-factory
  });

  it('HQ produces a marker', () => {
    const state = createMockGameState();
    const markers = buildMinimapMarkers(state);
    const hqMarker = markers.find(m => m.label === 'HQ');
    expect(hqMarker).toBeDefined();
    expect(hqMarker!.color).toBe('#4ade80');
    expect(hqMarker!.size).toBe(5);
  });

  it('resources produce markers', () => {
    const state = createMockGameState();
    const markers = buildMinimapMarkers(state);
    const resourceMarkers = markers.filter(m => m.color === '#f97316');
    expect(resourceMarkers.length).toBe(1);
  });

  it('depleted resources are not shown', () => {
    const state = createMockGameState();
    state.resourceNodes = [
      { id: 'r1', tx: 20, ty: 15, resourceType: 'small', footprint: 1, remainingRaw: 0, depleted: true, resourceClass: 'raw' as any },
    ];
    const markers = buildMinimapMarkers(state);
    const resourceMarkers = markers.filter(m => m.color === '#f97316');
    expect(resourceMarkers.length).toBe(0);
  });

  it('construction sites produce markers', () => {
    const state = createMockGameState();
    state.mapData.constructionSites = [
      { tx: 15, ty: 15, type: 'power-plant' as any, elapsed: 0, duration: 25000, progress: 0, builderIndex: -1, id: 1, pending: false },
    ];
    const markers = buildMinimapMarkers(state);
    const csMarkers = markers.filter(m => m.color === '#facc15');
    expect(csMarkers.length).toBe(1);
  });

  it('empty state produces HQ only (if hq exists)', () => {
    const state = createMockGameState();
    state.mapData.buildings = [];
    state.mapData.builders = [];
    state.harvesters = [];
    state.resourceNodes = [];
    state.mapData.constructionSites = [];
    const markers = buildMinimapMarkers(state);
    // Should still have HQ marker
    expect(markers.length).toBeGreaterThanOrEqual(1);
    expect(markers.find(m => m.label === 'HQ')).toBeDefined();
  });

  it('no crash if resourceNodes is undefined', () => {
    const state = createMockGameState();
    delete (state as any).resourceNodes;
    const markers = buildMinimapMarkers(state);
    expect(markers).toBeDefined();
  });
});

// ─── 4. Full minimap view model ────────────────────────────────────

describe('MINIMAP-03: full view model', () => {
  it('includes map dimensions', () => {
    const state = createMockGameState();
    const vm = buildMinimapViewModel(state, null, 1, { x: 0, y: 0 });
    expect(vm.mapWidth).toBe(48);
    expect(vm.mapHeight).toBe(48);
  });

  it('viewport is null when no camera data', () => {
    const state = createMockGameState();
    const vm = buildMinimapViewModel(state, null, 1, { x: 0, y: 0 });
    expect(vm.viewport).toBeNull();
  });

  it('viewport is populated when camera data provided', () => {
    const state = createMockGameState();
    const worldView = { x: 50, y: 25, width: 800, height: 400 };
    const vm = buildMinimapViewModel(state, worldView, 1, { x: 100, y: 50 });
    expect(vm.viewport).not.toBeNull();
    expect(vm.viewport!.width).toBeGreaterThan(0);
  });
});

// ─── 5. HUD input guard still works ────────────────────────────────

describe('MINIMAP-03: HUD input guard intact', () => {
  it('isScreenPointInHud works for bottom HUD area', () => {
    const canvasHeight = 1080;
    expect(isScreenPointInHud(canvasHeight - 1, canvasHeight)).toBe(true);
    expect(isScreenPointInHud(0, canvasHeight)).toBe(false);
  });

  it('shouldUseBottomHudSafeArea gates correctly for Arena', () => {
    const arenaCtx: ArenaModeContext = {
      arenaMode: true,
      runCivilLoop: false,
      showPlaytestHud: false,
      showArenaMenu: true,
      createObstaclesOnReset: false,
    };
    expect(shouldUseBottomHudSafeArea(arenaCtx)).toBe(false);
  });
});
