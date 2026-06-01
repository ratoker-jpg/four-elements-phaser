/**
 * BlockoutVehicleInputController — handles selection and turret aiming
 * for blockout vehicles in arena/dev mode.
 *
 * BLOCKOUT-03H: Selection/control + turret aiming.
 * BLOCKOUT-03H fixup: Turret aim angle computed from actual turret mount
 * origin (not body/tile center), using shared blockoutVehicleGeometry.
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
 */

import Phaser from 'phaser';
import type { IsoPoint } from '../render/isometric';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { computeTurretWorldOrigin, computeBodyWorldCenter, getBodyPixelSize } from '../render/blockoutVehicleGeometry';
import { rotateTowardAngle, angleFromTo, degPerSecToRadPerMs } from '../../state/angleMath';
import type { GameState } from '../../state/types';

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

  /** Click detection state. */
  private _clickStartX: number = 0;
  private _clickStartY: number = 0;
  private _clickButtonDown: boolean = false;

  /** Bound handler references for cleanup. */
  private boundPointerdown: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerup: (pointer: Phaser.Input.Pointer) => void;
  private boundPointermove: (pointer: Phaser.Input.Pointer) => void;

  constructor(deps: BlockoutVehicleInputDeps) {
    this.scene = deps.scene;
    this.offset = deps.offset;
    this.getGameState = deps.getGameState;
    this.isDevtoolsActive = deps.isDevtoolsActive;
    this.onSelectionChanged = deps.onSelectionChanged;

    this.boundPointerdown = this.onPointerdown.bind(this);
    this.boundPointerup = this.onPointerup.bind(this);
    this.boundPointermove = this.onPointermove.bind(this);

    this.scene.input.on('pointerdown', this.boundPointerdown);
    this.scene.input.on('pointerup', this.boundPointerup);
    this.scene.input.on('pointermove', this.boundPointermove);
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
    if (!pointer.leftButtonDown()) return;

    this._clickStartX = pointer.x;
    this._clickStartY = pointer.y;
    this._clickButtonDown = true;
  }

  private onPointerup(pointer: Phaser.Input.Pointer): void {
    if (!this._clickButtonDown) return;
    this._clickButtonDown = false;

    if (!this.isDevtoolsActive()) return;

    const dx = pointer.x - this._clickStartX;
    const dy = pointer.y - this._clickStartY;
    const moved = Math.sqrt(dx * dx + dy * dy);
    if (moved > CLICK_DRAG_THRESHOLD) return; // was a drag

    this.handleLeftClick(pointer);
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

  // ─── Hit testing ─────────────────────────────────────────────

  /**
   * Find the blockout vehicle nearest to a world-space point, if within hit radius.
   *
   * Uses simple distance check from the world-space position of the vehicle.
   * The hit radius is based on the body profile size plus padding.
   *
   * Exported as a pure function for testing.
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

  destroy(): void {
    this.scene.input.off('pointerdown', this.boundPointerdown);
    this.scene.input.off('pointerup', this.boundPointerup);
    this.scene.input.off('pointermove', this.boundPointermove);
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
