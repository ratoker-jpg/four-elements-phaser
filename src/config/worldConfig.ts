/** Isometric tile dimensions — must match the donor game baseline. */
export const TILE_W = 76;
export const TILE_H = 38;

/** Map dimensions for PR1 static scene. */
export const MAP_W = 48;
export const MAP_H = 48;

// ─── Modular tank visual tuning (PR5) ─────────────────────────

/** Default hull offset from tile anchor — approved baseline. */
export const DEFAULT_MODULAR_TANK_HULL_OFFSET = { x: 18, y: 8 };

/** Default turret offset from tile anchor — approved baseline. */
export const DEFAULT_MODULAR_TANK_TURRET_OFFSET = { x: 2, y: -31 };

/**
 * Mutable runtime hull offset — live-tuned via keyboard in debug overlay.
 * Object reference is stable; mutate .x / .y in place.
 */
export const MODULAR_TANK_HULL_OFFSET = { ...DEFAULT_MODULAR_TANK_HULL_OFFSET };

/**
 * Mutable runtime turret offset — live-tuned via keyboard in debug overlay.
 * Object reference is stable; mutate .x / .y in place.
 */
export const MODULAR_TANK_TURRET_OFFSET = { ...DEFAULT_MODULAR_TANK_TURRET_OFFSET };

/** Which modular layer is selected for tuning. */
export type TunerLayer = 'hull' | 'turret';

/** Current tuner selection state — only meaningful when debug overlay is ON. */
export const tunerState: {
  selectedLayer: TunerLayer;
} = {
  selectedLayer: 'hull',
};
