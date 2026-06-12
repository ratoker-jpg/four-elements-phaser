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
  createValidatedGeneratedMapData,
  type MapSizeOption,
  GENERATED_MAP_ID_PREFIX,
  generatedMapName,
} from './generatedMap';

// ─── Types ──────────────────────────────────────────────────────────

/** Map mode: fixed predefined map or deterministic generated map. */
export type MapMode = 'fixed' | 'generated';

/** Game mode: standard play, debug with devtools, or arena combat sandbox. MENU-01. */
export type GameMode = 'standard' | 'debug' | 'arena';

/** Map visual style: sand (classic desert) or industrial platform. VISUAL-05A-PR2. */
export type MapStyle = 'sand' | 'industrial';

/** Resource visual style: legacy (sand mineral sprites) or industrial (VISUAL-06 crystals). VISUAL-06D. */
export type ResourceStyle = 'legacy' | 'industrial';

/** Available map style options. */
export const MAP_STYLE_OPTIONS: MapStyle[] = ['sand', 'industrial'];

/** Display labels for map styles. */
export const MAP_STYLE_LABELS: Record<MapStyle, string> = {
  sand: 'Песок / Классика',
  industrial: 'Промышленная платформа',
};

/** English labels for map styles (dev reference / fallback). */
export const MAP_STYLE_LABELS_EN: Record<MapStyle, string> = {
  sand: 'Sand / Classic',
  industrial: 'Industrial Platform',
};

/** Available resource style options. */
export const RESOURCE_STYLE_OPTIONS: ResourceStyle[] = ['legacy', 'industrial'];

/** Display labels for resource styles. */
export const RESOURCE_STYLE_LABELS: Record<ResourceStyle, string> = {
  legacy: 'Legacy / Classic',
  industrial: 'Industrial Crystals',
};

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
  /** Game mode: standard, debug (devtools), or arena. MENU-01. */
  gameMode: GameMode;
  /** Map visual style. VISUAL-05A-PR2. */
  mapStyle: MapStyle;
  /** Resource visual style. VISUAL-06D. 'legacy' keeps sand mineral sprites; 'industrial' uses VISUAL-06 crystal assets. */
  resourceStyle: ResourceStyle;
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

/** Available maps for map selection UI. QA Arena is NOT exposed here — it is dev-only.
 *  FIX-A2-MAP-CLEANUP-01: customMap1 ("Map 1") removed from visible selectable
 *  options. It remains as internal fallback in getMapDataById(). Use Sand / Classic
 *  map style with a generated map for calibration instead. */
export const MAP_LIST: ReadonlyArray<{ id: string; name: string; mode: MapMode }> = [
  { id: GENERATED_MAP_ID_PREFIX, name: 'Generated', mode: 'generated' },
];

/** Available map size options for generated maps. */
export const MAP_SIZE_OPTIONS: MapSizeOption[] = ['small', 'standard', 'large'];

/** All game modes in display order. MENU-01. */
export const GAME_MODE_LIST: GameMode[] = ['standard', 'debug', 'arena'];

/**
 * Display labels for game modes. MENU-01.
 * CORE-STEP-01A: Now uses Russian display names.
 * English labels remain as GAME_MODE_LABELS_EN for dev reference.
 */
export const GAME_MODE_LABELS: Record<GameMode, string> = {
  standard: 'Стандартный',
  debug: 'Отладка',
  arena: 'Арена',
};

/** English labels for game modes (dev reference / fallback). */
export const GAME_MODE_LABELS_EN: Record<GameMode, string> = {
  standard: 'Standard',
  debug: 'Debug',
  arena: 'Arena',
};

/** Default seed for generated maps. */
export const DEFAULT_SEED = 'default';

/**
 * Default setup configuration for new games.
 *
 * VISUAL-05A-PR5: Default changed from fixed/sand/standard to
 * generated/industrial/small. The industrial generated map is now
 * the default new-game experience. Sand/fixed remains available
 * as a manual fallback option.
 */
export const DEFAULT_SETUP: GameSetupConfig = {
  faction: 'cyan',
  mapId: GENERATED_MAP_ID_PREFIX,
  mapMode: 'generated',
  mapSize: 'small',
  seed: DEFAULT_SEED,
  gameMode: 'standard',
  mapStyle: 'industrial',
  resourceStyle: 'industrial',
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * VISUAL-06E fixup: Resolve default resourceStyle from mapStyle.
 *
 * - industrial mapStyle → industrial resourceStyle (VISUAL-06 crystal assets)
 * - sand mapStyle → legacy resourceStyle (sand mineral sprites)
 *
 * Used when creating a new setup config (NewGameSetupScene) or
 * inferring config from a loaded save (GameScene).
 * If resourceStyle is explicitly provided, it should be preserved.
 */
export function resolveResourceStyleForMapStyle(mapStyle: MapStyle): ResourceStyle {
  return mapStyle === 'industrial' ? 'industrial' : 'legacy';
}

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

  // FIX-A2-MAP-CLEANUP-01: customMap1 is no longer in MAP_LIST but may
  // still appear in saved games or internal fallback paths.
  if (config.mapId === 'customMap1') {
    return 'Sand Classic (legacy)';
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

  // Generated map — use validated creation with retry fallback
  if (config.mapMode === 'generated') {
    const result = createValidatedGeneratedMapData(config.seed, config.mapSize, config.faction, config.mapStyle ?? 'sand');
    if (!result.valid && result.warnings.length > 0) {
      console.warn('[gameSetup] Generated map validation warnings:', result.warnings);
    }
    return result.mapData;
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

// ─── Controlled URL launch (MENU-01) ───────────────────────────────

/**
 * Session storage key for persisting game setup config across page reload.
 * MENU-01: When Debug/Arena is selected, we reload the page with URL
 * params (?devtools=1, ?arena=1) so PreloadScene loads the correct
 * assets. The setup config (faction, map, seed) is stored in
 * sessionStorage so it survives the page reload.
 */
export const SETUP_SESSION_KEY = 'four-elements-setup-config';

/**
 * Build the launch URL for a given game mode.
 * MENU-01: Controlled URL launch model.
 *
 * - Standard: just skipMenu (no devtools/arena params)
 * - Debug: adds ?skipMenu&devtools=1
 * - Arena: adds ?skipMenu&devtools=1&arena=1
 */
export function buildGameLaunchUrl(gameMode: GameMode): string {
  const url = new URL(window.location.href);
  // Clear any existing mode params to avoid conflicts
  url.searchParams.delete('devtools');
  url.searchParams.delete('arena');

  // Always include skipMenu for controlled launches
  url.searchParams.set('skipMenu', '1');

  if (gameMode === 'debug') {
    url.searchParams.set('devtools', '1');
  } else if (gameMode === 'arena') {
    url.searchParams.set('devtools', '1');
    url.searchParams.set('arena', '1');
  }

  return url.href;
}

/**
 * Save game setup config to sessionStorage for retrieval after page reload.
 * MENU-01: Used before controlled URL launch for Debug/Arena modes.
 */
export function saveSetupToSession(config: GameSetupConfig): void {
  try {
    sessionStorage.setItem(SETUP_SESSION_KEY, JSON.stringify(config));
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

/**
 * Load game setup config from sessionStorage.
 * MENU-01: Used by MainMenuScene shouldSkipMenu flow to restore
 * the user's faction/map/seed selection after controlled URL launch.
 * Returns null if no config is stored.
 */
export function loadSetupFromSession(): GameSetupConfig | null {
  try {
    const stored = sessionStorage.getItem(SETUP_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as GameSetupConfig;
  } catch {
    return null;
  }
}

/**
 * Clear the stored setup config from sessionStorage.
 * MENU-01: Called after the config has been consumed.
 */
export function clearSetupSession(): void {
  try {
    sessionStorage.removeItem(SETUP_SESSION_KEY);
  } catch {
    // Ignore errors
  }
}
