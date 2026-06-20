/**
 * HUD Minimap — real minimap renderer in the bottom-left HUD slot.
 *
 * VISUAL-MINIMAP-03: Replaces the placeholder with a canvas-based minimap
 * that shows:
 *   - World/map bounds (background grid)
 *   - Camera viewport rectangle
 *   - Player/allied unit markers
 *   - Player/allied building markers
 *   - Resource markers
 *
 * Rendering strategy: DOM Canvas (2D context) inside the HUD minimap slot.
 * Updated each frame from GameScene.update() via VisualHudCore.
 *
 * Why not Phaser second camera:
 *   - A second camera would render the full scene with all sprites — too heavy.
 *   - Phaser Graphics with setScrollFactor(0) would work but creates a
 *     world-space object that doesn't integrate cleanly with the DOM layout.
 *   - Canvas 2D is cheap, testable, and stays inside the HUD DOM slot.
 */

import type { GameState } from '../../../state/types';
import { HUD_MINIMAP_WIDTH, HUD_MINIMAP_HEIGHT } from './hudLayout';
import {
  buildMinimapViewModel,
  tileToMinimap,
  type MinimapViewModel,
  type MinimapMarker,
} from './minimapViewModel';

/** Camera data needed for minimap viewport rectangle. */
export interface MinimapCameraData {
  /** Camera world view rectangle. */
  worldView: { x: number; y: number; width: number; height: number };
  /** Camera zoom level. */
  zoom: number;
}

/** Map origin offset for coordinate transforms. */
export interface MinimapOffset {
  x: number;
  y: number;
}

export class HudMinimap {
  private container!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  /** Whether pointer events on the minimap should be consumed. */
  private consumePointerEvents: boolean = true;

  create(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.id = 'hud-minimap-slot';
    this.container.innerHTML = this.css();

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hud-minimap-canvas';
    this.canvas.width = HUD_MINIMAP_WIDTH;
    this.canvas.height = HUD_MINIMAP_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;

    this.container.appendChild(this.canvas);
    parent.appendChild(this.container);

    // Consume pointer events so map click doesn't leak through
    if (this.consumePointerEvents) {
      this.canvas.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      this.canvas.addEventListener('pointerup', (e) => {
        e.stopPropagation();
      });
      this.canvas.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  update(state: GameState, cameraData: MinimapCameraData | null, offset: MinimapOffset): void {
    const vm = buildMinimapViewModel(
      state,
      cameraData?.worldView ?? null,
      cameraData?.zoom ?? 1,
      offset,
    );
    this.render(vm);
  }

  destroy(): void {
    this.container?.remove();
  }

  // ─── Private ────────────────────────────────────────────────────

  private render(vm: MinimapViewModel): void {
    const ctx = this.ctx;
    const w = HUD_MINIMAP_WIDTH;
    const h = HUD_MINIMAP_HEIGHT;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    // World bounds border
    const padding = 4;
    ctx.strokeStyle = 'rgba(212, 165, 116, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);

    // Grid lines (subtle)
    this.drawGrid(ctx, vm.mapWidth, vm.mapHeight);

    // Resource markers (draw first, behind entities)
    for (const marker of vm.markers) {
      if (marker.color === '#f97316') { // resource color
        this.drawMarker(ctx, marker, vm.mapWidth, vm.mapHeight);
      }
    }

    // Building markers
    for (const marker of vm.markers) {
      if (marker.shape === 'rect') {
        this.drawMarker(ctx, marker, vm.mapWidth, vm.mapHeight);
      }
    }

    // Unit markers (draw last, on top)
    for (const marker of vm.markers) {
      if (marker.shape === 'circle' && marker.color !== '#f97316') {
        this.drawMarker(ctx, marker, vm.mapWidth, vm.mapHeight);
      }
    }

    // Camera viewport rectangle
    if (vm.viewport) {
      this.drawViewport(ctx, vm.viewport);
    }
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    mapWidth: number,
    mapHeight: number,
  ): void {
    ctx.strokeStyle = 'rgba(212, 165, 116, 0.06)';
    ctx.lineWidth = 0.5;

    // Draw grid lines every 8 tiles
    const step = 8;
    for (let tx = step; tx < mapWidth; tx += step) {
      const pos = tileToMinimap(tx, 0, mapWidth, mapHeight);
      const posBottom = tileToMinimap(tx, mapHeight, mapWidth, mapHeight);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(posBottom.x, posBottom.y);
      ctx.stroke();
    }
    for (let ty = step; ty < mapHeight; ty += step) {
      const pos = tileToMinimap(0, ty, mapWidth, mapHeight);
      const posRight = tileToMinimap(mapWidth, ty, mapWidth, mapHeight);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(posRight.x, posRight.y);
      ctx.stroke();
    }
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    marker: MinimapMarker,
    mapWidth: number,
    mapHeight: number,
  ): void {
    const pos = tileToMinimap(marker.tx, marker.ty, mapWidth, mapHeight);
    const halfSize = marker.size / 2;

    ctx.fillStyle = marker.color;

    if (marker.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, halfSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(pos.x - halfSize, pos.y - halfSize, marker.size, marker.size);
    }
  }

  private drawViewport(
    ctx: CanvasRenderingContext2D,
    vp: { x: number; y: number; width: number; height: number },
  ): void {
    // Fill
    ctx.fillStyle = 'rgba(212, 165, 116, 0.08)';
    ctx.fillRect(vp.x, vp.y, vp.width, vp.height);

    // Stroke
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vp.x, vp.y, vp.width, vp.height);
  }

  // ─── CSS ────────────────────────────────────────────────────────

  private css(): string {
    return `<style>
      #hud-minimap-slot {
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${HUD_MINIMAP_WIDTH}px;
        height: ${HUD_MINIMAP_HEIGHT}px;
        flex-shrink: 0;
        background: rgba(5, 8, 12, 0.9);
        border-right: 1px solid rgba(212, 165, 116, 0.2);
        pointer-events: auto;
        user-select: none;
        cursor: default;
      }
      #hud-minimap-canvas {
        display: block;
        pointer-events: auto;
      }
    </style>`;
  }
}
