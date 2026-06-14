/**
 * RUNTIME-03: Pilot turret composition resolver tests.
 *
 * Tests the pure composition resolver (pilotTurretComposition.ts)
 * and its pivot-on-socket composition formula.
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
} from '../assets/generatedTurretAssets';
import {
  bodyIdToGeneratedHullId,
} from '../assets/generatedHullAssets';
import {
  resolveHullVisualProfile,
} from '../config/hullTurretVisualProfiles';
import {
  resolveTurretPivotForDir,
} from '../config/directionalTurretProfiles';

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

// ─── Pivot lands on socket ────────────────────────────────────────

describe('pilotTurretComposition: pivot lands on socket', () => {
  it('returns non-null turretOffsetPx for pilot combo (smoky + wasp + cyan + m0)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    expect(result.hasGeneratedTurret).toBe(true);
    expect(result.turretOffsetPx).not.toBeNull();
    expect(result.turretOffsetPx!.x).toBeTypeOf('number');
    expect(result.turretOffsetPx!.y).toBeTypeOf('number');
  });

  it('turret offset is computed from hull socket and directional pivot (not same-center)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    // Same-center would have offset (0, 0). With real socket/pivot data,
    // the offset should be non-zero because:
    // - Wasp hull origin is (0.5, 0.75), not (0.5, 0.5)
    // - Socket is at (0.5, 0.5) normalized hull coords
    // - Smoky M0 dir00 pivot is at (0.206668, 0.464846), not (0.5, 0.5)
    expect(result.turretOffsetPx).not.toBeNull();
    expect(result.turretOffsetPx!.x).not.toBe(0);
    expect(result.turretOffsetPx!.y).not.toBe(0);
  });

  it('offset changes per turret direction (different pivots)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');

    // East (dir 0)
    const resultEast = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    // South (dir 4) = PI/2
    const resultSouth = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, Math.PI / 2,
      textureExists,
    );

    // Different directions have different pivot positions, so offsets differ
    expect(resultEast.turretOffsetPx).not.toBeNull();
    expect(resultSouth.turretOffsetPx).not.toBeNull();
    expect(resultEast.turretOffsetPx!.x).not.toBe(resultSouth.turretOffsetPx!.x);
  });

  it('offset is consistent with manual socket/pivot math', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    // Manual computation:
    // Hull: scale=0.12, origin=(0.5,0.75), displaySize=512*0.12=61.44
    // Socket: (0.5, 0.5)
    // socketFromSpritePos.x = (0.5 - 0.5) * 61.44 = 0
    // socketFromSpritePos.y = (0.5 - 0.75) * 61.44 = -15.36
    // Turret: scale=0.24 (from turret profile), displaySize=512*0.24=122.88
    // Pivot for Smoky M0 dir00: (0.206668, 0.464846)
    // pivotFromCenter.x = (0.206668 - 0.5) * 122.88 = -36.050...
    // pivotFromCenter.y = (0.464846 - 0.5) * 122.88 = -4.317...
    // offset.x = 0 - (-36.050...) = 36.050...
    // offset.y = -15.36 - (-4.317...) = -11.043...

    expect(result.turretOffsetPx).not.toBeNull();
    const offset = result.turretOffsetPx!;

    // socketFromSpritePos
    const hullDisplaySize = 512 * 0.12; // 61.44
    const expectedSocketX = (0.5 - 0.5) * hullDisplaySize; // 0
    const expectedSocketY = (0.5 - 0.75) * hullDisplaySize; // -15.36

    // pivotFromCenter (Smoky M0 dir00 pivot = 0.206668, 0.464846)
    const turretDisplaySize = 512 * 0.24; // 122.88
    const expectedPivotX = (0.206668 - 0.5) * turretDisplaySize;
    const expectedPivotY = (0.464846 - 0.5) * turretDisplaySize;

    const expectedOffsetX = expectedSocketX - expectedPivotX;
    const expectedOffsetY = expectedSocketY - expectedPivotY;

    expect(offset.x).toBeCloseTo(expectedOffsetX, 3);
    expect(offset.y).toBeCloseTo(expectedOffsetY, 3);
  });
});

// ─── Null/fallback when texture missing ───────────────────────────

describe('pilotTurretComposition: null/fallback when texture missing', () => {
  it('returns null turretKey when texture does not exist', () => {
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsNever,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('returns null turretKey when only some textures exist', () => {
    const partialKeys = new Set<string>();
    for (let dir = 1; dir < 16; dir++) {
      partialKeys.add(getGeneratedTurretTextureKey('smoky', 'cyan', 'm0', dir as any));
    }
    const textureExists = (key: string) => partialKeys.has(key);

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('still computes turretOffsetPx even when texture is missing', () => {
    // The offset math doesn't depend on texture existence — only on
    // profile metadata. So it should still be computed.
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsNever,
    );
    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.turretOffsetPx).not.toBeNull();
  });
});

// ─── Null/fallback when socket metadata missing ───────────────────

describe('pilotTurretComposition: null/fallback when socket metadata missing', () => {
  it('returns fallback for unsupported hull (no profile)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'unsupported_body', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.turretOffsetPx).toBeNull();
  });

  it('returns fallback for empty bodyId', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', '', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.turretOffsetPx).toBeNull();
  });
});

// ─── Null/fallback when directional pivot metadata missing ────────

describe('pilotTurretComposition: null/fallback when directional pivot missing', () => {
  it('returns fallback for unsupported weapon (no directional pivot)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'shaft', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.turretKey).toBeNull();
    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.turretOffsetPx).toBeNull();
  });

  it('returns fallback for unknown weapon ID', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'nonexistent_weapon', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.turretOffsetPx).toBeNull();
  });
});

// ─── Exactly one textureExists probe ──────────────────────────────

describe('pilotTurretComposition: exactly one textureExists probe', () => {
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

// ─── Unsupported weapon/body fallback ─────────────────────────────

describe('pilotTurretComposition: unsupported weapon/body fallback', () => {
  it('mammoth IS a valid hull but has no visual profile yet', () => {
    // mammoth is in GENERATED_HULL_IDS but has no HullVisualProfile
    expect(bodyIdToGeneratedHullId('mammoth')).toBe('mammoth');
    expect(resolveHullVisualProfile('mammoth')).toBeNull();
  });

  it('mammoth falls back because no visual profile (no socket metadata)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'mammoth', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.hasGeneratedTurret).toBe(false);
    expect(result.turretOffsetPx).toBeNull();
  });

  it('thunder has turret assets but no directional pivot profile yet', () => {
    // thunder is a valid turret ID, but has no DirectionalTurretMarkerProfile
    expect(resolveTurretPivotForDir('thunder', 0, 0)).toBeNull();
  });

  it('flamethrower maps to firebird turret but has no directional pivot profile', () => {
    // flamethrower → firebird, but no directional pivot for firebird
    expect(resolveTurretPivotForDir('flamethrower', 0, 0)).toBeNull();
  });
});

// ─── Pure placement math ──────────────────────────────────────────

describe('pilotTurretComposition: pure placement math', () => {
  it('returns correct dir16 for known turret angles', () => {
    expect(turretAngleToDir16(0)).toBe(0);
    expect(turretAngleToDir16(Math.PI / 2)).toBe(4);
    expect(turretAngleToDir16(Math.PI)).toBe(8);
    expect(turretAngleToDir16(3 * Math.PI / 2)).toBe(12);
  });

  it('handles negative angles by normalizing', () => {
    expect(turretAngleToDir16(-Math.PI / 2)).toBe(12);
    expect(turretAngleToDir16(-Math.PI)).toBe(8);
  });
});

// ─── Result structure ─────────────────────────────────────────────

describe('pilotTurretComposition: result structure', () => {
  it('returns correct render params when texture exists', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    expect(result.hasGeneratedTurret).toBe(true);
    expect(result.turretKey).toBe('generated_turret_smoky_cyan_m0_dir00');
    expect(result.originX).toBe(0.5);
    expect(result.originY).toBe(0.5);
    expect(result.dir16).toBe(0);
    expect(result.turretOffsetPx).not.toBeNull();
  });

  it('turret origin is always centered (0.5, 0.5)', () => {
    const textureExists = makeTextureExistsWithTurretSet('smoky', 'cyan', 'm0');
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );
    expect(result.originX).toBe(0.5);
    expect(result.originY).toBe(0.5);
  });

  it('respects modification level in texture key', () => {
    const m3Keys = new Set<string>();
    for (let dir = 0; dir < 16; dir++) {
      m3Keys.add(getGeneratedTurretTextureKey('smoky', 'cyan', 'm3', dir as any));
    }
    const textureExists = (key: string) => m3Keys.has(key);

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 3, 0,
      textureExists,
    );

    expect(result.turretKey).toBe('generated_turret_smoky_cyan_m3_dir00');
    expect(result.hasGeneratedTurret).toBe(true);
  });
});

// ─── Standard mode safety ─────────────────────────────────────────

describe('pilotTurretComposition: standard mode safety', () => {
  it('resolver is pure — no side effects on scene', () => {
    let callCount = 0;
    const textureExists = (_key: string) => { callCount++; return false; };

    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExists,
    );

    expect(callCount).toBe(1);
    expect(result.hasGeneratedTurret).toBe(false);
  });

  it('non-Arena vehicles with no textures fall back gracefully', () => {
    const result = resolvePilotTurretComposition(
      'smoky', 'wasp', 'cyan', 0, 0,
      textureExistsNever,
    );
    expect(result.hasGeneratedTurret).toBe(false);
  });
});

// ─── No accidental path strings ────────────────────────────────────

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
