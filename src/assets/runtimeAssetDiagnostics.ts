/**
 * Runtime asset diagnostics — requires Phaser TextureManager.
 *
 * ARCH-17A: Checks which manifest keys are actually loaded into
 * the Phaser texture manager at runtime. Used by DevtoolsPanel
 * and AssetViewerPanel to show loaded/missing status.
 *
 * Separated from assetDiagnostics.ts to keep pure helpers
 * free of Phaser dependencies.
 */

import Phaser from 'phaser';
import {
  buildAssetDiagnostics,
  type AssetDiagnosticEntry,
  type AssetCategory,
} from './assetDiagnostics';

// ─── Types ──────────────────────────────────────────────────────────

/** Runtime status of a single asset key. */
export interface RuntimeAssetStatus {
  /** Asset key. */
  key: string;
  /** Whether the key exists in the Phaser TextureManager. */
  loaded: boolean;
  /** Whether this is a spritesheet (has frames) vs image. */
  isSpritesheet: boolean;
}

/** Runtime asset diagnostic result. */
export interface RuntimeAssetDiagnostics {
  /** All entries with runtime loaded status. */
  entries: RuntimeAssetEntry[];
  /** Summary counts. */
  summary: RuntimeAssetSummary;
}

/** Asset diagnostic entry with runtime loaded status. */
export interface RuntimeAssetEntry extends AssetDiagnosticEntry {
  /** Whether the asset key exists in Phaser TextureManager. Only set for manifest keys. */
  loaded?: boolean;
}

/** Runtime summary counts. */
export interface RuntimeAssetSummary {
  /** Total keys checked in TextureManager. */
  checked: number;
  /** Keys found in TextureManager. */
  loaded: number;
  /** Keys missing from TextureManager (expected but not loaded). */
  missing: number;
  /** Manifest-only entries (not wired in renderer). */
  manifestOnly: number;
  /** Placeholder entries (rendered with fallback). */
  placeholder: number;
  /** State-only / deferred entries (no visual). */
  stateOnlyAndDeferred: number;
  /** Counts by category. */
  byCategory: Record<AssetCategory, { total: number; loaded: number; missing: number }>;
}

/**
 * Build runtime asset diagnostics by checking Phaser TextureManager.
 *
 * This is the main entry point for runtime diagnostics.
 * Must be called after PreloadScene has finished loading.
 */
export function buildRuntimeAssetDiagnostics(
  scene: Phaser.Scene,
): RuntimeAssetDiagnostics {
  const entries = buildAssetDiagnostics();
  const textureManager = scene.textures;

  const runtimeEntries: RuntimeAssetEntry[] = [];
  let checked = 0;
  let loaded = 0;
  let missing = 0;
  let manifestOnly = 0;
  let placeholder = 0;
  let stateOnlyAndDeferred = 0;

  const byCategory: Record<AssetCategory, { total: number; loaded: number; missing: number }> = {
    terrain: { total: 0, loaded: 0, missing: 0 },
    resources: { total: 0, loaded: 0, missing: 0 },
    hq: { total: 0, loaded: 0, missing: 0 },
    buildings: { total: 0, loaded: 0, missing: 0 },
    'civil-units': { total: 0, loaded: 0, missing: 0 },
    'modular-units': { total: 0, loaded: 0, missing: 0 },
    obstacles: { total: 0, loaded: 0, missing: 0 },
    decor: { total: 0, loaded: 0, missing: 0 },
  };

  for (const entry of entries) {
    const runtimeEntry: RuntimeAssetEntry = { ...entry };

    // Only check loaded status for entries that have manifest keys
    if (entry.family && entry.status !== 'deferred' && entry.status !== 'state-only' && !entry.key.includes('_infinite') && entry.key !== 'building_placeholder_fallback') {
      const exists = textureManager.exists(entry.key);
      runtimeEntry.loaded = exists;
      checked++;
      if (exists) {
        loaded++;
      } else {
        missing++;
      }
      byCategory[entry.category].total++;
      if (exists) byCategory[entry.category].loaded++;
      else byCategory[entry.category].missing++;
    }

    switch (entry.status) {
      case 'manifest-only': manifestOnly++; break;
      case 'placeholder': placeholder++; break;
      case 'state-only':
      case 'deferred': stateOnlyAndDeferred++; break;
    }

    runtimeEntries.push(runtimeEntry);
  }

  return {
    entries: runtimeEntries,
    summary: {
      checked,
      loaded,
      missing,
      manifestOnly,
      placeholder,
      stateOnlyAndDeferred,
      byCategory,
    },
  };
}

/**
 * Get a compact loaded/missing/summary string for devtools display.
 */
export function formatRuntimeAssetSummary(summary: RuntimeAssetSummary): string {
  return `Loaded: ${summary.loaded}/${summary.checked} | Missing: ${summary.missing} | Unwired: ${summary.manifestOnly} | Placeholder: ${summary.placeholder} | Deferred: ${summary.stateOnlyAndDeferred}`;
}

/**
 * Get list of missing asset keys (expected by renderer but not loaded).
 */
export function getMissingAssetKeys(diagnostics: RuntimeAssetDiagnostics): string[] {
  return diagnostics.entries
    .filter(e => e.status === 'expected' && e.loaded === false)
    .map(e => e.key);
}

/**
 * Get list of manifest-only keys (in manifest but not wired in renderer).
 */
export function getManifestOnlyKeys(diagnostics: RuntimeAssetDiagnostics): string[] {
  return diagnostics.entries
    .filter(e => e.status === 'manifest-only')
    .map(e => e.key);
}
