import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MapData, ModularCombatUnit } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import {
  COMBAT_TILE_SPEED_SCALE,
  normalizeCombatUnitRuntime,
  normalizeCombatUnitState,
} from '../state/combatUnits';
import {
  issueCombatUnitMove,
  stopCombatUnit,
  updateAllCombatUnitMovement,
} from '../state/combatUnitMovement';
import { buildOccupancyMap, getFlags, isTileOccupiedByUnit } from '../state/occupancy';
import {
  getSelectionCenterTile,
  pruneMissingEntities,
  selectMany,
} from '../state/unitSelection';
import { routeLmbClick } from '../state/commandRouter';
import { collectVisionSources, getVisionSourceSignature } from '../state/visibility';
import {
  loadGame,
  resetSaveStorage,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';

function makeMap(): MapData {
  return {
    width: 16,
    height: 16,
    terrain: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 12, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [],
    builders: [],
    constructionSites: [],
  };
}

function makeState() {
  const state = createInitialState(makeMap(), 'cyan');
  state.harvesters = [];
  state.extraHarvesters = [];
  state.entities = state.entities.filter(entity => entity.kind === 'hq');
  return state;
}

function makeUnit(id = 'combat-unit-0', bodyId: ModularCombatUnit['bodyId'] = 'wasp'): ModularCombatUnit {
  return {
    id,
    tx: 6,
    ty: 6,
    bodyId,
    weaponId: 'smoky',
    hullMod: 'm0',
    turretMod: 'm0',
    faction: 'cyan',
    dir: 2,
    turretDir: 2,
  };
}

class MemoryStorage implements SaveStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): boolean { this.data.set(key, value); return true; }
  removeItem(key: string): void { this.data.delete(key); }
}

describe('canonical Normal Game combat movement', () => {
  beforeEach(() => setSaveStorage(new MemoryStorage()));
  afterEach(() => resetSaveStorage());

  it('migrates an old produced unit into a production runtime', () => {
    const state = makeState();
    const wasp = makeUnit();
    const hunter = makeUnit('combat-unit-1', 'hunter');
    state.combatUnits = [wasp, hunter];

    normalizeCombatUnitState(state);

    expect(wasp.runtime).toMatchObject({
      ftx: 6,
      fty: 6,
      hp: 130,
      maxHp: 130,
      order: { kind: 'idle' },
      path: [],
      pathIndex: 0,
      targetId: null,
      weaponCooldownMs: 0,
      isDestroyed: false,
      destroyedAt: null,
    });
    expect(wasp.runtime!.speedTilesPerSecond).toBeCloseTo(11.5 * COMBAT_TILE_SPEED_SCALE);
    expect(hunter.runtime!.maxHp).toBe(210);
    expect(hunter.runtime!.speedTilesPerSecond).toBeLessThan(wasp.runtime!.speedTilesPerSecond);
  });

  it('moves through a deterministic BFS path and returns to idle', () => {
    const state = makeState();
    const unit = makeUnit();
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);

    expect(issueCombatUnitMove(state, unit.id, 10, 6)).toEqual({ ok: true });
    expect(unit.runtime!.order).toEqual({ kind: 'move', targetTx: 10, targetTy: 6 });
    expect(unit.runtime!.path.length).toBeGreaterThan(0);

    for (let i = 0; i < 100; i++) updateAllCombatUnitMovement(state, 100);

    expect(unit.runtime!.ftx).toBe(10);
    expect(unit.runtime!.fty).toBe(6);
    expect(unit.tx).toBe(10);
    expect(unit.ty).toBe(6);
    expect(unit.runtime!.order).toEqual({ kind: 'idle' });
    expect(unit.runtime!.path).toEqual([]);
    expect(unit.dir).not.toBe(2);
  });

  it('stops without moving again on later ticks', () => {
    const state = makeState();
    const unit = makeUnit();
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);

    expect(issueCombatUnitMove(state, unit.id, 10, 6)).toEqual({ ok: true });
    updateAllCombatUnitMovement(state, 200);
    const stoppedAt = { x: unit.runtime!.ftx, y: unit.runtime!.fty };

    expect(stopCombatUnit(state, unit.id)).toEqual({ ok: true });
    updateAllCombatUnitMovement(state, 1000);

    expect(unit.runtime!.order).toEqual({ kind: 'idle' });
    expect(unit.runtime!.path).toEqual([]);
    expect({ x: unit.runtime!.ftx, y: unit.runtime!.fty }).toEqual(stoppedAt);
  });

  it('rejects another combat unit footprint as a target', () => {
    const state = makeState();
    const mover = makeUnit();
    const blocker = makeUnit('combat-unit-1', 'hunter');
    blocker.tx = 9;
    blocker.ty = 6;
    state.combatUnits = [mover, blocker];
    normalizeCombatUnitState(state);

    expect(isTileOccupiedByUnit(state, 9, 6, 'combat', mover.id)).toBe(true);
    expect(issueCombatUnitMove(state, mover.id, 9, 6)).toEqual({ ok: false, reason: 'target-occupied' });
  });

  it('derives occupancy from combatUnits rather than legacy entities', () => {
    const state = makeState();
    const unit = makeUnit();
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);
    expect(state.entities.some(entity => entity.kind === 'modular-combat')).toBe(false);

    const occupancy = buildOccupancyMap(state);
    expect(getFlags(occupancy, 6, 6).has('soft-occupied')).toBe(true);
  });

  it('selects, centers and prunes a canonical combat unit', () => {
    const state = makeState();
    const unit = makeUnit();
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);
    unit.runtime!.ftx = 7.25;
    unit.runtime!.fty = 8.5;

    const routed = routeLmbClick({ kind: 'own-combat-vehicle', id: unit.id, tx: 7, ty: 9 }, null);
    expect(routed.action).toBe('select');
    if (routed.action !== 'select') throw new Error('expected combat selection');
    expect(routed.selection?.units).toEqual([{ kind: 'combat', id: unit.id }]);
    expect(getSelectionCenterTile(routed.selection, state)).toEqual({ tx: 7.25, ty: 8.5 });

    const mixed = selectMany([{ kind: 'combat', id: unit.id }, { kind: 'harvester', id: 'missing' }]);
    expect(pruneMissingEntities(mixed, state)?.units).toEqual([{ kind: 'combat', id: unit.id }]);
  });

  it('uses fractional combat movement as a fog vision source', () => {
    const state = makeState();
    const unit = makeUnit();
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);

    const before = getVisionSourceSignature(state);
    unit.runtime!.ftx = 9.4;
    unit.runtime!.fty = 7.6;
    const source = collectVisionSources(state).find(candidate => candidate.sourceId === unit.id);

    expect(source).toMatchObject({ tx: 9, ty: 8, radius: 4, sourceType: 'combat' });
    expect(getVisionSourceSignature(state)).not.toBe(before);

    unit.runtime!.isDestroyed = true;
    expect(collectVisionSources(state).some(candidate => candidate.sourceId === unit.id)).toBe(false);
  });

  it('persists runtime fields and migrates missing runtime on load', () => {
    const state = makeState();
    const unit = makeUnit();
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);
    normalizeCombatUnitRuntime(unit).ftx = 7.5;
    unit.runtime!.fty = 6.25;
    unit.runtime!.hp = 99;
    unit.runtime!.order = { kind: 'move', targetTx: 10, targetTy: 6 };
    unit.runtime!.path = [{ tx: 8, ty: 6 }, { tx: 9, ty: 6 }, { tx: 10, ty: 6 }];

    const saved = saveGame(state, 'test-map');
    expect(saved.success).toBe(true);
    const loaded = loadGame(saved.slotId!);
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.combatUnits[0].runtime).toMatchObject({
      ftx: 7.5,
      fty: 6.25,
      hp: 99,
      order: { kind: 'move', targetTx: 10, targetTy: 6 },
    });

    const migrated = makeUnit('legacy-unit');
    loaded.gameState!.combatUnits = [migrated];
    normalizeCombatUnitState(loaded.gameState!);
    expect(migrated.runtime).toBeDefined();
    expect(migrated.runtime!.order).toEqual({ kind: 'idle' });
  });
});
