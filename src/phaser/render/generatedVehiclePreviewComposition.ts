/**
 * MODULAR-PROOF-01: Pure preview composition for the generated vehicle
 * attachment proof harness.
 *
 * This module computes, in clean 2D sprite-space, where a generated turret
 * sprite must sit so that its pivot pixel lands on the hull sprite's socket
 * pixel. It is the isolated, projection-free composition used by the proof
 * harness to VISUALLY verify socket/pivot metadata against the actual
 * rendered PNGs — it is NOT wired into live Arena rendering.
 *
 * Design contract (deliberately different from the failed live integration):
 *   - NO Phaser imports. Pure TypeScript.
 *   - NO asset loading. The optional textureExists callback only *probes*.
 *   - NO runtime state mutation.
 *   - NO zHeight applied by default. For baked isometric sprites the socket
 *     pixel already encodes the visual mount height, so sprite→sprite
 *     attachment is pure 2D. A zHeight delta is exposed ONLY as an explicit
 *     diagnostic toggle (to demonstrate whether it helps or double-counts).
 *   - NO manual x/y offsets, NO per-direction pixel tables.
 *
 * Composition formula (sprite-space, projection-free):
 *   hullSpritePos      = anchor                         (hull origin anchor)
 *   hullSocketMarker   = anchor + (socket.n - hullOrigin) * hullDisplaySize
 *   pivotFromCenter    = (pivot - 0.5) * turretDisplaySize
 *   turretSpritePos    = hullSocketMarker - pivotFromCenter (+ zHeightDelta?)
 *   turretPivotMarker  = turretSpritePos + pivotFromCenter
 *                      = hullSocketMarker (+ zHeightDelta?)
 *
 * By construction the turret pivot coincides with the hull socket when the
 * zHeight diagnostic is OFF. The harness then verifies, by eye, whether the
 * socket marker actually lands on the hull's drawn turret ring and the pivot
 * marker lands on the turret's drawn rotation axis.
 */

import {
  bodyIdToGeneratedHullId,
  mapRuntimeDir8ToGeneratedDir16,
  applyHullVisualDir16Remap,
  getGeneratedHullTextureKey,
  resolveGeneratedHullFaction,
  modificationLevelToMod,
  type GeneratedHullDir16Index,
} from '../../assets/generatedHullAssets';
import {
  weaponIdToTurretId,
  turretAngleToDir16,
  getGeneratedTurretTextureKey,
  resolveGeneratedTurretFaction,
  GENERATED_TURRET_SCALE,
  type GeneratedTurretDir16Index,
} from '../../assets/generatedTurretAssets';
import {
  resolveHullVisualProfile,
  resolveSocketMetadata,
  resolveTurretVisualProfile,
} from '../../config/hullTurretVisualProfiles';
import {
  resolveTurretPivotForDir,
  normalizeDir16,
} from '../../config/directionalTurretProfiles';
import {
  HULL_IMAGE_SIZE,
  TURRET_IMAGE_SIZE,
} from '../../assets/generatedVehicleMetadata';

import type { Faction } from '../../state/types';

// ─── Types ──────────────────────────────────────────────────────────

/** A 2D screen-space point. */
export interface PreviewPoint {
  x: number;
  y: number;
}

/** A screen-space bounding box (top-left origin + size). */
export interface PreviewBBox {
  /** Top-left X. */
  x: number;
  /** Top-left Y. */
  y: number;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

/** Reason a preview is unavailable (null when available). */
export type PreviewUnavailableReason =
  | 'no-generated-hull'
  | 'no-hull-profile'
  | 'no-socket'
  | 'no-generated-turret'
  | 'no-pivot'
  | 'texture-missing';

/** Input for a generated vehicle preview composition. */
export interface GeneratedVehiclePreviewInput {
  /** Runtime body ID (e.g. 'wasp'). */
  bodyId: string;
  /** Runtime weapon ID (e.g. 'smoky'). */
  weaponId: string;
  /** Faction colour variant. */
  faction: Faction;
  /** Hull modification level (0-3). */
  hullModificationLevel: number;
  /** Turret modification level (0-3). */
  turretModificationLevel: number;
  /** Logical body direction (0-7); maps to even dir16 for the hull PNG. */
  bodyDir8: number;
  /** Turret angle in radians (screen-space); quantized to dir16. */
  turretAngleRad: number;
  /** Hull sprite screen position (the origin anchor point). */
  anchor: PreviewPoint;
  /**
   * Diagnostic zHeight projection. OFF by default — sprite→sprite
   * attachment must not apply zHeight unless this proves it is needed.
   * basisZScreenY is the camera contract's vertical pixels-per-z-unit
   * (e.g. -60). The delta is socket.zHeight * basisZScreenY.
   */
  zHeightDiagnostic?: { enabled: boolean; basisZScreenY: number };
  /**
   * Optional texture existence probe. When provided and a required texture
   * is missing, the result is marked unavailable (safe fallback) — but the
   * geometry is still computed for inspection. No asset loading.
   */
  textureExists?: (key: string) => boolean;
}

/** Result of a generated vehicle preview composition. */
export interface GeneratedVehiclePreviewResult {
  /** Whether both hull and turret are available for preview. */
  available: boolean;
  /** Why the preview is unavailable, or null when available. */
  reason: PreviewUnavailableReason | null;

  /** Hull texture key (null when no generated hull). */
  hullTextureKey: string | null;
  /** Turret texture key (null when no generated turret). */
  turretTextureKey: string | null;

  /** Logical hull dir16 (before visual remap). */
  hullLogicalDir16: number;
  /** Visual hull dir16 (after remap; selects the hull PNG). */
  hullVisualDir16: number;
  /** Logical turret dir16 (from turret angle). */
  turretLogicalDir16: number;
  /** Visual turret dir16 (after remap; selects the turret PNG + pivot). */
  turretVisualDir16: number;

  /** Hull render scale. */
  hullScale: number;
  /** Turret render scale. */
  turretScale: number;
  /** Hull sprite origin (e.g. 0.5, 0.75). */
  hullOrigin: { x: number; y: number };
  /** Turret sprite origin (always 0.5, 0.5). */
  turretOrigin: { x: number; y: number };

  /** Hull socket metadata (null when missing). */
  socket: { nx: number; ny: number; zHeight: number | null } | null;
  /** Turret pivot metadata for the visual direction (null when missing). */
  pivot: { x: number; y: number } | null;

  /** Hull sprite screen position (= anchor). */
  hullSpritePos: PreviewPoint;
  /** Turret sprite screen position (turret center). */
  turretSpritePos: PreviewPoint;

  /** Hull sprite origin marker. */
  hullOriginMarker: PreviewPoint;
  /** Hull socket marker (where the turret should mount). */
  hullSocketMarker: PreviewPoint;
  /** Turret sprite origin marker (= turret center). */
  turretOriginMarker: PreviewPoint;
  /** Turret pivot marker (lands on socket when zHeight diagnostic is off). */
  turretPivotMarker: PreviewPoint;
  /** Ground anchor marker (hull bottom-center, true ground contact). */
  groundAnchorMarker: PreviewPoint;

  /** Hull sprite bounding box. */
  hullBBox: PreviewBBox;
  /** Turret sprite bounding box. */
  turretBBox: PreviewBBox;

  /** Whether the diagnostic zHeight delta was applied to the turret. */
  zHeightApplied: boolean;
  /** The applied zHeight delta in pixels ({0,0} when off). */
  zHeightDeltaPx: PreviewPoint;
}

// ─── Composition ────────────────────────────────────────────────────

/**
 * Compute the generated vehicle preview composition in pure 2D sprite-space.
 *
 * Pure function: no Phaser, no asset loading, no state mutation. Given the
 * vehicle params and a hull anchor point, returns the sprite positions,
 * marker positions, bounding boxes, and label data the proof harness needs.
 */
export function composeGeneratedVehiclePreview(
  input: GeneratedVehiclePreviewInput,
): GeneratedVehiclePreviewResult {
  const {
    bodyId,
    weaponId,
    faction,
    hullModificationLevel,
    turretModificationLevel,
    bodyDir8,
    turretAngleRad,
    anchor,
    zHeightDiagnostic,
    textureExists,
  } = input;

  // ── Hull direction (logical → visual) ──
  const hullId = bodyIdToGeneratedHullId(bodyId);
  const hullLogicalDir16 = mapRuntimeDir8ToGeneratedDir16(
    ((Math.trunc(bodyDir8) % 8) + 8) % 8,
  );
  const hullVisualDir16 = hullId
    ? applyHullVisualDir16Remap(hullId, hullLogicalDir16)
    : hullLogicalDir16;

  // ── Turret direction (logical → visual) ──
  const turretLogicalDir16 = turretAngleToDir16(turretAngleRad);
  const turretProfile = resolveTurretVisualProfile(weaponId);
  let turretVisualDir16: number = turretLogicalDir16;
  if (turretProfile) {
    const { dirCount, facingOffset } = turretProfile.direction;
    const dir16Offset = facingOffset * (16 / dirCount);
    turretVisualDir16 = normalizeDir16(turretLogicalDir16 + dir16Offset);
  }

  const hullProfile = resolveHullVisualProfile(hullId ?? '');
  const hullScale = hullProfile?.textureScale ?? 0.12;
  const hullOrigin = hullProfile
    ? { ...hullProfile.origin }
    : { x: 0.5, y: 0.75 };
  const turretScale = GENERATED_TURRET_SCALE;
  const turretOrigin = { x: 0.5, y: 0.5 };

  // ── Display sizes ──
  const hullW = HULL_IMAGE_SIZE.width * hullScale;
  const hullH = HULL_IMAGE_SIZE.height * hullScale;
  const turretW = TURRET_IMAGE_SIZE.width * turretScale;
  const turretH = TURRET_IMAGE_SIZE.height * turretScale;

  // ── Texture keys (pure builders) ──
  const hullFaction = resolveGeneratedHullFaction(faction);
  const hullMod = modificationLevelToMod(hullModificationLevel);
  const hullTextureKey = hullId
    ? getGeneratedHullTextureKey(
        hullId,
        hullFaction,
        hullMod,
        hullVisualDir16 as GeneratedHullDir16Index,
      )
    : null;

  const turretId = weaponIdToTurretId(weaponId);
  const turretFaction = resolveGeneratedTurretFaction(faction);
  const turretMod = modificationLevelToMod(turretModificationLevel);
  const turretTextureKey = turretId
    ? getGeneratedTurretTextureKey(
        turretId,
        turretFaction,
        turretMod,
        turretVisualDir16 as GeneratedTurretDir16Index,
      )
    : null;

  // ── Markers that exist regardless of metadata completeness ──
  const hullSpritePos: PreviewPoint = { x: anchor.x, y: anchor.y };
  const hullOriginMarker: PreviewPoint = { x: anchor.x, y: anchor.y };
  const groundAnchorMarker: PreviewPoint = {
    x: anchor.x + (0.5 - hullOrigin.x) * hullW,
    y: anchor.y + (1 - hullOrigin.y) * hullH,
  };
  const hullBBox: PreviewBBox = {
    x: anchor.x - hullOrigin.x * hullW,
    y: anchor.y - hullOrigin.y * hullH,
    width: hullW,
    height: hullH,
  };

  // ── Resolve socket + pivot metadata ──
  const socketProfile = hullProfile
    ? resolveSocketMetadata(hullProfile, turretProfile?.mountSocketId ?? 'turret_main')
    : null;
  const pivotPoint = resolveTurretPivotForDir(
    weaponId,
    turretModificationLevel,
    turretVisualDir16,
  );

  const socket = socketProfile
    ? {
        nx: socketProfile.normalized.nx,
        ny: socketProfile.normalized.ny,
        zHeight: socketProfile.zHeight ?? null,
      }
    : null;
  const pivot = pivotPoint ? { x: pivotPoint.x, y: pivotPoint.y } : null;

  // ── zHeight diagnostic (OFF by default) ──
  const zHeightApplied = Boolean(
    zHeightDiagnostic?.enabled && socket?.zHeight != null,
  );
  const zHeightDeltaPx: PreviewPoint = zHeightApplied
    ? { x: 0, y: (socket!.zHeight as number) * (zHeightDiagnostic!.basisZScreenY) }
    : { x: 0, y: 0 };

  // ── Determine availability reason (geometry still computed below) ──
  let reason: PreviewUnavailableReason | null = null;
  if (!hullId) reason = 'no-generated-hull';
  else if (!hullProfile) reason = 'no-hull-profile';
  else if (!socket) reason = 'no-socket';
  else if (!turretId) reason = 'no-generated-turret';
  else if (!pivot) reason = 'no-pivot';
  else if (
    textureExists &&
    !(textureExists(hullTextureKey ?? '') && textureExists(turretTextureKey ?? ''))
  ) {
    reason = 'texture-missing';
  }
  const available = reason === null;

  // ── Sprite-space composition (socket pixel ≡ pivot pixel) ──
  // When socket/pivot are missing, fall back to placing the turret directly
  // on the anchor so the harness still shows a sane, non-crashing preview.
  const hullSocketMarker: PreviewPoint = socket
    ? {
        x: anchor.x + (socket.nx - hullOrigin.x) * hullW,
        y: anchor.y + (socket.ny - hullOrigin.y) * hullH,
      }
    : { x: anchor.x, y: anchor.y };

  const pivotFromCenter: PreviewPoint = pivot
    ? {
        x: (pivot.x - 0.5) * turretW,
        y: (pivot.y - 0.5) * turretH,
      }
    : { x: 0, y: 0 };

  const turretSpritePos: PreviewPoint = {
    x: hullSocketMarker.x - pivotFromCenter.x + zHeightDeltaPx.x,
    y: hullSocketMarker.y - pivotFromCenter.y + zHeightDeltaPx.y,
  };
  const turretOriginMarker: PreviewPoint = { ...turretSpritePos };
  const turretPivotMarker: PreviewPoint = {
    x: turretSpritePos.x + pivotFromCenter.x,
    y: turretSpritePos.y + pivotFromCenter.y,
  };
  const turretBBox: PreviewBBox = {
    x: turretSpritePos.x - turretOrigin.x * turretW,
    y: turretSpritePos.y - turretOrigin.y * turretH,
    width: turretW,
    height: turretH,
  };

  return {
    available,
    reason,
    hullTextureKey,
    turretTextureKey,
    hullLogicalDir16,
    hullVisualDir16,
    turretLogicalDir16,
    turretVisualDir16,
    hullScale,
    turretScale,
    hullOrigin,
    turretOrigin,
    socket,
    pivot,
    hullSpritePos,
    turretSpritePos,
    hullOriginMarker,
    hullSocketMarker,
    turretOriginMarker,
    turretPivotMarker,
    groundAnchorMarker,
    hullBBox,
    turretBBox,
    zHeightApplied,
    zHeightDeltaPx,
  };
}
