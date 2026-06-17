/**
 * ModularTankRenderer — VEHICLE-RENDER-UNIFY-03-VH Stage 3 retirement.
 *
 * This file was originally a full hull+turret sprite renderer with two
 * paths:
 *   - clean modular path (delegate to ModularVehicleLiveAdapter);
 *   - legacy generated-hull / wasp+smoky path with per-dir offset
 *     tables.
 *
 * Stage 3 retires the legacy path entirely. The renderer is now a thin
 * delegate around ModularVehicleLiveAdapter. The legacy hull/turret
 * sprites, per-dir offset tables, tuner state, debug overlay, and
 * late-activation logic are all removed.
 *
 * Behavior contract after Stage 3:
 *   - place(entity, adapter) → adapter.placeModularCombat(...)
 *   - retryCleanModular() → adapter.retryCleanModular()
 *   - clearModularVehicleRender() → adapter.hideVehicle(entityId)
 *   - activateCleanModularRender() → re-attempts placeModularCombat
 *     using stored entity info (kept for devtools toggle-on scenario)
 *   - setBodyDir / setTurretDir → adapter.updateDirection(...)
 *   - destroy() → adapter.removeVehicle(entityId)
 *
 * Emergency fallback:
 *   If modular assets are unavailable on first render, the adapter's
 *   sticky no-flicker state (Stage 2) keeps the last good modular
 *   sprites visible. If this is the very first render (no sticky),
 *   the entity is invisible until textures load, then retryCleanModular()
 *   applies modular sprites. This is the explicit loading behavior;
 *   no silent cyan recolor, no legacy wasp+smoky fallback.
 *
 * What was removed (Stage 3):
 *   - getWaspHullKey / getSmokyTurretKey imports
 *   - MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR /
 *     MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR imports
 *   - tunerState import
 *   - applyScaleTransform helper
 *   - hull / turret sprite fields and creation logic
 *   - usingGeneratedHull / generatedHullId / generatedHullMod fields
 *   - debugOverlay / debugVisible / ModularTankDebugOverlay import
 *   - printOffsetTables() method
 *   - updateVisuals() repositioning logic
 *   - anchorWorld field (no legacy sprites to reposition)
 *
 * What was kept:
 *   - place() — now thin delegate, but keeps faction resolution
 *     (Stage 2 contract: no silent cyan fallback).
 *   - retryCleanModular() — thin delegate.
 *   - activateCleanModularRender() — kept for devtools toggle-on
 *     scenario (when ENABLE_MODULAR_VEHICLE_RENDER is flipped from
 *     off to on after scene init).
 *   - clearModularVehicleRender() — kept for devtools toggle-off.
 *   - setBodyDir / setTurretDir — thin delegates to adapter.updateDirection.
 *   - destroy() — cleans up adapter state.
 *
 * No placement/composition math is changed. The adapter's
 * composeModularVehicle() is the single source of truth.
 */

import Phaser from 'phaser';
import {
  ENABLE_MODULAR_VEHICLE_RENDER,
  ModularVehicleLiveAdapter,
  type LiveAdapterResult,
} from './ModularVehicleLiveAdapter';
import {
  normalCombatToModularVisual,
} from '../../modular/normalCombatToModularVisual';
import { tileToScreen, type IsoPoint } from './isometric';
import type { RenderableEntity, Faction } from '../../state/types';
import { computeDepthValue } from './depthSorting';
import {
  resolveFactionOrDiagnosticFallback,
} from '../../modular/factionResolver';
import type { ModularTankDirection } from '../../config/worldConfig';

/**
 * ModularTankRenderer — thin delegate around ModularVehicleLiveAdapter.
 *
 * Stage 3 retirement: legacy hull/turret sprite path, per-dir offset
 * tables, tuner state, and debug overlay are all removed. The renderer
 * exists only to preserve the EntityRenderer ↔ adapter call sites
 * without a larger refactor (Stage 4 will revisit GameScene orchestration).
 */
export class ModularTankRenderer {
  // Stage 3 retirement: scene field removed.
  // The legacy hull/turret sprite creation (which needed scene.add.image)
  // is gone. All sprite management is in ModularVehicleLiveAdapter.
  private offset: IsoPoint;

  /** Modular adapter (shared with EntityRenderer). */
  private modularAdapter: ModularVehicleLiveAdapter | null = null;

  /** Entity ID for the modular-combat entity (used as key in adapter). */
  private modularEntityId: string | null = null;

  /** Stored faction for direction-update delegation. */
  private faction: Faction = 'cyan';

  /** Current body facing direction (for adapter.updateDirection). */
  private bodyDir: ModularTankDirection = 2;

  /** Current turret facing direction (for adapter.updateDirection). */
  private turretDir: ModularTankDirection = 2;

  /** Anchor world position (tile center in screen space + offset). */
  private anchorWorld: { x: number; y: number } | null = null;

  // ─── Stage 3: Stored placement info for late activation ─────────
  // Kept for the devtools toggle-on scenario (when
  // ENABLE_MODULAR_VEHICLE_RENDER is flipped from off to on after
  // scene init). Stage 4 may revisit this if the toggle is removed.

  private storedModularEntity: RenderableEntity | null = null;
  private activationAttempted: boolean = false;

  constructor(_scene: Phaser.Scene, offset: IsoPoint) {
    // Stage 3: scene parameter retained for EntityRenderer constructor
    // signature compatibility, but no longer stored. The adapter handles
    // all Phaser scene interactions.
    this.offset = offset;
  }

  /**
   * Place the modular combat tank via the canonical adapter path.
   *
   * Stage 3: this is now a thin delegate. The legacy hull/turret sprite
   * creation path is removed. If modular assets are unavailable, the
   * adapter's sticky state + retryCleanModular() handle loading.
   *
   * VEHICLE-RENDER-UNIFY-01-VH Package C: faction is resolved via
   * resolveFactionOrDiagnosticFallback() — no silent `?? 'cyan'` default.
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

    this.faction = faction;
    this.bodyDir = bodyDir;
    this.turretDir = turretDir;

    // Store anchor for direction updates
    const tileAnchor = tileToScreen(entity.tx, entity.ty);
    this.anchorWorld = {
      x: tileAnchor.x + this.offset.x,
      y: tileAnchor.y + this.offset.y,
    };

    // Store entity for late activation (devtools toggle-on scenario)
    this.storedModularEntity = entity;

    if (!ENABLE_MODULAR_VEHICLE_RENDER || !modularAdapter) {
      // Flag off or no adapter — no rendering. The entity will be
      // invisible until the flag is toggled on and activateCleanModularRender()
      // is called. This is the explicit emergency behavior.
      return;
    }

    this.modularAdapter = modularAdapter;
    this.modularEntityId = entity.id;

    // Default normal-runtime entity is wasp+smoky+m0 (from ModularCombatUnit)
    const chassis = 'wasp';
    const weapon = 'smoky';
    const mod = 'm0';

    modularAdapter.placeModularCombat(
      entity,
      this.anchorWorld,
      chassis,
      weapon,
      mod,
    );

    // Compute and set depth for modular sprites
    const baseDepth = computeDepthValue({
      id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
      offsetX: this.offset.x, offsetY: this.offset.y,
    });
    modularAdapter.setPendingDepth(baseDepth);
  }

  /**
   * Retry clean modular placement for the stored modular-combat entity.
   * Called each frame from EntityRenderer.syncFromState().
   *
   * Stage 3: thin delegate to adapter.retryCleanModular().
   */
  retryCleanModular(): boolean {
    if (!this.modularAdapter || !this.modularEntityId) {
      return false;
    }
    if (!ENABLE_MODULAR_VEHICLE_RENDER) {
      return false;
    }
    return this.modularAdapter.retryCleanModular();
  }

  /**
   * Activate clean modular rendering for the normal-runtime entity.
   * Called when ENABLE_MODULAR_VEHICLE_RENDER is toggled ON after
   * scene initialization (flag was off during place()).
   *
   * Stage 3: kept for devtools toggle-on scenario. Re-attempts
   * placeModularCombat using stored entity info.
   */
  activateCleanModularRender(): void {
    if (this.activationAttempted) return;
    if (!this.storedModularEntity || !this.modularAdapter) return;
    if (!ENABLE_MODULAR_VEHICLE_RENDER) return;

    this.activationAttempted = true;

    const entity = this.storedModularEntity;
    const tileAnchor = tileToScreen(entity.tx, entity.ty);
    const anchorX = tileAnchor.x + this.offset.x;
    const anchorY = tileAnchor.y + this.offset.y;

    this.modularEntityId = entity.id;
    this.anchorWorld = { x: anchorX, y: anchorY };

    const result: LiveAdapterResult = this.modularAdapter.placeModularCombat(
      entity,
      { x: anchorX, y: anchorY },
      'wasp',
      'smoky',
      'm0',
    );

    if (result.usedModular) {
      const baseDepth = computeDepthValue({
        id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
        offsetX: this.offset.x, offsetY: this.offset.y,
      });
      this.modularAdapter.setNormalRuntimeDepth(entity.id, baseDepth);
    } else {
      const baseDepth = computeDepthValue({
        id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
        offsetX: this.offset.x, offsetY: this.offset.y,
      });
      this.modularAdapter.setPendingDepth(baseDepth);
    }
  }

  /**
   * Clear all modular vehicle sprites for normal runtime.
   * Called when ENABLE_MODULAR_VEHICLE_RENDER is toggled OFF.
   *
   * Stage 3: thin delegate to adapter.hideVehicle().
   */
  clearModularVehicleRender(): void {
    if (this.modularAdapter && this.modularEntityId) {
      this.modularAdapter.hideVehicle(this.modularEntityId);
    }
    this.activationAttempted = false;
  }

  /**
   * Change the body direction of the modular tank.
   * Stage 3: thin delegate to adapter.updateDirection().
   */
  setBodyDir(dir: ModularTankDirection): void {
    this.bodyDir = dir;
    if (!this.modularAdapter || !this.modularEntityId || !this.anchorWorld) return;

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
  }

  /**
   * Change the turret direction of the modular tank.
   * Stage 3: thin delegate to adapter.updateDirection().
   */
  setTurretDir(dir: ModularTankDirection): void {
    this.turretDir = dir;
    if (!this.modularAdapter || !this.modularEntityId || !this.anchorWorld) return;

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
  }

  /**
   * Stage 3: no-op. Legacy updateVisuals() repositioned hull/turret
   * sprites using per-dir offset tables. Both are removed; the adapter
   * handles all positioning via composeModularVehicle().
   *
   * Kept as a no-op stub so EntityRenderer's facade methods
   * (updateModularTankVisuals) continue to compile without a wider
   * refactor. Stage 4 may remove this stub when GameScene orchestration
   * is cleaned up.
   */
  updateVisuals(): void {
    // No-op — adapter handles positioning.
  }

  /**
   * Stage 3: no-op. Legacy printOffsetTables() printed the mutable
   * runtime offset tables to console. The tables are removed; nothing
   * to print. Kept as a stub for EntityRenderer facade compatibility.
   */
  printOffsetTables(): void {
    // No-op — offset tables removed.
  }

  /**
   * Stage 3: no-op. Legacy debug overlay (ModularTankDebugOverlay)
   * showed tuner markers and text for offset tables. The overlay is
   * removed along with the tables. Kept as stubs for EntityRenderer
   * facade compatibility.
   */
  isDebugOverlayVisible(): boolean {
    return false;
  }

  toggleDebug(): boolean {
    return false;
  }

  /** Destroy all modular tank state. Stage 3: clean up adapter only. */
  destroy(): void {
    if (this.modularAdapter && this.modularEntityId) {
      this.modularAdapter.removeVehicle(this.modularEntityId);
    }
    this.modularAdapter = null;
    this.modularEntityId = null;
    this.storedModularEntity = null;
    this.anchorWorld = null;
    this.activationAttempted = false;
  }
}
