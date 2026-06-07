/**
 * Motion FX helper — pure TypeScript, no Phaser.
 *
 * ARCH-13C-LITE: Movement dust profile selection and movement delta classification.
 * Used by UnitMotionFxRenderer to determine when and what kind of dust to emit.
 *
 * Design decisions:
 * - Movement detection uses tile-space position delta with a small epsilon,
 *   same pattern as direction facing in EntityRenderer/ConstructionRenderer.
 * - Dust profiles are tuned per unit type: harvester (heavier), builder (light),
 *   tank (heaviest, but not wired since tanks are currently static).
 * - Speed scaling: faster movement slightly increases alpha for a stronger effect.
 * - All values are render-only; no gameplay state is modified.
 */

// ─── Types ────────────────────────────────────────────────────────

/** Unit types that can emit motion dust. */
export type MotionUnitType = 'builder' | 'harvester' | 'tank';

/** Dust emission profile for a unit type. */
export interface DustProfile {
  /** Minimum dust particle radius in pixels. */
  radiusMin: number;
  /** Maximum dust particle radius in pixels. */
  radiusMax: number;
  /** Particle lifetime in milliseconds. */
  lifetimeMs: number;
  /** Maximum alpha (0–1). */
  alphaMax: number;
  /** Number of particles emitted per emission event. */
  countPerEmit: number;
  /** Base color as hex number. */
  color: number;
  /** Minimum interval between emissions in milliseconds. */
  emitIntervalMs: number;
}

// ─── Movement classification ──────────────────────────────────────

/** Movement delta threshold in tile units to consider a unit "moving". */
const MOVEMENT_EPSILON = 0.002;

/**
 * Determine whether a unit is moving based on tile-position delta.
 *
 * Uses the same epsilon-based comparison as direction facing detection
 * in EntityRenderer and ConstructionRenderer.
 */
export function isMoving(
  prevFtx: number,
  prevFty: number,
  curFtx: number,
  curFty: number,
  epsilon: number = MOVEMENT_EPSILON,
): boolean {
  const dx = curFtx - prevFtx;
  const dy = curFty - prevFty;
  return Math.abs(dx) > epsilon || Math.abs(dy) > epsilon;
}

/**
 * Compute movement speed in tiles per second.
 * Returns 0 if deltaMs is 0 or negative.
 */
export function computeMovementSpeed(
  prevFtx: number,
  prevFty: number,
  curFtx: number,
  curFty: number,
  deltaMs: number,
): number {
  if (deltaMs <= 0) return 0;
  const dx = curFtx - prevFtx;
  const dy = curFty - prevFty;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return (dist / deltaMs) * 1000;
}

// ─── Dust profiles ────────────────────────────────────────────────

/**
 * Sandy/brown dust colors matching the desert terrain theme.
 * Lighter for builder (light activity), medium for harvester, heavier for tank.
 */
const DUST_COLOR_LIGHT = 0xc4a882;
const DUST_COLOR_MEDIUM = 0xb09070;
const DUST_COLOR_HEAVY = 0x9a7a5a;

/** Builder dust profile — light, small particles. */
const BUILDER_DUST_PROFILE: DustProfile = {
  radiusMin: 1.5,
  radiusMax: 3,
  lifetimeMs: 350,
  alphaMax: 0.25,
  countPerEmit: 1,
  color: DUST_COLOR_LIGHT,
  emitIntervalMs: 100,
};

/** Harvester dust profile — slightly more/larger particles than builder. */
const HARVESTER_DUST_PROFILE: DustProfile = {
  radiusMin: 2,
  radiusMax: 4,
  lifetimeMs: 450,
  alphaMax: 0.35,
  countPerEmit: 2,
  color: DUST_COLOR_MEDIUM,
  emitIntervalMs: 90,
};

/** Tank dust profile — heaviest dust (not wired yet — tanks are currently static). */
const TANK_DUST_PROFILE: DustProfile = {
  radiusMin: 2.5,
  radiusMax: 5,
  lifetimeMs: 500,
  alphaMax: 0.4,
  countPerEmit: 2,
  color: DUST_COLOR_HEAVY,
  emitIntervalMs: 80,
};

const DUST_PROFILES: Record<MotionUnitType, DustProfile> = {
  builder: BUILDER_DUST_PROFILE,
  harvester: HARVESTER_DUST_PROFILE,
  tank: TANK_DUST_PROFILE,
};

/**
 * Get the dust emission profile for a unit type.
 *
 * Tank profile is defined but not used in the current implementation
 * because modular tanks have no movement state yet.
 */
export function getDustProfile(unitType: MotionUnitType): DustProfile {
  return DUST_PROFILES[unitType];
}

// ─── Fade math ────────────────────────────────────────────────────

/**
 * Compute the current alpha for a dust particle based on age and lifetime.
 * Linear fade from alphaMax to 0 over the lifetime.
 */
export function computeDustAlpha(ageMs: number, lifetimeMs: number, alphaMax: number): number {
  if (ageMs >= lifetimeMs) return 0;
  const t = ageMs / lifetimeMs;
  return alphaMax * (1 - t);
}

/**
 * Compute current radius for a dust particle based on age.
 * Particles slightly expand (up to 30%) as they age and fade,
 * simulating dust dispersing.
 */
export function computeDustRadius(baseRadius: number, ageMs: number, lifetimeMs: number): number {
  const t = Math.min(ageMs / lifetimeMs, 1);
  return baseRadius * (1 + 0.3 * t);
}

/**
 * Speed-based alpha multiplier.
 * Faster movement produces slightly stronger dust.
 * Returns a multiplier in [1.0, 1.4] based on speed relative to a reference.
 *
 * @param speedTilesPerSec - Current unit speed in tiles/sec
 * @param referenceSpeed - Reference speed (default 2.5 tiles/sec, typical harvester speed)
 */
export function speedAlphaMultiplier(speedTilesPerSec: number, referenceSpeed: number = 2.5): number {
  if (speedTilesPerSec <= 0) return 1.0;
  // Scale linearly: at 2× reference speed, multiplier = 1.4
  // At reference speed, multiplier = 1.2
  // At 0.5× reference speed, multiplier = 1.0
  const ratio = speedTilesPerSec / referenceSpeed;
  return Math.min(1.0 + 0.2 * ratio, 1.4);
}
