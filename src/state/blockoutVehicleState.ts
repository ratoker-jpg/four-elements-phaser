/**
 * Blockout vehicle state — runtime state for blockout vehicles.
 *
 * Isolated from existing civil units. Blockout vehicles are dev-only
 * and are not persisted in saves.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 * Vehicles are stationary in this PR — no movement physics,
 * no turret aiming, no recoil, no damage.
 */

import type { Faction } from './types';
import type { BodyId, WeaponId } from '../config/blockoutProfiles';

// ─── Blockout Vehicle State ────────────────────────────────────────

/** Runtime state for a single blockout vehicle. */
export interface BlockoutVehicleState {
  /** Unique ID for this blockout vehicle instance. */
  id: string;
  /** Which body profile this vehicle uses. */
  bodyId: BodyId;
  /** Which weapon profile this vehicle uses. */
  weaponId: WeaponId;
  /** Faction / color group for rendering. */
  faction: Faction;
  /** Tile X position. */
  tx: number;
  /** Tile Y position. */
  ty: number;
  /** Body angle in radians (continuous). In BLOCKOUT-02H, this is fixed at spawn. */
  bodyAngle: number;
  /** Turret angle in radians (continuous). In BLOCKOUT-02H, same as bodyAngle. */
  turretAngle: number;
  /** Creation timestamp (ms since epoch). Useful for debug labels. */
  createdAt: number;
}

// ─── State helpers ─────────────────────────────────────────────────

let nextBlockoutVehicleId = 1;

/** Create a new BlockoutVehicleState with the given parameters. */
export function createBlockoutVehicle(
  bodyId: BodyId,
  weaponId: WeaponId,
  faction: Faction,
  tx: number,
  ty: number,
  bodyAngle: number = Math.PI / 2, // default: facing south in isometric
): BlockoutVehicleState {
  return {
    id: `blockout-vehicle-${nextBlockoutVehicleId++}`,
    bodyId,
    weaponId,
    faction,
    tx,
    ty,
    bodyAngle,
    turretAngle: bodyAngle, // In BLOCKOUT-02H, turret matches body
    createdAt: Date.now(),
  };
}

/** Reset the auto-increment ID counter (useful for tests). */
export function resetBlockoutVehicleIdCounter(): void {
  nextBlockoutVehicleId = 1;
}
