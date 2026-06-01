/**
 * Blockout recoil data — recoil profiles per weapon.
 *
 * Blockout placeholder — NOT used in BLOCKOUT-02H.
 * No recoil behavior in this PR.
 * Data exists so profiles are complete for future steps.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { RecoilProfile } from './blockoutProfiles';

/** Recoil profiles keyed by weapon ID. */
export const RECOIL_PROFILES: Record<string, RecoilProfile> = {
  smoky: {
    weaponId: 'smoky',
    barrelKickback: 3,
    turretKickback: 1,
    bodyImpulse: 0.5,
    recoveryMs: 200,
    cameraShake: false,
  },
  thunder: {
    weaponId: 'thunder',
    barrelKickback: 4,
    turretKickback: 2,
    bodyImpulse: 1.0,
    recoveryMs: 300,
    cameraShake: false,
  },
  railgun: {
    weaponId: 'railgun',
    barrelKickback: 6,
    turretKickback: 3,
    bodyImpulse: 2.0,
    recoveryMs: 400,
    cameraShake: false,
  },
  shaft: {
    weaponId: 'shaft',
    barrelKickback: 7,
    turretKickback: 3,
    bodyImpulse: 2.5,
    recoveryMs: 500,
    cameraShake: false,
  },
  flamethrower: {
    weaponId: 'flamethrower',
    barrelKickback: 0.5,
    turretKickback: 0.2,
    bodyImpulse: 0.1,
    recoveryMs: 50,
    cameraShake: false,
  },
  freeze: {
    weaponId: 'freeze',
    barrelKickback: 0.5,
    turretKickback: 0.2,
    bodyImpulse: 0.1,
    recoveryMs: 50,
    cameraShake: false,
  },
  isida: {
    weaponId: 'isida',
    barrelKickback: 0.3,
    turretKickback: 0.1,
    bodyImpulse: 0.05,
    recoveryMs: 30,
    cameraShake: false,
  },
  vulcan: {
    weaponId: 'vulcan',
    barrelKickback: 0.8,
    turretKickback: 0.3,
    bodyImpulse: 0.15,
    recoveryMs: 80,
    cameraShake: false,
  },
  twins: {
    weaponId: 'twins',
    barrelKickback: 1.0,
    turretKickback: 0.4,
    bodyImpulse: 0.2,
    recoveryMs: 100,
    cameraShake: false,
  },
  ricochet: {
    weaponId: 'ricochet',
    barrelKickback: 1.2,
    turretKickback: 0.5,
    bodyImpulse: 0.3,
    recoveryMs: 120,
    cameraShake: false,
  },
  hammer: {
    weaponId: 'hammer',
    barrelKickback: 5,
    turretKickback: 2.5,
    bodyImpulse: 1.5,
    recoveryMs: 350,
    cameraShake: false,
  },
};
