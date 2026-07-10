import type {
  CombatProductionConfig,
  CombatUnitRuntimeState,
  GameState,
  ModularCombatUnit,
  ModLevel,
  ProducibleUnitType,
  ProductionQueueItem,
  RenderableEntity,
  UnitProductionRequest,
} from './types';
import { getBodyConfig, getBodyMLevelValue } from '../config/bodyData';

export const COMBAT_TILE_SPEED_SCALE = 0.28;

const MOD_LEVEL_INDEX: Record<ModLevel, 0 | 1 | 2 | 3> = {
  m0: 0,
  m1: 1,
  m2: 2,
  m3: 3,
};

export const DEFAULT_COMBAT_PRODUCTION_CONFIG: CombatProductionConfig = {
  bodyId: 'wasp',
  weaponId: 'smoky',
  hullMod: 'm0',
  turretMod: 'm0',
};

export function normalizeProductionRequest(
  input: ProducibleUnitType | UnitProductionRequest,
): { unitType: ProducibleUnitType; request: UnitProductionRequest } {
  if (typeof input !== 'string') {
    if (input.kind === 'civil') {
      return { unitType: input.unitType, request: input };
    }
    return { unitType: 'wasp-smoky', request: input };
  }

  if (input === 'builder' || input === 'harvester') {
    return { unitType: input, request: { kind: 'civil', unitType: input } };
  }

  return {
    unitType: 'wasp-smoky',
    request: { kind: 'combat', ...DEFAULT_COMBAT_PRODUCTION_CONFIG },
  };
}

export function getCombatProductionConfig(
  item: Pick<ProductionQueueItem, 'unitType' | 'request'>,
): CombatProductionConfig | null {
  if (item.request?.kind === 'combat') {
    return {
      bodyId: item.request.bodyId,
      weaponId: item.request.weaponId,
      hullMod: item.request.hullMod,
      turretMod: item.request.turretMod,
    };
  }

  return item.unitType === 'wasp-smoky'
    ? { ...DEFAULT_COMBAT_PRODUCTION_CONFIG }
    : null;
}

export function createCombatUnitRuntime(unit: ModularCombatUnit): CombatUnitRuntimeState {
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
    turretAngleDeg: (unit.turretDir ?? unit.dir ?? 2) * 45,
    isWindingUp: false,
    windUpRemainingMs: 0,
    windUpTargetId: null,
    repathCooldownMs: 0,
    muzzleFlashUntilMs: 0,
    damageFlashUntilMs: 0,
    lastFiredAtMs: null,
    lastDamageAmount: 0,
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
    : raw?.order?.kind === 'attack' && typeof raw.order.targetId === 'string'
      ? { kind: 'attack' as const, targetId: raw.order.targetId }
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
    turretAngleDeg: Number.isFinite(raw?.turretAngleDeg) ? raw!.turretAngleDeg : defaults.turretAngleDeg,
    isWindingUp: raw?.isWindingUp === true,
    windUpRemainingMs: Number.isFinite(raw?.windUpRemainingMs) ? Math.max(0, raw!.windUpRemainingMs) : 0,
    windUpTargetId: typeof raw?.windUpTargetId === 'string' ? raw.windUpTargetId : null,
    repathCooldownMs: Number.isFinite(raw?.repathCooldownMs) ? Math.max(0, raw!.repathCooldownMs) : 0,
    muzzleFlashUntilMs: Number.isFinite(raw?.muzzleFlashUntilMs) ? Math.max(0, raw!.muzzleFlashUntilMs) : 0,
    damageFlashUntilMs: Number.isFinite(raw?.damageFlashUntilMs) ? Math.max(0, raw!.damageFlashUntilMs) : 0,
    lastFiredAtMs: Number.isFinite(raw?.lastFiredAtMs) ? raw!.lastFiredAtMs : null,
    lastDamageAmount: Number.isFinite(raw?.lastDamageAmount) ? Math.max(0, raw!.lastDamageAmount) : 0,
    isDestroyed: raw?.isDestroyed === true,
    destroyedAt: Number.isFinite(raw?.destroyedAt) ? raw!.destroyedAt : null,
  };
  runtime.hp = Math.min(runtime.hp, runtime.maxHp);
  if (runtime.pathIndex > runtime.path.length) runtime.pathIndex = runtime.path.length;
  if (runtime.isDestroyed) {
    runtime.order = { kind: 'idle' };
    runtime.targetId = null;
    runtime.path = [];
    runtime.pathIndex = 0;
    runtime.isWindingUp = false;
  }
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

function parseCombatUnitCounter(id: string): number | null {
  const match = /^combat-unit-(\d+)$/.exec(id);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function normalizeCombatUnitState(state: GameState): void {
  if (!Array.isArray(state.combatUnits)) state.combatUnits = [];

  const usedIds = new Set<string>();
  const storedNextId = state.nextCombatUnitId;
  let nextId = typeof storedNextId === 'number' && Number.isInteger(storedNextId) && storedNextId >= 0
    ? storedNextId
    : 0;

  for (const rawUnit of state.combatUnits) {
    const unit = rawUnit as ModularCombatUnit & { mod?: ModLevel };
    const legacyMod = unit.mod ?? 'm0';
    unit.hullMod ??= legacyMod;
    unit.turretMod ??= legacyMod;
    unit.dir ??= 2;
    unit.turretDir ??= unit.dir;
    normalizeCombatUnitRuntime(unit);

    const parsed = typeof unit.id === 'string' ? parseCombatUnitCounter(unit.id) : null;
    if (parsed !== null) nextId = Math.max(nextId, parsed + 1);

    if (typeof unit.id !== 'string' || unit.id.length === 0 || usedIds.has(unit.id)) {
      while (usedIds.has(`combat-unit-${nextId}`)) nextId++;
      unit.id = `combat-unit-${nextId++}`;
    }
    usedIds.add(unit.id);

    // Remove the legacy combined field after migration so future saves stay canonical.
    delete unit.mod;
  }

  while (usedIds.has(`combat-unit-${nextId}`)) nextId++;
  state.nextCombatUnitId = nextId;
}

export function allocateCombatUnitId(state: GameState): string {
  normalizeCombatUnitState(state);
  const usedIds = new Set(state.combatUnits.map(unit => unit.id));
  let nextId = state.nextCombatUnitId ?? 0;
  while (usedIds.has(`combat-unit-${nextId}`)) nextId++;
  state.nextCombatUnitId = nextId + 1;
  return `combat-unit-${nextId}`;
}

export function combatUnitToRenderableEntity(unit: ModularCombatUnit): RenderableEntity {
  const position = getCombatUnitPosition(unit);
  return {
    id: unit.id,
    kind: 'modular-combat',
    tx: position.tx,
    ty: position.ty,
    faction: unit.faction,
    dir: unit.dir ?? 2,
    turretDir: unit.turretDir ?? unit.dir ?? 2,
  };
}
