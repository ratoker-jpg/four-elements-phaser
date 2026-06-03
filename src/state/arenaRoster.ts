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
import { t } from '../config/localization';
import { BODY_PROFILES } from '../config/blockoutBodyData';
import { WEAPON_PROFILES } from '../config/blockoutWeaponData';

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
    message: removedCount > 0 ? `${t('arena_allCleared')} (${removedCount})` : t('arena_arenaEmptyStatus'),
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
    message: removedCount > 0 ? `${t('arena_alliesCleared')} (${removedCount})` : t('arena_noAllies'),
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
    message: removedCount > 0 ? `${t('arena_enemiesCleared')} (${removedCount})` : t('arena_noEnemies'),
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
      message: t('arena_unitNotFound'),
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

  const teamLabel = vehicle.team === 'ally' ? t('arena_allyLabel') : t('arena_enemyLabel');
  const bodyLabel = BODY_PROFILES[vehicle.bodyId]?.displayName ?? vehicle.bodyId;

  return {
    removedCount: 1,
    selectedCleared,
    targetCleared,
    message: `${teamLabel} ${bodyLabel} ${t('arena_deleted')}`,
  };
}

// ─── Help text ────────────────────────────────────────────────────

/** Arena help text lines — explains all Arena controls. CORE-STEP-01B: Russian. */
export const ARENA_HELP_LINES: string[] = [
  '─── Управление ареной ───',
  'Выберите корпус, пушку, команду → Разместить → клик на поле',
  'Esc/ПКМ отменяет размещение',
  '',
  '─── Выбор ───',
  'ЛКМ по союзнику: выбрать управляемого юнита',
  'ЛКМ по врагу: назначить цель (если выбран союзник)',
  'ПКМ: двигать выбранного союзника',
  'Esc: снять выбор / убрать цель',
  '',
  '─── Бой ───',
  'Пробел/F: стрелять по выбранной цели',
  'T: переключить выбранного союзника',
  'H: показать/скрыть эту справку',
  'C: оверлей калибровки камеры',
  '',
  '─── Правила ───',
  'Союзники управляются игроком',
  'Враги — только цели (не управляются)',
  'Башня наводится на цель, а не на курсор',
  '',
  '─── Панель ───',
  'Клик по строке ростера: выбрать союзника / назначить врага целью',
  'Удалить: убрать выбранного юнита',
  'Очистить: убрать всех/союзников/врагов',
  'Сбросить арену: восстановить чистый полигон',
];

// ─── Status messages ──────────────────────────────────────────────

/** Derive a status message from current Arena state. CORE-STEP-01B: Russian. */
export function deriveArenaStatus(
  vehicles: BlockoutVehicleState[] | undefined,
  selectedVehicleId: string | null,
  targetVehicleId: string | null,
  placementMode: 'idle' | 'placing',
): string {
  if (placementMode === 'placing') {
    return t('arena_placing');
  }

  if (!vehicles || vehicles.length === 0) {
    return t('arena_empty');
  }

  const selected = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null;

  if (!selected) {
    return `${vehicles.length} ${t('arena_clickToSelect')}`;
  }

  const bodyLabel = BODY_PROFILES[selected.bodyId]?.displayName ?? selected.bodyId;
  const weaponLabel = WEAPON_PROFILES[selected.weaponId]?.displayName ?? selected.weaponId;
  const teamLabel = selected.team === 'ally' ? t('arena_allyLabel') : t('arena_enemyLabel');

  if (selected.isDestroyed) {
    return `${t('arena_selected')}: ${teamLabel} ${bodyLabel}+${weaponLabel} [${t('arena_destroyed')}]`;
  }

  if (!targetVehicleId) {
    return `${t('arena_selected')}: ${teamLabel} ${bodyLabel}+${weaponLabel} ${t('arena_hp')}:${Math.round(selected.hp)} — ${t('arena_noTarget')}`;
  }

  const target = vehicles.find(v => v.id === targetVehicleId);
  if (!target) {
    return `${t('arena_selected')}: ${teamLabel} ${bodyLabel}+${weaponLabel} ${t('arena_hp')}:${Math.round(selected.hp)} — ${t('arena_targetLost')}`;
  }

  const targetBody = BODY_PROFILES[target.bodyId]?.displayName ?? target.bodyId;
  const targetHp = target.isDestroyed ? t('arena_destroyed') : `${t('arena_hp')}:${Math.round(target.hp)}`;

  return `${t('arena_selected')}: ${teamLabel} ${bodyLabel}+${weaponLabel} ${t('arena_hp')}:${Math.round(selected.hp)} → ${t('arena_target')}: ${targetBody} ${targetHp}`;
}
