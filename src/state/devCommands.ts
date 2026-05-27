/**
 * Dev commands — pure TypeScript state mutations for devtools/QA.
 *
 * ARCH-11A: Provides safe, testable helper functions for the devtools panel.
 * All commands mutate GameState directly (same pattern as updateGameState).
 *
 * Design decisions:
 * - Pure TS, no Phaser, no DOM.
 * - Each command returns a result object with success/message.
 * - Resource commands respect caps by default; bypass is clearly labeled.
 * - Spawn commands use occupancy map to find valid tiles.
 * - Does NOT change economy values/timers/costs globally.
 */

import type { Faction, GameState } from './types';
import { ELEMENT_UNITS_PER_ELEMENT } from './types';
import { buildOccupancyMap, isPassable, isTileOccupiedByUnit } from './occupancy';
import { createHarvester } from './updateGameState';
import { isArenaEnabled, ARENA_MAP_ID } from './devArena';

// ─── Types ──────────────────────────────────────────────────────────

/** Result of a dev command. */
export interface DevCommandResult {
  success: boolean;
  message: string;
}

/** Amount added by the +Raw dev command. */
const DEV_RAW_ADD = 50;

/** Amount added by the +Matter dev command. */
const DEV_MATTER_ADD = 50;

/** Amount added by the +Faction Element dev command (in elementUnits). */
const DEV_ELEMENT_ADD = 50;

// ─── Activation helper ──────────────────────────────────────────────

/**
 * Check whether devtools should be active based on URL params.
 *
 * Checks for ?devtools=1 (or ?devtools=true).
 * Can also be toggled at runtime via keyboard (handled in GameScene).
 */
export function isDevtoolsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('devtools') === '1' || params.get('devtools') === 'true';
}

/**
 * Check whether arena mode should be active based on URL params.
 * Checks for ?arena=1 (or ?arena=true).
 * Exported for testing and GameScene wiring.
 */
export { isArenaEnabled, ARENA_MAP_ID };

// ─── Resource commands ──────────────────────────────────────────────

/**
 * Add raw minerals (respects rawCap).
 */
export function devAddRaw(state: GameState): DevCommandResult {
  const room = state.economy.rawCap - state.economy.raw;
  if (room <= 0) {
    return { success: false, message: 'Raw storage full' };
  }
  const add = Math.min(DEV_RAW_ADD, room);
  state.economy.raw += add;
  return { success: true, message: `+${add} Raw (${state.economy.raw}/${state.economy.rawCap})` };
}

/**
 * Add matter (respects matterCap).
 */
export function devAddMatter(state: GameState): DevCommandResult {
  const room = state.economy.matterCap - state.economy.matter;
  if (room <= 0) {
    return { success: false, message: 'Matter storage full' };
  }
  const add = Math.min(DEV_MATTER_ADD, room);
  state.economy.matter += add;
  return { success: true, message: `+${add} Matter (${state.economy.matter}/${state.economy.matterCap})` };
}

/**
 * Add faction element units (respects elementCap).
 */
export function devAddFactionElement(state: GameState): DevCommandResult {
  const faction = state.playerFaction;
  const current = state.economy.elements[faction];
  const room = state.economy.elementCap - current;
  if (room <= 0) {
    return { success: false, message: 'Element storage full' };
  }
  const add = Math.min(DEV_ELEMENT_ADD, room);
  state.economy.elements[faction] += add;
  const displayed = (state.economy.elements[faction] / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
  const capDisplayed = (state.economy.elementCap / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
  const label = faction.charAt(0).toUpperCase() + faction.slice(1);
  return { success: true, message: `+${(add / ELEMENT_UNITS_PER_ELEMENT).toFixed(1)} ${label} (${displayed}/${capDisplayed})` };
}

/**
 * Set all resources to their maximum values.
 * DEV-ONLY: bypasses normal cap constraints by setting values to caps.
 */
export function devMaxResources(state: GameState): DevCommandResult {
  state.economy.raw = state.economy.rawCap;
  state.economy.matter = state.economy.matterCap;
  state.economy.elements[state.playerFaction] = state.economy.elementCap;
  return { success: true, message: 'DEV: All resources maxed' };
}

/**
 * Set all resources to zero.
 */
export function devZeroResources(state: GameState): DevCommandResult {
  state.economy.raw = 0;
  state.economy.matter = 0;
  state.economy.elements[state.playerFaction] = 0;
  return { success: true, message: 'All resources zeroed' };
}

/**
 * Reset state to a fresh arena preset.
 * Returns mapId so GameScene can create a new GameState.
 * DEV-ONLY: This is a full state reset, not a partial modification.
 */
export function devResetArenaCommand(): DevCommandResult {
  return { success: true, message: `Arena reset. mapId=${ARENA_MAP_ID}` };
}

// ─── Spawn commands ─────────────────────────────────────────────────

/**
 * Spawn a builder unit near the HQ on a passable tile.
 */
export function devSpawnBuilder(state: GameState): DevCommandResult {
  const pos = findSpawnTileNearHq(state);
  if (!pos) {
    return { success: false, message: 'No valid spawn tile near HQ' };
  }

  const builder = {
    tx: pos.tx,
    ty: pos.ty,
    busy: false,
    phase: 'idle' as const,
    path: [],
    pathIndex: 0,
    ftx: pos.tx,
    fty: pos.ty,
    targetTx: pos.tx,
    targetTy: pos.ty,
    assignedSiteId: -1,
  };

  state.mapData.builders.push(builder);

  state.entities.push({
    id: `dev-builder-${pos.tx}-${pos.ty}-${Date.now()}`,
    kind: 'builder',
    tx: pos.tx,
    ty: pos.ty,
    faction: state.playerFaction,
  });

  return { success: true, message: `Builder spawned at (${pos.tx}, ${pos.ty})` };
}

/**
 * Spawn a harvester unit near the HQ on a passable tile.
 */
export function devSpawnHarvester(state: GameState): DevCommandResult {
  const pos = findSpawnTileNearHq(state);
  if (!pos) {
    return { success: false, message: 'No valid spawn tile near HQ' };
  }

  const id = `dev-harvester-${pos.tx}-${pos.ty}-${Date.now()}`;
  const harvester = createHarvester(id, pos.tx, pos.ty, state.playerFaction);
  state.harvesters.push(harvester);

  state.entities.push({
    id,
    kind: 'harvester',
    tx: pos.tx,
    ty: pos.ty,
    faction: state.playerFaction,
  });

  return { success: true, message: `Harvester spawned at (${pos.tx}, ${pos.ty})` };
}

// ─── Spawn tile selection ───────────────────────────────────────────

/**
 * Find a passable tile near the HQ for spawning a unit.
 *
 * Searches in expanding rings around the HQ 3x3 footprint.
 * Uses the occupancy map to avoid spawning inside buildings,
 * resources, or other impassable tiles.
 *
 * ARCH-11A fixup: Also rejects tiles currently occupied by
 * civil units (builders/harvesters) so repeated spawns
 * do not stack on the same tile. This is dev-spawn validation
 * only — it does not change the global passability model.
 *
 * Exported for testing.
 */
export function findSpawnTileNearHq(state: GameState): { tx: number; ty: number } | null {
  const hq = state.mapData.hq;
  const occupancyMap = buildOccupancyMap(state);

  // Search rings around the 3x3 HQ footprint
  for (let ring = 0; ring < 8; ring++) {
    const candidates = getHqRingCandidates(hq.tx, hq.ty, ring);

    for (const pos of candidates) {
      if (pos.tx < 0 || pos.ty < 0 ||
          pos.tx >= state.mapWidth || pos.ty >= state.mapHeight) {
        continue;
      }
      if (!isPassable(occupancyMap, pos.tx, pos.ty)) {
        continue;
      }
      // Reject tiles already occupied by civil units (dev-spawn validation only)
      if (isTileOccupiedByUnit(state, pos.tx, pos.ty)) {
        continue;
      }
      return pos;
    }
  }

  return null;
}

/**
 * Get candidate tile positions for a ring around the HQ 3x3 footprint.
 */
function getHqRingCandidates(
  hqTx: number,
  hqTy: number,
  ring: number,
): Array<{ tx: number; ty: number }> {
  const candidates: Array<{ tx: number; ty: number }> = [];
  const fpW = 3;
  const fpH = 3;

  // North edge
  for (let dx = -ring; dx < fpW + ring; dx++) {
    candidates.push({ tx: hqTx + dx, ty: hqTy - 1 - ring });
  }
  // South edge
  for (let dx = -ring; dx < fpW + ring; dx++) {
    candidates.push({ tx: hqTx + dx, ty: hqTy + fpH + ring });
  }
  // West edge (excluding corners already covered)
  for (let dy = 0; dy < fpH; dy++) {
    candidates.push({ tx: hqTx - 1 - ring, ty: hqTy + dy });
  }
  // East edge (excluding corners already covered)
  for (let dy = 0; dy < fpH; dy++) {
    candidates.push({ tx: hqTx + fpW + ring, ty: hqTy + dy });
  }

  return candidates;
}

// ─── Diagnostics helper ─────────────────────────────────────────────

/** Diagnostics snapshot returned by devGetDiagnostics. */
export interface DevDiagnostics {
  faction: Faction;
  mapName: string;
  raw: number;
  rawCap: number;
  matter: number;
  matterCap: number;
  powerConsumed: number;
  powerGenerated: number;
  resourceNodeCount: number;
  activeHarvesterCount: number;
  builderCount: number;
  constructionSiteCount: number;
  separatorCount: number;
  factoryQueueSummary: string;
}

/**
 * Get a diagnostics snapshot from the current game state.
 * Pure function — does not mutate state.
 */
export function devGetDiagnostics(state: GameState): DevDiagnostics {
  const factories = state.production.factories;
  let factoryQueueSummary = 'None';
  if (factories.length > 0) {
    const parts: string[] = [];
    for (let i = 0; i < factories.length; i++) {
      const f = factories[i];
      if (f.queue.length === 0) {
        parts.push(`F${i + 1}: idle`);
      } else {
        const slots = f.queue.map(item => {
          const typeChar = item.unitType === 'builder' ? 'B' : 'H';
          const pct = item.completed ? 'done' : `${Math.round(item.progress * 100)}%`;
          return `${typeChar}${pct}`;
        });
        parts.push(`F${i + 1}: ${slots.join('|')}`);
      }
    }
    factoryQueueSummary = parts.join(', ');
  }

  return {
    faction: state.playerFaction,
    mapName: state.mapName,
    raw: state.economy.raw,
    rawCap: state.economy.rawCap,
    matter: state.economy.matter,
    matterCap: state.economy.matterCap,
    powerConsumed: state.economy.powerConsumed,
    powerGenerated: state.economy.powerGenerated,
    resourceNodeCount: state.resourceNodes.filter(r => !r.depleted).length,
    activeHarvesterCount: state.harvesters.filter(h => h.phase !== 'idle').length,
    builderCount: state.mapData.builders.length,
    constructionSiteCount: state.mapData.constructionSites.length,
    separatorCount: state.economy.separators.length,
    factoryQueueSummary,
  };
}
