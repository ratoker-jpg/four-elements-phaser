/**
 * Production building config data — full accepted data model for 10 buildings.
 *
 * CORE-STEP-02B: Creates production building configs alongside existing
 * runtime building data (construction.ts BUILDING_CONFIG). Existing runtime
 * building data remains the active runtime source. Production configs will
 * be wired into construction and economy systems in later steps.
 *
 * Economy model per MECHANICS_DECISIONS:
 * - Raw minerals -> Separator -> Energy + Faction elements -> Buildings / Unit production
 * - No player-facing Matter. Internal "matter" fields in existing runtime
 *   code are NOT renamed in this PR. New production config uses "energy"
 *   for the processed resource.
 *
 * Building readiness classes per MECHANICS_DECISIONS:
 * - gameplay_ready: has mechanics immediately
 * - visual_ready: can be placed/seen but mechanics not yet implemented
 * - deferred: not added until mechanics exist
 *
 * HQ rule: HQ is starting base, not ordinary placeable building.
 * - hq.isStartingBase = true
 * - hq.isBuildable = false
 *
 * All cost/time/hp values are reference placeholders, not final balance.
 */

import type {
  BuildingConfig,
  AcceptedBuildingId,
} from './coreMechanicsTypes';

// ─── Accepted building configs ───────────────────────────────────────

/** All 10 accepted production building configs keyed by ID. */
export const BUILDING_CONFIGS: Record<AcceptedBuildingId, BuildingConfig> = {

  // ── Главное здание — starting base, drop-off, vision ──────────────
  hq: {
    id: 'hq',
    displayNameKey: 'building_hq',
    roleKey: 'building_role_hq',
    category: 'core_economy',
    readiness: 'gameplay_ready',
    isStartingBase: true,
    isBuildable: false,
    costEnergy: 0,
    costElements: 0,
    buildTimeMs: 0,
    hp: 500,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 8,
    storageDelta: {
      raw: 200,
      energy: 200,
      elements: 200,
    },
    productionRole: {
      kind: 'power_generation',
      description: 'HQ provides base power and starting storage',
    },
  },

  // ── Сепаратор — raw minerals -> energy + faction elements ──────────
  separator: {
    id: 'separator',
    displayNameKey: 'building_separator',
    roleKey: 'building_role_separator',
    category: 'core_economy',
    readiness: 'gameplay_ready',
    isStartingBase: false,
    isBuildable: true,
    costEnergy: 60,
    costElements: 0,
    buildTimeMs: 20000,
    hp: 200,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 3,
    productionRole: {
      kind: 'separator',
      description: 'Converts raw minerals into energy and faction elements',
    },
  },

  // ── Хранилище сырья — raises raw minerals cap ─────────────────────
  raw_storage: {
    id: 'raw_storage',
    displayNameKey: 'building_raw_storage',
    roleKey: 'building_role_raw_storage',
    category: 'storage',
    readiness: 'gameplay_ready',
    isStartingBase: false,
    isBuildable: true,
    costEnergy: 40,
    costElements: 0,
    buildTimeMs: 15000,
    hp: 150,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 2,
    storageDelta: {
      raw: 200,
    },
  },

  // ── Хранилище энергии — raises energy cap ─────────────────────────
  energy_storage: {
    id: 'energy_storage',
    displayNameKey: 'building_energy_storage',
    roleKey: 'building_role_energy_storage',
    category: 'storage',
    readiness: 'gameplay_ready',
    isStartingBase: false,
    isBuildable: true,
    costEnergy: 40,
    costElements: 0,
    buildTimeMs: 15000,
    hp: 150,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 2,
    storageDelta: {
      energy: 200,
    },
  },

  // ── Хранилище элементов — raises faction elements cap ──────────────
  elements_storage: {
    id: 'elements_storage',
    displayNameKey: 'building_elements_storage',
    roleKey: 'building_role_elements_storage',
    category: 'storage',
    readiness: 'gameplay_ready',
    isStartingBase: false,
    isBuildable: true,
    costEnergy: 50,
    costElements: 5,
    buildTimeMs: 18000,
    hp: 150,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 2,
    storageDelta: {
      elements: 200,
    },
  },

  // ── Фабрика юнитов — produces builders and harvesters ──────────────
  units_factory: {
    id: 'units_factory',
    displayNameKey: 'building_units_factory',
    roleKey: 'building_role_units_factory',
    category: 'production',
    readiness: 'gameplay_ready',
    isStartingBase: false,
    isBuildable: true,
    costEnergy: 120,
    costElements: 10,
    buildTimeMs: 40000,
    hp: 250,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 3,
    productionRole: {
      kind: 'unit_production',
      description: 'Produces builder and harvester units',
    },
  },

  // ── Энергостанция — power generation building ─────────────────────
  power_plant: {
    id: 'power_plant',
    displayNameKey: 'building_power_plant',
    roleKey: 'building_role_power_plant',
    category: 'power',
    readiness: 'gameplay_ready',
    isStartingBase: false,
    isBuildable: true,
    costEnergy: 100,
    costElements: 5,
    buildTimeMs: 25000,
    hp: 180,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 3,
    productionRole: {
      kind: 'power_generation',
      description: 'Generates power for buildings and separators',
    },
  },

  // ── Энергореактор — advanced power, not yet gameplay ──────────────
  energy_reactor: {
    id: 'energy_reactor',
    displayNameKey: 'building_energy_reactor',
    roleKey: 'building_role_energy_reactor',
    category: 'power',
    readiness: 'visual_ready',
    isStartingBase: false,
    isBuildable: false,
    costEnergy: 0,
    costElements: 0,
    buildTimeMs: 0,
    hp: 0,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 0,
    productionRole: {
      kind: 'power_generation',
      description: 'Advanced power infrastructure — improves energy limits and processing',
    },
  },

  // ── Ремонтный центр — stationary repair, deferred ─────────────────
  repair_center: {
    id: 'repair_center',
    displayNameKey: 'building_repair_center',
    roleKey: 'building_role_repair_center',
    category: 'support',
    readiness: 'deferred',
    isStartingBase: false,
    isBuildable: false,
    costEnergy: 0,
    costElements: 0,
    buildTimeMs: 0,
    hp: 0,
    footprintW: 2,
    footprintH: 2,
    visionRadius: 0,
    productionRole: {
      kind: 'repair',
      description: 'Stationary repair — consumes energy, does not replace Isida',
    },
  },

  // ── Оборонная башня — base defense, deferred ──────────────────────
  defense_tower: {
    id: 'defense_tower',
    displayNameKey: 'building_defense_tower',
    roleKey: 'building_role_defense_tower',
    category: 'defense',
    readiness: 'deferred',
    isStartingBase: false,
    isBuildable: false,
    costEnergy: 0,
    costElements: 0,
    buildTimeMs: 0,
    hp: 0,
    footprintW: 1,
    footprintH: 1,
    visionRadius: 0,
    productionRole: {
      kind: 'defense',
      description: 'Base defense — not priority until enemy attacks/bot/waves exist',
    },
  },

}; // end BUILDING_CONFIGS

// ─── Lookup helpers ──────────────────────────────────────────────────

/** Get a production building config by ID. Returns undefined if not found. */
export function getBuildingConfig(id: string): BuildingConfig | undefined {
  return BUILDING_CONFIGS[id as AcceptedBuildingId];
}

/** All accepted building IDs in stable order. */
export const ALL_ACCEPTED_BUILDING_IDS: readonly AcceptedBuildingId[] =
  Object.keys(BUILDING_CONFIGS) as AcceptedBuildingId[];

/** Get only gameplay-ready building IDs. */
export const GAMEPLAY_READY_BUILDING_IDS: readonly AcceptedBuildingId[] =
  ALL_ACCEPTED_BUILDING_IDS.filter(id => BUILDING_CONFIGS[id].readiness === 'gameplay_ready');

/** Get only buildable building IDs (excludes HQ, visual_ready, deferred). */
export const BUILDABLE_BUILDING_IDS: readonly AcceptedBuildingId[] =
  ALL_ACCEPTED_BUILDING_IDS.filter(id => BUILDING_CONFIGS[id].isBuildable);

/** Get storage building IDs (buildings with storageDelta). */
export const STORAGE_BUILDING_IDS: readonly AcceptedBuildingId[] =
  ALL_ACCEPTED_BUILDING_IDS.filter(id => BUILDING_CONFIGS[id].storageDelta !== undefined);
