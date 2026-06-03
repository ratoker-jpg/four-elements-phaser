/**
 * Building runtime mapping — bridges production config IDs to runtime BuildingType.
 *
 * CORE-STEP-04H+: The production config (buildingData.ts) uses underscored
 * AcceptedBuildingId keys (raw_storage, energy_storage, etc.). The runtime
 * system (construction.ts BUILDING_CONFIG, types.ts BuildingType) uses
 * hyphenated keys (raw-storage, matter-storage, etc.).
 *
 * This module provides the canonical mapping and display name resolution
 * so that the HUD and other UI can use production config display names
 * while the runtime construction system uses BuildingType keys.
 *
 * Design rules:
 * - All helpers are pure functions with no side effects
 * - Mapping is lossless: every gameplay-ready building has a unique mapping
 * - Legacy types (matter-storage) are preserved for backward compatibility
 */

import type { BuildingType } from '../state/types';
import { t } from './localization';
import { type AcceptedBuildingId } from './coreMechanicsTypes';
import { BUILDING_CONFIGS } from './buildingData';

// ─── BuildingType ↔ AcceptedBuildingId mapping ───────────────────────

/**
 * Mapping from runtime BuildingType to production AcceptedBuildingId.
 *
 * Used to look up Russian display names and role descriptions from the
 * production config for display in the HUD.
 *
 * Key mapping decisions:
 * - 'matter-storage' → 'energy_storage' (player sees "Хранилище энергии")
 * - 'energy-plant' → 'energy_reactor' (visual-ready, no mechanic)
 */
export const BUILDING_TYPE_TO_PRODUCTION_ID: Partial<Record<BuildingType, AcceptedBuildingId>> = {
  'separator': 'separator',
  'raw-storage': 'raw_storage',
  'matter-storage': 'energy_storage',
  'element-storage': 'elements_storage',
  'power-plant': 'power_plant',
  'energy-plant': 'energy_reactor',
  'units-factory': 'units_factory',
};

/**
 * Reverse mapping: production AcceptedBuildingId → runtime BuildingType.
 *
 * Used when converting production config data back to runtime types.
 */
export const PRODUCTION_ID_TO_BUILDING_TYPE: Partial<Record<AcceptedBuildingId, BuildingType>> = {
  'separator': 'separator',
  'raw_storage': 'raw-storage',
  'energy_storage': 'matter-storage',
  'elements_storage': 'element-storage',
  'power_plant': 'power-plant',
  'energy_reactor': 'energy-plant',
  'units_factory': 'units-factory',
};

// ─── Display name resolution ─────────────────────────────────────────

/**
 * Get the Russian display name for a runtime BuildingType.
 *
 * Uses the production config's displayNameKey resolved through the
 * localization layer. Falls back to the raw BuildingType string if
 * no mapping exists.
 */
export function getBuildingDisplayName(buildingType: BuildingType): string {
  const prodId = BUILDING_TYPE_TO_PRODUCTION_ID[buildingType];
  if (prodId) {
    const config = BUILDING_CONFIGS[prodId];
    if (config?.displayNameKey) {
      return t(config.displayNameKey);
    }
  }
  return buildingType;
}

/**
 * Get the Russian role/description for a runtime BuildingType.
 *
 * Uses the production config's roleKey resolved through the
 * localization layer. Falls back to empty string if no mapping exists.
 */
export function getBuildingRoleDescription(buildingType: BuildingType): string {
  const prodId = BUILDING_TYPE_TO_PRODUCTION_ID[buildingType];
  if (prodId) {
    const config = BUILDING_CONFIGS[prodId];
    if (config?.roleKey) {
      return t(config.roleKey);
    }
  }
  return '';
}

/**
 * Get the readiness class for a runtime BuildingType.
 *
 * Uses the production config's readiness field. Falls back to 'deferred'
 * if no mapping exists (safest default).
 */
export function getBuildingReadiness(buildingType: BuildingType): 'gameplay_ready' | 'visual_ready' | 'deferred' {
  const prodId = BUILDING_TYPE_TO_PRODUCTION_ID[buildingType];
  if (prodId) {
    const config = BUILDING_CONFIGS[prodId];
    if (config?.readiness) {
      return config.readiness;
    }
  }
  return 'deferred';
}

/**
 * Check if a building type is gameplay-ready (has mechanics).
 *
 * Visual-ready and deferred buildings are NOT gameplay-ready.
 */
export function isGameplayReadyBuilding(buildingType: BuildingType): boolean {
  return getBuildingReadiness(buildingType) === 'gameplay_ready';
}

/**
 * Check if a building type is visual-ready (can be placed/seen but
 * no mechanic yet).
 */
export function isVisualReadyBuilding(buildingType: BuildingType): boolean {
  return getBuildingReadiness(buildingType) === 'visual_ready';
}
