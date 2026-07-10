import type { ProductionQueueItem, UnitProductionRequest } from './types';
import {
  getT1CombatProductionQuote,
  type T1CombatProductionQuote,
  type T1ProductionBodyId,
  type T1ProductionWeaponId,
} from '../config/t1ProductionComponents';
import { getProductionQuote } from './production';

export interface FactoryComposerState {
  bodyId: T1ProductionBodyId;
  weaponId: T1ProductionWeaponId;
}

export type FactoryComposerCommandId =
  | 'factory-body-wasp'
  | 'factory-body-hunter'
  | 'factory-weapon-smoky'
  | 'factory-weapon-railgun';

export const DEFAULT_FACTORY_COMPOSER_STATE: Readonly<FactoryComposerState> = {
  bodyId: 'wasp',
  weaponId: 'smoky',
};

export function reduceFactoryComposer(
  current: FactoryComposerState,
  commandId: FactoryComposerCommandId,
): FactoryComposerState {
  switch (commandId) {
    case 'factory-body-wasp': return { ...current, bodyId: 'wasp' };
    case 'factory-body-hunter': return { ...current, bodyId: 'hunter' };
    case 'factory-weapon-smoky': return { ...current, weaponId: 'smoky' };
    case 'factory-weapon-railgun': return { ...current, weaponId: 'railgun' };
  }
}

export function createFactoryComposerRequest(
  composer: FactoryComposerState,
): Extract<UnitProductionRequest, { kind: 'combat' }> {
  return {
    kind: 'combat',
    bodyId: composer.bodyId,
    weaponId: composer.weaponId,
    hullMod: 'm0',
    turretMod: 'm0',
  };
}

export function getFactoryComposerQuote(
  composer: FactoryComposerState,
): T1CombatProductionQuote {
  const quote = getT1CombatProductionQuote(createFactoryComposerRequest(composer));
  if (!quote) throw new Error('Factory composer produced an invalid T1 selection');
  return quote;
}

export function formatProductionDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${seconds} с`;
}

export function getQueueItemDisplayName(item: ProductionQueueItem): string {
  return getProductionQuote(item.request ?? item.unitType)?.displayNameRu ?? item.unitType;
}
