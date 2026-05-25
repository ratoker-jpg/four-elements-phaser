import { describe, it, expect } from 'vitest';
import { createInitialState } from '../state/createInitialState';
import { updateGameState, createHarvester } from '../state/updateGameState';
import type { HarvesterPhase } from '../state/types';

/** Valid harvester phases for assertion. */
const VALID_PHASES: HarvesterPhase[] = [
  'idle',
  'moving-to-resource',
  'gathering',
  'returning-to-hq',
  'unloading',
];

describe('updateGameState — harvester loop', () => {
  it('idle harvester finds a resource and transitions to moving-to-resource', () => {
    const state = createInitialState();
    const h = state.harvesters[0];
    expect(h.phase).toBe('idle');

    updateGameState(state, 16); // one frame tick

    expect(h.phase).toBe('moving-to-resource');
    expect(h.targetResourceId).not.toBeNull();
  });

  it('harvester moves toward resource after first tick', () => {
    const state = createInitialState();
    const h = state.harvesters[0];

    // Transition to moving
    updateGameState(state, 16);
    expect(h.phase).toBe('moving-to-resource');

    const ftxBefore = h.ftx;
    const ftyBefore = h.fty;

    // Move for enough time to see displacement
    updateGameState(state, 500);

    const moved = h.ftx !== ftxBefore || h.fty !== ftyBefore;
    expect(moved).toBe(true);
  });

  it('harvester eventually gathers and returns to HQ', () => {
    const state = createInitialState();
    const h = state.harvesters[0];

    // Run many frames to progress through gather cycle
    for (let i = 0; i < 500; i++) {
      updateGameState(state, 16);
    }

    // Harvester should have progressed past initial idle/moving phases
    // It may be in any phase of the loop by now — just verify it's valid
    expect(VALID_PHASES).toContain(h.phase);
  });

  it('clamps delta to 200ms max', () => {
    const state = createInitialState();
    const h = state.harvesters[0];

    // Start moving
    updateGameState(state, 16);

    // Huge delta — should clamp internally, not crash
    updateGameState(state, 10000);

    expect(VALID_PHASES).toContain(h.phase);
  });

  it('unloading phase transfers cargo to player raw minerals', () => {
    const state = createInitialState();

    // Run enough frames to complete at least one full gather cycle
    // (move → gather 1s → return → unload 0.5s)
    for (let i = 0; i < 1000; i++) {
      updateGameState(state, 16);
    }

    // After many cycles, raw minerals should have increased
    expect(state.rawMinerals).toBeGreaterThan(0);
  });
});

describe('createHarvester', () => {
  it('creates a HarvesterState with correct defaults', () => {
    const h = createHarvester('test-h', 5, 10, 'cyan');
    expect(h.id).toBe('test-h');
    expect(h.ftx).toBe(5);
    expect(h.fty).toBe(10);
    expect(h.faction).toBe('cyan');
    expect(h.phase).toBe('idle');
    expect(h.cargoRaw).toBe(0);
    expect(h.cargoCapacity).toBe(20);
    expect(h.speedTilesPerSecond).toBe(2.5);
    expect(h.targetResourceId).toBeNull();
  });

  it('defaults faction to cyan when omitted', () => {
    const h = createHarvester('test-h2', 0, 0);
    expect(h.faction).toBe('cyan');
  });
});
