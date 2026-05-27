/**
 * Game setup configuration — pure TypeScript, no Phaser.
 *
 * ARCH-14B: Types, constants, and helpers for the new game setup flow.
 * This module defines the configuration that gets threaded from the
 * main menu → new game setup → GameScene.
 */

import type { Faction, MapData } from './types';
import { customMap1 } from '../data/maps/customMap1';

// ─── Types ──────────────────────────────────────────────────────────

/** Configuration for starting a new game. Passed between scenes. */
export interface GameSetupConfig {
  /** Player faction selection. */
  faction: Faction;
  /** Map ID to load. Currently only 'customMap1'. */
  mapId: string;
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

/** Available maps for map selection UI. */
export const MAP_LIST: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'customMap1', name: 'Map 1' },
];

/** Default setup configuration (cyan faction, Map 1). */
export const DEFAULT_SETUP: GameSetupConfig = {
  faction: 'cyan',
  mapId: 'customMap1',
};

// ─── Helpers ────────────────────────────────────────────────────────

/** Get MapData by map ID. Returns default map for unknown IDs. */
export function getMapDataById(id: string): MapData {
  switch (id) {
    case 'customMap1':
      return customMap1;
    default:
      return customMap1;
  }
}

/** Check if the URL has a query parameter to skip menus (for QA/E2E). */
export function shouldSkipMenu(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('skipMenu') || params.has('autostart');
}
