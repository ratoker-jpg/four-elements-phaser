/**
 * Typed metadata contract for generated vehicle assets.
 *
 * RUNTIME-01: Defines the metadata schema that describes generated
 * hull and turret sprite families. This contract is designed to be
 * populated from offline tools, build scripts, or explicit config
 * — NOT from runtime guessing or PNG pixel inspection.
 *
 * Key design decisions:
 *   - imageSize is explicit metadata input, not runtime-truth
 *   - If turret source size is unknown, the contract allows null
 *     and the consumer must handle it explicitly
 *   - Metadata is per-family (hull or turret), not per-direction
 *   - Direction count is always 16 for generated assets
 *   - Pivot/socket references are optional (populated later by
 *     the renderer composition step)
 *
 * This module does NOT import Phaser. It is pure TypeScript.
 */

// ─── Base types ─────────────────────────────────────────────────

/** Asset family: hull sprites or turret sprites. */
export type VehicleAssetFamily = 'hull' | 'turret';

/** A 2D integer size in pixels. */
export interface ImageSize {
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

/** Normalized coordinates (0..1) within a sprite image. */
export interface NormalizedCoord {
  /** X position: 0 = left edge, 1 = right edge. */
  nx: number;
  /** Y position: 0 = top edge, 1 = bottom edge. */
  ny: number;
}

// ─── Generated asset metadata ───────────────────────────────────

/**
 * Metadata for one generated vehicle asset family.
 *
 * This describes a single (hull or turret) × id × faction × mod
 * sprite set. Each set contains 16 direction PNGs with identical
 * dimensions and layout.
 *
 * imageSize is required for hulls (known: 512×512) but may be
 * null for turrets if the source dimensions haven't been measured
 * yet. The consumer must handle null imageSize explicitly rather
 * than falling back to a guessed default.
 *
 * The metadata is intended to be created offline (build tool,
 * explicit config, or calibration step) and consumed at runtime
 * by the loader and renderer.
 */
export interface GeneratedVehicleAssetMetadata {
  /** Whether this is a hull or turret family. */
  family: VehicleAssetFamily;

  /** Asset ID within the family (e.g. 'wasp' for hull, 'smoky' for turret). */
  id: string;

  /** Faction colour variant. */
  faction: string;

  /** Modification tier. */
  mod: string;

  /** Number of direction sprites in this set. Always 16 for generated assets. */
  dirCount: 16;

  /**
   * Size of each PNG in this set, in pixels.
   *
   * For hulls: always 512×512 (known from the generator).
   * For turrets: may be null if source dimensions haven't been measured.
   *
   * When null, the consumer must NOT guess — it must use an explicit
   * fallback or skip rendering until dimensions are provided.
   */
  imageSize: ImageSize | null;

  /** Optional pivot point in normalized coordinates. Used by turret attachment math. */
  pivot?: NormalizedCoord;

  /** Optional socket reference (hull only). Where the turret mounts. */
  socket?: NormalizedCoord;

  /** Texture key prefix for this family (e.g. 'generated_hull_wasp_cyan_m0'). */
  keyPrefix: string;

  /** Asset path prefix for this family (e.g. 'assets/units/hulls/wasp/cyan/m0'). */
  pathPrefix: string;
}

// ─── Metadata builder helpers ───────────────────────────────────

/**
 * Known hull image size: all generated hulls are 512×512 RGBA.
 */
export const HULL_IMAGE_SIZE: ImageSize = { width: 512, height: 512 };

/**
 * Build a metadata object for a generated hull set.
 *
 * imageSize is always populated for hulls (known: 512×512).
 * Socket position defaults to hull center (0.5, 0.5) if not provided.
 */
export function buildHullMetadata(params: {
  id: string;
  faction: string;
  mod: string;
  socket?: NormalizedCoord;
}): GeneratedVehicleAssetMetadata {
  return {
    family: 'hull',
    id: params.id,
    faction: params.faction,
    mod: params.mod,
    dirCount: 16,
    imageSize: HULL_IMAGE_SIZE,
    socket: params.socket ?? { nx: 0.5, ny: 0.5 },
    keyPrefix: `generated_hull_${params.id}_${params.faction}_${params.mod}`,
    pathPrefix: `assets/units/hulls/${params.id}/${params.faction}/${params.mod}`,
  };
}

/**
 * Build a metadata object for a generated turret set.
 *
 * imageSize is null by default for turrets — it must be provided
 * explicitly when the source dimensions are known. If not provided,
 * the consumer must handle null imageSize as "unknown" rather than
 * guessing a default.
 */
export function buildTurretMetadata(params: {
  id: string;
  faction: string;
  mod: string;
  imageSize?: ImageSize;
  pivot?: NormalizedCoord;
}): GeneratedVehicleAssetMetadata {
  return {
    family: 'turret',
    id: params.id,
    faction: params.faction,
    mod: params.mod,
    dirCount: 16,
    imageSize: params.imageSize ?? null,
    pivot: params.pivot,
    keyPrefix: `generated_turret_${params.id}_${params.faction}_${params.mod}`,
    pathPrefix: `assets/units/turrets/${params.id}/${params.faction}/${params.mod}`,
  };
}

/**
 * Validate that a metadata object has the required fields populated.
 *
 * Returns an array of validation error strings. Empty array = valid.
 * This is used by the loader and renderer to guard against incomplete
 * metadata before attempting to use it.
 */
export function validateVehicleAssetMetadata(
  meta: GeneratedVehicleAssetMetadata,
): string[] {
  const errors: string[] = [];

  if (!meta.id) {
    errors.push('id is required');
  }
  if (!meta.faction) {
    errors.push('faction is required');
  }
  if (!meta.mod) {
    errors.push('mod is required');
  }
  if (meta.dirCount !== 16) {
    errors.push(`dirCount must be 16, got ${meta.dirCount}`);
  }
  if (meta.family === 'hull' && meta.imageSize === null) {
    errors.push('hull metadata must have imageSize (known: 512×512)');
  }
  if (meta.family === 'turret' && meta.imageSize === null) {
    // turret imageSize may be null — this is a warning, not an error
    // but we flag it so the consumer knows
    errors.push('turret imageSize is null — dimensions unknown, must be provided explicitly');
  }
  if (!meta.keyPrefix) {
    errors.push('keyPrefix is required');
  }
  if (!meta.pathPrefix) {
    errors.push('pathPrefix is required');
  }

  return errors;
}

// ─── Pilot metadata constants (RUNTIME-02A) ──────────────────────

/**
 * Confirmed turret image size: 512×512 RGBA.
 * Verified from the actual Smoky cyan m0 pilot PNGs.
 */
export const TURRET_IMAGE_SIZE: ImageSize = { width: 512, height: 512 };

/**
 * Smoky cyan m0 turret pilot metadata.
 *
 * imageSize confirmed from actual PNGs (512×512 RGBA).
 * pivot at (0.5, 0.5) = image center, verified from the staging
 * manifest runtime02a_smoky_cyan_m0_pivot_subset.json where
 * anchorNorm is consistently (0.5, 0.5) for all 16 directions.
 *
 * This is the first turret metadata entry with confirmed dimensions.
 * Future turrets should follow the same pattern once their PNGs
 * are imported and dimensions verified.
 */
export const SMOKY_CYAN_M0_TURRET_METADATA: GeneratedVehicleAssetMetadata = {
  family: 'turret',
  id: 'smoky',
  faction: 'cyan',
  mod: 'm0',
  dirCount: 16,
  imageSize: TURRET_IMAGE_SIZE,
  pivot: { nx: 0.5, ny: 0.5 },
  keyPrefix: 'generated_turret_smoky_cyan_m0',
  pathPrefix: 'assets/units/turrets/smoky/cyan/m0',
};
