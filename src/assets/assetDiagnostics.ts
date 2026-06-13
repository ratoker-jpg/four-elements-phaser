/**
 * Asset diagnostics — pure TypeScript, no Phaser.
 *
 * ARCH-17A: Provides a structured view of expected asset groups,
 * faction asset availability, and placeholder/state-only categories.
 *
 * Pure helpers: no Phaser, no DOM. Runtime loaded-checks require
 * Phaser TextureManager and are handled separately in
 * runtimeAssetDiagnostics.ts.
 *
 * Design decisions:
 * - Expected asset list is derived from GENERATED_ASSET_MANIFEST + known wiring.
 * - Faction gaps are documented, not fixed (feed future FIX-PACKAGE).
 * - Placeholder/state-only categories are explicit and testable.
 */

import { GENERATED_ASSET_MANIFEST, type GeneratedAssetFamilyName } from './generatedAssetManifest';
import { FACTION_LIST } from '../state/gameSetup';
import type { Faction } from '../state/types';

// ─── Types ──────────────────────────────────────────────────────────

/** Category of an asset entry for diagnostics classification. */
export type AssetCategory =
  | 'terrain'
  | 'resources'
  | 'hq'
  | 'buildings'
  | 'civil-units'
  | 'modular-units'
  | 'obstacles'
  | 'decor';

/** Whether an asset is expected, optional, or not yet wired in gameplay. */
export type AssetStatus =
  | 'expected'       // Manifest has key, renderer is wired
  | 'manifest-only'  // Manifest has key, but renderer does not use it yet
  | 'placeholder'    // Rendered with fallback visual (e.g. green diamond)
  | 'state-only'     // Exists in state model but no visual asset at all
  | 'deferred';      // Intentionally not placed in current PR (e.g. obstacles/decor)

/** A single asset diagnostic entry. */
export interface AssetDiagnosticEntry {
  /** Asset key from the manifest (or synthetic key for state-only items). */
  key: string;
  /** Category group. */
  category: AssetCategory;
  /** Manifest family name if applicable. */
  family?: GeneratedAssetFamilyName;
  /** Faction if relevant (HQ, buildings, units). */
  faction?: Faction;
  /** Load type from manifest ('image' | 'spritesheet'). */
  loadType?: 'image' | 'spritesheet';
  /** Expected vs actual status. */
  status: AssetStatus;
  /** Human-readable note explaining the status. */
  note: string;
}

/** Summary counts for asset diagnostics. */
export interface AssetDiagnosticSummary {
  /** Total assets in manifest. */
  totalManifest: number;
  /** Assets expected and wired in gameplay. */
  expected: number;
  /** Assets in manifest but not wired in renderer yet. */
  manifestOnly: number;
  /** Assets rendered with placeholder visuals. */
  placeholder: number;
  /** Assets that exist in state model only (no visual). */
  stateOnly: number;
  /** Assets deferred to future PR. */
  deferred: number;
  /** Counts by category. */
  byCategory: Record<AssetCategory, number>;
  /** Faction availability summary. */
  factionAvailability: FactionAvailabilitySummary;
}

/** Faction asset availability summary. */
export interface FactionAvailabilitySummary {
  /** Per-faction breakdown. */
  factions: Record<Faction, FactionAssetDetail>;
}

/** Per-faction asset detail. */
export interface FactionAssetDetail {
  /** HQ asset exists in manifest. */
  hqInManifest: boolean;
  /** HQ is wired in EntityRenderer (currently cyan-only). */
  hqWired: boolean;
  /** Builder spritesheet exists in manifest. */
  builderInManifest: boolean;
  /** Builder is wired in ConstructionRenderer. */
  builderWired: boolean;
  /** Harvester spritesheet exists in manifest. */
  harvesterInManifest: boolean;
  /** Harvester is wired in EntityRenderer (currently cyan-only). */
  harvesterWired: boolean;
  /** Building assets exist in manifest (per building type). */
  buildingKeysInManifest: number;
  /** Modular unit hull+ turret keys exist in manifest. */
  modularUnitKeysInManifest: number;
  /** Note explaining faction-specific gaps. */
  note: string;
}

// ─── Constants ──────────────────────────────────────────────────────

/** State-only categories that have no visual assets at all. */
const STATE_ONLY_CATEGORIES: AssetCategory[] = ['obstacles', 'decor'];

// ─── Pure diagnostics helpers ───────────────────────────────────────

/**
 * Build the full list of expected asset diagnostic entries.
 *
 * Derives from GENERATED_ASSET_MANIFEST + known wiring status.
 * Pure function — no Phaser, no DOM.
 */
export function buildAssetDiagnostics(): AssetDiagnosticEntry[] {
  const entries: AssetDiagnosticEntry[] = [];

  // ── Terrain ──
  for (const key of GENERATED_ASSET_MANIFEST.families.terrain.keys) {
    entries.push({
      key,
      category: 'terrain',
      family: 'terrain',
      loadType: 'image',
      status: 'expected',
      note: 'Terrain tiles — loaded and rendered by TerrainRenderer.',
    });
  }

  // ── Resources ──
  for (const key of GENERATED_ASSET_MANIFEST.families.resources.keys) {
    entries.push({
      key,
      category: 'resources',
      family: 'resources',
      loadType: 'image',
      status: 'expected',
      note: 'Resource mineral images — loaded and rendered by EntityRenderer.',
    });
  }
  // Infinite resource uses mineral_large as fallback — note it
  entries.push({
    key: 'mineral_infinite',
    category: 'resources',
    loadType: 'image',
    status: 'placeholder',
    note: 'No infinite-specific asset; EntityRenderer uses mineral_large at larger scale.',
  });

  // ── HQ ──
  for (const key of GENERATED_ASSET_MANIFEST.families.hq.keys) {
    const faction = extractFactionFromKey(key, 'hq');
    const isCyan = faction === 'cyan';
    entries.push({
      key,
      category: 'hq',
      family: 'hq',
      faction,
      loadType: 'image',
      status: isCyan ? 'expected' : 'manifest-only',
      note: isCyan
        ? 'Cyan HQ — loaded and rendered by EntityRenderer.'
        : `Non-cyan HQ "${key}" in manifest but EntityRenderer only wires cyan. Needs faction wiring fix.`,
    });
  }

  // ── Buildings ──
  for (const key of GENERATED_ASSET_MANIFEST.families.buildings.keys) {
    const faction = extractFactionFromKey(key, 'building');
    const isCyan = faction === 'cyan';
    entries.push({
      key,
      category: 'buildings',
      family: 'buildings',
      faction,
      loadType: 'image',
      status: isCyan ? 'expected' : 'manifest-only',
      note: isCyan
        ? 'Cyan building — loaded and rendered by ConstructionRenderer.'
        : `Non-cyan building "${key}" in manifest but renderer uses cyan assets. Needs faction wiring fix.`,
    });
  }
  // State-only building entries (buildings without completed visual)
  entries.push({
    key: 'building_placeholder_fallback',
    category: 'buildings',
    loadType: 'image',
    status: 'placeholder',
    note: 'ConstructionRenderer uses green diamond fallback for buildings with missing metadata/texture.',
  });

  // ── Civil Units ──
  for (const key of GENERATED_ASSET_MANIFEST.families.civilUnits.keys) {
    const unitType = key.startsWith('builder_') ? 'builder' : 'harvester';
    const faction = key.split('_')[1] as Faction;
    const isCyan = faction === 'cyan';

    let status: AssetStatus;
    let note: string;

    if (unitType === 'harvester') {
      status = isCyan ? 'expected' : 'manifest-only';
      note = isCyan
        ? 'Cyan harvester — loaded and rendered by EntityRenderer with spritesheet direction.'
        : `Non-cyan harvester "${key}" in manifest but EntityRenderer hardcodes HARVESTER_CYAN. Needs faction wiring fix.`;
    } else {
      // Builder: ConstructionRenderer uses builder_{faction} texture
      status = 'expected';
      note = `Builder "${key}" — loaded and rendered by ConstructionRenderer with spritesheet direction.`;
    }

    entries.push({
      key,
      category: 'civil-units',
      family: 'civilUnits',
      faction,
      loadType: 'spritesheet',
      status,
      note,
    });
  }

  // ── Modular Units ──
  // Legacy modularUnits family is disabled (PNGs removed). Mark as 'manifest-only'.
  for (const key of GENERATED_ASSET_MANIFEST.families.modularUnits.keys) {
    const faction = extractFactionFromModularKey(key);
    entries.push({
      key,
      category: 'modular-units',
      family: 'modularUnits',
      faction,
      loadType: 'image',
      status: 'manifest-only',
      note: 'Legacy modular unit key — family disabled (PNGs removed from assets/units/chassis/wasp_m0/ and assets/units/weapons/smoky_m0/). Use generated hull/turret resolvers instead.',
    });
  }

  // ── Obstacles (state-only / deferred) ──
  const obstacleTypes = ['mountain-small', 'mountain-medium', 'mountain-large', 'volcano-small', 'volcano-medium', 'rock-cluster'] as const;
  for (const type of obstacleTypes) {
    entries.push({
      key: `obstacle_${type}`,
      category: 'obstacles',
      status: 'deferred',
      note: `Obstacle "${type}" exists in state model (ObstacleType) but no visual asset. Generated maps have obstacles disabled (PR #78 fixup). Deferred until visual placeholder exists.`,
    });
  }

  // ── Decor (state-only / deferred) ──
  const decorTypes = ['bush', 'sand-bump'] as const;
  for (const type of decorTypes) {
    entries.push({
      key: `decor_${type}`,
      category: 'decor',
      status: 'deferred',
      note: `Decor "${type}" exists in state model (DecorType) but no visual asset. Generated maps have decor disabled (PR #78 fixup). Deferred until visual placeholder exists.`,
    });
  }

  return entries;
}

/**
 * Summarize asset diagnostics into counts.
 *
 * Pure function — no Phaser, no DOM.
 */
export function summarizeAssetDiagnostics(entries: AssetDiagnosticEntry[]): AssetDiagnosticSummary {
  const byCategory: Record<AssetCategory, number> = {
    terrain: 0,
    resources: 0,
    hq: 0,
    buildings: 0,
    'civil-units': 0,
    'modular-units': 0,
    obstacles: 0,
    decor: 0,
  };

  let expected = 0;
  let manifestOnly = 0;
  let placeholder = 0;
  let stateOnly = 0;
  let deferred = 0;

  for (const entry of entries) {
    byCategory[entry.category]++;
    switch (entry.status) {
      case 'expected': expected++; break;
      case 'manifest-only': manifestOnly++; break;
      case 'placeholder': placeholder++; break;
      case 'state-only': stateOnly++; break;
      case 'deferred': deferred++; break;
    }
  }

  return {
    totalManifest: countManifestKeys(),
    expected,
    manifestOnly,
    placeholder,
    stateOnly,
    deferred,
    byCategory,
    factionAvailability: buildFactionAvailability(entries),
  };
}

/**
 * Count total asset keys in the generated manifest.
 */
export function countManifestKeys(): number {
  let count = 0;
  for (const family of Object.values(GENERATED_ASSET_MANIFEST.families)) {
    count += family.keys.length;
  }
  return count;
}

/**
 * Build per-faction asset availability detail.
 *
 * Pure function — documents what exists vs what is wired.
 */
export function buildFactionAvailability(entries?: AssetDiagnosticEntry[]): FactionAvailabilitySummary {
  if (!entries) entries = buildAssetDiagnostics();

  const factions: Record<string, FactionAssetDetail> = {};

  for (const faction of FACTION_LIST) {
    const hqKey = `hq_${faction}` as const;
    const builderKey = `builder_${faction}` as const;
    const harvesterKey = `harvester_${faction}` as const;

    const hqInManifest = (GENERATED_ASSET_MANIFEST.families.hq.keys as readonly string[]).includes(hqKey);
    const builderInManifest = (GENERATED_ASSET_MANIFEST.families.civilUnits.keys as readonly string[]).includes(builderKey);
    const harvesterInManifest = (GENERATED_ASSET_MANIFEST.families.civilUnits.keys as readonly string[]).includes(harvesterKey);

    // Check wiring status from entries
    const hqEntry = entries.find(e => e.key === hqKey);
    const builderEntry = entries.find(e => e.key === builderKey);
    const harvesterEntry = entries.find(e => e.key === harvesterKey);

    const buildingKeysInManifest = GENERATED_ASSET_MANIFEST.families.buildings.keys
      .filter(k => k.includes(`_${faction}_`)).length;

    const modularUnitKeysInManifest = GENERATED_ASSET_MANIFEST.families.modularUnits.keys
      .filter(k => k.includes(`_${faction}_`)).length;

    const isCyan = faction === 'cyan';
    const notes: string[] = [];
    if (!hqInManifest) notes.push('HQ not in manifest');
    else if (hqEntry?.status === 'manifest-only') notes.push('HQ in manifest but not wired in renderer');
    if (!builderInManifest) notes.push('Builder not in manifest');
    if (!harvesterInManifest) notes.push('Harvester not in manifest');
    else if (harvesterEntry?.status === 'manifest-only') notes.push('Harvester in manifest but renderer hardcodes cyan');

    factions[faction] = {
      hqInManifest,
      hqWired: hqEntry?.status === 'expected',
      builderInManifest,
      builderWired: builderEntry?.status === 'expected',
      harvesterInManifest,
      harvesterWired: harvesterEntry?.status === 'expected',
      buildingKeysInManifest,
      modularUnitKeysInManifest,
      note: isCyan ? 'Cyan — fully wired in all renderers.' : (notes.length > 0 ? notes.join('; ') + '.' : 'All assets in manifest but renderer wiring may be incomplete.'),
    };
  }

  return { factions: factions as Record<Faction, FactionAssetDetail> };
}

/**
 * Classify a category as state-only (no visual assets at all).
 */
export function isStateOnlyCategory(category: AssetCategory): boolean {
  return STATE_ONLY_CATEGORIES.includes(category);
}

/**
 * Get list of categories that are currently deferred.
 */
export function getDeferredCategories(): AssetCategory[] {
  return ['obstacles', 'decor'];
}

/**
 * Get the list of all asset families from the generated manifest.
 */
export function getManifestFamilies(): GeneratedAssetFamilyName[] {
  return Object.keys(GENERATED_ASSET_MANIFEST.families) as GeneratedAssetFamilyName[];
}

// ─── Internal helpers ───────────────────────────────────────────────

/**
 * Extract faction from an asset key.
 * HQ keys: "hq_cyan" → "cyan"
 * Building keys: "building_cyan_separator" → "cyan"
 */
function extractFactionFromKey(key: string, prefix: string): Faction {
  const parts = key.split('_');
  // For "hq_cyan": parts = ["hq", "cyan"], faction = parts[1]
  // For "building_cyan_separator": parts = ["building", "cyan", "separator"], faction = parts[1]
  const prefixParts = prefix.split('_').length;
  if (parts.length > prefixParts) {
    return parts[prefixParts] as Faction;
  }
  return 'cyan'; // fallback
}

/**
 * Extract faction from a modular unit key.
 * "wasp_m0_hull_cyan_dir0" → "cyan"
 * "smoky_m0_turret_green_dir3" → "green"
 */
function extractFactionFromModularKey(key: string): Faction {
  // Pattern: {chassis|weapon}_m0_{hull|turret}_{faction}_dir{N}
  const match = key.match(/_(cyan|green|yellow|purple)_dir/);
  return match ? (match[1] as Faction) : 'cyan';
}
