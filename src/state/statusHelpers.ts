/**
 * Status helper selectors — pure TypeScript, no Phaser.
 *
 * ARCH-07A: Read-only helpers that derive human-readable status from
 * GameState for separator buildings, units-factory buildings, build
 * button availability, and production button availability.
 *
 * These helpers replicate the same condition checks used by the state
 * update functions (allocatePowerAndProcess, startUnitProduction,
 * placeConstructionSite) but without mutating state. They exist so
 * that the render layer and HUD can display blocking reasons without
 * duplicating economy logic.
 *
 * Design notes:
 * - No new state fields are added; these are pure derived selectors.
 * - Separator blocked reason is computed from the same resource/cap/power
 *   checks that allocatePowerAndProcess uses.
 * - Factory blocked reason is computed from queue/cost checks matching
 *   startUnitProduction validation.
 * - Build blocked reason is computed from builder/matter checks matching
 *   GameScene.requestBuild.
 */

import type {
  GameState,
  SeparatorRuntimeState,
  UnitFactoryRuntimeState,
  BuildingType,
  ProducibleUnitType,
  HarvesterState,
} from './types';
import {
  SEP_RAW_COST,
  SEP_MATTER_YIELD,
  SEP_ELEMENT_YIELD,
  SEPARATOR_ACTIVE_POWER_CONSUMPTION,
  UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION,
  HQ_BASE_POWER,
  POWER_PLANT_GENERATION,
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
  QUEUE_LIMIT,
  DEFAULT_UNIT_CAP,
} from './types';
import { BUILDING_CONFIG } from './construction';
import { buildOccupancyMap, isPassable } from './occupancy';
import { t } from '../config/localization';
import { isVisualReadyBuilding } from '../config/buildingRuntimeMapping';

// ─── Separator status ──────────────────────────────────────────────

/** Human-readable separator status. */
export type SeparatorStatus =
  | 'idle'
  | 'processing'
  | 'blocked-no-raw'
  | 'blocked-matter-cap'
  | 'blocked-element-cap'
  | 'blocked-power';

/**
 * Derive the status of a separator from current game state.
 *
 * Checks conditions in the same order as allocatePowerAndProcess:
 * 1. Raw available (>= SEP_RAW_COST)
 * 2. Matter cap room (matter + SEP_MATTER_YIELD <= matterCap)
 * 3. Element cap room (elements + SEP_ELEMENT_YIELD <= elementCap)
 * 4. Power available
 *
 * If the separator is actively processing (active === true), returns 'processing'.
 * If active === false, returns the first blocking reason found.
 * If no resources are needed and it is not active, returns 'idle'.
 */
export function getSeparatorStatus(
  state: GameState,
  sep: SeparatorRuntimeState,
): SeparatorStatus {
  // If actively processing, report that
  if (sep.active) return 'processing';

  const faction = state.playerFaction;

  // Check raw availability
  if (state.economy.raw < SEP_RAW_COST) {
    return 'blocked-no-raw';
  }

  // Check matter cap room
  if (state.economy.matter + SEP_MATTER_YIELD > state.economy.matterCap) {
    return 'blocked-matter-cap';
  }

  // Check element cap room
  if (state.economy.elements[faction] + SEP_ELEMENT_YIELD > state.economy.elementCap) {
    return 'blocked-element-cap';
  }

  // Resources are sufficient — check power
  // Power is allocated in build order. A separator that has enough
  // resources but is not active is likely power-blocked.
  // Check if there is any remaining power capacity for this separator.
  const powerAvailable = computeAvailablePowerForBuilding(
    state, 'separator', sep.tx, sep.ty,
  );
  if (!powerAvailable) {
    return 'blocked-power';
  }

  // Not active but has resources and power — could be transitioning
  // (e.g., just completed a cycle, about to start next). Treat as idle.
  return 'idle';
}

// ─── Factory status ────────────────────────────────────────────────

/** Human-readable factory status. */
export type FactoryStatus =
  | 'idle'
  | 'producing-builder'
  | 'producing-harvester'
  | 'blocked-no-matter'
  | 'blocked-no-element'
  | 'blocked-queue-full'
  | 'blocked-power'
  | 'blocked-unit-cap';

/**
 * Derive the status of a units-factory from current game state.
 *
 * If the factory is actively producing, reports the unit type.
 * If not active, reports the first blocking reason for the next
 * hypothetical production (or 'idle' if the factory has no queue items
 * and is simply waiting for orders).
 *
 * The `nextUnitType` parameter is optional. If provided, the status
 * checks affordability for that specific unit type. If omitted, the
 * function reports based on the current queue state.
 */
export function getFactoryStatus(
  state: GameState,
  factory: UnitFactoryRuntimeState,
  nextUnitType?: ProducibleUnitType,
): FactoryStatus {
  // Check if currently producing
  const activeItem = factory.queue.find(item => !item.completed);
  if (activeItem && factory.active) {
    return activeItem.unitType === 'builder'
      ? 'producing-builder'
      : 'producing-harvester';
  }

  // If there's an unfinished item but factory is not active, it's power-blocked.
  // This must be checked before queue-full so that a full queue with an
  // unfinished item that can't progress reports the root cause (no power),
  // not a secondary symptom (queue full).
  if (activeItem && !factory.active) {
    return 'blocked-power';
  }

  // If queue is full, report that
  if (factory.queue.length >= QUEUE_LIMIT) {
    return 'blocked-queue-full';
  }

  // If a specific unit type was requested, check affordability
  if (nextUnitType) {
    const matterCost = nextUnitType === 'builder'
      ? BUILDER_PRODUCTION_MATTER_COST
      : HARVESTER_PRODUCTION_MATTER_COST;
    const elementCost = nextUnitType === 'builder'
      ? BUILDER_PRODUCTION_ELEMENT_COST
      : HARVESTER_PRODUCTION_ELEMENT_COST;

    if (state.economy.matter < matterCost) {
      return 'blocked-no-matter';
    }
    if (state.economy.elements[state.playerFaction] < elementCost) {
      return 'blocked-no-element';
    }
  }

  // Check unit cap (if we were to produce another unit, would cap be hit?)
  if (getUnitCount(state) >= getUnitCap(state)) {
    return 'blocked-unit-cap';
  }

  // Factory has room in queue and no active item — idle
  return 'idle';
}

// ─── Factory spawn blockage (FIX-04) ──────────────────────────────────

/** Reason a completed factory queue item cannot spawn. */
export type FactorySpawnBlockReason =
  | 'unit-cap-reached'
  | 'no-spawn-tile';

/**
 * Derive the reason the front completed queue item cannot spawn.
 *
 * Returns null if:
 * - The factory queue is empty.
 * - The front queue item is NOT completed (still producing).
 * - The front completed item CAN spawn (no blockage).
 *
 * This is a read-only helper for UI display. It replicates the same
 * checks performed by processFactorySpawns() in updateGameState.ts
 * but without mutating state.
 *
 * Check order matches processFactorySpawns:
 * 1. Unit cap (liveUnitCount >= cap)
 * 2. No spawn tile available
 */
export function getFactorySpawnBlockReason(
  state: GameState,
  factory: UnitFactoryRuntimeState,
): FactorySpawnBlockReason | null {
  // Only relevant if the front queue item is completed
  if (factory.queue.length === 0) return null;
  if (!factory.queue[0].completed) return null;

  // Check 1: Unit cap
  if (getUnitCount(state) >= getUnitCap(state)) {
    return 'unit-cap-reached';
  }

  // Check 2: Spawn tile availability
  if (!hasFactorySpawnTile(state, factory.tx, factory.ty)) {
    return 'no-spawn-tile';
  }

  // No blockage
  return null;
}

/** Format a FactorySpawnBlockReason into a short display string. */
export function spawnBlockLabel(reason: FactorySpawnBlockReason): string {
  switch (reason) {
    case 'unit-cap-reached': return t('status_unitCap');
    case 'no-spawn-tile': return t('status_noSpawnTile');
  }
}

/**
 * Check whether a factory has at least one passable tile adjacent
 * to its 2x2 footprint where a unit could spawn.
 *
 * This is a read-only pure helper that replicates the same ring
 * search logic as findSpawnPosition() in updateGameState.ts.
 * It exists so the status/UI layer can check spawn availability
 * without calling the mutation-coupled spawn function.
 */
export function hasFactorySpawnTile(
  state: GameState,
  factoryTx: number,
  factoryTy: number,
): boolean {
  const fpW = 2;
  const fpH = 2;
  const occupancyMap = buildOccupancyMap(state);

  for (let ring = 0; ring < 5; ring++) {
    const candidates = getRingCandidates(factoryTx, factoryTy, fpW, fpH, ring);
    for (const pos of candidates) {
      if (pos.tx < 0 || pos.ty < 0 ||
          pos.tx >= state.mapWidth || pos.ty >= state.mapHeight) {
        continue;
      }
      if (isPassable(occupancyMap, pos.tx, pos.ty)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get candidate tile positions for a given ring around a rectangular footprint.
 * Mirrors the same function in updateGameState.ts for read-only use.
 */
function getRingCandidates(
  baseTx: number,
  baseTy: number,
  fpW: number,
  fpH: number,
  ring: number,
): Array<{ tx: number; ty: number }> {
  const candidates: Array<{ tx: number; ty: number }> = [];

  // North edge
  for (let dx = -ring; dx < fpW + ring; dx++) {
    candidates.push({ tx: baseTx + dx, ty: baseTy - 1 - ring });
  }
  // South edge
  for (let dx = -ring; dx < fpW + ring; dx++) {
    candidates.push({ tx: baseTx + dx, ty: baseTy + fpH + ring });
  }
  // West edge (excluding corners)
  for (let dy = 0; dy < fpH; dy++) {
    candidates.push({ tx: baseTx - 1 - ring, ty: baseTy + dy });
  }
  // East edge (excluding corners)
  for (let dy = 0; dy < fpH; dy++) {
    candidates.push({ tx: baseTx + fpW + ring, ty: baseTy + dy });
  }

  return candidates;
}

// ─── Build button block reason ─────────────────────────────────────

/** Reason a build button is disabled. */
export type BuildBlockReason =
  | 'no-idle-builder'
  | 'insufficient-matter'
  | 'not-buildable';

/**
 * Derive the reason a build button is disabled.
 *
 * Returns null if the button should be enabled (has idle builder AND
 * sufficient matter for the building type AND building is gameplay-ready).
 *
 * Visual-ready buildings always return 'not-buildable' regardless of
 * resources, preventing accidental construction of non-functional buildings.
 */
export function getBuildBlockReason(
  state: GameState,
  buildingType: BuildingType,
): BuildBlockReason | null {
  // Visual-ready buildings are never buildable in live gameplay
  if (isVisualReadyBuilding(buildingType)) {
    return 'not-buildable';
  }

  // Check for idle builder
  const hasIdleBuilder = state.mapData.builders.some(
    b => b.phase === 'idle' && !b.busy,
  );
  if (!hasIdleBuilder) {
    return 'no-idle-builder';
  }

  // Check matter cost
  const config = BUILDING_CONFIG[buildingType];
  if (config && state.economy.matter < config.costMatter) {
    return 'insufficient-matter';
  }

  return null;
}

// ─── Production button block reason ────────────────────────────────

/** Reason a production button is disabled. */
export type ProductionBlockReason =
  | 'no-factory'
  | 'queue-full'
  | 'insufficient-matter'
  | 'insufficient-element'
  | 'unit-cap-reached';

/**
 * Derive the reason a production button is disabled.
 *
 * Returns null if the button should be enabled (has factory with queue
 * room AND sufficient resources for the unit type).
 */
export function getProductionBlockReason(
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
  if (!hasQueueRoom) {
    return 'queue-full';
  }

  // Check matter cost
  const matterCost = unitType === 'builder'
    ? BUILDER_PRODUCTION_MATTER_COST
    : HARVESTER_PRODUCTION_MATTER_COST;
  if (state.economy.matter < matterCost) {
    return 'insufficient-matter';
  }

  // Check element cost
  const elementCost = unitType === 'builder'
    ? BUILDER_PRODUCTION_ELEMENT_COST
    : HARVESTER_PRODUCTION_ELEMENT_COST;
  if (state.economy.elements[state.playerFaction] < elementCost) {
    return 'insufficient-element';
  }

  // Check unit cap
  if (getUnitCount(state) >= getUnitCap(state)) {
    return 'unit-cap-reached';
  }

  return null;
}

// ─── Unit cap helpers (FIX-03) ─────────────────────────────────────────

/** Count current player civil units (builders + harvesters). */
export function getUnitCount(state: GameState): number {
  return state.mapData.builders.length + state.harvesters.length;
}

/** Get the current unit cap for the player. Sandbox MVP: fixed DEFAULT_UNIT_CAP. */
export function getUnitCap(state: GameState): number {
  // Sandbox MVP: fixed cap. Future: command-relay buildings may add to cap.
  void state; // used for future building-based cap
  return DEFAULT_UNIT_CAP;
}

// ─── Internal helpers ───────────────────────────────────────────────

/**
 * Compute whether a specific building at a given position would have
 * power available, assuming build-order allocation.
 *
 * This replicates the power allocation logic from allocatePowerAndProcess
 * without mutating state. It walks buildings in order, allocating power
 * to each consumer, and checks whether the target building gets power.
 */
function computeAvailablePowerForBuilding(
  state: GameState,
  buildingType: 'separator' | 'units-factory',
  buildingTx: number,
  buildingTy: number,
): boolean {
  let remainingPower = HQ_BASE_POWER +
    state.mapData.buildings.filter(b => b.type === 'power-plant').length * POWER_PLANT_GENERATION;

  // Build lookup maps for runtime state
  const separatorMap = new Map<string, typeof state.economy.separators[0]>();
  for (const sep of state.economy.separators) {
    separatorMap.set(`${sep.tx},${sep.ty}`, sep);
  }

  const factoryMap = new Map<string, typeof state.production.factories[0]>();
  for (const factory of state.production.factories) {
    factoryMap.set(`${factory.tx},${factory.ty}`, factory);
  }

  const targetKey = `${buildingTx},${buildingTy}`;

  for (const building of state.mapData.buildings) {
    const key = `${building.tx},${building.ty}`;

    if (building.type === 'separator') {
      const sep = separatorMap.get(key);
      if (!sep) continue;

      // Check resource conditions
      const hasResources =
        state.economy.raw >= SEP_RAW_COST &&
        state.economy.matter + SEP_MATTER_YIELD <= state.economy.matterCap &&
        state.economy.elements[state.playerFaction] + SEP_ELEMENT_YIELD <= state.economy.elementCap;

      if (!hasResources) continue;

      // Check if this is our target building
      if (building.type === buildingType && key === targetKey) {
        return remainingPower >= SEPARATOR_ACTIVE_POWER_CONSUMPTION;
      }

      // Allocate power for this separator
      if (remainingPower >= SEPARATOR_ACTIVE_POWER_CONSUMPTION) {
        remainingPower -= SEPARATOR_ACTIVE_POWER_CONSUMPTION;
      }
    } else if (building.type === 'units-factory') {
      const factory = factoryMap.get(key);
      if (!factory) continue;

      const unfinishedItem = factory.queue.find(item => !item.completed);
      if (!unfinishedItem) continue;

      // Check if this is our target building
      if (building.type === buildingType && key === targetKey) {
        return remainingPower >= UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
      }

      // Allocate power for this factory
      if (remainingPower >= UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION) {
        remainingPower -= UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
      }
    }
  }

  // Building not found in iteration — should not happen
  return false;
}

// ─── Harvester status ───────────────────────────────────────────────

/** Human-readable harvester status. */
export type HarvesterStatus =
  | 'idle'
  | 'moving-to-resource'
  | 'gathering'
  | 'returning-to-hq'
  | 'unloading'
  | 'manual-move'
  | 'blocked-no-resources'
  | 'blocked-no-approach-path'
  | 'blocked-no-path-to-hq'
  | 'blocked-raw-storage-full';

/**
 * Derive the status of a harvester from its current state.
 *
 * If blockedReason is set, returns a 'blocked-*' status that takes
 * precedence over the phase. This gives the player a clear reason
 * why the harvester is stuck rather than just showing "Idle" or
 * "Returning" without explanation.
 *
 * If not blocked, returns the current phase as-is.
 */
export function getHarvesterStatus(h: HarvesterState): HarvesterStatus {
  if (h.blockedReason) {
    switch (h.blockedReason) {
      case 'no-resources': return 'blocked-no-resources';
      case 'no-approach-path': return 'blocked-no-approach-path';
      case 'no-path-to-hq': return 'blocked-no-path-to-hq';
      case 'raw-storage-full': return 'blocked-raw-storage-full';
    }
  }
  return h.phase;
}

/** Whether a harvester status represents a blocked state. */
export function isHarvesterBlocked(status: HarvesterStatus): boolean {
  return status.startsWith('blocked-');
}

/** Format a HarvesterStatus into a short display string. CORE-STEP-01B: Russian labels. */
export function harvesterStatusLabel(status: HarvesterStatus): string {
  switch (status) {
    case 'idle': return t('status_idle');
    case 'moving-to-resource': return t('status_moving');
    case 'gathering': return t('status_gathering');
    case 'returning-to-hq': return t('status_returning');
    case 'unloading': return t('status_unloading');
    case 'manual-move': return t('status_manual');
    case 'blocked-no-resources': return t('status_noResources');
    case 'blocked-no-approach-path': return t('status_noPathToResource');
    case 'blocked-no-path-to-hq': return t('status_noPathToHQ');
    case 'blocked-raw-storage-full': return t('status_storageFull');
  }
}

// ─── Label formatting ──────────────────────────────────────────────

/** Format a SeparatorStatus into a short display string. CORE-STEP-01B: Russian labels. */
export function separatorStatusLabel(status: SeparatorStatus): string {
  switch (status) {
    case 'idle': return t('status_idle');
    case 'processing': return t('status_processing');
    case 'blocked-no-raw': return t('status_noRaw');
    case 'blocked-matter-cap': return t('status_matterFull');
    case 'blocked-element-cap': return t('status_elementFull');
    case 'blocked-power': return t('status_noPower');
  }
}

/** Format a FactoryStatus into a short display string. CORE-STEP-01B: Russian labels. */
export function factoryStatusLabel(status: FactoryStatus): string {
  switch (status) {
    case 'idle': return t('status_idle');
    case 'producing-builder': return t('status_builder');
    case 'producing-harvester': return t('status_harvester');
    case 'blocked-no-matter': return t('status_noMatter');
    case 'blocked-no-element': return t('status_noElement');
    case 'blocked-queue-full': return t('status_queueFull');
    case 'blocked-power': return t('status_noPower');
    case 'blocked-unit-cap': return t('status_unitCap');
  }
}

/** Format a BuildBlockReason into a short display string. CORE-STEP-01B: Russian labels. */
export function buildBlockLabel(reason: BuildBlockReason): string {
  switch (reason) {
    case 'no-idle-builder': return t('status_noBuilder');
    case 'insufficient-matter': return t('status_insufficientMatter');
    case 'not-buildable': return t('status_notBuildable');
  }
}

/** Format a ProductionBlockReason into a short display string. CORE-STEP-01B: Russian labels. */
export function productionBlockLabel(reason: ProductionBlockReason): string {
  switch (reason) {
    case 'no-factory': return t('status_noFactory');
    case 'queue-full': return t('status_queueFull');
    case 'insufficient-matter': return t('status_insufficientMatter');
    case 'insufficient-element': return t('status_noElement');
    case 'unit-cap-reached': return t('status_unitCap');
  }
}
