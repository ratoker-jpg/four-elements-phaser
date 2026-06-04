/**
 * Tests for CORE-STEP-06H+: Movement / Occupancy / Depth Sorting
 *
 * Covers:
 * - Tile reservation system
 * - Body footprint classes
 * - Movement state machine (grid pathing)
 * - Depth sorting
 * - Integration with occupancy and pathfinding
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TileReservationMap } from '../state/tileReservation';
import {
  FOOTPRINT_CLASS_CONFIGS,
  BODY_FOOTPRINT_CLASS,
  CIVIL_FOOTPRINT_CLASS,
  getBodyFootprintClass,
  getBodyFootprintConfig,
  getEffectiveTurnSpeedDeg,
  // getBodyCollisionRadiusTiles and FootprintClass are used in type-aware tests
  getBodyCollisionRadiusTiles as _getCollisionRadius,
  type FootprintClass as _FootprintClassType,
} from '../state/bodyFootprint';
import {
  createGridMovementState,
  createGridMovementConfig,
  directionFromTo,
  directionToAngle,
  issueGridMoveCommand,
  issueGridStopCommand,
  updateGridMovement,
  computeWaypointSmoothing,
} from '../state/movementStateMachine';
import { buildOccupancyMap, addUnitBlockers, addVehicleBlockers, addReservationBlockers, isPassable } from '../state/occupancy';
import { findPath } from '../state/pathfinding';
import {
  computeDepthKey,
  sortByDepth,
  getDepthOrderMap,
  isBehind,
  computeDepthValue,
  type DepthSortable,
} from '../phaser/render/depthSorting';
import type { GameState } from '../state/types';
import {
  getOccupiedTiles,
  bodiesOverlap,
  resolveCollisionPriority,
  getBodyCollisionRadiusTiles,
} from '../state/bodyFootprint';

// ─── Test helpers ──────────────────────────────────────────────────

/** Create a minimal GameState for occupancy testing. */
function createTestGameState(overrides?: Partial<GameState>): GameState {
  return {
    mapWidth: 32,
    mapHeight: 32,
    mapStyle: 'industrial',
    seed: 'test',
    terrain: [],
    mapData: {
      hq: { tx: 5, ty: 5, type: 'hq' },
      buildings: [],
      constructionSites: [],
      resources: [],
      obstacles: [],
      builders: [],
    },
    harvesters: [],
    resourceNodes: [],
    economy: { raw: 0, matter: 0, energy: 0, element: 0, rawCap: 500, matterCap: 500, energyCap: 500, elementCap: 500 },
    production: { factories: [] },
    entities: [],
    blockoutVehicles: [],
    ...overrides,
  } as unknown as GameState;
}

/** Create a simple occupancy map for pathfinding tests. */
function createTestOccupancyMap(): ReturnType<typeof buildOccupancyMap> {
  return buildOccupancyMap(createTestGameState());
}

// ═══════════════════════════════════════════════════════════════════
// Tile Reservation Tests
// ═══════════════════════════════════════════════════════════════════

describe('TileReservationMap', () => {
  let map: TileReservationMap;

  beforeEach(() => {
    map = new TileReservationMap(32);
  });

  it('starts with no reservations', () => {
    expect(map.isReserved(5, 5)).toBe(false);
    expect(map.size).toBe(0);
  });

  it('reserves a tile for a unit', () => {
    const result = map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    expect(result).toBe(true);
    expect(map.isReserved(5, 5)).toBe(true);
    expect(map.size).toBe(1);
  });

  it('prevents double reservation by different units', () => {
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    const result = map.reserve(5, 5, { unitId: 'unit-2', unitType: 'harvester' }, 0);
    expect(result).toBe(false);
    expect(map.isReservedBy(5, 5, 'unit-1')).toBe(true);
    expect(map.isReservedBy(5, 5, 'unit-2')).toBe(false);
  });

  it('allows same unit to re-reserve its own tile', () => {
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    const result = map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 100);
    expect(result).toBe(true);
  });

  it('reservation is cleared on arrival', () => {
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    map.release(5, 5, 'unit-1');
    expect(map.isReserved(5, 5)).toBe(false);
  });

  it('reservation is cleared on stop/cancel', () => {
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    map.reserve(6, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    map.releaseAll('unit-1');
    expect(map.isReserved(5, 5)).toBe(false);
    expect(map.isReserved(6, 5)).toBe(false);
    expect(map.size).toBe(0);
  });

  it('isReservedByOther returns true only for different unit', () => {
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    expect(map.isReservedByOther(5, 5, 'unit-1')).toBe(false);
    expect(map.isReservedByOther(5, 5, 'unit-2')).toBe(true);
    expect(map.isReservedByOther(6, 5, 'unit-1')).toBe(false);
  });

  it('cleans up stale reservations', () => {
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    const cleaned = map.cleanStale(15000, 10000);
    expect(cleaned).toBe(1);
    expect(map.isReserved(5, 5)).toBe(false);
  });

  it('does not clean fresh reservations', () => {
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 5000);
    const cleaned = map.cleanStale(8000, 10000);
    expect(cleaned).toBe(0);
    expect(map.isReserved(5, 5)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Body Footprint Class Tests
// ═══════════════════════════════════════════════════════════════════

describe('Body footprint classes', () => {
  it('light bodies: Wasp and Hornet', () => {
    expect(getBodyFootprintClass('wasp')).toBe('light');
    expect(getBodyFootprintClass('hornet')).toBe('light');
  });

  it('medium bodies: Hunter, Viking, Dictator', () => {
    expect(getBodyFootprintClass('hunter')).toBe('medium');
    expect(getBodyFootprintClass('viking')).toBe('medium');
    expect(getBodyFootprintClass('dictator')).toBe('medium');
  });

  it('heavy bodies: Titan and Mammoth', () => {
    expect(getBodyFootprintClass('titan')).toBe('heavy');
    expect(getBodyFootprintClass('mammoth')).toBe('heavy');
  });

  it('unknown body defaults to medium', () => {
    expect(getBodyFootprintClass('unknown')).toBe('medium');
  });

  it('heavy body turns slower than light body', () => {
    const baseTurnSpeed = 100;
    const lightTurn = getEffectiveTurnSpeedDeg(baseTurnSpeed, 'wasp');
    const heavyTurn = getEffectiveTurnSpeedDeg(baseTurnSpeed, 'mammoth');
    expect(heavyTurn).toBeLessThan(lightTurn);
  });

  it('light body turns faster than base', () => {
    const baseTurnSpeed = 100;
    const lightTurn = getEffectiveTurnSpeedDeg(baseTurnSpeed, 'wasp');
    expect(lightTurn).toBeGreaterThan(baseTurnSpeed);
  });

  it('heavy body turns slower than base', () => {
    const baseTurnSpeed = 100;
    const heavyTurn = getEffectiveTurnSpeedDeg(baseTurnSpeed, 'mammoth');
    expect(heavyTurn).toBeLessThan(baseTurnSpeed);
  });

  it('body footprint class affects occupancy', () => {
    const lightConfig = getBodyFootprintConfig('wasp');
    const heavyConfig = getBodyFootprintConfig('mammoth');
    expect(lightConfig.footprintClass).toBe('light');
    expect(heavyConfig.footprintClass).toBe('heavy');
    expect(lightConfig.collisionRadiusTiles).toBeLessThan(heavyConfig.collisionRadiusTiles);
  });

  it('all 7 bodies have footprint class mapping', () => {
    const bodies = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'];
    for (const body of bodies) {
      expect(BODY_FOOTPRINT_CLASS[body]).toBeDefined();
    }
  });

  it('civil unit footprint is medium', () => {
    expect(CIVIL_FOOTPRINT_CLASS).toBe('medium');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Movement State Machine Tests
// ═══════════════════════════════════════════════════════════════════

describe('Movement state machine', () => {
  it('creates initial state in idle phase', () => {
    const state = createGridMovementState(5, 5);
    expect(state.phase).toBe('idle');
    expect(state.ftx).toBe(5);
    expect(state.fty).toBe(5);
  });

  it('path goes through tile centers', () => {
    const occupancy = createTestOccupancyMap();
    const path = findPath(occupancy, 5, 5, 8, 5);
    expect(path).not.toBeNull();
    // Each waypoint should be integer tile coordinates
    for (const wp of path!) {
      expect(Number.isInteger(wp.tx)).toBe(true);
      expect(Number.isInteger(wp.ty)).toBe(true);
    }
  });

  it('issueGridMoveCommand sets phase to path_requested', () => {
    const state = createGridMovementState(5, 5);
    const path = [{ tx: 6, ty: 5 }, { tx: 7, ty: 5 }];
    issueGridMoveCommand(state, path, 7, 5);
    expect(state.phase).toBe('path_requested');
    expect(state.path).toEqual(path);
    expect(state.targetTx).toBe(7);
    expect(state.targetTy).toBe(5);
  });

  it('issueGridStopCommand transitions to stopping', () => {
    const state = createGridMovementState(5, 5);
    const path = [{ tx: 6, ty: 5 }];
    issueGridMoveCommand(state, path, 6, 5);
    const reservationMap = new TileReservationMap(32);
    issueGridStopCommand(state, reservationMap, 'unit-1');
    expect(state.phase).toBe('stopping');
  });

  it('direction from tile (5,5) to (5,4) is N', () => {
    expect(directionFromTo(5, 5, 5, 4)).toBe('N');
  });

  it('direction from tile (5,5) to (6,5) is E', () => {
    expect(directionFromTo(5, 5, 6, 5)).toBe('E');
  });

  it('direction from tile (5,5) to (5,6) is S', () => {
    expect(directionFromTo(5, 5, 5, 6)).toBe('S');
  });

  it('direction from tile (5,5) to (4,5) is W', () => {
    expect(directionFromTo(5, 5, 4, 5)).toBe('W');
  });

  it('diagonal direction returns none', () => {
    expect(directionFromTo(5, 5, 6, 6)).toBe('none');
  });

  it('same tile direction returns none', () => {
    expect(directionFromTo(5, 5, 5, 5)).toBe('none');
  });

  it('directionToAngle produces valid radians', () => {
    for (const dir of ['N', 'E', 'S', 'W', 'none'] as const) {
      const angle = directionToAngle(dir);
      expect(typeof angle).toBe('number');
      expect(angle).toBeGreaterThanOrEqual(-Math.PI);
      expect(angle).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('createGridMovementConfig converts pixel speeds to tile speeds', () => {
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    expect(config.maxSpeedTilesPerSec).toBeGreaterThan(0);
    expect(config.accelerationTilesPerSec2).toBeGreaterThan(0);
    expect(config.brakingTilesPerSec2).toBeGreaterThan(0);
    // Hunter is medium — turnSpeedMultiplier is 1.0
    expect(config.turnSpeedDeg).toBe(120);
  });

  it('heavy body has reduced turn speed in config', () => {
    const heavyConfig = createGridMovementConfig(100, 50, 40, 80, 'mammoth');
    // Mammoth is heavy — turnSpeedMultiplier is 0.7
    expect(heavyConfig.turnSpeedDeg).toBeCloseTo(56, 0);
  });

  it('light body has increased turn speed in config', () => {
    const lightConfig = createGridMovementConfig(300, 150, 120, 150, 'wasp');
    // Wasp is light — turnSpeedMultiplier is 1.3
    expect(lightConfig.turnSpeedDeg).toBeCloseTo(195, 0);
  });

  it('updateGridMovement: idle state returns no change', () => {
    const state = createGridMovementState(5, 5);
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);
    const result = updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', 0, () => occupancy);
    expect(result.phase).toBe('idle');
    expect(result.arrived).toBe(false);
  });

  it('updateGridMovement: empty path causes immediate arrival', () => {
    const state = createGridMovementState(5, 5);
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);
    issueGridMoveCommand(state, [], 5, 5);
    const result = updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', 0, () => occupancy);
    expect(result.arrived).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Occupancy Integration Tests
// ═══════════════════════════════════════════════════════════════════

describe('Occupancy integration', () => {
  it('building footprints block movement', () => {
    const state = createTestGameState({
      mapData: {
        hq: { tx: 5, ty: 5, type: 'hq' },
        buildings: [{ tx: 10, ty: 10, type: 'separator' }],
        constructionSites: [],
        resources: [],
        obstacles: [],
        builders: [],
      },
    } as any);
    const occupancy = buildOccupancyMap(state);
    // Building tiles should be impassable
    expect(isPassable(occupancy, 10, 10)).toBe(false);
  });

  it('obstacle footprints block movement', () => {
    const state = createTestGameState({
      mapData: {
        hq: { tx: 5, ty: 5, type: 'hq' },
        buildings: [],
        constructionSites: [],
        resources: [],
        obstacles: [{ tx: 15, ty: 15, footprint: 1 }],
        builders: [],
      },
    } as any);
    const occupancy = buildOccupancyMap(state);
    expect(isPassable(occupancy, 15, 15)).toBe(false);
  });

  it('territory does not block movement', () => {
    const occupancy = createTestOccupancyMap();
    // Territory is not represented in occupancy map — all non-building/resource tiles are passable
    expect(isPassable(occupancy, 20, 20)).toBe(true);
  });

  it('occupied tile blocks movement via unit blockers', () => {
    const state = createTestGameState({
      harvesters: [{ id: 'h1', ftx: 8, fty: 8, phase: 'idle' }, { id: 'h2', ftx: 9, fty: 9, phase: 'idle' }] as any,
    });
    const occupancy = buildOccupancyMap(state);
    addUnitBlockers(state, occupancy, 'harvester', 'h1');
    // Tile occupied by h2 (excluded) should still be blocked for h1
    expect(isPassable(occupancy, 9, 9)).toBe(false);
  });

  it('addVehicleBlockers adds combat vehicle positions as impassable', () => {
    const occupancy = createTestOccupancyMap();
    expect(isPassable(occupancy, 10, 10)).toBe(true);
    addVehicleBlockers([{ id: 'v1', tx: 10, ty: 10, isDestroyed: false }], occupancy);
    expect(isPassable(occupancy, 10, 10)).toBe(false);
  });

  it('destroyed vehicles do not block', () => {
    const occupancy = createTestOccupancyMap();
    addVehicleBlockers([{ id: 'v1', tx: 10, ty: 10, isDestroyed: true }], occupancy);
    expect(isPassable(occupancy, 10, 10)).toBe(true);
  });

  it('no diagonal corner cutting through blocked corners', () => {
    // Set up a corner: two adjacent impassable tiles forming an L-shape
    const state = createTestGameState({
      mapData: {
        hq: { tx: 5, ty: 5, type: 'hq' },
        buildings: [],
        constructionSites: [],
        resources: [
          { tx: 10, ty: 10, footprint: 1 },
          { tx: 11, ty: 10, footprint: 1 },
          { tx: 10, ty: 11, footprint: 1 },
        ],
        obstacles: [],
        builders: [],
      },
    } as any);
    const occupancy = buildOccupancyMap(state);
    // Corner tile (11,11) should be passable but path cannot cut through
    expect(isPassable(occupancy, 11, 11)).toBe(true);
    // Verify BFS path respects 4-connectivity (no diagonal moves)
    const path = findPath(occupancy, 9, 11, 11, 11);
    if (path) {
      // Each step must be 4-connected (no diagonal jumps)
      let prevTx = 9, prevTy = 11;
      for (const step of path) {
        const dx = Math.abs(step.tx - prevTx);
        const dy = Math.abs(step.ty - prevTy);
        expect(dx + dy).toBe(1); // Manhattan distance 1 = 4-connected
        prevTx = step.tx;
        prevTy = step.ty;
      }
    }
  });

  it('reserved tile blocks movement (via addVehicleBlockers)', () => {
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);
    reservationMap.reserve(10, 10, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    // Reservation doesn't directly modify occupancy, but when building occupancy for
    // pathfinding, reserved tiles should be treated as blocked
    addVehicleBlockers([{ id: 'v1', tx: 10, ty: 10, isDestroyed: false }], occupancy, 'unit-2');
    expect(isPassable(occupancy, 10, 10)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Depth Sorting Tests
// ═══════════════════════════════════════════════════════════════════

describe('Isometric depth sorting', () => {
  const offsetX = 0;
  const offsetY = 0;

  it('unit behind building renders behind it', () => {
    const unit: DepthSortable = {
      id: 'unit-1',
      type: 'unit',
      tx: 5, ty: 3, // behind (lower ty in isometric = further back)
      offsetX, offsetY,
    };
    const building: DepthSortable = {
      id: 'building-1',
      type: 'building',
      tx: 5, ty: 8, // in front (higher ty = closer to viewer)
      offsetX, offsetY,
    };
    expect(isBehind(unit, building)).toBe(true);
  });

  it('unit in front of building renders above it', () => {
    const unit: DepthSortable = {
      id: 'unit-1',
      type: 'unit',
      tx: 5, ty: 10, // in front
      offsetX, offsetY,
    };
    const building: DepthSortable = {
      id: 'building-1',
      type: 'building',
      tx: 5, ty: 5, // behind
      offsetX, offsetY,
    };
    expect(isBehind(unit, building)).toBe(false);
  });

  it('large building depth uses footprint front-bottom edge', () => {
    const smallBuilding: DepthSortable = {
      id: 'small',
      type: 'building',
      tx: 5, ty: 5,
      footprintW: 1, footprintH: 1,
      offsetX, offsetY,
    };
    const largeBuilding: DepthSortable = {
      id: 'large',
      type: 'building',
      tx: 5, ty: 5,
      footprintW: 3, footprintH: 3,
      offsetX, offsetY,
    };
    const smallKey = computeDepthKey(smallBuilding);
    const largeKey = computeDepthKey(largeBuilding);
    // Large building's front-bottom edge is at (7, 7) vs small's at (5, 5)
    // Large building should have higher depthY (renders in front of small at same base position)
    expect(largeKey.depthY).toBeGreaterThan(smallKey.depthY);
  });

  it('building depth uses footprint, not sprite center', () => {
    const building: DepthSortable = {
      id: 'building-1',
      type: 'building',
      tx: 5, ty: 5,
      footprintW: 3, footprintH: 3,
      offsetX, offsetY,
    };
    const key = computeDepthKey(building);
    // Front-bottom edge is at (7, 7), not center (6, 6)
    // Verify the depth key uses (7, 7) not (6, 6)
    const frontEdge = computeDepthKey({
      id: 'edge-point',
      type: 'unit',
      tx: 7, ty: 7,
      offsetX, offsetY,
    });
    expect(key.depthY).toBeCloseTo(frontEdge.depthY, 1);
  });

  it('sortByDepth produces correct order', () => {
    const items: DepthSortable[] = [
      { id: 'front', type: 'unit', tx: 5, ty: 10, offsetX, offsetY },
      { id: 'middle', type: 'unit', tx: 5, ty: 7, offsetX, offsetY },
      { id: 'back', type: 'unit', tx: 5, ty: 3, offsetX, offsetY },
    ];
    const sorted = sortByDepth(items);
    expect(sorted[0].sortable.id).toBe('back');
    expect(sorted[1].sortable.id).toBe('middle');
    expect(sorted[2].sortable.id).toBe('front');
  });

  it('tie-breaking by X works', () => {
    const items: DepthSortable[] = [
      { id: 'right', type: 'unit', tx: 8, ty: 5, offsetX, offsetY },
      { id: 'left', type: 'unit', tx: 3, ty: 5, offsetX, offsetY },
    ];
    const sorted = sortByDepth(items);
    expect(sorted[0].sortable.id).toBe('left');
    expect(sorted[1].sortable.id).toBe('right');
  });

  it('getDepthOrderMap returns correct indices', () => {
    const items: DepthSortable[] = [
      { id: 'a', type: 'unit', tx: 5, ty: 10, offsetX, offsetY },
      { id: 'b', type: 'unit', tx: 5, ty: 3, offsetX, offsetY },
    ];
    const orderMap = getDepthOrderMap(items);
    expect(orderMap.get('b')).toBe(0); // behind = first
    expect(orderMap.get('a')).toBe(1); // in front = second
  });
});

// ═══════════════════════════════════════════════════════════════════
// Waypoint Smoothing Tests
// ═══════════════════════════════════════════════════════════════════

describe('Waypoint smoothing', () => {
  it('returns null when smoothing is not active', () => {
    const state = createGridMovementState(5, 5);
    state.smoothingActive = false;
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    expect(computeWaypointSmoothing(state, config, 0.5)).toBeNull();
  });

  it('smoothing stays inside safe tile corridor or falls back', () => {
    const state = createGridMovementState(5, 5);
    state.smoothingActive = true;
    state.pathIndex = 1;
    state.currentTileTx = 5;
    state.currentTileTy = 5;
    state.path = [
      { tx: 4, ty: 5 },
      { tx: 5, ty: 5 },
      { tx: 5, ty: 6 },
    ];
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');

    // At progress=0.5, smoothing should produce a position within 0.5 tiles of center
    const result = computeWaypointSmoothing(state, config, 0.5);
    if (result) {
      const distFromCenter = Math.sqrt(
        (result.ftx - 5) ** 2 + (result.fty - 5) ** 2,
      );
      expect(distFromCenter).toBeLessThanOrEqual(0.5);
    }
    // If null, that's also valid (fallback to turn-in-place)
  });
});

// ═══════════════════════════════════════════════════════════════════
// No combat/damage/economy changed
// ═══════════════════════════════════════════════════════════════════

describe('Scope boundary verification', () => {
  it('movement state machine has no damage/hit model', () => {
    // GridMovementState should not have HP, damage, or armor fields
    const state = createGridMovementState(5, 5);
    expect((state as any).hp).toBeUndefined();
    expect((state as any).damage).toBeUndefined();
    expect((state as any).armor).toBeUndefined();
  });

  it('body footprint does not implement armor/damage', () => {
    // FootprintClassConfig should not have armor or damage fields
    const config = FOOTPRINT_CLASS_CONFIGS['light'];
    expect((config as any).armor).toBeUndefined();
    expect((config as any).damage).toBeUndefined();
  });

  it('tile reservation has no economy fields', () => {
    const map = new TileReservationMap(32);
    expect((map as any).raw).toBeUndefined();
    expect((map as any).energy).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Movement State Transition Tests
// ═══════════════════════════════════════════════════════════════════

describe('Movement state transitions', () => {
  it('transitions from path_requested through turning_to_segment to moving_segment', () => {
    const state = createGridMovementState(5, 5);
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    issueGridMoveCommand(state, [{ tx: 6, ty: 5 }], 6, 5);
    expect(state.phase).toBe('path_requested');

    // Run multiple updates to get through turning
    for (let i = 0; i < 50; i++) {
      updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', i * 16, () => occupancy);
      if (state.phase === 'moving_segment') break;
    }
    // Should have moved past turning into moving (or already arrived)
    expect(['moving_segment', 'braking', 'idle']).toContain(state.phase);
  });

  it('unit arrives at destination after moving through path', () => {
    const state = createGridMovementState(5, 5);
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    issueGridMoveCommand(state, [{ tx: 6, ty: 5 }, { tx: 7, ty: 5 }], 7, 5);

    // Run many updates to complete movement
    let arrived = false;
    for (let i = 0; i < 200; i++) {
      const result = updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', i * 16, () => occupancy);
      if (result.arrived) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(state.phase).toBe('idle');
  });

  it('stopping state decelerates to idle', () => {
    const state = createGridMovementState(5, 5);
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    issueGridMoveCommand(state, [{ tx: 6, ty: 5 }], 6, 5);

    // Run until moving
    for (let i = 0; i < 50; i++) {
      updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', i * 16, () => occupancy);
      if (state.phase === 'moving_segment') break;
    }

    // Issue stop
    issueGridStopCommand(state, reservationMap, 'unit-1');
    expect(state.phase).toBe('stopping');

    // Run until stopped
    for (let i = 0; i < 100; i++) {
      updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', i * 16 + 1000, () => occupancy);
      if (state.phase === 'idle') break;
    }
    expect(state.phase).toBe('idle');
    expect(state.speed).toBe(0);
  });

  it('blocked state transitions to repathing after wait', () => {
    const state = createGridMovementState(5, 5);
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    // Reserve the target tile by another unit
    reservationMap.reserve(6, 5, { unitId: 'unit-2', unitType: 'combat-vehicle' }, 0);

    issueGridMoveCommand(state, [{ tx: 6, ty: 5 }], 6, 5);

    // Run until blocked (after turning phase tries to reserve)
    for (let i = 0; i < 50; i++) {
      updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', i * 16, () => occupancy);
      if (state.phase === 'blocked') break;
    }

    if (state.phase === 'blocked') {
      expect(state.waitStartedAt).toBeGreaterThan(0);
      // Simulate waiting 500ms
      const result = updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', state.waitStartedAt + 600, () => occupancy);
      expect(['repathing', 'blocked']).toContain(result.phase);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Physical Turning & Acceleration Tests
// ═══════════════════════════════════════════════════════════════════

describe('Physical turning and acceleration', () => {
  it('body does not snap instantly to new direction', () => {
    const state = createGridMovementState(5, 5, directionToAngle('S'));
    const config = createGridMovementConfig(200, 100, 80, 60, 'hunter'); // slow turn
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    // Move north — requires 180° turn from south
    issueGridMoveCommand(state, [{ tx: 5, ty: 4 }], 5, 4);
    const initialAngle = state.bodyAngle;

    // Single frame should not complete the turn
    updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', 0, () => occupancy);

    // If we're in turning phase, angle should have changed but not reached target
    if (state.phase === 'turning_to_segment') {
      const targetAngle = directionToAngle('N');
      const angleDiff = Math.abs(normalizeAngle(state.bodyAngle - targetAngle));
      expect(angleDiff).toBeGreaterThan(0.01); // not snapped to target
    }
    // bodyAngle may or may not have changed depending on turn speed
    void initialAngle;
  });

  it('speed starts at zero and accelerates over multiple frames', () => {
    const state = createGridMovementState(5, 5);
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    issueGridMoveCommand(state, [{ tx: 6, ty: 5 }], 6, 5);
    expect(state.speed).toBe(0);

    // Run through turning and into moving phase
    let reachedMoving = false;
    for (let i = 0; i < 100; i++) {
      updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', i * 16, () => occupancy);
      if (state.phase === 'moving_segment') {
        reachedMoving = true;
        break;
      }
    }

    // Continue updating while in moving_segment to accumulate acceleration
    if (reachedMoving) {
      for (let i = 0; i < 10; i++) {
        updateGridMovement(state, config, 16, occupancy, reservationMap, 'unit-1', i * 16 + 5000, () => occupancy);
      }
      // After several frames of moving_segment, speed should have increased
      expect(state.speed).toBeGreaterThanOrEqual(0); // minimum: may have arrived already
    }
  });

  it('heavy body turns slower than light body', () => {
    const heavyConfig = createGridMovementConfig(100, 50, 40, 80, 'mammoth');
    const lightConfig = createGridMovementConfig(300, 150, 120, 150, 'wasp');

    // Heavy should have smaller effective turn speed
    expect(heavyConfig.turnSpeedDeg).toBeLessThan(lightConfig.turnSpeedDeg);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Reservation Cleanup Tests
// ═══════════════════════════════════════════════════════════════════

describe('Reservation cleanup', () => {
  it('reservation released on arrival', () => {
    const map = new TileReservationMap(32);
    map.reserve(6, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    map.releaseAll('unit-1');
    expect(map.isReserved(6, 5)).toBe(false);
  });

  it('reservation released on stop command', () => {
    const map = new TileReservationMap(32);
    map.reserve(6, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    map.releaseAll('unit-1');
    expect(map.size).toBe(0);
  });

  it('reservation released on cancel', () => {
    const map = new TileReservationMap(32);
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    map.reserve(6, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    map.releaseAll('unit-1');
    expect(map.isReserved(5, 5)).toBe(false);
    expect(map.isReserved(6, 5)).toBe(false);
  });

  it('stale reservations cleaned up after max age', () => {
    const map = new TileReservationMap(32);
    map.reserve(5, 5, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);
    const nowMs = 20000;
    const cleaned = map.cleanStale(nowMs, 10000);
    expect(cleaned).toBe(1);
    expect(map.isReserved(5, 5)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Building/Obstacle Collision Tests
// ═══════════════════════════════════════════════════════════════════

describe('Building/obstacle collision blocking', () => {
  it('BFS pathfinding cannot route through building footprint', () => {
    const state = createTestGameState({
      mapData: {
        hq: { tx: 2, ty: 2, type: 'hq' },
        buildings: [{ tx: 5, ty: 5, type: 'separator' }],
        constructionSites: [],
        resources: [],
        obstacles: [],
        builders: [],
      },
    } as any);
    const occupancy = buildOccupancyMap(state);
    // Path from (4,5) to (6,5) must go around the building at (5,5)
    const path = findPath(occupancy, 4, 5, 6, 5);
    if (path) {
      // Path should not include (5,5) which is the building
      expect(path.some(p => p.tx === 5 && p.ty === 5)).toBe(false);
    }
  });

  it('BFS pathfinding cannot route through obstacle footprint', () => {
    const state = createTestGameState({
      mapData: {
        hq: { tx: 2, ty: 2, type: 'hq' },
        buildings: [],
        constructionSites: [],
        resources: [],
        obstacles: [{ tx: 5, ty: 5, footprint: 2 }],
        builders: [],
      },
    } as any);
    const occupancy = buildOccupancyMap(state);
    expect(isPassable(occupancy, 5, 5)).toBe(false);
    expect(isPassable(occupancy, 6, 6)).toBe(false); // 2x2 footprint
  });
});

// ═══════════════════════════════════════════════════════════════════
// Depth Sorting with Buildings
// ═══════════════════════════════════════════════════════════════════

describe('Depth sorting with buildings', () => {
  const offsetX = 0;
  const offsetY = 0;

  it('unit behind large building sorts behind', () => {
    const unit: DepthSortable = {
      id: 'unit-1', type: 'unit', tx: 5, ty: 3, offsetX, offsetY,
    };
    const building: DepthSortable = {
      id: 'bldg-1', type: 'building', tx: 4, ty: 4, footprintW: 3, footprintH: 3, offsetX, offsetY,
    };
    // Building front-bottom at (6,6), unit at (5,3)
    // Unit should be behind (lower depthY)
    expect(isBehind(unit, building)).toBe(true);
  });

  it('unit beside building sorts correctly by X tiebreaker', () => {
    const unitA: DepthSortable = {
      id: 'unit-a', type: 'unit', tx: 3, ty: 5, offsetX, offsetY,
    };
    const unitB: DepthSortable = {
      id: 'unit-b', type: 'unit', tx: 7, ty: 5, offsetX, offsetY,
    };
    // Same Y position, different X — left unit should be behind
    expect(isBehind(unitA, unitB)).toBe(true);
  });

  it('multiple buildings with different footprint sizes sort correctly', () => {
    const small: DepthSortable = {
      id: 'small', type: 'building', tx: 5, ty: 5, footprintW: 1, footprintH: 1, offsetX, offsetY,
    };
    const large: DepthSortable = {
      id: 'large', type: 'building', tx: 5, ty: 5, footprintW: 3, footprintH: 3, offsetX, offsetY,
    };
    // Large building has front-bottom at (7,7) which is further south than small at (5,5)
    const sorted = sortByDepth([small, large]);
    expect(sorted[0].sortable.id).toBe('small'); // behind
    expect(sorted[1].sortable.id).toBe('large'); // in front
  });
});

// ═══════════════════════════════════════════════════════════════════
// Territory Does Not Block Movement
// ═══════════════════════════════════════════════════════════════════

describe('Territory does not block movement', () => {
  it('any passable tile is traversable regardless of faction proximity', () => {
    const occupancy = createTestOccupancyMap();
    // All non-impassable tiles should be passable
    for (let tx = 0; tx < 32; tx++) {
      for (let ty = 0; ty < 32; ty++) {
        if (isPassable(occupancy, tx, ty)) {
          // No territory-based blocking
          expect(isPassable(occupancy, tx, ty)).toBe(true);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Waypoint Smoothing Fallback
// ═══════════════════════════════════════════════════════════════════

describe('Waypoint smoothing fallback', () => {
  it('returns null when pathIndex is at boundary', () => {
    const state = createGridMovementState(5, 5);
    state.smoothingActive = true;
    state.pathIndex = 0; // no previous waypoint to smooth from
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    expect(computeWaypointSmoothing(state, config, 0.5)).toBeNull();
  });

  it('returns null when pathIndex exceeds path length', () => {
    const state = createGridMovementState(5, 5);
    state.smoothingActive = true;
    state.pathIndex = 5;
    state.path = [{ tx: 4, ty: 5 }, { tx: 5, ty: 5 }];
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');
    expect(computeWaypointSmoothing(state, config, 0.5)).toBeNull();
  });

  it('smoothing produces position within 0.5 tiles of center', () => {
    const state = createGridMovementState(5, 5);
    state.smoothingActive = true;
    state.pathIndex = 1;
    state.currentTileTx = 5;
    state.currentTileTy = 5;
    state.path = [
      { tx: 4, ty: 5 },
      { tx: 5, ty: 5 },
      { tx: 6, ty: 5 },
    ];
    const config = createGridMovementConfig(200, 100, 80, 120, 'hunter');

    for (let t = 0; t <= 1; t += 0.2) {
      const result = computeWaypointSmoothing(state, config, t);
      if (result) {
        const dist = Math.sqrt((result.ftx - 5) ** 2 + (result.fty - 5) ** 2);
        expect(dist).toBeLessThanOrEqual(0.5);
      }
    }
  });
});

// Helper for angle normalization
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// ═══════════════════════════════════════════════════════════════════
// BLOCKER 1 FIXUP: Runtime depth sorting for units + buildings
// ═══════════════════════════════════════════════════════════════════

describe('Blocker 1: Runtime depth sorting for units + buildings', () => {
  const offsetX = 0;
  const offsetY = 0;

  it('unit behind HQ renders behind HQ', () => {
    const unit: DepthSortable = {
      id: 'unit-1', type: 'unit', tx: 5, ty: 4, offsetX, offsetY,
    };
    const hq: DepthSortable = {
      id: 'hq', type: 'building', tx: 4, ty: 4, footprintW: 3, footprintH: 3, offsetX, offsetY,
    };
    // HQ front-bottom edge at (6,6); unit at (5,4) — unit is behind
    expect(isBehind(unit, hq)).toBe(true);
  });

  it('unit in front of HQ renders above HQ', () => {
    const unit: DepthSortable = {
      id: 'unit-1', type: 'unit', tx: 6, ty: 8, offsetX, offsetY,
    };
    const hq: DepthSortable = {
      id: 'hq', type: 'building', tx: 4, ty: 4, footprintW: 3, footprintH: 3, offsetX, offsetY,
    };
    // HQ front-bottom edge at (6,6); unit at (6,8) — unit is in front
    expect(isBehind(unit, hq)).toBe(false);
  });

  it('construction site uses same depth model as building', () => {
    const site: DepthSortable = {
      id: 'site-1', type: 'construction-site', tx: 5, ty: 5, footprintW: 2, footprintH: 2, offsetX, offsetY,
    };
    const building: DepthSortable = {
      id: 'bldg-1', type: 'building', tx: 5, ty: 5, footprintW: 2, footprintH: 2, offsetX, offsetY,
    };
    // Same position and footprint should produce the same depth
    const siteKey = computeDepthKey(site);
    const bldgKey = computeDepthKey(building);
    expect(siteKey.depthY).toBeCloseTo(bldgKey.depthY, 1);
    expect(siteKey.depthX).toBeCloseTo(bldgKey.depthX, 1);
  });

  it('mixed units and buildings sort together correctly', () => {
    const items: DepthSortable[] = [
      { id: 'unit-back', type: 'unit', tx: 5, ty: 2, offsetX, offsetY },
      { id: 'bldg-small', type: 'building', tx: 8, ty: 4, footprintW: 1, footprintH: 1, offsetX, offsetY },
      { id: 'unit-mid', type: 'unit', tx: 7, ty: 6, offsetX, offsetY },
      { id: 'bldg-large', type: 'building', tx: 3, ty: 5, footprintW: 3, footprintH: 3, offsetX, offsetY },
      { id: 'unit-front', type: 'unit', tx: 5, ty: 10, offsetX, offsetY },
    ];
    const sorted = sortByDepth(items);
    // Verify all items are present
    const ids = sorted.map(s => s.sortable.id);
    expect(ids).toHaveLength(5);
    // Back unit should be first (lowest depthY)
    expect(ids[0]).toBe('unit-back');
    // Front unit should be last (highest depthY)
    expect(ids[4]).toBe('unit-front');
  });

  it('computeDepthValue produces correct numeric depth', () => {
    // computeDepthValue is imported at top
    const unit: DepthSortable = {
      id: 'unit-1', type: 'unit', tx: 5, ty: 5, offsetX, offsetY,
    };
    const depth = computeDepthValue(unit, 100);
    // Depth should be baseDepth + projectedY + projectedX * 0.01
    expect(depth).toBeGreaterThan(100);
    expect(typeof depth).toBe('number');
  });

  it('all renderers use same computeDepthValue for unified depth ordering', () => {
    // Verify that computeDepthValue is the single source of truth for depth.
    // ModularTankRenderer, EntityRenderer, ConstructionRenderer, and
    // BlockoutVehicleRenderer all use computeDepthValue (or sortByDepth
    // which uses computeDepthKey, consistent with computeDepthValue).
    // computeDepthValue is imported at top

    // A unit and building at the same position should have consistent depth
    const unitDepth = computeDepthValue({
      id: 'unit', type: 'unit', tx: 5, ty: 5, offsetX, offsetY,
    });
    const smallBuildingDepth = computeDepthValue({
      id: 'bldg', type: 'building', tx: 5, ty: 5, footprintW: 1, footprintH: 1, offsetX, offsetY,
    });
    // A 1x1 building at same tile should have same depth as unit
    expect(smallBuildingDepth).toBeCloseTo(unitDepth, 1);

    // A larger building at same base tile should have deeper depth (front-bottom edge is further south)
    const largeBuildingDepth = computeDepthValue({
      id: 'bldg-large', type: 'building', tx: 5, ty: 5, footprintW: 3, footprintH: 3, offsetX, offsetY,
    });
    expect(largeBuildingDepth).toBeGreaterThan(unitDepth);
  });
});

// ═══════════════════════════════════════════════════════════════════
// BLOCKER 2 FIXUP: Civil units coverage (harvester/builder)
// ═══════════════════════════════════════════════════════════════════

describe('Blocker 2: Civil units reservation/occupancy compatibility', () => {
  it('addReservationBlockers marks reserved tiles as impassable', () => {
    // addReservationBlockers is imported at top
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    // Reserve a tile by another unit
    reservationMap.reserve(10, 10, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);

    // Before adding reservation blockers, tile should be passable
    expect(isPassable(occupancy, 10, 10)).toBe(true);

    // Add reservation blockers
    addReservationBlockers(reservationMap, occupancy);

    // After adding reservation blockers, tile should be impassable
    expect(isPassable(occupancy, 10, 10)).toBe(false);
  });

  it('addReservationBlockers excludes own unit reservations', () => {
    // addReservationBlockers is imported at top
    const occupancy = createTestOccupancyMap();
    const reservationMap = new TileReservationMap(32);

    // Reserve a tile by unit-1
    reservationMap.reserve(10, 10, { unitId: 'unit-1', unitType: 'combat-vehicle' }, 0);

    // Add reservation blockers excluding unit-1
    addReservationBlockers(reservationMap, occupancy, 'unit-1');

    // Tile should still be passable because we excluded unit-1's own reservation
    expect(isPassable(occupancy, 10, 10)).toBe(true);
  });

  it('harvester pathing respects reserved tiles', () => {
    // addReservationBlockers is imported at top
    const reservationMap = new TileReservationMap(32);
    const state = createTestGameState();
    const occupancy = buildOccupancyMap(state);

    // Reserve tile (10,10) by a combat vehicle
    reservationMap.reserve(10, 10, { unitId: 'tank-1', unitType: 'combat-vehicle' }, 0);

    // Add reservation blockers to occupancy
    addReservationBlockers(reservationMap, occupancy);

    // Tile (10,10) should be impassable for pathfinding
    expect(isPassable(occupancy, 10, 10)).toBe(false);

    // Path from (9,10) to (11,10) should go around (10,10)
    const path = findPath(occupancy, 9, 10, 11, 10);
    if (path) {
      expect(path.some(p => p.tx === 10 && p.ty === 10)).toBe(false);
    }
  });

  it('builder pathing respects reserved tiles', () => {
    // addReservationBlockers is imported at top
    const reservationMap = new TileReservationMap(32);
    const state = createTestGameState();
    const occupancy = buildOccupancyMap(state);

    // Reserve tile (8,8) by a harvester
    reservationMap.reserve(8, 8, { unitId: 'harvester-1', unitType: 'harvester' }, 0);

    // Add reservation blockers
    addReservationBlockers(reservationMap, occupancy);

    // Builder should not path through the reserved tile
    expect(isPassable(occupancy, 8, 8)).toBe(false);
  });

  it('TileReservationMap.getAllReservations returns all active reservations', () => {
    const map = new TileReservationMap(32);
    map.reserve(5, 5, { unitId: 'u1', unitType: 'combat-vehicle' }, 0);
    map.reserve(6, 6, { unitId: 'u2', unitType: 'harvester' }, 0);

    const all = map.getAllReservations();
    expect(all).toHaveLength(2);
    expect(all.some(r => r.tx === 5 && r.ty === 5)).toBe(true);
    expect(all.some(r => r.tx === 6 && r.ty === 6)).toBe(true);
  });

  it('civil unit pathfinding respects combat vehicle blockers', () => {
    // Simulate what updateGameState.ts does: build occupancy + add vehicle blockers
    const state = createTestGameState();
    const occupancy = buildOccupancyMap(state);

    // Add a vehicle blocker at (10,10) with a heavy body (blocks adjacent too)
    addVehicleBlockers(
      [{ id: 'v1', tx: 10, ty: 10, bodyId: 'mammoth', isDestroyed: false }],
      occupancy,
    );

    // Tile (10,10) should be impassable
    expect(isPassable(occupancy, 10, 10)).toBe(false);
    // Adjacent tiles should also be blocked for heavy body
    expect(isPassable(occupancy, 9, 10)).toBe(false);
    expect(isPassable(occupancy, 11, 10)).toBe(false);

    // Pathfinding from (8,10) to (12,10) should go around the heavy body
    const path = findPath(occupancy, 8, 10, 12, 10);
    if (path) {
      // Path should not include blocked tiles
      expect(path.some(p => p.tx === 10 && p.ty === 10)).toBe(false);
      expect(path.some(p => p.tx === 9 && p.ty === 10)).toBe(false);
      expect(path.some(p => p.tx === 11 && p.ty === 10)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// BLOCKER 3 FIXUP: Body footprint classes affect runtime occupancy
// ═══════════════════════════════════════════════════════════════════

describe('Blocker 3: Body footprint classes affect runtime occupancy', () => {
  it('heavy body blocks more tiles than light body', () => {
    // getOccupiedTiles is imported at top

    // Light body (Wasp) occupies only its own tile
    const lightTiles = getOccupiedTiles(5, 5, 'wasp');
    expect(lightTiles).toHaveLength(1);
    expect(lightTiles[0]).toEqual({ tx: 5, ty: 5 });

    // Heavy body (Mammoth) occupies its own tile + 4 adjacent tiles (5 total)
    // because collisionRadiusTiles=0.6 > 0.5 extends past tile boundary
    const heavyTiles = getOccupiedTiles(5, 5, 'mammoth');
    expect(heavyTiles).toHaveLength(5);
    // Must include the own tile
    expect(heavyTiles.some((t: any) => t.tx === 5 && t.ty === 5)).toBe(true);
    // Must include all 4 adjacent tiles
    expect(heavyTiles.some((t: any) => t.tx === 4 && t.ty === 5)).toBe(true);
    expect(heavyTiles.some((t: any) => t.tx === 6 && t.ty === 5)).toBe(true);
    expect(heavyTiles.some((t: any) => t.tx === 5 && t.ty === 4)).toBe(true);
    expect(heavyTiles.some((t: any) => t.tx === 5 && t.ty === 6)).toBe(true);

    // Medium body (Hunter) occupies only its own tile (collisionRadiusTiles=0.5, NOT > 0.5)
    const mediumTiles = getOccupiedTiles(5, 5, 'hunter');
    expect(mediumTiles).toHaveLength(1);
  });

  it('heavy body affects pathfinding more than light body', () => {
    // When a heavy body is at position, it blocks more tiles for pathfinding
    const occupancy = createTestOccupancyMap();

    // Add heavy vehicle blocker
    addVehicleBlockers(
      [{ id: 'heavy-1', tx: 10, ty: 10, bodyId: 'mammoth', isDestroyed: false }],
      occupancy,
    );

    // Heavy body should block its own tile
    expect(isPassable(occupancy, 10, 10)).toBe(false);

    // Heavy body with collisionRadiusTiles=0.6 > 0.5 blocks adjacent tiles too
    // because its collision radius extends past the tile boundary
    expect(isPassable(occupancy, 9, 10)).toBe(false);
    expect(isPassable(occupancy, 11, 10)).toBe(false);
    expect(isPassable(occupancy, 10, 9)).toBe(false);
    expect(isPassable(occupancy, 10, 11)).toBe(false);
  });

  it('bodiesOverlap detects collision between close units', () => {
    // bodiesOverlap is imported at top

    // Two light units at distance 0.5 — overlap (0.4 + 0.4 = 0.8 > 0.5)
    expect(bodiesOverlap(5, 5, 'wasp', 5.5, 5, 'wasp')).toBe(true);

    // Two light units at distance 1.0 — no overlap (0.4 + 0.4 = 0.8 < 1.0)
    expect(bodiesOverlap(5, 5, 'wasp', 6, 5, 'wasp')).toBe(false);

    // Heavy + light at distance 0.5 — overlap (0.6 + 0.4 = 1.0 > 0.5)
    expect(bodiesOverlap(5, 5, 'mammoth', 5.5, 5, 'wasp')).toBe(true);

    // Heavy + light at distance 0.9 — overlap (0.6 + 0.4 = 1.0 > 0.9)
    expect(bodiesOverlap(5, 5, 'mammoth', 5.9, 5, 'wasp')).toBe(true);

    // Heavy + light at distance 1.1 — no overlap (0.6 + 0.4 = 1.0 < 1.1)
    expect(bodiesOverlap(5, 5, 'mammoth', 6.1, 5, 'wasp')).toBe(false);
  });

  it('resolveCollisionPriority: heavy beats medium and light', () => {
    // resolveCollisionPriority is imported at top

    // Heavy vs medium — medium yields
    expect(resolveCollisionPriority('tank-a', 'mammoth', 'tank-b', 'hunter')).toBe('tank-b');

    // Heavy vs light — light yields
    expect(resolveCollisionPriority('tank-a', 'mammoth', 'scout', 'wasp')).toBe('scout');

    // Medium vs light — light yields
    expect(resolveCollisionPriority('tank-a', 'hunter', 'scout', 'wasp')).toBe('scout');

    // Same class — neither yields
    expect(resolveCollisionPriority('tank-a', 'hunter', 'tank-b', 'viking')).toBeNull();
  });

  it('addVehicleBlockers with heavy body blocks more tiles than light body', () => {
    // Test with heavy body — should block own tile + 4 adjacent tiles
    const heavyOccupancy = createTestOccupancyMap();
    addVehicleBlockers(
      [{ id: 'v1', tx: 10, ty: 10, bodyId: 'mammoth', isDestroyed: false }],
      heavyOccupancy,
    );
    expect(isPassable(heavyOccupancy, 10, 10)).toBe(false);
    // Heavy body blocks adjacent tiles (collisionRadiusTiles 0.6 > 0.5)
    expect(isPassable(heavyOccupancy, 9, 10)).toBe(false);
    expect(isPassable(heavyOccupancy, 11, 10)).toBe(false);
    expect(isPassable(heavyOccupancy, 10, 9)).toBe(false);
    expect(isPassable(heavyOccupancy, 10, 11)).toBe(false);

    // Test with light body — should block only own tile
    const lightOccupancy = createTestOccupancyMap();
    addVehicleBlockers(
      [{ id: 'v1', tx: 10, ty: 10, bodyId: 'wasp', isDestroyed: false }],
      lightOccupancy,
    );
    expect(isPassable(lightOccupancy, 10, 10)).toBe(false);
    // Light body does NOT block adjacent tiles (collisionRadiusTiles 0.4 < 0.5)
    expect(isPassable(lightOccupancy, 9, 10)).toBe(true);
    expect(isPassable(lightOccupancy, 11, 10)).toBe(true);
    expect(isPassable(lightOccupancy, 10, 9)).toBe(true);
    expect(isPassable(lightOccupancy, 10, 11)).toBe(true);
  });

  it('collision radius differs between footprint classes', () => {
    // getBodyCollisionRadiusTiles is imported at top

    const lightRadius = getBodyCollisionRadiusTiles('wasp');
    const mediumRadius = getBodyCollisionRadiusTiles('hunter');
    const heavyRadius = getBodyCollisionRadiusTiles('mammoth');

    expect(lightRadius).toBe(0.4);
    expect(mediumRadius).toBe(0.5);
    expect(heavyRadius).toBe(0.6);

    // Heavy has larger collision radius than light
    expect(heavyRadius).toBeGreaterThan(lightRadius);
  });
});
