/**
 * CameraProjectionDebugRenderer — dev/arena-only calibration overlay.
 *
 * CAMERA-00: Renders the projection basis vectors, ground diamonds,
 * projected ground circles, test cube/pillar, and comparison markers
 * so a human can visually verify the projection contract.
 *
 * Visible only in dev/arena mode. Toggled by C key.
 * No production impact.
 *
 * Renders:
 * - Origin point O
 * - basisX arrow, labeled X
 * - basisY arrow, labeled Y
 * - basisZ arrow, labeled Z
 * - 1x1 ground diamond
 * - 2x2 footprint parallelogram
 * - Projected ground circle
 * - Screen-space circle comparison (labeled "wrong top-down")
 * - Test cube/pillar with vertical edge using basisZ
 * - Anchor point marker (ground contact)
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import {
  basisX,
  basisY,
  basisZ,
  projectGroundPoint,
  projectGroundCircleToPolyline,
  projectGroundRect,
  PROJ_TILE_W,
} from '../../config/cameraProjectionContract';

// ─── Depth ──────────────────────────────────────────────────────────

/** Calibration overlay depth — above terrain, below HUD. */
const CALIBRATION_DEPTH = 150;

/** Arrow head size in pixels. */
const ARROW_HEAD = 8;

/** Length multiplier for basis arrows (in tile units). */
const ARROW_LENGTH = 3;

/** Radius for the projected ground circle (in tile units). */
const GROUND_CIRCLE_RADIUS = 1.5;

/** Number of segments for the projected circle polyline. */
const CIRCLE_SEGMENTS = 32;

/** Height of the test cube/pillar (in world Z units). */
const TEST_PILLAR_HEIGHT = 1.5;

// ─── Renderer ──────────────────────────────────────────────────────

export class CameraProjectionDebugRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Graphics object for the calibration overlay. */
  private graphics: Phaser.GameObjects.Graphics | null = null;

  /** Label objects. */
  private labels: Phaser.GameObjects.Text[] = [];

  /** Whether the overlay is currently visible. */
  private _visible = false;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Public API ──────────────────────────────────────────────────

  /** Toggle visibility. Returns new state. */
  toggle(): boolean {
    this._visible = !this._visible;
    if (this.graphics) {
      this.graphics.setVisible(this._visible);
    }
    for (const label of this.labels) {
      label.setVisible(this._visible);
    }
    return this._visible;
  }

  /** Whether the overlay is currently visible. */
  isVisible(): boolean {
    return this._visible;
  }

  /** Render or update the calibration overlay. Call once after creation or when offset changes. */
  render(): void {
    this.destroyGraphics();

    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(CALIBRATION_DEPTH);
    this.graphics.setVisible(this._visible);

    const g = this.graphics;
    const origin = { x: this.offset.x, y: this.offset.y };

    // ── Origin point O ──
    g.fillStyle(0xffffff, 1);
    g.fillCircle(origin.x, origin.y, 4);
    this.addLabel(origin.x - 16, origin.y - 14, 'O', '#ffffff');

    // ── Basis arrows ──
    this.drawBasisArrow(g, origin, basisX, ARROW_LENGTH, 0xff4444, 'X');
    this.drawBasisArrow(g, origin, basisY, ARROW_LENGTH, 0x44ff44, 'Y');
    this.drawBasisArrow(g, origin, basisZ, ARROW_LENGTH, 0x4488ff, 'Z');

    // ── 1x1 ground diamond ──
    const diamond1 = [
      projectGroundPoint(0, -0.5, origin),
      projectGroundPoint(0.5, 0, origin),
      projectGroundPoint(0, 0.5, origin),
      projectGroundPoint(-0.5, 0, origin),
    ];
    g.lineStyle(2, 0xffff00, 0.7);
    g.beginPath();
    g.moveTo(diamond1[0].x, diamond1[0].y);
    for (let i = 1; i < diamond1.length; i++) {
      g.lineTo(diamond1[i].x, diamond1[i].y);
    }
    g.closePath();
    g.strokePath();
    this.addLabel(diamond1[1].x + 4, diamond1[1].y - 10, '1x1', '#ffff00');

    // ── 2x2 footprint parallelogram ──
    const diamond2 = projectGroundRect(1, 0, 2, 2, origin);
    g.lineStyle(2, 0xff8800, 0.7);
    g.beginPath();
    g.moveTo(diamond2[0].x, diamond2[0].y);
    for (let i = 1; i < diamond2.length; i++) {
      g.lineTo(diamond2[i].x, diamond2[i].y);
    }
    g.closePath();
    g.strokePath();
    this.addLabel(diamond2[1].x + 4, diamond2[1].y - 10, '2x2', '#ff8800');

    // ── Projected ground circle ──
    const circleCenter = projectGroundPoint(-3, 0, origin);
    const circlePoints = projectGroundCircleToPolyline(-3, 0, GROUND_CIRCLE_RADIUS, CIRCLE_SEGMENTS, origin);
    g.lineStyle(2, 0x00ffff, 0.8);
    g.beginPath();
    g.moveTo(circlePoints[0].x, circlePoints[0].y);
    for (let i = 1; i < circlePoints.length; i++) {
      g.lineTo(circlePoints[i].x, circlePoints[i].y);
    }
    g.closePath();
    g.strokePath();
    this.addLabel(circleCenter.x - 40, circleCenter.y - GROUND_CIRCLE_RADIUS * basisX.y - 14, 'projected circle', '#00ffff');

    // ── Screen-space circle (wrong!) for comparison ──
    // Same center, same "radius" in pixels — but this is a naive circle
    const naiveRadius = GROUND_CIRCLE_RADIUS * (PROJ_TILE_W / 2);
    g.lineStyle(1, 0xff00ff, 0.5);
    g.strokeCircle(circleCenter.x, circleCenter.y, naiveRadius);
    this.addLabel(circleCenter.x + naiveRadius + 4, circleCenter.y - 6, 'wrong top-down screen circle', '#ff00ff');

    // ── Test cube/pillar ──
    this.drawTestPillar(g, origin, 3, 0, TEST_PILLAR_HEIGHT);

    // ── Anchor point marker ──
    const anchorPos = projectGroundPoint(3, 0, origin);
    g.lineStyle(1, 0xff8800, 0.9);
    // Small crosshair at ground contact
    g.beginPath();
    g.moveTo(anchorPos.x - 6, anchorPos.y);
    g.lineTo(anchorPos.x + 6, anchorPos.y);
    g.moveTo(anchorPos.x, anchorPos.y - 6);
    g.lineTo(anchorPos.x, anchorPos.y + 6);
    g.strokePath();
    this.addLabel(anchorPos.x + 8, anchorPos.y + 4, 'anchor', '#ff8800');
  }

  // ─── Drawing helpers ────────────────────────────────────────────

  private drawBasisArrow(
    g: Phaser.GameObjects.Graphics,
    origin: { x: number; y: number },
    basis: { x: number; y: number },
    length: number,
    color: number,
    label: string,
  ): void {
    const endX = origin.x + basis.x * length;
    const endY = origin.y + basis.y * length;

    // Arrow shaft
    g.lineStyle(3, color, 0.9);
    g.beginPath();
    g.moveTo(origin.x, origin.y);
    g.lineTo(endX, endY);
    g.strokePath();

    // Arrow head
    const angle = Math.atan2(endY - origin.y, endX - origin.x);
    const headAngle = Math.PI / 6;
    g.fillStyle(color, 0.9);
    g.beginPath();
    g.moveTo(endX, endY);
    g.lineTo(
      endX - ARROW_HEAD * Math.cos(angle - headAngle),
      endY - ARROW_HEAD * Math.sin(angle - headAngle),
    );
    g.lineTo(
      endX - ARROW_HEAD * Math.cos(angle + headAngle),
      endY - ARROW_HEAD * Math.sin(angle + headAngle),
    );
    g.closePath();
    g.fillPath();

    // Label
    const labelOffset = 12;
    this.addLabel(
      endX + labelOffset * Math.cos(angle + Math.PI / 4),
      endY + labelOffset * Math.sin(angle + Math.PI / 4),
      label,
      '#' + color.toString(16).padStart(6, '0'),
    );
  }

  private drawTestPillar(
    g: Phaser.GameObjects.Graphics,
    origin: { x: number; y: number },
    tileX: number,
    tileY: number,
    height: number,
  ): void {
    // Base diamond (1x1 at tileX, tileY)
    const basePoints = [
      projectGroundPoint(tileX, tileY - 0.5, origin),
      projectGroundPoint(tileX + 0.5, tileY, origin),
      projectGroundPoint(tileX, tileY + 0.5, origin),
      projectGroundPoint(tileX - 0.5, tileY, origin),
    ];

    // Top face (offset by height * basisZ)
    const topPoints = basePoints.map(p => ({
      x: p.x + height * basisZ.x,
      y: p.y + height * basisZ.y,
    }));

    // Draw base
    g.lineStyle(1, 0x88aaff, 0.6);
    g.beginPath();
    g.moveTo(basePoints[0].x, basePoints[0].y);
    for (let i = 1; i < basePoints.length; i++) {
      g.lineTo(basePoints[i].x, basePoints[i].y);
    }
    g.closePath();
    g.strokePath();

    // Draw top face
    g.lineStyle(1, 0xaaccff, 0.8);
    g.fillStyle(0xaaccff, 0.15);
    g.beginPath();
    g.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < topPoints.length; i++) {
      g.lineTo(topPoints[i].x, topPoints[i].y);
    }
    g.closePath();
    g.strokePath();
    g.fillPath();

    // Draw vertical edges (basisZ direction)
    g.lineStyle(1, 0x4488ff, 0.7);
    // Left vertical edge
    g.beginPath();
    g.moveTo(basePoints[3].x, basePoints[3].y);
    g.lineTo(topPoints[3].x, topPoints[3].y);
    g.strokePath();
    // Bottom vertical edge
    g.beginPath();
    g.moveTo(basePoints[2].x, basePoints[2].y);
    g.lineTo(topPoints[2].x, topPoints[2].y);
    g.strokePath();
    // Right vertical edge
    g.beginPath();
    g.moveTo(basePoints[1].x, basePoints[1].y);
    g.lineTo(topPoints[1].x, topPoints[1].y);
    g.strokePath();

    this.addLabel(topPoints[0].x, topPoints[0].y - 12, 'pillar', '#aaccff');
  }

  private addLabel(x: number, y: number, text: string, color: string): void {
    const label = this.scene.add.text(x, y, text, {
      fontSize: '9px',
      color,
      backgroundColor: '#00000088',
      padding: { x: 2, y: 1 },
    });
    label.setDepth(CALIBRATION_DEPTH + 1);
    label.setScrollFactor(0, 0); // Labels move with camera
    // Actually, labels should be in world space — they need to move with the world
    label.setScrollFactor(1, 1);
    label.setVisible(this._visible);
    this.labels.push(label);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  private destroyGraphics(): void {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels = [];
  }

  destroy(): void {
    this.destroyGraphics();
  }
}
