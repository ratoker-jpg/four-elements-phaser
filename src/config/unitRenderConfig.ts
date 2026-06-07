/**
 * Unit render-scale and facing configuration.
 *
 * ARCH-05A: Visual-only scale factors for normalising unit sizes.
 * These affect rendering only — no HP, movement speed, collision,
 * passability, or economy changes.
 *
 * Base scales (pre-ARCH-05A):
 *   harvester:  41 / 256   ≈ 0.160
 *   builder:    40 / 256   ≈ 0.156
 *   modular:    0.32
 *
 * Applied multipliers:
 *   harvester:  ×1.30  (30% larger)
 *   builder:    ×1.45  (45% larger)
 *   modular:    ×0.75  (25% smaller)
 */

// ─── Base pixel sizes ──────────────────────────────────────────────

/** Civil unit spritesheet frame size (8×8 grid on 2048×2048 sheet). */
const CIVIL_FRAME_PX = 256;

/** Harvester base display size in pixels (before ARCH-05A multiplier). */
const HARVESTER_BASE_PX = 41;

/** Builder base display size in pixels (before ARCH-05A multiplier). */
const BUILDER_BASE_PX = 40;

// ─── Scale multipliers (ARCH-05A) ──────────────────────────────────

/** Harvester visual scale multiplier — 30% increase. */
export const HARVESTER_SCALE_MULT = 1.30;

/** Builder visual scale multiplier — 45% increase. */
export const BUILDER_SCALE_MULT = 1.45;

/** Modular combat unit visual scale multiplier — 25% decrease. */
export const MODULAR_SCALE_MULT = 0.75;

// ─── Final render scales ───────────────────────────────────────────

/**
 * Harvester render scale = base / framePx × multiplier.
 * 41/256 × 1.30 ≈ 0.208
 */
export const HARVESTER_RENDER_SCALE: number =
  (HARVESTER_BASE_PX / CIVIL_FRAME_PX) * HARVESTER_SCALE_MULT;

/**
 * Builder render scale = base / framePx × multiplier.
 * 40/256 × 1.45 ≈ 0.227
 */
export const BUILDER_RENDER_SCALE: number =
  (BUILDER_BASE_PX / CIVIL_FRAME_PX) * BUILDER_SCALE_MULT;

/**
 * Modular tank base render scale (pre-ARCH-05A: 0.32).
 */
const MODULAR_TANK_BASE_SCALE = 0.32;

/**
 * Modular tank render scale after 25% reduction.
 * 0.32 × 0.75 = 0.24
 */
export const MODULAR_RENDER_SCALE: number =
  MODULAR_TANK_BASE_SCALE * MODULAR_SCALE_MULT;

/**
 * Ratio of current modular render scale to the base scale at which the
 * hull/turret offset tables in worldConfig were originally calibrated.
 *
 * Used by ModularTankRenderer to proportionally adjust offset positions
 * so the visual composition (hull + turret alignment, tile centering)
 * stays consistent when the render scale changes.
 *
 * 0.24 / 0.32 = 0.75
 */
export const MODULAR_SCALE_RATIO: number =
  MODULAR_RENDER_SCALE / MODULAR_TANK_BASE_SCALE;

/**
 * Post-scale anchor correction for the modular tank composition.
 *
 * After applying the scale-ratio transform to base offsets, this 2D shift
 * fine-tunes visual centering on the tile. It moves the entire hull+turret
 * group together, so their mutual alignment is never affected.
 *
 * Derivation (256×256 sprites, hull origin 0.5/0.75):
 *   At base scale (0.32), hull offset {2,16} → visual centre at anchor+{2,-4.48}
 *   At new scale (0.24) with ratio only → visual centre at anchor+{1.5,-3.36}
 *   Shift = {+0.5, +1.12}  →  correction = {+0.5, -1.12}
 *
 * Adjust this value with the debug overlay if the modular unit appears
 * off-center after a future scale change.
 */
export const MODULAR_ANCHOR_CORRECTION: { x: number; y: number } = {
  x: 0.5,
  y: -1.12,
};
