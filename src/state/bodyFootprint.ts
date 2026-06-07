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

// ─── Runtime collision helpers (CORE-STEP-06H+ fixup) ─────────────────

/**
 * Check whether two units would overlap at runtime based on their footprint classes.
 *
 * Two units overlap if the distance between their tile positions is less than
 * the sum of their collision radii. This is used for proximity-based
 * collision checks at runtime — heavier bodies have larger collision radii
 * and therefore affect occupancy/collision more than lighter bodies.
 *
 * @param unitA_tx - Tile X of unit A
 * @param unitA_ty - Tile Y of unit A
 * @param unitA_bodyId - Body ID of unit A
 * @param unitB_tx - Tile X of unit B
 * @param unitB_ty - Tile Y of unit B
 * @param unitB_bodyId - Body ID of unit B
 * @returns true if the two units would overlap at the given positions
 */
export function bodiesOverlap(
  unitA_tx: number, unitA_ty: number, unitA_bodyId: string,
  unitB_tx: number, unitB_ty: number, unitB_bodyId: string,
): boolean {
  const dx = unitA_tx - unitB_tx;
  const dy = unitA_ty - unitB_ty;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radiusA = getBodyCollisionRadiusTiles(unitA_bodyId);
  const radiusB = getBodyCollisionRadiusTiles(unitB_bodyId);
  return dist < radiusA + radiusB;
}

/**
 * Resolve a tile conflict between two units using collision priority.
 *
 * When two units both want to enter the same tile, the one with the higher
 * collision priority wins. Heavy bodies (priority 3) beat Medium (priority 2)
 * beat Light (priority 1). If priorities are equal, neither yields (returns null).
 *
 * @param unitA_id - ID of unit A
 * @param unitA_bodyId - Body ID of unit A
 * @param unitB_id - ID of unit B
 * @param unitB_bodyId - Body ID of unit B
 * @returns The ID of the unit that should yield, or null if neither yields
 */
export function resolveCollisionPriority(
  unitA_id: string, unitA_bodyId: string,
  unitB_id: string, unitB_bodyId: string,
): string | null {
  const configA = getBodyFootprintConfig(unitA_bodyId);
  const configB = getBodyFootprintConfig(unitB_bodyId);

  if (configA.collisionPriority > configB.collisionPriority) {
    return unitB_id; // B yields — A has higher priority
  }
  if (configB.collisionPriority > configA.collisionPriority) {
    return unitA_id; // A yields — B has higher priority
  }
  return null; // Equal priority — neither yields
}

/**
 * Get all tiles blocked by a unit at the given position based on its footprint class.
 *
 * Heavy bodies block adjacent tiles in addition to their own tile, because
 * their collision radius extends beyond 0.5 tile units. Medium bodies block
 * only their own tile. Light bodies block only their own tile.
 *
 * This is the key runtime effect of footprint class on occupancy:
 * - Heavy (collisionRadiusTiles=0.6): blocks own tile + diagonally adjacent tiles
 *   that are within the collision radius
 * - Medium (collisionRadiusTiles=0.5): blocks only own tile
 * - Light (collisionRadiusTiles=0.4): blocks only own tile
 *
 * @param tx - Unit's tile X
 * @param ty - Unit's tile Y
 * @param bodyId - Body ID for footprint class lookup
 * @returns Array of {tx, ty} tiles that this unit blocks at runtime
 */
export function getOccupiedTiles(tx: number, ty: number, bodyId: string): Array<{ tx: number; ty: number }> {
  const config = getBodyFootprintConfig(bodyId);
  const tiles: Array<{ tx: number; ty: number }> = [{ tx, ty }];

  // Heavy bodies with collisionRadiusTiles > 0.5 physically extend past
  // the tile boundary (center-to-edge = 0.5 tiles). A body with radius > 0.5
  // overlaps into adjacent tiles and must block them for pathfinding.
  // This is the key runtime effect: Heavy blocks 5 tiles (own + 4 adjacent),
  // Medium blocks 1 tile, Light blocks 1 tile.
  if (config.collisionRadiusTiles > 0.5) {
    // All 4-connected adjacent tiles are blocked because the collision
    // radius extends past the tile boundary into them
    tiles.push(
      { tx: tx - 1, ty },
      { tx: tx + 1, ty },
      { tx, ty: ty - 1 },
      { tx, ty: ty + 1 },
    );
  }

  return tiles;
}
