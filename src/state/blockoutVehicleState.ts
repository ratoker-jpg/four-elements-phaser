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
 * ARENA-02H+: Added team field (ally/enemy) for Arena mode.
 */

import type { Faction } from './types';
import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import type { BlockoutUpgradeId } from '../config/blockoutUpgradeData';
import { getBlockoutBodyMaxHp } from '../config/blockoutBodyData';
import { tileToScreen } from '../phaser/render/isometric';

// ─── Arena Team Type (ARENA-02H+) ──────────────────────────────────

/** Team designation for Arena mode. ARENA-02H+. */
export type ArenaTeam = 'ally' | 'enemy';

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
  /** Arena team designation (ally/enemy). ARENA-02H+. Defaults to 'ally'. */
  team: ArenaTeam;
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

  // ── ARENA-03H+: Target-lock fields ───────────────────────────────

  /**
   * ID of the vehicle this unit is targeting (turret tracks this target).
   * ARENA-03H+: In Arena mode, the turret aims at this target instead of
   * following the mouse pointer. Null = no target (turret holds last angle).
   * Cleared when: ally is deselected, ally changes, target is destroyed/missing.
   * Transient — not persisted in saves.
   */
  targetVehicleId: string | null;

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

  // ── BLOCKOUT-05H+: Recoil/firing fields ─────────────────────────────

  /** Timestamp of last weapon fire (ms since epoch). BLOCKOUT-05H+. Used for cooldown. */
  lastFiredAt: number;
  /** Whether recoil is currently active. BLOCKOUT-05H+. */
  recoilActive: boolean;
  /** Recoil start timestamp (ms since epoch). BLOCKOUT-05H+. */
  recoilStartedAt: number;
  /** Recoil recovery duration in ms. BLOCKOUT-05H+. */
  recoilDurationMs: number;
  /** Current barrel kickback offset in pixels. BLOCKOUT-05H+. Decays to 0 over recovery. */
  recoilBarrelOffset: number;
  /** Current turret kickback angle in radians. BLOCKOUT-05H+. Decays to 0 over recovery. */
  recoilTurretOffset: number;
  /** Current body impulse offset in pixels. BLOCKOUT-05H+. Decays to 0 over recovery. */
  recoilBodyOffset: number;

  // ── BLOCKOUT-06H+: Continuous fire fields ──────────────────────────

  /** Whether fire key is currently held down. BLOCKOUT-06H+. Transient. */
  fireHeld: boolean;
  /** Whether weapon is actively producing VFX (for continuous weapons). BLOCKOUT-06H+. Transient. */
  isFiring: boolean;
  /** Timestamp of last continuous stream tick. BLOCKOUT-06H+. Transient. */
  lastStreamTickAt: number;
  /** Visual overheat indicator (0-1). BLOCKOUT-06H+. Transient. */
  visualOverheat: number;

  // ── BLOCKOUT-07H+: HP/damage fields ────────────────────────────────

  /** Current HP. BLOCKOUT-07H+. Transient. */
  hp: number;
  /** Maximum HP. BLOCKOUT-07H+. Transient. */
  maxHp: number;
  /** Whether vehicle is destroyed (HP <= 0). BLOCKOUT-07H+. Transient. */
  isDestroyed: boolean;
  /** Timestamp when vehicle was destroyed. 0 if not destroyed. BLOCKOUT-07H+. Transient. */
  destroyedAt: number;
  /** Timestamp of last damage received. 0 if never damaged. BLOCKOUT-07H+. Transient. */
  lastDamagedAt: number;
  /** Damage flash active until this timestamp. 0 if no flash. BLOCKOUT-07H+. Transient. */
  damageFlashUntil: number;
  /** Active status tags (visual-only). BLOCKOUT-07H+. Transient. */
  activeStatusTags: string[];

  /** Timestamp of last continuous damage tick. BLOCKOUT-07H+ fixup. Transient.
   *  Separate from lastStreamTickAt so VFX cadence and damage cadence
   *  do not block each other. */
  lastDamageTickAt: number;

  /** Creation timestamp (ms since epoch). Useful for debug labels. */
  createdAt: number;

  // ── BLOCKOUT-09H: Upgrade fields ─────────────────────────────────

  /** Upgrade levels for this vehicle. Keyed by upgrade ID. BLOCKOUT-09H. Transient. */
  upgradeLevels: Partial<Record<BlockoutUpgradeId, number>>;
  /** Timestamp of last upgrade application. 0 if never upgraded. BLOCKOUT-09H. Transient. */
  lastUpgradedAt: number;
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
  team: ArenaTeam = 'ally', // ARENA-02H+: default ally for backward compat
): BlockoutVehicleState {
  const screenPos = tileToScreen(tx, ty);

  return {
    id: `blockout-vehicle-${nextBlockoutVehicleId++}`,
    bodyId,
    weaponId,
    faction,
    team,
    tx,
    ty,
    bodyAngle,
    turretAngle: bodyAngle, // Initially turret matches body
    turretTargetAngle: bodyAngle, // Initially target matches body
    turretTurnSpeedDeg,
    targetVehicleId: null, // ARENA-03H+: No target by default
    worldX: screenPos.x,
    worldY: screenPos.y,
    vx: 0,
    vy: 0,
    speed: 0,
    targetWorldX: 0,
    targetWorldY: 0,
    hasMoveTarget: false,
    lastFiredAt: 0,
    recoilActive: false,
    recoilStartedAt: 0,
    recoilDurationMs: 0,
    recoilBarrelOffset: 0,
    recoilTurretOffset: 0,
    recoilBodyOffset: 0,
    fireHeld: false,
    isFiring: false,
    lastStreamTickAt: 0,
    visualOverheat: 0,
    hp: getBlockoutBodyMaxHp(bodyId),
    maxHp: getBlockoutBodyMaxHp(bodyId),
    isDestroyed: false,
    destroyedAt: 0,
    lastDamagedAt: 0,
    damageFlashUntil: 0,
    activeStatusTags: [],
    lastDamageTickAt: 0,
    createdAt: Date.now(),
    upgradeLevels: {},
    lastUpgradedAt: 0,
  };
}

/** Reset the auto-increment ID counter (useful for tests). */
export function resetBlockoutVehicleIdCounter(): void {
  nextBlockoutVehicleId = 1;
}
