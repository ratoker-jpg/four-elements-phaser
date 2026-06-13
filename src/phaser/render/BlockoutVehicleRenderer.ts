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
import {
  resolveGeneratedHullKey,
  resolveGeneratedHullKeyForced,
  resolveHullDirectionDiagnostic,
  bodyIdToGeneratedHullId,
  GENERATED_HULL_DIRECTIONS_16,
  getGeneratedHullTextureKey,
  resolveGeneratedHullFaction,
  modificationLevelToMod,
  GENERATED_HULL_SCALE,
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
  getGeneratedHullPlacementOffset,
  directionDebugEnabled,
  toggleDirectionDebug as toggleDirDebug,
  type GeneratedHullDir16Index,
} from '../../assets/generatedHullAssets';
import {
  isCalibrationActive,
  getForcedVisualDir16,
  isOverrideActive,
  isOverlayVisible as isCalibOverlayVisible,
  buildCalibrationOverlayText,
  type CalibrationOverlayParams,
} from '../debug/WaspHullDirectionCalibrator';
import {
  isPlacementActive as isWaspPlacementActive,
  isPlacementOverlayVisible as isWaspPlacementOverlayVisible,
  getDebugOffsetX as getWaspDebugOffsetX,
  getDebugOffsetY as getWaspDebugOffsetY,
  buildPlacementOverlayText,
  type PlacementOverlayParams,
} from '../debug/WaspHullPlacementCalibrator';
import { WaspPlacementCalibrationPanel } from '../debug/WaspPlacementCalibrationPanel';
import {
  resolveGeneratedTurretKey,
  getGeneratedTurretAssetBasis,
  GENERATED_TURRET_SOURCE_WIDTH,
  GENERATED_TURRET_SOURCE_HEIGHT,
  GENERATED_TURRET_SCALE,
} from '../../assets/generatedTurretAssets';
// MODULAR_RENDER_SCALE no longer used for turret sprites — generated turret uses GENERATED_TURRET_SCALE
import {
  resolveTurretSpriteMountingData,
  turretAngleToVisualDir16,
  type TurretSpriteMountingData,
} from '../../config/turretSpriteMountingAdapter';
import { resolveSocketNormForDir } from '../../config/turretAttachmentMath';
import {
  isTurretAnchorDebugEnabled,
  computeAnchorDiagnostic,
} from '../debug/turretAnchorDiagnostic';


// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout vehicles (above terrain, coexisting with entities). */
const BLOCKOUT_DEPTH = 120;

/**
 * EXPERIMENT-OPUS-B1B2-01 / B2:
 * Generated hull PNGs are hull-only. Turret/barrel graphics must render above them.
 * Keep the bias below 1 so inter-vehicle isometric ordering remains stable.
 */
const HULL_SPRITE_DEPTH_BIAS = -0.5;

/**
 * TURRET-HULL-CONTRACT-PR-F2:
 * Turret sprite images render above hull sprites. Small positive bias
 * ensures the turret is visually on top of the hull while keeping
 * inter-vehicle isometric ordering stable.
 */
const TURRET_SPRITE_DEPTH_BIAS = 0.5;

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

  /** Generated hull sprite images keyed by blockout vehicle ID. */
  private vehicleHullSprites = new Map<string, Phaser.GameObjects.Image>();

  /** TURRET-HULL-CONTRACT-PR-F2: Turret sprite images keyed by blockout vehicle ID. */
  private vehicleTurretSprites = new Map<string, Phaser.GameObjects.Image>();

  /** TURRET-HULL-CONTRACT-PR-F2: Whether turret sprite log has been emitted (once). */
  private turretSpriteLogged = false;

  /** TURRET-HULL-CONTRACT-PR-F2: Last resolved turret mounting data per vehicle.
   *  Captured in syncFromState so the anchor diagnostic (drawn in renderVehicle,
   *  after g.clear) can reuse the EXACT same runtime values the renderer used. */
  private lastMountingData = new Map<string, TurretSpriteMountingData>();

  /** TURRET-HULL-CONTRACT-PR-F2: ?turretAnchorDebug overlay — green "hull socket" labels. */
  private anchorHullLabels = new Map<string, Phaser.GameObjects.Text>();

  /** TURRET-HULL-CONTRACT-PR-F2: ?turretAnchorDebug overlay — red "turret pivot" labels. */
  private anchorTurretLabels = new Map<string, Phaser.GameObjects.Text>();

  /** TURRET-HULL-CONTRACT-PR-F2: ?turretAnchorDebug — vehicles whose diagnostic row was logged. */
  private anchorLoggedVehicles = new Set<string>();

  /** TURRET-HULL-CONTRACT-PR-F2: Whether ?turretAnchorDebug=1 is active (read once). */
  private readonly turretAnchorDebug = isTurretAnchorDebugEnabled();

  /** Direction debug text labels keyed by blockout vehicle ID. */
  private directionDebugLabels = new Map<string, Phaser.GameObjects.Text>();

  /** PIM-HULL-WASP-DIR-MAP-01: Calibration overlay text labels keyed by blockout vehicle ID. */
  private calibrationLabels = new Map<string, Phaser.GameObjects.Text>();

  /** PIM-HULL-WASP-ANCHOR-MAP-01: Placement calibration overlay text labels. */
  private placementLabels = new Map<string, Phaser.GameObjects.Text>();

  /** PIM-HULL-WASP-ANCHOR-MAP-01 fixup v3: On-screen calibration button panel. */
  private placementPanel: WaspPlacementCalibrationPanel | null = null;

  /** Whether generated hull sprites have been logged (once). */
  private generatedHullLogged = false;

  /** Whether blockout fallback has been logged (once). */
  private blockoutFallbackLogged = false;

  /** PIM-HULL-WASP-DIR-MAP-01: Whether devtools/arena mode is active.
   *  Calibration overlay and forced direction are gated to devtools mode only. */
  private isDevtoolsActive: () => boolean;

  constructor(scene: Phaser.Scene, offset: IsoPoint, isDevtoolsActive?: () => boolean) {
    this.scene = scene;
    this.offset = offset;
    this.isDevtoolsActive = isDevtoolsActive ?? (() => false);
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

  /** Toggle the direction debug overlay. Returns new state. */
  toggleDirectionDebug(): boolean {
    const newState = toggleDirDebug();
    if (!newState) {
      for (const [, label] of this.directionDebugLabels) {
        label.setVisible(false);
      }
    }
    return newState;
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

      // Check for generated hull sprite
      // PIM-HULL-WASP-DIR-MAP-01: When calibration is active and vehicle is Wasp,
      // use the forced visual dir16 instead of the normal pipeline.
      // Arena/devtools-only: forced direction is gated to devtools mode.
      const isWaspCalibrating = this.isDevtoolsActive()
        && isCalibrationActive()
        && bodyIdToGeneratedHullId(vehicle.bodyId) === 'wasp'
        && isOverrideActive();

      let hullKey: string | null;
      if (isWaspCalibrating) {
        const forcedDir16 = getForcedVisualDir16() as GeneratedHullDir16Index;
        hullKey = resolveGeneratedHullKeyForced(
          this.scene, vehicle.bodyId, vehicle.faction,
          vehicle.modificationLevel, forcedDir16,
        );
      } else {
        hullKey = resolveGeneratedHullKey(
          this.scene, vehicle.bodyId, vehicle.faction,
          vehicle.modificationLevel, vehicle.bodyAngle,
        );
      }
      const useGeneratedHull = hullKey !== null;

      // Manage hull sprite lifecycle
      let hullSprite = this.vehicleHullSprites.get(vehicle.id);
      if (useGeneratedHull && hullKey) {
        if (!hullSprite) {
          hullSprite = this.scene.add.image(0, 0, hullKey);
          hullSprite.setScale(GENERATED_HULL_SCALE);
          hullSprite.setOrigin(GENERATED_HULL_ORIGIN_X, GENERATED_HULL_ORIGIN_Y);
          hullSprite.setDepth(BLOCKOUT_DEPTH + HULL_SPRITE_DEPTH_BIAS);
          this.vehicleHullSprites.set(vehicle.id, hullSprite);
          if (!this.generatedHullLogged) {
            console.log(`[BlockoutVehicleRenderer] Using generated hull sprite for ${vehicle.bodyId}+${vehicle.weaponId}`);
            this.generatedHullLogged = true;
          }
        } else {
          hullSprite.setTexture(hullKey);
        }
      } else {
        if (hullSprite) {
          hullSprite.destroy();
          this.vehicleHullSprites.delete(vehicle.id);
        }
        if (!this.blockoutFallbackLogged) {
          console.log(`[BlockoutVehicleRenderer] No generated hull for ${vehicle.bodyId} — blockout fallback`);
          this.blockoutFallbackLogged = true;
        }
      }

      // ── TURRET-HULL-CONTRACT-PR-F2 / FIXUP-5: Turret sprite lifecycle ──
      // Resolve turret sprite key using generated 16-dir/512px resolver.
      // Only attempt when a generated hull sprite is active (Wasp+Smoky path).
      // FIXUP-5: Uses resolveGeneratedTurretKey (16-dir, 512×512) instead of
      // the legacy resolveModularTurretSpriteKey (8-dir, 256×256).
      let turretKey: string | null = null;
      if (useGeneratedHull) {
        const turretVisualDir16 = turretAngleToVisualDir16(vehicle.turretAngle, vehicle.weaponId);
        turretKey = resolveGeneratedTurretKey(
          this.scene, vehicle.weaponId, vehicle.faction, vehicle.modificationLevel,
          turretVisualDir16,
        );
      }

      // Resolve mounting data FIRST — this determines whether a real turret
      // sprite can be shown. The adapter checks the full contract:
      // texture key + directional pivot + socket profile + computed offset.
      // If any piece is missing, useRealTurretSprite is false.
      //
      // FIXUP-5: Turret source dimensions are now 512×512 (generated),
      // and turret scale is GENERATED_TURRET_SCALE (0.12) matching hull scale.
      const mountingData = resolveTurretSpriteMountingData({
        textureKey: turretKey,
        weaponId: vehicle.weaponId,
        bodyId: vehicle.bodyId,
        modificationLevel: vehicle.modificationLevel,
        turretAngle: vehicle.turretAngle,
        bodyAngle: vehicle.bodyAngle,
        sourceSizes: {
          hullSourceWidthPx: 512,
          hullSourceHeightPx: 512,
          turretSourceWidthPx: GENERATED_TURRET_SOURCE_WIDTH,
          turretSourceHeightPx: GENERATED_TURRET_SOURCE_HEIGHT,
        },
        scaleFactors: { hullScale: GENERATED_HULL_SCALE, turretScale: GENERATED_TURRET_SCALE },
      });

      // TURRET-HULL-CONTRACT-PR-F2: capture mounting data for the anchor
      // diagnostic overlay (drawn later in renderVehicle).
      this.lastMountingData.set(vehicle.id, mountingData);

      let turretSprite = this.vehicleTurretSprites.get(vehicle.id);
      if (mountingData.useRealTurretSprite && mountingData.textureKey !== null) {
        // Full contract exists — create or update real turret sprite
        const resolvedKey = mountingData.textureKey;
        if (!turretSprite) {
          turretSprite = this.scene.add.image(0, 0, resolvedKey);
          turretSprite.setScale(GENERATED_TURRET_SCALE);
          turretSprite.setOrigin(0.5, 0.5); // IMPORTANT: origin stays centered, never set to pivot
          turretSprite.setDepth(BLOCKOUT_DEPTH + TURRET_SPRITE_DEPTH_BIAS);
          this.vehicleTurretSprites.set(vehicle.id, turretSprite);
          if (!this.turretSpriteLogged) {
            console.log(`[BlockoutVehicleRenderer] Using real turret sprite for ${vehicle.weaponId}`);
            this.turretSpriteLogged = true;
          }
        } else {
          turretSprite.setTexture(resolvedKey);
        }

        // Position turret sprite relative to hull sprite using mounting offset
        if (hullSprite && mountingData.offsetFromHullCenter) {
          // Apply hull placement offset (same as hull sprite uses)
          const hullId = bodyIdToGeneratedHullId(vehicle.bodyId);
          const placementOffset = hullId ? getGeneratedHullPlacementOffset(hullId) : { offsetX: 0, offsetY: 0 };

          // Hull sprite center position (same calculation as hull positioning)
          const recoilBodyOffset = vehicle.recoilBodyOffset ?? 0;
          const bodyAngle = vehicle.bodyAngle;
          const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
          const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;
          let hullCx = vehicle.worldX + this.offset.x + bodyImpulseX;
          let hullCy = vehicle.worldY + this.offset.y + bodyImpulseY;

          // Apply same placement offset as hull sprite
          hullCx += placementOffset.offsetX;
          hullCy += placementOffset.offsetY;

          // Apply same Wasp debug placement offset if active
          const isWaspPlacement = this.isDevtoolsActive()
            && isWaspPlacementActive()
            && bodyIdToGeneratedHullId(vehicle.bodyId) === 'wasp';
          if (isWaspPlacement) {
            hullCx += getWaspDebugOffsetX();
            hullCy += getWaspDebugOffsetY();
          }

          // Position turret sprite at hull center + mounting offset
          turretSprite.setPosition(
            hullCx + mountingData.offsetFromHullCenter.x,
            hullCy + mountingData.offsetFromHullCenter.y,
          );
        }
      } else {
        // No full contract — destroy real turret sprite if it exists, use procedural fallback
        if (turretSprite) {
          turretSprite.destroy();
          this.vehicleTurretSprites.delete(vehicle.id);
        }
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
      // Also update hull sprite depth
      const hullSprite = this.vehicleHullSprites.get(vehicle.id);
      if (hullSprite) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          hullSprite.setDepth(BLOCKOUT_DEPTH + orderIdx + HULL_SPRITE_DEPTH_BIAS);
        }
      }
      // TURRET-HULL-CONTRACT-PR-F2: Also update turret sprite depth
      const turretSpriteObj = this.vehicleTurretSprites.get(vehicle.id);
      if (turretSpriteObj) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          turretSpriteObj.setDepth(BLOCKOUT_DEPTH + orderIdx + TURRET_SPRITE_DEPTH_BIAS);
        }
      }
      // Also update direction debug label depth
      const dirLabel = this.directionDebugLabels.get(vehicle.id);
      if (dirLabel) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          dirLabel.setDepth(BLOCKOUT_DEPTH + orderIdx + 10);
        }
      }
      // Also update calibration label depth
      const calibLabel = this.calibrationLabels.get(vehicle.id);
      if (calibLabel) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          calibLabel.setDepth(BLOCKOUT_DEPTH + orderIdx + 20);
        }
      }
      // Also update placement label depth
      const placeLabel = this.placementLabels.get(vehicle.id);
      if (placeLabel) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          placeLabel.setDepth(BLOCKOUT_DEPTH + orderIdx + 25);
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
    // Clean up stale hull sprites
    for (const [id, sprite] of this.vehicleHullSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.vehicleHullSprites.delete(id);
      }
    }
    // TURRET-HULL-CONTRACT-PR-F2: Clean up stale turret sprites
    for (const [id, sprite] of this.vehicleTurretSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.vehicleTurretSprites.delete(id);
      }
    }
    // TURRET-HULL-CONTRACT-PR-F2: Clean up stale mounting data + anchor overlay
    for (const id of this.lastMountingData.keys()) {
      if (!activeIds.has(id)) this.lastMountingData.delete(id);
    }
    for (const id of this.anchorLoggedVehicles) {
      if (!activeIds.has(id)) this.anchorLoggedVehicles.delete(id);
    }
    for (const [id, label] of this.anchorHullLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.anchorHullLabels.delete(id);
      }
    }
    for (const [id, label] of this.anchorTurretLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.anchorTurretLabels.delete(id);
      }
    }
    // Clean up stale direction debug labels
    for (const [id, label] of this.directionDebugLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.directionDebugLabels.delete(id);
      }
    }
    // Clean up stale calibration labels
    for (const [id, label] of this.calibrationLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.calibrationLabels.delete(id);
      }
    }
    // Clean up stale placement labels
    for (const [id, label] of this.placementLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.placementLabels.delete(id);
      }
    }

    // ── PIM-HULL-WASP-ANCHOR-MAP-01 fixup v3: On-screen calibration button panel ──
    // Show the panel when placement calibration is active for a Wasp, hide otherwise.
    // The panel is a fixed-screen UI that doesn't move with vehicles.
    const shouldShowPanel = this.isDevtoolsActive() && isWaspPlacementActive();
    if (shouldShowPanel && !this.placementPanel) {
      this.placementPanel = new WaspPlacementCalibrationPanel(this.scene);
      this.placementPanel.show();
    } else if (!shouldShowPanel && this.placementPanel) {
      this.placementPanel.hide();
      this.placementPanel = null;
    }
  }

  // ─── Vehicle rendering ──────────────────────────────────────────

  private renderVehicle(g: Phaser.GameObjects.Graphics, vehicle: BlockoutVehicleState, isSelected: boolean, isHovered: boolean): void {
    g.clear();

    // If using generated hull sprite, skip blockout body rendering but keep overlays
    const hullSprite = this.vehicleHullSprites.get(vehicle.id);
    const skipBlockoutBody = hullSprite !== undefined;

    // TURRET-HULL-CONTRACT-PR-F2: If a real turret sprite is active,
    // skip procedural turret box + barrel rendering. Keep aim line if selected.
    const turretSprite = this.vehicleTurretSprites.get(vehicle.id);
    const skipBlockoutTurret = turretSprite !== undefined;

    // Position hull sprite at vehicle center
    if (hullSprite) {
      const recoilBodyOffset = vehicle.recoilBodyOffset ?? 0;
      const bodyAngle = vehicle.bodyAngle;
      const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
      const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;
      let spriteCx = vehicle.worldX + this.offset.x + bodyImpulseX;
      let spriteCy = vehicle.worldY + this.offset.y + bodyImpulseY;

      // PIM-HULL-WASP-ANCHOR-MAP-01: Apply debug placement offset for Wasp
      // Arena/devtools-only: this offset is purely visual, affects sprite position only.
      // Selection ring, movement, pathfinding are all unchanged.
      const isWaspPlacement = this.isDevtoolsActive()
        && isWaspPlacementActive()
        && bodyIdToGeneratedHullId(vehicle.bodyId) === 'wasp';
      if (isWaspPlacement) {
        spriteCx += getWaspDebugOffsetX();
        spriteCy += getWaspDebugOffsetY();
      }

      // PIM-WASP-SCALE-PLACEMENT-01: Apply per-hull placement offset.
      // This is a permanent runtime offset (not the debug calibration offset)
      // that centers the hull sprite correctly within the tile footprint
      // after the scale reduction from 0.24 to 0.12.
      // Only applies to hulls with generated sprites.
      const hullId = bodyIdToGeneratedHullId(vehicle.bodyId);
      if (hullId) {
        const placement = getGeneratedHullPlacementOffset(hullId);
        spriteCx += placement.offsetX;
        spriteCy += placement.offsetY;
      }

      hullSprite.setPosition(spriteCx, spriteCy);
      hullSprite.setDepth(BLOCKOUT_DEPTH + HULL_SPRITE_DEPTH_BIAS); // will be updated by depth sorting below
    }

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
    // ── Pseudo-isometric body (base + side + top) ────────────────
    if (!skipBlockoutBody) {
      const shadowRadius = Math.max(halfW, halfH) * SHADOW_RADIUS_FRACTION;
      drawProjectedShadow(g, cx, cy, shadowRadius, this.offset);

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
    }

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
    //
    // TURRET-HULL-CONTRACT-PR-F2: When a real turret sprite is active
    // (skipBlockoutTurret), skip the procedural box + barrel but still
    // draw the aim line for selected vehicles.
    {
      // Turret position on top face (shared mountWorldX/Y from above)
      const turretZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET;

      // Draw procedural turret box + barrel only when no real turret sprite
      if (!skipBlockoutTurret) {
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
      }

      // ── Aim line for selected vehicle ─────────────────────────────
      // Draw aim line even when real turret sprite is active (it does not
      // visually contradict the turret direction).
      if (isSelected) {
        const turretCosA = Math.cos(effectiveTurretAngle);
        const turretSinA = Math.sin(effectiveTurretAngle);

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

    // ── Direction debug overlay (dev-only, Wasp-only focus) ──────────
    if (directionDebugEnabled) {
      const diag = resolveHullDirectionDiagnostic(
        vehicle.bodyId, vehicle.faction,
        vehicle.modificationLevel, vehicle.bodyAngle,
      );
      const diagZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.4;
      const diagPos = projectWorldPoint(tilePos.x, tilePos.y, diagZ, this.offset);
      const diagText = [
        `${vehicle.bodyId} angle=${diag.bodyAngleDeg}°`,
        `dir8=${diag.dir8} dir16=${diag.logicalDir16}→${diag.visualDir16}`,
        `${diag.compassSuffix} ${diag.textureKey.split('_').slice(-2).join('_')}`,
      ].join('\n');

      let diagLabel = this.directionDebugLabels.get(vehicle.id);
      if (!diagLabel) {
        diagLabel = this.scene.add.text(0, 0, '', {
          fontSize: '8px',
          color: '#ffcc00',
          backgroundColor: '#000000cc',
          padding: { x: 2, y: 1 },
        });
        diagLabel.setDepth(BLOCKOUT_DEPTH + 10);
        diagLabel.setOrigin(0.5, 1);
        this.directionDebugLabels.set(vehicle.id, diagLabel);
      }
      diagLabel.setText(diagText);
      diagLabel.setPosition(diagPos.x, diagPos.y);
      diagLabel.setVisible(true);
    }

    // ── PIM-HULL-WASP-DIR-MAP-01: Calibration overlay (Wasp-only, dev-only) ──
    // Arena/devtools-only: calibration overlay is explicitly gated to devtools mode.
    // Must never render in Standard gameplay.
    if (this.isDevtoolsActive() && isCalibrationActive() && bodyIdToGeneratedHullId(vehicle.bodyId) === 'wasp') {
      const calibZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.6;
      const calibPos = projectWorldPoint(tilePos.x, tilePos.y, calibZ, this.offset);

      // Compute diagnostic values for the overlay
      const diag = resolveHullDirectionDiagnostic(
        vehicle.bodyId, vehicle.faction,
        vehicle.modificationLevel, vehicle.bodyAngle,
      );
      const forcedDir16 = getForcedVisualDir16();
      const isForced = isOverrideActive();

      // Determine the texture key actually being used
      let actualTextureKey: string;
      if (isForced && forcedDir16 !== null) {
        const hullId = bodyIdToGeneratedHullId(vehicle.bodyId);
        const hullFaction = resolveGeneratedHullFaction(vehicle.faction);
        const mod = modificationLevelToMod(vehicle.modificationLevel);
        actualTextureKey = hullId
          ? getGeneratedHullTextureKey(hullId, hullFaction, mod, forcedDir16 as GeneratedHullDir16Index)
          : diag.textureKey;
      } else {
        actualTextureKey = diag.textureKey;
      }

      const overlayParams: CalibrationOverlayParams = {
        hullId: diag.hullId,
        bodyAngleDeg: diag.bodyAngleDeg,
        dir8: diag.dir8,
        logicalDir16: diag.logicalDir16,
        normalVisualDir16: diag.visualDir16,
        forcedDir16,
        compassSuffix: isForced && forcedDir16 !== null
          ? (GENERATED_HULL_DIRECTIONS_16[forcedDir16]?.suffix ?? '?')
          : diag.compassSuffix,
        textureKey: actualTextureKey,
        isOverrideActive: isForced,
      };

      const calibText = buildCalibrationOverlayText(overlayParams);
      const showCalibLabel = isCalibOverlayVisible();

      let calibLabel = this.calibrationLabels.get(vehicle.id);
      if (!calibLabel) {
        calibLabel = this.scene.add.text(0, 0, '', {
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#00ffcc',
          backgroundColor: '#000000dd',
          padding: { x: 4, y: 2 },
        });
        calibLabel.setDepth(BLOCKOUT_DEPTH + 20);
        calibLabel.setOrigin(0.5, 0); // anchor top-center, positioned above vehicle
        this.calibrationLabels.set(vehicle.id, calibLabel);
      }
      calibLabel.setText(calibText);
      calibLabel.setPosition(calibPos.x, calibPos.y - 60); // position above the direction debug label
      calibLabel.setVisible(showCalibLabel);
    } else {
      // Hide calibration label for non-Wasp or when calibration is off
      const calibLabel = this.calibrationLabels.get(vehicle.id);
      if (calibLabel) {
        calibLabel.setVisible(false);
      }
    }

    // ── PIM-HULL-WASP-ANCHOR-MAP-01: Placement calibration overlay (Wasp-only, dev-only) ──
    // Arena/devtools-only: placement overlay is explicitly gated to devtools mode.
    // Must never render in Standard gameplay.
    // Visual language reused from ModularTankDebugOverlay: green diamond, gold crosshair,
    // cyan X marker, white connecting line, red crosshair.
    if (this.isDevtoolsActive() && isWaspPlacementActive() && bodyIdToGeneratedHullId(vehicle.bodyId) === 'wasp') {
      // ── Positions (projected isometric coordinates) ──
      // Tile anchor (ax, ay): body screen center = selection ring center
      const ax = cx;
      const ay = cy;

      // Hull origin (hullX, hullY): hull sprite's current position (includes debug offset)
      const hullSpriteObj = this.vehicleHullSprites.get(vehicle.id);
      const hullX = hullSpriteObj ? hullSpriteObj.x : cx;
      const hullY = hullSpriteObj ? hullSpriteObj.y : cy;

      // Turret origin (turretX, turretY): projected turret mount screen position
      const turretScreenPos = projectWorldPoint(mountWorldX, mountWorldY, BLOCKOUT_VEHICLE_BODY_Z, this.offset);
      const turretX = turretScreenPos.x;
      const turretY = turretScreenPos.y;

      // ── Tile footprint diamond (green, projected ground-plane) ──
      g.lineStyle(2, 0x7cff7c, 0.95);
      drawProjectedGroundDiamond(g, cx, cy, 0.5, this.offset);

      // ── Logical tile anchor crosshair (gold circle + lines) ──
      g.lineStyle(2, 0xffd54f, 0.95);
      g.strokeCircle(ax, ay, 7);
      g.lineBetween(ax - 10, ay, ax + 10, ay);
      g.lineBetween(ax, ay - 10, ax, ay + 10);

      // ── Hull sprite origin marker (cyan circle + X pattern) ──
      g.lineStyle(2, 0x26c6da, 0.95);
      g.strokeCircle(hullX, hullY, 6);
      g.lineBetween(hullX - 8, hullY - 8, hullX + 8, hullY + 8);
      g.lineBetween(hullX - 8, hullY + 8, hullX + 8, hullY - 8);

      // ── Connecting line from hull origin to turret origin (white) ──
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(hullX, hullY, turretX, turretY);

      // ── Turret sprite/mount origin marker (red crosshair + circle) ──
      g.lineStyle(2, 0xff6b6b, 0.95);
      g.strokeCircle(turretX, turretY, 6);
      g.lineBetween(turretX - 8, turretY, turretX + 8, turretY);
      g.lineBetween(turretX, turretY - 8, turretX, turretY + 8);

      // ── Placement overlay text (compact debug panel, ModularTankDebugOverlay style) ──
      const diag = resolveHullDirectionDiagnostic(
        vehicle.bodyId, vehicle.faction,
        vehicle.modificationLevel, vehicle.bodyAngle,
      );

      const overlayParams: PlacementOverlayParams = {
        hullId: diag.hullId,
        vehicleId: vehicle.id,
        bodyId: vehicle.bodyId,
        offsetX: getWaspDebugOffsetX(),
        offsetY: getWaspDebugOffsetY(),
        scale: GENERATED_HULL_SCALE,
        originX: GENERATED_HULL_ORIGIN_X,
        originY: GENERATED_HULL_ORIGIN_Y,
        textureKey: diag.textureKey,
        tileX: tilePos.x,
        tileY: tilePos.y,
        isPlacementActive: true,
        hullScreenX: hullX,
        hullScreenY: hullY,
        turretScreenX: turretX,
        turretScreenY: turretY,
      };

      const placeText = buildPlacementOverlayText(overlayParams);
      const showPlaceLabel = isWaspPlacementOverlayVisible();

      let placeLabel = this.placementLabels.get(vehicle.id);
      if (!placeLabel) {
        placeLabel = this.scene.add.text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#f4f7fb',
          backgroundColor: 'rgba(16, 18, 28, 0.76)',
          padding: { x: 4, y: 3 },
        });
        placeLabel.setDepth(BLOCKOUT_DEPTH + 25);
        this.placementLabels.set(vehicle.id, placeLabel);
      }
      placeLabel.setText(placeText);
      // Position like ModularTankDebugOverlay: hullX+30, hullY+28
      placeLabel.setPosition(hullX + 30, hullY + 28);
      placeLabel.setVisible(showPlaceLabel);
    } else {
      // Hide placement label for non-Wasp or when placement calibration is off
      const placeLabel = this.placementLabels.get(vehicle.id);
      if (placeLabel) {
        placeLabel.setVisible(false);
      }
    }

    // ── TURRET-HULL-CONTRACT-PR-F2: turret/hull anchor diagnostic ──
    // ?turretAnchorDebug=1 (Arena/devtools only). Draws the computed hull
    // socket world point (green) and turret pivot world point (red) using
    // the LIVE sprite transforms, so the screen shows whether the two
    // anchors actually coincide. See drawTurretAnchorDiagnostic.
    if (this.turretAnchorDebug && this.isDevtoolsActive()) {
      this.drawTurretAnchorDiagnostic(g, vehicle);
    }
  }

  // ─── TURRET-HULL-CONTRACT-PR-F2: anchor diagnostic ───────────────

  /**
   * Draw the turret/hull anchor diagnostic for one vehicle.
   *
   * Uses the EXACT runtime values the renderer used:
   * - live hull sprite x/y, origin, displaySize, texture key;
   * - live turret sprite x/y, origin, displaySize, texture key;
   * - socketNorm resolved for the hull visual dir16 actually displayed;
   * - pivotNorm from the directional turret profile actually used;
   * - generated turret asset basis.
   *
   * Green cross + "hull socket" label marks the hull socket world point.
   * Red cross + "turret pivot" label marks the turret pivot world point.
   * When the two differ, a magenta line connects them. A compact console
   * row is logged once per vehicle so the exact numbers can be inspected.
   */
  private drawTurretAnchorDiagnostic(
    g: Phaser.GameObjects.Graphics,
    vehicle: BlockoutVehicleState,
  ): void {
    const hullSprite = this.vehicleHullSprites.get(vehicle.id);
    const turretSprite = this.vehicleTurretSprites.get(vehicle.id);
    const md = this.lastMountingData.get(vehicle.id);

    // Only meaningful when a real turret sprite + full mounting contract exists.
    if (!hullSprite || !turretSprite || !md || !md.directionalPivot) {
      const hl = this.anchorHullLabels.get(vehicle.id);
      const tl = this.anchorTurretLabels.get(vehicle.id);
      if (hl) hl.setVisible(false);
      if (tl) tl.setVisible(false);
      return;
    }

    // socketNorm for the hull frame actually displayed (same dir the adapter used).
    const socketNorm = resolveSocketNormForDir(vehicle.bodyId, 'turret_main', md.hullVisualDir16);
    const pivotNorm = { x: md.directionalPivot.x, y: md.directionalPivot.y };
    if (!socketNorm) return;

    const diag = computeAnchorDiagnostic({
      hullSpriteX: hullSprite.x,
      hullSpriteY: hullSprite.y,
      hullOriginX: hullSprite.originX,
      hullOriginY: hullSprite.originY,
      hullDisplayWidthPx: hullSprite.displayWidth,
      hullDisplayHeightPx: hullSprite.displayHeight,
      socketNorm,
      turretSpriteX: turretSprite.x,
      turretSpriteY: turretSprite.y,
      turretOriginX: turretSprite.originX,
      turretOriginY: turretSprite.originY,
      turretDisplayWidthPx: turretSprite.displayWidth,
      turretDisplayHeightPx: turretSprite.displayHeight,
      pivotNorm,
    });

    const { hullSocketWorld, turretPivotWorld, deltaX, deltaY, distance } = diag;

    // Connecting line first (under the crosses) when the anchors diverge.
    if (distance > 0.5) {
      g.lineStyle(1.5, 0xff00ff, 0.9);
      g.lineBetween(hullSocketWorld.x, hullSocketWorld.y, turretPivotWorld.x, turretPivotWorld.y);
    }

    // Hull socket — green cross.
    const arm = 7;
    g.lineStyle(2, 0x00ff66, 1);
    g.lineBetween(hullSocketWorld.x - arm, hullSocketWorld.y, hullSocketWorld.x + arm, hullSocketWorld.y);
    g.lineBetween(hullSocketWorld.x, hullSocketWorld.y - arm, hullSocketWorld.x, hullSocketWorld.y + arm);
    g.fillStyle(0x00ff66, 1);
    g.fillCircle(hullSocketWorld.x, hullSocketWorld.y, 2);

    // Turret pivot — red cross.
    g.lineStyle(2, 0xff3344, 1);
    g.lineBetween(turretPivotWorld.x - arm, turretPivotWorld.y, turretPivotWorld.x + arm, turretPivotWorld.y);
    g.lineBetween(turretPivotWorld.x, turretPivotWorld.y - arm, turretPivotWorld.x, turretPivotWorld.y + arm);
    g.fillStyle(0xff3344, 1);
    g.fillCircle(turretPivotWorld.x, turretPivotWorld.y, 2);

    // Labels.
    let hullLabel = this.anchorHullLabels.get(vehicle.id);
    if (!hullLabel) {
      hullLabel = this.scene.add.text(0, 0, 'hull socket', {
        fontSize: '8px',
        fontFamily: 'monospace',
        color: '#00ff66',
        backgroundColor: '#000000aa',
        padding: { x: 2, y: 1 },
      });
      hullLabel.setOrigin(0.5, 1);
      hullLabel.setDepth(BLOCKOUT_DEPTH + 30);
      this.anchorHullLabels.set(vehicle.id, hullLabel);
    }
    hullLabel.setPosition(hullSocketWorld.x, hullSocketWorld.y - arm - 2);
    hullLabel.setVisible(true);

    let turretLabel = this.anchorTurretLabels.get(vehicle.id);
    if (!turretLabel) {
      turretLabel = this.scene.add.text(0, 0, 'turret pivot', {
        fontSize: '8px',
        fontFamily: 'monospace',
        color: '#ff6677',
        backgroundColor: '#000000aa',
        padding: { x: 2, y: 1 },
      });
      turretLabel.setOrigin(0.5, 0);
      turretLabel.setDepth(BLOCKOUT_DEPTH + 30);
      this.anchorTurretLabels.set(vehicle.id, turretLabel);
    }
    turretLabel.setText(distance > 0.5 ? `turret pivot Δ=${distance.toFixed(1)}px` : 'turret pivot');
    turretLabel.setPosition(turretPivotWorld.x, turretPivotWorld.y + arm + 2);
    turretLabel.setVisible(true);

    // Compact console diagnostic row, once per vehicle.
    if (!this.anchorLoggedVehicles.has(vehicle.id)) {
      this.anchorLoggedVehicles.add(vehicle.id);
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      const r2 = (n: number) => Math.round(n * 100) / 100;
      console.log('[turretAnchorDebug]', {
        vehicleId: vehicle.id,
        bodyAngle: r3(vehicle.bodyAngle),
        turretAngle: r3(vehicle.turretAngle),
        hullVisualDir16: md.hullVisualDir16,
        turretDir16: md.turretVisualDir16,
        hullTextureKey: hullSprite.texture.key,
        turretTextureKey: turretSprite.texture.key,
        hullOrigin: { x: hullSprite.originX, y: hullSprite.originY },
        turretOrigin: { x: turretSprite.originX, y: turretSprite.originY },
        hullDisplaySize: { w: r2(hullSprite.displayWidth), h: r2(hullSprite.displayHeight) },
        turretDisplaySize: { w: r2(turretSprite.displayWidth), h: r2(turretSprite.displayHeight) },
        socketNorm: { x: r3(socketNorm.x), y: r3(socketNorm.y) },
        pivotNorm: { x: r3(pivotNorm.x), y: r3(pivotNorm.y) },
        turretAssetBasis: getGeneratedTurretAssetBasis(vehicle.weaponId),
        hullSocketWorld: { x: r2(hullSocketWorld.x), y: r2(hullSocketWorld.y) },
        turretPivotWorld: { x: r2(turretPivotWorld.x), y: r2(turretPivotWorld.y) },
        deltaX: r2(deltaX),
        deltaY: r2(deltaY),
        distance: r2(distance),
      });
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

    for (const [, sprite] of this.vehicleHullSprites) {
      sprite.destroy();
    }
    this.vehicleHullSprites.clear();

    // TURRET-HULL-CONTRACT-PR-F2: Destroy turret sprites
    for (const [, sprite] of this.vehicleTurretSprites) {
      sprite.destroy();
    }
    this.vehicleTurretSprites.clear();

    // TURRET-HULL-CONTRACT-PR-F2: Destroy anchor diagnostic overlay
    for (const [, label] of this.anchorHullLabels) {
      label.destroy();
    }
    this.anchorHullLabels.clear();
    for (const [, label] of this.anchorTurretLabels) {
      label.destroy();
    }
    this.anchorTurretLabels.clear();
    this.lastMountingData.clear();
    this.anchorLoggedVehicles.clear();

    for (const [, label] of this.directionDebugLabels) {
      label.destroy();
    }
    this.directionDebugLabels.clear();

    for (const [, label] of this.calibrationLabels) {
      label.destroy();
    }
    this.calibrationLabels.clear();

    for (const [, label] of this.placementLabels) {
      label.destroy();
    }
    this.placementLabels.clear();

    // PIM-HULL-WASP-ANCHOR-MAP-01 fixup v3: Clean up calibration button panel
    if (this.placementPanel) {
      this.placementPanel.destroy();
      this.placementPanel = null;
    }

  }
}
