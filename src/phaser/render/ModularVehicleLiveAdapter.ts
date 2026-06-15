/**
 * ModularVehicleLiveAdapter — MODULAR-RUNTIME-03A calibration-free
 * live modular vehicle adapter for Arena devtools/demo rendering.
 *
 * Bridges BlockoutVehicleState → ModularVehicleVisual → composeModularVehicle()
 * → world-space Phaser sprite placement.
 *
 * Design principles:
 *   - Calibration-free: uses metadata-driven composition math only.
 *     No ModularPreviewCalibration is read or used.
 *   - Uses the accepted `modular_hull_*` / `generated_turret_*` namespace
 *     from generatedModularVehicleAssets.generated.ts (PRs #286/#287/#288).
 *   - Feature-flagged: only active when ENABLE_MODULAR_VEHICLE_RENDER is true.
 *   - Normal runtime (legacy hull + blockout turret) is completely untouched.
 *   - Overlays (shadow, HP, selection, labels, weapon bars) remain in
 *     BlockoutVehicleRenderer — outside the modular guard.
 *
 * Isometric projection contract:
 *   azimuth = 45°, elevation = 35.264°
 *   fixedOrthoScale = 860 for modular render
 *   socketPixelPolicy: world_origin_projects_to_frame_center
 *   anchor = (256, 256) center of the 512×512 frame
 *
 * The adapter positions hull and turret sprites at the vehicle's
 * world-space screen coordinates. It does NOT create or manage
 * overlays, HP bars, selection rings, or any gameplay chrome.
 */

import Phaser from 'phaser';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import {
  blockoutToModularVisual,
} from '../../modular/blockoutToModularVisual';
import {
  composeModularVehicle,
  type ModularRenderPlan,
  type ScreenPoint,
} from '../../modular/modularVehicleComposition';
import type { ModularVehicleVisual } from '../../modular/modularVehicleVisual';
import {
  modularVisualDebugLabel,
} from '../../modular/modularVehicleVisual';
import {
  requestModularVehicleSet,
} from '../../modular/modularVehicleRuntimeLoader';

// ─── Feature flag ──────────────────────────────────────────────────

/**
 * MODULAR-RUNTIME-03A: Kill switch for live modular vehicle rendering.
 *
 * When false: no modular sprites are created, loaded, or positioned.
 * The legacy BlockoutVehicleRenderer path (generated hull + blockout turret)
 * runs normally.
 *
 * When true: for each vehicle with a valid modular visual mapping,
 * composeModularVehicle() produces a ModularRenderPlan, and hull+turret
 * sprites are positioned in world space. The legacy hull sprite is
 * hidden and the procedural turret is suppressed.
 *
 * Default: false (off). Toggle via devtools panel or assignment.
 */
export let ENABLE_MODULAR_VEHICLE_RENDER = false;

/** Toggle the modular vehicle render flag. Returns new state. */
export function toggleModularVehicleRender(): boolean {
  ENABLE_MODULAR_VEHICLE_RENDER = !ENABLE_MODULAR_VEHICLE_RENDER;
  return ENABLE_MODULAR_VEHICLE_RENDER;
}

/** Set the modular vehicle render flag directly. */
export function setModularVehicleRender(enabled: boolean): void {
  ENABLE_MODULAR_VEHICLE_RENDER = enabled;
}

// ─── Adapter result ────────────────────────────────────────────────

export interface LiveAdapterResult {
  /** Whether the modular path was used (false = fallback to legacy). */
  usedModular: boolean;
  /** The render plan from composeModularVehicle(). Null when not used. */
  plan: ModularRenderPlan | null;
  /** Debug label for diagnostics. */
  debugLabel: string;
  /** Why modular was not used (null when modular is active). */
  fallbackReason: string | null;
}

interface ModularSpriteState {
  hullSprite: Phaser.GameObjects.Image | null;
  turretSprite: Phaser.GameObjects.Image | null;
  lastHullKey: string | null;
  lastTurretKey: string | null;
  lastVisual: ModularVehicleVisual | null;
}

// ─── Live Adapter class ────────────────────────────────────────────

export class ModularVehicleLiveAdapter {
  private scene: Phaser.Scene;
  private offset: { x: number; y: number };

  /** Per-vehicle modular sprite state, keyed by blockout vehicle ID. */
  private vehicleModularSprites = new Map<string, ModularSpriteState>();

  /** Base depth for modular sprites (same as BlockoutVehicleRenderer). */
  private baseDepth: number;

  constructor(scene: Phaser.Scene, offset: { x: number; y: number }, baseDepth: number = 120) {
    this.scene = scene;
    this.offset = offset;
    this.baseDepth = baseDepth;
  }

  /**
   * Sync modular rendering for one vehicle.
   *
   * Called from BlockoutVehicleRenderer.syncFromState() when the feature
   * flag is on. Returns the result so the renderer knows whether to
   * skip the legacy hull/turret path.
   */
  syncVehicle(
    vehicle: BlockoutVehicleState,
    /** Whether to skip blockout body rendering. Set by caller based on result. */
  ): LiveAdapterResult {
    if (!ENABLE_MODULAR_VEHICLE_RENDER) {
      return { usedModular: false, plan: null, debugLabel: 'flag-off', fallbackReason: 'flag-off' };
    }

    // Map BlockoutVehicleState → ModularVehicleVisual + directions
    const mapped = blockoutToModularVisual({
      bodyId: vehicle.bodyId,
      weaponId: vehicle.weaponId,
      faction: vehicle.faction,
      modificationLevel: vehicle.modificationLevel,
      bodyAngle: vehicle.bodyAngle,
      turretAngle: vehicle.turretAngle,
    });

    if (!mapped.visual) {
      return {
        usedModular: false,
        plan: null,
        debugLabel: `mapping-failed: ${mapped.failReason}`,
        fallbackReason: `mapping-failed: ${mapped.failReason}`,
      };
    }

    // Request lazy-load of the modular vehicle set (always trigger load)
    requestModularVehicleSet(this.scene, mapped.visual);

    // Compute the screen anchor: vehicle world position + offset
    const recoilBodyOffset = vehicle.recoilBodyOffset ?? 0;
    const bodyAngle = vehicle.bodyAngle;
    const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
    const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;

    const anchor: ScreenPoint = {
      x: vehicle.worldX + this.offset.x + bodyImpulseX,
      y: vehicle.worldY + this.offset.y + bodyImpulseY,
    };

    // Compose the render plan using the accepted composition API
    const plan = composeModularVehicle({
      visual: mapped.visual,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });

    const labelBase = modularVisualDebugLabel(mapped.visual) +
      ` h:${mapped.hullDir16} t:${mapped.turretDir16}` +
      ` avail:${plan.available} fb:${plan.fallbackReason ?? 'none'}`;

    // Only apply the plan and claim modular when textures are fully available.
    // While assets are loading or missing, fall back to legacy rendering.
    if (plan.available) {
      this.applyPlan(vehicle.id, plan);
      return {
        usedModular: true,
        plan,
        debugLabel: labelBase,
        fallbackReason: null,
      };
    }

    // Assets not ready — hide any stale modular sprites but do NOT suppress legacy
    this.hideVehicle(vehicle.id);
    return {
      usedModular: false,
      plan,
      debugLabel: labelBase,
      fallbackReason: plan.fallbackReason ?? 'assets-loading',
    };
  }

  /**
   * Apply a ModularRenderPlan to create/update world-space sprites.
   */
  private applyPlan(vehicleId: string, plan: ModularRenderPlan): void {
    let state = this.vehicleModularSprites.get(vehicleId);
    if (!state) {
      state = {
        hullSprite: null,
        turretSprite: null,
        lastHullKey: null,
        lastTurretKey: null,
        lastVisual: null,
      };
      this.vehicleModularSprites.set(vehicleId, state);
    }

    // Hull sprite
    if (plan.hull.textureKey) {
      if (!state.hullSprite) {
        state.hullSprite = this.scene.add.image(0, 0, plan.hull.textureKey);
        state.hullSprite.setOrigin(plan.hull.origin.x, plan.hull.origin.y);
        state.hullSprite.setScale(plan.hull.scale);
        state.hullSprite.setDepth(this.baseDepth - 0.5); // same bias as legacy
        state.hullSprite.setVisible(true);
      } else {
        state.hullSprite.setTexture(plan.hull.textureKey);
      }
      state.hullSprite.setPosition(plan.hull.position.x, plan.hull.position.y);
      state.hullSprite.setScale(plan.hull.scale);
      state.hullSprite.setOrigin(plan.hull.origin.x, plan.hull.origin.y);
      state.lastHullKey = plan.hull.textureKey;
    } else {
      // No hull texture available — hide existing sprite
      if (state.hullSprite) {
        state.hullSprite.setVisible(false);
      }
    }

    // Turret sprite
    if (plan.turret.textureKey) {
      if (!state.turretSprite) {
        state.turretSprite = this.scene.add.image(0, 0, plan.turret.textureKey);
        state.turretSprite.setOrigin(plan.turret.origin.x, plan.turret.origin.y);
        state.turretSprite.setScale(plan.turret.scale);
        state.turretSprite.setDepth(this.baseDepth - 0.4); // above hull
        state.turretSprite.setVisible(true);
      } else {
        state.turretSprite.setTexture(plan.turret.textureKey);
      }
      state.turretSprite.setPosition(plan.turret.position.x, plan.turret.position.y);
      state.turretSprite.setScale(plan.turret.scale);
      state.turretSprite.setOrigin(plan.turret.origin.x, plan.turret.origin.y);
      state.lastTurretKey = plan.turret.textureKey;
    } else {
      // No turret texture available — hide existing sprite
      if (state.turretSprite) {
        state.turretSprite.setVisible(false);
      }
    }
  }

  /**
   * Update depth for a vehicle's modular sprites after depth sorting.
   */
  setDepth(vehicleId: string, depthIndex: number): void {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state) return;

    if (state.hullSprite) {
      state.hullSprite.setDepth(this.baseDepth + depthIndex - 0.5);
    }
    if (state.turretSprite) {
      state.turretSprite.setDepth(this.baseDepth + depthIndex - 0.4);
    }
  }

  /**
   * Remove modular sprites for a vehicle that no longer exists.
   */
  removeVehicle(vehicleId: string): void {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state) return;

    if (state.hullSprite) {
      state.hullSprite.destroy();
    }
    if (state.turretSprite) {
      state.turretSprite.destroy();
    }
    this.vehicleModularSprites.delete(vehicleId);
  }

  /**
   * Hide modular sprites for a single vehicle (e.g., when assets are
   * not yet available and legacy fallback should take over).
   */
  hideVehicle(vehicleId: string): void {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state) return;
    if (state.hullSprite) state.hullSprite.setVisible(false);
    if (state.turretSprite) state.turretSprite.setVisible(false);
  }

  /**
   * Return all vehicle IDs that have modular sprite state.
   * Used by BlockoutVehicleRenderer for stale cleanup, because
   * vehicleHullSprites/vehicleTurretSprites are empty in modular mode.
   */
  getVehicleIds(): Set<string> {
    return new Set(this.vehicleModularSprites.keys());
  }

  /**
   * Remove modular sprites for vehicles NOT in the active set.
   * Called from BlockoutVehicleRenderer.syncFromState().
   */
  removeStale(activeIds: Set<string>): void {
    for (const id of this.vehicleModularSprites.keys()) {
      if (!activeIds.has(id)) {
        this.removeVehicle(id);
      }
    }
  }

  /**
   * Hide all modular sprites (e.g., when flag is toggled off).
   */
  hideAll(): void {
    for (const [, state] of this.vehicleModularSprites) {
      if (state.hullSprite) state.hullSprite.setVisible(false);
      if (state.turretSprite) state.turretSprite.setVisible(false);
    }
  }

  /**
   * Show all modular sprites (e.g., when flag is toggled on).
   */
  showAll(): void {
    for (const [, state] of this.vehicleModularSprites) {
      if (state.hullSprite) state.hullSprite.setVisible(true);
      if (state.turretSprite) state.turretSprite.setVisible(true);
    }
  }

  /**
   * Destroy all managed sprites and clear state.
   */
  destroy(): void {
    for (const [, state] of this.vehicleModularSprites) {
      if (state.hullSprite) state.hullSprite.destroy();
      if (state.turretSprite) state.turretSprite.destroy();
    }
    this.vehicleModularSprites.clear();
  }
}
