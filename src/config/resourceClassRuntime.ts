/**
 * Resource class runtime helpers — bridge between production config and runtime.
 *
 * CORE-STEP-03A: Provides runtime-facing helpers that map from the accepted
 * 6-class resource model (resourceClassData.ts) to asset keys, amount ranges,
 * display names, and legacy ResourceType compatibility.
 *
 * This module is the single source of truth for:
 * - Resolving a resource class ID to its industrial asset key
 * - Resolving a resource class ID to its amount range
 * - Checking whether a resource class is infinite
 * - Getting the localization key for a resource class display name
 * - Mapping from the legacy ResourceType (small/medium/large/infinite)
 *   to the accepted AcceptedResourceClassId (very_poor..infinite)
 *
 * The legacy mapping is compatibility only — it does NOT change runtime
 * generation output. Map generation still uses old ResourceType internally.
 * Step 03B will rewrite map generation to use the 6-class model directly.
 *
 * Design rules:
 * - All helpers are pure functions with no side effects
 * - Unknown/invalid inputs return safe defaults (undefined or M0 fallback)
 * - Legacy mapping is clearly separated from the new 6-class model
 * - No Phaser imports (pure TS state layer)
 */

import type { AcceptedResourceClassId } from './coreMechanicsTypes';
import type { ResourceType } from '../state/types';
import {
  RESOURCE_CLASS_CONFIGS,
  getResourceClassConfig,
} from './resourceClassData';

// ─── Asset key resolution ───────────────────────────────────────────

/**
 * Get the industrial asset key for a resource class.
 *
 * Returns the assetKey from the production config, which matches
 * entries in ASSET_KEYS and GENERATED_ASSET_MANIFEST.
 *
 * Returns undefined if the resource class ID is not recognized.
 */
export function getResourceClassAssetKey(resourceClass: string): string | undefined {
  const config = getResourceClassConfig(resourceClass);
  return config?.assetKey;
}

// ─── Amount range resolution ────────────────────────────────────────

/** Amount range for a resource class. */
export interface ResourceAmountRange {
  /** Minimum raw mineral amount. */
  min: number;
  /** Maximum raw mineral amount. */
  max: number;
}

/**
 * Get the amount range for a resource class.
 *
 * For infinite resources, returns { min: 50000, max: 50000 } which
 * represents the practical "never depletes" amount.
 *
 * Returns undefined if the resource class ID is not recognized.
 */
export function getResourceClassAmountRange(resourceClass: string): ResourceAmountRange | undefined {
  const config = getResourceClassConfig(resourceClass);
  if (!config) return undefined;
  return { min: config.amountMin, max: config.amountMax };
}

// ─── Infinite check ─────────────────────────────────────────────────

/**
 * Check whether a resource class is infinite (never depletes).
 *
 * Only the 'infinite' class returns true.
 * Returns false for unknown resource class IDs.
 */
export function isInfiniteResourceClass(resourceClass: string): boolean {
  const config = getResourceClassConfig(resourceClass);
  return config?.isInfinite ?? false;
}

// ─── Display name key resolution ────────────────────────────────────

/**
 * Get the localization key for a resource class display name.
 *
 * Use t(getResourceClassDisplayNameKey(id)) to get the Russian display name.
 * Returns undefined if the resource class ID is not recognized.
 */
export function getResourceClassDisplayNameKey(resourceClass: string): string | undefined {
  const config = getResourceClassConfig(resourceClass);
  return config?.displayNameKey;
}

// ─── Legacy ResourceType compatibility mapping ──────────────────────

/**
 * Mapping from the legacy runtime ResourceType (small/medium/large/infinite)
 * to the accepted 6-class AcceptedResourceClassId.
 *
 * This mapping is compatibility only — it provides a bridge from the old
 * 4-class runtime model to the new 6-class production model without
 * changing map generation or harvester behavior.
 *
 * Mapping rationale:
 * - old 'small' -> 'very_poor' (smallest tier, starter zone minimal)
 * - old 'medium' -> 'poor' (second smallest, starter zone secondary)
 * - old 'large' -> 'rich' (high-value, contested zone)
 * - old 'infinite' -> 'infinite' (center, never depletes)
 *
 * Note: There is no perfect 1:1 mapping because the old model had 4 tiers
 * and the new model has 6. The mapping assigns each old type to the
 * closest accepted class by amount. 'medium' maps to 'poor' rather than
 * the new 'medium' because the old 'medium' amount (60) is closer to
 * poor's range (300-500 concept) than the new medium (800-1200).
 */
export const LEGACY_RESOURCE_TYPE_MAPPING: Record<ResourceType, AcceptedResourceClassId> = {
  small: 'very_poor',
  medium: 'poor',
  large: 'rich',
  infinite: 'infinite',
};

/**
 * Map a legacy ResourceType to the closest accepted AcceptedResourceClassId.
 *
 * This is a compatibility helper for code that still uses the old
 * ResourceType enum. New code should use AcceptedResourceClassId directly.
 *
 * The mapping is lossy — the old 4-class model cannot distinguish
 * between e.g. 'poor' and 'medium', or 'rich' and 'very_rich'.
 * Step 03B will eliminate this mapping by switching generation to
 * the 6-class model directly.
 */
export function legacyResourceTypeToResourceClass(legacyType: ResourceType): AcceptedResourceClassId {
  return LEGACY_RESOURCE_TYPE_MAPPING[legacyType];
}

/**
 * Get the industrial asset key for a legacy ResourceType.
 *
 * Convenience helper that combines legacyResourceTypeToResourceClass
 * and getResourceClassAssetKey. Returns undefined if the mapping
 * or config lookup fails.
 */
export function getLegacyResourceTypeAssetKey(legacyType: ResourceType): string | undefined {
  const resourceClass = legacyResourceTypeToResourceClass(legacyType);
  return getResourceClassAssetKey(resourceClass);
}

// ─── Asset key validation ───────────────────────────────────────────

/** Set of all valid industrial resource asset keys from ASSET_KEYS. */
const INDUSTRIAL_ASSET_KEYS: ReadonlySet<string> = new Set([
  'resource_industrial_very_poor_01',
  'resource_industrial_poor_01',
  'resource_industrial_medium_01',
  'resource_industrial_rich_01',
  'resource_industrial_very_rich_01',
  'resource_industrial_infinite_center_2x2_01',
]);

/**
 * Check whether an asset key is a valid industrial resource asset key.
 *
 * Checks against the known set of ASSET_KEYS and GENERATED_ASSET_MANIFEST
 * industrial resource entries.
 */
export function isValidIndustrialResourceAssetKey(assetKey: string): boolean {
  return INDUSTRIAL_ASSET_KEYS.has(assetKey);
}

/**
 * Validate that all 6 resource class configs have asset keys that exist
 * in the industrial resource asset key set.
 *
 * Returns an array of validation errors (empty if all valid).
 */
export function validateResourceClassAssetKeys(): string[] {
  const errors: string[] = [];
  for (const [classId, config] of Object.entries(RESOURCE_CLASS_CONFIGS)) {
    if (!isValidIndustrialResourceAssetKey(config.assetKey)) {
      errors.push(`Resource class '${classId}' has assetKey '${config.assetKey}' not found in industrial asset keys`);
    }
  }
  return errors;
}
