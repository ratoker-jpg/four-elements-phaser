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

// ─── Build button block reason ─────────────────────────────────────

/** Reason a build button is disabled. */
export type BuildBlockReason =
  | 'no-idle-builder'
  | 'insufficient-matter';

/**
 * Derive the reason a build button is disabled.
 *
 * Returns null if the button should be enabled (has idle builder AND
 * sufficient matter for the building type).
 */
export function getBuildBlockReason(
  state: GameState,
  buildingType: BuildingType,
): BuildBlockReason | null {
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

/** Format a HarvesterStatus into a short display string. */
export function harvesterStatusLabel(status: HarvesterStatus): string {
  switch (status) {
    case 'idle': return 'Idle';
    case 'moving-to-resource': return 'Moving';
    case 'gathering': return 'Gathering';
    case 'returning-to-hq': return 'Returning';
    case 'unloading': return 'Unloading';
    case 'manual-move': return 'Manual';
    case 'blocked-no-resources': return 'No Resources';
    case 'blocked-no-approach-path': return 'No Path to Resource';
    case 'blocked-no-path-to-hq': return 'No Path to HQ';
    case 'blocked-raw-storage-full': return 'Storage Full';
  }
}

// ─── Label formatting ──────────────────────────────────────────────

/** Format a SeparatorStatus into a short display string. */
export function separatorStatusLabel(status: SeparatorStatus): string {
  switch (status) {
    case 'idle': return 'Idle';
    case 'processing': return 'Processing';
    case 'blocked-no-raw': return 'No Raw';
    case 'blocked-matter-cap': return 'Matter Full';
    case 'blocked-element-cap': return 'Element Full';
    case 'blocked-power': return 'No Power';
  }
}

/** Format a FactoryStatus into a short display string. */
export function factoryStatusLabel(status: FactoryStatus): string {
  switch (status) {
    case 'idle': return 'Idle';
    case 'producing-builder': return 'Builder';
    case 'producing-harvester': return 'Harvester';
    case 'blocked-no-matter': return 'No Matter';
    case 'blocked-no-element': return 'No Element';
    case 'blocked-queue-full': return 'Queue Full';
    case 'blocked-power': return 'No Power';
    case 'blocked-unit-cap': return 'Unit Cap';
  }
}

/** Format a BuildBlockReason into a short display string. */
export function buildBlockLabel(reason: BuildBlockReason): string {
  switch (reason) {
    case 'no-idle-builder': return 'No Builder';
    case 'insufficient-matter': return 'No Matter';
  }
}

/** Format a ProductionBlockReason into a short display string. */
export function productionBlockLabel(reason: ProductionBlockReason): string {
  switch (reason) {
    case 'no-factory': return 'No Factory';
    case 'queue-full': return 'Queue Full';
    case 'insufficient-matter': return 'No Matter';
    case 'insufficient-element': return 'No Element';
    case 'unit-cap-reached': return 'Unit Cap';
  }
}
