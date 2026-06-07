/**
 * WaspHullDirectionCalibrator — Wasp-only hull direction calibration tool.
 *
 * PIM-HULL-WASP-DIR-MAP-01: Provides manual direction cycling for
 * Wasp hull sprites in Arena/devtools mode. Allows Denis to step
 * through all 16 directions and determine the correct remap table.
 *
 * THIS IS NOT THE FINAL DIRECTION FIX. It is a calibration aid only.
 *
 * Hotkeys (Arena/devtools only, Wasp selected):
 *   ]  — next dir16 (cycle forward)
 *   [  — previous dir16 (cycle backward)
 *   \  — reset to auto (clear override)
 *   ;  — toggle calibration overlay visibility
 *   .  — activate calibration / toggle calibration mode
 *
 * No gameplay systems are changed.
 * No turret direction logic is affected.
 * No movement/pathfinding logic is affected.
 *
 * Reuses the spirit of the old Next/sandbox debug approach:
 * - hotkey changes direction
 * - visible label tells which direction is currently shown
 * - easy to step through all 16 states manually
 */

import {
  GENERATED_HULL_DIRECTIONS_16,
  getGeneratedHullTextureKey,
  resolveGeneratedHullFaction,
  modificationLevelToMod,
  bodyIdToGeneratedHullId,
  type GeneratedHullDir16Index,
} from '../../assets/generatedHullAssets';
import type { Faction } from '../../state/types';

// ─── Calibration state ──────────────────────────────────────────

/** Whether calibration mode is currently active. */
let calibrationActive = false;

/** The forced visual dir16 override (null = use normal pipeline). */
let forcedVisualDir16: number | null = null;

/** Whether the calibration overlay is visible. */
let overlayVisible = true;

/** Whether movement is frozen for calibration. */
let movementFrozen = false;

// ─── State accessors ────────────────────────────────────────────

/** Whether calibration mode is currently active. */
export function isCalibrationActive(): boolean {
  return calibrationActive;
}

/** Get the current forced visual dir16 (null = auto/normal pipeline). */
export function getForcedVisualDir16(): number | null {
  return forcedVisualDir16;
}

/** Whether the calibration overlay is visible. */
export function isOverlayVisible(): boolean {
  return overlayVisible;
}

/** Check whether calibration override is currently active (forced dir is set). */
export function isOverrideActive(): boolean {
  return forcedVisualDir16 !== null;
}

/** Whether movement is frozen for calibration. */
export function isMovementFrozen(): boolean {
  return movementFrozen && calibrationActive;
}

// ─── State mutations ────────────────────────────────────────────

/** Activate calibration mode. Does NOT set forced dir — override stays OFF
 *  until the user presses ] or [ to start cycling. This ensures the hull
 *  direction does not change the moment calibration mode is toggled on. */
export function activateCalibration(): boolean {
  calibrationActive = true;
  movementFrozen = true;
  // Do NOT set forcedVisualDir16 — override remains OFF until user cycles.
  // The overlay will show AUTO mode with current direction diagnostics.
  return calibrationActive;
}

/** Deactivate calibration mode and clear override. */
export function deactivateCalibration(): void {
  calibrationActive = false;
  forcedVisualDir16 = null;
  movementFrozen = false;
}

/** Toggle calibration mode. Returns new active state. */
export function toggleCalibration(): boolean {
  if (calibrationActive) {
    deactivateCalibration();
  } else {
    activateCalibration();
  }
  return calibrationActive;
}

/** Cycle to next dir16 (forward). Returns new forced dir16.
 *  When called from the null state (override OFF), starts at 0 and returns 0.
 *  For initial activation from the current visual direction, call
 *  activateOverrideFromCurrent() first, then cycle from there. */
export function cycleNextDir16(): number {
  if (forcedVisualDir16 === null) {
    forcedVisualDir16 = 0;
  } else {
    forcedVisualDir16 = (forcedVisualDir16 + 1) % 16;
  }
  return forcedVisualDir16;
}

/** Cycle to previous dir16 (backward). Returns new forced dir16.
 *  When called from the null state (override OFF), starts at 15 and returns 15.
 *  For initial activation from the current visual direction, call
 *  activateOverrideFromCurrent() first, then cycle from there. */
export function cyclePrevDir16(): number {
  if (forcedVisualDir16 === null) {
    forcedVisualDir16 = 15;
  } else {
    forcedVisualDir16 = (forcedVisualDir16 + 15) % 16; // +15 === -1 mod 16
  }
  return forcedVisualDir16;
}

/** Reset forced dir to 00 (East). */
export function resetToDir00(): number {
  forcedVisualDir16 = 0;
  return forcedVisualDir16;
}

/** Activate override from the current visual dir16.
 *  Sets forcedVisualDir16 to the provided value without cycling.
 *  This allows the first cycle press (] or [) to advance FROM the current
 *  direction rather than starting from an arbitrary default.
 *  Returns the new forced dir16. */
export function activateOverrideFromCurrent(currentVisualDir16: number): number {
  forcedVisualDir16 = currentVisualDir16;
  return forcedVisualDir16;
}

/** Clear override (return to auto/normal pipeline). */
export function clearOverride(): void {
  forcedVisualDir16 = null;
}

/** Toggle overlay visibility. Returns new state. */
export function toggleOverlay(): boolean {
  overlayVisible = !overlayVisible;
  return overlayVisible;
}

/** Toggle movement freeze. Returns new freeze state. */
export function toggleMovementFreeze(): boolean {
  movementFrozen = !movementFrozen;
  return movementFrozen;
}

// ─── Compass suffix helper ──────────────────────────────────────

/**
 * Get the compass suffix string for a dir16 index.
 * E.g. 0 → "E", 4 → "S", 12 → "N".
 */
export function getDir16CompassSuffix(dir16: number): string {
  const entry = GENERATED_HULL_DIRECTIONS_16[dir16];
  return entry ? entry.suffix : '?';
}

/**
 * Get the full direction label for a dir16 index.
 * E.g. 0 → "dir00_E", 4 → "dir04_S", 12 → "dir12_N".
 */
export function getDir16Label(dir16: number): string {
  const padded = String(dir16).padStart(2, '0');
  const suffix = getDir16CompassSuffix(dir16);
  return `dir${padded}_${suffix}`;
}

// ─── Forced key resolver ────────────────────────────────────────

/**
 * Resolve the texture key for a forced visual dir16.
 * This bypasses the normal bodyAngle → dir8 → dir16 → remap pipeline
 * and uses the forced visual dir16 directly.
 *
 * Returns the texture key if the texture exists in the scene's
 * TextureManager, or null if not available.
 */
export function resolveForcedHullKey(
  scene: Phaser.Scene,
  bodyId: string,
  faction: Faction,
  modificationLevel: number,
  forcedDir16: GeneratedHullDir16Index,
): string | null {
  const hullId = bodyIdToGeneratedHullId(bodyId);
  if (!hullId) return null;

  const hullFaction = resolveGeneratedHullFaction(faction);
  const mod = modificationLevelToMod(modificationLevel);
  const key = getGeneratedHullTextureKey(hullId, hullFaction, mod, forcedDir16);

  if (scene.textures.exists(key)) {
    return key;
  }
  return null;
}

// ─── Overlay text builder ──────────────────────────────────────

/** Parameters for building the calibration overlay text. */
export interface CalibrationOverlayParams {
  hullId: string | null;
  bodyAngleDeg: number;
  dir8: number;
  logicalDir16: number;
  normalVisualDir16: number;
  forcedDir16: number | null;
  compassSuffix: string;
  textureKey: string;
  isOverrideActive: boolean;
}

/**
 * Build the calibration overlay text for display.
 * Shows all diagnostic info needed to manually determine the correct remap.
 */
export function buildCalibrationOverlayText(params: CalibrationOverlayParams): string {
  const lines: string[] = [];

  lines.push('=== WASP CALIBRATOR ===');
  lines.push(`hull: ${params.hullId ?? 'N/A'}`);
  lines.push(`bodyAngle: ${params.bodyAngleDeg}\u00B0`);
  lines.push(`dir8: ${params.dir8}  logical dir16: ${params.logicalDir16}`);
  lines.push(`remap \u2192 visual dir16: ${params.normalVisualDir16} (${getDir16Label(params.normalVisualDir16)})`);

  if (params.isOverrideActive && params.forcedDir16 !== null) {
    lines.push(`FORCED visual dir16: ${params.forcedDir16} (${getDir16Label(params.forcedDir16)})`);
  } else {
    lines.push('visual dir16: AUTO');
  }

  lines.push(`compass: ${params.compassSuffix}`);
  lines.push(`texture: ${params.textureKey.split('_').slice(-2).join('_')}`);
  lines.push(`override: ${params.isOverrideActive ? 'ACTIVE' : 'off'}`);

  return lines.join('\n');
}

// ─── Calibration table template ─────────────────────────────────

/**
 * Generate a blank calibration table template that Denis can fill in
 * during manual calibration. Each row shows the logical dir16,
 * its compass suffix, and a placeholder for the correct visual dir16.
 *
 * This can be printed to console for easy copy-paste.
 */
export function generateCalibrationTableTemplate(): string {
  const lines: string[] = [];
  lines.push('// WASP_HULL_VISUAL_DIR16_REMAP — calibration template');
  lines.push('// Fill in the correct visual dir16 for each logical dir16.');
  lines.push('// logical dir16 → visual dir16 (which PNG actually faces the correct direction)');
  lines.push('export const WASP_HULL_VISUAL_DIR16_REMAP: Record<number, number> = {');

  for (let i = 0; i <= 15; i++) {
    const suffix = getDir16CompassSuffix(i);
    lines.push(`  ${i}: 0,  // logical ${suffix} → visual ??? (dir${String(i).padStart(2, '0')}_${suffix}),`);
  }

  lines.push('};');
  return lines.join('\n');
}

/**
 * Print the calibration table template to console.
 * Call from dev console: WaspHullDirectionCalibrator.printCalibrationTemplate()
 */
export function printCalibrationTemplate(): void {
  console.log(generateCalibrationTableTemplate());
}

// ─── Console API (for advanced use) ─────────────────────────────

/**
 * Install the calibrator's console API on the window object.
 * This allows Denis to interact from the browser dev console:
 *
 *   window.WASP_CAL.cycle()        — cycle next dir16
 *   window.WASP_CAL.prev()         — cycle prev dir16
 *   window.WASP_CAL.fromCurrent(n) — activate override from current visual dir16
 *   window.WASP_CAL.reset()        — reset to dir00
 *   window.WASP_CAL.auto()         — clear override (auto mode)
 *   window.WASP_CAL.dir(n)         — force specific dir16
 *   window.WASP_CAL.overlay()      — toggle overlay
 *   window.WASP_CAL.freeze()       — toggle movement freeze
 *   window.WASP_CAL.template()     — print calibration template
 *   window.WASP_CAL.state()        — print current state
 */
export function installConsoleAPI(): void {
  if (typeof window === 'undefined') return;

  const api = {
    cycle: () => {
      const d = cycleNextDir16();
      console.log(`[WASP_CAL] forced visual dir16 = ${d} (${getDir16Label(d)})`);
      return d;
    },
    prev: () => {
      const d = cyclePrevDir16();
      console.log(`[WASP_CAL] forced visual dir16 = ${d} (${getDir16Label(d)})`);
      return d;
    },
    fromCurrent: (n: number) => {
      const clamped = Math.min(Math.max(Math.round(n), 0), 15);
      const d = activateOverrideFromCurrent(clamped);
      console.log(`[WASP_CAL] override activated from current dir16 = ${d} (${getDir16Label(d)})`);
      return d;
    },
    reset: () => {
      const d = resetToDir00();
      console.log(`[WASP_CAL] forced visual dir16 = ${d} (${getDir16Label(d)})`);
      return d;
    },
    auto: () => {
      clearOverride();
      console.log('[WASP_CAL] override cleared — auto mode');
    },
    dir: (n: number) => {
      const clamped = Math.min(Math.max(Math.round(n), 0), 15);
      forcedVisualDir16 = clamped;
      console.log(`[WASP_CAL] forced visual dir16 = ${clamped} (${getDir16Label(clamped)})`);
      return clamped;
    },
    overlay: () => {
      const v = toggleOverlay();
      console.log(`[WASP_CAL] overlay ${v ? 'ON' : 'OFF'}`);
      return v;
    },
    freeze: () => {
      const f = toggleMovementFreeze();
      console.log(`[WASP_CAL] movement freeze ${f ? 'ON' : 'OFF'}`);
      return f;
    },
    template: () => {
      printCalibrationTemplate();
    },
    state: () => {
      const info = {
        calibrationActive,
        forcedVisualDir16,
        overlayVisible,
        movementFrozen,
        forcedLabel: forcedVisualDir16 !== null ? getDir16Label(forcedVisualDir16) : 'AUTO',
      };
      console.log('[WASP_CAL] state:', info);
      return info;
    },
  };

  (window as unknown as Record<string, unknown>).WASP_CAL = api;
  console.log('[WASP_CAL] Console API installed. Use window.WASP_CAL.cycle() / .prev() / .dir(n) / .auto() / .state()');
}
