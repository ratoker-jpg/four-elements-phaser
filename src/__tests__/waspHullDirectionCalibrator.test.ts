/**
 * Tests for WaspHullDirectionCalibrator — debug/calibration helpers only.
 *
 * PIM-HULL-WASP-DIR-MAP-01: Tests for the calibration state management,
 * direction cycling, overlay text builder, and helper functions.
 * No gameplay tests. No movement tests. No turret tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isCalibrationActive,
  getForcedVisualDir16,
  isOverrideActive,
  isOverlayVisible,
  isMovementFrozen,
  activateCalibration,
  deactivateCalibration,
  toggleCalibration,
  cycleNextDir16,
  cyclePrevDir16,
  resetToDir00,
  clearOverride,
  toggleOverlay,
  toggleMovementFreeze,
  getDir16CompassSuffix,
  getDir16Label,
  buildCalibrationOverlayText,
  generateCalibrationTableTemplate,
  type CalibrationOverlayParams,
} from '../phaser/debug/WaspHullDirectionCalibrator';

// ─── State management tests ──────────────────────────────────────

describe('WaspHullDirectionCalibrator state management', () => {
  beforeEach(() => {
    // Reset state before each test
    deactivateCalibration();
  });

  it('starts with calibration inactive', () => {
    expect(isCalibrationActive()).toBe(false);
  });

  it('activateCalibration activates calibration', () => {
    activateCalibration();
    expect(isCalibrationActive()).toBe(true);
  });

  it('activateCalibration sets forced dir to 0 if not already set', () => {
    activateCalibration();
    expect(getForcedVisualDir16()).toBe(0);
  });

  it('activateCalibration preserves existing forced dir', () => {
    cycleNextDir16(); // Set dir to 0 (was null, starts at 0)
    cycleNextDir16(); // dir = 1
    activateCalibration();
    expect(getForcedVisualDir16()).toBe(1);
  });

  it('deactivateCalibration deactivates and clears override', () => {
    activateCalibration();
    deactivateCalibration();
    expect(isCalibrationActive()).toBe(false);
    expect(getForcedVisualDir16()).toBeNull();
  });

  it('toggleCalibration toggles on and off', () => {
    expect(toggleCalibration()).toBe(true);
    expect(isCalibrationActive()).toBe(true);
    expect(toggleCalibration()).toBe(false);
    expect(isCalibrationActive()).toBe(false);
  });
});

// ─── Override state tests ────────────────────────────────────────

describe('WaspHullDirectionCalibrator override state', () => {
  beforeEach(() => {
    deactivateCalibration();
  });

  it('isOverrideActive is false when no forced dir is set', () => {
    expect(isOverrideActive()).toBe(false);
  });

  it('isOverrideActive is true when forced dir is set', () => {
    activateCalibration();
    expect(isOverrideActive()).toBe(true);
  });

  it('clearOverride sets forced dir to null', () => {
    activateCalibration();
    clearOverride();
    expect(getForcedVisualDir16()).toBeNull();
    expect(isOverrideActive()).toBe(false);
  });
});

// ─── Direction cycling tests ────────────────────────────────────

describe('WaspHullDirectionCalibrator direction cycling', () => {
  beforeEach(() => {
    deactivateCalibration();
  });

  it('cycleNextDir16 starts at 0 if no dir is set', () => {
    expect(cycleNextDir16()).toBe(0);
  });

  it('cycleNextDir16 increments by 1', () => {
    cycleNextDir16(); // 0
    expect(cycleNextDir16()).toBe(1);
    expect(cycleNextDir16()).toBe(2);
  });

  it('cycleNextDir16 wraps from 15 to 0', () => {
    // Start from null, go to 15 via prev
    cyclePrevDir16(); // = 15
    expect(cycleNextDir16()).toBe(0);
  });

  it('cyclePrevDir16 starts at 15 if no dir is set', () => {
    expect(cyclePrevDir16()).toBe(15);
  });

  it('cyclePrevDir16 decrements by 1', () => {
    cycleNextDir16(); // 0
    cycleNextDir16(); // 1
    expect(cyclePrevDir16()).toBe(0);
  });

  it('cyclePrevDir16 wraps from 0 to 15', () => {
    cycleNextDir16(); // 0
    expect(cyclePrevDir16()).toBe(15);
  });

  it('resetToDir00 sets dir to 0', () => {
    cycleNextDir16(); // 0
    cycleNextDir16(); // 1
    cycleNextDir16(); // 2
    expect(resetToDir00()).toBe(0);
  });

  it('can cycle through all 16 directions', () => {
    const visited: number[] = [];
    for (let i = 0; i < 16; i++) {
      visited.push(cycleNextDir16());
    }
    expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('can cycle backward through all 16 directions', () => {
    const visited: number[] = [];
    for (let i = 0; i < 16; i++) {
      visited.push(cyclePrevDir16());
    }
    expect(visited).toEqual([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });
});

// ─── Compass suffix / label tests ────────────────────────────────

describe('WaspHullDirectionCalibrator compass helpers', () => {
  it('getDir16CompassSuffix returns correct suffixes', () => {
    expect(getDir16CompassSuffix(0)).toBe('E');
    expect(getDir16CompassSuffix(2)).toBe('SE');
    expect(getDir16CompassSuffix(4)).toBe('S');
    expect(getDir16CompassSuffix(6)).toBe('SW');
    expect(getDir16CompassSuffix(8)).toBe('W');
    expect(getDir16CompassSuffix(10)).toBe('NW');
    expect(getDir16CompassSuffix(12)).toBe('N');
    expect(getDir16CompassSuffix(14)).toBe('NE');
  });

  it('getDir16CompassSuffix returns ? for out-of-range', () => {
    expect(getDir16CompassSuffix(16)).toBe('?');
    expect(getDir16CompassSuffix(-1)).toBe('?');
  });

  it('getDir16Label returns correct format', () => {
    expect(getDir16Label(0)).toBe('dir00_E');
    expect(getDir16Label(4)).toBe('dir04_S');
    expect(getDir16Label(12)).toBe('dir12_N');
    expect(getDir16Label(15)).toBe('dir15_ENE');
  });
});

// ─── Overlay tests ───────────────────────────────────────────────

describe('WaspHullDirectionCalibrator overlay', () => {
  it('toggleOverlay toggles visibility', () => {
    const initial = isOverlayVisible();
    expect(toggleOverlay()).toBe(!initial);
    expect(toggleOverlay()).toBe(initial);
  });

  it('buildCalibrationOverlayText includes key fields', () => {
    const params: CalibrationOverlayParams = {
      hullId: 'wasp',
      bodyAngleDeg: 90,
      dir8: 2,
      logicalDir16: 4,
      normalVisualDir16: 12,
      forcedDir16: 8,
      compassSuffix: 'W',
      textureKey: 'generated_hull_wasp_cyan_m0_dir08',
      isOverrideActive: true,
    };
    const text = buildCalibrationOverlayText(params);
    expect(text).toContain('WASP CALIBRATOR');
    expect(text).toContain('wasp');
    expect(text).toContain('90');
    expect(text).toContain('FORCED');
    expect(text).toContain('8');
    expect(text).toContain('ACTIVE');
    expect(text).toContain('dir08_W');
  });

  it('buildCalibrationOverlayText shows AUTO when no override', () => {
    const params: CalibrationOverlayParams = {
      hullId: 'wasp',
      bodyAngleDeg: 0,
      dir8: 0,
      logicalDir16: 0,
      normalVisualDir16: 0,
      forcedDir16: null,
      compassSuffix: 'E',
      textureKey: 'generated_hull_wasp_cyan_m0_dir00',
      isOverrideActive: false,
    };
    const text = buildCalibrationOverlayText(params);
    expect(text).toContain('AUTO');
    expect(text).not.toContain('FORCED');
  });
});

// ─── Movement freeze tests ──────────────────────────────────────

describe('WaspHullDirectionCalibrator movement freeze', () => {
  beforeEach(() => {
    deactivateCalibration();
  });

  it('movement is frozen when calibration is active', () => {
    activateCalibration();
    expect(isMovementFrozen()).toBe(true);
  });

  it('movement is not frozen when calibration is inactive', () => {
    expect(isMovementFrozen()).toBe(false);
  });

  it('toggleMovementFreeze toggles freeze state', () => {
    activateCalibration();
    expect(isMovementFrozen()).toBe(true);
    toggleMovementFreeze();
    expect(isMovementFrozen()).toBe(false);
    toggleMovementFreeze();
    expect(isMovementFrozen()).toBe(true);
  });

  it('deactivating calibration also unfreezes', () => {
    activateCalibration();
    deactivateCalibration();
    expect(isMovementFrozen()).toBe(false);
  });
});

// ─── Calibration table template tests ────────────────────────────

describe('WaspHullDirectionCalibrator calibration table template', () => {
  it('generates a template with all 16 directions', () => {
    const template = generateCalibrationTableTemplate();
    expect(template).toContain('WASP_HULL_VISUAL_DIR16_REMAP');
    for (let i = 0; i <= 15; i++) {
      expect(template).toContain(`${i}: 0,`);
    }
  });

  it('template includes compass suffixes', () => {
    const template = generateCalibrationTableTemplate();
    expect(template).toContain('E');
    expect(template).toContain('SE');
    expect(template).toContain('S');
    expect(template).toContain('SW');
    expect(template).toContain('W');
    expect(template).toContain('NW');
    expect(template).toContain('N');
    expect(template).toContain('NE');
  });
});
