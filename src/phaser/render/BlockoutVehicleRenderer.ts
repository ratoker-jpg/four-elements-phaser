/**
 * BlockoutVehicleRenderer — renders blockout vehicles as Phaser Graphics primitives.
 *
 * Uses no PNG assets, no asset manifest, no texture loading.
 * Renders body rectangle, turret rectangle, barrel line, and mount point circle.
 * Only active when devtools/arena mode is on.
 *
 * BLOCKOUT-02H: First visible blockout vehicles.
 * Vehicles are stationary — no movement, no turret aiming, no recoil.
 */

import Phaser from 'phaser';
import { tileToScreen, type IsoPoint } from './isometric';
import { getBodyProfile } from '../../config/blockoutBodyData';
import { getWeaponProfile } from '../../config/blockoutWeaponData';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import type { BlockoutShape, MountCategory } from '../../config/blockoutProfiles';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout vehicles (above terrain, coexisting with entities). */
const BLOCKOUT_DEPTH = 120;

/** Size mapping from blockoutShape to body rectangle dimensions in pixels.
 *  These are approximate and tunable. Larger = heavier body. */
const SHAPE_SIZE_MAP: Record<BlockoutShape, { w: number; h: number }> = {
  small_fast: { w: 16, h: 10 },
  light_fast: { w: 18, h: 12 },
  medium: { w: 22, h: 14 },
  large_fast: { w: 24, h: 14 },
  heavy: { w: 28, h: 18 },
  super_heavy: { w: 32, h: 22 },
};

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

// ─── Mount offset computation ──────────────────────────────────────

/**
 * Compute the pixel offset of the turret mount point relative to
 * the body center, based on mount category and body size.
 *
 * mountOffsetNormalized.x: 0=rear, 1=front
 * mountOffsetNormalized.y: 0=left, 1=right (not used in blockout for simplicity)
 *
 * The offset is along the body's forward axis, projected to screen coordinates.
 */
function computeMountPixelOffset(
  mountCategory: MountCategory,
  bodyWidth: number,
  _bodyHeight: number,
): { dx: number; dy: number } {
  // In isometric view, "forward" (body facing direction) maps to a diagonal.
  // For simplicity in blockout, we offset along the body's facing direction.
  // The mount offset moves the turret position relative to the body center.

  // Fractional offset along body's forward axis
  // rear = negative offset (behind center), front = positive offset (ahead of center)
  const fractionMap: Record<MountCategory, number> = {
    rear: -0.3,
    center_rear: -0.15,
    center: 0,
    front_center: 0.2,
    front: 0.3,
  };

  const fraction = fractionMap[mountCategory] ?? 0;
  // Offset in pixels along body forward direction
  const offset = fraction * bodyWidth;

  return { dx: offset, dy: 0 };
}

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

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
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

      // Redraw this vehicle
      this.renderVehicle(g, vehicle);

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
        const bodyProfile = getBodyProfile(vehicle.bodyId);
        const bodySize = bodyProfile ? SHAPE_SIZE_MAP[bodyProfile.blockoutShape] : SHAPE_SIZE_MAP.medium;
        const screenPos = tileToScreen(vehicle.tx, vehicle.ty);
        const worldX = screenPos.x + this.offset.x;
        const worldY = screenPos.y + this.offset.y;

        label.setText(`${vehicle.bodyId}+${vehicle.weaponId}`);
        label.setPosition(worldX, worldY - bodySize.h / 2 - 6);
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

  private renderVehicle(g: Phaser.GameObjects.Graphics, vehicle: BlockoutVehicleState): void {
    g.clear();

    const bodyProfile = getBodyProfile(vehicle.bodyId);
    if (!bodyProfile) return;
    const weaponProfile = getWeaponProfile(vehicle.weaponId);
    if (!weaponProfile) return;

    const bodySize = SHAPE_SIZE_MAP[bodyProfile.blockoutShape];
    const turretSize = TURRET_SIZE;
    const barrelLength = weaponProfile.blockoutBarrelLength;
    const barrelWidth = weaponProfile.blockoutBarrelWidth;

    // Screen position of the tile
    const screenPos = tileToScreen(vehicle.tx, vehicle.ty);
    const cx = screenPos.x + this.offset.x;
    const cy = screenPos.y + this.offset.y;

    const bodyAngle = vehicle.bodyAngle;
    const turretAngle = vehicle.turretAngle;

    // Faction colors
    const bodyColor = FACTION_BODY_COLORS[vehicle.faction] ?? FACTION_BODY_COLORS.cyan;
    const turretColor = FACTION_TURRET_COLORS[vehicle.faction] ?? FACTION_TURRET_COLORS.cyan;

    // ── Body rectangle ────────────────────────────────────────────
    g.save();
    g.translateCanvas(cx, cy);
    g.rotateCanvas(bodyAngle);

    // Filled body
    g.fillStyle(bodyColor, 1);
    g.fillRect(-bodySize.w / 2, -bodySize.h / 2, bodySize.w, bodySize.h);

    // Body outline
    g.lineStyle(1.5, BODY_OUTLINE_COLOR, 1);
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

    // ── Turret + Barrel (rotated independently) ──────────────────
    g.save();
    g.translateCanvas(cx, cy);

    // Rotate to body angle, then translate to mount point
    g.rotateCanvas(bodyAngle);
    g.translateCanvas(mountOffset.dx, mountOffset.dy);

    // Now rotate to turret angle (relative to body)
    g.rotateCanvas(turretAngle - bodyAngle);

    // Turret rectangle
    g.fillStyle(turretColor, 1);
    g.fillRect(-turretSize.w / 2, -turretSize.h / 2, turretSize.w, turretSize.h);

    // Turret outline
    g.lineStyle(1, TURRET_OUTLINE_COLOR, 1);
    g.strokeRect(-turretSize.w / 2, -turretSize.h / 2, turretSize.w, turretSize.h);

    // Barrel line (extends from turret center forward)
    g.lineStyle(barrelWidth, BARREL_COLOR, 1);
    g.beginPath();
    g.moveTo(turretSize.w / 2, 0);
    g.lineTo(turretSize.w / 2 + barrelLength, 0);
    g.strokePath();

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
