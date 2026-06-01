/**
 * Blockout movement data — movement profiles per body.
 *
 * Blockout placeholder — NOT used for physics in BLOCKOUT-02H.
 * Vehicles are stationary in this PR.
 * Data exists so profiles are complete for future steps.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 */

import type { MovementProfile } from './blockoutProfiles';

/** Movement profiles keyed by body ID. */
export const MOVEMENT_PROFILES: Record<string, MovementProfile> = {
  wasp: {
    bodyId: 'wasp',
    maxSpeed: 13.0,
    acceleration: 8.0,
    braking: 6.0,
    turnSpeedDeg: 150,
    turnAccelerationDeg: 200,
    lateralAcceleration: 3.0,
    massKg: 2200,
    enginePower: 1300,
    bodyRotationLag: 0.1,
  },
  hornet: {
    bodyId: 'hornet',
    maxSpeed: 12.0,
    acceleration: 7.0,
    braking: 5.5,
    turnSpeedDeg: 130,
    turnAccelerationDeg: 180,
    lateralAcceleration: 2.5,
    massKg: 2400,
    enginePower: 1400,
    bodyRotationLag: 0.15,
  },
  hunter: {
    bodyId: 'hunter',
    maxSpeed: 10.0,
    acceleration: 5.5,
    braking: 4.5,
    turnSpeedDeg: 140,
    turnAccelerationDeg: 160,
    lateralAcceleration: 2.0,
    massKg: 3000,
    enginePower: 1400,
    bodyRotationLag: 0.2,
  },
  viking: {
    bodyId: 'viking',
    maxSpeed: 9.0,
    acceleration: 5.0,
    braking: 4.0,
    turnSpeedDeg: 110,
    turnAccelerationDeg: 140,
    lateralAcceleration: 1.8,
    massKg: 3000,
    enginePower: 1500,
    bodyRotationLag: 0.25,
  },
  dictator: {
    bodyId: 'dictator',
    maxSpeed: 8.0,
    acceleration: 4.5,
    braking: 3.5,
    turnSpeedDeg: 130,
    turnAccelerationDeg: 160,
    lateralAcceleration: 2.0,
    massKg: 3300,
    enginePower: 1500,
    bodyRotationLag: 0.2,
  },
  titan: {
    bodyId: 'titan',
    maxSpeed: 6.0,
    acceleration: 3.0,
    braking: 2.5,
    turnSpeedDeg: 90,
    turnAccelerationDeg: 100,
    lateralAcceleration: 1.2,
    massKg: 5000,
    enginePower: 1600,
    bodyRotationLag: 0.4,
  },
  mammoth: {
    bodyId: 'mammoth',
    maxSpeed: 5.0,
    acceleration: 2.5,
    braking: 2.0,
    turnSpeedDeg: 80,
    turnAccelerationDeg: 90,
    lateralAcceleration: 1.0,
    massKg: 5500,
    enginePower: 1500,
    bodyRotationLag: 0.5,
  },
};
