/**
 * Blockout scenario logic — create vehicles/obstacles from scenario, reset.
 *
 * BLOCKOUT-10H+: Dev/arena-only combat sandbox scenario management.
 *
 * Pure TypeScript — no Phaser dependencies.
 * All state is transient and NOT persisted in saves.
 */

import type { BlockoutScenario } from '../config/blockoutScenarioData';
import { VEHICLE_PROFILES } from '../config/blockoutVehicleData';
import { OBSTACLE_TYPE_CONFIGS } from '../config/blockoutObstacleData';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter, type BlockoutVehicleState } from './blockoutVehicleState';
import { createBlockoutObstacle, resetBlockoutObstacleIdCounter, type BlockoutObstacleState } from './blockoutObstacleState';
import { tileToScreen } from '../phaser/render/isometric';
import { clearVfxEvents } from './blockoutWeaponVfx';
import { clearDamageEvents } from './blockoutDamage';
import type { GameState } from './types';

// ─── Create vehicles from scenario ─────────────────────────────────

/**
 * Create blockout vehicles from a scenario layout.
 *
 * For each ScenarioVehicleSpawn, looks up the vehicle profile to get
 * bodyId/weaponId, then creates a fresh BlockoutVehicleState.
 *
 * Returns an array of newly created vehicles.
 */
export function createScenarioVehicles(scenario: BlockoutScenario): BlockoutVehicleState[] {
  const vehicles: BlockoutVehicleState[] = [];

  for (const spawn of scenario.vehicles) {
    const profile = VEHICLE_PROFILES[spawn.vehicleId];
    if (!profile) {
      console.warn(`[blockoutScenario] Unknown vehicle profile: ${spawn.vehicleId}, skipping`);
      continue;
    }

    const vehicle = createBlockoutVehicle(
      profile.bodyId,
      profile.weaponId,
      spawn.faction,
      spawn.tx,
      spawn.ty,
      spawn.bodyAngle ?? Math.PI / 2,
    );

    vehicles.push(vehicle);
  }

  return vehicles;
}

// ─── Create obstacles from scenario ────────────────────────────────

/**
 * Create blockout obstacles from a scenario layout.
 *
 * For each ScenarioObstaclePlacement, looks up the obstacle type config
 * to get shape/blocking properties, then creates a fresh BlockoutObstacleState.
 *
 * Returns an array of newly created obstacles.
 */
export function createScenarioObstacles(scenario: BlockoutScenario): BlockoutObstacleState[] {
  const obstacles: BlockoutObstacleState[] = [];

  for (const placement of scenario.obstacles) {
    const config = OBSTACLE_TYPE_CONFIGS[placement.type];
    if (!config) {
      console.warn(`[blockoutScenario] Unknown obstacle type: ${placement.type}, skipping`);
      continue;
    }

    const screenPos = tileToScreen(placement.tx, placement.ty);
    const obstacle = createBlockoutObstacle(
      placement.type,
      screenPos.x,
      screenPos.y,
      { ...config.shape }, // clone shape
      config.blocksMovement,
      config.blocksLineOfFire,
      config.blocksSplash,
      config.pierceable,
    );

    obstacles.push(obstacle);
  }

  return obstacles;
}

// ─── Reset game state to scenario defaults ─────────────────────────

/**
 * Reset game state to scenario defaults.
 *
 * - Replaces blockoutVehicles with fresh vehicles from scenario
 *   (full HP, no upgrades, no destroyed state, no firing, no movement targets)
 * - Replaces blockoutObstacles with fresh obstacles from scenario
 * - Clears all VFX events
 * - Clears all damage events
 * - Does NOT affect normal game state (economy, harvesters, buildings, etc.)
 * - Does NOT trigger save/load
 *
 * @param state - The current game state (mutated in place)
 * @param scenario - The scenario to reset to
 */
export function resetBlockoutScenario(state: GameState, scenario: BlockoutScenario): void {
  // Reset ID counters for determinism
  resetBlockoutVehicleIdCounter();
  resetBlockoutObstacleIdCounter();

  // Replace vehicles with fresh set from scenario
  state.blockoutVehicles = createScenarioVehicles(scenario);

  // Replace obstacles with fresh set from scenario
  state.blockoutObstacles = createScenarioObstacles(scenario);

  // Clear all VFX events
  clearVfxEvents();

  // Clear all damage events
  clearDamageEvents();
}
