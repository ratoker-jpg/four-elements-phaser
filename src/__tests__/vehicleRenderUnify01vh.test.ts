/**
 * VEHICLE-RENDER-UNIFY-01-VH Package G — sticky no-flicker behavior tests.
 *
 * Tests cover:
 *   - first render of a visual identity with assets missing → fallback;
 *   - first render of a visual identity with assets available → modular;
 *   - after a successful modular render, a transient plan.available === false
 *     (e.g. direction change with new frame still loading) does NOT fall
 *     back to blockout (sticky keeps last good modular visible);
 *   - when the visual identity changes (different hull/turret/faction/mod),
 *     sticky is released and the new visual pays the normal fallback cost;
 *   - sticky is cleared on removeVehicle;
 *   - sticky is cleared when ENABLE_MODULAR_VEHICLE_RENDER is toggled off.
 *
 * The sticky state is private to ModularVehicleLiveAdapter, so these tests
 * exercise it through the public syncVehicle() return value:
 *   usedModular === true  → modular sprites visible (or kept visible via sticky)
 *   usedModular === false → fallback to blockout
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ModularVehicleLiveAdapter,
  ENABLE_MODULAR_VEHICLE_RENDER,
  setModularVehicleRender,
} from '../phaser/render/ModularVehicleLiveAdapter';
import type { BlockoutVehicleState } from '../state/blockoutVehicleState';
import { resetFactionWarningLedger } from '../modular/factionResolver';

// ─── Test fixtures ─────────────────────────────────────────────────

/**
 * Minimal mock Phaser.Scene that supports the only APIs the adapter uses:
 *   - scene.textures.exists(key)
 *   - scene.load.image(key, path)  (no-op in tests)
 *   - scene.add.image(x, y, key)
 *   - scene.time.now
 *
 * The textureExists predicate is configurable per-test to simulate
 * "assets loading" vs "assets available".
 */
function createMockScene(textureExists: (key: string) => boolean): any {
  const images: any[] = [];
  return {
    textures: {
      exists: textureExists,
    },
    load: {
      image: (_key: string, _path: string) => {
        // No-op for test: the textureExists predicate controls availability.
      },
    },
    add: {
      image: (_x: number, _y: number, key: string) => {
        const img = {
          x: _x, y: _y, textureKey: key,
          visible: true,
          originX: 0.5, originY: 0.5,
          scaleX: 1, scaleY: 1,
          depth: 0,
          setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; },
          setScale(s: number) { this.scaleX = s; this.scaleY = s; return this; },
          setDepth(d: number) { this.depth = d; return this; },
          setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
          setVisible(v: boolean) { this.visible = v; return this; },
          setTexture(k: string) { this.textureKey = k; return this; },
          destroy() { /* no-op for test */ },
        };
        images.push(img);
        return img;
      },
    },
    time: { now: 0 },
    __images: images,
  };
}

function createBlockoutVehicle(overrides: Partial<BlockoutVehicleState> = {}): BlockoutVehicleState {
  return {
    id: 'test-vehicle-1',
    bodyId: 'wasp',
    weaponId: 'smoky',
    faction: 'cyan',
    team: 'ally',
    tx: 5, ty: 5,
    bodyAngle: 0,
    turretAngle: 0,
    turretTargetAngle: 0,
    turretTurnSpeedDeg: 120,
    targetVehicleId: null,
    worldX: 100, worldY: 100,
    vx: 0, vy: 0, speed: 0,
    targetWorldX: 0, targetWorldY: 0,
    hasMoveTarget: false,
    lastFiredAt: 0,
    recoilActive: false,
    recoilStartedAt: 0,
    recoilDurationMs: 0,
    recoilBarrelOffset: 0,
    recoilTurretOffset: 0,
    recoilBodyOffset: 0,
    fireHeld: false,
    isFiring: false,
    lastStreamTickAt: 0,
    visualOverheat: 0,
    hp: 100, maxHp: 100,
    isDestroyed: false,
    destroyedAt: 0,
    lastDamagedAt: 0,
    damageFlashUntil: 0,
    activeStatusTags: [],
    lastDamageTickAt: 0,
    createdAt: 0,
    upgradeLevels: {},
    lastUpgradedAt: 0,
    aiMode: 'passive',
    aiHoldX: 0, aiHoldY: 0, aiHoldRadius: 200,
    gridMovement: { } as any,
    useGridMovement: true,
    modificationLevel: 0,
    weaponRuntime: { } as any,
    ...overrides,
  } as BlockoutVehicleState;
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('VEHICLE-RENDER-UNIFY-01-VH: sticky no-flicker behavior', () => {
  let originalFlag: boolean;

  beforeEach(() => {
    originalFlag = ENABLE_MODULAR_VEHICLE_RENDER;
    setModularVehicleRender(true);
    resetFactionWarningLedger();
  });

  afterEach(() => {
    setModularVehicleRender(originalFlag);
  });

  it('first render with assets missing → fallback (usedModular: false)', () => {
    // No textures exist — simulates assets still loading
    const scene = createMockScene(() => false);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);
    const vehicle = createBlockoutVehicle();

    const result = adapter.syncVehicle(vehicle);

    expect(result.usedModular).toBe(false);
    expect(result.fallbackReason).not.toBeNull();
  });

  it('first render with assets available → modular (usedModular: true)', () => {
    // All textures exist — simulates assets loaded
    const scene = createMockScene(() => true);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);
    const vehicle = createBlockoutVehicle();

    const result = adapter.syncVehicle(vehicle);

    expect(result.usedModular).toBe(true);
    expect(result.fallbackReason).toBeNull();
  });

  it('STICKY: after success, transient missing textures do NOT fall back to blockout', () => {
    // Simulate: frame 1 all textures exist; frame 2 some go missing
    // (e.g. a direction change where the new dir's texture isn't loaded yet).
    let texturesAvailable = true;
    const scene = createMockScene(() => texturesAvailable);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);
    const vehicle = createBlockoutVehicle();

    // Frame 1: success
    const r1 = adapter.syncVehicle(vehicle);
    expect(r1.usedModular).toBe(true);

    // Frame 2: textures temporarily missing (e.g. dir change, new frame loading)
    texturesAvailable = false;
    const r2 = adapter.syncVehicle(vehicle);

    // STICKY: should keep modular visible, NOT fall back to blockout
    expect(r2.usedModular).toBe(true);
    expect(r2.fallbackReason).toBeNull();
    expect(r2.debugLabel).toContain('sticky');
  });

  it('STICKY released on visual identity change (different hull)', () => {
    let texturesAvailable = true;
    const scene = createMockScene(() => texturesAvailable);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    // First vehicle: wasp+smoky+cyan+m0 — succeeds, sticky set
    const v1 = createBlockoutVehicle({ id: 'v1', bodyId: 'wasp' });
    const r1 = adapter.syncVehicle(v1);
    expect(r1.usedModular).toBe(true);

    // Same id but different hull (dictator) — sticky should NOT apply
    // because the visual identity changed.
    const v2 = createBlockoutVehicle({ id: 'v1', bodyId: 'dictator' });
    texturesAvailable = false; // new hull's textures not loaded yet
    const r2 = adapter.syncVehicle(v2);

    // Sticky released → fallback to blockout
    expect(r2.usedModular).toBe(false);
    expect(r2.fallbackReason).not.toBeNull();
  });

  it('STICKY released on faction change (cyan → green)', () => {
    let texturesAvailable = true;
    const scene = createMockScene(() => texturesAvailable);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    const v1 = createBlockoutVehicle({ id: 'v1', faction: 'cyan' });
    const r1 = adapter.syncVehicle(v1);
    expect(r1.usedModular).toBe(true);

    // Same id+body+weapon+mod but different faction — sticky should NOT apply
    const v2 = createBlockoutVehicle({ id: 'v1', faction: 'green' });
    texturesAvailable = false;
    const r2 = adapter.syncVehicle(v2);

    expect(r2.usedModular).toBe(false);
    expect(r2.fallbackReason).not.toBeNull();
  });

  it('STICKY released on mod change (m0 → m1)', () => {
    let texturesAvailable = true;
    const scene = createMockScene(() => texturesAvailable);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    const v1 = createBlockoutVehicle({ id: 'v1', modificationLevel: 0 });
    const r1 = adapter.syncVehicle(v1);
    expect(r1.usedModular).toBe(true);

    // Same visual identity but different mod level — sticky should NOT apply
    const v2 = createBlockoutVehicle({ id: 'v1', modificationLevel: 1 });
    texturesAvailable = false;
    const r2 = adapter.syncVehicle(v2);

    expect(r2.usedModular).toBe(false);
  });

  it('STICKY cleared on removeVehicle (id reuse does not inherit sticky)', () => {
    let texturesAvailable = true;
    const scene = createMockScene(() => texturesAvailable);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    const v1 = createBlockoutVehicle({ id: 'v1' });
    adapter.syncVehicle(v1); // success, sticky set

    // Remove the vehicle
    adapter.removeVehicle(v1.id);

    // New vehicle with the same id — sticky should NOT be inherited
    texturesAvailable = false;
    const v2 = createBlockoutVehicle({ id: 'v1' });
    const r2 = adapter.syncVehicle(v2);

    expect(r2.usedModular).toBe(false); // fresh start, no sticky
  });

  it('STICKY cleared when ENABLE_MODULAR_VEHICLE_RENDER toggled off', () => {
    let texturesAvailable = true;
    const scene = createMockScene(() => texturesAvailable);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    const v1 = createBlockoutVehicle({ id: 'v1' });
    const r1 = adapter.syncVehicle(v1);
    expect(r1.usedModular).toBe(true);

    // Toggle flag off
    setModularVehicleRender(false);
    const r2 = adapter.syncVehicle(v1);
    expect(r2.usedModular).toBe(false);
    expect(r2.fallbackReason).toBe('flag-off');

    // Toggle flag back on — sticky should be cleared, so first call
    // with missing textures should fall back (not sticky-keep).
    setModularVehicleRender(true);
    texturesAvailable = false;
    const r3 = adapter.syncVehicle(v1);
    expect(r3.usedModular).toBe(false); // sticky was cleared on flag-off
  });

  it('direction change within same visual identity does NOT release sticky', () => {
    // This is the key no-flicker guarantee: direction (hullDir16/turretDir16)
    // is NOT part of visual identity. A direction change with the new frame
    // still loading keeps the last good frame visible via sticky.
    let texturesAvailable = true;
    const scene = createMockScene(() => texturesAvailable);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    // Initial render at angle 0 (dir00)
    const v1 = createBlockoutVehicle({ id: 'v1', bodyAngle: 0, turretAngle: 0 });
    const r1 = adapter.syncVehicle(v1);
    expect(r1.usedModular).toBe(true);

    // Direction change: angle π/2 (dir04) — new textures not loaded yet
    texturesAvailable = false;
    const v2 = createBlockoutVehicle({ id: 'v1', bodyAngle: Math.PI / 2, turretAngle: Math.PI / 2 });
    const r2 = adapter.syncVehicle(v2);

    // Sticky should keep modular visible (direction is not part of identity)
    expect(r2.usedModular).toBe(true);
    expect(r2.fallbackReason).toBeNull();
    expect(r2.debugLabel).toContain('sticky');
  });
});

// ─── Package C integration: faction flow through adapter ───────────

describe('VEHICLE-RENDER-UNIFY-01-VH: faction flow through live adapter (Package C+D)', () => {
  let originalFlag: boolean;

  beforeEach(() => {
    originalFlag = ENABLE_MODULAR_VEHICLE_RENDER;
    setModularVehicleRender(true);
    resetFactionWarningLedger();
  });

  afterEach(() => {
    setModularVehicleRender(originalFlag);
  });

  it('all 4 factions render as modular when assets are available', () => {
    const factions = ['cyan', 'green', 'yellow', 'purple'] as const;
    for (const faction of factions) {
      const scene = createMockScene(() => true);
      const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);
      const vehicle = createBlockoutVehicle({ id: `v-${faction}`, faction });

      const result = adapter.syncVehicle(vehicle);
      expect(result.usedModular).toBe(true);
      expect(result.fallbackReason).toBeNull();
    }
  });

  it('Arena syncVehicle does NOT silently recolor — BlockoutVehicleState.faction is required', () => {
    // BlockoutVehicleState.faction is typed as required Faction, so the
    // adapter receives a valid faction directly. The factionResolver is
    // defensive only. This test verifies the happy path: a valid faction
    // flows through without any fallback or warning.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scene = createMockScene(() => true);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);
    const vehicle = createBlockoutVehicle({ faction: 'green' });

    const result = adapter.syncVehicle(vehicle);

    expect(result.usedModular).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('placeModularCombat warns once on missing faction (no silent cyan recolor)', () => {
    // RenderableEntity.faction is optional, so this is the real test of
    // the no-silent-recolor contract. The adapter should warn and use
    // diagnostic cyan (marked via factionRes.usedFallback).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scene = createMockScene(() => true);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    // Entity with missing faction
    const entity = {
      id: 'e1',
      kind: 'modular-combat' as const,
      tx: 5, ty: 5,
      // faction: undefined  ← intentionally missing
      dir: 2,
      turretDir: 2,
    };

    adapter.placeModularCombat(entity, { x: 100, y: 100 }, 'wasp', 'smoky', 'm0');

    // Should still produce a modular plan (diagnostic cyan fallback),
    // but the warning must be emitted (no silent recolor).
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('ModularVehicleLiveAdapter.placeModularCombat');
    expect(warnSpy.mock.calls[0][0]).toContain('undefined');

    // A second call with missing faction for the same context should be silent
    adapter.placeModularCombat(entity, { x: 100, y: 100 }, 'wasp', 'smoky', 'm0');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('placeModularCombat passes valid non-cyan faction through (no warning, no fallback)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scene = createMockScene(() => true);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 }, 120);

    const entity = {
      id: 'e1',
      kind: 'modular-combat' as const,
      tx: 5, ty: 5,
      faction: 'purple' as const,
      dir: 2,
      turretDir: 2,
    };

    const result = adapter.placeModularCombat(entity, { x: 100, y: 100 }, 'wasp', 'smoky', 'm0');

    expect(result.usedModular).toBe(true);
    expect(result.fallbackReason).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    // The debug label should NOT contain 'faction:fallback-cyan'
    expect(result.debugLabel).not.toContain('faction:fallback-cyan');

    warnSpy.mockRestore();
  });
});

// ─── Package E: turret-to-cursor default OFF (no Phaser scene required) ──

describe('VEHICLE-RENDER-UNIFY-01-VH: turret-to-cursor default OFF (Package E)', () => {
  it('BlockoutVehicleInputController.turretCursorFollowEnabled defaults to false', async () => {
    // Import the controller — we only need to verify the default value of
    // the new public field. We construct the controller with a mock deps
    // object that satisfies the constructor's minimal requirements.
    const { BlockoutVehicleInputController } = await import('../phaser/input/BlockoutVehicleInputController');

    const mockDeps: any = {
      scene: {
        input: {
          on: () => {},
          keyboard: { on: () => {}, off: () => {} },
        },
        time: { now: 0 },
      },
      offset: { x: 0, y: 0 },
      getGameState: () => ({
        blockoutVehicles: [],
        mapWidth: 20, mapHeight: 20,
        mapData: { terrain: [], hq: { tx: 0, ty: 0, faction: 'cyan' }, resources: [], obstacles: [], decor: [], buildings: [], builders: [], constructionSites: [] },
      }),
      isDevtoolsActive: () => false,
      onSelectionChanged: () => {},
      isPlacementActive: () => false,
      isArenaMode: () => false,
      getReservationMap: () => null,
    };

    const controller = new BlockoutVehicleInputController(mockDeps);

    expect(controller.turretCursorFollowEnabled).toBe(false);

    // Opt-in via setter
    controller.setTurretCursorFollowEnabled(true);
    expect(controller.turretCursorFollowEnabled).toBe(true);

    // Opt-out
    controller.setTurretCursorFollowEnabled(false);
    expect(controller.turretCursorFollowEnabled).toBe(false);
  });
});

// ─── Package E: BlockoutVehicleRenderer debug defaults (raw source) ──

describe('VEHICLE-RENDER-UNIFY-01-VH: BlockoutVehicleRenderer debug defaults (Package E)', () => {
  it('showMountPoints and showDebugLabels default to false (raw source check)', async () => {
    // Read the source file via Vite's ?raw import to verify the default
    // field values. Constructing the renderer requires a full Phaser scene
    // which is not feasible in a unit test.
    const source = (await import('../phaser/render/BlockoutVehicleRenderer.ts?raw')).default as string;

    // Find the field declarations and verify defaults
    expect(source).toMatch(/private showDebugLabels = false/);
    expect(source).toMatch(/private showMountPoints = false/);

    // Verify aim line is gated by isDevtoolsActive
    expect(source).toMatch(/if \(isSelected && this\.isDevtoolsActive\(\)\) \{/);

    // Verify direction arrow is gated by isDevtoolsActive
    expect(source).toMatch(/VEHICLE-RENDER-UNIFY-01-VH Package E: gate behind isDevtoolsActive\(\)/);
  });
});

// ─── Package G: no PR #296 drift/mount-slot model introduced ───────

describe('VEHICLE-RENDER-UNIFY-01-VH: no PR #296 drift/mount-slot model', () => {
  it('source files do not introduce mount-slot or forward/back drift constants', async () => {
    // Check the key files that would be affected by a #296-style refactor.
    // We import them as raw strings via Vite's ?raw suffix and assert that
    // the forbidden PR #296 patterns do NOT appear in non-comment code.
    const filesToCheck = [
      '../modular/modularVehicleComposition.ts?raw',
      '../modular/factionResolver.ts?raw',
      '../phaser/render/ModularVehicleLiveAdapter.ts?raw',
    ] as const;

    const forbiddenPatterns = [
      /MOUNT_SLOT_/,
      /mountSlotOffset/,
      /forwardBackDrift/,
      /frontBackDrift/,
      /driftOffset/,
    ];

    for (const file of filesToCheck) {
      const source = (await import(file)).default as string;

      for (const pattern of forbiddenPatterns) {
        // Allow the pattern to appear in comments only. We check for actual
        // constant/function definitions in non-comment lines.
        const lines = source.split('\n');
        for (const line of lines) {
          // Skip comment lines
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
          // Skip lines that mention "forbidden" or "#296" (they're guards)
          if (line.includes('#296') || line.toLowerCase().includes('forbidden')) continue;

          if (pattern.test(line)) {
            throw new Error(
              `Forbidden PR #296 pattern "${pattern}" found in ${file}:${line.trim()}`,
            );
          }
        }
      }
    }
  });
});

// ─── Package G: lazy-load 32-PNG cap still enforced ────────────────

describe('VEHICLE-RENDER-UNIFY-01-VH: lazy-load 32-PNG cap preserved', () => {
  it('MAX_MODULAR_VEHICLE_SET_PNG is still 32', async () => {
    const { MAX_MODULAR_VEHICLE_SET_PNG } = await import('../modular/modularVehicleRuntimeLoader');
    expect(MAX_MODULAR_VEHICLE_SET_PNG).toBe(32);
  });

  it('MODULAR_FRAMES_PER_FAMILY is still 16', async () => {
    const { MODULAR_FRAMES_PER_FAMILY } = await import('../modular/modularVehicleRuntimeLoader');
    expect(MODULAR_FRAMES_PER_FAMILY).toBe(16);
  });
});

// ─── Package G: Dictator +9% hull-only multiplier preserved ───────

describe('VEHICLE-RENDER-UNIFY-01-VH: Dictator +9% hull-only preserved', () => {
  it('HULL_VISUAL_SCALE_MULTIPLIERS still has dictator: 1.09', async () => {
    const { HULL_VISUAL_SCALE_MULTIPLIERS, getHullVisualScaleMultiplier } = await import('../modular/modularVehicleComposition');
    expect(HULL_VISUAL_SCALE_MULTIPLIERS.dictator).toBe(1.09);
    expect(getHullVisualScaleMultiplier('dictator')).toBe(1.09);
    expect(getHullVisualScaleMultiplier('wasp')).toBe(1);
    expect(getHullVisualScaleMultiplier('hornet')).toBe(1);
    expect(getHullVisualScaleMultiplier('hunter')).toBe(1);
    expect(getHullVisualScaleMultiplier('viking')).toBe(1);
    expect(getHullVisualScaleMultiplier('titan')).toBe(1);
    expect(getHullVisualScaleMultiplier('mammoth')).toBe(1);
  });

  it('MODULAR_VEHICLE_BASE_SCALE is still 0.16 (04A source of truth)', async () => {
    const { MODULAR_VEHICLE_BASE_SCALE } = await import('../modular/modularVehicleComposition');
    expect(MODULAR_VEHICLE_BASE_SCALE).toBe(0.16);
  });
});
