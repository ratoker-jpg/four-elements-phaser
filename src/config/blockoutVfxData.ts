/**
 * Blockout VFX data — VFX profiles per weapon behavior.
 *
 * BLOCKOUT-02H: First visible blockout vehicles (placeholder data).
 * BLOCKOUT-05H+: Extended with rendering config for Smoky/Railgun/Thunder.
 * Other weapon behaviors have placeholder values for future steps.
 */

import type { VfxProfile } from './blockoutProfiles';
import { getWeaponProfile } from './blockoutWeaponData';

/** VFX profiles keyed by weapon behavior. */
export const VFX_PROFILES: Record<string, VfxProfile> = {
  instant_projectile: {
    behavior: 'instant_projectile',
    primitiveType: 'ray',
    color: 0xffff00,
    width: 2,
    durationMs: 150,
    secondaryColor: 0xffaa00,
    impactRadiusPx: 4,
    muzzleFlashRadiusPx: 5,
    effectLengthPx: 250,
  },
  instant_splash: {
    behavior: 'instant_splash',
    primitiveType: 'circle',
    color: 0xff6600,
    width: 0,
    durationMs: 300,
    secondaryColor: 0xff3300,
    impactRadiusPx: 40,
    muzzleFlashRadiusPx: 4,
    effectLengthPx: 200,
  },
  line_pierce: {
    behavior: 'line_pierce',
    primitiveType: 'line',
    color: 0x00ffff,
    width: 2,
    durationMs: 200,
    secondaryColor: 0x88ffff,
    impactRadiusPx: 0,
    muzzleFlashRadiusPx: 6,
    effectLengthPx: 400,
  },
  charge_sniper: {
    behavior: 'charge_sniper',
    primitiveType: 'ray',
    color: 0xff00ff,
    width: 3,
    durationMs: 200,
    secondaryColor: 0xff88ff,
    impactRadiusPx: 3,
    muzzleFlashRadiusPx: 4,
    effectLengthPx: 450,
    coneAngleDeg: 0,
    chargePulseMs: 150,
  },
  cone_stream: {
    behavior: 'cone_stream',
    primitiveType: 'cone_sector',
    color: 0xff4400,
    width: 0,
    durationMs: 50,
    effectLengthPx: 120,
    coneAngleDeg: 25,
    streamCadenceMs: 50,
  },
  beam_support: {
    behavior: 'beam_support',
    primitiveType: 'beam_tether',
    color: 0x00ff88,
    width: 2,
    durationMs: 50,
    effectLengthPx: 150,
    streamCadenceMs: 50,
  },
  rapid_fire_overheat: {
    behavior: 'rapid_fire_overheat',
    primitiveType: 'ray',
    color: 0xffaa00,
    width: 1,
    durationMs: 60,
    muzzleFlashRadiusPx: 3,
    effectLengthPx: 200,
    streamCadenceMs: 60,
    overheatDurationMs: 3000,
  },
  plasma_projectile: {
    behavior: 'plasma_projectile',
    primitiveType: 'projectile_dot',
    color: 0x88ff00,
    width: 3,
    durationMs: 200,
    effectLengthPx: 220,
    muzzleFlashRadiusPx: 3,
  },
  ricochet_projectile: {
    behavior: 'ricochet_projectile',
    primitiveType: 'bounce_marker',
    color: 0xff0088,
    width: 3,
    durationMs: 300,
    effectLengthPx: 200,
    bounceCount: 2,
  },
  shotgun_cone: {
    behavior: 'shotgun_cone',
    primitiveType: 'ray',
    color: 0xffcc00,
    width: 1,
    durationMs: 80,
    muzzleFlashRadiusPx: 6,
    effectLengthPx: 150,
    coneAngleDeg: 30,
    pelletCount: 5,
  },
};

/** Ordered list of all VFX behavior keys. */
export const ALL_VFX_BEHAVIORS = Object.keys(VFX_PROFILES);

/**
 * Get VFX profile for a specific weapon by looking up its behavior.
 * BLOCKOUT-05H+: Convenience helper that chains weaponId -> behavior -> VfxProfile.
 */
export function getWeaponVfxProfile(weaponId: string): VfxProfile | undefined {
  const weapon = getWeaponProfile(weaponId);
  if (!weapon) return undefined;
  return VFX_PROFILES[weapon.vfxProfile];
}
