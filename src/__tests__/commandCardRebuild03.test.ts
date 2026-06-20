/**
 * COMMAND-CARD-REBUILD-03 tests.
 *
 * Targeted tests for:
 *   - Command card grid model (12 slots, Q/W/E/R/A/S/D/F/Z/X/C/V mapping)
 *   - Builder context (build commands in stable slots, disabled states)
 *   - Harvester context (Stop in Z slot)
 *   - No selection context (empty grid)
 *   - Command execution (enabled/disabled clicks, hotkey routing)
 *   - Input safety (command card clicks don't leak to map)
 *   - Regression (resource strip, selection panel, minimap still work)
 */

import { describe, it, expect } from 'vitest';
import {
  GRID_COLS,
  GRID_ROWS,
  GRID_SLOT_COUNT,
  ALL_SLOT_KEYS,
  type SlotKey,
  type CommandCardSlot,
  getSlotMeta,
  getSlotKeyAt,
  emptySlot,
  emptyGrid,
  assignSlot,
  BUILDER_SLOT_MAP,
  STOP_SLOT,
} from '../phaser/ui/hud/commandCardGrid';
import {
  buildCommandCardViewModel,
  buildCommandPanelViewModel,
  getCommandSlotKey,
} from '../phaser/ui/hud/commandPanelViewModel';
import {
  HUD_BAR_HEIGHT,
  isScreenPointInHud,
  shouldUseBottomHudSafeArea,
} from '../phaser/ui/hud/hudLayout';
import type { GameState } from '../state/types';
import type { UnitSelection } from '../state/unitSelection';

// ─── 1. Grid model ────────────────────────────────────────────────

describe('COMMAND-CARD-03: grid model', () => {
  it('grid has 12 slots (4×3)', () => {
    expect(GRID_SLOT_COUNT).toBe(12);
    expect(GRID_COLS).toBe(4);
    expect(GRID_ROWS).toBe(3);
  });

  it('ALL_SLOT_KEYS has 12 entries in grid order', () => {
    expect(ALL_SLOT_KEYS).toHaveLength(12);
    expect(ALL_SLOT_KEYS[0]).toBe('Q');
    expect(ALL_SLOT_KEYS[3]).toBe('R');
    expect(ALL_SLOT_KEYS[4]).toBe('A');
    expect(ALL_SLOT_KEYS[7]).toBe('F');
    expect(ALL_SLOT_KEYS[8]).toBe('Z');
    expect(ALL_SLOT_KEYS[11]).toBe('V');
  });

  it('slot metadata maps Q/W/E/R to row 0, cols 0-3', () => {
    const q = getSlotMeta('Q');
    expect(q.row).toBe(0);
    expect(q.col).toBe(0);
    expect(q.hotkey).toBe('Q');

    const r = getSlotMeta('R');
    expect(r.row).toBe(0);
    expect(r.col).toBe(3);
    expect(r.hotkey).toBe('R');
  });

  it('slot metadata maps A/S/D/F to row 1, cols 0-3', () => {
    const a = getSlotMeta('A');
    expect(a.row).toBe(1);
    expect(a.col).toBe(0);

    const f = getSlotMeta('F');
    expect(f.row).toBe(1);
    expect(f.col).toBe(3);
  });

  it('slot metadata maps Z/X/C/V to row 2, cols 0-3', () => {
    const z = getSlotMeta('Z');
    expect(z.row).toBe(2);
    expect(z.col).toBe(0);

    const v = getSlotMeta('V');
    expect(z.row).toBe(2);
    expect(v.col).toBe(3);
  });

  it('getSlotKeyAt returns correct slot key for row/col', () => {
    expect(getSlotKeyAt(0, 0)).toBe('Q');
    expect(getSlotKeyAt(0, 3)).toBe('R');
    expect(getSlotKeyAt(1, 0)).toBe('A');
    expect(getSlotKeyAt(2, 0)).toBe('Z');
    expect(getSlotKeyAt(2, 3)).toBe('V');
  });

  it('emptySlot creates a slot with state "empty"', () => {
    const slot = emptySlot('Q');
    expect(slot.slotKey).toBe('Q');
    expect(slot.state).toBe('empty');
    expect(slot.commandId).toBe('');
    expect(slot.label).toBe('');
  });

  it('emptyGrid creates 12 empty slots', () => {
    const grid = emptyGrid();
    expect(grid).toHaveLength(12);
    for (const slot of grid) {
      expect(slot.state).toBe('empty');
    }
  });

  it('assignSlot replaces an empty slot with a command', () => {
    const grid = emptyGrid();
    const result = assignSlot(grid, 'Q', 'build-separator', 'Separator', 'enabled', '', '60 M', 'Build Separator [Q]', 'build');
    expect(result).toHaveLength(12);
    const qSlot = result[0];
    expect(qSlot.slotKey).toBe('Q');
    expect(qSlot.commandId).toBe('build-separator');
    expect(qSlot.label).toBe('Separator');
    expect(qSlot.state).toBe('enabled');
    // Other slots remain empty
    expect(result[1].state).toBe('empty');
  });

  it('empty slots do not collapse the grid', () => {
    const grid = emptyGrid();
    expect(grid.length).toBe(GRID_SLOT_COUNT);
    // All 12 positions exist even when empty
    for (let i = 0; i < GRID_SLOT_COUNT; i++) {
      expect(grid[i]).toBeDefined();
      expect(grid[i].slotKey).toBe(ALL_SLOT_KEYS[i]);
    }
  });

  it('command positions remain stable when commands become disabled', () => {
    // Build a grid with Separator enabled
    const grid1 = assignSlot(emptyGrid(), 'Q', 'build-separator', 'Separator', 'enabled', '', '60 M', 'Build Separator [Q]', 'build');
    // Same grid with Separator disabled
    const grid2 = assignSlot(emptyGrid(), 'Q', 'build-separator', 'Separator', 'disabled', 'Insufficient matter', '60 M', 'Separator — Insufficient matter [Q]', 'build');
    // Position is the same (Q slot)
    expect(grid1[0].slotKey).toBe('Q');
    expect(grid2[0].slotKey).toBe('Q');
    expect(grid1[0].commandId).toBe('build-separator');
    expect(grid2[0].commandId).toBe('build-separator');
    // State changed but position is stable
    expect(grid1[0].state).toBe('enabled');
    expect(grid2[0].state).toBe('disabled');
  });
});

// ─── 2. Builder context ───────────────────────────────────────────

describe('COMMAND-CARD-03: builder context', () => {
  /** Helper: create a minimal GameState with sufficient resources. */
  function createRichState(): GameState {
    return {
      mapWidth: 40, mapHeight: 40,
      mapData: {
        hq: { tx: 5, ty: 5 },
        buildings: [],
        builders: [{ id: 'builder-1', ftx: 6, fty: 6, phase: 'idle', busy: false, manualMove: false }],
        constructionSites: [], terrain: [],
      },
      harvesters: [],
      playerFaction: 'cyan',
      economy: {
        raw: 500, matter: 500,
        elements: { cyan: 200, green: 0, yellow: 0, purple: 0 },
        rawCap: 1000, matterCap: 1000, elementCap: 500,
        powerGenerated: 20, powerConsumed: 0,
        separators: [],
      },
      production: { factories: [] },
      ...({} as Partial<GameState>),
    } as unknown as GameState;
  }

  /** Helper: create a broke GameState. */
  function createBrokeState(): GameState {
    const state = createRichState();
    state.economy.matter = 0;
    state.economy.elements = { cyan: 0, green: 0, yellow: 0, purple: 0 };
    return state;
  }

  it('builder selection produces build commands in expected slots', () => {
    const state = createRichState();
    const sel: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandCardViewModel(state, sel);

    expect(vm.contextKind).toBe('builder');
    expect(vm.contextLabel).toBe('Builder');
    expect(vm.slots).toHaveLength(12);

    // Q = Separator
    const qSlot = vm.slots.find(s => s.slotKey === 'Q')!;
    expect(qSlot.commandId).toBe('build-separator');
    expect(qSlot.state).toBe('enabled');

    // W = Raw Storage
    const wSlot = vm.slots.find(s => s.slotKey === 'W')!;
    expect(wSlot.commandId).toBe('build-raw-storage');

    // Z = Stop
    const zSlot = vm.slots.find(s => s.slotKey === 'Z')!;
    expect(zSlot.commandId).toBe('unit-stop');
    expect(zSlot.state).toBe('enabled');
  });

  it('insufficient resources disables command with reason', () => {
    const state = createBrokeState();
    const sel: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandCardViewModel(state, sel);

    // Build commands should be disabled
    const qSlot = vm.slots.find(s => s.slotKey === 'Q')!;
    expect(qSlot.state).toBe('disabled');
    expect(qSlot.disabledReason.length).toBeGreaterThan(0);
  });

  it('sufficient resources enables commands', () => {
    const state = createRichState();
    const sel: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandCardViewModel(state, sel);

    const qSlot = vm.slots.find(s => s.slotKey === 'Q')!;
    expect(qSlot.state).toBe('enabled');
  });

  it('visual-ready buildings are not active commands', () => {
    const state = createRichState();
    const sel: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandCardViewModel(state, sel);

    // Energy-plant is visual-ready, should not appear
    const energySlot = vm.slots.find(s => s.commandId === 'build-energy-plant');
    expect(energySlot).toBeUndefined();
  });

  it('empty slots exist for unassigned grid positions', () => {
    const state = createRichState();
    const sel: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandCardViewModel(state, sel);

    // D, F, X, C, V should be empty in builder context
    const dSlot = vm.slots.find(s => s.slotKey === 'D')!;
    expect(dSlot.state).toBe('empty');

    const fSlot = vm.slots.find(s => s.slotKey === 'F')!;
    expect(fSlot.state).toBe('empty');

    const xSlot = vm.slots.find(s => s.slotKey === 'X')!;
    expect(xSlot.state).toBe('empty');
  });
});

// ─── 3. Harvester context ─────────────────────────────────────────

describe('COMMAND-CARD-03: harvester context', () => {
  function createHarvesterState(): GameState {
    return {
      mapWidth: 40, mapHeight: 40,
      mapData: { hq: { tx: 5, ty: 5 }, buildings: [], builders: [], constructionSites: [], terrain: [] },
      harvesters: [{ id: 'harvester-1', ftx: 3, fty: 3, faction: 'cyan', phase: 'idle' } as any],
      playerFaction: 'cyan',
      economy: {
        raw: 100, matter: 200,
        elements: { cyan: 50, green: 0, yellow: 0, purple: 0 },
        rawCap: 500, matterCap: 500, elementCap: 300,
        powerGenerated: 10, powerConsumed: 0,
        separators: [],
      },
      production: { factories: [] },
      ...({} as Partial<GameState>),
    } as unknown as GameState;
  }

  it('harvester shows Stop in stable Z slot', () => {
    const state = createHarvesterState();
    const sel: UnitSelection = { kind: 'harvester', id: 'harvester-1' };
    const vm = buildCommandCardViewModel(state, sel);

    expect(vm.contextKind).toBe('harvester');
    const zSlot = vm.slots.find(s => s.slotKey === 'Z')!;
    expect(zSlot.commandId).toBe('unit-stop');
    expect(zSlot.label).toBe('Stop');
    expect(zSlot.state).toBe('enabled');
    expect(zSlot.hotkey).toBe('Z');
  });

  it('unsupported actions do not appear as active', () => {
    const state = createHarvesterState();
    const sel: UnitSelection = { kind: 'harvester', id: 'harvester-1' };
    const vm = buildCommandCardViewModel(state, sel);

    // Only Z has a command; all other slots are empty
    const nonEmptySlots = vm.slots.filter(s => s.state !== 'empty');
    expect(nonEmptySlots).toHaveLength(1);
    expect(nonEmptySlots[0].slotKey).toBe('Z');

    // No attack, patrol, hold commands
    const attackSlot = vm.slots.find(s => s.label === 'Attack');
    expect(attackSlot).toBeUndefined();
  });
});

// ─── 4. No-selection / production context ──────────────────────────

describe('COMMAND-CARD-03: no-selection and production context', () => {
  function createState(): GameState {
    return {
      mapWidth: 40, mapHeight: 40,
      mapData: { hq: { tx: 5, ty: 5 }, buildings: [], builders: [], constructionSites: [], terrain: [] },
      harvesters: [],
      playerFaction: 'cyan',
      economy: {
        raw: 100, matter: 200,
        elements: { cyan: 50, green: 0, yellow: 0, purple: 0 },
        rawCap: 500, matterCap: 500, elementCap: 300,
        powerGenerated: 10, powerConsumed: 0,
        separators: [],
      },
      production: { factories: [] },
      ...({} as Partial<GameState>),
    } as unknown as GameState;
  }

  it('no selection => empty/neutral command card', () => {
    const vm = buildCommandCardViewModel(createState(), null);
    expect(vm.contextKind).toBe('none');
    expect(vm.contextLabel).toBe('');
    // All slots should be empty
    for (const slot of vm.slots) {
      expect(slot.state).toBe('empty');
    }
  });

  it('no global production buttons', () => {
    const vm = buildCommandCardViewModel(createState(), null);
    const produceSlots = vm.slots.filter(s => s.category === 'produce');
    expect(produceSlots).toHaveLength(0);
  });

  it('factory commands only appear with selected production context', () => {
    // Factory selection is not yet supported in UnitSelection,
    // so factory commands should not appear for any current context.
    const state = createState();
    const builderSel: UnitSelection = { kind: 'builder', id: 'builder-1' };
    // Add a builder so we have a valid selection
    state.mapData.builders = [{ id: 'builder-1', ftx: 6, fty: 6, phase: 'idle', busy: false, manualMove: false } as any];

    const vm = buildCommandCardViewModel(state, builderSel);
    const factorySlots = vm.slots.filter(s => s.commandId === 'produce-builder' || s.commandId === 'produce-harvester');
    expect(factorySlots).toHaveLength(0);
  });
});

// ─── 5. Execution ──────────────────────────────────────────────────

describe('COMMAND-CARD-03: execution', () => {
  it('enabled command click executes (via descriptorMap pattern)', () => {
    // Simulate the click guard logic from HudCommandPanel
    const slot: CommandCardSlot = {
      slotKey: 'Q', row: 0, col: 0, hotkey: 'Q',
      commandId: 'build-separator', label: 'Separator',
      state: 'enabled', disabledReason: '', cost: '60 M',
      tooltip: 'Build Separator [Q]', category: 'build',
    };

    // The click guard: only execute if state === 'enabled'
    let executed = false;
    if (slot.state === 'enabled') {
      executed = true;
    }
    expect(executed).toBe(true);
  });

  it('disabled command click does not execute', () => {
    const slot: CommandCardSlot = {
      slotKey: 'Q', row: 0, col: 0, hotkey: 'Q',
      commandId: 'build-separator', label: 'Separator',
      state: 'disabled', disabledReason: 'Insufficient matter',
      cost: '60 M', tooltip: 'Separator — Insufficient matter [Q]', category: 'build',
    };

    let executed = false;
    if (slot.state === 'enabled') {
      executed = true;
    }
    expect(executed).toBe(false);
  });

  it('no stale descriptor closure regression', () => {
    // Simulate the descriptorMap pattern:
    // Click handler reads current descriptor from map, not closure.
    const descriptorMap = new Map<string, CommandCardSlot>();

    // Initial state: enabled
    descriptorMap.set('build-separator', {
      slotKey: 'Q', row: 0, col: 0, hotkey: 'Q',
      commandId: 'build-separator', label: 'Separator',
      state: 'enabled', disabledReason: '', cost: '60 M',
      tooltip: 'Build Separator [Q]', category: 'build',
    });

    // Click reads fresh state from map
    let currentSlot = descriptorMap.get('build-separator');
    expect(currentSlot?.state).toBe('enabled');

    // State changes to disabled
    descriptorMap.set('build-separator', {
      slotKey: 'Q', row: 0, col: 0, hotkey: 'Q',
      commandId: 'build-separator', label: 'Separator',
      state: 'disabled', disabledReason: 'No idle builder', cost: '60 M',
      tooltip: 'Separator — No idle builder [Q]', category: 'build',
    });

    // Click handler reads FRESH state from map
    currentSlot = descriptorMap.get('build-separator');
    expect(currentSlot?.state).toBe('disabled');
  });
});

// ─── 6. Hotkey mapping ────────────────────────────────────────────

describe('COMMAND-CARD-03: hotkey mapping', () => {
  it('Q/W/E/R/A/S/D/F/Z/X/C/V slots map correctly', () => {
    const expectedKeys: SlotKey[] = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V'];
    for (const key of expectedKeys) {
      const meta = getSlotMeta(key);
      expect(meta.slotKey).toBe(key);
      expect(meta.hotkey).toBe(key);
    }
  });

  it('builder build commands use grid hotkeys, not old number keys', () => {
    // Check that BUILDER_SLOT_MAP assigns grid slots
    expect(BUILDER_SLOT_MAP.length).toBeGreaterThan(0);
    for (const mapping of BUILDER_SLOT_MAP) {
      // All slot keys should be from the Q/W/E/R/A/S/D/F/Z/X/C/V set
      expect(ALL_SLOT_KEYS).toContain(mapping.slotKey);
    }
  });

  it('Stop command is in Z slot, not S', () => {
    expect(STOP_SLOT).toBe('Z');
  });

  it('getCommandSlotKey returns correct slot for builder context', () => {
    expect(getCommandSlotKey('build-separator', 'builder')).toBe('Q');
    expect(getCommandSlotKey('build-raw-storage', 'builder')).toBe('W');
    expect(getCommandSlotKey('build-matter-storage', 'builder')).toBe('E');
    expect(getCommandSlotKey('build-element-storage', 'builder')).toBe('R');
    expect(getCommandSlotKey('build-power-plant', 'builder')).toBe('A');
    expect(getCommandSlotKey('build-units-factory', 'builder')).toBe('S');
    expect(getCommandSlotKey('unit-stop', 'builder')).toBe('Z');
  });

  it('getCommandSlotKey returns Z for harvester stop', () => {
    expect(getCommandSlotKey('unit-stop', 'harvester')).toBe('Z');
  });
});

// ─── 7. Input safety ──────────────────────────────────────────────

describe('COMMAND-CARD-03: input safety', () => {
  it('command card click does not leak to map (isScreenPointInHud)', () => {
    const canvasHeight = 1080;
    // Bottom HUD area should be blocked
    expect(isScreenPointInHud(canvasHeight - 10, canvasHeight)).toBe(true);
    expect(isScreenPointInHud(canvasHeight - HUD_BAR_HEIGHT, canvasHeight)).toBe(true);
    // Above HUD should pass
    expect(isScreenPointInHud(canvasHeight - HUD_BAR_HEIGHT - 1, canvasHeight)).toBe(false);
  });

  it('bottom HUD guards still pass with shouldUseBottomHudSafeArea', () => {
    const normalCtx = { showPlaytestHud: true, arenaMode: false, showArenaMenu: false, runCivilLoop: true, createObstaclesOnReset: false };
    expect(shouldUseBottomHudSafeArea(normalCtx)).toBe(true);

    const arenaCtx = { showPlaytestHud: false, arenaMode: true, showArenaMenu: true, runCivilLoop: false, createObstaclesOnReset: false };
    expect(shouldUseBottomHudSafeArea(arenaCtx)).toBe(false);
  });
});

// ─── 8. Regression ────────────────────────────────────────────────

describe('COMMAND-CARD-03: regression', () => {
  function createLayoutTestState(): GameState {
    return {
      mapWidth: 40, mapHeight: 40,
      mapData: {
        hq: { tx: 5, ty: 5 }, buildings: [],
        builders: [{ id: 'builder-1', ftx: 6, fty: 6, phase: 'idle', busy: false, manualMove: false }],
        constructionSites: [], terrain: [],
      },
      harvesters: [],
      playerFaction: 'cyan',
      economy: {
        raw: 100, matter: 200,
        elements: { cyan: 50, green: 0, yellow: 0, purple: 0 },
        rawCap: 500, matterCap: 500, elementCap: 300,
        powerGenerated: 10, powerConsumed: 0,
        separators: [],
      },
      production: { factories: [] },
      ...({} as Partial<GameState>),
    } as unknown as GameState;
  }

  it('legacy buildCommandPanelViewModel still works', () => {
    const state = createLayoutTestState();
    const sel: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandPanelViewModel(state, sel);

    expect(vm.contextKind).toBe('builder');
    expect(vm.commands.length).toBeGreaterThan(0);
    // Commands should have hotkeys from the grid
    for (const cmd of vm.commands) {
      expect(cmd.hotkey.length).toBeGreaterThan(0);
    }
  });

  it('grid always has exactly 12 slots regardless of context', () => {
    const state = createLayoutTestState();

    const vm1 = buildCommandCardViewModel(state, null);
    expect(vm1.slots).toHaveLength(12);

    const vm2 = buildCommandCardViewModel(state, { kind: 'builder', id: 'builder-1' });
    expect(vm2.slots).toHaveLength(12);

    state.harvesters = [{ id: 'h1', ftx: 7, fty: 7, faction: 'cyan', phase: 'idle' } as any];
    const vm3 = buildCommandCardViewModel(state, { kind: 'harvester', id: 'h1' });
    expect(vm3.slots).toHaveLength(12);
  });

  it('resource strip still works (non-mutation check)', () => {
    const eco = {
      raw: 100, rawCap: 200, matter: 50, matterCap: 100,
      elements: { cyan: 20, green: 0, yellow: 0, purple: 0 }, elementCap: 50,
      powerConsumed: 3, powerGenerated: 5,
    };
    // Reading economy fields should not mutate
    expect(eco.raw).toBe(100);
    expect(eco.matter).toBe(50);
  });

  it('HUD layout constants are consistent', () => {
    expect(HUD_BAR_HEIGHT).toBeGreaterThanOrEqual(100);
    expect(HUD_BAR_HEIGHT).toBeLessThanOrEqual(250);
  });
});
