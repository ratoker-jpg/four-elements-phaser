/**
 * @legacy Wasp/Smoky pilot-era proof harness.
 * Do not import into MODULAR-RUNTIME-* code paths.
 * The clean modular runtime must use src/modular/* + generated modular manifests.
 *
 * GeneratedVehicleProofHarness — MODULAR-PROOF-01.
 *
 * Isolated, devtools-only proof harness that composes the existing generated
 * Wasp cyan m0 hull sprite + Smoky cyan m0 turret sprite in clean 2D
 * sprite-space, with debug overlay markers, OUTSIDE the quarantined
 * BlockoutVehicleRenderer procedural turret path.
 *
 * Purpose (visual proof, not live integration):
 *   - Show where the hull socket marker lands on the Wasp PNG.
 *   - Show where the turret pivot marker lands on the Smoky PNG.
 *   - Show whether pivot and socket coincide after composition.
 *   - Demonstrate (via a clearly-labelled diagnostic toggle) whether zHeight
 *     helps or double-counts for baked sprite composition.
 *
 * This harness:
 *   - Renders at fixed screen coordinates (scrollFactor 0), fully isolated
 *     from Arena world-space and the live vehicle renderers.
 *   - Does NOT re-enable ENABLE_PILOT_GENERATED_TURRET_COMPOSITION.
 *   - Does NOT touch Arena live vehicles (procedural fallback unchanged).
 *   - Uses on-demand loading of the pilot set only (16 hull + 16 turret),
 *     never a broad preload.
 *
 * CONTROL SURFACE (MODULAR-PROOF-01 fixup):
 *   This harness has NO gameplay/debug keyboard controls of its own. All
 *   interaction is via the devtools UI panel (GeneratedVehicleProofPanel),
 *   which calls the public methods below. This avoids conflicts with the
 *   existing gameplay/debug hotkeys (B/N/G/M etc. are NOT used here).
 *   The `9` hotkey remains only as an optional open/close shortcut and the
 *   panel exposes an equivalent Open/Close button.
 */

import Phaser from 'phaser';
import {
  composeGeneratedVehiclePreview,
  type GeneratedVehiclePreviewResult,
} from '../render/generatedVehiclePreviewComposition';
import { basisZ } from '../../config/cameraProjectionContract';
import { PILOT_VEHICLE_REQUEST } from '../../assets/pilotVehicleLazyLoad';
import { preloadGeneratedHullSet } from '../../assets/generatedHullAssets';
import { preloadGeneratedTurretSet } from '../../assets/generatedTurretAssets';
import type { Faction } from '../../state/types';

// ─── Visual constants ───────────────────────────────────────────────

const HARNESS_DEPTH = 20000;
const BACKDROP_COLOR = 0x0c0c18;
const BACKDROP_ALPHA = 0.96;

const COLOR_HULL_BBOX = 0x4a9eff;
const COLOR_TURRET_BBOX = 0xffc24a;
const COLOR_HULL_ORIGIN = 0x4a9eff;
const COLOR_TURRET_ORIGIN = 0xffc24a;
const COLOR_SOCKET = 0xff3da1; // magenta — hull socket
const COLOR_PIVOT = 0x3dff8b; // green — turret pivot
const COLOR_GROUND = 0x9a9aff; // ground anchor

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#d4e4ff',
};

// ─── Public state snapshot (consumed by the devtools panel) ─────────

export interface GeneratedVehicleProofHarnessState {
  active: boolean;
  bodyDir8: number;
  turretDir16: number;
  zHeightDiagnostic: boolean;
  markersVisible: boolean;
  hullVisualDir16: number | null;
  turretVisualDir16: number | null;
  available: boolean | null;
  reason: string | null;
}

// ─── Harness ────────────────────────────────────────────────────────

export class GeneratedVehicleProofHarness {
  private scene: Phaser.Scene;
  private _active = false;

  // Body/turret state
  private bodyDir8 = 0; // 0..7
  private turretDir16 = 0; // 0..15
  private zHeightDiagnostic = false;
  private markersVisible = true;

  // Render objects
  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  private hullSprite: Phaser.GameObjects.Image | null = null;
  private turretSprite: Phaser.GameObjects.Image | null = null;
  private markers: Phaser.GameObjects.Graphics | null = null;
  private labelText: Phaser.GameObjects.Text | null = null;
  private helpText: Phaser.GameObjects.Text | null = null;
  private legendText: Phaser.GameObjects.Text | null = null;

  private assetsRequested = false;
  private lastResult: GeneratedVehiclePreviewResult | null = null;
  private onStateChange: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get active(): boolean {
    return this._active;
  }

  /** Set the panel notification callback (called after any state change). */
  setOnStateChange(cb: (() => void) | null): void {
    this.onStateChange = cb;
  }

  /** Current harness state snapshot for the devtools panel readout. */
  getState(): GeneratedVehicleProofHarnessState {
    return {
      active: this._active,
      bodyDir8: this.bodyDir8,
      turretDir16: this.turretDir16,
      zHeightDiagnostic: this.zHeightDiagnostic,
      markersVisible: this.markersVisible,
      hullVisualDir16: this.lastResult?.hullVisualDir16 ?? null,
      turretVisualDir16: this.lastResult?.turretVisualDir16 ?? null,
      available: this.lastResult?.available ?? null,
      reason: this.lastResult?.reason ?? null,
    };
  }

  /** Toggle the harness open/closed (UI button or `9` shortcut). */
  toggle(): void {
    if (this._active) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Open the harness overlay. */
  open(): void {
    if (this._active) return;
    this._active = true;
    this.ensureAssetsLoaded();
    this.build();
    this.refresh();
    console.log('[GeneratedVehicleProofHarness] ON');
    this.onStateChange?.();
  }

  /** Close the harness overlay. */
  close(): void {
    if (!this._active) return;
    this._active = false;
    this.teardown();
    console.log('[GeneratedVehicleProofHarness] OFF');
    this.onStateChange?.();
  }

  /** Destroy all resources. Call on scene shutdown. */
  destroy(): void {
    this.teardown();
    this.onStateChange = null;
  }

  // ─── UI-driven controls (called by GeneratedVehicleProofPanel) ────

  /** Cycle the hull body direction (dir8) by delta (UI button). */
  cycleBodyDir(delta: number): void {
    if (!this._active) return;
    this.bodyDir8 = (((this.bodyDir8 + delta) % 8) + 8) % 8;
    this.refresh();
    this.onStateChange?.();
  }

  /** Cycle the turret direction (dir16) by delta (UI button). */
  cycleTurretDir(delta: number): void {
    if (!this._active) return;
    this.turretDir16 = (((this.turretDir16 + delta) % 16) + 16) % 16;
    this.refresh();
    this.onStateChange?.();
  }

  /** Toggle the DIAGNOSTIC zHeight projection (UI button). Default OFF. */
  toggleZHeightDiagnostic(): void {
    if (!this._active) return;
    this.zHeightDiagnostic = !this.zHeightDiagnostic;
    this.refresh();
    this.onStateChange?.();
  }

  /** Toggle the visibility of markers + text labels (UI button). */
  toggleMarkers(): void {
    if (!this._active) return;
    this.markersVisible = !this.markersVisible;
    this.applyMarkersVisibility();
    this.onStateChange?.();
  }

  /** Reset body/turret direction, zHeight diagnostic, and markers (UI button). */
  reset(): void {
    if (!this._active) return;
    this.bodyDir8 = 0;
    this.turretDir16 = 0;
    this.zHeightDiagnostic = false;
    this.markersVisible = true;
    this.refresh();
    this.onStateChange?.();
  }

  // ─── Asset loading (on-demand, pilot set only) ────────────────────

  private ensureAssetsLoaded(): void {
    const req = PILOT_VEHICLE_REQUEST;
    const faction = req.faction as Faction;
    // Probe one key per family; if present, assume the set is loaded
    // (loadArenaVisualAssets already loads the pilot set in devtools mode).
    const queued: string[] = [];
    queued.push(
      ...preloadGeneratedHullSet(this.scene, 'wasp', faction as 'cyan', 'm0'),
    );
    queued.push(
      ...preloadGeneratedTurretSet(this.scene, 'smoky', faction as 'cyan', 'm0'),
    );
    if (queued.length > 0 && !this.assetsRequested) {
      this.assetsRequested = true;
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
    if (this.backdrop) return; // already built

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.backdrop = this.scene.add
      .rectangle(w / 2, h / 2, w, h, BACKDROP_COLOR, BACKDROP_ALPHA)
      .setScrollFactor(0)
      .setDepth(HARNESS_DEPTH)
      .setInteractive(); // swallow clicks so Arena beneath is untouched

    this.markers = this.scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(HARNESS_DEPTH + 3);

    this.labelText = this.scene.add
      .text(16, 16, '', TEXT_STYLE)
      .setScrollFactor(0)
      .setDepth(HARNESS_DEPTH + 4);

    this.helpText = this.scene.add
      .text(
        16,
        h - 52,
        'MODULAR-PROOF-01 harness  |  controls: use the Proof Harness devtools panel (mouse).  9: close',
        { ...TEXT_STYLE, color: '#8ab4ff' },
      )
      .setScrollFactor(0)
      .setDepth(HARNESS_DEPTH + 4);

    this.legendText = this.scene.add
      .text(
        16,
        h - 34,
        'markers — magenta: hull socket  green: turret pivot  blue: hull origin/bbox  yellow: turret origin/bbox  lilac: ground anchor',
        { ...TEXT_STYLE, color: '#8ab4ff' },
      )
      .setScrollFactor(0)
      .setDepth(HARNESS_DEPTH + 4);
  }

  private teardown(): void {
    this.hullSprite?.destroy();
    this.hullSprite = null;
    this.turretSprite?.destroy();
    this.turretSprite = null;
    this.markers?.destroy();
    this.markers = null;
    this.labelText?.destroy();
    this.labelText = null;
    this.helpText?.destroy();
    this.helpText = null;
    this.legendText?.destroy();
    this.legendText = null;
    this.backdrop?.destroy();
    this.backdrop = null;
  }

  // ─── Refresh (recompute + redraw) ─────────────────────────────────

  private refresh(): void {
    if (!this._active || !this.markers || !this.labelText) return;

    const req = PILOT_VEHICLE_REQUEST;
    const anchor = {
      x: this.scene.scale.width * 0.5,
      y: this.scene.scale.height * 0.55,
    };

    const result = composeGeneratedVehiclePreview({
      bodyId: req.bodyId,
      weaponId: req.weaponId,
      faction: req.faction as Faction,
      hullModificationLevel: req.hullModificationLevel,
      turretModificationLevel: req.turretModificationLevel,
      bodyDir8: this.bodyDir8,
      turretAngleRad: (this.turretDir16 * Math.PI) / 8,
      anchor,
      zHeightDiagnostic: { enabled: this.zHeightDiagnostic, basisZScreenY: basisZ.y },
      textureExists: (key: string) => this.scene.textures.exists(key),
    });
    this.lastResult = result;

    this.drawSprites(result);
    this.drawMarkers(result);
    this.drawLabels(result);
    this.applyMarkersVisibility();
  }

  private applyMarkersVisibility(): void {
    this.markers?.setVisible(this.markersVisible);
    this.labelText?.setVisible(this.markersVisible);
    this.legendText?.setVisible(this.markersVisible);
  }

  private drawSprites(result: GeneratedVehiclePreviewResult): void {
    // Hull sprite
    const hullKey = result.hullTextureKey;
    if (hullKey && this.scene.textures.exists(hullKey)) {
      if (!this.hullSprite) {
        this.hullSprite = this.scene.add
          .image(0, 0, hullKey)
          .setScrollFactor(0)
          .setDepth(HARNESS_DEPTH + 1);
      } else {
        this.hullSprite.setTexture(hullKey);
      }
      this.hullSprite
        .setOrigin(result.hullOrigin.x, result.hullOrigin.y)
        .setScale(result.hullScale)
        .setPosition(result.hullSpritePos.x, result.hullSpritePos.y)
        .setVisible(true);
    } else {
      this.hullSprite?.setVisible(false);
    }

    // Turret sprite
    const turretKey = result.turretTextureKey;
    if (turretKey && this.scene.textures.exists(turretKey)) {
      if (!this.turretSprite) {
        this.turretSprite = this.scene.add
          .image(0, 0, turretKey)
          .setScrollFactor(0)
          .setDepth(HARNESS_DEPTH + 2);
      } else {
        this.turretSprite.setTexture(turretKey);
      }
      this.turretSprite
        .setOrigin(result.turretOrigin.x, result.turretOrigin.y)
        .setScale(result.turretScale)
        .setPosition(result.turretSpritePos.x, result.turretSpritePos.y)
        .setVisible(true);
    } else {
      this.turretSprite?.setVisible(false);
    }
  }

  private drawMarkers(result: GeneratedVehiclePreviewResult): void {
    const g = this.markers!;
    g.clear();

    // Bounding boxes
    g.lineStyle(1, COLOR_HULL_BBOX, 0.7);
    g.strokeRect(result.hullBBox.x, result.hullBBox.y, result.hullBBox.width, result.hullBBox.height);
    g.lineStyle(1, COLOR_TURRET_BBOX, 0.7);
    g.strokeRect(result.turretBBox.x, result.turretBBox.y, result.turretBBox.width, result.turretBBox.height);

    // Origin markers (small squares)
    this.drawSquare(g, result.hullOriginMarker, 4, COLOR_HULL_ORIGIN);
    this.drawSquare(g, result.turretOriginMarker, 4, COLOR_TURRET_ORIGIN);

    // Ground anchor (lilac diamond)
    this.drawDiamond(g, result.groundAnchorMarker, 5, COLOR_GROUND);

    // Socket (magenta cross + ring) and pivot (green cross + ring)
    this.drawCross(g, result.hullSocketMarker, 9, COLOR_SOCKET);
    this.drawRing(g, result.hullSocketMarker, 7, COLOR_SOCKET);
    this.drawCross(g, result.turretPivotMarker, 7, COLOR_PIVOT);
    this.drawRing(g, result.turretPivotMarker, 5, COLOR_PIVOT);
  }

  private drawLabels(result: GeneratedVehiclePreviewResult): void {
    const fmt = (n: number) => n.toFixed(4);
    const socket = result.socket;
    const pivot = result.pivot;
    const lines = [
      `MODULAR-PROOF-01 — generated vehicle attachment proof`,
      ``,
      `bodyId:        ${PILOT_VEHICLE_REQUEST.bodyId}`,
      `weaponId:      ${PILOT_VEHICLE_REQUEST.weaponId}`,
      `available:     ${result.available}${result.reason ? `  (reason: ${result.reason})` : ''}`,
      ``,
      `hull  logicalDir16/visualDir16: ${result.hullLogicalDir16} / ${result.hullVisualDir16}`,
      `turret logicalDir16/visualDir16: ${result.turretLogicalDir16} / ${result.turretVisualDir16}`,
      ``,
      `hull origin:   (${result.hullOrigin.x}, ${result.hullOrigin.y})   scale: ${result.hullScale}`,
      `turret origin: (${result.turretOrigin.x}, ${result.turretOrigin.y})   scale: ${result.turretScale}`,
      ``,
      `socket nx/ny/zHeight: ${socket ? `${fmt(socket.nx)} / ${fmt(socket.ny)} / ${socket.zHeight ?? 'null'}` : 'n/a'}`,
      `pivot  x/y:           ${pivot ? `${fmt(pivot.x)} / ${fmt(pivot.y)}` : 'n/a'}`,
      ``,
      `zHeight: ${result.zHeightApplied ? `APPLIED (DIAGNOSTIC, deltaY=${result.zHeightDeltaPx.y.toFixed(2)}px)` : 'IGNORED (default sprite-space composition)'}`,
      `hull key:   ${result.hullTextureKey ?? 'null'}`,
      `turret key: ${result.turretTextureKey ?? 'null'}`,
    ];
    this.labelText!.setText(lines);
  }

  // ─── Marker primitives ────────────────────────────────────────────

  private drawCross(g: Phaser.GameObjects.Graphics, p: { x: number; y: number }, r: number, color: number): void {
    g.lineStyle(2, color, 1);
    g.beginPath();
    g.moveTo(p.x - r, p.y);
    g.lineTo(p.x + r, p.y);
    g.moveTo(p.x, p.y - r);
    g.lineTo(p.x, p.y + r);
    g.strokePath();
  }

  private drawRing(g: Phaser.GameObjects.Graphics, p: { x: number; y: number }, r: number, color: number): void {
    g.lineStyle(1, color, 0.9);
    g.strokeCircle(p.x, p.y, r);
  }

  private drawSquare(g: Phaser.GameObjects.Graphics, p: { x: number; y: number }, s: number, color: number): void {
    g.lineStyle(1, color, 1);
    g.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
  }

  private drawDiamond(g: Phaser.GameObjects.Graphics, p: { x: number; y: number }, r: number, color: number): void {
    g.lineStyle(1, color, 1);
    g.beginPath();
    g.moveTo(p.x, p.y - r);
    g.lineTo(p.x + r, p.y);
    g.lineTo(p.x, p.y + r);
    g.lineTo(p.x - r, p.y);
    g.closePath();
    g.strokePath();
  }
}
