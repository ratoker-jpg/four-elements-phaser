/**
 * BuildingDevTuner — dev-only live tuning overlay for building PNG placement.
 *
 * BUILD-01A: Minimal dev tuner for aligning completed building PNGs
 * on their isometric footprints.
 *
 * Inspired by four-elements-next's asset-tuner.ts but implemented fresh
 * for four-elements-phaser (AGENTS.md forbids copying old devtools).
 *
 * Controls (only when tuner is active):
 *   Arrow keys:   offsetX/Y +/- 1
 *   Shift+Arrow:  offsetX/Y +/- 5
 *   [ and ]:      displayWidth -/+ 4
 *   O / P:        originY -/+ 0.01
 *   C:            console.log copy-ready profile snippet
 *   9:            toggle tuner on/off (only when dev guard allows)
 *
 * Guard: Only active when isDevPanelAllowed() returns true.
 * Default: OFF. Must be toggled on with key 9.
 */

import Phaser from 'phaser';
import { tileToScreen, IsoPoint } from '../phaser/render/isometric';
import { isDevPanelAllowed } from './devGuard';
import {
  buildingProfiles,
  resetBuildingProfile,
  formatProfileSnippet,
} from '../config/buildingVisuals';
import { BUILDING_CONFIG } from '../state/construction';
import type { BuildingType, BuildingPlacement, Faction } from '../state/types';

/** Tile half-dimensions for isometric diamond drawing. */
const HW = 76 / 2;
const HH = 38 / 2;

/** localStorage key for building tuner persistence. */
const LS_KEY = 'four-elements-phaser.building-tuner.v1';

export class BuildingDevTuner {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Whether the tuner overlay is currently visible. */
  private active = false;

  /** Graphics object for the debug overlay. */
  private overlay: Phaser.GameObjects.Graphics | null = null;

  /** Text object for profile values display. */
  private text: Phaser.GameObjects.Text | null = null;

  /** The building type being tuned (currently always 'separator'). */
  private targetType: BuildingType = 'separator';

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;

    // Load persisted overrides (dev-only)
    this.loadFromLocalStorage();
  }

  /** Whether the tuner overlay is currently active. */
  isActive(): boolean {
    return this.active;
  }

  /** Toggle the tuner on/off. Returns new active state. */
  toggle(): boolean {
    if (!isDevPanelAllowed()) {
      console.warn('[BuildingDevTuner] Dev panels not allowed. Use ?devtools=1 or run in dev mode.');
      return false;
    }
    this.active = !this.active;
    if (this.active) {
      this.createOverlay();
      console.log('[BuildingDevTuner] Tuner ON — Arrow: offset | Shift+Arrow: offset +/-5 | [/]: displayWidth | O/P: originY | C: copy snippet | 9: off');
    } else {
      this.destroyOverlay();
      console.log('[BuildingDevTuner] Tuner OFF');
    }
    return this.active;
  }

  /** Handle a keyboard event. Returns true if the event was consumed. */
  handleKey(event: KeyboardEvent): boolean {
    if (!this.active) return false;

    const profile = buildingProfiles[this.targetType];
    if (!profile) return false;

    const step = event.shiftKey ? 5 : 1;
    let consumed = true;

    switch (event.code) {
      case 'ArrowLeft':
        profile.offsetX -= step;
        break;
      case 'ArrowRight':
        profile.offsetX += step;
        break;
      case 'ArrowUp':
        profile.offsetY -= step;
        break;
      case 'ArrowDown':
        profile.offsetY += step;
        break;
      case 'BracketLeft': // [
        profile.displayWidth = Math.max(20, profile.displayWidth - 4);
        break;
      case 'BracketRight': // ]
        profile.displayWidth += 4;
        break;
      case 'KeyO':
        profile.originY = Math.max(0, +(profile.originY - 0.01).toFixed(2));
        break;
      case 'KeyP':
        profile.originY = Math.min(1, +(profile.originY + 0.01).toFixed(2));
        break;
      case 'KeyC':
        console.log(formatProfileSnippet(this.targetType));
        break;
      default:
        consumed = false;
    }

    if (consumed) {
      event.preventDefault();
      this.saveToLocalStorage();
    }

    return consumed;
  }

  /** Redraw the debug overlay for a given building. Call each frame when active. */
  redraw(building: BuildingPlacement, _faction: Faction, img: Phaser.GameObjects.Image | null): void {
    if (!this.active || !this.overlay) return;

    this.overlay.clear();

    const config = BUILDING_CONFIG[building.type as keyof typeof BUILDING_CONFIG];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;

    // Draw 2x2 footprint diamonds (cyan outline)
    for (let dy = 0; dy < fpH; dy++) {
      for (let dx = 0; dx < fpW; dx++) {
        const screenPos = tileToScreen(building.tx + dx, building.ty + dy);
        const cx = screenPos.x + this.offset.x;
        const cy = screenPos.y + this.offset.y;

        this.overlay.lineStyle(1, 0x00FFFF, 0.8);
        this.overlay.beginPath();
        this.overlay.moveTo(cx, cy - HH);
        this.overlay.lineTo(cx + HW, cy);
        this.overlay.lineTo(cx, cy + HH);
        this.overlay.lineTo(cx - HW, cy);
        this.overlay.closePath();
        this.overlay.strokePath();
      }
    }

    // Draw footprint center point (yellow dot)
    const centerScreen = tileToScreen(
      building.tx + (fpW - 1) / 2,
      building.ty + (fpH - 1) / 2,
    );
    const baseX = centerScreen.x + this.offset.x;
    const baseY = centerScreen.y + this.offset.y;

    this.overlay.fillStyle(0xFFFF00, 1);
    this.overlay.fillCircle(baseX, baseY, 3);

    // Draw image anchor/position point (magenta dot)
    const profile = buildingProfiles[building.type as BuildingType];
    if (profile) {
      const imgX = baseX + profile.offsetX;
      const imgY = baseY + profile.offsetY;

      this.overlay.fillStyle(0xFF00FF, 1);
      this.overlay.fillCircle(imgX, imgY, 3);

      // Draw line from base to anchor
      this.overlay.lineStyle(1, 0xFF00FF, 0.5);
      this.overlay.beginPath();
      this.overlay.moveTo(baseX, baseY);
      this.overlay.lineTo(imgX, imgY);
      this.overlay.strokePath();
    }

    // Draw crosshair at image position if img exists
    if (img) {
      const cx = img.x;
      const cy = img.y;
      this.overlay.lineStyle(1, 0xFF6600, 0.8);
      this.overlay.beginPath();
      this.overlay.moveTo(cx - 8, cy);
      this.overlay.lineTo(cx + 8, cy);
      this.overlay.moveTo(cx, cy - 8);
      this.overlay.lineTo(cx, cy + 8);
      this.overlay.strokePath();
    }

    // Update text display
    if (this.text && profile) {
      this.text.setText(
        `[BUILDING TUNER] ${this.targetType}\n` +
        `displayWidth: ${profile.displayWidth}\n` +
        `originX: ${profile.originX.toFixed(2)}  originY: ${profile.originY.toFixed(2)}\n` +
        `offsetX: ${profile.offsetX}  offsetY: ${profile.offsetY}\n` +
        `img: ${img ? `(${Math.round(img.x)}, ${Math.round(img.y)})` : 'none'}\n` +
        `\nArrow: offset | Shift+Arrow: +/-5\n` +
        `[/]: displayWidth | O/P: originY | C: copy`,
      );
    }
  }

  /** Set the target building type for tuning. */
  setTargetBuildingType(type: BuildingType): void {
    this.targetType = type;
  }

  /** Reset the current target profile to defaults. */
  resetTarget(): void {
    resetBuildingProfile(this.targetType);
    this.saveToLocalStorage();
    console.log(`[BuildingDevTuner] Reset ${this.targetType} to defaults`);
  }

  // ─── Overlay lifecycle ────────────────────────────────────────

  private createOverlay(): void {
    this.overlay = this.scene.add.graphics();
    this.overlay.setDepth(9999);

    this.text = this.scene.add.text(10, 10, '', {
      fontSize: '12px',
      color: '#00FF00',
      backgroundColor: '#000000AA',
      padding: { x: 6, y: 4 },
      fontFamily: 'monospace',
      lineSpacing: 2,
    });
    this.text.setDepth(9999);
    this.text.setScrollFactor(0);
  }

  private destroyOverlay(): void {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    if (this.text) {
      this.text.destroy();
      this.text = null;
    }
  }

  // ─── localStorage persistence (optional, dev-only) ────────────

  private saveToLocalStorage(): void {
    try {
      const profile = buildingProfiles[this.targetType];
      if (profile) {
        const data = { [this.targetType]: { ...profile } };
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      }
    } catch {
      // localStorage may be unavailable — ignore silently
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [key, profile] of Object.entries(data)) {
        const bp = buildingProfiles[key as BuildingType];
        if (bp) {
          Object.assign(bp, profile);
        }
      }
    } catch {
      // Corrupted or unavailable — ignore silently
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────

  destroy(): void {
    this.destroyOverlay();
  }
}
