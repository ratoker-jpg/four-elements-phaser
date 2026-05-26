/**
 * ModularTankDebugOverlay — debug graphics and text for modular tank tuning.
 *
 * Extracted from EntityRenderer as part of ARCH-13B (Phase B).
 * Owns: graphics markers, tile diamond, footprint overlay, debug text,
 * show/hide/toggle, rebuild/destroy lifecycle.
 *
 * No gameplay behavior. Only active when the tuner overlay is ON (T key).
 */

import Phaser from 'phaser';
import {
  TILE_H,
  TILE_W,
  tunerState,
  MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR,
  MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR,
  type ModularTankDirection,
} from '../../config/worldConfig';
import { MODULAR_SCALE_RATIO, MODULAR_ANCHOR_CORRECTION } from '../../config/unitRenderConfig';

/** Data needed to create the debug overlay for the first time. */
export interface DebugOverlayInitData {
  tx: number;
  ty: number;
  anchorWorldX: number;
  anchorWorldY: number;
  hullWorldX: number;
  hullWorldY: number;
  turretWorldX: number;
  turretWorldY: number;
  baseDepth: number;
}

/** Data needed to rebuild the overlay after position/direction changes. */
export interface DebugOverlayRebuildData {
  hullWorldX: number;
  hullWorldY: number;
  turretWorldX: number;
  turretWorldY: number;
  bodyDir: ModularTankDirection;
  turretDir: ModularTankDirection;
  scale: number;
}

export class ModularTankDebugOverlay {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private visible: boolean;

  /** Anchor world position (tile center in screen space + offset). */
  private anchorWorldX: number;
  private anchorWorldY: number;

  /** Anchor tile coordinates. */
  private anchorTile: { tx: number; ty: number };

  constructor(scene: Phaser.Scene, data: DebugOverlayInitData, initialVisible: boolean) {
    this.scene = scene;
    this.visible = initialVisible;
    this.anchorWorldX = data.anchorWorldX;
    this.anchorWorldY = data.anchorWorldY;
    this.anchorTile = { tx: data.tx, ty: data.ty };

    // ── Graphics ─────────────────────────────────────────────────
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(data.baseDepth + 10);
    this.graphics.setVisible(this.visible);

    this.drawGraphics(
      data.anchorWorldX,
      data.anchorWorldY,
      data.hullWorldX,
      data.hullWorldY,
      data.turretWorldX,
      data.turretWorldY,
    );

    // ── Text ─────────────────────────────────────────────────────
    this.text = this.scene.add.text(
      data.hullWorldX + 30,
      data.hullWorldY + 28,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f4f7fb',
        backgroundColor: 'rgba(16, 18, 28, 0.76)',
        padding: { x: 4, y: 3 },
      },
    );
    this.text.setDepth(data.baseDepth + 11);
    this.text.setVisible(this.visible);
  }

  /** Draw all graphics markers (diamond, crosshairs, connecting line). */
  private drawGraphics(
    ax: number,
    ay: number,
    hullX: number,
    hullY: number,
    turretX: number,
    turretY: number,
  ): void {
    const g = this.graphics;
    const halfTileW = TILE_W / 2;
    const halfTileH = TILE_H / 2;

    // Logical tile footprint diamond for the modular unit anchor tile.
    g.lineStyle(2, 0x7cff7c, 0.95);
    g.beginPath();
    g.moveTo(ax, ay - halfTileH);
    g.lineTo(ax + halfTileW, ay);
    g.lineTo(ax, ay + halfTileH);
    g.lineTo(ax - halfTileW, ay);
    g.closePath();
    g.strokePath();

    // Logical tile anchor crosshair.
    g.lineStyle(2, 0xffd54f, 0.95);
    g.strokeCircle(ax, ay, 7);
    g.lineBetween(ax - 10, ay, ax + 10, ay);
    g.lineBetween(ax, ay - 10, ax, ay + 10);

    // Hull sprite origin marker (X).
    g.lineStyle(2, 0x26c6da, 0.95);
    g.strokeCircle(hullX, hullY, 6);
    g.lineBetween(hullX - 8, hullY - 8, hullX + 8, hullY + 8);
    g.lineBetween(hullX - 8, hullY + 8, hullX + 8, hullY - 8);

    // Connecting line from hull origin to turret origin.
    g.lineStyle(2, 0xffffff, 0.9);
    g.lineBetween(hullX, hullY, turretX, turretY);

    // Turret sprite origin marker (crosshair).
    g.lineStyle(2, 0xff6b6b, 0.95);
    g.strokeCircle(turretX, turretY, 6);
    g.lineBetween(turretX - 8, turretY, turretX + 8, turretY);
    g.lineBetween(turretX, turretY - 8, turretX, turretY + 8);
  }

  /** Build the debug text string for the modular tank overlay. */
  private buildDebugText(data: DebugOverlayRebuildData): string {
    const selected = tunerState.selectedLayer;
    const bodyDir = data.bodyDir;
    const turretDir = data.turretDir;
    const hullOff = MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR[bodyDir];
    const turretMount = MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR[bodyDir];

    // Compute effective (scale-transformed) offsets for display
    const effHull = {
      x: +(hullOff.x * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.x).toFixed(1),
      y: +(hullOff.y * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.y).toFixed(1),
    };
    const effTurret = {
      x: +(turretMount.x * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.x).toFixed(1),
      y: +(turretMount.y * MODULAR_SCALE_RATIO + MODULAR_ANCHOR_CORRECTION.y).toFixed(1),
    };

    const hullTag = selected === 'hull' ? '>> ' : '   ';
    const turretTag = selected === 'turret' ? '>> ' : '   ';
    return [
      `tx/ty: ${this.anchorTile.tx}, ${this.anchorTile.ty}`,
      `world: ${Math.round(data.hullWorldX)}, ${Math.round(data.hullWorldY)}`,
      `scale: ${data.scale.toFixed(2)}  ratio: ${MODULAR_SCALE_RATIO.toFixed(2)}  corr: ${MODULAR_ANCHOR_CORRECTION.x},${MODULAR_ANCHOR_CORRECTION.y}`,
      `bodyDir: ${bodyDir}  turretDir: ${turretDir}`,
      `${hullTag}hull[${bodyDir}]: base {${hullOff.x},${hullOff.y}} → eff {${effHull.x},${effHull.y}}`,
      `${turretTag}turret[${bodyDir}]: base {${turretMount.x},${turretMount.y}} → eff {${effTurret.x},${effTurret.y}}`,
      `Q/E= body dir  Z/X= turret dir`,
      `H= hull  J= turret  C= print`,
      `arrow= +/-1px  shift+arrow= +/-5px`,
    ].join('\n');
  }

  /** Whether the debug overlay is currently visible. */
  isVisible(): boolean {
    return this.visible;
  }

  /** Toggle visibility. Returns new visibility state. */
  toggle(): boolean {
    this.visible = !this.visible;
    this.graphics.setVisible(this.visible);
    this.text.setVisible(this.visible);
    return this.visible;
  }

  /**
   * Rebuild the debug overlay after offset/direction changes.
   * Clears existing graphics and redraws at updated positions.
   */
  rebuild(data: DebugOverlayRebuildData): void {
    // Clear and redraw graphics
    this.graphics.clear();
    this.drawGraphics(
      this.anchorWorldX,
      this.anchorWorldY,
      data.hullWorldX,
      data.hullWorldY,
      data.turretWorldX,
      data.turretWorldY,
    );

    // Update text position and content
    this.text.setPosition(data.hullWorldX + 30, data.hullWorldY + 28);
    this.text.setText(this.buildDebugText(data));
  }

  /** Destroy all debug overlay game objects. */
  destroy(): void {
    this.graphics.destroy();
    this.text.destroy();
  }
}
