/**
 * BlockoutVehicleInputController — handles selection, turret aiming,
 * and movement targeting for blockout vehicles in arena/dev mode.
 *
 * BLOCKOUT-03H: Selection/control + turret aiming.
 * BLOCKOUT-03H fixup: Turret aim angle computed from actual turret mount
 * origin (not body/tile center), using shared blockoutVehicleGeometry.
 * BLOCKOUT-04H+: RMB click sets movement target for selected vehicle.
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
import { setBlockoutVehicleMoveTarget } from '../../state/blockoutMovement';
import { rotateTowardAngle, angleFromTo, degPerSecToRadPerMs } from '../../state/angleMath';
import { canFireBlockoutWeapon, fireBlockoutWeapon, startFiring, stopFiring, isContinuousWeapon } from '../../state/blockoutWeaponVfx';
import { applyBlockoutWeaponDamage } from '../../state/blockoutDamage';
import type { GameState } from '../../state/types';
import { applyUpgrade } from '../../state/blockoutUpgrades';
import type { BlockoutUpgradeId } from '../../config/blockoutUpgradeData';

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

  /** Mouse world X position. BLOCKOUT-06H+. */
  get mouseWorldX(): number { return this._mouseWorldX; }

  /** Mouse world Y position. BLOCKOUT-06H+. */
  get mouseWorldY(): number { return this._mouseWorldY; }

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

    // Update selected vehicle turret aiming
    if (this._selectedVehicleId) {
      const selected = vehicles.find(v => v.id === this._selectedVehicleId);
      if (selected) {
        // Compute turret mount screen position using projected geometry
        // (shared source of truth with renderer — PROJECTION-01 fixup)
        const turretMountScreen = computeProjectedTurretMountScreen(selected, this.offset);

        // Target angle from turret mount position to mouse
        const targetAngle = angleFromTo(turretMountScreen.x, turretMountScreen.y, this._mouseWorldX, this._mouseWorldY);
        selected.turretTargetAngle = targetAngle;

        // Rate-limited rotation
        const maxDelta = degPerSecToRadPerMs(selected.turretTurnSpeedDeg) * delta;
        selected.turretAngle = rotateTowardAngle(selected.turretAngle, targetAngle, maxDelta);
      } else {
        // Selected vehicle no longer exists
        this._selectedVehicleId = null;
        this.onSelectionChanged?.(null);
      }
    }
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
      // Click on a blockout vehicle → select it
      // BLOCKOUT-06H+ fixup: stop firing on previous vehicle before selecting a different one
      if (this._selectedVehicleId && this._selectedVehicleId !== hitVehicleId) {
        this.stopFiringOnVehicle(this._selectedVehicleId);
      }
      this._selectedVehicleId = hitVehicleId;
      this.onSelectionChanged?.(hitVehicleId);
    } else {
      // Click on empty ground → deselect
      // BLOCKOUT-06H+ fixup: stop firing on previously selected vehicle before deselecting
      if (this._selectedVehicleId) {
        this.stopFiringOnVehicle(this._selectedVehicleId);
        this._selectedVehicleId = null;
        this.onSelectionChanged?.(null);
      }
    }
  }

  /**
   * BLOCKOUT-04H+: Handle right-click to set movement target for selected vehicle.
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

    // Convert world click position to screen-space (subtract offset)
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const screenX = worldPoint.x - this.offset.x;
    const screenY = worldPoint.y - this.offset.y;

    // Set movement target
    setBlockoutVehicleMoveTarget(selected, screenX, screenY);
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

    // BLOCKOUT-09H: Upgrade hotkeys (processed before fire keys)
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

    // BLOCKOUT-10H+: R key — reset scenario (dev/arena-only)
    if (event.code === 'KeyR') {
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

    // Aim target = mouse world position
    const aimTargetX = this._mouseWorldX;
    const aimTargetY = this._mouseWorldY;

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
    }

    const currentIndex = vehicles.findIndex(v => v.id === this._selectedVehicleId);
    const nextIndex = (currentIndex + 1) % vehicles.length;
    const nextVehicle = vehicles[nextIndex];

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
