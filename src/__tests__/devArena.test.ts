/**
 * Tests for dev arena — pure TypeScript, no Phaser.
 *
 * ARCH-12A: Tests for the devArena module.
 * ARENA-01H+: Updated for clean standalone Arena mode.
 */

import { describe, it, expect } from 'vitest';
import {
  isArenaEnabled,
  createArenaMapData,
  devResetArena,
  ARENA_MAP_ID,
} from '../state/devArena';
import { createInitialState } from '../state/createInitialState';

describe('devArena', () => {
  describe('isArenaEnabled', () => {
    it('returns boolean without throwing', () => {
      const result = isArenaEnabled();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('createArenaMapData', () => {
    it('returns a valid MapData with correct dimensions', () => {
      const mapData = createArenaMapData();
      expect(mapData.width).toBe(20);
      expect(mapData.height).toBe(20);
      expect(mapData.terrain.length).toBe(20);
      expect(mapData.terrain[0].length).toBe(20);
    });

    // ARENA-01H+: Arena has a dummy HQ for MapData type compatibility
    it('has a dummy HQ for type compatibility', () => {
      const mapData = createArenaMapData();
      expect(mapData.hq).toBeDefined();
      expect(mapData.hq.faction).toBe('cyan');
    });

    // ARENA-01H+: Arena has NO resource nodes (clean sandbox)
    it('has no resource nodes (clean arena)', () => {
      const mapData = createArenaMapData();
      expect(mapData.resources.length).toBe(0);
    });

    // ARENA-01H+: Arena has NO builders (clean sandbox)
    it('has no builders (clean arena)', () => {
      const mapData = createArenaMapData();
      expect(mapData.builders.length).toBe(0);
    });

    // ARENA-01H+: Arena has NO obstacles (clean sandbox)
    it('has no obstacles (clean arena)', () => {
      const mapData = createArenaMapData();
      expect(mapData.obstacles.length).toBe(0);
    });

    // ARENA-01H+: Arena creates empty GameState in arenaMode
    it('creates a valid GameState from arena map in arenaMode', () => {
      const mapData = createArenaMapData();
      const state = createInitialState(mapData, 'cyan', 'QA Arena', { includeModularCombat: true, arenaMode: true });
      expect(state.mapWidth).toBe(20);
      expect(state.mapHeight).toBe(20);
      // Arena mode: no harvesters, no resources
      expect(state.harvesters.length).toBe(0);
      expect(state.resourceNodes.length).toBe(0);
      // Arena mode: no Normal Game entities
      expect(state.entities.length).toBe(0);
    });

    // ARENA-01H+: Normal Game mode still creates full state from arena map data
    it('creates a full GameState from arena map without arenaMode', () => {
      const mapData = createArenaMapData();
      const state = createInitialState(mapData, 'cyan');
      expect(state.mapWidth).toBe(20);
      expect(state.mapHeight).toBe(20);
      // Normal Game mode: HQ entity exists (dummy HQ in map data still gets flattened)
      expect(state.entities.some(e => e.kind === 'hq')).toBe(true);
    });
  });

  describe('devResetArena', () => {
    it('returns a fresh arena MapData', () => {
      const mapData = devResetArena();
      expect(mapData.width).toBe(20);
      expect(mapData.height).toBe(20);
    });

    it('returns identical data each call', () => {
      const a = devResetArena();
      const b = devResetArena();
      expect(a.width).toBe(b.width);
      expect(a.hq.tx).toBe(b.hq.tx);
      expect(a.resources.length).toBe(b.resources.length);
      // ARENA-01H+: Both returns clean empty data
      expect(a.resources.length).toBe(0);
      expect(a.builders.length).toBe(0);
    });
  });

  describe('ARENA_MAP_ID', () => {
    it('is a non-empty string', () => {
      expect(ARENA_MAP_ID).toBeTruthy();
      expect(typeof ARENA_MAP_ID).toBe('string');
    });
  });
});
