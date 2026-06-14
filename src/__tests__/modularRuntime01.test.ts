/**
 * MODULAR-RUNTIME-01 — clean modular cyan vehicle runtime tests.
 *
 * Covers:
 *  1. generated modular registry contains expected hull/turret/mod/dir ids;
 *  2. texture key/path builders match the package convention;
 *  3. hullMod and turretMod are independent;
 *  4. one selected modular vehicle queues no more than 32 PNG;
 *  5. loader does not queue all modular assets;
 *  6. missing texture/metadata returns safe fallback diagnostics;
 *  7. pure composition aligns turret pivot to hull socket using metadata;
 *  8. default composition does not rely on zHeight/manual offsets;
 *  9. devtools selector defaults to a valid modular visual.
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
  type ModularVehicleVisual,
} from '../modular/modularVehicleVisual';
import {
  composeModularVehicle,
  MODULAR_FRAME_SIZE,
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
  it('has cyan as the only faction', () => {
    expect([...GENERATED_MODULAR_FACTIONS]).toEqual(['cyan']);
  });
  it('has m0..m3 mods', () => {
    expect([...GENERATED_MODULAR_MODS]).toEqual(['m0', 'm1', 'm2', 'm3']);
  });
});

// ─── 2. Key/path builders match package convention ─────────────────

describe('texture key and path builders', () => {
  it('builds hull keys as modular_hull_<hull>_<faction>_<mod>_dirNN', () => {
    // MODULAR-RUNTIME-02A: modular hull keys use the `modular_hull_` prefix so
    // they never collide with the legacy `generated_hull_` arena preload.
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
  it('builds hull paths matching the imported package layout', () => {
    expect(getGeneratedHullAssetPath('wasp', 'cyan', 'm0', 0)).toBe(
      'assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png',
    );
  });
  it('builds turret paths matching the imported package layout', () => {
    expect(getGeneratedTurretAssetPath('smoky', 'cyan', 'm0', 4)).toBe(
      'assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_dir04_S.png',
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
    // The full matrix would be 1088 PNG. A single set must be far smaller.
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

  it('MODULAR-RUNTIME-02A: queues modular hull keys even when legacy generated_hull_* keys already exist', () => {
    // Simulate the legacy arena preload (PreloadScene -> loadArenaVisualAssets)
    // having populated the shared Phaser TextureManager with the legacy
    // `generated_hull_wasp_cyan_m0_dirNN` keys (the oversized `_hull_dir` crops).
    // The modular loader must NOT treat those as its own keys, so it must still
    // queue all 16 `modular_hull_*` keys and load the correct modular PNGs.
    const legacyKeys = new Set<string>();
    for (let d = 0; d < 16; d++) {
      legacyKeys.add(`generated_hull_wasp_cyan_m0_dir${String(d).padStart(2, '0')}`);
    }
    const { scene } = makeScene(legacyKeys);
    const diag = requestModularVehicleSet(scene, SAMPLE_VISUAL);

    const modularHullKeys = diag.queuedKeys.filter((k) => k.startsWith('modular_hull_'));
    expect(modularHullKeys.length).toBe(16);
    // The pre-existing legacy keys are not mistaken for available modular keys.
    expect(diag.alreadyAvailableKeys).not.toContain('generated_hull_wasp_cyan_m0_dir00');
    // No legacy `_hull_dir` path and no legacy key prefix is queued by the modular loader.
    for (const k of diag.queuedKeys) {
      expect(k).not.toContain('_hull_dir');
      expect(k.startsWith('generated_hull_')).toBe(false);
    }
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
  it('default is the wasp+smoky cyan demo (not hardcoded as the only option)', () => {
    expect(DEFAULT_MODULAR_VEHICLE_VISUAL.hullId).toBe('wasp');
    expect(DEFAULT_MODULAR_VEHICLE_VISUAL.turretId).toBe('smoky');
    // ...but the full id space is available for selection.
    expect(MODULAR_HULL_IDS.length).toBe(7);
    expect(MODULAR_TURRET_IDS.length).toBe(10);
  });
  it('modLevelToModularMod clamps numeric levels', () => {
    expect(modLevelToModularMod(0)).toBe('m0');
    expect(modLevelToModularMod(3)).toBe('m3');
    expect(modLevelToModularMod(9)).toBe('m3');
    expect(modLevelToModularMod(-2)).toBe('m0');
  });
});
