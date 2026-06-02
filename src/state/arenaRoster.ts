/**
 * Arena roster — pure TypeScript helpers for Arena unit roster, clear/delete/reset.
 *
 * ARENA-04H+: Provides state-derived roster rows and safe clear/delete/reset
 * operations that also clean up selected/target references and stop firing.
 *
 * Pure TS, no Phaser, no DOM.
 */

import type { BlockoutVehicleState, ArenaTeam } from './blockoutVehicleState';
import { stopFiring } from './blockoutWeaponVfx';

// ─── Roster row type ──────────────────────────────────────────────

/** A single roster row derived from a BlockoutVehicleState. */
export interface ArenaRosterRow {
  /** Vehicle instance ID. */
  id: string;
  /** Body ID (e.g., 'wasp', 'mammoth'). */
  bodyId: string;
  /** Weapon ID (e.g., 'smoky', 'railgun'). */
  weaponId: string;
  /** Arena team. */
  team: ArenaTeam;
  /** Current HP. */
  hp: number;
  /** Maximum HP. */
  maxHp: number;
  /** Whether vehicle is destroyed. */
  isDestroyed: boolean;
  /** Whether this vehicle is currently selected. */
  isSelected: boolean;
  /** Whether this vehicle is currently targeted by the selected ally. */
  isTargeted: boolean;
}

// ─── Roster derivation ────────────────────────────────────────────

/**
 * Derive roster rows from blockout vehicles.
 * Pure function — reads state, returns rows.
 *
 * @param vehicles - Current blockout vehicles array
 * @param selectedVehicleId - Currently selected vehicle ID (or null)
 * @param targetVehicleId - Current target vehicle ID of the selected ally (or null)
 * @returns Array of roster rows
 */
export function deriveRosterRows(
  vehicles: BlockoutVehicleState[] | undefined,
  selectedVehicleId: string | null,
  targetVehicleId: string | null,
): ArenaRosterRow[] {
  if (!vehicles) return [];
  return vehicles.map(v => ({
    id: v.id,
    bodyId: v.bodyId,
    weaponId: v.weaponId,
    team: v.team,
    hp: v.hp,
    maxHp: v.maxHp,
    isDestroyed: v.isDestroyed,
    isSelected: v.id === selectedVehicleId,
    isTargeted: v.id === targetVehicleId,
  }));
}

// ─── Roster click decision ───────────────────────────────────────

/** Result of a roster row click decision. */
export type RosterClickAction =
  | { type: 'select'; vehicleId: string }
  | { type: 'assignTarget'; targetVehicleId: string }
  | { type: 'noop' };

/**
 * Decide what action to take when a roster row is clicked.
 * Pure function — reads state, returns action.
 *
 * - Ally row click → select that ally.
 * - Enemy row click + ally selected → assign enemy as target.
 * - Enemy row click + no ally selected → no-op.
 * - Enemy row never triggers controllable selection.
 *
 * @param row - The clicked roster row
 * @param selectedVehicleId - Currently selected vehicle ID (or null)
 * @param vehicles - Current blockout vehicles (to verify selected is ally)
 * @returns The action to take
 */
export function decideRosterClick(
  row: ArenaRosterRow,
  selectedVehicleId: string | null,
  vehicles: BlockoutVehicleState[] | undefined,
): RosterClickAction {
  if (row.team === 'ally') {
    return { type: 'select', vehicleId: row.id };
  }

  if (row.team === 'enemy') {
    if (!selectedVehicleId) {
      return { type: 'noop' };
    }
    const selected = vehicles?.find(v => v.id === selectedVehicleId);
    if (selected && selected.team === 'ally') {
      return { type: 'assignTarget', targetVehicleId: row.id };
    }
    return { type: 'noop' };
  }

  return { type: 'noop' };
}

// ─── Clear operations ────────────────────────────────────────────

/** Result of a clear/delete operation. */
export interface ArenaClearResult {
  /** Number of vehicles removed. */
  removedCount: number;
  /** Whether the selected vehicle was cleared. */
  selectedCleared: boolean;
  /** Whether a target reference was cleared. */
  targetCleared: boolean;
  /** Human-readable status message. */
  message: string;
}

/**
 * Clear all blockout vehicles from state.
 * Stops firing on any firing vehicles, clears selected/target references.
 *
 * @param vehicles - Mutable blockout vehicles array (mutated: cleared)
 * @param selectedVehicleId - Currently selected vehicle ID
 * @returns Clear result with status
 */
export function clearAllVehicles(
  vehicles: BlockoutVehicleState[],
  selectedVehicleId: string | null,
): ArenaClearResult {
  const removedCount = vehicles.length;

  // Stop firing on any firing vehicles
  for (const v of vehicles) {
    if (v.fireHeld || v.isFiring) {
      stopFiring(v);
    }
  }

  const selectedCleared = selectedVehicleId !== null;
  // Target is cleared if any vehicle was targeted
  const targetCleared = vehicles.some(v => v.targetVehicleId !== null);

  vehicles.length = 0;

  return {
    removedCount,
    selectedCleared,
    targetCleared,
    message: removedCount > 0 ? `All units cleared (${removedCount})` : 'Arena empty',
  };
}

/**
 * Clear only ally vehicles from state.
 * Stops firing on removed allies, clears selected/target if ally was affected.
 *
 * @param vehicles - Mutable blockout vehicles array (mutated: allies removed)
 * @param selectedVehicleId - Currently selected vehicle ID
 * @returns Clear result with status
 */
export function clearAllyVehicles(
  vehicles: BlockoutVehicleState[],
  selectedVehicleId: string | null,
): ArenaClearResult {
  const allies = vehicles.filter(v => v.team === 'ally');
  const removedCount = allies.length;

  // Stop firing on allies being removed
  for (const ally of allies) {
    if (ally.fireHeld || ally.isFiring) {
      stopFiring(ally);
    }
  }

  // Check if selected vehicle is an ally
  const selectedVehicle = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null;
  const selectedCleared = selectedVehicle?.team === 'ally';

  // Check if any ally had a target reference
  const targetCleared = allies.some(v => v.targetVehicleId !== null);

  // Remove allies from array
  const remaining = vehicles.filter(v => v.team !== 'ally');
  vehicles.length = 0;
  vehicles.push(...remaining);

  // Clear target references on remaining enemies that might have been targeting allies
  // (enemies don't have player-assigned targets in current model, but be safe)
  for (const v of vehicles) {
    if (v.targetVehicleId) {
      const targetStillExists = vehicles.some(remaining => remaining.id === v.targetVehicleId);
      if (!targetStillExists) {
        v.targetVehicleId = null;
      }
    }
  }

  return {
    removedCount,
    selectedCleared,
    targetCleared,
    message: removedCount > 0 ? `Allies cleared (${removedCount})` : 'No allies to clear',
  };
}

/**
 * Clear only enemy vehicles from state.
 * Clears target references on allies that were targeting removed enemies.
 *
 * @param vehicles - Mutable blockout vehicles array (mutated: enemies removed)
 * @param selectedVehicleId - Currently selected vehicle ID
 * @returns Clear result with status
 */
export function clearEnemyVehicles(
  vehicles: BlockoutVehicleState[],
  selectedVehicleId: string | null,
): ArenaClearResult {
  const enemies = vehicles.filter(v => v.team === 'enemy');
  const removedCount = enemies.length;

  // Stop firing on enemies being removed (if they were firing for any reason)
  for (const enemy of enemies) {
    if (enemy.fireHeld || enemy.isFiring) {
      stopFiring(enemy);
    }
  }

  const enemyIds = new Set(enemies.map(e => e.id));

  // Check if selected vehicle is an enemy (shouldn't happen in Arena, but be safe)
  const selectedVehicle = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null;
  const selectedCleared = selectedVehicle?.team === 'enemy';

  // Check if any ally was targeting an enemy being removed
  let targetCleared = false;
  for (const v of vehicles) {
    if (v.targetVehicleId && enemyIds.has(v.targetVehicleId)) {
      v.targetVehicleId = null;
      targetCleared = true;
      // Stop firing on ally that lost its target
      if (v.fireHeld || v.isFiring) {
        stopFiring(v);
      }
    }
  }

  // Remove enemies from array
  const remaining = vehicles.filter(v => v.team !== 'enemy');
  vehicles.length = 0;
  vehicles.push(...remaining);

  return {
    removedCount,
    selectedCleared,
    targetCleared,
    message: removedCount > 0 ? `Enemies cleared (${removedCount})` : 'No enemies to clear',
  };
}

/**
 * Delete a single vehicle by ID.
 * Clears selected/target references if the deleted vehicle was involved.
 * Stops firing on the deleted vehicle and on allies that lost their target.
 *
 * @param vehicles - Mutable blockout vehicles array (mutated: vehicle removed)
 * @param vehicleId - ID of the vehicle to delete
 * @param selectedVehicleId - Currently selected vehicle ID
 * @returns Clear result with status
 */
export function deleteVehicle(
  vehicles: BlockoutVehicleState[],
  vehicleId: string,
  selectedVehicleId: string | null,
): ArenaClearResult {
  const vehicle = vehicles.find(v => v.id === vehicleId);
  if (!vehicle) {
    return {
      removedCount: 0,
      selectedCleared: false,
      targetCleared: false,
      message: 'Unit not found',
    };
  }

  // Stop firing on the vehicle being deleted
  if (vehicle.fireHeld || vehicle.isFiring) {
    stopFiring(vehicle);
  }

  const selectedCleared = vehicleId === selectedVehicleId;

  // Clear target references on other vehicles targeting this one
  let targetCleared = false;
  for (const v of vehicles) {
    if (v.targetVehicleId === vehicleId) {
      v.targetVehicleId = null;
      targetCleared = true;
      // Stop firing on ally that lost its target
      if (v.fireHeld || v.isFiring) {
        stopFiring(v);
      }
    }
  }

  // Remove the vehicle
  const index = vehicles.indexOf(vehicle);
  if (index !== -1) {
    vehicles.splice(index, 1);
  }

  const teamLabel = vehicle.team === 'ally' ? 'Ally' : 'Enemy';
  const bodyLabel = vehicle.bodyId.charAt(0).toUpperCase() + vehicle.bodyId.slice(1);

  return {
    removedCount: 1,
    selectedCleared,
    targetCleared,
    message: `${teamLabel} ${bodyLabel} deleted`,
  };
}

// ─── Help text ────────────────────────────────────────────────────

/** Arena help text lines — explains all Arena controls. */
export const ARENA_HELP_LINES: string[] = [
  '─── Arena Controls ───',
  'Choose body, weapon, team → Place Unit → click ground',
  'Esc/RMB cancels placement',
  '',
  '─── Selection ───',
  'LMB click Ally: select controllable ally',
  'LMB click Enemy: assign target (if ally selected)',
  'RMB: move selected Ally',
  'Esc: deselect / clear target',
  '',
  '─── Combat ───',
  'Space/F: fire at selected target',
  'T: cycle selected ally',
  'H: toggle this help',
  'C: camera calibration overlay',
  '',
  '─── Rules ───',
  'Allies are controllable',
  'Enemies are targets only (not controllable)',
  'Turret aims at target, not mouse',
  '',
  '─── Panel ───',
  'Click roster row: select Ally / target Enemy',
  'Delete: remove selected unit',
  'Clear: remove all/ally/enemy units',
  'Reset Arena: restore clean sandbox',
];

// ─── Status messages ──────────────────────────────────────────────

/** Derive a status message from current Arena state. */
export function deriveArenaStatus(
  vehicles: BlockoutVehicleState[] | undefined,
  selectedVehicleId: string | null,
  targetVehicleId: string | null,
  placementMode: 'idle' | 'placing',
): string {
  if (placementMode === 'placing') {
    return 'Placement mode active — click ground to place | Esc/RMB cancel';
  }

  if (!vehicles || vehicles.length === 0) {
    return 'Arena empty — place a unit to start';
  }

  const selected = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null;

  if (!selected) {
    return `${vehicles.length} unit(s) — click Ally to select`;
  }

  const bodyLabel = selected.bodyId.charAt(0).toUpperCase() + selected.bodyId.slice(1);
  const weaponLabel = selected.weaponId.charAt(0).toUpperCase() + selected.weaponId.slice(1);
  const teamLabel = selected.team === 'ally' ? 'Ally' : 'Enemy';

  if (selected.isDestroyed) {
    return `Selected: ${teamLabel} ${bodyLabel}+${weaponLabel} [DESTROYED]`;
  }

  if (!targetVehicleId) {
    return `Selected: ${teamLabel} ${bodyLabel}+${weaponLabel} HP:${Math.round(selected.hp)} — no target`;
  }

  const target = vehicles.find(v => v.id === targetVehicleId);
  if (!target) {
    return `Selected: ${teamLabel} ${bodyLabel}+${weaponLabel} HP:${Math.round(selected.hp)} — target lost`;
  }

  const targetBody = target.bodyId.charAt(0).toUpperCase() + target.bodyId.slice(1);
  const targetHp = target.isDestroyed ? 'DESTROYED' : `HP:${Math.round(target.hp)}`;

  return `Selected: ${teamLabel} ${bodyLabel}+${weaponLabel} HP:${Math.round(selected.hp)} → Target: ${targetBody} ${targetHp}`;
}
