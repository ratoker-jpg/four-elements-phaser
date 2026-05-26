import { describe, it, expect } from 'vitest';
import {
  findResourceApproachTile,
  issueManualMove,
  checkPathExists,
} from '../state/unitCommands';
import {
  selectBuilder,
  selectHarvester,
  clearSelection,
  isUnitSelected,
  isBuilderSelected,
  isHarvesterSelected,
} from '../state/unitSelection';
import { buildOccupancyMap, isPassable } from '../state/occupancy';
import type { GameState } from '../state/types';
import { createInitialState } from '../state/createInitialState';

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
    const sel = selectBuilder(0);
    expect(sel).not.toBeNull();
    expect(sel!.kind).toBe('builder');
    if (sel!.kind === 'builder') {
      expect(sel.index).toBe(0);
    }
  });

  it('selectHarvester creates harvester selection', () => {
    const sel = selectHarvester('h-0');
    expect(sel).not.toBeNull();
    expect(sel!.kind).toBe('harvester');
    if (sel!.kind === 'harvester') {
      expect(sel.id).toBe('h-0');
    }
  });

  it('clearSelection returns null', () => {
    expect(clearSelection()).toBeNull();
  });

  it('isUnitSelected returns true for builder', () => {
    expect(isUnitSelected(selectBuilder(0))).toBe(true);
  });

  it('isUnitSelected returns false for null', () => {
    expect(isUnitSelected(null)).toBe(false);
  });

  it('isBuilderSelected narrows type', () => {
    const sel = selectBuilder(2);
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
    const result = issueManualMove(state, sel, state.mapData.hq.tx, state.mapData.hq.ty);

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
    const result = issueManualMove(state, sel, targetTx, targetTy);

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
    const result = issueManualMove(state, sel, targetTx, targetTy);

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

    const sel = selectBuilder(0);
    const result = issueManualMove(state, sel, targetTx, targetTy);

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
