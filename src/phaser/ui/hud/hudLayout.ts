/**
 * HUD layout constants for the AoE4-inspired RTS HUD.
 *
 * HUD-LAYOUT-REBUILD-02: Rebuilt layout constants for the new UX:
 *   - Resource strip moved to top-left overlay (no camera safe-area)
 *   - Bottom HUD is the only camera safe-area
 *   - Minimap: 240×180 in bottom-left
 *   - Selection panel: bottom-center
 *   - Command card area: bottom-right, reserved for 4×3 grid
 *   - Status/toast lane: bottom of HUD bar
 *
 * The bottom HUD bar sits at the bottom of the screen. The main camera
 * viewport is reduced by HUD_BAR_HEIGHT so game content is never hidden.
 * The top-left resource strip is a DOM overlay and does NOT reduce
 * the camera viewport.
 */

import type { ArenaModeContext } from '../../../state/arenaModeContext';

// ─── Bottom HUD bar ──────────────────────────────────────────────

/** Total height of the bottom HUD bar in CSS pixels. */
export const HUD_BAR_HEIGHT = 200;

/** Status/toast lane height (bottom of HUD bar). */
export const HUD_STATUS_LANE_HEIGHT = 28;

/** Panel row height (above status lane). */
export const HUD_PANEL_ROW_HEIGHT = HUD_BAR_HEIGHT - HUD_STATUS_LANE_HEIGHT; // 172

// ─── Minimap slot ────────────────────────────────────────────────

/** Minimap slot dimensions — larger than prototype for readability. */
export const HUD_MINIMAP_WIDTH = 240;
export const HUD_MINIMAP_HEIGHT = 172;

// ─── Command card area ───────────────────────────────────────────

/** Command card grid columns — reserved for future 4×3 grid. */
export const COMMAND_CARD_COLS = 4;
/** Command card grid rows — reserved for future 4×3 grid. */
export const COMMAND_CARD_ROWS = 3;
/** Minimum width for the command card area. */
export const COMMAND_CARD_MIN_WIDTH = 280;

// ─── Top-left resource strip overlay ─────────────────────────────

/** Resource strip overlay height. */
export const RESOURCE_STRIP_HEIGHT = 32;
/** Resource strip overlay max-width. */
export const RESOURCE_STRIP_MAX_WIDTH = 480;

// ─── Safe-area functions ─────────────────────────────────────────

/**
 * Whether the bottom RTS HUD bar should be shown and the camera
 * safe-area should be applied. The bottom HUD is only enabled in
 * Normal Game mode (showPlaytestHud === true). Arena mode uses
 * its own top-right panel and must keep the full camera viewport.
 */
export function shouldUseBottomHudSafeArea(arenaCtx: ArenaModeContext): boolean {
  return arenaCtx.showPlaytestHud;
}

/**
 * Check whether a screen-space Y coordinate falls inside the bottom HUD bar.
 * Used by input routing to prevent map commands when clicking on HUD.
 *
 * Only meaningful when the bottom HUD is actually shown
 * (shouldUseBottomHudSafeArea returns true).
 *
 * Note: This only checks the bottom HUD bar. The top-left resource
 * strip overlay does NOT block map input — it uses pointer-events: none.
 *
 * @param screenY - Screen-space Y coordinate (0 = top of canvas)
 * @param canvasHeight - Total canvas height in pixels
 * @returns true if the point is inside the bottom HUD bar area
 */
export function isScreenPointInHud(screenY: number, canvasHeight: number): boolean {
  return screenY >= canvasHeight - HUD_BAR_HEIGHT;
}

/**
 * Compute the main camera viewport height (game area above the HUD).
 *
 * The bottom HUD is the ONLY camera safe-area. The top-left resource
 * strip does not reduce the camera viewport.
 *
 * @param canvasHeight - Total canvas height in pixels
 * @returns Viewport height for the main camera
 */
export function cameraViewportHeight(canvasHeight: number): number {
  return Math.max(canvasHeight - HUD_BAR_HEIGHT, 100);
}
