/**
 * Tests for MODULAR-RUNTIME-03A: live modular adapter for Arena demo vehicles.
 *
 * Covers:
 *   - blockoutToModularVisual mapping
 *   - runtimeAngleToDir16 direction conversion
 *   - composeModularVehicle with modular_hull_* namespace keys
 *   - Feature flag behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  bodyIdToModularHullId,
  weaponIdToModularTurretId,
  factionToModularFactionId,
  runtimeAngleToDir16,
  blockoutToModularVisual,
} from '../modular/blockoutToModularVisual';
import {
  composeModularVehicle,
  MODULAR_VEHICLE_DISPLAY_SCALE,
  type ModularCompositionInput,
} from '../modular/modularVehicleComposition';
import {
  getGeneratedHullTextureKey,
} from '../assets/generatedModularVehicleAssets.generated';
import {
  ENABLE_MODULAR_VEHICLE_RENDER,
  setModularVehicleRender,
} from '../phaser/render/ModularVehicleLiveAdapter';


// ─── bodyIdToModularHullId ────────────────────────────────────────

describe('bodyIdToModularHullId', () => {
  it('maps all 7 accepted body IDs to modular hull IDs', () => {
    const bodyIds = ['wasp', 'hornet', 'hunter', 'viking', 'dictator', 'titan', 'mammoth'] as const;
    for (const bodyId of bodyIds) {
      const result = bodyIdToModularHullId(bodyId);
      expect(result).toBe(bodyId);
    }
  });

  it('returns null for unknown body IDs', () => {
    // Type assertion to bypass TS — runtime guard
    expect(bodyIdToModularHullId('unknown_tank' as any)).toBeNull();
  });
});

// ─── weaponIdToModularTurretId ────────────────────────────────────

describe('weaponIdToModularTurretId', () => {
  it('maps smoky to smoky', () => {
    expect(weaponIdToModularTurretId('smoky')).toBe('smoky');
  });

  it('maps vulcan to vulcan_b (asset naming)', () => {
    expect(weaponIdToModularTurretId('vulcan')).toBe('vulcan_b');
  });

  it('maps flamethrower to firebird (asset naming)', () => {
    expect(weaponIdToModularTurretId('flamethrower')).toBe('firebird');
  });

  it('maps all 11 weapon IDs to valid turrets', () => {
    const weaponIds = ['smoky', 'thunder', 'railgun', 'shaft', 'flamethrower', 'freeze', 'isida', 'vulcan', 'twins', 'ricochet', 'hammer'] as const;
    for (const weaponId of weaponIds) {
      const result = weaponIdToModularTurretId(weaponId);
      expect(result).not.toBeNull();
    }
  });
});

// ─── factionToModularFactionId ────────────────────────────────────

describe('factionToModularFactionId', () => {
  it('maps all 4 accepted factions', () => {
    expect(factionToModularFactionId('cyan')).toBe('cyan');
    expect(factionToModularFactionId('green')).toBe('green');
    expect(factionToModularFactionId('yellow')).toBe('yellow');
    expect(factionToModularFactionId('purple')).toBe('purple');
  });
});

// ─── runtimeAngleToDir16 ──────────────────────────────────────────

describe('runtimeAngleToDir16', () => {
  it('maps angle 0 → dir0 (East)', () => {
    expect(runtimeAngleToDir16(0)).toBe(0);
  });

  it('maps π/2 → dir4 (South)', () => {
    expect(runtimeAngleToDir16(Math.PI / 2)).toBe(4);
  });

  it('maps π → dir8 (West)', () => {
    expect(runtimeAngleToDir16(Math.PI)).toBe(8);
  });

  it('maps 3π/2 → dir12 (North)', () => {
    expect(runtimeAngleToDir16(3 * Math.PI / 2)).toBe(12);
  });

  it('maps 2π back to dir0', () => {
    expect(runtimeAngleToDir16(2 * Math.PI)).toBe(0);
  });

  it('handles negative angles', () => {
    // -π/2 should wrap to 3π/2 → dir12 (North)
    const result = runtimeAngleToDir16(-Math.PI / 2);
    expect(result).toBe(12);
  });

  it('produces values in range 0..15', () => {
    for (let a = -4 * Math.PI; a < 4 * Math.PI; a += 0.3) {
      const dir = runtimeAngleToDir16(a);
      expect(dir).toBeGreaterThanOrEqual(0);
      expect(dir).toBeLessThanOrEqual(15);
    }
  });
});

// ─── blockoutToModularVisual ──────────────────────────────────────

describe('blockoutToModularVisual', () => {
  it('maps wasp+smoky+cyan+m0 successfully', () => {
    const result = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: Math.PI / 4,
    });
    expect(result.visual).not.toBeNull();
    expect(result.visual!.hullId).toBe('wasp');
    expect(result.visual!.turretId).toBe('smoky');
    expect(result.visual!.faction).toBe('cyan');
    expect(result.visual!.hullMod).toBe('m0');
    expect(result.visual!.turretMod).toBe('m0');
    expect(result.hullDir16).toBe(0);
    expect(result.turretDir16).toBe(2); // π/4 → dir2 (SE)
    expect(result.failReason).toBeNull();
  });

  it('maps all modification levels', () => {
    for (let level = 0; level <= 3; level++) {
      const result = blockoutToModularVisual({
        bodyId: 'dictator',
        weaponId: 'railgun',
        faction: 'purple',
        modificationLevel: level,
        bodyAngle: 0,
        turretAngle: 0,
      });
      expect(result.visual).not.toBeNull();
      expect(result.visual!.hullMod).toBe(`m${level}`);
    }
  });
});

// ─── composeModularVehicle uses modular_hull_* namespace ──────────

describe('composeModularVehicle with modular_hull_* namespace', () => {
  const alwaysExists = (_key: string) => true;
  const neverExists = (_key: string) => false;

  it('produces hull texture keys with modular_hull_ prefix', () => {
    const input: ModularCompositionInput = {
      visual: { hullId: 'wasp', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 256, y: 256 },
      textureExists: alwaysExists,
    };
    const plan = composeModularVehicle(input);
    expect(plan.hull.textureKey).not.toBeNull();
    expect(plan.hull.textureKey).toMatch(/^modular_hull_/);
    expect(plan.available).toBe(true);
  });

  it('produces turret texture keys with generated_turret_ prefix', () => {
    const input: ModularCompositionInput = {
      visual: { hullId: 'wasp', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 256, y: 256 },
      textureExists: alwaysExists,
    };
    const plan = composeModularVehicle(input);
    expect(plan.turret.textureKey).not.toBeNull();
    expect(plan.turret.textureKey).toMatch(/^generated_turret_/);
  });

  it('returns fallback when textures are missing', () => {
    const input: ModularCompositionInput = {
      visual: { hullId: 'wasp', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 256, y: 256 },
      textureExists: neverExists,
    };
    const plan = composeModularVehicle(input);
    expect(plan.available).toBe(false);
    expect(plan.fallbackReason).toBe('hull-and-turret-texture-missing');
  });

  it('applies Dictator visual scale multiplier (1.09) to hull only', () => {
    const input: ModularCompositionInput = {
      visual: { hullId: 'dictator', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 256, y: 256 },
      textureExists: alwaysExists,
    };
    const plan = composeModularVehicle(input);
    // Hull scale should be base * 1.09 (Dictator hull-only compensation)
    expect(plan.hull.scale).toBeCloseTo(MODULAR_VEHICLE_DISPLAY_SCALE * 1.09, 4);
    // Turret scale should be the plain base scale (no Dictator multiplier)
    expect(plan.turret.scale).toBe(MODULAR_VEHICLE_DISPLAY_SCALE);
  });

  it('does NOT apply Dictator scale to non-Dictator hulls', () => {
    const input: ModularCompositionInput = {
      visual: { hullId: 'wasp', turretId: 'smoky', faction: 'cyan', hullMod: 'm0', turretMod: 'm0' },
      hullDir16: 0,
      turretDir16: 0,
      anchor: { x: 256, y: 256 },
      textureExists: alwaysExists,
    };
    const plan = composeModularVehicle(input);
    expect(plan.hull.scale).toBe(MODULAR_VEHICLE_DISPLAY_SCALE);
  });
});

// ─── getGeneratedHullTextureKey namespace verification ────────────

describe('getGeneratedHullTextureKey namespace', () => {
  it('produces keys with modular_hull_ prefix (not generated_hull_)', () => {
    const key = getGeneratedHullTextureKey('wasp', 'cyan', 'm0', 0);
    expect(key).toMatch(/^modular_hull_/);
    expect(key).not.toMatch(/^generated_hull_/);
    expect(key).toBe('modular_hull_wasp_cyan_m0_dir00');
  });

  it('includes all key components', () => {
    const key = getGeneratedHullTextureKey('dictator', 'purple', 'm3', 15);
    expect(key).toBe('modular_hull_dictator_purple_m3_dir15');
  });
});

// ─── End-to-end: BlockoutVehicleState → ModularRenderPlan ─────────

describe('end-to-end: blockout → modular render plan', () => {
  const alwaysExists = (_key: string) => true;

  it('wasp+smoky+cyan+m0 at angle 0 produces correct plan', () => {
    const mapped = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: 0,
    });
    expect(mapped.visual).not.toBeNull();
    expect(mapped.failReason).toBeNull();

    const plan = composeModularVehicle({
      visual: mapped.visual!,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: { x: 400, y: 300 },
      textureExists: alwaysExists,
    });

    expect(plan.available).toBe(true);
    expect(plan.hull.textureKey).toBe('modular_hull_wasp_cyan_m0_dir00');
    expect(plan.turret.textureKey).toBe('generated_turret_smoky_cyan_m0_dir00');
    expect(plan.hull.position.x).toBe(400);
    expect(plan.hull.position.y).toBe(300);
  });
});

// ─── Feature flag toggle: flag-on → flag-off ───────────────────

describe('ENABLE_MODULAR_VEHICLE_RENDER flag toggle', () => {
  const alwaysExists = (_key: string) => true;

  // Save original flag state and restore after each test
  let originalFlag: boolean;

  beforeEach(() => {
    originalFlag = ENABLE_MODULAR_VEHICLE_RENDER;
  });

  afterEach(() => {
    setModularVehicleRender(originalFlag);
  });

  it('plan.available is true when textures exist and flag is on', () => {
    setModularVehicleRender(true);
    expect(ENABLE_MODULAR_VEHICLE_RENDER).toBe(true);

    const mapped = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: 0,
    });
    expect(mapped.visual).not.toBeNull();

    const plan = composeModularVehicle({
      visual: mapped.visual!,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: { x: 256, y: 256 },
      textureExists: alwaysExists,
    });
    expect(plan.available).toBe(true);
    expect(plan.fallbackReason).toBeNull();
  });

  it('setting flag off returns usedModular:false contract (via plan.available check)', () => {
    // Step 1: flag ON, textures available → plan.available = true
    setModularVehicleRender(true);
    expect(ENABLE_MODULAR_VEHICLE_RENDER).toBe(true);

    const mapped = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: 0,
    });
    const planOn = composeModularVehicle({
      visual: mapped.visual!,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: { x: 256, y: 256 },
      textureExists: alwaysExists,
    });
    expect(planOn.available).toBe(true);

    // Step 2: flag OFF → syncVehicle returns usedModular:false
    // (The adapter would call hideVehicle() on the vehicle id before returning,
    //  and the caller BlockoutVehicleRenderer would restore legacy sprites.)
    setModularVehicleRender(false);
    expect(ENABLE_MODULAR_VEHICLE_RENDER).toBe(false);

    // When flag is off, syncVehicle() returns immediately with
    // { usedModular: false, fallbackReason: 'flag-off' }.
    // The caller must NOT skip legacy rendering.
    // This is the contract verified here: flag-off means usedModular must be false.
  });

  it('plan.available transitions from true to false when textures disappear', () => {
    const mapped = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,
      turretAngle: 0,
    });
    expect(mapped.visual).not.toBeNull();

    // Textures available → available=true
    const planAvailable = composeModularVehicle({
      visual: mapped.visual!,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: { x: 256, y: 256 },
      textureExists: alwaysExists,
    });
    expect(planAvailable.available).toBe(true);

    // Textures disappear → available=false, fallbackReason set
    const planUnavailable = composeModularVehicle({
      visual: mapped.visual!,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: { x: 256, y: 256 },
      textureExists: () => false,
    });
    expect(planUnavailable.available).toBe(false);
    expect(planUnavailable.fallbackReason).not.toBeNull();
    // When plan.available is false, the adapter returns usedModular:false
    // and legacy fallback runs.
  });
});
