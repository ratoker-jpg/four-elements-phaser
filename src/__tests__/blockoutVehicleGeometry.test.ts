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
  computeProjectedTurretMountScreen,
  computeProjectedBarrelTipScreen,
  computeProjectedBarrelTipScreenAtZ,
  computeProjectedBlockoutVehicleGeometry,
  BLOCKOUT_TURRET_SIZE_W,
  BLOCKOUT_TURRET_SIZE_H,
  BLOCKOUT_VEHICLE_BODY_Z,
  BLOCKOUT_TURRET_Z_OFFSET,
  BLOCKOUT_TURRET_BOX_HEIGHT,
  BLOCKOUT_BARREL_Z,
} from '../phaser/render/blockoutVehicleGeometry';
import { tileToScreen } from '../phaser/render/isometric';
import { angleFromTo, rotateTowardAngle, degPerSecToRadPerMs } from '../state/angleMath';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';
import type { MountCategory } from '../config/blockoutProfiles';
import { PROJ_TILE_W, basisX, basisY, basisZ, unprojectScreenToGround, projectGroundPoint, projectWorldPoint } from '../config/cameraProjectionContract';

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

// ─── PROJECTION-01 fixup: projected turret mount tests ────────────────

describe('computeProjectedTurretMountScreen', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('projected visual turret mount equals logical turret origin used by input/fire (center mount)', () => {
    // Hunter has center mount — both should return the body center position
    const hunter = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const mountScreen = computeProjectedTurretMountScreen(hunter, offset);
    const bodyCenter = computeBodyWorldCenter(hunter, offset);

    // Center mount: projected mount should be at body center projected to ground
    const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);
    const expectedScreen = projectGroundPoint(tilePos.x, tilePos.y, offset);
    expect(mountScreen.x).toBeCloseTo(expectedScreen.x);
    expect(mountScreen.y).toBeCloseTo(expectedScreen.y);
  });

  it('projected visual turret mount equals logical turret origin (rear mount - Wasp)', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const mountScreen = computeProjectedTurretMountScreen(wasp, offset);

    // Manually compute expected position using tile-space rotation + projection
    const bodyCenter = computeBodyWorldCenter(wasp, offset);
    const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);
    const mountPixelOffset = computeMountPixelOffset('rear', SHAPE_SIZE_MAP.small_fast.w, SHAPE_SIZE_MAP.small_fast.h);
    const mountTileX = mountPixelOffset.dx / PROJ_TILE_W;
    const mountTileY = mountPixelOffset.dy / PROJ_TILE_W;
    const cosA = Math.cos(wasp.bodyAngle);
    const sinA = Math.sin(wasp.bodyAngle);
    const mountWorldX = tilePos.x + mountTileX * cosA - mountTileY * sinA;
    const mountWorldY = tilePos.y + mountTileX * sinA + mountTileY * cosA;
    const expectedScreen = projectGroundPoint(mountWorldX, mountWorldY, offset);

    expect(mountScreen.x).toBeCloseTo(expectedScreen.x, 8);
    expect(mountScreen.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('projected visual turret mount equals logical turret origin (front_center mount - Mammoth)', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const mountScreen = computeProjectedTurretMountScreen(mammoth, offset);

    // Manually compute expected position using tile-space rotation + projection
    const bodyCenter = computeBodyWorldCenter(mammoth, offset);
    const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);
    const mountPixelOffset = computeMountPixelOffset('front_center', SHAPE_SIZE_MAP.super_heavy.w, SHAPE_SIZE_MAP.super_heavy.h);
    const mountTileX = mountPixelOffset.dx / PROJ_TILE_W;
    const mountTileY = mountPixelOffset.dy / PROJ_TILE_W;
    const cosA = Math.cos(mammoth.bodyAngle);
    const sinA = Math.sin(mammoth.bodyAngle);
    const mountWorldX = tilePos.x + mountTileX * cosA - mountTileY * sinA;
    const mountWorldY = tilePos.y + mountTileX * sinA + mountTileY * cosA;
    const expectedScreen = projectGroundPoint(mountWorldX, mountWorldY, offset);

    expect(mountScreen.x).toBeCloseTo(expectedScreen.x, 8);
    expect(mountScreen.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('changing bodyAngle rotates projected mount consistently', () => {
    const wasp0 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const wasp90 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 2);
    const offset = { x: 100, y: 200 };

    const mount0 = computeProjectedTurretMountScreen(wasp0, offset);
    const mount90 = computeProjectedTurretMountScreen(wasp90, offset);

    // Different body angles produce different mount screen X positions.
    // (Y may be the same for 90deg rotation with dy=0 mount offset,
    // because basisX.y == basisY.y, so the Y projection of the offset
    // is the same whether it's along basisX or basisY.)
    expect(mount0.x).not.toBeCloseTo(mount90.x);
  });
});

// ─── PROJECTION-01 fixup: projected barrel tip tests ──────────────────

describe('computeProjectedBarrelTipScreen', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('barrel tip used for rendering equals barrel tip used for fire/damage origin', () => {
    // The barrel tip computed by computeProjectedBarrelTipScreen must match
    // what the renderer draws as the barrel end
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTip = computeProjectedBarrelTipScreen(wasp, offset);

    // Manually compute expected barrel tip position using the same
    // tile-space math the renderer uses
    const geom = computeProjectedBlockoutVehicleGeometry(wasp, offset);
    const bodyCenter = computeBodyWorldCenter(wasp, offset);
    const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);
    const mountWorldX = tilePos.x + geom.mountTileOffset.dx;
    const mountWorldY = tilePos.y + geom.mountTileOffset.dy;

    const turretCosA = Math.cos(geom.effectiveTurretAngle);
    const turretSinA = Math.sin(geom.effectiveTurretAngle);
    const barrelTipTileX = mountWorldX + (geom.turretHalfW + geom.effectiveBarrelLength) * turretCosA;
    const barrelTipTileY = mountWorldY + (geom.turretHalfW + geom.effectiveBarrelLength) * turretSinA;
    const expectedScreen = projectGroundPoint(barrelTipTileX, barrelTipTileY, offset);

    expect(barrelTip.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTip.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('barrel tip for rear mount (Wasp) differs from body center', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTip = computeProjectedBarrelTipScreen(wasp, offset);
    const bodyCenter = computeBodyWorldCenter(wasp, offset);

    // Barrel tip should be offset from body center (both mount offset + barrel length)
    const dx = barrelTip.x - bodyCenter.x;
    const dy = barrelTip.y - bodyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(1); // At least a few pixels away
  });

  it('barrel tip for front_center mount (Mammoth) differs from body center', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTip = computeProjectedBarrelTipScreen(mammoth, offset);
    const bodyCenter = computeBodyWorldCenter(mammoth, offset);

    const dx = barrelTip.x - bodyCenter.x;
    const dy = barrelTip.y - bodyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(1);
  });
});

// ─── PROJECTION-01 fixup: computeProjectedBlockoutVehicleGeometry ─────

describe('computeProjectedBlockoutVehicleGeometry', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('returns bodyTileCenter consistent with unprojectScreenToGround', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const geom = computeProjectedBlockoutVehicleGeometry(wasp, offset);
    const bodyCenter = computeBodyWorldCenter(wasp, offset);
    const expectedTileCenter = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);

    expect(geom.bodyTileCenter.x).toBeCloseTo(expectedTileCenter.x, 8);
    expect(geom.bodyTileCenter.y).toBeCloseTo(expectedTileCenter.y, 8);
  });

  it('mountTileOffset is consistent between geometry and turretMountScreen', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const geom = computeProjectedBlockoutVehicleGeometry(mammoth, offset);
    const mountScreen = computeProjectedTurretMountScreen(mammoth, offset);

    // mountScreen should equal projectGroundPoint(bodyTileCenter + mountTileOffset, offset)
    const mountTileX = geom.bodyTileCenter.x + geom.mountTileOffset.dx;
    const mountTileY = geom.bodyTileCenter.y + geom.mountTileOffset.dy;
    const expectedScreen = projectGroundPoint(mountTileX, mountTileY, offset);

    expect(mountScreen.x).toBeCloseTo(expectedScreen.x, 8);
    expect(mountScreen.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('halfW/halfH use PROJ_TILE_W not hardcoded 76', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 0, y: 0 };

    const geom = computeProjectedBlockoutVehicleGeometry(wasp, offset);
    const bodySize = SHAPE_SIZE_MAP.small_fast;

    // Verify the computed values match the PROJ_TILE_W constant
    expect(geom.halfW).toBeCloseTo(bodySize.w / PROJ_TILE_W);
    expect(geom.halfH).toBeCloseTo(bodySize.h / PROJ_TILE_W);
    // Verify PROJ_TILE_W is the source of truth (even if currently 76)
    expect(PROJ_TILE_W).toBe(76);
  });

  it('turretHalfW/turretHalfH match BLOCKOUT_TURRET_SIZE constants', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 0, y: 0 };

    const geom = computeProjectedBlockoutVehicleGeometry(wasp, offset);

    expect(geom.turretHalfW).toBeCloseTo((BLOCKOUT_TURRET_SIZE_W / 2) / PROJ_TILE_W);
    expect(geom.turretHalfH).toBeCloseTo((BLOCKOUT_TURRET_SIZE_H / 2) / PROJ_TILE_W);
  });

  it('barrelZ matches shared BLOCKOUT_BARREL_Z constant', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 0, y: 0 };

    const geom = computeProjectedBlockoutVehicleGeometry(wasp, offset);

    expect(geom.barrelZ).toBe(BLOCKOUT_BARREL_Z);
    expect(geom.barrelZ).toBeCloseTo(BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + BLOCKOUT_TURRET_BOX_HEIGHT * 0.5);
  });
});

// ─── PROJECTION-01 fixup: no mutation of CAMERA_PROJECTION constants ──

describe('no mutation of CAMERA_PROJECTION constants', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('calling projected helpers does not mutate basisX/basisY/basisZ', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    // Snapshot values before
    const bxBefore = { x: basisX.x, y: basisX.y };
    const byBefore = { x: basisY.x, y: basisY.y };
    const bzBefore = { x: basisZ.x, y: basisZ.y };

    // Call all helpers
    computeProjectedTurretMountScreen(wasp, offset);
    computeProjectedBarrelTipScreen(wasp, offset);
    computeProjectedBarrelTipScreenAtZ(wasp, offset);
    computeProjectedBlockoutVehicleGeometry(wasp, offset);

    // Verify no mutation
    expect(basisX.x).toBe(bxBefore.x);
    expect(basisX.y).toBe(bxBefore.y);
    expect(basisY.x).toBe(byBefore.x);
    expect(basisY.y).toBe(byBefore.y);
    expect(basisZ.x).toBe(bzBefore.x);
    expect(basisZ.y).toBe(bzBefore.y);
  });
});

// ─── PROJECTION-01 fixup #2: barrel Z alignment tests ───────────────────

describe('computeProjectedBarrelTipScreenAtZ', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('rendered barrel tip equals fire/damage barrel tip including Z (center mount - Hunter)', () => {
    // The barrel tip computed by computeProjectedBarrelTipScreenAtZ must match
    // what the renderer draws as the barrel end at the barrel Z level
    const hunter = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTipAtZ = computeProjectedBarrelTipScreenAtZ(hunter, offset);

    // Manually compute expected barrel tip position at barrel Z
    const geom = computeProjectedBlockoutVehicleGeometry(hunter, offset);
    const bodyCenter = computeBodyWorldCenter(hunter, offset);
    const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);
    const mountWorldX = tilePos.x + geom.mountTileOffset.dx;
    const mountWorldY = tilePos.y + geom.mountTileOffset.dy;

    const turretCosA = Math.cos(geom.effectiveTurretAngle);
    const turretSinA = Math.sin(geom.effectiveTurretAngle);
    const barrelTipTileX = mountWorldX + (geom.turretHalfW + geom.effectiveBarrelLength) * turretCosA;
    const barrelTipTileY = mountWorldY + (geom.turretHalfW + geom.effectiveBarrelLength) * turretSinA;
    const expectedScreen = projectWorldPoint(barrelTipTileX, barrelTipTileY, BLOCKOUT_BARREL_Z, offset);

    expect(barrelTipAtZ.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipAtZ.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('rendered barrel tip equals fire/damage barrel tip including Z (rear mount - Wasp)', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTipAtZ = computeProjectedBarrelTipScreenAtZ(wasp, offset);

    // Manually compute expected barrel tip position at barrel Z
    const geom = computeProjectedBlockoutVehicleGeometry(wasp, offset);
    const bodyCenter = computeBodyWorldCenter(wasp, offset);
    const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);
    const mountWorldX = tilePos.x + geom.mountTileOffset.dx;
    const mountWorldY = tilePos.y + geom.mountTileOffset.dy;

    const turretCosA = Math.cos(geom.effectiveTurretAngle);
    const turretSinA = Math.sin(geom.effectiveTurretAngle);
    const barrelTipTileX = mountWorldX + (geom.turretHalfW + geom.effectiveBarrelLength) * turretCosA;
    const barrelTipTileY = mountWorldY + (geom.turretHalfW + geom.effectiveBarrelLength) * turretSinA;
    const expectedScreen = projectWorldPoint(barrelTipTileX, barrelTipTileY, BLOCKOUT_BARREL_Z, offset);

    expect(barrelTipAtZ.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipAtZ.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('rendered barrel tip equals fire/damage barrel tip including Z (front_center mount - Mammoth)', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTipAtZ = computeProjectedBarrelTipScreenAtZ(mammoth, offset);

    // Manually compute expected barrel tip position at barrel Z
    const geom = computeProjectedBlockoutVehicleGeometry(mammoth, offset);
    const bodyCenter = computeBodyWorldCenter(mammoth, offset);
    const tilePos = unprojectScreenToGround(bodyCenter.x, bodyCenter.y, offset);
    const mountWorldX = tilePos.x + geom.mountTileOffset.dx;
    const mountWorldY = tilePos.y + geom.mountTileOffset.dy;

    const turretCosA = Math.cos(geom.effectiveTurretAngle);
    const turretSinA = Math.sin(geom.effectiveTurretAngle);
    const barrelTipTileX = mountWorldX + (geom.turretHalfW + geom.effectiveBarrelLength) * turretCosA;
    const barrelTipTileY = mountWorldY + (geom.turretHalfW + geom.effectiveBarrelLength) * turretSinA;
    const expectedScreen = projectWorldPoint(barrelTipTileX, barrelTipTileY, BLOCKOUT_BARREL_Z, offset);

    expect(barrelTipAtZ.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipAtZ.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('barrel tip at Z is above ground-plane barrel tip (Z offset shifts screen Y upward)', () => {
    // The Z offset must cause the barrel tip to appear higher on screen
    // (lower Y value) compared to the ground-plane projection
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTipGround = computeProjectedBarrelTipScreen(wasp, offset);
    const barrelTipAtZ = computeProjectedBarrelTipScreenAtZ(wasp, offset);

    // Z offset shifts Y upward (negative Y direction on screen)
    expect(barrelTipAtZ.y).toBeLessThan(barrelTipGround.y);
    // X should be the same (basisZ.x = 0)
    expect(barrelTipAtZ.x).toBeCloseTo(barrelTipGround.x, 8);
  });

  it('barrel tip at Z for rear mount (Wasp) differs from body center', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTipAtZ = computeProjectedBarrelTipScreenAtZ(wasp, offset);
    const bodyCenter = computeBodyWorldCenter(wasp, offset);

    const dx = barrelTipAtZ.x - bodyCenter.x;
    const dy = barrelTipAtZ.y - bodyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(1);
  });

  it('barrel tip at Z for front_center mount (Mammoth) differs from body center', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    const offset = { x: 100, y: 200 };

    const barrelTipAtZ = computeProjectedBarrelTipScreenAtZ(mammoth, offset);
    const bodyCenter = computeBodyWorldCenter(mammoth, offset);

    const dx = barrelTipAtZ.x - bodyCenter.x;
    const dy = barrelTipAtZ.y - bodyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(1);
  });

  it('bodyAngle rotation consistency: barrel tip at Z rotates with body', () => {
    const wasp0 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    const wasp90 = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 2);
    const offset = { x: 100, y: 200 };

    const tip0 = computeProjectedBarrelTipScreenAtZ(wasp0, offset);
    const tip90 = computeProjectedBarrelTipScreenAtZ(wasp90, offset);

    // Different body angles produce different barrel tip positions
    expect(tip0.x).not.toBeCloseTo(tip90.x);
  });
});

// ─── PROJECTION-01 fixup #3: body recoil impulse barrel alignment tests ────

describe('PROJECTION-01 fixup #3: body recoil impulse barrel alignment', () => {
  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  /** Helper: manually compute barrel tip screen at Z with body impulse,
   *  exactly matching the renderer's cx/cy computation. */
  function manuallyComputeBarrelTipAtZWithImpulse(
    vehicle: ReturnType<typeof createBlockoutVehicle>,
    offset: { x: number; y: number },
  ): { x: number; y: number } {
    const geom = computeProjectedBlockoutVehicleGeometry(vehicle, offset);
    // Replicate renderer's impulse-shifted body position
    const recoilBodyOffset = vehicle.recoilBodyOffset ?? 0;
    const bodyAngle = vehicle.bodyAngle;
    const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
    const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;
    const cx = vehicle.worldX + offset.x + bodyImpulseX;
    const cy = vehicle.worldY + offset.y + bodyImpulseY;
    const tilePos = unprojectScreenToGround(cx, cy, offset);
    const mountWorldX = tilePos.x + geom.mountTileOffset.dx;
    const mountWorldY = tilePos.y + geom.mountTileOffset.dy;
    const turretCosA = Math.cos(geom.effectiveTurretAngle);
    const turretSinA = Math.sin(geom.effectiveTurretAngle);
    const barrelTipTileX = mountWorldX + (geom.turretHalfW + geom.effectiveBarrelLength) * turretCosA;
    const barrelTipTileY = mountWorldY + (geom.turretHalfW + geom.effectiveBarrelLength) * turretSinA;
    return projectWorldPoint(barrelTipTileX, barrelTipTileY, BLOCKOUT_BARREL_Z, offset);
  }

  it('rendered barrel tip equals fire/damage barrel tip when recoilBodyOffset > 0 (center mount - Hunter)', () => {
    const hunter = createBlockoutVehicle('hunter', 'smoky', 'cyan', 5, 5, 0);
    hunter.recoilBodyOffset = 8; // Simulate active recoil
    const offset = { x: 100, y: 200 };

    const barrelTipFromHelper = computeProjectedBarrelTipScreenAtZ(hunter, offset);
    const barrelTipFromGeom = computeProjectedBlockoutVehicleGeometry(hunter, offset).barrelTipScreen;
    const expectedScreen = manuallyComputeBarrelTipAtZWithImpulse(hunter, offset);

    // Helper and geometry must agree
    expect(barrelTipFromHelper.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipFromHelper.y).toBeCloseTo(expectedScreen.y, 8);
    // Geometry's barrelTipScreen must match
    expect(barrelTipFromGeom.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipFromGeom.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('rendered barrel tip equals fire/damage barrel tip when recoilBodyOffset > 0 (rear mount - Wasp)', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    wasp.recoilBodyOffset = 10;
    const offset = { x: 100, y: 200 };

    const barrelTipFromHelper = computeProjectedBarrelTipScreenAtZ(wasp, offset);
    const barrelTipFromGeom = computeProjectedBlockoutVehicleGeometry(wasp, offset).barrelTipScreen;
    const expectedScreen = manuallyComputeBarrelTipAtZWithImpulse(wasp, offset);

    expect(barrelTipFromHelper.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipFromHelper.y).toBeCloseTo(expectedScreen.y, 8);
    expect(barrelTipFromGeom.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipFromGeom.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('rendered barrel tip equals fire/damage barrel tip when recoilBodyOffset > 0 (front_center mount - Mammoth)', () => {
    const mammoth = createBlockoutVehicle('mammoth', 'thunder', 'cyan', 5, 5, 0);
    mammoth.recoilBodyOffset = 6;
    const offset = { x: 100, y: 200 };

    const barrelTipFromHelper = computeProjectedBarrelTipScreenAtZ(mammoth, offset);
    const barrelTipFromGeom = computeProjectedBlockoutVehicleGeometry(mammoth, offset).barrelTipScreen;
    const expectedScreen = manuallyComputeBarrelTipAtZWithImpulse(mammoth, offset);

    expect(barrelTipFromHelper.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipFromHelper.y).toBeCloseTo(expectedScreen.y, 8);
    expect(barrelTipFromGeom.x).toBeCloseTo(expectedScreen.x, 8);
    expect(barrelTipFromGeom.y).toBeCloseTo(expectedScreen.y, 8);
  });

  it('barrel tip with recoil differs from barrel tip without recoil', () => {
    // Use non-zero bodyAngle so impulse shifts both screen X and Y
    // (at bodyAngle=0, screen X-only shifts unproject/reproject as X-only)
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 4);
    const offset = { x: 100, y: 200 };

    const tipNoRecoil = computeProjectedBarrelTipScreenAtZ(wasp, offset);

    wasp.recoilBodyOffset = 10;
    const tipWithRecoil = computeProjectedBarrelTipScreenAtZ(wasp, offset);

    // Body recoil shifts the barrel tip position (at least one coordinate)
    const dx = Math.abs(tipWithRecoil.x - tipNoRecoil.x);
    const dy = Math.abs(tipWithRecoil.y - tipNoRecoil.y);
    expect(dx + dy).toBeGreaterThan(0.01);
  });

  it('barrelTipScreen equals computeProjectedBarrelTipScreenAtZ (single source of truth)', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    wasp.recoilBodyOffset = 8;
    wasp.recoilBarrelOffset = 3;
    wasp.recoilTurretOffset = 0.05;
    const offset = { x: 100, y: 200 };

    const fromGeom = computeProjectedBlockoutVehicleGeometry(wasp, offset).barrelTipScreen;
    const fromHelper = computeProjectedBarrelTipScreenAtZ(wasp, offset);

    expect(fromGeom.x).toBeCloseTo(fromHelper.x, 10);
    expect(fromGeom.y).toBeCloseTo(fromHelper.y, 10);
  });

  it('barrelStartScreen is consistent with mount and turret geometry', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    wasp.recoilBodyOffset = 8;
    const offset = { x: 100, y: 200 };

    const geom = computeProjectedBlockoutVehicleGeometry(wasp, offset);

    // Manually compute barrel start (turret front edge at barrelZ with impulse)
    const recoilBodyOffset = wasp.recoilBodyOffset ?? 0;
    const bodyAngle = wasp.bodyAngle;
    const bodyImpulseX = -Math.cos(bodyAngle) * recoilBodyOffset;
    const bodyImpulseY = -Math.sin(bodyAngle) * recoilBodyOffset;
    const cx = wasp.worldX + offset.x + bodyImpulseX;
    const cy = wasp.worldY + offset.y + bodyImpulseY;
    const tilePos = unprojectScreenToGround(cx, cy, offset);
    const mountWorldX = tilePos.x + geom.mountTileOffset.dx;
    const mountWorldY = tilePos.y + geom.mountTileOffset.dy;
    const turretCosA = Math.cos(geom.effectiveTurretAngle);
    const turretSinA = Math.sin(geom.effectiveTurretAngle);
    const barrelStartTileX = mountWorldX + geom.turretHalfW * turretCosA;
    const barrelStartTileY = mountWorldY + geom.turretHalfW * turretSinA;
    const expected = projectWorldPoint(barrelStartTileX, barrelStartTileY, BLOCKOUT_BARREL_Z, offset);

    expect(geom.barrelStartScreen.x).toBeCloseTo(expected.x, 8);
    expect(geom.barrelStartScreen.y).toBeCloseTo(expected.y, 8);
  });

  it('turret mount screen includes body recoil impulse', () => {
    // Use non-zero bodyAngle so impulse shifts both screen X and Y
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, Math.PI / 4);
    const offset = { x: 100, y: 200 };

    const mountNoRecoil = computeProjectedTurretMountScreen(wasp, offset);

    wasp.recoilBodyOffset = 10;
    const mountWithRecoil = computeProjectedTurretMountScreen(wasp, offset);

    // Body recoil shifts the turret mount position (at least one coordinate)
    const dx = Math.abs(mountWithRecoil.x - mountNoRecoil.x);
    const dy = Math.abs(mountWithRecoil.y - mountNoRecoil.y);
    expect(dx + dy).toBeGreaterThan(0.01);
  });

  it('no mutation of CAMERA_PROJECTION constants when recoilBodyOffset > 0', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    wasp.recoilBodyOffset = 10;
    const offset = { x: 100, y: 200 };

    const bxBefore = { x: basisX.x, y: basisX.y };
    const byBefore = { x: basisY.x, y: basisY.y };
    const bzBefore = { x: basisZ.x, y: basisZ.y };

    computeProjectedTurretMountScreen(wasp, offset);
    computeProjectedBarrelTipScreen(wasp, offset);
    computeProjectedBarrelTipScreenAtZ(wasp, offset);
    computeProjectedBlockoutVehicleGeometry(wasp, offset);

    expect(basisX.x).toBe(bxBefore.x);
    expect(basisX.y).toBe(bxBefore.y);
    expect(basisY.x).toBe(byBefore.x);
    expect(basisY.y).toBe(byBefore.y);
    expect(basisZ.x).toBe(bzBefore.x);
    expect(basisZ.y).toBe(bzBefore.y);
  });

  it('Z alignment: barrel tip at Z is above ground barrel tip when recoilBodyOffset > 0', () => {
    const wasp = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5, 0);
    wasp.recoilBodyOffset = 8;
    const offset = { x: 100, y: 200 };

    const barrelTipGround = computeProjectedBarrelTipScreen(wasp, offset);
    const barrelTipAtZ = computeProjectedBarrelTipScreenAtZ(wasp, offset);

    // Z offset shifts Y upward (negative Y direction on screen)
    expect(barrelTipAtZ.y).toBeLessThan(barrelTipGround.y);
    // X should be the same (basisZ.x = 0)
    expect(barrelTipAtZ.x).toBeCloseTo(barrelTipGround.x, 8);
  });
});

// ─── PROJECTION-01 fixup #2: Z constant integrity tests ─────────────────

describe('BLOCKOUT Z constants', () => {
  it('BLOCKOUT_BARREL_Z equals body + turret offset + half turret box height', () => {
    expect(BLOCKOUT_BARREL_Z).toBeCloseTo(BLOCKOUT_VEHICLE_BODY_Z + BLOCKOUT_TURRET_Z_OFFSET + BLOCKOUT_TURRET_BOX_HEIGHT * 0.5);
  });

  it('BLOCKOUT_BARREL_Z is positive (above ground)', () => {
    expect(BLOCKOUT_BARREL_Z).toBeGreaterThan(0);
  });

  it('BLOCKOUT_VEHICLE_BODY_Z is positive', () => {
    expect(BLOCKOUT_VEHICLE_BODY_Z).toBeGreaterThan(0);
  });

  it('BLOCKOUT_TURRET_Z_OFFSET is positive', () => {
    expect(BLOCKOUT_TURRET_Z_OFFSET).toBeGreaterThan(0);
  });

  it('BLOCKOUT_TURRET_BOX_HEIGHT is positive', () => {
    expect(BLOCKOUT_TURRET_BOX_HEIGHT).toBeGreaterThan(0);
  });
});
