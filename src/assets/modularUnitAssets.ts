import Phaser from 'phaser';
import type { Faction } from '../state/types';

export const MODULAR_FACTIONS = ['cyan', 'green', 'yellow', 'purple'] as const;
export const MODULAR_DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export type ModularDirection = (typeof MODULAR_DIRECTIONS)[number];

export function getWaspHullKey(faction: Faction, dir: ModularDirection): string {
  return `wasp_m0_hull_${faction}_dir${dir}`;
}

export function getSmokyTurretKey(faction: Faction, dir: ModularDirection): string {
  return `smoky_m0_turret_${faction}_dir${dir}`;
}

export function getWaspHullPath(faction: Faction, dir: ModularDirection): string {
  return `assets/units/chassis/wasp_m0/${faction}/wasp_m0_hull_idle_dir${dir}_0.png`;
}

export function getSmokyTurretPath(faction: Faction, dir: ModularDirection): string {
  return `assets/units/weapons/smoky_m0/${faction}/smoky_m0_turret_idle_dir${dir}_0.png`;
}

export function loadModularUnitAssets(scene: Phaser.Scene): void {
  for (const faction of MODULAR_FACTIONS) {
    for (const dir of MODULAR_DIRECTIONS) {
      scene.load.image(getWaspHullKey(faction, dir), getWaspHullPath(faction, dir));
      scene.load.image(getSmokyTurretKey(faction, dir), getSmokyTurretPath(faction, dir));
    }
  }
}
