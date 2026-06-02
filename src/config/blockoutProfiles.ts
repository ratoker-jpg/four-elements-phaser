/**
 * Blockout profile type contracts for BLOCKOUT-MVP.
 *
 * These types define the data contracts for blockout vehicle profiles.
 * The data itself lives in separate blockout*Data.ts files.
 * This file is pure TypeScript with no Phaser dependencies.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 * Data can be basic but must cover all accepted references.
 */

// ─── Body Profile ──────────────────────────────────────────────────

/** Body ID literals — all 7 accepted hulls. */
export type BodyId =
  | 'wasp'
  | 'hornet'
  | 'hunter'
  | 'viking'
  | 'dictator'
  | 'titan'
  | 'mammoth';

/** Turret mount category — determines where the turret sits on the body. */
export type MountCategory =
  | 'front'
  | 'front_center'
  | 'center'
  | 'center_rear'
  | 'rear';

/** Blockout body shape category — determines renderer geometry size. */
export type BlockoutShape =
  | 'small_fast'
  | 'light_fast'
  | 'medium'
  | 'large_fast'
  | 'heavy'
  | 'super_heavy';

/** Body profile contract v1. Blockout placeholder — not final game balance. */
export interface BodyProfile {
  id: BodyId;
  displayName: string;
  roleLabel: string;
  referenceM3: {
    hp: number;
    maxSpeed: number;
    turnSpeedDeg: number;
    massKg: number;
    enginePower: number;
  };
  mountCategory: MountCategory;
  /** Normalized mount offset (0..1) within the body rectangle.
   *  x: 0=rear, 1=front; y: 0=left, 1=right (when looking from above).
   *  These are approximate and tunable. */
  mountOffsetNormalized: { x: number; y: number };
  blockoutShape: BlockoutShape;
}

// ─── Weapon Profile ────────────────────────────────────────────────

/** Weapon ID literals — all 11 accepted weapons. */
export type WeaponId =
  | 'smoky'
  | 'thunder'
  | 'railgun'
  | 'shaft'
  | 'flamethrower'
  | 'freeze'
  | 'isida'
  | 'vulcan'
  | 'twins'
  | 'ricochet'
  | 'hammer';

/** Weapon behavior category — determines VFX family and damage model. */
export type WeaponBehavior =
  | 'instant_projectile'
  | 'instant_splash'
  | 'line_pierce'
  | 'charge_sniper'
  | 'cone_stream'
  | 'beam_support'
  | 'rapid_fire_overheat'
  | 'plasma_projectile'
  | 'ricochet_projectile'
  | 'shotgun_cone';

/** Weapon profile contract v1. Blockout placeholder — not final game balance. */
export interface WeaponProfile {
  id: WeaponId;
  displayName: string;
  behavior: WeaponBehavior;
  recoilProfile: string;
  vfxProfile: string;
  damageModel: {
    directDamage?: number;
    damagePerSecond?: number;
    splashRadius?: number;
    splashFalloff?: boolean;
    penetration?: boolean;
    maxPenetrationTargets?: number;
    statusEffect?: 'burn' | 'freeze' | 'heal' | 'overheat';
    selfDamageScale?: number;
  };
  /** Barrel length in pixels for blockout renderer. Different weapons have visibly different barrels. */
  blockoutBarrelLength: number;
  /** Barrel width in pixels for blockout renderer. */
  blockoutBarrelWidth: number;
  /** Turret turn speed in degrees per second for blockout. BLOCKOUT-03H: different weapons may have different turret turn speeds. Heavier/slower weapons turn slower. */
  blockoutTurretTurnSpeedDeg: number;
  /** Cooldown between shots in milliseconds. BLOCKOUT-05H+: prevents uncontrolled VFX spam. */
  blockoutCooldownMs: number;
  /** Maximum range for blockout VFX in pixels. BLOCKOUT-05H+. */
  blockoutRangePx: number;
}

// ─── Vehicle Profile ───────────────────────────────────────────────

/** A vehicle is a body + weapon composition. */
export interface VehicleProfile {
  id: string;
  bodyId: BodyId;
  weaponId: WeaponId;
  roleLabel: string;
  blockoutEnabled: boolean;
}

// ─── Movement Profile ──────────────────────────────────────────────

/** Movement profile per body. Blockout placeholder.
 *  BLOCKOUT-04H+: Added pixel-speed fields for semi-physics movement. */
export interface MovementProfile {
  bodyId: BodyId;
  maxSpeed: number;
  acceleration: number;
  braking: number;
  turnSpeedDeg: number;
  turnAccelerationDeg: number;
  lateralAcceleration: number;
  massKg: number;
  enginePower: number;
  bodyRotationLag: number;
  /** Maximum speed in pixels per second. BLOCKOUT-04H+. */
  maxSpeedPxPerSec: number;
  /** Acceleration in pixels per second². BLOCKOUT-04H+. */
  accelerationPxPerSec2: number;
  /** Braking deceleration in pixels per second². BLOCKOUT-04H+. */
  brakingPxPerSec2: number;
  /** How close (in pixels) the vehicle must get to target to count as arrived. BLOCKOUT-04H+. */
  arrivalRadiusPx: number;
}

// ─── Recoil Profile ────────────────────────────────────────────────

/** Recoil profile per weapon. BLOCKOUT-05H+: Visual recoil for blockout vehicles. */
export interface RecoilProfile {
  weaponId: WeaponId;
  /** Barrel kickback in abstract units (BLOCKOUT-02H placeholder). */
  barrelKickback: number;
  /** Turret kickback in abstract units (BLOCKOUT-02H placeholder). */
  turretKickback: number;
  /** Body impulse in abstract units (BLOCKOUT-02H placeholder). */
  bodyImpulse: number;
  /** Recovery time in milliseconds. */
  recoveryMs: number;
  cameraShake: false;
  /** Barrel kickback in pixels (BLOCKOUT-05H+). How far the barrel retracts visually. */
  barrelKickbackPx: number;
  /** Turret kickback in radians (BLOCKOUT-05H+). How much the turret angle deflects. */
  turretKickbackRad: number;
  /** Body impulse in pixels (BLOCKOUT-05H+). How much the body position shifts. */
  bodyImpulsePx: number;
}

// ─── VFX Profile ───────────────────────────────────────────────────

/** VFX primitive types for blockout weapon effects. */
export type VfxPrimitiveType =
  | 'line'
  | 'ray'
  | 'cone_sector'
  | 'circle'
  | 'projectile_dot'
  | 'impact_dot'
  | 'status_badge'
  | 'radius_ring'
  | 'bounce_marker'
  | 'beam_tether';

/** VFX profile per weapon behavior. BLOCKOUT-05H+: Extended for visual rendering. */
export interface VfxProfile {
  behavior: WeaponBehavior;
  primitiveType: VfxPrimitiveType;
  color: number;
  width: number;
  durationMs: number;
  /** Secondary color for multi-element effects (impact, splash ring, etc.). BLOCKOUT-05H+. */
  secondaryColor?: number;
  /** Splash/impact radius in pixels for splash-type effects. BLOCKOUT-05H+. */
  impactRadiusPx?: number;
  /** Muzzle flash radius in pixels. BLOCKOUT-05H+. */
  muzzleFlashRadiusPx?: number;
  /** Line/ray length in pixels for beam/line effects. BLOCKOUT-05H+. */
  effectLengthPx?: number;
  /** Cone half-angle in degrees for cone/stream effects. BLOCKOUT-06H+. */
  coneAngleDeg?: number;
  /** Number of bounce segments for ricochet. BLOCKOUT-06H+. */
  bounceCount?: number;
  /** Number of pellets for shotgun. BLOCKOUT-06H+. */
  pelletCount?: number;
  /** Stream tick cadence in ms for continuous weapons. BLOCKOUT-06H+. */
  streamCadenceMs?: number;
  /** Overheat visual duration in ms. BLOCKOUT-06H+. */
  overheatDurationMs?: number;
  /** Charge pulse duration in ms for shaft. BLOCKOUT-06H+. */
  chargePulseMs?: number;
}

// ─── Damage Profile ────────────────────────────────────────────────

/** Damage behavior kind — determines hit detection model. BLOCKOUT-07H+. */
export type DamageKind =
  | 'direct'
  | 'splash'
  | 'penetration'
  | 'cone_tick'
  | 'beam_tick'
  | 'rapid_tick'
  | 'plasma'
  | 'ricochet'
  | 'shotgun';

/** Damage profile per weapon. Blockout placeholder — not used in this PR. */
export interface DamageProfile {
  weaponId: WeaponId;
  directDamage?: number;
  damagePerSecond?: number;
  fireRateMs?: number;
  range?: number;
  splashRadius?: number;
  splashFalloff?: boolean;
  penetration?: boolean;
  maxPenetrationTargets?: number;
  statusEffect?: 'burn' | 'freeze' | 'heal' | 'overheat';
  statusDurationMs?: number;
  selfDamageScale?: number;

  // ── BLOCKOUT-07H+: Damage behavior fields ─────────────────────────
  /** Damage behavior kind — determines hit detection model. BLOCKOUT-07H+. */
  damageKind?: DamageKind;
  /** Range in pixels for damage reach. BLOCKOUT-07H+. */
  rangePx?: number;
  /** Splash radius in pixels (for splash weapons). BLOCKOUT-07H+. */
  radiusPx?: number;
  /** Cone half-angle in degrees (for cone_tick weapons). BLOCKOUT-07H+. */
  coneAngleDeg?: number;
  /** Tick interval in ms (for continuous weapons). BLOCKOUT-07H+. */
  tickMs?: number;
  /** Max penetration targets (for penetration weapons). BLOCKOUT-07H+. */
  pierceCount?: number;
  /** Number of pellets (for shotgun weapons). BLOCKOUT-07H+. */
  pelletCount?: number;
  /** Visual status tag applied on hit. BLOCKOUT-07H+. */
  statusTag?: 'burn' | 'freeze' | 'beam' | 'overheat' | 'plasma' | 'ricochet' | 'stunned';
}

// ─── Obstacle Profile ──────────────────────────────────────────────

/** Obstacle profile for blockout. Blockout placeholder — not used in this PR. */
export interface ObstacleProfile {
  id: string;
  footprint: [number, number];
  blocksMovement: boolean;
  blocksProjectiles: boolean;
  blocksBeam: boolean;
  blocksCone: boolean;
  blocksVision: false;
}

// ─── Upgrade Profile ───────────────────────────────────────────────

/** Upgrade category. */
export type UpgradeCategory = 'body' | 'turret' | 'weapon' | 'utility';

/** Upgrade profile entry. Blockout placeholder — not used in this PR. */
export interface UpgradeProfile {
  id: string;
  category: UpgradeCategory;
  label: string;
  visualIndicator: string;
  maxLevel: number;
}
