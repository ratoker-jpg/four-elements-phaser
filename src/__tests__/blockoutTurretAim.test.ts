import { describe, expect, it, beforeEach } from 'vitest';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { rotateTurretToward, setTurretRestTarget } from '../state/blockoutTurretAim';

describe('blockoutTurretAim', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('sets body-parallel rest as the turret target', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 2);
    vehicle.turretTargetAngle = 0;

    setTurretRestTarget(vehicle);

    expect(vehicle.turretTargetAngle).toBe(vehicle.bodyAngle);
  });

  it('rotates smoothly toward rest without snapping when delta is limited', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 2, 90);
    vehicle.turretAngle = 0;

    rotateTurretToward(vehicle, vehicle.bodyAngle, 100);

    expect(vehicle.turretTargetAngle).toBe(vehicle.bodyAngle);
    expect(vehicle.turretAngle).toBeGreaterThan(0);
    expect(vehicle.turretAngle).toBeLessThan(vehicle.bodyAngle);
  });

  it('reaches rest when the allowed turn delta covers the remaining angle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 2, 360);
    vehicle.turretAngle = 0;

    rotateTurretToward(vehicle, vehicle.bodyAngle, 1000);

    expect(vehicle.turretAngle).toBe(vehicle.bodyAngle);
  });
});
