/**
 * Weapon resource update logic — per-frame resource tick.
 *
 * CORE-STEP-08H+: Provides frame-by-frame updates for weapon resource models:
 * - Canister: drain while firing, regen while not firing
 * - Overheat: heat per shot, cooling per second, overheat penalty, spin-up
 * - Wind-up: charging timer
 * - Magazine: stock regeneration over time
 * - Drum: reload timer
 *
 * Called each frame from the game update loop with delta time.
 * All state changes are deterministic and testable.
 *
 * Architecture: state layer — no Phaser imports.
 */

import type { WeaponRuntimeState } from './weaponRuntime';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';
import { clampModificationLevel } from '../config/m0m3Scaling';

// ─── Update options ───────────────────────────────────────────────────

/** Options for weapon resource update. */
export interface WeaponResourceUpdateOptions {
  /** Current scene time in milliseconds. */
  nowMs: number;
  /** Whether the weapon is currently firing (fireHeld/isFiring). */
  isFiring: boolean;
  /** Frame delta time in seconds. */
  deltaSec: number;
}

// ─── Canister update ──────────────────────────────────────────────────

/**
 * Update canister resource state.
 *
 * - While firing: drain canister by drainPerSec * deltaSec
 * - While not firing: regenerate canister by regenPerSec * deltaSec
 * - If canister reaches 0: set isEmpty flag, stop firing capability
 * - If canister regenerates above 0: clear isEmpty flag
 */
export function updateCanister(
  runtime: WeaponRuntimeState,
  options: WeaponResourceUpdateOptions,
): void {
  if (!runtime.canister) return;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.canister) return;

  const capacity = getWeaponMLevelValue(config.canister.capacity, runtime.mLevel);
  const drainPerSec = getWeaponMLevelValue(config.canister.drainPerSec, runtime.mLevel);
  const regenPerSec = getWeaponMLevelValue(config.canister.regenPerSec, runtime.mLevel);

  if (options.isFiring) {
    // Drain canister
    runtime.canister.current = Math.max(0, runtime.canister.current - drainPerSec * options.deltaSec);
    if (runtime.canister.current <= 0) {
      runtime.canister.isEmpty = true;
      runtime.canister.current = 0;
    }
  } else {
    // Regenerate canister
    runtime.canister.current = Math.min(capacity, runtime.canister.current + regenPerSec * options.deltaSec);
    if (runtime.canister.current > 0) {
      runtime.canister.isEmpty = false;
    }
  }
}

// ─── Overheat update ──────────────────────────────────────────────────

/**
 * Update overheat resource state.
 *
 * - While firing: add heatPerShot per shot (called separately in recordOverheatShot)
 * - While not firing: cool down by coolingPerSec * deltaSec
 * - If heat reaches maxHeat: trigger overheat penalty
 * - If overheated: wait for overheatPenaltyMs, then reset heat to 0
 * - Spin-up: requires spinUpMs before weapon reaches full fire rate
 */
export function updateOverheat(
  runtime: WeaponRuntimeState,
  options: WeaponResourceUpdateOptions,
): void {
  if (!runtime.overheat) return;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.overheat) return;

  const maxHeat = config.overheat.maxHeat;
  const coolingPerSec = getWeaponMLevelValue(config.overheat.coolingPerSec, runtime.mLevel);

  // Handle spin-up
  if (!runtime.overheat.isSpunUp && !runtime.overheat.isOverheated) {
    if (options.isFiring) {
      // If spin-up hasn't started, start it
      if (runtime.overheat.spinUpStartedAt === 0) {
        runtime.overheat.spinUpStartedAt = options.nowMs;
      }
      // Check if spin-up is complete
      const spinUpElapsed = options.nowMs - runtime.overheat.spinUpStartedAt;
      if (spinUpElapsed >= config.overheat.spinUpMs) {
        runtime.overheat.isSpunUp = true;
      }
    } else {
      // Not firing — reset spin-up
      runtime.overheat.isSpunUp = false;
      runtime.overheat.spinUpStartedAt = 0;
    }
  }

  // Handle overheat penalty
  if (runtime.overheat.isOverheated) {
    const penaltyElapsed = options.nowMs - runtime.overheat.overheatStartedAt;
    if (penaltyElapsed >= config.overheat.overheatPenaltyMs) {
      // Penalty over — reset heat and clear overheat
      runtime.overheat.heat = 0;
      runtime.overheat.isOverheated = false;
      runtime.overheat.overheatStartedAt = 0;
      runtime.overheat.isSpunUp = false;
      runtime.overheat.spinUpStartedAt = 0;
    }
    return; // No cooling during penalty
  }

  // Cooling when not firing
  if (!options.isFiring) {
    runtime.overheat.heat = Math.max(0, runtime.overheat.heat - coolingPerSec * options.deltaSec);
    // Also reset spin-up when not firing (spin-up requires sustained fire)
    runtime.overheat.isSpunUp = false;
    runtime.overheat.spinUpStartedAt = 0;
  }

  // Clamp heat to maxHeat (safety)
  runtime.overheat.heat = Math.min(maxHeat, runtime.overheat.heat);
}

/**
 * Record that a shot was fired — add heat for overheat weapons.
 * Called once per shot for overheat weapons.
 */
export function recordOverheatShot(runtime: WeaponRuntimeState): void {
  if (!runtime.overheat) return;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.overheat) return;

  const heatPerShot = getWeaponMLevelValue(config.overheat.heatPerShot, runtime.mLevel);
  const maxHeat = config.overheat.maxHeat;
  runtime.overheat.heat = Math.min(maxHeat, runtime.overheat.heat + heatPerShot);

  // Check if overheat triggered
  if (runtime.overheat.heat >= maxHeat) {
    runtime.overheat.isOverheated = true;
    runtime.overheat.overheatStartedAt = Date.now(); // Will be overridden by next updateOverheat call
    runtime.overheat.isSpunUp = false;
    runtime.overheat.spinUpStartedAt = 0;
  }
}

// ─── Magazine update ──────────────────────────────────────────────────

/**
 * Update magazine resource state.
 *
 * - While not firing: regenerate stock by regenPerSec * deltaSec
 * - Stock cannot exceed stockSize
 * - If stock reaches 0: set isEmpty flag
 * - If stock regenerates above 0: clear isEmpty flag
 */
export function updateMagazine(
  runtime: WeaponRuntimeState,
  options: WeaponResourceUpdateOptions,
): void {
  if (!runtime.magazine) return;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.magazine) return;

  const stockSize = getWeaponMLevelValue(config.magazine.stockSize, runtime.mLevel);
  const regenPerSec = getWeaponMLevelValue(config.magazine.regenPerSec, runtime.mLevel);

  if (!options.isFiring) {
    // Regenerate stock
    runtime.magazine.currentStock = Math.min(
      stockSize,
      runtime.magazine.currentStock + regenPerSec * options.deltaSec,
    );
  }

  // Update isEmpty flag
  runtime.magazine.isEmpty = runtime.magazine.currentStock < 1;
}

/**
 * Record that a magazine shot was fired — decrement stock.
 */
export function recordMagazineShot(runtime: WeaponRuntimeState): void {
  if (!runtime.magazine) return;

  runtime.magazine.currentStock = Math.max(0, runtime.magazine.currentStock - 1);
  runtime.magazine.isEmpty = runtime.magazine.currentStock < 1;
}

// ─── Master update ────────────────────────────────────────────────────

/**
 * Update all weapon resource states for a vehicle.
 * Call this each frame for each vehicle with a weapon.
 *
 * @param runtime - Weapon runtime state (mutated in place)
 * @param options - Update options
 */
export function updateWeaponResources(
  runtime: WeaponRuntimeState,
  options: WeaponResourceUpdateOptions,
): void {
  updateCanister(runtime, options);
  updateOverheat(runtime, options);
  updateMagazine(runtime, options);
  // Wind-up and drum are event-driven (not time-based), handled by their helpers
}

// ─── Reset helpers ────────────────────────────────────────────────────

/**
 * Reset weapon runtime state for a new vehicle or scenario reset.
 */
export function resetWeaponRuntimeState(runtime: WeaponRuntimeState): void {
  const fresh = createFreshRuntimeForType(runtime.weaponId, runtime.mLevel);
  Object.assign(runtime, fresh);
}

/** Internal: create fresh runtime for reset. */
function createFreshRuntimeForType(weaponId: string, mLevel: number): WeaponRuntimeState {
  const clampedLevel = clampModificationLevel(mLevel);
  const config = getWeaponConfig(weaponId);

  let canister: import('./weaponRuntime').CanisterRuntimeState | null = null;
  let overheat: import('./weaponRuntime').OverheatRuntimeState | null = null;
  let windUp: import('./weaponRuntime').WindUpRuntimeState | null = null;
  let magazine: import('./weaponRuntime').MagazineRuntimeState | null = null;
  let drum: import('./weaponRuntime').DrumRuntimeState | null = null;

  if (config) {
    switch (config.fireType) {
      case 'canister_stream': {
        const capacity = getWeaponMLevelValue(config.canister!.capacity, clampedLevel);
        canister = { current: capacity, isEmpty: false };
        break;
      }
      case 'overheat': {
        overheat = { heat: 0, isOverheated: false, overheatStartedAt: 0, isSpunUp: false, spinUpStartedAt: 0 };
        break;
      }
      case 'wind_up': {
        windUp = { isCharging: false, startedAt: 0, isReady: false };
        break;
      }
      case 'magazine': {
        const stockSize = getWeaponMLevelValue(config.magazine!.stockSize, clampedLevel);
        magazine = { currentStock: stockSize, isEmpty: false };
        break;
      }
      case 'drum': {
        drum = { currentVolley: 0, isReloading: false, reloadStartedAt: 0, isBursting: false, lastVolleyAt: 0, burstVolleyCount: 0 };
        break;
      }
    }
  }

  return { weaponId, mLevel: clampedLevel, canister, overheat, windUp, magazine, drum };
}

/**
 * Clear all pending weapon states when target-lock is cleared (S key).
 * - Cancels wind-up charge
 * - Cancels drum burst (but keeps reload if drum is empty)
 * - Does NOT reset canister/overheat/magazine — those are passive resources
 */
export function clearWeaponPendingStates(runtime: WeaponRuntimeState): void {
  if (runtime.windUp) {
    runtime.windUp.isCharging = false;
    runtime.windUp.startedAt = 0;
    runtime.windUp.isReady = false;
  }
  if (runtime.drum) {
    runtime.drum.isBursting = false;
    runtime.drum.burstVolleyCount = 0;
    // Do NOT cancel reload — drum is empty, must reload
  }
}
