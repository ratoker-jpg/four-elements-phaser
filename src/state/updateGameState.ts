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

  // Transfer cargo to player economy
  state.economy.raw += h.cargoRaw;
  h.cargoRaw = 0;
  h.phase = 'idle';
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
