/**
 * debugRenderFlags — VEHICLE-RENDER-UNIFY-01-VH fixup.
 *
 * Explicit debug render flag module for BlockoutVehicleRenderer debug
 * artifacts. Decouples "is devtools active" (a mode flag) from "should
 * this debug artifact be drawn" (a render flag).
 *
 * Why this module exists:
 *   PR #298 originally gated the red dashed aim line and the direction
 *   arrow on the selection ring behind `this.isDevtoolsActive()`. That
 *   was wrong because Arena mode is also devtools-active in GameScene,
 *   so `this.isDevtoolsActive() === true` in default Arena view — the
 *   artifacts still appeared by default.
 *
 *   The fix is to gate each debug artifact behind an EXPLICIT flag in
 *   this module, with default = false. Devtools panels / hotkeys can
 *   flip a flag to true to opt IN, but the flag is never implied by
 *   mode alone.
 *
 * Contract:
 *   - All flags default to false.
 *   - Flags are module-level singletons (one source of truth).
 *   - resetDebugRenderFlags() restores defaults (test/teardown helper).
 *   - No flag is ever implicitly set by `isDevtoolsActive()`, URL params,
 *     or game mode. Only explicit setter calls flip flags.
 *
 * Artifacts controlled:
 *   - directionArrow: arrow on the selection ring showing body facing.
 *   - aimLine: red dashed line from barrel tip along turret aim direction.
 *   - mountPoints: red dot on the turret mount position.
 *   - debugLabels: text label above each vehicle (body+weapon+hp+speed).
 *
 * Not controlled (these are core gameplay UI, not debug artifacts):
 *   - selection ring (always shown for selected vehicle).
 *   - hover ring (always shown for hovered vehicle).
 *   - HP bar (always shown when HP < max).
 *   - target-lock indicator (always shown when target assigned).
 *   - enemy team indicator (always shown for enemies).
 *   - move-target marker (always shown during movement).
 *
 * This module is engine-agnostic (no Phaser) and unit-testable.
 */

/**
 * Debug render flags. All default to false.
 */
export interface DebugRenderFlags {
  /**
   * Direction arrow on the selection ring showing body facing.
   * Default: false. The selection ring itself is NOT controlled by this
   * flag — the ring is core gameplay UI and is always shown for the
   * selected vehicle.
   */
  directionArrow: boolean;

  /**
   * Red dashed aim line from barrel tip along turret aim direction.
   * Default: false.
   */
  aimLine: boolean;

  /**
   * Red dot on the turret mount position.
   * Default: false.
   */
  mountPoints: boolean;

  /**
   * Text label above each vehicle (body+weapon+hp+speed).
   * Default: false.
   */
  debugLabels: boolean;
}

/**
 * Module-level singleton flag store. All flags default to false.
 *
 * Tests and devtools panels read/write this object directly or via the
 * helper functions below.
 */
export const debugRenderFlags: DebugRenderFlags = {
  directionArrow: false,
  aimLine: false,
  mountPoints: false,
  debugLabels: false,
};

/**
 * Reset all debug render flags to their default (false).
 * Test/teardown helper.
 */
export function resetDebugRenderFlags(): void {
  debugRenderFlags.directionArrow = false;
  debugRenderFlags.aimLine = false;
  debugRenderFlags.mountPoints = false;
  debugRenderFlags.debugLabels = false;
}

/**
 * Set a single debug render flag.
 * Type-safe setter — the key must be a known flag name.
 */
export function setDebugRenderFlag<K extends keyof DebugRenderFlags>(
  key: K,
  value: DebugRenderFlags[K],
): void {
  debugRenderFlags[key] = value;
}

/**
 * Get a single debug render flag value.
 * Type-safe getter.
 */
export function getDebugRenderFlag<K extends keyof DebugRenderFlags>(
  key: K,
): DebugRenderFlags[K] {
  return debugRenderFlags[key];
}

/**
 * True when ALL debug render flags are at their default (false).
 * Used by tests to verify a clean slate.
 */
export function areAllDebugRenderFlagsOff(): boolean {
  return (
    !debugRenderFlags.directionArrow &&
    !debugRenderFlags.aimLine &&
    !debugRenderFlags.mountPoints &&
    !debugRenderFlags.debugLabels
  );
}
