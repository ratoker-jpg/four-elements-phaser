/**
 * Blockout body data — profile data for all 7 accepted hulls.
 *
 * M3 values are reference placeholders, not final game balance.
 * Mount offsets are approximate and tunable.
 * Blockout shapes determine renderer geometry sizes.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { BodyProfile } from './blockoutProfiles';

/** All body profiles keyed by ID. */
export const BODY_PROFILES: Record<string, BodyProfile> = {
  wasp: {
    id: 'wasp',
    displayName: 'Wasp',
    roleLabel: 'light fast scout / hit-and-run',
    referenceM3: {
      hp: 180,
      maxSpeed: 13.0,
      turnSpeedDeg: 150,
      massKg: 2200,
      enginePower: 1300,
    },
    mountCategory: 'rear',
    mountOffsetNormalized: { x: 0.2, y: 0.5 },
    blockoutShape: 'small_fast',
  },
  hornet: {
    id: 'hornet',
    displayName: 'Hornet',
    roleLabel: 'fast light-medium raider',
    referenceM3: {
      hp: 210,
      maxSpeed: 12.0,
      turnSpeedDeg: 130,
      massKg: 2400,
      enginePower: 1400,
    },
    mountCategory: 'center_rear',
    mountOffsetNormalized: { x: 0.35, y: 0.5 },
    blockoutShape: 'light_fast',
  },
  hunter: {
    id: 'hunter',
    displayName: 'Hunter',
    roleLabel: 'universal medium',
    referenceM3: {
      hp: 285,
      maxSpeed: 10.0,
      turnSpeedDeg: 140,
      massKg: 3000,
      enginePower: 1400,
    },
    mountCategory: 'center',
    mountOffsetNormalized: { x: 0.5, y: 0.5 },
    blockoutShape: 'medium',
  },
  viking: {
    id: 'viking',
    displayName: 'Viking',
    roleLabel: 'reinforced universal medium',
    referenceM3: {
      hp: 315,
      maxSpeed: 9.0,
      turnSpeedDeg: 110,
      massKg: 3000,
      enginePower: 1500,
    },
    mountCategory: 'center',
    mountOffsetNormalized: { x: 0.5, y: 0.5 },
    blockoutShape: 'medium',
  },
  dictator: {
    id: 'dictator',
    displayName: 'Dictator',
    roleLabel: 'large fast assault body',
    referenceM3: {
      hp: 345,
      maxSpeed: 8.0,
      turnSpeedDeg: 130,
      massKg: 3300,
      enginePower: 1500,
    },
    mountCategory: 'rear',
    mountOffsetNormalized: { x: 0.2, y: 0.5 },
    blockoutShape: 'large_fast',
  },
  titan: {
    id: 'titan',
    displayName: 'Titan',
    roleLabel: 'heavy frontline',
    referenceM3: {
      hp: 420,
      maxSpeed: 6.0,
      turnSpeedDeg: 90,
      massKg: 5000,
      enginePower: 1600,
    },
    mountCategory: 'front_center',
    mountOffsetNormalized: { x: 0.75, y: 0.5 },
    blockoutShape: 'heavy',
  },
  mammoth: {
    id: 'mammoth',
    displayName: 'Mammoth',
    roleLabel: 'super-heavy fortress',
    referenceM3: {
      hp: 500,
      maxSpeed: 5.0,
      turnSpeedDeg: 80,
      massKg: 5500,
      enginePower: 1500,
    },
    mountCategory: 'front_center',
    mountOffsetNormalized: { x: 0.75, y: 0.5 },
    blockoutShape: 'super_heavy',
  },
};

/** Ordered list of all body IDs. */
export const ALL_BODY_IDS = Object.keys(BODY_PROFILES) as Array<keyof typeof BODY_PROFILES>;

/** Get a body profile by ID. Returns undefined if not found. */
export function getBodyProfile(id: string): BodyProfile | undefined {
  return BODY_PROFILES[id];
}

// ─── Max HP by body (BLOCKOUT-07H+) ────────────────────────────────

/** Maximum HP per body ID for blockout damage. BLOCKOUT-07H+.
 *  Values match referenceM3.hp in body profiles.
 *  Dev/arena-only — not persisted in saves. */
export const BLOCKOUT_BODY_MAX_HP: Record<string, number> = {
  wasp: 180,
  hornet: 210,
  hunter: 285,
  viking: 315,
  dictator: 345,
  titan: 420,
  mammoth: 500,
};

/** Get max HP for a body ID. Returns 200 as default if not found. BLOCKOUT-07H+. */
export function getBlockoutBodyMaxHp(bodyId: string): number {
  return BLOCKOUT_BODY_MAX_HP[bodyId] ?? 200;
}
