# ASSET-WORKFLOW-01 — Animated Unit Asset Pipeline

Status: design document — requires Denis acceptance before UNIT-ANIM-01/02  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Phaser version: 4.1.0  
Date: 2026-05-29

---

## 1. Purpose

This document defines the complete pipeline for generating, validating, and integrating animated unit spritesheets into the Four Elements Phaser runtime. It must be accepted by Denis before any unit regeneration task (UNIT-ANIM-01, UNIT-ANIM-02, or future combat unit animation) begins.

Without this pipeline, unit regeneration risks the same class of bugs that affected early assets: wrong direction mapping, inconsistent scale, bad crop, incorrect ground anchor, wrong frame layout, broken faction variants, runtime code expecting different naming, and manual one-off fixes that accumulate into technical debt.

---

## 2. Current asset state

### 2.1 Harvester

- **File**: `public/assets/factions/{faction}/units/harvester_8x8_256.png`
- **Sheet**: 2048x2048 px, 8 rows x 8 columns, 256x256 px frames, 64 total frames
- **Direction rows**: E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7
- **Column layout**: Column 0 = idle, Columns 1-7 = walk cycle frames
- **Asset key**: `harvester_{faction}` (e.g., `harvester_cyan`)
- **Load type**: spritesheet with `frameConfig: { frameWidth: 256, frameHeight: 256, endFrame: 63 }`
- **Origin**: `(0.5, 0.75)` — ground contact point at 75% from top, centered horizontally (pixel anchor: 128, 192)
- **Render scale**: `HARVESTER_RENDER_SCALE` = (41 / 256) x 1.30 = ~0.208
- **Animation Manager**: Fully integrated (PHASER4-ANIM-02). 64 animation keys registered: 4 factions x 2 states (idle/move) x 8 directions
- **Animation key pattern**: `harvester_{faction}_{state}_{dir}` (e.g., `harvester_cyan_move_s`)
- **Walk cycle FPS**: 8
- **Missing states**: No gather, unload, or cargo animation frames exist. Gather/unload currently show idle frame.

### 2.2 Builder

- **File**: `public/assets/factions/{faction}/units/builder_8x8_256.png`
- **Sheet**: Same layout as harvester (2048x2048, 8x8, 256x256)
- **Asset key**: `builder_{faction}` (e.g., `builder_green`)
- **Load type**: spritesheet with same frameConfig
- **Origin**: `(0.5, 0.75)` — ground contact point at 75% from top, centered horizontally (pixel anchor: 128, 192)
- **Render scale**: `BUILDER_RENDER_SCALE` = (40 / 256) x 1.45 = ~0.227
- **Animation Manager**: NOT yet integrated. Still uses `setFrame(dirIndex * 8 + 0)` for manual direction indexing in ConstructionRenderer
- **Missing states**: No build/work animation frames. Build phase shows idle frame.

### 2.3 Modular combat units (Wasp hull + Smoky turret)

- **File pattern**: `public/assets/units/{chassis|weapons}/{model}/{faction}/{model}_{part}_idle_dir{N}_0.png`
- **Load type**: individual images (not spritesheets) — 64 total for hull + turret x 4 factions x 8 dirs
- **Asset key pattern**: `wasp_m0_hull_{faction}_dir{N}`, `smoky_m0_turret_{faction}_dir{N}`
- **Current limitation**: Only idle frame per direction exists. No animation states.
- **Future**: Will need separate animation pipeline for chassis movement + weapon firing. This is out of scope for ASSET-WORKFLOW-01 but assumptions are documented in section 10.

---

## 3. Asset folder structure

### 3.1 Current structure (preserved)

```text
public/assets/
  factions/
    {faction}/
      buildings/
        hq_t1.png
        separator.png
        raw_storage.png
        ...
      units/
        builder_8x8_256.png
        harvester_8x8_256.png
  units/
    chassis/wasp_m0/{faction}/
      wasp_m0_hull_idle_dir{N}_0.png
    weapons/smoky_m0/{faction}/
      smoky_m0_turret_idle_dir{N}_0.png
  tiles/
    sand_tile.png
    sand_tile_dark.png
    sand_tile_light.png
  environment/
    mineral_small_02.png
    mineral_medium_02.png
    mineral_large_02.png
```

### 3.2 Extended structure for animated units

When new animated spritesheets replace existing ones, the file naming changes to include the animation state count so that the processor and runtime can distinguish different sheet versions. The current `8x8` naming (8 dirs x 8 frames) transitions to a more descriptive convention.

**Decision: Each faction gets its own spritesheet file.** One-atlas-per-faction is the current model and will remain. This avoids runtime texture-atlas stitching complexity and keeps Phaser spritesheet loading straightforward. The tradeoff is 4 sheet loads per unit type (4 factions), which is acceptable at current scale (~8 civil units total).

**New file naming convention:**

```text
public/assets/factions/{faction}/units/
  harvester_{dirs}d_{states}s_{framePx}.png
  builder_{dirs}d_{states}s_{framePx}.png
```

Where:
- `{dirs}` = number of directions (8)
- `{states}` = number of animation-state rows
- `{framePx}` = frame pixel size (256)

**Examples:**

```text
harvester_8d_4s_256.png   — 8 directions, 4 animation states, 256px frames
builder_8d_3s_256.png     — 8 directions, 3 animation states, 256px frames
```

**Rationale**: The filename encodes the sheet layout so that both the asset processor (`process_art_assets.mjs`) and runtime code (`unitRenderConfig.ts`) can derive frame indexing without external metadata. This is more robust than the current `8x8_256` convention which only encodes grid dimensions, not the semantic meaning of rows.

### 3.3 Art source directory (not in public/)

Intermediate art source files (Blender renders, pre-crop PNGs, etc.) should live outside `public/` to avoid accidentally serving them:

```text
art/
  source/
    units/
      harvester/
        blender/           — Blender project files
        renders/           — Raw rendered frames
        sheets/            — Assembled but unvalidated spritesheets
      builder/
        ...
  generated/
    manifest.generated.json
    audit-report.json
```

The `public/assets/` directory contains only runtime-approved PNGs that the Phaser loader serves. Art source never enters `public/`.

---

## 4. File naming convention

### 4.1 Spritesheet files on disk

```text
{unitType}_{dirs}d_{states}s_{framePx}.png
```

| Field | Description | Example values |
|-------|-------------|----------------|
| `unitType` | Unit type identifier | `harvester`, `builder` |
| `dirs` | Direction count | `8` |
| `states` | Animation state rows | `4` (harvester: idle+move+gather+unload), `3` (builder: idle+move+build) |
| `framePx` | Frame size in pixels | `256` |

**Full path examples:**

```text
public/assets/factions/cyan/units/harvester_8d_4s_256.png
public/assets/factions/green/units/builder_8d_3s_256.png
public/assets/factions/purple/units/harvester_8d_4s_256.png
```

### 4.2 Asset keys (Phaser texture keys)

Asset keys remain faction-qualified, matching the current convention:

```text
{unitType}_{faction}
```

| Example | Current key | New key (unchanged) |
|---------|-------------|---------------------|
| Cyan harvester | `harvester_cyan` | `harvester_cyan` |
| Green builder | `builder_green` | `builder_green` |

**The asset key does NOT change when the spritesheet layout changes.** The key is the runtime identity; the file path and frame count are configuration details.

### 4.3 Animation keys (Phaser Animation Manager)

```text
{unitType}_{faction}_{state}_{direction}
```

| Component | Values | Example |
|-----------|--------|---------|
| `unitType` | harvester, builder | `harvester` |
| `faction` | cyan, green, yellow, purple | `cyan` |
| `state` | idle, move, gather, unload, build | `move` |
| `direction` | e, se, s, sw, w, nw, n, ne | `s` |

**Full examples:**

```text
harvester_cyan_idle_s          — idle, south-facing
harvester_cyan_move_se         — walk cycle, south-east
harvester_green_gather_n       — gathering, north-facing
harvester_purple_unload_sw     — unloading, south-west
builder_cyan_build_ne          — building, north-east
builder_yellow_move_w          — walk cycle, west
```

**Total animation keys per unit type:**

| Unit | States | Dirs | Factions | Total keys |
|------|--------|------|----------|------------|
| Harvester | 4 (idle, move, gather, unload) | 8 | 4 | 128 |
| Builder | 3 (idle, move, build) | 8 | 4 | 96 |

---

## 5. Spritesheet layout

### 5.1 Direction rows (unchanged)

Rows represent directions. This matches the current working convention and the PHASER4-ANIM-01 spike verification.

```text
Row 0 = E   (East / screen-right)
Row 1 = SE  (South-East / down-right)
Row 2 = S   (South / down)
Row 3 = SW  (South-West / down-left)
Row 4 = W   (West / screen-left)
Row 5 = NW  (North-West / up-left)
Row 6 = N   (North / up)
Row 7 = NE  (North-East / up-right)
```

### 5.2 Animation-state row groups (NEW)

Instead of all 8 rows representing the same animation state (as in the current 8x8 layout where rows = directions and columns = frames of one state), the new layout extends rows to accommodate multiple animation states.

**Layout model: rows = directions x states, columns = animation frames**

Each animation state occupies a contiguous block of 8 rows (one per direction). Within each state block, the row ordering follows the direction convention from section 5.1.

```text
Row  0–7:   State 0 (idle)     — 8 direction rows
Row  8–15:  State 1 (move)     — 8 direction rows
Row 16–23:  State 2 (gather)   — 8 direction rows  [harvester only]
Row 24–31:  State 3 (unload)   — 8 direction rows  [harvester only]
```

For builder:

```text
Row  0–7:   State 0 (idle)     — 8 direction rows
Row  8–15:  State 1 (move)     — 8 direction rows
Row 16–23:  State 2 (build)    — 8 direction rows
```

**Column layout per direction row:**

- Column 0: keyframe / primary pose for this state and direction
- Columns 1 through N: animation frames for this state

### 5.3 Frame indexing formula

```text
frameIndex = (stateIndex * 8 + dirIndex) * columnsPerRow + columnOffset
```

Where:
- `stateIndex` = 0 for idle, 1 for move, 2 for gather/unload/build, 3 for unload (harvester)
- `dirIndex` = 0..7 matching E/SE/S/SW/W/NW/N/NE
- `columnsPerRow` = number of frames per direction row (including column 0)
- `columnOffset` = frame within the row (0 = keyframe, 1+ = animation frames)

### 5.4 Sheet dimensions

| Unit type | States | Dirs | Frames per dir | Total rows | Total columns | Sheet size (at 256px frames) |
|-----------|--------|------|----------------|------------|---------------|------------------------------|
| Harvester | 4 | 8 | 8 | 32 | 8 | 2048 x 8192 px |
| Builder | 3 | 8 | 8 | 24 | 8 | 2048 x 6144 px |

**Important**: The harvester sheet grows from 2048x2048 to 2048x8192 because it now has 4 state blocks x 8 directions = 32 rows instead of 8. 2048x8192 is a **candidate single-sheet layout**, but it is NOT guaranteed safe across all browser/mobile/WebGL environments. Some devices have a maximum texture size of 4096px per dimension; even where 8192px is supported, the memory cost of a 2048x8192 RGBA texture (~64 MB uncompressed per faction) may be prohibitive on mobile.

**Pipeline rule**: Before runtime integration, UNIT-ANIM-01 **must** verify Phaser/WebGL `maxTextureSize` and practical memory behavior on target devices. If the maximum texture size or memory is a concern, split the sheet into per-state spritesheets.

**Per-state fallback naming convention** (used if single-sheet is too large):

```text
harvester_idle_8d_256.png
harvester_move_8d_256.png
harvester_gather_8d_256.png
harvester_unload_8d_256.png
builder_idle_8d_256.png
builder_move_8d_256.png
builder_build_8d_256.png
```

Each per-state sheet is 2048x2048 (8 direction rows x 8 columns), well within all device limits. The per-state fallback adds loader complexity (multiple texture loads per unit type) but is a safe fallback that must be documented and implemented if the single-sheet approach fails validation.

### 5.5 Backward compatibility during transition

When UNIT-ANIM-01 replaces the harvester spritesheet, both the filename and the Phaser spritesheet load call must update simultaneously. The old `harvester_8x8_256.png` is replaced by `harvester_8d_4s_256.png`. The asset key `harvester_cyan` remains the same. The `frameConfig` passed to `scene.load.spritesheet()` changes from `{ frameWidth: 256, frameHeight: 256, endFrame: 63 }` to `{ frameWidth: 256, frameHeight: 256 }` (Phaser auto-computes endFrame from sheet dimensions).

The `generatedAssetManifest.ts` path entry updates from:
```text
'harvester_cyan': 'assets/factions/cyan/units/harvester_8x8_256.png'
```
to:
```text
'harvester_cyan': 'assets/factions/cyan/units/harvester_8d_4s_256.png'
```

And the `civilUnits` family `frameConfig` drops `endFrame: 63` since Phaser will compute it.

---

## 6. Direction mapping

### 6.1 Direction index convention

The direction convention is **locked and must not change**. It matches `directionFromDelta()` output, `DIR_ROW` constants, and `DIR_LABELS` used throughout the codebase.

```text
Index 0 = E   (East)
Index 1 = SE  (South-East)
Index 2 = S   (South)
Index 3 = SW  (South-West)
Index 4 = W   (West)
Index 5 = NW  (North-West)
Index 6 = N   (North)
Index 7 = NE  (North-East)
```

### 6.2 Direction label convention

```typescript
const DIR_LABELS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
```

These labels are used in Animation Manager keys and must match exactly.

### 6.3 Direction in spritesheet rows

Within each animation-state block of 8 rows, the row ordering follows the direction index:

```text
State block row 0 = direction E   (index 0)
State block row 1 = direction SE  (index 1)
State block row 2 = direction S   (index 2)
State block row 3 = direction SW  (index 3)
State block row 4 = direction W   (index 4)
State block row 5 = direction NW  (index 5)
State block row 6 = direction N   (index 6)
State block row 7 = direction NE  (index 7)
```

### 6.4 Isometric direction derivation

Direction is computed from tile-space movement delta via `directionFromDelta(dtx, dty)`, which returns an index 0-7. This function is the single source of truth for direction mapping and must not be duplicated.

---

## 7. Frame counts per animation state

### 7.1 Standard frame counts

| State | Total frames per direction row | Keyframe column | Animation columns |
|-------|-------------------------------|-----------------|-------------------|
| idle | 8 (only column 0 used) | 0 | none (static) |
| move | 8 | 0 | 1-7 |
| gather | 8 | 0 | 1-7 |
| unload | 8 | 0 | 1-7 |
| build | 8 | 0 | 1-7 |

**Consistent model**: Every direction row has exactly 8 columns. Column 0 is the keyframe / primary pose. Columns 1-7 are the 7 animation frames. Idle uses only column 0 (the remaining 7 columns in idle rows are empty/transparent). Move/gather/unload/build playback uses columns 1-7 by default.

Column 0 in non-idle states is the standing/ready pose for that state — it is included in the spritesheet but the animation definition may or may not include it depending on visual feel. The current harvester move animation excludes column 0 from the walk cycle (using frames 1-7), which produces smoother movement. This decision is per-animation and may be tuned.

**Total frames per direction row**: 8 (1 keyframe + 7 animation frames). This preserves the current 8-column grid.

### 7.2 Idle animation

Idle remains a single-frame animation with `repeat: -1` and `frameRate: 1`. This "animation" never visually changes but allows the code to use a consistent `sprite.anims.play()` API for all states, avoiding special-casing idle vs. animated states.

Idle frames occupy row 0-7 (state index 0) in the new layout, one frame per direction.

---

## 8. Required animation states for harvester

### 8.1 State list

| State | State index | Rows | Animation key suffix | Description |
|-------|-------------|------|---------------------|-------------|
| idle | 0 | 0-7 | `_idle_{dir}` | Stationary, facing current direction. Single-frame. |
| move | 1 | 8-15 | `_move_{dir}` | Walk/drive cycle. 7-frame loop at 8 FPS. |
| gather | 2 | 16-23 | `_gather_{dir}` | Mining/gathering animation. 7-frame loop at 6 FPS (slower than move). |
| unload | 3 | 24-31 | `_unload_{dir}` | Unloading cargo at HQ. 7-frame loop at 6 FPS. |

### 8.2 State transition logic

| HarvesterPhase | IsMoving | Animation state |
|---------------|----------|-----------------|
| `idle` | No | `idle` |
| `moving-to-resource` | Yes | `move` |
| `gathering` | No | `gather` |
| `returning-to-hq` | Yes | `move` |
| `unloading` | No | `unload` |
| `manual-move` | Yes | `move` |

### 8.3 Optional: loaded/cargo visual state

A "loaded" visual (harvester carrying raw minerals) is an optional future enhancement. Two implementation options:

1. **Tint overlay**: Apply a Phaser tint to the sprite when `cargoRaw > 0`. Simple, no new assets needed. Does not require a new animation state.
2. **Separate cargo spritesheet**: A second spritesheet overlaid on top showing cargo. Requires new art and a composite render approach. This is deferred until after UNIT-ANIM-01.

For UNIT-ANIM-01, the cargo visual should use the tint approach if any visual is desired, or simply have no visual distinction.

---

## 9. Required animation states for builder

### 9.1 State list

| State | State index | Rows | Animation key suffix | Description |
|-------|-------------|------|---------------------|-------------|
| idle | 0 | 0-7 | `_idle_{dir}` | Stationary, facing current direction. Single-frame. |
| move | 1 | 8-15 | `_move_{dir}` | Walk cycle. 7-frame loop at 8 FPS. |
| build | 2 | 16-23 | `_build_{dir}` | Construction/work animation. 7-frame loop at 5 FPS (deliberate, tool-using motion). |

### 9.2 State transition logic

| BuilderPhase | IsMoving | Animation state |
|-------------|----------|-----------------|
| `idle` | No | `idle` |
| `moving-to-site` | Yes | `move` |
| `building` | No | `build` |
| `manualMove` | Yes | `move` |

---

## 10. Future combat unit/chassis/weapon animation assumptions

This section documents assumptions for future combat unit animation so that current decisions do not paint us into a corner. These are NOT implementation specifications — WEAPON-WORKFLOW-01 will define the actual pipeline.

### 10.1 Assumed combat unit states

| State | Description | Notes |
|-------|-------------|-------|
| idle | Stationary, turret at rest | Single-frame per direction |
| move | Chassis driving | Loop, similar to harvester walk |
| aim | Turret rotating toward target | May be single-frame transition |
| attack/fire | Weapon firing | Short cycle with muzzle flash frame |
| recoil | Chassis rocking from firing | Short yoyo or tween, not necessarily spritesheet frames |
| destroyed | Wreckage/death | Single-frame, may use separate wreck asset |

### 10.2 Chassis/weapon layering assumption

Current modular units (Wasp/Smoky) use separate image files per hull/turret/direction, loaded as individual Phaser images. This allows independent hull and turret rotation.

For animated combat units, the layering model will likely be:

1. **Chassis spritesheet**: Hull body with movement animation states (idle, move). One spritesheet per faction, same row/column layout as civil units.
2. **Turret spritesheet**: Weapon with firing animation states (idle, aim, fire). Same layout model.
3. **Runtime compositing**: Phaser renders chassis sprite and turret sprite as separate `GameObject`s at the same position with different depth offsets. This is the current `ModularTankRenderer` model, extended for animation.

This means the civil unit animation pipeline must produce spritesheets that are compatible with a future layered rendering model. Specifically, the ground anchor and origin point must be consistent across all layers so that chassis + turret compositing works without per-frame offset corrections.

### 10.3 Assumption: no interleaved animation states

Civil and combat unit spritesheets will NOT interleave states within rows. Each state gets its own contiguous block of 8 direction rows. This keeps frame indexing simple and predictable, at the cost of larger sheet sizes. The tradeoff is acceptable because:

- Large sheet sizes can be mitigated by splitting into per-state spritesheets (see section 5.4 for the fallback naming convention). The single-sheet layout is a candidate, not a guarantee.
- The loader only fetches textures that are needed (civil units always, modular units only in debug/arena).
- Simple indexing reduces bugs in both the asset processor and runtime Animation Manager registration.

---

## 11. Anchor/grounding rules

### 11.1 Origin point

All unit sprites use origin `(0.5, 0.75)` — this is the **ground contact point** at 75% from the top of the frame, centered horizontally. The pixel anchor position is (128, 192) for a 256x256 frame. This is NOT the frame bottom — bottom-center would be (0.5, 1.0).

```typescript
sprite.setOrigin(0.5, 0.75);
```

**Why 0.75 and not 1.0?** The lower 25% of the frame (rows 192-255) is transparent safety/spacing area below the unit's feet. It is NOT part of the visible unit. The anchor at (0.5, 0.75) places the origin at the visual contact point between the unit's feet and the ground, which aligns with the tile ground position from `tileToScreen()`. Using 1.0 would place the anchor at the frame's absolute bottom edge, which would cause the unit to float above the tile because the transparent safety area would push the sprite upward.

### 11.2 Anchor must be consistent across all frames

This is a **critical rule**: the origin/anchor must be the same `(0.5, 0.75)` for every frame in every direction and every state. If the unit shifts left/right or up/down between frames, the animation will visually "swim" relative to the tile position, creating a jarring effect.

**What this means for art generation:**

- The unit's contact point with the ground must be at the same pixel position in every frame.
- If the unit leans forward during a walk cycle, the lean must be accommodated by extending the sprite upward within the frame, not by shifting the anchor.
- If the unit has a tall weapon that extends above the frame, the frame must be tall enough to contain it without shifting the ground contact.

### 11.3 Ground position alignment

The unit's sprite position is set from `tileToScreen(ftx, fty)` each frame. The origin `(0.5, 0.75)` ensures the unit's feet land at the tile's ground position. This model is already working for harvesters and must be preserved for all unit types.

### 11.4 What must never be fixed by ad-hoc runtime offsets

The following problems must be fixed in the art, not in runtime code:

- Unit appears to float above the ground -> fix the art anchor/crop, do not add a Y offset constant.
- Unit appears shifted left/right relative to its tile -> fix the art centering, do not add an X offset.
- Unit bobs up/down during walk cycle -> fix the art so ground contact is consistent across frames.
- Different directions have slightly different positions -> fix the art so the unit's center of mass is consistent across all 8 directions.

**Exception**: The `MODULAR_ANCHOR_CORRECTION` in `unitRenderConfig.ts` exists for modular tank compositing where chassis and turret need pixel-level alignment. This is acceptable because it adjusts the composite group, not individual unit anchoring. Civil units must NOT need a similar correction.

---

## 12. Crop/scale rules

### 12.1 Frame dimensions

All civil unit frames are **256x256 pixels**. This is the current standard and must not change without a project-wide decision affecting all unit types simultaneously.

### 12.2 Transparent PNG requirements

- **Background**: Fully transparent (alpha = 0).
- **No solid background color** — the unit must render cleanly over any terrain.
- **No baked shadow** — shadows are rendered by the engine if needed, not baked into the sprite.
- **No anti-alias fringe** — use proper alpha-channel anti-aliasing, not dark halo on edges.
- **PNG format**: 32-bit RGBA (8 bits per channel, including alpha).

### 12.3 Crop rules

Each frame must be tightly cropped to the 256x256 boundary with the following constraints:

- The unit's **ground contact point** must be at pixel position `(128, 192)` — this corresponds to origin `(0.5, 0.75)`.
- The unit's **horizontal center of mass** must be near pixel column 128. Symmetric front-facing units should be centered. Asymmetric units (e.g., a side-facing harvester with a drill arm) should have their visual center of mass at column 128, not their geometric center.
- All 8 directions of the same unit must have their ground contact at the same Y pixel (row 192). This prevents vertical bobbing during direction changes.
- No frame may exceed 256x256. If the unit art is too large, scale it down within the frame rather than expanding the frame.

### 12.4 Scale rules

The render scale for each unit type is defined in `src/config/unitRenderConfig.ts`:

```typescript
HARVESTER_RENDER_SCALE = (41 / 256) * 1.30 ≈ 0.208
BUILDER_RENDER_SCALE   = (40 / 256) * 1.45 ≈ 0.227
```

These scales control how large the unit appears on screen relative to the isometric tile (76x38 px). The "base display size" values (41 for harvester, 40 for builder) represent the approximate pixel footprint of the unit art within the 256px frame.

**When new art is generated**, the base display size may change if the new art occupies a different proportion of the 256px frame. The render scale constants in `unitRenderConfig.ts` must be updated to match the new art's visual footprint. The formula is:

```text
RENDER_SCALE = (newBaseDisplayPx / 256) * SCALE_MULTIPLIER
```

The `SCALE_MULTIPLIER` (1.30 for harvester, 1.45 for builder) is an intentional visual-size increase applied in ARCH-05A and should only change if Denis wants the unit to appear larger or smaller.

---

## 13. Per-faction variant rules

### 13.1 Separate spritesheet per faction

Each faction has its own complete spritesheet. This is the current model and must continue.

- `public/assets/factions/cyan/units/harvester_8d_4s_256.png`
- `public/assets/factions/green/units/harvester_8d_4s_256.png`
- `public/assets/factions/yellow/units/harvester_8d_4s_256.png`
- `public/assets/factions/purple/units/harvester_8d_4s_256.png`

### 13.2 Layout must be identical across factions

All faction variants must have:

- The same frame count per state
- The same direction row ordering
- The same origin `(0.5, 0.75)`
- The same ground contact pixel position
- The same frame dimensions (256x256)

Only the visual content (faction color scheme, decorative details) differs between faction sheets.

### 13.3 Faction color application

Faction colors are applied in the art generation step (e.g., Blender material, AI generation prompt, or manual painting). They are NOT applied at runtime via Phaser tinting for civil units. This ensures:

- Each faction looks distinct and hand-crafted.
- No color-blending artifacts at sprite edges.
- Tinting remains available as a secondary effect (e.g., damage flash, selection highlight) without conflicting with the base faction color.

### 13.4 Fallback behavior

If a faction's texture key does not exist in the TextureManager, the renderer falls back to cyan (current behavior in EntityRenderer). This fallback must produce a console.error, not a silent substitution, so that missing faction assets are detected during QA.

---

## 14. Phaser Animation Manager key model

### 14.1 Key construction

```typescript
const animKey = `${unitType}_${faction}_${state}_${DIR_LABELS[dirIndex]}`;
```

Example:
```typescript
const key = `harvester_cyan_gather_s`;
```

### 14.2 Registration pattern

Animations are registered lazily on first sprite creation (current harvester pattern). The registration method iterates over all factions, all states, and all directions:

```typescript
for (const faction of CIVIL_FACTIONS) {
  const textureKey = getCivilUnitKey(faction, 'harvester');
  if (!this.scene.textures.exists(textureKey)) continue;

  for (let stateIndex = 0; stateIndex < STATE_COUNT; stateIndex++) {
    const stateLabel = STATE_LABELS[stateIndex]; // 'idle', 'move', 'gather', 'unload'

    for (let dirIndex = 0; dirIndex < 8; dirIndex++) {
      const dirLabel = DIR_LABELS[dirIndex];
      const rowStart = (stateIndex * 8 + dirIndex) * FRAMES_PER_DIR;

      const animKey = `harvester_${faction}_${stateLabel}_${dirLabel}`;

      if (stateLabel === 'idle') {
        // Idle: single-frame animation
        this.scene.anims.create({
          key: animKey,
          frames: [{ key: textureKey, frame: rowStart }],
          frameRate: 1,
          repeat: -1,
        });
      } else {
        // Animated state: frames 1 through (FRAMES_PER_DIR - 1) per direction row
        this.scene.anims.create({
          key: animKey,
          frames: this.scene.anims.generateFrameNumbers(textureKey, {
            start: rowStart + 1,
            end: rowStart + FRAMES_PER_DIR - 1,
          }),
          frameRate: STATE_FRAME_RATES[stateLabel],
          repeat: -1,
        });
      }
    }
  }
}
```

### 14.3 Playback

```typescript
sprite.anims.play(animKey, true); // ignoreIfPlaying = true
```

The `ignoreIfPlaying` flag prevents restarting the same animation every frame while allowing direction/state changes to take effect immediately.

### 14.4 Animation key count

| Unit type | Factions | States | Directions | Total keys |
|-----------|----------|--------|------------|------------|
| Harvester | 4 | 4 | 8 | 128 |
| Builder | 4 | 3 | 8 | 96 |
| **Total civil** | | | | **224** |

This is a small number for Phaser's Animation Manager, which is designed for hundreds of animations.

---

## 15. Integration expectations for generatedAssetManifest/runtimeGeneratedAssets

### 15.1 generatedAssetManifest.ts changes

When new animated spritesheets replace old ones:

1. **Path update**: The `civilUnits` family paths change from `harvester_8x8_256.png` to `harvester_8d_4s_256.png`.
2. **frameConfig update**: The `endFrame` field is removed (or set to the new total frame count). Phaser auto-computes from sheet dimensions if `endFrame` is omitted.
3. **Key names unchanged**: `harvester_cyan`, `builder_green`, etc. remain the same.
4. **Version bump**: The manifest version increments if the structure changes.

### 15.2 runtimeGeneratedAssets.ts changes

The `loadGeneratedCivilUnitAssets()` helper does not need code changes — it reads from the manifest and loads whatever paths are listed. The frameConfig in the manifest drives the spritesheet load call.

### 15.3 unitRenderConfig.ts changes

The render scale constants may need updating if new art has a different visual footprint (see section 12.4).

A new configuration constant should be added for the new animation layout:

```typescript
/** Number of animation-state rows per unit type. */
export const HARVESTER_STATE_COUNT = 4;
export const BUILDER_STATE_COUNT = 3;

/** Frames per direction row (including keyframe at column 0). */
export const CIVIL_FRAMES_PER_DIR = 8;

/** State labels in row-block order. */
export const HARVESTER_STATE_LABELS = ['idle', 'move', 'gather', 'unload'] as const;
export const BUILDER_STATE_LABELS = ['idle', 'move', 'build'] as const;

/** Frame rate per animation state. */
export const HARVESTER_STATE_FPS: Record<string, number> = {
  idle: 1,
  move: 8,
  gather: 6,
  unload: 6,
};
export const BUILDER_STATE_FPS: Record<string, number> = {
  idle: 1,
  move: 8,
  build: 5,
};
```

### 15.4 process_art_assets.mjs changes

The asset processor must update the `CIVIL_UNIT_FILE_NAMES` constant to reflect the new naming convention:

```javascript
const CIVIL_UNIT_FILE_NAMES = {
  builder: 'builder_8d_3s_256.png',
  harvester: 'harvester_8d_4s_256.png',
};
```

The `CIVIL_UNIT_FRAME_CONFIG` must drop or update `endFrame`:

```javascript
const CIVIL_UNIT_FRAME_CONFIG = {
  frameWidth: 256,
  frameHeight: 256,
  // endFrame removed — Phaser auto-computes from sheet dimensions
};
```

---

## 16. Validation checklist

Before any new spritesheet is integrated into the runtime, it must pass every item on this checklist. A failed item blocks integration.

### 16.1 File-level checks

- [ ] File exists at the expected path (`public/assets/factions/{faction}/units/{filename}.png`)
- [ ] File is a valid 32-bit RGBA PNG
- [ ] File size is reasonable for the expected sheet dimensions (a 2048x8192 RGBA PNG should be ~5-15 MB)
- [ ] All 4 faction variants exist and have the same pixel dimensions

### 16.2 Layout checks

- [ ] Sheet width = `columnsPerRow * frameWidth` (8 * 256 = 2048)
- [ ] Sheet height = `stateCount * 8 * frameHeight` (harvester: 4 * 8 * 256 = 8192; builder: 3 * 8 * 256 = 6144)
- [ ] Every frame cell is exactly 256x256 with no overlap or gap

### 16.3 Direction checks

- [ ] Row 0 of each state block shows direction E (unit facing right)
- [ ] Row 2 of each state block shows direction S (unit facing down/toward camera)
- [ ] Row 4 of each state block shows direction W (unit facing left, mirror of E)
- [ ] Row 6 of each state block shows direction N (unit facing away from camera)
- [ ] All 8 directions are present and correctly ordered

### 16.4 Anchor/grounding checks

- [ ] Origin `(0.5, 0.75)` places the unit's feet at the expected ground position
- [ ] The ground contact pixel is at row 192 (y=192) in every frame
- [ ] No vertical bobbing during walk cycle (ground contact stays at row 192 across all walk frames)
- [ ] No horizontal shifting during walk cycle (center of mass stays near column 128)

### 16.5 Animation state checks

- [ ] Idle frames show a stationary unit with no animation
- [ ] Move frames show a smooth walk/drive cycle
- [ ] Gather frames show a gathering/mining motion (harvester)
- [ ] Unload frames show an unloading motion (harvester)
- [ ] Build frames show a construction/work motion (builder)
- [ ] Frame rate for each state matches the configured FPS

### 16.6 Faction variant checks

- [ ] All 4 faction variants have the same frame count
- [ ] All 4 faction variants have the same layout
- [ ] Each faction variant uses the correct faction color scheme
- [ ] Cyan, green, yellow, purple variants are visually distinct

### 16.7 Runtime integration checks

- [ ] Asset key (`harvester_cyan`, etc.) loads the correct faction texture
- [ ] Animation Manager keys are registered for all states/directions/factions
- [ ] `sprite.anims.play(key, true)` plays the correct animation
- [ ] No console errors about missing textures or animation keys
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npm run qa:smoke` passes both standard and devtools/arena modes

---

## 17. Preview/QA tooling recommendation

### 17.1 Sprite preview tool

A lightweight HTML preview tool should be created (or extended from the existing `test_art_sample_viewer.mjs`) to display a spritesheet with:

- All 8 directions displayed side-by-side for each animation state
- Animation playback at the configured FPS
- Origin crosshair overlay showing the `(0.5, 0.75)` anchor point
- Frame index labels on each cell
- Grid overlay showing 256x256 cell boundaries

This tool runs outside Phaser (plain HTML/Canvas) so it can validate art before runtime integration.

### 17.2 In-engine debug overlay

The existing devtools panel should be extended with an "Animation Inspector" mode that:

- Shows the current animation key being played on a selected unit
- Displays the frame index and direction
- Allows manual stepping through animation frames
- Highlights the origin point on the sprite

This is a future enhancement, not a prerequisite for UNIT-ANIM-01.

### 17.3 Validation script

A Node.js validation script (`tools/validate_spritesheet.mjs`) should check:

- PNG dimensions match expected layout
- No fully-opaque background pixels (detects non-transparent background)
- Frame grid alignment (256x256 boundaries have no partial frames)
- Consistent alpha bounds across directions (detects anchor shift)

This script runs in CI or locally before integration.

---

## 18. What must be manually approved by Denis before runtime integration

The following items require explicit approval from Denis (the product/direction owner) before the new spritesheets are integrated into the runtime:

1. **Visual quality of walk cycle**: Does the harvester walk cycle look natural at 8 FPS? Are the frames smooth or jerky?
2. **Visual quality of gather/unload animations**: Do the new states look correct for the harvester's mining and unloading actions?
3. **Visual quality of build animation**: Does the builder's construction animation look appropriate?
4. **Ground anchoring**: Does the unit sit correctly on the tile with no floating or sinking?
5. **Faction color correctness**: Are all 4 faction variants visually correct and distinct?
6. **Direction correctness**: Does the unit face the right direction in all 8 orientations? Is east actually east on screen?
7. **Scale relative to tile**: Is the unit the right size relative to the isometric tile?
8. **Frame rate feel**: Are the animation speeds (8 FPS for move, 6 FPS for gather/unload, 5 FPS for build) acceptable?

Denis may request frame rate adjustments, scale changes, or art revisions. These are visual/product decisions that cannot be automated.

---

## 19. What must never be fixed by ad-hoc runtime offsets

The following problems indicate a systemic issue in the art pipeline and must be fixed at the source (art generation), not patched in runtime code:

| Problem | Wrong fix | Correct fix |
|---------|-----------|-------------|
| Unit floats above ground | Add Y offset to `sprite.setPosition()` | Fix art crop so ground contact is at row 192 |
| Unit shifts left/right between frames | Add per-frame X offset table | Fix art so center of mass is at column 128 in every frame |
| Walk cycle bobs vertically | Add Y smoothing code | Fix art so ground contact is consistent across walk frames |
| Different directions have inconsistent positioning | Add per-direction offset constants | Fix art so all 8 directions share the same anchor pixel |
| Faction variant has slightly different anchor | Add per-faction origin adjustment | Fix art so all factions share the same layout and anchor |
| Frame size doesn't match expected dimensions | Add `scaleMode` or `resize` at runtime | Regenerate art at correct dimensions |
| Idle frame looks too static | Add idle bobbing code | Accept static idle as design intent, or provide idle animation frames in art |

The only acceptable runtime offset is the `MODULAR_ANCHOR_CORRECTION` for chassis/turret compositing, which is a fundamentally different problem (aligning two separate sprites, not fixing a single sprite's anchor).

---

## 20. First implementation prompt for UNIT-ANIM-01 after workflow acceptance

After Denis accepts this ASSET-WORKFLOW-01 document, the following prompt is ready for UNIT-ANIM-01:

```text
Task:
UNIT-ANIM-01 — Regenerate harvester animated spritesheet

Mode:
IMPLEMENTATION ONLY.

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm ASSET-WORKFLOW-01 has been accepted and merged into main.
4. Read docs/project/ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md.
5. Read docs/project/PHASER4_ANIM_01_SPIKE_REPORT.md.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md
- src/phaser/render/EntityRenderer.ts
- src/config/unitRenderConfig.ts
- src/assets/civilUnitAssets.ts
- src/assets/generatedAssetManifest.ts
- src/assets/runtimeGeneratedAssets.ts
- src/state/types.ts

Context:
ASSET-WORKFLOW-01 defines the animated unit pipeline. This PR implements
the harvester portion: new animated spritesheet with 4 states (idle, move,
gather, unload), updated Animation Manager registration, and updated
asset manifest/config.

Goal:
Replace current 8x8 harvester spritesheet with the new 4-state layout
defined in ASSET-WORKFLOW-01. Integrate new art, update Animation Manager
registration to support gather/unload states, update render config,
and update the generated manifest.

Scope:
- Replace harvester PNG files in public/assets/factions/{faction}/units/
- Update generatedAssetManifest.ts (run processor or manual update)
- Update unitRenderConfig.ts with HARVESTER_STATE_COUNT, STATE_LABELS, STATE_FPS
- Update EntityRenderer.registerHarvesterAnimations() for 4 states
- Update EntityRenderer.syncHarvesters() to select gather/unload animations
- Update process_art_assets.mjs CIVIL_UNIT_FILE_NAMES for new naming
- Ensure backward compatibility with existing Animation Manager keys
  (idle and move keys must still work during transition)

Texture size gate (section 5.4):
- Before committing to a single 2048x8192 spritesheet, verify that
  Phaser/WebGL maxTextureSize on target devices supports 8192px height.
- If maxTextureSize < 8192 or memory is a concern, split into per-state
  sheets using the naming convention in section 5.4
  (harvester_idle_8d_256.png, harvester_move_8d_256.png, etc.).
- Document the decision (single-sheet vs. per-state split) in the PR body.

Hard rules:
- Do not change builder rendering or ConstructionRenderer.
- Do not change gameplay movement/pathfinding/state logic.
- Do not change PreloadScene loading logic.
- Do not change asset keys (harvester_cyan etc. remain the same).
- Do not change origin (0.5, 0.75).
- Do not add runtime anchor offset corrections.
- Do not start UNIT-ANIM-02.
- Do not start weapon/combat animation work.
- Do not merge.

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA checklist:
- Harvester walk cycle looks natural at 8 FPS
- Harvester gather animation plays during gathering phase
- Harvester unload animation plays during unloading phase
- All 4 factions render correct faction visuals
- No floating/offset relative to tile
- No console errors about missing animation keys
- Direction changes are smooth
- Builder rendering unchanged
- qa:smoke passes both standard and devtools/arena modes

Output:
Open PR into main.
Do not merge.

PR body must include:
- Goal
- Files changed
- What changed (with ASSET-WORKFLOW-01 section references)
- What was intentionally not changed
- Validation results
- Manual QA checklist
- Risks / rollback
- Next recommended task: UNIT-ANIM-02
```

---

## 21. Summary of key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Direction count | 8 directions | Matches current working convention; `directionFromDelta()` returns 0-7 |
| Direction convention | E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7 | Locked, matches existing codebase |
| Spritesheet row model | Rows = directions x states, Columns = frames | Preserves current row-based direction convention; extends naturally to multiple states |
| Frame size | 256x256 px | Current standard, unchanged |
| Frames per direction row | 8 (1 keyframe + 7 animation frames) | Preserves current 8-column grid |
| Per-faction or one atlas | One spritesheet per faction | Current model, avoids runtime compositing complexity |
| Origin/anchor | (0.5, 0.75) | Ground contact point at 75% from top; pixel anchor (128, 192); lower 25% is transparent safety area |
| File naming | `{unitType}_{dirs}d_{states}s_{framePx}.png` | Encodes layout in filename for processor/runtime clarity |
| Animation key pattern | `{unitType}_{faction}_{state}_{dir}` | Current working pattern, extended with new state labels |
| Harvester states | idle, move, gather, unload | 4 states, 8 directions, 4 factions = 128 animation keys |
| Builder states | idle, move, build | 3 states, 8 directions, 4 factions = 96 animation keys |
| Idle animation | Single-frame, frameRate: 1, repeat: -1 | No bobbing, consistent play() API |
| Move FPS | 8 | Current harvester walk cycle speed |
| Gather FPS | 6 | Slower than move, deliberate mining motion |
| Unload FPS | 6 | Same as gather, cargo delivery motion |
| Build FPS | 5 | Slower, tool-using construction motion |
| Cargo visual | Tint overlay or no visual (defer complex composite) | Simple, no new assets needed for UNIT-ANIM-01 |
