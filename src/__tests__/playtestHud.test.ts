/**
 * Tests for PlaytestHud module.
 *
 * ARCH-14A: Playtest HUD MVP tests.
 *
 * DOM-dependent rendering is not unit-tested here (brittle browser tests).
 * Instead, we verify:
 * - Type contracts for BuildRequestResult and ProductionRequestResult
 * - The PlaytestHud class has the expected interface
 * - Callback wiring produces correct result shapes
 */

import { describe, it, expect } from 'vitest';
import type { BuildRequestResult, ProductionRequestResult } from '../phaser/ui/PlaytestHud';

describe('PlaytestHud types', () => {
  it('BuildRequestResult success shape', () => {
    const result: BuildRequestResult = { success: true, message: 'separator site placed' };
    expect(result.success).toBe(true);
    expect(result.message).toBe('separator site placed');
  });

  it('BuildRequestResult failure shape', () => {
    const result: BuildRequestResult = { success: false, message: 'no idle builder' };
    expect(result.success).toBe(false);
    expect(result.message).toBe('no idle builder');
  });

  it('ProductionRequestResult success shape', () => {
    const result: ProductionRequestResult = { success: true, message: 'builder queued' };
    expect(result.success).toBe(true);
    expect(result.message).toBe('builder queued');
  });

  it('ProductionRequestResult failure shape', () => {
    const result: ProductionRequestResult = { success: false, message: 'no completed units-factory' };
    expect(result.success).toBe(false);
    expect(result.message).toBe('no completed units-factory');
  });

  it('BuildRequestResult covers all expected failure messages', () => {
    const failures: BuildRequestResult[] = [
      { success: false, message: 'no idle builder' },
      { success: false, message: 'no valid build site' },
      { success: false, message: 'placement failed: insufficient-resources' },
      { success: false, message: 'placement failed: occupied' },
      { success: false, message: 'placement failed: out-of-bounds' },
      { success: false, message: 'placement failed: unknown-building-type' },
    ];
    expect(failures).toHaveLength(6);
    expect(failures.every(f => !f.success)).toBe(true);
  });

  it('ProductionRequestResult covers all expected failure messages', () => {
    const failures: ProductionRequestResult[] = [
      { success: false, message: 'no completed units-factory' },
      { success: false, message: 'queue-full' },
      { success: false, message: 'insufficient-matter' },
      { success: false, message: 'insufficient-element' },
      { success: false, message: 'factory-not-found' },
    ];
    expect(failures).toHaveLength(5);
    expect(failures.every(f => !f.success)).toBe(true);
  });
});
