/**
 * Blockout vehicle movement update — pure TypeScript, no Phaser dependencies.
 *
 * BLOCKOUT-04H+: Semi-physics movement for blockout vehicles.
 * Vehicles accelerate, brake, and turn gradually.
 * Movement profile determines per-body feel.
 *
 * All positions are in screen-space pixels (worldX/worldY).
 * Offset is NOT included — caller adds offset for rendering/input.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { MovementProfile } from '../config/blockoutProfiles';
import type { BlockoutObstacleState } from './blockoutObstacleState';
import { rotateTowardAngle, degPerSecToRadPerMs } from './angleMath';
import { resolveVehicleObstacleCollisions } from './blockoutObstacles';
import { getBodyPixelSize } from '../phaser/render/blockoutVehicleGeometry';
import { getEffectiveMovementProfile } from './blockoutUpgrades';

// ─── Tile coordinate constants ────────────────────────────────────

/** Tile width in pixels (from worldConfig). */
const TILE_W = 76;
/** Tile height in pixels (from worldConfig). */
const TILE_H = 38;

// ─── Movement update ──────────────────────────────────────────────

/**
 * Update a blockout vehicle's movement for one frame.
 *
 * Mutates vehicle state directly (same pattern as turret rotation).
 * This is a semi-physics arcade update, not a real physics engine.
 *
 * Algorithm:
 * 1. If no move target, decelerate to zero.
 * 2. Compute vector to target and desired body angle.
 * 3. Rotate bodyAngle toward desired angle (rate-limited).
 * 4. Accelerate or brake based on stopping distance.
 * 5. Update velocity from bodyAngle + speed.
 * 6. Update worldX/worldY position.
 * 7. Update tx/ty approximately from screen position.
 * 8. On arrival, clear target and snap to target position.
 *
 * @param vehicle - Vehicle state (mutated in place)
 * @param profile - Movement profile for this vehicle's body
 * @param deltaMs - Frame delta in milliseconds
 */
export function updateBlockoutVehicleMovement(
  vehicle: BlockoutVehicleState,
  profile: MovementProfile,
  deltaMs: number,
  obstacles: BlockoutObstacleState[] = [],
): void {
  // BLOCKOUT-07H+: Destroyed vehicles don't move
  if (vehicle.isDestroyed) return;

  // BLOCKOUT-09H: Use effective movement profile (with upgrade modifiers)
  const effectiveProfile = getEffectiveMovementProfile(vehicle, profile);

  const dt = deltaMs / 1000; // seconds

  if (!vehicle.hasMoveTarget) {
    // No target — decelerate to zero
    if (vehicle.speed > 0) {
      const brakeAmount = effectiveProfile.brakingPxPerSec2 * dt;
      vehicle.speed = Math.max(0, vehicle.speed - brakeAmount);
    }
    // Update velocity from body angle and speed
    vehicle.vx = Math.cos(vehicle.bodyAngle) * vehicle.speed;
    vehicle.vy = Math.sin(vehicle.bodyAngle) * vehicle.speed;
    // Update position
    vehicle.worldX += vehicle.vx * dt;
    vehicle.worldY += vehicle.vy * dt;
    // BLOCKOUT-08H: Resolve obstacle collisions
    resolveObstacleCollisions(vehicle, obstacles);
    // Update tile position
    updateTileFromScreen(vehicle);
    return;
  }

  // Compute vector to target (in screen space)
  const dx = vehicle.targetWorldX - vehicle.worldX;
  const dy = vehicle.targetWorldY - vehicle.worldY;
  const distToTarget = Math.sqrt(dx * dx + dy * dy);

  // Compute desired body angle (toward target)
  const desiredAngle = Math.atan2(dy, dx);

  // Rotate body toward desired angle (rate-limited by turnSpeedDeg)
  const maxTurnRad = degPerSecToRadPerMs(effectiveProfile.turnSpeedDeg) * deltaMs;
  vehicle.bodyAngle = rotateTowardAngle(vehicle.bodyAngle, desiredAngle, maxTurnRad);

  // Check arrival
  if (distToTarget <= effectiveProfile.arrivalRadiusPx) {
    // Arrived at target
    vehicle.hasMoveTarget = false;
    vehicle.speed = 0;
    vehicle.vx = 0;
    vehicle.vy = 0;
    // Snap to target to avoid residual drift
    vehicle.worldX = vehicle.targetWorldX;
    vehicle.worldY = vehicle.targetWorldY;
    updateTileFromScreen(vehicle);
    return;
  }

  // Compute stopping distance: v² / (2 * braking)
  const stoppingDist = vehicle.speed > 0
    ? (vehicle.speed * vehicle.speed) / (2 * effectiveProfile.brakingPxPerSec2)
    : 0;

  if (distToTarget <= stoppingDist + effectiveProfile.arrivalRadiusPx) {
    // Need to brake — slow down
    const brakeAmount = effectiveProfile.brakingPxPerSec2 * dt;
    vehicle.speed = Math.max(0, vehicle.speed - brakeAmount);
  } else {
    // Accelerate toward max speed
    const accelAmount = effectiveProfile.accelerationPxPerSec2 * dt;
    vehicle.speed = Math.min(effectiveProfile.maxSpeedPxPerSec, vehicle.speed + accelAmount);
  }

  // Update velocity from body angle and speed
  vehicle.vx = Math.cos(vehicle.bodyAngle) * vehicle.speed;
  vehicle.vy = Math.sin(vehicle.bodyAngle) * vehicle.speed;

  // Update position
  vehicle.worldX += vehicle.vx * dt;
  vehicle.worldY += vehicle.vy * dt;

  // BLOCKOUT-08H: Resolve obstacle collisions
  resolveObstacleCollisions(vehicle, obstacles);

  // Update tile position
  updateTileFromScreen(vehicle);
}

// ─── Tile position update ─────────────────────────────────────────

/**
 * Update tx/ty from screen-space worldX/worldY.
 *
 * Uses the inverse of tileToScreen:
 *   screen.x = (tx - ty) * TILE_W / 2
 *   screen.y = (tx + ty) * TILE_H / 2
 *
 * Inverse:
 *   tx = (screen.x / halfW + screen.y / halfH) / 2
 *   ty = (screen.y / halfH - screen.x / halfW) / 2
 */
function updateTileFromScreen(vehicle: BlockoutVehicleState): void {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const newTx = (vehicle.worldX / halfW + vehicle.worldY / halfH) / 2;
  const newTy = (vehicle.worldY / halfH - vehicle.worldX / halfW) / 2;
  vehicle.tx = Math.round(newTx);
  vehicle.ty = Math.round(newTy);
}

// ─── Movement target helpers ──────────────────────────────────────

/**
 * Set a movement target for a blockout vehicle in screen-space coordinates.
 *
 * @param vehicle - Vehicle state
 * @param screenX - Target X in screen-space pixels (world coords minus offset)
 * @param screenY - Target Y in screen-space pixels (world coords minus offset)
 */
export function setBlockoutVehicleMoveTarget(
  vehicle: BlockoutVehicleState,
  screenX: number,
  screenY: number,
): void {
  vehicle.targetWorldX = screenX;
  vehicle.targetWorldY = screenY;
  vehicle.hasMoveTarget = true;
}

/**
 * Clear the movement target for a blockout vehicle.
 */
export function clearBlockoutVehicleMoveTarget(vehicle: BlockoutVehicleState): void {
  vehicle.hasMoveTarget = false;
}

// ─── Obstacle collision helper ──────────────────────────────────────

/**
 * Resolve obstacle collisions for a blockout vehicle.
 * BLOCKOUT-08H: Clamps vehicle position outside obstacles and adjusts velocity.
 *
 * @param vehicle - Vehicle state (mutated in place)
 * @param obstacles - List of obstacles to check
 */
function resolveObstacleCollisions(
  vehicle: BlockoutVehicleState,
  obstacles: BlockoutObstacleState[],
): void {
  if (obstacles.length === 0) return;

  const bodySize = getBodyPixelSize(vehicle.bodyId);
  const vehicleRadius = Math.max(bodySize.w, bodySize.h) / 2 + 4; // 4px padding

  const result = resolveVehicleObstacleCollisions(
    vehicle.worldX, vehicle.worldY,
    vehicleRadius,
    vehicle.vx, vehicle.vy,
    obstacles,
  );

  vehicle.worldX = result.worldX;
  vehicle.worldY = result.worldY;
  vehicle.vx = result.vx;
  vehicle.vy = result.vy;

  // Recalculate speed from updated velocity
  vehicle.speed = Math.sqrt(result.vx * result.vx + result.vy * result.vy);

  // If collision happened and vehicle is nearly stopped, clear move target
  if (result.collided && vehicle.speed < 2) {
    vehicle.speed = 0;
    vehicle.vx = 0;
    vehicle.vy = 0;
  }
}
