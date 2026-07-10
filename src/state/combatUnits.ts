import type {
  CombatProductionConfig,
  GameState,
  ModularCombatUnit,
  ModLevel,
  ProducibleUnitType,
  ProductionQueueItem,
  RenderableEntity,
  UnitProductionRequest,
} from './types';

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
  return {
    id: unit.id,
    kind: 'modular-combat',
    tx: unit.tx,
    ty: unit.ty,
    faction: unit.faction,
    dir: unit.dir ?? 2,
    turretDir: unit.turretDir ?? unit.dir ?? 2,
  };
}
