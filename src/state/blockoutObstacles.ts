/**
 * Blockout obstacle collision and line-of-fire blocking.
 *
 * BLOCKOUT-08H: Dev/arena-only blockout obstacles for combat sandbox.
 *
 * Pure TypeScript, no Phaser dependencies. All functions are testable.
 *
 * Provides:
 * - Line segment vs rectangle intersection
 * - Line segment vs circle intersection
 * - Line-of-fire blocking checks (direct, penetration, cone, beam, rapid, plasma, shotgun, ricochet)
 * - Movement collision resolution (circle vs rect, circle vs circle)
 *
 * Obstacle blocking rules:
 * - direct / rapid / plasma / beam: blocked by first blocking obstacle along line
 * - penetration: blocked by non-pierceable obstacle; pierceable obstacles are ignored
 * - cone_tick: target only if not fully behind blocking obstacle line from origin
 * - splash: if line to impact is blocked, impact point becomes obstacle intersection
 * - ricochet: segments can be blocked by obstacles (documented placeholder)
 * - shotgun: each pellet ray can be blocked by obstacle
 *
 * All state is transient and NOT persisted in saves.
 * All timing uses passed-in nowMs (Phaser scene time), NEVER Date.now().
 */

import type { BlockoutObstacleState } from './blockoutObstacleState';

// ─── Geometry helpers ──────────────────────────────────────────────

/** Result of a line-rectangle intersection test. */
export interface LineRectIntersection {
  /** Whether the line segment intersects the rectangle. */
  hit: boolean;
  /** Distance from line origin to the intersection point. Infinity if no hit. */
  dist: number;
  /** Intersection point X. NaN if no hit. */
  x: number;
  /** Intersection point Y. NaN if no hit. */
  y: number;
}

/** Result of a line-circle intersection test. */
export interface LineCircleIntersection {
  /** Whether the line segment intersects the circle. */
  hit: boolean;
  /** Distance from line origin to the nearest intersection point. Infinity if no hit. */
  dist: number;
  /** Nearest intersection point X. NaN if no hit. */
  x: number;
  /** Nearest intersection point Y. NaN if no hit. */
  y: number;
}

/**
 * Test if a line segment (x1,y1)-(x2,y2) intersects an axis-aligned rectangle.
 * Returns the intersection result with distance from (x1,y1).
 */
export function lineIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rectX: number, rectY: number,
  rectW: number, rectH: number,
): LineRectIntersection {
  // Rectangle edges
  const left = rectX - rectW / 2;
  const right = rectX + rectW / 2;
  const top = rectY - rectH / 2;
  const bottom = rectY + rectH / 2;

  // Check all 4 edges
  const edges: Array<{ ex1: number; ey1: number; ex2: number; ey2: number }> = [
    { ex1: left, ey1: top, ex2: right, ey2: top },     // top
    { ex1: right, ey1: top, ex2: right, ey2: bottom }, // right
    { ex1: left, ey1: bottom, ex2: right, ey2: bottom }, // bottom
    { ex1: left, ey1: top, ex2: left, ey2: bottom },   // left
  ];

  let bestDist = Infinity;
  let bestX = NaN;
  let bestY = NaN;
  let anyHit = false;

  const dx = x2 - x1;
  const dy = y2 - y1;

  for (const edge of edges) {
    const edx = edge.ex2 - edge.ex1;
    const edy = edge.ey2 - edge.ey1;

    const denom = dx * edy - dy * edx;
    if (Math.abs(denom) < 1e-10) continue; // parallel

    const t = ((edge.ex1 - x1) * edy - (edge.ey1 - y1) * edx) / denom;
    const u = ((edge.ex1 - x1) * dy - (edge.ey1 - y1) * dx) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      anyHit = true;
      const hitX = x1 + t * dx;
      const hitY = y1 + t * dy;
      const dist = Math.sqrt((hitX - x1) ** 2 + (hitY - y1) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestX = hitX;
        bestY = hitY;
      }
    }
  }

  return { hit: anyHit, dist: bestDist, x: bestX, y: bestY };
}

/**
 * Test if a line segment (x1,y1)-(x2,y2) intersects a circle.
 * Returns the nearest intersection result with distance from (x1,y1).
 */
export function lineIntersectsCircle(
  x1: number, y1: number,
  x2: number, y2: number,
  cx: number, cy: number,
  r: number,
): LineCircleIntersection {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return { hit: false, dist: Infinity, x: NaN, y: NaN };
  }

  discriminant = Math.sqrt(discriminant);

  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  // Find the nearest valid intersection (t in [0, 1])
  let t = -1;
  if (t1 >= 0 && t1 <= 1) {
    t = t1;
  } else if (t2 >= 0 && t2 <= 1) {
    t = t2;
  }

  // Also check if the line starts inside the circle (t1 < 0)
  if (t1 < 0 && t2 >= 0 && t2 <= 1) {
    t = t2;
  }

  if (t < 0) {
    return { hit: false, dist: Infinity, x: NaN, y: NaN };
  }

  const hitX = x1 + t * dx;
  const hitY = y1 + t * dy;
  const dist = Math.sqrt((hitX - x1) ** 2 + (hitY - y1) ** 2);

  return { hit: true, dist, x: hitX, y: hitY };
}

// ─── Obstacle intersection helpers ──────────────────────────────────

/**
 * Find the nearest obstacle that blocks a line segment from (x1,y1) to (x2,y2).
 * Returns null if no blocking obstacle is found.
 *
 * @param obstacles - List of obstacles to check
 * @param x1 - Line origin X
 * @param y1 - Line origin Y
 * @param x2 - Line end X
 * @param y2 - Line end Y
 * @param requireBlocksLineOfFire - If true, only check obstacles with blocksLineOfFire
 * @param allowPierceable - If true, pierceable obstacles are ignored (for penetration)
 * @returns The nearest blocking obstacle, its intersection point, and distance
 */
export function findNearestObstacleBlockingLine(
  obstacles: BlockoutObstacleState[],
  x1: number, y1: number,
  x2: number, y2: number,
  requireBlocksLineOfFire: boolean = true,
  allowPierceable: boolean = false,
): { obstacle: BlockoutObstacleState; dist: number; x: number; y: number } | null {
  let best: { obstacle: BlockoutObstacleState; dist: number; x: number; y: number } | null = null;

  for (const obstacle of obstacles) {
    if (requireBlocksLineOfFire && !obstacle.blocksLineOfFire) continue;
    if (allowPierceable && obstacle.pierceable) continue;

    let result: { hit: boolean; dist: number; x: number; y: number };

    if (obstacle.shape.kind === 'rect') {
      result = lineIntersectsRect(
        x1, y1, x2, y2,
        obstacle.worldX, obstacle.worldY,
        obstacle.shape.width, obstacle.shape.height,
      );
    } else {
      result = lineIntersectsCircle(
        x1, y1, x2, y2,
        obstacle.worldX, obstacle.worldY,
        obstacle.shape.radius,
      );
    }

    if (result.hit && result.dist < (best?.dist ?? Infinity)) {
      best = { obstacle, dist: result.dist, x: result.x, y: result.y };
    }
  }

  return best;
}

/**
 * Check if a direct line from origin to target is blocked by any obstacle.
 * BLOCKOUT-08H: Used for direct/rapid/plasma/beam damage kinds.
 *
 * @returns true if the line is blocked
 */
export function isLineOfFireBlocked(
  obstacles: BlockoutObstacleState[],
  originX: number, originY: number,
  targetX: number, targetY: number,
  allowPierceable: boolean = false,
): boolean {
  const blocker = findNearestObstacleBlockingLine(
    obstacles,
    originX, originY,
    targetX, targetY,
    true, // require blocksLineOfFire
    allowPierceable,
  );
  return blocker !== null;
}

/**
 * Check if a point is inside an obstacle.
 * Used for cone/beam target position blocking.
 */
export function isPointInsideObstacle(
  obstacle: BlockoutObstacleState,
  px: number, py: number,
): boolean {
  if (obstacle.shape.kind === 'rect') {
    const left = obstacle.worldX - obstacle.shape.width / 2;
    const right = obstacle.worldX + obstacle.shape.width / 2;
    const top = obstacle.worldY - obstacle.shape.height / 2;
    const bottom = obstacle.worldY + obstacle.shape.height / 2;
    return px >= left && px <= right && py >= top && py <= bottom;
  } else {
    const dx = px - obstacle.worldX;
    const dy = py - obstacle.worldY;
    return dx * dx + dy * dy <= obstacle.shape.radius * obstacle.shape.radius;
  }
}

// ─── Movement collision ─────────────────────────────────────────────

/**
 * Check if a circle (vehicle) collides with an obstacle.
 * Returns the collision result with penetration vector for resolution.
 */
export function checkVehicleObstacleCollision(
  vehicleWorldX: number, vehicleWorldY: number,
  vehicleRadius: number,
  obstacle: BlockoutObstacleState,
): { collides: boolean; pushX: number; pushY: number } {
  if (!obstacle.blocksMovement) {
    return { collides: false, pushX: 0, pushY: 0 };
  }

  if (obstacle.shape.kind === 'rect') {
    return checkCircleRectCollision(
      vehicleWorldX, vehicleWorldY, vehicleRadius,
      obstacle.worldX, obstacle.worldY,
      obstacle.shape.width, obstacle.shape.height,
    );
  } else {
    return checkCircleCircleCollision(
      vehicleWorldX, vehicleWorldY, vehicleRadius,
      obstacle.worldX, obstacle.worldY,
      obstacle.shape.radius,
    );
  }
}

/**
 * Check circle vs axis-aligned rectangle collision.
 * Returns push vector to resolve the collision.
 */
export function checkCircleRectCollision(
  circleX: number, circleY: number, circleR: number,
  rectX: number, rectY: number,
  rectW: number, rectH: number,
): { collides: boolean; pushX: number; pushY: number } {
  // Find the closest point on the rectangle to the circle center
  const left = rectX - rectW / 2;
  const right = rectX + rectW / 2;
  const top = rectY - rectH / 2;
  const bottom = rectY + rectH / 2;

  const closestX = Math.max(left, Math.min(circleX, right));
  const closestY = Math.max(top, Math.min(circleY, bottom));

  const dx = circleX - closestX;
  const dy = circleY - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= circleR * circleR) {
    return { collides: false, pushX: 0, pushY: 0 };
  }

  const dist = Math.sqrt(distSq);
  if (dist < 0.001) {
    // Circle center is inside rectangle — push out toward nearest edge
    const distToLeft = circleX - left;
    const distToRight = right - circleX;
    const distToTop = circleY - top;
    const distToBottom = bottom - circleY;
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) {
      return { collides: true, pushX: -(distToLeft + circleR), pushY: 0 };
    } else if (minDist === distToRight) {
      return { collides: true, pushX: distToRight + circleR, pushY: 0 };
    } else if (minDist === distToTop) {
      return { collides: true, pushX: 0, pushY: -(distToTop + circleR) };
    } else {
      return { collides: true, pushX: 0, pushY: distToBottom + circleR };
    }
  }

  // Normal push direction: from closest point toward circle center
  const pushDist = circleR - dist;
  const pushX = (dx / dist) * pushDist;
  const pushY = (dy / dist) * pushDist;

  return { collides: true, pushX, pushY };
}

/**
 * Check circle vs circle collision.
 * Returns push vector to resolve the collision.
 */
export function checkCircleCircleCollision(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number,
): { collides: boolean; pushX: number; pushY: number } {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distSq = dx * dx + dy * dy;
  const minDist = r1 + r2;

  if (distSq >= minDist * minDist) {
    return { collides: false, pushX: 0, pushY: 0 };
  }

  const dist = Math.sqrt(distSq);
  if (dist < 0.001) {
    // Overlapping centers — push in arbitrary direction
    return { collides: true, pushX: minDist, pushY: 0 };
  }

  const pushDist = minDist - dist;
  const pushX = (dx / dist) * pushDist;
  const pushY = (dy / dist) * pushDist;

  return { collides: true, pushX, pushY };
}

/**
 * Resolve vehicle movement collisions with obstacles.
 * Mutates the vehicle position and velocity to avoid overlap.
 *
 * @param vehicleWorldX - Vehicle world X (mutated)
 * @param vehicleWorldY - Vehicle world Y (mutated)
 * @param vehicleRadius - Vehicle collision radius
 * @param vehicleVx - Vehicle velocity X (mutated on collision)
 * @param vehicleVy - Vehicle velocity Y (mutated on collision)
 * @param obstacles - List of obstacles to check
 * @returns Updated position { worldX, worldY } after collision resolution
 */
export function resolveVehicleObstacleCollisions(
  vehicleWorldX: number,
  vehicleWorldY: number,
  vehicleRadius: number,
  vehicleVx: number,
  vehicleVy: number,
  obstacles: BlockoutObstacleState[],
): { worldX: number; worldY: number; vx: number; vy: number; collided: boolean } {
  let wx = vehicleWorldX;
  let wy = vehicleWorldY;
  let vx = vehicleVx;
  let vy = vehicleVy;
  let collided = false;

  for (const obstacle of obstacles) {
    const result = checkVehicleObstacleCollision(wx, wy, vehicleRadius, obstacle);
    if (result.collides) {
      wx += result.pushX;
      wy += result.pushY;
      // Kill velocity component in push direction
      const pushDist = Math.sqrt(result.pushX * result.pushX + result.pushY * result.pushY);
      if (pushDist > 0.001) {
        const pushNx = result.pushX / pushDist;
        const pushNy = result.pushY / pushDist;
        const dot = vx * pushNx + vy * pushNy;
        if (dot < 0) {
          // Remove velocity component toward obstacle
          vx -= dot * pushNx;
          vy -= dot * pushNy;
        }
      }
      collided = true;
    }
  }

  return { worldX: wx, worldY: wy, vx, vy, collided };
}
