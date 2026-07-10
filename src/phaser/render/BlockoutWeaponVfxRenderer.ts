/**
 * BlockoutWeaponVfxRenderer — renders weapon VFX for blockout vehicles.
 *
 * BLOCKOUT-05H+: Visual-only firing, recoil, and weapon VFX for
 * Smoky / Railgun / Thunder in arena/dev mode.
 *
 * BLOCKOUT-06H+: Extended to all 11 weapons with distinct visual
 * rendering for each VFX family.
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
import { TextureWeaponVfxRenderer } from './TextureWeaponVfxRenderer';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for weapon VFX (above blockout vehicles). */
const VFX_DEPTH = 125;

// ─── Renderer ──────────────────────────────────────────────────────

export class BlockoutWeaponVfxRenderer {
  private scene: Phaser.Scene;

  /** Graphics object for VFX rendering and guaranteed fallback. */
  private graphics: Phaser.GameObjects.Graphics | null = null;

  /** Pooled PNG overlay imported from the Godot donor project. */
  private readonly textureRenderer: TextureWeaponVfxRenderer;

  constructor(scene: Phaser.Scene, _offset: IsoPoint) {
    this.scene = scene;
    this.textureRenderer = new TextureWeaponVfxRenderer(scene);
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

    this.textureRenderer.syncFromState(nowMs);
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
      case 'shaftLine':
        this.renderShaftLine(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'flamethrowerCone':
        this.renderFlamethrowerCone(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'freezeCone':
        this.renderFreezeCone(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'isidaBeam':
        this.renderIsidaBeam(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'vulcanTracer':
        this.renderVulcanTracer(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'twinsPlasma':
        this.renderTwinsPlasma(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'ricochetBounce':
        this.renderRicochetBounce(event, vfxProfile, alpha, ageMs, durationMs);
        break;
      case 'hammerShotgun':
        this.renderHammerShotgun(event, vfxProfile, alpha, ageMs, durationMs);
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

  // ─── BLOCKOUT-06H+: 8 new weapon VFX renderers ───────────────────

  /**
   * Shaft VFX: Charge pulse + focused long sniper line.
   * Small pulsing circle at muzzle (charge indicator),
   * thin bright line from origin to range, brighter core than railgun, narrower.
   * Optional small crosshair at end.
   */
  private renderShaftLine(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);
    const range = event.rangePx;
    const endX = event.originX + cos * range;
    const endY = event.originY + sin * range;

    // Charge pulse circle at muzzle — pulsing based on chargePulseMs
    const pulseMs = vfxProfile.chargePulseMs ?? 150;
    const pulsePhase = (ageMs % pulseMs) / pulseMs;
    const pulseRadius = 3 + Math.sin(pulsePhase * Math.PI * 2) * 2;
    g.fillStyle(vfxProfile.secondaryColor ?? 0xff88ff, alpha * 0.8);
    g.fillCircle(event.originX, event.originY, pulseRadius);

    // Muzzle flash — small and bright
    const flashRadius = vfxProfile.muzzleFlashRadiusPx ?? 4;
    g.fillStyle(vfxProfile.color, Math.min(1, alpha * 1.3));
    g.fillCircle(event.originX, event.originY, flashRadius);

    // Thin bright line — narrower than railgun but brighter
    g.lineStyle(2, vfxProfile.color, alpha);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(endX, endY);
    g.strokePath();

    // Narrow glow line
    g.lineStyle(4, vfxProfile.secondaryColor ?? 0xff88ff, alpha * 0.25);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(endX, endY);
    g.strokePath();

    // Small crosshair at end
    const crossSize = 5;
    g.lineStyle(1, vfxProfile.color, alpha * 0.7);
    g.beginPath();
    g.moveTo(endX - crossSize, endY);
    g.lineTo(endX + crossSize, endY);
    g.strokePath();
    g.beginPath();
    g.moveTo(endX, endY - crossSize);
    g.lineTo(endX, endY + crossSize);
    g.strokePath();
  }

  /**
   * Flamethrower VFX: Orange cone sector.
   * Filled triangle/cone from origin toward aim angle,
   * flicker effect: randomize alpha slightly,
   * orange/yellow colors, short range.
   */
  private renderFlamethrowerCone(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    _ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);
    const range = vfxProfile.effectLengthPx ?? 120;
    const halfAngleDeg = event.coneAngleDeg || 25;
    const halfAngleRad = (halfAngleDeg * Math.PI) / 180;

    // Flicker: randomize alpha slightly
    const flickerAlpha = alpha * (0.7 + Math.random() * 0.3);

    // Draw cone as filled triangle
    const tipX = event.originX + cos * range;
    const tipY = event.originY + sin * range;

    // Left and right edges of cone
    const leftAngle = event.angle - halfAngleRad;
    const rightAngle = event.angle + halfAngleRad;
    const leftX = event.originX + Math.cos(leftAngle) * range;
    const leftY = event.originY + Math.sin(leftAngle) * range;
    const rightX = event.originX + Math.cos(rightAngle) * range;
    const rightY = event.originY + Math.sin(rightAngle) * range;

    // Outer cone — orange
    g.fillStyle(0xff4400, flickerAlpha * 0.5);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(leftX, leftY);
    g.lineTo(tipX, tipY);
    g.lineTo(rightX, rightY);
    g.closePath();
    g.fillPath();

    // Inner cone — brighter yellow, narrower
    const innerHalfAngle = halfAngleRad * 0.5;
    const innerRange = range * 0.7;
    const innerLeftAngle = event.angle - innerHalfAngle;
    const innerRightAngle = event.angle + innerHalfAngle;
    const innerLeftX = event.originX + Math.cos(innerLeftAngle) * innerRange;
    const innerLeftY = event.originY + Math.sin(innerLeftAngle) * innerRange;
    const innerRightX = event.originX + Math.cos(innerRightAngle) * innerRange;
    const innerRightY = event.originY + Math.sin(innerRightAngle) * innerRange;
    const innerTipX = event.originX + cos * innerRange;
    const innerTipY = event.originY + sin * innerRange;

    g.fillStyle(0xffaa00, flickerAlpha * 0.4);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(innerLeftX, innerLeftY);
    g.lineTo(innerTipX, innerTipY);
    g.lineTo(innerRightX, innerRightY);
    g.closePath();
    g.fillPath();

    // Muzzle glow
    g.fillStyle(0xffcc00, flickerAlpha * 0.8);
    g.fillCircle(event.originX, event.originY, 4);
  }

  /**
   * Freeze VFX: Blue/cyan cone sector.
   * Similar geometry to flamethrower but different colors.
   * Blue/cyan colors with small frost circles inside cone.
   */
  private renderFreezeCone(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    _ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);
    const range = vfxProfile.effectLengthPx ?? 120;
    const halfAngleDeg = event.coneAngleDeg || 25;
    const halfAngleRad = (halfAngleDeg * Math.PI) / 180;

    // Draw cone as filled triangle
    const tipX = event.originX + cos * range;
    const tipY = event.originY + sin * range;

    const leftAngle = event.angle - halfAngleRad;
    const rightAngle = event.angle + halfAngleRad;
    const leftX = event.originX + Math.cos(leftAngle) * range;
    const leftY = event.originY + Math.sin(leftAngle) * range;
    const rightX = event.originX + Math.cos(rightAngle) * range;
    const rightY = event.originY + Math.sin(rightAngle) * range;

    // Outer cone — cyan
    g.fillStyle(0x00ccff, alpha * 0.4);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(leftX, leftY);
    g.lineTo(tipX, tipY);
    g.lineTo(rightX, rightY);
    g.closePath();
    g.fillPath();

    // Inner cone — brighter blue
    const innerHalfAngle = halfAngleRad * 0.4;
    const innerRange = range * 0.65;
    const innerLeftAngle = event.angle - innerHalfAngle;
    const innerRightAngle = event.angle + innerHalfAngle;
    const innerLeftX = event.originX + Math.cos(innerLeftAngle) * innerRange;
    const innerLeftY = event.originY + Math.sin(innerLeftAngle) * innerRange;
    const innerRightX = event.originX + Math.cos(innerRightAngle) * innerRange;
    const innerRightY = event.originY + Math.sin(innerRightAngle) * innerRange;
    const innerTipX = event.originX + cos * innerRange;
    const innerTipY = event.originY + sin * innerRange;

    g.fillStyle(0x88eeff, alpha * 0.35);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(innerLeftX, innerLeftY);
    g.lineTo(innerTipX, innerTipY);
    g.lineTo(innerRightX, innerRightY);
    g.closePath();
    g.fillPath();

    // Frost circles inside cone
    for (const frac of [0.3, 0.55, 0.8]) {
      const frostX = event.originX + cos * range * frac;
      const frostY = event.originY + sin * range * frac;
      g.fillStyle(0xccffff, alpha * 0.3);
      g.fillCircle(frostX, frostY, 3);
    }

    // Muzzle glow — cyan
    g.fillStyle(0x00eeff, alpha * 0.8);
    g.fillCircle(event.originX, event.originY, 3);
  }

  /**
   * Isida VFX: Green support beam.
   * Continuous beam line from origin to target direction,
   * green/teal color, width pulses slightly,
   * small circles at origin and end (tether dots).
   */
  private renderIsidaBeam(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);
    const range = vfxProfile.effectLengthPx ?? 150;
    const endX = event.originX + cos * range;
    const endY = event.originY + sin * range;

    // Pulsing width based on age
    const pulseMs = vfxProfile.streamCadenceMs ?? 50;
    const pulsePhase = (ageMs % (pulseMs * 4)) / (pulseMs * 4);
    const pulseWidth = 2 + Math.sin(pulsePhase * Math.PI * 2) * 1;

    // Beam line — green/teal
    g.lineStyle(pulseWidth, vfxProfile.color, alpha * 0.8);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(endX, endY);
    g.strokePath();

    // Wider glow line
    g.lineStyle(pulseWidth + 3, 0x44ffaa, alpha * 0.15);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(endX, endY);
    g.strokePath();

    // Tether dot at origin
    g.fillStyle(vfxProfile.color, alpha * 0.9);
    g.fillCircle(event.originX, event.originY, 3);

    // Tether dot at end
    g.fillStyle(vfxProfile.color, alpha * 0.7);
    g.fillCircle(endX, endY, 4);
  }

  /**
   * Vulcan VFX: Rapid short tracer.
   * Short bright line from origin along aim angle,
   * small muzzle flash, very short duration.
   */
  private renderVulcanTracer(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    _ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);
    const range = vfxProfile.effectLengthPx ?? 200;

    // Short tracer — about 40% of range
    const tracerFrac = 0.4;
    const tracerEndX = event.originX + cos * range * tracerFrac;
    const tracerEndY = event.originY + sin * range * tracerFrac;

    // Tracer line
    g.lineStyle(vfxProfile.width, vfxProfile.color, alpha * 0.9);
    g.beginPath();
    g.moveTo(event.originX, event.originY);
    g.lineTo(tracerEndX, tracerEndY);
    g.strokePath();

    // Small muzzle flash
    const flashRadius = vfxProfile.muzzleFlashRadiusPx ?? 3;
    g.fillStyle(vfxProfile.color, Math.min(1, alpha * 1.5));
    g.fillCircle(event.originX, event.originY, flashRadius);
  }

  /**
   * Twins VFX: Plasma pulse circles.
   * Small bright circle traveling along aim direction,
   * position based on age (moves outward), bright colored dot.
   */
  private renderTwinsPlasma(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    ageMs: number,
    durationMs: number,
  ): void {
    const g = this.graphics!;
    const cos = Math.cos(event.angle);
    const sin = Math.sin(event.angle);
    const range = vfxProfile.effectLengthPx ?? 220;

    // Projectile moves from origin outward over its duration
    const t = Math.min(1, ageMs / durationMs);
    const projX = event.originX + cos * range * t;
    const projY = event.originY + sin * range * t;

    // Muzzle flash
    const flashRadius = vfxProfile.muzzleFlashRadiusPx ?? 3;
    g.fillStyle(vfxProfile.color, Math.min(1, alpha * 1.3));
    g.fillCircle(event.originX, event.originY, flashRadius);

    // Plasma dot — bright colored circle moving along path
    g.fillStyle(vfxProfile.color, alpha);
    g.fillCircle(projX, projY, vfxProfile.width + 1);

    // Glow around plasma
    g.fillStyle(0xccff44, alpha * 0.3);
    g.fillCircle(projX, projY, vfxProfile.width + 4);

    // Small trail behind projectile
    if (t > 0.1) {
      const trailLen = 0.1;
      const trailX = event.originX + cos * range * (t - trailLen);
      const trailY = event.originY + sin * range * (t - trailLen);
      g.lineStyle(1, vfxProfile.color, alpha * 0.4);
      g.beginPath();
      g.moveTo(trailX, trailY);
      g.lineTo(projX, projY);
      g.strokePath();
    }
  }

  /**
   * Ricochet VFX: Segmented path with bounces.
   * First segment from origin along aim angle,
   * 1-2 bounce points at deterministic positions,
   * each bounce changes direction slightly,
   * small circles at bounce points,
   * segments connected by lines.
   */
  private renderRicochetBounce(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    ageMs: number,
    durationMs: number,
  ): void {
    const g = this.graphics!;
    const range = vfxProfile.effectLengthPx ?? 200;
    const bounceCount = event.bounceCount || 2;

    // Deterministic bounce offsets based on event ID
    const id = event.id;

    // Build the path segments with bounces
    const points: { x: number; y: number }[] = [{ x: event.originX, y: event.originY }];

    let currentAngle = event.angle;
    let currentX = event.originX;
    let currentY = event.originY;

    const segmentLength = range / (bounceCount + 1);

    for (let i = 0; i < bounceCount; i++) {
      const nextX = currentX + Math.cos(currentAngle) * segmentLength;
      const nextY = currentY + Math.sin(currentAngle) * segmentLength;
      points.push({ x: nextX, y: nextY });

      // Bounce: change direction by a deterministic offset
      // Use event ID to make bounces consistent across frames
      const bounceDelta = ((id * 31 + i * 17) % 60 - 30) * (Math.PI / 180); // ±30 degrees
      currentAngle = currentAngle + bounceDelta;
      currentX = nextX;
      currentY = nextY;
    }

    // Final segment end
    const finalX = currentX + Math.cos(currentAngle) * segmentLength;
    const finalY = currentY + Math.sin(currentAngle) * segmentLength;
    points.push({ x: finalX, y: finalY });

    // Draw connected line segments
    g.lineStyle(vfxProfile.width, vfxProfile.color, alpha);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.strokePath();

    // Glow line
    g.lineStyle(vfxProfile.width + 2, 0xff4488, alpha * 0.2);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.strokePath();

    // Small circles at bounce points
    for (let i = 1; i < points.length - 1; i++) {
      g.fillStyle(vfxProfile.color, alpha * 0.8);
      g.fillCircle(points[i].x, points[i].y, 3);
    }

    // Muzzle flash
    g.fillStyle(vfxProfile.color, alpha);
    g.fillCircle(event.originX, event.originY, 3);

    // Impact dot at end
    const t = ageMs / durationMs;
    if (t > 0.8) {
      g.fillStyle(vfxProfile.color, alpha * 0.6);
      g.fillCircle(finalX, finalY, 4);
    }
  }

  /**
   * Hammer VFX: Fan of pellet tracers.
   * Multiple short lines spread in a cone,
   * each pellet at slightly different angle within cone,
   * short range, wider spread than smoky.
   */
  private renderHammerShotgun(
    event: BlockoutWeaponVfxEvent,
    vfxProfile: VfxProfile,
    alpha: number,
    _ageMs: number,
    _durationMs: number,
  ): void {
    const g = this.graphics!;
    const range = vfxProfile.effectLengthPx ?? 150;
    const halfAngleDeg = event.coneAngleDeg || 30;
    const halfAngleRad = (halfAngleDeg * Math.PI) / 180;
    const pelletCount = event.pelletCount || 5;

    // Muzzle flash — large
    const flashRadius = vfxProfile.muzzleFlashRadiusPx ?? 6;
    g.fillStyle(vfxProfile.color, Math.min(1, alpha * 1.4));
    g.fillCircle(event.originX, event.originY, flashRadius);

    // Spread pellets evenly within cone
    for (let i = 0; i < pelletCount; i++) {
      // Distribute pellets evenly across the cone
      const fraction = pelletCount > 1 ? i / (pelletCount - 1) : 0.5;
      const pelletAngle = event.angle - halfAngleRad + fraction * 2 * halfAngleRad;
      const cos = Math.cos(pelletAngle);
      const sin = Math.sin(pelletAngle);

      // Each pellet is a short line
      const pelletEndX = event.originX + cos * range;
      const pelletEndY = event.originY + sin * range;

      g.lineStyle(vfxProfile.width, vfxProfile.color, alpha * 0.8);
      g.beginPath();
      g.moveTo(event.originX, event.originY);
      g.lineTo(pelletEndX, pelletEndY);
      g.strokePath();

      // Small impact dot at end of each pellet
      g.fillStyle(vfxProfile.secondaryColor ?? 0xffaa00, alpha * 0.5);
      g.fillCircle(pelletEndX, pelletEndY, 2);
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    this.textureRenderer.destroy();
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }
}
