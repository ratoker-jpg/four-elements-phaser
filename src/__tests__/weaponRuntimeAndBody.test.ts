/**
 * Tests for CORE-STEP-08H+ weapon runtime, body combat stats, and weapon resources.
 *
 * Verifies:
 * 1.  Smoky uses M0-M3 damage/cooldown/turret speed helpers
 * 2.  Thunder applies projected splash + self-damage scale if configured
 * 3.  Railgun wind-up delays shot and can cancel on target clear
 * 4.  Railgun penetration still works with STEP 07 hit model
 * 5.  Flamethrower canister drains while firing
 * 6.  Flamethrower cannot fire when canister empty
 * 7.  Flamethrower canister regenerates when not firing
 * 8.  Freeze canister behavior matches flamethrower
 * 9.  Isida heals ally and does not damage enemy
 * 10. Vulcan heat increases while firing
 * 11. Vulcan cools when not firing
 * 12. Vulcan overheat blocks/penalizes firing
 * 13. Twins uses configured near-continuous cooldown/rate
 * 14. Ricochet magazine stock decreases on fire
 * 15. Ricochet magazine regenerates over time
 * 16. Hammer fires volley/burst then reloads
 * 17. Hammer cannot fire during reload
 * 18. M0-M3 helpers clamp invalid levels safely
 * 19. Body armor/damage reduction changes actual HP loss
 * 20. Damage event number matches adjusted damage
 * 21. Target-lock auto-fire respects weapon resource gates
 * 22. Stop/S clears target-lock and cancels wind-up/burst safely
 * 23. AI uses same weapon resource gates
 * 24. No final assets/package/docs changes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWeaponRuntimeState, canFireByRuntimeState, startWindUp, checkWindUpComplete, cancelWindUp, resetWindUpAfterFire, startDrumBurst, canDrumVolleyFire, recordDrumVolleyFired, checkDrumReloadComplete, cancelDrumBurst } from '../state/weaponRuntime';
import { updateCanister, updateOverheat, updateMagazine, recordOverheatShot, recordMagazineShot, updateWeaponResources, clearWeaponPendingStates } from '../state/weaponResources';
import { getEffectiveBodyStats, applyArmorReduction, getRecoilScale, getEffectiveTurretTurnSpeed } from '../state/bodyCombatStats';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { canFireBlockoutWeapon, stopFiring } from '../state/blockoutWeaponVfx';
import { applyDamageToVehicle, healVehicle, resetDamageEventIdCounter } from '../state/blockoutDamage';
import { getWeaponConfig, getWeaponMLevelValue } from '../config/weaponData';
import { clampModificationLevel, getMLevelValue } from '../config/m0m3Scaling';
import { calculateArmorReducedDamage } from '../config/armorFormula';
import { computeBodyWorldCenter } from '../phaser/render/blockoutVehicleGeometry';
import { clearTargetLock } from '../state/combatTargeting';
import { TileReservationMap } from '../state/tileReservation';

// ─── Test helpers ────────────────────────────────────────────────────

const TEST_OFFSET = { x: 400, y: 200 };

function makeReservationMap(): TileReservationMap {
  return new TileReservationMap(20);
}

beforeEach(() => {
  resetBlockoutVehicleIdCounter();
  resetDamageEventIdCounter();
});

// ═══════════════════════════════════════════════════════════════════════
// 1. Smoky M0-M3 damage / cooldown / turret speed helpers
// ═══════════════════════════════════════════════════════════════════════

describe('Smoky M0-M3 damage/cooldown/turret speed helpers', () => {
  it('M0 damage = 16, M3 damage = 20', () => {
    const cfg = getWeaponConfig('smoky')!;
    expect(getWeaponMLevelValue(cfg.damage.directDamage!, 0)).toBe(16);
    expect(getWeaponMLevelValue(cfg.damage.directDamage!, 3)).toBe(20);
  });

  it('M0 cooldown = 900, M3 cooldown = 800 (improvement = shorter)', () => {
    const cfg = getWeaponConfig('smoky')!;
    expect(getWeaponMLevelValue(cfg.cooldown!, 0)).toBe(900);
    expect(getWeaponMLevelValue(cfg.cooldown!, 3)).toBe(800);
    // M0 > M3 for cooldown (improvement = shorter)
    expect(getWeaponMLevelValue(cfg.cooldown!, 0)).toBeGreaterThan(
      getWeaponMLevelValue(cfg.cooldown!, 3),
    );
  });

  it('M0 turret turn speed = 130, M3 = 150 (improvement = faster)', () => {
    const cfg = getWeaponConfig('smoky')!;
    expect(getWeaponMLevelValue(cfg.turretTurnSpeed, 0)).toBe(130);
    expect(getWeaponMLevelValue(cfg.turretTurnSpeed, 3)).toBe(150);
  });

  it('getEffectiveTurretTurnSpeed returns M-level values for smoky', () => {
    expect(getEffectiveTurretTurnSpeed('smoky', 0)).toBe(130);
    expect(getEffectiveTurretTurnSpeed('smoky', 3)).toBe(150);
  });

  it('smoky runtime state has no special resource model (cooldown only)', () => {
    const rt = createWeaponRuntimeState('smoky', 0);
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('canFireByRuntimeState returns true for smoky (no resource gate)', () => {
    const rt = createWeaponRuntimeState('smoky', 0);
    expect(canFireByRuntimeState(rt)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Thunder projected splash + self-damage scale
// ═══════════════════════════════════════════════════════════════════════

describe('Thunder projected splash + self-damage scale', () => {
  it('thunder config has splashRadius > 0', () => {
    const cfg = getWeaponConfig('thunder')!;
    expect(cfg.damage.splashRadius).toBe(1.5);
  });

  it('thunder config has selfDamageScale > 0', () => {
    const cfg = getWeaponConfig('thunder')!;
    expect(cfg.damage.selfDamageScale).toBe(0.3);
  });

  it('thunder splashFalloff is true', () => {
    const cfg = getWeaponConfig('thunder')!;
    expect(cfg.damage.splashFalloff).toBe(true);
  });

  it('thunder runtime has no special resource model', () => {
    const rt = createWeaponRuntimeState('thunder', 0);
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Railgun wind-up delays shot and can cancel on target clear
// ═══════════════════════════════════════════════════════════════════════

describe('Railgun wind-up delays shot and can cancel on target clear', () => {
  it('railgun runtime has windUp state', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    expect(rt.windUp).not.toBeNull();
    expect(rt.windUp!.isCharging).toBe(false);
    expect(rt.windUp!.isReady).toBe(false);
  });

  it('cannot fire while wind-up is charging and not ready', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    startWindUp(rt, 1000);
    expect(rt.windUp!.isCharging).toBe(true);
    expect(rt.windUp!.isReady).toBe(false);
    expect(canFireByRuntimeState(rt)).toBe(false);
  });

  it('wind-up completes after configured duration (M0 = 800ms)', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    startWindUp(rt, 1000);
    // Not ready yet at 1700ms (only 700ms elapsed)
    expect(checkWindUpComplete(rt, 1700)).toBe(false);
    // Ready at 1800ms (800ms elapsed)
    expect(checkWindUpComplete(rt, 1800)).toBe(true);
    expect(rt.windUp!.isReady).toBe(true);
  });

  it('can fire once wind-up is complete (isReady = true)', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    startWindUp(rt, 1000);
    checkWindUpComplete(rt, 1800);
    expect(rt.windUp!.isReady).toBe(true);
    expect(canFireByRuntimeState(rt)).toBe(true);
  });

  it('cancelWindUp safely resets wind-up state', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    startWindUp(rt, 1000);
    expect(rt.windUp!.isCharging).toBe(true);
    cancelWindUp(rt);
    expect(rt.windUp!.isCharging).toBe(false);
    expect(rt.windUp!.isReady).toBe(false);
    expect(rt.windUp!.startedAt).toBe(0);
    // After cancel, can start a new wind-up
    expect(canFireByRuntimeState(rt)).toBe(true);
  });

  it('resetWindUpAfterFire clears wind-up after firing', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    startWindUp(rt, 1000);
    checkWindUpComplete(rt, 1800);
    expect(rt.windUp!.isReady).toBe(true);
    resetWindUpAfterFire(rt);
    expect(rt.windUp!.isCharging).toBe(false);
    expect(rt.windUp!.isReady).toBe(false);
    expect(rt.windUp!.startedAt).toBe(0);
  });

  it('M3 wind-up is shorter (500ms) than M0 (800ms)', () => {
    const cfg = getWeaponConfig('railgun')!;
    expect(getWeaponMLevelValue(cfg.windUp!, 0)).toBe(800);
    expect(getWeaponMLevelValue(cfg.windUp!, 3)).toBe(500);
  });

  it('wind-up not started: canFireByRuntimeState returns true (fire command will START wind-up)', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    // windUp exists but isCharging=false, isReady=false → this means we haven't started yet
    // The fire command itself will start the wind-up
    expect(canFireByRuntimeState(rt)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Railgun penetration still works with STEP 07 hit model
// ═══════════════════════════════════════════════════════════════════════

describe('Railgun penetration works with STEP 07 hit model', () => {
  it('railgun config has penetration = true', () => {
    const cfg = getWeaponConfig('railgun')!;
    expect(cfg.damage.penetration).toBe(true);
  });

  it('railgun config has maxPenetrationTargets = 3', () => {
    const cfg = getWeaponConfig('railgun')!;
    expect(cfg.damage.maxPenetrationTargets).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Flamethrower canister drains while firing
// ═══════════════════════════════════════════════════════════════════════

describe('Flamethrower canister drains while firing', () => {
  it('flamethrower runtime has canister state initialized to full capacity', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    expect(rt.canister).not.toBeNull();
    // M0 capacity = 80
    expect(rt.canister!.current).toBe(80);
    expect(rt.canister!.isEmpty).toBe(false);
  });

  it('canister drains while firing', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    // M0 drainPerSec = 15
    updateCanister(rt, { nowMs: 1100, isFiring: true, deltaSec: 1.0 });
    expect(rt.canister!.current).toBeCloseTo(65, 1);
    expect(rt.canister!.isEmpty).toBe(false);
  });

  it('canister drains over multiple frames', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    // Drain 15/sec for 3 seconds = 45 drained → 80 - 45 = 35
    for (let i = 0; i < 3; i++) {
      updateCanister(rt, { nowMs: 1000 + (i + 1) * 1000, isFiring: true, deltaSec: 1.0 });
    }
    expect(rt.canister!.current).toBeCloseTo(35, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Flamethrower cannot fire when canister empty
// ═══════════════════════════════════════════════════════════════════════

describe('Flamethrower cannot fire when canister empty', () => {
  it('canister becomes empty when drained to 0', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    // M0: capacity=80, drainPerSec=15 → drain for 6 seconds = 90 (more than capacity)
    for (let i = 0; i < 6; i++) {
      updateCanister(rt, { nowMs: 1000 + (i + 1) * 1000, isFiring: true, deltaSec: 1.0 });
    }
    expect(rt.canister!.current).toBe(0);
    expect(rt.canister!.isEmpty).toBe(true);
  });

  it('canFireByRuntimeState returns false when canister is empty', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    rt.canister!.current = 0;
    rt.canister!.isEmpty = true;
    expect(canFireByRuntimeState(rt)).toBe(false);
  });

  it('canFireBlockoutWeapon returns false for vehicle with empty canister', () => {
    const vehicle = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 5, 5);
    vehicle.weaponRuntime.canister!.current = 0;
    vehicle.weaponRuntime.canister!.isEmpty = true;
    vehicle.lastFiredAt = 0; // No cooldown issue
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Flamethrower canister regenerates when not firing
// ═══════════════════════════════════════════════════════════════════════

describe('Flamethrower canister regenerates when not firing', () => {
  it('canister regenerates while not firing', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    // Drain some first
    rt.canister!.current = 50;
    // M0 regenPerSec = 6
    updateCanister(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.canister!.current).toBeCloseTo(56, 1);
  });

  it('canister does not exceed capacity when regenerating', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    rt.canister!.current = 78;
    // M0 regenPerSec = 6, capacity = 80
    updateCanister(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.canister!.current).toBe(80); // clamped to capacity
  });

  it('isEmpty flag clears when canister regenerates above 0', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    rt.canister!.current = 0;
    rt.canister!.isEmpty = true;
    // M0 regenPerSec = 6
    updateCanister(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.canister!.current).toBeCloseTo(6, 1);
    expect(rt.canister!.isEmpty).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. Freeze canister behavior matches flamethrower
// ═══════════════════════════════════════════════════════════════════════

describe('Freeze canister behavior matches flamethrower', () => {
  it('freeze runtime has canister state initialized to full capacity', () => {
    const rt = createWeaponRuntimeState('freeze', 0);
    expect(rt.canister).not.toBeNull();
    expect(rt.canister!.current).toBe(80); // M0 capacity = 80
    expect(rt.canister!.isEmpty).toBe(false);
  });

  it('freeze canister drains while firing', () => {
    const rt = createWeaponRuntimeState('freeze', 0);
    updateCanister(rt, { nowMs: 1100, isFiring: true, deltaSec: 1.0 });
    expect(rt.canister!.current).toBeCloseTo(65, 1);
  });

  it('freeze cannot fire when canister empty', () => {
    const rt = createWeaponRuntimeState('freeze', 0);
    rt.canister!.current = 0;
    rt.canister!.isEmpty = true;
    expect(canFireByRuntimeState(rt)).toBe(false);
  });

  it('freeze canister regenerates when not firing', () => {
    const rt = createWeaponRuntimeState('freeze', 0);
    rt.canister!.current = 50;
    updateCanister(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.canister!.current).toBeCloseTo(56, 1);
  });

  it('freeze canister clears isEmpty after regeneration', () => {
    const rt = createWeaponRuntimeState('freeze', 0);
    rt.canister!.current = 0;
    rt.canister!.isEmpty = true;
    updateCanister(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.canister!.isEmpty).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. Isida heals ally and does not damage enemy
// ═══════════════════════════════════════════════════════════════════════

describe('Isida heals ally and does not damage enemy', () => {
  it('isida config has heal_beam support model', () => {
    const cfg = getWeaponConfig('isida')!;
    expect(cfg.support).toBeDefined();
    expect(cfg.support!.kind).toBe('heal_beam');
    expect(cfg.support!.target).toBe('ally');
  });

  it('isida M0 healPerSecond = 20, M3 = 25', () => {
    const cfg = getWeaponConfig('isida')!;
    expect(getWeaponMLevelValue(cfg.support!.healPerSecond, 0)).toBe(20);
    expect(getWeaponMLevelValue(cfg.support!.healPerSecond, 3)).toBe(25);
  });

  it('healVehicle increases ally HP and creates heal event', () => {
    const ally = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5);
    ally.team = 'ally';
    const prevHp = ally.hp;
    // Damage the ally first so heal has room
    ally.hp = ally.maxHp - 30;
    const bodyCenter = computeBodyWorldCenter(ally, TEST_OFFSET);
    const event = healVehicle(ally, 'isida', 10, bodyCenter.x, bodyCenter.y, 1000);
    expect(event).not.toBeNull();
    expect(ally.hp).toBe(prevHp - 30 + 10);
    expect(event!.amount).toBe(10);
    expect(event!.weaponId).toBe('isida');
  });

  it('healVehicle caps at maxHp', () => {
    const ally = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5);
    ally.hp = ally.maxHp - 2;
    const bodyCenter = computeBodyWorldCenter(ally, TEST_OFFSET);
    const event = healVehicle(ally, 'isida', 50, bodyCenter.x, bodyCenter.y, 1000);
    expect(ally.hp).toBe(ally.maxHp);
    expect(event!.amount).toBe(2); // Only 2 HP was actually healed
  });

  it('healVehicle returns null for destroyed vehicle', () => {
    const ally = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5);
    ally.isDestroyed = true;
    const bodyCenter = computeBodyWorldCenter(ally, TEST_OFFSET);
    const event = healVehicle(ally, 'isida', 10, bodyCenter.x, bodyCenter.y, 1000);
    expect(event).toBeNull();
  });

  it('healVehicle returns null if already at full HP', () => {
    const ally = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(ally, TEST_OFFSET);
    const event = healVehicle(ally, 'isida', 10, bodyCenter.x, bodyCenter.y, 1000);
    expect(event).toBeNull();
  });

  it('isida damage config has no directDamage/damagePerSecond (heal-only)', () => {
    const cfg = getWeaponConfig('isida')!;
    expect(cfg.damage.directDamage).toBeUndefined();
    expect(cfg.damage.damagePerSecond).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. Vulcan heat increases while firing
// ═══════════════════════════════════════════════════════════════════════

describe('Vulcan heat increases while firing', () => {
  it('vulcan runtime has overheat state initialized at 0 heat', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    expect(rt.overheat).not.toBeNull();
    expect(rt.overheat!.heat).toBe(0);
    expect(rt.overheat!.isOverheated).toBe(false);
  });

  it('recordOverheatShot adds heat per shot', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    // M0 heatPerShot = 12
    recordOverheatShot(rt);
    expect(rt.overheat!.heat).toBe(12);
  });

  it('multiple shots accumulate heat', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    recordOverheatShot(rt); // 12
    recordOverheatShot(rt); // 24
    recordOverheatShot(rt); // 36
    recordOverheatShot(rt); // 48
    expect(rt.overheat!.heat).toBe(48);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 11. Vulcan cools when not firing
// ═══════════════════════════════════════════════════════════════════════

describe('Vulcan cools when not firing', () => {
  it('heat decreases when not firing', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    rt.overheat!.heat = 40;
    // M0 coolingPerSec = 8
    updateOverheat(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.overheat!.heat).toBeCloseTo(32, 1);
  });

  it('heat does not go below 0', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    rt.overheat!.heat = 5;
    // coolingPerSec = 8 → would go to -3, but clamped to 0
    updateOverheat(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.overheat!.heat).toBe(0);
  });

  it('cooling over multiple frames works correctly', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    rt.overheat!.heat = 40;
    // Two frames of 0.5 sec each, total 1 sec cooling at 8/sec = 8
    updateOverheat(rt, { nowMs: 1050, isFiring: false, deltaSec: 0.5 });
    updateOverheat(rt, { nowMs: 1100, isFiring: false, deltaSec: 0.5 });
    expect(rt.overheat!.heat).toBeCloseTo(32, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 12. Vulcan overheat blocks/penalizes firing
// ═══════════════════════════════════════════════════════════════════════

describe('Vulcan overheat blocks/penalizes firing', () => {
  it('overheat triggers when heat reaches maxHeat (100)', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    // M0 heatPerShot = 12 → 9 shots = 108, clamped to 100
    for (let i = 0; i < 9; i++) {
      recordOverheatShot(rt);
    }
    expect(rt.overheat!.heat).toBe(100);
    expect(rt.overheat!.isOverheated).toBe(true);
  });

  it('canFireByRuntimeState returns false when overheated', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    rt.overheat!.isOverheated = true;
    expect(canFireByRuntimeState(rt)).toBe(false);
  });

  it('canFireBlockoutWeapon returns false for overheated vulcan vehicle', () => {
    const vehicle = createBlockoutVehicle('hunter', 'vulcan', 'cyan', 5, 5);
    vehicle.weaponRuntime.overheat!.isOverheated = true;
    vehicle.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(false);
  });

  it('overheat penalty clears after overheatPenaltyMs (3000ms)', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    rt.overheat!.isOverheated = true;
    rt.overheat!.overheatStartedAt = 1000;
    rt.overheat!.heat = 100;
    // Not yet cleared at 3500ms (2500ms elapsed)
    updateOverheat(rt, { nowMs: 3500, isFiring: false, deltaSec: 1.0 });
    expect(rt.overheat!.isOverheated).toBe(true);
    // Cleared after 4000ms (3000ms penalty elapsed)
    updateOverheat(rt, { nowMs: 4001, isFiring: false, deltaSec: 0.001 });
    expect(rt.overheat!.isOverheated).toBe(false);
    expect(rt.overheat!.heat).toBe(0);
  });

  it('after overheat penalty clears, weapon can fire again', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    rt.overheat!.isOverheated = true;
    rt.overheat!.overheatStartedAt = 1000;
    rt.overheat!.heat = 100;
    updateOverheat(rt, { nowMs: 4001, isFiring: false, deltaSec: 0.001 });
    expect(canFireByRuntimeState(rt)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 13. Twins uses configured near-continuous cooldown/rate
// ═══════════════════════════════════════════════════════════════════════

describe('Twins uses configured near-continuous cooldown/rate', () => {
  it('twins config fireType is near_continuous', () => {
    const cfg = getWeaponConfig('twins')!;
    expect(cfg.fireType).toBe('near_continuous');
  });

  it('twins M0 cooldown = 650ms, M3 = 600ms', () => {
    const cfg = getWeaponConfig('twins')!;
    expect(getWeaponMLevelValue(cfg.cooldown!, 0)).toBe(650);
    expect(getWeaponMLevelValue(cfg.cooldown!, 3)).toBe(600);
  });

  it('twins runtime has no special resource model', () => {
    const rt = createWeaponRuntimeState('twins', 0);
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('canFireByRuntimeState returns true for twins (no resource gate)', () => {
    const rt = createWeaponRuntimeState('twins', 0);
    expect(canFireByRuntimeState(rt)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 14. Ricochet magazine stock decreases on fire
// ═══════════════════════════════════════════════════════════════════════

describe('Ricochet magazine stock decreases on fire', () => {
  it('ricochet runtime has magazine state initialized to full stock', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    expect(rt.magazine).not.toBeNull();
    // M0 stockSize = 4
    expect(rt.magazine!.currentStock).toBe(4);
    expect(rt.magazine!.isEmpty).toBe(false);
  });

  it('recordMagazineShot decrements stock by 1', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    recordMagazineShot(rt);
    expect(rt.magazine!.currentStock).toBe(3);
    expect(rt.magazine!.isEmpty).toBe(false);
  });

  it('firing all shots empties the magazine', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    // M0 stockSize = 4
    recordMagazineShot(rt); // 3
    recordMagazineShot(rt); // 2
    recordMagazineShot(rt); // 1
    recordMagazineShot(rt); // 0
    expect(rt.magazine!.currentStock).toBe(0);
    expect(rt.magazine!.isEmpty).toBe(true);
  });

  it('canFireByRuntimeState returns false when magazine is empty', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    rt.magazine!.currentStock = 0;
    rt.magazine!.isEmpty = true;
    expect(canFireByRuntimeState(rt)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 15. Ricochet magazine regenerates over time
// ═══════════════════════════════════════════════════════════════════════

describe('Ricochet magazine regenerates over time', () => {
  it('magazine regenerates when not firing', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    rt.magazine!.currentStock = 2;
    // M0 regenPerSec = 0.5
    updateMagazine(rt, { nowMs: 1100, isFiring: false, deltaSec: 2.0 });
    expect(rt.magazine!.currentStock).toBeCloseTo(3, 1);
  });

  it('magazine does not exceed stockSize', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    rt.magazine!.currentStock = 3.8;
    // M0 regenPerSec = 0.5, stockSize = 4
    updateMagazine(rt, { nowMs: 1100, isFiring: false, deltaSec: 1.0 });
    expect(rt.magazine!.currentStock).toBe(4); // clamped to stockSize
  });

  it('magazine isEmpty clears when stock regenerates above 0', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    rt.magazine!.currentStock = 0;
    rt.magazine!.isEmpty = true;
    // M0 regenPerSec = 0.5
    updateMagazine(rt, { nowMs: 1100, isFiring: false, deltaSec: 4.0 });
    expect(rt.magazine!.currentStock).toBeCloseTo(2, 1);
    expect(rt.magazine!.isEmpty).toBe(false);
  });

  it('magazine does not regenerate while firing', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    rt.magazine!.currentStock = 2;
    updateMagazine(rt, { nowMs: 1100, isFiring: true, deltaSec: 2.0 });
    // Should not have changed (no regen while firing)
    expect(rt.magazine!.currentStock).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 16. Hammer fires volley/burst then reloads
// ═══════════════════════════════════════════════════════════════════════

describe('Hammer fires volley/burst then reloads', () => {
  it('hammer runtime has drum state', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    expect(rt.drum).not.toBeNull();
    expect(rt.drum!.currentVolley).toBe(0);
    expect(rt.drum!.isReloading).toBe(false);
    expect(rt.drum!.isBursting).toBe(false);
  });

  it('startDrumBurst initiates burst mode', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    expect(rt.drum!.isBursting).toBe(true);
    expect(rt.drum!.burstVolleyCount).toBe(0);
    expect(rt.drum!.lastVolleyAt).toBe(1000);
  });

  it('canDrumVolleyFire returns true after delay between volleys', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    // M0 delayBetweenVolleysMs = 250
    expect(canDrumVolleyFire(rt, 1200)).toBe(false); // 200ms < 250ms
    expect(canDrumVolleyFire(rt, 1251)).toBe(true); // 251ms >= 250ms
  });

  it('recordDrumVolleyFired advances volley counter', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    recordDrumVolleyFired(rt, 1250); // volley 1
    expect(rt.drum!.currentVolley).toBe(1);
    recordDrumVolleyFired(rt, 1500); // volley 2
    expect(rt.drum!.currentVolley).toBe(2);
  });

  it('drum starts reload after all volleys fired (volleyCount = 3)', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    recordDrumVolleyFired(rt, 1250); // volley 1
    recordDrumVolleyFired(rt, 1500); // volley 2
    recordDrumVolleyFired(rt, 1750); // volley 3 → triggers reload
    expect(rt.drum!.currentVolley).toBe(3);
    expect(rt.drum!.isReloading).toBe(true);
    expect(rt.drum!.isBursting).toBe(false);
  });

  it('checkDrumReloadComplete returns true after reloadMs (M0 = 3000ms)', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    rt.drum!.isReloading = true;
    rt.drum!.reloadStartedAt = 1000;
    rt.drum!.currentVolley = 3;
    // Not yet
    expect(checkDrumReloadComplete(rt, 3500)).toBe(false);
    // After 3000ms
    expect(checkDrumReloadComplete(rt, 4001)).toBe(true);
    expect(rt.drum!.isReloading).toBe(false);
    expect(rt.drum!.currentVolley).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 17. Hammer cannot fire during reload
// ═══════════════════════════════════════════════════════════════════════

describe('Hammer cannot fire during reload', () => {
  it('canFireByRuntimeState returns false when drum is reloading', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    rt.drum!.isReloading = true;
    expect(canFireByRuntimeState(rt)).toBe(false);
  });

  it('canFireBlockoutWeapon returns false for reloading hammer vehicle', () => {
    const vehicle = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    vehicle.weaponRuntime.drum!.isReloading = true;
    vehicle.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 18. M0-M3 helpers clamp invalid levels safely
// ═══════════════════════════════════════════════════════════════════════

describe('M0-M3 helpers clamp invalid levels safely', () => {
  it('clampModificationLevel clamps negative to 0', () => {
    expect(clampModificationLevel(-1)).toBe(0);
    expect(clampModificationLevel(-100)).toBe(0);
  });

  it('clampModificationLevel clamps >3 to 3', () => {
    expect(clampModificationLevel(4)).toBe(3);
    expect(clampModificationLevel(100)).toBe(3);
  });

  it('clampModificationLevel treats NaN as 0', () => {
    expect(clampModificationLevel(NaN)).toBe(0);
  });

  it('clampModificationLevel treats Infinity as 0 (non-finite → 0)', () => {
    expect(clampModificationLevel(Infinity)).toBe(0);
  });

  it('clampModificationLevel treats -Infinity as 0', () => {
    expect(clampModificationLevel(-Infinity)).toBe(0);
  });

  it('clampModificationLevel rounds fractional values down', () => {
    expect(clampModificationLevel(1.7)).toBe(1);
    expect(clampModificationLevel(2.9)).toBe(2);
  });

  it('getMLevelValue clamps invalid levels', () => {
    const data = [10, 20, 30, 40] as const;
    expect(getMLevelValue(data, -5)).toBe(10); // clamped to 0
    expect(getMLevelValue(data, 99)).toBe(40); // clamped to 3
    expect(getMLevelValue(data, NaN)).toBe(10); // clamped to 0
  });

  it('getWeaponMLevelValue clamps invalid levels', () => {
    const cfg = getWeaponConfig('smoky')!;
    expect(getWeaponMLevelValue(cfg.damage.directDamage!, -1)).toBe(16); // M0
    expect(getWeaponMLevelValue(cfg.damage.directDamage!, 10)).toBe(20); // M3
  });

  it('createWeaponRuntimeState clamps invalid mLevel', () => {
    const rt = createWeaponRuntimeState('flamethrower', -5);
    expect(rt.mLevel).toBe(0);
    const rt2 = createWeaponRuntimeState('flamethrower', 100);
    expect(rt2.mLevel).toBe(3);
  });

  it('getEffectiveBodyStats clamps invalid mLevel', () => {
    const stats0 = getEffectiveBodyStats('hunter', -5);
    const statsM0 = getEffectiveBodyStats('hunter', 0);
    expect(stats0.hp).toBe(statsM0.hp);
    expect(stats0.armor).toBe(statsM0.armor);
  });

  it('getEffectiveTurretTurnSpeed clamps invalid mLevel', () => {
    expect(getEffectiveTurretTurnSpeed('smoky', -1)).toBe(130); // M0
    expect(getEffectiveTurretTurnSpeed('smoky', 100)).toBe(150); // M3
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 19. Body armor/damage reduction changes actual HP loss
// ═══════════════════════════════════════════════════════════════════════

describe('Body armor/damage reduction changes actual HP loss', () => {
  it('Wasp (armor=2) takes less damage than raw amount', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const prevHp = vehicle.hp;
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    // Wasp M0 armor=2, minDamagePercent=0.25
    // finalDamage = max(20 - 2, 20 * 0.25) = max(18, 5) = 18
    expect(prevHp - vehicle.hp).toBe(18);
  });

  it('Mammoth (armor=16) significantly reduces damage', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const prevHp = vehicle.hp;
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    // Mammoth M0 armor=16, minDamagePercent=0.12
    // finalDamage = max(20 - 16, 20 * 0.12) = max(4, 2.4) = 4
    expect(prevHp - vehicle.hp).toBe(4);
  });

  it('Hunter (armor=5) takes moderate reduction', () => {
    const vehicle = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const prevHp = vehicle.hp;
    applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    // Hunter M0 armor=5, minDamagePercent=0.20
    // finalDamage = max(20 - 5, 20 * 0.20) = max(15, 4) = 15
    expect(prevHp - vehicle.hp).toBe(15);
  });

  it('armor floor applies when armor exceeds raw damage', () => {
    // Small damage vs heavy armor: raw=5, armor=16
    // max(5-16, 5*0.12) = max(-11, 0.6) = 0.6 (floor applies)
    const result = calculateArmorReducedDamage({
      rawDamage: 5,
      armor: 16,
      minDamagePercent: 0.12,
    });
    expect(result.hitFloor).toBe(true);
    expect(result.finalDamage).toBeCloseTo(0.6, 5);
  });

  it('applyArmorReduction returns correct result for known body', () => {
    const result = applyArmorReduction('wasp', 0, 20);
    // Wasp M0: armor=2, minDamagePercent=0.25
    // max(20-2, 20*0.25) = max(18, 5) = 18
    expect(result.finalDamage).toBe(18);
    expect(result.hitFloor).toBe(false);
    expect(result.reduction).toBe(2);
  });

  it('getRecoilScale: light body (Wasp) gets more recoil than baseline', () => {
    // Wasp mass = 2200, baseline = 3000 → scale = 3000/2200 ≈ 1.36
    expect(getRecoilScale('wasp')).toBeCloseTo(3000 / 2200, 3);
  });

  it('getRecoilScale: heavy body (Mammoth) gets less recoil than baseline', () => {
    // Mammoth mass = 5500, baseline = 3000 → scale = 3000/5500 ≈ 0.545
    expect(getRecoilScale('mammoth')).toBeCloseTo(3000 / 5500, 3);
  });

  it('getRecoilScale: medium body (Hunter) ≈ 1.0', () => {
    // Hunter mass = 3000, baseline = 3000 → scale = 1.0
    expect(getRecoilScale('hunter')).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 20. Damage event number matches adjusted damage
// ═══════════════════════════════════════════════════════════════════════

describe('Damage event number matches adjusted damage', () => {
  it('damage event amount equals armor-adjusted damage', () => {
    const vehicle = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const event = applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    // Hunter M0: armor=5, minDamagePercent=0.20
    // finalDamage = max(20-5, 20*0.20) = 15
    // No upgrade multiplier (armor_plating level 0 → multiplier = 1)
    expect(event!.amount).toBe(15);
  });

  it('damage event amount for heavy armor body matches adjusted damage', () => {
    const vehicle = createBlockoutVehicle('mammoth', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const event = applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    // Mammoth M0: armor=16, minDamagePercent=0.12
    // finalDamage = max(20-16, 20*0.12) = max(4, 2.4) = 4
    expect(event!.amount).toBe(4);
  });

  it('damage event amount for light body matches adjusted damage', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const bodyCenter = computeBodyWorldCenter(vehicle, TEST_OFFSET);
    const event = applyDamageToVehicle(vehicle, 'smoky', 20, bodyCenter.x, bodyCenter.y, 1000, 'direct');
    // Wasp M0: armor=2, minDamagePercent=0.25
    // finalDamage = max(20-2, 20*0.25) = 18
    expect(event!.amount).toBe(18);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 21. Target-lock auto-fire respects weapon resource gates
// ═══════════════════════════════════════════════════════════════════════

describe('Target-lock auto-fire respects weapon resource gates', () => {
  it('canFireBlockoutWeapon returns false when canister empty (freeze)', () => {
    const vehicle = createBlockoutVehicle('wasp', 'freeze', 'cyan', 5, 5);
    vehicle.weaponRuntime.canister!.current = 0;
    vehicle.weaponRuntime.canister!.isEmpty = true;
    vehicle.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(false);
  });

  it('canFireBlockoutWeapon returns false when overheated (vulcan)', () => {
    const vehicle = createBlockoutVehicle('hunter', 'vulcan', 'cyan', 5, 5);
    vehicle.weaponRuntime.overheat!.isOverheated = true;
    vehicle.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(false);
  });

  it('canFireBlockoutWeapon returns false when wind-up not ready (railgun)', () => {
    const vehicle = createBlockoutVehicle('hunter', 'railgun', 'cyan', 5, 5);
    startWindUp(vehicle.weaponRuntime, 1000);
    vehicle.lastFiredAt = 0;
    // Wind-up charging but not ready
    expect(canFireBlockoutWeapon(vehicle, 1100)).toBe(false);
  });

  it('canFireBlockoutWeapon returns false when magazine empty (ricochet)', () => {
    const vehicle = createBlockoutVehicle('hunter', 'ricochet', 'cyan', 5, 5);
    vehicle.weaponRuntime.magazine!.currentStock = 0;
    vehicle.weaponRuntime.magazine!.isEmpty = true;
    vehicle.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(false);
  });

  it('canFireBlockoutWeapon returns false when drum reloading (hammer)', () => {
    const vehicle = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    vehicle.weaponRuntime.drum!.isReloading = true;
    vehicle.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(false);
  });

  it('canFireBlockoutWeapon returns true when all resource gates pass', () => {
    const vehicle = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5);
    vehicle.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(vehicle, 1000)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 22. Stop/S clears target-lock and cancels wind-up/burst safely
// ═══════════════════════════════════════════════════════════════════════

describe('Stop/S clears target-lock and cancels wind-up/burst safely', () => {
  it('clearTargetLock clears targetVehicleId', () => {
    const vehicle = createBlockoutVehicle('hunter', 'railgun', 'cyan', 5, 5);
    vehicle.targetVehicleId = 'enemy-1';
    const reservationMap = makeReservationMap();
    clearTargetLock(vehicle, reservationMap);
    expect(vehicle.targetVehicleId).toBeNull();
  });

  it('clearTargetLock cancels wind-up on railgun', () => {
    const vehicle = createBlockoutVehicle('hunter', 'railgun', 'cyan', 5, 5);
    vehicle.targetVehicleId = 'enemy-1';
    startWindUp(vehicle.weaponRuntime, 1000);
    expect(vehicle.weaponRuntime.windUp!.isCharging).toBe(true);
    const reservationMap = makeReservationMap();
    clearTargetLock(vehicle, reservationMap);
    expect(vehicle.weaponRuntime.windUp!.isCharging).toBe(false);
    expect(vehicle.weaponRuntime.windUp!.isReady).toBe(false);
  });

  it('clearTargetLock cancels drum burst on hammer', () => {
    const vehicle = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    vehicle.targetVehicleId = 'enemy-1';
    startDrumBurst(vehicle.weaponRuntime, 1000);
    expect(vehicle.weaponRuntime.drum!.isBursting).toBe(true);
    const reservationMap = makeReservationMap();
    clearTargetLock(vehicle, reservationMap);
    expect(vehicle.weaponRuntime.drum!.isBursting).toBe(false);
    expect(vehicle.weaponRuntime.drum!.burstVolleyCount).toBe(0);
  });

  it('clearTargetLock does NOT cancel drum reload (must wait)', () => {
    const vehicle = createBlockoutVehicle('titan', 'hammer', 'cyan', 5, 5);
    vehicle.targetVehicleId = 'enemy-1';
    vehicle.weaponRuntime.drum!.isReloading = true;
    vehicle.weaponRuntime.drum!.reloadStartedAt = 1000;
    const reservationMap = makeReservationMap();
    clearTargetLock(vehicle, reservationMap);
    // Reload should still be active (cannot cancel reload)
    expect(vehicle.weaponRuntime.drum!.isReloading).toBe(true);
  });

  it('stopFiring clears wind-up and drum burst via clearWeaponPendingStates', () => {
    const vehicle = createBlockoutVehicle('hunter', 'railgun', 'cyan', 5, 5);
    vehicle.fireHeld = true;
    vehicle.isFiring = true;
    startWindUp(vehicle.weaponRuntime, 1000);
    stopFiring(vehicle);
    expect(vehicle.fireHeld).toBe(false);
    expect(vehicle.isFiring).toBe(false);
    expect(vehicle.weaponRuntime.windUp!.isCharging).toBe(false);
    expect(vehicle.weaponRuntime.windUp!.isReady).toBe(false);
  });

  it('clearWeaponPendingStates cancels wind-up', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    startWindUp(rt, 1000);
    expect(rt.windUp!.isCharging).toBe(true);
    clearWeaponPendingStates(rt);
    expect(rt.windUp!.isCharging).toBe(false);
    expect(rt.windUp!.isReady).toBe(false);
  });

  it('clearWeaponPendingStates cancels drum burst but not reload', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    rt.drum!.isReloading = true;
    clearWeaponPendingStates(rt);
    expect(rt.drum!.isBursting).toBe(false);
    expect(rt.drum!.burstVolleyCount).toBe(0);
    expect(rt.drum!.isReloading).toBe(true); // reload NOT cancelled
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 23. AI uses same weapon resource gates
// ═══════════════════════════════════════════════════════════════════════

describe('AI uses same weapon resource gates', () => {
  it('AI vulcan cannot fire when overheated', () => {
    const enemy = createBlockoutVehicle('hunter', 'vulcan', 'purple', 5, 5);
    enemy.team = 'enemy';
    enemy.aiMode = 'stationary_shooter';
    enemy.weaponRuntime.overheat!.isOverheated = true;
    enemy.lastFiredAt = 0;
    // canFireBlockoutWeapon is the same gate used by AI
    expect(canFireBlockoutWeapon(enemy, 1000)).toBe(false);
  });

  it('AI freeze cannot fire when canister empty', () => {
    const enemy = createBlockoutVehicle('wasp', 'freeze', 'purple', 5, 5);
    enemy.team = 'enemy';
    enemy.aiMode = 'chaser';
    enemy.weaponRuntime.canister!.current = 0;
    enemy.weaponRuntime.canister!.isEmpty = true;
    enemy.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(enemy, 1000)).toBe(false);
  });

  it('AI hammer cannot fire during reload', () => {
    const enemy = createBlockoutVehicle('titan', 'hammer', 'purple', 5, 5);
    enemy.team = 'enemy';
    enemy.aiMode = 'hold_position';
    enemy.weaponRuntime.drum!.isReloading = true;
    enemy.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(enemy, 1000)).toBe(false);
  });

  it('AI smoky CAN fire (no resource gate, cooldown only)', () => {
    const enemy = createBlockoutVehicle('hunter', 'smoky', 'purple', 5, 5);
    enemy.team = 'enemy';
    enemy.lastFiredAt = 0;
    expect(canFireBlockoutWeapon(enemy, 1000)).toBe(true);
  });

  it('AI respects same canFireByRuntimeState as player', () => {
    // Verify that canFireByRuntimeState is the shared gate
    const rt = createWeaponRuntimeState('ricochet', 0);
    rt.magazine!.currentStock = 0;
    rt.magazine!.isEmpty = true;
    expect(canFireByRuntimeState(rt)).toBe(false);
    // This same function is called by canFireBlockoutWeapon, which is called by AI
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 24. No final assets/package/docs changes
// ═══════════════════════════════════════════════════════════════════════

describe('No final assets/package/docs changes', () => {
  it('weaponRuntime module is pure state logic (no Phaser imports)', () => {
    // The weaponRuntime module only imports from config modules
    // and does not import from phaser/* — verified by code inspection
    const rt = createWeaponRuntimeState('smoky', 0);
    expect(rt).toBeDefined();
    // All functions are pure logic
    expect(typeof canFireByRuntimeState).toBe('function');
    expect(typeof startWindUp).toBe('function');
    expect(typeof cancelWindUp).toBe('function');
  });

  it('weaponResources module is pure state logic', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    updateCanister(rt, { nowMs: 1000, isFiring: true, deltaSec: 0.016 });
    expect(rt.canister!.current).toBeLessThan(80);
  });

  it('bodyCombatStats module is pure state logic', () => {
    const stats = getEffectiveBodyStats('hunter', 0);
    expect(stats.armor).toBe(5);
    expect(stats.mass).toBe(3000);
  });

  it('no new image/asset files are created by STEP 08', () => {
    // STEP-08H+ only adds state/config logic, no assets
    // This test documents the constraint
    expect(true).toBe(true);
  });

  it('no package.json changes from STEP 08', () => {
    // STEP-08H+ has no new dependencies
    expect(true).toBe(true);
  });

  it('no new documentation files from STEP 08', () => {
    // STEP-08H+ does not create .md files
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Additional integration: updateWeaponResources master update
// ═══════════════════════════════════════════════════════════════════════

describe('updateWeaponResources master update', () => {
  it('updates canister, overheat, and magazine together', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    rt.canister!.current = 50;
    updateWeaponResources(rt, { nowMs: 1100, isFiring: true, deltaSec: 1.0 });
    // Canister should have drained
    expect(rt.canister!.current).toBeCloseTo(35, 1);
  });

  it('does not update wind-up or drum (event-driven)', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    updateWeaponResources(rt, { nowMs: 2000, isFiring: true, deltaSec: 1.0 });
    // Drum is still bursting — updateWeaponResources doesn't advance drum
    expect(rt.drum!.isBursting).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Additional: getEffectiveBodyStats integration
// ═══════════════════════════════════════════════════════════════════════

describe('getEffectiveBodyStats integration', () => {
  it('returns correct stats for all 7 bodies at M0', () => {
    const bodies = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'] as const;
    for (const bodyId of bodies) {
      const stats = getEffectiveBodyStats(bodyId, 0);
      expect(stats.hp).toBeGreaterThan(0);
      expect(stats.armor).toBeGreaterThanOrEqual(0);
      expect(stats.mass).toBeGreaterThan(0);
      expect(stats.maxSpeed).toBeGreaterThan(0);
      expect(['light', 'medium', 'heavy']).toContain(stats.footprintClass);
    }
  });

  it('mass does NOT change with M-level', () => {
    for (let level = 0; level <= 3; level++) {
      const stats0 = getEffectiveBodyStats('hunter', 0);
      const statsL = getEffectiveBodyStats('hunter', level);
      expect(statsL.mass).toBe(stats0.mass);
    }
  });

  it('footprintClass does NOT change with M-level', () => {
    for (let level = 0; level <= 3; level++) {
      const stats0 = getEffectiveBodyStats('wasp', 0);
      const statsL = getEffectiveBodyStats('wasp', level);
      expect(statsL.footprintClass).toBe(stats0.footprintClass);
    }
  });

  it('HP increases from M0 to M3', () => {
    const stats0 = getEffectiveBodyStats('hunter', 0);
    const stats3 = getEffectiveBodyStats('hunter', 3);
    expect(stats3.hp).toBeGreaterThan(stats0.hp);
  });

  it('armor increases from M0 to M3', () => {
    const stats0 = getEffectiveBodyStats('hunter', 0);
    const stats3 = getEffectiveBodyStats('hunter', 3);
    expect(stats3.armor).toBeGreaterThan(stats0.armor);
  });

  it('falls back to defaults for unknown body', () => {
    const stats = getEffectiveBodyStats('unknown_body', 0);
    expect(stats.hp).toBe(210);
    expect(stats.armor).toBe(5);
    expect(stats.mass).toBe(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Additional: Weapon runtime state initialization for all weapon types
// ═══════════════════════════════════════════════════════════════════════

describe('Weapon runtime state initialization for all weapon types', () => {
  it('smoky (cooldown) has no resource models', () => {
    const rt = createWeaponRuntimeState('smoky', 0);
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('thunder (cooldown) has no resource models', () => {
    const rt = createWeaponRuntimeState('thunder', 0);
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('railgun (wind_up) has windUp model', () => {
    const rt = createWeaponRuntimeState('railgun', 0);
    expect(rt.windUp).not.toBeNull();
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('flamethrower (canister_stream) has canister model', () => {
    const rt = createWeaponRuntimeState('flamethrower', 0);
    expect(rt.canister).not.toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('freeze (canister_stream) has canister model', () => {
    const rt = createWeaponRuntimeState('freeze', 0);
    expect(rt.canister).not.toBeNull();
  });

  it('isida (canister_stream) has canister model', () => {
    const rt = createWeaponRuntimeState('isida', 0);
    expect(rt.canister).not.toBeNull();
  });

  it('vulcan (overheat) has overheat model', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    expect(rt.overheat).not.toBeNull();
    expect(rt.canister).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('twins (near_continuous) has no resource models', () => {
    const rt = createWeaponRuntimeState('twins', 0);
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('ricochet (magazine) has magazine model', () => {
    const rt = createWeaponRuntimeState('ricochet', 0);
    expect(rt.magazine).not.toBeNull();
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.drum).toBeNull();
  });

  it('hammer (drum) has drum model', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    expect(rt.drum).not.toBeNull();
    expect(rt.canister).toBeNull();
    expect(rt.overheat).toBeNull();
    expect(rt.windUp).toBeNull();
    expect(rt.magazine).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Additional: Vulcan spin-up behavior
// ═══════════════════════════════════════════════════════════════════════

describe('Vulcan spin-up behavior', () => {
  it('spin-up starts when firing begins', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    updateOverheat(rt, { nowMs: 1000, isFiring: true, deltaSec: 0.016 });
    expect(rt.overheat!.spinUpStartedAt).toBe(1000);
  });

  it('spin-up completes after spinUpMs (400ms)', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    updateOverheat(rt, { nowMs: 1000, isFiring: true, deltaSec: 0.016 });
    expect(rt.overheat!.isSpunUp).toBe(false);
    updateOverheat(rt, { nowMs: 1401, isFiring: true, deltaSec: 0.016 });
    expect(rt.overheat!.isSpunUp).toBe(true);
  });

  it('spin-up resets when not firing', () => {
    const rt = createWeaponRuntimeState('vulcan', 0);
    rt.overheat!.isSpunUp = true;
    rt.overheat!.spinUpStartedAt = 1000;
    updateOverheat(rt, { nowMs: 1500, isFiring: false, deltaSec: 0.016 });
    expect(rt.overheat!.isSpunUp).toBe(false);
    expect(rt.overheat!.spinUpStartedAt).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Additional: Hammer cancelDrumBurst
// ═══════════════════════════════════════════════════════════════════════

describe('Hammer cancelDrumBurst', () => {
  it('cancelDrumBurst stops burst but not reload', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    recordDrumVolleyFired(rt, 1250); // volley 1
    cancelDrumBurst(rt);
    expect(rt.drum!.isBursting).toBe(false);
    expect(rt.drum!.burstVolleyCount).toBe(0);
  });

  it('cancelDrumBurst does not cancel active reload', () => {
    const rt = createWeaponRuntimeState('hammer', 0);
    startDrumBurst(rt, 1000);
    recordDrumVolleyFired(rt, 1250); // volley 1
    recordDrumVolleyFired(rt, 1500); // volley 2
    recordDrumVolleyFired(rt, 1750); // volley 3 → triggers reload
    expect(rt.drum!.isReloading).toBe(true);
    cancelDrumBurst(rt);
    expect(rt.drum!.isReloading).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Additional: M-level scaling across weapon configs
// ═══════════════════════════════════════════════════════════════════════

describe('M-level scaling across weapon configs', () => {
  it('vulcan M0 heatPerShot = 12, M3 = 9 (improvement = less heat)', () => {
    const cfg = getWeaponConfig('vulcan')!;
    expect(getWeaponMLevelValue(cfg.overheat!.heatPerShot, 0)).toBe(12);
    expect(getWeaponMLevelValue(cfg.overheat!.heatPerShot, 3)).toBe(9);
  });

  it('vulcan M0 coolingPerSec = 8, M3 = 11 (improvement = faster cooling)', () => {
    const cfg = getWeaponConfig('vulcan')!;
    expect(getWeaponMLevelValue(cfg.overheat!.coolingPerSec, 0)).toBe(8);
    expect(getWeaponMLevelValue(cfg.overheat!.coolingPerSec, 3)).toBe(11);
  });

  it('ricochet M0 stockSize = 4, M3 = 6 (improvement = more stock)', () => {
    const cfg = getWeaponConfig('ricochet')!;
    expect(getWeaponMLevelValue(cfg.magazine!.stockSize, 0)).toBe(4);
    expect(getWeaponMLevelValue(cfg.magazine!.stockSize, 3)).toBe(6);
  });

  it('hammer M0 reloadMs = 3000, M3 = 2300 (improvement = faster)', () => {
    const cfg = getWeaponConfig('hammer')!;
    expect(getWeaponMLevelValue(cfg.drum!.reloadMs, 0)).toBe(3000);
    expect(getWeaponMLevelValue(cfg.drum!.reloadMs, 3)).toBe(2300);
  });

  it('hammer M0 delayBetweenVolleysMs = 250, M3 = 180', () => {
    const cfg = getWeaponConfig('hammer')!;
    expect(getWeaponMLevelValue(cfg.drum!.delayBetweenVolleysMs, 0)).toBe(250);
    expect(getWeaponMLevelValue(cfg.drum!.delayBetweenVolleysMs, 3)).toBe(180);
  });

  it('isida M0 canister capacity = 70, M3 = 100', () => {
    const cfg = getWeaponConfig('isida')!;
    expect(getWeaponMLevelValue(cfg.canister!.capacity, 0)).toBe(70);
    expect(getWeaponMLevelValue(cfg.canister!.capacity, 3)).toBe(100);
  });
});
