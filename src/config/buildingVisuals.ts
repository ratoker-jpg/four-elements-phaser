/**
 * Building visual profiles — per-building-type rendering parameters.
 *
 * BUILD-01A: Introduced to support dev-only tuning of Separator PNG placement.
 * Each profile controls how a completed building PNG is positioned and scaled
 * on the isometric map.
 *
 * Profiles are keyed by BuildingType. Only types with approved PNG assets
 * need entries here; others render as green diamond placeholders.
 */

import type { BuildingType } from '../state/types';

// ─── Profile type ─────────────────────────────────────────────────

/** Visual profile for a completed building PNG on the isometric map. */
export interface BuildingVisualProfile {
  /** Target display width in pixels. Scale = displayWidth / texture.width. */
  displayWidth: number;
  /** Phaser origin X (0–1). 0.5 = horizontal center. */
  originX: number;
  /** Phaser origin Y (0–1). 0.75 = 75% down — typical "ground point" for isometric. */
  originY: number;
  /** Pixel offset added to the computed world X position. */
  offsetX: number;
  /** Pixel offset added to the computed world Y position. */
  offsetY: number;
}

// ─── Default profiles ─────────────────────────────────────────────

/** Default visual profile for the Separator building. */
const SEPARATOR_DEFAULT: BuildingVisualProfile = {
  displayWidth: 120,
  originX: 0.5,
  originY: 0.75,
  offsetX: 0,
  offsetY: 0,
};

/**
 * Default (approved baseline) building visual profiles keyed by BuildingType.
 * These values are the "known good" starting point.
 */
export const DEFAULT_BUILDING_PROFILES: Partial<Record<BuildingType, BuildingVisualProfile>> = {
  separator: { ...SEPARATOR_DEFAULT },
};

// ─── Mutable runtime profiles ─────────────────────────────────────

/**
 * Mutable runtime building visual profiles.
 * The dev tuner modifies these in place; production code reads from here.
 * On reset, values are restored from DEFAULT_BUILDING_PROFILES.
 */
export const buildingProfiles: Partial<Record<BuildingType, BuildingVisualProfile>> = {};

/** Initialise runtime profiles from defaults (call once at startup). */
export function initBuildingProfiles(): void {
  for (const [key, profile] of Object.entries(DEFAULT_BUILDING_PROFILES)) {
    buildingProfiles[key as BuildingType] = { ...profile! };
  }
}

/** Get the effective profile for a building type, or null if none exists. */
export function getBuildingProfile(type: BuildingType): BuildingVisualProfile | undefined {
  return buildingProfiles[type];
}

/** Reset a single building type's profile to its default. */
export function resetBuildingProfile(type: BuildingType): void {
  const def = DEFAULT_BUILDING_PROFILES[type];
  if (def) {
    buildingProfiles[type] = { ...def };
  }
}

/** Reset all building profiles to their defaults. */
export function resetAllBuildingProfiles(): void {
  initBuildingProfiles();
}

/** Format a building profile as a ready-to-copy config snippet. */
export function formatProfileSnippet(type: BuildingType): string {
  const p = buildingProfiles[type];
  if (!p) return `// No profile for "${type}"`;
  return (
    `// ${type} visual profile (tuned)\n` +
    `{ displayWidth: ${p.displayWidth}, originX: ${p.originX.toFixed(2)}, originY: ${p.originY.toFixed(2)}, offsetX: ${p.offsetX}, offsetY: ${p.offsetY} }`
  );
}

// Initialise on module load
initBuildingProfiles();
