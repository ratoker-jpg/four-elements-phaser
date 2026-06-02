/**
 * Blockout weapon VFX system — pure TypeScript, no Phaser dependencies.
 *
 * BLOCKOUT-05H+: Visual-only firing, recoil, and weapon VFX for
 * Smoky / Railgun / Thunder in arena/dev mode.
 *
 * BLOCKOUT-06H+: Extended to all 11 weapons including continuous
 * fire support (Flamethrower, Freeze, Isida, Vulcan, Twins).
 *
 * This module provides:
 * - VFX event creation and aging
 * - Recoil start/update/recovery
 * - Cooldown check
 * - Continuous fire tick (stream weapons)
 * - Firing state management
 *
 * All state is transient and NOT persisted in saves.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { RecoilProfile, WeaponId } from '../config/blockoutProfiles';
import { RECOIL_PROFILES } from '../config/blockoutRecoilData';
import { getWeaponVfxProfile } from '../config/blockoutVfxData';
import { getWeaponProfile } from '../config/blockoutWeaponData';

// ─── VFX Event ────────────────────────────────────────────────────

/** Weapon VFX event type. BLOCKOUT-06H+: All 11 weapons implemented. */
export type VfxEventType =
  | 'smokyShot' | 'railgunLine' | 'thunderSplash'
  | 'shaftLine' | 'flamethrowerCone' | 'freezeCone'
  | 'isidaBeam' | 'vulcanTracer' | 'twinsPlasma'
  | 'ricochetBounce' | 'hammerShotgun';

/** A single visual-only VFX event. Transient — not persisted. */
export interface BlockoutWeaponVfxEvent {
  /** Unique event ID. */
  id: number;
  /** Weapon that fired. */
  weaponId: WeaponId;
  /** VFX event type. */
  eventType: VfxEventType;
  /** Origin X in screen-space pixels (barrel tip position, with offset). */
  originX: number;
  /** Origin Y in screen-space pixels (barrel tip position, with offset). */
  originY: number;
  /** Target X in screen-space pixels. */
  targetX: number;
  /** Target Y in screen-space pixels. */
  targetY: number;
  /** Turret angle at time of fire. */
  angle: number;
  /** Creation timestamp (ms since epoch). */
  createdAt: number;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Range of the effect in pixels. */
  rangePx: number;
  /** Splash/impact radius in pixels (0 for non-splash). */
  impactRadiusPx: number;
  /** Cone half-angle in degrees (for cone/stream effects). BLOCKOUT-06H+. */
  coneAngleDeg: number;
  /** Number of bounce segments (for ricochet). BLOCKOUT-06H+. */
  bounceCount: number;
  /** Number of pellets (for shotgun). BLOCKOUT-06H+. */
  pelletCount: number;
}

// ─── VFX event list (module-local, transient) ─────────────────────

let vfxEvents: BlockoutWeaponVfxEvent[] = [];
let nextVfxEventId = 1;

/** Get all active VFX events. */
export function getVfxEvents(): ReadonlyArray<BlockoutWeaponVfxEvent> {
  return vfxEvents;
}

/** Remove expired VFX events based on current time. */
export function expireVfxEvents(nowMs: number): void {
  vfxEvents = vfxEvents.filter(e => (nowMs - e.createdAt) < e.durationMs);
}

/** Clear all VFX events. */
export function clearVfxEvents(): void {
  vfxEvents = [];
}

/** Reset VFX event ID counter (for tests). */
export function resetVfxEventIdCounter(): void {
  nextVfxEventId = 1;
  vfxEvents = [];
}

// ─── VFX event creation ──────────────────────────────────────────

/**
 * Map weaponId to VFX event type.
 * BLOCKOUT-06H+: All 11 weapons now have VFX event types.
 */
function getVfxEventType(weaponId: WeaponId): VfxEventType {
  switch (weaponId) {
    case 'smoky': return 'smokyShot';
    case 'railgun': return 'railgunLine';
    case 'thunder': return 'thunderSplash';
    case 'shaft': return 'shaftLine';
    case 'flamethrower': return 'flamethrowerCone';
    case 'freeze': return 'freezeCone';
    case 'isida': return 'isidaBeam';
    case 'vulcan': return 'vulcanTracer';
    case 'twins': return 'twinsPlasma';
    case 'ricochet': return 'ricochetBounce';
    case 'hammer': return 'hammerShotgun';
  }
}

/**
 * Fire a weapon VFX event from a blockout vehicle.
 *
 * Creates a VFX event and starts recoil. Returns the created event
 * or null if cooldown has not elapsed.
 *
 * BLOCKOUT-06H+: All 11 weapons are now implemented.
 *
 * @param vehicle - The firing vehicle
 * @param barrelTipX - Barrel tip X in screen-space pixels (with offset)
 * @param barrelTipY - Barrel tip Y in screen-space pixels (with offset)
 * @param aimAngle - Turret angle at time of fire
 * @param aimTargetX - Aim target X in screen-space pixels (with offset)
 * @param aimTargetY - Aim target Y in screen-space pixels (with offset)
 * @param nowMs - Current timestamp
 * @returns The VFX event, or null if on cooldown
 */
export function fireBlockoutWeapon(
  vehicle: BlockoutVehicleState,
  barrelTipX: number,
  barrelTipY: number,
  aimAngle: number,
  aimTargetX: number,
  aimTargetY: number,
  nowMs: number,
): BlockoutWeaponVfxEvent | null {
  const weaponId = vehicle.weaponId;
  const eventType = getVfxEventType(weaponId);

  // Check cooldown
  if (!canFireBlockoutWeapon(vehicle, nowMs)) return null;

  const weaponProfile = getWeaponProfile(weaponId);
  if (!weaponProfile) return null;

  const vfxProfile = getWeaponVfxProfile(weaponId);
  if (!vfxProfile) return null;

  const recoilProfile = RECOIL_PROFILES[weaponId];

  // Start recoil
  if (recoilProfile) {
    startRecoil(vehicle, recoilProfile, nowMs);
  }

  // Create VFX event
  const event: BlockoutWeaponVfxEvent = {
    id: nextVfxEventId++,
    weaponId,
    eventType,
    originX: barrelTipX,
    originY: barrelTipY,
    targetX: aimTargetX,
    targetY: aimTargetY,
    angle: aimAngle,
    createdAt: nowMs,
    durationMs: vfxProfile.durationMs,
    rangePx: weaponProfile.blockoutRangePx,
    impactRadiusPx: vfxProfile.impactRadiusPx ?? 0,
    coneAngleDeg: vfxProfile.coneAngleDeg ?? 0,
    bounceCount: vfxProfile.bounceCount ?? 0,
    pelletCount: vfxProfile.pelletCount ?? 0,
  };

  vfxEvents.push(event);

  // Update last fired timestamp
  vehicle.lastFiredAt = nowMs;

  return event;
}

// ─── Cooldown ────────────────────────────────────────────────────

/**
 * Check whether a blockout vehicle can fire (cooldown elapsed).
 *
 * @param vehicle - The vehicle to check
 * @param nowMs - Current timestamp
 * @returns true if cooldown has elapsed and the vehicle can fire
 */
export function canFireBlockoutWeapon(
  vehicle: BlockoutVehicleState,
  nowMs: number,
): boolean {
  const weaponProfile = getWeaponProfile(vehicle.weaponId);
  if (!weaponProfile) return false;

  if (vehicle.lastFiredAt === 0) return true; // Never fired

  const elapsed = nowMs - vehicle.lastFiredAt;
  return elapsed >= weaponProfile.blockoutCooldownMs;
}

// ─── Recoil ──────────────────────────────────────────────────────

/**
 * Start visual recoil for a blockout vehicle.
 *
 * Sets recoil fields on the vehicle state. Recoil decays over time
 * via updateBlockoutRecoil(). Recoil does NOT permanently change
 * turretTargetAngle or movement.
 */
function startRecoil(
  vehicle: BlockoutVehicleState,
  recoilProfile: RecoilProfile,
  nowMs: number,
): void {
  vehicle.recoilActive = true;
  vehicle.recoilStartedAt = nowMs;
  vehicle.recoilDurationMs = recoilProfile.recoveryMs;
  vehicle.recoilBarrelOffset = recoilProfile.barrelKickbackPx;
  vehicle.recoilTurretOffset = recoilProfile.turretKickbackRad;
  vehicle.recoilBodyOffset = recoilProfile.bodyImpulsePx;
}

/**
 * Update visual recoil for a blockout vehicle.
 *
 * Decays recoil offsets toward zero over recovery duration.
 * When fully recovered, clears recoil state.
 *
 * Must be called each frame. Does NOT change turretTargetAngle
 * or movement state.
 *
 * @param vehicle - Vehicle with active recoil
 * @param nowMs - Current timestamp
 */
export function updateBlockoutRecoil(
  vehicle: BlockoutVehicleState,
  nowMs: number,
): void {
  if (!vehicle.recoilActive) return;

  const elapsed = nowMs - vehicle.recoilStartedAt;
  const duration = vehicle.recoilDurationMs;

  if (elapsed >= duration) {
    // Recoil fully recovered
    vehicle.recoilActive = false;
    vehicle.recoilBarrelOffset = 0;
    vehicle.recoilTurretOffset = 0;
    vehicle.recoilBodyOffset = 0;
    return;
  }

  // Ease-out: decay from full to zero over duration
  const t = elapsed / duration;
  const decay = 1 - t;

  // Get original recoil values from profile
  const recoilProfile = RECOIL_PROFILES[vehicle.weaponId];
  if (!recoilProfile) {
    vehicle.recoilActive = false;
    return;
  }

  vehicle.recoilBarrelOffset = recoilProfile.barrelKickbackPx * decay;
  vehicle.recoilTurretOffset = recoilProfile.turretKickbackRad * decay;
  vehicle.recoilBodyOffset = recoilProfile.bodyImpulsePx * decay;
}

// ─── Continuous Fire (BLOCKOUT-06H+) ──────────────────────────────

/** Check if a weapon is a continuous-fire type. BLOCKOUT-06H+. */
export function isContinuousWeapon(weaponId: WeaponId): boolean {
  return weaponId === 'flamethrower' || weaponId === 'freeze' || weaponId === 'isida' || weaponId === 'vulcan' || weaponId === 'twins';
}

/** Start firing state for a vehicle. BLOCKOUT-06H+. */
export function startFiring(vehicle: BlockoutVehicleState): void {
  vehicle.fireHeld = true;
  vehicle.isFiring = true;
}

/** Stop firing state for a vehicle. BLOCKOUT-06H+. */
export function stopFiring(vehicle: BlockoutVehicleState): void {
  vehicle.fireHeld = false;
  vehicle.isFiring = false;
  vehicle.visualOverheat = 0;
}

/**
 * Tick continuous fire for a blockout vehicle.
 * BLOCKOUT-06H+: For Flamethrower, Freeze, Isida, Vulcan, Twins —
 * weapons that fire continuously while the key is held.
 *
 * Creates VFX events at the weapon's streamCadenceMs rate.
 * Returns the number of VFX events created this tick.
 *
 * @param vehicle - The vehicle firing
 * @param barrelTipX - Barrel tip X in screen-space pixels
 * @param barrelTipY - Barrel tip Y in screen-space pixels
 * @param aimAngle - Turret angle
 * @param aimTargetX - Aim target X
 * @param aimTargetY - Aim target Y
 * @param nowMs - Current Phaser scene time
 * @returns Number of VFX events created
 */
export function tickContinuousFire(
  vehicle: BlockoutVehicleState,
  barrelTipX: number,
  barrelTipY: number,
  aimAngle: number,
  aimTargetX: number,
  aimTargetY: number,
  nowMs: number,
): number {
  if (!vehicle.fireHeld || !vehicle.isFiring) return 0;

  const vfxProfile = getWeaponVfxProfile(vehicle.weaponId);
  if (!vfxProfile || !vfxProfile.streamCadenceMs) return 0; // Not a continuous weapon

  // Check if enough time has elapsed since last stream tick
  const elapsed = nowMs - vehicle.lastStreamTickAt;
  if (elapsed < vfxProfile.streamCadenceMs) return 0;

  // Fire a VFX event (this handles cooldown, recoil, etc.)
  const event = fireBlockoutWeapon(
    vehicle,
    barrelTipX,
    barrelTipY,
    aimAngle,
    aimTargetX,
    aimTargetY,
    nowMs,
  );

  if (event) {
    vehicle.lastStreamTickAt = nowMs;
    return 1;
  }

  return 0;
}
