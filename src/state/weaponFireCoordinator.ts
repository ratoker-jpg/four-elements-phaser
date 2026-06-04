/**
 * Weapon fire coordinator — bridges weapon runtime resource models
 * with the actual fire path.
 *
 * CORE-STEP-08H+ FIXUP: This module provides the single integration point
 * between weapon runtime states (canister, overheat, wind-up, magazine, drum)
 * and the actual fire/damage/VFX path.
 *
 * Responsibilities:
 * 1. Update weapon resources each frame (Blocker 1)
 * 2. Gate fire decisions by runtime state (wind-up, drum, etc.) (Blocker 3)
 * 3. Manage wind-up charge → fire sequence for Railgun (Blocker 3)
 * 4. Manage drum burst → reload sequence for Hammer (Blocker 3)
 * 5. Use production M-level config for cooldowns (Blocker 4)
 *
 * Architecture: state layer — no Phaser imports.
 * All timing uses passed-in nowMs (from Phaser scene time).
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import { updateWeaponResources, type WeaponResourceUpdateOptions } from './weaponResources';
import {
  canFireByRuntimeState,
  checkWindUpComplete,
  startWindUp,
  resetWindUpAfterFire,
  startDrumBurst,
  canDrumVolleyFire,
  recordDrumVolleyFired,
  checkDrumReloadComplete,
} from './weaponRuntime';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';
import { canFireBlockoutWeapon, fireBlockoutWeapon } from './blockoutWeaponVfx';
import { getWeaponProfile } from '../config/blockoutWeaponData';
import { applyBlockoutWeaponDamage } from './blockoutDamage';
import { clearWeaponPendingStates } from './weaponResources';
import type { IsoPoint } from '../phaser/render/isometric';

// ─── Per-frame weapon resource update (Blocker 1) ────────────────────

/**
 * Update weapon resources for all active vehicles each frame.
 *
 * This is the integration point that was missing — weapon resources
 * (canister drain/regen, overheat cooling, magazine regen, drum reload,
 * wind-up progress) now tick each frame via the GameScene update loop.
 *
 * Must be called once per frame per vehicle, using Phaser scene time.
 *
 * @param vehicles - All blockout vehicles
 * @param nowMs - Current Phaser scene time (this.time.now)
 * @param deltaMs - Frame delta in milliseconds
 */
export function updateAllWeaponResources(
  vehicles: BlockoutVehicleState[],
  nowMs: number,
  deltaMs: number,
): void {
  const deltaSec = deltaMs / 1000;

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;

    const isFiring = vehicle.fireHeld || vehicle.isFiring;

    // Tick wind-up progress (event-driven, but needs time check)
    if (vehicle.weaponRuntime.windUp && vehicle.weaponRuntime.windUp.isCharging) {
      checkWindUpComplete(vehicle.weaponRuntime, nowMs);
    }

    // Tick drum reload progress (event-driven, but needs time check)
    if (vehicle.weaponRuntime.drum && vehicle.weaponRuntime.drum.isReloading) {
      checkDrumReloadComplete(vehicle.weaponRuntime, nowMs);
    }

    const options: WeaponResourceUpdateOptions = {
      nowMs,
      deltaSec,
      isFiring,
    };

    updateWeaponResources(vehicle.weaponRuntime, options);
  }
}

// ─── Fire coordinator (Blocker 3) ──────────────────────────────────

/**
 * Result of a tryFireWeaponWithRuntime attempt.
 */
export interface FireCoordinatorResult {
  /** Whether the weapon actually fired (VFX + damage). */
  fired: boolean;
  /** Why the weapon did NOT fire (null if fired). */
  reason: 'cooldown' | 'wind_up_charging' | 'canister_empty' | 'overheated' | 'magazine_empty' | 'drum_reloading' | 'drum_volley_delay' | 'runtime_gate' | null;
  /** For wind-up weapons: whether wind-up just completed this frame. */
  windUpCompleted: boolean;
  /** For drum weapons: whether this was a volley fire in a burst. */
  drumVolley: boolean;
}

/**
 * Try to fire a weapon with full runtime coordination.
 *
 * This is the single fire-path entry point that handles:
 * - Simple cooldown weapons (Smoky, Twins): fire when cooldown elapsed
 * - Canister weapons (Flamethrower, Freeze, Isida): fire when canister not empty
 * - Overheat weapons (Vulcan): fire when not overheated
 * - Wind-up weapons (Railgun): first intent starts charge, fire when complete
 * - Magazine weapons (Ricochet): fire when stock available
 * - Drum weapons (Hammer): manage burst count, delay, and reload
 *
 * @param vehicle - The vehicle trying to fire
 * @param barrelTipX - Barrel tip screen X (with offset)
 * @param barrelTipY - Barrel tip screen Y (with offset)
 * @param aimAngle - Turret angle at time of fire
 * @param aimTargetX - Aim target screen X (with offset)
 * @param aimTargetY - Aim target screen Y (with offset)
 * @param nowMs - Current Phaser scene time
 * @returns FireCoordinatorResult describing what happened
 */
export function tryFireWeaponWithRuntime(
  vehicle: BlockoutVehicleState,
  barrelTipX: number,
  barrelTipY: number,
  aimAngle: number,
  aimTargetX: number,
  aimTargetY: number,
  nowMs: number,
): FireCoordinatorResult {
  const runtime = vehicle.weaponRuntime;

  // ── Step 1: Check runtime resource gates ──

  // Canister empty check (before wind-up — canister weapons can't even start charge)
  if (runtime.canister && runtime.canister.isEmpty) {
    return { fired: false, reason: 'canister_empty', windUpCompleted: false, drumVolley: false };
  }

  // Overheat check
  if (runtime.overheat && runtime.overheat.isOverheated) {
    return { fired: false, reason: 'overheated', windUpCompleted: false, drumVolley: false };
  }

  // Magazine empty check
  if (runtime.magazine && runtime.magazine.isEmpty) {
    return { fired: false, reason: 'magazine_empty', windUpCompleted: false, drumVolley: false };
  }

  // Drum reload check
  if (runtime.drum && runtime.drum.isReloading) {
    return { fired: false, reason: 'drum_reloading', windUpCompleted: false, drumVolley: false };
  }

  // ── Step 2: Wind-up weapons (Railgun) ──

  if (runtime.windUp) {
    // Not currently charging — start wind-up
    if (!runtime.windUp.isCharging && !runtime.windUp.isReady) {
      startWindUp(runtime, nowMs);
      return { fired: false, reason: 'wind_up_charging', windUpCompleted: false, drumVolley: false };
    }

    // Charging but not yet ready
    if (runtime.windUp.isCharging && !runtime.windUp.isReady) {
      // Check if wind-up just completed
      const completed = checkWindUpComplete(runtime, nowMs);
      if (!completed) {
        return { fired: false, reason: 'wind_up_charging', windUpCompleted: false, drumVolley: false };
      }
      // Wind-up just completed — fall through to fire
    }

    // Wind-up is ready (isReady = true) — fire!
    const event = fireBlockoutWeapon(
      vehicle, barrelTipX, barrelTipY, aimAngle,
      aimTargetX, aimTargetY, nowMs,
    );

    // Reset wind-up after firing
    resetWindUpAfterFire(runtime);

    if (event) {
      return { fired: true, reason: null, windUpCompleted: true, drumVolley: false };
    }
    // Cooldown prevented fire even though wind-up was ready
    return { fired: false, reason: 'cooldown', windUpCompleted: true, drumVolley: false };
  }

  // ── Step 3: Drum weapons (Hammer) ──

  if (runtime.drum) {
    // Not currently bursting — start a new burst
    if (!runtime.drum.isBursting) {
      // Check cooldown first
      if (!canFireBlockoutWeapon(vehicle, nowMs)) {
        return { fired: false, reason: 'cooldown', windUpCompleted: false, drumVolley: false };
      }

      startDrumBurst(runtime, nowMs);

      const event = fireBlockoutWeapon(
        vehicle, barrelTipX, barrelTipY, aimAngle,
        aimTargetX, aimTargetY, nowMs,
      );

      if (event) {
        recordDrumVolleyFired(runtime, nowMs);
        return { fired: true, reason: null, windUpCompleted: false, drumVolley: true };
      }
      return { fired: false, reason: 'cooldown', windUpCompleted: false, drumVolley: false };
    }

    // Currently bursting — check delay between volleys
    if (!canDrumVolleyFire(runtime, nowMs)) {
      return { fired: false, reason: 'drum_volley_delay', windUpCompleted: false, drumVolley: false };
    }

    // Delay elapsed — fire next volley
    const event = fireBlockoutWeapon(
      vehicle, barrelTipX, barrelTipY, aimAngle,
      aimTargetX, aimTargetY, nowMs,
    );

    if (event) {
      recordDrumVolleyFired(runtime, nowMs);
      return { fired: true, reason: null, windUpCompleted: false, drumVolley: true };
    }
    return { fired: false, reason: 'cooldown', windUpCompleted: false, drumVolley: false };
  }

  // ── Step 4: Simple cooldown / canister / overheat / magazine weapons ──

  if (!canFireByRuntimeState(runtime)) {
    return { fired: false, reason: 'runtime_gate', windUpCompleted: false, drumVolley: false };
  }

  // Check cooldown using the standard path
  if (!canFireBlockoutWeapon(vehicle, nowMs)) {
    return { fired: false, reason: 'cooldown', windUpCompleted: false, drumVolley: false };
  }

  const event = fireBlockoutWeapon(
    vehicle, barrelTipX, barrelTipY, aimAngle,
    aimTargetX, aimTargetY, nowMs,
  );

  if (event) {
    return { fired: true, reason: null, windUpCompleted: false, drumVolley: false };
  }
  return { fired: false, reason: 'cooldown', windUpCompleted: false, drumVolley: false };
}

// ─── Fire + damage convenience wrapper ──────────────────────────────

/**
 * Fire a weapon with runtime coordination AND apply damage.
 *
 * This is the convenience wrapper used by both target-lock auto-fire
 * and AI fire paths. It calls tryFireWeaponWithRuntime() and, if the
 * weapon actually fired, also calls applyBlockoutWeaponDamage().
 *
 * @param vehicle - The vehicle trying to fire
 * @param vehicles - All vehicles (for splash/target finding)
 * @param barrelTipX - Barrel tip screen X (with offset)
 * @param barrelTipY - Barrel tip screen Y (with offset)
 * @param aimAngle - Turret angle
 * @param aimTargetX - Aim target screen X (with offset)
 * @param aimTargetY - Aim target screen Y (with offset)
 * @param offset - Map offset
 * @param nowMs - Current scene time
 * @param obstacles - Blockout obstacles
 * @returns FireCoordinatorResult
 */
export function tryFireWithDamage(
  vehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  barrelTipX: number,
  barrelTipY: number,
  aimAngle: number,
  aimTargetX: number,
  aimTargetY: number,
  offset: IsoPoint,
  nowMs: number,
  obstacles: import('./blockoutObstacleState').BlockoutObstacleState[] = [],
): FireCoordinatorResult {
  const result = tryFireWeaponWithRuntime(
    vehicle, barrelTipX, barrelTipY, aimAngle,
    aimTargetX, aimTargetY, nowMs,
  );

  if (result.fired) {
    applyBlockoutWeaponDamage(
      vehicle, vehicles,
      barrelTipX, barrelTipY, aimAngle,
      aimTargetX, aimTargetY,
      offset, nowMs, obstacles,
    );
  }

  return result;
}

// ─── Target clear helper ──────────────────────────────────────────

/**
 * Clear weapon pending states when target-lock is cleared (S key).
 *
 * - Cancels wind-up charge (Railgun)
 * - Cancels drum burst (Hammer) but keeps reload if drum is empty
 * - Calls stopFiring() to clear fireHeld/isFiring
 *
 * @param vehicle - Vehicle whose target-lock is being cleared
 */
export function clearTargetAndWeaponState(vehicle: BlockoutVehicleState): void {
  // Clear target
  vehicle.targetVehicleId = null;

  // Stop firing state
  if (vehicle.fireHeld || vehicle.isFiring) {
    vehicle.fireHeld = false;
    vehicle.isFiring = false;
    vehicle.visualOverheat = 0;
  }

  // Clear weapon pending states (wind-up, drum burst)
  clearWeaponPendingStates(vehicle.weaponRuntime);
}

// ─── M-level cooldown helper (Blocker 4) ──────────────────────────

/**
 * Get effective weapon cooldown in ms at the vehicle's modification level.
 *
 * Uses production weapon config (weaponData.ts) instead of blockout
 * profile cooldown. This ensures M0-M3 scaling works in the runtime
 * fire path, not just in config helpers.
 *
 * Falls back to blockout profile cooldown if production config is missing.
 *
 * @param vehicle - Vehicle to get cooldown for
 * @returns Effective cooldown in milliseconds
 */
export function getEffectiveWeaponCooldownMs(vehicle: BlockoutVehicleState): number {
  const config = getWeaponConfig(vehicle.weaponId);
  if (config && config.cooldown) {
    return getWeaponMLevelValue(config.cooldown, vehicle.modificationLevel);
  }
  // Fallback: use blockout profile cooldown
  const profile = getWeaponProfile(vehicle.weaponId);
  return profile?.blockoutCooldownMs ?? 1000;
}

/**
 * Check if a vehicle can fire using production M-level cooldown.
 *
 * CORE-STEP-08H+ FIXUP (Blocker 4): This replaces the old canFireBlockoutWeapon
 * for the target-lock auto-fire and AI paths. It uses the production weapon
 * config cooldown at the vehicle's modification level instead of the
 * blockout profile cooldown.
 *
 * @param vehicle - Vehicle to check
 * @param nowMs - Current scene time
 * @returns true if the weapon can fire
 */
export function canFireWithMLevelCooldown(
  vehicle: BlockoutVehicleState,
  nowMs: number,
): boolean {
  // Check runtime resource gates first
  if (!canFireByRuntimeState(vehicle.weaponRuntime)) return false;

  if (vehicle.lastFiredAt === 0) return true; // Never fired

  // Use production config cooldown at vehicle's modification level
  const config = getWeaponConfig(vehicle.weaponId);
  let effectiveCooldownMs: number;

  if (config && config.cooldown) {
    effectiveCooldownMs = getWeaponMLevelValue(config.cooldown, vehicle.modificationLevel);
  } else {
    // Fallback to blockout profile
    const profile = getWeaponProfile(vehicle.weaponId);
    effectiveCooldownMs = profile?.blockoutCooldownMs ?? 1000;
  }

  const elapsed = nowMs - vehicle.lastFiredAt;
  return elapsed >= effectiveCooldownMs;
}
