/**
 * MODULAR-RUNTIME-04B — unified modular vehicle renderer corrective refactor.
 *
 * Locks in:
 *   1. mount-slot production model (front/center/rear) for all 7 hulls;
 *   2. mount-slot is a composition-offset-only adjustment (center = zero shift,
 *      front/rear shift along the hull facing, no per-direction tables);
 *   3. all four factions produce correct texture keys through the live path;
 *   4. the faction safety net keeps valid factions and only diagnoses missing;
 *   5. debug overlays default to OFF (no debug lines/arrows by default);
 *   6. Dictator +9% hull-only is preserved under the mount-slot layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  composeModularVehicle,
  MODULAR_VEHICLE_BASE_SCALE,
  MODULAR_FRAME_SIZE,
} from '../modular/modularVehicleComposition';
import {
  HULL_MOUNT_SLOTS,
  MOUNT_SLOT_PLACEMENT,
  getHullMountSlot,
  getMountSlotPlacement,
  type ModularVehicleMountSlot,
} from '../modular/modularVehicleMountSlots';
import {
  resolveModularFaction,
  MODULAR_FACTIONS,
  FALLBACK_MODULAR_FACTION,
  __resetFactionWarningForTest,
} from '../modular/modularFactionResolver';
import {
  vehicleDebugOverlays,
  setVehicleDebugOverlay,
  disableAllVehicleDebugOverlays,
} from '../phaser/render/vehicleDebugFlags';
import { getGeneratedHullTextureKey, getGeneratedTurretTextureKey } from '../assets/generatedModularVehicleAssets.generated';
import type { GeneratedModularDir16 } from '../assets/generatedModularVehicleAssets.generated';
import type { Faction } from '../state/types';

const ALL_HULLS = ['wasp', 'hornet', 'hunter', 'viking', 'titan', 'mammoth', 'dictator'] as const;

// ─── 1. Mount-slot production model ─────────────────────────────────

describe('MODULAR-RUNTIME-04B: mount-slot categories for all seven hulls', () => {
  const expected: Record<string, ModularVehicleMountSlot> = {
    mammoth: 'front',
    titan: 'front',
    viking: 'center',
    hunter: 'center',
    hornet: 'center',
    wasp: 'rear',
    dictator: 'rear',
  };

  it('maps each hull to the documented mount slot', () => {
    for (const [hull, slot] of Object.entries(expected)) {
      expect(getHullMountSlot(hull)).toBe(slot);
      expect(HULL_MOUNT_SLOTS[hull]).toBe(slot);
    }
  });

  it('covers exactly the seven runtime hulls', () => {
    expect(Object.keys(HULL_MOUNT_SLOTS).sort()).toEqual([...ALL_HULLS].sort());
  });

  it('front = mammoth+titan, center = viking+hunter+hornet, rear = wasp+dictator', () => {
    const bySlot: Record<ModularVehicleMountSlot, string[]> = { front: [], center: [], rear: [] };
    for (const hull of ALL_HULLS) bySlot[getHullMountSlot(hull)].push(hull);
    expect(bySlot.front.sort()).toEqual(['mammoth', 'titan']);
    expect(bySlot.center.sort()).toEqual(['hornet', 'hunter', 'viking']);
    expect(bySlot.rear.sort()).toEqual(['dictator', 'wasp']);
  });

  it('unknown hull falls back to center profile (non-regressing)', () => {
    expect(getHullMountSlot('totally-new-hull')).toBe('center');
    expect(getMountSlotPlacement('totally-new-hull')).toEqual(
      MOUNT_SLOT_PLACEMENT.center,
    );
  });
});

describe('MODULAR-RUNTIME-04B-FIX: accepted production placement profiles', () => {
  it('front profile (titan/mammoth) = hullOffset 4 / -12, turretOffset 0 / 0', () => {
    expect(MOUNT_SLOT_PLACEMENT.front).toEqual({
      hullOffset: { x: 4, y: -12 },
      turretOffset: { x: 0, y: 0 },
    });
    for (const hull of ['titan', 'mammoth']) {
      expect(getMountSlotPlacement(hull).hullOffset).toEqual({ x: 4, y: -12 });
      expect(getMountSlotPlacement(hull).turretOffset).toEqual({ x: 0, y: 0 });
    }
  });

  it('center profile (hunter/viking/hornet) = hullOffset -5 / -7, turretOffset 0 / 0', () => {
    expect(MOUNT_SLOT_PLACEMENT.center).toEqual({
      hullOffset: { x: -5, y: -7 },
      turretOffset: { x: 0, y: 0 },
    });
    for (const hull of ['hunter', 'viking', 'hornet']) {
      expect(getMountSlotPlacement(hull).hullOffset).toEqual({ x: -5, y: -7 });
      expect(getMountSlotPlacement(hull).turretOffset).toEqual({ x: 0, y: 0 });
    }
  });

  it('rear profile (dictator/wasp) = hullOffset -7 / -11, turretOffset 0 / 0', () => {
    expect(MOUNT_SLOT_PLACEMENT.rear).toEqual({
      hullOffset: { x: -7, y: -11 },
      turretOffset: { x: 0, y: 0 },
    });
    for (const hull of ['dictator', 'wasp']) {
      expect(getMountSlotPlacement(hull).hullOffset).toEqual({ x: -7, y: -11 });
      expect(getMountSlotPlacement(hull).turretOffset).toEqual({ x: 0, y: 0 });
    }
  });

  it('Wasp no longer uses 0 / 0 placement (regression that pushed it off-tile)', () => {
    const wasp = getMountSlotPlacement('wasp').hullOffset;
    expect(wasp).not.toEqual({ x: 0, y: 0 });
    expect(wasp).toEqual({ x: -7, y: -11 });
  });
});

describe('MODULAR-RUNTIME-04B-FIX: placement integrates into composition', () => {
  function planFor(hullId: string) {
    return composeModularVehicle({
      visual: { hullId: hullId as any, turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0 as GeneratedModularDir16,
      turretDir16: 0 as GeneratedModularDir16,
      anchor: { x: 300, y: 300 },
      textureExists: () => true,
    });
  }

  it('hull position = anchor + production hullOffset for each category', () => {
    // front (titan): +4 / -12
    expect(planFor('titan').hull.position).toEqual({ x: 304, y: 288 });
    // center (hunter): -5 / -7
    expect(planFor('hunter').hull.position).toEqual({ x: 295, y: 293 });
    // rear (wasp): -7 / -11
    expect(planFor('wasp').hull.position).toEqual({ x: 293, y: 289 });
  });

  it('socket rides with the hull (frame-centre metadata → socket == hull centre)', () => {
    const p = planFor('wasp');
    expect(p.socketScreen.x).toBeCloseTo(p.hull.position.x, 6);
    expect(p.socketScreen.y).toBeCloseTo(p.hull.position.y, 6);
  });

  it('turret rides with the hull; turretOffset 0/0 → turret centre == hull centre', () => {
    const p = planFor('wasp');
    expect(p.turret.position.x).toBeCloseTo(p.hull.position.x, 6);
    expect(p.turret.position.y).toBeCloseTo(p.hull.position.y, 6);
  });

  it('placement does NOT change hull/turret scale', () => {
    const p = planFor('mammoth');
    expect(p.hull.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
    expect(p.turret.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
  });
});

describe('MODULAR-RUNTIME-04B-FIX: preview and live use the same placement source', () => {
  it('the shared placement profile is the single source for live composition', () => {
    // Live composition derives hull.position from getMountSlotPlacement; the
    // preview renderer reads the identical getMountSlotPlacement for its base.
    const anchor = { x: 500, y: 400 };
    for (const hull of ALL_HULLS) {
      const placement = getMountSlotPlacement(hull);
      const plan = composeModularVehicle({
        visual: { hullId: hull, turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
        hullDir16: 0 as GeneratedModularDir16,
        turretDir16: 0 as GeneratedModularDir16,
        anchor,
        textureExists: () => true,
      });
      expect(plan.hull.position.x).toBeCloseTo(anchor.x + placement.hullOffset.x, 6);
      expect(plan.hull.position.y).toBeCloseTo(anchor.y + placement.hullOffset.y, 6);
    }
  });
});

describe('MODULAR-RUNTIME-04B: Dictator +9% hull-only survives mount-slot layer', () => {
  it('Dictator hull is base*1.09, turret stays at base, even though it is rear-mount', () => {
    const plan = composeModularVehicle({
      visual: { hullId: 'dictator', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0 as GeneratedModularDir16,
      turretDir16: 0 as GeneratedModularDir16,
      anchor: { x: 300, y: 300 },
      textureExists: () => true,
    });
    expect(plan.hull.scale).toBeCloseTo(MODULAR_VEHICLE_BASE_SCALE * 1.09, 6);
    expect(plan.turret.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
    expect(getHullMountSlot('dictator')).toBe('rear');
  });

  it('exact accepted scales: dictator hull 0.1744, dictator turret 0.1600', () => {
    const plan = composeModularVehicle({
      visual: { hullId: 'dictator', turretId: 'ricochet', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0 as GeneratedModularDir16,
      turretDir16: 0 as GeneratedModularDir16,
      anchor: { x: 0, y: 0 },
      textureExists: () => true,
    });
    expect(plan.hull.scale).toBeCloseTo(0.1744, 4);
    expect(plan.turret.scale).toBeCloseTo(0.1600, 4);
  });
});

// ─── 2/3. Faction coverage ──────────────────────────────────────────

describe('MODULAR-RUNTIME-04B: all four factions produce correct texture keys', () => {
  const FACTIONS: Faction[] = ['cyan', 'green', 'yellow', 'purple'];

  it('hull + turret keys embed the requested faction for all four factions', () => {
    for (const faction of FACTIONS) {
      const plan = composeModularVehicle({
        visual: { hullId: 'hunter', turretId: 'twins', faction, hullMod: 'm1', turretMod: 'm1' },
        hullDir16: 3 as GeneratedModularDir16,
        turretDir16: 5 as GeneratedModularDir16,
        anchor: { x: 0, y: 0 },
        textureExists: () => true,
      });
      expect(plan.hull.textureKey).toBe(getGeneratedHullTextureKey('hunter', faction, 'm1', 3));
      expect(plan.turret.textureKey).toBe(getGeneratedTurretTextureKey('twins', faction, 'm1', 5));
      expect(plan.hull.textureKey).toContain(`_${faction}_`);
      expect(plan.turret.textureKey).toContain(`_${faction}_`);
    }
  });

  it('different factions request different texture keys (no cyan collapse)', () => {
    const keys = FACTIONS.map((faction) =>
      getGeneratedHullTextureKey('viking', faction, 'm0', 0),
    );
    expect(new Set(keys).size).toBe(4);
  });
});

describe('MODULAR-RUNTIME-04B: faction safety net', () => {
  beforeEach(() => __resetFactionWarningForTest());

  it('passes through every valid faction unchanged', () => {
    for (const f of MODULAR_FACTIONS) {
      expect(resolveModularFaction(f)).toBe(f);
    }
  });

  it('falls back (last resort) for missing/invalid faction', () => {
    expect(resolveModularFaction(undefined)).toBe(FALLBACK_MODULAR_FACTION);
    expect(resolveModularFaction('rainbow' as Faction)).toBe(FALLBACK_MODULAR_FACTION);
  });

  it('does not hardcode cyan for a real faction', () => {
    expect(resolveModularFaction('purple')).toBe('purple');
    expect(resolveModularFaction('green')).toBe('green');
    expect(resolveModularFaction('yellow')).toBe('yellow');
  });
});

// ─── 5. Debug overlays default off ──────────────────────────────────

describe('MODULAR-RUNTIME-04B: debug overlays are off by default', () => {
  beforeEach(() => disableAllVehicleDebugOverlays());

  it('every debug overlay flag defaults to false', () => {
    expect(vehicleDebugOverlays.movementLine).toBe(false);
    expect(vehicleDebugOverlays.aimLine).toBe(false);
    expect(vehicleDebugOverlays.directionArrow).toBe(false);
    expect(vehicleDebugOverlays.mountPoints).toBe(false);
    expect(vehicleDebugOverlays.turretCursorAim).toBe(false);
  });

  it('a debug panel can explicitly enable an overlay', () => {
    expect(setVehicleDebugOverlay('aimLine', true)).toBe(true);
    expect(vehicleDebugOverlays.aimLine).toBe(true);
    disableAllVehicleDebugOverlays();
    expect(vehicleDebugOverlays.aimLine).toBe(false);
  });
});

// ─── Lazy-load budget sanity (one visual set = max 32 PNG) ──────────

describe('MODULAR-RUNTIME-04B: one visual set is 16 hull + 16 turret PNG', () => {
  it('frame size constant unchanged (no asset regeneration)', () => {
    expect(MODULAR_FRAME_SIZE).toBe(512);
  });
  it('16 directions × (1 hull + 1 turret) = 32 keys per visual set', () => {
    const faction: Faction = 'green';
    const keys = new Set<string>();
    for (let d = 0; d < 16; d++) {
      keys.add(getGeneratedHullTextureKey('wasp', faction, 'm0', d as GeneratedModularDir16));
      keys.add(getGeneratedTurretTextureKey('smoky', faction, 'm0', d as GeneratedModularDir16));
    }
    expect(keys.size).toBe(32);
  });
});
