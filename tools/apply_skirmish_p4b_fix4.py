from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'{label}: marker not found')
    return text.replace(old, new, 1)


# Construction completion must never return false after mutating building/economy.
path = 'src/state/construction.ts'
text = read(path)
text = replace_once(
    text,
    "      const builder = state.mapData.builders[bi];\n      if (resolveEntityTeamId(state, builder) !== resolveEntityTeamId(state, site)) {\n        return { completed: false };\n      }\n      builder.busy = false;",
    "      const builder = state.mapData.builders[bi];\n      builder.busy = false;",
    'post-completion release guard',
)
write(path, text)


path = 'src/state/statusHelpers.ts'
text = read(path)
text = replace_once(
    text,
    "  HarvesterState,\n} from './types';",
    "  HarvesterState,\n  TeamId,\n} from './types';",
    'status team type import',
)
text = text.replace("  DEFAULT_UNIT_CAP,\n", '')
text = replace_once(
    text,
    "import { getProductionQuote, type ProductionRequestInput } from './production';",
    "import { getProductionQuote, type ProductionRequestInput } from './production';\n"
    "import { ensureMatchState, getOwningTeam } from './matchState';\n"
    "import { isHumanOwned, resolveEntityTeamId } from './teamOwnership';",
    'status ownership imports',
)

# Separator status owner economy.
text = replace_once(
    text,
    "  const faction = state.playerFaction;\n\n  // Check raw availability\n  if (state.economy.raw < SEP_RAW_COST)",
    "  const owner = getOwningTeam(state, sep.ownerTeamId);\n"
    "  const economy = owner.economy;\n"
    "  const faction = owner.faction;\n\n"
    "  // Check raw availability\n"
    "  if (economy.raw < SEP_RAW_COST)",
    'separator owner economy',
)
text = text.replace('state.economy.matter + SEP_MATTER_YIELD > state.economy.matterCap', 'economy.matter + SEP_MATTER_YIELD > economy.matterCap', 1)
text = text.replace('state.economy.elements[faction] + SEP_ELEMENT_YIELD > state.economy.elementCap', 'economy.elements[faction] + SEP_ELEMENT_YIELD > economy.elementCap', 1)
text = replace_once(
    text,
    "    state, 'separator', sep.tx, sep.ty,\n  );",
    "    state, 'separator', sep.tx, sep.ty, owner.id,\n  );",
    'separator power owner',
)

# Factory status owner economy and cap.
text = replace_once(
    text,
    "): FactoryStatus {\n  // Check if currently producing",
    "): FactoryStatus {\n  const owner = getOwningTeam(state, factory.ownerTeamId);\n\n  // Check if currently producing",
    'factory status owner',
)
text = text.replace('if (state.economy.matter < quote.matterCost)', 'if (owner.economy.matter < quote.matterCost)', 1)
text = text.replace('if (state.economy.elements[state.playerFaction] < quote.elementCost)', 'if (owner.economy.elements[owner.faction] < quote.elementCost)', 1)
text = replace_once(text, 'if (getUnitCount(state) >= getUnitCap(state)) {', 'if (getUnitCount(state, owner.id) >= getUnitCap(state, owner.id)) {', 'factory status cap')

# Spawn blockage owner cap.
text = replace_once(
    text,
    "  // Check 1: Unit cap\n  if (getUnitCount(state) >= getUnitCap(state)) {",
    "  // Check 1: Unit cap\n"
    "  const owner = getOwningTeam(state, factory.ownerTeamId);\n"
    "  if (getUnitCount(state, owner.id) >= getUnitCap(state, owner.id)) {",
    'spawn block owner cap',
)

# Player build buttons only look at human workers/economy.
text = replace_once(
    text,
    "  // Check for idle builder\n  const hasIdleBuilder = state.mapData.builders.some(\n    b => b.phase === 'idle' && !b.busy,\n  );",
    "  const human = getOwningTeam(state);\n\n"
    "  // Check for an idle human-owned builder.\n"
    "  const hasIdleBuilder = state.mapData.builders.some(\n"
    "    builder => isHumanOwned(state, builder) && builder.phase === 'idle' && !builder.busy,\n"
    "  );",
    'build block human builder',
)
text = replace_once(
    text,
    "  if (config && state.economy.matter < config.costMatter) {",
    "  if (config && human.economy.matter < config.costMatter) {",
    'build block human economy',
)

# Production buttons only use human factories/economy.
text = replace_once(
    text,
    "  const factories = factoryTarget\n    ? state.production.factories.filter(factory => factory.tx === factoryTarget.tx && factory.ty === factoryTarget.ty)\n    : state.production.factories;",
    "  const human = getOwningTeam(state);\n"
    "  const factories = state.production.factories.filter(factory =>\n"
    "    isHumanOwned(state, factory)\n"
    "    && (!factoryTarget || (factory.tx === factoryTarget.tx && factory.ty === factoryTarget.ty)),\n"
    "  );",
    'production block human factories',
)
text = text.replace('if (state.economy.matter < quote.matterCost)', 'if (human.economy.matter < quote.matterCost)', 1)
text = text.replace('if (state.economy.elements[state.playerFaction] < quote.elementCost)', 'if (human.economy.elements[human.faction] < quote.elementCost)', 1)
text = replace_once(text, 'if (getUnitCount(state) >= getUnitCap(state)) {', 'if (getUnitCount(state, human.id) >= getUnitCap(state, human.id)) {', 'production block human cap')

# Unit count/cap owner-aware.
old_helpers = """/** Count current player civil units (builders + harvesters + combat units). */
export function getUnitCount(state: GameState): number {
  return state.mapData.builders.length + state.harvesters.length + (state.combatUnits?.length ?? 0);
}

/** Get the current unit cap for the player. Sandbox MVP: fixed DEFAULT_UNIT_CAP. */
export function getUnitCap(state: GameState): number {
  // Sandbox MVP: fixed cap. Future: command-relay buildings may add to cap.
  void state; // used for future building-based cap
  return DEFAULT_UNIT_CAP;
}"""
new_helpers = """/** Count civil and combat units owned by one team. Defaults to the human team. */
export function getUnitCount(state: GameState, ownerTeamId?: TeamId): number {
  const match = ensureMatchState(state);
  const resolvedOwnerTeamId = ownerTeamId ?? match.humanTeamId;
  return state.mapData.builders.filter(unit => resolveEntityTeamId(state, unit) === resolvedOwnerTeamId).length
    + state.harvesters.filter(unit => resolveEntityTeamId(state, unit) === resolvedOwnerTeamId).length
    + (state.combatUnits?.filter(unit => resolveEntityTeamId(state, unit) === resolvedOwnerTeamId).length ?? 0);
}

/** Get the configured unit cap for one team. Defaults to the human team. */
export function getUnitCap(state: GameState, ownerTeamId?: TeamId): number {
  const match = ensureMatchState(state);
  const resolvedOwnerTeamId = ownerTeamId ?? match.humanTeamId;
  return match.teams[resolvedOwnerTeamId].unitCap;
}"""
text = replace_once(text, old_helpers, new_helpers, 'owner unit helpers')

# Power selector owner-aware.
text = replace_once(
    text,
    "  buildingTy: number,\n): boolean {\n  let remainingPower = HQ_BASE_POWER +\n    state.mapData.buildings.filter(b => b.type === 'power-plant').length * POWER_PLANT_GENERATION;",
    "  buildingTy: number,\n"
    "  ownerTeamId: TeamId,\n"
    "): boolean {\n"
    "  const owner = getOwningTeam(state, ownerTeamId);\n"
    "  let remainingPower = (owner.hqPosition ? HQ_BASE_POWER : 0)\n"
    "    + state.mapData.buildings.filter(building =>\n"
    "      resolveEntityTeamId(state, building) === owner.id && building.type === 'power-plant',\n"
    "    ).length * POWER_PLANT_GENERATION;",
    'power selector signature',
)
text = replace_once(
    text,
    "  const separatorMap = new Map<string, typeof state.economy.separators[0]>();\n  for (const sep of state.economy.separators) {",
    "  const separatorMap = new Map<string, typeof owner.economy.separators[0]>();\n"
    "  for (const sep of owner.economy.separators) {",
    'power separator map owner',
)
text = replace_once(
    text,
    "  for (const factory of state.production.factories) {\n    factoryMap.set(`${factory.tx},${factory.ty}`, factory);",
    "  for (const factory of state.production.factories) {\n"
    "    if (resolveEntityTeamId(state, factory) !== owner.id) continue;\n"
    "    factoryMap.set(`${factory.tx},${factory.ty}`, factory);",
    'power factory map owner',
)
text = replace_once(
    text,
    "  for (const building of state.mapData.buildings) {\n    const key",
    "  for (const building of state.mapData.buildings) {\n"
    "    if (resolveEntityTeamId(state, building) !== owner.id) continue;\n"
    "    const key",
    'power building owner filter',
)
text = text.replace('state.economy.raw >= SEP_RAW_COST', 'owner.economy.raw >= SEP_RAW_COST', 1)
text = text.replace('state.economy.matter + SEP_MATTER_YIELD <= state.economy.matterCap', 'owner.economy.matter + SEP_MATTER_YIELD <= owner.economy.matterCap', 1)
text = text.replace('state.economy.elements[state.playerFaction] + SEP_ELEMENT_YIELD <= state.economy.elementCap', 'owner.economy.elements[owner.faction] + SEP_ELEMENT_YIELD <= owner.economy.elementCap', 1)
write(path, text)


# Add selector contracts to owner-aware tests.
path = 'src/__tests__/ownerAwareControl.test.ts'
test = read(path)
test = replace_once(
    test,
    "import { issueManualMove, stopUnitCommand } from '../state/unitCommands';",
    "import { issueManualMove, stopUnitCommand } from '../state/unitCommands';\n"
    "import {\n"
    "  getBuildBlockReason,\n"
    "  getFactoryStatus,\n"
    "  getProductionBlockReason,\n"
    "  getUnitCount,\n"
    "} from '../state/statusHelpers';",
    'selector test imports',
)
marker = "  it('assigns pending construction only to a Builder owned by the site team', () => {"
insert = """  it('keeps build and production button state aligned with human ownership', () => {
    const state = makeState();
    state.mapData.builders[0].busy = true;
    state.mapData.builders[0].phase = 'building';
    state.match!.teams['team-cyan'].economy.matter = 0;
    state.match!.teams['team-cyan'].economy.elements.cyan = 0;
    state.match!.teams['team-green'].economy.matter = 500;
    state.match!.teams['team-green'].economy.elements.green = 500;

    expect(getBuildBlockReason(state, 'separator')).toBe('no-idle-builder');

    const humanFactory = state.production.factories[0];
    expect(getProductionBlockReason(state, 'builder', { tx: humanFactory.tx, ty: humanFactory.ty }))
      .toBe('insufficient-matter');

    state.production.factories = state.production.factories.filter(factory => factory.ownerTeamId === 'team-green');
    expect(getProductionBlockReason(state, 'builder')).toBe('no-factory');
    expect(getFactoryStatus(state, state.production.factories[0], 'builder')).toBe('idle');
  });

  it('counts unit cap usage independently for each team', () => {
    const state = makeState();
    expect(getUnitCount(state, 'team-cyan')).toBe(3);
    expect(getUnitCount(state, 'team-green')).toBe(3);
  });

"""
if marker not in test:
    raise RuntimeError('selector tests insertion marker not found')
test = test.replace(marker, insert + marker, 1)
write(path, test)

print('SKIRMISH-P4B fix4 applied')
