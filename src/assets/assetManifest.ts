/**
 * Asset manifest — keys and paths for all runtime-approved assets.
 *
 * Only assets that are actively used by the production game are listed.
 * See docs/ASSET_POLICY.md for the full copy policy.
 */

export const ASSET_KEYS = {
  // Terrain (3 legacy tiles — now loaded from generated manifest via loadGeneratedTerrainAndResourceAssets)
  // @deprecated Use GENERATED_ASSET_MANIFEST.families.terrain.keys instead
  TERRAIN_SAND: 'terrain_sand',
  TERRAIN_SAND_DARK: 'terrain_sand_dark',
  TERRAIN_SAND_LIGHT: 'terrain_sand_light',

  // Buildings
  HQ_CYAN: 'hq_cyan',

  // Units
  HARVESTER_CYAN: 'harvester_cyan',

  // Resources (3 minerals — now loaded from generated manifest via loadGeneratedTerrainAndResourceAssets)
  // @deprecated Use GENERATED_ASSET_MANIFEST.families.resources.keys instead
  MINERAL_SMALL: 'mineral_small',
  MINERAL_MEDIUM: 'mineral_medium',
  MINERAL_LARGE: 'mineral_large',
} as const;

export type AssetKey = (typeof ASSET_KEYS)[keyof typeof ASSET_KEYS];

/**
 * Path map for Phaser loader.
 * Keys are the same as ASSET_KEYS values; paths are relative to /public.
 *
 * Terrain and resource paths are now provided by the generated manifest.
 * These entries remain for compatibility until a later cleanup.
 */
export const ASSET_PATHS: Record<AssetKey, string> = {
  // @deprecated Terrain paths — now in GENERATED_ASSET_MANIFEST.paths
  [ASSET_KEYS.TERRAIN_SAND]: 'assets/tiles/sand_tile.png',
  [ASSET_KEYS.TERRAIN_SAND_DARK]: 'assets/tiles/sand_tile_dark.png',
  [ASSET_KEYS.TERRAIN_SAND_LIGHT]: 'assets/tiles/sand_tile_light.png',

  [ASSET_KEYS.HQ_CYAN]: 'assets/factions/cyan/buildings/hq_t1.png',

  [ASSET_KEYS.HARVESTER_CYAN]:
    'assets/factions/cyan/units/harvester_8x8_256.png',

  // @deprecated Resource paths — now in GENERATED_ASSET_MANIFEST.paths
  [ASSET_KEYS.MINERAL_SMALL]: 'assets/environment/mineral_small_02.png',
  [ASSET_KEYS.MINERAL_MEDIUM]: 'assets/environment/mineral_medium_02.png',
  [ASSET_KEYS.MINERAL_LARGE]: 'assets/environment/mineral_large_02.png',
};

/**
 * Spritesheet frame config for the 8×8 256px spritesheets.
 * Total sheet: 2048×2048. 8 rows (directions) × 8 columns (frames).
 */
export const SPRITESHEET_8X8_256 = {
  frameWidth: 256,
  frameHeight: 256,
  endFrame: 63, // 8×8 = 64 frames, 0-indexed
} as const;

/** Direction row index in 8×8 spritesheet. */
export const DIR_ROW = {
  E: 0,
  SE: 1,
  S: 2,
  SW: 3,
  W: 4,
  NW: 5,
  N: 6,
  NE: 7,
} as const;

/** Idle frame is column 0. */
export const IDLE_FRAME = 0;
