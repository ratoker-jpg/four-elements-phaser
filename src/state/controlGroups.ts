/**
 * Control Groups — StarCraft-style unit group assignment/recall.
 *
 * SELECTION-CONTROL-GROUPS-05: Number keys 1-9 assign/recall control groups.
 *   - Ctrl+Number → assign current selection to that group
 *   - Number → recall the group (select those units)
 *   - Double-tap Number → recall + center camera on group
 *
 * Double-tap detection: if the same number key is pressed within 400ms,
 * the camera centers on the group's average position.
 *
 * Architecture:
 *   - Pure TypeScript, no Phaser imports.
 *   - Groups store SelectableUnit references, not entity state.
 *   - Recall prunes missing entities before returning selection.
 *   - Control groups are UI-layer state, NOT in GameState.
 */

import type { GameState } from './types';
import {
  type UnitSelection,
  type SelectableUnit,
  selectMany,
  pruneMissingEntities,
  getSelectionCenterTile,
} from './unitSelection';

// ─── Types ──────────────────────────────────────────────────────────

/** A control group stores a snapshot of selected units. */
export interface ControlGroup {
  units: SelectableUnit[];
}

/** Double-tap window in milliseconds. */
const DOUBLE_TAP_MS = 400;

/** Valid control group number (1-9). */
export type ControlGroupNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ─── ControlGroupManager ────────────────────────────────────────────

export class ControlGroupManager {
  private groups: Map<number, ControlGroup> = new Map();
  private lastRecallTime: Map<number, number> = new Map();

  /** Assign current selection to a control group number. */
  assignGroup(numberKey: number, selection: UnitSelection): void {
    if (numberKey < 1 || numberKey > 9) return;
    if (!selection || selection.units.length === 0) {
      this.groups.delete(numberKey);
      return;
    }
    // Store a snapshot of the selected units
    this.groups.set(numberKey, { units: [...selection.units] });
  }

  /** Recall a control group, pruning any missing entities. */
  recallGroup(numberKey: number, state: GameState): UnitSelection {
    const group = this.groups.get(numberKey);
    if (!group || group.units.length === 0) return null;

    // Build a selection from the group and prune missing entities
    const selection = selectMany(group.units);
    return pruneMissingEntities(selection, state);
  }

  /**
   * Whether the camera should center on the group.
   * Returns true if this recall is a double-tap (within 400ms of the previous recall for the same key).
   */
  shouldCenterOnGroup(numberKey: number): boolean {
    const now = Date.now();
    const lastTime = this.lastRecallTime.get(numberKey) ?? 0;
    this.lastRecallTime.set(numberKey, now);
    return (now - lastTime) < DOUBLE_TAP_MS;
  }

  /** Clear a control group. */
  clearGroup(numberKey: number): void {
    this.groups.delete(numberKey);
    this.lastRecallTime.delete(numberKey);
  }

  /** Get a control group (without recalling). */
  getGroup(numberKey: number): ControlGroup | undefined {
    return this.groups.get(numberKey);
  }

  /** Get the center position of a control group in tile space. */
  getGroupCenter(numberKey: number, state: GameState): { tx: number; ty: number } | null {
    const group = this.groups.get(numberKey);
    if (!group || group.units.length === 0) return null;

    const selection = selectMany(group.units);
    const pruned = pruneMissingEntities(selection, state);
    return getSelectionCenterTile(pruned, state);
  }
}
