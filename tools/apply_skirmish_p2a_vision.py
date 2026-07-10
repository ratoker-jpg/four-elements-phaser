from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'marker not found: {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/state/visibility.ts',
    "  sourceType?: 'hq' | 'building' | 'builder' | 'harvester';",
    "  sourceType?: 'hq' | 'building' | 'builder' | 'harvester' | 'combat';",
)
replace_once(
    'src/state/visibility.ts',
    "/** HQ vision radius (matches BuildingConfig.visionRadius: 8). */",
    "/** Vision radius for production combat units. Wasp scouts through speed; both T1 hulls use this baseline. */\n"
    "export const COMBAT_UNIT_VISION_RADIUS = 4;\n\n"
    "/** HQ vision radius (matches BuildingConfig.visionRadius: 8). */",
)
replace_once(
    'src/state/visibility.ts',
    "  // Harvesters\n"
    "  for (const harvester of state.harvesters) {\n"
    "    sources.push({\n"
    "      tx: Math.round(harvester.ftx),\n"
    "      ty: Math.round(harvester.fty),\n"
    "      radius: HARVESTER_VISION_RADIUS,\n"
    "      sourceId: harvester.id,\n"
    "      sourceType: 'harvester',\n"
    "    });\n"
    "  }\n\n"
    "  return sources;",
    "  // Harvesters\n"
    "  for (const harvester of state.harvesters) {\n"
    "    sources.push({\n"
    "      tx: Math.round(harvester.ftx),\n"
    "      ty: Math.round(harvester.fty),\n"
    "      radius: HARVESTER_VISION_RADIUS,\n"
    "      sourceId: harvester.id,\n"
    "      sourceType: 'harvester',\n"
    "    });\n"
    "  }\n\n"
    "  // Canonical production combat units owned by the player faction.\n"
    "  for (const unit of state.combatUnits) {\n"
    "    if (unit.faction !== state.playerFaction || unit.runtime?.isDestroyed) continue;\n"
    "    sources.push({\n"
    "      tx: Math.round(unit.runtime?.ftx ?? unit.tx),\n"
    "      ty: Math.round(unit.runtime?.fty ?? unit.ty),\n"
    "      radius: COMBAT_UNIT_VISION_RADIUS,\n"
    "      sourceId: unit.id,\n"
    "      sourceType: 'combat',\n"
    "    });\n"
    "  }\n\n"
    "  return sources;",
)

path = Path('src/__tests__/combatUnitMovement.test.ts')
text = path.read_text(encoding='utf-8')
text = text.replace(
    "import { routeLmbClick } from '../state/commandRouter';\n",
    "import { routeLmbClick } from '../state/commandRouter';\n"
    "import { collectVisionSources, getVisionSourceSignature } from '../state/visibility';\n",
)
marker = "  it('persists runtime fields and migrates missing runtime on load', () => {"
test = """  it('uses fractional combat movement as a fog vision source', () => {
    const state = makeState();
    const unit = makeUnit();
    state.combatUnits = [unit];
    normalizeCombatUnitState(state);

    const before = getVisionSourceSignature(state);
    unit.runtime!.ftx = 9.4;
    unit.runtime!.fty = 7.6;
    const source = collectVisionSources(state).find(candidate => candidate.sourceId === unit.id);

    expect(source).toMatchObject({ tx: 9, ty: 8, radius: 4, sourceType: 'combat' });
    expect(getVisionSourceSignature(state)).not.toBe(before);

    unit.runtime!.isDestroyed = true;
    expect(collectVisionSources(state).some(candidate => candidate.sourceId === unit.id)).toBe(false);
  });

"""
if test not in text:
    if marker not in text:
        raise SystemExit('test insertion marker not found')
    text = text.replace(marker, test + marker, 1)
path.write_text(text, encoding='utf-8')

print('SKIRMISH-P2A combat vision fixup applied')
