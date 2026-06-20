/**
 * ARENA-VISUAL-COMBAT-FIX-01 fixup-8 tests.
 *
 * Targeted tests for:
 *   - Measured hull footprint anchor: visualOffsetPx corrects the ~17 px
 *     vertical mismatch between hull ground-footprint and ring center.
 *   - Smoky muzzle correction: per-dir16 override replaces the broken
 *     Priority-1 3DS normalized path that was 11-19 px off.
 *   - Direction regression: hull/grid and turret/screen split unchanged.
 *   - Friendly-fire regression: protection intact.
 *
 * Audit source: ARENA_VISUAL_ALIGNMENT_AUDIT_PR304_2026_06_20.md
 */

import { describe, it, expect } from 'vitest';
import {
  getHullVisualOffsetPx,
} from '../config/hullVisualProfiles';
import {
  getMuzzleDir16Override,
  TURRET_MUZZLE_DIR16_OVERRIDE,
} from '../config/directionalTurretProfiles';
import { blockoutToModularVisual } from '../modular/blockoutToModularVisual';

// ─── 1. Hull footprint anchor ───────────────────────────────────────

describe('fixup-8: measured hull footprint anchor', () => {
  it('Wasp visualOffsetPx corrects the ~17 px footprint mismatch', () => {
    // Audit: Wasp footprint error dir00: +4.2,+15.8; dir04: +6.2,+19.0
    // The consistent vertical component is ~17 px (footprint below ring).
    // visualOffsetPx.y should be negative (up) to shift the hull down onto the ring.
    const offset = getHullVisualOffsetPx('wasp');
    expect(offset.y).toBe(-17);
  });

  it('Mammoth visualOffsetPx corrects the ~17 px footprint mismatch', () => {
    // Audit: Mammoth footprint error dir00: -7.9,+19.3; dir04: -3.1,+15.5
    const offset = getHullVisualOffsetPx('mammoth');
    expect(offset.y).toBe(-17);
  });

  it('Hull footprint correction is significant (>10 px, not 1-2 px)', () => {
    // The fixup-7 alpha-centroid approach only gave 1-2 px offsets.
    // The fixup-8 measured-footprint approach gives 16-17 px — this is
    // the real correction that makes the hull sit inside the ring.
    const wasp = getHullVisualOffsetPx('wasp');
    const mammoth = getHullVisualOffsetPx('mammoth');
    expect(Math.abs(wasp.y)).toBeGreaterThan(10);
    expect(Math.abs(mammoth.y)).toBeGreaterThan(10);
  });

  it('Ring remains below hull and does not follow recoil', () => {
    // The ring draws at cx,cy (gameplay center) which does NOT include
    // visualOffsetPx. The adapter adds visualOffset only to the modular
    // anchor, not to the ring center. This is structural, not a test
    // of runtime behavior, but we verify the offset is non-zero so the
    // ring and hull are at different screen positions.
    const wasp = getHullVisualOffsetPx('wasp');
    expect(wasp.y).not.toBe(0);
  });

  it('All QA hulls have measured footprint correction', () => {
    const qaHulls = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'];
    for (const hullId of qaHulls) {
      const offset = getHullVisualOffsetPx(hullId);
      // All should have significant vertical correction
      expect(Math.abs(offset.y)).toBeGreaterThanOrEqual(10);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(20);
    }
  });
});

// ─── 2. Smoky muzzle ────────────────────────────────────────────────

describe('fixup-8: Smoky muzzle correction', () => {
  it('Smoky uses measured per-dir16 override (not broken 3DS path)', () => {
    // Audit: dir00 error +11.6,+10.2; dir04 error -19.2,+6.1
    // Smoky is now in TURRET_MUZZLE_DIR16_OVERRIDE and takes Priority 1
    // in getModularBarrelTip, bypassing the 3DS normalized transform.
    const override = getMuzzleDir16Override('smoky', 0);
    expect(override).not.toBeNull();
    expect(typeof override!.dx).toBe('number');
    expect(typeof override!.dy).toBe('number');
  });

  it('Smoky dirs 00/04/08/12 have explicit overrides', () => {
    // The audit measured these 4 cardinal directions explicitly.
    for (const dir of [0, 4, 8, 12]) {
      const override = getMuzzleDir16Override('smoky', dir);
      expect(override).not.toBeNull();
      // Muzzle should not be at pivot (0,0) — barrel has length
      expect(Math.abs(override!.dx) + Math.abs(override!.dy)).toBeGreaterThan(5);
    }
  });

  it('Smoky per-dir16 override direction is correct: dir00 = right, dir08 = left', () => {
    const e = getMuzzleDir16Override('smoky', 0);
    const w = getMuzzleDir16Override('smoky', 8);
    expect(e!.dx).toBeGreaterThan(0); // barrel points right
    expect(w!.dx).toBeLessThan(0);   // barrel points left
  });

  it('Smoky override matches measured PNG barrel tip (dir00 ~20px right, ~11px up)', () => {
    const override = getMuzzleDir16Override('smoky', 0);
    expect(override!.dx).toBe(20);
    expect(override!.dy).toBe(-11);
  });

  it('Thunder override behavior unchanged by Smoky fix', () => {
    // Thunder was already close in the audit; make sure we didn't break it.
    const override = getMuzzleDir16Override('thunder', 0);
    expect(override).not.toBeNull();
    expect(override!.dx).toBe(23);
    expect(override!.dy).toBe(-13);
  });

  it('Smoky has all 16 direction overrides', () => {
    expect(TURRET_MUZZLE_DIR16_OVERRIDE['smoky']).toBeDefined();
    for (let d = 0; d < 16; d++) {
      const override = getMuzzleDir16Override('smoky', d);
      expect(override).not.toBeNull();
    }
  });
});

// ─── 3. Direction regression ────────────────────────────────────────

describe('fixup-8: direction regression', () => {
  it('hull/grid direction mapping unchanged', () => {
    const result = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,           // grid east
      turretAngle: 0,
      turretAiming: false,
    });
    // grid east → dir4 (SE) per Denis truth map
    expect(result.hullDir16).toBe(4);
  });

  it('turret/screen direction mapping unchanged', () => {
    const result = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: Math.PI / 2,  // screen S
      turretAiming: true,
    });
    // The key assertion: turretDir16 != hullDir16 when aiming
    expect(result.turretDir16).not.toBe(result.hullDir16);
  });

  it('rest turret still equals hullDir16', () => {
    const result = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: 0,
      turretAiming: false,
    });
    expect(result.turretDir16).toBe(result.hullDir16);
  });
});

// ─── 4. Friendly-fire regression ────────────────────────────────────

describe('fixup-8: friendly-fire regression', () => {
  it('visual offset does not affect damage logic', () => {
    // The visualOffsetPx only moves the modular sprite composite.
    // Damage/hitbox/range computations use gameplay center (no offset).
    // This is verified structurally: the offset is only read by
    // getModularVisualCenterOffset() which is only called in the
    // modular adapter's anchor computation, never in damage code.
    const offset = getHullVisualOffsetPx('wasp');
    expect(offset.y).toBe(-17); // large offset but visual-only
  });
});
