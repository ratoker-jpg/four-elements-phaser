/**
 * T1 modular production component catalog.
 *
 * This is the single source of truth for the first playable hull/turret costs
 * and production durations. It has no state or Phaser imports, so both state
 * compatibility aliases and production logic can consume it safely.
 */

export type T1ProductionBodyId = 'wasp' | 'hunter';
export type T1ProductionWeaponId = 'smoky' | 'railgun';
export type T1ProductionModLevel = 'm0' | 'm1' | 'm2' | 'm3';

export interface T1ProductionComponentSpec<Id extends string> {
  id: Id;
  displayNameRu: string;
  matterCost: number;
  elementCost: number;
  productionDurationMs: number;
}

export interface T1CombatProductionSelection {
  bodyId: string;
  weaponId: string;
  hullMod?: string;
  turretMod?: string;
}

export interface T1CombatProductionQuote {
  bodyId: T1ProductionBodyId;
  weaponId: T1ProductionWeaponId;
  hullMod: T1ProductionModLevel;
  turretMod: T1ProductionModLevel;
  bodyLabelRu: string;
  weaponLabelRu: string;
  displayNameRu: string;
  matterCost: number;
  elementCost: number;
  durationMs: number;
}

export const T1_ASSEMBLY_OFFSET_MS = 7_000;

export const T1_BODY_COMPONENTS: Readonly<Record<T1ProductionBodyId, T1ProductionComponentSpec<T1ProductionBodyId>>> = {
  wasp: {
    id: 'wasp',
    displayNameRu: 'Васп',
    matterCost: 20,
    elementCost: 5,
    productionDurationMs: 7_000,
  },
  hunter: {
    id: 'hunter',
    displayNameRu: 'Хантер',
    matterCost: 35,
    elementCost: 7,
    productionDurationMs: 12_000,
  },
};

export const T1_WEAPON_COMPONENTS: Readonly<Record<T1ProductionWeaponId, T1ProductionComponentSpec<T1ProductionWeaponId>>> = {
  smoky: {
    id: 'smoky',
    displayNameRu: 'Смоки',
    matterCost: 25,
    elementCost: 5,
    productionDurationMs: 18_000,
  },
  railgun: {
    id: 'railgun',
    displayNameRu: 'Рельса',
    matterCost: 45,
    elementCost: 8,
    productionDurationMs: 25_000,
  },
};

const MOD_LEVELS = new Set<string>(['m0', 'm1', 'm2', 'm3']);

export function isT1ProductionBodyId(value: string): value is T1ProductionBodyId {
  return Object.prototype.hasOwnProperty.call(T1_BODY_COMPONENTS, value);
}

export function isT1ProductionWeaponId(value: string): value is T1ProductionWeaponId {
  return Object.prototype.hasOwnProperty.call(T1_WEAPON_COMPONENTS, value);
}

export function isT1ProductionModLevel(value: string): value is T1ProductionModLevel {
  return MOD_LEVELS.has(value);
}

/**
 * Compose a legal T1 quote from independent hull and turret selections.
 * Missing modification fields migrate to M0. Explicit invalid values reject.
 */
export function getT1CombatProductionQuote(
  selection: T1CombatProductionSelection,
): T1CombatProductionQuote | null {
  if (!isT1ProductionBodyId(selection.bodyId) || !isT1ProductionWeaponId(selection.weaponId)) {
    return null;
  }

  const hullMod = selection.hullMod ?? 'm0';
  const turretMod = selection.turretMod ?? 'm0';
  if (!isT1ProductionModLevel(hullMod) || !isT1ProductionModLevel(turretMod)) {
    return null;
  }

  const body = T1_BODY_COMPONENTS[selection.bodyId];
  const weapon = T1_WEAPON_COMPONENTS[selection.weaponId];
  return {
    bodyId: body.id,
    weaponId: weapon.id,
    hullMod,
    turretMod,
    bodyLabelRu: body.displayNameRu,
    weaponLabelRu: weapon.displayNameRu,
    displayNameRu: `${body.displayNameRu} + ${weapon.displayNameRu}`,
    matterCost: body.matterCost + weapon.matterCost,
    elementCost: body.elementCost + weapon.elementCost,
    durationMs: Math.max(body.productionDurationMs, weapon.productionDurationMs) + T1_ASSEMBLY_OFFSET_MS,
  };
}

export const T1_LEGAL_COMBINATIONS: readonly Readonly<{
  bodyId: T1ProductionBodyId;
  weaponId: T1ProductionWeaponId;
}>[] = [
  { bodyId: 'wasp', weaponId: 'smoky' },
  { bodyId: 'hunter', weaponId: 'smoky' },
  { bodyId: 'wasp', weaponId: 'railgun' },
  { bodyId: 'hunter', weaponId: 'railgun' },
];
