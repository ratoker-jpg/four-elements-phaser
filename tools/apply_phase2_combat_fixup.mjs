#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, transforms) {
  let text = await readFile(path, 'utf8');
  for (const [from, to, label] of transforms) {
    if (!text.includes(from)) {
      throw new Error(`${path}: missing patch target: ${label}`);
    }
    text = text.replace(from, to);
  }
  await writeFile(path, text);
  console.log(`[phase2-fixup] patched ${path}`);
}

await patch('src/state/types.ts', [
  [
`/** Modular combat unit configuration. Phase 2: uses BodyId/WeaponId for flexible composition. */
export interface ModularCombatUnit {
  tx: number;
  ty: number;
  bodyId: BodyId;
  weaponId: WeaponId;
  mod: ModLevel;
  faction: Faction;
  id: string;
}`,
`/** Canonical dynamic combat-unit state. Render entities are derived from this object. */
export interface ModularCombatUnit {
  id: string;
  tx: number;
  ty: number;
  bodyId: BodyId;
  weaponId: WeaponId;
  hullMod: ModLevel;
  turretMod: ModLevel;
  faction: Faction;
  /** Runtime 8-direction facing. */
  dir?: number;
  /** Runtime 8-direction turret facing; defaults to dir. */
  turretDir?: number;
  /** Legacy save field, migrated to hullMod/turretMod on load. */
  mod?: ModLevel;
}`,
    'canonical ModularCombatUnit',
  ],
  [
`/** Unit types that can be produced by a units-factory. */
export type ProducibleUnitType = 'builder' | 'harvester' | 'wasp-smoky';`,
`export type CivilUnitType = 'builder' | 'harvester';

/** Backward-compatible command/UI identifiers. */
export type ProducibleUnitType = CivilUnitType | 'wasp-smoky';

export interface CombatProductionConfig {
  bodyId: BodyId;
  weaponId: WeaponId;
  hullMod: ModLevel;
  turretMod: ModLevel;
}

/** Structured queue request; Phase 3 can supply arbitrary legal combinations. */
export type UnitProductionRequest =
  | { kind: 'civil'; unitType: CivilUnitType }
  | ({ kind: 'combat' } & CombatProductionConfig);`,
    'structured production types',
  ],
  [
`  /** The type of unit being produced. */
  unitType: ProducibleUnitType;
  /** Milliseconds elapsed since production started. */`,
`  /** Backward-compatible label used by the current HUD and old saves. */
  unitType: ProducibleUnitType;
  /** Canonical structured request. Optional only for old-save migration. */
  request?: UnitProductionRequest;
  /** Milliseconds elapsed since production started. */`,
    'queue request field',
  ],
  [
`  /** Auto-incrementing counter for deterministic construction site IDs. */
  nextConstructionId: number;`,
`  /** Auto-incrementing counter for deterministic construction site IDs. */
  nextConstructionId: number;
  /** Auto-incrementing counter for deterministic produced combat-unit IDs. */
  nextCombatUnitId: number;`,
    'combat id counter',
  ],
]);

await patch('src/state/production.ts', [
  [
`  GameState,
  ProducibleUnitType,
} from './types';`,
`  GameState,
  ProducibleUnitType,
  UnitProductionRequest,
} from './types';`,
    'production request import',
  ],
  [
`} from './types';

// ─── Public types`,
`} from './types';
import { normalizeProductionRequest } from './combatUnits';

// ─── Public types`,
    'production helper import',
  ],
  [
`  unitType: ProducibleUnitType,
): ProductionResult {
  // 1. Find the factory`,
`  input: ProducibleUnitType | UnitProductionRequest,
): ProductionResult {
  const { unitType, request } = normalizeProductionRequest(input);

  // 1. Find the factory`,
    'production input normalization',
  ],
  [
`  factory.queue.push({
    unitType,
    elapsedMs: 0,`,
`  factory.queue.push({
    unitType,
    request,
    elapsedMs: 0,`,
    'queue structured request',
  ],
]);

await patch('src/state/updateGameState.ts', [
  [
`  ResourceNodeState,
  ModularCombatUnit,
} from './types';`,
`  ResourceNodeState,
  ModularCombatUnit,
  ProductionQueueItem,
} from './types';`,
    'queue item import',
  ],
  [
`import { isResourceInfinite } from '../config/resourceClassRuntime';`,
`import { isResourceInfinite } from '../config/resourceClassRuntime';
import { allocateCombatUnitId, getCombatProductionConfig } from './combatUnits';`,
    'combat helpers import',
  ],
  [
`    } else if (item.unitType === 'wasp-smoky') {
      spawnCombatUnit(state, spawnPos.tx, spawnPos.ty);
    }`,
`    } else if (item.unitType === 'wasp-smoky') {
      spawnCombatUnit(state, spawnPos.tx, spawnPos.ty, item);
    }`,
    'pass queue item to spawn',
  ],
  [
`function spawnCombatUnit(state: GameState, tx: number, ty: number): void {
  const id = \`combat-unit-\${tx}-\${ty}-\${Date.now()}\`;
  const combatUnit: ModularCombatUnit = {
    tx,
    ty,
    bodyId: 'wasp',
    weaponId: 'smoky',
    mod: 'm0',
    faction: state.playerFaction,
    id,
  };
  state.combatUnits.push(combatUnit);

  state.entities.push({
    id,
    kind: 'modular-combat',
    tx,
    ty,
    faction: state.playerFaction,
    dir: 2,        // default body facing: South
    turretDir: 2,  // default turret facing: South
  });
}`,
`function spawnCombatUnit(
  state: GameState,
  tx: number,
  ty: number,
  item: ProductionQueueItem,
): void {
  const config = getCombatProductionConfig(item);
  if (!config) return;

  const combatUnit: ModularCombatUnit = {
    id: allocateCombatUnitId(state),
    tx,
    ty,
    bodyId: config.bodyId,
    weaponId: config.weaponId,
    hullMod: config.hullMod,
    turretMod: config.turretMod,
    faction: state.playerFaction,
    dir: 2,
    turretDir: 2,
  };

  // combatUnits is the sole canonical state. EntityRenderer derives visuals
  // from it each frame; do not duplicate produced units in state.entities.
  state.combatUnits.push(combatUnit);
}`,
    'deterministic canonical combat spawn',
  ],
]);

await patch('src/state/createInitialState.ts', [
  [
`    nextConstructionId: 0,
    production: arenaMode ? { factories: [] } : createInitialProduction(mapData),`,
`    nextConstructionId: 0,
    nextCombatUnitId: 0,
    production: arenaMode ? { factories: [] } : createInitialProduction(mapData),`,
    'initial combat id counter',
  ],
  [
`      bodyId: 'wasp',
      weaponId: 'smoky',
      mod: 'm0',
      faction,
      id: \`combat-unit-\${candidate.tx}-\${candidate.ty}\`,`,
`      bodyId: 'wasp',
      weaponId: 'smoky',
      hullMod: 'm0',
      turretMod: 'm0',
      faction,
      id: \`legacy-starter-combat-\${candidate.tx}-\${candidate.ty}\`,
      dir: 2,
      turretDir: 2,`,
    'legacy starter mods',
  ],
]);

await patch('src/state/saveGame.ts', [
  [
`import { normalizeVisionForLoadedState } from './visibility';`,
`import { normalizeVisionForLoadedState } from './visibility';
import { normalizeCombatUnitState } from './combatUnits';`,
    'save migration import',
  ],
  [
`/** Current save format version. Phase 2: bumped to 3 for combatUnits field. */
const SAVE_VERSION = 3;`,
`/** Current save format version. Phase 2 fixup: canonical combat state + deterministic IDs. */
const SAVE_VERSION = 4;`,
    'save version 4',
  ],
  [
`  // Accept v1 (no vision), v2 (with vision), v3 (with combatUnits)
  if (s.version !== 1 && s.version !== 2 && s.version !== 3) return false;`,
`  // Accept v1-v4; loadGame performs field migrations.
  if (s.version !== 1 && s.version !== 2 && s.version !== 3 && s.version !== 4) return false;`,
    'slot version acceptance',
  ],
  [
`  if (slot.version !== SAVE_VERSION && slot.version !== 1 && slot.version !== 2) {`,
`  if (slot.version !== SAVE_VERSION && slot.version !== 1 && slot.version !== 2 && slot.version !== 3) {`,
    'load old v3',
  ],
  [
`  // Phase 2: Migrate old saves without combatUnits field
  if (!gs.combatUnits) {
    gs.combatUnits = [];
  }

  // FOG-VISION-08 FIXUP-1: Normalize vision state`,
`  // Phase 2 fixup: migrate missing arrays, old combined mod fields,
  // duplicate/missing IDs and the deterministic ID counter.
  normalizeCombatUnitState(gs);

  // FOG-VISION-08 FIXUP-1: Normalize vision state`,
    'combat save migration',
  ],
]);

await patch('src/modular/normalCombatToModularVisual.ts', [
  [
`  mod?: string;
  dir?: number;`,
`  /** Legacy combined modification. Used only when split fields are absent. */
  mod?: string;
  hullMod?: string;
  turretMod?: string;
  dir?: number;`,
    'split mapper args',
  ],
  [
`  // mod → ModularModId (safe m0 default)
  const hullMod = modStringToModularMod(args.mod ?? 'm0');
  const turretMod = modStringToModularMod(args.mod ?? 'm0');`,
`  // Independent hull/turret modifications. Legacy mod remains a migration fallback.
  const hullMod = modStringToModularMod(args.hullMod ?? args.mod ?? 'm0');
  const turretMod = modStringToModularMod(args.turretMod ?? args.mod ?? 'm0');`,
    'split mapper mods',
  ],
]);

await patch('src/phaser/render/ModularVehicleLiveAdapter.ts', [
  [
`  mod: string;
  faction: string;`,
`  hullMod: string;
  turretMod: string;
  faction: string;`,
    'pending split mods',
  ],
  [
`    chassis: string,
    weapon: string,
    mod: string,
  ): LiveAdapterResult {`,
`    chassis: string,
    weapon: string,
    hullMod: string,
    turretMod: string = hullMod,
  ): LiveAdapterResult {`,
    'adapter split signature',
  ],
  [
`      faction,
      mod,
      dir: entity.dir,`,
`      faction,
      hullMod,
      turretMod,
      dir: entity.dir,`,
    'adapter mapper split args',
  ],
  [
`      chassis,
      weapon,
      mod,
      faction,`,
`      chassis,
      weapon,
      hullMod,
      turretMod,
      faction,`,
    'pending split values',
  ],
  [
`      faction: p.faction,
      mod: p.mod,
      dir: p.dir,`,
`      faction: p.faction,
      hullMod: p.hullMod,
      turretMod: p.turretMod,
      dir: p.dir,`,
    'retry split mapper args',
  ],
]);

await patch('src/phaser/render/ModularTankRenderer.ts', [
  [
`      chassis,
      weapon,
      mod,
    );`,
`      chassis,
      weapon,
      mod,
      mod,
    );`,
    'legacy renderer adapter compatibility',
  ],
]);

await patch('src/phaser/render/EntityRenderer.ts', [
  [
`import { ConstructionRenderer } from './ConstructionRenderer';`,
`import { ConstructionRenderer } from './ConstructionRenderer';
import { CombatUnitRenderer } from './CombatUnitRenderer';`,
    'combat renderer import',
  ],
  [
`  /** Construction renderer — owns construction site + building placeholder graphics. */
  private constructionRenderer: ConstructionRenderer;`,
`  /** Construction renderer — owns construction site + building placeholder graphics. */
  private constructionRenderer: ConstructionRenderer;

  /** Produced combat units — canonical multi-entity runtime renderer. */
  private combatUnitRenderer: CombatUnitRenderer;`,
    'combat renderer field',
  ],
  [
`    this.modularAdapter = new ModularVehicleLiveAdapter(scene, offset, 100);
    this.constructionRenderer = new ConstructionRenderer(scene, offset);`,
`    this.modularAdapter = new ModularVehicleLiveAdapter(scene, offset, 100);
    this.constructionRenderer = new ConstructionRenderer(scene, offset);
    this.combatUnitRenderer = new CombatUnitRenderer(scene, offset);`,
    'combat renderer construction',
  ],
  [
`    this.syncResources(state.resourceNodes, state.vision);
    this.constructionRenderer.syncFromState(state);`,
`    this.syncResources(state.resourceNodes, state.vision);
    this.constructionRenderer.syncFromState(state);
    this.combatUnitRenderer.sync(state.combatUnits);`,
    'combat frame sync',
  ],
  [
`    this.modularTankRenderer.destroy();
    this.constructionRenderer.destroy();`,
`    this.modularTankRenderer.destroy();
    this.constructionRenderer.destroy();
    this.combatUnitRenderer.destroy();`,
    'combat renderer destroy',
  ],
]);

console.log('[phase2-fixup] all patches applied');
