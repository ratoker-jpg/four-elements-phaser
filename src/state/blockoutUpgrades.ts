/**
 * Blockout upgrade system — pure TypeScript, no Phaser dependencies.
 *
 * BLOCKOUT-09H: Dev/arena-only upgrade skeleton and visual indicators.
 *
 * This module provides:
 * - Upgrade state management (apply, level, max-level enforcement)
 * - Effective profile computation (movement, damage, VFX)
 * - Incoming damage multiplier computation (armor)
 * - Cooldown/cadence multiplier computation (cooling)
 *
 * All state is transient and NOT persisted in saves.
 * All timing uses passed-in nowMs (Phaser scene time), NEVER Date.now().
 * Base config objects are NEVER mutated — effective profiles are computed fresh.
 */

import type { BlockoutUpgradeId } from '../config/blockoutUpgradeData';
import { UPGRADE_PROFILES, getUpgradeProfile } from '../config/blockoutUpgradeData';
import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { MovementProfile } from '../config/blockoutProfiles';
import type { DamageProfile } from '../config/blockoutProfiles';
import { getBlockoutBodyMaxHp } from '../config/blockoutBodyData';

// ─── Upgrade state on vehicle ────────────────────────────────────────

/** Upgrade levels for a blockout vehicle. Keyed by upgrade ID. */
export type UpgradeLevels = Partial<Record<BlockoutUpgradeId, number>>;

// ─── Apply upgrade ───────────────────────────────────────────────────

/**
 * Apply an upgrade to a blockout vehicle.
 * Increments the level by 1 if not at max. No-op if at max or destroyed.
 *
 * @param vehicle - Vehicle state (mutated in place)
 * @param upgradeId - Which upgrade to apply
 * @param nowMs - Current scene time (for lastUpgradedAt)
 * @returns true if upgrade was applied, false if no-op
 */
export function applyUpgrade(
  vehicle: BlockoutVehicleState,
  upgradeId: BlockoutUpgradeId,
  nowMs: number,
): boolean {
  // Destroyed vehicles cannot be upgraded
  if (vehicle.isDestroyed) return false;

  const profile = getUpgradeProfile(upgradeId);
  if (!profile) return false;

  const currentLevel = vehicle.upgradeLevels[upgradeId] ?? 0;
  if (currentLevel >= profile.maxLevel) return false;

  // Increment level
  vehicle.upgradeLevels[upgradeId] = currentLevel + 1;
  vehicle.lastUpgradedAt = nowMs;

  // If this is armor_plating, increase maxHp and current HP proportionally
  if (upgradeId === 'armor_plating') {
    const baseMaxHp = vehicle.maxHp;
    // Compute the new maxHp with all armor levels applied
    const newMaxHp = getEffectiveMaxHp(vehicle);
    const hpDelta = newMaxHp - baseMaxHp;
    // Increase current HP by the same delta (proportional increase)
    vehicle.hp = Math.min(vehicle.hp + hpDelta, newMaxHp);
    vehicle.maxHp = newMaxHp;
  }

  return true;
}

/**
 * Get the current level of an upgrade on a vehicle.
 */
export function getUpgradeLevel(vehicle: BlockoutVehicleState, upgradeId: BlockoutUpgradeId): number {
  return vehicle.upgradeLevels?.[upgradeId] ?? 0;
}

/**
 * Check if a vehicle has any upgrades applied.
 */
export function hasAnyUpgrades(vehicle: BlockoutVehicleState): boolean {
  return vehicle.upgradeLevels != null && Object.keys(vehicle.upgradeLevels).length > 0;
}

// ─── Effective movement profile ──────────────────────────────────────

/**
 * Compute the effective movement profile for a vehicle with upgrades.
 * Does NOT mutate the base profile — returns a new object.
 *
 * Mobility boost affects: maxSpeedPxPerSec, accelerationPxPerSec2, turnSpeedDeg
 */
export function getEffectiveMovementProfile(
  vehicle: BlockoutVehicleState,
  baseProfile: MovementProfile,
): MovementProfile {
  const mobilityLevel = vehicle.upgradeLevels.mobility_boost ?? 0;
  if (mobilityLevel === 0) return baseProfile;

  const mobilityProfile = UPGRADE_PROFILES.mobility_boost;
  let maxSpeedMultiplier = 1;
  let accelMultiplier = 1;
  let turnSpeedMultiplier = 1;

  for (const effect of mobilityProfile.affectedStats) {
    if (effect.stat === 'maxSpeedPxPerSec') {
      maxSpeedMultiplier = Math.pow(effect.multiplierPerLevel, mobilityLevel);
    } else if (effect.stat === 'accelerationPxPerSec2') {
      accelMultiplier = Math.pow(effect.multiplierPerLevel, mobilityLevel);
    } else if (effect.stat === 'turnSpeedDeg') {
      turnSpeedMultiplier = Math.pow(effect.multiplierPerLevel, mobilityLevel);
    }
  }

  return {
    ...baseProfile,
    maxSpeedPxPerSec: baseProfile.maxSpeedPxPerSec * maxSpeedMultiplier,
    accelerationPxPerSec2: baseProfile.accelerationPxPerSec2 * accelMultiplier,
    turnSpeedDeg: baseProfile.turnSpeedDeg * turnSpeedMultiplier,
  };
}

// ─── Effective damage profile ────────────────────────────────────────

/**
 * Compute the effective damage profile for a firing vehicle with upgrades.
 * Does NOT mutate the base profile — returns a new object.
 *
 * Weapon tuning affects: directDamage, damagePerSecond
 * Range extender affects: rangePx
 */
export function getEffectiveDamageProfile(
  vehicle: BlockoutVehicleState,
  baseProfile: DamageProfile,
): DamageProfile {
  const weaponLevel = vehicle.upgradeLevels.weapon_tuning ?? 0;
  const rangeLevel = vehicle.upgradeLevels.range_extender ?? 0;

  if (weaponLevel === 0 && rangeLevel === 0) return baseProfile;

  const result = { ...baseProfile };

  if (weaponLevel > 0) {
    const weaponProfileData = UPGRADE_PROFILES.weapon_tuning;
    for (const effect of weaponProfileData.affectedStats) {
      const multiplier = Math.pow(effect.multiplierPerLevel, weaponLevel);
      if (effect.stat === 'directDamage' && result.directDamage !== undefined) {
        result.directDamage = result.directDamage * multiplier;
      }
      if (effect.stat === 'damagePerSecond' && result.damagePerSecond !== undefined) {
        result.damagePerSecond = result.damagePerSecond * multiplier;
      }
    }
  }

  if (rangeLevel > 0) {
    const rangeProfileData = UPGRADE_PROFILES.range_extender;
    for (const effect of rangeProfileData.affectedStats) {
      if (effect.stat === 'rangePx') {
        const multiplier = Math.pow(effect.multiplierPerLevel, rangeLevel);
        if (result.rangePx !== undefined) {
          result.rangePx = result.rangePx * multiplier;
        }
        if (result.range !== undefined) {
          result.range = result.range * multiplier;
        }
      }
    }
  }

  return result;
}

// ─── Incoming damage multiplier (armor) ──────────────────────────────

/**
 * Compute the incoming damage multiplier for a target vehicle.
 * Armor plating reduces incoming damage by 5% per level.
 *
 * @returns Multiplier to apply to incoming damage (e.g., 0.95 = 5% reduction)
 */
export function getIncomingDamageMultiplier(vehicle: BlockoutVehicleState): number {
  const armorLevel = vehicle.upgradeLevels.armor_plating ?? 0;
  if (armorLevel === 0) return 1;

  const armorProfile = UPGRADE_PROFILES.armor_plating;
  let multiplier = 1;
  for (const effect of armorProfile.affectedStats) {
    if (effect.stat === 'incomingDamageMultiplier') {
      multiplier = Math.pow(effect.multiplierPerLevel, armorLevel);
    }
  }
  return multiplier;
}

// ─── Effective max HP (armor) ────────────────────────────────────────

/**
 * Compute the effective max HP for a vehicle with armor upgrades.
 * Armor plating increases maxHp by 15% per level.
 */
export function getEffectiveMaxHp(vehicle: BlockoutVehicleState): number {
  const baseMaxHp = getBlockoutBodyMaxHp(vehicle.bodyId);

  const armorLevel = vehicle.upgradeLevels.armor_plating ?? 0;
  if (armorLevel === 0) return baseMaxHp;

  const armorProfile = UPGRADE_PROFILES.armor_plating;
  let hpMultiplier = 1;
  for (const effect of armorProfile.affectedStats) {
    if (effect.stat === 'maxHp') {
      hpMultiplier = Math.pow(effect.multiplierPerLevel, armorLevel);
    }
  }
  return Math.round(baseMaxHp * hpMultiplier);
}

// ─── Cooldown multiplier (weapon tuning + cooling) ───────────────────

/**
 * Compute the cooldown multiplier for a vehicle's weapon.
 * Weapon tuning reduces cooldown by 5% per level.
 * Cooling system reduces continuous tick cadence by 10% per level.
 *
 * @returns Multiplier to apply to cooldown/cadence (e.g., 0.95 = 5% faster)
 */
export function getCooldownMultiplier(vehicle: BlockoutVehicleState): number {
  const weaponLevel = vehicle.upgradeLevels.weapon_tuning ?? 0;
  const coolingLevel = vehicle.upgradeLevels.cooling_system ?? 0;

  let multiplier = 1;

  if (weaponLevel > 0) {
    const weaponProfileData = UPGRADE_PROFILES.weapon_tuning;
    for (const effect of weaponProfileData.affectedStats) {
      if (effect.stat === 'cooldownMultiplier') {
        multiplier *= Math.pow(effect.multiplierPerLevel, weaponLevel);
      }
    }
  }

  if (coolingLevel > 0) {
    const coolingProfileData = UPGRADE_PROFILES.cooling_system;
    for (const effect of coolingProfileData.affectedStats) {
      if (effect.stat === 'streamCadenceMultiplier') {
        multiplier *= Math.pow(effect.multiplierPerLevel, coolingLevel);
      }
    }
  }

  return multiplier;
}

// ─── Range multiplier (range extender) ───────────────────────────────

/**
 * Compute the range multiplier for a vehicle's weapon.
 * Range extender increases range by 10% per level.
 */
export function getRangeMultiplier(vehicle: BlockoutVehicleState): number {
  const rangeLevel = vehicle.upgradeLevels.range_extender ?? 0;
  if (rangeLevel === 0) return 1;

  const rangeProfileData = UPGRADE_PROFILES.range_extender;
  for (const effect of rangeProfileData.affectedStats) {
    if (effect.stat === 'rangePx') {
      return Math.pow(effect.multiplierPerLevel, rangeLevel);
    }
  }
  return 1;
}

// ─── VFX range multiplier (for rendering) ────────────────────────────

/**
 * Compute the VFX range multiplier for rendering.
 * Same as getRangeMultiplier — used by VFX renderer to extend aim line / range circle.
 */
export function getVfxRangeMultiplier(vehicle: BlockoutVehicleState): number {
  return getRangeMultiplier(vehicle);
}
