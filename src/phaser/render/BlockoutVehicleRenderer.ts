/**
 * BlockoutVehicleRenderer — renders blockout vehicles as pseudo-isometric
 * Phaser Graphics primitives following the camera projection contract.
 *
 * PROJECTION-01: Ground-plane retrofit.
 * - Bodies rendered as pseudo-isometric boxes (base + side + top face)
 * - Selection/hover rings are projected ground-plane ellipses
 * - Move target markers use projected ground-plane diamonds
 * - Vehicle shadows rendered as projected ground-plane ellipses
 * - Range indicators use projected ground-plane circles
 * - Turret sits visually on top plane using basisZ
 *
 * Uses no PNG assets, no asset manifest, no texture loading.
 * Only active when devtools/arena mode is on.
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import {
  computeBodyWorldCenter,
  computeProjectedBlockoutVehicleGeometry,
  BLOCKOUT_VEHICLE_BODY_Z,
  BLOCKOUT_TURRET_Z_OFFSET,
  BLOCKOUT_TURRET_BOX_HEIGHT,
} from './blockoutVehicleGeometry';
import {
  drawProjectedGroundRing,
  drawProjectedGroundDiamond,
  drawProjectedShadow,
  drawProjectedBox,
  drawProjectedCrosshair,
} from './projectedGroundPrimitives';
import { projectWorldPoint, unprojectScreenToGround, PROJ_TILE_W } from '../../config/cameraProjectionContract';
import { getWeaponProfile } from '../../config/blockoutWeaponData';
import { getWeaponConfig } from '../../config/weaponData';
import { sortByDepth, type DepthSortable } from './depthSorting';
import { getTrackAnimationState } from '../../state/trackAnimation';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout vehicles (above terrain, coexisting with entities). */
const BLOCKOUT_DEPTH = 120;

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

// ─── Z-level constants are now in blockoutVehicleGeometry (PROJECTION-01 fixup #2)
// BLOCKOUT_VEHICLE_BODY_Z, BLOCKOUT_TURRET_Z_OFFSET, BLOCKOUT_TURRET_BOX_HEIGHT,
// BLOCKOUT_BARREL_Z — do not duplicate here.

// ─── Selection / hover visual constants ────────────────────────────

/** Selection highlight ring color (bright gold). */
const SELECTION_RING_COLOR = 0xffd700;

/** Selection highlight ring line width. */
const SELECTION_RING_WIDTH = 2.5;

/** Selection ring radius in world/tile units. PROJECTION-01. */
const SELECTION_RING_WORLD_RADIUS = 0.65;

/** BLOCKOUT-10H+: Direction arrow length in pixels (extends from selection ring edge). */
const DIRECTION_ARROW_LENGTH = 12;

/** BLOCKOUT-10H+: Direction arrow head size in pixels. */
const DIRECTION_ARROW_HEAD = 5;

/** Hover marker ring color (subtle white). */
const HOVER_RING_COLOR = 0xffffff;

/** Hover marker ring alpha. */
const HOVER_RING_ALPHA = 0.3;

/** Hover ring radius in world/tile units. PROJECTION-01. */
const HOVER_RING_WORLD_RADIUS = 0.5;

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

/** Move target diamond half-size in world/tile units. PROJECTION-01. */
const MOVE_TARGET_DIAMOND_HALF_SIZE = 0.2;

/** Move target crosshair arm length in world/tile units. PROJECTION-01. */
const MOVE_TARGET_CROSSHAIR_ARM = 0.15;

/** Move line color from vehicle to target. BLOCKOUT-04H+. */
const MOVE_LINE_COLOR = 0x44ff44;

/** Move line alpha. */
const MOVE_LINE_ALPHA = 0.3;

// ─── Shadow constants ──────────────────────────────────────────────

/** Shadow world radius as fraction of vehicle half-size. */
const SHADOW_RADIUS_FRACTION = 0.7;

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

  /** ARENA-03H+: Currently targeted vehicle ID (for target indicator rendering). */
  private _targetedVehicleId: string | null = null;

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

  /** ARENA-03H+: Set the currently targeted vehicle ID (enemy target indicator). */
  setTargetedVehicleId(id: string | null): void {
    this._targetedVehicleId = id;
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
        const bodyCenter = computeBodyWorldCenter(vehicle, this.offset);

        const selectedMarker = isSelected ? ' [SEL]' : '';
        const speedMarker = vehicle.speed > 1 ? ` v=${Math.round(vehicle.speed)}` : '';
        const hpMarker = vehicle.isDestroyed ? ' [DEAD]' : ` hp=${vehicle.hp}/${vehicle.maxHp}`;
        label.setText(`${vehicle.bodyId}+${vehicle.weaponId}${selectedMarker}${hpMarker}${speedMarker}`);

        // Position label above top face (body center + Z offset)
        const labelZ = vehicle.isDestroyed ? 0 : BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.1;
        const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, this.offset);
        const labelPos = projectWorldPoint(tilePos.x, tilePos.y, labelZ, this.offset);
        label.setPosition(labelPos.x, labelPos.y);
        label.setVisible(this.showDebugLabels);
      }
    }

    // ── CORE-STEP-06H+: Depth sorting ─────────────────────────────
    // Sort all vehicles by isometric depth for correct occlusion.
    // Vehicles with lower screen Y (further from camera) are drawn first.
    const depthSortables: DepthSortable[] = vehicles
      .filter(v => !v.isDestroyed && activeIds.has(v.id))
      .map(v => ({
        id: v.id,
        type: 'unit' as const,
        tx: v.tx,
        ty: v.ty,
        offsetX: this.offset.x,
        offsetY: this.offset.y,
      }));
    const depthOrder = new Map<string, number>();
    if (depthSortables.length > 0) {
      const sorted = sortByDepth(depthSortables);
      for (let i = 0; i < sorted.length; i++) {
        depthOrder.set(sorted[i].sortable.id, i);
      }
    }

    // Apply depth to each vehicle's graphics object
    for (const vehicle of vehicles) {
      const g = this.vehicleGraphics.get(vehicle.id);
      if (g) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          // Use BLOCKOUT_DEPTH as base + sorted order for isometric correctness
          g.setDepth(BLOCKOUT_DEPTH + orderIdx);
        }
      }
      // Also update debug label depth
      const label = this.debugLabels.get(vehicle.id);
      if (label) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          label.setDepth(BLOCKOUT_DEPTH + orderIdx + 1);
        }
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

    // ── Shared projected geometry (single source of truth) ────────
    const geom = computeProjectedBlockoutVehicleGeometry(vehicle, this.offset);
    const { halfW, halfH, mountTileOffset, turretHalfW, turretHalfH,
            effectiveBarrelLength, effectiveTurretAngle, barrelZ,
            barrelTipScreen, barrelStartScreen } = geom;

    const bodyAngle = vehicle.bodyAngle;

    // BLOCKOUT-04H+: Use continuous worldX/worldY + offset for position
    // BLOCKOUT-05H+: Include recoil body impulse offset (shifts body backward)
    const recoilBodyOffset = vehicle.recoilBodyOffset ?? 0;
    const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
    const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;
    const cx = vehicle.worldX + this.offset.x + bodyImpulseX;
    const cy = vehicle.worldY + this.offset.y + bodyImpulseY;

    // Tile-space body center (with impulse for visual rendering)
    const tilePos = unprojectScreenToGround(cx, cy, this.offset);
    // Tile-space mount position (shared offset + impulse-shifted body center)
    const mountWorldX = tilePos.x + mountTileOffset.dx;
    const mountWorldY = tilePos.y + mountTileOffset.dy;

    // Faction colors
    const bodyColor = FACTION_BODY_COLORS[vehicle.faction] ?? FACTION_BODY_COLORS.cyan;
    const turretColor = FACTION_TURRET_COLORS[vehicle.faction] ?? FACTION_TURRET_COLORS.cyan;

    // Barrel width from weapon profile
    const wpProfile = getWeaponProfile(vehicle.weaponId);
    const barrelWidth = wpProfile ? wpProfile.blockoutBarrelWidth : 2;

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

      // Projected ground diamond at target
      g.lineStyle(1.5, MOVE_TARGET_COLOR, MOVE_TARGET_ALPHA);
      drawProjectedGroundDiamond(g, targetScreenX, targetScreenY, MOVE_TARGET_DIAMOND_HALF_SIZE, this.offset);

      // Projected crosshair
      drawProjectedCrosshair(g, targetScreenX, targetScreenY, MOVE_TARGET_CROSSHAIR_ARM, this.offset);
    }

    // ── Selection highlight ring (projected ground-plane) ────────
    if (isSelected) {
      const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 800) / 800 * Math.PI * 2);
      const alpha = 0.6 + 0.4 * pulse;

      g.lineStyle(SELECTION_RING_WIDTH, SELECTION_RING_COLOR, alpha);
      drawProjectedGroundRing(g, cx, cy, SELECTION_RING_WORLD_RADIUS, this.offset, 24);

      // BLOCKOUT-10H+: Direction arrow outside the ring for orientation clarity
      // Use screen-space arrow from body center along body angle
      // Approximate ring edge in screen space for arrow placement
      const ringEdgeDist = SELECTION_RING_WORLD_RADIUS * 38; // approximate pixel distance
      const arrowBaseX = cx + Math.cos(bodyAngle) * ringEdgeDist;
      const arrowBaseY = cy + Math.sin(bodyAngle) * ringEdgeDist;
      const arrowTipX = cx + Math.cos(bodyAngle) * (ringEdgeDist + DIRECTION_ARROW_LENGTH);
      const arrowTipY = cy + Math.sin(bodyAngle) * (ringEdgeDist + DIRECTION_ARROW_LENGTH);

      // Arrow shaft
      g.lineStyle(2, SELECTION_RING_COLOR, alpha);
      g.beginPath();
      g.moveTo(arrowBaseX, arrowBaseY);
      g.lineTo(arrowTipX, arrowTipY);
      g.strokePath();

      // Arrow head
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

    // ── Hover marker (projected ground-plane) ────────────────────
    if (isHovered && !isSelected) {
      g.lineStyle(1.5, HOVER_RING_COLOR, HOVER_RING_ALPHA);
      drawProjectedGroundRing(g, cx, cy, HOVER_RING_WORLD_RADIUS, this.offset, 20);
    }

    // ── ARENA-03H+: Target indicator (enemy being targeted by selected ally) ──
    const isTargeted = vehicle.id === this._targetedVehicleId;
    if (isTargeted && !isSelected) {
      const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 600) / 600 * Math.PI * 2);
      const alpha = 0.5 + 0.5 * pulse;
      g.lineStyle(2, 0xff4444, alpha); // Red targeting ring
      drawProjectedGroundRing(g, cx, cy, SELECTION_RING_WORLD_RADIUS, this.offset, 24);

      // Small crosshair in center
      const crossSize = 0.12;
      g.lineStyle(1.5, 0xff4444, alpha);
      drawProjectedCrosshair(g, cx, cy, crossSize, this.offset);
    }

    // ── CORE-STEP-07H+: Target-lock status indicator on attacker ──
    // Show a small colored dot above the turret when this vehicle has an active target-lock
    if (vehicle.targetVehicleId && !vehicle.isDestroyed) {
      // Target-lock active: show yellow dot above turret
      const lockIndicatorZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.3;
      const tilePosLocal = unprojectScreenToGround(cx, cy, this.offset);
      const lockPos = projectWorldPoint(tilePosLocal.x, tilePosLocal.y, lockIndicatorZ, this.offset);
      g.fillStyle(0xffcc00, 0.9); // Yellow target-lock indicator
      g.fillCircle(lockPos.x, lockPos.y, 3);
    }

    // ── ARENA-03H+: Enemy team indicator (small red diamond above HP bar) ──
    if (vehicle.team === 'enemy' && !vehicle.isDestroyed) {
      const indicatorZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.2;
      const indicatorPos = projectWorldPoint(tilePos.x, tilePos.y, indicatorZ, this.offset);
      const indicatorSize = 0.08;
      g.lineStyle(1, 0xff4444, 0.7);
      drawProjectedGroundDiamond(g, indicatorPos.x, indicatorPos.y, indicatorSize, this.offset);
    }

    // ── BLOCKOUT-07H+: Destroyed vehicle rendering ────────────────
    if (vehicle.isDestroyed) {
      // Dimmed flat body on ground (no height)
      const cosA = Math.cos(bodyAngle);
      const sinA = Math.sin(bodyAngle);
      const localCorners = [
        { lx: -halfW, ly: -halfH },
        { lx: halfW, ly: -halfH },
        { lx: halfW, ly: halfH },
        { lx: -halfW, ly: halfH },
      ];
      const basePts = localCorners.map(c => {
        const wx = tilePos.x + c.lx * cosA - c.ly * sinA;
        const wy = tilePos.y + c.lx * sinA + c.ly * cosA;
        return projectWorldPoint(wx, wy, 0, this.offset);
      });

      g.fillStyle(bodyColor, 0.3);
      g.beginPath();
      g.moveTo(basePts[0].x, basePts[0].y);
      for (let i = 1; i < basePts.length; i++) {
        g.lineTo(basePts[i].x, basePts[i].y);
      }
      g.closePath();
      g.fillPath();

      g.lineStyle(1, BODY_OUTLINE_COLOR, 0.5);
      g.beginPath();
      g.moveTo(basePts[0].x, basePts[0].y);
      for (let i = 1; i < basePts.length; i++) {
        g.lineTo(basePts[i].x, basePts[i].y);
      }
      g.closePath();
      g.strokePath();

      // X marker over body (use tile-unit size for consistency)
      g.lineStyle(2, 0xff0000, 0.8);
      const xSize = Math.min(halfW, halfH) * PROJ_TILE_W / 2 - 2;
      g.beginPath();
      g.moveTo(cx - xSize, cy - xSize);
      g.lineTo(cx + xSize, cy + xSize);
      g.strokePath();
      g.beginPath();
      g.moveTo(cx + xSize, cy - xSize);
      g.lineTo(cx - xSize, cy + xSize);
      g.strokePath();

      // No turret/barrel or HP bar for destroyed vehicles
      return;
    }

    // ── Vehicle shadow (projected ground-plane) ──────────────────
    const shadowRadius = Math.max(halfW, halfH) * SHADOW_RADIUS_FRACTION;
    drawProjectedShadow(g, cx, cy, shadowRadius, this.offset);

    // ── Pseudo-isometric body (base + side + top) ────────────────
    // Derive side color (darker than body) and top color (brighter)
    const sideR = ((bodyColor >> 16) & 0xff) * 0.6;
    const sideG = ((bodyColor >> 8) & 0xff) * 0.6;
    const sideB = (bodyColor & 0xff) * 0.6;
    const sideColor = (Math.floor(sideR) << 16) | (Math.floor(sideG) << 8) | Math.floor(sideB);

    const topR = Math.min(255, ((bodyColor >> 16) & 0xff) * 1.2);
    const topG = Math.min(255, ((bodyColor >> 8) & 0xff) * 1.2);
    const topB = Math.min(255, (bodyColor & 0xff) * 1.2);
    const topColor = (Math.floor(topR) << 16) | (Math.floor(topG) << 8) | Math.floor(topB);

    drawProjectedBox(
      g, cx, cy, halfW, halfH, BLOCKOUT_VEHICLE_BODY_Z,
      this.offset, bodyAngle,
      bodyColor, sideColor, topColor, BODY_OUTLINE_COLOR,
      0.3, 0.75, 1.0,
    );

    // ── CORE-STEP-08H+ FIXUP Blocker 5: Track animation indicators ──
    // Blockout/procedural visualization: show track activity as small
    // colored lines at the sides of the body. Active when moving/turning.
    {
      const trackAnim = getTrackAnimationState(vehicle);
      if (trackAnim.isMoving || trackAnim.isTurningInPlace) {
        // Track color: slightly different from body to indicate movement
        const trackColor = 0x888888;
        const trackAlpha = 0.6;

        // Left track marker (perpendicular to body angle, left side)
        const perpAngle = bodyAngle - Math.PI / 2;
        const trackOffset = halfH * 0.8; // Offset from center to track position
        const trackLen = halfW * 0.3;

        // Left track
        const ltx = cx + Math.cos(perpAngle) * trackOffset;
        const lty = cy + Math.sin(perpAngle) * trackOffset;
        g.lineStyle(2, trackColor, trackAlpha);
        g.beginPath();
        g.moveTo(ltx - Math.cos(bodyAngle) * trackLen, lty - Math.sin(bodyAngle) * trackLen);
        g.lineTo(ltx + Math.cos(bodyAngle) * trackLen, lty + Math.sin(bodyAngle) * trackLen);
        g.strokePath();

        // Right track
        const rtx = cx - Math.cos(perpAngle) * trackOffset;
        const rty = cy - Math.sin(perpAngle) * trackOffset;
        g.beginPath();
        g.moveTo(rtx - Math.cos(bodyAngle) * trackLen, rty - Math.sin(bodyAngle) * trackLen);
        g.lineTo(rtx + Math.cos(bodyAngle) * trackLen, rty + Math.sin(bodyAngle) * trackLen);
        g.strokePath();
      }
    }

    // ── Mount point circle (debug, on top face) ──────────────────
    if (this.showMountPoints) {
      // Place mount point on top face using shared mountTileOffset
      const mountScreen = projectWorldPoint(mountWorldX, mountWorldY, BLOCKOUT_VEHICLE_BODY_Z, this.offset);

      g.fillStyle(MOUNT_POINT_COLOR, 0.7);
      g.fillCircle(mountScreen.x, mountScreen.y, MOUNT_POINT_RADIUS);
      g.lineStyle(1, 0xff0000, 1);
      g.strokeCircle(mountScreen.x, mountScreen.y, MOUNT_POINT_RADIUS);
    }

    // ── BLOCKOUT-07H+: HP bar above vehicle ──────────────────────
    {
      const hpBarZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.15;
      const hpBarPos = projectWorldPoint(tilePos.x, tilePos.y, hpBarZ, this.offset);

      const hpRatio = vehicle.maxHp > 0 ? vehicle.hp / vehicle.maxHp : 0;
      const barWidth = halfW * PROJ_TILE_W + 4;
      const barHeight = 3;
      const barY = hpBarPos.y - 4;

      // Background (dark)
      g.fillStyle(0x333333, 0.7);
      g.fillRect(hpBarPos.x - barWidth / 2, barY, barWidth, barHeight);

      // HP fill (green > 60%, yellow 30-60%, red < 30%)
      let hpColor = 0x44ff44;
      if (hpRatio < 0.3) {
        hpColor = 0xff4444;
      } else if (hpRatio < 0.6) {
        hpColor = 0xffcc00;
      }
      const fillWidth = barWidth * Math.max(0, hpRatio);
      g.fillStyle(hpColor, 0.9);
      g.fillRect(hpBarPos.x - barWidth / 2, barY, fillWidth, barHeight);

      // ── CORE-STEP-08H+ FIXUP Blocker 5: Weapon resource bars ──
      // Show canister charge bar, overheat heat gauge, magazine stock
      // below the HP bar as thin colored bars. Blockout/procedural only.
      const rt = vehicle.weaponRuntime;
      let resourceBarY = barY + barHeight + 1; // Just below HP bar
      const resourceBarHeight = 2;

      // Canister bar (blue, Flamethrower/Freeze/Isida)
      if (rt.canister) {
        const cfg = getWeaponConfig(vehicle.weaponId); // already imported
        const capacity = cfg?.canister
          ? (cfg.canister.capacity[vehicle.modificationLevel] ?? cfg.canister.capacity[0])
          : 100;
        const canisterRatio = capacity > 0 ? rt.canister.current / capacity : 0;
        const canisterColor = rt.canister.isEmpty ? 0xff4444 : 0x4488ff; // Red if empty, blue otherwise

        g.fillStyle(0x333333, 0.5);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        g.fillStyle(canisterColor, 0.8);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * Math.max(0, canisterRatio), resourceBarHeight);
        resourceBarY += resourceBarHeight + 1;
      }

      // Overheat bar (orange/red, Vulcan)
      if (rt.overheat) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const maxHeat = cfg?.overheat?.maxHeat ?? 100;
        const heatRatio = maxHeat > 0 ? rt.overheat.heat / maxHeat : 0;
        const heatColor = rt.overheat.isOverheated ? 0xff2222 : 0xff8800; // Red if overheated, orange otherwise

        g.fillStyle(0x333333, 0.5);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        g.fillStyle(heatColor, 0.8);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * Math.max(0, heatRatio), resourceBarHeight);
        resourceBarY += resourceBarHeight + 1;
      }

      // Magazine bar (yellow, Ricochet)
      if (rt.magazine) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const stockSize = cfg?.magazine
          ? (cfg.magazine.stockSize[vehicle.modificationLevel] ?? cfg.magazine.stockSize[0])
          : 5;
        const magRatio = stockSize > 0 ? rt.magazine.currentStock / stockSize : 0;
        const magColor = rt.magazine.isEmpty ? 0xff4444 : 0xcccc00; // Red if empty, yellow otherwise

        g.fillStyle(0x333333, 0.5);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        g.fillStyle(magColor, 0.8);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * Math.max(0, magRatio), resourceBarHeight);
        resourceBarY += resourceBarHeight + 1;
      }

      // Drum reload indicator (purple, Hammer) — thin bar showing reload progress
      if (rt.drum && rt.drum.isReloading) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const reloadMs = cfg?.drum
          ? (cfg.drum.reloadMs[vehicle.modificationLevel] ?? cfg.drum.reloadMs[0])
          : 3000;
        const nowMs = this.scene.time.now;
        const elapsed = nowMs - rt.drum.reloadStartedAt;
        const reloadRatio = reloadMs > 0 ? Math.min(1, elapsed / reloadMs) : 0;

        g.fillStyle(0x333333, 0.5);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        g.fillStyle(0xaa44ff, 0.8); // Purple for drum reload
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * reloadRatio, resourceBarHeight);
      }

      // Wind-up indicator (cyan charge, Railgun) — thin pulsing line while charging
      if (rt.windUp && rt.windUp.isCharging) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const windUpMs = cfg?.windUp
          ? (cfg.windUp[vehicle.modificationLevel] ?? cfg.windUp[0])
          : 1500;
        const nowMs = this.scene.time.now;
        const elapsed = nowMs - rt.windUp.startedAt;
        const chargeRatio = windUpMs > 0 ? Math.min(1, elapsed / windUpMs) : 0;

        g.fillStyle(0x333333, 0.5);
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        g.fillStyle(0x00ffff, 0.9); // Cyan for wind-up
        g.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * chargeRatio, resourceBarHeight);
      }
    }

    // ── BLOCKOUT-07H+: Damage flash ──────────────────────────────
    {
      const nowMs = this.scene.time.now;
      if (nowMs < vehicle.damageFlashUntil) {
        // White overlay on top face
        const cosA = Math.cos(bodyAngle);
        const sinA = Math.sin(bodyAngle);
        const localCorners = [
          { lx: -halfW, ly: -halfH },
          { lx: halfW, ly: -halfH },
          { lx: halfW, ly: halfH },
          { lx: -halfW, ly: halfH },
        ];
        const topPts = localCorners.map(c => {
          const wx = tilePos.x + c.lx * cosA - c.ly * sinA;
          const wy = tilePos.y + c.lx * sinA + c.ly * cosA;
          return projectWorldPoint(wx, wy, BLOCKOUT_VEHICLE_BODY_Z, this.offset);
        });
        g.fillStyle(0xffffff, 0.4);
        g.beginPath();
        g.moveTo(topPts[0].x, topPts[0].y);
        for (let i = 1; i < topPts.length; i++) {
          g.lineTo(topPts[i].x, topPts[i].y);
        }
        g.closePath();
        g.fillPath();
      }
    }

    // ── Turret + Barrel (on top face, using basisZ) ──────────────
    // Uses shared mountTileOffset from computeProjectedBlockoutVehicleGeometry
    // to ensure visual mount equals logical mount used by input/fire/damage.
    {
      // Turret position on top face (shared mountWorldX/Y from above)
      const turretZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET;

      // Draw turret as small projected box on top face
      const turretHeight = BLOCKOUT_TURRET_BOX_HEIGHT;
      const turretCosA = Math.cos(effectiveTurretAngle);
      const turretSinA = Math.sin(effectiveTurretAngle);
      const turretLocalCorners = [
        { lx: -turretHalfW, ly: -turretHalfH },
        { lx: turretHalfW, ly: -turretHalfH },
        { lx: turretHalfW, ly: turretHalfH },
        { lx: -turretHalfW, ly: turretHalfH },
      ];

      // Turret base (on body top)
      const turretBasePts = turretLocalCorners.map(c => {
        const wx = mountWorldX + c.lx * turretCosA - c.ly * turretSinA;
        const wy = mountWorldY + c.lx * turretSinA + c.ly * turretCosA;
        return projectWorldPoint(wx, wy, turretZ, this.offset);
      });

      // Turret top
      const turretTopPts = turretLocalCorners.map(c => {
        const wx = mountWorldX + c.lx * turretCosA - c.ly * turretSinA;
        const wy = mountWorldY + c.lx * turretSinA + c.ly * turretCosA;
        return projectWorldPoint(wx, wy, turretZ + turretHeight, this.offset);
      });

      // Barrel screen positions from shared geometry (PROJECTION-01 fixup #3).
      // No local recomputation — barrelTipScreen and barrelStartScreen are the
      // single source of truth used by both renderer and fire/damage logic,
      // including body recoil impulse, barrel Z, and all recoil offsets.

      // Turret side face (left: base[3]→base[0] → top[3]→top[0])
      g.fillStyle(turretColor, 0.7);
      g.beginPath();
      g.moveTo(turretBasePts[3].x, turretBasePts[3].y);
      g.lineTo(turretBasePts[0].x, turretBasePts[0].y);
      g.lineTo(turretTopPts[0].x, turretTopPts[0].y);
      g.lineTo(turretTopPts[3].x, turretTopPts[3].y);
      g.closePath();
      g.fillPath();

      // Turret side face (right: base[0]→base[1] → top[0]→top[1])
      g.fillStyle(turretColor, 0.6);
      g.beginPath();
      g.moveTo(turretBasePts[0].x, turretBasePts[0].y);
      g.lineTo(turretBasePts[1].x, turretBasePts[1].y);
      g.lineTo(turretTopPts[1].x, turretTopPts[1].y);
      g.lineTo(turretTopPts[0].x, turretTopPts[0].y);
      g.closePath();
      g.fillPath();

      // Turret top face
      g.fillStyle(turretColor, 1);
      g.beginPath();
      g.moveTo(turretTopPts[0].x, turretTopPts[0].y);
      for (let i = 1; i < turretTopPts.length; i++) {
        g.lineTo(turretTopPts[i].x, turretTopPts[i].y);
      }
      g.closePath();
      g.fillPath();

      // Turret outline
      const turretOutlineWidth = isSelected ? 2 : 1;
      g.lineStyle(turretOutlineWidth, TURRET_OUTLINE_COLOR, 1);
      g.beginPath();
      g.moveTo(turretTopPts[0].x, turretTopPts[0].y);
      for (let i = 1; i < turretTopPts.length; i++) {
        g.lineTo(turretTopPts[i].x, turretTopPts[i].y);
      }
      g.closePath();
      g.strokePath();

      // Barrel line (using shared barrelStartScreen/barrelTipScreen — PROJECTION-01 fixup #3)
      g.lineStyle(barrelWidth, BARREL_COLOR, 1);
      g.beginPath();
      g.moveTo(barrelStartScreen.x, barrelStartScreen.y);
      g.lineTo(barrelTipScreen.x, barrelTipScreen.y);
      g.strokePath();

      // ── Aim line for selected vehicle ─────────────────────────────
      if (isSelected) {
        g.lineStyle(1.5, AIM_LINE_COLOR, AIM_LINE_ALPHA);
        const aimTileLength = AIM_LINE_LENGTH / PROJ_TILE_W;
        // Aim starts at shared barrel tip (PROJECTION-01 fixup #3)
        const aimStart = barrelTipScreen;
        const aimEndWorld = {
          x: mountWorldX + (turretHalfW + effectiveBarrelLength + aimTileLength) * turretCosA,
          y: mountWorldY + (turretHalfW + effectiveBarrelLength + aimTileLength) * turretSinA,
        };
        const aimEnd = projectWorldPoint(aimEndWorld.x, aimEndWorld.y, barrelZ, this.offset);

        // Draw dashed aim line
        const dashLen = AIM_LINE_DASH;
        const gapLen = AIM_LINE_GAP;
        const dx = aimEnd.x - aimStart.x;
        const dy = aimEnd.y - aimStart.y;
        const totalLen = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / totalLen;
        const uy = dy / totalLen;

        let pos = 0;
        while (pos < totalLen) {
          const segEnd = Math.min(pos + dashLen, totalLen);
          g.beginPath();
          g.moveTo(aimStart.x + ux * pos, aimStart.y + uy * pos);
          g.lineTo(aimStart.x + ux * segEnd, aimStart.y + uy * segEnd);
          g.strokePath();
          pos = segEnd + gapLen;
        }
      }
    }
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
