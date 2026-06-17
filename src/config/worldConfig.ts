/** Isometric tile dimensions — must match the donor game baseline. */
export const TILE_W = 76;
export const TILE_H = 38;

/** Map dimensions for PR1 static scene. */
export const MAP_W = 48;
export const MAP_H = 48;

// ─── Modular tank direction type (kept for adapter API) ───────────

/**
 * 2D offset point used for hull and turret positioning.
 *
 * Stage 3: retained for type compatibility (ModularTankRenderer still
 * imports ModularTankDirection). The Offset2D type itself is no longer
 * used by any production offset table, but may be referenced by
 * adapter/composition types.
 */
export type Offset2D = { x: number; y: number };

/**
 * Modular tank facing direction (0–7). Independent from asset module types.
 *
 * Stage 3: kept because ModularTankRenderer.setBodyDir / setTurretDir
 * use this type in their public API. The 8-direction enum is still
 * meaningful for dir8 → dir16 conversion in normalCombatToModularVisual.
 */
export type ModularTankDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ─── Stage 3 retirement ───────────────────────────────────────────
//
// The following were REMOVED in VEHICLE-RENDER-UNIFY-03-VH (Stage 3):
//
//   - TunerLayer type
//   - ALL_DIRS constant
//   - cloneOffsetRecord helper
//   - DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR
//   - MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR (mutable runtime)
//   - DEFAULT_MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR
//   - MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR (mutable runtime)
//   - tunerState (mutable runtime tuning state)
//
// Reason: these per-direction pixel offset tables violated the
// AGENTS.md rule "no manual per-PNG offsets as source of truth".
// The canonical modular composition (composeModularVehicle) uses
// metadata-driven socket/pivot math, not per-dir tables.
//
// If a future stage needs direction-aware placement tuning, it must
// go through metadata (hull_socket_manifest / turret_pivot_manifest),
// not through hardcoded pixel offset tables.
