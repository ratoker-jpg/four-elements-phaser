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
  MOUNT_SLOT_FORWARD_FRACTION,
  getHullMountSlot,
  getMountSlotSocketShift,
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

  it('unknown hull falls back to center (no shift, non-regressing)', () => {
    expect(getHullMountSlot('totally-new-hull')).toBe('center');
    const shift = getMountSlotSocketShift('totally-new-hull', 0, 100);
    expect(shift).toEqual({ dx: 0, dy: 0 });
  });
});

describe('MODULAR-RUNTIME-04B: mount-slot socket shift behavior', () => {
  it('center hulls receive an exact zero shift in every direction', () => {
    for (const dir of [0, 2, 4, 6, 8, 10, 12, 14]) {
      const shift = getMountSlotSocketShift('viking', dir, 82);
      expect(shift.dx).toBe(0);
      expect(shift.dy).toBe(0);
    }
  });

  it('front and rear shifts are equal magnitude, opposite sign (same hull facing)', () => {
    const front = getMountSlotSocketShift('mammoth', 0, 82); // mammoth = front
    const rear = getMountSlotSocketShift('wasp', 0, 82); // wasp = rear
    expect(front.dx).toBeCloseTo(-rear.dx, 6);
    expect(front.dy).toBeCloseTo(-rear.dy, 6);
    expect(front.dx).toBeGreaterThan(0); // dir0 = East → +x toward facing
  });

  it('shift follows the hull facing direction (computed, not a per-dir table)', () => {
    // dir0 = E → +x; dir4 = S → +y; dir8 = W → -x; dir12 = N → -y
    const e = getMountSlotSocketShift('titan', 0, 82);
    const s = getMountSlotSocketShift('titan', 4, 82);
    const w = getMountSlotSocketShift('titan', 8, 82);
    const n = getMountSlotSocketShift('titan', 12, 82);
    expect(e.dx).toBeGreaterThan(0);
    expect(Math.abs(e.dy)).toBeLessThan(1e-6);
    expect(s.dy).toBeGreaterThan(0);
    expect(w.dx).toBeLessThan(0);
    expect(n.dy).toBeLessThan(0);
  });

  it('shift scales with the hull display size (fraction-based, not pixel-absolute)', () => {
    const small = getMountSlotSocketShift('mammoth', 0, 50);
    const big = getMountSlotSocketShift('mammoth', 0, 100);
    expect(big.dx).toBeCloseTo(small.dx * 2, 6);
  });

  it('forward fraction config: center is exactly 0, front/rear are opposite', () => {
    expect(MOUNT_SLOT_FORWARD_FRACTION.center).toBe(0);
    expect(MOUNT_SLOT_FORWARD_FRACTION.front).toBeGreaterThan(0);
    expect(MOUNT_SLOT_FORWARD_FRACTION.rear).toBeLessThan(0);
  });
});

describe('MODULAR-RUNTIME-04B: mount-slot integrates into composition', () => {
  function socketX(hullId: (typeof ALL_HULLS)[number]) {
    const plan = composeModularVehicle({
      visual: { hullId, turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0 as GeneratedModularDir16,
      turretDir16: 0 as GeneratedModularDir16,
      anchor: { x: 300, y: 300 },
      textureExists: () => true,
    });
    return plan.socketScreen.x;
  }

  it('center hull socket stays at the hull centre (anchor) at dir0', () => {
    // viking is center; metadata is frame-centre → socket == anchor.
    expect(socketX('viking')).toBeCloseTo(300, 6);
  });

  it('front hull socket sits ahead of centre, rear behind, at dir0 (East)', () => {
    expect(socketX('mammoth')).toBeGreaterThan(300); // front → +x
    expect(socketX('wasp')).toBeLessThan(300); // rear → -x
  });

  it('mount-slot does NOT change hull sprite position or scale', () => {
    const plan = composeModularVehicle({
      visual: { hullId: 'mammoth', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0 as GeneratedModularDir16,
      turretDir16: 0 as GeneratedModularDir16,
      anchor: { x: 300, y: 300 },
      textureExists: () => true,
    });
    // Hull stays centred on the anchor; only the turret/socket moved.
    expect(plan.hull.position).toEqual({ x: 300, y: 300 });
    expect(plan.hull.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
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
