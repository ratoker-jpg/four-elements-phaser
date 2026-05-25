import { describe, it, expect } from 'vitest';
import { createInitialState } from '../state/createInitialState';
import { RESOURCE_RAW_AMOUNTS, START_RAW, START_MATTER, HQ_RAW_CAP, HQ_MATTER_CAP, HQ_ELEMENT_CAP } from '../state/types';

describe('createInitialState', () => {
  it('returns a valid GameState with expected map dimensions', () => {
    const state = createInitialState();
    expect(state.mapWidth).toBe(48);
    expect(state.mapHeight).toBe(48);
  });

  it('has at least one entity', () => {
    const state = createInitialState();
    expect(state.entities.length).toBeGreaterThan(0);
  });

  it('includes an HQ entity', () => {
    const state = createInitialState();
    const hq = state.entities.find(e => e.kind === 'hq');
    expect(hq).toBeDefined();
    expect(hq!.tx).toBe(4);
    expect(hq!.ty).toBe(4);
    expect(hq!.faction).toBe('cyan');
  });

  it('has harvesters with idle phase and zero cargo', () => {
    const state = createInitialState();
    expect(state.harvesters.length).toBeGreaterThan(0);
    for (const h of state.harvesters) {
      expect(h.phase).toBe('idle');
      expect(h.cargoRaw).toBe(0);
      expect(h.cargoCapacity).toBeGreaterThan(0);
    }
  });

  it('has resource nodes with correct initial raw amounts', () => {
    const state = createInitialState();
    expect(state.resourceNodes.length).toBeGreaterThan(0);

    const infinite = state.resourceNodes.find(r => r.resourceType === 'infinite');
    expect(infinite).toBeDefined();
    expect(infinite!.depleted).toBe(false);
    expect(infinite!.remainingRaw).toBe(RESOURCE_RAW_AMOUNTS.infinite);

    const small = state.resourceNodes.find(r => r.resourceType === 'small');
    if (small) {
      expect(small.remainingRaw).toBe(RESOURCE_RAW_AMOUNTS.small);
      expect(small.depleted).toBe(false);
    }
  });

  it('starts with correct initial economy values', () => {
    const state = createInitialState();
    expect(state.economy.raw).toBe(START_RAW);
    expect(state.economy.matter).toBe(START_MATTER);
    expect(state.economy.elements.cyan).toBe(0);
    expect(state.economy.elements.green).toBe(0);
    expect(state.economy.elements.yellow).toBe(0);
    expect(state.economy.elements.purple).toBe(0);
    expect(state.economy.powerGenerated).toBe(0);
    expect(state.economy.powerConsumed).toBe(0);
  });

  it('sets HQ position to center of 3x3 footprint', () => {
    const state = createInitialState();
    // HQ at (4,4), center = (5,5)
    expect(state.hqPosition).toEqual({ tx: 5, ty: 5 });
  });

  it('player faction matches map HQ faction', () => {
    const state = createInitialState();
    expect(state.playerFaction).toBe('cyan');
  });

  it('starts with base HQ storage caps', () => {
    const state = createInitialState();
    expect(state.economy.rawCap).toBe(HQ_RAW_CAP);
    expect(state.economy.matterCap).toBe(HQ_MATTER_CAP);
    expect(state.economy.elementCap).toBe(HQ_ELEMENT_CAP);
  });
});
