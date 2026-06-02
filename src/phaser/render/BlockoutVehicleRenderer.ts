/**
 * BlockoutVehicleRenderer — renders blockout vehicles as Phaser Graphics primitives.
 *
 * Uses no PNG assets, no asset manifest, no texture loading.
 * Renders body rectangle, turret rectangle, barrel line, and mount point circle.
 * Only active when devtools/arena mode is on.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 * BLOCKOUT-03H: Added selection highlight, hover marker, turret aiming
 * with independent rotation, and debug aim line for selected vehicles.
 * BLOCKOUT-03H fixup: Uses shared blockoutVehicleGeometry for body sizes
 * and mount offsets to ensure renderer and input controller agree.
 * BLOCKOUT-04H+: Uses vehicle.worldX/worldY for smooth continuous position.
 * Added movement target marker and move line for selected vehicles.
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import { getBodyProfile } from '../../config/blockoutBodyData';
import { getWeaponProfile } from '../../config/blockoutWeaponData';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { SHAPE_SIZE_MAP, computeMountPixelOffset, computeBodyWorldCenter, getBodyPixelSize } from './blockoutVehicleGeometry';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout vehicles (above terrain, coexisting with entities). */
const BLOCKOUT_DEPTH = 120;

// SHAPE_SIZE_MAP is imported from shared blockoutVehicleGeometry.
// Do not duplicate it here.

/** Turret rectangle size (consistent across bodies, weapon barrel varies). */
const TURRET_SIZE = { w: 10, h: 6 };

/** Mount point circle radius. */
const MOUNT_POINT_RADIUS = 3;

// ─── Faction colors ────────────────────────────────────────────────

/** Body fill color per faction. */
const FACTION_BODY_COLORS: Record<string, number> = {
  cyan: 0x00cccc,
  green: 0x44cc44,
  yellow: 0xcccc00,
  purple: 0xaa44cc,
};

/** Turret fill color per faction (slightly brighter than body). */
const FACTION_TURRET_COLORS: Record<string, number> = {
  cyan: 0x33eeee,
  green: 0x66ee66,
  yellow: 0xeeee33,
  purple: 0xcc66ee,
};

/** Outline color (dark stroke for body). */
const BODY_OUTLINE_COLOR = 0x222222;
const TURRET_OUTLINE_COLOR = 0x333333;

/** Barrel line color. */
const BARREL_COLOR = 0x555555;

/** Mount point circle color (debug only). */
const MOUNT_POINT_COLOR = 0xff0000;

/** Debug label color. */
const DEBUG_LABEL_COLOR = '#ffffff';

// ─── Selection / hover visual constants ────────────────────────────

/** Selection highlight ring color (bright gold). */
const SELECTION_RING_COLOR = 0xffd700;

/** Selection highlight ring line width. */
const SELECTION_RING_WIDTH = 2.5;

/** BLOCKOUT-10H+: Extra padding for selection ring (larger for readability). */
const SELECTION_RING_EXTRA_PAD = 8;

/** BLOCKOUT-10H+: Direction arrow length in pixels (extends from selection ring edge). */
const DIRECTION_ARROW_LENGTH = 12;

/** BLOCKOUT-10H+: Direction arrow head size in pixels. */
const DIRECTION_ARROW_HEAD = 5;

/** Hover marker ring color (subtle white). */
const HOVER_RING_COLOR = 0xffffff;

/** Hover marker ring alpha. */
const HOVER_RING_ALPHA = 0.3;

/** Aim line color for selected vehicle. */
const AIM_LINE_COLOR = 0xff4444;

/** Aim line alpha. */
const AIM_LINE_ALPHA = 0.6;

/** Aim line length in pixels (from turret center). */
const AIM_LINE_LENGTH = 120;

/** Aim line dash segment length. */
const AIM_LINE_DASH = 8;

/** Aim line gap length. */
const AIM_LINE_GAP = 5;

// ─── Movement target visual constants ───────────────────────────────

/** Move target marker color. BLOCKOUT-04H+. */
const MOVE_TARGET_COLOR = 0x44ff44;

/** Move target marker alpha. */
const MOVE_TARGET_ALPHA = 0.7;

/** Move target crosshair arm length in pixels. */
const MOVE_TARGET_CROSSHAIR_LEN = 8;

/** Move line color from vehicle to target. BLOCKOUT-04H+. */
const MOVE_LINE_COLOR = 0x44ff44;

/** Move line alpha. */
const MOVE_LINE_ALPHA = 0.3;

/** Move target ring radius. */
const MOVE_TARGET_RING_RADIUS = 6;

// ─── Renderer ──────────────────────────────────────────────────────

export class BlockoutVehicleRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Graphics objects keyed by blockout vehicle ID. */
  private vehicleGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Debug text labels keyed by blockout vehicle ID. */
  private debugLabels = new Map<string, Phaser.GameObjects.Text>();

  /** Whether debug labels are shown. */
  private showDebugLabels = true;

  /** Whether mount points are shown. */
  private showMountPoints = true;

  /** Currently selected vehicle ID (set from BlockoutVehicleInputController). */
  private _selectedVehicleId: string | null = null;

  /** Currently hovered vehicle ID (set from BlockoutVehicleInputController). */
  private _hoveredVehicleId: string | null = null;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Selection state ───────────────────────────────────────────

  /** Set the currently selected blockout vehicle ID. */
  setSelectedVehicleId(id: string | null): void {
    this._selectedVehicleId = id;
  }

  /** Set the currently hovered blockout vehicle ID. */
  setHoveredVehicleId(id: string | null): void {
    this._hoveredVehicleId = id;
  }

  // ─── Toggle methods ──────────────────────────────────────────────

  /** Toggle debug labels visibility. Returns new state. */
  toggleDebugLabels(): boolean {
    this.showDebugLabels = !this.showDebugLabels;
    for (const [, label] of this.debugLabels) {
      label.setVisible(this.showDebugLabels);
    }
    return this.showDebugLabels;
  }

  /** Toggle mount point circles visibility. Returns new state. */
  toggleMountPoints(): boolean {
    this.showMountPoints = !this.showMountPoints;
    return this.showMountPoints;
  }

  /** Whether debug labels are currently visible. */
  isDebugLabelsVisible(): boolean {
    return this.showDebugLabels;
  }

  /** Whether mount points are currently visible. */
  isMountPointsVisible(): boolean {
    return this.showMountPoints;
  }

  // ─── Frame sync ──────────────────────────────────────────────────

  /**
   * Sync blockout vehicle rendering from the current blockout vehicle state.
   * Called each frame. Destroys stale graphics, creates new ones for new vehicles.
   */
  syncFromState(vehicles: BlockoutVehicleState[]): void {
    const activeIds = new Set<string>();

    for (const vehicle of vehicles) {
      activeIds.add(vehicle.id);

      let g = this.vehicleGraphics.get(vehicle.id);
      if (!g) {
        g = this.scene.add.graphics();
        g.setDepth(BLOCKOUT_DEPTH);
        this.vehicleGraphics.set(vehicle.id, g);
      }

      // Determine selection/hover state for this vehicle
      const isSelected = vehicle.id === this._selectedVehicleId;
      const isHovered = vehicle.id === this._hoveredVehicleId;

      // Redraw this vehicle
      this.renderVehicle(g, vehicle, isSelected, isHovered);

      // Debug label
      let label = this.debugLabels.get(vehicle.id);
      if (!label && this.showDebugLabels) {
        label = this.scene.add.text(0, 0, '', {
          fontSize: '9px',
          color: DEBUG_LABEL_COLOR,
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        });
        label.setDepth(BLOCKOUT_DEPTH + 1);
        label.setOrigin(0.5, 1);
        this.debugLabels.set(vehicle.id, label);
      }

      if (label) {
        const bodySize = getBodyPixelSize(vehicle.bodyId);
        const bodyCenter = computeBodyWorldCenter(vehicle, this.offset);

        const selectedMarker = isSelected ? ' [SEL]' : '';
        const speedMarker = vehicle.speed > 1 ? ` v=${Math.round(vehicle.speed)}` : '';
        const hpMarker = vehicle.isDestroyed ? ' [DEAD]' : ` hp=${vehicle.hp}/${vehicle.maxHp}`;
        label.setText(`${vehicle.bodyId}+${vehicle.weaponId}${selectedMarker}${hpMarker}${speedMarker}`);
        label.setPosition(bodyCenter.x, bodyCenter.y - bodySize.h / 2 - 6);
        label.setVisible(this.showDebugLabels);
      }
    }

    // Clean up stale vehicles
    for (const [id, g] of this.vehicleGraphics) {
      if (!activeIds.has(id)) {
        g.destroy();
        this.vehicleGraphics.delete(id);
      }
    }
    for (const [id, label] of this.debugLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.debugLabels.delete(id);
      }
    }
  }

  // ─── Vehicle rendering ──────────────────────────────────────────

  private renderVehicle(g: Phaser.GameObjects.Graphics, vehicle: BlockoutVehicleState, isSelected: boolean, isHovered: boolean): void {
    g.clear();

    const bodyProfile = getBodyProfile(vehicle.bodyId);
    if (!bodyProfile) return;
    const weaponProfile = getWeaponProfile(vehicle.weaponId);
    if (!weaponProfile) return;

    const bodySize = SHAPE_SIZE_MAP[bodyProfile.blockoutShape];
    const turretSize = TURRET_SIZE;
    const barrelLength = weaponProfile.blockoutBarrelLength;
    const barrelWidth = weaponProfile.blockoutBarrelWidth;

    const bodyAngle = vehicle.bodyAngle;
    const turretAngle = vehicle.turretAngle;

    // BLOCKOUT-04H+: Use continuous worldX/worldY + offset for position
    // BLOCKOUT-05H+: Include recoil body impulse offset (shifts body backward)
    const recoilBodyOffset = vehicle.recoilBodyOffset ?? 0;
    const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
    const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;
    const cx = vehicle.worldX + this.offset.x + bodyImpulseX;
    const cy = vehicle.worldY + this.offset.y + bodyImpulseY;

    // Faction colors
    const bodyColor = FACTION_BODY_COLORS[vehicle.faction] ?? FACTION_BODY_COLORS.cyan;
    const turretColor = FACTION_TURRET_COLORS[vehicle.faction] ?? FACTION_TURRET_COLORS.cyan;

    // ── Movement target marker (selected vehicle only) ──────────
    if (isSelected && vehicle.hasMoveTarget) {
      const targetScreenX = vehicle.targetWorldX + this.offset.x;
      const targetScreenY = vehicle.targetWorldY + this.offset.y;

      // Thin line from vehicle to target
      g.lineStyle(1, MOVE_LINE_COLOR, MOVE_LINE_ALPHA);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(targetScreenX, targetScreenY);
      g.strokePath();

      // Target crosshair
      g.lineStyle(1.5, MOVE_TARGET_COLOR, MOVE_TARGET_ALPHA);
      // Horizontal arm
      g.beginPath();
      g.moveTo(targetScreenX - MOVE_TARGET_CROSSHAIR_LEN, targetScreenY);
      g.lineTo(targetScreenX + MOVE_TARGET_CROSSHAIR_LEN, targetScreenY);
      g.strokePath();
      // Vertical arm
      g.beginPath();
      g.moveTo(targetScreenX, targetScreenY - MOVE_TARGET_CROSSHAIR_LEN);
      g.lineTo(targetScreenX, targetScreenY + MOVE_TARGET_CROSSHAIR_LEN);
      g.strokePath();
      // Target ring
      g.strokeCircle(targetScreenX, targetScreenY, MOVE_TARGET_RING_RADIUS);
    }

    // ── Selection highlight ring ──────────────────────────────────
    if (isSelected) {
      const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 800) / 800 * Math.PI * 2);
      const alpha = 0.6 + 0.4 * pulse;
      // BLOCKOUT-10H+: Slightly larger ring for better readability
      const ringRadius = Math.max(bodySize.w, bodySize.h) / 2 + SELECTION_RING_EXTRA_PAD;

      g.lineStyle(SELECTION_RING_WIDTH, SELECTION_RING_COLOR, alpha);
      g.strokeCircle(cx, cy, ringRadius);

      // BLOCKOUT-10H+: Direction arrow outside the ring for orientation clarity
      const arrowBaseX = cx + Math.cos(bodyAngle) * ringRadius;
      const arrowBaseY = cy + Math.sin(bodyAngle) * ringRadius;
      const arrowTipX = cx + Math.cos(bodyAngle) * (ringRadius + DIRECTION_ARROW_LENGTH);
      const arrowTipY = cy + Math.sin(bodyAngle) * (ringRadius + DIRECTION_ARROW_LENGTH);

      // Arrow shaft
      g.lineStyle(2, SELECTION_RING_COLOR, alpha);
      g.beginPath();
      g.moveTo(arrowBaseX, arrowBaseY);
      g.lineTo(arrowTipX, arrowTipY);
      g.strokePath();

      // Arrow head (two short lines at ~30° from shaft direction)
      const headAngle1 = bodyAngle + Math.PI * 0.8;
      const headAngle2 = bodyAngle - Math.PI * 0.8;
      g.beginPath();
      g.moveTo(arrowTipX, arrowTipY);
      g.lineTo(arrowTipX + Math.cos(headAngle1) * DIRECTION_ARROW_HEAD, arrowTipY + Math.sin(headAngle1) * DIRECTION_ARROW_HEAD);
      g.strokePath();
      g.beginPath();
      g.moveTo(arrowTipX, arrowTipY);
      g.lineTo(arrowTipX + Math.cos(headAngle2) * DIRECTION_ARROW_HEAD, arrowTipY + Math.sin(headAngle2) * DIRECTION_ARROW_HEAD);
      g.strokePath();
    }

    // ── Hover marker ─────────────────────────────────────────────
    if (isHovered && !isSelected) {
      const hoverRadius = Math.max(bodySize.w, bodySize.h) / 2 + 4;
      g.lineStyle(1.5, HOVER_RING_COLOR, HOVER_RING_ALPHA);
      g.strokeCircle(cx, cy, hoverRadius);
    }

    // ── BLOCKOUT-07H+: Destroyed vehicle rendering ────────────────
    if (vehicle.isDestroyed) {
      g.save();
      g.translateCanvas(cx, cy);
      g.rotateCanvas(bodyAngle);

      // Dimmed body
      g.fillStyle(bodyColor, 0.3);
      g.fillRect(-bodySize.w / 2, -bodySize.h / 2, bodySize.w, bodySize.h);

      // Outline
      g.lineStyle(1, BODY_OUTLINE_COLOR, 0.5);
      g.strokeRect(-bodySize.w / 2, -bodySize.h / 2, bodySize.w, bodySize.h);

      // X marker over body
      g.lineStyle(2, 0xff0000, 0.8);
      const xSize = Math.min(bodySize.w, bodySize.h) / 2 - 2;
      g.beginPath();
      g.moveTo(-xSize, -xSize);
      g.lineTo(xSize, xSize);
      g.strokePath();
      g.beginPath();
      g.moveTo(xSize, -xSize);
      g.lineTo(-xSize, xSize);
      g.strokePath();

      g.restore();

      // No turret/barrel or HP bar for destroyed vehicles
      return;
    }

    // ── Body rectangle ────────────────────────────────────────────
    g.save();
    g.translateCanvas(cx, cy);
    g.rotateCanvas(bodyAngle);

    // Filled body
    g.fillStyle(bodyColor, 1);
    g.fillRect(-bodySize.w / 2, -bodySize.h / 2, bodySize.w, bodySize.h);

    // Body outline (thicker when selected)
    const outlineWidth = isSelected ? 2.5 : 1.5;
    g.lineStyle(outlineWidth, BODY_OUTLINE_COLOR, 1);
    g.strokeRect(-bodySize.w / 2, -bodySize.h / 2, bodySize.w, bodySize.h);

    // Forward direction indicator (small line from center toward front)
    g.lineStyle(1, 0xffffff, 0.5);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(bodySize.w / 2 - 2, 0);
    g.strokePath();

    // ── Turret mount offset ───────────────────────────────────────
    const mountOffset = computeMountPixelOffset(
      bodyProfile.mountCategory,
      bodySize.w,
      bodySize.h,
    );

    // ── Mount point circle (debug) ────────────────────────────────
    if (this.showMountPoints) {
      g.fillStyle(MOUNT_POINT_COLOR, 0.7);
      g.fillCircle(mountOffset.dx, mountOffset.dy, MOUNT_POINT_RADIUS);
      g.lineStyle(1, 0xff0000, 1);
      g.strokeCircle(mountOffset.dx, mountOffset.dy, MOUNT_POINT_RADIUS);
    }

    g.restore();

    // ── BLOCKOUT-07H+: HP bar above vehicle ──────────────────────
    {
      const hpRatio = vehicle.maxHp > 0 ? vehicle.hp / vehicle.maxHp : 0;
      const barWidth = bodySize.w + 4;
      const barHeight = 3;
      const barY = cy - bodySize.h / 2 - 8;

      // Background (dark)
      g.fillStyle(0x333333, 0.7);
      g.fillRect(cx - barWidth / 2, barY, barWidth, barHeight);

      // HP fill (green > 60%, yellow 30-60%, red < 30%)
      let hpColor = 0x44ff44; // green
      if (hpRatio < 0.3) {
        hpColor = 0xff4444; // red
      } else if (hpRatio < 0.6) {
        hpColor = 0xffcc00; // yellow
      }
      const fillWidth = barWidth * Math.max(0, hpRatio);
      g.fillStyle(hpColor, 0.9);
      g.fillRect(cx - barWidth / 2, barY, fillWidth, barHeight);
    }

    // ── BLOCKOUT-07H+: Damage flash ──────────────────────────────
    {
      const nowMs = this.scene.time.now;
      if (nowMs < vehicle.damageFlashUntil) {
        // White overlay on body
        g.save();
        g.translateCanvas(cx, cy);
        g.rotateCanvas(bodyAngle);
        g.fillStyle(0xffffff, 0.4);
        g.fillRect(-bodySize.w / 2, -bodySize.h / 2, bodySize.w, bodySize.h);
        g.restore();
      }
    }

    // ── Turret + Barrel (rotated independently) ──────────────────
    g.save();
    g.translateCanvas(cx, cy);

    // Rotate to body angle, then translate to mount point
    g.rotateCanvas(bodyAngle);
    g.translateCanvas(mountOffset.dx, mountOffset.dy);

    // Now rotate to turret angle (relative to body)
    // BLOCKOUT-05H+: Include recoil turret kickback offset
    const recoilTurretOffset = vehicle.recoilTurretOffset ?? 0;
    g.rotateCanvas(turretAngle - bodyAngle - recoilTurretOffset);

    // Turret rectangle
    g.fillStyle(turretColor, 1);
    g.fillRect(-turretSize.w / 2, -turretSize.h / 2, turretSize.w, turretSize.h);

    // Turret outline (brighter when selected)
    const turretOutlineWidth = isSelected ? 2 : 1;
    g.lineStyle(turretOutlineWidth, TURRET_OUTLINE_COLOR, 1);
    g.strokeRect(-turretSize.w / 2, -turretSize.h / 2, turretSize.w, turretSize.h);

    // Barrel line (extends from turret center forward)
    // BLOCKOUT-05H+: Barrel kickback — shorten barrel when recoil is active
    const recoilBarrelOffset = vehicle.recoilBarrelOffset ?? 0;
    const effectiveBarrelLength = Math.max(0, barrelLength - recoilBarrelOffset);
    g.lineStyle(barrelWidth, BARREL_COLOR, 1);
    g.beginPath();
    g.moveTo(turretSize.w / 2, 0);
    g.lineTo(turretSize.w / 2 + effectiveBarrelLength, 0);
    g.strokePath();

    // ── Aim line for selected vehicle ─────────────────────────────
    if (isSelected) {
      g.lineStyle(1.5, AIM_LINE_COLOR, AIM_LINE_ALPHA);
      const aimStart = turretSize.w / 2 + barrelLength;
      const aimEnd = aimStart + AIM_LINE_LENGTH;

      // Draw dashed aim line
      let pos = aimStart;
      while (pos < aimEnd) {
        const segEnd = Math.min(pos + AIM_LINE_DASH, aimEnd);
        g.beginPath();
        g.moveTo(pos, 0);
        g.lineTo(segEnd, 0);
        g.strokePath();
        pos = segEnd + AIM_LINE_GAP;
      }
    }

    g.restore();
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    for (const [, g] of this.vehicleGraphics) {
      g.destroy();
    }
    this.vehicleGraphics.clear();

    for (const [, label] of this.debugLabels) {
      label.destroy();
    }
    this.debugLabels.clear();
  }
}
