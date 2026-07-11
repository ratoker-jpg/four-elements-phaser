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
  ModularCombatUnit,
  ProductionQueueItem,
  TeamId,
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
import { buildOccupancyMap, isPassable, addUnitBlockers, addVehicleBlockers } from './occupancy';
import { findPath, findPathToAdjacent } from './pathfinding';
import { updateHarvesterManualMove, findResourceApproachTile } from './unitCommands';
import { isResourceInfinite } from '../config/resourceClassRuntime';
import { allocateCombatUnitId, createCombatUnitRuntime, getCombatProductionConfig } from './combatUnits';
import { updateAllCombatUnitMovement } from './combatUnitMovement';
import { updateAllCombatUnitCombat } from './combatUnitCombat';
import { getOwningTeam, normalizeMatchState } from './matchState';
export { directionFromDelta } from './unitDirection';

// ─── Constants ──────────────────────────────────────────────────────

/** Duration of one gather cycle in milliseconds. */
const GATHER_DURATION_MS = 1000;

/** Duration of one unload cycle in milliseconds. */
const UNLOAD_DURATION_MS = 500;

/** Default harvester cargo capacity. */
const DEFAULT_CARGO_CAPACITY = 20;

/** Default harvester movement speed (tiles per second). */
const DEFAULT_SPEED = 2.5;

/**
 * Distance threshold (in tiles) to consider "arrived" at a target.
 * ARCH-05Y: Reduced from 0.25 to 0.03 to eliminate visible waypoint snap.
 * At 0.03 tiles (~0.57px at 19px/tile-Y), the snap is sub-pixel and
 * invisible — no render-side smoothing layer needed. Matches builder
 * threshold which has zero visible snap in practice.
 */
const ARRIVAL_THRESHOLD = 0.03;

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Advance game state by deltaMs milliseconds.
 *
 * Mutates the state object in place. This is acceptable for PR3 and
 * documented here. The function remains pure TypeScript and deterministic
 * given the same input state and delta.
 */
export function updateGameState(state: GameState, deltaMs: number): void {
  normalizeMatchState(state);
  // Clamp delta for movement to prevent huge jumps after tab-switch.
  // Production/separators use the full deltaMs for accurate time advancement.
  const moveDt = Math.min(deltaMs, 200);

  for (const harvester of state.harvesters) {
    updateHarvester(state, harvester, moveDt);
  }
  updateAllCombatUnitCombat(state, moveDt);
  updateAllCombatUnitMovement(state, moveDt);

  // ARCH-01C/01E/01F: Unified power allocation + separator processing + factory production.
  // Power consumers (separators, factories) are allocated power in completed building order.
  allocatePowerAndProcess(state, deltaMs);

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
    case 'manual-move':
      updateHarvesterManualMove(state, h, dt);
      break;
  }
}

// ── idle ──────────────────────────────────────────────────────────

function handleIdle(state: GameState, h: HarvesterState): void {
  // Clean up any stale path data from previous phases
  if (h.approachPath || h.returnPath || h.manualPath) {
    h.approachPath = undefined;
    h.approachPathIndex = undefined;
    h.returnPath = undefined;
    h.returnPathIndex = undefined;
    h.manualPath = undefined;
    h.manualPathIndex = undefined;
    h.manualCooldownMs = undefined;
    h.blockedReason = undefined;
  }

  const target = findNearestAvailableResource(state, h);
  if (!target) {
    // No available resource — set blocked reason so player knows why
    h.blockedReason = 'no-resources';
    return;
  }

  h.targetResourceId = target.id;
  // Do NOT clear blockedReason here — it persists until actual progress is
  // confirmed (approach path assigned, gathering started, unload progress,
  // or manual move issued). Clearing it just because a target was selected
  // causes the UI to flicker between blocked and moving on repeat failures.
  h.phase = 'moving-to-resource';
}

// ── moving-to-resource ────────────────────────────────────────────

/**
 * ARCH-05X: Harvester now uses BFS pathfinding to an adjacent approach
 * tile instead of straight-line movement to the resource center.
 *
 * The harvester must NOT move onto the exact resource tile.
 * Instead, it paths to the nearest passable tile adjacent to the
 * resource footprint and gathers from there.
 *
 * Path is stored on the harvester as _approachPath (array of tile coords).
 * The harvester follows the path waypoint by waypoint.
 */
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
    h.approachPath = undefined;
    h.approachPathIndex = undefined;
    h.blockedReason = undefined;
    return;
  }

  // On first entry, compute approach path
  if (!h.approachPath) {
    const approachResult = findResourceApproachTile(
      state, h.ftx, h.fty, target.tx, target.ty, target.footprint,
    );

    if (!approachResult.ok) {
      // No approach tile — resource is surrounded by impassable tiles
      h.targetResourceId = null;
      h.phase = 'idle';
      h.blockedReason = 'no-approach-path';
      return;
    }

    const startTx = Math.round(h.ftx);
    const startTy = Math.round(h.fty);
    const occupancy = buildOccupancyMap(state);
    // CORE-STEP-06H+ fixup: Respect other units and vehicles during auto-gather pathfinding
    addUnitBlockers(state, occupancy, 'harvester', h.id);
    if (state.blockoutVehicles) {
      addVehicleBlockers(state.blockoutVehicles, occupancy);
    }

    // If already at approach tile, skip movement
    if (startTx === approachResult.approachTx && startTy === approachResult.approachTy) {
      h.ftx = approachResult.approachTx;
      h.fty = approachResult.approachTy;
      h.gatherTimer = GATHER_DURATION_MS;
      h.phase = 'gathering';
      h.approachPath = undefined;
      h.approachPathIndex = undefined;
      h.blockedReason = undefined;
      return;
    }

    const path = findPath(occupancy, startTx, startTy, approachResult.approachTx, approachResult.approachTy);
    if (!path || path.length === 0) {
      // No path to approach tile — skip this resource
      h.targetResourceId = null;
      h.phase = 'idle';
      h.blockedReason = 'no-approach-path';
      return;
    }

    h.approachPath = path;
    h.approachPathIndex = 0;
    h.blockedReason = undefined;
    return; // movement will start on next frame tick
  }

  // Follow approach path
  const currentPath = h.approachPath;
  const pathIndex = h.approachPathIndex ?? 0;
  if (pathIndex >= currentPath.length) {
    // Arrived at approach tile
    h.gatherTimer = GATHER_DURATION_MS;
    h.phase = 'gathering';
    h.approachPath = undefined;
    h.approachPathIndex = undefined;
    h.blockedReason = undefined;
    return;
  }

  const waypoint = currentPath[pathIndex];
  const arrived = moveToward(h, waypoint.tx, waypoint.ty, dt);

  if (arrived) {
    h.ftx = waypoint.tx;
    h.fty = waypoint.ty;
    h.approachPathIndex = pathIndex + 1;

    if (h.approachPathIndex >= currentPath.length) {
      // Arrived at approach tile — start gathering
      h.gatherTimer = GATHER_DURATION_MS;
      h.phase = 'gathering';
      h.approachPath = undefined;
      h.approachPathIndex = undefined;
      h.blockedReason = undefined;
    }
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

  // CORE-STEP-03C: Use isResourceInfinite which checks resourceClass
  // when present, falling back to legacy resourceType for old/saved resources.
  if (isResourceInfinite(target.resourceClass, target.resourceType)) {
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

/**
 * ARCH-05X hardened: Harvester uses BFS pathfinding back to HQ.
 *
 * If BFS fails (no path to HQ), the harvester enters a blocked state
 * instead of falling back to straight-line movement through obstacles.
 * The blocked reason is stored in h.blockedReason for debug telemetry.
 * The harvester stays in 'returning-to-hq' phase and retries each tick
 * in case the map changes (e.g. a building is destroyed in the future).
 */
function handleReturningToHQ(
  state: GameState,
  h: HarvesterState,
  dt: number,
): void {
  // On first entry, compute return path
  if (!h.returnPath) {
    const owner = getOwningTeam(state, h.ownerTeamId, h.faction);
    const ownerHq = owner.hqPosition ?? state.hqPosition;
    const hqTx = ownerHq.tx;
    const hqTy = ownerHq.ty;
    const startTx = Math.round(h.ftx);
    const startTy = Math.round(h.fty);
    const occupancy = buildOccupancyMap(state);
    // CORE-STEP-06H+ fixup: Respect other units and vehicles during return pathfinding
    addUnitBlockers(state, occupancy, 'harvester', h.id);
    if (state.blockoutVehicles) {
      addVehicleBlockers(state.blockoutVehicles, occupancy);
    }

    // Path to a tile adjacent to HQ (HQ is 3x3 impassable)
    const path = findPathToAdjacent(occupancy, startTx, startTy, hqTx - 1, hqTy - 1, 3, 3);
    if (!path) {
      // No path to adjacent — try direct path to a tile near HQ as fallback
      // (but NOT straight-line movement through obstacles)
      const directPath = findPath(occupancy, startTx, startTy, hqTx, hqTy);
      if (!directPath) {
        // Truly no route — harvester is blocked. Stay safe, don't walk through obstacles.
        h.blockedReason = 'no-path-to-hq';
        // Remain in returning-to-hq phase; will retry path computation next tick
        return;
      }
      if (directPath.length === 0) {
        // Already at HQ center
        h.unloadTimer = UNLOAD_DURATION_MS;
        h.phase = 'unloading';
        h.returnPath = undefined;
        h.returnPathIndex = undefined;
        h.blockedReason = undefined;
        return;
      }
      h.returnPath = directPath;
      h.returnPathIndex = 0;
      h.blockedReason = undefined;
      return;
    }

    if (path.length === 0) {
      // Already adjacent to HQ
      h.unloadTimer = UNLOAD_DURATION_MS;
      h.phase = 'unloading';
      h.returnPath = undefined;
      h.returnPathIndex = undefined;
      h.blockedReason = undefined;
      return;
    }

    h.returnPath = path;
    h.returnPathIndex = 0;
    h.blockedReason = undefined;
    return;
  }

  // Follow return path
  const pathIndex = h.returnPathIndex ?? 0;
  if (pathIndex >= h.returnPath.length) {
    // Arrived at HQ
    h.unloadTimer = UNLOAD_DURATION_MS;
    h.phase = 'unloading';
    h.returnPath = undefined;
    h.returnPathIndex = undefined;
    h.blockedReason = undefined;
    return;
  }

  const waypoint = h.returnPath[pathIndex];
  const arrived = moveToward(h, waypoint.tx, waypoint.ty, dt);

  if (arrived) {
    h.ftx = waypoint.tx;
    h.fty = waypoint.ty;
    h.returnPathIndex = pathIndex + 1;

    if (h.returnPathIndex >= h.returnPath.length) {
      h.unloadTimer = UNLOAD_DURATION_MS;
      h.phase = 'unloading';
      h.returnPath = undefined;
      h.returnPathIndex = undefined;
      h.blockedReason = undefined;
    }
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

  const owner = getOwningTeam(state, h.ownerTeamId, h.faction);
  const economy = owner.economy;

  // ARCH-01D: Enforce raw cap on harvester unload.
  // Transfer as much cargo as fits within rawCap; keep remaining in cargo.
  // Do not lose cargo silently — if raw is at cap, keep cargo and wait.
  const room = economy.rawCap - economy.raw;
  if (room <= 0) {
    // Raw storage full — keep cargo, stay at HQ position.
    // Set a short unload timer so the harvester retries next frame
    // instead of immediately re-entering the unload phase without a delay.
    h.unloadTimer = UNLOAD_DURATION_MS;
    h.blockedReason = 'raw-storage-full';
    return;
  }

  const transfer = Math.min(h.cargoRaw, room);
  economy.raw += transfer;
  h.cargoRaw -= transfer;
  h.blockedReason = undefined; // Making progress — clear any previous block

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
  const match = normalizeMatchState(state);
  const remainingPower = new Map<TeamId, number>();
  for (const teamId of match.activeTeamIds) {
    const team = match.teams[teamId];
    const powerPlants = state.mapData.buildings.filter(
      building => (building.ownerTeamId ?? match.humanTeamId) === teamId && building.type === 'power-plant',
    ).length;
    remainingPower.set(teamId, (team.hqPosition ? HQ_BASE_POWER : 0) + powerPlants * POWER_PLANT_GENERATION);
  }

  const separatorMap = new Map<string, typeof state.economy.separators[0]>();
  for (const teamId of match.activeTeamIds) {
    for (const separator of match.teams[teamId].economy.separators) {
      const ownerTeamId = separator.ownerTeamId ?? teamId;
      separatorMap.set(`${ownerTeamId}:${separator.tx},${separator.ty}`, separator);
    }
  }

  const factoryMap = new Map<string, typeof state.production.factories[0]>();
  for (const factory of state.production.factories) {
    const ownerTeamId = factory.ownerTeamId ?? match.humanTeamId;
    factoryMap.set(`${ownerTeamId}:${factory.tx},${factory.ty}`, factory);
  }

  for (const building of state.mapData.buildings) {
    const ownerTeamId = building.ownerTeamId ?? match.humanTeamId;
    const owner = match.teams[ownerTeamId];
    let availablePower = remainingPower.get(ownerTeamId) ?? 0;

    if (building.type === 'separator') {
      const separator = separatorMap.get(`${ownerTeamId}:${building.tx},${building.ty}`);
      if (!separator) continue;
      const economy = owner.economy;
      const hasResources =
        economy.raw >= SEP_RAW_COST
        && economy.matter + SEP_MATTER_YIELD <= economy.matterCap
        && economy.elements[owner.faction] + SEP_ELEMENT_YIELD <= economy.elementCap;
      if (!hasResources || availablePower < SEPARATOR_ACTIVE_POWER_CONSUMPTION) {
        separator.active = false;
        continue;
      }

      availablePower -= SEPARATOR_ACTIVE_POWER_CONSUMPTION;
      remainingPower.set(ownerTeamId, availablePower);
      separator.active = true;
      separator.progress += dt / SEP_CYCLE_MS;
      while (separator.progress >= 1) {
        if (
          economy.raw < SEP_RAW_COST
          || economy.matter + SEP_MATTER_YIELD > economy.matterCap
          || economy.elements[owner.faction] + SEP_ELEMENT_YIELD > economy.elementCap
        ) {
          separator.active = false;
          remainingPower.set(ownerTeamId, availablePower + SEPARATOR_ACTIVE_POWER_CONSUMPTION);
          separator.progress = Math.min(separator.progress, 1);
          break;
        }
        economy.raw -= SEP_RAW_COST;
        economy.matter += SEP_MATTER_YIELD;
        economy.elements[owner.faction] += SEP_ELEMENT_YIELD;
        separator.progress -= 1;
      }
    } else if (building.type === 'units-factory') {
      const factory = factoryMap.get(`${ownerTeamId}:${building.tx},${building.ty}`);
      if (!factory) continue;
      const unfinishedItem = factory.queue.find(item => !item.completed);
      if (!unfinishedItem) {
        factory.active = false;
        processFactorySpawns(state, factory);
        continue;
      }
      if (availablePower < UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION) {
        factory.active = false;
        processFactorySpawns(state, factory);
        continue;
      }
      availablePower -= UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
      remainingPower.set(ownerTeamId, availablePower);
      factory.active = true;
      unfinishedItem.elapsedMs += dt;
      unfinishedItem.progress = Math.min(unfinishedItem.elapsedMs / unfinishedItem.durationMs, 1);
      if (unfinishedItem.progress >= 1) {
        unfinishedItem.completed = true;
        unfinishedItem.progress = 1;
      }
      processFactorySpawns(state, factory);
    }
  }
}

// ─── Factory spawn logic (ARCH-01F) ────────────────────────────────────

import type { UnitFactoryRuntimeState, BuilderPlacement } from './types';

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
    // FIX-03: Spawn-time cap recheck.
    // Queued units do NOT count toward cap, but spawning a completed
    // item must recheck the live unit count. If cap is reached, the
    // completed item stays in queue and retries on later ticks.
    // Phase 2: combat units count toward the cap.
    const match = normalizeMatchState(state);
    const ownerTeamId = factory.ownerTeamId ?? match.humanTeamId;
    const owner = match.teams[ownerTeamId];
    const liveUnitCount =
      state.mapData.builders.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length
      + state.harvesters.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length
      + state.combatUnits.filter(unit => (unit.ownerTeamId ?? match.humanTeamId) === ownerTeamId).length;
    if (liveUnitCount >= owner.unitCap) {
      break;
    }

    const item = factory.queue[0];
    const spawnPos = findSpawnPosition(state, factory.tx, factory.ty);

    if (!spawnPos) {
      break;
    }

    if (item.unitType === 'builder') {
      spawnBuilder(state, spawnPos.tx, spawnPos.ty, ownerTeamId);
    } else if (item.unitType === 'harvester') {
      spawnHarvesterUnit(state, spawnPos.tx, spawnPos.ty, ownerTeamId);
    } else if (item.unitType === 'wasp-smoky') {
      spawnCombatUnit(state, spawnPos.tx, spawnPos.ty, item, ownerTeamId);
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
function spawnBuilder(state: GameState, tx: number, ty: number, ownerTeamId: TeamId): void {
  const owner = getOwningTeam(state, ownerTeamId);
  // BUILDER-ID: Generate a stable, unique ID for the spawned builder.
  const id = `builder-spawn-${tx}-${ty}-${Date.now()}`;
  const builder: BuilderPlacement = {
    id,
    ownerTeamId: owner.id,
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
    id,
    kind: 'builder',
    tx,
    ty,
    faction: owner.faction,
    ownerTeamId: owner.id,
  });
}

/**
 * Spawn a harvester unit at the given tile position.
 */
function spawnHarvesterUnit(state: GameState, tx: number, ty: number, ownerTeamId: TeamId): void {
  const owner = getOwningTeam(state, ownerTeamId);
  const id = `harvester-spawn-${tx}-${ty}-${Date.now()}`;
  const harvester = createHarvester(id, tx, ty, owner.faction, owner.id);
  state.harvesters.push(harvester);

  state.entities.push({
    id,
    kind: 'harvester',
    tx,
    ty,
    faction: owner.faction,
    ownerTeamId: owner.id,
  });
}

/**
 * Phase 2: Spawn a wasp+smoky combat unit at the given tile position.
 *
 * Creates a ModularCombatUnit and a corresponding RenderableEntity.
 * Combat units count toward DEFAULT_UNIT_CAP.
 */
function spawnCombatUnit(
  state: GameState,
  tx: number,
  ty: number,
  item: ProductionQueueItem,
  ownerTeamId: TeamId,
): void {
  const owner = getOwningTeam(state, ownerTeamId);
  const config = getCombatProductionConfig(item);
  if (!config) return;

  const combatUnit: ModularCombatUnit = {
    id: allocateCombatUnitId(state),
    ownerTeamId: owner.id,
    tx,
    ty,
    bodyId: config.bodyId,
    weaponId: config.weaponId,
    hullMod: config.hullMod,
    turretMod: config.turretMod,
    faction: owner.faction,
    dir: 2,
    turretDir: 2,
  };
  combatUnit.runtime = createCombatUnitRuntime(combatUnit);

  // combatUnits is the sole canonical state. EntityRenderer derives visuals
  // from it each frame; do not duplicate produced units in state.entities.
  state.combatUnits.push(combatUnit);
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
  const match = normalizeMatchState(state);
  for (const teamId of match.activeTeamIds) {
    const team = match.teams[teamId];
    const powerPlantCount = state.mapData.buildings.filter(
      building => (building.ownerTeamId ?? match.humanTeamId) === teamId && building.type === 'power-plant',
    ).length;
    team.economy.powerGenerated = (team.hqPosition ? HQ_BASE_POWER : 0)
      + powerPlantCount * POWER_PLANT_GENERATION;
    const activeSeparatorCount = team.economy.separators.filter(separator => separator.active).length;
    const activeFactoryCount = state.production.factories.filter(
      factory => (factory.ownerTeamId ?? match.humanTeamId) === teamId && factory.active,
    ).length;
    team.economy.powerConsumed =
      activeSeparatorCount * SEPARATOR_ACTIVE_POWER_CONSUMPTION
      + activeFactoryCount * UNITS_FACTORY_ACTIVE_POWER_CONSUMPTION;
  }
}

// ─── Factory helpers ────────────────────────────────────────────────

/** Create a HarvesterState with sensible PR3 defaults. */
export function createHarvester(
  id: string,
  tx: number,
  ty: number,
  faction: Faction = 'cyan',
  ownerTeamId?: TeamId,
): HarvesterState {
  return {
    id,
    ownerTeamId,
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
