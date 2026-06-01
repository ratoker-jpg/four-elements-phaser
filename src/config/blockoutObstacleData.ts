/**
 * Blockout obstacle data — obstacle profiles for the first blockout set.
 *
 * Blockout placeholder — NOT used in BLOCKOUT-02H.
 * No obstacle behavior in this PR.
 * Data exists so profiles are complete for future steps.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { ObstacleProfile } from './blockoutProfiles';

/** Obstacle profiles keyed by ID. */
export const OBSTACLE_PROFILES: Record<string, ObstacleProfile> = {
  blocker_1x1: {
    id: 'blocker_1x1',
    footprint: [1, 1],
    blocksMovement: true,
    blocksProjectiles: true,
    blocksBeam: true,
    blocksCone: true,
    blocksVision: false,
  },
  blocker_2x1: {
    id: 'blocker_2x1',
    footprint: [2, 1],
    blocksMovement: true,
    blocksProjectiles: true,
    blocksBeam: true,
    blocksCone: true,
    blocksVision: false,
  },
  blocker_2x2: {
    id: 'blocker_2x2',
    footprint: [2, 2],
    blocksMovement: true,
    blocksProjectiles: true,
    blocksBeam: true,
    blocksCone: true,
    blocksVision: false,
  },
  wall_segment: {
    id: 'wall_segment',
    footprint: [3, 1],
    blocksMovement: true,
    blocksProjectiles: true,
    blocksBeam: true,
    blocksCone: true,
    blocksVision: false,
  },
  wreck_placeholder: {
    id: 'wreck_placeholder',
    footprint: [1, 1],
    blocksMovement: true,
    blocksProjectiles: false,
    blocksBeam: false,
    blocksCone: false,
    blocksVision: false,
  },
  industrial_crate: {
    id: 'industrial_crate',
    footprint: [1, 1],
    blocksMovement: true,
    blocksProjectiles: true,
    blocksBeam: false,
    blocksCone: false,
    blocksVision: false,
  },
};
