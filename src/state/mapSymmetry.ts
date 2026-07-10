export type MapSymmetry = 'vertical' | 'horizontal' | 'rotational';

export interface TilePlacement {
  tx: number;
  ty: number;
  footprint?: number;
}

/**
 * Mirror a top-left tile placement while preserving its full square footprint.
 * This is a pure Phase 8 foundation helper and does not alter current map output.
 */
export function mirrorPlacement<T extends TilePlacement>(
  placement: T,
  width: number,
  height: number,
  symmetry: MapSymmetry,
): T {
  const footprint = placement.footprint ?? 1;
  let tx = placement.tx;
  let ty = placement.ty;

  if (symmetry === 'vertical' || symmetry === 'rotational') {
    tx = width - placement.tx - footprint;
  }
  if (symmetry === 'horizontal' || symmetry === 'rotational') {
    ty = height - placement.ty - footprint;
  }

  return { ...placement, tx, ty };
}

export function isPlacementInsideMap(
  placement: TilePlacement,
  width: number,
  height: number,
): boolean {
  const footprint = placement.footprint ?? 1;
  return placement.tx >= 0
    && placement.ty >= 0
    && placement.tx + footprint <= width
    && placement.ty + footprint <= height;
}

/** Stable key for structural symmetry assertions. */
export function placementKey(placement: TilePlacement): string {
  return `${placement.tx},${placement.ty},${placement.footprint ?? 1}`;
}

/**
 * Check whether every placement has its mirrored partner.
 * Callers with richer placement types can provide a discriminator key.
 */
export function arePlacementsSymmetric<T extends TilePlacement>(
  placements: readonly T[],
  width: number,
  height: number,
  symmetry: MapSymmetry,
  discriminator: (placement: T) => string = placement => placementKey(placement),
): boolean {
  const keys = new Set(placements.map(discriminator));
  return placements.every(placement => keys.has(discriminator(
    mirrorPlacement(placement, width, height, symmetry),
  )));
}
