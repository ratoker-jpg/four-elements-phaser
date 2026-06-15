/**
 * MODULAR-RUNTIME-04A — default modular render + normalized scale.
 *
 * Locks in:
 *   - one shared base scale source of truth (MODULAR_VEHICLE_BASE_SCALE);
 *   - preview default calibration produces the SAME effective scale as live
 *     runtime composition (no devtools calibration needed for parity);
 *   - modular PNG rendering is the DEFAULT runtime renderer
 *     (ENABLE_MODULAR_VEHICLE_RENDER default = true);
 *   - Dictator keeps +9% hull-only compensation; turret scale unchanged.
 */

import { describe, it, expect } from 'vitest';
import {
  composeModularVehicle,
  getHullVisualScaleMultiplier,
  MODULAR_VEHICLE_BASE_SCALE,
  MODULAR_VEHICLE_DISPLAY_SCALE,
} from '../modular/modularVehicleComposition';
import type { GeneratedModularDir16 } from '../assets/generatedModularVehicleAssets.generated';
import {
  DEFAULT_MODULAR_PREVIEW_CALIBRATION,
  effectiveHullScale,
  effectiveTurretScale,
} from '../modular/modularPreviewCalibration';
import { ENABLE_MODULAR_VEHICLE_RENDER } from '../phaser/render/ModularVehicleLiveAdapter';

const HULLS = ['wasp', 'hornet', 'hunter', 'viking', 'titan', 'mammoth', 'dictator'] as const;

function livePlan(hullId: (typeof HULLS)[number]) {
  return composeModularVehicle({
    visual: { hullId, turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
    hullDir16: 0 as GeneratedModularDir16,
    turretDir16: 0 as GeneratedModularDir16,
    anchor: { x: 300, y: 300 },
    textureExists: () => true,
  });
}

describe('MODULAR-RUNTIME-04A: shared scale source of truth', () => {
  it('base scale is 0.16 (accepted preview visual baked into the constant)', () => {
    expect(MODULAR_VEHICLE_BASE_SCALE).toBeCloseTo(0.16, 6);
  });

  it('the legacy display-scale alias equals the base scale', () => {
    expect(MODULAR_VEHICLE_DISPLAY_SCALE).toBe(MODULAR_VEHICLE_BASE_SCALE);
  });

  it('live composition renders non-dictator hull+turret at the base scale', () => {
    const plan = livePlan('wasp');
    expect(plan.hull.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
    expect(plan.turret.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
  });
});

describe('MODULAR-RUNTIME-04A: preview/live scale parity at default calibration', () => {
  it('preview default modelScale is neutral (1) so no calibration is needed for parity', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.modelScale).toBe(1);
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.hullScale).toBe(1);
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.turretScale).toBe(1);
  });

  it('preview effective scale equals live plan scale for every hull (default calibration)', () => {
    for (const hullId of HULLS) {
      const mult = getHullVisualScaleMultiplier(hullId);
      const plan = livePlan(hullId);

      const previewHull = effectiveHullScale(
        MODULAR_VEHICLE_BASE_SCALE,
        mult,
        DEFAULT_MODULAR_PREVIEW_CALIBRATION,
      );
      const previewTurret = effectiveTurretScale(
        MODULAR_VEHICLE_BASE_SCALE,
        DEFAULT_MODULAR_PREVIEW_CALIBRATION,
      );

      expect(previewHull).toBeCloseTo(plan.hull.scale, 6);
      expect(previewTurret).toBeCloseTo(plan.turret.scale, 6);
    }
  });
});

describe('MODULAR-RUNTIME-04A: Dictator +9% hull-only', () => {
  it('Dictator hull is base * 1.09 and turret stays at base', () => {
    const plan = livePlan('dictator');
    expect(plan.hull.scale).toBeCloseTo(MODULAR_VEHICLE_BASE_SCALE * 1.09, 6);
    expect(plan.turret.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
  });

  it('only Dictator carries a hull multiplier; all others are 1', () => {
    for (const hullId of HULLS) {
      const expected = hullId === 'dictator' ? 1.09 : 1;
      expect(getHullVisualScaleMultiplier(hullId)).toBeCloseTo(expected, 6);
    }
  });
});

describe('MODULAR-RUNTIME-04A: modular PNG is the default runtime renderer', () => {
  it('ENABLE_MODULAR_VEHICLE_RENDER defaults to true', () => {
    expect(ENABLE_MODULAR_VEHICLE_RENDER).toBe(true);
  });
});
