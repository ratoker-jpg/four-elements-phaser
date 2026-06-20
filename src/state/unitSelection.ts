/**
 * Unit selection model — pure TypeScript, no Phaser.
 *
 * SELECTION-CONTROL-GROUPS-05: Evolved from single-selection to multi-selection.
 *
 * Tracks which civil units (builders/harvesters) are currently selected.
 * Selection is stored as a discriminated union:
 *   - SingleSelection: exactly one unit
 *   - MultiSelection: two or more units
 *   - null: nothing selected
 *
 * Selection state is NOT stored in GameState — it is UI-layer state
 * that lives in GameScene. This keeps the pure state model clean.
 */

import type { GameState } from './types';

// ─── Types ─────────────────────────────────────────────────────────

/** Identifies a selectable civil unit. */
export type SelectableUnit =
  | { kind: 'builder'; id: string }
  | { kind: 'harvester'; id: string };

/** Single = exactly one unit selected. */
export interface SingleSelection {
  kind: 'single';
  units: [SelectableUnit];
  primaryId: string;
}

/** Multi = two or more units selected. */
export interface MultiSelection {
  kind: 'multi';
  units: SelectableUnit[];
  primaryId: string; // first selected or clicked unit
}

/** Current selection state — null means nothing selected. */
export type UnitSelection = SingleSelection | MultiSelection | null;

// ─── Selection constructors ─────────────────────────────────────────

/** Select exactly one unit. */
export function selectOne(unit: SelectableUnit): SingleSelection {
  return { kind: 'single', units: [unit], primaryId: unit.id };
}

/** Select multiple units. If 1 unit, returns SingleSelection; if 2+, returns MultiSelection. */
export function selectMany(units: SelectableUnit[], primaryId?: string): UnitSelection {
  if (units.length === 0) return null;
  if (units.length === 1) return selectOne(units[0]);
  const pid = primaryId ?? units[0].id;
  return { kind: 'multi', units, primaryId: pid };
}

/** Add a unit to the current selection (for Shift+click add). */
export function addToSelection(current: UnitSelection, unit: SelectableUnit): UnitSelection {
  // If already in selection, just return current
  if (current && isUnitSelected(current) && isUnitInSelection(current, unit.id)) {
    return current;
  }

  if (!current) return selectOne(unit);

  const allUnits = [...current.units, unit];
  return selectMany(allUnits, current.primaryId);
}

/** Toggle a unit in the current selection (Shift+click toggle). */
export function toggleInSelection(current: UnitSelection, unit: SelectableUnit): UnitSelection {
  if (!current) return selectOne(unit);

  const isIn = isUnitInSelection(current, unit.id);
  if (isIn) {
    // Remove the unit
    const remaining = current.units.filter(u => u.id !== unit.id);
    if (remaining.length === 0) return null;
    if (remaining.length === 1) return selectOne(remaining[0]);
    return { kind: 'multi', units: remaining, primaryId: current.primaryId === unit.id ? remaining[0].id : current.primaryId };
  }

  // Add the unit
  return addToSelection(current, unit);
}

/** Clear selection. */
export function clearSelection(): null {
  return null;
}

// ─── Selection query helpers ────────────────────────────────────────

/** Whether any unit is selected. */
export function isUnitSelected(sel: UnitSelection): sel is SingleSelection | MultiSelection {
  return sel !== null;
}

/** Whether a builder is selected (checks primary for backward compat). */
export function isBuilderSelected(sel: UnitSelection): sel is SingleSelection | MultiSelection & { units: [{ kind: 'builder'; id: string }] } {
  if (sel === null) return false;
  // For backward compat, check if primary unit is a builder
  const primary = getPrimarySelection(sel);
  return primary !== null && primary.kind === 'builder';
}

/** Whether a harvester is selected (checks primary for backward compat). */
export function isHarvesterSelected(sel: UnitSelection): sel is SingleSelection | MultiSelection & { units: [{ kind: 'harvester'; id: string }] } {
  if (sel === null) return false;
  const primary = getPrimarySelection(sel);
  return primary !== null && primary.kind === 'harvester';
}

/** Get all selected unit IDs. */
export function getSelectedIds(selection: UnitSelection): string[] {
  if (!selection) return [];
  return selection.units.map(u => u.id);
}

/** Get the primary (first/clicked) selected unit. */
export function getPrimarySelection(selection: UnitSelection): SelectableUnit | null {
  if (!selection) return null;
  return selection.units.find(u => u.id === selection.primaryId) ?? selection.units[0] ?? null;
}

/** Check if a specific unit ID is in the selection. */
export function isUnitInSelection(selection: UnitSelection, id: string): boolean {
  if (!selection) return false;
  return selection.units.some(u => u.id === id);
}

/** Prune missing entities from selection. */
export function pruneMissingEntities(selection: UnitSelection, state: GameState): UnitSelection {
  if (!selection) return null;

  const remaining = selection.units.filter(u => {
    if (u.kind === 'builder') {
      return state.mapData.builders.some(b => b.id === u.id);
    } else if (u.kind === 'harvester') {
      return state.harvesters.some(h => h.id === u.id);
    }
    return false;
  });

  if (remaining.length === 0) return null;
  if (remaining.length === 1) return selectOne(remaining[0]);

  const primaryAlive = remaining.some(u => u.id === selection.primaryId);
  return { kind: 'multi', units: remaining, primaryId: primaryAlive ? selection.primaryId : remaining[0].id };
}

/** Get the selection kind for display purposes. */
export function getSelectionKind(selection: UnitSelection): 'empty' | 'single' | 'multi' {
  if (!selection) return 'empty';
  return selection.kind === 'single' ? 'single' : 'multi';
}

/** Get a breakdown of selected units by type. */
export function getSelectionTypeBreakdown(selection: UnitSelection): Map<string, number> {
  const breakdown = new Map<string, number>();
  if (!selection) return breakdown;

  for (const u of selection.units) {
    const count = breakdown.get(u.kind) ?? 0;
    breakdown.set(u.kind, count + 1);
  }
  return breakdown;
}

/**
 * Get the center point of the selection in tile space (average of all unit positions).
 *
 * FIXUP-1: Returns tile-space {tx, ty} to keep this module free of
 * phaser/render imports. Convert to world/screen coords in the
 * camera/input layer (GameInputController) where tileToScreen lives.
 */
export function getSelectionCenterTile(selection: UnitSelection, state: GameState): { tx: number; ty: number } | null {
  if (!selection) return null;

  let sumTx = 0;
  let sumTy = 0;
  let count = 0;

  for (const u of selection.units) {
    if (u.kind === 'builder') {
      const b = state.mapData.builders.find(b => b.id === u.id);
      if (b) {
        sumTx += b.ftx;
        sumTy += b.fty;
        count++;
      }
    } else if (u.kind === 'harvester') {
      const h = state.harvesters.find(h => h.id === u.id);
      if (h) {
        sumTx += h.ftx;
        sumTy += h.fty;
        count++;
      }
    }
  }

  if (count === 0) return null;

  return { tx: sumTx / count, ty: sumTy / count };
}

/** Whether any selected unit is a builder. */
export function hasBuilderInSelection(selection: UnitSelection): boolean {
  if (!selection) return false;
  return selection.units.some(u => u.kind === 'builder');
}

/** Whether any selected unit is a harvester. */
export function hasHarvesterInSelection(selection: UnitSelection): boolean {
  if (!selection) return false;
  return selection.units.some(u => u.kind === 'harvester');
}

/** Whether all selected units are builders. */
export function isAllBuilders(selection: UnitSelection): boolean {
  if (!selection) return false;
  return selection.units.length > 0 && selection.units.every(u => u.kind === 'builder');
}

/** Whether all selected units are harvesters. */
export function isAllHarvesters(selection: UnitSelection): boolean {
  if (!selection) return false;
  return selection.units.length > 0 && selection.units.every(u => u.kind === 'harvester');
}

// ─── Legacy compatibility helpers ───────────────────────────────────

/** Create a builder selection by stable ID (BUILDER-ID). */
export function selectBuilder(id: string): SingleSelection {
  return selectOne({ kind: 'builder', id });
}

/** Create a harvester selection by ID. */
export function selectHarvester(id: string): SingleSelection {
  return selectOne({ kind: 'harvester', id });
}
