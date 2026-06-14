/**
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
 * Controls (only while the harness is open):
 *   B — cycle hull body direction (dir8)
 *   N — cycle turret direction (dir16)
 *   G — toggle the DIAGNOSTIC zHeight projection (default OFF)
 *   M — reset to defaults
 *
 * Lifecycle: created by GameScene when devtools is active; toggled by the
 * `9` hotkey; destroy() on scene shutdown.
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

// ─── Harness ────────────────────────────────────────────────────────

export class GeneratedVehicleProofHarness {
  private scene: Phaser.Scene;
  private _active = false;

  // Body/turret state
  private bodyDir8 = 0; // 0..7
  private turretDir16 = 0; // 0..15
  private zHeightDiagnostic = false;

  // Render objects
  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  private hullSprite: Phaser.GameObjects.Image | null = null;
  private turretSprite: Phaser.GameObjects.Image | null = null;
  private markers: Phaser.GameObjects.Graphics | null = null;
  private labelText: Phaser.GameObjects.Text | null = null;
  private helpText: Phaser.GameObjects.Text | null = null;
  private legendText: Phaser.GameObjects.Text | null = null;

  private boundKeydown: (event: KeyboardEvent) => void;
  private assetsRequested = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.boundKeydown = (event: KeyboardEvent) => this.handleKeydown(event);
    this.scene.input.keyboard?.on('keydown', this.boundKeydown);
  }

  get active(): boolean {
    return this._active;
  }

  /** Toggle the harness open/closed. */
  toggle(): void {
    this._active = !this._active;
    if (this._active) {
      this.ensureAssetsLoaded();
      this.build();
      this.refresh();
    } else {
      this.teardown();
    }
    console.log(`[GeneratedVehicleProofHarness] ${this._active ? 'ON' : 'OFF'}`);
  }

  /** Destroy all resources. Call on scene shutdown. */
  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.boundKeydown);
    this.teardown();
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
        if (this._active) this.refresh();
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
        h - 72,
        'MODULAR-PROOF-01 harness  |  B: body dir  N: turret dir  G: zHeight diag  M: reset  9: close',
        { ...TEXT_STYLE, color: '#8ab4ff' },
      )
      .setScrollFactor(0)
      .setDepth(HARNESS_DEPTH + 4);

    this.legendText = this.scene.add
      .text(
        16,
        h - 50,
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

    this.drawSprites(result);
    this.drawMarkers(result);
    this.drawLabels(result);
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

  // ─── Input ────────────────────────────────────────────────────────

  private handleKeydown(event: KeyboardEvent): void {
    if (!this._active) return;
    switch (event.code) {
      case 'KeyB':
        this.bodyDir8 = (this.bodyDir8 + 1) % 8;
        this.refresh();
        break;
      case 'KeyN':
        this.turretDir16 = (this.turretDir16 + 1) % 16;
        this.refresh();
        break;
      case 'KeyG':
        this.zHeightDiagnostic = !this.zHeightDiagnostic;
        this.refresh();
        break;
      case 'KeyM':
        this.bodyDir8 = 0;
        this.turretDir16 = 0;
        this.zHeightDiagnostic = false;
        this.refresh();
        break;
      default:
        break;
    }
  }
}
