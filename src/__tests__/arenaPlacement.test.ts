/**
 * Tests for arena placement — pure TypeScript, no Phaser.
 *
 * ARENA-02H+: Tests for placement state machine and click-to-tile conversion.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createArenaPlacementState,
  enterPlacementMode,
  cancelPlacementMode,
  convertClickToPlacementTile,
  getPlacementHoverTile,
} from '../state/arenaPlacement';
import { createBlockoutVehicle, resetBlockoutVehicleIdCounter } from '../state/blockoutVehicleState';

// ─── Placement state machine tests ──────────────────────────────────

describe('ArenaPlacementState', () => {
  it('should start in idle mode with no selections', () => {
    const state = createArenaPlacementState();
    expect(state.mode).toBe('idle');
    expect(state.selectedBody).toBeNull();
    expect(state.selectedWeapon).toBeNull();
    expect(state.selectedTeam).toBe('ally');
  });

  it('should not enter placement mode without body and weapon', () => {
    const state = createArenaPlacementState();
    expect(enterPlacementMode(state)).toBe(false);
    expect(state.mode).toBe('idle');
  });

  it('should enter placement mode with body and weapon selected', () => {
    const state = createArenaPlacementState();
    state.selectedBody = 'wasp';
    state.selectedWeapon = 'smoky';
    expect(enterPlacementMode(state)).toBe(true);
    expect(state.mode).toBe('placing');
  });

  it('should cancel placement mode back to idle', () => {
    const state = createArenaPlacementState();
    state.selectedBody = 'wasp';
    state.selectedWeapon = 'smoky';
    enterPlacementMode(state);
    expect(state.mode).toBe('placing');
    cancelPlacementMode(state);
    expect(state.mode).toBe('idle');
  });
});

// ─── Click-to-tile conversion tests ─────────────────────────────────

describe('convertClickToPlacementTile', () => {
  const origin = { x: 500, y: 200 }; // Typical map origin offset

  beforeEach(() => {
    resetBlockoutVehicleIdCounter();
  });

  it('should convert center of map to valid tile', () => {
    // projectGroundPoint(10, 10, origin) gives us the screen position for tile (10, 10)
    // Use the same basis as the projection contract: basisX = {38, 19}, basisY = {-38, 19}
    const screenX = origin.x + 10 * 38 + 10 * (-38); // = origin.x + 0 = 500
    const screenY = origin.y + 10 * 19 + 10 * 19; // = origin.y + 380 = 580
    const result = convertClickToPlacementTile(screenX, screenY, origin, 20, 20, []);
    expect(result.valid).toBe(true);
    expect(result.tx).toBe(10);
    expect(result.ty).toBe(10);
  });

  it('should reject clicks outside map bounds', () => {
    // Point far off the map
    const screenX = origin.x + 25 * 38 + 25 * (-38);
    const screenY = origin.y + 25 * 19 + 25 * 19;
    const result = convertClickToPlacementTile(screenX, screenY, origin, 20, 20, []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('bounds');
  });

  it('should reject negative tile coordinates', () => {
    // Point that would unproject to negative tiles
    const screenX = origin.x + (-5) * 38 + (-5) * (-38);
    const screenY = origin.y + (-5) * 19 + (-5) * 19;
    const result = convertClickToPlacementTile(screenX, screenY, origin, 20, 20, []);
    expect(result.valid).toBe(false);
  });

  it('should reject occupied tiles', () => {
    // Place a vehicle at (5, 5)
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    // Compute screen position for tile (5, 5)
    const screenX = origin.x + 5 * 38 + 5 * (-38);
    const screenY = origin.y + 5 * 19 + 5 * 19;
    const result = convertClickToPlacementTile(screenX, screenY, origin, 20, 20, [vehicle]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('should allow placement on tile with destroyed vehicle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 5, 5);
    vehicle.isDestroyed = true;
    const screenX = origin.x + 5 * 38 + 5 * (-38);
    const screenY = origin.y + 5 * 19 + 5 * 19;
    const result = convertClickToPlacementTile(screenX, screenY, origin, 20, 20, [vehicle]);
    expect(result.valid).toBe(true);
  });
});

describe('getPlacementHoverTile', () => {
  const origin = { x: 500, y: 200 };

  it('should return tile position for valid map position', () => {
    const screenX = origin.x + 8 * 38 + 8 * (-38);
    const screenY = origin.y + 8 * 19 + 8 * 19;
    const result = getPlacementHoverTile(screenX, screenY, origin, 20, 20);
    expect(result).not.toBeNull();
    expect(result!.tx).toBe(8);
    expect(result!.ty).toBe(8);
  });

  it('should return null for out-of-bounds position', () => {
    const screenX = origin.x + 30 * 38 + 30 * (-38);
    const screenY = origin.y + 30 * 19 + 30 * 19;
    const result = getPlacementHoverTile(screenX, screenY, origin, 20, 20);
    expect(result).toBeNull();
  });

  it('should return valid=false for occupied tile', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 8, 8);
    const screenX = origin.x + 8 * 38 + 8 * (-38);
    const screenY = origin.y + 8 * 19 + 8 * 19;
    const result = getPlacementHoverTile(screenX, screenY, origin, 20, 20, [vehicle]);
    expect(result).not.toBeNull();
    expect(result!.tx).toBe(8);
    expect(result!.ty).toBe(8);
    expect(result!.valid).toBe(false);
  });

  it('should return valid=true for tile with destroyed vehicle', () => {
    const vehicle = createBlockoutVehicle('wasp', 'smoky', 'cyan', 8, 8);
    vehicle.isDestroyed = true;
    const screenX = origin.x + 8 * 38 + 8 * (-38);
    const screenY = origin.y + 8 * 19 + 8 * 19;
    const result = getPlacementHoverTile(screenX, screenY, origin, 20, 20, [vehicle]);
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
  });
});
