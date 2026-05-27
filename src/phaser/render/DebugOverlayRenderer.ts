/**
 * DebugOverlayRenderer — renders debug overlays for passability,
 * building footprints, and resource markers.
 *
 * ARCH-11B: Lightweight dev-only overlays using Phaser Graphics.
 * Only created when ?devtools=1 is active.
 * Toggleable from DevtoolsPanel.
 *
 * Overlays are redrawn each frame via syncFromState() so they
 * always reflect the current game state snapshot.
 */

import Phaser from 'phaser';
import { tileToScreen, IsoPoint } from './isometric';
import { buildOccupancyMap, isPassable } from '../../state/occupancy';
import { BUILDING_CONFIG } from '../../state/construction';
import type { GameState } from '../../state/types';

// ─── Visual constants ──────────────────────────────────────────────

const HW = 76 / 2; // TILE_W / 2
const HH = 38 / 2; // TILE_H / 2

// Passability overlay colors
const PASSABLE_FILL = 0x00ff00;   // green
const PASSABLE_FILL_ALPHA = 0.12;
const IMPASSABLE_FILL = 0xff0000;  // red
const IMPASSABLE_FILL_ALPHA = 0.18;

// Building footprint overlay colors
const FOOTPRINT_FILL = 0x00aaff;  // blue
const FOOTPRINT_FILL_ALPHA = 0.2;
const FOOTPRINT_LINE = 0x0088cc;
const FOOTPRINT_LINE_ALPHA = 0.6;

// Resource marker overlay colors
const RESOURCE_FILL = 0xffaa00;   // orange
const RESOURCE_FILL_ALPHA = 0.2;
const RESOURCE_LINE = 0xcc8800;
const RESOURCE_LINE_ALPHA = 0.6;
const DEPLETED_FILL = 0x666666;   // gray
const DEPLETED_FILL_ALPHA = 0.15;

// Depth for overlays (above terrain, below entities)
const OVERLAY_DEPTH = 55;

export class DebugOverlayRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  private passabilityGraphics: Phaser.GameObjects.Graphics | null = null;
  private footprintGraphics: Phaser.GameObjects.Graphics | null = null;
  private resourceGraphics: Phaser.GameObjects.Graphics | null = null;

  private _passabilityVisible = false;
  private _footprintVisible = false;
  private _resourceVisible = false;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Toggle methods ──────────────────────────────────────────────

  togglePassability(): boolean {
    this._passabilityVisible = !this._passabilityVisible;
    if (!this._passabilityVisible && this.passabilityGraphics) {
      this.passabilityGraphics.clear();
    }
    return this._passabilityVisible;
  }

  toggleFootprint(): boolean {
    this._footprintVisible = !this._footprintVisible;
    if (!this._footprintVisible && this.footprintGraphics) {
      this.footprintGraphics.clear();
    }
    return this._footprintVisible;
  }

  toggleResource(): boolean {
    this._resourceVisible = !this._resourceVisible;
    if (!this._resourceVisible && this.resourceGraphics) {
      this.resourceGraphics.clear();
    }
    return this._resourceVisible;
  }

  get passabilityVisible(): boolean { return this._passabilityVisible; }
  get footprintVisible(): boolean { return this._footprintVisible; }
  get resourceVisible(): boolean { return this._resourceVisible; }

  // ─── Frame sync ──────────────────────────────────────────────────

  /** Sync all active overlays from the current GameState. Called each frame. */
  syncFromState(state: GameState): void {
    if (this._passabilityVisible) {
      this.drawPassability(state);
    }
    if (this._footprintVisible) {
      this.drawFootprints(state);
    }
    if (this._resourceVisible) {
      this.drawResources(state);
    }
  }

  // ─── Passability overlay ─────────────────────────────────────────

  private drawPassability(state: GameState): void {
    if (!this.passabilityGraphics) {
      this.passabilityGraphics = this.scene.add.graphics();
      this.passabilityGraphics.setDepth(OVERLAY_DEPTH);
    }
    const g = this.passabilityGraphics;
    g.clear();

    const occupancyMap = buildOccupancyMap(state);

    for (let ty = 0; ty < state.mapHeight; ty++) {
      for (let tx = 0; tx < state.mapWidth; tx++) {
        const screenPos = tileToScreen(tx, ty);
        const cx = screenPos.x + this.offset.x;
        const cy = screenPos.y + this.offset.y;

        if (isPassable(occupancyMap, tx, ty)) {
          g.fillStyle(PASSABLE_FILL, PASSABLE_FILL_ALPHA);
        } else {
          g.fillStyle(IMPASSABLE_FILL, IMPASSABLE_FILL_ALPHA);
        }

        g.beginPath();
        g.moveTo(cx, cy - HH);
        g.lineTo(cx + HW, cy);
        g.lineTo(cx, cy + HH);
        g.lineTo(cx - HW, cy);
        g.closePath();
        g.fillPath();
      }
    }
  }

  // ─── Building footprint overlay ──────────────────────────────────

  private drawFootprints(state: GameState): void {
    if (!this.footprintGraphics) {
      this.footprintGraphics = this.scene.add.graphics();
      this.footprintGraphics.setDepth(OVERLAY_DEPTH + 1);
    }
    const g = this.footprintGraphics;
    g.clear();

    // HQ footprint (3x3)
    this.drawFootprintDiamond(g, state.mapData.hq.tx, state.mapData.hq.ty, 3, 3);

    // Buildings
    for (const b of state.mapData.buildings) {
      const config = BUILDING_CONFIG[b.type];
      const fpW = config?.footprintW ?? 1;
      const fpH = config?.footprintH ?? 1;
      this.drawFootprintDiamond(g, b.tx, b.ty, fpW, fpH);
    }

    // Construction sites
    for (const c of state.mapData.constructionSites) {
      const config = BUILDING_CONFIG[c.type];
      const fpW = config?.footprintW ?? 1;
      const fpH = config?.footprintH ?? 1;
      this.drawFootprintDiamond(g, c.tx, c.ty, fpW, fpH);
    }
  }

  private drawFootprintDiamond(
    g: Phaser.GameObjects.Graphics,
    baseTx: number,
    baseTy: number,
    fpW: number,
    fpH: number,
  ): void {
    for (let dy = 0; dy < fpH; dy++) {
      for (let dx = 0; dx < fpW; dx++) {
        const screenPos = tileToScreen(baseTx + dx, baseTy + dy);
        const cx = screenPos.x + this.offset.x;
        const cy = screenPos.y + this.offset.y;

        g.fillStyle(FOOTPRINT_FILL, FOOTPRINT_FILL_ALPHA);
        g.beginPath();
        g.moveTo(cx, cy - HH);
        g.lineTo(cx + HW, cy);
        g.lineTo(cx, cy + HH);
        g.lineTo(cx - HW, cy);
        g.closePath();
        g.fillPath();

        g.lineStyle(1, FOOTPRINT_LINE, FOOTPRINT_LINE_ALPHA);
        g.beginPath();
        g.moveTo(cx, cy - HH);
        g.lineTo(cx + HW, cy);
        g.lineTo(cx, cy + HH);
        g.lineTo(cx - HW, cy);
        g.closePath();
        g.strokePath();
      }
    }
  }

  // ─── Resource marker overlay ─────────────────────────────────────

  private drawResources(state: GameState): void {
    if (!this.resourceGraphics) {
      this.resourceGraphics = this.scene.add.graphics();
      this.resourceGraphics.setDepth(OVERLAY_DEPTH + 2);
    }
    const g = this.resourceGraphics;
    g.clear();

    for (const r of state.resourceNodes) {
      const fillColor = r.depleted ? DEPLETED_FILL : RESOURCE_FILL;
      const fillAlpha = r.depleted ? DEPLETED_FILL_ALPHA : RESOURCE_FILL_ALPHA;

      for (let dy = 0; dy < r.footprint; dy++) {
        for (let dx = 0; dx < r.footprint; dx++) {
          const screenPos = tileToScreen(r.tx + dx, r.ty + dy);
          const cx = screenPos.x + this.offset.x;
          const cy = screenPos.y + this.offset.y;

          g.fillStyle(fillColor, fillAlpha);
          g.beginPath();
          g.moveTo(cx, cy - HH);
          g.lineTo(cx + HW, cy);
          g.lineTo(cx, cy + HH);
          g.lineTo(cx - HW, cy);
          g.closePath();
          g.fillPath();

          g.lineStyle(1, RESOURCE_LINE, RESOURCE_LINE_ALPHA);
          g.beginPath();
          g.moveTo(cx, cy - HH);
          g.lineTo(cx + HW, cy);
          g.lineTo(cx, cy + HH);
          g.lineTo(cx - HW, cy);
          g.closePath();
          g.strokePath();
        }
      }
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    this.passabilityGraphics?.destroy();
    this.passabilityGraphics = null;
    this.footprintGraphics?.destroy();
    this.footprintGraphics = null;
    this.resourceGraphics?.destroy();
    this.resourceGraphics = null;
    this._passabilityVisible = false;
    this._footprintVisible = false;
    this._resourceVisible = false;
  }
}
