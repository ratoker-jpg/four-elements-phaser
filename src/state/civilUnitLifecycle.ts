import type {
  BuilderPlacement,
  CivilUnitType,
  GameState,
  HarvesterState,
  RenderableEntity,
  TeamId,
} from './types';
import { ensureMatchState } from './matchState';
import { startUnitProduction } from './production';

export const BUILDER_MAX_HP = 240;
export const HARVESTER_MAX_HP = 320;
export const CIVIL_WRECK_LIFETIME_MS = 1200;
export const AI_MIN_BUILDERS = 1;
export const AI_MIN_HARVESTERS = 2;

export type CivilUnitKind = 'builder' | 'harvester';

export interface CivilDamageResult {
  kind: CivilUnitKind | null;
  finalDamage: number;
  killed: boolean;
}

function normalizeBuilder(builder: BuilderPlacement): BuilderPlacement {
  builder.maxHp ??= BUILDER_MAX_HP;
  builder.hp ??= builder.maxHp;
  builder.isDestroyed ??= false;
  builder.destroyedAt ??= null;
  return builder;
}

function normalizeHarvester(harvester: HarvesterState): HarvesterState {
  harvester.maxHp ??= HARVESTER_MAX_HP;
  harvester.hp ??= harvester.maxHp;
  harvester.isDestroyed ??= false;
  harvester.destroyedAt ??= null;
  return harvester;
}

export function normalizeCivilUnitDurability(state: GameState): void {
  state.mapData.builders ??= [];
  state.harvesters ??= [];
  for (const builder of state.mapData.builders) normalizeBuilder(builder);
  for (const harvester of state.harvesters) normalizeHarvester(harvester);
  state.civilClockMs = Math.max(0, state.civilClockMs ?? 0);
  if (state.nextCivilUnitId === undefined || state.nextCivilUnitId < 0) {
    state.nextCivilUnitId = inferNextCivilUnitId(state);
  }
}

function inferNextCivilUnitId(state: GameState): number {
  let next = 0;
  const ids = [
    ...state.mapData.builders.map(unit => unit.id),
    ...state.harvesters.map(unit => unit.id),
  ];
  for (const id of ids) {
    const match = /^civil-team-(?:cyan|green|yellow|purple)-(?:builder|harvester)-(\d+)$/.exec(id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return next;
}

function resolveCivilOwnerTeamId(
  state: GameState,
  ownerTeamId: TeamId | undefined,
): TeamId {
  const match = ensureMatchState(state);
  return ownerTeamId && match.teams[ownerTeamId]
    ? ownerTeamId
    : match.humanTeamId;
}

/**
 * Normalize old saves into one canonical civil-unit representation.
 *
 * - repairs missing or duplicate IDs deterministically;
 * - restores owner/faction, durability and deterministic counters;
 * - rebuilds Builder/Harvester render entities from canonical state;
 * - keeps destroyed civil wrecks non-renderable until bounded cleanup.
 */
export function normalizeCivilUnitState(state: GameState): void {
  const match = ensureMatchState(state);
  state.mapData.builders ??= [];
  state.harvesters ??= [];
  state.entities ??= [];

  const usedIds = new Set<string>();
  let migrationCounter = 0;
  const allocateMigrationId = (
    kind: CivilUnitKind,
    ownerTeamId: TeamId,
  ): string => {
    let id = '';
    do {
      id = `civil-migrated-${ownerTeamId}-${kind}-${migrationCounter++}`;
    } while (usedIds.has(id));
    return id;
  };

  for (const builder of state.mapData.builders) {
    const ownerTeamId = resolveCivilOwnerTeamId(state, builder.ownerTeamId);
    builder.ownerTeamId = ownerTeamId;
    if (typeof builder.id !== 'string' || builder.id.length === 0 || usedIds.has(builder.id)) {
      builder.id = allocateMigrationId('builder', ownerTeamId);
    }
    usedIds.add(builder.id);
    normalizeBuilder(builder);
  }

  for (const harvester of state.harvesters) {
    const ownerTeamId = resolveCivilOwnerTeamId(state, harvester.ownerTeamId);
    harvester.ownerTeamId = ownerTeamId;
    harvester.faction = match.teams[ownerTeamId].faction;
    if (typeof harvester.id !== 'string' || harvester.id.length === 0 || usedIds.has(harvester.id)) {
      harvester.id = allocateMigrationId('harvester', ownerTeamId);
    }
    usedIds.add(harvester.id);
    normalizeHarvester(harvester);
  }

  state.nextCivilUnitId = Math.max(
    0,
    state.nextCivilUnitId ?? 0,
    inferNextCivilUnitId(state),
  );
  state.civilClockMs = Math.max(0, state.civilClockMs ?? 0);

  const nonCivilEntities = state.entities.filter(entity =>
    entity.kind !== 'builder' && entity.kind !== 'harvester',
  );
  const civilEntities: RenderableEntity[] = [];
  for (const builder of state.mapData.builders) {
    if (builder.isDestroyed) continue;
    const ownerTeamId = resolveCivilOwnerTeamId(state, builder.ownerTeamId);
    civilEntities.push({
      id: builder.id,
      kind: 'builder',
      tx: Math.round(builder.ftx),
      ty: Math.round(builder.fty),
      faction: match.teams[ownerTeamId].faction,
      ownerTeamId,
    });
  }
  for (const harvester of state.harvesters) {
    if (harvester.isDestroyed) continue;
    const ownerTeamId = resolveCivilOwnerTeamId(state, harvester.ownerTeamId);
    civilEntities.push({
      id: harvester.id,
      kind: 'harvester',
      tx: Math.round(harvester.ftx),
      ty: Math.round(harvester.fty),
      faction: match.teams[ownerTeamId].faction,
      ownerTeamId,
    });
  }
  state.entities = [...nonCivilEntities, ...civilEntities];
}

export function allocateCivilUnitId(
  state: GameState,
  unitType: CivilUnitType,
  ownerTeamId: TeamId,
): string {
  normalizeCivilUnitDurability(state);
  const used = new Set([
    ...state.mapData.builders.map(unit => unit.id),
    ...state.harvesters.map(unit => unit.id),
  ]);
  let counter = state.nextCivilUnitId ?? 0;
  let id = `civil-${ownerTeamId}-${unitType}-${counter}`;
  while (used.has(id)) {
    counter++;
    id = `civil-${ownerTeamId}-${unitType}-${counter}`;
  }
  state.nextCivilUnitId = counter + 1;
  return id;
}

export function applyCivilUnitDamage(
  state: GameState,
  targetId: string,
  rawDamage: number,
): CivilDamageResult {
  normalizeCivilUnitDurability(state);
  const damage = Math.max(0, rawDamage);
  const builderIndex = state.mapData.builders.findIndex(unit => unit.id === targetId);
  if (builderIndex >= 0) {
    const builder = normalizeBuilder(state.mapData.builders[builderIndex]);
    if (builder.isDestroyed) return { kind: 'builder', finalDamage: 0, killed: false };
    const finalDamage = Math.min(builder.hp!, damage);
    builder.hp = Math.max(0, builder.hp! - damage);
    const killed = builder.hp <= 0;
    if (killed) destroyBuilder(state, builderIndex, builder);
    return { kind: 'builder', finalDamage, killed };
  }

  const harvester = state.harvesters.find(unit => unit.id === targetId);
  if (!harvester) return { kind: null, finalDamage: 0, killed: false };
  normalizeHarvester(harvester);
  if (harvester.isDestroyed) return { kind: 'harvester', finalDamage: 0, killed: false };
  const finalDamage = Math.min(harvester.hp!, damage);
  harvester.hp = Math.max(0, harvester.hp! - damage);
  const killed = harvester.hp <= 0;
  if (killed) destroyHarvester(state, harvester);
  return { kind: 'harvester', finalDamage, killed };
}

function destroyBuilder(
  state: GameState,
  builderIndex: number,
  builder: BuilderPlacement,
): void {
  builder.isDestroyed = true;
  builder.destroyedAt = state.civilClockMs ?? 0;
  builder.busy = false;
  builder.phase = 'idle';
  builder.path = [];
  builder.pathIndex = 0;
  builder.manualMove = undefined;
  for (const site of state.mapData.constructionSites) {
    if (site.builderIndex === builderIndex || site.id === builder.assignedSiteId) {
      site.builderIndex = -1;
      site.pending = true;
    }
  }
  builder.assignedSiteId = -1;
  removeRenderableEntity(state, builder.id);
}

function destroyHarvester(state: GameState, harvester: HarvesterState): void {
  harvester.isDestroyed = true;
  harvester.destroyedAt = state.civilClockMs ?? 0;
  harvester.phase = 'idle';
  harvester.targetResourceId = null;
  harvester.cargoRaw = 0;
  harvester.approachPath = undefined;
  harvester.returnPath = undefined;
  harvester.manualPath = undefined;
  harvester.blockedReason = undefined;
  removeRenderableEntity(state, harvester.id);
}

function removeRenderableEntity(state: GameState, id: string): void {
  state.entities = state.entities.filter(entity => entity.id !== id);
}

export function updateCivilUnitLifecycle(state: GameState, deltaMs: number): void {
  normalizeCivilUnitDurability(state);
  const dt = Math.max(deltaMs, 0);
  state.civilClockMs = (state.civilClockMs ?? 0) + dt;
  removeExpiredCivilWrecks(state);
  queueAiCivilReplacements(state);
}

export function removeExpiredCivilWrecks(state: GameState): void {
  const clock = state.civilClockMs ?? 0;
  for (let index = state.mapData.builders.length - 1; index >= 0; index--) {
    const builder = normalizeBuilder(state.mapData.builders[index]);
    if (!builder.isDestroyed || builder.destroyedAt == null) continue;
    if (clock - builder.destroyedAt < CIVIL_WRECK_LIFETIME_MS) continue;
    state.mapData.builders.splice(index, 1);
    for (const site of state.mapData.constructionSites) {
      if (site.builderIndex > index) site.builderIndex--;
      else if (site.builderIndex === index) {
        site.builderIndex = -1;
        site.pending = true;
      }
    }
  }

  for (let index = state.harvesters.length - 1; index >= 0; index--) {
    const harvester = normalizeHarvester(state.harvesters[index]);
    if (!harvester.isDestroyed || harvester.destroyedAt == null) continue;
    if (clock - harvester.destroyedAt < CIVIL_WRECK_LIFETIME_MS) continue;
    state.harvesters.splice(index, 1);
  }
}

function queuedCivilCount(
  state: GameState,
  teamId: TeamId,
  unitType: CivilUnitType,
): number {
  let count = 0;
  for (const factory of state.production.factories) {
    if (factory.ownerTeamId !== teamId) continue;
    for (const item of factory.queue) {
      const requestType = item.request?.kind === 'civil'
        ? item.request.unitType
        : item.unitType;
      if (requestType === unitType) count++;
    }
  }
  return count;
}

export function queueAiCivilReplacements(state: GameState): void {
  const match = ensureMatchState(state);
  for (const teamId of match.activeTeamIds) {
    const team = match.teams[teamId];
    if (team.controller !== 'ai' || team.eliminated) continue;
    const factory = state.production.factories.find(item => item.ownerTeamId === teamId);
    if (!factory) continue;

    const liveBuilders = state.mapData.builders.filter(unit =>
      !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === teamId,
    ).length;
    const liveHarvesters = state.harvesters.filter(unit =>
      !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === teamId,
    ).length;
    const missing: CivilUnitType[] = [];
    for (let i = liveBuilders + queuedCivilCount(state, teamId, 'builder'); i < AI_MIN_BUILDERS; i++) {
      missing.push('builder');
    }
    for (let i = liveHarvesters + queuedCivilCount(state, teamId, 'harvester'); i < AI_MIN_HARVESTERS; i++) {
      missing.push('harvester');
    }

    for (const unitType of missing) {
      const result = startUnitProduction(state, factory.tx, factory.ty, unitType);
      if (!result.ok) break;
    }
  }
}
