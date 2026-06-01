/**
 * Blockout VFX data — VFX profiles per weapon behavior.
 *
 * Blockout placeholder — NOT used in BLOCKOUT-02H.
 * No weapon VFX in this PR.
 * Data exists so profiles are complete for future steps.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { VfxProfile } from './blockoutProfiles';

/** VFX profiles keyed by weapon behavior. */
export const VFX_PROFILES: Record<string, VfxProfile> = {
  instant_projectile: {
    behavior: 'instant_projectile',
    primitiveType: 'ray',
    color: 0xffff00,
    width: 2,
    durationMs: 100,
  },
  instant_splash: {
    behavior: 'instant_splash',
    primitiveType: 'circle',
    color: 0xff6600,
    width: 0,
    durationMs: 200,
  },
  line_pierce: {
    behavior: 'line_pierce',
    primitiveType: 'line',
    color: 0x00ffff,
    width: 2,
    durationMs: 150,
  },
  charge_sniper: {
    behavior: 'charge_sniper',
    primitiveType: 'ray',
    color: 0xff00ff,
    width: 3,
    durationMs: 200,
  },
  cone_stream: {
    behavior: 'cone_stream',
    primitiveType: 'cone_sector',
    color: 0xff4400,
    width: 0,
    durationMs: 50,
  },
  beam_support: {
    behavior: 'beam_support',
    primitiveType: 'beam_tether',
    color: 0x00ff88,
    width: 2,
    durationMs: 50,
  },
  rapid_fire_overheat: {
    behavior: 'rapid_fire_overheat',
    primitiveType: 'ray',
    color: 0xffaa00,
    width: 1,
    durationMs: 60,
  },
  plasma_projectile: {
    behavior: 'plasma_projectile',
    primitiveType: 'projectile_dot',
    color: 0x88ff00,
    width: 3,
    durationMs: 200,
  },
  ricochet_projectile: {
    behavior: 'ricochet_projectile',
    primitiveType: 'bounce_marker',
    color: 0xff0088,
    width: 3,
    durationMs: 300,
  },
  shotgun_cone: {
    behavior: 'shotgun_cone',
    primitiveType: 'ray',
    color: 0xffcc00,
    width: 1,
    durationMs: 80,
  },
};
