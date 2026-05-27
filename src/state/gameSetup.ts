/**
 * Game setup configuration — pure TypeScript, no Phaser.
 *
 * ARCH-14B: Types, constants, and helpers for the new game setup flow.
 * This module defines the configuration that gets threaded from the
 * main menu → new game setup → GameScene.
 *
 * ARCH-16A: Extended with map mode (fixed/generated), map size,
 * and seed support.
 */

import type { Faction, MapData } from './types';
import { customMap1 } from '../data/maps/customMap1';
import { createArenaMapData, ARENA_MAP_ID } from './devArena';
import {
  createGeneratedMapData,
  type MapSizeOption,
  GENERATED_MAP_ID_PREFIX,
  generatedMapName,
} from './generatedMap';

// ─── Types ──────────────────────────────────────────────────────────

/** Map mode: fixed predefined map or deterministic generated map. */
export type MapMode = 'fixed' | 'generated';

/** Configuration for starting a new game. Passed between scenes. */
export interface GameSetupConfig {
  /** Player faction selection. */
  faction: Faction;
  /** Map ID to load. 'customMap1' for fixed, or 'generated-{size}-{seed}' for generated. */
  mapId: string;
  /** Map mode: fixed or generated. ARCH-16A. */
  mapMode: MapMode;
  /** Map size option (only used when mapMode is 'generated'). ARCH-16A. */
  mapSize: MapSizeOption;
  /** Seed string (only used when mapMode is 'generated'). ARCH-16A. */
  seed: string;
}

// ─── Constants ──────────────────────────────────────────────────────

/** All playable factions in display order. */
export const FACTION_LIST: Faction[] = ['cyan', 'green', 'yellow', 'purple'];

/** Phaser-compatible hex colors per faction. */
export const FACTION_COLORS: Record<Faction, number> = {
  cyan: 0x00ffff,
  green: 0x66ff66,
  yellow: 0xffcc00,
  purple: 0xcc66ff,
};

/** CSS color strings per faction (for DOM overlays). */
export const FACTION_CSS_COLORS: Record<Faction, string> = {
  cyan: '#00ffff',
  green: '#66ff66',
  yellow: '#ffcc00',
  purple: '#cc66ff',
};

/** Available maps for map selection UI. QA Arena is NOT exposed here — it is dev-only. */
export const MAP_LIST: ReadonlyArray<{ id: string; name: string; mode: MapMode }> = [
  { id: 'customMap1', name: 'Map 1', mode: 'fixed' },
  { id: GENERATED_MAP_ID_PREFIX, name: 'Generated', mode: 'generated' },
];

/** Available map size options for generated maps. */
export const MAP_SIZE_OPTIONS: MapSizeOption[] = ['small', 'standard', 'large'];

/** Default seed for generated maps. */
export const DEFAULT_SEED = 'default';

/** Default setup configuration (cyan faction, Map 1). */
export const DEFAULT_SETUP: GameSetupConfig = {
  faction: 'cyan',
  mapId: 'customMap1',
  mapMode: 'fixed',
  mapSize: 'standard',
  seed: DEFAULT_SEED,
};

// ─── Helpers ────────────────────────────────────────────────────────

/** Valid map size strings for validation. */
const VALID_MAP_SIZES: ReadonlySet<string> = new Set<string>(MAP_SIZE_OPTIONS);

/** Get a readable map display name from setup config. */
export function getMapDisplayName(config: GameSetupConfig): string {
  // Arena map (dev-only)
  if (config.mapId === ARENA_MAP_ID) {
    return 'QA Arena';
  }

  // Generated map
  if (config.mapMode === 'generated') {
    return generatedMapName(config.seed, config.mapSize);
  }

  // Fixed map — look up name from MAP_LIST
  const mapEntry = MAP_LIST.find(m => m.id === config.mapId);
  if (mapEntry) {
    return mapEntry.name;
  }

  // Fallback for unknown fixed map IDs
  return `Map ${config.mapId}`;
}

/** Get MapData by setup config. Handles fixed, generated, and arena maps. */
export function getMapDataFromConfig(config: GameSetupConfig): MapData {
  // Arena map (dev-only)
  if (config.mapId === ARENA_MAP_ID) {
    return createArenaMapData();
  }

  // Generated map
  if (config.mapMode === 'generated') {
    return createGeneratedMapData(config.seed, config.mapSize, config.faction);
  }

  // Fixed map
  return getMapDataById(config.mapId);
}

/** Get MapData by map ID. Returns default map for unknown IDs. */
export function getMapDataById(id: string): MapData {
  switch (id) {
    case ARENA_MAP_ID:
      return createArenaMapData();
    case 'customMap1':
      return customMap1;
    default:
      // Check if it's a generated map ID
      if (id.startsWith(GENERATED_MAP_ID_PREFIX)) {
        // Parse generated map ID: "generated-{size}-{seed}"
        const parts = id.split('-');
        if (parts.length >= 3) {
          const size = parts[1];
          // Validate size before using it — malformed IDs must fall back safely
          if (VALID_MAP_SIZES.has(size)) {
            const seed = parts.slice(2).join('-');
            return createGeneratedMapData(seed, size as MapSizeOption);
          }
        }
        // Malformed generated ID — fall back to customMap1
        return customMap1;
      }
      return customMap1;
  }
}

/** Check if the URL has a query parameter to skip menus (for QA/E2E). */
export function shouldSkipMenu(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('skipMenu') || params.has('autostart');
}
