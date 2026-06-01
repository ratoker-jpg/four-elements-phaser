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
 */

import Phaser from 'phaser';
import type { IsoPoint } from '../render/isometric';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { computeTurretWorldOrigin, computeBodyWorldCenter, getBodyPixelSize } from '../render/blockoutVehicleGeometry';
import { setBlockoutVehicleMoveTarget } from '../../state/blockoutMovement';
import { rotateTowardAngle, angleFromTo, degPerSecToRadPerMs } from '../../state/angleMath';
import { canFireBlockoutWeapon, fireBlockoutWeapon } from '../../state/blockoutWeaponVfx';
import { getWeaponProfile } from '../../config/blockoutWeaponData';
import type { GameState } from '../../state/types';

// ─── Turret size constant (matches BlockoutVehicleRenderer) ──────

/** Turret rectangle size — must match BlockoutVehicleRenderer. */
const TURRET_SIZE = { w: 10, h: 6 };

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
}

// ─── Controller ────────────────────────────────────────────────────

export class BlockoutVehicleInputController {
  private scene: Phaser.Scene;
  private offset: IsoPoint;
  private getGameState: () => GameState;
  private isDevtoolsActive: () => boolean;
  private onSelectionChanged?: (selectedId: string | null) => void;

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

  constructor(deps: BlockoutVehicleInputDeps) {
    this.scene = deps.scene;
    this.offset = deps.offset;
    this.getGameState = deps.getGameState;
    this.isDevtoolsActive = deps.isDevtoolsActive;
    this.onSelectionChanged = deps.onSelectionChanged;

    this.boundPointerdown = this.onPointerdown.bind(this);
    this.boundPointerup = this.onPointerup.bind(this);
    this.boundPointermove = this.onPointermove.bind(this);
    this.boundKeydown = this.onKeydown.bind(this);

    this.scene.input.on('pointerdown', this.boundPointerdown);
    this.scene.input.on('pointerup', this.boundPointerup);
    this.scene.input.on('pointermove', this.boundPointermove);
    this.scene.input.keyboard?.on('keydown', this.boundKeydown);
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
        // Compute turret mount position in world coordinates
        // (not body/tile center — uses actual mount offset)
        const turretOrigin = computeTurretWorldOrigin(selected, this.offset);

        // Target angle from turret mount position to mouse
        const targetAngle = angleFromTo(turretOrigin.x, turretOrigin.y, this._mouseWorldX, this._mouseWorldY);
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
    // Handle LMB click
    if (this._lmbButtonDown) {
      this._lmbButtonDown = false;

      if (this.isDevtoolsActive()) {
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

      if (this.isDevtoolsActive()) {
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
      this._selectedVehicleId = hitVehicleId;
      this.onSelectionChanged?.(hitVehicleId);
    } else {
      // Click on empty ground → deselect
      if (this._selectedVehicleId) {
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
    if (event.code !== 'Space' && event.code !== 'KeyF') return;

    // Don't fire if no vehicle selected
    if (!this._selectedVehicleId) return;

    const gameState = this.getGameState();
    const vehicles = gameState.blockoutVehicles;
    if (!vehicles || vehicles.length === 0) return;

    const selected = vehicles.find(v => v.id === this._selectedVehicleId);
    if (!selected) return;

    const nowMs = Date.now();
    if (!canFireBlockoutWeapon(selected, nowMs)) return;

    // Compute barrel tip position in world coordinates (screen-space + offset)
    const turretOrigin = computeTurretWorldOrigin(selected, this.offset);
    const weaponProfile = getWeaponProfile(selected.weaponId);
    if (!weaponProfile) return;

    // Barrel tip = turret origin + barrel length along turret angle
    const totalBarrelLength = TURRET_SIZE.w / 2 + weaponProfile.blockoutBarrelLength;
    const barrelTipX = turretOrigin.x + Math.cos(selected.turretAngle) * totalBarrelLength;
    const barrelTipY = turretOrigin.y + Math.sin(selected.turretAngle) * totalBarrelLength;

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
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.boundPointerdown);
    this.scene.input.off('pointerup', this.boundPointerup);
    this.scene.input.off('pointermove', this.boundPointermove);
    this.scene.input.keyboard?.off('keydown', this.boundKeydown);
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
