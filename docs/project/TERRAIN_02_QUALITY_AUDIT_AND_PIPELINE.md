# TERRAIN-02 — Terrain Quality Audit & Clean High-Res Sand Pipeline

Status: audit / design document — docs only, no runtime changes  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Phaser version: 4.1.0  
Reference/donor repo: `ratoker-jpg/four-elements-next` (reference only)  
Date: 2026-05-29

---

## 1. Executive Summary

The current terrain reads as a low-quality checkerboard of repeated diamond tiles. This is not a single-cause problem — it is a **combination of five root causes** working together: (1) source assets that contain built-in diamond borders and are fundamentally over-large for per-cell use, (2) extreme downscaling from 1180x741 to 76x38 that destroys detail, (3) only 3 tile variants with no patch-level variation, (4) cellular-automata smoothing that reduces but does not eliminate the checkerboard feel, and (5) per-tile tinting so subtle (plus-minus 3%) that it is invisible at game zoom.

The recommended direction is **Option B: Keep renderer, upgrade to 256x128 source tile/patch family**. This preserves the efficient RenderTexture stamp approach, avoids risky renderer rewrites, and directly addresses Denis's stated preference for a 256x128 source tile/patch pipeline. The key insight is that the current 1180x741 source tiles were never designed for per-cell isometric stamping — they are oversized full-screen-quality renders that get crushed to 6.4% of their original size, producing blurred, identical-looking results.

Option B requires: new source art at 256x128 per tile/patch, an expanded terrain family (5-7 variants), updated scale constants, and updated manifest entries. The RenderTexture model stays. The logical MapData grid stays. Pathfinding stays untouched.

**What must change:** Source art dimensions, terrain variant count, TERRAIN_STAMP_CONFIG scale, and generatedAssetManifest entries.

**What must NOT change:** The RenderTexture stamp model, the isometric coordinate system, MapData logical cells, pathfinding, occupancy, or the TerrainRenderer class architecture.

---

## 2. Current Terrain Pipeline Overview

The terrain rendering pipeline operates in a single-pass stamp model:

1. **Map generation** (`src/state/generatedMap.ts`) produces a `TerrainType[][]` array with values `'sand'`, `'sand-dark'`, `'sand-light'`.
2. **TerrainRenderer** (`src/phaser/render/TerrainRenderer.ts`) receives the terrain array and creates a `Phaser.GameObjects.RenderTexture`.
3. **Smoothing** (`src/state/terrainClustering.ts`): Before stamping, `applyTerrainSmoothing()` runs 2 passes of cellular automata to merge isolated single-tile variants into larger clusters. This is visual-only — the original MapData is not modified.
4. **Per-tile stamping**: For each cell (tx, ty), the renderer looks up the asset key via `TERRAIN_KEY_MAP`, computes screen position via `tileToScreen()`, computes a deterministic tint via `computeTerrainTint()`, and stamps the tile onto the RenderTexture using `renderTexture.stamp()`.
5. **Camera scroll**: The RenderTexture is a static image. The camera scrolls over it. No per-frame terrain redraw occurs.
6. **Grid lines** (removed in TERRAIN-01): Previously drew 0.5px alpha-0.2 diamond outlines reinforcing the grid. Now removed.

**Data flow:**
```
generatedMap.ts → TerrainType[][] → applyTerrainSmoothing(2 passes) → TerrainRenderer.stampTerrainTiles() → RenderTexture (cached)
```

**Key constants:**
- `TILE_W = 76`, `TILE_H = 38` (isometric cell size in screen pixels)
- `scaleX = 76 / 1180 = 0.0644`, `scaleY = 38 / 741 = 0.0513`
- `originX = 0.5`, `originY = 0.5` (center origin for stamping)
- Map size: 48x48 = 2304 cells

---

## 3. Current Terrain Asset Inventory

### 3.1 Terrain PNG files

| File | Path | Resolution | File Size | Format |
|------|------|-----------|-----------|--------|
| `sand_tile.png` | `public/assets/tiles/sand_tile.png` | 1180 x 741 | 845 KB | PNG RGBA |
| `sand_tile_dark.png` | `public/assets/tiles/sand_tile_dark.png` | 1180 x 741 | 816 KB | PNG RGBA |
| `sand_tile_light.png` | `public/assets/tiles/sand_tile_light.png` | 1180 x 741 | 741 KB | PNG RGBA |

Total: 3 files, 2.4 MB on disk, 1180x741 each.

### 3.2 Asset manifest references

- `assetManifest.ts` (deprecated keys): `TERRAIN_SAND`, `TERRAIN_SAND_DARK`, `TERRAIN_SAND_LIGHT`
- `generatedAssetManifest.ts` (active): `terrain_sand`, `terrain_sand_dark`, `terrain_sand_light` — loaded via `loadGeneratedTerrainAndResourceAssets()`
- `process_art_assets.mjs`: Hardcoded `TERRAN_ENTRIES` array with 3 entries

### 3.3 Source art characteristics

The 1180x741 PNGs are extremely large relative to their 76x38 screen display size. At `scaleX = 76/1180 ≈ 0.064` (6.4% of original), the renderer downsamples from 1180x741 to 76x38 pixels per tile. This means:

- Each screen pixel averages information from roughly a 15.5 x 19.5 pixel region of the source art
- Fine detail in the source (grain, texture, subtle color variation) is completely lost during downscaling
- The resulting stamped tile appears as a uniform colored diamond with no visible texture
- The source resolution is approximately 15.5x too wide and 19.5x too tall for the display size

The source PNGs are RGBA with transparent backgrounds and visible diamond-shaped content. Inspecting the source reveals that each PNG contains a **single isometric diamond with built-in border edges and gradient shading**. These built-in edges contribute to the checkerboard pattern: when stamped adjacent to each other, the border regions create visible grid lines even without the explicit `drawGridLines()` overlay.

### 3.4 TerrainType in state model

```typescript
export type TerrainType = 'sand' | 'sand-dark' | 'sand-light';
```

Only 3 variants. No mechanism for patch-level variation, transition tiles, or per-zone texture families.

---

## 4. Root-Cause Analysis of Poor Visual Quality

The checkerboard / low-quality appearance has five contributing root causes, listed in order of visual impact:

### Root Cause 1: Source assets contain built-in diamond borders and gradient edges

The current sand_tile PNGs include visible border/edge treatment within the isometric diamond shape. When these tiles are stamped adjacent to each other, the edges of neighboring diamonds create a visible grid pattern — a thin line of slightly different color at every tile boundary. This is the single largest contributor to the checkerboard look. Even with grid lines removed in TERRAIN-01, the asset content itself produces grid lines at every cell boundary.

**Evidence**: The 1180x741 source art is an isometric diamond with internal edge shading. Adjacent stamps tile seamlessly in shape but produce visible seams where the gradient edges of neighboring diamonds meet.

### Root Cause 2: Extreme downscaling destroys source texture detail

Scale factors:
- `scaleX = 76 / 1180 = 0.0644` (6.4%)
- `scaleY = 38 / 741 = 0.0513` (5.1%)

This represents a 15.5x horizontal and 19.5x vertical reduction. At this scale, any sand grain, pebble detail, or subtle color variation in the 1180x741 source is averaged into a single pixel value. The result is that all three terrain types stamp as nearly uniform colored diamonds with no visible texture — just flat color fills with slight brightness differences.

**This is why the map looks "over-compressed / blurred"**: because it literally is. The GPU samples the 1180x741 texture at extreme minification, producing uniform mip-level pixels.

### Root Cause 3: Only 3 tile variants with no patch-level differentiation

Three variants (sand, sand-dark, sand-light) produce only 3 distinct visual states per cell. On a 48x48 map with deterministic placement, the eye quickly identifies the repeating pattern. The cellular automata smoothing (2 passes) creates larger clusters of the same type, but within each cluster, every tile looks identical because there is no per-tile texture variation.

Compare to a typical RTS terrain system which uses 8-20+ variants per terrain type, often with random rotation and mirroring, to break up repetition.

### Root Cause 4: Per-tile tint variation is too subtle to be perceptible

The `computeTerrainTint()` function produces tint shifts of plus-minus 3% per channel (plus-minus 7-8 out of 255 RGB values). At game zoom, this produces an imperceptible color variation. The human eye cannot distinguish between two adjacent tiles that differ by 7/255 in a single color channel. The tint system, while architecturally sound, is not visually effective at its current range.

### Root Cause 5: Per-cell stamping model inherently creates repetition

Each logical cell gets exactly one tile stamp. Even with perfect source art, stamping the same texture at every cell of the same type creates visible repetition because the human visual system is exceptionally good at detecting periodic patterns. A 48x48 map with 3 terrain types means thousands of identical stamps per type.

---

## 5. Terrain Resolution / Scaling Analysis

### 5.1 Why 1180x741?

The 1180x741 dimensions do not correspond to any clean multiple of the 76x38 isometric cell. They appear to be the natural output size of whatever 3D render or AI generation process created the original sand tile. The dimensions give an aspect ratio of approximately 1.59:1, while the isometric diamond ratio (2:1 for a full diamond) is 76:38 = 2:1.

**The 1180x741 source is not designed for this rendering model.** It appears to be a standalone tile illustration rather than a seamlessly tileable isometric terrain patch.

### 5.2 What should the source resolution be?

For a 76x38 display cell, the ideal source resolution depends on the approach:

| Approach | Source Size | Scale Factor | Notes |
|----------|------------|-------------|-------|
| 1:1 source = display | 76 x 38 | 1.0 | Maximum sharpness but no room for detail |
| 2x source | 152 x 76 | 0.5 | Good detail retention, small files |
| 3x source | 228 x 114 | 0.33 | High detail, moderate file size |
| 4x source | 304 x 152 | 0.25 | Very high detail, larger files |
| Denis target | 256 x 128 | 0.297 x / 0.297 y | Approximately 3.37x horizontal, 3.37x vertical — excellent detail retention |

The Denis-preferred 256x128 source tile is approximately 3.4x the display resolution, which is an excellent balance:
- Sufficient resolution for visible sand grain and texture
- Small enough for efficient loading and GPU sampling
- Clean aspect ratio: 256/76 = 3.37, 128/38 = 3.37 — uniform scaling preserves the 2:1 isometric ratio
- 256x128 is a power-of-2-friendly dimension for GPU texture handling

### 5.3 Is the current 1180x741 scale assumption still correct?

The scale `TILE_W / 1180` and `TILE_H / 741` is mathematically correct for the current assets — it maps the 1180x741 source to exactly 76x38 screen pixels. However, the assumption that terrain source tiles should be 1180x741 is incorrect. This was a default that came with the original assets, not a design choice. The new source tiles at 256x128 would use:

```
scaleX = 76 / 256 = 0.297
scaleY = 38 / 128 = 0.297
```

Uniform scaling (same factor in both axes) ensures the isometric diamond is not distorted.

---

## 6. RenderTexture Analysis

### 6.1 Current RenderTexture size

For a 48x48 map:
- Screen bounds: approximately 3650 x 1830 pixels (isometric diamond extents + padding)
- RenderTexture size: approximately 3780 x 1960 pixels (with 64px padding)
- This is a single 2K-class texture — well within WebGL limits

### 6.2 Performance

The RenderTexture is stamped once during `TerrainRenderer` construction. After stamping, it is a static image. The camera scrolls over it with zero per-frame terrain redraw cost. This is the most efficient terrain rendering approach possible in Phaser 4.

- **Stamp count**: 2304 stamps (48x48)
- **Stamp time**: Single operation at scene creation
- **Runtime cost**: Zero (static texture)
- **Memory**: One 2K texture (~15 MB uncompressed RGBA)

### 6.3 Should we keep the RenderTexture model?

**Yes.** The RenderTexture stamp model is correct and efficient. It produces zero per-frame overhead and is fully compatible with the camera system. The visual quality problems come from the source art and variant count, not from the rendering architecture.

Changing to individual Sprites (2304 sprites) would:
- Add per-frame depth sorting cost
- Break the current camera model
- Increase draw call count dramatically
- Provide no visual quality improvement (the same art at the same scale would look identical)

The VISUAL-SPIKE-01 report confirmed that RenderTexture has no Lighting component, but lighting is explicitly deferred. For the current scope (better terrain art, no lighting), RenderTexture is optimal.

---

## 7. Checkerboard / Repetition Analysis

### 7.1 Where does the visible "grid/diamond line" look come from?

The grid appearance has three contributors:

1. **Asset content (primary)**: The source PNGs contain built-in diamond edge gradients. Adjacent stamps produce visible seams at every cell boundary. This is the dominant cause.

2. **Repetitive stamping (secondary)**: Identical tiles at every cell create a strong periodic pattern. The human visual system detects this as a "texture" rather than "terrain."

3. **Grid overlay (removed in TERRAIN-01)**: Previously reinforced the grid with explicit diamond outlines. Now removed, but the underlying seam pattern from asset content remains.

### 7.2 Why TERRAIN-01 clustering didn't fully solve it

TERRAIN-01 addressed the random checkerboard (where sand, sand-dark, and sand-light alternated unpredictably) by applying cellular automata smoothing. This created larger clusters of the same terrain type, which improved the situation. However, it did not address:

- The identical appearance of tiles within each cluster
- The built-in diamond edges in the source art
- The fundamental lack of texture variation at the per-cell level

TERRAIN-01 was a necessary step but not sufficient on its own. It improved cluster formation but could not overcome the source art limitations.

---

## 8. Visual Goals for the New Desert Floor

Based on the Denis direction and the Phase 2 roadmap audit, the target terrain should:

1. **Read as a natural desert surface**, not a grid of diamond tiles. A player glancing at the map should see "sand" — not "repeated diamond shapes."
2. **Support perceived resolution** that matches or exceeds the 76x38 cell display size. No blurriness, no over-compression artifacts.
3. **Break up tile repetition** through a combination of source art variants, deterministic variant selection, deterministic tint variation, cluster-based detail assignment, and optional safe transforms after visual QA.
4. **Feel like a stylized RTS desert surface** — think StarCraft desert tiles, Age of Empires sand terrain, or Command & Conquer dunes. Not photorealistic, but not flat-colored diamonds either.
5. **Prepare the ground for MAPLIFE props**: The terrain should look good as a base layer that props, doodads, and decals can sit on top of without visual conflict.
6. **Maintain isometric readability**: The 2:1 diamond cell structure must remain visible for gameplay (cell selection, building placement) even if the visual grid is soft.

---

## 9. Option Comparison Table

| Criterion | Option A: Replace tile art only | Option B: 256x128 tile/patch family | Option C: Chunk/patch composition | Option D: Renderer changes |
|-----------|------|------|------|------|
| **Source art change** | New 1180x741 PNGs (better quality) | New 256x128 PNGs (multiple variants) | New larger patch PNGs | Depends on approach |
| **Runtime code change** | None (same scale, same keys) | Update TERRAIN_STAMP_CONFIG, manifest | New TerrainRenderer stamping logic | Major renderer refactor |
| **Tile variants** | Still 3 | 5-7 variants | Zone-based patch families | Depends on approach |
| **Repetition reduction** | Minimal — same stamps, better art | Moderate — more variants + tint + cluster assignment | High — larger visual patches | High if done well |
| **Checkerboard fix** | Partial — depends on art having no edges | Strong — new art without edges + more variants | Strong — patches cover multiple cells | Strong if done well |
| **Scale fix** | No — still 1180x741 | Yes — 256x128 is appropriate resolution | Yes — patch-level scaling | Depends |
| **Risk** | Low | Low-medium | Medium-high | High |
| **Effort** | Art only | Art + minor code | Art + significant code | Art + major code |
| **Pathfinding impact** | None | None | None (logical grid preserved) | Must verify |
| **MAPLIFE compatibility** | Same as current | Good — clean base for decals/props | Good — natural zones for prop placement | Must verify |
| **Fog compatibility** | Same as current | Same as current (RenderTexture) | Same if RenderTexture preserved | Must verify |
| **Denis preference alignment** | Partial | **Full** (256x128 target) | Partial (different model) | Low (unnecessary complexity) |

---

## 10. Recommended Target Architecture

### Option B is recommended.

**Rationale:**

Option A is rejected because keeping 1180x741 source tiles perpetuates the extreme downscaling problem. Even with better art content, 6.4% scaling destroys detail. The fundamental mismatch between source resolution and display size would remain.

Option C is rejected for now because it introduces unnecessary runtime complexity. The chunk/patch composition model (where larger visual patches cover multiple logical cells) would reduce repetition significantly, but it requires new rendering logic to handle patch boundaries, overlap, and depth sorting with entities. This complexity is not justified when the same visual improvement can be achieved with more tile variants in the existing per-cell stamp model.

Option D is rejected because the RenderTexture stamp model is already optimal for the current scope. Changing the renderer would be high-risk, high-effort, and provide no benefit unless lighting (VISUAL-SPIKE-01) is implemented, which is explicitly deferred.

Option B directly addresses all five root causes: new source art at 256x128 eliminates the resolution mismatch, multiple variants break repetition, new art without built-in edges eliminates the checkerboard, and appropriate scale (0.297) retains visible texture detail. It requires minimal runtime code changes and preserves the efficient RenderTexture architecture.

---

## 11. Proposed Terrain Asset Family

### 11.1 Recommended family: "terrain_sand" (clean desert base)

The following terrain family is proposed for the first pass. It is intentionally conservative — only variants that are justified by the visual improvement they provide. Additional variants can be added later as Denis generates more art.

| Asset Key | Description | Content | Role |
|-----------|-------------|---------|------|
| `terrain_sand_clean` | Clean sand base — no visible grid lines, no built-in diamond edges, uniform sandy color with subtle grain | Warm sand color, very fine grain texture, no border/edge treatment | Primary base tile (replaces current `terrain_sand`) |
| `terrain_sand_ripple` | Sand with subtle wind ripple pattern — horizontal or diagonal lines suggesting wind-sculpted surface | Same base color as clean, with low-contrast ripple lines | Breaks repetition in flat areas |
| `terrain_sand_pebble` | Sand with small pebble cluster — 2-4 small dark dots suggesting surface stones | Same base color, small pebble detail | Natural variation, visual interest |
| `terrain_sand_cracked` | Sand with subtle dry crack pattern — thin lines suggesting dried earth | Same base color, thin crack lines | Desert character, avoids monotony |
| `terrain_sand_dark` | Darker sand variant — for shadow/depth zones, same grain as clean but darker | Cooler/darker tone, same grain texture | Replaces current `sand-dark` for cluster depth |
| `terrain_sand_light` | Lighter sand variant — for highlight zones, same grain as clean but lighter | Warmer/lighter tone, same grain texture | Replaces current `sand-light` for cluster highlights |

### 11.2 Variant count justification

6 variants (3 base shades x 2 detail variants, or 6 distinct textures) is the minimum that produces meaningful repetition reduction. With 6 variants and expanded tint variation (plus-minus 8%), the effective visual diversity is significantly better than the current 3 variants with imperceptible tint. Repetition reduction comes primarily from: (1) 6 distinct texture variants instead of 3, (2) stronger tint variation (plus-minus 8%) that is actually visible, and (3) cluster-based variant assignment that distributes detail variants naturally across the map. Rotation is NOT used as a repetition-reduction tool for 256x128 isometric tiles because arbitrary rotation is unsafe for the isometric diamond footprint (see section 13.2 for the safe-transform rule).

### 11.3 What about transition tiles?

Transition tiles (tiles that show a soft boundary between sand-dark and sand, for example) are NOT recommended for the first pass. Transitions would require:
- A new stamping model that checks neighbor types before selecting a tile
- 6-12 additional transition variants per type pair
- More complex TerrainRenderer logic

The cluster-based approach from TERRAIN-01 (cellular automata smoothing) already produces soft cluster boundaries. With appropriate tint variation at cluster edges, transitions can be approximated without dedicated transition tiles. If transitions are desired later, they can be added as a separate task.

### 11.4 Family extension path

If 6 variants prove insufficient, the family can be extended with:
- `terrain_sand_dune` — stronger dune/wave pattern
- `terrain_sand_footprint` — faint footprint marks
- `terrain_sand_wet` — slightly damp/darker patch near water (future water feature)

These are NOT included in the first pass to avoid scope creep.

---

## 12. Exact Asset Generation Spec

### 12.1 Source dimensions

**256 x 128 pixels per tile/patch.**

This is the Denis-preferred target. It provides:
- 3.37x oversampling relative to 76x38 display (excellent detail retention)
- Uniform scale factor: `76/256 = 38/128 = 0.296875`
- Clean power-of-2-friendly dimensions
- Manageable file size (estimated 20-50 KB per PNG vs current 800+ KB)

### 12.2 Content requirements

Each source PNG must:

1. **Contain NO built-in diamond border or edge line.** The tile content should fill the isometric diamond area with seamless texture that does not produce visible seams when adjacent tiles are stamped. This is the single most important content requirement. The current tiles have built-in edge gradients that create the grid pattern; the new tiles must not.

2. **Use a consistent isometric diamond mask.** The transparent area outside the diamond should be consistently shaped across all variants. The diamond should match the 2:1 isometric ratio (width = 2x height) with the center at (128, 64).

3. **Contain visible but subtle sand texture.** At 256x128, there is enough resolution for visible sand grain, fine pebbles, or wind ripple patterns. The texture should be clearly visible when displayed at 76x38 but not overpowering. Think "sand you can see has texture when you look closely" rather than "busy pattern."

4. **Use warm desert palette.** Base color range:
   - Sand clean: HSL approximately (35-45, 40-60%, 70-80%)
   - Sand dark: HSL approximately (30-40, 30-50%, 55-65%)
   - Sand light: HSL approximately (40-50, 40-60%, 80-90%)
   - All variants within the same type should share the same base hue/saturation

5. **Tile seamlessly in the horizontal and vertical axes.** When stamped in a grid, adjacent tiles must not produce visible seams at boundaries. This requires the texture to wrap correctly at the diamond edges.

6. **Be designed for non-directional lighting if safe transforms may be used later.** The texture should avoid strong directional lighting cues (e.g., a light source from the upper-left) that would make flipX/flipY or 180-degree rotation look obviously wrong. Non-directional or omnidirectional shading allows optional safe transforms in the future. However, repetition reduction should NOT depend on rotation — see the safe-transform rule in section 13.2.

### 12.3 File naming and storage

```
public/assets/tiles/
  terrain_sand_clean.png      (256 x 128)
  terrain_sand_ripple.png     (256 x 128)
  terrain_sand_pebble.png     (256 x 128)
  terrain_sand_cracked.png    (256 x 128)
  terrain_sand_dark.png       (256 x 128)
  terrain_sand_light.png      (256 x 128)
```

### 12.4 Asset key mapping

New `TERRAIN_KEY_MAP`:

```typescript
const TERRAIN_KEY_MAP: Record<TerrainType, string> = {
  sand: 'terrain_sand_clean',
  'sand-dark': 'terrain_sand_dark',
  'sand-light': 'terrain_sand_light',
  'sand-ripple': 'terrain_sand_ripple',
  'sand-pebble': 'terrain_sand_pebble',
  'sand-cracked': 'terrain_sand_cracked',
};
```

New `TerrainType`:

```typescript
export type TerrainType =
  | 'sand' | 'sand-dark' | 'sand-light'
  | 'sand-ripple' | 'sand-pebble' | 'sand-cracked';
```

### 12.5 Old asset handling

The old 1180x741 tiles (`sand_tile.png`, `sand_tile_dark.png`, `sand_tile_light.png`) should be **removed from `public/assets/tiles/`** after the new tiles are integrated. The old keys (`terrain_sand`, `terrain_sand_dark`, `terrain_sand_light`) will be replaced by the new keys in `generatedAssetManifest.ts`.

---

## 13. Render Pipeline Recommendation

### 13.1 Keep the RenderTexture stamp model

No changes to the TerrainRenderer class architecture. The existing `stampTerrainTiles()` method remains the rendering path. Changes are limited to:

1. **Update `TERRAIN_STAMP_CONFIG`** scale from `76/1180, 38/741` to `76/256, 38/128`
2. **Expand `TERRAIN_KEY_MAP`** with the new variant keys
3. **Expand `TerrainType`** with the new type names
4. **Update `generatedAssetManifest.ts`** (via `process_art_assets.mjs`) with new terrain entries
5. **Add deterministic variant selection and stronger tint variation** (see sections 13.2–13.4)

### 13.2 Safe-transform rule for 256x128 isometric terrain tiles

**Do NOT use 90-degree rotation for 256x128 isometric terrain tiles.** A 90-degree rotation swaps width and height from 256x128 to 128x256, which breaks the isometric diamond footprint and stamp alignment. Even a 90-degree rotation applied via `StampConfig.rotation` would render the diamond at the wrong aspect ratio and misalign it with the cell grid.

**180-degree rotation, flipX, and flipY are optional only** if: (a) the source art is specifically designed to be non-directional (no directional lighting or shading), and (b) visual QA confirms the transform does not break lighting consistency or seam alignment.

**The first TERRAIN-02A implementation should NOT depend on rotation or flipping to solve repetition.** Repetition reduction should primarily come from:
1. **6 clean texture variants** — each variant provides a visually distinct stamp
2. **Cluster-based detail assignment** — variants are distributed in natural cluster patterns, not randomly
3. **Stronger tint variation** (plus-minus 8%) — visible per-tile color variation that makes adjacent same-variant tiles look different

If visual QA after TERRAIN-02A confirms that the source art is non-directional, optional safe transforms (180-degree rotation, flipX, flipY) can be added as a TERRAIN-02B enhancement. But these must not be the primary repetition-reduction mechanism.

### 13.3 Tint range expansion

The current tint range (plus-minus 3%) should be expanded to plus-minus 8% to make per-tile color variation actually visible. At plus-minus 8% (plus-minus 20 out of 255), adjacent tiles will have perceptible but not distracting color differences.

### 13.4 Cluster-based variant selection

The map generator should assign detail variants (ripple, pebble, cracked) in a cluster-based manner:

1. The base type (sand, sand-dark, sand-light) is assigned first using the existing generator + cellular automata smoothing
2. Within each base-type cluster, detail variants are assigned using a second noise pass or distance-from-cluster-center logic
3. Detail variants inherit the base type's tint range but add their own texture pattern
4. Clean variant is the default (60-70% of tiles within a cluster)
5. Detail variants are sprinkled within clusters (10-15% each)

This produces natural-looking terrain where each cluster has a consistent base tone but varied surface detail.

---

## 14. Interaction with MAPLIFE Props / Decor

### 14.1 Terrain as base layer

The terrain RenderTexture is depth 0. MAPLIFE props and decals render on top:

```
Depth 0:   Terrain RenderTexture (sand tiles + decals)
Depth 5:   Standing props (bushes, rocks, wrecks) — depth-sorted by Y
Depth 10:  Buildings / Construction sites
```

Clean terrain art is essential for MAPLIFE because props sit directly on the terrain surface. If the terrain has visible grid lines or strong repeating patterns, it creates visual noise that clashes with prop placement. Clean, edge-free terrain tiles provide a neutral base that makes props look "placed on" the terrain rather than "floating above a pattern."

### 14.2 Decal integration

MAPLIFE-01 proposes two decal types (`prop_sand_crack`, `prop_sand_bump`) that would be stamped onto the terrain RenderTexture. With the new 256x128 pipeline:

- Decals should also be 256x128 source resolution
- Decals are stamped after all terrain tiles during RenderTexture construction
- Decal placement should avoid overlapping with terrain detail variants that already contain cracks (to prevent visual doubling)

### 14.3 Prop placement and terrain variants

Props should be placed preferentially on "clean" terrain variants rather than "cracked" or "ripple" variants, since the prop itself provides visual detail. Cracked and ripple variants fill in areas between props, creating a varied surface without needing prop coverage everywhere.

---

## 15. Interaction with Fog / Camera / Future Lighting

### 15.1 Fog of war (FOG-01)

Fog of war will be rendered as an overlay on top of the terrain RenderTexture. The FOG-01 design (two-layer: black/grey/visible) uses a separate RenderTexture or Graphics object for fog, independent of the terrain. Clean terrain art ensures that when fog reveals an area, the revealed terrain looks good without grid artifacts.

### 15.2 Camera system

The camera scrolls over the terrain RenderTexture. No changes needed for the 256x128 pipeline — the RenderTexture size is the same (determined by map extents, not tile source resolution). Camera zoom behavior is unaffected.

### 15.3 Future lighting (VISUAL-SPIKE-01 — deferred)

VISUAL-SPIKE-01 confirmed that the RenderTexture stamp model is incompatible with per-pixel lighting (RenderTexture has no Lighting component). This remains true regardless of source tile resolution. Lighting is deferred, and the 256x128 pipeline does not change the lighting compatibility situation. If lighting is implemented later, it would require a terrain renderer rewrite regardless of tile resolution.

---

## 16. Risk Matrix

| Risk | Severity | Probability | Mitigation |
|------|----------|------------|------------|
| New source art still has visible diamond edges | High | Medium | Explicit content spec (section 12.2 item 1) + visual QA before integration |
| 256x128 tiles produce visible pixelation at high zoom | Medium | Low | 3.37x oversampling is sufficient for typical zoom ranges; add higher-res variant if needed |
| TerrainType expansion breaks saved game compatibility | Medium | Medium | Backward-compatible TerrainType union — old saves with 3 types still load (missing types default to 'sand') |
| Safe transforms (flipX/flipY/180-degree) produce visual artifacts for directional source art | Medium | Medium | Source art spec requires non-directional lighting; TERRAIN-02A does NOT depend on transforms; transforms are optional only after visual QA |
| process_art_assets.mjs needs terrain entry updates | Low | High | Straightforward — add new entries to TERRAN_ENTRIES array |
| Tint expansion (plus-minus 8%) looks too noisy | Low | Medium | Tint range is a single constant; easy to tune down if needed |
| 6 variants insufficient for large maps (48x48+) | Low | Low | 6 variants + plus-minus 8% tint + cluster-based assignment provides substantial visual diversity; additional variants can be added in TERRAIN-02B if needed |

---

## 17. Recommended Implementation Sequence

### TERRAIN-02A: Asset generation and integration

1. Denis generates 6 terrain PNGs at 256x128 per the spec in section 12
2. Place PNGs in `public/assets/tiles/`
3. Remove old 1180x741 PNGs
4. Update `process_art_assets.mjs` TERRAN_ENTRIES with new keys and paths
5. Re-run `node tools/process_art_assets.mjs --family terrain` to regenerate manifest
6. Update `TerrainType` in `src/state/types.ts` (expand union)
7. Update `TERRAIN_KEY_MAP` in `TerrainRenderer.ts`
8. Update `TERRAIN_STAMP_CONFIG` scale from `76/1180, 38/741` to `76/256, 38/128`
9. Add deterministic variant selection logic (no rotation — see safe-transform rule in section 13.2)
10. Expand tint range from plus-minus 3% to plus-minus 8%
11. Update map generator to assign detail variants in clusters
12. Update `terrainClustering.ts` smoothing to handle expanded type set
13. Run validation: `npm test`, `npm run typecheck`, `npm run build`, `npm run qa:smoke`
14. Manual QA: terrain looks natural, no checkerboard, no grid seams

### TERRAIN-02B: Terrain variant placement tuning (if needed)

1. If repetition is still visible after 02A, tune variant distribution ratios
2. Add second noise pass for cluster-internal detail variant assignment
3. Tune tint range based on visual feedback
4. Possibly add 1-2 more variants (dune, footprint) if repetition persists

### TERRAIN-02C: Decal integration (depends on MAPLIFE-01 assets)

1. Once MAPLIFE-01 decals are available, stamp them onto the terrain RenderTexture
2. This is a separate task from the terrain quality pipeline

---

## 18. Ready-to-Send Implementation Prompt for TERRAIN-02A

```
Task:
TERRAIN-02A — Integrate 256x128 terrain tile family

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Read first:
- docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md
- src/phaser/render/TerrainRenderer.ts
- src/state/terrainClustering.ts
- src/state/types.ts
- src/assets/assetManifest.ts
- src/assets/generatedAssetManifest.ts
- tools/process_art_assets.mjs

Prerequisites:
- Denis has placed 6 new terrain PNGs at 256x128 in public/assets/tiles/
  (terrain_sand_clean.png, terrain_sand_ripple.png, terrain_sand_pebble.png,
   terrain_sand_cracked.png, terrain_sand_dark.png, terrain_sand_light.png)
- Old 1180x741 PNGs have been removed from public/assets/tiles/

Goal:
Integrate the new 256x128 terrain tile family into the runtime pipeline.

Scope:
1. Update TerrainType in src/state/types.ts to add 'sand-ripple', 'sand-pebble', 'sand-cracked'
2. Update TERRAIN_KEY_MAP in TerrainRenderer.ts with new key mappings
3. Update TERRAIN_STAMP_CONFIG scale from 76/1180, 38/741 to 76/256, 38/128
4. Add deterministic variant selection per cell using terrainTileHash (no rotation — see safe-transform rule)
5. Expand tint range from ±3% to ±8% in computeTerrainTint()
6. Update process_art_assets.mjs TERRAN_ENTRIES with 6 new terrain entries
7. Re-run process_art_assets.mjs to regenerate manifest
8. Update map generator to assign detail variants within clusters
9. Update terrainClustering.ts smoothing to handle 6 terrain types
10. Remove old assetManifest.ts terrain keys (deprecated, now unused)
11. Update terrainClustering.test.ts for new type set

Hard rules:
- Do NOT use 90-degree rotation for 256x128 isometric tiles (breaks diamond footprint)
- Do NOT depend on rotation or flipping as the primary repetition-reduction mechanism
- Do NOT change the RenderTexture stamp model
- Do NOT change TILE_W or TILE_H
- Do NOT change pathfinding or occupancy logic
- Do NOT modify MapData logical cell structure
- Do NOT change the isometric coordinate system
- Do NOT merge — open PR only
- Backward compatibility: old saves with 3 terrain types must still load (map unknown types default to 'sand')

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke
- Manual QA: terrain looks natural, no checkerboard, no grid seams

PR body must include:
- Goal
- Files changed
- What was replaced (1180x741 → 256x128)
- New terrain variants added
- Scale factor change
- Variant selection implementation (deterministic, no rotation)
- Tint range change
- What was intentionally NOT changed (RenderTexture model, pathfinding, coordinate system, rotation)
- Validation results
- Manual QA checklist
```

---

## 19. Ready-to-Send Implementation Prompt for TERRAIN-02B

```
Task:
TERRAIN-02B — Terrain variant placement tuning

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Read first:
- docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md
- src/state/terrainClustering.ts
- src/state/generatedMap.ts

Prerequisites:
- TERRAIN-02A is merged
- Terrain is functional with 6 variants but repetition may still be visible

Goal:
Tune terrain variant distribution and tint to minimize visible repetition.

Scope:
1. Add second noise pass for cluster-internal detail variant assignment
2. Tune variant distribution ratios (clean 60%, detail variants 10-15% each)
3. Tune tint range based on visual feedback (may increase or decrease from ±8%)
4. Evaluate if additional variants are needed
5. If repetition persists, consider adding terrain_sand_dune as a 7th variant

Hard rules:
- Do NOT change the RenderTexture stamp model
- Do NOT change source art — only tune runtime placement
- Do NOT change pathfinding
- Do NOT merge — open PR only

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke
- Manual QA: terrain repetition is not visible at normal zoom
```

---

## 20. Validation / Acceptance Checklist

### Pre-implementation (this audit)

- [x] Repo confirmed: `ratoker-jpg/four-elements-phaser`
- [x] Phaser version confirmed: 4.1.0
- [x] PR #103 (TERRAIN-01) merged on main
- [x] PR #117 (DEV-ASSET-PREVIEW-03) merged on main
- [x] All required docs read
- [x] All required source files inspected
- [x] Terrain asset files inspected (3 PNGs at 1180x741)
- [x] Root causes identified (5 contributing factors)
- [x] Options compared (A/B/C/D)
- [x] Recommended direction selected (Option B)
- [x] Denis preference aligned (256x128 source tile/patch)

### Post-implementation (TERRAIN-02A)

- [ ] 6 new terrain PNGs at 256x128 in `public/assets/tiles/`
- [ ] Old 1180x741 PNGs removed
- [ ] `TerrainType` expanded with 3 new variants
- [ ] `TERRAIN_STAMP_CONFIG` scale updated to `76/256, 38/128`
- [ ] `TERRAIN_KEY_MAP` updated with new keys
- [ ] Deterministic variant selection implemented (no rotation — safe-transform rule observed)
- [ ] Tint range expanded to plus-minus 8%
- [ ] Map generator assigns detail variants in clusters
- [ ] `process_art_assets.mjs` updated with new terrain entries
- [ ] `generatedAssetManifest.ts` regenerated
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npm run qa:smoke` passes
- [ ] Manual QA: no checkerboard pattern visible
- [ ] Manual QA: no grid/diamond line seams visible
- [ ] Manual QA: terrain reads as natural desert surface
- [ ] Manual QA: zoom in/out does not reveal pixelation or blur
- [ ] Old saves still load correctly (backward compatibility)

---

## 21. Explicit Answers to Required Questions

### Q1: Why does the current terrain visually read as low-quality / checkerboard / over-repeated?

Five root causes (see section 4): built-in diamond edges in source art, extreme 15-19x downscaling destroying detail, only 3 tile variants, imperceptible tint variation, and inherently repetitive per-cell stamping.

### Q2: Is the main issue source asset content, source resolution, stamp scale, RenderTexture baking, camera/display scaling, smoothing/tint logic, or a combination?

**A combination.** The primary issues are source asset content (built-in edges) and source resolution (extreme downscaling). Secondary issues are variant count (3) and tint subtlety. The RenderTexture model, camera, and smoothing are not root causes.

### Q3: Why is TerrainRenderer scaling based on scaleX = TILE_W / 1180, scaleY = TILE_H / 741, and is that still correct?

The 1180/741 values match the current source PNG dimensions. The scale is mathematically correct for mapping those sources to 76x38 pixels. However, the 1180x741 source resolution is inappropriate for per-cell isometric stamping — it is approximately 15-19x too large, causing detail destruction during downscaling. The scale should be updated to `76/256, 38/128` when 256x128 source tiles are used.

### Q4: Are the current terrain PNGs fundamentally unsuitable for a clean RTS sand floor?

**Yes.** The current PNGs have two fundamental problems: (1) they contain built-in diamond edge gradients that produce visible grid seams when tiled, and (2) their 1180x741 resolution is so far above the display size that all texture detail is lost in downscaling. Even if the edges were removed, the extreme minification would still produce flat-colored diamonds.

### Q5: Is the visible "grid / diamond line" look coming from asset content, renderer, debug overlay, or all of the above?

**Primarily asset content.** The built-in diamond edges in the source PNGs create grid seams when adjacent tiles are stamped. The debug overlay (now removed in TERRAIN-01) previously reinforced this. The renderer is not a contributor — it stamps correctly.

### Q6: If we target 256x128 terrain source tile / patch, how exactly should that be used?

Each 256x128 PNG represents one isometric diamond tile at 3.37x oversampling. The TerrainRenderer stamps each cell using `renderTexture.stamp()` with `scaleX = 76/256, scaleY = 38/128`, origin at (0.5, 0.5). Deterministic variant selection (no rotation) is applied per cell using `terrainTileHash()`. The 6 variants are assigned by the map generator with cluster-based distribution. This is a drop-in replacement for the current 1180x741 pipeline — same stamping model, different source dimensions and scale. Rotation is NOT used for 256x128 isometric tiles because arbitrary rotation breaks the diamond footprint (see safe-transform rule in section 13.2).

### Q7: Should we keep the current RenderTexture-based terrain renderer, or evolve it?

**Keep it.** The RenderTexture stamp model is optimal for the current scope: zero per-frame cost, efficient camera scrolling, and compatible with fog/decals. No evolution is needed for the terrain quality improvement.

### Q8: Should the future model remain tile-per-cell, or move toward patch/chunk composition while still keeping MapData logical cells?

**Remain tile-per-cell for now.** The per-cell stamp model with 6 variants, expanded tint variation (plus-minus 8%), and cluster-based assignment is sufficient for the visual quality target. Rotation is NOT used for 256x128 isometric tiles (unsafe — breaks diamond footprint). Patch/chunk composition would require renderer changes that are not justified by the visual improvement. If repetition remains visible after TERRAIN-02A + 02B, patch composition can be reconsidered.

### Q9: What is the cleanest path to better perceived resolution, less repetition, more natural sand clustering, and compatibility with MAPLIFE props later?

The cleanest path is: (1) new 256x128 source art without built-in edges, (2) 6 variants with deterministic variant selection and expanded tint variation (plus-minus 8%), (3) cluster-based variant assignment in the map generator, (4) optional safe transforms only after visual QA confirms source art is non-directional, and (5) clean edge-free base layer that supports MAPLIFE decal/prop placement.

### Q10: What should be the future terrain asset family set?

6 variants for the first pass: `terrain_sand_clean`, `terrain_sand_ripple`, `terrain_sand_pebble`, `terrain_sand_cracked`, `terrain_sand_dark`, `terrain_sand_light`. See section 11 for full spec.

### Q11: What exact asset specs should Denis generate next?

See section 12 for the full asset generation spec. Summary: 6 PNGs, each 256x128 pixels, RGBA with transparent background, no built-in diamond edges, warm desert palette, seamless tiling, non-directional lighting (to allow optional safe transforms after visual QA), with consistent isometric diamond mask.

### Q12: What implementation sequence should we follow after this audit?

TERRAIN-02A (asset integration) → TERRAIN-02B (placement tuning if needed) → MAPLIFE-01 (decals/props on clean terrain base). See section 17 for full sequence.

### Explicit answers to required yes/no questions:

**Should the future terrain art contain visible grid/diamond lines?**
**No.** The source art must NOT contain any visible diamond border, edge gradient, or grid line. Grid lines are the primary cause of the current checkerboard appearance. Gameplay grid visibility is handled by the isometric coordinate system and cell-selection feedback, not by terrain art.

**Should soft sand variation be in the texture art itself?**
**Yes, partially.** The source art should contain subtle texture variation (grain, ripples, pebbles) to break up flat-color appearance. However, larger-scale variation (bright/dark clusters, zone transitions) should remain in the runtime placement logic, not baked into the art. The split is: fine detail in art, coarse variation in runtime.

**Should clustering happen via runtime placement, source art families, or both?**
**Both.** Source art families provide the variant set (6 textures). Runtime placement assigns variants to cells in cluster-based patterns (cellular automata for base type, noise/distance for detail variants). Deterministic tint variation (plus-minus 8%) adds per-tile color diversity at runtime. Rotation is NOT used for 256x128 isometric tiles because arbitrary rotation breaks the diamond footprint. Optional safe transforms (180-degree, flipX/flipY) may be added later after visual QA, but they must not be the primary repetition-reduction mechanism. Neither source art nor runtime placement alone is sufficient; the combination is required.

**What resolution and content should the tile/patch source use?**
256x128 pixels per tile. Content: warm desert sand texture within an isometric diamond mask, no built-in edges, seamless tiling, non-directional lighting (for optional safe transforms after QA). See section 12 for the full spec.

**How should this prepare the ground for MAPLIFE props?**
Clean, edge-free terrain provides a neutral visual base. Props should be placed preferentially on "clean" terrain variants (where the terrain texture is simple) rather than "cracked" or "ripple" variants (where the terrain already provides visual detail). The terrain detail variants fill in the spaces between props, ensuring the map looks varied even in areas with no props.

---

## 22. What Was Intentionally Not Changed

This audit document makes **zero changes** to runtime code, assets, or configuration. The following were specifically NOT modified:

- `src/phaser/render/TerrainRenderer.ts` — no changes
- `src/state/terrainClustering.ts` — no changes
- `src/state/types.ts` — no changes
- `src/config/worldConfig.ts` — no changes
- `public/assets/tiles/` — no changes
- `src/assets/generatedAssetManifest.ts` — no changes
- `tools/process_art_assets.mjs` — no changes
- `src/phaser/GameScene.ts` — no changes
- Any PNG files — no changes

The only artifact of this task is this document:
`docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md`
