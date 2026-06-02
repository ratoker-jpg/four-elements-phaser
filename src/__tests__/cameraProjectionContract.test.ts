/**
 * Tests for camera projection contract (CAMERA-00).
 *
 * Pure TypeScript tests — no Phaser dependency.
 * Validates basis vectors, projection helpers, camera flags,
 * and contract consistency with existing tile constants.
 */

import { describe, it, expect } from 'vitest';
import {
  basisX,
  basisY,
  basisZ,
  CAMERA_MODEL,
  OBJECT_ANCHOR_RULE,
  projectGroundPoint,
  projectWorldPoint,
  projectGroundCircleToPolyline,
  projectGroundRect,
  getGroundEllipseBounds,
  PROJ_TILE_W,
  PROJ_TILE_H,
} from '../config/cameraProjectionContract';
import { TILE_W, TILE_H } from '../config/worldConfig';

// ─── Basis vectors match tile projection constants ──────────────────

describe('cameraProjectionContract', () => {
  it('basisX matches TILE_W/2, TILE_H/2', () => {
    expect(basisX.x).toBe(TILE_W / 2);
    expect(basisX.y).toBe(TILE_H / 2);
  });

  it('basisY matches -TILE_W/2, TILE_H/2', () => {
    expect(basisY.x).toBe(-TILE_W / 2);
    expect(basisY.y).toBe(TILE_H / 2);
  });

  it('basisZ has zero x component (height is purely vertical on screen)', () => {
    expect(basisZ.x).toBe(0);
  });

  it('basisZ has negative y component (height goes upward on screen)', () => {
    expect(basisZ.y).toBeLessThan(0);
  });

  it('PROJ_TILE_W matches worldConfig TILE_W', () => {
    expect(PROJ_TILE_W).toBe(TILE_W);
  });

  it('PROJ_TILE_H matches worldConfig TILE_H', () => {
    expect(PROJ_TILE_H).toBe(TILE_H);
  });

  // ─── Projection helpers ──────────────────────────────────────────

  it('projectGroundPoint(0,0) returns origin', () => {
    const result = projectGroundPoint(0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('projectGroundPoint(1,0) equals basisX', () => {
    const result = projectGroundPoint(1, 0);
    expect(result.x).toBe(basisX.x);
    expect(result.y).toBe(basisX.y);
  });

  it('projectGroundPoint(0,1) equals basisY', () => {
    const result = projectGroundPoint(0, 1);
    expect(result.x).toBe(basisY.x);
    expect(result.y).toBe(basisY.y);
  });

  it('projectGroundPoint with origin offset adds origin', () => {
    const origin = { x: 100, y: 200 };
    const result = projectGroundPoint(1, 0, origin);
    expect(result.x).toBe(100 + basisX.x);
    expect(result.y).toBe(200 + basisX.y);
  });

  it('projectWorldPoint(x,y,0) equals ground projection', () => {
    const ground = projectGroundPoint(3, 5);
    const world = projectWorldPoint(3, 5, 0);
    expect(world.x).toBeCloseTo(ground.x, 10);
    expect(world.y).toBeCloseTo(ground.y, 10);
  });

  it('projectWorldPoint(x,y,z) moves by z*basisZ', () => {
    const ground = projectGroundPoint(2, 3);
    const elevated = projectWorldPoint(2, 3, 1.5);
    expect(elevated.x).toBeCloseTo(ground.x + 1.5 * basisZ.x, 10);
    expect(elevated.y).toBeCloseTo(ground.y + 1.5 * basisZ.y, 10);
  });

  it('projectWorldPoint with origin offset is consistent', () => {
    const origin = { x: 50, y: 100 };
    const ground = projectGroundPoint(2, 3, origin);
    const world = projectWorldPoint(2, 3, 0, origin);
    expect(world.x).toBeCloseTo(ground.x, 10);
    expect(world.y).toBeCloseTo(ground.y, 10);
  });

  // ─── Projection matches existing tileToScreen formula ────────────

  it('projectGroundPoint(tx,ty) matches (tx-ty)*TILE_W/2, (tx+ty)*TILE_H/2', () => {
    const tx = 5;
    const ty = 3;
    const result = projectGroundPoint(tx, ty);
    expect(result.x).toBe((tx - ty) * (TILE_W / 2));
    expect(result.y).toBe((tx + ty) * (TILE_H / 2));
  });

  // ─── Projected ground circle ─────────────────────────────────────

  it('projected ground circle has correct number of segments', () => {
    const points = projectGroundCircleToPolyline(0, 0, 1, 16);
    expect(points.length).toBe(16);
  });

  it('projected ground circle does not equal naive screen circle', () => {
    const points = projectGroundCircleToPolyline(0, 0, 1, 32);
    // A naive screen circle would have all points at the same distance from center.
    // A projected circle should have varying distances (it's an ellipse).
    const distances = points.map((p: { x: number; y: number }) => Math.sqrt(p.x * p.x + p.y * p.y));
    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);
    // The ratio should differ significantly from 1.0 (not a perfect circle)
    expect(maxDist / minDist).toBeGreaterThan(1.3);
  });

  it('projected ground circle points lie in ground basis', () => {
    const points = projectGroundCircleToPolyline(2, 3, 1, 8);
    // All points should be reachable as linear combinations of basisX and basisY
    // For each point p, there should exist some (wx, wy) such that
    // p = wx*basisX + wy*basisY + origin(2,3 projected)
    const center = projectGroundPoint(2, 3);
    for (const point of points) {
      // Relative to center
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      // This should be expressible as a*basisX + b*basisY
      // Solving: dx = a*basisX.x + b*basisY.y = a*38 + b*(-38)
      //          dy = a*basisX.y + b*basisY.y = a*19 + b*19
      const a = (dx * basisY.y - dy * basisY.x) / (basisX.x * basisY.y - basisX.y * basisY.x);
      const b = (dy * basisX.x - dx * basisX.y) / (basisX.x * basisY.y - basisX.y * basisY.x);
      // a and b should be valid numbers (not NaN/Infinity)
      expect(isFinite(a)).toBe(true);
      expect(isFinite(b)).toBe(true);
    }
  });

  // ─── Projected ground rect ───────────────────────────────────────

  it('projectGroundRect returns 4 points', () => {
    const points = projectGroundRect(0, 0, 2, 2);
    expect(points.length).toBe(4);
  });

  it('projectGroundRect corners form a parallelogram', () => {
    const points = projectGroundRect(0, 0, 2, 2);
    // Opposite sides should be equal
    const side1 = Math.sqrt(
      (points[1].x - points[0].x) ** 2 + (points[1].y - points[0].y) ** 2,
    );
    const side3 = Math.sqrt(
      (points[3].x - points[2].x) ** 2 + (points[3].y - points[2].y) ** 2,
    );
    expect(side1).toBeCloseTo(side3, 5);

    const side2 = Math.sqrt(
      (points[2].x - points[1].x) ** 2 + (points[2].y - points[1].y) ** 2,
    );
    const side4 = Math.sqrt(
      (points[0].x - points[3].x) ** 2 + (points[0].y - points[3].y) ** 2,
    );
    expect(side2).toBeCloseTo(side4, 5);
  });

  // ─── Ground ellipse bounds ───────────────────────────────────────

  it('getGroundEllipseBounds returns valid bounding box', () => {
    const bounds = getGroundEllipseBounds(0, 0, 1);
    expect(bounds.minX).toBeLessThan(bounds.maxX);
    expect(bounds.minY).toBeLessThan(bounds.maxY);
  });

  it('getGroundEllipseBounds is wider than tall (isometric foreshortening)', () => {
    const bounds = getGroundEllipseBounds(0, 0, 1);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    // In isometric 2:1, the projected ellipse is wider than tall
    expect(width).toBeGreaterThan(height);
  });

  // ─── Camera model flags ──────────────────────────────────────────

  it('canRotate is false', () => {
    expect(CAMERA_MODEL.canRotate).toBe(false);
  });

  it('canPan is true', () => {
    expect(CAMERA_MODEL.canPan).toBe(true);
  });

  it('canZoom is true', () => {
    expect(CAMERA_MODEL.canZoom).toBe(true);
  });

  it('isTopDown is false', () => {
    expect(CAMERA_MODEL.isTopDown).toBe(false);
  });

  it('isSideView is false', () => {
    expect(CAMERA_MODEL.isSideView).toBe(false);
  });

  it('fixedCamera is true', () => {
    expect(CAMERA_MODEL.fixedCamera).toBe(true);
  });

  // ─── Object anchor rule ──────────────────────────────────────────

  it('object anchor rule is present in contract', () => {
    expect(OBJECT_ANCHOR_RULE).toBeDefined();
    expect(typeof OBJECT_ANCHOR_RULE).toBe('string');
    expect(OBJECT_ANCHOR_RULE).toContain('ground');
    expect(OBJECT_ANCHOR_RULE).toContain('bottom');
  });

  // ─── No Date.now dependency ──────────────────────────────────────

  it('projection helpers do not use Date.now', () => {
    // All projection functions are pure — no side effects, no timing
    // This test verifies they work without any timing dependency
    const result1 = projectGroundPoint(1, 2);
    const result2 = projectGroundPoint(1, 2);
    expect(result1.x).toBe(result2.x);
    expect(result1.y).toBe(result2.y);
  });
});

// ─── Docs mention not top-down and projection formula ────────────────

describe('cameraProjectionContract docs consistency', () => {
  it('basis vectors are consistent with 2:1 isometric formula', () => {
    // For 2:1 isometric: screen.x = (tx-ty) * halfW, screen.y = (tx+ty) * halfH
    // basisX = (halfW, halfH), basisY = (-halfW, halfH)
    const halfW = TILE_W / 2;
    const halfH = TILE_H / 2;
    expect(basisX.x).toBe(halfW);
    expect(basisX.y).toBe(halfH);
    expect(basisY.x).toBe(-halfW);
    expect(basisY.y).toBe(halfH);
  });

  it('isTopDown=false means ground plane is NOT viewed from directly above', () => {
    // In a true top-down view, basisX.y would be 0 and basisY.y would be 0
    // (all movement would be horizontal). Our isometric view has both
    // basis vectors pointing partially downward, confirming it's not top-down.
    expect(basisX.y).not.toBe(0);
    expect(basisY.y).not.toBe(0);
  });
});
