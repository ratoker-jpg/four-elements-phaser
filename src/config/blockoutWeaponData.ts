/**
 * Blockout weapon data — profile data for all 11 accepted weapons.
 *
 * Blockout barrel lengths are approximate and tunable.
 * Damage model values are reference placeholders, not final game balance.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { WeaponProfile } from './blockoutProfiles';

/** All weapon profiles keyed by ID. */
export const WEAPON_PROFILES: Record<string, WeaponProfile> = {
  smoky: {
    id: 'smoky',
    displayName: 'Smoky',
    behavior: 'instant_projectile',
    recoilProfile: 'smoky',
    vfxProfile: 'instant_projectile',
    damageModel: {
      directDamage: 20,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 12,
    blockoutBarrelWidth: 3,
  },
  thunder: {
    id: 'thunder',
    displayName: 'Thunder',
    behavior: 'instant_splash',
    recoilProfile: 'thunder',
    vfxProfile: 'instant_splash',
    damageModel: {
      directDamage: 25,
      splashRadius: 60,
      splashFalloff: true,
      penetration: false,
      selfDamageScale: 0.3,
    },
    blockoutBarrelLength: 10,
    blockoutBarrelWidth: 5,
  },
  railgun: {
    id: 'railgun',
    displayName: 'Railgun',
    behavior: 'line_pierce',
    recoilProfile: 'railgun',
    vfxProfile: 'line_pierce',
    damageModel: {
      directDamage: 40,
      splashRadius: 0,
      splashFalloff: false,
      penetration: true,
      maxPenetrationTargets: 3,
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 20,
    blockoutBarrelWidth: 3,
  },
  shaft: {
    id: 'shaft',
    displayName: 'Shaft',
    behavior: 'charge_sniper',
    recoilProfile: 'shaft',
    vfxProfile: 'charge_sniper',
    damageModel: {
      directDamage: 60,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 18,
    blockoutBarrelWidth: 3,
  },
  flamethrower: {
    id: 'flamethrower',
    displayName: 'Flamethrower',
    behavior: 'cone_stream',
    recoilProfile: 'flamethrower',
    vfxProfile: 'cone_stream',
    damageModel: {
      damagePerSecond: 30,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      statusEffect: 'burn',
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 8,
    blockoutBarrelWidth: 4,
  },
  freeze: {
    id: 'freeze',
    displayName: 'Freeze',
    behavior: 'cone_stream',
    recoilProfile: 'freeze',
    vfxProfile: 'cone_stream',
    damageModel: {
      damagePerSecond: 15,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      statusEffect: 'freeze',
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 8,
    blockoutBarrelWidth: 4,
  },
  isida: {
    id: 'isida',
    displayName: 'Isida',
    behavior: 'beam_support',
    recoilProfile: 'isida',
    vfxProfile: 'beam_support',
    damageModel: {
      damagePerSecond: 25,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      statusEffect: 'heal',
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 6,
    blockoutBarrelWidth: 4,
  },
  vulcan: {
    id: 'vulcan',
    displayName: 'Vulcan',
    behavior: 'rapid_fire_overheat',
    recoilProfile: 'vulcan',
    vfxProfile: 'rapid_fire',
    damageModel: {
      directDamage: 5,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      statusEffect: 'overheat',
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 14,
    blockoutBarrelWidth: 3,
  },
  twins: {
    id: 'twins',
    displayName: 'Twins',
    behavior: 'plasma_projectile',
    recoilProfile: 'twins',
    vfxProfile: 'plasma_projectile',
    damageModel: {
      directDamage: 12,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 10,
    blockoutBarrelWidth: 3,
  },
  ricochet: {
    id: 'ricochet',
    displayName: 'Ricochet',
    behavior: 'ricochet_projectile',
    recoilProfile: 'ricochet',
    vfxProfile: 'ricochet_projectile',
    damageModel: {
      directDamage: 18,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 11,
    blockoutBarrelWidth: 4,
  },
  hammer: {
    id: 'hammer',
    displayName: 'Hammer',
    behavior: 'shotgun_cone',
    recoilProfile: 'hammer',
    vfxProfile: 'shotgun_cone',
    damageModel: {
      directDamage: 35,
      splashRadius: 0,
      splashFalloff: false,
      penetration: false,
      selfDamageScale: 0,
    },
    blockoutBarrelLength: 7,
    blockoutBarrelWidth: 5,
  },
};

/** Ordered list of all weapon IDs. */
export const ALL_WEAPON_IDS = Object.keys(WEAPON_PROFILES) as Array<keyof typeof WEAPON_PROFILES>;

/** Get a weapon profile by ID. Returns undefined if not found. */
export function getWeaponProfile(id: string): WeaponProfile | undefined {
  return WEAPON_PROFILES[id];
}
