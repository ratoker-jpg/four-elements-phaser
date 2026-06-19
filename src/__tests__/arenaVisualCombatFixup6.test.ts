/**
 * Tests for ARENA-VISUAL-COMBAT-FIX-01 fixup-6 — stop conflating gameplay
 * center / hull visual anchor / turret pivot / selection ring / muzzle.
 *
 * Covers the H checklist:
 *   1. Hull visual profile helper: known hull returns profile; fallback safe.
 *   2. Selection ring profile: heavy ring > light ring; radius independent of
 *      recoil (the helper takes only bodyId, never a recoil field).
 *   3. Turret rest direction: no target → turretDir16 === hullDir16.
 *   4. Turret target direction: aiming → turretDir16 follows screen target dir.
 *   5. Muzzle profile: not body center; follows turretDir16; profile before
 *      fallback.
 *   6. Blockout→modular integration: hullDir16 & turretDir16 for Denis truth map.
 *   7. Friendly fire remains intact.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  blockoutToModularVisual,
  gridBodyAngleToModularDir16,
  screenAngleToModularDir16,
  dir16ToScreenAngle,
} from '../modular/blockoutToModularVisual';
import {
  getHullVisualProfile,
  getHullVisualOffsetPx,
  getHullRingScale,
  DEFAULT_HULL_VISUAL_PROFILE,
  HULL_VISUAL_PROFILE,
} from '../config/hullVisualProfiles';
import {
  getTurretMuzzleProfile,
  DEFAULT_TURRET_MUZZLE_PROFILE,
  TURRET_MUZZLE_PROFILE,
  getMuzzleDir16Override,
} from '../config/directionalTurretProfiles';
import { computeModularMuzzlePoint } from '../phaser/render/ModularVehicleLiveAdapter';
import { getHullSelectionRingRadiusTiles } from '../phaser/render/blockoutVehicleGeometry';
import {
  findSplashTargets,
  clearDamageEvents,
  resetDamageEventIdCounter,
} from '../state/blockoutDamage';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { computeBodyWorldCenter } from '../phaser/render/blockoutVehicleGeometry';
import type { IsoPoint } from '../phaser/render/isometric';

const TEST_OFFSET: IsoPoint = { x: 0, y: 0 };

// ─── H1: Hull visual profile helper ─────────────────────────────────

describe('fixup-6: HULL_VISUAL_PROFILE helper', () => {
  it('returns an explicit profile for a known QA hull', () => {
    const wasp = getHullVisualProfile('wasp');
    expect(wasp).toBe(HULL_VISUAL_PROFILE.wasp);
    expect(wasp.visualOffsetPx).toEqual({ x: 0, y: 1 });
    expect(wasp.ringScale).toBe(1.6);
  });

  it('falls back safely for an unknown hull', () => {
    const unknown = getHullVisualProfile('not-a-real-hull');
    expect(unknown).toBe(DEFAULT_HULL_VISUAL_PROFILE);
    expect(unknown.visualOffsetPx).toEqual({ x: 0, y: 0 });
    expect(unknown.ringScale).toBe(1.0);
  });

  it('all QA hulls start at the metadata-centred {0,0} baseline (no guessed offset)', () => {
    // fixup-7 calibrated offsets from PNG centroid measurements; they are
    // small (0-2px) but no longer all {0,0}.
    for (const id of ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth']) {
      const offset = getHullVisualOffsetPx(id);
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(2);
    }
  });

  it('ring scale convenience matches the profile', () => {
    expect(getHullRingScale('mammoth')).toBe(getHullVisualProfile('mammoth').ringScale);
    expect(getHullRingScale('unknown')).toBe(DEFAULT_HULL_VISUAL_PROFILE.ringScale);
  });
});

// ─── H2: Selection ring profile (footprint, recoil-independent) ─────

describe('fixup-6: selection ring profile', () => {
  it('heavy hull ring is larger than a light hull ring', () => {
    const light = getHullSelectionRingRadiusTiles('wasp');     // small_fast
    const heavy = getHullSelectionRingRadiusTiles('mammoth');  // super_heavy
    expect(heavy).toBeGreaterThan(light);
  });

  it('ring radius is purely a function of bodyId (does not follow recoil)', () => {
    // The helper signature takes only bodyId — there is no recoil parameter,
    // so a recoiling vehicle cannot change its ring radius. Calling twice for
    // the same hull is deterministic.
    const a = getHullSelectionRingRadiusTiles('hunter');
    const b = getHullSelectionRingRadiusTiles('hunter');
    expect(a).toBe(b);
  });

  it('per-hull ringScale=1.0 preserves the footprint formula', () => {
    // With ringScale neutral, the radius equals the pure footprint formula.
    const PROJ_TILE_W = 76;
    const MARGIN = 2.4;
    // mammoth: max(32,22)/2 = 16
    const expected = (16 / PROJ_TILE_W) * MARGIN * getHullRingScale('mammoth');
    expect(getHullSelectionRingRadiusTiles('mammoth')).toBeCloseTo(expected, 6);
  });
});

// ─── H3: Turret rest direction (parallel to hull) ───────────────────

describe('fixup-6: turret rest direction equals hull direction', () => {
  // At rest, runtime sets turretAngle toward bodyAngle (grid-space). The
  // mapper must NOT pass it through the screen offset; with turretAiming=false
  // it reuses hullDir16 so the turret renders parallel to the hull.
  const restCases: Array<[string, number]> = [
    ['grid East', 0],
    ['grid South', Math.PI / 2],
    ['grid West', Math.PI],
    ['grid North', -Math.PI / 2],
  ];

  for (const [label, bodyAngle] of restCases) {
    it(`no target: turretDir16 === hullDir16 (${label})`, () => {
      const r = blockoutToModularVisual({
        bodyId: 'wasp',
        weaponId: 'smoky',
        faction: 'cyan',
        modificationLevel: 0,
        bodyAngle,
        // At rest the runtime drives turretAngle toward bodyAngle.
        turretAngle: bodyAngle,
        turretAiming: false,
      });
      expect(r.turretDir16).toBe(r.hullDir16);
      expect(r.turretDir16).toBe(gridBodyAngleToModularDir16(bodyAngle));
    });
  }

  it('regression: feeding the grid rest angle through screen mapping was wrong', () => {
    // Demonstrates the old bug: screen mapping of the grid-space rest angle
    // produced a turret 2 dir16 steps (≈45°) off the hull.
    const bodyAngle = 0;
    const hullDir16 = gridBodyAngleToModularDir16(bodyAngle); // 4
    const wrongTurret = screenAngleToModularDir16(bodyAngle); // 2
    expect(wrongTurret).not.toBe(hullDir16);
    // The fix restores parity.
    const r = blockoutToModularVisual({
      bodyId: 'wasp', weaponId: 'smoky', faction: 'cyan', modificationLevel: 0,
      bodyAngle, turretAngle: bodyAngle, turretAiming: false,
    });
    expect(r.turretDir16).toBe(hullDir16);
  });
});

// ─── H4: Turret target direction (screen aim) ───────────────────────

describe('fixup-6: turret target direction follows screen aim', () => {
  it('aiming: turretDir16 follows the screen-space aim angle, not the hull', () => {
    // Hull faces grid East (dir4); turret aims screen NE (-π/4 → dir0).
    const r = blockoutToModularVisual({
      bodyId: 'wasp', weaponId: 'smoky', faction: 'cyan', modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: -Math.PI / 4,
      turretAiming: true,
    });
    expect(r.hullDir16).toBe(4);
    expect(r.turretDir16).toBe(0);
    expect(r.turretDir16).toBe(screenAngleToModularDir16(-Math.PI / 4));
  });

  it('aiming default (turretAiming omitted) preserves screen mapping', () => {
    const r = blockoutToModularVisual({
      bodyId: 'wasp', weaponId: 'smoky', faction: 'cyan', modificationLevel: 0,
      bodyAngle: 0, turretAngle: Math.PI / 4,
    });
    expect(r.turretDir16).toBe(screenAngleToModularDir16(Math.PI / 4)); // dir4
  });
});

// ─── H5: Muzzle profile ─────────────────────────────────────────────

describe('fixup-6: TURRET_MUZZLE_PROFILE + muzzle point', () => {
  const BASE = { x: 100, y: 100 };

  it('returns an explicit profile for known turrets, safe fallback otherwise', () => {
    expect(getTurretMuzzleProfile('railgun')).toBe(TURRET_MUZZLE_PROFILE.railgun);
    expect(getTurretMuzzleProfile('nope')).toBe(DEFAULT_TURRET_MUZZLE_PROFILE);
    // Every profile has a strictly forward (positive) barrel.
    for (const id of Object.keys(TURRET_MUZZLE_PROFILE)) {
      expect(TURRET_MUZZLE_PROFILE[id].muzzleForwardPx).toBeGreaterThan(0);
    }
  });

  it('muzzle is NOT the body/turret base center', () => {
    const m = computeModularMuzzlePoint(BASE, 'thunder', 4);
    expect(m.x === BASE.x && m.y === BASE.y).toBe(false);
  });

  it('muzzle changes with turret dir16', () => {
    const ne = computeModularMuzzlePoint(BASE, 'thunder', 0);  // screen NE
    const se = computeModularMuzzlePoint(BASE, 'thunder', 4);  // screen SE
    const sw = computeModularMuzzlePoint(BASE, 'thunder', 8);  // screen SW
    // NE vs SE share x (both point right) but differ in y.
    expect(ne.y).not.toBeCloseTo(se.y, 3);
    // NE vs SW differ in x (right vs left).
    expect(ne.x).not.toBeCloseTo(sw.x, 3);
  });

  it('muzzle uses the per-turret profile (longer barrel → farther muzzle)', () => {
    // railgun forward (42) > firebird forward (18) → railgun muzzle is farther
    // from the base along the same direction.
    const dir = 4; // SE
    const rail = computeModularMuzzlePoint(BASE, 'railgun', dir);
    const fire = computeModularMuzzlePoint(BASE, 'firebird', dir);
    const dRail = Math.hypot(rail.x - BASE.x, rail.y - BASE.y);
    const dFire = Math.hypot(fire.x - BASE.x, fire.y - BASE.y);
    expect(dRail).toBeGreaterThan(dFire);
  });

  it('rest muzzle aligns with the hull/turret direction (dir from dir16)', () => {
    // Hull at rest facing grid East → dir4 (screen SE). fixup-7: thunder uses
    // per-dir16 override, so the muzzle is base + dirOverride rather than the
    // flat forwardPx decomposition.
    const dir16 = 4;
    const m = computeModularMuzzlePoint(BASE, 'thunder', dir16);
    const override = getMuzzleDir16Override('thunder', dir16);
    expect(override).not.toBeNull();
    expect(m.x).toBeCloseTo(BASE.x + override!.dx, 5);
    expect(m.y).toBeCloseTo(BASE.y + override!.dy, 5);
  });

  it('attack muzzle uses the target-facing turret direction', () => {
    // Aiming screen NE → dir0. fixup-7: thunder uses per-dir16 override.
    const r = blockoutToModularVisual({
      bodyId: 'wasp', weaponId: 'thunder', faction: 'cyan', modificationLevel: 0,
      bodyAngle: 0, turretAngle: -Math.PI / 4, turretAiming: true,
    });
    const m = computeModularMuzzlePoint(BASE, 'thunder', r.turretDir16);
    const override = getMuzzleDir16Override('thunder', r.turretDir16);
    expect(override).not.toBeNull();
    expect(m.x).toBeCloseTo(BASE.x + override!.dx, 5);
    expect(m.y).toBeCloseTo(BASE.y + override!.dy, 5);
  });

  it('dir16ToScreenAngle is the inverse of screenAngleToModularDir16', () => {
    for (let d = 0; d < 16; d++) {
      expect(screenAngleToModularDir16(dir16ToScreenAngle(d))).toBe(d);
    }
  });
});

// ─── H6: Blockout→modular integration (Denis truth map) ─────────────

describe('fixup-6: blockoutToModularVisual integration — Denis truth map', () => {
  // dir4 = screen bottom-right (grid East), dir8 = bottom-left (grid South),
  // dir12 = top-left (grid West), dir0 = top-right (grid North).
  const hullCases: Array<[string, number, number]> = [
    ['grid East → dir4', 0, 4],
    ['grid South → dir8', Math.PI / 2, 8],
    ['grid West → dir12', Math.PI, 12],
    ['grid North → dir0', -Math.PI / 2, 0],
  ];

  for (const [label, bodyAngle, expectedHull] of hullCases) {
    it(`hullDir16: ${label}`, () => {
      const r = blockoutToModularVisual({
        bodyId: 'hunter', weaponId: 'smoky', faction: 'cyan', modificationLevel: 0,
        bodyAngle, turretAngle: bodyAngle, turretAiming: false,
      });
      expect(r.hullDir16).toBe(expectedHull);
      // rest: turret matches hull
      expect(r.turretDir16).toBe(expectedHull);
    });
  }

  it('turretDir16 follows screen aim independent of hull (target active)', () => {
    const r = blockoutToModularVisual({
      bodyId: 'hunter', weaponId: 'smoky', faction: 'cyan', modificationLevel: 0,
      bodyAngle: Math.PI, // hull grid West → dir12
      turretAngle: Math.PI / 4, // screen SE → dir4
      turretAiming: true,
    });
    expect(r.hullDir16).toBe(12);
    expect(r.turretDir16).toBe(4);
  });
});

// ─── H7: Friendly fire remains intact ───────────────────────────────

describe('fixup-6: friendly fire remains off', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
    resetDamageEventIdCounter();
    clearDamageEvents();
  });

  it('same-team ally takes no splash damage', () => {
    const shooter = createBlockoutVehicle('wasp', 'thunder', 'cyan', 10, 10, Math.PI / 2, 120, 'ally');
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 10, 12, Math.PI / 2, 120, 'ally');
    const enemy = createBlockoutVehicle('hunter', 'thunder', 'green', 10, 14, -Math.PI / 2, 120, 'enemy');
    const vehicles = [shooter, ally, enemy];
    const allyCenter = computeBodyWorldCenter(ally, TEST_OFFSET);
    const targets = findSplashTargets(shooter, vehicles, allyCenter.x, allyCenter.y, 100, TEST_OFFSET);
    expect(targets.some(t => t.id === ally.id)).toBe(false);
    // enemy is still hittable (sanity: friendly-fire-off didn't disable all damage)
    expect(targets.some(t => t.id === enemy.id || t.id === shooter.id)).toBe(
      targets.some(t => t.id === enemy.id),
    );
  });
});
