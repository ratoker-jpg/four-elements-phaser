/**
 * Pure TypeScript game state update for the harvester civil loop.
 *
 * No Phaser dependencies. Mutates GameState in place (documented).
 * Called once per frame from GameScene.update(delta).
 *
 * PR3 scope:
 * - Harvester idle → find nearest resource → move → gather → return → unload → repeat
 * - Straight-line movement only (no pathfinding)
 * - Resource depletion for finite nodes
 * - Infinite resources never deplete
 */

import type {
  Faction,
  GameState,
  HarvesterState,
  ResourceNodeState,
} from './types';
import {
  SEP_RAW_COST,
  SEP_MATTER_YIELD,
  SEP_ELEMENT_YIELD,
  SEP_CYCLE_MS,
  HQ_BASE_POWER,
  POWER_PLANT_GENERATION,
  SEPARATOR_ACTIVE_POWER_CONSUMPTION,
  UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION,
} from './types';

// ─── Constants ──────────────────────────────────────────────────────

/** Duration of one gather cycle in milliseconds. */
const GATHER_DURATION_MS = 1000;

/** Duration of one unload cycle in milliseconds. */
const UNLOAD_DURATION_MS = 500;

/** Default harvester cargo capacity. */
const DEFAULT_CARGO_CAPACITY = 20;

/** Default harvester movement speed (tiles per second). */
const DEFAULT_SPEED = 2.5;

/** Distance threshold (in tiles) to consider "arrived" at a target. */
const ARRIVAL_THRESHOLD = 0.25;

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Advance game state by deltaMs milliseconds.
 *
 * Mutates the state object in place. This is acceptable for PR3 and
 * documented here. The function remains pure TypeScript and deterministic
 * given the same input state and delta.
 */
export function updateGameState(state: GameState, deltaMs: number): void {
  // Clamp delta to prevent huge jumps after tab-switch
  const dt = Math.min(deltaMs, 200);

  for (const harvester of state.harvesters) {
    updateHarvester(state, harvester, dt);
  }

  // ARCH-01C/01E/01F: Unified power allocation + separator processing + factory production.
  // Power consumers (separators, factories) are allocated power in completed building order.
  allocatePowerAndProcess(state, dt);

  // ARCH-01E: Recompute power state after separator processing and factory production
  recomputePower(state);
}

// ─── Harvester state machine ────────────────────────────────────────

function updateHarvester(
  state: GameState,
  h: HarvesterState,
  dt: number,
): void {
  switch (h.phase) {
    case 'idle':
      handleIdle(state, h);
      break;
    case 'moving-to-resource':
      handleMovingToResource(state, h, dt);
      break;
    case 'gathering':
      handleGathering(state, h, dt);
      break;
    case 'returning-to-hq':
      handleReturningToHQ(state, h, dt);
      break;
    case 'unloading':
      handleUnloading(state, h, dt);
      break;
  }
}

// ── idle ──────────────────────────────────────────────────────────

function handleIdle(state: GameState, h: HarvesterState): void {
  const target = findNearestAvailableResource(state, h);
  if (!target) return; // nothing to gather

  h.targetResourceId = target.id;
  h.phase = 'moving-to-resource';
}

// ── moving-to-resource ────────────────────────────────────────────

function handleMovingToResource(
  state: GameState,
  h: HarvesterState,
  dt: number,
): void {
  const target = findResourceById(state, h.targetResourceId);
  if (!target || target.depleted) {
    // Target lost — go idle and re-evaluate
    h.targetResourceId = null;
    h.phase = 'idle';
    return;
  }

  const arrived = moveToward(h, target.tx, target.ty, dt);
  if (arrived) {
    h.ftx = target.tx;
    h.fty = target.ty;
    h.gatherTimer = GATHER_DURATION_MS;
    h.phase = 'gathering';
  }
}

// ── gathering ─────────────────────────────────────────────────────

function handleGathering(
  state: GameState,
  h: HarvesterState,
  dt: number,
): void {
  const target = findResourceById(state, h.targetResourceId);
  if (!target || target.depleted) {
    // Target lost — return what we have (or go idle if empty)
    h.targetResourceId = null;
    h.phase = h.cargoRaw > 0 ? 'returning-to-hq' : 'idle';
    return;
  }

  h.gatherTimer -= dt;
  if (h.gatherTimer > 0) return; // still gathering

  // Gather cycle complete — transfer raw into cargo
  const canCarry = h.cargoCapacity - h.cargoRaw;

  if (target.resourceType === 'infinite') {
    h.cargoRaw += canCarry;
  } else {
    const available = Math.min(canCarry, target.remainingRaw);
    h.cargoRaw += available;
    target.remainingRaw -= available;
    if (target.remainingRaw <= 0) {
      target.remainingRaw = 0;
      target.depleted = true;
    }
  }

  // After one gather cycle, return to HQ
  h.targetResourceId = null;
  h.phase = 'returning-to-hq';
}

// ── returning-to-hq ───────────────────────────────────────────────

function handleReturningToHQ(
  state: GameState,
  h: HarvesterState,
  dt: number,
): void {
  const arrived = moveToward(h, state.hqPosition.tx, state.hqPosition.ty, dt);
  if (arrived) {
    h.ftx = state.hqPosition.tx;
    h.fty = state.hqPosition.ty;
    h.unloadTimer = UNLOAD_DURATION_MS;
    h.phase = 'unloading';
  }
}

// ── unloading ─────────────────────────────────────────────────────

function handleUnloading(
  state: GameState,
  h: HarvesterState,
  dt: number,
): void {
  h.unloadTimer -= dt;
  if (h.unloadTimer > 0) return; // still unloading

  // ARCH-01D: Enforce raw cap on harvester unload.
  // Transfer as much cargo as fits within rawCap; keep remaining in cargo.
  // Do not lose cargo silently — if raw is at cap, keep cargo and wait.
  const room = state.economy.rawCap - state.economy.raw;
  if (room <= 0) {
    // Raw storage full — keep cargo, stay at HQ position.
    // Set a short unload timer so the harvester retries next frame
    // instead of immediately re-entering the unload phase without a delay.
    h.unloadTimer = UNLOAD_DURATION_MS;
    return;
  }

  const transfer = Math.min(h.cargoRaw, room);
  state.economy.raw += transfer;
  h.cargoRaw -= transfer;

  if (h.cargoRaw > 0) {
    // Partial unload — still at HQ, retry unloading remaining cargo.
    // Set a short unload timer so the harvester retries after a brief pause,
    // giving separator processing a chance to free up raw storage.
    h.unloadTimer = UNLOAD_DURATION_MS;
  } else {
    // All cargo unloaded — go idle and re-enter gather loop.
    h.phase = 'idle';
  }
}

// ─── Movement helpers ───────────────────────────────────────────────

/**
 * Move harvester toward a target tile position.
 * Returns true if the harvester has arrived (within ARRIVAL_THRESHOLD).
 *
 * Uses straight-line movement in tile space — no pathfinding.
 * Harvesters may pass through obstacles/resources on the way (accepted for PR3).
 */
function moveToward(
  h: HarvesterState,
  targetTx: number,
  targetTy: number,
  dtMs: number,
): boolean {
  const dx = targetTx - h.ftx;
  const dy = targetTy - h.fty;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= ARRIVAL_THRESHOLD) return true;

  // How far to move this frame (in tiles)
  const step = (h.speedTilesPerSecond * dtMs) / 1000;
  const moveDist = Math.min(step, dist);

  h.ftx += (dx / dist) * moveDist;
  h.fty += (dy / dist) * moveDist;

  // Check arrival after move
  const newDx = targetTx - h.ftx;
  const newDy = targetTy - h.fty;
  return Math.sqrt(newDx * newDx + newDy * newDy) <= ARRIVAL_THRESHOLD;
}

// ─── Resource lookup helpers ────────────────────────────────────────

/** Find the nearest non-depleted resource to the harvester. */
function findNearestAvailableResource(
  state: GameState,
  h: HarvesterState,
): ResourceNodeState | null {
  let best: ResourceNodeState | null = null;
  let bestDist = Infinity;

  for (const r of state.resourceNodes) {
    if (r.depleted) continue;
    const dx = r.tx - h.ftx;
    const dy = r.ty - h.fty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }

  return best;
}

/** Find a resource node by ID. */
function findResourceById(
  state: GameState,
  id: string | null,
): ResourceNodeState | null {
  if (!id) return null;
  return state.resourceNodes.find((r) => r.id === id) ?? null;
}

// ─── Direction computation (for render sync) ───────────────────────

/**
 * Compute the 8-direction facing index from a tile-space movement vector.
 *
 * Maps to spritesheet row indices:
 *   E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7
 */
export function directionFromDelta(dtx: number, dty: number): number {
  // Convert tile-space delta to screen-space direction
  const sdx = dtx - dty; // proportional to screen X movement
  const sdy = dtx + dty; // proportional to screen Y movement

  if (Math.abs(sdx) < 0.001 && Math.abs(sdy) < 0.001) return 2; // default: S

  const angle = Math.atan2(sdy, sdx); // -PI..PI, screen-space

  // Sector: quantise to 8 equal slices
  // E=0 (angle ~0), SE=1 (angle ~PI/4), S=2 (angle ~PI/2),
  // SW=3 (angle ~3PI/4), W=4 (angle ~±PI), NW=5 (angle ~-3PI/4),
  // N=6 (angle ~-PI/2), NE=7 (angle ~-PI/4)
  const sector = Math.round(angle / (Math.PI / 4));
  const map: Record<number, number> = {
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
    '-4': 4, '-3': 5, '-2': 6, '-1': 7,
  };
  return map[sector] ?? 2;
}

// ─── Separator processing cycle (ARCH-01C / ARCH-01E) ──────────────────

/**
 * Unified power allocation and processing for all active consumers.
 *
 * ARCH-01C/01E/01F: Iterates mapData.buildings in completed building order.
 * Allocates power to separators and factories based on their position
 * in the buildings list. Older buildings get power first.
 *
 * - Separator: checks raw/caps, then power; advances processing if both OK.
 * - Factory: delegates to updateProduction which checks queue and power.
 *
 * A consumer blocked by resources/caps does not request power.
 * When power is unavailable, progress is preserved (not reset).
 */
function allocatePowerAndProcess(state: GameState, dt: number): void {
  const playerFaction = state.playerFaction;

  // Compute total available power
  let remainingPower = HQ_BASE_POWER +
    state.mapData.buildings.filter(b => b.type === 'power-plant').length * POWER_PLANT_GENERATION;

  // Build lookup maps for separator and factory runtime state by position
  const separatorMap = new Map<string, typeof state.economy.separators[0]>();
  for (const sep of state.economy.separators) {
    separatorMap.set(`${sep.tx},${sep.ty}`, sep);
  }

  const factoryMap = new Map<string, typeof state.production.factories[0]>();
  for (const factory of state.production.factories) {
    factoryMap.set(`${factory.tx},${factory.ty}`, factory);
  }

  // Iterate buildings in completed build order
  for (const building of state.mapData.buildings) {
    if (building.type === 'separator') {
      const sep = separatorMap.get(`${building.tx},${building.ty}`);
      if (!sep) continue;

      // ARCH-01D: Check resource/cap conditions for separator to process
      const hasResources =
        state.economy.raw >= SEP_RAW_COST &&
        state.economy.matter + SEP_MATTER_YIELD <= state.economy.matterCap &&
        state.economy.elements[playerFaction] + SEP_ELEMENT_YIELD <= state.economy.elementCap;

      if (!hasResources) {
        sep.active = false;
        continue;
      }

      // Check power
      if (remainingPower < SEPARATOR_ACTIVE_POWER_CONSUMPTION) {
        sep.active = false;
        continue;
      }

      // Allocate power and process
      remainingPower -= SEPARATOR_ACTIVE_POWER_CONSUMPTION;
      sep.active = true;

      // Advance progress
      sep.progress += dt / SEP_CYCLE_MS;

      // Complete as many full cycles as progress allows
      while (sep.progress >= 1) {
        // Re-check resource conditions before consuming each cycle
        if (
          state.economy.raw < SEP_RAW_COST ||
          state.economy.matter + SEP_MATTER_YIELD > state.economy.matterCap ||
          state.economy.elements[playerFaction] + SEP_ELEMENT_YIELD > state.economy.elementCap
        ) {
          sep.active = false;
          remainingPower += SEPARATOR_ACTIVE_POWER_CONSUMPTION;
          sep.progress = Math.min(sep.progress, 1);
          break;
        }

        // Consume raw, yield matter and elementUnits
        state.economy.raw -= SEP_RAW_COST;
        state.economy.matter += SEP_MATTER_YIELD;
        state.economy.elements[playerFaction] += SEP_ELEMENT_YIELD;

        sep.progress -= 1;
      }

      // After processing, re-check active state
      const stillHasResources =
        state.economy.raw >= SEP_RAW_COST &&
        state.economy.matter + SEP_MATTER_YIELD <= state.economy.matterCap &&
        state.economy.elements[playerFaction] + SEP_ELEMENT_YIELD <= state.economy.elementCap;
      if (!stillHasResources) {
        sep.active = false;
        remainingPower += SEPARATOR_ACTIVE_POWER_CONSUMPTION;
      }
    } else if (building.type === 'units-factory') {
      const factory = factoryMap.get(`${building.tx},${building.ty}`);
      if (!factory) continue;

      // Check if factory has anything to produce
      const unfinishedItem = factory.queue.find(item => !item.completed);
      if (!unfinishedItem) {
        factory.active = false;
        // Still try to spawn any completed items
        processFactorySpawns(state, factory);
        continue;
      }

      // Check power
      if (remainingPower < UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION) {
        factory.active = false;
        // Still try to spawn any completed items (doesn't consume power)
        processFactorySpawns(state, factory);
        continue;
      }

      // Allocate power for this factory
      remainingPower -= UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
      factory.active = true;

      // Advance progress on the first unfinished item
      const clampedDt = Math.min(dt, 200);
      unfinishedItem.elapsedMs += clampedDt;
      unfinishedItem.progress = Math.min(unfinishedItem.elapsedMs / unfinishedItem.durationMs, 1);

      if (unfinishedItem.progress >= 1) {
        unfinishedItem.completed = true;
        unfinishedItem.progress = 1;
      }

      // Try to spawn completed items
      processFactorySpawns(state, factory);
    }
  }

  // Mark any separators not found in mapData.buildings as inactive
  // (shouldn't happen in normal flow, but safety)
  for (const sep of state.economy.separators) {
    if (!separatorMap.has(`${sep.tx},${sep.ty}`)) {
      // Already processed above or not in buildings — skip
    }
  }

  // Mark any factories not found in mapData.buildings as inactive
  for (const factory of state.production.factories) {
    if (!factoryMap.has(`${factory.tx},${factory.ty}`)) {
      // Not in buildings — shouldn't happen
    }
  }
}

// ─── Factory spawn logic (ARCH-01F) ────────────────────────────────────

import type { UnitFactoryRuntimeState, BuilderPlacement } from './types';
import { buildOccupancyMap, isPassable } from './occupancy';

/**
 * Attempt to spawn all completed items at the front of a factory's queue.
 *
 * For each completed item at the front of the queue:
 * - Find a valid adjacent tile near the factory footprint
 * - Spawn the appropriate unit type
 * - Remove the item from the queue
 *
 * If no valid spawn tile exists, the completed item stays in queue
 * and will retry on the next tick.
 */
function processFactorySpawns(state: GameState, factory: UnitFactoryRuntimeState): void {
  while (factory.queue.length > 0 && factory.queue[0].completed) {
    const item = factory.queue[0];
    const spawnPos = findSpawnPosition(state, factory.tx, factory.ty);

    if (!spawnPos) {
      break;
    }

    if (item.unitType === 'builder') {
      spawnBuilder(state, spawnPos.tx, spawnPos.ty);
    } else if (item.unitType === 'harvester') {
      spawnHarvesterUnit(state, spawnPos.tx, spawnPos.ty);
    }

    factory.queue.shift();
  }
}

/**
 * Find a valid spawn position adjacent to the factory footprint.
 *
 * The factory has a 2x2 footprint at (tx, ty).
 * Search rings around the footprint for the first passable tile.
 */
function findSpawnPosition(
  state: GameState,
  factoryTx: number,
  factoryTy: number,
): { tx: number; ty: number } | null {
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
        return pos;
      }
    }
  }

  return null;
}

/**
 * Get candidate tile positions for a given ring around a rectangular footprint.
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

/**
 * Spawn a builder unit at the given tile position.
 */
function spawnBuilder(state: GameState, tx: number, ty: number): void {
  const builder: BuilderPlacement = {
    tx,
    ty,
    busy: false,
    phase: 'idle',
    path: [],
    pathIndex: 0,
    ftx: tx,
    fty: ty,
    targetTx: tx,
    targetTy: ty,
    assignedSiteId: -1,
  };
  state.mapData.builders.push(builder);

  state.entities.push({
    id: `builder-spawn-${tx}-${ty}-${Date.now()}`,
    kind: 'builder',
    tx,
    ty,
    faction: state.playerFaction,
  });
}

/**
 * Spawn a harvester unit at the given tile position.
 */
function spawnHarvesterUnit(state: GameState, tx: number, ty: number): void {
  const id = `harvester-spawn-${tx}-${ty}-${Date.now()}`;
  const harvester = createHarvester(id, tx, ty, state.playerFaction);
  state.harvesters.push(harvester);

  state.entities.push({
    id,
    kind: 'harvester',
    tx,
    ty,
    faction: state.playerFaction,
  });
}

// ─── Power state recomputation (ARCH-01E) ────────────────────────────────

/**
 * Recompute powerGenerated and powerConsumed from current state.
 *
 * powerGenerated = HQ_BASE_POWER + completed power-plant count * POWER_PLANT_GENERATION
 * powerConsumed = actual active power consumed this tick
 *
 * This is called after separator processing and factory production so that
 * powerConsumed reflects the active state determined during the update.
 */
function recomputePower(state: GameState): void {
  const powerPlantCount = state.mapData.buildings.filter(b => b.type === 'power-plant').length;
  state.economy.powerGenerated = HQ_BASE_POWER + powerPlantCount * POWER_PLANT_GENERATION;

  // powerConsumed = count of active separators * SEPARATOR_ACTIVE_POWER_CONSUMPTION
  //              + count of active factories producing * UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION
  const activeSeparatorCount = state.economy.separators.filter(s => s.active).length;
  const activeFactoryCount = state.production.factories.filter(f => f.active).length;
  state.economy.powerConsumed =
    activeSeparatorCount * SEPARATOR_ACTIVE_POWER_CONSUMPTION +
    activeFactoryCount * UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
}

// ─── Factory helpers ────────────────────────────────────────────────

/** Create a HarvesterState with sensible PR3 defaults. */
export function createHarvester(
  id: string,
  tx: number,
  ty: number,
  faction: Faction = 'cyan',
): HarvesterState {
  return {
    id,
    ftx: tx,
    fty: ty,
    faction,
    phase: 'idle',
    targetResourceId: null,
    cargoRaw: 0,
    cargoCapacity: DEFAULT_CARGO_CAPACITY,
    gatherTimer: 0,
    unloadTimer: 0,
    speedTilesPerSecond: DEFAULT_SPEED,
  };
}
