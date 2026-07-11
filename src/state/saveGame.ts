/**
 * Save/load helpers — pure TypeScript, no Phaser.
 *
 * ARCH-15A: Local save/load skeleton using browser localStorage.
 * Stores a small list of versioned save slots with metadata and
 * serialized GameState.
 *
 * Design decisions:
 * - localStorage only (no cloud save, no autosave by default).
 * - Format is versioned; version mismatches are handled gracefully.
 * - Each save slot includes lightweight metadata for the save list UI
 *   and a full serialized GameState for reload.
 * - Corrupted or version-mismatched saves are silently skipped
 *   rather than crashing the load path.
 */

import type { Faction, GameState } from './types';
import { ensureBuilderIds } from './createInitialState';
import { normalizeVisionForLoadedState } from './visibility';
import { normalizeCombatUnitState } from './combatUnits';
import { normalizeMatchState } from './matchState';

// ─── Constants ──────────────────────────────────────────────────────

/** localStorage key for the save slots array. */
const SAVE_STORAGE_KEY = 'four-elements-save-slots';

/** Current save format version. Phase 2 fixup: canonical combat state + deterministic IDs. */
const SAVE_VERSION = 5;

/** Maximum number of save slots. */
export const MAX_SAVE_SLOTS = 5;

// ─── Types ──────────────────────────────────────────────────────────

/** Lightweight metadata for a save slot (displayed in save list UI). */
export interface SaveSlotMeta {
  /** Unique slot identifier (ISO timestamp of initial creation). */
  id: string;
  /** ISO timestamp when the save was first created. */
  createdAt: string;
  /** ISO timestamp when the save was last updated. */
  updatedAt: string;
  /** Player faction. */
  faction: Faction;
  /** Map ID. */
  mapId: string;
  /** Map display name. */
  mapName: string;
  /** Quick economy summary. */
  summary: SaveSummary;
  /** Save format version. */
  version: number;
}

/** Economy summary for the save list UI. */
export interface SaveSummary {
  raw: number;
  matter: number;
  powerConsumed: number;
  powerGenerated: number;
  resourcesCount: number;
  buildingsCount: number;
  harvestersCount: number;
  combatUnitsCount: number;
}

/** Full save slot payload: metadata + serialized game state. */
export interface SaveSlot extends SaveSlotMeta {
  /** Serialized GameState (JSON-compatible). */
  gameState: GameState;
}

/** Result of a save operation. */
export interface SaveResult {
  success: boolean;
  message: string;
  slotId?: string;
}

/** Result of a load operation. */
export interface LoadResult {
  success: boolean;
  message: string;
  gameState?: GameState;
}

// ─── Storage abstraction (injectable for tests) ────────────────────

/** Storage interface matching localStorage's async-safe subset. */
export interface SaveStorage {
  getItem(key: string): string | null;
  /** Returns true on success, false on failure (quota, unavailable, etc.). */
  setItem(key: string, value: string): boolean;
  removeItem(key: string): void;
}

/** Default storage using browser localStorage. */
const browserStorage: SaveStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      // localStorage may be unavailable (private browsing, quota, etc.)
      return null;
    }
  },
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // Quota exceeded or unavailable
      console.warn('[saveGame] localStorage.setItem failed');
      return false;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently ignore
    }
  },
};

// ─── Internal: read/write save slots ────────────────────────────────

/** Current storage backend (swappable for tests). */
let storage: SaveStorage = browserStorage;

/**
 * Set the storage backend. Use this in tests to inject a mock.
 * Not intended for production use outside of tests.
 */
export function setSaveStorage(s: SaveStorage): void {
  storage = s;
}

/** Reset storage to browser default. */
export function resetSaveStorage(): void {
  storage = browserStorage;
}

/** Read all save slots from storage. Returns empty array on error. */
function readSlots(): SaveSlot[] {
  const raw = storage.getItem(SAVE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out corrupted or version-mismatched slots
    return parsed.filter(isValidSlot);
  } catch {
    return [];
  }
}

/** Write all save slots to storage. Returns true on success. */
function writeSlots(slots: SaveSlot[]): boolean {
  return storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(slots));
}

/** Validate a single slot has the required structure. Accepts version 1, 2, and 3. */
function isValidSlot(slot: unknown): slot is SaveSlot {
  if (typeof slot !== 'object' || slot === null) return false;
  const s = slot as Record<string, unknown>;
  // Accept v1-v5; loadGame performs field migrations.
  if (s.version !== 1 && s.version !== 2 && s.version !== 3 && s.version !== 4 && s.version !== 5) return false;
  if (typeof s.id !== 'string') return false;
  if (typeof s.createdAt !== 'string') return false;
  if (typeof s.updatedAt !== 'string') return false;
  if (typeof s.faction !== 'string') return false;
  if (typeof s.mapId !== 'string') return false;
  if (!s.gameState || typeof s.gameState !== 'object') return false;
  return true;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Get metadata for all valid save slots, sorted by updatedAt descending.
 * Used by the Continue / save list UI.
 */
export function getSaveSlotMetas(): SaveSlotMeta[] {
  const slots = readSlots();
  return slots
    .map(({ gameState: _gs, ...meta }) => meta)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Check if at least one valid save exists.
 * Used to enable/disable the Continue button.
 */
export function hasSaves(): boolean {
  return readSlots().length > 0;
}

/**
 * Get the most recently updated save slot metadata, or null if no saves.
 */
export function getLatestSaveMeta(): SaveSlotMeta | null {
  const metas = getSaveSlotMetas();
  return metas.length > 0 ? metas[0] : null;
}

/**
 * Strip dev-only transient data from GameState before serialization.
 *
 * BLOCKOUT-02H fixup: blockoutVehicles are dev-only and must never
 * be persisted in saves. This function creates a sanitized copy
 * (does not mutate the input) with blockoutVehicles removed.
 *
 * Does not bump save version. Does not change save schema.
 */
function sanitizeForSave(gameState: GameState): GameState {
  const clone = (typeof structuredClone === 'function'
    ? structuredClone(gameState)
    : JSON.parse(JSON.stringify(gameState))) as GameState;
  const match = normalizeMatchState(clone);

  clone.blockoutVehicles = undefined;
  clone.blockoutObstacles = undefined;
  for (const teamId of match.activeTeamIds) {
    const team = match.teams[teamId];
    team.vision = {
      explored: team.vision.explored.map(row => [...row]),
      visible: [],
      dirty: true,
      revision: team.vision.revision,
    };
    team.economy = {
      ...team.economy,
      elements: { ...team.economy.elements },
      separators: team.economy.separators.map(separator => ({ ...separator })),
    };
  }

  const human = match.teams[match.humanTeamId];
  clone.economy = human.economy;
  clone.vision = human.vision;
  return clone;
}

/**
 * Save the current game state into a new or existing slot.
 *
 * If a slot with the given slotId exists, it is updated.
 * Otherwise a new slot is created (if under MAX_SAVE_SLOTS).
 *
 * BLOCKOUT-02H fixup: GameState is sanitized before writing to
 * ensure dev-only transient data (blockoutVehicles) is not persisted.
 */
export function saveGame(
  gameState: GameState,
  mapId: string,
  slotId?: string,
): SaveResult {
  const slots = readSlots();
  const now = new Date().toISOString();

  // BLOCKOUT-02H fixup: Strip dev-only data before serialization
  const sanitizedState = sanitizeForSave(gameState);

  const summary = buildSummary(sanitizedState);

  if (slotId) {
    // Update existing slot
    const idx = slots.findIndex(s => s.id === slotId);
    if (idx === -1) {
      return { success: false, message: 'Save slot not found' };
    }
    slots[idx] = {
      ...slots[idx],
      updatedAt: now,
      summary,
      version: SAVE_VERSION,
      gameState: sanitizedState,
    };
    if (!writeSlots(slots)) {
      return { success: false, message: 'Save failed' };
    }
    return { success: true, message: 'Saved', slotId };
  }

  // Create new slot
  if (slots.length >= MAX_SAVE_SLOTS) {
    return { success: false, message: `Max ${MAX_SAVE_SLOTS} save slots` };
  }

  const newId = now;
  const newSlot: SaveSlot = {
    id: newId,
    createdAt: now,
    updatedAt: now,
    faction: sanitizedState.playerFaction,
    mapId,
    mapName: sanitizedState.mapName,
    summary,
    version: SAVE_VERSION,
    gameState: sanitizedState,
  };

  slots.push(newSlot);
  if (!writeSlots(slots)) {
    return { success: false, message: 'Save failed' };
  }
  return { success: true, message: 'Saved', slotId: newId };
}

/**
 * Load a saved game state by slot ID.
 *
 * Validates the slot exists, has the correct version, and the game state
 * is parseable. Returns the GameState on success.
 */
export function loadGame(slotId: string): LoadResult {
  const slots = readSlots();
  const slot = slots.find(s => s.id === slotId);

  if (!slot) {
    return { success: false, message: 'Save not found' };
  }

  if (slot.version !== SAVE_VERSION && slot.version !== 1 && slot.version !== 2 && slot.version !== 3 && slot.version !== 4) {
    return { success: false, message: `Save version ${slot.version} not supported` };
  }

  // Basic gameState validation
  const gs = slot.gameState;
  if (!gs || typeof gs !== 'object') {
    return { success: false, message: 'Save data corrupted' };
  }
  if (typeof gs.playerFaction !== 'string') {
    return { success: false, message: 'Save data corrupted' };
  }
  if (!gs.economy || typeof gs.economy !== 'object') {
    return { success: false, message: 'Save data corrupted' };
  }

  // BUILDER-ID: Migrate old saves where builders lack 'id'.
  // loadGame() bypasses createInitialState, so we must apply the same
  // migration at the load boundary. ensureBuilderIds is idempotent —
  // builders with existing IDs are preserved.
  if (gs.mapData?.builders) {
    ensureBuilderIds(gs.mapData);
  }

  // Phase 2 fixup: migrate missing arrays, old combined mod fields,
  // duplicate/missing IDs and the deterministic ID counter.
  normalizeCombatUnitState(gs);

  // FOG-VISION-08 FIXUP-1: Normalize vision state for all saves (v1 and v2).
  // Handles: missing vision (v1 migration), empty/malformed visible grid
  // (sanitizeForSave strips visible=[]), wrong dimensions, missing revision.
  // Always sets dirty=true so recomputeVisibility runs on first update.
  gs.vision = normalizeVisionForLoadedState(
    gs.mapWidth ?? gs.mapData?.width ?? 48,
    gs.mapHeight ?? gs.mapData?.height ?? 48,
    gs.vision,
  );
  normalizeMatchState(gs);

  return { success: true, message: 'Loaded', gameState: gs };
}

/**
 * Delete a save slot by ID.
 */
export function deleteSave(slotId: string): boolean {
  const slots = readSlots();
  const filtered = slots.filter(s => s.id !== slotId);
  if (filtered.length === slots.length) return false;
  return writeSlots(filtered);
}

/**
 * Clear all save data. Used for testing or reset.
 */
export function clearAllSaves(): void {
  storage.removeItem(SAVE_STORAGE_KEY);
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Build a lightweight summary from the current game state. */
function buildSummary(gs: GameState): SaveSummary {
  return {
    raw: gs.economy.raw,
    matter: gs.economy.matter,
    powerConsumed: gs.economy.powerConsumed,
    powerGenerated: gs.economy.powerGenerated,
    resourcesCount: gs.resourceNodes.filter(r => !r.depleted).length,
    buildingsCount: gs.mapData.buildings.length,
    harvestersCount: gs.harvesters.length,
    combatUnitsCount: gs.combatUnits.length,
  };
}

/**
 * ARCH-14C: Format a save slot summary as a short readable string.
 * Pure function — used by save list UI rows.
 *
 * Example: "Raw: 42 | Matter: 80 | Power: 9/25 | Bldgs: 5 | Hrv: 2"
 */
export function formatSaveSlotSummary(summary: SaveSummary): string {
  const parts = [`Raw: ${summary.raw}`, `Matter: ${summary.matter}`];
  if (summary.powerGenerated > 0) {
    parts.push(`Power: ${summary.powerConsumed}/${summary.powerGenerated}`);
  }
  if (summary.buildingsCount > 0) {
    parts.push(`Bldgs: ${summary.buildingsCount}`);
  }
  if (summary.harvestersCount > 0) {
    parts.push(`Hrv: ${summary.harvestersCount}`);
  }
  if (summary.combatUnitsCount > 0) {
    parts.push(`Cmb: ${summary.combatUnitsCount}`);
  }
  return parts.join(' | ');
}

/**
 * ARCH-14C: Format a save slot's updatedAt ISO timestamp as a
 * locale-friendly date/time string. Pure function.
 */
export function formatSaveTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
