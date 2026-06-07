/**
 * BlockoutVehicleInputController — handles selection, turret aiming,
 * and movement targeting for blockout vehicles in arena/dev mode.
 *
 * BLOCKOUT-03H: Selection/control + turret aiming.
 * BLOCKOUT-03H fixup: Turret aim angle computed from actual turret mount
 * origin (not body/tile center), using shared blockoutVehicleGeometry.
 * BLOCKOUT-04H+: RMB click sets movement target for selected vehicle.
 * CORE-STEP-05H+: RMB click also commands attack/target-lock in Arena mode.
 * LMB click in Arena mode does NOT assign targets — only selects allies.
 *
 * This controller is dev-only. It does NOT interfere with normal
 * game input (builders/harvesters). It only processes input when
 * devtools/arena mode is active.
 *
 * Selection state (selectedVehicleId, hoveredVehicleId) is transient
 * and is NOT persisted in saves.
 *
 * The turret aim target is updated from the mouse position each frame.
 * Turret rotation is rate-limited by the weapon's blockoutTurretTurnSpeedDeg.
 *
 * Movement targets are set via RMB (right-click). RMB drag is camera pan
 * and does NOT set a movement target.
 *
 * BLOCKOUT-05H+ fixup: All weapon timing uses Phaser scene time
 * (this.scene.time.now), NOT Date.now(). Mixing epoch time with
 * scene time caused negative elapsed times, broken recoil recovery,
 * and VFX that never expired.
 *
 * BLOCKOUT-06H+ fixup: Continuous-fire lifecycle corrected.
 * - startFiring() is only called for continuous weapons (not single-shot).
 * - Deselecting or selecting a different vehicle stops firing on the
 *   previously selected vehicle.
 * - Key-up (Space/F) stops firing on ALL vehicles with fireHeld/isFiring,
 *   not just the currently selected one.
 * - destroy() stops firing on all vehicles to prevent orphaned firing state.
 * - Single-shot weapons never enter fireHeld/isFiring state.
 */

import Phaser from 'phaser';
import type { IsoPoint } from '../render/isometric';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { computeBodyWorldCenter, getBodyPixelSize, computeProjectedTurretMountScreen, computeProjectedBarrelTipScreenAtZ } from '../render/blockoutVehicleGeometry';
import { setBlockoutVehicleMoveTarget, clearBlockoutVehicleMoveTarget } from '../../state/blockoutMovement';
import { rotateTowardAngle, angleFromTo, degPerSecToRadPerMs } from '../../state/angleMath';
import { canFireBlockoutWeapon, fireBlockoutWeapon, startFiring, stopFiring, isContinuousWeapon } from '../../state/blockoutWeaponVfx';
import { applyBlockoutWeaponDamage } from '../../state/blockoutDamage';
import type { GameState } from '../../state/types';
import type { TileReservationMap } from '../../state/tileReservation';
import { applyUpgrade } from '../../state/blockoutUpgrades';
import type { BlockoutUpgradeId } from '../../config/blockoutUpgradeData';
import { getWeaponConfig, getWeaponMLevelValue } from '../../config/weaponData';
import { clearTargetLock } from '../../state/combatTargeting';
import {
  toggleCalibration as toggleWaspCalibration,
  cycleNextDir16 as waspCalibCycleNext,
  cyclePrevDir16 as waspCalibCyclePrev,
  clearOverride as waspCalibClearOverride,
  toggleOverlay as waspCalibToggleOverlay,
  isCalibrationActive as isWaspCalibActive,
  isOverrideActive as isWaspCalibOverrideActive,
  isMovementFrozen as isWaspCalibFrozen,
  activateOverrideFromCurrent as waspCalibActivateOverrideFromCurrent,
  installConsoleAPI as waspCalibInstallConsole,
  getDir16Label,
} from '../debug/WaspHullDirectionCalibrator';
import { resolveHullDirectionDiagnostic } from '../../assets/generatedHullAssets';
import {
  togglePlacement as toggleWaspPlacement,
  isPlacementActive as isWaspPlacementActiveCheck,
  adjustUp as waspPlaceAdjustUp,
  adjustDown as waspPlaceAdjustDown,
  adjustLeft as waspPlaceAdjustLeft,
  adjustRight as waspPlaceAdjustRight,
  resetPlacementOffset as waspPlaceResetOffset,
  togglePlacementOverlay as waspPlaceToggleOverlay,
  printPlacementValues as waspPlacePrintValues,
  installPlacementConsoleAPI as waspPlaceInstallConsole,
} from '../debug/WaspHullPlacementCalibrator';

// Turret size constants are now in blockoutVehicleGeometry (BLOCKOUT_TURRET_SIZE_W/H).
// No local duplicate needed — computeProjectedBarrelTipScreen uses the shared source.

// ─── Hit-test constants ────────────────────────────────────────────

// SHAPE_SIZE_MAP is imported from shared blockoutVehicleGeometry.
// Do not duplicate it here.

/** Extra hit radius padding in pixels around the body for click detection. */
const HIT_RADIUS_PADDING = 8;

/** Click detection threshold — pixels moved beyond this is a drag, not a click. */
const CLICK_DRAG_THRESHOLD = 4;

// ─── Dependencies interface ────────────────────────────────────────

export interface BlockoutVehicleInputDeps {
  scene: Phaser.Scene;
  offset: IsoPoint;
  getGameState: () => GameState;
  /** Whether devtools/arena mode is active (blockout input only processes when true). */
  isDevtoolsActive: () => boolean;
  /** Callback when selection changes (so renderer can update). */
  onSelectionChanged?: (selectedId: string | null) => void;
  /** BLOCKOUT-10H+: Callback to reset scenario (R key). Dev/arena-only. */
  onResetScenario?: () => void;
  /** BLOCKOUT-10H+: Callback to toggle help overlay (H key). Dev/arena-only. */
  onToggleHelp?: () => void;
  /** CAMERA-00: Callback to toggle camera projection calibration overlay (C key). Dev/arena-only. */
  onToggleCalibration?: () => void;
  /** ARENA-02H+ fixup: Whether arena placement mode is active. When true,
   *  LMB/RMB pointer events are suppressed to prevent selection changes
   *  and movement commands from conflicting with placement input. */
  isPlacementActive?: () => boolean;
  /** ARENA-03H+: Whether Arena mode is active. When true, ally/enemy control
   *  rules are enforced: only allies can be selected, clicking an enemy
   *  while an ally is selected assigns that enemy as target, and turret
   *  aims at assigned target instead of following mouse. */
  isArenaMode?: () => boolean;
  /** CORE-STEP-06H+: Provides the tile reservation map for grid movement commands. */
  getReservationMap?: () => TileReservationMap | null;
}

// ─── Controller ────────────────────────────────────────────────────

export class BlockoutVehicleInputController {
  private scene: Phaser.Scene;
  private offset: IsoPoint;
  private getGameState: () => GameState;
  private isDevtoolsActive: () => boolean;
  private onSelectionChanged?: (selectedId: string | null) => void;
  private onResetScenario?: () => void;
  private onToggleHelp?: () => void;
  private onToggleCalibration?: () => void;
  private isPlacementActive: () => boolean;
  private isArenaMode: () => boolean;
  private getReservationMap: () => TileReservationMap | null;

  /** Currently selected blockout vehicle ID (transient, not persisted). */
  private _selectedVehicleId: string | null = null;

  /** Currently hovered blockout vehicle ID (transient, not persisted). */
  private _hoveredVehicleId: string | null = null;

  /** Last known mouse world position for turret aiming. */
  private _mouseWorldX: number = 0;
  private _mouseWorldY: number = 0;

  /** LMB click detection state. */
  private _lmbClickStartX: number = 0;
  private _lmbClickStartY: number = 0;
  private _lmbButtonDown: boolean = false;

  /** RMB click detection state. BLOCKOUT-04H+: RMB sets movement target. */
  private _rmbClickStartX: number = 0;
  private _rmbClickStartY: number = 0;
  private _rmbButtonDown: boolean = false;

  /** Bound handler references for cleanup. */
  private boundPointerdown: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerup: (pointer: Phaser.Input.Pointer) => void;
  private boundPointermove: (pointer: Phaser.Input.Pointer) => void;
  private boundKeydown: (event: KeyboardEvent) => void;
  private boundKeyup: (event: KeyboardEvent) => void;

  constructor(deps: BlockoutVehicleInputDeps) {
    this.scene = deps.scene;
    this.offset = deps.offset;
    this.getGameState = deps.getGameState;
    this.isDevtoolsActive = deps.isDevtoolsActive;
    this.onSelectionChanged = deps.onSelectionChanged;
    this.onResetScenario = deps.onResetScenario;
    this.onToggleHelp = deps.onToggleHelp;
    this.onToggleCalibration = deps.onToggleCalibration;
    this.isPlacementActive = deps.isPlacementActive ?? (() => false);
    this.isArenaMode = deps.isArenaMode ?? (() => false);
    this.getReservationMap = deps.getReservationMap ?? (() => null);

    this.boundPointerdown = this.onPointerdown.bind(this);
    this.boundPointerup = this.onPointerup.bind(this);
    this.boundPointermove = this.onPointermove.bind(this);
    this.boundKeydown = this.onKeydown.bind(this);
    this.boundKeyup = this.onKeyup.bind(this);

    this.scene.input.on('pointerdown', this.boundPointerdown);
    this.scene.input.on('pointerup', this.boundPointerup);
    this.scene.input.on('pointermove', this.boundPointermove);
    this.scene.input.keyboard?.on('keydown', this.boundKeydown);
    this.scene.input.keyboard?.on('keyup', this.boundKeyup);
  }

  // ─── Public accessors ──────────────────────────────────────────

  /** Currently selected blockout vehicle ID. */
  get selectedVehicleId(): string | null {
    return this._selectedVehicleId;
  }

  /** Currently hovered blockout vehicle ID. */
  get hoveredVehicleId(): string | null {
    return this._hoveredVehicleId;
  }

  // ─── ARENA-04H+: Roster-driven selection ────────────────────────

  /**
   * Set the selected vehicle ID from external UI (e.g., roster click).
   * ARENA-04H+: Used by ArenaMenu roster to select a vehicle by ID.
   * Handles cleanup: stops firing on previously selected vehicle,
   * clears target references.
   *
   * @param vehicleId - Vehicle ID to select, or null to deselect
   */
  setSelectedVehicleId(vehicleId: string | null): void {
    // Clean up previous selection
    if (this._selectedVehicleId && this._selectedVehicleId !== vehicleId) {
      this.stopFiringOnVehicle(this._selectedVehicleId);
      const vehicles = this.getGameState().blockoutVehicles;
      if (vehicles) {
        const prev = vehicles.find(v => v.id === this._selectedVehicleId);
        if (prev) {
          prev.targetVehicleId = null;
        }
      }
    }
    this._selectedVehicleId = vehicleId;
    this.onSelectionChanged?.(vehicleId);
  }

  /** Mouse world X position. BLOCKOUT-06H+. */
  get mouseWorldX(): number { return this._mouseWorldX; }

  /** Mouse world Y position. BLOCKOUT-06H+. */
  get mouseWorldY(): number { return this._mouseWorldY; }

  // ─── CORE-STEP-05H+: Cursor feedback ─────────────────────────────

  /** Current cursor feedback state for Arena mode. */
  private _arenaCursorState: 'default' | 'select' | 'move' | 'attack' = 'default';

  /** Get current Arena cursor state (for testing). */
  get arenaCursorState(): string { return this._arenaCursorState; }

  /** Update cursor feedback based on hover target and selection. */
  private updateArenaCursorFeedback(): void {
    if (!this.isArenaMode()) return;

    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) {
      this._arenaCursorState = 'default';
      this.applyArenaCursorStyle('default');
      return;
    }

    const hoveredId = this._hoveredVehicleId;
    const hasSelection = this._selectedVehicleId !== null;

    if (!hasSelection) {
      if (hoveredId) {
        const hovered = vehicles.find(v => v.id === hoveredId);
        if (hovered && hovered.team === 'ally') {
          this._arenaCursorState = 'select';
          this.applyArenaCursorStyle('select');
          return;
        }
      }
      this._arenaCursorState = 'default';
      this.applyArenaCursorStyle('default');
      return;
    }

    // Has selection
    if (hoveredId) {
      const hovered = vehicles.find(v => v.id === hoveredId);
      if (hovered && hovered.team === 'enemy') {
        this._arenaCursorState = 'attack';
        this.applyArenaCursorStyle('attack');
        return;
      }
      if (hovered && hovered.team === 'ally') {
        this._arenaCursorState = 'select';
        this.applyArenaCursorStyle('select');
        return;
      }
    }

    this._arenaCursorState = 'move';
    this.applyArenaCursorStyle('move');
  }

  /** Apply CSS cursor style for Arena mode. */
  private applyArenaCursorStyle(state: string): void {
    const canvas = this.scene.game.canvas;
    switch (state) {
      case 'select':
        canvas.style.cursor = 'pointer';
        break;
      case 'move':
        canvas.style.cursor = 'crosshair';
        break;
      case 'attack':
        canvas.style.cursor = 'crosshair';
        break;
      default:
        canvas.style.cursor = 'default';
        break;
    }
  }

  // ─── Frame update ─────────────────────────────────────────────

  /**
   * Update turret aiming each frame.
   * Called from GameScene.update() when devtools is active.
   *
   * - Updates hover detection from mouse position.
   * - Updates selected vehicle turret target angle toward mouse.
   * - Applies rate-limited turret rotation.
   */
  update(delta: number): void {
    if (!this.isDevtoolsActive()) return;

    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) return;

    // Update hover detection
    this._hoveredVehicleId = this.findVehicleNearPoint(this._mouseWorldX, this._mouseWorldY, vehicles);

    // CORE-STEP-05H+: Update cursor feedback for Arena mode
    this.updateArenaCursorFeedback();

    // Update selected vehicle turret aiming
    if (this._selectedVehicleId) {
      const selected = vehicles.find(v => v.id === this._selectedVehicleId);
      if (selected) {
        // ARENA-03H+: Target-lock turret behavior in Arena mode
        if (this.isArenaMode()) {
          this.updateTurretAimArena(selected, vehicles, delta);
        } else {
          // Non-Arena devtools: original mouse-follow behavior
          const turretMountScreen = computeProjectedTurretMountScreen(selected, this.offset);
          const targetAngle = angleFromTo(turretMountScreen.x, turretMountScreen.y, this._mouseWorldX, this._mouseWorldY);
          selected.turretTargetAngle = targetAngle;

          // CORE-STEP-07H+: Use production weapon config turretTurnSpeed when available
          const weaponConfig = getWeaponConfig(selected.weaponId);
          const effectiveTurretSpeed = weaponConfig
            ? getWeaponMLevelValue(weaponConfig.turretTurnSpeed, 0) // Use M0 for now
            : selected.turretTurnSpeedDeg;

          const maxDelta = degPerSecToRadPerMs(effectiveTurretSpeed) * delta;
          selected.turretAngle = rotateTowardAngle(selected.turretAngle, targetAngle, maxDelta);
        }
      } else {
        // Selected vehicle no longer exists
        this._selectedVehicleId = null;
        this.onSelectionChanged?.(null);
      }
    }
  }

  /**
   * ARENA-03H+: Update turret aiming in Arena mode using target-lock.
   *
   * If the selected ally has a targetVehicleId, compute the turret aim angle
   * toward that target enemy's position. The turret continues tracking the
   * target while the ally moves around.
   *
   * If the target is destroyed or missing, clear it and hold last angle.
   * If no target is assigned, hold the last turret angle (do NOT chase mouse).
   */
  private updateTurretAimArena(selected: BlockoutVehicleState, vehicles: BlockoutVehicleState[], delta: number): void {
    // Check if target is still valid
    if (selected.targetVehicleId) {
      const target = vehicles.find(v => v.id === selected.targetVehicleId);
      if (!target || target.isDestroyed) {
        // Target destroyed or missing — clear target, hold last angle
        selected.targetVehicleId = null;
      }
    }

    if (selected.targetVehicleId) {
      const target = vehicles.find(v => v.id === selected.targetVehicleId);
      if (target) {
        // Compute turret mount screen position (shared source of truth — PROJECTION-01)
        const turretMountScreen = computeProjectedTurretMountScreen(selected, this.offset);
        // Compute target body center (world position)
        const targetCenter = computeBodyWorldCenter(target, this.offset);

        // Turret aims from mount position toward target body center
        const targetAngle = angleFromTo(turretMountScreen.x, turretMountScreen.y, targetCenter.x, targetCenter.y);
        selected.turretTargetAngle = targetAngle;

        // CORE-STEP-07H+: Use production weapon config turretTurnSpeed
        const weaponConfig = getWeaponConfig(selected.weaponId);
        const effectiveTurretSpeed = weaponConfig
          ? getWeaponMLevelValue(weaponConfig.turretTurnSpeed, 0)
          : selected.turretTurnSpeedDeg;

        // Rate-limited rotation
        const maxDelta = degPerSecToRadPerMs(effectiveTurretSpeed) * delta;
        selected.turretAngle = rotateTowardAngle(selected.turretAngle, targetAngle, maxDelta);
      }
    }
    // No target: hold last turret angle (do nothing — turret stays where it was)
  }

  // ─── Pointer input ───────────────────────────────────────────

  private onPointerdown(pointer: Phaser.Input.Pointer): void {
    if (!this.isDevtoolsActive()) return;

    // ARENA-02H+ fixup: Suppress pointer tracking when placement mode is active.
    // LMB is owned by placement (place unit), RMB is owned by placement (cancel).
    // Without this guard, the pointerup handler would still fire selection
    // changes and movement commands from the same click events.
    if (this.isPlacementActive()) return;

    if (pointer.leftButtonDown()) {
      this._lmbClickStartX = pointer.x;
      this._lmbClickStartY = pointer.y;
      this._lmbButtonDown = true;
    }

    // BLOCKOUT-04H+: Track RMB for movement target
    if (pointer.rightButtonDown()) {
      this._rmbClickStartX = pointer.x;
      this._rmbClickStartY = pointer.y;
      this._rmbButtonDown = true;
    }
  }

  private onPointerup(pointer: Phaser.Input.Pointer): void {
    // ARENA-02H+ fixup: Suppress click handling when placement mode is active.
    // Even though pointerdown is also guarded, we must guard here too because
    // a pointerdown that started before placement mode was entered could have
    // its pointerup fire during placement mode.
    const placementActive = this.isPlacementActive();

    // Handle LMB click
    if (this._lmbButtonDown) {
      this._lmbButtonDown = false;

      if (this.isDevtoolsActive() && !placementActive) {
        const dx = pointer.x - this._lmbClickStartX;
        const dy = pointer.y - this._lmbClickStartY;
        const moved = Math.sqrt(dx * dx + dy * dy);
        if (moved <= CLICK_DRAG_THRESHOLD) {
          this.handleLeftClick(pointer);
        }
      }
    }

    // BLOCKOUT-04H+: Handle RMB click for movement target
    if (this._rmbButtonDown) {
      this._rmbButtonDown = false;

      if (this.isDevtoolsActive() && !placementActive) {
        const dx = pointer.x - this._rmbClickStartX;
        const dy = pointer.y - this._rmbClickStartY;
        const moved = Math.sqrt(dx * dx + dy * dy);
        if (moved <= CLICK_DRAG_THRESHOLD) {
          this.handleRightClick(pointer);
        }
      }
    }
  }

  private onPointermove(pointer: Phaser.Input.Pointer): void {
    // Track mouse world position for turret aiming (always, even without click)
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this._mouseWorldX = worldPoint.x;
    this._mouseWorldY = worldPoint.y;
  }

  // ─── Click handling ──────────────────────────────────────────

  private handleLeftClick(pointer: Phaser.Input.Pointer): void {
    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) return;

    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hitVehicleId = this.findVehicleNearPoint(worldPoint.x, worldPoint.y, vehicles);

    if (hitVehicleId) {
      const hitVehicle = vehicles.find(v => v.id === hitVehicleId)!;

      // ARENA-03H+: Arena mode — enforce ally/enemy control rules
      if (this.isArenaMode()) {
        this.handleLeftClickArena(hitVehicle, vehicles);
        return;
      }

      // Non-Arena devtools: original behavior — select any vehicle
      if (this._selectedVehicleId && this._selectedVehicleId !== hitVehicleId) {
        this.stopFiringOnVehicle(this._selectedVehicleId);
      }
      this._selectedVehicleId = hitVehicleId;
      this.onSelectionChanged?.(hitVehicleId);
    } else {
      // Click on empty ground → deselect
      if (this._selectedVehicleId) {
        this.stopFiringOnVehicle(this._selectedVehicleId);
        // ARENA-03H+: Clear target on deselect
        this.clearTargetOnSelected(vehicles);
        this._selectedVehicleId = null;
        this.onSelectionChanged?.(null);
      }
    }
  }

  /**
   * CORE-STEP-05H+: Handle left click in Arena mode with ally/enemy control rules.
   *
   * LMB = select/inspect only:
   * - Enemy vehicles cannot be selected as controllable units.
   * - LMB on enemy does NOT assign target (that's RMB's job now).
   * - LMB on enemy with ally selected → no-op (inspect only, no control transfer).
   * - If user clicks another ally → select that ally, clear target.
   * - If user clicks an enemy with no ally selected → no-op.
   *
   * ARENA-03H+ backward compat note: Previously LMB on enemy with selected ally
   * would assign target. This is now moved to RMB to match classic RTS controls.
   */
  private handleLeftClickArena(hitVehicle: BlockoutVehicleState, vehicles: BlockoutVehicleState[]): void {
    const hitIsEnemy = hitVehicle.team === 'enemy';

    if (this._selectedVehicleId) {
      // An ally is currently selected
      const selected = vehicles.find(v => v.id === this._selectedVehicleId);
      if (!selected) {
        this._selectedVehicleId = null;
        this.onSelectionChanged?.(null);
        return;
      }

      if (hitIsEnemy) {
        // CORE-STEP-05H+: LMB on enemy → inspect only, no target assignment
        // Target assignment is now on RMB only
        return;
      }

      // Click on another ally → select it, clear target
      if (hitVehicle.id !== this._selectedVehicleId) {
        this.stopFiringOnVehicle(this._selectedVehicleId);
        this.clearTargetOnSelected(vehicles);
        this._selectedVehicleId = hitVehicle.id;
        this.onSelectionChanged?.(hitVehicle.id);
      }
      // Click on already-selected ally → no-op
    } else {
      // No ally selected
      if (hitIsEnemy) {
        // Cannot select enemy as controllable unit → no-op
        return;
      }
      // Click on ally with nothing selected → select it
      this._selectedVehicleId = hitVehicle.id;
      this.onSelectionChanged?.(hitVehicle.id);
    }
  }

  /**
   * ARENA-03H+: Clear targetVehicleId on the currently selected vehicle.
   * Also stops firing since the target is being cleared.
   */
  private clearTargetOnSelected(vehicles: BlockoutVehicleState[]): void {
    if (!this._selectedVehicleId) return;
    const selected = vehicles.find(v => v.id === this._selectedVehicleId);
    if (selected) {
      selected.targetVehicleId = null;
    }
  }

  /**
   * CORE-STEP-05H+: Handle right-click for commands.
   *
   * RMB = command:
   * - Ground + selected vehicle → move command
   * - Enemy + selected ally (Arena) → attack / target-lock
   * - No selected unit → no-op
   *
   * RMB drag is camera pan (handled by CameraControls). Only short clicks
   * (no drag) set a movement target. This prevents conflict with camera controls.
   */
  private handleRightClick(pointer: Phaser.Input.Pointer): void {
    if (!this._selectedVehicleId) return; // No vehicle selected — ignore RMB

    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) return;

    const selected = vehicles.find(v => v.id === this._selectedVehicleId);
    if (!selected) return;

    // BLOCKOUT-07H+: Don't move destroyed vehicles
    if (selected.isDestroyed) return;

    // ARENA-03H+: In Arena mode, enemies cannot receive movement commands
    if (this.isArenaMode() && selected.team === 'enemy') return;

    // PIM-HULL-WASP-DIR-MAP-01: Suppress movement when calibration freeze is active
    // Arena/devtools-only: calibration freeze cannot apply in Standard gameplay
    // because the controller is only created when devtoolsActive is true.
    if (selected.bodyId === 'wasp' && this.isDevtoolsActive() && isWaspCalibFrozen()) return;

    // Convert world click position to screen-space (subtract offset)
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // CORE-STEP-05H+: Check if RMB clicked on an enemy vehicle (Arena target-lock)
    if (this.isArenaMode()) {
      const hitVehicleId = this.findVehicleNearPoint(worldPoint.x, worldPoint.y, vehicles);
      if (hitVehicleId) {
        const hitVehicle = vehicles.find(v => v.id === hitVehicleId)!;
        if (hitVehicle.team === 'enemy' && selected.team === 'ally') {
          // RMB on enemy with selected ally → attack / target-lock
          selected.targetVehicleId = hitVehicleId;
          return;
        }
      }
    }

    const screenX = worldPoint.x - this.offset.x;
    const screenY = worldPoint.y - this.offset.y;

    // CORE-STEP-06H+: Use grid pathing when useGridMovement is true
    if (selected.useGridMovement) {
      setBlockoutVehicleMoveTarget(selected, screenX, screenY, gameState, this.getReservationMap() ?? undefined);
    } else {
      // Set movement target (arcade mode)
      setBlockoutVehicleMoveTarget(selected, screenX, screenY);
    }
  }

  // ─── Hit testing ─────────────────────────────────────────────

  /**
   * Find the blockout vehicle nearest to a world-space point, if within hit radius.
   *
   * Uses simple distance check from the world-space position of the vehicle.
   * The hit radius is based on the body profile size plus padding.
   */
  private findVehicleNearPoint(worldX: number, worldY: number, vehicles: BlockoutVehicleState[]): string | null {
    let bestId: string | null = null;
    let bestDist = Infinity;

    for (const vehicle of vehicles) {
      const bodySize = getBodyPixelSize(vehicle.bodyId);
      const hitRadius = Math.max(bodySize.w, bodySize.h) / 2 + HIT_RADIUS_PADDING;

      const bodyCenter = computeBodyWorldCenter(vehicle, this.offset);

      const dx = worldX - bodyCenter.x;
      const dy = worldY - bodyCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius && dist < bestDist) {
        bestDist = dist;
        bestId = vehicle.id;
      }
    }

    return bestId;
  }

  // ─── Cleanup ──────────────────────────────────────────────────

  // ─── Fire input (BLOCKOUT-05H+) ────────────────────────────────

  /**
   * Handle keyboard fire input (Space or F key).
   * BLOCKOUT-05H+: Dev-only weapon fire for selected blockout vehicle.
   * Only fires if a vehicle is selected, devtools is active,
   * and cooldown has elapsed.
   */
  private onKeydown(event: KeyboardEvent): void {
    if (!this.isDevtoolsActive()) return;

    // PIM-HULL-WASP-ANCHOR-MAP-01 fixup: When placement calibration is active
    // on a Wasp, I/K/J/L/O/P/U/R are consumed by placement calibration and must
    // NOT trigger upgrades or other actions. Skip upgrade processing for these keys.
    const placementConflictingKeys = new Set(['KeyI', 'KeyK', 'KeyJ', 'KeyL', 'KeyO', 'KeyP', 'KeyU', 'KeyR']);
    const isPlacementConflictingKey = placementConflictingKeys.has(event.code);
    const shouldSkipUpgrade = isPlacementConflictingKey
      && this._selectedVehicleId !== null
      && isWaspPlacementActiveCheck();

    // BLOCKOUT-09H: Upgrade hotkeys (processed before fire keys)
    if (!shouldSkipUpgrade) {
      const upgradeKeys: Array<{ code: string; id: BlockoutUpgradeId }> = [
        { code: 'KeyU', id: 'mobility_boost' },
        { code: 'Digit1', id: 'mobility_boost' },
        { code: 'KeyI', id: 'armor_plating' },
        { code: 'Digit2', id: 'armor_plating' },
        { code: 'KeyO', id: 'weapon_tuning' },
        { code: 'Digit3', id: 'weapon_tuning' },
        { code: 'KeyP', id: 'range_extender' },
        { code: 'Digit4', id: 'range_extender' },
        { code: 'KeyB', id: 'cooling_system' },
        { code: 'Digit5', id: 'cooling_system' },
      ];
      for (const { code, id } of upgradeKeys) {
        if (event.code === code) {
          if (!this._selectedVehicleId) return;
          const gameState = this.getGameState();
          const vehicles = gameState.blockoutVehicles;
          if (!vehicles) return;
          const selected = vehicles.find(v => v.id === this._selectedVehicleId);
          if (!selected || selected.isDestroyed) return;
          const nowMs = this.scene.time.now;
          applyUpgrade(selected, id, nowMs);
          return; // Don't process other keys
        }
      }
    }

    // BLOCKOUT-10H+: R key — reset scenario (dev/arena-only)
    // PIM-HULL-WASP-ANCHOR-MAP-01 fixup: R is also used for placement reset.
    // When placement calibration is active on a Wasp, let placement handle R.
    if (event.code === 'KeyR' && !shouldSkipUpgrade) {
      this.onResetScenario?.();
      return;
    }

    // BLOCKOUT-10H+: T key — cycle selected vehicle (dev/arena-only)
    if (event.code === 'KeyT') {
      this.cycleSelectedVehicle();
      return;
    }

    // BLOCKOUT-10H+: H key — toggle help overlay (dev/arena-only)
    if (event.code === 'KeyH') {
      this.onToggleHelp?.();
      return;
    }

    // CAMERA-00: C key — toggle camera projection calibration overlay (dev/arena-only)
    if (event.code === 'KeyC') {
      this.onToggleCalibration?.();
      return;
    }

    // CORE-STEP-05H+: S key — stop selected vehicle, clear target-lock
    if (event.code === 'KeyS') {
      if (this._selectedVehicleId) {
        const gameState = this.getGameState();
        const vehicles = gameState.blockoutVehicles;
        if (vehicles) {
          const selected = vehicles.find(v => v.id === this._selectedVehicleId);
          if (selected) {
            // Stop movement
            clearBlockoutVehicleMoveTarget(selected, this.getReservationMap() ?? undefined);
            // CORE-STEP-06H+: Also stop grid movement
            if (selected.useGridMovement) {
              // Grid stop is handled inside clearBlockoutVehicleMoveTarget
              // when reservationMap is available; here we just clear the flag
              selected.hasMoveTarget = false;
            }
            selected.vx = 0;
            selected.vy = 0;
            selected.speed = 0;

            // CORE-STEP-07H+: Clear target-lock using combat system
            const reservationMap = this.getReservationMap();
            if (reservationMap) {
              clearTargetLock(selected, reservationMap);
            } else {
              selected.targetVehicleId = null;
            }

            // Stop firing
            if (selected.fireHeld || selected.isFiring) {
              stopFiring(selected);
            }
          }
        }
      }
      return;
    }

    // ── PIM-HULL-WASP-DIR-MAP-01: Wasp hull calibration hotkeys ──────
    // Arena/devtools-only: explicit gate prevents any calibration action
    // in Standard gameplay. Matches the dev/arena-only guard pattern used
    // by R, H, C, T, and S keys above.
    // ] = next dir16, [ = prev dir16, \ = reset/clear, ; = toggle overlay
    // . = activate/toggle calibration mode
    if (this._selectedVehicleId && this.isDevtoolsActive()) {
      const gameState = this.getGameState();
      const vehicles = gameState.blockoutVehicles;
      const selected = vehicles?.find(v => v.id === this._selectedVehicleId);
      if (selected && selected.bodyId === 'wasp') {
        // . key — toggle calibration mode on/off
        if (event.code === 'Period') {
          const newState = toggleWaspCalibration();
          if (newState) {
            // Install console API on first activation
            waspCalibInstallConsole();
            console.log('[WaspCalibrator] Calibration mode ACTIVATED. Use ]/[ to cycle, \\ to reset, ; to toggle overlay.');
          } else {
            console.log('[WaspCalibrator] Calibration mode DEACTIVATED.');
          }
          return;
        }

        // Calibration hotkeys only work when calibration is active
        if (isWaspCalibActive()) {
          // ] key — next dir16
          if (event.code === 'BracketRight') {
            // If override is OFF, activate from current visual dir16 before cycling.
            // This ensures the first cycle press advances FROM the current direction,
            // not from an arbitrary default (0). The hull direction does not change
            // until the user explicitly presses ] or [.
            if (!isWaspCalibOverrideActive()) {
              const diag = resolveHullDirectionDiagnostic(
                selected.bodyId, selected.faction,
                selected.modificationLevel, selected.bodyAngle,
              );
              waspCalibActivateOverrideFromCurrent(diag.visualDir16);
            }
            const d = waspCalibCycleNext();
            console.log(`[WaspCalibrator] visual dir16 = ${d} (${getDir16Label(d)})`);
            return;
          }

          // [ key — previous dir16
          if (event.code === 'BracketLeft') {
            // If override is OFF, activate from current visual dir16 before cycling.
            if (!isWaspCalibOverrideActive()) {
              const diag = resolveHullDirectionDiagnostic(
                selected.bodyId, selected.faction,
                selected.modificationLevel, selected.bodyAngle,
              );
              waspCalibActivateOverrideFromCurrent(diag.visualDir16);
            }
            const d = waspCalibCyclePrev();
            console.log(`[WaspCalibrator] visual dir16 = ${d} (${getDir16Label(d)})`);
            return;
          }

          // \ key — reset to auto (clear override)
          if (event.code === 'Backslash') {
            waspCalibClearOverride();
            console.log('[WaspCalibrator] Override cleared — auto mode');
            return;
          }

          // ; key — toggle calibration overlay visibility
          if (event.code === 'Semicolon') {
            const v = waspCalibToggleOverlay();
            console.log(`[WaspCalibrator] Overlay ${v ? 'ON' : 'OFF'}`);
            return;
          }
        }
      }

      // ── PIM-HULL-WASP-ANCHOR-MAP-01: Wasp placement calibration hotkeys ──
      // Arena/devtools-only: explicit gate prevents any placement action
      // in Standard gameplay.
      //
      // HOTKEYS (when Wasp selected):
      //   U             — toggle placement calibration mode on/off
      //   I/K/J/L       — adjust offset 1px (up/down/left/right)
      //   Shift+I/K/J/L — adjust offset 5px
      //   R or 0        — reset offset to (0, 0)
      //   P             — print placement values
      //   O             — toggle placement overlay visibility
      //
      // These keys use I/K/J/L instead of Arrow keys to avoid conflict
      // with camera pan. When placement calibration is active, these keys
      // are consumed (preventDefault + stopPropagation) so the camera
      // does NOT move while calibrating.
      if (selected && selected.bodyId === 'wasp') {
        // U key — toggle placement calibration mode (no Alt needed)
        if (event.code === 'KeyU' && !event.ctrlKey && !event.altKey && !event.metaKey) {
          const newState = toggleWaspPlacement();
          if (newState) {
            waspPlaceInstallConsole();
            console.log('[WaspPlacement] Placement calibration ACTIVATED. I/K/J/L to adjust, R/0 to reset, P to print.');
          } else {
            console.log('[WaspPlacement] Placement calibration DEACTIVATED. Offset reset to (0, 0).');
          }
          return;
        }

        // Placement hotkeys only work when placement calibration is active
        if (isWaspPlacementActiveCheck()) {
          const large = event.shiftKey;

          // I — adjust up
          if (event.code === 'KeyI') {
            event.preventDefault();
            event.stopPropagation(); // prevent camera from receiving this key
            const o = waspPlaceAdjustUp(large);
            console.log(`[WaspPlacement] offset = (${o.x}, ${o.y})${large ? ' [5px]' : ''}`);
            return;
          }

          // K — adjust down
          if (event.code === 'KeyK') {
            event.preventDefault();
            event.stopPropagation(); // prevent camera from receiving this key
            const o = waspPlaceAdjustDown(large);
            console.log(`[WaspPlacement] offset = (${o.x}, ${o.y})${large ? ' [5px]' : ''}`);
            return;
          }

          // J — adjust left
          if (event.code === 'KeyJ') {
            event.preventDefault();
            event.stopPropagation(); // prevent camera from receiving this key
            const o = waspPlaceAdjustLeft(large);
            console.log(`[WaspPlacement] offset = (${o.x}, ${o.y})${large ? ' [5px]' : ''}`);
            return;
          }

          // L — adjust right
          if (event.code === 'KeyL') {
            event.preventDefault();
            event.stopPropagation(); // prevent camera from receiving this key
            const o = waspPlaceAdjustRight(large);
            console.log(`[WaspPlacement] offset = (${o.x}, ${o.y})${large ? ' [5px]' : ''}`);
            return;
          }

          // R or 0 — reset placement offset
          if (event.code === 'KeyR' || event.code === 'Digit0') {
            waspPlaceResetOffset();
            console.log('[WaspPlacement] Offset reset to (0, 0)');
            return;
          }

          // P — print placement values
          if (event.code === 'KeyP') {
            waspPlacePrintValues();
            return;
          }

          // O — toggle placement overlay visibility
          if (event.code === 'KeyO') {
            const v = waspPlaceToggleOverlay();
            console.log(`[WaspPlacement] Overlay ${v ? 'ON' : 'OFF'}`);
            return;
          }
        }
      }
    }

    if (event.code !== 'Space' && event.code !== 'KeyF') return;

    // Don't fire if no vehicle selected
    if (!this._selectedVehicleId) return;

    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) return;

    const selected = vehicles.find(v => v.id === this._selectedVehicleId);
    if (!selected) return;

    // BLOCKOUT-07H+: Don't fire if vehicle is destroyed
    if (selected.isDestroyed) return;

    // Use Phaser scene time consistently (never Date.now()) for weapon timing.
    // Mixing Date.now() (epoch ms ~1.7e12) with this.time.now (scene ms ~16ms)
    // causes negative elapsed times, broken recoil recovery, and VFX that never expire.
    const nowMs = this.scene.time.now;
    if (!canFireBlockoutWeapon(selected, nowMs)) return;

    // Compute barrel tip position using projected geometry at barrel Z
    // (shared source of truth with renderer — PROJECTION-01 fixup #2)
    const barrelTip = computeProjectedBarrelTipScreenAtZ(selected, this.offset);
    const barrelTipX = barrelTip.x;
    const barrelTipY = barrelTip.y;

    // Aim target: ARENA-03H+ — in Arena mode, if ally has a target, aim at target;
    // otherwise no-op (don't fire at mouse). Non-Arena: aim at mouse as before.
    let aimTargetX: number;
    let aimTargetY: number;

    if (this.isArenaMode()) {
      // Arena mode: use target-lock direction, or no-op if no target
      if (selected.targetVehicleId) {
        const target = vehicles.find(v => v.id === selected.targetVehicleId);
        if (target && !target.isDestroyed) {
          const targetCenter = computeBodyWorldCenter(target, this.offset);
          aimTargetX = targetCenter.x;
          aimTargetY = targetCenter.y;
        } else {
          // Target destroyed/missing — clear and don't fire
          selected.targetVehicleId = null;
          return;
        }
      } else {
        // No target assigned in Arena mode — don't fire blindly at mouse
        return;
      }
    } else {
      // Non-Arena devtools: original mouse-aim behavior
      aimTargetX = this._mouseWorldX;
      aimTargetY = this._mouseWorldY;
    }

    fireBlockoutWeapon(
      selected,
      barrelTipX,
      barrelTipY,
      selected.turretAngle,
      aimTargetX,
      aimTargetY,
      nowMs,
    );

    // BLOCKOUT-07H+: Apply damage to targets
    // BLOCKOUT-08H: Pass obstacles for line-of-fire blocking
    applyBlockoutWeaponDamage(
      selected, vehicles,
      barrelTipX, barrelTipY,
      selected.turretAngle,
      aimTargetX, aimTargetY,
      this.offset, nowMs,
      gameState.blockoutObstacles ?? [],
    );

    // BLOCKOUT-06H+ fixup: Start continuous fire only for stream weapons.
    // Single-shot weapons (Smoky, Railgun, Thunder, Shaft, Ricochet, Hammer)
    // must NOT remain fireHeld/isFiring after fire — they fire once per press.
    if (isContinuousWeapon(selected.weaponId)) {
      startFiring(selected);
    }
  }

  /**
   * Handle keyboard key-up for continuous fire release.
   * BLOCKOUT-06H+ fixup: Stops continuous fire on ALL vehicles with
   * fireHeld/isFiring, not just the currently selected vehicle.
   * This prevents orphaned firing state when the user deselects a
   * vehicle while holding fire and then releases the key.
   */
  private onKeyup(event: KeyboardEvent): void {
    if (!this.isDevtoolsActive()) return;
    if (event.code !== 'Space' && event.code !== 'KeyF') return;

    // BLOCKOUT-06H+ fixup: Stop firing for ALL blockout vehicles that
    // have fireHeld/isFiring, not just the currently selected one.
    // Previously, keyup returned early if no vehicle was selected,
    // leaving old firing vehicles stuck in fireHeld/isFiring state.
    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) return;

    for (const vehicle of vehicles) {
      if (vehicle.fireHeld || vehicle.isFiring) {
        stopFiring(vehicle);
      }
    }
  }

  /** Stop firing on a specific vehicle by ID. BLOCKOUT-06H+ fixup. */
  private stopFiringOnVehicle(vehicleId: string): void {
    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles) return;
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle && (vehicle.fireHeld || vehicle.isFiring)) {
      stopFiring(vehicle);
    }
  }

  /**
   * BLOCKOUT-10H+: Cycle selected vehicle to the next blockout vehicle.
   * Dev/arena-only. Wraps around from last to first.
   * If no vehicle is selected, selects the first vehicle.
   */
  private cycleSelectedVehicle(): void {
    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) return;

    // Stop firing on currently selected vehicle before switching
    if (this._selectedVehicleId) {
      this.stopFiringOnVehicle(this._selectedVehicleId);
      // ARENA-03H+: Clear target on switch
      this.clearTargetOnSelected(vehicles);
    }

    // ARENA-03H+: In Arena mode, only cycle through ally vehicles
    const candidates = this.isArenaMode()
      ? vehicles.filter(v => v.team === 'ally')
      : vehicles;

    if (candidates.length === 0) return;

    const currentIndex = candidates.findIndex(v => v.id === this._selectedVehicleId);
    const nextIndex = (currentIndex + 1) % candidates.length;
    const nextVehicle = candidates[nextIndex];

    this._selectedVehicleId = nextVehicle.id;
    this.onSelectionChanged?.(nextVehicle.id);
  }

  destroy(): void {
    // BLOCKOUT-06H+ fixup: Stop firing on all vehicles before destroying.
    // Prevents vehicles from remaining in fireHeld/isFiring state after
    // the controller is gone (which would cause GameScene to keep ticking them).
    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (vehicles) {
      for (const vehicle of vehicles) {
        if (vehicle.fireHeld || vehicle.isFiring) {
          stopFiring(vehicle);
        }
      }
    }

    this.scene.input.off('pointerdown', this.boundPointerdown);
    this.scene.input.off('pointerup', this.boundPointerup);
    this.scene.input.off('pointermove', this.boundPointermove);
    this.scene.input.keyboard?.off('keydown', this.boundKeydown);
    this.scene.input.keyboard?.off('keyup', this.boundKeyup);
  }
}

// ─── Exported pure helpers for testing ──────────────────────────────

/**
 * Hit-test: find the nearest blockout vehicle to a screen point.
 * Pure function for unit testing (no scene/camera dependency).
 *
 * @param clickWorldX - World X of click point
 * @param clickWorldY - World Y of click point
 * @param vehicles - Blockout vehicle states
 * @param offset - Map offset
 * @returns ID of nearest vehicle within hit radius, or null
 */
export function findBlockoutVehicleNearPoint(
  clickWorldX: number,
  clickWorldY: number,
  vehicles: BlockoutVehicleState[],
  offset: { x: number; y: number },
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const vehicle of vehicles) {
    const bodySize = getBodyPixelSize(vehicle.bodyId);
    const hitRadius = Math.max(bodySize.w, bodySize.h) / 2 + HIT_RADIUS_PADDING;

    const bodyCenter = computeBodyWorldCenter(vehicle, offset);

    const dx = clickWorldX - bodyCenter.x;
    const dy = clickWorldY - bodyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < hitRadius && dist < bestDist) {
      bestDist = dist;
      bestId = vehicle.id;
    }
  }

  return bestId;
}
