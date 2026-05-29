import { describe, expect, it } from 'vitest';
import { GENERATED_ASSET_MANIFEST } from '../assets/generatedAssetManifest';
import { MAPLIFE_DECOR_CONFIG } from '../assets/maplifeDecor';
import type { GeneratedAssetKey } from '../assets/generatedAssetManifest';

describe('MAPLIFE decor asset wiring', () => {
  it('generated asset manifest contains all MAPLIFE decor keys', () => {
    const decorKeys = GENERATED_ASSET_MANIFEST.families.decor.keys;

    for (const config of Object.values(MAPLIFE_DECOR_CONFIG)) {
      expect(decorKeys).toContain(config.key);
      expect(GENERATED_ASSET_MANIFEST.paths[config.key as GeneratedAssetKey]).toBe(config.path);
    }
  });
});
