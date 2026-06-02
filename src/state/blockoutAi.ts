/**
 * Blockout AI — enemy behavior modes for Arena sandbox.
 *
 * ARENA-05H+: Provides simple AI behavior for enemy units so
 * Denis can test early combat situations, not just static targets.
 *
 * Pure TypeScript, no Phaser, no DOM.
 * AI update is gated to Arena mode — Normal Game is unchanged.
 *
 * Modes:
 * - passive: enemy stands still, does not fire
 * - stationary_shooter: enemy stands still, targets nearest ally, fires
 * - chaser: enemy moves toward nearest ally, fires when in range
 * - hold_position: enemy engages only within hold radius from spawn point
 *
 * Tick rate: AI decisions update at ~200ms intervals for performance.
 * Turret aiming updates every frame (via existing turret rotation system).
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import { startFiring, stopFiring, canFireBlockoutWeapon } from './blockoutWeaponVfx';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';
import { getEffectiveDamageProfile } from './blockoutUpgrades';
import { angleFromTo } from './angleMath';

// ─── Constants ──────────────────────────────────────────────────────

/** AI tick interval in milliseconds. Decisions are not made every frame. */
export const AI_TICK_INTERVAL_MS = 200;

/** Distance threshold for "in weapon range" (screen-space pixels). */
export const AI_RANGE_TOLERANCE_PX = 20;

// ─── AI update options ──────────────────────────────────────────────

/** Options for updateBlockoutAi. */
export interface BlockoutAiOptions {
  /** Current scene time in milliseconds. */
  nowMs: number;
  /** Map origin offset for world-to-screen conversions. */
  offsetX: number;
  offsetY: number;
}

// ─── Module-local tick timer ────────────────────────────────────────

let _lastAiTickMs = 0;

/** Reset AI tick timer (for tests). */
export function resetAiTickTimer(): void {
  _lastAiTickMs = 0;
}

// ─── Distance helper ────────────────────────────────────────────────

/** Compute screen-space distance between two vehicles (with offset). */
function vehicleDistance(
  a: BlockoutVehicleState,
  b: BlockoutVehicleState,
  offsetX: number,
  offsetY: number,
): number {
  const ax = a.worldX + offsetX;
  const ay = a.worldY + offsetY;
  const bx = b.worldX + offsetX;
  const by = b.worldY + offsetY;
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compute screen-space distance from vehicle to a point. */
function distanceTo(
  v: BlockoutVehicleState,
  px: number,
  py: number,
  offsetX: number,
  offsetY: number,
): number {
  const vx = v.worldX + offsetX;
  const vy = v.worldY + offsetY;
  const dx = vx - px;
  const dy = vy - py;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Find nearest ally ──────────────────────────────────────────────

/**
 * Find the nearest alive ally vehicle.
 * Returns null if no valid ally exists.
 */
export function findNearestAlly(
  vehicles: BlockoutVehicleState[],
  enemy: BlockoutVehicleState,
  offsetX: number,
  offsetY: number,
  maxRangePx: number = Infinity,
): BlockoutVehicleState | null {
  let nearest: BlockoutVehicleState | null = null;
  let nearestDist = Infinity;

  for (const v of vehicles) {
    if (v.team !== 'ally' || v.isDestroyed) continue;
    const dist = vehicleDistance(enemy, v, offsetX, offsetY);
    if (dist < nearestDist && dist <= maxRangePx) {
      nearestDist = dist;
      nearest = v;
    }
  }

  return nearest;
}

// ─── Weapon range ───────────────────────────────────────────────────

/** Get the effective weapon range for a vehicle (screen-space pixels). */
function getWeaponRangePx(vehicle: BlockoutVehicleState): number {
  const baseProfile = DAMAGE_PROFILES[vehicle.weaponId];
  if (!baseProfile) return 0;
  const effectiveProfile = getEffectiveDamageProfile(vehicle, baseProfile);
  return effectiveProfile.rangePx ?? 0;
}

// ─── Turret aim toward target ───────────────────────────────────────

/**
 * Update enemy turret target angle to aim at a target vehicle.
 * Uses the same angle calculation as ally target-lock.
 * Returns true if turret was updated.
 */
export function aimTurretAtTarget(
  enemy: BlockoutVehicleState,
  target: BlockoutVehicleState,
  offsetX: number,
  offsetY: number,
): boolean {
  const fromX = enemy.worldX + offsetX;
  const fromY = enemy.worldY + offsetY;
  const toX = target.worldX + offsetX;
  const toY = target.worldY + offsetY;
  enemy.turretTargetAngle = angleFromTo(fromX, fromY, toX, toY);
  return true;
}

// ─── AI mode handlers ───────────────────────────────────────────────

/**
 * Handle passive mode: enemy does nothing.
 * Ensures enemy is not firing and has no target.
 */
function handlePassive(enemy: BlockoutVehicleState): void {
  // Clear any target the enemy might have
  if (enemy.targetVehicleId !== null) {
    enemy.targetVehicleId = null;
  }
  // Ensure not firing
  if (enemy.fireHeld || enemy.isFiring) {
    stopFiring(enemy);
  }
}

/**
 * Handle stationary_shooter mode: enemy stands still, targets nearest ally, fires.
 */
function handleStationaryShooter(
  enemy: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  offsetX: number,
  offsetY: number,
  nowMs: number,
): void {
  const range = getWeaponRangePx(enemy);
  const nearestAlly = findNearestAlly(vehicles, enemy, offsetX, offsetY, range + AI_RANGE_TOLERANCE_PX);

  if (!nearestAlly) {
    // No ally in range — stop targeting/firing
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    return;
  }

  // Set target and aim turret
  enemy.targetVehicleId = nearestAlly.id;
  aimTurretAtTarget(enemy, nearestAlly, offsetX, offsetY);

  // Start firing if weapon is ready
  if (canFireBlockoutWeapon(enemy, nowMs)) {
    if (!enemy.fireHeld) {
      startFiring(enemy);
    }
  }
}

/**
 * Handle chaser mode: enemy moves toward nearest ally, fires when in range.
 */
function handleChaser(
  enemy: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  offsetX: number,
  offsetY: number,
  nowMs: number,
): void {
  const range = getWeaponRangePx(enemy);
  const nearestAlly = findNearestAlly(vehicles, enemy, offsetX, offsetY);

  if (!nearestAlly) {
    // No ally at all — stop targeting, firing, and movement
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    enemy.hasMoveTarget = false;
    return;
  }

  const dist = vehicleDistance(enemy, nearestAlly, offsetX, offsetY);

  // Set target and aim turret
  enemy.targetVehicleId = nearestAlly.id;
  aimTurretAtTarget(enemy, nearestAlly, offsetX, offsetY);

  // Move toward ally if not in weapon range
  if (dist > range - AI_RANGE_TOLERANCE_PX) {
    // Set movement target to ally position
    enemy.targetWorldX = nearestAlly.worldX;
    enemy.targetWorldY = nearestAlly.worldY;
    enemy.hasMoveTarget = true;
    // Stop firing while closing distance (except continuous weapons)
    if (!canFireBlockoutWeapon(enemy, nowMs) && enemy.isFiring) {
      // Keep fire state for continuous weapons that can still tick
    }
  } else {
    // In range — stop moving
    enemy.hasMoveTarget = false;
  }

  // Start firing if weapon is ready
  if (canFireBlockoutWeapon(enemy, nowMs)) {
    if (!enemy.fireHeld) {
      startFiring(enemy);
    }
  }
}

/**
 * Handle hold_position mode: enemy engages only within hold radius.
 * If ally is within hold radius, act like stationary_shooter.
 * If enemy has chased outside hold radius, return to hold position.
 */
function handleHoldPosition(
  enemy: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  offsetX: number,
  offsetY: number,
  nowMs: number,
): void {
  const holdRadius = enemy.aiHoldRadius;

  // Find nearest ally within hold radius
  const nearestAlly = findNearestAlly(vehicles, enemy, offsetX, offsetY, holdRadius);

  // Check if enemy has strayed too far from hold position
  const distFromHold = distanceTo(enemy, enemy.aiHoldX, enemy.aiHoldY, offsetX, offsetY);

  if (distFromHold > holdRadius) {
    // Too far from hold position — return to hold position
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    enemy.targetWorldX = enemy.aiHoldX;
    enemy.targetWorldY = enemy.aiHoldY;
    enemy.hasMoveTarget = true;
    return;
  }

  if (!nearestAlly) {
    // No ally in range — stop targeting/firing
    enemy.targetVehicleId = null;
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
    enemy.hasMoveTarget = false;
    return;
  }

  // Ally is within hold radius — aim and fire like stationary_shooter
  enemy.targetVehicleId = nearestAlly.id;
  aimTurretAtTarget(enemy, nearestAlly, offsetX, offsetY);

  // Don't move — hold position just shoots from where it stands
  enemy.hasMoveTarget = false;

  // Start firing if weapon is ready
  if (canFireBlockoutWeapon(enemy, nowMs)) {
    if (!enemy.fireHeld) {
      startFiring(enemy);
    }
  }
}

// ─── Main AI update ─────────────────────────────────────────────────

/**
 * Update AI for all enemy vehicles. ARENA-05H+.
 *
 * Only processes enemies with aiMode !== 'passive'.
 * Allies are skipped entirely (they are player-controlled).
 * AI tick decisions are throttled to AI_TICK_INTERVAL_MS for performance.
 * Turret aiming (via targetVehicleId) is updated every tick.
 *
 * @param vehicles - All blockout vehicles (mutated: enemy state updated)
 * @param options - AI update options (time, offsets)
 */
export function updateBlockoutAi(
  vehicles: BlockoutVehicleState[],
  options: BlockoutAiOptions,
): void {
  const { nowMs, offsetX, offsetY } = options;

  // Throttle AI tick
  const shouldTick = (nowMs - _lastAiTickMs) >= AI_TICK_INTERVAL_MS;
  if (shouldTick) {
    _lastAiTickMs = nowMs;
  }

  for (const vehicle of vehicles) {
    // Skip allies — they are player-controlled
    if (vehicle.team !== 'enemy') continue;
    // Skip destroyed enemies
    if (vehicle.isDestroyed) continue;

    // Always validate target existence (every frame, cheap check)
    if (vehicle.targetVehicleId) {
      const target = vehicles.find(v => v.id === vehicle.targetVehicleId);
      if (!target || target.isDestroyed) {
        vehicle.targetVehicleId = null;
        if (vehicle.fireHeld || vehicle.isFiring) {
          stopFiring(vehicle);
        }
      }
    }

    // Only run AI decision logic on tick interval
    if (!shouldTick) continue;

    switch (vehicle.aiMode) {
      case 'passive':
        handlePassive(vehicle);
        break;
      case 'stationary_shooter':
        handleStationaryShooter(vehicle, vehicles, offsetX, offsetY, nowMs);
        break;
      case 'chaser':
        handleChaser(vehicle, vehicles, offsetX, offsetY, nowMs);
        break;
      case 'hold_position':
        handleHoldPosition(vehicle, vehicles, offsetX, offsetY, nowMs);
        break;
    }
  }
}
