/**
 * Command Router — pure TypeScript routing logic for RTS controls.
 *
 * CORE-STEP-05H+: Replaces mixed input model with classic RTS command routing:
 * - LMB = select / inspect only
 * - RMB = command (move / harvest / attack)
 * - S = stop selected unit / clear command
 * - Esc = context priority chain
 *
 * All functions are pure — no Phaser, no DOM, no mutation of
 * game state beyond what the caller does based on the route result.
 *
 * This module is the single source of truth for what action should
 * result from a given input event, selected unit, and click target.
 */

import type { UnitSelection } from './unitSelection';

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
  /** Tile X of click position. */
  tx: number;
  /** Tile Y of click position. */
  ty: number;
}

/** Result of routing an LMB click. */
export type LmbRouteResult =
  | { action: 'select'; selection: UnitSelection }
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
  | { action: 'stop'; unitId: string; unitKind: 'harvester' | 'builder' | 'combat-vehicle' }
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
 * Rules:
 * - Own harvester → select
 * - Own builder → select
 * - Own combat vehicle → select (in Arena mode)
 * - Own building → inspect (select if supported)
 * - Enemy → no-op (inspect only, no control transfer)
 * - Resource → no-op
 * - Ground → deselect (if something selected) or no-op
 *
 * LMB must NEVER: move units, attack, harvest, pan camera, fire weapons.
 */
export function routeLmbClick(
  target: ClickTarget,
  currentSelection: UnitSelection,
): LmbRouteResult {
  switch (target.kind) {
    case 'own-harvester':
      return { action: 'select', selection: { kind: 'harvester', id: target.id! } };
    case 'own-builder':
      return { action: 'select', selection: { kind: 'builder', id: target.id! } };
    case 'own-combat-vehicle':
      // Combat vehicles are selected in Arena mode via BlockoutVehicleInputController.
      // This route is provided for future unified selection model.
      return { action: 'select', selection: { kind: 'harvester', id: target.id! } };
    case 'own-building':
      // Building inspection — select if architecture supports it
      return { action: 'select', selection: { kind: 'builder', id: target.id! } };
    case 'enemy-unit':
    case 'enemy-building':
      // Enemy: inspect/target info only, no control transfer
      return { action: 'no-op' };
    case 'resource':
      // LMB on resource does NOT harvest
      return { action: 'no-op' };
    case 'ground':
      // LMB on ground: deselect if something is selected, otherwise no-op
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
 * Rules:
 * - No selected unit → no-op
 * - Ground + selected unit → move command
 * - Resource + selected harvester → harvest command
 * - Resource + selected non-harvester → move command (approach resource)
 * - Enemy + selected combat unit → attack / target-lock
 * - Enemy + selected non-combat unit → move command (approach enemy)
 * - Own unit/building → no-op (don't command toward own stuff)
 * - RMB must NOT: pan camera, select units, inspect as primary action
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
      // RMB on ground with any selected unit → move
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'resource': {
      // RMB on resource with harvester → harvest
      if (currentSelection.kind === 'harvester') {
        return { action: 'harvest', tx: target.tx, ty: target.ty, resourceId: target.id };
      }
      // Non-harvester → move toward the resource position
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'enemy-unit': {
      // RMB on enemy with combat unit → attack / target-lock
      if (currentSelection.kind === 'harvester' && currentSelection.id.startsWith('blockout-')) {
        // Blockout vehicle selected → attack command
        return { action: 'attack', tx: target.tx, ty: target.ty, targetId: target.id! };
      }
      // Civil unit → move toward enemy position (no attack capability)
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'enemy-building': {
      // RMB on enemy building → move toward (no attack for civil units yet)
      return { action: 'move', tx: target.tx, ty: target.ty };
    }

    case 'own-harvester':
    case 'own-builder':
    case 'own-combat-vehicle':
    case 'own-building': {
      // RMB on own entity → no-op (don't command toward own stuff)
      return { action: 'no-op', reason: 'own-entity' };
    }
  }
}

/**
 * Route an RMB click in Arena mode for combat vehicles.
 *
 * Rules:
 * - No selected ally → no-op
 * - Ground + selected ally → move
 * - Enemy + selected ally → attack / target-lock
 * - Ally + selected ally → no-op
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
 * Route an S key press. S stops the selected unit and clears its command.
 *
 * Rules:
 * - No selected unit → no-op
 * - Harvester: stop current command (clear manual move, auto-gather target)
 * - Builder: stop current command
 * - Combat vehicle: stop movement AND clear target-lock
 */
export function routeSKey(
  currentSelection: UnitSelection,
): SKeyRouteResult {
  if (currentSelection === null) {
    return { action: 'no-op' };
  }

  if (currentSelection.kind === 'harvester') {
    // Check if it's a blockout vehicle (combat) — clear target-lock
    if (currentSelection.id.startsWith('blockout-')) {
      return { action: 'clear-target-lock', unitId: currentSelection.id };
    }
    return { action: 'stop', unitId: currentSelection.id, unitKind: 'harvester' };
  }

  if (currentSelection.kind === 'builder') {
    return { action: 'stop', unitId: currentSelection.id, unitKind: 'builder' };
  }

  return { action: 'no-op' };
}

// ─── Esc priority routing ───────────────────────────────────────────

/**
 * Route an Esc key press with context priority.
 *
 * Priority order:
 * 1. Cancel active placement/build/command mode
 * 2. Deselect selected unit/object
 * 3. Close open overlay/menu
 * 4. Toggle pause menu (only when nothing else consumes Esc)
 *
 * @param isPlacementActive - Whether placement mode is active
 * @param hasSelection - Whether a unit/object is currently selected
 * @param isOverlayOpen - Whether an overlay/menu is open (e.g., devtools)
 * @returns The highest-priority Esc action
 */
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
 *
 * Used by the input layer to update the CSS cursor or visual indicator.
 */
export function determineCursorFeedback(
  hoverTarget: ClickTarget | null,
  currentSelection: UnitSelection,
  isArenaMode: boolean,
): CursorFeedbackState {
  if (currentSelection === null) {
    // No selection — default cursor; own entities get select cursor
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

  // Selected unit + hover target → context cursor
  switch (hoverTarget.kind) {
    case 'ground':
      return 'move';
    case 'resource':
      if (currentSelection.kind === 'harvester' && !currentSelection.id.startsWith('blockout-')) {
        return 'harvest';
      }
      return 'move';
    case 'enemy-unit':
      if (isArenaMode || currentSelection.id.startsWith('blockout-')) {
        return 'attack';
      }
      return 'move';
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
 * Returns null if no confirmation should be shown.
 */
export function getConfirmationType(routeResult: RmbRouteResult): CommandConfirmationType | null {
  switch (routeResult.action) {
    case 'move': return 'move';
    case 'harvest': return 'harvest';
    case 'attack': return 'attack';
    default: return null;
  }
}
