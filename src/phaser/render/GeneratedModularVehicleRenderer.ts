/**
 * GeneratedModularVehicleRenderer — MODULAR-RUNTIME-01.
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
 * Fallback: when a texture or metadata is missing the renderer draws a
 * labelled blockout box instead of crashing, and exposes the reason.
 */

import Phaser from 'phaser';
import {
  composeModularVehicle,
  MODULAR_VEHICLE_DISPLAY_SCALE,
  getHullVisualScaleMultiplier,
  type ModularRenderPlan,
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
import type { GeneratedModularDir16 } from '../../assets/generatedModularVehicleAssets.generated';

const OVERLAY_DEPTH = 21000;
const BACKDROP_COLOR = 0x0b0f1e;
const BACKDROP_ALPHA = 0.96;
const COLOR_SOCKET = 0xff3da1; // magenta — hull socket
const COLOR_PIVOT = 0x3dff8b; // green — turret pivot
const COLOR_FALLBACK = 0xff7043;

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#d4e4ff',
};

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
}

export class GeneratedModularVehicleRenderer {
  private scene: Phaser.Scene;
  private _active = false;

  private visual: ModularVehicleVisual = { ...DEFAULT_MODULAR_VEHICLE_VISUAL };
  private hullDir16: GeneratedModularDir16 = 0;
  private turretDir16: GeneratedModularDir16 = 0;
  private markersVisible = true;

  private backdrop: Phaser.GameObjects.Rectangle | null = null;
  private hullSprite: Phaser.GameObjects.Image | null = null;
  private turretSprite: Phaser.GameObjects.Image | null = null;
  private fallbackGfx: Phaser.GameObjects.Graphics | null = null;
  private markers: Phaser.GameObjects.Graphics | null = null;
  private labelText: Phaser.GameObjects.Text | null = null;

  private lastPlan: ModularRenderPlan | null = null;
  private lastLoad: ModularLoadDiagnostics | null = null;
  private loadRequested = false;
  private onStateChange: (() => void) | null = null;

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
    };
  }

  getLastLoadDiagnostics(): ModularLoadDiagnostics | null {
    return this.lastLoad;
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
    this.markers?.destroy();
    this.markers = null;
    this.labelText?.destroy();
    this.labelText = null;
    this.backdrop?.destroy();
    this.backdrop = null;
  }

  // ─── Refresh ──────────────────────────────────────────────────────

  private refresh(): void {
    if (!this._active || !this.markers || !this.labelText || !this.fallbackGfx) {
      return;
    }

    const anchor = {
      x: this.scene.scale.width * 0.5,
      y: this.scene.scale.height * 0.55,
    };

    const plan = composeModularVehicle({
      visual: this.visual,
      hullDir16: this.hullDir16,
      turretDir16: this.turretDir16,
      anchor,
      displayScale: MODULAR_VEHICLE_DISPLAY_SCALE,
      textureExists: (key: string) => this.scene.textures.exists(key),
    });
    this.lastPlan = plan;

    this.drawSprites(plan);
    this.drawFallback(plan);
    this.drawMarkers(plan);
    this.drawLabels(plan);
    this.applyMarkersVisibility();
  }

  private drawSprites(plan: ModularRenderPlan): void {
    // Hull.
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
        .setScale(plan.hull.scale)
        .setPosition(plan.hull.position.x, plan.hull.position.y)
        .setVisible(true);
    } else {
      this.hullSprite?.setVisible(false);
    }

    // Turret.
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
        .setScale(plan.turret.scale)
        .setPosition(plan.turret.position.x, plan.turret.position.y)
        .setVisible(true);
    } else {
      this.turretSprite?.setVisible(false);
    }
  }

  private drawFallback(plan: ModularRenderPlan): void {
    const g = this.fallbackGfx!;
    g.clear();
    // Draw a labelled blockout box for any missing sprite.
    const half = plan.hull.displaySize * 0.5;
    if (!plan.hull.textureKey) {
      g.lineStyle(2, COLOR_FALLBACK, 1);
      g.strokeRect(
        plan.hull.position.x - half,
        plan.hull.position.y - half,
        plan.hull.displaySize,
        plan.hull.displaySize,
      );
    }
    if (!plan.turret.textureKey) {
      const th = plan.turret.displaySize * 0.3;
      g.lineStyle(2, COLOR_FALLBACK, 1);
      g.strokeRect(
        plan.turret.position.x - th,
        plan.turret.position.y - th,
        th * 2,
        th * 2,
      );
    }
  }

  private drawMarkers(plan: ModularRenderPlan): void {
    const g = this.markers!;
    g.clear();
    // Socket (magenta) and pivot (green) — should coincide.
    g.lineStyle(2, COLOR_SOCKET, 1);
    g.strokeCircle(plan.socketScreen.x, plan.socketScreen.y, 8);
    g.lineStyle(2, COLOR_PIVOT, 1);
    g.strokeCircle(plan.pivotScreen.x, plan.pivotScreen.y, 5);
  }

  private drawLabels(plan: ModularRenderPlan): void {
    const v = this.visual;
    const hullScaleMultiplier = getHullVisualScaleMultiplier(v.hullId);
    const hullScaleNote = hullScaleMultiplier !== 1
      ? `   hull scale: ${hullScaleMultiplier}x (${v.hullId} compensation)`
      : '';
    const lines = [
      'MODULAR-ALL-FACTIONS-01B — generated modular vehicle renderer',
      '',
      `hull:   ${v.hullId} / ${v.hullMod}   dir ${this.hullDir16} (${plan.hullDirSuffix})`,
      `turret: ${v.turretId} / ${v.turretMod}   dir ${this.turretDir16} (${plan.turretDirSuffix})`,
      `faction: ${v.faction}`,
      '',
      `available: ${plan.available}` +
        (plan.fallbackReason ? `   fallback: ${plan.fallbackReason}` : ''),
      `hull metadata: ${plan.hullMetadataPresent}   turret metadata: ${plan.turretMetadataPresent}`,
      `set loaded: ${isModularVehicleSetLoaded(this.scene, v)}` +
        (this.lastLoad ? `   queued: ${this.lastLoad.queuedCount}` : ''),
      hullScaleNote,
      '',
      `hull key:   ${plan.hull.textureKey ?? 'null (fallback)'}`,
      `turret key: ${plan.turret.textureKey ?? 'null (fallback)'}`,
      '',
      'markers — magenta: hull socket   green: turret pivot (should coincide)',
    ].filter(line => line !== undefined);
    this.labelText!.setText(lines);
  }

  private applyMarkersVisibility(): void {
    this.markers?.setVisible(this.markersVisible);
    this.labelText?.setVisible(this.markersVisible);
  }
}
