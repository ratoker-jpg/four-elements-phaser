/**
 * Body combat stats — runtime armor/damage reduction and M-level body stats.
 *
 * CORE-STEP-08H+: Integrates the accepted armor formula from armorFormula.ts
 * into the runtime damage path. Provides helpers for:
 * - Getting body stats at a specific M-level (HP, armor, speed, etc.)
 * - Computing armor-reduced damage using the accepted formula
 * - Mass-dependent recoil scaling
 *
 * This module bridges the production body config (bodyData.ts) with the
 * runtime damage path (blockoutDamage.ts).
 *
 * Architecture: state layer — no Phaser imports.
 */

import { getBodyConfig, getBodyMLevelValue } from '../config/bodyData';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';
import { clampModificationLevel } from '../config/m0m3Scaling';
import { calculateArmorReducedDamage, type ArmorFormulaResult } from '../config/armorFormula';

// ─── Body stats at M-level ────────────────────────────────────────────

/** Effective body stats at a given modification level. */
export interface EffectiveBodyStats {
  /** Hit points at this M-level. */
  hp: number;
  /** Armor flat reduction at this M-level. */
  armor: number;
  /** Minimum damage percent floor. */
  minDamagePercent: number;
  /** Maximum speed at this M-level. */
  maxSpeed: number;
  /** Acceleration at this M-level. */
  acceleration: number;
  /** Braking at this M-level. */
  braking: number;
  /** Body turn speed at this M-level. */
  bodyTurnSpeed: number;
  /** Fixed body mass (NOT M-leveled). */
  mass: number;
  /** Footprint class. */
  footprintClass: 'light' | 'medium' | 'heavy';
}

/**
 * Get effective body stats for a body at a given modification level.
 *
 * All values come from production body config. M0-M3 values follow
 * accepted mechanics decisions:
 * - HP, armor, speed, acceleration, braking, bodyTurnSpeed scale with M-level
 * - Mass does NOT change with M-level (hard rule)
 * - Footprint class does NOT change with M-level
 *
 * Falls back to default values if body config is not found.
 */
export function getEffectiveBodyStats(
  bodyId: string,
  mLevel: number = 0,
): EffectiveBodyStats {
  const config = getBodyConfig(bodyId);
  const clampedLevel = clampModificationLevel(mLevel);

  if (!config) {
    // Fallback defaults (Hunter-like baseline)
    return {
      hp: 210,
      armor: 5,
      minDamagePercent: 0.20,
      maxSpeed: 8.5,
      acceleration: 4.7,
      braking: 3.8,
      bodyTurnSpeed: 120,
      mass: 3000,
      footprintClass: 'medium',
    };
  }

  return {
    hp: getBodyMLevelValue(config.hp, clampedLevel),
    armor: getBodyMLevelValue(config.armor, clampedLevel),
    minDamagePercent: config.minDamagePercent,
    maxSpeed: getBodyMLevelValue(config.maxSpeed, clampedLevel),
    acceleration: getBodyMLevelValue(config.acceleration, clampedLevel),
    braking: getBodyMLevelValue(config.braking, clampedLevel),
    bodyTurnSpeed: getBodyMLevelValue(config.bodyTurnSpeed, clampedLevel),
    mass: config.mass,
    footprintClass: config.footprintClass,
  };
}

// ─── Armor damage reduction ───────────────────────────────────────────

/**
 * Apply armor-based damage reduction to incoming damage.
 *
 * Uses the accepted formula from MECHANICS_DECISIONS:
 *   finalDamage = max(rawDamage - armor, rawDamage * minDamagePercent)
 *
 * This replaces the old getIncomingDamageMultiplier approach which
 * applied a percentage-based reduction. The new approach uses flat
 * armor reduction with a minimum damage floor.
 *
 * @param bodyId - Body ID of the target
 * @param mLevel - Modification level of the target (0-3)
 * @param rawDamage - Incoming damage before armor
 * @returns Armor formula result with finalDamage, hitFloor, reduction
 */
export function applyArmorReduction(
  bodyId: string,
  mLevel: number,
  rawDamage: number,
): ArmorFormulaResult {
  const stats = getEffectiveBodyStats(bodyId, mLevel);
  return calculateArmorReducedDamage({
    rawDamage,
    armor: stats.armor,
    minDamagePercent: stats.minDamagePercent,
  });
}

// ─── Recoil scaling ───────────────────────────────────────────────────

/**
 * Compute visual recoil scale based on weapon recoil and body mass.
 *
 * Accepted formula: visual recoil = weaponRecoil / bodyMass
 * Light bodies (Wasp, 2200 kg) get more visual kick.
 * Heavy bodies (Mammoth, 5500 kg) get less visual kick.
 *
 * The scale is normalized so that a baseline (3000 kg) body = 1.0.
 * This keeps existing recoil profiles approximately correct for
 * medium bodies while scaling for light/heavy.
 *
 * @param bodyId - Body ID
 * @returns Recoil scale multiplier (higher = more visual recoil)
 */
export function getRecoilScale(bodyId: string): number {
  const config = getBodyConfig(bodyId);
  if (!config) return 1.0;

  // Normalize to 3000 kg baseline
  const BASELINE_MASS = 3000;
  return BASELINE_MASS / config.mass;
}

/**
 * Get turret turn speed for a weapon at a given M-level.
 *
 * Turret turn speed comes from the weapon config and scales with M0-M3.
 * This replaces the old blockoutTurretTurnSpeedDeg field.
 *
 * @param weaponId - Weapon ID
 * @param mLevel - Modification level (0-3)
 * @returns Turret turn speed in degrees per second
 */
export function getEffectiveTurretTurnSpeed(
  weaponId: string,
  mLevel: number = 0,
): number {
  const config = getWeaponConfig(weaponId);
  if (!config) return 120; // fallback default

  const clampedLevel = clampModificationLevel(mLevel);
  return getWeaponMLevelValue(config.turretTurnSpeed, clampedLevel);
}
