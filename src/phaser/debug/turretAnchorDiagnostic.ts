/**
 * TURRET-HULL-CONTRACT-PR-F2: Turret/hull anchor runtime diagnostic.
 *
 * Debug-only helper that answers ONE question with runtime numbers instead
 * of guesswork: are the computed hull socket world point and the computed
 * turret pivot world point actually the same point on screen?
 *
 * The pure math here intentionally re-derives both world points DIRECTLY
 * from the live sprite transforms (x/y, origin, displaySize) plus the
 * profile norms — it does NOT reuse the placement offset that the renderer
 * solved for. That makes it an independent cross-check:
 *
 *   - hull socket world  = hullSprite.(x,y) + (socketNorm - hullOrigin) * hullDisplaySize
 *   - turret pivot world = turretSprite.(x,y) + (pivotNorm - turretOrigin) * turretDisplaySize
 *
 * If the renderer math is self-consistent these two points coincide
 * (distance ~ 0). A non-zero distance means a runtime math / origin /
 * scale / direction mismatch (Case A). A zero distance with a visually
 * detached turret means the profile norms do not match the visible PNG
 * pixels (Case B).
 *
 * Pure TypeScript. The flag reader is window-guarded so this module is
 * safe to import in non-DOM (test) environments.
 */

import type { NormalizedPoint } from '../../config/turretAttachmentMath';

/** Query-param flag: ?turretAnchorDebug=1 enables the Arena anchor overlay. */
export function isTurretAnchorDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const v = params.get('turretAnchorDebug');
  return v === '1' || v === 'true';
}

/** A 2D point in screen/world coordinates. */
export interface AnchorPoint {
  x: number;
  y: number;
}

/** Result of the anchor diagnostic computation. */
export interface AnchorDiagnosticResult {
  /** Hull socket world point derived from the live hull sprite transform. */
  hullSocketWorld: AnchorPoint;
  /** Turret pivot world point derived from the live turret sprite transform. */
  turretPivotWorld: AnchorPoint;
  /** turretPivotWorld.x - hullSocketWorld.x */
  deltaX: number;
  /** turretPivotWorld.y - hullSocketWorld.y */
  deltaY: number;
  /** Euclidean distance between the two points (pixels). */
  distance: number;
}

/**
 * Re-derive the hull socket world point and turret pivot world point from
 * the live sprite transforms and the profile norms, then report the delta.
 *
 * All sizes are DISPLAY sizes (already scaled), all origins are normalized
 * (0..1) Phaser origins, and all sprite positions are the sprite's (x, y)
 * — i.e. the origin point in world/screen space.
 *
 * Pure and deterministic; no Phaser, DOM, or runtime state.
 */
export function computeAnchorDiagnostic(params: {
  hullSpriteX: number;
  hullSpriteY: number;
  hullOriginX: number;
  hullOriginY: number;
  hullDisplayWidthPx: number;
  hullDisplayHeightPx: number;
  socketNorm: NormalizedPoint;
  turretSpriteX: number;
  turretSpriteY: number;
  turretOriginX: number;
  turretOriginY: number;
  turretDisplayWidthPx: number;
  turretDisplayHeightPx: number;
  pivotNorm: NormalizedPoint;
}): AnchorDiagnosticResult {
  const hullSocketWorld: AnchorPoint = {
    x: params.hullSpriteX + (params.socketNorm.x - params.hullOriginX) * params.hullDisplayWidthPx,
    y: params.hullSpriteY + (params.socketNorm.y - params.hullOriginY) * params.hullDisplayHeightPx,
  };

  const turretPivotWorld: AnchorPoint = {
    x: params.turretSpriteX + (params.pivotNorm.x - params.turretOriginX) * params.turretDisplayWidthPx,
    y: params.turretSpriteY + (params.pivotNorm.y - params.turretOriginY) * params.turretDisplayHeightPx,
  };

  const deltaX = turretPivotWorld.x - hullSocketWorld.x;
  const deltaY = turretPivotWorld.y - hullSocketWorld.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  return { hullSocketWorld, turretPivotWorld, deltaX, deltaY, distance };
}
