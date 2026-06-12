/**
 * TURRET-HULL-CONTRACT-PR-E1: Tests for socket/pivot attachment math helpers.
 *
 * These tests verify:
 * 1. Wasp hull socket profile resolves
 * 2. Smoky turret pivot profile resolves
 * 3. Missing hull returns null
 * 4. Missing turret returns null
 * 5. Missing socket returns null or fallback
 * 6. Normalized point to px offset math is correct
 * 7. Turret center offset formula is correct
 * 8. Helpers are pure and do not require Phaser runtime
 * 9. Existing PR-B/PR-C/PR-D tests stay green
 * 10. No renderer behavior changes
 *
 * All tests are pure — no Phaser runtime required.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveHullSocketProfile,
  resolveTurretPivotProfile,
  computeNormalizedPointOffsetPx,
  computeTurretSpriteCenterOffsetForSocket,
  resolveTurretAttachmentProfile,
} from '../config/turretAttachmentMath';
import {
  WASP_HULL_VISUAL_PROFILE,
  SMOKY_TURRET_VISUAL_PROFILE,
} from '../config/hullTurretVisualProfiles';

// ── Test 1: Wasp hull socket profile resolves ────────────────────────

describe('resolveHullSocketProfile — Wasp hull', () => {
  it('resolves the turret_main socket from Wasp hull', () => {
    const socket = resolveHullSocketProfile('wasp', 'turret_main');
    expect(socket).not.toBeNull();
    expect(socket!.id).toBe('turret_main');
    expect(socket!.normalized.nx).toBe(0.4);  // Calibrated: slightly behind center
    expect(socket!.normalized.ny).toBe(0.5);
    expect(socket!.zHeight).toBe(0.30);
  });

  it('returns the same socket data as WASP_HULL_VISUAL_PROFILE.sockets[0]', () => {
    const socket = resolveHullSocketProfile('wasp', 'turret_main');
    const directSocket = WASP_HULL_VISUAL_PROFILE.sockets.find(s => s.id === 'turret_main');
    expect(socket).toEqual(directSocket ?? null);
  });
});

// ── Test 2: Smoky turret pivot profile resolves ──────────────────────

describe('resolveTurretPivotProfile — Smoky turret', () => {
  it('resolves the Smoky turret pivot', () => {
    const pivot = resolveTurretPivotProfile('smoky');
    expect(pivot).not.toBeNull();
    expect(pivot!.px).toBe(0.5);
    expect(pivot!.py).toBe(0.65); // Calibrated: base ring ~65% down
  });

  it('returns the same pivot data as SMOKY_TURRET_VISUAL_PROFILE.pivot', () => {
    const pivot = resolveTurretPivotProfile('smoky');
    expect(pivot).toEqual(SMOKY_TURRET_VISUAL_PROFILE.pivot);
  });
});

// ── Test 3: Missing hull returns null ────────────────────────────────

describe('resolveHullSocketProfile — missing hull', () => {
  it('returns null for hornet (no profile yet)', () => {
    expect(resolveHullSocketProfile('hornet', 'turret_main')).toBeNull();
  });

  it('returns null for nonexistent hull', () => {
    expect(resolveHullSocketProfile('nonexistent', 'turret_main')).toBeNull();
  });

  it('returns null for empty string hullId', () => {
    expect(resolveHullSocketProfile('', 'turret_main')).toBeNull();
  });
});

// ── Test 4: Missing turret returns null ──────────────────────────────

describe('resolveTurretPivotProfile — missing turret', () => {
  it('returns null for thunder (no profile yet)', () => {
    expect(resolveTurretPivotProfile('thunder')).toBeNull();
  });

  it('returns null for railgun', () => {
    expect(resolveTurretPivotProfile('railgun')).toBeNull();
  });

  it('returns null for empty string weaponId', () => {
    expect(resolveTurretPivotProfile('')).toBeNull();
  });
});

// ── Test 5: Missing socket returns null ──────────────────────────────

describe('resolveHullSocketProfile — missing socket', () => {
  it('returns null for a nonexistent socket on Wasp hull', () => {
    expect(resolveHullSocketProfile('wasp', 'side_mount')).toBeNull();
  });

  it('returns null for a nonexistent socket on unknown hull', () => {
    expect(resolveHullSocketProfile('hornet', 'turret_main')).toBeNull();
  });

  it('returns null for empty string socketId', () => {
    expect(resolveHullSocketProfile('wasp', '')).toBeNull();
  });
});

// ── Test 6: Normalized point to px offset math ───────────────────────

describe('computeNormalizedPointOffsetPx — math correctness', () => {
  it('{0.5, 0.5} (center) => {0, 0}', () => {
    const result = computeNormalizedPointOffsetPx({ x: 0.5, y: 0.5 }, 100, 200);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('{0, 0} (top-left) => {-width/2, -height/2}', () => {
    const result = computeNormalizedPointOffsetPx({ x: 0, y: 0 }, 100, 200);
    expect(result.x).toBe(-50);
    expect(result.y).toBe(-100);
  });

  it('{1, 1} (bottom-right) => {width/2, height/2}', () => {
    const result = computeNormalizedPointOffsetPx({ x: 1, y: 1 }, 100, 200);
    expect(result.x).toBe(50);
    expect(result.y).toBe(100);
  });

  it('{0.75, 0.25} => {0.25*width, -0.25*height}', () => {
    const result = computeNormalizedPointOffsetPx({ x: 0.75, y: 0.25 }, 200, 400);
    expect(result.x).toBe(0.25 * 200);
    expect(result.y).toBe(-0.25 * 400);
  });

  it('works with typical Wasp socket {0.5, 0.5} at hull display size', () => {
    // Wasp hull: source 512x512, scale 0.12 → display 61.44 x 61.44
    const displayW = 512 * 0.12;
    const displayH = 512 * 0.12;
    const result = computeNormalizedPointOffsetPx({ x: 0.5, y: 0.5 }, displayW, displayH);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('works with off-center normalized point', () => {
    // If socket is at {0.6, 0.4} (slightly forward-left)
    const displayW = 100;
    const displayH = 100;
    const result = computeNormalizedPointOffsetPx({ x: 0.6, y: 0.4 }, displayW, displayH);
    expect(result.x).toBeCloseTo(10);    // (0.6 - 0.5) * 100
    expect(result.y).toBeCloseTo(-10);   // (0.4 - 0.5) * 100
  });
});

// ── Test 7: Turret center offset formula ──────────────────────────────

describe('computeTurretSpriteCenterOffsetForSocket — formula correctness', () => {
  it('center socket + center pivot => zero offset (both at image center)', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: { x: 0.5, y: 0.5 },
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 100,
      pivotNorm: { x: 0.5, y: 0.5 },
      turretDisplayWidthPx: 60,
      turretDisplayHeightPx: 60,
    });
    expect(result.offset).not.toBeNull();
    expect(result.offset!.x).toBe(0);
    expect(result.offset!.y).toBe(0);
    expect(result.hullCenterToSocketPx).not.toBeNull();
    expect(result.hullCenterToSocketPx!.x).toBe(0);
    expect(result.hullCenterToSocketPx!.y).toBe(0);
    expect(result.turretCenterToPivotPx).not.toBeNull();
    expect(result.turretCenterToPivotPx!.x).toBe(0);
    expect(result.turretCenterToPivotPx!.y).toBe(0);
  });

  it('off-center socket + center pivot => offset equals hull center to socket', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: { x: 0.7, y: 0.3 },
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 200,
      pivotNorm: { x: 0.5, y: 0.5 },
      turretDisplayWidthPx: 60,
      turretDisplayHeightPx: 60,
    });
    expect(result.offset).not.toBeNull();
    // hullCenterToSocket = (0.7-0.5)*100, (0.3-0.5)*200 = (20, -40)
    // turretCenterToPivot = (0, 0)
    // offset = (20 - 0, -40 - 0) = (20, -40)
    expect(result.offset!.x).toBeCloseTo(20);
    expect(result.offset!.y).toBeCloseTo(-40);
    expect(result.hullCenterToSocketPx!.x).toBeCloseTo(20);
    expect(result.hullCenterToSocketPx!.y).toBeCloseTo(-40);
    expect(result.turretCenterToPivotPx!.x).toBe(0);
    expect(result.turretCenterToPivotPx!.y).toBe(0);
  });

  it('center socket + off-center pivot => offset negates turret center to pivot', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: { x: 0.5, y: 0.5 },
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 100,
      pivotNorm: { x: 0.6, y: 0.7 },
      turretDisplayWidthPx: 80,
      turretDisplayHeightPx: 80,
    });
    expect(result.offset).not.toBeNull();
    // hullCenterToSocket = (0, 0)
    // turretCenterToPivot = (0.6-0.5)*80, (0.7-0.5)*80 = (8, 16)
    // offset = (0 - 8, 0 - 16) = (-8, -16)
    expect(result.offset!.x).toBeCloseTo(-8);
    expect(result.offset!.y).toBeCloseTo(-16);
    expect(result.hullCenterToSocketPx!.x).toBe(0);
    expect(result.hullCenterToSocketPx!.y).toBe(0);
    expect(result.turretCenterToPivotPx!.x).toBeCloseTo(8);
    expect(result.turretCenterToPivotPx!.y).toBeCloseTo(16);
  });

  it('off-center socket + off-center pivot => combined offset', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: { x: 0.8, y: 0.6 },
      hullDisplayWidthPx: 200,
      hullDisplayHeightPx: 200,
      pivotNorm: { x: 0.3, y: 0.8 },
      turretDisplayWidthPx: 100,
      turretDisplayHeightPx: 100,
    });
    expect(result.offset).not.toBeNull();
    // hullCenterToSocket = (0.8-0.5)*200, (0.6-0.5)*200 = (60, 20)
    // turretCenterToPivot = (0.3-0.5)*100, (0.8-0.5)*100 = (-20, 30)
    // offset = (60 - (-20), 20 - 30) = (80, -10)
    expect(result.offset!.x).toBeCloseTo(80);
    expect(result.offset!.y).toBeCloseTo(-10);
  });

  it('null socket => offset is null, hullCenterToSocketPx is null', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: null,
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 100,
      pivotNorm: { x: 0.5, y: 0.5 },
      turretDisplayWidthPx: 60,
      turretDisplayHeightPx: 60,
    });
    expect(result.offset).toBeNull();
    expect(result.hullCenterToSocketPx).toBeNull();
    expect(result.turretCenterToPivotPx).not.toBeNull();
  });

  it('null pivot => offset is null, turretCenterToPivotPx is null', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: { x: 0.5, y: 0.5 },
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 100,
      pivotNorm: null,
      turretDisplayWidthPx: 60,
      turretDisplayHeightPx: 60,
    });
    expect(result.offset).toBeNull();
    expect(result.hullCenterToSocketPx).not.toBeNull();
    expect(result.turretCenterToPivotPx).toBeNull();
  });

  it('both null => everything is null', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: null,
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 100,
      pivotNorm: null,
      turretDisplayWidthPx: 60,
      turretDisplayHeightPx: 60,
    });
    expect(result.offset).toBeNull();
    expect(result.hullCenterToSocketPx).toBeNull();
    expect(result.turretCenterToPivotPx).toBeNull();
  });

  it('Wasp+Smoky with calibrated values gives non-zero offset', () => {
    // Socket at {0.4, 0.5} (slightly behind center), pivot at {0.5, 0.65} (base ring below center)
    const hullDisplayW = 512 * 0.12;  // 61.44
    const hullDisplayH = 512 * 0.12;  // 61.44
    const turretDisplayW = 256 * 0.24;  // 61.44
    const turretDisplayH = 256 * 0.24;  // 61.44

    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: { x: 0.4, y: 0.5 },
      hullDisplayWidthPx: hullDisplayW,
      hullDisplayHeightPx: hullDisplayH,
      pivotNorm: { x: 0.5, y: 0.65 },
      turretDisplayWidthPx: turretDisplayW,
      turretDisplayHeightPx: turretDisplayH,
    });
    // hullCenterToSocket = (0.4-0.5)*61.44 = -6.144, (0.5-0.5)*61.44 = 0
    // turretCenterToPivot = (0.5-0.5)*61.44 = 0, (0.65-0.5)*61.44 = 9.216
    // offset = (-6.144 - 0, 0 - 9.216) = (-6.144, -9.216)
    expect(result.offset).not.toBeNull();
    expect(result.offset!.x).toBeCloseTo(-6.144);
    expect(result.offset!.y).toBeCloseTo(-9.216);
  });
});

// ── Test 8: Helpers are pure and do not require Phaser runtime ────────

describe('Pure helpers — no Phaser runtime required', () => {
  it('resolveHullSocketProfile works without any scene or DOM', () => {
    const socket = resolveHullSocketProfile('wasp', 'turret_main');
    expect(socket).not.toBeNull();
    expect(socket!.id).toBe('turret_main');
  });

  it('resolveTurretPivotProfile works without any scene or DOM', () => {
    const pivot = resolveTurretPivotProfile('smoky');
    expect(pivot).not.toBeNull();
    expect(pivot!.px).toBe(0.5);
  });

  it('computeNormalizedPointOffsetPx works without any scene or DOM', () => {
    const result = computeNormalizedPointOffsetPx({ x: 0.5, y: 0.5 }, 100, 100);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('computeTurretSpriteCenterOffsetForSocket works without any scene or DOM', () => {
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: { x: 0.5, y: 0.5 },
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 100,
      pivotNorm: { x: 0.5, y: 0.5 },
      turretDisplayWidthPx: 60,
      turretDisplayHeightPx: 60,
    });
    expect(result.offset).not.toBeNull();
  });

  it('resolveTurretAttachmentProfile works without any scene or DOM', () => {
    const profile = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    expect(profile.socket).not.toBeNull();
    expect(profile.pivot).not.toBeNull();
  });

  it('all helpers return consistent results on repeated calls', () => {
    const a1 = resolveHullSocketProfile('wasp', 'turret_main');
    const a2 = resolveHullSocketProfile('wasp', 'turret_main');
    expect(a1).toEqual(a2);

    const b1 = resolveTurretPivotProfile('smoky');
    const b2 = resolveTurretPivotProfile('smoky');
    expect(b1).toEqual(b2);

    const c1 = computeNormalizedPointOffsetPx({ x: 0.3, y: 0.7 }, 100, 200);
    const c2 = computeNormalizedPointOffsetPx({ x: 0.3, y: 0.7 }, 100, 200);
    expect(c1).toEqual(c2);
  });
});

// ── resolveTurretAttachmentProfile integration tests ──────────────────

describe('resolveTurretAttachmentProfile — Wasp+Smoky', () => {
  it('resolves socket and pivot for Wasp+Smoky+turret_main', () => {
    const profile = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    expect(profile.socket).not.toBeNull();
    expect(profile.socket!.id).toBe('turret_main');
    expect(profile.pivot).not.toBeNull();
    expect(profile.pivot!.px).toBe(0.5);
    expect(profile.pivot!.py).toBe(0.65);  // Calibrated: base ring ~65% down
  });

  it('computes display dimensions from texture scale and source size', () => {
    const profile = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    // Wasp: textureScale = 0.12, source 512x512 → display 61.44 x 61.44
    expect(profile.hullDisplayWidthPx).toBeCloseTo(512 * 0.12);
    expect(profile.hullDisplayHeightPx).toBeCloseTo(512 * 0.12);
    // Smoky: textureScale = 0.24, source 256x256 → display 61.44 x 61.44
    expect(profile.turretDisplayWidthPx).toBeCloseTo(256 * 0.24);
    expect(profile.turretDisplayHeightPx).toBeCloseTo(256 * 0.24);
  });

  it('returns null socket for unknown hull', () => {
    const profile = resolveTurretAttachmentProfile(
      'hornet', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    expect(profile.socket).toBeNull();
    expect(profile.pivot).not.toBeNull(); // Smoky still resolves
  });

  it('returns null pivot for unknown turret', () => {
    const profile = resolveTurretAttachmentProfile(
      'wasp', 'thunder', 'turret_main',
      512, 512, 256, 256,
    );
    expect(profile.socket).not.toBeNull(); // Wasp still resolves
    expect(profile.pivot).toBeNull();
  });

  it('returns null socket and pivot for unknown hull+weapon', () => {
    const profile = resolveTurretAttachmentProfile(
      'nonexistent', 'nonexistent', 'turret_main',
      512, 512, 256, 256,
    );
    expect(profile.socket).toBeNull();
    expect(profile.pivot).toBeNull();
    // Display dimensions should be 0 when profile is null (textureScale = 0)
    expect(profile.hullDisplayWidthPx).toBe(0);
    expect(profile.hullDisplayHeightPx).toBe(0);
    expect(profile.turretDisplayWidthPx).toBe(0);
    expect(profile.turretDisplayHeightPx).toBe(0);
  });

  it('returns null socket for wrong socketId on Wasp', () => {
    const profile = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'side_mount',
      512, 512, 256, 256,
    );
    expect(profile.socket).toBeNull();
    expect(profile.pivot).not.toBeNull(); // Smoky pivot still resolves
  });
});

// ── End-to-end: resolveTurretAttachmentProfile → computeTurretSpriteCenterOffset ─

describe('End-to-end: attachment profile → sprite center offset', () => {
  it('Wasp+Smoky with calibrated values gives correct non-zero offset', () => {
    const profile = resolveTurretAttachmentProfile(
      'wasp', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: profile.socket
        ? { x: profile.socket.normalized.nx, y: profile.socket.normalized.ny }
        : null,
      hullDisplayWidthPx: profile.hullDisplayWidthPx,
      hullDisplayHeightPx: profile.hullDisplayHeightPx,
      pivotNorm: profile.pivot
        ? { x: profile.pivot.px, y: profile.pivot.py }
        : null,
      turretDisplayWidthPx: profile.turretDisplayWidthPx,
      turretDisplayHeightPx: profile.turretDisplayHeightPx,
    });
    // Socket at {0.4, 0.5}, pivot at {0.5, 0.65}
    // hullCenterToSocket.x = (0.4-0.5)*61.44 = -6.144
    // hullCenterToSocket.y = 0
    // turretCenterToPivot.x = 0
    // turretCenterToPivot.y = (0.65-0.5)*61.44 = 9.216
    // offset = (-6.144, -9.216)
    expect(result.offset).not.toBeNull();
    expect(result.offset!.x).toBeCloseTo(-6.144);
    expect(result.offset!.y).toBeCloseTo(-9.216);
    // Verify intermediates
    expect(result.hullCenterToSocketPx!.x).toBeCloseTo(-6.144);
    expect(result.hullCenterToSocketPx!.y).toBeCloseTo(0);
    expect(result.turretCenterToPivotPx!.x).toBeCloseTo(0);
    expect(result.turretCenterToPivotPx!.y).toBeCloseTo(9.216);
  });

  it('missing hull socket produces null offset', () => {
    const profile = resolveTurretAttachmentProfile(
      'hornet', 'smoky', 'turret_main',
      512, 512, 256, 256,
    );
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: profile.socket
        ? { x: profile.socket.normalized.nx, y: profile.socket.normalized.ny }
        : null,
      hullDisplayWidthPx: profile.hullDisplayWidthPx,
      hullDisplayHeightPx: profile.hullDisplayHeightPx,
      pivotNorm: profile.pivot
        ? { x: profile.pivot.px, y: profile.pivot.py }
        : null,
      turretDisplayWidthPx: profile.turretDisplayWidthPx,
      turretDisplayHeightPx: profile.turretDisplayHeightPx,
    });
    expect(result.offset).toBeNull();
    expect(result.hullCenterToSocketPx).toBeNull();
  });

  it('missing turret pivot produces null offset', () => {
    const profile = resolveTurretAttachmentProfile(
      'wasp', 'thunder', 'turret_main',
      512, 512, 256, 256,
    );
    const result = computeTurretSpriteCenterOffsetForSocket({
      socketNorm: profile.socket
        ? { x: profile.socket.normalized.nx, y: profile.socket.normalized.ny }
        : null,
      hullDisplayWidthPx: profile.hullDisplayWidthPx,
      hullDisplayHeightPx: profile.hullDisplayHeightPx,
      pivotNorm: profile.pivot
        ? { x: profile.pivot.px, y: profile.pivot.py }
        : null,
      turretDisplayWidthPx: profile.turretDisplayWidthPx,
      turretDisplayHeightPx: profile.turretDisplayHeightPx,
    });
    expect(result.offset).toBeNull();
    expect(result.turretCenterToPivotPx).toBeNull();
  });
});
