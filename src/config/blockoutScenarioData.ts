/**
 * Blockout scenario data — curated deterministic combat sandbox layouts.
 *
 * BLOCKOUT-10H+: Dev/arena-only curated scenario for combat readability QA.
 *
 * Defines scenario layout types and the default sandbox scenario.
 * All vehicle/obstacle placements are deterministic (no random).
 * All data is dev/arena-only and not persisted in saves.
 * This file is pure TypeScript with no Phaser dependencies.
 */

import type { Faction } from '../state/types';
import type { BlockoutObstacleType } from '../state/blockoutObstacleState';

// ─── Scenario Types ────────────────────────────────────────────────

/** A vehicle spawn entry in a scenario. */
export interface ScenarioVehicleSpawn {
  /** Vehicle profile ID from VEHICLE_PROFILES (e.g. 'wasp-smoky'). */
  vehicleId: string;
  /** Tile X position. */
  tx: number;
  /** Tile Y position. */
  ty: number;
  /** Faction assignment. */
  faction: Faction;
  /** Optional initial body angle in radians. Defaults to Math.PI/2 (south). */
  bodyAngle?: number;
}

/** An obstacle placement entry in a scenario. */
export interface ScenarioObstaclePlacement {
  /** Obstacle type ID from OBSTACLE_TYPE_CONFIGS. */
  type: BlockoutObstacleType;
  /** Tile X position. */
  tx: number;
  /** Tile Y position. */
  ty: number;
}

/** A complete combat sandbox scenario. */
export interface BlockoutScenario {
  /** Unique scenario ID. */
  id: string;
  /** Human-readable scenario name. */
  name: string;
  /** Vehicle spawns (deterministic, no random). */
  vehicles: ScenarioVehicleSpawn[];
  /** Obstacle placements (deterministic, no random). */
  obstacles: ScenarioObstaclePlacement[];
}

// ─── Default Sandbox Scenario ──────────────────────────────────────

/**
 * Curated default sandbox scenario for BLOCKOUT-10H+ combat readability QA.
 *
 * Layout design goals:
 * - All 9 vehicle profiles present and placed for immediate testing of:
 *   - Direct fire (wasp-smoky → targets)
 *   - Splash (mammoth-thunder → targets near obstacles)
 *   - Rail/penetration (dictator-railgun, mammoth-railgun)
 *   - Cone/beam/rapid/plasma/ricochet/shotgun (all other weapons)
 *   - Obstacle blocking (wall between shooter and target)
 *   - Piercing (low_barrier is pierceable)
 *   - Cover (crate/rock blocks line-of-fire)
 *   - Upgrades
 * - Obstacles placed so:
 *   - One clear wall between a shooter and target position
 *   - One pierceable low barrier in a fire lane
 *   - One open lane for testing
 *   - One cover crate/rock near targets
 * - Layout does NOT trap vehicles
 * - No random placement
 *
 * Grid reference (20×20 arena):
 *   Player vehicles (cyan): left/center side
 *   Enemy vehicles (green): right/center side
 *   Obstacles: center area creating fire lanes
 */
export const DEFAULT_SANDBOX_SCENARIO: BlockoutScenario = {
  id: 'default-sandbox',
  name: 'Default Sandbox (9 vehicles)',

  vehicles: [
    // ── Player (cyan) vehicles — left side ──
    {
      vehicleId: 'wasp-smoky',
      tx: 4, ty: 4,
      faction: 'cyan',
      bodyAngle: 0, // facing east
    },
    {
      vehicleId: 'hornet-ricochet',
      tx: 4, ty: 7,
      faction: 'cyan',
      bodyAngle: 0,
    },
    {
      vehicleId: 'hunter-smoky',
      tx: 3, ty: 10,
      faction: 'cyan',
      bodyAngle: 0,
    },
    {
      vehicleId: 'hunter-twins',
      tx: 4, ty: 13,
      faction: 'cyan',
      bodyAngle: 0,
    },
    {
      vehicleId: 'viking-isida',
      tx: 3, ty: 16,
      faction: 'cyan',
      bodyAngle: 0,
    },

    // ── Enemy (green) vehicles — right side ──
    {
      vehicleId: 'dictator-railgun',
      tx: 15, ty: 4,
      faction: 'green',
      bodyAngle: Math.PI, // facing west
    },
    {
      vehicleId: 'titan-vulcan',
      tx: 16, ty: 9,
      faction: 'green',
      bodyAngle: Math.PI,
    },
    {
      vehicleId: 'mammoth-thunder',
      tx: 15, ty: 13,
      faction: 'green',
      bodyAngle: Math.PI,
    },
    {
      vehicleId: 'mammoth-railgun',
      tx: 16, ty: 16,
      faction: 'green',
      bodyAngle: Math.PI,
    },
  ],

  obstacles: [
    // ── Wall between shooter (wasp) and target (dictator) ──
    // Placed at the center column so wasp-smoky at (4,4) → wall at (9,4) → dictator at (15,4)
    {
      type: 'blocker_wall',
      tx: 9, ty: 4,
    },

    // ── Pierceable low barrier in a fire lane ──
    // Between hunter-smoky at (3,10) and titan-vulcan at (16,9)
    // Railgun and mammoth-railgun can pierce through this
    {
      type: 'low_barrier',
      tx: 9, ty: 9,
    },

    // ── Cover crate near targets ──
    // Near mammoth-thunder at (15,13) — provides cover from direct fire
    {
      type: 'cover_crate',
      tx: 13, ty: 12,
    },

    // ── Cover rock near targets ──
    // Near titan-vulcan at (16,9) — provides cover from wasp/hornet fire
    {
      type: 'dummy_rock',
      tx: 13, ty: 8,
    },

    // ── Second wall — center column, creating an open lane on one side ──
    // This wall blocks fire between center vehicles but the lane around it is open
    {
      type: 'blocker_wall',
      tx: 10, ty: 14,
    },

    // ── Additional low barrier for testing piercing at different angles ──
    {
      type: 'low_barrier',
      tx: 10, ty: 16,
    },
  ],
};

// ─── Arena Sandbox Scenario (ARENA-01H+) ──────────────────────────

/**
 * Arena sandbox scenario — same vehicles as DEFAULT_SANDBOX_SCENARIO
 * but WITHOUT obstacles.
 *
 * ARENA-01H+: Arena is a clean standalone mode with no gameplay obstacles.
 * Obstacle systems remain in code for Normal Game — they are simply
 * not instantiated in Arena runtime.
 */
export const ARENA_SANDBOX_SCENARIO: BlockoutScenario = {
  id: 'arena-sandbox',
  name: 'Arena Sandbox (9 vehicles, no obstacles)',

  vehicles: DEFAULT_SANDBOX_SCENARIO.vehicles,

  obstacles: [],
};
