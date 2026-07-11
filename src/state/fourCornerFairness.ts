import { BUILDING_CONFIG } from './construction';
import {
  getCenterApproachSectors,
  validateCenterInfinityContract,
} from './centerInfinity';
import {
  createFourCornerHeadquarters,
  getHeadquartersCenter,
  getMapHeadquarters,
  HQ_FOOTPRINT,
} from './mapHeadquarters';
import {
  getFiniteResourceValueByQuadrant,
  getResourceQuadrant,
  type ResourceQuadrant,
} from './symmetricResources';
import type {
  Faction,
  HqPlacement,
  MapData,
  ResourcePlacement,
  TeamId,
} from './types';

export const MIN_START_EXITS = 2;
export const MIN_REACHABLE_STARTER_RESOURCES = 2;
export const STARTER_RESOURCE_DISTANCE = 12;

export interface TeamFairnessReport {
  faction: Faction;
  teamId: TeamId;
  exitCount: number;
  reachableStarterResources: number;
  centerReachable: boolean;
  issues: string[];
}

export interface FourCornerFairnessResult {
  valid: boolean;
  issues: string[];
  teams: Record<Faction, TeamFairnessReport>;
  finiteResourceValue: Record<ResourceQuadrant, number>;
  structuralFingerprint: string;
}

interface Tile {
  tx: number;
  ty: number;
}

interface ExitSector {
  direction: 'north' | 'east' | 'south' | 'west';
  tiles: Tile[];
}

const FACTIONS: readonly Faction[] = ['cyan', 'green', 'yellow', 'purple'];
const CARDINAL_STEPS: readonly Tile[] = [
  { tx: 0, ty: -1 },
  { tx: 1, ty: 0 },
  { tx: 0, ty: 1 },
  { tx: -1, ty: 0 },
];

function key(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

function isInBounds(mapData: MapData, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < mapData.width && ty < mapData.height;
}

function markFootprint(
  blocked: Set<string>,
  tx: number,
  ty: number,
  width: number,
  height: number,
): void {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) blocked.add(key(tx + dx, ty + dy));
  }
}

function buildStaticBlockers(mapData: MapData): Set<string> {
  const blocked = new Set<string>();
  for (const hq of getMapHeadquarters(mapData)) {
    markFootprint(blocked, hq.tx, hq.ty, HQ_FOOTPRINT, HQ_FOOTPRINT);
  }
  for (const resource of mapData.resources) {
    markFootprint(
      blocked,
      resource.tx,
      resource.ty,
      resource.footprint,
      resource.footprint,
    );
  }
  for (const obstacle of mapData.obstacles) {
    markFootprint(
      blocked,
      obstacle.tx,
      obstacle.ty,
      obstacle.footprint,
      obstacle.footprint,
    );
  }
  for (const building of mapData.buildings) {
    const config = BUILDING_CONFIG[building.type];
    markFootprint(
      blocked,
      building.tx,
      building.ty,
      config?.footprintW ?? 1,
      config?.footprintH ?? 1,
    );
  }
  for (const site of mapData.constructionSites) {
    const config = BUILDING_CONFIG[site.type];
    markFootprint(
      blocked,
      site.tx,
      site.ty,
      config?.footprintW ?? 1,
      config?.footprintH ?? 1,
    );
  }
  return blocked;
}

function getHqExitSectors(hq: HqPlacement): ExitSector[] {
  return [
    {
      direction: 'north',
      tiles: Array.from({ length: HQ_FOOTPRINT }, (_, dx) => ({
        tx: hq.tx + dx,
        ty: hq.ty - 1,
      })),
    },
    {
      direction: 'east',
      tiles: Array.from({ length: HQ_FOOTPRINT }, (_, dy) => ({
        tx: hq.tx + HQ_FOOTPRINT,
        ty: hq.ty + dy,
      })),
    },
    {
      direction: 'south',
      tiles: Array.from({ length: HQ_FOOTPRINT }, (_, dx) => ({
        tx: hq.tx + dx,
        ty: hq.ty + HQ_FOOTPRINT,
      })),
    },
    {
      direction: 'west',
      tiles: Array.from({ length: HQ_FOOTPRINT }, (_, dy) => ({
        tx: hq.tx - 1,
        ty: hq.ty + dy,
      })),
    },
  ];
}

function passableTiles(
  mapData: MapData,
  blocked: ReadonlySet<string>,
  tiles: readonly Tile[],
): Tile[] {
  return tiles.filter(tile =>
    isInBounds(mapData, tile.tx, tile.ty) && !blocked.has(key(tile.tx, tile.ty)),
  );
}

function adjacentPassableTiles(
  mapData: MapData,
  blocked: ReadonlySet<string>,
  placement: Pick<ResourcePlacement, 'tx' | 'ty' | 'footprint'>,
): Tile[] {
  const candidates: Tile[] = [];
  for (let dx = 0; dx < placement.footprint; dx++) {
    candidates.push({ tx: placement.tx + dx, ty: placement.ty - 1 });
    candidates.push({
      tx: placement.tx + dx,
      ty: placement.ty + placement.footprint,
    });
  }
  for (let dy = 0; dy < placement.footprint; dy++) {
    candidates.push({ tx: placement.tx - 1, ty: placement.ty + dy });
    candidates.push({
      tx: placement.tx + placement.footprint,
      ty: placement.ty + dy,
    });
  }
  const seen = new Set<string>();
  return passableTiles(mapData, blocked, candidates).filter(tile => {
    const tileKey = key(tile.tx, tile.ty);
    if (seen.has(tileKey)) return false;
    seen.add(tileKey);
    return true;
  });
}

function canReachAny(
  mapData: MapData,
  blocked: ReadonlySet<string>,
  starts: readonly Tile[],
  goals: readonly Tile[],
): boolean {
  const goalKeys = new Set(goals.map(tile => key(tile.tx, tile.ty)));
  if (goalKeys.size === 0) return false;

  const queue: Tile[] = [];
  const visited = new Set<string>();
  for (const start of starts) {
    if (!isInBounds(mapData, start.tx, start.ty)) continue;
    const startKey = key(start.tx, start.ty);
    if (blocked.has(startKey) || visited.has(startKey)) continue;
    if (goalKeys.has(startKey)) return true;
    visited.add(startKey);
    queue.push(start);
  }

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const step of CARDINAL_STEPS) {
      const next = { tx: current.tx + step.tx, ty: current.ty + step.ty };
      if (!isInBounds(mapData, next.tx, next.ty)) continue;
      const nextKey = key(next.tx, next.ty);
      if (blocked.has(nextKey) || visited.has(nextKey)) continue;
      if (goalKeys.has(nextKey)) return true;
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}

function getStarterResources(
  mapData: MapData,
  hq: HqPlacement,
): ResourcePlacement[] {
  const center = getHeadquartersCenter(hq);
  return mapData.resources.filter(resource => {
    if (resource.type === 'infinite' || resource.resourceClass === 'infinite') return false;
    if (getResourceQuadrant(resource, mapData.width, mapData.height) !== hq.faction) return false;
    const resourceCenterX = resource.tx + (resource.footprint - 1) / 2;
    const resourceCenterY = resource.ty + (resource.footprint - 1) / 2;
    return Math.hypot(resourceCenterX - center.tx, resourceCenterY - center.ty)
      <= STARTER_RESOURCE_DISTANCE;
  });
}

function validateHeadquartersContract(mapData: MapData): string[] {
  const issues: string[] = [];
  const headquarters = getMapHeadquarters(mapData);
  if (headquarters.length !== 4) {
    issues.push(`Expected exactly 4 Headquarters, found ${headquarters.length}`);
    return issues;
  }

  const factionSet = new Set(headquarters.map(hq => hq.faction));
  const ownerSet = new Set(headquarters.map(hq => hq.ownerTeamId));
  if (factionSet.size !== 4) issues.push('Headquarters factions are not unique');
  if (ownerSet.size !== 4 || ownerSet.has(undefined)) {
    issues.push('Headquarters ownerTeamId values are not four unique teams');
  }

  const expected = createFourCornerHeadquarters(mapData.width, mapData.height);
  for (const expectedHq of expected) {
    const actual = headquarters.find(hq => hq.faction === expectedHq.faction);
    if (!actual
        || actual.tx !== expectedHq.tx
        || actual.ty !== expectedHq.ty
        || actual.ownerTeamId !== expectedHq.ownerTeamId) {
      issues.push(`Headquarters ${expectedHq.faction} is not at its canonical corner`);
    }
  }
  return issues;
}

function buildTeamReport(
  mapData: MapData,
  hq: HqPlacement,
  blocked: ReadonlySet<string>,
): TeamFairnessReport {
  const issues: string[] = [];
  const centerGoals = getCenterApproachSectors(mapData.width, mapData.height)
    .flatMap(sector => passableTiles(mapData, blocked, sector.tiles));
  const exitSectors = getHqExitSectors(hq);
  const viableExitSectors = exitSectors.filter(sector => {
    const starts = passableTiles(mapData, blocked, sector.tiles);
    return starts.length > 0 && canReachAny(mapData, blocked, starts, centerGoals);
  });
  const spawnTiles = exitSectors.flatMap(sector =>
    passableTiles(mapData, blocked, sector.tiles),
  );
  const centerReachable = canReachAny(mapData, blocked, spawnTiles, centerGoals);

  let reachableStarterResources = 0;
  for (const resource of getStarterResources(mapData, hq)) {
    const resourceGoals = adjacentPassableTiles(mapData, blocked, resource);
    if (canReachAny(mapData, blocked, spawnTiles, resourceGoals)) {
      reachableStarterResources++;
    }
  }

  if (viableExitSectors.length < MIN_START_EXITS) {
    issues.push(
      `${hq.faction} start has ${viableExitSectors.length} viable exit sector(s); need ${MIN_START_EXITS}`,
    );
  }
  if (reachableStarterResources < MIN_REACHABLE_STARTER_RESOURCES) {
    issues.push(
      `${hq.faction} can reach ${reachableStarterResources} starter resource(s); need ${MIN_REACHABLE_STARTER_RESOURCES}`,
    );
  }
  if (!centerReachable) issues.push(`${hq.faction} cannot reach the center approaches`);

  return {
    faction: hq.faction,
    teamId: (hq.ownerTeamId ?? `team-${hq.faction}`) as TeamId,
    exitCount: viableExitSectors.length,
    reachableStarterResources,
    centerReachable,
    issues,
  };
}

/** Stable structural JSON excluding human aliases and player-specific starter units. */
export function createGeneratedMapStructuralFingerprint(mapData: MapData): string {
  const headquarters = [...getMapHeadquarters(mapData)]
    .map(hq => ({
      tx: hq.tx,
      ty: hq.ty,
      faction: hq.faction,
      ownerTeamId: hq.ownerTeamId,
    }))
    .sort((a, b) => a.faction.localeCompare(b.faction));
  return JSON.stringify({
    width: mapData.width,
    height: mapData.height,
    terrain: mapData.terrain,
    headquarters,
    resources: mapData.resources,
    obstacles: mapData.obstacles,
    decor: mapData.decor,
    buildings: mapData.buildings,
  });
}

export function validateFourCornerMapFairness(
  mapData: MapData,
): FourCornerFairnessResult {
  const issues = [
    ...validateHeadquartersContract(mapData),
    ...validateCenterInfinityContract(mapData),
  ];
  const blocked = buildStaticBlockers(mapData);
  const reports = {} as Record<Faction, TeamFairnessReport>;
  const headquarters = getMapHeadquarters(mapData);

  for (const faction of FACTIONS) {
    const hq = headquarters.find(candidate => candidate.faction === faction);
    if (!hq) {
      const missing: TeamFairnessReport = {
        faction,
        teamId: `team-${faction}`,
        exitCount: 0,
        reachableStarterResources: 0,
        centerReachable: false,
        issues: [`Missing Headquarters for ${faction}`],
      };
      reports[faction] = missing;
      issues.push(...missing.issues);
      continue;
    }
    const report = buildTeamReport(mapData, hq, blocked);
    reports[faction] = report;
    issues.push(...report.issues);
  }

  const finiteResourceValue = getFiniteResourceValueByQuadrant(
    mapData.resources,
    mapData.width,
    mapData.height,
  );
  const expectedValue = finiteResourceValue.cyan;
  if (expectedValue <= 0) issues.push('Finite resource value must be positive in every quadrant');
  for (const faction of FACTIONS.slice(1)) {
    if (finiteResourceValue[faction] !== expectedValue) {
      issues.push(
        `Finite resource value mismatch: cyan=${expectedValue}, ${faction}=${finiteResourceValue[faction]}`,
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    teams: reports,
    finiteResourceValue,
    structuralFingerprint: createGeneratedMapStructuralFingerprint(mapData),
  };
}
