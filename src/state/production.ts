/**
 * Units-factory production — pure TypeScript, no Phaser.
 *
 * ARCH-01F: Production baseline for units-factory buildings.
 *
 * Provides:
 * - Production queue management (startUnitProduction)
 * - Cost lookup helpers
 *
 * Production tick logic (power allocation, progress, spawning) is
 * handled by allocatePowerAndProcess in updateGameState.ts to ensure
 * unified build-order power allocation across separators and factories.
 *
 * Production model:
 * - Factory queue limit = 2 items
 * - Only the first non-completed item progresses
 * - Factory consumes 4 power only while actively producing
 * - If power unavailable, progress pauses (preserved, not reset)
 * - Completed item does not consume power while waiting to spawn
 * - Element and matter costs are deducted at enqueue time
 */

import type {
  GameState,
  ProducibleUnitType,
} from './types';
import {
  QUEUE_LIMIT,
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  BUILDER_PRODUCTION_DURATION_MS,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_DURATION_MS,
  DEFAULT_UNIT_CAP,
} from './types';

// ─── Public types ──────────────────────────────────────────────────

/** Rejection reasons for unit production. */
export type ProductionRejectionReason =
  | 'factory-not-found'
  | 'queue-full'
  | 'insufficient-matter'
  | 'insufficient-element'
  | 'unit-cap-reached'
  | 'unsupported-unit-type';

/** Result of a startUnitProduction call. */
export type ProductionResult =
  | { ok: true }
  | { ok: false; reason: ProductionRejectionReason };

// ─── Cost lookup ────────────────────────────────────────────────────

/** Get matter cost for a producible unit type. */
function getMatterCost(unitType: ProducibleUnitType): number {
  switch (unitType) {
    case 'builder': return BUILDER_PRODUCTION_MATTER_COST;
    case 'harvester': return HARVESTER_PRODUCTION_MATTER_COST;
  }
}

/** Get element cost (in elementUnits) for a producible unit type. */
function getElementCost(unitType: ProducibleUnitType): number {
  switch (unitType) {
    case 'builder': return BUILDER_PRODUCTION_ELEMENT_COST;
    case 'harvester': return HARVESTER_PRODUCTION_ELEMENT_COST;
  }
}

/** Get production duration in ms for a producible unit type. */
function getProductionDuration(unitType: ProducibleUnitType): number {
  switch (unitType) {
    case 'builder': return BUILDER_PRODUCTION_DURATION_MS;
    case 'harvester': return HARVESTER_PRODUCTION_DURATION_MS;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Start producing a unit at the specified factory.
 *
 * Checks:
 * - Factory exists at given position
 * - Queue length < QUEUE_LIMIT
 * - Enough matter
 * - Enough active faction elementUnits
 *
 * On success:
 * - Deducts matter immediately
 * - Deducts active faction elementUnits immediately
 * - Pushes queue item with correct duration/progress
 *
 * On failure:
 * - No mutation
 * - Returns clear reason
 */
export function startUnitProduction(
  state: GameState,
  factoryTx: number,
  factoryTy: number,
  unitType: ProducibleUnitType,
): ProductionResult {
  // 1. Find the factory
  const factory = state.production.factories.find(
    f => f.tx === factoryTx && f.ty === factoryTy,
  );
  if (!factory) return { ok: false, reason: 'factory-not-found' };

  // 2. Check queue limit
  if (factory.queue.length >= QUEUE_LIMIT) {
    return { ok: false, reason: 'queue-full' };
  }

  // 3. Check matter cost
  const matterCost = getMatterCost(unitType);
  if (state.economy.matter < matterCost) {
    return { ok: false, reason: 'insufficient-matter' };
  }

  // 4. Check element cost
  const elementCost = getElementCost(unitType);
  if (state.economy.elements[state.playerFaction] < elementCost) {
    return { ok: false, reason: 'insufficient-element' };
  }

  // 5. Check unit cap — block queueing if already at cap
  const currentUnitCount = state.mapData.builders.length + state.harvesters.length;
  if (currentUnitCount >= DEFAULT_UNIT_CAP) {
    return { ok: false, reason: 'unit-cap-reached' };
  }

  // 6. Deduct costs
  state.economy.matter -= matterCost;
  state.economy.elements[state.playerFaction] -= elementCost;

  // 7. Create queue item
  const durationMs = getProductionDuration(unitType);
  factory.queue.push({
    unitType,
    elapsedMs: 0,
    durationMs,
    progress: 0,
    completed: false,
  });

  return { ok: true };
}
