/**
 * Arena placement — placement state machine and click-to-tile conversion
 * for Arena unit creation.
 *
 * ARENA-02H+: Provides the placement mode state machine and the
 * click-to-tile conversion using the camera projection contract.
 *
 * Uses `unprojectScreenToGround()` from cameraProjectionContract.ts
 * as the single source of truth for converting screen clicks to
 * world/tile coordinates on the ground plane. Does NOT use
 * `screenToTile()` from isometric.ts — the camera projection
 * contract is the approved method per ARENA_SANDBOX_SYSTEM_AUDIT.
 *
 * Pure TypeScript — no Phaser, no DOM.
 */

import { unprojectScreenToGround } from '../config/cameraProjectionContract';
import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import type { ArenaTeam, AiMode } from './blockoutVehicleState';
import type { BlockoutVehicleState } from './blockoutVehicleState';

// ─── Placement state ────────────────────────────────────────────────

/** Placement mode state. */
export type PlacementMode = 'idle' | 'placing';

/** Full placement state for Arena unit creation. */
export interface ArenaPlacementState {
  /** Current placement mode: idle or actively placing. */
  mode: PlacementMode;
  /** Selected body for the unit being created. */
  selectedBody: BodyId | null;
  /** Selected weapon for the unit being created. */
  selectedWeapon: WeaponId | null;
  /** Selected team for the unit being created. */
  selectedTeam: ArenaTeam;
  /** ARENA-05H+: Selected AI mode for enemy units. */
  selectedAiMode: AiMode;
}

/** Create default placement state (idle, no selections). */
export function createArenaPlacementState(): ArenaPlacementState {
  return {
    mode: 'idle',
    selectedBody: null,
    selectedWeapon: null,
    selectedTeam: 'ally',
    selectedAiMode: 'passive', // ARENA-05H+
  };
}

// ─── Placement actions ──────────────────────────────────────────────

/** Enter placement mode. Requires body and weapon to be selected. */
export function enterPlacementMode(state: ArenaPlacementState): boolean {
  if (!state.selectedBody || !state.selectedWeapon) {
    return false;
  }
  state.mode = 'placing';
  return true;
}

/** Cancel placement mode — return to idle. */
export function cancelPlacementMode(state: ArenaPlacementState): void {
  state.mode = 'idle';
}

// ─── Click-to-tile conversion ────────────────────────────────────────

/**
 * Result of a placement click attempt.
 */
export interface PlacementClickResult {
  /** Whether the placement is valid. */
  valid: boolean;
  /** Tile X position (rounded from fractional). */
  tx: number;
  /** Tile Y position (rounded from fractional). */
  ty: number;
  /** Reason if invalid. */
  reason?: string;
}

/**
 * Convert a screen click to a tile position using the camera projection contract.
 *
 * Uses `unprojectScreenToGround()` — the approved method per audit.
 * Returns fractional tile coordinates which are rounded to nearest integer.
 *
 * @param screenX - Screen-space X (after camera.getWorldPoint)
 * @param screenY - Screen-space Y (after camera.getWorldPoint)
 * @param origin - Map origin offset
 * @param mapWidth - Map width in tiles
 * @param mapHeight - Map height in tiles
 * @param existingVehicles - Existing vehicles for occupancy check
 * @returns PlacementClickResult with tile position and validity
 */
export function convertClickToPlacementTile(
  screenX: number,
  screenY: number,
  origin: { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
  existingVehicles: BlockoutVehicleState[],
): PlacementClickResult {
  // Step 1: Unproject screen position to ground plane tile coordinates.
  // unprojectScreenToGround returns fractional tile coords { x, y }.
  const ground = unprojectScreenToGround(screenX, screenY, origin);

  // Step 2: Round to nearest integer tile.
  const tx = Math.round(ground.x);
  const ty = Math.round(ground.y);

  // Step 3: Validate map bounds.
  if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) {
    return { valid: false, tx, ty, reason: 'Outside map bounds' };
  }

  // Step 4: Check occupancy — prevent placing on tile with existing blockout vehicle.
  const occupied = existingVehicles.some(v => v.tx === tx && v.ty === ty && !v.isDestroyed);
  if (occupied) {
    return { valid: false, tx, ty, reason: 'Tile occupied' };
  }

  return { valid: true, tx, ty };
}

/**
 * Get the hover tile position for placement marker rendering.
 *
 * Returns the fractional ground-plane coordinates AND the rounded tile
 * position for the placement marker. Also checks occupancy so the
 * marker can render red when hovering an occupied tile.
 *
 * ARENA-02H+ fixup: Added existingVehicles param for occupancy check
 * in the hover marker (red = occupied, cyan = valid).
 *
 * @param screenX - Screen-space X (after camera.getWorldPoint)
 * @param screenY - Screen-space Y (after camera.getWorldPoint)
 * @param origin - Map origin offset
 * @param mapWidth - Map width in tiles
 * @param mapHeight - Map height in tiles
 * @param existingVehicles - Existing vehicles for occupancy check (default: empty)
 * @returns Rounded tile position and validity, or null if off-map
 */
export function getPlacementHoverTile(
  screenX: number,
  screenY: number,
  origin: { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
  existingVehicles: BlockoutVehicleState[] = [],
): { tx: number; ty: number; valid: boolean } | null {
  const ground = unprojectScreenToGround(screenX, screenY, origin);
  const tx = Math.round(ground.x);
  const ty = Math.round(ground.y);

  if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) {
    return null;
  }

  // Check occupancy — marker shows red when hovering occupied tile
  const occupied = existingVehicles.some(v => v.tx === tx && v.ty === ty && !v.isDestroyed);

  return { tx, ty, valid: !occupied };
}
