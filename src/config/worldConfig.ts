/** Isometric tile dimensions — must match the donor game baseline. */
export const TILE_W = 76;
export const TILE_H = 38;

/** Map dimensions for PR1 static scene. */
export const MAP_W = 48;
export const MAP_H = 48;

// ─── Modular tank visual tuning (PR5→PR7) ─────────────────────────

/** 2D offset point used for hull and turret positioning. */
export type Offset2D = { x: number; y: number };

/** Modular tank facing direction (0–7). Independent from asset module types. */
export type ModularTankDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Which modular layer is selected for tuning. */
export type TunerLayer = 'hull' | 'turret';

/** All 8 direction keys for iteration. */
const ALL_DIRS: ModularTankDirection[] = [0, 1, 2, 3, 4, 5, 6, 7];

/** Deep-clone a Record<ModularTankDirection, Offset2D> so runtime mutations are independent. */
function cloneOffsetRecord(
  src: Record<ModularTankDirection, Offset2D>,
): Record<ModularTankDirection, Offset2D> {
  const result = {} as Record<ModularTankDirection, Offset2D>;
  for (const d of ALL_DIRS) {
    result[d] = { ...src[d] };
  }
  return result;
}

// ─── Hull offsets by bodyDir ────────────────────────────────────

/** Default hull offset from tile anchor per body direction — approved baseline. */
export const DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR: Record<ModularTankDirection, Offset2D> = {
  0: { x: 2, y: 16 }, 1: { x: 2, y: 16 },
  2: { x: 2, y: 16 }, 3: { x: 2, y: 16 },
  4: { x: 2, y: 16 }, 5: { x: 2, y: 16 },
  6: { x: 2, y: 16 }, 7: { x: 2, y: 16 },
};

/**
 * Mutable runtime hull offsets by bodyDir — live-tuned via keyboard in debug overlay.
 * Each entry's .x / .y can be mutated in place; the object references per key are stable.
 */
export const MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR: Record<ModularTankDirection, Offset2D> =
  cloneOffsetRecord(DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR);

// ─── Turret mount offsets by bodyDir ────────────────────────────

/** Default turret mount (socket) offset from tile anchor per body direction — user-calibrated. */
export const DEFAULT_MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR: Record<ModularTankDirection, Offset2D> = {
  0: { x: -6, y: -9 },   1: { x: -9, y: -13 },
  2: { x: -6, y: -18 },  3: { x: 2, y: -18 },
  4: { x: 10, y: -18 },  5: { x: 13, y: -14 },
  6: { x: 10, y: -9 },   7: { x: 2, y: -7 },
};

/**
 * Mutable runtime turret mount offsets by bodyDir — live-tuned via keyboard in debug overlay.
 * Turret mount position depends on bodyDir only (NOT turretDir).
 */
export const MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR: Record<ModularTankDirection, Offset2D> =
  cloneOffsetRecord(DEFAULT_MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR);

// ─── Tuner state ────────────────────────────────────────────────

/** Current tuner selection state — only meaningful when debug overlay is ON. */
export const tunerState: {
  selectedLayer: TunerLayer;
  /** Current debug body direction for modular tank (Q/E cycling, overlay ON). */
  bodyDir: ModularTankDirection;
  /** Current debug turret direction for modular tank (Z/X cycling, overlay ON). */
  turretDir: ModularTankDirection;
} = {
  selectedLayer: 'hull',
  bodyDir: 2,
  turretDir: 2,
};
