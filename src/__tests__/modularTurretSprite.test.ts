/**
 * FIX-OPUS-TURRET-VISUAL-01: Tests for the Arena modular turret sprite
 * resolver. The Arena renderer prefers a real turret sprite (Smoky) over the
 * tiny procedural turret box when the sprite is loaded.
 *
 * Pure-ish test: mocks scene.textures.exists so no Phaser runtime is needed.
 */

import { describe, it, expect } from 'vitest';
import { resolveModularTurretSpriteKey, getSmokyTurretKey } from '../assets/modularUnitAssets';
import type { Faction } from '../state/types';

/** Build a mock scene whose TextureManager reports the given keys as loaded. */
function mockScene(loadedKeys: string[]): { textures: { exists: (k: string) => boolean } } {
  const set = new Set(loadedKeys);
  return { textures: { exists: (k: string) => set.has(k) } };
}

// All four faction Smoky turret dir0 keys loaded (east-facing).
const ALL_SMOKY_DIR0 = (['cyan', 'green', 'yellow', 'purple'] as Faction[]).map(f =>
  getSmokyTurretKey(f, 0),
);

describe('resolveModularTurretSpriteKey', () => {
  it('returns the Smoky turret key for a smoky weapon when loaded', () => {
    const scene = mockScene(ALL_SMOKY_DIR0);
    // turretAngle 0 → east → dir0
    const key = resolveModularTurretSpriteKey(scene as never, 'smoky', 'cyan', 0);
    expect(key).toBe('smoky_m0_turret_cyan_dir0');
  });

  it('resolves the enemy faction (green) variant', () => {
    const scene = mockScene(ALL_SMOKY_DIR0);
    const key = resolveModularTurretSpriteKey(scene as never, 'smoky', 'green', 0);
    expect(key).toBe('smoky_m0_turret_green_dir0');
  });

  it('returns null for non-smoky weapons (graceful procedural fallback)', () => {
    const scene = mockScene(ALL_SMOKY_DIR0);
    expect(resolveModularTurretSpriteKey(scene as never, 'railgun', 'cyan', 0)).toBeNull();
    expect(resolveModularTurretSpriteKey(scene as never, 'thunder', 'cyan', 0)).toBeNull();
  });

  it('returns null when the smoky texture is not loaded', () => {
    const scene = mockScene([]); // nothing loaded
    expect(resolveModularTurretSpriteKey(scene as never, 'smoky', 'cyan', 0)).toBeNull();
  });

  it('falls back to a valid sprite faction for unknown factions', () => {
    const scene = mockScene(ALL_SMOKY_DIR0);
    // Unknown faction should resolve to cyan sprite.
    const key = resolveModularTurretSpriteKey(scene as never, 'smoky', 'orange' as Faction, 0);
    expect(key).toBe('smoky_m0_turret_cyan_dir0');
  });

  it('quantizes turretAngle into the 8-direction sprite set', () => {
    // Load the full cyan Smoky dir set.
    const fullCyan = [0, 1, 2, 3, 4, 5, 6, 7].map(d => getSmokyTurretKey('cyan', d as 0));
    const scene = mockScene(fullCyan);
    // South ≈ +PI/2 → dir2 in the screen-space convention.
    const south = resolveModularTurretSpriteKey(scene as never, 'smoky', 'cyan', Math.PI / 2);
    expect(south).toBe('smoky_m0_turret_cyan_dir2');
  });
});
