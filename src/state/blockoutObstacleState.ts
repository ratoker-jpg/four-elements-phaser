/**
 * Blockout obstacle state — runtime state for dev/arena-only obstacles.
 *
 * BLOCKOUT-08H: Dev/arena-only blockout obstacles for combat sandbox.
 *
 * Obstacles are simple Phaser Graphics primitives that:
 * - Block vehicle movement
 * - Block weapon line-of-fire (depending on obstacle config)
 * - Are NOT persisted in saves
 * - Are NOT part of production gameplay
 *
 * All state is transient and NOT persisted in saves.
 * All timing uses passed-in nowMs (Phaser scene time), NEVER Date.now().
 */

// ─── Obstacle Type IDs ──────────────────────────────────────────────

/** Obstacle type identifiers for blockout placeholders. BLOCKOUT-08H. */
export type BlockoutObstacleType =
  | 'blocker_wall'
  | 'cover_crate'
  | 'low_barrier'
  | 'dummy_rock';

// ─── Obstacle Shape ─────────────────────────────────────────────────

/** Shape descriptor for obstacle geometry. BLOCKOUT-08H. */
export type ObstacleShape =
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'circle'; radius: number };

// ─── Blockout Obstacle State ────────────────────────────────────────

/** Runtime state for a single blockout obstacle. Transient — not persisted. */
export interface BlockoutObstacleState {
  /** Unique ID for this obstacle instance. */
  id: string;
  /** Obstacle type identifier. */
  type: BlockoutObstacleType;
  /** Screen-space pixel X position (worldX, add offset for rendering). */
  worldX: number;
  /** Screen-space pixel Y position (worldY, add offset for rendering). */
  worldY: number;
  /** Shape descriptor for geometry/collision. */
  shape: ObstacleShape;
  /** Whether this obstacle blocks vehicle movement. */
  blocksMovement: boolean;
  /** Whether this obstacle blocks direct line-of-fire shots. */
  blocksLineOfFire: boolean;
  /** Whether this obstacle blocks splash damage propagation. BLOCKOUT-08H placeholder: currently false. */
  blocksSplash: boolean;
  /** Whether penetration weapons can pierce through this obstacle. */
  pierceable: boolean;
  /** Creation timestamp (ms). For debug only. */
  createdAt: number;
}

// ─── State helpers ──────────────────────────────────────────────────

let nextObstacleId = 1;

/** Reset auto-increment ID counter (for tests). */
export function resetBlockoutObstacleIdCounter(): void {
  nextObstacleId = 1;
}

/** Create a blockout obstacle with the given parameters. */
export function createBlockoutObstacle(
  type: BlockoutObstacleType,
  worldX: number,
  worldY: number,
  shape: ObstacleShape,
  blocksMovement: boolean = true,
  blocksLineOfFire: boolean = true,
  blocksSplash: boolean = false,
  pierceable: boolean = false,
): BlockoutObstacleState {
  return {
    id: `blockout-obstacle-${nextObstacleId++}`,
    type,
    worldX,
    worldY,
    shape,
    blocksMovement,
    blocksLineOfFire,
    blocksSplash,
    pierceable,
    createdAt: 0, // Will be set by caller with scene time
  };
}
