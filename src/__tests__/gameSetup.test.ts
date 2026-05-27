/**
 * Tests for gameSetup — pure TypeScript, no Phaser.
 *
 * ARCH-14B: Tests for game setup configuration helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  FACTION_LIST,
  FACTION_CSS_COLORS,
  MAP_LIST,
  DEFAULT_SETUP,
  getMapDataById,
  type GameSetupConfig,
} from '../state/gameSetup';

describe('ARCH-14B: gameSetup helpers', () => {
  describe('FACTION_LIST', () => {
    it('contains all four factions in correct order', () => {
      expect(FACTION_LIST).toEqual(['cyan', 'green', 'yellow', 'purple']);
    });
  });

  describe('FACTION_CSS_COLORS', () => {
    it('has a CSS color for every faction', () => {
      for (const faction of FACTION_LIST) {
        expect(FACTION_CSS_COLORS[faction]).toBeDefined();
        expect(FACTION_CSS_COLORS[faction]).toMatch(/^#/);
      }
    });
  });

  describe('MAP_LIST', () => {
    it('contains at least one map', () => {
      expect(MAP_LIST.length).toBeGreaterThanOrEqual(1);
    });

    it('first map has id and name', () => {
      const firstMap = MAP_LIST[0];
      expect(firstMap.id).toBe('customMap1');
      expect(firstMap.name).toBe('Map 1');
    });
  });

  describe('DEFAULT_SETUP', () => {
    it('has cyan faction and customMap1', () => {
      expect(DEFAULT_SETUP.faction).toBe('cyan');
      expect(DEFAULT_SETUP.mapId).toBe('customMap1');
    });

    it('satisfies GameSetupConfig type', () => {
      const config: GameSetupConfig = DEFAULT_SETUP;
      expect(config.faction).toBeDefined();
      expect(config.mapId).toBeDefined();
    });
  });

  describe('getMapDataById', () => {
    it('returns customMap1 data for "customMap1"', () => {
      const mapData = getMapDataById('customMap1');
      expect(mapData.width).toBe(48);
      expect(mapData.height).toBe(48);
      expect(mapData.hq.tx).toBe(4);
      expect(mapData.hq.ty).toBe(4);
    });

    it('returns default map for unknown ID', () => {
      const mapData = getMapDataById('nonexistent');
      expect(mapData.width).toBe(48); // falls back to customMap1
    });
  });
});
