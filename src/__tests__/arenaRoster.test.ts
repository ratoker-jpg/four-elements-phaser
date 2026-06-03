/**
 * Tests for ARENA-04H+: Arena Roster, Clear/Delete/Reset, Status/Help.
 *
 * Verifies:
 * - deriveRosterRows derives rows from blockoutVehicles
 * - roster row labels body/weapon/team/HP/state
 * - clearAllVehicles removes all blockout vehicles
 * - clearAllyVehicles removes only allies
 * - clearEnemyVehicles removes only enemies
 * - deleteVehicle clears selected/target references
 * - deleting targeted enemy clears targetVehicleId
 * - enemy row cannot become controllable selection (verified by team check)
 * - deriveArenaStatus provides correct status messages
 * - ARENA_HELP_LINES is non-empty
 * - reset arena keeps obstacles empty (verified by devArena helper)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBlockoutVehicle,
  resetBlockoutVehicleIdCounter,
  type BlockoutVehicleState,
} from '../state/blockoutVehicleState';
import {
  deriveRosterRows,
  clearAllVehicles,
  clearAllyVehicles,
  clearEnemyVehicles,
  deleteVehicle,
  deriveArenaStatus,
  decideRosterClick,
  ARENA_HELP_LINES,
} from '../state/arenaRoster';
import { startFiring, resetVfxEventIdCounter, clearVfxEvents } from '../state/blockoutWeaponVfx';
import { createArenaMapData } from '../state/devArena';

// ─── deriveRosterRows ──────────────────────────────────────────────

describe('ARENA-04H+ deriveRosterRows', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('derives roster rows from blockoutVehicles', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    const rows = deriveRosterRows(vehicles, ally.id, null);

    expect(rows).toHaveLength(2);
  });

  it('roster row labels body, weapon, team, HP, state', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const vehicles = [ally];

    const rows = deriveRosterRows(vehicles, null, null);

    expect(rows[0].bodyId).toBe('viking');
    expect(rows[0].weaponId).toBe('thunder');
    expect(rows[0].team).toBe('ally');
    expect(rows[0].hp).toBe(ally.hp);
    expect(rows[0].maxHp).toBe(ally.maxHp);
    expect(rows[0].isDestroyed).toBe(false);
  });

  it('roster row shows isSelected for selected vehicle', () => {
    const ally1 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const ally2 = createBlockoutVehicle('viking', 'thunder', 'cyan', 6, 6, undefined, undefined, 'ally');
    const vehicles = [ally1, ally2];

    const rows = deriveRosterRows(vehicles, ally1.id, null);

    expect(rows[0].isSelected).toBe(true);
    expect(rows[1].isSelected).toBe(false);
  });

  it('roster row shows isTargeted for targeted vehicle', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', 8, 8, undefined, undefined, 'enemy');
    ally.targetVehicleId = enemy.id;
    const vehicles = [ally, enemy];

    const rows = deriveRosterRows(vehicles, ally.id, enemy.id);

    expect(rows[0].isSelected).toBe(true);
    expect(rows[1].isTargeted).toBe(true);
    expect(rows[0].isTargeted).toBe(false);
  });

  it('returns empty array for undefined vehicles', () => {
    const rows = deriveRosterRows(undefined, null, null);
    expect(rows).toHaveLength(0);
  });

  it('shows destroyed state correctly', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    ally.isDestroyed = true;
    ally.hp = 0;
    const vehicles = [ally];

    const rows = deriveRosterRows(vehicles, null, null);

    expect(rows[0].isDestroyed).toBe(true);
    expect(rows[0].hp).toBe(0);
  });
});

// ─── clearAllVehicles ─────────────────────────────────────────────

describe('ARENA-04H+ clearAllVehicles', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
  });

  it('removes all blockout vehicles', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    const result = clearAllVehicles(vehicles, ally.id);

    expect(result.removedCount).toBe(2);
    expect(vehicles).toHaveLength(0);
  });

  it('clears selected when selected vehicle was in the list', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const vehicles = [ally];

    const result = clearAllVehicles(vehicles, ally.id);

    expect(result.selectedCleared).toBe(true);
  });

  it('stops firing on firing vehicles', () => {
    const ally = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5, undefined, undefined, 'ally');
    startFiring(ally);
    expect(ally.isFiring).toBe(true);

    const vehicles = [ally];
    clearAllVehicles(vehicles, ally.id);

    expect(ally.isFiring).toBe(false);
  });

  it('returns empty message for already empty arena', () => {
    const vehicles: BlockoutVehicleState[] = [];

    const result = clearAllVehicles(vehicles, null);

    expect(result.removedCount).toBe(0);
    // CORE-STEP-01B: Russian message for empty arena
    expect(result.message).toContain('пуста');
  });
});

// ─── clearAllyVehicles ────────────────────────────────────────────

describe('ARENA-04H+ clearAllyVehicles', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
  });

  it('removes only ally vehicles', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    const result = clearAllyVehicles(vehicles, ally.id);

    expect(result.removedCount).toBe(1);
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].team).toBe('enemy');
  });

  it('clears selected when ally was selected', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    const result = clearAllyVehicles(vehicles, ally.id);

    expect(result.selectedCleared).toBe(true);
  });

  it('does not clear selected when enemy was selected', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    const result = clearAllyVehicles(vehicles, enemy.id);

    expect(result.selectedCleared).toBe(false);
  });

  it('stops firing on allies being cleared', () => {
    const ally = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5, undefined, undefined, 'ally');
    startFiring(ally);
    const vehicles = [ally];

    clearAllyVehicles(vehicles, ally.id);

    expect(ally.isFiring).toBe(false);
  });
});

// ─── clearEnemyVehicles ───────────────────────────────────────────

describe('ARENA-04H+ clearEnemyVehicles', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
  });

  it('removes only enemy vehicles', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    const result = clearEnemyVehicles(vehicles, ally.id);

    expect(result.removedCount).toBe(1);
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].team).toBe('ally');
  });

  it('clears targetVehicleId on allies targeting removed enemies', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', 8, 8, undefined, undefined, 'enemy');
    ally.targetVehicleId = enemy.id;
    const vehicles = [ally, enemy];

    const result = clearEnemyVehicles(vehicles, ally.id);

    expect(result.targetCleared).toBe(true);
    expect(ally.targetVehicleId).toBeNull();
  });

  it('stops firing on ally that lost its target', () => {
    const ally = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', 8, 8, undefined, undefined, 'enemy');
    ally.targetVehicleId = enemy.id;
    startFiring(ally);
    const vehicles = [ally, enemy];

    clearEnemyVehicles(vehicles, ally.id);

    expect(ally.isFiring).toBe(false);
    expect(ally.fireHeld).toBe(false);
  });

  it('does not remove ally vehicles', () => {
    const ally1 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const ally2 = createBlockoutVehicle('viking', 'thunder', 'cyan', 6, 6, undefined, undefined, 'ally');
    const vehicles = [ally1, ally2];

    const result = clearEnemyVehicles(vehicles, ally1.id);

    expect(result.removedCount).toBe(0);
    expect(vehicles).toHaveLength(2);
  });
});

// ─── deleteVehicle ────────────────────────────────────────────────

describe('ARENA-04H+ deleteVehicle', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
  });

  it('deletes selected unit and clears selected reference', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    const result = deleteVehicle(vehicles, ally.id, ally.id);

    expect(result.removedCount).toBe(1);
    expect(result.selectedCleared).toBe(true);
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].id).toBe(enemy.id);
  });

  it('deleting targeted enemy clears targetVehicleId', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', 8, 8, undefined, undefined, 'enemy');
    ally.targetVehicleId = enemy.id;
    const vehicles = [ally, enemy];

    const result = deleteVehicle(vehicles, enemy.id, ally.id);

    expect(result.removedCount).toBe(1);
    expect(result.targetCleared).toBe(true);
    expect(ally.targetVehicleId).toBeNull();
  });

  it('stops firing on ally that lost its target via delete', () => {
    const ally = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', 8, 8, undefined, undefined, 'enemy');
    ally.targetVehicleId = enemy.id;
    startFiring(ally);
    const vehicles = [ally, enemy];

    deleteVehicle(vehicles, enemy.id, ally.id);

    expect(ally.isFiring).toBe(false);
    expect(ally.fireHeld).toBe(false);
  });

  it('returns not found for non-existent vehicle', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const vehicles = [ally];

    const result = deleteVehicle(vehicles, 'nonexistent-id', null);

    expect(result.removedCount).toBe(0);
    expect(result.selectedCleared).toBe(false);
    expect(vehicles).toHaveLength(1);
  });

  it('deleting non-selected vehicle does not clear selected', () => {
    const ally1 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const ally2 = createBlockoutVehicle('viking', 'thunder', 'cyan', 6, 6, undefined, undefined, 'ally');
    const vehicles = [ally1, ally2];

    const result = deleteVehicle(vehicles, ally2.id, ally1.id);

    expect(result.selectedCleared).toBe(false);
  });

  it('stop firing on deleted vehicle', () => {
    const ally = createBlockoutVehicle('viking', 'flamethrower', 'cyan', 5, 5, undefined, undefined, 'ally');
    startFiring(ally);
    const vehicles = [ally];

    deleteVehicle(vehicles, ally.id, ally.id);

    expect(ally.isFiring).toBe(false);
  });
});

// ─── decideRosterClick ────────────────────────────────────────────

describe('ARENA-04H+ decideRosterClick', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('ally row click returns select action', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];
    const rows = deriveRosterRows(vehicles, null, null);
    const allyRow = rows.find(r => r.team === 'ally')!;

    const action = decideRosterClick(allyRow, null, vehicles);

    expect(action.type).toBe('select');
    if (action.type === 'select') {
      expect(action.vehicleId).toBe(ally.id);
    }
  });

  it('enemy row click with selected ally returns assignTarget action', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];
    const rows = deriveRosterRows(vehicles, ally.id, null);
    const enemyRow = rows.find(r => r.team === 'enemy')!;

    const action = decideRosterClick(enemyRow, ally.id, vehicles);

    expect(action.type).toBe('assignTarget');
    if (action.type === 'assignTarget') {
      expect(action.targetVehicleId).toBe(enemy.id);
    }
  });

  it('enemy row click with no selected ally returns noop', () => {
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [enemy];
    const rows = deriveRosterRows(vehicles, null, null);
    const enemyRow = rows.find(r => r.team === 'enemy')!;

    const action = decideRosterClick(enemyRow, null, vehicles);

    expect(action.type).toBe('noop');
  });

  it('enemy row click never returns select action', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [ally, enemy];

    // With ally selected
    const rows = deriveRosterRows(vehicles, ally.id, null);
    const enemyRow = rows.find(r => r.team === 'enemy')!;
    const actionWithSelection = decideRosterClick(enemyRow, ally.id, vehicles);
    expect(actionWithSelection.type).not.toBe('select');

    // Without ally selected
    const actionNoSelection = decideRosterClick(enemyRow, null, vehicles);
    expect(actionNoSelection.type).not.toBe('select');
  });

  it('enemy row click with undefined vehicles returns noop', () => {
    const enemy = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const vehicles = [enemy];
    const rows = deriveRosterRows(vehicles, null, null);
    const enemyRow = rows.find(r => r.team === 'enemy')!;

    const action = decideRosterClick(enemyRow, 'some-id', undefined);

    expect(action.type).toBe('noop');
  });

  it('enemy row click when selectedId belongs to enemy (not ally) returns noop', () => {
    const enemy1 = createBlockoutVehicle('hornet', 'twins', 'green', 8, 8, undefined, undefined, 'enemy');
    const enemy2 = createBlockoutVehicle('wasp', 'smoky', 'green', 10, 10, undefined, undefined, 'enemy');
    const vehicles = [enemy1, enemy2];
    const rows = deriveRosterRows(vehicles, enemy1.id, null);
    const enemy2Row = rows.find(r => r.id === enemy2.id)!;

    // Even if somehow an enemy ID is "selected", clicking another enemy is noop
    const action = decideRosterClick(enemy2Row, enemy1.id, vehicles);

    expect(action.type).toBe('noop');
  });
});

// ─── Enemy not controllable ───────────────────────────────────────

describe('ARENA-04H+ enemy row cannot become controllable selection', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('enemy team check prevents controllable selection', () => {
    const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', 8, 8, undefined, undefined, 'enemy');
    // Simulate roster click logic: team === 'enemy' → no controllable select
    const canSelectAsControllable = enemy.team !== 'enemy';
    expect(canSelectAsControllable).toBe(false);
  });

  it('ally team check allows controllable selection', () => {
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, undefined, undefined, 'ally');
    const canSelectAsControllable = ally.team !== 'enemy';
    expect(canSelectAsControllable).toBe(true);
  });
});

// ─── deriveArenaStatus ────────────────────────────────────────────

describe('ARENA-04H+ deriveArenaStatus', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('shows arena empty for no vehicles', () => {
    const status = deriveArenaStatus([], null, null, 'idle');
    // CORE-STEP-01B: Russian status
    expect(status).toContain('пуста');
  });

  it('shows placement mode active', () => {
    const status = deriveArenaStatus([], null, null, 'placing');
    // CORE-STEP-01B: Russian status
    expect(status).toContain('Размещение');
  });

  it('shows selected unit summary', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const status = deriveArenaStatus([ally], ally.id, null, 'idle');
    // CORE-STEP-01B: Uses displayName from profiles + Russian labels
    expect(status).toContain('Viking');
    expect(status).toContain('Thunder');
    expect(status).toContain('Союзник');
  });

  it('shows target summary when target is set', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', 8, 8, undefined, undefined, 'enemy');
    ally.targetVehicleId = enemy.id;
    const status = deriveArenaStatus([ally, enemy], ally.id, enemy.id, 'idle');
    expect(status).toContain('Wasp');
    // CORE-STEP-01B: Russian 'Цель' label
    expect(status).toContain('Цель');
  });

  it('shows no target when ally selected without target', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const status = deriveArenaStatus([ally], ally.id, null, 'idle');
    // CORE-STEP-01B: Russian 'нет цели'
    expect(status).toContain('нет цели');
  });

  it('shows click to select when vehicles exist but none selected', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    const status = deriveArenaStatus([ally], null, null, 'idle');
    // CORE-STEP-01B: Russian 'кликните'
    expect(status).toContain('кликните');
  });

  it('shows destroyed for destroyed selected unit', () => {
    const ally = createBlockoutVehicle('viking', 'thunder', 'cyan', 5, 5, undefined, undefined, 'ally');
    ally.isDestroyed = true;
    ally.hp = 0;
    const status = deriveArenaStatus([ally], ally.id, null, 'idle');
    // CORE-STEP-01B: Russian 'УНИЧТОЖЕН'
    expect(status).toContain('УНИЧТОЖЕН');
  });
});

// ─── Help text ────────────────────────────────────────────────────

describe('ARENA-04H+ help text', () => {
  it('ARENA_HELP_LINES is non-empty', () => {
    expect(ARENA_HELP_LINES.length).toBeGreaterThan(0);
  });

  it('ARENA_HELP_LINES contains placement instructions', () => {
    const text = ARENA_HELP_LINES.join('\n');
    // CORE-STEP-01B: Russian help text
    expect(text).toContain('Разместить');
  });

  it('ARENA_HELP_LINES contains ally/enemy rules', () => {
    const text = ARENA_HELP_LINES.join('\n');
    // CORE-STEP-01B: Russian help text
    expect(text).toContain('Союзники');
    expect(text).toContain('Враги');
  });
});

// ─── Reset arena keeps obstacles empty ────────────────────────────

describe('ARENA-04H+ reset arena keeps obstacles empty', () => {
  it('createArenaMapData has no obstacles', () => {
    const mapData = createArenaMapData();
    expect(mapData.obstacles).toHaveLength(0);
  });

  it('createArenaMapData has no resources', () => {
    const mapData = createArenaMapData();
    expect(mapData.resources).toHaveLength(0);
  });

  it('createArenaMapData has no builders', () => {
    const mapData = createArenaMapData();
    expect(mapData.builders).toHaveLength(0);
  });
});
