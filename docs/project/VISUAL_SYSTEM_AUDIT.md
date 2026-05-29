# VISUAL SYSTEM AUDIT — Four Elements Phaser

Status: **Audit/design document — docs only, no runtime changes**
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-05-30

---

## 1. Executive summary

### What the visual roadmap is trying to solve

The Four Elements Phaser project has a functional civil economy loop — harvesting, building, production — but the visual presentation does not meet the quality bar for a real RTS prototype. The terrain reads as a grid of diamond tiles rather than a grounded surface. The map floats in empty space without spatial context. The HUD is a debug-style sidebar rather than a game-like interface. The overall impression is "web demo" rather than "industrial RTS battlefield."

The VISUAL roadmap (accepted in PR #122) establishes a new direction: industrial RTS battlefield / mining platform / industrial mineral wasteland. This audit translates that direction into a concrete, staged implementation plan with specific PR breakdowns, file impact, Phaser 4 capability analysis, and risk assessment.

### Why the current sand/MAPLIFE path is paused

Sand terrain (TERRAIN-01 through TERRAIN-FIX-01) produced a technically sound 256x128 tile pipeline with 6 sand variants, smoothing tints, and seamless overlap. However, the visual result — a flat desert grid — does not read as a grounded RTS battlefield. The MAPLIFE-01 auto-generated decor attempt (PR #120) was visually rejected because procedural desert props (bushes, bumps, cracks) could not compensate for the fundamental problem: the map looks like a puzzle board, not a place.

The sand direction is paused, not deleted. Sand assets and code remain as fallback/reference. But the primary visual direction must change before more implementation work proceeds.

### What the new industrial RTS direction means

The new direction means the game map should feel like a functional industrial surface — metal platforms, concrete, mineral deposits, worn machinery zones — not a natural desert. The map should sit on a larger world surface with irregular edges, not float as a perfect diamond. The HUD should be a StarCraft-inspired bottom bar with minimap, selected-unit info, and command panel. The menu should keep its successful central composition but swap the background to an industrial world. Every visual layer — terrain, frame, resources, units, UI — must be reconsidered under this direction.

This is not a cosmetic reskin. It is a systematic visual re-architecture that must be staged carefully to avoid one giant rewrite that blocks all other work.

---

## 2. Current visual state

### 2.1 Current terrain system

The terrain is rendered by `TerrainRenderer` using a RenderTexture stamp model. During scene creation, all 2304 tiles (48x48 standard map) are stamped once onto a single `Phaser.GameObjects.RenderTexture`. The camera scrolls over this static texture with zero per-frame cost. Each tile is a 256x128 source image scaled to 76x38 with a 1% overlap factor to close sub-pixel seams. Six sand variants exist: clean, dark, light, ripple, pebble, cracked. Per-tile tint variation of +/-2% breaks up visual repetition.

The patch-based clustering algorithm in `generatedMap.ts` places large primary patches, small accent patches, and detail variants. The result is a varied but clearly diamond-tiled desert surface. Grid lines have been removed, but the diamond cell boundaries are still perceptible because each tile is a distinct isometric diamond.

**Key limitation**: The RenderTexture stamp model is efficient but static. Terrain changes require full reconstruction. More importantly, the stamped terrain cannot be lit by Phaser's per-pixel lighting system (RenderTexture lacks the Lighting component), which limits future visual enhancement options.

### 2.2 Current asset loading

Assets are loaded in `PreloadScene` in 4 phases: terrain + resources, buildings + HQ, civil unit spritesheets, modular combat units (devtools-only). A pure DOM overlay shows loading progress. The `generatedAssetManifest.ts` contains 104 key-to-path mappings across 6 families. Civil units use spritesheets (8x8 grid, 256px frames, 64 frames per sheet). Combat units use individual images per direction (64 total for hull + turret across 4 factions). Resources use 3 static images (small/medium/large mineral crystals).

**Key limitation**: No asset unloading or hot-reload. No streaming or lazy loading beyond the devtools gate for combat units. All faction assets are loaded upfront regardless of player faction choice.

### 2.3 Current UI/HUD/menu structure

All UI is pure DOM overlays — no Phaser UI objects. The `PlaytestHud` is a 228px-wide right sidebar containing: economy display, harvester status list, separator status, factory queue with progress bars, build buttons, produce buttons, and status messages. The `MainMenuScene` presents "Four Elements / Phaser Prototype" with New Game / Continue / Settings buttons in a centered layout over a dark background (`#1a1a2e`). The `NewGameSetupScene` offers faction selection, game mode, map size, and seed input.

**Key limitation**: The right-sidebar HUD is functional but not game-like. It reads as a debug panel, not an RTS interface. There is no minimap, no selected-unit info panel, no command card. The main menu has no background art — just a solid dark color with text.

### 2.4 Current map generation and start position

The map is generated by `createGeneratedMapData()` using a deterministic Mulberry32 PRNG. HQ is always placed at tile (4, 4) in the upper-left area of the map. A starter builder sits at (3.5, 3.5). Starter resources (6 medium + 6 small) are placed SE of HQ. A central infinite deposit occupies a 3x3 area at the map center. Additional resource clusters are distributed by distance from HQ.

**Key limitation**: The upper-left start position means the camera initially faces the upper-left corner, which is the least visually interesting area (edge of map, minimal content). The VISUAL roadmap calls for a lower-left start, which will require changing the HQ placement and camera initial position.

### 2.5 Current dev asset preview capabilities

The `AssetPreviewTool` (activated by pressing 0 with devtools enabled) allows uploading PNG images and placing them on the map as preview sprites. It includes chroma-key controls (color, tolerance, reprocess) for background removal. This is a useful diagnostic tool but not a production asset workflow.

### 2.6 Current limitations summary

| Layer | Current state | Problem |
|-------|--------------|---------|
| Terrain | Sand desert, 6 variants, RenderTexture stamp | Reads as diamond grid, not grounded surface |
| Map presentation | Perfect rectangular diamond, floating | No spatial context, no world frame |
| Start position | Upper-left (4, 4) | Camera faces least interesting area |
| Resources | 3 mineral crystal types, scale variants | Desert aesthetic, not industrial |
| HUD | Right sidebar, debug-style | Not game-like, no minimap |
| Menu | Dark background, text only | No visual identity, no background art |
| Units | Sand-era harvester/builder sprites | Desert aesthetic, not industrial |
| Decor | None (deferred) | No environmental storytelling |

---

## 3. Target visual direction

### 3.1 One primary biome only

The VISUAL roadmap is explicit: build one biome that is visually strong, readable, and complete. Do not build four biomes now. The chosen biome is industrial RTS battlefield / mining platform / industrial mineral wasteland. Every visual decision — terrain surface, resource style, unit appearance, HUD theme, menu background — must serve this single biome direction.

### 3.2 Industrial RTS battlefield / mining platform / industrial mineral wasteland

The map should feel like a functional industrial surface — metal platforms, concrete sections, mineral deposits embedded in industrial flooring, worn machinery zones, strategic markings. The visual language should evoke a constructed, operational environment: a mining platform where resources are extracted and processed. This is a deliberate pivot from natural terrain (desert) to constructed environment (industrial), which changes every visual layer.

Reference points: StarCraft's terrain readability, Command & Conquer's industrial maps, Age of Empires II's paved areas — but with the game's own identity, not copies.

### 3.3 Map sits on larger world/surface

The playable area must not float in empty space. It should visually sit on a larger non-playable world surface. The player should feel the battlefield is a zone within a larger world. This requires an outer visual frame — background terrain, environment, or extended surface that extends beyond the playable grid.

### 3.4 Irregular playable edges

The playable area should have irregular/organic edges, not a perfect rectangular diamond. Industrial platforms would not be perfect rectangles — they would have cutouts, extensions, worn boundaries. This is a visual treatment that does not change the logical grid structure.

### 3.5 StarCraft-inspired but not copied

StarCraft is the reference for: terrain that reads as a surface rather than a grid, maps that feel like places, functional HUD layout (minimap left, info center, commands right), command panel that is context-sensitive and readable. This does NOT mean copying StarCraft assets, exact UI dimensions, or copyrighted visual design. It means learning from the structural principles that make StarCraft's visual presentation effective.

### 3.6 Warm industrial menu style

The main menu should preserve its successful central composition (cinematic background + central panel + warm buttons) but replace the dark solid background with an industrial world scene. The warm bronze/gold button style should continue — it provides visual warmth that contrasts nicely with an industrial environment.

### 3.7 RTS HUD layout

The target HUD is a bottom bar: minimap bottom-left, selected unit/building info bottom-center, command/production/hotkey panel bottom-right. Warm industrial sci-fi style. Readable, game-like, not web-demo-like. This replaces the current right-sidebar PlaytestHud entirely.

---

## 4. Phaser 4 capability audit

### 4.1 Tile/texture rendering

Phaser 4.1.0's `Image` and `Sprite` GameObjects support arbitrary positioning, scaling, origin control, tinting, and alpha. The current project uses these extensively for terrain stamps, entity rendering, and building placement. For the industrial direction, the same primitives can render industrial platform tiles using the existing RenderTexture stamp model with new tile assets.

`TilemapGPULayer` is NOT viable — it only supports orthographic tile layouts, not isometric 2:1 projections. The PHASER4-GPU-01 spike confirmed this is a hard blocker.

**Verdict**: Continue with RenderTexture stamp + individual Images/Sprites. No GPU layer migration needed.

### 4.2 RenderTexture/stamp terrain

The current `RenderTexture` approach stamps all terrain tiles once during scene creation. The camera scrolls over the static texture. This is efficient (zero per-frame cost for terrain) and works well for static terrain. The main limitation is that RenderTexture does not support Phaser's Lighting component — terrain cannot be dynamically lit.

For the industrial direction, the RenderTexture stamp model remains the recommended approach. The industrial platform surface is also static — it does not animate or change during gameplay. The only change is the tile assets and tint logic, not the rendering architecture.

**Verdict**: Keep RenderTexture stamp model. Replace sand tile assets with industrial platform assets.

### 4.3 Image/sprite scaling and filtering

Phaser 4.1.0 supports `NEAREST` and `LINEAR` texture filtering. The current terrain uses scaled 256x128 tiles at 76x38 with slight overlap. `NEAREST` filtering would produce crisp pixel-art tiles; `LINEAR` filtering produces smooth interpolation. The current project uses the default (LINEAR) and the overlap factor closes seams.

For industrial tiles, the same scaling approach works. Industrial surfaces may benefit from LINEAR filtering to avoid harsh pixel boundaries on metallic gradients. The overlap factor should be preserved.

**Verdict**: No rendering changes needed for scaling/filtering. Asset-dependent tuning only.

### 4.4 Masks, cameras, layers

Phaser 4.1.0 supports `Phaser.GameObjects.Layer` for depth-sorted batch management, `Phaser.Display.Masks` for bitmap and geometry masking, and a full camera system with pan, zoom, bounds, fade, flash, and shake.

For the map frame / grounded presentation, several options use these capabilities:
- A background `Image` at lower depth (below terrain) for the outer world surface
- A `Graphics` mask to create irregular playable-area edges
- A `Layer` for the outer world decoration at a fixed lower depth
- Camera bounds can be extended beyond the playable grid to allow scrolling over the frame

**Verdict**: Phaser 4 has all needed capabilities for map frame implementation. No custom rendering required.

### 4.5 UI overlays / DOM vs Phaser UI

The current project uses pure DOM overlays for all UI (HUD, menus, devtools). This is architecturally clean — DOM UI does not interact with the Phaser rendering pipeline and scales independently. However, a minimap component needs to render a miniature version of the game world, which cannot be done efficiently in pure DOM.

Options for the minimap:
- **Phaser Graphics**: Draw simplified terrain shapes and unit dots on a Phaser `Graphics` object positioned in the bottom-left corner. This requires translating world coordinates to minimap coordinates each frame.
- **Second camera**: Phaser 4 supports multiple cameras per scene. A second camera with a small viewport in the bottom-left corner could render a zoomed-out view of the entire map. This is the simplest approach but renders the full scene twice.
- **DOM Canvas**: A separate `<canvas>` element in the DOM overlay, drawn with 2D context commands. Isolated from Phaser, but requires manual synchronization.

**Verdict**: Second-camera approach is recommended for initial minimap implementation — simplest, most Phaser-idiomatic, no custom rendering. Can be optimized later if performance is an issue.

### 4.6 Minimap feasibility

A second camera with a small viewport (approximately 200x150 pixels) in the bottom-left corner is straightforward in Phaser 4. The camera would have a fixed zoom level showing the entire map, and a viewport rectangle defining its screen position. Entity sprites would automatically appear in the minimap because they are in the same scene.

Known considerations:
- The second camera renders all scene objects, including UI overlays that should not appear in the minimap. UI elements must be excluded by setting `scrollFactorX/Y = 0` and placing them in a UI camera layer, or by using `camera.ignore(gameObject)`.
- The minimap camera adds one full render pass per frame. For the current sprite count (under 50 objects), this is negligible.
- Pointer interaction on the minimap (click to scroll) requires translating minimap click coordinates to world coordinates and scrolling the main camera. This is a separate implementation task.

**Verdict**: Feasible with second camera. Implementation complexity is low-medium.

### 4.7 Pointer interactions

Phaser 4.1.0's pointer system supports click, drag, hover, and multi-touch. The current project uses `pointerdown`/`pointerup` for unit selection and movement commands. Adding minimap click-to-scroll requires adding pointer handlers to the minimap camera's viewport area and translating coordinates.

The HUD bottom bar needs pointer handlers for: minimap click/scroll, unit info panel interactions, command button clicks, and production button clicks. These are all standard DOM or Phaser pointer events — no exotic API needed.

**Verdict**: No pointer system changes needed. Standard Phaser + DOM event handling.

### 4.8 Depth sorting

The current depth model uses `depth = baseValue + worldY` for painter's algorithm isometric sorting. This works correctly and is fundamental to the project's rendering. All VISUAL roadmap changes must preserve this model.

The map frame / background layer should use a fixed low depth (e.g., -10 to -1) so it renders behind the terrain (depth 0). The HUD bottom bar is pure DOM and does not participate in Phaser depth sorting.

**Verdict**: Depth model is preserved. Map frame adds lower-depth layers. No changes to entity depth calculation.

### 4.9 Asset loading

The current `runtimeGeneratedAssets.ts` loads asset families from the generated manifest. Adding new industrial tile assets requires: new tile PNG files, new manifest entries, updated `TerrainRenderer` stamp config. The loader infrastructure is already in place.

For the staged approach, industrial tile assets can be loaded alongside existing sand tiles initially, then sand tiles can be removed once the industrial direction is confirmed. The loader supports any number of terrain families — there is no hard limit.

**Verdict**: Asset loading infrastructure is sufficient. No loader changes needed for new tile families.

### 4.10 Shader/lighting constraints

Per VISUAL-SPIKE-01, normal maps and dynamic per-pixel lighting are **deferred**. The RenderTexture terrain cannot be lit (no Lighting component). Entity sprites CAN be lit individually, but the visual inconsistency between lit entities and unlit terrain would be jarring.

The recommended approach (VISUAL-SPIKE-01 Option A) is baked lighting in all sprites/tiles. Industrial tiles should have baked ambient occlusion, contact shadows, and directional highlights. This produces consistent visuals without runtime lighting complexity.

Future Option E (PointLight for weapon VFX only) is the best runtime lighting candidate — it requires no normal maps and works with the current renderer.

**Verdict**: No lighting/shader changes in the VISUAL roadmap. All lighting is baked into assets. PointLight weapon VFX is a future enhancement.

---

## 5. Map visual architecture options

### Option A: Continue current tile stamp terrain with new industrial tiles

**What it is**: Replace the 6 sand tile PNGs with industrial platform tile PNGs. Keep the exact same RenderTexture stamp model, same stamp config, same tint variation approach. Only the visual content of the tiles changes.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Minimal code changes — only asset files and terrain type names change. Rendering architecture is proven and performant. Zero risk to gameplay. Can be done in a single focused PR. |
| **Cons** | Does not address the "floating map" problem. Does not address the "diamond grid" readability issue. Industrial tiles stamped as diamonds may still read as a grid, just an industrial-colored one. |
| **Complexity** | Very low — asset swap only |
| **Risk** | Very low |
| **Recommended** | **Yes, as the first step** — but not sufficient alone |
| **Impact on current code** | `generatedAssetManifest.ts` (terrain family paths), `TerrainRenderer.ts` (asset key mapping, possibly tint logic), `types.ts` (TerrainType values), `generatedMap.ts` (terrain variant distribution) |

### Option B: Hybrid large surface chunks + detail overlays

**What it is**: Instead of stamping individual 76x38 tiles, stamp larger pre-rendered surface chunks (e.g., 256x256 or 512x256 platform sections) as the base, then overlay individual detail tiles (cracks, markings, wear patterns) on top. The base chunks provide a continuous surface look; the detail tiles add variation.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Can eliminate the visible diamond grid by using larger base chunks that span multiple tiles. Detail overlays add controlled variation. Could produce a more "continuous surface" feel. |
| **Cons** | Significantly more complex rendering — two-layer terrain stamp (base + details). Large chunks must align with the isometric grid, which is non-trivial. Chunk seams may be visible. Asset production is harder (large aligned chunks vs. individual tiles). |
| **Complexity** | Medium-high |
| **Risk** | Medium — chunk alignment, seam management, asset production complexity |
| **Recommended** | **Not recommended for now** — too complex for initial implementation. Could be a future optimization after basic industrial tiles are proven. |
| **Impact on current code** | `TerrainRenderer.ts` (two-layer stamp), `PreloadScene.ts` (new asset families), `generatedAssetManifest.ts` (chunk + detail families), `generatedMap.ts` (chunk selection + detail distribution) |

### Option C: Generated background/platform image under playable cells

**What it is**: Render a full-map background image (or large tiled background) at a lower depth, then stamp the playable terrain tiles on top. The background extends beyond the playable grid, providing the "world surface" feel. Playable tiles sit on top of this background like platforms on a larger surface.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Directly addresses the "map floating in space" problem. Background provides spatial context. Relatively simple — one background Image at low depth plus the existing terrain stamp on top. Background can be procedurally generated or hand-crafted. |
| **Cons** | Background image must be large enough to cover the extended visible area beyond the playable grid. If procedurally generated, it needs its own generation logic. The transition between background and playable terrain must look natural, not like a floating island. |
| **Complexity** | Medium |
| **Risk** | Low-medium — visual integration between background and playable area is the main risk |
| **Recommended** | **Yes, as Phase V4** — after industrial terrain is established, add a background/world layer underneath |
| **Impact on current code** | New renderer or extension of `TerrainRenderer` for background layer, `PreloadScene.ts` (background asset load), `GameScene.ts` (background creation), `isometric.ts` (extended coordinate mapping) |

### Option D: Irregular playable mask/edge overlay approach

**What it is**: After the terrain is stamped and the background is in place, add a visual mask or overlay at the playable area edges that creates irregular/organic boundaries. This could be a Phaser Graphics mask, a set of edge-overlay Images, or a RenderTexture with an irregular alpha boundary.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Directly addresses the "perfect rectangular diamond" problem. Creates the impression of an irregular industrial platform edge. Can be purely visual — no changes to the logical grid. |
| **Cons** | Mask/overlay alignment with the isometric grid requires careful pixel work. Edge overlays need many assets for different edge configurations. The visual result depends heavily on art quality — bad edges look worse than clean edges. |
| **Complexity** | Medium |
| **Risk** | Medium — art-dependent; requires good edge assets to look convincing |
| **Recommended** | **Yes, as part of Phase V4** — after background layer, add edge overlays for irregular boundaries |
| **Impact on current code** | `TerrainRenderer.ts` or new `MapFrameRenderer` for edge overlays, `PreloadScene.ts` (edge assets), `GameScene.ts` (edge creation) |

### Option E: Full StarCraft-like terrain system with ramps/cliffs

**What it is**: A full terrain system with elevation levels, ramp transitions, cliff faces, and height-based gameplay. Different terrain heights affect visibility, movement, and unit behavior.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Maximum visual and gameplay depth. True RTS terrain system. |
| **Cons** | Enormous scope — would require rewriting the entire map generation, pathfinding, rendering, and camera systems. Months of work. Height gameplay changes are out of scope for the VISUAL roadmap (which explicitly says "no height gameplay yet"). |
| **Complexity** | Very high |
| **Risk** | Very high — fundamental architecture changes across multiple systems |
| **Recommended** | **Not recommended now** — explicitly excluded by VISUAL roadmap |
| **Impact on current code** | `generatedMap.ts` (height map), `TerrainRenderer.ts` (multi-elevation rendering), `isometric.ts` (Z-coordinate), `pathfinding` (3D pathfinding), `EntityRenderer.ts` (elevation-based positioning), `CameraControls` (height-aware scrolling) |

---

## 6. Recommended map approach

### Staged industrial platform approach

The recommended approach is a staged implementation that builds visual quality incrementally, with each stage producing a reviewable, mergeable result:

**Stage 1 — Industrial tile assets (VISUAL-03)**
Replace sand tile PNGs with industrial platform tile PNGs. Same RenderTexture stamp model. Same code architecture. Only the visual content changes. This is the lowest-risk, fastest path to "not a desert anymore."

**Stage 2 — Visual candidate review (VISUAL-01/02)**
Before Stage 1 is implemented in runtime, produce 2-3 static visual candidates showing what an industrial platform surface could look like. These are image mockups — not runtime. One direction must be approved by the project owner before runtime integration begins.

**Stage 3 — Map background/world layer (VISUAL-04)**
After industrial terrain is proven in runtime, add a background Image or extended terrain rendering beneath the playable grid. This makes the map feel like it sits on a world surface rather than floating in space.

**Stage 4 — Irregular edge overlays (VISUAL-04 continued or separate)**
Add edge/trim/cliff overlay Images at the playable area boundaries to break the perfect rectangular diamond shape. This is visual-only — the logical grid remains unchanged.

**Why NOT build a full StarCraft terrain system now:**
- The VISUAL roadmap explicitly says "no height gameplay yet."
- Full terrain elevation would require rewriting map generation, pathfinding, rendering, and camera systems.
- The current RenderTexture stamp model is efficient and proven.
- Incremental visual improvement (better tiles + background + edges) can achieve 80% of the visual impact with 10% of the effort.

---

## 7. Map frame / grounded presentation audit

### 7.1 Non-playable background/world layer

The map needs a visual layer beneath the playable terrain that extends beyond the grid boundaries. Options:

1. **Extended RenderTexture**: Stamp terrain tiles beyond the playable grid with a different (darker, simpler) visual treatment. The extended area suggests a larger world surface. Requires expanding the RenderTexture size and stamping additional "outer" tiles.

2. **Background Image**: Place a single large Image behind the terrain RenderTexture at a lower depth. The image could be a pre-rendered industrial landscape, a simple gradient, or a procedurally generated surface. Simpler than extended rendering but less dynamic.

3. **Second RenderTexture layer**: A separate RenderTexture for the outer world surface, rendered once like the terrain but at a lower depth. Could use simpler, coarser tiles for the outer area.

**Recommendation**: Option 1 (Extended RenderTexture) for the initial implementation. It reuses the existing stamp infrastructure and provides tile-aligned visual continuity between playable and outer areas. The outer tiles can use darker, simpler variants of the industrial platform tiles.

### 7.2 Outer visual surface under map

The outer surface should visually suggest that the playable area is a constructed platform sitting on or within a larger industrial environment. Possible visual treatments:

- Darker, worn industrial surface extending outward
- Subtle grid/marking pattern that fades toward the edges
- Atmospheric haze or fog at the boundaries
- Industrial infrastructure (pipes, supports) visible at the edges

### 7.3 Optional edge/trim/cliff/industrial wall overlays

At the boundary between the playable area and the outer surface, visual overlays can create the impression of a platform edge:

- **Industrial wall/rim**: A set of overlay images that tile along the platform edge, suggesting a raised platform with walls
- **Worn boundary**: Irregular alpha-masked edge images that create a natural-looking boundary
- **Support structure**: Pillar or support images at regular intervals under the platform edge

### 7.4 What is visual-only vs gameplay

Everything in the map frame / grounded presentation is visual-only. No changes to:
- Pathfinding (the logical grid is unchanged)
- Occupancy (the playable grid cells are unchanged)
- Resource placement (resources remain within the playable grid)
- Camera bounds (may be extended slightly for the outer area, but the playable grid is the same)
- Save/load compatibility (the logical map structure is unchanged)

### 7.5 What not to implement yet

- No height gameplay — the platform edge is visual only
- No parallax scrolling — the background is at a fixed world position
- No fog of war interaction with the frame — FOG-01 is a separate parallel task
- No animated background elements — static visual layer only
- No pointer interaction with the outer world surface

---

## 8. Start position audit

### 8.1 Current start placement

HQ is placed at tile (4, 4) in the upper-left area of the map. A starter builder is at fractional position (3.5, 3.5). Starter resources (6 medium + 6 small) are placed SE of HQ. The camera centers on the HQ footprint center tile (5, 5).

**Problems with upper-left start:**
- Camera initially faces the upper-left corner — the least visually interesting area
- The player's base is at the edge, making the map feel unbalanced
- In most RTS games, the player starts near the bottom, looking "north" toward the enemy
- The upper-left position means most of the map content is to the south and east, creating an awkward initial orientation

### 8.2 Plan for lower-left start

Move the HQ default position to the lower-left area of the map. For a 48x48 map, this would be approximately tile (4, mapH - 7) — near the left edge, but in the lower half. The exact position should be determined during implementation to ensure:
- Camera starts centered on the new HQ position
- Starter resources are placed near the new HQ position (NW of HQ, or in the inner map direction)
- The central infinite deposit remains near the map center
- Rich resource clusters are further from the start, encouraging expansion

### 8.3 Requirements

- **Camera starts on HQ**: The camera centering logic in `GameScene.create()` already centers on the HQ footprint. This works automatically as long as the HQ position changes.
- **Start resources near HQ**: The starter cluster generation in `generatedMap.ts` must be updated to place resources relative to the new HQ position (currently hardcoded SE of (4,4)).
- **No blocked start**: The validation logic must ensure the new HQ position has clear tiles and reachable resources.
- **Center/rich resources remain toward center**: The central infinite deposit and rich clusters should not move — they should remain at the map center, now further from the player start, encouraging expansion.
- **Deterministic generation**: The PRNG-based generation must remain deterministic with the same seed. Changing the start position changes the seed's effect on resource placement, so map seeds will produce different maps after this change. This is acceptable — it is a visual/composition change, not a gameplay regression.
- **Tests needed**: `generatedMap.test.ts` and `mapValidation.test.ts` must be updated to expect the new HQ position. All map generation tests that assert HQ at (4, 4) must be updated. New tests should verify: resources near new HQ, no blocked start, camera starts on HQ.

### 8.4 Implementation approach

1. Change `DEFAULT_HQ_TX` and `DEFAULT_HQ_TY` in `generatedMap.ts`
2. Update starter resource placement to be relative to new HQ position
3. Update validation rules for the new position
4. Update all tests that assert HQ at (4, 4)
5. Verify camera centering works with new position
6. Manual QA: start a new game and verify the view feels natural

---

## 9. Resource visual model audit

### 9.1 Current minerals/resources

Three mineral crystal types: `mineral_small`, `mineral_medium`, `mineral_large`. All use the same crystal aesthetic in sand/desert tones. Infinite deposits use the `mineral_large` asset at a larger scale. Resources are rendered as individual `Image` objects with scale variants (0.3 to 0.65). Depleted resources are hidden (visibility toggle).

### 9.2 Future model proposal

- **One resource node = one playable cell** (preferred). Each resource node occupies exactly one isometric cell. This simplifies occupancy, pathfinding, and depletion logic. The current model already does this.
- **Resource field = group of 1x1 nodes**. A resource field is a cluster of individual 1x1 nodes placed near each other. The visual density of the cluster conveys the richness of the field. This is already the current model.
- **Central infinite resource may be special**. The central infinite deposit (3x3) can retain its multi-cell footprint since it is a unique gameplay element. Its visual treatment should be distinct — perhaps a large industrial extractor or mining rig rather than a crystal cluster.
- **Industrial visual style**: Replace crystal/mineral sprites with industrial-themed resource sprites — glowing mineral deposits embedded in industrial flooring, industrial extraction nodes, glowing ore chunks on metal surfaces.

### 9.3 What NOT to do in the audit PR

- Do not create new resource sprites
- Do not change resource gameplay mechanics
- Do not change depletion logic
- Do not change resource placement algorithms

Implementation of resource visual changes is deferred to Phase V6 (VISUAL-06).

---

## 10. Asset workflow audit

### 10.1 Manual candidate generation first

The VISUAL roadmap must not repeat the MAPLIFE-01 mistake (mass auto-generated assets that were visually rejected). The correct workflow is:

1. **Manual concept exploration**: Produce 2-3 visual direction candidates as static images. These can be created in any tool — image editor, 3D renderer, AI generation, hand painting. They are NOT runtime assets.
2. **Owner review**: The project owner reviews the candidates and approves one direction.
3. **Asset production**: Only after approval, produce the full tile family / sprite set for the approved direction.
4. **Runtime integration**: Load the approved assets into the Phaser runtime and verify visually.

### 10.2 Visual approval through screenshots/preview

Every asset batch must be reviewed through:
- Static screenshots of the candidate direction
- Optionally, the `AssetPreviewTool` in devtools mode for placing preview sprites on the map
- The `test_art_sample_viewer.mjs` tool for spritesheet layout validation
- Manual QA in the running game after runtime integration

No asset batch should be merged without visual review by the project owner.

### 10.3 Only approved assets integrated

The `generatedAssetManifest.ts` should only contain assets that have been visually approved. Do not add "placeholder" or "temporary" assets to the manifest — they tend to become permanent. If a direction is uncertain, use the candidate review process (step 1 above) before committing any assets to the repo.

### 10.4 No giant auto-generated asset PR like #120

PR #120 (MAPLIFE decor) attempted to auto-ggenerate a large batch of environment props and integrate them in a single PR. This was visually rejected because the assets did not meet the quality bar. Future asset PRs must be small, focused, and visually reviewed:

- Tile family PR: 6-12 tile PNGs + manifest + renderer integration
- Unit spritesheet PR: 1 unit type x 4 factions (4 spritesheets) + manifest + renderer
- Resource sprites PR: 3-4 resource PNGs + manifest + renderer integration

### 10.5 Asset dimensions and naming conventions

Follow existing conventions from `ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md`:

**Industrial terrain tiles:**
```
public/assets/tiles/
  industrial_clean_256x128.png
  industrial_dark_256x128.png
  industrial_light_256x128.png
  industrial_worn_256x128.png
  industrial_marked_256x128.png
  industrial_cracked_256x128.png
```

**Resource sprites:**
```
public/assets/environment/
  ore_deposit_small.png
  ore_deposit_medium.png
  ore_deposit_large.png
  ore_deposit_infinite.png
```

**Unit spritesheets** (follow ASSET-WORKFLOW-01):
```
public/assets/factions/{faction}/units/
  harvester_8d_4s_256.png
  builder_8d_3s_256.png
```

### 10.6 Chroma/alpha processing rules

All asset PNGs must be:
- 32-bit RGBA (8 bits per channel including alpha)
- Fully transparent background (alpha = 0)
- No solid background color
- No anti-alias fringe / dark halo on edges
- No baked shadow on unit sprites (shadows rendered by engine if needed)

For terrain tiles specifically:
- 256x128 source dimensions (scaled to 76x38 at runtime)
- Seams closed by the 1% overlap factor in `TERRAIN_OVERLAP_FACTOR`
- Edge pixels should blend with neighboring tiles (no hard edges)
- Tint-friendly: base color should be neutral enough that per-tile tint variation produces natural variation

### 10.7 Preview workflow

1. Generate candidate image(s) using any tool
2. Place candidate PNGs in a temporary review directory (not in `public/assets/`)
3. Use `AssetPreviewTool` (press 0 with devtools) to place candidates on the map
4. Take screenshots for review
5. After approval, move assets to `public/assets/` and update the manifest

---

## 11. UI/HUD audit

### 11.1 Current HUD files

| File | Role | Lines of code | UI approach |
|------|------|---------------|-------------|
| `src/phaser/ui/PlaytestHud.ts` | Economy, harvester status, build/produce buttons | ~600 | DOM overlay, right sidebar 228px |
| `src/phaser/ui/PauseMenu.ts` | Pause, save, restart, menu | ~200 | DOM overlay, centered modal |
| `src/phaser/ui/DevtoolsPanel.ts` | Debug controls, spawn, diagnostics | ~500 | DOM overlay, left panel 220px |
| `src/phaser/input/GameInputController.ts` | Selection, movement, hotkeys | ~400 | Phaser pointer + keyboard |

### 11.2 Target HUD layout

```
+---------------------------------------------------+
|                                                     |
|                  GAME VIEWPORT                      |
|                                                     |
|                                                     |
+----------+-------------------+---------------------+
| MINIMAP  | SELECTED UNIT/    | COMMAND/ACTIONS/    |
|          | BUILDING INFO     | PRODUCTION/HOTKEYS  |
+----------+-------------------+---------------------+
```

**Bottom bar height**: Approximately 160-180px (enough for minimap + info + commands)
**Minimap**: Approximately 160x120px in the bottom-left corner
**Selected info panel**: Center section, showing unit/building name, health, status, faction
**Command panel**: Right section, showing available actions/production with hotkey labels

### 11.3 Files/modules likely needing changes

| File | Change type | Scope |
|------|-------------|-------|
| `src/phaser/ui/PlaytestHud.ts` | **Major rewrite** | Replace right sidebar with bottom bar layout |
| New: `src/phaser/ui/MinimapPanel.ts` | **New file** | Minimap component (second camera or Graphics) |
| New: `src/phaser/ui/SelectedInfoPanel.ts` | **New file** | Selected unit/building info display |
| New: `src/phaser/ui/CommandPanel.ts` | **New file** | Command/production buttons with hotkeys |
| `src/phaser/GameScene.ts` | **Minor** | Wire new HUD components |
| `src/state/commandRegistry.ts` | **Minor** | Add hotkey labels to command display |
| `src/phaser/input/GameInputController.ts` | **Minor** | Selection state feeds into SelectedInfoPanel |
| `src/phaser/render/EntityRenderer.ts` | **None** | Selection highlight continues as-is |

### 11.4 Split into small PRs

The HUD redesign should be split into multiple PRs:

1. **VISUAL-07 — HUD layout design doc**: Document the exact layout, component structure, and visual style before implementation. No code changes.
2. **VISUAL-08 — HUD shell implementation**: Create the bottom bar container, placeholder panels, and basic layout. Migrate economy display from PlaytestHud to the new bottom bar. Remove the old right sidebar.
3. **VISUAL-09 — Command panel/hotkey visual pass**: Add the command panel with action buttons and hotkey labels. Wire to command registry. Add production queue display.
4. **Later — Minimap implementation**: Add the minimap component with second camera. Add click-to-scroll. This is a separate task because it requires Phaser camera work.

### 11.5 Visual style

The HUD should use warm industrial sci-fi styling:
- Dark metallic background (near-black with subtle texture)
- Warm bronze/amber accent for active elements
- Faction-colored highlights for selected units
- Industrial-style borders (beveled, metallic)
- Readable fonts at game-appropriate sizes
- No web-demo aesthetics — no rounded corners, no flat-design buttons

---

## 12. Main menu audit

### 12.1 Current menu implementation

The `MainMenuScene` is a pure DOM overlay with:
- Title: "Four Elements" (large text)
- Subtitle: "Phaser Prototype"
- Three buttons: New Game, Continue, Settings
- Version string
- Dark background (`#1a1a2e`)
- Blue accent (`#4fc3f7`)

### 12.2 Plan

- **Keep central panel/button style**: The centered layout with stacked buttons works well for a cinematic menu.
- **Replace background**: Add an industrial world background image or gradient. This should be a Phaser Image or a CSS background on the DOM overlay, showing an industrial landscape, mining platform, or atmospheric industrial scene.
- **Ensure responsive layout**: The menu should work at different screen resolutions. CSS flexbox/centering handles this already.
- **Hover/states/pointer**: Buttons should have clear hover, active, and disabled states. The current CSS transitions provide some of this — they should be enhanced with the warm bronze/industrial theme.
- **No implementation in audit PR**: This section is analysis only.

### 12.3 Files needing changes

| File | Change type |
|------|-------------|
| `src/phaser/MainMenuScene.ts` | Add background image, update button styling |
| New background asset | Industrial world background image |
| `src/phaser/PreloadScene.ts` | Load new background asset |
| CSS/theme constants | Centralize color theme for menu + HUD |

---

## 13. Unit/building visual audit

### 13.1 Harvester and Builder

Harvester and Builder sprites are currently sand/desert-themed civil units with 8-direction walk cycles. They need future visual refresh to match the industrial biome:
- New spritesheets with industrial-themed harvester (mining vehicle, industrial extractor)
- New spritesheets with industrial-themed builder (construction mech, industrial worker)
- Must follow ASSET-WORKFLOW-01 conventions for layout, naming, origin, frame count
- 4 faction variants each (16 total spritesheets if both units + all factions)

**This is deferred to Phase V9 (VISUAL-11/12)** — after the map and terrain direction is established, because regenerating units for one biome and then re-doing them for another would be wasteful.

### 13.2 Existing tank/Wasp combat assets

The existing Wasp hull and Smoky turret 3D-rendered assets should NOT be restyled by default. Combat units are out of scope for the VISUAL roadmap unless a later separate task explicitly decides otherwise. The modular tank rendering model (separate hull + turret images) works well and should be preserved.

### 13.3 Grounding/anchor consistency

All units use origin (0.5, 0.75) for ground contact at 75% from the top of the 256x256 frame. This is documented in ASSET-WORKFLOW-01 and must be preserved for industrial-themed units. Any new unit sprites must have their ground contact point at pixel row 192 in every frame.

### 13.4 Do not include implementation

This audit does not implement any unit visual changes. Implementation is deferred to Phase V9.

---

## 14. Risks

### 14.1 Asset generation quality risk

Industrial platform tiles require convincing metallic/concrete/worn surfaces. If the generated or painted tile assets do not meet the quality bar, the entire visual direction fails. This is the single biggest risk — the VISUAL roadmap depends on good art.

**Mitigation**: Produce 2-3 visual candidates BEFORE runtime integration. Get owner approval on the direction before committing assets. Start with simple, proven approaches (flat colored tiles with baked variation) before attempting complex surface detail.

### 14.2 Over-copying StarCraft risk

StarCraft is the reference for structural principles, not visual copying. If the implementation too closely mimics StarCraft's visual style (e.g., same terrain color palette, same HUD chrome, same unit silhouette), it risks both legal issues and lack of originality.

**Mitigation**: Use StarCraft as a structural reference only (where to place the minimap, how the command panel works, how terrain reads as a surface). The visual style, color palette, asset design, and UI chrome should be original — industrial, warm, the game's own identity.

### 14.3 Map readability risk

Industrial terrain with lots of gray/metal could become visually monotonous, making it hard to distinguish playable areas from background, or resources from terrain. Desert sand has natural warmth and variation; industrial surfaces risk being too uniform.

**Mitigation**: Use strong per-tile tint variation (expand beyond the current +/-2%). Add visual markers (industrial markings, colored zones, lit areas). Ensure resources stand out with distinct colors (glowing ore deposits against gray platforms). Test readability with actual gameplay, not just static screenshots.

### 14.4 UI complexity risk

The HUD redesign (right sidebar to bottom bar) is a significant UI change. It touches the most user-facing part of the game and could introduce usability regressions if not done carefully. Breaking the HUD during migration could make the game unplayable.

**Mitigation**: Split the HUD redesign into multiple small PRs (design doc, shell, command panel, minimap). Each PR should leave the game fully playable. Keep the old PlaytestHud as a fallback option behind a devtools flag until the new HUD is proven.

### 14.5 RenderTexture limitations

The RenderTexture terrain stamp model is efficient but cannot be dynamically lit, animated, or partially updated. If the industrial direction requires animated terrain (e.g., flowing liquids, moving machinery), the current model cannot support it without a renderer rewrite.

**Mitigation**: Accept the static terrain limitation for now. Industrial platforms do not require terrain animation. If animated terrain elements are needed in the future, they can be implemented as separate Sprite overlays on top of the static RenderTexture.

### 14.6 Large PR risk

Each VISUAL phase could easily become a large PR that mixes assets, rendering, state, and UI changes. Large PRs are hard to review, hard to roll back, and block other work.

**Mitigation**: Strict one-PR-per-layer discipline. Asset-only PRs, renderer-only PRs, UI-only PRs. Never mix asset changes with code changes in the same PR. Never mix HUD redesign with terrain changes.

### 14.7 Visual work blocking gameplay risk

If the VISUAL roadmap takes too long, it could block gameplay development (e.g., FOG-01, ARENA-01, combat) because developers are afraid to change code that might be visually reworked soon.

**Mitigation**: The VISUAL roadmap is explicitly visual-only. It does not change gameplay, pathfinding, economy, or state logic. Non-visual gameplay tasks (FOG-01, ARENA-01) can proceed in parallel with VISUAL phases, as long as they do not depend on specific visual implementations.

---

## 15. Recommended PR sequence

### VISUAL-00 — Documentation reset

**Status**: Done (PR #122, merged)

Goal: Archive old roadmap, add VISUAL_ROADMAP.md, update project state docs.

---

### VISUAL-01 — Industrial map visual candidate workflow

**Goal**: Produce 2-3 static visual direction candidates for the industrial map surface. These are image mockups — not runtime integration. One direction must be approved by the project owner before any runtime work begins.

**Scope**:
- Create candidate images showing industrial platform surface directions
- Document each candidate's visual approach, tile structure, color palette
- Provide prompts/instructions for asset generation if AI tools are used
- No runtime code changes, no asset integration, no Phaser changes

**Non-goals**:
- No runtime integration
- No tile family production
- No renderer changes
- No HUD changes

**Likely touched files**: New doc + candidate images in a review directory

**Tests**: None (docs/assets only)

**Manual QA**: Owner review of visual candidates

**Risk level**: Very low

**Dependency**: None (can start immediately)

---

### VISUAL-02 — Map rendering prototype spike

**Goal**: Validate that the RenderTexture stamp model works with industrial tile assets by loading 2-3 candidate tile PNGs into the runtime (behind a devtools flag) and stamping them on a test map. Confirm: no visible seams, tint variation works, camera scrolling works, zoom works.

**Scope**:
- Load candidate industrial tiles via devtools/arena mode
- Stamp them using the existing TerrainRenderer stamp config
- Verify visual quality and technical compatibility
- Do NOT replace the default terrain — only a dev-mode preview

**Non-goals**:
- No production terrain replacement
- No map generation changes
- No new asset families in the production manifest

**Likely touched files**: `PreloadScene.ts` (dev-only tile load), `TerrainRenderer.ts` (dev-only stamp config), `GameScene.ts` (dev flag)

**Tests**: Existing tests pass unchanged. New test: verify industrial tile keys load correctly in dev mode.

**Manual QA**: Visual inspection of industrial tiles on the map

**Risk level**: Low

**Dependency**: VISUAL-01 (approved visual direction)

---

### VISUAL-03 — Industrial terrain/platform integration

**Goal**: Replace sand terrain tile family with approved industrial platform tile family in the production renderer. Update terrain types, map generation variant distribution, and manifest entries.

**Scope**:
- Add industrial tile PNGs to `public/assets/tiles/`
- Update `generatedAssetManifest.ts` terrain family
- Update `TerrainRenderer.ts` asset key mapping and tint logic
- Update `types.ts` TerrainType values
- Update `generatedMap.ts` terrain variant distribution for industrial biome
- Sand assets may remain in repo as fallback (not loaded in production)

**Non-goals**:
- No map frame/background changes
- No HUD changes
- No unit visual changes
- No resource visual changes

**Likely touched files**: `generatedAssetManifest.ts`, `TerrainRenderer.ts`, `types.ts`, `generatedMap.ts`, `assetManifest.ts`, new tile PNGs

**Tests**: Update `terrainClustering.test.ts` for new terrain types. Update `generatedMap.test.ts` for new variant names. Update `mapValidation.test.ts` if terrain type names change.

**Manual QA**: Full visual inspection. Start new game. Verify terrain looks industrial. Verify camera scroll/zoom. Verify economy loop still works.

**Risk level**: Medium — visual change is visible but gameplay is unchanged

**Dependency**: VISUAL-01 (approved direction) + VISUAL-02 (technical validation)

---

### VISUAL-04 — Map frame / grounded presentation

**Goal**: Add non-playable outer visual layer/background. The map should feel placed on a world/surface. Irregular edge visuals break the rectangular diamond boundary.

**Scope**:
- Add background/world surface layer beneath the terrain (depth < 0)
- Extend camera bounds slightly for outer area visibility
- Add edge overlay images at playable area boundaries
- Possibly extend the RenderTexture to stamp tiles beyond the playable grid

**Non-goals**:
- No height gameplay
- No pathfinding changes
- No resource placement changes
- No fog of war interaction

**Likely touched files**: `TerrainRenderer.ts` (extended stamp area), `GameScene.ts` (background layer), `CameraControls.ts` (extended bounds), `isometric.ts` (extended coordinate mapping), new background/edge assets

**Tests**: Existing tests pass. New test: verify background renders at correct depth. Verify camera bounds are correct.

**Manual QA**: Visual inspection. Map should feel grounded, not floating.

**Risk level**: Medium — visual integration between terrain and background

**Dependency**: VISUAL-03 (industrial terrain established)

---

### VISUAL-05 — Lower-left start composition

**Goal**: Move player start/HQ to lower-left start zone. Adjust camera start. Rework starting resource composition.

**Scope**:
- Change default HQ position from (4, 4) to lower-left area
- Update starter resource placement relative to new HQ
- Update camera centering for new position
- Update validation rules
- Update all tests that assert HQ at (4, 4)

**Non-goals**:
- No economy value changes
- No pathfinding changes
- No changes to central infinite deposit position
- No save/load compatibility break (new games only)

**Likely touched files**: `generatedMap.ts`, `GameScene.ts` (camera centering), `generatedMap.test.ts`, `mapValidation.test.ts`, other test files

**Tests**: Extensive — all map generation and validation tests must be updated. New tests for new position validation.

**Manual QA**: Start new game. Verify camera faces lower-left start. Verify resources near HQ. Verify economy loop works.

**Risk level**: Medium — test-heavy but gameplay logic unchanged

**Dependency**: VISUAL-03 (terrain established) + ideally VISUAL-04 (frame gives context)

---

### VISUAL-06 — Resource field visual model design

**Goal**: Design the visual model for industrial-themed resource fields. Produce candidate resource sprites. Document the 1x1 node model, field composition rules, and visual style.

**Scope**:
- Design doc for resource visual model
- Candidate resource sprites (ore deposits on industrial flooring)
- Optionally: preview in devtools mode
- Do NOT replace production resource assets yet

**Non-goals**:
- No resource gameplay changes
- No depletion logic changes
- No production asset integration

**Likely touched files**: New design doc + candidate sprites in review directory

**Tests**: None (design/candidates only)

**Manual QA**: Owner review of resource visual candidates

**Risk level**: Very low

**Dependency**: VISUAL-03 (industrial terrain established so resource style can match)

---

### VISUAL-07 — HUD layout design doc

**Goal**: Document the exact bottom bar layout, component structure, visual style, and interaction model for the new HUD. This is a design document, not code.

**Scope**:
- Layout specification with pixel dimensions
- Component breakdown (minimap, info panel, command panel)
- Visual style guide (colors, borders, fonts, hover states)
- Interaction specification (click, hover, hotkey display)
- Migration plan from PlaytestHud

**Non-goals**:
- No code implementation
- No Phaser changes
- No DOM changes

**Likely touched files**: New design doc

**Tests**: None

**Manual QA**: Owner review of design doc

**Risk level**: Very low

**Dependency**: None (can start in parallel with other VISUAL phases)

---

### VISUAL-08 — HUD shell implementation

**Goal**: Create the bottom bar container with placeholder panels. Migrate the economy display from PlaytestHud to the new bottom bar. Remove the old right sidebar.

**Scope**:
- Create `MinimapPanel.ts` (placeholder rectangle)
- Create `SelectedInfoPanel.ts` (economy + selected unit name)
- Create `CommandPanel.ts` (build/produce buttons migrated from PlaytestHud)
- Update `GameScene.ts` to wire new HUD components
- Remove old `PlaytestHud.ts` right sidebar
- Apply warm industrial sci-fi visual styling

**Non-goals**:
- No minimap camera implementation (placeholder only)
- No command panel redesign (migrate existing buttons)
- No new interaction patterns

**Likely touched files**: New `MinimapPanel.ts`, `SelectedInfoPanel.ts`, `CommandPanel.ts`, `GameScene.ts`, remove `PlaytestHud.ts` (or keep as devtools fallback)

**Tests**: Existing HUD tests updated. New tests for new component creation.

**Manual QA**: Game must be fully playable with new HUD. All build/produce/cancel actions must work.

**Risk level**: Medium — UI migration is user-facing and must not break gameplay

**Dependency**: VISUAL-07 (approved design doc)

---

### VISUAL-09 — Command panel/hotkey visual pass

**Goal**: Enhance the command panel with proper hotkey labels, visual feedback, production queue display, and context-sensitive layout. Wire to command registry for hotkey display.

**Scope**:
- Add hotkey labels to all command buttons
- Add production queue visual (progress bars, cancel)
- Add selected unit info display (name, status, faction)
- Improve hover/active/disabled button states
- Add warm industrial visual polish

**Non-goals**:
- No new commands or gameplay features
- No minimap implementation
- No new hotkeys beyond existing command registry

**Likely touched files**: `CommandPanel.ts`, `SelectedInfoPanel.ts`, `commandRegistry.ts` (hotkey display data)

**Tests**: Command registry tests unchanged. New tests for UI component rendering.

**Manual QA**: Verify all hotkeys work. Verify production queue display. Verify selected unit info.

**Risk level**: Low-medium — visual enhancement, no gameplay logic changes

**Dependency**: VISUAL-08 (HUD shell in place)

---

### VISUAL-10 — Main menu visual refresh

**Goal**: Replace main menu dark solid background with an industrial world background. Update button styling to warm bronze/industrial theme. Preserve central composition.

**Scope**:
- Add industrial background image/gradient to MainMenuScene
- Update button colors and hover states to warm bronze/amber
- Update loading screen styling for consistency
- Verify menu flow still works (Standard/Debug/Arena)

**Non-goals**:
- No menu layout redesign
- No new menu screens
- No menu flow changes

**Likely touched files**: `MainMenuScene.ts`, `PreloadScene.ts` (background asset load), `NewGameSetupScene.ts` (consistent styling), new background asset

**Tests**: Existing smoke tests. Manual verification of all menu flows.

**Manual QA**: Verify menu looks industrial and polished. Verify all mode selections work.

**Risk level**: Low — visual-only change to menu scenes

**Dependency**: VISUAL-03 (industrial direction established for background reference)

---

### VISUAL-11 — Harvester/builder visual workflow design

**Goal**: Design the visual workflow for regenerating harvester and builder spritesheets in the industrial biome style. Produce candidate sprites. Document the production pipeline.

**Scope**:
- Design doc for industrial unit visual direction
- Candidate spritesheet(s) for review
- Integration plan with ASSET-WORKFLOW-01 conventions
- Do NOT replace production spritesheets

**Non-goals**:
- No production spritesheet integration
- No renderer changes
- No gameplay changes

**Likely touched files**: Design doc + candidate sprites

**Tests**: None

**Manual QA**: Owner review of unit visual candidates

**Risk level**: Very low

**Dependency**: VISUAL-03 (industrial biome established)

---

### VISUAL-12 — Approved unit visual integration

**Goal**: Replace production harvester and builder spritesheets with approved industrial-themed versions. Update manifest, render config, animation registrations.

**Scope**:
- Replace spritesheet PNGs for all 4 factions
- Update `generatedAssetManifest.ts` paths
- Update `unitRenderConfig.ts` render scales if needed
- Verify Animation Manager registration still works
- Verify ground contact / anchoring with new art

**Non-goals**:
- No combat unit restyling
- No gameplay changes
- No new animation states

**Likely touched files**: `generatedAssetManifest.ts`, `unitRenderConfig.ts`, new spritesheet PNGs

**Tests**: Existing unit tests unchanged. Verify animation playback. Verify anchoring.

**Manual QA**: Visual inspection of all 4 faction units. Verify walk cycle, idle, gather, unload, build animations.

**Risk level**: Medium — asset replacement affects all faction visuals

**Dependency**: VISUAL-11 (approved unit visual direction)

---

## 16. First implementation task prompt

```
Task:
VISUAL-01 — Industrial map visual candidate workflow

Mode:
DOCS / ASSETS ONLY.

Active repo:
ratoker-jpg/four-elements-phaser

Prerequisite:
VISUAL-SYSTEM-AUDIT-01 must be merged into main.
If docs/project/VISUAL_SYSTEM_AUDIT.md is missing, stop and report.

Goal:
Produce 2-3 static visual direction candidates for the industrial map
surface. These are image mockups or concept descriptions — not runtime
integration. One direction must be approved by the project owner before
any runtime work begins.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/VISUAL_ROADMAP.md
- docs/project/VISUAL_SYSTEM_AUDIT.md
- docs/project/PROJECT_STATE.md

Scope:
1. Create a directory: docs/project/visual-candidates/
2. For each candidate direction (2-3 total), produce:
   a. A description document explaining the visual approach:
      - surface material (concrete, metal, composite)
      - color palette (primary, accent, variation range)
      - tile structure (how tiles relate to form a continuous surface)
      - edge treatment (how the platform boundary looks)
      - resource integration (how ore deposits sit on the surface)
   b. If possible, produce a candidate tile image (256x128 PNG) showing
      what one tile would look like. This can be generated by AI,
      painted manually, or composited from reference material.
   c. If possible, produce a composite mockup showing 4-9 tiles arranged
      in an isometric diamond pattern to show how the surface reads as
      a whole.
3. Create docs/project/VISUAL_CANDIDATE_SUMMARY.md that:
   - Lists each candidate with a brief description
   - Recommends one candidate for the project owner's review
   - Notes any open questions about the direction

Hard rules:
- Do not modify runtime code.
- Do not add assets to public/assets/.
- Do not change the Phaser renderer.
- Do not start VISUAL-02 or any implementation.
- Do not generate more than 5 candidate tile PNGs total.

Output:
- docs/project/visual-candidates/candidate-A.md (description + tile image)
- docs/project/visual-candidates/candidate-B.md (description + tile image)
- docs/project/visual-candidates/candidate-C.md (optional, if needed)
- docs/project/VISUAL_CANDIDATE_SUMMARY.md

Validation:
- npm test (must pass — no code changes)
- npm run typecheck (must pass — no code changes)
- npm run build (must pass — no code changes)

PR:
Create branch: visual-01-visual-candidates
Open PR into main.
Do not merge.

PR body must include:
- Goal
- Candidates produced
- Recommended direction
- Confirmation: no runtime/assets/gameplay changes
```

---

## 17. Acceptance criteria

This audit is accepted only if it gives a clear staged path and does not recommend one giant visual rewrite. Specifically:

- [ ] The audit provides a concrete PR sequence (VISUAL-01 through VISUAL-12)
- [ ] Each PR has defined scope, non-goals, and risk level
- [ ] The recommended map approach is staged (candidates → spike → integration → frame → start position)
- [ ] The HUD redesign is split into multiple PRs (design doc → shell → command panel)
- [ ] No single PR exceeds "medium" risk level
- [ ] The audit does NOT recommend building a full StarCraft terrain system
- [ ] The audit does NOT recommend one giant visual rewrite
- [ ] The first next task (VISUAL-01) is a docs/assets-only task that produces no runtime changes
- [ ] Non-visual gameplay tasks (FOG-01, ARENA-01) can proceed in parallel

---

## No runtime code changes

This audit document makes zero changes to runtime code. The following were NOT modified:

- `src/phaser/GameScene.ts` — no changes
- `src/phaser/PreloadScene.ts` — no changes
- `src/phaser/MainMenuScene.ts` — no changes
- `src/phaser/render/TerrainRenderer.ts` — no changes
- `src/phaser/render/EntityRenderer.ts` — no changes
- `src/phaser/render/isometric.ts` — no changes
- `src/state/generatedMap.ts` — no changes
- `src/state/types.ts` — no changes
- `src/assets/assetManifest.ts` — no changes
- `src/assets/generatedAssetManifest.ts` — no changes
- `src/assets/runtimeGeneratedAssets.ts` — no changes
- Any PNG files — none created or modified
- `package.json` — no changes

The only artifact of this task is this document:
`docs/project/VISUAL_SYSTEM_AUDIT.md`

---

## Source references

| Source | Purpose |
|--------|---------|
| `docs/project/VISUAL_ROADMAP.md` | Accepted visual direction |
| `docs/project/PROJECT_STATE.md` | Current operational state |
| `docs/project/CURRENT_NEXT_STEP.md` | Current next step |
| `docs/project/PHASER4_GPU_01_SPIKE_REPORT.md` | GPU layer findings (RenderTexture, depth model) |
| `docs/project/VISUAL_SPIKE_01_NORMAL_MAPS_LIGHTING_FEASIBILITY.md` | Lighting/normal map findings |
| `docs/project/WEAPON_WORKFLOW_01_VFX_RECOIL_DESIGN.md` | Weapon VFX design reference |
| `docs/project/ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md` | Asset pipeline conventions |
| `docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md` | Phaser 4 API surface audit |
| `src/phaser/render/TerrainRenderer.ts` | Current terrain rendering model |
| `src/phaser/render/EntityRenderer.ts` | Current entity rendering model |
| `src/phaser/render/isometric.ts` | Isometric coordinate system |
| `src/state/generatedMap.ts` | Map generation logic |
| `src/state/types.ts` | Type definitions |
| `src/assets/generatedAssetManifest.ts` | Asset manifest |
| `src/phaser/ui/PlaytestHud.ts` | Current HUD structure |
| `src/phaser/MainMenuScene.ts` | Current menu structure |
