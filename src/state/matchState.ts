import type {
  AiDifficulty,
  EconomyState,
  Faction,
  GameState,
  MatchState,
  TeamId,
  TeamState,
} from './types';
import {
  DEFAULT_UNIT_CAP,
  HQ_BASE_POWER,
  HQ_ELEMENT_CAP,
  HQ_MATTER_CAP,
  HQ_RAW_CAP,
  START_MATTER,
  START_RAW,
} from './types';
import {
  createInitialVisionState,
  normalizeVisionForLoadedState,
  type VisionState,
} from './visibility';
import { getHeadquartersCenter, normalizeMapHeadquarters } from './mapHeadquarters';

export const TEAM_IDS: readonly TeamId[] = [
  'team-cyan',
  'team-green',
  'team-yellow',
  'team-purple',
] as const;

const TEAM_FACTIONS: Record<TeamId, Faction> = {
  'team-cyan': 'cyan',
  'team-green': 'green',
  'team-yellow': 'yellow',
  'team-purple': 'purple',
};

const FACTION_TEAMS: Record<Faction, TeamId> = {
  cyan: 'team-cyan',
  green: 'team-green',
  yellow: 'team-yellow',
  purple: 'team-purple',
};

export function teamIdForFaction(faction: Faction): TeamId {
  return FACTION_TEAMS[faction];
}

export function factionForTeamId(teamId: TeamId): Faction {
  return TEAM_FACTIONS[teamId];
}

function isFaction(value: unknown): value is Faction {
  return value === 'cyan' || value === 'green' || value === 'yellow' || value === 'purple';
}

function resolveHumanFaction(state: GameState): Faction {
  if (isFaction(state.playerFaction)) return state.playerFaction;
  const hqFaction = state.mapData?.hq?.faction;
  return isFaction(hqFaction) ? hqFaction : 'cyan';
}

function createBaselineTeamEconomy(): EconomyState {
  return {
    raw: START_RAW,
    matter: START_MATTER,
    elements: { cyan: 0, green: 0, yellow: 0, purple: 0 },
    powerGenerated: HQ_BASE_POWER,
    powerConsumed: 0,
    separators: [],
    rawCap: HQ_RAW_CAP,
    matterCap: HQ_MATTER_CAP,
    elementCap: HQ_ELEMENT_CAP,
  };
}

function ensureEconomyShape(economy: EconomyState | undefined): EconomyState {
  const target = economy ?? createBaselineTeamEconomy();
  target.raw ??= 0;
  target.matter ??= 0;
  target.elements ??= { cyan: 0, green: 0, yellow: 0, purple: 0 };
  target.powerGenerated ??= 0;
  target.powerConsumed ??= 0;
  target.separators ??= [];
  target.rawCap ??= HQ_RAW_CAP;
  target.matterCap ??= HQ_MATTER_CAP;
  target.elementCap ??= HQ_ELEMENT_CAP;
  return target;
}

function hasValidVisionDimensions(width: number, height: number, vision: VisionState | undefined): vision is VisionState {
  return !!vision
    && Array.isArray(vision.explored)
    && vision.explored.length === height
    && vision.explored.every(row => Array.isArray(row) && row.length === width)
    && Array.isArray(vision.visible)
    && vision.visible.length === height
    && vision.visible.every(row => Array.isArray(row) && row.length === width)
    && typeof vision.dirty === 'boolean'
    && typeof vision.revision === 'number';
}

function normalizeTeamVision(
  width: number,
  height: number,
  vision: VisionState | undefined,
): VisionState {
  return hasValidVisionDimensions(width, height, vision)
    ? vision
    : normalizeVisionForLoadedState(width, height, vision);
}

export interface CreateInitialMatchStateInput {
  humanFaction: Faction;
  humanEconomy: EconomyState;
  humanVision: VisionState;
  humanHqPosition: { tx: number; ty: number };
  mapWidth: number;
  mapHeight: number;
  aiDifficulty?: AiDifficulty;
}

/** Create four independent team records while preserving human compatibility aliases. */
export function createInitialMatchState(input: CreateInitialMatchStateInput): MatchState {
  const humanTeamId = teamIdForFaction(input.humanFaction);
  const aiDifficulty = input.aiDifficulty ?? 'lieutenant';
  const teams = {} as Record<TeamId, TeamState>;

  for (const teamId of TEAM_IDS) {
    const isHuman = teamId === humanTeamId;
    teams[teamId] = {
      id: teamId,
      faction: factionForTeamId(teamId),
      controller: isHuman ? 'human' : 'ai',
      difficulty: isHuman ? null : aiDifficulty,
      economy: isHuman ? input.humanEconomy : createBaselineTeamEconomy(),
      vision: isHuman
        ? input.humanVision
        : createInitialVisionState(input.mapWidth, input.mapHeight),
      unitCap: DEFAULT_UNIT_CAP,
      techTier: 1,
      hqPosition: isHuman ? { ...input.humanHqPosition } : null,
      eliminated: false,
    };
  }

  return {
    humanTeamId,
    activeTeamIds: [...TEAM_IDS],
    teams,
  };
}

function isTeamId(value: unknown): value is TeamId {
  return typeof value === 'string' && (TEAM_IDS as readonly string[]).includes(value);
}

/**
 * Upgrade old single-team states and rebind root economy/vision to the human TeamState.
 * Idempotent and safe to call at runtime boundaries.
 */
export function normalizeMatchState(state: GameState): MatchState {
  const mapWidth = state.mapWidth ?? state.mapData?.width ?? 48;
  const mapHeight = state.mapHeight ?? state.mapData?.height ?? 48;
  const humanFaction = resolveHumanFaction(state);
  state.playerFaction = humanFaction;
  const headquarters = normalizeMapHeadquarters(state.mapData, humanFaction);
  const humanTeamId = teamIdForFaction(humanFaction);
  const hqPositionByTeam = new Map<TeamId, { tx: number; ty: number }>();
  for (const hq of headquarters) {
    hqPositionByTeam.set(hq.ownerTeamId ?? teamIdForFaction(hq.faction), getHeadquartersCenter(hq));
  }
  const legacyHumanHqPosition = hqPositionByTeam.get(humanTeamId)
    ?? state.hqPosition
    ?? null;
  const existing = state.match;
  const existingTeams = existing?.teams as Partial<Record<TeamId, TeamState>> | undefined;
  const teams = {} as Record<TeamId, TeamState>;

  for (const teamId of TEAM_IDS) {
    const current = existingTeams?.[teamId];
    const isHuman = teamId === humanTeamId;
    const economy = ensureEconomyShape(
      current?.economy ?? (isHuman ? state.economy : createBaselineTeamEconomy()),
    );
    const sourceVision = current?.vision ?? (isHuman ? state.vision : undefined);
    teams[teamId] = {
      id: teamId,
      faction: factionForTeamId(teamId),
      controller: isHuman ? 'human' : (current?.controller ?? 'ai'),
      difficulty: isHuman ? null : (current?.difficulty ?? 'lieutenant'),
      economy,
      vision: normalizeTeamVision(mapWidth, mapHeight, sourceVision),
      unitCap: current?.unitCap ?? DEFAULT_UNIT_CAP,
      techTier: current?.techTier ?? 1,
      hqPosition: current?.hqPosition
        ?? hqPositionByTeam.get(teamId)
        ?? (isHuman ? legacyHumanHqPosition : null),
      eliminated: current?.eliminated ?? false,
    };
  }

  const activeTeamIds = [...new Set(existing?.activeTeamIds?.filter(isTeamId) ?? TEAM_IDS)];
  const match: MatchState = {
    humanTeamId,
    activeTeamIds: activeTeamIds.length > 0 ? activeTeamIds : [...TEAM_IDS],
    teams,
  };
  state.match = match;

  const human = teams[humanTeamId];
  state.economy = human.economy;
  state.vision = human.vision;
  if (human.hqPosition) state.hqPosition = { ...human.hqPosition };

  normalizeOwnership(state, match);
  return match;
}

/** Cheap runtime boundary: preserve object identity once the match is normalized. */
export function ensureMatchState(state: GameState): MatchState {
  const expectedHumanTeamId = teamIdForFaction(resolveHumanFaction(state));
  const match = state.match;
  if (!match || match.humanTeamId !== expectedHumanTeamId) return normalizeMatchState(state);
  if (TEAM_IDS.some(teamId => !match.teams?.[teamId])) return normalizeMatchState(state);
  const human = match.teams[match.humanTeamId];
  if (state.economy !== human.economy || state.vision !== human.vision) {
    return normalizeMatchState(state);
  }
  return match;
}

/** Return the requested owner team, falling back to the human team for legacy data. */
export function getOwningTeam(
  state: GameState,
  ownerTeamId?: TeamId,
  faction?: Faction,
): TeamState {
  const match = ensureMatchState(state);
  const resolvedId = ownerTeamId
    ?? (faction ? teamIdForFaction(faction) : match.humanTeamId);
  return match.teams[resolvedId] ?? match.teams[match.humanTeamId];
}

export function getHumanTeam(state: GameState): TeamState {
  const match = ensureMatchState(state);
  return match.teams[match.humanTeamId];
}

function normalizeOwnership(state: GameState, match: MatchState): void {
  const humanTeamId = match.humanTeamId;
  for (const hq of state.mapData?.headquarters ?? (state.mapData?.hq ? [state.mapData.hq] : [])) {
    hq.ownerTeamId ??= teamIdForFaction(
      isFaction(hq.faction) ? hq.faction : state.playerFaction,
    );
  }

  for (const building of state.mapData?.buildings ?? []) building.ownerTeamId ??= humanTeamId;
  for (const builder of state.mapData?.builders ?? []) builder.ownerTeamId ??= humanTeamId;
  for (const site of state.mapData?.constructionSites ?? []) site.ownerTeamId ??= humanTeamId;
  for (const harvester of state.harvesters ?? []) {
    harvester.ownerTeamId ??= teamIdForFaction(harvester.faction);
  }
  for (const unit of state.combatUnits ?? []) {
    unit.ownerTeamId ??= teamIdForFaction(unit.faction);
  }
  for (const unit of state.extraModularCombat ?? []) {
    unit.ownerTeamId ??= teamIdForFaction(unit.faction);
  }
  for (const harvester of state.extraHarvesters ?? []) {
    harvester.ownerTeamId ??= teamIdForFaction(harvester.faction);
  }
  for (const factory of state.production?.factories ?? []) factory.ownerTeamId ??= humanTeamId;
  for (const teamId of TEAM_IDS) {
    for (const separator of match.teams[teamId].economy.separators) {
      separator.ownerTeamId ??= teamId;
    }
  }

  for (const entity of state.entities ?? []) {
    if (entity.kind === 'resource') continue;
    entity.ownerTeamId ??= entity.faction
      ? teamIdForFaction(entity.faction)
      : humanTeamId;
  }
}
