/**
 * Production weapon config data — full accepted data model for 10 weapons.
 *
 * CORE-STEP-02A: Creates production weapon configs alongside existing blockout
 * weapon data. Blockout data (blockoutWeaponData.ts) remains the Arena/dev
 * data source. Production configs will be wired into gameplay in later steps.
 *
 * All M0-M3 values are reference placeholders, not final game balance.
 * They follow the accepted M0-M3 rules from MECHANICS_DECISIONS:
 * - M0-M3 always increase damage
 * - M0-M3 increase turret turn speed
 * - M0-M3 improve each weapon's profile-specific parameter
 * - VFX becomes more readable from M0 to M3 (VFX data is in separate config)
 * - Railgun M3 still turns slower than short-range weapons at M0
 *
 * Shaft is explicitly excluded from this file.
 *
 * Range values are in tile units (not pixels).
 * Tile dimensions: 76x38 px (TILE_W x TILE_H from worldConfig).
 */

import type {
  WeaponConfig,
  MLevelData,
  AcceptedWeaponId,
} from './coreMechanicsTypes';

// ─── Accepted weapon configs ─────────────────────────────────────────

/** All 10 accepted production weapon configs keyed by ID. */
export const WEAPON_CONFIGS: Record<AcceptedWeaponId, WeaponConfig> = {

  // ── Смоки — medium range basic cannon, cooldown ──────────────────
  smoky: {
    id: 'smoky',
    displayNameKey: 'weapon_smoky',
    fireType: 'cooldown',
    rangeClass: 'medium',
    minRange: 1,
    idealRange: 5,
    maxRange: 7,
    stopDistance: 5,
    damage: {
      directDamage: [16, 18, 19, 20],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [900, 850, 820, 800],
    turretTurnSpeed: [130, 138, 144, 150],
    vfxProfileKey: 'instant_projectile',
  },

  // ── Гром — medium range explosive, cooldown + splash ─────────────
  thunder: {
    id: 'thunder',
    displayNameKey: 'weapon_thunder',
    fireType: 'cooldown',
    rangeClass: 'medium',
    minRange: 2,
    idealRange: 4,
    maxRange: 6,
    stopDistance: 4,
    damage: {
      directDamage: [20, 22, 24, 25],
      splashRadius: 1.5,
      splashFalloff: true,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0.3,
    },
    cooldown: [1400, 1300, 1250, 1200],
    turretTurnSpeed: [95, 100, 105, 110],
    vfxProfileKey: 'instant_splash',
  },

  // ── Рельса — long range, wind-up + penetration ───────────────────
  railgun: {
    id: 'railgun',
    displayNameKey: 'weapon_railgun',
    fireType: 'wind_up',
    rangeClass: 'long',
    minRange: 3,
    idealRange: 9,
    maxRange: 13,
    stopDistance: 8,
    damage: {
      directDamage: [32, 35, 38, 40],
      splashRadius: 0,
      splashFalloff: false,
      penetration: true,
      maxPenetrationTargets: 3,
      selfDamageScale: 0,
    },
    cooldown: [3000, 2800, 2600, 2500],
    windUp: [800, 700, 600, 500],
    turretTurnSpeed: [70, 76, 83, 90],
    vfxProfileKey: 'line_pierce',
  },

  // ── Огнемёт — short range, canister stream + burn ────────────────
  flamethrower: {
    id: 'flamethrower',
    displayNameKey: 'weapon_flamethrower',
    fireType: 'canister_stream',
    rangeClass: 'short',
    minRange: 0,
    idealRange: 2,
    maxRange: 4,
    stopDistance: 2,
    damage: {
      damagePerSecond: [24, 26, 28, 30],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [50, 50, 50, 50],
    canister: {
      capacity: [80, 90, 100, 110],
      drainPerSec: [15, 14, 13, 12],
      regenPerSec: [6, 7, 8, 9],
    },
    turretTurnSpeed: [115, 120, 125, 130],
    vfxProfileKey: 'cone_stream',
  },

  // ── Фриз — short range, canister stream + freeze/slow ────────────
  freeze: {
    id: 'freeze',
    displayNameKey: 'weapon_freeze',
    fireType: 'canister_stream',
    rangeClass: 'short',
    minRange: 0,
    idealRange: 2,
    maxRange: 4,
    stopDistance: 2,
    damage: {
      damagePerSecond: [12, 13, 14, 15],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [50, 50, 50, 50],
    canister: {
      capacity: [80, 90, 100, 110],
      drainPerSec: [15, 14, 13, 12],
      regenPerSec: [6, 7, 8, 9],
    },
    turretTurnSpeed: [115, 120, 125, 130],
    vfxProfileKey: 'cone_stream',
  },

  // ── Изида — short range, canister beam + heal ────────────────────
  isida: {
    id: 'isida',
    displayNameKey: 'weapon_isida',
    fireType: 'canister_stream',
    rangeClass: 'short',
    minRange: 0,
    idealRange: 2,
    maxRange: 4,
    stopDistance: 2,
    damage: {
      damagePerSecond: [20, 22, 24, 25],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [50, 50, 50, 50],
    canister: {
      capacity: [70, 80, 90, 100],
      drainPerSec: [14, 13, 12, 11],
      regenPerSec: [5, 6, 7, 8],
    },
    turretTurnSpeed: [120, 127, 133, 140],
    vfxProfileKey: 'beam_support',
  },

  // ── Вулкан — medium range, overheat + spin-up ────────────────────
  vulcan: {
    id: 'vulcan',
    displayNameKey: 'weapon_vulcan',
    fireType: 'overheat',
    rangeClass: 'medium',
    minRange: 1,
    idealRange: 4,
    maxRange: 6,
    stopDistance: 4,
    damage: {
      directDamage: [4, 4.5, 4.7, 5],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [110, 105, 102, 100],
    overheat: {
      heatPerShot: [12, 11, 10, 9],
      maxHeat: 100,
      coolingPerSec: [8, 9, 10, 11],
      overheatPenaltyMs: 3000,
      spinUpMs: 400,
    },
    turretTurnSpeed: [105, 110, 115, 120],
    vfxProfileKey: 'rapid_fire_overheat',
  },

  // ── Твинс — short/medium range, near-continuous twin plasma ──────
  twins: {
    id: 'twins',
    displayNameKey: 'weapon_twins',
    fireType: 'near_continuous',
    rangeClass: 'medium',
    minRange: 1,
    idealRange: 4,
    maxRange: 6,
    stopDistance: 4,
    damage: {
      directDamage: [10, 11, 11.5, 12],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [650, 625, 612, 600],
    turretTurnSpeed: [120, 127, 133, 140],
    vfxProfileKey: 'plasma_projectile',
  },

  // ── Рикошет — short/medium range, magazine/charge + bounce ───────
  ricochet: {
    id: 'ricochet',
    displayNameKey: 'weapon_ricochet',
    fireType: 'magazine',
    rangeClass: 'medium',
    minRange: 1,
    idealRange: 4,
    maxRange: 6,
    stopDistance: 4,
    damage: {
      directDamage: [15, 16, 17, 18],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [800, 750, 720, 700],
    magazine: {
      stockSize: [4, 5, 5, 6],
      regenPerSec: [0.5, 0.6, 0.7, 0.8],
    },
    turretTurnSpeed: [112, 118, 124, 130],
    vfxProfileKey: 'ricochet_projectile',
  },

  // ── Молот — short range, drum/shotgun burst ─────────────────────
  hammer: {
    id: 'hammer',
    displayNameKey: 'weapon_hammer',
    fireType: 'drum',
    rangeClass: 'short',
    minRange: 0,
    idealRange: 2,
    maxRange: 4,
    stopDistance: 2,
    damage: {
      directDamage: [28, 30, 33, 35],
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      maxPenetrationTargets: 0,
      selfDamageScale: 0,
    },
    cooldown: [1500, 1400, 1350, 1300],
    drum: {
      volleyCount: 3,
      delayBetweenVolleysMs: [250, 220, 200, 180],
      reloadMs: [3000, 2700, 2500, 2300],
      pelletCount: 5,
    },
    turretTurnSpeed: [85, 90, 95, 100],
    vfxProfileKey: 'shotgun_cone',
  },

}; // end WEAPON_CONFIGS

// ─── Lookup helpers ──────────────────────────────────────────────────

/** Get a production weapon config by ID. Returns undefined if not found. */
export function getWeaponConfig(id: string): WeaponConfig | undefined {
  return WEAPON_CONFIGS[id as AcceptedWeaponId];
}

/** All accepted weapon IDs in stable order. */
export const ALL_ACCEPTED_WEAPON_IDS: readonly AcceptedWeaponId[] =
  Object.keys(WEAPON_CONFIGS) as AcceptedWeaponId[];

/**
 * Get a weapon's M-level specific value from an MLevelData tuple.
 * Safe accessor that validates the level index.
 */
export function getWeaponMLevelValue<T>(
  data: MLevelData<T>,
  level: number,
): T {
  return data[Math.min(Math.max(0, Math.floor(level)), 3) as 0 | 1 | 2 | 3];
}
