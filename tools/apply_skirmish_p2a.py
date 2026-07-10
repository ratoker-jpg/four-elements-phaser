from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if new in content:
        return
    if old not in content:
        raise RuntimeError(f'Expected marker not found in {path}: {old[:180]!r}')
    write(path, content.replace(old, new, 1))


UNIT_DIRECTION = r'''/**
 * Shared 8-direction facing helper for tile-space movement.
 *
 * Pure TypeScript. Direction indices match the modular spritesheet contract:
 * E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7.
 */
export function directionFromDelta(dtx: number, dty: number): number {
  const screenDx = dtx - dty;
  const screenDy = dtx + dty;
  if (Math.abs(screenDx) < 0.001 && Math.abs(screenDy) < 0.001) return 2;

  const sector = Math.round(Math.atan2(screenDy, screenDx) / (Math.PI / 4));
  const directionBySector: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    '-4': 4,
    '-3': 5,
    '-2': 6,
    '-1': 7,
  };
  return directionBySector[sector] ?? 2;
}
'''

COMBAT_MOVEMENT = r'''/**
 * Canonical Normal Game movement lifecycle for factory-produced combat units.
 *
 * This module operates directly on GameState.combatUnits. It does not create
 * BlockoutVehicleState or a parallel Arena runtime.
 */

import type { CombatUnitRuntimeState, GameState, ModularCombatUnit } from './types';
import { normalizeCombatUnitRuntime } from './combatUnits';
import {
  addUnitBlockers,
  addVehicleBlockers,
  buildOccupancyMap,
  isPassable,
  isTileOccupiedByUnit,
} from './occupancy';
import { findPath } from './pathfinding';
import { directionFromDelta } from './unitDirection';

const ARRIVAL_THRESHOLD = 0.03;

export type CombatMoveResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'no-unit-selected'
        | 'unit-destroyed'
        | 'target-impassable'
        | 'target-occupied'
        | 'no-path';
    };

export function issueCombatUnitMove(
  state: GameState,
  unitId: string,
  targetTx: number,
  targetTy: number,
): CombatMoveResult {
  const unit = state.combatUnits.find(candidate => candidate.id === unitId);
  if (!unit) return { ok: false, reason: 'no-unit-selected' };

  const runtime = normalizeCombatUnitRuntime(unit);
  if (runtime.isDestroyed) return { ok: false, reason: 'unit-destroyed' };

  const occupancy = buildOccupancyMap(state);
  if (!isPassable(occupancy, targetTx, targetTy)) {
    return { ok: false, reason: 'target-impassable' };
  }
  if (isTileOccupiedByUnit(state, targetTx, targetTy, 'combat', unit.id)) {
    return { ok: false, reason: 'target-occupied' };
  }

  addUnitBlockers(state, occupancy, 'combat', unit.id);
  if (state.blockoutVehicles) addVehicleBlockers(state.blockoutVehicles, occupancy);

  const startTx = Math.round(runtime.ftx);
  const startTy = Math.round(runtime.fty);
  const path = findPath(occupancy, startTx, startTy, targetTx, targetTy);
  if (!path) return { ok: false, reason: 'no-path' };

  runtime.targetId = null;
  runtime.weaponCooldownMs = Math.max(0, runtime.weaponCooldownMs);
  runtime.path = path;
  runtime.pathIndex = 0;
  runtime.order = path.length === 0
    ? { kind: 'idle' }
    : { kind: 'move', targetTx, targetTy };

  if (path.length === 0) {
    runtime.ftx = targetTx;
    runtime.fty = targetTy;
    unit.tx = targetTx;
    unit.ty = targetTy;
  }

  return { ok: true };
}

export function stopCombatUnit(state: GameState, unitId: string): CombatMoveResult {
  const unit = state.combatUnits.find(candidate => candidate.id === unitId);
  if (!unit) return { ok: false, reason: 'no-unit-selected' };

  const runtime = normalizeCombatUnitRuntime(unit);
  if (runtime.isDestroyed) return { ok: false, reason: 'unit-destroyed' };

  runtime.order = { kind: 'idle' };
  runtime.path = [];
  runtime.pathIndex = 0;
  runtime.targetId = null;
  return { ok: true };
}

export function updateCombatUnitMovement(unit: ModularCombatUnit, deltaMs: number): void {
  const runtime = normalizeCombatUnitRuntime(unit);
  if (runtime.isDestroyed || runtime.order.kind !== 'move') return;

  if (runtime.pathIndex >= runtime.path.length) {
    finishMove(unit, runtime);
    return;
  }

  const waypoint = runtime.path[runtime.pathIndex];
  const dx = waypoint.tx - runtime.ftx;
  const dy = waypoint.ty - runtime.fty;
  const distance = Math.hypot(dx, dy);

  if (distance > 0.001) {
    unit.dir = directionFromDelta(dx, dy);
    unit.turretDir ??= unit.dir;
  }

  if (distance <= ARRIVAL_THRESHOLD) {
    runtime.ftx = waypoint.tx;
    runtime.fty = waypoint.ty;
    runtime.pathIndex += 1;
  } else {
    const step = Math.min((runtime.speedTilesPerSecond * Math.min(deltaMs, 200)) / 1000, distance);
    runtime.ftx += (dx / distance) * step;
    runtime.fty += (dy / distance) * step;

    if (Math.hypot(waypoint.tx - runtime.ftx, waypoint.ty - runtime.fty) <= ARRIVAL_THRESHOLD) {
      runtime.ftx = waypoint.tx;
      runtime.fty = waypoint.ty;
      runtime.pathIndex += 1;
    }
  }

  unit.tx = Math.round(runtime.ftx);
  unit.ty = Math.round(runtime.fty);
  if (runtime.pathIndex >= runtime.path.length) finishMove(unit, runtime);
}

export function updateAllCombatUnitMovement(state: GameState, deltaMs: number): void {
  for (const unit of state.combatUnits) updateCombatUnitMovement(unit, deltaMs);
}

function finishMove(unit: ModularCombatUnit, runtime: CombatUnitRuntimeState): void {
  const moveOrder = runtime.order.kind === 'move' ? runtime.order : null;
  if (moveOrder) {
    runtime.ftx = moveOrder.targetTx;
    runtime.fty = moveOrder.targetTy;
    unit.tx = moveOrder.targetTx;
    unit.ty = moveOrder.targetTy;
  }
  runtime.path = [];
  runtime.pathIndex = 0;
  runtime.order = { kind: 'idle' };
}
'''

TESTS = r'''import { beforeEach, describe, expect, it } from 'vitest';
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
'''

write('src/state/unitDirection.ts', UNIT_DIRECTION)
write('src/state/combatUnitMovement.ts', COMBAT_MOVEMENT)
write('src/__tests__/combatUnitMovement.test.ts', TESTS)

# types.ts: add canonical runtime types and optional runtime field.
replace_once(
    'src/state/types.ts',
    "/** Canonical dynamic combat-unit state. Render entities are derived from this object. */\nexport interface ModularCombatUnit {",
    "export type CombatUnitOrder =\n"
    "  | { kind: 'idle' }\n"
    "  | { kind: 'move'; targetTx: number; targetTy: number };\n\n"
    "export interface CombatUnitRuntimeState {\n"
    "  ftx: number;\n"
    "  fty: number;\n"
    "  hp: number;\n"
    "  maxHp: number;\n"
    "  speedTilesPerSecond: number;\n"
    "  order: CombatUnitOrder;\n"
    "  path: Array<{ tx: number; ty: number }>;\n"
    "  pathIndex: number;\n"
    "  targetId: string | null;\n"
    "  weaponCooldownMs: number;\n"
    "  isDestroyed: boolean;\n"
    "  destroyedAt: number | null;\n"
    "}\n\n"
    "/** Canonical dynamic combat-unit state. Render entities are derived from this object. */\nexport interface ModularCombatUnit {",
)
replace_once(
    'src/state/types.ts',
    "  /** Legacy save field, migrated to hullMod/turretMod on load. */\n  mod?: ModLevel;\n}",
    "  /** Canonical production runtime. Optional only for old saves/test fixtures before normalization. */\n"
    "  runtime?: CombatUnitRuntimeState;\n"
    "  /** Legacy save field, migrated to hullMod/turretMod on load. */\n"
    "  mod?: ModLevel;\n}",
)

# combatUnits.ts: runtime defaults/migration and fractional render coordinates.
replace_once(
    'src/state/combatUnits.ts',
    "  CombatProductionConfig,\n  GameState,",
    "  CombatProductionConfig,\n  CombatUnitRuntimeState,\n  GameState,",
)
replace_once(
    'src/state/combatUnits.ts',
    "} from './types';\n",
    "} from './types';\n"
    "import { getBodyConfig, getBodyMLevelValue } from '../config/bodyData';\n",
)
replace_once(
    'src/state/combatUnits.ts',
    "export const DEFAULT_COMBAT_PRODUCTION_CONFIG: CombatProductionConfig = {",
    "export const COMBAT_TILE_SPEED_SCALE = 0.28;\n\n"
    "const MOD_LEVEL_INDEX: Record<ModLevel, 0 | 1 | 2 | 3> = {\n"
    "  m0: 0,\n  m1: 1,\n  m2: 2,\n  m3: 3,\n};\n\n"
    "export const DEFAULT_COMBAT_PRODUCTION_CONFIG: CombatProductionConfig = {",
)
insert_marker = "function parseCombatUnitCounter(id: string): number | null {"
runtime_helpers = r'''export function createCombatUnitRuntime(unit: ModularCombatUnit): CombatUnitRuntimeState {
  const hullMod = unit.hullMod ?? unit.mod ?? 'm0';
  const body = getBodyConfig(unit.bodyId);
  const level = MOD_LEVEL_INDEX[hullMod] ?? 0;
  const maxHp = body ? getBodyMLevelValue(body.hp, level) : 100;
  const speed = body
    ? getBodyMLevelValue(body.maxSpeed, level) * COMBAT_TILE_SPEED_SCALE
    : 2.5;
  return {
    ftx: unit.tx,
    fty: unit.ty,
    hp: maxHp,
    maxHp,
    speedTilesPerSecond: speed,
    order: { kind: 'idle' },
    path: [],
    pathIndex: 0,
    targetId: null,
    weaponCooldownMs: 0,
    isDestroyed: false,
    destroyedAt: null,
  };
}

export function normalizeCombatUnitRuntime(unit: ModularCombatUnit): CombatUnitRuntimeState {
  const defaults = createCombatUnitRuntime(unit);
  const raw = unit.runtime;
  const order = raw?.order?.kind === 'move'
    && Number.isFinite(raw.order.targetTx)
    && Number.isFinite(raw.order.targetTy)
    ? { kind: 'move' as const, targetTx: raw.order.targetTx, targetTy: raw.order.targetTy }
    : { kind: 'idle' as const };
  const runtime: CombatUnitRuntimeState = {
    ftx: Number.isFinite(raw?.ftx) ? raw!.ftx : defaults.ftx,
    fty: Number.isFinite(raw?.fty) ? raw!.fty : defaults.fty,
    hp: Number.isFinite(raw?.hp) ? Math.max(0, raw!.hp) : defaults.hp,
    maxHp: Number.isFinite(raw?.maxHp) && raw!.maxHp > 0 ? raw!.maxHp : defaults.maxHp,
    speedTilesPerSecond: Number.isFinite(raw?.speedTilesPerSecond) && raw!.speedTilesPerSecond > 0
      ? raw!.speedTilesPerSecond
      : defaults.speedTilesPerSecond,
    order,
    path: Array.isArray(raw?.path)
      ? raw!.path.filter(point => Number.isFinite(point?.tx) && Number.isFinite(point?.ty))
        .map(point => ({ tx: point.tx, ty: point.ty }))
      : [],
    pathIndex: Number.isInteger(raw?.pathIndex) && raw!.pathIndex >= 0 ? raw!.pathIndex : 0,
    targetId: typeof raw?.targetId === 'string' ? raw.targetId : null,
    weaponCooldownMs: Number.isFinite(raw?.weaponCooldownMs) ? Math.max(0, raw!.weaponCooldownMs) : 0,
    isDestroyed: raw?.isDestroyed === true,
    destroyedAt: Number.isFinite(raw?.destroyedAt) ? raw!.destroyedAt : null,
  };
  runtime.hp = Math.min(runtime.hp, runtime.maxHp);
  if (runtime.pathIndex > runtime.path.length) runtime.pathIndex = runtime.path.length;
  if (runtime.isDestroyed) runtime.order = { kind: 'idle' };
  unit.runtime = runtime;
  unit.tx = Math.round(runtime.ftx);
  unit.ty = Math.round(runtime.fty);
  return runtime;
}

export function getCombatUnitPosition(unit: ModularCombatUnit): { tx: number; ty: number } {
  return {
    tx: Number.isFinite(unit.runtime?.ftx) ? unit.runtime!.ftx : unit.tx,
    ty: Number.isFinite(unit.runtime?.fty) ? unit.runtime!.fty : unit.ty,
  };
}

'''
replace_once('src/state/combatUnits.ts', insert_marker, runtime_helpers + insert_marker)
replace_once(
    'src/state/combatUnits.ts',
    "    unit.turretDir ??= unit.dir;\n\n    const parsed",
    "    unit.turretDir ??= unit.dir;\n"
    "    normalizeCombatUnitRuntime(unit);\n\n"
    "    const parsed",
)
replace_once(
    'src/state/combatUnits.ts',
    "export function combatUnitToRenderableEntity(unit: ModularCombatUnit): RenderableEntity {\n  return {\n    id: unit.id,\n    kind: 'modular-combat',\n    tx: unit.tx,\n    ty: unit.ty,",
    "export function combatUnitToRenderableEntity(unit: ModularCombatUnit): RenderableEntity {\n"
    "  const position = getCombatUnitPosition(unit);\n"
    "  return {\n"
    "    id: unit.id,\n"
    "    kind: 'modular-combat',\n"
    "    tx: position.tx,\n"
    "    ty: position.ty,",
)

# Extract direction helper and wire combat movement into updateGameState/spawn.
replace_once(
    'src/state/updateGameState.ts',
    "import { allocateCombatUnitId, getCombatProductionConfig } from './combatUnits';\n",
    "import { allocateCombatUnitId, createCombatUnitRuntime, getCombatProductionConfig } from './combatUnits';\n"
    "import { updateAllCombatUnitMovement } from './combatUnitMovement';\n"
    "import { directionFromDelta } from './unitDirection';\n"
    "export { directionFromDelta } from './unitDirection';\n",
)
replace_once(
    'src/state/updateGameState.ts',
    "  for (const harvester of state.harvesters) {\n    updateHarvester(state, harvester, moveDt);\n  }\n\n  // ARCH-01C/01E/01F:",
    "  for (const harvester of state.harvesters) {\n"
    "    updateHarvester(state, harvester, moveDt);\n"
    "  }\n"
    "  updateAllCombatUnitMovement(state, moveDt);\n\n"
    "  // ARCH-01C/01E/01F:",
)
update_text = read('src/state/updateGameState.ts')
direction_start = update_text.find('// ─── Direction computation (for render sync) ───────────────────────')
direction_end = update_text.find('// ─── Separator processing cycle', direction_start)
if direction_start >= 0 and direction_end >= 0:
    update_text = update_text[:direction_start] + update_text[direction_end:]
    write('src/state/updateGameState.ts', update_text)
elif "export { directionFromDelta } from './unitDirection';" not in update_text:
    raise RuntimeError('direction helper block not found')
replace_once(
    'src/state/updateGameState.ts',
    "    turretDir: 2,\n  };\n\n  // combatUnits is the sole canonical state.",
    "    turretDir: 2,\n"
    "  };\n"
    "  combatUnit.runtime = createCombatUnitRuntime(combatUnit);\n\n"
    "  // combatUnits is the sole canonical state.",
)

# Occupancy uses canonical combat units and understands combat blockers.
replace_once(
    'src/state/occupancy.ts',
    "  // ── Soft-occupied: modular combat units ────────────────────────\n"
    "  for (const e of state.entities) {\n"
    "    if (e.kind === 'modular-combat') {\n"
    "      const k = key(e.tx, e.ty, width);\n"
    "      getOrMake(flags, k).add('soft-occupied');\n"
    "    }\n"
    "  }\n",
    "  // ── Soft-occupied: canonical production combat units ──────────\n"
    "  for (const unit of state.combatUnits) {\n"
    "    if (unit.runtime?.isDestroyed) continue;\n"
    "    const tx = Math.round(unit.runtime?.ftx ?? unit.tx);\n"
    "    const ty = Math.round(unit.runtime?.fty ?? unit.ty);\n"
    "    for (const tile of getOccupiedTiles(tx, ty, unit.bodyId)) {\n"
    "      getOrMake(flags, key(tile.tx, tile.ty, width)).add('soft-occupied');\n"
    "    }\n"
    "  }\n",
)
replace_once(
    'src/state/occupancy.ts',
    "  excludeType?: 'builder' | 'harvester',",
    "  excludeType?: 'builder' | 'harvester' | 'combat',",
)
replace_once(
    'src/state/occupancy.ts',
    "  for (const h of state.harvesters) {\n"
    "    if (excludeType === 'harvester' && excludeId === h.id) continue;\n"
    "    const k = key(Math.round(h.ftx), Math.round(h.fty), map.width);\n"
    "    getOrMake(map.flags, k).add('impassable');\n"
    "  }\n}",
    "  for (const h of state.harvesters) {\n"
    "    if (excludeType === 'harvester' && excludeId === h.id) continue;\n"
    "    const k = key(Math.round(h.ftx), Math.round(h.fty), map.width);\n"
    "    getOrMake(map.flags, k).add('impassable');\n"
    "  }\n\n"
    "  for (const unit of state.combatUnits) {\n"
    "    if (unit.runtime?.isDestroyed) continue;\n"
    "    if (excludeType === 'combat' && excludeId === unit.id) continue;\n"
    "    const tx = Math.round(unit.runtime?.ftx ?? unit.tx);\n"
    "    const ty = Math.round(unit.runtime?.fty ?? unit.ty);\n"
    "    for (const tile of getOccupiedTiles(tx, ty, unit.bodyId)) {\n"
    "      getOrMake(map.flags, key(tile.tx, tile.ty, map.width)).add('impassable');\n"
    "    }\n"
    "  }\n}",
)
replace_once(
    'src/state/occupancy.ts',
    "  excludeType?: 'builder' | 'harvester',\n  excludeId?: number | string,\n): boolean {",
    "  excludeType?: 'builder' | 'harvester' | 'combat',\n"
    "  excludeId?: number | string,\n"
    "): boolean {",
)
replace_once(
    'src/state/occupancy.ts',
    "  for (const h of state.harvesters) {\n"
    "    if (excludeType === 'harvester' && excludeId === h.id) continue;\n"
    "    if (Math.round(h.ftx) === tx && Math.round(h.fty) === ty) return true;\n"
    "  }\n\n"
    "  return false;\n}",
    "  for (const h of state.harvesters) {\n"
    "    if (excludeType === 'harvester' && excludeId === h.id) continue;\n"
    "    if (Math.round(h.ftx) === tx && Math.round(h.fty) === ty) return true;\n"
    "  }\n\n"
    "  for (const unit of state.combatUnits) {\n"
    "    if (unit.runtime?.isDestroyed) continue;\n"
    "    if (excludeType === 'combat' && excludeId === unit.id) continue;\n"
    "    const ux = Math.round(unit.runtime?.ftx ?? unit.tx);\n"
    "    const uy = Math.round(unit.runtime?.fty ?? unit.ty);\n"
    "    if (getOccupiedTiles(ux, uy, unit.bodyId).some(tile => tile.tx === tx && tile.ty === ty)) return true;\n"
    "  }\n\n"
    "  return false;\n}",
)

# Selection/control groups support combat units.
replace_once(
    'src/state/unitSelection.ts',
    "export type SelectableUnit =\n  | { kind: 'builder'; id: string }\n  | { kind: 'harvester'; id: string };",
    "export type SelectableUnit =\n"
    "  | { kind: 'builder'; id: string }\n"
    "  | { kind: 'harvester'; id: string }\n"
    "  | { kind: 'combat'; id: string };",
)
replace_once(
    'src/state/unitSelection.ts',
    "    } else if (u.kind === 'harvester') {\n      return state.harvesters.some(h => h.id === u.id);\n    }\n    return false;",
    "    } else if (u.kind === 'harvester') {\n"
    "      return state.harvesters.some(h => h.id === u.id);\n"
    "    } else if (u.kind === 'combat') {\n"
    "      return state.combatUnits.some(unit => unit.id === u.id && !unit.runtime?.isDestroyed);\n"
    "    }\n"
    "    return false;",
)
replace_once(
    'src/state/unitSelection.ts',
    "    } else if (u.kind === 'harvester') {\n"
    "      const h = state.harvesters.find(h => h.id === u.id);\n"
    "      if (h) {\n"
    "        sumTx += h.ftx;\n"
    "        sumTy += h.fty;\n"
    "        count++;\n"
    "      }\n"
    "    }\n",
    "    } else if (u.kind === 'harvester') {\n"
    "      const h = state.harvesters.find(h => h.id === u.id);\n"
    "      if (h) {\n"
    "        sumTx += h.ftx;\n"
    "        sumTy += h.fty;\n"
    "        count++;\n"
    "      }\n"
    "    } else if (u.kind === 'combat') {\n"
    "      const unit = state.combatUnits.find(candidate => candidate.id === u.id);\n"
    "      if (unit && !unit.runtime?.isDestroyed) {\n"
    "        sumTx += unit.runtime?.ftx ?? unit.tx;\n"
    "        sumTy += unit.runtime?.fty ?? unit.ty;\n"
    "        count++;\n"
    "      }\n"
    "    }\n",
)
replace_once(
    'src/state/unitSelection.ts',
    "/** Whether all selected units are builders. */",
    "/** Whether any selected unit is a combat unit. */\n"
    "export function hasCombatInSelection(selection: UnitSelection): boolean {\n"
    "  return selection?.units.some(unit => unit.kind === 'combat') ?? false;\n"
    "}\n\n"
    "/** Whether all selected units are builders. */",
)

# Command routing represents combat selection honestly.
replace_once(
    'src/state/commandRouter.ts',
    "    case 'own-combat-vehicle':\n"
    "      // Combat vehicles are selected in Arena mode via BlockoutVehicleInputController.\n"
    "      return { action: 'select', selection: selectOne({ kind: 'harvester', id: target.id! }) };",
    "    case 'own-combat-vehicle': {\n"
    "      const unit: SelectableUnit = { kind: 'combat', id: target.id! };\n"
    "      if (shiftHeld) {\n"
    "        return { action: 'toggle-in-selection', selection: toggleInSelection(currentSelection, unit) };\n"
    "      }\n"
    "      return { action: 'select', selection: selectOne(unit) };\n"
    "    }",
)

# Unit commands delegate combat move/stop to the canonical runtime.
replace_once(
    'src/state/unitCommands.ts',
    "import type { SelectableUnit, UnitSelection } from './unitSelection';\n",
    "import type { SelectableUnit, UnitSelection } from './unitSelection';\n"
    "import { issueCombatUnitMove, stopCombatUnit } from './combatUnitMovement';\n",
)
replace_once(
    'src/state/unitCommands.ts',
    "  | { ok: false; reason: 'no-unit-selected' | 'target-impassable' | 'target-occupied' | 'no-path' | 'unit-busy' };",
    "  | { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' | 'target-impassable' | 'target-occupied' | 'no-path' | 'unit-busy' };",
)
replace_once(
    'src/state/unitCommands.ts',
    "  } else if (unit.kind === 'builder') {",
    "  } else if (unit.kind === 'combat') {\n"
    "    return issueCombatUnitMove(state, unit.id, targetTx, targetTy);\n"
    "  } else if (unit.kind === 'builder') {",
)
replace_once(
    'src/state/unitCommands.ts',
    "  if (unit.kind === 'builder') {",
    "  if (unit.kind === 'combat') {\n"
    "    return stopCombatUnit(state, unit.id);\n"
    "  }\n\n"
    "  if (unit.kind === 'builder') {",
)

# Renderer follows fractional canonical runtime position.
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "import { combatUnitToRenderableEntity } from '../../state/combatUnits';",
    "import { combatUnitToRenderableEntity, getCombatUnitPosition } from '../../state/combatUnits';",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "      const entity = combatUnitToRenderableEntity(unit);\n      const screen = tileToScreen(unit.tx, unit.ty);",
    "      const entity = combatUnitToRenderableEntity(unit);\n"
    "      const position = getCombatUnitPosition(unit);\n"
    "      const screen = tileToScreen(position.tx, position.ty);",
)
replace_once(
    'src/phaser/render/CombatUnitRenderer.ts',
    "        tx: unit.tx,\n        ty: unit.ty,",
    "        tx: position.tx,\n        ty: position.ty,",
)

# GameInputController: combat click, drag, hover, status and commands.
replace_once(
    'src/phaser/input/GameInputController.ts',
    "    // Check harvesters — convert world positions to screen space\n",
    "    // Check canonical production combat units.\n"
    "    for (const unit of gameState.combatUnits) {\n"
    "      if (unit.faction !== gameState.playerFaction || unit.runtime?.isDestroyed) continue;\n"
    "      const pos = tileToScreen(unit.runtime?.ftx ?? unit.tx, unit.runtime?.fty ?? unit.ty);\n"
    "      const { sx, sy } = this.worldToScreen(pos.x + this.offset.x, pos.y + this.offset.y);\n"
    "      if (sx >= left && sx <= right && sy >= top && sy <= bottom && !this.isScreenYInActiveHud(sy)) {\n"
    "        selectedUnits.push({ kind: 'combat', id: unit.id });\n"
    "      }\n"
    "    }\n\n"
    "    // Check harvesters — convert world positions to screen space\n",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "    // Check resources (for harvest commands)\n",
    "    // Check own canonical combat units.\n"
    "    for (const unit of gameState.combatUnits) {\n"
    "      if (unit.faction !== gameState.playerFaction || unit.runtime?.isDestroyed) continue;\n"
    "      const dx = (unit.runtime?.ftx ?? unit.tx) - clickTx;\n"
    "      const dy = (unit.runtime?.fty ?? unit.ty) - clickTy;\n"
    "      if (Math.hypot(dx, dy) < SELECT_RADIUS) {\n"
    "        return { kind: 'own-combat-vehicle', id: unit.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };\n"
    "      }\n"
    "    }\n\n"
    "    // Check resources (for harvest commands)\n",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "        const label = this.selection.units[0].kind === 'builder' ? 'Строитель' : 'Сборщик';",
    "        const kind = this.selection.units[0].kind;\n"
    "        const label = kind === 'builder' ? 'Строитель' : kind === 'harvester' ? 'Сборщик' : 'Танк';",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "      const label = primary.kind === 'builder'\n"
    "        ? `Builder ${primary.id}`\n"
    "        : `Harvester ${primary.id}`;",
    "      const label = primary.kind === 'builder'\n"
    "        ? `Builder ${primary.id}`\n"
    "        : primary.kind === 'harvester'\n"
    "          ? `Harvester ${primary.id}`\n"
    "          : `Tank ${primary.id}`;",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "      const hc = breakdown.get('harvester') ?? 0;\n"
    "      if (bc > 0) parts.push(`${bc} Builder${bc > 1 ? 's' : ''}`);\n"
    "      if (hc > 0) parts.push(`${hc} Harvester${hc > 1 ? 's' : ''}`);",
    "      const hc = breakdown.get('harvester') ?? 0;\n"
    "      const cc = breakdown.get('combat') ?? 0;\n"
    "      if (bc > 0) parts.push(`${bc} Builder${bc > 1 ? 's' : ''}`);\n"
    "      if (hc > 0) parts.push(`${hc} Harvester${hc > 1 ? 's' : ''}`);\n"
    "      if (cc > 0) parts.push(`${cc} Tank${cc > 1 ? 's' : ''}`);",
)
replace_once(
    'src/phaser/input/GameInputController.ts',
    "    if (!hoverTarget) {\n      for (const r of gameState.resourceNodes) {",
    "    if (!hoverTarget) {\n"
    "      for (const unit of gameState.combatUnits) {\n"
    "        if (unit.faction !== gameState.playerFaction || unit.runtime?.isDestroyed) continue;\n"
    "        const dx = (unit.runtime?.ftx ?? unit.tx) - clickTx;\n"
    "        const dy = (unit.runtime?.fty ?? unit.ty) - clickTy;\n"
    "        if (Math.hypot(dx, dy) < SELECT_RADIUS) {\n"
    "          hoverTarget = { kind: 'own-combat-vehicle', id: unit.id, tx: Math.round(clickTx), ty: Math.round(clickTy) };\n"
    "          break;\n"
    "        }\n"
    "      }\n"
    "    }\n\n"
    "    if (!hoverTarget) {\n"
    "      for (const r of gameState.resourceNodes) {",
)

print('SKIRMISH-P2A patch applied')
