from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'{label}: marker not found')
    return text.replace(old, new, 1)


# ── teamOwnership.ts: expose missing/foreign/human control resolution ──
path = 'src/state/teamOwnership.ts'
text = read(path)
text = replace_once(
    text,
    "/** Resolve a selection reference to live state and verify human control. */\nexport function isSelectableUnitHumanOwned(\n  state: GameState,\n  unit: SelectableUnit,\n): boolean {\n  if (unit.kind === 'builder') {\n    const builder = state.mapData.builders.find(candidate => candidate.id === unit.id);\n    return !!builder && isHumanOwned(state, builder);\n  }\n  if (unit.kind === 'harvester') {\n    const harvester = state.harvesters.find(candidate => candidate.id === unit.id);\n    return !!harvester && isHumanOwned(state, harvester);\n  }\n  if (unit.kind === 'combat') {\n    const combat = state.combatUnits.find(candidate => candidate.id === unit.id);\n    return !!combat && !combat.runtime?.isDestroyed && isHumanOwned(state, combat);\n  }\n\n  const building = state.mapData.buildings.find(candidate =>\n    candidate.type === unit.buildingType\n    && candidate.tx === unit.tx\n    && candidate.ty === unit.ty,\n  );\n  return !!building && isHumanOwned(state, building);\n}\n",
    "/** Resolve a selection reference to live state and distinguish missing from foreign. */\n"
    "export function getSelectableUnitControl(\n"
    "  state: GameState,\n"
    "  unit: SelectableUnit,\n"
    "): 'human' | 'foreign' | 'missing' {\n"
    "  let entity: OwnedEntityRef | undefined;\n"
    "  if (unit.kind === 'builder') {\n"
    "    entity = state.mapData.builders.find(candidate => candidate.id === unit.id);\n"
    "  } else if (unit.kind === 'harvester') {\n"
    "    entity = state.harvesters.find(candidate => candidate.id === unit.id);\n"
    "  } else if (unit.kind === 'combat') {\n"
    "    const combat = state.combatUnits.find(candidate => candidate.id === unit.id);\n"
    "    if (!combat || combat.runtime?.isDestroyed) return 'missing';\n"
    "    entity = combat;\n"
    "  } else {\n"
    "    entity = state.mapData.buildings.find(candidate =>\n"
    "      candidate.type === unit.buildingType\n"
    "      && candidate.tx === unit.tx\n"
    "      && candidate.ty === unit.ty,\n"
    "    );\n"
    "  }\n"
    "  if (!entity) return 'missing';\n"
    "  return isHumanOwned(state, entity) ? 'human' : 'foreign';\n"
    "}\n\n"
    "export function isSelectableUnitHumanOwned(\n"
    "  state: GameState,\n"
    "  unit: SelectableUnit,\n"
    "): boolean {\n"
    "  return getSelectableUnitControl(state, unit) === 'human';\n"
    "}\n",
    'team ownership selectable control',
)
write(path, text)


# ── unitSelection.ts: prune foreign entries as well as missing ones ───
path = 'src/state/unitSelection.ts'
text = read(path)
text = replace_once(
    text,
    "import type { BuildingType, GameState } from './types';",
    "import type { BuildingType, GameState } from './types';\n"
    "import { isSelectableUnitHumanOwned } from './teamOwnership';",
    'unit selection ownership import',
)
old_filter = """  const remaining = selection.units.filter(u => {
    if (u.kind === 'builder') {
      return state.mapData.builders.some(b => b.id === u.id);
    } else if (u.kind === 'harvester') {
      return state.harvesters.some(h => h.id === u.id);
    } else if (u.kind === 'combat') {
      return state.combatUnits.some(unit => unit.id === u.id && !unit.runtime?.isDestroyed);
    } else if (u.kind === 'building') {
      return state.mapData.buildings.some(building =>
        building.type === u.buildingType && building.tx === u.tx && building.ty === u.ty,
      );
    }
    return false;
  });"""
text = replace_once(
    text,
    old_filter,
    "  const remaining = selection.units.filter(unit => isSelectableUnitHumanOwned(state, unit));",
    'selection prune ownership',
)
write(path, text)


# ── unitCommands.ts: player movement/stop reject explicit foreign units ──
path = 'src/state/unitCommands.ts'
text = read(path)
text = replace_once(
    text,
    "import { issueCombatUnitMove, stopCombatUnit } from './combatUnitMovement';",
    "import { issueCombatUnitMove, stopCombatUnit } from './combatUnitMovement';\n"
    "import { getSelectableUnitControl } from './teamOwnership';",
    'unit commands ownership import',
)
text = replace_once(
    text,
    "| { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' | 'target-impassable' | 'target-occupied' | 'no-path' | 'unit-busy' };",
    "| { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' | 'not-owner' | 'target-impassable' | 'target-occupied' | 'no-path' | 'unit-busy' };",
    'move reason owner',
)
text = replace_once(
    text,
    "): MoveResult {\n  const occupancy = buildOccupancyMap(state);",
    "): MoveResult {\n  const control = getSelectableUnitControl(state, unit);\n"
    "  if (control === 'foreign') return { ok: false, reason: 'not-owner' };\n"
    "  if (control === 'missing') return { ok: false, reason: 'no-unit-selected' };\n\n"
    "  const occupancy = buildOccupancyMap(state);",
    'move ownership gate',
)
text = replace_once(
    text,
    "| { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' | 'unit-busy' };",
    "| { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' | 'not-owner' | 'unit-busy' };",
    'stop reason owner',
)
text = replace_once(
    text,
    "): StopResult {\n  if (unit.kind === 'harvester') {",
    "): StopResult {\n  const control = getSelectableUnitControl(state, unit);\n"
    "  if (control === 'foreign') return { ok: false, reason: 'not-owner' };\n"
    "  if (control === 'missing') return { ok: false, reason: 'no-unit-selected' };\n\n"
    "  if (unit.kind === 'harvester') {",
    'stop ownership gate',
)
write(path, text)


# ── combatUnitCombat.ts: player wrapper without restricting AI/runtime ──
path = 'src/state/combatUnitCombat.ts'
text = read(path)
text = replace_once(
    text,
    "import { findPathToAdjacent } from './pathfinding';",
    "import { findPathToAdjacent } from './pathfinding';\n"
    "import { isHumanOwned } from './teamOwnership';",
    'combat ownership import',
)
text = replace_once(
    text,
    "export interface CombatDamageResult {",
    "export type PlayerCombatAttackResult = CombatAttackResult\n"
    "  | { ok: false; reason: 'not-owner' };\n\n"
    "export interface CombatDamageResult {",
    'player attack result type',
)
text = replace_once(
    text,
    "export function issueCombatUnitAttack(\n",
    "/** Player-facing attack command. AI/runtime code continues to use issueCombatUnitAttack. */\n"
    "export function issuePlayerCombatUnitAttack(\n"
    "  state: GameState,\n"
    "  attackerId: string,\n"
    "  targetId: string,\n"
    "): PlayerCombatAttackResult {\n"
    "  const attacker = state.combatUnits.find(unit => unit.id === attackerId);\n"
    "  if (!attacker) return { ok: false, reason: 'attacker-not-found' };\n"
    "  if (!isHumanOwned(state, attacker)) return { ok: false, reason: 'not-owner' };\n"
    "  const target = state.combatUnits.find(unit => unit.id === targetId);\n"
    "  if (target && isHumanOwned(state, target)) return { ok: false, reason: 'friendly-target' };\n"
    "  return issueCombatUnitAttack(state, attackerId, targetId);\n"
    "}\n\n"
    "export function issueCombatUnitAttack(\n",
    'player attack wrapper',
)
write(path, text)


# ── buildSiteSelection.ts: only own structures are proximity anchors ──
path = 'src/state/buildSiteSelection.ts'
text = read(path)
text = replace_once(
    text,
    "import type { GameState, BuildingType } from './types';",
    "import type { GameState, BuildingType, TeamId } from './types';\n"
    "import { ensureMatchState } from './matchState';\n"
    "import { isHumanOwned } from './teamOwnership';",
    'build site ownership imports',
)
text = replace_once(
    text,
    "function collectAnchors(state: GameState): Array<{ tx: number; ty: number }> {",
    "function collectAnchors(\n  state: GameState,\n  ownerTeamId: TeamId,\n): Array<{ tx: number; ty: number }> {",
    'anchor owner signature',
)
text = replace_once(
    text,
    "  // HQ center\n  anchors.push({\n    tx: state.mapData.hq.tx + 1,\n    ty: state.mapData.hq.ty + 1,\n  });",
    "  // HQ center — only the requesting team's HQ is an anchor.\n"
    "  if ((state.mapData.hq.ownerTeamId ?? ownerTeamId) === ownerTeamId) {\n"
    "    anchors.push({\n"
    "      tx: state.mapData.hq.tx + 1,\n"
    "      ty: state.mapData.hq.ty + 1,\n"
    "    });\n"
    "  }",
    'hq anchor filter',
)
text = replace_once(
    text,
    "  for (const b of state.mapData.buildings) {\n    const config",
    "  for (const b of state.mapData.buildings) {\n"
    "    if ((b.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;\n"
    "    const config",
    'building anchor filter',
)
text = replace_once(
    text,
    "  for (const c of state.mapData.constructionSites) {\n    const config",
    "  for (const c of state.mapData.constructionSites) {\n"
    "    if ((c.ownerTeamId ?? ownerTeamId) !== ownerTeamId) continue;\n"
    "    const config",
    'site anchor filter',
)
text = replace_once(
    text,
    "  options?: Partial<BuildSiteSearchOptions>,\n): BuildSiteResult {",
    "  options?: Partial<BuildSiteSearchOptions>,\n  ownerTeamId?: TeamId,\n): BuildSiteResult {",
    'build site owner parameter',
)
text = replace_once(
    text,
    "  const gapTiles = options?.gapTiles ?? DEFAULT_OPTIONS.gapTiles;\n  const maxRadius = options?.maxRadius ?? DEFAULT_OPTIONS.maxRadius;\n\n  // 2. Collect anchors and footprints\n  const anchors = collectAnchors(state);",
    "  const gapTiles = options?.gapTiles ?? DEFAULT_OPTIONS.gapTiles;\n"
    "  const maxRadius = options?.maxRadius ?? DEFAULT_OPTIONS.maxRadius;\n"
    "  const match = ensureMatchState(state);\n"
    "  const resolvedOwnerTeamId = ownerTeamId ?? match.humanTeamId;\n\n"
    "  // 2. Collect anchors and footprints\n"
    "  const anchors = collectAnchors(state, resolvedOwnerTeamId);\n"
    "  if (anchors.length === 0) return { ok: false, reason: 'no-valid-site' };",
    'build site resolve owner',
)
text = replace_once(
    text,
    "    const placement = canPlaceBuilding(state, buildingType, candidate.tx, candidate.ty);",
    "    const placement = canPlaceBuilding(\n"
    "      state, buildingType, candidate.tx, candidate.ty, resolvedOwnerTeamId,\n"
    "    );",
    'build site placement owner',
)
# remove accidentally unused import if marker exists in generated source
text = text.replace("import { isHumanOwned } from './teamOwnership';\n", '')
write(path, text)


# ── GameInputController.ts: filter selection, factories and build commands ──
path = 'src/phaser/input/GameInputController.ts'
text = read(path)
text = replace_once(
    text,
    "  hasHarvesterInSelection, getSelectionCenterTile, getPrimarySelection, getBuildingSelectionId,\n} from '../../state/unitSelection';",
    "  hasHarvesterInSelection, getSelectionCenterTile, getPrimarySelection, getBuildingSelectionId,\n"
    "  pruneMissingEntities,\n"
    "} from '../../state/unitSelection';",
    'input selection prune import',
)
text = replace_once(
    text,
    "import { issueCombatUnitAttack } from '../../state/combatUnitCombat';",
    "import { issuePlayerCombatUnitAttack } from '../../state/combatUnitCombat';",
    'input player attack import',
)
text = replace_once(
    text,
    "import { DEFAULT_FACTORY_COMPOSER_STATE, createFactoryComposerRequest, getFactoryComposerQuote, reduceFactoryComposer, type FactoryComposerCommandId, type FactoryComposerState } from '../../state/factoryComposer';",
    "import { DEFAULT_FACTORY_COMPOSER_STATE, createFactoryComposerRequest, getFactoryComposerQuote, reduceFactoryComposer, type FactoryComposerCommandId, type FactoryComposerState } from '../../state/factoryComposer';\n"
    "import { ensureMatchState } from '../../state/matchState';\n"
    "import { isHumanOwned } from '../../state/teamOwnership';",
    'input ownership imports',
)
text = replace_once(
    text,
    "  update(): void {\n    this.updateSelectionHighlight();",
    "  update(): void {\n    this.selection = pruneMissingEntities(this.selection, this.getGameState());\n"
    "    this.updateSelectionHighlight();",
    'input update prune',
)
text = replace_once(
    text,
    "    const idleBuilders = gameState.mapData.builders.filter(b => b.phase === 'idle' && !b.busy).length;\n    // Count idle harvesters\n    const idleHarvesters = gameState.harvesters.filter(h => h.phase === 'idle').length;",
    "    const idleBuilders = gameState.mapData.builders.filter(\n"
    "      builder => isHumanOwned(gameState, builder) && builder.phase === 'idle' && !builder.busy,\n"
    "    ).length;\n"
    "    // Count idle harvesters\n"
    "    const idleHarvesters = gameState.harvesters.filter(\n"
    "      harvester => isHumanOwned(gameState, harvester) && harvester.phase === 'idle',\n"
    "    ).length;",
    'idle worker ownership',
)
text = replace_once(
    text,
    "    const hasIdleBuilder = gameState.mapData.builders.some(b => b.phase === 'idle' && !b.busy);",
    "    const match = ensureMatchState(gameState);\n"
    "    const hasIdleBuilder = gameState.mapData.builders.some(\n"
    "      builder => isHumanOwned(gameState, builder) && builder.phase === 'idle' && !builder.busy,\n"
    "    );",
    'request build owner builder',
)
text = replace_once(
    text,
    "    const site = findBuildSiteNearPlayerBuildings(gameState, buildingType);",
    "    const site = findBuildSiteNearPlayerBuildings(\n"
    "      gameState, buildingType, undefined, match.humanTeamId,\n"
    "    );",
    'request build owner site',
)
text = replace_once(
    text,
    "    const result = placeConstructionSite(gameState, buildingType, site.tx, site.ty);",
    "    const result = placeConstructionSite(\n"
    "      gameState, buildingType, site.tx, site.ty, match.humanTeamId,\n"
    "    );",
    'request build owner placement',
)
text = replace_once(
    text,
    "    const factory = this.getSelectedFactory() ?? gameState.production.factories[0];",
    "    const factory = this.getSelectedFactory()\n"
    "      ?? gameState.production.factories.find(candidate => isHumanOwned(gameState, candidate));",
    'request queue human factory',
)
text = replace_once(
    text,
    "    const factory = gameState.production.factories[factoryIndex];\n    if (!factory) {",
    "    const factory = gameState.production.factories[factoryIndex];\n"
    "    if (factory && !isHumanOwned(gameState, factory)) {\n"
    "      return { success: false, message: 'factory not owned' };\n"
    "    }\n"
    "    if (!factory) {",
    'cancel queue ownership',
)
text = replace_once(
    text,
    "  getSelection(): UnitSelection {\n    return this.selection;\n  }",
    "  getSelection(): UnitSelection {\n"
    "    this.selection = pruneMissingEntities(this.selection, this.getGameState());\n"
    "    return this.selection;\n"
    "  }",
    'get selection prune',
)
# Drag selection filters.
text = replace_once(text, "    for (const b of gameState.mapData.builders) {\n      const worldPos", "    for (const b of gameState.mapData.builders) {\n      if (!isHumanOwned(gameState, b)) continue;\n      const worldPos", 'drag builders owner')
text = replace_once(text, "      if (unit.faction !== gameState.playerFaction || unit.runtime?.isDestroyed) continue;", "      if (!isHumanOwned(gameState, unit) || unit.runtime?.isDestroyed) continue;", 'drag combat owner')
text = replace_once(text, "    for (const h of gameState.harvesters) {\n      const worldPos", "    for (const h of gameState.harvesters) {\n      if (!isHumanOwned(gameState, h)) continue;\n      const worldPos", 'drag harvester owner')
# Double-click filters (next occurrences).
text = replace_once(text, "      for (const b of gameState.mapData.builders) {\n        const worldPos", "      for (const b of gameState.mapData.builders) {\n        if (!isHumanOwned(gameState, b)) continue;\n        const worldPos", 'double builder owner')
text = replace_once(text, "      for (const h of gameState.harvesters) {\n        const worldPos", "      for (const h of gameState.harvesters) {\n        if (!isHumanOwned(gameState, h)) continue;\n        const worldPos", 'double harvester owner')
# Buildings become own/enemy targets based on owner.
text = replace_once(text, "  private findOwnedBuildingTarget(", "  private findBuildingTarget(", 'rename building target method')
text = replace_once(
    text,
    "          kind: 'own-building',",
    "          kind: isHumanOwned(state, building) ? 'own-building' : 'enemy-building',",
    'building target ownership kind',
)
text = text.replace('this.findOwnedBuildingTarget(', 'this.findBuildingTarget(')
# Click detection owner filters.
text = replace_once(text, "    for (const h of gameState.harvesters) {\n      const dx", "    for (const h of gameState.harvesters) {\n      if (!isHumanOwned(gameState, h)) continue;\n      const dx", 'click harvester owner')
text = replace_once(text, "    for (const b of gameState.mapData.builders) {\n      const dx", "    for (const b of gameState.mapData.builders) {\n      if (!isHumanOwned(gameState, b)) continue;\n      const dx", 'click builder owner')
text = replace_once(text, "      if (unit.faction !== gameState.playerFaction || unit.runtime?.isDestroyed) continue;", "      if (!isHumanOwned(gameState, unit) || unit.runtime?.isDestroyed) continue;", 'click own combat owner')
text = replace_once(text, "      if (unit.faction === gameState.playerFaction || unit.runtime?.isDestroyed) continue;", "      if (isHumanOwned(gameState, unit) || unit.runtime?.isDestroyed) continue;", 'click enemy combat owner')
# RMB and command execution always prune stale/foreign selections.
text = replace_once(
    text,
    "  private handleRightClick(pointer: Phaser.Input.Pointer): void {\n    const target = this.detectClickTarget(pointer);",
    "  private handleRightClick(pointer: Phaser.Input.Pointer): void {\n"
    "    this.selection = pruneMissingEntities(this.selection, this.getGameState());\n"
    "    const target = this.detectClickTarget(pointer);",
    'right click prune',
)
text = replace_once(text, "if (issueCombatUnitAttack(state, selected.id, targetId).ok)", "if (issuePlayerCombatUnitAttack(state, selected.id, targetId).ok)", 'player attack command')
# Hover filters: remaining first harvester/builder/combat occurrences in updateCursorFeedback.
text = replace_once(text, "    for (const h of gameState.harvesters) {\n      const dx", "    for (const h of gameState.harvesters) {\n      if (!isHumanOwned(gameState, h)) continue;\n      const dx", 'hover harvester owner')
text = replace_once(text, "      for (const b of gameState.mapData.builders) {\n        const dx", "      for (const b of gameState.mapData.builders) {\n        if (!isHumanOwned(gameState, b)) continue;\n        const dx", 'hover builder owner')
text = replace_once(text, "        if (unit.faction !== gameState.playerFaction || unit.runtime?.isDestroyed) continue;", "        if (!isHumanOwned(gameState, unit) || unit.runtime?.isDestroyed) continue;", 'hover own combat owner')
text = replace_once(text, "        if (unit.faction === gameState.playerFaction || unit.runtime?.isDestroyed) continue;", "        if (isHumanOwned(gameState, unit) || unit.runtime?.isDestroyed) continue;", 'hover enemy combat owner')
# Control groups and hotkeys prune first.
text = replace_once(
    text,
    "    if (ctrlHeld) {\n      // Ctrl+Number: assign current selection to group",
    "    if (ctrlHeld) {\n"
    "      this.selection = pruneMissingEntities(this.selection, gameState);\n"
    "      // Ctrl+Number: assign current selection to group",
    'control group assign prune',
)
text = replace_once(
    text,
    "  private handleStopKey(): void {\n    const routeResult = routeSKey(this.selection);\n    const gameState = this.getGameState();",
    "  private handleStopKey(): void {\n"
    "    const gameState = this.getGameState();\n"
    "    this.selection = pruneMissingEntities(this.selection, gameState);\n"
    "    const routeResult = routeSKey(this.selection);",
    'stop key prune',
)
text = replace_once(
    text,
    "  private dispatchCommandCardHotkey(slotKey: SlotKey): void {\n    const gameState = this.getGameState();",
    "  private dispatchCommandCardHotkey(slotKey: SlotKey): void {\n"
    "    const gameState = this.getGameState();\n"
    "    this.selection = pruneMissingEntities(this.selection, gameState);",
    'command hotkey prune',
)
text = replace_once(
    text,
    "  private dispatchLegacyAlias(key: string): void {\n    const gameState = this.getGameState();",
    "  private dispatchLegacyAlias(key: string): void {\n"
    "    const gameState = this.getGameState();\n"
    "    this.selection = pruneMissingEntities(this.selection, gameState);",
    'legacy hotkey prune',
)
# Selected factory must be human-owned.
text = replace_once(
    text,
    "    return this.getGameState().production.factories.find(factory =>\n      factory.tx === primary.tx && factory.ty === primary.ty,\n    ) ?? null;",
    "    const state = this.getGameState();\n"
    "    return state.production.factories.find(factory =>\n"
    "      factory.tx === primary.tx\n"
    "      && factory.ty === primary.ty\n"
    "      && isHumanOwned(state, factory),\n"
    "    ) ?? null;",
    'selected factory owner',
)
write(path, text)


# ── focused tests ────────────────────────────────────────────────────
test = r'''import { describe, expect, it } from 'vitest';
import type { MapData, ModularCombatUnit } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import { normalizeCombatUnitState } from '../state/combatUnits';
import { issuePlayerCombatUnitAttack } from '../state/combatUnitCombat';
import { ControlGroupManager } from '../state/controlGroups';
import { issueManualMove, stopUnitCommand } from '../state/unitCommands';
import { pruneMissingEntities, selectMany } from '../state/unitSelection';
import {
  getSelectableUnitControl,
  isHumanOwned,
  isSelectableUnitHumanOwned,
} from '../state/teamOwnership';

function makeMap(): MapData {
  return {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 16, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], buildings: [], builders: [], constructionSites: [],
  };
}

function makeCombat(id: string, faction: 'cyan' | 'green', ownerTeamId: 'team-cyan' | 'team-green', tx: number): ModularCombatUnit {
  return {
    id, ownerTeamId, tx, ty: 8, bodyId: 'wasp', weaponId: 'smoky',
    hullMod: 'm0', turretMod: 'm0', faction, dir: 2, turretDir: 2,
  };
}

function makeState() {
  const state = createInitialState(makeMap(), 'cyan');
  state.mapData.builders = [
    {
      id: 'human-builder', ownerTeamId: 'team-cyan', tx: 4, ty: 4, ftx: 4, fty: 4,
      busy: false, phase: 'idle', path: [], pathIndex: 0, targetTx: 4, targetTy: 4,
      assignedSiteId: -1,
    },
    {
      id: 'foreign-builder', ownerTeamId: 'team-green', tx: 6, ty: 4, ftx: 6, fty: 4,
      busy: false, phase: 'idle', path: [], pathIndex: 0, targetTx: 6, targetTy: 4,
      assignedSiteId: -1,
    },
  ];
  state.harvesters = [
    {
      id: 'human-harvester', ownerTeamId: 'team-cyan', faction: 'cyan', ftx: 4, fty: 6,
      phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
      gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2.5,
    },
    {
      id: 'foreign-harvester', ownerTeamId: 'team-green', faction: 'green', ftx: 6, fty: 6,
      phase: 'idle', targetResourceId: null, cargoRaw: 0, cargoCapacity: 10,
      gatherTimer: 0, unloadTimer: 0, speedTilesPerSecond: 2.5,
    },
  ];
  state.mapData.buildings = [
    { tx: 3, ty: 10, type: 'units-factory', ownerTeamId: 'team-cyan' },
    { tx: 10, ty: 10, type: 'units-factory', ownerTeamId: 'team-green' },
  ];
  state.production.factories = [
    { tx: 3, ty: 10, ownerTeamId: 'team-cyan', queue: [], active: false },
    { tx: 10, ty: 10, ownerTeamId: 'team-green', queue: [], active: false },
  ];
  state.combatUnits = [
    makeCombat('human-tank', 'cyan', 'team-cyan', 4),
    makeCombat('foreign-tank', 'green', 'team-green', 12),
  ];
  normalizeCombatUnitState(state);
  return state;
}

describe('SKIRMISH-P4B owner-aware player control', () => {
  it('resolves legacy unowned entities as human but respects explicit foreign ownership', () => {
    const state = makeState();
    expect(isHumanOwned(state, {})).toBe(true);
    expect(isHumanOwned(state, { faction: 'cyan' })).toBe(true);
    expect(isHumanOwned(state, { ownerTeamId: 'team-green' })).toBe(false);
  });

  it('distinguishes human, foreign and missing selection references', () => {
    const state = makeState();
    expect(getSelectableUnitControl(state, { kind: 'builder', id: 'human-builder' })).toBe('human');
    expect(getSelectableUnitControl(state, { kind: 'builder', id: 'foreign-builder' })).toBe('foreign');
    expect(getSelectableUnitControl(state, { kind: 'builder', id: 'missing' })).toBe('missing');
    expect(isSelectableUnitHumanOwned(state, { kind: 'combat', id: 'foreign-tank' })).toBe(false);
  });

  it('prunes every foreign entity kind from a stale mixed selection', () => {
    const state = makeState();
    const selection = selectMany([
      { kind: 'builder', id: 'human-builder' },
      { kind: 'builder', id: 'foreign-builder' },
      { kind: 'harvester', id: 'foreign-harvester' },
      { kind: 'combat', id: 'foreign-tank' },
      { kind: 'building', id: 'foreign-factory', buildingType: 'units-factory', tx: 10, ty: 10 },
    ]);
    const pruned = pruneMissingEntities(selection, state);
    expect(pruned?.units).toEqual([{ kind: 'builder', id: 'human-builder' }]);
  });

  it('prunes foreign units when a control group is recalled', () => {
    const state = makeState();
    const groups = new ControlGroupManager();
    groups.assignGroup(1, selectMany([
      { kind: 'builder', id: 'human-builder' },
      { kind: 'builder', id: 'foreign-builder' },
    ]));
    expect(groups.recallGroup(1, state)?.units).toEqual([{ kind: 'builder', id: 'human-builder' }]);
  });

  it('rejects move and stop commands for a foreign civil unit without mutation', () => {
    const state = makeState();
    const foreign = state.mapData.builders.find(unit => unit.id === 'foreign-builder')!;
    expect(issueManualMove(state, { kind: 'builder', id: foreign.id }, 8, 4)).toEqual({ ok: false, reason: 'not-owner' });
    expect(foreign.phase).toBe('idle');
    expect(foreign.path).toEqual([]);
    expect(stopUnitCommand(state, { kind: 'builder', id: foreign.id })).toEqual({ ok: false, reason: 'not-owner' });
  });

  it('rejects a foreign player attacker but keeps the generic combat runtime available', () => {
    const state = makeState();
    expect(issuePlayerCombatUnitAttack(state, 'foreign-tank', 'human-tank')).toEqual({ ok: false, reason: 'not-owner' });
    expect(issuePlayerCombatUnitAttack(state, 'human-tank', 'foreign-tank')).toEqual({ ok: true });
    expect(state.combatUnits.find(unit => unit.id === 'human-tank')!.runtime!.targetId).toBe('foreign-tank');
  });
});
'''
write('src/__tests__/ownerAwareControl.test.ts', test)

print('SKIRMISH-P4B patch applied')
