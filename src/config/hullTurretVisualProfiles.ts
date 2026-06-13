/**
 * TURRET-HULL-CONTRACT-PR-B: Read-only visual profile layer for hull/turret attachment.
 *
 * Pure TypeScript — no Phaser imports. This module declares the contract types,
 * static profile data, and pure helper functions that the renderer will eventually
 * consume. It does NOT change runtime visuals; it reproduces today's exact constants
 * as typed, testable data.
 *
 * Source: docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md §6, §14
 *
 * Profile instances are populated from existing exported constants so that a drift
 * guard test can assert parity. The renderer is NOT rewired in this PR.
 *
 * PR-F1: Directional profile types and helpers are now in the pure module
 * directionalTurretProfiles.ts. The single PivotProfile here is retained as
 * a legacy/fallback for compatibility with existing PR-B/C/D/E1 code.
 * New code should use resolveTurretPivotForDir() from directionalTurretProfiles
 * for direction-dependent pivot data from projection recovery.
 */

import type { BodyId, WeaponId } from './blockoutProfiles';
import {
  GENERATED_HULL_SCALE,
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
  WASP_HULL_OFFSET_X,
  WASP_HULL_OFFSET_Y,
} from '../assets/generatedHullAssets';
import { GENERATED_TURRET_SCALE } from '../assets/generatedTurretAssets';

// PR-C: Direction remap types and helper are now in the pure module
// visualDirectionRemap.ts to avoid circular imports when
// generatedHullAssets.ts needs to use remapVisualDir.
export {
  type DirCount,
  type DirectionRemapProfile,
  remapVisualDir,
  WASP_HULL_DIRECTION_REMAP_PROFILE,
} from './visualDirectionRemap';

// Re-import for internal use in this module
import {
  type DirectionRemapProfile as DirectionRemapProfileInternal,
  remapVisualDir as remapVisualDirInternal,
  WASP_HULL_DIRECTION_REMAP_PROFILE as WASP_HULL_DIRECTION_REMAP_PROFILE_INTERNAL,
} from './visualDirectionRemap';

// ── Socket profile ─────────────────────────────────────────────────

/**
 * A named mount point in normalized hull-local coordinates.
 *
 * Coordinate system:
 * - `{ nx: 0.5, ny: 0.5 }` = hull logical center.
 * - nx: 0 = rear edge, 1 = front edge (along body axis).
 * - ny: 0 = left edge, 1 = right edge (across body axis).
 *
 * Normalized coordinates survive scale changes (the exact failure that
 * produced MODULAR_ANCHOR_CORRECTION and the 0.24→0.12 re-tuning).
 * The renderer converts them to screen space via the hull's single
 * composite transform, then projects through the camera contract.
 */
export interface SocketProfile {
  /** Unique socket identifier, e.g. 'turret_main'. */
  id: string;
  /** Normalized hull-local position. */
  normalized: { nx: number; ny: number };
  /** Height above body top in world Z units (for projection via basisZ). */
  zHeight: number;
  /** Optional per-direction override (default: direction-independent). */
  perDir?: Partial<Record<number, { nx: number; ny: number }>>;
}

// ── Pivot profile ──────────────────────────────────────────────────

/**
 * Turret pivot in normalized turret-image-local coordinates.
 *
 * @deprecated Legacy/fallback single-pivot model. Turret pivot positions
 * are direction-dependent; a single {px, py} is insufficient because
 * each direction PNG shows the base ring at a different normalized position.
 * Use resolveTurretPivotForDir() from directionalTurretProfiles.ts instead.
 *
 * This interface is retained for backward compatibility with existing
 * PR-B/C/D/E1 code. It will be removed once the renderer is fully
 * rewired to use directional profiles (PR-E2+).
 *
 * Pivot values describe the turret base/pivot point (the rotation ring)
 * in normalized sprite-space coordinates (0..1). For a barreled turret
 * (e.g. Smoky), the pivot is the base ring, typically below/behind
 * center (py > 0.5), with the barrel extending forward of it.
 *
 * IMPORTANT — how pivot values must be consumed:
 * - Pivot values must be used by socket/pivot attachment math
 *   (computeTurretSpriteCenterOffsetForSocket in turretAttachmentMath.ts)
 *   to compute the pixel offset that places the turret pivot on the hull socket.
 * - Future renderer code should prefer directional pivot data from
 *   directionalTurretProfiles.ts via resolveTurretPivotForDir().
 * - Pivot values must NOT automatically become Phaser sprite origin.
 *   The Phaser sprite origin should remain centered: setOrigin(0.5, 0.5).
 *   The attachment math produces a pixel offset that is applied to the
 *   centered sprite position — it does NOT re-originate the sprite.
 * - Mounting by image center (0.5, 0.5) without offset math pushes the
 *   whole turret forward/off by roughly half a barrel length, and that
 *   error rotates with the turret — exactly the symptom in audit RC-6.
 */
export interface PivotProfile {
  /** Normalized X: 0 = left edge of turret image, 1 = right edge. */
  px: number;
  /** Normalized Y: 0 = top edge of turret image, 1 = bottom edge. */
  py: number;
}

// ── Hull visual profile ────────────────────────────────────────────

/**
 * Describes how a hull's visual assets are structured, directed, and
 * where turret sockets are located. Read-only data consumed by the renderer.
 *
 * One profile per hull bodyId. Populated from existing constants so that
 * the profile layer is a no-op until the renderer is rewired (PR-C/PR-E).
 */
export interface HullVisualProfile {
  /** Body identifier this profile describes. */
  hullId: BodyId;
  /** Which asset family / key builder to use. */
  family: 'generated' | 'legacy';
  /** Sprite texture scale (e.g. GENERATED_HULL_SCALE = 0.12). */
  textureScale: number;
  /** Sprite origin (e.g. { x: 0.5, y: 0.75 } for generated hulls). */
  origin: { x: number; y: number };
  /** Direction remap for this hull's PNG family. */
  direction: DirectionRemapProfileInternal;
  /** Permanent visual placement offset in screen pixels (e.g. Wasp: { x: -1, y: 12 }). */
  placementOffset: { x: number; y: number };
  /** Declared mount sockets on this hull (at least 'turret_main'). */
  sockets: SocketProfile[];
  /** True when the runtime quantizes to 8 dirs (only even dir16 indices used). */
  usesEvenDirOnly?: boolean;
}

// ── Turret visual profile ──────────────────────────────────────────

/**
 * Describes how a turret's visual assets are structured, directed,
 * pivoted, and which hull socket they mount to. Read-only data consumed
 * by the renderer.
 *
 * One profile per weaponId. The turret's direction remap is its own
 * (not borrowed from the hull), closing audit RC-3. The pivot gives the
 * renderer the turret-side mount point the current code has no slot for,
 * closing audit RC-6.
 */
export interface TurretVisualProfile {
  /** Weapon identifier this profile describes. */
  weaponId: WeaponId;
  /** Which asset family / key builder to use. */
  family: 'legacy' | 'generated';
  /** Sprite texture scale (e.g. MODULAR_RENDER_SCALE = 0.24). */
  textureScale: number;
  /** Turret pivot in normalized image-local coords. */
  pivot: PivotProfile;
  /** Direction remap for this turret's PNG family. */
  direction: DirectionRemapProfileInternal;
  /** Which socket on the hull this turret mounts to. */
  mountSocketId: string;
  /** Visual recoil hooks (default off — no combat/recoil semantics change). */
  recoil?: { followsBarrelKickback: boolean; followsTurretKickback: boolean };
}

// ── Upgrade level profile ──────────────────────────────────────────

/**
 * Per-upgrade-level visual deltas over M0. Absent fields mean
 * "identical to M0". This keeps M-levels lean and graceful: missing
 * higher-tier art never blocks rendering.
 *
 * Gameplay/balance scaling stays where it is (m0m3Scaling.ts,
 * blockoutUpgradeData.ts); this profile is visual only.
 */
export interface UpgradeLevelProfile {
  /** Upgrade tier 0–3 → 'm0'–'m3'. */
  level: 0 | 1 | 2 | 3;
  /** Optional per-level texture mod suffix; absent ⇒ reuse M0 art. */
  textureModSuffix?: 'm0' | 'm1' | 'm2' | 'm3';
  /** Optional per-level scale multiplier; absent ⇒ 1.0. */
  scaleMultiplier?: number;
  /** Optional per-level socket overrides by socket id. */
  socketOverrides?: Partial<Record<string, { nx: number; ny: number }>>;
  /** Optional visual indicator (e.g. chevrons/pips). */
  visualIndicator?: string;
}

// ── Profile instances (today's constants, no visual change) ─────────

/**
 * Wasp generated hull visual profile.
 * All values match existing exported constants exactly.
 *
 * direction.facingOffset = 4 is equivalent to WASP_HULL_VISUAL_DIR16_REMAP
 * (which maps each logical dir16 to (logical + 4) mod 16).
 *
 * sockets[0].zHeight = 0.30 matches
 * BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET = 0.25 + 0.05.
 *
 * sockets[0].perDir:
 * - values are projection-backed raw/no+52 candidates;
 * - stored keys are runtime visual dir16;
 * - value for runtime dir d comes from projection dir (d + 2) mod 16;
 * - still candidate data pending final visual acceptance / F3C;
 * - do not add +52 postprocess shift.
 */
export const WASP_HULL_VISUAL_PROFILE: HullVisualProfile = {
  hullId: 'wasp',
  family: 'generated',
  textureScale: GENERATED_HULL_SCALE,                                          // 0.12
  origin: { x: GENERATED_HULL_ORIGIN_X, y: GENERATED_HULL_ORIGIN_Y },        // {0.5, 0.75}
  direction: WASP_HULL_DIRECTION_REMAP_PROFILE_INTERNAL,                        // == WASP_HULL_VISUAL_DIR16_REMAP
  placementOffset: { x: WASP_HULL_OFFSET_X, y: WASP_HULL_OFFSET_Y },         // {-1, 12}
  sockets: [
    {
      id: 'turret_main',
      normalized: { nx: 0.5, ny: 0.5 },   // fallback for missing perDir entry
      zHeight: 0.30,   // BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET
      perDir: {
        0:  { nx: 0.360491, ny: 0.357876 },  // runtime visual dir00 -> projection dir02 raw
        1:  { nx: 0.371110, ny: 0.337738 },  // runtime visual dir01 -> projection dir03 raw
        2:  { nx: 0.401352, ny: 0.320666 },  // runtime visual dir02 -> projection dir04 raw
        3:  { nx: 0.446612, ny: 0.309258 },  // runtime visual dir03 -> projection dir05 raw
        4:  { nx: 0.500000, ny: 0.305253 },  // runtime visual dir04 -> projection dir06 raw
        5:  { nx: 0.553387, ny: 0.309258 },  // runtime visual dir05 -> projection dir07 raw
        6:  { nx: 0.598647, ny: 0.320666 },  // runtime visual dir06 -> projection dir08 raw
        7:  { nx: 0.628889, ny: 0.337738 },  // runtime visual dir07 -> projection dir09 raw
        8:  { nx: 0.639509, ny: 0.357876 },  // runtime visual dir08 -> projection dir10 raw
        9:  { nx: 0.628889, ny: 0.378015 },  // runtime visual dir09 -> projection dir11 raw
        10: { nx: 0.598647, ny: 0.395087 },  // runtime visual dir10 -> projection dir12 raw
        11: { nx: 0.553387, ny: 0.406494 },  // runtime visual dir11 -> projection dir13 raw
        12: { nx: 0.500000, ny: 0.410500 },  // runtime visual dir12 -> projection dir14 raw
        13: { nx: 0.446612, ny: 0.406494 },  // runtime visual dir13 -> projection dir15 raw
        14: { nx: 0.401352, ny: 0.395087 },  // runtime visual dir14 -> projection dir00 raw
        15: { nx: 0.371110, ny: 0.378015 },  // runtime visual dir15 -> projection dir01 raw
      },
    },
  ],
  usesEvenDirOnly: true,
};

/**
 * Smoky M0 turret visual profile.
 *
 * FIXUP-5: Upgraded from legacy 8-dir/256px to generated 16-dir/512px.
 * The generated turret sprites are at 512×512 with 16 directions,
 * matching the directional pivot data from directionalTurretProfiles.ts.
 *
 * direction.facingOffset = 4 in dir16 space. This is the turret's own
 * remap value, equivalent to the legacy facingOffset=2 in dir8 space
 * (2 * 2 = 4 when doubling direction resolution). This is NOT borrowed
 * from the hull (closing audit RC-3).
 *
 * textureScale = GENERATED_TURRET_SCALE (0.12) for 512×512 sprites,
 * replacing the legacy MODULAR_RENDER_SCALE (0.24) for 256×256 sprites.
 *
 * pivot.px/py = 0.5/0.5 is a LEGACY PLACEHOLDER. The directional profile
 * data from PR-F1 shows the true per-direction pivot positions. Use
 * resolveTurretPivotForDir('smoky', level, dir) for projection-recovered
 * directional pivot data.
 */
export const SMOKY_TURRET_VISUAL_PROFILE: TurretVisualProfile = {
  weaponId: 'smoky',
  family: 'generated',
  textureScale: GENERATED_TURRET_SCALE,   // 0.12 (was MODULAR_RENDER_SCALE 0.24 for 256px)
  pivot: {
    px: 0.5,
    py: 0.5,   // LEGACY PLACEHOLDER — use resolveTurretPivotForDir for directional data
  },
  direction: { dirCount: 16, facingOffset: 4 },
  mountSocketId: 'turret_main',
  recoil: { followsBarrelKickback: false, followsTurretKickback: false },
};

// ── Pure helper functions ──────────────────────────────────────────

/**
 * Resolve a hull visual profile by bodyId.
 *
 * Returns the typed profile if the hull has one, or null for unsupported
 * hulls (graceful fallback — the renderer keeps using procedural geometry).
 */
export function resolveHullVisualProfile(bodyId: string): HullVisualProfile | null {
  if (bodyId === 'wasp') return WASP_HULL_VISUAL_PROFILE;
  return null;
}

/**
 * Resolve a turret visual profile by weaponId.
 *
 * Returns the typed profile if the weapon has one, or null for unsupported
 * weapons (graceful fallback — the renderer keeps using procedural turret).
 */
export function resolveTurretVisualProfile(weaponId: string): TurretVisualProfile | null {
  if (weaponId === 'smoky') return SMOKY_TURRET_VISUAL_PROFILE;
  return null;
}

/**
 * Resolve socket metadata from a hull profile by socket id.
 *
 * Returns the SocketProfile if found, or null if the hull profile is null
 * or the socket id does not exist on that hull. Pure, no side effects.
 */
export function resolveSocketMetadata(
  hullProfile: HullVisualProfile | null,
  socketId: string,
): SocketProfile | null {
  if (!hullProfile) return null;
  return hullProfile.sockets.find(s => s.id === socketId) ?? null;
}

/**
 * Resolve turret pivot metadata from a turret profile.
 *
 * @deprecated Legacy single-pivot resolver. Turret pivot positions are
 * direction-dependent; use resolveTurretPivotForDir() from
 * directionalTurretProfiles.ts for projection-recovered directional data.
 *
 * Returns the PivotProfile if the turret profile exists, or null.
 * The pivot is read-only and does not depend on renderer state.
 *
 * IMPORTANT: the returned pivot values must be consumed through
 * attachment/offset math (turretAttachmentMath.ts), NOT used directly
 * as Phaser sprite origin. The Phaser sprite origin should remain
 * centered (0.5, 0.5); the attachment math computes the pixel offset
 * that places the turret pivot on the hull socket.
 *
 * This legacy resolver is retained as a fallback for existing code that
 * has not yet been wired to the directional profile system.
 */
export function resolveTurretPivot(
  turretProfile: TurretVisualProfile | null,
): PivotProfile | null {
  if (!turretProfile) return null;
  return turretProfile.pivot;
}

// ── PR-D: Turret visual direction resolver ─────────────────────────

/**
 * Resolve the visual direction for a turret weapon, using its own profile.
 *
 * Takes a weaponId and a logical dir8 (0–7, from bodyAngleToDir8 or
 * equivalent quantization), looks up the turret's DirectionRemapProfile,
 * and applies remapVisualDir to get the visual dir8.
 *
 * Returns the visual dir8 if the weapon has a profile, or null for
 * unsupported weapons (graceful fallback — the renderer keeps using
 * procedural geometry or raw direction).
 *
 * This is the turret-specific equivalent of the hull direction pipeline:
 *   hull: logicalDir16 → remapVisualDir(logicalDir16, hullProfile.direction)
 *   turret: logicalDir8 → remapVisualDir(logicalDir8, turretProfile.direction)
 *
 * The turret direction is its own, NOT borrowed from the hull profile.
 * This closes audit root cause RC-3 (turret remap hardcodes 'wasp').
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveTurretVisualDir(
  weaponId: string,
  logicalDir8: number,
): number | null {
  const profile = resolveTurretVisualProfile(weaponId);
  if (!profile) return null;
  return remapVisualDirInternal(logicalDir8, profile.direction);
}
