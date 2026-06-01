/**
 * Blockout vehicle data — composition profiles for test combinations.
 *
 * A vehicle = one body + one weapon.
 * These are readability and systems tests, not final balance decisions.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { VehicleProfile } from './blockoutProfiles';

/** All vehicle profiles keyed by ID. */
export const VEHICLE_PROFILES: Record<string, VehicleProfile> = {
  'wasp-smoky': {
    id: 'wasp-smoky',
    bodyId: 'wasp',
    weaponId: 'smoky',
    roleLabel: 'fast light single-shot unit',
    blockoutEnabled: true,
  },
  'hornet-ricochet': {
    id: 'hornet-ricochet',
    bodyId: 'hornet',
    weaponId: 'ricochet',
    roleLabel: 'fast bounce projectile unit',
    blockoutEnabled: true,
  },
  'hunter-smoky': {
    id: 'hunter-smoky',
    bodyId: 'hunter',
    weaponId: 'smoky',
    roleLabel: 'medium single-shot unit',
    blockoutEnabled: true,
  },
  'hunter-twins': {
    id: 'hunter-twins',
    bodyId: 'hunter',
    weaponId: 'twins',
    roleLabel: 'medium projectile spam unit',
    blockoutEnabled: true,
  },
  'viking-isida': {
    id: 'viking-isida',
    bodyId: 'viking',
    weaponId: 'isida',
    roleLabel: 'support beam test unit',
    blockoutEnabled: true,
  },
  'dictator-railgun': {
    id: 'dictator-railgun',
    bodyId: 'dictator',
    weaponId: 'railgun',
    roleLabel: 'large fast rear-mounted linear pierce unit',
    blockoutEnabled: true,
  },
  'titan-vulcan': {
    id: 'titan-vulcan',
    bodyId: 'titan',
    weaponId: 'vulcan',
    roleLabel: 'heavy rapid-fire/overheat unit',
    blockoutEnabled: true,
  },
  'mammoth-thunder': {
    id: 'mammoth-thunder',
    bodyId: 'mammoth',
    weaponId: 'thunder',
    roleLabel: 'heavy splash/frontline unit',
    blockoutEnabled: true,
  },
  'mammoth-railgun': {
    id: 'mammoth-railgun',
    bodyId: 'mammoth',
    weaponId: 'railgun',
    roleLabel: 'super-heavy long-range pierce unit',
    blockoutEnabled: true,
  },
};

/** All vehicle profile IDs. */
export const ALL_VEHICLE_IDS = Object.keys(VEHICLE_PROFILES);

/** Get a vehicle profile by ID. Returns undefined if not found. */
export function getVehicleProfile(id: string): VehicleProfile | undefined {
  return VEHICLE_PROFILES[id];
}

/** Minimum expected spawn set for BLOCKOUT-02H dev/arena mode. */
export const BLOCKOUT_SPAWN_VEHICLE_IDS = [
  'wasp-smoky',
  'hunter-smoky',
  'dictator-railgun',
  'mammoth-thunder',
] as const;
