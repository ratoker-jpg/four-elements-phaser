/**
 * Bounded destruction lifecycle for Arena/blockout combat vehicles.
 *
 * Pure TypeScript: no Phaser or DOM dependencies. Destruction is a short,
 * non-interactive transition rather than a permanent crossed-out unit.
 */

import type { BlockoutVehicleState } from './blockoutVehicleState';
import type { TileReservationMap } from './tileReservation';
import { clearTargetAndWeaponState } from './weaponFireCoordinator';

/** Bright explosion pulse duration. Rendering may use this shared value. */
export const BLOCKOUT_EXPLOSION_DURATION_MS = 450;

/** Total time a destroyed vehicle remains as a fading wreck. */
export const BLOCKOUT_WRECK_LIFETIME_MS = 1800;

export interface BlockoutDestructionUpdateResult {
  /** All vehicles currently in their destroyed/wreck transition. */
  destroyedIds: string[];
  /** Vehicles removed from canonical state during this update. */
  removedIds: string[];
}

/**
 * Stop a destroyed vehicle and release all transient gameplay ownership.
 * This function is intentionally idempotent because it runs while the wreck
 * remains visible.
 */
function neutralizeDestroyedVehicle(
  vehicle: BlockoutVehicleState,
  reservationMap?: Pick<TileReservationMap, 'releaseAll'>,
): void {
  clearTargetAndWeaponState(vehicle);

  vehicle.hasMoveTarget = false;
  vehicle.targetWorldX = vehicle.worldX;
  vehicle.targetWorldY = vehicle.worldY;
  vehicle.speed = 0;
  vehicle.vx = 0;
  vehicle.vy = 0;
  vehicle.recoilActive = false;
  vehicle.recoilBarrelOffset = 0;
  vehicle.recoilTurretOffset = 0;
  vehicle.recoilBodyOffset = 0;
  vehicle.activeStatusTags = [];

  const movement = vehicle.gridMovement;
  movement.phase = 'idle';
  movement.path = [];
  movement.pathIndex = 0;
  movement.speed = 0;
  movement.targetTx = movement.currentTileTx;
  movement.targetTy = movement.currentTileTy;
  movement.reservedTileTx = -1;
  movement.reservedTileTy = -1;
  movement.waitStartedAt = 0;
  movement.repathAttempts = 0;
  movement.currentDirection = 'none';
  movement.smoothingActive = false;
  movement.smoothingProgress = 0;

  reservationMap?.releaseAll(vehicle.id);
}

/**
 * Advance destruction transitions and remove expired wrecks in place.
 *
 * Target references to destroyed vehicles are cleared immediately, not only
 * when the wreck is finally removed. This prevents firing, wind-up and chase
 * state from surviving the target's death.
 */
export function updateBlockoutDestructionLifecycle(
  vehicles: BlockoutVehicleState[],
  nowMs: number,
  reservationMap?: Pick<TileReservationMap, 'releaseAll'>,
): BlockoutDestructionUpdateResult {
  const destroyedIds = new Set<string>();
  const removedIds: string[] = [];

  for (const vehicle of vehicles) {
    if (!vehicle.isDestroyed) continue;

    destroyedIds.add(vehicle.id);
    neutralizeDestroyedVehicle(vehicle, reservationMap);

    const destroyedAt = Number.isFinite(vehicle.destroyedAt)
      ? Math.max(0, vehicle.destroyedAt)
      : nowMs;
    vehicle.destroyedAt = destroyedAt;

    if (nowMs - destroyedAt >= BLOCKOUT_WRECK_LIFETIME_MS) {
      removedIds.push(vehicle.id);
    }
  }

  // A destroyed target is invalid immediately, while its wreck is still visible.
  if (destroyedIds.size > 0) {
    for (const vehicle of vehicles) {
      if (vehicle.targetVehicleId && destroyedIds.has(vehicle.targetVehicleId)) {
        clearTargetAndWeaponState(vehicle);
      }
    }
  }

  if (removedIds.length > 0) {
    const removed = new Set(removedIds);
    let writeIndex = 0;
    for (const vehicle of vehicles) {
      if (removed.has(vehicle.id)) continue;
      vehicles[writeIndex++] = vehicle;
    }
    vehicles.length = writeIndex;
  }

  return {
    destroyedIds: Array.from(destroyedIds),
    removedIds,
  };
}
