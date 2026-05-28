/**
 * Tests for gameSetup — pure TypeScript, no Phaser.
 *
 * ARCH-14B: Tests for game setup configuration helpers.
 * ARCH-16A: Extended tests for map mode, size, seed, and DEFAULT_SETUP.
 */

import { describe, it, expect } from 'vitest';
import {
  FACTION_LIST,
  FACTION_CSS_COLORS,
  MAP_LIST,
  MAP_SIZE_OPTIONS,
  DEFAULT_SETUP,
  getMapDataById,
  getMapDataFromConfig,
  getMapDisplayName,
  type GameSetupConfig,
} from '../state/gameSetup';

describe('ARCH-14B/16A: gameSetup helpers', () => {
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
    it('contains at least two maps (fixed + generated)', () => {
      expect(MAP_LIST.length).toBeGreaterThanOrEqual(2);
    });

    it('first map has id and name', () => {
      const firstMap = MAP_LIST[0];
      expect(firstMap.id).toBe('customMap1');
      expect(firstMap.name).toBe('Map 1');
    });

    it('includes a generated map option', () => {
      const generated = MAP_LIST.find(m => m.mode === 'generated');
      expect(generated).toBeDefined();
      expect(generated!.name).toBe('Generated');
    });

    it('QA Arena is not in MAP_LIST', () => {
      const arena = MAP_LIST.find(m => m.id === 'arena1');
      expect(arena).toBeUndefined();
    });
  });

  describe('MAP_SIZE_OPTIONS', () => {
    it('contains small, standard, large', () => {
      expect(MAP_SIZE_OPTIONS).toEqual(['small', 'standard', 'large']);
    });
  });

  describe('DEFAULT_SETUP', () => {
    it('has cyan faction and customMap1', () => {
      expect(DEFAULT_SETUP.faction).toBe('cyan');
      expect(DEFAULT_SETUP.mapId).toBe('customMap1');
    });

    it('has fixed map mode', () => {
      expect(DEFAULT_SETUP.mapMode).toBe('fixed');
    });

    it('has standard map size', () => {
      expect(DEFAULT_SETUP.mapSize).toBe('standard');
    });

    it('has default seed', () => {
      expect(DEFAULT_SETUP.seed).toBe('default');
    });

    it('has standard game mode (MENU-01)', () => {
      expect(DEFAULT_SETUP.gameMode).toBe('standard');
    });

    it('satisfies GameSetupConfig type', () => {
      const config: GameSetupConfig = DEFAULT_SETUP;
      expect(config.faction).toBeDefined();
      expect(config.mapId).toBeDefined();
      expect(config.mapMode).toBeDefined();
      expect(config.mapSize).toBeDefined();
      expect(config.seed).toBeDefined();
      expect(config.gameMode).toBeDefined();
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

    it('returns generated map data for generated ID', () => {
      const mapData = getMapDataById('generated-small-testseed');
      expect(mapData.width).toBe(32); // small = 32x32
      expect(mapData.height).toBe(32);
    });

    it('returns arena map data for arena1 ID', () => {
      const mapData = getMapDataById('arena1');
      expect(mapData.width).toBe(20);
      expect(mapData.height).toBe(20);
    });
  });

  describe('getMapDataFromConfig', () => {
    it('returns customMap1 for fixed mode config', () => {
      const config: GameSetupConfig = {
        faction: 'cyan',
        mapId: 'customMap1',
        mapMode: 'fixed',
        mapSize: 'standard',
        seed: 'test',
        gameMode: 'standard',
      };
      const mapData = getMapDataFromConfig(config);
      expect(mapData.width).toBe(48);
    });

    it('returns generated map for generated mode config', () => {
      const config: GameSetupConfig = {
        faction: 'cyan',
        mapId: 'generated-standard-myseed',
        mapMode: 'generated',
        mapSize: 'small',
        seed: 'myseed',
        gameMode: 'standard',
      };
      const mapData = getMapDataFromConfig(config);
      expect(mapData.width).toBe(32); // small
    });

    it('arena config returns arena map', () => {
      const config: GameSetupConfig = {
        faction: 'cyan',
        mapId: 'arena1',
        mapMode: 'fixed',
        mapSize: 'standard',
        seed: '',
        gameMode: 'arena',
      };
      const mapData = getMapDataFromConfig(config);
      expect(mapData.width).toBe(20);
    });
  });

  // ── Fix 1: getMapDisplayName — readable map names ──────────────

  describe('getMapDisplayName', () => {
    it('fixed customMap1 config displays as "Map 1"', () => {
      const config: GameSetupConfig = {
        faction: 'cyan',
        mapId: 'customMap1',
        mapMode: 'fixed',
        mapSize: 'standard',
        seed: 'default',
        gameMode: 'standard',
      };
      expect(getMapDisplayName(config)).toBe('Map 1');
    });

    it('generated config display name includes size and seed', () => {
      const config: GameSetupConfig = {
        faction: 'cyan',
        mapId: 'generated-standard-abc123',
        mapMode: 'generated',
        mapSize: 'standard',
        seed: 'abc123',
        gameMode: 'standard',
      };
      const name = getMapDisplayName(config);
      expect(name).toContain('standard');
      expect(name).toContain('abc123');
      expect(name).toContain('Generated');
    });

    it('arena config display name is "QA Arena"', () => {
      const config: GameSetupConfig = {
        faction: 'cyan',
        mapId: 'arena1',
        mapMode: 'fixed',
        mapSize: 'standard',
        seed: '',
        gameMode: 'arena',
      };
      expect(getMapDisplayName(config)).toBe('QA Arena');
    });

    it('unknown fixed map ID falls back to "Map {id}"', () => {
      const config: GameSetupConfig = {
        faction: 'cyan',
        mapId: 'someFutureMap',
        mapMode: 'fixed',
        mapSize: 'standard',
        seed: '',
        gameMode: 'standard',
      };
      expect(getMapDisplayName(config)).toBe('Map someFutureMap');
    });
  });

  // ── Fix 2: getMapDataById — malformed generated ID hardening ───

  describe('getMapDataById malformed generated IDs', () => {
    it('valid generated ID still returns generated map', () => {
      const mapData = getMapDataById('generated-small-testseed');
      expect(mapData.width).toBe(32);
      expect(mapData.height).toBe(32);
    });

    it('malformed generated ID with invalid size falls back to customMap1', () => {
      const mapData = getMapDataById('generated-weird-seed');
      // "weird" is not a valid MapSizeOption, should fall back to customMap1
      expect(mapData.width).toBe(48);
      expect(mapData.height).toBe(48);
    });

    it('generated ID with only prefix falls back to customMap1', () => {
      const mapData = getMapDataById('generated-');
      // Not enough parts to have size + seed
      expect(mapData.width).toBe(48);
    });

    it('generated ID with only prefix-size falls back to customMap1', () => {
      const mapData = getMapDataById('generated-small');
      // Only 2 parts, need at least 3 for size + seed
      expect(mapData.width).toBe(48);
    });
  });
});
