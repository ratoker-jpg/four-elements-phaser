/**
 * Blockout damage system — pure TypeScript, no Phaser dependencies.
 *
 * BLOCKOUT-07H+: Dev/arena-only damage placeholders for blockout vehicles.
 *
 * This module provides:
 * - Damage event creation and aging
 * - Hit detection for all 9 damage kinds
 * - HP tracking and vehicle destruction
 * - Status tag management
 * - Continuous damage ticking
 *
 * All state is transient and NOT persisted in saves.
 * All timing uses passed-in nowMs (Phaser scene time), NEVER Date.now().
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { DamageProfile, DamageKind, WeaponId } from '../config/blockoutProfiles';
import type { BlockoutObstacleState } from './blockoutObstacleState';
import { isLineOfFireBlocked, findNearestObstacleBlockingLine } from './blockoutObstacles';
import { DAMAGE_PROFILES } from '../config/blockoutDamageData';
import { computeBodyWorldCenter, getBodyPixelSize } from '../phaser/render/blockoutVehicleGeometry';
import type { IsoPoint } from '../phaser/render/isometric';
import { getEffectiveDamageProfile, getIncomingDamageMultiplier, getCooldownMultiplier } from './blockoutUpgrades';
import { checkDirectHit, checkConeHit, findSplashTargets as findProjectedSplashTargets, getAimForgiveness, screenAngleToGroundAngle } from './combatHitModel';
import { getWeaponConfig } from '../config/weaponData';
import { getWeaponRangeInfo, groundDistanceTiles } from './combatRange';
import { TILE_W, TILE_H } from '../config/worldConfig';

// ─── Damage Event ──────────────────────────────────────────────────

/** Damage event for rendering. Transient — not persisted. */
export interface BlockoutDamageEvent {
  id: number;
  targetVehicleId: string;
  weaponId: WeaponId;
  amount: number;
  x: number;
  y: number;
  createdAt: number;
  durationMs: number;
  kind: DamageKind;
  statusTag?: string;
  isKill: boolean;
}

// ─── Module-level state ────────────────────────────────────────────

let damageEvents: BlockoutDamageEvent[] = [];
let nextDamageEventId = 1;

/** Default damage event display duration in ms. */
const DAMAGE_EVENT_DURATION_MS = 800;

// ─── Damage profile lookup ─────────────────────────────────────────

/** Get the damage profile for a weapon. BLOCKOUT-07H+. */
export function getBlockoutDamageProfile(weaponId: string): DamageProfile | undefined {
  return DAMAGE_PROFILES[weaponId];
}

// ─── Apply damage to a vehicle ─────────────────────────────────────

/**
 * Apply damage to a vehicle and return a damage event if damage was dealt.
 *
 * - If vehicle.isDestroyed, return null (no damage to dead vehicles).
 * - Applies incoming damage multiplier (armor_plating) to compute adjustedAmount.
 * - Reduces HP by adjustedAmount, clamped to 0.
 * - Sets lastDamagedAt and damageFlashUntil.
 * - If HP <= 0: sets isDestroyed, destroyedAt, clears fire/move state.
 * - Creates a damage event with adjustedAmount (matches actual HP loss).
 *
 * @param vehicle - Target vehicle (mutated in place)
 * @param weaponId - Weapon that dealt the damage
 * @param amount - Base damage amount (before armor adjustment)
 * @param x - World X of the hit point
 * @param y - World Y of the hit point
 * @param nowMs - Current scene time
 * @param kind - Damage kind
 * @param statusTag - Optional status tag
 * @returns Damage event, or null if vehicle is already destroyed
 */
export function applyDamageToVehicle(
  vehicle: BlockoutVehicleState,
  weaponId: WeaponId,
  amount: number,
  x: number,
  y: number,
  nowMs: number,
  kind: DamageKind,
  statusTag?: string,
): BlockoutDamageEvent | null {
  if (vehicle.isDestroyed) return null;

  // BLOCKOUT-09H: Apply incoming damage multiplier (armor plating reduces damage)
  const incomingMult = getIncomingDamageMultiplier(vehicle);
  const adjustedAmount = amount * incomingMult;

  // Apply damage
  vehicle.hp = Math.max(0, vehicle.hp - adjustedAmount);
  vehicle.lastDamagedAt = nowMs;
  vehicle.damageFlashUntil = nowMs + 200;

  // Add status tag
  if (statusTag && !vehicle.activeStatusTags.includes(statusTag)) {
    vehicle.activeStatusTags.push(statusTag);
  }

  // Check destruction
  const isKill = vehicle.hp <= 0;
  if (isKill) {
    vehicle.isDestroyed = true;
    vehicle.destroyedAt = nowMs;
    vehicle.fireHeld = false;
    vehicle.isFiring = false;
    vehicle.hasMoveTarget = false;
    vehicle.speed = 0;
    vehicle.vx = 0;
    vehicle.vy = 0;
  }

  // Create damage event — store adjustedAmount so the floating damage
  // number matches the actual HP loss (armor_plating reduces damage)
  const event: BlockoutDamageEvent = {
    id: nextDamageEventId++,
    targetVehicleId: vehicle.id,
    weaponId,
    amount: adjustedAmount,
    x,
    y,
    createdAt: nowMs,
    durationMs: DAMAGE_EVENT_DURATION_MS,
    kind,
    statusTag,
    isKill,
  };

  damageEvents.push(event);
  return event;
}

// ─── Geometry helpers ──────────────────────────────────────────────

/** Euclidean distance between two points. */
function pointDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance from point (px,py) to line segment (x1,y1)-(x2,y2). */
function distToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return pointDistance(px, py, x1, y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return pointDistance(px, py, projX, projY);
}

/** Check if a point is inside a cone from origin along aimAngle. */
function isPointInCone(
  px: number, py: number,
  originX: number, originY: number,
  aimAngle: number, rangePx: number, halfAngleRad: number,
): boolean {
  const dx = px - originX;
  const dy = py - originY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > rangePx) return false;

  const angleToPoint = Math.atan2(dy, dx);
  let angleDiff = angleToPoint - aimAngle;

  // Normalize to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  return Math.abs(angleDiff) <= halfAngleRad;
}

/** Get hit radius for a vehicle body. */
function getVehicleHitRadius(vehicle: BlockoutVehicleState): number {
  const bodySize = getBodyPixelSize(vehicle.bodyId);
  return Math.max(bodySize.w, bodySize.h) / 2 + 8; // 8px padding like input controller
}

// ─── Hit detection functions ───────────────────────────────────────

/**
 * Find the nearest non-destroyed, non-firing vehicle along aim line within tolerance and range.
 */
export function findDirectHitTarget(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  originX: number, originY: number,
  aimAngle: number, rangePx: number, tolerancePx: number,
  offset: IsoPoint,
): BlockoutVehicleState | null {
  const endX = originX + Math.cos(aimAngle) * rangePx;
  const endY = originY + Math.sin(aimAngle) * rangePx;

  let best: BlockoutVehicleState | null = null;
  let bestDist = Infinity;

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;
    if (vehicle.id === firingVehicle.id) continue;

    const bodyCenter = computeBodyWorldCenter(vehicle, offset);
    const hitRadius = getVehicleHitRadius(vehicle);
    const dist = distToLineSegment(bodyCenter.x, bodyCenter.y, originX, originY, endX, endY);

    if (dist <= hitRadius + tolerancePx) {
      // Check if within range
      const distFromOrigin = pointDistance(originX, originY, bodyCenter.x, bodyCenter.y);
      if (distFromOrigin <= rangePx + hitRadius && distFromOrigin < bestDist) {
        bestDist = distFromOrigin;
        best = vehicle;
      }
    }
  }

  return best;
}

/**
 * Find all non-destroyed vehicles within splash radius of impact point.
 */
export function findSplashTargets(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  impactX: number, impactY: number,
  radiusPx: number,
  offset: IsoPoint,
): BlockoutVehicleState[] {
  const result: BlockoutVehicleState[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;

    const bodyCenter = computeBodyWorldCenter(vehicle, offset);
    const hitRadius = getVehicleHitRadius(vehicle);
    const dist = pointDistance(impactX, impactY, bodyCenter.x, bodyCenter.y);

    if (dist <= radiusPx + hitRadius) {
      // Exclude firing vehicle only if selfDamageScale === 0
      if (vehicle.id === firingVehicle.id) {
        const profile = DAMAGE_PROFILES[firingVehicle.weaponId];
        if (profile && (profile.selfDamageScale ?? 0) === 0) continue;
      }
      result.push(vehicle);
    }
  }

  return result;
}

/**
 * Find all non-destroyed vehicles near aim line within range, sorted by distance, up to pierceCount.
 */
export function findPenetrationTargets(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  originX: number, originY: number,
  aimAngle: number, rangePx: number, tolerancePx: number,
  pierceCount: number,
  offset: IsoPoint,
): BlockoutVehicleState[] {
  const endX = originX + Math.cos(aimAngle) * rangePx;
  const endY = originY + Math.sin(aimAngle) * rangePx;

  const candidates: { vehicle: BlockoutVehicleState; dist: number }[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;
    if (vehicle.id === firingVehicle.id) continue;

    const bodyCenter = computeBodyWorldCenter(vehicle, offset);
    const hitRadius = getVehicleHitRadius(vehicle);
    const dist = distToLineSegment(bodyCenter.x, bodyCenter.y, originX, originY, endX, endY);

    if (dist <= hitRadius + tolerancePx) {
      const distFromOrigin = pointDistance(originX, originY, bodyCenter.x, bodyCenter.y);
      if (distFromOrigin <= rangePx + hitRadius) {
        candidates.push({ vehicle, dist: distFromOrigin });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, pierceCount).map(c => c.vehicle);
}

/**
 * Find all non-destroyed vehicles inside cone from origin along aimAngle.
 */
export function findConeTargets(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  originX: number, originY: number,
  aimAngle: number, rangePx: number, coneAngleDeg: number,
  offset: IsoPoint,
): BlockoutVehicleState[] {
  const halfAngleRad = (coneAngleDeg * Math.PI) / 180;
  const result: BlockoutVehicleState[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;
    if (vehicle.id === firingVehicle.id) continue;

    const bodyCenter = computeBodyWorldCenter(vehicle, offset);
    if (isPointInCone(bodyCenter.x, bodyCenter.y, originX, originY, aimAngle, rangePx, halfAngleRad)) {
      result.push(vehicle);
    }
  }

  return result;
}

/**
 * Find all non-destroyed vehicles along beam line within range.
 */
export function findBeamTargets(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  originX: number, originY: number,
  aimAngle: number, rangePx: number, tolerancePx: number,
  offset: IsoPoint,
): BlockoutVehicleState[] {
  // Similar to penetration but targets all along beam
  const endX = originX + Math.cos(aimAngle) * rangePx;
  const endY = originY + Math.sin(aimAngle) * rangePx;

  const result: BlockoutVehicleState[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;
    if (vehicle.id === firingVehicle.id) continue;

    const bodyCenter = computeBodyWorldCenter(vehicle, offset);
    const hitRadius = getVehicleHitRadius(vehicle);
    const dist = distToLineSegment(bodyCenter.x, bodyCenter.y, originX, originY, endX, endY);

    if (dist <= hitRadius + tolerancePx) {
      const distFromOrigin = pointDistance(originX, originY, bodyCenter.x, bodyCenter.y);
      if (distFromOrigin <= rangePx + hitRadius) {
        result.push(vehicle);
      }
    }
  }

  return result;
}

/**
 * Cast pelletCount rays evenly spread within cone, each hits nearest vehicle.
 */
export function findShotgunTargets(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  originX: number, originY: number,
  aimAngle: number, rangePx: number, coneAngleDeg: number, pelletCount: number,
  offset: IsoPoint,
): { vehicle: BlockoutVehicleState; pelletIndex: number }[] {
  const halfAngleRad = (coneAngleDeg * Math.PI) / 180;
  const result: { vehicle: BlockoutVehicleState; pelletIndex: number }[] = [];

  for (let i = 0; i < pelletCount; i++) {
    const fraction = pelletCount > 1 ? i / (pelletCount - 1) : 0.5;
    const pelletAngle = aimAngle - halfAngleRad + fraction * 2 * halfAngleRad;
    const endX = originX + Math.cos(pelletAngle) * rangePx;
    const endY = originY + Math.sin(pelletAngle) * rangePx;

    let best: BlockoutVehicleState | null = null;
    let bestDist = Infinity;

    for (const vehicle of vehicles) {
      if (vehicle.isDestroyed) continue;
      if (vehicle.id === firingVehicle.id) continue;

      const bodyCenter = computeBodyWorldCenter(vehicle, offset);
      const hitRadius = getVehicleHitRadius(vehicle);
      const dist = distToLineSegment(bodyCenter.x, bodyCenter.y, originX, originY, endX, endY);

      if (dist <= hitRadius) {
        const distFromOrigin = pointDistance(originX, originY, bodyCenter.x, bodyCenter.y);
        if (distFromOrigin <= rangePx + hitRadius && distFromOrigin < bestDist) {
          bestDist = distFromOrigin;
          best = vehicle;
        }
      }
    }

    if (best) {
      result.push({ vehicle: best, pelletIndex: i });
    }
  }

  return result;
}

/**
 * Deterministic segmented path (same algorithm as VFX renderer), hit vehicles near segments.
 */
export function findRicochetTargets(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  originX: number, originY: number,
  aimAngle: number, rangePx: number, bounceCount: number,
  offset: IsoPoint,
): BlockoutVehicleState[] {
  // Build the path segments with deterministic bounces (same as VFX renderer)
  const segmentLength = rangePx / (bounceCount + 1);
  let currentAngle = aimAngle;
  let currentX = originX;
  let currentY = originY;

  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let i = 0; i < bounceCount; i++) {
    const nextX = currentX + Math.cos(currentAngle) * segmentLength;
    const nextY = currentY + Math.sin(currentAngle) * segmentLength;
    segments.push({ x1: currentX, y1: currentY, x2: nextX, y2: nextY });

    // Bounce: deterministic offset based on firing vehicle
    const bounceDelta = ((1 * 31 + i * 17) % 60 - 30) * (Math.PI / 180);
    currentAngle = currentAngle + bounceDelta;
    currentX = nextX;
    currentY = nextY;
  }

  // Final segment
  const finalX = currentX + Math.cos(currentAngle) * segmentLength;
  const finalY = currentY + Math.sin(currentAngle) * segmentLength;
  segments.push({ x1: currentX, y1: currentY, x2: finalX, y2: finalY });

  const hitVehicleIds = new Set<string>();
  const result: BlockoutVehicleState[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.isDestroyed) continue;
    if (vehicle.id === firingVehicle.id) continue;
    if (hitVehicleIds.has(vehicle.id)) continue;

    const bodyCenter = computeBodyWorldCenter(vehicle, offset);
    const hitRadius = getVehicleHitRadius(vehicle);

    for (const seg of segments) {
      const dist = distToLineSegment(bodyCenter.x, bodyCenter.y, seg.x1, seg.y1, seg.x2, seg.y2);
      if (dist <= hitRadius) {
        hitVehicleIds.add(vehicle.id);
        result.push(vehicle);
        break;
      }
    }
  }

  return result;
}

// ─── Main damage application entry point ───────────────────────────

/**
 * Apply weapon damage based on damage profile.
 * Main entry point for single-shot weapons.
 *
 * CORE-STEP-07H+ FIXUP-2:
 * - Blocker 1: aimAngle (screen-space turret angle) is converted to ground-plane
 *   angle before calling hit model functions, so checkDirectHit/checkConeHit
 *   compare like-for-like with the tile-space atan2 they compute internally.
 * - Blocker 2: For production-config weapons, the projected hit model is the
 *   primary candidate selector. Old screen-space findDirectHitTarget is only
 *   used as fallback for weapons without production config.
 *
 * @returns Array of damage events created
 */
export function applyBlockoutWeaponDamage(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  barrelTipX: number, barrelTipY: number,
  aimAngle: number,
  aimTargetX: number, aimTargetY: number,
  offset: IsoPoint,
  nowMs: number,
  obstacles: BlockoutObstacleState[] = [],
): BlockoutDamageEvent[] {
  // BLOCKOUT-09H: Use effective damage profile (weapon tuning + range extender)
  const baseProfile = DAMAGE_PROFILES[firingVehicle.weaponId];
  if (!baseProfile) return [];
  const profile = getEffectiveDamageProfile(firingVehicle, baseProfile);

  const damageKind = profile.damageKind;
  if (!damageKind) return [];

  const rangePx = profile.rangePx ?? 200;
  const events: BlockoutDamageEvent[] = [];

  // CORE-STEP-07H+: When weapon has a production config, use projected hit model
  const weaponCfg = getWeaponConfig(firingVehicle.weaponId);

  // FIXUP-2 Blocker 1: Convert screen-space aimAngle to ground-plane aimAngle.
  // aimAngle comes from vehicle.turretAngle which is screen-space (computed from
  // projected screen coordinates). The hit model functions compare aimAngle with
  // atan2 of tile deltas, so we must convert to ground-plane first.
  const groundAimAngle = screenAngleToGroundAngle(aimAngle);

  switch (damageKind) {
    case 'direct': {
      if (weaponCfg) {
        // FIXUP-2 Blocker 2: Iterate all enemy candidates using projected hit model
        // as source of truth. Choose nearest valid hit by ground-plane distance.
        let bestTarget: BlockoutVehicleState | null = null;
        let bestDist = Infinity;
        for (const vehicle of vehicles) {
          if (vehicle.isDestroyed || vehicle.id === firingVehicle.id) continue;
          const hitResult = checkDirectHit(firingVehicle, vehicle, groundAimAngle, firingVehicle.weaponId);
          if (hitResult.isHit) {
            const dist = groundDistanceTiles(firingVehicle, vehicle);
            if (dist < bestDist) {
              bestDist = dist;
              bestTarget = vehicle;
            }
          }
        }
        if (bestTarget) {
          const bodyCenter = computeBodyWorldCenter(bestTarget, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            break;
          }
          const amount = profile.directDamage ?? 20;
          const event = applyDamageToVehicle(bestTarget, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'direct');
          if (event) events.push(event);
        }
      } else {
        // Old screen-space path (fallback for weapons without production config)
        const target = findDirectHitTarget(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, 0, offset);
        if (target) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            break;
          }
          const amount = profile.directDamage ?? 20;
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'direct');
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'splash': {
      // Impact point is at aimTarget or range end along aimAngle
      const impactDist = pointDistance(barrelTipX, barrelTipY, aimTargetX, aimTargetY);
      let impactX: number, impactY: number;
      if (impactDist <= rangePx) {
        impactX = aimTargetX;
        impactY = aimTargetY;
      } else {
        impactX = barrelTipX + Math.cos(aimAngle) * rangePx;
        impactY = barrelTipY + Math.sin(aimAngle) * rangePx;
      }

      // BLOCKOUT-08H: If line to impact is blocked, impact point becomes obstacle intersection
      if (obstacles.length > 0) {
        const blocker = findNearestObstacleBlockingLine(obstacles, barrelTipX, barrelTipY, impactX, impactY);
        if (blocker) {
          impactX = blocker.x;
          impactY = blocker.y;
        }
      }

      if (weaponCfg) {
        // Projected splash hit model path
        // Convert screen-space impact to tile coordinates using isometric inverse projection
        const impactNoOffsetX = impactX - offset.x;
        const impactNoOffsetY = impactY - offset.y;
        const halfW = TILE_W / 2;
        const halfH = TILE_H / 2;
        const impactTileX = (impactNoOffsetX / halfW + impactNoOffsetY / halfH) / 2;
        const impactTileY = (impactNoOffsetY / halfH - impactNoOffsetX / halfW) / 2;
        const forgiveness = getAimForgiveness(firingVehicle.weaponId);
        const splashRadiusTiles = forgiveness.splashRadiusTiles || weaponCfg.damage.splashRadius;
        const splashTargets = findProjectedSplashTargets(firingVehicle.id, vehicles, impactTileX, impactTileY, splashRadiusTiles, weaponCfg.damage.selfDamageScale ?? 0);
        const baseAmount = profile.directDamage ?? 25;
        for (const target of splashTargets) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          let amount = baseAmount;
          if (profile.splashFalloff) {
            const dist = pointDistance(impactX, impactY, bodyCenter.x, bodyCenter.y);
            const radius = profile.radiusPx ?? 60;
            const falloff = 1 - (dist / radius) * 0.5;
            amount = Math.round(baseAmount * falloff);
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'splash');
          if (event) events.push(event);
        }
      } else {
        // Old screen-space path
        const targets = findSplashTargets(firingVehicle, vehicles, impactX, impactY, profile.radiusPx ?? 60, offset);
        const baseAmount = profile.directDamage ?? 25;
        for (const target of targets) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          let amount = baseAmount;
          if (profile.splashFalloff) {
            const dist = pointDistance(impactX, impactY, bodyCenter.x, bodyCenter.y);
            const radius = profile.radiusPx ?? 60;
            const falloff = 1 - (dist / radius) * 0.5;
            amount = Math.round(baseAmount * falloff);
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'splash');
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'penetration': {
      if (weaponCfg) {
        // FIXUP-2 Blocker 2: Iterate all candidates, apply projected hit check,
        // sort by ground-plane distance, apply pierceCount.
        const candidates: { vehicle: BlockoutVehicleState; dist: number }[] = [];
        for (const vehicle of vehicles) {
          if (vehicle.isDestroyed || vehicle.id === firingVehicle.id) continue;
          const hitResult = checkDirectHit(firingVehicle, vehicle, groundAimAngle, firingVehicle.weaponId);
          if (hitResult.isHit) {
            const dist = groundDistanceTiles(firingVehicle, vehicle);
            candidates.push({ vehicle, dist });
          }
        }
        candidates.sort((a, b) => a.dist - b.dist);
        const pierceCount = profile.pierceCount ?? 3;
        const amount = profile.directDamage ?? 40;
        for (const candidate of candidates.slice(0, pierceCount)) {
          const target = candidate.vehicle;
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y, true)) {
            continue;
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'penetration');
          if (event) events.push(event);
        }
      } else {
        // Old screen-space path
        const targets = findPenetrationTargets(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, 0, profile.pierceCount ?? 3, offset);
        const amount = profile.directDamage ?? 40;
        for (const target of targets) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y, true)) {
            continue;
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'penetration');
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'cone_tick': {
      if (weaponCfg) {
        // Projected hit model path: use checkConeHit with ground-plane aimAngle
        const forgiveness = getAimForgiveness(firingVehicle.weaponId);
        const rangeInfo = getWeaponRangeInfo(firingVehicle.weaponId);
        const dps = profile.damagePerSecond ?? 30;
        const tickMs = profile.tickMs ?? 50;
        const amount = dps * tickMs / 1000;
        for (const vehicle of vehicles) {
          if (vehicle.isDestroyed || vehicle.id === firingVehicle.id) continue;
          if (checkConeHit(firingVehicle, vehicle, groundAimAngle, forgiveness.coneHalfAngleDeg, rangeInfo.maxRange)) {
            const bodyCenter = computeBodyWorldCenter(vehicle, offset);
            if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) continue;
            const event = applyDamageToVehicle(vehicle, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'cone_tick', profile.statusTag);
            if (event) events.push(event);
          }
        }
      } else {
        // Old screen-space path
        const targets = findConeTargets(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, profile.coneAngleDeg ?? 25, offset);
        const dps = profile.damagePerSecond ?? 30;
        const tickMs = profile.tickMs ?? 50;
        const amount = dps * tickMs / 1000;
        for (const target of targets) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            continue;
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'cone_tick', profile.statusTag);
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'beam_tick': {
      if (weaponCfg) {
        // Projected hit model path: use checkDirectHit with ground-plane aimAngle
        const dps = profile.damagePerSecond ?? 25;
        const tickMs = profile.tickMs ?? 50;
        const amount = dps * tickMs / 1000;
        for (const vehicle of vehicles) {
          if (vehicle.isDestroyed || vehicle.id === firingVehicle.id) continue;
          const hitResult = checkDirectHit(firingVehicle, vehicle, groundAimAngle, firingVehicle.weaponId);
          if (hitResult.isHit) {
            const bodyCenter = computeBodyWorldCenter(vehicle, offset);
            if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) continue;
            const event = applyDamageToVehicle(vehicle, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'beam_tick', profile.statusTag);
            if (event) events.push(event);
          }
        }
      } else {
        // Old screen-space path
        const targets = findBeamTargets(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, 0, offset);
        const dps = profile.damagePerSecond ?? 25;
        const tickMs = profile.tickMs ?? 50;
        const amount = dps * tickMs / 1000;
        for (const target of targets) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            continue;
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'beam_tick', profile.statusTag);
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'rapid_tick': {
      if (weaponCfg) {
        // FIXUP-2 Blocker 2: Use projected hit model as primary selector
        let bestTarget: BlockoutVehicleState | null = null;
        let bestDist = Infinity;
        for (const vehicle of vehicles) {
          if (vehicle.isDestroyed || vehicle.id === firingVehicle.id) continue;
          const hitResult = checkDirectHit(firingVehicle, vehicle, groundAimAngle, firingVehicle.weaponId);
          if (hitResult.isHit) {
            const dist = groundDistanceTiles(firingVehicle, vehicle);
            if (dist < bestDist) {
              bestDist = dist;
              bestTarget = vehicle;
            }
          }
        }
        if (bestTarget) {
          const bodyCenter = computeBodyWorldCenter(bestTarget, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            break;
          }
          const amount = profile.directDamage ?? 5;
          const event = applyDamageToVehicle(bestTarget, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'rapid_tick', profile.statusTag);
          if (event) events.push(event);
        }
      } else {
        // Old screen-space path
        const target = findDirectHitTarget(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, 0, offset);
        if (target) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            break;
          }
          const amount = profile.directDamage ?? 5;
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'rapid_tick', profile.statusTag);
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'plasma': {
      if (weaponCfg) {
        // FIXUP-2 Blocker 2: Use projected hit model as primary selector
        let bestTarget: BlockoutVehicleState | null = null;
        let bestDist = Infinity;
        for (const vehicle of vehicles) {
          if (vehicle.isDestroyed || vehicle.id === firingVehicle.id) continue;
          const hitResult = checkDirectHit(firingVehicle, vehicle, groundAimAngle, firingVehicle.weaponId);
          if (hitResult.isHit) {
            const dist = groundDistanceTiles(firingVehicle, vehicle);
            if (dist < bestDist) {
              bestDist = dist;
              bestTarget = vehicle;
            }
          }
        }
        if (bestTarget) {
          const bodyCenter = computeBodyWorldCenter(bestTarget, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            break;
          }
          const amount = profile.directDamage ?? 12;
          const event = applyDamageToVehicle(bestTarget, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'plasma', profile.statusTag);
          if (event) events.push(event);
        }
      } else {
        // Old screen-space path
        const target = findDirectHitTarget(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, 0, offset);
        if (target) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            break;
          }
          const amount = profile.directDamage ?? 12;
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'plasma', profile.statusTag);
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'ricochet': {
      if (weaponCfg) {
        // Projected hit model path: validate ricochet targets with checkDirectHit
        // using ground-plane aimAngle
        const bounceCount = 2;
        const targets = findRicochetTargets(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, bounceCount, offset);
        const amount = profile.directDamage ?? 18;
        for (const target of targets) {
          const hitResult = checkDirectHit(firingVehicle, target, groundAimAngle, firingVehicle.weaponId);
          if (!hitResult.isHit) continue;
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            continue;
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'ricochet', profile.statusTag);
          if (event) events.push(event);
        }
      } else {
        // Old screen-space path
        const bounceCount = 2;
        const targets = findRicochetTargets(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, bounceCount, offset);
        const amount = profile.directDamage ?? 18;
        for (const target of targets) {
          const bodyCenter = computeBodyWorldCenter(target, offset);
          if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) {
            continue;
          }
          const event = applyDamageToVehicle(target, firingVehicle.weaponId, amount, bodyCenter.x, bodyCenter.y, nowMs, 'ricochet', profile.statusTag);
          if (event) events.push(event);
        }
      }
      break;
    }

    case 'shotgun': {
      if (weaponCfg) {
        // Projected hit model path: use checkConeHit for each pellet
        // FIXUP-2 Blocker 1: Convert each pellet's screen-space angle to ground-plane
        const forgiveness = getAimForgiveness(firingVehicle.weaponId);
        const rangeInfo = getWeaponRangeInfo(firingVehicle.weaponId);
        const totalDamage = profile.directDamage ?? 35;
        const pelletCount = profile.pelletCount ?? 5;
        const damagePerPellet = totalDamage / pelletCount;
        const halfAngleRad = ((profile.coneAngleDeg ?? 30) * Math.PI) / 180;
        for (let i = 0; i < pelletCount; i++) {
          const fraction = pelletCount > 1 ? i / (pelletCount - 1) : 0.5;
          const pelletScreenAngle = aimAngle - halfAngleRad + fraction * 2 * halfAngleRad;
          const pelletGroundAngle = screenAngleToGroundAngle(pelletScreenAngle);
          for (const vehicle of vehicles) {
            if (vehicle.isDestroyed || vehicle.id === firingVehicle.id) continue;
            if (checkConeHit(firingVehicle, vehicle, pelletGroundAngle, forgiveness.coneHalfAngleDeg, rangeInfo.maxRange)) {
              const bodyCenter = computeBodyWorldCenter(vehicle, offset);
              if (obstacles.length > 0 && isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, bodyCenter.x, bodyCenter.y)) continue;
              const event = applyDamageToVehicle(vehicle, firingVehicle.weaponId, damagePerPellet, bodyCenter.x, bodyCenter.y, nowMs, 'shotgun');
              if (event) events.push(event);
              break; // Each pellet hits at most one vehicle
            }
          }
        }
      } else {
        // Old screen-space path
        const pelletHits = findShotgunTargets(firingVehicle, vehicles, barrelTipX, barrelTipY, aimAngle, rangePx, profile.coneAngleDeg ?? 30, profile.pelletCount ?? 5, offset);
        const totalDamage = profile.directDamage ?? 35;
        const pelletCount = profile.pelletCount ?? 5;
        const damagePerPellet = totalDamage / pelletCount;
        for (const hit of pelletHits) {
          const bodyCenter = computeBodyWorldCenter(hit.vehicle, offset);
          if (obstacles.length > 0) {
            const halfAngleRad = ((profile.coneAngleDeg ?? 30) * Math.PI) / 180;
            const fraction = pelletCount > 1 ? hit.pelletIndex / (pelletCount - 1) : 0.5;
            const pelletAngle = aimAngle - halfAngleRad + fraction * 2 * halfAngleRad;
            const pelletEndX = barrelTipX + Math.cos(pelletAngle) * rangePx;
            const pelletEndY = barrelTipY + Math.sin(pelletAngle) * rangePx;
            if (isLineOfFireBlocked(obstacles, barrelTipX, barrelTipY, pelletEndX, pelletEndY)) {
              continue;
            }
          }
          const event = applyDamageToVehicle(hit.vehicle, firingVehicle.weaponId, damagePerPellet, bodyCenter.x, bodyCenter.y, nowMs, 'shotgun');
          if (event) events.push(event);
        }
      }
      break;
    }
  }

  return events;
}

// ─── Continuous damage tick ────────────────────────────────────────

/**
 * Tick continuous damage for a firing vehicle.
 * BLOCKOUT-07H+ fixup: Uses lastDamageTickAt (separate from lastStreamTickAt)
 * so VFX cadence and damage cadence do not block each other.
 *
 * @returns Array of damage events created
 */
export function tickContinuousDamage(
  firingVehicle: BlockoutVehicleState,
  vehicles: BlockoutVehicleState[],
  barrelTipX: number, barrelTipY: number,
  aimAngle: number,
  aimTargetX: number, aimTargetY: number,
  offset: IsoPoint,
  nowMs: number,
  obstacles: BlockoutObstacleState[] = [],
): BlockoutDamageEvent[] {
  if (!firingVehicle.fireHeld || !firingVehicle.isFiring) return [];
  if (firingVehicle.isDestroyed) return [];

  // BLOCKOUT-09H: Use effective damage profile (weapon tuning + range extender)
  const baseProfile = DAMAGE_PROFILES[firingVehicle.weaponId];
  if (!baseProfile) return [];
  const profile = getEffectiveDamageProfile(firingVehicle, baseProfile);

  // Only tick for continuous damage kinds
  const continuousKinds: DamageKind[] = ['cone_tick', 'beam_tick', 'rapid_tick', 'plasma'];
  if (!profile.damageKind || !continuousKinds.includes(profile.damageKind)) return [];

  const tickMs = profile.tickMs ?? 50;
  // BLOCKOUT-09H fixup: Apply cooldown multiplier to damage tick cadence
  // weapon_tuning (-5% per level) and cooling_system (-10% per level)
  const effectiveTickMs = tickMs * getCooldownMultiplier(firingVehicle);
  const elapsed = nowMs - firingVehicle.lastDamageTickAt;
  if (elapsed < effectiveTickMs) return [];

  // Apply damage using the main function (it handles the kind-specific logic)
  const events = applyBlockoutWeaponDamage(
    firingVehicle, vehicles,
    barrelTipX, barrelTipY, aimAngle,
    aimTargetX, aimTargetY,
    offset, nowMs,
    obstacles,
  );

  // Update damage cadence timestamp only if damage was applied
  if (events.length > 0) {
    firingVehicle.lastDamageTickAt = nowMs;
  }

  return events;
}

// ─── Damage event management ───────────────────────────────────────

/** Remove expired damage events based on current time. */
export function expireDamageEvents(nowMs: number): void {
  damageEvents = damageEvents.filter(e => (nowMs - e.createdAt) < e.durationMs);
}

/** Get all active damage events. */
export function getDamageEvents(): ReadonlyArray<BlockoutDamageEvent> {
  return damageEvents;
}

/** Clear all damage events. */
export function clearDamageEvents(): void {
  damageEvents = [];
}

/** Reset damage event ID counter (for tests). */
export function resetDamageEventIdCounter(): void {
  nextDamageEventId = 1;
  damageEvents = [];
}
