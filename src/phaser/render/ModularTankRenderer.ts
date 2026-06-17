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
 * Emergency fallback (FIXUP-1 + FIXUP-2):
 *   If modular assets are unavailable on first render:
 *     - If the adapter has sticky state (Stage 2), the last good modular
 *       sprites stay visible — no flicker, no fallback needed.
 *     - If this is the very first render (no sticky), a neutral gray
 *       procedural loading placeholder is shown (isometric box outline,
 *       NOT faction-colored, NOT cyan recolor, NOT legacy wasp+smoky).
 *       The placeholder is removed once modular PNG appears via
 *       retryCleanModular() or a subsequent place() call with
 *       usedModular === true.
 *   The entity is NEVER invisible during loading. No silent cyan
 *   recolor. No legacy Wasp/Smoky fallback.
 *
 * Toggle edge-case (FIXUP-2):
 *   When ENABLE_MODULAR_VEHICLE_RENDER is false but a modularAdapter is
 *   provided, place() stores the adapter + entityId + entity reference
 *   BEFORE showing the loading placeholder and returning. This allows
 *   activateCleanModularRender() to work if the flag is later toggled
 *   on. Without this, the toggle-on scenario would be a no-op (the
 *   adapter reference would be null).
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
  // FIXUP-1: scene field restored for loading placeholder creation.
  // Stage 3 removed this field when legacy sprite creation was removed,
  // but FIXUP-1 needs it back to create the procedural loading
  // placeholder (Phaser.GameObjects.Graphics + Text).
  private scene: Phaser.Scene;
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

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    // FIXUP-1: scene stored for loading placeholder creation.
    this.scene = scene;
    this.offset = offset;
  }

  /**
   * Place the modular combat tank via the canonical adapter path.
   *
   * VEHICLE-RENDER-UNIFY-03-VH-FIXUP-1:
   *   - Captures the result from placeModularCombat().
   *   - If result.usedModular === true: calls setNormalRuntimeDepth() so
   *     the modular sprites get the correct computeDepthValue depth
   *     (fixes Blocker 1 — z-sorting regression).
   *   - If result.usedModular === false: calls setPendingDepth() so
   *     retryCleanModular() applies the depth when textures arrive.
   *   - If result.usedModular === false AND no sticky: shows an explicit
   *     loading placeholder (procedural blockout box) so the entity is
   *     visibly present during asset loading (fixes Blocker 2 — no
   *     permanent or noticeable invisibility).
   *
   * Stage 3: legacy hull/turret sprite path removed. The loading
   * placeholder is a neutral/diagnostic procedural box, NOT a silent
   * cyan recolor. It is removed once modular PNG appears.
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

    // Compute depth once — used by both modular sprites and loading placeholder.
    const baseDepth = computeDepthValue({
      id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
      offsetX: this.offset.x, offsetY: this.offset.y,
    });

    if (!ENABLE_MODULAR_VEHICLE_RENDER || !modularAdapter) {
      // FIXUP-2: Even when the flag is off or no adapter is provided,
      // store the adapter + entityId + entity reference BEFORE showing
      // the loading placeholder and returning. This allows
      // activateCleanModularRender() to work if the flag is later
      // toggled on (devtools toggle-on scenario). Without this, the
      // toggle-on path would be a no-op because this.modularAdapter
      // would still be null.
      if (modularAdapter) {
        this.modularAdapter = modularAdapter;
        this.modularEntityId = entity.id;
      }
      // Show loading placeholder — the entity is visible as a neutral
      // gray procedural box until the flag is toggled on and
      // activateCleanModularRender() is called.
      this.showLoadingPlaceholder(entity, baseDepth);
      return;
    }

    // FIXUP-2: Store adapter + entityId before any branching so the
    // toggle-on scenario always has the references it needs.
    this.modularAdapter = modularAdapter;
    this.modularEntityId = entity.id;

    // Default normal-runtime entity is wasp+smoky+m0 (from ModularCombatUnit)
    const chassis = 'wasp';
    const weapon = 'smoky';
    const mod = 'm0';

    // FIXUP-1 Blocker 1: capture the result so we can call the right
    // depth setter. Previously this always called setPendingDepth(),
    // which is a no-op when pendingCombat is null (i.e. when
    // usedModular === true). That left modular sprites at the adapter's
    // default baseDepth, regressing z-sorting around buildings/resources.
    const result = modularAdapter.placeModularCombat(
      entity,
      this.anchorWorld,
      chassis,
      weapon,
      mod,
    );

    if (result.usedModular) {
      // Modular sprites are active — set their depth directly.
      modularAdapter.setNormalRuntimeDepth(entity.id, baseDepth);
      // Hide any loading placeholder that may have been shown by a
      // previous place() call (e.g. devtools toggle cycling).
      this.hideLoadingPlaceholder();
    } else {
      // Modular assets not yet available — store depth for retry.
      modularAdapter.setPendingDepth(baseDepth);
      // FIXUP-1 Blocker 2: show an explicit loading placeholder so the
      // entity is visibly present during asset loading. This is NOT a
      // silent cyan recolor — it is a neutral/diagnostic procedural box
      // that is removed once modular PNG appears.
      this.showLoadingPlaceholder(entity, baseDepth);
    }
  }

  // ─── FIXUP-1 Blocker 2: explicit loading placeholder ─────────────
  //
  // When modular assets are unavailable on first render and the adapter
  // has no sticky state, the entity would otherwise be invisible. This
  // procedural placeholder ensures the entity is visibly present:
  //   - neutral gray box (NOT faction-colored — avoids silent cyan recolor);
  //   - positioned at the entity's tile anchor;
  //   - depth-sorted via computeDepthValue;
  //   - removed once retryCleanModular() succeeds and modular PNG appears.
  //
  // The placeholder is a Phaser.GameObjects.Graphics drawn as a simple
  // isometric box outline. It does NOT use any faction color, does NOT
  // use getWaspHullKey/getSmokyTurretKey, and does NOT change
  // composeModularVehicle() placement math.

  /** Loading placeholder Graphics object, or null when not shown. */
  private loadingPlaceholder: Phaser.GameObjects.Graphics | null = null;

  /**
   * Show a procedural loading placeholder at the entity's tile anchor.
   * The placeholder is a neutral gray isometric box outline — NOT
   * faction-colored, NOT a cyan recolor. It is removed by
   * hideLoadingPlaceholder() once modular PNG appears.
   */
  private showLoadingPlaceholder(entity: RenderableEntity, depth: number): void {
    // Don't create a duplicate if already shown
    if (this.loadingPlaceholder) {
      return;
    }

    if (!this.scene) {
      return;
    }

    const g = this.scene.add.graphics();
    const ax = this.anchorWorld?.x ?? 0;
    const ay = this.anchorWorld?.y ?? 0;

    // Draw a neutral gray isometric box outline (NOT faction-colored).
    // This is a diagnostic placeholder, not a gameplay visual.
    const boxW = 30;
    const boxH = 15;
    const boxZ = 20;

    // Bottom face (diamond)
    g.lineStyle(2, 0x888888, 0.8);
    g.beginPath();
    g.moveTo(ax, ay + boxH);
    g.lineTo(ax + boxW, ay);
    g.lineTo(ax, ay - boxH);
    g.lineTo(ax - boxW, ay);
    g.closePath();
    g.strokePath();

    // Top face (diamond, elevated by boxZ)
    g.lineStyle(2, 0xaaaaaa, 0.8);
    g.beginPath();
    g.moveTo(ax, ay + boxH - boxZ);
    g.lineTo(ax + boxW, ay - boxZ);
    g.lineTo(ax, ay - boxH - boxZ);
    g.lineTo(ax - boxW, ay - boxZ);
    g.closePath();
    g.strokePath();

    // Vertical edges
    g.lineStyle(2, 0x888888, 0.8);
    g.beginPath();
    g.moveTo(ax + boxW, ay);
    g.lineTo(ax + boxW, ay - boxZ);
    g.moveTo(ax, ay + boxH);
    g.lineTo(ax, ay + boxH - boxZ);
    g.moveTo(ax - boxW, ay);
    g.lineTo(ax - boxW, ay - boxZ);
    g.strokePath();

    // "Loading" text label (neutral white, small)
    const label = this.scene.add.text(ax, ay - boxZ - 8, '…', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#33333388',
      padding: { x: 3, y: 1 },
    });
    label.setOrigin(0.5, 1);
    label.setDepth(depth + 1);

    g.setDepth(depth);
    this.loadingPlaceholder = g;
    this.loadingPlaceholderLabel = label;

    if (!this.loadingLogged) {
      console.log(`[ModularTankRenderer] Showing loading placeholder for entity ${entity.id} (modular assets loading)`);
      this.loadingLogged = true;
    }
  }

  /** Loading placeholder text label, or null when not shown. */
  private loadingPlaceholderLabel: Phaser.GameObjects.Text | null = null;

  /** Whether the loading placeholder log has been emitted (once). */
  private loadingLogged = false;

  /**
   * Hide and destroy the loading placeholder. Called when modular PNG
   * appears (result.usedModular === true) or when the entity is destroyed.
   */
  private hideLoadingPlaceholder(): void {
    if (this.loadingPlaceholder) {
      this.loadingPlaceholder.destroy();
      this.loadingPlaceholder = null;
    }
    if (this.loadingPlaceholderLabel) {
      this.loadingPlaceholderLabel.destroy();
      this.loadingPlaceholderLabel = null;
    }
  }

  /**
   * Retry clean modular placement for the stored modular-combat entity.
   * Called each frame from EntityRenderer.syncFromState().
   *
   * FIXUP-1: when retry succeeds, hide the loading placeholder so the
   * modular PNG is the only visible visual. When retry fails (assets
   * still loading), keep the placeholder visible.
   */
  retryCleanModular(): boolean {
    if (!this.modularAdapter || !this.modularEntityId) {
      return false;
    }
    if (!ENABLE_MODULAR_VEHICLE_RENDER) {
      return false;
    }
    const succeeded = this.modularAdapter.retryCleanModular();
    if (succeeded) {
      // Modular PNG is now active — hide the loading placeholder.
      this.hideLoadingPlaceholder();
    }
    return succeeded;
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
      // FIXUP-1: hide loading placeholder on successful activation.
      this.hideLoadingPlaceholder();
    } else {
      const baseDepth = computeDepthValue({
        id: `modular-${entity.tx}-${entity.ty}`, type: 'unit', tx: entity.tx, ty: entity.ty,
        offsetX: this.offset.x, offsetY: this.offset.y,
      });
      this.modularAdapter.setPendingDepth(baseDepth);
      // FIXUP-1: show loading placeholder while assets load.
      this.showLoadingPlaceholder(entity, baseDepth);
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

  /** Destroy all modular tank state. FIXUP-1: also clean up loading placeholder. */
  destroy(): void {
    // FIXUP-1: clean up loading placeholder if still shown.
    this.hideLoadingPlaceholder();
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
