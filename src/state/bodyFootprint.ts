/**
 * Body footprint / collision classes — pure TypeScript, no Phaser.
 *
 * CORE-STEP-06H+: Defines body footprint classes that affect tile
 * occupancy for all ground units.
 *
 * Three footprint classes:
 * - Light: Wasp, Hornet — occupies 1 tile, small collision radius
 * - Medium: Hunter, Viking, Dictator — occupies 1 tile, standard collision
 * - Heavy: Titan, Mammoth — occupies 1 tile, large collision radius
 *
 * In the current MVP, all units occupy exactly 1 tile. The footprint
 * class affects collision priority and turn speed scaling, not tile count.
 * Future expansion may add multi-tile footprints for Heavy bodies.
 */

// ─── Public types ──────────────────────────────────────────────────

/** Body footprint class — determines collision/occupancy behavior. */
export type FootprintClass = 'light' | 'medium' | 'heavy';

/** Configuration for a body footprint class. */
export interface FootprintClassConfig {
  /** Footprint class identifier. */
  footprintClass: FootprintClass;
  /** Number of tiles occupied (1 for all current bodies). */
  tileCount: 1;
  /** Collision priority — higher priority units push lower on path conflicts. */
  collisionPriority: number;
  /** Turn speed multiplier — light bodies turn faster, heavy turn slower. */
  turnSpeedMultiplier: number;
  /** Radius in tile units for proximity/collision checks. */
  collisionRadiusTiles: number;
  /** Display name for the footprint class. */
  displayName: string;
}

// ─── Footprint class configurations ─────────────────────────────────

export const FOOTPRINT_CLASS_CONFIGS: Record<FootprintClass, FootprintClassConfig> = {
  light: {
    footprintClass: 'light',
    tileCount: 1,
    collisionPriority: 1,
    turnSpeedMultiplier: 1.3,
    collisionRadiusTiles: 0.4,
    displayName: 'Лёгкий',
  },
  medium: {
    footprintClass: 'medium',
    tileCount: 1,
    collisionPriority: 2,
    turnSpeedMultiplier: 1.0,
    collisionRadiusTiles: 0.5,
    displayName: 'Средний',
  },
  heavy: {
    footprintClass: 'heavy',
    tileCount: 1,
    collisionPriority: 3,
    turnSpeedMultiplier: 0.7,
    collisionRadiusTiles: 0.6,
    displayName: 'Тяжёлый',
  },
};

// ─── Body → Footprint class mapping ─────────────────────────────────

/** Maps body IDs to their footprint class. */
export const BODY_FOOTPRINT_CLASS: Record<string, FootprintClass> = {
  wasp: 'light',
  hornet: 'light',
  hunter: 'medium',
  viking: 'medium',
  dictator: 'medium',
  titan: 'heavy',
  mammoth: 'heavy',
};

/** Civil unit footprint class (harvesters and builders are medium). */
export const CIVIL_FOOTPRINT_CLASS: FootprintClass = 'medium';

// ─── Helper functions ────────────────────────────────────────────────

/** Get the footprint class for a body ID. Returns 'medium' as default. */
export function getBodyFootprintClass(bodyId: string): FootprintClass {
  return BODY_FOOTPRINT_CLASS[bodyId] ?? 'medium';
}

/** Get the footprint class config for a body ID. */
export function getBodyFootprintConfig(bodyId: string): FootprintClassConfig {
  const fc = getBodyFootprintClass(bodyId);
  return FOOTPRINT_CLASS_CONFIGS[fc];
}

/** Get the effective turn speed for a body, applying footprint class multiplier. */
export function getEffectiveTurnSpeedDeg(baseTurnSpeedDeg: number, bodyId: string): number {
  const config = getBodyFootprintConfig(bodyId);
  return baseTurnSpeedDeg * config.turnSpeedMultiplier;
}

/** Get the collision radius in tile units for a body. */
export function getBodyCollisionRadiusTiles(bodyId: string): number {
  const config = getBodyFootprintConfig(bodyId);
  return config.collisionRadiusTiles;
}
