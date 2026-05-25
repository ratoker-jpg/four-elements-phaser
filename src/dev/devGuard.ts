/**
 * Dev-only guard — controls whether debug/dev panels are active.
 *
 * BUILD-01A: Minimal dev guard for building asset tuner.
 * Checks: Vite DEV mode, test mode, or ?devtools=1 URL parameter.
 *
 * This is NOT copied from four-elements-next (AGENTS.md forbids that).
 * It is a new minimal implementation for four-elements-phaser.
 */

/** Whether dev/debug panels are allowed in the current environment. */
export function isDevPanelAllowed(): boolean {
  // Vite dev server
  if (import.meta.env.DEV === true) return true;
  // Test builds
  if (import.meta.env.MODE === 'test') return true;
  // Explicit opt-in via URL parameter
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('devtools') === '1') return true;
  }
  return false;
}
