import type { Faction, HqPlacement, MapData, TeamId } from './types';
import { mirrorPlacement } from './mapSymmetry';

export const HQ_FOOTPRINT = 3;
export const HQ_CORNER_MARGIN = 4;
export const HEADQUARTERS_MAX_HP = 4000;
export const HEADQUARTERS_ARMOR = 0.20;
export const HEADQUARTERS_DAMAGE_FLASH_MS = 220;

export const FOUR_CORNER_FACTIONS: readonly Faction[] = [
  'cyan',
  'green',
  'yellow',
  'purple',
] as const;

function teamIdForMapFaction(faction: Faction): TeamId {
  return `team-${faction}` as TeamId;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Upgrade one Headquarters placement into the canonical combat shape. */
export function normalizeHeadquartersRuntime(
  hq: HqPlacement,
  faction: Faction = hq.faction,
  ownerTeamId: TeamId = hq.ownerTeamId ?? teamIdForMapFaction(faction),
): HqPlacement {
  const maxHp = Math.max(1, finiteOr(hq.maxHp, HEADQUARTERS_MAX_HP));
  const hp = Math.max(0, Math.min(maxHp, finiteOr(hq.hp, maxHp)));
  const isDestroyed = hq.isDestroyed === true || hp <= 0;
  return Object.assign(hq, {
    faction,
    ownerTeamId,
    id: `hq-${ownerTeamId}`,
    maxHp,
    hp: isDestroyed ? 0 : hp,
    armor: Math.max(0, Math.min(0.95, finiteOr(hq.armor, HEADQUARTERS_ARMOR))),
    isDestroyed,
    destroyedAt: isDestroyed
      ? Math.max(0, finiteOr(hq.destroyedAt ?? undefined, 0))
      : null,
    damageFlashUntilMs: Math.max(0, finiteOr(hq.damageFlashUntilMs, 0)),
    lastDamageAmount: Math.max(0, finiteOr(hq.lastDamageAmount, 0)),
  });
}

export function getHeadquartersCenter(hq: HqPlacement): { tx: number; ty: number } {
  return { tx: hq.tx + 1, ty: hq.ty + 1 };
}

/**
 * Create four deterministic 3x3 Headquarters from one accepted south-west placement.
 *
 * Corner mapping:
 * - cyan: south-west
 * - green: north-west
 * - yellow: north-east
 * - purple: south-east
 */
export function createFourCornerHeadquarters(
  width: number,
  height: number,
): HqPlacement[] {
  if (width < 2 * HQ_CORNER_MARGIN + 2 * HQ_FOOTPRINT
      || height < 2 * HQ_CORNER_MARGIN + 2 * HQ_FOOTPRINT) {
    throw new Error(`Map ${width}x${height} is too small for four Headquarters`);
  }

  const southWest = {
    tx: HQ_CORNER_MARGIN,
    ty: height - HQ_CORNER_MARGIN - HQ_FOOTPRINT,
    footprint: HQ_FOOTPRINT,
  };
  const northWest = mirrorPlacement(southWest, width, height, 'horizontal');
  const northEast = mirrorPlacement(southWest, width, height, 'rotational');
  const southEast = mirrorPlacement(southWest, width, height, 'vertical');

  const placements: Array<[Faction, { tx: number; ty: number }]> = [
    ['cyan', southWest],
    ['green', northWest],
    ['yellow', northEast],
    ['purple', southEast],
  ];

  return placements.map(([faction, placement]) => ({
    tx: placement.tx,
    ty: placement.ty,
    faction,
    ownerTeamId: teamIdForMapFaction(faction),
  }));
}

/** Return canonical HQ placements, falling back to the legacy human HQ. */
export function getMapHeadquarters(mapData: MapData): HqPlacement[] {
  if (Array.isArray(mapData.headquarters) && mapData.headquarters.length > 0) {
    return mapData.headquarters;
  }
  return mapData.hq ? [mapData.hq] : [];
}

/**
 * Normalize new and legacy map data in place.
 *
 * Generated/new maps retain one canonical entry per faction. Legacy maps get one
 * human-owned HQ only; the other TeamState records remain without map HQ entities.
 * `mapData.hq` is always rebound to the selected human faction for compatibility.
 */
export function normalizeMapHeadquarters(
  mapData: MapData,
  humanFaction: Faction,
): HqPlacement[] {
  const source = Array.isArray(mapData.headquarters) && mapData.headquarters.length > 0
    ? mapData.headquarters
    : [{ ...mapData.hq, faction: humanFaction }];

  const byFaction = new Map<Faction, HqPlacement>();
  for (const candidate of source) {
    const faction = candidate.faction;
    if (!FOUR_CORNER_FACTIONS.includes(faction)) continue;
    if (byFaction.has(faction)) continue;
    if (candidate.tx < 0 || candidate.ty < 0
        || candidate.tx + HQ_FOOTPRINT > mapData.width
        || candidate.ty + HQ_FOOTPRINT > mapData.height) {
      continue;
    }
    const ownerTeamId = teamIdForMapFaction(faction);
    byFaction.set(
      faction,
      normalizeHeadquartersRuntime(candidate, faction, ownerTeamId),
    );
  }

  if (!byFaction.has(humanFaction)) {
    const legacy = mapData.hq;
    const ownerTeamId = teamIdForMapFaction(humanFaction);
    byFaction.set(
      humanFaction,
      normalizeHeadquartersRuntime(legacy, humanFaction, ownerTeamId),
    );
  }

  const headquarters = FOUR_CORNER_FACTIONS
    .map(faction => byFaction.get(faction))
    .filter((hq): hq is HqPlacement => hq !== undefined);
  const humanHq = byFaction.get(humanFaction)!;

  mapData.headquarters = headquarters;
  mapData.hq = { ...humanHq };
  return headquarters;
}

export function headquartersDoNotOverlap(headquarters: readonly HqPlacement[]): boolean {
  const occupied = new Set<string>();
  for (const hq of headquarters) {
    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        const key = `${hq.tx + dx},${hq.ty + dy}`;
        if (occupied.has(key)) return false;
        occupied.add(key);
      }
    }
  }
  return true;
}
