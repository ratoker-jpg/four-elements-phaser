/**
 * BlockoutDamageRenderer — renders damage numbers, hit markers, and status tags
 * for blockout vehicle damage events.
 *
 * BLOCKOUT-07H+: Dev/arena-only damage visual feedback.
 *
 * Uses Phaser Graphics primitives only:
 * - no PNG
 * - no asset manifest
 * - no generated manifest
 * - no final art
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import type { BlockoutDamageEvent } from '../../state/blockoutDamage';
import { getDamageEvents } from '../../state/blockoutDamage';
import { computeBodyWorldCenter, getBodyPixelSize } from './blockoutVehicleGeometry';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for damage rendering (above blockout vehicles). */
const DAMAGE_DEPTH = 126;

/** Hit marker radius. */
const HIT_MARKER_RADIUS = 4;

/** Damage number font size. */
const DAMAGE_NUMBER_FONT_SIZE = '10px';

/** Status tag colors. */
const STATUS_TAG_COLORS: Record<string, number> = {
  burn: 0xff6600,
  freeze: 0x00ccff,
  beam: 0x00ff88,
  overheat: 0xff4400,
  plasma: 0x8800ff,
  ricochet: 0xffcc00,
  stunned: 0xffff00,
};

/** Status tag rectangle size. */
const STATUS_TAG_SIZE = { w: 6, h: 3 };

// ─── Renderer ──────────────────────────────────────────────────────

export class BlockoutDamageRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Graphics object for damage rendering. */
  private graphics: Phaser.GameObjects.Graphics | null = null;

  /** Text objects for floating damage numbers. */
  private damageTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Frame sync ──────────────────────────────────────────────────

  /**
   * Render all active damage events and status tags. Called each frame.
   */
  syncFromState(nowMs: number, vehicles: BlockoutVehicleState[]): void {
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics();
      this.graphics.setDepth(DAMAGE_DEPTH);
    }

    this.graphics.clear();

    // Clean up old text objects
    for (const text of this.damageTexts) {
      text.destroy();
    }
    this.damageTexts = [];

    // Render damage events
    const events = getDamageEvents();
    for (const event of events) {
      const ageMs = nowMs - event.createdAt;
      const durationMs = event.durationMs;
      if (ageMs >= durationMs) continue;

      const t = ageMs / durationMs;
      const alpha = Math.max(0, 1 - t);

      // Hit marker (small circle at damage point)
      this.renderHitMarker(event, alpha);

      // Floating damage number
      this.renderDamageNumber(event, t, alpha);
    }

    // Render status tags on vehicles
    for (const vehicle of vehicles) {
      if (vehicle.isDestroyed) continue;
      if (vehicle.activeStatusTags.length === 0) continue;

      this.renderStatusTags(vehicle, nowMs);
    }
  }

  // ─── Hit marker ────────────────────────────────────────────────

  private renderHitMarker(event: BlockoutDamageEvent, alpha: number): void {
    if (!this.graphics) return;

    // Brief hit marker - only show for first 30% of duration
    const g = this.graphics;
    const markerAlpha = alpha * 1.5; // Slightly brighter

    // Small circle at hit point
    g.fillStyle(0xffffff, Math.min(1, markerAlpha));
    g.fillCircle(event.x, event.y, HIT_MARKER_RADIUS);

    // Small X marker
    g.lineStyle(1.5, 0xff4444, Math.min(1, markerAlpha));
    const s = HIT_MARKER_RADIUS;
    g.beginPath();
    g.moveTo(event.x - s, event.y - s);
    g.lineTo(event.x + s, event.y + s);
    g.strokePath();
    g.beginPath();
    g.moveTo(event.x + s, event.y - s);
    g.lineTo(event.x - s, event.y + s);
    g.strokePath();
  }

  // ─── Floating damage number ────────────────────────────────────

  private renderDamageNumber(event: BlockoutDamageEvent, t: number, alpha: number): void {
    // Float upward over duration
    const floatOffset = t * 20; // 20px upward float
    const x = event.x;
    const y = event.y - 10 - floatOffset;

    // Color based on amount
    let color = '#ffffff'; // white for small
    if (event.amount >= 30) {
      color = '#ff4444'; // red for large
    } else if (event.amount >= 15) {
      color = '#ffcc00'; // yellow for medium
    }

    // Kill marker
    const killMarker = event.isKill ? ' 💀' : '';

    const text = this.scene.add.text(x, y, `-${Math.round(event.amount)}${killMarker}`, {
      fontSize: DAMAGE_NUMBER_FONT_SIZE,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 0.5);
    text.setAlpha(alpha);
    text.setDepth(DAMAGE_DEPTH + 1);

    this.damageTexts.push(text);
  }

  // ─── Status tag markers ────────────────────────────────────────

  private renderStatusTags(vehicle: BlockoutVehicleState, _nowMs: number): void {
    if (!this.graphics) return;
    const g = this.graphics;

    const bodyCenter = computeBodyWorldCenter(vehicle, this.offset);
    const bodySize = getBodyPixelSize(vehicle.bodyId);

    // Position tags above HP bar area
    const baseY = bodyCenter.y - bodySize.h / 2 - 14;
    const tagSpacing = STATUS_TAG_SIZE.w + 2;

    for (let i = 0; i < vehicle.activeStatusTags.length; i++) {
      const tag = vehicle.activeStatusTags[i];
      const color = STATUS_TAG_COLORS[tag] ?? 0x888888;

      const x = bodyCenter.x - (vehicle.activeStatusTags.length * tagSpacing) / 2 + i * tagSpacing + tagSpacing / 2;
      const y = baseY;

      g.fillStyle(color, 0.8);
      g.fillRect(x - STATUS_TAG_SIZE.w / 2, y - STATUS_TAG_SIZE.h / 2, STATUS_TAG_SIZE.w, STATUS_TAG_SIZE.h);
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
    for (const text of this.damageTexts) {
      text.destroy();
    }
    this.damageTexts = [];
  }
}
