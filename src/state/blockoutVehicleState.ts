/**
 * Blockout vehicle state — runtime state for blockout vehicles.
 *
 * Isolated from existing civil units. Blockout vehicles are dev-only
 * and are not persisted in saves.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 * BLOCKOUT-03H: Added turretTargetAngle and turretTurnSpeedDeg for
 * independent turret aiming.
 * BLOCKOUT-04H+: Added movement fields (worldX/worldY, velocity,
 * move target) for semi-physics movement.
 */

import type { Faction } from './types';
import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import { tileToScreen } from '../phaser/render/isometric';

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
  /** Tile X position (updated approximately from worldX/worldY). */
  tx: number;
  /** Tile Y position (updated approximately from worldX/worldY). */
  ty: number;
  /** Body angle in radians (continuous). Updated by movement toward movement direction. */
  bodyAngle: number;
  /** Turret angle in radians (continuous). Updated each frame toward turretTargetAngle. */
  turretAngle: number;
  /**
   * Target angle for turret aiming in radians.
   * BLOCKOUT-03H: When a vehicle is selected, this is set to the angle
   * toward the mouse cursor. The turret rotates toward this angle each frame.
   * When not selected, defaults to bodyAngle (turret matches body).
   */
  turretTargetAngle: number;
  /**
   * Turret turn speed in degrees per second.
   * BLOCKOUT-03H: Different weapons may have different turret turn speeds.
   * Default value used when no weapon-specific speed is configured.
   */
  turretTurnSpeedDeg: number;

  // ── BLOCKOUT-04H+: Movement fields ───────────────────────────────

  /** Screen-space pixel X position (continuous). BLOCKOUT-04H+.
   *  Use worldX + offset.x for world position. */
  worldX: number;
  /** Screen-space pixel Y position (continuous). BLOCKOUT-04H+.
   *  Use worldY + offset.y for world position. */
  worldY: number;
  /** Current velocity X in pixels/second. BLOCKOUT-04H+. */
  vx: number;
  /** Current velocity Y in pixels/second. BLOCKOUT-04H+. */
  vy: number;
  /** Current scalar speed in pixels/second. BLOCKOUT-04H+. */
  speed: number;
  /** Movement target X in screen-space pixels. BLOCKOUT-04H+. */
  targetWorldX: number;
  /** Movement target Y in screen-space pixels. BLOCKOUT-04H+. */
  targetWorldY: number;
  /** Whether a movement target is currently active. BLOCKOUT-04H+. */
  hasMoveTarget: boolean;

  /** Creation timestamp (ms since epoch). Useful for debug labels. */
  createdAt: number;
}

// ─── Constants ─────────────────────────────────────────────────────

/** Default turret turn speed in degrees per second. */
export const DEFAULT_TURRET_TURN_SPEED_DEG = 120;

// ─── State helpers ─────────────────────────────────────────────────

let nextBlockoutVehicleId = 1;

/** Create a new BlockoutVehicleState with the given parameters.
 *  worldX/worldY are initialized from tileToScreen(tx, ty).
 */
export function createBlockoutVehicle(
  bodyId: BodyId,
  weaponId: WeaponId,
  faction: Faction,
  tx: number,
  ty: number,
  bodyAngle: number = Math.PI / 2, // default: facing south in isometric
  turretTurnSpeedDeg: number = DEFAULT_TURRET_TURN_SPEED_DEG,
): BlockoutVehicleState {
  const screenPos = tileToScreen(tx, ty);

  return {
    id: `blockout-vehicle-${nextBlockoutVehicleId++}`,
    bodyId,
    weaponId,
    faction,
    tx,
    ty,
    bodyAngle,
    turretAngle: bodyAngle, // Initially turret matches body
    turretTargetAngle: bodyAngle, // Initially target matches body
    turretTurnSpeedDeg,
    worldX: screenPos.x,
    worldY: screenPos.y,
    vx: 0,
    vy: 0,
    speed: 0,
    targetWorldX: 0,
    targetWorldY: 0,
    hasMoveTarget: false,
    createdAt: Date.now(),
  };
}

/** Reset the auto-increment ID counter (useful for tests). */
export function resetBlockoutVehicleIdCounter(): void {
  nextBlockoutVehicleId = 1;
}
