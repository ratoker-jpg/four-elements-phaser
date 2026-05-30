# VISUAL-04C: Asset Prompt Notes

This document contains prompt requirements for generating the modular frame PNG
assets defined in `VISUAL_04C_MODULAR_FRAME_ASSET_CONTRACT.md`. It does NOT
contain actual generated images.

## General Prompt Requirements

### Mandatory Constraints

- **Isometric 2:1 pixel ratio** — the top surface diamond must be exactly 2:1
  (width twice the height), e.g. 384×192 px for the top surface portion
- **Transparent background** — alpha channel, no solid fill behind the piece
- **One module per image** — do not generate the complete assembled frame
- **No text, no labels** — purely visual frame/wall elements
- **No magenta in final output** — may use as temporary gen mask only
- **Anti-aliased edges** — clean edges against transparency, no jaggies

### Style Direction

- Industrial concrete and metal
- RTS game asset quality
- Worn, weathered, utilitarian
- Sci-fi containment structure / arena boundary
- Subtle color variation per piece (not uniform flat colors)
- Cool blue-gray undertone palette (not warm brown)

### Color Palette Reference (from VISUAL-04B placeholder)

These are the procedural colors used in the placeholder. Final PNG assets should
approximate this palette but with richer texture and detail:

| Element | Placeholder Hex | Description |
|---------|----------------|-------------|
| Top surface base | `#383846` | Dark blue-gray concrete |
| Top surface raised | `#424252` | Lighter raised center |
| Wall face (left, darker) | `#181822` | Very dark blue-gray |
| Wall face (right, lighter) | `#1e1e2a` | Slightly lighter |
| Inner bevel highlight | `#585868` | Bright edge toward platform |
| Outer bevel shadow | `#1c1c28` | Dark edge facing outward |
| Corner top | `#2e2e3c` | Darker corner surface |
| Corner wall | `#0e0e18` | Very dark corner wall |
| Hazard yellow | `#bbaa00` | Corner stripe accent |
| Bolt head | `#585868` | Metal fastener |

## Per-Asset Prompt Notes

### Edge Pieces

**Common prompt base:**

```
Isometric 2:1 tile, industrial concrete/metal RTS arena frame edge piece,
transparent background, worn surface with subtle grime, panel ribs on wall face,
2-3 bolt details on top surface, inner bevel highlight where frame meets platform,
outer bevel shadow on far edge, cool blue-gray palette, no text, no terrain,
no buildings, no units, single module
```

**Directional variants — add to base prompt:**

| Asset | Direction Addition |
|-------|-------------------|
| `frame_edge_ne` | "Piece faces northeast, outer edge is the top-right side of the diamond, wall extends downward from bottom half of diamond" |
| `frame_edge_nw` | "Piece faces northwest, outer edge is the top-left side of the diamond, wall extends downward from bottom half of diamond" |
| `frame_edge_se` | "Piece faces southeast, outer edge is the bottom-right side of the diamond, wall extends downward from bottom half of diamond" |
| `frame_edge_sw` | "Piece faces southwest, outer edge is the bottom-left side of the diamond, wall extends downward from bottom half of diamond" |

**Canvas size**: 384 × 308 px

The top surface diamond occupies the top 192 px. The wall face extends from
the bottom edge of the diamond downward ~116 px.

### Corner Pieces

**Common prompt base:**

```
Isometric 2:1 tile, industrial concrete/metal RTS arena frame corner piece,
transparent background, taller and more substantial than edge pieces,
bold structural presence, yellow/dark hazard stripe accents on outer face,
3-4 bolt details on top surface, deep wall face with panel ribs,
inner bevel highlight, outer bevel shadow, cool blue-gray palette with
darker corner tones, no text, no terrain, no buildings, no units, single module
```

**Directional variants — add to base prompt:**

| Asset | Direction Addition |
|-------|-------------------|
| `frame_corner_n` | "Corner piece at the north (top) vertex of the arena diamond, outer vertex points upward" |
| `frame_corner_e` | "Corner piece at the east (right) vertex of the arena diamond, outer vertex points right" |
| `frame_corner_s` | "Corner piece at the south (bottom) vertex of the arena diamond, outer vertex points downward" |
| `frame_corner_w` | "Corner piece at the west (left) vertex of the arena diamond, outer vertex points left" |

**Canvas size**: 384 × 348 px

Corners have taller walls than edges (approximately 155 px wall face vs 115 px)
to appear more substantial and structurally important.

## Post-Generation Checklist

After generating each asset:

- [ ] Canvas size matches specification (384×308 for edges, 384×348 for corners)
- [ ] Background is fully transparent (check alpha channel)
- [ ] Top surface diamond is strictly 2:1 ratio (384×192 portion)
- [ ] No magenta pixels anywhere in the image
- [ ] No visible text or labels
- [ ] Wall face extends below the diamond center line
- [ ] Inner bevel (highlight) visible on platform-facing edge
- [ ] Outer bevel (shadow) visible on outward-facing edge
- [ ] Panel ribs visible on wall face
- [ ] Bolt/rivet details present on top surface
- [ ] Wear/dirt texture present but subtle
- [ ] Corner pieces have hazard stripe accents
- [ ] Corner pieces have visibly taller walls than edge pieces
- [ ] Anti-aliased edges (no hard pixel stairstepping against transparency)
- [ ] File saved as PNG with alpha channel

## Integration Notes (for VISUAL-04D)

When these assets are ready for integration:

1. Place all 8 PNGs in `public/dev-visual/visual-04/frame/`
2. Add preload entries in `Visual04aPreviewScene.preload()`
3. Replace `drawFrameWalls()` and `drawFrameTops()` calls with PNG image placement
4. Classify each frame piece's direction using `getEdgeInfo()` / nearest-vertex
5. Select the correct PNG variant based on direction
6. Scale from source to runtime tile size (preserving 2:1)
7. Set depth to `DEPTH_FRAME_WALLS` (or a unified frame depth)
8. Keep procedural fallback available as a code path (if PNGs fail to load)
9. Keep G/F/ESC controls unchanged
10. Validate with full test suite + manual QA
