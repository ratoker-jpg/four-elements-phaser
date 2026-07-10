import type { GameState } from '../../../state/types';
import type { UnitSelection } from '../../../state/unitSelection';
import { getPrimarySelection } from '../../../state/unitSelection';
import {
  DEFAULT_FACTORY_COMPOSER_STATE,
  getFactoryComposerQuote,
  type FactoryComposerState,
} from '../../../state/factoryComposer';
import {
  getGeneratedHullAssetPath,
  resolveGeneratedHullFaction,
  type GeneratedHullDir16Index,
} from '../../../assets/generatedHullAssets';
import {
  getGeneratedTurretAssetPath,
  weaponIdToTurretId,
  type GeneratedTurretDir16Index,
} from '../../../assets/generatedTurretAssets';

/** Fixed three-quarter preview direction: SE. */
export const FACTORY_PREVIEW_DIR16 = 2 as GeneratedHullDir16Index & GeneratedTurretDir16Index;

export interface FactoryComposerPreviewViewModel {
  visible: boolean;
  hullSrc: string;
  turretSrc: string;
  label: string;
  alt: string;
}

export const EMPTY_FACTORY_COMPOSER_PREVIEW: Readonly<FactoryComposerPreviewViewModel> = {
  visible: false,
  hullSrc: '',
  turretSrc: '',
  label: '',
  alt: '',
};

/**
 * Resolve exactly two independent PNG layers for the selected T1 composition.
 * No combined hull×turret asset path is generated or cached.
 */
export function buildFactoryComposerPreviewViewModel(
  state: GameState,
  selection: UnitSelection,
  composer: FactoryComposerState = DEFAULT_FACTORY_COMPOSER_STATE,
): FactoryComposerPreviewViewModel {
  const primary = getPrimarySelection(selection);
  if (!primary || primary.kind !== 'building' || primary.buildingType !== 'units-factory') {
    return { ...EMPTY_FACTORY_COMPOSER_PREVIEW };
  }

  const quote = getFactoryComposerQuote(composer);
  const turretId = weaponIdToTurretId(quote.weaponId);
  if (!turretId) return { ...EMPTY_FACTORY_COMPOSER_PREVIEW };

  const faction = resolveGeneratedHullFaction(state.playerFaction);
  return {
    visible: true,
    hullSrc: getGeneratedHullAssetPath(quote.bodyId, faction, quote.hullMod, FACTORY_PREVIEW_DIR16),
    turretSrc: getGeneratedTurretAssetPath(turretId, faction, quote.turretMod, FACTORY_PREVIEW_DIR16),
    label: quote.displayNameRu,
    alt: `Предпросмотр: ${quote.displayNameRu}`,
  };
}
