from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"{label}: marker not found")
    return text.replace(old, new, 1)


# ── types.ts: optional durability and deterministic civil timeline ───
path = "src/state/types.ts"
text = read(path)
text = replace_once(
    text,
    "  /** ARCH-05X hardening: true when moving to a manual-move target (not a construction site). */\n"
    "  manualMove?: boolean;\n}",
    "  /** ARCH-05X hardening: true when moving to a manual-move target (not a construction site). */\n"
    "  manualMove?: boolean;\n"
    "  /** Civil durability fields are optional only for old saves and fixtures. */\n"
    "  hp?: number;\n"
    "  maxHp?: number;\n"
    "  isDestroyed?: boolean;\n"
    "  destroyedAt?: number | null;\n}",
    "builder durability",
)
text = replace_once(
    text,
    "  /** Reason when harvester is blocked and cannot make progress. Cleared when progress resumes. */\n"
    "  blockedReason?: HarvesterBlockedReason;\n}",
    "  /** Reason when harvester is blocked and cannot make progress. Cleared when progress resumes. */\n"
    "  blockedReason?: HarvesterBlockedReason;\n"
    "  /** Civil durability fields are optional only for old saves and fixtures. */\n"
    "  hp?: number;\n"
    "  maxHp?: number;\n"
    "  isDestroyed?: boolean;\n"
    "  destroyedAt?: number | null;\n}",
    "harvester durability",
)
text = replace_once(
    text,
    "  /** Auto-incrementing counter for deterministic produced combat-unit IDs. Missing only in old saves/fixtures. */\n"
    "  nextCombatUnitId?: number;",
    "  /** Auto-incrementing counter for deterministic produced combat-unit IDs. Missing only in old saves/fixtures. */\n"
    "  nextCombatUnitId?: number;\n"
    "  /** Auto-incrementing counter for deterministic produced civil-unit IDs. */\n"
    "  nextCivilUnitId?: number;\n"
    "  /** Deterministic civil destruction/replacement timeline. */\n"
    "  civilClockMs?: number;",
    "civil counters",
)
write(path, text)


# ── new canonical civil lifecycle ─────────────────────────────────────
lifecycle = '''import type {
  BuilderPlacement,
  CivilUnitType,
  GameState,
  HarvesterState,
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
    const match = /^civil-team-(?:cyan|green|yellow|purple)-(?:builder|harvester)-(\\d+)$/.exec(id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return next;
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
    if (!builder.isDestroyed || builder.destroyedAt === null) continue;
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
    if (!harvester.isDestroyed || harvester.destroyedAt === null) continue;
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
'''
write("src/state/civilUnitLifecycle.ts", lifecycle)


# ── createInitialState.ts: counters and matching render/runtime IDs ───
path = "src/state/createInitialState.ts"
text = read(path)
old_loop = '''  // Add extra harvesters to the entity list
  for (const h of extraHarvesters) {
    entities.push({
      id: `extra-harvester-${h.ownerTeamId ?? h.faction}-${h.tx}-${h.ty}`,
      kind: 'harvester',
      tx: h.tx,
      ty: h.ty,
      faction: h.faction,
      ownerTeamId: h.ownerTeamId,
    });
  }'''
new_loop = '''  // Add extra harvesters using the same deterministic IDs as runtime state.
  const starterHarvesterIndex = new Map<string, number>();
  for (const h of extraHarvesters) {
    const ownerTeamId = h.ownerTeamId ?? teamIdForFaction(h.faction);
    const index = starterHarvesterIndex.get(ownerTeamId) ?? 0;
    starterHarvesterIndex.set(ownerTeamId, index + 1);
    entities.push({
      id: `harvester-${ownerTeamId}-${index}`,
      kind: 'harvester',
      tx: h.tx,
      ty: h.ty,
      faction: h.faction,
      ownerTeamId,
    });
  }'''
text = replace_once(text, old_loop, new_loop, "starter harvester entity IDs")
text = replace_once(
    text,
    "    nextConstructionId: 0,\n    nextCombatUnitId: 0,\n    combatClockMs: 0,",
    "    nextConstructionId: 0,\n"
    "    nextCombatUnitId: 0,\n"
    "    nextCivilUnitId: 0,\n"
    "    civilClockMs: 0,\n"
    "    combatClockMs: 0,",
    "civil counters initialization",
)
write(path, text)


# ── updateGameState.ts: lifecycle integration and deterministic spawns ──
path = "src/state/updateGameState.ts"
text = read(path)
text = replace_once(
    text,
    "import { getOwningTeam, ensureMatchState } from './matchState';\nexport { directionFromDelta } from './unitDirection';",
    "import { getOwningTeam, ensureMatchState } from './matchState';\n"
    "import {\n"
    "  allocateCivilUnitId,\n"
    "  BUILDER_MAX_HP,\n"
    "  HARVESTER_MAX_HP,\n"
    "  updateCivilUnitLifecycle,\n"
    "} from './civilUnitLifecycle';\n"
    "export { directionFromDelta } from './unitDirection';",
    "civil lifecycle imports",
)
text = replace_once(
    text,
    "export function updateGameState(state: GameState, deltaMs: number): void {\n"
    "  ensureMatchState(state);",
    "export function updateGameState(state: GameState, deltaMs: number): void {\n"
    "  ensureMatchState(state);\n"
    "  updateCivilUnitLifecycle(state, deltaMs);",
    "civil lifecycle tick",
)
text = replace_once(
    text,
    "  for (const harvester of state.harvesters) {\n    updateHarvester(state, harvester, moveDt);\n  }",
    "  for (const harvester of state.harvesters) {\n"
    "    if (harvester.isDestroyed) continue;\n"
    "    updateHarvester(state, harvester, moveDt);\n"
    "  }",
    "skip destroyed harvesters",
)
text = text.replace(
    "state.mapData.builders.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length",
    "state.mapData.builders.filter(unit => !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length",
)
text = text.replace(
    "state.harvesters.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length",
    "state.harvesters.filter(unit => !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length",
)
text = replace_once(
    text,
    "  // BUILDER-ID: Generate a stable, unique ID for the spawned builder.\n"
    "  const id = `builder-spawn-${tx}-${ty}-${Date.now()}`;",
    "  const id = allocateCivilUnitId(state, 'builder', owner.id);",
    "deterministic builder ID",
)
text = replace_once(
    text,
    "    assignedSiteId: -1,\n  };",
    "    assignedSiteId: -1,\n"
    "    hp: BUILDER_MAX_HP,\n"
    "    maxHp: BUILDER_MAX_HP,\n"
    "    isDestroyed: false,\n"
    "    destroyedAt: null,\n"
    "  };",
    "spawned builder durability",
)
text = replace_once(
    text,
    "  const id = `harvester-spawn-${tx}-${ty}-${Date.now()}`;",
    "  const id = allocateCivilUnitId(state, 'harvester', owner.id);",
    "deterministic harvester ID",
)
text = replace_once(
    text,
    "    speedTilesPerSecond: DEFAULT_SPEED,\n  };",
    "    speedTilesPerSecond: DEFAULT_SPEED,\n"
    "    hp: HARVESTER_MAX_HP,\n"
    "    maxHp: HARVESTER_MAX_HP,\n"
    "    isDestroyed: false,\n"
    "    destroyedAt: null,\n"
    "  };",
    "harvester durability defaults",
)
write(path, text)


# ── builder.ts: destroyed builders never assign or update ─────────────
path = "src/state/builder.ts"
text = read(path)
text = replace_once(
    text,
    "      builder.phase === 'idle'\n      && !builder.busy",
    "      !builder.isDestroyed\n      && builder.phase === 'idle'\n      && !builder.busy",
    "builder assignment destroyed guard",
)
text = replace_once(
    text,
    "    const builder = state.mapData.builders[bi];\n    updateBuilder(state, builder, bi, dt);",
    "    const builder = state.mapData.builders[bi];\n"
    "    if (builder.isDestroyed) continue;\n"
    "    updateBuilder(state, builder, bi, dt);",
    "builder update destroyed guard",
)
write(path, text)


# ── occupancy.ts: destroyed civil units release occupancy immediately ──
path = "src/state/occupancy.ts"
text = read(path)
text = text.replace(
    "  for (const b of state.mapData.builders) {\n    const k = key(Math.round(b.ftx), Math.round(b.fty), width);",
    "  for (const b of state.mapData.builders) {\n    if (b.isDestroyed) continue;\n    const k = key(Math.round(b.ftx), Math.round(b.fty), width);",
)
text = text.replace(
    "  for (const h of state.harvesters) {\n    const k = key(Math.round(h.ftx), Math.round(h.fty), width);",
    "  for (const h of state.harvesters) {\n    if (h.isDestroyed) continue;\n    const k = key(Math.round(h.ftx), Math.round(h.fty), width);",
)
text = text.replace(
    "  for (const b of state.mapData.builders) {\n    if (excludeType === 'builder' && excludeId === b.id) continue;",
    "  for (const b of state.mapData.builders) {\n    if (b.isDestroyed) continue;\n    if (excludeType === 'builder' && excludeId === b.id) continue;",
)
text = text.replace(
    "  for (const h of state.harvesters) {\n    if (excludeType === 'harvester' && excludeId === h.id) continue;",
    "  for (const h of state.harvesters) {\n    if (h.isDestroyed) continue;\n    if (excludeType === 'harvester' && excludeId === h.id) continue;",
)
write(path, text)


# ── production.ts: destroyed wrecks do not consume unit cap ───────────
path = "src/state/production.ts"
text = read(path)
text = replace_once(
    text,
    "    state.mapData.builders.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length\n"
    "    + state.harvesters.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length",
    "    state.mapData.builders.filter(unit => !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length\n"
    "    + state.harvesters.filter(unit => !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length",
    "production live civil count",
)
write(path, text)


# ── focused tests ─────────────────────────────────────────────────────
test = '''import { describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import { addUnitBlockers, buildOccupancyMap, getFlags } from '../state/occupancy';
import { updateGameState } from '../state/updateGameState';
import {
  AI_MIN_HARVESTERS,
  applyCivilUnitDamage,
  CIVIL_WRECK_LIFETIME_MS,
  queueAiCivilReplacements,
  updateCivilUnitLifecycle,
} from '../state/civilUnitLifecycle';
import {
  HARVESTER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_MATTER_COST,
} from '../state/types';

describe('SKIRMISH-P6C civil lifecycle and replacement', () => {
  it('spawns produced civil units with deterministic owner-scoped IDs', () => {
    const map = createGeneratedMapData('p6c-spawn-ids', 'standard', 'cyan');
    map.buildings.push({ tx: 20, ty: 20, type: 'units-factory', ownerTeamId: 'team-cyan' });
    const state = createInitialState(map, 'cyan');
    const factory = state.production.factories[0];
    factory.queue.push(
      {
        unitType: 'builder', request: { kind: 'civil', unitType: 'builder' },
        elapsedMs: 1, durationMs: 1, progress: 1, completed: true,
      },
      {
        unitType: 'harvester', request: { kind: 'civil', unitType: 'harvester' },
        elapsedMs: 1, durationMs: 1, progress: 1, completed: true,
      },
    );

    updateGameState(state, 1);

    expect(state.mapData.builders.some(unit => unit.id === 'civil-team-cyan-builder-0')).toBe(true);
    expect(state.harvesters.some(unit => unit.id === 'civil-team-cyan-harvester-1')).toBe(true);
    expect(state.nextCivilUnitId).toBe(2);
  });

  it('destroys a Harvester, releases occupancy immediately and removes the wreck later', () => {
    const state = createInitialState(
      createGeneratedMapData('p6c-harvester-destruction', 'standard', 'cyan'),
      'cyan',
    );
    const target = state.harvesters[0];
    const tx = Math.round(target.ftx);
    const ty = Math.round(target.fty);

    const result = applyCivilUnitDamage(state, target.id, 9999);
    expect(result).toEqual({ kind: 'harvester', finalDamage: 320, killed: true });
    expect(target.isDestroyed).toBe(true);
    expect(state.entities.some(entity => entity.id === target.id)).toBe(false);

    const occupancy = buildOccupancyMap(state);
    addUnitBlockers(state, occupancy);
    expect(getFlags(occupancy, tx, ty).has('soft-occupied')).toBe(false);
    expect(getFlags(occupancy, tx, ty).has('impassable')).toBe(false);

    updateCivilUnitLifecycle(state, CIVIL_WRECK_LIFETIME_MS);
    expect(state.harvesters.some(unit => unit.id === target.id)).toBe(false);
  });

  it('releases a destroyed Builder construction assignment and repairs indices on cleanup', () => {
    const state = createInitialState(
      createGeneratedMapData('p6c-builder-destruction', 'standard', 'cyan'),
      'cyan',
    );
    const builder = state.mapData.builders[0];
    builder.busy = true;
    builder.phase = 'building';
    builder.assignedSiteId = 77;
    state.mapData.constructionSites.push({
      tx: 18, ty: 18, type: 'separator', elapsed: 0, duration: 1000,
      progress: 0, builderIndex: 0, id: 77, pending: false, ownerTeamId: builder.ownerTeamId,
    });

    const result = applyCivilUnitDamage(state, builder.id, 9999);
    expect(result.killed).toBe(true);
    expect(state.mapData.constructionSites[0]).toEqual(expect.objectContaining({
      builderIndex: -1,
      pending: true,
    }));

    updateCivilUnitLifecycle(state, CIVIL_WRECK_LIFETIME_MS);
    expect(state.mapData.builders.some(unit => unit.id === builder.id)).toBe(false);
  });

  it('queues an affordable owner-paid Harvester replacement for an AI team', () => {
    const map = createGeneratedMapData('p6c-ai-replacement', 'standard', 'cyan');
    map.buildings.push({ tx: 16, ty: 16, type: 'units-factory', ownerTeamId: 'team-green' });
    const state = createInitialState(map, 'cyan');
    const green = state.match!.teams['team-green'];
    green.economy.matter = HARVESTER_PRODUCTION_MATTER_COST;
    green.economy.elements.green = HARVESTER_PRODUCTION_ELEMENT_COST;
    const target = state.harvesters.find(unit => unit.ownerTeamId === 'team-green')!;
    applyCivilUnitDamage(state, target.id, 9999);

    queueAiCivilReplacements(state);

    const factory = state.production.factories.find(item => item.ownerTeamId === 'team-green')!;
    expect(factory.queue).toHaveLength(AI_MIN_HARVESTERS - 1);
    expect(factory.queue[0].request).toEqual({ kind: 'civil', unitType: 'harvester' });
    expect(green.economy.matter).toBe(0);
    expect(green.economy.elements.green).toBe(0);
  });

  it('does not auto-replace human civil losses', () => {
    const map = createGeneratedMapData('p6c-human-no-auto', 'standard', 'cyan');
    map.buildings.push({ tx: 16, ty: 16, type: 'units-factory', ownerTeamId: 'team-cyan' });
    const state = createInitialState(map, 'cyan');
    const target = state.harvesters.find(unit => unit.ownerTeamId === 'team-cyan')!;
    applyCivilUnitDamage(state, target.id, 9999);
    queueAiCivilReplacements(state);
    expect(state.production.factories[0].queue).toEqual([]);
  });
});
'''
write("src/__tests__/civilUnitLifecycle.test.ts", test)

print("SKIRMISH-P6C patch applied")
