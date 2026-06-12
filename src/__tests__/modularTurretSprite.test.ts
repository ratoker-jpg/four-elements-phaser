/**
 * FIX-OPUS-TURRET-VISUAL-01: Tests for the Arena modular turret sprite
 * resolver. The Arena renderer prefers a real turret sprite (Smoky) over the
 * tiny procedural turret box when the sprite is loaded.
 *
 * FIX-OPUS-TURRET-VISUAL-01B: The resolver now reuses the calibrated Wasp hull
 * visual direction remap so the turret is parallel to the generated hull and
 * aligned with the iso aim line. In the 8-direction Smoky set this is the
 * hull's +4 dir16 remap halved to a +2 dir8 offset, so logical-East (turret
 * angle 0) maps to Smoky dir2, and logical-South (+PI/2) maps to dir4.
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

// Full 8-direction Smoky turret set loaded for every faction, so the resolver
// can pick whichever visual direction the hull remap selects.
const ALL_SMOKY = (['cyan', 'green', 'yellow', 'purple'] as Faction[]).flatMap(f =>
  [0, 1, 2, 3, 4, 5, 6, 7].map(d => getSmokyTurretKey(f, d as 0)),
);

describe('resolveModularTurretSpriteKey', () => {
  it('returns the Smoky turret key (hull-aligned visual dir) for a smoky weapon when loaded', () => {
    const scene = mockScene(ALL_SMOKY);
    // turretAngle 0 → logical East → +2 visual remap → dir2
    const key = resolveModularTurretSpriteKey(scene as never, 'smoky', 'cyan', 0);
    expect(key).toBe('smoky_m0_turret_cyan_dir2');
  });

  it('resolves the enemy faction (green) variant', () => {
    const scene = mockScene(ALL_SMOKY);
    const key = resolveModularTurretSpriteKey(scene as never, 'smoky', 'green', 0);
    expect(key).toBe('smoky_m0_turret_green_dir2');
  });

  it('returns null for non-smoky weapons (graceful procedural fallback)', () => {
    const scene = mockScene(ALL_SMOKY);
    expect(resolveModularTurretSpriteKey(scene as never, 'railgun', 'cyan', 0)).toBeNull();
    expect(resolveModularTurretSpriteKey(scene as never, 'thunder', 'cyan', 0)).toBeNull();
  });

  it('returns null when the smoky texture is not loaded', () => {
    const scene = mockScene([]); // nothing loaded
    expect(resolveModularTurretSpriteKey(scene as never, 'smoky', 'cyan', 0)).toBeNull();
  });

  it('falls back to a valid sprite faction for unknown factions', () => {
    const scene = mockScene(ALL_SMOKY);
    // Unknown faction should resolve to cyan sprite.
    const key = resolveModularTurretSpriteKey(scene as never, 'smoky', 'orange' as Faction, 0);
    expect(key).toBe('smoky_m0_turret_cyan_dir2');
  });

  it('quantizes turretAngle into the 8-direction sprite set via the hull remap', () => {
    const scene = mockScene(ALL_SMOKY);
    // South ≈ +PI/2 → logical dir2 → +2 visual remap → dir4.
    const south = resolveModularTurretSpriteKey(scene as never, 'smoky', 'cyan', Math.PI / 2);
    expect(south).toBe('smoky_m0_turret_cyan_dir4');
  });

  it('keeps the turret parallel to the hull at rest (East cardinal)', () => {
    const scene = mockScene(ALL_SMOKY);
    // The generated Wasp hull renders logical-East with its +4 dir16 remap
    // (visual dir16 = 4, "S"-labelled PNG that visually faces iso down-right).
    // The Smoky turret must select the matching visual direction (dir2), whose
    // barrel points the same iso down-right. This guards the parallel-at-rest
    // acceptance criterion.
    const east = resolveModularTurretSpriteKey(scene as never, 'smoky', 'cyan', 0);
    expect(east).toBe('smoky_m0_turret_cyan_dir2');
  });
});
