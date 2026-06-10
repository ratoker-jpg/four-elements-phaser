/**
 * Tests for WaspHullPlacementCalibrator — placement calibration helpers only.
 *
 * PIM-HULL-WASP-ANCHOR-MAP-01: Tests for the placement calibration state
 * management, offset adjustment, overlay text builder, and helper functions.
 * No gameplay tests. No movement tests. No turret tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPlacementActive,
  isPlacementOverlayVisible,
  getDebugOffsetX,
  getDebugOffsetY,
  activatePlacement,
  deactivatePlacement,
  togglePlacement,
  adjustUp,
  adjustDown,
  adjustLeft,
  adjustRight,
  resetPlacementOffset,
  togglePlacementOverlay,
  buildPlacementOverlayText,
  type PlacementOverlayParams,
} from '../phaser/debug/WaspHullPlacementCalibrator';

// ─── State management tests ──────────────────────────────────────

describe('WaspHullPlacementCalibrator state management', () => {
  beforeEach(() => {
    deactivatePlacement();
  });

  it('starts with placement inactive', () => {
    expect(isPlacementActive()).toBe(false);
  });

  it('activatePlacement activates placement', () => {
    activatePlacement();
    expect(isPlacementActive()).toBe(true);
  });

  it('activatePlacement does not change offset from default (0,0)', () => {
    activatePlacement();
    expect(getDebugOffsetX()).toBe(0);
    expect(getDebugOffsetY()).toBe(0);
  });

  it('deactivatePlacement deactivates and resets offset', () => {
    activatePlacement();
    adjustDown(false);
    adjustRight(false);
    expect(getDebugOffsetX()).toBe(1);
    expect(getDebugOffsetY()).toBe(1);
    deactivatePlacement();
    expect(isPlacementActive()).toBe(false);
    expect(getDebugOffsetX()).toBe(0);
    expect(getDebugOffsetY()).toBe(0);
  });

  it('togglePlacement toggles on and off', () => {
    expect(togglePlacement()).toBe(true);
    expect(isPlacementActive()).toBe(true);
    expect(togglePlacement()).toBe(false);
    expect(isPlacementActive()).toBe(false);
  });

  it('togglePlacement resets offset when turning off', () => {
    activatePlacement();
    adjustDown(false);
    togglePlacement(); // off — resets
    expect(getDebugOffsetX()).toBe(0);
    expect(getDebugOffsetY()).toBe(0);
  });
});

// ─── Offset adjustment tests ─────────────────────────────────────

describe('WaspHullPlacementCalibrator offset adjustment', () => {
  beforeEach(() => {
    deactivatePlacement();
  });

  it('adjustUp decreases Y by 1', () => {
    const o = adjustUp(false);
    expect(o).toEqual({ x: 0, y: -1 });
    expect(getDebugOffsetY()).toBe(-1);
  });

  it('adjustDown increases Y by 1', () => {
    const o = adjustDown(false);
    expect(o).toEqual({ x: 0, y: 1 });
    expect(getDebugOffsetY()).toBe(1);
  });

  it('adjustLeft decreases X by 1', () => {
    const o = adjustLeft(false);
    expect(o).toEqual({ x: -1, y: 0 });
    expect(getDebugOffsetX()).toBe(-1);
  });

  it('adjustRight increases X by 1', () => {
    const o = adjustRight(false);
    expect(o).toEqual({ x: 1, y: 0 });
    expect(getDebugOffsetX()).toBe(1);
  });

  it('adjustUp with large=true decreases Y by 5', () => {
    const o = adjustUp(true);
    expect(o).toEqual({ x: 0, y: -5 });
  });

  it('adjustDown with large=true increases Y by 5', () => {
    const o = adjustDown(true);
    expect(o).toEqual({ x: 0, y: 5 });
  });

  it('adjustLeft with large=true decreases X by 5', () => {
    const o = adjustLeft(true);
    expect(o).toEqual({ x: -5, y: 0 });
  });

  it('adjustRight with large=true increases X by 5', () => {
    const o = adjustRight(true);
    expect(o).toEqual({ x: 5, y: 0 });
  });

  it('multiple adjustments accumulate', () => {
    adjustDown(false);  // Y = 1
    adjustDown(false);  // Y = 2
    adjustRight(true);  // X = 5
    expect(getDebugOffsetX()).toBe(5);
    expect(getDebugOffsetY()).toBe(2);
  });

  it('adjustments can go negative in both directions', () => {
    adjustUp(true);   // Y = -5
    adjustLeft(true); // X = -5
    adjustUp(false);  // Y = -6
    adjustLeft(false); // X = -6
    expect(getDebugOffsetX()).toBe(-6);
    expect(getDebugOffsetY()).toBe(-6);
  });

  it('resetPlacementOffset resets to (0, 0)', () => {
    adjustDown(true);
    adjustRight(true);
    resetPlacementOffset();
    expect(getDebugOffsetX()).toBe(0);
    expect(getDebugOffsetY()).toBe(0);
  });
});

// ─── Overlay visibility tests ────────────────────────────────────

describe('WaspHullPlacementCalibrator overlay visibility', () => {
  beforeEach(() => {
    deactivatePlacement();
  });

  it('overlay is visible by default', () => {
    expect(isPlacementOverlayVisible()).toBe(true);
  });

  it('togglePlacementOverlay toggles visibility', () => {
    expect(togglePlacementOverlay()).toBe(false);
    expect(isPlacementOverlayVisible()).toBe(false);
    expect(togglePlacementOverlay()).toBe(true);
    expect(isPlacementOverlayVisible()).toBe(true);
  });
});

// ─── Overlay text builder tests ──────────────────────────────────

describe('WaspHullPlacementCalibrator overlay text', () => {
  it('buildPlacementOverlayText includes key fields', () => {
    const params: PlacementOverlayParams = {
      hullId: 'wasp',
      vehicleId: 'v-001',
      bodyId: 'wasp',
      offsetX: 3,
      offsetY: -5,
      scale: 0.12,
      originX: 0.5,
      originY: 0.75,
      textureKey: 'generated_hull_wasp_cyan_m0_dir04',
      tileX: 5.0,
      tileY: 3.0,
      isPlacementActive: true,
      hullScreenX: 234,
      hullScreenY: 156,
      turretScreenX: 246,
      turretScreenY: 148,
    };
    const text = buildPlacementOverlayText(params);
    expect(text).toContain('tile:');
    expect(text).toContain('offset: (3, -5)');
    expect(text).toContain('world: 234, 156');
    expect(text).toContain('0.12');
    expect(text).toContain('0.50');
    expect(text).toContain('0.75');
    expect(text).toContain('hull → turret');
    expect(text).toContain('dx=12');
    expect(text).toContain('dy=-8');
    expect(text).toContain('I/K/J/L');
    expect(text).toContain('Screen buttons');
    expect(text).toContain('RESET');
  });

  it('buildPlacementOverlayText shows offset when placement is off', () => {
    const params: PlacementOverlayParams = {
      hullId: 'wasp',
      vehicleId: 'v-002',
      bodyId: 'wasp',
      offsetX: 0,
      offsetY: 0,
      scale: 0.12,
      originX: 0.5,
      originY: 0.75,
      textureKey: 'generated_hull_wasp_cyan_m0_dir00',
      tileX: 1.0,
      tileY: 2.0,
      isPlacementActive: false,
      hullScreenX: 100,
      hullScreenY: 200,
      turretScreenX: 100,
      turretScreenY: 200,
    };
    const text = buildPlacementOverlayText(params);
    expect(text).toContain('offset: (0, 0)');
    expect(text).toContain('hull → turret');
  });

  it('buildPlacementOverlayText includes hotkey reference', () => {
    const params: PlacementOverlayParams = {
      hullId: 'wasp',
      vehicleId: 'v-003',
      bodyId: 'wasp',
      offsetX: 7,
      offsetY: 12,
      scale: 0.12,
      originX: 0.5,
      originY: 0.75,
      textureKey: 'generated_hull_wasp_cyan_m0_dir08',
      tileX: 3.0,
      tileY: 4.0,
      isPlacementActive: true,
      hullScreenX: 300,
      hullScreenY: 400,
      turretScreenX: 300,
      turretScreenY: 400,
    };
    const text = buildPlacementOverlayText(params);
    expect(text).toContain('Alt+U');
    expect(text).toContain('R=reset');
    expect(text).toContain('P=print');
    expect(text).toContain('O=overlay');
  });
});
