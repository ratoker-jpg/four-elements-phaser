/**
 * TURRET-HULL-CONTRACT-PR-F2: Tests for the pure Wasp socket calibrator.
 *
 * These tests pin the calibration math only (pixel<->normalized conversion,
 * per-direction seeding, pixel nudging, and the copy-ready output). They do
 * NOT encode any corrected socket value — that comes from Denis's visual QA.
 *
 * The module holds singleton state, so each test seeds explicitly to a known
 * value before asserting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HULL_CANVAS_PX,
  ensureSeededForDir,
  moveSocketBy,
  resetSocketCalibration,
  getSocketPixelX,
  getSocketPixelY,
  getSocketNormalized,
  getSeededDir16,
  buildSocketCalibrationSnapshot,
  buildCopyReadyLine,
} from '../phaser/debug/WaspSocketCalibrator';

describe('WaspSocketCalibrator', () => {
  beforeEach(() => {
    // Force a clean re-seed for each test (clears the seeded direction).
    resetSocketCalibration();
  });

  it('uses a 512px hull canvas', () => {
    expect(HULL_CANVAS_PX).toBe(512);
  });

  it('seeds pixel values from the profile normalized socket for a direction', () => {
    ensureSeededForDir(4, 0.500000, 0.305253, 'generated_hull_wasp_cyan_m0_dir04');
    expect(getSocketPixelX()).toBeCloseTo(0.500000 * 512, 6);
    expect(getSocketPixelY()).toBeCloseTo(0.305253 * 512, 6);
    expect(getSeededDir16()).toBe(4);
  });

  it('computes normalized values as pixel / 512', () => {
    ensureSeededForDir(4, 0.5, 0.5, 'k');
    const norm = getSocketNormalized();
    expect(norm.nx).toBeCloseTo(getSocketPixelX() / 512, 9);
    expect(norm.ny).toBeCloseTo(getSocketPixelY() / 512, 9);
  });

  it('moves the socket by whole and fractional pixels', () => {
    ensureSeededForDir(4, 0.5, 0.5, 'k'); // 256, 256
    moveSocketBy(1, 0);
    expect(getSocketPixelX()).toBeCloseTo(257, 6);
    moveSocketBy(0, 5);
    expect(getSocketPixelY()).toBeCloseTo(261, 6);
    moveSocketBy(-0.25, -0.25);
    expect(getSocketPixelX()).toBeCloseTo(256.75, 6);
    expect(getSocketPixelY()).toBeCloseTo(260.75, 6);
  });

  it('does NOT re-seed (discard adjustments) while the direction is unchanged', () => {
    ensureSeededForDir(4, 0.5, 0.5, 'k'); // 256, 256
    moveSocketBy(10, -10); // 266, 246
    // Same direction seed again with a different base — must be ignored.
    ensureSeededForDir(4, 0.1, 0.1, 'k');
    expect(getSocketPixelX()).toBeCloseTo(266, 6);
    expect(getSocketPixelY()).toBeCloseTo(246, 6);
  });

  it('re-seeds when the displayed direction changes', () => {
    ensureSeededForDir(4, 0.5, 0.5, 'k');
    moveSocketBy(10, 10);
    ensureSeededForDir(6, 0.5, 0.40, 'k6');
    expect(getSocketPixelX()).toBeCloseTo(0.5 * 512, 6);
    expect(getSocketPixelY()).toBeCloseTo(0.40 * 512, 6);
    expect(getSeededDir16()).toBe(6);
  });

  it('builds a copy-ready perDir line from the live snapshot', () => {
    ensureSeededForDir(4, 0.500000, 0.305253, 'generated_hull_wasp_cyan_m0_dir04');
    const line = buildCopyReadyLine(buildSocketCalibrationSnapshot());
    expect(line).toBe('dir04: { nx: 0.500000, ny: 0.305253 },');
  });

  it('reflects nudges in the snapshot and copy-ready line', () => {
    ensureSeededForDir(0, 0.5, 0.5, 'generated_hull_wasp_cyan_m0_dir00');
    moveSocketBy(-51.2, 0); // -0.1 in nx
    const snap = buildSocketCalibrationSnapshot();
    expect(snap.nx).toBeCloseTo(0.4, 6);
    expect(snap.hullVisualDir16).toBe(0);
    expect(buildCopyReadyLine(snap)).toBe('dir00: { nx: 0.400000, ny: 0.500000 },');
  });
});
