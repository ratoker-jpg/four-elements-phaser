import type { GameState, HqPlacement, TeamId } from './types';
import {
  HEADQUARTERS_DAMAGE_FLASH_MS,
  getMapHeadquarters,
  normalizeMapHeadquarters,
} from './mapHeadquarters';
import { ensureMatchState, teamIdForFaction } from './matchState';

export type HeadquartersDamageFailureReason =
  | 'attacker-eliminated'
  | 'target-not-found'
  | 'target-destroyed'
  | 'friendly-target';

export type HeadquartersDamageResult =
  | {
      ok: true;
      rawDamage: number;
      finalDamage: number;
      killed: boolean;
      eliminatedTeamId: TeamId | null;
    }
  | { ok: false; reason: HeadquartersDamageFailureReason };

/** Normalize every canonical Headquarters and refresh the human compatibility alias. */
export function normalizeHeadquartersCombatState(state: GameState): HqPlacement[] {
  const headquarters = normalizeMapHeadquarters(state.mapData, state.playerFaction);
  const humanTeamId = ensureMatchState(state).humanTeamId;
  const human = headquarters.find(hq => hq.ownerTeamId === humanTeamId);
  if (human) state.mapData.hq = { ...human };
  return headquarters;
}

export function getHeadquartersById(
  state: GameState,
  targetId: string,
): HqPlacement | null {
  return normalizeHeadquartersCombatState(state)
    .find(hq => hq.id === targetId) ?? null;
}

/**
 * Apply owner-aware damage to one Headquarters.
 * Team elimination is idempotent and never mutates other teams.
 */
export function applyHeadquartersDamage(
  state: GameState,
  attackerTeamId: TeamId,
  targetId: string,
  rawDamage: number,
): HeadquartersDamageResult {
  const match = ensureMatchState(state);
  const attacker = match.teams[attackerTeamId];
  if (!attacker || attacker.eliminated) {
    return { ok: false, reason: 'attacker-eliminated' };
  }

  const target = getHeadquartersById(state, targetId);
  if (!target) return { ok: false, reason: 'target-not-found' };
  const targetTeamId = target.ownerTeamId ?? teamIdForFaction(target.faction);
  if (targetTeamId === attackerTeamId) return { ok: false, reason: 'friendly-target' };
  if (target.isDestroyed || (target.hp ?? 0) <= 0) {
    return { ok: false, reason: 'target-destroyed' };
  }

  const normalizedRawDamage = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
  const armor = Math.max(0, Math.min(0.95, target.armor ?? 0));
  const reducedDamage = normalizedRawDamage <= 0
    ? 0
    : Math.max(1, Math.round(normalizedRawDamage * (1 - armor)));
  const finalDamage = Math.min(target.hp ?? 0, reducedDamage);
  target.hp = Math.max(0, (target.hp ?? 0) - finalDamage);
  target.lastDamageAmount = finalDamage;
  target.damageFlashUntilMs = (state.combatClockMs ?? 0) + HEADQUARTERS_DAMAGE_FLASH_MS;

  const killed = target.hp <= 0;
  let eliminatedTeamId: TeamId | null = null;
  if (killed) {
    target.hp = 0;
    target.isDestroyed = true;
    target.destroyedAt = state.combatClockMs ?? 0;
    eliminateTeamForDestroyedHeadquarters(state, targetTeamId);
    eliminatedTeamId = targetTeamId;
  }

  syncHumanHeadquartersAlias(state, target);
  return {
    ok: true,
    rawDamage: normalizedRawDamage,
    finalDamage,
    killed,
    eliminatedTeamId,
  };
}

/** Disable one eliminated team's economy/production boundaries exactly once. */
export function eliminateTeamForDestroyedHeadquarters(
  state: GameState,
  teamId: TeamId,
): boolean {
  const match = ensureMatchState(state);
  const team = match.teams[teamId];
  if (!team) return false;
  const wasEliminated = team.eliminated;

  // Always enforce shutdown side effects. normalizeMatchState may already
  // have derived eliminated=true from the destroyed Headquarters.
  team.eliminated = true;
  team.hqPosition = null;
  match.activeTeamIds = match.activeTeamIds.filter(candidate => candidate !== teamId);
  for (const separator of team.economy.separators) separator.active = false;
  for (const factory of state.production.factories) {
    if ((factory.ownerTeamId ?? match.humanTeamId) !== teamId) continue;
    factory.active = false;
  }
  return !wasEliminated;
}

function syncHumanHeadquartersAlias(state: GameState, headquarters: HqPlacement): void {
  const match = ensureMatchState(state);
  if (headquarters.ownerTeamId === match.humanTeamId) {
    state.mapData.hq = { ...headquarters };
  }
}

/** Return all currently alive Headquarters targets. */
export function getAliveHeadquarters(state: GameState): HqPlacement[] {
  return getMapHeadquarters(state.mapData).filter(hq => !hq.isDestroyed && (hq.hp ?? 0) > 0);
}
