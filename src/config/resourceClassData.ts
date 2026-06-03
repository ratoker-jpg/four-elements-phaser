/**
 * Production resource class config data — full accepted data model for 6 deposit classes.
 *
 * CORE-STEP-02B: Creates production resource class configs alongside existing
 * runtime resource data (types.ts RESOURCE_RAW_AMOUNTS). Existing runtime
 * resource data remains the active runtime source. Production configs will
 * be wired into map generation and harvester logic in later steps.
 *
 * Amount values are reference placeholders from MECHANICS_DECISIONS, not
 * final game balance:
 * - very_poor: 150-250 (starter zone)
 * - poor: 300-500 (starter zone)
 * - medium: 800-1200 (starter/side zone)
 * - rich: 1800-2500 (side/contested zone)
 * - very_rich: 3500-5000 (contested zone)
 * - infinite: never depletes (center 2x2)
 *
 * Asset keys match the existing assetManifest entries for industrial resources.
 * The 6-class production model supersedes the old 4-class runtime model
 * (small/medium/large/infinite) but does NOT replace it yet.
 */

import type {
  ResourceClassConfig,
  AcceptedResourceClassId,
} from './coreMechanicsTypes';

// ─── Accepted resource class configs ─────────────────────────────────

/** All 6 accepted production resource class configs keyed by ID. */
export const RESOURCE_CLASS_CONFIGS: Record<AcceptedResourceClassId, ResourceClassConfig> = {

  very_poor: {
    id: 'very_poor',
    displayNameKey: 'resource_very_poor',
    descriptionKey: 'resource_very_poor_desc',
    assetKey: 'resource_industrial_very_poor_01',
    amountMin: 150,
    amountMax: 250,
    isInfinite: false,
    strategicRole: 'Starter zone minimal deposit',
    suggestedPlacementZone: 'starter',
    footprint: 1,
  },

  poor: {
    id: 'poor',
    displayNameKey: 'resource_poor',
    descriptionKey: 'resource_poor_desc',
    assetKey: 'resource_industrial_poor_01',
    amountMin: 300,
    amountMax: 500,
    isInfinite: false,
    strategicRole: 'Starter zone secondary deposit',
    suggestedPlacementZone: 'starter',
    footprint: 1,
  },

  medium: {
    id: 'medium',
    displayNameKey: 'resource_medium',
    descriptionKey: 'resource_medium_desc',
    assetKey: 'resource_industrial_medium_01',
    amountMin: 800,
    amountMax: 1200,
    isInfinite: false,
    strategicRole: 'Side/intermediate zone standard deposit',
    suggestedPlacementZone: 'side',
    footprint: 1,
  },

  rich: {
    id: 'rich',
    displayNameKey: 'resource_rich',
    descriptionKey: 'resource_rich_desc',
    assetKey: 'resource_industrial_rich_01',
    amountMin: 1800,
    amountMax: 2500,
    isInfinite: false,
    strategicRole: 'Contested zone high-value deposit',
    suggestedPlacementZone: 'contested',
    footprint: 1,
  },

  very_rich: {
    id: 'very_rich',
    displayNameKey: 'resource_very_rich',
    descriptionKey: 'resource_very_rich_desc',
    assetKey: 'resource_industrial_very_rich_01',
    amountMin: 3500,
    amountMax: 5000,
    isInfinite: false,
    strategicRole: 'Contested zone premium deposit',
    suggestedPlacementZone: 'contested',
    footprint: 1,
  },

  infinite: {
    id: 'infinite',
    displayNameKey: 'resource_infinite',
    descriptionKey: 'resource_infinite_desc',
    assetKey: 'resource_industrial_infinite_center_2x2_01',
    amountMin: 50000,
    amountMax: 50000,
    isInfinite: true,
    strategicRole: 'Center zone infinite deposit — never depletes',
    suggestedPlacementZone: 'center',
    footprint: 2,
  },

}; // end RESOURCE_CLASS_CONFIGS

// ─── Lookup helpers ──────────────────────────────────────────────────

/** Get a production resource class config by ID. Returns undefined if not found. */
export function getResourceClassConfig(id: string): ResourceClassConfig | undefined {
  return RESOURCE_CLASS_CONFIGS[id as AcceptedResourceClassId];
}

/** All accepted resource class IDs in stable order (from poorest to richest). */
export const ALL_ACCEPTED_RESOURCE_CLASS_IDS: readonly AcceptedResourceClassId[] =
  Object.keys(RESOURCE_CLASS_CONFIGS) as AcceptedResourceClassId[];

/** Get only finite (non-infinite) resource class IDs. */
export const FINITE_RESOURCE_CLASS_IDS: readonly AcceptedResourceClassId[] =
  ALL_ACCEPTED_RESOURCE_CLASS_IDS.filter(id => !RESOURCE_CLASS_CONFIGS[id].isInfinite);

/** Get only infinite resource class IDs. */
export const INFINITE_RESOURCE_CLASS_IDS: readonly AcceptedResourceClassId[] =
  ALL_ACCEPTED_RESOURCE_CLASS_IDS.filter(id => RESOURCE_CLASS_CONFIGS[id].isInfinite);
