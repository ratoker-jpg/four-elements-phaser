/**
 * Production body config data — full accepted data model for 7 bodies.
 *
 * CORE-STEP-02A: Creates production body configs alongside existing blockout
 * body data. Blockout data (blockoutBodyData.ts) remains the Arena/dev
 * data source. Production configs will be wired into gameplay in later steps.
 *
 * All M0-M3 values are reference placeholders, not final game balance.
 * They follow the accepted body M0-M3 rules from MECHANICS_DECISIONS:
 * - HP increases from M0 to M3
 * - Armor increases from M0 to M3
 * - Speed increases from M0 to M3
 * - Acceleration increases from M0 to M3
 * - Braking increases from M0 to M3
 * - Body turn speed increases from M0 to M3
 * - Mass does NOT change from M0 to M3 (hard rule)
 * - Footprint class does NOT change from M0 to M3
 * - Recoil resistance does NOT increase from M0 to M3
 *
 * Armor model: finalDamage = max(rawDamage - armor, rawDamage * minDamagePercent)
 * - Light bodies: low armor, higher minDamagePercent → less protection
 * - Heavy bodies: high armor, lower minDamagePercent → more protection but still vulnerable to big hits
 * - No weapon deals 0 damage forever
 *
 * Speed values are in abstract game units consistent with blockoutMovementData.
 * Mass is in kg.
 */

import type {
  BodyConfig,
  BodyFootprintClass,
  MLevelData,
  AcceptedBodyId,
} from './coreMechanicsTypes';

// ─── Accepted body configs ───────────────────────────────────────────

/** All 7 accepted production body configs keyed by ID. */
export const BODY_CONFIGS: Record<AcceptedBodyId, BodyConfig> = {

  // ── Васп — light fast scout / hit-and-run ────────────────────────
  wasp: {
    id: 'wasp',
    displayNameKey: 'body_wasp',
    roleKey: 'role_wasp',
    hp: [130, 145, 165, 180],
    mass: 2200,
    armor: [2, 3, 4, 5],
    minDamagePercent: 0.25,
    maxSpeed: [11.5, 12.0, 12.5, 13.0],
    acceleration: [7.0, 7.3, 7.7, 8.0],
    braking: [5.2, 5.5, 5.8, 6.0],
    bodyTurnSpeed: [130, 137, 144, 150],
    footprintClass: 'light',
  },

  // ── Хорнет — light raider / mobile fighter ───────────────────────
  hornet: {
    id: 'hornet',
    displayNameKey: 'body_hornet',
    roleKey: 'role_hornet',
    hp: [155, 170, 190, 210],
    mass: 2400,
    armor: [3, 4, 5, 7],
    minDamagePercent: 0.22,
    maxSpeed: [10.5, 11.0, 11.5, 12.0],
    acceleration: [6.0, 6.3, 6.7, 7.0],
    braking: [4.7, 5.0, 5.3, 5.5],
    bodyTurnSpeed: [112, 118, 124, 130],
    footprintClass: 'light',
  },

  // ── Хантер — universal medium / baseline ─────────────────────────
  hunter: {
    id: 'hunter',
    displayNameKey: 'body_hunter',
    roleKey: 'role_hunter',
    hp: [210, 235, 260, 285],
    mass: 3000,
    armor: [5, 7, 9, 12],
    minDamagePercent: 0.20,
    maxSpeed: [8.5, 9.0, 9.5, 10.0],
    acceleration: [4.7, 5.0, 5.2, 5.5],
    braking: [3.8, 4.0, 4.3, 4.5],
    bodyTurnSpeed: [120, 127, 133, 140],
    footprintClass: 'medium',
  },

  // ── Викинг — medium-heavy brawler ────────────────────────────────
  viking: {
    id: 'viking',
    displayNameKey: 'body_viking',
    roleKey: 'role_viking',
    hp: [235, 260, 290, 315],
    mass: 3000,
    armor: [8, 10, 13, 16],
    minDamagePercent: 0.18,
    maxSpeed: [7.5, 8.0, 8.5, 9.0],
    acceleration: [4.2, 4.5, 4.7, 5.0],
    braking: [3.4, 3.6, 3.8, 4.0],
    bodyTurnSpeed: [95, 100, 105, 110],
    footprintClass: 'medium',
  },

  // ── Диктатор — medium-heavy support/control platform ─────────────
  dictator: {
    id: 'dictator',
    displayNameKey: 'body_dictator',
    roleKey: 'role_dictator',
    hp: [255, 285, 315, 345],
    mass: 3300,
    armor: [7, 9, 12, 15],
    minDamagePercent: 0.18,
    maxSpeed: [6.8, 7.2, 7.6, 8.0],
    acceleration: [3.8, 4.0, 4.3, 4.5],
    braking: [3.0, 3.2, 3.4, 3.5],
    bodyTurnSpeed: [112, 118, 124, 130],
    footprintClass: 'medium',
  },

  // ── Титан — heavy frontline / stable firing platform ─────────────
  titan: {
    id: 'titan',
    displayNameKey: 'body_titan',
    roleKey: 'role_titan',
    hp: [310, 345, 380, 420],
    mass: 5000,
    armor: [12, 16, 20, 25],
    minDamagePercent: 0.15,
    maxSpeed: [5.0, 5.3, 5.7, 6.0],
    acceleration: [2.5, 2.7, 2.8, 3.0],
    braking: [2.1, 2.3, 2.4, 2.5],
    bodyTurnSpeed: [78, 82, 86, 90],
    footprintClass: 'heavy',
  },

  // ── Мамонт — super-heavy fortress ────────────────────────────────
  mammoth: {
    id: 'mammoth',
    displayNameKey: 'body_mammoth',
    roleKey: 'role_mammoth',
    hp: [370, 410, 455, 500],
    mass: 5500,
    armor: [16, 21, 26, 32],
    minDamagePercent: 0.12,
    maxSpeed: [4.2, 4.5, 4.7, 5.0],
    acceleration: [2.1, 2.3, 2.4, 2.5],
    braking: [1.7, 1.8, 1.9, 2.0],
    bodyTurnSpeed: [68, 72, 76, 80],
    footprintClass: 'heavy',
  },

}; // end BODY_CONFIGS

// ─── Lookup helpers ──────────────────────────────────────────────────

/** Get a production body config by ID. Returns undefined if not found. */
export function getBodyConfig(id: string): BodyConfig | undefined {
  return BODY_CONFIGS[id as AcceptedBodyId];
}

/** All accepted body IDs in stable order. */
export const ALL_ACCEPTED_BODY_IDS: readonly AcceptedBodyId[] =
  Object.keys(BODY_CONFIGS) as AcceptedBodyId[];

/**
 * Get a body's M-level specific value from an MLevelData tuple.
 * Safe accessor that validates the level index.
 */
export function getBodyMLevelValue<T>(
  data: MLevelData<T>,
  level: number,
): T {
  return data[Math.min(Math.max(0, Math.floor(level)), 3) as 0 | 1 | 2 | 3];
}

// ─── Footprint class mapping ─────────────────────────────────────────

/**
 * Bodies grouped by footprint class.
 * Light: Wasp, Hornet
 * Medium: Hunter, Viking, Dictator
 * Heavy: Titan, Mammoth
 */
export const FOOTPRINT_CLASS_BODIES: Record<BodyFootprintClass, AcceptedBodyId[]> = {
  light: ['wasp', 'hornet'],
  medium: ['hunter', 'viking', 'dictator'],
  heavy: ['titan', 'mammoth'],
};
