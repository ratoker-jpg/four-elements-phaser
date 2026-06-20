/**
 * Selection view model — read-only adapter that extracts display data
 * from GameState for the selection panel.
 *
 * VISUAL-HUD-CORE-01: This module does NOT modify any game state.
 * It reads entity data and formats it for display.
 */

import type { GameState, BuilderPlacement, HarvesterState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { isUnitSelected, isBuilderSelected, isHarvesterSelected } from '../../../state/unitSelection';

export interface SelectionViewModel {
  /** Whether anything is selected. */
  hasSelection: boolean;
  /** Display name of the selected entity. */
  name: string;
  /** Entity kind: 'builder' | 'harvester' | 'building' | 'none'. */
  kind: 'builder' | 'harvester' | 'building' | 'none';
  /** Faction of the selected entity. */
  faction: string;
  /** HP current value, or null if not applicable. */
  hpCurrent: number | null;
  /** HP maximum value, or null if not applicable. */
  hpMax: number | null;
  /** Basic status text. */
  status: string;
}

const EMPTY_SELECTION: SelectionViewModel = {
  hasSelection: false,
  name: '',
  kind: 'none',
  faction: '',
  hpCurrent: null,
  hpMax: null,
  status: 'No selection',
};

/**
 * Derive a human-readable status from a builder's phase.
 */
function builderStatus(builder: BuilderPlacement): string {
  switch (builder.phase) {
    case 'building': return 'Building';
    case 'moving-to-site': return 'Moving';
    case 'idle': return builder.manualMove ? 'Moving' : 'Idle';
    default: return 'Idle';
  }
}

/**
 * Derive a human-readable status from a harvester's phase.
 */
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

/**
 * Build a selection view model from the current game state and unit selection.
 *
 * This is a pure function — no side effects, no state mutation.
 */
export function buildSelectionViewModel(
  state: GameState,
  selection: UnitSelection,
): SelectionViewModel {
  if (!isUnitSelected(selection)) {
    return EMPTY_SELECTION;
  }

  if (isBuilderSelected(selection)) {
    const builder = state.mapData.builders.find((b: BuilderPlacement) => b.id === selection.id);
    if (!builder) return EMPTY_SELECTION;

    return {
      hasSelection: true,
      name: 'Builder',
      kind: 'builder',
      faction: state.playerFaction,
      hpCurrent: null,
      hpMax: null,
      status: builderStatus(builder),
    };
  }

  if (isHarvesterSelected(selection)) {
    const harvester = state.harvesters.find((h: HarvesterState) => h.id === selection.id);
    if (!harvester) return EMPTY_SELECTION;

    return {
      hasSelection: true,
      name: 'Harvester',
      kind: 'harvester',
      faction: harvester.faction,
      hpCurrent: null,
      hpMax: null,
      status: harvesterStatus(harvester),
    };
  }

  return EMPTY_SELECTION;
}
