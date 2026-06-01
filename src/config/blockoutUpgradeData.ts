/**
 * Blockout upgrade data — upgrade profile skeleton.
 *
 * Blockout placeholder — NOT used in BLOCKOUT-02H.
 * No upgrade behavior in this PR.
 * Data exists so profiles are complete for future steps.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { UpgradeProfile } from './blockoutProfiles';

/** Upgrade profiles keyed by ID. */
export const UPGRADE_PROFILES: Record<string, UpgradeProfile> = {
  'body-armor': {
    id: 'body-armor',
    category: 'body',
    label: 'Armor',
    visualIndicator: 'thicker_outline',
    maxLevel: 3,
  },
  'body-speed': {
    id: 'body-speed',
    category: 'body',
    label: 'Speed',
    visualIndicator: 'speed_badge',
    maxLevel: 3,
  },
  'body-turn': {
    id: 'body-turn',
    category: 'body',
    label: 'Turn Speed',
    visualIndicator: 'turn_badge',
    maxLevel: 3,
  },
  'turret-turn': {
    id: 'turret-turn',
    category: 'turret',
    label: 'Turret Turn',
    visualIndicator: 'turret_badge',
    maxLevel: 3,
  },
  'turret-stabilization': {
    id: 'turret-stabilization',
    category: 'turret',
    label: 'Stabilization',
    visualIndicator: 'stab_badge',
    maxLevel: 3,
  },
  'weapon-damage': {
    id: 'weapon-damage',
    category: 'weapon',
    label: 'Damage',
    visualIndicator: 'brighter_muzzle',
    maxLevel: 3,
  },
  'weapon-range': {
    id: 'weapon-range',
    category: 'weapon',
    label: 'Range',
    visualIndicator: 'longer_aim_line',
    maxLevel: 3,
  },
  'weapon-reload': {
    id: 'weapon-reload',
    category: 'weapon',
    label: 'Reload',
    visualIndicator: 'faster_cadence',
    maxLevel: 3,
  },
  'weapon-recoil': {
    id: 'weapon-recoil',
    category: 'weapon',
    label: 'Recoil Reduction',
    visualIndicator: 'recoil_badge',
    maxLevel: 3,
  },
  'weapon-penetration': {
    id: 'weapon-penetration',
    category: 'weapon',
    label: 'Penetration',
    visualIndicator: 'different_line_style',
    maxLevel: 3,
  },
  'weapon-splash': {
    id: 'weapon-splash',
    category: 'weapon',
    label: 'Splash',
    visualIndicator: 'bigger_radius_ring',
    maxLevel: 3,
  },
  'utility-vision': {
    id: 'utility-vision',
    category: 'utility',
    label: 'Vision',
    visualIndicator: 'vision_badge',
    maxLevel: 3,
  },
  'utility-repair': {
    id: 'utility-repair',
    category: 'utility',
    label: 'Repair',
    visualIndicator: 'repair_badge',
    maxLevel: 3,
  },
  'utility-energy': {
    id: 'utility-energy',
    category: 'utility',
    label: 'Energy Capacity',
    visualIndicator: 'energy_badge',
    maxLevel: 3,
  },
};
