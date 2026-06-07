/**
 * Projected ground-plane drawing primitives for Phaser Graphics.
 *
 * PROJECTION-01: Shared helpers that draw projected ground-plane shapes
 * using the camera projection contract. All rings, circles, diamonds,
 * and shadows must go through these helpers so they are visually
 * consistent with the isometric projection.
 *
 * Uses cameraProjectionContract for the math and Phaser Graphics for
 * the drawing. No PNG assets, no asset manifest, no final art.
 */

import type { IsoPoint } from './isometric';
import {
  projectGroundPoint,
  projectGroundCircleToPolyline,
  projectWorldPoint,
  unprojectScreenToGround,
} from '../../config/cameraProjectionContract';

// ─── Projected ground circle (ring / filled) ────────────────────────

/**
 * Draw a projected ground-plane circle as a closed polyline (ring).
 *
 * This is the correct way to draw selection rings, hover markers,
 * range indicators, and any ground-plane circle. A naive screen-space
 * circle (g.strokeCircle) is wrong because the ground plane is tilted
 * in the isometric view.
 *
 * @param g - Phaser Graphics object
 * @param screenX - Screen-space X of the center (e.g., vehicle.worldX + offset.x)
 * @param screenY - Screen-space Y of the center
 * @param worldRadius - Circle radius in world/tile units
 * @param origin - Map offset { x, y }
 * @param segments - Number of polyline segments (default 24)
 */
export function drawProjectedGroundRing(
  g: Phaser.GameObjects.Graphics,
  screenX: number,
  screenY: number,
  worldRadius: number,
  origin: IsoPoint,
  segments: number = 24,
): void {
  const tilePos = unprojectScreenToGround(screenX, screenY, origin);
  const points = projectGroundCircleToPolyline(tilePos.x, tilePos.y, worldRadius, segments, origin);

  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.closePath();
  g.strokePath();
}

/**
 * Draw a filled projected ground-plane circle.
 *
 * Same as drawProjectedGroundRing but fills the shape instead of
 * just stroking it. Useful for shadows, range fills, etc.
 *
 * @param g - Phaser Graphics object
 * @param screenX - Screen-space X of the center
 * @param screenY - Screen-space Y of the center
 * @param worldRadius - Circle radius in world/tile units
 * @param origin - Map offset { x, y }
 * @param segments - Number of polyline segments (default 24)
 */
export function drawProjectedGroundFill(
  g: Phaser.GameObjects.Graphics,
  screenX: number,
  screenY: number,
  worldRadius: number,
  origin: IsoPoint,
  segments: number = 24,
): void {
  const tilePos = unprojectScreenToGround(screenX, screenY, origin);
  const points = projectGroundCircleToPolyline(tilePos.x, tilePos.y, worldRadius, segments, origin);

  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.closePath();
  g.fillPath();
}

// ─── Projected ground diamond ───────────────────────────────────────

/**
 * Draw a projected ground-plane diamond (rotated square) at a screen position.
 *
 * Used for move-target markers, anchor points, and ground-plane markers
 * that need a distinct visual shape different from the projected circle.
 *
 * The diamond is half a tile unit in each direction from the center.
 *
 * @param g - Phaser Graphics object
 * @param screenX - Screen-space X of the center
 * @param screenY - Screen-space Y of the center
 * @param halfSize - Half-size of the diamond in world/tile units
 * @param origin - Map offset { x, y }
 */
export function drawProjectedGroundDiamond(
  g: Phaser.GameObjects.Graphics,
  screenX: number,
  screenY: number,
  halfSize: number,
  origin: IsoPoint,
): void {
  const tilePos = unprojectScreenToGround(screenX, screenY, origin);
  const points = [
    projectGroundPoint(tilePos.x, tilePos.y - halfSize, origin), // top
    projectGroundPoint(tilePos.x + halfSize, tilePos.y, origin), // right
    projectGroundPoint(tilePos.x, tilePos.y + halfSize, origin), // bottom
    projectGroundPoint(tilePos.x - halfSize, tilePos.y, origin), // left
  ];

  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.closePath();
  g.strokePath();
}

// ─── Projected vehicle shadow ────────────────────────────────────────

/**
 * Draw a projected ground-plane shadow ellipse under a vehicle.
 *
 * The shadow is a slightly larger, semi-transparent projected ground
 * circle offset slightly south (in +Y world direction) from the vehicle
 * center, giving the impression that the object is above the ground plane.
 *
 * @param g - Phaser Graphics object
 * @param screenX - Screen-space X of the vehicle center
 * @param screenY - Screen-space Y of the vehicle center
 * @param worldRadius - Shadow radius in world/tile units
 * @param origin - Map offset { x, y }
 * @param color - Shadow fill color (default 0x000000)
 * @param alpha - Shadow alpha (default 0.15)
 */
export function drawProjectedShadow(
  g: Phaser.GameObjects.Graphics,
  screenX: number,
  screenY: number,
  worldRadius: number,
  origin: IsoPoint,
  color: number = 0x000000,
  alpha: number = 0.15,
): void {
  // Offset shadow slightly south (+Y world) so it appears under the object
  const tilePos = unprojectScreenToGround(screenX, screenY, origin);
  const shadowOffset = 0.15; // tile units south

  const points = projectGroundCircleToPolyline(
    tilePos.x, tilePos.y + shadowOffset,
    worldRadius, 20, origin,
  );

  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.closePath();
  g.fillPath();
}

// ─── Pseudo-isometric box ────────────────────────────────────────────

/**
 * Draw a pseudo-isometric box (base + side face + top face).
 *
 * This creates the visual impression of a 3D object sitting on the
 * ground plane without being a full 3D model. The box is defined by:
 * - A ground footprint (projected parallelogram)
 * - A top face (same shape offset by height * basisZ)
 * - Visible side/depth edges connecting base to top
 *
 * The box is drawn at a screen-space center position with a given
 * world-space half-width, half-height (in tile units), and height.
 *
 * @param g - Phaser Graphics object
 * @param screenX - Screen-space X of the box ground center
 * @param screenY - Screen-space Y of the box ground center
 * @param halfW - Half-width in world/tile units (ground plane)
 * @param halfH - Half-height in world/tile units (ground plane)
 * @param height - Height in world Z units
 * @param origin - Map offset { x, y }
 * @param bodyAngle - Body rotation angle in radians
 * @param baseColor - Fill color for the base footprint
 * @param sideColor - Fill color for the side/depth face
 * @param topColor - Fill color for the top face
 * @param outlineColor - Outline stroke color
 * @param baseAlpha - Alpha for the base face
 * @param sideAlpha - Alpha for the side face
 * @param topAlpha - Alpha for the top face
 */
export function drawProjectedBox(
  g: Phaser.GameObjects.Graphics,
  screenX: number,
  screenY: number,
  halfW: number,
  halfH: number,
  height: number,
  origin: IsoPoint,
  bodyAngle: number,
  baseColor: number,
  sideColor: number,
  topColor: number,
  outlineColor: number,
  baseAlpha: number = 0.4,
  sideAlpha: number = 0.7,
  topAlpha: number = 1.0,
): void {
  const tilePos = unprojectScreenToGround(screenX, screenY, origin);

  // Local-space corners of the rectangle centered at (0,0)
  const localCorners = [
    { lx: -halfW, ly: -halfH }, // rear-left
    { lx: halfW, ly: -halfH },  // rear-right
    { lx: halfW, ly: halfH },   // front-right
    { lx: -halfW, ly: halfH },  // front-left
  ];

  // Rotate corners by bodyAngle
  const cosA = Math.cos(bodyAngle);
  const sinA = Math.sin(bodyAngle);
  const rotatedCorners = localCorners.map(c => ({
    x: tilePos.x + c.lx * cosA - c.ly * sinA,
    y: tilePos.y + c.lx * sinA + c.ly * cosA,
  }));

  // Project base corners to screen (z=0)
  const basePts = rotatedCorners.map(c => projectGroundPoint(c.x, c.y, origin));

  // Project top corners (z=height)
  const topPts = rotatedCorners.map(c => projectWorldPoint(c.x, c.y, height, origin));

  // ── Draw base footprint (subtle, on ground plane) ──
  g.fillStyle(baseColor, baseAlpha);
  g.beginPath();
  g.moveTo(basePts[0].x, basePts[0].y);
  for (let i = 1; i < basePts.length; i++) {
    g.lineTo(basePts[i].x, basePts[i].y);
  }
  g.closePath();
  g.fillPath();

  // ── Determine visible side faces ──
  // In isometric view, the sides facing the camera (south and east
  // in world space) are visible. We draw the two edges whose top
  // vertices are below (larger screen Y) than their bottom counterparts,
  // meaning they face the viewer.
  // Simplified: draw left side (edge 3→0) and right side (edge 1→2)
  // as the typical visible sides in a 2:1 isometric view.

  // Left side face (base[3]→base[0] → top[3]→top[0])
  drawQuadFace(g, basePts[3], basePts[0], topPts[0], topPts[3], sideColor, sideAlpha, outlineColor);

  // Right side face (base[0]→base[1] → top[0]→top[1])
  drawQuadFace(g, basePts[0], basePts[1], topPts[1], topPts[0], sideColor, sideAlpha, outlineColor);

  // ── Draw top face ──
  g.fillStyle(topColor, topAlpha);
  g.beginPath();
  g.moveTo(topPts[0].x, topPts[0].y);
  for (let i = 1; i < topPts.length; i++) {
    g.lineTo(topPts[i].x, topPts[i].y);
  }
  g.closePath();
  g.fillPath();

  // Top outline
  g.lineStyle(1, outlineColor, 0.8);
  g.beginPath();
  g.moveTo(topPts[0].x, topPts[0].y);
  for (let i = 1; i < topPts.length; i++) {
    g.lineTo(topPts[i].x, topPts[i].y);
  }
  g.closePath();
  g.strokePath();
}

/**
 * Draw a quadrilateral face (used for box sides).
 */
function drawQuadFace(
  g: Phaser.GameObjects.Graphics,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  fillColor: number,
  fillAlpha: number,
  outlineColor: number,
): void {
  // Fill
  g.fillStyle(fillColor, fillAlpha);
  g.beginPath();
  g.moveTo(p0.x, p0.y);
  g.lineTo(p1.x, p1.y);
  g.lineTo(p2.x, p2.y);
  g.lineTo(p3.x, p3.y);
  g.closePath();
  g.fillPath();

  // Outline
  g.lineStyle(1, outlineColor, 0.5);
  g.beginPath();
  g.moveTo(p0.x, p0.y);
  g.lineTo(p1.x, p1.y);
  g.lineTo(p2.x, p2.y);
  g.lineTo(p3.x, p3.y);
  g.closePath();
  g.strokePath();
}

// ─── Projected crosshair on ground ───────────────────────────────────

/**
 * Draw a projected crosshair on the ground plane.
 *
 * Uses two short projected lines along the basisX and basisY directions
 * centered on the given screen position. This gives a ground-plane
 * aligned crosshair instead of a screen-space aligned one.
 *
 * @param g - Phaser Graphics object
 * @param screenX - Screen-space X of the center
 * @param screenY - Screen-space Y of the center
 * @param armLength - Crosshair arm length in world/tile units
 * @param origin - Map offset { x, y }
 */
export function drawProjectedCrosshair(
  g: Phaser.GameObjects.Graphics,
  screenX: number,
  screenY: number,
  armLength: number,
  origin: IsoPoint,
): void {
  const tilePos = unprojectScreenToGround(screenX, screenY, origin);

  // Line along +X direction
  const xStart = projectGroundPoint(tilePos.x - armLength, tilePos.y, origin);
  const xEnd = projectGroundPoint(tilePos.x + armLength, tilePos.y, origin);
  g.beginPath();
  g.moveTo(xStart.x, xStart.y);
  g.lineTo(xEnd.x, xEnd.y);
  g.strokePath();

  // Line along +Y direction
  const yStart = projectGroundPoint(tilePos.x, tilePos.y - armLength, origin);
  const yEnd = projectGroundPoint(tilePos.x, tilePos.y + armLength, origin);
  g.beginPath();
  g.moveTo(yStart.x, yStart.y);
  g.lineTo(yEnd.x, yEnd.y);
  g.strokePath();
}
