/**
 * Command Router — pure TypeScript routing logic for RTS controls.
 *
 * CORE-STEP-05H+: Replaces mixed input model with classic RTS command routing:
 * - LMB = select / inspect only
 * - RMB = command (move / harvest / attack)
 * - S = stop selected unit / clear command
 * - Esc = context priority chain
 *
 * SELECTION-CONTROL-GROUPS-05: Updated for multi-select:
 * - routeLmbClick returns multi-aware UnitSelection
 * - routeRmbClick works with multi-selection (move/harvest all selected)
 * - routeSKey stops all selected units
 *
 * All functions are pure — no Phaser, no DOM, no mutation of
 * game state beyond what the caller does based on the route result.
 *
 * This module is the single source of truth for what action should
 * result from a given input event, selected unit, and click target.
 */

import type { UnitSelection, SelectableUnit } from './unitSelection';
import { selectOne, toggleInSelection } from './unitSelection';

// ─── Types ──────────────────────────────────────────────────────────

/** What kind of entity is under the cursor. */
export type ClickTargetKind =
  | 'own-harvester'
  | 'own-builder'
  | 'own-combat-vehicle'
  | 'own-building'
  | 'enemy-unit'
  | 'enemy-building'
  | 'resource'
  | 'ground';

/** Information about what's under the cursor. */
export interface ClickTarget {
  kind: ClickTargetKind;
  /** Entity ID if applicable (unit, building). */
  id?: string;
  /** Entity kind (for same-type double-click). */
  unitKind?: 'builder' | 'harvester';
  /** Tile X of click position. */
  tx: number;
  /** Tile Y of click position. */
  ty: number;
}

/** Result of routing an LMB click. */
export type LmbRouteResult =
  | { action: 'select'; selection: UnitSelection }
  | { action: 'add-to-selection'; selection: UnitSelection }
  | { action: 'toggle-in-selection'; selection: UnitSelection }
  | { action: 'deselect' }
  | { action: 'no-op' };

/** Result of routing an RMB click. */
export type RmbRouteResult =
  | { action: 'move'; tx: number; ty: number }
  | { action: 'harvest'; tx: number; ty: number; resourceId?: string }
  | { action: 'attack'; tx: number; ty: number; targetId: string }
  | { action: 'context-build'; tx: number; ty: number }
  | { action: 'no-op'; reason: string };

/** Result of routing an S key press. */
export type SKeyRouteResult =
  | { action: 'stop'; unitIds: string[] }
  | { action: 'clear-target-lock'; unitId: string }
  | { action: 'no-op' };

/** Esc context priority result. */
export type EscRouteResult =
  | { action: 'cancel-active-mode'; priority: 1 }
  | { action: 'deselect'; priority: 2 }
  | { action: 'close-overlay'; priority: 3 }
  | { action: 'toggle-pause'; priority: 4 };

/** Cursor feedback state for player-facing visual feedback. */
export type CursorFeedbackState =
  | 'default'
  | 'select'
  | 'move'
  | 'harvest'
  | 'attack'
  | 'blocked';

// ─── LMB routing ────────────────────────────────────────────────────

/**
 * Route an LMB click. LMB is for selection/inspection only.
 *
 * SELECTION-CONTROL-GROUPS-05: Supports multi-select:
 * - Shift+click on own unit → add to selection
 * - Click on own unit → select that unit (replacing previous selection)
 * - Click on ground → deselect
 *
 * LMB must NEVER: move units, attack, harvest, pan camera, fire weapons.
 */
export function routeLmbClick(
  target: ClickTarget,
  currentSelection: UnitSelection,
  shiftHeld: boolean = false,
): LmbRouteResult {
  switch (target.kind) {
    case 'own-harvester': {
      const unit: SelectableUnit = { kind: 'harvester', id: target.id! };
      if (shiftHeld) {
        return { action: 'toggle-in-selection', selection: toggleInSelection(currentSelection, unit) };
      }
      return { action: 'select', selection: selectOne(unit) };
    }
    case 'own-builder': {
      const unit: SelectableUnit = { kind: 'builder', id: target.id! };
      if (shiftHeld) {
        return { action: 'toggle-in-selection', selection: toggleInSelection(currentSelection, unit) };
      }
      return { action: 'select', selection: selectOne(unit) };
    }
    case 'own-combat-vehicle': {
      const unit: SelectableUnit = { kind: 'combat', id: target.id! };
      if (shiftHeld) {
        return { action: 'toggle-in-selection', selection: toggleInSelection(currentSelection, unit) };
      }
      return { action: 'select', selection: selectOne(unit) };
    }
    case 'own-building':
      return { action: 'select', selection: selectOne({ kind: 'builder', id: target.id! }) };
    case 'enemy-unit':
    case 'enemy-building':
      return { action: 'no-op' };
    case 'resource':
      return { action: 'no-op' };
    case 'ground':
      if (currentSelection !== null) {
        return { action: 'deselect' };
      }
      return { action: 'no-op' };
  }
}

// ─── RMB routing ────────────────────────────────────────────────────

/**
 * Route an RMB click. RMB is for commands only.
 *
 * SELECTION-CONTROL-GROUPS-05: Works with multi-selection.
 * - Move commands apply to all selected units
 * - Harvest applies if any selected unit is a harvester
 */
export function routeRmbClick(
  target: ClickTarget,
  currentSelection: UnitSelection,
): RmbRouteResult {
  // No selected unit → RMB is no-op
  if (currentSelection === null) {
    return { action: 'no-op', reason: 'no-selected-unit' };
  }

  switch (target.kind) {
    case 'ground': {
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'resource': {
      // If any harvester is selected, harvest; otherwise move toward
      const hasHarvester = currentSelection.units.some(u => u.kind === 'harvester');
      if (hasHarvester) {
        return { action: 'harvest', tx: target.tx, ty: target.ty, resourceId: target.id };
      }
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'enemy-unit': {
      // RMB on enemy with combat unit → attack / target-lock
      const hasBlockout = currentSelection.units.some(u => u.kind === 'harvester' && u.id.startsWith('blockout-'));
      if (hasBlockout) {
        return { action: 'attack', tx: target.tx, ty: target.ty, targetId: target.id! };
      }
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'enemy-building': {
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'own-harvester':
    case 'own-builder':
    case 'own-combat-vehicle':
    case 'own-building': {
      return { action: 'no-op', reason: 'own-entity' };
    }
  }
}

/**
 * Route an RMB click in Arena mode for combat vehicles.
 */
export function routeRmbClickArena(
  target: ClickTarget,
  hasSelectedAlly: boolean,
): RmbRouteResult {
  if (!hasSelectedAlly) {
    return { action: 'no-op', reason: 'no-selected-ally' };
  }

  switch (target.kind) {
    case 'ground':
      return { action: 'move', tx: target.tx, ty: target.ty };
    case 'enemy-unit':
      return { action: 'attack', tx: target.tx, ty: target.ty, targetId: target.id! };
    case 'enemy-building':
      return { action: 'move', tx: target.tx, ty: target.ty };
    case 'own-harvester':
    case 'own-builder':
    case 'own-combat-vehicle':
    case 'own-building':
    case 'resource':
      return { action: 'no-op', reason: 'ally-or-resource' };
  }
}

// ─── S key routing ──────────────────────────────────────────────────

/**
 * Route an S key press. S stops all selected units and clears their commands.
 *
 * SELECTION-CONTROL-GROUPS-05: Returns all unit IDs to stop.
 */
export function routeSKey(
  currentSelection: UnitSelection,
): SKeyRouteResult {
  if (currentSelection === null) {
    return { action: 'no-op' };
  }

  const unitIds: string[] = [];

  for (const u of currentSelection.units) {
    if (u.kind === 'harvester' && u.id.startsWith('blockout-')) {
      // Blockout vehicle — clear target-lock
      return { action: 'clear-target-lock', unitId: u.id };
    }
    unitIds.push(u.id);
  }

  if (unitIds.length > 0) {
    return { action: 'stop', unitIds };
  }

  return { action: 'no-op' };
}

// ─── Esc priority routing ───────────────────────────────────────────

export function routeEscKey(
  isPlacementActive: boolean,
  hasSelection: boolean,
  isOverlayOpen: boolean,
): EscRouteResult {
  if (isPlacementActive) {
    return { action: 'cancel-active-mode', priority: 1 };
  }
  if (hasSelection) {
    return { action: 'deselect', priority: 2 };
  }
  if (isOverlayOpen) {
    return { action: 'close-overlay', priority: 3 };
  }
  return { action: 'toggle-pause', priority: 4 };
}

// ─── Cursor feedback ────────────────────────────────────────────────

/**
 * Determine the cursor feedback state based on current selection and hover target.
 */
export function determineCursorFeedback(
  hoverTarget: ClickTarget | null,
  currentSelection: UnitSelection,
  isArenaMode: boolean,
): CursorFeedbackState {
  if (currentSelection === null) {
    if (hoverTarget && (
      hoverTarget.kind === 'own-harvester' ||
      hoverTarget.kind === 'own-builder' ||
      hoverTarget.kind === 'own-combat-vehicle' ||
      hoverTarget.kind === 'own-building'
    )) {
      return 'select';
    }
    return 'default';
  }

  if (!hoverTarget) {
    return 'default';
  }

  switch (hoverTarget.kind) {
    case 'ground':
      return 'move';
    case 'resource': {
      const hasHarvester = currentSelection.units.some(u => u.kind === 'harvester' && !u.id.startsWith('blockout-'));
      if (hasHarvester) {
        return 'harvest';
      }
      return 'move';
    }
    case 'enemy-unit': {
      const hasBlockout = currentSelection.units.some(u => u.id.startsWith('blockout-'));
      if (isArenaMode || hasBlockout) {
        return 'attack';
      }
      return 'move';
    }
    case 'enemy-building':
      return 'move';
    case 'own-harvester':
    case 'own-builder':
    case 'own-combat-vehicle':
    case 'own-building':
      return 'select';
  }
}

// ─── Command confirmation types ─────────────────────────────────────

/** Types of command confirmations that can appear at the target location. */
export type CommandConfirmationType = 'move' | 'harvest' | 'attack';

/**
 * Determine the command confirmation type from an RMB route result.
 */
export function getConfirmationType(routeResult: RmbRouteResult): CommandConfirmationType | null {
  switch (routeResult.action) {
    case 'move': return 'move';
    case 'harvest': return 'harvest';
    case 'attack': return 'attack';
    default: return null;
  }
}
