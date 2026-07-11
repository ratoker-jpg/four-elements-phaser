from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'{label}: marker not found')
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, new_block: str, label: str) -> str:
    start_i = text.find(start)
    end_i = text.find(end, start_i)
    if start_i < 0 or end_i < 0:
        raise RuntimeError(f'{label}: boundary not found')
    return text[:start_i] + new_block.rstrip() + '\n\n' + text[end_i:]


# ── types.ts ─────────────────────────────────────────────────────────
path = 'src/state/types.ts'
text = read(path)
text = replace_once(
    text,
    "export type Faction = 'cyan' | 'green' | 'yellow' | 'purple';\n",
    "export type Faction = 'cyan' | 'green' | 'yellow' | 'purple';\n\n"
    "export type TeamId = 'team-cyan' | 'team-green' | 'team-yellow' | 'team-purple';\n"
    "export type TeamController = 'human' | 'ai';\n"
    "export type AiDifficulty = 'recruit' | 'lieutenant' | 'veteran';\n"
    "export type TechTier = 1 | 2 | 3;\n",
    'types team ids',
)
text = replace_once(text, "  faction: Faction;\n}\n\n// ─── Buildings", "  faction: Faction;\n  ownerTeamId?: TeamId;\n}\n\n// ─── Buildings", 'hq owner')
text = replace_once(text, "  type: BuildingType;\n}\n\n// ─── Builders", "  type: BuildingType;\n  ownerTeamId?: TeamId;\n}\n\n// ─── Builders", 'building owner')
text = replace_once(text, "  id: string;\n  tx: number;\n  ty: number;\n  busy: boolean;", "  id: string;\n  ownerTeamId?: TeamId;\n  tx: number;\n  ty: number;\n  busy: boolean;", 'builder owner')
text = replace_once(text, "  pending: boolean;\n}\n\n// ─── Extra Starter", "  pending: boolean;\n  ownerTeamId?: TeamId;\n}\n\n// ─── Extra Starter", 'site owner')
text = replace_once(text, "export interface ModularCombatUnit {\n  id: string;", "export interface ModularCombatUnit {\n  id: string;\n  ownerTeamId?: TeamId;", 'combat owner')
text = replace_once(text, "export interface RenderableEntity {\n  id: string;", "export interface RenderableEntity {\n  id: string;\n  ownerTeamId?: TeamId;", 'render owner')
text = replace_once(text, "export interface HarvesterState {\n  id: string;", "export interface HarvesterState {\n  id: string;\n  ownerTeamId?: TeamId;", 'harvester owner')
text = replace_once(text, "  active: boolean;\n}\n\n// ─── Power Constants", "  active: boolean;\n  ownerTeamId?: TeamId;\n}\n\n// ─── Power Constants", 'separator owner')
text = replace_once(text, "export interface UnitFactoryRuntimeState {\n  /** Tile X", "export interface UnitFactoryRuntimeState {\n  ownerTeamId?: TeamId;\n  /** Tile X", 'factory owner')
text = replace_once(
    text,
    "/** Production state for all units-factories. */\nexport interface ProductionState {\n  /** Runtime state for each completed units-factory building. */\n  factories: UnitFactoryRuntimeState[];\n}\n\n// ─── Game State",
    "/** Production state for all units-factories. */\nexport interface ProductionState {\n  /** Runtime state for each completed units-factory building. */\n  factories: UnitFactoryRuntimeState[];\n}\n\n"
    "export interface TeamState {\n"
    "  id: TeamId;\n"
    "  faction: Faction;\n"
    "  controller: TeamController;\n"
    "  difficulty: AiDifficulty | null;\n"
    "  economy: EconomyState;\n"
    "  vision: VisionState;\n"
    "  unitCap: number;\n"
    "  techTier: TechTier;\n"
    "  hqPosition: { tx: number; ty: number } | null;\n"
    "  eliminated: boolean;\n"
    "}\n\n"
    "export interface MatchState {\n"
    "  humanTeamId: TeamId;\n"
    "  activeTeamIds: TeamId[];\n"
    "  teams: Record<TeamId, TeamState>;\n"
    "}\n\n"
    "// ─── Game State",
    'team state types',
)
text = replace_once(text, "  playerFaction: Faction;\n  /** Extra starter", "  playerFaction: Faction;\n  /** Canonical four-team state. Optional only for old saves and legacy fixtures. */\n  match?: MatchState;\n  /** Extra starter", 'game match')
text = replace_once(
    text,
    "  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction }>;",
    "  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction; ownerTeamId?: TeamId }> ;",
    'extra harvester owner',
)
write(path, text)


# ── createInitialState.ts ─────────────────────────────────────────────
path = 'src/state/createInitialState.ts'
text = read(path)
text = replace_once(
    text,
    "import { createInitialVisionState, recomputeVisibility } from './visibility';",
    "import { createInitialVisionState, recomputeVisibility } from './visibility';\n"
    "import { createInitialMatchState, normalizeMatchState } from './matchState';",
    'initial imports',
)
text = replace_once(
    text,
    "  const state: GameState = {",
    "  const economy = arenaMode ? createArenaEconomy() : createInitialEconomy(faction, mapData);\n"
    "  const vision = createInitialVisionState(mapData.width, mapData.height);\n\n"
    "  const state: GameState = {",
    'initial locals',
)
text = replace_once(text, "    economy: arenaMode ? createArenaEconomy() : createInitialEconomy(faction, mapData),", "    economy,", 'initial economy')
text = replace_once(text, "    // FOG-VISION-08: Initialize vision state and compute initial visibility\n    vision: createInitialVisionState(mapData.width, mapData.height),", "    // FOG-VISION-08: Human compatibility alias points at the human TeamState vision.\n    vision,\n    match: createInitialMatchState({\n      humanFaction: faction,\n      humanEconomy: economy,\n      humanVision: vision,\n      humanHqPosition: hqPosition,\n      mapWidth: mapData.width,\n      mapHeight: mapData.height,\n    }),", 'initial match')
text = replace_once(text, "  // FOG-VISION-08: Compute initial visibility from HQ and starting units", "  normalizeMatchState(state);\n\n  // FOG-VISION-08: Compute initial visibility from HQ and starting units", 'initial normalize')
write(path, text)


# ── production.ts ─────────────────────────────────────────────────────
path = 'src/state/production.ts'
text = read(path)
text = replace_once(text, "import { getT1CombatProductionQuote } from '../config/t1ProductionComponents';", "import { getT1CombatProductionQuote } from '../config/t1ProductionComponents';\nimport { normalizeMatchState } from './matchState';", 'production import')
text = replace_once(
    text,
    "  // 1. Find the factory\n  const factory = state.production.factories.find(",
    "  const match = normalizeMatchState(state);\n\n  // 1. Find the factory\n  const factory = state.production.factories.find(",
    'production normalize',
)
text = replace_once(text, "  if (!factory) return { ok: false, reason: 'factory-not-found' };\n\n  // 2. Check queue limit", "  if (!factory) return { ok: false, reason: 'factory-not-found' };\n  const ownerTeamId = factory.ownerTeamId ?? match.humanTeamId;\n  const owner = match.teams[ownerTeamId];\n\n  // 2. Check queue limit", 'production owner')
text = text.replace('state.economy.matter', 'owner.economy.matter')
text = text.replace('state.economy.elements[state.playerFaction]', 'owner.economy.elements[owner.faction]')
text = replace_once(
    text,
    "  const currentUnitCount = state.mapData.builders.length + state.harvesters.length + (state.combatUnits?.length ?? 0);\n  if (currentUnitCount >= DEFAULT_UNIT_CAP)",
    "  const currentUnitCount =\n    state.mapData.builders.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length\n    + state.harvesters.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length\n    + (state.combatUnits?.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length ?? 0);\n  if (currentUnitCount >= owner.unitCap)",
    'production cap',
)
write(path, text)


# ── construction.ts ──────────────────────────────────────────────────
path = 'src/state/construction.ts'
text = read(path)
text = replace_once(text, "import type { GameState, BuildingType } from './types';", "import type { GameState, BuildingType, TeamId } from './types';", 'construction type import')
text = replace_once(text, "import { isVisualReadyBuilding } from '../config/buildingRuntimeMapping';", "import { isVisualReadyBuilding } from '../config/buildingRuntimeMapping';\nimport { getOwningTeam, normalizeMatchState } from './matchState';", 'construction helper import')
text = replace_once(text, "  ty: number,\n): PlacementResult {", "  ty: number,\n  ownerTeamId?: TeamId,\n): PlacementResult {", 'canPlace signature')
text = replace_once(text, "  // 1. Unknown building type", "  normalizeMatchState(state);\n  const owner = getOwningTeam(state, ownerTeamId);\n\n  // 1. Unknown building type", 'canPlace owner')
text = replace_once(text, "  if (state.economy.matter < config.costMatter)", "  if (owner.economy.matter < config.costMatter)", 'canPlace economy')
text = replace_once(text, "  ty: number,\n): { ok: true; siteId: string }", "  ty: number,\n  ownerTeamId?: TeamId,\n): { ok: true; siteId: string }", 'place signature')
text = replace_once(text, "  const validation = canPlaceBuilding(state, buildingType, tx, ty);", "  const match = normalizeMatchState(state);\n  const resolvedOwnerTeamId = ownerTeamId ?? match.humanTeamId;\n  const owner = match.teams[resolvedOwnerTeamId];\n  const validation = canPlaceBuilding(state, buildingType, tx, ty, resolvedOwnerTeamId);", 'place owner')
text = replace_once(text, "  state.economy.matter -= config.costMatter;", "  owner.economy.matter -= config.costMatter;", 'place deduct')
text = replace_once(text, "    pending: true,\n  });", "    pending: true,\n    ownerTeamId: resolvedOwnerTeamId,\n  });", 'site owner push')
text = replace_once(text, "  const site = state.mapData.constructionSites[siteIndex];", "  const site = state.mapData.constructionSites[siteIndex];\n  const owner = getOwningTeam(state, site.ownerTeamId);", 'completion owner')
text = replace_once(text, "    type: site.type,\n  });", "    type: site.type,\n    ownerTeamId: owner.id,\n  });", 'building owner push')
text = replace_once(text, "    state.economy.separators.push({", "    owner.economy.separators.push({", 'separator economy')
text = replace_once(text, "      active: false,\n    });", "      active: false,\n      ownerTeamId: owner.id,\n    });", 'separator owner push')
text = text.replace('state.economy.rawCap', 'owner.economy.rawCap')
text = text.replace('state.economy.matterCap', 'owner.economy.matterCap')
text = text.replace('state.economy.elementCap', 'owner.economy.elementCap')
text = replace_once(text, "      active: false,\n    });\n  }\n\n  // Release", "      active: false,\n      ownerTeamId: owner.id,\n    });\n  }\n\n  // Release", 'factory owner push')
write(path, text)


# ── updateGameState.ts ───────────────────────────────────────────────
path = 'src/state/updateGameState.ts'
text = read(path)
text = replace_once(text, "  ProductionQueueItem,\n} from './types';", "  ProductionQueueItem,\n  TeamId,\n} from './types';", 'update team import')
text = replace_once(text, "import { updateAllCombatUnitCombat } from './combatUnitCombat';", "import { updateAllCombatUnitCombat } from './combatUnitCombat';\nimport { getOwningTeam, normalizeMatchState } from './matchState';", 'update helper import')
text = replace_once(text, "export function updateGameState(state: GameState, deltaMs: number): void {\n  // Clamp", "export function updateGameState(state: GameState, deltaMs: number): void {\n  normalizeMatchState(state);\n  // Clamp", 'update normalize')
text = replace_once(text, "    const hqTx = state.hqPosition.tx;\n    const hqTy = state.hqPosition.ty;", "    const owner = getOwningTeam(state, h.ownerTeamId, h.faction);\n    const ownerHq = owner.hqPosition ?? state.hqPosition;\n    const hqTx = ownerHq.tx;\n    const hqTy = ownerHq.ty;", 'return owner hq')
text = replace_once(text, "  // ARCH-01D: Enforce raw cap on harvester unload.", "  const owner = getOwningTeam(state, h.ownerTeamId, h.faction);\n  const economy = owner.economy;\n\n  // ARCH-01D: Enforce raw cap on harvester unload.", 'unload owner')
text = text.replace('const room = state.economy.rawCap - state.economy.raw;', 'const room = economy.rawCap - economy.raw;')
text = text.replace('state.economy.raw += transfer;', 'economy.raw += transfer;')

new_allocate = r'''function allocatePowerAndProcess(state: GameState, dt: number): void {
  const match = normalizeMatchState(state);
  const remainingPower = new Map<TeamId, number>();
  for (const teamId of match.activeTeamIds) {
    const team = match.teams[teamId];
    const powerPlants = state.mapData.buildings.filter(
      building => (building.ownerTeamId ?? match.humanTeamId) === teamId && building.type === 'power-plant',
    ).length;
    remainingPower.set(teamId, (team.hqPosition ? HQ_BASE_POWER : 0) + powerPlants * POWER_PLANT_GENERATION);
  }

  const separatorMap = new Map<string, typeof state.economy.separators[0]>();
  for (const teamId of match.activeTeamIds) {
    for (const separator of match.teams[teamId].economy.separators) {
      const ownerTeamId = separator.ownerTeamId ?? teamId;
      separatorMap.set(`${ownerTeamId}:${separator.tx},${separator.ty}`, separator);
    }
  }

  const factoryMap = new Map<string, typeof state.production.factories[0]>();
  for (const factory of state.production.factories) {
    const ownerTeamId = factory.ownerTeamId ?? match.humanTeamId;
    factoryMap.set(`${ownerTeamId}:${factory.tx},${factory.ty}`, factory);
  }

  for (const building of state.mapData.buildings) {
    const ownerTeamId = building.ownerTeamId ?? match.humanTeamId;
    const owner = match.teams[ownerTeamId];
    let availablePower = remainingPower.get(ownerTeamId) ?? 0;

    if (building.type === 'separator') {
      const separator = separatorMap.get(`${ownerTeamId}:${building.tx},${building.ty}`);
      if (!separator) continue;
      const economy = owner.economy;
      const hasResources =
        economy.raw >= SEP_RAW_COST
        && economy.matter + SEP_MATTER_YIELD <= economy.matterCap
        && economy.elements[owner.faction] + SEP_ELEMENT_YIELD <= economy.elementCap;
      if (!hasResources || availablePower < SEPARATOR_ACTIVE_POWER_CONSUMPTION) {
        separator.active = false;
        continue;
      }

      availablePower -= SEPARATOR_ACTIVE_POWER_CONSUMPTION;
      remainingPower.set(ownerTeamId, availablePower);
      separator.active = true;
      separator.progress += dt / SEP_CYCLE_MS;
      while (separator.progress >= 1) {
        if (
          economy.raw < SEP_RAW_COST
          || economy.matter + SEP_MATTER_YIELD > economy.matterCap
          || economy.elements[owner.faction] + SEP_ELEMENT_YIELD > economy.elementCap
        ) {
          separator.active = false;
          remainingPower.set(ownerTeamId, availablePower + SEPARATOR_ACTIVE_POWER_CONSUMPTION);
          separator.progress = Math.min(separator.progress, 1);
          break;
        }
        economy.raw -= SEP_RAW_COST;
        economy.matter += SEP_MATTER_YIELD;
        economy.elements[owner.faction] += SEP_ELEMENT_YIELD;
        separator.progress -= 1;
      }
    } else if (building.type === 'units-factory') {
      const factory = factoryMap.get(`${ownerTeamId}:${building.tx},${building.ty}`);
      if (!factory) continue;
      const unfinishedItem = factory.queue.find(item => !item.completed);
      if (!unfinishedItem) {
        factory.active = false;
        processFactorySpawns(state, factory);
        continue;
      }
      if (availablePower < UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION) {
        factory.active = false;
        processFactorySpawns(state, factory);
        continue;
      }
      availablePower -= UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
      remainingPower.set(ownerTeamId, availablePower);
      factory.active = true;
      unfinishedItem.elapsedMs += dt;
      unfinishedItem.progress = Math.min(unfinishedItem.elapsedMs / unfinishedItem.durationMs, 1);
      if (unfinishedItem.progress >= 1) {
        unfinishedItem.completed = true;
        unfinishedItem.progress = 1;
      }
      processFactorySpawns(state, factory);
    }
  }
}'''
text = replace_between(text, 'function allocatePowerAndProcess', '// ─── Factory spawn logic', new_allocate, 'allocate function')
text = replace_once(
    text,
    "    const liveUnitCount = state.mapData.builders.length + state.harvesters.length + state.combatUnits.length;\n    if (liveUnitCount >= DEFAULT_UNIT_CAP)",
    "    const match = normalizeMatchState(state);\n    const ownerTeamId = factory.ownerTeamId ?? match.humanTeamId;\n    const owner = match.teams[ownerTeamId];\n    const liveUnitCount =\n      state.mapData.builders.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length\n      + state.harvesters.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length\n      + state.combatUnits.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length;\n    if (liveUnitCount >= owner.unitCap)",
    'spawn cap',
)
text = text.replace('spawnBuilder(state, spawnPos.tx, spawnPos.ty);', 'spawnBuilder(state, spawnPos.tx, spawnPos.ty, ownerTeamId);')
text = text.replace('spawnHarvesterUnit(state, spawnPos.tx, spawnPos.ty);', 'spawnHarvesterUnit(state, spawnPos.tx, spawnPos.ty, ownerTeamId);')
text = text.replace('spawnCombatUnit(state, spawnPos.tx, spawnPos.ty, item);', 'spawnCombatUnit(state, spawnPos.tx, spawnPos.ty, item, ownerTeamId);')
text = replace_once(text, "function spawnBuilder(state: GameState, tx: number, ty: number): void {", "function spawnBuilder(state: GameState, tx: number, ty: number, ownerTeamId: TeamId): void {\n  const owner = getOwningTeam(state, ownerTeamId);", 'spawn builder signature')
text = replace_once(text, "    id,\n    tx,", "    id,\n    ownerTeamId: owner.id,\n    tx,", 'builder object owner')
text = replace_once(text, "    faction: state.playerFaction,\n  });", "    faction: owner.faction,\n    ownerTeamId: owner.id,\n  });", 'builder entity owner')
text = replace_once(text, "function spawnHarvesterUnit(state: GameState, tx: number, ty: number): void {\n  const id", "function spawnHarvesterUnit(state: GameState, tx: number, ty: number, ownerTeamId: TeamId): void {\n  const owner = getOwningTeam(state, ownerTeamId);\n  const id", 'spawn harvester signature')
text = replace_once(text, "  const harvester = createHarvester(id, tx, ty, state.playerFaction);", "  const harvester = createHarvester(id, tx, ty, owner.faction, owner.id);", 'spawn harvester create')
text = replace_once(text, "    faction: state.playerFaction,\n  });", "    faction: owner.faction,\n    ownerTeamId: owner.id,\n  });", 'harvester entity owner')
text = replace_once(text, "  item: ProductionQueueItem,\n): void {", "  item: ProductionQueueItem,\n  ownerTeamId: TeamId,\n): void {\n  const owner = getOwningTeam(state, ownerTeamId);", 'spawn combat signature')
text = replace_once(text, "    id: allocateCombatUnitId(state),\n    tx,", "    id: allocateCombatUnitId(state),\n    ownerTeamId: owner.id,\n    tx,", 'combat object owner')
text = replace_once(text, "    faction: state.playerFaction,", "    faction: owner.faction,", 'combat faction')

new_power = r'''function recomputePower(state: GameState): void {
  const match = normalizeMatchState(state);
  for (const teamId of match.activeTeamIds) {
    const team = match.teams[teamId];
    const powerPlantCount = state.mapData.buildings.filter(
      building => (building.ownerTeamId ?? match.humanTeamId) === teamId && building.type === 'power-plant',
    ).length;
    team.economy.powerGenerated = (team.hqPosition ? HQ_BASE_POWER : 0)
      + powerPlantCount * POWER_PLANT_GENERATION;
    const activeSeparatorCount = team.economy.separators.filter(separator => separator.active).length;
    const activeFactoryCount = state.production.factories.filter(
      factory => (factory.ownerTeamId ?? match.humanTeamId) === teamId && factory.active,
    ).length;
    team.economy.powerConsumed =
      activeSeparatorCount * SEPARATOR_ACTIVE_POWER_CONSUMPTION
      + activeFactoryCount * UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
  }
}'''
text = replace_between(text, 'function recomputePower', '// ─── Factory helpers', new_power, 'recompute power')
text = replace_once(text, "  faction: Faction = 'cyan',\n): HarvesterState {", "  faction: Faction = 'cyan',\n  ownerTeamId?: TeamId,\n): HarvesterState {", 'createHarvester signature')
text = replace_once(text, "    id,\n    ftx: tx,", "    id,\n    ownerTeamId,\n    ftx: tx,", 'createHarvester owner')
write(path, text)


# ── saveGame.ts ──────────────────────────────────────────────────────
path = 'src/state/saveGame.ts'
text = read(path)
text = replace_once(text, "import { normalizeCombatUnitState } from './combatUnits';", "import { normalizeCombatUnitState } from './combatUnits';\nimport { normalizeMatchState } from './matchState';", 'save import')
text = replace_once(text, 'const SAVE_VERSION = 4;', 'const SAVE_VERSION = 5;', 'save version')
text = replace_once(text, "  // Accept v1-v4; loadGame performs field migrations.\n  if (s.version !== 1 && s.version !== 2 && s.version !== 3 && s.version !== 4) return false;", "  // Accept v1-v5; loadGame performs field migrations.\n  if (s.version !== 1 && s.version !== 2 && s.version !== 3 && s.version !== 4 && s.version !== 5) return false;", 'valid versions')
new_sanitize = r'''function sanitizeForSave(gameState: GameState): GameState {
  const clone = (typeof structuredClone === 'function'
    ? structuredClone(gameState)
    : JSON.parse(JSON.stringify(gameState))) as GameState;
  const match = normalizeMatchState(clone);

  clone.blockoutVehicles = undefined;
  clone.blockoutObstacles = undefined;
  for (const teamId of match.activeTeamIds) {
    const team = match.teams[teamId];
    team.vision = {
      explored: team.vision.explored.map(row => [...row]),
      visible: [],
      dirty: true,
      revision: team.vision.revision,
    };
    team.economy = {
      ...team.economy,
      elements: { ...team.economy.elements },
      separators: team.economy.separators.map(separator => ({ ...separator })),
    };
  }

  const human = match.teams[match.humanTeamId];
  clone.economy = human.economy;
  clone.vision = human.vision;
  return clone;
}'''
text = replace_between(text, 'function sanitizeForSave', '/**\n * Save the current game state', new_sanitize, 'sanitize save')
text = replace_once(text, "  if (slot.version !== SAVE_VERSION && slot.version !== 1 && slot.version !== 2 && slot.version !== 3)", "  if (slot.version !== SAVE_VERSION && slot.version !== 1 && slot.version !== 2 && slot.version !== 3 && slot.version !== 4)", 'load versions')
text = replace_once(text, "  gs.vision = normalizeVisionForLoadedState(\n    gs.mapWidth ?? gs.mapData?.width ?? 48,\n    gs.mapHeight ?? gs.mapData?.height ?? 48,\n    gs.vision,\n  );\n\n  return", "  gs.vision = normalizeVisionForLoadedState(\n    gs.mapWidth ?? gs.mapData?.width ?? 48,\n    gs.mapHeight ?? gs.mapData?.height ?? 48,\n    gs.vision,\n  );\n  normalizeMatchState(gs);\n\n  return", 'load match normalize')
write(path, text)


# ── focused tests ────────────────────────────────────────────────────
test = r'''import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { customMap1 } from '../data/maps/customMap1';
import { createInitialState } from '../state/createInitialState';
import { TEAM_IDS, normalizeMatchState } from '../state/matchState';
import { startUnitProduction } from '../state/production';
import {
  loadGame,
  resetSaveStorage,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';
import type { GameState } from '../state/types';

function freshState(): GameState {
  const map = JSON.parse(JSON.stringify(customMap1));
  return createInitialState(map, 'cyan');
}

class MemoryStorage implements SaveStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): boolean { this.values.set(key, value); return true; }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('SKIRMISH-P4A multi-team match state', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
  });

  afterEach(() => resetSaveStorage());

  it('creates four independent teams and binds root aliases to the human team', () => {
    const state = freshState();
    const match = state.match!;
    expect(match.activeTeamIds).toEqual(TEAM_IDS);
    expect(match.humanTeamId).toBe('team-cyan');
    expect(match.teams['team-cyan'].controller).toBe('human');
    expect(match.teams['team-green'].controller).toBe('ai');
    expect(new Set(TEAM_IDS.map(id => match.teams[id].economy)).size).toBe(4);
    expect(new Set(TEAM_IDS.map(id => match.teams[id].vision)).size).toBe(4);
    expect(state.economy).toBe(match.teams['team-cyan'].economy);
    expect(state.vision).toBe(match.teams['team-cyan'].vision);
  });

  it('assigns the human owner to legacy initial entities', () => {
    const state = freshState();
    expect(state.mapData.hq.ownerTeamId).toBe('team-cyan');
    expect(state.mapData.builders.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.mapData.buildings.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.harvesters.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.production.factories.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
    expect(state.entities.filter(entity => entity.kind !== 'resource').every(entity => entity.ownerTeamId === 'team-cyan')).toBe(true);
  });

  it('deducts production costs only from the factory owner team', () => {
    const state = freshState();
    const match = normalizeMatchState(state);
    const humanMatter = match.teams['team-cyan'].economy.matter;
    const green = match.teams['team-green'];
    green.economy.matter = 500;
    green.economy.elements.green = 500;
    state.production.factories.push({
      tx: 30,
      ty: 30,
      ownerTeamId: 'team-green',
      queue: [],
      active: false,
    });

    expect(startUnitProduction(state, 30, 30, 'builder')).toEqual({ ok: true });
    expect(green.economy.matter).toBe(460);
    expect(green.economy.elements.green).toBe(490);
    expect(match.teams['team-cyan'].economy.matter).toBe(humanMatter);
  });

  it('round-trips the match state and restores human compatibility aliases', () => {
    const state = freshState();
    state.match!.teams['team-green'].economy.matter = 333;
    const saved = saveGame(state, state.mapId);
    expect(saved.success).toBe(true);
    const loaded = loadGame(saved.slotId!);
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.match!.teams['team-green'].economy.matter).toBe(333);
    expect(loaded.gameState!.economy).toBe(loaded.gameState!.match!.teams['team-cyan'].economy);
    expect(loaded.gameState!.vision).toBe(loaded.gameState!.match!.teams['team-cyan'].vision);
  });

  it('migrates a version 4 single-team save into four owned teams', () => {
    const state = freshState();
    const legacy = JSON.parse(JSON.stringify(state)) as GameState;
    delete legacy.match;
    delete legacy.mapData.hq.ownerTeamId;
    for (const builder of legacy.mapData.builders) delete builder.ownerTeamId;
    for (const building of legacy.mapData.buildings) delete building.ownerTeamId;
    for (const harvester of legacy.harvesters) delete harvester.ownerTeamId;
    for (const factory of legacy.production.factories) delete factory.ownerTeamId;
    storage.setItem('four-elements-save-slots', JSON.stringify([{
      id: 'legacy-v4', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      faction: 'cyan', mapId: legacy.mapId, mapName: legacy.mapName, summary: {}, version: 4, gameState: legacy,
    }]));

    const loaded = loadGame('legacy-v4');
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.match!.activeTeamIds).toEqual(TEAM_IDS);
    expect(loaded.gameState!.mapData.hq.ownerTeamId).toBe('team-cyan');
    expect(loaded.gameState!.harvesters.every(unit => unit.ownerTeamId === 'team-cyan')).toBe(true);
  });
});
'''
write('src/__tests__/matchState.test.ts', test)

print('SKIRMISH-P4A patch applied')
