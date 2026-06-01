/**
 * BlockoutWeaponVfxRenderer — renders weapon VFX for blockout vehicles.
 *
 * BLOCKOUT-05H+: Visual-only firing, recoil, and weapon VFX for
 * Smoky / Railgun / Thunder in arena/dev mode.
 *
 * Uses Phaser Graphics primitives only:
 * - no PNG
 * - no asset manifest
 * - no generated manifest
 * - no final art
 *
 * VFX origin comes from actual barrel/mount origin, not body center.
 * Stays correct for rear/front_center mount vehicles.
 * Stays correct while vehicle is moving.
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import type { BlockoutWeaponVfxEvent } from '../../state/blockoutWeaponVfx';
import { getVfxEvents } from '../../state/blockoutWeaponVfx';
import type { VfxProfile } from '../../config/blockoutProfiles';
import { getWeaponVfxProfile } from '../../config/blockoutVfxData';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for weapon VFX (above blockout vehicles). */
const VFX_DEPTH = 125;

// ─── Renderer ──────────────────────────────────────────────────────

export class BlockoutWeaponVfxRenderer {
  private scene: Phaser.Scene;

  /** Graphics object for VFX rendering. */
  private graphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, _offset: IsoPoint) {
    this.scene = scene;
  }

  // ─── Frame sync ──────────────────────────────────────────────────

  /**
   * Render all active VFX events. Called each frame.
   *
   * Reads VFX events from the module-level event list and draws
   * them using Phaser Graphics primitives.
   */
  syncFromState(nowMs: number): void {
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics();
      this.graphics.setDepth(VFX_DEPTH);
    }

    this.graphics.clear();

    const events = getVfxEvents();
    for (const event of events) {
      const ageMs = nowMs - event.createdAt;
      const durationMs = event.durationMs;
      if (ageMs >= durationMs) continue;

      const vfxProfile = getWeaponVfxProfile(event.weaponId);
      if (!vfxProfile) continue;

      // Age-based alpha: fade out over duration
      const t = ageMs / durationMs;
      const alpha = Math.max(0, 1 - t);

      this.renderVfxEvent(event, vfxProfile, alpha, ageMs, durationMs);
    }
  }

  // ─── VFX rendering by weapon type ────────────────────────────────

  private renderVfxEvent(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    ageMs: number,
    durationMs: number,
  ): void {
    switch (event.eventType) {
      case 'smokyShot':
        this.renderSmokyShot(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'railgunLine':
        this.renderRailgunLine(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'thunderSplash':
        this.renderThunderSplash(event, vfxProfile, alpha, ageMs, durationMs);
        break;
    }
  }

  /**
   * Smoky VFX: muzzle flash + short tracer + impact dot.
   */
  private renderSmokyShot(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    _ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);

    // Compute end point: barrel origin + range along turret angle
    const range = event.rangePx;
    const endX = event.originX + cos * range;
    const endY = event.originY + sin * range;

    // Muzzle flash (bright yellow circle at barrel tip)
    const flashRadius = vfxProfile.muzzleFlashRadiusPx ?? 5;
    const flashAlpha = Math.min(1, alpha * 1.5); // Flash fades faster
    g.fillStyle(vfxProfile.color, flashAlpha);
    g.fillCircle(event.originX, event.originY, flashRadius);

    // Short tracer line from barrel to ~60% of range
    const tracerEnd = 0.6;
    const tracerX = event.originX + cos * range * tracerEnd;
    const tracerY = event.originY + sin * range * tracerEnd;
    g.lineStyle(vfxProfile.width, vfxProfile.color, alpha * 0.8);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(tracerX, tracerY);
    g.strokePath();

    // Impact dot at target area
    const impactRadius = event.impactRadiusPx || 4;
    g.fillStyle(vfxProfile.secondaryColor ?? 0xffaa00, alpha * 0.9);
    g.fillCircle(endX, endY, impactRadius);
  }

  /**
   * Railgun VFX: long bright line + pierce ticks.
   */
  private renderRailgunLine(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    _ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);

    const range = event.rangePx;
    const endX = event.originX + cos * range;
    const endY = event.originY + sin * range;

    // Muzzle flash (bright cyan)
    const flashRadius = vfxProfile.muzzleFlashRadiusPx ?? 6;
    g.fillStyle(vfxProfile.color, Math.min(1, alpha * 1.5));
    g.fillCircle(event.originX, event.originY, flashRadius);

    // Main rail line — bright and thin
    g.lineStyle(vfxProfile.width + 1, vfxProfile.color, alpha);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(endX, endY);
    g.strokePath();

    // Secondary glow line — wider, semi-transparent
    g.lineStyle(vfxProfile.width + 3, vfxProfile.secondaryColor ?? 0x88ffff, alpha * 0.3);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(endX, endY);
    g.strokePath();

    // Pierce ticks along the line (3 small ticks at 30%, 60%, 90%)
    for (const frac of [0.3, 0.6, 0.9]) {
      const tickX = event.originX + cos * range * frac;
      const tickY = event.originY + sin * range * frac;
      // Perpendicular tick marks
      const perpX = -sin * 4;
      const perpY = cos * 4;
      g.lineStyle(1, vfxProfile.color, alpha * 0.6);
      g.beginPath();
      g.moveTo(tickX - perpX, tickY - perpY);
      g.lineTo(tickX + perpX, tickY + perpY);
      g.strokePath();
    }
  }

  /**
   * Thunder VFX: short tracer + impact explosion circle + splash radius ring.
   */
  private renderThunderSplash(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    _ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);

    const range = event.rangePx;
    const endX = event.originX + cos * range;
    const endY = event.originY + sin * range;

    // Short tracer toward target (fades quickly)
    g.lineStyle(vfxProfile.width + 2, vfxProfile.color, alpha * 0.6);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(endX, endY);
    g.strokePath();

    // Muzzle flash
    const flashRadius = vfxProfile.muzzleFlashRadiusPx ?? 4;
    g.fillStyle(vfxProfile.color, Math.min(1, alpha * 1.2));
    g.fillCircle(event.originX, event.originY, flashRadius);

    // Impact explosion circle (filled, fading)
    const impactRadius = event.impactRadiusPx || 40;
    // Expand the explosion slightly over time
    const expandFactor = 1 + (1 - alpha) * 0.3;
    const expandedRadius = impactRadius * expandFactor;

    g.fillStyle(vfxProfile.color, alpha * 0.4);
    g.fillCircle(endX, endY, expandedRadius);

    // Inner bright core
    g.fillStyle(vfxProfile.secondaryColor ?? 0xff3300, alpha * 0.6);
    g.fillCircle(endX, endY, expandedRadius * 0.4);

    // Splash radius ring (outlined)
    g.lineStyle(1.5, vfxProfile.secondaryColor ?? 0xff3300, alpha * 0.5);
    g.strokeCircle(endX, endY, impactRadius);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }
}
