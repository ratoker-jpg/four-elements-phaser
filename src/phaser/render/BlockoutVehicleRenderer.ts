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
  getHullSelectionRingRadiusTiles,
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
// Stage 3 retirement: pilotTurretComposition import removed.
// The quarantine flag ENABLE_PILOT_GENERATED_TURRET_COMPOSITION was
// always false since MODULAR-RUNTIME-03B, and the modular path
// (useModularBody === true) stubs out the turret composition anyway.
// With Stage 3, the entire pilot turret composition path is removed
// from this renderer.
import {
  ModularVehicleLiveAdapter,
} from './ModularVehicleLiveAdapter';
import {
  debugRenderFlags,
} from '../../config/debugRenderFlags';


// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout vehicles (above terrain, coexisting with entities). */
const BLOCKOUT_DEPTH = 120;

/**
 * EXPERIMENT-OPUS-B1B2-01 / B2:
 * Generated hull PNGs are hull-only. Turret/barrel graphics must render above them.
 * Keep the bias below 1 so inter-vehicle isometric ordering remains stable.
 */
const HULL_SPRITE_DEPTH_BIAS = -0.5;

/** Mount point circle radius. */
const MOUNT_POINT_RADIUS = 3;

// Stage 3 retirement: ENABLE_PILOT_GENERATED_TURRET_COMPOSITION flag removed.
// The quarantine flag was always false since MODULAR-RUNTIME-03B, and
// Stage 3 removed the entire pilotTurretComposition path from this
// renderer. There is no longer anything to gate.

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

// ARENA-VISUAL-COMBAT-FIX-01 fixup-5: the fixed SELECTION_RING_WORLD_RADIUS
// (0.65 tiles) was removed. Selection/target/hover ring radii are now derived
// per-hull from the body footprint via getHullSelectionRingRadiusTiles() so the
// ring sits snugly under the hull instead of as a large detached ellipse.

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

  /**
   * Whether debug labels are shown.
   *
   * VEHICLE-RENDER-UNIFY-01-VH fixup: this field is now a thin proxy
   * for `debugRenderFlags.debugLabels` (the canonical source of truth
   * in src/config/debugRenderFlags.ts). It is retained as a private
   * field only so existing internal references compile unchanged; all
   * reads and writes go through `debugRenderFlags.debugLabels`.
   *
   * Default: false. Debug labels (text above each vehicle) are dev/QA
   * artifacts and must not appear in default gameplay/Arena view.
   * Existing devtools toggle (toggleDebugLabels) re-enables them when
   * explicitly requested.
   */
  private get showDebugLabels(): boolean {
    return debugRenderFlags.debugLabels;
  }
  private set showDebugLabels(value: boolean) {
    debugRenderFlags.debugLabels = value;
  }

  /**
   * Whether mount points are shown.
   *
   * VEHICLE-RENDER-UNIFY-01-VH fixup: this field is now a thin proxy
   * for `debugRenderFlags.mountPoints` (the canonical source of truth).
   * Default: false. The red mount-point dot is a debug artifact and
   * must not appear in default gameplay/Arena view.
   */
  private get showMountPoints(): boolean {
    return debugRenderFlags.mountPoints;
  }
  private set showMountPoints(value: boolean) {
    debugRenderFlags.mountPoints = value;
  }

  /** Currently selected vehicle ID (set from BlockoutVehicleInputController). */
  private _selectedVehicleId: string | null = null;

  /** Currently hovered vehicle ID (set from BlockoutVehicleInputController). */
  private _hoveredVehicleId: string | null = null;

  /** ARENA-03H+: Currently targeted vehicle ID (for target indicator rendering). */
  private _targetedVehicleId: string | null = null;

  /**
   * ARENA-VISUAL-COMBAT-FIX-01 fixup-5: shared ground-plane decal layer for
   * selection / hover / target rings. These rings must render BEHIND/BELOW the
   * hull sprites so the hull visually sits inside the ring. The per-vehicle
   * `vehicleGraphics` layer sits at/above the hull depth (it also carries HP
   * bars and the procedural turret, which must be on top), so the rings cannot
   * live there. This single shared graphics object is depth-sorted just below
   * all hull sprites and is cleared once per frame.
   */
  private groundRingGraphics: Phaser.GameObjects.Graphics | null = null;

  /** Generated hull sprite images keyed by blockout vehicle ID. */
  private vehicleHullSprites = new Map<string, Phaser.GameObjects.Image>();

  /** RUNTIME-03: Generated turret sprite images keyed by blockout vehicle ID.
   *  Stage 3: only used for defensive cleanup of stale sprites from pre-Stage-3 sessions. */
  private vehicleTurretSprites = new Map<string, Phaser.GameObjects.Image>();

  /** RUNTIME-03: Whether each vehicle has an active generated turret sprite.
   *  Stage 3: always false — no new turret sprites are created. */
  private vehicleHasGeneratedTurret = new Map<string, boolean>();

  // Stage 3 retirement: generatedTurretLogged field removed.
  // It was only set to true when ENABLE_PILOT_GENERATED_TURRET_COMPOSITION
  // created a turret sprite, which no longer happens.

  // Stage 3 retirement: vehicleTurretComp Map removed.
  // pilotTurretComposition is no longer called, so no composition results
  // need to be stored.

  /** Direction debug text labels keyed by blockout vehicle ID. */
  private directionDebugLabels = new Map<string, Phaser.GameObjects.Text>();

  /** PIM-HULL-WASP-DIR-MAP-01: Calibration overlay text labels keyed by blockout vehicle ID. */
  private calibrationLabels = new Map<string, Phaser.GameObjects.Text>();

  /** PIM-HULL-WASP-ANCHOR-MAP-01: Placement calibration overlay text labels. */
  private placementLabels = new Map<string, Phaser.GameObjects.Text>();

  /** PIM-HULL-WASP-ANCHOR-MAP-01 fixup v3: On-screen calibration button panel. */
  private placementPanel: WaspPlacementCalibrationPanel | null = null;

  /** MODULAR-RUNTIME-03A: Live modular vehicle adapter. */
  private modularAdapter: ModularVehicleLiveAdapter;

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
    this.modularAdapter = new ModularVehicleLiveAdapter(scene, offset, BLOCKOUT_DEPTH);
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

    // fixup-5: ensure the shared ground-ring decal layer exists and clear it
    // ONCE per frame (each vehicle appends its ring below). Depth is just below
    // BLOCKOUT_DEPTH so all rings render under every hull sprite (which sit at
    // BLOCKOUT_DEPTH + orderIdx - 0.5).
    if (!this.groundRingGraphics) {
      this.groundRingGraphics = this.scene.add.graphics();
      this.groundRingGraphics.setDepth(BLOCKOUT_DEPTH - 1);
    }
    this.groundRingGraphics.clear();

    for (const vehicle of vehicles) {
      activeIds.add(vehicle.id);

      let g = this.vehicleGraphics.get(vehicle.id);
      if (!g) {
        g = this.scene.add.graphics();
        g.setDepth(BLOCKOUT_DEPTH);
        this.vehicleGraphics.set(vehicle.id, g);
      }

      // ── MODULAR-RUNTIME-03A: Try live modular adapter first ──────────
      // When the feature flag is on and the adapter succeeds, we hide legacy
      // hull/turret sprites and let the modular adapter handle positioning.
      // Overlays (shadow, HP, selection, labels, weapon bars) are still drawn
      // in renderVehicle() — outside the modular guard.
      const modularResult = this.modularAdapter.syncVehicle(vehicle);
      const useModularBody = modularResult.usedModular;

      // Check for generated hull sprite (legacy path — skipped when modular active)
      // PIM-HULL-WASP-DIR-MAP-01: When calibration is active and vehicle is Wasp,
      // use the forced visual dir16 instead of the normal pipeline.
      // Arena/devtools-only: forced direction is gated to devtools mode.
      const isWaspCalibrating = !useModularBody
        && this.isDevtoolsActive()
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
      } else if (useModularBody) {
        hullKey = null; // modular handles its own hull
      } else {
        hullKey = resolveGeneratedHullKey(
          this.scene, vehicle.bodyId, vehicle.faction,
          vehicle.modificationLevel, vehicle.bodyAngle,
        );
      }
      const useGeneratedHull = hullKey !== null;

      // Manage hull sprite lifecycle (hide when modular takes over)
      let hullSprite = this.vehicleHullSprites.get(vehicle.id);
      if (useModularBody) {
        // Modular active: destroy legacy hull sprite if it exists
        if (hullSprite) {
          hullSprite.destroy();
          this.vehicleHullSprites.delete(vehicle.id);
        }
      } else if (useGeneratedHull && hullKey) {
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

      // ── Stage 3 retirement: pilot turret composition path removed ──
      //
      // VEHICLE-RENDER-UNIFY-03-VH removed the entire pilotTurretComposition
      // path from this renderer. The quarantine flag
      // ENABLE_PILOT_GENERATED_TURRET_COMPOSITION was always false since
      // MODULAR-RUNTIME-03B, and the modular path (useModularBody === true)
      // stubs out the turret composition anyway. With Stage 3:
      //   - resolvePilotTurretComposition() is no longer called.
      //   - The vehicleTurretComp Map is removed.
      //   - The vehicleTurretSprites Map is kept but only used to destroy
      //     any stale turret sprites from before Stage 3 (defensive cleanup).
      //   - The turret positioning block in renderVehicle() that read
      //     turretComp.turretOffsetPx / socketZHeight is removed.
      //
      // The modular adapter (ModularVehicleLiveAdapter) handles all
      // turret positioning via composeModularVehicle() metadata-driven
      // socket/pivot math. The procedural blockout turret (drawn via
      // Phaser.Graphics when useModularBody === false) is unchanged.

      // Defensive cleanup: destroy any stale turret sprite from a
      // pre-Stage-3 session. No new turret sprites are created here.
      const turretSprite = this.vehicleTurretSprites.get(vehicle.id);
      if (turretSprite) {
        turretSprite.destroy();
        this.vehicleTurretSprites.delete(vehicle.id);
      }
      this.vehicleHasGeneratedTurret.set(vehicle.id, false);

      // Determine selection/hover state for this vehicle
      const isSelected = vehicle.id === this._selectedVehicleId;
      const isHovered = vehicle.id === this._hoveredVehicleId;

      // Redraw this vehicle
      this.renderVehicle(g, vehicle, isSelected, isHovered, useModularBody);

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
      // RUNTIME-03: Also update turret sprite depth
      const turretSpriteForDepth = this.vehicleTurretSprites.get(vehicle.id);
      if (turretSpriteForDepth) {
        const orderIdx = depthOrder.get(vehicle.id);
        if (orderIdx !== undefined) {
          turretSpriteForDepth.setDepth(BLOCKOUT_DEPTH + orderIdx + HULL_SPRITE_DEPTH_BIAS + 0.1);
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
      // MODULAR-RUNTIME-03A: Post-sort modular sprite depth resync
      const modularDepthIdx = depthOrder.get(vehicle.id);
      if (modularDepthIdx !== undefined) {
        this.modularAdapter.setDepth(vehicle.id, modularDepthIdx);
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
    // RUNTIME-03: Clean up stale turret sprites
    for (const [id, sprite] of this.vehicleTurretSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.vehicleTurretSprites.delete(id);
      }
    }
    // RUNTIME-03: Clean up stale turret flags
    for (const [id] of this.vehicleHasGeneratedTurret) {
      if (!activeIds.has(id)) {
        this.vehicleHasGeneratedTurret.delete(id);
      }
    }
    // Stage 3 retirement: vehicleTurretComp stale-cleanup loop removed
    // (the Map no longer exists).
    // MODULAR-RUNTIME-03A: Clean up stale modular sprites
    // Uses removeStale() which checks the adapter's own vehicleModularSprites map,
    // not the legacy vehicleHullSprites/vehicleTurretSprites (which are empty in modular mode).
    this.modularAdapter.removeStale(activeIds);
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

  private renderVehicle(g: Phaser.GameObjects.Graphics, vehicle: BlockoutVehicleState, isSelected: boolean, isHovered: boolean, useModularBody: boolean = false): void {
    g.clear();

    // If using modular or generated hull sprite, skip blockout body rendering but keep overlays
    const hullSprite = this.vehicleHullSprites.get(vehicle.id);
    const skipBlockoutBody = useModularBody || hullSprite !== undefined;

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

    // Stage 3 retirement: turret sprite positioning block removed.
    // The vehicleTurretComp Map is gone, and no turret sprites are
    // created in this renderer (the modular adapter handles all turret
    // positioning via composeModularVehicle). The procedural blockout
    // turret (drawn via Phaser.Graphics below) is unchanged.

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
    // ARENA-VISUAL-COMBAT-FIX-01 fixup-5: the ring is drawn around the GAMEPLAY
    // CENTER (cx,cy) — which is the hull ground-contact under the modular
    // `world_origin_projects_to_frame_center` policy — and its RADIUS is scaled
    // to the hull footprint via getHullSelectionRingRadiusTiles(). Previously a
    // single fixed 0.65-tile radius made the ring ~2x the hull and look
    // detached. Gameplay center/hitbox/range/pathfinding are unchanged; this is
    // purely the ring's visual radius.
    const ringRadius = getHullSelectionRingRadiusTiles(vehicle.bodyId);
    // fixup-5: rings draw on the shared ground-ring layer (below hulls), not on
    // the per-vehicle graphics `g` (which is at/above the hull). Falls back to
    // `g` defensively if the layer is somehow absent.
    const ringG = this.groundRingGraphics ?? g;
    if (isSelected) {
      const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 800) / 800 * Math.PI * 2);
      const alpha = 0.6 + 0.4 * pulse;

      ringG.lineStyle(SELECTION_RING_WIDTH, SELECTION_RING_COLOR, alpha);
      drawProjectedGroundRing(ringG, cx, cy, ringRadius, this.offset, 24);

      // BLOCKOUT-10H+: Direction arrow outside the ring for orientation clarity.
      // VEHICLE-RENDER-UNIFY-01-VH fixup: gate behind an EXPLICIT debug
      // render flag (debugRenderFlags.directionArrow), NOT behind
      // isDevtoolsActive(). Arena mode is also devtools-active in GameScene,
      // so isDevtoolsActive() === true in default Arena view — that would
      // leak the direction arrow. The flag defaults to false; devtools
      // panels must explicitly opt in. The selection ring itself stays
      // (it is core UI, not a debug artifact).
      if (debugRenderFlags.directionArrow) {
        // Use screen-space arrow from body center along body angle
        // Approximate ring edge in screen space for arrow placement
        const ringEdgeDist = ringRadius * 38; // approximate pixel distance
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
    }

    // ── Hover marker (projected ground-plane) ────────────────────
    // fixup-5: hover ring also scales to the hull footprint (slightly tighter
    // than the selection ring) so it reads as belonging to the hull body.
    if (isHovered && !isSelected) {
      ringG.lineStyle(1.5, HOVER_RING_COLOR, HOVER_RING_ALPHA);
      drawProjectedGroundRing(ringG, cx, cy, ringRadius * 0.9, this.offset, 20);
    }

    // ── ARENA-03H+: Target indicator (enemy being targeted by selected ally) ──
    const isTargeted = vehicle.id === this._targetedVehicleId;
    if (isTargeted && !isSelected) {
      const pulse = 0.5 + 0.5 * Math.sin((this.scene.time.now % 600) / 600 * Math.PI * 2);
      const alpha = 0.5 + 0.5 * pulse;
      ringG.lineStyle(2, 0xff4444, alpha); // Red targeting ring (ground layer)
      drawProjectedGroundRing(ringG, cx, cy, ringRadius, this.offset, 24);

      // Small crosshair in center
      const crossSize = 0.12;
      g.lineStyle(1.5, 0xff4444, alpha);
      drawProjectedCrosshair(g, cx, cy, crossSize, this.offset);
    }

    // ── CORE-STEP-07H+: Target-lock status indicator on attacker ──
    // ARENA-VISUAL-COMBAT-FIX-01: Gated behind debugRenderFlags.targetLockIndicator.
    // Previously always drawn when vehicle.targetVehicleId was truthy —
    // a stray yellow pixel visible in default Arena view. Now hidden by
    // default; devtools must explicitly opt in.
    if (debugRenderFlags.targetLockIndicator && vehicle.targetVehicleId && !vehicle.isDestroyed) {
      // Target-lock active: show yellow dot above turret
      const lockIndicatorZ = BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + 0.3;
      const tilePosLocal = unprojectScreenToGround(cx, cy, this.offset);
      const lockPos = projectWorldPoint(tilePosLocal.x, tilePosLocal.y, lockIndicatorZ, this.offset);
      g.fillStyle(0xffcc00, 0.9); // Yellow target-lock indicator
      g.fillCircle(lockPos.x, lockPos.y, 3);
    }

    // ── ARENA-03H+: Enemy team indicator (small red diamond above HP bar) ──
    // ARENA-VISUAL-COMBAT-FIX-01: Gated behind debugRenderFlags.enemyTeamIndicator.
    // Previously always drawn when vehicle.team === 'enemy' — a stray red
    // diamond visible in default Arena view. Now hidden by default; devtools
    // must explicitly opt in.
    if (debugRenderFlags.enemyTeamIndicator && vehicle.team === 'enemy' && !vehicle.isDestroyed) {
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
    // RUNTIME-03: Skip procedural turret (box+barrel) when generated turret sprite is active.
    // The barrel line and aim line are still drawn because they provide gameplay feedback.
    {
      const hasGenTurret = useModularBody || this.vehicleHasGeneratedTurret.get(vehicle.id) === true;
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

      // RUNTIME-03: Skip procedural turret box when generated turret sprite is active.
      // The generated turret PNG replaces the procedural box+top faces.
      if (!hasGenTurret) {
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
      } // end if (!hasGenTurret) — procedural turret box

      // Barrel line (using shared barrelStartScreen/barrelTipScreen — PROJECTION-01 fixup #3)
      // ARENA-VISUAL-COMBAT-FIX-01 fixup-5: skip the procedural gray barrel
      // line when a modular/generated turret PNG is active. The modular turret
      // sprite already draws its own barrel; the procedural line (dark gray
      // BARREL_COLOR 0x555555) is positioned from BLOCKOUT geometry at the
      // elevated barrel-Z, so for a modular tank it floats above/beside the
      // hull as a stray gray marker — the exact "gray/black marker above the
      // tank" Denis reported. It is only meaningful for the pure-blockout
      // fallback path (no generated turret), so gate it on !hasGenTurret.
      if (!hasGenTurret) {
        g.lineStyle(barrelWidth, BARREL_COLOR, 1);
        g.beginPath();
        g.moveTo(barrelStartScreen.x, barrelStartScreen.y);
        g.lineTo(barrelTipScreen.x, barrelTipScreen.y);
        g.strokePath();
      }

      // ── Aim line for selected vehicle ─────────────────────────────
      // VEHICLE-RENDER-UNIFY-01-VH fixup: gate behind an EXPLICIT debug
      // render flag (debugRenderFlags.aimLine), NOT behind isDevtoolsActive().
      // Arena mode is also devtools-active in GameScene, so isDevtoolsActive()
      // === true in default Arena view — that would leak the aim line.
      // The flag defaults to false; devtools panels must explicitly opt in.
      if (isSelected && debugRenderFlags.aimLine) {
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
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    for (const [, g] of this.vehicleGraphics) {
      g.destroy();
    }
    this.vehicleGraphics.clear();

    // fixup-5: tear down the shared ground-ring decal layer.
    if (this.groundRingGraphics) {
      this.groundRingGraphics.destroy();
      this.groundRingGraphics = null;
    }

    for (const [, label] of this.debugLabels) {
      label.destroy();
    }
    this.debugLabels.clear();

    for (const [, sprite] of this.vehicleHullSprites) {
      sprite.destroy();
    }
    this.vehicleHullSprites.clear();

    // RUNTIME-03: Destroy all turret sprites
    for (const [, sprite] of this.vehicleTurretSprites) {
      sprite.destroy();
    }
    this.vehicleTurretSprites.clear();
    this.vehicleHasGeneratedTurret.clear();
    // Stage 3 retirement: vehicleTurretComp.clear() removed (Map no longer exists).

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

    // MODULAR-RUNTIME-03A: Clean up modular adapter
    this.modularAdapter.destroy();

  }

  // ─── MODULAR-RUNTIME-03A: Live modular toggle helpers ─────────────

  /**
   * Hide all modular sprites immediately when the live render flag is toggled off.
   * Called from the devtools panel toggle so that modular sprites disappear
   * before the next syncFromState() frame, preventing them from persisting
   * over legacy rendering.
   */
  clearModularVehicleRender(): void {
    this.modularAdapter.hideAll();
  }

  // ─── Modular barrel tip delegation (ARENA-VISUAL-COMBAT-FIX-01 Fix 6) ──

  /**
   * Compute the barrel tip screen position for a modular-rendered vehicle.
   *
   * Delegates to ModularVehicleLiveAdapter.getModularBarrelTip(). Returns
   * null if the vehicle is not using modular rendering, in which case the
   * caller should fall back to the blockout geometry barrel tip computation.
   *
   * @param vehicleId - The vehicle ID
   * @param turretAngle - Current turret angle in radians
   * @returns Screen-space barrel tip, or null if not using modular rendering
   */
  getModularBarrelTip(vehicleId: string, turretAngle: number): { x: number; y: number } | null {
    return this.modularAdapter.getModularBarrelTip(vehicleId, turretAngle);
  }

  /**
   * Check whether a vehicle is currently using modular rendering.
   *
   * Used by GameScene to decide whether to use the modular barrel tip
   * computation vs. the blockout geometry barrel tip.
   */
  isVehicleUsingModularRender(vehicleId: string): boolean {
    return this.modularAdapter.isUsingModularRender(vehicleId);
  }
}
