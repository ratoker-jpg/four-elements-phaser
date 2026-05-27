/**
 * Tests for dev arena — pure TypeScript, no Phaser.
 *
 * ARCH-12A: Tests for the devArena module.
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

    it('has HQ placed', () => {
      const mapData = createArenaMapData();
      expect(mapData.hq.tx).toBe(3);
      expect(mapData.hq.ty).toBe(3);
      expect(mapData.hq.faction).toBe('cyan');
    });

    it('has resource nodes', () => {
      const mapData = createArenaMapData();
      expect(mapData.resources.length).toBeGreaterThan(0);
    });

    it('has at least one builder', () => {
      const mapData = createArenaMapData();
      expect(mapData.builders.length).toBeGreaterThanOrEqual(1);
    });

    it('can create a valid GameState from arena map', () => {
      const mapData = createArenaMapData();
      const state = createInitialState(mapData, 'cyan');
      expect(state.mapWidth).toBe(20);
      expect(state.mapHeight).toBe(20);
      expect(state.harvesters.length).toBeGreaterThan(0);
      expect(state.resourceNodes.length).toBeGreaterThan(0);
    });

    it('has open space around HQ for spawn testing', () => {
      const mapData = createArenaMapData();
      // HQ is at (3,3), 3x3 footprint covers (3-5, 3-5)
      // Check tiles just outside HQ are not occupied by resources
      const hqTiles = new Set<string>();
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          hqTiles.add(`${mapData.hq.tx + dx},${mapData.hq.ty + dy}`);
        }
      }
      // Resources should not overlap HQ
      for (const r of mapData.resources) {
        for (let dy = 0; dy < r.footprint; dy++) {
          for (let dx = 0; dx < r.footprint; dx++) {
            expect(hqTiles.has(`${r.tx + dx},${r.ty + dy}`)).toBe(false);
          }
        }
      }
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
    });
  });

  describe('ARENA_MAP_ID', () => {
    it('is a non-empty string', () => {
      expect(ARENA_MAP_ID).toBeTruthy();
      expect(typeof ARENA_MAP_ID).toBe('string');
    });
  });
});
