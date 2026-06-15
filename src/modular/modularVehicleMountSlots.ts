/**
 * modularVehicleMountSlots — MODULAR-RUNTIME-04B production mount-slot model.
 *
 * Problem this solves
 * -------------------
 * The export-derived socket/pivot metadata places every turret pivot at the
 * hull frame centre (nx=ny=0.5, see generatedModularVehicleMetadata). That is
 * correct for hulls whose weapon socket genuinely sits at the body centre, but
 * several hulls mount their weapon clearly toward the front or the rear of the
 * chassis. Without a correction the turret floats in the wrong place.
 *
 * The fix is a small, SEMANTIC adjustment layer — not a per-hull pixel table
 * and not a per-direction x/y table. Each hull is tagged with one of three
 * mount-slot categories. Adding a new hull only requires choosing one of these
 * categories; no calibration data is written into metadata or assets.
 *
 *   front  → mammoth, titan      (turret sits ahead of body centre)
 *   center → viking, hunter, hornet (turret at body centre — no adjustment)
 *   rear   → wasp, dictator      (turret sits behind body centre)
 *
 * What the mount slot affects
 * ---------------------------
 * The mount slot is applied ONLY to the COMPOSITION OFFSET — i.e. the screen
 * position where the turret pivot is placed (the "socket screen" point) — and
 * the shift follows the hull's facing direction so it stays correct for all 16
 * directions WITHOUT a per-direction table. It does NOT touch:
 *   - the hull sprite position / hull scale;
 *   - the exported hull socket metadata (nx/ny);
 *   - the exported turret pivot metadata (nx/ny);
 *   - any collision/hitbox/footprint/gameplay stat.
 *
 * For `center` hulls the shift is exactly zero, so hulls already solved by the
 * frame-centre metadata are not overcorrected.
 */

export type ModularVehicleMountSlot = 'front' | 'center' | 'rear';

/**
 * Production config: hull id → mount-slot category.
 *
 * This is the single source of truth. A new hull is supported by adding one
 * entry here (or it falls back to `center`, see getHullMountSlot).
 */
export const HULL_MOUNT_SLOTS: Record<string, ModularVehicleMountSlot> = {
  // Front-mounted weapon hulls.
  mammoth: 'front',
  titan: 'front',
  // Centre-mounted weapon hulls (metadata frame-centre already correct).
  viking: 'center',
  hunter: 'center',
  hornet: 'center',
  // Rear-mounted weapon hulls.
  wasp: 'rear',
  dictator: 'rear',
};

/** Default category for an unknown hull: centre (no adjustment, safest). */
export const DEFAULT_MOUNT_SLOT: ModularVehicleMountSlot = 'center';

/**
 * Forward shift per mount slot, expressed as a fraction of the hull display
 * size (so it scales with zoom and the per-hull visual scale automatically).
 *
 * Positive = toward the hull's facing/front; negative = toward the rear.
 * `center` is exactly 0 — a true no-op so frame-centre hulls are untouched.
 *
 * This single constant is the only tunable in the whole mount-slot layer.
 */
export const MOUNT_SLOT_FORWARD_FRACTION: Record<ModularVehicleMountSlot, number> = {
  front: 0.16,
  center: 0,
  rear: -0.16,
};

/**
 * Isometric vertical compression for projecting a facing vector to screen.
 * The hull direction sprites are pre-rendered in the game's 2:1-style iso, so
 * a unit world-forward projects to screen with the vertical axis compressed.
 * 0.5 matches the 2:1 ground projection used elsewhere in the renderer.
 */
export const MOUNT_SLOT_ISO_VERTICAL_SCALE = 0.5;

/** Radians per dir16 step (16 directions around the circle). */
const DIR16_STEP_RAD = (2 * Math.PI) / 16;

/**
 * Resolve a hull's mount slot. Unknown hulls fall back to `center` (no shift),
 * which is the safe non-regressing default.
 */
export function getHullMountSlot(hullId: string): ModularVehicleMountSlot {
  return HULL_MOUNT_SLOTS[hullId] ?? DEFAULT_MOUNT_SLOT;
}

export interface MountSlotOffset {
  /** Screen-space x shift in pixels (added to the socket screen point). */
  dx: number;
  /** Screen-space y shift in pixels (added to the socket screen point). */
  dy: number;
}

/**
 * Compute the screen-space socket shift for a hull, following its facing.
 *
 * dir16 0 = E (angle 0), increasing clockwise (matches runtimeAngleToDir16 /
 * MODULAR_DIR16_SUFFIXES). The forward unit vector is projected to screen with
 * iso vertical compression, then scaled by the slot's forward fraction and the
 * hull display size. `center` hulls always return {0,0}.
 *
 * No per-direction table: the offset is computed from the direction angle, so
 * one fraction constant covers all 16 directions for every hull in a slot.
 */
export function getMountSlotSocketShift(
  hullId: string,
  hullDir16: number,
  hullDisplaySize: number,
): MountSlotOffset {
  const slot = getHullMountSlot(hullId);
  const fraction = MOUNT_SLOT_FORWARD_FRACTION[slot];
  if (fraction === 0) {
    return { dx: 0, dy: 0 };
  }
  const angle = hullDir16 * DIR16_STEP_RAD;
  const magnitude = fraction * hullDisplaySize;
  return {
    dx: Math.cos(angle) * magnitude,
    dy: Math.sin(angle) * MOUNT_SLOT_ISO_VERTICAL_SCALE * magnitude,
  };
}
