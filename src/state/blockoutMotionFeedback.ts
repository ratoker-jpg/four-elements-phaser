import type { BlockoutVehicleState } from './blockoutVehicleState';
import {
  PROJ_TILE_W,
  projectWorldPoint,
  unprojectScreenToGround,
} from '../config/cameraProjectionContract';

export const MOTION_FEEDBACK_SPEED_THRESHOLD = 24;
export const MOTION_FEEDBACK_EMIT_DISTANCE_PX = 12;
export const MOTION_FEEDBACK_TELEPORT_DISTANCE_PX = 180;
export const MOTION_FEEDBACK_TRACK_TTL_MS = 1_500;
export const MOTION_FEEDBACK_DUST_TTL_MS = 620;
export const MOTION_FEEDBACK_MAX_TRACKS = 120;
export const MOTION_FEEDBACK_MAX_DUST = 48;

export interface MotionFeedbackOffset {
  x: number;
  y: number;
}

export interface ProjectedTrackSample {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  dustX: number;
  dustY: number;
}

/**
 * Convert a vehicle body angle and screen position into one projected ground
 * track segment. The left/right offset is calculated in ground coordinates,
 * then both segment endpoints are projected through the camera contract.
 */
export function computeProjectedTrackSample(
  vehicle: Pick<BlockoutVehicleState, 'worldX' | 'worldY' | 'bodyAngle'>,
  offset: MotionFeedbackOffset,
  side: -1 | 1,
): ProjectedTrackSample {
  const centerX = vehicle.worldX + offset.x;
  const centerY = vehicle.worldY + offset.y;
  const centerGround = unprojectScreenToGround(centerX, centerY, offset);

  const sampleDistance = Math.max(1, PROJ_TILE_W);
  const aheadGround = unprojectScreenToGround(
    centerX + Math.cos(vehicle.bodyAngle) * sampleDistance,
    centerY + Math.sin(vehicle.bodyAngle) * sampleDistance,
    offset,
  );

  let forwardX = aheadGround.x - centerGround.x;
  let forwardY = aheadGround.y - centerGround.y;
  const forwardLength = Math.hypot(forwardX, forwardY);
  if (forwardLength <= 0.0001) {
    forwardX = 1;
    forwardY = 0;
  } else {
    forwardX /= forwardLength;
    forwardY /= forwardLength;
  }

  const sideX = -forwardY;
  const sideY = forwardX;
  const rearOffset = 0.24;
  const trackHalfSpacing = 0.16;
  const trackHalfLength = 0.13;

  const footX = centerGround.x - forwardX * rearOffset + sideX * trackHalfSpacing * side;
  const footY = centerGround.y - forwardY * rearOffset + sideY * trackHalfSpacing * side;

  const start = projectWorldPoint(
    footX - forwardX * trackHalfLength,
    footY - forwardY * trackHalfLength,
    0,
    offset,
  );
  const end = projectWorldPoint(
    footX + forwardX * trackHalfLength,
    footY + forwardY * trackHalfLength,
    0,
    offset,
  );
  const dust = projectWorldPoint(footX, footY, 0.03, offset);

  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    dustX: dust.x,
    dustY: dust.y,
  };
}
