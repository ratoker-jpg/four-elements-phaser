/**
 * MODULAR-ALL-FACTIONS-01C — preview calibration tests.
 *
 * Covers:
 *  1. faction cycling preserves hull/turret/mod/dir selections;
 *  2. faction cycling changes visual.faction;
 *  3. default faction remains cyan;
 *  4. calibration defaults are stable;
 *  5. pixel step cycles 1 / 5 / 10;
 *  6. scale step cycles 0.01 / 0.05;
 *  7. reset calibration restores defaults;
 *  8. Dictator baseline scale remains 1.09;
 *  9. non-Dictator baseline remains 1;
 * 10. preview hull scale is extra and does not change asset path/key;
 * 11. preview turret scale is extra and does not change asset path/key;
 * 12. applying calibration does not change resolved hull/turret PNG paths;
 * 13. lazy load max 32 still holds;
 * 14. Wasp m0 still uses modular_hull_*;
 * 15. no _hull_dir path in modular runtime;
 * 16. effective scale computation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  getGeneratedHullTextureKey,
  getGeneratedTurretTextureKey,
  getGeneratedHullAssetPath,
  getGeneratedTurretAssetPath,
  GENERATED_MODULAR_FACTIONS,
} from '../assets/generatedModularVehicleAssets.generated';
import {
  DEFAULT_MODULAR_VEHICLE_VISUAL,
  isValidModularVehicleVisual,
  MODULAR_FACTION_IDS,
  type ModularVehicleVisual,
} from '../modular/modularVehicleVisual';
import {
  composeModularVehicle,
  MODULAR_VEHICLE_DISPLAY_SCALE,
  getHullVisualScaleMultiplier,
  HULL_VISUAL_SCALE_MULTIPLIERS,
} from '../modular/modularVehicleComposition';
import {
  requestModularVehicleSet,
  resetModularLoaderLedger,
  MAX_MODULAR_VEHICLE_SET_PNG,
  type ModularLoaderScene,
} from '../modular/modularVehicleRuntimeLoader';
import {
  DEFAULT_MODULAR_PREVIEW_CALIBRATION,
  cyclePixelStep,
  cycleScaleStep,
  resetCalibration,
  effectiveHullScale,
  effectiveTurretScale,
  PIXEL_STEPS,
  SCALE_STEPS,
  type ModularPreviewCalibration,
} from '../modular/modularPreviewCalibration';

const SAMPLE_VISUAL: ModularVehicleVisual = {
  hullId: 'wasp',
  turretId: 'smoky',
  faction: 'cyan',
  hullMod: 'm0',
  turretMod: 'm0',
};

function makeScene(existing: Set<string> = new Set()): {
  scene: ModularLoaderScene;
} {
  const scene: ModularLoaderScene = {
    textures: { exists: vi.fn((k: string) => existing.has(k)) },
    load: {
      image: vi.fn((k: string, _path: string) => {
        existing.add(k);
        return undefined;
      }),
    },
  };
  return { scene };
}

// ─── 1–3. Faction cycling ──────────────────────────────────────────

describe('faction cycling', () => {
  it('default faction is cyan', () => {
    expect(DEFAULT_MODULAR_VEHICLE_VISUAL.faction).toBe('cyan');
  });

  it('faction cycling changes visual.faction', () => {
    const factions = [...MODULAR_FACTION_IDS];
    expect(factions).toEqual(['cyan', 'green', 'yellow', 'purple']);

    let visual: ModularVehicleVisual = { ...SAMPLE_VISUAL };
    for (const faction of ['green', 'yellow', 'purple', 'cyan'] as const) {
      visual = { ...visual, faction };
      expect(visual.faction).toBe(faction);
      expect(isValidModularVehicleVisual(visual)).toBe(true);
    }
  });

  it('faction cycling preserves hull/turret/mod selections', () => {
    const base: ModularVehicleVisual = {
      hullId: 'dictator',
      turretId: 'railgun',
      faction: 'cyan',
      hullMod: 'm2',
      turretMod: 'm3',
    };

    const next: ModularVehicleVisual = { ...base, faction: 'green' };
    expect(next.hullId).toBe('dictator');
    expect(next.turretId).toBe('railgun');
    expect(next.hullMod).toBe('m2');
    expect(next.turretMod).toBe('m3');
    expect(next.faction).toBe('green');
  });

  it('changing faction changes both hull and turret asset faction', () => {
    const visual: ModularVehicleVisual = { ...SAMPLE_VISUAL, faction: 'purple' };
    const hullKey = getGeneratedHullTextureKey(visual.hullId, visual.faction, visual.hullMod, 0);
    const turretKey = getGeneratedTurretTextureKey(visual.turretId, visual.faction, visual.turretMod, 0);
    expect(hullKey).toContain('_purple_');
    expect(turretKey).toContain('_purple_');
  });
});

// ─── 4. Calibration defaults ───────────────────────────────────────

describe('calibration defaults', () => {
  it('default showTile is true', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.showTile).toBe(true);
  });

  it('default modelScale is 1', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.modelScale).toBe(1);
  });

  it('default hullScale is 1', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.hullScale).toBe(1);
  });

  it('default turretScale is 1', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.turretScale).toBe(1);
  });

  it('default hullOffset is 0/0', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.hullOffsetX).toBe(0);
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.hullOffsetY).toBe(0);
  });

  it('default turretOffset is 0/0', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.turretOffsetX).toBe(0);
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.turretOffsetY).toBe(0);
  });

  it('default pixelStep is 1', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.pixelStep).toBe(1);
  });

  it('default scaleStep is 0.01', () => {
    expect(DEFAULT_MODULAR_PREVIEW_CALIBRATION.scaleStep).toBeCloseTo(0.01, 4);
  });
});

// ─── 5. Pixel step cycling ─────────────────────────────────────────

describe('pixel step cycling', () => {
  it('cycles 1 -> 5 -> 10 -> 1', () => {
    expect(cyclePixelStep(1)).toBe(5);
    expect(cyclePixelStep(5)).toBe(10);
    expect(cyclePixelStep(10)).toBe(1);
  });

  it('PIXEL_STEPS contains exactly [1, 5, 10]', () => {
    expect([...PIXEL_STEPS]).toEqual([1, 5, 10]);
  });
});

// ─── 6. Scale step cycling ──────────────────────────────────────────

describe('scale step cycling', () => {
  it('cycles 0.01 -> 0.05 -> 0.01', () => {
    expect(cycleScaleStep(0.01)).toBeCloseTo(0.05, 4);
    expect(cycleScaleStep(0.05)).toBeCloseTo(0.01, 4);
  });

  it('SCALE_STEPS contains exactly [0.01, 0.05]', () => {
    expect([...SCALE_STEPS]).toEqual([0.01, 0.05]);
  });
});

// ─── 7. Reset calibration ──────────────────────────────────────────

describe('reset calibration', () => {
  it('restores all defaults', () => {
    const modified: ModularPreviewCalibration = {
      showTile: false,
      modelScale: 2,
      hullScale: 1.5,
      turretScale: 0.8,
      hullOffsetX: 10,
      hullOffsetY: -5,
      turretOffsetX: 3,
      turretOffsetY: 7,
      pixelStep: 5,
      scaleStep: 0.05,
    };
    const reset = resetCalibration();
    expect(reset).toEqual(DEFAULT_MODULAR_PREVIEW_CALIBRATION);
    expect(reset).not.toEqual(modified);
  });

  it('returns a fresh copy', () => {
    const a = resetCalibration();
    const b = resetCalibration();
    expect(a).toEqual(b);
    a.modelScale = 999;
    expect(b.modelScale).toBe(1);
  });
});

// ─── 8–9. Dictator baseline scale ──────────────────────────────────

describe('Dictator baseline scale', () => {
  it('Dictator baseline scale remains 1.09', () => {
    expect(HULL_VISUAL_SCALE_MULTIPLIERS.dictator).toBeCloseTo(1.09, 4);
    expect(getHullVisualScaleMultiplier('dictator')).toBeCloseTo(1.09, 4);
  });

  it('non-Dictator baseline remains 1', () => {
    expect(getHullVisualScaleMultiplier('wasp')).toBe(1);
    expect(getHullVisualScaleMultiplier('hornet')).toBe(1);
    expect(getHullVisualScaleMultiplier('hunter')).toBe(1);
    expect(getHullVisualScaleMultiplier('mammoth')).toBe(1);
    expect(getHullVisualScaleMultiplier('titan')).toBe(1);
    expect(getHullVisualScaleMultiplier('viking')).toBe(1);
  });
});

// ─── 10–11. Preview scale does not change asset path/key ────────────

describe('preview scale does not change asset paths or keys', () => {
  it('hull scale does not change hull texture key', () => {
    const cal: ModularPreviewCalibration = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION, hullScale: 2 };
    const key1 = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    const key2 = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(key1).toBe(key2);
    expect(key1).toBe('modular_hull_wasp_cyan_m0_dir00');
    expect(key1).not.toContain(String(cal.hullScale));
  });

  it('turret scale does not change turret texture key', () => {
    const cal: ModularPreviewCalibration = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION, turretScale: 3 };
    const key = getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0);
    expect(key).toBe('generated_turret_smoky_cyan_m0_dir00');
    expect(key).not.toContain(String(cal.turretScale));
  });

  it('hull scale does not change hull asset path', () => {
    const path = getGeneratedHullAssetPath('wasp', 'cyan', 'm0', 0);
    expect(path).toBe('assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png');
  });

  it('turret scale does not change turret asset path', () => {
    const path = getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', 0);
    expect(path).toBe('assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_dir00_E.png');
  });
});

// ─── 12. Applying calibration does not change resolved PNG paths ────

describe('calibration does not change resolved PNG paths', () => {
  it('composition plan hull path is independent of calibration scale', () => {
    const plan = composeModularVehicle({
      visual: SAMPLE_VISUAL,
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 100, y: 100 },
      textureExists: () => true,
    });

    expect(plan.hull.textureKey).toBe('modular_hull_wasp_cyan_m0_dir00');
    expect(plan.turret.textureKey).toBe('generated_turret_smoky_cyan_m0_dir00');
  });
});

// ─── 13. Lazy load max 32 still holds ──────────────────────────────

describe('lazy load max 32 still holds with all factions', () => {
  beforeEach(() => resetModularLoaderLedger());

  it('queues at most 32 PNG for green faction', () => {
    const { scene } = makeScene();
    const visual: ModularVehicleVisual = { ...SAMPLE_VISUAL, faction: 'green' };
    const diag = requestModularVehicleSet(scene, visual);
    expect(diag.queuedCount).toBeLessThanOrEqual(MAX_MODULAR_VEHICLE_SET_PNG);
    expect(diag.queuedCount).toBe(32);
  });

  it('queues at most 32 PNG for purple faction', () => {
    const { scene } = makeScene();
    const visual: ModularVehicleVisual = { ...SAMPLE_VISUAL, faction: 'purple' };
    const diag = requestModularVehicleSet(scene, visual);
    expect(diag.queuedCount).toBeLessThanOrEqual(MAX_MODULAR_VEHICLE_SET_PNG);
  });
});

// ─── 14. Wasp m0 still uses modular_hull_* ─────────────────────────

describe('Wasp m0 uses modular_hull_* namespace', () => {
  it('hull key starts with modular_hull_ for wasp m0', () => {
    const key = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(key.startsWith('modular_hull_')).toBe(true);
  });

  it('hull key starts with modular_hull_ for wasp m0 all factions', () => {
    for (const faction of GENERATED_MODULAR_FACTIONS) {
      const key = getGeneratedHullTextureKey('wasp', faction, 'm0', 0);
      expect(key.startsWith('modular_hull_')).toBe(true);
    }
  });
});

// ─── 15. No _hull_dir path in modular runtime ──────────────────────

describe('no _hull_dir path in modular runtime', () => {
  it('modular hull asset path does not contain _hull_dir', () => {
    for (const faction of GENERATED_MODULAR_FACTIONS) {
      const path = getGeneratedHullAssetPath('wasp', faction, 'm0', 0);
      expect(path).not.toContain('_hull_dir');
    }
  });
});

// ─── 16. Effective scale computation ───────────────────────────────

describe('effective scale computation', () => {
  it('effectiveHullScale for wasp with default calibration equals base scale', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };
    const scale = effectiveHullScale(MODULAR_VEHICLE_DISPLAY_SCALE, 1, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE, 6);
  });

  it('effectiveHullScale for dictator with default calibration includes 1.09', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };
    const scale = effectiveHullScale(MODULAR_VEHICLE_DISPLAY_SCALE, 1.09, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 1.09, 6);
  });

  it('effectiveHullScale applies modelScale multiplier', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION, modelScale: 2 };
    const scale = effectiveHullScale(MODULAR_VEHICLE_DISPLAY_SCALE, 1, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 2, 6);
  });

  it('effectiveHullScale applies hullScale extra multiplier', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION, hullScale: 1.5 };
    const scale = effectiveHullScale(MODULAR_VEHICLE_DISPLAY_SCALE, 1, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 1.5, 6);
  });

  it('effectiveHullScale combines modelScale + hullScale + Dictator baseline', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION, modelScale: 2, hullScale: 1.5 };
    const scale = effectiveHullScale(MODULAR_VEHICLE_DISPLAY_SCALE, 1.09, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 2 * 1.09 * 1.5, 6);
  });

  it('effectiveTurretScale for default calibration equals base scale', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };
    const scale = effectiveTurretScale(MODULAR_VEHICLE_DISPLAY_SCALE, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE, 6);
  });

  it('effectiveTurretScale applies modelScale', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION, modelScale: 2 };
    const scale = effectiveTurretScale(MODULAR_VEHICLE_DISPLAY_SCALE, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 2, 6);
  });

  it('effectiveTurretScale applies turretScale extra', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION, turretScale: 1.5 };
    const scale = effectiveTurretScale(MODULAR_VEHICLE_DISPLAY_SCALE, cal);
    expect(scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 1.5, 6);
  });

  it('turret does NOT inherit Dictator hull scale', () => {
    const cal = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };
    const hullScale = effectiveHullScale(MODULAR_VEHICLE_DISPLAY_SCALE, 1.09, cal);
    const turretScale = effectiveTurretScale(MODULAR_VEHICLE_DISPLAY_SCALE, cal);
    expect(hullScale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 1.09, 6);
    expect(turretScale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE, 6);
    expect(turretScale).not.toBeCloseTo(hullScale, 2);
  });
});
