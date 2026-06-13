/**
 * TURRET-HULL-CONTRACT-PR-F2: Tests for the pure turret/hull anchor diagnostic.
 *
 * These tests pin the diagnostic math only — they do NOT encode any guessed
 * offset. The key property under test: when the turret sprite is placed using
 * the renderer's own attachment formula, the diagnostic must report the hull
 * socket and turret pivot world points as coincident (distance ~ 0). Any
 * non-zero distance there would mean the diagnostic and the renderer disagree.
 */

import { describe, it, expect } from 'vitest';
import { computeAnchorDiagnostic } from '../phaser/debug/turretAnchorDiagnostic';
import { computeTurretSpriteCenterOffsetForSocket } from '../config/turretAttachmentMath';

describe('computeAnchorDiagnostic', () => {
  it('reports zero distance for trivially aligned, centered sprites at the same position', () => {
    const r = computeAnchorDiagnostic({
      hullSpriteX: 100,
      hullSpriteY: 200,
      hullOriginX: 0.5,
      hullOriginY: 0.5,
      hullDisplayWidthPx: 64,
      hullDisplayHeightPx: 64,
      socketNorm: { x: 0.5, y: 0.5 },
      turretSpriteX: 100,
      turretSpriteY: 200,
      turretOriginX: 0.5,
      turretOriginY: 0.5,
      turretDisplayWidthPx: 64,
      turretDisplayHeightPx: 64,
      pivotNorm: { x: 0.5, y: 0.5 },
    });
    expect(r.distance).toBeCloseTo(0, 6);
    expect(r.hullSocketWorld).toEqual({ x: 100, y: 200 });
    expect(r.turretPivotWorld).toEqual({ x: 100, y: 200 });
  });

  it('computes signed delta from sprite/profile geometry independently', () => {
    // Hull socket sits left-of and above the hull origin; turret pivot is the
    // turret origin (centered) at a known offset position.
    const r = computeAnchorDiagnostic({
      hullSpriteX: 0,
      hullSpriteY: 0,
      hullOriginX: 0.5,
      hullOriginY: 0.75,
      hullDisplayWidthPx: 100,
      hullDisplayHeightPx: 100,
      socketNorm: { x: 0.4, y: 0.5 }, // (0.4-0.5)*100=-10, (0.5-0.75)*100=-25
      turretSpriteX: 5,
      turretSpriteY: 5,
      turretOriginX: 0.5,
      turretOriginY: 0.5,
      turretDisplayWidthPx: 100,
      turretDisplayHeightPx: 100,
      pivotNorm: { x: 0.5, y: 0.5 }, // pivot == turret origin → at (5,5)
    });
    expect(r.hullSocketWorld.x).toBeCloseTo(-10, 9);
    expect(r.hullSocketWorld.y).toBeCloseTo(-25, 9);
    expect(r.turretPivotWorld).toEqual({ x: 5, y: 5 });
    expect(r.deltaX).toBeCloseTo(15, 9);
    expect(r.deltaY).toBeCloseTo(30, 9);
    expect(r.distance).toBeCloseTo(Math.sqrt(15 * 15 + 30 * 30), 9);
  });

  it('agrees with the renderer attachment formula: distance ~ 0 when offset is applied', () => {
    // Realistic generated Wasp+Smoky-ish geometry.
    const hullDisplay = 512 * 0.12;
    const turretDisplay = 512 * 0.12;
    const hullOriginX = 0.5;
    const hullOriginY = 0.75;
    const turretOriginX = 0.5;
    const turretOriginY = 0.5;
    const socketNorm = { x: 0.401, y: 0.497 };
    const pivotNorm = { x: 0.499, y: 0.5145 };

    const hullSpriteX = 640;
    const hullSpriteY = 360;

    // Renderer places the turret at hull position + this offset.
    const { offset } = computeTurretSpriteCenterOffsetForSocket({
      socketNorm,
      hullDisplayWidthPx: hullDisplay,
      hullDisplayHeightPx: hullDisplay,
      pivotNorm,
      turretDisplayWidthPx: turretDisplay,
      turretDisplayHeightPx: turretDisplay,
      hullOriginX,
      hullOriginY,
      turretOriginX,
      turretOriginY,
    });
    expect(offset).not.toBeNull();

    const r = computeAnchorDiagnostic({
      hullSpriteX,
      hullSpriteY,
      hullOriginX,
      hullOriginY,
      hullDisplayWidthPx: hullDisplay,
      hullDisplayHeightPx: hullDisplay,
      socketNorm,
      turretSpriteX: hullSpriteX + offset!.x,
      turretSpriteY: hullSpriteY + offset!.y,
      turretOriginX,
      turretOriginY,
      turretDisplayWidthPx: turretDisplay,
      turretDisplayHeightPx: turretDisplay,
      pivotNorm,
    });

    // The diagnostic must confirm the renderer's own math: anchors coincide.
    expect(r.distance).toBeCloseTo(0, 6);
  });
});
