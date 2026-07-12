import { describe, expect, it } from 'vitest';
import {
  findBuildSiteNearBuilder,
  placeConstructionNearBuilder,
} from '../state/buildSiteSelection';
import { BUILDING_CONFIG } from '../state/construction';
import { createInitialState } from '../state/createInitialState';
import type { BuilderPlacement, MapData, ObstaclePlacement, TeamId } from '../state/types';

function builder(
  id: string,
  tx: number,
  ty: number,
  ownerTeamId: TeamId = 'team-cyan',
): BuilderPlacement {
  return {
    id,
    ownerTeamId,
    tx,
    ty,
    ftx: tx,
    fty: ty,
    targetTx: tx,
    targetTy: ty,
    busy: false,
    phase: 'idle',
    path: [],
    pathIndex: 0,
    assignedSiteId: -1,
  };
}

function makeState(options?: {
  builders?: BuilderPlacement[];
  obstacles?: ObstaclePlacement[];
  buildings?: MapData['buildings'];
  matter?: number;
}) {
  const width = 32;
  const height = 32;
  const map: MapData = {
    width,
    height,
    terrain: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => 'sand' as const),
    ),
    hq: { tx: 1, ty: 26, faction: 'cyan', ownerTeamId: 'team-cyan' },
    resources: [],
    obstacles: options?.obstacles ?? [],
    decor: [],
    buildings: options?.buildings ?? [],
    builders: options?.builders ?? [builder('builder-a', 20, 10)],
    constructionSites: [],
  };
  const state = createInitialState(map, 'cyan');
  state.match!.teams['team-cyan'].economy.matter = options?.matter ?? 500;
  state.economy = state.match!.teams['team-cyan'].economy;
  return state;
}

function siteCenter(result: { tx: number; ty: number }) {
  const config = BUILDING_CONFIG.separator!;
  return {
    tx: result.tx + Math.floor(config.footprintW / 2),
    ty: result.ty + Math.floor(config.footprintH / 2),
  };
}

describe('SKIRMISH-P7 Builder-local automatic construction', () => {
  it('uses the selected Builder position rather than Headquarters/building anchors', () => {
    const state = makeState();
    const first = findBuildSiteNearBuilder(state, 'separator', 'builder-a', { maxRadius: 8 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstCenter = siteCenter(first);
    expect(Math.abs(firstCenter.tx - 20) + Math.abs(firstCenter.ty - 10)).toBeLessThanOrEqual(3);

    const selected = state.mapData.builders.find(unit => unit.id === 'builder-a')!;
    selected.ftx = 10;
    selected.fty = 18;
    selected.tx = 10;
    selected.ty = 18;
    const second = findBuildSiteNearBuilder(state, 'separator', 'builder-a', { maxRadius: 8 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect({ tx: second.tx, ty: second.ty }).not.toEqual({ tx: first.tx, ty: first.ty });
    const secondCenter = siteCenter(second);
    expect(Math.abs(secondCenter.tx - 10) + Math.abs(secondCenter.ty - 18)).toBeLessThanOrEqual(3);
  });

  it('is deterministic and returns a cardinal reachable path', () => {
    const state = makeState();
    const results = Array.from({ length: 5 }, () =>
      findBuildSiteNearBuilder(state, 'separator', 'builder-a', { maxRadius: 8 }),
    );
    for (const result of results.slice(1)) expect(result).toEqual(results[0]);
    expect(results[0].ok).toBe(true);
    if (!results[0].ok) return;
    let previous = { tx: 20, ty: 10 };
    for (const step of results[0].path) {
      expect(Math.abs(step.tx - previous.tx) + Math.abs(step.ty - previous.ty)).toBe(1);
      previous = step;
    }
  });

  it('atomically assigns the exact selected Builder and deducts its owner economy once', () => {
    const state = makeState({
      builders: [
        builder('builder-a', 6, 22),
        builder('builder-b', 22, 8),
      ],
      matter: 500,
    });
    const result = placeConstructionNearBuilder(
      state,
      'separator',
      'builder-b',
      { maxRadius: 8 },
      'team-cyan',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const indexA = state.mapData.builders.findIndex(unit => unit.id === 'builder-a');
    const indexB = state.mapData.builders.findIndex(unit => unit.id === 'builder-b');
    const site = state.mapData.constructionSites.find(candidate =>
      `site-${candidate.id}` === result.siteId,
    )!;
    expect(site.builderIndex).toBe(indexB);
    expect(site.builderIndex).not.toBe(indexA);
    expect(state.mapData.builders[indexA]).toEqual(expect.objectContaining({
      busy: false,
      phase: 'idle',
    }));
    expect(state.mapData.builders[indexB].busy).toBe(true);
    expect(['moving-to-site', 'building']).toContain(state.mapData.builders[indexB].phase);
    expect(state.economy.matter).toBe(500 - BUILDING_CONFIG.separator!.costMatter);
  });

  it('uses and charges the selected Builder owner team only', () => {
    const state = makeState({
      builders: [builder('green-builder', 22, 8, 'team-green')],
      matter: 500,
    });
    state.match!.teams['team-green'].economy.matter = 300;
    const cyanBefore = state.match!.teams['team-cyan'].economy.matter;
    const result = placeConstructionNearBuilder(
      state,
      'separator',
      'green-builder',
      { maxRadius: 8 },
      'team-green',
    );
    expect(result.ok).toBe(true);
    expect(state.match!.teams['team-green'].economy.matter)
      .toBe(300 - BUILDING_CONFIG.separator!.costMatter);
    expect(state.match!.teams['team-cyan'].economy.matter).toBe(cyanBefore);
    expect(state.mapData.constructionSites[0].ownerTeamId).toBe('team-green');
  });

  it('rejects foreign, busy, destroyed and missing Builders without mutation', () => {
    const state = makeState({ builders: [builder('green-builder', 20, 10, 'team-green')] });
    const beforeMatter = state.economy.matter;
    expect(findBuildSiteNearBuilder(
      state,
      'separator',
      'green-builder',
      undefined,
      'team-cyan',
    )).toEqual({ ok: false, reason: 'foreign-builder' });

    const unit = state.mapData.builders[0];
    unit.ownerTeamId = 'team-cyan';
    unit.busy = true;
    expect(findBuildSiteNearBuilder(state, 'separator', unit.id))
      .toEqual({ ok: false, reason: 'builder-unavailable' });
    unit.busy = false;
    unit.isDestroyed = true;
    expect(findBuildSiteNearBuilder(state, 'separator', unit.id))
      .toEqual({ ok: false, reason: 'builder-unavailable' });
    expect(findBuildSiteNearBuilder(state, 'separator', 'missing'))
      .toEqual({ ok: false, reason: 'builder-not-found' });
    expect(state.economy.matter).toBe(beforeMatter);
    expect(state.mapData.constructionSites).toEqual([]);
  });

  it('does not charge matter when resources are insufficient', () => {
    const state = makeState({ matter: BUILDING_CONFIG.separator!.costMatter - 1 });
    const before = structuredClone({
      matter: state.economy.matter,
      builders: state.mapData.builders,
      sites: state.mapData.constructionSites,
      nextConstructionId: state.nextConstructionId,
    });
    const result = placeConstructionNearBuilder(state, 'separator', 'builder-a');
    expect(result).toEqual({ ok: false, reason: 'insufficient-resources' });
    expect({
      matter: state.economy.matter,
      builders: state.mapData.builders,
      sites: state.mapData.constructionSites,
      nextConstructionId: state.nextConstructionId,
    }).toEqual(before);
  });

  it('rejects legal-looking but unreachable sites and preserves resources', () => {
    const blockers: ObstaclePlacement[] = [
      { tx: 20, ty: 9, type: 'mountain-small', footprint: 1 },
      { tx: 21, ty: 10, type: 'mountain-small', footprint: 1 },
      { tx: 20, ty: 11, type: 'mountain-small', footprint: 1 },
      { tx: 19, ty: 10, type: 'mountain-small', footprint: 1 },
    ];
    const state = makeState({ obstacles: blockers, matter: 500 });
    const beforeMatter = state.economy.matter;
    const result = placeConstructionNearBuilder(
      state,
      'separator',
      'builder-a',
      { maxRadius: 6 },
    );
    expect(result).toEqual({ ok: false, reason: 'no-valid-site' });
    expect(state.economy.matter).toBe(beforeMatter);
    expect(state.mapData.constructionSites).toEqual([]);
  });

  it('preserves one complete empty tile between building footprints', () => {
    const state = makeState({
      buildings: [{ tx: 17, ty: 7, type: 'separator', ownerTeamId: 'team-cyan' }],
    });
    const result = findBuildSiteNearBuilder(
      state,
      'separator',
      'builder-a',
      { maxRadius: 10, gapTiles: 1 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const config = BUILDING_CONFIG.separator!;
    const existing = { tx: 17, ty: 7, w: config.footprintW, h: config.footprintH };
    const expanded = {
      tx: existing.tx - 1,
      ty: existing.ty - 1,
      w: existing.w + 2,
      h: existing.h + 2,
    };
    const overlaps = result.tx < expanded.tx + expanded.w
      && result.tx + config.footprintW > expanded.tx
      && result.ty < expanded.ty + expanded.h
      && result.ty + config.footprintH > expanded.ty;
    expect(overlaps).toBe(false);
  });
});
