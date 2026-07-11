import type {
  BuildingPlacement,
  Faction,
  GameState,
  ModularCombatUnit,
  TeamId,
} from './types';
import { ensureMatchState, factionForTeamId, teamIdForFaction } from './matchState';
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

/** Resolve the visual/gameplay faction from canonical team ownership. */
export function resolveEntityFaction(
  state: GameState,
  entity: OwnedEntityRef,
): Faction {
  return factionForTeamId(resolveEntityTeamId(state, entity));
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

/** Resolve a selection reference to live state and distinguish missing from foreign. */
export function getSelectableUnitControl(
  state: GameState,
  unit: SelectableUnit,
): 'human' | 'foreign' | 'missing' {
  let entity: OwnedEntityRef | undefined;
  if (unit.kind === 'builder') {
    entity = state.mapData.builders.find(candidate => candidate.id === unit.id);
  } else if (unit.kind === 'harvester') {
    entity = state.harvesters.find(candidate => candidate.id === unit.id);
  } else if (unit.kind === 'combat') {
    entity = state.combatUnits.find(candidate => candidate.id === unit.id);
  } else {
    entity = state.mapData.buildings.find(candidate =>
      candidate.type === unit.buildingType
      && candidate.tx === unit.tx
      && candidate.ty === unit.ty,
    );
  }
  if (!entity) return 'missing';
  return isHumanOwned(state, entity) ? 'human' : 'foreign';
}

export function isSelectableUnitHumanOwned(
  state: GameState,
  unit: SelectableUnit,
): boolean {
  return getSelectableUnitControl(state, unit) === 'human';
}
