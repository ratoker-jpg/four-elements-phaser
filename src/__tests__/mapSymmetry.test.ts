import { describe, expect, it } from 'vitest';
import {
  arePlacementsSymmetric,
  isPlacementInsideMap,
  mirrorPlacement,
} from '../state/mapSymmetry';

describe('map symmetry foundation', () => {
  it('mirrors a 1x1 placement rotationally', () => {
    expect(mirrorPlacement({ tx: 2, ty: 3 }, 10, 8, 'rotational')).toEqual({
      tx: 7,
      ty: 4,
    });
  });

  it('preserves a multi-tile footprint inside the mirrored map', () => {
    const mirrored = mirrorPlacement({ tx: 1, ty: 2, footprint: 3 }, 12, 10, 'rotational');
    expect(mirrored).toEqual({ tx: 8, ty: 5, footprint: 3 });
    expect(isPlacementInsideMap(mirrored, 12, 10)).toBe(true);
  });

  it('supports independent vertical and horizontal transforms', () => {
    const placement = { tx: 1, ty: 2, footprint: 2, type: 'resource' };
    expect(mirrorPlacement(placement, 10, 8, 'vertical')).toEqual({
      tx: 7, ty: 2, footprint: 2, type: 'resource',
    });
    expect(mirrorPlacement(placement, 10, 8, 'horizontal')).toEqual({
      tx: 1, ty: 4, footprint: 2, type: 'resource',
    });
  });

  it('detects complete rotational placement pairs', () => {
    const placements = [
      { tx: 1, ty: 2, footprint: 2, kind: 'rich' },
      { tx: 7, ty: 4, footprint: 2, kind: 'rich' },
    ];
    const discriminator = (placement: typeof placements[number]) =>
      `${placement.kind}:${placement.tx},${placement.ty},${placement.footprint}`;

    expect(arePlacementsSymmetric(placements, 10, 8, 'rotational', discriminator)).toBe(true);
  });

  it('rejects a placement set with a missing mirrored partner', () => {
    const placements = [{ tx: 1, ty: 2, footprint: 2 }];
    expect(arePlacementsSymmetric(placements, 10, 8, 'rotational')).toBe(false);
  });

  it('recognizes placements that exceed map bounds', () => {
    expect(isPlacementInsideMap({ tx: 8, ty: 1, footprint: 3 }, 10, 10)).toBe(false);
    expect(isPlacementInsideMap({ tx: 7, ty: 7, footprint: 3 }, 10, 10)).toBe(true);
  });
});
