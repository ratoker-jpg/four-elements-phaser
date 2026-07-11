import type { MapData, ResourcePlacement } from './types';

export const CENTER_INFINITY_FOOTPRINT = 2;
export const CENTER_PROTECTION_MARGIN = 2;

export interface TilePosition {
  tx: number;
  ty: number;
}

export interface TileBounds {
  minTx: number;
  minTy: number;
  maxTx: number;
  maxTy: number;
}

export type CenterApproachDirection = 'north' | 'east' | 'south' | 'west';

export interface CenterApproachSector {
  direction: CenterApproachDirection;
  tiles: TilePosition[];
}

export function createCenterInfinityPlacement(
  width: number,
  height: number,
): ResourcePlacement {
  return {
    tx: Math.floor(width / 2) - 1,
    ty: Math.floor(height / 2) - 1,
    type: 'infinite',
    footprint: CENTER_INFINITY_FOOTPRINT,
    resourceClass: 'infinite',
  };
}

export function getCenterProtectionBounds(
  width: number,
  height: number,
): TileBounds {
  const infinity = createCenterInfinityPlacement(width, height);
  return {
    minTx: Math.max(0, infinity.tx - CENTER_PROTECTION_MARGIN),
    minTy: Math.max(0, infinity.ty - CENTER_PROTECTION_MARGIN),
    maxTx: Math.min(
      width - 1,
      infinity.tx + CENTER_INFINITY_FOOTPRINT - 1 + CENTER_PROTECTION_MARGIN,
    ),
    maxTy: Math.min(
      height - 1,
      infinity.ty + CENTER_INFINITY_FOOTPRINT - 1 + CENTER_PROTECTION_MARGIN,
    ),
  };
}

export function getCenterProtectedTiles(
  width: number,
  height: number,
): TilePosition[] {
  const bounds = getCenterProtectionBounds(width, height);
  const tiles: TilePosition[] = [];
  for (let ty = bounds.minTy; ty <= bounds.maxTy; ty++) {
    for (let tx = bounds.minTx; tx <= bounds.maxTx; tx++) {
      tiles.push({ tx, ty });
    }
  }
  return tiles;
}

export function isTileInCenterProtectionZone(
  tx: number,
  ty: number,
  width: number,
  height: number,
): boolean {
  const bounds = getCenterProtectionBounds(width, height);
  return tx >= bounds.minTx
    && tx <= bounds.maxTx
    && ty >= bounds.minTy
    && ty <= bounds.maxTy;
}

/** Two-tile-wide cardinal approach sectors directly adjacent to the 2x2 deposit. */
export function getCenterApproachSectors(
  width: number,
  height: number,
): CenterApproachSector[] {
  const infinity = createCenterInfinityPlacement(width, height);
  return [
    {
      direction: 'north',
      tiles: [
        { tx: infinity.tx, ty: infinity.ty - 1 },
        { tx: infinity.tx + 1, ty: infinity.ty - 1 },
      ],
    },
    {
      direction: 'east',
      tiles: [
        { tx: infinity.tx + CENTER_INFINITY_FOOTPRINT, ty: infinity.ty },
        { tx: infinity.tx + CENTER_INFINITY_FOOTPRINT, ty: infinity.ty + 1 },
      ],
    },
    {
      direction: 'south',
      tiles: [
        { tx: infinity.tx, ty: infinity.ty + CENTER_INFINITY_FOOTPRINT },
        { tx: infinity.tx + 1, ty: infinity.ty + CENTER_INFINITY_FOOTPRINT },
      ],
    },
    {
      direction: 'west',
      tiles: [
        { tx: infinity.tx - 1, ty: infinity.ty },
        { tx: infinity.tx - 1, ty: infinity.ty + 1 },
      ],
    },
  ];
}

export function isExactCenterInfinity(
  resource: ResourcePlacement,
  width: number,
  height: number,
): boolean {
  const expected = createCenterInfinityPlacement(width, height);
  return resource.tx === expected.tx
    && resource.ty === expected.ty
    && resource.footprint === expected.footprint
    && resource.type === 'infinite'
    && resource.resourceClass === 'infinite';
}

function footprintTiles(
  tx: number,
  ty: number,
  footprint: number,
): TilePosition[] {
  const tiles: TilePosition[] = [];
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      tiles.push({ tx: tx + dx, ty: ty + dy });
    }
  }
  return tiles;
}

function tileKey(tile: TilePosition): string {
  return `${tile.tx},${tile.ty}`;
}

/** Structural P5C validation independent of Phaser/GameState. */
export function validateCenterInfinityContract(mapData: MapData): string[] {
  const issues: string[] = [];
  const infiniteResources = mapData.resources.filter(resource =>
    resource.type === 'infinite' || resource.resourceClass === 'infinite',
  );
  if (infiniteResources.length !== 1) {
    issues.push(`Center Infinity count must be 1, found ${infiniteResources.length}`);
    return issues;
  }

  const infinity = infiniteResources[0];
  if (!isExactCenterInfinity(infinity, mapData.width, mapData.height)) {
    issues.push('Infinity deposit is not the exact canonical centered 2x2 placement');
  }

  const protectedTiles = new Set(
    getCenterProtectedTiles(mapData.width, mapData.height).map(tileKey),
  );
  for (const resource of mapData.resources) {
    if (resource === infinity) continue;
    if (footprintTiles(resource.tx, resource.ty, resource.footprint)
      .some(tile => protectedTiles.has(tileKey(tile)))) {
      issues.push('Finite resource intersects the protected center zone');
      break;
    }
  }

  for (const hq of mapData.headquarters ?? [mapData.hq]) {
    if (footprintTiles(hq.tx, hq.ty, 3)
      .some(tile => protectedTiles.has(tileKey(tile)))) {
      issues.push(`Headquarters ${hq.faction} intersects the protected center zone`);
    }
  }

  const blockers = new Set<string>();
  for (const resource of mapData.resources) {
    for (const tile of footprintTiles(resource.tx, resource.ty, resource.footprint)) {
      blockers.add(tileKey(tile));
    }
  }
  for (const hq of mapData.headquarters ?? [mapData.hq]) {
    for (const tile of footprintTiles(hq.tx, hq.ty, 3)) blockers.add(tileKey(tile));
  }
  for (const obstacle of mapData.obstacles) {
    for (const tile of footprintTiles(obstacle.tx, obstacle.ty, obstacle.footprint)) {
      blockers.add(tileKey(tile));
    }
  }

  for (const sector of getCenterApproachSectors(mapData.width, mapData.height)) {
    const valid = sector.tiles.every(tile =>
      tile.tx >= 0
      && tile.ty >= 0
      && tile.tx < mapData.width
      && tile.ty < mapData.height
      && !blockers.has(tileKey(tile)),
    );
    if (!valid) issues.push(`Center ${sector.direction} approach sector is blocked`);
  }

  return issues;
}
