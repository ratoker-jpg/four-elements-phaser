/**
 * WaspHullPlacementCalibrator — Wasp-only hull placement calibration tool.
 *
 * PIM-HULL-WASP-ANCHOR-MAP-01: Provides live offset adjustment for
 * Wasp hull sprite placement in Arena/devtools mode. Allows Denis to
 * see the projected ground cell / selection ring / hull anchor markers
 * and fine-tune the hull visual offset until it is correctly centered.
 *
 * THIS IS NOT THE FINAL PLACEMENT FIX. It is a calibration aid only.
 * The debug offset affects visual sprite position only — selection ring,
 * movement, pathfinding, turret aim are all unchanged.
 *
 * Hotkeys (Arena/devtools only, Wasp selected):
 *   Alt + ArrowUp/Down/Left/Right  — adjust offset by 1px
 *   Shift + Alt + ArrowUp/Down/Left/Right — adjust offset by 5px
 *   Alt + 0  — reset debug placement offset to (0, 0)
 *   Alt + P  — print current placement values to console
 *   Alt + O  — toggle placement overlay visibility
 *
 * No gameplay systems are changed.
 * No turret direction logic is affected.
 * No movement/pathfinding logic is affected.
 */

// ─── Calibration state ──────────────────────────────────────────

/** Whether placement calibration overlay is active. */
let placementActive = false;

/** Whether placement calibration overlay is visible. */
let placementOverlayVisible = true;

/** Debug X offset applied to Wasp hull sprite (pixels, screen-space). */
let debugOffsetX = 0;

/** Debug Y offset applied to Wasp hull sprite (pixels, screen-space). */
let debugOffsetY = 0;

/** Step size for normal adjustment. */
const STEP_SMALL = 1;

/** Step size for shift-modifier adjustment. */
const STEP_LARGE = 5;

// ─── State accessors ────────────────────────────────────────────

/** Whether placement calibration mode is active. */
export function isPlacementActive(): boolean {
  return placementActive;
}

/** Whether placement overlay is visible. */
export function isPlacementOverlayVisible(): boolean {
  return placementOverlayVisible;
}

/** Get the current debug X offset (pixels). */
export function getDebugOffsetX(): number {
  return debugOffsetX;
}

/** Get the current debug Y offset (pixels). */
export function getDebugOffsetY(): number {
  return debugOffsetY;
}

// ─── State mutations ────────────────────────────────────────────

/** Activate placement calibration mode. */
export function activatePlacement(): void {
  placementActive = true;
}

/** Deactivate placement calibration mode and reset offset. */
export function deactivatePlacement(): void {
  placementActive = false;
  debugOffsetX = 0;
  debugOffsetY = 0;
}

/** Toggle placement calibration mode. Returns new active state. */
export function togglePlacement(): boolean {
  if (placementActive) {
    deactivatePlacement();
  } else {
    activatePlacement();
  }
  return placementActive;
}

/** Adjust offset up (decrease Y). Returns new offset. */
export function adjustUp(large: boolean): { x: number; y: number } {
  debugOffsetY -= large ? STEP_LARGE : STEP_SMALL;
  return { x: debugOffsetX, y: debugOffsetY };
}

/** Adjust offset down (increase Y). Returns new offset. */
export function adjustDown(large: boolean): { x: number; y: number } {
  debugOffsetY += large ? STEP_LARGE : STEP_SMALL;
  return { x: debugOffsetX, y: debugOffsetY };
}

/** Adjust offset left (decrease X). Returns new offset. */
export function adjustLeft(large: boolean): { x: number; y: number } {
  debugOffsetX -= large ? STEP_LARGE : STEP_SMALL;
  return { x: debugOffsetX, y: debugOffsetY };
}

/** Adjust offset right (increase X). Returns new offset. */
export function adjustRight(large: boolean): { x: number; y: number } {
  debugOffsetX += large ? STEP_LARGE : STEP_SMALL;
  return { x: debugOffsetX, y: debugOffsetY };
}

/** Reset debug offset to (0, 0). */
export function resetPlacementOffset(): void {
  debugOffsetX = 0;
  debugOffsetY = 0;
}

/** Toggle placement overlay visibility. Returns new state. */
export function togglePlacementOverlay(): boolean {
  placementOverlayVisible = !placementOverlayVisible;
  return placementOverlayVisible;
}

// ─── Overlay text builder ──────────────────────────────────────

/** Parameters for building the placement calibration overlay text. */
export interface PlacementOverlayParams {
  hullId: string | null;
  vehicleId: string;
  bodyId: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  originX: number;
  originY: number;
  textureKey: string;
  tileX: number;
  tileY: number;
  isPlacementActive: boolean;
}

/**
 * Build the placement calibration overlay text for display.
 * Shows all diagnostic info needed to calibrate hull placement.
 */
export function buildPlacementOverlayText(params: PlacementOverlayParams): string {
  const lines: string[] = [];

  lines.push('=== WASP PLACEMENT CALIBRATOR ===');
  lines.push(`hull: ${params.hullId ?? 'N/A'}`);
  lines.push(`vehicle: ${params.vehicleId}`);
  lines.push(`body: ${params.bodyId}`);
  lines.push(`offset: (${params.offsetX}, ${params.offsetY})`);
  lines.push(`scale: ${params.scale}  origin: (${params.originX}, ${params.originY})`);
  lines.push(`texture: ${params.textureKey.split('_').slice(-2).join('_')}`);
  lines.push(`tile: (${params.tileX.toFixed(1)}, ${params.tileY.toFixed(1)})`);
  lines.push(`placement: ${params.isPlacementActive ? 'ACTIVE' : 'off'}`);

  return lines.join('\n');
}

// ─── Console print ──────────────────────────────────────────────

/**
 * Print current placement calibration values to console.
 * Denis can copy these values and report them for the final fix.
 */
export function printPlacementValues(): void {
  const values = {
    scale: 0.24,         // GENERATED_HULL_SCALE default
    originX: 0.5,        // GENERATED_HULL_ORIGIN_X default
    originY: 0.75,       // GENERATED_HULL_ORIGIN_Y default
    offsetX: debugOffsetX,
    offsetY: debugOffsetY,
  };

  console.log('[WaspPlacementCalibrator] Current placement values:');
  console.log(`  Wasp scale = ${values.scale}`);
  console.log(`  Wasp originX = ${values.originX}`);
  console.log(`  Wasp originY = ${values.originY}`);
  console.log(`  Wasp offsetX = ${values.offsetX}`);
  console.log(`  Wasp offsetY = ${values.offsetY}`);
  console.log('');
  console.log('Result template for Denis:');
  console.log(`  Wasp scale = ${values.scale}`);
  console.log(`  Wasp originX = ${values.originX}`);
  console.log(`  Wasp originY = ${values.originY}`);
  console.log(`  Wasp offsetX = ${values.offsetX}`);
  console.log(`  Wasp offsetY = ${values.offsetY}`);
  console.log(`  uiOffsetY = `);

  return values as unknown as void;
}

// ─── Console API (for advanced use) ─────────────────────────────

/**
 * Install the placement calibrator's console API on the window object.
 * This allows Denis to interact from the browser dev console:
 *
 *   window.WASP_PLACE.up()       — adjust up 1px
 *   window.WASP_PLACE.down()     — adjust down 1px
 *   window.WASP_PLACE.left()     — adjust left 1px
 *   window.WASP_PLACE.right()    — adjust right 1px
 *   window.WASP_PLACE.up5()      — adjust up 5px
 *   window.WASP_PLACE.down5()    — adjust down 5px
 *   window.WASP_PLACE.left5()    — adjust left 5px
 *   window.WASP_PLACE.right5()   — adjust right 5px
 *   window.WASP_PLACE.reset()    — reset offset to (0,0)
 *   window.WASP_PLACE.print()    — print placement values
 *   window.WASP_PLACE.overlay()  — toggle overlay
 *   window.WASP_PLACE.state()    — print current state
 *   window.WASP_PLACE.set(x, y)  — set offset directly
 */
export function installPlacementConsoleAPI(): void {
  if (typeof window === 'undefined') return;

  const api = {
    up: () => { const o = adjustUp(false); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    down: () => { const o = adjustDown(false); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    left: () => { const o = adjustLeft(false); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    right: () => { const o = adjustRight(false); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    up5: () => { const o = adjustUp(true); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    down5: () => { const o = adjustDown(true); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    left5: () => { const o = adjustLeft(true); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    right5: () => { const o = adjustRight(true); console.log(`[WASP_PLACE] offset = (${o.x}, ${o.y})`); return o; },
    reset: () => { resetPlacementOffset(); console.log('[WASP_PLACE] offset reset to (0, 0)'); },
    print: () => { printPlacementValues(); },
    overlay: () => { const v = togglePlacementOverlay(); console.log(`[WASP_PLACE] overlay ${v ? 'ON' : 'OFF'}`); return v; },
    state: () => {
      const info = { placementActive, debugOffsetX, debugOffsetY, placementOverlayVisible };
      console.log('[WASP_PLACE] state:', info);
      return info;
    },
    set: (x: number, y: number) => {
      debugOffsetX = x;
      debugOffsetY = y;
      console.log(`[WASP_PLACE] offset set to (${x}, ${y})`);
      return { x, y };
    },
  };

  (window as unknown as Record<string, unknown>).WASP_PLACE = api;
  console.log('[WASP_PLACE] Console API installed. Use window.WASP_PLACE.up()/.down()/.left()/.right()/.print()/.state()');
}
