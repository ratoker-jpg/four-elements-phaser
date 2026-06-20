/**
 * HUD layout constants for the bottom RTS HUD bar.
 *
 * VISUAL-HUD-CORE-01: All layout dimensions in one place so that the
 * camera safe-area, DOM panels, and future UI-scale share the same source.
 *
 * The HUD bar sits at the bottom of the screen. The main camera viewport
 * is reduced by HUD_BAR_HEIGHT so game content is never hidden behind it.
 */

/** Total height of the bottom HUD bar in CSS pixels. */
export const HUD_BAR_HEIGHT = 180;

/** Minimap slot dimensions. */
export const HUD_MINIMAP_WIDTH = 200;
export const HUD_MINIMAP_HEIGHT = 150;

/** Resource strip height (below the three main panels). */
export const HUD_RESOURCE_STRIP_HEIGHT = 30;

/** Panel area height (above the resource strip). */
export const HUD_PANEL_HEIGHT = HUD_BAR_HEIGHT - HUD_RESOURCE_STRIP_HEIGHT; // 150

/**
 * Check whether a screen-space Y coordinate falls inside the HUD bar.
 * Used by input routing to prevent map commands when clicking on HUD.
 *
 * @param screenY - Screen-space Y coordinate (0 = top of canvas)
 * @param canvasHeight - Total canvas height in pixels
 * @returns true if the point is inside the HUD bar area
 */
export function isScreenPointInHud(screenY: number, canvasHeight: number): boolean {
  return screenY >= canvasHeight - HUD_BAR_HEIGHT;
}

/**
 * Compute the main camera viewport height (game area above the HUD).
 *
 * @param canvasHeight - Total canvas height in pixels
 * @returns Viewport height for the main camera
 */
export function cameraViewportHeight(canvasHeight: number): number {
  return Math.max(canvasHeight - HUD_BAR_HEIGHT, 100);
}
