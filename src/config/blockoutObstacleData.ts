/**
 * Blockout obstacle data — obstacle type configurations.
 *
 * BLOCKOUT-08H: Dev/arena-only blockout obstacles for combat sandbox.
 *
 * Defines obstacle type properties and the default arena obstacle layout.
 * All data is dev/arena-only and not persisted in saves.
 */

import type { BlockoutObstacleType, BlockoutObstacleState, ObstacleShape } from '../state/blockoutObstacleState';
import { createBlockoutObstacle } from '../state/blockoutObstacleState';
import { tileToScreen } from '../phaser/render/isometric';

// ─── Obstacle Type Config ───────────────────────────────────────────

/** Configuration for each obstacle type. */
export interface ObstacleTypeConfig {
  type: BlockoutObstacleType;
  displayName: string;
  shape: ObstacleShape;
  blocksMovement: boolean;
  blocksLineOfFire: boolean;
  blocksSplash: boolean;
  pierceable: boolean;
  fillColor: number;
  outlineColor: number;
}

/** Obstacle type configurations keyed by type ID. */
export const OBSTACLE_TYPE_CONFIGS: Record<BlockoutObstacleType, ObstacleTypeConfig> = {
  blocker_wall: {
    type: 'blocker_wall',
    displayName: 'Wall',
    shape: { kind: 'rect', width: 80, height: 16 },
    blocksMovement: true,
    blocksLineOfFire: true,
    blocksSplash: false,
    pierceable: false,
    fillColor: 0x555555,
    outlineColor: 0x333333,
  },
  cover_crate: {
    type: 'cover_crate',
    displayName: 'Crate',
    shape: { kind: 'rect', width: 24, height: 24 },
    blocksMovement: true,
    blocksLineOfFire: true,
    blocksSplash: false,
    pierceable: false,
    fillColor: 0x8B6914,
    outlineColor: 0x5a4410,
  },
  low_barrier: {
    type: 'low_barrier',
    displayName: 'Barrier',
    shape: { kind: 'rect', width: 40, height: 10 },
    blocksMovement: true,
    blocksLineOfFire: true,
    blocksSplash: false,
    pierceable: true,
    fillColor: 0x777777,
    outlineColor: 0x555555,
  },
  dummy_rock: {
    type: 'dummy_rock',
    displayName: 'Rock',
    shape: { kind: 'circle', radius: 18 },
    blocksMovement: true,
    blocksLineOfFire: true,
    blocksSplash: false,
    pierceable: false,
    fillColor: 0x6b5b3a,
    outlineColor: 0x4a3d28,
  },
};

/** Get obstacle type config by type ID. Returns undefined if not found. */
export function getObstacleTypeConfig(type: string): ObstacleTypeConfig | undefined {
  return OBSTACLE_TYPE_CONFIGS[type as BlockoutObstacleType];
}

// ─── Default Arena Obstacle Layout ──────────────────────────────────

/**
 * Create the deterministic default obstacle layout for the arena.
 * BLOCKOUT-08H: Dev/arena-only.
 *
 * Layout design:
 * - 2 wall segments near center-left/right
 * - 2 cover crates near midline
 * - 1 low barrier near center
 * - 1 rock offset from vehicle spawn path
 * - Does not trap vehicles at spawn positions
 * - Leaves enough open space for movement/firing
 * - Obstacles are placed so line-of-fire blocking is clearly visible
 *
 * No random placement. No mapgen changes.
 */
export function createDefaultArenaObstacles(): BlockoutObstacleState[] {
  const obstacles: BlockoutObstacleState[] = [];

  // Helper: place obstacle at tile coordinates, convert to screen space
  const placeAt = (
    type: BlockoutObstacleType,
    tx: number, ty: number,
  ): void => {
    const config = OBSTACLE_TYPE_CONFIGS[type];
    const screenPos = tileToScreen(tx, ty);
    const obstacle = createBlockoutObstacle(
      type,
      screenPos.x,
      screenPos.y,
      { ...config.shape }, // clone shape
      config.blocksMovement,
      config.blocksLineOfFire,
      config.blocksSplash,
      config.pierceable,
    );
    obstacles.push(obstacle);
  };

  // 2 wall segments near center-left and center-right
  placeAt('blocker_wall', 7, 8);   // center-left wall
  placeAt('blocker_wall', 12, 12);  // center-right wall

  // 2 cover crates near midline
  placeAt('cover_crate', 9, 10);   // midline left crate
  placeAt('cover_crate', 11, 10);  // midline right crate

  // 1 low barrier near center
  placeAt('low_barrier', 10, 8);   // center barrier

  // 1 rock offset from vehicle spawn path
  placeAt('dummy_rock', 14, 7);    // upper-right rock

  return obstacles;
}
