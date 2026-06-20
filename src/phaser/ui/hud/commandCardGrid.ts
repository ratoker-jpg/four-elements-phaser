/**
 * Command Card Grid — stable 4×3 grid model for AoE4-inspired command card.
 *
 * COMMAND-CARD-REBUILD-03: Defines the grid slot layout, hotkey mapping,
 * and slot-to-command assignment logic. The grid is the single source of
 * truth for which command goes in which slot and which hotkey activates it.
 *
 * Grid layout (matching keyboard spatial layout):
 *   Row 1: Q  W  E  R
 *   Row 2: A  S  D  F
 *   Row 3: Z  X  C  V
 *
 * Key design decisions:
 *   - 12 fixed slots, each with a stable slot key and hotkey
 *   - Empty slots are explicit (not collapsed) for muscle memory
 *   - Slot positions never change based on context
 *   - Hidden commands leave their slot empty
 *   - The grid model is pure data — no DOM, no Phaser, no mutation
 */

// ─── Grid constants ────────────────────────────────────────────────

/** Number of columns in the command card grid. */
export const GRID_COLS = 4;

/** Number of rows in the command card grid. */
export const GRID_ROWS = 3;

/** Total number of slots in the grid. */
export const GRID_SLOT_COUNT = GRID_COLS * GRID_ROWS; // 12

// ─── Slot key type ─────────────────────────────────────────────────

/** Slot keys follow the keyboard spatial layout. */
export type SlotKey =
  | 'Q' | 'W' | 'E' | 'R'
  | 'A' | 'S' | 'D' | 'F'
  | 'Z' | 'X' | 'C' | 'V';

/** All 12 slot keys in grid order (row-major). */
export const ALL_SLOT_KEYS: SlotKey[] = [
  'Q', 'W', 'E', 'R',
  'A', 'S', 'D', 'F',
  'Z', 'X', 'C', 'V',
];

// ─── Slot metadata ─────────────────────────────────────────────────

/** Metadata for a single grid slot. */
export interface GridSlotMeta {
  /** Slot key (e.g. 'Q', 'W', etc.) */
  slotKey: SlotKey;
  /** Row index (0-based, 0 = top row = QWER) */
  row: number;
  /** Column index (0-based) */
  col: number;
  /** Keyboard hotkey string — same as slotKey */
  hotkey: string;
}

/** Precomputed metadata for all 12 grid slots, indexed by slot key. */
const SLOT_META_MAP: Map<SlotKey, GridSlotMeta> = new Map();
const SLOT_META_ARRAY: GridSlotMeta[] = [];

// Initialize slot metadata
for (let i = 0; i < ALL_SLOT_KEYS.length; i++) {
  const slotKey = ALL_SLOT_KEYS[i];
  const row = Math.floor(i / GRID_COLS);
  const col = i % GRID_COLS;
  const meta: GridSlotMeta = { slotKey, row, col, hotkey: slotKey };
  SLOT_META_MAP.set(slotKey, meta);
  SLOT_META_ARRAY.push(meta);
}

/** Get metadata for a specific slot key. */
export function getSlotMeta(slotKey: SlotKey): GridSlotMeta {
  return SLOT_META_MAP.get(slotKey)!;
}

/** Get all slot metadata in grid order. */
export function getAllSlotMeta(): GridSlotMeta[] {
  return SLOT_META_ARRAY;
}

/** Get the slot key for a given row and column. */
export function getSlotKeyAt(row: number, col: number): SlotKey {
  const idx = row * GRID_COLS + col;
  return ALL_SLOT_KEYS[idx];
}

/** Get the Phaser keyboard key code string for a slot key. */
export function slotKeyToPhaserKey(slotKey: SlotKey): string {
  return slotKey; // Phaser uses uppercase letter for keydown-X events
}

// ─── Command card descriptor ───────────────────────────────────────

/** The visual/interaction state of a command card slot. */
export type CommandSlotState = 'enabled' | 'disabled' | 'empty';

/** A single command card slot descriptor. */
export interface CommandCardSlot {
  /** The grid slot key this command occupies. */
  slotKey: SlotKey;
  /** Grid row (0-based). */
  row: number;
  /** Grid column (0-based). */
  col: number;
  /** Hotkey label for this slot (same as slotKey). */
  hotkey: string;
  /** Unique command id matching commandRegistry id, e.g. 'build-separator'. */
  commandId: string;
  /** Display label, e.g. 'Separator'. */
  label: string;
  /** Slot state: enabled, disabled, or empty. */
  state: CommandSlotState;
  /** Reason the command is disabled, or empty string. */
  disabledReason: string;
  /** Cost display string, e.g. '60 M', or empty string. */
  cost: string;
  /** Full tooltip text. */
  tooltip: string;
  /** Command category for grouping. */
  category: 'build' | 'produce' | 'unit-action' | 'building-action' | 'none';
}

/** The full command card view model — 12 fixed slots. */
export interface CommandCardViewModel {
  /** Context kind — what's selected. */
  contextKind: 'none' | 'builder' | 'harvester' | 'building' | 'unknown';
  /** Context label — e.g. 'Builder', 'Units Factory', or empty. */
  contextLabel: string;
  /** All 12 grid slots in row-major order. Empty slots have state 'empty'. */
  slots: CommandCardSlot[];
}

// ─── Slot assignment helpers ────────────────────────────────────────

/** Create an empty slot descriptor for a given slot key. */
export function emptySlot(slotKey: SlotKey): CommandCardSlot {
  const meta = getSlotMeta(slotKey);
  return {
    slotKey,
    row: meta.row,
    col: meta.col,
    hotkey: meta.hotkey,
    commandId: '',
    label: '',
    state: 'empty',
    disabledReason: '',
    cost: '',
    tooltip: '',
    category: 'none',
  };
}

/** Create a fully empty 12-slot grid. */
export function emptyGrid(): CommandCardSlot[] {
  return ALL_SLOT_KEYS.map(emptySlot);
}

/** Assign a command to a specific slot, replacing the empty slot. */
export function assignSlot(
  grid: CommandCardSlot[],
  slotKey: SlotKey,
  commandId: string,
  label: string,
  state: CommandSlotState,
  disabledReason: string,
  cost: string,
  tooltip: string,
  category: CommandCardSlot['category'],
): CommandCardSlot[] {
  const idx = ALL_SLOT_KEYS.indexOf(slotKey);
  if (idx === -1) return grid;

  const meta = getSlotMeta(slotKey);
  const newGrid = [...grid];
  newGrid[idx] = {
    slotKey,
    row: meta.row,
    col: meta.col,
    hotkey: meta.hotkey,
    commandId,
    label,
    state,
    disabledReason,
    cost,
    tooltip,
    category,
  };
  return newGrid;
}

// ─── Slot assignment mapping per context ────────────────────────────

/**
 * Builder context slot assignment.
 *
 * Row 1 (Q/W/E/R): Core build commands
 * Row 2 (A/S/D/F): Advanced build commands
 * Row 3 (Z/X/C/V): Utility — Stop in Z slot
 *
 * Slot positions are STABLE for muscle memory.
 * If a building doesn't exist yet, the slot is empty (not shuffled).
 */
export const BUILDER_SLOT_MAP: { slotKey: SlotKey; buildingType: string }[] = [
  { slotKey: 'Q', buildingType: 'separator' },
  { slotKey: 'W', buildingType: 'raw-storage' },
  { slotKey: 'E', buildingType: 'matter-storage' },
  { slotKey: 'R', buildingType: 'element-storage' },
  { slotKey: 'A', buildingType: 'power-plant' },
  { slotKey: 'S', buildingType: 'units-factory' },
  // D, F: future buildings
  // Z: Stop command
];

/** Slot key for the Stop command in any unit context. */
export const STOP_SLOT: SlotKey = 'Z';

/**
 * Harvester context slot assignment.
 *
 * Only the Stop command occupies slot Z.
 * All other slots are empty.
 */

/**
 * No-selection context slot assignment.
 *
 * All slots empty. No commands available without a selection.
 */
