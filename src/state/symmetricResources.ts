import type { AcceptedResourceClassId } from '../config/coreMechanicsTypes';
import {
  resolveResourceAnchors,
  type ResolvedAnchorPlacement,
} from '../config/resourceAnchors';
import { resolveResourceRawAmount } from '../config/resourceClassRuntime';
import type { Faction, HqPlacement, ResourcePlacement } from './types';
import { mirrorPlacement, type MapSymmetry } from './mapSymmetry';
import {
  createCenterInfinityPlacement, getCenterProtectedTiles,
} from './centerInfinity';

export type ResourceQuadrant = Faction;

const QUADRANT_MIRRORS: ReadonlyArray<{
  faction: ResourceQuadrant;
  mode: MapSymmetry | null;
}> = [
  { faction: 'cyan', mode: null },
  { faction: 'green', mode: 'horizontal' },
  { faction: 'yellow', mode: 'rotational' },
  { faction: 'purple', mode: 'vertical' },
] as const;

function placementTiles(
  placement: Pick<ResourcePlacement, 'tx' | 'ty' | 'footprint'>,
): string[] {
  const tiles: string[] = [];
  for (let dy = 0; dy < placement.footprint; dy++) {
    for (let dx = 0; dx < placement.footprint; dx++) {
      tiles.push(`${placement.tx + dx},${placement.ty + dy}`);
    }
  }
  return tiles;
}

function placementIsInBounds(
  placement: Pick<ResourcePlacement, 'tx' | 'ty' | 'footprint'>,
  width: number,
  height: number,
): boolean {
  return placement.tx >= 0
    && placement.ty >= 0
    && placement.tx + placement.footprint <= width
    && placement.ty + placement.footprint <= height;
}

function placementFitsQuadrant(
  placement: Pick<ResourcePlacement, 'tx' | 'ty' | 'footprint'>,
  width: number,
  height: number,
  quadrant: ResourceQuadrant,
): boolean {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const left = placement.tx;
  const right = placement.tx + placement.footprint;
  const top = placement.ty;
  const bottom = placement.ty + placement.footprint;

  switch (quadrant) {
    case 'cyan': return right <= centerX && top >= centerY;
    case 'green': return right <= centerX && bottom <= centerY;
    case 'yellow': return left >= centerX && bottom <= centerY;
    case 'purple': return left >= centerX && top >= centerY;
  }
}

function toResourcePlacement(
  placement: ResolvedAnchorPlacement,
): ResourcePlacement {
  return {
    tx: placement.tx,
    ty: placement.ty,
    type: placement.legacyType,
    footprint: placement.footprint,
    resourceClass: placement.resourceClass as AcceptedResourceClassId,
  };
}

function mirrorResourcePlacement(
  placement: ResourcePlacement,
  width: number,
  height: number,
  mode: MapSymmetry | null,
): ResourcePlacement {
  if (!mode) return { ...placement };
  const mirrored = mirrorPlacement(
    {
      tx: placement.tx,
      ty: placement.ty,
      footprint: placement.footprint,
    },
    width,
    height,
    mode,
  );
  return {
    ...placement,
    tx: mirrored.tx,
    ty: mirrored.ty,
  };
}

function quartetCanBePlaced(
  quartet: readonly ResourcePlacement[],
  width: number,
  height: number,
  occupied: ReadonlySet<string>,
): boolean {
  const quartetTiles = new Set<string>();
  for (let index = 0; index < quartet.length; index++) {
    const placement = quartet[index];
    const quadrant = QUADRANT_MIRRORS[index].faction;
    if (!placementIsInBounds(placement, width, height)) return false;
    if (!placementFitsQuadrant(placement, width, height, quadrant)) return false;
    for (const tile of placementTiles(placement)) {
      if (occupied.has(tile) || quartetTiles.has(tile)) return false;
      quartetTiles.add(tile);
    }
  }
  return true;
}

function markPlacement(
  occupied: Set<string>,
  placement: Pick<ResourcePlacement, 'tx' | 'ty' | 'footprint'>,
): void {
  for (const tile of placementTiles(placement)) occupied.add(tile);
}

/**
 * Generate one finite-resource layout from the cyan south-west start and mirror
 * accepted quartets to the other three quadrants. The center infinite deposit is
 * preserved once for P5C to harden further.
 */
export function createSymmetricGeneratedResources(
  rng: () => number,
  width: number,
  height: number,
  headquarters: readonly HqPlacement[],
  occupied: ReadonlySet<string>,
): ResourcePlacement[] {
  const cyanHq = headquarters.find(hq => hq.faction === 'cyan');
  if (!cyanHq) throw new Error('Symmetric resource generation requires the cyan Headquarters');

  const anchorOccupied = new Set(occupied);
  const resolved = resolveResourceAnchors(width, height, cyanHq, rng, anchorOccupied);
  const finite = resolved.filter(placement => placement.resourceClass !== 'infinite');

  const finalOccupied = new Set(occupied);
  const output: ResourcePlacement[] = [];

  // Reserve the full protected center zone before accepting contested quartets.
  // The exact 2x2 Infinity placement is canonical and no longer depends on anchors.
  const infinitePlacement = createCenterInfinityPlacement(width, height);
  for (const tile of getCenterProtectedTiles(width, height)) {
    finalOccupied.add(`${tile.tx},${tile.ty}`);
  }

  for (const baseResolved of finite) {
    const base = toResourcePlacement(baseResolved);
    const quartet = QUADRANT_MIRRORS.map(({ mode }) =>
      mirrorResourcePlacement(base, width, height, mode),
    );
    if (!quartetCanBePlaced(quartet, width, height, finalOccupied)) continue;
    for (const placement of quartet) {
      output.push(placement);
      markPlacement(finalOccupied, placement);
    }
  }

  output.push(infinitePlacement);
  return output;
}

export function getResourceQuadrant(
  resource: Pick<ResourcePlacement, 'tx' | 'ty' | 'footprint'>,
  width: number,
  height: number,
): ResourceQuadrant | null {
  for (const { faction } of QUADRANT_MIRRORS) {
    if (placementFitsQuadrant(resource, width, height, faction)) return faction;
  }
  return null;
}

/** Deterministic finite raw value totals used by fairness validation/tests. */
export function getFiniteResourceValueByQuadrant(
  resources: readonly ResourcePlacement[],
  width: number,
  height: number,
): Record<ResourceQuadrant, number> {
  const totals: Record<ResourceQuadrant, number> = {
    cyan: 0,
    green: 0,
    yellow: 0,
    purple: 0,
  };
  for (const resource of resources) {
    if (resource.resourceClass === 'infinite' || resource.type === 'infinite') continue;
    const quadrant = getResourceQuadrant(resource, width, height);
    if (!quadrant) continue;
    totals[quadrant] += resolveResourceRawAmount(resource);
  }
  return totals;
}
