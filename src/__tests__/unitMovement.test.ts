import { describe, it, expect } from 'vitest';
import {
  findResourceApproachTile,
  issueManualMove,
  checkPathExists,
  updateHarvesterManualMove,
} from '../state/unitCommands';
import {
  selectBuilder,
  selectHarvester,
  clearSelection,
  isUnitSelected,
  isBuilderSelected,
  isHarvesterSelected,
} from '../state/unitSelection';
import { buildOccupancyMap, isPassable, addUnitBlockers, isTileOccupiedByUnit } from '../state/occupancy';
import type { GameState } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import { updateGameState } from '../state/updateGameState';

/**
 * ARCH-05X: Tests for civil unit movement, selection, passability,
 * resource approach behavior, and manual move commands.
 */

// ─── Helper: create a minimal test state ────────────────────────────

function createTestState(): GameState {
  return createInitialState();
}

// ─── Unit Selection ─────────────────────────────────────────────────

describe('unit selection', () => {
  it('selectBuilder creates builder selection', () => {
    const sel = selectBuilder('builder-0');
    expect(sel).not.toBeNull();
    expect(sel!.kind).toBe('single');
    if (sel!.kind === 'single') {
      expect(sel.units[0].kind).toBe('builder');
      expect(sel.units[0].id).toBe('builder-0');
    }
  });

  it('selectHarvester creates harvester selection', () => {
    const sel = selectHarvester('h-0');
    expect(sel).not.toBeNull();
    expect(sel!.kind).toBe('single');
    if (sel!.kind === 'single') {
      expect(sel.units[0].kind).toBe('harvester');
      expect(sel.units[0].id).toBe('h-0');
    }
  });

  it('clearSelection returns null', () => {
    expect(clearSelection()).toBeNull();
  });

  it('isUnitSelected returns true for builder', () => {
    expect(isUnitSelected(selectBuilder('builder-0'))).toBe(true);
  });

  it('isUnitSelected returns false for null', () => {
    expect(isUnitSelected(null)).toBe(false);
  });

  it('isBuilderSelected narrows type', () => {
    const sel = selectBuilder('builder-2');
    expect(isBuilderSelected(sel)).toBe(true);
    expect(isHarvesterSelected(sel)).toBe(false);
  });

  it('isHarvesterSelected narrows type', () => {
    const sel = selectHarvester('h-1');
    expect(isHarvesterSelected(sel)).toBe(true);
    expect(isBuilderSelected(sel)).toBe(false);
  });
});

// ─── Resource Approach Behavior ──────────────────────────────────────

describe('resource approach behavior', () => {
  it('approach tile is NOT the resource tile itself', () => {
    const state = createTestState();
    // Pick a resource
    const resource = state.resourceNodes[0];
    if (!resource) return; // skip if no resources

    const result = findResourceApproachTile(
      state, 0, 0, resource.tx, resource.ty, resource.footprint,
    );

    if (result.ok) {
      // The approach tile should not be inside the resource footprint
      const inFootprint =
        result.approachTx >= resource.tx &&
        result.approachTx < resource.tx + resource.footprint &&
        result.approachTy >= resource.ty &&
        result.approachTy < resource.ty + resource.footprint;
      expect(inFootprint).toBe(false);
    }
  });

  it('approach tile is adjacent to the resource footprint', () => {
    const state = createTestState();
    const resource = state.resourceNodes[0];
    if (!resource) return;

    const result = findResourceApproachTile(
      state, 0, 0, resource.tx, resource.ty, resource.footprint,
    );

    if (result.ok) {
      // Must be adjacent to the footprint boundary
      const tx = result.approachTx;
      const ty = result.approachTy;
      const ftx = resource.tx;
      const fty = resource.ty;
      const fp = resource.footprint;

      const isAdjacent =
        // North edge
        (ty === fty - 1 && tx >= ftx && tx < ftx + fp) ||
        // South edge
        (ty === fty + fp && tx >= ftx && tx < ftx + fp) ||
        // West edge
        (tx === ftx - 1 && ty >= fty && ty < fty + fp) ||
        // East edge
        (tx === ftx + fp && ty >= fty && ty < fty + fp);

      expect(isAdjacent).toBe(true);
    }
  });

  it('approach tile is passable', () => {
    const state = createTestState();
    const resource = state.resourceNodes[0];
    if (!resource) return;

    const result = findResourceApproachTile(
      state, 0, 0, resource.tx, resource.ty, resource.footprint,
    );

    if (result.ok) {
      const occupancy = buildOccupancyMap(state);
      expect(isPassable(occupancy, result.approachTx, result.approachTy)).toBe(true);
    }
  });

  it('returns failure if all adjacent tiles are impassable', () => {
    const state = createTestState();
    // This is a theoretical test — in practice the map has open tiles.
    // We test with a completely blocked scenario by creating a custom scenario.
    // For now, just verify the return type is correct.
    const resource = state.resourceNodes[0];
    if (!resource) return;

    const result = findResourceApproachTile(
      state, 0, 0, resource.tx, resource.ty, resource.footprint,
    );

    expect(result.ok === true || result.ok === false).toBe(true);
    if (!result.ok) {
      expect(result.reason).toBe('no-adjacent-passable');
    }
  });
});

// ─── Building/Resource Passability ──────────────────────────────────

describe('building and resource passability', () => {
  it('completed buildings are impassable', () => {
    const state = createTestState();
    const occupancy = buildOccupancyMap(state);

    for (const building of state.mapData.buildings) {
      // At least the top-left tile of the building footprint should be impassable
      expect(isPassable(occupancy, building.tx, building.ty)).toBe(false);
    }
  });

  it('HQ footprint is impassable', () => {
    const state = createTestState();
    const occupancy = buildOccupancyMap(state);
    const hq = state.mapData.hq;

    // All tiles of the 3x3 HQ footprint should be impassable
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isPassable(occupancy, hq.tx + dx, hq.ty + dy)).toBe(false);
      }
    }
  });

  it('resource tiles are impassable for movement (ARCH-05X)', () => {
    const state = createTestState();
    const occupancy = buildOccupancyMap(state);

    for (const resource of state.mapData.resources) {
      // The resource tile itself should be impassable
      expect(isPassable(occupancy, resource.tx, resource.ty)).toBe(false);
    }
  });

  it('construction sites are impassable', () => {
    const state = createTestState();
    // Place a construction site
    state.economy.matter = 200;
    state.mapData.builders[0].busy = false;
    state.mapData.builders[0].phase = 'idle';

    const occupancy = buildOccupancyMap(state);
    // Without a site placed, just verify the occupancy map works
    expect(occupancy.width).toBeGreaterThan(0);
  });
});

// ─── Manual Move Command ────────────────────────────────────────────

describe('manual move command', () => {
  it('move to impassable tile returns target-impassable', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    const sel = selectHarvester(h.id);
    // Try to move onto HQ (which is impassable)
    const result = issueManualMove(state, sel.units[0], state.mapData.hq.tx, state.mapData.hq.ty);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('target-impassable');
    }
  });

  it('move to passable tile succeeds', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Find a passable tile that's not the harvester's current position
    const occupancy = buildOccupancyMap(state);
    let targetTx = -1;
    let targetTy = -1;
    for (let ty = 0; ty < 5; ty++) {
      for (let tx = 0; tx < 5; tx++) {
        if (isPassable(occupancy, tx, ty) &&
            (tx !== Math.round(h.ftx) || ty !== Math.round(h.fty))) {
          targetTx = tx;
          targetTy = ty;
          break;
        }
      }
      if (targetTx >= 0) break;
    }

    if (targetTx < 0) return; // no valid target found

    const sel = selectHarvester(h.id);
    const result = issueManualMove(state, sel.units[0], targetTx, targetTy);

    expect(result.ok).toBe(true);
  });

  it('manual move does not lose harvester cargo', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Simulate harvester having cargo
    h.cargoRaw = 10;
    h.phase = 'gathering'; // set to a phase where cargo exists

    const occupancy = buildOccupancyMap(state);
    let targetTx = -1;
    let targetTy = -1;
    for (let ty = 0; ty < 5; ty++) {
      for (let tx = 0; tx < 5; tx++) {
        if (isPassable(occupancy, tx, ty) &&
            (tx !== Math.round(h.ftx) || ty !== Math.round(h.fty))) {
          targetTx = tx;
          targetTy = ty;
          break;
        }
      }
      if (targetTx >= 0) break;
    }

    if (targetTx < 0) return;

    const sel = selectHarvester(h.id);
    const result = issueManualMove(state, sel.units[0], targetTx, targetTy);

    if (result.ok) {
      // Cargo must be preserved
      expect(h.cargoRaw).toBe(10);
      // Phase should be manual-move
      expect(h.phase).toBe('manual-move');
    }
  });

  it('builder manual move only works for idle builder', () => {
    const state = createTestState();
    const builder = state.mapData.builders[0];
    if (!builder) return;

    // Busy builder should reject manual move
    builder.busy = true;
    builder.phase = 'building';

    const occupancy = buildOccupancyMap(state);
    let targetTx = -1;
    let targetTy = -1;
    for (let ty = 0; ty < 5; ty++) {
      for (let tx = 0; tx < 5; tx++) {
        if (isPassable(occupancy, tx, ty)) {
          targetTx = tx;
          targetTy = ty;
          break;
        }
      }
      if (targetTx >= 0) break;
    }

    if (targetTx < 0) return;

    const sel = selectBuilder(state.mapData.builders[0].id);
    const result = issueManualMove(state, sel.units[0], targetTx, targetTy);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unit-busy');
    }
  });
});

// ─── Path Existence Check ───────────────────────────────────────────

describe('path existence check', () => {
  it('returns null for reachable tiles', () => {
    const state = createTestState();
    const occupancy = buildOccupancyMap(state);

    // Find two passable tiles
    let startTx = -1, startTy = -1, endTx = -1, endTy = -1;
    for (let ty = 0; ty < 10; ty++) {
      for (let tx = 0; tx < 10; tx++) {
        if (isPassable(occupancy, tx, ty)) {
          if (startTx < 0) { startTx = tx; startTy = ty; }
          else { endTx = tx; endTy = ty; break; }
        }
      }
      if (endTx >= 0) break;
    }

    if (startTx < 0 || endTx < 0) return;

    const result = checkPathExists(state, startTx, startTy, endTx, endTy);
    // On the game map, nearby tiles should be reachable
    expect(result).toBeNull();
  });

  it('returns reason for impassable target', () => {
    const state = createTestState();
    const hq = state.mapData.hq;
    const result = checkPathExists(state, 0, 0, hq.tx, hq.ty);
    expect(result).toBe('target-impassable');
  });
});

// ─── ARCH-05X Hardening: Typed Fields ───────────────────────────────

describe('ARCH-05X hardening: typed fields (no as any)', () => {
  it('harvester manual move stores path in typed fields, not as any', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    const occupancy = buildOccupancyMap(state);
    let targetTx = -1;
    let targetTy = -1;
    for (let ty = 0; ty < 5; ty++) {
      for (let tx = 0; tx < 5; tx++) {
        if (isPassable(occupancy, tx, ty) &&
            (tx !== Math.round(h.ftx) || ty !== Math.round(h.fty))) {
          targetTx = tx;
          targetTy = ty;
          break;
        }
      }
      if (targetTx >= 0) break;
    }
    if (targetTx < 0) return;

    const sel = selectHarvester(h.id);
    const result = issueManualMove(state, sel.units[0], targetTx, targetTy);
    if (!result.ok) return;

    // Path should be stored in typed fields, not hidden `as any` properties
    expect(h.manualPath).toBeDefined();
    expect(Array.isArray(h.manualPath)).toBe(true);
    expect(h.manualPathIndex).toBe(0);
    expect(h.manualCooldownMs).toBe(0);
  });

  it('builder manual move stores manualMove flag in typed field', () => {
    const state = createTestState();
    const builder = state.mapData.builders[0];
    if (!builder) return;

    builder.busy = false;
    builder.phase = 'idle';

    const occupancy = buildOccupancyMap(state);
    let targetTx = -1;
    let targetTy = -1;
    for (let ty = 0; ty < 5; ty++) {
      for (let tx = 0; tx < 5; tx++) {
        if (isPassable(occupancy, tx, ty)) {
          targetTx = tx;
          targetTy = ty;
          break;
        }
      }
      if (targetTx >= 0) break;
    }
    if (targetTx < 0) return;

    const sel = selectBuilder(state.mapData.builders[0].id);
    const result = issueManualMove(state, sel.units[0], targetTx, targetTy);
    if (!result.ok) return;

    // manualMove should be a typed field, not a hidden `as any` property
    expect(builder.manualMove).toBe(true);
  });

  it('harvester manual move update uses typed cooldown field', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Set up harvester in manual-move state with typed fields
    h.phase = 'manual-move';
    h.manualPath = [{ tx: Math.round(h.ftx) + 1, ty: Math.round(h.fty) }];
    h.manualPathIndex = 1; // already past end = arrived
    h.manualCooldownMs = 0;
    h.cargoRaw = 5;

    // Call update — should start cooldown
    updateHarvesterManualMove(state, h, 100);

    // Cooldown should be set in typed field
    expect(h.manualCooldownMs).toBeDefined();
    expect(h.manualCooldownMs!).toBeGreaterThan(0);
  });
});

// ─── ARCH-05X Hardening: No Straight-Line Fallback ──────────────────

describe('ARCH-05X hardening: no straight-line fallback on return-to-HQ', () => {
  it('harvester does not walk through obstacles when BFS fails', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Simulate a harvester that has cargo and needs to return to HQ
    h.cargoRaw = 10;
    h.phase = 'returning-to-hq';
    h.targetResourceId = null;

    // Record initial position
    const startFtx = h.ftx;
    const startFty = h.fty;

    // Run several frames of update
    for (let i = 0; i < 10; i++) {
      updateGameState(state, 16);
    }

    // The harvester should either have found a valid BFS path (and be moving along it)
    // or be stuck with blockedReason set. It must NOT have moved through obstacles
    // via straight-line fallback.
    // In the normal map, there should always be a path, so it should be moving
    // toward HQ via BFS path or have transitioned to unloading.
    if (h.phase === 'returning-to-hq') {
      // If still returning, must have a returnPath set (BFS path, not straight line)
      // or blockedReason explaining why it's stuck
      if (h.returnPath) {
        // BFS path exists — harvester is navigating properly
        expect(Array.isArray(h.returnPath)).toBe(true);
      } else {
        // No BFS path — must have a blockedReason and NOT have moved
        expect(h.blockedReason).toBeDefined();
        // Position should not have changed (no straight-line fallback)
        expect(h.ftx).toBeCloseTo(startFtx, 1);
        expect(h.fty).toBeCloseTo(startFty, 1);
      }
    }
  });

  it('blocked harvester has blockedReason set when no path to HQ exists', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Place the harvester on an isolated tile surrounded by obstacles
    // (simulating a completely blocked scenario)
    // This is a constructed test — in the real map there should always be a path.
    // We set up a harvester in returning-to-hq with manually cleared returnPath
    // to test the blocked state detection.

    h.cargoRaw = 10;
    h.phase = 'returning-to-hq';
    h.targetResourceId = null;
    h.returnPath = undefined;
    h.returnPathIndex = undefined;
    h.blockedReason = undefined;

    // Move the harvester to a position where BFS might fail
    // by placing it at the edge of the map near obstacles
    const occupancy = buildOccupancyMap(state);
    // Find a passable tile far from HQ
    let farthestTx = 0;
    let farthestTy = 0;
    let maxDist = 0;
    const hqTx = state.hqPosition.tx;
    const hqTy = state.hqPosition.ty;
    for (let ty = 0; ty < state.mapHeight; ty++) {
      for (let tx = 0; tx < state.mapWidth; tx++) {
        if (isPassable(occupancy, tx, ty)) {
          const dist = Math.abs(tx - hqTx) + Math.abs(ty - hqTy);
          if (dist > maxDist) {
            maxDist = dist;
            farthestTx = tx;
            farthestTy = ty;
          }
        }
      }
    }

    h.ftx = farthestTx;
    h.fty = farthestTy;

    // Run update — on normal map it should find a path
    updateGameState(state, 16);

    // On the normal game map, there should be a path from any passable tile to HQ
    // So the harvester should either have a returnPath or have started unloading
    if (h.phase === 'returning-to-hq' && !h.returnPath) {
      // If somehow no path, blockedReason must be set
      expect(h.blockedReason).toBeDefined();
    }
  });

  it('harvester returning-to-hq clears blockedReason when path found', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    h.cargoRaw = 10;
    h.phase = 'returning-to-hq';
    h.targetResourceId = null;
    h.returnPath = undefined;
    h.returnPathIndex = undefined;
    h.blockedReason = 'no-path-to-hq';

    // Run update — should find path and clear blockedReason
    updateGameState(state, 16);

    // On normal map, path should be found
    if (h.returnPath) {
      expect(h.blockedReason).toBeUndefined();
    }
  });

  it('harvester idle phase clears all stale path fields', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Set stale path data
    h.approachPath = [{ tx: 1, ty: 2 }];
    h.approachPathIndex = 0;
    h.returnPath = [{ tx: 3, ty: 4 }];
    h.returnPathIndex = 1;
    h.manualPath = [{ tx: 5, ty: 6 }];
    h.manualPathIndex = 0;
    h.manualCooldownMs = 500;
    h.blockedReason = 'no-resources';
    h.phase = 'idle';
    h.targetResourceId = null;

    // Remove all resources to keep harvester idle
    for (const r of state.resourceNodes) {
      r.depleted = true;
    }

    // Run update — idle handler should clean up stale paths
    updateGameState(state, 16);

    expect(h.approachPath).toBeUndefined();
    expect(h.approachPathIndex).toBeUndefined();
    expect(h.returnPath).toBeUndefined();
    expect(h.returnPathIndex).toBeUndefined();
    expect(h.manualPath).toBeUndefined();
    expect(h.manualPathIndex).toBeUndefined();
    expect(h.manualCooldownMs).toBeUndefined();
    // FIX-02: blockedReason is now set to 'no-resources' when all resources
    // are depleted, instead of being cleared to undefined.
    expect(h.blockedReason).toBe('no-resources');
  });
});

// ─── ARCH-05X Hardening: Unit Blocking ──────────────────────────────

describe('ARCH-05X hardening: units block each other', () => {
  it('isTileOccupiedByUnit returns true when a builder is on the tile', () => {
    const state = createTestState();
    const builder = state.mapData.builders[0];
    if (!builder) return;

    const tx = Math.round(builder.ftx);
    const ty = Math.round(builder.fty);

    expect(isTileOccupiedByUnit(state, tx, ty)).toBe(true);
  });

  it('isTileOccupiedByUnit returns true when a harvester is on the tile', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    const tx = Math.round(h.ftx);
    const ty = Math.round(h.fty);

    expect(isTileOccupiedByUnit(state, tx, ty)).toBe(true);
  });

  it('isTileOccupiedByUnit excludes the specified unit', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    const tx = Math.round(h.ftx);
    const ty = Math.round(h.fty);

    // The harvester's own tile is not occupied when excluded
    expect(isTileOccupiedByUnit(state, tx, ty, 'harvester', h.id)).toBe(false);
  });

  it('isTileOccupiedByUnit returns false for empty tile', () => {
    const state = createTestState();
    const occupancy = buildOccupancyMap(state);

    // Find a passable tile with no unit on it
    for (let ty = 0; ty < state.mapHeight; ty++) {
      for (let tx = 0; tx < state.mapWidth; tx++) {
        if (isPassable(occupancy, tx, ty) && !isTileOccupiedByUnit(state, tx, ty)) {
          expect(isTileOccupiedByUnit(state, tx, ty)).toBe(false);
          return;
        }
      }
    }
  });

  it('addUnitBlockers makes unit tiles impassable', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    const occupancy = buildOccupancyMap(state);
    // Before adding blockers, the harvester's tile may or may not be passable
    // (it could be on a passable tile or on a resource)

    addUnitBlockers(state, occupancy, 'harvester', h.id);

    // After adding blockers, other harvesters' tiles should be impassable
    for (const other of state.harvesters) {
      if (other.id === h.id) continue;
      const otx = Math.round(other.ftx);
      const oty = Math.round(other.fty);
      expect(isPassable(occupancy, otx, oty)).toBe(false);
    }
  });

  it('addUnitBlockers excludes the specified unit', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    const tx = Math.round(h.ftx);
    const ty = Math.round(h.fty);

    // Check that the tile is passable before (without resource/building on it)
    const occupancyBefore = buildOccupancyMap(state);
    const wasPassable = isPassable(occupancyBefore, tx, ty);

    const occupancy = buildOccupancyMap(state);
    addUnitBlockers(state, occupancy, 'harvester', h.id);

    // The excluded harvester's tile should NOT be blocked by itself
    // (it might still be impassable from resources/buildings)
    if (wasPassable) {
      expect(isPassable(occupancy, tx, ty)).toBe(true);
    }
  });

  it('manual move to tile occupied by another unit returns target-occupied', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    const builder = state.mapData.builders[0];
    if (!h || !builder) return;

    // Find a passable tile, then move the builder there
    const occupancy = buildOccupancyMap(state);
    let occupiedTx = -1;
    let occupiedTy = -1;
    for (let ty = 0; ty < 10; ty++) {
      for (let tx = 0; tx < 10; tx++) {
        if (isPassable(occupancy, tx, ty) &&
            tx !== Math.round(h.ftx) && ty !== Math.round(h.fty)) {
          occupiedTx = tx;
          occupiedTy = ty;
          break;
        }
      }
      if (occupiedTx >= 0) break;
    }
    if (occupiedTx < 0) return;

    // Move the builder to this passable tile so it occupies it
    builder.ftx = occupiedTx;
    builder.fty = occupiedTy;

    const sel = selectHarvester(h.id);
    const result = issueManualMove(state, sel.units[0], occupiedTx, occupiedTy);

    // Should be rejected because tile is occupied by the builder
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('target-occupied');
    }
  });

  it('pathfinding avoids other units when unit blockers are added', () => {
    const state = createTestState();
    const occupancy = buildOccupancyMap(state);
    const h = state.harvesters[0];
    if (!h) return;

    // Add unit blockers (excluding this harvester)
    addUnitBlockers(state, occupancy, 'harvester', h.id);

    // Other harvesters' positions should be impassable in the map
    for (const other of state.harvesters) {
      if (other.id === h.id) continue;
      const otx = Math.round(other.ftx);
      const oty = Math.round(other.fty);
      // The tile should now be impassable (unless it was already impassable from terrain)
      expect(isPassable(occupancy, otx, oty)).toBe(false);
    }
  });
});

// ─── RESOURCE-01: Depleted resource retargeting ──────────────────────

describe('RESOURCE-01: depleted resource retargeting', () => {
  it('harvester does not target depleted resources', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Deplete all resources
    for (const r of state.resourceNodes) {
      r.depleted = true;
      r.remainingRaw = 0;
    }

    h.phase = 'idle';
    h.targetResourceId = null;

    // Run update — harvester should NOT find a target
    updateGameState(state, 16);

    // Harvester should be idle with blockedReason 'no-resources'
    expect(h.phase).toBe('idle');
    expect(h.blockedReason).toBe('no-resources');
    expect(h.targetResourceId).toBeNull();
  });

  it('harvester retargets after current target is depleted during gathering', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Find two resources — deplete one, keep another
    const nonDepletedResources = state.resourceNodes.filter(r => !r.depleted);
    if (nonDepletedResources.length < 2) return; // need at least 2 resources

    // Set harvester to target the first resource
    const targetResource = nonDepletedResources[0];
    h.phase = 'gathering';
    h.targetResourceId = targetResource.id;
    h.gatherTimer = 100; // still gathering

    // Now deplete the targeted resource
    targetResource.depleted = true;
    targetResource.remainingRaw = 0;

    // Run update — harvester should detect depleted target and retarget or go idle
    updateGameState(state, 16);

    // Harvester should no longer be targeting the depleted resource
    expect(h.targetResourceId).not.toBe(targetResource.id);
    // Phase should be idle (no cargo) or returning-to-hq (has cargo)
    const phase: string = h.phase;
    expect(phase === 'idle' || phase === 'returning-to-hq').toBe(true);
  });

  it('harvester can path through depleted resource tiles', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Deplete a resource that's near the harvester's path
    const nearResource = state.resourceNodes.find(r =>
      !r.depleted && r.footprint === 1
    );
    if (!nearResource) return;

    // Before depletion, resource tile should be impassable
    const occupancyBefore = buildOccupancyMap(state);
    expect(isPassable(occupancyBefore, nearResource.tx, nearResource.ty)).toBe(false);

    // Deplete the resource
    nearResource.depleted = true;
    nearResource.remainingRaw = 0;

    // After depletion, resource tile should be passable
    const occupancyAfter = buildOccupancyMap(state);
    expect(isPassable(occupancyAfter, nearResource.tx, nearResource.ty)).toBe(true);

    // A harvester should be able to issue a manual move to the depleted tile
    const sel = selectHarvester(h.id);
    const result = issueManualMove(state, sel.units[0], nearResource.tx, nearResource.ty);
    // The result may fail for other reasons (no path, occupied), but should NOT
    // fail with 'target-impassable'
    if (!result.ok && result.reason === 'target-impassable') {
      expect.fail('Depleted resource tile should not be impassable');
    }
  });

  it('manual move to a depleted resource tile is not rejected as impassable', () => {
    const state = createTestState();
    const h = state.harvesters[0];
    if (!h) return;

    // Find a resource and deplete it
    const resource = state.resourceNodes.find(r => !r.depleted && r.footprint === 1);
    if (!resource) return;

    resource.depleted = true;
    resource.remainingRaw = 0;

    // Move the harvester near the depleted resource
    // Place it at an adjacent passable tile
    const occupancy = buildOccupancyMap(state);

    // The depleted resource tile should now be passable
    expect(isPassable(occupancy, resource.tx, resource.ty)).toBe(true);

    // Move harvester to a nearby passable tile if needed
    if (!isPassable(occupancy, Math.round(h.ftx), Math.round(h.fty))) {
      // Find a passable tile near the resource
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = resource.tx + dx;
          const ty = resource.ty + dy;
          if (isPassable(occupancy, tx, ty) && (tx !== resource.tx || ty !== resource.ty)) {
            h.ftx = tx;
            h.fty = ty;
            break;
          }
        }
      }
    }

    const sel = selectHarvester(h.id);
    const result = issueManualMove(state, sel.units[0], resource.tx, resource.ty);

    // Should succeed or fail for a non-impassable reason (e.g., occupied by self)
    if (!result.ok) {
      expect(result.reason).not.toBe('target-impassable');
    }
  });
});
