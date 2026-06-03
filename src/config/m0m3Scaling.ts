/**
 * Shared M0-M3 scaling helpers — common utilities for modification-level data.
 *
 * CORE-STEP-02C: Provides reusable helpers for accessing and validating
 * MLevelData<T> tuples used across weapon, body, and future config models.
 *
 * Existing per-config helpers (getWeaponMLevelValue, getBodyMLevelValue)
 * remain unchanged. New code should prefer this shared module.
 * Delegating the existing helpers to this shared module is deferred to
 * a later cleanup step to avoid a broad refactor.
 *
 * Design rules:
 * - MLevelData<T> is a fixed-length readonly tuple [M0, M1, M2, M3]
 * - M0 = base, M1-M3 = upgrades
 * - Damage/heal/turretTurnSpeed must not decrease M0→M3
 * - Cooldown/windUp/drain/reload must not increase M0→M3 (improvement = shorter)
 * - Mass and footprintClass are NOT M-leveled
 */

import type { MLevelData, ModificationLevel } from './coreMechanicsTypes';
import { MODIFICATION_LEVEL_COUNT } from './coreMechanicsTypes';

// ─── Safe getter ─────────────────────────────────────────────────────

/**
 * Get a value from an MLevelData tuple at the specified modification level.
 * Clamps the level to [0, 3] before indexing.
 *
 * This is the shared version of getWeaponMLevelValue / getBodyMLevelValue.
 */
export function getMLevelValue<T>(data: MLevelData<T>, level: number): T {
  const clamped = clampModificationLevel(level);
  return data[clamped];
}

// ─── Level helpers ───────────────────────────────────────────────────

/**
 * Clamp a modification level to the valid range [0, 3].
 * Returns a valid ModificationLevel.
 */
export function clampModificationLevel(level: number): ModificationLevel {
  return Math.min(Math.max(0, Math.floor(level)), 3) as ModificationLevel;
}

/**
 * Check if a value is a valid ModificationLevel (0, 1, 2, or 3).
 */
export function isValidModificationLevel(level: number): level is ModificationLevel {
  return Number.isInteger(level) && level >= 0 && level <= 3;
}

// ─── Validation helpers ──────────────────────────────────────────────

/**
 * Check if MLevelData values are monotonically non-decreasing (M0 <= M1 <= M2 <= M3).
 * Used for damage, heal rate, turretTurnSpeed, hp, armor, speed, etc.
 * where M0→M3 means "more" or "better".
 */
export function isNonDecreasingMLevelData(data: MLevelData<number>): boolean {
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] > data[i + 1]) return false;
  }
  return true;
}

/**
 * Check if MLevelData values are monotonically non-increasing (M0 >= M1 >= M2 >= M3).
 * Used for cooldown, windUp, drain, reload, heatPerShot, etc.
 * where M0→M3 means "less" or "improvement = shorter".
 */
export function isNonIncreasingMLevelData(data: MLevelData<number>): boolean {
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] < data[i + 1]) return false;
  }
  return true;
}

/**
 * Check if a value has exactly 4 entries (M0-M3).
 * Useful for runtime validation of unknown data.
 */
export function hasFourMLevels<T>(data: unknown): data is MLevelData<T> {
  return Array.isArray(data) && data.length === MODIFICATION_LEVEL_COUNT;
}

/**
 * Check if a value is a valid MLevelData<number> — an array of exactly 4 numbers.
 */
export function isMLevelData(data: unknown): data is MLevelData<number> {
  if (!Array.isArray(data)) return false;
  if (data.length !== MODIFICATION_LEVEL_COUNT) return false;
  return data.every(v => typeof v === 'number' && !Number.isNaN(v));
}
