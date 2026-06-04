/**
 * Weapon runtime state — per-vehicle weapon resource tracking.
 *
 * CORE-STEP-08H+: Provides runtime state for weapon-specific resource models:
 * - Canister: capacity, drain/regen for stream weapons (flamethrower, freeze, isida)
 * - Overheat: heat buildup, cooling, spin-up for rapid-fire weapons (vulcan)
 * - Wind-up: charging before shot for precision weapons (railgun)
 * - Magazine: charge stock with regeneration (ricochet)
 * - Drum: volley counter with reload timer (hammer)
 *
 * These runtime states are per-vehicle instances — each vehicle has its own
 * independent resource state. They are NOT persisted in saves.
 *
 * All resource values are derived from production weapon config (weaponData.ts)
 * using the vehicle's current modification level (M0-M3).
 *
 * Architecture: state layer — no Phaser imports.
 */

import type { ModificationLevel } from '../config/coreMechanicsTypes';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';
import { clampModificationLevel } from '../config/m0m3Scaling';

// ─── Weapon runtime state interfaces ──────────────────────────────────

/** Canister runtime state — for canister_stream weapons (flamethrower, freeze, isida). */
export interface CanisterRuntimeState {
  /** Current canister level (0 to capacity). */
  current: number;
  /** Whether the canister is empty (cannot fire). */
  isEmpty: boolean;
}

/** Overheat runtime state — for overheat weapons (vulcan). */
export interface OverheatRuntimeState {
  /** Current heat level (0 to maxHeat). */
  heat: number;
  /** Whether the weapon is currently overheated (blocked from firing). */
  isOverheated: boolean;
  /** Timestamp when overheat penalty started (0 if not overheated). */
  overheatStartedAt: number;
  /** Whether spin-up phase is complete (weapon can fire at full rate). */
  isSpunUp: boolean;
  /** Timestamp when spin-up started (0 if not spinning up). */
  spinUpStartedAt: number;
}

/** Wind-up runtime state — for wind_up weapons (railgun). */
export interface WindUpRuntimeState {
  /** Whether wind-up is currently charging. */
  isCharging: boolean;
  /** Timestamp when wind-up started (0 if not charging). */
  startedAt: number;
  /** Whether wind-up is complete (weapon should fire). */
  isReady: boolean;
}

/** Magazine runtime state — for magazine weapons (ricochet). */
export interface MagazineRuntimeState {
  /** Current stock count (0 to stockSize). */
  currentStock: number;
  /** Whether the magazine is empty (cannot fire). */
  isEmpty: boolean;
}

/** Drum runtime state — for drum weapons (hammer). */
export interface DrumRuntimeState {
  /** Current volley index (0 to volleyCount-1). volleyCount = drum is empty, needs reload. */
  currentVolley: number;
  /** Whether the drum is currently reloading. */
  isReloading: boolean;
  /** Timestamp when reload started (0 if not reloading). */
  reloadStartedAt: number;
  /** Whether currently in burst-fire mode (firing multiple volleys). */
  isBursting: boolean;
  /** Timestamp when last volley in burst was fired (0 if not bursting). */
  lastVolleyAt: number;
  /** How many volleys have been fired in current burst. */
  burstVolleyCount: number;
}

/** Aggregate weapon runtime state — one per vehicle. */
export interface WeaponRuntimeState {
  /** Weapon ID this state is for. */
  weaponId: string;
  /** Modification level (M0-M3). */
  mLevel: ModificationLevel;
  /** Canister state (null for non-canister weapons). */
  canister: CanisterRuntimeState | null;
  /** Overheat state (null for non-overheat weapons). */
  overheat: OverheatRuntimeState | null;
  /** Wind-up state (null for non-wind-up weapons). */
  windUp: WindUpRuntimeState | null;
  /** Magazine state (null for non-magazine weapons). */
  magazine: MagazineRuntimeState | null;
  /** Drum state (null for non-drum weapons). */
  drum: DrumRuntimeState | null;
}

// ─── Factory ──────────────────────────────────────────────────────────

/**
 * Create initial weapon runtime state for a vehicle.
 * Uses production weapon config to determine which resource models are active.
 * All resources start at full/ready state.
 *
 * @param weaponId - Weapon ID (must be an accepted weapon)
 * @param mLevel - Modification level (0-3), default M0
 * @returns Initialized weapon runtime state
 */
export function createWeaponRuntimeState(
  weaponId: string,
  mLevel: number = 0,
): WeaponRuntimeState {
  const config = getWeaponConfig(weaponId);
  const clampedLevel = clampModificationLevel(mLevel);

  let canister: CanisterRuntimeState | null = null;
  let overheat: OverheatRuntimeState | null = null;
  let windUp: WindUpRuntimeState | null = null;
  let magazine: MagazineRuntimeState | null = null;
  let drum: DrumRuntimeState | null = null;

  if (config) {
    switch (config.fireType) {
      case 'canister_stream': {
        const capacity = getWeaponMLevelValue(config.canister!.capacity, clampedLevel);
        canister = { current: capacity, isEmpty: false };
        break;
      }
      case 'overheat': {
        overheat = {
          heat: 0,
          isOverheated: false,
          overheatStartedAt: 0,
          isSpunUp: false,
          spinUpStartedAt: 0,
        };
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
        drum = {
          currentVolley: 0,
          isReloading: false,
          reloadStartedAt: 0,
          isBursting: false,
          lastVolleyAt: 0,
          burstVolleyCount: 0,
        };
        break;
      }
      // cooldown, near_continuous: no special runtime state
    }
  }

  return {
    weaponId,
    mLevel: clampedLevel,
    canister,
    overheat,
    windUp,
    magazine,
    drum,
  };
}

// ─── Can fire check ───────────────────────────────────────────────────

/**
 * Check whether the weapon runtime state allows firing.
 *
 * This is the resource gate — separate from cooldown and aim checks.
 * A weapon cannot fire if:
 * - Canister is empty (canister_stream weapons)
 * - Overheated (overheat weapons)
 * - Wind-up is not ready (wind_up weapons that are still charging)
 * - Magazine is empty (magazine weapons)
 * - Drum is reloading (drum weapons)
 *
 * @param runtime - Weapon runtime state
 * @returns true if the weapon resource state allows firing
 */
export function canFireByRuntimeState(runtime: WeaponRuntimeState): boolean {
  // Canister gate
  if (runtime.canister && runtime.canister.isEmpty) return false;

  // Overheat gate
  if (runtime.overheat && runtime.overheat.isOverheated) return false;

  // Wind-up gate: can only fire when wind-up is complete (isReady = true)
  // If wind-up is not charging and not ready, that means we haven't started yet
  // (which is fine — the fire command will START the wind-up)
  if (runtime.windUp && runtime.windUp.isCharging && !runtime.windUp.isReady) return false;

  // Magazine gate
  if (runtime.magazine && runtime.magazine.isEmpty) return false;

  // Drum gate: cannot fire during reload
  if (runtime.drum && runtime.drum.isReloading) return false;

  return true;
}

// ─── Wind-up helpers ──────────────────────────────────────────────────

/**
 * Start wind-up charge for a weapon.
 * Only valid for wind_up fire type weapons.
 */
export function startWindUp(runtime: WeaponRuntimeState, nowMs: number): void {
  if (!runtime.windUp) return;
  runtime.windUp.isCharging = true;
  runtime.windUp.startedAt = nowMs;
  runtime.windUp.isReady = false;
}

/**
 * Cancel wind-up charge safely.
 * Called when target-lock is cleared (S key) or target becomes invalid.
 */
export function cancelWindUp(runtime: WeaponRuntimeState): void {
  if (!runtime.windUp) return;
  runtime.windUp.isCharging = false;
  runtime.windUp.startedAt = 0;
  runtime.windUp.isReady = false;
}

/**
 * Check if wind-up has completed and should fire.
 * Updates isReady based on elapsed time vs configured wind-up duration.
 *
 * @param runtime - Weapon runtime state
 * @param nowMs - Current scene time
 * @returns true if wind-up just completed and weapon should fire
 */
export function checkWindUpComplete(runtime: WeaponRuntimeState, nowMs: number): boolean {
  if (!runtime.windUp || !runtime.windUp.isCharging) return false;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.windUp) return false;

  const windUpDuration = getWeaponMLevelValue(config.windUp, runtime.mLevel);
  const elapsed = nowMs - runtime.windUp.startedAt;

  if (elapsed >= windUpDuration) {
    runtime.windUp.isReady = true;
    return true;
  }

  return false;
}

/**
 * Reset wind-up after firing.
 */
export function resetWindUpAfterFire(runtime: WeaponRuntimeState): void {
  if (!runtime.windUp) return;
  runtime.windUp.isCharging = false;
  runtime.windUp.startedAt = 0;
  runtime.windUp.isReady = false;
}

// ─── Drum helpers ─────────────────────────────────────────────────────

/**
 * Start drum burst firing.
 */
export function startDrumBurst(runtime: WeaponRuntimeState, nowMs: number): void {
  if (!runtime.drum) return;
  runtime.drum.isBursting = true;
  runtime.drum.lastVolleyAt = nowMs;
  runtime.drum.burstVolleyCount = 0;
}

/**
 * Check if next volley in burst can fire.
 * Returns true if the delay between volleys has elapsed.
 */
export function canDrumVolleyFire(runtime: WeaponRuntimeState, nowMs: number): boolean {
  if (!runtime.drum || !runtime.drum.isBursting) return false;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.drum) return false;

  const delay = getWeaponMLevelValue(config.drum.delayBetweenVolleysMs, runtime.mLevel);
  const elapsed = nowMs - runtime.drum.lastVolleyAt;

  if (elapsed >= delay) {
    runtime.drum.lastVolleyAt = nowMs;
    runtime.drum.burstVolleyCount++;
    return true;
  }

  return false;
}

/**
 * Record that a drum volley was fired.
 * Advances the volley counter. If all volleys are fired, starts reload.
 */
export function recordDrumVolleyFired(runtime: WeaponRuntimeState, nowMs: number): void {
  if (!runtime.drum) return;

  runtime.drum.currentVolley++;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.drum) return;

  // Check if drum is now empty
  if (runtime.drum.currentVolley >= config.drum.volleyCount) {
    // Drum is empty — start reload
    runtime.drum.isReloading = true;
    runtime.drum.reloadStartedAt = nowMs;
    runtime.drum.isBursting = false;
    runtime.drum.burstVolleyCount = 0;
  }
}

/**
 * Check if drum reload has completed.
 * Updates state if reload is done.
 */
export function checkDrumReloadComplete(runtime: WeaponRuntimeState, nowMs: number): boolean {
  if (!runtime.drum || !runtime.drum.isReloading) return false;

  const config = getWeaponConfig(runtime.weaponId);
  if (!config || !config.drum) return false;

  const reloadMs = getWeaponMLevelValue(config.drum.reloadMs, runtime.mLevel);
  const elapsed = nowMs - runtime.drum.reloadStartedAt;

  if (elapsed >= reloadMs) {
    runtime.drum.isReloading = false;
    runtime.drum.reloadStartedAt = 0;
    runtime.drum.currentVolley = 0;
    return true;
  }

  return false;
}

/**
 * Cancel drum burst safely (e.g., S key / target-lock clear).
 */
export function cancelDrumBurst(runtime: WeaponRuntimeState): void {
  if (!runtime.drum) return;
  runtime.drum.isBursting = false;
  runtime.drum.burstVolleyCount = 0;
  // Note: we do NOT cancel an active reload — the drum is empty and must reload
}
