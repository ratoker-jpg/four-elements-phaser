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


path = 'src/state/construction.ts'
text = read(path)
text = replace_once(
    text,
    "): PlacementResult {\n  ensureMatchState(state);\n  const owner = getOwningTeam(state, ownerTeamId);\n\n  // 1. Unknown building type\n  const config = BUILDING_CONFIG[buildingType];",
    "): PlacementResult {\n  // 1. Unknown building type\n  const config = BUILDING_CONFIG[buildingType];",
    'construction early normalization',
)
text = replace_once(
    text,
    "  if (isVisualReadyBuilding(buildingType)) {\n    return { valid: false, reason: 'not-buildable' };\n  }\n\n  // 2. Out of bounds",
    "  if (isVisualReadyBuilding(buildingType)) {\n    return { valid: false, reason: 'not-buildable' };\n  }\n\n  const owner = getOwningTeam(state, ownerTeamId);\n\n  // 2. Out of bounds",
    'construction delayed owner',
)
text = replace_once(
    text,
    "  // Validate first — no mutation on failure\n  const match = ensureMatchState(state);\n  const resolvedOwnerTeamId = ownerTeamId ?? match.humanTeamId;\n  const owner = match.teams[resolvedOwnerTeamId];\n  const validation = canPlaceBuilding(state, buildingType, tx, ty, resolvedOwnerTeamId);\n  if (!validation.valid) {\n    return { ok: false, reason: validation.reason };\n  }\n\n  const config",
    "  // Validate first — rejected commands must not normalize or mutate state.\n  const validation = canPlaceBuilding(state, buildingType, tx, ty, ownerTeamId);\n  if (!validation.valid) {\n    return { ok: false, reason: validation.reason };\n  }\n\n  const match = ensureMatchState(state);\n  const resolvedOwnerTeamId = ownerTeamId ?? match.humanTeamId;\n  const owner = match.teams[resolvedOwnerTeamId];\n  const config",
    'placement validation order',
)
write(path, text)

path = 'src/state/matchState.ts'
text = read(path)
text = replace_once(
    text,
    "export function factionForTeamId(teamId: TeamId): Faction {\n  return TEAM_FACTIONS[teamId];\n}\n\nfunction createBaselineTeamEconomy",
    "export function factionForTeamId(teamId: TeamId): Faction {\n  return TEAM_FACTIONS[teamId];\n}\n\n"
    "function isFaction(value: unknown): value is Faction {\n"
    "  return value === 'cyan' || value === 'green' || value === 'yellow' || value === 'purple';\n"
    "}\n\n"
    "function resolveHumanFaction(state: GameState): Faction {\n"
    "  if (isFaction(state.playerFaction)) return state.playerFaction;\n"
    "  const hqFaction = state.mapData?.hq?.faction;\n"
    "  return isFaction(hqFaction) ? hqFaction : 'cyan';\n"
    "}\n\n"
    "function createBaselineTeamEconomy",
    'faction fallback helpers',
)
text = replace_once(
    text,
    "function hasValidVisionDimensions",
    "function ensureEconomyShape(economy: EconomyState | undefined): EconomyState {\n"
    "  const target = economy ?? createBaselineTeamEconomy();\n"
    "  target.raw ??= 0;\n"
    "  target.matter ??= 0;\n"
    "  target.elements ??= { cyan: 0, green: 0, yellow: 0, purple: 0 };\n"
    "  target.powerGenerated ??= 0;\n"
    "  target.powerConsumed ??= 0;\n"
    "  target.separators ??= [];\n"
    "  target.rawCap ??= HQ_RAW_CAP;\n"
    "  target.matterCap ??= HQ_MATTER_CAP;\n"
    "  target.elementCap ??= HQ_ELEMENT_CAP;\n"
    "  return target;\n"
    "}\n\n"
    "function hasValidVisionDimensions",
    'economy normalization helper',
)
text = replace_once(
    text,
    "  const mapWidth = state.mapWidth ?? state.mapData?.width ?? 48;\n  const mapHeight = state.mapHeight ?? state.mapData?.height ?? 48;\n  const humanTeamId = teamIdForFaction(state.playerFaction);",
    "  const mapWidth = state.mapWidth ?? state.mapData?.width ?? 48;\n"
    "  const mapHeight = state.mapHeight ?? state.mapData?.height ?? 48;\n"
    "  const humanFaction = resolveHumanFaction(state);\n"
    "  state.playerFaction = humanFaction;\n"
    "  const humanTeamId = teamIdForFaction(humanFaction);\n"
    "  const legacyHumanHqPosition = state.hqPosition ?? (state.mapData?.hq\n"
    "    ? { tx: state.mapData.hq.tx + 1, ty: state.mapData.hq.ty + 1 }\n"
    "    : null);",
    'normalize faction and hq',
)
text = replace_once(
    text,
    "    const economy = current?.economy ?? (isHuman ? state.economy : createBaselineTeamEconomy());",
    "    const economy = ensureEconomyShape(\n"
    "      current?.economy ?? (isHuman ? state.economy : createBaselineTeamEconomy()),\n"
    "    );",
    'normalize economy use',
)
text = replace_once(
    text,
    "      hqPosition: isHuman\n        ? (current?.hqPosition ?? { ...state.hqPosition })\n        : (current?.hqPosition ?? null),",
    "      hqPosition: isHuman\n        ? (current?.hqPosition ?? legacyHumanHqPosition)\n        : (current?.hqPosition ?? null),",
    'safe hq position',
)
text = replace_once(
    text,
    "  const expectedHumanTeamId = teamIdForFaction(state.playerFaction);",
    "  const expectedHumanTeamId = teamIdForFaction(resolveHumanFaction(state));",
    'ensure faction fallback',
)
text = replace_once(
    text,
    "  state.mapData.hq.ownerTeamId ??= teamIdForFaction(state.mapData.hq.faction);\n\n  for (const building of state.mapData.buildings) building.ownerTeamId ??= humanTeamId;\n  for (const builder of state.mapData.builders) builder.ownerTeamId ??= humanTeamId;\n  for (const site of state.mapData.constructionSites) site.ownerTeamId ??= humanTeamId;\n  for (const harvester of state.harvesters) {",
    "  if (state.mapData?.hq) {\n"
    "    state.mapData.hq.ownerTeamId ??= teamIdForFaction(\n"
    "      isFaction(state.mapData.hq.faction) ? state.mapData.hq.faction : state.playerFaction,\n"
    "    );\n"
    "  }\n\n"
    "  for (const building of state.mapData?.buildings ?? []) building.ownerTeamId ??= humanTeamId;\n"
    "  for (const builder of state.mapData?.builders ?? []) builder.ownerTeamId ??= humanTeamId;\n"
    "  for (const site of state.mapData?.constructionSites ?? []) site.ownerTeamId ??= humanTeamId;\n"
    "  for (const harvester of state.harvesters ?? []) {",
    'partial map ownership',
)
text = text.replace("  for (const unit of state.combatUnits) {", "  for (const unit of state.combatUnits ?? []) {", 1)
text = text.replace("  for (const factory of state.production.factories) factory.ownerTeamId ??= humanTeamId;", "  for (const factory of state.production?.factories ?? []) factory.ownerTeamId ??= humanTeamId;", 1)
text = text.replace("  for (const entity of state.entities) {", "  for (const entity of state.entities ?? []) {", 1)
write(path, text)

print('P4A fix3 applied')
