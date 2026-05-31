# VISUAL-05A — Production Industrial Map Integration Plan

Status: **Audit/design document — docs only, no runtime changes**
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-05-31

---

## 1. Current production map state

### 1.1 Current terrain renderer

The production terrain is rendered by `TerrainRenderer` (`src/phaser/render/TerrainRenderer.ts`) using a `Phaser.GameObjects.RenderTexture` stamp model. During `GameScene.create()`, every tile in the map is stamped once onto a single RenderTexture. The camera scrolls over this static texture at zero per-frame cost.

Key rendering constants:

| Constant | Value | Source |
|----------|-------|--------|
| Source tile W | 256 px | `TERRAIN_SOURCE_W` |
| Source tile H | 128 px | `TERRAIN_SOURCE_H` |
| Runtime tile W | 76 px | `TILE_W` in `worldConfig.ts` |
| Runtime tile H | 38 px | `TILE_H` in `worldConfig.ts` |
| Scale factor | 76/256 × 1.01 ≈ 0.2998 | `TERRAIN_OVERLAP_FACTOR = 1.01` |
| Origin | (0.5, 0.5) | centered on diamond |

The stamp config maps six `TerrainType` values (all sand variants: `sand`, `sand-dark`, `sand-light`, `sand-ripple`, `sand-pebble`, `sand-cracked`) to asset keys in `TERRAIN_KEY_MAP`. Per-tile tint variation is computed deterministically via `computeTerrainTint(tx, ty, terrainType)`, producing approximately ±2% variation to break visual repetition.

The RenderTexture size is computed from the four corner tiles' screen positions plus 64 px padding on each side. Camera bounds are derived from `terrainRenderer.getBounds()`, returning a `Phaser.Geom.Rectangle` that limits scrolling to the terrain area.

**Key files/functions:**

- `src/phaser/render/TerrainRenderer.ts` — constructor, `stampTerrainTiles()`, `getBounds()`, `getOffset()`
- `src/phaser/render/isometric.ts` — `tileToScreen()`, `mapOriginOffset()`
- `src/config/worldConfig.ts` — `TILE_W`, `TILE_H`, legacy `MAP_W`/`MAP_H`

### 1.2 Current map sizes/options

Map size selection is presented in `NewGameSetupScene` via three radio buttons (Small / Standard / Large). The actual dimensions are defined in `generatedMap.ts`:

| Size label | `MapSizeOption` | Dimensions | Total tiles |
|------------|-----------------|------------|-------------|
| Small | `'small'` | 32×32 | 1,024 |
| Standard | `'standard'` | 48×48 | 2,304 |
| Large | `'large'` | 64×64 | 4,096 |

A fixed custom map (`customMap1.ts`) also exists at 48×48 with hand-placed resources. Arena mode uses a 20×20 sandbox.

**Key files/functions:**

- `src/state/generatedMap.ts` — `MAP_SIZE_DIMENSIONS`, `mapSizeToDimensions()`
- `src/state/gameSetup.ts` — `MAP_SIZE_OPTIONS`, `DEFAULT_SETUP`, `getMapDataFromConfig()`
- `src/data/maps/customMap1.ts` — fixed 48×48 map
- `src/phaser/NewGameSetupScene.ts` — size option UI

### 1.3 Current HQ/start placement

The HQ is always placed at tile (4, 4) — top-left of a 3×3 footprint occupying tiles (4,4) through (6,6). This is defined by `HQ_OFFSET_TX = 4` and `HQ_OFFSET_TY = 4` in `generatedMap.ts`. The builder starts idle at fractional position (3, 3). The HQ area is marked as occupied with a 1-tile margin (5×5 total blocked zone).

For the fixed custom map, HQ is also at (4, 4) with a builder at (3, 3).

**Key files/functions:**

- `src/state/generatedMap.ts` — `HQ_OFFSET_TX`, `HQ_OFFSET_TY`, HQ/builders/resource placement
- `src/state/createInitialState.ts` — HQ center position, harvester spawn around HQ

### 1.4 Current resource placement

Starter resources are placed in a deterministic pattern relative to the HQ position:

- **6 medium resources**: offset (5–7, 4–6) from HQ top-left — southeast of the base
- **6 small resources**: offset (4–8, 4–7) from HQ top-left — southeast of the base
- **3–5 near-HQ ring resources**: at distance 10–18 from HQ center
- **Central infinite deposit**: at `(⌊W/2⌋ - 1, ⌊H/2⌋ - 1)` with a 3×3 footprint — always near the map center
- **Mid/far clusters**: count proportional to map area (`≈ W×H/350`), each with 2–5 resources

Resource visuals use three mineral crystal sprites (`mineral_small`, `mineral_medium`, `mineral_large`) in sand/desert tones. Infinite deposits use the large asset at increased scale.

**Key files/functions:**

- `src/state/generatedMap.ts` — resource placement logic (L400–496)
- `src/state/types.ts` — `ResourceType`, `TerrainType`

### 1.5 Current camera start

In `GameScene.create()`, the camera centers on the HQ footprint center tile:

```
hqCenterTx = hq.tx + 1   // 5 (center of 3×3 footprint)
hqCenterTy = hq.ty + 1   // 5
hqScreen   = tileToScreen(hqCenterTx, hqCenterTy)
hqWorldX   = hqScreen.x + mapOriginOffset.x
hqWorldY   = hqScreen.y + mapOriginOffset.y
camera.centerOn(hqWorldX, hqWorldY)
```

The `R` key resets the camera to this same HQ world position. Camera bounds are set from `terrainRenderer.getBounds()`.

**Key files/functions:**

- `src/phaser/GameScene.ts` — camera centering (L226–232)
- `src/phaser/input/CameraControls.ts` — `centerOn()`, `resetTo()`, `setBounds()`

---

## 2. Approved visual direction from ?visual04a

The `?visual04a` dev prototype (implemented in VISUAL-03A through VISUAL-04F) has established the approved MVP visual direction for the production map. Key components:

### 2.1 Industrial platform tiles

Eight balanced platform tile assets (`platform_tile_001.png` through `platform_tile_010.png`) with weighted random placement via `WeightedTilePicker`. Tiles are rendered as individual `Phaser.GameObjects.Image` objects within a masked container, providing a varied but coherent industrial surface. Deterministic variation via `hashColRow(col, row)` — no `Math.random` in rendering.

### 2.2 PNG frame top block

A single `frame_top_block.png` (384×348 canvas, 368×184 diamond) replaces procedural top surfaces for frame border pieces. Each frame piece gets one image, positioned using the measured diamond geometry (center Y = 120 px, origin Y = 120/348 ≈ 0.3448). Scale = `runtimeTileW / 368`. Toggled by **P** key.

### 2.3 PNG wall face block

A single `frame_wall_face_block_left.png` (384×288 canvas) replaces procedural wall faces. The visible polygon within the canvas has vertices at TL(96,40), TR(288,136), BR(288,248), BL(96,152). Anchor origin is (96/384, 40/288) = (0.25, 0.1389). Scale = `runtimeTileW / 384`.

Left walls are drawn normally with a dark tint (`0x777788`, shadow side). Right walls use `setScale(-scale, scale)` for horizontal mirroring with no tint (`0xffffff`, lit side — original PNG brightness). Only outer-facing edges receive wall images (determined by `getEdgeInfo()`), preventing black vertical fins on the top/far edges. Toggled by **W** key.

### 2.4 Background/world layer

An optional background world image (`background_world_candidate_01.png`) rendered at depth 0 beneath all other layers. Scales to fill the camera viewport. Falls back to a procedural dark fill if the image fails to load.

### 2.5 Modular grid-aligned frame model

The frame is built from the same grid coordinate system as platform tiles. Frame pieces are 1-tile-wide border cells around the playable area, with corner pieces at the four cardinal vertices of the outer diamond. The `getEdgeInfo()` function determines which diamond edges face inward vs outward for each piece, enabling correct wall placement.

Key constants: `GRID_N = 9` (platform), `FRAME_BORDER = 1`, `ARENA_N = 11` (platform + border).

---

## 3. Target production map model

### 3.1 Playable sizes and outer arena sizes

The 11×11 arena in `?visual04a` is a dev-preview only. Production maps must be much larger. The approved target sizes are:

| Size label | Playable grid | Outer arena (playable + 1 border) | Playable tiles | Outer tiles |
|------------|--------------|-----------------------------------|----------------|-------------|
| Small | 96×96 | 98×98 | 9,216 | 9,604 |
| Medium | 128×128 | 130×130 | 16,384 | 16,900 |
| Large | 192×192 | 194×194 | 36,864 | 37,636 |

The 1-tile frame border adds visual context (frame top + wall faces) around the playable area. This is purely visual — pathfinding and occupancy remain within the 96/128/192 playable grid.

### 3.2 Lower-left start zone

The HQ should move from the current upper-left (4, 4) to a lower-left position. For each map size:

| Map size | Playable | Approximate HQ position | HQ center |
|----------|----------|------------------------|-----------|
| Small | 96×96 | (4, 89) | (5, 90) |
| Medium | 128×128 | (4, 121) | (5, 122) |
| Large | 192×192 | (4, 185) | (5, 186) |

The HQ x-offset stays at 4 (near left edge). The y-offset places the HQ in the lower portion of the map, leaving the upper/right area for expansion and enemy territory. The exact position should be validated during implementation to ensure clear tiles and reachable resources.

### 3.3 Frame around playable area

The production frame applies the same modular grid-aligned model from `?visual04a`, extended to 96/128/192 borders:

- Each frame piece = one isometric diamond cell on the border ring
- Frame top surfaces rendered with `frame_top_block.png`
- Frame wall faces rendered with `frame_wall_face_block_left.png` (mirrored for right side)
- Wall placement filtered by `getEdgeInfo()` to only outer-facing edges
- Corner pieces at the 4 cardinal vertices get taller walls (as in the prototype)

### 3.4 Background/outer world under map

A background layer (image or extended terrain) renders beneath the arena at depth 0. This provides the "grounded on a surface" feeling. The outer world extends beyond the frame, visible when the player scrolls near edges.

Options for production (in order of preference):

1. **Single background image** — simplest, proven in the prototype. Scale to cover the arena area plus scroll margin.
2. **Extended terrain stamp** — stamp simpler/darker tiles beyond the playable grid. More tile-aligned but requires larger RenderTexture.
3. **Parallax background** — more immersive but adds complexity. Deferred.

### 3.5 Keep logical map as grid

The logical map remains a simple 2D grid with isometric 2:1 projection. The visual frame is a separate rendering layer — it does not change pathfinding, occupancy, or the coordinate system. The `tileToScreen()` / `screenToTile()` conversion stays unchanged. The frame border exists only in the rendering layer, not in the game state.

---

## 4. Risks

### 4.1 Performance for 96/128/192

The current 48×48 map stamps 2,304 tiles onto a RenderTexture — fast, one-time cost. A 192×192 map would stamp 36,864 tiles plus ~2,800 frame pieces. Key concerns:

- **RenderTexture size**: A 192×192 isometric map at 76×38 tiles requires a RenderTexture of approximately 29,000 × 14,500 px — far exceeding WebGL texture limits (typically 4096–16384 px). The current `TerrainRenderer` must be restructured for large maps.
- **Individual Image objects**: The `?visual04a` prototype creates individual `Image` objects for each tile/frame piece. At 192×192, this would be ~40,000 Phaser GameObjects — too many for per-frame depth sorting.
- **Frame images**: A 192×192 map has ~768 outer border pieces, each needing 1–2 images (top + wall). That's ~1,500 frame images — manageable individually but must be at correct depth.

**Mitigation**: Use the RenderTexture stamp model for platform tiles (one-time, zero per-frame cost). Frame pieces can be rendered onto a second RenderTexture or as a limited set of individual Images (the frame border is always behind entities, so depth sorting is simpler). The VISUAL-04F prototype already proved the concept; the challenge is scaling it.

### 4.2 RenderTexture stamping vs individual images

The production approach must decide between:

- **RenderTexture for platform tiles**: Stamp all tiles once, scroll the camera. Proven, performant, zero per-frame cost. Must handle texture size limits for large maps — likely requires chunked rendering (multiple RenderTextures) or a different tile-to-screen mapping for large maps.
- **Individual Images for frame pieces**: The frame border has ~768 pieces (small map) to ~1,536 pieces (large map), each with 1–2 images. These are all at the same depth (behind entities) and don't need per-frame sorting. Feasible.
- **Hybrid**: RenderTexture for tiles + individual Images for frame. This matches the prototype approach and is the recommended strategy.

**Risk**: If RenderTexture exceeds max texture size for large maps, chunking adds implementation complexity. Alternative: use camera culling to only render visible tiles per frame (dropping the RenderTexture model). This trades one-time stamp cost for per-frame rendering cost but eliminates texture size limits.

### 4.3 Camera bounds

Current camera bounds come from `terrainRenderer.getBounds()`. With the frame and background layer, bounds must be extended to show the outer world surface. The player should be able to scroll slightly beyond the frame border to see the background/world context, but not so far that the map leaves the viewport entirely.

**Mitigation**: Extend camera bounds by 2–3 tile widths beyond the frame outer edge. The frame should remain visible even at the maximum scroll extent.

### 4.4 Save/load compatibility

Moving HQ from (4,4) to lower-left and changing map sizes breaks save compatibility. Existing saves reference HQ at (4,4) with 48×48 maps. The new maps will have different dimensions and HQ positions.

**Mitigation**: Add a map version field to save data. When loading old saves, detect the version and either (a) refuse to load with a clear error message, or (b) attempt migration (risky). The simplest safe approach: old saves are incompatible with the new map model. This is acceptable for a pre-release prototype.

### 4.5 Pathfinding/occupancy

The pathfinding and occupancy systems operate on the logical grid (`mapWidth × mapHeight`). The visual frame border does NOT change the logical grid. Pathfinding remains within the playable area (96/128/192). No changes to `findPath()`, occupancy checks, or movement validation are needed.

**Risk**: If the frame border is accidentally included in the logical grid, pathfinding will attempt to route through non-playable cells. This must not happen — the frame is visual only.

### 4.6 Resource placement

Moving HQ to lower-left changes the relationship between starter resources and the central infinite deposit. Currently, starter resources are SE of HQ (near the map center). With HQ in the lower-left, the central deposit will be far from the start, requiring longer initial expansion.

**Mitigation**: Starter resources should be placed in the expansion direction (north/east of HQ), not toward the map corner. The central infinite deposit remains at the map center. Near-HQ ring resources should be placed toward the center of the map. This is visual/composition work first, not economy rebalance — resource counts and values stay the same.

### 4.7 Building placement near edges

With HQ at (4, mapH-7), buildings placed near the lower or left edge of the map may visually overlap the frame border. The current building placement validation checks tile occupancy within the playable grid — it does not check proximity to the frame border.

**Mitigation**: The frame border is 1 tile wide. Buildings near the edge will appear to sit on the frame top surface, which is visually acceptable — the frame IS the edge of the platform. No placement restrictions needed for visual reasons.

### 4.8 Minimap (future)

A minimap component is planned for VISUAL-07/08. The production map with frame border must be minimap-compatible. The minimap should show the playable area (not the frame) as the active zone, with the frame rendered as a thin border.

**Risk**: Low. The minimap can use a second camera with a fixed zoom level. The frame border will naturally appear as a border in the minimap view.

---

## 5. Proposed PR sequence

### PR 1 — Parameterize dev preview to 96/128/192 and camera pan/zoom

**Task ID**: `VISUAL-05A-PR1`

**Goal**: Extend the `?visual04a` dev preview to support larger map sizes (96/128/192) with camera pan/zoom, proving that the visual model scales.

**Scope**:
- Add map size selection to the `?visual04a` preview (similar to NewGameSetupScene)
- Parameterize `GRID_N` and `ARENA_N` based on selected size
- Implement camera pan/zoom for navigating the larger map
- Verify RenderTexture size limits for each map size
- If RenderTexture exceeds max size, implement chunked rendering or camera culling as a fallback
- Keep this in the dev preview only — no production changes

**Out of scope**: Production terrain, HQ placement, resources, save/load, gameplay.

**Stop condition**: If FPS drops below 30 on 96×96, or if RenderTexture cannot be made to work for 192×192 within reasonable effort.

---

### PR 2 — Production terrain/platform assets behind feature flag or mapStyle

**Task ID**: `VISUAL-05A-PR2`

**Goal**: Replace sand terrain with industrial platform tiles in the production renderer, gated behind a `mapStyle` configuration or feature flag.

**Scope**:
- Add `mapStyle: 'industrial' | 'sand'` to game setup config
- When `mapStyle === 'industrial'`:
  - Load industrial platform tile assets instead of sand tiles
  - Update `TerrainRenderer` (or create `IndustrialTerrainRenderer`) to stamp industrial tiles
  - Use industrial tile variant distribution (from the `?visual04a` WeightedTilePicker)
  - Update `TerrainType` enum to include industrial variants
- When `mapStyle === 'sand'`: existing behavior unchanged
- Update `NewGameSetupScene` to offer map style selection
- Default to `'sand'` for new games (keep current behavior; PR 5 switches default to industrial after QA)

**Out of scope**: Frame border, background layer, HQ position, resources.

**Stop condition**: If industrial terrain rendering breaks pathfinding, occupancy, or camera system.

---

### PR 3 — Production frame/background layer

**Task ID**: `VISUAL-05A-PR3`

**Goal**: Add the visual frame border and background/world layer to the production renderer.

**Scope**:
- Extend the production renderer to include a 1-tile frame border around the playable area
- Render frame top surfaces using `frame_top_block.png`
- Render frame wall faces using `frame_wall_face_block_left.png` with mirroring and tint
- Filter wall placement to outer-facing edges only (using `getEdgeInfo()`)
- Add background/world image layer beneath the arena at depth 0
- Extend camera bounds to show the frame and a small outer margin
- The frame is visual only — does not affect pathfinding, occupancy, or game state

**Out of scope**: HQ position, resources, map sizes.

**Stop condition**: If frame rendering causes FPS drop below 30 on any map size.

---

### PR 4 — Lower-left HQ/camera/resource composition

**Task ID**: `VISUAL-05A-PR4`

**Goal**: Move HQ to lower-left, adjust camera start, and rework starter resource placement.

**Scope**:
- Change `HQ_OFFSET_TX` and `HQ_OFFSET_TY` in `generatedMap.ts` to place HQ in lower-left
- Make HQ position relative to map size: `(4, mapHeight - 7)` for all sizes
- Update starter resource placement to be relative to new HQ position
  - Resources should be placed toward the map center (north/east), not toward the corner
- Update camera centering in `GameScene.create()` — already automatic (centers on HQ)
- Update `customMap1.ts` to match new HQ position
- Update all tests that assert HQ at (4, 4)
- Add new tests verifying: resources near new HQ, no blocked start, camera starts on HQ

**Out of scope**: Economy values, resource amounts, gameplay mechanics.

**Stop condition**: If HQ/resources spawn on blocked tiles, or if camera starts off-screen.

---

### PR 5 — Make industrial map default for new games after QA

**Task ID**: `VISUAL-05A-PR5`

**Goal**: Switch the default map style from sand to industrial for all new games.

**Scope**:
- Change `DEFAULT_SETUP.mapStyle` from `'sand'` to `'industrial'`
- Remove sand option from `NewGameSetupScene` (or keep as legacy option)
- Update `DEFAULT_SETUP.mapSize` to `'small'` (96×96) as the new default
- Full manual QA across all map sizes
- Verify save/load compatibility (old saves should fail gracefully)

**Out of scope**: Removing sand code/assets — they remain as fallback.

**Stop condition**: If any game system breaks with industrial as default.

---

## 6. Stop conditions

The following conditions require stopping and re-evaluating before continuing:

| Condition | Impact | Action |
|-----------|--------|--------|
| FPS drops below 30 on 96×96 | Unplayable | Investigate RenderTexture chunking or camera culling |
| Pathfinding breaks | Game broken | Verify frame border is not in logical grid |
| HQ/resources spawn blocked | Game broken | Fix placement validation for new HQ position |
| Camera bounds broken | Cannot navigate | Fix bounds calculation for new map sizes + frame |
| Save/load broken | Lost progress | Add version field, implement graceful migration |
| New map unreadable at gameplay zoom | Unplayable | Verify tile/frame readability at standard zoom levels |
| RenderTexture exceeds max size on large maps | Cannot render 192×192 | Implement chunked rendering or per-frame camera culling |
| Visual frame overlaps entities incorrectly | Visual broken | Verify depth layering: background < frame < tiles < entities |

---

## 7. Manual QA plan

### 7.1 Small map (96×96)

- [ ] Start a new game with small map size
- [ ] Verify the map renders correctly with industrial tiles
- [ ] Verify frame border appears around the playable area
- [ ] Verify background/world layer is visible beyond the frame
- [ ] Verify no black vertical fins on the top/far edge
- [ ] Verify left walls appear darker (shadow side) than right walls (lit side)
- [ ] Verify FPS stays above 30 during normal gameplay
- [ ] Scroll to all four corners — verify camera bounds are correct
- [ ] Zoom in/out — verify rendering is correct at all zoom levels

### 7.2 Medium map (128×128)

- [ ] All small map checks above
- [ ] Verify no performance degradation compared to small map
- [ ] Scroll across the full map — verify no rendering gaps or artifacts

### 7.3 Large map (192×192)

- [ ] All small map checks above
- [ ] Verify FPS stays above 30 during normal gameplay
- [ ] Verify RenderTexture or rendering approach handles the larger map
- [ ] Verify no memory issues or browser crashes

### 7.4 New Game starts

- [ ] Start a new game — verify it uses industrial map by default
- [ ] Verify HQ is visible in the lower-left area of the map
- [ ] Verify camera centers on HQ at game start
- [ ] Press R — verify camera resets to HQ

### 7.5 HQ visible in lower-left

- [ ] Verify HQ appears at the correct lower-left position
- [ ] Verify HQ is not at the map edge (should have 1–2 tiles of space from the border)
- [ ] Verify the HQ building renders correctly on the industrial surface

### 7.6 Builder/harvester spawn correctly

- [ ] Verify builder spawns near HQ at the correct position
- [ ] Verify harvesters spawn near HQ
- [ ] Verify all units can move immediately after spawn
- [ ] Verify units are not stuck on occupied tiles

### 7.7 Resources reachable

- [ ] Verify starter resources are visible and reachable from HQ
- [ ] Verify harvesters can path to and harvest starter resources
- [ ] Verify central infinite deposit is present near the map center
- [ ] Verify mid/far resource clusters are reachable via pathfinding

### 7.8 Camera starts on base

- [ ] Verify camera is centered on HQ at game start
- [ ] Verify the initial view shows HQ, builder, and starter resources
- [ ] Verify scrolling works smoothly in all directions
- [ ] Verify camera bounds prevent scrolling beyond the map + frame

### 7.9 Units move

- [ ] Select a harvester and right-click a resource — verify it moves there
- [ ] Select a builder and right-click a build location — verify it moves there
- [ ] Verify units path correctly around the map
- [ ] Verify units do not attempt to move into the frame border area

### 7.10 Buildings can be placed

- [ ] Place a building near HQ — verify it renders correctly
- [ ] Place a building near the map edge — verify it does not overlap the frame incorrectly
- [ ] Place a building on a starter resource — verify placement rules work
- [ ] Verify building anchoring/grounding works on the industrial surface

### 7.11 Save/load still works

- [ ] Save a game with the industrial map — verify save succeeds
- [ ] Load the saved game — verify it restores correctly
- [ ] Verify old saves (if any) fail gracefully with a clear error message
- [ ] Verify the map state (tiles, resources, buildings) is preserved after load
