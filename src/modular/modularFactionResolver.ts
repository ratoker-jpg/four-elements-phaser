/**
 * modularFactionResolver — MODULAR-RUNTIME-04B faction safety net.
 *
 * The live modular render path must use the entity's real faction so all four
 * factions (cyan / green / yellow / purple) load the correct PNG asset set.
 * Faction is populated end-to-end (createInitialState → RenderableEntity, and
 * blockoutScenario → BlockoutVehicleState), so a missing faction is an
 * unexpected data error, NOT normal behaviour.
 *
 * Previously the adapter silently substituted `'cyan'` for a missing faction,
 * which masked the bug and made only cyan reliably render. This resolver keeps
 * a last-resort fallback (so nothing crashes / disappears) but emits a one-shot
 * diagnostic so the missing-faction case is visible instead of hidden.
 */

import type { Faction } from '../state/types';

export const MODULAR_FACTIONS: readonly Faction[] = ['cyan', 'green', 'yellow', 'purple'];

/** Last-resort fallback faction (only used when data is missing/invalid). */
export const FALLBACK_MODULAR_FACTION: Faction = 'cyan';

let warnedMissing = false;

function isFaction(value: unknown): value is Faction {
  return typeof value === 'string' && (MODULAR_FACTIONS as readonly string[]).includes(value);
}

/**
 * Resolve a usable modular faction from a possibly-missing/invalid value.
 *
 * Valid factions pass through unchanged. A missing or unrecognised faction logs
 * once (with the supplied context) and returns the last-resort fallback so the
 * vehicle still renders rather than disappearing. The fallback is explicitly a
 * diagnostic path, not a default.
 */
export function resolveModularFaction(
  faction: Faction | string | undefined | null,
  context = 'modular-render',
): Faction {
  if (isFaction(faction)) {
    return faction;
  }
  if (!warnedMissing) {
    warnedMissing = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[modular] missing/invalid faction "${String(faction)}" in ${context}; ` +
      `falling back to "${FALLBACK_MODULAR_FACTION}". This is a diagnostic ` +
      `last-resort, not a default — faction should be set upstream.`,
    );
  }
  return FALLBACK_MODULAR_FACTION;
}

/** Test-only: reset the one-shot warning latch. */
export function __resetFactionWarningForTest(): void {
  warnedMissing = false;
}
