/**
 * Core mechanics shared types — production config data model foundations.
 *
 * CORE-STEP-02A: Provides type definitions for production weapon and body
 * configs with M0-M3 scaling, armor model, range bands, and fire types.
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
 * Values must be monotonically non-decreasing for damage and turretTurnSpeed
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
  /** Damage model. Structure depends on fireType. */
  damage: {
    /** M0-M3 direct/shot damage. Present for cooldown, wind_up, near_continuous, magazine, drum. */
    directDamage?: MLevelData<number>;
    /** M0-M3 damage per second. Present for canister_stream and overheat. */
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
