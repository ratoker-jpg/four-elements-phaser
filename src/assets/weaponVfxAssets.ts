import Phaser from 'phaser';

/**
 * Small runtime-approved weapon VFX subset imported from godot-tank-arena.
 *
 * The donor project contains hundreds of megabytes of assets. Only the
 * alpha-processed LeLu textures used by the Phaser renderer are listed here.
 */
export const WEAPON_VFX_ASSET_KEYS = {
  MUZZLE_FLARE: 'vfx_donor_muzzle_flare',
  IMPACT_SPARK: 'vfx_donor_impact_spark',
  EXPLOSION: 'vfx_donor_explosion',
  ENERGY_GLOW: 'vfx_donor_energy_glow',
  ENERGY_HIT: 'vfx_donor_energy_hit',
  FIRE_STREAM: 'vfx_donor_fire_stream',
  ROUND_SMOKE: 'vfx_donor_round_smoke',
  TRAIL: 'vfx_donor_trail',
  CLOUD_NOISE: 'vfx_donor_cloud_noise',
  HAMMER_BLAST: 'vfx_donor_hammer_blast',
} as const;

export type WeaponVfxAssetKey =
  (typeof WEAPON_VFX_ASSET_KEYS)[keyof typeof WEAPON_VFX_ASSET_KEYS];

export const WEAPON_VFX_ASSET_PATHS: Record<WeaponVfxAssetKey, string> = {
  [WEAPON_VFX_ASSET_KEYS.MUZZLE_FLARE]: 'assets/vfx/donor/T_flare8_vfx_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.IMPACT_SPARK]: 'assets/vfx/donor/T_VFX_spark44_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.EXPLOSION]: 'assets/vfx/donor/T_VFX_exp_dissapear_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.ENERGY_GLOW]: 'assets/vfx/donor/T_VFX_Glo31_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.ENERGY_HIT]: 'assets/vfx/donor/T_VFX_hit22_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.FIRE_STREAM]: 'assets/vfx/donor/T_FirePanningCyl45_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.ROUND_SMOKE]: 'assets/vfx/donor/T_VFX_RoundSmoke71_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.TRAIL]: 'assets/vfx/donor/T_trail12_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.CLOUD_NOISE]: 'assets/vfx/donor/T_CloudNoise_Tiled_alpha.png',
  [WEAPON_VFX_ASSET_KEYS.HAMMER_BLAST]: 'assets/vfx/donor/T_BlastUi6_alpha.png',
};

/** Load the compact donor VFX set during the normal preload pass. */
export function loadWeaponVfxAssets(scene: Phaser.Scene): WeaponVfxAssetKey[] {
  const loaded: WeaponVfxAssetKey[] = [];
  for (const [key, path] of Object.entries(WEAPON_VFX_ASSET_PATHS) as Array<
    [WeaponVfxAssetKey, string]
  >) {
    scene.load.image(key, path);
    loaded.push(key);
  }
  return loaded;
}

export function isWeaponVfxAssetKey(value: string): value is WeaponVfxAssetKey {
  return Object.prototype.hasOwnProperty.call(WEAPON_VFX_ASSET_PATHS, value);
}
