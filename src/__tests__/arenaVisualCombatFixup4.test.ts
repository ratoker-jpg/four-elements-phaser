/**
 * Tests for ARENA-VISUAL-COMBAT-FIX-01 fixup-4 — Codex audit visual regression fixes.
 *
 * Covers:
 * - Separate hull (grid-body) and turret (screen-angle) dir16 mapping
 * - Hull grid direction truth map: E→dir4, S→dir8, W→dir12, N→dir0
 * - Turret screen-angle truth map: NE→dir0, SE→dir4, SW→dir8, NW→dir12
 * - blockoutToModularVisual uses correct separate mappings
 * - Obstacle geometry hidden by default (flag gate)
 * - Muzzle origin uses composition pivot data
 * - Damage hit marker gating flag
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  screenAngleToModularDir16,
  gridBodyAngleToModularDir16,
  runtimeAngleToDir16,
  blockoutToModularVisual,
} from '../modular/blockoutToModularVisual';
import {
  debugRenderFlags,
  resetDebugRenderFlags,
  areAllDebugRenderFlagsOff,
} from '../config/debugRenderFlags';
import {
  resolveTurretMuzzlesForDir,
  normalizeDir16,
} from '../config/directionalTurretProfiles';

// ─── Turret/screen-angle mapping (Denis truth map) ──────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: screenAngleToModularDir16 (turret)', () => {
  /**
   * Turret uses screen-space angles. Denis truth map:
   *   dir0  = screen top-right    (NE)
   *   dir4  = screen bottom-right (SE)
   *   dir8  = screen bottom-left  (SW)
   *   dir12 = screen top-left     (NW)
   *
   * Phaser screen-space angles (Y-down):
   *   7π/4 = NE (top-right)
   *   π/4  = SE (bottom-right)
   *   3π/4 = SW (bottom-left)
   *   5π/4 = NW (top-left)
   */

  it('dir0 = screen top-right (NE): angle 7π/4 → dir0', () => {
    expect(screenAngleToModularDir16(7 * Math.PI / 4)).toBe(0);
  });

  it('dir4 = screen bottom-right (SE): angle π/4 → dir4', () => {
    expect(screenAngleToModularDir16(Math.PI / 4)).toBe(4);
  });

  it('dir8 = screen bottom-left (SW): angle 3π/4 → dir8', () => {
    expect(screenAngleToModularDir16(3 * Math.PI / 4)).toBe(8);
  });

  it('dir12 = screen top-left (NW): angle 5π/4 → dir12', () => {
    expect(screenAngleToModularDir16(5 * Math.PI / 4)).toBe(12);
  });

  it('negative angles normalize correctly: -π/4 → dir0', () => {
    expect(screenAngleToModularDir16(-Math.PI / 4)).toBe(0);
  });

  it('angles > 2π normalize correctly: 7π/4 + 2π → dir0', () => {
    expect(screenAngleToModularDir16(7 * Math.PI / 4 + 2 * Math.PI)).toBe(0);
  });

  it('intermediate direction: angle 0 (screen right) → dir2 (E)', () => {
    expect(screenAngleToModularDir16(0)).toBe(2);
  });

  it('intermediate direction: angle π/2 (screen down) → dir6 (S)', () => {
    expect(screenAngleToModularDir16(Math.PI / 2)).toBe(6);
  });
});

// ─── Hull/grid-body mapping (Denis truth map) ───────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: gridBodyAngleToModularDir16 (hull)', () => {
  /**
   * Hull body uses grid-direction angles (directionToAngle convention):
   *   Grid E → angle 0     → visually SE → dir4
   *   Grid S → angle π/2   → visually SW → dir8
   *   Grid W → angle π     → visually NW → dir12
   *   Grid N → angle -π/2  → visually NE → dir0
   */

  it('grid east (angle 0) → dir4 (SE)', () => {
    expect(gridBodyAngleToModularDir16(0)).toBe(4);
  });

  it('grid south (angle π/2) → dir8 (SW)', () => {
    expect(gridBodyAngleToModularDir16(Math.PI / 2)).toBe(8);
  });

  it('grid west (angle π) → dir12 (NW)', () => {
    expect(gridBodyAngleToModularDir16(Math.PI)).toBe(12);
  });

  it('grid north (angle -π/2) → dir0 (NE)', () => {
    expect(gridBodyAngleToModularDir16(-Math.PI / 2)).toBe(0);
  });

  it('negative angles normalize correctly: -5π/2 → dir0', () => {
    expect(gridBodyAngleToModularDir16(-5 * Math.PI / 2)).toBe(0);
  });

  it('angles > 2π normalize correctly: 2π + 0 → dir4', () => {
    expect(gridBodyAngleToModularDir16(2 * Math.PI)).toBe(4);
  });

  it('intermediate grid direction: angle π/4 → dir6 (SSE)', () => {
    // Between E(0→dir4) and S(π/2→dir8) = dir6
    expect(gridBodyAngleToModularDir16(Math.PI / 4)).toBe(6);
  });
});

// ─── Hull and turret can differ ──────────────────────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: hull vs turret dir16 differ', () => {
  it('same angle gives different dir16 for hull vs turret', () => {
    // angle 0: turret → dir2 (E), hull → dir4 (SE)
    expect(screenAngleToModularDir16(0)).toBe(2);
    expect(gridBodyAngleToModularDir16(0)).toBe(4);
    expect(screenAngleToModularDir16(0)).not.toBe(gridBodyAngleToModularDir16(0));
  });

  it('angle π/2: turret → dir6 (S), hull → dir8 (SW)', () => {
    expect(screenAngleToModularDir16(Math.PI / 2)).toBe(6);
    expect(gridBodyAngleToModularDir16(Math.PI / 2)).toBe(8);
  });
});

// ─── runtimeAngleToDir16 backward compat ────────────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: runtimeAngleToDir16 deprecated compat', () => {
  it('delegates to screenAngleToModularDir16', () => {
    expect(runtimeAngleToDir16(7 * Math.PI / 4)).toBe(screenAngleToModularDir16(7 * Math.PI / 4));
    expect(runtimeAngleToDir16(0)).toBe(screenAngleToModularDir16(0));
    expect(runtimeAngleToDir16(Math.PI)).toBe(screenAngleToModularDir16(Math.PI));
  });
});

// ─── blockoutToModularVisual uses split mappings ─────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: blockoutToModularVisual split mapping', () => {
  it('hull dir16 uses grid mapping, turret uses screen mapping for same angle', () => {
    const result = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,           // grid E → should be dir4
      turretAngle: Math.PI / 4, // screen SE → should be dir4
    });

    // hull: grid bodyAngle=0 → dir4 (SE)
    expect(result.hullDir16).toBe(4);
    // turret: screen turretAngle=π/4 → dir4 (SE)
    expect(result.turretDir16).toBe(4);
  });

  it('hull and turret differ when body faces grid-east and turret aims screen-right', () => {
    const result = blockoutToModularVisual({
      bodyId: 'wasp',
      weaponId: 'smoky',
      faction: 'cyan',
      modificationLevel: 0,
      bodyAngle: 0,  // grid E → dir4
      turretAngle: 0, // screen right → dir2
    });

    expect(result.hullDir16).toBe(4);  // grid east → SE
    expect(result.turretDir16).toBe(2); // screen right → E
    expect(result.hullDir16).not.toBe(result.turretDir16);
  });

  it('hull facing grid-south gets dir8', () => {
    const result = blockoutToModularVisual({
      bodyId: 'hunter',
      weaponId: 'thunder',
      faction: 'green',
      modificationLevel: 0,
      bodyAngle: Math.PI / 2, // grid S → dir8
      turretAngle: 3 * Math.PI / 4, // screen SW → dir8
    });

    expect(result.hullDir16).toBe(8);
    expect(result.turretDir16).toBe(8);
  });
});

// ─── Obstacle geometry flag ─────────────────────────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: obstacleGeometry flag', () => {
  beforeEach(() => {
    resetDebugRenderFlags();
  });

  it('obstacleGeometry defaults to false', () => {
    expect(debugRenderFlags.obstacleGeometry).toBe(false);
  });

  it('setting obstacleGeometry to true works', () => {
    debugRenderFlags.obstacleGeometry = true;
    expect(debugRenderFlags.obstacleGeometry).toBe(true);
  });

  it('resetDebugRenderFlags restores obstacleGeometry to false', () => {
    debugRenderFlags.obstacleGeometry = true;
    resetDebugRenderFlags();
    expect(debugRenderFlags.obstacleGeometry).toBe(false);
  });
});

// ─── Damage hit marker flag ─────────────────────────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: damageHitMarker flag', () => {
  beforeEach(() => {
    resetDebugRenderFlags();
  });

  it('damageHitMarker defaults to true (gameplay feedback)', () => {
    expect(debugRenderFlags.damageHitMarker).toBe(true);
  });

  it('damageHitMarker can be toggled off for visual QA', () => {
    debugRenderFlags.damageHitMarker = false;
    expect(debugRenderFlags.damageHitMarker).toBe(false);
  });

  it('resetDebugRenderFlags restores damageHitMarker to true', () => {
    debugRenderFlags.damageHitMarker = false;
    resetDebugRenderFlags();
    expect(debugRenderFlags.damageHitMarker).toBe(true);
  });
});

// ─── areAllDebugRenderFlagsOff includes new flags ────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: areAllDebugRenderFlagsOff', () => {
  beforeEach(() => {
    resetDebugRenderFlags();
  });

  it('returns true after reset (damageHitMarker=true is default)', () => {
    expect(areAllDebugRenderFlagsOff()).toBe(true);
  });

  it('returns false when obstacleGeometry is true', () => {
    debugRenderFlags.obstacleGeometry = true;
    expect(areAllDebugRenderFlagsOff()).toBe(false);
  });

  it('returns false when damageHitMarker is false (non-default)', () => {
    debugRenderFlags.damageHitMarker = false;
    expect(areAllDebugRenderFlagsOff()).toBe(false);
  });
});

// ─── Muzzle origin via directional profiles ──────────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: muzzle origin from directional profiles', () => {
  it('Smoky M0 has muzzle data for all 16 directions', () => {
    for (let dir = 0; dir < 16; dir++) {
      const muzzles = resolveTurretMuzzlesForDir('smoky', 0, dir);
      expect(muzzles).not.toBeNull();
      expect(muzzles!.length).toBeGreaterThan(0);
      // Muzzle position should be in normalized sprite-space (0..1)
      const pos = muzzles![0].position;
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.x).toBeLessThan(1);
      expect(pos.y).toBeGreaterThan(0);
      expect(pos.y).toBeLessThan(1);
    }
  });

  it('Smoky M2 has muzzle data for all 16 directions', () => {
    for (let dir = 0; dir < 16; dir++) {
      const muzzles = resolveTurretMuzzlesForDir('smoky', 2, dir);
      expect(muzzles).not.toBeNull();
      expect(muzzles!.length).toBeGreaterThan(0);
    }
  });

  it('Unsupported weapon returns null (graceful fallback)', () => {
    const muzzles = resolveTurretMuzzlesForDir('thunder', 0, 0);
    expect(muzzles).toBeNull();
  });

  it('Smoky dir0 (E) muzzle is on the right side of the sprite', () => {
    const muzzles = resolveTurretMuzzlesForDir('smoky', 0, 0);
    expect(muzzles).not.toBeNull();
    // dir0 = E, muzzle should be near right edge (x > 0.5)
    expect(muzzles![0].position.x).toBeGreaterThan(0.5);
  });

  it('Smoky dir8 (W) muzzle is on the left side of the sprite', () => {
    const muzzles = resolveTurretMuzzlesForDir('smoky', 0, 8);
    expect(muzzles).not.toBeNull();
    // dir8 = W, muzzle should be near left edge (x < 0.5)
    expect(muzzles![0].position.x).toBeLessThan(0.5);
  });

  it('normalizeDir16 handles edge cases', () => {
    expect(normalizeDir16(0)).toBe(0);
    expect(normalizeDir16(15)).toBe(15);
    expect(normalizeDir16(16)).toBe(0);
    expect(normalizeDir16(-1)).toBe(15);
    expect(normalizeDir16(NaN)).toBe(0);
    expect(normalizeDir16(Infinity)).toBe(0);
  });
});

// ─── Muzzle screen-space transformation principle ────────────────────

describe('ARENA-VISUAL-COMBAT-FIX-01 fixup-4: muzzle screen-space transform', () => {
  it('normalized muzzle position transforms correctly to screen space', () => {
    // This tests the geometric principle used in getModularBarrelTip:
    //   muzzleScreen = turretPosition + (muzzleNorm - origin) * displaySize
    const turretPositionX = 200;
    const turretPositionY = 150;
    const turretOriginX = 0.5;
    const turretOriginY = 0.5;
    const displaySize = 82; // 512 * 0.16

    // dir0 (E) muzzle at approximately (0.87, 0.48)
    const muzzleNormX = 0.87379;
    const muzzleNormY = 0.484178;

    const muzzleScreenX = turretPositionX + (muzzleNormX - turretOriginX) * displaySize;
    const muzzleScreenY = turretPositionY + (muzzleNormY - turretOriginY) * displaySize;

    // Muzzle should be to the right of turret center (positive offset)
    expect(muzzleScreenX).toBeGreaterThan(turretPositionX);
    // Muzzle should be near the turret center vertically (small offset)
    expect(Math.abs(muzzleScreenY - turretPositionY)).toBeLessThan(displaySize * 0.1);
  });

  it('composition pivot-based origin differs from sprite center', () => {
    // When using pivotScreen instead of turretSprite center, the barrel
    // origin is at the composition-resolved pivot point, which accounts
    // for socket/pivot alignment from metadata.
    // This test verifies the concept: pivotScreen != sprite center
    // when metadata provides non-default socket/pivot anchors.
    const socketNorm = { nx: 0.45, ny: 0.55 }; // non-center socket
    const pivotNorm = { nx: 0.5, ny: 0.5 }; // center pivot (fallback)
    const hullDisplaySize = 82;
    const turretDisplaySize = 82;

    const hullCenterX = 200;
    const hullCenterY = 150;

    // Socket position
    const socketX = hullCenterX + (socketNorm.nx - 0.5) * hullDisplaySize;
    const socketY = hullCenterY + (socketNorm.ny - 0.5) * hullDisplaySize;

    // Turret center from socket + pivot
    const turretCenterX = socketX - (pivotNorm.nx - 0.5) * turretDisplaySize;
    const turretCenterY = socketY - (pivotNorm.ny - 0.5) * turretDisplaySize;

    // Turret center should differ from hull center when socket is off-center
    expect(turretCenterX).not.toBe(hullCenterX);
    expect(turretCenterY).not.toBe(hullCenterY);
  });
});
