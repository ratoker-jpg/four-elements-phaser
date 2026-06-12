/**
 * TURRET-HULL-CONTRACT-PR-E1: Pure socket/pivot attachment math helpers.
 *
 * Deterministic, tested helper functions that compute how a turret sprite
 * should be positioned relative to a hull socket using profile metadata.
 *
 * This module is pure TypeScript — no Phaser imports, no runtime state.
 * It does NOT wire into any renderer. Actual visual acceptance happens
 * later in PR-E2 when renderer wiring uses these helpers.
 *
 * Source: docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md §14 PR-E
 *
 * Math model:
 * - Hull socket: normalized point (0..1) in hull image space.
 *   hullCenterToSocketPx = (socket.x - 0.5) * hullDisplayWidthPx,
 *                          (socket.y - 0.5) * hullDisplayHeightPx
 *
 * - Turret pivot: normalized point (0..1) in turret image space.
 *   turretCenterToPivotPx = (pivot.x - 0.5) * turretDisplayWidthPx,
 *                           (pivot.y - 0.5) * turretDisplayHeightPx
 *
 * - To place turret pivot on hull socket:
 *   turretSpriteCenterFromHullCenterPx = hullCenterToSocketPx - turretCenterToPivotPx
 *
 * Important: socket/pivot values currently in the profiles are placeholders
 * for some assets. The math is correct; the input values will be refined
 * by Denis during visual QA in PR-E2.
 */

import {
  resolveHullVisualProfile,
  resolveTurretVisualProfile,
  resolveSocketMetadata,
  resolveTurretPivot,
  type SocketProfile,
  type PivotProfile,
} from './hullTurretVisualProfiles';

// ── Types ─────────────────────────────────────────────────────────────

/** A 2D pixel offset from some reference point. */
export interface PixelOffset {
  x: number;
  y: number;
}

/** A normalized point in image-local coordinates (0..1). */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/** Full attachment profile resolved for a hull+turret+socket combo. */
export interface TurretAttachmentProfile {
  /** The resolved hull socket metadata (null if hull/socket unsupported). */
  socket: SocketProfile | null;
  /** The resolved turret pivot metadata (null if turret unsupported). */
  pivot: PivotProfile | null;
  /** The hull display width in pixels (for offset computation). */
  hullDisplayWidthPx: number;
  /** The hull display height in pixels (for offset computation). */
  hullDisplayHeightPx: number;
  /** The turret display width in pixels (for offset computation). */
  turretDisplayWidthPx: number;
  /** The turret display height in pixels (for offset computation). */
  turretDisplayHeightPx: number;
}

/** Result of turret sprite center offset computation. */
export interface TurretSpriteCenterOffsetResult {
  /** The pixel offset from hull center to where the turret sprite center should be placed.
   *  null if the attachment cannot be computed (missing socket or pivot). */
  offset: PixelOffset | null;
  /** The hull center to socket pixel offset. null if socket missing. */
  hullCenterToSocketPx: PixelOffset | null;
  /** The turret center to pivot pixel offset. null if pivot missing. */
  turretCenterToPivotPx: PixelOffset | null;
}

// ── Resolvers ─────────────────────────────────────────────────────────

/**
 * Resolve hull socket profile by hullId and socketId.
 *
 * Combines hull profile lookup and socket metadata resolution into
 * a single call. Returns the SocketProfile if found, or null if
 * the hull is unsupported or the socket id does not exist.
 *
 * Pure, no side effects.
 */
export function resolveHullSocketProfile(
  hullId: string,
  socketId: string,
): SocketProfile | null {
  const hullProfile = resolveHullVisualProfile(hullId);
  return resolveSocketMetadata(hullProfile, socketId);
}

/**
 * Resolve the normalized socket position for a specific direction.
 *
 * Checks the socket's perDir overrides first (direction-specific projected
 * positions from Codex projection recovery). Falls back to the base
 * normalized position if no perDir entry exists for the given direction.
 *
 * This is important because the hull mount point appears at different
 * normalized positions in each sprite frame due to orthographic projection.
 * Using a single center {0.5, 0.5} for all directions misplaces the
 * turret relative to the actual mount.
 *
 * Returns null if the hull/socket is unsupported.
 * Pure, no side effects.
 */
export function resolveSocketNormForDir(
  hullId: string,
  socketId: string,
  dir16: number,
): NormalizedPoint | null {
  const socketProfile = resolveHullSocketProfile(hullId, socketId);
  if (!socketProfile) return null;
  const perDirEntry = socketProfile.perDir?.[dir16];
  if (perDirEntry) {
    return { x: perDirEntry.nx, y: perDirEntry.ny };
  }
  return { x: socketProfile.normalized.nx, y: socketProfile.normalized.ny };
}

/**
 * Resolve turret pivot profile by weaponId.
 *
 * Combines turret profile lookup and pivot resolution into
 * a single call. Returns the PivotProfile if found, or null if
 * the weapon is unsupported.
 *
 * Pure, no side effects.
 */
export function resolveTurretPivotProfile(
  weaponId: string,
): PivotProfile | null {
  const turretProfile = resolveTurretVisualProfile(weaponId);
  return resolveTurretPivot(turretProfile);
}

// ── Math helpers ──────────────────────────────────────────────────────

/**
 * Compute the pixel offset from an image's center to a normalized point,
 * given the image's display dimensions in pixels.
 *
 * Formula:
 *   offsetX = (point.x - 0.5) * widthPx
 *   offsetY = (point.y - 0.5) * heightPx
 *
 * Examples:
 *   - {0.5, 0.5} (center) → {0, 0}
 *   - {0, 0} (top-left) → {-width/2, -height/2}
 *   - {1, 1} (bottom-right) → {width/2, height/2}
 *
 * This is a pure, deterministic function. It does not depend on
 * Phaser, DOM, or any runtime state.
 */
export function computeNormalizedPointOffsetPx(
  point: NormalizedPoint,
  widthPx: number,
  heightPx: number,
): PixelOffset {
  return {
    x: (point.x - 0.5) * widthPx,
    y: (point.y - 0.5) * heightPx,
  };
}

/**
 * Compute the turret sprite center offset needed to place the turret
 * pivot on the hull socket.
 *
 * Given:
 * - Hull socket normalized coordinates and hull display dimensions
 * - Turret pivot normalized coordinates and turret display dimensions
 *
 * The formula places the turret pivot point exactly on the hull socket:
 *   turretSpriteCenterOffset = hullCenterToSocket - turretCenterToPivot
 *
 * Where:
 *   hullCenterToSocket = (socketNorm - 0.5) * hullDisplaySize
 *   turretCenterToPivot = (pivotNorm - 0.5) * turretDisplaySize
 *
 * Returns a TurretSpriteCenterOffsetResult containing the final offset
 * and the intermediate values. Returns null offsets if socket or pivot
 * is missing.
 *
 * This is a pure, deterministic function. It does not depend on
 * Phaser, DOM, or any runtime state.
 */
export function computeTurretSpriteCenterOffsetForSocket(params: {
  /** Hull socket normalized point. null if socket unsupported. */
  socketNorm: NormalizedPoint | null;
  /** Hull sprite display width in pixels. */
  hullDisplayWidthPx: number;
  /** Hull sprite display height in pixels. */
  hullDisplayHeightPx: number;
  /** Turret pivot normalized point. null if turret unsupported. */
  pivotNorm: NormalizedPoint | null;
  /** Turret sprite display width in pixels. */
  turretDisplayWidthPx: number;
  /** Turret sprite display height in pixels. */
  turretDisplayHeightPx: number;
}): TurretSpriteCenterOffsetResult {
  const hullCenterToSocketPx: PixelOffset | null = params.socketNorm
    ? computeNormalizedPointOffsetPx(
        params.socketNorm,
        params.hullDisplayWidthPx,
        params.hullDisplayHeightPx,
      )
    : null;

  const turretCenterToPivotPx: PixelOffset | null = params.pivotNorm
    ? computeNormalizedPointOffsetPx(
        params.pivotNorm,
        params.turretDisplayWidthPx,
        params.turretDisplayHeightPx,
      )
    : null;

  let offset: PixelOffset | null = null;
  if (hullCenterToSocketPx !== null && turretCenterToPivotPx !== null) {
    offset = {
      x: hullCenterToSocketPx.x - turretCenterToPivotPx.x,
      y: hullCenterToSocketPx.y - turretCenterToPivotPx.y,
    };
  }

  return {
    offset,
    hullCenterToSocketPx,
    turretCenterToPivotPx,
  };
}

/**
 * Resolve the full turret attachment profile for a hull+turret+socket combo.
 *
 * This is a convenience function that combines:
 * 1. Hull profile → socket resolution
 * 2. Turret profile → pivot resolution
 * 3. Display dimension computation from texture scale and source size
 *
 * Returns a TurretAttachmentProfile with all the metadata needed
 * to compute the turret sprite center offset. Returns null-valued
 * socket/pivot for unsupported combinations (graceful fallback).
 *
 * The display dimensions are computed as:
 *   hullDisplayWidthPx = hullSourceWidthPx * hullTextureScale
 *   hullDisplayHeightPx = hullSourceHeightPx * hullTextureScale
 *   turretDisplayWidthPx = turretSourceWidthPx * turretTextureScale
 *   turretDisplayHeightPx = turretSourceHeightPx * turretTextureScale
 *
 * The caller must provide the source image dimensions (the original
 * PNG size before scaling). For generated hulls this is typically 512x512;
 * for legacy turrets this is typically 256x256.
 *
 * Pure, no side effects, no Phaser imports.
 */
export function resolveTurretAttachmentProfile(
  hullId: string,
  weaponId: string,
  socketId: string,
  hullSourceWidthPx: number,
  hullSourceHeightPx: number,
  turretSourceWidthPx: number,
  turretSourceHeightPx: number,
): TurretAttachmentProfile {
  const hullProfile = resolveHullVisualProfile(hullId);
  const turretProfile = resolveTurretVisualProfile(weaponId);

  const socket = resolveSocketMetadata(hullProfile, socketId);
  const pivot = resolveTurretPivot(turretProfile);

  const hullTextureScale = hullProfile?.textureScale ?? 0;
  const turretTextureScale = turretProfile?.textureScale ?? 0;

  return {
    socket,
    pivot,
    hullDisplayWidthPx: hullSourceWidthPx * hullTextureScale,
    hullDisplayHeightPx: hullSourceHeightPx * hullTextureScale,
    turretDisplayWidthPx: turretSourceWidthPx * turretTextureScale,
    turretDisplayHeightPx: turretSourceHeightPx * turretTextureScale,
  };
}
