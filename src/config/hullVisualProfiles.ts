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
 * ARENA-VISUAL-COMBAT-FIX-01 fixup-8: visualOffsetPx is now calibrated from
 * MEASURED HULL GROUND-FOOTPRINT position vs. ring center, not from the
 * alpha centroid. The Codex visual audit (2026-06-20) found that the hull
 * ground-footprint center is consistently ~16–19 screen px BELOW the
 * gameplay/ring center for all hulls. The fixup-7 alpha-centroid approach
 * yielded only 1–2 px offsets because the centroid averages in the upper
 * body/turret-base area, pulling the "centre" up toward the visual middle
 * of the sprite rather than toward the ground contact.
 *
 * Method (fixup-8):
 *   1. Codex audit measured the offset from ring center to hull ground
 *      footprint center per direction, per hull.
 *   2. The consistent vertical component is ~17 px (footprint below ring).
 *      To align the footprint with the ring, the hull composite must shift
 *      UP by that amount (negative Y in screen space).
 *   3. Horizontal components mirror by direction and partially cancel when
 *      averaged, so they are set to 0 for simplicity.
 *   4. ringScale remains from fixup-7 (footprint-proportional ring sizing).
 *
 * These are visual calibration values until real hull frame metadata exists.
 * They move ONLY the modular sprite composite; gameplay position, hitbox,
 * pathfinding, range, and damage are unaffected.
 */
export const HULL_VISUAL_PROFILE: Record<string, HullVisualProfile> = {
  // small_fast — audit: footprint 15.8-19.0 px below ring; shift up 17 px.
  wasp:     { visualOffsetPx: { x: 0, y: -17 }, ringScale: 1.6, note: 'small_fast; footprint ~17px below ring → dy-17; ring 1.6×' },
  // light_fast — extrapolate similar isometric offset
  hornet:   { visualOffsetPx: { x: 0, y: -16 }, ringScale: 1.4, note: 'light_fast; extrapolated ~16px below ring → dy-16; ring 1.4×' },
  // medium — extrapolate similar isometric offset
  hunter:   { visualOffsetPx: { x: 0, y: -16 }, ringScale: 1.3, note: 'medium; extrapolated ~16px below ring → dy-16; ring 1.3×' },
  viking:   { visualOffsetPx: { x: 0, y: -16 }, ringScale: 1.3, note: 'medium; extrapolated ~16px below ring → dy-16; ring 1.3×' },
  // large_fast — extrapolate
  dictator: { visualOffsetPx: { x: 0, y: -17 }, ringScale: 1.25, note: 'large_fast; extrapolated ~17px below ring → dy-17; ring 1.25×' },
  // heavy — extrapolate
  titan:    { visualOffsetPx: { x: 0, y: -17 }, ringScale: 1.15, note: 'heavy; extrapolated ~17px below ring → dy-17; ring 1.15×' },
  // super_heavy — audit: footprint 15.5-19.3 px below ring; shift up 17 px.
  mammoth:  { visualOffsetPx: { x: 0, y: -17 }, ringScale: 1.05, note: 'super_heavy; footprint ~17px below ring → dy-17; ring 1.05×' },
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
