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
 */

import Phaser from 'phaser';
import {
  getSmokyTurretKey,
  getWaspHullKey,
} from '../../assets/modularUnitAssets';
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
import { ModularTankDebugOverlay } from '../debug/ModularTankDebugOverlay';

/** Default initial visibility for the debug overlay. */
const MODULAR_TANK_DEBUG = false;

/** Render scale for the modular tank sprites (ARCH-05A: 25% reduction). */
export const MODULAR_TANK_SCALE = MODULAR_RENDER_SCALE;

/** Sprite origin for the hull image. */
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

  /** Debug overlay for tuner markers and text. */
  private debugOverlay: ModularTankDebugOverlay | null = null;

  /** Current visibility state for the debug overlay. */
  private debugVisible: boolean = MODULAR_TANK_DEBUG;

  /** Optional one-time render confirmation log. */
  private combatLogged: boolean = false;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  /**
   * Place the modular combat tank (hull + turret) and create the debug overlay.
   * Called once during initial entity rendering.
   */
  place(entity: RenderableEntity): void {
    const faction: Faction = entity.faction ?? 'cyan';
    const bodyDir: ModularTankDirection = (entity.dir ?? 2) as ModularTankDirection;
    const turretDir: ModularTankDirection = (entity.turretDir ?? bodyDir) as ModularTankDirection;

    // Hull texture uses bodyDir; turret texture uses turretDir.
    const hullKey = getWaspHullKey(faction, bodyDir);
    const turretKey = getSmokyTurretKey(faction, turretDir);

    const tileAnchor = tileToScreen(entity.tx, entity.ty);
    const anchorWorldX = tileAnchor.x + this.offset.x;
    const anchorWorldY = tileAnchor.y + this.offset.y;

    // Hull position = anchor + scaleTransform(hullOffset[bodyDir])
    const hullOff = applyScaleTransform(MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR[bodyDir]);
    const hullWorldX = anchorWorldX + hullOff.x;
    const hullWorldY = anchorWorldY + hullOff.y;
    const baseDepth = 100 + hullWorldY;

    const hull = this.scene.add.image(hullWorldX, hullWorldY, hullKey);
    hull.setScale(MODULAR_TANK_SCALE);
    hull.setOrigin(MODULAR_TANK_HULL_ORIGIN.x, MODULAR_TANK_HULL_ORIGIN.y);
    hull.setDepth(baseDepth);

    // Turret mount position = anchor + scaleTransform(turretMount[bodyDir]) (NOT turretDir!)
    const turretMountOff = applyScaleTransform(MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR[bodyDir]);
    const turretWorldX = anchorWorldX + turretMountOff.x;
    const turretWorldY = anchorWorldY + turretMountOff.y;
    const turret = this.scene.add.image(
      turretWorldX,
      turretWorldY,
      turretKey,
    );
    turret.setScale(MODULAR_TANK_SCALE);
    turret.setOrigin(MODULAR_TANK_TURRET_ORIGIN.x, MODULAR_TANK_TURRET_ORIGIN.y);
    turret.setDepth(baseDepth + 1);

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
      console.log('[ModularTankRenderer] Rendered modular combat: wasp_m0 + smoky_m0');
      this.combatLogged = true;
    }
  }

  /**
   * Change the body direction of the modular tank.
   * Changes hull texture and turret mount position (mount depends on bodyDir).
   * Does NOT change turret texture (that's setTurretDir).
   */
  setBodyDir(dir: ModularTankDirection): void {
    if (!this.hull || !this.turret) return;
    this.bodyDir = dir;
    tunerState.bodyDir = dir;

    // Hull texture follows bodyDir
    this.hull.setTexture(getWaspHullKey(this.faction, dir));

    // Turret mount position changes because bodyDir changed
    this.updateVisuals();
  }

  /**
   * Change the turret direction of the modular tank.
   * Changes turret texture ONLY. Turret mount position stays the same
   * (it depends on bodyDir, not turretDir).
   */
  setTurretDir(dir: ModularTankDirection): void {
    if (!this.turret) return;
    this.turretDir = dir;
    tunerState.turretDir = dir;

    // Turret texture follows turretDir; position stays (depends on bodyDir)
    this.turret.setTexture(getSmokyTurretKey(this.faction, dir));

    // Update overlay text to reflect new turretDir (positions unchanged)
    this.updateVisuals();
  }

  /**
   * Reposition hull and turret sprites from current runtime offsets
   * keyed by bodyDir, then rebuild the debug overlay markers and text.
   * Called by GameScene after keyboard offset adjustments or direction changes.
   */
  updateVisuals(): void {
    if (!this.hull || !this.turret || !this.anchorWorld) return;

    const ax = this.anchorWorld.x;
    const ay = this.anchorWorld.y;
    const bodyDir = this.bodyDir;

    // Hull position = anchor + scaleTransform(hullOffset[bodyDir])
    const hullOff = applyScaleTransform(MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR[bodyDir]);
    const hullX = ax + hullOff.x;
    const hullY = ay + hullOff.y;
    this.hull.setPosition(hullX, hullY);

    // Turret mount position = anchor + scaleTransform(turretMount[bodyDir])
    const turretMountOff = applyScaleTransform(MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR[bodyDir]);
    const turretX = ax + turretMountOff.x;
    const turretY = ay + turretMountOff.y;
    this.turret.setPosition(turretX, turretY);

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
