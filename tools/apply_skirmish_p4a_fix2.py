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


# matchState: preserve valid objects, add cheap runtime ensure path, normalize all separators.
path = 'src/state/matchState.ts'
text = read(path)
text = replace_once(
    text,
    "function normalizeTeamVision(\n  width: number,\n  height: number,\n  vision: VisionState | undefined,\n): VisionState {\n  return normalizeVisionForLoadedState(width, height, vision);\n}\n",
    "function hasValidVisionDimensions(width: number, height: number, vision: VisionState | undefined): vision is VisionState {\n"
    "  return !!vision\n"
    "    && Array.isArray(vision.explored)\n"
    "    && vision.explored.length === height\n"
    "    && vision.explored.every(row => Array.isArray(row) && row.length === width)\n"
    "    && Array.isArray(vision.visible)\n"
    "    && vision.visible.length === height\n"
    "    && vision.visible.every(row => Array.isArray(row) && row.length === width)\n"
    "    && typeof vision.dirty === 'boolean'\n"
    "    && typeof vision.revision === 'number';\n"
    "}\n\n"
    "function normalizeTeamVision(\n"
    "  width: number,\n"
    "  height: number,\n"
    "  vision: VisionState | undefined,\n"
    "): VisionState {\n"
    "  return hasValidVisionDimensions(width, height, vision)\n"
    "    ? vision\n"
    "    : normalizeVisionForLoadedState(width, height, vision);\n"
    "}\n",
    'vision preservation',
)
text = replace_once(
    text,
    "  const activeTeamIds = existing?.activeTeamIds?.filter(isTeamId) ?? [...TEAM_IDS];",
    "  const activeTeamIds = [...new Set(existing?.activeTeamIds?.filter(isTeamId) ?? TEAM_IDS)];",
    'active team dedupe',
)
text = replace_once(text, "  normalizeOwnership(state, humanTeamId);", "  normalizeOwnership(state, match);", 'ownership match')
text = replace_once(
    text,
    "/** Return the requested owner team, falling back to the human team for legacy data. */\nexport function getOwningTeam(",
    "/** Cheap runtime boundary: preserve object identity once the match is normalized. */\n"
    "export function ensureMatchState(state: GameState): MatchState {\n"
    "  const expectedHumanTeamId = teamIdForFaction(state.playerFaction);\n"
    "  const match = state.match;\n"
    "  if (!match || match.humanTeamId !== expectedHumanTeamId) return normalizeMatchState(state);\n"
    "  if (TEAM_IDS.some(teamId => !match.teams?.[teamId])) return normalizeMatchState(state);\n"
    "  const human = match.teams[match.humanTeamId];\n"
    "  if (state.economy !== human.economy || state.vision !== human.vision) {\n"
    "    return normalizeMatchState(state);\n"
    "  }\n"
    "  return match;\n"
    "}\n\n"
    "/** Return the requested owner team, falling back to the human team for legacy data. */\n"
    "export function getOwningTeam(",
    'ensure match insertion',
)
text = text.replace('  const match = normalizeMatchState(state);\n  const resolvedId', '  const match = ensureMatchState(state);\n  const resolvedId', 1)
text = text.replace('  const match = normalizeMatchState(state);\n  return match.teams[match.humanTeamId];', '  const match = ensureMatchState(state);\n  return match.teams[match.humanTeamId];', 1)
text = replace_once(
    text,
    "function normalizeOwnership(state: GameState, humanTeamId: TeamId): void {\n  state.mapData.hq.ownerTeamId ??= teamIdForFaction(state.mapData.hq.faction);",
    "function normalizeOwnership(state: GameState, match: MatchState): void {\n  const humanTeamId = match.humanTeamId;\n  state.mapData.hq.ownerTeamId ??= teamIdForFaction(state.mapData.hq.faction);",
    'ownership signature',
)
text = replace_once(
    text,
    "  for (const factory of state.production.factories) factory.ownerTeamId ??= humanTeamId;\n  for (const separator of state.economy.separators) separator.ownerTeamId ??= humanTeamId;",
    "  for (const factory of state.production.factories) factory.ownerTeamId ??= humanTeamId;\n"
    "  for (const teamId of TEAM_IDS) {\n"
    "    for (const separator of match.teams[teamId].economy.separators) {\n"
    "      separator.ownerTeamId ??= teamId;\n"
    "    }\n"
    "  }",
    'all separator owners',
)
write(path, text)

# Use cheap ensure path in hot/runtime modules.
for relative in ('src/state/production.ts', 'src/state/construction.ts', 'src/state/updateGameState.ts'):
    text = read(relative)
    text = text.replace("normalizeMatchState } from './matchState'", "ensureMatchState } from './matchState'")
    text = text.replace('normalizeMatchState(state)', 'ensureMatchState(state)')
    write(relative, text)

# Harvester must never fall back to another team's HQ; restore separator power release.
path = 'src/state/updateGameState.ts'
text = read(path)
text = replace_once(
    text,
    "    const owner = getOwningTeam(state, h.ownerTeamId, h.faction);\n    const ownerHq = owner.hqPosition ?? state.hqPosition;\n    const hqTx = ownerHq.tx;\n    const hqTy = ownerHq.ty;",
    "    const owner = getOwningTeam(state, h.ownerTeamId, h.faction);\n"
    "    if (!owner.hqPosition) {\n"
    "      h.blockedReason = 'no-path-to-hq';\n"
    "      return;\n"
    "    }\n"
    "    const hqTx = owner.hqPosition.tx;\n"
    "    const hqTy = owner.hqPosition.ty;",
    'owned hq only',
)
text = replace_once(
    text,
    "        economy.elements[owner.faction] += SEP_ELEMENT_YIELD;\n        separator.progress -= 1;\n      }\n    } else if (building.type === 'units-factory') {",
    "        economy.elements[owner.faction] += SEP_ELEMENT_YIELD;\n"
    "        separator.progress -= 1;\n"
    "      }\n"
    "      const stillHasResources =\n"
    "        economy.raw >= SEP_RAW_COST\n"
    "        && economy.matter + SEP_MATTER_YIELD <= economy.matterCap\n"
    "        && economy.elements[owner.faction] + SEP_ELEMENT_YIELD <= economy.elementCap;\n"
    "      if (separator.active && !stillHasResources) {\n"
    "        separator.active = false;\n"
    "        remainingPower.set(\n"
    "          ownerTeamId,\n"
    "          (remainingPower.get(ownerTeamId) ?? 0) + SEPARATOR_ACTIVE_POWER_CONSUMPTION,\n"
    "        );\n"
    "      }\n"
    "    } else if (building.type === 'units-factory') {",
    'separator release',
)
write(path, text)

# Human fog only consumes human-owned sources.
path = 'src/state/visibility.ts'
text = read(path)
text = replace_once(
    text,
    "import type { BuildingType, GameState } from './types';",
    "import type { BuildingType, Faction, GameState, TeamId } from './types';",
    'visibility team imports',
)
text = replace_once(
    text,
    "export function collectVisionSources(state: GameState): VisionSource[] {\n  const sources: VisionSource[] = [];",
    "export function collectVisionSources(state: GameState): VisionSource[] {\n"
    "  const sources: VisionSource[] = [];\n"
    "  const humanTeamId = state.match?.humanTeamId;\n"
    "  const isHumanOwned = (ownerTeamId?: TeamId, faction?: Faction): boolean => {\n"
    "    if (ownerTeamId && humanTeamId) return ownerTeamId === humanTeamId;\n"
    "    if (faction) return faction === state.playerFaction;\n"
    "    return true;\n"
    "  };",
    'vision owner helper',
)
text = replace_once(text, "  if (hq) {", "  if (hq && isHumanOwned(hq.ownerTeamId, hq.faction)) {", 'hq vision owner')
text = replace_once(text, "  for (const building of state.mapData.buildings) {\n    const radius", "  for (const building of state.mapData.buildings) {\n    if (!isHumanOwned(building.ownerTeamId)) continue;\n    const radius", 'building vision owner')
text = replace_once(text, "  for (const builder of state.mapData.builders) {\n    sources.push", "  for (const builder of state.mapData.builders) {\n    if (!isHumanOwned(builder.ownerTeamId)) continue;\n    sources.push", 'builder vision owner')
text = replace_once(text, "  for (const harvester of state.harvesters) {\n    sources.push", "  for (const harvester of state.harvesters) {\n    if (!isHumanOwned(harvester.ownerTeamId, harvester.faction)) continue;\n    sources.push", 'harvester vision owner')
text = replace_once(
    text,
    "  for (const unit of state.combatUnits) {\n    if (unit.faction !== state.playerFaction || unit.runtime?.isDestroyed) continue;",
    "  for (const unit of state.combatUnits) {\n"
    "    if (!isHumanOwned(unit.ownerTeamId, unit.faction) || unit.runtime?.isDestroyed) continue;",
    'combat vision owner',
)
write(path, text)

# Save every team, including eliminated/inactive records.
path = 'src/state/saveGame.ts'
text = read(path)
text = replace_once(
    text,
    "  for (const teamId of match.activeTeamIds) {\n    const team = match.teams[teamId];",
    "  for (const team of Object.values(match.teams)) {",
    'save all teams',
)
write(path, text)

# Cosmetic strict formatting.
path = 'src/state/types.ts'
text = read(path).replace(
    "  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction; ownerTeamId?: TeamId }> ;",
    "  extraHarvesters: Array<{ tx: number; ty: number; faction: Faction; ownerTeamId?: TeamId }> ;".replace('> ;', '>;'),
)
write(path, text)

# Extend focused tests for identity, fog ownership and missing foreign HQ.
path = 'src/__tests__/matchState.test.ts'
text = read(path)
text = replace_once(
    text,
    "import { createInitialState } from '../state/createInitialState';",
    "import { createInitialState } from '../state/createInitialState';\n"
    "import { collectVisionSources } from '../state/visibility';\n"
    "import { createHarvester, updateGameState } from '../state/updateGameState';",
    'test imports',
)
insert = r'''

  it('preserves normalized match and vision object identity during runtime updates', () => {
    const state = freshState();
    const match = state.match;
    const vision = state.vision;
    state.vision.dirty = false;
    updateGameState(state, 0);
    expect(state.match).toBe(match);
    expect(state.vision).toBe(vision);
    expect(state.vision.dirty).toBe(false);
  });

  it('does not expose foreign civil units as human fog vision sources', () => {
    const state = freshState();
    const foreign = createHarvester('green-scout', 20, 20, 'green', 'team-green');
    state.harvesters.push(foreign);
    const sources = collectVisionSources(state);
    expect(sources.some(source => source.sourceId === 'green-scout')).toBe(false);
  });

  it('blocks a foreign Harvester when its team has no Headquarters instead of using the human HQ', () => {
    const state = freshState();
    const foreign = createHarvester('green-returner', 20, 20, 'green', 'team-green');
    foreign.phase = 'returning-to-hq';
    foreign.cargoRaw = 10;
    state.harvesters.push(foreign);
    updateGameState(state, 16);
    expect(foreign.blockedReason).toBe('no-path-to-hq');
    expect(foreign.returnPath).toBeUndefined();
  });
'''
text = replace_once(text, "\n  it('assigns the human owner to legacy initial entities'", insert + "\n  it('assigns the human owner to legacy initial entities'", 'test insertion')
write(path, text)

print('SKIRMISH-P4A fix2 applied')
