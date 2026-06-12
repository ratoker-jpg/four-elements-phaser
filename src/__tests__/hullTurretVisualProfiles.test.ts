/**
 * TURRET-HULL-CONTRACT-PR-B: Tests for the read-only visual profile layer.
 *
 * These tests verify:
 * 1. Profile resolution (Wasp resolves, Smoky resolves, unknown → null)
 * 2. Direction remap parity with existing WASP_HULL_VISUAL_DIR16_REMAP
 * 3. Direction remap parity with PR #255 Smoky turret behavior
 * 4. remapVisualDir determinism
 * 5. Socket and pivot metadata are read-only and renderer-independent
 * 6. Profile constants match live exported constants (drift guard)
 *
 * All tests are pure — no Phaser runtime required.
 */

import { describe, it, expect } from 'vitest';
import {
  WASP_HULL_VISUAL_PROFILE,
  SMOKY_TURRET_VISUAL_PROFILE,
  remapVisualDir,
  WASP_HULL_DIRECTION_REMAP_PROFILE,
  resolveHullVisualProfile,
  resolveTurretVisualProfile,
  resolveSocketMetadata,
  resolveTurretPivot,
  type DirectionRemapProfile,
} from '../config/hullTurretVisualProfiles';
import {
  GENERATED_HULL_SCALE,
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
  WASP_HULL_OFFSET_X,
  WASP_HULL_OFFSET_Y,
  WASP_HULL_VISUAL_DIR16_REMAP,
} from '../assets/generatedHullAssets';
import { MODULAR_RENDER_SCALE } from '../config/unitRenderConfig';

// ── Profile resolution tests ───────────────────────────────────────

describe('resolveHullVisualProfile', () => {
  it('resolves the Wasp hull profile', () => {
    const profile = resolveHullVisualProfile('wasp');
    expect(profile).not.toBeNull();
    expect(profile!.hullId).toBe('wasp');
    expect(profile!.family).toBe('generated');
  });

  it('returns null for an unknown hull', () => {
    expect(resolveHullVisualProfile('hornet')).toBeNull();
    expect(resolveHullVisualProfile('nonexistent')).toBeNull();
    expect(resolveHullVisualProfile('')).toBeNull();
  });
});

describe('resolveTurretVisualProfile', () => {
  it('resolves the Smoky turret profile', () => {
    const profile = resolveTurretVisualProfile('smoky');
    expect(profile).not.toBeNull();
    expect(profile!.weaponId).toBe('smoky');
    expect(profile!.family).toBe('legacy');
  });

  it('returns null for an unsupported weapon', () => {
    expect(resolveTurretVisualProfile('thunder')).toBeNull();
    expect(resolveTurretVisualProfile('railgun')).toBeNull();
    expect(resolveTurretVisualProfile('')).toBeNull();
  });
});

// ── Direction remap parity tests (regression lock) ─────────────────

describe('remapVisualDir — Wasp hull parity with WASP_HULL_VISUAL_DIR16_REMAP', () => {
  it('reproduces every row of WASP_HULL_VISUAL_DIR16_REMAP', () => {
    const profile = WASP_HULL_VISUAL_PROFILE.direction;
    for (let logical = 0; logical < 16; logical++) {
      const expected = WASP_HULL_VISUAL_DIR16_REMAP[logical];
      const actual = remapVisualDir(logical, profile);
      expect(actual).toBe(expected);
    }
  });
});

describe('remapVisualDir — Smoky turret cardinal directions', () => {
  it('maps East (0) → dir2 (Smoky facingOffset=2)', () => {
    expect(remapVisualDir(0, SMOKY_TURRET_VISUAL_PROFILE.direction)).toBe(2);
  });

  it('maps South (2) → dir4', () => {
    expect(remapVisualDir(2, SMOKY_TURRET_VISUAL_PROFILE.direction)).toBe(4);
  });

  it('maps West (4) → dir6', () => {
    expect(remapVisualDir(4, SMOKY_TURRET_VISUAL_PROFILE.direction)).toBe(6);
  });

  it('maps North (6) → dir0 (wraps)', () => {
    expect(remapVisualDir(6, SMOKY_TURRET_VISUAL_PROFILE.direction)).toBe(0);
  });
});

// ── Hull ≠ turret offset divergence test (audit RC-3 guard) ────────

describe('remapVisualDir — hull and turret offsets are independent', () => {
  it('a synthetic profile with different facingOffset produces a different result', () => {
    const hullRemap = WASP_HULL_VISUAL_PROFILE.direction;  // {16, 4}
    const turretRemap = SMOKY_TURRET_VISUAL_PROFILE.direction;  // {8, 2}

    // Same logical direction 0 produces different visual dirs for hull vs turret
    // (they have different dirCounts so direct comparison isn't meaningful,
    // but the facing offsets are independently declared)
    expect(hullRemap.facingOffset).toBe(4);
    expect(turretRemap.facingOffset).toBe(2);
    expect(hullRemap.dirCount).not.toBe(turretRemap.dirCount);

    // A hypothetical second turret with offset=0 would differ from Smoky's +2
    const noOffset: DirectionRemapProfile = { dirCount: 8, facingOffset: 0 };
    expect(remapVisualDir(0, noOffset)).toBe(0);
    expect(remapVisualDir(0, turretRemap)).toBe(2);  // Smoky adds +2
  });
});

// ── Determinism tests ──────────────────────────────────────────────

describe('remapVisualDir — determinism', () => {
  it('returns the same result for the same inputs', () => {
    const profile = WASP_HULL_VISUAL_PROFILE.direction;
    for (let dir = 0; dir < 16; dir++) {
      const a = remapVisualDir(dir, profile);
      const b = remapVisualDir(dir, profile);
      expect(a).toBe(b);
    }
  });

  it('handles negative facingOffset correctly', () => {
    const profile: DirectionRemapProfile = { dirCount: 8, facingOffset: -2 };
    // (-2 + 8) mod 8 = 6
    expect(remapVisualDir(0, profile)).toBe(6);
    expect(remapVisualDir(2, profile)).toBe(0);
  });

  it('handles zero facingOffset (identity)', () => {
    const identity: DirectionRemapProfile = { dirCount: 16, facingOffset: 0 };
    for (let dir = 0; dir < 16; dir++) {
      expect(remapVisualDir(dir, identity)).toBe(dir);
    }
  });

  it('handles facingOffset equal to dirCount (no-op)', () => {
    const profile: DirectionRemapProfile = { dirCount: 8, facingOffset: 8 };
    for (let dir = 0; dir < 8; dir++) {
      expect(remapVisualDir(dir, profile)).toBe(dir);
    }
  });
});

// ── Socket and pivot metadata tests ────────────────────────────────

describe('resolveSocketMetadata', () => {
  it('resolves turret_main socket from Wasp hull', () => {
    const socket = resolveSocketMetadata(WASP_HULL_VISUAL_PROFILE, 'turret_main');
    expect(socket).not.toBeNull();
    expect(socket!.id).toBe('turret_main');
    expect(socket!.normalized.nx).toBe(0.5);
    expect(socket!.normalized.ny).toBe(0.5);
    expect(socket!.zHeight).toBe(0.30);
  });

  it('returns null for a nonexistent socket id', () => {
    expect(resolveSocketMetadata(WASP_HULL_VISUAL_PROFILE, 'side_mount')).toBeNull();
  });

  it('returns null when hull profile is null', () => {
    expect(resolveSocketMetadata(null, 'turret_main')).toBeNull();
  });

  it('socket data does not depend on renderer state', () => {
    // Sockets are static data; the same call always returns the same result
    const a = resolveSocketMetadata(WASP_HULL_VISUAL_PROFILE, 'turret_main');
    const b = resolveSocketMetadata(WASP_HULL_VISUAL_PROFILE, 'turret_main');
    expect(a).toEqual(b);
  });
});

describe('resolveTurretPivot', () => {
  it('resolves Smoky turret pivot', () => {
    const pivot = resolveTurretPivot(SMOKY_TURRET_VISUAL_PROFILE);
    expect(pivot).not.toBeNull();
    expect(pivot!.px).toBe(0.5);
    expect(pivot!.py).toBe(0.5);  // PLACEHOLDER
  });

  it('returns null when turret profile is null', () => {
    expect(resolveTurretPivot(null)).toBeNull();
  });

  it('pivot data does not depend on renderer state', () => {
    const a = resolveTurretPivot(SMOKY_TURRET_VISUAL_PROFILE);
    const b = resolveTurretPivot(SMOKY_TURRET_VISUAL_PROFILE);
    expect(a).toEqual(b);
  });
});

// ── Drift guard tests (profile constants == live exported constants) ─

describe('Profile constants parity with existing exports', () => {
  it('Wasp hull profile matches GENERATED_HULL_SCALE', () => {
    expect(WASP_HULL_VISUAL_PROFILE.textureScale).toBe(GENERATED_HULL_SCALE);
  });

  it('Wasp hull profile matches GENERATED_HULL_ORIGIN_X/Y', () => {
    expect(WASP_HULL_VISUAL_PROFILE.origin.x).toBe(GENERATED_HULL_ORIGIN_X);
    expect(WASP_HULL_VISUAL_PROFILE.origin.y).toBe(GENERATED_HULL_ORIGIN_Y);
  });

  it('Wasp hull profile matches WASP_HULL_OFFSET_X/Y', () => {
    expect(WASP_HULL_VISUAL_PROFILE.placementOffset.x).toBe(WASP_HULL_OFFSET_X);
    expect(WASP_HULL_VISUAL_PROFILE.placementOffset.y).toBe(WASP_HULL_OFFSET_Y);
  });

  it('Smoky turret profile matches MODULAR_RENDER_SCALE', () => {
    expect(SMOKY_TURRET_VISUAL_PROFILE.textureScale).toBe(MODULAR_RENDER_SCALE);
  });

  it('Wasp direction remap reproduces WASP_HULL_VISUAL_DIR16_REMAP for all 16 dirs', () => {
    const profile = WASP_HULL_VISUAL_PROFILE.direction;
    for (let logical = 0; logical < 16; logical++) {
      const expected = WASP_HULL_VISUAL_DIR16_REMAP[logical];
      expect(remapVisualDir(logical, profile)).toBe(expected);
    }
  });
});

// ── Even-dir-only invariant ────────────────────────────────────────

describe('Wasp hull usesEvenDirOnly invariant', () => {
  it('Wasp profile declares usesEvenDirOnly = true', () => {
    expect(WASP_HULL_VISUAL_PROFILE.usesEvenDirOnly).toBe(true);
  });

  it('remapVisualDir with wasp profile never produces odd dir16 for even logical dir16', () => {
    // When input is even (0,2,4,...,14) — which is all the runtime ever uses
    // due to 8-dir quantization → ×2 doubling — output should also be even.
    const profile = WASP_HULL_VISUAL_PROFILE.direction;
    for (let logical = 0; logical < 16; logical += 2) {
      const result = remapVisualDir(logical, profile);
      expect(result % 2).toBe(0);
    }
  });
});

// ── PR-C: re-exported profile parity ───────────────────────────────

describe('PR-C re-exported WASP_HULL_DIRECTION_REMAP_PROFILE', () => {
  it('matches WASP_HULL_VISUAL_PROFILE.direction', () => {
    expect(WASP_HULL_DIRECTION_REMAP_PROFILE).toEqual(WASP_HULL_VISUAL_PROFILE.direction);
  });

  it('reproduces WASP_HULL_VISUAL_DIR16_REMAP for all 16 dirs', () => {
    for (let logical = 0; logical < 16; logical++) {
      const expected = WASP_HULL_VISUAL_DIR16_REMAP[logical];
      expect(remapVisualDir(logical, WASP_HULL_DIRECTION_REMAP_PROFILE)).toBe(expected);
    }
  });
});
