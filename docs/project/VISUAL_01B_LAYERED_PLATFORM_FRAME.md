# VISUAL-01B — Layered Platform Frame Direction

Status: **accepted visual direction checkpoint / docs only**  
Project: Four Elements Phaser  
Date: 2026-05-30

---

## 1. Purpose

VISUAL-01 produced text-only industrial map candidates and the owner selected Candidate A as the primary direction, with limited Candidate C enrichment. During follow-up visual exploration, the project owner rejected the idea of a single huge map image as too risky and shifted the practical direction to a layered platform approach.

This document captures that decision so VISUAL-02 does not proceed with the wrong assumption that the terrain should be a normal tile-only map or a single baked full-map image.

The new direction is:

```text
Layered Platform Frame + Tile Fill
```

The goal is to preserve the visual quality of a grounded industrial arena while keeping gameplay logic simple and grid-based.

---

## 2. Accepted visual model

The map should be rendered as layered visual elements:

```text
Layer 0 — background world / lower ground
Layer 1 — playable platform tile fill
Layer 2 — arena frame overlay with transparent center
Layer 3 — invisible logical grid
Layer 4 — territory overlay / resources / buildings / units
```

### Layer 0 — background world

Non-playable visual ground under and around the arena.

Target look:

- post-apocalyptic industrial ground;
- broken concrete;
- compacted dark soil;
- rubble;
- moss, weeds, low grass patches;
- sparse low bushes;
- no trees / no forest;
- no gameplay interaction by default.

### Layer 1 — playable platform tile fill

The inner platform floor is assembled from reusable industrial floor tiles.

Target look:

- aged asphalt-concrete;
- worn composite slabs;
- dark cracked industrial surface;
- subtle repair patches;
- recessed service grates;
- maintenance channels;
- mineral dust;
- faint blue-cyan mineral traces;
- no shiny metal floor;
- no clean spaceship floor;
- no sand/desert base.

### Layer 2 — arena frame overlay

A large raised industrial frame around the playable area.

The frame asset should contain:

- outer retaining walls;
- side wall thickness;
- industrial supports;
- corner blocks;
- worn concrete / composite frame material;
- transparent center cutout.

The frame must create the illusion that the platform sits on the lower world surface. It must not introduce gameplay height.

### Layer 3 — invisible logical grid

All gameplay systems remain grid-based.

The grid is invisible in normal play, but can be shown in debug.

It controls:

- movement;
- pathfinding;
- building placement;
- resource placement;
- territory expansion;
- object anchors;
- selection/hover feedback.

### Layer 4 — gameplay objects and overlays

Resources, buildings, units, territory color, selection indicators, command feedback, and future VFX are drawn above the base map layers.

---

## 3. Important decision: no one huge baked map

A single full-map painted asset was considered, but rejected as the primary runtime approach.

Reasons:

- harder to align a precise grid;
- harder to scale map size;
- harder to place buildings/resources cleanly;
- harder to support territory coloring;
- harder to iterate after visual approval;
- risk of making gameplay depend on painted art instead of data.

The accepted compromise:

```text
Use a reusable arena frame and background, then fill the playable center with normalized tiles.
```

This gives the grounded arena look without losing grid control.

---

## 4. Critical gameplay constraint

The playable area must be logically flat.

```text
All playable cells use one elevation level.
No highground.
No lowground.
No ramps.
No stairs.
No terraces.
No raised inner platforms.
No sunken playable zones.
No gameplay cliffs.
```

Height is visual only and belongs to the outer frame / side walls.

The game should treat the playable inner area as a normal flat grid.

---

## 5. Platform tile standard

Accepted source standard for platform floor tiles:

```text
384×192 px
2:1 isometric diamond
top-surface only
transparent background
no side thickness
no drop shadow
no raised block
```

Canonical diamond vertices:

```json
{
  "sourceTileW": 384,
  "sourceTileH": 192,
  "diamond": {
    "top": [192, 0],
    "right": [384, 96],
    "bottom": [192, 192],
    "left": [0, 96]
  },
  "anchor": "top-left"
}
```

### Why not 256×128

256×128 is acceptable for quick proof images, but is too low for the desired map quality and zoom tolerance.

### Why not 384×256

384×256 breaks the 2:1 isometric ratio. If a larger canvas is ever used, the actual top diamond must still remain 2:1.

---

## 6. Tile normalization workflow

Generated art is not expected to align perfectly to the game grid.

Instead, raw generated tiles should be normalized offline:

```text
raw generated spritesheet
↓
remove chroma background
↓
extract individual tile images
↓
crop / perspective-normalize top surface
↓
fit into exact 384×192 diamond
↓
apply diamond alpha mask
↓
write PNG tiles + metadata
```

A proof script already exists outside the repo from Codex:

```text
normalize_platform_tiles.py
```

It normalizes spritesheets to 384×192 transparent diamond PNGs and writes metadata. The script is useful as a base, but needs one future improvement before becoming production tooling:

```text
manual source diamond points / perspective transform
```

Reason: simple 2:1 cropping works for many generated tiles, but exact alignment needs explicit source top/right/bottom/left points.

---

## 7. Frame cutout requirement

The arena frame center must be transparent in the final runtime asset.

For generation, chroma-key center is acceptable:

```text
#FF00FF magenta center
or another unique flat chroma color
```

Then an offline script removes that center to alpha.

Rules for frame generation:

- center must be one flat solid chroma color;
- no texture inside center;
- no gradient inside center;
- no shadows inside center;
- no dirt/cracks/objects inside center;
- frame edges must remain clean enough for alpha cutout.

Important: the inner cutout should ideally be a clean 2:1 isometric diamond matching the logical grid.

A proof frame was tested, but its measured inner cutout ratio was not perfect 2:1. This is acceptable for proof only. Production frame should be regenerated or corrected so the inner playable cutout matches the grid exactly.

---

## 8. Grid alignment model

The frame cutout defines four inner diamond vertices:

```text
T = inner top vertex
R = inner right vertex
B = inner bottom vertex
L = inner left vertex
```

For an `N×N` playable grid:

```text
tileW = (R.x - L.x) / N
tileH = (B.y - T.y) / N
```

For exact 2:1 isometric alignment:

```text
tileW / tileH ≈ 2.0
```

Cell positioning:

```text
screenX = originX + (tx - ty) * tileW / 2
screenY = originY + (tx + ty) * tileH / 2
```

Tiles are then drawn from the canonical 384×192 source, scaled to the runtime tile size.

---

## 9. Building / object normalization decision

The same normalization approach should later apply to buildings and objects, but not by cutting them into tile diamonds.

Different asset types use different anchors:

| Asset type | Normalization target |
|---|---|
| Platform tiles | exact 384×192 top-surface diamond |
| Buildings | footprint base alignment |
| Resources | cell anchor / footprint anchor |
| Decor | footprint or anchor point |
| Units | ground-contact / center-bottom anchor |

### Buildings

Buildings should be normalized by their base footprint, not by their full image bounds.

Example metadata shape:

```json
{
  "id": "hq",
  "footprint": [3, 3],
  "baseDiamond": {
    "top": [384, 220],
    "right": [720, 390],
    "bottom": [384, 560],
    "left": [48, 390]
  },
  "drawAnchor": [384, 560]
}
```

Meaning:

- `footprint` defines occupied grid cells;
- `baseDiamond` defines where the building touches the ground;
- `drawAnchor` defines how to place it on the grid;
- the upper building body may extend above the base.

This avoids buildings floating, drifting, or misaligning with the grid.

---

## 10. What is accepted now

Accepted:

- `Layered Platform Frame + Tile Fill` as the next visual direction.
- Background world is separate from the platform floor.
- Arena frame is separate and has transparent center.
- Inner floor is tiled from normalized 384×192 industrial platform tiles.
- Gameplay remains bound to invisible grid, not to painted pixels.
- Territory coloring will be a separate overlay, not baked into the base art.
- Future buildings should be normalized by footprint base alignment.

Rejected / not active:

- one huge baked full-map asset as the main runtime map;
- every tile as a raised 3D block;
- gameplay highground/ramps/terraces;
- sand terrain as primary direction;
- StarCraft asset copying;
- GLM/image generator as art generator.

---

## 11. Next steps

### Immediate next step

Create a docs/design PR for this decision. This document is that checkpoint.

### Next implementation step after this PR

Create a dev-only technical prototype:

```text
VISUAL-02A — Layered Platform Frame Prototype
```

Goal:

- load background world image;
- load normalized platform tile set;
- render tile-filled playable center;
- load arena frame overlay with transparent center;
- align grid to the frame cutout;
- show debug grid overlay;
- do not change gameplay;
- do not replace production terrain yet.

### Required before production integration

- Final or near-final frame with clean 2:1 inner cutout.
- Final or near-final 384×192 tile set.
- `mapLayout` definition for grid size, start zones, center resource zone, and playable mask.
- Decision on grid size: likely 48×48 or 64×64, not 16×16 proof scale.

---

## 12. Stop conditions

Stop and request review if:

- frame cutout cannot align to a 2:1 grid;
- tile fill looks like a chessboard;
- platform tiles include side thickness inside the playable area;
- implementation touches pathfinding/economy/building rules unexpectedly;
- runtime work tries to replace production terrain before dev-only proof;
- visual result looks worse than current proof;
- GLM starts generating art instead of implementing scoped technical work.
