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
  MODULAR_FRAME_SIZE,
  MODULAR_VEHICLE_BASE_SCALE,
} from '../../modular/modularVehicleComposition';
import type { ModularVehicleVisual } from '../../modular/modularVehicleVisual';
import {
  modularVisualDebugLabel,
} from '../../modular/modularVehicleVisual';
import {
  requestModularVehicleSet,
} from '../../modular/modularVehicleRuntimeLoader';
import {
  resolveFactionOrDiagnosticFallback,
} from '../../modular/factionResolver';
import {
  resolveTurretMuzzlesForDir,
  getTurretMuzzleProfile,
} from '../../config/directionalTurretProfiles';
import { dir16ToScreenAngle } from '../../modular/blockoutToModularVisual';
import { getHullVisualOffsetPx } from '../../config/hullVisualProfiles';

// ─── Visual center offset (hullVisualAnchor) ───────────────────────

/**
 * Get the per-hull visual center offset (hullVisualAnchor correction) for a
 * hull ID, as {dx,dy} screen pixels.
 *
 * ARENA-VISUAL-COMBAT-FIX-01 fixup-6: the offset table now lives in the
 * single, documented HULL_VISUAL_PROFILE (src/config/hullVisualProfiles.ts)
 * instead of a private map here, so the hullVisualAnchor is no longer a
 * "random global offset" sprinkled across the adapter. The profile keeps the
 * metadata-centred {0,0} baseline (fixup-4/5 proved that guessing {dy:12}
 * made centering worse), but it is now an explicit per-hull concept that can
 * receive a SINGLE measured correction without code churn.
 *
 * This shift moves the entire modular composite (hull + turret together). It
 * does NOT move worldX/worldY, the selection ring, the hitbox, range, or
 * damage — only the modular sprites.
 */
function getModularVisualCenterOffset(hullId: string): { dx: number; dy: number } {
  const off = getHullVisualOffsetPx(hullId);
  return { dx: off.x, dy: off.y };
}

// ─── Muzzle point math (ARENA-VISUAL-COMBAT-FIX-01 fixup-6) ─────────

/**
 * Compute a muzzle screen point from a base point (turret pivot or sprite
 * centre) using the per-turret TURRET_MUZZLE_PROFILE, projected along the
 * SCREEN direction of the resolved `turretDir16`.
 *
 *   forward = dir16ToScreenAngle(turretDir16)
 *   lateral = forward rotated 90° clockwise in screen space (y-down): (-fy, fx)
 *   muzzle  = base + forward·muzzleForwardPx + lateral·muzzleLateralPx
 *             + (0, muzzleVerticalPx)
 *
 * Exported as a pure function so the muzzle math is unit-testable without a
 * live Phaser scene. This is the fixup-6 fallback shared by getModularBarrelTip
 * Priority 2 (pivot base) and Priority 3 (sprite-centre base). Priority 1
 * (Smoky real per-direction data) bypasses it.
 *
 * Direction comes from dir16 — NOT the raw runtime turret angle — so the
 * muzzle aligns with the visible (quantised) barrel PNG in both rest and
 * attack.
 */
export function computeModularMuzzlePoint(
  base: { x: number; y: number },
  turretId: string,
  turretDir16: number,
): { x: number; y: number } {
  const profile = getTurretMuzzleProfile(turretId);
  const a = dir16ToScreenAngle(turretDir16);
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const lx = -fy;
  const ly = fx;
  return {
    x: base.x + fx * profile.muzzleForwardPx + lx * profile.muzzleLateralPx,
    y: base.y + fy * profile.muzzleForwardPx + ly * profile.muzzleLateralPx
      + profile.muzzleVerticalPx,
  };
}

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
  /**
   * VEHICLE-RENDER-UNIFY-01-VH Package D: sticky modular-success flag.
   *
   * True once this vehicle has been successfully rendered as modular PNG
   * (plan.available === true → applyPlan() ran) for its current
   * `lastVisual` identity. While sticky is true, transient
   * plan.available === false (e.g. a direction frame still loading) does
   * NOT cause fallback to blockout — the last good modular sprites stay
   * visible until the new frame loads.
   *
   * Sticky is released when:
   *   - the visual identity changes (different hull/turret/faction/mod);
   *   - the vehicle is removed (removeVehicle);
   *   - destroy() clears all state.
   */
  stickyModularSuccess: boolean;
  /**
   * ARENA-VISUAL-COMBAT-FIX-01 fixup-4: Store last render plan for
   * muzzle/VFX origin computation. The plan contains socketScreen and
   * pivotScreen positions computed from composition metadata, which are
   * more accurate than turret sprite center + flat barrel length.
   */
  lastPlan: ModularRenderPlan | null;
  /**
   * ARENA-VISUAL-COMBAT-FIX-01 fixup-4: Store last turret dir16 for
   * muzzle profile lookup via directionalTurretProfiles.
   */
  lastTurretDir16: number;
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
   *
   * VEHICLE-RENDER-UNIFY-01-VH Package D (no-flicker):
   *   Once a vehicle has been successfully rendered as modular PNG for its
   *   current visual identity (stickyModularSuccess === true), transient
   *   plan.available === false (e.g. a new direction frame still loading)
   *   does NOT fall back to blockout. The last good modular sprites stay
   *   visible until the new frame loads. This eliminates the
   *   "turquoise cube flicker" during direction changes.
   *
   *   Sticky is released when the visual identity changes (different
   *   hull/turret/faction/mod), so a real visual change still pays the
   *   normal fallback cost on first render.
   */
  syncVehicle(
    vehicle: BlockoutVehicleState,
    /** Whether to skip blockout body rendering. Set by caller based on result. */
  ): LiveAdapterResult {
    if (!ENABLE_MODULAR_VEHICLE_RENDER) {
      // Flag toggled off: hide any existing modular sprites for this vehicle
      // so they don't persist over legacy rendering on the next frame.
      this.hideVehicle(vehicle.id);
      this.clearSticky(vehicle.id);
      return { usedModular: false, plan: null, debugLabel: 'flag-off', fallbackReason: 'flag-off' };
    }

    // Map BlockoutVehicleState → ModularVehicleVisual + directions.
    // VEHICLE-RENDER-UNIFY-01-VH Package C: vehicle.faction on BlockoutVehicleState
    // is typed as required Faction, so no silent cyan default here. The
    // factionResolver is still applied defensively in case of upstream state
    // corruption (e.g. a future code path that constructs BlockoutVehicleState
    // with a non-canonical faction string).
    const mapped = blockoutToModularVisual({
      bodyId: vehicle.bodyId,
      weaponId: vehicle.weaponId,
      faction: vehicle.faction,
      modificationLevel: vehicle.modificationLevel,
      bodyAngle: vehicle.bodyAngle,
      turretAngle: vehicle.turretAngle,
      // ARENA-VISUAL-COMBAT-FIX-01 fixup-6 root cause D: only treat
      // turretAngle as a screen-space AIM angle when there is an active
      // target. With no target the turret rests parallel to the hull, so the
      // mapper reuses hullDir16 instead of mis-mapping the grid-space rest
      // angle through the screen offset (which pointed the turret sideways).
      turretAiming: vehicle.targetVehicleId != null,
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

    // ARENA-VISUAL-COMBAT-FIX-01 Fix 3: Apply per-hull visual center offset.
    // This shifts the entire modular composite (hull + turret) so the tank
    // appears visually centered in its selection ring. Without this, the
    // isometric artwork sits offset from the ring because the visual body
    // center is not at the PNG frame center.
    const visualOffset = getModularVisualCenterOffset(mapped.visual.hullId);

    const anchor: ScreenPoint = {
      x: vehicle.worldX + this.offset.x + bodyImpulseX + visualOffset.dx,
      y: vehicle.worldY + this.offset.y + bodyImpulseY + visualOffset.dy,
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

    // Check sticky state: has this vehicle already been successfully
    // rendered as modular for its current visual identity?
    const sticky = this.getSticky(vehicle.id, mapped.visual);

    // Only apply the plan and claim modular when textures are fully available.
    if (plan.available) {
      this.applyPlan(vehicle.id, plan, mapped.turretDir16);
      this.setSticky(vehicle.id, mapped.visual);
      return {
        usedModular: true,
        plan,
        debugLabel: labelBase,
        fallbackReason: null,
      };
    }

    // Package D no-flicker: if we already rendered this visual successfully
    // (sticky === true), keep the last good modular sprites visible instead
    // of falling back to blockout. The new direction frame will load shortly
    // and the next syncVehicle() call will swap it in cleanly.
    if (sticky) {
      // Sprites stay at their last good position/texture. We still report
      // usedModular: true so the caller suppresses the blockout path.
      return {
        usedModular: true,
        plan,
        debugLabel: `${labelBase} [sticky: keeping last good modular]`,
        fallbackReason: null,
      };
    }

    // No sticky state — first render of this visual identity, assets not
    // ready yet. Hide any stale modular sprites (from a previous visual)
    // and fall back to legacy blockout rendering until textures arrive.
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

    // VEHICLE-RENDER-UNIFY-01-VH Package C: canonical faction resolution.
    // entity.faction is optional on RenderableEntity, so a missing/invalid
    // faction goes through resolveFactionOrDiagnosticFallback() which:
    //   - passes valid factions (cyan/green/yellow/purple) through unchanged;
    //   - warns ONCE per call site on missing/invalid faction (no silent recolor);
    //   - returns diagnostic cyan as explicit last-resort fallback (marked
    //     via usedFallback=true so callers/tests can detect it).
    const factionRes = resolveFactionOrDiagnosticFallback(
      entity.faction,
      'ModularVehicleLiveAdapter.placeModularCombat',
    );
    const faction = factionRes.faction;

    // Map RenderableEntity → ModularVehicleVisual + dir16
    const mapped = normalCombatToModularVisual({
      chassis,
      weapon,
      faction,
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

    // ARENA-VISUAL-COMBAT-FIX-01 Fix 3: Apply per-hull visual center offset.
    const visualOffset = getModularVisualCenterOffset(mapped.visual.hullId);
    const adjustedAnchor: ScreenPoint = {
      x: anchor.x + visualOffset.dx,
      y: anchor.y + visualOffset.dy,
    };

    // Compose the render plan
    const plan = composeModularVehicle({
      visual: mapped.visual,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: adjustedAnchor,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });

    const labelBase = modularVisualDebugLabel(mapped.visual) +
      ` h:${mapped.hullDir16} t:${mapped.turretDir16}` +
      ` avail:${plan.available} fb:${plan.fallbackReason ?? 'none'}` +
      (factionRes.usedFallback ? ' faction:fallback-cyan' : '');

    // Only apply the plan and claim modular when textures are fully available.
    if (plan.available) {
      this.applyPlan(entity.id, plan, mapped.turretDir16);
      this.setSticky(entity.id, mapped.visual);
      // Clear any pending retry — we succeeded
      this.pendingCombat = null;
      return {
        usedModular: true,
        plan,
        debugLabel: labelBase,
        fallbackReason: null,
      };
    }

    // Package D no-flicker: if we already rendered this visual successfully
    // (sticky === true), keep the last good modular sprites visible.
    if (this.getSticky(entity.id, mapped.visual)) {
      this.pendingCombat = null;
      return {
        usedModular: true,
        plan,
        debugLabel: `${labelBase} [sticky: keeping last good modular]`,
        fallbackReason: null,
      };
    }

    // Assets not ready and no sticky state — store pending state for retry each frame
    this.pendingCombat = {
      entityId: entity.id,
      anchor,
      chassis,
      weapon,
      mod,
      faction,
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

    // ARENA-VISUAL-COMBAT-FIX-01 Fix 3: Apply per-hull visual center offset.
    const visualOffset = getModularVisualCenterOffset(mapped.visual.hullId);
    const adjustedAnchor: ScreenPoint = {
      x: p.anchor.x + visualOffset.dx,
      y: p.anchor.y + visualOffset.dy,
    };

    // Re-compose the plan
    const plan = composeModularVehicle({
      visual: mapped.visual,
      hullDir16: mapped.hullDir16,
      turretDir16: mapped.turretDir16,
      anchor: adjustedAnchor,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });

    if (!plan.available) {
      // Still loading — keep pending, legacy stays visible
      return false;
    }

    // Assets ready — apply the plan
    this.applyPlan(p.entityId, plan, mapped.turretDir16);
    this.setNormalRuntimeDepth(p.entityId, p.depth);
    this.setSticky(p.entityId, mapped.visual);
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
    // ARENA-VISUAL-COMBAT-FIX-01 Fix 3: Apply per-hull visual center offset.
    const visualOffset = getModularVisualCenterOffset(visual.hullId);
    const adjustedAnchor: ScreenPoint = {
      x: anchor.x + visualOffset.dx,
      y: anchor.y + visualOffset.dy,
    };

    const plan = composeModularVehicle({
      visual,
      hullDir16: hullDir16 as any,
      turretDir16: turretDir16 as any,
      anchor: adjustedAnchor,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });

    if (plan.available) {
      this.applyPlan(vehicleId, plan, turretDir16);
    }
  }

  // ─── Shared sprite management ──────────────────────────────────────

  /**
   * Apply a ModularRenderPlan to create/update world-space sprites.
   */
  private applyPlan(vehicleId: string, plan: ModularRenderPlan, turretDir16?: number): void {
    let state = this.vehicleModularSprites.get(vehicleId);
    if (!state) {
      state = {
        hullSprite: null,
        turretSprite: null,
        lastHullKey: null,
        lastTurretKey: null,
        lastVisual: null,
        stickyModularSuccess: false,
        lastPlan: null,
        lastTurretDir16: 0,
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

    // ARENA-VISUAL-COMBAT-FIX-01 fixup-4: Store plan for muzzle computation
    state.lastPlan = plan;
    if (turretDir16 !== undefined) {
      state.lastTurretDir16 = turretDir16;
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
    // Package D: clear sticky state so a future vehicle with the same id
    // (if ids are ever recycled) does not inherit sticky from the previous one.
    state.stickyModularSuccess = false;
    state.lastVisual = null;
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

  // ─── VEHICLE-RENDER-UNIFY-01-VH Package D: sticky no-flicker state ──

  /**
   * Returns true if this vehicle has been successfully rendered as
   * modular PNG for the SAME visual identity currently requested.
   *
   * "Same visual identity" means hullId, turretId, faction, hullMod,
   * turretMod all match. Direction (hullDir16/turretDir16) is NOT part
   * of identity — direction changes within the same visual are exactly
   * the case where sticky keeps the last good frame visible until the
   * new direction's texture loads.
   *
   * When true, syncVehicle()/placeModularCombat() will NOT fall back to
   * blockout even if plan.available === false — the last good modular
   * sprites stay visible.
   */
  private getSticky(vehicleId: string, visual: ModularVehicleVisual): boolean {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state || !state.stickyModularSuccess || !state.lastVisual) {
      return false;
    }
    return (
      state.lastVisual.hullId === visual.hullId &&
      state.lastVisual.turretId === visual.turretId &&
      state.lastVisual.faction === visual.faction &&
      state.lastVisual.hullMod === visual.hullMod &&
      state.lastVisual.turretMod === visual.turretMod
    );
  }

  /**
   * Mark a vehicle as having been successfully rendered as modular PNG
   * for the given visual identity. Subsequent calls with the same
   * identity will be sticky (no blockout fallback on transient
   * plan.available === false).
   */
  private setSticky(vehicleId: string, visual: ModularVehicleVisual): void {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state) return;
    state.stickyModularSuccess = true;
    state.lastVisual = visual;
  }

  /**
   * Clear sticky state for a vehicle. Used when:
   *   - the modular render flag is toggled off;
   *   - the vehicle is removed;
   *   - the adapter is destroyed.
   */
  private clearSticky(vehicleId: string): void {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state) return;
    state.stickyModularSuccess = false;
    state.lastVisual = null;
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

  // ─── Modular barrel tip (ARENA-VISUAL-COMBAT-FIX-01 fixup-4/6) ──────

  /**
   * Compute the barrel tip / muzzle screen position for a modular-rendered
   * vehicle. This is the SINGLE muzzlePoint used by both the VFX origin and
   * the damage origin (GameScene.computeBarrelTip), so the tracer/flash and
   * the hit math start from the same point.
   *
   * Priority:
   *   1. Directional muzzle profile (directionalTurretProfiles) — uses
   *      per-direction normalized muzzle position from 3DS projection data,
   *      transformed to screen space via the composition plan's turret
   *      placement. Most accurate for supported weapons (currently Smoky).
   *   2. Composition pivot-aware + TURRET_MUZZLE_PROFILE fallback — uses
   *      pivotScreen from the render plan (socket/pivot alignment) as the
   *      base, offset by the explicit per-turret muzzle profile along the
   *      SCREEN direction of turretDir16 (fixup-6 root cause F).
   *   3. Last-resort fallback — turret sprite center + the same profile
   *      offset. Used only when no plan is stored.
   *
   * ARENA-VISUAL-COMBAT-FIX-01 fixup-6: the muzzle direction is derived from
   * the resolved `turretDir16`, NOT the raw runtime turret angle. `turretAngle`
   * is retained in the signature for API/caller compatibility but is no longer
   * read — at rest it is grid-space, which previously pointed the muzzle
   * sideways/above the hull.
   *
   * @param vehicleId - The vehicle ID to compute the barrel tip for
   * @param _turretAngle - Retained for API compatibility; not read (see above)
   * @returns Screen-space muzzle position, or null if the vehicle has no
   *          modular turret sprite (not using modular rendering)
   */
  getModularBarrelTip(
    vehicleId: string,
    _turretAngle: number,
  ): { x: number; y: number } | null {
    const state = this.vehicleModularSprites.get(vehicleId);
    if (!state?.turretSprite) return null;

    const weaponId = state.lastVisual?.turretId ?? '';
    const turretDir16 = state.lastTurretDir16;
    const plan = state.lastPlan;
    const turretDisplaySize = plan?.turret.displaySize
      ?? (MODULAR_FRAME_SIZE * MODULAR_VEHICLE_BASE_SCALE);

    // Priority 1: Directional muzzle profile (per-direction 3DS projection data)
    const muzzleProfile = resolveTurretMuzzlesForDir(weaponId, 0, turretDir16);
    if (muzzleProfile && muzzleProfile.length > 0 && plan) {
      // The muzzle position is in normalized sprite-space (0..1).
      // Transform to screen-space using the turret sprite placement:
      //   muzzleScreen = turretPosition + (muzzleNorm - origin) * displaySize
      const muzzleNorm = muzzleProfile[0].position;
      const muzzleScreenX = plan.turret.position.x + (muzzleNorm.x - plan.turret.origin.x) * turretDisplaySize;
      const muzzleScreenY = plan.turret.position.y + (muzzleNorm.y - plan.turret.origin.y) * turretDisplaySize;
      return { x: muzzleScreenX, y: muzzleScreenY };
    }

    // Priority 2: Composition pivot-aware + TURRET_MUZZLE_PROFILE fallback.
    //
    // ARENA-VISUAL-COMBAT-FIX-01 fixup-6 root cause F: the barrel direction
    // is derived from the resolved `turretDir16` (via dir16ToScreenAngle),
    // NOT the raw runtime `turretAngle`. `turretAngle` is grid-space while
    // the turret rests, so the old `cos/sin(turretAngle)` pointed the muzzle
    // sideways/above the hull at rest. dir16 is the single source of truth
    // for which turret PNG frame is on screen, so the muzzle now starts at
    // the visible barrel in BOTH rest and attack.
    //
    // The offset uses the explicit per-turret TURRET_MUZZLE_PROFILE
    // (forward along the barrel, lateral 90° CW, vertical screen-Y) relative
    // to pivotScreen (composition socket/pivot alignment), instead of a bare
    // forward length. Temporary until real per-direction muzzle markers are
    // exported for every turret (Smoky already has them → Priority 1).
    if (plan && plan.pivotScreen) {
      return computeModularMuzzlePoint(plan.pivotScreen, weaponId, turretDir16);
    }

    // Priority 3: Last-resort fallback — turret sprite center + profile offset
    // along the dir16 screen direction. Used only when no plan is stored.
    const spriteCenter = { x: state.turretSprite.x, y: state.turretSprite.y };
    return computeModularMuzzlePoint(spriteCenter, weaponId, turretDir16);
  }

  /**
   * Check whether a vehicle is currently using modular rendering.
   * Used by GameScene to decide whether to use the modular barrel tip
   * computation vs. the blockout geometry barrel tip.
   */
  isUsingModularRender(vehicleId: string): boolean {
    const state = this.vehicleModularSprites.get(vehicleId);
    return state != null && state.turretSprite != null && state.stickyModularSuccess;
  }
}
