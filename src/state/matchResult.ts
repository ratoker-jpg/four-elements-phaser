import type {
  GameState,
  MatchResultState,
  MatchSetupSnapshot,
  TeamId,
} from './types';
import { ensureMatchState, TEAM_IDS, teamIdForFaction } from './matchState';
import { getMapHeadquarters } from './mapHeadquarters';

const TEAM_ID_SET = new Set<TeamId>(TEAM_IDS);

export function createOngoingMatchResult(): MatchResultState {
  return {
    outcome: 'ongoing',
    winnerTeamId: null,
    defeatedTeamIds: [],
    resolvedAtMs: null,
  };
}

export function normalizeMatchResultState(state: GameState): MatchResultState {
  const raw = state.matchResult;
  const outcome = raw?.outcome === 'victory' || raw?.outcome === 'defeat'
    ? raw.outcome
    : 'ongoing';
  const defeatedTeamIds = Array.isArray(raw?.defeatedTeamIds)
    ? [...new Set(raw.defeatedTeamIds.filter((id): id is TeamId => TEAM_ID_SET.has(id)))]
    : [];
  const winnerTeamId = raw?.winnerTeamId && TEAM_ID_SET.has(raw.winnerTeamId)
    ? raw.winnerTeamId
    : null;
  const resolvedAtMs = outcome === 'ongoing'
    ? null
    : Math.max(0, Number.isFinite(raw?.resolvedAtMs) ? raw!.resolvedAtMs! : state.combatClockMs ?? 0);

  const normalized: MatchResultState = {
    outcome,
    winnerTeamId: outcome === 'victory' ? winnerTeamId : null,
    defeatedTeamIds,
    resolvedAtMs,
  };
  if (raw) {
    Object.assign(raw, normalized);
    state.matchResult = raw;
  } else {
    state.matchResult = normalized;
  }
  return state.matchResult;
}

/** Resolve Victory/Defeat exactly once. Defeat wins simultaneous-destruction ties. */
export function evaluateMatchResult(state: GameState): MatchResultState {
  const current = normalizeMatchResultState(state);
  if (current.outcome !== 'ongoing') return current;

  const match = ensureMatchState(state);
  const defeatedTeamIds = TEAM_IDS.filter(teamId => match.teams[teamId].eliminated);
  const resolvedAtMs = Math.max(0, state.combatClockMs ?? 0);

  if (match.teams[match.humanTeamId].eliminated) {
    state.matchResult = {
      outcome: 'defeat',
      winnerTeamId: null,
      defeatedTeamIds,
      resolvedAtMs,
    };
    return state.matchResult;
  }

  const enemyHeadquarters = getMapHeadquarters(state.mapData).filter(hq =>
    (hq.ownerTeamId ?? teamIdForFaction(hq.faction)) !== match.humanTeamId,
  );
  const allThreeEnemiesDefeated = enemyHeadquarters.length === 3
    && enemyHeadquarters.every(hq => {
      const ownerTeamId = hq.ownerTeamId ?? teamIdForFaction(hq.faction);
      return hq.isDestroyed === true || match.teams[ownerTeamId].eliminated;
    });

  if (allThreeEnemiesDefeated) {
    state.matchResult = {
      outcome: 'victory',
      winnerTeamId: match.humanTeamId,
      defeatedTeamIds,
      resolvedAtMs,
    };
  }
  return state.matchResult!;
}

export function isMatchFinished(state: GameState): boolean {
  return normalizeMatchResultState(state).outcome !== 'ongoing';
}

function isSetupSnapshot(value: MatchSetupSnapshot | undefined): value is MatchSetupSnapshot {
  return !!value
    && typeof value.seed === 'string'
    && typeof value.mapId === 'string'
    && (value.mapMode === 'fixed' || value.mapMode === 'generated')
    && (value.mapSize === 'small' || value.mapSize === 'standard' || value.mapSize === 'large')
    && (value.gameMode === 'standard' || value.gameMode === 'debug' || value.gameMode === 'arena')
    && (value.mapStyle === 'sand' || value.mapStyle === 'industrial')
    && (value.resourceStyle === 'legacy' || value.resourceStyle === 'industrial');
}

export function resolveRestartSetup(
  state: GameState,
  fallback: MatchSetupSnapshot,
): MatchSetupSnapshot {
  return { ...(isSetupSnapshot(state.matchSetup) ? state.matchSetup : fallback) };
}
