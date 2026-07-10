from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        if new in text:
            return
        raise SystemExit(f"anchor not found in {path}: {old[:140]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Pure composer state. UI choice deliberately stays outside GameState/saves.
# ─────────────────────────────────────────────────────────────────────────────
(ROOT / "src/state/factoryComposer.ts").write_text(r'''import type { ProductionQueueItem, UnitProductionRequest } from './types';
import {
  getT1CombatProductionQuote,
  type T1CombatProductionQuote,
  type T1ProductionBodyId,
  type T1ProductionWeaponId,
} from '../config/t1ProductionComponents';
import { getProductionQuote } from './production';

export interface FactoryComposerState {
  bodyId: T1ProductionBodyId;
  weaponId: T1ProductionWeaponId;
}

export type FactoryComposerCommandId =
  | 'factory-body-wasp'
  | 'factory-body-hunter'
  | 'factory-weapon-smoky'
  | 'factory-weapon-railgun';

export const DEFAULT_FACTORY_COMPOSER_STATE: Readonly<FactoryComposerState> = {
  bodyId: 'wasp',
  weaponId: 'smoky',
};

export function reduceFactoryComposer(
  current: FactoryComposerState,
  commandId: FactoryComposerCommandId,
): FactoryComposerState {
  switch (commandId) {
    case 'factory-body-wasp': return { ...current, bodyId: 'wasp' };
    case 'factory-body-hunter': return { ...current, bodyId: 'hunter' };
    case 'factory-weapon-smoky': return { ...current, weaponId: 'smoky' };
    case 'factory-weapon-railgun': return { ...current, weaponId: 'railgun' };
  }
}

export function createFactoryComposerRequest(
  composer: FactoryComposerState,
): Extract<UnitProductionRequest, { kind: 'combat' }> {
  return {
    kind: 'combat',
    bodyId: composer.bodyId,
    weaponId: composer.weaponId,
    hullMod: 'm0',
    turretMod: 'm0',
  };
}

export function getFactoryComposerQuote(
  composer: FactoryComposerState,
): T1CombatProductionQuote {
  const quote = getT1CombatProductionQuote(createFactoryComposerRequest(composer));
  if (!quote) throw new Error('Factory composer produced an invalid T1 selection');
  return quote;
}

export function formatProductionDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${seconds} с`;
}

export function getQueueItemDisplayName(item: ProductionQueueItem): string {
  return getProductionQuote(item.request ?? item.unitType)?.displayNameRu ?? item.unitType;
}
''', encoding="utf-8")

# ─────────────────────────────────────────────────────────────────────────────
# Building selection becomes a first-class UI-layer selection variant.
# ─────────────────────────────────────────────────────────────────────────────
replace_once(
    "src/state/unitSelection.ts",
    "import type { GameState } from './types';",
    "import type { BuildingType, GameState } from './types';",
)
replace_once(
    "src/state/unitSelection.ts",
    """export type SelectableUnit =
  | { kind: 'builder'; id: string }
  | { kind: 'harvester'; id: string }
  | { kind: 'combat'; id: string };""",
    """export type SelectableUnit =
  | { kind: 'builder'; id: string }
  | { kind: 'harvester'; id: string }
  | { kind: 'combat'; id: string }
  | { kind: 'building'; id: string; buildingType: BuildingType; tx: number; ty: number };""",
)
replace_once(
    "src/state/unitSelection.ts",
    "// ─── Selection constructors ─────────────────────────────────────────",
    """export function getBuildingSelectionId(type: BuildingType, tx: number, ty: number): string {
  return `building:${type}:${tx}:${ty}`;
}

// ─── Selection constructors ─────────────────────────────────────────""",
)
replace_once(
    "src/state/unitSelection.ts",
    """    } else if (u.kind === 'combat') {
      return state.combatUnits.some(unit => unit.id === u.id && !unit.runtime?.isDestroyed);
    }
    return false;""",
    """    } else if (u.kind === 'combat') {
      return state.combatUnits.some(unit => unit.id === u.id && !unit.runtime?.isDestroyed);
    } else if (u.kind === 'building') {
      return state.mapData.buildings.some(building =>
        building.type === u.buildingType && building.tx === u.tx && building.ty === u.ty,
      );
    }
    return false;""",
)
replace_once(
    "src/state/unitSelection.ts",
    """export function isHarvesterSelected(sel: UnitSelection): sel is SingleSelection | MultiSelection & { units: [{ kind: 'harvester'; id: string }] } {
  if (sel === null) return false;
  const primary = getPrimarySelection(sel);
  return primary !== null && primary.kind === 'harvester';
}
""",
    """export function isHarvesterSelected(sel: UnitSelection): sel is SingleSelection | MultiSelection & { units: [{ kind: 'harvester'; id: string }] } {
  if (sel === null) return false;
  const primary = getPrimarySelection(sel);
  return primary !== null && primary.kind === 'harvester';
}

export function isBuildingSelected(sel: UnitSelection): boolean {
  return getPrimarySelection(sel)?.kind === 'building';
}
""",
)
replace_once(
    "src/state/unitSelection.ts",
    """    } else if (u.kind === 'combat') {
      const unit = state.combatUnits.find(candidate => candidate.id === u.id);
      if (unit && !unit.runtime?.isDestroyed) {
        sumTx += unit.runtime?.ftx ?? unit.tx;
        sumTy += unit.runtime?.fty ?? unit.ty;
        count++;
      }
    }
""",
    """    } else if (u.kind === 'combat') {
      const unit = state.combatUnits.find(candidate => candidate.id === u.id);
      if (unit && !unit.runtime?.isDestroyed) {
        sumTx += unit.runtime?.ftx ?? unit.tx;
        sumTy += unit.runtime?.fty ?? unit.ty;
        count++;
      }
    } else if (u.kind === 'building') {
      sumTx += u.tx + 0.5;
      sumTy += u.ty + 0.5;
      count++;
    }
""",
)

# Router carries building metadata and never treats buildings as builders/movable units.
replace_once(
    "src/state/commandRouter.ts",
    "import type { UnitSelection, SelectableUnit } from './unitSelection';",
    "import type { BuildingType } from './types';\nimport type { UnitSelection, SelectableUnit } from './unitSelection';",
)
replace_once(
    "src/state/commandRouter.ts",
    """  /** Entity kind (for same-type double-click). */
  unitKind?: 'builder' | 'harvester';
""",
    """  /** Entity kind (for same-type double-click). */
  unitKind?: 'builder' | 'harvester';
  /** Completed building type for building selection. */
  buildingType?: BuildingType;
""",
)
replace_once(
    "src/state/commandRouter.ts",
    """    case 'own-building':
      return { action: 'select', selection: selectOne({ kind: 'builder', id: target.id! }) };""",
    """    case 'own-building':
      if (!target.buildingType) return { action: 'no-op' };
      return {
        action: 'select',
        selection: selectOne({
          kind: 'building',
          id: target.id!,
          buildingType: target.buildingType,
          tx: target.tx,
          ty: target.ty,
        }),
      };""",
)
replace_once(
    "src/state/commandRouter.ts",
    """  switch (target.kind) {
    case 'ground': {
      return { action: 'move', tx: target.tx, ty: target.ty };
    }
""",
    """  const hasMovableUnit = currentSelection.units.some(unit => unit.kind !== 'building');

  switch (target.kind) {
    case 'ground': {
      return hasMovableUnit
        ? { action: 'move', tx: target.tx, ty: target.ty }
        : { action: 'no-op', reason: 'building-selected' };
    }
""",
)
replace_once(
    "src/state/commandRouter.ts",
    """      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'enemy-unit': {""",
    """      return hasMovableUnit
        ? { action: 'move', tx: target.tx, ty: target.ty }
        : { action: 'no-op', reason: 'building-selected' };
    }

    case 'enemy-unit': {""",
)
replace_once(
    "src/state/commandRouter.ts",
    """    unitIds.push(u.id);
  }
""",
    """    if (u.kind !== 'building') unitIds.push(u.id);
  }
""",
)

# Contextual registry entries. Their synthetic keys avoid global duplicate-key warnings;
# actual hotkeys come from the contextual command-card slot map.
replace_once(
    "src/state/commandRegistry.ts",
    """  { id: 'produce-wasp-smoky', label: 'Wasp+Smoky M0',         key: 'C', category: 'produce' },
];""",
    """  { id: 'produce-wasp-smoky', label: 'Wasp+Smoky M0',         key: 'C', category: 'produce' },

  // Factory-composer commands. Slot keys are assigned contextually by the HUD.
  { id: 'factory-body-wasp', label: 'Корпус: Васп', key: 'FACTORY_BODY_WASP', category: 'building-action' },
  { id: 'factory-body-hunter', label: 'Корпус: Хантер', key: 'FACTORY_BODY_HUNTER', category: 'building-action' },
  { id: 'factory-weapon-smoky', label: 'Пушка: Смоки', key: 'FACTORY_WEAPON_SMOKY', category: 'building-action' },
  { id: 'factory-weapon-railgun', label: 'Пушка: Рельса', key: 'FACTORY_WEAPON_RAILGUN', category: 'building-action' },
  { id: 'factory-queue-combat', label: 'Собрать танк', key: 'FACTORY_QUEUE_COMBAT', category: 'produce' },
  { id: 'factory-cancel-first', label: 'Отменить заказ', key: 'FACTORY_CANCEL_FIRST', category: 'building-action' },
];""",
)

# Availability selector accepts structured requests and an exact selected factory.
replace_once(
    "src/state/statusHelpers.ts",
    "  ProducibleUnitType,\n",
    "",
)
replace_once(
    "src/state/statusHelpers.ts",
    "import { getProductionQuote } from './production';",
    "import { getProductionQuote, type ProductionRequestInput } from './production';",
)
replace_once(
    "src/state/statusHelpers.ts",
    """export function getProductionBlockReason(
  state: GameState,
  unitType: ProducibleUnitType,
): ProductionBlockReason | null {
  // Check for any completed factory
  if (state.production.factories.length === 0) {
    return 'no-factory';
  }

  // Check for queue room in any factory
  const hasQueueRoom = state.production.factories.some(
    f => f.queue.length < QUEUE_LIMIT,
  );
""",
    """export function getProductionBlockReason(
  state: GameState,
  input: ProductionRequestInput,
  factoryTarget?: { tx: number; ty: number },
): ProductionBlockReason | null {
  const factories = factoryTarget
    ? state.production.factories.filter(factory => factory.tx === factoryTarget.tx && factory.ty === factoryTarget.ty)
    : state.production.factories;

  if (factories.length === 0) {
    return 'no-factory';
  }

  const hasQueueRoom = factories.some(factory => factory.queue.length < QUEUE_LIMIT);
""",
)
replace_once(
    "src/state/statusHelpers.ts",
    "const quote = getProductionQuote(unitType);",
    "const quote = getProductionQuote(input);",
)

# Replace the dormant building grid with the live composer view model.
command_vm = ROOT / "src/phaser/ui/hud/commandPanelViewModel.ts"
text = command_vm.read_text(encoding="utf-8")
text = text.replace(
    "import type { GameState, BuildingType, ProducibleUnitType } from '../../../state/types';",
    "import type { GameState, BuildingType, ProducibleUnitType } from '../../../state/types';\nimport type { FactoryComposerState } from '../../../state/factoryComposer';",
    1,
)
text = text.replace(
    "import { isUnitSelected, isBuilderSelected, isHarvesterSelected, isAllBuilders, isAllHarvesters } from '../../../state/unitSelection';",
    "import { isUnitSelected, isBuilderSelected, isHarvesterSelected, isBuildingSelected, isAllBuilders, isAllHarvesters, getPrimarySelection } from '../../../state/unitSelection';",
    1,
)
text = text.replace(
    "import { getProductionQuote } from '../../../state/production';",
    "import { getProductionQuote } from '../../../state/production';\nimport { DEFAULT_FACTORY_COMPOSER_STATE, createFactoryComposerRequest, formatProductionDuration, getFactoryComposerQuote, getQueueItemDisplayName } from '../../../state/factoryComposer';",
    1,
)
start = text.index("/**\n * Building context grid")
end = text.index("/**\n * SELECTION-CONTROL-GROUPS-05", start)
new_grid = r'''/** Factory composer grid for the selected completed units-factory. */
export function buildingGrid(
  state: GameState,
  selection: UnitSelection = null,
  composer: FactoryComposerState = DEFAULT_FACTORY_COMPOSER_STATE,
): CommandCardSlot[] {
  let grid = emptyGrid();
  const primary = getPrimarySelection(selection);
  if (!primary || primary.kind !== 'building' || primary.buildingType !== 'units-factory') return grid;

  const factoryTarget = { tx: primary.tx, ty: primary.ty };
  const factory = state.production.factories.find(item => item.tx === primary.tx && item.ty === primary.ty);
  const quote = getFactoryComposerQuote(composer);
  const request = createFactoryComposerRequest(composer);

  const component = (
    slotKey: SlotKey,
    commandId: string,
    label: string,
    selected: boolean,
    cost: string,
  ) => {
    grid = assignSlot(
      grid, slotKey, commandId, `${selected ? '●' : '○'} ${label}`,
      'enabled', '', cost, `${label}${selected ? ' — выбрано' : ''}  [${slotKey}]`,
      'building-action',
    );
  };

  component('Q', 'factory-body-wasp', 'Васп', composer.bodyId === 'wasp', '20 M · 5 E');
  component('W', 'factory-body-hunter', 'Хантер', composer.bodyId === 'hunter', '35 M · 7 E');
  component('A', 'factory-weapon-smoky', 'Смоки', composer.weaponId === 'smoky', '25 M · 5 E');
  component('S', 'factory-weapon-railgun', 'Рельса', composer.weaponId === 'railgun', '45 M · 8 E');

  const blockReason = getProductionBlockReason(state, request, factoryTarget);
  const queueEnabled = blockReason === null;
  grid = assignSlot(
    grid, 'Z', 'factory-queue-combat', 'Собрать танк',
    queueEnabled ? 'enabled' : 'disabled',
    queueEnabled ? '' : productionBlockLabel(blockReason!),
    `${quote.matterCost} M · ${quote.elementCost} E · ${formatProductionDuration(quote.durationMs)}`,
    queueEnabled
      ? `${quote.displayNameRu}: поставить в очередь  [Z]`
      : `${quote.displayNameRu}: ${productionBlockLabel(blockReason!)}  [Z]`,
    'produce',
  );

  const builderDesc = produceCommandDesc('builder', state, factoryTarget);
  grid = assignSlot(grid, 'X', builderDesc.id, 'Строитель', builderDesc.state === 'enabled' ? 'enabled' : 'disabled', builderDesc.disabledReason, builderDesc.cost, builderDesc.tooltip, 'produce');
  const harvesterDesc = produceCommandDesc('harvester', state, factoryTarget);
  grid = assignSlot(grid, 'C', harvesterDesc.id, 'Сборщик', harvesterDesc.state === 'enabled' ? 'enabled' : 'disabled', harvesterDesc.disabledReason, harvesterDesc.cost, harvesterDesc.tooltip, 'produce');

  const canCancel = (factory?.queue.length ?? 0) > 0;
  const firstItem = factory?.queue[0];
  grid = assignSlot(
    grid, 'V', 'factory-cancel-first', 'Отменить заказ',
    canCancel ? 'enabled' : 'disabled',
    canCancel ? '' : 'Очередь пуста',
    firstItem ? getQueueItemDisplayName(firstItem) : '',
    canCancel ? `Отменить первый заказ: ${getQueueItemDisplayName(firstItem!)}  [V]` : 'Очередь пуста  [V]',
    'building-action',
  );

  return grid;
}

function factoryContextLabel(
  state: GameState,
  selection: UnitSelection,
  composer: FactoryComposerState,
): string {
  const primary = getPrimarySelection(selection);
  if (!primary || primary.kind !== 'building') return 'Фабрика';
  const factory = state.production.factories.find(item => item.tx === primary.tx && item.ty === primary.ty);
  const quote = getFactoryComposerQuote(composer);
  const queue = factory?.queue ?? [];
  const active = queue[0]
    ? ` · сейчас: ${getQueueItemDisplayName(queue[0])} ${Math.round(queue[0].progress * 100)}%`
    : '';
  return `Фабрика · ${quote.displayNameRu} · очередь ${queue.length}/2${active}`;
}

'''
text = text[:start] + new_grid + text[end:]
text = text.replace(
    """export function buildCommandCardViewModel(
  state: GameState,
  selection: UnitSelection,
): CommandCardViewModel {""",
    """export function buildCommandCardViewModel(
  state: GameState,
  selection: UnitSelection,
  composer: FactoryComposerState = DEFAULT_FACTORY_COMPOSER_STATE,
): CommandCardViewModel {""",
    1,
)
text = text.replace(
    """  // NOTE: Building selection (contextKind: 'building') is not yet wired
  // because UnitSelection does not support building selections.
  // When building selection is added, call buildingGrid(state) here.
  // See buildingGrid() above for the factory production grid layout.

  return {""",
    """  if (isBuildingSelected(selection)) {
    const primary = getPrimarySelection(selection);
    if (primary?.kind === 'building' && primary.buildingType === 'units-factory') {
      return {
        contextKind: 'building',
        contextLabel: factoryContextLabel(state, selection, composer),
        slots: buildingGrid(state, selection, composer),
      };
    }
  }

  return {""",
    1,
)
text = text.replace(
    """export function produceCommandDesc(
  unitType: ProducibleUnitType,
  state: GameState,
): CommandDescriptor {""",
    """export function produceCommandDesc(
  unitType: ProducibleUnitType,
  state: GameState,
  factoryTarget?: { tx: number; ty: number },
): CommandDescriptor {""",
    1,
)
text = text.replace(
    "const blockReason = getProductionBlockReason(state, unitType);",
    "const blockReason = getProductionBlockReason(state, unitType, factoryTarget);",
    1,
)
text = text.replace(
    """  if (contextKind === 'harvester') {
    if (commandId === 'unit-stop') return STOP_SLOT;
  }

  return undefined;""",
    """  if (contextKind === 'harvester') {
    if (commandId === 'unit-stop') return STOP_SLOT;
  }
  if (contextKind === 'building') {
    const factorySlots: Record<string, SlotKey> = {
      'factory-body-wasp': 'Q', 'factory-body-hunter': 'W',
      'factory-weapon-smoky': 'A', 'factory-weapon-railgun': 'S',
      'factory-queue-combat': 'Z', 'produce-builder': 'X',
      'produce-harvester': 'C', 'factory-cancel-first': 'V',
    };
    return factorySlots[commandId];
  }

  return undefined;""",
    1,
)
command_vm.write_text(text, encoding="utf-8")

# HUD accepts the ephemeral composer snapshot and refreshes when labels/costs change.
replace_once(
    "src/phaser/ui/hud/HudCommandPanel.ts",
    "import type { UnitSelection } from '../../../state/unitSelection';",
    "import type { UnitSelection } from '../../../state/unitSelection';\nimport type { FactoryComposerState } from '../../../state/factoryComposer';",
)
replace_once(
    "src/phaser/ui/hud/HudCommandPanel.ts",
    """  update(state: GameState, selection: UnitSelection): void {
    const vm = buildCommandCardViewModel(state, selection);""",
    """  update(state: GameState, selection: UnitSelection, composer?: FactoryComposerState): void {
    const vm = buildCommandCardViewModel(state, selection, composer);""",
)
replace_once(
    "src/phaser/ui/hud/HudCommandPanel.ts",
    """    if (a.contextKind !== b.contextKind) return false;
    // Check if any slot's command or state changed""",
    """    if (a.contextKind !== b.contextKind || a.contextLabel !== b.contextLabel) return false;
    // Check all player-visible fields so composer and queue updates repaint immediately.""",
)
replace_once(
    "src/phaser/ui/hud/HudCommandPanel.ts",
    """      if (a.slots[i].state !== b.slots[i].state) return false;
      if (a.slots[i].disabledReason !== b.slots[i].disabledReason) return false;""",
    """      if (a.slots[i].state !== b.slots[i].state) return false;
      if (a.slots[i].label !== b.slots[i].label) return false;
      if (a.slots[i].cost !== b.slots[i].cost) return false;
      if (a.slots[i].tooltip !== b.slots[i].tooltip) return false;
      if (a.slots[i].disabledReason !== b.slots[i].disabledReason) return false;""",
)
replace_once(
    "src/phaser/ui/hud/VisualHudCore.ts",
    "import type { UnitSelection } from '../../../state/unitSelection';",
    "import type { UnitSelection } from '../../../state/unitSelection';\nimport type { FactoryComposerState } from '../../../state/factoryComposer';",
)
replace_once(
    "src/phaser/ui/hud/VisualHudCore.ts",
    """  update(
    state: GameState,
    cameraData: MinimapCameraData | null = null,
    offset: MinimapOffset = { x: 0, y: 0 },
  ): void {""",
    """  update(
    state: GameState,
    cameraData: MinimapCameraData | null = null,
    offset: MinimapOffset = { x: 0, y: 0 },
    composer?: FactoryComposerState,
  ): void {""",
)
replace_once(
    "src/phaser/ui/hud/VisualHudCore.ts",
    "this.commandPanel.update(state, this.currentSelection);",
    "this.commandPanel.update(state, this.currentSelection, composer);",
)

# Selection panel now describes factories rather than returning empty UI.
replace_once(
    "src/phaser/ui/hud/selectionViewModel.ts",
    "import type { GameState, BuilderPlacement, HarvesterState } from '../../../state/types';",
    "import type { GameState, BuilderPlacement, HarvesterState } from '../../../state/types';\nimport { getBuildingDisplayName } from '../../../config/buildingRuntimeMapping';",
)
replace_once(
    "src/phaser/ui/hud/selectionViewModel.ts",
    "import { isUnitSelected, isBuilderSelected, isHarvesterSelected, getSelectionTypeBreakdown, getPrimarySelection } from '../../../state/unitSelection';",
    "import { isUnitSelected, isBuilderSelected, isHarvesterSelected, isBuildingSelected, getSelectionTypeBreakdown, getPrimarySelection } from '../../../state/unitSelection';",
)
replace_once(
    "src/phaser/ui/hud/selectionViewModel.ts",
    """  if (isHarvesterSelected(selection)) {
    const primary = getPrimarySelection(selection);""",
    """  if (isBuildingSelected(selection)) {
    const primary = getPrimarySelection(selection);
    if (!primary || primary.kind !== 'building') return EMPTY_SELECTION;
    const factory = primary.buildingType === 'units-factory'
      ? state.production.factories.find(item => item.tx === primary.tx && item.ty === primary.ty)
      : undefined;
    return {
      hasSelection: true,
      name: getBuildingDisplayName(primary.buildingType) ?? primary.buildingType,
      kind: 'building',
      faction: state.playerFaction,
      hpCurrent: null,
      hpMax: null,
      status: primary.buildingType === 'units-factory'
        ? `Очередь: ${factory?.queue.length ?? 0}/2`
        : 'Готово',
      count: 1,
      typeBreakdown: '',
    };
  }

  if (isHarvesterSelected(selection)) {
    const primary = getPrimarySelection(selection);""",
)

# Input controller owns composer state and exact selected-factory actions.
input_path = ROOT / "src/phaser/input/GameInputController.ts"
text = input_path.read_text(encoding="utf-8")
text = text.replace(
    "import type { GameState, BuildingType, ProducibleUnitType } from '../../state/types';",
    "import type { GameState, BuildingType } from '../../state/types';",
    1,
)
text = text.replace(
    "import { placeConstructionSite } from '../../state/construction';",
    "import { BUILDING_CONFIG, placeConstructionSite } from '../../state/construction';",
    1,
)
text = text.replace(
    "import { startUnitProduction, cancelFactoryQueueItem } from '../../state/production';",
    "import { startUnitProduction, cancelFactoryQueueItem, getProductionQuote, type ProductionRequestInput } from '../../state/production';",
    1,
)
text = text.replace(
    """  clearSelection, isUnitSelected,
  selectMany, getSelectionTypeBreakdown,
  hasHarvesterInSelection, getSelectionCenterTile,
""",
    """  clearSelection, isUnitSelected,
  selectMany, getSelectionTypeBreakdown,
  hasHarvesterInSelection, getSelectionCenterTile, getPrimarySelection, getBuildingSelectionId,
""",
    1,
)
text = text.replace(
    "import { controlGroupAssigned, controlGroupEmpty, controlGroupRecalled, constructionStarted, buildFailureFeedback } from '../../state/feedbackHelpers';",
    "import { controlGroupAssigned, controlGroupEmpty, controlGroupRecalled, constructionStarted, buildFailureFeedback } from '../../state/feedbackHelpers';\nimport { DEFAULT_FACTORY_COMPOSER_STATE, createFactoryComposerRequest, getFactoryComposerQuote, reduceFactoryComposer, type FactoryComposerCommandId, type FactoryComposerState } from '../../state/factoryComposer';",
    1,
)
text = text.replace(
    """  // SELECTION-CONTROL-GROUPS-05: Multi-selection state
  private selection: UnitSelection = null;
""",
    """  // SELECTION-CONTROL-GROUPS-05: Multi-selection state
  private selection: UnitSelection = null;

  /** Ephemeral factory composer choice; not persisted in GameState. */
  private factoryComposer: FactoryComposerState = { ...DEFAULT_FACTORY_COMPOSER_STATE };
""",
    1,
)
wire_anchor = """    const unitStop = commandRegistry.get('unit-stop');
"""
wire_code = r'''    const composerCommands: FactoryComposerCommandId[] = [
      'factory-body-wasp', 'factory-body-hunter',
      'factory-weapon-smoky', 'factory-weapon-railgun',
    ];
    for (const commandId of composerCommands) {
      const command = commandRegistry.get(commandId);
      if (command) command.execute = () => {
        this.factoryComposer = reduceFactoryComposer(this.factoryComposer, commandId);
        const quote = getFactoryComposerQuote(this.factoryComposer);
        this.showStatusCb(`Выбрано: ${quote.displayNameRu}`, true);
      };
    }

    const queueCombat = commandRegistry.get('factory-queue-combat');
    if (queueCombat) queueCombat.execute = () => {
      const result = this.requestQueueUnit(createFactoryComposerRequest(this.factoryComposer));
      this.showStatusCb(result.message, result.success);
    };

    const cancelFirst = commandRegistry.get('factory-cancel-first');
    if (cancelFirst) cancelFirst.execute = () => {
      const selectedFactory = this.getSelectedFactory();
      if (!selectedFactory) {
        this.showStatusCb('Фабрика не выбрана', false);
        return;
      }
      const result = cancelFactoryQueueItem(this.getGameState(), selectedFactory.tx, selectedFactory.ty, 0);
      this.showStatusCb(result.ok ? 'Первый заказ отменён' : result.reason, result.ok);
    };

'''
if wire_anchor not in text: raise SystemExit('unit stop wire anchor missing')
text = text.replace(wire_anchor, wire_code + wire_anchor, 1)
old_request = r'''  requestQueueUnit(unitType: ProducibleUnitType): ProductionRequestResult {
    const gameState = this.getGameState();

    const factory = gameState.production.factories[0];
    if (!factory) {
      return { success: false, message: 'no completed units-factory' };
    }

    const result = startUnitProduction(gameState, factory.tx, factory.ty, unitType);
    if (result.ok) {
      console.log(`[GameScene] ${unitType} queued at factory (${factory.tx},${factory.ty})`);
      return { success: true, message: `${unitType} queued` };
    } else {
      console.info(`[GameScene] ${unitType} queue failed: ${result.reason}`);
      return { success: false, message: result.reason };
    }
  }
'''
new_request = r'''  requestQueueUnit(input: ProductionRequestInput): ProductionRequestResult {
    const gameState = this.getGameState();
    const factory = this.getSelectedFactory() ?? gameState.production.factories[0];
    if (!factory) return { success: false, message: 'Нет готовой фабрики' };

    const quote = getProductionQuote(input);
    if (!quote) return { success: false, message: 'Недоступная комбинация' };
    const result = startUnitProduction(gameState, factory.tx, factory.ty, input);
    if (result.ok) {
      console.log(`[GameScene] ${quote.displayNameRu} queued at factory (${factory.tx},${factory.ty})`);
      return { success: true, message: `${quote.displayNameRu}: добавлено в очередь` };
    }
    console.info(`[GameScene] ${quote.displayNameRu} queue failed: ${result.reason}`);
    return { success: false, message: result.reason };
  }

  private getSelectedFactory(): GameState['production']['factories'][number] | null {
    const primary = getPrimarySelection(this.selection);
    if (!primary || primary.kind !== 'building' || primary.buildingType !== 'units-factory') return null;
    return this.getGameState().production.factories.find(factory =>
      factory.tx === primary.tx && factory.ty === primary.ty,
    ) ?? null;
  }
'''
if old_request not in text: raise SystemExit('requestQueueUnit block missing')
text = text.replace(old_request, new_request, 1)
text = text.replace(
    """  getSelection(): UnitSelection {
    return this.selection;
  }
""",
    """  getSelection(): UnitSelection {
    return this.selection;
  }

  getFactoryComposerState(): FactoryComposerState {
    return { ...this.factoryComposer };
  }
""",
    1,
)
# Building hit-test helper before detectClickTarget.
detect_anchor = "  private detectClickTarget(pointer: Phaser.Input.Pointer): ClickTarget {"
helper = r'''  private findOwnedBuildingTarget(
    state: GameState,
    clickTx: number,
    clickTy: number,
  ): ClickTarget | null {
    for (let index = state.mapData.buildings.length - 1; index >= 0; index--) {
      const building = state.mapData.buildings[index];
      const config = BUILDING_CONFIG[building.type];
      const width = config?.footprintW ?? 1;
      const height = config?.footprintH ?? 1;
      if (clickTx >= building.tx && clickTx < building.tx + width && clickTy >= building.ty && clickTy < building.ty + height) {
        return {
          kind: 'own-building',
          id: getBuildingSelectionId(building.type, building.tx, building.ty),
          buildingType: building.type,
          tx: building.tx,
          ty: building.ty,
        };
      }
    }
    return null;
  }

'''
if detect_anchor not in text: raise SystemExit('detect anchor missing')
text = text.replace(detect_anchor, helper + detect_anchor, 1)
building_detection_anchor = """    // Check enemy production combat units.
"""
text = text.replace(
    building_detection_anchor,
    """    const buildingTarget = this.findOwnedBuildingTarget(gameState, clickTx, clickTy);
    if (buildingTarget) return buildingTarget;

    // Check enemy production combat units.
""",
    1,
)
# Hover building before enemy target loop.
hover_anchor = """    if (!hoverTarget) {
      for (const unit of gameState.combatUnits) {
        if (unit.faction === gameState.playerFaction || unit.runtime?.isDestroyed) continue;
"""
text = text.replace(
    hover_anchor,
    """    if (!hoverTarget) {
      hoverTarget = this.findOwnedBuildingTarget(gameState, clickTx, clickTy);
    }

    if (!hoverTarget) {
      for (const unit of gameState.combatUnits) {
        if (unit.faction === gameState.playerFaction || unit.runtime?.isDestroyed) continue;
""",
    1,
)
text = text.replace(
    "const vm = buildCommandCardViewModel(gameState, this.selection);",
    "const vm = buildCommandCardViewModel(gameState, this.selection, this.factoryComposer);",
)
# Single selection status includes buildings.
text = text.replace(
    """      const label = primary.kind === 'builder'
        ? `Builder ${primary.id}`
        : primary.kind === 'harvester'
          ? `Harvester ${primary.id}`
          : `Tank ${primary.id}`;""",
    """      const label = primary.kind === 'builder'
        ? `Builder ${primary.id}`
        : primary.kind === 'harvester'
          ? `Harvester ${primary.id}`
          : primary.kind === 'combat'
            ? `Tank ${primary.id}`
            : primary.buildingType === 'units-factory' ? 'Фабрика юнитов' : primary.buildingType;""",
    1,
)
# Multi breakdown building count.
text = text.replace(
    """      const cc = breakdown.get('combat') ?? 0;
      if (bc > 0) parts.push(`${bc} Builder${bc > 1 ? 's' : ''}`);""",
    """      const cc = breakdown.get('combat') ?? 0;
      const fc = breakdown.get('building') ?? 0;
      if (bc > 0) parts.push(`${bc} Builder${bc > 1 ? 's' : ''}`);""",
    1,
)
text = text.replace(
    """      if (cc > 0) parts.push(`${cc} Tank${cc > 1 ? 's' : ''}`);
      this.showStatusCb""",
    """      if (cc > 0) parts.push(`${cc} Tank${cc > 1 ? 's' : ''}`);
      if (fc > 0) parts.push(`${fc} Building${fc > 1 ? 's' : ''}`);
      this.showStatusCb""",
    1,
)
# Highlight buildings and combat units.
text = text.replace(
    """      } else {
        continue;
      }

      this.selectionHighlight.strokeCircle""",
    """      } else if (unit.kind === 'combat') {
        const combat = gameState.combatUnits.find(candidate => candidate.id === unit.id && !candidate.runtime?.isDestroyed);
        if (!combat) continue;
        const screenPos = tileToScreen(combat.runtime?.ftx ?? combat.tx, combat.runtime?.fty ?? combat.ty);
        ringX = screenPos.x + this.offset.x;
        ringY = screenPos.y + this.offset.y;
      } else if (unit.kind === 'building') {
        const config = BUILDING_CONFIG[unit.buildingType];
        const screenPos = tileToScreen(unit.tx + (config?.footprintW ?? 1) / 2, unit.ty + (config?.footprintH ?? 1) / 2);
        ringX = screenPos.x + this.offset.x;
        ringY = screenPos.y + this.offset.y;
      } else {
        continue;
      }

      this.selectionHighlight.strokeCircle""",
    1,
)
input_path.write_text(text, encoding="utf-8")

# Feed composer state into the active HUD.
replace_once(
    "src/phaser/GameScene.ts",
    "this.visualHudCore.update(this.gameState, cameraData, offset);",
    "this.visualHudCore.update(this.gameState, cameraData, offset, this.inputController?.getFactoryComposerState());",
)

# Focused behavior tests.
(ROOT / "src/__tests__/factoryComposerUi.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/createInitialState';
import {
  DEFAULT_FACTORY_COMPOSER_STATE,
  createFactoryComposerRequest,
  getFactoryComposerQuote,
  reduceFactoryComposer,
} from '../state/factoryComposer';
import { routeLmbClick, routeRmbClick, routeSKey } from '../state/commandRouter';
import { buildCommandCardViewModel } from '../phaser/ui/hud/commandPanelViewModel';
import { buildSelectionViewModel } from '../phaser/ui/hud/selectionViewModel';
import { getBuildingSelectionId, selectOne } from '../state/unitSelection';
import type { MapData } from '../state/types';

function makeState() {
  const map: MapData = {
    width: 24,
    height: 24,
    terrain: Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 18, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], builders: [], constructionSites: [],
    buildings: [{ tx: 8, ty: 8, type: 'units-factory' }],
  };
  const state = createInitialState(map, 'cyan');
  state.harvesters = [];
  state.extraHarvesters = [];
  state.combatUnits = [];
  state.economy.matter = 500;
  state.economy.elements.cyan = 200;
  return state;
}

function factorySelection() {
  return selectOne({
    kind: 'building' as const,
    id: getBuildingSelectionId('units-factory', 8, 8),
    buildingType: 'units-factory' as const,
    tx: 8,
    ty: 8,
  });
}

describe('SKIRMISH-P3B factory composer state', () => {
  it('selects hull and turret independently and creates a structured M0 request', () => {
    let composer = { ...DEFAULT_FACTORY_COMPOSER_STATE };
    composer = reduceFactoryComposer(composer, 'factory-body-hunter');
    composer = reduceFactoryComposer(composer, 'factory-weapon-railgun');
    expect(composer).toEqual({ bodyId: 'hunter', weaponId: 'railgun' });
    expect(createFactoryComposerRequest(composer)).toEqual({
      kind: 'combat', bodyId: 'hunter', weaponId: 'railgun', hullMod: 'm0', turretMod: 'm0',
    });
    expect(getFactoryComposerQuote(composer)).toMatchObject({ matterCost: 80, elementCost: 15, durationMs: 32_000 });
  });
});

describe('SKIRMISH-P3B building selection', () => {
  it('routes a completed factory click to a building selection', () => {
    const result = routeLmbClick({
      kind: 'own-building', id: getBuildingSelectionId('units-factory', 8, 8),
      buildingType: 'units-factory', tx: 8, ty: 8,
    }, null);
    expect(result.action).toBe('select');
    if (result.action === 'select') expect(result.selection?.units[0]).toMatchObject({ kind: 'building', buildingType: 'units-factory', tx: 8, ty: 8 });
  });

  it('does not route move or stop commands for a building-only selection', () => {
    const selection = factorySelection();
    expect(routeRmbClick({ kind: 'ground', tx: 12, ty: 12 }, selection)).toEqual({ action: 'no-op', reason: 'building-selected' });
    expect(routeSKey(selection)).toEqual({ action: 'no-op' });
  });
});

describe('SKIRMISH-P3B active command card', () => {
  it('shows the selected combination, exact quote and contextual factory actions', () => {
    const state = makeState();
    const composer = { bodyId: 'hunter' as const, weaponId: 'railgun' as const };
    const vm = buildCommandCardViewModel(state, factorySelection(), composer);
    expect(vm.contextKind).toBe('building');
    expect(vm.contextLabel).toContain('Хантер + Рельса');
    expect(vm.contextLabel).toContain('очередь 0/2');
    const slots = Object.fromEntries(vm.slots.map(slot => [slot.slotKey, slot]));
    expect(slots.Q.label).toBe('○ Васп');
    expect(slots.W.label).toBe('● Хантер');
    expect(slots.A.label).toBe('○ Смоки');
    expect(slots.S.label).toBe('● Рельса');
    expect(slots.Z).toMatchObject({ commandId: 'factory-queue-combat', state: 'enabled', cost: '80 M · 15 E · 32 с' });
    expect(slots.X.commandId).toBe('produce-builder');
    expect(slots.C.commandId).toBe('produce-harvester');
    expect(slots.V).toMatchObject({ commandId: 'factory-cancel-first', state: 'disabled' });
  });

  it('shows selected factory queue progress and enables cancellation', () => {
    const state = makeState();
    state.production.factories[0].queue.push({
      unitType: 'wasp-smoky',
      request: createFactoryComposerRequest({ bodyId: 'wasp', weaponId: 'smoky' }),
      elapsedMs: 12_500, durationMs: 25_000, progress: 0.5, completed: false,
    });
    const vm = buildCommandCardViewModel(state, factorySelection(), DEFAULT_FACTORY_COMPOSER_STATE);
    expect(vm.contextLabel).toContain('сейчас: Васп + Смоки 50%');
    expect(vm.slots.find(slot => slot.slotKey === 'V')).toMatchObject({ state: 'enabled', cost: 'Васп + Смоки' });
  });

  it('renders factory details in the selection panel', () => {
    const state = makeState();
    expect(buildSelectionViewModel(state, factorySelection())).toMatchObject({
      hasSelection: true, kind: 'building', status: 'Очередь: 0/2',
    });
  });
});
''', encoding="utf-8")
