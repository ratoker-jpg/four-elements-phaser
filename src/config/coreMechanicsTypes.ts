/**
 * Core mechanics shared types — production config data model foundations.
 *
 * CORE-STEP-02A: Provides type definitions for production weapon and body
 * configs with M0-M3 scaling, armor model, range bands, and fire types.
 * CORE-STEP-02B: Adds faction, resource class, and building config types.
 *
 * These types are separate from blockoutProfiles.ts (which remains the
 * Arena/dev type system). Production configs use these types; blockout
 * configs continue using blockoutProfiles.ts until Step 08.
 *
 * Design rules:
 * - Internal ids remain English stable ids
 * - Player-facing display names come from localization.ts via displayNameKey
 * - M0-M3 data is a fixed-length tuple [M0, M1, M2, M3]
 * - Mass is fixed per body and does NOT change across M0-M3
 * - Armor uses flat reduction + minimum damage floor
 */

// ─── Modification level ─────────────────────────────────────────────

/** Modification level index: M0=0, M1=1, M2=2, M3=3. */
export type ModificationLevel = 0 | 1 | 2 | 3;

/** All valid modification levels in order. */
export const MODIFICATION_LEVELS: readonly ModificationLevel[] = [0, 1, 2, 3] as const;

/** Number of modification levels (M0 through M3). */
export const MODIFICATION_LEVEL_COUNT = 4;

// ─── Weapon types ────────────────────────────────────────────────────

/**
 * Weapon fire type — determines the resource/firing model.
 *
 * Each fire type maps to a specific weapon mechanic:
 * - cooldown: single shot with cooldown (smoky, thunder)
 * - wind_up: charge before shot with long cooldown (railgun)
 * - canister_stream: continuous cone stream with fuel canister (flamethrower, freeze, isida)
 * - overheat: rapid fire with heat buildup and spin-up (vulcan)
 * - near_continuous: high fire rate alternating shots (twins)
 * - magazine: limited charge stock that regenerates (ricochet)
 * - drum: revolver/shotgun-style burst with reload (hammer)
 */
export type WeaponFireType =
  | 'cooldown'
  | 'wind_up'
  | 'canister_stream'
  | 'overheat'
  | 'near_continuous'
  | 'magazine'
  | 'drum';

/** Weapon range class — broad categorization for range band. */
export type WeaponRangeClass = 'short' | 'medium' | 'long';

// ─── Body types ──────────────────────────────────────────────────────

/**
 * Body footprint/collision class — determines tile occupancy and collision behavior.
 *
 * Light: Wasp, Hornet — small footprint, fast, fragile
 * Medium: Hunter, Viking, Dictator — standard footprint, balanced
 * Heavy: Titan, Mammoth — large footprint, slow, armored
 */
export type BodyFootprintClass = 'light' | 'medium' | 'heavy';

// ─── M0-M3 scaling data ──────────────────────────────────────────────

/**
 * M0-M3 scaling data — a fixed-length tuple of 4 values indexed by ModificationLevel.
 *
 * Index 0 = M0, Index 1 = M1, Index 2 = M2, Index 3 = M3.
 * Values must be monotonically non-decreasing for damage (or heal rate for support weapons) and turretTurnSpeed
 * (M0 <= M1 <= M2 <= M3) per accepted mechanics decisions.
 * Mass is excluded from M-level scaling; it is fixed per body.
 */
export type MLevelData<T> = readonly [T, T, T, T];

// ─── Weapon config ───────────────────────────────────────────────────

/** Production weapon config — full accepted data model for one weapon. */
export interface WeaponConfig {
  /** Stable English id (e.g., 'smoky', 'thunder'). Never displayed to players. */
  id: string;
  /** Localization key for Russian display name (e.g., 'weapon_smoky' -> 'Смоки'). */
  displayNameKey: string;
  /** Firing resource model category. */
  fireType: WeaponFireType;
  /** Broad range classification. */
  rangeClass: WeaponRangeClass;
  /** Minimum attack range in tile units. Targets closer than this need point-blank assist. */
  minRange: number;
  /** Ideal attack range in tile units. Unit tries to maintain this distance. */
  idealRange: number;
  /** Maximum attack range in tile units. Targets beyond this require approach. */
  maxRange: number;
  /** Distance in tile units where the attacking unit stops approaching. */
  stopDistance: number;
  /**
   * Damage model. Structure depends on fireType.
   * Not all weapons deal damage — support weapons (e.g., Isida) use the `support`
   * model instead. Damage weapons must have directDamage or damagePerSecond.
   * Support weapons must NOT have directDamage or damagePerSecond.
   */
  damage: {
    /** M0-M3 direct/shot damage. Present for cooldown, wind_up, near_continuous, magazine, drum. */
    directDamage?: MLevelData<number>;
    /** M0-M3 damage per second. Present for canister_stream (damage) and overheat. */
    damagePerSecond?: MLevelData<number>;
    /** Splash radius in tile units. 0 = no splash. Does NOT increase from M0 to M3 per decisions. */
    splashRadius: number;
    /** Whether splash damage falls off with distance from impact. */
    splashFalloff: boolean;
    /** Whether shots penetrate through targets. */
    penetration: boolean;
    /** Maximum targets a penetrating shot can hit. 0 = no limit / not applicable. */
    maxPenetrationTargets: number;
    /** Scale factor for self-damage from splash (0 = no self-damage, 1 = full). */
    selfDamageScale: number;
  };
  /**
   * Support/heal model. Only for weapons that do NOT deal damage.
   * When present, the weapon must NOT have damage.directDamage or damage.damagePerSecond.
   * Currently only used by Isida (heal_beam).
   * Damage mode for Isida is explicitly rejected per MECHANICS_DECISIONS.
   */
  support?: {
    /** Kind of support effect. */
    kind: 'heal_beam';
    /** M0-M3 heal per second while beam is active on target. Must not decrease M0→M3. */
    healPerSecond: MLevelData<number>;
    /** Target type for auto-targeting. */
    target: 'ally';
  };
  /** Cooldown between shots in milliseconds. M0-M3. */
  cooldown: MLevelData<number>;
  /** Wind-up charge time in ms before shot. Only for wind_up fireType. M0-M3. */
  windUp?: MLevelData<number>;
  /** Canister/fuel resource model. Only for canister_stream fireType. */
  canister?: {
    /** Maximum canister capacity. M0-M3. */
    capacity: MLevelData<number>;
    /** Drain rate per second while firing. M0-M3 (decreases = improvement). */
    drainPerSec: MLevelData<number>;
    /** Regeneration rate per second while not firing. M0-M3 (increases = improvement). */
    regenPerSec: MLevelData<number>;
  };
  /** Overheat model. Only for overheat fireType. */
  overheat?: {
    /** Heat added per shot. M0-M3 (decreases = improvement). */
    heatPerShot: MLevelData<number>;
    /** Maximum heat before overheat triggers. */
    maxHeat: number;
    /** Cooling rate per second when not firing. M0-M3 (increases = improvement). */
    coolingPerSec: MLevelData<number>;
    /** Penalty duration in ms when overheat triggers. */
    overheatPenaltyMs: number;
    /** Spin-up time in ms before sustained fire begins. */
    spinUpMs: number;
  };
  /** Magazine/charge model. Only for magazine fireType. */
  magazine?: {
    /** Maximum stock of charges. M0-M3. */
    stockSize: MLevelData<number>;
    /** Charge regeneration per second while not firing. M0-M3. */
    regenPerSec: MLevelData<number>;
  };
  /** Drum/shotgun model. Only for drum fireType. */
  drum?: {
    /** Number of quick volleys per full drum. */
    volleyCount: number;
    /** Delay between volleys in ms. M0-M3 (decreases = improvement). */
    delayBetweenVolleysMs: MLevelData<number>;
    /** Full drum reload time in ms. M0-M3 (decreases = improvement). */
    reloadMs: MLevelData<number>;
    /** Number of pellets per volley. */
    pelletCount: number;
  };
  /** Turret turn speed in degrees per second. M0-M3 (must not decrease). */
  turretTurnSpeed: MLevelData<number>;
  /** VFX profile reference key — maps to blockoutVfxData or future VFX config. */
  vfxProfileKey: string;
}

// ─── Body config ─────────────────────────────────────────────────────

/** Production body config — full accepted data model for one hull. */
export interface BodyConfig {
  /** Stable English id (e.g., 'wasp', 'hunter'). Never displayed to players. */
  id: string;
  /** Localization key for Russian display name (e.g., 'body_wasp' -> 'Васп'). */
  displayNameKey: string;
  /** Localization key for Russian role description (e.g., 'role_wasp' -> 'Быстрый разведчик...'). */
  roleKey: string;
  /** Hit points per modification level. M0-M3. Must increase. */
  hp: MLevelData<number>;
  /** Fixed body mass in kg. Does NOT change across M0-M3 per accepted decisions. */
  mass: number;
  /** Armor flat reduction per modification level. M0-M3. Must increase. */
  armor: MLevelData<number>;
  /**
   * Minimum damage percent floor.
   * Armor formula: max(rawDamage - armor, rawDamage * minDamagePercent)
   * Ensures no weapon deals 0 damage forever, even against heavy armor.
   * Light bodies have higher floor (less protection), heavy have lower.
   */
  minDamagePercent: number;
  /** Maximum speed per modification level. M0-M3. Must increase. */
  maxSpeed: MLevelData<number>;
  /** Acceleration per modification level. M0-M3. Must increase. */
  acceleration: MLevelData<number>;
  /** Braking deceleration per modification level. M0-M3. Must increase. */
  braking: MLevelData<number>;
  /** Body turn speed in degrees per second. M0-M3. Must increase. */
  bodyTurnSpeed: MLevelData<number>;
  /** Footprint/collision class. Fixed per body — does NOT change with M0-M3. */
  footprintClass: BodyFootprintClass;
}

// ─── Accepted weapon IDs ─────────────────────────────────────────────

/** All 10 accepted weapon IDs. Shaft is explicitly excluded. */
export const ACCEPTED_WEAPON_IDS = [
  'smoky',
  'thunder',
  'railgun',
  'flamethrower',
  'freeze',
  'isida',
  'vulcan',
  'twins',
  'ricochet',
  'hammer',
] as const;

/** Accepted weapon ID type — 10 weapons, no Shaft. */
export type AcceptedWeaponId = (typeof ACCEPTED_WEAPON_IDS)[number];

/** Number of accepted weapons. */
export const ACCEPTED_WEAPON_COUNT = 10;

// ─── Accepted body IDs ───────────────────────────────────────────────

/** All 7 accepted body IDs. */
export const ACCEPTED_BODY_IDS = [
  'wasp',
  'hornet',
  'hunter',
  'viking',
  'dictator',
  'titan',
  'mammoth',
] as const;

/** Accepted body ID type. */
export type AcceptedBodyId = (typeof ACCEPTED_BODY_IDS)[number];

/** Number of accepted bodies. */
export const ACCEPTED_BODY_COUNT = 7;

// ─── Faction types ───────────────────────────────────────────────────

/** All 4 accepted faction IDs. */
export const ACCEPTED_FACTION_IDS = [
  'cyan',
  'green',
  'yellow',
  'purple',
] as const;

/** Accepted faction ID type. */
export type AcceptedFactionId = (typeof ACCEPTED_FACTION_IDS)[number];

/** Number of accepted factions. */
export const ACCEPTED_FACTION_COUNT = 4;

/** Faction passive bonus kind — identifies the faction's strategic direction. */
export type FactionBonusKind =
  | 'mobility_tempo'
  | 'building_economy'
  | 'combat_production'
  | 'vision_territory';

/**
 * Concrete faction passive bonus effects.
 * Each field is optional; only the fields relevant to a faction's direction are set.
 * Multipliers > 1.0 = bonus, additive bonuses > 0 = bonus.
 * These are config placeholders, not final balance.
 */
export interface FactionBonusEffects {
  /** Civil/light unit production speed multiplier. > 1.0 means faster. */
  civilUnitProductionSpeedMultiplier?: number;
  /** Building construction speed multiplier. > 1.0 means faster. */
  buildingSpeedMultiplier?: number;
  /** Processing (separator) speed multiplier. > 1.0 means faster. */
  processingSpeedMultiplier?: number;
  /** Storage capacity multiplier. > 1.0 means larger capacity. */
  storageCapacityMultiplier?: number;
  /** Combat unit production speed multiplier. > 1.0 means faster. */
  combatUnitProductionSpeedMultiplier?: number;
  /** Territory vision radius bonus in tile units. > 0 means increased vision. */
  territoryVisionRadiusBonus?: number;
}

/** Faction config — production data model for one faction. */
export interface FactionConfig {
  /** Stable English id (e.g., 'cyan', 'green'). Never displayed to players. */
  id: AcceptedFactionId;
  /** Localization key for Russian display name (e.g., 'faction_cyan' -> 'Поток'). */
  displayNameKey: string;
  /** Localization key for Russian color subtitle (e.g., 'faction_color_cyan' -> 'Циановая фракция'). */
  colorSubtitleKey: string;
  /** Localization key for Russian bonus description (e.g., 'faction_bonus_cyan' -> 'Бонус: мобильность и быстрый темп'). */
  bonusDescriptionKey: string;
  /** Localization key for Russian role description (e.g., 'faction_role_cyan' -> 'Роль: быстрый старт, темп, мобильные действия'). */
  roleKey: string;
  /** Primary color as CSS hex string (e.g., '#00ffff'). */
  primaryColor: string;
  /** Primary color as numeric hex for Phaser (e.g., 0x00ffff). */
  primaryColorNum: number;
  /** Passive bonus data model — config-driven, no runtime behavior yet. */
  passiveBonus: {
    /** Identifies which bonus category this faction receives. */
    kind: FactionBonusKind;
    /**
     * Concrete effects for this faction's passive bonus.
     * Only fields relevant to the faction's direction are populated.
     * At least one effect must be present per faction.
     * These are reference/placeholder values, not final balance.
     */
    effects: FactionBonusEffects;
  };
}

// ─── Resource class types ────────────────────────────────────────────

/** All 6 accepted resource class IDs. */
export const ACCEPTED_RESOURCE_CLASS_IDS = [
  'very_poor',
  'poor',
  'medium',
  'rich',
  'very_rich',
  'infinite',
] as const;

/** Accepted resource class ID type. */
export type AcceptedResourceClassId = (typeof ACCEPTED_RESOURCE_CLASS_IDS)[number];

/** Number of accepted resource classes. */
export const ACCEPTED_RESOURCE_CLASS_COUNT = 6;

/** Placement zone for resource classes — determines where on the map deposits appear. */
export type ResourcePlacementZone =
  | 'starter'
  | 'side'
  | 'contested'
  | 'center';

/** Resource class config — production data model for one deposit class. */
export interface ResourceClassConfig {
  /** Stable English id (e.g., 'very_poor', 'infinite'). Never displayed to players. */
  id: AcceptedResourceClassId;
  /** Localization key for Russian display name (e.g., 'resource_very_poor' -> 'Очень бедная залежь'). */
  displayNameKey: string;
  /** Localization key for Russian description. */
  descriptionKey: string;
  /** Asset key prefix matching assetManifest entries (e.g., 'resource_industrial_very_poor_01'). */
  assetKey: string;
  /** Minimum raw mineral amount for this deposit class. Ignored if isInfinite. */
  amountMin: number;
  /** Maximum raw mineral amount for this deposit class. Ignored if isInfinite. */
  amountMax: number;
  /** Whether this deposit class is infinite (never depletes). Only 'infinite' is true. */
  isInfinite: boolean;
  /** Strategic role description — short English phrase for dev reference. */
  strategicRole: string;
  /** Suggested map placement zone per MECHANICS_DECISIONS. */
  suggestedPlacementZone: ResourcePlacementZone;
  /** Footprint size in tiles (1 = single tile, 2 = 2x2). Infinite is 2x2. */
  footprint: number;
}

// ─── Building types ──────────────────────────────────────────────────

/** Building readiness class — determines implementation status. */
export type BuildingReadiness = 'gameplay_ready' | 'visual_ready' | 'deferred';

/** Building category — broad grouping for UI and logic. */
export type BuildingCategory = 'core_economy' | 'storage' | 'production' | 'power' | 'defense' | 'support';

/** All accepted building IDs (English stable ids). */
export const ACCEPTED_BUILDING_IDS = [
  'hq',
  'separator',
  'raw_storage',
  'energy_storage',
  'elements_storage',
  'units_factory',
  'power_plant',
  'energy_reactor',
  'repair_center',
  'defense_tower',
] as const;

/** Accepted building ID type. */
export type AcceptedBuildingId = (typeof ACCEPTED_BUILDING_IDS)[number];

/** Number of accepted buildings. */
export const ACCEPTED_BUILDING_COUNT = 10;

/** Building config — production data model for one building type. */
export interface BuildingConfig {
  /** Stable English id (e.g., 'hq', 'separator'). Never displayed to players. */
  id: AcceptedBuildingId;
  /** Localization key for Russian display name (e.g., 'building_hq' -> 'Главное здание'). */
  displayNameKey: string;
  /** Localization key for Russian role/description. */
  roleKey: string;
  /** Building category for UI grouping and logic. */
  category: BuildingCategory;
  /** Implementation readiness class. */
  readiness: BuildingReadiness;
  /** Whether this building is the starting base (placed automatically, not by player). */
  isStartingBase: boolean;
  /** Whether this building can be placed by the player. */
  isBuildable: boolean;
  /** Construction cost in energy (processed resource). 0 for non-buildable. */
  costEnergy: number;
  /** Construction cost in faction elements. 0 for non-buildable. */
  costElements: number;
  /** Construction time in milliseconds. 0 for non-buildable. */
  buildTimeMs: number;
  /** Building hit points. 0 for deferred/not-yet-gameplay buildings. */
  hp: number;
  /** Footprint width in tiles. */
  footprintW: number;
  /** Footprint height in tiles. */
  footprintH: number;
  /** Vision radius in tile units. 0 for deferred buildings. */
  visionRadius: number;
  /**
   * Storage delta — how much storage capacity this building adds.
   * Only set for storage buildings. null for non-storage.
   */
  storageDelta?: {
    /** Raw minerals storage cap increase. */
    raw?: number;
    /** Energy storage cap increase. */
    energy?: number;
    /** Faction elements storage cap increase. */
    elements?: number;
  };
  /**
   * Production role — what this building produces.
   * Only set for production/processing buildings. null for others.
   */
  productionRole?: {
    /** What the building produces or converts. */
    kind: 'separator' | 'unit_production' | 'power_generation' | 'repair' | 'defense';
    /** Short English description of the conversion/production process. */
    description: string;
  };
}
