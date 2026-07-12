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
  UnitProductionRequest,
} from './types';
import {
  QUEUE_LIMIT,
  BUILDER_PRODUCTION_MATTER_COST,
  BUILDER_PRODUCTION_ELEMENT_COST,
  BUILDER_PRODUCTION_DURATION_MS,
  HARVESTER_PRODUCTION_MATTER_COST,
  HARVESTER_PRODUCTION_ELEMENT_COST,
  HARVESTER_PRODUCTION_DURATION_MS,
} from './types';
import { normalizeProductionRequest } from './combatUnits';
import { getT1CombatProductionQuote } from '../config/t1ProductionComponents';
import { ensureMatchState } from './matchState';

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

// ─── Cancel types (FIX-04) ──────────────────────────────────────────

/** Rejection reasons for cancelling a factory queue item. */
export type CancelRejectionReason =
  | 'factory-not-found'
  | 'invalid-queue-index';

/** Result of a cancelFactoryQueueItem call. */
export type CancelResult =
  | { ok: true }
  | { ok: false; reason: CancelRejectionReason };

// ─── Canonical production quote ─────────────────────────────────────

export type ProductionRequestInput = ProducibleUnitType | UnitProductionRequest;

export interface ProductionQuote {
  unitType: ProducibleUnitType;
  request: UnitProductionRequest;
  displayNameRu: string;
  matterCost: number;
  elementCost: number;
  durationMs: number;
}

/** Resolve one canonical request, display label, cost and duration. */
export function getProductionQuote(input: ProductionRequestInput): ProductionQuote | null {
  const { unitType, request } = normalizeProductionRequest(input);
  if (request.kind === 'civil') {
    if (request.unitType === 'builder') {
      return {
        unitType,
        request,
        displayNameRu: 'Строитель',
        matterCost: BUILDER_PRODUCTION_MATTER_COST,
        elementCost: BUILDER_PRODUCTION_ELEMENT_COST,
        durationMs: BUILDER_PRODUCTION_DURATION_MS,
      };
    }
    return {
      unitType,
      request,
      displayNameRu: 'Сборщик',
      matterCost: HARVESTER_PRODUCTION_MATTER_COST,
      elementCost: HARVESTER_PRODUCTION_ELEMENT_COST,
      durationMs: HARVESTER_PRODUCTION_DURATION_MS,
    };
  }

  const combat = getT1CombatProductionQuote(request);
  if (!combat) return null;
  return {
    unitType: 'wasp-smoky',
    request: {
      kind: 'combat',
      bodyId: combat.bodyId,
      weaponId: combat.weaponId,
      hullMod: combat.hullMod,
      turretMod: combat.turretMod,
    },
    displayNameRu: combat.displayNameRu,
    matterCost: combat.matterCost,
    elementCost: combat.elementCost,
    durationMs: combat.durationMs,
  };
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
  input: ProducibleUnitType | UnitProductionRequest,
): ProductionResult {
  const match = ensureMatchState(state);

  // 1. Find the factory
  const factory = state.production.factories.find(
    f => f.tx === factoryTx && f.ty === factoryTy,
  );
  if (!factory) return { ok: false, reason: 'factory-not-found' };
  const ownerTeamId = factory.ownerTeamId ?? match.humanTeamId;
  const owner = match.teams[ownerTeamId];

  // 2. Check queue limit
  if (factory.queue.length >= QUEUE_LIMIT) {
    return { ok: false, reason: 'queue-full' };
  }

  const quote = getProductionQuote(input);
  if (!quote) return { ok: false, reason: 'unsupported-unit-type' };

  // 3. Check matter cost
  const matterCost = quote.matterCost;
  if (owner.economy.matter < matterCost) {
    return { ok: false, reason: 'insufficient-matter' };
  }

  // 4. Check element cost
  const elementCost = quote.elementCost;
  if (owner.economy.elements[owner.faction] < elementCost) {
    return { ok: false, reason: 'insufficient-element' };
  }

  // 5. Check unit cap — block queueing if already at cap
  // Phase 2: combat units count toward the cap
  const currentUnitCount =
    state.mapData.builders.filter(unit => !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length
    + state.harvesters.filter(unit => !unit.isDestroyed && (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length
    + (state.combatUnits?.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length ?? 0);
  if (currentUnitCount >= owner.unitCap) {
    return { ok: false, reason: 'unit-cap-reached' };
  }

  // 6. Deduct costs
  owner.economy.matter -= matterCost;
  owner.economy.elements[owner.faction] -= elementCost;

  // 7. Create queue item
  const durationMs = quote.durationMs;
  factory.queue.push({
    unitType: quote.unitType,
    request: quote.request,
    elapsedMs: 0,
    durationMs,
    progress: 0,
    completed: false,
  });

  return { ok: true };
}

// ─── Cancel API (FIX-04) ─────────────────────────────────────────────

/**
 * Cancel a queue item at the specified factory.
 *
 * Removes the item at the given queue index. No resource refund.
 *
 * Valid indexes: 0..queue.length-1.
 * Cancelling works for both in-progress and completed items.
 * Queue order is preserved — remaining items shift to fill the gap.
 * If the cancelled item was in-progress, the next unfinished item
 * (if any) will start progressing on the next tick.
 *
 * On failure:
 * - No mutation
 * - Returns clear reason
 */
export function cancelFactoryQueueItem(
  state: GameState,
  factoryTx: number,
  factoryTy: number,
  queueIndex: number,
): CancelResult {
  // 1. Find the factory
  const factory = state.production.factories.find(
    f => f.tx === factoryTx && f.ty === factoryTy,
  );
  if (!factory) return { ok: false, reason: 'factory-not-found' };

  // 2. Validate queue index
  if (queueIndex < 0 || queueIndex >= factory.queue.length) {
    return { ok: false, reason: 'invalid-queue-index' };
  }

  // 3. Remove the item — no refund
  factory.queue.splice(queueIndex, 1);

  return { ok: true };
}
