/**
 * Blockout upgrade data — upgrade profiles and configurations.
 *
 * BLOCKOUT-09H: Dev/arena-only upgrade skeleton and visual indicators.
 *
 * Defines upgrade type properties, per-level effects, and visual markers.
 * All data is dev/arena-only and not persisted in saves.
 * This is skeleton, not balance.
 */

// ─── Upgrade ID type ────────────────────────────────────────────────

/** Upgrade type identifiers for blockout placeholders. BLOCKOUT-09H. */
export type BlockoutUpgradeId =
  | 'mobility_boost'
  | 'armor_plating'
  | 'weapon_tuning'
  | 'range_extender'
  | 'cooling_system';

// ─── Upgrade effect descriptor ──────────────────────────────────────

/** Describes how an upgrade modifies a stat, per level. */
export interface UpgradeStatEffect {
  /** Which stat is affected (e.g., 'maxSpeedPxPerSec', 'maxHp', 'directDamage'). */
  stat: string;
  /** Multiplier applied per level (1.0 = no change, 1.15 = +15%). */
  multiplierPerLevel: number;
  /** Flat bonus applied per level (0 = no flat bonus). */
  flatBonusPerLevel: number;
  /** How the multiplier is applied: 'multiply_base' multiplies the base value. */
  mode: 'multiply_base' | 'multiply_flat';
}

// ─── Upgrade marker visual config ────────────────────────────────────

/** Visual marker configuration for an upgrade type. */
export interface UpgradeMarkerConfig {
  /** Fill color for the marker (hex number). */
  color: number;
  /** Outline color for the marker. */
  outlineColor: number;
  /** Marker shape type. */
  shape: 'ring' | 'brackets' | 'dots' | 'arcs' | 'glow';
  /** Display name for debug labels. */
  label: string;
}

// ─── Upgrade profile ─────────────────────────────────────────────────

/** Configuration for a single upgrade type. */
export interface UpgradeProfile {
  /** Unique upgrade ID. */
  id: BlockoutUpgradeId;
  /** Human-readable display name. */
  displayName: string;
  /** Maximum level for this upgrade. */
  maxLevel: number;
  /** Stats affected by this upgrade. */
  affectedStats: UpgradeStatEffect[];
  /** Visual marker configuration. */
  marker: UpgradeMarkerConfig;
  /** Brief description. */
  description: string;
}

// ─── Upgrade profiles ────────────────────────────────────────────────

/** All upgrade profiles keyed by ID. */
export const UPGRADE_PROFILES: Record<BlockoutUpgradeId, UpgradeProfile> = {
  mobility_boost: {
    id: 'mobility_boost',
    displayName: 'Mobility Boost',
    maxLevel: 3,
    affectedStats: [
      { stat: 'maxSpeedPxPerSec', multiplierPerLevel: 1.15, flatBonusPerLevel: 0, mode: 'multiply_base' },
      { stat: 'accelerationPxPerSec2', multiplierPerLevel: 1.10, flatBonusPerLevel: 0, mode: 'multiply_base' },
      { stat: 'turnSpeedDeg', multiplierPerLevel: 1.10, flatBonusPerLevel: 0, mode: 'multiply_base' },
    ],
    marker: {
      color: 0x00ccff,
      outlineColor: 0x0088aa,
      shape: 'arcs',
      label: 'SPD',
    },
    description: '+15% speed, +10% accel, +10% turn per level',
  },
  armor_plating: {
    id: 'armor_plating',
    displayName: 'Armor Plating',
    maxLevel: 3,
    affectedStats: [
      { stat: 'maxHp', multiplierPerLevel: 1.15, flatBonusPerLevel: 0, mode: 'multiply_base' },
      { stat: 'incomingDamageMultiplier', multiplierPerLevel: 0.95, flatBonusPerLevel: 0, mode: 'multiply_flat' },
    ],
    marker: {
      color: 0xcccccc,
      outlineColor: 0x888888,
      shape: 'brackets',
      label: 'ARM',
    },
    description: '+15% max HP, -5% incoming damage per level',
  },
  weapon_tuning: {
    id: 'weapon_tuning',
    displayName: 'Weapon Tuning',
    maxLevel: 3,
    affectedStats: [
      { stat: 'directDamage', multiplierPerLevel: 1.10, flatBonusPerLevel: 0, mode: 'multiply_base' },
      { stat: 'damagePerSecond', multiplierPerLevel: 1.10, flatBonusPerLevel: 0, mode: 'multiply_base' },
      { stat: 'cooldownMultiplier', multiplierPerLevel: 0.95, flatBonusPerLevel: 0, mode: 'multiply_flat' },
    ],
    marker: {
      color: 0xff6622,
      outlineColor: 0xaa4411,
      shape: 'glow',
      label: 'WPN',
    },
    description: '+10% damage, -5% cooldown per level',
  },
  range_extender: {
    id: 'range_extender',
    displayName: 'Range Extender',
    maxLevel: 3,
    affectedStats: [
      { stat: 'rangePx', multiplierPerLevel: 1.10, flatBonusPerLevel: 0, mode: 'multiply_base' },
    ],
    marker: {
      color: 0xaa44ff,
      outlineColor: 0x7722aa,
      shape: 'arcs',
      label: 'RNG',
    },
    description: '+10% range per level',
  },
  cooling_system: {
    id: 'cooling_system',
    displayName: 'Cooling System',
    maxLevel: 3,
    affectedStats: [
      { stat: 'tickMsMultiplier', multiplierPerLevel: 0.90, flatBonusPerLevel: 0, mode: 'multiply_flat' },
      { stat: 'streamCadenceMultiplier', multiplierPerLevel: 0.90, flatBonusPerLevel: 0, mode: 'multiply_flat' },
    ],
    marker: {
      color: 0x00ddaa,
      outlineColor: 0x009977,
      shape: 'dots',
      label: 'COOL',
    },
    description: '-10% continuous tick/cadence per level',
  },
};

/** Get an upgrade profile by ID. Returns undefined if not found. */
export function getUpgradeProfile(id: string): UpgradeProfile | undefined {
  return UPGRADE_PROFILES[id as BlockoutUpgradeId];
}

/** All upgrade IDs in a stable order. */
export const ALL_UPGRADE_IDS: BlockoutUpgradeId[] = [
  'mobility_boost',
  'armor_plating',
  'weapon_tuning',
  'range_extender',
  'cooling_system',
];
