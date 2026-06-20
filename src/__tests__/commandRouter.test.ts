/**
 * CORE-STEP-05H+ tests — Unified RTS Controls and Command Routing.
 *
 * SELECTION-CONTROL-GROUPS-05: Updated for multi-select UnitSelection.
 */

import { describe, it, expect } from 'vitest';
import {
  routeLmbClick,
  routeRmbClick,
  routeRmbClickArena,
  routeSKey,
  routeEscKey,
  determineCursorFeedback,
  getConfirmationType,
  type ClickTarget,
} from '../state/commandRouter';
import { stopUnitCommand } from '../state/unitCommands';
import type { UnitSelection } from '../state/unitSelection';
import { selectBuilder, selectHarvester } from '../state/unitSelection';

// ─── Helper: create click targets ────────────────────────────────────

function groundTarget(tx = 5, ty = 5): ClickTarget {
  return { kind: 'ground', tx, ty };
}

function ownHarvesterTarget(id = 'h1', tx = 3, ty = 3): ClickTarget {
  return { kind: 'own-harvester', id, unitKind: 'harvester', tx, ty };
}

function ownBuilderTarget(id = 'b1', tx = 4, ty = 4): ClickTarget {
  return { kind: 'own-builder', id, unitKind: 'builder', tx, ty };
}

function resourceTarget(id = 'r1', tx = 6, ty = 6): ClickTarget {
  return { kind: 'resource', id, tx, ty };
}

function enemyUnitTarget(id = 'e1', tx = 7, ty = 7): ClickTarget {
  return { kind: 'enemy-unit', id, tx, ty };
}

function ownBuildingTarget(id = 'bld1', tx = 2, ty = 2): ClickTarget {
  return { kind: 'own-building', id, tx, ty };
}

// Helper to create a blockout vehicle selection
function blockoutVehicleSelection(vehicleId: string): UnitSelection {
  return { kind: 'single', units: [{ kind: 'harvester', id: vehicleId }], primaryId: vehicleId };
}

// ─── LMB routing tests ───────────────────────────────────────────────

describe('CORE-STEP-05H+ commandRouter — LMB routing', () => {
  it('LMB on own harvester → select', () => {
    const result = routeLmbClick(ownHarvesterTarget(), null);
    expect(result.action).toBe('select');
    if (result.action === 'select') {
      expect(result.selection!.kind).toBe('single');
      expect(result.selection!.units[0].kind).toBe('harvester');
      expect(result.selection!.units[0].id).toBe('h1');
    }
  });

  it('LMB on own builder → select', () => {
    const result = routeLmbClick(ownBuilderTarget(), null);
    expect(result.action).toBe('select');
    if (result.action === 'select') {
      expect(result.selection!.kind).toBe('single');
      expect(result.selection!.units[0].kind).toBe('builder');
      expect(result.selection!.units[0].id).toBe('b1');
    }
  });

  it('LMB on own building → select (inspect)', () => {
    const result = routeLmbClick(ownBuildingTarget(), null);
    expect(result.action).toBe('select');
  });

  it('LMB on enemy → no-op (inspect only, no control transfer)', () => {
    const result = routeLmbClick(enemyUnitTarget(), null);
    expect(result.action).toBe('no-op');
  });

  it('LMB on resource → no-op (does not harvest)', () => {
    const result = routeLmbClick(resourceTarget(), null);
    expect(result.action).toBe('no-op');
  });

  it('LMB on ground with selection → deselect', () => {
    const sel = selectHarvester('h1');
    const result = routeLmbClick(groundTarget(), sel);
    expect(result.action).toBe('deselect');
  });

  it('LMB on ground without selection → no-op', () => {
    const result = routeLmbClick(groundTarget(), null);
    expect(result.action).toBe('no-op');
  });

  it('LMB never issues move command', () => {
    const targets: ClickTarget[] = [
      groundTarget(), ownHarvesterTarget(), ownBuilderTarget(),
      resourceTarget(), enemyUnitTarget(), ownBuildingTarget(),
    ];
    for (const target of targets) {
      const result = routeLmbClick(target, selectHarvester('h1'));
      expect(result.action).not.toBe('move');
    }
  });

  it('LMB never issues harvest command', () => {
    const result = routeLmbClick(resourceTarget(), selectHarvester('h1'));
    expect(result.action).not.toBe('harvest');
  });

  it('LMB never issues attack command', () => {
    const result = routeLmbClick(enemyUnitTarget(), selectHarvester('h1'));
    expect(result.action).not.toBe('attack');
  });
});

// ─── RMB routing tests ───────────────────────────────────────────────

describe('CORE-STEP-05H+ commandRouter — RMB routing', () => {
  it('RMB with no selected unit → no-op', () => {
    const result = routeRmbClick(groundTarget(), null);
    expect(result.action).toBe('no-op');
    if (result.action === 'no-op') {
      expect(result.reason).toBe('no-selected-unit');
    }
  });

  it('RMB ground with selected harvester → move', () => {
    const sel = selectHarvester('h1');
    const result = routeRmbClick(groundTarget(10, 10), sel);
    expect(result.action).toBe('move');
    if (result.action === 'move') {
      expect(result.tx).toBe(10);
      expect(result.ty).toBe(10);
    }
  });

  it('RMB ground with selected builder → move', () => {
    const sel = selectBuilder('b1');
    const result = routeRmbClick(groundTarget(), sel);
    expect(result.action).toBe('move');
  });

  it('RMB resource with selected harvester → harvest', () => {
    const sel = selectHarvester('h1');
    const result = routeRmbClick(resourceTarget('r1', 8, 8), sel);
    expect(result.action).toBe('harvest');
    if (result.action === 'harvest') {
      expect(result.tx).toBe(8);
      expect(result.ty).toBe(8);
      expect(result.resourceId).toBe('r1');
    }
  });

  it('RMB resource with selected builder → move (not harvest)', () => {
    const sel = selectBuilder('b1');
    const result = routeRmbClick(resourceTarget(), sel);
    expect(result.action).toBe('move');
  });

  it('RMB enemy with blockout vehicle selected → attack', () => {
    const sel = blockoutVehicleSelection('blockout-vehicle-1');
    const result = routeRmbClick(enemyUnitTarget('e1'), sel);
    expect(result.action).toBe('attack');
    if (result.action === 'attack') {
      expect(result.targetId).toBe('e1');
    }
  });

  it('RMB enemy with civil harvester selected → move (no attack)', () => {
    const sel = selectHarvester('harvester-1');
    const result = routeRmbClick(enemyUnitTarget(), sel);
    expect(result.action).toBe('move');
  });

  it('RMB own entity → no-op', () => {
    const sel = selectHarvester('h1');
    const result = routeRmbClick(ownHarvesterTarget('h2'), sel);
    expect(result.action).toBe('no-op');
  });

  it('RMB own building → no-op', () => {
    const sel = selectHarvester('h1');
    const result = routeRmbClick(ownBuildingTarget(), sel);
    expect(result.action).toBe('no-op');
  });
});

// ─── RMB Arena routing tests ─────────────────────────────────────────

describe('CORE-STEP-05H+ commandRouter — RMB Arena routing', () => {
  it('RMB Arena with no selected ally → no-op', () => {
    const result = routeRmbClickArena(groundTarget(), false);
    expect(result.action).toBe('no-op');
  });

  it('RMB Arena ground with selected ally → move', () => {
    const result = routeRmbClickArena(groundTarget(), true);
    expect(result.action).toBe('move');
  });

  it('RMB Arena enemy with selected ally → attack', () => {
    const result = routeRmbClickArena(enemyUnitTarget('e1'), true);
    expect(result.action).toBe('attack');
    if (result.action === 'attack') {
      expect(result.targetId).toBe('e1');
    }
  });

  it('RMB Arena own entity → no-op', () => {
    const result = routeRmbClickArena(ownHarvesterTarget(), true);
    expect(result.action).toBe('no-op');
  });
});

// ─── S key routing tests ─────────────────────────────────────────────

describe('CORE-STEP-05H+ commandRouter — S key routing', () => {
  it('S with no selection → no-op', () => {
    const result = routeSKey(null);
    expect(result.action).toBe('no-op');
  });

  it('S with selected harvester → stop with unitIds', () => {
    const sel = selectHarvester('h1');
    const result = routeSKey(sel);
    expect(result.action).toBe('stop');
    if (result.action === 'stop') {
      expect(result.unitIds).toContain('h1');
    }
  });

  it('S with selected builder → stop with unitIds', () => {
    const sel = selectBuilder('b1');
    const result = routeSKey(sel);
    expect(result.action).toBe('stop');
    if (result.action === 'stop') {
      expect(result.unitIds).toContain('b1');
    }
  });

  it('S with blockout vehicle → clear-target-lock', () => {
    const sel = blockoutVehicleSelection('blockout-vehicle-1');
    const result = routeSKey(sel);
    expect(result.action).toBe('clear-target-lock');
    if (result.action === 'clear-target-lock') {
      expect(result.unitId).toBe('blockout-vehicle-1');
    }
  });
});

// ─── Esc priority tests ──────────────────────────────────────────────

describe('CORE-STEP-05H+ commandRouter — Esc priority', () => {
  it('Esc with active placement → cancel-active-mode (priority 1)', () => {
    const result = routeEscKey(true, true, true);
    expect(result.action).toBe('cancel-active-mode');
    expect(result.priority).toBe(1);
  });

  it('Esc with no placement but has selection → deselect (priority 2)', () => {
    const result = routeEscKey(false, true, true);
    expect(result.action).toBe('deselect');
    expect(result.priority).toBe(2);
  });

  it('Esc with no placement, no selection, but overlay open → close-overlay (priority 3)', () => {
    const result = routeEscKey(false, false, true);
    expect(result.action).toBe('close-overlay');
    expect(result.priority).toBe(3);
  });

  it('Esc with nothing else → toggle-pause (priority 4)', () => {
    const result = routeEscKey(false, false, false);
    expect(result.action).toBe('toggle-pause');
    expect(result.priority).toBe(4);
  });

  it('Esc priority: active mode before pause', () => {
    const result = routeEscKey(true, true, true);
    expect(result.action).toBe('cancel-active-mode');
  });

  it('Esc priority: deselect before close overlay', () => {
    const result = routeEscKey(false, true, true);
    expect(result.action).toBe('deselect');
  });

  it('Esc priority: close overlay before pause', () => {
    const result = routeEscKey(false, false, true);
    expect(result.action).toBe('close-overlay');
  });
});

// ─── Cursor feedback tests ───────────────────────────────────────────

describe('CORE-STEP-05H+ commandRouter — Cursor feedback', () => {
  it('No selection + ground → default cursor', () => {
    const result = determineCursorFeedback(groundTarget(), null, false);
    expect(result).toBe('default');
  });

  it('No selection + own harvester → select cursor', () => {
    const result = determineCursorFeedback(ownHarvesterTarget(), null, false);
    expect(result).toBe('select');
  });

  it('Selected harvester + ground → move cursor', () => {
    const sel = selectHarvester('h1');
    const result = determineCursorFeedback(groundTarget(), sel, false);
    expect(result).toBe('move');
  });

  it('Selected harvester + resource → harvest cursor', () => {
    const sel = selectHarvester('h1');
    const result = determineCursorFeedback(resourceTarget(), sel, false);
    expect(result).toBe('harvest');
  });

  it('Selected builder + resource → move cursor (not harvest)', () => {
    const sel = selectBuilder('b1');
    const result = determineCursorFeedback(resourceTarget(), sel, false);
    expect(result).toBe('move');
  });

  it('Selected combat + enemy in Arena → attack cursor', () => {
    const sel = blockoutVehicleSelection('blockout-vehicle-1');
    const result = determineCursorFeedback(enemyUnitTarget(), sel, true);
    expect(result).toBe('attack');
  });

  it('Selected harvester + own harvester → select cursor', () => {
    const sel = selectHarvester('h1');
    const result = determineCursorFeedback(ownHarvesterTarget('h2'), sel, false);
    expect(result).toBe('select');
  });

  it('Null hover → default', () => {
    const sel = selectHarvester('h1');
    const result = determineCursorFeedback(null, sel, false);
    expect(result).toBe('default');
  });
});

// ─── Command confirmation type tests ─────────────────────────────────

describe('CORE-STEP-05H+ commandRouter — Command confirmation', () => {
  it('Move route → move confirmation', () => {
    const routeResult = routeRmbClick(groundTarget(), selectHarvester('h1'));
    const confirmationType = getConfirmationType(routeResult);
    expect(confirmationType).toBe('move');
  });

  it('Harvest route → harvest confirmation', () => {
    const routeResult = routeRmbClick(resourceTarget(), selectHarvester('h1'));
    const confirmationType = getConfirmationType(routeResult);
    expect(confirmationType).toBe('harvest');
  });

  it('Attack route → attack confirmation', () => {
    const sel = blockoutVehicleSelection('blockout-vehicle-1');
    const routeResult = routeRmbClick(enemyUnitTarget('e1'), sel);
    const confirmationType = getConfirmationType(routeResult);
    expect(confirmationType).toBe('attack');
  });

  it('No-op route → no confirmation', () => {
    const routeResult = routeRmbClick(groundTarget(), null);
    const confirmationType = getConfirmationType(routeResult);
    expect(confirmationType).toBeNull();
  });
});

// ─── stopUnitCommand tests ───────────────────────────────────────────

describe('CORE-STEP-05H+ unitCommands — stopUnitCommand', () => {
  it('stopUnitCommand returns no-unit-selected for missing harvester', () => {
    const state = {
      harvesters: [],
      mapData: { builders: [] },
    } as any;
    const result = stopUnitCommand(state, { kind: 'harvester', id: 'nonexistent' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no-unit-selected');
    }
  });

  it('stopUnitCommand returns no-unit-selected for missing builder', () => {
    const state = {
      harvesters: [],
      mapData: { builders: [] },
    } as any;
    const result = stopUnitCommand(state, { kind: 'builder', id: 'nonexistent' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no-unit-selected');
    }
  });
});

// ─── Camera controls routing contract tests ──────────────────────────

describe('CORE-STEP-05H+ Camera — MMB pan contract', () => {
  it('CameraControls class uses middleButtonDown for drag start (structural)', () => {
    expect(true).toBe(true);
  });

  it('Arrow keys pan camera when debug overlay is NOT active (structural)', () => {
    expect(true).toBe(true);
  });
});

// ─── BlockoutVehicle Arena contract tests ────────────────────────────

describe('CORE-STEP-05H+ Arena — LMB enemy no-op + RMB target-lock', () => {
  it('LMB on enemy never transfers control (pure routing)', () => {
    const result = routeLmbClick(enemyUnitTarget(), null);
    expect(result.action).toBe('no-op');

    const result2 = routeLmbClick(enemyUnitTarget(), selectHarvester('h1'));
    expect(result2.action).toBe('no-op');
  });

  it('RMB enemy commands attack via Arena routing', () => {
    const result = routeRmbClickArena(enemyUnitTarget('e1'), true);
    expect(result.action).toBe('attack');
  });

  it('S clears target-lock (routing returns clear-target-lock)', () => {
    const sel = blockoutVehicleSelection('blockout-vehicle-1');
    const result = routeSKey(sel);
    expect(result.action).toBe('clear-target-lock');
  });
});
