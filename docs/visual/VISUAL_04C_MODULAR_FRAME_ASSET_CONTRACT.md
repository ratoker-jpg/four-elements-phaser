# VISUAL-04C: Modular Frame Asset Contract

## Purpose

This document defines the contract for replacing the procedural Phaser Graphics
placeholder frame (VISUAL-04A/04B) with modular PNG assets. It specifies exact
file names, canvas sizes, anchor points, placement rules, and quality requirements
so that an artist or AI image generator can produce frame modules that integrate
seamlessly into the existing grid-aligned coordinate system.

This is a **design and contract document** — no PNG assets are created or integrated
by this PR. The actual integration will happen in a future VISUAL-04D PR.

## Background

| PR | What it proved |
|----|---------------|
| #135 (VISUAL-04A) | Modular grid-aligned frame pieces work. Single full-frame PNG overlay does NOT work (PR #134 abandoned). |
| #136 (VISUAL-04B) | Procedural placeholder can be polished with layered polygons, bevels, ribs, bolts, hazard stripes. |
| #136 fix | Background image must be optional with fallback (ERR_HTTP2_PROTOCOL_ERROR on GitHub Pages). |

The frame geometry is proven and frozen. What remains is replacing the procedural
placeholder with production-quality PNG assets that follow the same placement rules.

## Asset List

### Edge Pieces (4 directional variants)

Each edge piece is a single isometric tile-sized module placed at frame border
cells that are NOT corner pieces.

| # | File Name | Direction | Purpose |
|---|-----------|-----------|---------|
| 1 | `frame_edge_ne.png` | Northeast | Edge piece facing upper-right (top→right edge outward) |
| 2 | `frame_edge_nw.png` | Northwest | Edge piece facing upper-left (left→top edge outward) |
| 3 | `frame_edge_se.png` | Southeast | Edge piece facing lower-right (right→bottom edge outward) |
| 4 | `frame_edge_sw.png` | Southwest | Edge piece facing lower-left (bottom→left edge outward) |

### Corner Pieces (4 cardinal variants)

Each corner piece sits at one of the 4 cardinal vertices of the outer diamond.
Corners are more substantial than edges — they have taller walls and bolder
visual treatment.

| # | File Name | Direction | Purpose |
|---|-----------|-----------|---------|
| 5 | `frame_corner_n.png` | North | Corner at the top vertex of the outer diamond |
| 6 | `frame_corner_e.png` | East | Corner at the right vertex of the outer diamond |
| 7 | `frame_corner_s.png` | South | Corner at the bottom vertex of the outer diamond |
| 8 | `frame_corner_w.png` | West | Corner at the left vertex of the outer diamond |

### File Paths

All frame assets are stored under:

```
public/dev-visual/visual-04/frame/
```

Full paths:

```
public/dev-visual/visual-04/frame/frame_edge_ne.png
public/dev-visual/visual-04/frame/frame_edge_nw.png
public/dev-visual/visual-04/frame/frame_edge_se.png
public/dev-visual/visual-04/frame/frame_edge_sw.png
public/dev-visual/visual-04/frame/frame_corner_n.png
public/dev-visual/visual-04/frame/frame_corner_e.png
public/dev-visual/visual-04/frame/frame_corner_s.png
public/dev-visual/visual-04/frame/frame_corner_w.png
```

## Canvas Size

### Edge Pieces

- **Canvas width**: `SOURCE_TILE_W` = 384 px
- **Canvas height**: `SOURCE_TILE_H + wall_face_height` = 192 + 115 = **307 px**
  - Where `wall_face_height = SOURCE_TILE_H × WALL_HEIGHT_RATIO = 192 × 0.6 = 115.2 ≈ 115 px`
- **Rounded**: **384 × 308 px** (even height for clean rendering)

The top 192 px of the canvas contains the isometric diamond top surface.
The bottom ~116 px contains the wall face extending downward from the bottom
half of the diamond.

### Corner Pieces

- **Canvas width**: `SOURCE_TILE_W` = 384 px
- **Canvas height**: `SOURCE_TILE_H + corner_wall_face_height` = 192 + 155 = **347 px**
  - Where `corner_wall_face_height = SOURCE_TILE_H × WALL_HEIGHT_RATIO × CORNER_WALL_MULT = 192 × 0.6 × 1.35 = 155.5 ≈ 156 px`
- **Rounded**: **384 × 348 px** (even height)

Corners have taller walls than edges to appear more substantial, matching the
VISUAL-04B placeholder behavior.

## Anchor Point

**All frame assets use center origin (0.5, 0.5) anchored at the CENTER of the
isometric diamond top surface.**

In display coordinates, the anchor point is at:

- **X**: `canvas_width / 2` = 192 (for 384-wide canvas)
- **Y**: `SOURCE_TILE_H / 2` = 96 (for 192-tall diamond portion)

This matches how Phaser Images are placed with `setOrigin(0.5, 0.5)` at grid
position `(sx, sy)`, where `(sx, sy)` is the center of the isometric diamond
computed from `(col, row)` grid coordinates.

The wall face pixels below the diamond center extend downward and are
automatically rendered in the correct depth order by the isometric Y-sort.

## Grid Placement Rule

Frame pieces are placed at grid coordinates using the **same formula as platform
tiles**:

```
sx = (col - row) × halfTW + platformOriginX
sy = (col + row) × halfTH + platformOriginY
```

Where:
- `halfTW = runtimeTileW / 2`
- `halfTH = runtimeTileH / 2`
- `platformOriginX = arenaCX`
- `platformOriginY = arenaCY - innerHH + halfTH`

Frame pieces occupy the `FRAME_BORDER` ring of cells outside the platform
diamond (row/col from `-FRAME_BORDER` to `GRID_N + FRAME_BORDER - 1`, exclusive
of inner diamond cells).

**No calibration offsets are needed.** The anchor point + grid formula guarantees
pixel-perfect alignment with platform tiles.

## Direction / Orientation Rule

Each frame piece has a directional variant based on which edge(s) of the
isometric diamond face OUTWARD (away from the arena center):

### Edge Direction Mapping

The outward direction of an edge piece is determined by the sign of the
dot product of `(sx - arenaCX, sy - arenaCY)` with the diamond edge normals:

| Outward Direction | Edge Piece | Condition |
|-------------------|------------|-----------|
| Northeast (NE) | `frame_edge_ne.png` | `(sx - CX) - (sy - CY) > 0` (top→right edge outward) |
| Southeast (SE) | `frame_edge_se.png` | `(sx - CX) + (sy - CY) > 0` (right→bottom edge outward) |
| Southwest (SW) | `frame_edge_sw.png` | `-(sx - CX) + (sy - CY) > 0` (bottom→left edge outward) |
| Northwest (NW) | `frame_edge_nw.png` | `-(sx - CX) - (sy - CY) > 0` (left→top edge outward) |

### Corner Direction Mapping

Corners are at the 4 cardinal vertices of the outer diamond:

| Corner Position | File | Nearest Outer Vertex |
|----------------|------|---------------------|
| North | `frame_corner_n.png` | Top vertex `(CX, CY - outerHH)` |
| East | `frame_corner_e.png` | Right vertex `(CX + outerHW, CY)` |
| South | `frame_corner_s.png` | Bottom vertex `(CX, CY + outerHH)` |
| West | `frame_corner_w.png` | Left vertex `(CX - outerHW, CY)` |

## Alpha / Transparent Background Requirement

- **All frame assets MUST have transparent (alpha=0) backgrounds.**
- Only the frame piece itself (top surface + wall face) should be opaque.
- The isometric diamond outline of the piece should have clean anti-aliased
  edges against transparent background.
- No solid fill behind the piece. The background image or fallback renders
  separately at a lower depth layer.

## No Magenta Requirement

- **Final production assets MUST NOT use magenta (#FF00FF) as a visible color.**
- Magenta may be used ONLY as a temporary generation/background mask during
  AI image generation workflows, and must be removed before committing to the
  repository.
- If a generation tool outputs magenta backgrounds, they must be replaced with
  transparent alpha before the asset is considered complete.

## How Assets Map to VISUAL-04A/04B Frame Pieces

### Current Implementation (VISUAL-04B)

The `Visual04aPreviewScene` classifies each frame border cell as either an
**edge piece** or a **corner piece** using `isCornerPiece()`, then draws
procedural Graphics shapes:

- **Edge pieces**: Single flat fill diamond + V-shaped wall face
  - VISUAL-04B adds: bevels, ribs, bolts, dirt
- **Corner pieces**: Same structure but with `CORNER_WALL_MULT = 1.35` taller walls
  - VISUAL-04B adds: hazard stripes, outline accent, darker palette

### Future Integration (VISUAL-04D)

When PNG assets are integrated:

1. Each frame piece gets its direction classified using `getEdgeInfo()` or
   nearest-vertex distance
2. The appropriate PNG is loaded and placed as a Phaser Image at `(sx, sy)`
3. The image is scaled from source size to runtime tile size
4. Procedural `drawFrameWalls()` and `drawFrameTops()` are replaced by the
   PNG image placement
5. Depth ordering remains: walls at `DEPTH_FRAME_WALLS`, tops at `DEPTH_FRAME_TOP`
   (or simplified to a single depth if the PNG includes both top + wall)

### Mapping Table

| VISUAL-04B Procedural | VISUAL-04C PNG Asset |
|----------------------|---------------------|
| `drawFrameWalls()` + `drawFrameTops()` for NE-facing edge | `frame_edge_ne.png` |
| `drawFrameWalls()` + `drawFrameTops()` for NW-facing edge | `frame_edge_nw.png` |
| `drawFrameWalls()` + `drawFrameTops()` for SE-facing edge | `frame_edge_se.png` |
| `drawFrameWalls()` + `drawFrameTops()` for SW-facing edge | `frame_edge_sw.png` |
| Corner at top vertex | `frame_corner_n.png` |
| Corner at right vertex | `frame_corner_e.png` |
| Corner at bottom vertex | `frame_corner_s.png` |
| Corner at left vertex | `frame_corner_w.png` |

## Generation Target

### Style

- **Industrial concrete/metal RTS modular frame pieces**
- Gritty, worn, utilitarian aesthetic
- Suitable for a strategy game arena boundary
- Think: sci-fi industrial platform edge, battle arena wall, containment structure

### Camera

- **Exact isometric 2:1 camera** (pixel ratio width:height = 2:1)
- Top-down isometric view matching the game's tile perspective
- No perspective distortion

### Content Restrictions

- **No terrain** — these are frame/wall pieces only
- **No buildings** — no structures on top of or behind the frame
- **No units** — no characters, vehicles, or creatures
- **No full arena frame** — one module per image, not the complete assembled frame
- **No text or labels** — purely visual frame elements

### Visual Features to Include

Based on the VISUAL-04B procedural placeholder that looked good:

- **Top surface**: Concrete/metal platform with slight wear texture
- **Inner bevel**: Highlighted edge where frame meets platform (light catching the lip)
- **Outer bevel**: Shadowed edge on the outward-facing side
- **Wall face**: Vertical surface below the top, with industrial panel detail
- **Panel ribs**: Structural dividers on the wall face (2-3 sections)
- **Bolt/rivet details**: Small fasteners on the top surface (2-4 per piece)
- **Wear/dirt**: Subtle grime, stains, or weathering (deterministic, not random-looking)
- **Corner pieces**: Taller walls, bolder structure, optional hazard stripe accents
- **Hazard stripes**: Yellow/dark diagonal stripes on corners only (safety markings)

## Integration Assumptions

1. **Edge assets are placed per frame cell** using the same grid coordinates as
   `Visual04aPreviewScene` — no offset calibration beyond the fixed anchor.

2. **Corner assets replace corner Graphics blocks** — same grid position, same
   depth ordering.

3. **Platform tiles remain runtime grid tiles** — separate from frame assets,
   loaded and masked as they are now.

4. **Background remains separate underlay** — the background image (or fallback)
   renders at depth 0, frame pieces at depth 5-15, tiles at depth 10.

5. **Asset placement must not require calibration offsets beyond fixed anchor** —
   the `(sx, sy)` computed from grid coordinates must place the image correctly
   with only `setOrigin(0.5, 0.5)`.

6. **Scaling**: Source assets are designed at `SOURCE_TILE_W × canvas_height`
   resolution. At runtime, they are uniformly scaled to `runtimeTileW × runtimeTileH`
   preserving the 2:1 ratio of the top surface diamond.

7. **Depth layering**: Wall face pixels (below the diamond center) are
   automatically occluded by tiles rendered at higher depth. The PNG can include
   both top surface and wall face in a single image — the depth buffer handles
   correct overlap.

## Manual QA Checklist

When PNG assets are integrated (VISUAL-04D):

- [ ] Open `/?visual04a` — preview loads without errors
- [ ] All 8 frame PNGs render (4 edges + 4 corners)
- [ ] Frame pieces align with platform tile grid (no gaps, no offset)
- [ ] Edge pieces show correct directional variant for their position
- [ ] Corner pieces appear at the 4 cardinal vertices
- [ ] Wall faces render below top surfaces with correct depth ordering
- [ ] Inner lip between frame and platform is visible
- [ ] Background renders (image or fallback) behind frame
- [ ] G toggle shows grid overlay correctly
- [ ] F toggle shows frame debug outlines correctly
- [ ] ESC routes through preload → menu
- [ ] New Game still launches from menu
- [ ] `/?visual03a` still works independently
- [ ] No console errors related to texture loading
- [ ] No magenta pixels visible in any frame asset

## Rollback Plan

If PNG integration fails:

1. Revert the VISUAL-04D integration commit
2. Procedural placeholder (VISUAL-04B) continues to work unchanged
3. The asset contract (this document) remains valid for future attempts
4. No changes to geometry, grid math, or platform tile rendering

The procedural fallback is guaranteed to work because it has zero external
dependencies — it draws everything with Phaser Graphics primitives.
