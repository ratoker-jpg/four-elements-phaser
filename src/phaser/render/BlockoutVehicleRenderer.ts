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
import { getBodyProfile } from '../../config/blockoutBodyData';
import { getWeaponProfile } from '../../config/blockoutWeaponData';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { SHAPE_SIZE_MAP, computeMountPixelOffset, computeBodyWorldCenter } from './blockoutVehicleGeometry';
import {
  drawProjectedGroundRing,
  drawProjectedGroundDiamond,
  drawProjectedShadow,
  drawProjectedBox,
  drawProjectedCrosshair,
} from './projectedGroundPrimitives';
import { projectWorldPoint, unprojectScreenToGround } from '../../config/cameraProjectionContract';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout vehicles (above terrain, coexisting with entities). */
const BLOCKOUT_DEPTH = 120;

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

// ─── Isometric box height ───────────────────────────────────────────

/** Vehicle body height in world Z units for pseudo-isometric rendering. */
const VEHICLE_BODY_HEIGHT = 0.25;

/** Turret height offset in world Z units above body top. */
const TURRET_Z_OFFSET = 0.05;

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
        const bodyCenter = computeBodyWorldCenter(vehicle, this.offset);

        const selectedMarker = isSelected ? ' [SEL]' : '';
        const speedMarker = vehicle.speed > 1 ? ` v=${Math.round(vehicle.speed)}` : '';
        const hpMarker = vehicle.isDestroyed ? ' [DEAD]' : ` hp=${vehicle.hp}/${vehicle.maxHp}`;
        label.setText(`${vehicle.bodyId}+${vehicle.weaponId}${selectedMarker}${hpMarker}${speedMarker}`);

        // Position label above top face (body center + Z offset)
        const labelZ = vehicle.isDestroyed ? 0 : VEHICLE_BODY_HEIGHT + TURRET_Z_OFFSET + 0.1;
        const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, this.offset);
        const labelPos = projectWorldPoint(tilePos.x, tilePos.y, labelZ, this.offset);
        label.setPosition(labelPos.x, labelPos.y);
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

    // Convert body pixel dimensions to world/tile units for projected box
    // Approximate: bodySize is in pixels, we need tile units
    // Tile = 76x38 pixels. We use a simplified conversion:
    // halfW and halfH in tile units based on the pixel body size relative to tile
    const halfW = bodySize.w / 76; // body pixel width / tile width
    const halfH = bodySize.h / 76; // body pixel height / tile width (not tile height)

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

    // ── BLOCKOUT-07H+: Destroyed vehicle rendering ────────────────
    if (vehicle.isDestroyed) {
      // Dimmed flat body on ground (no height)
      const tilePos = unprojectScreenToGround(cx, cy, this.offset);
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

      // X marker over body
      g.lineStyle(2, 0xff0000, 0.8);
      const xSize = Math.min(bodySize.w, bodySize.h) / 2 - 2;
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
      g, cx, cy, halfW, halfH, VEHICLE_BODY_HEIGHT,
      this.offset, bodyAngle,
      bodyColor, sideColor, topColor, BODY_OUTLINE_COLOR,
      0.3, 0.75, 1.0,
    );

    // ── Mount point circle (debug, on top face) ──────────────────
    if (this.showMountPoints) {
      const mountOffset = computeMountPixelOffset(
        bodyProfile.mountCategory,
        bodySize.w,
        bodySize.h,
      );
      // Place mount point on top face at mount offset
      const tilePos = unprojectScreenToGround(cx, cy, this.offset);
      const cosA = Math.cos(bodyAngle);
      const sinA = Math.sin(bodyAngle);
      // Convert pixel offset to approximate tile offset
      const mountTileX = mountOffset.dx / 76;
      const mountTileY = mountOffset.dy / 76;
      const mountWorldX = tilePos.x + mountTileX * cosA - mountTileY * sinA;
      const mountWorldY = tilePos.y + mountTileX * sinA + mountTileY * cosA;
      const mountScreen = projectWorldPoint(mountWorldX, mountWorldY, VEHICLE_BODY_HEIGHT, this.offset);

      g.fillStyle(MOUNT_POINT_COLOR, 0.7);
      g.fillCircle(mountScreen.x, mountScreen.y, MOUNT_POINT_RADIUS);
      g.lineStyle(1, 0xff0000, 1);
      g.strokeCircle(mountScreen.x, mountScreen.y, MOUNT_POINT_RADIUS);
    }

    // ── BLOCKOUT-07H+: HP bar above vehicle ──────────────────────
    {
      const tilePos = unprojectScreenToGround(cx, cy, this.offset);
      const hpBarZ = VEHICLE_BODY_HEIGHT + TURRET_Z_OFFSET + 0.15;
      const hpBarPos = projectWorldPoint(tilePos.x, tilePos.y, hpBarZ, this.offset);

      const hpRatio = vehicle.maxHp > 0 ? vehicle.hp / vehicle.maxHp : 0;
      const barWidth = bodySize.w + 4;
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
    }

    // ── BLOCKOUT-07H+: Damage flash ──────────────────────────────
    {
      const nowMs = this.scene.time.now;
      if (nowMs < vehicle.damageFlashUntil) {
        // White overlay on top face
        const tilePos = unprojectScreenToGround(cx, cy, this.offset);
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
          return projectWorldPoint(wx, wy, VEHICLE_BODY_HEIGHT, this.offset);
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
    {
      const mountOffset = computeMountPixelOffset(
        bodyProfile.mountCategory,
        bodySize.w,
        bodySize.h,
      );
      // Convert pixel offset to approximate tile offset
      const mountTileX = mountOffset.dx / 76;
      const mountTileY = mountOffset.dy / 76;

      const tilePos = unprojectScreenToGround(cx, cy, this.offset);
      const cosA = Math.cos(bodyAngle);
      const sinA = Math.sin(bodyAngle);
      const mountWorldX = tilePos.x + mountTileX * cosA - mountTileY * sinA;
      const mountWorldY = tilePos.y + mountTileX * sinA + mountTileY * cosA;

      // Turret position on top face
      const turretZ = VEHICLE_BODY_HEIGHT + TURRET_Z_OFFSET;

      // BLOCKOUT-05H+: Include recoil turret kickback offset
      const recoilTurretOffset = vehicle.recoilTurretOffset ?? 0;
      const effectiveTurretAngle = turretAngle - recoilTurretOffset;

      // Draw turret as small projected box on top face
      const turretHalfW = (TURRET_SIZE.w / 2) / 76;
      const turretHalfH = (TURRET_SIZE.h / 2) / 76;
      const turretHeight = 0.08;
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

      // Barrel line from turret front on top face
      const barrelTileLength = barrelLength / 76;
      const barrelStartWorld = {
        x: mountWorldX + turretHalfW * turretCosA,
        y: mountWorldY + turretHalfW * turretSinA,
      };
      const barrelEndWorld = {
        x: mountWorldX + (turretHalfW + barrelTileLength) * turretCosA,
        y: mountWorldY + (turretHalfW + barrelTileLength) * turretSinA,
      };

      const recoilBarrelOffset = vehicle.recoilBarrelOffset ?? 0;
      const effectiveBarrelLength = Math.max(0, barrelTileLength - recoilBarrelOffset / 76);
      const effectiveBarrelEndWorld = {
        x: mountWorldX + (turretHalfW + effectiveBarrelLength) * turretCosA,
        y: mountWorldY + (turretHalfW + effectiveBarrelLength) * turretSinA,
      };

      const barrelStart = projectWorldPoint(barrelStartWorld.x, barrelStartWorld.y, turretZ + turretHeight * 0.5, this.offset);
      const barrelEnd = projectWorldPoint(effectiveBarrelEndWorld.x, effectiveBarrelEndWorld.y, turretZ + turretHeight * 0.5, this.offset);

      g.lineStyle(barrelWidth, BARREL_COLOR, 1);
      g.beginPath();
      g.moveTo(barrelStart.x, barrelStart.y);
      g.lineTo(barrelEnd.x, barrelEnd.y);
      g.strokePath();

      // ── Aim line for selected vehicle ─────────────────────────────
      if (isSelected) {
        g.lineStyle(1.5, AIM_LINE_COLOR, AIM_LINE_ALPHA);
        const aimTileLength = AIM_LINE_LENGTH / 76;
        const aimStartWorld = barrelEndWorld;
        const aimEndWorld = {
          x: mountWorldX + (turretHalfW + effectiveBarrelLength + aimTileLength) * turretCosA,
          y: mountWorldY + (turretHalfW + effectiveBarrelLength + aimTileLength) * turretSinA,
        };
        const aimStart = projectWorldPoint(aimStartWorld.x, aimStartWorld.y, turretZ + turretHeight * 0.5, this.offset);
        const aimEnd = projectWorldPoint(aimEndWorld.x, aimEndWorld.y, turretZ + turretHeight * 0.5, this.offset);

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
