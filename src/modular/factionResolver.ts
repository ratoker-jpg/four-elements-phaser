/**
 * factionResolver — VEHICLE-RENDER-UNIFY-01-VH Package C.
 *
 * Canonical faction resolution for the live modular render path.
 *
 * Contract:
 *   - Valid factions (cyan / green / yellow / purple) pass through unchanged.
 *   - Missing/invalid faction is NOT silently recolored to cyan.
 *   - First time a missing/invalid faction is seen for a given context,
 *     a warning is logged with enough context to find the offending caller.
 *   - Cyan is returned ONLY as an explicit last-resort diagnostic fallback,
 *     so the live render path never crashes on a missing faction. The
 *     fallback is marked in the returned descriptor so callers/tests can
 *     distinguish "real cyan" from "diagnostic cyan".
 *
 * This module is engine-agnostic (no Phaser) and unit-testable.
 */

import type { Faction } from '../state/types';

/** All accepted factions, in canonical order. */
export const CANONICAL_FACTIONS: readonly Faction[] = ['cyan', 'green', 'yellow', 'purple'];

/** Set of accepted faction ids for O(1) membership check. */
const CANONICAL_FACTION_SET: ReadonlySet<string> = new Set(CANONICAL_FACTIONS);

/** True if the value is one of the four canonical factions. */
export function isCanonicalFaction(value: unknown): value is Faction {
  return typeof value === 'string' && CANONICAL_FACTION_SET.has(value);
}

// ─── Diagnostic warn-once ledger ───────────────────────────────────

/**
 * Map of context → count of times the missing/invalid faction warning
 * has been emitted for that context. The first occurrence logs a warning;
 * subsequent occurrences are silent (per "warn once with enough context"
 * requirement). The count is still tracked for diagnostics.
 *
 * The key is the `context` string passed by the caller (e.g.
 * 'ModularVehicleLiveAdapter.placeModularCombat' or
 * 'ModularTankRenderer.place'). This groups warnings by call site.
 */
const factionWarningCounts = new Map<string, number>();

/**
 * Result of resolving a faction. Always returned; never throws.
 */
export interface FactionResolution {
  /** The resolved faction. Always a canonical Faction. */
  faction: Faction;
  /**
   * True when the input was a valid canonical faction.
   * False when the input was missing/invalid and the diagnostic
   * cyan fallback was used.
   */
  isValid: boolean;
  /**
   * True when the diagnostic cyan fallback was used.
   * (Always equals `!isValid`.)
   */
  usedFallback: boolean;
  /** The original input value (for diagnostics). */
  originalValue: unknown;
}

/**
 * Reset the warning ledger. Test/teardown helper.
 */
export function resetFactionWarningLedger(): void {
  factionWarningCounts.clear();
}

/**
 * Get a snapshot of warning counts per context (for tests/diagnostics).
 */
export function getFactionWarningCounts(): ReadonlyMap<string, number> {
  return new Map(factionWarningCounts);
}

/**
 * Resolve a faction value to a canonical Faction.
 *
 * Behavior:
 *   - If `value` is a canonical faction, returns `{ faction: value, isValid: true, ... }`.
 *   - If `value` is missing/invalid, logs a warning (first time for this
 *     context only) and returns `{ faction: 'cyan', isValid: false,
 *     usedFallback: true, ... }`.
 *
 * The cyan fallback is explicit and diagnostic — callers and tests can
 * detect it via `usedFallback === true`. It is NOT a silent recolor.
 *
 * @param value - The faction value to resolve (may be undefined / unknown string).
 * @param context - A stable string identifying the call site (e.g. file.function).
 *                  Used to group warnings so each call site warns once.
 * @returns FactionResolution — always a canonical Faction.
 */
export function resolveFactionOrDiagnosticFallback(
  value: unknown,
  context: string,
): FactionResolution {
  if (isCanonicalFaction(value)) {
    return {
      faction: value,
      isValid: true,
      usedFallback: false,
      originalValue: value,
    };
  }

  // Missing/invalid — warn once per context, then fall back to cyan
  // as an explicit diagnostic (not a silent recolor).
  const count = factionWarningCounts.get(context) ?? 0;
  factionWarningCounts.set(context, count + 1);

  if (count === 0) {
    // First occurrence for this context — log with enough info to find the bug
    const valueDesc =
      value === undefined ? 'undefined' :
      value === null ? 'null' :
      typeof value === 'string' ? `"${value}"` :
      String(value);

    // eslint-disable-next-line no-console
    console.warn(
      `[factionResolver] Missing or invalid faction at ${context}: ` +
      `${valueDesc}. Using diagnostic cyan fallback. ` +
      `This indicates upstream state failed to set a valid faction. ` +
      `Subsequent occurrences for this context will be silent.`,
    );
  }

  return {
    faction: 'cyan',
    isValid: false,
    usedFallback: true,
    originalValue: value,
  };
}
