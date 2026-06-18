/**
 * Tests for ARENA-VISUAL-COMBAT-FIX-01 fixup-5 — final visual alignment fixes
 * after Denis manual QA.
 *
 * Covers:
 * - Selection ring visual anchor: footprint-scaled ring radius helper
 *   (light hull < medium < heavy; unknown falls back to medium; smaller than
 *   the old fixed 0.65-tile ellipse).
 * - Hull direction mapping against the Denis truth map, asserted against the
 *   ACTUAL runtime angle source: vehicle.bodyAngle is GRID/tile-space
 *   (blockoutMovement: worldX/worldY = tileToScreen(ftx,fty) and
 *   ftx += cos(bodyAngle)), so the hull uses gridBodyAngleToModularDir16 (+π/2).
 * - Turret direction mapping against the Denis truth map, asserted against the
 *   ACTUAL runtime angle source: the turret aim angle is SCREEN-space
 *   (GameScene: angleFromTo(turretMountScreen, targetCenterScreen)), so the
 *   turret uses screenAngleToModularDir16 (+π/4).
 * - Hull vs turret differ for the same numeric angle (split mapping is real).
 * - Friendly fire remains OFF and self-damage gating preserved.
 * - Default debug render flags (no new debug flag needed for the gray marker;
 *   the stray gray barrel line is gated by render state, not a debug flag).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  screenAngleToModularDir16,
  gridBodyAngleToModularDir16,
} from '../modular/blockoutToModularVisual';
import {
  getHullSelectionRingRadiusTiles,
  SELECTION_RING_FOOTPRINT_MARGIN,
} from '../phaser/render/blockoutVehicleGeometry';
import {
  debugRenderFlags,
  resetDebugRenderFlags,
  areAllDebugRenderFlagsOff,
} from '../config/debugRenderFlags';
import {
  findSplashTargets,
  findConeTargets,
  findDirectHitTarget,
  clearDamageEvents,
  resetDamageEventIdCounter,
} from '../state/blockoutDamage';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import { computeBodyWorldCenter } from '../phaser/render/blockoutVehicleGeometry';
import type { IsoPoint } from '../phaser/render/isometric';

const TEST_OFFSET: IsoPoint = { x: 0, y: 0 };

// ─── C/D: Selection ring visual anchor (footprint-scaled radius) ────

describe('fixup-5: getHullSelectionRingRadiusTiles (selection ring visual anchor)', () => {
  // Body → shape sizes (SHAPE_SIZE_MAP):
  //   wasp    small_fast  (16x10)  — smallest
  //   hornet  light_fast  (18x12)
  //   hunter  medium      (22x14)
  //   titan   heavy       (28x18)
  //   mammoth super_heavy (32x22)  — largest

  it('returns a positive radius for a known hull', () => {
    expect(getHullSelectionRingRadiusTiles('hunter')).toBeGreaterThan(0);
  });

  it('light hull gets a SMALLER ring than a heavy hull', () => {
    const wasp = getHullSelectionRingRadiusTiles('wasp');
    const titan = getHullSelectionRingRadiusTiles('titan');
    const mammoth = getHullSelectionRingRadiusTiles('mammoth');
    expect(wasp).toBeLessThan(titan);
    expect(titan).toBeLessThan(mammoth);
  });

  it('ring radius scales monotonically with body footprint', () => {
    const wasp = getHullSelectionRingRadiusTiles('wasp');     // 16x10
    const hornet = getHullSelectionRingRadiusTiles('hornet'); // 18x12
    const hunter = getHullSelectionRingRadiusTiles('hunter'); // 22x14
    expect(wasp).toBeLessThan(hornet);
    expect(hornet).toBeLessThan(hunter);
  });

  it('unknown hull falls back to the medium-body default radius', () => {
    const unknown = getHullSelectionRingRadiusTiles('not-a-real-hull');
    const medium = getHullSelectionRingRadiusTiles('hunter'); // medium shape
    expect(unknown).toBeCloseTo(medium, 6);
  });

  it('medium ring is notably smaller than the old fixed 0.65-tile ellipse', () => {
    // The old detached look came from a single fixed 0.65-tile radius.
    expect(getHullSelectionRingRadiusTiles('hunter')).toBeLessThan(0.65);
  });

  it('radius matches the documented footprint formula', () => {
    // max(w,h)/2 in pixels → tiles (PROJ_TILE_W=76) * margin.
    // mammoth: max(32,22)/2 = 16 → 16/76 * margin.
    const PROJ_TILE_W = 76;
    const expected = (16 / PROJ_TILE_W) * SELECTION_RING_FOOTPRINT_MARGIN;
    expect(getHullSelectionRingRadiusTiles('mammoth')).toBeCloseTo(expected, 6);
  });
});

// ─── E: Hull direction mapping (grid/tile-space) — Denis truth map ──

describe('fixup-5: hull direction mapping (grid-space, Denis truth map)', () => {
  // Verified runtime source: vehicle.bodyAngle is grid/tile-space.
  // blockoutMovement.ts: worldX/worldY = tileToScreen(ftx,fty);
  //                      ftx += cos(bodyAngle), fty += sin(bodyAngle).
  // tileToScreen: x=(tx-ty)*38, y=(tx+ty)*19 →
  //   grid E (+tx) = screen bottom-right (SE) = dir4
  //   grid S (+ty) = screen bottom-left  (SW) = dir8
  //   grid W (-tx) = screen top-left     (NW) = dir12
  //   grid N (-ty) = screen top-right    (NE) = dir0

  it('grid East (angle 0) → dir4 (screen bottom-right)', () => {
    expect(gridBodyAngleToModularDir16(0)).toBe(4);
  });

  it('grid South (angle π/2) → dir8 (screen bottom-left)', () => {
    expect(gridBodyAngleToModularDir16(Math.PI / 2)).toBe(8);
  });

  it('grid West (angle π) → dir12 (screen top-left)', () => {
    expect(gridBodyAngleToModularDir16(Math.PI)).toBe(12);
  });

  it('grid North (angle -π/2) → dir0 (screen top-right)', () => {
    expect(gridBodyAngleToModularDir16(-Math.PI / 2)).toBe(0);
  });

  it('normalizes overflow angles', () => {
    expect(gridBodyAngleToModularDir16(2 * Math.PI)).toBe(4); // == angle 0
  });
});

// ─── E: Turret direction mapping (screen-space) — Denis truth map ───

describe('fixup-5: turret direction mapping (screen-space, Denis truth map)', () => {
  // Verified runtime source: turret aim angle is screen-space.
  // GameScene.updateArenaTurretAiming: desiredAngle =
  //   angleFromTo(turretMountScreen, targetCenterScreen) = atan2 of screen
  //   deltas (Phaser y-down). So the turret uses screenAngleToModularDir16.
  //   screen top-right (NE) = atan2(-,+) = -π/4 → dir0
  //   screen bottom-right (SE) = +π/4 → dir4
  //   screen bottom-left  (SW) = +3π/4 → dir8
  //   screen top-left     (NW) = -3π/4 → dir12

  it('screen NE (-π/4) → dir0', () => {
    expect(screenAngleToModularDir16(-Math.PI / 4)).toBe(0);
  });

  it('screen SE (π/4) → dir4', () => {
    expect(screenAngleToModularDir16(Math.PI / 4)).toBe(4);
  });

  it('screen SW (3π/4) → dir8', () => {
    expect(screenAngleToModularDir16(3 * Math.PI / 4)).toBe(8);
  });

  it('screen NW (-3π/4) → dir12', () => {
    expect(screenAngleToModularDir16(-3 * Math.PI / 4)).toBe(12);
  });
});

describe('fixup-5: hull and turret mappings differ (split is real)', () => {
  it('same numeric angle maps to different dir16 for hull vs turret', () => {
    // angle 0: hull(grid)=dir4, turret(screen)=dir2 — must differ.
    expect(gridBodyAngleToModularDir16(0)).not.toBe(screenAngleToModularDir16(0));
  });

  it('hull rest grid-East and turret screen-aim agree only via their own offsets', () => {
    // Hull facing grid-East renders dir4 (SE). For the turret to render the
    // same SE frame it must receive the screen-space SE angle (π/4), not 0.
    expect(gridBodyAngleToModularDir16(0)).toBe(screenAngleToModularDir16(Math.PI / 4));
  });
});

// ─── G/H: Friendly fire remains off ─────────────────────────────────

describe('fixup-5: friendly fire remains off', () => {
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
  });

  it('same-team ally takes no cone damage', () => {
    const shooter = createBlockoutVehicle('wasp', 'flamethrower', 'cyan', 10, 10, Math.PI / 2, 120, 'ally');
    const ally = createBlockoutVehicle('wasp', 'smoky', 'cyan', 10, 12, Math.PI / 2, 120, 'ally');
    const vehicles = [shooter, ally];
    const sx = shooter.worldX + TEST_OFFSET.x;
    const sy = shooter.worldY + TEST_OFFSET.y;
    const targets = findConeTargets(shooter, vehicles, sx, sy, Math.PI / 2, 300, 45, TEST_OFFSET);
    expect(targets.some(t => t.id === ally.id)).toBe(false);
  });

  it('shooter self-damage still excluded by default (selfDamageScale === 0)', () => {
    const shooter = createBlockoutVehicle('wasp', 'smoky', 'cyan', 10, 10, Math.PI / 2, 120, 'ally');
    const vehicles = [shooter];
    const sx = shooter.worldX + TEST_OFFSET.x;
    const sy = shooter.worldY + TEST_OFFSET.y;
    const target = findDirectHitTarget(shooter, vehicles, sx, sy, 0, 300, 50, TEST_OFFSET);
    expect(target).toBeNull();
  });
});

// ─── B/H: gray marker source is render-state gated, not a new debug flag ──

describe('fixup-5: default debug render flags (gray marker)', () => {
  beforeEach(() => {
    resetDebugRenderFlags();
  });

  it('no new debug flag was needed — defaults unchanged', () => {
    // The stray gray barrel line is gated by hasGenTurret (render state), so no
    // new debug flag is introduced. Confirm the existing default contract holds.
    expect(areAllDebugRenderFlagsOff()).toBe(true);
  });

  it('debug-only artifact flags default false', () => {
    expect(debugRenderFlags.directionArrow).toBe(false);
    expect(debugRenderFlags.aimLine).toBe(false);
    expect(debugRenderFlags.mountPoints).toBe(false);
    expect(debugRenderFlags.targetLockIndicator).toBe(false);
    expect(debugRenderFlags.enemyTeamIndicator).toBe(false);
    expect(debugRenderFlags.obstacleGeometry).toBe(false);
  });
});
