/**
 * VISUAL-COMMAND-PANEL-02 tests.
 *
 * Targeted tests for:
 *   - Command panel view model: context → command descriptors
 *   - Build commands: availability, disabled reasons, costs
 *   - Stop command for harvester/builder
 *   - No selection → empty/neutral command panel (FIXUP-1)
 *   - Disabled → enabled state transition (FIXUP-1)
 *   - Descriptor map freshness (FIXUP-1)
 *   - Disabled tooltip behavior (FIXUP-1)
 */

import { describe, it, expect } from 'vitest';
import {
  buildCommandPanelViewModel,
  produceCommandDesc,
} from '../phaser/ui/hud/commandPanelViewModel';
import type { UnitSelection } from '../state/unitSelection';
import type { GameState } from '../state/types';
import {
  isScreenPointInHud,
  shouldUseBottomHudSafeArea,
} from '../phaser/ui/hud/hudLayout';
import type { ArenaModeContext } from '../state/arenaModeContext';

// ─── Test helpers ──────────────────────────────────────────────────

/** Create a minimal Normal Game state with enough economy for most commands. */
function createNormalGameState(overrides?: Partial<GameState['economy']>): GameState {
  return {
    mapWidth: 40,
    mapHeight: 40,
    mapData: {
      hq: { tx: 5, ty: 5 },
      buildings: [],
      builders: [
        { id: 'builder-1', ftx: 6, fty: 6, phase: 'idle', busy: false, manualMove: false },
      ],
      constructionSites: [],
      terrain: [],
    },
    harvesters: [],
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
      ...overrides,
    },
    production: {
      factories: [],
    },
    ...({} as Partial<GameState>),
  } as unknown as GameState;
}

/** Create a game state with a factory for production tests. */
function createGameStateWithFactory(): GameState {
  const state = createNormalGameState();
  state.mapData.buildings = [
    { type: 'units-factory', tx: 10, ty: 10 },
  ];
  state.production.factories = [
    {
      tx: 10,
      ty: 10,
      queue: [],
      active: false,
    },
  ];
  return state;
}

/** Create a game state with insufficient resources. */
function createBrokeGameState(): GameState {
  return createNormalGameState({
    matter: 5,
    elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
  });
}

/** Create a game state with a harvester. */
function createGameStateWithHarvester(overrides?: Partial<GameState['economy']>): GameState {
  const state = createNormalGameState(overrides);
  state.harvesters = [
    { id: 'harvester-1', ftx: 7, fty: 7, phase: 'idle', faction: 'cyan' } as any,
  ];
  return state;
}

// ─── 1. No selection → empty/neutral command panel (FIXUP-1) ────────

describe('COMMAND-PANEL-02-FIXUP-1: no selection', () => {
  it('returns context kind "none" with no selection', () => {
    const state = createGameStateWithFactory();
    const vm = buildCommandPanelViewModel(state, null);
    expect(vm.contextKind).toBe('none');
  });

  it('FIXUP-1: returns empty commands with no selection — no global production', () => {
    const state = createGameStateWithFactory();
    const vm = buildCommandPanelViewModel(state, null);
    expect(vm.commands.length).toBe(0);
  });

  it('FIXUP-1: no production commands without selection context', () => {
    const state = createGameStateWithFactory();
    const vm = buildCommandPanelViewModel(state, null);
    const prodCmds = vm.commands.filter(c => c.category === 'produce');
    expect(prodCmds.length).toBe(0);
  });

  it('FIXUP-1: no build commands without selection context', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, null);
    const buildCmds = vm.commands.filter(c => c.category === 'build');
    expect(buildCmds.length).toBe(0);
  });
});

// ─── 2. Builder selection → build commands appear ──────────────────

describe('COMMAND-PANEL-02: builder selection', () => {
  const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };

  it('returns context kind "builder"', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    expect(vm.contextKind).toBe('builder');
  });

  it('shows 6 build commands for gameplay-ready buildings', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const buildCmds = vm.commands.filter(c => c.category === 'build');
    expect(buildCmds.length).toBe(6);
  });

  it('build commands include expected command IDs', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const buildIds = vm.commands.filter(c => c.category === 'build').map(c => c.id);
    expect(buildIds).toContain('build-separator');
    expect(buildIds).toContain('build-raw-storage');
    expect(buildIds).toContain('build-units-factory');
  });

  it('build commands have cost display', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const buildCmds = vm.commands.filter(c => c.category === 'build');
    for (const cmd of buildCmds) {
      expect(cmd.cost).toBeTruthy();
    }
  });

  it('build commands have hotkey labels', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const buildCmds = vm.commands.filter(c => c.category === 'build');
    for (const cmd of buildCmds) {
      expect(cmd.hotkey).toBeTruthy();
    }
  });
});

// ─── 3. Insufficient resources → build command disabled with reason ─

describe('COMMAND-PANEL-02: resource-gated build commands', () => {
  const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };

  it('build commands are disabled when matter is insufficient', () => {
    const state = createBrokeGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const buildCmds = vm.commands.filter(c => c.category === 'build');
    const enabledCmds = buildCmds.filter(c => c.state === 'enabled');
    expect(enabledCmds.length).toBe(0);
  });

  it('disabled build commands have a disabled reason', () => {
    const state = createBrokeGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const disabledCmds = vm.commands.filter(c => c.state === 'disabled');
    for (const cmd of disabledCmds) {
      expect(cmd.disabledReason).toBeTruthy();
    }
  });
});

// ─── 4. Sufficient resources → build command enabled ───────────────

describe('COMMAND-PANEL-02: sufficient resources', () => {
  const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };

  it('build commands are enabled when resources are sufficient', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const buildCmds = vm.commands.filter(c => c.category === 'build');
    const enabledCmds = buildCmds.filter(c => c.state === 'enabled');
    expect(enabledCmds.length).toBeGreaterThan(0);
  });
});

// ─── 5. Harvester selection → stop only (FIXUP-1) ──────────────────

describe('COMMAND-PANEL-02-FIXUP-1: harvester selection', () => {
  const harvesterSelection: UnitSelection = { kind: 'harvester', id: 'harvester-1' };

  it('harvester selection shows stop command', () => {
    const state = createGameStateWithHarvester();
    const vm = buildCommandPanelViewModel(state, harvesterSelection);
    const stopCmd = vm.commands.find(c => c.id === 'unit-stop');
    expect(stopCmd).toBeDefined();
    expect(stopCmd!.label).toBe('Stop');
    expect(stopCmd!.hotkey).toBe('S');
    expect(stopCmd!.state).toBe('enabled');
  });

  it('FIXUP-1: harvester selection does NOT show production commands', () => {
    const state = createGameStateWithFactory();
    state.harvesters = [
      { id: 'harvester-1', ftx: 7, fty: 7, phase: 'idle', faction: 'cyan' } as any,
    ];
    const vm = buildCommandPanelViewModel(state, harvesterSelection);
    const prodCmds = vm.commands.filter(c => c.category === 'produce');
    expect(prodCmds.length).toBe(0);
  });

  it('FIXUP-1: harvester selection shows only stop command', () => {
    const state = createGameStateWithHarvester();
    const vm = buildCommandPanelViewModel(state, harvesterSelection);
    expect(vm.commands.length).toBe(1);
    expect(vm.commands[0].id).toBe('unit-stop');
  });

  it('builder selection does NOT show stop command', () => {
    const state = createNormalGameState();
    const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const stopCmd = vm.commands.find(c => c.id === 'unit-stop');
    expect(stopCmd).toBeUndefined();
  });
});

// ─── 6. Unknown entity → safe empty state ──────────────────────────

describe('COMMAND-PANEL-02: unknown entity safety', () => {
  it('returns safe empty state for null selection', () => {
    const state = createNormalGameState();
    const vm = buildCommandPanelViewModel(state, null);
    expect(vm.contextKind).toBe('none');
    expect(vm.commands).toBeDefined();
    expect(vm.commands.length).toBe(0);
  });
});

// ─── 7. Descriptor freshness — disabled → enabled transition (FIXUP-1) ─

describe('COMMAND-PANEL-02-FIXUP-1: descriptor freshness', () => {
  const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };

  it('command transitions from disabled to enabled when resources change', () => {
    // Start with insufficient resources
    const brokeState = createBrokeGameState();
    const vmDisabled = buildCommandPanelViewModel(brokeState, builderSelection);
    const separatorDisabled = vmDisabled.commands.find(c => c.id === 'build-separator');
    expect(separatorDisabled).toBeDefined();
    expect(separatorDisabled!.state).toBe('disabled');

    // Now with sufficient resources
    const richState = createNormalGameState();
    const vmEnabled = buildCommandPanelViewModel(richState, builderSelection);
    const separatorEnabled = vmEnabled.commands.find(c => c.id === 'build-separator');
    expect(separatorEnabled).toBeDefined();
    expect(separatorEnabled!.state).toBe('enabled');
  });

  it('disabled command has disabledReason that clears when enabled', () => {
    const brokeState = createBrokeGameState();
    const vmDisabled = buildCommandPanelViewModel(brokeState, builderSelection);
    const separatorDisabled = vmDisabled.commands.find(c => c.id === 'build-separator');
    expect(separatorDisabled!.disabledReason).toBeTruthy();

    const richState = createNormalGameState();
    const vmEnabled = buildCommandPanelViewModel(richState, builderSelection);
    const separatorEnabled = vmEnabled.commands.find(c => c.id === 'build-separator');
    expect(separatorEnabled!.disabledReason).toBe('');
  });
});

// ─── 8. Disabled tooltip reason available (FIXUP-1) ────────────────

describe('COMMAND-PANEL-02-FIXUP-1: disabled tooltip', () => {
  const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };

  it('disabled command has tooltip with disabled reason', () => {
    const state = createBrokeGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const disabledCmds = vm.commands.filter(c => c.state === 'disabled');
    for (const cmd of disabledCmds) {
      expect(cmd.tooltip).toContain(cmd.disabledReason);
    }
  });

  it('disabled command has disabledReason string available for tooltip', () => {
    const state = createBrokeGameState();
    const vm = buildCommandPanelViewModel(state, builderSelection);
    const separatorCmd = vm.commands.find(c => c.id === 'build-separator');
    expect(separatorCmd).toBeDefined();
    expect(separatorCmd!.disabledReason).toBeTruthy();
    // The tooltip should include both the label and the reason
    expect(separatorCmd!.tooltip).toBeTruthy();
  });
});

// ─── 9. HUD input guard still works ────────────────────────────────

describe('COMMAND-PANEL-02: HUD input guard intact', () => {
  it('isScreenPointInHud still works for bottom HUD area', () => {
    const canvasHeight = 1080;
    expect(isScreenPointInHud(canvasHeight - 1, canvasHeight)).toBe(true);
    expect(isScreenPointInHud(0, canvasHeight)).toBe(false);
  });

  it('shouldUseBottomHudSafeArea still gates correctly', () => {
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

// ─── 10. Command descriptor integrity ──────────────────────────────

describe('COMMAND-PANEL-02: descriptor integrity', () => {
  it('all descriptors have required fields', () => {
    const state = createNormalGameState();
    const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandPanelViewModel(state, builderSelection);

    for (const cmd of vm.commands) {
      expect(cmd.id).toBeTruthy();
      expect(cmd.label).toBeTruthy();
      expect(cmd.state).toMatch(/^(enabled|disabled|hidden)$/);
      expect(cmd.category).toMatch(/^(build|produce|unit-action|building-action)$/);
      expect(typeof cmd.tooltip).toBe('string');
      expect(typeof cmd.disabledReason).toBe('string');
      expect(typeof cmd.cost).toBe('string');
      expect(typeof cmd.hotkey).toBe('string');
    }
  });

  it('enabled commands have empty disabledReason', () => {
    const state = createNormalGameState();
    const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandPanelViewModel(state, builderSelection);

    const enabledCmds = vm.commands.filter(c => c.state === 'enabled');
    for (const cmd of enabledCmds) {
      expect(cmd.disabledReason).toBe('');
    }
  });

  it('disabled commands have non-empty disabledReason', () => {
    const state = createBrokeGameState();
    const builderSelection: UnitSelection = { kind: 'builder', id: 'builder-1' };
    const vm = buildCommandPanelViewModel(state, builderSelection);

    const disabledCmds = vm.commands.filter(c => c.state === 'disabled');
    for (const cmd of disabledCmds) {
      expect(cmd.disabledReason).toBeTruthy();
    }
  });
});

// ─── 11. produceCommandDesc is available for future building context ─

describe('COMMAND-PANEL-02-FIXUP-1: produceCommandDesc available', () => {
  it('produceCommandDesc creates valid descriptor for builder unit', () => {
    const state = createGameStateWithFactory();
    const desc = produceCommandDesc('builder', state);
    expect(desc.id).toBe('produce-builder');
    expect(desc.category).toBe('produce');
    expect(desc.label).toBeTruthy();
    expect(desc.cost).toBeTruthy();
  });

  it('produceCommandDesc creates valid descriptor for harvester unit', () => {
    const state = createGameStateWithFactory();
    const desc = produceCommandDesc('harvester', state);
    expect(desc.id).toBe('produce-harvester');
    expect(desc.category).toBe('produce');
  });

  it('produceCommandDesc marks disabled when no factory', () => {
    const state = createNormalGameState(); // no factories
    const desc = produceCommandDesc('builder', state);
    expect(desc.state).toBe('disabled');
    expect(desc.disabledReason).toBeTruthy();
  });
});
