/**
 * blockoutToModularVisual — MODULAR-RUNTIME-03A mapper.
 *
 * Translates BlockoutVehicleState fields into a ModularVehicleVisual
 * used by the live modular rendering path.
 *
 * Mapping rules:
 *   bodyId → hullId           (identity: wasp→wasp, hornet→hornet, …)
 *   weaponId → turretId       (smoky→smoky, vulcan→vulcan_b, …)
 *   faction → faction         (identity)
 *   modificationLevel → hullMod / turretMod  (0→m0, 1→m1, 2→m2, 3→m3)
 *
 * Direction mapping:
 *   bodyAngle (radians) → hullDir16  via gridBodyAngleToModularDir16
 *   turretAngle (radians) → turretDir16  via screenAngleToModularDir16
 *
 * ARENA-VISUAL-COMBAT-FIX-01 fixup-4: hull and turret now use SEPARATE
 * angle-to-dir16 functions. Hull body angles come from grid movement
 * (directionToAngle convention) and need +π/2 offset. Turret angles
 * are screen-space and need +π/4 offset. Previously a single
 * runtimeAngleToDir16 was shared, causing hull direction to be wrong.
 *
 * This module is engine-agnostic and unit-testable without Phaser.
 */

import type { BodyId, WeaponId } from '../config/blockoutProfiles';
import type { Faction } from '../state/types';
import {
  GENERATED_MODULAR_HULLS,
  GENERATED_MODULAR_TURRETS,
  GENERATED_MODULAR_FACTIONS,
  type GeneratedModularHullId,
  type GeneratedModularTurretId,
  type GeneratedModularFactionId,
  type GeneratedModularDir16,
} from '../assets/generatedModularVehicleAssets.generated';
import type { ModularVehicleVisual, ModularHullId, ModularTurretId, ModularFactionId, ModularModId } from './modularVehicleVisual';
import { modLevelToModularMod } from './modularVehicleVisual';

// ─── Body ID → Hull ID mapping ─────────────────────────────────────

/**
 * Maps a BlockoutVehicleState bodyId to the modular hull id.
 * Identity mapping for all 7 accepted hulls.
 * Returns null when the bodyId has no modular asset.
 */
export function bodyIdToModularHullId(bodyId: BodyId): ModularHullId | null {
  const candidate = bodyId as string;
  if (GENERATED_MODULAR_HULLS.includes(candidate as GeneratedModularHullId)) {
    return candidate as ModularHullId;
  }
  return null;
}

// ─── Weapon ID → Turret ID mapping ─────────────────────────────────

/**
 * WeaponId → GeneratedModularTurretId mapping.
 *
 * Most weapon IDs map directly. Two exceptions:
 *   - 'flamethrower' → 'firebird'  (the turret asset uses firebird naming)
 *   - 'vulcan'       → 'vulcan_b'  (the turret asset uses vulcan_b naming)
 */
const WEAPON_TO_TURRET_MAP: Record<string, GeneratedModularTurretId> = {
  smoky: 'smoky',
  thunder: 'thunder',
  railgun: 'railgun',
  shaft: 'railgun',     // shaft has no dedicated turret yet — fall back to railgun
  flamethrower: 'firebird',
  freeze: 'freeze',
  isida: 'isida',
  vulcan: 'vulcan_b',
  twins: 'twins',
  ricochet: 'ricochet',
  hammer: 'hammer',
};

/**
 * Maps a BlockoutVehicleState weaponId to the modular turret id.
 * Returns null when the weaponId has no modular asset.
 */
export function weaponIdToModularTurretId(weaponId: WeaponId): ModularTurretId | null {
  const mapped = WEAPON_TO_TURRET_MAP[weaponId];
  if (mapped && GENERATED_MODULAR_TURRETS.includes(mapped)) {
    return mapped as ModularTurretId;
  }
  return null;
}

// ─── Faction mapping ───────────────────────────────────────────────

/**
 * Maps a runtime Faction to the modular faction id.
 * Identity mapping for all 4 accepted factions.
 * Returns null when the faction has no modular asset.
 */
export function factionToModularFactionId(faction: Faction): ModularFactionId | null {
  const candidate = faction as string;
  if (GENERATED_MODULAR_FACTIONS.includes(candidate as GeneratedModularFactionId)) {
    return candidate as ModularFactionId;
  }
  return null;
}

// ─── Angle → dir16 conversion ──────────────────────────────────────

/**
 * Rotation offset for screen-space angles (turret aim, free-movement body).
 *
 * Denis-provided visual truth map for modular assets:
 *   dir0  = screen top-right   (NE)
 *   dir4  = screen bottom-right (SE)
 *   dir8  = screen bottom-left  (SW)
 *   dir12 = screen top-left     (NW)
 *
 * Runtime screen-space angle convention (Phaser, Y-down):
 *   0     = screen right    (E)
 *   π/4   = screen down-right (SE)
 *   3π/4  = screen down-left  (SW)
 *   5π/4  = screen up-left    (NW)
 *   7π/4  = screen up-right   (NE)
 *
 * Adding π/4 to the runtime screen angle aligns it with the asset dir16 indices:
 *   angle 7π/4 + π/4 = 2π  → dir0  (NE) ✓
 *   angle π/4  + π/4 = π/2 → dir4  (SE) ✓
 *   angle 3π/4 + π/4 = π   → dir8  (SW) ✓
 *   angle 5π/4 + π/4 = 3π/2→ dir12 (NW) ✓
 */
const SCREEN_ANGLE_OFFSET = Math.PI / 4;

/**
 * Rotation offset for grid-body angles.
 *
 * Grid movement uses `directionToAngle()` which maps cardinal tile directions
 * to screen-cardinal angles (N→-π/2, E→0, S→π/2, W→π). In isometric view,
 * tile-east visually appears as screen bottom-right (SE), tile-south as
 * screen bottom-left (SW), etc. This requires an additional π/4 rotation
 * on top of the screen-angle offset, totaling π/2.
 *
 * Denis truth map for hull movement:
 *   grid east / angle 0    → dir4  (SE) ✓   (0 + π/2) / step = 4
 *   grid south / angle π/2 → dir8  (SW) ✓   (π/2 + π/2) / step = 8
 *   grid west / angle π    → dir12 (NW) ✓   (π + π/2) / step = 12
 *   grid north / angle -π/2→ dir0  (NE) ✓   (-π/2 + π/2) / step = 0
 */
const GRID_BODY_ANGLE_OFFSET = Math.PI / 2;

/**
 * Converts a screen-space angle (turret aim, free-movement body) to dir16.
 *
 * Use for:
 *   - turretAngle → turretDir16 (turret tracks screen aim direction)
 *   - bodyAngle from free-movement (Math.atan2 of screen-space dx/dy)
 *
 * Applies +π/4 offset so runtime screen angles map to correct dir16
 * per the Denis truth map. Each direction spans π/8 radians.
 */
export function screenAngleToModularDir16(angleRad: number): GeneratedModularDir16 {
  let a = (angleRad + SCREEN_ANGLE_OFFSET) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  const step = (2 * Math.PI) / 16;
  const idx = Math.round(a / step) % 16;
  return idx as GeneratedModularDir16;
}

/**
 * Converts a grid-body angle to dir16.
 *
 * Use for:
 *   - bodyAngle from grid movement (directionToAngle() convention)
 *
 * Grid-body angles use a different convention than screen-space angles:
 * directionToAngle() maps cardinal tile directions to screen-cardinal
 * angles without the isometric rotation. Adding +π/2 total offset
 * accounts for both the screen→dir16 alignment and the isometric
 * rotation, mapping grid directions to the correct visual dir16.
 *
 * Denis truth map verification:
 *   grid east  (angle 0)     → dir4  (SE) ✓
 *   grid south (angle π/2)  → dir8  (SW) ✓
 *   grid west  (angle π)    → dir12 (NW) ✓
 *   grid north (angle -π/2) → dir0  (NE) ✓
 */
export function gridBodyAngleToModularDir16(angleRad: number): GeneratedModularDir16 {
  let a = (angleRad + GRID_BODY_ANGLE_OFFSET) % (2 * Math.PI);
  if (a < 0 || Object.is(a, -0)) a += 2 * Math.PI;
  const step = (2 * Math.PI) / 16;
  const idx = Math.round(a / step) % 16;
  return idx as GeneratedModularDir16;
}

/**
 * @deprecated Use screenAngleToModularDir16() or gridBodyAngleToModularDir16()
 * instead. This function does not distinguish between screen-space (turret)
 * and grid-body (hull) angle conventions.
 *
 * Preserved for backward compatibility; delegates to screenAngleToModularDir16.
 */
export function runtimeAngleToDir16(angleRad: number): GeneratedModularDir16 {
  return screenAngleToModularDir16(angleRad);
}

// ─── Full mapper ───────────────────────────────────────────────────

export interface BlockoutToModularResult {
  /** The resolved ModularVehicleVisual, or null when unmappable. */
  visual: ModularVehicleVisual | null;
  /** Hull dir16 derived from bodyAngle. */
  hullDir16: GeneratedModularDir16;
  /** Turret dir16 derived from turretAngle. */
  turretDir16: GeneratedModularDir16;
  /** Why the mapping failed (null on success). */
  failReason: string | null;
}

/**
 * Maps a BlockoutVehicleState to the modular rendering parameters.
 *
 * Returns the ModularVehicleVisual + computed dir16 values.
 * When any mapping fails, returns null visual with a failReason.
 */
export function blockoutToModularVisual(args: {
  bodyId: BodyId;
  weaponId: WeaponId;
  faction: Faction;
  modificationLevel: number;
  bodyAngle: number;
  turretAngle: number;
}): BlockoutToModularResult {
  const hullId = bodyIdToModularHullId(args.bodyId);
  const turretId = weaponIdToModularTurretId(args.weaponId);
  const factionId = factionToModularFactionId(args.faction);

  if (!hullId) {
    return {
      visual: null,
      hullDir16: gridBodyAngleToModularDir16(args.bodyAngle),
      turretDir16: screenAngleToModularDir16(args.turretAngle),
      failReason: `no modular hull for bodyId=${args.bodyId}`,
    };
  }
  if (!turretId) {
    return {
      visual: null,
      hullDir16: gridBodyAngleToModularDir16(args.bodyAngle),
      turretDir16: screenAngleToModularDir16(args.turretAngle),
      failReason: `no modular turret for weaponId=${args.weaponId}`,
    };
  }
  if (!factionId) {
    return {
      visual: null,
      hullDir16: gridBodyAngleToModularDir16(args.bodyAngle),
      turretDir16: screenAngleToModularDir16(args.turretAngle),
      failReason: `no modular faction for faction=${args.faction}`,
    };
  }

  const hullMod = modLevelToModularMod(args.modificationLevel) as ModularModId;
  const turretMod = modLevelToModularMod(args.modificationLevel) as ModularModId;

  return {
    visual: {
      hullId,
      turretId,
      faction: factionId,
      hullMod,
      turretMod,
    },
    hullDir16: gridBodyAngleToModularDir16(args.bodyAngle),
    turretDir16: screenAngleToModularDir16(args.turretAngle),
    failReason: null,
  };
}
