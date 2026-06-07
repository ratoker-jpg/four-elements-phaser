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
 * RUNTIME-TURRET-02: Generated turret sprite integration.
 * - When a generated turret texture exists, it replaces the procedural
 *   turret box + barrel line with a sprite Image.
 * - When no generated turret texture exists (e.g. shaft, not loaded),
 *   the procedural turret box + barrel line remains as fallback.
 * - Turret sprites are layered above hull sprites / body.
 * - HP/resource bars and UI overlays render above turret sprites
 *   via a separate overlay Graphics object.
 *
 * Layering (bottom to top):
 *   base Graphics (shadow, rings, body, turret) → hull sprite →
 *   turret sprite → overlay Graphics (HP bars, indicators, aim line) → labels
 *
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
import {
  resolveGeneratedHullKey,
  bodyIdToGeneratedHullId,
  getGeneratedHullVisualProfile,
  DEFAULT_GENERATED_HULL_VISUAL_PROFILE,
  type GeneratedHullVisualProfile,
} from '../../assets/generatedHullAssets';
import {
  resolveGeneratedTurretKey,
  GENERATED_TURRET_SCALE,
  GENERATED_TURRET_ORIGIN_X,
  GENERATED_TURRET_ORIGIN_Y,
} from '../../assets/generatedTurretAssets';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout vehicles (above terrain, coexisting with entities). */
const BLOCKOUT_DEPTH = 120;

/** Depth offset for generated turret sprites (above hull, below overlay). */
const TURRET_SPRITE_DEPTH_OFFSET = 0.1;

/** Depth offset for overlay Graphics (HP bars, indicators; above turret sprite). */
const OVERLAY_DEPTH_OFFSET = 0.2;

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

  /** Base graphics objects keyed by blockout vehicle ID (shadow, rings, body, turret). */
  private vehicleGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Overlay graphics objects keyed by blockout vehicle ID (HP bars, indicators, aim line). */
  private vehicleOverlayGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Generated hull sprite images keyed by blockout vehicle ID. */
  private vehicleHullSprites = new Map<string, Phaser.GameObjects.Image>();

  /** Generated turret sprite images keyed by blockout vehicle ID. */
  private vehicleTurretSprites = new Map<string, Phaser.GameObjects.Image>();

  /** Debug text labels keyed by blockout vehicle ID. */
  private debugLabels = new Map<string, Phaser.GameObjects.Text>();

  /** Whether debug labels are shown. */
  private showDebugLabels = true;

  /** Whether mount points are shown. */
  private showMountPoints = true;

  /** Whether generated hull sprites have been logged (once). */
  private generatedHullLogged = false;

  /** Whether blockout fallback has been logged (once). */
  private blockoutFallbackLogged = false;

  /** Whether generated turret sprites have been logged (once). */
  private generatedTurretLogged = false;

  /** Whether blockout turret fallback has been logged (once). */
  private blockoutTurretFallbackLogged = false;

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

      let og = this.vehicleOverlayGraphics.get(vehicle.id);
      if (!og) {
        og = this.scene.add.graphics();
        og.setDepth(BLOCKOUT_DEPTH);
        this.vehicleOverlayGraphics.set(vehicle.id, og);
      }

      // Determine selection/hover state for this vehicle
      const isSelected = vehicle.id === this._selectedVehicleId;
      const isHovered = vehicle.id === this._hoveredVehicleId;

      // Check for generated hull sprite
      const hullKey = resolveGeneratedHullKey(
        this.scene, vehicle.bodyId, vehicle.faction,
        vehicle.modificationLevel, vehicle.bodyAngle,
      );
      const useGeneratedHull = hullKey !== null;

      // Resolve per-hull visual profile (HULL-VISUAL-FIXUP-02)
      const hullId = bodyIdToGeneratedHullId(vehicle.bodyId);
      const hullProfile: GeneratedHullVisualProfile = hullId
        ? getGeneratedHullVisualProfile(hullId)
        : DEFAULT_GENERATED_HULL_VISUAL_PROFILE;

      // Manage hull sprite lifecycle
      let hullSprite = this.vehicleHullSprites.get(vehicle.id);
      if (useGeneratedHull) {
        if (!hullSprite) {
          // Create hull sprite image using per-hull profile
          hullSprite = this.scene.add.image(0, 0, hullKey);
          hullSprite.setScale(hullProfile.scale);
          hullSprite.setOrigin(hullProfile.originX, hullProfile.originY);
          hullSprite.setDepth(BLOCKOUT_DEPTH);
          this.vehicleHullSprites.set(vehicle.id, hullSprite);

          if (!this.generatedHullLogged) {
            console.log(`[BlockoutVehicleRenderer] Using generated hull sprite for ${vehicle.bodyId}+${vehicle.weaponId} (${vehicle.faction}, m${vehicle.modificationLevel})`);
            this.generatedHullLogged = true;
          }
        } else {
          // Update texture if direction changed; also re-apply profile
          hullSprite.setTexture(hullKey);
          hullSprite.setScale(hullProfile.scale);
          hullSprite.setOrigin(hullProfile.originX, hullProfile.originY);
        }
      } else {
        // No generated hull — destroy sprite if it exists
        if (hullSprite) {
          hullSprite.destroy();
          this.vehicleHullSprites.delete(vehicle.id);
        }
        if (!this.blockoutFallbackLogged) {
          console.log(`[BlockoutVehicleRenderer] No generated hull texture for ${vehicle.bodyId}+${vehicle.weaponId} — using blockout cube fallback`);
          this.blockoutFallbackLogged = true;
        }
      }

      // Check for generated turret sprite
      const turretKey = resolveGeneratedTurretKey(
        this.scene, vehicle.weaponId, vehicle.faction,
        vehicle.modificationLevel, vehicle.turretAngle,
      );
      const useGeneratedTurret = turretKey !== null;

      // Manage turret sprite lifecycle
      let turretSprite = this.vehicleTurretSprites.get(vehicle.id);
      if (useGeneratedTurret) {
        if (!turretSprite) {
          // Create turret sprite image
          turretSprite = this.scene.add.image(0, 0, turretKey);
          turretSprite.setScale(GENERATED_TURRET_SCALE);
          turretSprite.setOrigin(GENERATED_TURRET_ORIGIN_X, GENERATED_TURRET_ORIGIN_Y);
          turretSprite.setDepth(BLOCKOUT_DEPTH);
          this.vehicleTurretSprites.set(vehicle.id, turretSprite);

          if (!this.generatedTurretLogged) {
            console.log(`[BlockoutVehicleRenderer] Using generated turret sprite for ${vehicle.bodyId}+${vehicle.weaponId} (${vehicle.faction}, m${vehicle.modificationLevel})`);
            this.generatedTurretLogged = true;
          }
        } else {
          // Update texture if direction changed
          turretSprite.setTexture(turretKey);
        }
      } else {
        // No generated turret — destroy sprite if it exists (fallback to procedural)
        if (turretSprite) {
          turretSprite.destroy();
          this.vehicleTurretSprites.delete(vehicle.id);
        }
        if (!this.blockoutTurretFallbackLogged) {
          console.log(`[BlockoutVehicleRenderer] No generated turret texture for ${vehicle.bodyId}+${vehicle.weaponId} — using blockout/procedural turret fallback`);
          this.blockoutTurretFallbackLogged = true;
        }
      }

      // Redraw this vehicle
      // Base graphics: shadow, rings, body, turret box/barrel
      // Overlay graphics: HP bars, resource bars, indicators, aim line, damage flash
      this.renderVehicle(g, og, vehicle, isSelected, isHovered, useGeneratedHull, hullSprite, hullProfile, useGeneratedTurret, turretSprite);

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
        // HULL-VISUAL-FIXUP-02: lift label above generated hull when active
        const labelZ = vehicle.isDestroyed ? 0 : BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.1;
        const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, this.offset);
        const labelPos = projectWorldPoint(tilePos.x, tilePos.y, labelZ, this.offset);
        const labelUiLift = (useGeneratedHull && !vehicle.isDestroyed) ? hullProfile.uiOffsetY : 0;
        label.setPosition(labelPos.x, labelPos.y - labelUiLift);
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

    // Apply depth to each vehicle's graphics objects
    for (const vehicle of vehicles) {
      const orderIdx = depthOrder.get(vehicle.id);

      // Base graphics: shadow, rings, body, procedural turret
      const g = this.vehicleGraphics.get(vehicle.id);
      if (g && orderIdx !== undefined) {
        g.setDepth(BLOCKOUT_DEPTH + orderIdx);
      }

      // Hull sprite: same depth as base graphics
      const hullSprite = this.vehicleHullSprites.get(vehicle.id);
      if (hullSprite && orderIdx !== undefined) {
        hullSprite.setDepth(BLOCKOUT_DEPTH + orderIdx);
      }

      // Turret sprite: above hull, below overlay
      const turretSprite = this.vehicleTurretSprites.get(vehicle.id);
      if (turretSprite && orderIdx !== undefined) {
        turretSprite.setDepth(BLOCKOUT_DEPTH + orderIdx + TURRET_SPRITE_DEPTH_OFFSET);
      }

      // Overlay graphics: above turret sprite (HP bars, indicators, aim line)
      const og = this.vehicleOverlayGraphics.get(vehicle.id);
      if (og && orderIdx !== undefined) {
        og.setDepth(BLOCKOUT_DEPTH + orderIdx + OVERLAY_DEPTH_OFFSET);
      }

      // Debug label: above everything
      const label = this.debugLabels.get(vehicle.id);
      if (label && orderIdx !== undefined) {
        label.setDepth(BLOCKOUT_DEPTH + orderIdx + 1);
      }
    }

    // Clean up stale vehicles
    for (const [id, g] of this.vehicleGraphics) {
      if (!activeIds.has(id)) {
        g.destroy();
        this.vehicleGraphics.delete(id);
      }
    }
    for (const [id, og] of this.vehicleOverlayGraphics) {
      if (!activeIds.has(id)) {
        og.destroy();
        this.vehicleOverlayGraphics.delete(id);
      }
    }
    for (const [id, hullSprite] of this.vehicleHullSprites) {
      if (!activeIds.has(id)) {
        hullSprite.destroy();
        this.vehicleHullSprites.delete(id);
      }
    }
    for (const [id, turretSprite] of this.vehicleTurretSprites) {
      if (!activeIds.has(id)) {
        turretSprite.destroy();
        this.vehicleTurretSprites.delete(id);
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

  private renderVehicle(
    g: Phaser.GameObjects.Graphics,
    og: Phaser.GameObjects.Graphics,
    vehicle: BlockoutVehicleState,
    isSelected: boolean,
    isHovered: boolean,
    useGeneratedHull: boolean,
    hullSprite: Phaser.GameObjects.Image | undefined,
    hullProfile: GeneratedHullVisualProfile,
    useGeneratedTurret: boolean,
    turretSprite: Phaser.GameObjects.Image | undefined,
  ): void {
    g.clear();
    og.clear();

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
      const ringEdgeDist = SELECTION_RING_WORLD_RADIUS * 38;
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
      g.lineStyle(2, 0xff4444, alpha);
      drawProjectedGroundRing(g, cx, cy, SELECTION_RING_WORLD_RADIUS, this.offset, 24);

      const crossSize = 0.12;
      g.lineStyle(1.5, 0xff4444, alpha);
      drawProjectedCrosshair(g, cx, cy, crossSize, this.offset);
    }

    // ── CORE-STEP-07H+: Target-lock status indicator (overlay — above turret) ──
    if (vehicle.targetVehicleId && !vehicle.isDestroyed) {
      const lockIndicatorZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.3;
      const tilePosLocal = unprojectScreenToGround(cx, cy, this.offset);
      const lockPos = projectWorldPoint(tilePosLocal.x, tilePosLocal.y, lockIndicatorZ, this.offset);
      og.fillStyle(0xffcc00, 0.9);
      og.fillCircle(lockPos.x, lockPos.y, 3);
    }

    // ── ARENA-03H+: Enemy team indicator (overlay — above turret) ──
    if (vehicle.team === 'enemy' && !vehicle.isDestroyed) {
      const indicatorZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.2;
      const indicatorPos = projectWorldPoint(tilePos.x, tilePos.y, indicatorZ, this.offset);
      const indicatorSize = 0.08;
      og.lineStyle(1, 0xff4444, 0.7);
      drawProjectedGroundDiamond(og, indicatorPos.x, indicatorPos.y, indicatorSize, this.offset);
    }

    // ── BLOCKOUT-07H+: Destroyed vehicle rendering ────────────────
    if (vehicle.isDestroyed) {
      // Hide hull sprite for destroyed vehicles
      if (hullSprite) {
        hullSprite.setVisible(false);
      }
      // Hide turret sprite for destroyed vehicles
      if (turretSprite) {
        turretSprite.setVisible(false);
      }

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

      return;
    }

    // ── Vehicle shadow (projected ground-plane) ──────────────────
    const shadowRadius = Math.max(halfW, halfH) * SHADOW_RADIUS_FRACTION;
    drawProjectedShadow(g, cx, cy, shadowRadius, this.offset);

    // ── Hull rendering: generated sprite OR blockout cube ─────────
    if (useGeneratedHull && hullSprite) {
      // HULL-VISUAL-FIXUP-02: position using per-hull profile offset
      hullSprite.setPosition(cx + hullProfile.offsetX, cy + hullProfile.offsetY);
      hullSprite.setVisible(true);
    } else {
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

      // Track animation indicators
      {
        const trackAnim = getTrackAnimationState(vehicle);
        if (trackAnim.isMoving || trackAnim.isTurningInPlace) {
        const trackColor = 0x888888;
        const trackAlpha = 0.6;

        const perpAngle = bodyAngle - Math.PI / 2;
        const trackOffset = halfH * 0.8;
        const trackLen = halfW * 0.3;

        const ltx = cx + Math.cos(perpAngle) * trackOffset;
        const lty = cy + Math.sin(perpAngle) * trackOffset;
        g.lineStyle(2, trackColor, trackAlpha);
        g.beginPath();
        g.moveTo(ltx - Math.cos(bodyAngle) * trackLen, lty - Math.sin(bodyAngle) * trackLen);
        g.lineTo(ltx + Math.cos(bodyAngle) * trackLen, lty + Math.sin(bodyAngle) * trackLen);
        g.strokePath();

        const rtx = cx - Math.cos(perpAngle) * trackOffset;
        const rty = cy - Math.sin(perpAngle) * trackOffset;
        g.beginPath();
        g.moveTo(rtx - Math.cos(bodyAngle) * trackLen, rty - Math.sin(bodyAngle) * trackLen);
        g.lineTo(rtx + Math.cos(bodyAngle) * trackLen, rty + Math.sin(bodyAngle) * trackLen);
        g.strokePath();
      }
    }
    } // end else (legacy blockout cube path)

    // ── Mount point circle (debug, on top face) ──────────────────
    if (this.showMountPoints) {
      const mountScreen = projectWorldPoint(mountWorldX, mountWorldY, BLOCKOUT_VEHICLE_BODY_Z, this.offset);

      g.fillStyle(MOUNT_POINT_COLOR, 0.7);
      g.fillCircle(mountScreen.x, mountScreen.y, MOUNT_POINT_RADIUS);
      g.lineStyle(1, 0xff0000, 1);
      g.strokeCircle(mountScreen.x, mountScreen.y, MOUNT_POINT_RADIUS);
    }

    // ── Turret + Barrel (on top face, using basisZ) ──────────────
    {
      const turretZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET;
      const turretCosA = Math.cos(effectiveTurretAngle);
      const turretSinA = Math.sin(effectiveTurretAngle);

      if (useGeneratedTurret && turretSprite) {
        // ── Generated turret sprite path ────────────────────────────
        const turretMountScreen = projectWorldPoint(mountWorldX, mountWorldY, turretZ, this.offset);
        turretSprite.setPosition(turretMountScreen.x, turretMountScreen.y);
        turretSprite.setVisible(true);
        // Procedural turret box and barrel are NOT drawn — the turret sprite replaces them.
      } else {
        // ── Legacy blockout/procedural turret path ─────────────────
        const turretHeight = BLOCKOUT_TURRET_BOX_HEIGHT;
        const turretLocalCorners = [
          { lx: -turretHalfW, ly: -turretHalfH },
          { lx: turretHalfW, ly: -turretHalfH },
          { lx: turretHalfW, ly: turretHalfH },
          { lx: -turretHalfW, ly: turretHalfH },
        ];

        const turretBasePts = turretLocalCorners.map(c => {
          const wx = mountWorldX + c.lx * turretCosA - c.ly * turretSinA;
          const wy = mountWorldY + c.lx * turretSinA + c.ly * turretCosA;
          return projectWorldPoint(wx, wy, turretZ, this.offset);
        });

        const turretTopPts = turretLocalCorners.map(c => {
          const wx = mountWorldX + c.lx * turretCosA - c.ly * turretSinA;
          const wy = mountWorldY + c.lx * turretSinA + c.ly * turretCosA;
          return projectWorldPoint(wx, wy, turretZ + turretHeight, this.offset);
        });

        // Turret side face (left)
        g.fillStyle(turretColor, 0.7);
        g.beginPath();
        g.moveTo(turretBasePts[3].x, turretBasePts[3].y);
        g.lineTo(turretBasePts[0].x, turretBasePts[0].y);
        g.lineTo(turretTopPts[0].x, turretTopPts[0].y);
        g.lineTo(turretTopPts[3].x, turretTopPts[3].y);
        g.closePath();
        g.fillPath();

        // Turret side face (right)
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

        // Barrel line
        g.lineStyle(barrelWidth, BARREL_COLOR, 1);
        g.beginPath();
        g.moveTo(barrelStartScreen.x, barrelStartScreen.y);
        g.lineTo(barrelTipScreen.x, barrelTipScreen.y);
        g.strokePath();
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // OVERLAY (og): HP bar, resource bars, damage flash, aim line
    // These render ABOVE turret sprites via OVERLAY_DEPTH_OFFSET.
    // ═══════════════════════════════════════════════════════════════

    // ── BLOCKOUT-07H+: HP bar above vehicle ──────────────────────
    {
      // HULL-VISUAL-FIXUP-02: when generated hull is active, lift the
      // HP bar and resource bars above the hull sprite using uiOffsetY,
      // and widen the bar to match the hull's visual footprint.
      const hpBarZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.15;
      const hpBarPos = projectWorldPoint(tilePos.x, tilePos.y, hpBarZ, this.offset);
      const uiLift = useGeneratedHull ? hullProfile.uiOffsetY : 0;

      const hpRatio = vehicle.maxHp > 0 ? vehicle.hp / vehicle.maxHp : 0;
      const barWidth = useGeneratedHull
        ? 512 * hullProfile.scale * 0.7   // wider bar matching hull visual width
        : halfW * PROJ_TILE_W + 4;        // blockout default
      const barHeight = 3;
      const barY = hpBarPos.y - 4 - uiLift;

      // Background (dark)
      og.fillStyle(0x333333, 0.7);
      og.fillRect(hpBarPos.x - barWidth / 2, barY, barWidth, barHeight);

      // HP fill (green > 60%, yellow 30-60%, red < 30%)
      let hpColor = 0x44ff44;
      if (hpRatio < 0.3) {
        hpColor = 0xff4444;
      } else if (hpRatio < 0.6) {
        hpColor = 0xffcc00;
      }
      const fillWidth = barWidth * Math.max(0, hpRatio);
      og.fillStyle(hpColor, 0.9);
      og.fillRect(hpBarPos.x - barWidth / 2, barY, fillWidth, barHeight);

      // Weapon resource bars
      const rt = vehicle.weaponRuntime;
      let resourceBarY = barY + barHeight + 1;
      const resourceBarHeight = 2;

      if (rt.canister) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const capacity = cfg?.canister
          ? (cfg.canister.capacity[vehicle.modificationLevel] ?? cfg.canister.capacity[0])
          : 100;
        const canisterRatio = capacity > 0 ? rt.canister.current / capacity : 0;
        const canisterColor = rt.canister.isEmpty ? 0xff4444 : 0x4488ff;

        og.fillStyle(0x333333, 0.5);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        og.fillStyle(canisterColor, 0.8);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * Math.max(0, canisterRatio), resourceBarHeight);
        resourceBarY += resourceBarHeight + 1;
      }

      if (rt.overheat) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const maxHeat = cfg?.overheat?.maxHeat ?? 100;
        const heatRatio = maxHeat > 0 ? rt.overheat.heat / maxHeat : 0;
        const heatColor = rt.overheat.isOverheated ? 0xff2222 : 0xff8800;

        og.fillStyle(0x333333, 0.5);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        og.fillStyle(heatColor, 0.8);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * Math.max(0, heatRatio), resourceBarHeight);
        resourceBarY += resourceBarHeight + 1;
      }

      if (rt.magazine) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const stockSize = cfg?.magazine
          ? (cfg.magazine.stockSize[vehicle.modificationLevel] ?? cfg.magazine.stockSize[0])
          : 5;
        const magRatio = stockSize > 0 ? rt.magazine.currentStock / stockSize : 0;
        const magColor = rt.magazine.isEmpty ? 0xff4444 : 0xcccc00;

        og.fillStyle(0x333333, 0.5);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        og.fillStyle(magColor, 0.8);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * Math.max(0, magRatio), resourceBarHeight);
        resourceBarY += resourceBarHeight + 1;
      }

      if (rt.drum && rt.drum.isReloading) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const reloadMs = cfg?.drum
          ? (cfg.drum.reloadMs[vehicle.modificationLevel] ?? cfg.drum.reloadMs[0])
          : 3000;
        const nowMs = this.scene.time.now;
        const elapsed = nowMs - rt.drum.reloadStartedAt;
        const reloadRatio = reloadMs > 0 ? Math.min(1, elapsed / reloadMs) : 0;

        og.fillStyle(0x333333, 0.5);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        og.fillStyle(0xaa44ff, 0.8);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * reloadRatio, resourceBarHeight);
      }

      if (rt.windUp && rt.windUp.isCharging) {
        const cfg = getWeaponConfig(vehicle.weaponId);
        const windUpMs = cfg?.windUp
          ? (cfg.windUp[vehicle.modificationLevel] ?? cfg.windUp[0])
          : 1500;
        const nowMs = this.scene.time.now;
        const elapsed = nowMs - rt.windUp.startedAt;
        const chargeRatio = windUpMs > 0 ? Math.min(1, elapsed / windUpMs) : 0;

        og.fillStyle(0x333333, 0.5);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth, resourceBarHeight);
        og.fillStyle(0x00ffff, 0.9);
        og.fillRect(hpBarPos.x - barWidth / 2, resourceBarY, barWidth * chargeRatio, resourceBarHeight);
      }
    }

    // ── BLOCKOUT-07H+: Damage flash (overlay — above turret) ─────
    {
      const nowMs = this.scene.time.now;
      if (nowMs < vehicle.damageFlashUntil) {
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
        og.fillStyle(0xffffff, 0.4);
        og.beginPath();
        og.moveTo(topPts[0].x, topPts[0].y);
        for (let i = 1; i < topPts.length; i++) {
          og.lineTo(topPts[i].x, topPts[i].y);
        }
        og.closePath();
        og.fillPath();
      }
    }

    // ── Aim line for selected vehicle (overlay — above turret) ────
    if (isSelected) {
      og.lineStyle(1.5, AIM_LINE_COLOR, AIM_LINE_ALPHA);
      const aimTileLength = AIM_LINE_LENGTH / PROJ_TILE_W;
      const aimStart = barrelTipScreen;
      const turretCosA = Math.cos(effectiveTurretAngle);
      const turretSinA = Math.sin(effectiveTurretAngle);
      const aimEndWorld = {
        x: mountWorldX + (turretHalfW + effectiveBarrelLength + aimTileLength) * turretCosA,
        y: mountWorldY + (turretHalfW + effectiveBarrelLength + aimTileLength) * turretSinA,
      };
      const aimEnd = projectWorldPoint(aimEndWorld.x, aimEndWorld.y, barrelZ, this.offset);

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
        og.beginPath();
        og.moveTo(aimStart.x + ux * pos, aimStart.y + uy * pos);
        og.lineTo(aimStart.x + ux * segEnd, aimStart.y + uy * segEnd);
        og.strokePath();
        pos = segEnd + gapLen;
      }
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    for (const [, g] of this.vehicleGraphics) {
      g.destroy();
    }
    this.vehicleGraphics.clear();

    for (const [, og] of this.vehicleOverlayGraphics) {
      og.destroy();
    }
    this.vehicleOverlayGraphics.clear();

    for (const [, hullSprite] of this.vehicleHullSprites) {
      hullSprite.destroy();
    }
    this.vehicleHullSprites.clear();

    for (const [, turretSprite] of this.vehicleTurretSprites) {
      turretSprite.destroy();
    }
    this.vehicleTurretSprites.clear();

    for (const [, label] of this.debugLabels) {
      label.destroy();
    }
    this.debugLabels.clear();
  }
}
