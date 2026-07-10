from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        if new in text:
            return
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# ---------------------------------------------------------------------------
# Config-driven T1 component catalog. This file intentionally has no imports,
# so state/types.ts can expose legacy aliases without creating a module cycle.
# ---------------------------------------------------------------------------
config_path = ROOT / "src/config/t1ProductionComponents.ts"
config_path.write_text(r'''/**
 * T1 modular production component catalog.
 *
 * This is the single source of truth for the first playable hull/turret costs
 * and production durations. It has no state or Phaser imports, so both state
 * compatibility aliases and production logic can consume it safely.
 */

export type T1ProductionBodyId = 'wasp' | 'hunter';
export type T1ProductionWeaponId = 'smoky' | 'railgun';
export type T1ProductionModLevel = 'm0' | 'm1' | 'm2' | 'm3';

export interface T1ProductionComponentSpec<Id extends string> {
  id: Id;
  displayNameRu: string;
  matterCost: number;
  elementCost: number;
  productionDurationMs: number;
}

export interface T1CombatProductionSelection {
  bodyId: string;
  weaponId: string;
  hullMod?: string;
  turretMod?: string;
}

export interface T1CombatProductionQuote {
  bodyId: T1ProductionBodyId;
  weaponId: T1ProductionWeaponId;
  hullMod: T1ProductionModLevel;
  turretMod: T1ProductionModLevel;
  bodyLabelRu: string;
  weaponLabelRu: string;
  displayNameRu: string;
  matterCost: number;
  elementCost: number;
  durationMs: number;
}

export const T1_ASSEMBLY_OFFSET_MS = 7_000;

export const T1_BODY_COMPONENTS: Readonly<Record<T1ProductionBodyId, T1ProductionComponentSpec<T1ProductionBodyId>>> = {
  wasp: {
    id: 'wasp',
    displayNameRu: 'Васп',
    matterCost: 20,
    elementCost: 5,
    productionDurationMs: 7_000,
  },
  hunter: {
    id: 'hunter',
    displayNameRu: 'Хантер',
    matterCost: 35,
    elementCost: 7,
    productionDurationMs: 12_000,
  },
};

export const T1_WEAPON_COMPONENTS: Readonly<Record<T1ProductionWeaponId, T1ProductionComponentSpec<T1ProductionWeaponId>>> = {
  smoky: {
    id: 'smoky',
    displayNameRu: 'Смоки',
    matterCost: 25,
    elementCost: 5,
    productionDurationMs: 18_000,
  },
  railgun: {
    id: 'railgun',
    displayNameRu: 'Рельса',
    matterCost: 45,
    elementCost: 8,
    productionDurationMs: 25_000,
  },
};

const MOD_LEVELS = new Set<string>(['m0', 'm1', 'm2', 'm3']);

export function isT1ProductionBodyId(value: string): value is T1ProductionBodyId {
  return Object.prototype.hasOwnProperty.call(T1_BODY_COMPONENTS, value);
}

export function isT1ProductionWeaponId(value: string): value is T1ProductionWeaponId {
  return Object.prototype.hasOwnProperty.call(T1_WEAPON_COMPONENTS, value);
}

export function isT1ProductionModLevel(value: string): value is T1ProductionModLevel {
  return MOD_LEVELS.has(value);
}

/**
 * Compose a legal T1 quote from independent hull and turret selections.
 * Missing modification fields migrate to M0. Explicit invalid values reject.
 */
export function getT1CombatProductionQuote(
  selection: T1CombatProductionSelection,
): T1CombatProductionQuote | null {
  if (!isT1ProductionBodyId(selection.bodyId) || !isT1ProductionWeaponId(selection.weaponId)) {
    return null;
  }

  const hullMod = selection.hullMod ?? 'm0';
  const turretMod = selection.turretMod ?? 'm0';
  if (!isT1ProductionModLevel(hullMod) || !isT1ProductionModLevel(turretMod)) {
    return null;
  }

  const body = T1_BODY_COMPONENTS[selection.bodyId];
  const weapon = T1_WEAPON_COMPONENTS[selection.weaponId];
  return {
    bodyId: body.id,
    weaponId: weapon.id,
    hullMod,
    turretMod,
    bodyLabelRu: body.displayNameRu,
    weaponLabelRu: weapon.displayNameRu,
    displayNameRu: `${body.displayNameRu} + ${weapon.displayNameRu}`,
    matterCost: body.matterCost + weapon.matterCost,
    elementCost: body.elementCost + weapon.elementCost,
    durationMs: Math.max(body.productionDurationMs, weapon.productionDurationMs) + T1_ASSEMBLY_OFFSET_MS,
  };
}

export const T1_LEGAL_COMBINATIONS: readonly Readonly<{
  bodyId: T1ProductionBodyId;
  weaponId: T1ProductionWeaponId;
}>[] = [
  { bodyId: 'wasp', weaponId: 'smoky' },
  { bodyId: 'hunter', weaponId: 'smoky' },
  { bodyId: 'wasp', weaponId: 'railgun' },
  { bodyId: 'hunter', weaponId: 'railgun' },
];
''', encoding="utf-8")

# Legacy constants remain exported, but now derive from the canonical catalog.
replace_once(
    "src/state/types.ts",
    "import type { VisionState } from './visibility';\n",
    "import type { VisionState } from './visibility';\nimport { T1_ASSEMBLY_OFFSET_MS, T1_BODY_COMPONENTS, T1_WEAPON_COMPONENTS } from '../config/t1ProductionComponents';\n",
)
replace_once(
    "src/state/types.ts",
    """// ─── Reserved Modular Combat Constants (ARCH-01F, not implemented) ──────\n\n/** Wasp chassis matter cost (reserved for future modular combat). */\nexport const WASP_CHASSIS_MATTER_COST = 20;\n/** Wasp chassis element cost in elementUnits (reserved for future modular combat). */\nexport const WASP_CHASSIS_ELEMENT_COST = 5;\n/** Wasp chassis production duration in milliseconds (reserved for future modular combat). */\nexport const WASP_CHASSIS_PRODUCTION_DURATION_MS = 7000;\n/** Smoky weapon matter cost (reserved for future modular combat). */\nexport const SMOKY_WEAPON_MATTER_COST = 25;\n/** Smoky weapon element cost in elementUnits (reserved for future modular combat). */\nexport const SMOKY_WEAPON_ELEMENT_COST = 5;\n/** Smoky weapon production duration in milliseconds (reserved for future modular combat). */\nexport const SMOKY_WEAPON_PRODUCTION_DURATION_MS = 18000;\n/** Total wasp+smoky unit matter cost (reserved for future modular combat). */\nexport const WASP_SMOKY_TOTAL_MATTER_COST = 45;\n/** Total wasp+smoky unit element cost in elementUnits (reserved for future modular combat). */\nexport const WASP_SMOKY_TOTAL_ELEMENT_COST = 10;\n/** Total wasp+smoky unit production duration in milliseconds (reserved for future modular combat). */\nexport const WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS = 25000;\n""",
    """// ─── Legacy modular production aliases ────────────────────────────────\n\n/** @deprecated Use T1_BODY_COMPONENTS.wasp.matterCost. */\nexport const WASP_CHASSIS_MATTER_COST = T1_BODY_COMPONENTS.wasp.matterCost;\n/** @deprecated Use T1_BODY_COMPONENTS.wasp.elementCost. */\nexport const WASP_CHASSIS_ELEMENT_COST = T1_BODY_COMPONENTS.wasp.elementCost;\n/** @deprecated Use T1_BODY_COMPONENTS.wasp.productionDurationMs. */\nexport const WASP_CHASSIS_PRODUCTION_DURATION_MS = T1_BODY_COMPONENTS.wasp.productionDurationMs;\n/** @deprecated Use T1_WEAPON_COMPONENTS.smoky.matterCost. */\nexport const SMOKY_WEAPON_MATTER_COST = T1_WEAPON_COMPONENTS.smoky.matterCost;\n/** @deprecated Use T1_WEAPON_COMPONENTS.smoky.elementCost. */\nexport const SMOKY_WEAPON_ELEMENT_COST = T1_WEAPON_COMPONENTS.smoky.elementCost;\n/** @deprecated Use T1_WEAPON_COMPONENTS.smoky.productionDurationMs. */\nexport const SMOKY_WEAPON_PRODUCTION_DURATION_MS = T1_WEAPON_COMPONENTS.smoky.productionDurationMs;\n/** @deprecated Use getT1CombatProductionQuote(). */\nexport const WASP_SMOKY_TOTAL_MATTER_COST = T1_BODY_COMPONENTS.wasp.matterCost + T1_WEAPON_COMPONENTS.smoky.matterCost;\n/** @deprecated Use getT1CombatProductionQuote(). */\nexport const WASP_SMOKY_TOTAL_ELEMENT_COST = T1_BODY_COMPONENTS.wasp.elementCost + T1_WEAPON_COMPONENTS.smoky.elementCost;\n/** @deprecated Use getT1CombatProductionQuote(). */\nexport const WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS = Math.max(\n  T1_BODY_COMPONENTS.wasp.productionDurationMs,\n  T1_WEAPON_COMPONENTS.smoky.productionDurationMs,\n) + T1_ASSEMBLY_OFFSET_MS;\n""",
)

# Production uses one quote for canonical request, cost and duration.
replace_once(
    "src/state/production.ts",
    """  HARVESTER_PRODUCTION_DURATION_MS,\n  WASP_SMOKY_TOTAL_MATTER_COST,\n  WASP_SMOKY_TOTAL_ELEMENT_COST,\n  WASP_SMOKY_TOTAL_PRODUCTION_DURATION_MS,\n  DEFAULT_UNIT_CAP,\n""",
    """  HARVESTER_PRODUCTION_DURATION_MS,\n  DEFAULT_UNIT_CAP,\n""",
)
replace_once(
    "src/state/production.ts",
    "import { normalizeProductionRequest } from './combatUnits';\n",
    "import { normalizeProductionRequest } from './combatUnits';\nimport { getT1CombatProductionQuote } from '../config/t1ProductionComponents';\n",
)
production_path = ROOT / "src/state/production.ts"
production_text = production_path.read_text(encoding="utf-8")
start = production_text.index("// ─── Cost lookup")
end = production_text.index("// ─── Public API", start)
quote_block = r'''// ─── Canonical production quote ─────────────────────────────────────

export type ProductionRequestInput = ProducibleUnitType | UnitProductionRequest;

export interface ProductionQuote {
  unitType: ProducibleUnitType;
  request: UnitProductionRequest;
  displayNameRu: string;
  matterCost: number;
  elementCost: number;
  durationMs: number;
}

/** Resolve one canonical request, display label, cost and duration. */
export function getProductionQuote(input: ProductionRequestInput): ProductionQuote | null {
  const { unitType, request } = normalizeProductionRequest(input);
  if (request.kind === 'civil') {
    if (request.unitType === 'builder') {
      return {
        unitType,
        request,
        displayNameRu: 'Строитель',
        matterCost: BUILDER_PRODUCTION_MATTER_COST,
        elementCost: BUILDER_PRODUCTION_ELEMENT_COST,
        durationMs: BUILDER_PRODUCTION_DURATION_MS,
      };
    }
    return {
      unitType,
      request,
      displayNameRu: 'Сборщик',
      matterCost: HARVESTER_PRODUCTION_MATTER_COST,
      elementCost: HARVESTER_PRODUCTION_ELEMENT_COST,
      durationMs: HARVESTER_PRODUCTION_DURATION_MS,
    };
  }

  const combat = getT1CombatProductionQuote(request);
  if (!combat) return null;
  return {
    unitType: 'wasp-smoky',
    request: {
      kind: 'combat',
      bodyId: combat.bodyId,
      weaponId: combat.weaponId,
      hullMod: combat.hullMod,
      turretMod: combat.turretMod,
    },
    displayNameRu: combat.displayNameRu,
    matterCost: combat.matterCost,
    elementCost: combat.elementCost,
    durationMs: combat.durationMs,
  };
}

'''
production_path.write_text(production_text[:start] + quote_block + production_text[end:], encoding="utf-8")
replace_once(
    "src/state/production.ts",
    """  const { unitType, request } = normalizeProductionRequest(input);\n\n  // 1. Find the factory\n""",
    """  // 1. Find the factory\n""",
)
replace_once(
    "src/state/production.ts",
    """  if (factory.queue.length >= QUEUE_LIMIT) {\n    return { ok: false, reason: 'queue-full' };\n  }\n\n  // 3. Check matter cost\n  const matterCost = getMatterCost(unitType);\n""",
    """  if (factory.queue.length >= QUEUE_LIMIT) {\n    return { ok: false, reason: 'queue-full' };\n  }\n\n  const quote = getProductionQuote(input);\n  if (!quote) return { ok: false, reason: 'unsupported-unit-type' };\n\n  // 3. Check matter cost\n  const matterCost = quote.matterCost;\n""",
)
replace_once(
    "src/state/production.ts",
    "const elementCost = getElementCost(unitType);",
    "const elementCost = quote.elementCost;",
)
replace_once(
    "src/state/production.ts",
    "const currentUnitCount = state.mapData.builders.length + state.harvesters.length + state.combatUnits.length;",
    "const currentUnitCount = state.mapData.builders.length + state.harvesters.length + (state.combatUnits?.length ?? 0);",
)
replace_once(
    "src/state/production.ts",
    """  const durationMs = getProductionDuration(unitType);\n  factory.queue.push({\n    unitType,\n    request,\n""",
    """  const durationMs = quote.durationMs;\n  factory.queue.push({\n    unitType: quote.unitType,\n    request: quote.request,\n""",
)

# Read-only status and command-card cost labels consume the same quote source.
replace_once(
    "src/state/statusHelpers.ts",
    """  BUILDER_PRODUCTION_MATTER_COST,\n  BUILDER_PRODUCTION_ELEMENT_COST,\n  HARVESTER_PRODUCTION_MATTER_COST,\n  HARVESTER_PRODUCTION_ELEMENT_COST,\n  WASP_SMOKY_TOTAL_MATTER_COST,\n  WASP_SMOKY_TOTAL_ELEMENT_COST,\n  QUEUE_LIMIT,\n""",
    """  QUEUE_LIMIT,\n""",
)
replace_once(
    "src/state/statusHelpers.ts",
    "import { isVisualReadyBuilding } from '../config/buildingRuntimeMapping';\n",
    "import { isVisualReadyBuilding } from '../config/buildingRuntimeMapping';\nimport { getProductionQuote } from './production';\n",
)
replace_once(
    "src/state/statusHelpers.ts",
    """    const matterCost = getMatterCostForType(nextUnitType);\n    const elementCost = getElementCostForType(nextUnitType);\n\n    if (state.economy.matter < matterCost) {\n""",
    """    const quote = getProductionQuote(nextUnitType);\n    if (!quote) return 'blocked-no-matter';\n\n    if (state.economy.matter < quote.matterCost) {\n""",
)
replace_once(
    "src/state/statusHelpers.ts",
    "if (state.economy.elements[state.playerFaction] < elementCost) {",
    "if (state.economy.elements[state.playerFaction] < quote.elementCost) {",
)
replace_once(
    "src/state/statusHelpers.ts",
    """  const matterCost = getMatterCostForType(unitType);\n  if (state.economy.matter < matterCost) {\n""",
    """  const quote = getProductionQuote(unitType);\n  if (!quote) return 'insufficient-matter';\n  if (state.economy.matter < quote.matterCost) {\n""",
)
replace_once(
    "src/state/statusHelpers.ts",
    """  const elementCost = getElementCostForType(unitType);\n  if (state.economy.elements[state.playerFaction] < elementCost) {\n""",
    """  if (state.economy.elements[state.playerFaction] < quote.elementCost) {\n""",
)
status_path = ROOT / "src/state/statusHelpers.ts"
status_text = status_path.read_text(encoding="utf-8")
cost_start = status_text.index("// ─── Cost lookup helpers")
cost_end = status_text.index("// ─── Unit cap helpers", cost_start)
status_path.write_text(status_text[:cost_start] + status_text[cost_end:], encoding="utf-8")
replace_once(
    "src/state/statusHelpers.ts",
    "return state.mapData.builders.length + state.harvesters.length + state.combatUnits.length;",
    "return state.mapData.builders.length + state.harvesters.length + (state.combatUnits?.length ?? 0);",
)

replace_once(
    "src/phaser/ui/hud/commandPanelViewModel.ts",
    """import {\n  BUILDER_PRODUCTION_MATTER_COST,\n  BUILDER_PRODUCTION_ELEMENT_COST,\n  HARVESTER_PRODUCTION_MATTER_COST,\n  HARVESTER_PRODUCTION_ELEMENT_COST,\n  WASP_SMOKY_TOTAL_MATTER_COST,\n  WASP_SMOKY_TOTAL_ELEMENT_COST,\n} from '../../../state/types';\n""",
    "import { getProductionQuote } from '../../../state/production';\n",
)
replace_once(
    "src/phaser/ui/hud/commandPanelViewModel.ts",
    """function formatProduceCost(unitType: ProducibleUnitType): string {\n  switch (unitType) {\n    case 'builder': return `${BUILDER_PRODUCTION_MATTER_COST} M, ${BUILDER_PRODUCTION_ELEMENT_COST} E`;\n    case 'harvester': return `${HARVESTER_PRODUCTION_MATTER_COST} M, ${HARVESTER_PRODUCTION_ELEMENT_COST} E`;\n    case 'wasp-smoky': return `${WASP_SMOKY_TOTAL_MATTER_COST} M, ${WASP_SMOKY_TOTAL_ELEMENT_COST} E`;\n  }\n}\n""",
    """function formatProduceCost(unitType: ProducibleUnitType): string {\n  const quote = getProductionQuote(unitType);\n  return quote ? `${quote.matterCost} M, ${quote.elementCost} E` : '';\n}\n""",
)

# Focused configuration and state integration coverage.
test_path = ROOT / "src/__tests__/t1ProductionComponents.test.ts"
test_path.write_text(r'''import { describe, expect, it } from 'vitest';
import {
  T1_ASSEMBLY_OFFSET_MS,
  T1_BODY_COMPONENTS,
  T1_LEGAL_COMBINATIONS,
  T1_WEAPON_COMPONENTS,
  getT1CombatProductionQuote,
} from '../config/t1ProductionComponents';
import { createInitialState } from '../state/createInitialState';
import { getProductionQuote, startUnitProduction } from '../state/production';
import type { MapData, UnitProductionRequest } from '../state/types';
import { updateGameState } from '../state/updateGameState';

const EXPECTED = [
  { bodyId: 'wasp', weaponId: 'smoky', matterCost: 45, elementCost: 10, durationMs: 25_000 },
  { bodyId: 'hunter', weaponId: 'smoky', matterCost: 60, elementCost: 12, durationMs: 25_000 },
  { bodyId: 'wasp', weaponId: 'railgun', matterCost: 65, elementCost: 13, durationMs: 32_000 },
  { bodyId: 'hunter', weaponId: 'railgun', matterCost: 80, elementCost: 15, durationMs: 32_000 },
] as const;

function makeState() {
  const mapData: MapData = {
    width: 30,
    height: 30,
    terrain: Array.from({ length: 30 }, () => Array.from({ length: 30 }, () => 'sand' as const)),
    hq: { tx: 2, ty: 24, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [{ tx: 10, ty: 10, type: 'units-factory' }],
    builders: [],
    constructionSites: [],
  };
  const state = createInitialState(mapData, 'cyan');
  state.harvesters = [];
  state.extraHarvesters = [];
  state.combatUnits = [];
  state.economy.matter = 500;
  state.economy.matterCap = 1_000;
  state.economy.elements.cyan = 200;
  state.economy.elementCap = 1_000;
  return state;
}

function request(bodyId: string, weaponId: string): UnitProductionRequest {
  return {
    kind: 'combat',
    bodyId: bodyId as never,
    weaponId: weaponId as never,
    hullMod: 'm0',
    turretMod: 'm0',
  };
}

describe('SKIRMISH-P3A T1 production catalog', () => {
  it('keeps the accepted component values in one catalog', () => {
    expect(T1_ASSEMBLY_OFFSET_MS).toBe(7_000);
    expect(T1_BODY_COMPONENTS.wasp).toMatchObject({ matterCost: 20, elementCost: 5, productionDurationMs: 7_000 });
    expect(T1_BODY_COMPONENTS.hunter).toMatchObject({ matterCost: 35, elementCost: 7, productionDurationMs: 12_000 });
    expect(T1_WEAPON_COMPONENTS.smoky).toMatchObject({ matterCost: 25, elementCost: 5, productionDurationMs: 18_000 });
    expect(T1_WEAPON_COMPONENTS.railgun).toMatchObject({ matterCost: 45, elementCost: 8, productionDurationMs: 25_000 });
    expect(T1_LEGAL_COMBINATIONS).toHaveLength(4);
  });

  for (const expected of EXPECTED) {
    it(`quotes ${expected.bodyId} + ${expected.weaponId} additively`, () => {
      expect(getT1CombatProductionQuote(request(expected.bodyId, expected.weaponId))).toMatchObject(expected);
    });
  }

  it('keeps legacy wasp-smoky equivalent to the canonical T1 quote', () => {
    const legacy = getProductionQuote('wasp-smoky');
    expect(legacy).toMatchObject({ matterCost: 45, elementCost: 10, durationMs: 25_000 });
    expect(legacy?.request).toEqual(request('wasp', 'smoky'));
  });

  it('rejects non-T1 component selections', () => {
    expect(getT1CombatProductionQuote(request('dictator', 'smoky'))).toBeNull();
    expect(getT1CombatProductionQuote(request('wasp', 'thunder'))).toBeNull();
  });
});

describe('SKIRMISH-P3A structured production integration', () => {
  for (const expected of EXPECTED) {
    it(`queues and spawns ${expected.bodyId} + ${expected.weaponId}`, () => {
      const state = makeState();
      const input = request(expected.bodyId, expected.weaponId);
      const matterBefore = state.economy.matter;
      const elementsBefore = state.economy.elements.cyan;

      expect(startUnitProduction(state, 10, 10, input)).toEqual({ ok: true });
      const item = state.production.factories[0].queue[0];
      expect(item.unitType).toBe('wasp-smoky');
      expect(item.request).toEqual(input);
      expect(item.durationMs).toBe(expected.durationMs);
      expect(state.economy.matter).toBe(matterBefore - expected.matterCost);
      expect(state.economy.elements.cyan).toBe(elementsBefore - expected.elementCost);

      item.elapsedMs = item.durationMs;
      item.progress = 1;
      item.completed = true;
      updateGameState(state, 1);

      expect(state.production.factories[0].queue).toHaveLength(0);
      expect(state.combatUnits).toHaveLength(1);
      expect(state.combatUnits[0]).toMatchObject({
        bodyId: expected.bodyId,
        weaponId: expected.weaponId,
        hullMod: 'm0',
        turretMod: 'm0',
      });
    });
  }

  it('rejects unsupported structured requests without mutating economy or queue', () => {
    const state = makeState();
    const matterBefore = state.economy.matter;
    const elementsBefore = state.economy.elements.cyan;
    const invalid = request('dictator', 'smoky');

    expect(startUnitProduction(state, 10, 10, invalid)).toEqual({
      ok: false,
      reason: 'unsupported-unit-type',
    });
    expect(state.economy.matter).toBe(matterBefore);
    expect(state.economy.elements.cyan).toBe(elementsBefore);
    expect(state.production.factories[0].queue).toHaveLength(0);
  });
});
''', encoding="utf-8")
