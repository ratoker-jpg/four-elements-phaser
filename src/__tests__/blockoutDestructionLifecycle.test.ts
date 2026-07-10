import { beforeEach, describe, expect, it } from 'vitest';
import {
  BLOCKOUT_WRECK_LIFETIME_MS,
  updateBlockoutDestructionLifecycle,
} from '../state/blockoutDestructionLifecycle';
import {
  createBlockoutVehicle,
  resetBlockoutVehicleIdCounter,
} from '../state/blockoutVehicleState';
import { TileReservationMap } from '../state/tileReservation';
import { decideRosterClick, type ArenaRosterRow } from '../state/arenaRoster';

describe('blockout destruction lifecycle', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('keeps live vehicles unchanged', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 2, 2);
    const vehicles = [vehicle];

    const result = updateBlockoutDestructionLifecycle(vehicles, 1000);

    expect(result.destroyedIds).toEqual([]);
    expect(result.removedIds).toEqual([]);
    expect(vehicles).toEqual([vehicle]);
  });

  it('neutralizes a destroyed vehicle and releases its reservation while the wreck is visible', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 2, 2);
    const reservations = new TileReservationMap(20);
    reservations.reserve(3, 2, {
      unitId: vehicle.id,
      unitType: 'combat-vehicle',
    }, 100);

    vehicle.isDestroyed = true;
    vehicle.destroyedAt = 100;
    vehicle.fireHeld = true;
    vehicle.isFiring = true;
    vehicle.weaponRuntime.isAutoFiring = true;
    vehicle.targetVehicleId = 'enemy';
    vehicle.hasMoveTarget = true;
    vehicle.speed = 5;
    vehicle.vx = 3;
    vehicle.vy = 4;
    vehicle.gridMovement.phase = 'moving_segment';
    vehicle.gridMovement.path = [{ tx: 3, ty: 2 }];
    vehicle.gridMovement.reservedTileTx = 3;
    vehicle.gridMovement.reservedTileTy = 2;

    const vehicles = [vehicle];
    const result = updateBlockoutDestructionLifecycle(vehicles, 500, reservations);

    expect(result.destroyedIds).toEqual([vehicle.id]);
    expect(result.removedIds).toEqual([]);
    expect(vehicles).toHaveLength(1);
    expect(reservations.size).toBe(0);
    expect(vehicle.targetVehicleId).toBeNull();
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
    expect(vehicle.weaponRuntime.isAutoFiring).toBe(false);
    expect(vehicle.hasMoveTarget).toBe(false);
    expect(vehicle.speed).toBe(0);
    expect(vehicle.vx).toBe(0);
    expect(vehicle.vy).toBe(0);
    expect(vehicle.gridMovement.phase).toBe('idle');
    expect(vehicle.gridMovement.path).toEqual([]);
    expect(vehicle.gridMovement.reservedTileTx).toBe(-1);
    expect(vehicle.gridMovement.reservedTileTy).toBe(-1);
  });

  it('removes a wreck after the bounded lifetime', () => {
    const destroyed = createBlockoutVehicle('wasp', 'smoky', 'cyan', 2, 2);
    const alive = createBlockoutVehicle('hunter', 'railgun', 'green', 4, 4);
    destroyed.isDestroyed = true;
    destroyed.destroyedAt = 100;
    const vehicles = [destroyed, alive];

    const result = updateBlockoutDestructionLifecycle(
      vehicles,
      100 + BLOCKOUT_WRECK_LIFETIME_MS,
    );

    expect(result.removedIds).toEqual([destroyed.id]);
    expect(vehicles).toEqual([alive]);
  });

  it('clears target and firing state as soon as the target is destroyed', () => {
    const shooter = createBlockoutVehicle('hunter', 'railgun', 'cyan', 2, 2);
    const target = createBlockoutVehicle('wasp', 'smoky', 'purple', 5, 5);
    shooter.targetVehicleId = target.id;
    shooter.fireHeld = true;
    shooter.isFiring = true;
    shooter.weaponRuntime.isAutoFiring = true;
    target.isDestroyed = true;
    target.destroyedAt = 100;

    updateBlockoutDestructionLifecycle([shooter, target], 200);

    expect(shooter.targetVehicleId).toBeNull();
    expect(shooter.fireHeld).toBe(false);
    expect(shooter.isFiring).toBe(false);
    expect(shooter.weaponRuntime.isAutoFiring).toBe(false);
  });
});

describe('destroyed Arena roster rows', () => {
  it('cannot be selected or assigned as targets', () => {
    const row: ArenaRosterRow = {
      id: 'dead-unit',
      bodyId: 'wasp',
      weaponId: 'smoky',
      team: 'ally',
      hp: 0,
      maxHp: 100,
      isDestroyed: true,
      isSelected: false,
      isTargeted: false,
    };

    expect(decideRosterClick(row, null, [])).toEqual({ type: 'noop' });
  });
});
