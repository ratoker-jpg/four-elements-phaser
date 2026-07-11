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


path = 'src/state/builder.ts'
text = read(path)
text = replace_once(
    text,
    "import { BUILDING_CONFIG } from './construction';",
    "import { BUILDING_CONFIG } from './construction';\n"
    "import { resolveEntityTeamId } from './teamOwnership';",
    'builder ownership import',
)
text = replace_once(
    text,
    "    // Find an idle builder\n    const builderIndex = state.mapData.builders.findIndex(b => b.phase === 'idle' && !b.busy);",
    "    // Find an idle builder owned by the same team as the site.\n"
    "    const siteOwnerTeamId = resolveEntityTeamId(state, site);\n"
    "    const builderIndex = state.mapData.builders.findIndex(builder =>\n"
    "      builder.phase === 'idle'\n"
    "      && !builder.busy\n"
    "      && resolveEntityTeamId(state, builder) === siteOwnerTeamId,\n"
    "    );",
    'builder assignment owner filter',
)
text = replace_once(
    text,
    "    if (!site) {\n      releaseBuilder(state, builderIndex);\n      return;\n    }\n  }",
    "    if (!site) {\n"
    "      releaseBuilder(state, builderIndex);\n"
    "      return;\n"
    "    }\n"
    "    if (resolveEntityTeamId(state, site) !== resolveEntityTeamId(state, builder)) {\n"
    "      releaseBuilder(state, builderIndex);\n"
    "      return;\n"
    "    }\n"
    "  }",
    'builder active site owner guard',
)
write(path, text)

path = 'src/state/construction.ts'
text = read(path)
text = replace_once(
    text,
    "import { getOwningTeam, ensureMatchState } from './matchState';",
    "import { getOwningTeam, ensureMatchState } from './matchState';\n"
    "import { resolveEntityTeamId } from './teamOwnership';",
    'construction ownership import',
)
text = replace_once(
    text,
    "    const builder = state.mapData.builders[site.builderIndex];\n    if (builder.phase !== 'building') {",
    "    const builder = state.mapData.builders[site.builderIndex];\n"
    "    if (resolveEntityTeamId(state, builder) !== resolveEntityTeamId(state, site)) {\n"
    "      return { completed: false };\n"
    "    }\n"
    "    if (builder.phase !== 'building') {",
    'construction progress owner guard',
)
text = replace_once(
    text,
    "      const builder = state.mapData.builders[bi];\n      builder.busy = false;",
    "      const builder = state.mapData.builders[bi];\n"
    "      if (resolveEntityTeamId(state, builder) !== resolveEntityTeamId(state, site)) {\n"
    "        return { completed: false };\n"
    "      }\n"
    "      builder.busy = false;",
    'construction release owner guard',
)
write(path, text)

path = 'src/__tests__/ownerAwareControl.test.ts'
test = read(path)
test = replace_once(
    test,
    "import { createInitialState } from '../state/createInitialState';",
    "import { createInitialState } from '../state/createInitialState';\n"
    "import { assignIdleBuilders } from '../state/builder';\n"
    "import { updateConstructionSiteProgress } from '../state/construction';",
    'construction test imports',
)
marker = "  it('removes destroyed human tanks from selection while preserving unit-destroyed command results', () => {"
insert = """  it('assigns pending construction only to a Builder owned by the site team', () => {
    const state = makeState();
    state.mapData.constructionSites.push({
      tx: 8,
      ty: 4,
      type: 'separator',
      elapsed: 0,
      duration: 10_000,
      progress: 0,
      builderIndex: -1,
      id: 50,
      pending: true,
      ownerTeamId: 'team-green',
    });

    assignIdleBuilders(state);
    const site = state.mapData.constructionSites[0];
    expect(site.builderIndex).toBe(1);
    expect(state.mapData.builders[0].busy).toBe(false);
    expect(state.mapData.builders[1].busy).toBe(true);
    expect(state.mapData.builders[1].assignedSiteId).toBe(50);
  });

  it('does not advance a site when its assigned Builder belongs to another team', () => {
    const state = makeState();
    state.mapData.builders[0].phase = 'building';
    state.mapData.builders[0].busy = true;
    state.mapData.constructionSites.push({
      tx: 8,
      ty: 4,
      type: 'separator',
      elapsed: 0,
      duration: 10_000,
      progress: 0,
      builderIndex: 0,
      id: 51,
      pending: false,
      ownerTeamId: 'team-green',
    });

    expect(updateConstructionSiteProgress(state, 'site-51', 200)).toEqual({ completed: false });
    expect(state.mapData.constructionSites[0].elapsed).toBe(0);
  });

"""
if marker not in test:
    raise RuntimeError('construction tests insertion marker not found')
test = test.replace(marker, insert + marker, 1)
write(path, test)

print('SKIRMISH-P4B fix3 applied')
