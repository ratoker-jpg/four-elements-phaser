/**
 * Pure armor formula helper — accepted damage reduction calculation.
 *
 * CORE-STEP-02C: Provides a pure function implementing the accepted armor
 * formula from MECHANICS_DECISIONS:
 *
 *   finalDamage = max(rawDamage - armor, rawDamage * minDamagePercent)
 *
 * This is a config/helper module only. It does NOT wire into runtime combat.
 * Runtime integration will happen in a later step.
 *
 * Rules:
 * - rawDamage must be non-negative (clamped to 0 if negative)
 * - armor must be non-negative (clamped to 0 if negative)
 * - minDamagePercent must be between 0 and 1 (clamped if out of range)
 * - result is never negative
 * - result is never below rawDamage * minDamagePercent (the floor)
 * - result may equal rawDamage if armor is 0
 * - Armor reduces small frequent hits (Vulcan vs Mammoth)
 * - Big hits remain useful against heavy armor (Railgun vs Titan)
 * - No weapon deals 0 damage forever
 */

/** Input parameters for the armor formula. */
export interface ArmorFormulaInput {
  /** Raw damage before armor reduction. Must be >= 0. */
  rawDamage: number;
  /** Flat armor reduction. Must be >= 0. */
  armor: number;
  /**
   * Minimum damage percent floor (0 to 1).
   * Armor formula: max(rawDamage - armor, rawDamage * minDamagePercent)
   * Ensures no weapon deals 0 damage forever.
   * Light bodies: higher floor (less protection).
   * Heavy bodies: lower floor (more protection but still vulnerable).
   */
  minDamagePercent: number;
}

/** Output of the armor formula calculation. */
export interface ArmorFormulaResult {
  /** Final damage after armor reduction and floor applied. */
  finalDamage: number;
  /** Whether the floor (minDamagePercent) was the binding constraint. */
  hitFloor: boolean;
  /** Effective armor reduction applied (rawDamage - finalDamage). */
  reduction: number;
}

/**
 * Calculate armor-reduced damage using the accepted formula.
 *
 * Formula: finalDamage = max(rawDamage - armor, rawDamage * minDamagePercent)
 *
 * Invalid inputs are clamped rather than throwing:
 * - non-finite or negative rawDamage → clamped to 0
 * - non-finite or negative armor → clamped to 0
 * - non-finite minDamagePercent → clamped to 0
 * - minDamagePercent < 0 → clamped to 0
 * - minDamagePercent > 1 → clamped to 1
 *
 * This clamping approach ensures the function never throws and always
 * returns a sensible (non-NaN) result, which is important for game
 * runtime stability.
 */
export function calculateArmorReducedDamage(input: ArmorFormulaInput): ArmorFormulaResult {
  const rawDamage = Number.isFinite(input.rawDamage) && input.rawDamage >= 0 ? input.rawDamage : 0;
  const armor = Number.isFinite(input.armor) && input.armor >= 0 ? input.armor : 0;
  const minDamagePercent = Number.isFinite(input.minDamagePercent)
    ? Math.min(1, Math.max(0, input.minDamagePercent))
    : 0;

  const afterFlatReduction = rawDamage - armor;
  const floor = rawDamage * minDamagePercent;
  const finalDamage = Math.max(afterFlatReduction, floor);
  const hitFloor = afterFlatReduction < floor;
  const reduction = rawDamage - finalDamage;

  return {
    finalDamage,
    hitFloor,
    reduction,
  };
}
