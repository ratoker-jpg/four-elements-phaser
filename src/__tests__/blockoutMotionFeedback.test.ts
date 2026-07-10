import { describe, expect, it } from 'vitest';
import { createBlockoutVehicle } from '../state/blockoutVehicleState';
import {
  MOTION_FEEDBACK_DUST_TTL_MS,
  MOTION_FEEDBACK_EMIT_DISTANCE_PX,
  MOTION_FEEDBACK_MAX_DUST,
  MOTION_FEEDBACK_MAX_TRACKS,
  MOTION_FEEDBACK_SPEED_THRESHOLD,
  MOTION_FEEDBACK_TRACK_TTL_MS,
  MOTION_FEEDBACK_TELEPORT_DISTANCE_PX,
  computeProjectedTrackSample,
} from '../state/blockoutMotionFeedback';

describe('blockout motion feedback geometry', () => {
  it('projects a finite non-zero track segment onto the isometric ground plane', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 4);
    const sample = computeProjectedTrackSample(vehicle, { x: 420, y: 120 }, -1);

    for (const value of Object.values(sample)) {
      expect(Number.isFinite(value)).toBe(true);
    }

    expect(Math.hypot(
      sample.endX - sample.startX,
      sample.endY - sample.startY,
    )).toBeGreaterThan(1);
  });

  it('alternates track samples across the two sides of the hull', () => {
    const vehicle = createBlockoutVehicle('hunter', 'railgun', 'green', 8, 3, Math.PI * 0.72);
    const left = computeProjectedTrackSample(vehicle, { x: 300, y: 90 }, -1);
    const right = computeProjectedTrackSample(vehicle, { x: 300, y: 90 }, 1);

    const leftCenter = {
      x: (left.startX + left.endX) * 0.5,
      y: (left.startY + left.endY) * 0.5,
    };
    const rightCenter = {
      x: (right.startX + right.endX) * 0.5,
      y: (right.startY + right.endY) * 0.5,
    };

    expect(Math.hypot(
      rightCenter.x - leftCenter.x,
      rightCenter.y - leftCenter.y,
    )).toBeGreaterThan(2);
  });

  it('keeps cosmetic output bounded and short lived', () => {
    expect(MOTION_FEEDBACK_SPEED_THRESHOLD).toBeGreaterThan(0);
    expect(MOTION_FEEDBACK_EMIT_DISTANCE_PX).toBeGreaterThan(0);
    expect(MOTION_FEEDBACK_TELEPORT_DISTANCE_PX).toBeGreaterThan(MOTION_FEEDBACK_EMIT_DISTANCE_PX * 5);
    expect(MOTION_FEEDBACK_TRACK_TTL_MS).toBeGreaterThan(MOTION_FEEDBACK_DUST_TTL_MS);
    expect(MOTION_FEEDBACK_MAX_TRACKS).toBeLessThanOrEqual(160);
    expect(MOTION_FEEDBACK_MAX_DUST).toBeLessThanOrEqual(64);
  });
});
