/**
 * ModularVehicleLiveAdapter — MODULAR-RUNTIME-03A+03B calibration-free
 * live modular vehicle adapter for Arena devtools/demo and normal runtime.
 *
 * Bridges BlockoutVehicleState (Arena) / RenderableEntity (normal runtime)
 * → ModularVehicleVisual → composeModularVehicle()
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
import type { RenderableEntity } from '../../state/types';
import {
  blockoutToModularVisual,
} from '../../modular/blockoutToModularVisual';
import {
  normalCombatToModularVisual,
} from '../../modular/normalCombatToModularVisual';
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
 * MODULAR-RUNTIME-04A: default runtime renderer switch for modular vehicles.
 *
 * Default: TRUE. Modular PNG hull+turret rendering is the intended runtime
 * visual for both Arena devtools/demo and normal runtime modular-combat.
 *
 * When true (default): for each vehicle with a valid modular visual mapping,
 * composeModularVehicle() produces a ModularRenderPlan, and hull+turret
 * sprites are positioned in world space. The legacy hull sprite is hidden
 * and the procedural blockout turret is suppressed. While the selected
 * modular asset set is still loading or unavailable, the legacy
 * blockout/generated path renders as an EMERGENCY FALLBACK only — it is not
 * a normal workflow and no entity disappears during loading.
 *
 * When false: emergency/debug only. The legacy BlockoutVehicleRenderer path
 * (generated hull + blockout turret) runs. This is exposed in devtools as an
 * emergency fallback toggle, NOT as a "switch to the old look" workflow.
 */
export let ENABLE_MODULAR_VEHICLE_RENDER = true;

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

// ─── 03B: Pending normal-runtime entity state for retry ────────────

/**
 * Stored when placeModularCombat() is called but plan.available !== true.
 * Used by retryCleanModular() each frame to check whether assets have
 * loaded and apply the modular plan once they do.
 */
interface PendingModularCombat {
  entityId: string;
  anchor: ScreenPoint;
  chassis: string;
  weapon: string;
  mod: string;
  faction: string;
  dir?: number;
  turretDir?: number;
  depth: number;
}

// ─── Live Adapter class ────────────────────────────────────────────

export class ModularVehicleLiveAdapter {
  private scene: Phaser.Scene;
  private offset: { x: number; y: number };

  /** Per-vehicle modular sprite state, keyed by blockout vehicle ID. */
  private vehicleModularSprites = new Map<string, ModularSpriteState>();

  /** Base depth for modular sprites (same as BlockoutVehicleRenderer). */
  private baseDepth: number;

  /**
   * MODULAR-RUNTIME-03B: Pending normal-runtime entity awaiting asset load.
   * At most one modular-combat entity exists in normal runtime, so this
   * is a single optional slot (not a Map).
   */
  private pendingCombat: PendingModularCombat | null = null;

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
      // Flag toggled off: hide any existing modular sprites for this vehicle
      // so they don't persist over legacy rendering on the next frame.
      this.hideVehicle(vehicle.id);
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

  // ─── MODULAR-RUNTIME-03B: Normal runtime integration ──────────────

  /**
   * Place modular sprites for a normal-runtime modular-combat entity.
   *
   * Called from ModularTankRenderer.place() when ENABLE_MODULAR_VEHICLE_RENDER
   * is on. Returns the result so the renderer knows whether to skip the
   * legacy hull/turret path.
   *
   * Unlike syncVehicle() (Arena per-frame), this is called once at entity
   * placement time. The anchor is computed from the tile position.
   *
   * When assets are not yet loaded, stores the entity info in pendingCombat
   * so retryCleanModular() can retry each frame until textures arrive.
   * Returns usedModular:false so the legacy path remains visible.
   */
  placeModularCombat(
    entity: RenderableEntity,
    anchor: ScreenPoint,
    chassis: string,
    weapon: string,
    mod: string,
  ): LiveAdapterResult {
    if (!ENABLE_MODULAR_VEHICLE_RENDER) {
      return { usedModular: false, plan: null, debugLabel: 'flag-off', fallbackReason: 'flag-off' };
    }

    // Map RenderableEntity → ModularVehicleVisual + dir16
    const mapped = normalCombatToModularVisual({
      chassis,
      weapon,
      faction: entity.faction ?? 'cyan',
      mod,
      dir: entity.dir,
      turretDir: entity.turretDir,
    });

    if (!mapped.visual) {
      return {
        usedModular: false,
        plan: null,
        debugLabel: `mapping-failed: ${mapped.failReason}`,
        fallbackReason: `mapping-failed: ${mapped.failReason}`,
      };
    }

    // Request lazy-load of the modular vehicle set
    requestModularVehicleSet(this.scene, mapped.visual);

    // Compose the render plan
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
    if (plan.available) {
      this.applyPlan(entity.id, plan);
      // Clear any pending retry — we succeeded
      this.pendingCombat = null;
      return {
        usedModular: true,
        plan,
        debugLabel: labelBase,
        fallbackReason: null,
      };
    }

    // Assets not ready — store pending state for retry each frame
    this.pendingCombat = {
      entityId: entity.id,
      anchor,
      chassis,
      weapon,
      mod,
      faction: entity.faction ?? 'cyan',
      dir: entity.dir,
      turretDir: entity.turretDir,
      depth: 0, // will be set by setNormalRuntimeDepth() after place()
    };

    // Keep fallback visible — return usedModular:false
    return {
      usedModular: false,
      plan,
      debugLabel: labelBase,
      fallbackReason: plan.fallbackReason ?? 'assets-loading',
    };
  }

  /**
   * Set the depth for the pending normal-runtime modular sprite.
   * Called by ModularTankRenderer.place() after placeModularCombat()
   * returns usedModular:false, so the retry will use the correct depth.
   */
  setPendingDepth(depth: number): void {
    if (this.pendingCombat) {
      this.pendingCombat.depth = depth;
    }
  }

  /**
   * MODULAR-RUNTIME-03B: Retry clean modular placement for the pending
   * normal-runtime modular-combat entity.
   *
   * Called each frame from EntityRenderer.syncFromState() while:
   *   - ENABLE_MODULAR_VEHICLE_RENDER is on
   *   - pendingCombat is not null (assets were not ready at place time)
   *
   * Once plan.available becomes true:
   *   - Applies the modular plan (creates hull+turret sprites)
   *   - Sets depth from the stored value
   *   - Clears pendingCombat
   *   - Returns true (caller should suppress legacy hull/turret visuals)
   *
   * If assets are still loading, returns false — legacy stays visible.
   * Does not change gameplay state. Does not touch normal combat logic.
   */
  retryCleanModular(): boolean {
    if (!ENABLE_MODULAR_VEHICLE_RENDER || !this.pendingCombat) {
      return false;
    }

    const p = this.pendingCombat;

    // Re-map (entity fields don't change between frames for a static entity)
    const mapped = normalCombatToModularVisual({
      chassis: p.chassis,
      weapon: p.weapon,
      faction: p.faction,
      mod: p.mod,
      dir: p.dir,
      turretDir: p.turretDir,
    });

    if (!mapped.visual) {
      // Mapping permanently failed — clear pending, never retry
      this.pendingCombat = null;
      return false;
    }

    // Re-trigger lazy-load (idempotent — requestModularVehicleSet deduplicates)
    requestModularVehicleSet(this.scene, mapped.visual);

    // Re-compose the plan
    const plan = composeModularVehicle({
      visual: mapped.visual,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: p.anchor,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });

    if (!plan.available) {
      // Still loading — keep pending, legacy stays visible
      return false;
    }

    // Assets ready — apply the plan
    this.applyPlan(p.entityId, plan);
    this.setNormalRuntimeDepth(p.entityId, p.depth);
    this.pendingCombat = null;
    return true;
  }

  /**
   * Whether there is a pending normal-runtime modular-combat entity
   * waiting for asset loading.
   */
  hasPendingCombat(): boolean {
    return this.pendingCombat !== null;
  }

  /**
   * Set the absolute depth for a normal-runtime modular sprite.
   * Unlike setDepth() which adds a depthIndex offset to baseDepth,
   * this sets the depth directly (normal runtime uses computeDepthValue).
   */
  setNormalRuntimeDepth(vehicleId: string, depth: number): void {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state) return;

    if (state.hullSprite) {
      state.hullSprite.setDepth(depth - 0.5);
    }
    if (state.turretSprite) {
      state.turretSprite.setDepth(depth - 0.4);
    }
  }

  /**
   * Update direction for a normal-runtime modular sprite.
   * Called when setBodyDir/setTurretDir changes direction after placement.
   */
  updateDirection(
    vehicleId: string,
    visual: ModularVehicleVisual,
    hullDir16: number,
    turretDir16: number,
    anchor: ScreenPoint,
  ): void {
    const plan = composeModularVehicle({
      visual,
      hullDir16: hullDir16 as any,
      turretDir16: turretDir16 as any,
      anchor,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });

    if (plan.available) {
      this.applyPlan(vehicleId, plan);
    }
  }

  // ─── Shared sprite management ──────────────────────────────────────

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
    this.pendingCombat = null;
  }
}
