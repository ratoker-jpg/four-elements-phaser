from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding='utf-8')
    if old not in text:
        if new in text:
            return
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/phaser/ui/hud/commandPanelViewModel.ts',
    "import type { GameState, BuildingType, ProducibleUnitType } from '../../../state/types';",
    "import { QUEUE_LIMIT, type GameState, type BuildingType, type ProducibleUnitType } from '../../../state/types';",
)
replace_once(
    'src/phaser/ui/hud/commandPanelViewModel.ts',
    "import { DEFAULT_FACTORY_COMPOSER_STATE, createFactoryComposerRequest, formatProductionDuration, getFactoryComposerQuote, getQueueItemDisplayName } from '../../../state/factoryComposer';",
    "import { DEFAULT_FACTORY_COMPOSER_STATE, createFactoryComposerRequest, formatProductionDuration, getFactoryComposerQuote, getQueueItemDisplayName } from '../../../state/factoryComposer';\nimport { T1_BODY_COMPONENTS, T1_WEAPON_COMPONENTS } from '../../../config/t1ProductionComponents';",
)
replace_once(
    'src/phaser/ui/hud/commandPanelViewModel.ts',
    """  component('Q', 'factory-body-wasp', 'Васп', composer.bodyId === 'wasp', '20 M · 5 E');
  component('W', 'factory-body-hunter', 'Хантер', composer.bodyId === 'hunter', '35 M · 7 E');
  component('A', 'factory-weapon-smoky', 'Смоки', composer.weaponId === 'smoky', '25 M · 5 E');
  component('S', 'factory-weapon-railgun', 'Рельса', composer.weaponId === 'railgun', '45 M · 8 E');
""",
    """  const componentCost = (matter: number, element: number) => `${matter} M · ${element} E`;
  component('Q', 'factory-body-wasp', T1_BODY_COMPONENTS.wasp.displayNameRu, composer.bodyId === 'wasp', componentCost(T1_BODY_COMPONENTS.wasp.matterCost, T1_BODY_COMPONENTS.wasp.elementCost));
  component('W', 'factory-body-hunter', T1_BODY_COMPONENTS.hunter.displayNameRu, composer.bodyId === 'hunter', componentCost(T1_BODY_COMPONENTS.hunter.matterCost, T1_BODY_COMPONENTS.hunter.elementCost));
  component('A', 'factory-weapon-smoky', T1_WEAPON_COMPONENTS.smoky.displayNameRu, composer.weaponId === 'smoky', componentCost(T1_WEAPON_COMPONENTS.smoky.matterCost, T1_WEAPON_COMPONENTS.smoky.elementCost));
  component('S', 'factory-weapon-railgun', T1_WEAPON_COMPONENTS.railgun.displayNameRu, composer.weaponId === 'railgun', componentCost(T1_WEAPON_COMPONENTS.railgun.matterCost, T1_WEAPON_COMPONENTS.railgun.elementCost));
""",
)
replace_once(
    'src/phaser/ui/hud/commandPanelViewModel.ts',
    "return `Фабрика · ${quote.displayNameRu} · очередь ${queue.length}/2${active}`;",
    "return `Фабрика · ${quote.displayNameRu} · очередь ${queue.length}/${QUEUE_LIMIT}${active}`;",
)
replace_once(
    'src/phaser/ui/hud/selectionViewModel.ts',
    "import type { GameState, BuilderPlacement, HarvesterState } from '../../../state/types';",
    "import { QUEUE_LIMIT, type GameState, type BuilderPlacement, type HarvesterState } from '../../../state/types';",
)
replace_once(
    'src/phaser/ui/hud/selectionViewModel.ts',
    "? `Очередь: ${factory?.queue.length ?? 0}/2`",
    "? `Очередь: ${factory?.queue.length ?? 0}/${QUEUE_LIMIT}`",
)

input_path = ROOT / 'src/phaser/input/GameInputController.ts'
text = input_path.read_text(encoding='utf-8')
old = """    console.info(`[GameScene] ${quote.displayNameRu} queue failed: ${result.reason}`);
    return { success: false, message: result.reason };
  }

  private getSelectedFactory"""
new = """    console.info(`[GameScene] ${quote.displayNameRu} queue failed: ${result.reason}`);
    return { success: false, message: this.getProductionFailureMessage(result.reason) };
  }

  private getProductionFailureMessage(reason: string): string {
    const messages: Record<string, string> = {
      'factory-not-found': 'Фабрика не найдена',
      'queue-full': 'Очередь фабрики заполнена',
      'insufficient-matter': 'Недостаточно материи',
      'insufficient-element': 'Недостаточно элементов фракции',
      'unit-cap-reached': 'Достигнут лимит юнитов',
      'unsupported-unit-type': 'Недоступная комбинация',
    };
    return messages[reason] ?? reason;
  }

  private getSelectedFactory"""
if old not in text:
    if new not in text:
        raise SystemExit('production failure message anchor not found')
else:
    text = text.replace(old, new, 1)
input_path.write_text(text, encoding='utf-8')
