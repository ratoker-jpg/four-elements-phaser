/**
 * modularVehicleComposition — MODULAR-RUNTIME-01 pure composition module.
 *
 * Given a ModularVehicleVisual, a body direction and a turret direction,
 * this returns a complete, deterministic render plan:
 *   - hull texture key + turret texture key;
 *   - hull/turret sprite placements (origin + screen position + scale);
 *   - the resolved socket and pivot positions (for diagnostics/markers);
 *   - a fallback reason when texture or metadata is unavailable.
 *
 * Alignment math (metadata-driven, no per-direction offset tables, no
 * zHeight hack, no Wasp-only constants):
 *
 *   socketOffsetPx = (socketNorm - 0.5) * hullDisplaySize
 *   pivotOffsetPx  = (pivotNorm  - 0.5) * turretDisplaySize
 *   turretCenter   = hullCenter + socketOffsetPx - pivotOffsetPx
 *
 * Both sprites keep their natural centre origin; only the turret centre is
 * offset so that the turret PIVOT lands exactly on the hull SOCKET. Under
 * the fixed_512_frame export policy both anchors are frame-centre, so the
 * offset is zero — but the formula generalises to any future per-direction
 * socket/pivot without changing the renderer.
 *
 * This module is engine-agnostic: it takes a `textureExists` predicate so
 * it can be unit-tested without a live Phaser scene.
 */

import {
  getGeneratedHullTextureKey,
  getGeneratedTurretTextureKey,
  type GeneratedModularDir16,
} from '../assets/generatedModularVehicleAssets.generated';

/**
 * Compass suffixes for the 16 directions, matching the export naming
 * (dir00=E .. dir15=ENE). Kept here because the auto-generated registry
 * does not export its private suffix map.
 */
export const MODULAR_DIR16_SUFFIXES: readonly string[] = [
  'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE',
];
import {
  getHullSocketAnchor,
  getTurretPivotAnchor,
  FALLBACK_FRAME_CENTER,
} from './modularVehicleMetadata';
import type { ModularVehicleVisual } from './modularVehicleVisual';
import { isValidModularVehicleVisual } from './modularVehicleVisual';

/** Display scale applied to the 512x512 source frames in preview space. */
export const MODULAR_VEHICLE_DISPLAY_SCALE = 0.5;

/** Source frame edge length (px). All modular frames are 512x512. */
export const MODULAR_FRAME_SIZE = 512;

/**
 * Per-hull visual scale multipliers for runtime compensation.
 *
 * Dictator was rendered/exported at asset-side scale 0.91 to avoid clipping
 * in the 512×512 frame. Runtime needs a visual-only compensation of 1.09
 * (≈ 1 / 0.91) so the hull appears at its intended size.
 *
 * Rules:
 *   - only hullId === "dictator" returns 1.09;
 *   - all other hulls return 1;
 *   - multiplier affects ONLY hull visual scale;
 *   - turret visual scale remains unchanged;
 *   - collision/hitbox/footprint/movement/range are untouched.
 *   - the multiplier is applied around the hull socket/origin so turret
 *     pivot alignment remains stable (no manual x/y offset, no zHeight).
 */
export const HULL_VISUAL_SCALE_MULTIPLIERS: Record<string, number> = {
  dictator: 1.09,
};

/** Returns the visual scale multiplier for a hull id (1.0 for non-dictator). */
export function getHullVisualScaleMultiplier(hullId: string): number {
  return HULL_VISUAL_SCALE_MULTIPLIERS[hullId] ?? 1;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ModularSpritePlacement {
  /** Texture key, or null when the sprite is unavailable (fallback). */
  textureKey: string | null;
  /** Origin (0..1) within the sprite. */
  origin: ScreenPoint;
  /** Screen position of the sprite origin. */
  position: ScreenPoint;
  /** Uniform display scale. */
  scale: number;
  /** Source frame display size (px) after scale. */
  displaySize: number;
}

export type ModularFallbackReason =
  | 'invalid-visual'
  | 'hull-texture-missing'
  | 'turret-texture-missing'
  | 'hull-and-turret-texture-missing'
  | 'hull-metadata-missing'
  | 'turret-metadata-missing'
  | null;

export interface ModularCompositionInput {
  visual: ModularVehicleVisual;
  /** Hull facing direction, dir16 (0..15). */
  hullDir16: GeneratedModularDir16;
  /** Turret facing direction, dir16 (0..15). */
  turretDir16: GeneratedModularDir16;
  /** Screen anchor: the ground-contact point the hull is centred on. */
  anchor: ScreenPoint;
  /** Predicate: is this texture key loaded/available? */
  textureExists: (key: string) => boolean;
  /** Optional display scale override. */
  displayScale?: number;
}

export interface ModularRenderPlan {
  /** True when both hull and turret textures are available. */
  available: boolean;
  /** Why a fallback is in effect (null when fully available). */
  fallbackReason: ModularFallbackReason;
  /** True when hull metadata was found (vs. centre default). */
  hullMetadataPresent: boolean;
  /** True when turret metadata was found (vs. centre default). */
  turretMetadataPresent: boolean;

  hull: ModularSpritePlacement;
  turret: ModularSpritePlacement;

  /** Resolved hull socket screen position (where the turret pivot lands). */
  socketScreen: ScreenPoint;
  /** Resolved turret pivot screen position (should equal socketScreen). */
  pivotScreen: ScreenPoint;

  /** Compass suffixes used (diagnostics). */
  hullDirSuffix: string;
  turretDirSuffix: string;
}

/**
 * Pure composition entry point. Always returns a complete plan; never
 * throws. Missing textures/metadata degrade to safe fallbacks with a
 * reason recorded.
 */
export function composeModularVehicle(
  input: ModularCompositionInput,
): ModularRenderPlan {
  const {
    visual,
    hullDir16,
    turretDir16,
    anchor,
    textureExists,
    displayScale = MODULAR_VEHICLE_DISPLAY_SCALE,
  } = input;

  const hullDirSuffix = MODULAR_DIR16_SUFFIXES[hullDir16];
  const turretDirSuffix = MODULAR_DIR16_SUFFIXES[turretDir16];

  // Hull visual scale: apply per-hull multiplier (Dictator = 1.09).
  // The multiplier is applied around the hull socket/origin so turret pivot
  // alignment remains stable. Turret scale remains unchanged.
  const hullScaleMultiplier = getHullVisualScaleMultiplier(visual.hullId);
  const hullVisualScale = displayScale * hullScaleMultiplier;
  const hullDisplaySize = MODULAR_FRAME_SIZE * hullVisualScale;
  const turretDisplaySize = MODULAR_FRAME_SIZE * displayScale;

  // Invalid visual: bail to a fully-fallback plan.
  if (!isValidModularVehicleVisual(visual)) {
    return buildFallbackPlan({
      anchor,
      displayScale,
      baseDisplaySize: turretDisplaySize,
      hullDirSuffix,
      turretDirSuffix,
      fallbackReason: 'invalid-visual',
    });
  }

  // Resolve texture keys.
  const hullKey = getGeneratedHullTextureKey(
    visual.hullId,
    visual.faction,
    visual.hullMod,
    hullDir16,
  );
  const turretKey = getGeneratedTurretTextureKey(
    visual.turretId,
    visual.faction,
    visual.turretMod,
    turretDir16,
  );
  const hullAvailable = textureExists(hullKey);
  const turretAvailable = textureExists(turretKey);

  // Resolve metadata (socket/pivot). Fall back to frame centre when absent.
  const socketMeta = getHullSocketAnchor(visual.hullId, visual.hullMod, hullDir16);
  const pivotMeta = getTurretPivotAnchor(
    visual.turretId,
    visual.turretMod,
    turretDir16,
  );
  const hullMetadataPresent = socketMeta !== null;
  const turretMetadataPresent = pivotMeta !== null;
  const socketNorm = socketMeta ?? FALLBACK_FRAME_CENTER;
  const pivotNorm = pivotMeta ?? FALLBACK_FRAME_CENTER;

  // Hull is centred on the screen anchor (ground-contact point).
  const hullOrigin: ScreenPoint = { x: 0.5, y: 0.5 };
  const hullCenter: ScreenPoint = { x: anchor.x, y: anchor.y };

  // Socket screen position = hull centre + normalized socket offset.
  const socketScreen: ScreenPoint = {
    x: hullCenter.x + (socketNorm.nx - 0.5) * hullDisplaySize,
    y: hullCenter.y + (socketNorm.ny - 0.5) * hullDisplaySize,
  };

  // Turret pivot must land on the hull socket. Place the turret centre so
  // that its (pivotNorm) point coincides with socketScreen.
  const turretOrigin: ScreenPoint = { x: 0.5, y: 0.5 };
  const turretCenter: ScreenPoint = {
    x: socketScreen.x - (pivotNorm.nx - 0.5) * turretDisplaySize,
    y: socketScreen.y - (pivotNorm.ny - 0.5) * turretDisplaySize,
  };
  // Pivot screen position computed from the placed turret (equals socket).
  const pivotScreen: ScreenPoint = {
    x: turretCenter.x + (pivotNorm.nx - 0.5) * turretDisplaySize,
    y: turretCenter.y + (pivotNorm.ny - 0.5) * turretDisplaySize,
  };

  // Determine fallback reason from availability.
  let fallbackReason: ModularFallbackReason = null;
  if (!hullAvailable && !turretAvailable) {
    fallbackReason = 'hull-and-turret-texture-missing';
  } else if (!hullAvailable) {
    fallbackReason = 'hull-texture-missing';
  } else if (!turretAvailable) {
    fallbackReason = 'turret-texture-missing';
  } else if (!hullMetadataPresent) {
    fallbackReason = 'hull-metadata-missing';
  } else if (!turretMetadataPresent) {
    fallbackReason = 'turret-metadata-missing';
  }

  return {
    available: hullAvailable && turretAvailable,
    fallbackReason,
    hullMetadataPresent,
    turretMetadataPresent,
    hull: {
      textureKey: hullAvailable ? hullKey : null,
      origin: hullOrigin,
      position: hullCenter,
      scale: hullVisualScale,
      displaySize: hullDisplaySize,
    },
    turret: {
      textureKey: turretAvailable ? turretKey : null,
      origin: turretOrigin,
      position: turretCenter,
      scale: displayScale,
      displaySize: turretDisplaySize,
    },
    socketScreen,
    pivotScreen,
    hullDirSuffix,
    turretDirSuffix,
  };
}

function buildFallbackPlan(args: {
  anchor: ScreenPoint;
  displayScale: number;
  baseDisplaySize: number;
  hullDirSuffix: string;
  turretDirSuffix: string;
  fallbackReason: ModularFallbackReason;
}): ModularRenderPlan {
  const center = { x: 0.5, y: 0.5 };
  return {
    available: false,
    fallbackReason: args.fallbackReason,
    hullMetadataPresent: false,
    turretMetadataPresent: false,
    hull: {
      textureKey: null,
      origin: center,
      position: { ...args.anchor },
      scale: args.displayScale,
      displaySize: args.baseDisplaySize,
    },
    turret: {
      textureKey: null,
      origin: center,
      position: { ...args.anchor },
      scale: args.displayScale,
      displaySize: args.baseDisplaySize,
    },
    socketScreen: { ...args.anchor },
    pivotScreen: { ...args.anchor },
    hullDirSuffix: args.hullDirSuffix,
    turretDirSuffix: args.turretDirSuffix,
  };
}
