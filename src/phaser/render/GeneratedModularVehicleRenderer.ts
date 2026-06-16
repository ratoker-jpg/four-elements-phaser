/**
 * GeneratedModularVehicleRenderer — MODULAR-ALL-FACTIONS-01C.
 *
 * The clean modular generated vehicle renderer path. It draws a hybrid
 * modular vehicle (independent hull + turret sprites) from a typed
 * ModularVehicleVisual, using the pure metadata-driven composition module
 * to align the turret pivot onto the hull socket.
 *
 * It does NOT:
 *   - copy procedural turret math from BlockoutVehicleRenderer;
 *   - extend the failed pilot generated-turret composition path;
 *   - use per-direction pixel offset tables, zHeight hacks, or Wasp-only
 *     constants.
 *
 * It is currently surfaced as an isolated devtools-only QA overlay
 * (fixed-screen, scrollFactor 0), driven by ModularVehicleDevtoolsPanel.
 * Live world placement of the composed sprites can reuse this same plan
 * later; the composition is engine-agnostic and independent of where the
 * anchor comes from.
 *
 * MODULAR-ALL-FACTIONS-01C adds:
 *   - tile overlay (2:1 isometric diamond, devtools-only);
 *   - preview calibration controls (modelScale, hullScale, turretScale,
 *     hullOffset, turretOffset);
 *   - expanded left debug overlay with calibration data.
 *
 * Calibration values are devtools-only. They are never persisted or applied
 * to production metadata/config.
 *
 * Fallback: when a texture or metadata is missing the renderer draws a
 * labelled blockout box instead of crashing, and exposes the reason.
 */

import Phaser from 'phaser';
import {
  composeModularVehicle,
  MODULAR_VEHICLE_DISPLAY_SCALE,
  MODULAR_FRAME_SIZE,
  getHullVisualScaleMultiplier,
  type ModularRenderPlan,
  type ScreenPoint,
} from '../../modular/modularVehicleComposition';
import {
  requestModularVehicleSet,
  isModularVehicleSetLoaded,
  type ModularLoadDiagnostics,
} from '../../modular/modularVehicleRuntimeLoader';
import {
  DEFAULT_MODULAR_VEHICLE_VISUAL,
  type ModularVehicleVisual,
} from '../../modular/modularVehicleVisual';
import {
  DEFAULT_MODULAR_PREVIEW_CALIBRATION,
  type ModularPreviewCalibration,
  effectiveHullScale,
  effectiveTurretScale,
} from '../../modular/modularPreviewCalibration';
import type { GeneratedModularDir16 } from '../../assets/generatedModularVehicleAssets.generated';
import {
  getHullMountSlot,
  getMountSlotPlacement,
} from '../../modular/modularVehicleMountSlots';

const OVERLAY_DEPTH = 21000;
const BACKDROP_COLOR = 0x0b0f1e;
const BACKDROP_ALPHA = 0.96;
const COLOR_SOCKET = 0xff3da1; // magenta — hull socket
const COLOR_PIVOT = 0x3dff8b; // green — turret pivot
const COLOR_FALLBACK = 0xff7043;
const COLOR_TILE = 0x4488ff; // blue — isometric tile outline
const COLOR_TILE_FILL = 0x2244aa; // darker blue — tile fill
const COLOR_TILE_CENTER = 0xffcc44; // gold — tile center cross
const COLOR_TILE_LABEL = 0x6699cc; // light blue — tile corner labels

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#d4e4ff',
};

// Tile overlay constants (from CAMERA_PROJECTION_CONTRACT.md)
const TILE_W = 76;
const TILE_H = 38;
const BASIS_X: ScreenPoint = { x: TILE_W / 2, y: TILE_H / 2 };    // {38, 19}
const BASIS_Y: ScreenPoint = { x: -TILE_W / 2, y: TILE_H / 2 };   // {-38, 19}

export interface ModularRendererState {
  active: boolean;
  visual: ModularVehicleVisual;
  hullDir16: number;
  turretDir16: number;
  available: boolean | null;
  fallbackReason: string | null;
  setLoaded: boolean;
  queuedCount: number | null;
  markersVisible: boolean;
  calibration: ModularPreviewCalibration;
}

export class GeneratedModularVehicleRenderer {
  private scene: Phaser.Scene;
  private _active = false;

  private visual: ModularVehicleVisual = { ...DEFAULT_MODULAR_VEHICLE_VISUAL };
  private hullDir16: GeneratedModularDir16 = 0;
  private turretDir16: GeneratedModularDir16 = 0;
  private markersVisible = true;
  private calibration: ModularPreviewCalibration = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };

  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  private hullSprite: Phaser.GameObjects.Image | null = null;
  private turretSprite: Phaser.GameObjects.Image | null = null;
  private fallbackGfx: Phaser.GameObjects.Graphics | null = null;
  private markers: Phaser.GameObjects.Graphics | null = null;
  private tileGfx: Phaser.GameObjects.Graphics | null = null;
  private labelText: Phaser.GameObjects.Text | null = null;

  private lastPlan: ModularRenderPlan | null = null;
  private lastLoad: ModularLoadDiagnostics | null = null;
  private loadRequested = false;
  private onStateChange: (() => void) | null = null;

  // Calibrated positions stored for diagnostics
  private _calibratedHullPos: ScreenPoint = { x: 0, y: 0 };
  private _calibratedTurretPos: ScreenPoint = { x: 0, y: 0 };
  private _calibratedSocket: ScreenPoint = { x: 0, y: 0 };
  private _calibratedPivot: ScreenPoint = { x: 0, y: 0 };
  private _effHullScale = 0;
  private _effTurretScale = 0;
  private _hullDisplaySize = 0;
  private _turretDisplaySize = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get active(): boolean {
    return this._active;
  }

  setOnStateChange(cb: (() => void) | null): void {
    this.onStateChange = cb;
  }

  getState(): ModularRendererState {
    return {
      active: this._active,
      visual: { ...this.visual },
      hullDir16: this.hullDir16,
      turretDir16: this.turretDir16,
      available: this.lastPlan?.available ?? null,
      fallbackReason: this.lastPlan?.fallbackReason ?? null,
      setLoaded: isModularVehicleSetLoaded(this.scene, this.visual),
      queuedCount: this.lastLoad?.queuedCount ?? null,
      markersVisible: this.markersVisible,
      calibration: { ...this.calibration },
    };
  }

  getLastLoadDiagnostics(): ModularLoadDiagnostics | null {
    return this.lastLoad;
  }

  getCalibration(): ModularPreviewCalibration {
    return { ...this.calibration };
  }

  toggle(): void {
    if (this._active) this.close();
    else this.open();
  }

  open(): void {
    if (this._active) return;
    this._active = true;
    this.ensureAssetsLoaded();
    this.build();
    this.refresh();
    this.onStateChange?.();
  }

  close(): void {
    if (!this._active) return;
    this._active = false;
    this.teardown();
    this.onStateChange?.();
  }

  destroy(): void {
    this.teardown();
    this.onStateChange = null;
  }

  // ─── Selection controls ───────────────────────────────────────────

  /** Replace the visual (independent hull/turret/mod/faction selection). */
  setVisual(visual: ModularVehicleVisual): void {
    this.visual = { ...visual };
    this.loadRequested = false;
    if (this._active) {
      this.ensureAssetsLoaded();
      this.refresh();
      this.onStateChange?.();
    }
  }

  /** Patch a subset of fields (e.g. only hullMod). Hull/turret stay independent. */
  patchVisual(patch: Partial<ModularVehicleVisual>): void {
    this.setVisual({ ...this.visual, ...patch });
  }

  cycleHullDir(delta: number): void {
    this.hullDir16 = (((this.hullDir16 + delta) % 16) + 16) % 16 as GeneratedModularDir16;
    if (this._active) {
      this.refresh();
      this.onStateChange?.();
    }
  }

  cycleTurretDir(delta: number): void {
    this.turretDir16 = (((this.turretDir16 + delta) % 16) + 16) % 16 as GeneratedModularDir16;
    if (this._active) {
      this.refresh();
      this.onStateChange?.();
    }
  }

  toggleMarkers(): void {
    this.markersVisible = !this.markersVisible;
    this.applyMarkersVisibility();
    this.onStateChange?.();
  }

  reset(): void {
    this.visual = { ...DEFAULT_MODULAR_VEHICLE_VISUAL };
    this.hullDir16 = 0;
    this.turretDir16 = 0;
    this.markersVisible = true;
    this.loadRequested = false;
    if (this._active) {
      this.ensureAssetsLoaded();
      this.refresh();
      this.onStateChange?.();
    }
  }

  // ─── Calibration controls ────────────────────────────────────────

  /** Set calibration state (devtools-only, does not persist). */
  setCalibration(cal: ModularPreviewCalibration): void {
    this.calibration = { ...cal };
    if (this._active) {
      this.refresh();
      this.onStateChange?.();
    }
  }

  /** Reset calibration to defaults (does not reset visual/dirs). */
  resetCalibration(): void {
    this.calibration = { ...DEFAULT_MODULAR_PREVIEW_CALIBRATION };
    if (this._active) {
      this.refresh();
      this.onStateChange?.();
    }
  }

  /** Toggle the isometric tile overlay on/off. */
  toggleTile(): void {
    this.calibration.showTile = !this.calibration.showTile;
    if (this._active) {
      this.refresh();
      this.onStateChange?.();
    }
  }

  // ─── Asset loading (on-demand, 32 PNG max) ────────────────────────

  private ensureAssetsLoaded(): void {
    if (this.loadRequested) return;
    const diag = requestModularVehicleSet(this.scene, this.visual);
    this.lastLoad = diag;
    this.loadRequested = true;
    if (diag.queuedCount > 0) {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (this._active) {
          this.refresh();
          this.onStateChange?.();
        }
      });
      this.scene.load.start();
    }
  }

  // ─── Build / teardown ─────────────────────────────────────────────

  private build(): void {
    if (this.backdrop) return;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.backdrop = this.scene.add
      .rectangle(w / 2, h / 2, w, h, BACKDROP_COLOR, BACKDROP_ALPHA)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH)
      .setInteractive();

    this.tileGfx = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 1);

    this.fallbackGfx = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 1);

    this.markers = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 4);

    this.labelText = this.scene.add
      .text(16, 16, '', TEXT_STYLE)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 5);
  }

  private teardown(): void {
    this.hullSprite?.destroy();
    this.hullSprite = null;
    this.turretSprite?.destroy();
    this.turretSprite = null;
    this.fallbackGfx?.destroy();
    this.fallbackGfx = null;
    this.tileGfx?.destroy();
    this.tileGfx = null;
    this.markers?.destroy();
    this.markers = null;
    this.labelText?.destroy();
    this.labelText = null;
    this.backdrop?.destroy();
    this.backdrop = null;
  }

  // ─── Preview anchor ───────────────────────────────────────────────

  private getPreviewAnchor(): ScreenPoint {
    return {
      x: this.scene.scale.width * 0.5,
      y: this.scene.scale.height * 0.55,
    };
  }

  // ─── Refresh ──────────────────────────────────────────────────────

  private refresh(): void {
    if (!this._active || !this.markers || !this.labelText || !this.fallbackGfx) {
      return;
    }

    const anchor = this.getPreviewAnchor();

    const plan = composeModularVehicle({
      visual: this.visual,
      hullDir16: this.hullDir16,
      turretDir16: this.turretDir16,
      anchor,
      displayScale: MODULAR_VEHICLE_DISPLAY_SCALE,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });
    this.lastPlan = plan;

    // Draw tile overlay first (behind everything).
    this.drawTileOverlay(anchor);

    // Draw sprites with calibration applied.
    this.drawSpritesWithCalibration(plan);

    this.drawFallback();
    this.drawMarkers();
    this.drawLabels(plan, anchor);
    this.applyMarkersVisibility();
  }

  // ─── Tile overlay ─────────────────────────────────────────────────

  private drawTileOverlay(center: ScreenPoint): void {
    const g = this.tileGfx;
    if (!g) return;
    g.clear();

    if (!this.calibration.showTile) return;

    const halfW = 0.5;
    const cx = center.x;
    const cy = center.y;

    // Isometric diamond: project the 4 corners of a 1x1 world-space tile.
    const nw: ScreenPoint = {
      x: cx + (-halfW) * BASIS_X.x + (-halfW) * BASIS_Y.x,
      y: cy + (-halfW) * BASIS_X.y + (-halfW) * BASIS_Y.y,
    };
    const ne: ScreenPoint = {
      x: cx + halfW * BASIS_X.x + (-halfW) * BASIS_Y.x,
      y: cy + halfW * BASIS_X.y + (-halfW) * BASIS_Y.y,
    };
    const se: ScreenPoint = {
      x: cx + halfW * BASIS_X.x + halfW * BASIS_Y.x,
      y: cy + halfW * BASIS_X.y + halfW * BASIS_Y.y,
    };
    const sw: ScreenPoint = {
      x: cx + (-halfW) * BASIS_X.x + halfW * BASIS_Y.x,
      y: cy + (-halfW) * BASIS_X.y + halfW * BASIS_Y.y,
    };

    // Fill tile using a polygon path.
    g.fillStyle(COLOR_TILE_FILL, 0.25);
    g.beginPath();
    g.moveTo(nw.x, nw.y);
    g.lineTo(ne.x, ne.y);
    g.lineTo(se.x, se.y);
    g.lineTo(sw.x, sw.y);
    g.closePath();
    g.fillPath();

    // Stroke tile outline.
    g.lineStyle(1.5, COLOR_TILE, 0.7);
    g.beginPath();
    g.moveTo(nw.x, nw.y);
    g.lineTo(ne.x, ne.y);
    g.lineTo(se.x, se.y);
    g.lineTo(sw.x, sw.y);
    g.closePath();
    g.strokePath();

    // Center cross marker.
    const crossSize = 6;
    g.lineStyle(1, COLOR_TILE_CENTER, 0.8);
    g.beginPath();
    g.moveTo(cx - crossSize, cy);
    g.lineTo(cx + crossSize, cy);
    g.moveTo(cx, cy - crossSize);
    g.lineTo(cx, cy + crossSize);
    g.strokePath();

    // Corner markers (small circles at N/E/S/W).
    if (this.markersVisible) {
      g.lineStyle(0, 0, 0);
      const cornerR = 3;
      const corners = [nw, ne, se, sw];
      for (const c of corners) {
        g.fillStyle(COLOR_TILE_LABEL, 0.6);
        g.fillCircle(c.x, c.y, cornerR);
      }
    }
  }

  // ─── Sprites with calibration ─────────────────────────────────────

  private drawSpritesWithCalibration(plan: ModularRenderPlan): void {
    const cal = this.calibration;
    const hullScaleMultiplier = getHullVisualScaleMultiplier(this.visual.hullId);

    const effHullScale = effectiveHullScale(
      MODULAR_VEHICLE_DISPLAY_SCALE, hullScaleMultiplier, cal,
    );
    const effTurretScale = effectiveTurretScale(
      MODULAR_VEHICLE_DISPLAY_SCALE, cal,
    );

    const hullDisplaySize = MODULAR_FRAME_SIZE * effHullScale;
    const turretDisplaySize = MODULAR_FRAME_SIZE * effTurretScale;

    // Hull position: base plan position + hull offset.
    const hullPos: ScreenPoint = {
      x: plan.hull.position.x + cal.hullOffsetX,
      y: plan.hull.position.y + cal.hullOffsetY,
    };

    // Recompute socket position with calibrated hull display size.
    const socketOffsetX = (plan.socketScreen.x - plan.hull.position.x);
    const socketOffsetY = (plan.socketScreen.y - plan.hull.position.y);
    const baseHullDisplaySize = plan.hull.displaySize;
    const socketScaleRatio = baseHullDisplaySize > 0 ? hullDisplaySize / baseHullDisplaySize : 1;
    const calibratedSocket: ScreenPoint = {
      x: hullPos.x + socketOffsetX * socketScaleRatio,
      y: hullPos.y + socketOffsetY * socketScaleRatio,
    };

    // Turret position: adjust for calibrated socket + turret offset.
    const turretDelta: ScreenPoint = {
      x: plan.turret.position.x - plan.socketScreen.x,
      y: plan.turret.position.y - plan.socketScreen.y,
    };
    const turretPos: ScreenPoint = {
      x: calibratedSocket.x + turretDelta.x + cal.turretOffsetX,
      y: calibratedSocket.y + turretDelta.y + cal.turretOffsetY,
    };

    // Calibrated pivot position.
    const calibratedPivot: ScreenPoint = {
      x: turretPos.x + (plan.pivotScreen.x - plan.turret.position.x),
      y: turretPos.y + (plan.pivotScreen.y - plan.turret.position.y),
    };

    // Store for diagnostics.
    this._calibratedHullPos = hullPos;
    this._calibratedTurretPos = turretPos;
    this._calibratedSocket = calibratedSocket;
    this._calibratedPivot = calibratedPivot;
    this._effHullScale = effHullScale;
    this._effTurretScale = effTurretScale;
    this._hullDisplaySize = hullDisplaySize;
    this._turretDisplaySize = turretDisplaySize;

    // Hull sprite.
    if (plan.hull.textureKey && this.scene.textures.exists(plan.hull.textureKey)) {
      if (!this.hullSprite) {
        this.hullSprite = this.scene.add
          .image(0, 0, plan.hull.textureKey)
          .setScrollFactor(0)
          .setDepth(OVERLAY_DEPTH + 2);
      } else {
        this.hullSprite.setTexture(plan.hull.textureKey);
      }
      this.hullSprite
        .setOrigin(plan.hull.origin.x, plan.hull.origin.y)
        .setScale(effHullScale)
        .setPosition(hullPos.x, hullPos.y)
        .setVisible(true);
    } else {
      this.hullSprite?.setVisible(false);
    }

    // Turret sprite.
    if (plan.turret.textureKey && this.scene.textures.exists(plan.turret.textureKey)) {
      if (!this.turretSprite) {
        this.turretSprite = this.scene.add
          .image(0, 0, plan.turret.textureKey)
          .setScrollFactor(0)
          .setDepth(OVERLAY_DEPTH + 3);
      } else {
        this.turretSprite.setTexture(plan.turret.textureKey);
      }
      this.turretSprite
        .setOrigin(plan.turret.origin.x, plan.turret.origin.y)
        .setScale(effTurretScale)
        .setPosition(turretPos.x, turretPos.y)
        .setVisible(true);
    } else {
      this.turretSprite?.setVisible(false);
    }
  }

  private drawFallback(): void {
    const g = this.fallbackGfx!;
    g.clear();
    const half = this._hullDisplaySize * 0.5;
    if (this.lastPlan && !this.lastPlan.hull.textureKey) {
      g.lineStyle(2, COLOR_FALLBACK, 1);
      g.strokeRect(
        this._calibratedHullPos.x - half,
        this._calibratedHullPos.y - half,
        this._hullDisplaySize,
        this._hullDisplaySize,
      );
    }
    if (this.lastPlan && !this.lastPlan.turret.textureKey) {
      const th = this._turretDisplaySize * 0.3;
      g.lineStyle(2, COLOR_FALLBACK, 1);
      g.strokeRect(
        this._calibratedTurretPos.x - th,
        this._calibratedTurretPos.y - th,
        th * 2,
        th * 2,
      );
    }
  }

  private drawMarkers(): void {
    const g = this.markers!;
    g.clear();
    g.lineStyle(2, COLOR_SOCKET, 1);
    g.strokeCircle(this._calibratedSocket.x, this._calibratedSocket.y, 8);
    g.lineStyle(2, COLOR_PIVOT, 1);
    g.strokeCircle(this._calibratedPivot.x, this._calibratedPivot.y, 5);
  }

  private drawLabels(plan: ModularRenderPlan, anchor: ScreenPoint): void {
    const v = this.visual;
    const cal = this.calibration;
    const hullScaleMultiplier = getHullVisualScaleMultiplier(v.hullId);
    const load = this.lastLoad;

    const socketPivotDx = this._calibratedPivot.x - this._calibratedSocket.x;
    const socketPivotDy = this._calibratedPivot.y - this._calibratedSocket.y;
    const socketPivotDelta = Math.abs(socketPivotDx) > 0.5 || Math.abs(socketPivotDy) > 0.5
      ? `  delta: ${socketPivotDx.toFixed(1)}, ${socketPivotDy.toFixed(1)}`
      : '';

    const halfW = 0.5;
    const cx = anchor.x;
    const cy = anchor.y;
    const tileNW = { x: cx + (-halfW) * BASIS_X.x + (-halfW) * BASIS_Y.x, y: cy + (-halfW) * BASIS_X.y + (-halfW) * BASIS_Y.y };
    const tileSE = { x: cx + halfW * BASIS_X.x + halfW * BASIS_Y.x, y: cy + halfW * BASIS_X.y + halfW * BASIS_Y.y };

    const lines = [
      'MODULAR-ALL-FACTIONS-01C — preview calibration',
      '',
      `hull:   ${v.hullId} / ${v.hullMod}   dir ${this.hullDir16} (${plan.hullDirSuffix})`,
      `turret: ${v.turretId} / ${v.turretMod}   dir ${this.turretDir16} (${plan.turretDirSuffix})`,
      `faction: ${v.faction}`,
      '',
      `available: ${plan.available}` +
        (plan.fallbackReason ? `   fallback: ${plan.fallbackReason}` : ''),
      `hull metadata: ${plan.hullMetadataPresent}   turret metadata: ${plan.turretMetadataPresent}`,
      `set loaded: ${isModularVehicleSetLoaded(this.scene, v)}` +
        (load ? `   queued: ${load.queuedCount}` : ''),
      '',
      '--- Tile / Calibration ---',
      `tile overlay: ${cal.showTile ? 'ON' : 'OFF'}`,
      `markers: ${this.markersVisible ? 'ON' : 'OFF'}`,
      `modelScale: ${cal.modelScale.toFixed(2)}`,
      `hullScale extra: ${cal.hullScale.toFixed(2)}`,
      `turretScale extra: ${cal.turretScale.toFixed(2)}`,
      `Dictator/base hull mult: ${hullScaleMultiplier}`,
      `effective hull scale: ${this._effHullScale.toFixed(4)}`,
      `effective turret scale: ${this._effTurretScale.toFixed(4)}`,
      `hullOffset (devtools extra): ${cal.hullOffsetX} / ${cal.hullOffsetY}`,
      `turretOffset (devtools extra): ${cal.turretOffsetX} / ${cal.turretOffsetY}`,
      `pixelStep: ${cal.pixelStep}   scaleStep: ${cal.scaleStep}`,
      '',
      '--- Positions ---',
      `preview center: ${anchor.x.toFixed(0)}, ${anchor.y.toFixed(0)}`,
      `hull pos: ${this._calibratedHullPos.x.toFixed(1)}, ${this._calibratedHullPos.y.toFixed(1)}`,
      `turret pos: ${this._calibratedTurretPos.x.toFixed(1)}, ${this._calibratedTurretPos.y.toFixed(1)}`,
      `socket: ${this._calibratedSocket.x.toFixed(1)}, ${this._calibratedSocket.y.toFixed(1)}`,
      `pivot: ${this._calibratedPivot.x.toFixed(1)}, ${this._calibratedPivot.y.toFixed(1)}`,
      `socket-pivot${socketPivotDelta}`,
      `tile NW: ${tileNW.x.toFixed(0)}, ${tileNW.y.toFixed(0)}   SE: ${tileSE.x.toFixed(0)}, ${tileSE.y.toFixed(0)}`,
      '',
      `hull key:   ${plan.hull.textureKey ?? 'null (fallback)'}`,
      `turret key: ${plan.turret.textureKey ?? 'null (fallback)'}`,
      '',
      'calibration is devtools-only',
      'does not modify metadata/assets',
    ];

    // MODULAR-RUNTIME-04B-FIX: show the production mount-slot placement that the
    // live runtime uses, so the preview reflects the same source of truth (and
    // no longer reads 0/0 for hulls like Wasp). The devtools calibration values
    // above stack on top of this production base.
    const mountSlot = getHullMountSlot(v.hullId);
    const placement = getMountSlotPlacement(v.hullId);
    lines.splice(
      lines.indexOf('--- Tile / Calibration ---'),
      0,
      '--- Mount slot (production placement) ---',
      `mountSlot: ${mountSlot}`,
      `hullOffset (production): ${placement.hullOffset.x} / ${placement.hullOffset.y}`,
      `turretOffset (production): ${placement.turretOffset.x} / ${placement.turretOffset.y}`,
      '',
    );

    this.labelText!.setText(lines);
  }

  private applyMarkersVisibility(): void {
    this.markers?.setVisible(this.markersVisible);
    this.labelText?.setVisible(this.markersVisible);
  }
}
