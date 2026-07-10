from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if new in content:
        return
    if old not in content:
        raise RuntimeError(f"Expected marker not found in {path}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


LIFECYCLE_MODULE = r'''/**
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
'''

TEST_MODULE = r'''import { beforeEach, describe, expect, it } from 'vitest';
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
'''

write('src/state/blockoutDestructionLifecycle.ts', LIFECYCLE_MODULE)
write('src/__tests__/blockoutDestructionLifecycle.test.ts', TEST_MODULE)

# GameScene: integrate lifecycle before render sync.
replace_once(
    'src/phaser/GameScene.ts',
    "import { tickContinuousDamage, expireDamageEvents } from '../state/blockoutDamage';\n",
    "import { tickContinuousDamage, expireDamageEvents } from '../state/blockoutDamage';\n"
    "import { updateBlockoutDestructionLifecycle } from '../state/blockoutDestructionLifecycle';\n",
)
replace_once(
    'src/phaser/GameScene.ts',
    "      // BLOCKOUT-07H+: Expire damage events\n"
    "      expireDamageEvents(nowMs);\n"
    "    }\n"
    "    // Stage 4 FIXUP-1: blockout render sync delegated to RenderManager\n",
    "      // BLOCKOUT-07H+: Expire damage events\n"
    "      expireDamageEvents(nowMs);\n"
    "    }\n"
    "\n"
    "    // SKIRMISH-P1: destroyed vehicles become non-interactive wrecks, then\n"
    "    // leave canonical state after a bounded delay. Run before render sync so\n"
    "    // stale adapters, selection and target references disappear this frame.\n"
    "    if (this.gameState.blockoutVehicles && this.devtoolsActive) {\n"
    "      const destruction = updateBlockoutDestructionLifecycle(\n"
    "        this.gameState.blockoutVehicles,\n"
    "        this.time.now,\n"
    "        this.reservationMap ?? undefined,\n"
    "      );\n"
    "      const selectedId = this.blockoutVehicleInputController?.selectedVehicleId ?? null;\n"
    "      if (selectedId && destruction.destroyedIds.includes(selectedId)) {\n"
    "        this.blockoutVehicleInputController?.setSelectedVehicleId(null);\n"
    "      }\n"
    "    }\n"
    "\n"
    "    // Stage 4 FIXUP-1: blockout render sync delegated to RenderManager\n",
)

# Input: destroyed vehicles are never selectable/hittable, including roster-driven selection.
replace_once(
    'src/phaser/input/BlockoutVehicleInputController.ts',
    "  setSelectedVehicleId(vehicleId: string | null): void {\n"
    "    // Clean up previous selection\n",
    "  setSelectedVehicleId(vehicleId: string | null): void {\n"
    "    if (vehicleId) {\n"
    "      const candidate = this.getGameState().blockoutVehicles?.find(v => v.id === vehicleId);\n"
    "      if (!candidate || candidate.isDestroyed) vehicleId = null;\n"
    "    }\n"
    "\n"
    "    // Clean up previous selection\n",
)
replace_once(
    'src/phaser/input/BlockoutVehicleInputController.ts',
    "    for (const vehicle of vehicles) {\n"
    "      const bodySize = getBodyPixelSize(vehicle.bodyId);\n",
    "    for (const vehicle of vehicles) {\n"
    "      if (vehicle.isDestroyed) continue;\n"
    "      const bodySize = getBodyPixelSize(vehicle.bodyId);\n",
)

# Roster: dead rows remain informational during the wreck window but cannot issue actions.
replace_once(
    'src/state/arenaRoster.ts',
    "export function decideRosterClick(\n"
    "  row: ArenaRosterRow,\n"
    "  selectedVehicleId: string | null,\n"
    "  vehicles: BlockoutVehicleState[] | undefined,\n"
    "): RosterClickAction {\n"
    "  if (row.team === 'ally') {\n",
    "export function decideRosterClick(\n"
    "  row: ArenaRosterRow,\n"
    "  selectedVehicleId: string | null,\n"
    "  vehicles: BlockoutVehicleState[] | undefined,\n"
    "): RosterClickAction {\n"
    "  if (row.isDestroyed) return { type: 'noop' };\n"
    "\n"
    "  if (row.team === 'ally') {\n",
)

# Renderer: hide the live modular/generated model at death and draw a fading wreck/explosion.
replace_once(
    'src/phaser/render/BlockoutVehicleRenderer.ts',
    "import { BlockoutMotionFeedbackRenderer } from './BlockoutMotionFeedbackRenderer';\n",
    "import { BlockoutMotionFeedbackRenderer } from './BlockoutMotionFeedbackRenderer';\n"
    "import {\n"
    "  BLOCKOUT_EXPLOSION_DURATION_MS,\n"
    "  BLOCKOUT_WRECK_LIFETIME_MS,\n"
    "} from '../../state/blockoutDestructionLifecycle';\n",
)
replace_once(
    'src/phaser/render/BlockoutVehicleRenderer.ts',
    "      const modularResult = this.modularAdapter.syncVehicle(vehicle);\n"
    "      const useModularBody = modularResult.usedModular;\n",
    "      let useModularBody = false;\n"
    "      if (vehicle.isDestroyed) {\n"
    "        // SKIRMISH-P1: remove the live modular tank immediately. The bounded\n"
    "        // procedural wreck below is the only death representation.\n"
    "        this.modularAdapter.removeVehicle(vehicle.id);\n"
    "      } else {\n"
    "        const modularResult = this.modularAdapter.syncVehicle(vehicle);\n"
    "        useModularBody = modularResult.usedModular;\n"
    "      }\n",
)
replace_once(
    'src/phaser/render/BlockoutVehicleRenderer.ts',
    "      let hullKey: string | null;\n"
    "      if (isWaspCalibrating) {\n",
    "      let hullKey: string | null;\n"
    "      if (vehicle.isDestroyed) {\n"
    "        hullKey = null;\n"
    "      } else if (isWaspCalibrating) {\n",
)

renderer_path = 'src/phaser/render/BlockoutVehicleRenderer.ts'
renderer = read(renderer_path)
start_marker = "    // ── BLOCKOUT-07H+: Destroyed vehicle rendering ────────────────\n    if (vehicle.isDestroyed) {"
end_marker = "\n    // ── Vehicle shadow (projected ground-plane) ──────────────────"
start = renderer.find(start_marker)
if start < 0:
    if 'SKIRMISH-P1: bounded explosion and fading wreck' not in renderer:
        raise RuntimeError('Destroyed renderer start marker not found')
else:
    end = renderer.find(end_marker, start)
    if end < 0:
        raise RuntimeError('Destroyed renderer end marker not found')
    replacement = r'''    // ── SKIRMISH-P1: bounded explosion and fading wreck ────────────
    if (vehicle.isDestroyed) {
      const ageMs = Math.max(0, this.scene.time.now - vehicle.destroyedAt);
      const wreckT = Math.min(1, ageMs / BLOCKOUT_WRECK_LIFETIME_MS);
      const wreckAlpha = Math.max(0, 0.48 * (1 - wreckT));
      const cosA = Math.cos(bodyAngle);
      const sinA = Math.sin(bodyAngle);
      const localCorners = [
        { lx: -halfW, ly: -halfH },
        { lx: halfW, ly: -halfH },
        { lx: halfW, ly: halfH },
        { lx: -halfW, ly: halfH },
      ];
      const basePts = localCorners.map(c => {
        const wx = tilePos.x + c.lx * cosA - c.ly * sinA;
        const wy = tilePos.y + c.lx * sinA + c.ly * cosA;
        return projectWorldPoint(wx, wy, 0, this.offset);
      });

      // Dark, fading hull silhouette. No permanent red X and no live turret.
      g.fillStyle(0x181818, wreckAlpha);
      g.beginPath();
      g.moveTo(basePts[0].x, basePts[0].y);
      for (let i = 1; i < basePts.length; i++) g.lineTo(basePts[i].x, basePts[i].y);
      g.closePath();
      g.fillPath();
      g.lineStyle(1.5, 0x5c5148, wreckAlpha * 1.4);
      g.strokePath();

      // Short procedural explosion pulse. This is intentionally bounded and
      // asset-independent so every hull has a valid death effect.
      if (ageMs < BLOCKOUT_EXPLOSION_DURATION_MS) {
        const explosionT = ageMs / BLOCKOUT_EXPLOSION_DURATION_MS;
        const explosionAlpha = Math.max(0, 1 - explosionT);
        const radius = 8 + explosionT * 30;
        const explosionY = cy - 7;

        g.fillStyle(0xffb020, 0.7 * explosionAlpha);
        g.fillCircle(cx, explosionY, Math.max(2, radius * 0.46));
        g.fillStyle(0xffe28a, 0.75 * explosionAlpha);
        g.fillCircle(cx, explosionY, Math.max(1, radius * 0.22));
        g.lineStyle(2.5, 0xff6a00, 0.9 * explosionAlpha);
        g.strokeCircle(cx, explosionY, radius);

        for (let i = 0; i < 8; i++) {
          const angle = bodyAngle + (Math.PI * 2 * i) / 8;
          const inner = radius * 0.35;
          const outer = radius * (0.75 + (i % 2) * 0.18);
          g.lineStyle(1.5, i % 2 === 0 ? 0xffcc55 : 0xff6a00, explosionAlpha);
          g.beginPath();
          g.moveTo(cx + Math.cos(angle) * inner, explosionY + Math.sin(angle) * inner);
          g.lineTo(cx + Math.cos(angle) * outer, explosionY + Math.sin(angle) * outer);
          g.strokePath();
        }
      } else {
        const smokeT = Math.min(1, (ageMs - BLOCKOUT_EXPLOSION_DURATION_MS) / 700);
        const smokeAlpha = Math.max(0, 0.22 * (1 - smokeT));
        g.fillStyle(0x777777, smokeAlpha);
        g.fillCircle(cx - 4, cy - 13 - smokeT * 7, 7 + smokeT * 5);
        g.fillCircle(cx + 5, cy - 18 - smokeT * 10, 5 + smokeT * 4);
      }

      return;
    }
'''
    renderer = renderer[:start] + replacement + renderer[end:]
    write(renderer_path, renderer)

print('SKIRMISH-P1 patch applied')
