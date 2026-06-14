/**
 * MODULAR-PROOF-01: Tests for the pure generated vehicle preview composition.
 *
 * These tests assert the sprite-space attachment contract used by the proof
 * harness:
 *   - turret pivot lands on hull socket in pure 2D sprite-space (zHeight off);
 *   - visualDir16 is derived correctly for Smoky;
 *   - texture keys match the existing generated assets;
 *   - no zHeight is applied by default;
 *   - the diagnostic zHeight path is clearly separate;
 *   - missing texture / metadata yields a safe unavailable preview;
 *   - the composition is pure (no asset-loading side effects).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  composeGeneratedVehiclePreview,
  type GeneratedVehiclePreviewInput,
} from '../phaser/render/generatedVehiclePreviewComposition';
import type { Faction } from '../state/types';

const ANCHOR = { x: 100, y: 100 };

function pilotInput(
  overrides: Partial<GeneratedVehiclePreviewInput> = {},
): GeneratedVehiclePreviewInput {
  return {
    bodyId: 'wasp',
    weaponId: 'smoky',
    faction: 'cyan' as Faction,
    hullModificationLevel: 0,
    turretModificationLevel: 0,
    bodyDir8: 0,
    turretAngleRad: 0,
    anchor: { ...ANCHOR },
    ...overrides,
  };
}

describe('composeGeneratedVehiclePreview — sprite-space attachment', () => {
  it('places the turret pivot exactly on the hull socket (zHeight off)', () => {
    const r = composeGeneratedVehiclePreview(pilotInput());
    expect(r.turretPivotMarker.x).toBeCloseTo(r.hullSocketMarker.x, 6);
    expect(r.turretPivotMarker.y).toBeCloseTo(r.hullSocketMarker.y, 6);
  });

  it('computes the hull socket marker from socket - origin in sprite-space', () => {
    const r = composeGeneratedVehiclePreview(pilotInput());
    // Wasp socket {0.5,0.5}, origin {0.5,0.75}, hull display 512*0.12 = 61.44
    const hullSize = 512 * 0.12;
    expect(r.hullSocketMarker.x).toBeCloseTo(ANCHOR.x + (0.5 - 0.5) * hullSize, 4);
    expect(r.hullSocketMarker.y).toBeCloseTo(ANCHOR.y + (0.5 - 0.75) * hullSize, 4);
  });

  it('marks the ground anchor at the hull bottom-center', () => {
    const r = composeGeneratedVehiclePreview(pilotInput());
    const hullSize = 512 * 0.12;
    expect(r.groundAnchorMarker.x).toBeCloseTo(ANCHOR.x, 4);
    expect(r.groundAnchorMarker.y).toBeCloseTo(ANCHOR.y + (1 - 0.75) * hullSize, 4);
  });
});

describe('composeGeneratedVehiclePreview — direction remap', () => {
  it('derives Smoky visualDir16 = logical + 4 (facingOffset 2, dir8)', () => {
    // turretAngle 0 → logical dir16 0 → visual 4 (S)
    const r = composeGeneratedVehiclePreview(pilotInput({ turretAngleRad: 0 }));
    expect(r.turretLogicalDir16).toBe(0);
    expect(r.turretVisualDir16).toBe(4);
  });

  it('wraps Smoky visualDir16 across the 16-direction boundary', () => {
    // logical 13 + 4 = 17 → 1
    const r = composeGeneratedVehiclePreview(
      pilotInput({ turretAngleRad: (13 * Math.PI) / 8 }),
    );
    expect(r.turretLogicalDir16).toBe(13);
    expect(r.turretVisualDir16).toBe(1);
  });

  it('derives the Wasp hull visualDir16 via the +4 remap', () => {
    // bodyDir8 0 → logical dir16 0 → wasp visual 4
    const r = composeGeneratedVehiclePreview(pilotInput({ bodyDir8: 0 }));
    expect(r.hullLogicalDir16).toBe(0);
    expect(r.hullVisualDir16).toBe(4);
  });
});

describe('composeGeneratedVehiclePreview — texture keys', () => {
  it('produces keys matching the existing generated assets', () => {
    const r = composeGeneratedVehiclePreview(pilotInput());
    // hull visual dir 4, turret visual dir 4
    expect(r.hullTextureKey).toBe('generated_hull_wasp_cyan_m0_dir04');
    expect(r.turretTextureKey).toBe('generated_turret_smoky_cyan_m0_dir04');
  });
});

describe('composeGeneratedVehiclePreview — zHeight handling', () => {
  it('does NOT apply zHeight by default (sprite-space composition)', () => {
    const r = composeGeneratedVehiclePreview(pilotInput());
    expect(r.zHeightApplied).toBe(false);
    expect(r.zHeightDeltaPx).toEqual({ x: 0, y: 0 });
    // pivot still coincides with socket
    expect(r.turretPivotMarker.y).toBeCloseTo(r.hullSocketMarker.y, 6);
  });

  it('applies the diagnostic zHeight delta ONLY when explicitly enabled', () => {
    const r = composeGeneratedVehiclePreview(
      pilotInput({ zHeightDiagnostic: { enabled: true, basisZScreenY: -60 } }),
    );
    expect(r.zHeightApplied).toBe(true);
    // socket zHeight 0.30 * basisZ.y (-60) = -18
    expect(r.zHeightDeltaPx.y).toBeCloseTo(-18, 6);
    // with the diagnostic on, the turret pivot is lifted off the socket
    expect(r.turretPivotMarker.y).toBeCloseTo(r.hullSocketMarker.y - 18, 6);
  });

  it('leaves the default composition unchanged when the diagnostic is disabled', () => {
    const off = composeGeneratedVehiclePreview(
      pilotInput({ zHeightDiagnostic: { enabled: false, basisZScreenY: -60 } }),
    );
    expect(off.zHeightApplied).toBe(false);
    expect(off.turretPivotMarker.y).toBeCloseTo(off.hullSocketMarker.y, 6);
  });
});

describe('composeGeneratedVehiclePreview — safe fallback', () => {
  it('marks unavailable with reason for an unknown hull', () => {
    const r = composeGeneratedVehiclePreview(pilotInput({ bodyId: 'nope' }));
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no-generated-hull');
    expect(r.hullTextureKey).toBeNull();
    // geometry is still computed (no crash)
    expect(Number.isFinite(r.turretSpritePos.x)).toBe(true);
  });

  it('marks unavailable with reason for a weapon without a generated turret', () => {
    const r = composeGeneratedVehiclePreview(pilotInput({ weaponId: 'shaft' }));
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no-generated-turret');
    expect(r.turretTextureKey).toBeNull();
  });

  it('marks unavailable when a required texture is missing', () => {
    const r = composeGeneratedVehiclePreview(
      pilotInput({ textureExists: () => false }),
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe('texture-missing');
    // keys are still computed for inspection
    expect(r.hullTextureKey).toBe('generated_hull_wasp_cyan_m0_dir04');
  });

  it('is available when textures exist', () => {
    const r = composeGeneratedVehiclePreview(
      pilotInput({ textureExists: () => true }),
    );
    expect(r.available).toBe(true);
    expect(r.reason).toBeNull();
  });
});

describe('composeGeneratedVehiclePreview — purity', () => {
  it('uses textureExists only as a boolean probe (no asset loading)', () => {
    const probe = vi.fn((_key: string) => true);
    composeGeneratedVehiclePreview(pilotInput({ textureExists: probe }));
    // Only probed with string keys, never more than the two required textures
    expect(probe).toHaveBeenCalled();
    for (const call of probe.mock.calls) {
      expect(typeof call[0]).toBe('string');
    }
    expect(probe.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('is deterministic for identical inputs', () => {
    const a = composeGeneratedVehiclePreview(pilotInput({ bodyDir8: 2, turretAngleRad: Math.PI }));
    const b = composeGeneratedVehiclePreview(pilotInput({ bodyDir8: 2, turretAngleRad: Math.PI }));
    expect(a).toEqual(b);
  });

  it('does not require a textureExists callback', () => {
    const r = composeGeneratedVehiclePreview(pilotInput());
    // Without a probe, availability is governed by metadata only
    expect(r.available).toBe(true);
  });
});
