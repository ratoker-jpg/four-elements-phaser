/**
 * RUNTIME-03: Pilot turret composition resolver tests.
 *
 * Tests the pure composition resolver (pilotTurretComposition.ts)
 * and its integration contract with the renderer.
 *
 * The resolver is pure: no Phaser imports, no scene reference.
 * All texture checks go through a textureExists callback.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolvePilotTurretComposition,
} from '../assets/pilotTurretComposition';
import {
  getGeneratedTurretTextureKey,
  turretAngleToDir16,
  GENERATED_TURRET_SCALE,
  GENERATED_TURRET_ORIGIN_X,
  GENERATED_TURRET_ORIGIN_Y,
} from '../assets/generatedTurretAssets';
import {
  bodyIdToGeneratedHullId,
} from '../assets/generatedHullAssets';

// ─── Helpers ──────────────────────────────────────────────────────

/** Build a textureExists callback that contains all 16 keys for a turret set. */
function makeTextureExistsWithTurretSet(
  weaponId: string,
  faction: string,
  mod: string,
  existingKeys?: Set<string>,
): (key: string) => boolean {
  const allKeys = existingKeys ?? new Set<string>();
  // If no custom set was provided, populate all 16 turret direction keys
  if (!existingKeys) {
    for (let dir = 0; dir < 16; dir++) {
      const key = getGeneratedTurretTextureKey(
        weaponId as any, faction as any, mod as any, dir as any,
      );
      allKeys.add(key);
    }
  }
  return (key: string) => allKeys.has(key);
}

/** Always-false textureExists callback (no textures available). */
const textureExistsNever = (_key: string) => false;

// ─── Pure placement math ──────────────────────────────────────────

describe('pilotTurretComposition: pure placement math', () => {
  it('returns correct dir16 for known turret angles', () => {
    // East = 0 rad → dir16 0
    expect(turretAngleToDir16(0)).toBe(0);
    // South = PI/2 → dir16 4
    expect(turretAngleToDir16(Math.PI / 2)).toBe(4);
    // West = PI → dir16 8
    expect(turretAngleToDir16(Math.PI)).toBe(8);
    // North = 3*PI/2 → dir16 12
    expect(turretAngleToDir16(3 * Math.PI / 2)).toBe(12);
  });

  it('quantizes intermediate angles correctly', () => {
    // PI/8 should quantize to dir16 1 (ESE)
    expect(turretAngleToDir16(Math.PI / 8)).toBe(1);
    // 3*PI/8 should quantize to dir16 3 (SSE)
    expect(turretAngleToDir16(3 * Math.PI / 8)).toBe(3);
  });

  it('handles negative angles by normalizing', () => {
    // -PI/2 normalizes to 3*PI/2 → dir16 12 (North)
    expect(turretAngleToDir16(-Math.PI / 2)).toBe(12);
    // -PI normalizes to PI → dir16 8 (West)
    expect(turretAngleToDir16(-Math.PI)).toBe(8);
  });

  it('wraps around at 2*PI', () => {
    // 2*PI should wrap to dir16 0 (East)
    expect(turretAngleToDir16(Math.PI * 2)).toBe(0);
  });
});

// ─── Texture missing → null ────────────────────────────────────────

describe('pilotTurretComposition: texture missing → null', () => {
  it('returns null turretKey when texture does not exist', () => {
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsNever,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('returns null turretKey when only some textures exist', () => {
    // Create a set that has all turret keys EXCEPT dir00
    const partialKeys = new Set<string>();
    for (let dir = 1; dir < 16; dir++) {
      partialKeys.add(getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir as any));
    }
    const textureExists = (key: string) => partialKeys.has(key);

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    // dir16 0 → key 'generated_turret_smoky_cyan_m0_dir00' which is missing
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('returns correct dir16 in diagnostic even when texture is missing', () => {
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, Math.PI / 2, // facing South
      textureExistsNever,
    );
    expect(result.dir16).toBe(4); // South direction
    expect(result.hasGeneratedTurret).toBe(false);
  });
});

// ─── Unsupported weapon → null ─────────────────────────────────────

describe('pilotTurretComposition: unsupported weapon → null', () => {
  it('returns null for shaft (no generated turret assets)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'shaft', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('returns null for unknown weapon ID', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'nonexistent_weapon', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });
});

// ─── Unsupported body → null ───────────────────────────────────────

describe('pilotTurretComposition: unsupported body → null', () => {
  it('returns null for unsupported_body (not in GENERATED_HULL_IDS)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'unsupported_body', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('returns null for empty bodyId', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', '', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('mammoth IS supported (in GENERATED_HULL_IDS) — not a valid unsupported test body', () => {
    // Verify mammoth is a valid hull ID
    expect(bodyIdToGeneratedHullId('mammoth')).toBe('mammoth');
  });
});

// ─── Smoky direction remap stability ────────────────────────────────

describe('pilotTurretComposition: Smoky direction remap stable', () => {
  it('Smoky uses all 16 directions directly (no 8-dir doubling)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');

    // All 16 direction indices should be reachable from turret angles
    const seenDirs = new Set<number>();
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      const result = resolvePilotTurretComposition(
        'smoky', 'wasp', 'cyan', 0, angle,
        textureExists,
      );
      seenDirs.add(result.dir16);
    }

    // Should have all 16 directions
    expect(seenDirs.size).toBe(16);
  });

  it('turret direction is independent of hull body direction', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');

    // Turret facing East (0 rad) should give dir16 0
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.dir16).toBe(0);
    expect(result.hasGeneratedTurret).toBe(true);
  });

  it('Smoky dir16 remap is stable across multiple calls', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const angle = Math.PI / 4; // SE

    const result1 = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, angle,
      textureExists,
    );
    const result2 = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, angle,
      textureExists,
    );

    expect(result1.dir16).toBe(result2.dir16);
    expect(result1.turretKey).toBe(result2.turretKey);
  });
});

// ─── Exactly one textureExists probe, no preload ──────────────────

describe('pilotTurretComposition: exactly one textureExists probe, no preload', () => {
  it('calls textureExists exactly once per resolution', () => {
    const textureExistsSpy = vi.fn().mockReturnValue(true);

    resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsSpy,
    );

    expect(textureExistsSpy).toHaveBeenCalledOnce();
  });

  it('calls textureExists exactly once even when texture is missing', () => {
    const textureExistsSpy = vi.fn().mockReturnValue(false);

    resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsSpy,
    );

    expect(textureExistsSpy).toHaveBeenCalledOnce();
  });

  it('does not call textureExists for unsupported weapon', () => {
    const textureExistsSpy = vi.fn().mockReturnValue(true);

    resolvePilotTurretComposition(
      'shaft', 'wasp', 'cyan', 0, 0,
      textureExistsSpy,
    );

    expect(textureExistsSpy).not.toHaveBeenCalled();
  });

  it('does not call textureExists for unsupported body', () => {
    const textureExistsSpy = vi.fn().mockReturnValue(true);

    resolvePilotTurretComposition(
      'smoky', 'unsupported_body', 'cyan', 0, 0,
      textureExistsSpy,
    );

    expect(textureExistsSpy).not.toHaveBeenCalled();
  });
});

// ─── Composition result structure ──────────────────────────────────

describe('pilotTurretComposition: result structure', () => {
  it('returns correct render params when texture exists', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    expect(result.hasGeneratedTurret).toBe(true);
    expect(result.turretKey).toBe('generated_turret_smoky_cyan_m0_dir00');
    expect(result.scale).toBe(GENERATED_TURRET_SCALE);
    expect(result.originX).toBe(GENERATED_TURRET_ORIGIN_X);
    expect(result.originY).toBe(GENERATED_TURRET_ORIGIN_Y);
    expect(result.dir16).toBe(0);
  });

  it('returns null turretKey but valid render params when texture missing', () => {
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsNever,
    );

    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.scale).toBe(GENERATED_TURRET_SCALE);
    expect(result.originX).toBe(GENERATED_TURRET_ORIGIN_X);
    expect(result.originY).toBe(GENERATED_TURRET_ORIGIN_Y);
  });

  it('respects modification level in texture key', () => {
    const m3Keys = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      m3Keys.add(getGeneratedTurretTextureKey('smoky', 'cyan', 'm3', dir as any));
    }
    const textureExists = (key: string) => m3Keys.has(key);

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 3, 0, // modificationLevel 3 → m3
      textureExists,
    );

    expect(result.turretKey).toBe('generated_turret_smoky_cyan_m3_dir00');
    expect(result.hasGeneratedTurret).toBe(true);
  });

  it('respects faction in texture key', () => {
    const purpleKeys = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      purpleKeys.add(getGeneratedTurretTextureKey('smoky', 'purple', 'm0', dir as any));
    }
    const textureExists = (key: string) => purpleKeys.has(key);

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'purple', 0, 0,
      textureExists,
    );

    expect(result.turretKey).toBe('generated_turret_smoky_purple_m0_dir00');
    expect(result.hasGeneratedTurret).toBe(true);
  });
});

// ─── Standard mode safety ──────────────────────────────────────────

describe('pilotTurretComposition: standard mode safety', () => {
  it('resolver is pure — no side effects on scene', () => {
    // The resolver does not reference any scene object
    // It only uses the textureExists callback
    let callCount = 0;
    const textureExists = (_key: string) => { callCount++; return false; };

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    // Only one probe, no loading, no mutation
    expect(callCount).toBe(1);
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('resolver cannot load assets — textureExists is read-only', () => {
    const textureSet = new Set<string>();
    const textureExists = (key: string) => textureSet.has(key);

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    // Set remains empty — resolver did not add any keys
    expect(textureSet.size).toBe(0);
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('non-Arena vehicles with no textures fall back gracefully', () => {
    // Standard mode: no generated turret textures loaded
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsNever,
    );

    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.turretKey).toBeNull();
    // Procedural turret will be used by the renderer
  });
});

// ─── Pilot scope limit ─────────────────────────────────────────────

describe('pilotTurretComposition: pilot scope limit', () => {
  it('works with the pilot combo: smoky + wasp + cyan + m0', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    expect(result.hasGeneratedTurret).toBe(true);
    expect(result.turretKey).toContain('smoky');
    expect(result.turretKey).toContain('cyan');
    expect(result.turretKey).toContain('m0');
  });

  it('works with other supported weapons (e.g. thunder)', () => {
    const textureExists = makeTextureExistsWithTurretSet('thunder', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'thunder', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    expect(result.hasGeneratedTurret).toBe(true);
    expect(result.turretKey).toContain('thunder');
  });

  it('works with other supported hulls (e.g. hornet)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'hornet', 'cyan', 0, 0,
      textureExists,
    );

    expect(result.hasGeneratedTurret).toBe(true);
    // hornet IS in GENERATED_HULL_IDS
    expect(bodyIdToGeneratedHullId('hornet')).toBe('hornet');
  });

  it('flamethrower maps to firebird turret ID', () => {
    const firebirdKeys = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      firebirdKeys.add(getGeneratedTurretTextureKey('firebird', 'cyan', 'm0', dir as any));
    }
    const textureExists = (key: string) => firebirdKeys.has(key);

    const result = resolvePilotTurretComposition(
      'flamethrower', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    expect(result.hasGeneratedTurret).toBe(true);
    expect(result.turretKey).toContain('firebird');
  });
});

// ─── No accidental path strings ─────────────────────────────────────

describe('pilotTurretComposition: no accidental path strings', () => {
  it('turretKey does not contain absolute filesystem paths', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    if (result.turretKey) {
      expect(result.turretKey).not.toContain('/home/');
      expect(result.turretKey).not.toContain('/Users/');
      expect(result.turretKey).not.toContain('C:\\');
    }
  });
});
