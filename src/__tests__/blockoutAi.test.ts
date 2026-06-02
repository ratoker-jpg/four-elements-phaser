/**
 * Tests for ARENA-05H+: Enemy Behavior Modes.
 *
 * Verifies:
 * - passive enemy does not move/fire
 * - stationary_shooter targets ally and fires without moving
 * - chaser sets movement toward ally
 * - hold_position only engages ally within hold radius
 * - destroyed/missing target clears safely
 * - allies do not run AI
 * - AI update is gated to Arena mode (via game code, tested indirectly)
 * - findNearestAlly respects range
 * - aimTurretAtTarget updates turretTargetAngle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBlockoutVehicle,
  resetBlockoutVehicleIdCounter,
  type BlockoutVehicleState,
} from '../state/blockoutVehicleState';
import {
  updateBlockoutAi,
  findNearestAlly,
  aimTurretAtTarget,
  type BlockoutAiOptions,
  resetAiTickTimer,
} from '../state/blockoutAi';
import { resetVfxEventIdCounter, clearVfxEvents } from '../state/blockoutWeaponVfx';

// ─── Helpers ──────────────────────────────────────────────────────────

const OFFSET_X = 400;
const OFFSET_Y = 200;

function makeOptions(nowMs: number = 1000): BlockoutAiOptions {
  return { nowMs, offsetX: OFFSET_X, offsetY: OFFSET_Y };
}

function createAlly(tx: number, ty: number): BlockoutVehicleState {
  return createBlockoutVehicle('viking', 'smoky', 'cyan', tx, ty, Math.PI / 2, 120, 'ally');
}

function createEnemy(tx: number, ty: number, aiMode: BlockoutVehicleState['aiMode'] = 'passive'): BlockoutVehicleState {
  const enemy = createBlockoutVehicle('wasp', 'smoky', 'green', tx, ty, Math.PI / 2, 120, 'enemy');
  enemy.aiMode = aiMode;
  return enemy;
}

// ─── findNearestAlly ────────────────────────────────────────────────

describe('ARENA-05H+ findNearestAlly', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('returns nearest alive ally', () => {
    const ally1 = createAlly(5, 5);
    const ally2 = createAlly(10, 10);
    const enemy = createEnemy(6, 6);
    const vehicles = [ally1, ally2, enemy];

    const result = findNearestAlly(vehicles, enemy, OFFSET_X, OFFSET_Y);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(ally1.id);
  });

  it('returns null when no allies exist', () => {
    const enemy = createEnemy(5, 5);
    const vehicles = [enemy];

    const result = findNearestAlly(vehicles, enemy, OFFSET_X, OFFSET_Y);

    expect(result).toBeNull();
  });

  it('returns null when all allies are destroyed', () => {
    const ally = createAlly(5, 5);
    ally.isDestroyed = true;
    ally.hp = 0;
    const enemy = createEnemy(6, 6);
    const vehicles = [ally, enemy];

    const result = findNearestAlly(vehicles, enemy, OFFSET_X, OFFSET_Y);

    expect(result).toBeNull();
  });

  it('respects maxRangePx', () => {
    const ally1 = createAlly(5, 5);
    const ally2 = createAlly(15, 15);
    const enemy = createEnemy(6, 6);
    const vehicles = [ally1, ally2, enemy];

    // Small range: only ally1 should be in range
    const result = findNearestAlly(vehicles, enemy, OFFSET_X, OFFSET_Y, 100);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(ally1.id);
  });

  it('skips enemy vehicles', () => {
    const enemy1 = createEnemy(5, 5);
    const enemy2 = createEnemy(6, 6);
    const vehicles = [enemy1, enemy2];

    const result = findNearestAlly(vehicles, enemy1, OFFSET_X, OFFSET_Y);

    expect(result).toBeNull();
  });
});

// ─── aimTurretAtTarget ────────────────────────────────────────────────

describe('ARENA-05H+ aimTurretAtTarget', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('updates turretTargetAngle toward target', () => {
    const enemy = createEnemy(5, 5);
    const ally = createAlly(10, 5); // Same Y, further right

    const result = aimTurretAtTarget(enemy, ally, OFFSET_X, OFFSET_Y);

    expect(result).toBe(true);
    // Turret should aim to the right — angle should change from default
    expect(enemy.turretTargetAngle).not.toBe(enemy.bodyAngle);
  });
});

// ─── Passive mode ────────────────────────────────────────────────────

describe('ARENA-05H+ passive enemy', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('does not move or fire', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'passive');
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBeNull();
    expect(enemy.fireHeld).toBe(false);
    expect(enemy.isFiring).toBe(false);
    expect(enemy.hasMoveTarget).toBe(false);
  });

  it('stops firing if somehow was firing', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'passive');
    enemy.fireHeld = true;
    enemy.isFiring = true;
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.fireHeld).toBe(false);
    expect(enemy.isFiring).toBe(false);
  });
});

// ─── Stationary shooter mode ─────────────────────────────────────────

describe('ARENA-05H+ stationary_shooter', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('targets ally and starts firing without moving', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBe(ally.id);
    expect(enemy.fireHeld).toBe(true);
    expect(enemy.isFiring).toBe(true);
    expect(enemy.hasMoveTarget).toBe(false);
  });

  it('stops firing when no ally is in range', () => {
    const ally = createAlly(50, 50); // Very far
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBeNull();
    expect(enemy.fireHeld).toBe(false);
    expect(enemy.isFiring).toBe(false);
  });

  it('stops firing when ally is destroyed', () => {
    const ally = createAlly(5, 5);
    ally.isDestroyed = true;
    ally.hp = 0;
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    enemy.targetVehicleId = ally.id;
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBeNull();
    expect(enemy.fireHeld).toBe(false);
  });
});

// ─── Chaser mode ────────────────────────────────────────────────────

describe('ARENA-05H+ chaser', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('sets movement toward ally', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(15, 15, 'chaser'); // Far enough to be out of smoky range
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBe(ally.id);
    expect(enemy.hasMoveTarget).toBe(true);
    // Move target should be set to ally position
    expect(enemy.targetWorldX).toBe(ally.worldX);
    expect(enemy.targetWorldY).toBe(ally.worldY);
  });

  it('stops moving when in weapon range', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(5, 5, 'chaser'); // Same position = definitely in range
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBe(ally.id);
    // When in range, hasMoveTarget should be false
    expect(enemy.hasMoveTarget).toBe(false);
  });

  it('stops targeting when no ally exists', () => {
    const enemy = createEnemy(8, 8, 'chaser');
    const vehicles = [enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBeNull();
    expect(enemy.hasMoveTarget).toBe(false);
  });
});

// ─── Hold position mode ────────────────────────────────────────────

describe('ARENA-05H+ hold_position', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('engages ally within hold radius', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(6, 6, 'hold_position');
    enemy.aiHoldRadius = 500; // Large enough to include ally within weapon range
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBe(ally.id);
    expect(enemy.fireHeld).toBe(true);
  });

  it('does not engage ally outside hold radius', () => {
    const ally = createAlly(50, 50); // Far away
    const enemy = createEnemy(5, 5, 'hold_position');
    enemy.aiHoldRadius = 100; // Small radius
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBeNull();
    expect(enemy.fireHeld).toBe(false);
  });

  it('returns to hold position when too far away', () => {
    const ally = createAlly(50, 50); // Far away
    const enemy = createEnemy(5, 5, 'hold_position');
    // Move enemy far from its hold position
    enemy.worldX = ally.worldX; // At ally position
    enemy.worldY = ally.worldY;
    enemy.aiHoldX = 100; // Hold position is far
    enemy.aiHoldY = 100;
    enemy.aiHoldRadius = 100;
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    // Should stop targeting and start returning
    expect(enemy.targetVehicleId).toBeNull();
    expect(enemy.hasMoveTarget).toBe(true);
    expect(enemy.targetWorldX).toBe(enemy.aiHoldX);
    expect(enemy.targetWorldY).toBe(enemy.aiHoldY);
  });

  it('does not move when engaging within hold radius', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(6, 6, 'hold_position');
    enemy.aiHoldRadius = 500; // Large enough
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBe(ally.id);
    expect(enemy.hasMoveTarget).toBe(false);
  });
});

// ─── Allies do not run AI ────────────────────────────────────────────

describe('ARENA-05H+ allies do not run AI', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('ally with aiMode=chaser does not change state', () => {
    const ally = createAlly(5, 5);
    // Even if someone mistakenly sets aiMode on ally
    (ally as { aiMode: string }).aiMode = 'chaser';
    const enemy = createEnemy(8, 8);
    const vehicles = [ally, enemy];

    const originalTargetId = ally.targetVehicleId;
    updateBlockoutAi(vehicles, makeOptions());

    // Ally should not have been affected
    expect(ally.targetVehicleId).toBe(originalTargetId);
    expect(ally.fireHeld).toBe(false);
  });
});

// ─── Destroyed/missing target clears safely ──────────────────────────

describe('ARENA-05H+ destroyed/missing target clears safely', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('clears targetVehicleId when target is destroyed', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    enemy.targetVehicleId = ally.id;
    ally.isDestroyed = true;
    ally.hp = 0;
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBeNull();
  });

  it('clears targetVehicleId when target ID is invalid', () => {
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    enemy.targetVehicleId = 'nonexistent-id';
    const vehicles = [enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.targetVehicleId).toBeNull();
  });

  it('stops firing when target is destroyed', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    enemy.targetVehicleId = ally.id;
    enemy.fireHeld = true;
    enemy.isFiring = true;
    ally.isDestroyed = true;
    ally.hp = 0;
    const vehicles = [ally, enemy];

    updateBlockoutAi(vehicles, makeOptions());

    expect(enemy.fireHeld).toBe(false);
    expect(enemy.isFiring).toBe(false);
  });
});

// ─── AI mode default ────────────────────────────────────────────────

describe('ARENA-05H+ AI mode defaults', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('new enemy has passive AI mode by default', () => {
    const enemy = createEnemy(5, 5);
    expect(enemy.aiMode).toBe('passive');
  });

  it('new enemy has hold position set to spawn position', () => {
    const enemy = createEnemy(5, 5);
    expect(enemy.aiHoldX).toBe(enemy.worldX);
    expect(enemy.aiHoldY).toBe(enemy.worldY);
  });

  it('new enemy has default hold radius', () => {
    const enemy = createEnemy(5, 5);
    expect(enemy.aiHoldRadius).toBe(200);
  });
});

// ─── AI tick interval ────────────────────────────────────────────────

describe('ARENA-05H+ AI tick interval', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('does not make decisions on every frame', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    const vehicles = [ally, enemy];

    // First tick at 1000ms — should process
    updateBlockoutAi(vehicles, makeOptions(1000));
    expect(enemy.targetVehicleId).toBe(ally.id);

    // Reset target to test if next tick processes
    enemy.targetVehicleId = null;

    // Second tick at 1050ms — should NOT process (interval is 200ms)
    updateBlockoutAi(vehicles, makeOptions(1050));
    expect(enemy.targetVehicleId).toBeNull(); // Still null — decision not re-processed

    // Third tick at 1200ms — should process (interval elapsed)
    updateBlockoutAi(vehicles, makeOptions(1200));
    expect(enemy.targetVehicleId).toBe(ally.id); // Re-processed
  });

  it('always validates targets even between ticks', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    const vehicles = [ally, enemy];

    // First tick
    updateBlockoutAi(vehicles, makeOptions(1000));
    expect(enemy.targetVehicleId).toBe(ally.id);

    // Destroy ally between ticks
    ally.isDestroyed = true;
    ally.hp = 0;

    // Even without a full AI tick, target validation runs
    updateBlockoutAi(vehicles, makeOptions(1050));
    expect(enemy.targetVehicleId).toBeNull();
  });
});

// ─── ARENA-05H+ fixup: fireWeapon callback for single-shot weapons ──────

describe('ARENA-05H+ fixup: fireWeapon callback for single-shot AI weapons', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetVfxEventIdCounter();
    clearVfxEvents();
    resetAiTickTimer();
  });

  it('stationary_shooter with single-shot weapon calls fireWeapon callback', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter'); // smoky = single-shot
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(),
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    // Should have called fireWeapon once (smoky is single-shot, canFire is true)
    expect(fireCalls.length).toBe(1);
    expect(fireCalls[0]!.enemy.id).toBe(enemy.id);
    expect(fireCalls[0]!.target.id).toBe(ally.id);
    // fireHeld/isFiring should NOT be set when fireWeapon callback is used
    expect(enemy.fireHeld).toBe(false);
    expect(enemy.isFiring).toBe(false);
  });

  it('chaser in range with single-shot weapon calls fireWeapon callback', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(5, 5, 'chaser'); // Same position = in range
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(),
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    expect(fireCalls.length).toBe(1);
    expect(fireCalls[0]!.enemy.id).toBe(enemy.id);
    expect(fireCalls[0]!.target.id).toBe(ally.id);
  });

  it('hold_position in range with single-shot weapon calls fireWeapon callback', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(6, 6, 'hold_position');
    enemy.aiHoldRadius = 500;
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(),
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    expect(fireCalls.length).toBe(1);
    expect(fireCalls[0]!.enemy.id).toBe(enemy.id);
    expect(fireCalls[0]!.target.id).toBe(ally.id);
  });

  it('continuous weapon uses startFiring path even when fireWeapon is provided', () => {
    // Use a continuous weapon (flamethrower)
    const ally = createAlly(5, 5);
    const enemy = createBlockoutVehicle('wasp', 'flamethrower', 'green', 8, 8, Math.PI / 2, 120, 'enemy');
    enemy.aiMode = 'stationary_shooter';
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(),
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    // Continuous weapon should NOT call fireWeapon — it uses startFiring instead
    expect(fireCalls.length).toBe(0);
    // fireHeld/isFiring should be set for continuous weapons
    expect(enemy.fireHeld).toBe(true);
    expect(enemy.isFiring).toBe(true);
  });

  it('no fire callback when target is missing/destroyed', () => {
    const ally = createAlly(5, 5);
    ally.isDestroyed = true;
    ally.hp = 0;
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(),
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    // No target in range — fireWeapon should NOT be called
    expect(fireCalls.length).toBe(0);
  });

  it('no fire callback when target is out of range', () => {
    const ally = createAlly(50, 50); // Very far
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(),
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    expect(fireCalls.length).toBe(0);
  });

  it('no fire callback when weapon is on cooldown', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter');
    enemy.lastFiredAt = 999; // Just fired — smoky cooldown ~1200ms
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(1000), // nowMs=1000, only 1ms since lastFiredAt=999
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    // Weapon on cooldown — fireWeapon should NOT be called
    expect(fireCalls.length).toBe(0);
  });

  it('without fireWeapon callback, single-shot falls back to startFiring', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(8, 8, 'stationary_shooter'); // smoky = single-shot
    const vehicles = [ally, enemy];

    // No fireWeapon callback — backward compatible behavior
    updateBlockoutAi(vehicles, makeOptions());

    // Falls back to startFiring for single-shot weapons
    expect(enemy.fireHeld).toBe(true);
    expect(enemy.isFiring).toBe(true);
  });

  it('chaser out of range does not call fireWeapon', () => {
    const ally = createAlly(5, 5);
    const enemy = createEnemy(15, 15, 'chaser'); // Far away = out of range
    const vehicles = [ally, enemy];
    const fireCalls: Array<{ enemy: BlockoutVehicleState; target: BlockoutVehicleState; nowMs: number }> = [];

    updateBlockoutAi(vehicles, {
      ...makeOptions(),
      fireWeapon: (e, t, now) => { fireCalls.push({ enemy: e, target: t, nowMs: now }); },
    });

    // Out of range — fireWeapon should NOT be called, but movement should be set
    expect(fireCalls.length).toBe(0);
    expect(enemy.hasMoveTarget).toBe(true);
  });
});
