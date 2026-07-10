/**
 * Command Panel View Model — read-only adapter that derives the 4×3
 * command card grid from GameState + UnitSelection.
 *
 * SELECTION-CONTROL-GROUPS-05: Added multi-select context.
 * - All builders: show full builder grid (build + Stop)
 * - All harvesters: show Stop only
 * - Mixed: show Stop only
 *
 * This module does NOT modify any game state.
 */

import type { GameState, BuildingType, ProducibleUnitType } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { isUnitSelected, isBuilderSelected, isHarvesterSelected, isAllBuilders, isAllHarvesters } from '../../../state/unitSelection';
import { BUILDING_CONFIG } from '../../../state/construction';
import {
  getBuildBlockReason,
  getProductionBlockReason,
  buildBlockLabel,
  productionBlockLabel,
} from '../../../state/statusHelpers';
import { isVisualReadyBuilding, getBuildingDisplayName } from '../../../config/buildingRuntimeMapping';
import {
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
  WASP_SMOKY_TOTAL_MATTER_COST,
  WASP_SMOKY_TOTAL_ELEMENT_COST,
} from '../../../state/types';
import {
  type SlotKey,
  type CommandSlotState,
  type CommandCardSlot,
  type CommandCardViewModel,
  emptyGrid,
  assignSlot,
  BUILDER_SLOT_MAP,
  STOP_SLOT,
} from './commandCardGrid';

// ─── Legacy types (re-exported for backward compatibility during migration) ──

/** The visual/interaction state of a command button. @deprecated Use CommandSlotState */
export type CommandButtonState = 'enabled' | 'disabled' | 'hidden';

/** A single command descriptor for the command panel UI. @deprecated Use CommandCardSlot */
export interface CommandDescriptor {
  id: string;
  label: string;
  hotkey: string;
  state: CommandButtonState;
  disabledReason: string;
  cost: string;
  tooltip: string;
  category: 'build' | 'produce' | 'unit-action' | 'building-action';
}

/** @deprecated Use CommandCardViewModel */
export interface CommandPanelViewModel {
  contextKind: 'none' | 'builder' | 'harvester' | 'building' | 'multi-select' | 'unknown';
  contextLabel: string;
  commands: CommandDescriptor[];
}

// ─── Buildable buildings (gameplay-ready only) ──────────────────────

const BUILD_COMMAND_IDS: Record<BuildingType, string> = {
  'separator': 'build-separator',
  'raw-storage': 'build-raw-storage',
  'matter-storage': 'build-matter-storage',
  'element-storage': 'build-element-storage',
  'power-plant': 'build-power-plant',
  'units-factory': 'build-units-factory',
  'energy-plant': 'build-energy-plant',
  'command-relay': 'build-command-relay',
};

export const PRODUCE_COMMANDS: { unitType: ProducibleUnitType; commandId: string }[] = [
  { unitType: 'builder', commandId: 'produce-builder' },
  { unitType: 'harvester', commandId: 'produce-harvester' },
  { unitType: 'wasp-smoky', commandId: 'produce-wasp-smoky' },
];

// ─── Helpers ────────────────────────────────────────────────────────

function formatBuildCost(buildingType: BuildingType): string {
  const config = BUILDING_CONFIG[buildingType];
  if (!config) return '';
  const parts: string[] = [];
  if (config.costMatter > 0) parts.push(`${config.costMatter} M`);
  return parts.join(', ');
}

function formatProduceCost(unitType: ProducibleUnitType): string {
  switch (unitType) {
    case 'builder': return `${BUILDER_PRODUCTION_MATTER_COST} M, ${BUILDER_PRODUCTION_ELEMENT_COST} E`;
    case 'harvester': return `${HARVESTER_PRODUCTION_MATTER_COST} M, ${HARVESTER_PRODUCTION_ELEMENT_COST} E`;
    case 'wasp-smoky': return `${WASP_SMOKY_TOTAL_MATTER_COST} M, ${WASP_SMOKY_TOTAL_ELEMENT_COST} E`;
  }
}

// ─── Context-specific grid builders ─────────────────────────────────

function builderGrid(state: GameState): CommandCardSlot[] {
  let grid = emptyGrid();

  for (const mapping of BUILDER_SLOT_MAP) {
    const buildingType = mapping.buildingType as BuildingType;

    if (isVisualReadyBuilding(buildingType)) continue;

    const commandId = BUILD_COMMAND_IDS[buildingType];
    const displayName = getBuildingDisplayName(buildingType) ?? buildingType;
    const cost = formatBuildCost(buildingType);
    const blockReason = getBuildBlockReason(state, buildingType);
    const enabled = blockReason === null;
    const disabledReason = enabled ? '' : buildBlockLabel(blockReason);
    const slotState: CommandSlotState = enabled ? 'enabled' : 'disabled';
    const tooltip = enabled
      ? `Build ${displayName}${cost ? ' — ' + cost : ''}  [${mapping.slotKey}]`
      : `${displayName} — ${disabledReason}  [${mapping.slotKey}]`;

    grid = assignSlot(
      grid, mapping.slotKey,
      commandId, displayName,
      slotState, disabledReason, cost, tooltip,
      'build',
    );
  }

  grid = assignSlot(
    grid, STOP_SLOT,
    'unit-stop', 'Stop',
    'enabled', '', '', 'Stop current action  [S]',
    'unit-action',
  );

  return grid;
}

function harvesterGrid(_state: GameState): CommandCardSlot[] {
  let grid = emptyGrid();

  grid = assignSlot(
    grid, STOP_SLOT,
    'unit-stop', 'Stop',
    'enabled', '', '', 'Stop current action  [S]',
    'unit-action',
  );

  return grid;
}

/**
 * Building context grid — shown when a factory building is selected.
 *
 * Row 3 (Z/X/C): Production commands
 *   Z: Train Builder
 *   X: Train Harvester
 *   C: Wasp+Smoky M0
 *
 * Exported for future use when building selection is implemented in UnitSelection.
 */
export function buildingGrid(state: GameState): CommandCardSlot[] {
  let grid = emptyGrid();

  // Z slot: produce-builder
  const builderDesc = produceCommandDesc('builder', state);
  grid = assignSlot(
    grid, 'Z',
    builderDesc.id, builderDesc.label,
    builderDesc.state === 'enabled' ? 'enabled' : 'disabled',
    builderDesc.disabledReason, builderDesc.cost, builderDesc.tooltip,
    'produce',
  );

  // X slot: produce-harvester
  const harvesterDesc = produceCommandDesc('harvester', state);
  grid = assignSlot(
    grid, 'X',
    harvesterDesc.id, harvesterDesc.label,
    harvesterDesc.state === 'enabled' ? 'enabled' : 'disabled',
    harvesterDesc.disabledReason, harvesterDesc.cost, harvesterDesc.tooltip,
    'produce',
  );

  // C slot: produce-wasp-smoky
  const waspSmokyDesc = produceCommandDesc('wasp-smoky', state);
  grid = assignSlot(
    grid, 'C',
    waspSmokyDesc.id, waspSmokyDesc.label,
    waspSmokyDesc.state === 'enabled' ? 'enabled' : 'disabled',
    waspSmokyDesc.disabledReason, waspSmokyDesc.cost, waspSmokyDesc.tooltip,
    'produce',
  );

  return grid;
}

/**
 * SELECTION-CONTROL-GROUPS-05: Build command card grid for multi-select.
 *
 * - All builders: show full builder grid (build + Stop)
 * - All harvesters: show Stop only
 * - Mixed: show Stop only
 */
function multiSelectGrid(state: GameState, selection: UnitSelection): CommandCardSlot[] {
  if (!selection) return emptyGrid();

  if (isAllBuilders(selection)) {
    return builderGrid(state);
  }

  // All harvesters or mixed: show Stop only
  let grid = emptyGrid();

  grid = assignSlot(
    grid, STOP_SLOT,
    'unit-stop', 'Stop',
    'enabled', '', '', 'Stop all selected units  [S]',
    'unit-action',
  );

  return grid;
}

function emptySelectionGrid(): CommandCardSlot[] {
  return emptyGrid();
}

// ─── Main view model builder ────────────────────────────────────────

export function buildCommandCardViewModel(
  state: GameState,
  selection: UnitSelection,
): CommandCardViewModel {
  if (!isUnitSelected(selection)) {
    return {
      contextKind: 'none',
      contextLabel: '',
      slots: emptySelectionGrid(),
    };
  }

  // Multi-select
  if (selection.kind === 'multi') {
    return {
      contextKind: 'multi-select',
      contextLabel: isAllBuilders(selection) ? 'Builders' : isAllHarvesters(selection) ? 'Harvesters' : 'Multiple Units',
      slots: multiSelectGrid(state, selection),
    };
  }

  // Single selection
  if (isBuilderSelected(selection)) {
    return {
      contextKind: 'builder',
      contextLabel: 'Builder',
      slots: builderGrid(state),
    };
  }

  if (isHarvesterSelected(selection)) {
    return {
      contextKind: 'harvester',
      contextLabel: 'Harvester',
      slots: harvesterGrid(state),
    };
  }

  // NOTE: Building selection (contextKind: 'building') is not yet wired
  // because UnitSelection does not support building selections.
  // When building selection is added, call buildingGrid(state) here.
  // See buildingGrid() above for the factory production grid layout.

  return {
    contextKind: 'unknown',
    contextLabel: '',
    slots: emptySelectionGrid(),
  };
}

// ─── Legacy compatibility ───────────────────────────────────────────

/**
 * @deprecated Use buildCommandCardViewModel instead.
 */
export function buildCommandPanelViewModel(
  state: GameState,
  selection: UnitSelection,
): CommandPanelViewModel {
  const cardVm = buildCommandCardViewModel(state, selection);

  const commands: CommandDescriptor[] = [];
  for (const slot of cardVm.slots) {
    if (slot.state === 'empty') continue;
    commands.push({
      id: slot.commandId,
      label: slot.label,
      hotkey: slot.hotkey,
      state: slot.state === 'enabled' ? 'enabled' : 'disabled',
      disabledReason: slot.disabledReason,
      cost: slot.cost,
      tooltip: slot.tooltip,
      category: slot.category as CommandDescriptor['category'],
    });
  }

  return {
    contextKind: cardVm.contextKind,
    contextLabel: cardVm.contextLabel,
    commands,
  };
}

export function produceCommandDesc(
  unitType: ProducibleUnitType,
  state: GameState,
): CommandDescriptor {
  const entry = PRODUCE_COMMANDS.find(p => p.unitType === unitType);
  if (!entry) {
    return {
      id: `produce-${unitType}`,
      label: unitType,
      hotkey: '',
      state: 'hidden',
      disabledReason: 'Unknown unit type',
      cost: '',
      tooltip: '',
      category: 'produce',
    };
  }
  const commandId = entry.commandId;
  const displayName = unitType.charAt(0).toUpperCase() + unitType.slice(1);
  const cost = formatProduceCost(unitType);
  const blockReason = getProductionBlockReason(state, unitType);
  const enabled = blockReason === null;
  const disabledReason = enabled ? '' : productionBlockLabel(blockReason);

  return {
    id: commandId,
    label: displayName,
    hotkey: '',
    state: enabled ? 'enabled' : 'disabled',
    disabledReason,
    cost,
    tooltip: enabled
      ? `Train ${displayName}${cost ? ' — ' + cost : ''}`
      : `${displayName} — ${disabledReason}`,
    category: 'produce',
  };
}

export function getCommandSlotKey(
  commandId: string,
  contextKind: CommandCardViewModel['contextKind'],
): SlotKey | undefined {
  if (contextKind === 'builder' || contextKind === 'multi-select') {
    for (const mapping of BUILDER_SLOT_MAP) {
      const buildingType = mapping.buildingType as BuildingType;
      const cmdId = BUILD_COMMAND_IDS[buildingType];
      if (cmdId === commandId) return mapping.slotKey;
    }
    if (commandId === 'unit-stop') return STOP_SLOT;
  }

  if (contextKind === 'harvester') {
    if (commandId === 'unit-stop') return STOP_SLOT;
  }

  return undefined;
}
