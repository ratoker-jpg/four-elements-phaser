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


# ── shared faction presentation helper ──────────────────────────────
path = 'src/state/teamOwnership.ts'
text = read(path)
text = replace_once(
    text,
    "import { ensureMatchState, teamIdForFaction } from './matchState';",
    "import { ensureMatchState, factionForTeamId, teamIdForFaction } from './matchState';",
    'team ownership faction import',
)
text = replace_once(
    text,
    "export function isHumanOwned(\n",
    "/** Resolve the visual/gameplay faction from canonical team ownership. */\n"
    "export function resolveEntityFaction(\n"
    "  state: GameState,\n"
    "  entity: OwnedEntityRef,\n"
    "): Faction {\n"
    "  return factionForTeamId(resolveEntityTeamId(state, entity));\n"
    "}\n\n"
    "export function isHumanOwned(\n",
    'team ownership faction helper',
)
write(path, text)


# ── construction renderer: render every owner with its own assets ───
path = 'src/phaser/render/ConstructionRenderer.ts'
text = read(path)
text = replace_once(
    text,
    "import type { GameState, ConstructionSitePlacement, BuildingPlacement, BuilderPlacement, Faction } from '../../state/types';",
    "import type { GameState, ConstructionSitePlacement, BuildingPlacement, BuilderPlacement } from '../../state/types';\n"
    "import { resolveEntityFaction } from '../../state/teamOwnership';",
    'construction renderer ownership import',
)
text = replace_once(
    text,
    "  /** Whether a missing-texture error has already been logged (avoid spam). */\n  private builderTextureErrorLogged = false;",
    "  /** Missing builder texture keys already reported (avoid per-frame spam). */\n"
    "  private builderTextureErrorsLogged = new Set<string>();",
    'builder error set',
)
text = replace_once(
    text,
    "    this.syncConstructionSites(state.mapData.constructionSites);\n    this.syncBuildings(state.mapData.buildings, state.playerFaction);\n    this.syncBuilders(state.mapData.builders, state.playerFaction);",
    "    this.syncConstructionSites(state.mapData.constructionSites);\n"
    "    this.syncBuildings(state);\n"
    "    this.syncBuilders(state);",
    'renderer state sync',
)
text = replace_once(
    text,
    "  private syncBuildings(buildings: BuildingPlacement[], faction: Faction): void {\n    const activeKeys = new Set<string>();\n\n    for (const building of buildings) {",
    "  private syncBuildings(state: GameState): void {\n"
    "    const activeKeys = new Set<string>();\n\n"
    "    for (const building of state.mapData.buildings) {\n"
    "      const faction = resolveEntityFaction(state, building);",
    'sync buildings signature',
)
text = replace_once(
    text,
    "        // Create building Image if not already present\n        if (!this.buildingImages.has(key)) {\n          this.createBuildingImage(building, meta);\n        }",
    "        // Recreate the image if ownership changed to another faction asset.\n"
    "        const currentImage = this.buildingImages.get(key);\n"
    "        if (currentImage && currentImage.texture.key !== meta.assetKey) {\n"
    "          currentImage.destroy();\n"
    "          this.buildingImages.delete(key);\n"
    "        }\n"
    "        if (!this.buildingImages.has(key)) {\n"
    "          this.createBuildingImage(building, meta);\n"
    "        }",
    'building image owner refresh',
)
old_sync_builders = """  private syncBuilders(builders: BuilderPlacement[], faction: Faction): void {
    const textureKey = getCivilUnitKey(faction, 'builder');
    const textureExists = this.scene.textures.exists(textureKey);

    if (!textureExists) {
      // ASSET-01 guarantees builder textures are loaded. Missing texture = bug.
      if (!this.builderTextureErrorLogged) {
        console.error(
          `[ConstructionRenderer] Builder texture "${textureKey}" not found! ` +
          `ASSET-01 guarantees this texture is preloaded. Check PreloadScene and civilUnitAssets.ts.`,
        );
        this.builderTextureErrorLogged = true;
      }
      // Skip rendering builders — do NOT silently fall back to circles.
      // Destroy any stale sprites from a previous frame.
      for (const [id, sprite] of this.builderSprites) {
        sprite.destroy();
        this.builderSprites.delete(id);
        this.builderPrevTile.delete(id);
      }
      return;
    }

    // Texture exists — clear the error flag if it was set from a transient issue
    this.builderTextureErrorLogged = false;

    // BUILDER-ID: Track active builder IDs for stale sprite cleanup
    const activeBuilderIds = new Set<string>();

    for (const builder of builders) {
      activeBuilderIds.add(builder.id);
      this.syncBuilderSprite(builder, textureKey);
    }

    // Destroy sprites for removed builders
    for (const [id, sprite] of this.builderSprites) {
      if (!activeBuilderIds.has(id)) {
        sprite.destroy();
        this.builderSprites.delete(id);
        this.builderPrevTile.delete(id);
      }
    }
  }"""
new_sync_builders = """  private syncBuilders(state: GameState): void {
    const activeBuilderIds = new Set<string>();

    for (const builder of state.mapData.builders) {
      activeBuilderIds.add(builder.id);
      const faction = resolveEntityFaction(state, builder);
      const textureKey = getCivilUnitKey(faction, 'builder');
      if (!this.scene.textures.exists(textureKey)) {
        if (!this.builderTextureErrorsLogged.has(textureKey)) {
          console.error(
            `[ConstructionRenderer] Builder texture "${textureKey}" not found! ` +
            `ASSET-01 guarantees this texture is preloaded. Check PreloadScene and civilUnitAssets.ts.`,
          );
          this.builderTextureErrorsLogged.add(textureKey);
        }
        const staleSprite = this.builderSprites.get(builder.id);
        if (staleSprite) {
          staleSprite.destroy();
          this.builderSprites.delete(builder.id);
          this.builderPrevTile.delete(builder.id);
        }
        continue;
      }

      this.builderTextureErrorsLogged.delete(textureKey);
      this.syncBuilderSprite(builder, textureKey);
    }

    for (const [id, sprite] of this.builderSprites) {
      if (!activeBuilderIds.has(id)) {
        sprite.destroy();
        this.builderSprites.delete(id);
        this.builderPrevTile.delete(id);
      }
    }
  }"""
text = replace_once(text, old_sync_builders, new_sync_builders, 'sync builders owner-aware')
text = replace_once(
    text,
    "    if (!sprite) {\n      sprite = this.scene.add.sprite(worldX, worldY, textureKey, frameIndex);",
    "    if (sprite && sprite.texture.key !== textureKey) {\n"
    "      sprite.setTexture(textureKey, frameIndex);\n"
    "    }\n"
    "    if (!sprite) {\n"
    "      sprite = this.scene.add.sprite(worldX, worldY, textureKey, frameIndex);",
    'builder sprite texture refresh',
)
write(path, text)


# ── dev commands: mutate and spawn for the canonical human team ─────
path = 'src/state/devCommands.ts'
text = read(path)
text = replace_once(
    text,
    "import type { BodyId, WeaponId } from '../config/blockoutProfiles';",
    "import type { BodyId, WeaponId } from '../config/blockoutProfiles';\n"
    "import { getHumanTeam } from './matchState';",
    'dev human team import',
)
text = replace_once(
    text,
    "export function devAddRaw(state: GameState): DevCommandResult {\n  const room = state.economy.rawCap - state.economy.raw;",
    "export function devAddRaw(state: GameState): DevCommandResult {\n"
    "  const economy = getHumanTeam(state).economy;\n"
    "  const room = economy.rawCap - economy.raw;",
    'dev raw owner',
)
text = text.replace('state.economy.raw += add;', 'economy.raw += add;', 1)
text = text.replace('`+${add} Raw (${state.economy.raw}/${state.economy.rawCap})`', '`+${add} Raw (${economy.raw}/${economy.rawCap})`', 1)
text = replace_once(
    text,
    "export function devAddMatter(state: GameState): DevCommandResult {\n  const room = state.economy.matterCap - state.economy.matter;",
    "export function devAddMatter(state: GameState): DevCommandResult {\n"
    "  const economy = getHumanTeam(state).economy;\n"
    "  const room = economy.matterCap - economy.matter;",
    'dev matter owner',
)
text = text.replace('state.economy.matter += add;', 'economy.matter += add;', 1)
text = text.replace('`+${add} Matter (${state.economy.matter}/${state.economy.matterCap})`', '`+${add} Matter (${economy.matter}/${economy.matterCap})`', 1)
text = replace_once(
    text,
    "export function devAddFactionElement(state: GameState): DevCommandResult {\n  const faction = state.playerFaction;\n  const current = state.economy.elements[faction];\n  const room = state.economy.elementCap - current;",
    "export function devAddFactionElement(state: GameState): DevCommandResult {\n"
    "  const human = getHumanTeam(state);\n"
    "  const economy = human.economy;\n"
    "  const faction = human.faction;\n"
    "  const current = economy.elements[faction];\n"
    "  const room = economy.elementCap - current;",
    'dev element owner',
)
text = text.replace('state.economy.elements[faction] += add;', 'economy.elements[faction] += add;', 1)
text = text.replace('state.economy.elements[faction] / ELEMENT_UNITS_PER_ELEMENT', 'economy.elements[faction] / ELEMENT_UNITS_PER_ELEMENT', 1)
text = text.replace('state.economy.elementCap / ELEMENT_UNITS_PER_ELEMENT', 'economy.elementCap / ELEMENT_UNITS_PER_ELEMENT', 1)
text = replace_once(
    text,
    "export function devMaxResources(state: GameState): DevCommandResult {\n  state.economy.raw = state.economy.rawCap;\n  state.economy.matter = state.economy.matterCap;\n  state.economy.elements[state.playerFaction] = state.economy.elementCap;",
    "export function devMaxResources(state: GameState): DevCommandResult {\n"
    "  const human = getHumanTeam(state);\n"
    "  human.economy.raw = human.economy.rawCap;\n"
    "  human.economy.matter = human.economy.matterCap;\n"
    "  human.economy.elements[human.faction] = human.economy.elementCap;",
    'dev max owner',
)
text = replace_once(
    text,
    "export function devZeroResources(state: GameState): DevCommandResult {\n  state.economy.raw = 0;\n  state.economy.matter = 0;\n  state.economy.elements[state.playerFaction] = 0;",
    "export function devZeroResources(state: GameState): DevCommandResult {\n"
    "  const human = getHumanTeam(state);\n"
    "  human.economy.raw = 0;\n"
    "  human.economy.matter = 0;\n"
    "  human.economy.elements[human.faction] = 0;",
    'dev zero owner',
)
text = replace_once(
    text,
    "export function devSpawnBuilder(state: GameState): DevCommandResult {\n  const pos = findSpawnTileNearHq(state);",
    "export function devSpawnBuilder(state: GameState): DevCommandResult {\n"
    "  const human = getHumanTeam(state);\n"
    "  const pos = findSpawnTileNearHq(state);",
    'dev builder human',
)
text = replace_once(text, "    id,\n    tx: pos.tx,", "    id,\n    ownerTeamId: human.id,\n    tx: pos.tx,", 'dev builder owner field')
text = replace_once(text, "    faction: state.playerFaction,\n  });", "    faction: human.faction,\n    ownerTeamId: human.id,\n  });", 'dev builder entity owner')
text = replace_once(
    text,
    "export function devSpawnHarvester(state: GameState): DevCommandResult {\n  const pos = findSpawnTileNearHq(state);",
    "export function devSpawnHarvester(state: GameState): DevCommandResult {\n"
    "  const human = getHumanTeam(state);\n"
    "  const pos = findSpawnTileNearHq(state);",
    'dev harvester human',
)
text = replace_once(text, "  const harvester = createHarvester(id, pos.tx, pos.ty, state.playerFaction);", "  const harvester = createHarvester(id, pos.tx, pos.ty, human.faction, human.id);", 'dev harvester owner create')
text = replace_once(text, "    faction: state.playerFaction,\n  });", "    faction: human.faction,\n    ownerTeamId: human.id,\n  });", 'dev harvester entity owner')
text = replace_once(
    text,
    "export function findSpawnTileNearHq(state: GameState): { tx: number; ty: number } | null {\n  const hq = state.mapData.hq;",
    "export function findSpawnTileNearHq(state: GameState): { tx: number; ty: number } | null {\n"
    "  const humanHq = getHumanTeam(state).hqPosition;\n"
    "  if (!humanHq) return null;\n"
    "  const hq = { tx: humanHq.tx - 1, ty: humanHq.ty - 1 };",
    'dev spawn human hq',
)
write(path, text)


# ── selection panel: derive faction from the selected owner ──────────
path = 'src/phaser/ui/hud/selectionViewModel.ts'
text = read(path)
text = replace_once(
    text,
    "import { isUnitSelected, isBuilderSelected, isHarvesterSelected, isBuildingSelected, getSelectionTypeBreakdown, getPrimarySelection } from '../../../state/unitSelection';",
    "import { isUnitSelected, isBuilderSelected, isHarvesterSelected, isBuildingSelected, getSelectionTypeBreakdown, getPrimarySelection } from '../../../state/unitSelection';\n"
    "import { getHumanTeam } from '../../../state/matchState';\n"
    "import { resolveEntityFaction } from '../../../state/teamOwnership';",
    'selection view owner imports',
)
text = text.replace('      faction: state.playerFaction,', '      faction: getHumanTeam(state).faction,', 1)
text = text.replace('      faction: state.playerFaction,', '      faction: resolveEntityFaction(state, builder),', 1)
text = replace_once(
    text,
    "    const factory = primary.buildingType === 'units-factory'\n      ? state.production.factories.find(item => item.tx === primary.tx && item.ty === primary.ty)\n      : undefined;",
    "    const building = state.mapData.buildings.find(item =>\n"
    "      item.type === primary.buildingType && item.tx === primary.tx && item.ty === primary.ty,\n"
    "    );\n"
    "    if (!building) return EMPTY_SELECTION;\n"
    "    const factory = primary.buildingType === 'units-factory'\n"
    "      ? state.production.factories.find(item => item.tx === primary.tx && item.ty === primary.ty)\n"
    "      : undefined;",
    'selection building resolve',
)
text = text.replace('      faction: state.playerFaction,', '      faction: resolveEntityFaction(state, building),', 1)
text = text.replace('      faction: harvester.faction,', '      faction: resolveEntityFaction(state, harvester),', 1)
write(path, text)


# ── factory preview: use selected factory owner faction ──────────────
path = 'src/phaser/ui/hud/factoryComposerPreviewViewModel.ts'
text = read(path)
text = replace_once(
    text,
    "import { getPrimarySelection } from '../../../state/unitSelection';",
    "import { getPrimarySelection } from '../../../state/unitSelection';\n"
    "import { resolveEntityFaction } from '../../../state/teamOwnership';",
    'factory preview ownership import',
)
text = replace_once(
    text,
    "  const quote = getFactoryComposerQuote(composer);",
    "  const building = state.mapData.buildings.find(item =>\n"
    "    item.type === 'units-factory' && item.tx === primary.tx && item.ty === primary.ty,\n"
    "  );\n"
    "  if (!building) return { ...EMPTY_FACTORY_COMPOSER_PREVIEW };\n\n"
    "  const quote = getFactoryComposerQuote(composer);",
    'factory preview selected building',
)
text = replace_once(text, "  const faction = resolveGeneratedHullFaction(state.playerFaction);", "  const faction = resolveGeneratedHullFaction(resolveEntityFaction(state, building));", 'factory preview owner faction')
write(path, text)


# ── focused tests ────────────────────────────────────────────────────
test = r'''import { describe, expect, it } from 'vitest';
import type { MapData } from '../state/types';
import { createInitialState } from '../state/createInitialState';
import {
  devAddMatter,
  devSpawnBuilder,
  devSpawnHarvester,
} from '../state/devCommands';
import { resolveEntityFaction } from '../state/teamOwnership';
import { buildSelectionViewModel } from '../phaser/ui/hud/selectionViewModel';
import { buildFactoryComposerPreviewViewModel } from '../phaser/ui/hud/factoryComposerPreviewViewModel';
import { getBuildingSelectionId, selectOne } from '../state/unitSelection';

function makeState() {
  const map: MapData = {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 'sand' as const)),
    hq: { tx: 1, ty: 16, faction: 'cyan' },
    resources: [], obstacles: [], decor: [], constructionSites: [],
    builders: [{
      id: 'green-builder', ownerTeamId: 'team-green', tx: 8, ty: 8, ftx: 8, fty: 8,
      busy: false, phase: 'idle', path: [], pathIndex: 0, targetTx: 8, targetTy: 8,
      assignedSiteId: -1,
    }],
    buildings: [{ tx: 10, ty: 10, type: 'units-factory', ownerTeamId: 'team-green' }],
  };
  const state = createInitialState(map, 'cyan');
  state.production.factories.push({
    tx: 10, ty: 10, ownerTeamId: 'team-green', queue: [], active: false,
  });
  return state;
}

describe('SKIRMISH-P4C owner-aware presentation', () => {
  it('resolves explicit team ownership before legacy faction fallback', () => {
    const state = makeState();
    expect(resolveEntityFaction(state, { ownerTeamId: 'team-green', faction: 'cyan' })).toBe('green');
    expect(resolveEntityFaction(state, { faction: 'purple' })).toBe('purple');
    expect(resolveEntityFaction(state, {})).toBe('cyan');
  });

  it('shows the selected Builder and factory with their owner faction', () => {
    const state = makeState();
    const builderVm = buildSelectionViewModel(state, selectOne({ kind: 'builder', id: 'green-builder' }));
    expect(builderVm.faction).toBe('green');

    const factorySelection = selectOne({
      kind: 'building',
      id: getBuildingSelectionId('units-factory', 10, 10),
      buildingType: 'units-factory',
      tx: 10,
      ty: 10,
    });
    const factoryVm = buildSelectionViewModel(state, factorySelection);
    expect(factoryVm.faction).toBe('green');
    const preview = buildFactoryComposerPreviewViewModel(state, factorySelection);
    expect(preview.hullSrc).toContain('/green/m0/');
    expect(preview.turretSrc).toContain('/green/m0/');
  });

  it('mutates only the human economy through dev resource commands', () => {
    const state = makeState();
    const human = state.match!.teams['team-cyan'];
    const green = state.match!.teams['team-green'];
    human.economy.matter = 10;
    green.economy.matter = 200;
    expect(devAddMatter(state).success).toBe(true);
    expect(human.economy.matter).toBe(60);
    expect(green.economy.matter).toBe(200);
  });

  it('assigns canonical human ownership to dev-spawned civil units and render entities', () => {
    const state = makeState();
    expect(devSpawnBuilder(state).success).toBe(true);
    expect(devSpawnHarvester(state).success).toBe(true);
    const builder = state.mapData.builders.find(unit => unit.id.startsWith('dev-builder-'))!;
    const harvester = state.harvesters.find(unit => unit.id.startsWith('dev-harvester-'))!;
    expect(builder.ownerTeamId).toBe('team-cyan');
    expect(harvester.ownerTeamId).toBe('team-cyan');
    expect(harvester.faction).toBe('cyan');
    expect(state.entities.find(entity => entity.id === builder.id)?.ownerTeamId).toBe('team-cyan');
    expect(state.entities.find(entity => entity.id === harvester.id)?.ownerTeamId).toBe('team-cyan');
  });
});
'''
write('src/__tests__/ownerAwarePresentation.test.ts', test)

print('SKIRMISH-P4C patch applied')
