# PHASER4-GPU-01 — SpriteGPULayer / TilemapGPULayer Spike Report

Status: spike report  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Phaser version: 4.1.0  
Reference repo: `ratoker-jpg/four-elements-next` (donor/reference only)  
Date: 2026-05-28  

---

## 1. Executive Summary

This spike investigates whether Phaser 4.1.0's `SpriteGPULayer` and `TilemapGPULayer` APIs can simplify or improve the current renderer architecture for the Four Elements isometric RTS project.

**Key findings:**

- Both `SpriteGPULayer` and `TilemapGPULayer` exist in Phaser 4.1.0 as stable, non-experimental APIs with full TypeScript type definitions.
- `TilemapGPULayer` supports **orthographic tilemaps only** — it does not support isometric or hexagonal tile layouts. Our terrain uses a custom isometric 2:1 projection via `tileToScreen()`, making `TilemapGPULayer` **incompatible** with the current terrain rendering approach.
- `SpriteGPULayer` does **not support per-member depth/z-sorting**. Members render in buffer insertion order. Our isometric rendering requires painter's-algorithm depth ordering (`depth = 100 + worldY`), making `SpriteGPULayer` **incompatible** with any depth-sorted entity layer.
- `SpriteGPULayer` is limited to a **single texture** per layer instance. Our entities use different textures (HQ image, harvester spritesheet, resource image, building images), requiring multiple layer instances and careful orchestration.
- `SpriteGPULayer` supports GPU-driven animation (easing + frame cycling), which is technically interesting but our current Animation Manager usage is working well for 8-16 sprites.
- The current rendering model (RenderTexture for terrain, individual Sprites/Images for entities) is performant at current scale (48x48 map, ~8 civil units, ~10 buildings). GPU layers would not provide measurable benefit at this sprite count.

**Recommendation:** PHASER4-GPU-02 should be **no-op / docs-only for now**. GPU layers should be reconsidered only when sprite counts grow significantly (50+ dynamic entities) or when the game adopts orthographic terrain that could use TilemapGPULayer. The current renderer architecture is well-suited to the Sandbox MVP scale.

---

## 2. Repo/Version Confirmation

| Check | Result |
|-------|--------|
| Active repo | `ratoker-jkg/four-elements-phaser` |
| `package.json` phaser version | `"phaser": "4.1.0"` |
| PR #91 (PHASER4-LOAD-02) merged to main | Yes (commit `f3e5796`) |
| Source-of-truth audit | `docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md` |
| Framework | Vite + TypeScript, standalone (not Next.js) |

All checks passed. No mismatch.

---

## 3. Phaser 4.1.0 GPU API Findings

All findings below are from the installed Phaser 4.1.0 package at `node_modules/phaser/`. No Phaser 3 assumptions were used. Both classes are confirmed stable (since 4.0.0), not experimental or beta.

### 3.1 SpriteGPULayer

**Full path:** `Phaser.GameObjects.SpriteGPULayer`

**Constructor:**
```ts
new Phaser.GameObjects.SpriteGPULayer(scene, texture, size)
```
- `scene` — The Scene this belongs to
- `texture` — Must be from a **single image** (not multi-atlas, not spritesheet in the traditional sense — one texture per layer)
- `size` — Max number of quads; can be increased later via `resize()`

**Factory method:**
```ts
this.add.spriteGPULayer(texture, size?): SpriteGPULayer
```

**Member type (per-sprite data):**
Each member is 168 bytes (42 float32s) in a GPU buffer:
- `x`, `y`, `rotation`, `scaleX`, `scaleY`, `alpha` — each animatable via `MemberAnimation`
- `frame` — string, number, or `{name: string}` (references a frame in the texture)
- `animation` — string or number referencing `setAnimations()` data for GPU-driven frame cycling
- `tintBlend`, corner tints/alphas, `originX`, `originY`, `tintMode`, `creationTime`, `scrollFactorX`, `scrollFactorY`

**MemberAnimation type (GPU-driven easing):**
```ts
interface MemberAnimation {
  base?: number;        // starting value (default 0)
  ease?: number|string; // easing function name or code
  amplitude?: number;   // oscillation amplitude (default 0)
  duration?: number;    // ms, must be non-negative
  delay?: number;       // ms
  loop?: boolean;       // default true
  yoyo?: boolean;       // default true
  gravityFactor?: number; // -1 to 1 (Gravity ease only)
  velocity?: number;     // integer (Gravity ease only)
}
```

Available easings: None, Linear/Power0, Gravity, Quad (easeOut/In/InOut), Cubic, Quart, Quint, Sine, Expo, Circ, Back, Bounce, Stepped, Smoothstep. **Elastic is NOT supported.**

**Key methods:**
| Method | Description |
|--------|-------------|
| `addMember(member)` | Add a member (easiest API) |
| `editMember(index, member)` | Edit member by index (segment-only update) |
| `patchMember(index, data, mask?)` | Raw buffer patch with optional mask |
| `getMember(index)` | Read back member as object |
| `removeMembers(index, count?)` | Remove members (expensive — shifts buffer) |
| `insertMembers(index, members)` | Insert at position (expensive) |
| `resize(count, clear?)` | Resize buffer (expensive) |
| `setAnimations(animations)` | Define GPU animations for frame cycling |
| `setAnimationEnabled(name, enabled)` | Enable/disable shader animation type |
| `preUpdate(time, delta)` | Advances timer (called by Scene) |

**Critical limitations:**
1. **No per-member depth sorting.** Members render in buffer insertion order. No z-index or depth property per member.
2. **Single texture per layer.** Must be one image. Different textures require separate SpriteGPULayer instances.
3. **WebGL ONLY.** Canvas rendering is a no-op.
4. **Buffer modifications are expensive.** `addMember`, `editMember`, `removeMembers` all cost GPU upload time.
5. **Remove is especially expensive.** Splices buffer, shifts all later members. Best practice: set `scaleX=0, scaleY=0, alpha=0` instead of removing.
6. **Low-end shader risk.** Many enabled animation types may fail to compile on low-end GPUs.
7. **Fill-rate limited** for large quads — avoid drawing more than a few million pixels per frame.

**Performance claim:** Up to 100x faster than individual sprites; handles ~1 million small quads well. But this is only true when members are static or GPU-animated. CPU-driven per-frame edits negate the benefit.

### 3.2 TilemapGPULayer

**Full path:** `Phaser.Tilemaps.TilemapGPULayer`

**Constructor:**
```ts
new Phaser.Tilemaps.TilemapGPULayer(scene, tilemap, layerIndex, tileset, x?, y?)
```

**Creation via Tilemap API:**
```ts
const layer = this.tilemap.createLayer(layerID, tileset, x, y, /* gpu */ true);
// When gpu=true, returns TilemapGPULayer instead of TilemapLayer
```

**Abilities:**
- Tile flip (horizontal/vertical)
- Tile animation (via tileset animation data, GPU-driven)
- Smooth border rendering between tiles in LINEAR mode (no seams)
- NEAREST filtering for pixel art
- Arcade Physics collision support (inherited)
- Standard Scene lifecycle (preUpdate, addedToScene, removedFromScene)

**Critical limitations:**
1. **Orthographic tilemaps ONLY.** No isometric or hexagonal support. This is a hard limitation in the current API.
2. **Single tileset** with single texture image.
3. **Max tilemap size:** 4096 x 4096 tiles.
4. **No per-tile depth/sorting.** Renders as a single GPU quad.
5. **Edits require manual texture regeneration** — `generateLayerDataTexture()` must be called after tile changes; NOT automatic.
6. **WebGL ONLY.** Canvas rendering is a no-op.

---

## 4. Current Rendering Model

### 4.1 Architecture overview

The rendering architecture follows a strict layered separation: pure TypeScript state → Phaser render layer → DOM UI. All renderers read from `GameState` but never mutate it directly. GameScene orchestrates the update loop, calling state updates then renderer sync methods each frame.

### 4.2 Renderer inventory

| Renderer | Phaser Primitives | Object Count | Depth Range | Per-Frame Update | Animation |
|----------|-------------------|--------------|-------------|-------------------|-----------|
| **TerrainRenderer** | RenderTexture (stamp) | 1 RT, stamped once | 0 | No (static) | None |
| **EntityRenderer** | Image (HQ, resources), Sprite (harvesters), delegates | ~10-20 Images, ~8 Sprites | 100+worldY | Yes (harvesters) | Phaser Animation Manager (8 FPS walk cycle) |
| **ConstructionRenderer** | Graphics (sites), Image (buildings), Sprite (builders) | Variable | 100+worldY, 110+worldY | Yes (sites+builders) | Procedural sin() pulse |
| **BuildingStatusRenderer** | Graphics (progress bars), Text (labels) | Per-building: 1 Graphics + 1 Text | 200-201 | Yes (all) | Procedural sin() glow |
| **FeedbackRenderer** | Graphics (diamonds), Text (floating, pooled) | 1 shared Graphics + Text pool | 160-161 | Yes (all) | Alpha decay over lifetime |
| **UnitMotionFxRenderer** | Graphics (dust circles) | 1 shared Graphics + up to 60 particle data | 95 | Yes (all) | Custom fade+grow |
| **ModularTankRenderer** | Image (hull, turret) | 2 Images per tank | 100+worldY, 101+worldY | On-demand (input only) | Texture swap on direction change |

### 4.3 Depth layer stack

```
Depth   Content
─────   ───────
  0     Terrain (RenderTexture — stamped once)
 50     Grid lines (Graphics — drawn once)
 95     Dust particles (UnitMotionFxRenderer)
100+    Entities — painter's algorithm by worldY (EntityRenderer)
110+    Builders (ConstructionRenderer)
160     Feedback indicators (FeedbackRenderer)
161     Feedback text (FeedbackRenderer)
200     Building status bars (BuildingStatusRenderer)
201     Building status text (BuildingStatusRenderer)
```

The depth model is critical: entities, buildings, and builders all use **depth = baseValue + worldY** to achieve painter's algorithm ordering in the isometric view. This ensures that objects closer to the bottom of the screen (higher worldY) are drawn on top of objects further away, creating the correct visual layering for a 2:1 isometric projection.

### 4.4 Coordinate system

All renderers use the same isometric projection:
```ts
tileToScreen(tx, ty) = { x: (tx - ty) * 38, y: (tx + ty) * 19 }
```
Screen coordinates are then offset by `mapOriginOffset()` for positive buffer positioning.

### 4.5 Which parts are already good enough

- **TerrainRenderer**: RenderTexture stamp is efficient. Stamps all terrain tiles once, never redraws. Camera scrolls over the static texture. Zero per-frame cost. No performance issue at any reasonable map size.
- **EntityRenderer (static)**: HQ and resource Images are created once and never updated. Simple and efficient.
- **EntityRenderer (animated)**: Harvester sprites use Phaser Animation Manager. 8 FPS walk cycle, direction-based animation keys. Works well for 2-8 harvesters.
- **ConstructionRenderer (buildings)**: Building Images are created once. Graphics overlays are lightweight per-frame redraws.
- **ModularTankRenderer**: On-demand texture swap. No per-frame cost. Works correctly.

### 4.6 Which parts are bottleneck candidates

- **None at current scale.** The project renders approximately 8 civil unit sprites, 10-20 building/resource images, a few Graphics overlays, and one large RenderTexture. This is well within Phaser's comfort zone for 60 FPS on any modern device.
- **Future bottleneck candidates** (not current):
  - EntityRenderer sync could become costly with 50+ animated sprites (combat units)
  - Graphics clear+redraw per frame for BuildingStatusRenderer and FeedbackRenderer could add up with many buildings
  - Per-frame `syncFromState()` iterating all entities could become noticeable at 200+ entities

---

## 5. TilemapGPULayer Feasibility

### 5.1 Could terrain rendering move to TilemapGPULayer?

**No, not with the current isometric approach.** TilemapGPULayer explicitly supports orthographic tilemaps only. This is a hard limitation in the Phaser 4.1.0 API — there is no isometric mode, no hexagonal mode, and no custom projection support.

### 5.2 Does the current isometric map/tile model fit Phaser TilemapGPULayer?

**No.** Our terrain is rendered using a custom isometric 2:1 projection where each tile at `(tx, ty)` is placed at screen coordinates `((tx - ty) * 38, (tx + ty) * 19)`. TilemapGPULayer expects an orthographic grid where tiles are laid out in a regular rectangular grid with constant tile width and height. Our diamond-shaped isometric tiles do not map to this model.

### 5.3 Would this require changing map data format?

**Yes, fundamentally.** To use TilemapGPULayer, we would need to:
1. Convert the terrain data from our `TerrainType[][]` grid to a Phaser Tilemap data structure
2. Arrange tiles in an orthographic grid (losing the isometric projection)
3. Or pre-render the isometric terrain as an orthographic tilemap of isometric tiles (complex, fragile, and defeats the purpose)

This is not practical without fundamentally changing how the game renders terrain.

### 5.4 Would it support current sand tile variation?

**Technically yes** — TilemapGPULayer supports tile animation and multiple tile types within a tileset. But since the isometric projection is incompatible, this point is moot.

### 5.5 Would it support resource/building/entity overlays?

**No.** TilemapGPULayer renders as a single GPU quad. All tiles share the same depth value. It cannot interleave with entities at different depths, which is essential for our isometric rendering where buildings and units appear "on top of" terrain tiles based on their Y position.

### 5.6 Would it help current Sandbox MVP?

**No.** The current TerrainRenderer stamps all terrain once into a RenderTexture, which is already GPU-resident and scrolled by the camera. There is no per-frame terrain rendering cost. TilemapGPULayer would not improve upon this at current map sizes (48x48 = 2304 tiles).

### 5.7 TilemapGPULayer verdict

**Not feasible for this project.** The orthographic-only limitation is a hard blocker for our isometric 2:1 terrain. Even if we adopted an orthographic terrain approach, the single-depth-layer limitation would prevent interleaving with depth-sorted entities.

---

## 6. SpriteGPULayer Feasibility

### 6.1 Could static objects/resources/decor move to SpriteGPULayer?

**Technically possible but not beneficial at current scale.** Static HQ images and resource images could theoretically be placed in a SpriteGPULayer. However:

- Each SpriteGPULayer instance requires a **single texture**. HQ images and resource images use different textures, requiring separate layer instances.
- Static Images created once have near-zero per-frame cost already. There is no performance problem to solve.
- The overhead of managing SpriteGPULayer buffer entries (addMember, editMember for position updates when camera scrolls) may exceed the cost of simply placing static Images.

For a 48x48 map with ~10 static objects, individual Images are simpler and equally performant.

### 6.2 Could harvesters/builders move to SpriteGPULayer while preserving animation?

**Partially, with significant constraints.** SpriteGPULayer supports GPU-driven frame animation via `setAnimations()` and the `animation` member property. Harvesters and builders could use this for their walk cycles. However:

- **Single texture limitation**: Each harvester spritesheet (256x256, 8x8 grid) is a separate texture per faction. A SpriteGPULayer for cyan harvesters would need a separate instance from green harvesters. With 4 factions, that's 4 layers for harvesters alone.
- **Position updates are expensive**: Harvesters move every frame (fractional tile positions). SpriteGPULayer requires `editMember()` for position changes, which triggers GPU buffer uploads. At 2-8 harvesters, this is manageable but offers no benefit over standard Sprites.
- **Direction changes**: When a harvester changes direction, we need to update the animation reference. This is possible via `editMember(index, { animation: 'harvester_cyan_move_3' })` but adds complexity over `sprite.play('harvester_cyan_move_3')`.
- **No per-member depth sorting**: This is the critical blocker. Harvesters at different Y positions need different depth values for correct isometric layering. SpriteGPULayer cannot do this.

### 6.3 Can SpriteGPULayer handle per-sprite depth/sorting needed by isometric layout?

**No.** This is the fundamental incompatibility. SpriteGPULayer renders members in buffer insertion order only. There is no depth property per member, no z-index, and no automatic sorting. The layer itself has a single depth value in the scene's render list.

Our isometric rendering requires each entity to have a unique depth value based on its screen Y position (`depth = 100 + worldY`). This is essential for correct visual layering: a unit at tile (5, 10) must appear in front of a building at tile (5, 5) because it is "closer to the camera" in the isometric view.

**Workaround options:**
1. **Multiple SpriteGPULayers sorted by depth band**: Create N layers for N depth bands (e.g., one per row of tiles). Entities are placed in the layer matching their Y position. This would require ~48 layers for a 48-row map, each with its own draw call. This is almost certainly slower than the current approach with individual sprites.
2. **Re-sort buffer every frame**: Remove and re-insert members in the correct order each frame. This is extremely expensive (buffer splicing + GPU uploads) and defeats the purpose of GPU batching.
3. **Restrict to same-depth entities only**: Only use SpriteGPULayer for entities that share the same depth (e.g., a row of terrain decorations). This limits usefulness to narrow cases.

None of these workarounds are practical for the current project.

### 6.4 Can it handle selection/highlight/status overlays?

**No, not well.** Selection rings, highlights, and status indicators are typically rendered as Graphics overlays or tinted sprites on top of the selected entity. SpriteGPULayer supports tinting (per-member tint), but:
- The tint applies to the entire member quad (no partial tinting)
- Selection rings would need to be separate members or a separate layer
- The no-depth-sorting issue means overlays cannot be interleaved with entities at different depths

### 6.5 Does it integrate with Phaser Animation Manager?

**No.** SpriteGPULayer has its own GPU-driven animation system (`setAnimations()`), which is entirely separate from Phaser's Animation Manager. The GPU animation system:
- Runs animations in the vertex shader (zero CPU cost)
- Supports frame cycling and easing
- Cannot emit events, pause, or set repeat counts
- Is defined declaratively via `setAnimations()` data

This means migrating from Animation Manager to SpriteGPULayer GPU animations would require rewriting all animation definitions in a different format. There is no bridge or compatibility layer.

### 6.6 What would break if we move dynamic units too early?

Moving harvester/builder sprites to SpriteGPULayer would break:
1. **Isometric depth ordering**: Units would render in buffer insertion order, not Y-position order. Units closer to the top of the screen could appear in front of units closer to the bottom, which looks wrong in isometric view.
2. **Animation Manager integration**: Current `sprite.play('harvester_cyan_move_2')` calls would need to be replaced with `editMember(index, { animation: ... })` buffer edits.
3. **Per-sprite interaction**: Click detection, hover effects, and selection would need to be reimplemented since SpriteGPULayer members are not interactive Phaser game objects.
4. **Visual feedback**: Highlight rings, gathering indicators, and blocked-reason markers rendered per-entity would need separate rendering layers.
5. **Debug overlays**: The debug overlay system renders per-entity debug information, which relies on individual sprite references.

### 6.7 SpriteGPULayer verdict

**Not feasible for entity rendering in this project** due to the no-per-member-depth-sorting limitation. The isometric rendering model fundamentally requires per-entity depth control, which SpriteGPULayer does not provide. The single-texture limitation further reduces its utility for a game with multiple entity types using different spritesheets.

The GPU animation system is interesting for future scenarios with 100+ identical units (e.g., swarms of combat units all using the same texture), but even then the depth-sorting issue would need to be solved first.

---

## 7. Isometric/Depth Constraints

### 7.1 Current depth model

The current rendering model uses Phaser's standard depth system with painter's algorithm:

```typescript
// EntityRenderer — per-entity depth
sprite.setDepth(100 + worldY);  // harvesters, resources, HQ
sprite.setDepth(110 + worldY);  // builders

// ConstructionRenderer — per-building depth  
image.setDepth(computeBuildingDepth(tx, ty, footprint));

// ModularTankRenderer — hull+turret pair
hullImage.setDepth(100 + worldY);
turretImage.setDepth(101 + worldY);  // always above hull
```

This allows entities at different Y positions to correctly overlap: a unit walking south (higher worldY) appears in front of a building to its north (lower worldY). This is fundamental to isometric rendering and cannot be sacrificed.

### 7.2 GPU layer depth model

Both `SpriteGPULayer` and `TilemapGPULayer` render as a **single depth layer** in the scene. They have a `depth` component (from `Components.Depth`), but this sets the global depth of the entire GPU layer, not of individual members or tiles.

- `SpriteGPULayer`: Members render in buffer order. No per-member depth.
- `TilemapGPULayer`: Renders as a single quad. No per-tile depth.

### 7.3 Compatibility analysis

| Requirement | Current (Sprites/Images) | SpriteGPULayer | TilemapGPULayer |
|-------------|--------------------------|----------------|-----------------|
| Per-entity depth by worldY | Yes (setDepth) | No | No |
| Per-tile position in isometric grid | Yes (tileToScreen) | Yes (x,y) | No (orthographic only) |
| Depth-based visual overlap | Yes (painter's algo) | No (buffer order) | No (single quad) |
| Interleave with other layers | Yes | Partial (layer-level only) | No |

**Conclusion:** The isometric depth model is fundamentally incompatible with GPU layers. Any use of GPU layers must be restricted to layers that do not require per-element depth sorting — i.e., pure background layers where all elements share the same visual depth.

---

## 8. Candidate Use Cases

| Use Case | GPU Layer Fit | Feasibility | Benefit at Current Scale |
|----------|---------------|-------------|--------------------------|
| **Terrain background** | TilemapGPULayer | **Blocked** — orthographic only, isometric incompatible | None — current RenderTexture is already optimal |
| **Static resources** | SpriteGPULayer | **Marginal** — same depth, single texture per layer | Negligible — ~5 Image objects, no perf issue |
| **Static buildings** | SpriteGPULayer | **Marginal** — depth varies by position | None — depth sorting required |
| **Civil units (harvesters/builders)** | SpriteGPULayer | **Blocked** — depth varies per-entity, animation migration needed | None — 8 sprites, Animation Manager working well |
| **Selection markers / feedback effects** | SpriteGPULayer | **No** — Graphics overlays need per-entity depth | None |
| **Future combat units** | SpriteGPULayer | **Conditional** — only if all combat units share one texture AND same depth | Possible at 50+ units, but depth sorting still a blocker |
| **Particles/VFX** | Neither | **No** — particles need Phaser ParticleEmitter or Graphics | N/A |
| **Debug/arena-only rendering** | SpriteGPULayer | **Marginal** — could batch arena grid markers | Negligible |

**Summary:** No candidate use case provides a clear benefit at the current project scale. The isometric depth-sorting requirement blocks GPU layers for most entity types. Terrain is already optimally rendered via RenderTexture. Only a hypothetical future scenario with 50+ identical combat units sharing the same texture and same approximate depth could potentially benefit, but even that would require a multi-layer depth-band approach that is likely slower than individual sprites.

---

## 9. Implementation Options

### Option A: No-op / postpone GPU layers

**What it is:** Accept the spike findings. Do not implement any GPU layer usage. Document the findings for future reference. Proceed to the next roadmap item.

| Aspect | Detail |
|--------|--------|
| **Risk** | None — zero code changes |
| **Benefit** | Knowledge captured; no wasted effort on incompatible APIs |
| **Touched files** | This report only |
| **What could break** | Nothing |
| **Validation needed** | None |
| **Worth doing now?** | **Yes** — this is the recommended option |

### Option B: TilemapGPULayer spike prototype for terrain only

**What it is:** Create a prototype that renders terrain using TilemapGPULayer instead of RenderTexture, gated behind a devtools flag. Requires converting the isometric terrain grid to an orthographic tilemap representation.

| Aspect | Detail |
|--------|--------|
| **Risk** | High — fundamental incompatibility with isometric projection; prototype would prove the API doesn't fit our use case |
| **Benefit** | Confirms TilemapGPULayer is not viable; prevents future wasted effort |
| **Touched files** | TerrainRenderer.ts, PreloadScene.ts, map data pipeline |
| **What could break** | Terrain rendering would need to be restructured; camera scrolling might not work with the same offset model; sand tile variation would need tileset conversion |
| **Validation needed** | Visual comparison, camera scroll test, zoom test, map size scaling test |
| **Worth doing now?** | **No** — the orthographic-only limitation is a documented hard blocker. A prototype would only confirm what the API inspection already tells us. |

### Option C: SpriteGPULayer spike prototype for static resources/decor only

**What it is:** Create a prototype that renders resource node images (small/medium/large/infinite minerals) using a SpriteGPULayer instead of individual Images. Gated behind a devtools flag.

| Aspect | Detail |
|--------|--------|
| **Risk** | Low — resources are static, same-depth objects that don't move or animate |
| **Benefit** | Marginal — replaces ~5-10 Image objects with a batch; no measurable performance improvement |
| **Touched files** | EntityRenderer.ts, PreloadScene.ts |
| **What could break** | Resource rendering; texture existence checks; depletion visual updates (would need editMember for visibility) |
| **Validation needed** | Visual comparison, depletion test, faction resource rendering |
| **Worth doing now?** | **No** — the benefit is negligible at ~5-10 objects. The implementation complexity (separate layer per texture type, editMember for visibility changes) exceeds the value. |

### Option D: SpriteGPULayer for future combat units

**What it is:** Design the combat unit rendering pipeline to use SpriteGPULayer from the start, so when 50+ combat units are on screen, they benefit from GPU batching. Each faction's combat units would have their own SpriteGPULayer instance.

| Aspect | Detail |
|--------|--------|
| **Risk** | High — depth sorting remains unsolved; single texture limitation requires careful texture atlas design; combat units will be at different Y positions requiring different depths |
| **Benefit** | Theoretical — could reduce draw calls for 50+ identical units if they share the same texture and are in the same depth band |
| **Touched files** | New combat renderer, GameScene, PreloadScene |
| **What could break** | Combat unit rendering if depth ordering fails; visual layering with buildings and other entities |
| **Validation needed** | Combat prototype with 50+ units at varying positions; depth ordering verification; performance benchmarking |
| **Worth doing now?** | **No** — combat is parked. When combat is implemented, the depth-sorting issue must be solved first. A multi-layer depth-band approach or a custom shader solution may be needed. |

---

## 10. Recommended PHASER4-GPU-02 Scope

### Recommendation: No-op / docs-only

PHASER4-GPU-02 should be **no implementation**. This spike report documents the findings and provides the decision rationale.

**Rationale:**

1. **TilemapGPULayer is incompatible** with the isometric terrain rendering. The orthographic-only limitation is a hard blocker. Our RenderTexture terrain is already optimal.

2. **SpriteGPULayer is incompatible** with the depth-sorted entity rendering. The no-per-member-depth limitation is a hard blocker for any entity that needs painter's algorithm ordering, which includes all units, buildings, and interactive objects in our isometric view.

3. **Current performance is adequate.** With ~8 civil unit sprites, ~10-20 static Images, and a pre-rendered terrain texture, there is no performance problem that GPU layers would solve.

4. **GPU layers could become relevant** in two future scenarios:
   - If the game adopts an orthographic terrain view (unlikely — isometric is core to the design)
   - If combat introduces 50+ identical units sharing a texture, and a depth-band multi-layer solution is designed

5. **The spike was valuable.** It confirmed API availability, capabilities, and limitations. This prevents wasted effort on implementation attempts that would hit hard blockers.

### What PHASER4-GPU-02 should NOT do

- Implement TilemapGPULayer for terrain
- Implement SpriteGPULayer for entities
- Change any renderer code
- Change terrain rendering
- Change unit rendering
- Change animation logic
- Add GPU layer dependencies
- Create prototypes

### When to reconsider

GPU layers should be reconsidered when:
1. Sprite count exceeds 50 animated entities on screen simultaneously
2. Combat is implemented and combat unit rendering needs optimization
3. Phaser releases an update with isometric TilemapGPULayer support or per-member depth sorting in SpriteGPULayer
4. The project adopts an orthographic terrain view

---

## 11. Reject Criteria / Risks

### When GPU layer implementation should be rejected

- If the isometric depth model would need to be sacrificed or weakened
- If per-entity depth sorting would be lost
- If the implementation requires changes to the state layer
- If the implementation requires fundamental terrain data format changes
- If the implementation creates multiple GPU layers for depth bands (likely slower than current approach)
- If the implementation breaks camera scrolling, zoom, or entity interaction
- If the implementation reduces rendering quality (visual glitches, z-fighting, incorrect overlap)
- If the implementation adds significant complexity for negligible performance gain
- If the implementation breaks the Architecture Boundary rule (state layer must not import Phaser)

### Risks of premature GPU layer adoption

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Depth ordering broken in isometric view | High | High — visual regression | Do not adopt until per-member depth is supported |
| Single texture limitation forces many layers | High | Medium — complexity, draw call overhead | Do not adopt for multi-texture entity types |
| Buffer edit overhead negates GPU batch benefit | Medium | Medium — no performance gain | Only adopt for static or GPU-animated entities |
| Low-end GPU shader compilation failures | Medium | Medium — some devices can't run the game | Test on low-end devices before committing |
| Migration breaks existing Animation Manager usage | Medium | High — breaks working animation system | Do not migrate from Animation Manager to GPU animations |

---

## 12. Validation Plan for Future Implementation

If GPU layers are reconsidered in the future, the following validation should be performed before any production implementation:

### Phase 1: API verification

| Step | Description |
|------|-------------|
| Check Phaser release notes | Confirm whether isometric TilemapGPULayer or per-member depth has been added |
| Test depth-band multi-layer approach | Create a prototype with N SpriteGPULayers for N depth bands; measure draw call count and frame time |
| Benchmark against current approach | Compare frame time and draw calls for 50+ entities with both approaches |

### Phase 2: Compatibility testing

| Step | Description |
|------|-------------|
| Camera scroll + zoom | Verify GPU layers work with the current camera system |
| Entity interaction | Verify click detection and selection work with GPU layer members |
| Animation system | Verify GPU animations match Animation Manager visual quality |
| Low-end GPU testing | Test on integrated graphics and mobile GPUs for shader compilation |
| Mixed rendering | Verify GPU layers coexist with regular Sprites/Images/Graphics |

### Phase 3: Production readiness

| Step | Description |
|------|-------------|
| Depth ordering stress test | Place 50+ entities at various Y positions; verify correct visual overlap |
| Performance regression test | Compare frame time before and after GPU layer adoption |
| Visual regression test | Compare screenshots before and after; no visual artifacts or z-fighting |
| Save/load compatibility | Verify loaded saves render correctly with GPU layer entities |

---

## 13. Ready-to-Send Implementation Prompt

**Not applicable.** This spike concludes that no implementation is warranted at this time. PHASER4-GPU-02 is recommended as no-op / docs-only.

If GPU layers become viable in the future (due to Phaser API changes or project scale growth), a new spike should be conducted first to re-evaluate the API landscape at that time.

---

## Commands Run / Verification

| Command | Result |
|---|---|
| `git remote -v` | Confirmed `ratoker-jpg/four-elements-phaser` |
| `grep '"phaser"' package.json` | `"phaser": "4.1.0"` |
| PR #91 merge check | Merged (`f3e5796`) |
| Phaser 4.1.0 SpriteGPULayer source analysis | `node_modules/phaser/src/gameobjects/spritegpulayer/SpriteGPULayer.js` inspected; constructor, methods, member type, limitations confirmed |
| Phaser 4.1.0 TilemapGPULayer source analysis | `node_modules/phaser/src/tilemaps/TilemapGPULayer.js` inspected; orthographic-only limitation confirmed |
| Phaser 4.1.0 type definitions | `node_modules/phaser/types/phaser.d.ts` inspected; full type definitions confirmed for both classes |
| Renderer source inspection | All 7 renderers read and analyzed for primitives, depth model, animation usage |
| Asset count analysis | 106 keys total; current sprite count ~8 civil units + ~10-20 static images |

No runtime validation was required by the task spec. All findings are from source code inspection and Phaser 4.1.0 package analysis.
