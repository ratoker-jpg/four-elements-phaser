/**
 * Tests for blockout vehicle geometry helpers.
 *
 * BLOCKOUT-03H fixup: Turret aiming must use actual turret mount/barrel
 * origin, not body/tile center. These tests verify:
 * - Wasp rear mount origin differs from body center
 * - Mammoth/Titan front_center mount origin differs from body center
 * - Angle to same target differs when mount origin differs
 * - rotateTowardAngle still rate-limits and does not snap
 * - computeTurretWorldOrigin accounts for body rotation
 * - computeMountPixelOffset matches mount categories
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHAPE_SIZE_MAP,
  computeMountPixelOffset,
  computeTurretWorldOrigin,
  computeBodyWorldCenter,
  getBodyPixelSize,
} from '../phaser/render/blockoutVehicleGeometry';
import { tileToScreen } from '../phaser/render/isometric';
import { angleFromTo, rotateTowardAngle, degPerSecToRadPerMs } from '../state/angleMath';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import type { MountCategory } from '../config/blockoutProfiles';

// ─── SHAPE_SIZE_MAP completeness ────────────────────────────────────

describe('SHAPE_SIZE_MAP', () => {
  it('should have entries for all 6 blockout shapes', () => {
    const shapes = ['small_fast', 'light_fast', 'medium', 'large_fast', 'heavy', 'super_heavy'];
    for (const shape of shapes) {
      const size = SHAPE_SIZE_MAP[shape as keyof typeof SHAPE_SIZE_MAP];
      expect(size, `Missing shape: ${shape}`).toBeDefined();
      expect(size.w).toBeGreaterThan(0);
      expect(size.h).toBeGreaterThan(0);
    }
  });

  it('should have size ordering: small_fast < super_heavy', () => {
    expect(SHAPE_SIZE_MAP.small_fast.w).toBeLessThan(SHAPE_SIZE_MAP.super_heavy.w);
  });
});

// ─── getBodyPixelSize ────────────────────────────────────────────────

describe('getBodyPixelSize', () => {
  it('should return correct size for wasp (small_fast)', () => {
    const size = getBodyPixelSize('wasp');
    expect(size).toEqual(SHAPE_SIZE_MAP.small_fast);
  });

  it('should return correct size for mammoth (super_heavy)', () => {
    const size = getBodyPixelSize('mammoth');
    expect(size).toEqual(SHAPE_SIZE_MAP.super_heavy);
  });

  it('should return default medium size for unknown body', () => {
    const size = getBodyPixelSize('unknown_body');
    expect(size).toEqual(SHAPE_SIZE_MAP.medium);
  });
});

// ─── computeMountPixelOffset ─────────────────────────────────────────

describe('computeMountPixelOffset', () => {
  it('should return zero offset for center mount', () => {
    const offset = computeMountPixelOffset('center', 22, 14);
    expect(offset.dx).toBeCloseTo(0);
    expect(offset.dy).toBeCloseTo(0);
  });

  it('should return negative dx for rear mount', () => {
    const offset = computeMountPixelOffset('rear', 22, 14);
    expect(offset.dx).toBeLessThan(0);
  });

  it('should return positive dx for front_center mount', () => {
    const offset = computeMountPixelOffset('front_center', 22, 14);
    expect(offset.dx).toBeGreaterThan(0);
  });

  it('should return positive dx for front mount', () => {
    const offset = computeMountPixelOffset('front', 22, 14);
    expect(offset.dx).toBeGreaterThan(0);
  });

  it('should return negative dx for center_rear mount', () => {
    const offset = computeMountPixelOffset('center_rear', 22, 14);
    expect(offset.dx).toBeLessThan(0);
  });

  it('rear mount offset should be larger than center_rear in magnitude', () => {
    const rear = computeMountPixelOffset('rear', 22, 14);
    const centerRear = computeMountPixelOffset('center_rear', 22, 14);
    expect(Math.abs(rear.dx)).toBeGreaterThan(Math.abs(centerRear.dx));
  });

  it('front mount offset should be larger than front_center', () => {
    const front = computeMountPixelOffset('front', 22, 14);
    const frontCenter = computeMountPixelOffset('front_center', 22, 14);
    expect(front.dx).toBeGreaterThan(frontCenter.dx);
  });

  it('offset should scale with body width', () => {
    const small = computeMountPixelOffset('rear', 16, 10);
    const large = computeMountPixelOffset('rear', 32, 22);
    // Both rear: -0.3 * width
    expect(Math.abs(large.dx)).toBeGreaterThan(Math.abs(small.dx));
    // Check exact values
    expect(small.dx).toBeCloseTo(-0.3 * 16);
    expect(large.dx).toBeCloseTo(-0.3 * 32);
  });

  it('dy should always be 0 (no lateral offset)', () => {
    const categories: MountCategory[] = ['rear', 'center_rear', 'center', 'front_center', 'front'];
    for (const cat of categories) {
      const offset = computeMountPixelOffset(cat, 22, 14);
      expect(offset.dy, `dy should be 0 for ${cat}`).toBe(0);
    }
  });
});

// ─── computeBodyWorldCenter ──────────────────────────────────────────

describe('computeBodyWorldCenter', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('should compute body center at tileToScreen + offset', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const offset = { x: 100, y: 200 };
    const center = computeBodyWorldCenter(vehicle, offset);

    // Manually compute expected position
    const screenPos = tileToScreen(5, 5);
    expect(center.x).toBeCloseTo(screenPos.x + 100);
    expect(center.y).toBeCloseTo(screenPos.y + 200);
  });

  it('should return same position regardless of bodyId', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5);
    const offset = { x: 100, y: 200 };

    const waspCenter = computeBodyWorldCenter(wasp, offset);
    const mammothCenter = computeBodyWorldCenter(mammoth, offset);

    expect(waspCenter.x).toBeCloseTo(mammothCenter.x);
    expect(waspCenter.y).toBeCloseTo(mammothCenter.y);
  });
});

// ─── computeTurretWorldOrigin ────────────────────────────────────────

describe('computeTurretWorldOrigin', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('Wasp rear mount origin differs from body center', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0); // bodyAngle=0
    const offset = { x: 100, y: 200 };

    const bodyCenter = computeBodyWorldCenter(wasp, offset);
    const turretOrigin = computeTurretWorldOrigin(wasp, offset);

    // Wasp has rear mount (-0.3 * bodyWidth), so turret should be behind body center
    // With bodyAngle=0, dx is along +x axis. Rear mount = negative dx.
    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
    // For rear mount at bodyAngle=0, turret x should be less than body center x
    expect(turretOrigin.x).toBeLessThan(bodyCenter.x);
    // dy should be 0 at bodyAngle=0
    expect(turretOrigin.y).toBeCloseTo(bodyCenter.y);
  });

  it('Mammoth front_center mount origin differs from body center', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const bodyCenter = computeBodyWorldCenter(mammoth, offset);
    const turretOrigin = computeTurretWorldOrigin(mammoth, offset);

    // Mammoth has front_center mount (0.2 * bodyWidth), so turret should be in front of body center
    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
    expect(turretOrigin.x).toBeGreaterThan(bodyCenter.x);
    expect(turretOrigin.y).toBeCloseTo(bodyCenter.y);
  });

  it('Titan front_center mount origin differs from body center', () => {
    const titan = createBlockoutVehicle('titan', 'vulcan', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const bodyCenter = computeBodyWorldCenter(titan, offset);
    const turretOrigin = computeTurretWorldOrigin(titan, offset);

    // Titan has front_center mount
    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
    expect(turretOrigin.x).toBeGreaterThan(bodyCenter.x);
  });

  it('Dictator rear mount origin differs from body center', () => {
    const dictator = createBlockoutVehicle('dictator', 'railgun', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const bodyCenter = computeBodyWorldCenter(dictator, offset);
    const turretOrigin = computeTurretWorldOrigin(dictator, offset);

    // Dictator has rear mount
    expect(turretOrigin.x).not.toBeCloseTo(bodyCenter.x);
    expect(turretOrigin.x).toBeLessThan(bodyCenter.x);
  });

  it('Hunter center mount origin equals body center (no offset)', () => {
    const hunter = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const bodyCenter = computeBodyWorldCenter(hunter, offset);
    const turretOrigin = computeTurretWorldOrigin(hunter, offset);

    // Hunter has center mount — turret origin should match body center
    expect(turretOrigin.x).toBeCloseTo(bodyCenter.x);
    expect(turretOrigin.y).toBeCloseTo(bodyCenter.y);
  });

  it('turret origin rotates with body angle', () => {
    const wasp0 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const wasp90 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 2);
    const offset = { x: 100, y: 200 };

    const origin0 = computeTurretWorldOrigin(wasp0, offset);
    const origin90 = computeTurretWorldOrigin(wasp90, offset);

    // At bodyAngle=0, rear mount shifts x negatively
    // At bodyAngle=PI/2, the same mount offset rotates to shift y negatively
    expect(origin0.x).not.toBeCloseTo(origin90.x);
    expect(origin0.y).not.toBeCloseTo(origin90.y);

    // At PI/2, the dx offset (negative) rotates to become a negative y offset
    // cos(PI/2)≈0, sin(PI/2)=1: worldOffsetX = dx*0 - 0*1 = 0, worldOffsetY = dx*1 + 0*0 = dx
    const bodyCenter = computeBodyWorldCenter(wasp90, offset);
    expect(origin90.x).toBeCloseTo(bodyCenter.x); // No x offset when rotated 90deg
    expect(origin90.y).toBeLessThan(bodyCenter.y); // Rear mount becomes y-negative
  });

  it('turret origin for rear mount is further from a front target than body center is', () => {
    // This is the key behavioral fix: a rear-mounted turret has a different
    // aim angle to a target compared to body center
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 0, y: 0 };

    const bodyCenter = computeBodyWorldCenter(wasp, offset);
    const turretOrigin = computeTurretWorldOrigin(wasp, offset);

    // Target that's both ahead and to the side — angles WILL differ
    // because the turret is behind the body center
    const lateralTargetX = bodyCenter.x + 200;
    const lateralTargetY = bodyCenter.y + 50;

    const angleFromBodyLateral = angleFromTo(bodyCenter.x, bodyCenter.y, lateralTargetX, lateralTargetY);
    const angleFromTurretLateral = angleFromTo(turretOrigin.x, turretOrigin.y, lateralTargetX, lateralTargetY);

    // The angles should differ because the turret is behind the body center
    expect(angleFromBodyLateral).not.toBeCloseTo(angleFromTurretLateral);
  });
});

// ─── Angle difference when mount origin differs ──────────────────────

describe('turret aim angle differs by mount origin', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('angle to same target differs for Wasp rear mount vs body center', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 0, y: 0 };

    const bodyCenter = computeBodyWorldCenter(wasp, offset);
    const turretOrigin = computeTurretWorldOrigin(wasp, offset);

    // Target that's both ahead and to the side
    const targetX = bodyCenter.x + 100;
    const targetY = bodyCenter.y + 80;

    const angleFromBody = angleFromTo(bodyCenter.x, bodyCenter.y, targetX, targetY);
    const angleFromTurret = angleFromTo(turretOrigin.x, turretOrigin.y, targetX, targetY);

    // The angles MUST differ because the turret origin is offset from body center
    const angleDiff = Math.abs(angleFromBody - angleFromTurret);
    expect(angleDiff).toBeGreaterThan(0.001); // Non-trivial difference
  });

  it('angle to same target differs for Mammoth front_center vs body center', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const offset = { x: 0, y: 0 };

    const bodyCenter = computeBodyWorldCenter(mammoth, offset);
    const turretOrigin = computeTurretWorldOrigin(mammoth, offset);

    // Target that's both ahead and to the side
    const targetX = bodyCenter.x + 100;
    const targetY = bodyCenter.y + 80;

    const angleFromBody = angleFromTo(bodyCenter.x, bodyCenter.y, targetX, targetY);
    const angleFromTurret = angleFromTo(turretOrigin.x, turretOrigin.y, targetX, targetY);

    const angleDiff = Math.abs(angleFromBody - angleFromTurret);
    expect(angleDiff).toBeGreaterThan(0.001); // Non-trivial difference
  });

  it('angle to same target is same for Hunter center mount (no offset)', () => {
    const hunter = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 0, y: 0 };

    const bodyCenter = computeBodyWorldCenter(hunter, offset);
    const turretOrigin = computeTurretWorldOrigin(hunter, offset);

    // Target that's both ahead and to the side
    const targetX = bodyCenter.x + 100;
    const targetY = bodyCenter.y + 80;

    const angleFromBody = angleFromTo(bodyCenter.x, bodyCenter.y, targetX, targetY);
    const angleFromTurret = angleFromTo(turretOrigin.x, turretOrigin.y, targetX, targetY);

    // Center mount: angles should be identical
    expect(angleFromTurret).toBeCloseTo(angleFromBody);
  });
});

// ─── rotateTowardAngle still rate-limits with mount-corrected angle ──

describe('rotateTowardAngle still rate-limits with mount-corrected aim', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('turret does not snap to mount-corrected target angle', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0, 90);
    const offset = { x: 0, y: 0 };

    // Compute turret origin and target angle
    const turretOrigin = computeTurretWorldOrigin(wasp, offset);
    const targetX = turretOrigin.x + 100;
    const targetY = turretOrigin.y + 80;
    const targetAngle = angleFromTo(turretOrigin.x, turretOrigin.y, targetX, targetY);

    // Set turretTargetAngle
    wasp.turretTargetAngle = targetAngle;

    // Simulate one frame: delta=16ms
    const maxDelta = degPerSecToRadPerMs(wasp.turretTurnSpeedDeg) * 16;
    const newAngle = rotateTowardAngle(wasp.turretAngle, targetAngle, maxDelta);

    // Turret should have moved but NOT reached target
    expect(newAngle).not.toBeCloseTo(targetAngle);
    expect(Math.abs(newAngle - wasp.turretAngle)).toBeGreaterThan(0);
  });

  it('turret reaches mount-corrected target after enough frames', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0, 360);
    const offset = { x: 0, y: 0 };

    const turretOrigin = computeTurretWorldOrigin(wasp, offset);
    const targetX = turretOrigin.x + 100;
    const targetY = turretOrigin.y + 80;
    const targetAngle = angleFromTo(turretOrigin.x, turretOrigin.y, targetX, targetY);

    wasp.turretTargetAngle = targetAngle;

    // Simulate many frames
    for (let i = 0; i < 200; i++) {
      const maxDelta = degPerSecToRadPerMs(wasp.turretTurnSpeedDeg) * 16;
      wasp.turretAngle = rotateTowardAngle(wasp.turretAngle, targetAngle, maxDelta);
    }

    expect(wasp.turretAngle).toBeCloseTo(targetAngle, 2);
  });
});
