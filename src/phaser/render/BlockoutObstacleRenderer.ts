/**
 * BlockoutObstacleRenderer — renders blockout obstacles as Phaser Graphics primitives.
 *
 * BLOCKOUT-08H: Dev/arena-only blockout obstacles for combat sandbox.
 *
 * Uses Phaser Graphics primitives only:
 * - no PNG
 * - no asset manifest
 * - no generated manifest
 * - no final art
 *
 * Each obstacle type is visually distinct:
 * - blocker_wall: dark gray/metal rectangle
 * - cover_crate: brown wooden crate square
 * - low_barrier: lighter gray thin rectangle
 * - dummy_rock: brownish circle
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import type { BlockoutObstacleState } from '../../state/blockoutObstacleState';
import { getObstacleTypeConfig } from '../../config/blockoutObstacleData';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for blockout obstacles (below vehicles, above terrain). */
const OBSTACLE_DEPTH = 110;

/** Debug label color. */
const DEBUG_LABEL_COLOR = '#aaaaaa';

// ─── Renderer ──────────────────────────────────────────────────────

export class BlockoutObstacleRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Graphics objects keyed by obstacle ID. */
  private obstacleGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Debug text labels keyed by obstacle ID. */
  private debugLabels = new Map<string, Phaser.GameObjects.Text>();

  /** Whether debug labels are shown. Default false — labels are opt-in only. */
  private showDebugLabels = false;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Toggle methods ──────────────────────────────────────────────

  /** Toggle debug labels visibility. Returns new state. */
  toggleDebugLabels(): boolean {
    this.showDebugLabels = !this.showDebugLabels;
    for (const [, label] of this.debugLabels) {
      label.setVisible(this.showDebugLabels);
    }
    return this.showDebugLabels;
  }

  /** Whether debug labels are currently visible. */
  isDebugLabelsVisible(): boolean {
    return this.showDebugLabels;
  }

  // ─── Frame sync ──────────────────────────────────────────────────

  /**
   * Sync blockout obstacle rendering from current obstacle state.
   * Called each frame. Destroys stale graphics, creates new ones for new obstacles.
   */
  syncFromState(obstacles: BlockoutObstacleState[]): void {
    const activeIds = new Set<string>();

    for (const obstacle of obstacles) {
      activeIds.add(obstacle.id);

      let g = this.obstacleGraphics.get(obstacle.id);
      if (!g) {
        g = this.scene.add.graphics();
        g.setDepth(OBSTACLE_DEPTH);
        this.obstacleGraphics.set(obstacle.id, g);
      }

      // Redraw this obstacle
      this.renderObstacle(g, obstacle);

      // Debug label
      let label = this.debugLabels.get(obstacle.id);
      if (!label && this.showDebugLabels) {
        label = this.scene.add.text(0, 0, '', {
          fontSize: '8px',
          color: DEBUG_LABEL_COLOR,
          backgroundColor: '#00000033',
          padding: { x: 2, y: 1 },
        });
        label.setDepth(OBSTACLE_DEPTH + 1);
        label.setOrigin(0.5, 1);
        this.debugLabels.set(obstacle.id, label);
      }

      if (label) {
        const cx = obstacle.worldX + this.offset.x;
        const cy = obstacle.worldY + this.offset.y;
        const pierceLabel = obstacle.pierceable ? ' [P]' : '';
        label.setText(`${obstacle.type}${pierceLabel}`);
        label.setPosition(cx, cy - this.getShapeTopOffset(obstacle) - 4);
        label.setVisible(this.showDebugLabels);
      }
    }

    // Clean up stale obstacles
    for (const [id, g] of this.obstacleGraphics) {
      if (!activeIds.has(id)) {
        g.destroy();
        this.obstacleGraphics.delete(id);
      }
    }
    for (const [id, label] of this.debugLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.debugLabels.delete(id);
      }
    }
  }

  // ─── Obstacle rendering ──────────────────────────────────────────

  private getShapeTopOffset(obstacle: BlockoutObstacleState): number {
    if (obstacle.shape.kind === 'rect') {
      return obstacle.shape.height / 2;
    }
    return obstacle.shape.radius;
  }

  private renderObstacle(g: Phaser.GameObjects.Graphics, obstacle: BlockoutObstacleState): void {
    g.clear();

    const config = getObstacleTypeConfig(obstacle.type);
    const fillColor = config?.fillColor ?? 0x555555;
    const outlineColor = config?.outlineColor ?? 0x333333;

    const cx = obstacle.worldX + this.offset.x;
    const cy = obstacle.worldY + this.offset.y;

    if (obstacle.shape.kind === 'rect') {
      const w = obstacle.shape.width;
      const h = obstacle.shape.height;

      // Filled rectangle
      g.fillStyle(fillColor, 0.85);
      g.fillRect(cx - w / 2, cy - h / 2, w, h);

      // Outline
      g.lineStyle(1.5, outlineColor, 1);
      g.strokeRect(cx - w / 2, cy - h / 2, w, h);

      // Pierceable marker: dashed line pattern inside
      if (obstacle.pierceable) {
        g.lineStyle(1, 0xffff00, 0.5);
        const step = 6;
        for (let x = cx - w / 2 + 3; x < cx + w / 2 - 3; x += step) {
          g.beginPath();
          g.moveTo(x, cy - h / 2 + 2);
          g.lineTo(Math.min(x + step / 2, cx + w / 2 - 3), cy - h / 2 + 2);
          g.strokePath();
          g.beginPath();
          g.moveTo(x, cy + h / 2 - 2);
          g.lineTo(Math.min(x + step / 2, cx + w / 2 - 3), cy + h / 2 - 2);
          g.strokePath();
        }
      }
    } else if (obstacle.shape.kind === 'circle') {
      const r = obstacle.shape.radius;

      // Filled circle
      g.fillStyle(fillColor, 0.85);
      g.fillCircle(cx, cy, r);

      // Outline
      g.lineStyle(1.5, outlineColor, 1);
      g.strokeCircle(cx, cy, r);
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    for (const [, g] of this.obstacleGraphics) {
      g.destroy();
    }
    this.obstacleGraphics.clear();

    for (const [, label] of this.debugLabels) {
      label.destroy();
    }
    this.debugLabels.clear();
  }
}
