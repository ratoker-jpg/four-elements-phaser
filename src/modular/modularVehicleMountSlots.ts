/**
 * modularVehicleMountSlots — production mount-slot placement model.
 *
 * MODULAR-RUNTIME-04B-FIX: The accepted devtools preview calibration placement
 * is promoted to the production source of truth. Each hull belongs to one of
 * three mount-slot categories, and each category carries a fixed screen-space
 * placement profile (hull offset + turret offset, in pixels at the base scale).
 * These exact values were dialed in and accepted in manual preview QA:
 *
 *   front  (mammoth, titan)         hullOffset  4 / -12   turretOffset 0 / 0
 *          reference: titan + smoky
 *   center (viking, hunter, hornet) hullOffset -5 /  -7   turretOffset 0 / 0
 *          reference: hunter + ricochet
 *   rear   (wasp, dictator)         hullOffset -7 / -11   turretOffset 0 / 0
 *          reference: dictator + ricochet
 *
 * Why this replaces the old forward-fraction shift
 * ------------------------------------------------
 * The previous implementation applied a "blind" forward/back directional shift
 * derived from the hull facing. Manual QA showed that drifted every hull and
 * pushed Wasp visibly outside its tile. That heuristic is removed entirely. The
 * placement is now a small, fixed, per-category screen offset — exactly the
 * accepted preview calibration — not a direction-dependent computation and not
 * a per-direction table.
 *
 * What the placement profile affects
 * ----------------------------------
 *   - hullOffset shifts the hull centre (and therefore the socket and the
 *     turret riding on it) by a fixed screen-space amount;
 *   - turretOffset adds a fixed screen-space nudge to the turret only (0/0 for
 *     every current slot, but kept in the model for future hulls).
 * It does NOT touch exported socket/pivot metadata, hull/turret scale, or any
 * collision/hitbox/footprint/gameplay value. Dictator's +9% hull-only scale is
 * handled separately in composition and is unaffected by this offset.
 *
 * The SAME profile is consumed by both the live runtime renderer
 * (composeModularVehicle) and the devtools preview renderer, so preview matches
 * live by construction. Devtools calibration controls remain devtools-only and
 * stack on top of this production base without ever writing it back.
 */

export type ModularVehicleMountSlot = 'front' | 'center' | 'rear';

export interface MountSlotOffset {
  x: number;
  y: number;
}

export interface MountSlotPlacementProfile {
  /** Fixed screen-space hull offset (px at base scale), relative to anchor. */
  hullOffset: MountSlotOffset;
  /** Fixed screen-space turret-only offset (px at base scale). */
  turretOffset: MountSlotOffset;
}

/**
 * Production config: hull id → mount-slot category. Single source of truth.
 * A new hull is supported by adding one entry here (or it falls back to the
 * `center` profile, see getHullMountSlot).
 */
export const HULL_MOUNT_SLOTS: Record<string, ModularVehicleMountSlot> = {
  // Front-mounted weapon hulls.
  mammoth: 'front',
  titan: 'front',
  // Centre-mounted weapon hulls.
  viking: 'center',
  hunter: 'center',
  hornet: 'center',
  // Rear-mounted weapon hulls.
  wasp: 'rear',
  dictator: 'rear',
};

/** Default category for an unknown hull. */
export const DEFAULT_MOUNT_SLOT: ModularVehicleMountSlot = 'center';

/**
 * Production config: mount-slot category → accepted placement profile.
 * These are the calibration-accepted offsets, promoted to production constants.
 */
export const MOUNT_SLOT_PLACEMENT: Record<ModularVehicleMountSlot, MountSlotPlacementProfile> = {
  front: { hullOffset: { x: 4, y: -12 }, turretOffset: { x: 0, y: 0 } },
  center: { hullOffset: { x: -5, y: -7 }, turretOffset: { x: 0, y: 0 } },
  rear: { hullOffset: { x: -7, y: -11 }, turretOffset: { x: 0, y: 0 } },
};

/**
 * Resolve a hull's mount slot. Unknown hulls fall back to `center`, which is
 * the safe default category.
 */
export function getHullMountSlot(hullId: string): ModularVehicleMountSlot {
  return HULL_MOUNT_SLOTS[hullId] ?? DEFAULT_MOUNT_SLOT;
}

/**
 * Resolve the production placement profile for a hull. This is the single
 * source of placement truth shared by the live renderer and the preview
 * renderer.
 */
export function getMountSlotPlacement(hullId: string): MountSlotPlacementProfile {
  return MOUNT_SLOT_PLACEMENT[getHullMountSlot(hullId)];
}
