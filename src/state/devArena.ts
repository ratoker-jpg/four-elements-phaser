/**
 * Dev arena — pure TypeScript state helpers for QA test arena.
 *
 * ARCH-12A: Provides a minimal fixed arena MapData and URL param
 * activation helper. Pure TS, no Phaser, no DOM.
 *
 * ARENA-01H+: Arena is now a clean standalone mode.
 * - No HQ (dummy placeholder kept for MapData type compatibility)
 * - No resources
 * - No builders
 * - No obstacles
 * - Empty 20x20 sandbox map
 *
 * ARENA-02H+: Added arenaSpawnVehicle() for click placement.
 */

import type { MapData, TerrainType, GameState, Faction } from './types';
import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import type { ArenaTeam, AiMode } from './blockoutVehicleState';
import { createBlockoutVehicle } from './blockoutVehicleState';
import { WEAPON_PROFILES } from '../config/blockoutWeaponData';

/** Arena map ID for getMapDataById. */
export const ARENA_MAP_ID = 'arena1';

/**
 * Check whether arena mode should be active based on URL params.
 * Checks for ?arena=1 (or ?arena=true). Requires ?devtools=1 too.
 */
export function isArenaEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('arena') === '1' || params.get('arena') === 'true';
}

// ─── Arena map preset ────────────────────────────────────────────

/**
 * Create the arena MapData — a clean empty sandbox map.
 *
 * ARENA-01H+: Arena is a standalone mode with no Normal Game elements.
 * - Empty 20x20 sand terrain
 * - No HQ (dummy at 0,0 kept for MapData type compatibility — not rendered in arena mode)
 * - No resources
 * - No builders
 * - No obstacles
 * - No buildings
 * - No construction sites
 */
export function createArenaMapData(): MapData {
  const W = 20;
  const H = 20;

  // All sand terrain
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < H; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < W; x++) {
      row.push('sand');
    }
    terrain.push(row);
  }

  return {
    width: W,
    height: H,
    terrain,
    // Dummy HQ for MapData type compatibility — NOT rendered in Arena mode.
    // ArenaModeContext.runCivilLoop = false ensures no HQ-related subsystems activate.
    hq: { tx: 0, ty: 0, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [],
    builders: [],
    constructionSites: [],
  };
}

/**
 * Dev reset command — resets the arena state by returning a fresh arena MapData.
 * Pure function — GameScene will use this to create a new GameState.
 *
 * ARENA-01H+: Reset produces the same clean empty map as initial creation.
 * No obstacles, no resources, no builders are restored.
 */
export function devResetArena(): MapData {
  return createArenaMapData();
}

// ─── Arena Vehicle Spawn (ARENA-02H+) ──────────────────────────────

/**
 * Spawn a blockout vehicle in Arena mode at a specific tile position.
 *
 * ARENA-02H+: Used by the click placement flow.
 * Creates a vehicle with the given body/weapon/team at the specified
 * tile position and adds it to the game state.
 *
 * Team determines the faction color:
 * - ally → cyan (player faction)
 * - enemy → green
 *
 * @param state - Current game state (mutated: vehicle added to blockoutVehicles)
 * @param bodyId - Body profile ID
 * @param weaponId - Weapon profile ID
 * @param team - Arena team (ally or enemy)
 * @param tx - Tile X position
 * @param ty - Tile Y position
 * @returns The created vehicle, or null if spawn failed
 */
export function arenaSpawnVehicle(
  state: GameState,
  bodyId: BodyId,
  weaponId: WeaponId,
  team: ArenaTeam,
  tx: number,
  ty: number,
  aiMode?: AiMode,
): { success: boolean; message: string } {
  // Resolve faction from team
  const faction: Faction = team === 'ally' ? 'cyan' : 'green';

  // Get weapon profile for turret turn speed
  const weaponProfile = WEAPON_PROFILES[weaponId];
  const turretTurnSpeedDeg = weaponProfile?.blockoutTurretTurnSpeedDeg ?? 120;

  // Create the vehicle
  const vehicle = createBlockoutVehicle(
    bodyId,
    weaponId,
    faction,
    tx,
    ty,
    Math.PI / 2, // default facing south
    turretTurnSpeedDeg,
    team,
  );

  // ARENA-05H+: Set AI mode for enemy vehicles
  if (team === 'enemy' && aiMode) {
    vehicle.aiMode = aiMode;
  }

  // Add to state
  if (!state.blockoutVehicles) {
    state.blockoutVehicles = [];
  }
  state.blockoutVehicles.push(vehicle);

  const bodyName = bodyId.charAt(0).toUpperCase() + bodyId.slice(1);
  const weaponName = weaponId.charAt(0).toUpperCase() + weaponId.slice(1);
  const teamLabel = team === 'ally' ? 'Ally' : 'Enemy';

  return {
    success: true,
    message: `${teamLabel} ${bodyName}+${weaponName} placed at (${tx}, ${ty})`,
  };
}
