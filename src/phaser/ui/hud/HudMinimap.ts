/**
 * HUD Minimap — interactive minimap renderer in the bottom-left HUD slot.
 *
 * SELECTION-CONTROL-GROUPS-05: Highlights ALL selected entity markers
 * with cyan rings, not just one.
 */

import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { HUD_MINIMAP_WIDTH, HUD_MINIMAP_HEIGHT } from './hudLayout';
import {
  buildMinimapViewModel,
  tileToMinimap,
  minimapToTileClamped,
  type MinimapViewModel,
  type MinimapMarker,
} from './minimapViewModel';
import { tileToScreen } from '../../render/isometric';

export interface MinimapCameraData {
  worldView: { x: number; y: number; width: number; height: number };
  zoom: number;
}

export interface MinimapOffset {
  x: number;
  y: number;
}

const DRAG_THRESHOLD = 3;

export class HudMinimap {
  private container!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private onCameraCenter: ((worldX: number, worldY: number) => void) | null = null;

  private isDragging = false;
  private dragStarted = false;
  private dragStartX = 0;
  private dragStartY = 0;

  private pointerCaptured = false;

  private offset: MinimapOffset = { x: 0, y: 0 };

  private cachedMapWidth = 0;
  private cachedMapHeight = 0;

  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerLeave: (e: PointerEvent) => void;
  private boundPointerCancel: (e: PointerEvent) => void;
  private boundLostPointerCapture: (e: PointerEvent) => void;

  constructor() {
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerLeave = this.handlePointerLeave.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
    this.boundLostPointerCapture = this.handleLostPointerCapture.bind(this);
  }

  create(parent: HTMLElement, onCameraCenter?: (worldX: number, worldY: number) => void): void {
    if (onCameraCenter) {
      this.onCameraCenter = onCameraCenter;
    }

    this.container = document.createElement('div');
    this.container.id = 'hud-minimap-slot';
    this.container.innerHTML = this.css();

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hud-minimap-canvas';
    this.canvas.width = HUD_MINIMAP_WIDTH;
    this.canvas.height = HUD_MINIMAP_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;

    this.container.appendChild(this.canvas);
    parent.appendChild(this.container);

    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);
    this.canvas.addEventListener('pointerleave', this.boundPointerLeave);
    this.canvas.addEventListener('pointercancel', this.boundPointerCancel);
    this.canvas.addEventListener('lostpointercapture', this.boundLostPointerCapture);
  }

  update(state: GameState, cameraData: MinimapCameraData | null, offset: MinimapOffset, selection?: UnitSelection): void {
    this.offset = offset;
    this.cachedMapWidth = state.mapWidth;
    this.cachedMapHeight = state.mapHeight;

    const vm = buildMinimapViewModel(
      state,
      cameraData?.worldView ?? null,
      cameraData?.zoom ?? 1,
      offset,
      selection,
    );
    this.render(vm);
  }

  setCameraCenterCallback(cb: (worldX: number, worldY: number) => void): void {
    this.onCameraCenter = cb;
  }

  setOffset(offset: MinimapOffset): void {
    this.offset = offset;
  }

  destroy(): void {
    this.canvas?.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas?.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas?.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas?.removeEventListener('pointerleave', this.boundPointerLeave);
    this.canvas?.removeEventListener('pointercancel', this.boundPointerCancel);
    this.canvas?.removeEventListener('lostpointercapture', this.boundLostPointerCapture);
    this.container?.remove();
  }

  // ─── Pointer Handlers ────────────────────────────────────────────

  private handlePointerDown(e: PointerEvent): void {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      this.pointerCaptured = true;
    } catch { /* ignore if not supported */ }
    this.isDragging = true;
    this.dragStarted = false;
    this.dragStartX = e.offsetX;
    this.dragStartY = e.offsetY;
  }

  private handlePointerMove(e: PointerEvent): void {
    e.stopPropagation();
    e.preventDefault();
    if (!this.isDragging) return;

    const dx = e.offsetX - this.dragStartX;
    const dy = e.offsetY - this.dragStartY;
    if (!this.dragStarted && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      this.dragStarted = true;
    }

    if (this.dragStarted && this.onCameraCenter) {
      const worldPos = this.minimapPixelToWorld(e.offsetX, e.offsetY);
      if (worldPos) {
        this.onCameraCenter(worldPos.worldX + this.offset.x, worldPos.worldY + this.offset.y);
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    e.stopPropagation();
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    this.pointerCaptured = false;

    if (!this.dragStarted && this.onCameraCenter) {
      const worldPos = this.minimapPixelToWorld(e.offsetX, e.offsetY);
      if (worldPos) {
        this.onCameraCenter(worldPos.worldX + this.offset.x, worldPos.worldY + this.offset.y);
      }
    }

    this.isDragging = false;
    this.dragStarted = false;
  }

  private handlePointerLeave(e: PointerEvent): void {
    e.stopPropagation();
    if (this.pointerCaptured) {
      return;
    }
    this.isDragging = false;
    this.dragStarted = false;
  }

  private handlePointerCancel(e: PointerEvent): void {
    e.stopPropagation();
    this.pointerCaptured = false;
    this.isDragging = false;
    this.dragStarted = false;
  }

  private handleLostPointerCapture(e: PointerEvent): void {
    e.stopPropagation();
    this.pointerCaptured = false;
    this.isDragging = false;
    this.dragStarted = false;
  }

  private minimapPixelToWorld(mx: number, my: number): { worldX: number; worldY: number } | null {
    if (this.cachedMapWidth <= 0 || this.cachedMapHeight <= 0) return null;

    const tile = minimapToTileClamped(mx, my, this.cachedMapWidth, this.cachedMapHeight);
    const screen = tileToScreen(tile.tx, tile.ty);
    return { worldX: screen.x, worldY: screen.y };
  }

  // ─── Rendering ───────────────────────────────────────────────────

  private render(vm: MinimapViewModel): void {
    const ctx = this.ctx;
    const w = HUD_MINIMAP_WIDTH;
    const h = HUD_MINIMAP_HEIGHT;

    ctx.clearRect(0, 0, w, h);

    // 1. Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    // World bounds border
    const padding = 4;
    ctx.strokeStyle = 'rgba(212, 165, 116, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);

    // Grid lines (subtle)
    this.drawGrid(ctx, vm.mapWidth, vm.mapHeight);

    // 2. Resource markers (lowest priority)
    for (const marker of vm.markers) {
      if (marker.color === '#f97316') {
        this.drawMarker(ctx, marker, vm.mapWidth, vm.mapHeight);
      }
    }

    // 3. Building/construction markers
    for (const marker of vm.markers) {
      if (marker.shape === 'rect') {
        this.drawMarker(ctx, marker, vm.mapWidth, vm.mapHeight);
      }
    }

    // 4. Unit markers (builders, harvesters — not resources)
    for (const marker of vm.markers) {
      if (marker.shape === 'circle' && marker.color !== '#f97316') {
        this.drawMarker(ctx, marker, vm.mapWidth, vm.mapHeight);
      }
    }

    // 5. SELECTION-CONTROL-GROUPS-05: Highlight ALL selected entity markers
    if (vm.selectedEntityIds.length > 0) {
      for (const marker of vm.markers) {
        if (marker.selectedEntityId) {
          this.drawSelectedHighlight(ctx, marker, vm.mapWidth, vm.mapHeight);
        }
      }
    }

    // 6. Camera viewport rectangle (highest priority)
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

  /**
   * SELECTION-CONTROL-GROUPS-05: Draw a bright cyan ring around a selected marker.
   * Called for each selected marker (supports multi-select).
   */
  private drawSelectedHighlight(
    ctx: CanvasRenderingContext2D,
    marker: MinimapMarker,
    mapWidth: number,
    mapHeight: number,
  ): void {
    const pos = tileToMinimap(marker.tx, marker.ty, mapWidth, mapHeight);
    const radius = marker.size / 2 + 2;

    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 300);
    const alpha = Math.max(0, Math.min(1, pulse));

    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawViewport(
    ctx: CanvasRenderingContext2D,
    vp: { x: number; y: number; width: number; height: number },
  ): void {
    ctx.fillStyle = 'rgba(212, 165, 116, 0.08)';
    ctx.fillRect(vp.x, vp.y, vp.width, vp.height);

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
        flex-shrink: 0;
        background: rgba(4, 6, 10, 0.92);
        border-right: 1px solid rgba(212, 165, 116, 0.2);
        pointer-events: auto;
        user-select: none;
        cursor: crosshair;
      }
      #hud-minimap-canvas {
        display: block;
        pointer-events: auto;
      }
    </style>`;
  }
}
