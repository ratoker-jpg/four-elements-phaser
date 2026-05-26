/**
 * Unit selection model — pure TypeScript, no Phaser.
 *
 * ARCH-05X: Civil unit selection MVP for the high-risk movement/control probe.
 *
 * Tracks which civil unit (builder or harvester) is currently selected.
 * Only one unit can be selected at a time. Selection is stored as a
 * typed discriminated union so the render/input layers can react
 * without guessing.
 *
 * Selection state is NOT stored in GameState — it is UI-layer state
 * that lives in GameScene. This keeps the pure state model clean.
 */

// ─── Types ─────────────────────────────────────────────────────────

/** Identifies a selectable civil unit. */
export type SelectableUnit =
  | { kind: 'builder'; index: number }
  | { kind: 'harvester'; id: string };

/** Current selection state — null means nothing selected. */
export type UnitSelection = SelectableUnit | null;

// ─── Helpers ───────────────────────────────────────────────────────

/** Create a builder selection by index. */
export function selectBuilder(index: number): SelectableUnit {
  return { kind: 'builder', index };
}

/** Create a harvester selection by ID. */
export function selectHarvester(id: string): SelectableUnit {
  return { kind: 'harvester', id };
}

/** Whether any unit is selected. */
export function isUnitSelected(sel: UnitSelection): sel is SelectableUnit {
  return sel !== null;
}

/** Whether a builder is selected. */
export function isBuilderSelected(sel: UnitSelection): sel is { kind: 'builder'; index: number } {
  return sel !== null && sel.kind === 'builder';
}

/** Whether a harvester is selected. */
export function isHarvesterSelected(sel: UnitSelection): sel is { kind: 'harvester'; id: string } {
  return sel !== null && sel.kind === 'harvester';
}

/** Clear selection. */
export function clearSelection(): null {
  return null;
}
