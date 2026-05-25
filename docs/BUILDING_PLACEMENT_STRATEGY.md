# Building Placement Strategy

Status: accepted direction, docs-only
Date: 2026-05-25
Scope: completed building PNG placement in `four-elements-phaser`

## Problem

Completed building PNGs must sit correctly on their isometric footprints. The first Separator PNG pass showed that a simple placement formula is not reliable:

```text
footprint center + origin(0.5, 0.75) + fixed displayWidth + manual offset
```

That model visually misaligns the Separator and does not scale to all buildings.

Manual per-PNG tuning is not the production strategy. A dev tuner can help diagnose alignment, but it must not become the main placement system.

## Root cause

The current naive placement model makes the wrong assumptions:

1. It anchors buildings to the geometric center of the multi-tile footprint.
2. It assumes `originY = 0.75` is the ground contact line.
3. It assumes one fixed display width works for all building PNGs.
4. It ignores alpha bounds, source image dimensions, and visible base position.
5. It treats the full rectangular PNG frame as if it were the building footprint.

For isometric buildings, the visual ground point should be derived from the footprint and building metadata, not guessed per asset.

## Key rule: buildings anchor to the footprint south vertex

Buildings are not units. A completed building should be anchored to the footprint, not to a single tile center.

For square 2x2 buildings, the placement anchor is the south/bottom vertex of the footprint diamond. This is where the building visually rests on the terrain.

The old `four-elements-next` Canvas renderer effectively used a south-vertex model: it computed the footprint center, then placed the sprite relative to the bottom/south edge of the footprint. The Phaser renderer should follow that concept without copying the old implementation.

## Phaser 4 capability notes

Phaser 4 provides useful APIs for applying placement once the model is known:

- `Image` / `Sprite`
- `setOrigin(x, y)`
- `setPosition(x, y)`
- `setScale()` / `setDisplaySize()`
- `setDepth()`
- `textures.exists()`
- Texture / Frame width and height

But Phaser does not provide a built-in alpha-bounds or ground-line detector for PNG content. `getBounds()` returns the full rectangular object bounds, including transparent padding. `setCrop()` can crop only if crop bounds are already known.

Therefore alpha bounds and ground-line metadata should be generated offline, not computed in the game loop.

## Recommended production approach

Use a hybrid metadata-driven model:

1. Offline script reads building PNGs.
2. Script computes source dimensions and alpha bounds.
3. Script estimates a ground-line / base-anchor ratio.
4. Script writes committed TypeScript metadata.
5. Runtime renderer reads metadata and positions buildings using one generic formula.
6. Dev tuner remains diagnostic only for verification and rare exceptions.

No runtime pixel scanning.
No permanent per-building manual offset tables as the default workflow.

## Proposed data model

A metadata entry should describe how a building image maps onto its gameplay footprint.

```ts
export interface BuildingPlacementMeta {
  buildingType: BuildingType;
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

- `footprintW/footprintH` come from construction/building config.
- `sourceWidth/sourceHeight` come from the PNG.
- `alphaBounds/visibleWidth/visibleHeight` are generated offline.
- `groundLineRatio` is generated and then visually approved.
- `exceptionOffsetX/Y` are rare exceptions, not the default mechanism.

## Runtime renderer formula

At runtime, building rendering should follow this pattern:

```text
1. Read BUILDING_CONFIG footprint.
2. Read BuildingPlacementMeta for the building type and faction.
3. Compute the isometric footprint south vertex.
4. Create or update Phaser Image for the building asset.
5. Apply scale from metadata.
6. Apply origin from metadata ground-line ratio.
7. Set image position to south vertex plus rare exception offset.
8. Set depth from bottom/right footprint tile.
```

Depth should be based on the bottom/right tile of the footprint so completed buildings sort consistently with isometric objects in front/behind them.

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

## PR sequence

Recommended staged plan:

```text
DOC-01 — Building placement strategy                 ✅ this document
BUILD-ANCHOR-01 — BuildingPlacementMeta model         next
BUILD-ANCHOR-02 — Offline alpha-bounds generator
BUILD-ANCHOR-03 — South-vertex renderer
BUILD-01 — Apply metadata renderer to Separator
BUILD-02 — Apply metadata renderer to all current building PNGs
DEV-TOOLS-01 — Keep/adjust tuner as diagnostic only
```

## PR #28 disposition

PR #28 should not be merged as the final placement solution while it depends on manual `displayWidth/origin/offset` tuning.

Useful ideas from PR #28:

- completed building PNG rendering path;
- debug marker concept;
- dev tuner as a diagnostic tool.

But the production placement model should be replaced by `BuildingPlacementMeta` + south-vertex anchoring.

The preferred action is to close PR #28 as superseded by this strategy and follow with the BUILD-ANCHOR sequence.

## Validation expectations for future implementation PRs

Each implementation PR should run:

```bash
npm test
npm run typecheck
npm run build
```

Manual QA should include:

- building Separator;
- verifying PNG alignment against footprint markers;
- checking at multiple zoom levels;
- verifying no missing texture warnings;
- verifying builder/harvester still work;
- verifying Wasp/Smoky are unaffected.
