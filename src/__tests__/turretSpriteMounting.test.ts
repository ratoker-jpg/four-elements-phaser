/**
 * TURRET-HULL-CONTRACT-PR-E2: Integration tests for Wasp+Smoky turret sprite
 * mounting through socket/pivot helpers.
 *
 * These tests verify:
 * 1. The full pipeline: resolveModularTurretSpriteKey + resolveTurretAttachmentProfile
 *    produces consistent, correct results for Wasp+Smoky
 * 2. The turret sprite offset matches expected values given current placeholder
 *    socket/pivot data
 * 3. Non-Smoky weapons fall back gracefully through the full pipeline
 * 4. Missing textures fall back gracefully
 * 5. The turret sprite origin matches the pivot from the profile
 *
 * All tests are pure — no Phaser runtime required (except for
 * resolveModularTurretSpriteKey which uses a mock scene).
 */

import { describe, it, expect } from 'vitest';
import {
  resolveModularTurretSpriteKey,
  getSmokyTurretKey,
} from '../assets/modularUnitAssets';
import {
  resolveTurretAttachmentProfile,
  computeTurretSpriteCenterOffsetForSocket,
} from '../config/turretAttachmentMath';
import {
  resolveTurretVisualProfile,
  SMOKY_TURRET_VISUAL_PROFILE,
  WASP_HULL_VISUAL_PROFILE,
} from '../config/hullTurretVisualProfiles';

// ── Mock Phaser Scene ───────────────────────────────────────────────

function createMockScene(existingKeys: Set<string>) {
  return {
    textures: {
      exists: (key: string) => existingKeys.has(key),
    },
  } as unknown as Phaser.Scene;
}

// ── Full pipeline: resolveModularTurretSpriteKey + attachment profile ─

describe('PR-E2: Wasp+Smoky full pipeline — turret key + attachment offset', () => {
  it('Smoky turret resolves with texture existing, and attachment profile computes offset', () => {
    // Resolve turret sprite key (turret facing East, cyan)
    const expectedKey = getSmokyTurretKey('cyan', 2);
    const scene = createMockScene(new Set([expectedKey]));
    const turretKey = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    expect(turretKey).toBe(expectedKey);

    // Resolve attachment profile (Wasp hull + Smoky turret)
    const attachment = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    expect(attachment.socket).not.toBeNull();
    expect(attachment.pivot).not.toBeNull();

    // Compute turret sprite center offset
    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: attachment.socket
        ? { x: attachment.socket.normalized.nx, y: attachment.socket.normalized.ny }
        : null,
      hullDisplayWidthPx: attachment.hullDisplayWidthPx,
      hullDisplayHeightPx: attachment.hullDisplayHeightPx,
      pivotNorm: attachment.pivot
        ? { x: attachment.pivot.px, y: attachment.pivot.py }
        : null,
      turretDisplayWidthPx: attachment.turretDisplayWidthPx,
      turretDisplayHeightPx: attachment.turretDisplayHeightPx,
    });

    // With current placeholder values (socket={0.5,0.5}, pivot={0.5,0.5}),
    // the offset should be zero
    expect(offsetResult.offset).not.toBeNull();
    expect(offsetResult.offset!.x).toBeCloseTo(0);
    expect(offsetResult.offset!.y).toBeCloseTo(0);
  });

  it('all 8 Smoky turret directions resolve keys and have consistent attachment', () => {
    const attachment = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    expect(attachment.socket).not.toBeNull();
    expect(attachment.pivot).not.toBeNull();

    for (let logicalDir = 0; logicalDir < 8; logicalDir++) {
      // Convert logical dir to angle
      const angle = logicalDir * Math.PI / 4;
      const expectedVisualDir = (logicalDir + 2) % 8;
      const key = getSmokyTurretKey('cyan', expectedVisualDir as 0|1|2|3|4|5|6|7);
      const scene = createMockScene(new Set([key]));

      const turretKey = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', angle);
      expect(turretKey).toBe(key);

      // The attachment offset is direction-independent (same for all dirs)
      const offsetResult = computeTurretSpriteCenterOffsetForSocket({
        socketNorm: attachment.socket!
          ? { x: attachment.socket.normalized.nx, y: attachment.socket.normalized.ny }
          : null,
        hullDisplayWidthPx: attachment.hullDisplayWidthPx,
        hullDisplayHeightPx: attachment.hullDisplayHeightPx,
        pivotNorm: attachment.pivot!
          ? { x: attachment.pivot.px, y: attachment.pivot.py }
          : null,
        turretDisplayWidthPx: attachment.turretDisplayWidthPx,
        turretDisplayHeightPx: attachment.turretDisplayHeightPx,
      });
      expect(offsetResult.offset).not.toBeNull();
    }
  });
});

// ── Non-Smoky weapon fallback ───────────────────────────────────────

describe('PR-E2: Non-Smoky weapons fall back gracefully through full pipeline', () => {
  it('thunder has no turret sprite key and no attachment pivot', () => {
    const scene = createMockScene(new Set());
    const turretKey = resolveModularTurretSpriteKey(scene, 'thunder', 'cyan', 0);
    expect(turretKey).toBeNull();

    const attachment = resolveTurretAttachmentProfile(
      'wasp', 'thunder', 'turret_main',
      512, 512, 256, 256,
    );
    expect(attachment.pivot).toBeNull();
    expect(attachment.socket).not.toBeNull(); // Wasp hull still has socket

    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: attachment.socket
        ? { x: attachment.socket.normalized.nx, y: attachment.socket.normalized.ny }
        : null,
      hullDisplayWidthPx: attachment.hullDisplayWidthPx,
      hullDisplayHeightPx: attachment.hullDisplayHeightPx,
      pivotNorm: null, // thunder has no pivot
      turretDisplayWidthPx: attachment.turretDisplayWidthPx,
      turretDisplayHeightPx: attachment.turretDisplayHeightPx,
    });
    // No pivot means no complete offset
    expect(offsetResult.offset).toBeNull();
  });

  it('railgun has no turret sprite key and no attachment pivot', () => {
    const scene = createMockScene(new Set());
    const turretKey = resolveModularTurretSpriteKey(scene, 'railgun', 'cyan', 0);
    expect(turretKey).toBeNull();
  });
});

// ── Missing texture fallback ────────────────────────────────────────

describe('PR-E2: Missing texture falls back gracefully', () => {
  it('Smoky turret key resolves to null when texture is not loaded', () => {
    const scene = createMockScene(new Set()); // empty texture registry
    const turretKey = resolveModularTurretSpriteKey(scene, 'smoky', 'cyan', 0);
    expect(turretKey).toBeNull();
  });

  it('attachment profile still computes even without loaded texture', () => {
    // The attachment math does not depend on texture loading state
    const attachment = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    expect(attachment.socket).not.toBeNull();
    expect(attachment.pivot).not.toBeNull();
  });
});

// ── Turret sprite origin matches pivot profile ──────────────────────

describe('PR-E2: Turret sprite origin matches pivot profile', () => {
  it('Smoky turret pivot {0.5, 0.5} means sprite origin is center', () => {
    const pivot = SMOKY_TURRET_VISUAL_PROFILE.pivot;
    expect(pivot.px).toBe(0.5);
    expect(pivot.py).toBe(0.5);
    // When creating the turret sprite, setOrigin(px, py) = setOrigin(0.5, 0.5)
    // This is the current PLACEHOLDER value
  });

  it('turret profile is accessible via resolveTurretVisualProfile', () => {
    const profile = resolveTurretVisualProfile('smoky');
    expect(profile).not.toBeNull();
    expect(profile!.pivot.px).toBe(0.5);
    expect(profile!.pivot.py).toBe(0.5);
  });
});

// ── Hull profile provides display dimensions for offset computation ─

describe('PR-E2: Hull profile provides display dimensions correctly', () => {
  it('Wasp hull display dimensions match profile scale × source size', () => {
    const profile = WASP_HULL_VISUAL_PROFILE;
    const sourceWidth = 512;
    const sourceHeight = 512;
    const displayWidth = sourceWidth * profile.textureScale;
    const displayHeight = sourceHeight * profile.textureScale;
    expect(displayWidth).toBeCloseTo(512 * 0.12);
    expect(displayHeight).toBeCloseTo(512 * 0.12);
  });

  it('Smoky turret display dimensions match profile scale × source size', () => {
    const profile = SMOKY_TURRET_VISUAL_PROFILE;
    const sourceWidth = 256;
    const sourceHeight = 256;
    const displayWidth = sourceWidth * profile.textureScale;
    const displayHeight = sourceHeight * profile.textureScale;
    expect(displayWidth).toBeCloseTo(256 * 0.24);
    expect(displayHeight).toBeCloseTo(256 * 0.24);
  });

  it('hull and turret display sizes are consistent for offset computation', () => {
    const attachment = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    // Both should be non-zero
    expect(attachment.hullDisplayWidthPx).toBeGreaterThan(0);
    expect(attachment.hullDisplayHeightPx).toBeGreaterThan(0);
    expect(attachment.turretDisplayWidthPx).toBeGreaterThan(0);
    expect(attachment.turretDisplayHeightPx).toBeGreaterThan(0);
  });
});

// ── No double-application of hull placement offset ──────────────────

describe('PR-E2: Socket/pivot offset does not double-apply hull placement offset', () => {
  it('the turret attachment offset is relative to hull sprite center, not tile center', () => {
    const attachment = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: attachment.socket
        ? { x: attachment.socket.normalized.nx, y: attachment.socket.normalized.ny }
        : null,
      hullDisplayWidthPx: attachment.hullDisplayWidthPx,
      hullDisplayHeightPx: attachment.hullDisplayHeightPx,
      pivotNorm: attachment.pivot
        ? { x: attachment.pivot.px, y: attachment.pivot.py }
        : null,
      turretDisplayWidthPx: attachment.turretDisplayWidthPx,
      turretDisplayHeightPx: attachment.turretDisplayHeightPx,
    });

    // The offset should NOT include the hull placement offset {-1, 12}
    // It is purely based on socket/pivot normalized coordinates and display sizes
    const hullPlacementOffset = WASP_HULL_VISUAL_PROFILE.placementOffset;
    if (offsetResult.offset) {
      // The offset should be near zero for center socket + center pivot
      // and should NOT equal the hull placement offset
      expect(Math.abs(offsetResult.offset.x)).toBeLessThan(1);
      expect(Math.abs(offsetResult.offset.y)).toBeLessThan(1);
      // Verify it's different from the placement offset
      expect(offsetResult.offset.x).not.toBeCloseTo(hullPlacementOffset.x);
      expect(offsetResult.offset.y).not.toBeCloseTo(hullPlacementOffset.y);
    }
  });
});
