import type { DecorCategory, DecorType } from '../state/types';

export interface MaplifeDecorConfig {
  type: DecorType;
  key: string;
  path: string;
  category: DecorCategory;
  footprint: 1 | 2 | 3;
  originY: number;
}

export const MAPLIFE_DECOR_CELL_SOURCE_PX = 256;

export const MAPLIFE_DECOR_CONFIG: Record<DecorType, MaplifeDecorConfig> = {
  env_rock_cluster_1x1: {
    type: 'env_rock_cluster_1x1',
    key: 'decor_env_rock_cluster_1x1',
    path: 'assets/environment/maplife/env_rock_cluster_1x1.png',
    category: 'prop',
    footprint: 1,
    originY: 0.94,
  },
  env_rock_cluster_2x2: {
    type: 'env_rock_cluster_2x2',
    key: 'decor_env_rock_cluster_2x2',
    path: 'assets/environment/maplife/env_rock_cluster_2x2.png',
    category: 'prop',
    footprint: 2,
    originY: 0.94,
  },
  env_rock_cluster_3x3: {
    type: 'env_rock_cluster_3x3',
    key: 'decor_env_rock_cluster_3x3',
    path: 'assets/environment/maplife/env_rock_cluster_3x3.png',
    category: 'prop',
    footprint: 3,
    originY: 0.94,
  },
  env_bush_dry_cluster_1x1: {
    type: 'env_bush_dry_cluster_1x1',
    key: 'decor_env_bush_dry_cluster_1x1',
    path: 'assets/environment/maplife/env_bush_dry_cluster_1x1.png',
    category: 'prop',
    footprint: 1,
    originY: 0.92,
  },
  env_bush_dry_cluster_2x2: {
    type: 'env_bush_dry_cluster_2x2',
    key: 'decor_env_bush_dry_cluster_2x2',
    path: 'assets/environment/maplife/env_bush_dry_cluster_2x2.png',
    category: 'prop',
    footprint: 2,
    originY: 0.92,
  },
  env_bush_dry_cluster_3x3: {
    type: 'env_bush_dry_cluster_3x3',
    key: 'decor_env_bush_dry_cluster_3x3',
    path: 'assets/environment/maplife/env_bush_dry_cluster_3x3.png',
    category: 'prop',
    footprint: 3,
    originY: 0.92,
  },
  env_sand_crack_patch_1x1: {
    type: 'env_sand_crack_patch_1x1',
    key: 'decor_env_sand_crack_patch_1x1',
    path: 'assets/environment/maplife/env_sand_crack_patch_1x1.png',
    category: 'decal',
    footprint: 1,
    originY: 0.5,
  },
  env_sand_crack_patch_2x2: {
    type: 'env_sand_crack_patch_2x2',
    key: 'decor_env_sand_crack_patch_2x2',
    path: 'assets/environment/maplife/env_sand_crack_patch_2x2.png',
    category: 'decal',
    footprint: 2,
    originY: 0.5,
  },
  env_sand_crack_patch_3x3: {
    type: 'env_sand_crack_patch_3x3',
    key: 'decor_env_sand_crack_patch_3x3',
    path: 'assets/environment/maplife/env_sand_crack_patch_3x3.png',
    category: 'decal',
    footprint: 3,
    originY: 0.5,
  },
  env_sand_bump_patch_1x1: {
    type: 'env_sand_bump_patch_1x1',
    key: 'decor_env_sand_bump_patch_1x1',
    path: 'assets/environment/maplife/env_sand_bump_patch_1x1.png',
    category: 'decal',
    footprint: 1,
    originY: 0.58,
  },
  env_sand_bump_patch_2x2: {
    type: 'env_sand_bump_patch_2x2',
    key: 'decor_env_sand_bump_patch_2x2',
    path: 'assets/environment/maplife/env_sand_bump_patch_2x2.png',
    category: 'decal',
    footprint: 2,
    originY: 0.58,
  },
  env_sand_bump_patch_3x3: {
    type: 'env_sand_bump_patch_3x3',
    key: 'decor_env_sand_bump_patch_3x3',
    path: 'assets/environment/maplife/env_sand_bump_patch_3x3.png',
    category: 'decal',
    footprint: 3,
    originY: 0.58,
  },
};

export const MAPLIFE_DECOR_TYPES = Object.keys(MAPLIFE_DECOR_CONFIG) as DecorType[];

export function getMaplifeDecorConfig(type: DecorType): MaplifeDecorConfig {
  return MAPLIFE_DECOR_CONFIG[type];
}
