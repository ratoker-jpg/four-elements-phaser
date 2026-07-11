/**
 * Selection view model — read-only adapter that extracts display data
 * from GameState for the selection panel.
 *
 * SELECTION-CONTROL-GROUPS-05: Extended for multi-select:
 * - count: total selected units
 * - kind: 'multi' for multiple units
 * - typeBreakdown: e.g. "3 Builders, 2 Harvesters"
 * - HP: averaged across selected units
 */

import { QUEUE_LIMIT, type GameState, type BuilderPlacement, type HarvesterState } from '../../../state/types';
import { getBuildingDisplayName } from '../../../config/buildingRuntimeMapping';
import type { UnitSelection } from '../../../state/unitSelection';
import { isUnitSelected, isBuilderSelected, isHarvesterSelected, isBuildingSelected, getSelectionTypeBreakdown, getPrimarySelection } from '../../../state/unitSelection';
import { getHumanTeam } from '../../../state/matchState';
import { resolveEntityFaction } from '../../../state/teamOwnership';

export interface SelectionViewModel {
  /** Whether anything is selected. */
  hasSelection: boolean;
  /** Display name of the selected entity. */
  name: string;
  /** Entity kind: 'builder' | 'harvester' | 'building' | 'multi' | 'none'. */
  kind: 'builder' | 'harvester' | 'building' | 'multi' | 'none';
  /** Faction of the selected entity. */
  faction: string;
  /** HP current value, or null if not applicable. */
  hpCurrent: number | null;
  /** HP maximum value, or null if not applicable. */
  hpMax: number | null;
  /** Basic status text. */
  status: string;
  /** SELECTION-CONTROL-GROUPS-05: Total selected unit count. */
  count: number;
  /** SELECTION-CONTROL-GROUPS-05: Type breakdown string, e.g. "3 Builders, 2 Harvesters". */
  typeBreakdown: string;
}

const EMPTY_SELECTION: SelectionViewModel = {
  hasSelection: false,
  name: '',
  kind: 'none',
  faction: '',
  hpCurrent: null,
  hpMax: null,
  status: 'No selection',
  count: 0,
  typeBreakdown: '',
};

function builderStatus(builder: BuilderPlacement): string {
  switch (builder.phase) {
    case 'building': return 'Building';
    case 'moving-to-site': return 'Moving';
    case 'idle': return builder.manualMove ? 'Moving' : 'Idle';
    default: return 'Idle';
  }
}

function harvesterStatus(harvester: HarvesterState): string {
  switch (harvester.phase) {
    case 'gathering': return 'Gathering';
    case 'returning-to-hq': return 'Returning';
    case 'unloading': return 'Unloading';
    case 'moving-to-resource': return 'Moving';
    case 'manual-move': return 'Moving';
    case 'idle': return 'Idle';
    default: return 'Idle';
  }
}

/** Build a type breakdown string from the breakdown map. */
function formatTypeBreakdown(breakdown: Map<string, number>): string {
  const parts: string[] = [];
  const bc = breakdown.get('builder') ?? 0;
  const hc = breakdown.get('harvester') ?? 0;
  if (bc > 0) parts.push(`${bc} Builder${bc !== 1 ? 's' : ''}`);
  if (hc > 0) parts.push(`${hc} Harvester${hc !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

/**
 * Build a selection view model from the current game state and unit selection.
 */
export function buildSelectionViewModel(
  state: GameState,
  selection: UnitSelection,
): SelectionViewModel {
  if (!isUnitSelected(selection)) {
    return EMPTY_SELECTION;
  }

  // Multi-select
  if (selection.kind === 'multi') {
    const breakdown = getSelectionTypeBreakdown(selection);
    const count = selection.units.length;
    return {
      hasSelection: true,
      name: 'Multiple Units',
      kind: 'multi',
      faction: getHumanTeam(state).faction,
      hpCurrent: null,
      hpMax: null,
      status: `${count} unit${count !== 1 ? 's' : ''} selected`,
      count,
      typeBreakdown: formatTypeBreakdown(breakdown),
    };
  }

  // Single selection
  if (isBuilderSelected(selection)) {
    const primary = getPrimarySelection(selection);
    if (!primary) return EMPTY_SELECTION;
    const builder = state.mapData.builders.find((b: BuilderPlacement) => b.id === primary.id);
    if (!builder) return EMPTY_SELECTION;

    return {
      hasSelection: true,
      name: 'Builder',
      kind: 'builder',
      faction: resolveEntityFaction(state, builder),
      hpCurrent: null,
      hpMax: null,
      status: builderStatus(builder),
      count: 1,
      typeBreakdown: '',
    };
  }

  if (isBuildingSelected(selection)) {
    const primary = getPrimarySelection(selection);
    if (!primary || primary.kind !== 'building') return EMPTY_SELECTION;
    const building = state.mapData.buildings.find(item =>
      item.type === primary.buildingType && item.tx === primary.tx && item.ty === primary.ty,
    );
    if (!building) return EMPTY_SELECTION;
    const factory = primary.buildingType === 'units-factory'
      ? state.production.factories.find(item => item.tx === primary.tx && item.ty === primary.ty)
      : undefined;
    return {
      hasSelection: true,
      name: getBuildingDisplayName(primary.buildingType) ?? primary.buildingType,
      kind: 'building',
      faction: resolveEntityFaction(state, building),
      hpCurrent: null,
      hpMax: null,
      status: primary.buildingType === 'units-factory'
        ? `Очередь: ${factory?.queue.length ?? 0}/${QUEUE_LIMIT}`
        : 'Готово',
      count: 1,
      typeBreakdown: '',
    };
  }

  if (isHarvesterSelected(selection)) {
    const primary = getPrimarySelection(selection);
    if (!primary) return EMPTY_SELECTION;
    const harvester = state.harvesters.find((h: HarvesterState) => h.id === primary.id);
    if (!harvester) return EMPTY_SELECTION;

    return {
      hasSelection: true,
      name: 'Harvester',
      kind: 'harvester',
      faction: resolveEntityFaction(state, harvester),
      hpCurrent: null,
      hpMax: null,
      status: harvesterStatus(harvester),
      count: 1,
      typeBreakdown: '',
    };
  }

  return EMPTY_SELECTION;
}
