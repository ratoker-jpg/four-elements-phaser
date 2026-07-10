import Phaser from 'phaser';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import {
  MOTION_FEEDBACK_DUST_TTL_MS,
  MOTION_FEEDBACK_EMIT_DISTANCE_PX,
  MOTION_FEEDBACK_MAX_DUST,
  MOTION_FEEDBACK_MAX_TRACKS,
  MOTION_FEEDBACK_SPEED_THRESHOLD,
  MOTION_FEEDBACK_TRACK_TTL_MS,
  MOTION_FEEDBACK_TELEPORT_DISTANCE_PX,
  computeProjectedTrackSample,
  type ProjectedTrackSample,
} from '../../state/blockoutMotionFeedback';
import type { IsoPoint } from './isometric';

interface VehicleTrailHistory {
  lastEmitX: number;
  lastEmitY: number;
  nextSide: -1 | 1;
  emitCount: number;
}

interface TrackMark extends ProjectedTrackSample {
  createdAt: number;
  strength: number;
}

interface DustPuff {
  x: number;
  y: number;
  createdAt: number;
  radius: number;
  driftX: number;
}

/**
 * Renderer-local movement feedback. Tracks and dust are cosmetic, transient,
 * bounded and deliberately excluded from GameState/save data.
 */
export class BlockoutMotionFeedbackRenderer {
  private readonly scene: Phaser.Scene;
  private readonly offset: IsoPoint;
  private readonly trackDepth: number;
  private readonly dustDepth: number;
  private readonly histories = new Map<string, VehicleTrailHistory>();
  private readonly tracks: TrackMark[] = [];
  private readonly dust: DustPuff[] = [];
  private trackGraphics: Phaser.GameObjects.Graphics | null = null;
  private dustGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, offset: IsoPoint, vehicleDepth: number) {
    this.scene = scene;
    this.offset = offset;
    this.trackDepth = vehicleDepth - 2;
    this.dustDepth = vehicleDepth - 0.75;
  }

  syncFromState(vehicles: readonly BlockoutVehicleState[], nowMs: number): void {
    this.ensureGraphics();
    this.expire(nowMs);

    const activeIds = new Set<string>();
    for (const vehicle of vehicles) {
      activeIds.add(vehicle.id);
      this.updateVehicle(vehicle, nowMs);
    }

    for (const id of this.histories.keys()) {
      if (!activeIds.has(id)) this.histories.delete(id);
    }

    this.draw(nowMs);
  }

  destroy(): void {
    this.trackGraphics?.destroy();
    this.dustGraphics?.destroy();
    this.trackGraphics = null;
    this.dustGraphics = null;
    this.histories.clear();
    this.tracks.length = 0;
    this.dust.length = 0;
  }

  getStats(): { histories: number; tracks: number; dust: number } {
    return {
      histories: this.histories.size,
      tracks: this.tracks.length,
      dust: this.dust.length,
    };
  }

  private ensureGraphics(): void {
    if (!this.trackGraphics) {
      this.trackGraphics = this.scene.add.graphics();
      this.trackGraphics.setDepth(this.trackDepth);
    }
    if (!this.dustGraphics) {
      this.dustGraphics = this.scene.add.graphics();
      this.dustGraphics.setDepth(this.dustDepth);
    }
  }

  private updateVehicle(vehicle: BlockoutVehicleState, nowMs: number): void {
    const currentX = vehicle.worldX;
    const currentY = vehicle.worldY;
    let history = this.histories.get(vehicle.id);

    if (!history) {
      history = {
        lastEmitX: currentX,
        lastEmitY: currentY,
        nextSide: -1,
        emitCount: 0,
      };
      this.histories.set(vehicle.id, history);
      return;
    }

    const distance = Math.hypot(
      currentX - history.lastEmitX,
      currentY - history.lastEmitY,
    );

    if (
      vehicle.isDestroyed
      || vehicle.speed < MOTION_FEEDBACK_SPEED_THRESHOLD
      || distance > MOTION_FEEDBACK_TELEPORT_DISTANCE_PX
    ) {
      history.lastEmitX = currentX;
      history.lastEmitY = currentY;
      return;
    }

    if (distance < MOTION_FEEDBACK_EMIT_DISTANCE_PX) return;

    const sample = computeProjectedTrackSample(vehicle, this.offset, history.nextSide);
    const speedFactor = Phaser.Math.Clamp(
      (vehicle.speed - MOTION_FEEDBACK_SPEED_THRESHOLD) / 80,
      0,
      1,
    );

    this.tracks.push({
      ...sample,
      createdAt: nowMs,
      strength: 0.65 + speedFactor * 0.35,
    });
    if (this.tracks.length > MOTION_FEEDBACK_MAX_TRACKS) {
      this.tracks.splice(0, this.tracks.length - MOTION_FEEDBACK_MAX_TRACKS);
    }

    history.emitCount += 1;
    if (history.emitCount % 2 === 0 || speedFactor > 0.58) {
      this.dust.push({
        x: sample.dustX,
        y: sample.dustY,
        createdAt: nowMs,
        radius: 3.5 + speedFactor * 4.5,
        driftX: history.nextSide * (1.5 + speedFactor * 2.5),
      });
      if (this.dust.length > MOTION_FEEDBACK_MAX_DUST) {
        this.dust.splice(0, this.dust.length - MOTION_FEEDBACK_MAX_DUST);
      }
    }

    history.lastEmitX = currentX;
    history.lastEmitY = currentY;
    history.nextSide = history.nextSide === -1 ? 1 : -1;
  }

  private expire(nowMs: number): void {
    while (
      this.tracks.length > 0
      && nowMs - this.tracks[0].createdAt >= MOTION_FEEDBACK_TRACK_TTL_MS
    ) {
      this.tracks.shift();
    }
    while (
      this.dust.length > 0
      && nowMs - this.dust[0].createdAt >= MOTION_FEEDBACK_DUST_TTL_MS
    ) {
      this.dust.shift();
    }
  }

  private draw(nowMs: number): void {
    const trackGraphics = this.trackGraphics;
    const dustGraphics = this.dustGraphics;
    if (!trackGraphics || !dustGraphics) return;

    trackGraphics.clear();
    for (const track of this.tracks) {
      const progress = Phaser.Math.Clamp(
        (nowMs - track.createdAt) / MOTION_FEEDBACK_TRACK_TTL_MS,
        0,
        1,
      );
      const alpha = (1 - progress) * 0.32 * track.strength;
      trackGraphics.lineStyle(3, 0x1d1914, alpha);
      trackGraphics.beginPath();
      trackGraphics.moveTo(track.startX, track.startY);
      trackGraphics.lineTo(track.endX, track.endY);
      trackGraphics.strokePath();
    }

    dustGraphics.clear();
    for (const puff of this.dust) {
      const progress = Phaser.Math.Clamp(
        (nowMs - puff.createdAt) / MOTION_FEEDBACK_DUST_TTL_MS,
        0,
        1,
      );
      const fade = 1 - progress;
      const radius = puff.radius * (0.7 + progress * 0.95);
      const x = puff.x + puff.driftX * progress;
      const y = puff.y - 10 * progress;

      dustGraphics.fillStyle(0x8d8068, fade * 0.22);
      dustGraphics.fillCircle(x, y, radius);
      dustGraphics.fillStyle(0xb1a58d, fade * 0.12);
      dustGraphics.fillCircle(x - radius * 0.28, y - radius * 0.18, radius * 0.62);
    }
  }
}
