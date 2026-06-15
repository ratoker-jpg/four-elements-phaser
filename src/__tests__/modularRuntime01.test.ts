/**
 * MODULAR-ALL-FACTIONS-01B — all-factions modular runtime tests.
 *
 * Covers:
 *  1. generated modular registry contains expected hull/turret/mod/dir/faction ids;
 *  2. texture key/path builders match the package convention;
 *  3. hullMod and turretMod are independent;
 *  4. one selected modular vehicle queues no more than 32 PNG;
 *  5. loader does not queue all modular assets;
 *  6. missing texture/metadata returns safe fallback diagnostics;
 *  7. pure composition aligns turret pivot to hull socket using metadata;
 *  8. default composition does not rely on zHeight/manual offsets;
 *  9. devtools selector defaults to a valid modular visual;
 * 10. all-factions support (cyan/green/yellow/purple);
 * 11. Dictator visual scale compensation;
 * 12. key namespace protection (modular_hull_* prefix).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  GENERATED_MODULAR_HULLS,
  GENERATED_MODULAR_TURRETS,
  GENERATED_MODULAR_FACTIONS,
  GENERATED_MODULAR_MODS,
  getGeneratedHullTextureKey,
  getGeneratedTurretTextureKey,
  getGeneratedHullAssetPath,
  getGeneratedTurretAssetPath,
  type GeneratedModularDir16,
} from '../assets/generatedModularVehicleAssets.generated';
import {
  DEFAULT_MODULAR_VEHICLE_VISUAL,
  isValidModularVehicleVisual,
  isCombinedPairId,
  withHullMod,
  withTurretMod,
  modLevelToModularMod,
  MODULAR_HULL_IDS,
  MODULAR_TURRET_IDS,
  MODULAR_FACTION_IDS,
  type ModularVehicleVisual,
} from '../modular/modularVehicleVisual';
import {
  composeModularVehicle,
  MODULAR_FRAME_SIZE,
  MODULAR_VEHICLE_BASE_SCALE,
  getHullVisualScaleMultiplier,
  HULL_VISUAL_SCALE_MULTIPLIERS,
} from '../modular/modularVehicleComposition';
import {
  requestModularVehicleSet,
  isModularVehicleSetLoaded,
  resetModularLoaderLedger,
  wasModularVehicleSetRequested,
  MAX_MODULAR_VEHICLE_SET_PNG,
  type ModularLoaderScene,
} from '../modular/modularVehicleRuntimeLoader';
import {
  getHullSocketAnchor,
  getTurretPivotAnchor,
} from '../modular/modularVehicleMetadata';
import {
  MODULAR_HULL_SOCKET_META,
  MODULAR_TURRET_PIVOT_META,
  MODULAR_HULL_SOCKET_ALL_FRAME_CENTERED,
  MODULAR_TURRET_PIVOT_ALL_FRAME_CENTERED,
} from '../assets/generatedModularVehicleMetadata.generated';

const EXPECTED_HULLS = [
  'dictator', 'hornet', 'hunter', 'mammoth', 'titan', 'viking', 'wasp',
];
const EXPECTED_TURRETS = [
  'firebird', 'freeze', 'hammer', 'isida', 'railgun', 'ricochet',
  'smoky', 'thunder', 'twins', 'vulcan_b',
];
const EXPECTED_FACTIONS = ['cyan', 'green', 'yellow', 'purple'];
const EXPECTED_DIR_SUFFIXES = [
  'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE',
];

const SAMPLE_VISUAL: ModularVehicleVisual = {
  hullId: 'wasp',
  turretId: 'smoky',
  faction: 'cyan',
  hullMod: 'm0',
  turretMod: 'm0',
};

// ─── 1. Registry id coverage ────────────────────────────────────────

describe('generated modular registry ids', () => {
  it('contains all 7 expected hull ids', () => {
    expect([...GENERATED_MODULAR_HULLS].sort()).toEqual([...EXPECTED_HULLS].sort());
  });
  it('contains all 10 expected turret ids', () => {
    expect([...GENERATED_MODULAR_TURRETS].sort()).toEqual([...EXPECTED_TURRETS].sort());
  });
  it('has all 4 factions: cyan/green/yellow/purple', () => {
    expect([...GENERATED_MODULAR_FACTIONS]).toEqual(EXPECTED_FACTIONS);
  });
  it('has m0..m3 mods', () => {
    expect([...GENERATED_MODULAR_MODS]).toEqual(['m0', 'm1', 'm2', 'm3']);
  });
});

// ─── 2. Key/path builders match package convention ─────────────────

describe('texture key and path builders', () => {
  it('builds hull keys as modular_hull_<hull>_<faction>_<mod>_dirNN', () => {
    expect(getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0)).toBe(
      'modular_hull_wasp_cyan_m0_dir00',
    );
    expect(getGeneratedHullTextureKey('titan', 'cyan', 'm3', 15)).toBe(
      'modular_hull_titan_cyan_m3_dir15',
    );
  });
  it('builds turret keys as generated_turret_<turret>_<faction>_<mod>_dirNN', () => {
    expect(getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', 0)).toBe(
      'generated_turret_smoky_cyan_m0_dir00',
    );
  });
  it('builds hull keys with non-cyan factions', () => {
    expect(getGeneratedHullTextureKey('wasp', 'green', 'm0', 0)).toBe(
      'modular_hull_wasp_green_m0_dir00',
    );
    expect(getGeneratedHullTextureKey('dictator', 'purple', 'm3', 7)).toBe(
      'modular_hull_dictator_purple_m3_dir07',
    );
    expect(getGeneratedHullTextureKey('hunter', 'yellow', 'm1', 12)).toBe(
      'modular_hull_hunter_yellow_m1_dir12',
    );
  });
  it('builds turret keys with non-cyan factions', () => {
    expect(getGeneratedTurretTextureKey('smoky', 'green', 'm0', 0)).toBe(
      'generated_turret_smoky_green_m0_dir00',
    );
    expect(getGeneratedTurretTextureKey('railgun', 'purple', 'm2', 3)).toBe(
      'generated_turret_railgun_purple_m2_dir03',
    );
  });
  it('builds hull paths matching the imported package layout', () => {
    expect(getGeneratedHullAssetPath('wasp', 'cyan', 'm0', 0)).toBe(
      'assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png',
    );
    expect(getGeneratedHullAssetPath('dictator', 'green', 'm1', 4)).toBe(
      'assets/units/hulls/dictator/green/m1/dictator_green_m1_dir04_S.png',
    );
  });
  it('builds turret paths matching the imported package layout', () => {
    expect(getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', 4)).toBe(
      'assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_dir04_S.png',
    );
    expect(getGeneratedTurretAssetPath('twins', 'purple', 'm3', 8)).toBe(
      'assets/units/turrets/twins/purple/m3/twins_purple_m3_dir08_W.png',
    );
  });
  it('uses the expected compass suffix for every direction', () => {
    for (let d = 0; d < 16; d++) {
      const path = getGeneratedHullAssetPath('wasp', 'cyan', 'm0', d as GeneratedModularDir16);
      expect(path.endsWith(`_${EXPECTED_DIR_SUFFIXES[d]}.png`)).toBe(true);
    }
  });
});

// ─── 3. hullMod and turretMod independence ─────────────────────────

describe('hullMod and turretMod independence', () => {
  it('upgrading hullMod changes only the hull mod', () => {
    const next = withHullMod(SAMPLE_VISUAL, 'm2');
    expect(next.hullMod).toBe('m2');
    expect(next.turretMod).toBe(SAMPLE_VISUAL.turretMod);
    expect(next.hullId).toBe(SAMPLE_VISUAL.hullId);
    expect(next.turretId).toBe(SAMPLE_VISUAL.turretId);
  });
  it('upgrading turretMod changes only the turret mod', () => {
    const next = withTurretMod(SAMPLE_VISUAL, 'm3');
    expect(next.turretMod).toBe('m3');
    expect(next.hullMod).toBe(SAMPLE_VISUAL.hullMod);
  });
  it('changing turretId does not force a hullId change', () => {
    const next: ModularVehicleVisual = { ...SAMPLE_VISUAL, turretId: 'railgun' };
    expect(next.hullId).toBe('wasp');
    expect(isValidModularVehicleVisual(next)).toBe(true);
  });
  it('changing hullId does not force a turretId change', () => {
    const next: ModularVehicleVisual = { ...SAMPLE_VISUAL, hullId: 'mammoth' };
    expect(next.turretId).toBe('smoky');
    expect(isValidModularVehicleVisual(next)).toBe(true);
  });
  it('hull and turret keys move independently when mods differ', () => {
    const v: ModularVehicleVisual = { ...SAMPLE_VISUAL, hullMod: 'm1', turretMod: 'm3' };
    expect(getGeneratedHullTextureKey(v.hullId, v.faction, v.hullMod, 0)).toContain('_m1_');
    expect(getGeneratedTurretTextureKey(v.turretId, v.faction, v.turretMod, 0)).toContain('_m3_');
  });
  it('rejects combined hull×turret pair ids', () => {
    expect(isCombinedPairId('wasp_smoky_cyan_m0')).toBe(true);
    expect(isCombinedPairId('wasp_vulcan_b_cyan_m0')).toBe(true);
    expect(isCombinedPairId('wasp')).toBe(false);
    expect(isCombinedPairId('smoky')).toBe(false);
    expect(isCombinedPairId('vulcan_b')).toBe(false);
    expect(isCombinedPairId('vulcan')).toBe(false);
    expect(isCombinedPairId('b')).toBe(false);
  });
});

// ─── 4 & 5. Lazy loading bounds ────────────────────────────────────

function makeScene(existing: Set<string> = new Set()): {
  scene: ModularLoaderScene;
  queued: string[];
} {
  const queued: string[] = [];
  const scene: ModularLoaderScene = {
    textures: { exists: vi.fn((k: string) => existing.has(k)) },
    load: {
      image: vi.fn((k: string, _path: string) => {
        queued.push(k);
        existing.add(k);
        return undefined;
      }),
    },
  };
  return { scene, queued };
}

describe('lazy loading bounds', () => {
  beforeEach(() => resetModularLoaderLedger());

  it('queues at most 32 PNG for one selected visual', () => {
    const { scene, queued } = makeScene();
    const diag = requestModularVehicleSet(scene, SAMPLE_VISUAL);
    expect(diag.queuedCount).toBeLessThanOrEqual(MAX_MODULAR_VEHICLE_SET_PNG);
    expect(diag.queuedCount).toBe(32);
    expect(queued.length).toBe(32);
  });

  it('queues exactly 16 hull + 16 turret keys', () => {
    const { scene } = makeScene();
    const diag = requestModularVehicleSet(scene, SAMPLE_VISUAL);
    const hullKeys = diag.queuedKeys.filter((k) => k.startsWith('modular_hull_'));
    const turretKeys = diag.queuedKeys.filter((k) => k.startsWith('generated_turret_'));
    expect(hullKeys.length).toBe(16);
    expect(turretKeys.length).toBe(16);
  });

  it('does not queue all modular assets (only the selected set)', () => {
    const { scene, queued } = makeScene();
    requestModularVehicleSet(scene, SAMPLE_VISUAL);
    // The full matrix would be 4352 PNG. A single set must be far smaller.
    expect(queued.length).toBeLessThan(64);
    // All queued keys belong to the selected hull/turret only.
    for (const k of queued) {
      expect(k.includes('wasp') || k.includes('smoky')).toBe(true);
    }
  });

  it('skips already-available textures', () => {
    const pre = new Set([getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0)]);
    const { scene } = makeScene(pre);
    const diag = requestModularVehicleSet(scene, SAMPLE_VISUAL);
    expect(diag.queuedCount).toBe(31);
    expect(diag.alreadyAvailableKeys).toContain(
      getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0),
    );
  });

  it('records the requested set in the ledger', () => {
    const { scene } = makeScene();
    expect(wasModularVehicleSetRequested(SAMPLE_VISUAL)).toBe(false);
    requestModularVehicleSet(scene, SAMPLE_VISUAL);
    expect(wasModularVehicleSetRequested(SAMPLE_VISUAL)).toBe(true);
  });

  it('does not re-queue the same requested set twice before textures exist', () => {
    const queued: string[] = [];
    const scene: ModularLoaderScene = {
      textures: { exists: vi.fn(() => false) },
      load: {
        image: vi.fn((key: string, _path: string) => {
          queued.push(key);
          return undefined;
        }),
      },
    };

    const first = requestModularVehicleSet(scene, SAMPLE_VISUAL);
    const second = requestModularVehicleSet(scene, SAMPLE_VISUAL);

    expect(first.queuedCount).toBe(32);
    expect(first.alreadyRequested).toBe(false);
    expect(second.queuedCount).toBe(0);
    expect(second.queuedKeys).toEqual([]);
    expect(second.alreadyRequested).toBe(true);
    expect(second.fullSetRequested).toBe(true);
    expect(queued.length).toBe(32);
    expect(scene.load.image).toHaveBeenCalledTimes(32);
  });

  it('reports set loaded only when all 32 keys exist', () => {
    const { scene } = makeScene();
    expect(isModularVehicleSetLoaded(scene, SAMPLE_VISUAL)).toBe(false);
    requestModularVehicleSet(scene, SAMPLE_VISUAL);
    expect(isModularVehicleSetLoaded(scene, SAMPLE_VISUAL)).toBe(true);
  });

  it('no all-factions preload: selecting green faction queues only 32 PNG', () => {
    const { scene, queued } = makeScene();
    const greenVisual: ModularVehicleVisual = {
      hullId: 'wasp', turretId: 'smoky', faction: 'green', hullMod: 'm0', turretMod: 'm0',
    };
    const diag = requestModularVehicleSet(scene, greenVisual);
    expect(diag.queuedCount).toBe(32);
    expect(queued.length).toBe(32);
    // All keys are for green faction
    for (const k of queued) {
      expect(k.includes('green')).toBe(true);
    }
  });
});

// ─── 6. Fallback diagnostics ───────────────────────────────────────

describe('fallback diagnostics', () => {
  beforeEach(() => resetModularLoaderLedger());

  it('returns invalid-visual fallback for a bad visual without crashing', () => {
    const { scene } = makeScene();
    const bad = { ...SAMPLE_VISUAL, hullId: 'nope' } as unknown as ModularVehicleVisual;
    const diag = requestModularVehicleSet(scene, bad);
    expect(diag.valid).toBe(false);
    expect(diag.queuedCount).toBe(0);
    expect(diag.fallbackReason).toContain('invalid-visual');
  });

  it('composition reports missing textures as fallback, not a crash', () => {
    const plan = composeModularVehicle({
      visual: SAMPLE_VISUAL,
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 100, y: 100 },
      textureExists: () => false,
    });
    expect(plan.available).toBe(false);
    expect(plan.fallbackReason).toBe('hull-and-turret-texture-missing');
    expect(plan.hull.textureKey).toBeNull();
    expect(plan.turret.textureKey).toBeNull();
  });

  it('composition reports turret-only missing', () => {
    const plan = composeModularVehicle({
      visual: SAMPLE_VISUAL,
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 0, y: 0 },
      textureExists: (k) => k.startsWith('modular_hull_'),
    });
    expect(plan.fallbackReason).toBe('turret-texture-missing');
    expect(plan.hull.textureKey).not.toBeNull();
  });
});

// ─── 7 & 8. Metadata-driven composition, no zHeight/offset hacks ────

describe('metadata-driven composition', () => {
  it('all sockets and pivots are frame-centered (no offset tables)', () => {
    expect(MODULAR_HULL_SOCKET_ALL_FRAME_CENTERED).toBe(true);
    expect(MODULAR_TURRET_PIVOT_ALL_FRAME_CENTERED).toBe(true);
  });

  it('metadata exists for every hull/mod and turret/mod family', () => {
    expect(Object.keys(MODULAR_HULL_SOCKET_META).length).toBe(7 * 4);
    expect(Object.keys(MODULAR_TURRET_PIVOT_META).length).toBe(10 * 4);
  });

  it('socket/pivot normalized anchors are within [0,1]', () => {
    for (const id of EXPECTED_HULLS) {
      for (const mod of ['m0', 'm1', 'm2', 'm3'] as const) {
        const a = getHullSocketAnchor(id as never, mod, 0)!;
        expect(a.nx).toBeGreaterThanOrEqual(0);
        expect(a.nx).toBeLessThanOrEqual(1);
        expect(a.ny).toBeGreaterThanOrEqual(0);
        expect(a.ny).toBeLessThanOrEqual(1);
      }
    }
    const p = getTurretPivotAnchor('smoky', 'm0', 0)!;
    expect(p.nx).toBe(0.5);
    expect(p.ny).toBe(0.5);
  });

  it('aligns turret pivot exactly onto hull socket', () => {
    const plan = composeModularVehicle({
      visual: SAMPLE_VISUAL,
      hullDir16: 3,
      turretDir16: 9,
      anchor: { x: 640, y: 360 },
      textureExists: () => true,
    });
    expect(plan.pivotScreen.x).toBeCloseTo(plan.socketScreen.x, 6);
    expect(plan.pivotScreen.y).toBeCloseTo(plan.socketScreen.y, 6);
  });

  it('default composition places hull at the anchor with no manual offset', () => {
    const anchor = { x: 200, y: 150 };
    const plan = composeModularVehicle({
      visual: SAMPLE_VISUAL,
      hullDir16: 0,
      turretDir16: 0,
      anchor,
      textureExists: () => true,
    });
    // Hull centred on the anchor — no Wasp y-offset / zHeight nudge.
    expect(plan.hull.position).toEqual(anchor);
    expect(plan.hull.origin).toEqual({ x: 0.5, y: 0.5 });
    // Under the frame-centre policy the turret centre equals the hull centre.
    expect(plan.turret.position.x).toBeCloseTo(anchor.x, 6);
    expect(plan.turret.position.y).toBeCloseTo(anchor.y, 6);
  });

  it('keeps the turret pivot on the socket independent of hull and turret dir', () => {
    for (const hd of [0, 4, 8, 12]) {
      for (const td of [0, 5, 11, 15]) {
        const plan = composeModularVehicle({
          visual: SAMPLE_VISUAL,
          hullDir16: hd as GeneratedModularDir16,
          turretDir16: td as GeneratedModularDir16,
          anchor: { x: 300, y: 300 },
          textureExists: () => true,
        });
        expect(plan.pivotScreen.x).toBeCloseTo(plan.socketScreen.x, 6);
        expect(plan.pivotScreen.y).toBeCloseTo(plan.socketScreen.y, 6);
      }
    }
  });

  it('frame size is 512', () => {
    expect(MODULAR_FRAME_SIZE).toBe(512);
  });
});

// ─── Metadata derived from source manifests (frame-centre policy) ──

describe('generated metadata reflects the export socket/pivot policy', () => {
  it('hull socket normalized equals socketPixel/imageSize (256/512 = 0.5)', () => {
    // The export uses socketPixelPolicy = world_origin_projects_to_frame_center,
    // so 256/512 = 0.5 for every hull family and direction.
    for (const id of EXPECTED_HULLS) {
      const a = getHullSocketAnchor(id as never, 'm0', 0)!;
      expect(a.nx).toBeCloseTo(256 / 512, 5);
      expect(a.ny).toBeCloseTo(256 / 512, 5);
    }
  });
  it('turret pivot normalized equals pivotPixel/imageSize (256/512 = 0.5)', () => {
    for (const id of EXPECTED_TURRETS) {
      const p = getTurretPivotAnchor(id as never, 'm0', 0)!;
      expect(p.nx).toBeCloseTo(256 / 512, 5);
      expect(p.ny).toBeCloseTo(256 / 512, 5);
    }
  });
});

// ─── 9. Devtools selector default validity ─────────────────────────

describe('devtools selector default', () => {
  it('default modular visual is valid', () => {
    expect(isValidModularVehicleVisual(DEFAULT_MODULAR_VEHICLE_VISUAL)).toBe(true);
  });
  it('default is the wasp+smoky cyan m0 demo (not hardcoded as the only option)', () => {
    expect(DEFAULT_MODULAR_VEHICLE_VISUAL.hullId).toBe('wasp');
    expect(DEFAULT_MODULAR_VEHICLE_VISUAL.turretId).toBe('smoky');
    expect(DEFAULT_MODULAR_VEHICLE_VISUAL.faction).toBe('cyan');
    // ...but the full id space is available for selection.
    expect(MODULAR_HULL_IDS.length).toBe(7);
    expect(MODULAR_TURRET_IDS.length).toBe(10);
    expect(MODULAR_FACTION_IDS.length).toBe(4);
  });
  it('modLevelToModularMod clamps numeric levels', () => {
    expect(modLevelToModularMod(0)).toBe('m0');
    expect(modLevelToModularMod(3)).toBe('m3');
    expect(modLevelToModularMod(9)).toBe('m3');
    expect(modLevelToModularMod(-2)).toBe('m0');
  });
});

// ─── 10. All-factions support ───────────────────────────────────────

describe('all-factions support', () => {
  it('supports all 4 factions in GENERATED_MODULAR_FACTIONS', () => {
    expect(GENERATED_MODULAR_FACTIONS).toContain('cyan');
    expect(GENERATED_MODULAR_FACTIONS).toContain('green');
    expect(GENERATED_MODULAR_FACTIONS).toContain('yellow');
    expect(GENERATED_MODULAR_FACTIONS).toContain('purple');
    expect(GENERATED_MODULAR_FACTIONS.length).toBe(4);
  });

  it('each faction resolves to valid hull and turret paths', () => {
    for (const faction of EXPECTED_FACTIONS) {
      const hullPath = getGeneratedHullAssetPath('wasp', faction as never, 'm0', 0);
      expect(hullPath).toContain(`/${faction}/`);
      expect(hullPath).toContain(`wasp_${faction}_m0_dir00_E.png`);

      const turretPath = getGeneratedTurretAssetPath('smoky', faction as never, 'm0', 0);
      expect(turretPath).toContain(`/${faction}/`);
      expect(turretPath).toContain(`smoky_${faction}_m0_dir00_E.png`);
    }
  });

  it('default visual remains cyan', () => {
    expect(DEFAULT_MODULAR_VEHICLE_VISUAL.faction).toBe('cyan');
  });

  it('selecting green Wasp + Smoky produces valid green keys', () => {
    const greenVisual: ModularVehicleVisual = {
      hullId: 'wasp', turretId: 'smoky', faction: 'green', hullMod: 'm0', turretMod: 'm0',
    };
    expect(isValidModularVehicleVisual(greenVisual)).toBe(true);
    const hullKey = getGeneratedHullTextureKey('wasp', 'green', 'm0', 0);
    expect(hullKey).toBe('modular_hull_wasp_green_m0_dir00');
    const turretKey = getGeneratedTurretTextureKey('smoky', 'green', 'm0', 0);
    expect(turretKey).toBe('generated_turret_smoky_green_m0_dir00');
  });

  it('selecting purple Dictator + Railgun produces valid purple keys', () => {
    const purpleVisual: ModularVehicleVisual = {
      hullId: 'dictator', turretId: 'railgun', faction: 'purple', hullMod: 'm0', turretMod: 'm0',
    };
    expect(isValidModularVehicleVisual(purpleVisual)).toBe(true);
    const hullKey = getGeneratedHullTextureKey('dictator', 'purple', 'm0', 0);
    expect(hullKey).toBe('modular_hull_dictator_purple_m0_dir00');
    const turretKey = getGeneratedTurretTextureKey('railgun', 'purple', 'm0', 0);
    expect(turretKey).toBe('generated_turret_railgun_purple_m0_dir00');
  });

  it('changing faction changes both hull and turret asset faction', () => {
    const base: ModularVehicleVisual = { ...SAMPLE_VISUAL };
    const yellow: ModularVehicleVisual = { ...base, faction: 'yellow' };
    const hullKey = getGeneratedHullTextureKey(yellow.hullId, yellow.faction, yellow.hullMod, 0);
    const turretKey = getGeneratedTurretTextureKey(yellow.turretId, yellow.faction, yellow.turretMod, 0);
    expect(hullKey).toContain('yellow');
    expect(turretKey).toContain('yellow');
    // Hull and turret ids unchanged
    expect(yellow.hullId).toBe(base.hullId);
    expect(yellow.turretId).toBe(base.turretId);
  });

  it('registry all-factions counts: hull sets 112, turret sets 160', () => {
    const hullSets = GENERATED_MODULAR_HULLS.length * GENERATED_MODULAR_FACTIONS.length * GENERATED_MODULAR_MODS.length;
    expect(hullSets).toBe(112); // 7 * 4 * 4
    const turretSets = GENERATED_MODULAR_TURRETS.length * GENERATED_MODULAR_FACTIONS.length * GENERATED_MODULAR_MODS.length;
    expect(turretSets).toBe(160); // 10 * 4 * 4
  });

  it('registry all-factions counts: hull paths 1792, turret paths 2560', () => {
    const hullPaths = GENERATED_MODULAR_HULLS.length * GENERATED_MODULAR_FACTIONS.length * GENERATED_MODULAR_MODS.length * 16;
    expect(hullPaths).toBe(1792); // 7 * 4 * 4 * 16
    const turretPaths = GENERATED_MODULAR_TURRETS.length * GENERATED_MODULAR_FACTIONS.length * GENERATED_MODULAR_MODS.length * 16;
    expect(turretPaths).toBe(2560); // 10 * 4 * 4 * 16
  });

  it('supported factions exactly: cyan/green/yellow/purple', () => {
    const factions = [...GENERATED_MODULAR_FACTIONS];
    expect(factions).toEqual(['cyan', 'green', 'yellow', 'purple']);
  });
});

// ─── 11. Dictator visual scale compensation ─────────────────────────

describe('Dictator visual scale compensation', () => {
  it('getHullVisualScaleMultiplier("dictator") === 1.09', () => {
    expect(getHullVisualScaleMultiplier('dictator')).toBeCloseTo(1.09, 6);
  });

  it('all other hulls return 1', () => {
    for (const hullId of EXPECTED_HULLS) {
      if (hullId === 'dictator') continue;
      expect(getHullVisualScaleMultiplier(hullId)).toBe(1);
    }
  });

  it('Dictator multiplier is in HULL_VISUAL_SCALE_MULTIPLIERS', () => {
    expect(HULL_VISUAL_SCALE_MULTIPLIERS['dictator']).toBeCloseTo(1.09, 6);
  });

  it('Dictator hull visual scale is larger than display scale', () => {
    const plan = composeModularVehicle({
      visual: { hullId: 'dictator', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 300, y: 300 },
      textureExists: () => true,
    });
    // Hull scale should be base * 1.09 (MODULAR-RUNTIME-04A base = 0.16)
    expect(plan.hull.scale).toBeCloseTo(MODULAR_VEHICLE_BASE_SCALE * 1.09, 6);
    // Turret scale should be the normal base scale
    expect(plan.turret.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
  });

  it('Dictator hull displaySize is larger than turret displaySize', () => {
    const plan = composeModularVehicle({
      visual: { hullId: 'dictator', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 300, y: 300 },
      textureExists: () => true,
    });
    expect(plan.hull.displaySize).toBeGreaterThan(plan.turret.displaySize);
    expect(plan.hull.displaySize).toBeCloseTo(512 * MODULAR_VEHICLE_BASE_SCALE * 1.09, 6);
    expect(plan.turret.displaySize).toBe(512 * MODULAR_VEHICLE_BASE_SCALE);
  });

  it('Dictator turret pivot still lands on hull socket (stable alignment)', () => {
    for (const dir of [0, 3, 7, 11, 15]) {
      const plan = composeModularVehicle({
        visual: { hullId: 'dictator', turretId: 'railgun', faction: 'purple', hullMod: 'm3', turretMod: 'm3' },
        hullDir16: dir as GeneratedModularDir16,
        turretDir16: dir as GeneratedModularDir16,
        anchor: { x: 400, y: 400 },
        textureExists: () => true,
      });
      expect(plan.pivotScreen.x).toBeCloseTo(plan.socketScreen.x, 6);
      expect(plan.pivotScreen.y).toBeCloseTo(plan.socketScreen.y, 6);
    }
  });

  it('Dictator scale compensation does not affect turret scale', () => {
    const plan = composeModularVehicle({
      visual: { hullId: 'dictator', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 300, y: 300 },
      textureExists: () => true,
    });
    expect(plan.turret.scale).toBe(MODULAR_VEHICLE_BASE_SCALE);
  });
});

// ─── 12. Key namespace protection ───────────────────────────────────

describe('key namespace protection', () => {
  it('modular hull key starts with modular_hull_', () => {
    const key = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(key.startsWith('modular_hull_')).toBe(true);
  });

  it('modular hull key differs from legacy generated hull key', () => {
    const modularKey = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    // Legacy key format would be: generated_hull_wasp_cyan_m0_dir00
    expect(modularKey).not.toBe('generated_hull_wasp_cyan_m0_dir00');
    expect(modularKey).toBe('modular_hull_wasp_cyan_m0_dir00');
  });

  it('Wasp m0 modular key remains modular_hull_wasp_cyan_m0_dir00', () => {
    expect(getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0)).toBe(
      'modular_hull_wasp_cyan_m0_dir00',
    );
  });

  it('no _hull_dir path in modular runtime', () => {
    const hullPath = getGeneratedHullAssetPath('wasp', 'cyan', 'm0', 0);
    expect(hullPath).not.toContain('_hull_dir');
    // Path should be: assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png
    expect(hullPath).toContain('wasp_cyan_m0_dir00_E.png');
  });
});
