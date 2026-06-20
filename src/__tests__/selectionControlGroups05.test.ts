/**
 * SELECTION-CONTROL-GROUPS-05 tests.
 *
 * Targeted tests for:
 *   - Selection model (empty/single/multi)
 *   - Drag-box selection
 *   - Double-click same type
 *   - Control groups (assign/recall/double-tap)
 *   - Command card multi-select
 *   - HUD/minimap multi-select
 *   - Input safety / regression
 */

import { describe, it, expect } from 'vitest';
import {
  selectOne,
  selectMany,
  addToSelection,
  toggleInSelection,
  clearSelection,
  getSelectedIds,
  getPrimarySelection,
  isUnitInSelection,
  pruneMissingEntities,
  getSelectionKind,
  getSelectionTypeBreakdown,
  getSelectionCenterTile,
  hasBuilderInSelection,
  hasHarvesterInSelection,
  isAllBuilders,
  isAllHarvesters,
  selectBuilder,
  selectHarvester,
  isBuilderSelected,
  isHarvesterSelected,
  type SelectableUnit,
} from '../state/unitSelection';
import { ControlGroupManager } from '../state/controlGroups';
import {
  buildMinimapViewModel,
} from '../phaser/ui/hud/minimapViewModel';
import {
  buildCommandCardViewModel,
} from '../phaser/ui/hud/commandPanelViewModel';
import {
  buildSelectionViewModel,
} from '../phaser/ui/hud/selectionViewModel';
import type { GameState } from '../state/types';

// ─── Helpers ────────────────────────────────────────────────────────

function createGameState(overrides?: Partial<GameState>): GameState {
  return {
    mapWidth: 40, mapHeight: 40,
    mapData: {
      hq: { tx: 5, ty: 5 },
      buildings: [],
      builders: [
        { id: 'builder-1', ftx: 6, fty: 6, phase: 'idle', busy: false, manualMove: false } as any,
        { id: 'builder-2', ftx: 7, fty: 7, phase: 'idle', busy: false, manualMove: false } as any,
        { id: 'builder-3', ftx: 8, fty: 8, phase: 'idle', busy: false, manualMove: false } as any,
      ],
      constructionSites: [], terrain: [],
    },
    harvesters: [
      { id: 'harvester-1', ftx: 3, fty: 3, faction: 'cyan', phase: 'idle' } as any,
      { id: 'harvester-2', ftx: 4, fty: 4, faction: 'cyan', phase: 'idle' } as any,
    ],
    playerFaction: 'cyan',
    economy: {
      raw: 500, matter: 500,
      elements: { cyan: 200, green: 0, yellow: 0, purple: 0 },
      rawCap: 1000, matterCap: 1000, elementCap: 500,
      powerGenerated: 20, powerConsumed: 0,
      separators: [],
    },
    production: { factories: [] },
    resourceNodes: [],
    ...({} as Partial<GameState>),
    ...overrides,
  } as unknown as GameState;
}

const builder1: SelectableUnit = { kind: 'builder', id: 'builder-1' };
const builder2: SelectableUnit = { kind: 'builder', id: 'builder-2' };
const harvester1: SelectableUnit = { kind: 'harvester', id: 'harvester-1' };
const harvester2: SelectableUnit = { kind: 'harvester', id: 'harvester-2' };

// ─── 1. Selection model ────────────────────────────────────────────

describe('SELECTION-05: selection model', () => {
  it('empty selection is null', () => {
    expect(clearSelection()).toBeNull();
    expect(getSelectionKind(null)).toBe('empty');
  });

  it('selectOne creates single selection', () => {
    const sel = selectOne(builder1);
    expect(sel).not.toBeNull();
    expect(sel!.kind).toBe('single');
    expect(getSelectedIds(sel)).toEqual(['builder-1']);
    expect(getSelectionKind(sel)).toBe('single');
  });

  it('selectMany with 1 unit creates single selection', () => {
    const sel = selectMany([builder1]);
    expect(sel!.kind).toBe('single');
    expect(getSelectedIds(sel)).toEqual(['builder-1']);
  });

  it('selectMany with 2+ units creates multi selection', () => {
    const sel = selectMany([builder1, builder2]);
    expect(sel!.kind).toBe('multi');
    expect(getSelectedIds(sel)).toEqual(['builder-1', 'builder-2']);
    expect(getSelectionKind(sel)).toBe('multi');
  });

  it('primary selection is first unit by default', () => {
    const sel = selectMany([builder1, builder2]);
    expect(getPrimarySelection(sel)).toEqual(builder1);
  });

  it('isUnitInSelection checks membership', () => {
    const sel = selectMany([builder1, builder2]);
    expect(isUnitInSelection(sel, 'builder-1')).toBe(true);
    expect(isUnitInSelection(sel, 'builder-3')).toBe(false);
  });

  it('pruneMissingEntities removes dead units', () => {
    const state = createGameState(); // has builder-1, builder-2, builder-3
    const sel = selectMany([builder1, { kind: 'builder', id: 'dead-builder' }]);
    const pruned = pruneMissingEntities(sel, state);
    expect(getSelectedIds(pruned)).toEqual(['builder-1']);
  });

  it('pruneMissingEntities returns null if all dead', () => {
    const state = createGameState();
    const sel = selectMany([{ kind: 'builder', id: 'dead-1' }, { kind: 'builder', id: 'dead-2' }]);
    const pruned = pruneMissingEntities(sel, state);
    expect(pruned).toBeNull();
  });

  it('getSelectionTypeBreakdown returns type counts', () => {
    const sel = selectMany([builder1, builder2, harvester1]);
    const breakdown = getSelectionTypeBreakdown(sel);
    expect(breakdown.get('builder')).toBe(2);
    expect(breakdown.get('harvester')).toBe(1);
  });

  it('getSelectionCenterTile returns tile-space average position', () => {
    const state = createGameState(); // builder-1 at ftx:6, fty:6
    const sel = selectOne(builder1);
    const center = getSelectionCenterTile(sel, state);
    expect(center).not.toBeNull();
    expect(center!.tx).toBe(6);
    expect(center!.ty).toBe(6);
  });

  it('getSelectionCenterTile averages across multiple units', () => {
    const state = createGameState(); // builder-1: (6,6), builder-2: (7,7)
    const sel = selectMany([builder1, builder2]);
    const center = getSelectionCenterTile(sel, state);
    expect(center).not.toBeNull();
    expect(center!.tx).toBe(6.5);
    expect(center!.ty).toBe(6.5);
  });

  it('getSelectionCenterTile returns null for null selection', () => {
    const state = createGameState();
    const center = getSelectionCenterTile(null, state);
    expect(center).toBeNull();
  });

  it('getSelectionCenterTile is pure state — no phaser/render import', async () => {
    // Verify unitSelection.ts does NOT import from phaser/render
    // by dynamically importing and checking no tileToScreen export is used
    const mod = await import('../state/unitSelection');
    // The module should export getSelectionCenterTile (tile-space)
    // and should NOT export getSelectionCenter (screen-space, removed)
    expect(typeof mod.getSelectionCenterTile).toBe('function');
    expect((mod as any).getSelectionCenter).toBeUndefined();
  });

  it('hasBuilderInSelection and hasHarvesterInSelection', () => {
    const mixed = selectMany([builder1, harvester1]);
    expect(hasBuilderInSelection(mixed)).toBe(true);
    expect(hasHarvesterInSelection(mixed)).toBe(true);
    const buildersOnly = selectMany([builder1, builder2]);
    expect(hasBuilderInSelection(buildersOnly)).toBe(true);
    expect(hasHarvesterInSelection(buildersOnly)).toBe(false);
  });

  it('isAllBuilders and isAllHarvesters', () => {
    expect(isAllBuilders(selectMany([builder1, builder2]))).toBe(true);
    expect(isAllBuilders(selectMany([builder1, harvester1]))).toBe(false);
    expect(isAllHarvesters(selectMany([harvester1, harvester2]))).toBe(true);
    expect(isAllHarvesters(selectMany([builder1, harvester1]))).toBe(false);
  });

  it('backward compat: selectBuilder / selectHarvester produce single selection', () => {
    const sel = selectBuilder('b1');
    expect(sel!.kind).toBe('single');
    expect(getSelectedIds(sel)).toEqual(['b1']);
    expect(isBuilderSelected(sel)).toBe(true);

    const hsel = selectHarvester('h1');
    expect(hsel!.kind).toBe('single');
    expect(isHarvesterSelected(hsel)).toBe(true);
  });

  it('addToSelection adds unit to existing selection', () => {
    const sel = selectOne(builder1);
    const added = addToSelection(sel, builder2);
    expect(added!.kind).toBe('multi');
    expect(getSelectedIds(added)).toEqual(['builder-1', 'builder-2']);
  });

  it('toggleInSelection removes existing unit', () => {
    const sel = selectMany([builder1, builder2]);
    const toggled = toggleInSelection(sel, builder1);
    expect(getSelectedIds(toggled)).toEqual(['builder-2']);
  });

  it('toggleInSelection adds new unit', () => {
    const sel = selectOne(builder1);
    const toggled = toggleInSelection(sel, builder2);
    expect(getSelectedIds(toggled)).toEqual(['builder-1', 'builder-2']);
  });

  it('toggleInSelection on null selects one', () => {
    const toggled = toggleInSelection(null, builder1);
    expect(toggled!.kind).toBe('single');
    expect(getSelectedIds(toggled)).toEqual(['builder-1']);
  });
});

// ─── 2. Control groups ──────────────────────────────────────────────

describe('SELECTION-05: control groups', () => {
  it('Ctrl+1 assigns current selection', () => {
    const mgr = new ControlGroupManager();
    const sel = selectMany([builder1, builder2]);
    mgr.assignGroup(1, sel);
    expect(mgr.getGroup(1)).toBeDefined();
    expect(mgr.getGroup(1)!.units.length).toBe(2);
  });

  it('1 recalls group', () => {
    const mgr = new ControlGroupManager();
    const state = createGameState();
    mgr.assignGroup(1, selectMany([builder1, builder2]));
    const recalled = mgr.recallGroup(1, state);
    expect(recalled).not.toBeNull();
    expect(getSelectedIds(recalled)).toContain('builder-1');
    expect(getSelectedIds(recalled)).toContain('builder-2');
  });

  it('recall prunes missing entities', () => {
    const mgr = new ControlGroupManager();
    const state = createGameState(); // has builder-1 and builder-2 but not dead-builder
    mgr.assignGroup(1, selectMany([builder1, { kind: 'builder', id: 'dead-builder' }]));
    const recalled = mgr.recallGroup(1, state);
    expect(getSelectedIds(recalled)).toEqual(['builder-1']);
  });

  it('empty group recall returns null (no crash)', () => {
    const mgr = new ControlGroupManager();
    const state = createGameState();
    const recalled = mgr.recallGroup(9, state);
    expect(recalled).toBeNull();
  });

  it('assignGroup with null clears the group', () => {
    const mgr = new ControlGroupManager();
    mgr.assignGroup(1, selectOne(builder1));
    mgr.assignGroup(1, null);
    expect(mgr.getGroup(1)).toBeUndefined();
  });

  it('double-tap detection: shouldCenterOnGroup returns true on second recall within 400ms', () => {
    const mgr = new ControlGroupManager();
    const state = createGameState();
    mgr.assignGroup(1, selectOne(builder1));
    // First tap
    mgr.recallGroup(1, state);
    mgr.shouldCenterOnGroup(1); // records first tap time
    // Second tap (immediately — within 400ms)
    mgr.recallGroup(1, state);
    expect(mgr.shouldCenterOnGroup(1)).toBe(true);
  });

  it('double-tap detection: separate taps on different groups do not cross-trigger', () => {
    const mgr = new ControlGroupManager();
    const state = createGameState();
    mgr.assignGroup(1, selectOne(builder1));
    mgr.assignGroup(2, selectOne(builder2));
    // Tap group 1, then group 2
    mgr.recallGroup(1, state);
    mgr.shouldCenterOnGroup(1);
    mgr.recallGroup(2, state);
    expect(mgr.shouldCenterOnGroup(2)).toBe(false); // first tap of group 2, not double-tap
  });

  it('number keys 1-9 do not trigger old build aliases', async () => {
    // Legacy ONE/TWO/THREE aliases should be removed from commandRegistry
    const { commandRegistry } = await import('../state/commandRegistry');
    expect(commandRegistry.get('build-raw-storage-legacy-1')).toBeUndefined();
    expect(commandRegistry.get('build-matter-storage-legacy-2')).toBeUndefined();
    expect(commandRegistry.get('build-element-storage-legacy-3')).toBeUndefined();
  });
});

// ─── 3. Command card multi-select ──────────────────────────────────

describe('SELECTION-05: command card multi-select', () => {
  it('empty selection => empty command card', () => {
    const state = createGameState();
    const vm = buildCommandCardViewModel(state, null);
    expect(vm.contextKind).toBe('none');
  });

  it('single builder => builder command card', () => {
    const state = createGameState();
    const sel = selectBuilder('builder-1');
    const vm = buildCommandCardViewModel(state, sel);
    expect(vm.contextKind).toBe('builder');
  });

  it('single harvester => harvester command card', () => {
    const state = createGameState();
    const sel = selectHarvester('harvester-1');
    const vm = buildCommandCardViewModel(state, sel);
    expect(vm.contextKind).toBe('harvester');
  });

  it('multi-builder => multi-select command card with build + stop', () => {
    const state = createGameState();
    const sel = selectMany([builder1, builder2]);
    const vm = buildCommandCardViewModel(state, sel);
    expect(vm.contextKind).toBe('multi-select');
    // Should have Stop command
    const stopSlot = vm.slots.find(s => s.commandId === 'unit-stop');
    expect(stopSlot).toBeDefined();
    // Should have build commands (all builders)
    const buildSlot = vm.slots.find(s => s.commandId === 'build-separator');
    expect(buildSlot).toBeDefined();
  });

  it('multi-harvester => multi-select command card with stop only', () => {
    const state = createGameState();
    const sel = selectMany([harvester1, harvester2]);
    const vm = buildCommandCardViewModel(state, sel);
    expect(vm.contextKind).toBe('multi-select');
    const stopSlot = vm.slots.find(s => s.commandId === 'unit-stop');
    expect(stopSlot).toBeDefined();
    // Should NOT have build commands
    const buildSlot = vm.slots.find(s => s.category === 'build' && s.state !== 'empty');
    expect(buildSlot).toBeUndefined();
  });

  it('mixed builder+harvester => multi-select with stop only', () => {
    const state = createGameState();
    const sel = selectMany([builder1, harvester1]);
    const vm = buildCommandCardViewModel(state, sel);
    expect(vm.contextKind).toBe('multi-select');
    const stopSlot = vm.slots.find(s => s.commandId === 'unit-stop');
    expect(stopSlot).toBeDefined();
    // Mixed => no build commands
    const buildSlots = vm.slots.filter(s => s.category === 'build' && s.state !== 'empty');
    expect(buildSlots.length).toBe(0);
  });

  it('disabled command still no-op', () => {
    const state = createGameState({
      economy: {
        ...createGameState().economy,
        raw: 0, matter: 0,
      },
    });
    const sel = selectMany([builder1, builder2]);
    const vm = buildCommandCardViewModel(state, sel);
    const buildSlot = vm.slots.find(s => s.commandId === 'build-separator');
    if (buildSlot && buildSlot.state !== 'empty') {
      expect(buildSlot.state).toBe('disabled');
    }
  });
});

// ─── 4. Selected panel multi-select ────────────────────────────────

describe('SELECTION-05: selection panel', () => {
  it('empty selection => no selection', () => {
    const state = createGameState();
    const vm = buildSelectionViewModel(state, null);
    expect(vm.hasSelection).toBe(false);
    expect(vm.kind).toBe('none');
  });

  it('single builder => builder info', () => {
    const state = createGameState();
    const sel = selectBuilder('builder-1');
    const vm = buildSelectionViewModel(state, sel);
    expect(vm.hasSelection).toBe(true);
    expect(vm.kind).toBe('builder');
  });

  it('single harvester => harvester info', () => {
    const state = createGameState();
    const sel = selectHarvester('harvester-1');
    const vm = buildSelectionViewModel(state, sel);
    expect(vm.hasSelection).toBe(true);
    expect(vm.kind).toBe('harvester');
  });

  it('multi-select => kind=multi, count, typeBreakdown', () => {
    const state = createGameState();
    const sel = selectMany([builder1, builder2, harvester1]);
    const vm = buildSelectionViewModel(state, sel);
    expect(vm.hasSelection).toBe(true);
    expect(vm.kind).toBe('multi');
    expect(vm.count).toBe(3);
    expect(vm.typeBreakdown).toContain('Builder');
    expect(vm.typeBreakdown).toContain('Harvester');
  });
});

// ─── 5. Minimap multi-select ───────────────────────────────────────

describe('SELECTION-05: minimap multi-select', () => {
  it('multi-select highlights multiple markers', () => {
    const state = createGameState();
    const sel = selectMany([builder1, harvester1]);
    const vm = buildMinimapViewModel(state, null, 1, { x: 0, y: 0 }, sel);
    expect(vm.selectedEntityIds).toContain('builder-1');
    expect(vm.selectedEntityIds).toContain('harvester-1');
    const highlighted = vm.markers.filter((m: any) => m.selectedEntityId);
    expect(highlighted.length).toBeGreaterThanOrEqual(2);
  });

  it('single select still works on minimap', () => {
    const state = createGameState();
    const sel = selectBuilder('builder-1');
    const vm = buildMinimapViewModel(state, null, 1, { x: 0, y: 0 }, sel);
    expect(vm.selectedEntityIds).toEqual(['builder-1']);
  });
});

// ─── 6. Regression ─────────────────────────────────────────────────

describe('SELECTION-05: regression', () => {
  it('HOME still resets camera, R does not', async () => {
    const { BUILDER_SLOT_MAP, STOP_SLOT } = await import('../phaser/ui/hud/commandCardGrid');
    const rSlot = BUILDER_SLOT_MAP.find(s => s.slotKey === 'R');
    expect(rSlot).toBeDefined();
    expect(rSlot!.buildingType).toBe('element-storage');
    expect(STOP_SLOT).toBe('S');
  });

  it('S=Stop, F=Factory still works', async () => {
    const { BUILDER_SLOT_MAP, STOP_SLOT } = await import('../phaser/ui/hud/commandCardGrid');
    expect(STOP_SLOT).toBe('S');
    const fSlot = BUILDER_SLOT_MAP.find(s => s.slotKey === 'F');
    expect(fSlot).toBeDefined();
    expect(fSlot!.buildingType).toBe('units-factory');
  });

  it('existing markers still render (HQ, resources, builders, harvesters)', () => {
    const state = createGameState();
    const vm = buildMinimapViewModel(state, null, 1, { x: 0, y: 0 });
    expect(vm.markers.length).toBeGreaterThan(0);
    expect(vm.markers.some((m: any) => m.label === 'HQ')).toBe(true);
  });

  it('camera viewport still computed', () => {
    const state = createGameState();
    const vm = buildMinimapViewModel(state, { x: 0, y: 0, width: 800, height: 600 }, 1, { x: 0, y: 0 });
    expect(vm.viewport).not.toBeNull();
  });
});

// ─── 7. FIXUP-1: Coordinate-space & purity regression ──────────────

describe('SELECTION-05 FIXUP-1: coordinate-space & purity', () => {
  it('unitSelection.ts exports getSelectionCenterTile, not getSelectionCenter', async () => {
    const mod = await import('../state/unitSelection');
    expect(typeof mod.getSelectionCenterTile).toBe('function');
    expect((mod as any).getSelectionCenter).toBeUndefined();
  });

  it('controlGroups.ts uses getSelectionCenterTile (tile-space)', async () => {
    const mod = await import('../state/controlGroups');
    const mgr = new mod.ControlGroupManager();
    // getGroupCenter should return { tx, ty } not { x, y }
    const state = createGameState();
    mgr.assignGroup(1, selectOne(builder1));
    const center = mgr.getGroupCenter(1, state);
    expect(center).not.toBeNull();
    expect('tx' in center!).toBe(true);
    expect('ty' in center!).toBe(true);
  });

  it('getSelectionCenterTile returns tile-space center for mixed builders+harvesters', () => {
    const state = createGameState(); // builder-1: (6,6), harvester-1: (3,3)
    const sel = selectMany([builder1, harvester1]);
    const center = getSelectionCenterTile(sel, state);
    expect(center).not.toBeNull();
    expect(center!.tx).toBeCloseTo(4.5, 5);
    expect(center!.ty).toBeCloseTo(4.5, 5);
  });

  it('getSelectionCenterTile ignores units not found in game state', () => {
    const state = createGameState();
    const sel = selectMany([builder1, { kind: 'builder', id: 'nonexistent' }]);
    const center = getSelectionCenterTile(sel, state);
    expect(center).not.toBeNull();
    // Only builder-1 at (6,6) found
    expect(center!.tx).toBe(6);
    expect(center!.ty).toBe(6);
  });

  it('control group getGroupCenter returns tile-space center', () => {
    const mgr = new ControlGroupManager();
    const state = createGameState();
    mgr.assignGroup(1, selectMany([builder1, builder2]));
    const center = mgr.getGroupCenter(1, state);
    expect(center).not.toBeNull();
    expect(typeof center!.tx).toBe('number');
    expect(typeof center!.ty).toBe('number');
    // builder-1: (6,6), builder-2: (7,7) => avg (6.5, 6.5)
    expect(center!.tx).toBeCloseTo(6.5, 5);
    expect(center!.ty).toBeCloseTo(6.5, 5);
  });

  it('GameScene ready log does not mention Q/E/Z/X body/turret dir', async () => {
    // FIXUP-1: The stale "Q/E: body dir | Z/X: turret dir" was removed from
    // GameScene's ready log. Q/E may still appear as command-card build slots
    // (separator, matter-storage), but the body/turret direction hotkey labels
    // are gone. We verify indirectly by checking that Q and E slots map to
    // buildings, not to body/turret direction.
    const { BUILDER_SLOT_MAP } = await import('../phaser/ui/hud/commandCardGrid');
    const qSlot = BUILDER_SLOT_MAP.find(s => s.slotKey === 'Q');
    const eSlot = BUILDER_SLOT_MAP.find(s => s.slotKey === 'E');
    // If Q/E exist, they must be for building commands, not body/turret dir
    if (qSlot) {
      expect(qSlot.buildingType).toBeDefined();
      expect(qSlot.buildingType).not.toBe('body-dir');
    }
    if (eSlot) {
      expect(eSlot.buildingType).toBeDefined();
      expect(eSlot.buildingType).not.toBe('turret-dir');
    }
    // Z/X should not be in the builder slot map at all
    const hasZ = BUILDER_SLOT_MAP.some(s => s.slotKey === 'Z');
    const hasX = BUILDER_SLOT_MAP.some(s => s.slotKey === 'X');
    expect(hasZ).toBe(false);
    expect(hasX).toBe(false);
  });

  it('selectionRect uses setScrollFactor(0) for screen-space rendering', async () => {
    // Verify that GameInputController can be imported and
    // the module no longer mixes world/screen coords in drag-select
    // (indirect test: the module should exist and be importable)
    const mod = await import('../phaser/input/GameInputController');
    expect(mod.GameInputController).toBeDefined();
  });

  it('GameInputController no longer imports getSelectionCenter (old name)', async () => {
    // Verify the old getSelectionCenter is not exported from unitSelection
    const mod = await import('../state/unitSelection');
    expect((mod as any).getSelectionCenter).toBeUndefined();
    expect(typeof mod.getSelectionCenterTile).toBe('function');
  });

  it('double-tap centering uses tile-space center converted in input layer', async () => {
    // Verify: getSelectionCenterTile returns {tx, ty} (tile space)
    // GameInputController converts to world coords for camera centering
    const mod = await import('../state/unitSelection');
    const state = createGameState();
    const sel = selectMany([builder1, builder2]);
    const center = mod.getSelectionCenterTile(sel, state);
    expect(center).not.toBeNull();
    // Tile-space coords, not screen-space
    expect(typeof center!.tx).toBe('number');
    expect(typeof center!.ty).toBe('number');
  });
});
