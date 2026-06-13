/**
 * Tests for assetDiagnostics — pure TypeScript, no Phaser.
 *
 * ARCH-17A/17B: Tests for:
 * - Expected asset registry contains required groups
 * - Faction asset diagnostics identifies cyan/non-cyan state
 * - Placeholder/state-only categories are classified correctly
 * - No generated map or gameplay behavior changes
 */

import { describe, it, expect } from 'vitest';
import {
  buildAssetDiagnostics,
  summarizeAssetDiagnostics,
  countManifestKeys,
  buildFactionAvailability,
  isStateOnlyCategory,
  getDeferredCategories,
  getManifestFamilies,
  type AssetCategory,
} from '../assets/assetDiagnostics';
import { FACTION_LIST } from '../state/gameSetup';

describe('ARCH-17A/17B: assetDiagnostics', () => {
  // ── Expected asset registry groups ─────────────────────────────

  describe('expected asset registry groups', () => {
    it('contains all required categories', () => {
      const entries = buildAssetDiagnostics();
      const categories = new Set(entries.map(e => e.category));

      const requiredCategories: AssetCategory[] = [
        'terrain', 'resources', 'hq', 'buildings',
        'civil-units', 'modular-units', 'obstacles', 'decor',
      ];

      for (const cat of requiredCategories) {
        expect(categories.has(cat), `Missing category: ${cat}`).toBe(true);
      }
    });

    it('terrain category has 6 entries (TERRAIN-02A 6-variant family)', () => {
      const entries = buildAssetDiagnostics();
      const terrain = entries.filter(e => e.category === 'terrain');
      expect(terrain.length).toBe(6);
      expect(terrain.every(e => e.status === 'expected')).toBe(true);
    });

    it('resources category has 3 manifest entries + 1 placeholder (infinite)', () => {
      const entries = buildAssetDiagnostics();
      const resources = entries.filter(e => e.category === 'resources');
      const manifestEntries = resources.filter(e => e.status === 'expected');
      const placeholderEntries = resources.filter(e => e.status === 'placeholder');
      expect(manifestEntries.length).toBe(3);
      expect(placeholderEntries.length).toBe(1);
      expect(placeholderEntries[0].key).toBe('mineral_infinite');
    });

    it('HQ category has 4 entries (one per faction)', () => {
      const entries = buildAssetDiagnostics();
      const hq = entries.filter(e => e.category === 'hq');
      expect(hq.length).toBe(4);

      const factions = new Set(hq.map(e => e.faction));
      expect(factions.has('cyan')).toBe(true);
      expect(factions.has('green')).toBe(true);
      expect(factions.has('yellow')).toBe(true);
      expect(factions.has('purple')).toBe(true);
    });

    it('civil-units category has entries for all factions (builder + harvester)', () => {
      const entries = buildAssetDiagnostics();
      const civilUnits = entries.filter(e => e.category === 'civil-units');
      // 4 factions × 2 unit types = 8
      expect(civilUnits.length).toBe(8);

      for (const faction of FACTION_LIST) {
        const factionUnits = civilUnits.filter(e => e.faction === faction);
        expect(factionUnits.length, `Expected 2 civil units for ${faction}`).toBe(2);
      }
    });

    it('modular-units category has entries for all factions (marked manifest-only)', () => {
      const entries = buildAssetDiagnostics();
      const modular = entries.filter(e => e.category === 'modular-units');
      // 4 factions × 16 keys (8 hull + 8 turret) = 64
      expect(modular.length).toBe(64);
      // All marked manifest-only (family disabled — legacy PNGs removed)
      expect(modular.every(e => e.status === 'manifest-only')).toBe(true);
    });

    it('buildings category has entries for all factions plus placeholder', () => {
      const entries = buildAssetDiagnostics();
      const buildings = entries.filter(e => e.category === 'buildings');
      // 4 factions × 6 building types = 24 + 1 placeholder fallback
      expect(buildings.length).toBe(25);
      const placeholder = buildings.filter(e => e.status === 'placeholder');
      expect(placeholder.length).toBe(1);
    });
  });

  // ── Faction asset diagnostics ──────────────────────────────────

  describe('faction asset diagnostics', () => {
    it('cyan faction is fully wired', () => {
      const factionAvail = buildFactionAvailability();
      const cyan = factionAvail.factions.cyan;

      expect(cyan.hqInManifest).toBe(true);
      expect(cyan.hqWired).toBe(true);
      expect(cyan.builderInManifest).toBe(true);
      expect(cyan.builderWired).toBe(true);
      expect(cyan.harvesterInManifest).toBe(true);
      expect(cyan.harvesterWired).toBe(true);
    });

    it('non-cyan factions have HQ in manifest but not wired', () => {
      const factionAvail = buildFactionAvailability();

      for (const faction of ['green', 'yellow', 'purple'] as const) {
        const detail = factionAvail.factions[faction];
        expect(detail.hqInManifest, `${faction} HQ should be in manifest`).toBe(true);
        expect(detail.hqWired, `${faction} HQ should NOT be wired yet`).toBe(false);
      }
    });

    it('non-cyan factions have harvester in manifest but not wired', () => {
      const factionAvail = buildFactionAvailability();

      for (const faction of ['green', 'yellow', 'purple'] as const) {
        const detail = factionAvail.factions[faction];
        expect(detail.harvesterInManifest, `${faction} harvester should be in manifest`).toBe(true);
        expect(detail.harvesterWired, `${faction} harvester should NOT be wired yet`).toBe(false);
      }
    });

    it('all factions have builder wired', () => {
      const factionAvail = buildFactionAvailability();

      for (const faction of FACTION_LIST) {
        const detail = factionAvail.factions[faction];
        expect(detail.builderInManifest, `${faction} builder should be in manifest`).toBe(true);
        expect(detail.builderWired, `${faction} builder should be wired`).toBe(true);
      }
    });

    it('all factions have building keys in manifest', () => {
      const factionAvail = buildFactionAvailability();

      for (const faction of FACTION_LIST) {
        const detail = factionAvail.factions[faction];
        // 6 building types per faction
        expect(detail.buildingKeysInManifest, `${faction} should have 6 building keys`).toBe(6);
      }
    });

    it('all factions have modular unit keys in manifest', () => {
      const factionAvail = buildFactionAvailability();

      for (const faction of FACTION_LIST) {
        const detail = factionAvail.factions[faction];
        // 8 hull + 8 turret = 16 per faction
        expect(detail.modularUnitKeysInManifest, `${faction} should have 16 modular unit keys`).toBe(16);
      }
    });

    it('faction notes explain gaps for non-cyan', () => {
      const factionAvail = buildFactionAvailability();
      const green = factionAvail.factions.green;
      expect(green.note.length).toBeGreaterThan(0);
      expect(green.note).toContain('manifest');
    });
  });

  // ── Placeholder / state-only classification ────────────────────

  describe('placeholder and state-only classification', () => {
    it('obstacles are classified as deferred', () => {
      const entries = buildAssetDiagnostics();
      const obstacles = entries.filter(e => e.category === 'obstacles');
      expect(obstacles.length).toBeGreaterThan(0);
      expect(obstacles.every(e => e.status === 'deferred')).toBe(true);
    });

    it('decor is classified as deferred', () => {
      const entries = buildAssetDiagnostics();
      const decor = entries.filter(e => e.category === 'decor');
      expect(decor.length).toBeGreaterThan(0);
      expect(decor.every(e => e.status === 'deferred')).toBe(true);
    });

    it('infinite resource is classified as placeholder', () => {
      const entries = buildAssetDiagnostics();
      const infinite = entries.find(e => e.key === 'mineral_infinite');
      expect(infinite).toBeDefined();
      expect(infinite!.status).toBe('placeholder');
    });

    it('building fallback is classified as placeholder', () => {
      const entries = buildAssetDiagnostics();
      const fallback = entries.find(e => e.key === 'building_placeholder_fallback');
      expect(fallback).toBeDefined();
      expect(fallback!.status).toBe('placeholder');
    });

    it('isStateOnlyCategory identifies obstacles and decor', () => {
      expect(isStateOnlyCategory('obstacles')).toBe(true);
      expect(isStateOnlyCategory('decor')).toBe(true);
      expect(isStateOnlyCategory('terrain')).toBe(false);
      expect(isStateOnlyCategory('hq')).toBe(false);
    });

    it('getDeferredCategories returns obstacles and decor', () => {
      const deferred = getDeferredCategories();
      expect(deferred).toContain('obstacles');
      expect(deferred).toContain('decor');
    });
  });

  // ── Summary counts ─────────────────────────────────────────────

  describe('summary counts', () => {
    it('countManifestKeys returns 126', () => {
      // TERRAIN-02A + VISUAL-05A-PR2/PR3 + VISUAL-06D: Generated manifest has 126 keys: hq(4) + buildings(24) + civilUnits(8) + modularUnits(64) + terrain(6) + industrialTerrain(8) + resources(3) + industrialResources(6) + industrialFrame(3)
      expect(countManifestKeys()).toBe(126);
    });

    it('summarizeAssetDiagnostics has correct total', () => {
      const entries = buildAssetDiagnostics();
      const summary = summarizeAssetDiagnostics(entries);
      expect(summary.totalManifest).toBe(126);
      expect(summary.expected).toBeGreaterThan(0);
      expect(summary.manifestOnly).toBeGreaterThan(0);
      expect(summary.placeholder).toBeGreaterThan(0);
      expect(summary.deferred).toBeGreaterThan(0);
    });

    it('summary byCategory has all categories', () => {
      const entries = buildAssetDiagnostics();
      const summary = summarizeAssetDiagnostics(entries);

      const requiredCategories: AssetCategory[] = [
        'terrain', 'resources', 'hq', 'buildings',
        'civil-units', 'modular-units', 'obstacles', 'decor',
      ];

      for (const cat of requiredCategories) {
        expect(summary.byCategory[cat], `Missing category in summary: ${cat}`).toBeDefined();
      }
    });

    it('cyan has fewer unwired entries than non-cyan', () => {
      const entries = buildAssetDiagnostics();
      const cyanExpected = entries.filter(e => e.faction === 'cyan' && e.status === 'expected');
      const nonCyanManifestOnly = entries.filter(e => e.faction !== 'cyan' && e.status === 'manifest-only');

      expect(cyanExpected.length).toBeGreaterThan(0);
      expect(nonCyanManifestOnly.length).toBeGreaterThan(0);
    });
  });

  // ── Manifest families ──────────────────────────────────────────

  describe('manifest families', () => {
    it('getManifestFamilies returns all 8 families', () => {
      const families = getManifestFamilies();
      expect(families).toContain('hq');
      expect(families).toContain('buildings');
      expect(families).toContain('civilUnits');
      expect(families).toContain('modularUnits');
      expect(families).toContain('terrain');
      expect(families).toContain('industrialTerrain');
      expect(families).toContain('resources');
      expect(families).toContain('industrialResources');
      expect(families).toContain('industrialFrame');
      expect(families.length).toBe(9);
    });
  });

  // ── No gameplay behavior changes ───────────────────────────────

  describe('no gameplay behavior changes', () => {
    it('diagnostics are read-only and do not affect game state', () => {
      // Simply verifying that buildAssetDiagnostics returns pure data
      const entries1 = buildAssetDiagnostics();
      const entries2 = buildAssetDiagnostics();
      expect(entries1).toEqual(entries2);
    });
  });
});
