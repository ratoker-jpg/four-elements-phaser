import { describe, expect, it } from 'vitest';
import {
  WEAPON_VFX_ASSET_KEYS,
  WEAPON_VFX_ASSET_PATHS,
  isWeaponVfxAssetKey,
} from '../assets/weaponVfxAssets';
import { VFX_PROFILES } from '../config/blockoutVfxData';

describe('weapon VFX donor asset manifest', () => {
  it('uses unique compact runtime keys and paths', () => {
    const keys = Object.values(WEAPON_VFX_ASSET_KEYS);
    const paths = Object.values(WEAPON_VFX_ASSET_PATHS);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(keys.length).toBe(10);

    for (const path of paths) {
      expect(path).toMatch(/^assets\/vfx\/donor\/.+_alpha\.png$/);
    }
  });

  it('keeps every configured profile texture inside the approved manifest', () => {
    const textureFields = [
      'muzzleTextureKey',
      'trailTextureKey',
      'impactTextureKey',
      'smokeTextureKey',
      'noiseTextureKey',
    ] as const;

    for (const profile of Object.values(VFX_PROFILES)) {
      for (const field of textureFields) {
        const value = profile[field];
        if (value !== undefined) {
          expect(isWeaponVfxAssetKey(value)).toBe(true);
        }
      }
    }
  });
});
