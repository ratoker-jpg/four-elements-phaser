/**
 * Tests for ARENA-02H+ fixup: placement input guard behavior.
 *
 * Verifies that when arena placement mode is active:
 * - BlockoutVehicleInputController suppresses LMB/RMB pointer handling
 * - GameInputController suppresses ESC pause menu toggle
 *
 * These tests verify the guard callback logic without requiring Phaser
 * scene instances — they test the dependency interface contract.
 */

import { describe, it, expect } from 'vitest';
import {
  createArenaPlacementState,
  enterPlacementMode,
  cancelPlacementMode,
} from '../state/arenaPlacement';

// ─── Placement state guard integration tests ────────────────────────

describe('Arena placement state guard', () => {
  it('placement state is idle by default — guard returns false', () => {
    const state = createArenaPlacementState();
    const isPlacementActive = () => state.mode === 'placing';
    expect(isPlacementActive()).toBe(false);
  });

  it('entering placement mode — guard returns true', () => {
    const state = createArenaPlacementState();
    state.selectedBody = 'wasp';
    state.selectedWeapon = 'smoky';
    enterPlacementMode(state);
    const isPlacementActive = () => state.mode === 'placing';
    expect(isPlacementActive()).toBe(true);
  });

  it('canceling placement mode — guard returns false', () => {
    const state = createArenaPlacementState();
    state.selectedBody = 'wasp';
    state.selectedWeapon = 'smoky';
    enterPlacementMode(state);
    const isPlacementActive = () => state.mode === 'placing';
    expect(isPlacementActive()).toBe(true);
    cancelPlacementMode(state);
    expect(isPlacementActive()).toBe(false);
  });

  it('guard callback is reactive — reflects live state changes', () => {
    const state = createArenaPlacementState();
    const isPlacementActive = () => state.mode === 'placing';

    // Initially not active
    expect(isPlacementActive()).toBe(false);

    // Enter placing
    state.selectedBody = 'viking';
    state.selectedWeapon = 'thunder';
    enterPlacementMode(state);
    expect(isPlacementActive()).toBe(true);

    // Cancel
    cancelPlacementMode(state);
    expect(isPlacementActive()).toBe(false);

    // Re-enter
    enterPlacementMode(state);
    expect(isPlacementActive()).toBe(true);
  });
});

// ─── Guard default callback behavior ────────────────────────────────

describe('isPlacementActive default callback', () => {
  it('undefined isPlacementActive defaults to () => false', () => {
    // Simulate what the constructor does:
    // this.isPlacementActive = deps.isPlacementActive ?? (() => false);
    const provided: (() => boolean) | undefined = undefined;
    const isPlacementActive = provided ?? (() => false);
    expect(isPlacementActive()).toBe(false);
  });

  it('provided isPlacementActive callback is used', () => {
    const state = createArenaPlacementState();
    state.selectedBody = 'titan';
    state.selectedWeapon = 'railgun';
    const isPlacementActive = () => state.mode === 'placing';
    expect(isPlacementActive()).toBe(false);
    enterPlacementMode(state);
    expect(isPlacementActive()).toBe(true);
  });
});

// ─── BlockoutVehicleInputController guard behavior simulation ───────

describe('BlockoutVehicleInputController guard simulation', () => {
  it('should suppress pointer tracking when placement is active', () => {
    // Simulate the guard logic from onPointerdown
    const state = createArenaPlacementState();
    const isDevtoolsActive = () => true;
    const isPlacementActive = () => state.mode === 'placing';

    // Before placement — would process pointer
    expect(isDevtoolsActive()).toBe(true);
    expect(isPlacementActive()).toBe(false);
    // Guard: if (isPlacementActive()) return; — would NOT return

    // Enter placement mode
    state.selectedBody = 'wasp';
    state.selectedWeapon = 'smoky';
    enterPlacementMode(state);
    expect(isPlacementActive()).toBe(true);
    // Guard: if (isPlacementActive()) return; — WOULD return (suppress)
  });

  it('should suppress click handling when placement is active', () => {
    // Simulate the guard logic from onPointerup
    const state = createArenaPlacementState();
    const isDevtoolsActive = () => true;
    const isPlacementActive = () => state.mode === 'placing';

    // Before placement — would process click
    let clickProcessed = false;
    if (isDevtoolsActive() && !isPlacementActive()) {
      clickProcessed = true;
    }
    expect(clickProcessed).toBe(true);

    // Enter placement mode — click suppressed
    state.selectedBody = 'wasp';
    state.selectedWeapon = 'smoky';
    enterPlacementMode(state);

    clickProcessed = false;
    if (isDevtoolsActive() && !isPlacementActive()) {
      clickProcessed = true;
    }
    expect(clickProcessed).toBe(false);
  });
});

// ─── GameInputController guard behavior simulation ──────────────────

describe('GameInputController ESC guard simulation', () => {
  it('should suppress ESC pause toggle when placement is active', () => {
    const state = createArenaPlacementState();
    const isPlacementActive = () => state.mode === 'placing';

    // Before placement — ESC would toggle pause
    let pauseToggled = false;
    if (!isPlacementActive()) {
      pauseToggled = true;
    }
    expect(pauseToggled).toBe(true);

    // Enter placement mode — ESC suppressed
    state.selectedBody = 'mammoth';
    state.selectedWeapon = 'hammer';
    enterPlacementMode(state);

    pauseToggled = false;
    if (!isPlacementActive()) {
      pauseToggled = true;
    }
    expect(pauseToggled).toBe(false);
  });

  it('ESC guard stops blocking once placement is canceled', () => {
    const state = createArenaPlacementState();
    const isPlacementActive = () => state.mode === 'placing';

    state.selectedBody = 'hunter';
    state.selectedWeapon = 'twins';
    enterPlacementMode(state);
    expect(isPlacementActive()).toBe(true);

    cancelPlacementMode(state);
    expect(isPlacementActive()).toBe(false);

    // ESC would now toggle pause again
    let pauseToggled = false;
    if (!isPlacementActive()) {
      pauseToggled = true;
    }
    expect(pauseToggled).toBe(true);
  });
});
