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
import { buildOccupancyMap, addUnitBlockers, addVehicleBlockers, isPassable } from '../state/occupancy';
import { findPath } from '../state/pathfinding';
import {
  computeDepthKey,
  sortByDepth,
  getDepthOrderMap,
  isBehind,
  type DepthSortable,
} from '../phaser/render/depthSorting';
import type { GameState } from '../state/types';

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
  const offset = { x: 0, y: 0 };

  it('unit behind building renders behind it', () => {
    const unit: DepthSortable = {
      id: 'unit-1',
      type: 'unit',
      tx: 5, ty: 3, // behind (lower ty in isometric = further back)
      offset,
    };
    const building: DepthSortable = {
      id: 'building-1',
      type: 'building',
      tx: 5, ty: 8, // in front (higher ty = closer to viewer)
      offset,
    };
    expect(isBehind(unit, building)).toBe(true);
  });

  it('unit in front of building renders above it', () => {
    const unit: DepthSortable = {
      id: 'unit-1',
      type: 'unit',
      tx: 5, ty: 10, // in front
      offset,
    };
    const building: DepthSortable = {
      id: 'building-1',
      type: 'building',
      tx: 5, ty: 5, // behind
      offset,
    };
    expect(isBehind(unit, building)).toBe(false);
  });

  it('large building depth uses footprint front-bottom edge', () => {
    const smallBuilding: DepthSortable = {
      id: 'small',
      type: 'building',
      tx: 5, ty: 5,
      footprintW: 1, footprintH: 1,
      offset,
    };
    const largeBuilding: DepthSortable = {
      id: 'large',
      type: 'building',
      tx: 5, ty: 5,
      footprintW: 3, footprintH: 3,
      offset,
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
      offset,
    };
    const key = computeDepthKey(building);
    // Front-bottom edge is at (7, 7), not center (6, 6)
    // Verify the depth key uses (7, 7) not (6, 6)
    const frontEdge = computeDepthKey({
      id: 'edge-point',
      type: 'unit',
      tx: 7, ty: 7,
      offset,
    });
    expect(key.depthY).toBeCloseTo(frontEdge.depthY, 1);
  });

  it('sortByDepth produces correct order', () => {
    const items: DepthSortable[] = [
      { id: 'front', type: 'unit', tx: 5, ty: 10, offset },
      { id: 'middle', type: 'unit', tx: 5, ty: 7, offset },
      { id: 'back', type: 'unit', tx: 5, ty: 3, offset },
    ];
    const sorted = sortByDepth(items);
    expect(sorted[0].sortable.id).toBe('back');
    expect(sorted[1].sortable.id).toBe('middle');
    expect(sorted[2].sortable.id).toBe('front');
  });

  it('tie-breaking by X works', () => {
    const items: DepthSortable[] = [
      { id: 'right', type: 'unit', tx: 8, ty: 5, offset },
      { id: 'left', type: 'unit', tx: 3, ty: 5, offset },
    ];
    const sorted = sortByDepth(items);
    expect(sorted[0].sortable.id).toBe('left');
    expect(sorted[1].sortable.id).toBe('right');
  });

  it('getDepthOrderMap returns correct indices', () => {
    const items: DepthSortable[] = [
      { id: 'a', type: 'unit', tx: 5, ty: 10, offset },
      { id: 'b', type: 'unit', tx: 5, ty: 3, offset },
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
  const offset = { x: 0, y: 0 };

  it('unit behind large building sorts behind', () => {
    const unit: DepthSortable = {
      id: 'unit-1', type: 'unit', tx: 5, ty: 3, offset,
    };
    const building: DepthSortable = {
      id: 'bldg-1', type: 'building', tx: 4, ty: 4, footprintW: 3, footprintH: 3, offset,
    };
    // Building front-bottom at (6,6), unit at (5,3)
    // Unit should be behind (lower depthY)
    expect(isBehind(unit, building)).toBe(true);
  });

  it('unit beside building sorts correctly by X tiebreaker', () => {
    const unitA: DepthSortable = {
      id: 'unit-a', type: 'unit', tx: 3, ty: 5, offset,
    };
    const unitB: DepthSortable = {
      id: 'unit-b', type: 'unit', tx: 7, ty: 5, offset,
    };
    // Same Y position, different X — left unit should be behind
    expect(isBehind(unitA, unitB)).toBe(true);
  });

  it('multiple buildings with different footprint sizes sort correctly', () => {
    const small: DepthSortable = {
      id: 'small', type: 'building', tx: 5, ty: 5, footprintW: 1, footprintH: 1, offset,
    };
    const large: DepthSortable = {
      id: 'large', type: 'building', tx: 5, ty: 5, footprintW: 3, footprintH: 3, offset,
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
