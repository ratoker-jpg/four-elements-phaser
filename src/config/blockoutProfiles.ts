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

/** Movement profile per body. Blockout placeholder — not used for physics in this PR. */
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
}

// ─── Recoil Profile ────────────────────────────────────────────────

/** Recoil profile per weapon. Blockout placeholder — not used in this PR. */
export interface RecoilProfile {
  weaponId: WeaponId;
  barrelKickback: number;
  turretKickback: number;
  bodyImpulse: number;
  recoveryMs: number;
  cameraShake: false;
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

/** VFX profile per weapon behavior. Blockout placeholder — not used in this PR. */
export interface VfxProfile {
  behavior: WeaponBehavior;
  primitiveType: VfxPrimitiveType;
  color: number;
  width: number;
  durationMs: number;
}

// ─── Damage Profile ────────────────────────────────────────────────

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
