/**
 * ARENA-VISUAL-COMBAT-FIX-01 fixup-6 — HULL VISUAL PROFILE.
 *
 * Single, explicit home for the SEPARATE visual concepts that fixup-1..5
 * kept conflating into "one coordinate". Denis QA repeatedly rejected the
 * result because gameplay center, hull visual anchor, selection ring and
 * muzzle were all assumed to be the same point. They are not.
 *
 * Distinct concepts (do NOT merge):
 *   - gameplayCenter      : vehicle.worldX/worldY (+ map offset). Movement,
 *                           selection hit-testing, pathfinding, range, damage.
 *                           NEVER moved for visuals.
 *   - hullVisualAnchor    : where the hull PNG is PLACED on screen. Under the
 *                           modular `world_origin_projects_to_frame_center`
 *                           policy the hull frame-centre (origin 0.5,0.5) is
 *                           placed at the gameplay center. `visualOffsetPx`
 *                           is the ONLY sanctioned per-hull correction when a
 *                           hull silhouette's ground-contact is not at the PNG
 *                           frame centre.
 *   - selectionRingAnchor : the ground-plane point the ring is drawn around —
 *                           the gameplay center (so the ring sits under the
 *                           hull footprint).
 *   - selectionRingScale  : ring radius is footprint-derived
 *                           (getHullSelectionRingRadiusTiles); `ringScale` is
 *                           a per-hull fine-tune multiplier on top of it.
 *
 * Why this map is allowed (and not "another guessed global offset"):
 *   - Hull silhouettes genuinely differ (small_fast Wasp vs super_heavy
 *     Mammoth), so a per-hull table is the correct shape of the data.
 *   - It is SMALL, explicit, documented, and has a SAFE fallback.
 *   - `visualOffsetPx` defaults to {0,0}: the metadata-centred baseline.
 *     fixup-5 proved that a guessed {dy:12} made centering WORSE, so the
 *     honest baseline is zero. Any non-zero value MUST be measured against
 *     the rendered selection ring in manual QA — never eyeballed in code.
 *
 * This module is pure data + pure resolver. No Phaser, no runtime state.
 */

import { getBodyProfile } from './blockoutBodyData';
import type { BlockoutShape } from './blockoutProfiles';

/** A per-hull visual profile entry. */
export interface HullVisualProfile {
  /**
   * Screen-space pixel offset applied to the hull sprite placement (the
   * hullVisualAnchor) so the hull body sits centred on its selection ring.
   *
   * Positive y = down on screen. Applied ONLY to the modular composite
   * (hull + turret move together); it does NOT move worldX/worldY, the
   * selection ring, the hitbox, range, or damage.
   *
   * {0,0} = metadata-centred baseline. See module header.
   */
  visualOffsetPx: { x: number; y: number };
  /**
   * Per-hull multiplier on the footprint-derived selection ring radius.
   * 1.0 = use the footprint radius unchanged (footprint already encodes
   * weight: light hulls are smaller, heavy hulls larger). This is the
   * fine-tune hook for a hull whose silhouette reads larger/smaller than
   * its raw body box.
   */
  ringScale: number;
  /** Provenance / why these numbers — kept in code so reviewers see it. */
  note: string;
}

/**
 * Safe fallback profile for any hull not explicitly listed.
 * Zero offset + neutral ring scale: never worse than "no profile at all".
 */
export const DEFAULT_HULL_VISUAL_PROFILE: HullVisualProfile = {
  visualOffsetPx: { x: 0, y: 0 },
  ringScale: 1.0,
  note: 'default fallback — metadata-centred, neutral ring scale',
};

/**
 * Per-hull visual profiles for the hulls used in the current Arena (the
 * ones shown in Denis QA).
 *
 * ARENA-VISUAL-COMBAT-FIX-01 fixup-9: visualOffsetPx moderated from the
 * fixup-8 values (-16/–17) to -8/–10. Fixup-8 used the full measured
 * footprint-to-ring offset (~17 px), which over-corrected: the hull sat
 * too HIGH above the selection ring. The correct offset is approximately
 * half the measured distance because the PNG frame center already sits
 * closer to the visual ground contact than the raw footprint measurement
 * suggested — the alpha centroid pull (upper body) accounts for roughly
 * half the distance.
 *
 * Method history:
 *   - fixup-7: alpha centroid → 1–2 px offsets (under-corrected, hull too low)
 *   - fixup-8: full footprint measurement → ~17 px (over-corrected, hull too high)
 *   - fixup-9: moderated to ~8–10 px (midpoint between the two methods)
 *
 * ringScale remains from fixup-7 (footprint-proportional ring sizing).
 *
 * These are visual calibration values until real hull frame metadata exists.
 * They move ONLY the modular sprite composite; gameplay position, hitbox,
 * pathfinding, range, and damage are unaffected.
 */
export const HULL_VISUAL_PROFILE: Record<string, HullVisualProfile> = {
  // small_fast — fixup-9: moderated from dy-17 (too high) to dy-9.
  wasp:     { visualOffsetPx: { x: 0, y: -9 }, ringScale: 1.6, note: 'small_fast; fixup-9 moderated dy-17→dy-9; ring 1.6×' },
  // light_fast — fixup-9: moderated from dy-16 (too high) to dy-8.
  hornet:   { visualOffsetPx: { x: 0, y: -8 }, ringScale: 1.4, note: 'light_fast; fixup-9 moderated dy-16→dy-8; ring 1.4×' },
  // medium — fixup-9: moderated from dy-16 (too high) to dy-8.
  hunter:   { visualOffsetPx: { x: 0, y: -8 }, ringScale: 1.3, note: 'medium; fixup-9 moderated dy-16→dy-8; ring 1.3×' },
  viking:   { visualOffsetPx: { x: 0, y: -8 }, ringScale: 1.3, note: 'medium; fixup-9 moderated dy-16→dy-8; ring 1.3×' },
  // large_fast — fixup-9: moderated from dy-17 (too high) to dy-10.
  dictator: { visualOffsetPx: { x: 0, y: -10 }, ringScale: 1.25, note: 'large_fast; fixup-9 moderated dy-17→dy-10; ring 1.25×' },
  // heavy — fixup-9: moderated from dy-17 (too high) to dy-10.
  titan:    { visualOffsetPx: { x: 0, y: -10 }, ringScale: 1.15, note: 'heavy; fixup-9 moderated dy-17→dy-10; ring 1.15×' },
  // super_heavy — fixup-9: moderated from dy-17 (too high) to dy-10.
  mammoth:  { visualOffsetPx: { x: 0, y: -10 }, ringScale: 1.05, note: 'super_heavy; fixup-9 moderated dy-17→dy-10; ring 1.05×' },
};

/**
 * Resolve the visual profile for a hull id, with a safe fallback for
 * unknown hulls. Never throws.
 */
export function getHullVisualProfile(hullId: string): HullVisualProfile {
  return HULL_VISUAL_PROFILE[hullId] ?? DEFAULT_HULL_VISUAL_PROFILE;
}

/** Convenience: the hull visual anchor offset (px) for a hull id. */
export function getHullVisualOffsetPx(hullId: string): { x: number; y: number } {
  return getHullVisualProfile(hullId).visualOffsetPx;
}

/** Convenience: the per-hull selection ring scale multiplier for a hull id. */
export function getHullRingScale(hullId: string): number {
  return getHullVisualProfile(hullId).ringScale;
}

/**
 * Diagnostic: the blockoutShape weight class for a hull, used by tests to
 * assert that heavier hulls get larger rings. Returns null for unknown hulls.
 */
export function getHullShapeClass(hullId: string): BlockoutShape | null {
  return getBodyProfile(hullId)?.blockoutShape ?? null;
}
