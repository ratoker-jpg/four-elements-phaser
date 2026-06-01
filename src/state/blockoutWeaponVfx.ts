/**
 * Blockout weapon VFX system — pure TypeScript, no Phaser dependencies.
 *
 * BLOCKOUT-05H+: Visual-only firing, recoil, and weapon VFX for
 * Smoky / Railgun / Thunder in arena/dev mode.
 *
 * This module provides:
 * - VFX event creation and aging
 * - Recoil start/update/recovery
 * - Cooldown check
 *
 * All state is transient and NOT persisted in saves.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { RecoilProfile, WeaponId } from '../config/blockoutProfiles';
import { RECOIL_PROFILES } from '../config/blockoutRecoilData';
import { getWeaponVfxProfile } from '../config/blockoutVfxData';
import { getWeaponProfile } from '../config/blockoutWeaponData';

// ─── VFX Event ────────────────────────────────────────────────────

/** Weapon VFX event type. */
export type VfxEventType = 'smokyShot' | 'railgunLine' | 'thunderSplash';

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
 */
function getVfxEventType(weaponId: WeaponId): VfxEventType | null {
  switch (weaponId) {
    case 'smoky': return 'smokyShot';
    case 'railgun': return 'railgunLine';
    case 'thunder': return 'thunderSplash';
    default: return null; // Not implemented in this PR
  }
}

/**
 * Fire a weapon VFX event from a blockout vehicle.
 *
 * Creates a VFX event and starts recoil if the weapon is supported
 * (Smoky, Railgun, Thunder). Returns the created event or null if
 * the weapon is not implemented or cooldown has not elapsed.
 *
 * This function also checks cooldown. If the weapon is still on cooldown,
 * it returns null without creating a VFX event.
 *
 * @param vehicle - The firing vehicle
 * @param barrelTipX - Barrel tip X in screen-space pixels (with offset)
 * @param barrelTipY - Barrel tip Y in screen-space pixels (with offset)
 * @param aimAngle - Turret angle at time of fire
 * @param aimTargetX - Aim target X in screen-space pixels (with offset)
 * @param aimTargetY - Aim target Y in screen-space pixels (with offset)
 * @param nowMs - Current timestamp
 * @returns The VFX event, or null if weapon not implemented or on cooldown
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
  if (!eventType) return null; // Weapon not implemented in this PR

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
