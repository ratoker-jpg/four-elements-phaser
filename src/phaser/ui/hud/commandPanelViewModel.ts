/**
 * Command Panel View Model — read-only adapter that derives the 4×3
 * command card grid from GameState + UnitSelection.
 *
 * COMMAND-CARD-REBUILD-03: Rebuilt to produce a stable 4×3 command
 * card with Q/W/E/R/A/S/D/F/Z/X/C/V hotkey spatial mapping.
 *
 * Key changes from HUD-LAYOUT-REBUILD-02:
 *   - Output is now CommandCardViewModel with 12 fixed slots
 *   - Each slot has a stable position and hotkey badge
 *   - Commands are assigned to specific grid slots, not listed in order
 *   - Empty slots are explicit (state: 'empty'), not collapsed
 *   - Old CommandPanelViewModel with flat command list is replaced
 *
 * This module does NOT modify any game state. It reads entity data,
 * economy, and status helpers to determine which commands are available,
 * which are disabled (and why), and which slots are empty.
 *
 * Architecture:
 *   selected entity → context kind → slot assignments → 12-slot grid
 *   grid slot → UI cell (hotkey badge, label, cost, state)
 *   cell click → existing command handler via commandRegistry
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
import { isVisualReadyBuilding, getBuildingDisplayName } from '../../../config/buildingRuntimeMapping';
import {
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
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
  contextKind: 'none' | 'builder' | 'harvester' | 'building' | 'unknown';
  contextLabel: string;
  commands: CommandDescriptor[];
}

// ─── Buildable buildings (gameplay-ready only) ──────────────────────

/** Command ID for each buildable building type. */
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

/** Producible unit types with their command IDs. */
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

// ─── Context-specific grid builders ─────────────────────────────────

/**
 * Build command card grid for builder selection.
 *
 * Slot assignments (stable for muscle memory):
 *   Q: Separator    W: Raw Storage   E: Matter Storage  R: Element Storage
 *   A: Power Plant  S: Units Factory D: (empty)          F: (empty)
 *   Z: Stop         X: (empty)       C: (empty)          V: (empty)
 */
function builderGrid(state: GameState): CommandCardSlot[] {
  let grid = emptyGrid();

  // Assign build commands to their stable slots
  for (const mapping of BUILDER_SLOT_MAP) {
    const buildingType = mapping.buildingType as BuildingType;

    // Skip visual-ready buildings (energy-plant, etc.)
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

  // Z slot: Stop command
  grid = assignSlot(
    grid, STOP_SLOT,
    'unit-stop', 'Stop',
    'enabled', '', '', 'Stop current action  [Z]',
    'unit-action',
  );

  return grid;
}

/**
 * Build command card grid for harvester selection.
 *
 * Slot assignments:
 *   Q–F: all empty
 *   Z: Stop
 *   X–V: all empty
 */
function harvesterGrid(_state: GameState): CommandCardSlot[] {
  let grid = emptyGrid();

  // Z slot: Stop command
  grid = assignSlot(
    grid, STOP_SLOT,
    'unit-stop', 'Stop',
    'enabled', '', '', 'Stop current action  [Z]',
    'unit-action',
  );

  return grid;
}

/**
 * Build command card grid for no selection.
 *
 * All slots empty.
 */
function emptySelectionGrid(): CommandCardSlot[] {
  return emptyGrid();
}

// ─── Main view model builder ────────────────────────────────────────

/**
 * Build the command card view model from current game state and selection.
 *
 * COMMAND-CARD-REBUILD-03: Returns a 12-slot grid where each slot has
 * a stable position and hotkey badge. This is a pure function — no side
 * effects, no state mutation.
 */
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

  // Unknown selection type — safe empty grid
  return {
    contextKind: 'unknown',
    contextLabel: '',
    slots: emptySelectionGrid(),
  };
}

// ─── Legacy compatibility ───────────────────────────────────────────

/**
 * Legacy view model builder — converts CommandCardViewModel to the old
 * flat CommandPanelViewModel format. Used by old HudCommandPanel during
 * migration. Will be removed when the new command card UI is complete.
 *
 * @deprecated Use buildCommandCardViewModel instead.
 */
export function buildCommandPanelViewModel(
  state: GameState,
  selection: UnitSelection,
): CommandPanelViewModel {
  const cardVm = buildCommandCardViewModel(state, selection);

  // Convert grid slots to flat command list (non-empty only)
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

/**
 * Build a production-command descriptor for a unit type.
 *
 * Exported for future building/factory selection context.
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
  // Use grid hotkey for production commands when assigned to a slot
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

/**
 * Get the slot key for a given command ID in a specific context.
 * Returns undefined if the command is not assigned to any slot.
 */
export function getCommandSlotKey(
  commandId: string,
  contextKind: CommandCardViewModel['contextKind'],
): SlotKey | undefined {
  // Builder context: check BUILDER_SLOT_MAP
  if (contextKind === 'builder') {
    for (const mapping of BUILDER_SLOT_MAP) {
      const buildingType = mapping.buildingType as BuildingType;
      const cmdId = BUILD_COMMAND_IDS[buildingType];
      if (cmdId === commandId) return mapping.slotKey;
    }
    if (commandId === 'unit-stop') return STOP_SLOT;
  }

  // Harvester context
  if (contextKind === 'harvester') {
    if (commandId === 'unit-stop') return STOP_SLOT;
  }

  return undefined;
}
