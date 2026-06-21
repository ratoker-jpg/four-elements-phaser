/**
 * Test helper for creating GameState with vision field.
 *
 * FOG-VISION-08: All GameState objects must include a `vision` field.
 * This helper provides a minimal vision state for tests that don't
 * care about fog of war but need a valid GameState.
 */

import type { GameState } from '../state/types';
import { createInitialVisionState } from '../state/visibility';

/**
 * Add vision field to a partial GameState for tests.
 * Creates a fully-explored vision state so fog doesn't interfere
 * with non-fog tests.
 */
export function addVisionToState(state: Partial<GameState>, width: number = 48, height: number = 48): GameState {
  const vision = createInitialVisionState(width, height);
  // Mark all tiles as explored and visible for non-fog tests
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      vision.explored[y][x] = true;
      vision.visible[y][x] = true;
    }
  }
  vision.dirty = false;
  return { ...state, vision } as GameState;
}
