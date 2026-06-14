/**
 * modularPreviewCalibration — MODULAR-ALL-FACTIONS-01C devtools-only
 * preview calibration state.
 *
 * This module defines the calibration controls used in the Modular Vehicle
 * devtools preview. These values are NEVER written to production metadata,
 * config, or assets. They exist solely for visual QA inspection.
 *
 * Effective scale formulas:
 *   effectiveHullScale = baseDisplayScale * modelScale * getHullVisualScaleMultiplier(hullId) * hullScale
 *   effectiveTurretScale = baseDisplayScale * modelScale * turretScale
 *
 * Hull offset moves the hull relative to the preview cell/world origin.
 * Turret offset moves the turret visual/pivot relative to the turret's
 * rendered position (after composition).
 */

/** Devtools-only preview calibration state. */
export interface ModularPreviewCalibration {
  /** Whether to show the isometric tile overlay. */
  showTile: boolean;
  /** Global model scale — affects both hull and turret preview. */
  modelScale: number;
  /** Extra hull scale (QA-only multiplier, applied AFTER Dictator baseline). */
  hullScale: number;
  /** Extra turret scale (QA-only multiplier, turret does NOT inherit Dictator hull scale). */
  turretScale: number;
  /** Hull horizontal offset relative to tile/cell center (px). */
  hullOffsetX: number;
  /** Hull vertical offset relative to tile/cell center (px). */
  hullOffsetY: number;
  /** Turret horizontal offset relative to turret rendered position (px). */
  turretOffsetX: number;
  /** Turret vertical offset relative to turret rendered position (px). */
  turretOffsetY: number;
  /** Pixel step for position offset controls. */
  pixelStep: 1 | 5 | 10;
  /** Scale step for scale controls. */
  scaleStep: 0.01 | 0.05;
}

/** Default calibration state — no offsets, no extra scale, tile on. */
export const DEFAULT_MODULAR_PREVIEW_CALIBRATION: ModularPreviewCalibration = {
  showTile: true,
  modelScale: 1,
  hullScale: 1,
  turretScale: 1,
  hullOffsetX: 0,
  hullOffsetY: 0,
  turretOffsetX: 0,
  turretOffsetY: 0,
  pixelStep: 1,
  scaleStep: 0.01,
};

/** Valid pixel steps for the step cycle. */
export const PIXEL_STEPS = [1, 5, 10] as const;

/** Valid scale steps for the step cycle. */
export const SCALE_STEPS = [0.01, 0.05] as const;

/**
 * Cycle to the next pixel step value: 1 → 5 → 10 → 1.
 */
export function cyclePixelStep(current: 1 | 5 | 10): 1 | 5 | 10 {
  const idx = PIXEL_STEPS.indexOf(current);
  const next = (idx + 1) % PIXEL_STEPS.length;
  return PIXEL_STEPS[next];
}

/**
 * Cycle to the next scale step value: 0.01 → 0.05 → 0.01.
 */
export function cycleScaleStep(current: 0.01 | 0.05): 0.01 | 0.05 {
  const idx = SCALE_STEPS.indexOf(current);
  const next = (idx + 1) % SCALE_STEPS.length;
  return SCALE_STEPS[next];
}

/**
 * Reset calibration to defaults.
 */
export function resetCalibration(): ModularPreviewCalibration {
  return { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };
}

/**
 * Compute the effective hull scale for display.
 *
 * effectiveHullScale = baseDisplayScale * modelScale * getHullVisualScaleMultiplier(hullId) * hullScale
 */
export function effectiveHullScale(
  baseDisplayScale: number,
  hullScaleMultiplier: number,
  calibration: ModularPreviewCalibration,
): number {
  return baseDisplayScale * calibration.modelScale * hullScaleMultiplier * calibration.hullScale;
}

/**
 * Compute the effective turret scale for display.
 *
 * effectiveTurretScale = baseDisplayScale * modelScale * turretScale
 */
export function effectiveTurretScale(
  baseDisplayScale: number,
  calibration: ModularPreviewCalibration,
): number {
  return baseDisplayScale * calibration.modelScale * calibration.turretScale;
}
