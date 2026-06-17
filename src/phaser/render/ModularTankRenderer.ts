/**
 * ModularTankRenderer — renders and manages the modular Wasp/Smoky tank.
 *
 * Extracted from EntityRenderer as part of ARCH-13B (Phase B).
 * Owns: placing hull/turret images, bodyDir/turretDir texture switching,
 * socket positioning, applying hull/turret mount offsets, printOffsetTables,
 * and destroy lifecycle for modular tank visuals.
 *
 * PR7: bodyDir controls hull texture + turret mount position.
 * turretDir controls turret texture only.
 * Offsets are per-bodyDir Records imported from worldConfig as mutable runtime values.
 *
 * MODULAR-RUNTIME-03B: When ENABLE_MODULAR_VEHICLE_RENDER is on and
 * a ModularVehicleLiveAdapter is provided, tries the clean modular path
 * first (composeModularVehicle with modular_hull_* / generated_turret_*
 * namespace). Falls back to the existing generated-hull / legacy path when
 * the flag is off, mapping fails, or assets are not yet loaded.
 */

import Phaser from 'phaser';
import {
  getSmokyTurretKey,
  getWaspHullKey,
} from '../../assets/modularUnitAssets';
import {
  ENABLE_MODULAR_VEHICLE_RENDER,
  ModularVehicleLiveAdapter,
  type LiveAdapterResult,
} from './ModularVehicleLiveAdapter';
import {
  normalCombatToModularVisual,
} from '../../modular/normalCombatToModularVisual';
import {
  getGeneratedHullTextureKey,
  mapRuntimeDir8ToGeneratedDir16,
  isGeneratedHullSetLoaded,
  DEFAULT_GENERATED_HULL,
  DEFAULT_GENERATED_HULL_MOD,
  resolveGeneratedHullFaction,
  GENERATED_HULL_SCALE,
  GENERATED_HULL_ORIGIN_X,
  GENERATED_HULL_ORIGIN_Y,
  getGeneratedHullPlacementOffset,
  type GeneratedHullId,
  type GeneratedHullMod,
} from '../../assets/generatedHullAssets';
import {
  MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR,
  MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR,
  tunerState,
  type ModularTankDirection,
} from '../../config/worldConfig';
import { tileToScreen, type IsoPoint } from './isometric';
import type { RenderableEntity, Faction } from '../../state/types';
import {
  MODULAR_RENDER_SCALE,
  MODULAR_SCALE_RATIO,
  MODULAR_ANCHOR_CORRECTION,
} from '../../config/unitRenderConfig';
import { computeDepthValue } from './depthSorting';
import { ModularTankDebugOverlay } from '../debug/ModularTankDebugOverlay';
import {
  resolveFactionOrDiagnosticFallback,
} from '../../modular/factionResolver';

/** Default initial visibility for the debug overlay. */
const MODULAR_TANK_DEBUG = false;

/** Render scale for the modular tank sprites (ARCH-05A: 25% reduction). */
export const MODULAR_TANK_SCALE = MODULAR_RENDER_SCALE;

/** Sprite origin for the legacy hull image. */
const MODULAR_TANK_HULL_ORIGIN = { x: 0.5, y: 0.75 };

/** Sprite origin for the turret image. */
const MODULAR_TANK_TURRET_ORIGIN = { x: 0.5, y: 0.5 };

/**
 * Apply scale-aware transform to a base-scale offset.
 *
 * Base offsets in worldConfig were calibrated at MODULAR_TANK_BASE_SCALE (0.32).
 * When the render scale changes, offsets must be proportionally adjusted so
 * the hull+turret visual composition stays consistent on the tile.
 *
 * Transform: (offset × scaleRatio) + anchorCorrection
 *
 * The anchor correction compensates for the non-linear shift in visual centre
 * caused by the non-centred sprite origin (0.5, 0.75).  It shifts the entire
 * hull+turret group together, preserving their relative alignment.
 */
function applyScaleTransform(offset: { x: number; y: number }): { x: number; y: number } {
  return {
    x: offset.x * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.x,
    y: offset.y * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.y,
  };
}

export class ModularTankRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Stored hull image for live repositioning. */
  private hull: Phaser.GameObjects.Image | null = null;

  /** Stored turret image for live repositioning. */
  private turret: Phaser.GameObjects.Image | null = null;

  /** Modular unit anchor world position — tile center in screen space + offset. */
  private anchorWorld: { x: number; y: number } | null = null;

  /** Current body facing direction. */
  private bodyDir: ModularTankDirection = 2;

  /** Current turret facing direction. */
  private turretDir: ModularTankDirection = 2;

  /** Faction of the modular tank, stored for texture swaps. */
  private faction: Faction = 'cyan';

  /** Whether the current hull is using a generated hull sprite. */
  private usingGeneratedHull: boolean = false;

  /** Generated hull ID in use (only meaningful when usingGeneratedHull is true). */
  private generatedHullId: GeneratedHullId = DEFAULT_GENERATED_HULL;

  /** Generated hull mod in use (only meaningful when usingGeneratedHull is true). */
  private generatedHullMod: GeneratedHullMod = DEFAULT_GENERATED_HULL_MOD;

  /** Debug overlay for tuner markers and text. */
  private debugOverlay: ModularTankDebugOverlay | null = null;

  /** Current visibility state for the debug overlay. */
  private debugVisible: boolean = MODULAR_TANK_DEBUG;

  /** Optional one-time render confirmation log. */
  private combatLogged: boolean = false;

  // ─── MODULAR-RUNTIME-03B: Clean modular adapter state ───────────

  /** Whether the current entity is using the clean modular rendering path. */
  private usingCleanModular: boolean = false;

  /** Modular adapter (shared with EntityRenderer). */
  private modularAdapter: ModularVehicleLiveAdapter | null = null;

  /** Entity ID for the modular-combat entity (used as key in adapter). */
  private modularEntityId: string | null = null;

  // ─── MODULAR-RUNTIME-03B: Stored placement info for late activation ──

  /**
   * Stored modular-combat entity reference from place().
   * Used by activateCleanModularRender() when Live Render is toggled ON
   * after scene initialization (flag was off during place()).
   */
  private storedModularEntity: RenderableEntity | null = null;

  /** Stored chassis string from place() for late activation. */
  private storedChassis: string = 'wasp';

  /** Stored weapon string from place() for late activation. */
  private storedWeapon: string = 'smoky';

  /** Stored mod string from place() for late activation. */
  private storedMod: string = 'm0';

  /** Whether activateCleanModularRender() has already been called. */
  private activationAttempted: boolean = false;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  /**
   * Place the modular combat tank (hull + turret) and create the debug overlay.
   * Called once during initial entity rendering.
   *
   * MODULAR-RUNTIME-03B: When ENABLE_MODULAR_VEHICLE_RENDER is on, tries the
   * clean modular rendering path first (composeModularVehicle with modular_hull_*
   * / generated_turret_* namespace). Falls back to the existing generated-hull /
   * legacy path when the flag is off, mapping fails, or assets are not yet loaded.
   *
   * VEHICLE-RENDER-UNIFY-01-VH Package C: faction is resolved via
   * resolveFactionOrDiagnosticFallback() — no silent `?? 'cyan'` default.
   * Missing/invalid faction warns once and falls back to diagnostic cyan
   * (marked via factionRes.usedFallback for caller/test detection).
   */
  place(entity: RenderableEntity, modularAdapter?: ModularVehicleLiveAdapter): void {
    // Package C: canonical faction resolution — no silent cyan default.
    const factionRes = resolveFactionOrDiagnosticFallback(
      entity.faction,
      'ModularTankRenderer.place',
    );
    const faction: Faction = factionRes.faction;
    const bodyDir: ModularTankDirection = (entity.dir ?? 2) as ModularTankDirection;
    const turretDir: ModularTankDirection = (entity.turretDir ?? bodyDir) as ModularTankDirection;

    // ── MODULAR-RUNTIME-03B: Try clean modular path first ──────────
    if (ENABLE_MODULAR_VEHICLE_RENDER && modularAdapter) {
      const tileAnchor = tileToScreen(entity.tx, entity.ty);
      const anchorX = tileAnchor.x + this.offset.x;
      const anchorY = tileAnchor.y + this.offset.y;

      // Default normal-runtime entity is wasp+smoky+m0 (from ModularCombatUnit)
      const chassis = 'wasp';
      const weapon = 'smoky';
      const mod = 'm0';

      const result = modularAdapter.placeModularCombat(
        entity,
        { x: anchorX, y: anchorY },
        chassis,
        weapon,
        mod,
      );

      // Compute depth once (used by both modular and legacy paths)
      const baseDepth = computeDepthValue({
        id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
        offsetX: this.offset.x, offsetY: this.offset.y,
      });

      // Store adapter reference for retryCleanModular()
      this.modularAdapter = modularAdapter;
      this.modularEntityId = entity.id;
      this.faction = faction;
      this.bodyDir = bodyDir;
      this.turretDir = turretDir;

      if (result.usedModular) {
        // Clean modular path succeeded — set depth on modular sprites
        this.usingCleanModular = true;
        modularAdapter.setNormalRuntimeDepth(entity.id, baseDepth);

        if (!this.combatLogged) {
          console.log(`[ModularTankRenderer] Rendered modular combat via clean modular path (03B)`);
          this.combatLogged = true;
        }
        // Do NOT return: fall through to always create legacy hull/turret
        // so that clearModularVehicleRender() can restore them on toggle-off.
      } else {
        // Modular not yet available (assets loading or mapping failed) —
        // store depth for the pending retry.
        modularAdapter.setPendingDepth(baseDepth);
      }
    }

    // ── MODULAR-RUNTIME-03B: Store entity info for late activation ──
    // Always store the entity reference, chassis/weapon/mod, and adapter
    // so activateCleanModularRender() can attempt modular placement when
    // Live Render is toggled ON after scene initialization.
    if (!this.storedModularEntity && modularAdapter) {
      this.storedModularEntity = entity;
      this.storedChassis = 'wasp';
      this.storedWeapon = 'smoky';
      this.storedMod = 'm0';
      // Also store adapter if not already set (flag-off path skips the block above)
      if (!this.modularAdapter) {
        this.modularAdapter = modularAdapter;
      }
    }

    // ── Legacy / generated-hull path (always creates hull/turret sprites) ──
    // When usingCleanModular is true (clean modular path succeeded above),
    // the legacy sprites will be hidden immediately after creation so
    // modular visuals show instead. They remain available for toggle-off restore.

    // Resolve generated hull faction (falls back to 'cyan')
    const generatedFaction = resolveGeneratedHullFaction(faction);

    // Check whether generated hull sprites are loaded for default hull/mod
    const generatedLoaded = isGeneratedHullSetLoaded(
      this.scene, DEFAULT_GENERATED_HULL, generatedFaction, DEFAULT_GENERATED_HULL_MOD,
    );

    this.usingGeneratedHull = generatedLoaded;
    this.generatedHullId = DEFAULT_GENERATED_HULL;
    this.generatedHullMod = DEFAULT_GENERATED_HULL_MOD;

    // Hull texture: prefer generated hull if loaded, fallback to legacy
    let hullKey: string;
    let hullScale: number;
    let hullOriginX: number;
    let hullOriginY: number;

    if (generatedLoaded) {
      const dir16 = mapRuntimeDir8ToGeneratedDir16(bodyDir);
      hullKey = getGeneratedHullTextureKey(DEFAULT_GENERATED_HULL, generatedFaction, DEFAULT_GENERATED_HULL_MOD, dir16);
      hullScale = GENERATED_HULL_SCALE;
      hullOriginX = GENERATED_HULL_ORIGIN_X;
      hullOriginY = GENERATED_HULL_ORIGIN_Y;
    } else {
      hullKey = getWaspHullKey(faction, bodyDir);
      hullScale = MODULAR_TANK_SCALE;
      hullOriginX = MODULAR_TANK_HULL_ORIGIN.x;
      hullOriginY = MODULAR_TANK_HULL_ORIGIN.y;
    }

    // Turret texture: use legacy Smoky turret key if available; skip if not loaded
    // (legacy modularUnits family is disabled — turret textures may not be loaded
    // until generated turret assets are wired in a future PR)
    const turretKey = getSmokyTurretKey(faction, turretDir);
    const turretTextureExists = this.scene.textures.exists(turretKey);

    const tileAnchor = tileToScreen(entity.tx, entity.ty);
    const anchorWorldX = tileAnchor.x + this.offset.x;
    const anchorWorldY = tileAnchor.y + this.offset.y;

    // Hull position = anchor + scaleTransform(hullOffset[bodyDir])
    const hullOff = applyScaleTransform(MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR[bodyDir]);
    let hullWorldX = anchorWorldX + hullOff.x;
    let hullWorldY = anchorWorldY + hullOff.y;

    // PIM-WASP-SCALE-PLACEMENT-01: Apply per-hull placement offset for generated hulls.
    // This compensates for the visual centering shift after the scale reduction.
    if (generatedLoaded) {
      const placement = getGeneratedHullPlacementOffset(this.generatedHullId);
      hullWorldX += placement.offsetX;
      hullWorldY += placement.offsetY;
    }
    // CORE-STEP-06H+ fixup: Use unified depth sorting for correct unit/building ordering
    const baseDepth = computeDepthValue({
      id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
      offsetX: this.offset.x, offsetY: this.offset.y,
    });

    const hull = this.scene.add.image(hullWorldX, hullWorldY, hullKey);
    hull.setScale(hullScale);
    hull.setOrigin(hullOriginX, hullOriginY);
    hull.setDepth(baseDepth);

    // Turret mount position = anchor + scaleTransform(turretMount[bodyDir]) (NOT turretDir!)
    const turretMountOff = applyScaleTransform(MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR[bodyDir]);
    const turretWorldX = anchorWorldX + turretMountOff.x;
    const turretWorldY = anchorWorldY + turretMountOff.y;
    const turret = turretTextureExists
      ? this.scene.add.image(turretWorldX, turretWorldY, turretKey)
      : null;
    if (turret) {
      turret.setScale(MODULAR_TANK_SCALE);
      turret.setOrigin(MODULAR_TANK_TURRET_ORIGIN.x, MODULAR_TANK_TURRET_ORIGIN.y);
      turret.setDepth(baseDepth + 1);
    }

    // Store references for live tuner repositioning and direction swaps
    this.hull = hull;
    this.turret = turret;
    this.anchorWorld = { x: anchorWorldX, y: anchorWorldY };
    // Anchor tile coords are passed to the debug overlay; not stored here.
    this.bodyDir = bodyDir;
    this.turretDir = turretDir;
    this.faction = faction;
    tunerState.bodyDir = bodyDir;
    tunerState.turretDir = turretDir;

    // MODULAR-RUNTIME-03B: If clean modular path succeeded, hide legacy
    // hull/turret so modular sprites show instead. The legacy sprites stay
    // alive (not destroyed) so clearModularVehicleRender() can restore them.
    if (this.usingCleanModular) {
      this.hull?.setVisible(false);
      this.turret?.setVisible(false);
    }

    // Create debug overlay
    this.debugOverlay = new ModularTankDebugOverlay(
      this.scene,
      {
        tx: entity.tx,
        ty: entity.ty,
        anchorWorldX,
        anchorWorldY,
        hullWorldX,
        hullWorldY,
        turretWorldX,
        turretWorldY,
        baseDepth,
      },
      this.debugVisible,
    );

    if (!this.combatLogged) {
      const hullSource = this.usingGeneratedHull ? 'generated' : 'legacy';
      console.log(`[ModularTankRenderer] Rendered modular combat: wasp_m0 + smoky_m0 (hull: ${hullSource})`);
      this.combatLogged = true;
    }
  }

  // ─── MODULAR-RUNTIME-03B: Retry/resync after asset loading ────────

  /**
   * Retry clean modular placement for the stored modular-combat entity.
   * Called each frame from EntityRenderer.syncFromState().
   *
   * When the adapter's retryCleanModular() succeeds (assets now loaded),
   * suppresses the legacy hull/turret visuals and marks usingCleanModular=true.
   * Returns true when modular sprites are now active (legacy should be hidden).
   */
  retryCleanModular(): boolean {
    if (!this.modularAdapter || !this.modularEntityId) {
      return false;
    }

    // If already using clean modular, nothing to retry
    if (this.usingCleanModular) {
      return true;
    }

    // If flag was turned off, stop retrying
    if (!ENABLE_MODULAR_VEHICLE_RENDER) {
      return false;
    }

    const succeeded = this.modularAdapter.retryCleanModular();
    if (succeeded) {
      // Clean modular now active — suppress legacy hull/turret
      this.usingCleanModular = true;
      if (this.hull) {
        this.hull.setVisible(false);
      }
      if (this.turret) {
        this.turret.setVisible(false);
      }
      return true;
    }
    return false;
  }

  // ─── MODULAR-RUNTIME-03B: Activation on Live Render ON ───────────

  /**
   * Activate clean modular rendering for the normal-runtime entity.
   * Called when ENABLE_MODULAR_VEHICLE_RENDER is toggled ON after
   * scene initialization (flag was off during place()).
   *
   * Uses the stored entity reference and adapter to attempt
   * placeModularCombat(). If assets are unavailable, creates a pending
   * retry so retryCleanModular() can apply modular sprites once they load.
   * Legacy hull/turret remain visible until modular succeeds.
   *
   * No-op if already using clean modular or activation already attempted.
   * Does not duplicate legacy sprites.
   */
  activateCleanModularRender(): void {
    // Already using clean modular — nothing to do
    if (this.usingCleanModular) {
      return;
    }

    // Already attempted activation — retryCleanModular() handles ongoing retries
    if (this.activationAttempted) {
      return;
    }

    // Need stored entity info and adapter
    if (!this.storedModularEntity || !this.modularAdapter) {
      return;
    }

    // Flag must be on
    if (!ENABLE_MODULAR_VEHICLE_RENDER) {
      return;
    }

    this.activationAttempted = true;

    const entity = this.storedModularEntity;
    const tileAnchor = tileToScreen(entity.tx, entity.ty);
    const anchorX = tileAnchor.x + this.offset.x;
    const anchorY = tileAnchor.y + this.offset.y;

    const result: LiveAdapterResult = this.modularAdapter.placeModularCombat(
      entity,
      { x: anchorX, y: anchorY },
      this.storedChassis,
      this.storedWeapon,
      this.storedMod,
    );

    // Compute depth for modular sprites
    const baseDepth = computeDepthValue({
      id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
      offsetX: this.offset.x, offsetY: this.offset.y,
    });

    this.modularEntityId = entity.id;

    if (result.usedModular) {
      // Clean modular succeeded immediately — hide legacy hull/turret
      this.usingCleanModular = true;
      this.modularAdapter.setNormalRuntimeDepth(entity.id, baseDepth);

      if (this.hull) {
        this.hull.setVisible(false);
      }
      if (this.turret) {
        this.turret.setVisible(false);
      }

      console.log(`[ModularTankRenderer] Late activation: clean modular applied (03B)`);
    } else {
      // Assets not yet available — store depth for pending retry
      this.modularAdapter.setPendingDepth(baseDepth);
      // Legacy hull/turret stay visible until retryCleanModular() succeeds
    }
  }

  // ─── MODULAR-RUNTIME-03B: Toggle-off cleanup ──────────────────────

  /**
   * Clear all modular vehicle sprites for normal runtime.
   * Called when ENABLE_MODULAR_VEHICLE_RENDER is toggled OFF.
   * Hides modular sprites via the adapter and restores legacy visuals.
   */
  clearModularVehicleRender(): void {
    if (this.modularAdapter && this.modularEntityId) {
      this.modularAdapter.hideVehicle(this.modularEntityId);
    }

    // If we were using clean modular, restore legacy visuals
    if (this.usingCleanModular) {
      this.usingCleanModular = false;
      if (this.hull) {
        this.hull.setVisible(true);
      }
      if (this.turret) {
        this.turret.setVisible(true);
      }
    }

    // Reset activation so the entity can be re-activated if flag is
    // toggled ON again
    this.activationAttempted = false;
  }

  /**
   * Change the body direction of the modular tank.
   * Changes hull texture and turret mount position (mount depends on bodyDir).
   * Does NOT change turret texture (that's setTurretDir).
   */
  setBodyDir(dir: ModularTankDirection): void {
    this.bodyDir = dir;
    tunerState.bodyDir = dir;

    // MODULAR-RUNTIME-03B: If using clean modular path, delegate to adapter
    if (this.usingCleanModular && this.modularAdapter && this.modularEntityId && this.anchorWorld) {
      const mapped = normalCombatToModularVisual({
        chassis: 'wasp',
        weapon: 'smoky',
        faction: this.faction,
        mod: 'm0',
        dir,
        turretDir: this.turretDir,
      });
      if (mapped.visual) {
        this.modularAdapter.updateDirection(
          this.modularEntityId,
          mapped.visual,
          mapped.hullDir16,
          mapped.turretDir16,
          this.anchorWorld,
        );
      }
      this.updateVisuals();
      return;
    }

    if (!this.hull || !this.turret) return;

    // Hull texture follows bodyDir — prefer generated if available
    if (this.usingGeneratedHull) {
      const dir16 = mapRuntimeDir8ToGeneratedDir16(dir);
      const generatedFaction = resolveGeneratedHullFaction(this.faction);
      const key = getGeneratedHullTextureKey(this.generatedHullId, generatedFaction, this.generatedHullMod, dir16);
      // If the specific generated texture is missing, fall back to legacy
      if (this.scene.textures.exists(key)) {
        this.hull.setTexture(key);
      } else {
        this.hull.setTexture(getWaspHullKey(this.faction, dir));
      }
    } else {
      this.hull.setTexture(getWaspHullKey(this.faction, dir));
    }

    // Turret mount position changes because bodyDir changed
    this.updateVisuals();
  }

  /**
   * Change the turret direction of the modular tank.
   * Changes turret texture ONLY. Turret mount position stays the same
   * (it depends on bodyDir, not turretDir).
   * No-op if turret texture is not available (legacy modularUnits disabled).
   */
  setTurretDir(dir: ModularTankDirection): void {
    this.turretDir = dir;
    tunerState.turretDir = dir;

    // MODULAR-RUNTIME-03B: If using clean modular path, delegate to adapter
    if (this.usingCleanModular && this.modularAdapter && this.modularEntityId && this.anchorWorld) {
      const mapped = normalCombatToModularVisual({
        chassis: 'wasp',
        weapon: 'smoky',
        faction: this.faction,
        mod: 'm0',
        dir: this.bodyDir,
        turretDir: dir,
      });
      if (mapped.visual) {
        this.modularAdapter.updateDirection(
          this.modularEntityId,
          mapped.visual,
          mapped.hullDir16,
          mapped.turretDir16,
          this.anchorWorld,
        );
      }
      this.updateVisuals();
      return;
    }

    if (!this.turret) return;

    // Turret texture follows turretDir; position stays (depends on bodyDir)
    const turretKey = getSmokyTurretKey(this.faction, dir);
    if (this.scene.textures.exists(turretKey)) {
      this.turret.setTexture(turretKey);
    }

    // Update overlay text to reflect new turretDir (positions unchanged)
    this.updateVisuals();
  }

  /**
   * Reposition hull and turret sprites from current runtime offsets
   * keyed by bodyDir, then rebuild the debug overlay markers and text.
   * Called by GameScene after keyboard offset adjustments or direction changes.
   */
  updateVisuals(): void {
    if (!this.hull || !this.anchorWorld) return;

    const ax = this.anchorWorld.x;
    const ay = this.anchorWorld.y;
    const bodyDir = this.bodyDir;

    // Hull position = anchor + scaleTransform(hullOffset[bodyDir])
    const hullOff = applyScaleTransform(MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR[bodyDir]);
    let hullX = ax + hullOff.x;
    let hullY = ay + hullOff.y;

    // PIM-WASP-SCALE-PLACEMENT-01: Apply per-hull placement offset for generated hulls.
    if (this.usingGeneratedHull) {
      const placement = getGeneratedHullPlacementOffset(this.generatedHullId);
      hullX += placement.offsetX;
      hullY += placement.offsetY;
    }

    this.hull.setPosition(hullX, hullY);

    // Turret mount position = anchor + scaleTransform(turretMount[bodyDir])
    const turretMountOff = applyScaleTransform(MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR[bodyDir]);
    const turretX = ax + turretMountOff.x;
    const turretY = ay + turretMountOff.y;
    if (this.turret) {
      this.turret.setPosition(turretX, turretY);
    }

    this.debugOverlay?.rebuild({
      hullWorldX: hullX,
      hullWorldY: hullY,
      turretWorldX: turretX,
      turretWorldY: turretY,
      bodyDir: this.bodyDir,
      turretDir: this.turretDir,
      scale: MODULAR_TANK_SCALE,
    });
  }

  /** Print copy-ready mutable runtime offset tables to console. */
  printOffsetTables(): void {
    const dirs: ModularTankDirection[] = [0, 1, 2, 3, 4, 5, 6, 7];

    const hullEntries = dirs.map(d => {
      const o = MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR[d];
      return `  ${d}: { x: ${o.x}, y: ${o.y} }`;
    }).join(',\n');

    const turretEntries = dirs.map(d => {
      const o = MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR[d];
      return `  ${d}: { x: ${o.x}, y: ${o.y} }`;
    }).join(',\n');

    console.log('DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR = {');
    console.log(hullEntries);
    console.log('};');
    console.log('DEFAULT_MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR = {');
    console.log(turretEntries);
    console.log('};');
  }

  /** Whether the debug overlay is currently visible. */
  isDebugOverlayVisible(): boolean {
    return this.debugVisible;
  }

  /** Toggle the debug overlay visibility. Returns new visibility state. */
  toggleDebug(): boolean {
    this.debugVisible = !this.debugVisible;
    this.debugOverlay?.toggle();
    // Sync visibility in case toggle was called directly
    this.debugVisible = this.debugOverlay?.isVisible() ?? this.debugVisible;
    return this.debugVisible;
  }

  /** Destroy all modular tank game objects (hull, turret, debug overlay). */
  destroy(): void {
    // MODULAR-RUNTIME-03B: If using clean modular path, clean up adapter sprites
    if (this.modularAdapter && this.modularEntityId) {
      this.modularAdapter.removeVehicle(this.modularEntityId);
      this.usingCleanModular = false;
      this.modularAdapter = null;
      this.modularEntityId = null;
    }
    this.hull?.destroy();
    this.hull = null;
    this.turret?.destroy();
    this.turret = null;
    this.debugOverlay?.destroy();
    this.debugOverlay = null;
    this.anchorWorld = null;
    // Debug overlay destroyed above; no anchor tile state to clear here.
  }
}
