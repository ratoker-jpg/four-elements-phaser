/**
 * ArenaModeContext — encapsulates Arena mode activation state.
 *
 * ARENA-01H+: Provides a single object that GameScene and subsystems
 * can query to determine whether Arena-specific behavior is active.
 *
 * This context controls:
 * - Whether the civil game loop runs (harvesters, economy, construction)
 * - Whether the PlaytestHud is shown
 * - Whether ArenaMenu is the primary UX
 * - Whether obstacle creation is skipped on reset
 *
 * Pure TypeScript — no Phaser, no DOM.
 */

/** Arena mode context — controls which subsystems are active in Arena mode. */
export interface ArenaModeContext {
  /** Whether Arena mode is active. */
  readonly arenaMode: boolean;

  /** Whether the civil game loop (harvesters, economy, construction) should run. */
  readonly runCivilLoop: boolean;

  /** Whether the PlaytestHud (economy/production panel) should be created. */
  readonly showPlaytestHud: boolean;

  /** Whether the ArenaMenu should be created as primary Arena UX. */
  readonly showArenaMenu: boolean;

  /** Whether blockout obstacles should be created on scenario reset. */
  readonly createObstaclesOnReset: boolean;
}

/** Create an ArenaModeContext based on the arenaMode flag. */
export function createArenaModeContext(arenaMode: boolean): ArenaModeContext {
  return {
    arenaMode,
    runCivilLoop: !arenaMode,
    showPlaytestHud: !arenaMode,
    showArenaMenu: arenaMode,
    createObstaclesOnReset: !arenaMode,
  };
}

/** Default context for Normal Game (Arena mode inactive). */
export const NORMAL_GAME_CONTEXT: ArenaModeContext = {
  arenaMode: false,
  runCivilLoop: true,
  showPlaytestHud: true,
  showArenaMenu: false,
  createObstaclesOnReset: true,
};
