import type {
  BuildingPlacement,
  Faction,
  GameState,
  ModularCombatUnit,
  TeamId,
} from './types';
import { ensureMatchState, teamIdForFaction } from './matchState';
import type { SelectableUnit } from './unitSelection';

export interface OwnedEntityRef {
  ownerTeamId?: TeamId;
  faction?: Faction;
}

/** Resolve explicit ownership first, then faction, then legacy human ownership. */
export function resolveEntityTeamId(
  state: GameState,
  entity: OwnedEntityRef,
): TeamId {
  const match = ensureMatchState(state);
  if (entity.ownerTeamId && match.teams[entity.ownerTeamId]) return entity.ownerTeamId;
  if (entity.faction) return teamIdForFaction(entity.faction);
  return match.humanTeamId;
}

export function isHumanOwned(
  state: GameState,
  entity: OwnedEntityRef,
): boolean {
  const match = ensureMatchState(state);
  return resolveEntityTeamId(state, entity) === match.humanTeamId;
}

export function isHumanOwnedCombatUnit(
  state: GameState,
  unit: ModularCombatUnit,
): boolean {
  return isHumanOwned(state, unit);
}

export function isHumanOwnedBuilding(
  state: GameState,
  building: BuildingPlacement,
): boolean {
  return isHumanOwned(state, building);
}

/** Resolve a selection reference to live state and verify human control. */
export function isSelectableUnitHumanOwned(
  state: GameState,
  unit: SelectableUnit,
): boolean {
  if (unit.kind === 'builder') {
    const builder = state.mapData.builders.find(candidate => candidate.id === unit.id);
    return !!builder && isHumanOwned(state, builder);
  }
  if (unit.kind === 'harvester') {
    const harvester = state.harvesters.find(candidate => candidate.id === unit.id);
    return !!harvester && isHumanOwned(state, harvester);
  }
  if (unit.kind === 'combat') {
    const combat = state.combatUnits.find(candidate => candidate.id === unit.id);
    return !!combat && !combat.runtime?.isDestroyed && isHumanOwned(state, combat);
  }

  const building = state.mapData.buildings.find(candidate =>
    candidate.type === unit.buildingType
    && candidate.tx === unit.tx
    && candidate.ty === unit.ty,
  );
  return !!building && isHumanOwned(state, building);
}
