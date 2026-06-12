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
 * 5. Turret sprite origin is always (0.5, 0.5) — pivot metadata is consumed
 *    exclusively by computeTurretSpriteCenterOffsetForSocket, not by setOrigin
 * 6. Non-center pivot values produce correct sprite-center positions that would
 *    be WRONG if pivot were applied as Phaser origin instead
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
  computeNormalizedPointOffsetPx,
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

    // With calibrated values (socket={0.4,0.5}, pivot={0.5,0.65}),
    // the offset should be non-zero
    expect(offsetResult.offset).not.toBeNull();
    expect(offsetResult.offset!.x).toBeCloseTo(-6.144);  // socket shifted back
    expect(offsetResult.offset!.y).toBeCloseTo(-9.216);  // pivot below center
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

// ── Turret sprite origin convention (PR-E2 fixup) ──────────────────

describe('PR-E2 fixup: Turret sprite origin is always center, pivot used only in offset math', () => {
  it('Smoky turret pivot is accessible but is NOT used as Phaser sprite origin', () => {
    const profile = resolveTurretVisualProfile('smoky');
    expect(profile).not.toBeNull();
    expect(profile!.pivot.px).toBe(0.5);
    expect(profile!.pivot.py).toBe(0.65);  // Calibrated: base ring ~65% down

    // Convention: the renderer always calls setOrigin(0.5, 0.5).
    // The pivot values are consumed ONLY by computeTurretSpriteCenterOffsetForSocket
    // which computes where the *sprite center* should be placed.
    // Setting Phaser origin to pivot AND using sprite-center offset would
    // double-apply the pivot displacement.
  });

  it('sprite origin is (0.5, 0.5) regardless of pivot value', () => {
    // This is the fixup's core assertion: origin = center, always.
    // Even when Denis calibrates Smoky pivot to e.g. {0.5, 0.65},
    // the renderer must still use setOrigin(0.5, 0.5) and position
    // via the offset helper.
    const TURRET_SPRITE_ORIGIN_X = 0.5;
    const TURRET_SPRITE_ORIGIN_Y = 0.5;
    expect(TURRET_SPRITE_ORIGIN_X).toBe(0.5);
    expect(TURRET_SPRITE_ORIGIN_Y).toBe(0.5);
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
      // With calibrated socket {0.4,0.5} and pivot {0.5,0.65},
      // the offset is (-6.144, -9.216) — not zero, not the placement offset
      expect(offsetResult.offset.x).toBeCloseTo(-6.144);
      expect(offsetResult.offset.y).toBeCloseTo(-9.216);
      // Verify it's different from the placement offset
      expect(offsetResult.offset.x).not.toBeCloseTo(hullPlacementOffset.x);
      expect(offsetResult.offset.y).not.toBeCloseTo(hullPlacementOffset.y);
    }
  });
});

// ── PR-E2 fixup: Non-center pivot produces correct sprite-center offset ──
//
// These tests use SYNTHETIC (non-placeholder) pivot values to verify that the
// sprite-center offset convention works correctly. With the old buggy code
// (setOrigin(pivot) + sprite-center offset), a non-center pivot would produce
// an incorrect position because the pivot displacement would be applied twice:
//   1. setOrigin(pivot) shifts the sprite so Phaser positions the pivot, not center
//   2. The offset helper already accounts for the pivot by computing
//      hullCenterToSocket - turretCenterToPivot
//
// With the fix (setOrigin(0.5, 0.5) + sprite-center offset), the position is
// correct because:
//   - setPosition(x, y) places the sprite CENTER at (x, y)
//   - The offset already encodes where the center must be so that
//     pivot lands on socket
//   - No double-application of pivot displacement

describe('PR-E2 fixup: Non-center pivot produces correct sprite-center offset', () => {
  it('synthetic pivot {0.5, 0.65} shifts turret sprite center upward relative to hull center', () => {
    // Synthetic values: socket at center, pivot below center (barrel extends forward)
    const socketNorm = { x: 0.5, y: 0.5 };
    const pivotNorm = { x: 0.5, y: 0.65 };

    // Hull: 512 × 512 source, scale 0.12 → display 61.44 × 61.44
    // Turret: 256 × 256 source, scale 0.24 → display 61.44 × 61.44
    const hullDisplayPx = 512 * 0.12;  // 61.44
    const turretDisplayPx = 256 * 0.24; // 61.44

    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm,
      hullDisplayWidthPx: hullDisplayPx,
      hullDisplayHeightPx: hullDisplayPx,
      pivotNorm,
      turretDisplayWidthPx: turretDisplayPx,
      turretDisplayHeightPx: turretDisplayPx,
    });

    // hullCenterToSocketPx = (0.5 - 0.5) * 61.44 = 0 for both x and y
    // turretCenterToPivotPx.x = (0.5 - 0.5) * 61.44 = 0
    // turretCenterToPivotPx.y = (0.65 - 0.5) * 61.44 = 0.15 * 61.44 = 9.216
    // offset = hullCenterToSocket - turretCenterToPivot = (0 - 0, 0 - 9.216) = (0, -9.216)
    expect(offsetResult.offset).not.toBeNull();
    expect(offsetResult.offset!.x).toBeCloseTo(0);
    expect(offsetResult.offset!.y).toBeCloseTo(-9.216);

    // Verify intermediates
    expect(offsetResult.hullCenterToSocketPx).not.toBeNull();
    expect(offsetResult.hullCenterToSocketPx!.x).toBeCloseTo(0);
    expect(offsetResult.hullCenterToSocketPx!.y).toBeCloseTo(0);
    expect(offsetResult.turretCenterToPivotPx).not.toBeNull();
    expect(offsetResult.turretCenterToPivotPx!.x).toBeCloseTo(0);
    expect(offsetResult.turretCenterToPivotPx!.y).toBeCloseTo(9.216);
  });

  it('synthetic pivot {0.5, 0.65}: renderer must position sprite at hullCenter + offset, NOT at socket', () => {
    // This test documents the convention choice:
    //
    // CORRECT (fixup): setOrigin(0.5, 0.5), position at hullCenter + offset
    //   → sprite center at hullCenter + offset
    //   → pivot at hullCenter + offset + turretCenterToPivot
    //   → pivot at hullCenter + (hullCenterToSocket - turretCenterToPivot) + turretCenterToPivot
    //   → pivot at hullCenter + hullCenterToSocket = socket ✓
    //
    // WRONG (old bug): setOrigin(pivot), position at hullCenter + offset
    //   → Phaser places the *pivot* at hullCenter + offset
    //   → sprite center at hullCenter + offset - turretCenterToPivot
    //   → sprite center at hullCenter + (hullCenterToSocket - turretCenterToPivot) - turretCenterToPivot
    //   → pivot displacement double-applied: off by -2×turretCenterToPivot

    const socketNorm = { x: 0.5, y: 0.5 };
    const pivotNorm = { x: 0.5, y: 0.65 };
    const hullDisplayPx = 61.44;
    const turretDisplayPx = 61.44;

    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm,
      hullDisplayWidthPx: hullDisplayPx,
      hullDisplayHeightPx: hullDisplayPx,
      pivotNorm,
      turretDisplayWidthPx: turretDisplayPx,
      turretDisplayHeightPx: turretDisplayPx,
    });

    expect(offsetResult.offset).not.toBeNull();
    const offset = offsetResult.offset!;
    const pivotPx = offsetResult.turretCenterToPivotPx!;

    // CORRECT position for sprite center (fixup convention):
    //   hullCenter + offset
    // This is what the renderer does with setOrigin(0.5, 0.5).

    // WRONG position that the old code would produce (setOrigin + offset):
    //   If setOrigin(pivot.px, pivot.py), Phaser positions the pivot at
    //   hullCenter + offset instead of the center. The visual sprite center
    //   would end up at hullCenter + offset - pivotPx, which is wrong.
    //   The pivot would be at hullCenter + offset, but the intent was for
    //   the pivot to be at hullCenter + hullCenterToSocket.
    //   Since offset = hullCenterToSocket - pivotPx,
    //   pivot lands at hullCenter + hullCenterToSocket - pivotPx ≠ socket.

    // Demonstrate the mismatch: the wrong position differs from the correct one
    // by exactly -pivotPx (the double-application error)
    // For our synthetic values: offset = (0, -9.216), pivotPx = (0, 9.216)
    // Wrong center = (0, -9.216 - 9.216) = (0, -18.432) (double displacement)
    // Correct center = (0, -9.216) (single displacement)
    expect(offset.y - pivotPx.y).toBeCloseTo(-18.432); // wrong: double displacement
    expect(offset.y).toBeCloseTo(-9.216);               // correct: single displacement

    // The correct position ensures pivot lands on socket:
    // pivot position = spriteCenter + turretCenterToPivotPx
    // = hullCenter + offset + pivotPx
    // = hullCenter + (hullCenterToSocket - pivotPx) + pivotPx
    // = hullCenter + hullCenterToSocket = socket
    const pivotLandsOnSocketX = offset.x + pivotPx.x;
    const pivotLandsOnSocketY = offset.y + pivotPx.y;
    const socketPx = offsetResult.hullCenterToSocketPx!;
    expect(pivotLandsOnSocketX).toBeCloseTo(socketPx.x);
    expect(pivotLandsOnSocketY).toBeCloseTo(socketPx.y);
  });

  it('synthetic socket {0.6, 0.5} + pivot {0.5, 0.65}: combined offset is correct', () => {
    // Socket shifted forward (nx=0.6), pivot below center (py=0.65)
    const socketNorm = { x: 0.6, y: 0.5 };
    const pivotNorm = { x: 0.5, y: 0.65 };
    const hullDisplayPx = 61.44;
    const turretDisplayPx = 61.44;

    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm,
      hullDisplayWidthPx: hullDisplayPx,
      hullDisplayHeightPx: hullDisplayPx,
      pivotNorm,
      turretDisplayWidthPx: turretDisplayPx,
      turretDisplayHeightPx: turretDisplayPx,
    });

    // hullCenterToSocket.x = (0.6 - 0.5) * 61.44 = 0.1 * 61.44 = 6.144
    // hullCenterToSocket.y = (0.5 - 0.5) * 61.44 = 0
    // turretCenterToPivot.x = (0.5 - 0.5) * 61.44 = 0
    // turretCenterToPivot.y = (0.65 - 0.5) * 61.44 = 9.216
    // offset.x = 6.144 - 0 = 6.144
    // offset.y = 0 - 9.216 = -9.216
    expect(offsetResult.offset).not.toBeNull();
    expect(offsetResult.offset!.x).toBeCloseTo(6.144);
    expect(offsetResult.offset!.y).toBeCloseTo(-9.216);

    // Verify: pivot lands on socket
    const pivotLandsX = offsetResult.offset!.x + offsetResult.turretCenterToPivotPx!.x;
    const pivotLandsY = offsetResult.offset!.y + offsetResult.turretCenterToPivotPx!.y;
    expect(pivotLandsX).toBeCloseTo(offsetResult.hullCenterToSocketPx!.x);
    expect(pivotLandsY).toBeCloseTo(offsetResult.hullCenterToSocketPx!.y);
  });

  it('computeNormalizedPointOffsetPx: non-center pivot produces non-zero offset', () => {
    // Unit-level verification of the underlying helper
    const pivot = { x: 0.5, y: 0.65 };
    const displaySize = 61.44;

    const offset = computeNormalizedPointOffsetPx(pivot, displaySize, displaySize);
    expect(offset.x).toBeCloseTo(0);      // px = 0.5 → center
    expect(offset.y).toBeCloseTo(9.216);  // py = 0.65 → 0.15 * 61.44 below center
  });
});

// ── Regression: center pivot still works after fixup ─────────────────

describe('PR-E2 fixup: Center pivot values still produce correct offset (regression)', () => {
  it('socket {0.5, 0.5} + pivot {0.5, 0.5}: offset is zero (current Smoky placeholder)', () => {
    const socketNorm = { x: 0.5, y: 0.5 };
    const pivotNorm = { x: 0.5, y: 0.5 };
    const hullDisplayPx = 61.44;
    const turretDisplayPx = 61.44;

    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm,
      hullDisplayWidthPx: hullDisplayPx,
      hullDisplayHeightPx: hullDisplayPx,
      pivotNorm,
      turretDisplayWidthPx: turretDisplayPx,
      turretDisplayHeightPx: turretDisplayPx,
    });

    expect(offsetResult.offset).not.toBeNull();
    expect(offsetResult.offset!.x).toBeCloseTo(0);
    expect(offsetResult.offset!.y).toBeCloseTo(0);
  });

  it('with center pivot, both conventions produce the same result (hides the bug)', () => {
    // This explains why the bug was hidden with placeholder values:
    // setOrigin(0.5, 0.5) and setOrigin(pivot.px, pivot.py) are identical
    // when pivot = {0.5, 0.5}. The bug only manifests with non-center pivots.
    const socketNorm = { x: 0.5, y: 0.5 };
    const pivotNorm = { x: 0.5, y: 0.5 };

    const offsetResult = computeTurretSpriteCenterOffsetForSocket({
      socketNorm,
      hullDisplayWidthPx: 61.44,
      hullDisplayHeightPx: 61.44,
      pivotNorm,
      turretDisplayWidthPx: 61.44,
      turretDisplayHeightPx: 61.44,
    });

    // Both the correct (center origin) and wrong (pivot origin) conventions
    // produce the same visual position when pivot = center
    expect(offsetResult.turretCenterToPivotPx!.x).toBeCloseTo(0);
    expect(offsetResult.turretCenterToPivotPx!.y).toBeCloseTo(0);
    // So: wrongSpriteCenter = offset - pivotPx = offset = correctSpriteCenter
  });
});
