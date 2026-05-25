# Building Placement Strategy

Status: implemented baseline, accepted direction  
Date: 2026-05-25  
Scope: completed building PNG placement in `four-elements-phaser`

## Current implementation status

The BUILD-ANCHOR baseline is implemented:

```text
DOC-01 — Building placement strategy                 ✅ merged PR #29
BUILD-ANCHOR-01 — BuildingPlacementMeta model        ✅ merged PR #30
BUILD-ANCHOR-02 — Offline alpha-bounds generator     ✅ merged PR #32
BUILD-ANCHOR-03 — South-vertex renderer formula      ✅ merged PR #33
```

Completed buildings now render through a metadata-driven PNG placement path when metadata and texture exist. The green diamond remains only as a fallback for missing metadata or missing textures.

This document remains the source of truth for the placement model and anti-goals.

## Problem

Completed building PNGs must sit correctly on their isometric footprints. The first Separator PNG pass showed that a simple placement formula is not reliable:

```text
footprint center + origin(0.5, 0.75) + fixed displayWidth + manual offset
```

That model visually misaligned the Separator and did not scale to all buildings.

Manual per-PNG tuning is not the production strategy. A dev tuner can help diagnose alignment, but it must not become the main placement system.

## Root cause

The naive placement model made the wrong assumptions:

1. It anchored buildings to the geometric center of the multi-tile footprint.
2. It assumed `originY = 0.75` was the ground contact line.
3. It assumed one fixed display width worked for all building PNGs.
4. It ignored alpha bounds, source image dimensions, and visible base position.
5. It treated the full rectangular PNG frame as if it were the building footprint.

For isometric buildings, the visual ground point must be derived from the footprint and generated metadata, not guessed per asset.

## Key rule: buildings anchor to the footprint south vertex

Buildings are not units. A completed building anchors to the footprint, not to a single tile center.

For square 2x2 buildings, the placement anchor is the south/bottom vertex of the footprint diamond. This is where the building visually rests on the terrain.

The Phaser renderer follows this concept without copying the old Canvas implementation directly.

## Phaser 4 capability notes

Phaser 4 provides useful APIs for applying placement once the model is known:

- `Image` / `Sprite`
- `setOrigin(x, y)`
- `setPosition(x, y)`
- `setScale()` / `setDisplaySize()`
- `setDepth()`
- `textures.exists()`
- Texture / Frame width and height

Phaser does not provide a built-in alpha-bounds or ground-line detector for PNG content. `getBounds()` returns the full rectangular object bounds, including transparent padding. `setCrop()` can crop only if crop bounds are already known.

Therefore alpha bounds and ground-line metadata are generated offline, not computed in the game loop.

## Implemented production approach

The current production path is a metadata-driven model:

1. Offline generator reads building PNGs.
2. Generator computes source dimensions and alpha bounds.
3. Generator computes the ground-line ratio from `alphaBounds.bottom / sourceHeight`.
4. Generator writes committed TypeScript metadata.
5. Runtime renderer reads metadata and positions buildings using one generic formula.
6. Dev tuner remains diagnostic only for verification and rare exceptions.

No runtime pixel scanning.
No permanent per-building manual offset tables as the default workflow.

## Ground-line decision

BUILD-ANCHOR-02 initially used a widest-row heuristic for `groundLineRatio`.

Visual QA showed that this was wrong for the current isometric building PNGs: the widest alpha row usually represented the building midsection, not the ground contact line.

Accepted rule:

```text
groundLineRatio = alphaBounds.bottom / sourceHeight
originY = groundLineRatio
```

This anchors the bottom of the visible building base to the footprint south vertex, so the building grows upward from the terrain instead of placing its midsection on the ground.

## Footprint-based scale decision

Building display width is based on footprint size, not per-building manual tuning.

Current target display widths:

```text
1x1 footprint -> 65px
2x2 footprint -> 128px
3x3 footprint -> 200px
```

For non-square footprints, the larger dimension determines the tier. For larger than 3x3 footprints, the generator uses a systemic extrapolation fallback.

This is a production sizing rule, not a per-PNG tuning table.

## Data model

A metadata entry describes how a building image maps onto its gameplay footprint.

```ts
export interface BuildingPlacementMeta {
  buildingType: BuildingType;
  faction: Faction;
  assetKey: string;

  sourceWidth: number;
  sourceHeight: number;

  alphaBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };

  visibleWidth: number;
  visibleHeight: number;

  footprintW: number;
  footprintH: number;

  anchorMode: 'south-vertex' | 'center';
  category: 'structure' | 'tower' | 'flat';

  groundLineRatio: number;
  originX: number;
  originY: number;

  targetDisplayWidth: number;
  computedScale: number;

  exceptionOffsetX?: number;
  exceptionOffsetY?: number;
}
```

Field ownership:

- `footprintW/footprintH` come from construction/building config when available.
- `sourceWidth/sourceHeight` come from the PNG.
- `alphaBounds/visibleWidth/visibleHeight` are generated offline.
- `groundLineRatio` is generated from alpha-bottom and visually approved.
- `targetDisplayWidth/computedScale` are generated from footprint size.
- `exceptionOffsetX/Y` are rare exceptions, not the default mechanism.

## Runtime renderer formula

At runtime, completed building rendering follows this pattern:

```text
1. Read BuildingPlacementMeta for player faction + building type.
2. Verify the texture exists.
3. Compute the isometric footprint south vertex.
4. Create or update Phaser Image for the building asset.
5. Apply scale from metadata.
6. Apply origin from metadata ground-line ratio.
7. Set image position to south vertex plus rare exception offset.
8. Set depth from bottom/right footprint tile.
9. Fall back to green diamond only if metadata or texture is missing.
```

Depth is based on the bottom/right tile of the footprint so completed buildings sort consistently with isometric objects in front/behind them.

## Dev tuner policy

A dev tuner is allowed only as a diagnostic and review tool.

It may:

- show footprint markers;
- show image anchor and position;
- temporarily adjust values in dev mode;
- print a copy-ready metadata snippet;
- help validate new assets.

It must not:

- become the production placement model;
- require manual tuning for every PNG;
- persist values into gameplay saves;
- hide missing texture or metadata problems;
- create a dual renderer/fallback rendering path.

## Buildings and units use different anchoring models

Buildings:

- anchor to a multi-tile footprint;
- use south-vertex placement;
- use metadata / alpha bounds;
- are static once placed.

Units:

- anchor to fractional tile position (`ftx/fty`);
- use sprite-sheet conventions;
- move every frame;
- should not use building alpha-bounds logic.

Modular tank body/turret socket logic is separate and must not be reused for buildings.

## Anti-goals

Do not:

- hardcode `offsetX/offsetY` for every PNG as the main workflow;
- manually tune every building one by one;
- mix building anchoring with gameplay/economy changes;
- add more building mechanics before the placement model is stable;
- add Canvas fallback rendering;
- add Rex dependencies;
- change Phaser version;
- touch Wasp/Smoky modular tank logic;
- copy old `four-elements-next` code directly.

## Remaining notes

Current non-separator building metadata may still use assumed 2x2 footprints until the real building configs exist. This is acceptable for the placement system baseline, but future building config work must keep metadata and `BUILDING_CONFIG` aligned.

## PR #28 disposition

PR #28 should not be merged as the final placement solution while it depends on manual `displayWidth/origin/offset` tuning.

Useful ideas from PR #28:

- completed building PNG rendering path;
- debug marker concept;
- dev tuner as a diagnostic tool.

But the production placement model is now `BuildingPlacementMeta` + alpha-bottom ground line + south-vertex anchoring.

## Validation expectations for future implementation PRs

Each implementation PR should run:

```bash
npm test
npm run typecheck
npm run build
```

For generator-related changes, also run:

```bash
npm run generate:building-meta
```

Manual QA should include:

- building Separator;
- verifying PNG alignment against footprint markers;
- checking at multiple zoom levels;
- verifying no missing texture warnings;
- verifying builder/harvester still work;
- verifying Wasp/Smoky are unaffected.
