/**
 * Command Panel View Model — read-only adapter that derives available
 * command descriptors from GameState + UnitSelection.
 *
 * VISUAL-COMMAND-PANEL-02: Maps the current selection context to a
 * list of command descriptors that drive the HUD command panel buttons.
 *
 * This module does NOT modify any game state. It reads entity data,
 * economy, and status helpers to determine which commands are available,
 * which are disabled (and why), and which are hidden.
 *
 * Architecture:
 *   selected entity → context kind → command descriptors
 *   command descriptor → UI button (icon, label, hotkey, cost, state)
 *   button click → existing command handler
 */

import type { GameState, BuildingType, ProducibleUnitType } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { isUnitSelected, isBuilderSelected, isHarvesterSelected } from '../../../state/unitSelection';
import { BUILDING_CONFIG } from '../../../state/construction';
import {
  getBuildBlockReason,
  getProductionBlockReason,
  buildBlockLabel,
  productionBlockLabel,
} from '../../../state/statusHelpers';
import { getMvpCommandHotkey } from '../../../state/commandRegistry';
import { isVisualReadyBuilding, getBuildingDisplayName } from '../../../config/buildingRuntimeMapping';
import {
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
} from '../../../state/types';

// ─── Types ──────────────────────────────────────────────────────────

/** The visual/interaction state of a command button. */
export type CommandButtonState = 'enabled' | 'disabled' | 'hidden';

/** A single command descriptor for the command panel UI. */
export interface CommandDescriptor {
  /** Unique command id matching commandRegistry id, e.g. 'build-separator'. */
  id: string;
  /** Display label, e.g. 'Separator'. */
  label: string;
  /** Hotkey label, e.g. 'B', or empty string. */
  hotkey: string;
  /** Button state: enabled, disabled, or hidden. */
  state: CommandButtonState;
  /** Reason the command is disabled, or empty string. */
  disabledReason: string;
  /** Cost display string, e.g. '60 matter', or empty string. */
  cost: string;
  /** Short tooltip text. */
  tooltip: string;
  /** Command category for grouping. */
  category: 'build' | 'produce' | 'unit-action' | 'building-action';
}

/** The full command panel view model. */
export interface CommandPanelViewModel {
  /** Context kind — what's selected. */
  contextKind: 'none' | 'builder' | 'harvester' | 'building' | 'unknown';
  /** Context label — e.g. 'Builder', 'Units Factory', or empty. */
  contextLabel: string;
  /** Ordered list of command descriptors for the current context. */
  commands: CommandDescriptor[];
}

const EMPTY_VM: CommandPanelViewModel = {
  contextKind: 'none',
  contextLabel: '',
  commands: [],
};

// ─── Buildable buildings (gameplay-ready only) ──────────────────────

/** Gameplay-ready building types that can appear as build commands. */
const BUILDABLE_TYPES: BuildingType[] = [
  'separator',
  'raw-storage',
  'matter-storage',
  'element-storage',
  'power-plant',
  'units-factory',
];

/** Command ID for each buildable building type. */
const BUILD_COMMAND_IDS: Record<BuildingType, string> = {
  'separator': 'build-separator',
  'raw-storage': 'build-raw-storage',
  'matter-storage': 'build-matter-storage',
  'element-storage': 'build-element-storage',
  'power-plant': 'build-power-plant',
  'units-factory': 'build-units-factory',
  // Not buildable — visual-ready only or deferred
  'energy-plant': 'build-energy-plant',
  'command-relay': 'build-command-relay',
};

/** Producible unit types with their command IDs.
 *
 * VISUAL-COMMAND-PANEL-02-FIXUP-1: Production commands are deferred
 * until building/factory selection is supported in UnitSelection.
 * Kept as a reference for future implementation.
 */
export const PRODUCE_COMMANDS: { unitType: ProducibleUnitType; commandId: string }[] = [
  { unitType: 'builder', commandId: 'produce-builder' },
  { unitType: 'harvester', commandId: 'produce-harvester' },
];

// ─── Helpers ────────────────────────────────────────────────────────

/** Format building cost as a display string. */
function formatBuildCost(buildingType: BuildingType): string {
  const config = BUILDING_CONFIG[buildingType];
  if (!config) return '';
  const parts: string[] = [];
  if (config.costMatter > 0) parts.push(`${config.costMatter} M`);
  return parts.join(', ');
}

/** Format production cost as a display string. */
function formatProduceCost(unitType: ProducibleUnitType): string {
  if (unitType === 'builder') {
    return `${BUILDER_PRODUCTION_MATTER_COST} M, ${BUILDER_PRODUCTION_ELEMENT_COST} E`;
  }
  return `${HARVESTER_PRODUCTION_MATTER_COST} M, ${HARVESTER_PRODUCTION_ELEMENT_COST} E`;
}

/** Build a build-command descriptor for a building type. */
function buildCommandDesc(
  buildingType: BuildingType,
  state: GameState,
): CommandDescriptor {
  const commandId = BUILD_COMMAND_IDS[buildingType];
  const displayName = getBuildingDisplayName(buildingType) ?? buildingType;
  const hotkey = getMvpCommandHotkey(commandId);
  const cost = formatBuildCost(buildingType);
  const blockReason = getBuildBlockReason(state, buildingType);
  const enabled = blockReason === null;
  const disabledReason = enabled ? '' : buildBlockLabel(blockReason);

  return {
    id: commandId,
    label: displayName,
    hotkey,
    state: enabled ? 'enabled' : 'disabled',
    disabledReason,
    cost,
    tooltip: enabled
      ? `Build ${displayName}${cost ? ' — ' + cost : ''}`
      : `${displayName} — ${disabledReason}`,
    category: 'build',
  };
}

/**
 * Build a production-command descriptor for a unit type.
 *
 * VISUAL-COMMAND-PANEL-02-FIXUP-1: Exported for future building/factory
 * selection context. Not used in current builder/harvester contexts.
 */
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
  const hotkey = getMvpCommandHotkey(commandId);
  const cost = formatProduceCost(unitType);
  const blockReason = getProductionBlockReason(state, unitType);
  const enabled = blockReason === null;
  const disabledReason = enabled ? '' : productionBlockLabel(blockReason);

  return {
    id: commandId,
    label: displayName,
    hotkey,
    state: enabled ? 'enabled' : 'disabled',
    disabledReason,
    cost,
    tooltip: enabled
      ? `Train ${displayName}${cost ? ' — ' + cost : ''}`
      : `${displayName} — ${disabledReason}`,
    category: 'produce',
  };
}

// ─── Context-specific command lists ─────────────────────────────────

/** Commands for builder selection — build actions. */
function builderCommands(state: GameState): CommandDescriptor[] {
  const commands: CommandDescriptor[] = [];

  for (const buildingType of BUILDABLE_TYPES) {
    // Skip visual-ready buildings (energy-plant, etc.)
    if (isVisualReadyBuilding(buildingType)) continue;
    commands.push(buildCommandDesc(buildingType, state));
  }

  return commands;
}

/** Commands for harvester selection — stop only.
 *
 * VISUAL-COMMAND-PANEL-02-FIXUP-1: Production commands removed from
 * harvester context. Producing units requires selecting a factory
 * building, which is not yet supported in UnitSelection. Showing
 * production here was scope creep — it allowed producing without
 * an explicit production context.
 */
function harvesterCommands(_state: GameState): CommandDescriptor[] {
  return [{
    id: 'unit-stop',
    label: 'Stop',
    hotkey: 'S',
    state: 'enabled',
    disabledReason: '',
    cost: '',
    tooltip: 'Stop current action',
    category: 'unit-action',
  }];
}

// ─── Main view model builder ────────────────────────────────────────

/**
 * Build the command panel view model from current game state and selection.
 *
 * This is a pure function — no side effects, no state mutation.
 * The result drives the command panel UI: which buttons to show,
 * whether they're enabled, and what tooltip/cost to display.
 */
export function buildCommandPanelViewModel(
  state: GameState,
  selection: UnitSelection,
): CommandPanelViewModel {
  if (!isUnitSelected(selection)) {
    // VISUAL-COMMAND-PANEL-02-FIXUP-1: No selection => empty panel.
    // Production commands were removed — producing without a selected
    // production context is scope creep.
    return EMPTY_VM;
  }

  if (isBuilderSelected(selection)) {
    return {
      contextKind: 'builder',
      contextLabel: 'Builder',
      commands: builderCommands(state),
    };
  }

  if (isHarvesterSelected(selection)) {
    return {
      contextKind: 'harvester',
      contextLabel: 'Harvester',
      commands: harvesterCommands(state),
    };
  }

  // Unknown selection type — safe empty state
  return EMPTY_VM;
}
